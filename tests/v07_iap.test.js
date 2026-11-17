// v0.7 課金係：とくべつ コーナー（js/iap.js）。公開版では 買えない・?iaptest では 買える・おうちの ひとの かくにん・
// 2かい 買えない・セーブに のこる・ガチャに 出ない・復元・とりこぼしの もどし・テストの セーブは べつ
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, sim, S, FISH, seeded, read, exists, uiStrings, KANJI, balance } from './_lib.js';
import * as IAP from '../js/iap.js';
import * as A from '../js/adventure.js';
import { SPECIES_DEFAULTS } from '../js/aquarium/speciesDefaults.js';
import { compatOf } from '../js/data/compat.js';

const PREMIUM = FISH.filter((f) => f.obtain === 'premium');
const byId = Object.fromEntries(FISH.map((f) => [f.id, f]));
const GOLD = 'premium.gold_goldfish', SUPPON = 'premium.albino_suppon', BLUE = 'premium.blue_zarigani';

/** テスト用の ストア（メモリ）。delay なし */
function useTest() {
  const box = [];
  const p = IAP.createTestProvider({ store: { get: () => box.slice(), set: (v) => { box.length = 0; box.push(...v); } }, delayMs: 0 });
  IAP.setProvider(p);
  return { p, box };
}
const tokenFor = () => { const g = IAP.makeGate(seeded(3)); return IAP.passGate(g, String(g.answer)); };
const allFish = (st) => sim.allCreatures(st);
const pondTank = (st) => sim.addTank(st, 'pond', []);

test('データ：3しゅるい（きんいろキンギョ・アルビノスッポン・あおいザリガニ）・obtain premium・price null・でんせつに しない', () => {
  assert.deepEqual(PREMIUM.map((f) => f.id).sort(), ['albino_suppon', 'blue_zarigani', 'gold_goldfish']);
  assert.equal(byId.gold_goldfish.water, 'fresh');
  assert.equal(byId.albino_suppon.water, 'pond');
  assert.equal(byId.blue_zarigani.water, 'pond');
  assert.equal(byId.blue_zarigani.swim.habit, 'land', 'あおいザリガニは いまの ザリガニと おなじ りくち');
  assert.equal(byId.albino_suppon.swim.habit, undefined, 'スッポンは 水の 中が おおい');
  for (const f of PREMIUM) {
    assert.equal(f.price, null, f.id);
    assert.ok(f.rarity >= 1 && f.rarity <= 4, `${f.id} rarity ${f.rarity}`);
    assert.equal(f.texture, `assets/fish/${f.id}.png`);
    assert.ok(exists(f.texture), f.texture);
    assert.ok(read('sw.js').includes(`'${f.texture}'`), `${f.texture} が sw.js に ない`);
    for (const k of ['name', 'intro', 'hint']) assert.ok(!KANJI.test(f[k]), `${f.id} ${k}`);
    const d = SPECIES_DEFAULTS[f.id];
    assert.ok(d && d.kind === f.kind && d.water === f.water, `${f.id} speciesDefaults`);
    // おなじ 水の 子との 相性は ぜんぶ 書いてある
    for (const o of FISH.filter((x) => x.water === f.water)) assert.ok([0, 1, 2].includes(compatOf(f.id, o.id)));
  }
  assert.equal(compatOf('gold_goldfish', 'goldfish'), 2);
  assert.equal(compatOf('blue_zarigani', 'tanishi'), compatOf('zarigani', 'tanishi'));
  assert.equal(compatOf('albino_suppon', 'otamajakushi'), 0);
});

test('ねだんは iap.js の PRODUCTS 1か所（きんいろキンギョ 160えん）・3しゅるいと 1たい1', () => {
  assert.equal(IAP.PRODUCTS.length, 3);
  assert.equal(IAP.productById(GOLD).yen, 160);
  for (const p of IAP.PRODUCTS) {
    assert.equal(byId[p.speciesId]?.obtain, 'premium', p.id);
    assert.ok(Number.isInteger(p.yen) && p.yen > 0);
  }
  assert.equal(IAP.yenLabel(160), '160えん');
  assert.deepEqual(new Set(IAP.PRODUCTS.map((p) => p.speciesId)), new Set(PREMIUM.map((f) => f.id)));
});

