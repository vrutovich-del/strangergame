// Модели роботов из примитивов Three.js. Милые и законченные, с цветом команды.
import * as THREE from 'three';
import { group, mesh, roundedBox, toon } from '../render/kit';

export const TEAM_COLORS = { blue: 0x3fa9ff, red: 0xff4b55, orange: 0xff9b3f };

function eyesFace(head: THREE.Object3D, z: number, y: number, eyeColor: number, wide = 0.11, gap = 0.13) {
  const screen = toon(0x10162a, { name: 'robot_screen' });
  mesh(roundedBox(0.52, 0.3, 0.06, 0.06), screen, 'screen', head, [0, y, z]);
  const eyeMat = toon(eyeColor, { emissive: eyeColor, ei: 1.1, name: 'robot_eye' });
  for (const s of [1, -1]) {
    const e = group(`eye_${s > 0 ? 'L' : 'R'}`, head, [gap * s, y + 0.01, z + 0.035]);
    mesh(roundedBox(wide, wide * 1.15, 0.03, 0.03), eyeMat, 'eye_glow', e);
  }
}

/** Робот: blaster | tank | sniper | dummy. Смотрит в +Z, ноги на y = 0, высота ≈ 1.8. */
export function createRobot(kind: string, teamColor: number): THREE.Group {
  const team = toon(teamColor, { name: 'robot_team' });
  const dark = toon(0x2b3245, { name: 'robot_dark' });
  const metal = toon(0xc8d0de, { name: 'robot_metal' });
  const accent = toon(0xffd23f, { name: 'robot_accent' });
  const eyeColor = 0x9ff4ff;
  const root = group('Robot');
  const torso = group('torso', root, [0, 0.55, 0]);
  const legs: THREE.Group[] = [];
  const head = group('head', torso);
  const arms: THREE.Group[] = [];

  const makeLeg = (x: number, len: number, w: number) => {
    const leg = group(`leg_${x > 0 ? 'L' : 'R'}`, root, [x, 0.55, 0]);
    mesh(new THREE.CapsuleGeometry(w * 0.45, len * 0.6, 4, 10), metal, 'leg_mesh', leg, [0, -len / 2, 0]);
    const foot = group(`foot_${x > 0 ? 'L' : 'R'}`, leg, [0, -len, 0.04]);
    mesh(roundedBox(w * 1.5, 0.16, w * 2.1, 0.07), dark, 'foot_mesh', foot, [0, 0.03, 0.05]);
    legs.push(leg);
  };
  const makeArm = (x: number, y: number, len: number, w: number, fist: number) => {
    const arm = group(`arm_${x > 0 ? 'L' : 'R'}`, torso, [x, y, 0]);
    mesh(new THREE.SphereGeometry(w * 0.85, 14, 10), team, 'shoulder', arm);
    mesh(new THREE.CapsuleGeometry(w * 0.45, len * 0.7, 4, 10), metal, 'arm_mesh', arm, [0, -len / 2, 0]);
    const hand = group(`hand_${x > 0 ? 'L' : 'R'}`, arm, [0, -len, 0]);
    if (fist > 0) mesh(new THREE.SphereGeometry(fist, 16, 12), dark, 'fist', hand);
    arms.push(arm);
    return { arm, hand };
  };

  if (kind === 'tank') {
    makeLeg(0.3, 0.5, 0.26); makeLeg(-0.3, 0.5, 0.26);
    mesh(roundedBox(1.25, 0.95, 0.95, 0.22), team, 'body', torso, [0, 0.48, 0]);
    mesh(roundedBox(0.9, 0.35, 0.1, 0.08), dark, 'belly_plate', torso, [0, 0.32, 0.48]);
    for (const s of [1, -1]) mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10).rotateX(Math.PI / 2), accent, 'bolt', torso, [0.3 * s, 0.32, 0.54]);
    head.position.set(0, 0.98, 0.05);
    mesh(roundedBox(0.7, 0.42, 0.62, 0.14), team, 'head_mesh', head, [0, 0.16, 0]);
    eyesFace(head, 0.3, 0.17, eyeColor, 0.13, 0.15);
    for (const s of [1, -1]) {
      mesh(roundedBox(0.4, 0.22, 0.6, 0.1), dark, 'pad', torso, [0.68 * s, 0.86, 0], [0, 0, -0.25 * s]);
      const { hand } = makeArm(0.72 * s, 0.72, 0.42, 0.22, 0.27);
      mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 16).rotateX(Math.PI / 2), accent, 'knuckle', hand, [0, 0.12, 0]);
    }
  } else if (kind === 'sniper') {
    makeLeg(0.17, 0.62, 0.17); makeLeg(-0.17, 0.62, 0.17);
    torso.position.y = 0.62;
    mesh(new THREE.CapsuleGeometry(0.34, 0.42, 6, 16), team, 'body', torso, [0, 0.42, 0]);
    mesh(new THREE.TorusGeometry(0.35, 0.05, 8, 20).rotateX(Math.PI / 2), dark, 'belt', torso, [0, 0.25, 0]);
    head.position.set(0, 0.95, 0);
    mesh(new THREE.SphereGeometry(0.3, 20, 14), team, 'head_mesh', head, [0, 0.12, 0]);
    // большой глаз-объектив
    mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.14, 18).rotateX(Math.PI / 2), dark, 'lens_body', head, [0, 0.14, 0.25]);
    const eye = group('eye_L', head, [0, 0.14, 0.33]);
    mesh(new THREE.CircleGeometry(0.11, 18), toon(eyeColor, { emissive: eyeColor, ei: 1.2, name: 'robot_eye' }), 'eye_glow', eye);
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), metal, 'antenna', head, [0.16, 0.45, -0.05]);
    mesh(new THREE.SphereGeometry(0.06, 10, 8), accent, 'antenna_tip', head, [0.16, 0.6, -0.05]);
    for (const s of [1, -1]) makeArm(0.42 * s, 0.6, 0.38, 0.15, 0.12);
    // длинная винтовка в правой руке
    const gun = group('weapon', torso, [-0.3, 0.42, 0.35]);
    mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.2, 10).rotateX(Math.PI / 2), dark, 'barrel', gun, [0, 0, 0.3]);
    mesh(roundedBox(0.16, 0.2, 0.42, 0.05), team, 'stock', gun, [0, -0.03, -0.18]);
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10).rotateX(Math.PI / 2), metal, 'scope', gun, [0, 0.14, 0.05]);
    mesh(new THREE.SphereGeometry(0.05, 8, 6), toon(0xff4b55, { emissive: 0xff4b55, ei: 1, name: 'robot_laser' }), 'muzzle', gun, [0, 0, 0.92]);
  } else if (kind === 'dummy') {
    // мишень на пружине
    mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.18, 20), dark, 'base', root, [0, 0.09, 0]);
    const spring = new THREE.TorusGeometry(0.16, 0.035, 6, 14).rotateX(Math.PI / 2);
    for (let i = 0; i < 4; i++) mesh(spring, metal, 'spring', root, [0, 0.24 + i * 0.09, 0]);
    torso.position.y = 0.55;
    mesh(roundedBox(0.95, 0.95, 0.4, 0.2), team, 'body', torso, [0, 0.45, 0]);
    const ring = (r: number, c: number, z: number) => mesh(new THREE.CircleGeometry(r, 24), toon(c, { name: 'target_' + c.toString(16) }), 'target', torso, [0, 0.45, z]);
    ring(0.36, 0xffffff, 0.205); ring(0.26, 0xff4b55, 0.21); ring(0.16, 0xffffff, 0.215); ring(0.07, 0xff4b55, 0.22);
    head.position.set(0, 0.95, 0);
    mesh(roundedBox(0.56, 0.36, 0.4, 0.12), team, 'head_mesh', head, [0, 0.14, 0]);
    eyesFace(head, 0.2, 0.15, 0xffe066, 0.09, 0.11);
    for (const s of [1, -1]) makeArm(0.55 * s, 0.75, 0.3, 0.13, 0.13);
  } else {
    // бластер
    makeLeg(0.22, 0.55, 0.2); makeLeg(-0.22, 0.55, 0.2);
    mesh(roundedBox(0.92, 0.8, 0.72, 0.24), team, 'body', torso, [0, 0.42, 0]);
    mesh(new THREE.CircleGeometry(0.13, 18), toon(0xffd23f, { emissive: 0xffaa00, ei: 0.6, name: 'robot_core' }), 'core', torso, [0, 0.4, 0.37]);
    head.position.set(0, 0.86, 0);
    mesh(roundedBox(0.68, 0.48, 0.58, 0.18), team, 'head_mesh', head, [0, 0.18, 0]);
    eyesFace(head, 0.28, 0.19, eyeColor);
    const ant = group('antenna', head, [0, 0.42, 0]);
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.24, 6), metal, 'antenna_rod', ant, [0, 0.12, 0]);
    mesh(new THREE.SphereGeometry(0.08, 12, 8), accent, 'antenna_ball', ant, [0, 0.27, 0]);
    makeArm(0.56, 0.62, 0.32, 0.17, 0.15);
    // правая рука — пушка
    const { arm } = makeArm(-0.56, 0.62, 0.22, 0.17, 0.0);
    const gun = group('weapon', arm, [0, -0.3, 0.1]);
    mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.5, 14).rotateX(Math.PI / 2), dark, 'cannon', gun, [0, 0, 0.12]);
    mesh(new THREE.TorusGeometry(0.13, 0.04, 8, 16), team, 'cannon_ring', gun, [0, 0, 0.36]);
    mesh(new THREE.CircleGeometry(0.09, 14), toon(0x9ff4ff, { emissive: 0x6fe8ff, ei: 1.3, name: 'robot_eye' }), 'cannon_glow', gun, [0, 0, 0.38]);
  }
  root.userData = { character: 'Robot', kind };
  return root;
}

export const ROBOT_JOINTS = ['torso', 'head', 'arm_L', 'arm_R', 'hand_L', 'hand_R', 'leg_L', 'leg_R', 'foot_L', 'foot_R', 'antenna', 'weapon', 'eye_L', 'eye_R'];
