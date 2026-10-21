// Шахтёр: модель (model.ts), детали скинов и процедурные анимации:
// тяжёлая походка, бросок кирки из-за головы, разбег и удар двумя кирками.
import * as THREE from 'three';
import { autoBlink, blink, look } from '../../render/faceKit';
import type { HeroView } from '../../render/heroView';
import { ease } from '../../render/heroView';
import { group, matKit, mesh } from '../../render/kit';
import type { SkinDef } from '../skinTypes';
import { MINER } from './config';
import { createMiner, MINER_JOINTS } from './model';

const DASH = MINER.super.dashTiles / MINER.super.dashSpeed;
const hide = (o: THREE.Object3D | undefined) => { if (o) o.scale.setScalar(0.0001); };

/** Викинг: рогатый шлем без фонарика, длинная борода косичкой и меховой плащ. */
function viking(m: THREE.Object3D) {
  const M = matKit('viking');
  const helmet = m.getObjectByName('helmet')!, head = m.getObjectByName('head')!, torso = m.getObjectByName('torso')!;
  hide(m.getObjectByName('lamp'));
  const horn = M(0xfff1d6);
  for (const s of [1, -1]) {
    const h = group('horn', helmet, [0.3 * s, 0.14, 0]);
    h.rotation.z = -0.9 * s;
    mesh(new THREE.ConeGeometry(0.08, 0.32, 10), horn, 'horn_cone', h, [0, 0.16, 0]);
    mesh(new THREE.ConeGeometry(0.05, 0.16, 8), horn, 'horn_tip', h, [0.05 * s, 0.36, 0], [0, 0, 0.6 * s]);
  }
  const beard = group('beard', head, [0, 0.04, 0.26]);
  const hair = M(0xe0702a);
  mesh(new THREE.SphereGeometry(0.2, 16, 12), hair, 'beard_top', beard, [0, -0.06, 0], undefined, [1.2, 0.8, 0.6]);
  for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.085 - i * 0.012, 10, 8), hair, 'braid', beard, [0, -0.2 - i * 0.11, 0.04], undefined, [1, 1.2, 0.9]);
  mesh(new THREE.TorusGeometry(0.05, 0.018, 6, 12), M(0xffd23f), 'braid_ring', beard, [0, -0.5, 0.04], [Math.PI / 2, 0, 0]);
  const cape = group('cape', torso, [0, 0.72, -0.28]);
  mesh(new THREE.SphereGeometry(0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), M(0x7a4a2a), 'cape_fur', cape, [0, -0.32, 0], [-0.25, 0, 0], [1.05, 1.2, 0.45]);
  mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 20, Math.PI), M(0xd8c8a8), 'cape_collar', cape, [0, 0.02, 0.12], [-Math.PI / 2 + 0.2, 0, 0]);
}

/** Кристальный: на каске и плечах растут светящиеся кристаллы. */
function crystal(m: THREE.Object3D) {
  const M = matKit('crystal');
  const helmet = m.getObjectByName('helmet')!;
  const cols = [0x5ff4ff, 0xff7bd5, 0xb08bff];
  const gem = (c: number) => M(c, { emissive: c, ei: 0.55 });
  const cluster = group('crystals', helmet, [0, 0.3, -0.05]);
  [[0, 0.06, 0, 0.11, 0], [0.13, 0.0, 0.06, 0.08, 1], [-0.13, 0.0, 0.04, 0.08, 2], [0.02, -0.02, -0.15, 0.07, 1]].forEach(([x, y, z, r, c], i) => {
    mesh(new THREE.OctahedronGeometry(r, 0), gem(cols[c]), 'crystal', cluster, [x, y + r, z], [0.2 * i, 0.4 * i, (i - 1.5) * 0.3], [0.7, 1.8, 0.7]);
  });
  for (const s of [1, -1]) {
    const arm = m.getObjectByName(s > 0 ? 'arm_L' : 'arm_R')!;
    const c = group(s > 0 ? 'crystals_L' : 'crystals_R', arm, [0.04 * s, 0.1, 0]);
    mesh(new THREE.OctahedronGeometry(0.07, 0), gem(cols[(s + 1) / 2]), 'crystal', c, [0, 0.08, 0], [0, 0, -0.4 * s], [0.7, 1.7, 0.7]);
    mesh(new THREE.OctahedronGeometry(0.05, 0), gem(cols[2]), 'crystal', c, [0.07 * s, 0.03, 0.05], [0, 0, -0.9 * s], [0.7, 1.7, 0.7]);
  }
}

