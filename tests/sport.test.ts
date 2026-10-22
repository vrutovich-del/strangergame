import { describe, expect, it } from 'vitest';
import { playableHeroes } from '../src/heroes/registry';
import { skinsOf } from '../src/heroes/skins';
import { ECONOMY, passRewards, passSportSkins } from '../src/meta/economy';
import { buyHero, buySkin, claimPass, ensureSeason, grant, heroPrice, ownsHero, ownsSkin } from '../src/meta/progress';
import { defaultSave } from '../src/meta/save';
import { isSport, SPORTS } from '../src/render/sport';

const NOW = new Date(2026, 9, 22, 12, 0, 0);

describe('спортивные скины', () => {
  it('у каждого героя есть баскетбольный, футбольный и бейсбольный скин с формой и номером', () => {
    for (const d of playableHeroes()) {
      const sport = skinsOf(d.id).filter((k) => isSport(k.id));
      expect(sport.map((k) => k.id)).toEqual(SPORTS);
      for (const k of sport) {
        expect(k.kit, `${d.id}:${k.id}`).toBeDefined();
        expect(k.kit!.number).toMatch(/^\d{1,2}$/);
        expect(k.exclusive).toBeUndefined();
        expect(k.currency).toBe('gems');
      }
    }
  });
  it('продаются за кристаллы', () => {
    const s = defaultSave();
    s.gems = 100;
    expect(buySkin(s, 'smile', 'basketball')).toBe(true);
    expect(s.gems).toBe(100 - 79);
    expect(ownsSkin(s, 'smile', 'basketball')).toBe(true);
  });
  it('в пропуске: футбол — бесплатно на 15 уровне, баскетбол и бейсбол — в премиуме на 8 и 22', () => {
    const r = passRewards(1);
    const sk = passSportSkins(1);
    expect(r.free[14]).toEqual(sk.football);
    expect(r.premium[7]).toEqual(sk.basketball);
    expect(r.premium[21]).toEqual(sk.baseball);
    // финал премиума — по-прежнему эксклюзив
    const last = r.premium[ECONOMY.pass.tiers - 1];
    expect(last.kind === 'skin' && skinsOf(last.heroId).find((k) => k.id === last.skinId)?.exclusive).toBe('pass');
  });
  it('каждый сезон спортивные скины достаются другим героям, и все такие скины существуют', () => {
    const heroes = (n: number) => Object.values(passSportSkins(n)).map((r) => (r.kind === 'skin' ? r.heroId : ''));
    expect(heroes(1)).not.toEqual(heroes(2));
    for (let n = 1; n <= 10; n++) {
      const list = Object.values(passSportSkins(n));
      expect(new Set(heroes(n)).size).toBe(3);
      for (const r of list) if (r.kind === 'skin') expect(skinsOf(r.heroId).some((k) => k.id === r.skinId)).toBe(true);
    }
  });
  it('скин из пропуска выдаётся, а если уже куплен — превращается в кристаллы', () => {
    const s = defaultSave();
    ensureSeason(s, NOW.getTime());
    s.pass.xp = ECONOMY.pass.xpPerTier * 30;
    const free15 = passRewards(s.pass.season).free[14];
    if (free15.kind !== 'skin') throw new Error('ожидался скин');
    expect(claimPass(s, 15, false)).toEqual([free15]);
    expect(ownsSkin(s, free15.heroId, free15.skinId)).toBe(true);
    const gems = s.gems;
    const again = grant(s, free15);
    expect(again[0].kind).toBe('gems');
    expect(s.gems).toBeGreaterThan(gems);
  });
});

describe('покупка героя за любую валюту', () => {
  it('можно купить за монеты, кристаллы или блинги — по цене редкости', () => {
    for (const cur of ['coins', 'gems', 'bling'] as const) {
      const s = defaultSave();
      const price = heroPrice('lion', cur);
      expect(price).toBe(ECONOMY.heroes.price.epic[cur]);
      s[cur] = price + 5;
      expect(buyHero(s, 'lion', cur)).toBe(true);
      expect(s[cur]).toBe(5);
      expect(ownsHero(s, 'lion')).toBe(true);
      expect(s.heroes.lion.level).toBe(1);
    }
  });
  it('без денег не купить, второй раз не купить', () => {
    const s = defaultSave();
    s.coins = heroPrice('bacteria', 'coins') - 1;
    expect(buyHero(s, 'bacteria', 'coins')).toBe(false);
    expect(ownsHero(s, 'bacteria')).toBe(false);
    s.coins += 1;
    expect(buyHero(s, 'bacteria', 'coins')).toBe(true);
    s.coins = 99999;
    expect(buyHero(s, 'bacteria', 'coins')).toBe(false);
    expect(buyHero(s, 'smile', 'coins')).toBe(false); // Смайл есть с самого начала
    expect(buyHero(s, 'robo_tank', 'coins')).toBe(false); // роботов не продают
  });
  it('чем реже герой, тем дороже в любой валюте', () => {
    const order = ['common', 'rare', 'superrare', 'epic', 'mythic', 'legendary'] as const;
    for (const cur of ['coins', 'gems', 'bling'] as const) {
      for (let i = 1; i < order.length; i++) expect(ECONOMY.heroes.price[order[i]][cur]).toBeGreaterThan(ECONOMY.heroes.price[order[i - 1]][cur]);
    }
  });
});
