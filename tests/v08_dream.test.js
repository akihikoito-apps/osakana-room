// v0.8 の テスト（ゆめ係）：とけい・ゆめのすいそうの プレゼント・ゆめの いきもの・おやすみすいそう・そうこ・古い セーブ
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, S, freshState, addFish, read, uiStrings, KANJI, FISH, balance } from './_lib.js';
import * as DR from '../js/dream.js';

const DAY = 1440;
const ART = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const info = (o = {}) => ({ art: ART, base: null, kind: 'fish', speed: 'normal', size: 'm', name: 'ゆめまる', made: 5, ...o });
/** ゲームの n にちめ の あさ 6じ + plus ぷん まで すすめる */
function goDay(st, n, plus = 0) {
  const to = sim.dayStartMin() + (n - 1) * DAY + plus;
  sim.tick(st, Math.max(0, to - st.clock.min));
}
/** ゆめのすいそうを もらった セーブ */
function dreamState() {
  const st = freshState();
  goDay(st, 5, 1);
  const t = st.tanks.concat(st.storage).find((x) => x.water === 'dream');
  assert.ok(t, 'ゆめのすいそうが ない');
  return { st, t };
}
const DREAM_IDS = ['dream_fish', 'dream_crab', 'dream_frog', 'dream_reptile'];

// ---------------- データ ----------------
test('ゆめの しゅるい 4つ：water dream・obtain dream・price null・hidden。WATERS.dream・DREAM の 数', () => {
  for (const id of DREAM_IDS) {
    const f = FISH.find((x) => x.id === id);
    assert.ok(f, id);
    assert.equal(f.water, 'dream'); assert.equal(f.obtain, 'dream'); assert.equal(f.price, null); assert.equal(f.hidden, true);
  }
  assert.deepEqual(balance.WATERS.dream, { name: 'ゆめ', items: ['fresh', 'both'] });
  assert.equal(balance.DREAM.giftDay, 5);
  assert.equal(balance.DREAM.maxCreatures, 30);
  assert.deepEqual(balance.DREAM.sizeCm, { s: 3, m: 6, l: 10 });
});

test('ゆめの しゅるいは おみせ・ずかん・クイズ・つり/ガサガサ に 出ない（ずかんの かずが かわらない）', () => {
  const st = freshState();
  const sold = FISH.filter((f) => f.price != null);
  assert.ok(!sold.some((f) => DREAM_IDS.includes(f.id)), 'おみせ・ずかん（price あり）');
  for (const id of DREAM_IDS) assert.equal(sim.canBuyFish(st, id, st.tanks[0]).reason, 'notSold');
  assert.ok(!sim.quizPool(st).some((f) => DREAM_IDS.includes(f.id)), 'クイズ');
  for (const ob of ['fishing', 'gasagasa']) assert.ok(!FISH.filter((f) => f.obtain === ob).some((f) => DREAM_IDS.includes(f.id)), ob);
  // v0.7 までの ずかんの かず（price のある しゅるい）は そのまま
  assert.equal(sold.length, FISH.filter((f) => !f.hidden && f.price != null).length);
});

test('あいしょう：ゆめの しゅるいは だれとでも 1（なかよし・にがて なし）', () => {
  freshState();
  const c = sim.data().compatOf;
  for (const id of DREAM_IDS) for (const o of ['medaka', 'guppy', 'dream_fish', 'kusagame']) { assert.equal(c(id, o), 1); assert.equal(c(o, id), 1); }
  assert.equal(c('medaka', 'medaka'), sim.data().compatOf('medaka', 'medaka'));
});

test('kindOf：エビ・カニ・ザリガニ・かい → crab、カエル → frog、カメ・スッポン → reptile、ほか → fish', () => {
  freshState();
  const k = (name) => DR.kindOf(FISH.find((f) => f.name === name).id);
  assert.equal(k('ミナミヌマエビ'), 'crab');
  assert.equal(k('アメリカザリガニ'), 'crab');
  assert.equal(k('サワガニ'), 'crab');
  assert.equal(k('タニシ'), 'crab');
  assert.equal(k('トノサマガエル'), 'frog');
  assert.equal(k('ニホンアマガエル'), 'frog');
  assert.equal(k('クサガメ'), 'reptile');
  assert.equal(k('アルビノスッポン'), 'reptile');
  assert.equal(k('メダカ'), 'fish');
  assert.equal(k('オタマジャクシ'), 'fish');
  assert.equal(DR.kindOf('dream_frog'), 'frog');
  assert.equal(DR.kindOf('nanimonai'), 'fish');
});

