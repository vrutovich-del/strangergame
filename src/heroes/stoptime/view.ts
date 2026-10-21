// Стоп-Тайм: модель (model.ts), детали скинов и процедурные анимации:
// тик-так походка, бросок шаров, звон колокольчиков на супере, кукушка у скина «Часы с кукушкой».
import * as THREE from 'three';
import { autoBlink, blink, look } from '../../render/faceKit';
import type { HeroView } from '../../render/heroView';
import { ease } from '../../render/heroView';
import { group, matKit, mesh, roundedBox } from '../../render/kit';
import type { SkinDef } from '../skinTypes';
import { createStopTime, STOPTIME_JOINTS } from './model';

const TAU = Math.PI * 2;
const C = 0.68;
const hide = (o: THREE.Object3D | undefined) => { if (o) o.scale.setScalar(0.0001); };

/** Скин «Часы с кукушкой»: домик с крышей, окошко с кукушкой и маятник с гирьками. */
function cuckooClock(m: THREE.Object3D) {
  const M = matKit('cuckoo');
  const torso = m.getObjectByName('torso')!;
  for (const n of ['bell_L', 'bell_R', 'bell_hammer', 'crown', 'key']) hide(m.getObjectByName(n));
  const wood = M(0x8a5a2b), dark = M(0x5e3a1a), leaf = M(0x3fae4a);
  mesh(roundedBox(1.36, 1.2, 0.26, 0.08), wood, 'house', torso, [0, C + 0.08, -0.1]);
  const roof = group('roof', torso, [0, C + 0.7, -0.06]);
  for (const s of [1, -1]) mesh(roundedBox(0.95, 0.1, 0.46, 0.04), dark, 'roof_side', roof, [0.36 * s, 0.2, 0], [0, 0, -0.62 * s]);
  mesh(new THREE.SphereGeometry(0.07, 10, 8), leaf, 'roof_top', roof, [0, 0.5, 0]);
  for (const s of [1, -1]) mesh(new THREE.SphereGeometry(0.09, 10, 8), leaf, 'roof_leaf', roof, [0.62 * s, -0.12, 0.18], undefined, [1.4, 0.6, 0.8]);
  // окошко и дверцы
  mesh(roundedBox(0.3, 0.26, 0.06, 0.04), dark, 'window', torso, [0, C + 0.68, 0.06]);
  const bird = group('cuckoo', torso, [0, C + 0.68, 0.06]);
  mesh(new THREE.SphereGeometry(0.11, 16, 12), M(0xffd23f), 'bird_body', bird, [0, 0, 0.06]);
  mesh(new THREE.ConeGeometry(0.04, 0.1, 8).rotateX(Math.PI / 2), M(0xff8a2a), 'bird_beak', bird, [0, -0.01, 0.2]);
  for (const s of [1, -1]) {
    mesh(new THREE.SphereGeometry(0.025, 8, 6), M(0x140a24), 'bird_eye', bird, [0.05 * s, 0.04, 0.15]);
    mesh(new THREE.SphereGeometry(0.06, 10, 8), M(0xffb02e), 'bird_wing', bird, [0.1 * s, -0.01, 0.04], undefined, [0.5, 0.9, 1.3]);
  }
  bird.scale.setScalar(0.0001);
  // маятник и гирьки-шишки
  const pend = group('pendulum', torso, [0, C - 0.56, -0.12]);
  mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.42, 6), M(0xc8860f), 'pend_rod', pend, [0, -0.21, 0]);
  mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 20).rotateX(Math.PI / 2), M(0xffc933), 'pend_disk', pend, [0, -0.45, 0]);
  for (const s of [1, -1]) {
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), M(0x9aa0aa), 'chain', torso, [0.2 * s, C - 0.7, -0.14]);
    mesh(new THREE.ConeGeometry(0.06, 0.18, 8).rotateX(Math.PI), dark, 'weight', torso, [0.2 * s, C - 0.92, -0.14]);
  }
}