function decorate(m: THREE.Object3D, skin: SkinDef) {
  if (skin.id === 'viking') viking(m);
  if (skin.id === 'crystal') crystal(m);
}

const view: HeroView = {
  id: 'miner',
  joints: [...MINER_JOINTS, 'beard', 'cape', 'crystals', 'crystals_L', 'crystals_R'],
  outline: [0x24120a, 0.014],
  scale: 0.74,
  height: 1.45,
  muzzle: 'hand_R',
  build(skin: SkinDef) {
    const m = createMiner({ palette: (skin.palette ?? {}) as any });
    decorate(m, skin);
    return m;
  },
  animate(r, s) {
    const torso = r.bone('torso')!, body = r.body, t = s.t;
    const head = r.bone('head'), helmet = r.bone('helmet'), stache = r.bone('mustache'), mouth = r.bone('mouth');
    const legL = r.bone('leg_L'), legR = r.bone('leg_R'), armL = r.bone('arm_L'), armR = r.bone('arm_R');
    const pickR = r.bone('pickaxe_R'), pickL = r.bone('pickaxe_L');
    const beard = r.bone('beard'), cape = r.bone('cape');
    const vk = r.skinId === 'viking', cr = r.skinId === 'crystal';
    let lid = autoBlink(t, 0.9);

    // смерть: валится на спину, каска улетает
    if (s.dead >= 0) {
      const k = ease.out(Math.min(1, s.dead / 0.5));
      torso.rotation.x = -1.35 * k;
      torso.position.y -= 0.18 * k;
      if (helmet) { helmet.position.y += 0.7 * Math.sin(Math.min(1, s.dead / 0.7) * Math.PI) + 0.1 * k; helmet.rotation.x -= 3 * k; }
      if (armL) armL.rotation.z += 1.2 * k;
      if (armR) armR.rotation.z -= 1.2 * k;
      body.scale.setScalar(r.scale * Math.max(0.0001, 1 - Math.max(0, s.dead - 1.0) * 3));
      blink(r, 1);
      return;
    }

    // тяжёлая походка вперевалку
    const run = s.move;
    const f = vk ? 9.5 : 8.5;
    const sw = Math.sin(t * f);
    if (legL && legR) { legL.rotation.x = sw * 0.7 * run; legR.rotation.x = -sw * 0.7 * run; }
    if (armL && armR) { armL.rotation.x = -sw * 0.5 * run; armR.rotation.x = sw * 0.5 * run; }
    body.position.y = Math.abs(sw) * 0.06 * run;
    torso.rotation.z = sw * 0.07 * run;
    torso.rotation.x = run * (vk ? 0.2 : 0.12);
    // дыхание и покачивание кирок
    torso.scale.y = 1 + Math.sin(t * 2.2) * 0.015;
    if (pickR) pickR.rotation.z += Math.sin(t * 2.2) * 0.05;
    if (pickL) pickL.rotation.z -= Math.sin(t * 2.2 + 1) * 0.05;
    if (beard) beard.rotation.x = Math.sin(t * f) * 0.12 * run + Math.sin(t * 1.7) * 0.05;
    if (cape) cape.rotation.x = -0.2 * run - Math.abs(sw) * 0.1 * run;

    // атака: кирка из-за головы — замах назад, бросок вперёд; кирка улетает и «вырастает» снова
    const sh = s.shot;
    if (sh >= 0 && sh < 0.8) {
      const u = sh / 0.34;
      let a = 0;
      if (u < 0.45) a = 2.5 * ease.out(u / 0.45);
      else if (u < 1) a = 2.5 - 3.6 * ease.inOut((u - 0.45) / 0.55);
      else a = -1.1 * (1 - ease.out(Math.min(1, (sh - 0.34) / 0.3)));
      if (armR) armR.rotation.x += a;
      torso.rotation.y += -0.3 * ease.pulse(sh, 0.4);
      torso.rotation.x -= 0.12 * ease.pulse(sh, 0.25) - 0.15 * ease.pulse(sh - 0.2, 0.3);
      if (pickR) {
        const back = sh < 0.16 ? 1 : sh < 0.5 ? 0.0001 : ease.out(Math.min(1, (sh - 0.5) / 0.2));
        pickR.scale.setScalar(Math.max(0.0001, back));
      }
      if (mouth) mouth.scale.y = 1 + 0.8 * ease.pulse(sh, 0.4);
    }

    // супер: разбег с поднятыми кирками, потом удар двумя кирками в землю
    const sp = s.sup;
    if (sp >= 0 && sp < DASH + 0.6) {
      if (sp < DASH) {
        const k = Math.min(1, sp / 0.1);
        torso.rotation.x += 0.45 * k;
        if (armL) armL.rotation.x += 2.6 * k;
        if (armR) armR.rotation.x += 2.6 * k;
        const fast = Math.sin(t * 18);
        if (legL && legR) { legL.rotation.x = fast * 0.9; legR.rotation.x = -fast * 0.9; }
        body.position.y = Math.abs(fast) * 0.08 + (vk ? 0.5 * Math.sin((sp / DASH) * Math.PI) : 0);
        if (mouth) mouth.scale.set(1.3, 1.6, 1);
        lid = -0.3;
      } else {
        const v = sp - DASH;
        const hit = ease.inOut(Math.min(1, v / 0.12));
        const rel = 1 - ease.inOut(Math.max(0, (v - 0.3) / 0.3));
        if (armL) armL.rotation.x += (2.6 - 4.1 * hit) * rel;
        if (armR) armR.rotation.x += (2.6 - 4.1 * hit) * rel;
        torso.rotation.x += (0.45 + 0.25 * hit) * rel;
        body.position.y -= 0.1 * ease.decay(v - 0.1, 0.25);
        torso.scale.set(1 + 0.1 * ease.decay(v - 0.1, 0.25), 1 - 0.12 * ease.decay(v - 0.1, 0.25), 1);
      }
    }

    // урон: вздрагивает, усы топорщатся
    const hurt = ease.decay(s.hurt, 0.4);
    if (hurt) {
      lid = -0.4 * hurt;
      torso.rotation.x -= 0.18 * hurt;
      torso.rotation.z += Math.sin(s.hurt * 45) * 0.07 * hurt;
      if (stache) stache.scale.set(1 + 0.25 * hurt, 1 + 0.4 * hurt, 1);
      for (const n of ['brow_L', 'brow_R']) { const b = r.bone(n); if (b) b.position.y += 0.04 * hurt; }
    }

    // победа: поднимает кирку над головой и подпрыгивает
    if (s.win) {
      body.position.y = Math.abs(Math.sin(t * 5)) * 0.25;
      if (armR) armR.rotation.x -= 2.7 + Math.sin(t * 10) * 0.2;
      if (armL) armL.rotation.z += 0.8 + Math.sin(t * 5) * 0.3;
      if (mouth) mouth.scale.set(1.3, 1.6, 1);
      if (stache) stache.rotation.z = Math.sin(t * 12) * 0.08;
    }
    if (s.lose) {
      if (head) head.rotation.x = 0.4;
      torso.rotation.x = 0.25;
      if (armL) armL.rotation.z -= 0.15;
      if (armR) armR.rotation.z += 0.15;
      lid = 0.55;
    }
    if (s.showcase && !s.win && !s.lose) {
      if (vk) {
        // викинг иногда издаёт боевой клич
        const cry = Math.max(0, Math.sin(t * 0.8 - 1)) ** 6;
        if (armL) armL.rotation.x -= 2.4 * cry;
        if (armR) armR.rotation.x -= 2.4 * cry;
        if (mouth) mouth.scale.set(1 + 0.4 * cry, 1 + 1.2 * cry, 1);
        torso.rotation.x -= 0.15 * cry;
      } else {
        // крутит ус
        const tw = Math.max(0, Math.sin(t * 0.9)) ** 6;
        if (armL) { armL.rotation.x -= 1.9 * tw; armL.rotation.z += 0.6 * tw; }
        if (stache) stache.rotation.z = Math.sin(t * 14) * 0.1 * tw;
      }
    }
    // кристаллы мерцают
    if (cr) {
      for (const c of ['crystals', 'crystals_L', 'crystals_R']) { const b = r.bone(c); if (b) b.scale.setScalar(1 + Math.sin(t * 4) * 0.06 + (sp >= 0 && sp < 1 ? 0.25 * ease.pulse(sp, 1) : 0)); }
    }
    if (head) head.rotation.y = Math.sin(t * 0.7) * 0.12;
    blink(r, lid);
    look(r, Math.sin(t * 0.6) * 0.3, hurt * 0.5);
  },
};

export default view;
