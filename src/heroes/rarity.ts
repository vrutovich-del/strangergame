// Редкость героев, скинов и Старр-дропов: название и цвет, как в карточках магазина.
export type Rarity = 'common' | 'rare' | 'superrare' | 'epic' | 'mythic' | 'legendary';

export const RARITIES: Rarity[] = ['common', 'rare', 'superrare', 'epic', 'mythic', 'legendary'];

export const RARITY: Record<Rarity, { name: string; color: string; dark: string }> = {
  common: { name: 'Обычный', color: '#9fd8ff', dark: '#3c6f99' },
  rare: { name: 'Редкий', color: '#5ee05a', dark: '#1f8a2c' },
  superrare: { name: 'Сверхредкий', color: '#3fa9ff', dark: '#1b4fa4' },
  epic: { name: 'Эпический', color: '#c25cff', dark: '#6a1fa8' },
  mythic: { name: 'Мифический', color: '#ff4b55', dark: '#a01a28' },
  legendary: { name: 'Легендарный', color: '#ffd23f', dark: '#b07a00' },
};

/** Чем выше, тем реже. */
export const rarityRank = (r: Rarity) => RARITIES.indexOf(r);
