// Упрощение сеток (meshoptimizer): убирает лишние треугольники, сохраняя форму и края.
// Модели автора очень детальные (~63 тыс. треугольников), для телефона это много.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';

export const simplifierReady: Promise<void> = MeshoptSimplifier.ready.then(() => undefined).catch(() => undefined);
let ok = false;
simplifierReady.then(() => { ok = MeshoptSimplifier.supported; });

/**
 * @param ratio доля треугольников, к которой стремимся
 * @param error допустимая ошибка формы (доля размера меша)
 */
export function simplifyModel(root: THREE.Object3D, ratio = 0.15, error = 0.02, minTris = 160) {
  if (!ok) return;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.isOutline) return;
    let g = m.geometry;
    const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
    if (tris < minTris) return;
    g = g.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    g = mergeVertices(g, 1e-4);
    const idx = g.index!.array;
    const indices = idx instanceof Uint32Array ? idx : new Uint32Array(idx);
    const pos = g.attributes.position.array as Float32Array;
    const target = Math.max(36, Math.floor((indices.length * ratio) / 3) * 3);
    const [res] = MeshoptSimplifier.simplify(indices, pos, 3, target, error, ['LockBorder']);
    if (res.length < 3) return;
    g.setIndex(new THREE.BufferAttribute(res.length > 0 && pos.length / 3 > 65535 ? res : new Uint16Array(res), 1));
    m.geometry.dispose();
    m.geometry = g;
  });
}

export function countTris(root: THREE.Object3D) {
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  });
  return n;
}
