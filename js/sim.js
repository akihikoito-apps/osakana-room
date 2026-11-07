// 数値の計算（部屋・ゲーム係）。数値は js/data/balance.js・items.js にあり、ここはそれを使って計算するだけ。
// 計算の手順は docs/仕様_v0.1.md。
// - tick(state, gameMinutes)：時間が進んだ分の変化。できごと（events）の配列を返す。
//   なめらかに変わるもの（すいおん・きれいさ・くうき・おなか・けんこう・ごきげん）は分ごとに足し、
//   確率・よい時間（そだち）・ときどきのリアクションは「ゲーム内の整数時刻をまたいだとき」に1回ずつ判定する。
// - お世話・お店：feedStart/feedEat/feedEnd・waterChange・scoop・pet・buyFish・buyItem・claimMission。
// 画面（DOM）には触らない。
import { newUid } from './state.js';

let D = null;          // setup() で入る
let B = null;          // balance
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const num = (x, d) => (Number.isFinite(x) ? x : d);
const DAY = 1440;

// balance.js が無い・項目が欠けたときの仮の値（balance.js があればそちらが勝つ）
const FALLBACK = {
  TIME: { realSecPerGameDay: 600, dayStartHour: 6, stopDuringTutorial: true },
  START: { coins: 200, roomTemp: 20, waterTemp: 20, clean: 100, air: 70, leftover: 0, fish: { onaka: 60, health: 80, mood: 60, natsuki: 0 } },
  TANK: { capacity: 6, fishMax: 6, snailMax: 2 },
  TEMP: { towardRoomPerHour: 0.5, bestRange: 2, farOut: 3 },
  CLEAN: { basePerHour: -0.3, perSpacePerHour: -0.4, perLeftoverPerHour: -1.5, leftoverMax: 5, cleanerIds: [], cleanerLeftoverPerHour: 0.125, scoopClean: 0 },
  AIR: { naturalPerHour: 0.6, naturalCap: 60, perSpacePerHour: -0.5 },
  HUNGER: { perHour: -3.5, full: 90, rewardBelow: 80, leftoverIfHalfFull: 0.5, feedLockRealSec: 5 },
  HEALTH: { min: 10, max: 100, weak: 40, good: 70, bad: { tempOut: -2, tempFarOut: -3, dirty: -1.5, veryDirty: -3, airLow: -2, airVeryLow: -3, starving: -1.5, nigate: 0 }, badCapPerHour: -3, recoverPerHour: 4, recoverBestPerHour: 6, best: { clean: 70, air: 50, onaka: 30 } },
  MOOD: { base: 50, approachPerHour: 5, temp: { best: 15, ok: 0, out: -20 }, clean: { high: 70, highBonus: 10, low: 40, lowPenalty: -15 }, air: { high: 50, highBonus: 5, low: 30, lowPenalty: -15 }, onaka: { high: 50, highBonus: 5, low: 20, lowPenalty: -15 }, likePerDecor: 5, likeMax: 15, friendPerMate: 5, friendMax: 10, nigatePerMate: -10, nigateMin: -20, light: 5, happy: 70, sad: 30 },
  BOND: { feed: 2, feedPerDay: 5, pet: 1, petPerDay: 5, petCooldownRealSec: 30, waterChange: 1, waterChangePerDay: 2, heartStep: 20 },
  NAKAYOSHI: { value: { 0: 20, 1: 60, 2: 100 }, alone: 50, aloneSchool: 40 },
  GROW: { goodHour: { onaka: 20, health: 60, tempInRange: true }, feedBonusHours: 2, feedBonusPerDay: 4, hoursPerGrowDay: 20 },
  COIN: { care: { feed: { coin: 6, perDay: 4 }, waterChange: { coin: 10, perDay: 3, cleanBelow: 85 } }, careDailyCap: 50, thanks: { chancePerHour: 0.1, need: { health: 70, mood: 70, onaka: 40 }, coinBase: 8, coinPerRarity: 2, perFishPerDay: 1, perTankPerDay: 4, minGapHours: 2, guaranteeHours: 12 }, max: 99999 },
  UNLOCK: { tank6: { tankIndex: 0, count: 6, banner: ['うみの すいそうが かえるように なったよ！'], lockedLine: '1つめの すいそうに 6ぴき いると あえるよ' } },
  TANKS: { max: 6, newTank: { temp: 25, clean: 100, air: 70, leftover: 0 } },
  MULTI_TANK: { careDailyCapPerExtraTank: 25, thanksAllTanksBase: 4, thanksAllTanksPerExtra: 3, emptyTankNoCareCoin: true },
  SNAIL: { cleanPerHour: 0.15, leftoverPerHour: 0.06 },
  HEART: { perPet: 1, perFishEveryGameHours: 1, perDay: 20, need: { health: 40 }, max: 99999 },
  SCOOP: { animRealSec: 2.0, allowWhenEmpty: true },
  THERMO: { steps: [{ id: 'cool', label: 'すずしい', temp: 23 }, { id: 'normal', label: 'ふつう', temp: 25 }, { id: 'warm', label: 'あたたかい', temp: 27 }], perfectRange: 1, perfectMood: 5, defaultStep: 'normal', perHour: 1, safeOnly: true, resetOnUnsafe: true },
  CLEAN_FLOOR: { minNetDirtPerHour: 0.4 },
  VITAMIN: { perTankPerDay: 1, usesPerBuy: 5, eatEvenIfFull: true, effect: { love: { health: 15, growHours: 6, mood: 10, natsuki: 3, react: ['jump', 'heart'] }, ok: { health: 10, growHours: 4, mood: 5, natsuki: 1, react: ['happy'] }, dislike: { react: ['turn'] } } },
  WATER_LABELS: { fresh: 'みずの すいそう', salt: 'うみの すいそう' },
  SHOP_TABS: [{ kind: 'fish', label: 'さかな' }, { kind: 'shrimp', label: 'エビ' }, { kind: 'snail', label: 'かい' }],
  REACTION: { petCooldownRealSec: 3, idleEveryHours: 4, sadEveryHours: 3, sleepyEveryHours: 5, nightSleepy: { from: 22, to: 6, chancePerHour: 0.2 } },
  LABELS: {
    temp: { good: 'ちょうどいい', ok: 'まあまあ', cold: 'さむい', hot: 'あつい' },
    clean: { good: 'ピカピカ', ok: 'ふつう', bad: 'よごれてる', goodMin: 70, okMin: 40 },
    air: { good: 'たっぷり', ok: 'ふつう', bad: 'すくない', goodMin: 50, okMin: 30 },
    onaka: { good: 'たりてる', ok: 'すこし すいた', bad: 'ぺこぺこ', goodMin: 70, okMin: 30, full: 'おなか いっぱい' },
    health: { good: 'げんき', ok: 'ふつう', bad: 'げんきが ない', goodMin: 70, okMin: 40 },
    mood: { good: 'ごきげん', ok: 'ふつう', bad: 'しょんぼり', goodMin: 70, okMin: 30 },
    nakayoshi: { good: 'なかよし', ok: 'ふつう', bad: 'にがて', goodMin: 80, okMin: 40 },
    stage: ['ちびっこ', 'おとな', 'ビッグ'],
  },
};

function merge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], over[k]) : over[k];
  return out;
}

