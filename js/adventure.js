// ぼうけん（v0.6 ぼうけん係）：しくみ だけ。画面（DOM）には さわらない（画面は js/ui/adventure.js）。
// - これまでに あつめた ハート（state.heartsTotal）が ADVENTURE.openHearts（300）で ひらく。
//   ひらいた とき：いけの すいそう（sim.addTank(state,'pond')。へやが いっぱいなら そうこ）と ガサガサの あみ を プレゼント。
// - うみ（つり）：はじめて 入ると つりざお。えさ 1こで 1かい。レア度で 出やすさが かわる ガチャ。
// - いけ（ガサガサ）：1日 1かい（ゲームの 1日＝あさ 6:00 で もどる）。
// - 手に入れた 子は いったん state.adventure.catch に のこし（とじても きえない）、入れる すいそうを えらんで placeCatch。
//   入れられる すいそうが ない ときは おやすみすいそう（state.box）へ。
// - 生きものの データは fish.js（図鑑係）の obtain: 'fishing' | 'gasagasa' と rarity を 読むだけ。
// - 行き先を ふやすときは balance.js ADVENTURE.places に 1つ 足し、MODES に しくみを 書く。
import * as sim from './sim.js';

const DEF = {
  openHearts: 300,
  gifts: { pondTank: true, items: ['gasa_net'] },
  pondTankIncludes: ['air_pump'],
  places: [
    { id: 'sea', name: 'うみ', mode: 'fishing', bg: 'assets/adventure/bg_sea.jpg' },
    { id: 'pond', name: 'いけ', mode: 'gasagasa', bg: 'assets/adventure/bg_pond.jpg' },
  ],
  fishing: { obtain: 'fishing', rod: 'fishing_rod', bait: 'bait', firstBait: 3, baitPrice: 100, buyPacks: [1, 5], baitMax: 30, weights: { 1: 46, 2: 28, 3: 16, 4: 7, 5: 3 }, pity: { every: 10, minRarity: 4 } },
  gasagasa: { obtain: 'gasagasa', net: 'gasa_net', perDay: 1, weights: { 1: 36, 2: 28, 3: 21, 4: 10, 5: 5 }, pity: { every: 7, minRarity: 4 } },
  fishingAnim: { cast: 700, wait: [1300, 2000], bite: 1600, reel: 800, rareExtra: 900 },
  gasaAnim: { sweep: 2100, lift: 700, rareExtra: 900 },
};

let RAW = null;     // balance.js の ADVENTURE（setBalance で 入れる。無ければ DEF）
/** balance.js の ADVENTURE を わたす（main・テスト）。sim.balance() に ADVENTURE が あれば そちらが つかわれる */
export function setBalance(adv) { RAW = adv || null; }

function merge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], over[k]) : over[k];
  return out;
}
/** いまの 数値（balance.js ADVENTURE ＞ DEF） */
export function rules() { return merge(DEF, RAW || sim.balance()?.ADVENTURE || {}); }

const D = () => sim.data();
const today = (state) => sim.gameDay(state.clock.min);
const inc = (state, k, n = 1) => { state.stats[k] = (state.stats[k] || 0) + n; };

// ---------------- 形 ----------------
/** state.adventure を そろえる（古い セーブにも ある ように）。なんど よんでも よい */
export function norm(state) {
  const a = (state.adventure && typeof state.adventure === 'object' && !Array.isArray(state.adventure)) ? state.adventure : {};
  state.adventure = {
    opened: Number.isFinite(a.opened) ? a.opened : 0,        // ひらいた ゲームの 日（0＝まだ）
    gifted: !!a.gifted,                                       // ひらいた ときの プレゼントを わたした
    pondPending: !!a.pondPending,                             // いけの すいそうを まだ わたせて いない（すいそうの 上限）
    seaIntro: Number.isFinite(a.seaIntro) ? a.seaIntro : 0,   // うみの あんない（0 まだ・1 つりざお・2 えさを もらった）
    baitGift: !!a.baitGift,                                   // はじめての えさ 3こ を もらった
    gasaDay: Number.isFinite(a.gasaDay) ? a.gasaDay : 0,      // さいごに ガサガサした ゲームの 日
    gasaToday: Number.isFinite(a.gasaToday) ? a.gasaToday : 0,
    pity: { fishing: 0, gasagasa: 0, ...(a.pity && typeof a.pity === 'object' ? a.pity : {}) },   // ★4いじょうが 出ていない かいすう
    caught: { fishing: 0, gasagasa: 0, ...(a.caught && typeof a.caught === 'object' ? a.caught : {}) },
    catch: a.catch && typeof a.catch === 'object' && a.catch.fish && typeof a.catch.fish.speciesId === 'string' ? a.catch : null,   // まだ 入れていない 子
    seen: !!a.seen,                                           // ひらいてから ぼうけん画面を 見た（へやの ボタンの キラキラ）
  };
  // しらない 水の すいそうは かわに（あたらしい 版の セーブを 古い 版で ひらいた とき など）
  for (const t of (state.tanks || []).concat(state.storage || [])) if (sim.waterOk && !sim.waterOk(t.water)) t.water = 'fresh';
  state.inv ||= {};
  state.stats ||= {};
  state.unlocks ||= {};
  state.notices ||= {};
  if (state.adventure.catch && !D()?.fishById?.[state.adventure.catch.fish.speciesId]) state.adventure.catch = null;
  return state.adventure;
}

