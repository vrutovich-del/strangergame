// Бактерия: модель автора (model.js), украшения скинов и процедурные анимации.
import * as THREE from 'three';
import { autoBlink, blink, look } from '../../render/faceKit';
import type { HeroView } from '../../render/heroView';
import { ease } from '../../render/heroView';
import { group, mesh, toon } from '../../render/kit';
import type { SkinDef } from '../skinTypes';
// @ts-ignore — модель автора на JavaScript
import { createPurpleGerm, PURPLE_GERM_RIG_NAMES } from './model.js';

const RIG = PURPLE_GERM_RIG_NAMES as Record<string, string | string[]>;
const CILIA: string[][] = [];
for (let i = 0; i < 30; i++) {
  const id = String(i).padStart(2, '0');
  CILIA.push([0, 1, 2].map((k) => `cilia_${id}_s${k}`));
}
const JOINTS = [
  ...Object.entries(RIG).filter(([k]) => k !== 'ciliaPattern').flatMap(([, v]) => v),
  ...CILIA.flat(), 'crown',
];
const RAINBOW = [0xff4b55, 0xff9b3f, 0xffd23f, 0x5ee05a, 0x3fa9ff, 0xb05cff];

function decorate(m: THREE.Object3D, skin: SkinDef) {
  const torso = m.getObjectByName('torso')!;
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
  joints: JOINTS,
  outline: [0x14071c, 0.013],
  scale: 0.74,
  height: 1.5,
  muzzle: 'weapon_muzzle',
  build(skin: SkinDef) {
    const m = createPurpleGerm({ palette: skin.palette ?? {}, outline: false });
    decorate(m, skin);
    return m;
  },
  animate(r, s) {
    const torso = r.bone('torso')!, body = r.body, t = s.t;
    const legL = r.bone('leg_L'), legR = r.bone('leg_R');
    // жгутики шевелятся всегда
    const wig = s.move > 0.1 ? 0.3 : 0.15;
    const sp = s.move > 0.1 ? 11 : 6;
    for (let i = 0; i < CILIA.length; i++) {
      const segs = CILIA[i];
      for (let k = 0; k < 3; k++) { const b = r.bone(segs[k]); if (b) b.rotation.z += wig * Math.sin(t * sp + i + k * 0.9); }
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