export function setup({ FISH, ITEMS, compatOf, balance = {}, missions = {}, hints = {}, tutorial = {} }) {
  B = {};
  for (const k of Object.keys(FALLBACK)) B[k] = merge(FALLBACK[k], balance[k]);
  // 水槽そのもの（tank_fresh / tank_salt）。items.js に 無ければ 仮の しなもの を 足す
  ITEMS = ITEMS.slice();
  const tankFallback = [
    { id: 'tank_fresh', name: 'すいそう', type: 'tank', water: 'fresh', price: 800, inTank: false, max: 5, unlock: 'tank6', includes: ['heater', 'air_pump'], icon: 'assets/items/tank_fresh.png', desc: 'あたらしい みずの すいそう。' },
    { id: 'tank_salt', name: 'うみの すいそう', type: 'tank', water: 'salt', price: 1000, inTank: false, max: 5, unlock: 'tank6', includes: ['heater', 'air_pump'], icon: 'assets/items/tank_salt.png', desc: 'うみの みずの すいそう。' },
  ];
  for (const t of tankFallback) if (!ITEMS.some((i) => i.id === t.id)) ITEMS.push(t);
  for (const it of ITEMS) if (/^tank_/.test(it.id) && !it.type) it.type = 'tank';
  D = {
    FISH, ITEMS, B,
    fishById: Object.fromEntries(FISH.map((f) => [f.id, f])),
    itemById: Object.fromEntries(ITEMS.map((i) => [i.id, i])),
    compatOf: compatOf || (() => 1),
    MISSIONS: (missions.MISSIONS || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    MISSION_VISIBLE: missions.MISSION_VISIBLE || 3,
    HINTS: (hints.HINTS || []).slice().sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)),
    HAPPY_LINES: hints.HAPPY_LINES || [],
    TEXT: {
      weakPrefix: hints.WEAK_PREFIX || '{name}は すこし やすんでいるよ。',
      recovering: hints.RECOVERING_LINE || '{name}は すこしずつ げんきに なっているよ。',
      recovered: hints.RECOVERED_LINE || '{name}が げんきに なったよ！',
      nigateConfirm: hints.SHOP_NIGATE_CONFIRM || '{name}は いまの なかまが すこし にがて みたい。それでも むかえる？',
      full: hints.FULL_LINE || 'みんな おなか いっぱい みたい。また あとで あげてね。',
    },
    VITAMIN_LINES: { love: '{name}は ビタミンが だいすき！', ok: '{name}が ビタミンを たべたよ。', dislike: '{name}は ビタミンが すきじゃない みたい。', allDislike: 'この すいそうの みんなは ビタミンが すきじゃない みたい。', doneToday: 'ビタミンは 1にち 1かい。また あしたね。', empty: 'ビタミンが なくなったよ。おみせで かえるよ。', ...(hints.VITAMIN_LINES || {}) },
    VITAMIN_DEX: { love: 'だいすき', ok: 'たべる', dislike: 'にがて', ...(hints.VITAMIN_DEX || {}) },
    THERMO_LINES: { title: 'おんど ダイヤル', outOfRange: '{name}には ちょっと あわない あたたかさ みたい。', ...(hints.THERMO_LINES || {}) },
    SHOP_LINES: { locked: '1つめの すいそうに 6ぴき いると あえるよ', tankMax: 'へやに すいそうが いっぱいだよ。', newTank: 'あたらしい すいそうが へやに きたよ！',
      wrongWater: '{name}は うみの すいそうで くらすよ。うみの すいそうを えらんでね。', wrongWaterFresh: '{name}は みずの すいそうで くらすよ。みずの すいそうを えらんでね。',
      needs: '{name}は {item}が ある すいそうで くらすよ。さきに {item}を いれてね。', ...(hints.SHOP_LINES || {}) },
    TUTORIAL: tutorial.TUTORIAL || null,
    tutorialModule: tutorial,
  };
  return D;
}
export const data = () => D;
export const balance = () => B;

export function initialValues() {
  const S0 = B.START;
  return { coins: S0.coins, waterTemp: S0.waterTemp, clean: S0.clean, air: S0.air, leftover: S0.leftover, startMinute: (B.TIME.dayStartHour ?? 6) * 60 };
}

// ---------------- 日付（6:00 で 日が かわる） ----------------
export const dayStartMin = () => (B?.TIME.dayStartHour ?? 6) * 60;
/** 1, 2, 3 …（あさ 6:00 に つぎの日） */
export function gameDay(min) { return Math.floor((min - dayStartMin()) / DAY) + 1; }
export const hourOf = (min) => (((min % DAY) + DAY) % DAY) / 60;

// ---------------- 形をそろえる ----------------
export function normalize(state) {
  const S0 = B.START;
  for (const t of state.tanks) {
    t.temp = num(t.temp, S0.waterTemp);
    t.clean = clamp(num(t.clean, S0.clean), 0, 100);
    t.air = clamp(num(t.air, S0.air), 0, 100);
    t.leftover = clamp(num(t.leftover, S0.leftover), 0, B.CLEAN.leftoverMax);
    t.timers = { idle: 0, sad: 0, sleepy: 0, thanksGap: 99, ...(t.timers || {}) };
    t.thanksToday = num(t.thanksToday, 0);
    if (!(B.THERMO.steps || []).some((x) => x.id === t.thermo)) t.thermo = B.THERMO.defaultStep || 'normal';   // おんど ダイヤル
    if (typeof t.feederOn !== 'boolean') t.feederOn = true;                     // じどう えさやりの スイッチ（はじめは いり）
    t.decor = (t.decor || []).filter((id) => D.itemById[id]?.inTank);
    t.fish = t.fish.filter((f) => D.fishById[f.speciesId]);
    for (const f of t.fish) normFish(f);
  }
  state.clock.judged = Number.isFinite(state.clock.judged) ? state.clock.judged : Math.floor(state.clock.min / 60);
  const day = gameDay(state.clock.min);
  state.daily = { day, care: 0, careBy: {}, ...state.daily };
  state.daily.careBy ||= {};
  state.inv ||= {};
  state.hints = { closed: {}, ...(state.hints || {}) };
  state.hearts = Math.max(0, Math.floor(num(state.hearts, 0)));
  state.heartsTotal = Math.max(state.hearts, Math.floor(num(state.heartsTotal, state.hearts)));
  state.daily.hearts = Math.max(0, num(state.daily.hearts, 0));
  state.daily.careByTank ||= {};
  state.daily.thanksAll = num(state.daily.thanksAll, 0);
  state.unlocks = { ...(state.unlocks || {}) };
  // v0.2 の とちゅうの 形（unlock.open）からの 読み替え
  if (state.unlock?.open && !state.unlocks.tank6) state.unlocks.tank6 = state.unlock.day || state.daily.day;
  delete state.unlock;
  state.notices = { ...(state.notices || {}) };       // まだ 見せていない お知らせ（tank6 など）
  state.inv.food_vitamin = Math.max(0, Math.floor(num(state.inv.food_vitamin, 0)));   // ビタミンの のこり かいすう
  state.daily.vitamin = { ...(state.daily.vitamin || {}) };                          // きょう ビタミンを あげた 水槽 { tankId: かず }
  state.vitaminSeen = { ...(state.vitaminSeen || {}) };                              // すききらいが わかった しゅるい（ぷいっ の ふきだしも 1かいだけ）
  delete state.heartDay;
  state.ui ||= {};
  if (!state.tanks.some((t) => t.id === state.ui.tankId)) state.ui.tankId = state.tanks[0]?.id;
  checkUnlock(state);          // 読み込んだ 直後にも しらべる（v0.1 で もう 6ぴき なら ここで ひらく）
  return state;
}

function normFish(f) {
  const s = B.START.fish;
  // 古い名前（food/happy/bond）からの読み替え
  f.onaka = clamp(num(f.onaka, num(f.food, s.onaka)), 0, 100);
  f.mood = clamp(num(f.mood, num(f.happy, s.mood)), 0, 100);
  f.natsuki = clamp(num(f.natsuki, num(f.bond, s.natsuki)), 0, 100);
  f.health = clamp(num(f.health, s.health), B.HEALTH.min, B.HEALTH.max);
  delete f.food; delete f.happy; delete f.bond;
  f.stage = [0, 1, 2].includes(f.stage) ? f.stage : 0;
  f.grow = Math.max(0, num(f.grow, 0));       // そだち（時間）
  f.okHours = num(f.okHours, 0);              // 今日 ありがとうの 条件を みたした 時間
  f.weak = f.health < B.HEALTH.weak;
  f.day = { d: 0, feedBond: 0, petBond: 0, waterBond: 0, thanks: 0, feedGrow: 0, ...(f.day || {}) };
  f.lastHeartMin = Number.isFinite(f.lastHeartMin) ? f.lastHeartMin : -1e9;   // さいごに ハートを くれた ゲーム時刻
}

// ---------------- まとめて 見るもの ----------------
export const snailCount = (t) => t.fish.filter((f) => D.fishById[f.speciesId]?.kind === 'snail').length;
/** 定員の 表示用：{ fish: 魚・エビの かず, fishMax, space, snail, snailMax } */
export function capacityOf(t) {
  const fish = t.fish.length - snailCount(t);
  return { fish, fishMax: B.TANK.fishMax ?? 6, space: spaceUsed(t), capacity: B.TANK.capacity, full: fish >= (B.TANK.fishMax ?? 1e9) || spaceUsed(t) >= B.TANK.capacity - 1e-9, snail: snailCount(t), snailMax: B.TANK.snailMax ?? 2 };
}
export function spaceUsed(t) { return t.fish.reduce((a, f) => a + (D.fishById[f.speciesId]?.space ?? 1), 0); }
export const hasItem = (t, id) => t.decor.includes(id);
export const countItem = (t, id) => t.decor.filter((x) => x === id).length;
export const ownsTool = (state, id) => !!state.inv[id];
/** おなかの ゲージ：いちばん すいている魚 */
export function onakaMin(t) { return t.fish.length ? Math.min(...t.fish.map((f) => f.onaka)) : 100; }

