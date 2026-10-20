/**
 * ════════════════════════════════════════════════════════════════════════════
 *  LION (Лев) — 3D character model (Three.js, procedural, no textures)
 *  Character #3 of the brawler game. Self-contained ES module, depends only on `three` (r150+).
 *  Gameplay: moves on all four paws, melee with claws and fangs; ultimate = long leap onto an
 *  enemy followed by a furious claw-and-bite flurry.
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  USAGE
 *    import * as THREE from 'three';
 *    import { createLion, setBlink, setLook, resetPose } from './lion.js';
 *    const lion = createLion();                    // THREE.Group, paws on y = 0, faces +Z
 *    scene.add(lion);
 *    // lion.parts.<…> → direct references to every animatable pivot (see RIG below)
 *    // lion.getObjectByName('arm_L') also works (same names survive GLB export).
 *
 *  OPTIONS  createLion({ toon = true, outline = true, outlineWidth = 0.014, outlineColor })
 *
 *  SPACE & SCALE
 *    +Y up, the lion looks toward +Z. Origin = on the ground under the middle of the body.
 *    Standing on four paws: shoulders ≈ 1.35, top of the mane ≈ 1.9, nose → rump ≈ 1.6, tail adds ≈ 0.7.
 *    Front paws at z ≈ +0.55, hind paws at z ≈ −0.58.  "_L" / "_R" = the LION's left / right (+X / −X).
 *
 *  LOOK
 *    Golden fur, huge spiky orange-red mane, cream muzzle, snarling open mouth with fangs, angry brows,
 *    grey headband, feathers + beads in the mane, leather vest with spiked metal shoulder pads,
 *    belt + ragged loincloth, spiked leather bracers on the front legs, bandages, knee pad (left hind),
 *    long tail with a tuft. Claws are silver-grey.
 *
 *  RIG (THREE.Group pivots; rest pose = standing on all fours)
 *    Lion (root) .................. world position / facing. Leap = move the root along an arc.
 *    └─ body ...................... pelvis pivot (y 0.84, z −0.48). body.rotation.x < 0 lifts the front
 *       │                           (rear up), > 0 dips the nose. Bob for gait: body.position.y.
 *       ├─ thigh_L/R → shin_L/R → foot_L/R ... hind legs (hip, knee, hock). foot_* holds the hind paw
 *       │     (hindpaw_*_shape → hindclaws_*). Knee pad = kneepad_L (on shin_L).
 *       ├─ tail_0 → tail_1 … tail_5 → tail_tuft ... rotation.z = sway, rotation.x = curl up(+)/down(−)
 *       ├─ loincloth_0/1/2 ......... cloth flaps (pivot at the belt): swing with rotation.x / z
 *       └─ spine .................. middle of the back: flex the chest against the hips
 *          │                         (gallop: spine.rotation.x ±0.12; rear-up adds to body.rotation.x)
 *          ├─ arm_L/R → forearm_L/R → paw_L/R ... front legs (shoulder, elbow, wrist).
 *          │     paw_*_shape holds the paw, claws_L / claws_R = front claws (scale 1 → 1.35 = "unsheathe").
 *          │     Bracers with spikes on both forearms, bandages on forearm_L.
 *          ├─ shoulder_pad_L/R, vest
 *          └─ neck .................. head lunge / bite: neck.rotation.x (+ = down), position.z
 *             ├─ mane_ruff
 *             └─ head ............... head turn / nod (pivot at the top of the neck)
 *                ├─ jaw ............. rotation.x: 0 = closed, 0.3 = rest snarl, 0.75 = wide bite
 *                ├─ eye_L/R → iris_L/R, eyelid_L/R (rest −0.3 … 1.68 closed) — setLook(), setBlink()
 *                ├─ brow_L/R, ear_L/R (twitch: rotation.x / z)
 *                ├─ mane_top, mane_side, mane_beard, cheek_fur ... mane chunks (pivot = skull centre):
 *                │     bristle with scale 1 → 1.08, wind with small rotation
 *                └─ feathers → feather_1/2/3, bead_braid (sway with rotation.z)
 *
 *  ANIMATION RECIPES (rotate legs in their PARENT's space so the axes are predictable):
 *      const qx = a => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), a);
 *      leg.quaternion.premultiply(qx(a))   // a > 0 swings the leg BACK, a < 0 swings it FORWARD
 *    • resetPose(model) every frame, then add offsets (root transform is left alone).
 *    • Trot (diagonal pairs): phase p; arm_L & thigh_R use p, arm_R & thigh_L use p+π.
 *      swing a = 0.45·sin(φ); lift the leg while it moves forward: pivot.position.y += 0.07·max(0, −cos φ)
 *      and forearm/foot .rotateX(0.6·max(0, −cos φ)); body.position.y += 0.03·sin(2p); tail sways.
 *    • Claw swipe (front R): arm_R a: 0 → −1.3 (raise forward) → +0.5 (slash down) over 0.35 s,
 *      claws_R.scale 1.35, spine.rotation.x −0.15 then +0.1, jaw 0.3 → 0.6.
 *    • Bite: neck.rotation.x +0.25 & neck.position.z +0.08, jaw 0.75 → 0 (snap) in 0.12 s.
 *    • Ultimate: crouch 0.25 s (body.position.y −0.12, legs a ±0.3) → leap: root moves on an arc
 *      (height ≈ 1.2 for a 3–4 m jump), body.rotation.x −0.35 rising / +0.3 falling, front legs a −1.1,
 *      hind legs a +0.9, claws 1.35 → land → rear up (body.rotation.x −0.55, thighs a +0.55 to keep the
 *      hind paws planted) and alternate swipes L/R every 0.18 s + bites, mane bristles (scale 1.1).
 *    • setBlink / setLook / resetPose are identical in all character files.
 */
import * as THREE from 'three';