// ---------------- プレゼント ----------------
test('プレゼント：4にちめ には ない・5にちめ あさ 6じ いこうに 1かいだけ（おしらせ・できごと）', () => {
  const st = freshState();
  goDay(st, 4, 23 * 60 + 50);           // 5にちめ の 5:50
  assert.ok(!st.tanks.some((t) => t.water === 'dream'));
  const ev = sim.tick(st, 20);           // 6:10
  const g = ev.find((e) => e.type === 'dreamGift');
  assert.ok(g, 'できごと dreamGift');
  const t = st.tanks.find((x) => x.id === g.tankId);
  assert.equal(t.water, 'dream'); assert.equal(t.layout, 'water'); assert.equal(g.stored, false);
  assert.deepEqual(st.notices.dream, { tankId: t.id, stored: false });
  assert.equal(st.unlocks.dreamTank, 5);
  // 2かいめは ない（おしらせを けしても・つぎの 日も）
  delete st.notices.dream;
  sim.tick(st, DAY * 2);
  assert.equal(st.tanks.concat(st.storage).filter((x) => x.water === 'dream').length, 1);
  assert.equal(st.notices.dream, undefined);
});

test('プレゼント：もう 5にちめ を すぎて いる セーブは よみこんだ とき もらえる（もらいそこね なし）', () => {
  const st = freshState();
  st.clock.min = sim.dayStartMin() + 9 * DAY + 30;   // 10にちめ（tick を とおらずに）
  const raw = JSON.parse(JSON.stringify(st));
  const s2 = S.migrate(raw, sim.initialValues());
  sim.normalize(s2);
  const t = s2.tanks.find((x) => x.water === 'dream');
  assert.ok(t, 'ゆめのすいそう');
  assert.ok(s2.notices.dream);
  // もういちど よみこんでも ふえない
  const s3 = S.migrate(JSON.parse(JSON.stringify(s2)), sim.initialValues());
  sim.normalize(s3);
  assert.equal(s3.tanks.concat(s3.storage).filter((x) => x.water === 'dream').length, 1);
});

test('プレゼント：へやが いっぱいなら そうこへ（stored）。へや＋そうこ が 上限なら あきが できるまで まつ', () => {
  const st = freshState();
  st.unlocks.tank6 = 1;
  while (sim.freeSlot(st) >= 0) sim.addTank(st, 'fresh', []);
  goDay(st, 5, 1);
  const t = st.storage.find((x) => x.water === 'dream');
  assert.ok(t, 'そうこに ゆめのすいそう');
  assert.equal(st.notices.dream.stored, true);
  // 上限
  const s2 = freshState();
  s2.unlocks.tank6 = 1;
  while (sim.tankTotal(s2) < sim.tankLimit()) sim.addTank(s2, 'fresh', []);
  goDay(s2, 5, 1);
  assert.ok(!s2.tanks.concat(s2.storage).some((x) => x.water === 'dream'), 'まだ もらえない');
  assert.equal(s2.unlocks.dreamTank, undefined);
  s2.storage.pop();
  sim.tick(s2, 5);
  assert.ok(s2.storage.some((x) => x.water === 'dream'), 'あきが できたら もらえる');
});

test('プレゼント：チュートリアル ちゅうは まつ', () => {
  const st = freshState({ tutorialDone: false });
  goDay(st, 6, 1);
  assert.ok(!st.tanks.some((t) => t.water === 'dream'));
  st.tutorial.done = true;
  sim.tick(st, 5);
  assert.ok(st.tanks.some((t) => t.water === 'dream'));
});

