// Система моделей: процедурная модель или GLB → «запекание» → быстрые копии для боя и меню.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ROBOT_VIEWS } from '../bots/robotView';
import { TEAM_COLORS } from '../bots/robotModels';
import { getSkin } from '../heroes/skins';
import { addOutlines, bakeRigid, type Baked } from './bake';
import type { AnimState, HeroView, Rig } from './heroView';
import { simplifyModel } from './simplify';

const viewModules = import.meta.glob('../heroes/*/view.ts', { eager: true }) as Record<string, { default: HeroView }>;
const VIEWS = new Map<string, HeroView>();
for (const m of Object.values(viewModules)) VIEWS.set(m.default.id, m.default);
for (const v of ROBOT_VIEWS) VIEWS.set(v.id, v);

export function getView(id: string): HeroView {
  const v = VIEWS.get(id);
  if (!v) throw new Error('Нет вида для героя ' + id);
  return v;
}

export const isRobot = (heroId: string) => heroId.startsWith('robo_');

interface Proto {
  baked: Baked;
  /** Модель из GLB со своими анимациями (если есть). */
  clips?: THREE.AnimationClip[];
}
const protos = new Map<string, Proto>();
const glbProtos = new Map<string, Promise<Proto>>();

function protoKey(heroId: string, skinId: string, team: 'blue' | 'red' | 'orange') {
  return isRobot(heroId) ? `${heroId}:${team}` : `${heroId}:${skinId}`;
}

function getProto(heroId: string, skinId: string, team: 'blue' | 'red' | 'orange'): Proto {
  const key = protoKey(heroId, skinId, team);
  let p = protos.get(key);
  if (p) return p;
  const view = getView(heroId);
  const skin = getSkin(heroId, skinId);
  const src = view.build(skin, TEAM_COLORS[team]);
  simplifyModel(src);
  addOutlines(src, view.outline[0], view.outline[1]);
  const baked = bakeRigid(src, new Set(view.joints));
  src.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
  p = { baked };
  protos.set(key, p);
  return p;
}

/**
 * Загрузить модель героя из GLB (см. docs/НОВЫЙ_ГЕРОЙ.md). Модель масштабируется до роста ~1,85,
 * ставится ногами на землю, получает обводку. Если в файле есть анимации (idle, run, attack, super,
 * hit, death, win) — используются они, иначе процедурная анимация по именам узлов.
 */
export function loadGlb(heroId: string, skinId: string, url: string, forwardDeg = 0): Promise<Proto> {
  const key = `${heroId}:${skinId}`;
  let pr = glbProtos.get(key);
  if (pr) return pr;
  pr = new GLTFLoader().loadAsync(url).then((gltf) => {
    const scene = gltf.scene;
    scene.rotation.y = (forwardDeg * Math.PI) / 180;
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const k = 1.85 / Math.max(size.y, 1e-3);
    const holder = new THREE.Group();
    holder.name = heroId;
    holder.add(scene);
    scene.scale.multiplyScalar(k);
    scene.position.set(-(box.min.x + size.x / 2) * k, -box.min.y * k, -(box.min.z + size.z / 2) * k);
    // мультяшный вид: toon-материалы с теми же цветами
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const old = m.material as THREE.MeshStandardMaterial;
      const t = new THREE.MeshToonMaterial({ color: old.color, map: old.map ?? null, vertexColors: !!old.vertexColors, transparent: old.transparent, opacity: old.opacity });
      if (old.emissive) { t.emissive = old.emissive; t.emissiveIntensity = old.emissiveIntensity ?? 1; }
      t.name = old.name;
      m.material = t;
    });
    let skinned = false;
    scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true; });
    if (skinned) {
      // скелетная модель: используем как есть
      scene.traverse((o) => { o.frustumCulled = false; });
      const bones = new Map<string, THREE.Bone>();
      holder.traverse((o) => { if ((o as THREE.Bone).isBone && o.name) bones.set(o.name, o as THREE.Bone); });
      const p: Proto = { baked: { root: holder, bones, meshes: [] }, clips: gltf.animations };
      protos.set(key, p);
      return p;
    }
    addOutlines(holder);
    const view = VIEWS.get(heroId);
    const p: Proto = { baked: bakeRigid(holder, new Set(view?.joints ?? [])), clips: gltf.animations };
    protos.set(key, p);
    return p;
  });
  glbProtos.set(key, pr);
  return pr;
}

/** Заранее подготовить модели (чтобы бой не подтормаживал при появлении бойца). */
export function prewarm(list: { heroId: string; skinId: string; team: 'blue' | 'red' | 'orange' }[]) {
  for (const x of list) getProto(x.heroId, x.skinId, x.team);
}

