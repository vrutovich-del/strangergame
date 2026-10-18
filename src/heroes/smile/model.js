/**
 * ════════════════════════════════════════════════════════════════════════════
 *  SMILEY (Смайлик) — 3D character model (Three.js, procedural, no textures)
 *  Character #2 of the brawler game. Self-contained ES module, depends only on `three` (r150+).
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  USAGE
 *    import * as THREE from 'three';
 *    import { createSmiley, setBlink, setLook, resetPose } from './smiley.js';
 *    const smiley = createSmiley();               // THREE.Group, feet on y = 0, faces +Z
 *    scene.add(smiley);
 *    // smiley.parts.<…>  → direct references to every animatable pivot (see RIG below)
 *    // smiley.getObjectByName('arm_L') also works (same names survive GLB export).
 *
 *  OPTIONS  createSmiley({ toon = true, outline = true, outlineWidth = 0.012, outlineColor })
 *    toon     – MeshToonMaterial (3-step cel shading). false → MeshStandardMaterial (PBR, used for .glb).
 *    outline  – dark inverted-hull outlines (children named *_outline). Turn off for export.
 *
 *  SPACE & SCALE
 *    +Y up, character looks toward +Z. Origin = centre between the feet on the ground.
 *    Height ≈ 1.85 (top of the cap), body/head egg ≈ 1.24 wide, ~1 unit = 1 "metre".
 *    "_L" / "_R" are the CHARACTER's left / right:  _L = +X side,  _R = −X side.
 *
 *  LOOK
 *    Yellow smiley egg, angry brows, friendly open smile (upper teeth + tongue), backwards cap,
 *    low navy pants, two crossed leather straps with a buckle and pouches, three emoji grenades
 *    hanging at the hips, thin arms with big brown gloves (flexing), brown boots.
 *
 *  RIG (all are THREE.Group pivots; rotate them, the meshes inside follow)
 *    Smiley (root) ................ move / turn the whole character here
 *    ├─ torso ...................... pivot at bottom of the egg (y = 0.30). Squash & stretch:
 *    │                               torso.scale.set(1+k, 1-k, 1+k);  lean: torso.rotation.x / z
 *    │  ├─ face
 *    │  │  ├─ eye_L / eye_R ........ eyeball pivots
 *    │  │  │  ├─ iris_L / iris_R ... rotate to look around (x: down+, y: toward +X) — or use setLook()
 *    │  │  │  └─ eyelid_L / _R ..... rotation.x: −0.30 = rest (squint) … 1.68 = closed — or setBlink()
 *    │  │  ├─ brow_L / brow_R ...... pivot at brow centre: position.y (+0.03 raise), rotation.z (tilt)
 *    │  │  ├─ mouth ................ smile decal group (scale.y 0.85…1.25 for talk / laugh)
 *    │  │  └─ blush_L / blush_R
 *    │  ├─ cap ..................... backwards baseball cap, pivot on top of the head (y ≈ 1.42):
 *    │  │  └─ cap_brim              cap.rotation.z / .x to wobble it on landing
 *    │  ├─ vest (= the pants), vest_trim (waistband), bandolier_A / bandolier_B, buckle, pouch_1, pouch_2
 *    │  ├─ grenade_1 (grumpy) / grenade_2 (grin) / grenade_3 (sad) — hanging on the straps.
 *    │  │     Pivot = hook point, swing with rotation.x/z. To throw: scene.attach(grenade) then move it.
 *    │  │     grenade_N_body is the grenade itself (clone it for projectiles).
 *    │  ├─ arm_L / arm_R ........... shoulder pivots, local −Y runs down the arm
 *    │  │  └─ forearm_L / _R ....... elbow pivots (brown glove gauntlet inside)
 *    │  │     └─ hand_L / hand_R ... wrist pivots (glove fist + fingers)
 *    ├─ leg_L / leg_R .............. hip pivots (rotation.x swings the leg for walking)
 *    │  └─ foot_L / foot_R ......... boots (pivot on the ground under the ankle)
 *
 *  ANIMATION NOTES
 *    • setBlink / setLook / resetPose are identical in both character files — import them from either one.
 *      setBlink and setLook also work on models loaded from the .glb (they find nodes by name).
 *    • Rest pose: "flex" — both fists raised at the sides.
 *    • resetPose(model) restores the rest pose captured at build time (every node except the root,
 *      so the character keeps its place in the level).
 *    • Throw: rotate arm_R in its parent's space, e.g.
 *        arm_R.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), a))
 *      with a: 0 → +1.3 (wind-up back) → −1.2 (release) → 0; spawn a clone of grenade_N_body at hand_R.
 *    • Walk: legs rotation.x = ±0.5·sin(t·10), torso.position.y bob, grenades swing with a small lag.
 */
import * as THREE from 'three';