// ---------------- ゆめの いきもの ----------------
test('addCreature：f.dream の 形・speciesId dream_<kind>・おとな で とまる・ずかんに のらない', () => {
  const { st, t } = dreamState();
  const dex = JSON.stringify(st.dex);
  const f = sim.dream.addCreature(st, t, info({ kind: 'frog', size: 'l', speed: 'fast', name: 'ぴょんきち' }));
  assert.ok(f);
  assert.equal(f.speciesId, 'dream_frog');
  assert.deepEqual(Object.keys(f.dream).sort(), ['art', 'base', 'kind', 'made', 'name', 'size', 'speed']);
  assert.equal(f.dream.name, 'ぴょんきち'); assert.equal(f.dream.made, 5);
  assert.equal(f.stage, 1); assert.equal(f.shiny, false);
  assert.equal(JSON.stringify(st.dex), dex, 'ずかんは かわらない');
  assert.ok(t.fish.includes(f));
  assert.equal(sim.nameOf(f), 'ぴょんきち');
  // ずっと そだたない・おおきさは えらんだ まま
  st.inv.food_flake = 1; st.owned.food_flake = true;
  for (let d = 0; d < 6; d++) { f.onaka = 0; const r = sim.feedStart(st, t, 'food_flake', 1e9 + d * 1e5); if (r.ok) { sim.feedEat(st, f.uid, 1e9 + d * 1e5 + 1); sim.feedEnd(st); } sim.tick(st, DAY); }
  assert.equal(f.stage, 1);
  assert.equal(sim.sizeOf(f).cm, 10);
  assert.equal(sim.sizeOf(f).fixed, true);
  assert.equal(sim.lookScaleOf(f), 1);
  assert.equal(sim.growRatio(f), 1);
});

test('addCreature：ぬりえ（base あり）の kind は もとの いきもの から・なまえは ひらがな カタカナ 8もじ・から なら しゅるいの なまえ', () => {
  const { st, t } = dreamState();
  const zari = FISH.find((x) => x.name === 'アメリカザリガニ').id;
  const f = sim.dream.addCreature(st, t, info({ base: zari, kind: 'fish', name: 'ザリ123たろうabcじろうさぶろう' }));
  assert.equal(f.dream.base, zari);
  assert.equal(f.dream.kind, 'crab');
  assert.equal(f.speciesId, 'dream_crab');
  assert.equal(f.dream.name, 'ザリたろうじろう');
  assert.ok([...f.dream.name].length <= 8);
  const g = sim.dream.addCreature(st, t, info({ kind: 'reptile', name: '' }));
  assert.equal(sim.nameOf(g), 'ゆめの カメ・トカゲ');
  // おかしな 値は ふつうに
  const h = sim.dream.addCreature(st, t, info({ kind: 'dragon', speed: 'warp', size: 'xl' }));
  assert.equal(h.dream.kind, 'fish'); assert.equal(h.dream.speed, 'normal'); assert.equal(h.dream.size, 'm');
  // 絵が ない・おかしい ときは 入れない
  assert.equal(sim.dream.addCreature(st, t, info({ art: '' })), null);
  assert.equal(sim.dream.addCreature(st, t, info({ art: 'javascript:alert(1)' })), null);
});

test('overlay（もじペンの そう）：addCreature・おやすみすいそう・そうこ・セーブ で きえない。へんな ものは 省く。大きさの みつもりに 入る', () => {
  const { st, t } = dreamState();
  const OV = ART.replace('iVBOR', 'iVBOR' + 'A'.repeat(8));
  const f = sim.dream.addCreature(st, t, info({ overlay: OV }));
  assert.equal(f.dream.overlay, OV);
  assert.ok(!('overlay' in sim.dream.addCreature(st, t, info({ overlay: 'javascript:x' })).dream), 'へんな overlay は 省く');
  assert.ok(!('overlay' in sim.dream.addCreature(st, t, info()).dream), 'なければ 省く');
  assert.equal(sim.dream.infoChars(f.dream), ART.length + OV.length);
  assert.ok(sim.toBox(st, t, f.uid).ok);
  assert.ok(sim.fromBox(st, f.uid, t).ok);
  st.unlocks.tank6 = 1;
  sim.storeTank(st, t.id); sim.takeOutTank(st, t.id);
  const s2 = S.migrate(JSON.parse(JSON.stringify(st)), sim.initialValues());
  sim.normalize(s2);
  const f2 = s2.tanks.concat(s2.storage).flatMap((x) => x.fish).find((x) => x.uid === f.uid);
  assert.equal(f2.dream.overlay, OV);
  // overlay も 絵の ながさの 上限に かぞえる
  const big = 'data:image/png;base64,' + 'A'.repeat(balance.DREAM.artMaxChars - 40);
  const s3 = dreamState();
  let n = 0;
  while (sim.dream.addCreature(s3.st, s3.t, info({ art: big, overlay: big }))) { n++; if (s3.t.fish.length >= 6) sim.toBox(s3.st, s3.t, s3.t.fish[0].uid); if (n > 40) break; }
  assert.ok(n * 2 * big.length <= balance.DREAM.artBudgetChars, 'うわまわらない ' + n);
  assert.ok(n < balance.DREAM.maxCreatures, 'おおきい 絵は かずの 上限より さきに とまる');
  assert.equal(sim.dream.addCreature(s3.st, s3.t, info({ art: big, overlay: big })), null);
});

