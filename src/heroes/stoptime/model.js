/**
 * ════════════════════════════════════════════════════════════════════════════
 *  STOP TIME (Стоп Тайм) — 3D character model (Three.js, procedural, no textures)
 *  Character #4 of the brawler game. Self-contained ES module, depends only on `three` (r150+).
 *  Gameplay: shoots clock-balls from the two arm cannons; ultimate = stops time for everyone else
 *  for 5 seconds, during which he can attack whoever he wants.
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  USAGE
 *    import * as THREE from 'three';
 *    import { createStopTime, setFace, resetPose } from './stop_time.js';
 *    const bot = createStopTime();                 // THREE.Group, feet on y = 0, faces +Z
 *    scene.add(bot);
 *    // bot.parts.<…> → direct references to every animatable pivot (see RIG below)
 *
 *  OPTIONS  createStopTime({ toon = true, outline = true, outlineWidth = 0.012, outlineColor })
 *
 *  GLB NOTE  glTF has no "hidden" flag, so all five screen faces are inside stop_time.glb and show at once
 *    until you call setFace(model, 'angry') right after loading (setFace works on loaded GLBs).
 *
 *  SPACE & SCALE
 *    +Y up, looks toward +Z. Origin = between the feet on the ground. Height ≈ 1.6 (helmet), ≈ 1.8 with antennae.
 *    "_L" / "_R" = the robot's own left / right (+X / −X).
 *
 *  LOOK
 *    Blue robot with copper trim, TV-screen face with glowing cyan expressions, copper crest and loop
 *    antennae, ear-cups with little clocks, chest medallion = clock in a gear, backpack with a big
 *    double-sided clock on top and gears on both sides, forearm cannons with glowing muzzles, blocky fists.
 *
 *  RIG (THREE.Group pivots; rest pose = ready stance, forearms forward, cannons pointing ahead)
 *    StopTime (root) .............. world position / facing
 *    └─ hips ...................... pelvis pivot (y 0.66): bob, sway
 *       ├─ thigh_L/R → shin_L/R → foot_L/R ... legs (hip, knee, ankle); knee_*, boot_* are dressings
 *       └─ torso .................. waist pivot (y 0.74): lean / twist / squash
 *          ├─ head ................ neck pivot (y 1.14): turn / nod
 *          │  ├─ face → face_angry | face_wink | face_happy | face_blink | face_surprised
 *          │  │     emissive decals on the screen, exactly one visible — use setFace(model, name)
 *          │  ├─ antenna_L/R ...... wiggle with rotation.z / x
 *          │  └─ ear_L/R (little clocks), crest
 *          ├─ chest_clock ......... chest_clock_hour / chest_clock_minute: rotate .z (clockwise = negative)
 *          ├─ backpack ............ pivot at the middle of the back
 *          │  ├─ backpack_clock ... big clock; its two dials have *_hour / *_minute hands
 *          │  │     (parts.backpackClock.hour[] / .minute[]) — rotate .z; spin them fast backwards for the ult
 *          │  └─ gear_L_big, gear_L_small, gear_R_big, gear_R_small ... spin with rotation.z
 *          └─ arm_L/R → forearm_L/R → hand_L/R ... shoulder, elbow, wrist
 *                forearm_* = cannon gauntlet; cannon_* (on the forearm, pivot at the wrist) holds the barrel,
 *                muzzle_* = projectile spawn point (getWorldPosition / world direction = cannon's −Y axis).
 *                hand_*_shape → finger_*_0…3 (rotation.x 1.9 = fist, 0 = open), thumb_*.
 *
 *  ANIMATION RECIPES
 *      const qx = a => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), a);
 *      arm.quaternion.premultiply(qx(a))   // rotate a limb in its parent's space; a < 0 swings it forward/up
 *    • resetPose(model) every frame, then add offsets (root transform is left alone).
 *    • Shot (one cannon): arm_*: qx(−0.25) aim up a little; recoil cannon_*.position.y += 0.06 (it slides
 *      back into the gauntlet) for 0.12 s; spawn the clock-ball at muzzle_*; alternate L/R.
 *    • Time-stop ult: setFace('wink'); both arms up (arm qx(−2.4), fingers open rotation.x 0, cannons slid back
 *      cannon.position.y += 0.18); backpack clock hands spin backwards fast; gears spin; then freeze
 *      everyone else for 5 s (the game's job) while this model keeps animating.
 *    • Walk: legs qx(±0.5·sin(p)), hips.position.y bob, torso.rotation.y counter-twist, antennae lag.
 */
