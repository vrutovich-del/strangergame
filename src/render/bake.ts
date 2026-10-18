// «Запекание» модели: десятки мешей превращаются в несколько SkinnedMesh (по одному на материал).
// Каждый узел рига (Group) становится костью, поэтому анимация по именам узлов работает как раньше,
// а число вызовов отрисовки падает в 5–15 раз. Это важно для телефонов.
import * as THREE from 'three';

export interface Baked {
  root: THREE.Group;
  bones: Map<string, THREE.Bone>;
  meshes: THREE.SkinnedMesh[];
}

const isOutline = (o: THREE.Object3D) => !!o.userData.isOutline || o.name.endsWith('_outline');

/**
 * @param src исходная модель (Group с мешами)
 * @param jointNames имена мешей, которые анимируются сами (веки, брови и т.п.) — они станут костями
 */
export function bakeRigid(src: THREE.Object3D, jointNames: Set<string> = new Set()): Baked {
  src.updateMatrixWorld(true);
  const rootInv = src.matrixWorld.clone().invert();

  const isJoint = (o: THREE.Object3D) => {
    if (o === src) return true;
    if (isOutline(o)) return false;
    if (!(o as THREE.Mesh).isMesh) return true;
    if (jointNames.has(o.name)) return true;
    return o.children.some((c) => !isOutline(c));
  };

  const bones: THREE.Bone[] = [];
  const boneIndex = new Map<THREE.Object3D, number>();
  const byName = new Map<string, THREE.Bone>();
  const meshes: { mesh: THREE.Mesh; bone: number }[] = [];

  const visit = (o: THREE.Object3D, parentBone: THREE.Bone | null, parentIdx: number) => {
    let bone = parentBone, idx = parentIdx;
    if (isJoint(o)) {
      bone = new THREE.Bone();
      bone.name = o.name || 'node';
      if (o !== src) { bone.position.copy(o.position); bone.quaternion.copy(o.quaternion); bone.scale.copy(o.scale); }
      bone.userData = { ...o.userData };
      bone.visible = o.visible;
      if (parentBone) parentBone.add(bone);
      idx = bones.length;
      bones.push(bone);
      boneIndex.set(o, idx);
      if (o.name && !byName.has(o.name)) byName.set(o.name, bone);
    }
    if ((o as THREE.Mesh).isMesh) meshes.push({ mesh: o as THREE.Mesh, bone: idx });
    for (const c of o.children) visit(c, bone, idx);
  };
  visit(src, null, -1);

  // группируем геометрию по материалу
  const groups = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; color: boolean }>();
  const m4 = new THREE.Matrix4();
  for (const { mesh, bone } of meshes) {
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const g0 = mesh.geometry;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', g0.attributes.position.clone());
    if (g0.attributes.normal) g.setAttribute('normal', g0.attributes.normal.clone());
    if (g0.attributes.color) g.setAttribute('color', g0.attributes.color.clone());
    if (g0.index) g.setIndex(g0.index.clone());
    m4.multiplyMatrices(rootInv, mesh.matrixWorld);
    g.applyMatrix4(m4);
    const n = g.attributes.position.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = bone; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    let entry = groups.get(mat);
    if (!entry) { entry = { geos: [], color: !!(mat as THREE.MeshStandardMaterial).vertexColors }; groups.set(mat, entry); }
    entry.geos.push(g);
  }

  const rootBone = bones[0];
  const out = new THREE.Group();
  out.name = src.name;
  out.add(rootBone);
  rootBone.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const skinned: THREE.SkinnedMesh[] = [];
  for (const [mat, { geos, color }] of groups) {
    const merged = mergeIndexed(geos, !(mat as THREE.MeshBasicMaterial).isMeshBasicMaterial || geos.every((g) => !!g.attributes.normal), color);
    const sm = new THREE.SkinnedMesh(merged, mat);
    sm.name = 'baked_' + mat.name;
    sm.frustumCulled = false;
    sm.bind(skeleton, new THREE.Matrix4());
    out.add(sm);
    skinned.push(sm);
  }
  return { root: out, bones: byName, meshes: skinned };
}

/** Склеивает индексированные (и неиндексированные) геометрии в одну. */
function mergeIndexed(geos: THREE.BufferGeometry[], withNormal: boolean, withColor: boolean): THREE.BufferGeometry {
  let vCount = 0, iCount = 0;
  for (const g of geos) { vCount += g.attributes.position.count; iCount += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(vCount * 3);
  const nor = withNormal ? new Float32Array(vCount * 3) : null;
  const col = withColor ? new Float32Array(vCount * 3) : null;
  const si = new Uint16Array(vCount * 4), sw = new Float32Array(vCount * 4);
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0, io = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array as Float32Array, vo * 3);
    if (nor) {
      if (g.attributes.normal) nor.set(g.attributes.normal.array as Float32Array, vo * 3);
    }
    if (col) {
      if (g.attributes.color) {
        const c = g.attributes.color;
        for (let i = 0; i < n; i++) { col[(vo + i) * 3] = c.getX(i); col[(vo + i) * 3 + 1] = c.getY(i); col[(vo + i) * 3 + 2] = c.getZ(i); }
      } else col.fill(1, vo * 3, (vo + n) * 3);
    }
    si.set(g.attributes.skinIndex.array as Uint16Array, vo * 4);
    sw.set(g.attributes.skinWeight.array as Float32Array, vo * 4);
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo; io += a.length; }
    else { for (let i = 0; i < n; i++) idx[io + i] = vo + i; io += n; }
    vo += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (nor) out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  out.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/** Мультяшная обводка «вывернутой оболочкой» для любой модели (например, загруженной из GLB). */
export function addOutlines(root: THREE.Object3D, color = 0x1a0f2e, width = 0.012) {
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  mat.name = 'outline';
  const list: THREE.Mesh[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.noOutline && !isOutline(o)) list.push(o as THREE.Mesh); });
  const s = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3();
  for (const m of list) {
    const g = m.geometry, P = g.attributes.position, N = g.attributes.normal;
    if (!N) continue;
    const acc = new Map<string, THREE.Vector3>();
    const key = (i: number) => `${Math.round(P.getX(i) * 1e4)},${Math.round(P.getY(i) * 1e4)},${Math.round(P.getZ(i) * 1e4)}`;
    for (let i = 0; i < P.count; i++) {
      const k = key(i), v = acc.get(k) || new THREE.Vector3();
      v.x += N.getX(i); v.y += N.getY(i); v.z += N.getZ(i); acc.set(k, v);
    }
    m.matrixWorld.decompose(p, q, s);
    const w = width * (m.userData.outlineScale ?? 1), out = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      const n = acc.get(key(i))!.clone().normalize();
      out[i * 3] = P.getX(i) + (n.x * w) / s.x; out[i * 3 + 1] = P.getY(i) + (n.y * w) / s.y; out[i * 3 + 2] = P.getZ(i) + (n.z * w) / s.z;
    }
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.BufferAttribute(out, 3));
    if (g.index) og.setIndex(g.index);
    const om = new THREE.Mesh(og, mat);
    om.name = `${m.name}_outline`;
    om.userData.isOutline = true;
    m.add(om);
  }
}