test('canAdd：ゆめのすいそう だけ・6ぴき まで・ぜんぶで maxCreatures まで', () => {
  const { st, t } = dreamState();
  assert.equal(sim.dream.canAdd(st, st.tanks[0]).reason, 'notDream');
  assert.equal(sim.dream.addCreature(st, st.tanks[0], info()), null);
  for (let i = 0; i < 6; i++) assert.ok(sim.dream.addCreature(st, t, info()));
  assert.equal(sim.dream.canAdd(st, t).reason, 'full');
  assert.equal(sim.dream.addCreature(st, t, info()), null);
  // おやすみすいそうに うつすと また かける。ぜんぶで 30 で とまる
  const max = balance.DREAM.maxCreatures;
  while (sim.dream.allDream(st).length < max) {
    if (t.fish.length >= 6) assert.ok(sim.toBox(st, t, t.fish[0].uid).ok);
    assert.ok(sim.dream.addCreature(st, t, info()));
  }
  sim.toBox(st, t, t.fish[0].uid);
  assert.equal(sim.dream.canAdd(st, t).reason, 'max');
});

test('ゆめのすいそうは いつも ちょうど よい（すいおん・きれいさ・くうき）・おせわ（えさ・なでる・ハート・ありがとう）は ふつう', () => {
  const { st, t } = dreamState();
  const f = sim.dream.addCreature(st, t, info());
  st.inv.food_flake = 1; st.owned.food_flake = true;
  for (let i = 0; i < 6; i++) sim.dream.addCreature(st, t, info());
  sim.tick(st, DAY * 2);
  assert.equal(t.clean, 100); assert.equal(t.air, 100); assert.equal(t.temp, 25); assert.equal(t.waste, 0);
  assert.equal(sim.tempState(t), 'good');
  assert.equal(sim.currentHint(st, t), null);
  f.onaka = 20;
  const coins = st.coins;
  const r = sim.feedStart(st, t, 'food_flake', 5e9);
  assert.ok(r.ok);
  const e = sim.feedEat(st, f.uid, 5e9 + 1);
  assert.ok(e && e.coin > 0, 'えさの コイン');
  sim.feedEnd(st);
  assert.ok(st.coins > coins);
  const p = sim.pet(st, f.uid, 9e9, t);
  assert.ok(p.ok && p.heart, 'なでて ハート');
  // 1しゅうかん すすめると ありがとうも くる
  const before = st.stats.thanks || 0;
  for (let i = 0; i < 7; i++) { for (const g of t.fish) g.onaka = 90; sim.tick(st, DAY); }
  assert.ok((st.stats.thanks || 0) > before, 'ありがとう');
  // なかよしは ふつう
  assert.equal(sim.nakayoshiOf(t, f), balance.NAKAYOSHI.value[1]);
});

test('器具・飾りは ゆめのすいそうに 入れられない（えさ・どうぐは かえる）・ふつうの 魚も 入れられない', () => {
  const { st, t } = dreamState();
  st.coins = 99999;
  for (const id of ['heater', 'plant', 'filter', 'air_pump', 'stone']) assert.equal(sim.canBuyItem(st, id, t).ok, false, id);
  assert.equal(sim.itemFitsWater(sim.data().itemById.food_flake, 'dream'), true);
  assert.equal(sim.itemFitsWater(sim.data().itemById.plant, 'dream'), false);
  assert.equal(sim.canBuyFish(st, 'medaka', t).reason, 'water');
});

test('えに もどす：すいそう・おやすみすいそう から けせる。ふつうの 魚は けせない', () => {
  const { st, t } = dreamState();
  const f = sim.dream.addCreature(st, t, info());
  const g = sim.dream.addCreature(st, t, info());
  assert.ok(sim.dream.release(st, t, f.uid).ok);
  assert.ok(!t.fish.includes(f));
  sim.toBox(st, t, g.uid);
  assert.ok(sim.dream.release(st, t, g.uid).ok, 'おやすみすいそう から');
  assert.ok(!st.box.includes(g));
  const m = st.tanks[0].fish[0] || addFish(st, 'medaka');
  assert.equal(sim.dream.release(st, st.tanks[0], m.uid).ok, false);
});

test('setLayout：みずだけ／はんぶん りく（ゆめのすいそう だけ）', () => {
  const { st, t } = dreamState();
  assert.ok(sim.dream.setLayout(st, t, 'land').ok);
  assert.equal(t.layout, 'land');
  assert.equal(sim.dream.setLayout(st, t, 'mountain').ok, false);
  assert.equal(sim.dream.setLayout(st, st.tanks[0], 'land').ok, false);
  assert.equal(st.tanks[0].layout, undefined);
});

