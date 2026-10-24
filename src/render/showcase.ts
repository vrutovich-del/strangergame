// Сцена-витрина: герой на подиуме в меню, победная поза на экране результата, портреты героев.
import * as THREE from 'three';
import { group } from './kit';
import { Character, createCharacter } from './models';
import type { AnimState } from './heroView';

export interface ShowItem { heroId: string; skinId: string; team?: 'blue' | 'red' | 'orange' }

export function addLights(scene: THREE.Scene, strength = 1) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7ab0, 1.6 * strength));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9 * strength);
  sun.position.set(3, 8, 6);
  scene.add(sun);
  return sun;
}

/**
 * Витрина: герой в меню. Сам подиум (лаймовый диск-наклейка) и клякса за героем рисуются в HTML под холстом,
 * а витрина ставит героя ногами на нижний край своей области (см. App.stage) — так он всегда стоит на подиуме.
 */
export class Showcase {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  chars: Character[] = [];
  private twins: Character[] = [];
  private podium: THREE.Group;
  private hemi: THREE.HemisphereLight;
  yaw = 0;
  yawVel = 0;
  mode: 'idle' | 'win' | 'lose' = 'idle';
  private t = 0;
  /** Радость по тапу: до этого момента играем победную анимацию. */
  private cheerUntil = 0;
  /** Сдвиг камеры по X (чтобы модель стояла не по центру области). */
  offsetX = 0;
  /** Какую долю высоты области занимает герой (1 — во всю высоту). */
  fit = 0.86;
  /** Сдвиг героя влево в долях ширины области (узкий экран: не прятать его под плашкой). Сбрасывается в set(). */
  shiftFrac = 0;

  constructor() {
    addLights(this.scene);
    this.hemi = this.scene.children.find((o) => o instanceof THREE.HemisphereLight) as THREE.HemisphereLight;
    this.podium = group('podium', this.scene);
    // тень от героя — тёмное пятно без размытия; сам диск подиума — в HTML
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.62, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x14121f, transparent: true, opacity: 0.22, depthWrite: false }));
    sh.scale.set(1.25, 1, 0.55);
    sh.position.y = 0.005;
    this.podium.add(sh);
  }

  /** Земля в тон кляксы за героем: свет снизу подкрашивается её цветом. */
  setGround(color: string) { this.hemi.groundColor.set(color); }

  /** Тап по герою — анимация радости. */
  cheer() { this.cheerUntil = this.t + 1.8; }

  set(items: ShowItem[], mode: 'idle' | 'win' | 'lose' = 'idle') {
    for (const c of [...this.chars, ...this.twins]) c.dispose();
    this.chars = []; this.twins = [];
    this.mode = mode;
    this.shiftFrac = 0;
    const n = items.length;
    items.forEach((it, i) => {
      const c = createCharacter(it.heroId, it.skinId, it.team ?? 'blue');
      c.root.position.x = (i - (n - 1) / 2) * 1.6;
      this.scene.add(c.root);
      this.chars.push(c);
    });
    // Бактерия радуется: делится на две маленькие и обратно
    if (mode === 'win' && n === 1 && items[0].heroId === 'bacteria') {
      for (let k = 0; k < 2; k++) {
        const c = createCharacter(items[0].heroId, items[0].skinId, 'blue');
        c.root.visible = false;
        this.scene.add(c.root);
        this.twins.push(c);
      }
    }
    this.podium.visible = n === 1;
    this.t = 0;
  }

  update(dt: number) {
    this.t += dt;
    this.yaw += this.yawVel * dt;
    this.yawVel *= Math.pow(0.04, dt);
    if (Math.abs(this.yawVel) < 0.05) this.yaw *= Math.pow(0.3, dt); // плавно возвращается лицом к нам
    const st: AnimState = {
      t: this.t, dt, move: 0, shot: 99, sup: 99, hurt: 99, dead: -1,
      win: this.mode === 'win' || this.t < this.cheerUntil, lose: this.mode === 'lose' && this.t >= this.cheerUntil, showcase: true, helpers: false, infected: false,
    };
    for (const c of this.chars) {
      c.root.rotation.y = this.yaw + (this.chars.length > 1 ? (c.root.position.x < 0 ? 0.25 : c.root.position.x > 0 ? -0.25 : 0) : 0);
      c.animate(st);
      c.updateMaterials(dt);
    }
    if (this.twins.length) {
      // цикл: 0–1 c — одна, 1–2.4 c — две маленькие разъезжаются и съезжаются
      const p = this.t % 3;
      const split = p > 1 && p < 2.6 ? Math.sin(((p - 1) / 1.6) * Math.PI) : 0;
      const main = this.chars[0];
      main.root.visible = split < 0.15;
      this.twins.forEach((c, i) => {
        c.root.visible = split >= 0.15;
        c.root.position.x = (i ? 1 : -1) * split * 0.75;
        c.root.scale.setScalar(0.62 + 0.38 * (1 - split));
        c.root.rotation.y = (i ? -0.4 : 0.4) * split;
        c.animate({ ...st, win: false, t: this.t + i });
        c.updateMaterials(dt);
      });
    }
  }

  /** Кадр камеры под размер области: герой стоит ногами на нижнем крае и занимает долю fit её высоты. */
  frame(aspect: number) {
    this.camera.aspect = aspect;
    const n = Math.max(1, this.chars.length);
    const H = Math.max(1.2, ...this.chars.map((c) => c.view.height ?? 1.85));
    // сколько мира по высоте видно: герой занимает fit высоты; узкая область — отдаляемся, чтобы влез по ширине
    const width = H * (n === 1 ? 1.05 : 0.9 + (n - 1) * 1.6);
    const span = Math.max(H / this.fit, width / Math.max(0.2, aspect));
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const dist = span / 2 / tan;
    const cy = span / 2 - span * 0.03;
    const ox = this.offsetX + this.shiftFrac * span * aspect;
    this.camera.position.set(ox, cy + span * 0.1, dist);
    this.camera.lookAt(ox, cy, 0);
    this.camera.updateProjectionMatrix();
  }

  render(gl: THREE.WebGLRenderer, w: number, h: number) {
    this.frame(w / Math.max(1, h));
    gl.render(this.scene, this.camera);
  }
}

