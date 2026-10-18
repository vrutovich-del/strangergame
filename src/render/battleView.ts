// Боевая сцена: читает состояние мира (или его сетевую копию) и рисует всё красиво.
import * as THREE from 'three';
import type { GridMap } from '../core/grid';
import { lerp, lerpAngle } from '../core/math';
import { getSkin } from '../heroes/skins';
import type { AimShape, Fighter, Minion, Pickup, Projectile, SimEvent } from '../sim/types';
import type { World } from '../sim/world';
import { Overlay } from '../ui/overlay';
import { Flashes, Particles } from './effects';
import { mesh, toon } from './kit';
import { MapView } from './mapView';
import { Character, createCharacter, isRobot } from './models';
import type { GameRenderer } from './renderer';
import { addLights } from './showcase';
import { blobTexture, energyTexture, germTexture, helperFaceTexture, smileTexture } from './textures';

export interface AimVisual { shape: AimShape; range: number; width: number; angle: number; isSuper: boolean; dist: number }

interface FV {
  c: Character;
  shadow: THREE.Mesh;
  ring: THREE.Mesh;
  side: 'self' | 'ally' | 'enemy';
  move: number;
  facing: number;
  green: number;
  wasAlive: boolean;
}

const RAINBOW = [0xff4b55, 0xff9b3f, 0xffd23f, 0x5ee05a, 0x3fa9ff, 0xb05cff];
const SIDE_COLOR = { self: 0x7dff5a, ally: 0x3fa9ff, enemy: 0xff4b55 };
const EMOTES = ['😀', '👍', '😢', '😡', '😎', '🤣', '🥳', '🤖', '🔥', '💪', '🦠', '⭐'];
export const emoteChar = (i: number) => EMOTES[i] ?? '❓';
export const EMOTE_LIST = EMOTES;

