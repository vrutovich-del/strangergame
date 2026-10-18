import type { App } from '../app';
import { heroesScreen } from './heroes';
import { modesScreen } from './modes';
import { passScreen } from './pass';
import { profileScreen } from './profile';
import { questsScreen } from './quests';
import { roadScreen } from './road';
import { roomScreen } from './room';
import { settingsScreen } from './settings';
import { shopScreen } from './shop';

export interface Screen {
  el: HTMLElement;
  /** Показывать 3D-подиум за экраном. */
  showcase?: boolean;
  dispose?(): void;
  onShow?(): void;
  frame?(dt: number): void;
}

export const SCREENS: Record<string, (app: App, arg?: any) => Screen> = {
  heroes: heroesScreen,
  shop: shopScreen,
  road: roadScreen,
  pass: passScreen,
  quests: questsScreen,
  profile: profileScreen,
  settings: settingsScreen,
  modes: modesScreen,
  room: roomScreen,
};
