// Модель Стоп-Тайма из примитивов Three.js: живой будильник на ножках.
// Смотрит в +Z, ноги на y = 0, высота ≈ 1.9 (вместе с колокольчиками). _L — левая сторона героя (+X).
import * as THREE from 'three';
import { group, matKit, mesh, roundedBox } from '../../render/kit';

export const STOPTIME_PALETTE = {
  body: 0xffc933, rim: 0xd9901a, dial: 0xfff6dc, tick: 0x3a2a4a, hourHand: 0x2a1a3a, minHand: 0x7f6bff, pin: 0xff5a8a,
  sclera: 0xffffff, iris: 0x6a4ce0, pupil: 0x140a24, lid: 0xf3e3b8, brow: 0x3a2a4a, mouth: 0x6b1a3a, tongue: 0xff7a9a, blush: 0xff9ab0,
  bell: 0xffd84a, bellDark: 0xc8860f, limb: 0x2a1f40, glove: 0xffffff, shoe: 0x6a4ce0, shoeSole: 0x3a2a70, key: 0xc8860f,
  glow: 0x9f8cff,
};

/** Узлы, которые двигаются отдельно (их нельзя склеивать). */
export const STOPTIME_JOINTS = [
  'torso', 'face', 'eye_L', 'eye_R', 'iris_L', 'iris_R', 'eyelid_L', 'eyelid_R', 'brow_L', 'brow_R', 'mouth',
  'clock_hour', 'clock_min', 'crown', 'bell_L', 'bell_R', 'bell_hammer', 'key',
  'arm_L', 'arm_R', 'hand_L', 'hand_R', 'leg_L', 'leg_R', 'foot_L', 'foot_R',
];

