// Бактерия: модель автора (model.js), украшения скинов и процедурные анимации.
import * as THREE from 'three';
import { autoBlink, blink, look } from '../../render/faceKit';
import type { HeroView } from '../../render/heroView';
import { ease } from '../../render/heroView';
import { attachAt, group, matKit, mesh, toon } from '../../render/kit';
import { animateSport, isSport, SPORT_JOINTS, sportGear, type SportFit } from '../../render/sport';
import type { SkinDef } from '../skinTypes';
// @ts-ignore — модель автора на JavaScript
import { createPurpleGerm, PURPLE_GERM_RIG_NAMES } from './model.js';

const RIG = PURPLE_GERM_RIG_NAMES as Record<string, string | string[]>;
const CILIA: string[][] = [];
for (let i = 0; i < 30; i++) {
  const id = String(i).padStart(2, '0');
  CILIA.push([0, 1, 2].map((k) => `cilia_${id}_s${k}`));
}
/** Щупальца скина «Медуза»: 8 штук по 3 звена. */
const TENTACLES = 8;
const TENT: string[][] = [];
for (let i = 0; i < TENTACLES; i++) TENT.push([0, 1, 2].map((k) => `tent_${i}_s${k}`));
const JOINTS = [
  ...Object.entries(RIG).filter(([k]) => k !== 'ciliaPattern').flatMap(([, v]) => v),
  ...CILIA.flat(), 'crown', 'ghost_tail', 'jelly_dome', ...TENT.flat(),
];
const RAINBOW = [0xff4b55, 0xff9b3f, 0xffd23f, 0x5ee05a, 0x3fa9ff, 0xb05cff];
/** Тело-капля Бактерии (в координатах модели): центр и радиусы. */
const BODY = { y: 0.9, rx: 0.58, ry: 0.74, rz: 0.51 };
const hide = (o: THREE.Object3D | undefined | null) => { if (o) o.scale.setScalar(0.0001); };

/** Призрак: вместо ножек — волнистый «подол», бактерия парит над землёй. */
function ghost(m: THREE.Object3D, skin: SkinDef) {
  const M = matKit('ghost');
  const torso = m.getObjectByName('torso')!;
  hide(m.getObjectByName('leg_L')); hide(m.getObjectByName('leg_R'));
  const col = skin.palette?.skin ?? 0xe8e4ff;
  const tail = group('ghost_tail', m);
  attachAt(m, torso, tail, [0, 0.5, 0]);
  const skirt = mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.45, 28, 1, true), M(col, { side: THREE.DoubleSide }), 'ghost_skirt', tail, [0, -0.2, 0]);
  skirt.userData.outlineScale = 0.6;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    mesh(new THREE.SphereGeometry(0.14, 12, 8), M(col), 'ghost_lobe', tail, [Math.sin(a) * 0.53, -0.43, Math.cos(a) * 0.53], undefined, [1, 0.8, 1]);
  }
}

/** Медуза: прозрачный купол-колокол с бахромой и щупальца вместо ножек. */
function jelly(m: THREE.Object3D) {
  const M = matKit('jelly');
  const torso = m.getObjectByName('torso')!;
  hide(m.getObjectByName('leg_L')); hide(m.getObjectByName('leg_R')); hide(m.getObjectByName('goggles'));
  const dome = group('jelly_dome', m);
  attachAt(m, torso, dome, [0, 1.28, 0]);
  const glass = toon(0xff9ad8, { transparent: true, opacity: 0.5, name: 'jelly_glass' });
  glass.depthWrite = false;
  const d = mesh(new THREE.SphereGeometry(0.74, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass, 'jelly_bell', dome, [0, 0, 0], undefined, [1, 0.75, 1]);
  d.renderOrder = 2;
  d.userData.noOutline = true;
  mesh(new THREE.TorusGeometry(0.74, 0.045, 8, 44).rotateX(Math.PI / 2), M(0xff7bd5), 'jelly_rim', dome);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    mesh(new THREE.SphereGeometry(0.065, 10, 8), M(0xffb8e8), 'jelly_frill', dome, [Math.sin(a) * 0.76, -0.04, Math.cos(a) * 0.76]);
  }
  [[0.25, 0.3, 0.2], [-0.3, 0.25, 0.1], [0.05, 0.42, -0.2], [-0.1, 0.35, 0.35], [0.35, 0.2, -0.3]].forEach(([x, y, z], i) => {
    const c = i % 2 ? 0x7fd8ff : 0xfff3a0;
    const sp = mesh(new THREE.SphereGeometry(0.05, 10, 8), M(c, { emissive: c, ei: 1 }), 'jelly_glow', dome, [x, y, z]);
    sp.userData.noOutline = true;
  });
  // щупальца: по 3 звена, висят по кругу под телом
  const tcol = [M(0xff9ad8), M(0xc8a8ff)];
  for (let i = 0; i < TENTACLES; i++) {
    const a = (i / TENTACLES) * Math.PI * 2 + 0.2;
    let parent: THREE.Object3D = group(TENT[i][0], m);
    attachAt(m, torso, parent, [Math.sin(a) * 0.3, 0.32, Math.cos(a) * 0.27], [Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25]);
    for (let k = 0; k < 3; k++) {
      const rad = 0.055 - k * 0.012;
      mesh(new THREE.CapsuleGeometry(rad, 0.12, 4, 8), tcol[i % 2], 'tentacle', parent, [0, -0.09, 0]);
      if (k < 2) parent = group(TENT[i][k + 1], parent, [0, -0.17, 0]);
    }
  }
}

