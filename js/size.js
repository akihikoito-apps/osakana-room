// v0.6 個体差（個体差係）：おおきさの ばらつき・キラキラ・えいよう・えさの すききらい。
// ここは 純粋関数だけ（state を さわらない・DOM なし）。sim.js が よんで 魚に 書きこむ。数値は js/data/sizes.js。
//
// 魚に 足す 項目（ほかの 係は sim.sizeOf(f) と f.shiny だけを つかう）
//   f.sizeZ   : 生まれつき（ふつう分布の z。±zMax）
//   f.shiny   : キラキラ（true/false）
//   f.eiyo    : えいよう 0〜100（たべると ふえ、時間で へる）
//   f.careSum / f.careH : ビッグに なるまでの えいよう（0〜1）の 合計と 時間
//   f.recent  : さいきん たべた えさの id（バランスの はんてい）
//   f.bigCm / f.bigZ : ビッグに なった ときに きまる cm と z（それまでは なし。おうかんは bigZ で はんてい）
import { SIZE, SIZE_OVERRIDE, EIYO, FOODS, FOOD_ORDER, FOOD_PREF_OVERRIDE, defaultFoodPref } from './data/sizes.js';
export { SIZE, EIYO, FOODS, FOOD_ORDER };

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const fin = (x) => typeof x === 'number' && Number.isFinite(x);

