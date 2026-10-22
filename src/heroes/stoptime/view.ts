// Стоп-Тайм: модель автора (model.js — робот с экраном-лицом и часами на рюкзаке), детали скинов
// и процедурные анимации: шаг, выстрелы из пушек на руках, остановка времени, лица на экране.
import * as THREE from 'three';
import type { HeroView, Rig } from '../../render/heroView';
import { ease } from '../../render/heroView';
import { attachAt, group, matKit, mesh, roundedBox } from '../../render/kit';
import type { SkinDef } from '../skinTypes';
// @ts-ignore — модель автора на JavaScript
import { createStopTime, STOP_TIME_RIG_NAMES } from './model.js';

const flat = (v: unknown): string[] =>
  typeof v === 'string' ? (/^[\w]+$/.test(v) ? [v] : []) : Array.isArray(v) ? v.flatMap(flat) : v && typeof v === 'object' ? Object.values(v).flatMap(flat) : [];
const FINGERS = ['L', 'R'].flatMap((s) => [0, 1, 2, 3].map((i) => `finger_${s}_${i}`));
const CLOCK_HANDS = ['backpack_clock_a_hour', 'backpack_clock_a_minute', 'backpack_clock_b_hour', 'backpack_clock_b_minute', 'chest_clock_hour', 'chest_clock_minute',
  'ear_L_clock_hour', 'ear_L_clock_minute', 'ear_R_clock_hour', 'ear_R_clock_minute'];
const JOINTS = [...flat(STOP_TIME_RIG_NAMES), ...FINGERS, 'thumb_L', 'thumb_R', ...CLOCK_HANDS, 'cuckoo', 'pendulum'];
const FACES = ['angry', 'wink', 'happy', 'blink', 'surprised'] as const;
type Face = (typeof FACES)[number];
const TAU = Math.PI * 2;

const AX = new THREE.Vector3(1, 0, 0);
const QT = new THREE.Quaternion();
/** Повернуть узел в пространстве родителя: a < 0 — вперёд/вверх. */
function swing(b: THREE.Object3D | undefined, a: number) {
  if (b && a) b.quaternion.premultiply(QT.setFromAxisAngle(AX, a));
}
/** Показать одно лицо на экране (остальные сжимаем в точку — в «запечённой» модели скрыть узел нельзя). */
function setFace(r: Rig, name: Face) {
  for (const f of FACES) r.bone('face_' + f)?.scale.setScalar(f === name ? 1 : 0.0001);
}
const hide = (o: THREE.Object3D | undefined | null) => { if (o) o.scale.setScalar(0.0001); };

/** Скин «Часы с кукушкой»: над часами на рюкзаке — домик с крышей и кукушкой, снизу маятник. */
function cuckooClock(m: THREE.Object3D) {
  const M = matKit('cuckoo');
  const pack = m.getObjectByName('backpack')!;
  hide(m.getObjectByName('antenna_L')); hide(m.getObjectByName('antenna_R'));
  const wood = M(0x8a5a2b), dark = M(0x5e3a1a), leaf = M(0x3fae4a);
  const house = group('cuckoo_house');
  attachAt(m, pack, house, [0, 1.66, -0.38]);
  mesh(roundedBox(0.26, 0.2, 0.24, 0.04), wood, 'house_box', house, [0, 0.06, 0]);
  for (const s of [1, -1]) mesh(roundedBox(0.24, 0.035, 0.3, 0.015), dark, 'roof_side', house, [0.08 * s, 0.2, 0], [0, 0, -0.65 * s]);
  mesh(new THREE.SphereGeometry(0.04, 10, 8), leaf, 'roof_top', house, [0, 0.29, 0]);
  mesh(roundedBox(0.11, 0.1, 0.03, 0.02), dark, 'house_window', house, [0, 0.07, 0.12]);
  const bird = group('cuckoo', house, [0, 0.07, 0.12]);
  mesh(new THREE.SphereGeometry(0.055, 14, 10), M(0xffd23f), 'bird_body', bird, [0, 0, 0.03]);
  mesh(new THREE.ConeGeometry(0.02, 0.05, 8).rotateX(Math.PI / 2), M(0xff8a2a), 'bird_beak', bird, [0, -0.005, 0.1]);
  for (const s of [1, -1]) mesh(new THREE.SphereGeometry(0.012, 8, 6), M(0x140a24), 'bird_eye', bird, [0.025 * s, 0.02, 0.075]);
  bird.scale.setScalar(0.0001);
  const pend = group('pendulum');
  attachAt(m, pack, pend, [0, 0.66, -0.45]);
  mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6), M(0xc8860f), 'pend_rod', pend, [0, -0.15, 0]);
  mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 18).rotateX(Math.PI / 2), M(0xffc933), 'pend_disk', pend, [0, -0.32, 0]);
}

