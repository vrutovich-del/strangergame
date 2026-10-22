/**
 * ════════════════════════════════════════════════════════════════════════════
 *  MINER (Шахтёр) — 3D character model (Three.js, procedural, no textures)
 *  Character #5 of the brawler game: a crocodile miner. Self-contained ES module, depends only on `three` (r150+).
 *  Gameplay: throws pickaxes; ultimate = running charge that smashes enemies with both pickaxes.
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  USAGE
 *    import * as THREE from 'three';
 *    import { createMiner, setLook, resetPose } from './miner.js';
 *    const miner = createMiner();                  // THREE.Group, feet on y = 0, faces +Z
 *    scene.add(miner);
 *    // miner.parts.<…> → direct references to every animatable pivot (see RIG below)
 *
 *  OPTIONS  createMiner({ toon = true, outline = true, outlineWidth = 0.013, outlineColor })
 *
 *  SPACE & SCALE
 *    +Y up, looks toward +Z (the snout points +Z). Origin = between the feet on the ground.
 *    Height ≈ 1.85 with the helmet; snout reaches z ≈ 0.62, tail reaches back to z ≈ −1.0.
 *    "_L" / "_R" = the miner's own left / right (+X / −X).
 *
 *  LOOK
 *    Green muscular crocodile, long toothy snout (open grin), yellow mining helmet with a glowing headlamp,
 *    orange goggles, denim overalls with straps, pocket and gold buttons, belt with buckle and two pouches,
 *    rolled cuffs, brown boots, brown leather gloves, spiked tail, a steel pickaxe in each hand.
 *
 *  RIG (THREE.Group pivots; rest pose = ready stance, a pickaxe in each fist pointing up-forward)
 *    Miner (root) ................. world position / facing
 *    └─ hips ...................... pelvis pivot (y 0.80): bob, sway
 *       ├─ thigh_L/R → shin_L/R → foot_L/R ... legs (hip, knee, ankle); boots live in boot_* under foot_*
 *       ├─ tail_0 → … tail_5 (+ tail_tip) ... rotation.z = sway, rotation.x = lift(+)/droop(−)
 *       └─ torso .................. waist pivot (y 0.92): lean / twist
 *          ├─ head ................ neck pivot: turn / nod / headbutt
 *          │  ├─ jaw .............. rotation.x: 0 = closed, 0.28 = rest grin, 0.6 = roar
 *          │  ├─ helmet → headlamp → headlamp_light (empty: add a SpotLight here, it shines along +Z)
 *          │  └─ goggles .......... rotation.x ≈ −0.6 flips them up onto the helmet
 *          └─ arm_L/R → forearm_L/R → hand_L/R ... shoulder, elbow, wrist
 *                hand_*_shape → pickaxe_L / pickaxe_R (pivot = grip; handle = local +Y, pick tips = local ±Z;
 *                pickaxe_*_tip = empty at the front tip for hit checks)
 *
 *  ANIMATION RECIPES
 *      const qx = a => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), a);
 *      limb.quaternion.premultiply(qx(a))  // rotate a limb in its parent's space; a < 0 swings forward/up
 *    • resetPose(model) every frame, then add offsets (root transform is left alone).
 *    • Pickaxe throw (R): wind-up arm_R qx(+1.0)…qx(−2.2) over the shoulder, torso.rotation.y −0.4 → +0.3,
 *      at release: const p = pickaxe_R.clone(); scene.attach-style copy to world (p.applyMatrix4(pickaxe_R.matrixWorld)),
 *      fly it forward spinning around its local X (≈ 14 rad/s); hide pickaxe_R and show it again after ~0.6 s.
 *    • Ult (charge): lean torso.rotation.x +0.35, run cycle (legs qx(±0.9·sin), hips bob 0.05), move the root
 *      forward ~6 m/s for ~1 s while alternating overhead chops: arm qx(−2.4) → qx(+0.6) every 0.25 s per arm,
 *      jaw 0.6, finish with a two-handed slam (both arms qx(−2.6) → qx(+0.8)) + ground shock.
 *    • Idle: tail sway, jaw breathing, headlamp flicker (scale the glow), pickaxes tap slightly.
 */
import * as THREE from 'three';

export const MINER_PALETTE = {
  skin: 0x4fb33a, skinDark: 0x2e7a26, belly: 0xc4df73, spot: 0x6a5a2c,
  denim: 0x3f6db4, denimDark: 0x2e528c, cuff: 0x8db4e2, dirt: 0x6b4a2a, leather: 0x6e4021, pouch: 0x8a5a30,
  metal: 0xc3c7cf, button: 0xf0b13c, boot: 0x6b4426, sole: 0x3a2414, glove: 0x6f4426,
  helmet: 0xf2c12f, helmetBand: 0x45464e, lampMetal: 0xc9ced8, lampGlow: 0xfff1a8,
  gogBand: 0x34343c, lens: 0xff8f2a, lensGlow: 0xff7a1a, eyeMark: 0x5a1606,
  teeth: 0xfffaf0, mouth: 0xa8303a, tongue: 0xe46272,
  steel: 0xc3cfe0, steelDark: 0x7c8796, wood: 0x8a5228, woodCap: 0xd9772e,
};

/** Names of the animatable nodes (also stored in model.userData.rig, survives GLB export). */
export const MINER_RIG_NAMES = {
  root: 'Miner', hips: 'hips', torso: 'torso', head: 'head', jaw: 'jaw', helmet: 'helmet', goggles: 'goggles',
  headlamp: 'headlamp', headlampLight: 'headlamp_light',
  arms: ['arm_L', 'arm_R'], forearms: ['forearm_L', 'forearm_R'], hands: ['hand_L', 'hand_R'], pickaxes: ['pickaxe_L', 'pickaxe_R'],
  legs: ['thigh_L', 'thigh_R'], shins: ['shin_L', 'shin_R'], feet: ['foot_L', 'foot_R'],
  tail: ['tail_0', 'tail_1', 'tail_2', 'tail_3', 'tail_4', 'tail_5'],
};

// ───────────────────────── shared modelling kit (internal) ─────────────────────────
const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0), DOWN = V(0, -1, 0), FWD = V(0, 0, 1);

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toonGradient() {
  const tex = new THREE.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false; tex.needsUpdate = true;
  return tex;
}

