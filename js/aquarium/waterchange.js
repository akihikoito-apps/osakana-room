// v0.7 みずかえの えんしゅつ（約3びょう）。みずかえセットの 絵（assets/items/water_change.png）と おなじ
// すきとおった ホース（サイフォン）で 水を すって 3分の2 まで さげ → 青い ノズルの ホースで 新しい 水を そそいで もとの 高さへ。
// Codex・agy に 相談：ぜんぶで 3びょう（さがる 約1・そそぐ 約1.5）。そそぐのは 左がわ（いけの りくちは 右なので どの 水槽でも 水の 上）。
// 水位を さげる あいだは およげる 高さ（bounds.top）も いっしょに さげる（tank.setLevel）。魚は ホースと 水の 柱を よける（ctx.avoid）。
import * as THREE from '../../vendor/three.module.min.js';
import { TANK_H } from './tank.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;
export const WC = { in: 0.25, drain: 0.9, swap: 0.3, pour: 1.35, out: 0.2 };
export const WATER_CHANGE_DUR = WC.in + WC.drain + WC.swap + WC.pour + WC.out;   // 3.0 びょう
export const DRAIN_TO = 2 / 3;   // 水の ふかさを 3分の2 に（底からの 高さ）

function streakTexture() {
  const cv = document.createElement('canvas');
  cv.width = 32; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(210,240,255,0.55)'; g.fillRect(0, 0, 32, 64);
  for (let i = 0; i < 14; i++) {
    const x = (i * 7.3) % 32, y = (i * 23.7) % 64, h = 8 + (i * 5) % 18;
    g.fillStyle = i % 3 ? 'rgba(255,255,255,0.85)' : 'rgba(150,215,245,0.8)';
    g.fillRect(x, y, 2 + (i % 2) * 2, h);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class WaterChanger {
  constructor(scene, tank, fx) {
    this.scene = scene; this.tank = tank; this.fx = fx;
    this.active = null;
    this.geos = []; this.mats = [];
    const G = (g) => (this.geos.push(g), g), M = (m) => (this.mats.push(m), m);
    this.tex = streakTexture();
    const clear = M(new THREE.MeshLambertMaterial({ color: '#cfeefc', transparent: true, opacity: 0.55, depthWrite: false, emissive: '#3a6a7a' }));
    const flowIn = M(new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, opacity: 0.7, depthWrite: false, color: '#b7d9c9', fog: false }));
    const blue = M(new THREE.MeshLambertMaterial({ color: '#4fb3ea' }));
    const darkBlue = M(new THREE.MeshLambertMaterial({ color: '#2f7fd0' }));
    const white = M(new THREE.MeshLambertMaterial({ color: '#f4f8fb' }));

    // ---- ホース（サイフォン）：下に すいこみ口（太い つつ）、上へ 細い ホース。原点が すいこみ口の 下はし ----
    this.siphon = new THREE.Group();
    const cupG = G(new THREE.CylinderGeometry(0.34, 0.34, 1.7, 16, 1, true)); cupG.translate(0, 0.85, 0);
    const cup = new THREE.Mesh(cupG, clear); cup.renderOrder = 8;
    const cupFlowG = G(new THREE.CylinderGeometry(0.26, 0.26, 1.6, 12, 1, true)); cupFlowG.translate(0, 0.85, 0);
    const cupFlow = new THREE.Mesh(cupFlowG, flowIn); cupFlow.renderOrder = 7;
    const ringG = G(new THREE.TorusGeometry(0.34, 0.06, 6, 16)); ringG.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(ringG, clear); ring.position.y = 1.7;
    const pumpG = G(new THREE.CylinderGeometry(0.24, 0.24, 0.9, 12)); pumpG.translate(0, 2.2, 0);
    const pump = new THREE.Mesh(pumpG, darkBlue);
    const hoseL = 14;
    const hoseG = G(new THREE.CylinderGeometry(0.15, 0.15, hoseL, 10, 1, true)); hoseG.translate(0, 2.6 + hoseL / 2, 0);
    const hose = new THREE.Mesh(hoseG, clear); hose.renderOrder = 8;
    const hoseFlowG = G(new THREE.CylinderGeometry(0.09, 0.09, hoseL, 8, 1, true)); hoseFlowG.translate(0, 2.6 + hoseL / 2, 0);
    const hoseFlow = new THREE.Mesh(hoseFlowG, flowIn); hoseFlow.renderOrder = 7;
    this.siphon.add(cup, cupFlow, ring, pump, hose, hoseFlow);

    // ---- そそぐ ホース：先に 青い ノズル（みずかえセットの 絵と おなじ）。原点が 口。+y が ホースの ほう ----
    // バケツは 画面の 上の ボタンに かくれて 見えないので、ホースの 口から そそぐ（Codex の あん）
    this.nozzle = new THREE.Group();
    const nzG = G(new THREE.CylinderGeometry(0.2, 0.17, 0.75, 14)); nzG.translate(0, 0.375, 0);
    const nz = new THREE.Mesh(nzG, blue);
    const ribG = G(new THREE.TorusGeometry(0.21, 0.05, 6, 14)); ribG.rotateX(Math.PI / 2);
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(ribG, darkBlue); r.position.y = 0.18 + i * 0.2; this.nozzle.add(r); }
    const lipG = G(new THREE.TorusGeometry(0.17, 0.045, 6, 14)); lipG.rotateX(Math.PI / 2);
    const lipM = new THREE.Mesh(lipG, white);
    const pHoseG = G(new THREE.CylinderGeometry(0.15, 0.15, hoseL, 10, 1, true)); pHoseG.translate(0, 0.75 + hoseL / 2, 0);
    const pHose = new THREE.Mesh(pHoseG, clear); pHose.renderOrder = 8;
    const pFlowG = G(new THREE.CylinderGeometry(0.09, 0.09, hoseL, 8, 1, true)); pFlowG.translate(0, 0.75 + hoseL / 2, 0);
    const pFlow = new THREE.Mesh(pFlowG, M(new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, opacity: 0.75, depthWrite: false, color: '#e8f8ff', fog: false })));
    pFlow.renderOrder = 7;
    this.nozzle.add(nz, lipM, pHose, pFlow);

    // ---- そそぐ 水の 柱（上が 0、下へ のびる。scale.y で ながさ） ----
    const colG = G(new THREE.CylinderGeometry(0.2, 0.3, 1, 12, 1, true)); colG.translate(0, -0.5, 0);
    // 明るい 水色の かべの 前でも 見える ように、すこし 青く こく（Codex・agy）
    this.column = new THREE.Mesh(colG, M(new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, opacity: 0.95, depthWrite: false, fog: false, color: '#7cc8f0' })));
    // 着水点の しぶき（白い 輪）
    const splG = G(new THREE.RingGeometry(0.25, 0.55, 20)); splG.rotateX(-Math.PI / 2);
    this.splash = new THREE.Mesh(splG, M(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false, fog: false, side: THREE.DoubleSide })));
    this.splash.renderOrder = 9;
    this.column.renderOrder = 8;
    this.root = new THREE.Group();
    this.root.add(this.siphon, this.nozzle, this.column, this.splash);
    this.root.visible = false;
    this.root.traverse((o) => { o.frustumCulled = false; });
    scene.add(this.root);
    this.avoid = { pos: new THREE.Vector3(), r: 2.2, strong: false };
    this.lip = new THREE.Vector3();
  }

  get busy() { return !!this.active; }

  /**
   * はじめる。o.dirtTo（0-1）を わたすと、そそいで いる あいだに にごりを そこまで うすく する。o.onPour は そそぎ はじめに よぶ。
   * おわると 解決する Promise。
   */
  play(o = {}) {
    if (this.active) return this.active.promise;
    const t = this.tank, W = t.W, b = t.bounds;
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    const top = t.waterTop;
    const floor = t.sandHeight(-0.3 * W, 0);
    const low = floor + (top - floor) * DRAIN_TO;
    // いけ：水が ある のは 左がわ（りくちの てまえ）。ホースも バケツも 左の 水の 上
    const waterR = t.land ? t.land.x0 - 0.8 : W / 2 - 1;
    // 左の ゲージ（iPad で 画面の 左 2わり）に かくれない ところ
    const xs = clamp(t.land ? -0.3 * W : 0.3 * W, b.minX + 1.5, waterR - 0.6);   // すう ホース（いけは 左、ふつうは 右）
    const xb = clamp(t.land ? -0.15 * W : -0.17 * W, b.minX + 2, waterR - 1.2);     // そそぐ ところ
    const zs = clamp(-0.9, b.minZ + 0.6, b.maxZ - 0.6), zb = clamp(0.2, b.minZ + 0.6, b.maxZ - 0.6);
    const d0 = t.dirtShown ?? t.water.dirt;
    this.active = { t: 0, promise, resolve, top, low, xs, zs, xb, zb, d0, dirtTo: o.dirtTo, onPour: o.onPour, acc: 0, rip: 0 };
    this.root.visible = true;
    this.siphon.visible = true; this.nozzle.visible = false; this.column.visible = false; this.splash.visible = false;
    t.holdDirt = true;
    return promise;
  }

  update(dt, ctx) {
    const a = this.active;
    if (!a) return;
    this.ctx = ctx;
    a.t += dt;
    const t = this.tank, T = a.t;
    const t1 = WC.in, t2 = t1 + WC.drain, t3 = t2 + WC.swap, t4 = t3 + WC.pour;
    this.tex.offset.y = (this.tex.offset.y + dt * 2.2) % 1;
    // ---- 水位 ----
    let level = a.top;
    if (T < t1) level = a.top;
    else if (T < t2) level = a.top + (a.low - a.top) * ease((T - t1) / WC.drain);
    else if (T < t3) level = a.low;
    else if (T < t4) level = a.low + (a.top - a.low) * ease((T - t3) / WC.pour);
    t.setLevel(level);
    // ---- ホース：上から 入って、すって、ぬける ----
    const intakeY = t.sandHeight(a.xs, a.zs) + 0.35;
    let sy;
    if (T < t1) sy = TANK_H + 1.5 + (intakeY - TANK_H - 1.5) * ease(T / t1);
    else if (T < t2) sy = intakeY;
    else sy = intakeY + (TANK_H + 2 - intakeY) * ease(clamp((T - t2) / WC.swap, 0, 1));
    this.siphon.visible = T < t3;
    this.siphon.position.set(a.xs, sy, a.zs);
    this.siphon.rotation.set(0, 0, 0.18);
    // ---- そそぐ ホース：左上から ななめに 入って、口を 水面の すこし 上に（水が ふえると いっしょに 上がる） ----
    const bIn = clamp((T - t2 - WC.swap * 0.3) / (WC.swap * 0.7), 0, 1), bOut = clamp((T - t4) / WC.out, 0, 1);
    this.nozzle.visible = T >= t2 + WC.swap * 0.3;
    if (this.nozzle.visible && !a.poured) { a.poured = true; try { a.onPour && a.onPour(); } catch (e) { console.error(e); } }
    const mouthY = Math.max(a.low + 1.4, level + 0.9);
    const ny = mouthY + (1 - easeOut(bIn)) * 4 + easeIn(bOut) * 4;
    this.nozzle.position.set(a.xb - (1 - easeOut(bIn)) * 1.5, ny, a.zb);
    this.nozzle.rotation.set(0, 0, 0.42);
    this.lip.copy(this.nozzle.position);
    // ---- 水の 柱：ホースの 口から 水面まで ----
    const pouring = T >= t3 && T < t4 + WC.out * 0.5;
    this.column.visible = pouring;
    this.splash.visible = pouring && T < t4;
    if (pouring) {
      const sp = 1 + 0.25 * Math.sin(T * 26);
      this.splash.position.set(this.lip.x, level + 0.02, a.zb);
      this.splash.scale.set(sp, 1, sp);
      const len = Math.max(0.2, this.lip.y - level + 0.4);
      const thin = T > t4 ? 1 - (T - t4) / (WC.out * 0.5) : Math.min(1, (T - t3) / 0.15);
      this.column.position.set(this.lip.x, this.lip.y, a.zb);
      this.column.scale.set(Math.max(0.05, thin), len, Math.max(0.05, thin));
      // 着水点：あわ と 波もん
      if (T < t4) {
        a.acc += dt * 38;
        while (a.acc >= 1) {
          a.acc -= 1;
          t.spawnBubble(this.lip.x + (Math.random() - 0.5) * 0.9, level - 0.3 - Math.random() * 1.8, a.zb + (Math.random() - 0.5) * 0.9, 0.05 + Math.random() * 0.1);
        }
        a.rip -= dt;
        if (a.rip <= 0) { a.rip = 0.15; t.addRipple(this.lip.x + (Math.random() - 0.5) * 0.4, a.zb); }
      }
    }
    // ---- にごり：そそぐ あいだに うすく ----
    if (a.dirtTo !== undefined && T >= t3) {
      const k = ease(clamp((T - t3) / WC.pour, 0, 1));
      t.dirtShown = a.d0 + (a.dirtTo - a.d0) * k;
      t.applyWater();
      if (t.camDist) t.setFogRange(t.camDist);
    }
    // ---- 魚は ホース・水の 柱から 少し よける ----
    if (T < t2 + WC.swap * 0.5) { this.avoid.pos.set(a.xs, intakeY + 0.9, a.zs); this.avoid.r = 1.8; ctx.avoid = sy < level ? this.avoid : null; }
    else if (pouring) { this.avoid.pos.set(this.lip.x, level - 1.0, a.zb); this.avoid.r = 2.2; ctx.avoid = this.avoid; }
    else ctx.avoid = null;
    // ---- おわりの キラキラ ----
    if (!a.sparkle && T > t4 - 0.1) {
      a.sparkle = true;
      const W = t.W;
      for (let i = 0; i < 7; i++) {
        const sx = -0.4 * W + (t.land ? 0.4 : 0.8) * W * (i / 6), sy2 = a.top - 0.8 - (i % 3) * 1.2;
        this.fx.add('sparkle', (out) => out.set(sx, sy2, 0.6), { delay: i * 0.05, size: 0.5, life: 0.8, vy: 0.3, twinkle: true });
      }
    }
    if (a.t >= WATER_CHANGE_DUR) this.finish();
  }

  /** すぐ おわらせる（とちゅうで 画面を はなれた とき も）。水位は もとに もどす。 */
  finish() {
    const a = this.active;
    if (!a) return;
    this.active = null;
    this.root.visible = false;
    if (this.ctx && this.ctx.avoid === this.avoid) this.ctx.avoid = null;
    this.tank.setLevel(this.tank.waterTop);
    this.tank.holdDirt = false;
    if (a.dirtTo !== undefined) { this.tank.dirtShown = a.dirtTo; this.tank.applyWater(); if (this.tank.camDist) this.tank.setFogRange(this.tank.camDist); }
    a.resolve();
  }

  dispose() {
    this.finish();
    this.scene.remove(this.root);
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.tex.dispose();
  }
}