function tempJudge(t, sp) {
  const r = sp?.temp; if (!r) return { out: 0, best: true, side: 0 };
  const out = t.temp < r.min ? r.min - t.temp : t.temp > r.max ? t.temp - r.max : 0;
  return { out, best: Math.abs(t.temp - r.best) <= B.TEMP.bestRange, side: t.temp < r.min ? -1 : t.temp > r.max ? 1 : 0 };
}
/** 水温の むかう先（仕様 v0.3 2-2）：ヒーター／ファン／りょうほう（おんど ダイヤル）／なし */
export function tempTarget(t) {
  const items = D.itemById;
  const heater = hasItem(t, 'heater') ? items.heater?.effect : null;
  const fan = hasItem(t, 'fan') ? (items.fan?.effect || {}) : null;
  if (heater && fan) {
    const st = (B.THERMO.steps || []).find((x) => x.id === t.thermo) || (B.THERMO.steps || []).find((x) => x.id === B.THERMO.defaultStep) || { temp: 25 };
    return { target: st.temp, rate: B.THERMO.perHour ?? 1, dial: true };
  }
  if (heater) return { target: heater.targetTemp, rate: heater.tempPerHour };
  if (fan && fan.towardRoomMinus != null && !fan.needsHeater) return { target: B.START.roomTemp - fan.towardRoomMinus, rate: B.TEMP.towardRoomPerHour };
  // ファンだけ：なにも しない（ヒーターと いっしょに はたらく）
  return { target: B.START.roomTemp, rate: B.TEMP.towardRoomPerHour };
}
/** おんど ダイヤルが つかえるか（ヒーターと ファンが りょうほう） */
export const hasThermo = (t) => hasItem(t, 'heater') && hasItem(t, 'fan');
/** その だんの おんどで はんい外に なる 魚 */
export function thermoOutFish(t, stepId) {
  const st = (B.THERMO.steps || []).find((x) => x.id === stepId);
  if (!st) return [];
  return t.fish.filter((f) => { const r = D.fishById[f.speciesId]?.temp; return r && (st.temp < r.min || st.temp > r.max); });
}
export function setThermo(state, t, stepId) {
  if (!(B.THERMO.steps || []).some((x) => x.id === stepId)) return { ok: false, reason: 'unknown' };
  const out = thermoOutFish(t, stepId);
  if (B.THERMO.safeOnly && out.length) return { ok: false, reason: 'unsafe', out };    // あわない 段は えらべない
  t.thermo = stepId;
  return { ok: true, out };
}
/** あわない 魚が いる 段に なっていたら ふつうに もどす（resetOnUnsafe）。もどしたら true */
export function fixThermo(t) {
  if (!B.THERMO.resetOnUnsafe || !t.thermo || t.thermo === (B.THERMO.defaultStep || 'normal')) return false;
  if (!thermoOutFish(t, t.thermo).length) return false;
  t.thermo = B.THERMO.defaultStep || 'normal';
  return true;
}

/** すいおん の ようす：'good'|'ok'|'cold'|'hot'（いちばん わるい魚に あわせる） */
export function tempState(t) {
  if (!t.fish.length) return 'ok';
  let st = 'good';
  for (const f of t.fish) {
    const j = tempJudge(t, D.fishById[f.speciesId]);
    if (j.side < 0) return 'cold';
    if (j.side > 0) return 'hot';
    if (!j.best) st = 'ok';
  }
  return st;
}
/** 0-100 の値を 'good'|'ok'|'bad' に */
export function level(kind, v) {
  const L = B.LABELS[kind];
  if (!L) return 'ok';
  return v >= L.goodMin ? 'good' : v >= L.okMin ? 'ok' : 'bad';
}
export function label(kind, v) {
  if (kind === 'temp') return B.LABELS.temp[v];
  if (kind === 'onaka' && v >= B.HUNGER.full && B.LABELS.onaka.full) return B.LABELS.onaka.full;
  return B.LABELS[kind][level(kind, v)];
}
/** すいそうの 魚が みんな だいじょうぶな すいおんの はんい */
export function tempRange(t) {
  if (!t.fish.length) return null;
  let min = -99, max = 99;
  for (const f of t.fish) { const r = D.fishById[f.speciesId]?.temp; if (!r) continue; min = Math.max(min, r.min); max = Math.min(max, r.max); }
  return { min, max };
}
/** つぎの段階までの そだち（0-1）。ビッグなら 1 */
export function growRatio(f) {
  const sp = D.fishById[f.speciesId];
  const need = (sp?.growDays?.[f.stage] ?? 0) * B.GROW.hoursPerGrowDay;
  if (f.stage >= 2 || !need) return 1;
  return clamp(f.grow / need, 0, 1);
}

// ---------------- なかよし ----------------
const mates = (t, f) => t.fish.filter((g) => g !== f);
export function nakayoshiOf(t, f) {
  const others = mates(t, f);
  const sp = D.fishById[f.speciesId];
  if (!others.length) return sp?.swim?.school ? B.NAKAYOSHI.aloneSchool : B.NAKAYOSHI.alone;
  let sum = 0;
  for (const g of others) sum += B.NAKAYOSHI.value[D.compatOf(f.speciesId, g.speciesId)] ?? 60;
  return sum / others.length;
}
/** お店の 相性マーク：その種類と いまの すいそうの 魚たち。0（にがてが いる）/1/2（なかよしが いて にがて なし）。魚が いなければ null */
export function compatWithTank(t, speciesId) {
  if (!t.fish.length) return null;
  let worst = 2, best = 0;
  for (const g of t.fish) { const c = D.compatOf(speciesId, g.speciesId); worst = Math.min(worst, c); best = Math.max(best, c); }
  return worst === 0 ? 0 : best === 2 ? 2 : 1;
}

// ---------------- 時間が進む ----------------
/**
 * @returns {Array} できごと：
 *   { type:'newDay', day } / { type:'grow', uid, stage } / { type:'thanks', uid, coin } / { type:'react', uid, kind } /
 *   { type:'mission', id } / { type:'weak', uid } / { type:'recover', uid } / { type:'hour' }
 */
export function tick(state, gameMinutes, rnd = Math.random) {
  const events = [];
  let left = Math.max(0, +gameMinutes || 0);
  // 大きく進めるときも 結果が ほぼ同じに なるよう、整数時刻と 5分 で区切る
  while (left > 1e-9) {
    const toHour = 60 - (((state.clock.min % 60) + 60) % 60);
    const dt = Math.min(5, left, toHour < 1e-9 ? 60 : toHour);
    left -= dt;
    flow(state, dt, events);
    // 整数時刻を またいだら 1時間ぶんの はんてい
    const h = Math.floor(state.clock.min / 60 + 1e-9);
    while (state.clock.judged < h) { state.clock.judged++; hourly(state, state.clock.judged, events, rnd); }
  }
  checkMissions(state, events);
  return events;
}

/** なめらかに 変わる もの（dt 分ぶん） */
function flow(state, dt, events) {
  const h = dt / 60;
  state.clock.min += dt;
  const day = gameDay(state.clock.min);
  if (day !== state.daily.day) {
    state.daily = { day, care: 0, careBy: {}, careByTank: {}, thanksAll: 0, hearts: 0, vitamin: {} };
    state.stats.days = (state.stats.days || 0) + 1;
    for (const t of state.tanks) { t.thanksToday = 0; for (const f of t.fish) { f.okHours = 0; dayBucket(state, f); } }
    events.push({ type: 'newDay', day });
  }
  for (const t of state.tanks) flowTank(state, t, h, events);
}

