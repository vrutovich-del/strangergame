// Модель Шахтёра из примитивов Three.js: усатый крепыш в каске с фонариком, с двумя кирками.
// Смотрит в +Z, ноги на y = 0, высота ≈ 1.85. _L — левая сторона героя (+X).
import * as THREE from 'three';
import { group, matKit, mesh, roundedBox } from '../../render/kit';

export const MINER_PALETTE = {
  skin: 0xffc89a, nose: 0xf29a78, mustache: 0xa0522d, brow: 0x7a3a1a, blush: 0xff8a7a,
  sclera: 0xffffff, iris: 0x3a6ad0, pupil: 0x101020,
  shirt: 0xd94a3a, shirtDark: 0xa8302a, overalls: 0x3f74b3, overallsDark: 0x2c5488, button: 0xffd23f,
  belt: 0x6b3d22, buckle: 0xffd23f, glove: 0x8a5a32, boot: 0x6b3d22, bootSole: 0x3b2416,
  helmet: 0xffc21f, helmetDark: 0xd98a00, lamp: 0x3a3a48, lampGlass: 0xfff2a0,
  wood: 0xb07a3a, iron: 0x9aa4b4, ironDark: 0x6a7484,
};

export const MINER_JOINTS = [
  'torso', 'head', 'helmet', 'lamp', 'mustache', 'eye_L', 'eye_R', 'iris_L', 'iris_R', 'eyelid_L', 'eyelid_R', 'brow_L', 'brow_R', 'mouth',
  'arm_L', 'arm_R', 'hand_L', 'hand_R', 'pickaxe_L', 'pickaxe_R', 'leg_L', 'leg_R', 'foot_L', 'foot_R',
];

/** Кирка: ручка вдоль +Y, изогнутый железный клюв сверху. */
export function pickaxe(name: string, parent: THREE.Object3D, P: typeof MINER_PALETTE, M: ReturnType<typeof matKit>, p: [number, number, number], r: [number, number, number]) {
  const g = group(name, parent, p);
  g.rotation.set(...r);
  mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.78, 8), M(P.wood), 'pick_handle', g, [0, 0.3, 0]);
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), M(P.ironDark), 'pick_collar', g, [0, 0.66, 0]);
  const head = new THREE.TorusGeometry(0.3, 0.045, 6, 14, Math.PI * 0.8);
  head.rotateZ(Math.PI * 0.1);
  mesh(head, M(P.iron), 'pick_head', g, [0, 0.42, 0], [0, Math.PI / 2, 0]);
  for (const s of [1, -1]) mesh(new THREE.ConeGeometry(0.045, 0.14, 6), M(P.iron), 'pick_tip', g, [0, 0.45, 0.3 * s], [2.83 * s, 0, 0]);
  return g;
}

