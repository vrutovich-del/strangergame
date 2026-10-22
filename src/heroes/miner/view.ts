// Шахтёр: модель автора (model.js — крокодил-шахтёр в каске с фонариком), детали скинов и процедурные
// анимации: походка с хвостом, бросок кирки из-за плеча, разбег с ударами кирками и удар двумя кирками.
import * as THREE from 'three';
import type { HeroView } from '../../render/heroView';
import { ease } from '../../render/heroView';
import { attachAt, group, matKit, mesh } from '../../render/kit';
import type { SkinDef } from '../skinTypes';
import { MINER } from './config';
// @ts-ignore — модель автора на JavaScript
import { createMiner, MINER_RIG_NAMES } from './model.js';

const flat = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(flat) : v && typeof v === 'object' ? Object.values(v).flatMap(flat) : [];
const TAIL = ['tail_0', 'tail_1', 'tail_2', 'tail_3', 'tail_4', 'tail_5'];
const JOINTS = [...flat(MINER_RIG_NAMES), 'pickaxe_L_tip', 'pickaxe_R_tip', 'cape', 'crystals', 'crystals_L', 'crystals_R'];
const DASH = MINER.super.dashTiles / MINER.super.dashSpeed;

const AX = new THREE.Vector3(1, 0, 0);
const QT = new THREE.Quaternion();
/** Повернуть узел в пространстве родителя: a < 0 — вперёд/вверх. */
function swing(b: THREE.Object3D | undefined, a: number) {
  if (b && a) b.quaternion.premultiply(QT.setFromAxisAngle(AX, a));
}
const hide = (o: THREE.Object3D | undefined | null) => { if (o) o.scale.setScalar(0.0001); };

/** Викинг: рога на каске вместо фонарика и меховой плащ. */
function viking(m: THREE.Object3D) {
  const M = matKit('viking');
  const helmet = m.getObjectByName('helmet')!, torso = m.getObjectByName('torso')!;
  hide(m.getObjectByName('headlamp'));
  const horn = M(0xfff1d6);
  for (const s of [1, -1]) {
    const h = group('horn');
    attachAt(m, helmet, h, [0.27 * s, 1.74, 0.02], [0, 0, -0.9 * s]);
    mesh(new THREE.ConeGeometry(0.075, 0.3, 10), horn, 'horn_cone', h, [0, 0.14, 0]);
    mesh(new THREE.ConeGeometry(0.045, 0.14, 8), horn, 'horn_tip', h, [0.04 * s, 0.33, 0], [0, 0, 0.6 * s]);
  }
  const cape = group('cape');
  attachAt(m, torso, cape, [0, 1.42, -0.24]);
  mesh(new THREE.SphereGeometry(0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), M(0x7a4a2a), 'cape_fur', cape, [0, -0.32, 0], [-0.2, 0, 0], [1.1, 1.25, 0.45]);
  mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 20, Math.PI), M(0xd8c8a8), 'cape_collar', cape, [0, 0.02, 0.12], [-Math.PI / 2 + 0.2, 0, 0]);
}