// ---------------- おやすみすいそう・そうこ ----------------
test('おやすみすいそう：ゆめの いきものは ゆめのすいそう にだけ もどせる・ふつうの 魚は ゆめのすいそうに もどせない', () => {
  const { st, t } = dreamState();
  const f = sim.dream.addCreature(st, t, info());
  const m = addFish(st, 'medaka', st.tanks[0]);
  assert.ok(sim.toBox(st, t, f.uid).ok);
  assert.ok(sim.toBox(st, st.tanks[0], m.uid).ok);
  const tf = sim.boxTargets(st, f.uid);
  assert.deepEqual(tf.filter((x) => x.ok).map((x) => x.tank.id), [t.id]);
  assert.equal(sim.canFromBox(st, f.uid, st.tanks[0]).reason, 'water');
  assert.equal(sim.canFromBox(st, m.uid, t).reason, 'water');
  assert.ok(sim.fromBox(st, f.uid, t).ok);
  assert.ok(t.fish.includes(f));
});

test('そうこ：ゆめのすいそうも 中身ごと しまえる・だせる', () => {
  const { st, t } = dreamState();
  const f = sim.dream.addCreature(st, t, info());
  st.unlocks.tank6 = 1;
  assert.ok(sim.storeTank(st, t.id).ok);
  assert.ok(st.storage.includes(t) && t.fish.includes(f));
  assert.ok(sim.takeOutTank(st, t.id).ok);
  assert.ok(st.tanks.includes(t));
});

// ---------------- ミッション・ずかん から はずす ----------------
test('ミッション：ゆめの いきもの・ゆめのすいそうは かぞえない', () => {
  const st = freshState();
  const base = (type, extra = {}) => sim.missionProgress(st, { goal: { type, count: 99, ...extra } }).now;
  goDay(st, 5, 1);
  const t = st.tanks.find((x) => x.water === 'dream');
  const before = { creatures: base('creatures'), tankCount: base('tankCount'), kind: base('kindCount', { kind: 'fish' }), box: base('boxCount'), zukan: base('zukan') };
  for (let i = 0; i < 4; i++) sim.dream.addCreature(st, t, info());
  sim.toBox(st, t, t.fish[0].uid);
  assert.equal(base('creatures'), before.creatures);
  assert.equal(base('tankCount'), before.tankCount);
  assert.equal(base('kindCount', { kind: 'fish' }), before.kind);
  assert.equal(base('boxCount'), before.box);
  assert.equal(base('zukan'), before.zukan);
  assert.equal(sim.missionProgress(st, { goal: { type: 'hasTankWater', water: 'dream' } }).now, 0);
});

test('baseChoices：ずかんに のった しゅるい だけ・ゆめ用と もっていない とくべつ（premium）は のぞく', () => {
  const st = freshState();
  assert.deepEqual(sim.dream.baseChoices(st), []);
  addFish(st, 'medaka'); addFish(st, 'guppy');
  st.dex.gold_goldfish = { first: 1, count: 1 };   // ずかんには あるが もっていない
  st.dex.dream_fish = { first: 1, count: 1 };
  assert.deepEqual(sim.dream.baseChoices(st), ['medaka', 'guppy']);
  st.iap.owned['premium.gold_goldfish'] = { tx: 'x', speciesId: 'gold_goldfish' };
  assert.ok(sim.dream.baseChoices(st).includes('gold_goldfish'));
});

