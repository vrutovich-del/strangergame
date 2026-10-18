// WebGL-рендерер: размер экрана, качество, автоматическое снижение качества при просадках FPS.
import * as THREE from 'three';

export type Quality = 'auto' | 'low' | 'high';

export class GameRenderer {
  gl: THREE.WebGLRenderer;
  quality: Quality = 'auto';
  /** Текущий уровень детализации для «авто»: 0 — низкий, 2 — высокий. */
  level = 2;
  private frames: number[] = [];
  private lowSince = 0;
  private highSince = 0;
  width = 1;
  height = 1;

  constructor(public canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.setClearColor(0x000000, 0);
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setQuality(q: Quality) {
    this.quality = q;
    this.level = q === 'low' ? 0 : 2;
    this.resize();
  }

  /** Насыщенность эффектов: меньше частиц на слабом качестве. */
  get effects() { return this.level === 0 ? 0.45 : this.level === 1 ? 0.75 : 1; }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.width = w; this.height = h;
    const dpr = window.devicePixelRatio || 1;
    const cap = this.level === 0 ? 1 : this.level === 1 ? 1.5 : 2;
    this.gl.setPixelRatio(Math.min(dpr, cap));
    this.gl.setSize(w, h, false);
  }

  /** Вызывать каждый кадр с длительностью кадра — следит за FPS и подстраивает качество. */
  track(dt: number, now: number) {
    if (this.quality !== 'auto') return;
    this.frames.push(dt);
    if (this.frames.length > 60) this.frames.shift();
    if (this.frames.length < 60) return;
    const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    const fps = 1 / avg;
    if (fps < 48) {
      if (!this.lowSince) this.lowSince = now;
      if (now - this.lowSince > 2.5 && this.level > 0) { this.level--; this.lowSince = 0; this.frames = []; this.resize(); }
    } else this.lowSince = 0;
    if (fps > 58.5) {
      if (!this.highSince) this.highSince = now;
      if (now - this.highSince > 20 && this.level < 2) { this.level++; this.highSince = 0; this.frames = []; this.resize(); }
    } else this.highSince = 0;
  }
}