test('ガチャ（つり・ガサガサ）にも おみせ（コイン）にも 出ない', () => {
  freshState();
  for (const m of ['fishing', 'gasagasa']) assert.ok(!A.pool(m).some((f) => f.obtain === 'premium'), m);
  const st = freshState({ coins: 99999 });
  const rnd = seeded(7);
  for (let i = 0; i < 3000; i++) for (const m of ['fishing', 'gasagasa']) assert.notEqual(A.roll(st, m, rnd)?.spec.obtain, 'premium');
  for (const f of PREMIUM) {
    assert.equal(sim.priceOf(st, f.id), null);
    assert.equal(sim.canBuyFish(st, f.id).reason, 'notSold');
  }
});

test('公開版（none）：「もうすぐ」で 買えない・復元も できない・かくにんを とおっても だめ', async () => {
  IAP.initIap({ search: '' });
  assert.equal(IAP.providerId(), 'none');
  assert.equal(IAP.isAvailable(), false);
  const st = freshState();
  pondTank(st);
  assert.deepEqual(IAP.getProducts(st).map((p) => p.state), ['soon', 'soon', 'soon']);
  const n = allFish(st).length;
  const r = await IAP.purchase(st, GOLD, { gateToken: tokenFor() });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unavailable');
  assert.equal((await IAP.restore(st)).ok, false);
  assert.equal(allFish(st).length, n);
  assert.deepEqual(st.iap.owned, {});
  // ?iaptest いがいの URL では テストに ならない
  IAP.initIap({ search: '?debug=1&iap=1' });
  assert.equal(IAP.providerId(), 'none');
  // 公開ページ（github.io）では ?iaptest を つけても テストに ならない（タダで 手に 入る 道に しない）
  IAP.initIap({ search: '?iaptest', host: 'akihikoito-apps.github.io' });
  assert.equal(IAP.providerId(), 'none');
});

test('?iaptest：にせの 購入で 買える（いまの かわの すいそう・ずかん・source premium・セーブの きろく）', async () => {
  assert.equal(IAP.initIap({ search: '?iaptest' }).id, 'test');
  useTest();
  const st = freshState();
  assert.equal(IAP.getProducts(st).find((p) => p.id === GOLD).state, 'ok');
  const r = await IAP.purchase(st, GOLD, { gateToken: tokenFor(), tankId: st.tanks[0].id });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.where, 'tank');
  assert.equal(r.fish.speciesId, 'gold_goldfish');
  assert.equal(r.fish.source, 'premium');
  assert.ok(st.tanks[0].fish.includes(r.fish));
  assert.ok(st.dex.gold_goldfish);
  assert.equal(r.first, true);
  assert.ok(st.iap.owned[GOLD].tx.startsWith('test-'));
  assert.equal(st.iap.owned[GOLD].test, true);
  assert.equal(IAP.getProducts(st).find((p) => p.id === GOLD).state, 'owned');
});

test('おうちの ひとの かくにん：token が ないと・ちがう こたえ・つかいまわし・じかんぎれ は 買えない', async () => {
  useTest();
  const st = freshState();
  assert.equal((await IAP.purchase(st, GOLD, {})).reason, 'gate');
  assert.equal((await IAP.purchase(st, GOLD, { gateToken: 'gxxxx' })).reason, 'gate');
  const g = IAP.makeGate(seeded(5));
  for (let i = 0; i < 200; i++) { const x = IAP.makeGate(seeded(i + 1)); assert.ok(x.a >= 12 && x.a <= 19 && x.b >= 3 && x.b <= 9 && x.answer === x.a * x.b, '九九の そとがわ（2けた×1けた）'); }
  assert.equal(IAP.passGate(g, String(g.answer + 1)), null);
  assert.equal(IAP.passGate(g, ''), null);
  const t = IAP.passGate(g, String(g.answer));
  assert.ok(t);
  // じかんぎれ（2ふん）
  const t2 = IAP.passGate(g, String(g.answer), 1000);
  assert.equal((await IAP.purchase(st, GOLD, { gateToken: t2, now: 1000 + IAP.GATE_TTL_MS + 1 })).reason, 'gate');
  assert.equal(allFish(st).length, 0);
  assert.equal((await IAP.purchase(st, GOLD, { gateToken: t })).ok, true);
  // おなじ token は 2かい つかえない（こんどは べつの 商品でも）
  pondTank(st);
  assert.equal((await IAP.purchase(st, BLUE, { gateToken: t })).reason, 'gate');
});

