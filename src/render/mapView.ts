// Карта в 3D: пол, стены, ящики, кусты, вода, шахта, базы, украшения вокруг, ядовитое облако.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GridMap, T } from '../core/grid';
import { Rng } from '../core/rng';
import { roundedBox, toon } from './kit';
import { waterTexture } from './textures';

const THEMES = {
  grass: {
    floorA: '#86d65c', floorB: '#7bcb52', dark: '#4e9a36', outside: 0x3d7d2c,
    wallSide: 0x5d6f93, wallTop: 0x9db0d2, crate: 0xc07a3c, crateTop: 0xe0a060, bushA: 0x2f9e3a, bushB: 0x56c94a,
  },
  sand: {
    floorA: '#f2cf86', floorB: '#ebc475', dark: '#c99a4e', outside: 0xc28e4a,
    wallSide: 0xb5713b, wallTop: 0xe6a464, crate: 0x9c6a3a, crateTop: 0xc48b52, bushA: 0x4f9a2e, bushB: 0x8acb3e,
  },
};

/** Шейдерная вставка: прозрачность возле заданных точек (кусты возле своих, стены перед игроком). */
function addFade(mat: THREE.Material, kind: 'bush' | 'wall', uniforms: { uFade: { value: THREE.Vector4[] } }) {
  mat.transparent = true;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uFade = uniforms.uFade;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFadePos;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vFadePos = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#else
  vFadePos = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif`);
    const code = kind === 'bush'
      ? `float d = distance(vFadePos.xz, p.xz); fade = min(fade, mix(0.32, 1.0, smoothstep(1.1, 2.0, d)));`
      : `vec2 dd = vFadePos.xz - p.xz; if (dd.y > 0.3 && dd.y < 2.2 && abs(dd.x) < 1.25) fade = min(fade, 0.42);`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFadePos;\nuniform vec4 uFade[4];')
      .replace('#include <dithering_fragment>', `float fade = 1.0;
for (int i = 0; i < 4; i++) { vec4 p = uFade[i]; if (p.w > 0.5) { ${code} } }
gl_FragColor.a *= fade;
#include <dithering_fragment>`);
  };
  mat.customProgramCacheKey = () => 'fade_' + kind;
}

