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

/** Описания режимов для меню. */
export const MODE_INFO: Record<ModeId, { name: string; short: string; desc: string; color: string; icon: string; teams: boolean }> = {
  gemgrab: { name: 'Захват кристаллов', short: '3 на 3', desc: 'Собери 10 кристаллов и удержи их 15 секунд!', color: '#b45cff', icon: '💎', teams: true },
  showdown: { name: 'Выживание', short: 'Каждый за себя', desc: 'Останься последним! Собирай кубы силы и беги от ядовитого облака.', color: '#5ee05a', icon: '☠️', teams: false },
  knockout: { name: 'Нокаут', short: 'До 2 побед', desc: 'Выбей всю команду соперников. Без воскрешений!', color: '#ff9b3f', icon: '🥊', teams: true },
  training: { name: 'Полигон', short: 'Тренировка', desc: 'Стреляй по роботам-мишеням и примеряй скины.', color: '#3fa9ff', icon: '🎯', teams: false },
};
