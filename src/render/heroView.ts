// Описание внешнего вида героя: модель, анимации, точка вылета снаряда.
import type * as THREE from 'three';
import type { SkinDef } from '../heroes/skinTypes';

/** Состояние для процедурной анимации (всё в секундах). */
export interface AnimState {
  t: number;
  dt: number;
  /** 0…1 — насколько быстро бежит. */
  move: number;
  /** Сколько прошло с выстрела, супера, получения урона. */
  shot: number;
  sup: number;
  hurt: number;
  /** Сколько прошло со смерти (−1 — жив). */
  dead: number;
  win: boolean;
  lose: boolean;
  /** Модель на подиуме в меню. */
  showcase: boolean;
  /** Помощники Смайла вылетели. */
  helpers: boolean;
  infected: boolean;
  /** Для разных роботов. */
  kind?: string;
}

export interface Rig {
  bone(name: string): THREE.Object3D | undefined;
  /** Корень модели (масштабированный). */
  body: THREE.Object3D;
  /** Базовый масштаб модели. */
  scale: number;
}

export interface HeroView {
  id: string;
  /** Собрать модель (без обводки — её добавит система моделей) для скина. teamColor — для роботов. */
  build(skin: SkinDef, teamColor: number): THREE.Object3D;
  /** Имена мешей, которые анимируются сами (их нельзя склеивать). */
  joints: string[];
  /** Цвет и толщина мультяшной обводки. */
  outline: [number, number];
  /** Масштаб модели в мире (1 плитка = 1 единица). */
  scale: number;
  /** Высота головы над землёй после масштаба (для ника и полоски HP). */
  height: number;
  animate(r: Rig, s: AnimState): void;
  /** Кость, откуда визуально вылетают снаряды. */
  muzzle?: string;
}

export const ease = {
  out: (t: number) => 1 - (1 - t) * (1 - t),
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  /** Импульс: быстро вверх, плавно вниз (0…1 за время d). */
  pulse: (age: number, d: number) => (age < 0 || age > d ? 0 : Math.sin((age / d) * Math.PI)),
  decay: (age: number, d: number) => (age < 0 || age > d ? 0 : 1 - age / d),
};