/** Портреты героев, отрисованные из моделей (для карточек, экрана команд и т.п.). */
const portraitCache = new Map<string, string>();
export function renderPortrait(gl: THREE.WebGLRenderer, heroId: string, skinId: string, team: 'blue' | 'red' | 'orange' = 'blue', size = 256): string {
  const key = `${heroId}:${skinId}:${team}`;
  const cached = portraitCache.get(key);
  if (cached) return cached;
  const url = snapshot(gl, heroId, skinId, team, size, size, (c, cam) => {
    const h = c.view.height;
    cam.position.set(0, h * 0.62, 3.25);
    cam.lookAt(0, h * 0.47, 0);
  });
  portraitCache.set(key, url);
  return url;
}

/**
 * Портрет «по плечи» для широкой карточки героя (как в Brawl Stars): камера смотрит в лицо крупно.
 * Где лицо — задаёт `face` в виде героя; если не задано, берём верхнюю часть модели.
 */
export function renderFace(gl: THREE.WebGLRenderer, heroId: string, skinId: string, w = 448, h = 264): string {
  const key = `face:${heroId}:${skinId}`;
  const cached = portraitCache.get(key);
  if (cached) return cached;
  const url = snapshot(gl, heroId, skinId, 'blue', w, h, (c, cam) => {
    const k = c.view.scale;
    const f = c.view.face ?? { center: [0, (c.view.height / k) * 0.78, 0] as [number, number, number], half: (c.view.height / k) * 0.3 };
    // центр лица поворачиваем вместе с героем (он стоит вполоборота)
    const p = new THREE.Vector3(...f.center).multiplyScalar(k).applyAxisAngle(new THREE.Vector3(0, 1, 0), c.root.rotation.y);
    const dist = (f.half * k) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    cam.position.set(p.x, p.y + f.half * k * 0.12, p.z + dist);
    cam.lookAt(p.x, p.y, p.z);
  });
  portraitCache.set(key, url);
  return url;
}

/** Отрисовать героя в картинку w×h с прозрачным фоном; frame() ставит камеру. */
function snapshot(gl: THREE.WebGLRenderer, heroId: string, skinId: string, team: 'blue' | 'red' | 'orange', w: number, h: number,
  frame: (c: Character, cam: THREE.PerspectiveCamera) => void): string {
  const scene = new THREE.Scene();
  addLights(scene, 1.05);
  const c = createCharacter(heroId, skinId, team);
  scene.add(c.root);
  c.animate({ t: 0.2, dt: 0, move: 0, shot: 99, sup: 99, hurt: 99, dead: -1, win: false, lose: false, showcase: false, helpers: false, infected: false });
  c.root.rotation.y = -0.35;
  const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
  frame(c, cam);
  const rt = new THREE.WebGLRenderTarget(w, h, { colorSpace: THREE.SRGBColorSpace, samples: 4 });
  const prevTarget = gl.getRenderTarget();
  const prevClear = gl.getClearAlpha();
  gl.setRenderTarget(rt);
  gl.setClearColor(0x000000, 0);
  gl.clear();
  gl.render(scene, cam);
  const px = new Uint8Array(w * h * 4);
  gl.readRenderTargetPixels(rt, 0, 0, w, h, px);
  gl.setRenderTarget(prevTarget);
  gl.setClearAlpha(prevClear);
  rt.dispose();
  c.dispose();
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}