/** Material factory: same key → same material (keeps the GLB small). */
function makeMaterials(prefix, toon) {
  const grad = toon ? toonGradient() : null;
  const cache = {};
  return (key, color, o = {}) => {
    if (cache[key]) return cache[key];
    const p = { color, vertexColors: !!o.vc, side: o.double ? THREE.DoubleSide : THREE.FrontSide };
    if (o.emissive != null) { p.emissive = new THREE.Color(o.emissive); p.emissiveIntensity = o.ei ?? 1; }
    const m = toon
      ? new THREE.MeshToonMaterial({ ...p, gradientMap: grad })
      : new THREE.MeshStandardMaterial({ ...p, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0 });
    m.name = prefix + key;
    cache[key] = m;
    return m;
  };
}

function group(name, parent, pos) {
  const g = new THREE.Group(); g.name = name;
  if (pos) g.position.copy(pos);
  if (parent) parent.add(g);
  return g;
}

function mesh(geo, mat, name, o = {}) {
  const m = new THREE.Mesh(geo, mat); m.name = name;
  if (o.p) m.position.set(...o.p);
  if (o.r) m.rotation.set(...o.r);
  if (o.s != null) typeof o.s === 'number' ? m.scale.setScalar(o.s) : m.scale.set(...o.s);
  if (o.q) m.quaternion.copy(o.q);
  if (o.noOutline) m.userData.noOutline = true;
  if (o.ol != null) m.userData.outlineScale = o.ol;
  if (o.parent) o.parent.add(m);
  return m;
}

/** Quaternion whose local +Z points along `z`, local +Y as close to `upHint` as possible. */
function basisQuat(z, upHint = UP) {
  const zz = z.clone().normalize();
  let x = new THREE.Vector3().crossVectors(upHint, zz);
  if (x.lengthSq() < 1e-8) x = new THREE.Vector3().crossVectors(V(1, 0, 0), zz);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(zz, x).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, zz));
}

const sphere = (r = 1, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);
/** Spherical cap facing +Z (used for irises / pupils). */
const capZ = (r, ang, w = 32) => new THREE.SphereGeometry(r, w, 8, 0, TAU, 0, ang).rotateX(Math.PI / 2);
/** Upper hemisphere (eyelid). */
const hemiUp = (r, w = 32) => new THREE.SphereGeometry(r, w, 12, 0, TAU, 0, Math.PI / 2);
/** Capsule hanging from the origin down to y = -len (joint-friendly limb segment). */
const limbDown = (r, len, rs = 16) => new THREE.CapsuleGeometry(r, len, 6, rs).translate(0, -len / 2, 0);
/** Cylinder whose axis is X. */
const cylX = (r1, r2, len, seg = 24) => new THREE.CylinderGeometry(r1, r2, len, seg).rotateZ(-Math.PI / 2);
/** Cylinder whose axis is Z. */
const cylZ = (r1, r2, len, seg = 24) => new THREE.CylinderGeometry(r1, r2, len, seg).rotateX(Math.PI / 2);

function rrShape(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape(), x = cx - w / 2, y = cy - h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Chunky rounded box centred on the origin. */
function roundedBox(w, h, d, r) {
  const b = r * 0.6;
  const g = new THREE.ExtrudeGeometry(rrShape(w - 2 * b, h - 2 * b, r * 0.7), {
    depth: Math.max(d - 2 * b, 0.001), bevelEnabled: true, bevelSize: b, bevelThickness: b,
    bevelSegments: 2, curveSegments: 5,
  });
  g.translate(0, 0, -Math.max(d - 2 * b, 0.001) / 2);
  return g;
}

/** Parametric surface helper: P(a,b) → point, N(a,b) → outward normal. */
class Surface {
  constructor(fn, center) { this.fn = fn; this.c = center; }
  P(a, b) { return this.fn(a, b); }
  D(a, b, e = 1e-4) {
    return {
      da: this.fn(a + e, b).sub(this.fn(a - e, b)).divideScalar(2 * e),
      db: this.fn(a, b + e).sub(this.fn(a, b - e)).divideScalar(2 * e),
    };
  }
  N(a, b) {
    const { da, db } = this.D(a, b);
    const p = this.fn(a, b);
    const n = new THREE.Vector3().crossVectors(da, db);
    if (n.lengthSq() < 1e-12) n.copy(p).sub(this.c);
    n.normalize();
    if (n.dot(p.clone().sub(this.c)) < 0) n.negate();
    return n;
  }
  /** Put `obj` on the surface, local +Z along the normal (optionally blended toward `blend`). */
  place(obj, a, b, lift = 0, blend = null, k = 0) {
    const p = this.P(a, b), n = this.N(a, b);
    obj.position.copy(p).addScaledVector(n, lift);
    const dir = blend ? n.clone().lerp(blend, k).normalize() : n;
    obj.quaternion.copy(basisQuat(dir, UP));
    return { p, n };
  }
}

/** Split triangles until every edge ≤ maxEdge (so decals can bend over a surface). */
function subdivide(geo, maxEdge) {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const P = src.attributes.position, out = [], stack = [];
  const at = (i) => V(P.getX(i), P.getY(i), P.getZ(i));
  for (let i = 0; i < P.count; i += 3) stack.push([at(i), at(i + 1), at(i + 2)]);
  while (stack.length) {
    const [a, b, c] = stack.pop();
    if (Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) <= maxEdge) {
      out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); continue;
    }
    const ab = a.clone().lerp(b, 0.5), bc = b.clone().lerp(c, 0.5), ca = c.clone().lerp(a, 0.5);
    stack.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}

/**
 * Wrap flat geometry (x = across, y = up, z = height) onto a surface around (a0,b0).
 * flat=true → normals taken from the surface (for paper-thin decals).
 */
function conform(geo, S, a0, b0, lift = 0.004, flat = true, maxEdge = 0.06) {
  const g = subdivide(geo, maxEdge);
  const { da, db } = S.D(a0, b0);
  const la = da.length(), lb = db.length(), sb = db.dot(UP) >= 0 ? 1 : -1;
  const pos = g.attributes.position, nor = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = a0 + pos.getX(i) / la, b = b0 + sb * pos.getY(i) / lb;
    const n = S.N(a, b), p = S.P(a, b).addScaledVector(n, pos.getZ(i) + lift);
    pos.setXYZ(i, p.x, p.y, p.z); nor.set([n.x, n.y, n.z], i * 3);
  }
  if (flat) g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  else g.computeVertexNormals();
  return g;
}