// ---------------- ふつう分布 ----------------
/** 標準正規乱数（Box–Muller）。rnd は 0〜1 */
export function randNormal(rnd = Math.random) {
  let u = 0;
  while (u <= 1e-12) u = rnd();
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
/** 標準正規の 累積分布（0〜1）。Abramowitz–Stegun 7.1.26 */
export function normCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}
/** 上位 (100−pct)% の さかいめの z（crownPct 90 → 1.2816） */
export function zOfPct(pct) {
  let lo = -6, hi = 6;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (normCdf(m) * 100 < pct) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
export const CROWN_Z = zOfPct(SIZE.crownPct);

// ---------------- 種の おおきさ ----------------
/** { mean: ビッグの 平均cm, sd, min, max, cv, stages: [ちびっこ, おとな, ビッグ] の 平均cm } */
export function sizeParams(sp = {}) {
  const o = SIZE_OVERRIDE[sp.id] || {};
  const base = Array.isArray(sp.sizeCm) && sp.sizeCm.length ? sp.sizeCm : [1.5, 3, 4];
  const big = base[2] ?? base[base.length - 1] ?? 4;
  const mean = fin(o.mean) ? o.mean : big;
  const cv = fin(o.cv) ? o.cv : (SIZE.cvByKind?.[sp.kind] ?? SIZE.cv);
  const k = mean / (big || mean || 1);                   // 上書きで 平均が かわったら ちびっこ・おとな も おなじ わりあいで
  const stages = [0, 1, 2].map((i) => (base[i] ?? big) * k);
  return { mean, cv, sd: mean * cv, min: mean * (1 - cv * SIZE.zMax), max: mean * (1 + cv * SIZE.zMax), stages };
}

// ---------------- 生まれつき ----------------
/** 手に入れた ときの 生まれつき：{ sizeZ, shiny } */
export function rollBirth(rnd = Math.random) {
  const sizeZ = clamp(randNormal(rnd), -SIZE.zMax, SIZE.zMax);
  const shiny = rnd() < SIZE.shinyChance;
  return { sizeZ: round3(sizeZ), shiny };
}
const round3 = (x) => Math.round(x * 1000) / 1000;

/** 文字列から きまる 0〜1 の 乱数（古い セーブの 魚の 生まれつき用） */
export function hashRnd(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return () => {
    h = (h + 0x6D2B79F5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 古い セーブの 魚：uid から きまる おだやかな z（キラキラには しない） */
export function oldSaveZ(uid) {
  return round3(clamp(randNormal(hashRnd('size:' + uid)) * SIZE.oldSaveZScale, -SIZE.zMax, SIZE.zMax));
}

// ---------------- そだち（えいよう） ----------------
/** ビッグに なるまでの えいようの へいきん（0〜1）。まだ 時間が なければ いまの えいよう */
export function careRatio(f) {
  if (fin(f.careH) && f.careH > 0) return clamp(f.careSum / f.careH, 0, 1);
  return clamp((fin(f.eiyo) ? f.eiyo : EIYO.start) / 100, 0, 1);
}
export const careZ = (f) => SIZE.careMaxZ * careRatio(f) - (SIZE.careBaseZ || 0);
/** その 魚の いまの z（生まれつき ＋ そだち）。ビッグなら きまった cm から もどす */
export function totalZ(sp, f) {
  const P = sizeParams(sp);
  if (f.stage >= 2 && fin(f.bigZ)) return clamp(f.bigZ, -SIZE.zMax, SIZE.zMax);
  if (f.stage >= 2 && fin(f.bigCm)) return clamp((f.bigCm / P.mean - 1) / P.cv, -SIZE.zMax, SIZE.zMax);
  return clamp((fin(f.sizeZ) ? f.sizeZ : 0) + careZ(f), -SIZE.zMax, SIZE.zMax);
}
/** ビッグの cm（ビッグなら きまった 値・そだちちゅうなら いまの よそう） */
export function bigCmOf(sp, f) {
  const P = sizeParams(sp);
  if (f.stage >= 2 && fin(f.bigCm)) return f.bigCm;
  return round1(P.mean * (1 + P.cv * totalZ(sp, f)));
}
const round1 = (x) => Math.round(x * 10) / 10;

/** ビッグに なった とき：cm を きめて 固定する（f を かえる）。きまった cm を かえす */
export function finalizeBig(sp, f) {
  if (fin(f.bigCm)) return f.bigCm;
  const P = sizeParams(sp);
  f.bigZ = round3(clamp((fin(f.sizeZ) ? f.sizeZ : 0) + careZ(f), -SIZE.zMax, SIZE.zMax));
  f.bigCm = round1(P.mean * (1 + P.cv * f.bigZ));
  return f.bigCm;
}

/**
 * sim.sizeOf の 中身。growRatio（0〜1：つぎの だんかいまで）で ちびっこ〜ビッグの あいだを なめらかに。
 * { cm: いまの cm, maxCm: ビッグの cm（きまった／よそう）, pct: その しゅるいの 中の 位置 0〜100,
 *   crown: ビッグで 上位10%, fixed: ビッグで きまった か, scale: いまの cm ÷ その だんかいの 平均（3D 用）}
 */
export function sizeInfo(sp, f, growRatio = 0) {
  const P = sizeParams(sp);
  const z = totalZ(sp, f);
  const s = clamp(f.stage | 0, 0, 2);
  const g = s < 2 ? clamp(growRatio, 0, 1) : 0;
  const k = 1 + P.cv * z * stageSpread(s, g);   // 平均に たいする 倍率（ちいさい うちは ばらつきも ちいさめ）
  const stageMean = s < 2 ? P.stages[s] + (P.stages[s + 1] - P.stages[s]) * g : P.stages[2];
  const maxCm = bigCmOf(sp, f);
  const cm = s >= 2 ? maxCm : round1(stageMean * k);
  const pct = clamp(Math.round(normCdf(z) * 1000) / 10, 0, 100);
  const fixed = s >= 2;
  return { cm, maxCm, pct, crown: fixed && z >= CROWN_Z - 1e-9, fixed, scale: k, mean: round1(P.mean), min: round1(P.min), max: round1(P.max) };
}

/** ちびっこ・おとなの ときの ばらつきの わりあい（agy：ビッグで いきなり かわらない ように）。ちびっこ 0.5 → おとな 0.75 → ビッグ 1 */
export function stageSpread(stage, g = 0) {
  const T = [0.5, 0.75, 1];
  const s = clamp(stage | 0, 0, 2);
  return s >= 2 ? 1 : T[s] + (T[s + 1] - T[s]) * clamp(g, 0, 1);
}

/** よそうの はば（そだちちゅうの カード用）：いまの よそうから ±0.5σ・0.5cm きざみ */
export function forecastRange(sp, f) {
  const P = sizeParams(sp);
  const c = bigCmOf(sp, f);
  const step = P.mean >= 10 ? 1 : 0.5;
  const lo = Math.max(round1(P.min), Math.floor((c - P.sd * 0.6) / step) * step);
  const hi = Math.min(round1(P.max), Math.ceil((c + P.sd * 0.6) / step) * step);
  return [round1(lo), round1(Math.max(hi, lo + step))];
}

/** カードの ことば（その しゅるいの 中で） */
export function sizeWord(pct, crown) {
  if (crown) return 'おうかん サイズ！';
  if (pct >= 75) return 'おおきめ';
  if (pct > 25) return 'ふつう';
  if (pct > 10) return 'ちいさめ';
  return 'プチサイズ！';          // 下位10%も かわいい よびかた（agy）
}
/**
 * そだちちゅうの よそうの ことば（cm は 出さない。Codex：生まれつきが ばれすぎない／agy：3だんかいの ことば）。
 * 生まれつき＋いままでの えいよう で きまるので、えさで かわる ことも ある。
 */
export function forecastWord(sp, f) {
  const z = totalZ(sp, f);
  if (z >= 0.8) return 'おおきく なりそう！';
  if (z <= -0.8) return 'ちょっぴり こぶりかも';
  return 'げんきに そだちそう';
}

/** 3D の 大きさ倍率（いまの cm ÷ その だんかいの 平均 を ゆるめた もの） */
export function lookScale(sp, f, growRatio = 0) {
  const P = sizeParams(sp);
  const k = 1 + P.cv * totalZ(sp, f) * stageSpread(f.stage, growRatio);
  return clamp(Math.pow(Math.max(0.1, k), SIZE.lookPow), SIZE.lookMin, SIZE.lookMax);
}

// ---------------- えさ ----------------
/** その えさを たべるか：'love' | 'ok' | 'no' */
export function foodPref(sp = {}, foodId) {
  if (foodId === 'food_flake' || foodId === 'food_sinking') return (sp.food || ['food_flake']).includes(foodId) ? 'ok' : 'no';
  const o = FOOD_PREF_OVERRIDE[sp.id]?.[foodId];
  if (o) return o;
  return defaultFoodPref(foodId, sp) || ((sp.food || []).includes(foodId) ? 'ok' : 'no');
}
export const canEat = (sp, foodId) => foodPref(sp, foodId) !== 'no';
/** 3D の えさの しゅるい（aq.feed の kind） */
export const foodKind = (foodId) => FOODS[foodId]?.kind || 'flake';

/** たべた とき：えいようを 足して さいきんの えさを おぼえる（f を かえる）。足した かずを かえす */
export function eatFood(sp, f, foodId) {
  const pref = foodPref(sp, foodId);
  if (pref === 'no') return 0;
  const recent = Array.isArray(f.recent) ? f.recent : [];
  const N = EIYO.recentN;
  let mul = pref === 'love' ? EIYO.loveMul : 1;
  const kinds = new Set([...recent.slice(-(N - 1)), foodId]).size;   // さいきんの しゅるいの かず（こんかいも 入れる）
  mul *= 1 + (EIYO.varietyStep ?? 0.25) * (kinds - 1);
  const add = (FOODS[foodId]?.eiyo ?? 12) * mul;
  f.eiyo = clamp((fin(f.eiyo) ? f.eiyo : EIYO.start) + add, 0, 100);
  f.recent = [...recent, foodId].slice(-N);
  return add;
}
/** ビタミン：バランスの かぞえには 入れない（べつの おまけ） */
export function eatVitamin(f, pref = 'ok') {
  const add = EIYO.vitamin[pref] ?? 0;
  f.eiyo = clamp((fin(f.eiyo) ? f.eiyo : EIYO.start) + add, 0, 100);
  return add;
}
/** 1じかん：えいようが へる・ビッグに なるまでは へいきんに 足す（f を かえる） */
export function hourTick(f) {
  f.eiyo = clamp((fin(f.eiyo) ? f.eiyo : EIYO.start) + EIYO.perHour, 0, 100);
  if ((f.stage | 0) < 2) { f.careSum = (f.careSum || 0) + f.eiyo / 100; f.careH = (f.careH || 0) + 1; }
}
export function eiyoLevel(v) {
  const L = EIYO.labels;
  return v >= L.goodMin ? 'good' : v >= L.okMin ? 'ok' : 'bad';
}

/** 魚の 個体差の 項目を そろえる（normalize 用。生まれつきが ない 古い 魚には uid から おだやかに つける） */
export function normSize(f) {
  if (!fin(f.sizeZ)) f.sizeZ = oldSaveZ(String(f.uid || ''));
  else f.sizeZ = clamp(f.sizeZ, -SIZE.zMax, SIZE.zMax);
  f.shiny = f.shiny === true;
  f.eiyo = clamp(fin(f.eiyo) ? f.eiyo : EIYO.start, 0, 100);
  f.careSum = Math.max(0, fin(f.careSum) ? f.careSum : 0);
  f.careH = Math.max(0, fin(f.careH) ? f.careH : 0);
  if (f.careSum > f.careH) f.careSum = f.careH;
  f.recent = Array.isArray(f.recent) ? f.recent.filter((x) => typeof x === 'string').slice(-EIYO.recentN) : [];
  if (f.bigCm != null && !fin(f.bigCm)) delete f.bigCm;
  if (f.bigZ != null && !fin(f.bigZ)) delete f.bigZ;
  return f;
}
/** 古い セーブで もう ビッグの 魚：ふつう くらいの えいようで cm を きめる */
export function finalizeOldBig(sp, f) {
  if (fin(f.bigCm) || (f.stage | 0) < 2) return null;
  if (!(f.careH > 0)) { f.careH = 1; f.careSum = SIZE.oldSaveCare; }
  return finalizeBig(sp, f);
}