import * as THREE from 'three';

export const STOP_TIME_PALETTE = {
  blue: 0x2f62b8, blueDark: 0x22468a, copper: 0xd8913a, bronze: 0xa4612a, joint: 0x6b7686,
  screen: 0x0f1c38, glow: 0x6ff0ff, glowSoft: 0x2cb8d8, lamp: 0xffa13a,
  clockFace: 0xf6ead0, ink: 0x2a2420, dial: 0x2c3354,
};

/** Names of the animatable nodes (also stored in model.userData.rig, survives GLB export). */
export const STOP_TIME_RIG_NAMES = {
  root: 'StopTime', hips: 'hips', torso: 'torso', head: 'head', face: 'face',
  faces: ['face_angry', 'face_wink', 'face_happy', 'face_blink', 'face_surprised'],
  arms: ['arm_L', 'arm_R'], forearms: ['forearm_L', 'forearm_R'], hands: ['hand_L', 'hand_R'],
  cannons: ['cannon_L', 'cannon_R'], muzzles: ['muzzle_L', 'muzzle_R'],
  fingers: 'finger_{L|R}_{0..3}, thumb_{L|R}', legs: ['thigh_L', 'thigh_R'], shins: ['shin_L', 'shin_R'], feet: ['foot_L', 'foot_R'],
  antennas: ['antenna_L', 'antenna_R'], backpack: 'backpack', backpackClock: 'backpack_clock (hands: backpack_clock_a_hour/_minute, backpack_clock_b_hour/_minute)',
  chestClock: ['chest_clock_hour', 'chest_clock_minute'], gears: ['gear_L_big', 'gear_L_small', 'gear_R_big', 'gear_R_small'],
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
// ───────────────────────────── STOP TIME ─────────────────────────────
const FACES = ['angry', 'wink', 'happy', 'blink', 'surprised'];

/** Switch the screen face: 'angry' (default) | 'wink' | 'happy' | 'blink' | 'surprised'. Works on loaded GLBs too. */
export function setFace(model, name) {
  for (const f of FACES) { const g = model.getObjectByName(`face_${f}`); if (g) g.visible = f === name; }
}

export function createStopTime(options = {}) {
  const o = { toon: true, outline: true, outlineWidth: 0.012, outlineColor: 0x0d1430, ...options };
  const M = makeMaterials('stoptime_', o.toon);
  const C = { ...STOP_TIME_PALETTE, ...(o.palette || {}) }; // o.palette — перекраска для скинов
  const mat = {
    blue: M('blue', C.blue, { rough: 0.45, metal: 0.2 }), blueDark: M('blue_dark', C.blueDark, { rough: 0.5, metal: 0.2 }),
    copper: M('copper', C.copper, { rough: 0.35, metal: 0.6 }), bronze: M('bronze', C.bronze, { rough: 0.4, metal: 0.6 }),
    joint: M('joint', C.joint, { rough: 0.5, metal: 0.4 }), screen: M('screen', C.screen, { rough: 0.15, metal: 0.1 }),
    glow: M('glow', C.glow, { emissive: C.glow, ei: 1.3 }), glowSoft: M('glow_soft', C.glowSoft, { emissive: C.glowSoft, ei: 0.9 }),
    lamp: M('lamp', C.lamp, { emissive: C.lamp, ei: 1.2 }), clockFace: M('clock_face', C.clockFace, { rough: 0.5 }),
    ink: M('clock_ink', C.ink, { rough: 0.6 }), dial: M('dial', C.dial, { rough: 0.35, metal: 0.2 }),
    shine: M('shine', 0xffffff, { emissive: 0xffffff, ei: 0.5 }),
  };
  const P = { hips: V(0, 0.66, 0), torso: V(0, 0.74, 0), head: V(0, 1.14, 0), pack: V(0, 0.98, -0.3) };
  const root = group('StopTime');
  const hips = group('hips', root), torso = group('torso', hips), head = group('head', torso), pack = group('backpack', torso);
  const rebase = (g, p) => { g.children.forEach((c) => c.position.sub(p)); g.position.add(p); };

  // gear outline (teeth) for extrusion
  const gearShape = (ro, ri, n, hole = 0) => {
    const s = new THREE.Shape(), step = TAU / n;
    for (let i = 0; i < n; i++) {
      const a = i * step;
      [[ri, a - step * 0.5], [ri, a - step * 0.27], [ro, a - step * 0.16], [ro, a + step * 0.16], [ri, a + step * 0.27]].forEach(([r, ang], k) => {
        const x = r * Math.cos(ang), y = r * Math.sin(ang);
        if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y);
      });
    }
    s.closePath();
    if (hole) { const h = new THREE.Path(); h.absarc(0, 0, hole, 0, TAU, true); s.holes.push(h); }
    return s;
  };
  const extrude = (shape, depth, bevel = 0.006) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 10 }).translate(0, 0, -depth / 2);
  // clock dial facing local +Z; returns { hour, minute } pivots
  const clockDial = (name, parent, r, faceMat, inkMat, handMat, ticks = 12) => {
    mesh(cylZ(r, r, 0.012, 36), faceMat, `${name}_face`, { parent, noOutline: true });
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * TAU, big = i % 3 === 0;
      mesh(new THREE.BoxGeometry(big ? 0.012 : 0.007, big ? r * 0.2 : r * 0.12, 0.004), inkMat, `${name}_tick${i}`, { parent, p: [Math.sin(a) * r * 0.8, Math.cos(a) * r * 0.8, 0.008], r: [0, 0, -a], noOutline: true });
    }
    const hand = (nm, len, w, ang) => {
      const g = group(`${name}_${nm}`, parent, V(0, 0, 0.012)); g.rotation.z = ang;
      mesh(new THREE.BoxGeometry(w, len, 0.006).translate(0, len * 0.4, 0), handMat, `${name}_${nm}_mesh`, { parent: g, noOutline: true });
      return g;
    };
    const res = { hour: hand('hour', r * 0.55, r * 0.12, -2.1), minute: hand('minute', r * 0.82, r * 0.08, 0.4) };
    mesh(cylZ(r * 0.1, r * 0.1, 0.02, 12), handMat, `${name}_pin`, { parent, p: [0, 0, 0.016], noOutline: true });
    return res;
  };

  // ── hips & waist ──
  mesh(sphere(1, 28, 18), mat.copper, 'pelvis', { parent: hips, p: [0, 0.645, 0], s: [0.27, 0.13, 0.21] });
  mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.09, 24), mat.joint, 'waist_joint', { parent: torso, p: [0, 0.74, 0] });

  // ── torso ──
  mesh(roundedBox(0.56, 0.44, 0.38, 0.09), mat.blue, 'chest', { parent: torso, p: [0, 0.95, 0] });
  mesh(roundedBox(0.48, 0.06, 0.34, 0.025), mat.copper, 'chest_band', { parent: torso, p: [0, 0.76, 0] });
  for (const s of [1, -1]) {
    mesh(roundedBox(0.065, 0.56, 0.02, 0.01), mat.copper, `chest_strap_${s > 0 ? 'L' : 'R'}`, { parent: torso, p: [0.07 * s, 0.95, 0.2], r: [0, 0, 0.72 * s] });
    mesh(roundedBox(0.065, 0.3, 0.02, 0.01), mat.copper, `back_strap_${s > 0 ? 'L' : 'R'}`, { parent: torso, p: [0.14 * s, 1.0, -0.195], r: [0, 0, 0.25 * s] });
    const pad = group(`shoulder_pad_${s > 0 ? 'L' : 'R'}`, torso, V(0.31 * s, 1.11, 0));
    pad.quaternion.setFromUnitVectors(UP, V(0.7 * s, 1, 0).normalize());
    mesh(new THREE.SphereGeometry(0.135, 22, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.7, 1), mat.copper, `shoulder_pad_${s > 0 ? 'L' : 'R'}_mesh`, { parent: pad });
  }
  // chest clock medallion (gear rim + dial)
  const chestClock = group('chest_clock', torso, V(0, 0.94, 0.205));
  mesh(extrude(gearShape(0.15, 0.125, 12, 0.0), 0.03), mat.copper, 'chest_clock_gear', { parent: chestClock });
  const chestHands = clockDial('chest_clock', group('chest_clock_dial', chestClock, V(0, 0, 0.02)), 0.1, mat.clockFace, mat.ink, mat.ink);

  // ── backpack: blue box, big double-sided clock on top, gears on both sides ──
  mesh(roundedBox(0.52, 0.56, 0.28, 0.07), mat.blue, 'backpack_box', { parent: pack, p: [0, 0.98, -0.36] });
  for (const s of [1, -1]) for (const z of [1, -1]) mesh(roundedBox(0.045, 0.58, 0.045, 0.015), mat.copper, `backpack_trim_${s > 0 ? 'L' : 'R'}${z > 0 ? 'f' : 'b'}`, { parent: pack, p: [0.245 * s, 0.98, -0.36 + 0.125 * z] });
  mesh(roundedBox(0.5, 0.04, 0.3, 0.015), mat.copper, 'backpack_trim_top', { parent: pack, p: [0, 1.25, -0.36] });
  const bigClock = group('backpack_clock', pack, V(0, 1.4, -0.38)); bigClock.rotation.y = Math.PI / 2;   // local +Z = model +X
  mesh(cylZ(0.21, 0.21, 0.11, 40), mat.copper, 'backpack_clock_body', { parent: bigClock });
  for (const s of [1, -1]) mesh(new THREE.TorusGeometry(0.19, 0.022, 10, 40), mat.bronze, `backpack_clock_rim_${s > 0 ? 'a' : 'b'}`, { parent: bigClock, p: [0, 0, 0.055 * s], ol: 0.6 });
  const clockHands = [];
  for (const s of [1, -1]) {
    const side = group(`backpack_clock_side_${s > 0 ? 'a' : 'b'}`, bigClock, V(0, 0, 0.058 * s)); if (s < 0) side.rotation.y = Math.PI;
    clockHands.push(clockDial(`backpack_clock_${s > 0 ? 'a' : 'b'}`, side, 0.17, mat.dial, mat.copper, mat.copper, 4));
    // two curved "rewind" arrows on the dial
    for (const k of [0, 1]) {
      const arc = mesh(new THREE.TorusGeometry(0.115, 0.012, 6, 20, Math.PI * 0.55), mat.copper, `backpack_clock_${s > 0 ? 'a' : 'b'}_arrow${k}`, { parent: side, p: [0, 0, 0.012], r: [0, 0, k * Math.PI + 0.3], noOutline: true });
      const head2 = mesh(new THREE.ConeGeometry(0.025, 0.05, 3), mat.copper, `${arc.name}_tip`, { parent: side, noOutline: true });
      const a = k * Math.PI + 0.3; head2.position.set(Math.cos(a) * 0.115, Math.sin(a) * 0.115, 0.014); head2.rotation.z = a + Math.PI;
    }
  }
  mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 16), mat.joint, 'backpack_clock_mount', { parent: pack, p: [0, 1.22, -0.38] });
  const gears = [];
  for (const s of [1, -1]) {
    const tag = s > 0 ? 'L' : 'R';
    for (const [nm, r, y, z, n] of [['big', 0.13, 0.95, -0.36, 12], ['small', 0.08, 0.76, -0.27, 9]]) {
      const g = group(`gear_${tag}_${nm}`, pack, V(0.29 * s, y, z)); g.rotation.y = Math.PI / 2 * s;
      mesh(extrude(gearShape(r, r * 0.8, n, r * 0.22), 0.035), mat.copper, `gear_${tag}_${nm}_mesh`, { parent: g });
      mesh(cylZ(r * 0.32, r * 0.32, 0.05, 16), mat.bronze, `gear_${tag}_${nm}_hub`, { parent: g, noOutline: true });
      gears.push(g);
    }
  }

  // ── head: helmet + screen face ──
  mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.08, 16), mat.joint, 'neck', { parent: head, p: [0, 1.15, 0] });
  mesh(roundedBox(0.5, 0.44, 0.42, 0.13), mat.blue, 'helmet', { parent: head, p: [0, 1.37, 0] });
  const frame = rrShape(0.43, 0.34, 0.08); const hole = new THREE.Path(rrShape(0.38, 0.285, 0.06).getPoints(8)); frame.holes.push(hole);
  mesh(extrude(frame, 0.03, 0.008), mat.copper, 'screen_frame', { parent: head, p: [0, 1.36, 0.212] });
  mesh(extrude(rrShape(0.39, 0.295, 0.065), 0.012, 0.003), mat.screen, 'screen', { parent: head, p: [0, 1.36, 0.208], noOutline: true });
  mesh(new THREE.BoxGeometry(0.06, 0.012, 0.003), mat.shine, 'screen_glare', { parent: head, p: [-0.14, 1.47, 0.221], r: [0, 0, 0.5], noOutline: true });
  // forehead crest with chevron
  const crest = group('crest', head, V(0, 1.565, 0.13)); crest.rotation.x = -0.75;
  const cs = new THREE.Shape([new THREE.Vector2(-0.11, -0.05), new THREE.Vector2(0.11, -0.05), new THREE.Vector2(0.11, 0.03), new THREE.Vector2(0, 0.08), new THREE.Vector2(-0.11, 0.03)]);
  mesh(extrude(cs, 0.025, 0.008), mat.copper, 'crest_plate', { parent: crest });
  const chev = new THREE.Shape([new THREE.Vector2(-0.06, 0.02), new THREE.Vector2(0, -0.025), new THREE.Vector2(0.06, 0.02), new THREE.Vector2(0.06, 0.0), new THREE.Vector2(0, -0.045), new THREE.Vector2(-0.06, 0.0)]);
  mesh(new THREE.ShapeGeometry(chev), mat.bronze, 'crest_chevron', { parent: crest, p: [0, 0, 0.022], noOutline: true });
  // ear pieces with small clocks
  for (const s of [1, -1]) {
    const tag = s > 0 ? 'L' : 'R';
    const ear = group(`ear_${tag}`, head, V(0.265 * s, 1.36, -0.02)); ear.rotation.y = Math.PI / 2 * s;
    mesh(cylZ(0.09, 0.09, 0.07, 28), mat.copper, `ear_${tag}_cup`, { parent: ear });
    clockDial(`ear_${tag}_clock`, group(`ear_${tag}_dial`, ear, V(0, 0, 0.036)), 0.06, mat.clockFace, mat.ink, mat.ink, 4);
    // antenna: curved copper loop ("ears" on top)
    const ant = group(`antenna_${tag}`, head, V(0.13 * s, 1.56, -0.06));
    const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.03 * s, 0.12, -0.02), V(0.12 * s, 0.2, 0.0), V(0.2 * s, 0.15, 0.03), V(0.17 * s, 0.03, 0.04)]);
    mesh(new THREE.TubeGeometry(curve, 24, 0.022, 8), mat.copper, `antenna_${tag}_mesh`, { parent: ant, ol: 0.7 });
    mesh(sphere(0.032, 12, 8), mat.copper, `antenna_${tag}_tip`, { parent: ant, p: [0.17 * s, 0.03, 0.04] });
  }

  // ── screen faces (emissive decals on the flat screen; one visible at a time, see setFace) ──
  const face = group('face', head, V(0, 1.36, 0.222));
  const fg = (name, vis) => { const g = group(`face_${name}`, face); g.visible = vis; return g; };
  const flat = (shape, m, name, parent, z = 0) => mesh(new THREE.ShapeGeometry(shape, 12), m, name, { parent, p: [0, 0, z], noOutline: true });
  const circle = (x, y, r) => { const s = new THREE.Shape(); s.absarc(x, y, r, 0, TAU, false); return s; };
  const stroke = (pts, w) => {
    const L = [], R = [];
    pts.forEach((p, i) => {
      const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
      const t = new THREE.Vector2(b[0] - a[0], b[1] - a[1]).normalize(), n = new THREE.Vector2(-t.y, t.x);
      L.push(new THREE.Vector2(p[0] + n.x * w / 2, p[1] + n.y * w / 2)); R.push(new THREE.Vector2(p[0] - n.x * w / 2, p[1] - n.y * w / 2));
    });
    return new THREE.Shape([...L, ...R.reverse()]);
  };
  const arcPts = (cx, cy, r, a0, a1, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  const eyeOpen = (g, s, nm, angry = true) => {
    flat(circle(0.085 * s, 0.01, 0.047), mat.glow, `${nm}_eye${s > 0 ? 'L' : 'R'}`, g, 0);
    flat(circle(0.078 * s, 0.0, 0.02), mat.glowSoft, `${nm}_pupil${s > 0 ? 'L' : 'R'}`, g, 0.001);
    if (angry) {
      // cut the top-inner part of the eye with screen colour → angry squint, plus a brow bar
      flat(new THREE.Shape([new THREE.Vector2(0.02 * s, 0.03), new THREE.Vector2(0.14 * s, 0.075), new THREE.Vector2(0.14 * s, 0.09), new THREE.Vector2(0.02 * s, 0.09)]), mat.screen, `${nm}_lid${s > 0 ? 'L' : 'R'}`, g, 0.002);
      flat(stroke([[0.035 * s, 0.05], [0.14 * s, 0.09]], 0.016), mat.glow, `${nm}_brow${s > 0 ? 'L' : 'R'}`, g, 0.003);
    }
  };
  { const g = fg('angry', true); eyeOpen(g, 1, 'angry'); eyeOpen(g, -1, 'angry'); flat(stroke([[-0.045, -0.072], [-0.01, -0.084], [0.025, -0.08], [0.05, -0.066]], 0.013), mat.glow, 'angry_mouth', g); }
  {
    const g = fg('wink', false); eyeOpen(g, -1, 'wink');
    flat(stroke(arcPts(0.085, -0.005, 0.04, 0.25, Math.PI - 0.25), 0.014), mat.glow, 'wink_closed', g);
    flat(stroke([[0.04, 0.07], [0.135, 0.06]], 0.014), mat.glow, 'wink_brow', g);
    const sm = new THREE.Shape(); sm.moveTo(-0.08, -0.05); sm.lineTo(0.08, -0.05); sm.quadraticCurveTo(0.075, -0.115, 0, -0.118); sm.quadraticCurveTo(-0.075, -0.115, -0.08, -0.05);
    flat(sm, mat.glow, 'wink_grin', g);
    for (const x of [-0.04, 0, 0.04]) flat(new THREE.Shape([new THREE.Vector2(x - 0.004, -0.052), new THREE.Vector2(x + 0.004, -0.052), new THREE.Vector2(x + 0.004, -0.1), new THREE.Vector2(x - 0.004, -0.1)]), mat.screen, `wink_tooth_gap_${x}`, g, 0.002);
    flat(stroke([[-0.07, -0.078], [0.07, -0.078]], 0.006), mat.screen, 'wink_teeth_line', g, 0.002);
  }
  {
    const g = fg('happy', false);
    for (const s of [1, -1]) flat(stroke(arcPts(0.085 * s, -0.01, 0.04, 0.2, Math.PI - 0.2), 0.016), mat.glow, `happy_eye${s > 0 ? 'L' : 'R'}`, g);
    const sm = new THREE.Shape(); sm.moveTo(-0.06, -0.055); sm.lineTo(0.06, -0.055); sm.quadraticCurveTo(0.055, -0.11, 0, -0.112); sm.quadraticCurveTo(-0.055, -0.11, -0.06, -0.055);
    flat(sm, mat.glow, 'happy_mouth', g);
  }
  {
    const g = fg('blink', false);
    for (const s of [1, -1]) flat(stroke([[0.045 * s, 0.01], [0.125 * s, 0.01]], 0.014), mat.glow, `blink_eye${s > 0 ? 'L' : 'R'}`, g);
    flat(stroke([[-0.045, -0.072], [-0.01, -0.084], [0.025, -0.08], [0.05, -0.066]], 0.013), mat.glow, 'blink_mouth', g);
  }
  {
    const g = fg('surprised', false);
    for (const s of [1, -1]) { flat(circle(0.085 * s, 0.015, 0.055), mat.glow, `surprised_eye${s > 0 ? 'L' : 'R'}`, g); flat(circle(0.085 * s, 0.015, 0.022), mat.screen, `surprised_pupil${s > 0 ? 'L' : 'R'}`, g, 0.001); }
    const ring = circle(0, -0.08, 0.03); ring.holes.push(new THREE.Path().absarc(0, -0.08, 0.017, 0, TAU, true));
    flat(ring, mat.glow, 'surprised_mouth', g);
  }

  // ── arms: shoulder → elbow → wrist, forearm = cannon gauntlet, blocky fist under the barrel ──
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
  const parts = { arms: {}, forearms: {}, hands: {}, cannons: {}, muzzles: {}, fingers: {}, thighs: {}, shins: {}, feet: {} };
  for (const s of [1, -1]) {
    const tag = s > 0 ? 'L' : 'R';
    const Sh = V(0.36 * s, 1.07, 0.0), El = V(0.43 * s, 0.82, 0.02), Wr = V(0.42 * s, 0.8, 0.36);
    const [arm, fore, hand] = chain([`arm_${tag}`, `forearm_${tag}`, `hand_${tag}`], [Sh, El, Wr, Wr.clone().add(V(0, 0, 0.05))], torso);
    mesh(limbDown(0.055, arm.len), mat.joint, `arm_${tag}_mesh`, { parent: arm.g });
    mesh(sphere(0.075, 16, 12), mat.copper, `elbow_${tag}`, { parent: fore.g });
    const L2 = fore.len;
    mesh(new THREE.CylinderGeometry(0.1, 0.11, L2 * 0.9, 24).translate(0, -L2 * 0.5, 0), mat.blue, `forearm_${tag}_gauntlet`, { parent: fore.g });
    for (const y of [-0.06, -L2 * 0.95]) mesh(new THREE.TorusGeometry(0.108, 0.02, 8, 24).rotateX(Math.PI / 2), mat.copper, `forearm_${tag}_ring${y > -0.1 ? 0 : 1}`, { parent: fore.g, p: [0, y, 0], ol: 0.6 });
    // indicator lights on the outer side
    fore.g.updateWorldMatrix(true, false);
    const out = V(s, 0.2, 0).normalize().applyQuaternion(fore.g.getWorldQuaternion(new THREE.Quaternion()).invert()); out.y = 0; out.normalize();
    for (let i = 0; i < 3; i++) mesh(sphere(0.018, 10, 8), mat.lamp, `forearm_${tag}_light${i}`, { parent: fore.g, p: [out.x * 0.105, -L2 * (0.45 + i * 0.12), out.z * 0.105], noOutline: true });
    // cannon barrel (child of the forearm, pivot at the wrist): slide/hide it to show bare hands
    const cannon = group(`cannon_${tag}`, fore.g, V(0, -L2, 0));
    mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.16, 24).translate(0, -0.08, 0), mat.copper, `cannon_${tag}_barrel`, { parent: cannon });
    mesh(new THREE.CylinderGeometry(0.095, 0.09, 0.06, 24).translate(0, -0.18, 0), mat.copper, `cannon_${tag}_muzzle_ring`, { parent: cannon });
    mesh(new THREE.TorusGeometry(0.085, 0.012, 8, 24).rotateX(Math.PI / 2), mat.bronze, `cannon_${tag}_lip`, { parent: cannon, p: [0, -0.21, 0], noOutline: true });
    mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.01, 24), mat.glow, `cannon_${tag}_glow`, { parent: cannon, p: [0, -0.211, 0], noOutline: true });
    const muzzle = group(`muzzle_${tag}`, cannon, V(0, -0.23, 0));
    // blocky fist below the barrel (axis-aligned)
    const fist = aligned(`hand_${tag}_shape`, hand.g, Wr.clone().add(V(0, -0.1, 0.03)));
    mesh(roundedBox(0.1, 0.1, 0.11, 0.025), mat.blue, `hand_${tag}_palm`, { parent: fist });
    const fingers = [];
    for (let i = 0; i < 4; i++) {
      const f = group(`finger_${tag}_${i}`, fist, V(-0.036 + i * 0.024, 0.035, 0.055)); f.rotation.x = 1.9;
      mesh(roundedBox(0.022, 0.07, 0.03, 0.008).translate(0, 0.03, 0), mat.blue, `finger_${tag}_${i}_mesh`, { parent: f, ol: 0.5 });
      fingers.push(f);
    }
    const th = group(`thumb_${tag}`, fist, V(-0.055 * s, 0.0, 0.03)); th.rotation.set(0, 0, 0.9 * s);
    mesh(roundedBox(0.026, 0.06, 0.03, 0.008).translate(0, 0.025, 0), mat.blue, `thumb_${tag}_mesh`, { parent: th, ol: 0.5 });
    parts.arms[tag] = arm.g; parts.forearms[tag] = fore.g; parts.hands[tag] = hand.g; parts.cannons[tag] = cannon; parts.muzzles[tag] = muzzle; parts.fingers[tag] = fingers;

    // legs: hip → knee → ankle, armoured shins and boots
    const Hp = V(0.14 * s, 0.62, 0), Kn = V(0.16 * s, 0.38, 0.03), An = V(0.17 * s, 0.15, 0), Toe = V(0.17 * s, 0.06, 0.14);
    const [thigh, shin, foot] = chain([`thigh_${tag}`, `shin_${tag}`, `foot_${tag}`], [Hp, Kn, An, Toe], hips);
    mesh(limbDown(0.06, thigh.len), mat.joint, `thigh_${tag}_mesh`, { parent: thigh.g });
    mesh(new THREE.CylinderGeometry(0.095, 0.115, shin.len * 0.95, 24).translate(0, -shin.len * 0.5, 0), mat.blue, `shin_${tag}_armor`, { parent: shin.g });
    mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24).rotateX(Math.PI / 2), mat.copper, `shin_${tag}_ring`, { parent: shin.g, p: [0, -0.04, 0], ol: 0.6 });
    const knee = aligned(`knee_${tag}`, shin.g, Kn.clone().add(V(0, 0, 0.07)));
    mesh(cylZ(0.065, 0.065, 0.03, 20), mat.copper, `knee_${tag}_cap`, { parent: knee });
    mesh(cylZ(0.025, 0.025, 0.035, 12), mat.bronze, `knee_${tag}_bolt`, { parent: knee, noOutline: true });
    const boot = aligned(`boot_${tag}`, foot.g, An);
    mesh(roundedBox(0.2, 0.13, 0.3, 0.055), mat.blue, `boot_${tag}_body`, { parent: boot, p: [0, -0.075, 0.05] });
    mesh(roundedBox(0.215, 0.04, 0.32, 0.015), mat.copper, `boot_${tag}_sole`, { parent: boot, p: [0, -0.13, 0.05] });
    for (const x of [1, -1]) mesh(cylX(0.045, 0.045, 0.025, 16), mat.copper, `boot_${tag}_ankle${x > 0 ? 'o' : 'i'}`, { parent: boot, p: [0.105 * x, -0.05, -0.01] });
    parts.thighs[tag] = thigh.g; parts.shins[tag] = shin.g; parts.feet[tag] = foot.g;
  }

  // ── re-base pivots (innermost first) ──
  rebase(head, P.head); rebase(pack, P.pack); rebase(torso, P.torso); rebase(hips, P.hips);

  if (o.outline) addOutlines(root, o.outlineColor, o.outlineWidth);
  root.userData = { character: 'StopTime', units: 'metres-ish, height ≈ 1.8 with antennae', forward: '+Z', up: '+Y', rig: STOP_TIME_RIG_NAMES };
  Object.defineProperty(root, 'parts', {
    enumerable: false,
    value: {
      hips, torso, head, backpack: pack, face,
      faces: Object.fromEntries(FACES.map((f) => [f, root.getObjectByName(`face_${f}`)])),
      ...parts,
      antennas: { L: root.getObjectByName('antenna_L'), R: root.getObjectByName('antenna_R') },
      backpackClock: { body: bigClock, hour: clockHands.map((c) => c.hour), minute: clockHands.map((c) => c.minute) },
      chestClock: chestHands, gears,
    },
  });
  captureRest(root);
  return root;
}