export const SMILEY_PALETTE = {
  skinTop: 0xffd83f, skinMid: 0xffbf22, skinBottom: 0xf28a17, limb: 0xffbb22, lid: 0xffc62e, forehead: 0xffd53c,
  sclera: 0xfbf6ec, irisRing: 0x2a1209, iris: 0x5a2a12, pupil: 0x120804,
  brow: 0x2b1609, line: 0x3b1708, teeth: 0xfffbf1, toothGap: 0xd8cbbd, mouthIn: 0x6b1a17, tongue: 0xe8636b, blush: 0xff6f3a,
  vest: 0x323e5c, vestTrim: 0x222b42, strap: 0x6d3b1f, pouch: 0x7b4524, pouchFlap: 0x5e3219, metal: 0xc3c7cf, dark: 0x2a1a12,
  capBlue: 0x3f74b3, capOrange: 0xf07b28, capUnder: 0xb4531a, capSeam: 0x22426b,
  glove: 0x4a2a1a, gloveCuff: 0x5f3a24, boot: 0x734326, bootSole: 0x3b2416, bootCuff: 0x8d5833, lace: 0x2e1a0e,
  grenade: 0xffc22a, grenadeCap: 0x8e939c, grenadeTip: 0xa8452c,
};

/** Names of the animatable nodes (also stored in model.userData.rig, survives GLB export). */
export const SMILEY_RIG_NAMES = {
  root: 'Smiley', torso: 'torso', face: 'face', mouth: 'mouth', cap: 'cap', capBrim: 'cap_brim',
  eyes: ['eye_L', 'eye_R'], irises: ['iris_L', 'iris_R'], eyelids: ['eyelid_L', 'eyelid_R'], brows: ['brow_L', 'brow_R'],
  arms: ['arm_L', 'arm_R'], forearms: ['forearm_L', 'forearm_R'], hands: ['hand_L', 'hand_R'],
  legs: ['leg_L', 'leg_R'], feet: ['foot_L', 'foot_R'], grenades: ['grenade_1', 'grenade_2', 'grenade_3'], pouches: ['pouch_1', 'pouch_2'],
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
// ───────────────────────────── SMILEY ───────────────────────────────────
export function createSmiley(options = {}) {
  const o = { toon: true, outline: true, outlineWidth: 0.012, outlineColor: 0x2a1206, ...options };
  const M = makeMaterials('smiley_', o.toon);
  const C = { ...SMILEY_PALETTE, ...(o.palette || {}) }; // o.palette — перекраска для скинов
  const mat = {
    skin: M('skin', 0xffffff, { vc: true, rough: 0.42 }), limb: M('limb', C.limb, { rough: 0.45 }),
    lid: M('skin_lid', C.lid, { rough: 0.45, double: true }), forehead: M('forehead', C.forehead, { rough: 0.45 }),
    sclera: M('sclera', C.sclera, { rough: 0.25 }), irisRing: M('iris_ring', C.irisRing), iris: M('iris', C.iris, { rough: 0.3 }),
    pupil: M('pupil', C.pupil, { rough: 0.2 }), shine: M('shine', 0xffffff, { emissive: 0xffffff, ei: 0.6 }),
    brow: M('brow', C.brow, { rough: 0.6 }), line: M('line', C.line), teeth: M('teeth', C.teeth, { rough: 0.3 }), toothGap: M('tooth_gap', C.toothGap, { rough: 0.4 }), mouthIn: M('mouth_inner', C.mouthIn, { rough: 0.6 }), tongue: M('tongue', C.tongue, { rough: 0.5 }), blush: M('blush', C.blush, { rough: 0.6 }),
    vest: M('vest', C.vest, { rough: 0.8 }), vestTrim: M('vest_trim', C.vestTrim, { rough: 0.8 }),
    strap: M('leather', C.strap, { rough: 0.7 }), pouch: M('pouch', C.pouch, { rough: 0.75 }), pouchFlap: M('pouch_flap', C.pouchFlap, { rough: 0.75 }),
    metal: M('metal', C.metal, { rough: 0.3, metal: 0.7 }), dark: M('dark', C.dark, { rough: 0.6 }),
    capBlue: M('cap_blue', C.capBlue, { rough: 0.7 }), capOrange: M('cap_orange', C.capOrange, { rough: 0.7 }),
    capUnder: M('cap_under', C.capUnder, { rough: 0.7 }), capSeam: M('cap_seam', C.capSeam, { rough: 0.7 }),
    stickerA: M('sticker_white', 0xfff6e8, { rough: 0.5 }), stickerB: M('sticker_orange', C.capOrange, { rough: 0.5 }), stickerC: M('sticker_blue', 0x7fd6f5, { rough: 0.5 }),
    glove: M('glove', C.glove, { rough: 0.6 }), gloveCuff: M('glove_cuff', C.gloveCuff, { rough: 0.6 }),
    boot: M('boot', C.boot, { rough: 0.6 }), bootSole: M('boot_sole', C.bootSole, { rough: 0.8 }), bootCuff: M('boot_cuff', C.bootCuff, { rough: 0.6 }), lace: M('lace', C.lace, { rough: 0.8 }),
    grenade: M('grenade', C.grenade, { rough: 0.4 }), grenadeCap: M('grenade_cap', C.grenadeCap, { rough: 0.35, metal: 0.6 }), grenadeTip: M('grenade_tip', C.grenadeTip, { rough: 0.5 }),
  };

  const root = group('Smiley');
  const torso = group('torso', root);
  const TORSO_Y = 0.3;

  // ── body = head: one big egg ──
  const HC = V(0, 1.0, 0), RX = 0.62, RY = 0.7, RZ = 0.58;
  const E = (phi, t) => V(RX * Math.sin(t) * Math.sin(phi), HC.y + RY * Math.cos(t), RZ * Math.sin(t) * Math.cos(phi));
  const nE = (phi, t) => { const p = E(phi, t).sub(HC); return V(p.x / (RX * RX), p.y / (RY * RY), p.z / (RZ * RZ)).normalize(); };
  const tOf = (y) => Math.acos(THREE.MathUtils.clamp((y - HC.y) / RY, -1, 1));
  const S = new Surface(E, HC);
  {
    const g = new THREE.SphereGeometry(1, 72, 54); g.scale(RX, RY, RZ); g.translate(0, HC.y, 0);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    const top = new THREE.Color(C.skinTop), mid = new THREE.Color(C.skinMid), bot = new THREE.Color(C.skinBottom), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), f = THREE.MathUtils.smoothstep(y, 0.35, 1.55);
      if (f > 0.5) c.copy(mid).lerp(top, (f - 0.5) * 2); else c.copy(bot).lerp(mid, f * 2);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    mesh(g, mat.skin, 'body', { parent: torso });
  }

  // ── face ──
  const face = group('face', torso);
  for (const side of [1, -1]) {
    const tag = side > 0 ? 'L' : 'R';
    const phi = 0.36 * side, t = tOf(1.19), p = S.P(phi, t), n = S.N(phi, t);
    const eye = group(`eye_${tag}`, face, p.clone().addScaledVector(n, -0.035));
    eye.quaternion.copy(basisQuat(n.clone().lerp(FWD, 0.4).normalize()));
    const shape = group(`eye_${tag}_shape`, eye); shape.scale.set(0.15, 0.125, 0.085);
    mesh(sphere(1, 32, 24), mat.sclera, `eye_${tag}_ball`, { parent: shape, ol: 0.6 });
    const iris = group(`iris_${tag}`, shape);
    iris.rotation.set(0.1, -0.22 * side, 0); iris.userData.rest = [0.1, -0.22 * side];
    mesh(capZ(1.012, 0.62), mat.irisRing, `iris_${tag}_ring`, { parent: iris, noOutline: true });
    mesh(capZ(1.02, 0.54), mat.iris, `iris_${tag}_color`, { parent: iris, noOutline: true });
    mesh(capZ(1.03, 0.3), mat.pupil, `pupil_${tag}`, { parent: iris, noOutline: true });
    const hl = V(-0.3, 0.42, 0.86).normalize().multiplyScalar(1.03);
    mesh(sphere(0.13, 12, 8), mat.shine, `eye_${tag}_shine`, { parent: shape, p: hl.toArray(), s: [1, 1, 0.25], q: basisQuat(hl), noOutline: true });
    const tilt = group(`eyelid_${tag}_tilt`, shape); tilt.rotation.z = 0.42 * side;
    const lid = mesh(hemiUp(1.08), mat.lid, `eyelid_${tag}`, { parent: tilt, ol: 0.6, r: [-0.3, 0, 0] });
    lid.userData.restX = -0.3;

    // chunky angry brow (inner end low)
    const a = 0.33 * side, bt = tOf(1.375);
    const pts = rrShape(0.31, 0.075, 0.035).getPoints(6).map((q) => q.clone().rotateAround(new THREE.Vector2(), a));
    const bgeo = conform(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.014, bevelSegments: 2 }),
      S, 0.38 * side, bt, -0.012, false);
    pivotMesh(mesh(bgeo, mat.brow, `brow_${tag}`, { parent: face, ol: 0.7 }), S.P(0.38 * side, bt));

    // cheek blush
    const bl = mesh(sphere(1, 20, 12), mat.blush, `blush_${tag}`, { parent: face, s: [0.085, 0.055, 0.016], noOutline: true });
    S.place(bl, 0.8 * side, tOf(1.03), 0.0);
  }

  // friendly open smile: upper teeth row, tongue, soft dimples in the corners
  {
    const mt = tOf(0.89), mph = 0;
    const up = [[-0.25, 0.06], [-0.16, 0.026], [-0.06, 0.013], [0.06, 0.013], [0.16, 0.026], [0.25, 0.06]];
    const lo = [[0.25, 0.06], [0.205, -0.03], [0.12, -0.094], [0.0, -0.117], [-0.12, -0.094], [-0.205, -0.03], [-0.25, 0.06]];
    const sample = (pts) => new THREE.SplineCurve(pts.map(([u, v]) => new THREE.Vector2(u, v))).getPoints(200);
    const upS = sample(up);
    const vAt = (arr, u) => { for (let i = 1; i < arr.length; i++) if (arr[i].x >= u) { const a = arr[i - 1], b = arr[i]; return a.y + (b.y - a.y) * (u - a.x) / Math.max(b.x - a.x, 1e-9); } return arr[arr.length - 1].y; };
    const mk = (sx, sy) => {
      const f = ([u, v]) => new THREE.Vector2(u * sx, (v + 0.03) * sy - 0.03);
      const sh = new THREE.Shape(); sh.moveTo(...f(up[0]).toArray());
      sh.splineThru(up.slice(1).map(f)); sh.splineThru(lo.slice(1).map(f));
      return sh;
    };
    // thin stroke along a polyline (for dimples)
    const stroke = (pts, w) => {
      const L = [], R = [];
      pts.forEach((p, i) => {
        const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
        const t = new THREE.Vector2(b[0] - a[0], b[1] - a[1]).normalize(), n = new THREE.Vector2(-t.y, t.x);
        const k = w * (0.35 + 0.65 * Math.sin(Math.PI * (0.15 + 0.7 * i / (pts.length - 1))));
        L.push(new THREE.Vector2(p[0] + n.x * k / 2, p[1] + n.y * k / 2)); R.push(new THREE.Vector2(p[0] - n.x * k / 2, p[1] - n.y * k / 2));
      });
      return new THREE.Shape([...L, ...R.reverse()]);
    };
    const mouth = group('mouth', face, S.P(mph, mt));
    const add = (shape, m, name, lift) => {
      const g = conform(new THREE.ShapeGeometry(shape, 10), S, mph, mt, lift);
      g.translate(-mouth.position.x, -mouth.position.y, -mouth.position.z);
      return mesh(g, m, name, { parent: mouth, noOutline: true });
    };
    add(mk(1.06, 1.12), mat.line, 'mouth_line', 0.004);
    add(mk(1.0, 1.0), mat.mouthIn, 'mouth_inner', 0.007);
    const tg = new THREE.Shape(); tg.absellipse(0, -0.079, 0.105, 0.036, 0, TAU, false, 0);
    add(tg, mat.tongue, 'tongue', 0.01);
    // upper teeth: one rounded strip that follows the upper lip
    const TW = 0.205, top = [], bot = [];
    for (let i = 0; i <= 32; i++) {
      const u = -TW + (2 * TW * i) / 32, v = vAt(upS, u) - 0.004, th = 0.046 * (1 - (u / TW) ** 6);
      top.push(new THREE.Vector2(u, v)); bot.push(new THREE.Vector2(u, v - Math.max(th, 0.004)));
    }
    add(new THREE.Shape([...bot, ...top.reverse()]), mat.teeth, 'teeth', 0.012);
    [-0.14, -0.07, 0, 0.07, 0.14].forEach((u, i) => {
      const v1 = vAt(upS, u) - 0.006, v0 = v1 - 0.046 * (1 - (u / TW) ** 6) + 0.012, w = i === 2 ? 0.0045 : 0.0035;
      add(new THREE.Shape([new THREE.Vector2(u - w, v0), new THREE.Vector2(u + w, v0), new THREE.Vector2(u + w, v1), new THREE.Vector2(u - w, v1)]), mat.toothGap, `tooth_gap_${i}`, 0.014);
    });
    for (const s of [1, -1]) {
      add(stroke([[0.248 * s, 0.072], [0.268 * s, 0.09], [0.282 * s, 0.112], [0.286 * s, 0.135]], 0.016), mat.line, `dimple_${s > 0 ? 'L' : 'R'}`, 0.006);
    }
  }

  // ── pants (navy, low waist; nodes keep the name `vest`) ──
  const wrapPhi = (p) => Math.atan2(Math.sin(p), Math.cos(p));
  const vestTopY = (phi) => 0.635 + 0.04 * THREE.MathUtils.smoothstep(Math.min(Math.abs(wrapPhi(phi)) / 1.4, 1), 0, 1);
  const VEST = 0.022;
  {
    const VS = new Surface((phi, s) => {
      const t0 = tOf(vestTopY(phi)), t = t0 + s * (Math.PI - 0.004 - t0);
      return E(phi, t).addScaledVector(nE(phi, t), VEST);
    }, HC);
    mesh(surfPatch(VS, -Math.PI, Math.PI, 0, 1, 96, 22), mat.vest, 'vest', { parent: torso });
    const edge = [];
    for (let i = 0; i < 96; i++) { const phi = -Math.PI + (i / 96) * TAU, t = tOf(vestTopY(phi)); edge.push(E(phi, t).addScaledVector(nE(phi, t), VEST)); }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true), 160, 0.024, 8, true), mat.vestTrim, 'vest_trim', { parent: torso, ol: 0.7 });
  }

  // ── crossed leather straps, buckle, pouches ──
  const strapY = { A: (phi) => 0.56 - 0.13 * Math.sin(phi), B: (phi) => 0.5 + 0.11 * Math.sin(phi) };
  const STRAP_LIFT = VEST + 0.004, STRAP_T = 0.024;
  for (const k of ['A', 'B']) {
    const path = []; for (let i = 0; i <= 24; i++) { const phi = -Math.PI + (i / 24) * TAU; path.push([phi, tOf(strapY[k](phi))]); }
    mesh(surfStrip(S, path, { width: 0.078, thick: STRAP_T, lift: STRAP_LIFT, segs: 128 }), mat.strap, `bandolier_${k}`, { parent: torso, ol: 0.7 });
  }
  const onStrap = (k, phi, extra) => {
    const t = tOf(strapY[k](phi)), p = S.P(phi, t), n = S.N(phi, t);
    const p2 = S.P(phi + 0.01, tOf(strapY[k](phi + 0.01))), T = p2.sub(p).normalize();
    return { p: p.addScaledVector(n, STRAP_LIFT + STRAP_T + extra), n, T };
  };
  {
    const { p, n, T } = onStrap('A', -0.72, 0.006);
    const buckle = group('buckle', torso, p); buckle.quaternion.copy(basisQuat(n, new THREE.Vector3().crossVectors(n, T)));
    mesh(new THREE.TorusGeometry(0.068, 0.017, 6, 4).rotateZ(Math.PI / 4).scale(1.2, 1, 1), mat.metal, 'buckle_frame', { parent: buckle });
    mesh(roundedBox(0.075, 0.06, 0.012, 0.004), mat.dark, 'buckle_plate', { parent: buckle, p: [0, 0, -0.004], noOutline: true });
    mesh(new THREE.BoxGeometry(0.018, 0.07, 0.016), mat.metal, 'buckle_prong', { parent: buckle, p: [-0.02, 0, 0.006], noOutline: true });
  }
  for (const [name, k, phi, w, h] of [['pouch_1', 'B', 0.92, 0.13, 0.12], ['pouch_2', 'B', -0.58, 0.14, 0.15]]) {
    const { p, n } = onStrap(k, phi, 0.026);
    const pouch = group(name, torso, p); pouch.quaternion.copy(basisQuat(n.clone().setY(n.y * 0.4).normalize()));
    mesh(roundedBox(w, h, 0.07, 0.022), mat.pouch, `${name}_bag`, { parent: pouch });
    mesh(roundedBox(w + 0.012, h * 0.42, 0.078, 0.02), mat.pouchFlap, `${name}_flap`, { parent: pouch, p: [0, h * 0.3, 0.004] });
    mesh(sphere(0.013, 10, 8), mat.metal, `${name}_button`, { parent: pouch, p: [0, h * 0.14, 0.045], noOutline: true });
  }

  // ── grenades hanging from the straps (detach with scene.attach(grenade) to throw) ──
  const grenades = [];
  const faceKit = {
    eyes: (g, r, lidded) => { for (const s of [1, -1]) { const d = V(0.36 * s, 0.22, 0).setZ(Math.sqrt(1 - 0.36 * 0.36 - 0.22 * 0.22)); mesh(sphere(1, 12, 8), mat.pupil, `${g.name}_eye${s > 0 ? 'L' : 'R'}`, { parent: g, p: d.clone().multiplyScalar(r).toArray(), q: basisQuat(d), s: lidded ? [0.016, 0.009, 0.006] : [0.014, 0.019, 0.006], noOutline: true }); } },
    brows: (g, r, ang, y = 0.55) => { for (const s of [1, -1]) { const d = V(0.36 * s, y, 0).setZ(Math.sqrt(1 - 0.36 * 0.36 - y * y)); const m = mesh(new THREE.BoxGeometry(0.036, 0.009, 0.008), mat.pupil, `${g.name}_brow${s > 0 ? 'L' : 'R'}`, { parent: g, p: d.clone().multiplyScalar(r + 0.002).toArray(), q: basisQuat(d), noOutline: true }); m.rotateZ(ang * s); } },
  };
  const makeGrenade = (name, k, phi, mood) => {
    const { p, n } = onStrap(k, phi, -0.004);
    const out = n.clone().setY(0).normalize();
    const b = group(name, torso, p); b.quaternion.copy(basisQuat(out));
    mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 14).rotateY(Math.PI / 2), mat.metal, `${name}_hook`, { parent: b, p: [0, -0.01, 0.01], ol: 0.5 });
    const body = group(`${name}_body`, b, V(0, -0.125, 0.03));
    const r = 0.088;
    mesh(sphere(r, 24, 16), mat.grenade, `${name}_shell`, { parent: body });
    mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.045, 14), mat.grenadeCap, `${name}_neck`, { parent: body, p: [0, r + 0.012, 0] });
    mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.022, 14), mat.grenadeTip, `${name}_tip`, { parent: body, p: [0, r + 0.044, 0] });
    mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 16), mat.metal, `${name}_pin_ring`, { parent: body, p: [0.045, r + 0.02, 0], r: [0, Math.PI / 2, 0.4], ol: 0.5 });
    const f = group(`${name}_face`, body);
    if (mood === 'grin') {
      faceKit.eyes(f, r, false); faceKit.brows(f, r, -0.55);
      const d = V(0, -0.3, Math.sqrt(1 - 0.09));
      mesh(new THREE.CircleGeometry(0.034, 16, Math.PI, Math.PI), mat.teeth, `${name}_grin`, { parent: f, p: d.clone().multiplyScalar(r + 0.002).toArray(), q: basisQuat(d), noOutline: true });
      mesh(new THREE.TorusGeometry(0.034, 0.005, 6, 16, Math.PI).rotateZ(Math.PI), mat.pupil, `${name}_grin_line`, { parent: f, p: d.clone().multiplyScalar(r + 0.003).toArray(), q: basisQuat(d), noOutline: true });
      mesh(new THREE.BoxGeometry(0.068, 0.005, 0.004), mat.pupil, `${name}_grin_top`, { parent: f, p: d.clone().multiplyScalar(r + 0.003).toArray(), q: basisQuat(d), noOutline: true });
    } else if (mood === 'sad') {
      faceKit.eyes(f, r, false); faceKit.brows(f, r, 0.45, 0.5);
      const d = V(0, -0.42, Math.sqrt(1 - 0.42 * 0.42));
      mesh(new THREE.TorusGeometry(0.024, 0.0055, 6, 16, Math.PI), mat.pupil, `${name}_frown`, { parent: f, p: d.clone().multiplyScalar(r + 0.001).toArray(), q: basisQuat(d), noOutline: true });
    } else {
      faceKit.eyes(f, r, true); faceKit.brows(f, r, -0.35, 0.48);
      const d = V(0, -0.33, Math.sqrt(1 - 0.33 * 0.33));
      mesh(new THREE.BoxGeometry(0.04, 0.007, 0.004), mat.pupil, `${name}_mouth`, { parent: f, p: d.clone().multiplyScalar(r + 0.002).toArray(), q: basisQuat(d), noOutline: true });
    }
    grenades.push(b);
    return b;
  };
  makeGrenade('grenade_1', 'B', -0.98, 'grumpy');
  makeGrenade('grenade_2', 'A', 0.42, 'grin');
  makeGrenade('grenade_3', 'A', 0.84, 'sad');

  // ── arms: thin, flexing, big brown gloves ──
  const arms = {};
  for (const side of [1, -1]) {
    const tag = side > 0 ? 'L' : 'R';
    const Sh = V(0.55 * side, 0.72, 0.02), El = V(0.8 * side, 0.5, 0.06), Wr = V(0.86 * side, 0.76, 0.13);
    const ch = limbChain(tag, torso, Sh, El, Wr, 0.052, 0.05, mat.limb);
    arms[tag] = ch;
    const L2 = ch.L2;
    mesh(new THREE.CylinderGeometry(0.108, 0.088, L2 * 0.72, 22), mat.glove, `glove_${tag}_gauntlet`, { parent: ch.fore, p: [0, -L2 * 0.62, 0] });
    mesh(new THREE.TorusGeometry(0.105, 0.022, 8, 24).rotateX(Math.PI / 2), mat.gloveCuff, `glove_${tag}_cuff`, { parent: ch.fore, p: [0, -L2 * 0.26, 0], ol: 0.7 });
    mesh(sphere(1, 24, 18), mat.glove, `glove_${tag}_fist`, { parent: ch.hand, p: [0, -0.095, 0], s: [0.14, 0.15, 0.135] });
  }
  torso.updateMatrixWorld(true);
  for (const side of [1, -1]) {
    const tag = side > 0 ? 'L' : 'R', hand = arms[tag].hand;
    const Fc = hand.localToWorld(V(0, -0.095, 0));
    const dF = V(-0.55 * side, 0, 0.84).normalize(), ax = new THREE.Vector3().crossVectors(UP, dF).normalize();
    for (let k = 0; k < 4; k++) {
      addAtWorld(hand, mesh(new THREE.CapsuleGeometry(0.032, 0.075, 4, 10), mat.limb, `hand_${tag}_finger${k}`),
        Fc.clone().addScaledVector(dF, 0.112).addScaledVector(UP, 0.07 - k * 0.048).addScaledVector(ax, 0.012 * side), ax);
    }
    addAtWorld(hand, mesh(new THREE.CapsuleGeometry(0.029, 0.07, 4, 10), mat.limb, `hand_${tag}_thumb`),
      Fc.clone().addScaledVector(dF, 0.075).addScaledVector(UP, -0.02).addScaledVector(ax, -0.06 * side), UP.clone().addScaledVector(ax, -0.3 * side));
  }

  // ── legs + boots ──
  const legs = {};
  for (const side of [1, -1]) {
    const tag = side > 0 ? 'L' : 'R';
    const leg = group(`leg_${tag}`, root, V(0.3 * side, 0.44, 0));
    mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.22, 16), mat.limb, `leg_${tag}_mesh`, { parent: leg, p: [0, -0.1, 0] });
    const foot = group(`foot_${tag}`, leg, V(0, -0.44, 0)); foot.rotation.y = 0.12 * side;
    mesh(roundedBox(0.25, 0.05, 0.37, 0.02), mat.bootSole, `boot_${tag}_sole`, { parent: foot, p: [0, 0.025, 0.045] });
    mesh(sphere(1, 24, 16), mat.boot, `boot_${tag}_toe`, { parent: foot, p: [0, 0.088, 0.08], s: [0.125, 0.095, 0.17] });
    mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.2, 24), mat.boot, `boot_${tag}_shaft`, { parent: foot, p: [0, 0.15, -0.01] });
    mesh(new THREE.TorusGeometry(0.112, 0.028, 8, 24).rotateX(Math.PI / 2), mat.bootCuff, `boot_${tag}_cuff`, { parent: foot, p: [0, 0.255, -0.01], ol: 0.7 });
    mesh(roundedBox(0.09, 0.12, 0.03, 0.01), mat.bootCuff, `boot_${tag}_tongue`, { parent: foot, p: [0, 0.2, 0.095], r: [-0.15, 0, 0] });
    for (let k = 0; k < 3; k++) for (const s of [1, -1]) {
      mesh(new THREE.BoxGeometry(0.1, 0.012, 0.012), mat.lace, `boot_${tag}_lace${k}${s > 0 ? 'a' : 'b'}`, { parent: foot, p: [0, 0.105 + k * 0.042, 0.108 - k * 0.006], r: [0, 0, 0.35 * s], noOutline: true });
    }
    legs[tag] = { leg, foot };
  }

  // ── backwards baseball cap ──
  const cap = group('cap', torso);
  {
    const tEdge = (phi) => 0.92 + 0.13 * (1 - Math.cos(phi)) / 2 + 0.04 * Math.sin(phi);
    const dome = (t) => 0.035 + 0.1 * Math.max(0, 1 - t / 0.95) ** 1.4;
    const CS = (phi, t) => E(phi, t).addScaledVector(nE(phi, t), dome(t));
    const crownS = new Surface((phi, s) => CS(phi, Math.max(s * tEdge(phi), 1e-3)), HC);
    const capS = new Surface((phi, t) => CS(phi, Math.max(t, 1e-3)), HC);
    const inOrange = (phi) => phi > 0.9 && phi < 2.25;
    mesh(surfPatch(crownS, -Math.PI, Math.PI, 0, 1, 96, 26, (a) => !inOrange(a)), mat.capBlue, 'cap_crown', { parent: cap });
    mesh(surfPatch(crownS, -Math.PI, Math.PI, 0, 1, 96, 26, (a) => inOrange(a)), mat.capOrange, 'cap_panel', { parent: cap });
    // seams + top button + eyelets
    const step = TAU / 96, line = (i) => -Math.PI + i * step;
    const seamPhis = [line(Math.ceil((0.9 + Math.PI) / step - 0.5)), line(Math.floor((2.25 + Math.PI) / step - 0.5) + 1), line(Math.round((-0.9 + Math.PI) / step)), line(Math.round((-2.3 + Math.PI) / step))];
    seamPhis.forEach((phi, i) => {
      const path = [];
      for (let k = 0; k <= 8; k++) path.push([phi, 1 - (k / 8) * 0.93]);
      mesh(surfStrip(crownS, path, { width: 0.014, thick: 0.007, lift: 0.0, segs: 24 }), mat.capSeam, `cap_seam_${i}`, { parent: cap, noOutline: true });
    });
    const btn = mesh(sphere(1, 20, 12), mat.capOrange, 'cap_button', { parent: cap, s: [0.06, 0.03, 0.06] });
    btn.position.copy(CS(0, 1e-3));
    [[-0.5, 0.42], [0.45, 0.45], [-1.7, 0.45], [2.8, 0.45]].forEach(([phi, s], i) => {
      const e = mesh(sphere(1, 12, 8), i === 1 ? mat.capBlue : mat.capOrange, `cap_eyelet_${i}`, { parent: cap, s: [0.02, 0.02, 0.007], noOutline: true });
      crownS.place(e, phi, s, 0.002);
    });

    // back opening (worn backwards): forehead arch + snap strap with holes
    const tc = 0.78, { db } = capS.D(0, tc), lb = db.length(), vB = -(tEdge(0) - tc) * lb;
    const arch = (grow) => {
      const s = new THREE.Shape(), w = 0.185 + grow, cv = -0.06;
      s.moveTo(-w, vB - 0.002); s.lineTo(w, vB - 0.002); s.lineTo(w, cv); s.absarc(0, cv, w, 0, Math.PI, false); s.lineTo(-w, vB - 0.002);
      return s;
    };
    mesh(conform(new THREE.ShapeGeometry(arch(0.018), 12), capS, 0, tc, 0.004), mat.line, 'cap_opening_line', { parent: cap, noOutline: true });
    mesh(conform(new THREE.ShapeGeometry(arch(0), 12), capS, 0, tc, 0.007), mat.forehead, 'cap_opening', { parent: cap, noOutline: true });
    mesh(conform(new THREE.ShapeGeometry(rrShape(0.42, 0.052, 0.018, 0, vB + 0.05), 6), capS, 0, tc, 0.01), mat.capOrange, 'cap_snap_strap', { parent: cap, noOutline: true });
    for (let i = 0; i < 5; i++) {
      const hole = new THREE.Shape(); hole.absarc(-0.12 + i * 0.06, vB + 0.05, 0.011, 0, TAU, false);
      mesh(conform(new THREE.ShapeGeometry(hole, 8), capS, 0, tc, 0.013), mat.capSeam, `cap_snap_hole_${i}`, { parent: cap, noOutline: true });
    }
    // sticker (generic doodle badge)
    [[0.06, -0.02, 0, mat.stickerA, 0.008], [0.05, 0.04, 0.025, mat.stickerA, 0.008], [0.045, -0.02, 0, mat.stickerB, 0.011], [0.035, 0.04, 0.025, mat.stickerC, 0.011]].forEach(([r, u, v, m, lift], i) => {
      const s = new THREE.Shape(); s.absarc(u, v, r, 0, TAU, false);
      mesh(conform(new THREE.ShapeGeometry(s, 16), capS, 0.62, 0.52, lift), m, `cap_sticker_${i}`, { parent: cap, noOutline: true });
    });

    // brim: pointing back-left (+X, −Z), curved bill
    const brim = group('cap_brim', cap);
    const phiB = 2.3, span = 0.9, NS = 24, NW = 8, TH = 0.013;
    const pt = (s, w, dy) => {
      const phi = phiB + span * s, A = CS(phi, tEdge(phi)).addScaledVector(nE(phi, tEdge(phi)), -0.01);
      const R = V(Math.sin(phi), 0, Math.cos(phi)), L = 0.38 * Math.sqrt(Math.max(0, 1 - s * s));
      return A.addScaledVector(R, w * L).add(V(0, -w * L * 0.38 - 0.07 * s * s * w + dy, 0));
    };
    const build = (dy, want) => {
      const pos = [], idx = [];
      for (let j = 0; j <= NW; j++) for (let i = 0; i <= NS; i++) pos.push(...pt(-1 + 2 * i / NS, j / NW, dy).toArray());
      const v = (k) => V(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
      const tri = (a, b, c) => { const n = v(b).sub(v(a)).cross(v(c).sub(v(a))); if (n.lengthSq() < 1e-14) return; idx.push(...(n.dot(want) >= 0 ? [a, b, c] : [a, c, b])); };
      for (let j = 0; j < NW; j++) for (let i = 0; i < NS; i++) { const a = j * (NS + 1) + i; tri(a, a + 1, a + NS + 2); tri(a, a + NS + 2, a + NS + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    mesh(build(TH, UP), mat.capOrange, 'cap_brim_top', { parent: brim });
    mesh(build(-TH, DOWN), mat.capUnder, 'cap_brim_under', { parent: brim });
    {
      const pos = [], idx = [], nor = [];
      for (let i = 0; i <= NS; i++) {
        const s = -1 + 2 * i / NS, a = pt(s, 1, TH), b = pt(s, 1, -TH), c = pt(s, 0.9, 0), out = a.clone().add(b).multiplyScalar(0.5).sub(c).setY(0).normalize();
        pos.push(...a.toArray(), ...b.toArray()); nor.push(...out.toArray(), ...out.toArray());
      }
      const v = (k) => V(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]), nn = (k) => V(nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]);
      for (let i = 0; i < NS; i++) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        for (const [x, y, z] of [[a, b, c], [b, d, c]]) { const n = v(y).sub(v(x)).cross(v(z).sub(v(x))); idx.push(...(n.dot(nn(x)) >= 0 ? [x, y, z] : [x, z, y])); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
      mesh(g, mat.capOrange, 'cap_brim_rim', { parent: brim, noOutline: true });
    }
  }
  // re-base cap on its pivot (top of the head)
  const capPivot = V(0, 1.42, 0);
  cap.position.copy(capPivot);
  cap.children.forEach((c) => c.position.sub(capPivot));

  // ── re-base torso on its pivot (bottom of the body) ──
  torso.position.y = TORSO_Y;
  torso.children.forEach((c) => { c.position.y -= TORSO_Y; });

  if (o.outline) addOutlines(root, o.outlineColor, o.outlineWidth);
  root.userData = { character: 'Smiley', units: 'metres-ish, height ≈ 1.85', forward: '+Z', up: '+Y', rig: SMILEY_RIG_NAMES };
  Object.defineProperty(root, 'parts', {
    enumerable: false,
    value: {
      torso, face, mouth: face.getObjectByName('mouth'), cap, capBrim: cap.getObjectByName('cap_brim'),
      eyes: { L: root.getObjectByName('eye_L'), R: root.getObjectByName('eye_R') },
      irises: { L: root.getObjectByName('iris_L'), R: root.getObjectByName('iris_R') },
      eyelids: { L: root.getObjectByName('eyelid_L'), R: root.getObjectByName('eyelid_R') },
      brows: { L: root.getObjectByName('brow_L'), R: root.getObjectByName('brow_R') },
      arms: { L: arms.L.arm, R: arms.R.arm }, forearms: { L: arms.L.fore, R: arms.R.fore }, hands: { L: arms.L.hand, R: arms.R.hand },
      legs: { L: legs.L.leg, R: legs.R.leg }, feet: { L: legs.L.foot, R: legs.R.foot },
      grenades, pouches: [torso.getObjectByName('pouch_1'), torso.getObjectByName('pouch_2')],
    },
  });
  captureRest(root);
  return root;
}
