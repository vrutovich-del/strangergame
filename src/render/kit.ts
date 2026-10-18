// Общий набор для мультяшной графики: toon-материалы, скруглённые кубики, текстуры с холста.
import * as THREE from 'three';

let grad: THREE.DataTexture | null = null;
/** Трёхступенчатый градиент для toon-освещения. */
export function toonGradient() {
  if (grad) return grad;
  grad = new THREE.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, THREE.RedFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter;
  grad.generateMipmaps = false;
  grad.needsUpdate = true;
  return grad;
}

export function toon(color: number, o: { emissive?: number; ei?: number; vc?: boolean; transparent?: boolean; opacity?: number; side?: THREE.Side; name?: string } = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), vertexColors: !!o.vc, transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide });
  if (o.emissive !== undefined) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
  if (o.name) m.name = o.name;
  return m;
}

function rrShape(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Скруглённый кубик с центром в начале координат. */
export function roundedBox(w: number, h: number, d: number, r: number, seg = 3) {
  const b = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001) * 0.6;
  const depth = Math.max(d - 2 * b, 0.001);
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * b, h - 2 * b, r * 0.7), {
    depth, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: seg, curveSegments: 4,
  });
  g.translate(0, 0, -depth / 2);
  g.deleteAttribute('uv');
  return g;
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, name: string, parent?: THREE.Object3D, p?: [number, number, number], r?: [number, number, number], s?: number | [number, number, number]) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  if (p) m.position.set(...p);
  if (r) m.rotation.set(...r);
  if (s !== undefined) typeof s === 'number' ? m.scale.setScalar(s) : m.scale.set(...s);
  parent?.add(m);
  return m;
}

export function group(name: string, parent?: THREE.Object3D, p?: [number, number, number]) {
  const g = new THREE.Group();
  g.name = name;
  if (p) g.position.set(...p);
  parent?.add(g);
  return g;
}

/** Текстура, нарисованная на холсте. */
export function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, w = size) {
  const c = document.createElement('canvas');
  c.width = w; c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  return t;
}

export const hexStr = (c: number) => '#' + c.toString(16).padStart(6, '0');
