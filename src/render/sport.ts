// Спортивные скины: баскетбол, футбол и бейсбол. Общие детали для всех героев — мячи, бита, кепка,
// повязка на голову и номер на спине. Где их носить, у каждого героя задаёт SportFit в его view.ts.
import * as THREE from 'three';
import type { AnimState, Rig } from './heroView';
import { attachAt, group, matKit, mesh, roundedBox } from './kit';

export type Sport = 'basketball' | 'football' | 'baseball';
export const SPORTS: Sport[] = ['basketball', 'football', 'baseball'];
export const isSport = (id: string): id is Sport => (SPORTS as string[]).includes(id);
/** Узлы спортивных деталей, которые двигаются сами (их нельзя склеивать). */
export const SPORT_JOINTS = ['sport_ball', 'sport_bat'];

type V3 = [number, number, number];
type Mk = ReturnType<typeof matKit>;

/** Цвета формы и номер на спине (поле kit у скина). */
export interface SportKit { main: number; accent: number; number: string }

/** Где у героя голова, мяч, бита и номер (в координатах модели). */
export interface SportFit {
  /** Голова-эллипсоид: узел, к которому крепить, центр и радиусы. По нему облегают повязка и кепка. */
  head: { node: string; c: V3; r: V3 };
  /** Высота повязки: доля радиуса головы по Y над центром. false — у модели уже есть своя повязка. */
  band: number | false;
  /** Своя бейсбольная кепка: докуда купол закрывает голову (доля от макушки). false — у модели уже есть кепка или шлем. */
  cap: { cut: number } | false;
  /** Мяч (баскетбол и футбол) — у каждого вида спорта своё место. Узел 'root' — корень модели. */
  ball: Partial<Record<Exclude<Sport, 'baseball'>, { node: string; p: V3 }>>;
  ballR: number;
  /** Бита: точка рукоятки и поворот (бита растёт вдоль +Y). */
  bat: { node: string; p: V3; r: V3; len: number };
  /** Номер: точка, поворот (цифры смотрят вдоль +Z) и высота цифр. plate — радиус изгиба нашивки цвета формы под цифрами. */
  number?: { node: string; p: V3; r: V3; h: number; plate?: number };
  /** Что спрятать у модели для каждого вида спорта. */
  hide?: Partial<Record<Sport, string[]>>;
}

const hide = (o: THREE.Object3D | undefined | null) => { if (o) o.scale.setScalar(0.0001); };
const SEAM = 0x2a1206;

/** Баскетбольный мяч: оранжевый, с тёмными швами. */
export function basketball(M: Mk, r: number) {
  const g = group('sport_ball');
  mesh(new THREE.SphereGeometry(r, 24, 16), M(0xf07a24), 'ball_skin', g);
  const seam = M(SEAM);
  const ring = () => new THREE.TorusGeometry(r * 1.005, r * 0.055, 6, 32);
  mesh(ring(), seam, 'ball_seam', g).userData.noOutline = true;
  mesh(ring().rotateY(Math.PI / 2), seam, 'ball_seam', g).userData.noOutline = true;
  mesh(ring().rotateX(Math.PI / 2), seam, 'ball_seam', g).userData.noOutline = true;
  return g;
}

/** Футбольный мяч: белый, с чёрными пятиугольниками. */
export function soccerBall(M: Mk, r: number) {
  const g = group('sport_ball');
  mesh(new THREE.SphereGeometry(r, 24, 16), M(0xf8f8f4), 'ball_skin', g);
  const black = M(0x1c1c22);
  const phi = (1 + Math.sqrt(5)) / 2;
  const up = new THREE.Vector3(0, 1, 0);
  const dirs: V3[] = [];
  for (const a of [1, -1]) for (const b of [phi, -phi]) dirs.push([0, a, b], [a, b, 0], [b, 0, a]);
  for (const d of dirs) {
    const n = new THREE.Vector3(...d).normalize();
    const p = mesh(new THREE.CylinderGeometry(r * 0.36, r * 0.36, r * 0.1, 5), black, 'ball_patch', g);
    p.quaternion.setFromUnitVectors(up, n);
    p.position.copy(n.multiplyScalar(r * 0.97));
    p.userData.noOutline = true;
  }
  return g;
}

/** Бейсбольная бита: растёт вдоль +Y от рукоятки. */
export function bat(M: Mk, len: number) {
  const g = group('sport_bat');
  const wood = M(0xd8a060);
  mesh(new THREE.SphereGeometry(len * 0.05, 10, 8), M(0x3a2a1a), 'bat_knob', g, [0, 0, 0], undefined, [1, 0.6, 1]);
  mesh(new THREE.CylinderGeometry(len * 0.03, len * 0.03, len * 0.32, 10), M(0x2b2b33), 'bat_grip', g, [0, len * 0.16, 0]);
  mesh(new THREE.CylinderGeometry(len * 0.072, len * 0.032, len * 0.66, 14), wood, 'bat_barrel', g, [0, len * 0.65, 0]);
  mesh(new THREE.SphereGeometry(len * 0.072, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), wood, 'bat_end', g, [0, len * 0.98, 0]);
  return g;
}

