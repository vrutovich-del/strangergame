// Смайл: модель автора (model.js), украшения скинов и процедурные анимации.
import * as THREE from 'three';
import { autoBlink, blink, blinkOne, look } from '../../render/faceKit';
import type { HeroView } from '../../render/heroView';
import { ease } from '../../render/heroView';
import { attachAt, group, matKit, mesh, roundedBox, toon } from '../../render/kit';
import { animateSport, isSport, SPORT_JOINTS, sportGear, type SportFit } from '../../render/sport';
import type { SkinDef } from '../skinTypes';
// @ts-ignore — модель автора на JavaScript
import { createSmiley, SMILEY_RIG_NAMES } from './model.js';

const JOINTS = (Object.values(SMILEY_RIG_NAMES) as (string | string[])[]).flat();
/** Яйцо-тело Смайла (в координатах модели): центр и радиусы. */
const EGG = { y: 1.0, rx: 0.62, ry: 0.7, rz: 0.58 };
const hide = (o: THREE.Object3D | undefined | null) => { if (o) o.scale.setScalar(0.0001); };

/** Сюрикен: две скрещённые пластинки с дыркой посередине. */
function shuriken(M: ReturnType<typeof matKit>, parent: THREE.Object3D) {
  const g = group('shuriken', parent);
  for (const a of [0, Math.PI / 4]) mesh(roundedBox(0.2, 0.06, 0.02, 0.01), M(0xc8d0e0), 'shuriken_blade', g, [0, 0, 0], [0, 0, a]);
  for (const a of [0, Math.PI / 4]) mesh(roundedBox(0.06, 0.2, 0.02, 0.01), M(0xc8d0e0), 'shuriken_blade', g, [0, 0, 0], [0, 0, a]);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10).rotateX(Math.PI / 2), M(0x2b2b33), 'shuriken_hole', g);
  return g;
}

/** Ниндзя: чёрный капюшон, красная повязка с хвостами, катана за спиной, сюрикены на поясе. */
function ninja(m: THREE.Object3D) {
  const M = matKit('ninja');
  const torso = m.getObjectByName('torso')!;
  hide(m.getObjectByName('cap'));
  for (let i = 1; i <= 3; i++) hide(m.getObjectByName('grenade_' + i));
  const black = M(0x1c1c28), red = M(0xe8323e);
  // капюшон закрывает макушку до бровей
  const hood = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI * 0.29), black);
  hood.name = 'ninja_hood';
  hood.scale.set(EGG.rx + 0.025, EGG.ry + 0.025, EGG.rz + 0.025);
  attachAt(m, torso, hood, [0, EGG.y, 0]);
  // повязка вокруг головы
  const k = Math.sqrt(1 - (0.42 / EGG.ry) ** 2);
  const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.075, 8, 48).rotateX(Math.PI / 2), red);
  band.name = 'ninja_band';
  band.scale.set(EGG.rx * k + 0.02, 0.85, EGG.rz * k + 0.02);
  attachAt(m, torso, band, [0, EGG.y + 0.42, 0]);
  const knot = group('band_tails', m);
  attachAt(m, torso, knot, [0, EGG.y + 0.42, -EGG.rz * k - 0.03]);
  mesh(new THREE.SphereGeometry(0.07, 10, 8), red, 'band_knot', knot);
  for (const s of [1, -1]) mesh(roundedBox(0.08, 0.45, 0.02, 0.01), red, 'band_tail', knot, [0.06 * s, -0.2, -0.03], [0.3, 0, 0.25 * s]);
  // катана за спиной: рукоять торчит над правым плечом
  const katana = group('katana', m);
  attachAt(m, torso, katana, [-0.1, 0.95, -EGG.rz - 0.04], [0, 0, 0.75]);
  mesh(roundedBox(0.075, 1.0, 0.05, 0.02), black, 'katana_sheath', katana, [0, -0.1, 0]);
  mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 14), M(0xffc933), 'katana_guard', katana, [0, 0.42, 0]);
  mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.26, 8), red, 'katana_grip', katana, [0, 0.56, 0]);
  // сюрикены на поясе вместо гранат
  for (const [x, z] of [[0.3, 0.42], [-0.34, 0.38]]) {
    const sh = shuriken(M, m);
    attachAt(m, torso, sh, [x, 0.5, z], [0, x > 0 ? 0.5 : -0.5, 0.3]);
  }
}