/** Move geometry so `pivot` becomes the mesh origin; returns the mesh positioned at pivot. */
function pivotMesh(m, pivot) { m.geometry.translate(-pivot.x, -pivot.y, -pivot.z); m.position.copy(pivot); return m; }

/** Strap / band with a rectangular cross-section following a path (a,b) over a surface. */
function surfStrip(S, path, { width, thick, lift = 0, closed = false, segs = 64 }) {
  const curve = new THREE.CatmullRomCurve3(path.map(([a, b]) => V(a, b, 0)), closed, 'catmullrom', 0.5);
  const n = closed ? segs : segs + 1, P = [], Nn = [];
  for (let i = 0; i < n; i++) { const q = curve.getPoint(i / segs); P.push(S.P(q.x, q.y)); Nn.push(S.N(q.x, q.y)); }
  const pos = [], nor = [], idx = [];
  const ring = [];
  for (let i = 0; i < n; i++) {
    const prev = P[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)], next = P[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
    const T = next.clone().sub(prev).normalize(), nn = Nn[i];
    const Sd = new THREE.Vector3().crossVectors(nn, T).normalize();
    const base = P[i].clone().addScaledVector(nn, lift), top = P[i].clone().addScaledVector(nn, lift + thick);
    ring.push({
      OL: top.clone().addScaledVector(Sd, width / 2), OR: top.clone().addScaledVector(Sd, -width / 2),
      IL: base.clone().addScaledVector(Sd, width / 2), IR: base.clone().addScaledVector(Sd, -width / 2),
      n: nn, s: Sd, T,
    });
  }
  const faces = [['OL', 'OR', (r) => r.n], ['IL', 'OL', (r) => r.s], ['IR', 'IL', (r) => r.n.clone().negate()], ['OR', 'IR', (r) => r.s.clone().negate()]];
  for (const [A, B, fn] of faces) {
    const start = pos.length / 3;
    for (const r of ring) { const f = fn(r); pos.push(...r[A].toArray(), ...r[B].toArray()); nor.push(...f.toArray(), ...f.toArray()); }
    const cnt = closed ? n : n - 1;
    for (let i = 0; i < cnt; i++) {
      const j = (i + 1) % n, a0 = start + i * 2, b0 = a0 + 1, a1 = start + j * 2, b1 = a1 + 1;
      idx.push(a0, b0, a1, b0, b1, a1);
    }
  }
  if (!closed) {
    for (const [r, sgn] of [[ring[0], -1], [ring[n - 1], 1]]) {
      const f = r.T.clone().multiplyScalar(sgn), s = pos.length / 3;
      for (const k of ['OL', 'OR', 'IR', 'IL']) { pos.push(...r[k].toArray()); nor.push(...f.toArray()); }
      const tri = (a, b, c) => {
        const va = V(...pos.slice((s + a) * 3, (s + a) * 3 + 3)), vb = V(...pos.slice((s + b) * 3, (s + b) * 3 + 3)), vc = V(...pos.slice((s + c) * 3, (s + c) * 3 + 3));
        const cn = vb.sub(va).cross(vc.sub(va));
        idx.push(...(cn.dot(f) >= 0 ? [s + a, s + b, s + c] : [s + a, s + c, s + b]));
      };
      tri(0, 1, 2); tri(0, 2, 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** Grid over a parametric surface; `keep(a,b)` filters quads (for panels / cut-outs). */
function surfPatch(S, a0, a1, b0, b1, na, nb, keep = null, lift = 0) {
  const pos = [], nor = [], idx = [];
  for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) {
    const a = a0 + (a1 - a0) * i / na, b = b0 + (b1 - b0) * j / nb;
    const n = S.N(a, b), p = S.P(a, b).addScaledVector(n, lift);
    pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z);
  }
  const vi = (i, j) => j * (na + 1) + i;
  const vv = (k) => V(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  const vn = (k) => V(nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]);
  const tri = (a, b, c) => {
    const cn = vv(b).sub(vv(a)).cross(vv(c).sub(vv(a)));
    const ref = vn(a).add(vn(b)).add(vn(c));
    if (cn.lengthSq() < 1e-16) return;
    idx.push(...(cn.dot(ref) >= 0 ? [a, b, c] : [a, c, b]));
  };
  for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) {
    if (keep && !keep(a0 + (a1 - a0) * (i + 0.5) / na, b0 + (b1 - b0) * (j + 0.5) / nb)) continue;
    tri(vi(i, j), vi(i + 1, j), vi(i + 1, j + 1)); tri(vi(i, j), vi(i + 1, j + 1), vi(i, j + 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/** Merge already-transformed geometries (position + normal only). */
function mergeGeos(list) {
  const pos = [], nor = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/** Two-bone IK: elbow position for shoulder S → hand T with a pole hint. */
function solveElbow(S, T, L1, L2, pole) {
  const d = T.clone().sub(S); let dist = d.length();
  const dir = d.normalize(); dist = Math.min(dist, (L1 + L2) * 0.999);
  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
  const po = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  return S.clone().addScaledVector(dir, a).addScaledVector(po, h);
}

/** shoulder → elbow → hand chain of pivots. Local −Y of every pivot points down the limb. */
function limbChain(tag, parent, S, E, H, r1, r2, mat, names = ['arm', 'forearm', 'hand']) {
  const arm = group(`${names[0]}_${tag}`, parent, S);
  const d1 = E.clone().sub(S), L1 = d1.length();
  arm.quaternion.setFromUnitVectors(DOWN, d1.normalize());
  mesh(limbDown(r1, L1), mat, `${names[0]}_${tag}_mesh`, { parent: arm });
  const fore = group(`${names[1]}_${tag}`, arm, V(0, -L1, 0));
  const d2 = H.clone().sub(E), L2 = d2.length();
  fore.quaternion.setFromUnitVectors(DOWN, d2.normalize().applyQuaternion(arm.quaternion.clone().invert()));
  if (r2 > 0) mesh(limbDown(r2, L2), mat, `${names[1]}_${tag}_mesh`, { parent: fore });
  const hand = group(`${names[2]}_${tag}`, fore, V(0, -L2, 0));
  return { arm, fore, hand, L1, L2 };
}

/** Add a mesh to `obj` positioned/oriented in WORLD space (obj must have up-to-date matrices). */
function addAtWorld(obj, m, worldPos, worldDirY = null) {
  obj.updateWorldMatrix(true, false);
  m.position.copy(obj.worldToLocal(worldPos.clone()));
  if (worldDirY) {
    const q = obj.getWorldQuaternion(new THREE.Quaternion()).invert();
    m.quaternion.setFromUnitVectors(UP, worldDirY.clone().normalize().applyQuaternion(q));
  }
  obj.add(m);
  return m;
}

/** Inverted-hull cartoon outlines (children named *_outline, skipped for GLB export). */
function addOutlines(root, color, width) {
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }); mat.name = 'outline';
  const list = [];
  root.updateWorldMatrix(true, true);
  root.traverse((o) => { if (o.isMesh && !o.userData.noOutline) list.push(o); });
  const s = V(), tq = new THREE.Quaternion(), tp = V();
  for (const m of list) {
    const g = m.geometry, P = g.attributes.position, Nn = g.attributes.normal;
    const acc = new Map(), key = (i) => `${Math.round(P.getX(i) * 1e4)},${Math.round(P.getY(i) * 1e4)},${Math.round(P.getZ(i) * 1e4)}`;
    for (let i = 0; i < P.count; i++) {
      const k = key(i), v = acc.get(k) || V();
      v.x += Nn.getX(i); v.y += Nn.getY(i); v.z += Nn.getZ(i); acc.set(k, v);
    }
    m.matrixWorld.decompose(tp, tq, s);
    const w = width * (m.userData.outlineScale ?? 1), out = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      const n = acc.get(key(i)).clone().normalize();
      out[i * 3] = P.getX(i) + n.x * w / s.x; out[i * 3 + 1] = P.getY(i) + n.y * w / s.y; out[i * 3 + 2] = P.getZ(i) + n.z * w / s.z;
    }
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.BufferAttribute(out, 3));
    if (g.index) og.setIndex(g.index);
    const om = new THREE.Mesh(og, mat); om.name = `${m.name}_outline`;
    om.userData.isOutline = true; om.userData.noOutline = true; om.raycast = () => {};
    m.add(om);
  }
}

/** Remember the rest pose of every node (used by resetPose). */
function captureRest(root) {
  const rest = new Map();
  root.traverse((o) => rest.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
  Object.defineProperty(root, 'restPose', { value: rest, enumerable: false });
}

/** Restore the rest pose captured at build time (models made by this file). The root's own transform
 *  (where the character stands / faces in the level) is left untouched. */
export function resetPose(model) {
  model.restPose?.forEach((t, o) => { if (o === model) return; o.position.copy(t.p); o.quaternion.copy(t.q); o.scale.copy(t.s); });
}

/** Blink: 0 = rest (angry half-lid), 1 = fully closed. Works on built models and loaded GLBs. */
export function setBlink(model, amount) {
  for (const side of ['L', 'R']) {
    const lid = model.getObjectByName(`eyelid_${side}`);
    if (!lid) continue;
    const open = lid.userData.restX ?? lid.rotation.x;
    lid.rotation.x = open + (1.68 - open) * THREE.MathUtils.clamp(amount, 0, 1);
  }
}

/** Point the pupils: x,y in −1…1 (x>0 = character's left / +X, y>0 = up). */
export function setLook(model, x, y) {
  for (const side of ['L', 'R']) {
    const iris = model.getObjectByName(`iris_${side}`);
    if (!iris) continue;
    const r = iris.userData.rest ?? [0, 0];
    iris.rotation.set(r[0] - y * 0.38, r[1] + x * 0.45, 0);
  }
}
// ───────────────────────────── MINER (crocodile) ─────────────────────────────
export function createMiner(options = {}) {
  const o = { toon: true, outline: true, outlineWidth: 0.013, outlineColor: 0x13200b, ...options };
  const M = makeMaterials('miner_', o.toon);
  const C = { ...MINER_PALETTE, ...(o.palette || {}) }; // o.palette — перекраска для скинов
  const mat = {
    skin: M('skin', C.skin, { rough: 0.6 }), skinDark: M('skin_dark', C.skinDark, { rough: 0.6 }), belly: M('belly', C.belly, { rough: 0.6 }),
    spot: M('spot', C.spot, { rough: 0.7 }), denim: M('denim', C.denim, { rough: 0.85 }), denimDark: M('denim_dark', C.denimDark, { rough: 0.85 }),
    cuff: M('cuff', C.cuff, { rough: 0.85 }), dirt: M('dirt', C.dirt, { rough: 0.9 }), leather: M('leather', C.leather, { rough: 0.7 }),
    pouch: M('pouch', C.pouch, { rough: 0.7 }), metal: M('metal', C.metal, { rough: 0.3, metal: 0.7 }), gold: M('button', C.button, { rough: 0.3, metal: 0.6 }),
    boot: M('boot', C.boot, { rough: 0.65 }), sole: M('sole', C.sole, { rough: 0.8 }), glove: M('glove', C.glove, { rough: 0.65 }),
    helmet: M('helmet', C.helmet, { rough: 0.35 }), helmetBand: M('helmet_band', C.helmetBand, { rough: 0.6 }),
    lampMetal: M('lamp_metal', C.lampMetal, { rough: 0.25, metal: 0.7 }), lampGlow: M('lamp_glow', C.lampGlow, { emissive: C.lampGlow, ei: 1.6 }),
    gogBand: M('goggle_band', C.gogBand, { rough: 0.6 }), lens: M('goggle_lens', C.lens, { rough: 0.15, emissive: C.lensGlow, ei: 0.55 }),
    eyeMark: M('eye_mark', C.eyeMark, { rough: 0.6 }), teeth: M('teeth', C.teeth, { rough: 0.3 }), mouth: M('mouth', C.mouth, { rough: 0.6 }), tongue: M('tongue', C.tongue, { rough: 0.5 }),
    steel: M('steel', C.steel, { rough: 0.25, metal: 0.8 }), steelDark: M('steel_dark', C.steelDark, { rough: 0.35, metal: 0.7 }),
    wood: M('wood', C.wood, { rough: 0.75 }), woodCap: M('wood_cap', C.woodCap, { rough: 0.6 }), shine: M('shine', 0xffffff, { emissive: 0xffffff, ei: 0.6 }),
  };
  const P = { hips: V(0, 0.8, 0), torso: V(0, 0.92, 0), head: V(0, 1.38, 0.02), jaw: V(0, 1.43, 0.1), helmet: V(0, 1.675, 0.02), goggles: V(0, 1.6, 0.06) };
  const root = group('Miner');
  const hips = group('hips', root), torso = group('torso', hips), head = group('head', torso), jaw = group('jaw', head);
  const helmet = group('helmet', head), goggles = group('goggles', head);
  const rebase = (g, p) => { g.children.forEach((c) => c.position.sub(p)); g.position.add(p); };
  const ell = (name, m, c, r, parent, extra = {}) => mesh(sphere(1, 26, 18), m, name, { parent, p: c, s: r, ...extra });
  const ellSurf = (c, r) => new Surface((phi, t) => V(r[0] * Math.sin(t) * Math.sin(phi), r[1] * Math.cos(t), r[2] * Math.sin(t) * Math.cos(phi)).add(c), c);
  const tOf = (c, r, y) => Math.acos(THREE.MathUtils.clamp((y - c.y) / r[1], -1, 1));

  // ── body ──
  const chestC = V(0, 1.12, 0), chestR = [0.37, 0.33, 0.27];
  const bellyC = V(0, 0.95, 0.0), bellyR = [0.33, 0.2, 0.25];
  ell('chest', mat.skin, chestC.toArray(), chestR, torso);
  ell('chest_light', mat.belly, [0, 1.19, 0.17], [0.25, 0.19, 0.11], torso, { noOutline: true });
  for (const s of [1, -1]) {
    ell(`pec_${s > 0 ? 'L' : 'R'}`, mat.skin, [0.13 * s, 1.17, 0.12], [0.16, 0.13, 0.14], torso);
    ell(`trap_${s > 0 ? 'L' : 'R'}`, mat.skin, [0.2 * s, 1.36, -0.03], [0.17, 0.09, 0.15], torso);
  }
  ell('overalls_body', mat.denim, bellyC.toArray(), bellyR, torso);
  ell('pelvis', mat.denim, [0, 0.8, 0], [0.3, 0.19, 0.24], hips);
  // bib + pocket + buttons
  const chestS = ellSurf(chestC, chestR);
  const bibT = tOf(chestC, chestR, 1.03);
  mesh(conform(new THREE.ExtrudeGeometry(rrShape(0.36, 0.22, 0.04), { depth: 0.014, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1 }), chestS, 0, bibT, 0.0, false), mat.denim, 'overalls_bib', { parent: torso });
  mesh(conform(new THREE.ExtrudeGeometry(rrShape(0.15, 0.08, 0.02, 0, 0.0), { depth: 0.008, bevelEnabled: false }), chestS, 0, bibT, 0.024, false), mat.denimDark, 'overalls_pocket', { parent: torso, ol: 0.6 });
  for (const s of [1, -1]) {
    const b = mesh(sphere(0.024, 12, 8), mat.gold, `bib_button_${s > 0 ? 'L' : 'R'}`, { parent: torso, s: [1, 1, 0.6] });
    chestS.place(b, 0.42 * s, tOf(chestC, chestR, 1.12), 0.035);
    // straps over the shoulders down the back
    const path = [[0.42, 1.12], [0.5, 1.22], [0.62, 1.32], [1.4, 1.42], [2.5, 1.32], [2.75, 1.12], [2.8, 0.98]].map(([a, y]) => [a * s, tOf(chestC, chestR, y)]);
    mesh(surfStrip(chestS, path, { width: 0.07, thick: 0.02, lift: 0.012, segs: 48 }), mat.denim, `overalls_strap_${s > 0 ? 'L' : 'R'}`, { parent: torso, ol: 0.7 });
  }
  // belt with buckle + pouches
  const bellyS = ellSurf(bellyC, bellyR), beltT = tOf(bellyC, bellyR, 0.875);
  { const path = []; for (let i = 0; i <= 24; i++) path.push([Math.PI + (i / 24) * TAU, beltT]);
    mesh(surfStrip(bellyS, path, { width: 0.075, thick: 0.026, lift: 0.004, segs: 96 }), mat.leather, 'belt', { parent: torso, ol: 0.7 }); }
  { const bk = group('belt_buckle', torso); bellyS.place(bk, 0, beltT, 0.04);
    mesh(new THREE.TorusGeometry(0.055, 0.015, 6, 4).rotateZ(Math.PI / 4).scale(1.25, 1, 1), mat.metal, 'belt_buckle_frame', { parent: bk });
    mesh(new THREE.BoxGeometry(0.06, 0.035, 0.01), mat.leather, 'belt_buckle_inner', { parent: bk, p: [0, 0, -0.006], noOutline: true }); }
  for (const [nm, phi, w, h] of [['pouch_L', 1.05, 0.11, 0.12], ['pouch_R', -1.15, 0.09, 0.1]]) {
    const pz = group(nm, torso); bellyS.place(pz, phi, beltT + 0.12, 0.05);
    mesh(roundedBox(w, h, 0.06, 0.018), mat.pouch, `${nm}_bag`, { parent: pz });
    mesh(roundedBox(w + 0.01, h * 0.4, 0.068, 0.016), mat.leather, `${nm}_flap`, { parent: pz, p: [0, h * 0.32, 0.003] });
    mesh(sphere(0.011, 8, 6), mat.metal, `${nm}_stud`, { parent: pz, p: [0, h * 0.18, 0.04], noOutline: true });
  }
  // dirt stains on the overalls
  [[0.12, 0.98, 0.24, 0.035], [-0.2, 0.9, 0.2, 0.03], [0.05, 1.05, 0.27, 0.025]].forEach(([x, y, z, r], i) => mesh(sphere(1, 10, 6), mat.dirt, `overalls_dirt_${i}`, { parent: torso, p: [x, y, z], s: [r * 1.4, r, r * 0.3], noOutline: true }));

  // ── head: skull, long snout, jaw with teeth ──
  ell('skull', mat.skin, [0, 1.52, 0.02], [0.19, 0.16, 0.2], head);
  ell('neck_mesh', mat.skin, [0, 1.38, 0.0], [0.17, 0.14, 0.17], head);
  ell('snout', mat.skin, [0, 1.47, 0.3], [0.125, 0.07, 0.27], head);
  ell('snout_tip', mat.skin, [0, 1.48, 0.55], [0.1, 0.06, 0.075], head);
  for (const s of [1, -1]) {
    ell(`nostril_${s > 0 ? 'L' : 'R'}`, mat.skinDark, [0.035 * s, 1.535, 0.585], [0.022, 0.016, 0.022], head, { ol: 0.5 });
    ell(`cheek_${s > 0 ? 'L' : 'R'}`, mat.skin, [0.12 * s, 1.45, 0.12], [0.11, 0.1, 0.13], head);
    ell(`eye_bump_${s > 0 ? 'L' : 'R'}`, mat.skin, [0.085 * s, 1.615, 0.1], [0.07, 0.06, 0.07], head);
  }
  for (let k = 0; k < 4; k++) ell(`snout_ridge_${k}`, mat.skinDark, [0, 1.535, 0.2 + k * 0.09], [0.022, 0.016, 0.03], head, { ol: 0.5 });
  [[0.06, 1.53, 0.38, 0.03], [-0.07, 1.52, 0.27, 0.025], [0.15, 1.5, 0.12, 0.03], [-0.13, 1.47, 0.2, 0.022], [0.03, 1.535, 0.47, 0.02]].forEach(([x, y, z, r], i) => {
    const sp = mesh(sphere(1, 10, 6), mat.spot, `snout_spot_${i}`, { parent: head, s: [r * 1.3, r, r * 0.35], noOutline: true });
    sp.position.set(x, y, z); sp.quaternion.copy(basisQuat(V(x * 2, 1, 0.1).normalize()));
  });
  ell('palate', mat.mouth, [0, 1.42, 0.3], [0.11, 0.03, 0.24], head, { noOutline: true });
  // upper teeth along both sides of the snout
  const toothGeo = (len, r) => new THREE.ConeGeometry(r, len, 8).rotateX(Math.PI).translate(0, -len / 2, 0);
  for (const s of [1, -1]) for (let k = 0; k < 7; k++) {
    const z = 0.16 + k * 0.065, hw = 0.125 * Math.sqrt(Math.max(0.05, 1 - ((z - 0.3) / 0.29) ** 2)) * 0.92;
    mesh(toothGeo(0.045 + (k % 2) * 0.01, 0.016), mat.teeth, `tooth_upper_${s > 0 ? 'L' : 'R'}${k}`, { parent: head, p: [hw * s, 1.425, z], ol: 0.4 });
  }
  // jaw (rotation.x > 0 opens)
  ell('jaw_mesh', mat.belly, [0, 1.385, 0.32], [0.12, 0.05, 0.26], jaw);
  ell('jaw_inner', mat.mouth, [0, 1.41, 0.31], [0.1, 0.025, 0.22], jaw, { noOutline: true });
  ell('tongue', mat.tongue, [0, 1.418, 0.26], [0.065, 0.02, 0.14], jaw, { noOutline: true });
  for (const s of [1, -1]) for (let k = 0; k < 6; k++) {
    const z = 0.2 + k * 0.065, hw = 0.118 * Math.sqrt(Math.max(0.05, 1 - ((z - 0.32) / 0.27) ** 2)) * 0.9;
    mesh(new THREE.ConeGeometry(0.015, 0.04, 8).translate(0, 0.02, 0), mat.teeth, `tooth_lower_${s > 0 ? 'L' : 'R'}${k}`, { parent: jaw, p: [hw * s, 1.415, z], ol: 0.4 });
  }

  // goggles (orange lenses with angry eyes behind) — rotation.x < 0 flips them up onto the helmet
  {
    const band = []; for (let i = 0; i <= 24; i++) band.push([Math.PI + (i / 24) * TAU, tOf(V(0, 1.52, 0.02), [0.19, 0.16, 0.2], 1.6)]);
    mesh(surfStrip(ellSurf(V(0, 1.52, 0.02), [0.19, 0.16, 0.2]), band, { width: 0.045, thick: 0.02, lift: 0.006, segs: 64 }), mat.gogBand, 'goggles_band', { parent: goggles, ol: 0.6 });
    for (const s of [1, -1]) {
      const tag = s > 0 ? 'L' : 'R';
      const lens = group(`goggle_lens_${tag}`, goggles, V(0.09 * s, 1.6, 0.175)); lens.quaternion.copy(basisQuat(V(0.3 * s, 0.1, 1).normalize()));
      mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 24).scale(1.1, 0.85, 1), mat.gogBand, `goggle_lens_${tag}_frame`, { parent: lens });
      mesh(sphere(1, 22, 14), mat.lens, `goggle_lens_${tag}_glass`, { parent: lens, s: [0.08, 0.063, 0.032], noOutline: true });
      mesh(new THREE.BoxGeometry(0.075, 0.016, 0.005), mat.eyeMark, `goggle_lens_${tag}_brow`, { parent: lens, p: [0.005 * s, 0.022, 0.03], r: [0, 0, 0.42 * s], noOutline: true });
      mesh(sphere(1, 12, 8), mat.eyeMark, `goggle_lens_${tag}_pupil`, { parent: lens, p: [-0.012 * s, -0.008, 0.029], s: [0.017, 0.02, 0.004], noOutline: true });
      mesh(sphere(0.012, 8, 6), mat.shine, `goggle_lens_${tag}_shine`, { parent: lens, p: [-0.03 * s, 0.022, 0.03], s: [1, 0.6, 0.4], noOutline: true });
    }
    mesh(roundedBox(0.05, 0.025, 0.03, 0.008), mat.gogBand, 'goggles_bridge', { parent: goggles, p: [0, 1.59, 0.21] });
  }
  // mining helmet with headlamp
  {
    mesh(new THREE.SphereGeometry(0.235, 28, 14, 0, TAU, 0, Math.PI / 2).scale(1, 0.95, 1.08), mat.helmet, 'helmet_dome', { parent: helmet, p: [0, 1.665, 0.02] });
    mesh(new THREE.TorusGeometry(0.235, 0.022, 8, 24, Math.PI * 0.62).rotateZ(Math.PI * 0.19).rotateY(Math.PI / 2).scale(1, 0.95, 1.08), mat.helmet, 'helmet_ridge', { parent: helmet, p: [0, 1.665, 0.02], ol: 0.6 });
    mesh(new THREE.CylinderGeometry(0.238, 0.245, 0.055, 32, 1, true).scale(1, 1, 1.08), mat.helmetBand, 'helmet_band', { parent: helmet, p: [0, 1.69, 0.02], ol: 0.6 });
    mesh(new THREE.LatheGeometry([new THREE.Vector2(0.235, 0.0), new THREE.Vector2(0.3, -0.008), new THREE.Vector2(0.305, -0.02), new THREE.Vector2(0.235, -0.024)], 36).scale(1, 1, 1.08), mat.helmet, 'helmet_brim', { parent: helmet, p: [0, 1.665, 0.02] });
    [[0.12, 1.815, 0.12, 0.025], [-0.15, 1.755, 0.06, 0.02], [0.06, 1.865, -0.1, 0.022]].forEach(([x, y, z, r], i) => {
      const d = mesh(sphere(1, 10, 6), mat.dirt, `helmet_dirt_${i}`, { parent: helmet, s: [r * 1.4, r, r * 0.3], noOutline: true });
      d.position.set(x, y, z); d.quaternion.copy(basisQuat(V(x, y - 1.665, z - 0.02).normalize()));
    });
    const lamp = group('headlamp', helmet, V(0, 1.765, 0.23)); lamp.rotation.x = -0.15;
    mesh(cylZ(0.07, 0.06, 0.07, 24), mat.lampMetal, 'headlamp_housing', { parent: lamp });
    mesh(new THREE.TorusGeometry(0.062, 0.014, 8, 24), mat.lampMetal, 'headlamp_ring', { parent: lamp, p: [0, 0, 0.036], ol: 0.6 });
    mesh(cylZ(0.053, 0.053, 0.01, 24), mat.lampGlow, 'headlamp_glass', { parent: lamp, p: [0, 0, 0.037], noOutline: true });
    group('headlamp_light', lamp, V(0, 0, 0.05));          // attach a SpotLight here, aim along +Z
  }

  // ── arms: big shoulders, gloves, fists gripping pickaxes ──
  const chain = (names, pts, parent) => {
    const out = []; const acc = new THREE.Quaternion(); let par = parent, prev = 0;
    names.forEach((nm, i) => {
      const g = group(nm, par, i === 0 ? pts[0] : V(0, -prev, 0));
      const d = pts[i + 1].clone().sub(pts[i]); prev = d.length();
      g.quaternion.setFromUnitVectors(DOWN, d.normalize().applyQuaternion(acc.clone().invert())); acc.multiply(g.quaternion);
      out.push({ g, len: prev }); par = g;
    });
    return out;
  };
  const aligned = (name, obj, worldPos) => {
    obj.updateWorldMatrix(true, false);
    const g = group(name, obj); g.quaternion.copy(obj.getWorldQuaternion(new THREE.Quaternion()).invert()); g.position.copy(obj.worldToLocal(worldPos.clone()));
    return g;
  };
  // pickaxe: pivot = grip (centre of the fist), handle along local +Y, pick points along local ±Z
  const taperTube = (curve, n, rFn, radial = 10, flat = 0.55) => {
    const pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, c = curve.getPoint(t), T = curve.getTangent(t).normalize();
      const X = V(1, 0, 0), Nn = new THREE.Vector3().crossVectors(X, T).normalize(), r = rFn(t);
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * TAU;
        const p = c.clone().addScaledVector(Nn, Math.cos(a) * r).addScaledVector(X, Math.sin(a) * r * flat);
        pos.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + (j + 1) % radial, c2 = a + radial, d = b + radial;
      idx.push(a, b, d, a, d, c2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  const buildPickaxe = (name, parent) => {
    const pk = group(name, parent);
    mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.76, 12).translate(0, 0.24, 0), mat.wood, `${name}_handle`, { parent: pk });
    mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.05, 12), mat.woodCap, `${name}_end_cap`, { parent: pk, p: [0, -0.14, 0] });
    mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.05, 12), mat.woodCap, `${name}_top_cap`, { parent: pk, p: [0, 0.66, 0] });
    mesh(roundedBox(0.075, 0.11, 0.1, 0.02), mat.steelDark, `${name}_collar`, { parent: pk, p: [0, 0.58, 0] });
    const head = new THREE.CatmullRomCurve3([V(0, 0.44, -0.33), V(0, 0.55, -0.2), V(0, 0.6, 0), V(0, 0.55, 0.2), V(0, 0.44, 0.33)]);
    const g = taperTube(head, 36, (t) => 0.004 + 0.042 * Math.pow(1 - Math.abs(2 * t - 1), 0.9), 10, 0.5);
    mesh(g, mat.steel, `${name}_head`, { parent: pk });
    group(`${name}_tip`, pk, V(0, 0.44, 0.33));
    return pk;
  };
  const parts = { arms: {}, forearms: {}, hands: {}, pickaxes: {}, thighs: {}, shins: {}, feet: {} };
  for (const s of [1, -1]) {
    const tag = s > 0 ? 'L' : 'R';
    const Sh = V(0.4 * s, 1.25, 0.0), El = V(0.53 * s, 0.98, -0.04), Wr = V(0.53 * s, 0.86, 0.2), Fc = V(0.53 * s, 0.85, 0.27);
    ell(`deltoid_${tag}`, mat.skin, [0.42 * s, 1.27, 0.0], [0.17, 0.15, 0.16], torso);
    const [arm, fore, hand] = chain([`arm_${tag}`, `forearm_${tag}`, `hand_${tag}`], [Sh, El, Wr, Fc], torso);
    mesh(limbDown(0.1, arm.len), mat.skin, `arm_${tag}_mesh`, { parent: arm.g });
    ell(`bicep_${tag}`, mat.skin, [0, -arm.len * 0.45, 0.02], [0.12, 0.14, 0.12], arm.g);
    mesh(limbDown(0.09, fore.len), mat.skin, `forearm_${tag}_mesh`, { parent: fore.g });
    mesh(new THREE.CylinderGeometry(0.105, 0.125, fore.len * 0.55, 20).translate(0, -fore.len * 0.7, 0), mat.glove, `glove_${tag}_cuff`, { parent: fore.g });
    mesh(new THREE.TorusGeometry(0.12, 0.016, 8, 20).rotateX(Math.PI / 2), mat.leather, `glove_${tag}_rim`, { parent: fore.g, p: [0, -fore.len * 0.43, 0], ol: 0.6 });
    const fist = aligned(`hand_${tag}_shape`, hand.g, Fc);
    mesh(sphere(1, 18, 12), mat.glove, `hand_${tag}_back`, { parent: fist, p: [0.02 * s, 0, -0.01], s: [0.075, 0.08, 0.085] });
    const pick = buildPickaxe(`pickaxe_${tag}`, fist);
    pick.quaternion.copy(basisQuat(V(0.0, -0.57, 0.82).normalize(), V(0.18 * s, 0.85, 0.5).normalize()));   // handle up-forward, slightly outward
    // fingers wrap the handle (on the inner side), thumb on top
    for (let k = 0; k < 4; k++) {
      const f = mesh(new THREE.CapsuleGeometry(0.026, 0.07, 4, 10), mat.skin, `hand_${tag}_finger${k}`, { parent: fist, ol: 0.5 });
      f.position.set(-0.035 * s, 0.045 - k * 0.032, 0.01); f.rotation.set(0, 0, Math.PI / 2);
    }
    mesh(new THREE.CapsuleGeometry(0.025, 0.05, 4, 10), mat.skin, `hand_${tag}_thumb`, { parent: fist, p: [-0.01 * s, 0.07, 0.04], r: [0.6, 0, 0], ol: 0.5 });
    parts.arms[tag] = arm.g; parts.forearms[tag] = fore.g; parts.hands[tag] = hand.g; parts.pickaxes[tag] = pick;

    // legs in overalls, rolled cuffs, boots
    const Hp = V(0.16 * s, 0.76, 0), Kn = V(0.2 * s, 0.44, 0.06), An = V(0.2 * s, 0.14, 0), Toe = V(0.2 * s, 0.05, 0.16);
    const [thigh, shin, foot] = chain([`thigh_${tag}`, `shin_${tag}`, `foot_${tag}`], [Hp, Kn, An, Toe], hips);
    mesh(limbDown(0.125, thigh.len), mat.denim, `thigh_${tag}_mesh`, { parent: thigh.g });
    mesh(limbDown(0.11, shin.len * 0.85), mat.denim, `shin_${tag}_mesh`, { parent: shin.g });
    mesh(new THREE.TorusGeometry(0.115, 0.03, 8, 22).rotateX(Math.PI / 2), mat.cuff, `cuff_${tag}`, { parent: shin.g, p: [0, -shin.len * 0.8, 0], ol: 0.7 });
    mesh(sphere(1, 10, 6), mat.dirt, `knee_dirt_${tag}`, { parent: shin.g, p: [0, -0.05, 0.11], s: [0.045, 0.035, 0.012], noOutline: true });
    const boot = aligned(`boot_${tag}`, foot.g, An);
    mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.14, 20), mat.boot, `boot_${tag}_shaft`, { parent: boot, p: [0, -0.04, 0] });
    mesh(sphere(1, 20, 14), mat.boot, `boot_${tag}_toe`, { parent: boot, p: [0, -0.07, 0.08], s: [0.11, 0.075, 0.15] });
    mesh(roundedBox(0.22, 0.04, 0.33, 0.015), mat.sole, `boot_${tag}_sole`, { parent: boot, p: [0, -0.12, 0.05] });
    for (let k = 0; k < 2; k++) mesh(new THREE.BoxGeometry(0.09, 0.01, 0.01), mat.sole, `boot_${tag}_lace${k}`, { parent: boot, p: [0, -0.03 + k * 0.035, 0.1], r: [0, 0, 0.3 * (k ? 1 : -1)], noOutline: true });
    parts.thighs[tag] = thigh.g; parts.shins[tag] = shin.g; parts.feet[tag] = foot.g;
  }

  // ── tail: 6 links with a row of spikes (local +Z = up side of the tail) ──
  const tail = [];
  {
    let cur = group('tail_0', hips, V(0, 0.76, -0.2));
    cur.quaternion.setFromUnitVectors(UP, V(0, -0.35, -1).normalize());
    const bends = [0, -0.05, -0.1, -0.12, -0.12, -0.1], L = 0.15;
    for (let k = 0; k < 6; k++) {
      if (k) { cur = group(`tail_${k}`, cur, V(0, L, 0)); cur.rotation.x = bends[k]; }
      const r = 0.13 * (1 - k / 7.2), r2 = 0.13 * (1 - (k + 1) / 7.2);
      mesh(new THREE.CylinderGeometry(Math.max(r2, 0.02), r, L, 14, 1, true).translate(0, L / 2, 0), mat.skin, `tail_${k}_mesh`, { parent: cur, ol: 0.7 });
      mesh(sphere(Math.max(r2, 0.02) * 1.02, 14, 10), mat.skin, `tail_${k}_joint`, { parent: cur, p: [0, L, 0], ol: 0.7 });
      for (const t of [0.3, 0.8]) {
        const rr = r + (r2 - r) * t;
        mesh(new THREE.ConeGeometry(Math.max(0.02, rr * 0.28), Math.max(0.04, rr * 0.55), 6), mat.skinDark, `tail_${k}_spike${t > 0.5 ? 1 : 0}`, { parent: cur, p: [0, L * t, rr * 0.92], r: [Math.PI / 2 - 0.4, 0, 0], ol: 0.5 });
      }
      tail.push(cur);
    }
    mesh(new THREE.ConeGeometry(0.03, 0.09, 10).translate(0, 0.045, 0), mat.skin, 'tail_tip', { parent: cur, p: [0, L, 0] });
  }

  // ── re-base pivots (innermost first) ──
  rebase(jaw, P.jaw); rebase(goggles, P.goggles); rebase(helmet, P.helmet);
  jaw.rotation.x = 0.28; jaw.userData.restX = 0.28;
  rebase(head, P.head); rebase(torso, P.torso); rebase(hips, P.hips);

  if (o.outline) addOutlines(root, o.outlineColor, o.outlineWidth);
  root.userData = { character: 'Miner', units: 'metres-ish, height ≈ 1.85 with helmet', forward: '+Z', up: '+Y', rig: MINER_RIG_NAMES };
  Object.defineProperty(root, 'parts', {
    enumerable: false,
    value: { hips, torso, head, jaw, helmet, goggles, headlamp: root.getObjectByName('headlamp'), headlampLight: root.getObjectByName('headlamp_light'), ...parts, tail },
  });
  captureRest(root);
  return root;
}
