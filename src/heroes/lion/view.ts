// Лев: модель автора (model.js) и процедурные анимации на четырёх лапах:
// рысь, удары когтями, прыжок с градом ударов, рык, победа и поражение.
import * as THREE from 'three';
import { autoBlink, blink, look } from '../../render/faceKit';
import type { HeroView, Rig } from '../../render/heroView';
import { ease } from '../../render/heroView';
import { attachAt, group, matKit, mesh, roundedBox } from '../../render/kit';
import type { SkinDef } from '../skinTypes';
import { LION } from './config';
// @ts-ignore — модель автора на JavaScript
import { createLion, LION_RIG_NAMES } from './model.js';

const flat = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(flat) : v && typeof v === 'object' ? Object.values(v).flatMap(flat) : [];
const JOINTS = [...flat(LION_RIG_NAMES), 'feather_1', 'feather_2', 'feather_3', 'bead_braid', 'shoulder_pad_L', 'shoulder_pad_R', 'kneepad_L', 'wing_L', 'wing_R', 'plume', 'knight_cape'];
const MANE = ['mane_top', 'mane_side', 'mane_beard', 'mane_ruff', 'cheek_fur'];
const TAIL = ['tail_0', 'tail_1', 'tail_2', 'tail_3', 'tail_4', 'tail_5'];

const AX = new THREE.Vector3(1, 0, 0);
const QT = new THREE.Quaternion();
/** Качнуть ногу в пространстве родителя: a > 0 — назад, a < 0 — вперёд. */
function swing(b: THREE.Object3D | undefined, a: number) {
  if (b && a) b.quaternion.premultiply(QT.setFromAxisAngle(AX, a));
}
const sm = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** Взмах лапой: замах вперёд-вверх, удар вниз, возврат (u = 0…1). */
function swipeCurve(u: number) {
  if (u <= 0 || u >= 1) return 0;
  if (u < 0.35) return -1.3 * sm(u / 0.35);
  if (u < 0.7) return -1.3 + 1.8 * sm((u - 0.35) / 0.35);
  return 0.5 * (1 - sm((u - 0.7) / 0.3));
}

/** Шаг ноги в рыси: качание + подъём, пока нога идёт вперёд. */
function stepLeg(r: Rig, upper: string, lower: string, phase: number, amp: number) {
  const b = r.bone(upper);
  swing(b, 0.45 * Math.sin(phase) * amp);
  const lift = Math.max(0, -Math.cos(phase)) * amp;
  if (b) b.position.y += 0.07 * lift;
  r.bone(lower)?.rotateX(0.6 * lift);
}

const S = LION.super;
const FLURRY = S.hits * S.hitEvery;

/** Крыло дракона: косточка и перепонка с «фестонами». s = 1 — левое (+X), −1 — правое. */
function wing(M: ReturnType<typeof matKit>, s: number) {
  const g = group(s > 0 ? 'wing_L' : 'wing_R');
  const pts: [number, number][] = [[0, 0], [0.62, 0.42], [0.82, 0.08], [0.62, -0.08], [0.48, -0.02], [0.32, -0.14], [0.18, -0.04], [0.04, -0.1]];
  const shape = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? shape.lineTo(x * s, y) : shape.moveTo(x * s, y)));
  const mem = mesh(new THREE.ShapeGeometry(shape), M(0x8a2a5a, { side: THREE.DoubleSide }), 'wing_membrane', g);
  mem.userData.noOutline = true;
  const bone = M(0x3a1f30);
  const rod = (x0: number, y0: number, x1: number, y1: number, r: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    mesh(new THREE.CapsuleGeometry(r, len, 3, 6), bone, 'wing_bone', g, [((x0 + x1) / 2) * s, (y0 + y1) / 2, 0.01], [0, 0, Math.atan2(y1 - y0, (x1 - x0) * s) - Math.PI / 2]);
  };
  rod(0, 0, 0.62, 0.42, 0.035);
  rod(0.62, 0.42, 0.82, 0.08, 0.022);
  rod(0.62, 0.42, 0.48, -0.02, 0.02);
  rod(0.62, 0.42, 0.18, -0.04, 0.02);
  mesh(new THREE.ConeGeometry(0.035, 0.12, 6), M(0xffd23f), 'wing_claw', g, [0.64 * s, 0.5, 0.01]);
  return g;
}

