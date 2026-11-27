// v0.10 レース係：魚の うごき（DOM・GPU に よらない。tests/v010_race.test.js）。
// のうりょく（0〜100。effectiveStats＝コンディション こみ）が そのまま きく：
//   speed＝さいこう そく / accel＝かそく と ぶつかった あとの たちなおり / stamina＝ダッシュ ゲージの 大きさ・回復
//   turn＝まがる はやさ・カーブで ながされにくさ / jump＝とぶ 高さ・ちゃくちの はやさ / power＝ぶつかった ときの おしあい
import { curvatureAt, obstaclesAhead } from './course.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const n01 = (v) => clamp((Number(v) || 0) / 100, 0, 1);

// のうりょく → うごきの 数（ここを かえると ききかたが かわる）
export const TUNE = {
  maxSpeed: [10, 13],       // さいこう そく（/秒）。差が 大きすぎると はやさ だけで きまるので 1.3ばい（Codex・agy）
  accel: [4, 9],            // かそく（/秒²）
  stun: [0.55, 0.25],       // いわに ぶつかって とまる 時間（秒）
  safe: 0.8,                // ぶつかった あと いわに ひっかからない 時間（秒。はめ ふせぎ）
  dashCap: [2.0, 4.0],      // ダッシュ ゲージ（つかえる 秒）
  dashRegen: [1 / 8, 1 / 6],  // 1秒に もどる わりあい（からっぽ → まんたん 8〜6秒）
  regenWait: 0.5,           // ダッシュを やめて から もどりはじめる まで（秒）
  dashMul: 1.35,            // ダッシュ中の はやさ
  turnRate: [1.6, 3.0],     // まがる はやさ（rad/秒）
  drift: [0.13, 0.05],      // カーブで そとへ ながされる つよさ
  jumpV: [5.4, 7.6],        // とびだす はやさ → ちょうてん（床から）やく 1.6〜2.0
  gravity: [14, 20],        // おちる はやさ（たかい ほど はやく ちゃくち。でも とんで いる 時間は ながい）
  jumpBuffer: 0.18,         // ちゃくちの すこし まえに おしても とぶ（秒）
  weedMul: 0.55,            // かいそうの 中
  ringMul: 1.4, ringSec: 1.5,   // あわの わ（ダッシュとは かさねない）
  rockKeep: 0.3,            // いわに ぶつかった あと のこる はやさ
  radius: 0.45,             // 魚の 大きさ（あたり はんてい）
  belly: 0.1,               // いわを こえる はんてい：魚の まんなかが いわの 高さ − これ より 上なら こえた
  swimH: 0.55,              // ふつうに およぐ 高さ（上下の そうさは なし。Codex・agy）
  pushShare: [0.3, 0.7],    // ぶつかった とき おされる わりあいの はば
  maxYaw: 1.0,              // コースに たいして むける 角度
};

/** のうりょく → うごきの 数 */
export function derive(stats = {}) {
  const sp = n01(stats.speed), ac = n01(stats.accel), st = n01(stats.stamina), tu = n01(stats.turn), ju = n01(stats.jump), pw = n01(stats.power);
  const T = TUNE;
  return {
    maxSpeed: lerp(...T.maxSpeed, sp), accel: lerp(...T.accel, ac), stun: lerp(...T.stun, ac),
    dashCap: lerp(...T.dashCap, st), dashRegen: lerp(...T.dashRegen, st),
    turnRate: lerp(...T.turnRate, tu), drift: lerp(...T.drift, tu),
    jumpV: lerp(...T.jumpV, ju), gravity: lerp(...T.gravity, ju),
    power: 0.5 + pw,   // おしあいの おもさ（0.5〜1.5）
  };
}
/** ジャンプの ちょうてん（床からの 高さ） */
export const jumpPeak = (d, from = TUNE.swimH) => from + (d.jumpV * d.jumpV) / (2 * d.gravity);

/** 1ぴきぶんの 状態 */
export function makeRacer({ id, stats, lane = 0, s = 0, isPlayer = false } = {}) {
  const d = derive(stats);
  return {
    id, isPlayer, stats, d,
    s, lat: lane, h: TUNE.swimH, vh: 0, yaw: 0, speed: 0, air: false,
    dash: d.dashCap, dashing: false, regenWait: 0, boost: 0, stun: 0, safe: 0, jumpBuf: 0, inWeed: false,
    lap: 0, finished: false, finishTime: 0,
    bumpRock: 0, bumpFish: 0, rings: 0, jumps: 0, cleared: 0,
    catchup: 1,
  };
}

/**
 * 1こま すすめる。input = { steer -1..1（右＋）, dash bool（おしている あいだ）, jump bool（おした しゅんかん） }
 * かえす：できごとの 配列（'rock' | 'over' | 'ring' | 'jump' | 'land' | 'lap' | 'finish'）
 */