export function createMiner(o: { palette?: Partial<typeof MINER_PALETTE> } = {}) {
  const P = { ...MINER_PALETTE, ...(o.palette ?? {}) };
  const M = matKit('miner');
  const root = group('Miner');
  const torso = group('torso', root, [0, 0.38, 0]);
  // пузико: рубашка сверху, комбинезон снизу
  mesh(new THREE.SphereGeometry(0.5, 28, 18), M(P.shirt), 'belly', torso, [0, 0.4, 0], undefined, [1, 0.9, 0.86]);
  mesh(new THREE.SphereGeometry(0.515, 28, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), M(P.overalls), 'overalls', torso, [0, 0.4, 0], undefined, [1, 0.9, 0.86]);
  mesh(roundedBox(0.44, 0.3, 0.1, 0.05), M(P.overalls), 'bib', torso, [0, 0.5, 0.38], [-0.25, 0, 0]);
  for (const s of [1, -1]) {
    mesh(roundedBox(0.09, 0.5, 0.06, 0.03), M(P.overalls), 'strap', torso, [0.17 * s, 0.68, 0.18], [-0.75, 0, 0]);
    mesh(new THREE.SphereGeometry(0.045, 10, 8), M(P.button), 'button', torso, [0.16 * s, 0.6, 0.43]);
  }
  mesh(new THREE.TorusGeometry(0.47, 0.05, 8, 32).rotateX(Math.PI / 2), M(P.belt), 'belt', torso, [0, 0.27, 0], undefined, [1, 1, 0.86]);
  mesh(roundedBox(0.14, 0.11, 0.05, 0.02), M(P.buckle), 'buckle', torso, [0, 0.27, 0.42]);
  // голова
  const head = group('head', torso, [0, 0.78, 0.02]);
  mesh(new THREE.SphereGeometry(0.34, 28, 20), M(P.skin), 'head_ball', head, [0, 0.26, 0]);
  for (const s of [1, -1]) mesh(new THREE.SphereGeometry(0.08, 12, 8), M(P.skin), 'ear', head, [0.33 * s, 0.24, 0], undefined, [0.6, 1, 1]);
  mesh(new THREE.SphereGeometry(0.1, 16, 12), M(P.nose), 'nose', head, [0, 0.2, 0.34]);
  const stache = group('mustache', head, [0, 0.11, 0.3]);
  for (const s of [1, -1]) mesh(new THREE.SphereGeometry(0.13, 16, 10), M(P.mustache), 'stache', stache, [0.12 * s, 0, 0], [0, 0, 0.35 * s], [1.35, 0.55, 0.75]);
  const mouth = group('mouth', head, [0, 0.02, 0.3]);
  mesh(new THREE.SphereGeometry(0.06, 12, 8), M(0x6b1a17), 'mouth_in', mouth, [0, 0, 0], undefined, [1.2, 0.6, 0.5]);
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const eye = group('eye_' + side, head, [0.125 * s, 0.34, 0.28]);
    mesh(new THREE.SphereGeometry(0.075, 16, 12), M(P.sclera), 'sclera', eye, [0, 0, 0], undefined, [1, 1.15, 0.7]);
    const iris = group('iris_' + side, eye);
    mesh(new THREE.SphereGeometry(0.045, 12, 10), M(P.iris), 'iris', iris, [0, 0, 0.04], undefined, [1, 1.1, 0.5]);
    mesh(new THREE.SphereGeometry(0.024, 10, 8), M(P.pupil), 'pupil', iris, [0, 0, 0.058], undefined, [1, 1.1, 0.5]);
    mesh(new THREE.SphereGeometry(0.012, 6, 5), M(0xffffff, { emissive: 0xffffff, ei: 0.4 }), 'shine', iris, [0.015 * s, 0.018, 0.068]);
    iris.userData.rest = [0, 0];
    const lid = group('eyelid_' + side, eye);
    mesh(new THREE.SphereGeometry(0.082, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(P.skin), 'lid', lid, [0, 0, 0], undefined, [1, 1.15, 0.78]);
    lid.userData.restX = -0.5;
    lid.rotation.x = -0.5;
    const brow = group('brow_' + side, head, [0.13 * s, 0.45, 0.28]);
    mesh(roundedBox(0.15, 0.05, 0.05, 0.02), M(P.brow), 'brow', brow, [0, 0, 0], [0, 0, -0.15 * s]);
    mesh(new THREE.SphereGeometry(0.06, 10, 8), M(P.blush), 'blush', head, [0.22 * s, 0.17, 0.25], undefined, [1, 0.6, 0.3]);
  }
  // каска с фонариком
  const helmet = group('helmet', head, [0, 0.34, 0]);
  mesh(new THREE.SphereGeometry(0.37, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(P.helmet), 'helmet_dome', helmet, [0, 0.0, 0]);
  mesh(new THREE.CylinderGeometry(0.43, 0.45, 0.05, 32), M(P.helmetDark), 'helmet_brim', helmet, [0, 0.01, 0.03], undefined, [1, 1, 1.08]);
  mesh(new THREE.TorusGeometry(0.37, 0.035, 6, 20, Math.PI), M(P.helmetDark), 'helmet_ridge', helmet, [0, 0, 0], [0, Math.PI / 2, 0]);
  const lamp = group('lamp', helmet, [0, 0.16, 0.33]);
  lamp.rotation.x = -0.25;
  mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.1, 16).rotateX(Math.PI / 2), M(P.lamp), 'lamp_body', lamp, [0, 0, 0]);
  mesh(new THREE.CircleGeometry(0.07, 16), M(P.lampGlass, { emissive: P.lampGlass, ei: 1.1 }), 'lamp_glass', lamp, [0, 0, 0.052]);
  // руки с кирками
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const arm = group('arm_' + side, torso, [0.46 * s, 0.6, 0]);
    arm.rotation.z = 0.25 * s;
    mesh(new THREE.SphereGeometry(0.14, 14, 10), M(P.shirt), 'shoulder', arm);
    mesh(new THREE.CapsuleGeometry(0.1, 0.22, 4, 10), M(P.shirtDark), 'sleeve', arm, [0, -0.2, 0]);
    const hand = group('hand_' + side, arm, [0, -0.42, 0.02]);
    mesh(new THREE.SphereGeometry(0.13, 16, 12), M(P.glove), 'glove', hand);
    pickaxe('pickaxe_' + side, hand, P, M, [0, -0.1, 0.04], [0.45, 0, 0]);
  }
  // ножки в сапогах
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const leg = group('leg_' + side, root, [0.2 * s, 0.42, 0]);
    mesh(new THREE.CapsuleGeometry(0.11, 0.14, 4, 10), M(P.overallsDark), 'leg_mesh', leg, [0, -0.14, 0]);
    const foot = group('foot_' + side, leg, [0, -0.38, 0.03]);
    mesh(roundedBox(0.24, 0.17, 0.34, 0.07), M(P.boot), 'boot', foot, [0, 0.085, 0.04]);
    mesh(roundedBox(0.25, 0.05, 0.36, 0.02), M(P.bootSole), 'boot_sole', foot, [0, 0.02, 0.04]);
  }
  root.userData = { character: 'Miner' };
  return root;
}
