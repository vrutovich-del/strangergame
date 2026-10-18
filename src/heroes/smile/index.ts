// Смайл — стрелок средней дальности. Атака: очередь из 3 смайликов. Супер: 3 летающих помощника.
import type { Fighter, HeroDef, Minion, WorldApi } from '../../sim/types';
import { dist2, TAU } from '../../core/math';
import { SMILE } from './config';

const smile: HeroDef = {
  id: 'smile',
  name: 'Смайл',
  role: 'Стрелок средней дальности',
  description: 'Весёлый шар-смайлик. Всё время подпрыгивает и стреляет улыбками!',
  playable: true,
  order: 1,
  color: '#ffd23f',
  stats: {
    hp: SMILE.hp, speed: SMILE.speed, reload: SMILE.reload, superPerHit: SMILE.superPerHit,
    attackCooldown: SMILE.attackCooldown, damage: SMILE.bullet.damage, superDamage: SMILE.super.damage,
  },
  attackName: 'Смайлопуля',
  attackDesc: `Очередь из ${SMILE.bullet.count} смайликов по прямой.`,
  superName: 'Три смайла',
  superDesc: `${SMILE.super.helpers} летающих смайла ${SMILE.super.life} секунд сами ищут врагов и стреляют.`,
  attackAim: { shape: 'line', range: SMILE.bullet.range, width: 0.5 },
  superAim: { shape: 'throw', range: 3, width: 2.2 },
  ai: { range: 6, style: 'ranged' },

  attack(w: WorldApi, f: Fighter, angle: number) {
    const b = SMILE.bullet;
    for (let i = 0; i < b.count; i++) {
      w.schedule(i * b.interval, () => {
        if (!f.alive) return;
        w.spawnProjectile(f, {
          angle, speed: b.speed, range: b.range, damage: b.damage * f.dmgMul, radius: b.radius,
          kind: 'smile', superPerHit: SMILE.superPerHit, side: i === 1 ? 0.08 : -0.04,
        });
      });
    }
  },

  superAttack(w: WorldApi, f: Fighter, angle: number) {
    const s = SMILE.super;
    for (let i = 0; i < s.helpers; i++) {
      const a = angle + (i - 1) * 1.1;
      let x = f.x + Math.cos(a) * 1.1, y = f.y + Math.sin(a) * 1.1;
      x = Math.max(0.5, Math.min(w.map.w - 0.5, x));
      y = Math.max(0.5, Math.min(w.map.h - 0.5, y));
      w.spawnMinion(f, 'smile_helper', x, y, Math.round(s.hp * f.dmgMul), s.life, s.damage * f.dmgMul, s.range, i);
    }
  },

  updateMinion(w: WorldApi, m: Minion) {
    const s = SMILE.super;
    const owner = w.findById(m.ownerId);
    const team = m.team;
    // выбираем цель: каждый помощник старается взять свою
    let target: Fighter | Minion | undefined = w.findById(m.targetId) ?? w.minionById(m.targetId);
    const valid = (t: Fighter | Minion | undefined) => {
      if (!t || !t.alive) return false;
      if ('level' in t) {
        const f = t as Fighter;
        if (w.effTeam(f) === team || !w.isVisibleTo(f, team)) return false;
      } else if ((t as Minion).team === team) return false;
      return dist2(t.x, t.y, m.x, m.y) < s.seek * s.seek;
    };
    if (!valid(target) || Math.floor(w.time * 3) % 3 === m.slot) {
      const taken = new Set(w.minions.filter((o) => o !== m && o.ownerId === m.ownerId && o.alive).map((o) => o.targetId));
      const cands: (Fighter | Minion)[] = [];
      for (const f of w.fighters) if (valid(f)) cands.push(f);
      for (const o of w.minions) if (valid(o)) cands.push(o);
      cands.sort((a, b) => {
        const pa = taken.has(a.id) ? 40 : 0, pb = taken.has(b.id) ? 40 : 0;
        return dist2(a.x, a.y, m.x, m.y) + pa - (dist2(b.x, b.y, m.x, m.y) + pb);
      });
      const pick = cands[0];
      if (!valid(target) || (pick && !taken.has(pick.id) && taken.has(target!.id))) target = pick;
      m.targetId = target?.id ?? 0;
    }
    // движение: летают над стенами, держатся рядом с хозяином
    let gx: number, gy: number;
    const ox = owner?.alive ? owner.x : m.x, oy = owner?.alive ? owner.y : m.y;
    if (target && valid(target)) {
      const dx = m.x - target.x, dy = m.y - target.y, d = Math.hypot(dx, dy) || 1;
      const keep = s.range * 0.65;
      gx = target.x + (dx / d) * keep + Math.cos(w.time * 2 + m.slot * 2) * 0.6;
      gy = target.y + (dy / d) * keep + Math.sin(w.time * 2 + m.slot * 2) * 0.6;
      m.facing = Math.atan2(target.y - m.y, target.x - m.x);
    } else {
      const a = w.time * 1.6 + (m.slot * TAU) / 3;
      gx = ox + Math.cos(a) * 1.3; gy = oy + Math.sin(a) * 1.3;
      if (owner) m.facing = owner.facing;
    }
    // не улетать далеко от хозяина
    const fromOwner = Math.hypot(gx - ox, gy - oy);
    if (fromOwner > 6) { gx = ox + ((gx - ox) / fromOwner) * 6; gy = oy + ((gy - oy) / fromOwner) * 6; }
    const dx = gx - m.x, dy = gy - m.y, d = Math.hypot(dx, dy);
    const step = Math.min(d, s.speed * w.dt);
    if (d > 0.01) { m.x += (dx / d) * step; m.y += (dy / d) * step; }
    m.x = Math.max(0.4, Math.min(w.map.w - 0.4, m.x));
    m.y = Math.max(0.4, Math.min(w.map.h - 0.4, m.y));
    // стрельба
    if (target && valid(target) && w.time >= m.fireAt) {
      const td = Math.hypot(target.x - m.x, target.y - m.y);
      if (td <= s.range && w.map.lineClear(m.x, m.y, target.x, target.y)) {
        const a = Math.atan2(target.y - m.y, target.x - m.x);
        w.spawnProjectile(m, { angle: a, speed: 13, range: s.range + 0.5, damage: m.damage, radius: 0.15, kind: 'smile_mini', offset: 0.25 });
        m.fireAt = w.time + s.fireEvery;
        m.shotAt = w.time;
        w.emit({ t: 'shot', id: m.id, heroId: 'smile_helper', sup: false, x: m.x, y: m.y, a });
      }
    }
  },
};

export default smile;
