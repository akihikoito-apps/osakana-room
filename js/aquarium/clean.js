// そうじのアニメ（約2秒）：四角い あみ（assets/items/net.png と同じ水色の枠）が水面から入り、
// 手前の底にある ごみ（dirt_bits）を スイーッ とすくって、水面の上へ持ち上げて出ていく。
// 魚は あみ の通り道から 先によけておく（ctx.avoid）。魚をつかまえるようには見せない。
import * as THREE from '../../vendor/three.module.min.js';
import { TANK_H, WATER_TOP } from './tank.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => t * t * (3 - 2 * t);
const T_IN = 0.45, T_SWEEP = 1.0, T_OUT = 0.6;
export const CLEAN_DUR = T_IN + T_SWEEP + T_OUT;   // 2.05 秒

function meshTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const g = cv.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 29, 29);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 5);
  return t;
}

export class Cleaner {
  constructor(scene, tank, fx) {
    this.scene = scene; this.tank = tank; this.fx = fx;
    this.active = null;
    this.rig = new THREE.Group();
    this.rig.visible = false;
    const blue = new THREE.MeshLambertMaterial({ color: '#6cc6ee' });
    // 四角い枠（口は +x を向く。枠は YZ 面）
    const S = 0.95;   // 枠の半分の大きさ
    const frame = new THREE.Group();
    const barV = new THREE.CylinderGeometry(0.07, 0.07, S * 2 + 0.14, 8);
    const barH = new THREE.CylinderGeometry(0.07, 0.07, S * 2 + 0.14, 8);
    barH.rotateX(Math.PI / 2);
    for (const sz of [-1, 1]) { const m = new THREE.Mesh(barV, blue); m.position.z = sz * S; frame.add(m); }
    for (const sy of [-1, 1]) { const m = new THREE.Mesh(barH, blue); m.position.y = sy * S; frame.add(m); }
    // 網の袋（四角い すい台。うしろ -x へ のびる）
    this.netTex = meshTexture();
    const bagG = new THREE.CylinderGeometry(S * 1.414, S * 1.0, 1.0, 4, 1, false);
    bagG.rotateY(Math.PI / 4);
    bagG.rotateZ(-Math.PI / 2);         // 軸を x に。大きい口が x=0、袋の底が x=-1
    bagG.translate(-0.5, 0, 0);
    const bag = new THREE.Mesh(bagG, new THREE.MeshLambertMaterial({ map: this.netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: '#ffffff', emissive: '#506a74' }));
    bag.renderOrder = 7;
    const bottomG = new THREE.PlaneGeometry(S * 1.4, S * 1.4);
    bottomG.rotateY(Math.PI / 2);
    const bottom = new THREE.Mesh(bottomG, bag.material);
    bottom.position.x = -1.0;
    // 柄（水色・先に輪）
    const hl = 14;
    const handleG = new THREE.CylinderGeometry(0.09, 0.09, hl, 10);
    handleG.translate(0, hl / 2, 0);
    const handle = new THREE.Mesh(handleG, blue);
    handle.position.set(0, S, 0);
    handle.rotation.z = -0.32;
    this.rig.add(frame, bag, bottom, handle);
    this.rig.traverse((o) => { o.frustumCulled = false; });
    scene.add(this.rig);
    this.geos = [barV, barH, bagG, bottomG, handleG];
    this.mats = [blue, bag.material];
    this.avoid = { pos: new THREE.Vector3(), r: 4.0, strong: true };
  }

  play() {
    if (this.active) return this.active.promise;
    const b = this.tank.bounds, W = this.tank.W;
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    // ごみの帯（手前の底）をすくう。魚が少ない側から入る
    const patches = this.tank.dirtPatches.filter((p) => p.mesh.visible);
    const z = clamp(0.4, b.minZ + 0.5, b.maxZ - 0.3);
    let x0 = -0.4 * W, x1 = 0.4 * W;
    if (patches.length) { x0 = Math.min(...patches.map((p) => p.x)) - 1.2; x1 = Math.max(...patches.map((p) => p.x)) + 1.0; }
    const fishL = (this.fishes || []).filter((f) => f.pos.x < 0 && f.pos.y < 3.5).length;
    const fishR = (this.fishes || []).filter((f) => f.pos.x >= 0 && f.pos.y < 3.5).length;
    const dir = fishL <= fishR ? 1 : -1;   // 魚の少ない側から入る
    if (dir < 0) [x0, x1] = [x1, x0];
    x0 = clamp(x0, -0.42 * W, 0.42 * W); x1 = clamp(x1, -0.42 * W, 0.42 * W);
    this.active = { t: 0, promise, resolve, x0, x1, z, dir, patches };
    for (const p of patches) { p.caught = false; p.local = new THREE.Vector3(-0.35 - Math.random() * 0.45, -0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.8); }
    this.rig.visible = true;
    this.tank.holdDirt = true;
    this.tank.addRipple(x0, z);
    return promise;
  }

