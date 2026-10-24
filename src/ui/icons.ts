// Набор иконок «Стикерпак странностей»: один SVG-спрайт, каждый глиф в трёх обработках.
// a — чернильная обводка, w — + белая кайма (на цветных кнопках), b — стикер (кайма + жёсткая тень).
// Использование: icon('coin') или icon('gem', 'b') → <svg><use href="#gi-b-gem"></use></svg>.

type Glyph = { s: string; a: string; x?: number };

const T: Record<'a' | 'w' | 'b', { k: string; sw: number; o: string; ow: number; sh?: string }> = {
  a: { k: '#1b1033', sw: 6, o: '', ow: 0 },
  w: { k: '#1b1033', sw: 6, o: '#ffffff', ow: 12 },
  b: { k: '#14121f', sw: 7, o: '#fffaf0', ow: 14, sh: 'rgba(4,38,44,.55)' },
};
export type IconTreatment = keyof typeof T;

const ln = (d: string, w: number, c?: string, x?: string) => `<path d="${d}" style="fill:none;stroke:${c || '@k'};stroke-width:${w}px;stroke-linecap:round;stroke-linejoin:round${x || ''}"/>`;
const hl = (d: string, w?: number) => `<path d="${d}" style="fill:none;stroke:#fff;stroke-width:${w || 3}px;stroke-linecap:round;opacity:.9"/>`;
const st = (f: string, s?: number) => `fill:${f}${s ? `;stroke:@k;stroke-width:${s}px;stroke-linejoin:round` : ''}`;
const p = (d: string, f: string, s?: number) => `<path d="${d}" style="${st(f, s)}"/>`;
const c = (x: number | string, y: number | string, r: number, f: string, s?: number) => `<circle cx="${x}" cy="${y}" r="${r}" style="${st(f, s)}"/>`;
const r = (x: number, y: number, w: number, h: number, rx: number, f: string, s?: number, tr?: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"${tr ? ` transform="${tr}"` : ''} style="${st(f, s)}"/>`;
const el = (x: number, y: number, rx: number, ry: number, f: string, s?: number, tr?: string) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"${tr ? ` transform="${tr}"` : ''} style="${st(f, s)}"/>`;

const TROPHY = 'M13 8 H35 V17 C35 25 30 30 24 30 C18 30 13 25 13 17 Z';
const BAG_H = 'M15 19 V14 C15 6 33 6 33 14 V19 H28.5 V14 C28.5 10.5 19.5 10.5 19.5 14 V19 Z';
const BAG = 'M9 17 H39 L37 39 C36.8 41 35.5 42 33.5 42 H14.5 C12.5 42 11.2 41 11 39 Z';
const BLOB = 'M24 9 C35 8.5 41 15 40.5 25 C40 35 33 41.5 23.5 41 C13.5 40.5 7.5 34 8 24.5 C8.5 15 14 9.5 24 9 Z';
const FLAG = 'M15 8 C21 5 26 12 32 9 C35 7.5 37.5 7.5 40 8.5 V25 C37 23.5 34 24.5 30.5 26 C24.5 28.5 21 22 15 25 Z';
const TK = 'M7 14 H41 V20.5 A3.5 3.5 0 0 0 41 27.5 V34 H7 V27.5 A3.5 3.5 0 0 0 7 20.5 Z';
const TSTAR = 'M19 17.5 L20.65 21.73 L25.18 21.99 L21.66 24.87 L22.82 29.26 L19 26.8 L15.18 29.26 L16.34 24.87 L12.82 21.99 L17.35 21.73 Z';
const STAR = 'M24 7 L29 18.1 L41.1 19.4 L32.1 27.6 L34.6 39.6 L24 33.5 L13.4 39.6 L15.9 27.6 L6.9 19.4 L19 18.1 Z';
const SPK = 'M22 6 C24 17 28.5 21.5 40 23.5 C28.5 25.5 24 30 22 41 C20 30 15.5 25.5 4 23.5 C15.5 21.5 20 17 22 6 Z';
const SPK2 = 'M37 4 C37.8 8.6 39 9.8 43.6 10.6 C39 11.4 37.8 12.6 37 17.2 C36.2 12.6 35 11.4 30.4 10.6 C35 9.8 36.2 8.6 37 4 Z';
const LOCK_S = 'M15 22 V16 C15 5 33 5 33 16 V22 H28 V16 C28 10.5 20 10.5 20 16 V22 Z';
const F_BACK = 'M21.5 36 C21.5 27 25.5 23.5 31 23.5 C37 23.5 41 27 41 36 Z';
const F_FRONT = 'M6.5 41 C6.5 31 11 28 18 28 C25 28 29.5 31 29.5 41 Z';
const ANG = [0, 45, 90, 135, 180, 225, 270, 315];

const G: Record<string, Glyph> = {
  coin: {
    s: '<circle cx="24" cy="27.5" r="16"/><circle cx="24" cy="22.5" r="16"/>',
    a: c(24, 27.5, 16, '#d98a0b') + c(24, 22.5, 16, '#ffc93a', 2) + '<circle cx="24" cy="22.5" r="10.5" style="fill:none;stroke:#e3a11f;stroke-width:2.5px"/>' + r(19.5, 18, 9, 9, 2, '#d98a0b', 2) + hl('M12.5 18.5 A12 12 0 0 1 19 10.8'),
  },
  gem: {
    s: '<path d="M9 18 L16 9 H32 L39 18 L24 41 Z"/>',
    a: p('M9 18 L16 9 H32 L39 18 Z', '#b5f3ff') + p('M9 18 H39 L24 41 Z', '#2fc2ff') + p('M19 18 L24 9 L29 18 L24 41 Z', '#74dcff') + ln('M9 18 H39 M16 9 L19 18 L24 41 L29 18 L32 9 M19 18 L24 9 L29 18', 1.8) + hl('M13.5 16.5 L17 12', 2.6),
  },
  bling: {
    s: `<path d="${SPK}"/><path d="${SPK2}"/>`,
    a: p(SPK, '#ff6fd0') + p('M22 15 C23 20 25 22 30 23.5 C25 25 23 27 22 32 C21 27 19 25 14 23.5 C19 22 21 20 22 15 Z', '#ffc8ef') + p(SPK2, '#ffd23a'),
  },
  trophy: {
    s: `<path d="${TROPHY}"/><circle cx="11" cy="15" r="6"/><circle cx="37" cy="15" r="6"/><rect x="20" y="27" width="8" height="9"/><rect x="14" y="34" width="20" height="9" rx="2.5"/>`,
    a: c(11, 15, 6, '#e0950f') + c(11, 15, 2.6, '@k') + c(37, 15, 6, '#e0950f') + c(37, 15, 2.6, '@k') + r(20, 27, 8, 9, 0, '#e0950f') + p(TROPHY, '#ffc93a', 2) + p('M29 9.5 H33.5 V17 C33.5 22.5 30.5 26.5 26.5 28.2 C29.5 24 30 18 29 9.5 Z', '#eaa51c') + r(14, 34, 20, 9, 2.5, '#7a4cff', 2) + r(18.5, 36.8, 11, 3.4, 1.7, '#ffc93a') + hl('M17.5 11.5 V18'),
  },
  bag: {
    s: `<path d="${BAG_H}"/><path d="${BAG}"/>`,
    a: p(BAG_H, '#c95a00') + p(BAG, '#ff8a1f', 2) + p('M9 17 H39 L38.5 23 H9.5 Z', '#ffc27a') + ln('M9.5 23 H38.5', 2) + c(19.5, 28.5, 1.9, '@k') + c(28.5, 28.5, 1.9, '@k') + ln('M19 33 Q24 37.5 29 33', 2.4) + hl('M13.5 26 L14.4 36', 2.6),
  },
  heroes: {
    s: `<path d="${BLOB}"/><circle cx="35" cy="9.5" r="5"/>`,
    a: c(35, 9.5, 5, '#ffd23a', 2) + p(BLOB, '#a46bff', 2) + c(18, 22, 6.2, '#fff', 2) + c(19.6, 23, 2.7, '@k') + c(30.5, 21, 4.2, '#fff', 2) + c(31.5, 22, 1.9, '@k') + ln('M17 31.5 Q24 37 31.5 30.5', 2.5) + hl('M12.5 19 Q13.5 13.5 18.5 12.2', 2.6),
  },
  flag: {
    s: `<ellipse cx="13" cy="41" rx="8.5" ry="3.5"/><rect x="10" y="6" width="6" height="35" rx="3"/><path d="${FLAG}"/>`,
    a: `<ellipse cx="13" cy="41" rx="8.5" ry="3.5" style="fill:#0f8f78"/>` + p(FLAG, '#18c7a8', 2) + ln('M15.5 16 C21 13 26 19.5 32 16.8 C35 15.4 37.5 15.4 40 16.4', 3.4, '#ffffff') + r(10, 6, 6, 35, 3, '#fff0c8', 2),
  },
  ticket: {
    s: `<path d="${TK}" transform="rotate(-10 24 24)"/>`,
    a: `<g transform="rotate(-10 24 24)">` + p(TK, '#ff4f9a', 2) + ln('M31 16.5 V31.5', 2.2, '#ffd0e4', ';stroke-dasharray:2.4 3.4') + p(TSTAR, '#ffd23a', 1.6) + `</g>`,
  },
  quests: {
    s: '<rect x="10" y="9" width="28" height="33" rx="5"/><rect x="17" y="5" width="14" height="9" rx="3.5"/>',
    a: r(10, 9, 28, 33, 5, '#47d24a', 2) + r(14, 14, 20, 24, 2.5, '#ffffff') + r(17, 5, 14, 9, 3.5, '#2a8f34', 2) + ln('M19 19.5 H27', 2, '#b9c7d6') + ln('M18.5 28.5 L22.5 32.5 L30 21.5', 3.6, '#1f9a2c'),
  },
  star: {
    x: 4,
    s: `<path d="${STAR}"/>`,
    a: `<path d="${STAR}" style="fill:#ffcf3a;stroke:#ffcf3a;stroke-width:4px;stroke-linejoin:round"/>` + `<ellipse cx="20.6" cy="24" rx="1.9" ry="2.7" style="fill:@k"/><ellipse cx="27.4" cy="24" rx="1.9" ry="2.7" style="fill:@k"/>` + ln('M20.5 29 Q24 31.8 27.5 29', 2.2) + hl('M16.5 20.6 L20.5 19.8', 2.6),
  },
  gear: {
    s: '<circle cx="24" cy="24" r="13.5"/>' + ANG.map((a) => `<rect x="20.5" y="4.5" width="7" height="10" rx="2" transform="rotate(${a} 24 24)"/>`).join(''),
    a: ANG.map((a) => r(20.5, 4.5, 7, 10, 2, '#d6deec', 0, `rotate(${a} 24 24)`)).join('') + c(24, 24, 13.5, '#d6deec') + c(24, 24, 8, '#8e9bb5', 2) + c(24, 24, 3.4, '@k') + hl('M14.5 19 A10.5 10.5 0 0 1 19 14', 2.6),
  },
  friends: {
    s: `<circle cx="31" cy="15" r="6.5"/><path d="${F_BACK}"/><circle cx="18" cy="18.5" r="7.5"/><path d="${F_FRONT}"/>`,
    a: p(F_BACK, '#7fd0ff', 2) + c(31, 15, 6.5, '#7fd0ff', 2) + p(F_FRONT, '#ffd23a', 2) + c(18, 18.5, 7.5, '#ffd23a', 2) + c(15.6, 18, 1.5, '@k') + c(20.4, 18, 1.5, '@k') + c(29, 14.6, 1.3, '@k') + c(33, 14.6, 1.3, '@k'),
  },
  lock: {
    s: `<path d="${LOCK_S}"/><rect x="10" y="20" width="28" height="22" rx="5"/>`,
    a: p(LOCK_S, '#d6deec', 2) + r(10, 20, 28, 22, 5, '#ffc93a', 2) + c(24, 29, 3.2, '@k') + r(22.6, 30, 2.8, 6.5, 1.4, '@k') + hl('M14.5 25 V35', 2.6),
  },
  up: {
    s: '<path d="M24 5 L41 23 H31 V42 H17 V23 H7 Z"/>',
    a: p('M24 5 L41 23 H31 V42 H17 V23 H7 Z', '#5fe05a') + p('M24 5 L41 23 H31 V42 H24 Z', '#3cc43f') + hl('M13.5 21 L22.5 11.5', 2.6),
  },
  shard: {
    s: '<path d="M24 4 L35 15 L31 43 H17 L13 15 Z"/>',
    a: p('M24 4 L35 15 L31 43 H17 L13 15 Z', '#a35cff') + p('M24 4 L13 15 L17 43 H24 L24 19 Z', '#c79bff') + p('M24 4 L35 15 L24 19 L13 15 Z', '#e2ccff') + ln('M13 15 L24 19 L35 15 M24 19 V43', 1.7) + hl('M17 18.5 L19 33', 2.4),
  },
  check: { s: '<path d="M6 24 L12 18 L19 25 L36 8 L42 14 L19 37 Z"/>', a: p('M6 24 L12 18 L19 25 L36 8 L42 14 L19 37 Z', '#5fe05a') },
  chev: { s: '<path d="M15 8 L37 24 L15 40 Z"/>', a: p('M15 8 L37 24 L15 40 Z', '#ffffff') },
  plus: { s: '<path d="M19 8 H29 V19 H40 V29 H29 V40 H19 V29 H8 V19 H19 Z"/>', a: p('M19 8 H29 V19 H40 V29 H29 V40 H19 V29 H8 V19 H19 Z', '#ffffff') },
};

// ── полный набор ──
const S8 = 'M24 16.5 L26.06 21.67 L31.61 22.03 L27.33 25.58 L28.7 30.97 L24 28 L19.3 30.97 L20.67 25.58 L16.39 22.03 L21.94 21.67 Z';
const S6 = 'M24 24 L25.53 27.9 L29.71 28.15 L26.47 30.8 L27.53 34.85 L24 32.6 L20.47 34.85 L21.53 30.8 L18.29 28.15 L22.47 27.9 Z';
const BOXB = '<rect x="7" y="18" width="34" height="24" rx="4"/><rect x="5" y="10" width="38" height="11" rx="4"/>';
const box = (body: string, lid: string, extra: string) => r(7, 18, 34, 24, 4, body, 2) + r(5, 10, 38, 11, 4, lid, 2) + extra + hl('M10.5 25 V37', 2.6);
const CLOUD = 'M14 38 C8 38 5 34 5 30 C5 25.5 8.5 22.5 12.5 22.5 C13 15.5 18 11 24.5 11 C31 11 35.5 15.5 36.5 21 C41 21.5 44 25 44 29.5 C44 34.5 40.5 38 35.5 38 Z';
const METEOR_T = 'M26 17 C31 9 38 5 45 3 C43 9 41.5 14 37 19 C41 18 43.5 18 45 18 C40 24 35 27 30 29 Z';
const CACT = 'M19 41 V12 C19 6.5 29 6.5 29 12 V41 Z';
const CACT_L = 'M19 31 H13.5 C10.5 31 9 29 9 26 V19 C9 15.5 14 15.5 14 19 V25.5 H19 Z';
const CACT_R = 'M29 26 H34 V15.5 C34 12 39 12 39 15.5 V25 C39 29 37 31 34 31 H29 Z';
const GLOVE = 'M12 22 C12 12 18 8 26 8 C34 8 40 13 40 21 C40 29 36 33 30 34 V36 H16 V34 C13.5 32 12 28 12 22 Z';
const THUMB = 'M13 21 C8.5 20.5 6.5 26 8.5 29.5 C10.5 33 15 32.5 16.5 29 Z';
const BURST = 'M24 5 L28.2 13.8 L37.4 10.6 L34.2 19.8 L43 24 L34.2 28.2 L37.4 37.4 L28.2 34.2 L24 43 L19.8 34.2 L10.6 37.4 L13.8 28.2 L5 24 L13.8 19.8 L10.6 10.6 L19.8 13.8 Z';
const BOLT = 'M27 4 L10 27 H21 L17 44 L38 19 H26 Z';
const BUBBLE = 'M8 9 H40 C42 9 43 10 43 12 V31 C43 33 42 34 40 34 H22 L13 42 V34 H8 C6 34 5 33 5 31 V12 C5 10 6 9 8 9 Z';
const HEART = 'M24 41 C14 34 6 27 6 18 C6 12 10.5 8 16 8 C19.5 8 22.5 10 24 13 C25.5 10 28.5 8 32 8 C37.5 8 42 12 42 18 C42 27 34 34 24 41 Z';
const SHOE = 'M6 34 C6 30 8 27 12 26 L19 24 L23 15 C24 13 26.5 12.5 28 14 L32 19.5 C34 22.5 38 24.5 42 26.5 C43.5 27.3 44 29 44 31 V35 C44 37.5 43 39 41 39 H9 C7 39 6 38 6 36 Z';
const GLASS = 'M11 6 H37 V11 C37 17 31 21 28 24 C31 27 37 31 37 37 V42 H11 V37 C11 31 17 27 20 24 C17 21 11 17 11 11 Z';
const PAL = 'M24 7 C35 7 42 14 42 22 C42 28 38 30 34 30 C31 30 29 31 29 34 C29 38 27 41 23 41 C13 41 6 33 6 24 C6 14 14 7 24 7 Z';
const SNAIL = 'M4 38 C4 31 6 26 9 26 C12 26 13 29 13 31 H38 C42 31 44 34 44 38 Z';
const NOTE = 'M18.5 35 V11 L41.5 5.5 V31 H37.5 V13 L22.5 17 V35 Z';
const REFR = 'M38.1 18.9 A15 15 0 1 0 38.1 29.1 L31.5 26.7 A8 8 0 1 1 31.5 21.3 Z';
const SPKS = (x: number, y: number, s: number) => `M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z`;
const GERM_A = [0, 45, 90, 135, 180, 225, 270, 315];
const gx = (a: number) => (24 + 17 * Math.cos((a * Math.PI) / 180)).toFixed(2);
const gy = (a: number) => (24 + 17 * Math.sin((a * Math.PI) / 180)).toFixed(2);

Object.assign(G, {
  box1: { s: BOXB, a: box('#3fa9ff', '#86cbff', r(21, 10, 6, 32, 1, '#ffd23a', 2) + r(19, 17, 10, 9, 2, '#ffd23a', 2) + c(24, 21.5, 1.5, '@k')) },
  box2: { s: BOXB, a: box('#b45cff', '#d6a6ff', r(12, 10, 5, 32, 1, '#ffd23a', 2) + r(31, 10, 5, 32, 1, '#ffd23a', 2) + p(S6, '#ffd23a', 1.6)) },
  box3: {
    s: '<path d="M8 12 L13 3.5 L18.5 11 L24 2.5 L29.5 11 L35 3.5 L40 12 Z"/>' + BOXB,
    a: p('M8 12 L13 3.5 L18.5 11 L24 2.5 L29.5 11 L35 3.5 L40 12 Z', '#ffd23a', 2) + box('#ff4fa3', '#ff9fd0', r(21, 10, 6, 32, 1, '#ffd23a', 2) + p('M24 24 L29 30 L24 37 L19 30 Z', '#74dcff', 1.8)),
  },
  passpt: { s: '<circle cx="24" cy="24" r="16.5"/>', a: c(24, 24, 16.5, '#ff6fb5', 2) + '<circle cx="24" cy="24" r="12" style="fill:none;stroke:#ffb3d8;stroke-width:2.2px"/>' + p(S8, '#fffaf0', 1.6) + hl('M12.5 19 A12 12 0 0 1 18 12.5', 2.6) },
  cube: {
    s: '<path d="M24 6 L40 15 V33 L24 42 L8 33 V15 Z"/>',
    a: p('M24 6 L40 15 L24 24 L8 15 Z', '#a8ffb8') + p('M8 15 L24 24 V42 L8 33 Z', '#3ed36a') + p('M40 15 L24 24 V42 L40 33 Z', '#20a04a') + ln('M8 15 L24 24 L40 15 M24 24 V42', 1.8) + p('M17 24.5 L13 31.5 H16 L14.5 37 L20 29.5 H17 L18.5 24.5 Z', '#fffaf0'),
  },
  meteor: {
    s: `<path d="${METEOR_T}"/><circle cx="20" cy="29" r="13.5"/>`,
    a: p(METEOR_T, '#ff8a2a', 2) + p('M28.5 19.5 C32 13.5 36.5 9.5 41 7.5 C39.5 12 37.5 15 34 20 C36.5 20 38.5 20.5 40 21 C36 24.5 33 26 30 27 Z', '#ffd23a') + c(20, 29, 13.5, '#a98ad8', 2) + c(13.5, 23.5, 2.4, '#7d5fb8') + c(26.5, 36, 2.1, '#7d5fb8') + c(27, 23, 1.5, '#7d5fb8') + `<ellipse cx="16.5" cy="29" rx="1.8" ry="2.6" style="fill:@k"/><ellipse cx="23.5" cy="29" rx="1.8" ry="2.6" style="fill:@k"/>` + ln('M16.5 34 Q20 36.8 23.5 34', 2.2) + hl('M10.5 25 Q11.5 20 16 18.5', 2.6),
  },
  showdown: {
    s: `<ellipse cx="24" cy="41" rx="14" ry="3.6"/><path d="${CACT}"/><path d="${CACT_L}"/><path d="${CACT_R}"/>`,
    a: `<ellipse cx="24" cy="41" rx="14" ry="3.6" style="fill:#e8b86a"/>` + p(CACT_L, '#47d24a', 2) + p(CACT_R, '#47d24a', 2) + p(CACT, '#5fe05a', 2) + ln('M22 12 V16 M26 22 V26 M22 31 V35', 1.6, '#2a9a3a') + c(21.5, 20, 1.6, '@k') + c(26.5, 20, 1.6, '@k') + ln('M21.5 24.5 Q24 26.5 26.5 24.5', 1.8) + p('M24 3.5 L25.6 6.5 L29 7 L26.5 9 L27 12 L24 10.5 L21 12 L21.5 9 L19 7 L22.4 6.5 Z', '#ff6fb5', 1.4),
  },
  knockout: {
    s: `<path d="${THUMB}"/><path d="${GLOVE}"/><rect x="15" y="33" width="16" height="10" rx="2.5"/>`,
    a: p(GLOVE, '#ff8a2a', 2) + p(THUMB, '#ff8a2a', 2) + r(15, 33, 16, 10, 2.5, '#fffaf0', 2) + ln('M22.5 17 C26.5 15 31.5 15.5 34.5 18.5', 2.2) + hl('M16 16 Q18 11.5 23 10.5', 2.6),
  },
  training: {
    s: '<circle cx="24" cy="24" r="17"/>',
    a: c(24, 24, 17, '#fffaf0', 2) + c(24, 24, 12.5, '#44c4ff') + c(24, 24, 8, '#fffaf0') + c(24, 24, 3.8, '#44c4ff') + '<circle cx="24" cy="24" r="12.5" style="fill:none;stroke:@k;stroke-width:1.6px"/>' + hl('M11.5 19 A13 13 0 0 1 18 11.5', 2.4),
  },
  profile: {
    s: '<rect x="7" y="7" width="34" height="34" rx="9"/>',
    a: r(7, 7, 34, 34, 9, '#44c4ff', 2) + '<path d="M14 41 C14 33.5 18 29.5 24 29.5 C30 29.5 34 33.5 34 41 Z" style="fill:#fffaf0;stroke:@k;stroke-width:2px;stroke-linejoin:round"/>' + c(24, 20.5, 7.5, '#fffaf0', 2) + c(21.3, 20, 1.4, '@k') + c(26.7, 20, 1.4, '@k'),
  },
  back: { s: '<path d="M5 24 L22 7 V16.5 H41 V31.5 H22 V41 Z"/>', a: p('M5 24 L22 7 V16.5 H41 V31.5 H22 V41 Z', '#ffffff') },
  close: { s: '<path d="M11 5 L24 18 L37 5 L43 11 L30 24 L43 37 L37 43 L24 30 L11 43 L5 37 L18 24 L5 11 Z"/>', a: p('M11 5 L24 18 L37 5 L43 11 L30 24 L43 37 L37 43 L24 30 L11 43 L5 37 L18 24 L5 11 Z', '#ffffff') },
  info: { s: '<circle cx="24" cy="24" r="17"/>', a: c(24, 24, 17, '#44c4ff', 2) + c(24, 14.5, 3.2, '#fffaf0') + r(20.8, 20.5, 6.4, 15, 3, '#fffaf0') },
  share: {
    s: '<path d="M9 19 H18 V25 H15 V37 H33 V25 H30 V19 H39 V43 H9 Z"/><path d="M24 3 L35 14 H28.5 V29 H19.5 V14 H13 Z"/>',
    a: p('M9 19 H18 V25 H15 V37 H33 V25 H30 V19 H39 V43 H9 Z', '#fffaf0', 2) + p('M24 3 L35 14 H28.5 V29 H19.5 V14 H13 Z', '#c6ff3a', 2),
  },
  copy: {
    s: '<rect x="16" y="5" width="24" height="29" rx="4"/><rect x="8" y="14" width="24" height="29" rx="4"/>',
    a: r(16, 5, 24, 29, 4, '#d6deec', 2) + r(8, 14, 24, 29, 4, '#fffaf0', 2) + ln('M13.5 23 H26.5 M13.5 29 H26.5 M13.5 35 H21', 2.2, '#9fb0c4'),
  },
  dice: {
    s: '<rect x="8" y="8" width="32" height="32" rx="8" transform="rotate(-8 24 24)"/>',
    a: `<g transform="rotate(-8 24 24)">` + r(8, 8, 32, 32, 8, '#fffaf0', 2) + c(16, 16, 3, '@k') + c(32, 16, 3, '@k') + c(24, 24, 3, '@k') + c(16, 32, 3, '@k') + c(32, 32, 3, '@k') + `</g>`,
  },
  refresh: {
    s: `<path d="${REFR}"/><path d="M30 20 L45 15 L41 29 Z"/>`,
    a: p(REFR, '#c6ff3a') + p('M30 20 L45 15 L41 29 Z', '#c6ff3a') + hl('M12 20 A13 13 0 0 1 19 12', 2.4),
  },
  exit: {
    s: '<rect x="7" y="6" width="22" height="36" rx="4"/><path d="M25 17.5 H33 V11 L44 24 L33 37 V30.5 H25 Z"/>',
    a: r(7, 6, 22, 36, 4, '#ff8a2a', 2) + r(11, 10, 14, 28, 2, '#ffb36b') + c(22, 25, 1.8, '@k') + p('M25 17.5 H33 V11 L44 24 L33 37 V30.5 H25 Z', '#fffaf0', 2),
  },
  cloud: { s: `<path d="${CLOUD}"/>`, a: p(CLOUD, '#fffaf0', 2) + ln('M17.5 27.5 L22.5 32 L31 23', 3.4, '#1f9a2c') + hl('M10 28 Q10.5 25 13.5 24.5', 2.2) },
  cloudoff: { s: `<path d="${CLOUD}"/>`, a: p(CLOUD, '#e3dccb', 2) + ln('M18.5 23 L30 34 M30 23 L18.5 34', 3.4, '#c2303a') },
  cloudsync: { s: `<path d="${CLOUD}"/>`, a: p(CLOUD, '#fffaf0', 2) + c(18, 29, 2.4, '#44c4ff') + c(24.5, 29, 2.4, '#44c4ff') + c(31, 29, 2.4, '#44c4ff') },
  sound: {
    s: '<path d="M6 18 H14 L25 9 V39 L14 30 H6 Z"/><path d="M30 16.5 C34.5 20 34.5 28 30 31.5 L27.5 28.5 C30 26 30 22 27.5 19.5 Z"/><path d="M35.5 10.5 C43 17 43 31 35.5 37.5 L33 34.5 C38.5 29 38.5 19 33 13.5 Z"/>',
    a: p('M6 18 H14 L25 9 V39 L14 30 H6 Z', '#fffaf0', 2) + p('M30 16.5 C34.5 20 34.5 28 30 31.5 L27.5 28.5 C30 26 30 22 27.5 19.5 Z', '#44c4ff') + p('M35.5 10.5 C43 17 43 31 35.5 37.5 L33 34.5 C38.5 29 38.5 19 33 13.5 Z', '#44c4ff') + ln('M14 18.5 V29.5', 1.8),
  },
  music: {
    s: `<path d="${NOTE}"/><ellipse cx="14" cy="35" rx="7.5" ry="6"/><ellipse cx="33" cy="31" rx="7.5" ry="6"/>`,
    a: p(NOTE, '#8d5bff', 2) + `<ellipse cx="14" cy="35" rx="7.5" ry="6" style="fill:#8d5bff;stroke:@k;stroke-width:2px"/><ellipse cx="33" cy="31" rx="7.5" ry="6" style="fill:#8d5bff;stroke:@k;stroke-width:2px"/>` + hl('M10 33 Q11 30.5 14 30', 2.2) + hl('M29 29 Q30 26.5 33 26', 2.2),
  },
  vibro: {
    s: '<rect x="15" y="5" width="18" height="38" rx="5"/><rect x="6" y="16" width="5" height="16" rx="2.5"/><rect x="37" y="16" width="5" height="16" rx="2.5"/><rect x="1" y="20" width="3.5" height="8" rx="1.75"/><rect x="43.5" y="20" width="3.5" height="8" rx="1.75"/>',
    a: r(6, 16, 5, 16, 2.5, '#ff6fb5') + r(37, 16, 5, 16, 2.5, '#ff6fb5') + r(1, 20, 3.5, 8, 1.75, '#ff6fb5') + r(43.5, 20, 3.5, 8, 1.75, '#ff6fb5') + r(15, 5, 18, 38, 5, '#fffaf0', 2) + r(18.5, 9.5, 11, 25, 2, '#44c4ff') + c(24, 38.5, 1.7, '@k'),
  },
  graphics: { s: `<path d="${PAL}"/>`, a: p(PAL, '#fffaf0', 2) + c(16, 19, 3.4, '#ff6fb5', 1.6) + c(24.5, 14.5, 3.4, '#ffd23a', 1.6) + c(33, 18.5, 3.4, '#44c4ff', 1.6) + c(14.5, 28.5, 3.4, '#c6ff3a', 1.6) + c(22, 33.5, 2.8, '#d6deec', 1.6) },
  hints: {
    s: '<circle cx="24" cy="19" r="13.5"/><rect x="17.5" y="29" width="13" height="13" rx="3"/>',
    a: c(24, 19, 13.5, '#ffd23a', 2) + r(17.5, 29, 13, 13, 3, '#d6deec', 2) + ln('M18 35.5 H30', 2) + ln('M19.5 21.5 L22 18.5 L25 21.5 L28 18.5', 2.2, '#c97a00') + hl('M14.5 16 A9.5 9.5 0 0 1 19.5 10', 2.6),
  },
  lessmotion: {
    s: `<path d="${SNAIL}"/><circle cx="26" cy="21.5" r="12.5"/><rect x="7.5" y="16" width="3" height="12" rx="1.5"/><circle cx="9" cy="15" r="3.6"/>`,
    a: r(7.5, 16, 3, 12, 1.5, '#c6ff3a') + p(SNAIL, '#c6ff3a', 2) + c(26, 21.5, 12.5, '#ff8a2a', 2) + ln('M26 22 C26 19.5 29.5 19.5 29.5 22.5 C29.5 26.5 23 27 21.5 22.5 C20 17.5 26 13.5 31.5 16.5', 2.2) + c(9, 15, 3.6, '#fffaf0', 1.8) + c(9.6, 15, 1.5, '@k'),
  },
  attack: { s: `<path d="${BURST}"/>`, a: p(BURST, '#ff8a2a', 2) + `<path d="${BURST}" transform="translate(24 24) scale(.55) translate(-24 -24)" style="fill:#ffd23a"/>` },
  super: { s: `<path d="${BOLT}"/>`, a: p(BOLT, '#ffd23a') + p('M26 19 H38 L17 44 L21 27 Z', '#f2b200') + hl('M23.5 10 L15.5 24', 2.4) },
  emote: { s: `<path d="${BUBBLE}"/>`, a: p(BUBBLE, '#fffaf0', 2) + c(17.5, 19.5, 2.2, '@k') + c(30.5, 19.5, 2.2, '@k') + ln('M16.5 25 Q24 31 31.5 25', 2.4) },
  pause: { s: '<rect x="11" y="7" width="10" height="34" rx="3"/><rect x="27" y="7" width="10" height="34" rx="3"/>', a: r(11, 7, 10, 34, 3, '#fffaf0') + r(27, 7, 10, 34, 3, '#fffaf0') },
  ko: {
    s: `<circle cx="24" cy="27" r="15"/><path d="${SPKS(10, 9, 6)}"/><path d="${SPKS(38, 8, 5)}"/>`,
    a: c(24, 27, 15, '#d6deec', 2) + ln('M15.5 22 L20.5 27 M20.5 22 L15.5 27 M27.5 22 L32.5 27 M32.5 22 L27.5 27', 2.4) + ln('M19 34.5 Q24 31 29 34.5', 2.4) + p(SPKS(10, 9, 6), '#ffd23a') + p(SPKS(38, 8, 5), '#ffd23a'),
  },
  timer: {
    s: '<circle cx="24" cy="27" r="16"/><rect x="19.5" y="3" width="9" height="7" rx="2"/><rect x="21.5" y="8" width="5" height="5"/>',
    a: r(21.5, 8, 5, 5, 0, '#d6deec', 2) + r(19.5, 3, 9, 7, 2, '#ff8a2a', 2) + c(24, 27, 16, '#fffaf0', 2) + `<path d="M24 27 L24 15.5 A11.5 11.5 0 0 1 35.5 27 Z" style="fill:#c6ff3a"/>` + ln('M24 27 V16 M24 27 L31 31', 2.8) + c(24, 27, 2.2, '@k'),
  },
  poison: {
    s: `<path d="${CLOUD}"/>`,
    a: p(CLOUD, '#9be35a', 2) + c(14, 33, 3.2, '#7cc93f') + c(35, 27, 2.6, '#7cc93f') + c(28, 16.5, 2.2, '#bdf28a') + ln('M16.5 25.5 L20 27.5 L16.5 29.5 M31.5 25.5 L28 27.5 L31.5 29.5', 2.2) + ln('M20 33.5 Q22 32 24 33.5 Q26 35 28 33.5', 2),
  },
  infect: {
    s: '<circle cx="24" cy="24" r="12.5"/>' + GERM_A.map((a) => `<circle cx="${gx(a)}" cy="${gy(a)}" r="3.6"/><rect x="22.6" y="7" width="2.8" height="10" transform="rotate(${a + 90} 24 24)"/>`).join(''),
    a: GERM_A.map((a) => r(22.6, 7, 2.8, 10, 0, '#b48cff', 0, `rotate(${a + 90} 24 24)`) + c(gx(a), gy(a), 3.6, '#b48cff')).join('') + c(24, 24, 12.5, '#8d5bff', 2) + c(20, 22, 3, '#fffaf0', 1.6) + c(20.6, 22.4, 1.3, '@k') + c(28, 22, 3, '#fffaf0', 1.6) + c(28.6, 22.4, 1.3, '@k') + ln('M20 28.5 Q24 31.5 28 28.5', 2),
  },
  timestop: {
    s: '<circle cx="24" cy="24" r="17"/>',
    a: c(24, 24, 17, '#44c4ff', 2) + c(24, 24, 12.5, '#fffaf0') + r(18.8, 17, 3.8, 14, 1.6, '@k') + r(25.4, 17, 3.8, 14, 1.6, '@k') + ln('M24 9.5 V12 M24 36 V38.5 M9.5 24 H12 M36 24 H38.5', 2) + hl('M11 19 A13.5 13.5 0 0 1 17.5 11', 2.4),
  },
  hp: { s: `<path d="${HEART}"/>`, a: p(HEART, '#ff4f6d') + `<path d="M24 41 C34 34 42 27 42 18 C42 14 40 11 37 9.5 C39 18 33 30 24 37 Z" style="fill:#e0304f"/>` + hl('M11.5 16.5 Q12.5 12 17 11.5', 2.6) },
  damage: {
    s: '<circle cx="21" cy="28" r="14"/><rect x="24" y="9" width="10" height="9" rx="2" transform="rotate(35 29 13.5)"/><path d="' + SPKS(41, 6, 5) + '"/>',
    a: r(24, 9, 10, 9, 2, '#d6deec', 2, 'rotate(35 29 13.5)') + c(21, 28, 14, '#5a5470', 2) + ln('M32 10 Q35 5 39 6.5', 2.4) + p(SPKS(41, 6, 5), '#ffd23a') + hl('M12 24 Q13 18.5 18 17', 2.8),
  },
  speed: {
    s: `<path d="${SHOE}"/>`,
    a: p(SHOE, '#44c4ff', 2) + p('M6 34 H44 V35 C44 37.5 43 39 41 39 H9 C7 39 6 38 6 36 Z', '#fffaf0', 2) + ln('M21.5 21 L25.5 23.5 M23.5 17 L27.5 19.5', 2) + c(37, 29, 2, '#fffaf0'),
  },
  range: {
    s: '<path d="M5 39 L32 12 L36 16 L9 43 Z"/><path d="M28 8 L42 6 L40 20 Z"/><path d="M4 33 L10 39 L5 44 L1 40 Z"/>',
    a: p('M5 39 L32 12 L36 16 L9 43 Z', '#d6deec', 1.6) + p('M28 8 L42 6 L40 20 Z', '#ff8a2a', 2) + p('M4 33 L10 39 L5 44 L1 40 Z', '#ff6fb5', 1.6),
  },
  reload: {
    s: `<path d="${GLASS}"/><rect x="9" y="3" width="30" height="6" rx="3"/><rect x="9" y="39" width="30" height="6" rx="3"/>`,
    a: p(GLASS, '#fffaf0', 2) + p('M15 11 H33 C33 15 28 18 24 21 C20 18 15 15 15 11 Z', '#ffd23a') + p('M24 31 C28 33 33 35.5 33 39 H15 C15 35.5 20 33 24 31 Z', '#ffd23a') + r(9, 3, 30, 6, 3, '#ff8a2a', 2) + r(9, 39, 30, 6, 3, '#ff8a2a', 2),
  },
  supercharge: {
    s: '<circle cx="24" cy="24" r="17"/>',
    a: c(24, 24, 17, '#8d5bff', 2) + `<path d="M24 24 L24 7 A17 17 0 1 1 9.3 32.5 Z" style="fill:#ffd23a"/>` + c(24, 24, 11.5, '#2b1f5a', 2) + p('M26 13.5 L17 26 H23 L21.5 34.5 L31 22 H25 Z', '#ffd23a', 1.6),
  },
  eye: {
    s: '<path d="M4 24 C12 11 36 11 44 24 C36 37 12 37 4 24 Z"/>',
    a: p('M4 24 C12 11 36 11 44 24 C36 37 12 37 4 24 Z', '#fffaf0', 2) + c(24, 24, 7.5, '@k') + c(26.5, 21.5, 2.4, '#fffaf0'),
  },
  robot: {
    s: '<rect x="8" y="13" width="32" height="27" rx="8"/><rect x="21.5" y="4" width="5" height="10"/><circle cx="24" cy="5" r="4"/>',
    a: r(21.5, 6, 5, 9, 1, '#9fb0c4', 2) + c(24, 5.5, 3.8, '#ff4b55', 2) + r(8, 13, 32, 27, 8, '#d6deec', 2) + r(13, 19, 22, 11, 4, '#14121f') + r(16, 22, 5, 5, 1.5, '#5ef0c8') + r(27, 22, 5, 5, 1.5, '#5ef0c8') + ln('M19 35 H29', 2.4) + hl('M12.5 21 Q13 17 16.5 16.5', 2.4),
  },
  wifi: {
    s: '<path d="M4 18 C15 7 33 7 44 18 L38 24 C30 16 18 16 10 24 Z"/><path d="M14 28 C20 22 28 22 34 28 L28 34 C26 32 22 32 20 34 Z"/><circle cx="24" cy="39" r="4.5"/>',
    a: p('M4 18 C15 7 33 7 44 18 L38 24 C30 16 18 16 10 24 Z', '#44c4ff', 2) + p('M14 28 C20 22 28 22 34 28 L28 34 C26 32 22 32 20 34 Z', '#44c4ff', 2) + c(24, 39, 4.5, '#44c4ff', 2),
  },
});

// ── эмоции: свои стикеры вместо эмодзи (порядок совпадает с номерами эмоций в сохранении) ──
const FACE = '<circle cx="24" cy="24" r="17.5"/>';
const face = (fill: string) => c(24, 24, 17.5, fill, 2) + hl('M12 19 A13 13 0 0 1 18.5 11.5', 2.6);
const eyes = (y = 21) => el(18.5, y, 2.2, 3, '@k') + el(29.5, y, 2.2, 3, '@k');
const FIRE = 'M24 4 C27 12 37 16 37 28 C37 37 31 43 24 43 C17 43 11 37 11 28 C11 21 15 17 18 13 C19 18 21 20 23 21 C22 15 22 9 24 4 Z';
const ARM = 'M7 40 C7 33 10 29 16 28 L21 18 C19 15 20 9 26 8 C32 7 35 12 33 17 L30 23 C37 22 42 27 42 33 C42 39 37 42 31 42 H10 C8 42 7 41 7 40 Z';
const HAT = 'M24 1 L32 17 H16 Z';
Object.assign(G, {
  e_happy: { s: FACE, a: face('#ffd23a') + eyes() + p('M14.5 27 Q24 40 33.5 27 Z', '@k', 1.6) + p('M19 33.5 Q24 36.5 29 33.5 Q24 31 19 33.5 Z', '#ff6f8a') },
  e_like: {
    s: '<rect x="13" y="20" width="27" height="22" rx="6"/><rect x="15" y="4" width="11" height="22" rx="5.5"/><rect x="5" y="21" width="9" height="20" rx="3"/>',
    a: r(5, 21, 9, 20, 3, '#44c4ff', 2) + r(15, 4, 11, 22, 5.5, '#ffd23a', 2) + r(13, 20, 27, 22, 6, '#ffd23a', 2) + ln('M26 27 H38 M26 33 H38', 2) + hl('M17.5 9 V17', 2.4),
  },
  e_sad: { s: FACE, a: face('#7fd0ff') + ln('M14 16 L21 18.5 M34 16 L27 18.5', 2.4) + eyes(22.5) + ln('M17 34 Q24 28 31 34', 2.6) + p('M33 24 C35 28 37 30 35 32.5 C33.5 34 31 33 31 30.5 C31 28.5 32 27 33 24 Z', '#44c4ff', 1.6) },
  e_angry: { s: FACE, a: face('#ff6a5a') + ln('M13 15 L21.5 20 M35 15 L26.5 20', 3) + eyes(23.5) + p('M16 34.5 Q24 27 32 34.5 Z', '@k', 1.6) + r(19, 31.5, 10, 2.6, 1, '#fffaf0') },
  e_cool: { s: FACE, a: face('#ffd23a') + p('M9 17 H39 V20 C39 25.5 35 27.5 31 27.5 C27.5 27.5 25.5 25 24.5 22 H23.5 C22.5 25 20.5 27.5 17 27.5 C13 27.5 9 25.5 9 20 Z', '#14121f') + hl('M12.5 20 L15.5 18.5', 2) + hl('M27.5 20 L30.5 18.5', 2) + ln('M18 33 Q25 37.5 31 31.5', 2.6) },
  e_lol: { s: FACE, a: face('#ffd23a') + ln('M14.5 20 L19.5 17.5 L14.5 15.5 M33.5 20 L28.5 17.5 L33.5 15.5', 2.4) + p('M13 25 Q24 43 35 25 Z', '@k', 1.6) + p('M19 33 Q24 37 29 33 Q24 30.5 19 33 Z', '#ff6f8a') + p('M8 22 C5.5 25 4.5 28 7 29.5 C9 30.5 10.5 28.5 10 26 Z', '#44c4ff', 1.4) + p('M40 22 C42.5 25 43.5 28 41 29.5 C39 30.5 37.5 28.5 38 26 Z', '#44c4ff', 1.4) },
  e_party: {
    s: FACE + `<path d="${HAT}"/>`,
    a: c(24, 26, 17, '#ff6fb5', 2) + p(HAT, '#c6ff3a', 2) + c(24, 2, 2.6, '#ffd23a', 1.4) + ln('M19.5 11 L28.5 11', 2, '#ff8a2a') + eyes(24) + ln('M17 30.5 Q24 37 31 30.5', 2.6) + r(6, 8, 4, 4, 1, '#44c4ff', 0, 'rotate(20 8 10)') + r(38, 11, 4, 4, 1, '#ffd23a', 0, 'rotate(-25 40 13)') + c(41, 33, 2, '#c6ff3a'),
  },
  e_robot: { s: G.robot?.s ?? '', a: G.robot?.a ?? '' },
  e_fire: { s: `<path d="${FIRE}"/>`, a: p(FIRE, '#ff8a2a', 2) + p('M24 18 C27 24 32 27 32 33 C32 38.5 28.5 41 24 41 C19.5 41 16 38.5 16 33.5 C16 28 21 25 24 18 Z', '#ffd23a') + el(20.5, 32, 1.7, 2.4, '@k') + el(27.5, 32, 1.7, 2.4, '@k') + ln('M21.5 37 Q24 38.8 26.5 37', 1.8) },
  e_strong: { s: `<path d="${ARM}"/>`, a: p(ARM, '#ffb36b', 2) + ln('M21 18 C24 20 27 19 29 16', 2, '#c97a3a') + ln('M18 34 C22 30 28 30 31 34', 2.2, '#c97a3a') + hl('M12 33 Q13 30 16 29.5', 2.4) },
  e_germ: { s: G.infect?.s ?? '', a: G.infect?.a ?? '' },
  e_star: { s: G.star?.s ?? '', a: G.star?.a ?? '', x: 4 },
});

// редкости: цвет + форма
const R: Record<string, [string, string]> = {
  r1: ['<circle cx="24" cy="24" r="14"/>', '#b8cde0'],
  r2: ['<path d="M24 7 L41 24 L24 41 L7 24 Z"/>', '#2fd8b6'],
  r3: ['<path d="M24 7 L42 38 H6 Z"/>', '#3f8cff'],
  r4: ['<path d="M24 6 L39.6 15 V33 L24 42 L8.4 33 V15 Z"/>', '#b45cff'],
  r5: ['<path d="M24 4 L29.5 18.5 L44 24 L29.5 29.5 L24 44 L18.5 29.5 L4 24 L18.5 18.5 Z"/>', '#ff3d7f'],
  r6: ['<path d="M7 16 L16 24 L24 10 L32 24 L41 16 L37 38 H11 Z"/>', '#ffc21a'],
};
for (const [n, [s, col]] of Object.entries(R)) G[n] = { s, a: s.replace('/>', ` style="fill:${col}"/>`) };

/** Все имена глифов (для проверок и выбора аватара). */
export const ICON_NAMES = Object.keys(G);

let installed = false;
/** Вставить спрайт в документ (один раз). */
export function installIcons() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  let defs = '', syms = '';
  for (const [n, g] of Object.entries(G)) {
    defs += `<g id="gi-${n}-s">${g.s}</g>`;
    const x = g.x || 0;
    for (const [tn, t] of Object.entries(T)) {
      const lay = (col: string, w: number, tr?: string) => `<use href="#gi-${n}-s"${tr ? ` transform="${tr}"` : ''} style="fill:${col};stroke:${col};stroke-width:${w + x}px;stroke-linejoin:round"/>`;
      syms += `<symbol id="gi-${tn}-${n}" viewBox="0 0 48 48" style="overflow:visible">` +
        (t.sh ? lay(t.sh, t.ow, 'translate(2 3)') : '') + (t.ow ? lay(t.o, t.ow) : '') + lay(t.k, t.sw) +
        g.a.split('@k').join(t.k) + '</symbol>';
    }
  }
  const d = document.createElement('div');
  d.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" id="gi-sprite" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"><defs>${defs}</defs>${syms}</svg>`;
  document.body.insertBefore(d.firstElementChild!, document.body.firstChild);
}

const NS = 'http://www.w3.org/2000/svg';
/** Иконка из спрайта. cls — классы для размера и положения (размер задаёт CSS). */
export function icon(name: string, t: IconTreatment = 'a', cls = ''): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'gi' + (cls ? ' ' + cls : ''));
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', `#gi-${t}-${name}`);
  svg.appendChild(use);
  return svg;
}