/** Робот: антенна с лампочкой, болты по бокам, шов по корпусу и панель с огоньками. */
function robo(m: THREE.Object3D) {
  const M = matKit('robo');
  const torso = m.getObjectByName('torso')!;
  hide(m.getObjectByName('cap'));
  const dark = M(0x4a5468), metal = M(0xc8d0de);
  const ant = group('antenna', m);
  attachAt(m, torso, ant, [0, EGG.y + EGG.ry - 0.02, 0]);
  mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 8), dark, 'antenna_rod', ant, [0, 0.15, 0]);
  mesh(new THREE.SphereGeometry(0.085, 14, 10), M(0xff4b55, { emissive: 0xff2030, ei: 1 }), 'antenna_light', ant, [0, 0.33, 0]);
  for (const s of [1, -1]) {
    const b = group('bolt', m);
    attachAt(m, torso, b, [(EGG.rx - 0.02) * s, EGG.y + 0.05, 0], [0, 0, (Math.PI / 2) * s]);
    mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 12), metal, 'bolt_head', b, [0, 0.03, 0]);
    mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 6), dark, 'bolt_nut', b, [0, 0.09, 0]);
  }
  // шов по корпусу — между ртом и глазами
  const seam = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 6, 48).rotateX(Math.PI / 2), dark);
  seam.name = 'robo_seam';
  seam.scale.set(EGG.rx + 0.006, 1, EGG.rz + 0.006);
  attachAt(m, torso, seam, [0, EGG.y, 0]);
  // панель на груди с тремя огоньками
  const panel = group('robo_panel', m);
  attachAt(m, torso, panel, [0.02, 0.5, 0.55], [-0.15, 0, 0]);
  mesh(roundedBox(0.36, 0.16, 0.05, 0.03), dark, 'panel_plate', panel);
  [0x5ee05a, 0xffd23f, 0x3fd8ff].forEach((c, i) => mesh(new THREE.SphereGeometry(0.035, 10, 8), M(c, { emissive: c, ei: 1 }), 'panel_light', panel, [(i - 1) * 0.1, 0, 0.03]));
}

/** Спортивная форма: повязка вместо кепки, мяч в левой руке (футбольный — у ног), бита на плече, номер на спине. */
const SPORT: SportFit = {
  head: { node: 'torso', c: [0, EGG.y, 0], r: [EGG.rx, EGG.ry, EGG.rz] },
  band: 0.6,
  cap: false, // у Смайла своя кепка — её перекрашивает палитра скина
  ball: { basketball: { node: 'hand_L', p: [0.95, 1.12, 0.2] }, football: { node: 'root', p: [0.32, 0.2, 0.55] } },
  ballR: 0.21,
  bat: { node: 'hand_L', p: [0.92, 0.8, 0.24], r: [-0.5, 0, 0.15], len: 1.0 },
  number: { node: 'torso', p: [0, 0.86, -0.59], r: [-0.2, Math.PI, 0], h: 0.22, plate: 0.6 },
  hide: { basketball: ['cap'], football: ['cap'] },
};

