// v0.7 課金係：とくべつ コーナー（アプリ内購入）の しくみ。
//
// 2026-11-17 本人が「お試しで 小規模な 課金」を 決めた（docs/要項.md）。ただし **ほんとうに お金を うけとる 方法は 未定**。
// だから ここは「しくみ」だけ：
//   - プロバイダ（決済の 入口）を 1か所で 差しかえる。いまは 'none'（公開版。買えない・「もうすぐ」）と 'test'（URL に ?iaptest。にせの 購入・お金は 動かない）。
//     あとで App Store（Capacitor の StoreKit プラグイン など）や Web 決済を registerProvider() で 足す。
//   - getProducts(state)・purchase(state, productId, opts)・restore(state) が 画面（js/ui/premium.js）から よばれる 入口。
//   - 1しゅるい 1かい だけ（非消耗型）。買った きろくは state.iap に のこり、セーブを けしても restore() で もどせる（ストアの きろくが ある とき）。
//   - こども向け：買う まえに おうちの ひとの かくにん（かけ算）を とおらないと purchase() は うごかない（gateToken）。
//   - 通信は しない（'test' は 端末の 中だけ）。ほんものの プロバイダを 足すときは 要項の「通信しない」と あわせて 本人が きめる。
//
// ねだんを かえるときは PRODUCTS の yen だけ（画面の「160えん」も ここから 作る）。
// ストアに 出すときは、ストア側の ねだんと ここの yen を かならず そろえる（ほんものは ストアの ねだんを 出す）。
import * as sim from './sim.js';

/** 売りもの（1か所）。id は ストアの 商品ID に そのまま つかう よてい。speciesId は js/data/fish.js の obtain: 'premium' の 子 */
export const PRODUCTS = [
  { id: 'premium.gold_goldfish', speciesId: 'gold_goldfish', yen: 160 },
  { id: 'premium.albino_suppon', speciesId: 'albino_suppon', yen: 160 },   // 金額は 本人 未指定。いったん 160
  { id: 'premium.blue_zarigani', speciesId: 'blue_zarigani', yen: 160 },   // 金額は 本人 未指定。いったん 160
];
export const productById = (id) => PRODUCTS.find((p) => p.id === id) || null;
export const productOfSpecies = (speciesId) => PRODUCTS.find((p) => p.speciesId === speciesId) || null;
export const yenLabel = (yen) => `${yen}えん`;

// ---------------- プロバイダ ----------------
// { id, available: bool, purchase(productId) → Promise<{ ok, tx?, reason? }>, restore() → Promise<{ ok, items: [{ productId, tx }] }> }
const NONE = {
  id: 'none', available: false,
  async purchase() { return { ok: false, reason: 'unavailable' }; },
  async restore() { return { ok: false, reason: 'unavailable', items: [] }; },
};

/**
 * テスト用（?iaptest）：お金は 動かない。「ストアの きろく」を 端末の localStorage（store を わたせば そこ）に もつので、
 * セーブを けしても restore() で もどる ことを ためせる。fail: 'cancel' | 'error' を わたすと つぎの 1かいを しっぱい させる。
 */
export function createTestProvider({ store = null, delayMs = 400 } = {}) {
  const KEY = 'osakana-room-iaptest-store';
  const mem = store || {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* なし */ } },
  };
  let failNext = null;
  return {
    id: 'test', available: true, test: true,
    failNext(kind = 'cancel') { failNext = kind; },
    async purchase(productId) {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      if (failNext) { const reason = failNext; failNext = null; return { ok: false, reason }; }
      const list = mem.get();
      const had = list.find((x) => x.productId === productId);
      if (had) return { ok: true, tx: had.tx, productId };                 // ストアでも 非消耗型は 2かい 買えない（前の きろくを かえす）
      const tx = 'test-' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
      list.push({ productId, tx, at: Date.now() });
      mem.set(list);
      return { ok: true, tx, productId };
    },
    async restore() {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      return { ok: true, items: mem.get().map((x) => ({ productId: x.productId, tx: x.tx })) };
    },
  };
}

const FACTORY = { none: () => NONE, test: () => createTestProvider() };
let provider = NONE;

/** あとで 'appstore' や 'web' を 足す 入口 */
export function registerProvider(name, factory) { FACTORY[name] = factory; }
export function setProvider(p) { provider = typeof p === 'string' ? (FACTORY[p] || FACTORY.none)() : (p || NONE); return provider; }
export const providerId = () => provider.id;
export const isAvailable = () => !!provider.available;
export const isTest = () => !!provider.test;

/**
 * 起動の とき（main.js）：URL に ?iaptest が ある ときだけ テスト。ほかは 'none'（公開版では 買えない）。
 * テストは パソコンでの 確認（localhost・127.0.0.1・ファイル）だけ。公開ページ（github.io）で ?iaptest を つけても テストに ならない（タダで 手に 入る 道に しない）。
 */
