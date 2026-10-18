// Смайл: модель автора (model.js), украшения скинов и процедурные анимации.
import * as THREE from 'three';
import { autoBlink, blink, blinkOne, look } from '../../render/faceKit';
import type { HeroView } from '../../render/heroView';
import { ease } from '../../render/heroView';
import { group, mesh, toon } from '../../render/kit';
import type { SkinDef } from '../skinTypes';
// @ts-ignore — модель автора на JavaScript
import { createSmiley, SMILEY_RIG_NAMES } from './model.js';

const JOINTS = (Object.values(SMILEY_RIG_NAMES) as (string | string[])[]).flat();

function decorate(m: THREE.Object3D, skin: SkinDef) {
  const torso = m.getObjectByName('torso')!;
  if (skin.id === 'cosmo') {
    // шлем космонавта: стеклянный пузырь, воротник и антенна; кепку снимаем
    const cap = m.getObjectByName('cap');
    if (cap) cap.scale.setScalar(0.0001);
    const helmet = group('helmet', torso, [0, 0.72, 0]);
    const glass = toon(0xbfe8ff, { transparent: true, opacity: 0.3, name: 'smiley_helmet_glass' });
    glass.depthWrite = false;
    const g = mesh(new THREE.SphereGeometry(0.88, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.64), glass, 'helmet_glass', helmet);
    g.renderOrder = 2;
    mesh(new THREE.TorusGeometry(0.7, 0.075, 10, 40).rotateX(Math.PI / 2), toon(0xe8ecf4, { name: 'smiley_helmet_ring' }), 'helmet_ring', helmet, [0, -0.36, 0]);
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), toon(0x9aa6bf, { name: 'smiley_helmet_ant' }), 'helmet_ant', helmet, [0.3, 0.9, -0.05], [0, 0, -0.25]);
    mesh(new THREE.SphereGeometry(0.06, 10, 8), toon(0xff4b55, { emissive: 0xff2030, ei: 0.8, name: 'smiley_helmet_light' }), 'helmet_light', helmet, [0.35, 1.07, -0.05]);
    const shine = mesh(new THREE.SphereGeometry(0.12, 10, 8), toon(0xffffff, { emissive: 0xffffff, ei: 0.8, transparent: true, opacity: 0.7, name: 'smiley_helmet_shine' }), 'helmet_shine', helmet, [-0.4, 0.55, 0.52], undefined, [1, 0.6, 0.3]);
    shine.userData.noOutline = true;
  }
  if (skin.id === 'angry') {
    // брови «домиком» — круче и выше
    for (const [n, s] of [['brow_L', 1], ['brow_R', -1]] as const) {
      const b = m.getObjectByName(n);
      if (b) { b.rotation.z += 0.32 * s; b.position.y += 0.02; }
    }
  }
}

