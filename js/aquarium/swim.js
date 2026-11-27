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
const SALT_SCALE = 1.2;
// v0.8 カエルの ぴょん（Codex・agy の 案の まんなか）：1かい 0.56びょう（空中 64%）・高さ 体長×0.38（上限 0.9）・距離 体長×0.8・着地後 0.4〜1.0びょう やすむ
export const HOP = { dur: 0.56, air: 0.64, h: 0.38, hMax: 0.9, dist: 0.8, rest: [0.4, 1.0], tilt: 0.22 };
/**
 * v0.10 カエル・カメの 泳ぎ（swim.limb＝'frog'|'turtle'。水の 中を すすむ ときだけ。りくの ぴょん・あるく は そのまま）。Codex・agy と 相談。
 * - period：1かいの 周期（びょう）の はば。はやく すすむ ほど みじかい。idle：水中で とまって いる ときの 周期と つよさ（カメだけ）。
 * - amp・bend：魚の くねり（uAmp）と まがり（uBend の 倍率）。足の ある 子は 体が くねらない。
 * カエル：p 0〜kick で けり（足が のびる）、hold まで のびて すべる、のこりで たたむ。進む はやさは FROG_SPEED の 波（平均 1）。
 *   のびると 体が stretch だけ ながく・あたまが pitch だけ さがる、たたむと fold だけ ちぢみ foldPitch だけ おきる（agy）。水中で とまると あたまを float 上げて ういて まつ。
 * カメ：θ=2πp。前あしが うしろへ うごく（sinθ>0）ときに すこし はやい（0.9〜1.21）。からだは すこし 上下・かたむく。
 */
export const STROKE = {
  frog:   { period: [0.8, 1.4], kick: 0.17, hold: 0.53, amp: 0.01, bend: 0.25, stretch: 0.03, fold: 0.015, pitch: 0.04, foldPitch: 0.03, float: 0.06, idle: 0, idlePeriod: 0 },
  turtle: { period: [1.5, 2.7], amp: 0.004, bend: 0.05, bob: 0.018, pitch: 0.035, idle: 0.35, idlePeriod: 3.2 },
};
// カエルの はやさの 波（p, 倍率）。なめらかに つないで 平均で わる（Codex：最大 約2.1・最小 約0.44）
const FROG_SPEED = [[0, 0.45], [0.15, 2.2], [0.35, 1.3], [0.65, 0.65], [1, 0.45]];
const FROG_SPEED_MEAN = 1.03375;
/** カエルの 1かいの なかの 足の のび e（0＝たたむ＝絵の まま 〜 1＝のびきる）と はやさの 倍率 f（周期で 平均 1） */
export function frogStroke(p) {
  p = ((p % 1) + 1) % 1;
  const S = STROKE.frog;
  const e = p < S.kick ? ease(p / S.kick) : p < S.hold ? 1 : 1 - ease((p - S.hold) / (1 - S.hold));
  let f = FROG_SPEED[0][1];
  for (let i = 1; i < FROG_SPEED.length; i++) {
    const [p0, f0] = FROG_SPEED[i - 1], [p1, f1] = FROG_SPEED[i];
    if (p <= p1) { f = f0 + (f1 - f0) * ease((p - p0) / (p1 - p0)); break; }
  }
  return { e, f: f / FROG_SPEED_MEAN };
}
/** カメの 1かい：前あしの 前後 c（+1＝いちばん 前）・s（>0 で うしろへ 漕ぐ）と はやさの 倍率 f（周期で 平均 1） */
export function turtleStroke(p) {
  const th = TAU * p, s = Math.sin(th);
  return { c: Math.cos(th), s, f: 0.9 + 0.1 * Math.PI * Math.max(0, s) };
}

const SNAIL_GLASS_MAX = 1.6;   // 貝がガラスを上る高さの上限（底の近くだけ。高いと浮いて見える）     // 横向きからこれ以上ずれない（ラジアン）