export function createStopTime(o: { palette?: Partial<typeof STOPTIME_PALETTE> } = {}) {
  const P = { ...STOPTIME_PALETTE, ...(o.palette ?? {}) };
  const M = matKit('stoptime');
  const root = group('StopTime');
  const torso = group('torso', root, [0, 0.5, 0]);
  const C = 0.68; // центр циферблата над torso
  // корпус-будильник: толстый диск лицом вперёд
  mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.38, 40).rotateX(Math.PI / 2), M(P.body), 'case', torso, [0, C, 0]);
  for (const z of [0.19, -0.19]) mesh(new THREE.TorusGeometry(0.62, 0.065, 10, 44), M(P.rim), 'rim', torso, [0, C, z]);
  mesh(new THREE.CylinderGeometry(0.535, 0.535, 0.04, 40).rotateX(Math.PI / 2), M(P.dial), 'dial', torso, [0, C, 0.2]);
  // деления: 12 штук, на 12/3/6/9 — крупнее
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, big = i % 3 === 0;
    const r = 0.46;
    mesh(new THREE.BoxGeometry(big ? 0.05 : 0.03, big ? 0.11 : 0.07, 0.02), M(P.tick), 'tick', torso, [Math.sin(a) * r, C + Math.cos(a) * r, 0.225], [0, 0, -a]);
  }
  const face = group('face', torso, [0, 0, 0]);
  // глаза
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const eye = group('eye_' + side, face, [0.17 * s, C + 0.17, 0.23]);
    mesh(new THREE.SphereGeometry(0.12, 20, 14), M(P.sclera), 'sclera', eye, [0, 0, 0], undefined, [1, 1.1, 0.55]);
    const iris = group('iris_' + side, eye);
    mesh(new THREE.SphereGeometry(0.068, 16, 12), M(P.iris), 'iris', iris, [0, -0.01, 0.045], undefined, [1, 1.1, 0.45]);
    mesh(new THREE.SphereGeometry(0.038, 12, 10), M(P.pupil), 'pupil', iris, [0, -0.01, 0.068], undefined, [1, 1.1, 0.4]);
    mesh(new THREE.SphereGeometry(0.018, 8, 6), M(0xffffff, { emissive: 0xffffff, ei: 0.4 }), 'shine', iris, [0.02 * s, 0.025, 0.08]);
    iris.userData.rest = [0, 0];
    const lid = group('eyelid_' + side, eye);
    mesh(new THREE.SphereGeometry(0.128, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(P.lid), 'lid', lid, [0, 0, 0], undefined, [1, 1.1, 0.6]);
    lid.userData.restX = -0.62;
    lid.rotation.x = -0.62;
    const brow = group('brow_' + side, face, [0.17 * s, C + 0.34, 0.235]);
    mesh(roundedBox(0.15, 0.04, 0.03, 0.015), M(P.brow), 'brow', brow, [0, 0, 0], [0, 0, 0.12 * s]);
  }
  // стрелки и ось
  const hour = group('clock_hour', face, [0, C - 0.02, 0.235]);
  mesh(roundedBox(0.045, 0.2, 0.02, 0.012), M(P.hourHand), 'hour_hand', hour, [0, 0.09, 0]);
  const min = group('clock_min', face, [0, C - 0.02, 0.245]);
  mesh(roundedBox(0.03, 0.3, 0.02, 0.01), M(P.minHand, { emissive: P.minHand, ei: 0.25 }), 'min_hand', min, [0, 0.14, 0]);
  mesh(new THREE.ConeGeometry(0.035, 0.07, 4), M(P.minHand, { emissive: P.minHand, ei: 0.25 }), 'min_tip', min, [0, 0.31, 0]);
  mesh(new THREE.SphereGeometry(0.045, 12, 8), M(P.pin), 'pin', face, [0, C - 0.02, 0.255]);
  // рот: улыбка «полумесяцем»
  const mouth = group('mouth', face, [0, C - 0.27, 0.23]);
  mesh(new THREE.SphereGeometry(0.13, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M(P.mouth), 'mouth_in', mouth, [0, 0.03, 0], undefined, [1, 0.9, 0.3]);
  mesh(new THREE.SphereGeometry(0.06, 12, 8), M(P.tongue), 'tongue', mouth, [0, -0.045, 0.02], undefined, [1.2, 0.6, 0.4]);
  for (const s of [1, -1]) mesh(new THREE.SphereGeometry(0.07, 12, 8), M(P.blush), 'blush', face, [0.33 * s, C - 0.16, 0.22], undefined, [1, 0.6, 0.25]);
  // заводная головка сверху
  const crown = group('crown', torso, [0, C + 0.64, 0]);
  mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 12), M(P.rim), 'crown_stem', crown, [0, 0.02, 0]);
  mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16), M(P.bell), 'crown_knob', crown, [0, 0.1, 0]);
  mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 18), M(P.rim), 'crown_ring', crown, [0, 0.2, 0]);
  // колокольчики и молоточек
  for (const s of [1, -1]) {
    const bell = group(s > 0 ? 'bell_L' : 'bell_R', torso, [0.36 * s, C + 0.52, 0]);
    bell.rotation.z = -0.55 * s;
    mesh(new THREE.SphereGeometry(0.21, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(P.bell), 'bell_dome', bell, [0, 0.02, 0]);
    mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.04, 22), M(P.bellDark), 'bell_lip', bell, [0, 0.02, 0]);
    mesh(new THREE.SphereGeometry(0.05, 10, 8), M(P.bellDark), 'bell_knob', bell, [0, 0.24, 0]);
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 6), M(P.rim), 'bell_leg', bell, [0, -0.06, 0]);
  }
  const hammer = group('bell_hammer', torso, [0, C + 0.6, 0.02]);
  mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 6), M(P.rim), 'hammer_rod', hammer, [0, 0.1, 0]);
  mesh(new THREE.SphereGeometry(0.05, 10, 8), M(P.bellDark), 'hammer_head', hammer, [0, 0.21, 0]);
  // заводной ключик сзади
  const key = group('key', torso, [0, C, -0.2]);
  mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 8).rotateX(Math.PI / 2), M(P.key), 'key_stem', key, [0, 0, -0.07]);
  for (const s of [1, -1]) mesh(new THREE.TorusGeometry(0.075, 0.025, 8, 16), M(P.key), 'key_loop', key, [0.09 * s, 0, -0.15], [0, Math.PI / 2, 0]);
  // руки: тонкие, с белыми перчатками
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const arm = group('arm_' + side, torso, [0.6 * s, C - 0.08, 0]);
    arm.rotation.z = 0.35 * s;
    mesh(new THREE.CapsuleGeometry(0.04, 0.3, 4, 8), M(P.limb), 'arm_rod', arm, [0, -0.17, 0]);
    const hand = group('hand_' + side, arm, [0, -0.38, 0]);
    mesh(new THREE.SphereGeometry(0.105, 16, 12), M(P.glove), 'glove', hand, [0, -0.02, 0.02]);
    mesh(new THREE.TorusGeometry(0.075, 0.03, 8, 16).rotateX(Math.PI / 2), M(P.glove), 'cuff', hand, [0, 0.07, 0]);
    mesh(new THREE.SphereGeometry(0.045, 10, 8), M(P.glove), 'thumb', hand, [-0.07 * s, 0.02, 0.07]);
  }
  // ноги с большими ботинками
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const leg = group('leg_' + side, root, [0.2 * s, 0.5, 0]);
    mesh(new THREE.CapsuleGeometry(0.045, 0.34, 4, 8), M(P.limb), 'leg_rod', leg, [0, -0.2, 0]);
    const foot = group('foot_' + side, leg, [0, -0.42, 0.02]);
    mesh(new THREE.SphereGeometry(0.13, 18, 12), M(P.shoe), 'shoe', foot, [0, 0.07, 0.07], undefined, [1, 0.62, 1.45]);
    mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 16), M(P.shoeSole), 'sole', foot, [0, 0.015, 0.07], undefined, [1, 1, 1.4]);
  }
  root.userData = { character: 'StopTime' };
  return root;
}
