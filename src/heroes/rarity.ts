// Редкость героев, скинов и Метеорчиков: название, цвет и форма-значок (цвет всегда идёт вместе с формой).
export type Rarity = 'common' | 'rare' | 'superrare' | 'epic' | 'mythic' | 'legendary';

export const RARITIES: Rarity[] = ['common', 'rare', 'superrare', 'epic', 'mythic', 'legendary'];

/** shape — глиф значка (круг, ромб, треугольник, шестиугольник, звезда, корона), ink — цвет текста на плашке. */
export const RARITY: Record<Rarity, { name: string; color: string; dark: string; shape: string; ink: string }> = {
  common: { name: 'Обычный', color: '#b8cde0', dark: '#6f8aa3', shape: 'r1', ink: '#14121f' },
  rare: { name: 'Редкий', color: '#2fd8b6', dark: '#13917a', shape: 'r2', ink: '#14121f' },
  superrare: { name: 'Сверхредкий', color: '#3f8cff', dark: '#1b4fa4', shape: 'r3', ink: '#ffffff' },
  epic: { name: 'Эпический', color: '#b45cff', dark: '#6a1fa8', shape: 'r4', ink: '#ffffff' },
  mythic: { name: 'Мифический', color: '#ff3d7f', dark: '#a0154a', shape: 'r5', ink: '#14121f' },
  legendary: { name: 'Легендарный', color: '#ffc21a', dark: '#b07a00', shape: 'r6', ink: '#14121f' },
};

/** Чем выше, тем реже. */
export const rarityRank = (r: Rarity) => RARITIES.indexOf(r);