export const LION_PALETTE = {
  fur: 0xe8a240, furLight: 0xf6c46a, cream: 0xf8e2b4,
  maneLight: 0xf2902e, maneMid: 0xdc6220, maneDark: 0xb84517, maneRed: 0x9a3315,
  nose: 0x7c3338, mouth: 0x6a1219, tongue: 0xe0596a, tooth: 0xfff6e2, brow: 0x7a2c10,
  sclera: 0xfff1c0, iris: 0xf0a01e, irisRing: 0x9a3a10, pupil: 0x1a0a06, earInner: 0xf5c99a,
  headband: 0x8b867b, headbandDark: 0x55504a, vest: 0x6b5733, metal: 0x9aa0aa, spike: 0xd5d8de,
  leather: 0x6a3c20, leatherDark: 0x47280f, cloth: 0x6e6538, bandage: 0xefe7d3, kneepad: 0x4d535c, claw: 0xd9dce3,
  featherWhite: 0xe6e2da, featherTip: 0x3b3530, featherOrange: 0xf26a2a, featherPurple: 0x8a2a8a, featherPink: 0xf05aa0, quill: 0xf3eee4,
  beads: [0xff5aa5, 0x4fd27a, 0x36b3d6, 0xffd23a],
};

/** Names of the animatable nodes (also stored in model.userData.rig, survives GLB export). */
export const LION_RIG_NAMES = {
  root: 'Lion', body: 'body', spine: 'spine', neck: 'neck', head: 'head', jaw: 'jaw',
  eyes: ['eye_L', 'eye_R'], irises: ['iris_L', 'iris_R'], eyelids: ['eyelid_L', 'eyelid_R'], brows: ['brow_L', 'brow_R'], ears: ['ear_L', 'ear_R'],
  frontLegs: { L: ['arm_L', 'forearm_L', 'paw_L'], R: ['arm_R', 'forearm_R', 'paw_R'] },
  hindLegs: { L: ['thigh_L', 'shin_L', 'foot_L'], R: ['thigh_R', 'shin_R', 'foot_R'] },
  claws: ['claws_L', 'claws_R', 'hindclaws_L', 'hindclaws_R'],
  tail: ['tail_0', 'tail_1', 'tail_2', 'tail_3', 'tail_4', 'tail_5', 'tail_tuft'],
  mane: ['mane_top', 'mane_side', 'mane_beard', 'mane_ruff', 'cheek_fur'], feathers: 'feathers',
  loincloth: ['loincloth_0', 'loincloth_1', 'loincloth_2'],
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
// ───────────────────────────── LION ─────────────────────────────
export function createLion(options = {}) {
  const o = { toon: true, outline: true, outlineWidth: 0.014, outlineColor: 0x2a1006, ...options };
  const M = makeMaterials('lion_', o.toon);
  const C = { ...LION_PALETTE, ...(o.palette || {}) }; // o.palette — перекраска для скинов
  const mat = {
    fur: M('fur', C.fur, { rough: 0.7 }), furLight: M('fur_light', C.furLight, { rough: 0.7 }), cream: M('cream', C.cream, { rough: 0.7 }),
    lid: M('fur_lid', C.fur, { rough: 0.7, double: true }),
    maneLight: M('mane_light', C.maneLight, { rough: 0.75 }), maneMid: M('mane_mid', C.maneMid, { rough: 0.75 }),
    maneDark: M('mane_dark', C.maneDark, { rough: 0.75 }), maneRed: M('mane_red', C.maneRed, { rough: 0.75 }),
    nose: M('nose', C.nose, { rough: 0.35 }), mouth: M('mouth', C.mouth, { rough: 0.6 }), tongue: M('tongue', C.tongue, { rough: 0.45 }),
    tooth: M('tooth', C.tooth, { rough: 0.3 }), brow: M('brow', C.brow, { rough: 0.8 }),
    sclera: M('sclera', C.sclera, { rough: 0.3 }), irisRing: M('iris_ring', C.irisRing), iris: M('iris', C.iris, { rough: 0.3 }),
    pupil: M('pupil', C.pupil, { rough: 0.2 }), shine: M('shine', 0xffffff, { emissive: 0xffffff, ei: 0.6 }), earIn: M('ear_inner', C.earInner, { rough: 0.7 }),
    band: M('headband', C.headband, { rough: 0.85 }), bandDark: M('headband_dark', C.headbandDark, { rough: 0.85 }),
    vest: M('vest', C.vest, { rough: 0.8, double: true }), metal: M('metal', C.metal, { rough: 0.35, metal: 0.6 }), spike: M('spike', C.spike, { rough: 0.3, metal: 0.7 }),
    leather: M('leather', C.leather, { rough: 0.75 }), leatherDark: M('leather_dark', C.leatherDark, { rough: 0.75 }),
    cloth: M('cloth', C.cloth, { rough: 0.9, double: true }), bandage: M('bandage', C.bandage, { rough: 0.9 }), kneepad: M('kneepad', C.kneepad, { rough: 0.4, metal: 0.4 }),
    claw: M('claw', C.claw, { rough: 0.3, metal: 0.3 }),
    feather1: M('feather_white', 0xffffff, { vc: true, rough: 0.8, double: true }), quill: M('quill', C.quill, { rough: 0.6 }),
    beads: C.beads.map((c, i) => M(`bead_${i}`, c, { rough: 0.3 })),
  };

  // Pivot points (model space, rest pose standing on all four paws, facing +Z)
  const P = {
    body: V(0, 0.84, -0.48),      // pelvis
    spine: V(0, 0.92, -0.1),      // middle of the back
    neck: V(0, 1.08, 0.36),
    head: V(0, 1.2, 0.52),
  };
  const root = group('Lion');
  const body = group('body', root);
  const spine = group('spine', body);
  const neck = group('neck', spine);
  const head = group('head', neck);
  const H = (x, y, z) => V(x, y, z).add(P.head);          // head-local → model space
  const ell = (name, m, c, r, parent, extra = {}) => mesh(sphere(1, 28, 20), m, name, { parent, p: c.toArray ? c.toArray() : c, s: r, ...extra });

  // ── torso ──
  const chestC = V(0, 0.95, 0.15), chestR = [0.44, 0.42, 0.45];
  const waistC = V(0, 0.88, -0.18), waistR = [0.35, 0.34, 0.38];
  ell('chest', mat.fur, chestC, chestR, spine);
  ell('belly', mat.cream, V(0, 0.76, 0.1), [0.31, 0.2, 0.36], spine, { noOutline: true });
  for (const s of [1, -1]) ell(`shoulder_blade_${s > 0 ? 'L' : 'R'}`, mat.fur, V(0.2 * s, 1.26, 0.08), [0.17, 0.11, 0.21], spine);
  ell('waist', mat.fur, waistC, waistR, body);
  ell('hips', mat.fur, V(0, 0.84, -0.5), [0.36, 0.33, 0.32], body);
  ell('neck_mesh', mat.fur, P.neck.clone().lerp(P.head, 0.5), [0.2, 0.22, 0.24], neck);

  const ellSurf = (c, r) => new Surface((phi, t) => V(r[0] * Math.sin(t) * Math.sin(phi), r[1] * Math.cos(t), r[2] * Math.sin(t) * Math.cos(phi)).add(c), c);
  const chestS = ellSurf(chestC, chestR), waistS = ellSurf(waistC, waistR);

  // leather vest over the back (open underneath and at the front where the mane is)
  mesh(surfPatch(chestS, -Math.PI, Math.PI, 0, 1.85, 72, 26, (a, b) => { const p = chestS.P(a, b); return p.z < 0.26 && p.z > -0.16 && p.y > 0.78; }, 0.022), mat.vest, 'vest', { parent: spine });
  // spiked metal shoulder pads
  for (const s of [1, -1]) {
    const tag = s > 0 ? 'L' : 'R';
    const pad = group(`shoulder_pad_${tag}`, spine, V(0.35 * s, 1.2, 0.24));
    pad.quaternion.setFromUnitVectors(UP, V(0.6 * s, 1, 0.05).normalize());
    mesh(new THREE.SphereGeometry(0.2, 22, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.55, 1.15), mat.metal, `shoulder_pad_${tag}_plate`, { parent: pad });
    [[0, 0.1], [0.55, 0.13], [-0.55, 0.13]].forEach(([ang, r], i) => {
      const d = V(Math.sin(ang) * 0.55, 1, Math.cos(ang) * 0.35 - 0.1).normalize();
      const sp = mesh(new THREE.ConeGeometry(0.045, 0.15, 10), mat.spike, `shoulder_pad_${tag}_spike${i}`, { parent: pad, ol: 0.6 });
      sp.position.set(Math.sin(ang) * r, 0.1, Math.cos(ang) * r * 0.6 - 0.02); sp.quaternion.setFromUnitVectors(UP, d);
    });
    for (let i = 0; i < 5; i++) {
      const a = -1.2 + i * 0.6;
      mesh(sphere(0.016, 8, 6), mat.spike, `shoulder_pad_${tag}_rivet${i}`, { parent: pad, p: [Math.sin(a) * 0.18, 0.02, Math.cos(a) * 0.2], noOutline: true });
    }
  }
  // belt + loincloth (belt ring is a slice of the waist ellipsoid around the Z axis)
  {
    const gam = Math.acos(-0.12 / waistR[2]);
    const beltS = new Surface((beta, g) => V(waistR[0] * Math.sin(g) * Math.cos(beta), waistR[1] * Math.sin(g) * Math.sin(beta), waistR[2] * Math.cos(g)).add(waistC), waistC);
    const path = []; for (let i = 0; i <= 24; i++) path.push([-Math.PI + (i / 24) * TAU, gam]);
    mesh(surfStrip(beltS, path, { width: 0.085, thick: 0.026, lift: 0.024, segs: 96 }), mat.leatherDark, 'belt', { parent: body, ol: 0.7 });
    const bp = beltS.P(0.15, gam), bn = beltS.N(0.15, gam);
    const buckle = group('belt_buckle', body, bp.clone().addScaledVector(bn, 0.06));
    buckle.quaternion.copy(basisQuat(bn, V(0, 0, 1)));
    mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 4).rotateZ(Math.PI / 4).scale(1.15, 1, 1), mat.metal, 'belt_buckle_frame', { parent: buckle });
    mesh(new THREE.BoxGeometry(0.016, 0.075, 0.016), mat.metal, 'belt_buckle_prong', { parent: buckle, noOutline: true });
    [-Math.PI / 2 - 0.62, -Math.PI / 2, -Math.PI / 2 + 0.62].forEach((beta, i) => {
      const p = beltS.P(beta, gam), n = beltS.N(beta, gam);
      const tan = beltS.P(beta + 0.01, gam).sub(p).normalize();
      const flap = group(`loincloth_${i}`, body, p.clone().addScaledVector(n, 0.03));
      const out = n.clone().setY(0); if (out.lengthSq() < 1e-4) out.set(0, 0, 1); out.normalize();
      flap.quaternion.copy(basisQuat(new THREE.Vector3().crossVectors(tan, DOWN).normalize().multiplyScalar(Math.sign(new THREE.Vector3().crossVectors(tan, DOWN).dot(i === 1 ? FWD : out)) || 1), UP));
      const w = i === 1 ? 0.26 : 0.18, L = i === 1 ? 0.26 : 0.2;
      const sh = new THREE.Shape([new THREE.Vector2(-w / 2, 0.02), new THREE.Vector2(w / 2, 0.02), new THREE.Vector2(w / 2, -L * 0.82), new THREE.Vector2(w / 4, -L), new THREE.Vector2(0.01, -L * 0.8), new THREE.Vector2(-w / 4, -L * 0.98), new THREE.Vector2(-w / 2, -L * 0.85)]);
      const g = new THREE.ShapeGeometry(sh); const pp = g.attributes.position;
      for (let k = 0; k < pp.count; k++) pp.setZ(k, 0.04 * Math.sin((pp.getX(k) / w) * Math.PI * 2) * (-pp.getY(k) / L));
      g.computeVertexNormals();
      mesh(g, mat.cloth, `loincloth_${i}_mesh`, { parent: flap, ol: 0.6 });
    });
  }

  // ── head ──
  const cran = H(0, 0.12, 0.12), cranR = [0.27, 0.25, 0.26];
  ell('cranium', mat.fur, cran, cranR, head);
  ell('brow_ridge', mat.fur, H(0, 0.18, 0.29), [0.2, 0.08, 0.1], head);
  ell('nose_bridge', mat.fur, H(0, 0.08, 0.34), [0.085, 0.075, 0.14], head);
  for (const s of [1, -1]) {
    const tag = s > 0 ? 'L' : 'R';
    ell(`cheek_${tag}`, mat.fur, H(0.16 * s, 0.0, 0.26), [0.12, 0.11, 0.1], head);
    ell(`muzzle_pad_${tag}`, mat.cream, H(0.065 * s, -0.005, 0.4), [0.085, 0.07, 0.075], head);
    for (let k = 0; k < 3; k++) mesh(sphere(0.008, 6, 4), mat.brow, `whisker_dot_${tag}${k}`, { parent: head, p: H(0.06 * s + 0.025 * s * (k - 1), 0.015 - 0.018 * (k % 2), 0.47 - 0.01 * Math.abs(k - 1)).toArray(), noOutline: true });
  }
  ell('nose', mat.nose, H(0, 0.065, 0.475), [0.07, 0.045, 0.045], head);
  mesh(sphere(0.012, 8, 6), mat.shine, 'nose_shine', { parent: head, p: H(-0.025, 0.09, 0.505).toArray(), s: [1, 0.6, 0.5], noOutline: true });
  ell('palate', mat.mouth, H(0, -0.055, 0.31), [0.12, 0.05, 0.14], head, { noOutline: true });
  // upper teeth: 2 big fangs + 4 incisors
  const fang = (len, r) => new THREE.ConeGeometry(r, len, 10).rotateX(Math.PI).translate(0, -len / 2, 0);
  for (const s of [1, -1]) {
    mesh(fang(0.095, 0.024), mat.tooth, `fang_upper_${s > 0 ? 'L' : 'R'}`, { parent: head, p: H(0.072 * s, -0.04, 0.425).toArray(), r: [0.15, 0, 0.08 * s], ol: 0.5 });
  }
  for (let i = 0; i < 4; i++) mesh(fang(0.04, 0.014), mat.tooth, `incisor_upper_${i}`, { parent: head, p: H(-0.036 + i * 0.024, -0.04, 0.455 - Math.abs(i - 1.5) * 0.006).toArray(), noOutline: true });

  // jaw (opens with rotation.x > 0)
  const jawP = H(0, -0.04, 0.17);
  const jaw = group('jaw', head);
  ell('jaw_mesh', mat.cream, H(0, -0.1, 0.32), [0.115, 0.05, 0.16], jaw);
  ell('chin', mat.cream, H(0, -0.125, 0.38), [0.075, 0.04, 0.07], jaw);
  ell('tongue', mat.tongue, H(0, -0.072, 0.31), [0.08, 0.025, 0.12], jaw, { noOutline: true });
  ell('jaw_inner', mat.mouth, H(0, -0.08, 0.3), [0.1, 0.03, 0.13], jaw, { noOutline: true });
  for (const s of [1, -1]) mesh(new THREE.ConeGeometry(0.02, 0.075, 10).translate(0, 0.0375, 0), mat.tooth, `fang_lower_${s > 0 ? 'L' : 'R'}`, { parent: jaw, p: H(0.064 * s, -0.085, 0.425).toArray(), r: [-0.2, 0, -0.1 * s], ol: 0.5 });
  for (let i = 0; i < 3; i++) mesh(new THREE.ConeGeometry(0.012, 0.03, 8).translate(0, 0.015, 0), mat.tooth, `incisor_lower_${i}`, { parent: jaw, p: H(-0.025 + i * 0.025, -0.08, 0.455).toArray(), noOutline: true });

  // eyes, lids, brows
  for (const s of [1, -1]) {
    const tag = s > 0 ? 'L' : 'R';
    const eye = group(`eye_${tag}`, head, H(0.11 * s, 0.135, 0.33));
    eye.quaternion.copy(basisQuat(V(0.25 * s, 0.05, 1).normalize()));
    const shape = group(`eye_${tag}_shape`, eye); shape.scale.set(0.076, 0.062, 0.048);
    mesh(sphere(1, 28, 20), mat.sclera, `eye_${tag}_ball`, { parent: shape, ol: 0.5 });
    const iris = group(`iris_${tag}`, shape); iris.rotation.set(0.05, -0.12 * s, 0); iris.userData.rest = [0.05, -0.12 * s];
    mesh(capZ(1.012, 0.7), mat.irisRing, `iris_${tag}_ring`, { parent: iris, noOutline: true });
    mesh(capZ(1.02, 0.6), mat.iris, `iris_${tag}_color`, { parent: iris, noOutline: true });
    mesh(capZ(1.03, 0.28), mat.pupil, `pupil_${tag}`, { parent: iris, noOutline: true });
    const hl = V(-0.3, 0.4, 0.87).normalize().multiplyScalar(1.03);
    mesh(sphere(0.14, 10, 8), mat.shine, `eye_${tag}_shine`, { parent: shape, p: hl.toArray(), s: [1, 1, 0.25], q: basisQuat(hl), noOutline: true });
    const tilt = group(`eyelid_${tag}_tilt`, shape); tilt.rotation.z = 0.45 * s;
    const lid = mesh(hemiUp(1.09), mat.lid, `eyelid_${tag}`, { parent: tilt, r: [-0.3, 0, 0], ol: 0.5 }); lid.userData.restX = -0.3;
    const brow = group(`brow_${tag}`, head, H(0.115 * s, 0.21, 0.35)); brow.rotation.set(-0.25, 0.25 * s, 0.42 * s);
    mesh(new THREE.CapsuleGeometry(0.036, 0.13, 4, 10).rotateZ(Math.PI / 2).scale(1, 1, 0.6), mat.brow, `brow_${tag}_mesh`, { parent: brow, ol: 0.6 });
    const ear = group(`ear_${tag}`, head, H(0.205 * s, 0.33, 0.03)); ear.rotation.set(-0.15, 0.4 * s, 0.25 * s);
    mesh(sphere(1, 20, 14), mat.fur, `ear_${tag}_mesh`, { parent: ear, s: [0.085, 0.085, 0.04] });
    mesh(sphere(1, 16, 10), mat.earIn, `ear_${tag}_inner`, { parent: ear, p: [0, -0.005, 0.022], s: [0.055, 0.055, 0.02], noOutline: true });
  }

  // headband around the cranium
  {
    const cs = ellSurf(cran, cranR), t0 = Math.acos(0.15 / cranR[1]), t1 = Math.acos(-0.05 / cranR[1]), path = [];
    for (let i = 0; i <= 24; i++) { const phi = -Math.PI + (i / 24) * TAU; path.push([phi, t0 + (t1 - t0) * (1 - Math.cos(phi)) / 2]); }
    mesh(surfStrip(cs, path, { width: 0.075, thick: 0.022, lift: 0.004, segs: 96 }), mat.band, 'headband', { parent: head, ol: 0.7 });
    const rip = group('headband_tear', head); cs.place(rip, 0.12, t0 + 0.005, 0.03);
    mesh(new THREE.BoxGeometry(0.04, 0.008, 0.006), mat.bandDark, 'headband_tear_a', { parent: rip, r: [0, 0, 0.5], noOutline: true });
    mesh(new THREE.BoxGeometry(0.03, 0.008, 0.006), mat.bandDark, 'headband_tear_b', { parent: rip, p: [0.018, -0.01, 0], r: [0, 0, -0.6], noOutline: true });
  }

  // ── mane: tapered locks merged per colour into a few meshes per group ──
  const R = rng(77);
  const lockGeo = (len, w, curl) => {
    const prof = [[0, 0], [0.7, 0.04], [1, 0.15], [0.9, 0.32], [0.65, 0.55], [0.38, 0.78], [0.15, 0.93], [0, 1]];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * w, y * len)), 7);
    g.scale(1, 1, 0.55);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = p.getY(i) / len; p.setZ(i, p.getZ(i) + curl * len * t * t); }
    g.computeVertexNormals();
    return g;
  };
  const lockMatrix = (base, dir, curlDir) => {
    const y = dir.clone().normalize(), z = curlDir.clone().sub(y.clone().multiplyScalar(curlDir.dot(y))).normalize();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    const m = new THREE.Matrix4().makeBasis(x, y, z); m.setPosition(base);
    return m;
  };
  const maneSets = {};
  const addLock = (set, colour, base, dir, len, w, curl, curlDir = V(0, 0, -1)) => {
    const key = `${set}|${colour}`;
    (maneSets[key] ||= []).push(lockGeo(len, w, curl).applyMatrix4(lockMatrix(base, dir, curlDir)));
  };
  const maneO = cran.clone();
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const earAngles = [Math.atan2(0.21, 0.205), Math.atan2(0.21, -0.205)];
  // ring A (around the face) and ring B (behind it)
  for (const [n, rr, zo, len0, len1, w, tilt, cols] of [[20, 0.29, 0.14, 0.2, 0.28, 0.072, 0.35, ['maneLight', 'maneMid']], [26, 0.34, 0.02, 0.3, 0.42, 0.088, 0.6, ['maneMid', 'maneDark', 'maneRed', 'maneLight']]]) {
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU + (R() - 0.5) * 0.15, c = Math.cos(th), s = Math.sin(th);
      if (n === 20 && earAngles.some((a) => Math.abs(Math.atan2(Math.sin(th - a), Math.cos(th - a))) < 0.28)) continue;
      if (s < -0.75) continue;                      // chin area is the beard's job
      const base = maneO.clone().add(V(c * rr, s * rr * 1.05, zo));
      const dir = V(c, s, -tilt).normalize();
      addLock(s > 0.35 ? 'top' : 'side', pick(cols), base, dir, len0 + R() * (len1 - len0), w, 0.25 + R() * 0.2);
    }
  }
  // back of the head
  for (let i = 0; i < 14; i++) {
    const th = (i / 14) * TAU + R() * 0.2, c = Math.cos(th), s = Math.sin(th);
    addLock(s > 0.35 ? 'top' : 'side', pick(['maneDark', 'maneRed', 'maneMid']), maneO.clone().add(V(c * 0.2, s * 0.22, -0.16)), V(c * 0.6, s * 0.6 + 0.1, -1), 0.34 + R() * 0.08, 0.095, 0.2);
  }
  // wild crest on top
  for (let k = 0; k < 6; k++) {
    const th = Math.PI * (0.36 + 0.056 * k), c = Math.cos(th);
    addLock('top', pick(['maneLight', 'maneMid', 'maneLight']), maneO.clone().add(V(c * 0.22, 0.24, -0.02 - (k % 2) * 0.07)), V(c * 0.5, 1, -0.5 - R() * 0.3), 0.36 + R() * 0.1, 0.085, 0.4);
  }
  // beard down the chest
  for (let k = 0; k < 9; k++) {
    const th = Math.PI * (1.22 + 0.07 * k), c = Math.cos(th);
    addLock('beard', pick(['maneMid', 'maneDark', 'maneRed']), maneO.clone().add(V(c * 0.24, -0.25, 0.1 - Math.abs(c) * 0.05)), V(c * 0.4, -1, 0.1), 0.34 + R() * 0.12, 0.09, 0.25, V(0, -0.2, 1));
  }
  // golden cheek tufts
  for (const s of [1, -1]) for (let k = 0; k < 3; k++) {
    addLock('cheeks', 'fur', H(0.23 * s, 0.05 - k * 0.055, 0.25 - k * 0.02), V(s, -0.35 - k * 0.2, 0.15), 0.12 + k * 0.015, 0.06, 0.3, V(0, -1, 0));
  }
  const maneGroups = {};
  for (const [name, parent] of [['mane_top', head], ['mane_side', head], ['mane_beard', head], ['cheek_fur', head]]) maneGroups[name] = group(name, parent);
  const setToGroup = { top: 'mane_top', side: 'mane_side', beard: 'mane_beard', cheeks: 'cheek_fur' };
  Object.entries(maneSets).forEach(([key, list]) => {
    const [set, colour] = key.split('|');
    mesh(mergeGeos(list), mat[colour], `${setToGroup[set]}_${colour}`, { parent: maneGroups[setToGroup[set]], ol: 0.8 });
  });
  ell('mane_core', mat.maneDark, maneO.clone().add(V(0, 0.02, -0.06)), [0.34, 0.38, 0.3], maneGroups.mane_side);
  ell('beard_core', mat.maneRed, H(0, -0.2, 0.12), [0.22, 0.17, 0.18], maneGroups.mane_beard);

  // ruff around the neck (on the neck pivot, so the head can turn inside it)
  const ruff = group('mane_ruff', neck), ruffMid = P.neck.clone().lerp(P.head, 0.35);
  {
    const axis = P.head.clone().sub(P.neck).normalize(), mid = ruffMid;
    const u = new THREE.Vector3().crossVectors(axis, V(1, 0, 0)).normalize(), v = new THREE.Vector3().crossVectors(axis, u).normalize();
    const list = { maneDark: [], maneRed: [], maneMid: [] };
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU + R() * 0.15, rad = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
      const base = mid.clone().addScaledVector(rad, 0.2), dir = rad.clone().multiplyScalar(0.75).addScaledVector(axis, -0.55).add(V(0, -0.15, 0)).normalize();
      list[pick(['maneDark', 'maneRed', 'maneMid'])].push(lockGeo(0.36 + R() * 0.1, 0.1, 0.25).applyMatrix4(lockMatrix(base, dir, V(0, -1, -0.3))));
    }
    Object.entries(list).forEach(([c, l]) => l.length && mesh(mergeGeos(l), mat[c], `mane_ruff_${c}`, { parent: ruff, ol: 0.8 }));
  }

  // feathers + beads
  const feathers = group('feathers', head);
  {
    const featherGeo = (L, W, c0, c1, tip) => {
      const pts = [];
      for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(W * Math.sin(Math.PI * Math.min(t * 1.05, 1)) ** 0.7 * (i % 3 === 2 ? 0.8 : 1), t * L)); }
      for (let i = 12; i >= 0; i--) { const t = i / 12; pts.push(new THREE.Vector2(-W * Math.sin(Math.PI * Math.min(t * 1.05, 1)) ** 0.7 * (i % 4 === 1 ? 0.82 : 1), t * L)); }
      const g = subdivide(new THREE.ShapeGeometry(new THREE.Shape(pts)), L / 6);
      const p = g.attributes.position, col = new Float32Array(p.count * 3), ca = new THREE.Color(c0), cb = new THREE.Color(c1), ct = new THREE.Color(tip ?? c1), c = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const t = p.getY(i) / L; p.setZ(i, 0.18 * L * t * t);
        c.copy(ca).lerp(cb, Math.min(1, t * 1.2)); if (tip != null && t > 0.78) c.copy(ct);
        col.set([c.r, c.g, c.b], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
      return g;
    };
    const addFeather = (name, base, dir, out, L, W, c0, c1, tip, beadCols) => {
      const f = group(name, feathers, base);
      const y = dir.clone().normalize(), z = out.clone().sub(y.clone().multiplyScalar(out.dot(y))).normalize(), x = new THREE.Vector3().crossVectors(y, z);
      f.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      mesh(featherGeo(L, W, c0, c1, tip), mat.feather1, `${name}_vane`, { parent: f, ol: 0.5 });
      mesh(new THREE.CylinderGeometry(0.005, 0.007, L * 1.05, 6).translate(0, L * 0.5, 0.003), mat.quill, `${name}_quill`, { parent: f, noOutline: true });
      beadCols.forEach((ci, k) => mesh(sphere(0.022, 10, 8), mat.beads[ci], `${name}_bead${k}`, { parent: f, p: [0, -0.03 - k * 0.04, 0.01], ol: 0.5 }));
    };
    addFeather('feather_1', H(-0.26, 0.42, 0.1), V(-0.7, 0.7, -0.15), V(-0.4, 0.3, 1), 0.42, 0.085, C.featherWhite, C.featherWhite, C.featherTip, [0, 2, 1]);
    addFeather('feather_2', H(-0.37, 0.06, 0.22), V(-0.35, -0.9, 0.05), V(-0.8, 0, 1), 0.36, 0.08, C.featherOrange, C.featherPurple, null, [3, 0, 2]);
    addFeather('feather_3', H(0.18, 0.46, 0.06), V(0.35, 0.9, -0.2), V(0.5, 0.2, 1), 0.26, 0.055, C.featherPurple, C.featherPink, null, [1, 0]);
    const braid = group('bead_braid', feathers, H(0.3, -0.02, 0.24));
    [0, 1, 0, 1].forEach((ci, k) => mesh(sphere(1, 12, 8), mat.beads[ci], `bead_braid_${k}`, { parent: braid, p: [0, -k * 0.048, 0], s: [0.027, 0.024, 0.027], ol: 0.5 }));
  }

  // ── legs ──
  // chain: names[i] pivot at pts[i], local −Y points to pts[i+1]
  const chain = (names, pts, radii, m, parent) => {
    const groups = []; const acc = new THREE.Quaternion(); let par = parent, prevLen = 0;
    for (let i = 0; i < names.length; i++) {
      const g = group(names[i], par, i === 0 ? pts[0] : V(0, -prevLen, 0));
      const d = pts[i + 1].clone().sub(pts[i]), L = d.length();
      g.quaternion.setFromUnitVectors(DOWN, d.normalize().applyQuaternion(acc.clone().invert()));
      acc.multiply(g.quaternion);
      if (radii[i]) mesh(limbDown(radii[i][0], L), m, `${names[i]}_mesh`, { parent: g });
      groups.push(g); par = g; prevLen = L;
    }
    return groups;
  };
  // a child of `obj` that is axis-aligned with the model, placed at a model-space point
  const aligned = (name, obj, worldPos) => {
    obj.updateWorldMatrix(true, false);
    const g = group(name, obj);
    g.quaternion.copy(obj.getWorldQuaternion(new THREE.Quaternion()).invert());
    g.position.copy(obj.worldToLocal(worldPos.clone()));
    return g;
  };
  const ringAt = (name, m, parent, y, r, tube, tilt = 0) => mesh(new THREE.TorusGeometry(r, tube, 8, 24).rotateX(Math.PI / 2).rotateZ(tilt), m, name, { parent, p: [0, y, 0], ol: 0.6 });
  const pawParts = (prefix, shape, big, clawName) => {
    const s = big ? 1 : 0.8;
    mesh(sphere(1, 24, 16), mat.fur, `${prefix}_pad`, { parent: shape, s: [0.15 * s, 0.085 * s, 0.17 * s] });
    const claws = group(clawName, shape, V(0, 0, 0.13 * s));
    for (let i = 0; i < 4; i++) {
      const x = (-0.09 + i * 0.06) * s, zt = (0.13 + (i === 1 || i === 2 ? 0.03 : 0)) * s;
      mesh(sphere(1, 14, 10), mat.fur, `${prefix}_toe${i}`, { parent: shape, p: [x, -0.005 * s, zt], s: [0.052 * s, 0.047 * s, 0.058 * s] });
      const cg = new THREE.ConeGeometry(0.019 * s, (big ? 0.1 : 0.06), 10).translate(0, (big ? 0.05 : 0.03), 0);
      const cp = cg.attributes.position; for (let k = 0; k < cp.count; k++) { const t = cp.getY(k) / (big ? 0.1 : 0.06); cp.setZ(k, cp.getZ(k) + 0.035 * s * t * t); }
      cg.computeVertexNormals();
      mesh(cg, mat.claw, `${clawName}_${i}`, { parent: claws, p: [x, 0.0, zt - 0.13 * s + 0.035 * s], r: [2.04, 0, 0], ol: 0.5 });
    }
    return claws;
  };
  const legs = {}, claws = {};
  for (const s of [1, -1]) {
    const tag = s > 0 ? 'L' : 'R';
    // front leg (arm)
    const S = V(0.34 * s, 1.0, 0.3), E = V(0.4 * s, 0.55, 0.28), Wr = V(0.38 * s, 0.17, 0.45), Pc = V(0.38 * s, 0.085, 0.55);
    const [arm, fore, paw] = chain([`arm_${tag}`, `forearm_${tag}`, `paw_${tag}`], [S, E, Wr, Pc], [[0.145], [0.125], null], mat.fur, spine);
    ell(`arm_${tag}_deltoid`, mat.fur, V(0, -0.1, 0), [0.19, 0.22, 0.19], arm);
    ell(`forearm_${tag}_muscle`, mat.fur, V(0, -0.12, 0.0), [0.15, 0.17, 0.15], fore);
    const L2 = E.distanceTo(Wr);
    mesh(new THREE.CylinderGeometry(0.146, 0.138, 0.12, 24), mat.leather, `bracer_${tag}`, { parent: fore, p: [0, -L2 * 0.62, 0] });
    ringAt(`bracer_${tag}_rim`, mat.leatherDark, fore, -L2 * 0.62 + 0.06, 0.146, 0.013);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3, d = V(Math.cos(a), 0, Math.sin(a));
      const sp = mesh(new THREE.ConeGeometry(0.028, 0.085, 10), mat.spike, `bracer_${tag}_spike${i}`, { parent: fore, ol: 0.6 });
      sp.position.set(d.x * 0.18, -L2 * 0.62, d.z * 0.18); sp.quaternion.setFromUnitVectors(UP, d);
    }
    if (s > 0) for (let i = 0; i < 3; i++) ringAt(`bandage_${tag}_${i}`, mat.bandage, fore, -L2 * (0.83 + i * 0.07), 0.127, 0.02, 0.18 * (i % 2 ? 1 : -1));
    const pawShape = aligned(`paw_${tag}_shape`, paw, Pc);
    claws[tag] = pawParts(`paw_${tag}`, pawShape, true, `claws_${tag}`);

    // hind leg
    const Hp = V(0.26 * s, 0.8, -0.52), K = V(0.3 * s, 0.5, -0.36), Hk = V(0.29 * s, 0.25, -0.68), Hc = V(0.29 * s, 0.068, -0.58);
    const [thigh, shin, foot] = chain([`thigh_${tag}`, `shin_${tag}`, `foot_${tag}`], [Hp, K, Hk, Hc], [[0.15], [0.085], [0.07]], mat.fur, body);
    ell(`thigh_${tag}_muscle`, mat.fur, V(0, -0.12, 0.02), [0.19, 0.22, 0.2], thigh);
    for (let i = 0; i < 3; i++) ringAt(`bandage_hind_${tag}_${i}`, mat.bandage, foot, -0.06 - i * 0.045, 0.078, 0.017, 0.2 * (i % 2 ? 1 : -1));
    const hs = aligned(`hindpaw_${tag}_shape`, foot, Hc);
    claws[`hind_${tag}`] = pawParts(`hindpaw_${tag}`, hs, false, `hindclaws_${tag}`);
    if (s > 0) {                                   // knee pad on the left knee
      shin.updateWorldMatrix(true, false);
      const qi = shin.getWorldQuaternion(new THREE.Quaternion()).invert(), fwd = V(0, 0.25, 1).normalize().applyQuaternion(qi);
      const pad = group('kneepad_L', shin, fwd.clone().multiplyScalar(0.05)); pad.quaternion.setFromUnitVectors(UP, fwd);
      mesh(new THREE.SphereGeometry(0.115, 20, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.6, 1), mat.kneepad, 'kneepad_L_dome', { parent: pad });
      mesh(sphere(0.02, 8, 6), mat.shine, 'kneepad_L_shine', { parent: pad, p: [-0.04, 0.06, 0.03], noOutline: true });
      mesh(new THREE.TorusGeometry(0.1, 0.016, 8, 24).rotateX(Math.PI / 2), mat.leatherDark, 'kneepad_L_strap', { parent: shin, p: [0, -0.03, 0], ol: 0.6 });
    }
    legs[tag] = { arm, fore, paw, thigh, shin, foot };
  }

  // ── tail: 6-link chain (+Z of each link = "up" curl direction) + tuft ──
  const tail = [];
  {
    let cur = group('tail_0', body, V(0, 0.92, -0.76));
    cur.quaternion.setFromUnitVectors(UP, V(0, -0.45, -1).normalize());
    const bends = [0.05, 0.22, 0.32, 0.34, 0.26, 0.12], L = 0.12;
    for (let k = 0; k < 6; k++) {
      if (k) cur = group(`tail_${k}`, cur, V(0, L, 0));
      cur.rotation.x = k ? bends[k] : cur.rotation.x;
      const r = 0.05 - k * 0.0035;
      mesh(new THREE.CylinderGeometry(r * 0.93, r, L, 12, 1, true).translate(0, L / 2, 0), mat.fur, `tail_${k}_mesh`, { parent: cur, ol: 0.7 });
      mesh(sphere(r * 0.95, 12, 8), mat.fur, `tail_${k}_joint`, { parent: cur, p: [0, L, 0], ol: 0.7 });
      tail.push(cur);
    }
    const tuft = group('tail_tuft', cur, V(0, L, 0));
    mesh(sphere(1, 16, 12), mat.maneDark, 'tail_tuft_core', { parent: tuft, p: [0, 0.07, 0], s: [0.07, 0.1, 0.07] });
    const list = { maneMid: [], maneDark: [], maneRed: [] };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU, d = V(Math.cos(a) * 0.55, 1, Math.sin(a) * 0.55).normalize();
      list[pick(['maneMid', 'maneDark', 'maneRed'])].push(lockGeo(0.16 + R() * 0.05, 0.06, 0.3).applyMatrix4(lockMatrix(V(0, 0.05, 0).addScaledVector(d, 0.03), d, V(0, 0, 1))));
    }
    Object.entries(list).forEach(([c, l]) => l.length && mesh(mergeGeos(l), mat[c], `tail_tuft_${c}`, { parent: tuft, ol: 0.8 }));
  }

  // ── re-base pivots: innermost first, so every pivot group sits on its joint ──
  const rebase = (g, p) => { g.children.forEach((c) => c.position.sub(p)); g.position.add(p); };
  for (const [name, grp] of Object.entries(maneGroups)) rebase(grp, maneO);
  rebase(feathers, maneO);
  rebase(ruff, ruffMid);
  rebase(jaw, jawP);
  rebase(head, P.head);
  rebase(neck, P.neck);
  rebase(spine, P.spine);
  rebase(body, P.body);
  jaw.rotation.x = 0.3; jaw.userData.restX = 0.3;          // rest: snarling, mouth half open

  if (o.outline) addOutlines(root, o.outlineColor, o.outlineWidth);
  root.userData = { character: 'Lion', units: 'metres-ish, ≈1.9 tall at the mane, ≈2.3 long with tail', forward: '+Z', up: '+Y', rig: LION_RIG_NAMES };
  Object.defineProperty(root, 'parts', {
    enumerable: false,
    value: {
      body, spine, neck, head, jaw,
      eyes: { L: root.getObjectByName('eye_L'), R: root.getObjectByName('eye_R') },
      irises: { L: root.getObjectByName('iris_L'), R: root.getObjectByName('iris_R') },
      eyelids: { L: root.getObjectByName('eyelid_L'), R: root.getObjectByName('eyelid_R') },
      brows: { L: root.getObjectByName('brow_L'), R: root.getObjectByName('brow_R') },
      ears: { L: root.getObjectByName('ear_L'), R: root.getObjectByName('ear_R') },
      mane: { top: maneGroups.mane_top, side: maneGroups.mane_side, beard: maneGroups.mane_beard, ruff: root.getObjectByName('mane_ruff') },
      feathers,
      arms: { L: legs.L.arm, R: legs.R.arm }, forearms: { L: legs.L.fore, R: legs.R.fore }, paws: { L: legs.L.paw, R: legs.R.paw },
      thighs: { L: legs.L.thigh, R: legs.R.thigh }, shins: { L: legs.L.shin, R: legs.R.shin }, feet: { L: legs.L.foot, R: legs.R.foot },
      claws: { L: claws.L, R: claws.R, hindL: claws.hind_L, hindR: claws.hind_R },
      tail, tailTuft: root.getObjectByName('tail_tuft'),
      loincloth: [0, 1, 2].map((i) => root.getObjectByName(`loincloth_${i}`)),
    },
  });
  captureRest(root);
  return root;
}