export function step(c, r, input = {}, dt = 1 / 60, time = 0) {
  const ev = [];
  dt = Math.min(dt, 0.05);
  if (r.finished) {
    // ゴールの あとは ゆっくり すすむ だけ
    r.speed += (r.d.maxSpeed * 0.45 - r.speed) * (1 - Math.exp(-dt * 2));
    r.s += r.speed * dt;
    r.yaw *= Math.exp(-dt * 3);
    r.dashing = false;
    if (r.air) { r.vh -= r.d.gravity * dt; r.h += r.vh * dt; if (r.h <= TUNE.swimH) { r.h = TUNE.swimH; r.air = false; } }
    return ev;
  }
  const d = r.d;
  const steer = clamp(input.steer || 0, -1, 1);
  const k = curvatureAt(c, r.s);

  // むき：スティックで まがる。はなすと コースの むきに もどる（こども向けの おてつだい）
  const yawRate = d.turnRate * (r.dashing ? 0.6 : 1) * (r.air ? 0.6 : 1);
  if (Math.abs(steer) > 0.05) r.yaw += steer * yawRate * dt;
  else r.yaw *= Math.exp(-dt * 3.2);
  r.yaw = clamp(r.yaw, -TUNE.maxYaw, TUNE.maxYaw);

  // ダッシュ：スタミナを つかって まっすぐ はやく。つかって いる あいだは もどらない
  if (input.dash && r.stun <= 0 && r.dash > 0.02) { r.dashing = true; r.dash = Math.max(0, r.dash - dt); r.regenWait = TUNE.regenWait; }
  else {
    r.dashing = false;
    if (r.regenWait > 0) r.regenWait -= dt;
    else r.dash = Math.min(d.dashCap, r.dash + d.dashRegen * d.dashCap * dt);
  }

  // ジャンプ（ちゃくちの すこし まえに おしても とぶ）
  if (input.jump) r.jumpBuf = TUNE.jumpBuffer;
  if (r.jumpBuf > 0 && !r.air && r.stun <= 0) { r.air = true; r.vh = d.jumpV; r.jumps++; r.jumpBuf = 0; ev.push('jump'); }
  if (r.jumpBuf > 0) r.jumpBuf -= dt;
  if (r.air) {
    r.vh -= d.gravity * dt;
    r.h += r.vh * dt;
    if (r.h <= TUNE.swimH && r.vh < 0) { r.h = TUNE.swimH; r.vh = 0; r.air = false; ev.push('land'); }
  }

  // はやさ：ダッシュと あわの わは かさねない（はやい ほう だけ）
  r.inWeed = false;
  for (const { o, dist } of obstaclesAhead(c, r.s, 3, 3)) {
    if (o.kind === 'weed' && Math.abs(dist) < o.len && Math.abs(r.lat - o.lat) < o.w + TUNE.radius && r.h < o.height) r.inWeed = true;
  }
  let target = d.maxSpeed * r.catchup;
  if (r.inWeed) target *= TUNE.weedMul;
  const fast = Math.max(r.dashing ? TUNE.dashMul : 1, r.boost > 0 ? TUNE.ringMul : 1);
  target *= fast;
  if (r.boost > 0) r.boost -= dt;
  if (r.safe > 0) r.safe -= dt;
  if (r.stun > 0) { r.stun -= dt; target *= 0.25; }
  const a = r.speed < target ? d.accel * (fast > 1 ? 1.6 : 1) : d.accel * 2.2;
  r.speed = r.speed < target ? Math.min(target, r.speed + a * dt) : Math.max(target, r.speed - a * dt);

  // すすむ：うちがわは きょりが みじかい。カーブでは そとへ ながされる
  const before = r.s;
  r.s += (r.speed * Math.cos(r.yaw) / Math.max(0.55, 1 + k * r.lat)) * dt;
  r.lat += r.speed * Math.sin(r.yaw) * dt + k * r.speed * r.speed * d.drift * dt * (r.air ? 0.5 : 1);
  const lim = c.half - TUNE.radius;
  if (Math.abs(r.lat) > lim) { r.lat = Math.sign(r.lat) * lim; r.speed *= 1 - 0.6 * dt; r.yaw *= 0.5; }

  // いわ・あわの わ
  const moved = r.s - before;
  for (const { o, dist } of obstaclesAhead(c, before, moved + 2)) {
    const rel = dist - moved;   // うごいた あとの、まんなかまでの きょり
    if (o.kind === 'rock') {
      const reach = o.len + TUNE.radius;
      const side = Math.abs(r.lat - o.lat) < o.w + TUNE.radius;
      if (side && Math.abs(rel) < reach && r.safe <= 0 && r.h < o.height - TUNE.belly) {
        // ぶつかった：いわの 手前に もどして とまる（accel が 高いと はやく たちなおる）
        r.s -= reach - rel + 0.05;
        r.speed *= TUNE.rockKeep; r.stun = d.stun; r.safe = TUNE.safe; r.bumpRock++;
        r.lat += (r.lat >= o.lat ? 1 : -1) * 0.3;
        r.dashing = false;
        ev.push('rock');
        break;
      }
      // とびこえた（ぶつからずに うしろへ ぬけた）
      if (side && dist >= -reach && rel < -reach) { r.cleared++; ev.push('over'); }
    } else if (o.kind === 'ring' && dist > 0 && rel <= 0) {
      if (Math.hypot(r.lat - o.lat, r.h - o.h) < o.r + 0.25) { r.boost = TUNE.ringSec; r.rings++; ev.push('ring'); }
    }
  }

  // しゅう・ゴール（s は ほとんど もどらないので しゅうは へらない）
  const lap = Math.floor(r.s / c.length);
  if (lap > r.lap) { r.lap = lap; if (lap < c.laps) ev.push('lap'); }
  if (r.s >= c.total) { r.finished = true; r.finishTime = time; r.dashing = false; ev.push('finish'); }
  return ev;
}