interface MatSlot { mat: THREE.MeshToonMaterial; color: THREE.Color; emissive: THREE.Color; ei: number; tr: boolean; op: number; dw: boolean }
const GREEN = new THREE.Color(0x5cff45);
const WHITE = new THREE.Color(0xffffff);

/** Экземпляр персонажа в сцене. */
export class Character implements Rig {
  root = new THREE.Group();
  body: THREE.Object3D;
  scale: number;
  view: HeroView;
  private bones: Map<string, THREE.Object3D>;
  private rest: { o: THREE.Object3D; p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }[] = [];
  private mats: MatSlot[] = [];
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = '';
  flash = 0;
  green = 0;
  ghost = 1;

  constructor(public heroId: string, public skinId: string, public team: 'blue' | 'red' | 'orange') {
    this.view = getView(heroId);
    const proto = getProto(heroId, skinId, team);
    this.body = skeletonClone(proto.baked.root);
    this.scale = this.view.scale;
    this.body.scale.setScalar(this.scale);
    this.root.add(this.body);
    this.bones = new Map();
    this.body.traverse((o) => {
      if (((o as THREE.Bone).isBone || o.type === 'Object3D' || (o as THREE.Group).isGroup) && o.name && !this.bones.has(o.name)) this.bones.set(o.name, o);
      if ((o as THREE.Bone).isBone) this.rest.push({ o, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() });
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.frustumCulled = false;
        const mat = (m.material as THREE.Material).clone() as THREE.MeshToonMaterial;
        m.material = mat;
        if ((mat as any).isMeshToonMaterial) this.mats.push({ mat, color: mat.color.clone(), emissive: mat.emissive.clone(), ei: mat.emissiveIntensity, tr: mat.transparent, op: mat.opacity, dw: mat.depthWrite });
      }
    });
    if (proto.clips?.length) {
      this.mixer = new THREE.AnimationMixer(this.body);
      for (const c of proto.clips) this.actions.set(c.name.toLowerCase(), this.mixer.clipAction(c));
    }
  }

  bone(name: string) { return this.bones.get(name); }

  resetPose() {
    for (const r of this.rest) { r.o.position.copy(r.p); r.o.quaternion.copy(r.q); r.o.scale.copy(r.s); }
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.body.scale.setScalar(this.scale);
  }

  animate(s: AnimState) {
    if (this.mixer && this.actions.size) {
      const want = s.dead >= 0 ? 'death' : s.win ? 'win' : s.sup < 0.5 ? 'super' : s.shot < 0.3 ? 'attack' : s.hurt < 0.3 ? 'hit' : s.move > 0.1 ? 'run' : 'idle';
      const a = this.actions.get(want) ?? this.actions.get('idle');
      if (a && want !== this.current) {
        const prev = this.actions.get(this.current);
        a.reset().play();
        if (prev) a.crossFadeFrom(prev, 0.15, false);
        if (want === 'death') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
        this.current = want;
      }
      this.mixer.update(s.dt);
      return;
    }
    this.resetPose();
    this.view.animate(this, s);
  }

  /** Вспышка при уроне и зелёный цвет заражения. */
  updateMaterials(dt: number) {
    this.flash = Math.max(0, this.flash - dt * 6);
    const f = this.flash, g = this.green;
    for (const s of this.mats) {
      s.mat.color.copy(s.color);
      if (g > 0) s.mat.color.lerp(GREEN, 0.55 * g);
      s.mat.emissive.copy(s.emissive);
      s.mat.emissiveIntensity = s.ei;
      if (f > 0) { s.mat.emissive.lerp(WHITE, f); s.mat.emissiveIntensity = Math.max(s.ei, f * 0.9); }
      else if (g > 0) { s.mat.emissive.lerp(GREEN, 0.25 * g); s.mat.emissiveIntensity = Math.max(s.ei, 0.35 * g); }
    }
  }

  setOpacity(a: number) {
    if (a === this.ghost) return;
    this.ghost = a;
    for (const s of this.mats) { s.mat.transparent = a < 1 || s.tr; s.mat.opacity = s.op * a; s.mat.depthWrite = a >= 1 && s.dw; }
  }

  /** Мировая позиция кости (для точки вылета снаряда и эффектов). */
  boneWorld(name: string, out: THREE.Vector3) {
    const b = this.bones.get(name);
    if (!b) return out.copy(this.root.position).setY(0.8);
    return b.getWorldPosition(out);
  }

  dispose() {
    this.root.removeFromParent();
    for (const s of this.mats) s.mat.dispose();
  }
}

export function createCharacter(heroId: string, skinId: string, team: 'blue' | 'red' | 'orange') {
  return new Character(heroId, skinId, team);
}

export type { AnimState };