function flowTank(state, t, h, events) {
  const items = D.itemById;
  // すいおん
  const { target, rate } = tempTarget(t);
  if (t.temp < target) t.temp = Math.min(target, t.temp + rate * h);
  else if (t.temp > target) t.temp = Math.max(target, t.temp - rate * h);

  const S = spaceUsed(t);
  const L = hasItem(t, 'light') ? (items.light?.effect?.plantBoost ?? 1.5) : 1;
  const C = hasItem(t, 'co2_kit') ? (items.co2_kit?.effect?.plantAirBoost ?? items.co2_kit?.effect?.plantBoost ?? 1.5) : 1;     // シーオーツー：みずくさの くうき だけ（ライトと かけあわせ）
  const F = (hasItem(t, 'filter') ? (items.filter?.effect?.dirtMultiplier ?? 0.5) : 1) * (hasItem(t, 'skimmer') ? (items.skimmer?.effect?.dirtMultiplier ?? 0.8) : 1);
  // きれいさ：よごれ（フィルターで 半分）＋ みずくさ
  let dClean = (B.CLEAN.basePerHour + B.CLEAN.perSpacePerHour * S + B.CLEAN.perLeftoverPerHour * t.leftover) * F;
  let dAir = (t.air < B.AIR.naturalCap ? B.AIR.naturalPerHour : 0) + B.AIR.perSpacePerHour * S;
  let dLeft = 0;
  for (const id of t.decor) {
    const e = items[id]?.effect || {};
    const k = id === 'plant' || id === 'coral' ? L : 1;      // ライトで 1.5ばい（みずくさ・サンゴ）
    if (e.cleanPerHour) dClean += e.cleanPerHour * k;
    if (e.airPerHour) dAir += e.airPerHour * k * (id === 'plant' ? C : 1);   // シーオーツーは くうき だけ
    if (e.leftoverPerHour) dLeft -= e.leftoverPerHour;
  }
  dLeft -= t.fish.filter((f) => (B.CLEAN.cleanerIds || []).includes(f.speciesId)).length * B.CLEAN.cleanerLeftoverPerHour;
  // かい：こけを たべて すこし きれいに・たべのこしも すこし へらす
  const snails = t.fish.filter((f) => D.fishById[f.speciesId]?.kind === 'snail').length;
  const algae = t.fish.filter((f) => (B.SNAIL.algaeEaterIds || []).includes(f.speciesId)).length;   // オトシンクルス など
  dClean += (snails + algae) * (B.SNAIL.cleanPerHour || 0);
  dLeft -= snails * (B.SNAIL.leftoverPerHour || 0);
  if (t.fish.length - snailCount(t) > 0) dClean = Math.min(dClean, -(B.CLEAN_FLOOR?.minNetDirtPerHour ?? 0));
  t.clean = clamp(t.clean + dClean * h, 0, 100);
  t.air = clamp(t.air + dAir * h, 0, 100);
  t.leftover = clamp(t.leftover + dLeft * h, 0, B.CLEAN.leftoverMax);

  const H = B.HEALTH, M = B.MOOD;
  const safe = !state.tutorial.done;        // チュートリアル中は けんこう・ごきげん を 下げない
  const tags = new Set(t.decor.map((id) => items[id]?.tag).filter(Boolean));
  for (const f of t.fish) {
    const sp = D.fishById[f.speciesId];
    if (!sp) continue;
    f.onaka = clamp(f.onaka + B.HUNGER.perHour * (sp.appetite ?? 1) * h, 0, 100);
    const tj = tempJudge(t, sp);
    const others = mates(t, f);
    const nigate = others.filter((g) => D.compatOf(f.speciesId, g.speciesId) === 0).length;
    const friends = others.filter((g) => D.compatOf(f.speciesId, g.speciesId) === 2).length;
    // けんこう
    let bad = 0;
    if (tj.out >= B.TEMP.farOut) bad += H.bad.tempFarOut; else if (tj.out > 0) bad += H.bad.tempOut;
    if (t.clean < 20) bad += H.bad.veryDirty; else if (t.clean < (sp.cleanMin ?? 40)) bad += H.bad.dirty;
    if (t.air < 15) bad += H.bad.airVeryLow; else if (t.air < 30) bad += H.bad.airLow;
    if (f.onaka < 10) bad += H.bad.starving;
    if (nigate) bad += H.bad.nigate || 0;
    if (bad < 0) { if (!safe) f.health += Math.max(H.badCapPerHour ?? -3, bad) * h; }
    else {
      const best = tj.best && t.clean >= H.best.clean && t.air >= H.best.air && f.onaka >= H.best.onaka;
      f.health += (best ? H.recoverBestPerHour : H.recoverPerHour) * h;
    }
    f.health = clamp(f.health, H.min, H.max);    // 10 より下がらない（死なない）
    const weak = f.health < H.weak;
    if (!f.weak && weak) events.push({ type: 'weak', uid: f.uid });
    if (f.weak && !weak) events.push({ type: 'recover', uid: f.uid });
    f.weak = weak;
    // ごきげん（目標に 近づく）
    let target = M.base;
    target += tj.out > 0 ? M.temp.out : tj.best ? M.temp.best : M.temp.ok;
    if (sp.temp && Math.abs(t.temp - sp.temp.best) <= (B.THERMO.perfectRange ?? -1)) target += B.THERMO.perfectMood || 0;   // とても ぴったり
    target += t.clean >= M.clean.high ? M.clean.highBonus : t.clean < M.clean.low ? M.clean.lowPenalty : 0;
    target += t.air >= M.air.high ? M.air.highBonus : t.air < M.air.low ? M.air.lowPenalty : 0;
    target += f.onaka >= M.onaka.high ? M.onaka.highBonus : f.onaka < M.onaka.low ? M.onaka.lowPenalty : 0;
    target += Math.min(M.likeMax, (sp.likes || []).filter((tag) => tags.has(tag)).length * M.likePerDecor);
    target += Math.min(M.friendMax, friends * M.friendPerMate);
    target += Math.max(M.nigateMin ?? -999, nigate * M.nigatePerMate);
    if (hasItem(t, 'light')) target += M.light;
    // シーオーツー：みずくさが すきな 魚は +5（みずくさが 1こ いじょう）
    if (hasItem(t, 'co2_kit') && hasItem(t, 'plant') && (sp.likes || []).includes('plant')) target += D.itemById.co2_kit?.effect?.moodBonusPlantLovers ?? 5;
    target = clamp(target, 0, 100);
    const st = M.approachPerHour * h;
    if (f.mood < target) f.mood = Math.min(target, f.mood + st);
    else if (!safe) f.mood = Math.max(target, f.mood - st);
  }
}

/** 整数時刻ごとの はんてい（hourIndex = 0時からの 通しの 時間） */
function hourly(state, hourIndex, events, rnd) {
  const hour = ((hourIndex % 24) + 24) % 24;
  events.push({ type: 'hour' });
  for (const t of state.tanks) {
    const G = B.GROW.goodHour;
    for (const f of t.fish) {
      const sp = D.fishById[f.speciesId];
      if (!sp) continue;
      const tj = tempJudge(t, sp);
      // そだち +1（よい時間）
      if (f.onaka >= G.onaka && f.health >= G.health && (!G.tempInRange || tj.out === 0)) addGrow(state, f, 1, events);
      // ありがとうの 条件を みたした 時間
      const T = B.COIN.thanks;
      if (f.health >= T.need.health && f.mood >= T.need.mood && f.onaka >= T.need.onaka) f.okHours++;
    }
    autoFeed(t, hour, events);
    thanksRoll(state, t, events, rnd);
    reactions(state, t, hour, events, rnd);
  }
}

/** じどう えさやり：おなか < 90 の 魚へ おなか +15（コイン・なつき・そだち・ハートは なし） */
function autoFeed(t, hour, events) {
  if (!hasItem(t, 'auto_feeder') || t.feederOn === false) return;     // スイッチ きり なら うごかない
  const e = D.itemById.auto_feeder?.effect || { atHours: [8, 18], below: 50, fill: 15 };
  if (!(e.atHours || []).includes(hour)) return;
  let n = 0;
  for (const f of t.fish) if (f.onaka < (e.below ?? B.HUNGER.full)) { f.onaka = Math.min(100, f.onaka + (e.fill ?? 15)); n++; }
  events.push({ type: 'autoFeed', tankId: t.id, count: n });
}

function addGrow(state, f, n, events) {
  const sp = D.fishById[f.speciesId];
  if (f.stage >= 2) return;
  f.grow += n;
  const need = (sp?.growDays?.[f.stage] ?? 99) * B.GROW.hoursPerGrowDay;
  if (f.grow >= need) {
    f.stage++; f.grow = 0;
    state.stats.maxStage = Math.max(state.stats.maxStage || 0, f.stage);
    events.push({ type: 'grow', uid: f.uid, stage: f.stage });
  }
}

