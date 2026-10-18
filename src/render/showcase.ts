// Сцена-витрина: герой на подиуме в меню, победная поза на экране результата, портреты героев.
import * as THREE from 'three';
import { group, mesh, toon } from './kit';
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

export class Showcase {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  chars: Character[] = [];
  private twins: Character[] = [];
  private podium: THREE.Group;
  yaw = 0;
  yawVel = 0;
  mode: 'idle' | 'win' | 'lose' = 'idle';
  private t = 0;
  /** Сдвиг камеры по X (чтобы модель стояла не по центру экрана). */
  offsetX = 0;

  constructor() {
    addLights(this.scene);
    this.podium = group('podium', this.scene);
    mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.32, 40), toon(0x4a2bb0), 'podium_base', this.podium, [0, -0.16, 0]);
    mesh(new THREE.CylinderGeometry(1.1, 1.18, 0.1, 40), toon(0xffd23f), 'podium_top', this.podium, [0, 0.03, 0]);
    mesh(new THREE.TorusGeometry(1.32, 0.05, 8, 48).rotateX(Math.PI / 2), toon(0x8a5cff, { emissive: 0x6a3cff, ei: 0.8 }), 'podium_ring', this.podium, [0, -0.02, 0]);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    sh.position.y = 0.085;
    this.podium.add(sh);
  }

  set(items: ShowItem[], mode: 'idle' | 'win' | 'lose' = 'idle') {
    for (const c of [...this.chars, ...this.twins]) c.dispose();
    this.chars = []; this.twins = [];
    this.mode = mode;
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
      win: this.mode === 'win', lose: this.mode === 'lose', showcase: true, helpers: false, infected: false,
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

  /** Кадр камеры под размер области. */
  frame(aspect: number) {
    this.camera.aspect = aspect;
    const n = Math.max(1, this.chars.length);
    // на широких низких экранах (телефон боком) модель делаем чуть меньше и выше
    const dist = n === 1 ? (aspect > 1.9 ? 8.2 : 7.2) : 4.2 + n * 1.5;
    this.camera.position.set(this.offsetX, 1.6, dist);
    this.camera.lookAt(this.offsetX, 0.45, 0);
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
  const scene = new THREE.Scene();
  addLights(scene, 1.05);
  const c = createCharacter(heroId, skinId, team);
  scene.add(c.root);
  c.animate({ t: 0.2, dt: 0, move: 0, shot: 99, sup: 99, hurt: 99, dead: -1, win: false, lose: false, showcase: false, helpers: false, infected: false });
  c.root.rotation.y = -0.35;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const h = c.view.height;
  cam.position.set(0, h * 0.62, 3.25);
  cam.lookAt(0, h * 0.47, 0);
  const rt = new THREE.WebGLRenderTarget(size, size, { colorSpace: THREE.SRGBColorSpace, samples: 4 });
  const prevTarget = gl.getRenderTarget();
  const prevClear = gl.getClearAlpha();
  gl.setRenderTarget(rt);
  gl.setClearColor(0x000000, 0);
  gl.clear();
  gl.render(scene, cam);
  const px = new Uint8Array(size * size * 4);
  gl.readRenderTargetPixels(rt, 0, 0, size, size, px);
  gl.setRenderTarget(prevTarget);
  gl.setClearAlpha(prevClear);
  rt.dispose();
  c.dispose();
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  ctx.putImageData(img, 0, 0);
  const url = cv.toDataURL('image/png');
  portraitCache.set(key, url);
  return url;
}
