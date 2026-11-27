// ぼうけん（v0.6 ぼうけん係）：しくみ だけ。画面（DOM）には さわらない（画面は js/ui/adventure.js）。
// - これまでに あつめた ハート（state.heartsTotal）が ADVENTURE.openHearts（300）で ひらく。
//   ひらいた とき：いけの すいそう（sim.addTank(state,'pond')。へやが いっぱいなら そうこ）と ガサガサの あみ を プレゼント。
// - うみ（つり）：はじめて 入ると つりざお。えさ 1こで 1かい。レア度で 出やすさが かわる ガチャ。
//   v0.10：えさは ふつう（100）と キラキラ えさ（500・★3いじょう・★4〜5 が でやすい）。つる ときに えらぶ。
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
  fishing: {
    obtain: 'fishing', rod: 'fishing_rod', bait: 'bait', firstBait: 3, baitPrice: 100, buyPacks: [1, 5], baitMax: 30, weights: { 1: 46, 2: 28, 3: 16, 4: 7, 5: 3 }, pity: { every: 10, minRarity: 4 },
    // v0.10 ごうかな えさ（つり係）。くわしい 数は balance.js ADVENTURE.fishing.premium
    premium: { bait: 'bait_gold', price: 500, buyPacks: [1], max: 10, firstGift: 1, weights: { 1: 0, 2: 0, 3: 55, 4: 32, 5: 13 }, pityStep: 1 },
  },
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
    premiumGift: !!a.premiumGift,                             // v0.10 キラキラ えさの おためし 1こ を もらった
    gasaDay: Number.isFinite(a.gasaDay) ? a.gasaDay : 0,      // さいごに ガサガサした ゲームの 日
    gasaToday: Number.isFinite(a.gasaToday) ? a.gasaToday : 0,
    pity: { fishing: 0, gasagasa: 0, ...(a.pity && typeof a.pity === 'object' ? a.pity : {}) },   // ★4いじょうが 出ていない かいすう
    caught: { fishing: 0, gasagasa: 0, ...(a.caught && typeof a.caught === 'object' ? a.caught : {}) },
    catch: a.catch && typeof a.catch === 'object' && a.catch.fish && typeof a.catch.fish.speciesId === 'string' ? a.catch : null,   // まだ 入れていない 子
    seen: !!a.seen,                                           // ひらいてから ぼうけん画面を 見た（へやの ボタンの キラキラ）
    useBait: a.useBait === 'premium' ? 'premium' : 'normal',  // v0.10 さいごに えらんだ えさ（'normal'｜'premium'）。古い セーブは ふつう
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
export function rarityOdds(mode, minRarity = 1, weights = null) {
  const W = weights || rules()[mode]?.weights || {};
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

/**
 * 1ぴき えらぶ（レア度 → その中で おなじ 出やすさ）。{ spec, rarity, pity }
 * opts.weights：レア度の おもみを かえる（ごうかな えさ）。てんじょうの ときも その おもみの ★4いじょうで わける
 */
export function roll(state, mode, rnd = Math.random, opts = {}) {
  norm(state);
  const R = rules()[mode] || {};
  const list = pool(mode);
  if (!list.length) return null;
  const P = R.pity || {};
  const pity = P.every > 0 && (state.adventure.pity[mode] || 0) >= P.every - 1;
  const odds = rarityOdds(mode, pity ? P.minRarity || 4 : 1, opts.weights || null);
  let x = rnd(), rar = 0;
  for (let r = 1; r <= 5; r++) { if (odds[r] <= 0) continue; rar = r; if (x < odds[r]) break; x -= odds[r]; }
  const tier = list.filter((f) => (f.rarity || 1) === rar);
  const spec = tier[Math.floor(rnd() * tier.length) % tier.length] || list[0];
  return { spec, rarity: spec.rarity || 1, pity };
}

function afterRoll(state, mode, got, step = 1) {
  const P = rules()[mode]?.pity || {};
  state.adventure.pity[mode] = (got.rarity >= (P.minRarity || 4)) ? 0 : (state.adventure.pity[mode] || 0) + step;
  state.adventure.caught[mode] = (state.adventure.caught[mode] || 0) + 1;
}

/** 手に入れた 子を つくって まつ（state.adventure.catch）。ずかんにも のせる。opts：{ weights, pityStep, bait } */
function takeCatch(state, mode, rnd, opts = {}) {
  const got = roll(state, mode, rnd, opts);
  if (!got) return { ok: false, reason: 'none' };
  afterRoll(state, mode, got, opts.pityStep ?? 1);
  const f = sim.createFish(state, got.spec.id, { source: mode, rnd });
  const first = sim.addDex(state, f);
  state.adventure.catch = { mode, fish: f, first, day: today(state), ...(opts.bait ? { bait: opts.bait } : {}) };
  const events = [];
  sim.checkMissions(state, events);
  return { ok: true, fish: f, spec: got.spec, rarity: got.rarity, first, pity: got.pity, bait: opts.bait || null, events };
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
// えさは 2しゅるい：'normal'（つりえさ・inv.bait）と 'premium'（v0.10 ごうかな えさ・inv.bait_gold）。
// ごうかな えさは レア度の おもみが かわる だけ（てんじょうは おなじ カウンタ）。古い セーブの inv.bait は そのまま。
/** えさの きまり：{ kind, id, price, packs, max, weights（null＝ふつう）, pityStep } */
export function baitRule(kind = 'normal') {
  const F = rules().fishing;
  if (kind === 'premium') {
    const P = F.premium || {};
    return { kind, id: P.bait || 'bait_gold', price: P.price ?? 500, packs: P.buyPacks || [1], max: P.max ?? 10, weights: P.weights || null, pityStep: P.pityStep ?? 1 };
  }
  return { kind: 'normal', id: F.bait, price: F.baitPrice ?? 100, packs: F.buyPacks || [1], max: F.baitMax ?? 999, weights: null, pityStep: 1 };
}
export const BAIT_KINDS = ['normal', 'premium'];
/** もっている えさの かず（kind：'normal'｜'premium'） */
export const bait = (state, kind = 'normal') => Math.max(0, Math.floor(state.inv?.[baitRule(kind).id] || 0));
/** いま つかう えさ。ごうかが 0 なら ふつう */
export function chosenBait(state) {
  norm(state);
  return state.adventure.useBait === 'premium' && bait(state, 'premium') > 0 ? 'premium' : 'normal';
}
/** つかう えさを えらぶ。もっていない ごうかは えらべない。{ ok, kind, reason: 'none' } */
export function setBait(state, kind) {
  norm(state);
  const k = kind === 'premium' ? 'premium' : 'normal';
  if (k === 'premium' && bait(state, 'premium') < 1) return { ok: false, reason: 'none', kind: chosenBait(state) };
  state.adventure.useBait = k;
  return { ok: true, kind: k };
}

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

/** キラキラ えさの おためし（1こ）。ふつうの えさの プレゼントを もらった あと、いちどだけ。古い セーブでも 1かい もらえる */
export function canClaimPremiumGift(state) {
  norm(state);
  return !!state.adventure.baitGift && !state.adventure.premiumGift && (rules().fishing.premium?.firstGift ?? 1) > 0;
}
export function claimPremiumGift(state) {
  if (!canClaimPremiumGift(state)) return { ok: false, reason: state.adventure.baitGift ? 'done' : 'gift' };
  const B = baitRule('premium');
  const n = rules().fishing.premium?.firstGift ?? 1;
  state.adventure.premiumGift = true;
  state.inv[B.id] = Math.min(B.max, bait(state, 'premium') + n);
  state.owned[B.id] = true;
  return { ok: true, n, bait: bait(state, 'premium') };
}

/** えさが かえるか。kind：'normal'｜'premium'。{ ok, reason: 'gift'|'max'|'coins', price, room, kind } */
export function canBuyBait(state, n = 1, kind = 'normal') {
  norm(state);
  const B = baitRule(kind);
  const price = B.price * n;
  if (!state.adventure.baitGift) return { ok: false, reason: 'gift', price, kind: B.kind };
  const room = B.max - bait(state, B.kind);
  if (n > room) return { ok: false, reason: 'max', price, room, kind: B.kind };
  if (state.coins < price) return { ok: false, reason: 'coins', price, need: price - state.coins, kind: B.kind };
  return { ok: true, price, kind: B.kind };
}
/** えさを かう。ごうかを かったら つかう えさも ごうかに する（かった ときに えらぶ 気もちが ある） */
export function buyBait(state, n = 1, kind = 'normal') {
  const c = canBuyBait(state, n, kind);
  if (!c.ok) return c;
  const B = baitRule(kind);
  state.coins -= c.price;
  state.inv[B.id] = bait(state, B.kind) + n;
  state.owned[B.id] = true;
  inc(state, 'buyBait', n);
  if (B.kind === 'premium') { inc(state, 'buyBaitPremium', n); state.adventure.useBait = 'premium'; }
  return { ok: true, price: c.price, kind: B.kind, bait: bait(state, B.kind), events: sim.checkMissions(state, []) };
}

/** つぎの 1かいが てんじょう（★4いじょう かくてい）か。画面で「つぎは ほし 4いじょう！」を 出す */
export function pityNext(state, mode = 'fishing') {
  norm(state);
  const P = rules()[mode]?.pity || {};
  return P.every > 0 && (state.adventure.pity[mode] || 0) >= P.every - 1;
}

/** つれるか。kind を わたさなければ いま えらんでいる えさ。{ ok, kind, reason: 'closed'|'noRod'|'noBait'|'pending'|'none' } */
export function canFish(state, kind = null) {
  norm(state);
  const F = rules().fishing;
  const k = kind === 'premium' || kind === 'normal' ? kind : chosenBait(state);
  if (!isOpen(state)) return { ok: false, reason: 'closed', kind: k };
  if (!state.inv[F.rod]) return { ok: false, reason: 'noRod', kind: k };
  if (state.adventure.catch) return { ok: false, reason: 'pending', kind: k };
  if (!pool('fishing').length) return { ok: false, reason: 'none', kind: k };
  if (bait(state, k) < 1) return { ok: false, reason: 'noBait', kind: k };
  return { ok: true, kind: k };
}
/**
 * つる（えさ 1こ）。けっかは すぐ きまり、画面は 演出の あとで 見せる。
 * kind：'normal'｜'premium'（わたさなければ いま えらんでいる えさ）。ごうかが 0 に なったら ふつうに もどす
 */
export function fish(state, rnd = Math.random, kind = null) {
  const c = canFish(state, kind);
  if (!c.ok) return c;
  const B = baitRule(c.kind);
  state.inv[B.id] = bait(state, B.kind) - 1;
  inc(state, 'fishing');
  if (B.kind === 'premium') inc(state, 'fishingPremium');
  const back = B.kind === 'premium' && bait(state, 'premium') < 1;
  if (back) state.adventure.useBait = 'normal';
  const r = takeCatch(state, 'fishing', rnd, B.kind === 'premium' ? { weights: B.weights, pityStep: B.pityStep, bait: 'premium' } : {});
  if (r.ok) r.backToNormal = back;
  return r;
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
