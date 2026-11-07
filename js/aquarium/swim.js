// 泳ぎ方とリアクションの動き（見た目のメッシュは index.js が持つ）。
// 方針：目標点へ向かう wander ＋ 先読みの壁よけ ＋ ゆるい群れ ＋ ときどき停止。
// 向きは横向き（±43°）を基本にして、板っぽく見える真正面・真後ろ向きは旋回の途中だけにする。
import * as THREE from '../../vendor/three.module.min.js';

const TAU = Math.PI * 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);
const ease = (t) => t * t * (3 - 2 * t);
const backOut = (t) => { const s = 1.70158; t -= 1; return t * t * ((s + 1) * t + s) + 1; };

const LAYERS = { top: [0.66, 1.0], middle: [0.3, 0.72], bottom: [0.0, 0.16], any: [0.05, 0.95] };
const LATERAL = 0.75;
const SNAIL_GLASS_MAX = 1.6;   // 貝がガラスを上る高さの上限（底の近くだけ。高いと浮いて見える）     // 横向きからこれ以上ずれない（ラジアン）

/** 種と育ち具合から水槽内の全長（ワールド単位）を決める。 */
export function fishLength(spec, stage) {
  const s = clamp(stage | 0, 0, 2);
  if (Array.isArray(spec.sizeCm) && spec.sizeCm[s]) return clamp(0.55 + spec.sizeCm[s] * 0.2, 0.8, 3.4);
  const base = spec.kind === 'shrimp' ? 1.5 : spec.kind === 'snail' ? 0.95 : ({ goldfish: 2.0, angelfish: 1.55, betta: 1.55, corydoras: 1.4, albino_corydoras: 1.4, blue_tang: 1.9, yellow_tang: 1.7, mandarin: 1.3, otocinclus: 1.1 })[spec.id] || 1.45;
  return base * [0.62, 0.82, 1.0][s];
}

export class FishAgent {
  constructor(info, spec, bounds) {
    this.uid = info.uid;
    this.spec = spec;
    this.isShrimp = spec.kind === 'shrimp';
    this.isSnail = spec.kind === 'snail';
    this.onFloor = this.isShrimp || this.isSnail;   // 底を歩く・這う
    this.habit = spec.swim?.habit || (this.isSnail ? 'crawl' : null);
    this.surf = 'ground';   // 貝：'ground'（砂・石の上）か 'glass'（奥のガラス）
    this.cling = null; this.clingCool = rand(3, 8);
    this.layer = spec.swim?.layer || 'any';
    this.speedMul = spec.swim?.speed ?? 1;
    this.school = !!spec.swim?.school;
    this.heightRatio = 0.3;
    this.setInfo(info);
    this.len = this.targetLen;
    this.pos = new THREE.Vector3(rand(bounds.minX + 1, bounds.maxX - 1), 0, rand(bounds.minZ + 0.5, bounds.maxZ - 0.5));
    this.pos.y = this.onFloor ? (bounds.groundY || bounds.sandY)(this.pos.x, this.pos.z) : rand(...this.yRange(bounds));
    this.yaw = Math.random() < 0.5 ? rand(-0.4, 0.4) : Math.PI + rand(-0.4, 0.4);
    this.yawRate = 0;
    this.pitch = 0;
    this.speed = 0.3;
    this.target = new THREE.Vector3();
    this.offset = new THREE.Vector3(rand(-1.4, 1.4), rand(-0.6, 0.6), rand(-1.0, 1.0));
    this.retarget = 0;
    this.pauseT = 0;
    this.burstT = rand(1, 3);
    this.burst = 0;
    this.wave = Math.random() * TAU;
    this.amp = 0.06;
    this.food = null;
    this.react = null;
    this.hop = null;
    // 描画用の上乗せ（シミュレーションの位置は変えない）
    this.oy = 0; this.oz = 0; this.oyaw = 0; this.opitch = 0; this.sx = 1; this.flash = 0;
    this.faceYaw = null;
    this.dull = 0;
    // 貝は ときどき はじめから奥のガラスにいる
    if (this.isSnail && bounds.glassZ !== undefined && Math.random() < 0.35) {
      this.surf = 'glass';
      this.pos.z = bounds.glassZ + this.len * 0.1;
      this.pos.y = bounds.sandY(this.pos.x, this.pos.z) + rand(0.3, SNAIL_GLASS_MAX - 0.3);
      this.yaw = Math.random() < 0.5 ? 0 : Math.PI;
    }
    this.pickTarget(bounds, true);
  }

  setInfo(info) {
    this.stage = info.stage ?? 1;
    this.health = clamp(info.health ?? 100, 0, 100);
    this.happy = clamp(info.happy ?? 60, 0, 100);
    this.targetLen = fishLength(this.spec, this.stage);
    const weak = this.health < 35;
    if (this.wasWeak !== undefined && weak !== this.wasWeak) { this.retarget = 0; this.pauseT = 0; }
    this.wasWeak = weak;
  }

  get weak() { return this.health < 35; }
  get bodyH() { return this.len * this.heightRatio; }