test('2かい 買えない（1しゅるい 1ぴき）・れんだ しても 1ぴき・キャンセルでは なにも ふえない', async () => {
  const { p, box } = useTest();
  const st = freshState();
  // キャンセル
  p.failNext('cancel');
  const c = await IAP.purchase(st, GOLD, { gateToken: tokenFor() });
  assert.equal(c.reason, 'cancel');
  assert.equal(allFish(st).length, 0);
  assert.deepEqual(st.iap.owned, {});
  // れんだ（おなじ ときに 2かい）
  const [a, b] = await Promise.all([IAP.purchase(st, GOLD, { gateToken: tokenFor() }), IAP.purchase(st, GOLD, { gateToken: tokenFor() })]);
  assert.deepEqual([a.ok, b.ok].sort(), [false, true]);
  assert.equal((a.ok ? b : a).reason, 'busy');
  const r2 = await IAP.purchase(st, GOLD, { gateToken: tokenFor() });
  assert.equal(r2.reason, 'owned');
  assert.equal(allFish(st).filter((f) => f.speciesId === 'gold_goldfish').length, 1);
  assert.equal(box.length, 1, 'ストアの きろくも 1つ');
  // grant を おなじ 取引で もういちど よんでも ふえない
  assert.equal(IAP.grant(st, GOLD, box[0].tx).already, true);
  assert.equal(allFish(st).filter((f) => f.speciesId === 'gold_goldfish').length, 1);
});

test('いけの 子：いけの すいそうが ないと 買えない → いけの すいそうへ → いっぱいなら おやすみすいそう（上限でも すてない）', async () => {
  useTest();
  const st = freshState();
  assert.equal(IAP.getProducts(st).find((p) => p.id === SUPPON).state, 'needTank');
  assert.equal((await IAP.purchase(st, SUPPON, { gateToken: tokenFor() })).reason, 'needTank');
  const t = pondTank(st);
  const r = await IAP.purchase(st, SUPPON, { gateToken: tokenFor() });
  assert.equal(r.ok, true);
  assert.equal(r.where, 'tank');
  assert.equal(r.tank, t);
  // いけの すいそうを いっぱいに して、おやすみすいそうも 上限に
  while (sim.spaceUsed(t) + 1 <= balance.TANK.capacity) t.fish.push(sim.createFish(st, 'motsugo', {}));
  st.box = Array.from({ length: sim.boxMax() }, () => sim.createFish(st, 'medaka', {}));
  const r2 = await IAP.purchase(st, BLUE, { gateToken: tokenFor() });
  assert.equal(r2.ok, true);
  assert.equal(r2.where, 'box');
  assert.equal(st.box.length, sim.boxMax() + 1);
  assert.ok(st.box.some((f) => f.speciesId === 'blue_zarigani'));
});

test('セーブに のこる（JSON → migrate）・古い セーブには からの iap・こわれた iap でも おちない', async () => {
  useTest();
  const st = freshState();
  await IAP.purchase(st, GOLD, { gateToken: tokenFor() });
  const back = S.migrate(JSON.parse(JSON.stringify(st)), sim.initialValues());
  sim.normalize(back);
  IAP.norm(back);
  assert.equal(back.iap.owned[GOLD].tx, st.iap.owned[GOLD].tx);
  assert.ok(back.tanks[0].fish.some((f) => f.speciesId === 'gold_goldfish' && f.source === 'premium'));
  assert.equal(IAP.getProducts(back).find((p) => p.id === GOLD).state, 'owned');
  // 古い セーブ（iap なし）
  const old = JSON.parse(JSON.stringify(st)); delete old.iap;
  const o = S.migrate(old, sim.initialValues());
  assert.deepEqual(o.iap, { owned: {}, log: [] });
  // こわれた iap
  for (const bad of [null, 3, 'x', [], { owned: 'x', log: 'y' }, { owned: { [GOLD]: { tx: 5 } } }]) {
    const b = JSON.parse(JSON.stringify(st)); b.iap = bad;
    const m = S.migrate(b, sim.initialValues());
    IAP.norm(m);
    assert.ok(m.iap && typeof m.iap.owned === 'object' && Array.isArray(m.iap.log));
  }
});

