import { MAPS } from './maps';
import type { MapDef, ModeId } from './types';
import { GridMap, T } from '../core/grid';
export type { MapDef, ModeId, MapTheme } from './types';
export { MAPS };

const CHAR_TILE: Record<string, number> = {
  '#': T.Wall, '%': T.Crate, '"': T.Bush, '~': T.Water, '.': T.Floor,
  B: T.Floor, R: T.Floor, G: T.Floor, P: T.Box,
};

/** Разбирает ASCII-карту в сетку и списки особых точек. */
export function parseMap(def: MapDef): GridMap {
  const rows = def.ascii.split('\n').map((r) => r.replace(/\r/g, '')).filter((r) => r.length > 0);
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const m = new GridMap(w, h);
  m.id = def.id; m.name = def.name; m.theme = def.theme;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? '.';
      const t = CHAR_TILE[ch];
      if (t === undefined) throw new Error(`Карта ${def.id}: неизвестный символ «${ch}» в строке ${y + 1}`);
      m.set(x, y, t);
      if (ch === 'B') m.blueSpawns.push({ x: x + 0.5, y: y + 0.5 });
      if (ch === 'R') m.redSpawns.push({ x: x + 0.5, y: y + 0.5 });
      if (ch === 'G') m.mines.push({ x: x + 0.5, y: y + 0.5 });
      if (ch === 'P') m.boxes.push({ x, y });
    }
  }
  m.resetHp();
  m.version = 0;
  return m;
}

export function mapsForMode(mode: ModeId): MapDef[] {
  return MAPS.filter((m) => m.mode === mode);
}
export function mapById(id: string): MapDef {
  const m = MAPS.find((x) => x.id === id);
  if (!m) throw new Error('Нет карты ' + id);
  return m;
}
