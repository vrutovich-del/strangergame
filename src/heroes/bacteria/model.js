/**
 * ════════════════════════════════════════════════════════════════════════════
 *  PURPLE GERM — 3D character model (Three.js, procedural, no textures)
 *  Character #1 of the brawler game. Self-contained ES module, depends only on `three` (r150+).
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  USAGE
 *    import * as THREE from 'three';
 *    import { createPurpleGerm, setBlink, setLook, resetPose } from './purple_germ.js';
 *    const germ = createPurpleGerm();            // THREE.Group, feet on y = 0, faces +Z
 *    scene.add(germ);
 *    // germ.parts.<…>  → direct references to every animatable pivot (see RIG below)
 *    // germ.getObjectByName('arm_L') also works (same names survive GLB export).
 *
 *  OPTIONS  createPurpleGerm({ toon = true, outline = true, outlineWidth = 0.013, outlineColor })
 *    toon     – MeshToonMaterial (3-step cel shading). false → MeshStandardMaterial (PBR, used for .glb).
 *    outline  – black inverted-hull outlines (children named *_outline). Turn off for export.
 *
 *  SPACE & SCALE
 *    +Y up, character looks toward +Z. Origin = centre between the feet on the ground.
 *    Height ≈ 1.85 (top of the head hairs), body width ≈ 1.15, ~1 unit = 1 "metre".
 *    "_L" / "_R" are the CHARACTER's left / right:  _L = +X side,  _R = −X side.
 *
 *  RIG (all are THREE.Group pivots; rotate them, the meshes inside follow)
 *    PurpleGerm (root) ............ move / turn the whole character here
 *    ├─ torso ...................... pivot at bottom of the body (y = 0.16). Squash & stretch:
 *    │                               torso.scale.set(1+k, 1-k, 1+k);  lean: torso.rotation.x / z
 *    │  ├─ face
 *    │  │  ├─ eye_L / eye_R ........ eyeball pivots (centre of eye)
 *    │  │  │  ├─ iris_L / iris_R ... rotate to look around (x: down+, y: toward +X) — or use setLook()
 *    │  │  │  └─ eyelid_L / _R ..... rotation.x: −0.42 = rest (angry half-lid) … 1.68 = closed — or setBlink()
 *    │  │  ├─ brow_L / brow_R ...... pivot at brow centre: position.y (+0.03 raise), rotation.z (tilt)
 *    │  │  └─ mouth ................ grin decal group (scale.y 0.8…1.25 for talk / shout)
 *    │  ├─ goggles ................. rotation.x ≈ 0.68 pulls goggles down over the eyes (0 = on the forehead)
 *    │  ├─ goggle_strap
 *    │  ├─ backpack
 *    │  │  ├─ canister_L (wooden barrel) / canister_R (metal can) — jiggle on landing
 *    │  ├─ weapon .................. blaster, local +X = barrel direction. Recoil: weapon.position −X local
 *    │  │  └─ weapon_muzzle ........ empty: spawn point / muzzle flash (getWorldPosition)
 *    │  ├─ arm_L / arm_R ........... shoulder pivots, local −Y runs down the arm
 *    │  │  └─ forearm_L / _R ....... elbow pivots
 *    │  │     └─ hand_L / hand_R ... wrist pivots (fingers inside, wrapped around the weapon)
 *    │  └─ cilia_00 … cilia_29 ..... hairs; each = chain cilia_NN_s0 → _s1 → _s2 (rotate .z to wiggle)
 *    ├─ leg_L / leg_R .............. hip pivots (rotation.x swings the leg for walking)
 *    │  └─ foot_L / foot_R
 *
 *  ANIMATION NOTES
 *    • setBlink / setLook / resetPose are identical in both character files — import them from either one.
 *      setBlink and setLook also work on models loaded from the .glb (they find nodes by name).
 *    • Rest pose: holding the blaster in front of the belly, muzzle pointing forward-left (+X,+Z).
 *      Arms are posed to the weapon, so move weapon + arms together (or rotate the whole torso).
 *    • resetPose(model) restores the rest pose captured at build time (every node except the root,
 *      so the character keeps its place in the level) (call before each frame
 *      if you animate with absolute offsets).  setBlink(model, 0…1),  setLook(model, x, y).
 *    • Cilia idle: for each chain seg k:  seg.rotation.z = rest + 0.15·sin(t·6 + i + k·0.9)
 *    • Walk: legs rotation.x = ±0.5·sin(t·10), torso.position.y bob, torso.rotation.z sway.
 */