function thanksRoll(state, t, events, rnd) {
  const T = B.COIN.thanks;
  t.timers.thanksGap += 1;
  if (!state.tutorial.done || t.timers.thanksGap < T.minGapHours || t.thanksToday >= T.perTankPerDay) return;
  const M = B.MULTI_TANK;
  const allCap = M.thanksAllTanksBase != null ? M.thanksAllTanksBase + (M.thanksAllTanksPerExtra || 0) * Math.max(0, livedTanks(state) - 1) : (M.thanksPerDayAllTanks ?? 1e9);
  if ((state.daily.thanksAll || 0) >= allCap) return;
  const cand = t.fish.filter((f) => {
    const d = dayBucket(state, f);
    return d.thanks < T.perFishPerDay && f.health >= T.need.health && f.mood >= T.need.mood && f.onaka >= T.need.onaka;
  });
  if (!cand.length) return;
  // 12時間 みたして まだの 魚は かならず。そうでなければ 1ぴきずつ 10%
  let who = cand.find((f) => f.okHours >= T.guaranteeHours);
  if (!who) for (const f of cand) { if (rnd() < T.chancePerHour) { who = f; break; } }
  if (!who) return;
  const sp = D.fishById[who.speciesId];
  const coin = addCoin(state, T.coinBase + T.coinPerRarity * (sp?.rarity ?? 1));
  dayBucket(state, who).thanks++;
  t.thanksToday++; t.timers.thanksGap = 0;
  state.daily.thanksAll = (state.daily.thanksAll || 0) + 1;
  inc(state, 'thanks');
  events.push({ type: 'thanks', uid: who.uid, coin });
}

function reactions(state, t, hour, events, rnd) {
  const R = B.REACTION;
  if (!t.fish.length) return;
  t.timers.idle++; t.timers.sad++; t.timers.sleepy++;
  if (t.timers.idle >= R.idleEveryHours) {
    const c = t.fish.filter((f) => f.mood >= 80);
    if (c.length) { t.timers.idle = 0; events.push({ type: 'react', uid: pick(c, rnd).uid, kind: rnd() < 0.5 ? 'jump' : 'spin' }); }
  }
  if (t.timers.sad >= R.sadEveryHours) {
    const c = t.fish.filter((f) => f.onaka < 30 || f.mood < 30);
    if (c.length) { t.timers.sad = 0; events.push({ type: 'react', uid: pick(c, rnd).uid, kind: 'sad' }); }
  }
  if (t.timers.sleepy >= R.sleepyEveryHours) {
    const c = t.fish.filter((f) => f.health < B.HEALTH.weak);
    if (c.length) { t.timers.sleepy = 0; events.push({ type: 'react', uid: pick(c, rnd).uid, kind: 'sleepy' }); }
  }
  const ns = R.nightSleepy;
  if (ns && (hour >= ns.from || hour < ns.to) && rnd() < ns.chancePerHour) events.push({ type: 'react', uid: pick(t.fish, rnd).uid, kind: 'sleepy' });
}
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length) % arr.length];

export function addCoin(state, n) {
  n = Math.floor(n);
  if (!(n > 0)) return 0;
  const before = state.coins;
  state.coins = Math.min(B.COIN.max, state.coins + n);
  const got = state.coins - before;
  state.stats.coinsEarned = (state.stats.coinsEarned || 0) + got;
  return got;
}

/** お世話の ごほうび（1日の かいすうと 1日の 合計の 上限つき） */
/** 生きものが いる 水槽の 数（上限を ふやす ときに 数える） */
export const livedTanks = (state) => state.tanks.filter((x) => x.fish.length > 0).length;
function careCoin(state, kind, t = state.tanks[0]) {
  const c = B.COIN.care[kind];
  if (!c) return 0;
  if (B.MULTI_TANK.emptyTankNoCareCoin && t && !t.fish.length) return 0;   // からの 水槽の お世話は コインなし
  state.daily.careByTank ||= {};
  const by = (state.daily.careByTank[t?.id || 't1'] ||= {});
  if ((by[kind] || 0) >= c.perDay) return 0;
  const cap = B.COIN.careDailyCap + (B.MULTI_TANK.careDailyCapPerExtraTank || 0) * Math.max(0, livedTanks(state) - 1);
  const n = Math.min(c.coin, cap - state.daily.care);
  if (n <= 0) return 0;
  by[kind] = (by[kind] || 0) + 1;
  state.daily.careBy[kind] = (state.daily.careBy[kind] || 0) + 1;
  state.daily.care += n;
  return addCoin(state, n);
}

const inc = (state, k, n = 1) => { state.stats[k] = (state.stats[k] || 0) + n; };
function dayBucket(state, f) {
  if (f.day.d !== state.daily.day) f.day = { d: state.daily.day, feedBond: 0, petBond: 0, waterBond: 0, thanks: 0, feedGrow: 0 };
  return f.day;
}
const done = (state) => { const events = []; checkMissions(state, events); return events; };

// ---------------- えさ ----------------
// 1回の えさやり ＝ feedStart → （水槽の eat ごとに）feedEat → feedEnd。
// ボタンは 5びょう ロック（HUNGER.feedLockRealSec）。おそい魚・そこの魚が あとから たべても かぞえられるよう、
// eat は つぎの えさやり まで（さいだい FEED_WINDOW_MS）うけつける。
export const FEED_WINDOW_MS = 40000;   // 水槽の餌は 底に ついてから 30びょう のこる
let session = null;
/** えさを 落とせるか しらべて はじめる。{ ok, reason: 'noTool'|'noFish'|'full'|'busy', leftover, lockMs } */
export function feedStart(state, t = state.tanks[0], foodId = 'food_flake', now = Date.now()) {
  if (!ownsTool(state, foodId)) return { ok: false, reason: 'noTool' };
  if (!t.fish.length) return { ok: false, reason: 'noFish' };
  if (session && now < session.until) return { ok: false, reason: 'busy' };
  const prev = session ? feedEnd(state) : null;      // まえの えさやりを しめる
  const full = t.fish.filter((f) => f.onaka >= B.HUNGER.full).length;
  if (full === t.fish.length) return { ok: false, reason: 'full', text: D.TEXT.full };
  let leftover = 0;
  if (full > 0 && full * 2 >= t.fish.length) {     // たべない魚が 半分以上
    leftover = B.HUNGER.leftoverIfHalfFull;
    t.leftover = clamp(t.leftover + leftover, 0, B.CLEAN.leftoverMax);
  }
  const lockMs = B.HUNGER.feedLockRealSec * 1000;
  session = { tank: t, foodId, ate: new Set(), rewarded: false, coin: 0, until: now + lockMs, expire: now + FEED_WINDOW_MS, counted: false };
  inc(state, 'feedTries');
  return { ok: true, leftover, lockMs, windowMs: FEED_WINDOW_MS, prevEvents: prev?.events || [] };
}
/** 水槽の eat：その魚が おなか < 90 なら +30（1回の えさやりで 1ぴき1回） */
export function feedEat(state, uid, now = Date.now()) {
  if (!session || now > session.expire) return null;
  const t = session.tank;
  const f = t.fish.find((x) => x.uid === uid);
  if (!f || session.ate.has(uid) || f.onaka >= B.HUNGER.full) return null;
  const sp = D.fishById[f.speciesId];
  if (sp?.food && !sp.food.includes(session.foodId)) return null;
  session.ate.add(uid);
  const hungry = f.onaka < B.HUNGER.rewardBelow;
  f.onaka = Math.min(100, f.onaka + (D.itemById[session.foodId]?.effect?.fill ?? 30));
  const d = dayBucket(state, f);
  if (hungry && d.feedBond < B.BOND.feedPerDay) { d.feedBond++; f.natsuki = clamp(f.natsuki + B.BOND.feed, 0, 100); }
  const events = [];
  if (d.feedGrow < B.GROW.feedBonusPerDay) { d.feedGrow++; addGrow(state, f, B.GROW.feedBonusHours, events); }
  let coin = 0;
  if (!session.counted) { session.counted = true; inc(state, 'feed'); }
  if (hungry && !session.rewarded) { session.rewarded = true; coin = careCoin(state, 'feed', session.tank); session.coin = coin; }
  checkMissions(state, events);
  return { uid, coin, hungry, events };
}
/** えさやりを しめる */
export function feedEnd(state) {
  const s = session; session = null;
  if (!s) return null;
  return { ate: [...s.ate], coin: s.coin, events: done(state) };
}
export const feedBusy = (now = Date.now()) => !!session && now < session.until;

// ---------------- みずかえ・そうじ・なでる ----------------
export function waterChange(state, t = state.tanks[0]) {
  if (!ownsTool(state, 'water_change')) return { ok: false, reason: 'noTool' };
  const e = D.itemById.water_change?.effect || { clean: 40, clearLeftover: true };
  const dirty = t.clean < (B.COIN.care.waterChange.cleanBelow ?? 85);
  t.clean = clamp(t.clean + e.clean, 0, 100);
  if (e.clearLeftover) t.leftover = 0;
  let coin = 0;
  if (dirty) {
    coin = careCoin(state, 'waterChange', t);
    inc(state, 'waterChange');                      // ミッションは よごれているときだけ 数える
    for (const f of t.fish) { const d = dayBucket(state, f); if (d.waterBond < B.BOND.waterChangePerDay) { d.waterBond++; f.natsuki = clamp(f.natsuki + B.BOND.waterChange, 0, 100); } }
  }
  inc(state, 'waterChangeAll');
  return { ok: true, coin, dirty, events: done(state) };
}