export function initIap({ search = '', host = 'localhost' } = {}) {
  const q = new URLSearchParams(search);
  const local = host === '' || host === 'localhost' || host === '127.0.0.1';
  return setProvider(q.has('iaptest') && local ? 'test' : 'none');
}

// ---------------- セーブの 形 ----------------
// state.iap = { owned: { [productId]: { tx, at, uid, speciesId, test } }, log: [{ productId, tx, at, kind }] }
export function norm(state) {
  const s = state.iap && typeof state.iap === 'object' && !Array.isArray(state.iap) ? state.iap : {};
  const owned = {};
  for (const [k, v] of Object.entries(s.owned && typeof s.owned === 'object' ? s.owned : {})) {
    if (v && typeof v === 'object' && typeof v.tx === 'string') owned[k] = v;   // しらない 商品でも けさない（あとの 版で もどる かも）
  }
  state.iap = { owned, log: Array.isArray(s.log) ? s.log.filter((x) => x && typeof x === 'object').slice(-50) : [] };
  return state.iap;
}
export const owns = (state, productId) => !!state.iap?.owned?.[productId];

// ---------------- 保護者の かくにん（ペアレンタル ゲート） ----------------
// かけ算を すうじの ボタンで 入れる（画面に 商品の なまえ・ねだん・1かいきり も 出す）。とおったら 1かいだけ つかえる gateToken（2ふんで きれる）。
const tokens = new Map();   // token → きれる 時刻（ms）。セーブには 入れない
export const GATE_TTL_MS = 120000;
// v0.7 点検で かえた：九九（6〜9 × 6〜9）だと 小学生が とけて しまう（Codex・agy）→ 2けた×1けた（12〜19 × 3〜9、こたえ 36〜171）
export function makeGate(rnd = Math.random) {
  const a = 12 + Math.floor(rnd() * 8), b = 3 + Math.floor(rnd() * 7);
  return { a, b, answer: a * b };
}
/** こたえが あえば token（文字列）、ちがえば null */
export function passGate(gate, input, now = Date.now()) {
  if (!gate || String(input).trim() !== String(gate.answer)) return null;
  const token = 'g' + now.toString(36) + Math.floor(Math.random() * 1e9).toString(36);
  tokens.set(token, now + GATE_TTL_MS);
  return token;
}
function useToken(token, now) {
  const until = tokens.get(token);
  tokens.delete(token);
  return !!until && now <= until;
}

// ---------------- 画面の ための まとめ ----------------
/**
 * 売りもの いちらん：[{ ...product, spec, priceLabel, owned, state: 'soon'|'owned'|'needTank'|'ok' }]
 * needTank：その 水の すいそうを まだ もっていない（いけの すいそうは ぼうけんの あと）→ 買えない
 */
export function getProducts(state) {
  norm(state);
  const D = sim.data();
  return PRODUCTS.map((p) => {
    const spec = D.fishById[p.speciesId] || null;
    const owned = owns(state, p.id);
    let st = 'ok';
    if (owned) st = 'owned';
    else if (!isAvailable()) st = 'soon';
    else if (spec && !hasWaterTank(state, spec.water)) st = 'needTank';
    return { ...p, spec, priceLabel: yenLabel(p.yen), owned, state: st };
  });
}
/** その 水の すいそうを もっているか（へや か そうこ） */
export const hasWaterTank = (state, water) => state.tanks.concat(state.storage || []).some((t) => t.water === water);

let busy = false;
export const isBusy = () => busy;

/**
 * 買う。opts.gateToken（passGate の もどり）が ないと うごかない。opts.tankId：入れたい すいそう（水が あえば そこ）。
 * { ok, reason: 'unavailable'|'notFound'|'owned'|'needTank'|'gate'|'busy'|'cancel'|'error', fish, where, tank, first, events }
 * なかで ストア（プロバイダ）を よび、成功したら grant() で 生きものを わたす。よびだした がわが すぐ セーブする。
 */
export async function purchase(state, productId, { gateToken, tankId, now = Date.now() } = {}) {
  norm(state);
  const p = productById(productId);
  if (!p) return { ok: false, reason: 'notFound' };
  if (!isAvailable()) return { ok: false, reason: 'unavailable' };
  if (owns(state, productId)) return { ok: false, reason: 'owned' };
  const spec = sim.data().fishById[p.speciesId];
  if (!spec) return { ok: false, reason: 'notFound' };
  if (!hasWaterTank(state, spec.water)) return { ok: false, reason: 'needTank' };
  if (busy) return { ok: false, reason: 'busy' };
  if (!useToken(gateToken, now)) return { ok: false, reason: 'gate' };
  busy = true;
  try {
    let r;
    try { r = await provider.purchase(productId); } catch (e) { r = { ok: false, reason: 'error' }; }
    if (!r || !r.ok) return { ok: false, reason: r?.reason === 'cancel' ? 'cancel' : (r?.reason || 'error') };
    return grant(state, productId, r.tx, { tankId, kind: 'buy' });
  } finally { busy = false; }
}