/** Номер из «электронных» цифр (как на табло): сегменты-брусочки, без текстур. plate — изогнутая нашивка под цифрами. */
export function jerseyNumber(M: Mk, digits: string, color: number, h: number, plate?: { color: number; radius: number }) {
  const g = group('jersey_number');
  const mat = M(color);
  const W = h * 0.56, T = h * 0.17, step = W + T * 0.9;
  if (plate) {
    // кусок цилиндра выпуклостью к зрителю: края прилегают к круглой спине
    const pw = digits.length * step + T * 1.6, R = plate.radius, arc = pw / R;
    const geo = new THREE.CylinderGeometry(R, R, h + T * 1.6, 12, 1, true, -arc / 2, arc).translate(0, 0, -R - T * 0.3);
    mesh(geo, M(plate.color, { side: THREE.DoubleSide }), 'number_plate', g).userData.outlineScale = 0.6;
  }
  // a — верх, b — справа сверху, c — справа снизу, d — низ, e — слева снизу, f — слева сверху, g — середина
  const SEG: Record<string, string> = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  const hor = roundedBox(W, T, T * 0.5, T * 0.3), ver = roundedBox(T, h / 2, T * 0.5, T * 0.3);
  [...digits].forEach((ch, i) => {
    const x = (i - (digits.length - 1) / 2) * step;
    for (const s of SEG[ch] ?? '') {
      const vertical = 'bcef'.includes(s);
      const sx = s === 'b' || s === 'c' ? W / 2 - T / 2 : s === 'e' || s === 'f' ? -W / 2 + T / 2 : 0;
      const sy = s === 'a' ? h / 2 - T / 2 : s === 'd' ? -h / 2 + T / 2 : s === 'b' || s === 'f' ? h / 4 - T / 4 : s === 'c' || s === 'e' ? -h / 4 + T / 4 : 0;
      const seg = mesh(vertical ? ver : hor, mat, 'number_seg', g, [x + sx, sy, 0]);
      seg.userData.outlineScale = 0.5;
    }
  });
  return g;
}

/** Повязка на голову: широкое кольцо и тонкая полоска другого цвета. */
function headband(M: Mk, fit: SportFit, band: number, kit: SportKit) {
  const { c, r } = fit.head;
  const k = Math.sqrt(Math.max(0.05, 1 - band * band));
  const g = group('headband');
  const ring = (tube: number, grow: number, color: number) => {
    const t = mesh(new THREE.TorusGeometry(1, tube, 8, 48).rotateX(Math.PI / 2), M(color), 'headband_ring', g);
    t.scale.set(r[0] * k + grow, 1, r[2] * k + grow);
  };
  ring(0.07, 0.025, kit.accent);
  ring(0.028, 0.06, kit.main);
  return { g, p: [c[0], c[1] + r[1] * band, c[2]] as V3 };
}

/** Бейсбольная кепка: купол по форме головы, козырёк вперёд и пуговка на макушке. */
function cap(M: Mk, fit: SportFit, cut: number, kit: SportKit) {
  const { c, r } = fit.head;
  const g = group('baseball_cap');
  const R: V3 = [r[0] + 0.035, r[1] + 0.035, r[2] + 0.035];
  // меньше 160 треугольников — такой купол не упрощается и не «проваливается» в голову
  const dome = mesh(new THREE.SphereGeometry(1, 18, 4, 0, Math.PI * 2, 0, Math.PI * cut), M(kit.main, { side: THREE.DoubleSide }), 'cap_dome', g);
  dome.scale.set(...R);
  const edgeY = R[1] * Math.cos(Math.PI * cut), edgeZ = R[2] * Math.sin(Math.PI * cut);
  const brimR = Math.min(R[0], R[2]) * 0.62;
  const brim = mesh(new THREE.CylinderGeometry(brimR, brimR, 0.035, 20, 1, false, -Math.PI / 2, Math.PI), M(kit.accent), 'cap_brim', g, [0, edgeY - 0.01, edgeZ * 0.82], [0.18, 0, 0]);
  brim.scale.z = 0.85;
  mesh(new THREE.SphereGeometry(0.035, 8, 6), M(kit.accent), 'cap_button', g, [0, R[1] - 0.005, 0]);
  return { g, p: c };
}

/** Надеть спортивную форму: детали для вида спорта по описанию героя. */
export function sportGear(m: THREE.Object3D, sport: Sport, fit: SportFit, kit: SportKit) {
  const M = matKit('sport_' + sport);
  const node = (n: string) => (n === 'root' ? m : m.getObjectByName(n) ?? m);
  for (const n of fit.hide?.[sport] ?? []) hide(m.getObjectByName(n));
  if (sport === 'basketball' && fit.band !== false) {
    const hb = headband(M, fit, fit.band, kit);
    attachAt(m, node(fit.head.node), hb.g, hb.p);
  }
  if (sport === 'baseball') {
    if (fit.cap) {
      const cp = cap(M, fit, fit.cap.cut, kit);
      attachAt(m, node(fit.head.node), cp.g, cp.p);
    }
    attachAt(m, node(fit.bat.node), bat(M, fit.bat.len), fit.bat.p, fit.bat.r);
  } else {
    const at = fit.ball[sport];
    if (at) attachAt(m, node(at.node), sport === 'basketball' ? basketball(M, fit.ballR) : soccerBall(M, fit.ballR), at.p);
  }
  const n = fit.number;
  if (n) attachAt(m, node(n.node), jerseyNumber(M, kit.number, kit.accent, n.h, n.plate ? { color: kit.main, radius: n.plate } : undefined), n.p, n.r);
}

/** Анимации деталей: баскетбольный мяч крутится, а на бегу его ведут; футбольный катится и подпрыгивает. */
export function animateSport(r: Rig, s: AnimState) {
  if (!isSport(r.skinId) || s.dead >= 0) return;
  const ball = r.bone('sport_ball');
  if (!ball) return;
  const t = s.t;
  if (r.skinId === 'basketball') {
    ball.rotation.y = t * 9;
    // ведение мяча на бегу
    ball.position.y -= Math.abs(Math.sin(t * 7)) * 0.35 * s.move;
  } else if (r.skinId === 'football') {
    ball.rotation.x = t * (2 + 10 * s.move);
    // в меню герой чеканит мяч
    if (s.showcase) ball.position.y += Math.abs(Math.sin(t * 4)) * 0.18;
  }
}