function decorate(m: THREE.Object3D, skin: SkinDef) {
  if (skin.id === 'cuckoo') cuckooClock(m);
  if (skin.id === 'night') {
    // звёздочки на корпусе светятся
    const torso = m.getObjectByName('torso')!;
    const star = matKit('night')(0xfff3a0, { emissive: 0xffe060, ei: 1 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.3;
      mesh(new THREE.OctahedronGeometry(0.035, 0), star, 'star', torso, [Math.sin(a) * 0.62, C + Math.cos(a) * 0.62, 0.2 + (i % 2) * 0.01]);
    }
  }
}

const view: HeroView = {
  id: 'stoptime',
  joints: [...STOPTIME_JOINTS, 'cuckoo', 'pendulum', 'roof'],
  outline: [0x1e1238, 0.014],
  scale: 0.72,
  height: 1.45,
  muzzle: 'hand_R',
  build(skin: SkinDef) {
    const m = createStopTime({ palette: (skin.palette ?? {}) as any });
    decorate(m, skin);
    return m;
  },
  animate(r, s) {
    const torso = r.bone('torso')!, body = r.body, t = s.t;
    const legL = r.bone('leg_L'), legR = r.bone('leg_R'), armL = r.bone('arm_L'), armR = r.bone('arm_R');
    const hour = r.bone('clock_hour'), min = r.bone('clock_min'), hammer = r.bone('bell_hammer');
    const bellL = r.bone('bell_L'), bellR = r.bone('bell_R'), key = r.bone('key'), mouth = r.bone('mouth');
    const bird = r.bone('cuckoo'), pend = r.bone('pendulum');
    const cuckoo = r.skinId === 'cuckoo';
    // стрелки идут всегда: минутная «тикает» шагами, часовая плавно
    const tick = Math.floor(t * 2) + ease.out(Math.min(1, (t * 2 % 1) * 6));
    let minA = -tick * (TAU / 60) * 5, hourA = -t * 0.08;
    let ring = 0, lid = autoBlink(t, 0.5), birdOut = 0;
    if (key) key.rotation.z = t * 1.6;
    if (pend) pend.rotation.z = Math.sin(t * Math.PI * 1.2) * 0.42;

    // смерть: пружины лопаются — колокольчики отлетают, стрелки крутятся, будильник падает навзничь
    if (s.dead >= 0) {
      const k = ease.out(Math.min(1, s.dead / 0.55));
      torso.rotation.x = -1.25 * k;
      torso.position.y -= 0.2 * k;
      if (bellL) { bellL.position.y += 0.5 * k; bellL.position.x += 0.3 * k; bellL.rotation.z -= 2 * k; }
      if (bellR) { bellR.position.y += 0.4 * k; bellR.position.x -= 0.35 * k; bellR.rotation.z += 2 * k; }
      if (min) min.rotation.z = -s.dead * 25;
      if (hour) hour.rotation.z = -s.dead * 9;
      body.scale.setScalar(r.scale * Math.max(0.0001, 1 - Math.max(0, s.dead - 1.0) * 3));
      blink(r, 1);
      return;
    }

    // ходьба: мелкие шажки и покачивание «тик-так»
    const run = s.move;
    const f = 9.5;
    const sw = Math.sin(t * f);
    if (legL && legR) { legL.rotation.x = sw * 0.65 * run; legR.rotation.x = -sw * 0.65 * run; }
    if (armL && armR) { armL.rotation.x = -sw * 0.55 * run; armR.rotation.x = sw * 0.55 * run; }
    body.position.y = Math.abs(sw) * 0.07 * run + Math.abs(Math.sin(t * 3.2)) * 0.015 * (1 - run);
    torso.rotation.z = Math.sin(t * Math.PI) * 0.05 * (1 - run) + sw * (cuckoo ? 0.1 : 0.05) * run;
    torso.rotation.x = run * 0.1;

    // атака: бросок шаров правой, потом левой рукой
    const sh = s.shot;
    const throwCurve = (u: number) => (u <= 0 || u >= 1 ? 0 : u < 0.4 ? 1.3 * ease.out(u / 0.4) : 1.3 - 3.0 * ease.inOut((u - 0.4) / 0.6));
    if (sh >= 0 && sh < 0.7) {
      if (armR) armR.rotation.x += throwCurve(sh / 0.32);
      if (armL) armL.rotation.x += throwCurve((sh - 0.13) / 0.32);
      torso.rotation.y += -0.2 * ease.pulse(sh, 0.3) + 0.2 * ease.pulse(sh - 0.13, 0.3);
      if (mouth) mouth.scale.y = 1 + 0.4 * ease.pulse(sh, 0.35);
      birdOut = Math.max(birdOut, ease.pulse(sh, 0.5));
    }

    // супер: звенит! руки вверх, стрелки бешено крутятся назад
    const sp = s.sup;
    if (sp >= 0 && sp < 1.4) {
      const k = Math.min(1, sp / 0.15) * (1 - ease.inOut(Math.max(0, (sp - 1.0) / 0.4)));
      ring = k;
      if (armL) armL.rotation.z += 2.3 * k;
      if (armR) armR.rotation.z -= 2.3 * k;
      body.position.y += 0.35 * ease.pulse(sp, 0.5);
      torso.scale.setScalar(1 + 0.12 * k + Math.sin(sp * 50) * 0.02 * k);
      minA += sp * 30 * k; hourA += sp * 6 * k;
      lid = -0.4 * k;
      if (mouth) mouth.scale.set(1 + 0.2 * k, 1 + 0.7 * k, 1);
      birdOut = Math.max(birdOut, Math.abs(Math.sin(sp * 5)) * k);
    }

    // урон: вздрагивает, стрелки дёргаются
    const hurt = ease.decay(s.hurt, 0.4);
    if (hurt) {
      lid = -0.4 * hurt;
      torso.rotation.z += Math.sin(s.hurt * 50) * 0.1 * hurt;
      minA += Math.sin(s.hurt * 40) * 0.5 * hurt;
      for (const n of ['brow_L', 'brow_R']) { const b = r.bone(n); if (b) b.position.y += 0.04 * hurt; }
    }

    // победа: прыгает и трезвонит
    if (s.win) {
      body.position.y = Math.abs(Math.sin(t * 6)) * 0.3;
      if (armL) armL.rotation.z += 2.2 + Math.sin(t * 12) * 0.3;
      if (armR) armR.rotation.z -= 2.2 + Math.sin(t * 12 + 1) * 0.3;
      ring = Math.max(ring, 0.8);
      minA = -t * 6; hourA = -t * 0.5;
      birdOut = Math.max(birdOut, Math.abs(Math.sin(t * 3)));
    }
    if (s.lose) {
      torso.rotation.x = 0.35;
      minA = Math.PI; hourA = Math.PI * 0.95; // «полседьмого» — стрелки повисли
      lid = 0.55;
      if (mouth) mouth.scale.set(0.7, 0.4, 1);
    }
    if (s.showcase && !s.win && !s.lose) {
      // в меню иногда звенит и машет рукой
      const alarm = Math.max(0, Math.sin(t * 0.9 - 2)) ** 10;
      ring = Math.max(ring, alarm);
      const wave = Math.max(0, Math.sin(t * 0.7)) ** 4;
      if (armL) { armL.rotation.z += wave * 1.6; armL.rotation.x += Math.sin(t * 12) * 0.3 * wave; }
      birdOut = Math.max(birdOut, alarm);
    }

    if (min) min.rotation.z = minA;
    if (hour) hour.rotation.z = hourA;
    if (ring > 0) {
      if (hammer) hammer.rotation.z = Math.sin(t * 70) * 0.55 * ring;
      if (bellL) bellL.rotation.z += Math.sin(t * 70) * 0.08 * ring;
      if (bellR) bellR.rotation.z += Math.sin(t * 70 + 1) * 0.08 * ring;
      torso.rotation.z += Math.sin(t * 70) * 0.025 * ring;
    }
    if (bird) {
      // кукушка выглядывает из окошка
      const k = Math.min(1, birdOut * 1.6);
      bird.scale.setScalar(k > 0.02 ? k : 0.0001);
      bird.position.z += 0.18 * k;
      bird.rotation.x = -0.3 * Math.sin(t * 20) * k;
    }
    blink(r, lid);
    look(r, Math.sin(t * 0.6) * 0.35, Math.cos(t * 0.4) * 0.15 + hurt * 0.5);
  },
};

export default view;