export class BattleView {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, 0.5, 120);
  map: MapView;
  particles: Particles;
  flashes: Flashes;
  overlay: Overlay;
  private fvs = new Map<number, FV>();
  private projs = new Map<number, THREE.Object3D>();
  private minions = new Map<number, THREE.Group>();
  private pickups = new Map<number, THREE.Object3D>();
  private aim: THREE.Mesh | null = null;
  private aimKey = '';
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private shake = 0;
  private wallClock = 0;
  private shadowGeo = new THREE.CircleGeometry(0.42, 20).rotateX(-Math.PI / 2);
  private shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
  private ringGeo = new THREE.RingGeometry(0.42, 0.52, 28).rotateX(-Math.PI / 2);
  private gemGeo = new THREE.OctahedronGeometry(0.22, 0);
  private gemMat = toon(0xc45cff, { emissive: 0x6a1aa0, ei: 0.5 });
  private cubeMat = toon(0x5ee05a, { emissive: 0x2fbf3a, ei: 0.6 });
  private outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a0f2e, side: THREE.BackSide });
  private tmp = new THREE.Vector3();
  /** Каким командам «свои» (для цвета колец и полосок). */
  localTeam = 0;
  localId = 0;
  spectateId = 0;
  showdown = false;

  constructor(public r: GameRenderer, grid: GridMap, uiRoot: HTMLElement) {
    this.scene.background = null;
    addLights(this.scene, 1.0);
    this.scene.fog = new THREE.Fog(grid.theme === 'grass' ? 0x3d7d2c : 0xc28e4a, 26, 60);
    this.map = new MapView(grid);
    this.scene.add(this.map.group);
    this.particles = new Particles(this.scene);
    this.flashes = new Flashes(this.scene);
    this.overlay = new Overlay(uiRoot);
    this.camLook.set(grid.w / 2, 0, grid.h / 2);
    this.camPos.copy(this.camLook);
  }

  private sideOf(w: World, f: Fighter): 'self' | 'ally' | 'enemy' {
    if (f.id === this.localId) return 'self';
    return w.effTeam(f) === this.localTeam ? 'ally' : 'enemy';
  }

  private ensureFV(w: World, f: Fighter): FV {
    let v = this.fvs.get(f.id);
    if (v) return v;
    const side = this.sideOf(w, f);
    const team = isRobot(f.heroId) ? (f.dummy ? 'orange' : f.team === this.localTeam ? 'blue' : 'red') : 'blue';
    const c = createCharacter(f.heroId, f.skinId, team);
    this.scene.add(c.root);
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.position.y = 0.02;
    c.root.add(shadow);
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: SIDE_COLOR[side], transparent: true, opacity: 0.85, depthWrite: false }));
    ring.position.y = 0.03;
    c.root.add(ring);
    v = { c, shadow, ring, side, move: 0, facing: f.facing, green: 0, wasAlive: f.alive };
    this.fvs.set(f.id, v);
    return v;
  }

  /** Обновить сцену по состоянию мира. alpha — доля между прошлым и текущим тиком. */
  sync(w: World, alpha: number, dt: number) {
    this.wallClock += dt;
    const time = w.time;
    const seen = new Set<number>();
    const bushFade: { x: number; y: number }[] = [];
    let local: { x: number; y: number } | null = null;
    const W = this.r.width, H = this.r.height;
    this.camera.updateMatrixWorld();
    for (const f of w.fighters) {
      seen.add(f.id);
      const v = this.ensureFV(w, f);
      const x = lerp(f.px, f.x, alpha), y = lerp(f.py, f.y, alpha);
      const side = this.sideOf(w, f);
      if (side !== v.side) {
        v.side = side;
        (v.ring.material as THREE.MeshBasicMaterial).color.setHex(SIDE_COLOR[side]);
      }
      const deadFor = f.alive ? -1 : time - f.deadAt;
      const visible = f.alive ? w.isVisibleTo(f, this.localTeam) : deadFor < 1.4 && v.wasAlive;
      v.c.root.visible = visible;
      if (f.alive) v.wasAlive = true;
      if (f.id === this.localId) local = { x, y };
      if (f.alive && f.inBush && side !== 'enemy' && bushFade.length < 4) bushFade.push({ x, y });
      v.c.setOpacity(f.alive && f.inBush && side !== 'enemy' ? 0.62 : 1);
      if (visible) {
        v.c.root.position.set(x, 0, y);
        v.facing = lerpAngle(v.facing, f.facing, Math.min(1, dt * 16));
        v.c.root.rotation.y = Math.PI / 2 - v.facing;
        v.move += ((f.moving && f.alive ? 1 : 0) - v.move) * Math.min(1, dt * 10);
        const infected = time < f.infectedUntil;
        v.green += ((infected ? 1 : 0) - v.green) * Math.min(1, dt * 6);
        v.c.green = v.green;
        const helpers = f.heroId === 'smile' && w.minions.some((m) => m.ownerId === f.id && m.alive);
        v.c.animate({
          t: this.wallClock + f.id * 0.37, dt, move: v.move, shot: time - f.shotAt, sup: time - f.superAt, hurt: time - f.hurtAt,
          dead: deadFor, win: false, lose: false, showcase: false, helpers, infected,
        });
        v.c.updateMaterials(dt);
        v.ring.visible = f.alive;
        v.shadow.visible = f.alive || deadFor < 0.5;
        const sr = f.alive && side === 'self' && f.superCharge >= 1;
        (v.ring.material as THREE.MeshBasicMaterial).color.setHex(sr ? 0xffd23f : SIDE_COLOR[side]);
        if (sr) v.ring.scale.setScalar(1 + Math.sin(this.wallClock * 8) * 0.08); else v.ring.scale.setScalar(1);
      }
      // табличка над головой
      const pl = this.overlay.plate(f.id);
      const showPlate = visible && f.alive;
      if (showPlate) {
        this.tmp.set(x, v.c.view.height + 0.25, y).project(this.camera);
        const sx = (this.tmp.x * 0.5 + 0.5) * W, sy = (-this.tmp.y * 0.5 + 0.5) * H;
        pl.set({
          name: f.name, level: f.level, hp: f.hp, maxHp: f.maxHp, side, ammo: f.ammo, gems: f.gems, cubes: f.cubes,
          infected: time < f.infectedUntil, emote: time < f.emoteUntil && f.emote >= 0 ? emoteChar(f.emote) : '', superReady: side === 'self' && f.superCharge >= 1,
        });
        pl.place(sx, sy, this.tmp.z < 1);
      } else pl.place(0, 0, false);
    }
    for (const [id, v] of this.fvs) if (!seen.has(id)) { v.c.dispose(); this.fvs.delete(id); this.overlay.dropPlate(id); }
    this.map.setFadePoints(bushFade, local);
    this.syncProjectiles(w, alpha, dt);
    this.syncMinions(w, alpha, dt);
    this.syncPickups(w, alpha);
    this.map.update(this.wallClock, dt, w.zone);
    this.particles.update(dt);
    this.flashes.update(dt);
    this.updateCamera(w, alpha, dt);
  }

  private projColor(w: World, p: Projectile): number {
    const owner = w.findById(p.ownerId);
    if (!owner) return 0xffd23f;
    const skin = getSkin(owner.heroId, owner.skinId);
    if (skin.shotColor === -1) return RAINBOW[p.id % RAINBOW.length];
    return skin.shotColor ?? (owner.heroId === 'bacteria' ? 0xb05cff : 0xffd23f);
  }

  private makeProj(w: World, p: Projectile): THREE.Object3D {
    const team = p.team === this.localTeam ? 0x5fc8ff : 0xff5a64;
    let tex: THREE.Texture, size = 0.45, additive = false;
    switch (p.kind) {
      case 'smile': tex = smileTexture(this.projColor(w, p), p.id % 3 === 2 ? 3 : 0); size = 0.48; break;
      case 'smile_mini': tex = smileTexture(this.projColor(w, p), 0); size = 0.32; break;
      case 'germ': tex = germTexture(this.projColor(w, p)); size = 0.46; break;
      case 'germ_big': tex = germTexture(this.projColor(w, p), true); size = 1.25; break;
      case 'energy': tex = energyTexture(team); size = 0.62; additive = true; break;
      case 'energy_big': tex = energyTexture(team); size = 0.8; additive = true; break;
      case 'laser': tex = energyTexture(team); size = 0.5; additive = true; break;
      case 'beam': tex = energyTexture(team); size = 0.9; additive = true; break;
      case 'punch': tex = blobTexture(); size = 0.01; break;
      default: tex = energyTexture(team);
    }
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(size);
    s.userData.kind = p.kind;
    s.userData.spin = p.kind.startsWith('germ') ? 6 : p.kind.startsWith('smile') ? 4 : 0;
    this.scene.add(s);
    return s;
  }

  private syncProjectiles(w: World, alpha: number, dt: number) {
    const seen = new Set<number>();
    for (const p of w.projectiles) {
      seen.add(p.id);
      let o = this.projs.get(p.id);
      if (!o) { o = this.makeProj(w, p); this.projs.set(p.id, o); }
      const x = lerp(p.px, p.x, alpha), y = lerp(p.py, p.y, alpha);
      o.position.set(x, 0.75, y);
      const s = o as THREE.Sprite;
      if (o.userData.spin) s.material.rotation += dt * o.userData.spin;
      if (p.kind === 'germ_big' && Math.random() < 0.6) this.particles.spawn({ x, y: 0.7, z: y, n: 1, color: [0x9dff5a, 0xc77aff], speed: 0.6, up: 0.6, size: 0.12, life: 0.5, grav: 0 });
      if ((p.kind === 'laser' || p.kind === 'beam') && Math.random() < 0.8) this.particles.spawn({ x, y: 0.75, z: y, n: 1, color: p.team === this.localTeam ? 0x9ff4ff : 0xff8a8a, speed: 0.2, up: 0, size: 0.1, life: 0.25, grav: 0 });
    }
    for (const [id, o] of this.projs) if (!seen.has(id)) { o.removeFromParent(); (o as THREE.Sprite).material.dispose(); this.projs.delete(id); }
  }

  private makeHelper(m: Minion, w: World): THREE.Group {
    const g = new THREE.Group();
    const owner = w.findById(m.ownerId);
    const skin = owner ? getSkin(owner.heroId, owner.skinId) : null;
    const color = skin?.shotColor && skin.shotColor > 0 ? skin.shotColor : 0xffc933;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), new THREE.MeshToonMaterial({ map: helperFaceTexture(color, m.slot % 3), color: 0xffffff }));
    head.rotation.y = -Math.PI / 2;
    head.name = 'head';
    g.add(head);
    const ol = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 12), this.outlineMat);
    g.add(ol);
    const wingMat = toon(0xffffff);
    for (const s of [1, -1]) {
      const wgr = new THREE.Group();
      wgr.name = 'wing' + s;
      wgr.position.set(0.28 * s, 0.08, -0.05);
      mesh(new THREE.SphereGeometry(0.16, 12, 8), wingMat, 'w', wgr, [0.12 * s, 0, 0], undefined, [1, 0.25, 0.6]);
      g.add(wgr);
    }
    const sh = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    sh.scale.setScalar(0.6);
    sh.name = 'shadow';
    g.add(sh);
    this.scene.add(g);
    return g;
  }

  private syncMinions(w: World, alpha: number, dt: number) {
    const seen = new Set<number>();
    for (const m of w.minions) {
      seen.add(m.id);
      let g = this.minions.get(m.id);
      if (!g) { g = this.makeHelper(m, w); this.minions.set(m.id, g); }
      const x = lerp(m.px, m.x, alpha), y = lerp(m.py, m.y, alpha);
      const t = this.wallClock * 1 + m.slot;
      const fly = 1.15 + Math.sin(t * 4) * 0.12;
      g.position.set(x, 0, y);
      g.children.forEach((c) => { if (c.name !== 'shadow') c.position.y = fly + (c.name.startsWith('wing') ? 0.08 : 0); });
      g.rotation.y = Math.PI / 2 - m.facing;
      const flap = Math.sin(this.wallClock * 30) * 0.6;
      g.getObjectByName('wing1')!.rotation.z = flap;
      g.getObjectByName('wing-1')!.rotation.z = -flap;
      const age = w.time - m.shotAt;
      const head = g.getObjectByName('head')!;
      head.scale.setScalar(age < 0.15 ? 1.15 : 1);
      // в конце жизни мигают
      g.visible = !(m.expiresAt - w.time < 1 && Math.sin(this.wallClock * 25) > 0.3);
      const hurt = w.time - m.hurtAt;
      ((head as THREE.Mesh).material as THREE.MeshToonMaterial).emissive.setScalar(hurt < 0.12 ? 0.8 : 0);
      void dt;
    }
    for (const [id, g] of this.minions) if (!seen.has(id)) { g.removeFromParent(); this.minions.delete(id); }
  }

  private syncPickups(w: World, alpha: number) {
    const seen = new Set<number>();
    for (const p of w.pickups) {
      seen.add(p.id);
      let o = this.pickups.get(p.id);
      if (!o) { o = this.makePickup(p); this.pickups.set(p.id, o); }
      const x = lerp(p.px, p.x, alpha), y = lerp(p.py, p.y, alpha);
      const age = w.time - p.bornAt;
      const pop = age < 0.45 ? Math.sin((age / 0.45) * Math.PI) * 0.8 : 0;
      o.position.set(x, 0.35 + pop + Math.sin(this.wallClock * 3 + p.id) * 0.08, y);
      o.rotation.y = this.wallClock * 2 + p.id;
    }
    for (const [id, o] of this.pickups) if (!seen.has(id)) { o.removeFromParent(); this.pickups.delete(id); }
  }

  private makePickup(p: Pickup): THREE.Object3D {
    const g = new THREE.Group();
    if (p.kind === 'gem') {
      const m = new THREE.Mesh(this.gemGeo, this.gemMat);
      m.scale.set(1, 1.4, 1);
      g.add(m);
      const ol = new THREE.Mesh(this.gemGeo, this.outlineMat);
      ol.scale.set(1.18, 1.6, 1.18);
      g.add(ol);
    } else {
      const geo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
      g.add(new THREE.Mesh(geo, this.cubeMat));
      const ol = new THREE.Mesh(geo, this.outlineMat);
      ol.scale.setScalar(1.18);
      g.add(ol);
    }
    const sh = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    sh.scale.setScalar(0.45);
    sh.position.y = -0.33;
    g.add(sh);
    this.scene.add(g);
    return g;
  }

  // ───────────────────────── звезда-цель (обучение) ─────────────────────────
  private mark: THREE.Group | null = null;
  setMark(p: { x: number; y: number } | null) {
    if (!p) { if (this.mark) this.mark.visible = false; return; }
    if (!this.mark) {
      const g = new THREE.Group();
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.22 : 0.5, a = (i / 10) * Math.PI * 2 - Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) shape.lineTo(x, y); else shape.moveTo(x, y); }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
      geo.center();
      const star = new THREE.Mesh(geo, toon(0xffd23f, { emissive: 0xffa000, ei: 0.5 }));
      star.name = 'star';
      const ol = new THREE.Mesh(geo, this.outlineMat); ol.scale.setScalar(1.12); star.add(ol);
      g.add(star);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, depthWrite: false }));
      ring.name = 'ring'; ring.position.y = 0.05; g.add(ring);
      this.scene.add(g);
      this.mark = g;
    }
    const g = this.mark;
    g.visible = true;
    g.position.set(p.x, 0, p.y);
    const star = g.getObjectByName('star')!;
    star.position.y = 1.1 + Math.sin(this.wallClock * 3) * 0.15;
    star.rotation.y = this.wallClock * 2;
    g.getObjectByName('ring')!.scale.setScalar(1 + Math.sin(this.wallClock * 5) * 0.12);
  }

  // ───────────────────────── прицел ─────────────────────────
  setAim(a: AimVisual | null, w: World) {
    const me = w.findById(this.localId);
    if (!a || !me || !me.alive) { if (this.aim) this.aim.visible = false; return; }
    const key = `${a.shape}:${a.width.toFixed(2)}:${a.isSuper}`;
    if (key !== this.aimKey) {
      this.aim?.removeFromParent();
      this.aimKey = key;
      let geo: THREE.BufferGeometry;
      if (a.shape === 'cone' || a.shape === 'melee') geo = new THREE.CircleGeometry(1, 24, -a.width / 2, a.width).rotateX(-Math.PI / 2);
      else if (a.shape === 'throw') geo = new THREE.RingGeometry(0.0, 1, 32).rotateX(-Math.PI / 2);
      else geo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0).rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: a.isSuper ? 0xffd23f : 0xffffff, transparent: true, opacity: a.isSuper ? 0.45 : 0.35, depthWrite: false });
      this.aim = new THREE.Mesh(geo, mat);
      this.aim.renderOrder = 4;
      this.scene.add(this.aim);
    }
    const m = this.aim!;
    m.visible = true;
    const v = this.fvs.get(this.localId);
    const px = v ? v.c.root.position.x : me.x, pz = v ? v.c.root.position.z : me.y;
    if (a.shape === 'throw') {
      const d = Math.min(a.range, a.dist);
      m.position.set(px + Math.cos(a.angle) * d, 0.07, pz + Math.sin(a.angle) * d);
      m.rotation.set(0, 0, 0);
      m.scale.setScalar(a.width / 2);
    } else {
      const len = a.shape === 'cone' || a.shape === 'melee' ? a.range : w.map.rayLength(px, pz, a.angle, a.range);
      m.position.set(px, 0.07, pz);
      m.rotation.set(0, -a.angle, 0);
      if (a.shape === 'cone' || a.shape === 'melee') m.scale.setScalar(len);
      else m.scale.set(len, 1, a.width);
    }
  }

  // ───────────────────────── камера ─────────────────────────
  private updateCamera(w: World, alpha: number, dt: number) {
    const map = w.map;
    let f = w.findById(this.localId);
    if (!f || (!f.alive && this.spectateId)) f = w.findById(this.spectateId) ?? f;
    const aspect = this.r.width / Math.max(1, this.r.height);
    this.camera.aspect = aspect;
    const vf = (this.camera.fov * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    const D = THREE.MathUtils.clamp(9.6 / Math.tan(hf / 2), 13, 21);
    const pitch = (55 * Math.PI) / 180;
    let tx = map.w / 2, tz = map.h / 2;
    if (f) { tx = lerp(f.px, f.x, alpha); tz = lerp(f.py, f.y, alpha) - 1.1; }
    const halfW = D * Math.tan(hf / 2) * 0.92;
    if (map.w > halfW * 2 - 2) tx = THREE.MathUtils.clamp(tx, halfW - 1.5, map.w - halfW + 1.5); else tx = map.w / 2;
    tz = THREE.MathUtils.clamp(tz, 3, map.h - 3.5);
    const k = 1 - Math.pow(0.0005, dt);
    this.camLook.x += (tx - this.camLook.x) * k;
    this.camLook.z += (tz - this.camLook.z) * k;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const s = this.shake * this.shake * 0.5;
    this.camera.position.set(
      this.camLook.x + (Math.random() - 0.5) * s,
      Math.sin(pitch) * D + (Math.random() - 0.5) * s,
      this.camLook.z + Math.cos(pitch) * D,
    );
    this.camera.lookAt(this.camLook.x, 0, this.camLook.z);
    this.camera.updateProjectionMatrix();
  }

  addShake(v: number) { this.shake = Math.min(1.2, this.shake + v); }

  /** Сразу поставить камеру на игрока (в начале боя). */
  snapCamera(w: World) {
    const f = w.findById(this.localId);
    if (f) { this.camLook.set(f.x, 0, f.y - 1.1); }
    this.updateCamera(w, 1, 1);
  }

  // ───────────────────────── события ─────────────────────────
  private screen(x: number, y: number, h = 1.2) {
    this.tmp.set(x, h, y).project(this.camera);
    return { x: (this.tmp.x * 0.5 + 0.5) * this.r.width, y: (-this.tmp.y * 0.5 + 0.5) * this.r.height };
  }

  onEvents(events: SimEvent[], w: World) {
    const fx = this.r.effects;
    for (const e of events) {
      switch (e.t) {
        case 'shot': {
          const f = w.findById(e.id);
          const v = f ? this.fvs.get(f.id) : undefined;
          const col = f ? (f.heroId === 'bacteria' ? [0xc77aff, 0x9dff5a] : f.heroId === 'smile' ? [0xffe066, 0xffffff] : [0x9ff4ff, 0xffffff]) : [0xffffff];
          const x = e.x + Math.cos(e.a) * 0.5, z = e.y + Math.sin(e.a) * 0.5;
          if (e.heroId === 'smile_helper') { this.particles.spawn({ x, y: 1.1, z, n: 2, color: [0xffe066], speed: 1, up: 0.5, size: 0.06, life: 0.2 }); break; }
          this.particles.spawn({ x, y: 0.75, z, n: Math.ceil(4 * fx), color: col, speed: 3, up: 1, size: 0.07, life: 0.25, dirX: Math.cos(e.a), dirZ: Math.sin(e.a), spread: 0.5 });
          if (e.sup) {
            this.flashes.ring(e.x, e.y, 0xffd23f, 2.4, 0.5);
            if (v && (e.id === this.localId || this.near(w, e.x, e.y, 6))) this.addShake(e.id === this.localId ? 0.7 : 0.35);
            this.particles.spawn({ x: e.x, y: 0.4, z: e.y, n: Math.ceil(14 * fx), color: [0xffd23f, 0xffffff, 0xff9b3f], speed: 4, up: 4, size: 0.08, life: 0.6 });
          }
          if (v) v.c.flash = Math.max(v.c.flash, 0);
          break;
        }
        case 'hit': {
          const f = w.findById(e.id);
          const v = this.fvs.get(e.id);
          if (v) v.c.flash = 1;
          if (f && v && v.c.root.visible) {
            const p = this.screen(e.x, e.y, (v.c.view.height || 1.4) + 0.1);
            const side = this.sideOf(w, f);
            this.overlay.number(p.x + (Math.random() - 0.5) * 30, p.y, String(e.amount), side === 'self' ? 'me' : side === 'ally' ? 'ally' : e.sup ? 'super' : '');
            this.particles.spawn({ x: e.x, y: 0.8, z: e.y, n: Math.ceil(5 * fx), color: e.by === 0 ? [0x7fe04a] : [0xffffff, 0xffe066, side === 'enemy' ? 0xff6a6a : 0x7fd0ff], speed: 3, up: 3, size: 0.07, life: 0.35 });
            if (e.id === this.localId) this.addShake(Math.min(0.4, e.amount / 3000));
          }
          break;
        }
        case 'mhit': {
          const p = this.screen(e.x, e.y, 1.6);
          this.overlay.number(p.x, p.y, String(e.amount), 'small');
          break;
        }
        case 'death': {
          const f = w.findById(e.id);
          const col = f?.heroId === 'bacteria' ? [0xb05cff, 0x7fe04a, 0x2f1a3c] : f?.heroId === 'smile' ? [0xffd23f, 0xf28a17, 0xffffff] : [0x9aa6bf, 0x2b3245, f?.team === this.localTeam ? 0x3fa9ff : 0xff4b55];
          this.particles.spawn({ x: e.x, y: 0.7, z: e.y, n: Math.ceil(26 * fx), color: col, speed: 5, up: 5, size: 0.12, life: 0.9 });
          this.flashes.ring(e.x, e.y, 0xffffff, 2.2, 0.45);
          if (e.id === this.localId) this.addShake(0.6);
          break;
        }
        case 'impact': {
          if (e.kind === 'box') { this.map.shakeBox(Math.floor(e.x), Math.floor(e.y), this.wallClock); this.particles.spawn({ x: e.x, y: 0.8, z: e.y, n: 3, color: [0x9aa0b0, 0x5ee05a], speed: 2, up: 2, size: 0.06, life: 0.3 }); break; }
          const end = e.kind.endsWith('_end');
          const k = e.kind.replace('_end', '');
          const col = k.startsWith('germ') ? [0xc77aff, 0x9dff5a] : k.startsWith('smile') ? [0xffe066, 0xffffff] : [0x9ff4ff, 0xffffff];
          this.particles.spawn({ x: e.x, y: 0.7, z: e.y, n: Math.ceil((end ? 3 : 5) * fx), color: col, speed: 2, up: 2, size: 0.06, life: 0.3 });
          if (k === 'germ_big') this.flashes.ring(e.x, e.y, 0x9dff5a, 1.6, 0.4);
          break;
        }
        case 'tile': {
          this.particles.spawn({ x: e.tx + 0.5, y: 0.6, z: e.ty + 0.5, n: Math.ceil(18 * fx), color: [0xc07a3c, 0x8a5426, 0xe0a060, 0x4a4f63], speed: 4, up: 5, size: 0.13, life: 0.9 });
          this.flashes.ring(e.tx + 0.5, e.ty + 0.5, 0xffffff, 1.4, 0.3);
          break;
        }
        case 'pickup': {
          this.particles.spawn({ x: e.x, y: 0.5, z: e.y, n: Math.ceil(8 * fx), color: e.kind === 'gem' ? [0xc45cff, 0xffffff] : [0x5ee05a, 0xffffff], speed: 2, up: 3, size: 0.07, life: 0.4 });
          const p = this.screen(e.x, e.y, 1.4);
          this.overlay.floatText(p.x, p.y, e.kind === 'gem' ? '+1 💎' : '+1 ⚡');
          break;
        }
        case 'gem': this.flashes.glow(e.x, 0.3, e.y, 0xc77aff, 1.8, 0.4); break;
        case 'infect': {
          const f = w.findById(e.id);
          if (f) {
            this.flashes.ring(f.x, f.y, 0x7fe04a, 2.2, 0.5);
            this.particles.spawn({ x: f.x, y: 1, z: f.y, n: Math.ceil(16 * fx), color: [0x7fe04a, 0xb05cff], speed: 2.5, up: 3, size: 0.1, life: 0.7 });
            const p = this.screen(f.x, f.y, 1.9);
            this.overlay.floatText(p.x, p.y, 'Заражён! 🦠');
          }
          break;
        }
        case 'cure': {
          const f = w.findById(e.id);
          if (f) {
            this.particles.spawn({ x: f.x + Math.cos(f.facing) * 0.4, y: 0.9, z: f.y + Math.sin(f.facing) * 0.4, n: Math.ceil(14 * fx), color: [0x9dff5a, 0xd6ffb0], speed: 4, up: 1.5, size: 0.09, life: 0.5, dirX: Math.cos(f.facing), dirZ: Math.sin(f.facing), spread: 0.6 });
            const p = this.screen(f.x, f.y, 1.9);
            this.overlay.floatText(p.x, p.y, 'Апчхи!');
          }
          break;
        }
        case 'minion': {
          this.particles.spawn({ x: e.x, y: 1.1, z: e.y, n: Math.ceil(10 * fx), color: [0xffd23f, 0xffffff, 0xff9b3f], speed: 3, up: 2, size: 0.08, life: 0.45 });
          if (!e.on) { const p = this.screen(e.x, e.y, 1.6); this.overlay.floatText(p.x, p.y, 'поп!'); }
          break;
        }
        case 'ready': if (e.id === this.localId) { const f = w.findById(e.id); if (f) this.flashes.ring(f.x, f.y, 0xffd23f, 1.8, 0.5); } break;
        case 'dash': {
          const f = w.findById(e.id);
          if (f) this.particles.spawn({ x: f.x, y: 0.2, z: f.y, n: Math.ceil(12 * fx), color: [0xd8c8a8, 0xffffff], speed: 2, up: 1.5, size: 0.12, life: 0.5 });
          if (f && this.near(w, f.x, f.y, 5)) this.addShake(0.3);
          break;
        }
        case 'beam': this.flashes.beam(e.x, e.y, e.x2, e.y2, e.team === this.localTeam ? 0x7fe8ff : 0xff6a7a); break;
        case 'spawn': {
          const f = w.findById(e.id);
          const v = this.fvs.get(e.id);
          if (v) { v.wasAlive = true; v.c.resetPose(); }
          if (f) this.flashes.ring(f.x, f.y, 0xffffff, 1.4, 0.35);
          break;
        }
      }
    }
  }

  private near(w: World, x: number, y: number, r: number) {
    const f = w.findById(this.localId);
    return !!f && Math.hypot(f.x - x, f.y - y) < r;
  }

  render() {
    this.r.gl.render(this.scene, this.camera);
  }

  dispose() {
    for (const v of this.fvs.values()) v.c.dispose();
    this.fvs.clear();
    this.map.dispose();
    this.overlay.dispose();
    this.scene.clear();
  }
}