/** Лев-Дракон: крылья, рога и шипы по спине и хвосту. */
function dragon(m: THREE.Object3D) {
  const M = matKit('dragon');
  const spine = m.getObjectByName('spine')!, head = m.getObjectByName('head')!;
  for (const s of [1, -1]) attachAt(m, spine, wing(M, s), [0.26 * s, 1.34, -0.08], [0, -0.35 * s, 0]);
  const horn = M(0xfff1d6);
  for (const s of [1, -1]) {
    const h = group('horn', m);
    attachAt(m, head, h, [0.15 * s, 1.56, 0.56], [-0.75, 0, -0.25 * s]);
    mesh(new THREE.ConeGeometry(0.06, 0.32, 10), horn, 'horn_cone', h, [0, 0.14, 0]);
  }
  const spike = M(0x2a9a7a);
  const addSpike = (bone: string, p: [number, number, number], size: number) => {
    const b = m.getObjectByName(bone);
    if (!b) return;
    const c = new THREE.Mesh(new THREE.ConeGeometry(size * 0.45, size, 6), spike);
    c.name = 'dragon_spike';
    attachAt(m, b, c, p, [-0.5, 0, 0]);
  };
  addSpike('spine', [0, 1.42, -0.2], 0.16);
  addSpike('spine', [0, 1.38, -0.45], 0.14);
  addSpike('body', [0, 1.3, -0.72], 0.12);
  for (let i = 1; i <= 4; i++) {
    const b = m.getObjectByName('tail_' + i);
    if (!b) continue;
    const p = b.getWorldPosition(new THREE.Vector3());
    addSpike('tail_' + i, [p.x, p.y + 0.1, p.z], 0.11 - i * 0.012);
  }
}

/** Лев-Рыцарь: шлем с пером, нагрудник, наплечники, щит и плащ. */
function knight(m: THREE.Object3D) {
  const M = matKit('knight');
  const head = m.getObjectByName('head')!, spine = m.getObjectByName('spine')!;
  const steel = M(0xd8dce6), gold = M(0xffc933), red = M(0xe8323e);
  const helm = group('knight_helm', m);
  attachAt(m, head, helm, [0, 1.5, 0.6]);
  mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), steel, 'helm_dome', helm, [0, 0, 0], undefined, [1, 0.85, 1.12]);
  mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 32).rotateX(Math.PI / 2), gold, 'helm_rim', helm, [0, 0.01, 0], undefined, [1, 1, 1.12]);
  const plume = group('plume', helm, [0, 0.24, 0]);
  for (let i = 0; i < 5; i++) mesh(new THREE.SphereGeometry(0.09 - i * 0.006, 10, 8), red, 'plume_puff', plume, [0, 0.05 + Math.sin(i * 0.6) * 0.05, 0.12 - i * 0.1], undefined, [0.7, 1.1, 1.3]);
  // нагрудник
  const plate = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 12, 0, Math.PI, Math.PI * 0.28, Math.PI * 0.44), steel);
  plate.name = 'knight_plate';
  plate.scale.set(1, 1.05, 0.9);
  attachAt(m, spine, plate, [0, 0.95, 0.22]);
  mesh(roundedBox(0.08, 0.3, 0.04, 0.02), gold, 'plate_cross', plate, [0, 0, 0.45]);
  mesh(roundedBox(0.22, 0.07, 0.04, 0.02), gold, 'plate_cross', plate, [0, 0.06, 0.45]);
  for (const s of [1, -1]) {
    const arm = m.getObjectByName(s > 0 ? 'arm_L' : 'arm_R');
    if (!arm) continue;
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel);
    pad.name = 'knight_pauldron';
    attachAt(m, arm, pad, [0.36 * s, 1.07, 0.32], [0, 0, -0.5 * s]);
  }
  // щит на левом боку
  const shield = group('knight_shield', m);
  attachAt(m, spine, shield, [0.46, 0.92, -0.15], [0, Math.PI / 2, 0]);
  mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24).rotateX(Math.PI / 2), M(0x3a5a9a), 'shield_face', shield);
  mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 28), gold, 'shield_rim', shield);
  mesh(new THREE.OctahedronGeometry(0.11, 0), gold, 'shield_gem', shield, [0, 0, 0.04], undefined, [1, 1.3, 0.4]);
  // плащ от шеи по спине
  const cape = group('knight_cape', m);
  attachAt(m, spine, cape, [0, 1.42, 0.18], [-0.22, 0, 0]);
  mesh(roundedBox(0.66, 0.035, 0.95, 0.015), red, 'cape_cloth', cape, [0, 0, -0.47]);
}

function decorate(m: THREE.Object3D, skin: SkinDef) {
  if (skin.id === 'dragon') dragon(m);
  if (skin.id === 'knight') knight(m);
}