const view: HeroView = {
  id: 'smile',
  joints: [...JOINTS, 'helmet'],
  outline: [0x2a1206, 0.012],
  scale: 0.74,
  height: 1.5,
  muzzle: 'hand_R',
  build(skin: SkinDef) {
    // обводку система моделей добавит после украшений скина (стекло шлема — без обводки)
    const m = createSmiley({ palette: skin.palette ?? {}, outline: false });
    decorate(m, skin);
    m.traverse((o) => { if (o.name === 'helmet_glass') o.userData.noOutline = true; });
    return m;
  },
  animate(r, s) {
    const torso = r.bone('torso')!, body = r.body;
    const t = s.t;
    const legL = r.bone('leg_L'), legR = r.bone('leg_R');
    const armL = r.bone('arm_L'), armR = r.bone('arm_R');
    const mouth = r.bone('mouth');
    // смерть: сдувается, как шарик
    if (s.dead >= 0) {
      const k = Math.min(1, s.dead / 0.7);
      const wob = Math.sin(s.dead * 40) * (1 - k) * 0.15;
      torso.scale.set(1 + k * 0.5 + wob, Math.max(0.05, 1 - k * 0.95), 1 + k * 0.5 - wob);
      torso.rotation.z = Math.sin(s.dead * 25) * 0.3 * (1 - k);
      blink(r, 1);
      return;
    }
    // постоянное лёгкое подпрыгивание; на бегу — большие прыжки
    const run = s.move;
    const hopF = run > 0.1 ? 9 : 4.2;
    const hop = Math.abs(Math.sin(t * hopF));
    body.position.y = hop * (0.04 + run * 0.16);
    const sq = (1 - hop) * (0.04 + run * 0.08);
    torso.scale.set(1 + sq, 1 - sq, 1 + sq);
    torso.rotation.x = run * 0.16;
    if (legL && legR) { legL.rotation.x = Math.sin(t * hopF) * 0.55 * run; legR.rotation.x = -Math.sin(t * hopF) * 0.55 * run; }
    if (armL && armR) { armL.rotation.x = -Math.sin(t * hopF) * 0.4 * run; armR.rotation.x = Math.sin(t * hopF) * 0.4 * run; }
    // гранаты-смайлики качаются, а когда помощники вылетели — на ремне их нет
    for (let i = 1; i <= 3; i++) {
      const g = r.bone('grenade_' + i);
      if (!g) continue;
      if (s.helpers) g.scale.setScalar(0.0001);
      else { g.rotation.x = Math.sin(t * hopF + i) * 0.25 * (0.3 + run); g.rotation.z = Math.cos(t * 3 + i) * 0.1; }
    }
    let lid = autoBlink(t, 0.37);
    // выстрел: улыбка шире + отдача рукой
    const shot = ease.pulse(s.shot, 0.3);
    if (mouth) mouth.scale.set(1 + shot * 0.18, 1 + shot * 0.35, 1);
    if (armR && shot) armR.rotation.x -= shot * 0.9;
    torso.rotation.x -= shot * 0.12;
    // супер: прыжок и руки вверх
    const sup = ease.pulse(s.sup, 0.6);
    if (sup) {
      body.position.y += sup * 0.5;
      if (armL) armL.rotation.z += sup * 1.2;
      if (armR) armR.rotation.z -= sup * 1.2;
      if (mouth) mouth.scale.y *= 1 + sup * 0.3;
    }
    // урон: испуганная рожица
    const hurt = ease.decay(s.hurt, 0.45);
    if (hurt > 0) {
      lid = -0.4 * hurt;
      for (const n of ['brow_L', 'brow_R']) { const b = r.bone(n); if (b) b.position.y += 0.05 * hurt; }
      if (mouth) mouth.scale.set(1 - 0.45 * hurt, 1 - 0.3 * hurt, 1);
      torso.rotation.z = Math.sin(s.hurt * 50) * 0.08 * hurt;
    }
    blink(r, lid);
    look(r, Math.sin(t * 0.7) * 0.3, hurt * 0.6);
    // победа: крутится и подмигивает
    if (s.win) {
      body.rotation.y = (t * 4) % (Math.PI * 2);
      body.position.y = Math.abs(Math.sin(t * 6)) * 0.3;
      if (Math.sin(t * 2) > 0.3) blinkOne(r, 'L', 1);
      if (mouth) mouth.scale.set(1.15, 1.3, 1);
    } else body.rotation.y = 0;
    if (s.lose) {
      torso.rotation.x = 0.35;
      if (mouth) mouth.scale.set(0.6, 0.6, 1);
      body.position.y = 0;
      blink(r, 0.5);
    }
    if (s.showcase && !s.win && !s.lose) {
      // в меню иногда машет рукой
      const wave = Math.max(0, Math.sin(t * 0.8)) ** 4;
      if (armL) { armL.rotation.z += wave * 1.4; armL.rotation.x += Math.sin(t * 12) * 0.3 * wave; }
    }
  },
};

export default view;