// ---------------- ひらく ----------------
export const isOpen = (state) => !!state.unlocks?.adventure;
/** ロックの ボタンに 出す：{ now, need, left } */
export function progress(state) {
  const need = rules().openHearts;
  const now = Math.max(0, Math.floor(state.heartsTotal || 0));
  return { now: Math.min(now, need), need, left: Math.max(0, need - now) };
}

/**
 * heartsTotal が 300 に なったら ひらく。ひらいた とき events に { type:'unlock', key:'adventure' }、
 * state.notices.adventure = true（画面が おいわいを 出したら 消す）。プレゼントも ここで わたす。
 * チュートリアル中は ひらかない。
 */
export function checkOpen(state, events = []) {
  norm(state);
  if (!isOpen(state)) {
    if (!state.tutorial?.done) return events;
    if ((state.heartsTotal || 0) < rules().openHearts) return events;
    state.unlocks = { ...state.unlocks, adventure: state.daily?.day || today(state) };
    state.adventure.opened = state.unlocks.adventure;
    state.stats.adventureOpen = 1;
    state.notices = { ...state.notices, adventure: true };
    events.push({ type: 'unlock', key: 'adventure' });
  }
  if (!state.adventure.gifted || state.adventure.pondPending) giveGifts(state, events);
  return events;
}

/** ひらいた ときの プレゼント（いけの すいそう・あみ）。いけの すいそうが おけなかったら あとで もういちど */
function giveGifts(state, events) {
  const R = rules();
  const a = state.adventure;
  if (!a.gifted) {
    for (const id of R.gifts.items || []) { state.inv[id] = Math.max(1, state.inv[id] || 0); state.owned[id] = true; }
    a.gifted = true;
    a.pondPending = !!R.gifts.pondTank;
  }
  if (a.pondPending) {
    const t = sim.addTank(state, 'pond', R.pondTankIncludes || []);
    if (t) {
      a.pondPending = false;
      state.owned.tank_pond = true;
      events.push({ type: 'gift', key: 'pondTank', tankId: t.id, stored: !!t.stored });
    }
  }
  return events;
}

// ---------------- 生きもの ----------------
/** その やりかたで 手に入る 生きもの（fish.js の obtain） */
export function pool(mode) {
  const R = rules();
  const ob = R[mode]?.obtain || mode;
  return (D()?.FISH || []).filter((f) => f.obtain === ob);
}

/** レア度ごとの 出やすさ（%。その レア度の しゅるいが ない ところは 0 に して わりなおす）。minRarity で てんじょう */
export function rarityOdds(mode, minRarity = 1) {
  const W = rules()[mode]?.weights || {};
  const have = new Set(pool(mode).map((f) => f.rarity || 1));
  const raw = {};
  let sum = 0;
  for (let r = 1; r <= 5; r++) { const w = r >= minRarity && have.has(r) ? Math.max(0, W[r] || 0) : 0; raw[r] = w; sum += w; }
  // てんじょうで ★4いじょうが いない とき・重みが ぜんぶ 0 の ときは ある レア度で わる
  if (!sum) { for (const r of have) if (r >= minRarity || !sum) { raw[r] = 1; sum += 1; } }
  if (!sum) for (const r of have) { raw[r] = 1; sum += 1; }
  const out = {};
  for (let r = 1; r <= 5; r++) out[r] = sum ? raw[r] / sum : 0;
  return out;
}

/** 1ぴき えらぶ（レア度 → その中で おなじ 出やすさ）。{ spec, rarity, pity } */
export function roll(state, mode, rnd = Math.random) {
  norm(state);
  const R = rules()[mode] || {};
  const list = pool(mode);
  if (!list.length) return null;
  const P = R.pity || {};
  const pity = P.every > 0 && (state.adventure.pity[mode] || 0) >= P.every - 1;
  const odds = rarityOdds(mode, pity ? P.minRarity || 4 : 1);
  let x = rnd(), rar = 0;
  for (let r = 1; r <= 5; r++) { if (odds[r] <= 0) continue; rar = r; if (x < odds[r]) break; x -= odds[r]; }
  const tier = list.filter((f) => (f.rarity || 1) === rar);
  const spec = tier[Math.floor(rnd() * tier.length) % tier.length] || list[0];
  return { spec, rarity: spec.rarity || 1, pity };
}