const view: HeroView = {
  id: 'lion',
  joints: JOINTS,
  outline: [0x2a1006, 0.014],
  scale: 0.68,
  height: 1.4,
  muzzle: 'paw_R',
  build(skin: SkinDef) {
    const m = createLion({ palette: skin.palette ?? {}, outline: false });
    decorate(m, skin);
    return m;
  },
  animate(r, s) {
    const root = r.body, t = s.t;
    const body = r.bone('body'), spine = r.bone('spine'), neck = r.bone('neck'), jaw = r.bone('jaw');
    const armL = r.bone('arm_L'), armR = r.bone('arm_R'), thighL = r.bone('thigh_L'), thighR = r.bone('thigh_R');
    const clawsL = r.bone('claws_L'), clawsR = r.bone('claws_R');
    let jawOpen = 0.3, bristle = 0, tailSway = Math.sin(t * 2.2) * 0.1, tailCurl = 0, lid = autoBlink(t, 0.7);
    // крылья дракона: сложены в покое, машут на бегу и в прыжке; плащ и перо рыцаря развеваются
    const wingL = r.bone('wing_L'), wingR = r.bone('wing_R'), cape = r.bone('knight_cape'), plume = r.bone('plume');
    let flap = 0.25 + Math.sin(t * 1.6) * 0.06, spread = 0;

    // смерть: заваливается на бок, потом исчезает
    if (s.dead >= 0) {
      const k = ease.out(Math.min(1, s.dead / 0.55));
      root.rotation.z = -1.35 * k;
      root.position.x = -0.42 * k;
      root.position.y = 0.16 * k;
      swing(armL, -0.4 * k); swing(armR, -0.2 * k); swing(thighL, 0.35 * k); swing(thighR, 0.2 * k);
      if (jaw) jaw.rotation.x = 0.3 + 0.3 * k;
      for (let i = 0; i < TAIL.length; i++) { const b = r.bone(TAIL[i]); if (b) b.rotation.x -= 0.12 * k; }
      root.scale.setScalar(r.scale * Math.max(0.0001, 1 - Math.max(0, s.dead - 1.0) * 3.5));
      blink(r, 1);
      return;
    }

    // рысь на четырёх лапах (диагональные пары) или спокойное дыхание
    const run = s.move;
    const p = t * 10.5;
    if (run > 0.02) {
      stepLeg(r, 'arm_L', 'forearm_L', p, run);
      stepLeg(r, 'thigh_R', 'foot_R', p, run);
      stepLeg(r, 'arm_R', 'forearm_R', p + Math.PI, run);
      stepLeg(r, 'thigh_L', 'foot_L', p + Math.PI, run);
      if (body) body.position.y += 0.045 * Math.sin(2 * p) * run;
      if (spine) spine.rotation.x += 0.06 * Math.sin(2 * p) * run;
      if (neck) neck.rotation.x -= 0.05 * Math.sin(2 * p) * run;
      tailSway += Math.sin(p) * 0.22 * run;
      tailCurl += 0.18 * run;
      flap += Math.sin(t * 11) * 0.55 * run; spread = Math.max(spread, 0.5 * run);
      if (cape) cape.rotation.x += 0.25 * run + Math.sin(t * 13) * 0.07 * run;
      if (plume) plume.rotation.x += Math.sin(p) * 0.15 * run - 0.2 * run;
      if (r.skinId === 'knight' && neck) neck.rotation.x -= 0.1 * run;
      for (let i = 0; i < 3; i++) { const c = r.bone('loincloth_' + i); if (c) c.rotation.x += Math.sin(2 * p + i) * 0.25 * run; }
    } else if (body) {
      body.position.y += Math.sin(t * 2.4) * 0.012;
      if (spine) spine.scale.y = 1 + Math.sin(t * 2.4) * 0.012;
    }

    // атака: удар правой, потом левой лапой
    const sh = s.shot;
    if (sh >= 0 && sh < 0.6) {
      const uR = sh / 0.3, uL = (sh - LION.claw.gap) / 0.3;
      swing(armR, swipeCurve(uR));
      swing(armL, swipeCurve(uL));
      if (clawsR && uR > 0 && uR < 1) clawsR.scale.setScalar(1.35);
      if (clawsL && uL > 0 && uL < 1) clawsL.scale.setScalar(1.35);
      const pulse = ease.pulse(sh, 0.5);
      if (body) body.rotation.x -= 0.18 * pulse;
      swing(thighL, 0.18 * pulse); swing(thighR, 0.18 * pulse);
      if (spine) spine.rotation.x += -0.15 * ease.pulse(sh, 0.2) + 0.1 * ease.pulse(sh - 0.15, 0.25);
      if (neck) neck.rotation.x += 0.14 * ease.pulse(sh - 0.08, 0.3);
      jawOpen = 0.3 + 0.35 * pulse;
    }

    // супер: прыжок по дуге, приземление и град ударов на задних лапах
    const sp = s.sup;
    if (sp >= 0 && sp < S.leapTime) {
      const u = sp / S.leapTime;
      flap = 0.3 + Math.sin(u * Math.PI * 3) * 0.9; spread = 1;
      root.position.y += 1.15 * 4 * u * (1 - u);
      if (body) body.rotation.x += -0.35 + 0.65 * sm(u);
      swing(armL, -1.1); swing(armR, -1.1);
      swing(thighL, 0.9); swing(thighR, 0.9);
      clawsL?.scale.setScalar(1.35); clawsR?.scale.setScalar(1.35);
      jawOpen = 0.75; bristle = 0.1; tailCurl += 0.3;
    } else if (sp >= S.leapTime && sp < S.leapTime + FLURRY + 0.25) {
      const v = sp - S.leapTime;
      const k = Math.min(1, v / 0.12) * (1 - sm((v - FLURRY) / 0.25));
      if (body) {
        body.position.y -= 0.12 * ease.decay(v, 0.15);
        body.rotation.x -= 0.55 * k;
      }
      swing(thighL, 0.55 * k); swing(thighR, 0.55 * k);
      if (v < FLURRY) {
        const i = Math.floor(v / S.hitEvery), u = (v - i * S.hitEvery) / S.hitEvery;
        const right = i % 2 === 0;
        swing(right ? armR : armL, (-1.6 + 2.0 * sm(u / 0.6)) * k);
        swing(right ? armL : armR, -1.2 * sm(u) * k);
        clawsL?.scale.setScalar(1.35); clawsR?.scale.setScalar(1.35);
        const bite = i % 3 === 2 ? ease.pulse(u, 1) : 0;
        jawOpen = 0.45 + 0.3 * bite;
        if (neck) neck.rotation.x += 0.25 * bite;
      }
      bristle = 0.1 * k;
      tailCurl += 0.35 * k;
      tailSway += Math.sin(t * 14) * 0.2 * k;
    }

    // урон: вздрагивает, глаза шире, уши прижаты
    const hurt = ease.decay(s.hurt, 0.35);
    if (hurt > 0) {
      lid = -0.35 * hurt;
      if (neck) neck.rotation.x -= 0.2 * hurt;
      root.rotation.z += Math.sin(s.hurt * 50) * 0.06 * hurt;
      for (const n of ['ear_L', 'ear_R']) { const e = r.bone(n); if (e) e.rotation.x -= 0.4 * hurt; }
    }

    // победа: встаёт на задние лапы и рычит
    if (s.win) {
      if (body) body.rotation.x -= 0.6 + 0.05 * Math.sin(t * 3);
      swing(thighL, 0.6); swing(thighR, 0.6);
      swing(armL, -1.0 + 0.5 * Math.sin(t * 6)); swing(armR, -1.0 + 0.5 * Math.sin(t * 6 + Math.PI));
      const roar = Math.max(0, Math.sin(t * 1.6)) ** 2;
      jawOpen = 0.35 + 0.45 * roar; bristle = 0.12 * roar; lid = 0.25 * roar;
      tailCurl += 0.4; tailSway += Math.sin(t * 9) * 0.25;
      flap = Math.sin(t * 6) * 0.8; spread = 1;
    }
    if (s.lose) {
      if (neck) neck.rotation.x += 0.4;
      if (body) body.position.y -= 0.12;
      jawOpen = 0.05; lid = 0.55; tailCurl -= 0.3;
      for (const n of ['ear_L', 'ear_R']) { const e = r.bone(n); if (e) e.rotation.x -= 0.5; }
    }
    if (s.showcase && !s.win && !s.lose) {
      // в меню иногда грозно рычит
      const roar = Math.max(0, Math.sin(t * 1.2 - 1)) ** 8;
      jawOpen += 0.45 * roar; bristle = Math.max(bristle, 0.1 * roar);
      if (neck) neck.rotation.x -= 0.12 * roar;
    }

    for (const [w, sd] of [[wingL, 1], [wingR, -1]] as const) {
      if (!w) continue;
      w.rotation.z += flap * sd;
      w.rotation.y += 0.55 * spread * sd;
    }
    if (plume) plume.rotation.z += Math.sin(t * 2) * 0.05;
    // лицо, грива, хвост, перья
    if (jaw) jaw.rotation.x = jawOpen;
    if (bristle) for (const n of MANE) r.bone(n)?.scale.multiplyScalar(1 + bristle);
    for (let i = 0; i < TAIL.length; i++) {
      const b = r.bone(TAIL[i]);
      if (!b) continue;
      b.rotation.z += Math.sin(t * 2.2 - i * 0.5) * 0.04 + tailSway * (0.3 + i * 0.12);
      b.rotation.x += tailCurl * 0.25;
    }
    for (let i = 1; i <= 3; i++) { const f = r.bone('feather_' + i); if (f) f.rotation.z += Math.sin(t * 3 + i) * 0.08 * (1 + run); }
    const twitch = Math.max(0, Math.sin(t * 0.9)) ** 30;
    r.bone('ear_L')?.rotateZ(0.3 * twitch);
    blink(r, lid);
    look(r, Math.sin(t * 0.6) * 0.25, hurt * 0.4);
  },
};

export default view;