function decorate(m: THREE.Object3D, skin: SkinDef) {
  if (isSport(skin.id) && skin.kit) sportGear(m, skin.id, SPORT, skin.kit);
  const torso = m.getObjectByName('torso')!;
  if (skin.id === 'ninja') ninja(m);
  if (skin.id === 'robo') robo(m);
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
  joints: [...JOINTS, 'helmet', 'band_tails', 'katana', 'antenna', ...SPORT_JOINTS],
  outline: [0x2a1206, 0.012],
  scale: 0.74,
  height: 1.5,
  muzzle: 'hand_R',
  face: { center: [0, 1.15, 0.2], half: 0.6 },
  build(skin: SkinDef) {
    // обводку система моделей добавит после украшений скина (стекло шлема — без обводки)
    const m = createSmiley({ palette: skin.palette ?? {}, outline: false });
    decorate(m, skin);
    m.traverse((o) => { if (o.name === 'helmet_glass') o.userData.noOutline = true; });
    return m;
  },
  animate(r, s) {
    animateSport(r, s);
    const torso = r.bone('torso')!, body = r.body;
    const t = s.t;
    const legL = r.bone('leg_L'), legR = r.bone('leg_R');
    const armL = r.bone('arm_L'), armR = r.bone('arm_R');
    const mouth = r.bone('mouth');
    const nj = r.skinId === 'ninja', rb = r.skinId === 'robo';
    const q = (v: number, n: number) => (rb ? Math.round(v * n) / n : v); // робот двигается «рывками»
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
    const hopF = run > 0.1 ? (nj ? 11 : 9) : 4.2;
    const hop = Math.abs(Math.sin(t * hopF));
    if (rb) {
      // робот не подпрыгивает, а шагает, покачиваясь рывками
      body.position.y = q(hop, 3) * 0.05 * run;
      torso.rotation.z = q(Math.sin(t * hopF), 2) * 0.07 * run;
      torso.rotation.x = run * 0.08;
    } else {
      body.position.y = hop * (0.04 + run * (nj ? 0.08 : 0.16));
      const sq = (1 - hop) * (0.04 + run * 0.08);
      torso.scale.set(1 + sq, 1 - sq, 1 + sq);
      torso.rotation.x = run * (nj ? 0.42 : 0.16);
    }
    if (legL && legR) { legL.rotation.x = q(Math.sin(t * hopF), 2) * 0.55 * run; legR.rotation.x = -q(Math.sin(t * hopF), 2) * 0.55 * run; }
    if (nj) {
      // ниндзя бежит, отведя руки назад; в покое — боевая стойка
      if (armL && armR) { armL.rotation.x = 1.1 * run; armR.rotation.x = 1.1 * run; }
      body.position.y -= 0.05 * (1 - run);
      torso.rotation.x += 0.1 * (1 - run);
      const tails = r.bone('band_tails');
      if (tails) { tails.rotation.x = -0.4 - run * 0.9 + Math.sin(t * 15) * (0.1 + 0.15 * run); tails.rotation.z = Math.sin(t * 9) * 0.15; }
    } else if (armL && armR) { armL.rotation.x = -q(Math.sin(t * hopF), 2) * 0.4 * run; armR.rotation.x = q(Math.sin(t * hopF), 2) * 0.4 * run; }
    if (rb) {
      // антенна качается, лампочка мигает при выстреле; в покое голова «сканирует»
      const ant = r.bone('antenna');
      if (ant) ant.rotation.z = Math.sin(t * 6) * 0.15 + Math.sin(t * hopF) * 0.2 * run;
      if (run < 0.05) body.rotation.y = q(Math.sin(t * 0.8), 2) * 0.25;
    }
    // гранаты-смайлики качаются, а когда помощники вылетели — на ремне их нет
    for (let i = 1; i <= 3; i++) {
      const g = r.bone('grenade_' + i);
      if (!g) continue;
      if (s.helpers) g.scale.setScalar(0.0001);
      else { g.rotation.x = Math.sin(t * hopF + i) * 0.25 * (0.3 + run); g.rotation.z = Math.cos(t * 3 + i) * 0.1; }
    }
    let lid = autoBlink(t, 0.37);
    // ниндзя бросает сюрикены с разворота
    if (nj && s.shot >= 0 && s.shot < 0.3) body.rotation.y = Math.PI * 2 * ease.out(s.shot / 0.3);
    // выстрел: улыбка шире + отдача рукой
    const shot = ease.pulse(s.shot, 0.3);
    if (mouth) mouth.scale.set(1 + shot * 0.18, 1 + shot * 0.35, 1);
    if (armR && shot) armR.rotation.x -= shot * 0.9;
    torso.rotation.x -= shot * 0.12;
    // супер: прыжок и руки вверх
    const sup = ease.pulse(s.sup, 0.6);
    // ниндзя делает сальто назад
    if (nj && s.sup >= 0 && s.sup < 0.6) torso.rotation.x -= Math.PI * 2 * ease.inOut(s.sup / 0.6);
    if (sup) {
      body.position.y += sup * (nj ? 0.8 : 0.5);
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
    if (s.win && rb) {
      // робот танцует «робота»
      body.rotation.y = q(Math.sin(t * 2), 2) * 0.6;
      if (armL) armL.rotation.z += q(Math.sin(t * 4), 1) * 1.2 + 0.6;
      if (armR) armR.rotation.z -= q(Math.sin(t * 4 + Math.PI), 1) * 1.2 + 0.6;
      body.position.y = 0;
    } else if (s.win) {
      body.rotation.y = (t * 4) % (Math.PI * 2);
      body.position.y = Math.abs(Math.sin(t * 6)) * 0.3;
      if (Math.sin(t * 2) > 0.3) blinkOne(r, 'L', 1);
      if (mouth) mouth.scale.set(1.15, 1.3, 1);
    }
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
