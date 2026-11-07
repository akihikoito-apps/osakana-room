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
const LATERAL = 0.75;     // 横向きからこれ以上ずれない（ラジアン）

/** 種と育ち具合から水槽内の全長（ワールド単位）を決める。 */
export function fishLength(spec, stage) {
  const s = clamp(stage | 0, 0, 2);
  if (Array.isArray(spec.sizeCm) && spec.sizeCm[s]) return clamp(0.55 + spec.sizeCm[s] * 0.2, 0.8, 3.4);
  const base = spec.kind === 'shrimp' ? 1.5 : ({ goldfish: 2.0, angelfish: 1.55, betta: 1.55, corydoras: 1.4, albino_corydoras: 1.4 })[spec.id] || 1.45;
  return base * [0.62, 0.82, 1.0][s];
}

export class FishAgent {
  constructor(info, spec, bounds) {
    this.uid = info.uid;
    this.spec = spec;
    this.isShrimp = spec.kind === 'shrimp';
    this.layer = spec.swim?.layer || 'any';
    this.speedMul = spec.swim?.speed ?? 1;
    this.school = !!spec.swim?.school;
    this.heightRatio = 0.3;
    this.setInfo(info);
    this.len = this.targetLen;
    this.pos = new THREE.Vector3(rand(bounds.minX + 1, bounds.maxX - 1), 0, rand(bounds.minZ + 0.5, bounds.maxZ - 0.5));
    this.pos.y = this.isShrimp ? bounds.sandY(this.pos.x, this.pos.z) : rand(...this.yRange(bounds));
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
    if (this.weak) { fa = 0.0; fb = 0.14; }
    else if (this.layer === 'bottom') fb = 0.12;
    return [lo + (hi - lo) * fa, Math.max(lo + 0.1, lo + (hi - lo) * fb)];
  }