test('復元：セーブを けしても ストアの きろくから もどる（ふえない）', async () => {
  useTest();
  const st = freshState();
  pondTank(st);
  await IAP.purchase(st, GOLD, { gateToken: tokenFor() });
  await IAP.purchase(st, BLUE, { gateToken: tokenFor() });
  const st2 = freshState();
  const r = await IAP.restore(st2);
  assert.equal(r.ok, true);
  assert.deepEqual(r.granted.map((g) => g.productId).sort(), [BLUE, GOLD].sort());
  assert.equal(r.granted.find((g) => g.productId === BLUE).where, 'box', 'いけの すいそうが ない ときは おやすみすいそう');
  assert.equal((await IAP.restore(st2)).granted.length, 0, '2かいめは なにも ふえない');
  assert.equal(allFish(st2).filter((f) => f.source === 'premium').length, 2);
});

test('とりこぼし：買った きろくが あるのに いない 子は 起動の とき おやすみすいそうへ（いる ときは なにも しない）', async () => {
  useTest();
  const st = freshState();
  await IAP.purchase(st, GOLD, { gateToken: tokenFor() });
  assert.deepEqual(IAP.heal(st), []);
  st.tanks[0].fish = st.tanks[0].fish.filter((f) => f.speciesId !== 'gold_goldfish');
  const h = IAP.heal(st);
  assert.equal(h.length, 1);
  assert.ok(st.box.some((f) => f.speciesId === 'gold_goldfish' && f.source === 'premium'));
  assert.deepEqual(IAP.heal(st), []);
});

test('?iaptest の セーブは べつ（ふだんの セーブに にせの 購入が まざらない）・はじめは コピー', () => {
  const mem = new Map();
  const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true });
  try {
    const st = freshState(); st.coins = 777;
    S.save(st);
    S.useSaveKey(S.SAVE_KEY + '-iaptest', { copyFrom: S.SAVE_KEY });
    const t = S.load(sim.initialValues());
    assert.equal(t.coins, 777, 'はじめは ふだんの セーブの コピー');
    t.coins = 5; t.iap = { owned: { [GOLD]: { tx: 'test-1' } }, log: [] };
    S.save(t);
    assert.equal(JSON.parse(mem.get(S.SAVE_KEY)).coins, 777);
    assert.equal(JSON.parse(mem.get(S.SAVE_KEY)).iap.owned[GOLD], undefined);
    assert.equal(JSON.parse(mem.get(S.SAVE_KEY + '-iaptest')).coins, 5);
  } finally {
    S.useSaveKey(S.SAVE_KEY);
    if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete globalThis.localStorage;
  }
  assert.ok(read('js/main.js').includes("IAP.isTest()) S.useSaveKey(S.SAVE_KEY + '-iaptest'"), 'main.js で テストの セーブに きりかえる');
});

test('画面：✨ とくべつ タブ・ねだんは「えん」・おうちの ひとと いっしょに・漢字なし・ヘルプ・ファイル', () => {
  assert.ok(read('index.html').includes('data-tab="premium"'));
  assert.ok(read('index.html').includes('css/premium.css'));
  const ui = read('js/ui/premium.js');
  for (const s of ['おうちの ひとと いっしょに', 'おうちの ひとへ', 'もうすぐ', 'かった いきものを もどす']) assert.ok(ui.includes(s), s);
  for (const f of ['js/ui/premium.js', 'js/iap.js']) for (const s of uiStrings(read(f))) assert.ok(!KANJI.test(s.text), `${f}:${s.line} ${s.text}`);
  for (const f of ['js/iap.js', 'js/ui/premium.js', 'css/premium.css']) assert.ok(read('sw.js').includes(`'${f}'`), f);
  // 通信しない（決済が きまるまで）
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|https?:\/\//.test(read('js/iap.js').replace(/\/\/.*$/gm, '')));
  const help = read('js/data/help.js');
  assert.ok(help.includes('とくべつ コーナー') && help.includes('おうちの ひとへ'));
});