  pose(t, a) {
    const low = (x) => this.tank.sandHeight(x, a.z) + 0.85;
    let x, y, tilt;
    if (t < T_IN) {              // 水面から まっすぐ底へ
      const k = ease(t / T_IN);
      x = a.x0; y = TANK_H + 2 + (low(a.x0) - TANK_H - 2) * k; tilt = -0.5 + 0.3 * k;
    } else if (t < T_IN + T_SWEEP) {   // 底すれすれを スイーッ
      const k = ease((t - T_IN) / T_SWEEP);
      x = a.x0 + (a.x1 - a.x0) * k; y = low(x) + 0.12 * Math.sin(k * Math.PI); tilt = -0.2;
    } else {                     // 口を上に向けて 水面の上へ
      const k = ease(clamp((t - T_IN - T_SWEEP) / T_OUT, 0, 1));
      x = a.x1 + a.dir * 0.4 * k; y = low(a.x1) + (TANK_H + 2.4 - low(a.x1)) * k; tilt = -0.2 + 1.0 * k;
    }
    return { x, y, tilt };
  }

  update(dt, ctx) {
    this.fishes = ctx.fishes;
    const a = this.active;
    if (!a) { ctx.avoid = null; return; }
    a.t += dt;
    const t = Math.min(a.t, CLEAN_DUR);
    const { x, y, tilt } = this.pose(t, a);
    // 口を進む向きへ（dir=-1 なら左向き）
    this.rig.position.set(x, y, a.z);
    this.rig.rotation.set(0, a.dir > 0 ? 0 : Math.PI, tilt);
    this.rig.updateMatrixWorld(true);
    // 魚がよける中心：あみの少し先（通り道を先に空けてもらう）
    const lead = t < T_IN + T_SWEEP ? 1.2 : 0;
    this.avoid.pos.set(lead, 0.3, 0).applyMatrix4(this.rig.matrixWorld);
    ctx.avoid = y < WATER_TOP + 1 ? this.avoid : null;
    // ごみ：あみが通ったらすくわれて、あみの中で いっしょに上がる
    for (const p of a.patches) {
      if (!p.caught && t > T_IN * 0.8 && Math.abs(p.x - x) < 0.9) p.caught = true;
      if (p.caught) {
        _v.copy(p.local).applyMatrix4(this.rig.matrixWorld);
        p.mesh.position.lerp(_v, Math.min(1, dt * 10));
        p.mesh.scale.setScalar(0.75);
        p.mesh.visible = p.mesh.position.y < TANK_H + 0.3;
      }
    }
    if (!a.outRipple && t > T_IN + T_SWEEP + 0.3) { a.outRipple = true; this.tank.addRipple(x, a.z); this.tank.holdDirt = false; }
    if (!a.sparkle && t > T_IN + T_SWEEP + 0.15) {
      a.sparkle = true;
      for (let i = 0; i < 6; i++) {
        const sx = a.x0 + (a.x1 - a.x0) * (i / 5), sy = this.tank.sandHeight(sx, a.z) + 0.6 + (i % 3) * 0.6;
        this.fx.add('sparkle', (out) => out.set(sx, sy, a.z), { delay: i * 0.06, size: 0.5, life: 0.8, vy: 0.3, twinkle: true });
      }
    }
    if (a.t >= CLEAN_DUR) this.finish();
  }

  finish() {
    const a = this.active;
    if (!a) return;
    this.active = null;
    this.rig.visible = false;
    for (const p of a.patches) { p.caught = false; p.mesh.visible = false; }   // すくったごみは出ていった
    this.tank.holdDirt = false;
    this.tank.cleanedPatches = a.patches;   // にごりの変化を待つ間は出さない
    a.resolve();
  }

  dispose() {
    this.finish();
    this.scene.remove(this.rig);
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.netTex.dispose();
  }
}

const _v = new THREE.Vector3();