function afterRoll(state, mode, got) {
  const P = rules()[mode]?.pity || {};
  state.adventure.pity[mode] = (got.rarity >= (P.minRarity || 4)) ? 0 : (state.adventure.pity[mode] || 0) + 1;
  state.adventure.caught[mode] = (state.adventure.caught[mode] || 0) + 1;
}

/** 手に入れた 子を つくって まつ（state.adventure.catch）。ずかんにも のせる */
function takeCatch(state, mode, rnd) {
  const got = roll(state, mode, rnd);
  if (!got) return { ok: false, reason: 'none' };
  afterRoll(state, mode, got);
  const f = sim.createFish(state, got.spec.id, { source: mode, rnd });
  const first = sim.addDex(state, f);
  state.adventure.catch = { mode, fish: f, first, day: today(state) };
  const events = [];
  sim.checkMissions(state, events);
  return { ok: true, fish: f, spec: got.spec, rarity: got.rarity, first, pity: got.pity, events };
}

// ---------------- うみ（つり） ----------------
/** うみに 入った。はじめてなら つりざおを わたす。{ gotRod } */
export function enterSea(state) {
  norm(state);
  const F = rules().fishing;
  if (!isOpen(state)) return { ok: false, reason: 'closed' };
  let gotRod = false;
  if (!state.inv[F.rod]) { state.inv[F.rod] = 1; state.owned[F.rod] = true; gotRod = true; }
  if (state.adventure.seaIntro < 1) state.adventure.seaIntro = 1;
  return { ok: true, gotRod };
}
export const bait = (state) => Math.max(0, Math.floor(state.inv?.[rules().fishing.bait] || 0));

/** はじめての えさ（3こ）。いちどだけ */
export function claimFirstBait(state) {
  norm(state);
  const F = rules().fishing;
  if (state.adventure.baitGift) return { ok: false, reason: 'done' };
  state.adventure.baitGift = true;
  state.adventure.seaIntro = 2;
  state.inv[F.bait] = Math.min(F.baitMax ?? 999, bait(state) + (F.firstBait ?? 3));
  state.owned[F.bait] = true;
  return { ok: true, n: F.firstBait ?? 3, bait: bait(state) };
}

/** えさが かえるか。{ ok, reason: 'gift'|'max'|'coins', price, room } */
export function canBuyBait(state, n = 1) {
  norm(state);
  const F = rules().fishing;
  const price = (F.baitPrice ?? 100) * n;
  if (!state.adventure.baitGift) return { ok: false, reason: 'gift', price };
  const room = (F.baitMax ?? 999) - bait(state);
  if (n > room) return { ok: false, reason: 'max', price, room };
  if (state.coins < price) return { ok: false, reason: 'coins', price, need: price - state.coins };
  return { ok: true, price };
}
export function buyBait(state, n = 1) {
  const c = canBuyBait(state, n);
  if (!c.ok) return c;
  const F = rules().fishing;
  state.coins -= c.price;
  state.inv[F.bait] = bait(state) + n;
  state.owned[F.bait] = true;
  inc(state, 'buyBait', n);
  return { ok: true, price: c.price, bait: bait(state), events: sim.checkMissions(state, []) };
}

/** つれるか。{ ok, reason: 'closed'|'noRod'|'noBait'|'pending'|'none' } */
export function canFish(state) {
  norm(state);
  const F = rules().fishing;
  if (!isOpen(state)) return { ok: false, reason: 'closed' };
  if (!state.inv[F.rod]) return { ok: false, reason: 'noRod' };
  if (state.adventure.catch) return { ok: false, reason: 'pending' };
  if (!pool('fishing').length) return { ok: false, reason: 'none' };
  if (bait(state) < 1) return { ok: false, reason: 'noBait' };
  return { ok: true };
}
/** つる（えさ 1こ）。けっかは すぐ きまり、画面は 演出の あとで 見せる */
export function fish(state, rnd = Math.random) {
  const c = canFish(state);
  if (!c.ok) return c;
  const F = rules().fishing;
  state.inv[F.bait] = bait(state) - 1;
  inc(state, 'fishing');
  return takeCatch(state, 'fishing', rnd);
}