  pickTarget(b, first = false) {
    const mx = this.len * 0.7 + 0.4;
    const x = rand(b.minX + mx, b.maxX - mx);
    const z = rand(b.minZ + 0.4, b.maxZ - 0.3);
    if (this.isShrimp) {
      // 近くを少しずつ歩く
      const nx = clamp(this.pos.x + rand(-2.5, 2.5), b.minX + mx, b.maxX - mx);
      const nz = clamp(this.pos.z + rand(-1.2, 1.2), b.minZ + 0.3, b.maxZ - 0.3);
      this.target.set(nx, b.sandY(nx, nz), nz);
      this.retarget = rand(4, 8);
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
    this.food = null;
  }

  update(dt, ctx) {
    const b = ctx.bounds;
    this.len += (this.targetLen - this.len) * Math.min(1, dt * 1.5);
    const r = this.react;
    let speedScale = 1, ampScale = 1, holdStill = false;
    if (r) {
      r.t += dt;
      if (r.t >= r.dur) { this.react = null; this.oy = this.oz = this.oyaw = this.opitch = 0; this.sx = 1; this.faceYaw = null; }
      else ({ speedScale, ampScale, holdStill } = this.animateReact(r, dt, b));
    }
    // 元気・ごきげん
    const hf = this.health < 35 ? 0.4 : this.health < 60 ? 0.75 : 1;
    const targetDull = clamp((62 - this.health) / 62, 0, 1) * 0.85;
    this.dull += (targetDull - this.dull) * Math.min(1, dt);
    this.flash = Math.max(0, this.flash - dt * 1.8);

    if (this.isShrimp) { this.updateShrimp(dt, ctx, hf * speedScale, holdStill); return; }

    // ---- 目標と行き先 ----
    this.retarget -= dt;
    this.burstT -= dt;
    if (this.burstT <= 0) { this.burst = rand(0.3, 0.6); this.burstT = rand(1.8, 4.5) / Math.max(0.5, this.speedMul); }
    this.burst = Math.max(0, this.burst - dt);

    // 餌さがし
    if (!r || (r.type !== 'jump' && r.type !== 'spin' && r.type !== 'thanks' && r.type !== 'sleepy')) this.seekFood(ctx);
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
    if (!this.food) {
      if (this.pauseT > 0) this.pauseT -= dt;
      else if (dist < 0.7 || this.retarget <= 0) {
        const pauseP = this.weak ? 0.65 : this.layer === 'bottom' ? 0.45 : 0.28;
        if (Math.random() < pauseP) this.pauseT = this.weak ? rand(4, 9) : rand(1.2, 3.8);
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
    // 先読みの壁よけ
    const dirX = Math.cos(this.yaw), dirZ = -Math.sin(this.yaw);
    const ahead = this.len * 0.6 + 1.0;
    const ax = this.pos.x + dirX * ahead, az = this.pos.z + dirZ * ahead;
    if (ax < b.minX + 0.3) desired.x += 2.5; else if (ax > b.maxX - 0.3) desired.x -= 2.5;
    if (az < b.minZ) desired.z += 1.5; else if (az > b.maxZ) desired.z -= 1.5;
    const [wlo, whi] = this.food ? [b.sandY(this.pos.x, this.pos.z) + 0.2, b.top - 0.2] : this.yRange(b);
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
    const maxTurn = (Math.abs(diff) > 1.2 ? 2.2 : 1.3) * (0.6 + 0.4 * hf) * (this.faceYaw !== null ? 2 : 1);
    const wantRate = clamp(diff * 2.2, -maxTurn, maxTurn);
    this.yawRate += (wantRate - this.yawRate) * Math.min(1, dt * 5);
    this.yaw = wrap(this.yaw + this.yawRate * dt);

    const horiz = Math.hypot(desired.x, desired.z);
    const pMax = 0.42 * clamp((this.spec.look?.lengthToHeight ?? 3) / 3, 0.4, 1);  // 体の高い魚はあまり傾けない
    let dPitch = clamp(Math.atan2(desired.y, Math.max(0.2, horiz)), -pMax, pMax);
    if (this.pauseT > 0 && !this.food) dPitch = 0;
    this.pitch += (dPitch - this.pitch) * Math.min(1, dt * 2.5);

    // ---- 速さ ----
    let cruise = (0.65 + this.len * 0.35) * this.speedMul * hf;
    if (this.food) cruise *= this.weak ? 1.1 : 1.8;
    else if (this.pauseT > 0) cruise *= 0.06;
    else if (dist < 1.5) cruise *= 0.45 + 0.55 * (dist / 1.5);
    if (this.burst > 0 && this.pauseT <= 0) cruise *= 1.55;
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
    if (!holdStill) this.pos.y += clamp(toT.y, -1, 1) * (this.weak ? 0.35 : 0.2) * dt;
    this.clampToTank(b);

    // くねり
    const freq = 2.2 + this.speed * 3.2 + (this.burst > 0 ? 2.5 : 0);
    this.wave += freq * dt * ampScale * (r && r.type === 'happy' ? 2 : 1);
    const ampT = (0.035 + Math.min(0.06, this.speed * 0.035)) * (this.weak ? 0.6 : 1) * ampScale;
    this.amp += (ampT - this.amp) * Math.min(1, dt * 3);

    this.checkEat(ctx);
  }

  updateShrimp(dt, ctx, sp, holdStill) {
    const b = ctx.bounds;
    this.retarget -= dt;
    this.seekFood(ctx);
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
      this.checkEat(ctx);
      return;
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
      const want = (Math.abs(diff) > 0.6 ? 0.08 : 0.35) * this.speedMul * sp * (this.food ? 1.8 : 1) * (holdStill ? 0 : 1);
      this.speed += (want - this.speed) * Math.min(1, dt * 3);
      this.pos.x += Math.cos(this.yaw) * this.speed * dt;
      this.pos.z += -Math.sin(this.yaw) * this.speed * dt;
      this.pitch *= 0.9;
    }
    this.pos.y = b.sandY(this.pos.x, this.pos.z) + this.len * 0.02;
    this.amp = 0.012;
    this.wave += dt * (2 + this.speed * 8);
    this.clampToTank(b, true);
    this.checkEat(ctx);
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
    this.pos.z = clamp(this.pos.z, b.minZ, b.maxZ);
    if (!onSand) {
      const lo = b.sandY(this.pos.x, this.pos.z) + this.bodyH * 0.55 + 0.1;
      this.pos.y = clamp(this.pos.y, lo, b.top - 0.25 - this.bodyH * 0.5);
    }
  }

  seekFood(ctx) {
    if (this.food && !this.food.alive) this.food = null;
    if (this.food) return;
    let best = null, bd = this.isShrimp ? 25 : 60;
    for (const f of ctx.foods) {
      if (!f.alive) continue;
      if (this.isShrimp && !f.landed) continue;
      if (this.layer === 'bottom' && !this.weak && f.pos.y > ctx.bounds.top - 1.5 && !f.landed && f.age < 2.5) continue;
      const d2 = this.pos.distanceToSquared(f.pos) * (f.claims > 2 ? 2 : 1);
      if (d2 < bd) { bd = d2; best = f; }
    }
    if (best) { this.food = best; best.claims++; this.pauseT = 0; }
  }

  mouth(out) {
    const cp = Math.cos(this.pitch);
    const k = this.len * 0.46;
    return out.set(this.pos.x + Math.cos(this.yaw) * cp * k, this.pos.y + Math.sin(this.pitch) * k, this.pos.z - Math.sin(this.yaw) * cp * k);
  }

  checkEat(ctx) {
    if (!this.food || !this.food.alive) return;
    const m = this.mouth(_v4);
    const reach = 0.22 + this.len * 0.14;
    if (m.distanceToSquared(this.food.pos) < reach * reach) {
      this.food.alive = false;
      this.food = null;
      this.sx = 0.86; this.flash = 0.5;
      ctx.onEat(this);
    }
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
        this.opitch = -0.22 * Math.sin(Math.min(1, k * 3) * Math.PI * 0.5) * (k > 0.85 ? (1 - k) / 0.15 : 1) * this.facing();
        speedScale = 0.35; ampScale = 0.5;
        break;
      case 'sleepy':
        this.oy = -0.3 * Math.sin(Math.min(1, k * 2) * Math.PI * 0.5) * (k > 0.85 ? (1 - k) / 0.15 : 1);
        speedScale = 0.15; ampScale = 0.3;
        break;
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

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