/** Спортивная форма: повязка вместо очков, баскетбольный мяч крутится на макушке, номер и бита — на рюкзаке. */
const SPORT: SportFit = {
  // макушка у капли полнее, чем у эллипсоида BODY: этот эллипсоид облегает верх головы
  head: { node: 'torso', c: [0, 1.0, 0], r: [0.64, 0.69, 0.56] },
  band: 0.7,
  cap: { cut: 0.3 },
  ball: { basketball: { node: 'torso', p: [0, BODY.y + BODY.ry + 0.32, 0] }, football: { node: 'root', p: [0.5, 0.2, 0.62] } },
  ballR: 0.2,
  bat: { node: 'torso', p: [-0.34, 0.6, -0.56], r: [0, 0, -0.75], len: 0.95 },
  number: { node: 'torso', p: [0, 0.95, -0.53], r: [0, Math.PI, 0], h: 0.2, plate: 0.5 },
  hide: { basketball: ['goggles'], baseball: ['goggles'] },
};

function decorate(m: THREE.Object3D, skin: SkinDef) {
  if (isSport(skin.id) && skin.kit) {
    sportGear(m, skin.id, SPORT, skin.kit);
    // под кепкой жгутиков на макушке не видно
    if (skin.id === 'baseball') {
      m.updateMatrixWorld(true);
      const p = new THREE.Vector3();
      m.traverse((o) => { if (/^cilia_\d\d$/.test(o.name) && o.getWorldPosition(p).y > 1.3) hide(o); });
    }
  }
  const torso = m.getObjectByName('torso')!;
  if (skin.id === 'ghost') ghost(m, skin);
  if (skin.id === 'jelly') jelly(m);
  if (skin.id === 'king') {
    const crown = group('crown', torso, [0, 1.47, -0.02]);
    const gold = toon(0xffc933, { name: 'germ_crown_gold' });
    mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.16, 20, 1, true), gold, 'crown_band', crown).material.side = THREE.DoubleSide;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mesh(new THREE.ConeGeometry(0.07, 0.2, 6), gold, 'crown_spike', crown, [Math.sin(a) * 0.27, 0.17, Math.cos(a) * 0.27]);
      mesh(new THREE.SphereGeometry(0.035, 8, 6), toon(i % 2 ? 0xff3f6a : 0x3fd8ff, { emissive: i % 2 ? 0x801030 : 0x106080, ei: 0.6, name: 'germ_crown_gem' + (i % 2) }), 'crown_gem', crown, [Math.sin(a) * 0.3, 0.02, Math.cos(a) * 0.3]);
    }
    crown.rotation.x = -0.12;
  }
  if (skin.id === 'rainbow') {
    const mats = RAINBOW.map((c, i) => toon(c, { name: 'germ_rainbow_' + i }));
    m.traverse((o) => {
      const mm = /^cilia_(\d\d)/.exec(o.name);
      if (mm && (o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = mats[Number(mm[1]) % mats.length];
    });
  }
}

const view: HeroView = {
  id: 'bacteria',
  joints: [...JOINTS, ...SPORT_JOINTS],
  outline: [0x14071c, 0.013],
  scale: 0.74,
  height: 1.5,
  muzzle: 'weapon_muzzle',
  face: { center: [0, 0.98, 0.2], half: 0.66 },
  build(skin: SkinDef) {
    const m = createPurpleGerm({ palette: skin.palette ?? {}, outline: false });
    decorate(m, skin);
    return m;
  },
  animate(r, s) {
    animateSport(r, s);
    const torso = r.bone('torso')!, body = r.body, t = s.t;
    const legL = r.bone('leg_L'), legR = r.bone('leg_R');
    const gh = r.skinId === 'ghost', jl = r.skinId === 'jelly', floats = gh || jl;
    // жгутики шевелятся всегда
    const wig = s.move > 0.1 ? 0.3 : 0.15;
    const sp = s.move > 0.1 ? 11 : 6;
    for (let i = 0; i < CILIA.length; i++) {
      const segs = CILIA[i];
      for (let k = 0; k < 3; k++) { const b = r.bone(segs[k]); if (b) b.rotation.z += wig * Math.sin(t * sp + i + k * 0.9); }
    }
    // призрак при выбивании улетает вверх и тает
    if (gh && s.dead >= 0) {
      body.position.y = 0.25 + s.dead * 1.6;
      torso.scale.setScalar(Math.max(0.0001, 1 - s.dead * 0.9));
      torso.rotation.z = Math.sin(s.dead * 12) * 0.2;
      blink(r, 1);
      return;
    }
    // смерть: лопается
    if (s.dead >= 0) {
      const k = s.dead < 0.18 ? 1 + (s.dead / 0.18) * 0.45 : Math.max(0.0001, 1.45 * (1 - (s.dead - 0.18) / 0.08));
      torso.scale.setScalar(k);
      blink(r, 1);
      return;
    }
    // пульсация и перекатывание
    const pulse = Math.sin(t * 4) * 0.025;
    const run = s.move;
    torso.scale.set(1 + pulse, 1 - pulse, 1 + pulse);
    body.position.y = Math.abs(Math.sin(t * 9)) * 0.08 * run;
    torso.rotation.z = Math.sin(t * 9) * 0.13 * run;
    torso.rotation.x = run * 0.12;
    if (floats) {
      // парит над землёй: без прыжков, плавно покачивается
      const speed = jl ? 2.6 + run * 2.5 : 2.2;
      const p = (Math.sin(t * speed) + 1) / 2;
      body.position.y = (gh ? 0.24 : 0.3) + p * (gh ? 0.12 : 0.08);
      torso.rotation.z = Math.sin(t * 1.7) * 0.06;
      torso.rotation.x = run * (gh ? 0.2 : 0.1);
      const tail = r.bone('ghost_tail');
      if (tail) { tail.rotation.x = -0.4 * run + Math.sin(t * 3) * 0.08; tail.rotation.z = Math.sin(t * 2.6) * 0.1; tail.scale.y = 1 + Math.sin(t * 4) * 0.06; }
      const dome = r.bone('jelly_dome');
      if (dome) {
        // купол «дышит» — так медуза плывёт
        const sw = jl ? 1 - p : 0;
        dome.scale.set(1 + 0.08 * sw, 1 - 0.14 * sw, 1 + 0.08 * sw);
        for (let i = 0; i < TENT.length; i++) {
          for (let k = 0; k < 3; k++) {
            const b = r.bone(TENT[i][k]);
            if (!b) continue;
            b.rotation.x += Math.sin(t * 4 - k * 0.9 + i) * (0.18 + 0.08 * k) - (k === 0 ? 0.45 * run : 0.2 * run);
            b.rotation.z += Math.cos(t * 3.2 - k * 0.8 + i * 1.3) * 0.14;
          }
        }
      }
    }
    if (legL && legR) { legL.rotation.x = Math.sin(t * 9) * 0.6 * run; legR.rotation.x = -Math.sin(t * 9) * 0.6 * run; }
    // атака: «чихает» роем
    const shot = s.shot;
    if (shot >= 0 && shot < 0.4) {
      if (shot < 0.1) { const k = shot / 0.1; torso.rotation.x -= 0.22 * k; torso.scale.multiplyScalar(1 + 0.06 * k); }
      else { const k = 1 - (shot - 0.1) / 0.3; torso.rotation.x += 0.2 * k; torso.scale.y *= 1 - 0.12 * k; }
      const w = r.bone('weapon');
      if (w) w.translateX(-0.1 * ease.decay(shot, 0.3));
      const mouth = r.bone('mouth');
      if (mouth) mouth.scale.set(1 + 0.2 * ease.pulse(shot, 0.35), 1 + 0.5 * ease.pulse(shot, 0.35), 1);
    }
    // супер: раздувается и выстреливает, очки на глаза
    const sup = ease.pulse(s.sup, 0.55);
    if (sup) {
      torso.scale.multiplyScalar(1 + 0.32 * sup);
      if (gh) body.position.y += 0.35 * sup;
      const g = r.bone('goggles');
      if (g) g.rotation.x = 0.68 * Math.min(1, sup * 2);
    }
    // урон
    const hurt = ease.decay(s.hurt, 0.4);
    let lid = autoBlink(t, 1.1);
    if (hurt) {
      lid = -0.35 * hurt;
      torso.rotation.x -= 0.18 * hurt;
      torso.rotation.z += Math.sin(s.hurt * 45) * 0.08 * hurt;
    }
    blink(r, lid);
    look(r, Math.sin(t * 0.6 + 1) * 0.35, Math.cos(t * 0.45) * 0.15 + hurt * 0.5);
    if (s.win) {
      // радостно делится: растягивается в стороны и обратно
      const k = Math.sin(t * 5);
      torso.scale.set(1 + 0.35 * Math.max(0, k), 1 - 0.2 * Math.max(0, k), 1);
      body.position.y = Math.abs(Math.sin(t * 5)) * 0.25;
      const g = r.bone('goggles');
      if (g) g.rotation.x = 0;
    }
    if (s.lose) { torso.rotation.x = 0.3; torso.scale.y *= 0.9; blink(r, 0.6); }
    if (s.showcase && !s.win && !s.lose) {
      const w = r.bone('weapon');
      if (w) w.rotation.z += Math.sin(t * 1.3) * 0.08;
    }
  },
};

export default view;