  yRange(b, x = this.pos?.x ?? 0, z = this.pos?.z ?? 0) {
    const lo = b.sandY(x, z) + Math.max(0.35, this.bodyH * 0.7);
    const hi = b.top - 0.3 - this.bodyH * 0.6;
    let [fa, fb] = LAYERS[this.layer] || LAYERS.any;
    if (this.weak) { fa = 0.1; fb = 0.32; }
    else if (this.habit === 'hover') { fa = 0.04; fb = 0.24; }
    else if (this.layer === 'bottom') fb = 0.12;
    return [lo + (hi - lo) * fa, Math.max(lo + 0.1, lo + (hi - lo) * fb)];
  }

  pickTarget(b, first = false) {
    const mx = this.len * 0.7 + 0.4;
    const x = rand(b.minX + mx, b.maxX - mx);
    const z = rand(b.minZ + 0.4, b.maxZ - 0.3);
    if (this.isSnail) { this.pickSnailTarget(b); return; }
    if (this.isShrimp) {
      // 近くを少しずつ歩く
      const nx = clamp(this.pos.x + rand(-2.5, 2.5), b.minX + mx, b.maxX - mx);
      const nz = clamp(this.pos.z + rand(-1.2, 1.2), b.minZ + 0.3, b.maxZ - 0.3);
      this.target.set(nx, b.sandY(nx, nz), nz);
      this.retarget = rand(4, 8);
      return;
    }
    // 元気がない・ねむいときは、石や水草のそばで休む
    if ((this.weak || this.wantRest) && b.restSpots && b.restSpots.length) {
      let best = b.restSpots[0], bd = Infinity;
      for (const s of b.restSpots) { const d = (s.x - this.pos.x) ** 2 + (s.z - this.pos.z) ** 2 + Math.random() * 4; if (d < bd) { bd = d; best = s; } }
      const [lo2, hi2] = this.yRange(b, best.x, best.z);
      this.target.set(clamp(best.x + rand(-0.8, 0.8), b.minX + mx, b.maxX - mx), clamp(best.y + rand(-0.3, 0.3), lo2, Math.max(lo2, hi2)), clamp(best.z + rand(-0.3, 0.3), b.minZ, b.maxZ));
      this.retarget = rand(8, 14);
      this.wantRest = false;
      return;
    }
    // クマノミなど：サンゴ・ライブロックの近くにいる
    if (this.habit === 'coral' && b.coralSpots && b.coralSpots.length && Math.random() < 0.8) {
      const sp = b.coralSpots[Math.floor(Math.random() * b.coralSpots.length)];
      const [lo3, hi3] = this.yRange(b, sp.x, sp.z);
      this.target.set(clamp(sp.x + rand(-1.3, 1.3), b.minX + mx, b.maxX - mx), clamp(sp.y + rand(-0.4, 0.9), lo3, Math.max(lo3, b.top - 1)), clamp(sp.z + rand(-0.4, 0.9), b.minZ, b.maxZ));
      this.retarget = rand(3, 7);
      return;
    }
    let [ylo, yhi] = this.yRange(b, x, z);
    // コリドラスはときどき水面まで息つぎに行く
    if (this.layer === 'bottom' && !this.weak && !first && Math.random() < 0.06) { ylo = b.top - 1.2; yhi = b.top - 0.6; }
    this.target.set(x, rand(ylo, yhi), z);
    this.retarget = rand(5, 11);
    if (Math.random() < 0.4) this.offset.set(rand(-1.4, 1.4), rand(-0.6, 0.6), rand(-1.0, 1.0));
  }

  /** リアクションを始める。 */
  startReact(type) {
    const dur = { heart: 1.2, happy: 1.8, jump: 1.25, spin: 1.15, thanks: 2.6, sad: 2.6, sleepy: 4.2 }[type] || 1.2;
    const prevFace = Math.cos(this.yaw) >= 0 ? 1 : -1;
    this.react = { type, t: 0, dur, dir: prevFace, startYaw: this.yaw };
    if (type !== 'heart' && type !== 'happy') this.food = null;
    if (type === 'sleepy') { this.wantRest = true; this.retarget = 0; }
  }

