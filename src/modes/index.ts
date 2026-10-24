import type { ModeId } from '../maps/types';
import { GemGrab } from './gemgrab';
import { Knockout } from './knockout';
import { Showdown } from './showdown';
import { Training } from './training';
import type { ModeRules } from './types';

export function createMode(id: ModeId): ModeRules {
  switch (id) {
    case 'gemgrab': return new GemGrab();
    case 'knockout': return new Knockout();
    case 'showdown': return new Showdown();
    case 'training': return new Training();
  }
}

/** Описания режимов для меню. icon — глиф из набора иконок, color — цвет режима. */
export const MODE_INFO: Record<ModeId, { name: string; short: string; desc: string; color: string; icon: string; teams: boolean }> = {
  gemgrab: { name: 'Захват кристаллов', short: '3 на 3', desc: 'Собери 10 кристаллов и удержи их 15 секунд.', color: '#8d5bff', icon: 'shard', teams: true },
  showdown: { name: 'Выживание', short: 'Каждый за себя', desc: 'Останься последним. Собирай кубы силы и беги от облака.', color: '#47d24a', icon: 'showdown', teams: false },
  knockout: { name: 'Нокаут', short: 'До 2 побед', desc: 'Выбей всю команду соперников. Без воскрешений.', color: '#ff8a2a', icon: 'knockout', teams: true },
  training: { name: 'Полигон', short: 'Тренировка', desc: 'Стреляй по мишеням и примеряй любые скины.', color: '#44c4ff', icon: 'training', teams: false },
};