// ---------------- いけ（ガサガサ） ----------------
/** きょう あと なんかい できるか */
export function gasaLeft(state) {
  norm(state);
  const per = rules().gasagasa.perDay ?? 1;
  return state.adventure.gasaDay === today(state) ? Math.max(0, per - (state.adventure.gasaToday || 0)) : per;
}
/** { ok, reason: 'closed'|'noNet'|'done'|'pending'|'none' } */
export function canGasa(state) {
  norm(state);
  const G = rules().gasagasa;
  if (!isOpen(state)) return { ok: false, reason: 'closed' };
  if (!state.inv[G.net]) return { ok: false, reason: 'noNet' };
  if (state.adventure.catch) return { ok: false, reason: 'pending' };
  if (!pool('gasagasa').length) return { ok: false, reason: 'none' };
  if (gasaLeft(state) < 1) return { ok: false, reason: 'done' };
  return { ok: true };
}
export function gasagasa(state, rnd = Math.random) {
  const c = canGasa(state);
  if (!c.ok) return c;
  const d = today(state);
  if (state.adventure.gasaDay !== d) { state.adventure.gasaDay = d; state.adventure.gasaToday = 0; }
  state.adventure.gasaToday++;
  inc(state, 'gasagasa');
  return takeCatch(state, 'gasagasa', rnd);
}
/** つぎに ガサガサ できる までの ゲームの ふん（あさ 6:00） */
export function minutesToNextDay(state) {
  const start = sim.dayStartMin();
  const m = state.clock.min - start;
  return Math.max(1, Math.ceil((Math.floor(m / 1440) + 1) * 1440 - m));
}

// ---------------- 入れる ----------------
const isSnail = (sp) => sp?.kind === 'snail';
/** その すいそうに 入れられるか（おみせ・おやすみすいそうと おなじ きまり）。{ ok, reason: 'water'|'full'|'snailFull'|'needs', item } */
export function canPut(state, t, speciesId) {
  const sp = D().fishById[speciesId];
  const B = sim.balance();
  if (!t || !sp) return { ok: false, reason: 'none' };
  if (sp.water !== t.water) return { ok: false, reason: 'water' };
  if (isSnail(sp)) {
    if (sim.snailCount(t) >= (B.TANK.snailMax ?? 2)) return { ok: false, reason: 'snailFull' };
  } else if (sim.spaceUsed(t) + (sp.space ?? 1) > B.TANK.capacity + 1e-9 || (t.fish.length - sim.snailCount(t)) >= (B.TANK.fishMax ?? 1e9)) return { ok: false, reason: 'full' };
  const need = (sp.needs || []).find((id) => !t.decor.includes(id));
  if (need) return { ok: false, reason: 'needs', item: need };
  return { ok: true };
}
/** まっている 子を 入れられる へやの すいそう（わくの じゅん）：[{ tank, ok, reason }]。おなじ 水の ものだけ */
export function catchTargets(state) {
  const c = state.adventure?.catch;
  if (!c) return [];
  const sp = D().fishById[c.fish.speciesId];
  return state.tanks.filter((t) => t.water === sp?.water).sort((a, b) => a.slot - b.slot).map((t) => ({ tank: t, ...canPut(state, t, c.fish.speciesId) }));
}
/**
 * まっている 子を 入れる。to＝すいそうの id か 'box'（おやすみすいそう）。
 * 入れられない すいそうを えらんだら おやすみすいそうへ。{ ok, where: 'tank'|'box', tank, fish, events }
 */
export function placeCatch(state, to = 'box') {
  norm(state);
  const c = state.adventure.catch;
  if (!c) return { ok: false, reason: 'none' };
  const f = c.fish;
  const t = to !== 'box' ? state.tanks.find((x) => x.id === to) : null;
  const events = [];
  let where = 'box';
  if (t && canPut(state, t, f.speciesId).ok) {
    t.fish.push(f);
    where = 'tank';
    if (sim.fixThermo?.(t)) events.push({ type: 'thermoReset', tankId: t.id });
  } else {
    f.boxedAt = state.clock.min;
    (state.box ||= []).push(f);
  }
  state.adventure.catch = null;
  sim.checkUnlock(state, events);
  sim.checkMissions(state, events);
  return { ok: true, where, tank: where === 'tank' ? t : null, fish: f, events };
}

// ---------------- 画面の ための まとめ ----------------
/** 行き先（balance.js ADVENTURE.places） */
export const places = () => rules().places || [];
/** へやの ぼうけんボタンに 出す しるし：'new'（まだ 見ていない）| 'gasa'（きょうの ガサガサが まだ）| 'catch'（まっている 子）| null */
export function badge(state) {
  if (!isOpen(state)) return null;
  norm(state);
  if (state.adventure.catch) return 'catch';
  if (!state.adventure.seen) return 'new';
  if (canGasa(state).ok) return 'gasa';
  return null;
}