/** 種と育ち具合から水槽内の全長（ワールド単位）を決める。 */
export function fishLength(spec, stage) {
  const s = clamp(stage | 0, 0, 2);
  const salt = spec.water === 'salt' && spec.kind === 'fish' ? SALT_SCALE : 1;   // v0.4：うみの さかなは すこし おおきく
  if (Array.isArray(spec.sizeCm) && spec.sizeCm[s]) return clamp((0.55 + spec.sizeCm[s] * 0.2) * salt, 0.8, 3.4 * salt);
  const base = spec.kind === 'shrimp' ? 1.5 : spec.kind === 'snail' ? 0.95 : ({ goldfish: 2.0, angelfish: 1.55, betta: 1.55, corydoras: 1.4, albino_corydoras: 1.4, blue_tang: 1.9, yellow_tang: 1.7, mandarin: 1.3, otocinclus: 1.1 })[spec.id] || 1.45;
  return base * salt * [0.62, 0.82, 1.0][s];
}

export class FishAgent {
  constructor(info, spec, bounds) {
    this.uid = info.uid;
    this.spec = spec;
    this.isShrimp = spec.kind === 'shrimp';
    this.isSnail = spec.kind === 'snail';
    this.onFloor = this.isShrimp || this.isSnail;   // 底を歩く・這う
    this.habit = spec.swim?.habit || (this.isSnail ? 'crawl' : null);
    if (this.habit === 'land') this.onFloor = !!bounds.land || this.isShrimp;   // v0.6 ぼうけん係：カメ・カエル（いけの りくちで やすむ・ときどき みずに 入る）。v0.8 りくの ない ゆめのすいそう では およぐ
    // v0.8 ゆめの いきもの：flat＝ひらたい いた（オリジナル）。hy・hpitch＝カエルの ぴょん（描画だけの 上乗せ）
    this.flat = !!spec.dream?.flat;
    this.hopper = !!spec.swim?.hop;
    this.hy = 0; this.hpitch = 0; this.hopPh = 0; this.hopRest = 0;
    // v0.10 カエル・カメの 泳ぎ：limb＝足の しゅるい、strokePh＝位相、limbAmp＝うごきの つよさ（りく・底では 0）、
    // limbA・limbB＝シェーダーへ（カエル：足の のび・0／カメ：前あしの cos・sin）。sbob・spitch・stretch＝描画だけの 上乗せ（ぴょん・リアクションとは べつ）
    this.limb = spec.swim?.limb === 'frog' || spec.swim?.limb === 'turtle' ? spec.swim.limb : null;
    this.strokePh = Math.random(); this.strokeBase = 0; this.limbAmp = 0; this.limbA = 0; this.limbB = 0;
    this.sbob = 0; this.spitch = 0; this.stretch = 0; this.floatK = 0;
    this.landMode = 'land';
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
    if (this.habit === 'land' && bounds.land) {   // v0.6：はじめは りくちに いる
      const L = bounds.land;
      this.pos.x = rand(L.x1 + 0.4, L.xMax - 0.3);
      this.pos.y = (bounds.groundY || bounds.sandY)(this.pos.x, this.pos.z);
      this.target.copy(this.pos); this.pauseT = rand(1, 4); this.retarget = rand(4, 9);
      return;
    }
    this.pickTarget(bounds, true);
  }

  setInfo(info) {
    this.stage = info.stage ?? 1;
    this.health = clamp(info.health ?? 100, 0, 100);
    this.happy = clamp(info.happy ?? 60, 0, 100);
    // v0.6 個体差（個体差係）：sizeMul＝その子の おおきさ（sim.lookScaleOf。0.75〜1.3）、shiny＝キラキラ
    this.targetLen = fishLength(this.spec, this.stage) * clamp(Number.isFinite(info.sizeMul) ? info.sizeMul : 1, 0.6, 1.4);
    this.shiny = !!info.shiny;
    const weak = this.health < 35;
    if (this.wasWeak !== undefined && weak !== this.wasWeak) { this.retarget = 0; this.pauseT = 0; }
    this.wasWeak = weak;
  }

