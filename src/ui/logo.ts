// Логотип «Игра странностей»: словесный знак (загрузка, приветствие) и компактный знак «Странняшка» (аватар, иконка).
const INK = '#14121f', PAPER = '#fffaf0', SH = 'rgba(4,38,44,.6)';
const COLS = ['#ffd23a', '#ff6fb5', '#5ef0c8', '#44c4ff', '#ff8a2a', '#c6ff3a', null, '#ff6fb5', '#ffd23a', '#44c4ff', '#ff8a2a'];
const F = "'Shantell Sans', 'Comic Sans MS', cursive";

let measure: CanvasRenderingContext2D | null = null;
const adv = (ch: string, size: number) => {
  measure ??= document.createElement('canvas').getContext('2d')!;
  measure.font = `800 ${size}px ${F}`;
  return measure.measureText(ch).width;
};

/** Полный словесный знак: лаймовая плашка «ИГРА» и разноцветные буквы «СТРАННОСТЕЙ» с глазом вместо «О». */
export function logoFull(): string {
  const word = 'СТРАННОСТЕЙ', size = 112, gap = -7;
  const rot = [-6, 4, -3, 5, -4, 3, 0, -5, 4, -3, 5], dy = [0, -7, 4, -4, 6, -2, 0, 5, -5, 3, -4];
  const top = 92, base = top + size * 0.78;
  let x = 30;
  const L = [...word].map((ch, i) => { const w = adv(ch, size); const o = { ch, i, x, w, cx: x + w / 2 }; x += w + gap; return o; });
  const W = x - gap + 34, H = base + 46;
  type Lt = (typeof L)[number];
  const t = (o: Lt, extra: string) => `<text x="${o.x.toFixed(1)}" y="${(base + dy[o.i]).toFixed(1)}" transform="rotate(${rot[o.i]} ${o.cx.toFixed(1)} ${(base - size * 0.35).toFixed(1)})" font-family="${F}" font-weight="800" font-size="${size}" ${extra}>${o.ch}</text>`;
  const eyeO = L[6], ex = eyeO.cx, ey = base - size * 0.36, er = size * 0.36;
  const eye = (fill: string, stroke: string, sw: number) => `<circle cx="${ex}" cy="${ey}" r="${er}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const tag = `<g transform="rotate(-6 120 46)"><rect x="28" y="8" width="190" height="74" rx="20" fill="#c6ff3a" stroke="${INK}" stroke-width="5"/><text x="123" y="64" text-anchor="middle" font-family="${F}" font-weight="800" font-size="56" fill="${INK}">ИГРА</text></g>`;
  const tagSh = `<g transform="translate(6 8) rotate(-6 120 46)"><rect x="28" y="8" width="190" height="74" rx="20" fill="${SH}" stroke="${SH}" stroke-width="16"/></g><g transform="rotate(-6 120 46)"><rect x="28" y="8" width="190" height="74" rx="20" fill="${PAPER}" stroke="${PAPER}" stroke-width="16"/></g>`;
  const letters = L.filter((o) => o.i !== 6);
  const layer = (fill: string | null, stroke: string, sw: number, tr?: string) => `<g${tr ? ` transform="${tr}"` : ''} stroke-linejoin="round">${letters.map((o) => t(o, `fill="${fill || COLS[o.i]}" stroke="${stroke}" stroke-width="${sw}"`)).join('')}${eye(fill || '#ffffff', stroke, sw)}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block;overflow:visible">` +
    tagSh + layer(SH, SH, 26, 'translate(6 9)') + layer(PAPER, PAPER, 26) + layer(INK, INK, 12) + tag +
    `<g>${letters.map((o) => t(o, `fill="${COLS[o.i]}"`)).join('')}</g>` +
    `<circle cx="${ex}" cy="${ey}" r="${er}" fill="#ffffff"/><circle cx="${ex + er * 0.26}" cy="${ey - er * 0.2}" r="${er * 0.46}" fill="${INK}"/><circle cx="${ex + er * 0.42}" cy="${ey - er * 0.36}" r="${er * 0.14}" fill="#ffffff"/>` +
    `</svg>`;
}