/**
 * 買った ものを わたす（ストアの 取引 tx ごとに 1かいだけ）。restore からも よぶ。
 * 水の あう へやの すいそう（tankId を さいしょに）で 入れられる ところ → なければ おやすみすいそう。
 * おかねを はらった 子なので おやすみすいそうの 上限でも すてない。
 */
export function grant(state, productId, tx, { tankId, kind = 'buy' } = {}) {
  norm(state);
  const p = productById(productId);
  if (!p || typeof tx !== 'string' || !tx) return { ok: false, reason: 'notFound' };
  if (owns(state, productId)) return { ok: true, already: true, productId };
  const D = sim.data();
  const spec = D.fishById[p.speciesId];
  if (!spec) return { ok: false, reason: 'notFound' };
  const f = sim.createFish(state, p.speciesId, { source: 'premium' });
  const order = state.tanks.filter((t) => t.water === spec.water).sort((a, b) => (a.id === tankId ? -1 : b.id === tankId ? 1 : a.slot - b.slot));
  const t = order.find((x) => canPut(state, x, spec));
  const events = [];
  let where = 'box';
  if (t) {
    t.fish.push(f);
    where = 'tank';
    if (sim.fixThermo?.(t)) events.push({ type: 'thermoReset', tankId: t.id });
  } else {
    f.boxedAt = state.clock.min;
    (state.box ||= []).push(f);
  }
  const first = sim.addDex(state, f);
  state.iap.owned[productId] = { tx, at: Date.now(), uid: f.uid, speciesId: p.speciesId, test: isTest() };
  state.iap.log.push({ productId, tx, at: Date.now(), kind });
  state.iap.log = state.iap.log.slice(-50);
  state.stats.premiumGet = (state.stats.premiumGet || 0) + 1;
  sim.checkUnlock(state, events);
  sim.checkMissions(state, events);
  return { ok: true, productId, fish: f, spec, where, tank: where === 'tank' ? t : null, first, events };
}

function canPut(state, t, sp) {
  const B = sim.balance();
  if (sp.kind === 'snail') return sim.snailCount(t) < (B.TANK.snailMax ?? 2);
  if (sim.spaceUsed(t) + (sp.space ?? 1) > B.TANK.capacity + 1e-9) return false;
  if ((t.fish.length - sim.snailCount(t)) >= (B.TANK.fishMax ?? 1e9)) return false;
  return !(sp.needs || []).some((id) => !t.decor.includes(id));
}

/**
 * 起動の とき：買った きろくは あるのに その 子が どこにも いない（わたす とちゅうで とじた・セーブが こわれた など）なら
 * おやすみすいそうに もどす。生きものを 手ばなす しくみは ないので、いない ＝ とりこぼし（agy）。もどした 子の いちらんを かえす。
 */
export function heal(state) {
  norm(state);
  const all = sim.allCreatures(state).concat(state.adventure?.catch?.fish ? [state.adventure.catch.fish] : []);
  const out = [];
  for (const [pid, rec] of Object.entries(state.iap.owned)) {
    const p = productById(pid);
    if (!p || !sim.data().fishById[p.speciesId]) continue;
    if (all.some((f) => f.speciesId === p.speciesId && f.source === 'premium')) continue;
    const f = sim.createFish(state, p.speciesId, { source: 'premium' });
    f.boxedAt = state.clock.min;
    (state.box ||= []).push(f);
    if (!state.dex[p.speciesId]) sim.addDex(state, f);
    rec.uid = f.uid;
    state.iap.log.push({ productId: pid, tx: rec.tx, at: Date.now(), kind: 'heal' });
    out.push({ productId: pid, fish: f });
  }
  return out;
}

/** 購入の 復元：ストアの きろくに あって この セーブに ない ものを わたす。{ ok, reason, granted: [grant の もどり] } */
export async function restore(state) {
  norm(state);
  if (!isAvailable()) return { ok: false, reason: 'unavailable', granted: [] };
  if (busy) return { ok: false, reason: 'busy', granted: [] };
  busy = true;
  try {
    let r;
    try { r = await provider.restore(); } catch { r = { ok: false, reason: 'error', items: [] }; }
    if (!r?.ok) return { ok: false, reason: r?.reason || 'error', granted: [] };
    const granted = [];
    for (const it of r.items || []) {
      if (!productById(it.productId) || owns(state, it.productId)) continue;
      const g = grant(state, it.productId, it.tx, { kind: 'restore' });
      if (g.ok && !g.already) granted.push(g);
    }
    return { ok: true, granted };
  } finally { busy = false; }
}
