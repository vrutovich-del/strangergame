// Лев: модель автора (model.js) и процедурные анимации на четырёх лапах:
// рысь, удары когтями, прыжок с градом ударов, рык, победа и поражение.
import * as THREE from 'three';
import { autoBlink, blink, look } from '../../render/faceKit';
import type { HeroView, Rig } from '../../render/heroView';
import { ease } from '../../render/heroView';
import type { SkinDef } from '../skinTypes';
import { LION } from './config';
// @ts-ignore — модель автора на JavaScript
import { createLion, LION_RIG_NAMES } from './model.js';

const flat = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(flat) : v && typeof v === 'object' ? Object.values(v).flatMap(flat) : [];
const JOINTS = [...flat(LION_RIG_NAMES), 'feather_1', 'feather_2', 'feather_3', 'bead_braid', 'shoulder_pad_L', 'shoulder_pad_R', 'kneepad_L'];
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

const view: HeroView = {
  id: 'lion',
  joints: JOINTS,
  outline: [0x2a1006, 0.014],
  scale: 0.68,
  height: 1.4,
  muzzle: 'paw_R',
  build(skin: SkinDef) {
    return createLion({ palette: skin.palette ?? {}, outline: false });
  },
  animate(r, s) {
    const root = r.body, t = s.t;
    const body = r.bone('body'), spine = r.bone('spine'), neck = r.bone('neck'), jaw = r.bone('jaw');
    const armL = r.bone('arm_L'), armR = r.bone('arm_R'), thighL = r.bone('thigh_L'), thighR = r.bone('thigh_R');
    const clawsL = r.bone('claws_L'), clawsR = r.bone('claws_R');
    let jawOpen = 0.3, bristle = 0, tailSway = Math.sin(t * 2.2) * 0.1, tailCurl = 0, lid = autoBlink(t, 0.7);

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