/** そうじ（あみで たべのこしを すくう）。たべのこしが 1こ 以上 あったときだけ 数える。 */
export function scoop(state, t = state.tanks[0]) {
  if (t.leftover <= 0) return { ok: false, reason: 'none' };
  const had = t.leftover >= 1;
  t.leftover = 0;
  t.clean = clamp(t.clean + (B.CLEAN.scoopClean || 0), 0, 100);
  if (had) inc(state, 'scoop');
  return { ok: true, coin: 0, had, events: done(state) };
}

const lastPet = new Map();     // uid → 実時間（ms）。セーブには入れない
const lastPetBond = new Map();
/** なでる。{ ok, react: 'happy'|'heart'|'spin'|'sleepy'|null, bond } */
export function pet(state, uid, now = Date.now(), t = state.tanks[0]) {
  const f = t.fish.find((x) => x.uid === uid);
  if (!f) return { ok: false };
  if (now - (lastPet.get(uid) ?? -1e12) < B.REACTION.petCooldownRealSec * 1000) return { ok: true, react: null, bond: 0, events: [] };
  lastPet.set(uid, now);
  const d = dayBucket(state, f);
  let bond = 0;
  if (now - (lastPetBond.get(uid) ?? -1e12) >= B.BOND.petCooldownRealSec * 1000 && d.petBond < B.BOND.petPerDay) {
    d.petBond++; lastPetBond.set(uid, now);
    f.natsuki = clamp(f.natsuki + B.BOND.pet, 0, 100); bond = B.BOND.pet;
  }
  inc(state, 'pet');
  // ハート：おなじ 魚からは ゲーム内1時間に 1こ・1日 20こ まで・げんきが ない 魚からは もらわない
  const H = B.HEART;
  let heart = false;
  if (f.health >= (H.need?.health ?? B.HEALTH.weak) && state.clock.min - f.lastHeartMin >= (H.perFishEveryGameMinutes ?? (H.perFishEveryGameHours ?? 1) * 60)
      && (state.daily.hearts || 0) < (H.perDay ?? 1e9)) {
    const n = H.perPet ?? 1;
    heart = true;
    f.lastHeartMin = state.clock.min;
    state.daily.hearts = (state.daily.hearts || 0) + n;
    state.hearts = Math.min(H.max ?? 99999, (state.hearts || 0) + n);
    state.heartsTotal = (state.heartsTotal || 0) + n;
  }
  // ハートが 出ない とき（まち時間・きょうの 上限）は ハート以外で よろこぶ（ハートが 出たと まちがえない ように）
  const react = f.health < B.HEALTH.weak ? 'sleepy' : heart ? (H.react || 'heart') : f.natsuki < 80 ? 'happy' : 'spin';
  const dayFull = !heart && (state.daily.hearts || 0) >= (H.perDay ?? 1e9);
  const justFull = heart && (state.daily.hearts || 0) >= (H.perDay ?? 1e9);
  return { ok: true, react, bond, heart, dayFull, justFull, weak: f.health < (H.need?.health ?? B.HEALTH.weak), events: done(state) };
}

// ---------------- お店 ----------------
export function priceOf(state, id) {
  const it = D.itemById[id] || D.fishById[id];
  if (!it || it.price == null) return null;
  if (it.tutorialFree && !state.tutorial.done && !state.stats['free_' + id]) return 0;
  return it.price;
}

/** 解放ずみか（'tank6' など）。キーが 無ければ はじめから */
export const isUnlocked = (state, key) => !key || !!state.unlocks?.[key];
/** お店に 出すか（値段が ある もの。解放前は かぎつきで 出す） */
export const fishOnSale = (state, sp) => !!sp && sp.price != null;
/** その 魚を 入れられる 水槽（水が あう もの） */
export const tanksFor = (state, sp) => state.tanks.filter((t) => t.water === sp.water);

/** 魚が買えるか。{ ok, reason: 'coins'|'full'|'water'|'notSold'|'locked'|'needs', item } */
export function canBuyFish(state, id, t = state.tanks[0]) {
  const sp = D.fishById[id];
  if (!sp || sp.price == null) return { ok: false, reason: 'notSold' };
  if (!isUnlocked(state, sp.unlock)) return { ok: false, reason: 'locked' };
  if (!t) return { ok: false, reason: 'water' };
  if (sp.water !== t.water) return { ok: false, reason: 'water' };
  const need = (sp.needs || []).find((id2) => !t.decor.includes(id2));
  if (need) return { ok: false, reason: 'needs', item: need };
  if (sp.kind === 'snail') {
    if (snailCount(t) >= (B.TANK.snailMax ?? 2)) return { ok: false, reason: 'snailFull' };
  } else if (spaceUsed(t) + (sp.space ?? 1) > B.TANK.capacity + 1e-9 || (t.fish.length - snailCount(t)) >= (B.TANK.fishMax ?? 1e9)) return { ok: false, reason: 'full' };
  if (state.coins < priceOf(state, id)) return { ok: false, reason: 'coins' };
  return { ok: true };
}

export function buyFish(state, id, t = state.tanks[0]) {
  const c = canBuyFish(state, id, t);
  if (!c.ok) return c;
  const price = priceOf(state, id);
  state.coins -= price;
  const s = B.START.fish;
  const f = { uid: newUid(), speciesId: id, stage: 0, onaka: s.onaka, health: s.health, mood: s.mood, natsuki: s.natsuki, born: state.clock.min };
  normFish(f);
  dayBucket(state, f);
  const friends = t.fish.filter((g) => D.compatOf(id, g.speciesId) === 2).map((g) => g.uid);
  t.fish.push(f);
  const first = !state.dex[id];
  state.dex[id] = { first: state.daily.day, count: (state.dex[id]?.count || 0) + 1 };
  inc(state, 'buyFish');
  const events = [];
  if (fixThermo(t)) events.push({ type: 'thermoReset', tankId: t.id });
  checkUnlock(state, events);
  checkMissions(state, events);
  return { ok: true, fish: f, first, price, spec: D.fishById[id], friends, events };
}

/** 器具・飾り・道具・水槽が買えるか。{ ok, reason: 'coins'|'max'|'water'|'notSold'|'have'|'locked'|'roomFull' } */
export function canBuyItem(state, id, t = state.tanks[0]) {
  const it = D.itemById[id];
  if (!it || it.price == null) return { ok: false, reason: 'notSold' };
  if (!isUnlocked(state, it.unlock)) return { ok: false, reason: 'locked' };
  if (it.type === 'tank') {
    if (state.tanks.length >= (B.TANKS.max ?? 6)) return { ok: false, reason: 'tankMax' };
    if (state.coins < it.price) return { ok: false, reason: 'coins' };
    return { ok: true };
  }
  if (it.water !== 'both' && it.water !== t.water) return { ok: false, reason: id === 'co2_kit' ? 'co2Salt' : id === 'skimmer' ? 'skimmerFresh' : 'water' };
  if (it.inTank) { if (countItem(t, id) >= (it.max ?? 1)) return { ok: false, reason: 'max' }; }
  else if (it.uses) { if ((state.inv[id] || 0) > 0) return { ok: false, reason: 'vitaminFull' }; }    // ビタミン：つかいおわってから
  else if (ownsTool(state, id)) return { ok: false, reason: 'have' };
  if (state.coins < priceOf(state, id)) return { ok: false, reason: 'coins' };
  return { ok: true };
}

export function buyItem(state, id, t = state.tanks[0]) {
  const c = canBuyItem(state, id, t);
  if (!c.ok) return c;
  const price = priceOf(state, id);
  const it = D.itemById[id];
  state.coins -= price;
  if (price === 0) state.stats['free_' + id] = 1;
  if (it.type === 'tank') {
    const tank = addTank(state, it.water === 'salt' ? 'salt' : 'fresh', it.includes || []);
    state.owned[id] = true;
    inc(state, 'buyTank');
    return { ok: true, item: it, price, tank, fans: [], events: done(state) };
  }
  if (it.inTank) t.decor.push(id);
  else if (it.uses) state.inv[id] = Math.min(it.uses, (state.inv[id] || 0) + it.uses);   // ビタミン：5かいぶん
  else state.inv[id] = 1;
  state.owned[id] = true;
  inc(state, 'buyItem');
  // その飾りが すきな魚
  const fans = it.tag ? t.fish.filter((f) => (D.fishById[f.speciesId]?.likes || []).includes(it.tag)).map((f) => f.uid) : [];
  return { ok: true, item: it, price, fans, events: done(state) };
}

