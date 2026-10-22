// Описание скина. Новый скин — это один объект в файле skins.ts героя (см. docs/НОВЫЙ_СКИН.md).
export interface SkinDef {
  /** Уникален в пределах героя. 'default' — обычный вид. */
  id: string;
  heroId: string;
  name: string;
  /** Цена. 0 — бесплатно или выдаётся наградой. */
  price: number;
  /** Чем платить: кристаллы (скины) или блинги (цветовые вариации). */
  currency: 'gems' | 'bling';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  /** Эксклюзив: нельзя купить, только получить ('pass' — финальная награда пропуска). */
  exclusive?: 'pass';
  /** Перекраска модели: ключи палитры героя (см. *_PALETTE в model.js). */
  palette?: Record<string, number>;
  /** Цвет снарядов (на рендер смайликов и бактерий). */
  shotColor?: number;
  /** Высота звука выстрела (1 — обычная). */
  sfxPitch?: number;
  /** Цвет карточки в магазине. */
  cardColor: string;
  /** Короткое описание для магазина. */
  desc: string;
  /** Файл модели GLB вместо процедурной (по желанию), путь от public/. */
  glb?: string;
  /**
   * Спортивная коллекция (id скина — 'basketball', 'football' или 'baseball'): цвета формы и номер на спине.
   * Мяч, биту, кепку и повязку герой надевает сам (src/render/sport.ts).
   */
  kit?: { main: number; accent: number; number: string };
}