/** То же строкой — для innerHTML в часто обновляемых местах (HUD). */
export const iconHtml = (name: string, t: IconTreatment = 'a', cls = '') =>
  `<svg class="gi${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#gi-${t}-${name}"></use></svg>`;

/** Значки сторон в бою: свой — кольцо, союзник — треугольник, враг — ромб. Цвет + форма. */
export const SIDE_SHAPE = {
  ally: 'M3 3 H27 L15 23 Z',
  enemy: 'M15 2 L19 9 L28 15 L19 21 L15 28 L11 21 L2 15 L11 9 Z',
  self: 'M15 3 A12 12 0 1 1 14.99 3 Z',
  square: 'M4 4 H26 V26 H4 Z',
};
export function sideShape(kind: keyof typeof SIDE_SHAPE, fill: string, cls = '') {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 30 30');
  svg.setAttribute('class', 'side-shape' + (cls ? ' ' + cls : ''));
  svg.innerHTML = `<path d="${SIDE_SHAPE[kind]}" style="fill:${fill};stroke:#14121f;stroke-width:3.5px;stroke-linejoin:round"></path>`;
  return svg;
}
export const sideShapeHtml = (kind: keyof typeof SIDE_SHAPE, fill: string, cls = '') =>
  `<svg viewBox="0 0 30 30" class="side-shape${cls ? ' ' + cls : ''}"><path d="${SIDE_SHAPE[kind]}" style="fill:${fill};stroke:#14121f;stroke-width:3.5px;stroke-linejoin:round"></path></svg>`;