/** Кристальный: на каске и плечах растут светящиеся кристаллы. */
function crystal(m: THREE.Object3D) {
  const M = matKit('crystal');
  const cols = [0x5ff4ff, 0xff7bd5, 0xb08bff];
  const gem = (c: number) => M(c, { emissive: c, ei: 0.55 });
  const helmet = m.getObjectByName('helmet')!;
  const cluster = group('crystals');
  attachAt(m, helmet, cluster, [0, 1.86, -0.08]);
  [[0, 0.04, 0, 0.1, 0], [0.12, 0, 0.05, 0.075, 1], [-0.12, 0, 0.03, 0.075, 2], [0.02, -0.02, -0.13, 0.065, 1]].forEach(([x, y, z, r, c], i) => {
    mesh(new THREE.OctahedronGeometry(r, 0), gem(cols[c]), 'crystal', cluster, [x, y + r, z], [0.2 * i, 0.4 * i, (i - 1.5) * 0.3], [0.7, 1.8, 0.7]);
  });
  for (const s of [1, -1]) {
    const arm = m.getObjectByName(s > 0 ? 'arm_L' : 'arm_R')!;
    const c = group(s > 0 ? 'crystals_L' : 'crystals_R');
    attachAt(m, arm, c, [0.42 * s, 1.38, -0.02]);
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
  joints: JOINTS,
  outline: [0x13200b, 0.013],
  scale: 0.74,
  height: 1.5,
  muzzle: 'hand_R',
  build(skin: SkinDef) {
    const m = createMiner({ palette: skin.palette ?? {}, outline: false });
    decorate(m, skin);
    return m;
  },
  animate(r, s) {
    const t = s.t;
    const hips = r.bone('hips'), torso = r.bone('torso'), head = r.bone('head'), jaw = r.bone('jaw');
    const helmet = r.bone('helmet'), lamp = r.bone('headlamp'), goggles = r.bone('goggles');
    const armL = r.bone('arm_L'), armR = r.bone('arm_R'), pickR = r.bone('pickaxe_R'), pickL = r.bone('pickaxe_L');
    const thighL = r.bone('thigh_L'), thighR = r.bone('thigh_R'), shinL = r.bone('shin_L'), shinR = r.bone('shin_R');
    const cape = r.bone('cape');
    const vk = r.skinId === 'viking', cr = r.skinId === 'crystal';
    let jawOpen = 0.28 + Math.sin(t * 2.2) * 0.03, tailSway = Math.sin(t * 1.8) * 0.12, tailLift = 0;

    // смерть: валится на спину, каска слетает, хвост обвисает
    if (s.dead >= 0) {
      const k = ease.out(Math.min(1, s.dead / 0.5));
      if (hips) { hips.rotation.x = -1.3 * k; hips.position.y -= 0.4 * k; }
      if (helmet) { helmet.position.y += 0.5 * Math.sin(Math.min(1, s.dead / 0.7) * Math.PI) + 0.1 * k; helmet.rotation.x -= 2.5 * k; }
      swing(armL, -1.0 * k); swing(armR, -1.2 * k);
      if (jaw) jaw.rotation.x = 0.28 + 0.35 * k;
      for (const n of TAIL) { const b = r.bone(n); if (b) b.rotation.x -= 0.1 * k; }
      r.body.scale.setScalar(r.scale * Math.max(0.0001, 1 - Math.max(0, s.dead - 1.0) * 3));
      return;
    }

    // походка: ноги, покачивание таза, хвост виляет
    const run = s.move, p = t * (vk ? 10 : 9);
    swing(thighL, 0.5 * Math.sin(p) * run); swing(thighR, -0.5 * Math.sin(p) * run);
    swing(shinL, 0.6 * Math.max(0, -Math.sin(p)) * run); swing(shinR, 0.6 * Math.max(0, Math.sin(p)) * run);
    if (hips) { hips.position.y += Math.abs(Math.sin(p)) * 0.04 * run; hips.rotation.z += Math.sin(p) * 0.05 * run; }
    if (torso) { torso.rotation.y -= Math.sin(p) * 0.12 * run; torso.rotation.x += (vk ? 0.18 : 0.1) * run; }
    swing(armL, -0.3 * Math.sin(p) * run); swing(armR, 0.3 * Math.sin(p) * run);
    tailSway += Math.sin(p) * 0.25 * run;
    if (cape) cape.rotation.x -= 0.25 * run + Math.abs(Math.sin(p)) * 0.08 * run;
    // кирки слегка постукивают в покое
    if (pickR) pickR.rotation.x += Math.max(0, Math.sin(t * 2.4)) ** 6 * 0.15 * (1 - run);
    if (pickL) pickL.rotation.x += Math.max(0, Math.sin(t * 2.4 + 2)) ** 6 * 0.15 * (1 - run);

    // атака: замах правой из-за плеча и бросок; кирка улетает и через ~0,6 с снова в руке
    const sh = s.shot;
    if (sh >= 0 && sh < 0.85) {
      const u = sh / 0.34;
      let a = 0;
      if (u < 0.45) a = 1.0 * ease.out(u / 0.45);
      else if (u < 1) a = 1.0 - 3.2 * ease.inOut((u - 0.45) / 0.55);
      else a = -2.2 * (1 - ease.out(Math.min(1, (sh - 0.34) / 0.3)));
      swing(armR, a);
      if (torso) torso.rotation.y += sh < 0.16 ? -0.4 * ease.out(sh / 0.16) : -0.4 + 0.7 * ease.out(Math.min(1, (sh - 0.16) / 0.2)) - 0.3 * ease.out(Math.max(0, Math.min(1, (sh - 0.4) / 0.3)));
      if (pickR) pickR.scale.setScalar(sh < 0.2 ? 1 : sh < 0.6 ? 0.0001 : Math.max(0.0001, ease.out(Math.min(1, (sh - 0.6) / 0.2))));
      jawOpen = 0.28 + 0.25 * ease.pulse(sh, 0.4);
    }

    // супер: разбег, наклон вперёд, удары кирками по очереди, в конце — удар двумя кирками
    const sp = s.sup;
    if (sp >= 0 && sp < DASH + 0.6) {
      if (sp < DASH) {
        const k = Math.min(1, sp / 0.1);
        if (torso) torso.rotation.x += 0.35 * k;
        const fast = Math.sin(t * 18);
        swing(thighL, 0.9 * fast * k); swing(thighR, -0.9 * fast * k);
        if (hips) hips.position.y += Math.abs(fast) * 0.05 + (vk ? 0.45 * Math.sin((sp / DASH) * Math.PI) : 0);
        const ph = (sp / 0.25) % 1, left = Math.floor(sp / 0.25) % 2 === 1;
        const chop = ph < 0.5 ? -2.4 * ease.out(ph / 0.5) : -2.4 + 3.0 * ease.inOut((ph - 0.5) / 0.5);
        swing(left ? armL : armR, chop * k);
        swing(left ? armR : armL, -0.8 * k);
        jawOpen = 0.6; tailLift = 0.2;
      } else {
        const v = sp - DASH;
        const hit = ease.inOut(Math.min(1, v / 0.12));
        const rel = 1 - ease.inOut(Math.max(0, (v - 0.3) / 0.3));
        swing(armL, (-2.6 + 3.4 * hit) * rel); swing(armR, (-2.6 + 3.4 * hit) * rel);
        if (torso) torso.rotation.x += (0.35 + 0.25 * hit) * rel;
        if (hips) hips.position.y -= 0.08 * ease.decay(v - 0.1, 0.25);
        jawOpen = 0.6 * rel + 0.28 * (1 - rel);
      }
    }

    // урон: вздрагивает, пасть приоткрывается
    const hurt = ease.decay(s.hurt, 0.4);
    if (hurt) {
      if (torso) { torso.rotation.x -= 0.15 * hurt; torso.rotation.z += Math.sin(s.hurt * 45) * 0.07 * hurt; }
      jawOpen = Math.max(jawOpen, 0.28 + 0.25 * hurt);
    }

    // победа: кирка над головой, рёв, хвост ходуном
    if (s.win) {
      if (hips) hips.position.y += Math.abs(Math.sin(t * 5)) * 0.16;
      swing(armR, -2.6 + Math.sin(t * 10) * 0.2); swing(armL, -1.2 + Math.sin(t * 5) * 0.3);
      jawOpen = 0.3 + 0.3 * Math.max(0, Math.sin(t * 2)) ** 2;
      tailSway += Math.sin(t * 9) * 0.3; tailLift = 0.25;
      if (goggles) goggles.rotation.x -= 0.6;
    }
    if (s.lose) {
      if (head) head.rotation.x += 0.35;
      if (torso) torso.rotation.x += 0.2;
      jawOpen = 0.05; tailLift = -0.2;
    }
    if (s.showcase && !s.win && !s.lose) {
      const pose = Math.max(0, Math.sin(t * 0.8 - 1)) ** 6;
      if (vk) {
        // викинг иногда издаёт боевой клич
        swing(armL, -2.4 * pose); swing(armR, -2.4 * pose);
        jawOpen = Math.max(jawOpen, 0.28 + 0.35 * pose);
      } else {
        // поднимает очки на каску и осматривается
        if (goggles) goggles.rotation.x -= 0.6 * pose;
        if (head) head.rotation.y += Math.sin(t * 2) * 0.25 * pose;
      }
    }

    if (jaw) jaw.rotation.x = jawOpen;
    for (let i = 0; i < TAIL.length; i++) {
      const b = r.bone(TAIL[i]);
      if (!b) continue;
      b.rotation.z += Math.sin(t * 1.8 - i * 0.5) * 0.04 + tailSway * (0.2 + i * 0.08);
      b.rotation.x += tailLift * 0.15;
    }
    // фонарик мерцает, кристаллы светятся
    if (lamp && !vk) lamp.scale.setScalar(1 + Math.sin(t * 13) * 0.02 + (Math.sin(t * 0.7) > 0.98 ? -0.06 : 0));
    if (cr) for (const n of ['crystals', 'crystals_L', 'crystals_R']) r.bone(n)?.scale.setScalar(1 + Math.sin(t * 4) * 0.06 + (sp >= 0 && sp < 1 ? 0.25 * ease.pulse(sp, 1) : 0));
    if (head) head.rotation.y += Math.sin(t * 0.7) * 0.1;
  },
};

export default view;