// ---------------- ミッション ----------------
export function missionProgress(state, m) {
  const g = m.goal || {};
  // 水槽が いくつ あっても、ぜんぶ まとめて かぞえる（なかよし・みんな げんき は どれか 1つの 水槽で）
  const allFish = state.tanks.flatMap((x) => x.fish);
  const t = { fish: allFish, decor: state.tanks.flatMap((x) => x.decor) };
  const st = state.stats;
  const cnt = (k) => ({ now: Math.min(st[k] || 0, g.count), need: g.count });
  switch (g.type) {
    case 'buyFish': return cnt('buyFish');
    case 'fishCount': return { now: Math.min(state.tanks[0].fish.length, g.count), need: g.count };
    case 'speciesCount': return { now: Math.min(new Set(state.tanks[0].fish.map((f) => f.speciesId)).size, g.count), need: g.count };
    case 'placeItem': return { now: t.decor.includes(g.id) || state.inv[g.id] ? 1 : 0, need: 1 };
    case 'feed': return cnt('feed');
    case 'waterChange': return cnt('waterChange');
    case 'scoop': return cnt('scoop');
    case 'pet': return cnt('pet');
    case 'thanks': return cnt('thanks');
    case 'grow': return { now: (st.maxStage || 0) >= g.stage ? 1 : 0, need: 1 };
    case 'natsuki': { const v = Math.max(0, ...t.fish.map((f) => f.natsuki)); return { now: Math.min(Math.floor(v), g.value), need: g.value }; }
    case 'friends': {
      let ok = 0;
      for (const tk of state.tanks) for (let i = 0; i < tk.fish.length && !ok; i++) for (let j = i + 1; j < tk.fish.length; j++) if (D.compatOf(tk.fish[i].speciesId, tk.fish[j].speciesId) === 2) { ok = 1; break; }
      return { now: ok, need: 1 };
    }
    case 'allHealthy': {
      const need = g.minFish ?? 2;
      let best = 0;
      for (const tk of state.tanks) {
        const good = tk.fish.filter((f) => f.health >= g.value).length;
        best = Math.max(best, tk.fish.length >= need && good === tk.fish.length ? need : Math.min(good, need - 1));
      }
      return { now: best, need };
    }
    case 'days': return cnt('days');
    case 'tankCreatures': { const tk = state.tanks[g.tankIndex ?? 0]; return { now: Math.min(tk ? tk.fish.length : 0, g.count), need: g.count }; }
    case 'kindCount': return { now: Math.min(allFish.filter((f) => (D.fishById[f.speciesId]?.kind || 'fish') === g.kind).length, g.count), need: g.count };
    case 'tankCount': return { now: Math.min(state.tanks.length, g.count), need: g.count };
    case 'hasTankWater': return { now: state.tanks.some((x) => x.water === g.water) ? 1 : 0, need: 1 };
    case 'waterFishCount': return { now: Math.min(allFish.filter((f) => D.fishById[f.speciesId]?.water === g.water).length, g.count), need: g.count };
    case 'hearts': return { now: Math.min(state.heartsTotal || 0, g.count), need: g.count };
    case 'unlock': return { now: state.unlocks?.[g.id] ? 1 : 0, need: 1 };
    case 'vitaminEat': return cnt(g.love ? 'vitaminLove' : 'vitaminEat');
    case 'gadgetCount': return { now: Math.min(state.tanks.reduce((a, tk) => a + tk.decor.filter((id) => (g.ids || []).includes(id)).length, 0), g.count), need: g.count };
    case 'zukan': return { now: Math.min(Object.keys(state.dex).length, g.count), need: g.count };
    default: return { now: 0, need: 1 };
  }
}

/** 画面に出す ミッション（まだ うけとっていない ものを order じゅんに MISSION_VISIBLE こ） */
export function visibleMissions(state) {
  return D.MISSIONS.filter((m) => !state.missions.claimed[m.id]).slice(0, D.MISSION_VISIBLE);
}

/** たっせいを しらべる（見えている ものだけ。チュートリアル中は しない） */
export function checkMissions(state, events = []) {
  if (!state.tutorial.done) return events;
  for (const m of visibleMissions(state)) {
    if (state.missions.done[m.id]) continue;
    const p = missionProgress(state, m);
    if (p.now >= p.need) { state.missions.done[m.id] = state.daily.day; events.push({ type: 'mission', id: m.id }); }
  }
  return events;
}

export function claimMission(state, id) {
  const m = D.MISSIONS.find((x) => x.id === id);
  if (!m || !state.missions.done[id] || state.missions.claimed[id]) return { ok: false };
  state.missions.claimed[id] = state.daily.day;
  const coin = addCoin(state, m.reward?.coin || 0);
  return { ok: true, coin, events: done(state) };
}

// ---------------- ヒント ----------------
/**
 * いま出す ヒント。{ key, text, action, uid, kind: 'hint'|'recovering' } か null。
 * げんきが ない魚が いれば WEAK_PREFIX を まえに つける。とじた ヒントは ゲーム3時間 出さない。
 */
export function currentHint(state, t = state.tanks[0]) {
  if (!state.tutorial.done) return null;
  if (!t.fish.length) {
    const h = D.HINTS.find((x) => x.when?.type === 'tankEmpty');
    return h && t !== state.tanks[0] ? { key: h.id, text: h.text, action: h.action, uid: null, kind: 'hint' } : null;
  }
  const has = (id) => hasItem(t, id);
  const sp = (f) => D.fishById[f.speciesId] || {};
  const find = (pred) => t.fish.find((f) => pred(f, sp(f)));
  const any = t.fish[0];
  const likeName = (f) => {
    const tag = (sp(f).likes || []).find((tg) => !t.decor.some((id) => D.itemById[id]?.tag === tg));
    return D.ITEMS.find((i) => i.tag === tag && i.price != null)?.name || '';
  };
  const checks = {
    fanCold: () => has('fan') && find((f, s) => t.temp < (s.temp?.min ?? -99)),
    noHeaterCold: () => !has('heater') && !has('fan') && find((f, s) => t.temp < (s.temp?.min ?? -99)),
    tempLow: () => has('heater') && !has('fan') && find((f, s) => t.temp < (s.temp?.min ?? -99)),
    co2NoPlant: () => has('co2_kit') && !has('plant') && any,
    weakVitamin: () => (state.inv.food_vitamin || 0) > 0 && find((f, s) => f.health < B.HEALTH.weak && s.vitamin !== 'dislike'),
    tempHigh: () => find((f, s) => t.temp > (s.temp?.max ?? 99)),
    veryDirty: () => t.clean < 20 && any,
    dirty: () => find((f, s) => t.clean < (s.cleanMin ?? 40)),
    noPumpAirLow: () => !has('air_pump') && t.air < 30 && any,
    airLow: () => t.water !== 'salt' && has('air_pump') && t.air < 30 && any,
    airLowSalt: () => t.water === 'salt' && has('air_pump') && t.air < 30 && any,
    saltNoLiverock: () => t.water === 'salt' && !has('liverock') && t.clean < 70 && any,
    unlockNear: () => { if (isUnlocked(state, 'tank6')) return null; const n = (B.UNLOCK.tank6?.count ?? 6) - state.tanks[0].fish.length; return t === state.tanks[0] && n >= 1 && n <= 2 ? any : null; },
    hungry: () => find((f) => f.onaka < 30),
    leftover: () => t.leftover >= 1 && any,
    lonelySchool: () => find((f, s) => s.swim?.school && !t.fish.some((g) => g !== f && g.speciesId === f.speciesId)),
    noLikedDecor: () => find((f, s) => f.mood < 50 && !(s.likes || []).some((tg) => t.decor.some((id) => D.itemById[id]?.tag === tg)) && likeName(f)),
    nigate: () => find((f) => mates(t, f).some((g) => D.compatOf(f.speciesId, g.speciesId) === 0)),
  };
  const weak = t.fish.find((f) => f.health < B.HEALTH.weak);
  const nameOf = (f) => sp(f).name || '';
  const closed = state.hints?.closed || {};
  for (const h of D.HINTS) {
    const fn = checks[h.when?.type];
    if (!fn) continue;
    const f = fn();
    if (!f) continue;
    if ((closed[h.id] ?? -1e9) > state.clock.min) continue;   // とじてから 3時間は 出さない
    const left = (B.UNLOCK.tank6?.count ?? 6) - state.tanks[0].fish.length;
    let text = (h.text || '').replaceAll('{name}', nameOf(f)).replaceAll('{like}', likeName(f)).replaceAll('{n}', String(left));
    if (weak) text = D.TEXT.weakPrefix.replaceAll('{name}', nameOf(weak)) + text;
    return { key: h.id, text, action: h.action, uid: f.uid, kind: 'hint' };
  }
  if (weak) return { key: 'recovering', text: D.TEXT.recovering.replaceAll('{name}', nameOf(weak)), action: null, uid: weak.uid, kind: 'recovering' };
  return null;
}
/** ヒントを とじた（ゲーム3時間 出さない） */
export function closeHint(state, key, hours = 3) {
  if (!key || key === 'recovering') return;
  state.hints ||= { closed: {} };
  state.hints.closed[key] = state.clock.min + hours * 60;
}
/** お店などで つかう ヒントの 文 */
export function hintText(type, name = '') {
  const h = D.HINTS.find((x) => x.when?.type === type || x.id === type);
  return h ? h.text.replaceAll('{name}', name) : '';
}
export const text = (k, name = '') => (D.TEXT[k] || '').replaceAll('{name}', name);