  /** v0.8 ゆめのすいそうの かたちを かえた とき（りくが できた・なくなった）。めあて・ぴょん・せっちを いったん とく */
  setHasLand(b) {
    if (this.habit === 'land') this.onFloor = !!b.land || this.isShrimp;
    this.hopPh = 0; this.hy = 0; this.hpitch = 0; this.hop = null;
    this.retarget = 0; this.pauseT = 0; this.food = null; this.restAtBottom = false;
    this.target.copy(this.pos);
    if (this.habit === 'land' && b.land) this.pickLandTarget(b);
  }

  get weak() { return this.health < 35; }
  get bodyH() { return this.len * this.heightRatio; }
  /** v0.8 ひらたい いたは 中心が 原点なので、そこを あるく ときは 体の 半分 もちあげる（立体は 体が 砂に すこし しずんで 見えて よい） */
  get footLift() { return this.flat ? this.bodyH * 0.45 : 0; }

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
    this.restAtBottom = false;
    // コリドラスはときどき水面まで息つぎに行く
    if (this.layer === 'bottom' && !this.weak && !first && Math.random() < 0.06) { ylo = b.top - 1.2; yhi = b.top - 0.6; }
    // v0.8 りくの ない ゆめのすいそうの カエル・カメトカゲ：ときどき 底に おりて 2〜5びょう やすむ（Codex）
    else if (this.habit === 'land' && !b.land && !first && Math.random() < 0.35) { const lo = b.sandY(x, z) + Math.max(0.35, this.bodyH * 0.6); ylo = lo; yhi = lo + 0.15; this.restAtBottom = true; }
    this.target.set(x, rand(ylo, yhi), z);
    this.retarget = rand(5, 11);
    if (Math.random() < 0.4) this.offset.set(rand(-1.4, 1.4), rand(-0.6, 0.6), rand(-1.0, 1.0));
  }

  /** リアクションを始める。 */
  startReact(type) {
    const dur = { heart: 1.2, happy: 1.8, jump: 1.25, spin: 1.15, thanks: 2.6, sad: 2.6, sleepy: 4.2, pui: 1.4 }[type] || 1.2;
    const prevFace = Math.cos(this.yaw) >= 0 ? 1 : -1;
    this.react = { type, t: 0, dur, dir: prevFace, startYaw: this.yaw };
    if (type !== 'heart' && type !== 'happy') this.food = null;
    if (type === 'sleepy') { this.wantRest = true; this.retarget = 0; }
  }

  update(dt, ctx) {
    const b = ctx.bounds;
    this.clock = ctx.time;
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

    if (this.habit === 'land' && b.land) { this.updateLand(dt, ctx, hf * speedScale, holdStill); return; }   // v0.6 いけの りくち
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
        if (this.restAtBottom && dist < 0.7) this.pauseT = rand(2, 5);   // v0.8 底で ひとやすみ
        else if (Math.random() < pauseP) this.pauseT = this.weak ? rand(4, 9) : this.habit === 'hover' ? rand(1.5, 4) : rand(1.2, 3.8);
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
    if (this.burst > 0 && this.pauseT <= 0 && !this.limb) cruise *= 1.55;   // v0.10 足で 泳ぐ 子は けり いがいで きゅうに はやく ならない
    if (this.habit === 'hover' && !this.food) cruise *= 0.75;
    if (ctx.avoid && this.pos.distanceTo(ctx.avoid.pos) < ctx.avoid.r) cruise = Math.max(cruise, 1.3);
    if (Math.abs(diff) > 1.4) cruise *= 0.55;
    cruise *= speedScale;
    if (holdStill) cruise = 0;
    const acc = cruise > this.speed ? 2.2 : 0.9;   // 加速は速く、減速は惰性で
    if (this.limb && !(this.restAtBottom && this.pauseT > 0)) this.speed = this.strokeStep(dt, cruise);   // v0.10 カエル・カメ：足で 泳ぐ（底で やすむ ときは 絵の 姿勢）
    else { this.speed += (cruise - this.speed) * Math.min(1, dt * acc); this.relaxLimb(dt); }

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
    const ampT = this.limb ? STROKE[this.limb].amp : Math.max(0.03, (0.035 + Math.min(0.06, this.speed * 0.035)) * (this.weak ? 0.85 : 1) * ampScale);   // 休んでいてもひれは動かす（足で 泳ぐ 子は 体を くねらせない）
    this.amp += (ampT - this.amp) * Math.min(1, dt * 3);

    this.checkEat(ctx, dt);
  }

  /**
   * v0.6 ぼうけん係：swim.habit 'land'（カメ・カエル）。いけの すいそうの りくち（bounds.land）で やすみ、ときどき みずに 入って およぐ。
   * りくちでは 地面を あるき、みずの 中では 底から 水面の あいだを およぐ。さかを とおって のぼりおり する。
   */
  pickLandTarget(b) {
    const L = b.land;
    const m = this.len * 0.6 + 0.3;
    const z = rand(b.minZ + 0.4, b.maxZ - 0.4);
    const onLand = this.pos.x >= L.shore;
    const goLand = onLand ? Math.random() < 0.7 : Math.random() < 0.5;
    if (goLand) {
      const sp = L.spots && L.spots.length && Math.random() < 0.6 ? L.spots[Math.floor(Math.random() * L.spots.length)] : null;
      const x = sp ? sp.x + rand(-0.5, 0.5) : rand(L.x1 + 0.3, L.xMax - m);
      const zz = sp ? clamp(sp.z + rand(-0.5, 0.5), b.minZ + 0.3, b.maxZ - 0.3) : z;
      this.target.set(clamp(x, L.x1 + 0.2, L.xMax - m), 0, zz);
      this.landMode = 'land';
    } else {
      const x = rand(b.minX + m, L.x0 - 0.4);
      const lo = b.sandY(x, z) + 0.4, hi = L.waterTop - 0.5;
      this.target.set(x, rand(lo, Math.max(lo, hi)), z);
      this.landMode = 'water';
    }
    this.retarget = rand(6, 12);
  }

  updateLand(dt, ctx, sp, holdStill) {
    const b = ctx.bounds, L = b.land;
    const groundAt = (x, z) => (b.groundY || b.sandY)(x, z);
    this.retarget -= dt;
    const inWater = this.pos.x < L.shore - 0.05;
    if (inWater) this.seekFood(ctx, dt); else this.food = null;
    const tgt = this.food ? this.food.pos : this.target;
    const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (this.pauseT > 0 && !this.food) {
      this.pauseT -= dt;
      this.speed += (0 - this.speed) * Math.min(1, dt * 4);
      if (this.pauseT <= 0) this.pickLandTarget(b);
    } else if (!this.food && (dist < 0.25 || this.retarget <= 0)) {
      const onLand = this.pos.x >= L.shore;
      this.pauseT = this.weak ? rand(5, 10) : onLand ? rand(3, 8) : rand(0.6, 2);   // りくちでは ゆっくり ひなたぼっこ
    }
    // むき（よこむき を きほんに）
    if (dist > 0.05 && (this.pauseT <= 0 || this.food)) {
      let dYaw = Math.atan2(-dz, dx);
      const base = Math.cos(dYaw) >= 0 ? 0 : Math.PI;
      dYaw = base + clamp(wrap(dYaw - base), -0.9, 0.9);
      if (this.faceYaw !== null) dYaw = this.faceYaw;
      const diff = wrap(dYaw - this.yaw);
      this.yaw = wrap(this.yaw + clamp(diff * 3, -2.4, 2.4) * dt);
    }
    // はやさ：りくちは あるく（おそい）、みずの 中は およぐ
    const swimming = this.pos.x < L.shore - 0.05;
    const dm = this.spec.dream?.mul ?? 1;   // v0.8 ゆめの いきもの：はやさの 倍率は 下限にも かける
    let cruise = (swimming ? 0.75 : 0.42) * Math.max(0.5 * dm, this.speedMul) * sp * (this.food ? 1.6 : 1);
    if ((this.pauseT > 0 && !this.food) || holdStill) cruise = 0;
    else if (dist < 0.8) cruise *= 0.4 + 0.6 * (dist / 0.8);
    // v0.10 足が とどかない ふかさで およいで いる（あさせ・りくでは あるく・ぴょん）
    const floating = swimming && groundAt(this.pos.x, this.pos.z) <= L.waterTop - this.bodyH;
    if (this.hopper && (!swimming || this.hopPh > 0)) { this.speed = this.hopStep(dt, cruise, dist, dm, holdStill); this.relaxLimb(dt); }   // v0.8 カエル：りくでは ぴょん
    else if (this.limb && floating) { this.speed = this.strokeStep(dt, cruise); this.hy = 0; this.hpitch = 0; }   // v0.10 カエル：けって すいっ／カメ：前あしで 漕ぐ
    else { this.speed += (cruise - this.speed) * Math.min(1, dt * 3); this.hy = 0; this.hpitch = 0; this.relaxLimb(dt); }
    if (dist > 1e-3) { this.pos.x += (dx / dist) * this.speed * dt; this.pos.z += (dz / dist) * this.speed * dt; }
    // たかさ：りくち・さかは 地面の うえ。みずの 中は めあての たかさへ（底より した には いかない）
    const ground = groundAt(this.pos.x, this.pos.z);
    if (this.pos.x >= L.shore - 0.05 || ground > L.waterTop - this.bodyH) {
      const foot = this.flat ? this.bodyH * 0.5 + 0.03 : this.bodyH * 0.35;   // v0.8 ひらたい いたは 下の はしを 地面に（Codex）
      this.pos.y += (ground + foot - this.pos.y) * Math.min(1, dt * 8);   // 地面に めりこまない
      this.pitch += (0 - this.pitch) * Math.min(1, dt * 3);
    } else {
      const toLand = this.landMode === 'land' && !this.food;
      const wantY = this.food ? tgt.y : toLand ? L.waterTop - 0.6 : tgt.y;
      this.pos.y += clamp(wantY - this.pos.y, -1, 1) * 1.2 * dt;
      this.pos.y = clamp(this.pos.y, ground + this.bodyH * 0.5, L.waterTop - 0.2);
      this.pitch += (clamp((wantY - this.pos.y) * 0.4, -0.3, 0.3) - this.pitch) * Math.min(1, dt * 2);
    }
    this.pos.x = clamp(this.pos.x, b.minX + this.len * 0.45, L.xMax - this.len * 0.45);
    this.pos.z = clamp(this.pos.z, b.minZ, b.maxZ);
    // あし・ひれ
    this.wave += dt * (this.speed > 0.05 ? (swimming ? 7 : 5) : 1.5);
    this.amp += ((swimming ? (this.limb ? STROKE[this.limb].amp : 0.045) : 0.02) - this.amp) * Math.min(1, dt * 3);
    this.checkEat(ctx, dt);
  }

  /**
   * v0.8 カエル（swim.hop）：りくでは あるかずに「ぴょん」と はねて すすむ。1かい HOP.dur びょう（空中 HOP.air のわり）、
   * 空中だけ すすみ、着地したら すこし やすむ。はやさの 倍率は とぶ 距離と やすみ に かける（うごきの 時間は おなじ）。
   * もどりは この フレームの 横の はやさ。hy（上への 上乗せ）・hpitch（あたまの 上げ下げ）は 描画だけ。
   */
  hopStep(dt, cruise, dist, dm, hold) {
    if (this.hopPh <= 0) {
      this.hy = 0; this.hpitch += (0 - this.hpitch) * Math.min(1, dt * 8);
      if (this.hopRest > 0) { this.hopRest -= dt; return 0; }
      if (cruise <= 0.01 || hold || dist < 0.12) return 0;
      this.hopPh = 1e-4;
      this.hopLen = Math.min(dist, this.len * HOP.dist * (0.75 + 0.25 * dm));
    }
    const T = HOP.dur, airT = T * HOP.air, t = this.hopPh * T;
    this.hopPh += dt / T;
    let v = 0;
    if (t < airT) {
      const q = t / airT;
      this.hy = Math.sin(Math.PI * q) * Math.min(HOP.hMax, this.len * HOP.h);
      this.hpitch = HOP.tilt * Math.sin(TAU * q);   // とびだしは 上むき → おりる ときは 下むき
      v = this.hopLen / airT;
    } else { this.hy = 0; this.hpitch *= 0.8; }
    if (this.hopPh >= 1) { this.hopPh = 0; this.hy = 0; this.hopRest = rand(HOP.rest[0], HOP.rest[1]) / Math.max(0.5, dm); }
    return v;
  }

  /**
   * v0.10 カエル・カメの 泳ぎ（limb）。水の 中で およいで いる ときに よぶ。もどりは この フレームの はやさ。
   * はやさ ＝ なめらかな 基準（cruise へ）×（1 ＋ つよさ ×（f(p) − 1））。波を はやさの 平滑化に とおさない（Codex：けりの 山が きえる）。
   * 水中で とまって まつ ときは カメは 小さく ゆっくり 漕ぐ（STROKE.turtle.idle）・カエルは 足を たたむ。
   */
  strokeStep(dt, cruise) {
    const S = STROKE[this.limb];
    if (this.limbAmp < 0.01) this.strokeBase = this.speed;   // りく・底から 入った ときは いまの はやさから
    this.floatK += (1 - this.floatK) * Math.min(1, dt * 2);
    this.strokeBase += (cruise - this.strokeBase) * Math.min(1, dt * (cruise > this.strokeBase ? 2.5 : 1.2));
    const moving = this.strokeBase > 0.05 && cruise > 0.02;
    if (moving && this.limb === 'frog' && this.limbAmp < 0.05) this.strokePh = 0;   // カエルは けりから はじめる
    const ampT = moving ? 1 : S.idle;
    this.limbAmp += (ampT - this.limbAmp) * Math.min(1, dt * (ampT > this.limbAmp ? 4 : 2.5));
    const k = clamp(this.strokeBase / 0.9, 0, 1);
    const T = moving ? S.period[1] - (S.period[1] - S.period[0]) * k : S.idlePeriod || S.period[1];
    if (this.limbAmp > 0.01) this.strokePh = (this.strokePh + dt / T) % 1;
    const f = this.applyStroke();
    return this.strokeBase * (1 + this.limbAmp * (f - 1));
  }

  /** v0.10 りく・底・ぴょんの あいだ：足を 絵の 姿勢へ もどす（位相は とめる） */
  relaxLimb(dt) {
    if (!this.limb) return;
    this.limbAmp += (0 - this.limbAmp) * Math.min(1, dt * 3);
    if (this.limbAmp < 0.002) this.limbAmp = 0;
    this.floatK += (0 - this.floatK) * Math.min(1, dt * 3);
    this.applyStroke();
  }

  /** v0.10 位相と つよさ → シェーダー・描画の 上乗せ。もどりは はやさの 倍率 f */
  applyStroke() {
    const S = STROKE[this.limb], a = this.limbAmp;
    if (this.limb === 'frog') {
      const { e, f } = frogStroke(this.strokePh);
      this.limbA = e * a; this.limbB = 0;
      this.stretch = (S.stretch * e - S.fold * (1 - e)) * a;
      // まって いる（つよさ 0）ときは あたまを すこし 上げて ふわふわ
      const idle = this.floatK * (1 - a);
      this.spitch = (-S.pitch * e + S.foldPitch * (1 - e)) * a + S.float * idle;
      this.sbob = 0.012 * this.len * Math.sin((this.clock || 0) * 2.2) * idle;
      return f;
    }
    const { c, s, f } = turtleStroke(this.strokePh);
    this.limbA = c * a; this.limbB = s * a; this.stretch = 0;
    this.sbob = S.bob * this.len * Math.sin(TAU * this.strokePh - 0.6) * a;
    this.spitch = S.pitch * c * a;
    return f;
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
      this.pos.y = b.sandY(this.pos.x, this.pos.z) + Math.sin(Math.PI * k) * h.h + this.footLift;
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
      const want = this.food ? (Math.abs(diff) > 0.9 ? 0.3 : dist > 3 ? 1.6 : 1.0) * Math.max(0.8, sp) * (holdStill ? 0 : 1)   // えさのときは急いで歩く（遠いときは もっと急ぐ）
        : (Math.abs(diff) > 0.6 ? 0.08 : 0.35) * this.speedMul * sp * (holdStill ? 0 : 1);
      this.speed += (want - this.speed) * Math.min(1, dt * 3);
      this.pos.x += Math.cos(this.yaw) * this.speed * dt;
      this.pos.z += -Math.sin(this.yaw) * this.speed * dt;
      this.pitch *= 0.9;
    }
    this.pos.y = b.sandY(this.pos.x, this.pos.z) + this.len * 0.02 + this.footLift;
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
    this.pos.x = clamp(this.pos.x, b.minX + m, (this.habit === 'land' && b.land ? b.land.xMax : b.maxX) - m);   // v0.6：カメ・カエルは りくちまで
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
    if (this.puiUntil && this.puiUntil[f.kind] > (this.clock || 0)) return false;   // ぷいっ のあと しばらく その種類は追わない
    const nearBottom = f.landed || f.pos.y < b.sandY(f.pos.x, f.pos.z) + 0.6;
    if (f.reserved && !this.eatsFromBottom) return false;   // 底の生きもののぶんは 魚は追わない
    if (f.snailOnly && !this.isSnail) return false;          // 貝のぶん
    if (this.fullUntil > (this.clock || 0)) return false;   // 食べた直後は少し休む（1匹がひとりじめしない）
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
    // きらいな えさ：口の手前で においをかいで「ぷいっ」
    if (ctx.foodPref && ctx.foodPref(this, f.kind) === 'dislike') {
      if (d < suck * 1.1) {
        (this.skipFood ||= new WeakSet()).add(f);
        f.claims = Math.max(0, f.claims - 1);
        (this.puiUntil ||= {})[f.kind] = (this.clock || 0) + 8;
        this.food = null;
        this.startReact('pui');
        ctx.onPui && ctx.onPui(this, f.kind);
      }
      return;
    }
    if (d < suck) {
      const step = Math.min(d, (1.2 + this.len) * dt);
      f.pos.addScaledVector(_v5.subVectors(m, f.pos).normalize(), step);
      f.sucked = true;
    }
    if (d < reach) {
      f.alive = false;
      this.food = null;
      this.sx = 0.86; this.flash = 0.5;
      this.fullUntil = (this.clock || 0) + 4;
      ctx.onEat(this, f.kind || 'flake');
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
      case 'pui': {
        // ① くんくん（0.28秒、ひれは小さく動かす）→ ② 鼻を上げて 130°ほど くるりと向きを変える → ③ ななめに すいーっと離れる
        const t = r.t;
        if (t < 0.28) { holdStill = true; ampScale = 0.5; this.opitch = 0.08 * Math.sin(t * 40) * 0.5 + 0.06; this.sx = 0.97; }
        else if (t < 0.7) {
          if (r.to === undefined) {
            const s = this.pos.z > (b.minZ + b.maxZ) / 2 ? -1 : 1;   // 奥か手前の空いているほうへ
            r.to = this.yaw + (Math.cos(this.yaw) >= 0 ? -s : s) * 2.3;
          }
          holdStill = true;
          this.faceYaw = r.to;
          const q = (t - 0.28) / 0.42;
          this.opitch = 0.32 * Math.sin(q * Math.PI);   // つーん
          this.sx = 1;
          ampScale = 1.6;
        } else {
          if (this.faceYaw !== null) {
            this.faceYaw = null;
            // 向いた方へ少し先に目標を置く
            const dx = Math.cos(this.yaw), dz = -Math.sin(this.yaw);
            this.target.set(clamp(this.pos.x + dx * 3, b.minX + 1, b.maxX - 1), this.pos.y + 0.4, clamp(this.pos.z + dz * 3, b.minZ, b.maxZ));
            this.retarget = 3; this.burst = 0.5;
          }
          this.opitch *= 0.9;
          speedScale = 1.7;
        }
        break;
      }
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
      this.oyaw = r.type === 'spin' || r.type === 'thanks' || r.type === 'pui' ? Math.sin(k * Math.PI * 4) * 0.25 * (1 - k) : 0;
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