/** «Ночной»: на корпусе светятся звёздочки. */
function nightStars(m: THREE.Object3D) {
  const star = matKit('night')(0xfff3a0, { emissive: 0xffe060, ei: 1 });
  const torso = m.getObjectByName('torso')!;
  [[0.22, 1.02, 0.17], [-0.24, 0.9, 0.16], [0.2, 0.76, 0.18], [-0.18, 1.08, 0.15], [0, 0.72, 0.2]].forEach(([x, y, z]) => {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.025, 0), star);
    s.name = 'star';
    s.userData.noOutline = true;
    attachAt(m, torso, s, [x, y, z]);
  });
}

function decorate(m: THREE.Object3D, skin: SkinDef) {
  if (skin.id === 'cuckoo') cuckooClock(m);
  if (skin.id === 'night') nightStars(m);
}

const view: HeroView = {
  id: 'stoptime',
  joints: JOINTS,
  outline: [0x0d1430, 0.012],
  scale: 0.78,
  height: 1.45,
  muzzle: 'muzzle_R',
  build(skin: SkinDef) {
    const m = createStopTime({ palette: skin.palette ?? {}, outline: false });
    decorate(m, skin);
    return m;
  },
  animate(r, s) {
    const t = s.t;
    const hips = r.bone('hips'), torso = r.bone('torso'), head = r.bone('head');
    const armL = r.bone('arm_L'), armR = r.bone('arm_R'), canL = r.bone('cannon_L'), canR = r.bone('cannon_R');
    const thighL = r.bone('thigh_L'), thighR = r.bone('thigh_R'), shinL = r.bone('shin_L'), shinR = r.bone('shin_R');
    const antL = r.bone('antenna_L'), antR = r.bone('antenna_R');
    let face: Face = (t + 0.9) % 3.6 < 0.13 ? 'blink' : 'angry';
    // часы идут всегда: минутные стрелки «тикают» шагами, шестерёнки крутятся
    const tick = Math.floor(t * 2) + ease.out(Math.min(1, ((t * 2) % 1) * 6));
    let clockSpin = -tick * (TAU / 60) * 4, gearSpin = t * 0.6, open = 0, bird = 0;
    const pend = r.bone('pendulum');
    if (pend) pend.rotation.z = Math.sin(t * Math.PI * 1.2) * 0.4;

    // смерть: экран «удивляется», робот валится назад и пропадает
    if (s.dead >= 0) {
      const k = ease.out(Math.min(1, s.dead / 0.5));
      if (hips) { hips.rotation.x = -1.2 * k; hips.position.y -= 0.35 * k; }
      swing(armL, -1.2 * k); swing(armR, -1.0 * k);
      if (antL) antL.rotation.z += 0.8 * k;
      if (antR) antR.rotation.z -= 0.8 * k;
      setFace(r, 'surprised');
      for (const n of CLOCK_HANDS) r.bone(n)?.rotateZ(-s.dead * 20);
      r.body.scale.setScalar(r.scale * Math.max(0.0001, 1 - Math.max(0, s.dead - 1.0) * 3));
      return;
    }

    // шаг: ноги, покачивание таза, корпус «против» шага, антенны отстают
    const run = s.move, p = t * 10;
    swing(thighL, 0.5 * Math.sin(p) * run); swing(thighR, -0.5 * Math.sin(p) * run);
    swing(shinL, 0.6 * Math.max(0, -Math.sin(p)) * run); swing(shinR, 0.6 * Math.max(0, Math.sin(p)) * run);
    if (hips) hips.position.y += Math.abs(Math.sin(p)) * 0.04 * run + Math.sin(t * 2.4) * 0.008 * (1 - run);
    if (torso) torso.rotation.y += Math.sin(p) * 0.12 * run;
    swing(armL, -0.2 * Math.sin(p) * run); swing(armR, 0.2 * Math.sin(p) * run);
    const lag = Math.sin(t * 2.2) * 0.08;
    if (antL) { antL.rotation.z += lag; antL.rotation.x -= 0.3 * run; }
    if (antR) { antR.rotation.z -= lag; antR.rotation.x -= 0.3 * run; }

    // выстрел: правая, потом левая пушка — рука чуть вверх, ствол уходит в рукав (отдача)
    const sh = s.shot;
    if (sh >= 0 && sh < 0.6) {
      for (const [arm, can, u] of [[armR, canR, sh], [armL, canL, sh - 0.13]] as const) {
        swing(arm, -0.25 * ease.pulse(u, 0.3));
        if (can && u >= 0 && u < 0.12) can.position.y += 0.06 * (1 - u / 0.12);
      }
      if (torso) torso.rotation.x -= 0.06 * ease.pulse(sh, 0.3);
      bird = Math.max(bird, ease.pulse(sh, 0.5));
    }

    // супер: подмигивает, руки вверх, пальцы раскрыты, пушки уходят в рукава, стрелки бешено крутятся назад
    const sp = s.sup;
    if (sp >= 0 && sp < 1.3) {
      const k = Math.min(1, sp / 0.15) * (1 - ease.inOut(Math.max(0, (sp - 0.9) / 0.4)));
      face = 'wink';
      swing(armL, -2.4 * k); swing(armR, -2.4 * k);
      open = k;
      if (canL) canL.position.y += 0.18 * k;
      if (canR) canR.position.y += 0.18 * k;
      if (hips) hips.position.y += 0.15 * ease.pulse(sp, 0.5);
      clockSpin += sp * 40 * k; gearSpin += sp * 12 * k;
      bird = Math.max(bird, Math.abs(Math.sin(sp * 6)) * k);
    } else if (sp >= 1.3 && sp < 5) {
      // пока время стоит — часы на рюкзаке медленно идут назад
      clockSpin += sp * 6; gearSpin -= sp * 2;
    }

    // урон: удивлённое лицо, вздрагивает
    const hurt = ease.decay(s.hurt, 0.4);
    if (hurt) {
      face = 'surprised';
      if (torso) torso.rotation.z += Math.sin(s.hurt * 50) * 0.08 * hurt;
      if (head) head.rotation.x -= 0.15 * hurt;
    }

    if (s.win) {
      face = 'happy';
      if (hips) hips.position.y += Math.abs(Math.sin(t * 6)) * 0.18;
      swing(armL, -2.5 + Math.sin(t * 10) * 0.3); swing(armR, -2.5 + Math.sin(t * 10 + 1) * 0.3);
      open = 1; clockSpin = -t * 8; gearSpin = t * 6; bird = Math.abs(Math.sin(t * 3));
    }
    if (s.lose) {
      face = 'blink';
      if (head) head.rotation.x += 0.35;
      if (torso) torso.rotation.x += 0.2;
      clockSpin = 0; gearSpin = 0;
    }
    if (s.showcase && !s.win && !s.lose) {
      // в меню иногда подмигивает и машет рукой
      const wave = Math.max(0, Math.sin(t * 0.7)) ** 4;
      if (wave > 0.3) face = 'wink';
      swing(armL, -2.2 * wave);
      open = Math.max(open, wave);
    }

    if (open) for (const n of FINGERS) { const f = r.bone(n); if (f) f.rotation.x -= 1.9 * open; }
    r.bone('backpack_clock_a_minute')?.rotateZ(clockSpin);
    r.bone('backpack_clock_b_minute')?.rotateZ(clockSpin);
    r.bone('backpack_clock_a_hour')?.rotateZ(clockSpin / 12);
    r.bone('backpack_clock_b_hour')?.rotateZ(clockSpin / 12);
    r.bone('chest_clock_minute')?.rotateZ(clockSpin * 0.5);
    r.bone('chest_clock_hour')?.rotateZ(-t * 0.05);
    r.bone('ear_L_clock_minute')?.rotateZ(-t * 1.5);
    r.bone('ear_R_clock_minute')?.rotateZ(-t * 1.5);
    r.bone('gear_L_big')?.rotateZ(gearSpin); r.bone('gear_R_big')?.rotateZ(-gearSpin);
    r.bone('gear_L_small')?.rotateZ(-gearSpin * 1.8); r.bone('gear_R_small')?.rotateZ(gearSpin * 1.8);
    const cuckoo = r.bone('cuckoo');
    if (cuckoo) {
      const k = Math.min(1, bird * 1.6);
      cuckoo.scale.setScalar(k > 0.02 ? k : 0.0001);
      cuckoo.position.z += 0.08 * k;
    }
    if (head) head.rotation.y += Math.sin(t * 0.7) * 0.15;
    setFace(r, face);
  },
};

export default view;