// ---------------- セーブ ----------------
test('migrate：dream・layout・f.dream が きえない。まちがった すいそうの 子は おやすみすいそうへ', () => {
  const { st, t } = dreamState();
  sim.dream.setLayout(st, t, 'land');
  const f = sim.dream.addCreature(st, t, info({ kind: 'crab', size: 's', name: 'カニカニ' }));
  const raw = JSON.parse(JSON.stringify(st));
  // こわれた もの：ふつうの 魚が ゆめのすいそうに・ゆめの 子が ふつうの すいそうに・layout が へん
  const rt = raw.tanks.find((x) => x.id === t.id);
  rt.fish.push({ ...raw.tanks[0].fish[0] || { speciesId: 'medaka', uid: 'zz1' }, uid: 'zz1', speciesId: 'medaka' });
  raw.tanks[0].fish.push({ ...rt.fish[0], uid: 'zz2' });
  const s2 = S.migrate(raw, sim.initialValues());
  sim.normalize(s2);
  const t2 = s2.tanks.find((x) => x.id === t.id);
  assert.equal(t2.water, 'dream');
  assert.equal(t2.layout, 'land');
  const f2 = t2.fish.find((x) => x.uid === f.uid);
  assert.deepEqual(f2.dream, f.dream);
  assert.ok(!t2.fish.some((x) => x.uid === 'zz1'), 'ふつうの 魚は でる');
  assert.ok(!s2.tanks[0].fish.some((x) => x.uid === 'zz2'), 'ゆめの 子は でる');
  assert.ok(s2.box.some((x) => x.uid === 'zz1') && s2.box.some((x) => x.uid === 'zz2'), 'おやすみすいそうへ');
  // layout が へん → water
  raw.tanks.find((x) => x.id === t.id).layout = 'sky';
  const s3 = S.migrate(raw, sim.initialValues());
  assert.equal(s3.tanks.find((x) => x.id === t.id).layout, 'water');
  // ふつうの すいそうには layout を つけない
  assert.equal(s3.tanks[0].layout, undefined);
});

test('v0.7 の セーブ（ゆめ なし）は そのまま よめる', () => {
  const st = freshState();
  addFish(st, 'medaka');
  const raw = JSON.parse(JSON.stringify(st));
  delete raw.unlocks.dreamTank;
  const s2 = S.migrate(raw, sim.initialValues());
  sim.normalize(s2);
  assert.equal(s2.tanks.length, 1);
  assert.equal(s2.tanks[0].fish.length, 1);
  assert.ok(!('dream' in s2.tanks[0].fish[0]));
});

// ---------------- とけい ----------------
test('とけい：5ふん きざみ・12じかんせい・はりの かくど・よみかた', async () => {
  const C = await import('../js/ui/clock.js');
  assert.equal(C.clockOf(6 * 60 + 30).text, '6:30');
  assert.equal(C.clockOf(6 * 60 + 34).text, '6:30');
  assert.equal(C.clockOf(18 * 60 + 5).text, '6:05');
  assert.equal(C.clockOf(0).text, '12:00');
  assert.equal(C.clockOf(12 * 60 + 59).text, '12:55');
  assert.equal(C.clockOf(DAY * 3 + 9 * 60).text, '9:00');
  assert.deepEqual(C.handAngles(3 * 60), { hour: 90, minute: 0 });
  assert.deepEqual(C.handAngles(6 * 60 + 30), { hour: 195, minute: 180 });
  assert.equal(C.clockWords(6 * 60 + 30), 'あさの 6じ30ぷん');
  assert.equal(C.clockWords(21 * 60 + 15), 'よるの 9じ15ふん');
  assert.equal(C.clockWords(13 * 60), 'ひるの 1じ');
});

test('画面の 文字（dream.js・clock.js・とけい・ゆめの ボタン）は ひらがな・カタカナ だけ', () => {
  const bad = [];
  for (const f of ['js/dream.js', 'js/ui/clock.js', 'js/ui/tank.js', 'js/ui/room.js', 'js/ui/box.js', 'js/main.js']) for (const s of uiStrings(read(f))) if (KANJI.test(s.text)) bad.push(`${f}:${s.line}: ${s.text}`);
  assert.deepEqual(bad, []);
  for (const f of FISH.filter((x) => DREAM_IDS.includes(x.id))) for (const k of ['name', 'intro', 'hint']) assert.ok(!KANJI.test(f[k]), f.id + k);
});

test('画面の つながり：HUD とけい・かべの とけい・いきものを ついか（draw が なくても おちない）・おしらせ', () => {
  const main = read('js/main.js'), room = read('js/ui/room.js'), tank = read('js/ui/tank.js');
  assert.match(main, /makeClock\(/);
  assert.match(main, /hud-clock/);
  assert.match(main, /G\.hasScreen = /);
  assert.match(main, /celebrateDream/);
  assert.match(main, /'dreamGift'/);
  assert.match(room, /room-clock/);
  assert.match(tank, /G\.hasScreen\?\.\('draw'\)/);
  assert.match(tank, /G\.go\('draw', \{ tankId: t\.id \}\)/);
  assert.match(read('index.html'), /css\/dream\.css/);
  const sw = read('sw.js');
  for (const f of ['js/dream.js', 'css/dream.css', 'js/ui/clock.js']) assert.ok(sw.includes(`'${f}'`), f);
});