  update(dt, ctx) {
    const b = ctx.bounds;
    const want = Math.max(this.targetLen, ctx.minLen || 0);   // 画面で小さくなりすぎないよう下限
    this.len += (want - this.len) * Math.min(1, dt * 1.5);
    const r = this.react;
    let speedScale = 1, ampScale = 1, holdStill = false;
    if (r) {
      r.t += dt;
      if (r.t >= r.dur) { this.react = null; this.oy = this.oz = this.oyaw = this.opitch = 0; this.sx = 1; this.faceYaw = null; }
      else ({ speedScale, ampScale, holdStill } = this.animateReact(r, dt, b));
    }
    // 元気・ごきげん
    const hf = this.health < 35 ? 0.4 : this.health < 60 ? 0.75 : 1;
    const targetDull = clamp((62 - this.health) / 62, 0, 1) * 0.15;   // くすみは少しだけ
    this.dull += (targetDull - this.dull) * Math.min(1, dt);
    this.flash = Math.max(0, this.flash - dt * 1.8);

    if (this.isSnail) { this.updateSnail(dt, ctx, holdStill); return; }
    if (this.isShrimp) { this.updateShrimp(dt, ctx, hf * speedScale, holdStill); return; }
    if (this.habit === 'cling' && this.updateCling(dt, ctx, r)) return;

    // ---- 目標と行き先 ----
    this.retarget -= dt;
    this.burstT -= dt;
    if (this.burstT <= 0) { this.burst = rand(0.3, 0.6); this.burstT = rand(1.8, 4.5) / Math.max(0.5, this.speedMul); }
    this.burst = Math.max(0, this.burst - dt);

    // 餌さがし
    if (!r || (r.type !== 'jump' && r.type !== 'spin' && r.type !== 'thanks')) this.seekFood(ctx, dt);
    let tgt;
    if (this.food) tgt = this.food.pos;
    else if (this.school && !this.weak && ctx.schools[this.spec.id] && ctx.schools[this.spec.id].count > 1) {
      tgt = _v1.copy(ctx.schools[this.spec.id].target).add(this.offset);
      const [ylo, yhi] = this.yRange(b, tgt.x, tgt.z);
      tgt.y = clamp(tgt.y, ylo, yhi);
      tgt.x = clamp(tgt.x, b.minX + this.len, b.maxX - this.len);
      tgt.z = clamp(tgt.z, b.minZ + 0.3, b.maxZ - 0.3);
    } else tgt = this.target;

    const toT = _v2.subVectors(tgt, this.pos);
    const dist = toT.length();
    if (!this.food && !this.clingGo) {
      if (this.pauseT > 0) this.pauseT -= dt;
      else if (dist < 0.7 || this.retarget <= 0) {
        const pauseP = this.weak ? 0.65 : this.habit === 'hover' ? 0.7 : this.layer === 'bottom' ? 0.45 : 0.28;
        if (Math.random() < pauseP) this.pauseT = this.weak ? rand(4, 9) : this.habit === 'hover' ? rand(1.5, 4) : rand(1.2, 3.8);
        if (!this.school) this.pickTarget(b); else { this.retarget = rand(3, 6); this.offset.set(rand(-1.4, 1.4), rand(-0.6, 0.6), rand(-1.0, 1.0)); }
      }
    }
    const desired = _v3.copy(toT).normalize();
    // 群れ：はなれる・まとまる
    for (const o of ctx.fishes) {
      if (o === this) continue;
      const dx = this.pos.x - o.pos.x, dy = this.pos.y - o.pos.y, dz = this.pos.z - o.pos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const rr = (this.len + o.len) * 0.55;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2), k = (1 - d / rr) * 1.6;
        desired.x += (dx / d) * k; desired.y += (dy / d) * k * 0.6; desired.z += (dz / d) * k;
      }
    }
    // そうじの網から少しよける
    if (ctx.avoid) {
      const a = ctx.avoid, dx = this.pos.x - a.pos.x, dy = this.pos.y - a.pos.y, dz = this.pos.z - a.pos.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < a.r && d > 1e-4) {
        const k = (1 - d / a.r) * (a.strong ? 6 : 3);
        desired.x += dx / d * k; desired.y += Math.max(dy / d, 0.3) * k * 0.9; desired.z += dz / d * k * 0.5;   // 上と横へ大きくよける
        this.pauseT = 0; this.food = null;
      }
    }
    // 先読みの壁よけ
    const dirX = Math.cos(this.yaw), dirZ = -Math.sin(this.yaw);
    const ahead = this.len * 0.6 + 1.0;
    const ax = this.pos.x + dirX * ahead, az = this.pos.z + dirZ * ahead;
    if (ax < b.minX + 0.3) desired.x += 2.5; else if (ax > b.maxX - 0.3) desired.x -= 2.5;
    if (az < b.minZ) desired.z += 1.5; else if (az > b.maxZ) desired.z -= 1.5;
    const [wlo, whi] = this.food || this.clingGo ? [b.sandY(this.pos.x, this.pos.z) + 0.2, b.top - 0.2] : this.yRange(b);
    if (this.pos.y < wlo) desired.y += 0.8; else if (this.pos.y > whi) desired.y -= 0.8;

    // ---- 向き ----
    let dYaw = Math.atan2(-desired.z, desired.x);
    const base = Math.cos(dYaw) >= 0 ? 0 : Math.PI;
    const lat = this.food ? 1.05 : LATERAL;
    dYaw = base + clamp(wrap(dYaw - base), -lat, lat);
    if (this.pauseT > 0 && !this.food) dYaw = this.yaw;
    if (this.faceYaw !== null) dYaw = this.faceYaw;
    let diff = wrap(dYaw - this.yaw);
    if (Math.abs(diff) > 2.4 && this.faceYaw === null) {
      // 反転：基本はこちら（カメラ側）を向きながら回る。前のガラスに近いときは奥側で回る
      const viaFront = this.pos.z < b.maxZ - 1.2;
      const towardFront = wrap(-Math.PI / 2 - this.yaw); // カメラ向き（+z）への差
      const sgn = viaFront ? Math.sign(towardFront) : -Math.sign(towardFront);
      if (sgn !== 0 && Math.sign(diff) !== sgn) diff -= Math.sign(diff) * TAU;
    }
    const maxTurn = (Math.abs(diff) > 1.2 ? 2.9 : 1.3) * (0.6 + 0.4 * hf) * (this.faceYaw !== null ? 2 : 1);
    const wantRate = clamp(diff * 2.2, -maxTurn, maxTurn);
    this.yawRate += (wantRate - this.yawRate) * Math.min(1, dt * 5);
    this.yaw = wrap(this.yaw + this.yawRate * dt);

    const horiz = Math.hypot(desired.x, desired.z);
    const pMax = 0.42 * clamp((this.spec.look?.lengthToHeight ?? 3) / 3, 0.4, 1);  // 体の高い魚はあまり傾けない
    let dPitch = clamp(Math.atan2(desired.y, Math.max(0.2, horiz)), -pMax, pMax);
    if ((this.pauseT > 0 && !this.food) || (r && r.type === 'sleepy')) dPitch = 0;   // 休む・ねむいときは水平のまま
    this.pitch += (dPitch - this.pitch) * Math.min(1, dt * 2.5);

    // ---- 速さ ----
    let cruise = (0.65 + this.len * 0.35) * Math.max(this.speedMul, this.food ? 0.8 : 0) * (this.food ? Math.max(hf, 0.8) : hf);   // えさのときは 元気がなくても急ぐ
    if (this.food) cruise *= this.weak ? 2.0 : 1.8;   // 元気がなくても えさには来る
    else if (this.pauseT > 0) cruise *= 0.06;
    else if (dist < 1.5) cruise *= 0.45 + 0.55 * (dist / 1.5);
    if (this.burst > 0 && this.pauseT <= 0) cruise *= 1.55;
    if (this.habit === 'hover' && !this.food) cruise *= 0.75;
    if (ctx.avoid && this.pos.distanceTo(ctx.avoid.pos) < ctx.avoid.r) cruise = Math.max(cruise, 1.3);
    if (Math.abs(diff) > 1.4) cruise *= 0.55;
    cruise *= speedScale;
    if (holdStill) cruise = 0;
    const acc = cruise > this.speed ? 2.2 : 0.9;   // 加速は速く、減速は惰性で
    this.speed += (cruise - this.speed) * Math.min(1, dt * acc);

    const cp = Math.cos(this.pitch);
    this.pos.x += Math.cos(this.yaw) * cp * this.speed * dt;
    this.pos.z += -Math.sin(this.yaw) * cp * this.speed * dt;
    this.pos.y += Math.sin(this.pitch) * this.speed * dt;
    // ひれで上下に少しずつ調整（体を大きく傾けずに高さを変える）
    if (!holdStill) this.pos.y += clamp(toT.y, -1, 1) * (this.food ? 0.9 : this.weak ? 0.35 : 0.2) * dt;
    this.clampToTank(b);

    // くねり
    const freq = 2.2 + this.speed * 3.2 + (this.burst > 0 ? 2.5 : 0);
    this.wave += freq * dt * ampScale * (r && r.type === 'happy' ? 2 : 1);
    const ampT = Math.max(0.03, (0.035 + Math.min(0.06, this.speed * 0.035)) * (this.weak ? 0.85 : 1) * ampScale);   // 休んでいてもひれは動かす
    this.amp += (ampT - this.amp) * Math.min(1, dt * 3);

    this.checkEat(ctx, dt);
  }

  updateShrimp(dt, ctx, sp, holdStill) {
    const b = ctx.bounds;
    this.retarget -= dt;
    this.seekFood(ctx, dt);
    const tgt = this.food ? this.food.pos : this.target;
    const sandY = b.sandY(this.pos.x, this.pos.z);
    if (this.hop) {
      const h = this.hop; h.t += dt;
      const k = Math.min(1, h.t / h.dur);
      this.pos.x = h.x0 + (h.x1 - h.x0) * ease(k);
      this.pos.z = h.z0 + (h.z1 - h.z0) * ease(k);
      this.pos.y = b.sandY(this.pos.x, this.pos.z) + Math.sin(Math.PI * k) * h.h;
      this.pitch = Math.cos(Math.PI * k) * 0.35;
      this.amp = 0.03;
      this.wave += dt * 14;
      if (k >= 1) { this.hop = null; this.pitch = 0; this.pauseT = rand(0.6, 2); }
      this.clampToTank(b, true);
      this.checkEat(ctx, dt);
      return;
    }
    // 沈んでくる粒が真上の低いところに来たら、ピョンと跳ねて取る
    if (this.food && !this.food.landed) {
      const f = this.food, up = f.pos.y - b.sandY(f.pos.x, f.pos.z);
      const hd = Math.hypot(f.pos.x - this.pos.x, f.pos.z - this.pos.z);
      if (hd < 0.9 && up < 3.4) {
        this.hop = { t: 0, dur: 0.6, x0: this.pos.x, z0: this.pos.z, x1: f.pos.x, z1: f.pos.z, h: clamp(up - 0.6, 0.4, 2.6) };
        return;
      }
    }
    if (this.pauseT > 0 && !this.food) {
      this.pauseT -= dt;
      this.speed = 0;
      this.pitch = Math.sin(ctx.time * 5 + this.wave) * 0.04; // つまつま
      if (this.pauseT <= 0 && Math.random() < (this.weak ? 0.02 : 0.25)) this.startHop(b);
    } else {
      const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (!this.food && (dist < 0.3 || this.retarget <= 0)) {
        this.pauseT = this.weak ? rand(4, 9) : rand(1, 4.5);
        this.pickTarget(b);
      }
      let dYaw = Math.atan2(-dz, dx);
      const base = Math.cos(dYaw) >= 0 ? 0 : Math.PI;
      dYaw = base + clamp(wrap(dYaw - base), -0.9, 0.9);
      if (this.faceYaw !== null) dYaw = this.faceYaw;
      const diff = wrap(dYaw - this.yaw);
      const rate = clamp(diff * 2, -1.6, 1.6);
      this.yawRate += (rate - this.yawRate) * Math.min(1, dt * 4);
      this.yaw = wrap(this.yaw + this.yawRate * dt);
      const want = this.food ? (Math.abs(diff) > 0.9 ? 0.25 : 1.0) * Math.max(0.8, sp) * (holdStill ? 0 : 1)   // えさのときは急いで歩く
        : (Math.abs(diff) > 0.6 ? 0.08 : 0.35) * this.speedMul * sp * (holdStill ? 0 : 1);
      this.speed += (want - this.speed) * Math.min(1, dt * 3);
      this.pos.x += Math.cos(this.yaw) * this.speed * dt;
      this.pos.z += -Math.sin(this.yaw) * this.speed * dt;
      this.pitch *= 0.9;
    }
    this.pos.y = b.sandY(this.pos.x, this.pos.z) + this.len * 0.02;
    this.amp = 0.012;
    this.wave += dt * (2 + this.speed * 8);
    this.clampToTank(b, true);
    this.checkEat(ctx, dt);
    void sandY;
  }

  startHop(b, big = false) {
    const dir = Math.cos(this.yaw) >= 0 ? 1 : -1;
    const dist = big ? rand(0.9, 1.4) : rand(0.5, 1.0);
    const x1 = clamp(this.pos.x + dir * dist, b.minX + this.len, b.maxX - this.len);
    this.hop = { t: 0, dur: big ? 0.75 : 0.5, x0: this.pos.x, z0: this.pos.z, x1, z1: this.pos.z, h: big ? rand(1.0, 1.5) : rand(0.45, 0.8) };
  }

  clampToTank(b, onSand = false) {
    const m = this.len * 0.45;
    this.pos.x = clamp(this.pos.x, b.minX + m, b.maxX - m);
    const zMin = (this.isSnail || this.cling || this.clingGo) && b.glassZ !== undefined ? b.glassZ + this.len * 0.1 : b.minZ;
    this.pos.z = clamp(this.pos.z, zMin, b.maxZ);
    if (!onSand) {
      const lo = b.sandY(this.pos.x, this.pos.z) + this.bodyH * 0.55 + 0.1;
      this.pos.y = clamp(this.pos.y, lo, b.top - 0.25 - this.bodyH * 0.5);
    }
  }

  /** 底の粒を食べにいける魚か（底にすむ魚・エビ）。 */
  get eatsFromBottom() { return this.onFloor || this.layer === 'bottom'; }

  /** この魚が今ねらえる粒か。底に落ちた粒・底すれすれの粒は、底の魚とエビだけ。 */
  canTake(f, b) {
    if (!f.alive || f.age < 0) return false;
    if (this.skipFood && this.skipFood.has(f)) return false;
    const nearBottom = f.landed || f.pos.y < b.sandY(f.pos.x, f.pos.z) + 0.6;
    if (this.isShrimp) return true;   // エビは粒の真下まで歩き、低くなったら跳ねて取る
    if (this.isSnail) return f.landed;  // 貝は底に落ちた粒だけ
    if (nearBottom && !this.eatsFromBottom) return false;
    return true;
  }

  seekFood(ctx, dt = 0) {
    const b = ctx.bounds;
    if (this.food && !this.canTake(this.food, b)) this.food = null;
    if (this.food) {
      this.chaseT += dt;
      // 追いかけても届かないときはあきらめて、ほかの粒へ
      // 貝はゆっくりなので 長く追う
      if (this.chaseT > (this.isSnail ? 120 : this.isShrimp ? 15 : 7)) { (this.skipFood ||= new WeakSet()).add(this.food); this.food = null; }
      // ときどき見なおして、新しい粒・近い粒があればそちらへ
      this.foodCheck = (this.foodCheck || 0) - dt;
      if (this.food && this.foodCheck > 0) return;
      this.foodCheck = 0.8;
    }
    let best = null, bs = Infinity;
    for (const f of ctx.foods) {
      if (!this.canTake(f, b)) continue;
      // 近いほど・新しいほど（まだ沈んでいる粒ほど）ねらう。ほかの魚がたくさん追っている粒は少し後回し
      const sc = this.pos.distanceToSquared(f.pos) + f.age * 1.5 + (f.claims > 2 ? 6 : 0) + (f.landed ? 4 : 0);
      if (sc < bs) { bs = sc; best = f; }
    }
    if (best && best !== this.food) {
      if (this.food) this.food.claims = Math.max(0, this.food.claims - 1);
      this.food = best; best.claims++; this.pauseT = 0; this.chaseT = 0;
    }
  }

  mouth(out) {
    const cp = Math.cos(this.pitch);
    const k = this.len * 0.46;
    return out.set(this.pos.x + Math.cos(this.yaw) * cp * k, this.pos.y + Math.sin(this.pitch) * k, this.pos.z - Math.sin(this.yaw) * cp * k);
  }

  checkEat(ctx, dt = 1 / 60) {
    if (!this.food || !this.food.alive) return;
    const m = this.mouth(_v4);
    const f = this.food;
    const d = Math.sqrt(m.distanceToSquared(f.pos));
    // 口の近くまで来たら、粒を吸いこむ（小さい魚でも届くように、体の大きさに合わせた距離で）
    const suck = 0.45 + this.len * 0.55;
    const reach = Math.max(0.18, this.len * 0.16);
    if (d < suck) {
      const step = Math.min(d, (1.2 + this.len) * dt);
      f.pos.addScaledVector(_v5.subVectors(m, f.pos).normalize(), step);
      f.sucked = true;
    }
    if (d < reach) {
      f.alive = false;
      this.food = null;
      this.sx = 0.86; this.flash = 0.5;
      ctx.onEat(this);
    }
  }

  // ---------------- 貝：面に沿ってとてもゆっくり這う ----------------
  pickSnailTarget(b) {
    const mx = this.len + 0.3;
    const gz = (b.glassZ ?? b.minZ) + this.len * 0.1;
    if (this.surf === 'glass') {
      // ガラスの上で少し動く。ときどき下へ降りる
      if (Math.random() < 0.35) this.target.set(clamp(this.pos.x + rand(-1, 1), b.minX + mx, b.maxX - mx), -1, gz);   // -1 = 底まで降りる
      else this.target.set(clamp(this.pos.x + rand(-2, 2), b.minX + mx, b.maxX - mx), clamp(this.pos.y + rand(-0.6, 0.6), b.groundY(this.pos.x, gz) + 0.3, b.groundY(this.pos.x, gz) + SNAIL_GLASS_MAX), gz);
    } else if (Math.random() < 0.45) {
      // 奥のガラスへ向かう
      this.target.set(clamp(this.pos.x + rand(-2, 2), b.minX + mx, b.maxX - mx), 0, gz);
      this.toGlass = true;
    } else {
      // 近くの砂・石の上（石があれば石の上をねらうことも）
      let x = clamp(this.pos.x + rand(-2.5, 2.5), b.minX + mx, b.maxX - mx), z = clamp(this.pos.z + rand(-1.2, 1.2), b.minZ, b.maxZ - 0.3);
      if (b.rocks && b.rocks.length && Math.random() < 0.35) { const rk = b.rocks[Math.floor(Math.random() * b.rocks.length)]; x = rk.x + rand(-0.4, 0.4) * rk.rx; z = rk.z + rand(-0.4, 0.4) * rk.rz; }
      this.target.set(x, 0, z);
      this.toGlass = false;
    }
    this.retarget = rand(15, 30);
  }

  updateSnail(dt, ctx, holdStill) {
    const b = ctx.bounds;
    const gY = b.groundY || b.sandY;
    const gz = (b.glassZ ?? b.minZ) + this.len * 0.1;
    this.retarget -= dt;
    this.seekFood(ctx, dt);
    if (this.food && this.surf === 'glass') this.target.set(this.pos.x, -1, gz);   // まず降りる
    const crawl = (this.food ? (this.surf === 'glass' ? 0.25 : 0.16) : 0.075) * (this.weak ? 0.7 : 1) * (holdStill ? 0 : 1);
    // ときどき止まる
    if (this.pauseT > 0 && !this.food) { this.pauseT -= dt; this.speed *= 0.9; }
    else this.speed += (crawl - this.speed) * Math.min(1, dt * 2);
    this.sx = 1 + Math.sin(ctx.time * 2.2 + this.wave) * 0.025 * (this.speed > 0.02 ? 1 : 0.2);   // のびちぢみ
    this.amp = 0;
    if (this.surf === 'glass') {
      const tgtY = this.target.y < 0 ? gY(this.pos.x, gz) - 0.05 : this.target.y;
      const dx = this.target.x - this.pos.x, dy = tgtY - this.pos.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.15) {
        if (this.target.y < 0) { this.surf = 'ground'; this.pitch = 0; this.pauseT = rand(2, 5); this.pickSnailTarget(b); }
        else { this.pauseT = rand(3, 10); this.pickSnailTarget(b); }
      } else {
        // ガラスの上では 横向きのまま、ななめに上り下り（±25°まで）
        const face = dx >= 0 ? 0 : Math.PI;
        this.yaw += wrap(face - this.yaw) * Math.min(1, dt * 1.5);
        const want = clamp(Math.atan2(dy, Math.abs(dx) + 0.3), -0.45, 0.45);
        this.pitch += (want - this.pitch) * Math.min(1, dt * 1.2);
        const k = this.speed * dt / d;
        this.pos.x += dx * Math.min(1, k * 1.2);
        this.pos.y += dy * Math.min(1, k);
        this.pos.z += (gz - this.pos.z) * Math.min(1, dt * 2);
      }
      this.pos.y = Math.max(this.pos.y, gY(this.pos.x, gz) - 0.05);
    } else {
      const dx = (this.food ? this.food.pos.x : this.target.x) - this.pos.x;
      const dz = (this.food ? this.food.pos.z : this.target.z) - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (!this.food && (d < 0.15 || this.retarget <= 0)) {
        if (this.toGlass && this.pos.z <= gz + 0.2) { this.surf = 'glass'; this.toGlass = false; this.pickSnailTarget(b); this.target.y = this.pos.y + rand(0.5, SNAIL_GLASS_MAX - 0.2); }
        else { this.pauseT = this.weak ? rand(8, 15) : rand(3, 10); this.pickSnailTarget(b); }
      }
      let dYaw = Math.atan2(-dz, dx);
      const base = Math.cos(dYaw) >= 0 ? 0 : Math.PI;
      dYaw = base + clamp(wrap(dYaw - base), -0.9, 0.9);
      this.yaw += clamp(wrap(dYaw - this.yaw), -0.6 * dt, 0.6 * dt);
      const step = this.speed * dt;
      this.pos.x += Math.cos(this.yaw) * step;
      this.pos.z += -Math.sin(this.yaw) * step;
      if (d < 0.6) { this.pos.x += dx * Math.min(1, step / Math.max(d, 1e-3)) * 0.5; this.pos.z += dz * Math.min(1, step / Math.max(d, 1e-3)) * 0.5; }
      // 地面（砂・石）にそって高さと傾き
      const y0 = gY(this.pos.x, this.pos.z);
      const fx = Math.cos(this.yaw) * 0.25, fz = -Math.sin(this.yaw) * 0.25;
      const slope = Math.atan2(gY(this.pos.x + fx, this.pos.z + fz) - gY(this.pos.x - fx, this.pos.z - fz), 0.5);
      this.pitch += (clamp(slope, -0.5, 0.5) - this.pitch) * Math.min(1, dt * 2);
      this.pos.y = y0;
    }
    this.clampToTank(b, true);
    this.checkEat(ctx, dt);
  }

  // ---------------- オトシンクルス：ガラスや流木・石にはりつく ----------------
  updateCling(dt, ctx, r) {
    const b = ctx.bounds;
    if (!r || r.type === 'heart' || r.type === 'sad') this.seekFood(ctx, dt);   // はりついていても えさには気づく
    if (this.food || (r && r.type !== 'heart' && r.type !== 'sad')) { this.cling = null; this.clingGo = null; return false; }
    if (ctx.avoid && this.pos.distanceTo(ctx.avoid.pos) < ctx.avoid.r) { this.cling = null; this.clingGo = null; this.clingCool = 3; return false; }
    if (this.cling) {
      const c = this.cling;
      c.t -= dt;
      this.speed *= 0.8;
      this.yaw += wrap(c.yaw - this.yaw) * Math.min(1, dt * 3);
      this.pitch += (c.pitch - this.pitch) * Math.min(1, dt * 3);
      this.pos.lerp(c.pos, Math.min(1, dt * 3));
      // こけを食べているような小さな動き
      this.oy = Math.sin(ctx.time * 9 + this.wave) * 0.012;
      this.wave += dt * 3; this.amp = 0.018;
      if (c.t <= 0) { this.cling = null; this.oy = 0; this.clingCool = rand(4, 10); this.pickTarget(b); }
      return true;
    }
    this.clingCool -= dt;
    if (!this.clingGo && this.clingCool <= 0 && b.clingSpots && b.clingSpots.length) {
      const sp = b.clingSpots[Math.floor(Math.random() * b.clingSpots.length)];
      this.clingGo = sp;
      this.target.set(sp.x, sp.y, sp.z + (sp.glass ? this.len * 0.12 : 0));
      this.retarget = 20;
    }
    if (this.clingGo && this.pos.distanceTo(this.target) < 1.2) {   // 近くまで来たら すっと寄って はりつく
      const sp = this.clingGo; this.clingGo = null;
      const face = Math.cos(this.yaw) >= 0 ? 0 : Math.PI;
      // 横すがたが見えるように。ななめ（±0.5rad）に留まる
      this.cling = { t: rand(5, 14), pos: this.target.clone(), yaw: face, pitch: sp.glass ? rand(-0.5, 0.5) : rand(-0.15, 0.25) };
      return true;
    }
    return false;
  }

  /** リアクションの動き。描画用の上乗せ値を決め、移動の速さ倍率を返す。 */
  animateReact(r, dt, b) {
    const k = r.t / r.dur;
    let speedScale = 1, ampScale = 1, holdStill = false;
    this.sx += (1 - this.sx) * Math.min(1, dt * 6);
    switch (r.type) {
      case 'heart':
        this.oy = Math.sin(Math.min(1, k * 2.2) * Math.PI) * 0.18;
        speedScale = 0.5;
        break;
      case 'happy':
        this.oy = Math.abs(Math.sin(k * Math.PI * 3)) * 0.35 * (1 - k);
        ampScale = 1.6;
        speedScale = 0.6;
        break;
      case 'jump': {
        holdStill = true;
        const room = clamp(b.top - 0.35 - this.pos.y - this.bodyH * 0.5, 0.5, 1.7);
        const prep = 0.14;
        if (k < prep) { const q = k / prep; this.oy = -0.12 * Math.sin(q * Math.PI * 0.5); this.sx = 1 - 0.12 * q; }
        else if (k < 0.82) {
          const q = (k - prep) / (0.82 - prep);
          this.oy = Math.sin(q * Math.PI) * room;
          this.opitch = Math.cos(q * Math.PI) * 0.55 * this.facing();
          this.sx = 1.05;
          ampScale = 2.2;
        } else { this.oy = 0; this.opitch = 0; this.sx = 1; ampScale = 0.3; }  // 決め
        if (this.isShrimp) this.opitch *= 0.4;
        break;
      }
      case 'spin': {
        holdStill = true;
        const prep = 0.12;
        if (k < prep) { this.sx = 1 - 0.12 * (k / prep); this.oyaw = 0; }
        else if (k < 0.85) {
          const q = (k - prep) / (0.85 - prep);
          this.oyaw = backOut(q) * TAU;
          this.oy = Math.sin(q * Math.PI) * 0.35;
          this.sx = 1;
        } else { this.oyaw = 0; this.oy = 0; }
        ampScale = 1.5;
        break;
      }
      case 'thanks': {
        holdStill = true;
        // こちらを斜めに向く（真正面だと板に見えるので 3/4 向き）
        const face = -Math.PI / 2 + (r.dir > 0 ? 0.62 : -0.62);
        if (k < 0.82) this.faceYaw = face; else this.faceYaw = null;
        const t = r.t;
        this.oz = Math.min(1, t / 0.6) * Math.min(0.8, b.maxZ - this.pos.z) * (k < 0.85 ? 1 : (1 - k) / 0.15);
        const n1 = clamp((t - 0.6) / 0.45, 0, 1), n2 = clamp((t - 1.2) / 0.45, 0, 1);
        this.opitch = -0.5 * (Math.sin(n1 * Math.PI) + Math.sin(n2 * Math.PI)) * (this.isShrimp ? 0.5 : 1) * this.facing();
        ampScale = 0.5;
        break;
      }
      case 'sad':
        this.opitch = -0.1 * Math.sin(Math.min(1, k * 3) * Math.PI * 0.5) * (k > 0.85 ? (1 - k) / 0.15 : 1) * this.facing();
        speedScale = 0.35; ampScale = 0.5;
        break;
      case 'sleepy':
        // 水平のまま、ゆっくりひれを動かして休む（沈まない・傾けない）
        this.oy = 0; this.opitch = 0;
        speedScale = 0.3; ampScale = 0.6;
        break;
    }
    if (this.isSnail) {
      // 貝は跳ねたり回ったりしない。ぽよんと はずむ・ゆらゆらするだけ
      this.oz = 0; this.faceYaw = null;
      if (r.type === 'jump' || r.type === 'happy' || r.type === 'heart') { this.oy = Math.abs(Math.sin(k * Math.PI * 3)) * 0.1 * (1 - k); this.sx = 1 + Math.sin(k * Math.PI * 6) * 0.05 * (1 - k); }
      else this.oy = 0;
      this.oyaw = r.type === 'spin' || r.type === 'thanks' ? Math.sin(k * Math.PI * 4) * 0.25 * (1 - k) : 0;
      this.opitch = r.type === 'thanks' ? -0.15 * Math.sin(k * Math.PI * 2) : 0;
      return { speedScale: 0, ampScale: 0, holdStill: true };
    }
    if (this.isShrimp && (r.type === 'jump' || r.type === 'happy') && r.t < dt * 1.5 && !this.hop) this.startHop(b, r.type === 'jump');
    if (this.isShrimp && (r.type === 'jump' || r.type === 'happy')) this.oy = 0;
    return { speedScale, ampScale, holdStill };
  }

  /** 頭が画面の右向きなら 1、左向きなら -1（ピッチの符号合わせ用）。 */
  facing() { return 1; }

  /** 描画用の向き（ヨー）。 */
  renderYaw() { return this.yaw + this.oyaw; }
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3();