/** 魚どうしの ぶつかり（power の 比で おしあう。おされる わりあいは 3〜7わり）。かえす：ぶつかった くみ */
export function collide(c, racers) {
  const hits = [];
  const lim = c.half - TUNE.radius;
  const R = TUNE.radius * 2;
  for (let i = 0; i < racers.length; i++) for (let j = i + 1; j < racers.length; j++) {
    const A = racers[i], B = racers[j];
    if (A.finished || B.finished) continue;
    const ds = A.s - B.s, dl = A.lat - B.lat, dh = A.h - B.h;
    if (Math.abs(ds) > R * 1.4 || Math.abs(dh) > 0.8) continue;
    const dist = Math.hypot(ds * 0.7, dl);
    if (dist >= R) continue;
    const shareA = clamp(B.d.power / (A.d.power + B.d.power), ...TUNE.pushShare);   // A が おされる わりあい
    const over = R - dist;
    const dir = dl === 0 ? (String(A.id) < String(B.id) ? -1 : 1) : Math.sign(dl);
    // かべに おしつけない：かべぎわの ほうは うごかさず、もう かたほうを おす
    let mA = over * shareA, mB = over * (1 - shareA);
    if (Math.abs(A.lat + dir * mA) > lim) { mB += mA; mA = 0; }
    if (Math.abs(B.lat - dir * mB) > lim) { mA += mB; mB = 0; }
    A.lat = clamp(A.lat + dir * mA, -lim, lim); B.lat = clamp(B.lat - dir * mB, -lim, lim);
    // うしろから ぶつかった ほうが すこし おそく なる（かるい ほうが よけいに）
    const back = ds < 0 ? A : B;
    back.speed *= 1 - 0.15 * (back === A ? shareA : 1 - shareA);
    A.bumpFish++; B.bumpFish++;
    hits.push([A.id, B.id]);
  }
  return hits;
}

/** じゅんい（ゴールずみは ゴールの じゅん、ほかは すすんだ きょり） */
export function ranking(racers) {
  return racers.slice().sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    return b.s - a.s;
  });
}

// 追いつき 補正（やさしめ。Codex は ひかえめ、agy は かんたんだけ つよめ → あいだを とった）。
// きょりの 差が near 以内なら なし、full で さいだい。コンピューターは プレイヤーより 前なら おそく・うしろなら はやく。
// プレイヤーは コンピューターの 1いより うしろなら すこし はやく（むずかしい は なし）
export const CATCHUP = {
  easy:   { ahead: 0.06, behind: 0.02, player: 0.03 },
  normal: { ahead: 0.04, behind: 0.02, player: 0.015 },
  hard:   { ahead: 0.03, behind: 0.02, player: 0 },
  near: 10, full: 40,
};
const ramp = (gap) => clamp((gap - CATCHUP.near) / (CATCHUP.full - CATCHUP.near), 0, 1);
export function catchupTarget(r, me, lead, level) {
  const C = CATCHUP[level] || CATCHUP.normal;
  if (!me) return 1;
  if (r.isPlayer) return 1 + C.player * ramp(lead - r.s);
  const gap = r.s - me.s;
  return gap > 0 ? 1 - C.ahead * ramp(gap) : 1 + C.behind * ramp(-gap);
}
export function applyCatchup(racers, level = 'normal', dt = 1 / 60) {
  const me = racers.find((r) => r.isPlayer);
  const cpus = racers.filter((r) => !r.isPlayer);
  const lead = cpus.length ? Math.max(...cpus.map((r) => r.s)) : 0;
  for (const r of racers) {
    const want = catchupTarget(r, me, lead, level);
    r.catchup += (want - r.catchup) * (1 - Math.exp(-dt * 3));   // きゅうに かわらない
  }
}