function outlineGeo(g: THREE.BufferGeometry, w: number) {
  const o = g.clone();
  const pos = o.attributes.position, nor = o.attributes.normal;
  // сглаженные нормали по позициям, чтобы обводка не рвалась на углах
  const acc = new Map<string, THREE.Vector3>();
  const key = (i: number) => `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i), v = acc.get(k) ?? new THREE.Vector3();
    v.x += nor.getX(i); v.y += nor.getY(i); v.z += nor.getZ(i); acc.set(k, v);
  }
  for (let i = 0; i < pos.count; i++) {
    const n = acc.get(key(i))!.clone().normalize();
    pos.setXYZ(i, pos.getX(i) + n.x * w, pos.getY(i) + n.y * w, pos.getZ(i) + n.z * w);
  }
  o.deleteAttribute('normal');
  return o;
}

const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x1a0f2e, side: THREE.BackSide });

class InstancedSet {
  mesh: THREE.InstancedMesh;
  outline: THREE.InstancedMesh | null;
  index = new Map<number, number>();
  private count = 0;
  constructor(public geo: THREE.BufferGeometry, mat: THREE.Material, max: number, parent: THREE.Object3D, outlineW = 0.03, outlineMat: THREE.Material = OUTLINE_MAT) {
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, max));
    this.mesh.count = 0;
    parent.add(this.mesh);
    if (outlineW > 0) {
      this.outline = new THREE.InstancedMesh(outlineGeo(geo, outlineW), outlineMat, Math.max(1, max));
      this.outline.count = 0;
      parent.add(this.outline);
    } else this.outline = null;
  }
  add(key: number, m: THREE.Matrix4) {
    const i = this.count++;
    this.mesh.setMatrixAt(i, m);
    this.outline?.setMatrixAt(i, m);
    this.mesh.count = this.count;
    if (this.outline) this.outline.count = this.count;
    this.index.set(key, i);
  }
  hide(key: number) {
    const i = this.index.get(key);
    if (i === undefined) return;
    const z = new THREE.Matrix4().makeScale(0, 0, 0);
    this.mesh.setMatrixAt(i, z); this.mesh.instanceMatrix.needsUpdate = true;
    if (this.outline) { this.outline.setMatrixAt(i, z); this.outline.instanceMatrix.needsUpdate = true; }
    this.index.delete(key);
  }
  finish() {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.outline) this.outline.instanceMatrix.needsUpdate = true;
    this.mesh.computeBoundingSphere();
    this.outline?.computeBoundingSphere();
  }
}

export class MapView {
  group = new THREE.Group();
  fadeBush = { uFade: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) } };
  fadeWall = { uFade: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) } };
  private walls: InstancedSet;
  private wallTops: InstancedSet;
  private crates: InstancedSet;
  private crateTops: InstancedSet;
  private boxes: InstancedSet;
  private boxCubes: InstancedSet;
  private bushes: InstancedSet;
  private water: THREE.Texture | null = null;
  private poison: THREE.Mesh;
  private poisonUni = { uRect: { value: new THREE.Vector4(-100, -100, 100, 100) }, uTime: { value: 0 } };
  private puffs: THREE.InstancedMesh;
  private boxShake = new Map<number, number>();
  private mine: THREE.Group | null = null;
  private version = -1;

  constructor(public map: GridMap) {
    const th = THEMES[map.theme];
    const g = this.group;
    const rng = new Rng(map.w * 131 + map.h);
    // пол — одна текстура на всю карту
    g.add(this.makeGround(th));
    // окружение
    const out = new THREE.Mesh(new THREE.PlaneGeometry(map.w + 80, map.h + 80).rotateX(-Math.PI / 2), toon(th.outside));
    out.position.set(map.w / 2, -0.02, map.h / 2);
    g.add(out);

    const count = (t: number) => map.tiles.reduce((a, x) => a + (x === t ? 1 : 0), 0);
    const ring = 2 * (map.w + map.h) + 4;
    // стены: бока + светлая крышка
    const wallGeo = roundedBox(1, 0.9, 1, 0.12).translate(0, 0.45, 0);
    const wallTopGeo = roundedBox(1.02, 0.16, 1.02, 0.07).translate(0, 0.92, 0);
    const wallMat = toon(th.wallSide), wallTopMat = toon(th.wallTop);
    addFade(wallMat, 'wall', this.fadeWall); addFade(wallTopMat, 'wall', this.fadeWall);
    const wallOutline = OUTLINE_MAT.clone(); addFade(wallOutline, 'wall', this.fadeWall);
    this.walls = new InstancedSet(wallGeo, wallMat, count(T.Wall) + ring, g, 0.035, wallOutline);
    this.wallTops = new InstancedSet(wallTopGeo, wallTopMat, count(T.Wall) + ring, g, 0.0);
    // деревянные ящики (ломаются суперами)
    const crateGeo = mergeGeometries([roundedBox(0.9, 0.8, 0.9, 0.08).translate(0, 0.4, 0)]);
    const crateMat = toon(th.crate), crateTopMat = toon(th.crateTop);
    addFade(crateMat, 'wall', this.fadeWall); addFade(crateTopMat, 'wall', this.fadeWall);
    this.crates = new InstancedSet(crateGeo, crateMat, count(T.Crate), g, 0.035, wallOutline);
    const plank = mergeGeometries([
      new THREE.BoxGeometry(0.94, 0.12, 0.12).translate(0, 0.78, 0.4), new THREE.BoxGeometry(0.94, 0.12, 0.12).translate(0, 0.78, -0.4),
      new THREE.BoxGeometry(0.12, 0.12, 0.94).translate(0.4, 0.78, 0), new THREE.BoxGeometry(0.12, 0.12, 0.94).translate(-0.4, 0.78, 0),
      new THREE.BoxGeometry(0.12, 0.7, 0.12).translate(0, 0.4, 0.42).rotateZ(0),
    ].map((x) => { x.deleteAttribute('uv'); return x; }));
    this.crateTops = new InstancedSet(plank, crateTopMat, count(T.Crate), g, 0);
    // ящики с кубами силы
    this.boxes = new InstancedSet(roundedBox(0.92, 0.85, 0.92, 0.1).translate(0, 0.425, 0), toon(0x4a4f63), count(T.Box), g, 0.035);
    this.boxCubes = new InstancedSet(roundedBox(0.4, 0.4, 0.4, 0.06).translate(0, 0.98, 0), toon(0x5ee05a, { emissive: 0x2fbf3a, ei: 0.7 }), count(T.Box), g, 0.025);
    // кусты: кучка шариков
    const bushParts: THREE.BufferGeometry[] = [];
    const bushColA = new THREE.Color(th.bushA), bushColB = new THREE.Color(th.bushB);
    for (const [x, y, z, r] of [[0, 0.5, 0, 0.45], [0.28, 0.38, 0.22, 0.32], [-0.27, 0.36, 0.2, 0.32], [0.22, 0.4, -0.25, 0.32], [-0.24, 0.42, -0.24, 0.32], [0, 0.75, 0.05, 0.3]]) {
      const s = new THREE.IcosahedronGeometry(r, 1).translate(x, y, z);
      s.deleteAttribute('uv');
      const pos = s.attributes.position, col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const c = bushColA.clone().lerp(bushColB, THREE.MathUtils.clamp((pos.getY(i) - 0.15) / 0.8, 0, 1));
        col.set([c.r, c.g, c.b], i * 3);
      }
      s.setAttribute('color', new THREE.BufferAttribute(col, 3));
      bushParts.push(s);
    }
    const bushGeo = mergeGeometries(bushParts);
    const bushMat = toon(0xffffff, { vc: true });
    addFade(bushMat, 'bush', this.fadeBush);
    const bushOutline = OUTLINE_MAT.clone(); addFade(bushOutline, 'bush', this.fadeBush);
    this.bushes = new InstancedSet(bushGeo, bushMat, count(T.Bush), g, 0.03, bushOutline);

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1);
    const waterTiles: THREE.BufferGeometry[] = [];
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const t = map.get(x, y), key = y * map.w + x;
      const p = new THREE.Vector3(x + 0.5, 0, y + 0.5);
      if (t === T.Wall) { m4.compose(p, q, s1); this.walls.add(key, m4); this.wallTops.add(key, m4); }
      if (t === T.Crate) { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.int(0, 3) * (Math.PI / 2)); m4.compose(p, q, s1); this.crates.add(key, m4); this.crateTops.add(key, m4); q.identity(); }
      if (t === T.Box) { m4.compose(p, q, s1); this.boxes.add(key, m4); this.boxCubes.add(key, m4); }
      if (t === T.Bush) {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, Math.PI * 2));
        m4.compose(p, q, new THREE.Vector3(1.05 + rng.range(0, 0.15), 0.95 + rng.range(0, 0.2), 1.05 + rng.range(0, 0.15)));
        this.bushes.add(key, m4); q.identity();
      }
      if (t === T.Water) waterTiles.push(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(x + 0.5, 0.03, y + 0.5));
    }
    // граница карты — кольцо стен
    let ringKey = 1e6;
    for (let x = -1; x <= map.w; x++) for (const y of [-1, map.h]) { m4.compose(new THREE.Vector3(x + 0.5, 0, y + 0.5), q, s1); this.walls.add(ringKey, m4); this.wallTops.add(ringKey++, m4); }
    for (let y = 0; y < map.h; y++) for (const x of [-1, map.w]) { m4.compose(new THREE.Vector3(x + 0.5, 0, y + 0.5), q, s1); this.walls.add(ringKey, m4); this.wallTops.add(ringKey++, m4); }
    for (const s of [this.walls, this.wallTops, this.crates, this.crateTops, this.boxes, this.boxCubes, this.bushes]) s.finish();
    if (waterTiles.length) {
      this.water = waterTexture().clone();
      this.water.needsUpdate = true;
      this.water.repeat.set(1, 1);
      const wg = mergeGeometries(waterTiles);
      // uv по мировым координатам, чтобы рябь шла непрерывно
      const pos = wg.attributes.position, uv = wg.attributes.uv;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2, pos.getZ(i) / 2);
      const wm = new THREE.Mesh(wg, new THREE.MeshToonMaterial({ map: this.water, color: 0xffffff }));
      g.add(wm);
    }
    this.decorate(th, rng);
    // шахта кристаллов
    for (const mn of map.mines) this.mine = this.makeMine(mn.x, mn.y);
    // ядовитое облако: зелёная дымка у земли + клубы по краю зоны
    this.poison = this.makePoison(map);
    this.puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.7, 1), toon(0x7fe04a, { transparent: true, opacity: 0.85, emissive: 0x2a8a1a, ei: 0.4 }), 160);
    this.puffs.count = 0;
    this.puffs.frustumCulled = false;
    g.add(this.puffs);
    this.version = map.version;
  }

  private makeGround(th: (typeof THEMES)['grass']) {
    const map = this.map, P = 16;
    const c = document.createElement('canvas');
    c.width = map.w * P; c.height = map.h * P;
    const g = c.getContext('2d')!;
    const rng = new Rng(7);
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      g.fillStyle = (x + y) % 2 ? th.floorA : th.floorB;
      g.fillRect(x * P, y * P, P, P);
      // мелкие травинки/камешки
      g.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 2; i++) g.fillRect(x * P + rng.int(2, 12), y * P + rng.int(2, 12), 2, 2);
    }
    // тени у основания стен и подложка под кустами/водой
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const t = map.get(x, y);
      if (t === T.Wall || t === T.Crate || t === T.Box) {
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(x * P - 3, y * P - 2, P + 6, P + 7);
      }
      if (t === T.Bush) { g.fillStyle = th.dark; g.fillRect(x * P + 1, y * P + 1, P - 2, P - 2); }
      if (t === T.Water) { g.fillStyle = '#1f6fc0'; g.fillRect(x * P - 1, y * P - 1, P + 2, P + 2); }
    }
    // базы команд
    const pad = (sp: { x: number; y: number }[], col: string) => {
      for (const s of sp) {
        g.fillStyle = col;
        g.beginPath(); g.arc(s.x * P, s.y * P, P * 0.55, 0, Math.PI * 2); g.fill();
      }
    };
    if (map.mines.length || map.redSpawns.length) {
      pad(map.blueSpawns, 'rgba(63,169,255,0.55)');
      pad(map.redSpawns, 'rgba(255,75,85,0.55)');
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(map.w, map.h).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ map: tex }));
    m.position.set(map.w / 2, 0, map.h / 2);
    return m;
  }

  private decorate(th: (typeof THEMES)['grass'], rng: Rng) {
    const map = this.map;
    const trunk = new THREE.CylinderGeometry(0.12, 0.16, 0.6, 6).translate(0, 0.3, 0);
    const crown = map.theme === 'grass' ? new THREE.IcosahedronGeometry(0.7, 0).translate(0, 1.1, 0) : new THREE.CapsuleGeometry(0.25, 0.9, 3, 8).translate(0, 0.9, 0);
    const n = 70;
    const trunks = new THREE.InstancedMesh(trunk, toon(0x7a4b26), n);
    const crowns = new THREE.InstancedMesh(crown, toon(map.theme === 'grass' ? 0x2f8f3a : 0x4f9a2e), n);
    const m4 = new THREE.Matrix4();
    let i = 0;
    while (i < n) {
      const side = rng.int(0, 3);
      const d = rng.range(2.2, 7);
      const x = side === 0 ? -d : side === 1 ? map.w + d : rng.range(-6, map.w + 6);
      const y = side === 2 ? -d : side === 3 ? map.h + d : rng.range(-6, map.h + 6);
      if (side < 2 && (y < -1 || y > map.h + 1)) continue;
      const s = rng.range(0.8, 1.4);
      m4.compose(new THREE.Vector3(x, 0, y), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.range(0, 6.28)), new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(i, m4); crowns.setMatrixAt(i, m4);
      i++;
    }
    this.group.add(trunks, crowns);
    void th;
  }

  private makeMine(x: number, y: number) {
    const g = new THREE.Group();
    g.position.set(x, 0, y);
    const rock = toon(0x5a4a6a);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.22, 8, 20).rotateX(Math.PI / 2), rock));
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a0a2e }));
    hole.position.y = 0.03;
    g.add(hole);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc77aff, transparent: true, opacity: 0.6 }));
    glow.position.y = 0.04;
    g.add(glow);
    const crystal = toon(0xb45cff, { emissive: 0x7a2ad0, ei: 0.5 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 5), crystal);
      c.position.set(Math.cos(a) * 0.9, 0.2, Math.sin(a) * 0.9);
      c.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      g.add(c);
    }
    this.group.add(g);
    return g;
  }

  private makePoison(map: GridMap) {
    const mat = new THREE.ShaderMaterial({
      uniforms: this.poisonUni,
      transparent: true,
      depthWrite: false,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec4 uRect; uniform float uTime; varying vec3 vW;
        void main(){
          vec2 p = vW.xz;
          float dx = max(uRect.x - p.x, p.x - uRect.z);
          float dy = max(uRect.y - p.y, p.y - uRect.w);
          float d = max(dx, dy);
          if (d < 0.0) discard;
          float n = sin(p.x * 1.7 + uTime * 1.3) * sin(p.y * 1.3 - uTime) * 0.5 + 0.5;
          float a = clamp(d * 0.9 + 0.35, 0.0, 0.62) * (0.8 + 0.2 * n);
          gl_FragColor = vec4(mix(vec3(0.35, 0.85, 0.2), vec3(0.55, 1.0, 0.3), n), a);
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(map.w + 30, map.h + 30).rotateX(-Math.PI / 2), mat);
    m.position.set(map.w / 2, 0.06, map.h / 2);
    m.renderOrder = 5;
    m.visible = false;
    this.group.add(m);
    return m;
  }

  /** Обновить разрушенные плитки, облако, воду. */
  update(time: number, dt: number, zone: { x0: number; y0: number; x1: number; y1: number; active: boolean } | null) {
    if (this.map.version !== this.version) {
      this.version = this.map.version;
      for (let i = 0; i < this.map.tiles.length; i++) {
        const t = this.map.tiles[i];
        if (t !== T.Crate && this.crates.index.has(i)) { this.crates.hide(i); this.crateTops.hide(i); }
        if (t !== T.Box && this.boxes.index.has(i)) { this.boxes.hide(i); this.boxCubes.hide(i); }
      }
    }
    if (this.water) this.water.offset.set(time * 0.05, time * 0.03);
    if (this.mine) this.mine.rotation.y = time * 0.3;
    // покачивание ящиков после попадания
    if (this.boxShake.size) {
      const m4 = new THREE.Matrix4();
      for (const [key, until] of this.boxShake) {
        const i = this.boxes.index.get(key);
        if (i === undefined || time > until) { this.boxShake.delete(key); if (i !== undefined) this.placeBox(key, 0); continue; }
        this.placeBox(key, Math.sin(time * 60) * 0.08 * (until - time) * 4);
      }
      void m4;
    }
    const show = !!zone && zone.active;
    this.poison.visible = show;
    if (show && zone) {
      this.poisonUni.uRect.value.set(zone.x0, zone.y0, zone.x1, zone.y1);
      this.poisonUni.uTime.value = time;
      // клубы облака по периметру безопасной зоны
      const per = 2 * (zone.x1 - zone.x0 + zone.y1 - zone.y0);
      const n = Math.min(160, Math.max(8, Math.floor(per / 1.1)));
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      for (let i = 0; i < n; i++) {
        let s = (i / n) * per;
        let x: number, y: number;
        const w = zone.x1 - zone.x0, h = zone.y1 - zone.y0;
        if (s < w) { x = zone.x0 + s; y = zone.y0; } else if ((s -= w) < h) { x = zone.x1; y = zone.y0 + s; } else if ((s -= h) < w) { x = zone.x1 - s; y = zone.y1; } else { s -= w; x = zone.x0; y = zone.y1 - s; }
        const k = 0.8 + 0.3 * Math.sin(time * 2 + i * 1.7);
        m4.compose(new THREE.Vector3(x, 0.35 + 0.15 * Math.sin(time * 1.5 + i), y), q, new THREE.Vector3(k, k * 0.8, k));
        this.puffs.setMatrixAt(i, m4);
      }
      this.puffs.count = n;
      this.puffs.instanceMatrix.needsUpdate = true;
    } else this.puffs.count = 0;
    void dt;
  }

  private placeBox(key: number, off: number) {
    const i = this.boxes.index.get(key);
    if (i === undefined) return;
    const x = key % this.map.w, y = Math.floor(key / this.map.w);
    const m4 = new THREE.Matrix4().compose(new THREE.Vector3(x + 0.5 + off, 0, y + 0.5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), off * 0.5), new THREE.Vector3(1, 1, 1));
    this.boxes.mesh.setMatrixAt(i, m4); this.boxes.mesh.instanceMatrix.needsUpdate = true;
    this.boxes.outline?.setMatrixAt(i, m4); if (this.boxes.outline) this.boxes.outline.instanceMatrix.needsUpdate = true;
    const j = this.boxCubes.index.get(key);
    if (j !== undefined) { this.boxCubes.mesh.setMatrixAt(j, m4); this.boxCubes.mesh.instanceMatrix.needsUpdate = true; this.boxCubes.outline?.setMatrixAt(j, m4); if (this.boxCubes.outline) this.boxCubes.outline.instanceMatrix.needsUpdate = true; }
  }

  shakeBox(tx: number, ty: number, time: number) {
    this.boxShake.set(ty * this.map.w + tx, time + 0.25);
  }

  /** Точки, возле которых кусты становятся прозрачными (свои в кустах), и где стены не загораживают игрока. */
  setFadePoints(bush: { x: number; y: number }[], wall: { x: number; y: number } | null) {
    const b = this.fadeBush.uFade.value;
    for (let i = 0; i < 4; i++) { const p = bush[i]; if (p) b[i].set(p.x, 0, p.y, 1); else b[i].w = 0; }
    const w = this.fadeWall.uFade.value;
    if (wall) w[0].set(wall.x, 0, wall.y, 1); else w[0].w = 0;
    for (let i = 1; i < 4; i++) w[i].w = 0;
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.geometry.dispose(); const mm = m.material as THREE.Material; if (mm !== OUTLINE_MAT) mm.dispose(); }
    });
    this.group.removeFromParent();
  }
}