import * as THREE from 'three';

export const PURPLE_GERM_PALETTE = {
  skin: 0x2f1a3c, hair: 0x4b2466, spotA: 0x7d34a8, spotB: 0xa64fd6, spotC: 0xc77ae8,
  sclera: 0xcfee45, irisRing: 0x2e7212, iris: 0x6fc41e, pupil: 0x0a0a0a,
  lip: 0x0d0410, mouth: 0x3d0715, tongue: 0xd8435a, tooth: 0xf3ead2, brow: 0x0e0612,
  goggleRim: 0xa49c8c, goggleGlass: 0x2a3a48, strap: 0x6e4527, strapDark: 0x4b2c17,
  canMetal: 0x948cb0, canMetalDark: 0x5f5878, wood: 0x7a4b26, woodDark: 0x4f2e15, woodLid: 0x9a6634,
  gun: 0x1b1b21, gunMid: 0x2b2b33, gunEdge: 0x3e3e48, glowGreen: 0x5cff45, glowPurple: 0xd45cff,
};

/** Names of the animatable nodes (also stored in model.userData.rig, survives GLB export). */
export const PURPLE_GERM_RIG_NAMES = {
  root: 'PurpleGerm', torso: 'torso', face: 'face', mouth: 'mouth', goggles: 'goggles', backpack: 'backpack',
  weapon: 'weapon', muzzle: 'weapon_muzzle',
  eyes: ['eye_L', 'eye_R'], irises: ['iris_L', 'iris_R'], eyelids: ['eyelid_L', 'eyelid_R'], brows: ['brow_L', 'brow_R'],
  arms: ['arm_L', 'arm_R'], forearms: ['forearm_L', 'forearm_R'], hands: ['hand_L', 'hand_R'],
  legs: ['leg_L', 'leg_R'], feet: ['foot_L', 'foot_R'], canisters: ['canister_L', 'canister_R'],
  ciliaPattern: 'cilia_NN → cilia_NN_s0 / _s1 / _s2 (NN = 00…29)',
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
// ───────────────────────────── PURPLE GERM ─────────────────────────────
export function createPurpleGerm(options = {}) {
  const o = { toon: true, outline: true, outlineWidth: 0.013, outlineColor: 0x14071c, ...options };
  const M = makeMaterials('germ_', o.toon);
  const C = { ...PURPLE_GERM_PALETTE, ...(o.palette || {}) }; // o.palette — перекраска для скинов
  const mat = {
    skin: M('skin', C.skin, { rough: 0.28 }),
    lid: M('skin_lid', C.skin, { rough: 0.28, double: true }), hair: M('hair', C.hair, { rough: 0.35 }),
    spotA: M('spot_a', C.spotA, { rough: 0.3 }), spotB: M('spot_b', C.spotB, { rough: 0.3 }), spotC: M('spot_c', C.spotC, { rough: 0.3 }),
    sclera: M('sclera', C.sclera, { rough: 0.25 }), irisRing: M('iris_ring', C.irisRing), iris: M('iris', C.iris, { rough: 0.3 }),
    pupil: M('pupil', C.pupil, { rough: 0.2 }), shine: M('shine', 0xffffff, { emissive: 0xffffff, ei: 0.6 }),
    lip: M('lip', C.lip), mouth: M('mouth', C.mouth), tongue: M('tongue', C.tongue, { rough: 0.4 }), tooth: M('tooth', C.tooth, { rough: 0.3 }),
    brow: M('brow', C.brow, { rough: 0.5 }),
    rim: M('goggle_rim', C.goggleRim, { rough: 0.35, metal: 0.55 }), glass: M('goggle_glass', C.goggleGlass, { rough: 0.08, metal: 0.4 }),
    strap: M('leather', C.strap, { rough: 0.7 }), strapDark: M('leather_dark', C.strapDark, { rough: 0.7 }),
    can: M('can_metal', C.canMetal, { rough: 0.4, metal: 0.5 }), canDark: M('can_metal_dark', C.canMetalDark, { rough: 0.45, metal: 0.5 }),
    wood: M('wood', C.wood, { rough: 0.75 }), woodDark: M('wood_dark', C.woodDark, { rough: 0.75 }), woodLid: M('wood_lid', C.woodLid, { rough: 0.7 }),
    gun: M('gun', C.gun, { rough: 0.45, metal: 0.3 }), gunMid: M('gun_mid', C.gunMid, { rough: 0.4, metal: 0.35 }), gunEdge: M('gun_edge', C.gunEdge, { rough: 0.35, metal: 0.45 }),
    hole: M('gun_hole', 0x050507), glowG: M('glow_green', C.glowGreen, { emissive: C.glowGreen, ei: 1.4 }), glowP: M('glow_purple', C.glowPurple, { emissive: C.glowPurple, ei: 1.2 }),
  };

  const root = group('PurpleGerm');
  const torso = group('torso', root);       // built in model space, re-based to TORSO_Y at the end
  const TORSO_Y = 0.16;

  // ── body: lathe "bean" (wide, flat-ish front) ──
  const ZS = 0.88;
  const prof = [[0, 0.16], [0.28, 0.172], [0.45, 0.225], [0.545, 0.33], [0.578, 0.5], [0.583, 0.75], [0.572, 1.0], [0.545, 1.2], [0.49, 1.38], [0.39, 1.52], [0.23, 1.61], [0, 1.64]];
  const pc = new THREE.CatmullRomCurve3(prof.map(([r, y]) => V(r, y, 0)), false, 'centripetal');
  const samples = pc.getPoints(72).map((p) => new THREE.Vector2(Math.max(p.x, 0), p.y));
  samples[0].x = 0; samples[samples.length - 1].x = 0;
  const rAt = (y) => {
    if (y <= samples[0].y) return samples[0].x;
    for (let i = 1; i < samples.length; i++) if (y <= samples[i].y) {
      const a = samples[i - 1], b = samples[i], t = (y - a.y) / Math.max(b.y - a.y, 1e-9);
      return a.x + (b.x - a.x) * t;
    }
    return 0;
  };
  const S = new Surface((phi, y) => { const r = rAt(y); return V(r * Math.sin(phi), y, ZS * r * Math.cos(phi)); }, V(0, 0.9, 0));
  const bodyGeo = new THREE.LatheGeometry(samples, 72); bodyGeo.scale(1, 1, ZS);
  mesh(bodyGeo, mat.skin, 'body', { parent: torso });

  // glossy violet spots (merged per colour, no outline)
  {
    const R = rng(11), base = sphere(1, 8, 5), lists = [[], [], []];
    let placed = 0;
    for (let tries = 0; placed < 64 && tries < 3000; tries++) {
      const phi = (R() * 2 - 1) * Math.PI, y = 0.24 + R() * 1.3;
      const faceZone = Math.abs(phi) < 0.95 && y > 0.6 && y < 1.36, goggleZone = Math.abs(phi) < 1.0 && y > 1.36;
      if (goggleZone || (faceZone && R() < 0.85)) continue;
      const s = 0.012 + R() ** 2 * 0.032, p = S.P(phi, y), n = S.N(phi, y);
      lists[Math.floor(R() * 3)].push(base.clone().applyMatrix4(new THREE.Matrix4().compose(p, basisQuat(n), V(s, s * 0.85, s * 0.3))));
      placed++;
    }
    ['spotA', 'spotB', 'spotC'].forEach((k, i) => mesh(mergeGeos(lists[i]), mat[k], `body_spots_${i}`, { parent: torso, noOutline: true }));
  }

  // ── face ──
  const face = group('face', torso);
  const eyeY = 1.1;
  for (const side of [1, -1]) {
    const tag = side > 0 ? 'L' : 'R';
    const phi = 0.47 * side, p = S.P(phi, eyeY), n = S.N(phi, eyeY);
    const eye = group(`eye_${tag}`, face, p.clone().addScaledVector(n, -0.06));
    eye.quaternion.copy(basisQuat(n.clone().lerp(FWD, 0.45).normalize()));
    const shape = group(`eye_${tag}_shape`, eye); shape.scale.set(0.165, 0.178, 0.14);
    mesh(sphere(1, 32, 24), mat.sclera, `eye_${tag}_ball`, { parent: shape, ol: 0.6 });
    const iris = group(`iris_${tag}`, shape);
    iris.rotation.set(0.06, -0.06 * side, 0); iris.userData.rest = [0.06, -0.06 * side];
    mesh(capZ(1.012, 0.66), mat.irisRing, `iris_${tag}_ring`, { parent: iris, noOutline: true });
    mesh(capZ(1.02, 0.57), mat.iris, `iris_${tag}_color`, { parent: iris, noOutline: true });
    mesh(capZ(1.03, 0.27), mat.pupil, `pupil_${tag}`, { parent: iris, noOutline: true });
    const hl = V(-0.32, 0.36, 0.88).normalize().multiplyScalar(1.03);
    mesh(sphere(0.11, 12, 8), mat.shine, `eye_${tag}_shine`, { parent: shape, p: hl.toArray(), s: [1, 1, 0.3], q: basisQuat(hl), noOutline: true });
    const tilt = group(`eyelid_${tag}_tilt`, shape); tilt.rotation.z = 0.34 * side;
    const lid = mesh(hemiUp(1.075), mat.lid, `eyelid_${tag}`, { parent: tilt, ol: 0.6, r: [-0.42, 0, 0] });
    lid.userData.restX = -0.42;

    // brow: thick, angry (inner end low)
    const pts = [], N = 14;
    for (let i = 0; i <= N; i++) {
      const s = i / N, u = (-0.16 + 0.32 * s) * side, v = -0.055 + 0.11 * s + 0.03 * Math.sin(Math.PI * s), th = 0.09 - 0.045 * s;
      pts.push([u, v, th]);
    }
    const bs = new THREE.Shape();
    bs.moveTo(pts[0][0], pts[0][1] - pts[0][2] / 2);
    pts.forEach(([u, v, th]) => bs.lineTo(u, v - th / 2));
    [...pts].reverse().forEach(([u, v, th]) => bs.lineTo(u, v + th / 2));
    bs.closePath();
    const bgeo = conform(new THREE.ExtrudeGeometry(bs, { depth: 0.07, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.014, bevelSegments: 2 }),
      S, 0.44 * side, 1.335, -0.02, false);
    pivotMesh(mesh(bgeo, mat.brow, `brow_${tag}`, { parent: face, ol: 0.7 }), S.P(0.44 * side, 1.335));
  }

  // mouth: wide grin, smirk to the character's left (+X), red tongue, single tooth
  {
    const up = [[-0.31, 0.07], [-0.22, 0.025], [-0.1, 0.0], [0.02, -0.006], [0.14, 0.004], [0.25, 0.035], [0.315, 0.09]];
    const lo = [[0.315, 0.09], [0.275, 0.0], [0.19, -0.09], [0.07, -0.148], [-0.06, -0.154], [-0.18, -0.112], [-0.27, -0.03], [-0.31, 0.07]];
    const mk = (sx, sy, dy = 0) => {
      const sh = new THREE.Shape();
      const f = ([u, v]) => new THREE.Vector2(u * sx, (v + 0.035) * sy - 0.035 + dy);
      sh.moveTo(...f(up[0]).toArray());
      sh.splineThru(up.slice(1).map(f)); sh.splineThru(lo.slice(1).map(f));
      return sh;
    };
    const mouth = group('mouth', face, S.P(0, 0.8));
    const add = (shape, m, name, lift) => {
      const g = conform(new THREE.ShapeGeometry(shape, 10), S, 0, 0.8, lift);
      mesh(g, m, name, { parent: mouth, noOutline: true }).geometry.translate(-mouth.position.x, -mouth.position.y, -mouth.position.z);
    };
    add(mk(1.07, 1.16), mat.lip, 'mouth_line', 0.004);
    add(mk(1.0, 1.0), mat.mouth, 'mouth_inner', 0.007);
    const tg = new THREE.Shape(); tg.absellipse(0.035, -0.098, 0.13, 0.038, 0, TAU, false, 0.05);
    add(tg, mat.tongue, 'tongue', 0.01);
    add(rrShape(0.058, 0.085, 0.02, 0.085, -0.035), mat.tooth, 'tooth', 0.013);
  }

  // ── goggles on the forehead (rotate `goggles.rotation.x` ≈ 0.68 to pull them over the eyes) ──
  const gpiv = V(0, 0.956, 0.005);
  const goggles = group('goggles', torso, gpiv);
  {
    const lensPos = [];
    for (const side of [1, -1]) {
      const tag = side > 0 ? 'L' : 'R';
      const p = S.P(0.5 * side, 1.455), n = S.N(0.5 * side, 1.455);
      const dir = n.clone().lerp(FWD, 0.35).normalize();
      const lens = group(`goggle_lens_${tag}`, goggles, p.clone().addScaledVector(n, 0.035).sub(gpiv));
      lens.quaternion.copy(basisQuat(dir));
      lensPos.push(lens.position.clone());
      mesh(cylZ(0.158, 0.142, 0.09, 28), mat.rim, `goggle_lens_${tag}_housing`, { parent: lens });
      mesh(new THREE.TorusGeometry(0.138, 0.024, 10, 32), mat.rim, `goggle_lens_${tag}_ring`, { parent: lens, p: [0, 0, 0.045] });
      mesh(cylZ(0.124, 0.124, 0.012, 32), mat.glass, `goggle_lens_${tag}_glass`, { parent: lens, p: [0, 0, 0.043], noOutline: true });
      mesh(new THREE.BoxGeometry(0.03, 0.18, 0.004), mat.shine, `goggle_lens_${tag}_glare`, { parent: lens, p: [-0.008, 0.008, 0.051], r: [0, 0, -0.75], noOutline: true });
      mesh(new THREE.BoxGeometry(0.014, 0.085, 0.004), mat.shine, `goggle_lens_${tag}_glare2`, { parent: lens, p: [0.055, -0.045, 0.051], r: [0, 0, -0.75], noOutline: true });
    }
    const mid = lensPos[0].clone().add(lensPos[1]).multiplyScalar(0.5);
    const bridge = mesh(roundedBox(0.1, 0.045, 0.05, 0.015), mat.strapDark, 'goggle_bridge', { parent: goggles });
    bridge.position.copy(mid).add(V(0, -0.01, -0.03));
    bridge.quaternion.copy(basisQuat(S.N(0, 1.47).lerp(FWD, 0.35).normalize()));
  }
  const strapPath = []; for (let k = 0; k <= 16; k++) { const a = Math.PI + (k / 16) * TAU; strapPath.push([a, 1.39 + 0.07 * Math.cos(a)]); }
  mesh(surfStrip(S, strapPath, { width: 0.075, thick: 0.022, lift: 0.004, segs: 96 }), mat.strap, 'goggle_strap', { parent: torso, ol: 0.7 });

  // ── backpack: two canisters on the shoulders + straps ──
  const pack = group('backpack', torso);
  {
    const metal = group('canister_R', pack, V(-0.54, 0.97, -0.06)); metal.rotation.set(0.25, 0, 0.78);
    mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.24, 28), mat.can, 'canister_R_body', { parent: metal });
    const lidGeo = new THREE.CylinderGeometry(0.152, 0.152, 0.085, 22).toNonIndexed(); lidGeo.computeVertexNormals();
    mesh(lidGeo, mat.canDark, 'canister_R_lid', { parent: metal, p: [0, 0.155, 0] });
    mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.03, 18), mat.can, 'canister_R_cap', { parent: metal, p: [0, 0.21, 0] });
    for (const y of [-0.07, 0.05]) mesh(new THREE.TorusGeometry(0.137, 0.012, 8, 28).rotateX(Math.PI / 2), mat.canDark, `canister_R_band${y > 0 ? 1 : 0}`, { parent: metal, p: [0, y, 0], ol: 0.6 });

    const barrel = group('canister_L', pack, V(0.54, 0.99, -0.06)); barrel.rotation.set(0.25, 0, -0.72);
    mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 28), mat.wood, 'canister_L_body', { parent: barrel });
    mesh(new THREE.CylinderGeometry(0.168, 0.168, 0.06, 28), mat.woodLid, 'canister_L_lid', { parent: barrel, p: [0, 0.13, 0] });
    mesh(new THREE.TorusGeometry(0.11, 0.014, 8, 28).rotateX(Math.PI / 2), mat.woodDark, 'canister_L_lid_ring', { parent: barrel, p: [0, 0.162, 0], ol: 0.6 });
    for (const y of [-0.06, 0.05]) mesh(new THREE.TorusGeometry(0.152, 0.014, 8, 28).rotateX(Math.PI / 2), mat.woodDark, `canister_L_band${y > 0 ? 1 : 0}`, { parent: barrel, p: [0, y, 0], ol: 0.6 });

    for (const side of [1, -1]) {
      const tag = side > 0 ? 'L' : 'R';
      const path = [[0.92, 0.6], [1.15, 0.86], [1.45, 1.04], [1.9, 1.06], [2.3, 0.86], [2.55, 0.6]].map(([a, y]) => [a * side, y]);
      mesh(surfStrip(S, path, { width: 0.09, thick: 0.025, segs: 48 }), mat.strap, `backpack_strap_${tag}`, { parent: pack, ol: 0.7 });
    }
  }

  // ── blaster (local +X = barrel direction) ──
  const weapon = group('weapon', torso, V(0.06, 0.45, 0.66));
  weapon.rotation.set(0, -0.55, -0.12, 'YZX');
  {
    const W = weapon;
    mesh(roundedBox(0.46, 0.19, 0.19, 0.05), mat.gun, 'weapon_receiver', { parent: W, p: [-0.12, 0, 0] });
    mesh(cylX(0.088, 0.088, 0.1, 22), mat.gunMid, 'weapon_stock_cap', { parent: W, p: [-0.38, 0, 0] });
    mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.08, 12), mat.gunEdge, 'weapon_knob', { parent: W, p: [-0.38, 0.11, 0] });
    mesh(sphere(0.036, 12, 8), mat.gunEdge, 'weapon_knob_top', { parent: W, p: [-0.38, 0.155, 0] });
    mesh(roundedBox(0.28, 0.045, 0.09, 0.012), mat.gunMid, 'weapon_rail', { parent: W, p: [-0.12, 0.115, 0] });
    for (const z of [1, -1]) {
      mesh(cylZ(0.055, 0.055, 0.02, 20), mat.gunEdge, `weapon_port_${z > 0 ? 'a' : 'b'}`, { parent: W, p: [-0.2, 0.0, 0.1 * z] });
      const hose = new THREE.CatmullRomCurve3([V(-0.2, -0.02, 0.108 * z), V(-0.12, -0.06, 0.112 * z), V(-0.04, -0.02, 0.108 * z), V(0.04, -0.05, 0.1 * z)]);
      mesh(new THREE.TubeGeometry(hose, 24, 0.013, 8), mat.gunEdge, `weapon_hose_${z > 0 ? 'a' : 'b'}`, { parent: W, ol: 0.6 });
      mesh(new THREE.BoxGeometry(0.11, 0.022, 0.012), mat.glowP, `weapon_light_p_${z > 0 ? 'a' : 'b'}`, { parent: W, p: [0.2, -0.01, 0.084 * z], noOutline: true });
      mesh(new THREE.BoxGeometry(0.1, 0.022, 0.012), mat.glowG, `weapon_light_g_${z > 0 ? 'a' : 'b'}`, { parent: W, p: [0.33, -0.01, 0.084 * z], noOutline: true });
    }
    mesh(cylX(0.1, 0.1, 0.05, 24), mat.gunEdge, 'weapon_collar', { parent: W, p: [0.11, 0, 0] });
    mesh(cylX(0.085, 0.085, 0.34, 24), mat.gunMid, 'weapon_barrel', { parent: W, p: [0.27, 0, 0] });
    for (let i = 0; i < 5; i++) mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 10), mat.hole, `weapon_vent_${i}`, { parent: W, p: [0.16 + i * 0.055, 0.083, 0], noOutline: true });
    mesh(cylX(0.1, 0.1, 0.075, 24), mat.gun, 'weapon_muzzle_body', { parent: W, p: [0.47, 0, 0] });
    mesh(new THREE.TorusGeometry(0.075, 0.02, 10, 28).rotateY(Math.PI / 2), mat.glowG, 'weapon_muzzle_ring', { parent: W, p: [0.51, 0, 0], noOutline: true });
    mesh(cylX(0.058, 0.058, 0.01, 24), mat.glowG, 'weapon_muzzle_glow', { parent: W, p: [0.505, 0, 0], noOutline: true });
    mesh(roundedBox(0.04, 0.06, 0.03, 0.008), mat.gunEdge, 'weapon_sight', { parent: W, p: [0.44, 0.1, 0] });
    mesh(roundedBox(0.17, 0.08, 0.1, 0.02), mat.gun, 'weapon_foregrip', { parent: W, p: [0.28, -0.11, 0] });
    mesh(roundedBox(0.09, 0.19, 0.1, 0.025), mat.gun, 'weapon_grip', { parent: W, p: [-0.21, -0.15, 0], r: [0, 0, -0.25] });
    group('weapon_muzzle', W, V(0.53, 0, 0));          // spawn point for shots / muzzle flash
  }
  weapon.updateMatrix();
  const W2M = (x, y, z) => V(x, y, z).applyMatrix4(weapon.matrix);   // weapon-local → model space

  // ── arms: long noodle arms wrapped around the blaster ──
  const arms = {};
  for (const side of [-1, 1]) {
    const tag = side > 0 ? 'L' : 'R';
    const Sh = V(0.53 * side, 0.8, 0.1);
    const target = side < 0 ? W2M(-0.23, -0.16, 0.0) : W2M(0.28, -0.17, 0.0);
    const L1 = 0.47, L2 = 0.46;
    const E = solveElbow(Sh, target, L1, L2, V(side * 1, -0.35, side > 0 ? 0.05 : -0.15));
    const H = E.clone().add(target.clone().sub(E).normalize().multiplyScalar(L2));
    const ch = limbChain(tag, torso, Sh, E, H, 0.112, 0.1, mat.skin);
    arms[tag] = ch;
    mesh(sphere(0.12, 20, 14), mat.skin, `hand_${tag}_mesh`, { parent: ch.hand, s: [1.05, 0.9, 1] });
  }
  torso.updateMatrixWorld(true);
  // fingers wrapped around grip (right hand) and fore-grip (left hand), defined in weapon space
  {
    const finger = () => new THREE.CapsuleGeometry(0.034, 0.07, 4, 10);
    const gripAxis = V(Math.sin(0.25), -Math.cos(0.25), 0); // along the raked grip
    for (let i = 0; i < 3; i++) {
      const c = V(-0.21, -0.1, 0).addScaledVector(gripAxis, -0.02 + i * 0.05);
      for (const z of [1, -1]) addAtWorld(arms.R.hand, mesh(finger(), mat.skin, `hand_R_finger${i}${z > 0 ? 'a' : 'b'}`), W2M(c.x - 0.05, c.y, c.z + 0.07 * z), V(1, 0, 0).transformDirection(weapon.matrix));
    }
    addAtWorld(arms.R.hand, mesh(finger(), mat.skin, 'hand_R_thumb'), W2M(-0.14, 0.04, 0.09), V(1, 0.3, 0).transformDirection(weapon.matrix));
    for (let i = 0; i < 3; i++) {
      addAtWorld(arms.L.hand, mesh(finger(), mat.skin, `hand_L_finger${i}`), W2M(0.2 + i * 0.065, -0.06, 0.1), V(0, 1, 0.25).transformDirection(weapon.matrix));
    }
    addAtWorld(arms.L.hand, mesh(finger(), mat.skin, 'hand_L_thumb'), W2M(0.3, -0.05, -0.1), V(0, 1, -0.2).transformDirection(weapon.matrix));
  }
  // spots on the arms
  {
    const R = rng(5), base = sphere(1, 8, 6);
    for (const tag of ['L', 'R']) for (const [node, len, rr] of [[arms[tag].arm, arms[tag].L1, 0.112], [arms[tag].fore, arms[tag].L2, 0.1]]) {
      const list = [];
      for (let i = 0; i < 6; i++) {
        const a = R() * TAU, y = -R() * len, s = 0.01 + R() * 0.022, n = V(Math.cos(a), 0, Math.sin(a));
        list.push(base.clone().applyMatrix4(new THREE.Matrix4().compose(n.clone().multiplyScalar(rr).add(V(0, y, 0)), basisQuat(n), V(s, s, s * 0.3))));
      }
      mesh(mergeGeos(list), mat.spotB, `${node.name}_spots`, { parent: node, noOutline: true });
    }
  }

  // ── cilia (little wiggly hairs): chains of 3 pivots each ──
  const cilia = [];
  {
    const R = rng(23);
    const mkCilium = (name, parent, len, r0, bend) => {
      const root = group(name, parent), segs = [], n = 3, L = len / n;
      let cur = root;
      for (let k = 0; k < n; k++) {
        const seg = group(`${name}_s${k}`, cur, k ? V(0, L, 0) : null);
        seg.rotation.z = bend * (0.45 + 0.45 * k);
        const r = r0 * (1 - 0.12 * k);
        mesh(new THREE.CylinderGeometry(r * 0.88, r, L, 8, 1, true).translate(0, L / 2, 0), mat.hair, `${name}_m${k}`, { parent: seg, ol: 0.5 });
        mesh(sphere(r * 0.9, 8, 5), mat.hair, `${name}_j${k}`, { parent: seg, p: [0, L, 0], ol: 0.5 });
        segs.push(seg); cur = seg;
      }
      mesh(sphere(r0 * 1.15, 10, 8), mat.hair, `${name}_tip`, { parent: cur, p: [0, L, 0], ol: 0.5 });
      return { root, segs };
    };
    const anchors = [
      // top of the head (behind goggles)
      [0.05, 1.625, 0.22], [-0.9, 1.6, 0.2], [0.95, 1.6, 0.2], [-1.9, 1.585, 0.19], [1.85, 1.585, 0.19], [2.8, 1.59, 0.18], [-2.7, 1.6, 0.17],
      // head sides
      [1.5, 1.42, 0.17], [-1.5, 1.42, 0.17], [1.58, 1.23, 0.15], [-1.58, 1.23, 0.15], [1.62, 1.05, 0.13], [-1.62, 1.05, 0.13],
      // back
      [2.3, 1.3, 0.15], [-2.3, 1.3, 0.15], [Math.PI, 1.05, 0.15], [2.5, 0.7, 0.13], [-2.5, 0.7, 0.13],
      // lower body
      [1.45, 0.42, 0.13], [-1.45, 0.42, 0.13], [1.25, 0.27, 0.11], [-1.25, 0.27, 0.11], [1.8, 0.32, 0.12], [-1.8, 0.32, 0.12],
    ];
    anchors.forEach(([phi, y, len], i) => {
      const p = S.P(phi, y), n = S.N(phi, y), dir = n.clone().lerp(UP, 0.25).normalize();
      const c = mkCilium(`cilia_${String(i).padStart(2, '0')}`, torso, len, 0.026, (0.35 + R() * 0.35) * (R() < 0.5 ? -1 : 1));
      c.root.position.copy(p).addScaledVector(n, -0.012);
      c.root.quaternion.setFromUnitVectors(UP, dir).multiply(new THREE.Quaternion().setFromAxisAngle(UP, R() * TAU));
      cilia.push(c);
    });
    // a few on the arms
    for (const tag of ['L', 'R']) {
      const side = tag === 'L' ? 1 : -1;
      for (const [node, y, len] of [[arms[tag].arm, -0.18, 0.12], [arms[tag].arm, -0.33, 0.11], [arms[tag].fore, -0.15, 0.1]]) {
        const outward = V(side, -0.2, -0.3).normalize();
        node.updateWorldMatrix(true, false);
        const qi = node.getWorldQuaternion(new THREE.Quaternion()).invert();
        const ld = outward.clone().applyQuaternion(qi); ld.y = 0; ld.normalize();
        const c = mkCilium(`cilia_${String(cilia.length).padStart(2, '0')}`, node, len, 0.024, (0.4 + R() * 0.3) * side);
        c.root.position.set(ld.x * 0.1, y, ld.z * 0.1);
        c.root.quaternion.setFromUnitVectors(UP, ld.clone().add(V(0, 0.25, 0)).normalize());
        cilia.push(c);
      }
    }
  }

  // ── legs: short stubby feet ──
  const legs = {};
  for (const side of [1, -1]) {
    const tag = side > 0 ? 'L' : 'R';
    const leg = group(`leg_${tag}`, root, V(0.27 * side, 0.3, 0));
    mesh(new THREE.CapsuleGeometry(0.145, 0.1, 6, 16), mat.skin, `leg_${tag}_mesh`, { parent: leg, p: [0, -0.08, 0] });
    const foot = group(`foot_${tag}`, leg, V(0, -0.19, 0.04));
    mesh(sphere(1, 24, 16), mat.skin, `foot_${tag}_mesh`, { parent: foot, s: [0.175, 0.11, 0.215] });
    legs[tag] = { leg, foot };
  }

  // ── re-base torso so it pivots at the bottom of the body (good for squash & stretch / lean) ──
  torso.position.y = TORSO_Y;
  torso.children.forEach((c) => { c.position.y -= TORSO_Y; });

  if (o.outline) addOutlines(root, o.outlineColor, o.outlineWidth);
  root.userData = {
    character: 'PurpleGerm', units: 'metres-ish, height ≈ 1.85', forward: '+Z', up: '+Y',
    rig: PURPLE_GERM_RIG_NAMES,
  };
  Object.defineProperty(root, 'parts', {
    enumerable: false,
    value: {
      torso, face, mouth: face.getObjectByName('mouth'), goggles, backpack: pack, weapon, muzzle: weapon.getObjectByName('weapon_muzzle'),
      eyes: { L: root.getObjectByName('eye_L'), R: root.getObjectByName('eye_R') },
      irises: { L: root.getObjectByName('iris_L'), R: root.getObjectByName('iris_R') },
      eyelids: { L: root.getObjectByName('eyelid_L'), R: root.getObjectByName('eyelid_R') },
      brows: { L: root.getObjectByName('brow_L'), R: root.getObjectByName('brow_R') },
      arms: { L: arms.L.arm, R: arms.R.arm }, forearms: { L: arms.L.fore, R: arms.R.fore }, hands: { L: arms.L.hand, R: arms.R.hand },
      legs: { L: legs.L.leg, R: legs.R.leg }, feet: { L: legs.L.foot, R: legs.R.foot },
      canisters: { L: pack.getObjectByName('canister_L'), R: pack.getObjectByName('canister_R') },
      cilia: cilia.map((c) => c.segs),
    },
  });
  captureRest(root);
  return root;
}