const BLOB = 'M100 40 C140 38 166 64 164 104 C162 144 136 170 98 168 C58 166 34 140 36 102 C38 64 60 42 100 40 Z';
const STEM = 'M124 50 C128 38 136 30 146 27';
function markG(sw = 1) {
  const k = 12 * sw, o = 24 * sw;
  const shp = (fill: string, stroke: string, w: number) => `<path d="${STEM}" fill="none" stroke="${stroke}" stroke-width="${8 + w}" stroke-linecap="round"/><path d="${BLOB}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"/><circle cx="148" cy="26" r="12" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
  return `<g transform="translate(${8 * sw} ${11 * sw})">${shp(SH, SH, o)}</g>` + shp(PAPER, PAPER, o) + shp(INK, INK, k) +
    `<path d="${STEM}" fill="none" stroke="#c6ff3a" stroke-width="8" stroke-linecap="round"/><path d="${BLOB}" fill="#c6ff3a"/><circle cx="148" cy="26" r="12" fill="#ff6fb5"/>` +
    `<path d="M58 88 Q60 62 86 54" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity=".85"/>` +
    `<ellipse cx="58" cy="128" rx="10" ry="5.5" fill="#ff6fb5" opacity=".65"/><ellipse cx="144" cy="124" rx="9" ry="5" fill="#ff6fb5" opacity=".65"/>` +
    `<circle cx="76" cy="98" r="27" fill="#ffffff" stroke="${INK}" stroke-width="${6 * sw}"/><circle cx="84" cy="92" r="12" fill="${INK}"/><circle cx="88.5" cy="87" r="4" fill="#ffffff"/>` +
    `<circle cx="127" cy="95" r="17" fill="#ffffff" stroke="${INK}" stroke-width="${6 * sw}"/><circle cx="131" cy="99" r="7.5" fill="${INK}"/><circle cx="133.5" cy="96" r="2.6" fill="#ffffff"/>` +
    `<path d="M68 128 Q100 162 136 125 Q102 142 68 128 Z" fill="${INK}" stroke="${INK}" stroke-width="${5 * sw}" stroke-linejoin="round"/><rect x="95" y="134" width="12" height="10" rx="2" fill="#ffffff"/>`;
}
const wrap = (vb: string, inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block;overflow:visible">${inner}</svg>`;

/** Компактный знак «Странняшка» — лаймовая клякса с глазами. */
export const logoMark = () => wrap('-4 -4 208 208', markG());

const bg = (n: string, rr = 0) => `<defs><linearGradient id="gsbg${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14979e"/><stop offset=".48" stop-color="#0f7f86"/><stop offset="1" stop-color="#0a5864"/></linearGradient><pattern id="gsdot${n}" width="44" height="44" patternUnits="userSpaceOnUse"><circle cx="22" cy="22" r="4.5" fill="#ffffff" fill-opacity=".1"/></pattern></defs><rect width="1024" height="1024" rx="${rr}" fill="url(#gsbg${n})"/><rect width="1024" height="1024" rx="${rr}" fill="url(#gsdot${n})"/>`;
const place = (scale: number) => { const s = (scale * 1024) / 200, off = (1024 - 200 * s) / 2; return `<g transform="translate(${off.toFixed(1)} ${(off - (8 * s) / 2).toFixed(1)}) scale(${s.toFixed(3)})">${markG()}</g>`; };

/** Иконка приложения 1024×1024 без прозрачности; maskable — с запасом под маску. */
export const appIconSvg = (maskable = false) => wrap('0 0 1024 1024', bg(maskable ? 'm' : 'i') + place(maskable ? 0.6 : 0.74));