// ---------------- 水槽を ふやす・かいほう ----------------
/** 解放 tank6：1つめの 水槽の 生きもの（1ぴき＝1）が 6 いじょう。いちど ひらいたら もどさない。
 *  ひらいたら state.notices.tank6 = true（画面が 大きな お知らせを 出したら 消す）と events に { type:'unlock', key } */
export function checkUnlock(state, events = []) {
  const U = B.UNLOCK.tank6 || {};
  if (state.unlocks?.tank6) return events;
  const tk = state.tanks[U.tankIndex ?? 0];
  // 6ぴき（1ぴき＝1）または その すいそうが いっぱい（orFull）
  if (tk && (tk.fish.length >= (U.count ?? 6) || (U.orFull && spaceUsed(tk) >= B.TANK.capacity - 1e-9))) {
    state.unlocks = { ...(state.unlocks || {}), tank6: state.daily?.day || 1 };
    state.notices = { ...(state.notices || {}), tank6: true };
    events.push({ type: 'unlock', key: 'tank6' });
  }
  return events;
}

/** あいている わく（0〜5）。なければ -1 */
export function freeSlot(state) {
  for (let k = 0; k < (B.TANKS.max ?? 6); k++) if (!state.tanks.some((t) => t.slot === k)) return k;
  return -1;
}

/** 水槽の なまえ（名前が なければ「みずの すいそう 1」「うみの すいそう」など） */
export function tankName(state, t) {
  if (t.name) return t.name;
  const base = B.WATER_LABELS?.[t.water] || (t.water === 'salt' ? 'うみの すいそう' : 'みずの すいそう');
  const same = state.tanks.filter((x) => x.water === t.water).sort((a, b) => a.slot - b.slot);
  return same.length > 1 ? `${base} ${same.indexOf(t) + 1}` : base;
}

/** あたらしい 水槽を あいている わくに おく */
export function addTank(state, water = 'fresh', includes = []) {
  const slot = freeSlot(state);
  if (slot < 0) return null;
  const N = { temp: 25, clean: 100, air: 70, leftover: 0, ...(B.TANKS.newTank || {}) };
  let k = state.tanks.length + 1;
  while (state.tanks.some((t) => t.id === 't' + k)) k++;
  const t = { id: 't' + k, water, slot, name: '', thermo: B.THERMO.defaultStep || 'normal', feederOn: true, temp: N.temp, clean: N.clean, air: N.air, leftover: N.leftover, decor: includes.filter((id) => D.itemById[id]?.inTank), equip: [], fish: [] };
  t.timers = { idle: 0, sad: 0, sleepy: 0, thanksGap: 99 };
  t.thanksToday = 0;
  state.tanks.push(t);
  return t;
}
export const tankById = (state, id) => state.tanks.find((t) => t.id === id) || state.tanks[0];

// ---------------- ビタミン（仕様 v0.3 3章） ----------------
// vitaminStart → （水槽の eat ごとに）vitaminEat → vitaminEnd。ふつうの えさとは べつの かぞえ。
let vsession = null;
/** ビタミンを おとせるか。{ ok, reason: 'noTool'|'empty'|'doneToday'|'allDislike'|'noFish'|'busy', text } */
export function vitaminStart(state, t = state.tanks[0], now = Date.now()) {
  const L = D.TEXT.VITAMIN_LINES || D.VITAMIN_LINES || {};
  if (!t.fish.length) return { ok: false, reason: 'noFish' };
  if (!((state.inv.food_vitamin || 0) > 0)) return { ok: false, reason: 'empty', text: D.VITAMIN_LINES.empty };
  state.daily.vitamin ||= {};
  if ((state.daily.vitamin[t.id] || 0) >= (B.VITAMIN.perTankPerDay ?? 1)) return { ok: false, reason: 'doneToday', text: D.VITAMIN_LINES.doneToday };
  if (t.fish.every((f) => D.fishById[f.speciesId]?.vitamin === 'dislike')) return { ok: false, reason: 'allDislike', text: D.VITAMIN_LINES.allDislike };
  if (vsession && now < vsession.until) return { ok: false, reason: 'busy' };
  void L;
  state.inv.food_vitamin = Math.max(0, state.inv.food_vitamin - 1);
  state.daily.vitamin[t.id] = (state.daily.vitamin[t.id] || 0) + 1;
  vsession = { tank: t, ate: new Set(), turned: new Set(), love: false, counted: false, until: now + (B.HUNGER.feedLockRealSec ?? 5) * 1000, expire: now + FEED_WINDOW_MS };
  return { ok: true, lockMs: (B.HUNGER.feedLockRealSec ?? 5) * 1000, windowMs: FEED_WINDOW_MS, left: state.inv.food_vitamin };
}
/** ビタミンの eat（その魚の すききらいで きまる）。{ uid, pref, react: [...], line } か null */
export function vitaminEat(state, uid, now = Date.now()) {
  if (!vsession || now > vsession.expire) return null;
  const t = vsession.tank;
  const f = t.fish.find((x) => x.uid === uid);
  if (!f || vsession.ate.has(uid) || vsession.turned.has(uid)) return null;
  const sp = D.fishById[f.speciesId] || {};
  const pref = sp.vitamin || 'ok';
  const E = (B.VITAMIN.effect || {})[pref] || {};
  const firstSeen = !state.vitaminSeen[f.speciesId];
  state.vitaminSeen[f.speciesId] = true;
  if (state.dex[f.speciesId]) state.dex[f.speciesId].vitaminTried = true;
  if (pref === 'dislike') {
    vsession.turned.add(uid);
    return { uid, pref, react: E.react || ['turn'], line: firstSeen ? D.VITAMIN_LINES.dislike.replaceAll('{name}', sp.name || '') : null, events: [] };
  }
  vsession.ate.add(uid);
  const events = [];
  f.health = clamp(f.health + (E.health || 0), B.HEALTH.min, B.HEALTH.max);
  f.mood = clamp(f.mood + (E.mood || 0), 0, 100);
  f.natsuki = clamp(f.natsuki + (E.natsuki || 0), 0, 100);
  f.onaka = Math.min(100, f.onaka + (D.itemById.food_vitamin?.effect?.fill ?? 10));
  if (E.growHours) addGrow(state, f, E.growHours, events);
  if (!vsession.counted) { vsession.counted = true; inc(state, 'vitaminEat'); }
  if (pref === 'love' && !vsession.love) { vsession.love = true; inc(state, 'vitaminLove'); }
  checkMissions(state, events);
  return { uid, pref, react: E.react || ['happy'], line: (pref === 'love' ? D.VITAMIN_LINES.love : D.VITAMIN_LINES.ok).replaceAll('{name}', sp.name || ''), events };
}
export function vitaminEnd(state) {
  const s = vsession; vsession = null;
  if (!s) return null;
  return { ate: [...s.ate], turned: [...s.turned], events: done(state) };
}
export const vitaminBusy = (now = Date.now()) => !!vsession && now < vsession.until;
/** いま ビタミンを まいて いるか（eat を ビタミンとして あつかう） */
export const vitaminActive = (now = Date.now()) => !!vsession && now <= vsession.expire;

/** じどう えさやりの いり／きり */
export function setFeeder(t, on) { t.feederOn = !!on; return t.feederOn; }
