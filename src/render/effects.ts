// Частицы, кольца-волны, лучи. Один InstancedMesh на всех — дёшево для телефонов.
import * as THREE from 'three';
import { blobTexture } from './textures';

interface P {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number; size: number; grow: number;
  r: number; g: number; b: number;
  grav: number; drag: number;
}

export class Particles {
  mesh: THREE.InstancedMesh;
  private list: P[] = [];
  private m4 = new THREE.Matrix4();
  private col = new THREE.Color();
  constructor(parent: THREE.Object3D, private max = 500) {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
  }

  spawn(o: { x: number; y: number; z: number; n: number; color: number | number[]; speed?: number; up?: number; size?: number; life?: number; grav?: number; drag?: number; spread?: number; dirX?: number; dirZ?: number; grow?: number }) {
    const cols = Array.isArray(o.color) ? o.color : [o.color];
    for (let i = 0; i < o.n; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = Math.random() * Math.PI * 2, sp = (o.speed ?? 3) * (0.4 + Math.random() * 0.8);
      let vx = Math.cos(a) * sp, vz = Math.sin(a) * sp;
      if (o.dirX !== undefined && o.dirZ !== undefined) {
        const sprd = o.spread ?? 0.5;
        const b = Math.atan2(o.dirZ, o.dirX) + (Math.random() - 0.5) * sprd * 2;
        vx = Math.cos(b) * sp; vz = Math.sin(b) * sp;
      }
      this.col.set(cols[i % cols.length]);
      const life = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      this.list.push({
        x: o.x + (Math.random() - 0.5) * 0.2, y: o.y, z: o.z + (Math.random() - 0.5) * 0.2,
        vx, vy: (o.up ?? 2.5) * (0.5 + Math.random()), vz,
        life, max: life, size: (o.size ?? 0.09) * (0.6 + Math.random() * 0.8), grow: o.grow ?? 0,
        r: this.col.r, g: this.col.g, b: this.col.b, grav: o.grav ?? 9, drag: o.drag ?? 1.5,
      });
    }
  }

  update(dt: number) {
    let n = 0;
    const out: P[] = [];
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy -= p.grav * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
      const k = p.life / p.max;
      const s = p.size * (p.grow ? 1 + (1 - k) * p.grow : Math.min(1, k * 2.5));
      this.m4.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
      this.mesh.setMatrixAt(n, this.m4);
      this.mesh.instanceColor!.setXYZ(n, p.r, p.g, p.b);
      n++;
      out.push(p);
    }
    this.list = out;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }
}

/** Расходящиеся кольца, вспышки и лучи. */
export class Flashes {
  private items: { obj: THREE.Mesh; life: number; max: number; grow: number; fade: boolean }[] = [];
  private ringGeo = new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2);
  private blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  constructor(private parent: THREE.Object3D) {}

  ring(x: number, z: number, color: number, size = 1.5, life = 0.4, y = 0.08) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }));
    m.position.set(x, y, z);
    m.scale.setScalar(0.1);
    this.parent.add(m);
    this.items.push({ obj: m, life, max: life, grow: size, fade: true });
  }

  glow(x: number, y: number, z: number, color: number, size = 1.2, life = 0.25) {
    const m = new THREE.Mesh(this.blobGeo, new THREE.MeshBasicMaterial({ color, map: blobTexture(), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set(x, y, z);
    m.scale.setScalar(size);
    this.parent.add(m);
    this.items.push({ obj: m, life, max: life, grow: 0, fade: true });
  }

  beam(x1: number, z1: number, x2: number, z2: number, color: number, life = 0.35) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const geo = new THREE.BoxGeometry(len, 0.18, 0.35);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set((x1 + x2) / 2, 0.7, (z1 + z2) / 2);
    m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    this.parent.add(m);
    this.items.push({ obj: m, life, max: life, grow: 0, fade: true });
  }

  update(dt: number) {
    this.items = this.items.filter((it) => {
      it.life -= dt;
      if (it.life <= 0) {
        it.obj.removeFromParent();
        (it.obj.material as THREE.Material).dispose();
        if (it.obj.geometry !== this.ringGeo && it.obj.geometry !== this.blobGeo) it.obj.geometry.dispose();
        return false;
      }
      const k = 1 - it.life / it.max;
      if (it.grow) it.obj.scale.setScalar(0.1 + k * it.grow);
      else if (it.obj.geometry !== this.blobGeo) it.obj.scale.set(1, 1 - k * 0.8, 1 - k * 0.8);
      (it.obj.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
      return true;
    });
  }
}
