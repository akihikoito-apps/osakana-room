// v0.6 ぼうけん（ぼうけん係）：ひらく・プレゼント・えさ・つり・ガサガサ・入れ先・いけの すいそう・古い セーブ
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, sim, S, balance, ITEMS, FISH, seeded, read, exists, uiStrings, KANJI } from './_lib.js';
import * as A from '../js/adventure.js';

const R = balance.ADVENTURE;
const open = (st) => { st.heartsTotal = R.openHearts; return A.checkOpen(st, []); };
const pondFish = () => FISH.filter((f) => f.obtain === 'gasagasa');
const seaFish = () => FISH.filter((f) => f.obtain === 'fishing');

test('ぼうけん：数は balance.js（300・えさ 3こ→100コイン・1日1かい・レア度の おもみ）', () => {
  assert.equal(R.openHearts, 300);
  assert.equal(balance.UNLOCK.adventure.heartsTotal, 300);
  assert.equal(R.fishing.firstBait, 3);
  assert.equal(R.fishing.baitPrice, 100);
  assert.equal(R.gasagasa.perDay, 1);
  for (const m of ['fishing', 'gasagasa']) {
    const w = R[m].weights;
    assert.equal([1, 2, 3, 4, 5].reduce((a, r) => a + w[r], 0), 100, m);
    for (let r = 1; r < 5; r++) assert.ok(w[r] > w[r + 1], `${m} ★${r} は ★${r + 1} より でやすい`);
  }
  assert.deepEqual(Object.keys(balance.WATERS).sort(), ['fresh', 'pond', 'salt']);
  assert.deepEqual(balance.WATERS.pond.items, ['fresh', 'both']);
});

test('ぼうけん：299 では ひらかない・300 で ひらく（プレゼント・おしらせ・adventureOpen）', () => {
  const st = freshState();
  st.heartsTotal = 299;
  assert.deepEqual(A.checkOpen(st, []), []);
  assert.equal(A.isOpen(st), false);
  assert.deepEqual(A.progress(st), { now: 299, need: 300, left: 1 });
  st.heartsTotal = 300;
  const ev = A.checkOpen(st, []);
  assert.ok(ev.some((e) => e.type === 'unlock' && e.key === 'adventure'));
  assert.ok(A.isOpen(st));
  assert.equal(st.notices.adventure, true);
  assert.equal(st.stats.adventureOpen, 1);
  assert.equal(st.inv.gasa_net, 1);
  const pond = st.tanks.find((t) => t.water === 'pond');
  assert.ok(pond, 'いけの すいそうが へやに きた');
  assert.ok(pond.decor.includes('air_pump'));
  assert.ok(!pond.decor.includes('heater'));
  assert.equal(pond.temp, balance.START.roomTemp, 'ヒーターなしは へやの おんど');
  // 2かいめは なにも おきない（すいそうが ふえない）
  const n = st.tanks.length;
  assert.deepEqual(A.checkOpen(st, []), []);
  assert.equal(st.tanks.length, n);
});

test('ぼうけん：つかった ハート（hearts）では なく heartsTotal で かぞえる・チュートリアル中は ひらかない', () => {
  const st = freshState({ tutorialDone: false });
  st.heartsTotal = 400; st.hearts = 0;
  A.checkOpen(st, []);
  assert.equal(A.isOpen(st), false);
  st.tutorial.done = true;
  A.checkOpen(st, []);
  assert.equal(A.isOpen(st), true);
});

test('ぼうけん：へやが いっぱいでも いけの すいそうは そうこへ（とどかない ときは あとで）', () => {
  const st = freshState();
  st.unlocks.tank6 = 1;
  while (sim.freeSlot(st) >= 0) sim.addTank(st, 'fresh', []);
  const before = st.tanks.length;
  open(st);
  assert.equal(st.tanks.length, before);
  const all = st.tanks.concat(st.storage || []);
  const pond = all.find((t) => t.water === 'pond');
  if (pond) assert.ok((st.storage || []).includes(pond), 'そうこに 入った');
  else assert.equal(st.adventure.pondPending, true, 'あとで わたす');
});

test('うみ：はじめは つりざお → えさ 3こ プレゼント → つぎから 1こ 100コイン', () => {
  const st = freshState({ coins: 250 });
  open(st);
  assert.equal(A.canFish(st).reason, 'noRod');
  assert.equal(A.enterSea(st).gotRod, true);
  assert.equal(A.enterSea(st).gotRod, false);
  assert.equal(A.canFish(st).reason, 'noBait');
  assert.equal(A.canBuyBait(st, 1).reason, 'gift', 'さきに プレゼントを もらう');
  assert.equal(A.claimFirstBait(st).n, 3);
  assert.equal(A.bait(st), 3);
  assert.equal(A.claimFirstBait(st).ok, false, 'プレゼントは 1かいだけ');
  assert.equal(A.buyBait(st, 1).ok, true);
  assert.equal(st.coins, 150);
  assert.equal(A.bait(st), 4);
  const c = A.canBuyBait(st, 5);
  assert.equal(c.reason, 'coins'); assert.equal(c.need, 350);
  st.coins = 99999;
  st.inv.bait = R.fishing.baitMax;
  assert.equal(A.canBuyBait(st, 1).reason, 'max');
});

test('うみ：1かい つると えさ 1こ・fishing を かぞえる・ずかんに のる・まつ 子は 1ぴき', () => {
  const st = freshState();
  open(st); A.enterSea(st); A.claimFirstBait(st);
  const r = A.fish(st, seeded(3));
  assert.ok(r.ok);
  assert.equal(r.spec.obtain, 'fishing');
  assert.equal(r.spec.water, 'salt');
  assert.equal(A.bait(st), 2);
  assert.equal(st.stats.fishing, 1);
  assert.ok(st.dex[r.spec.id]);
  assert.equal(r.fish.source, 'fishing');
  assert.equal(A.canFish(st).reason, 'pending', '入れる まで つぎは つれない');
  // うみの すいそうが ない → おやすみすいそうへ
  assert.deepEqual(A.catchTargets(st), []);
  const p = A.placeCatch(st, 'box');
  assert.equal(p.where, 'box');
  assert.ok(st.box.some((f) => f.uid === r.fish.uid));
  assert.equal(A.canFish(st).ok, true);
});

test('うみ：つった 子は うみの すいそうへ・いっぱいなら おやすみすいそう', () => {
  const st = freshState();
  open(st); A.enterSea(st); A.claimFirstBait(st);
  const salt = sim.addTank(st, 'salt', ['heater', 'air_pump']);
  const r = A.fish(st, seeded(5));
  const tg = A.catchTargets(st);
  assert.equal(tg.length, 1);
  assert.equal(tg[0].tank.id, salt.id);
  assert.ok(tg[0].ok);
  const p = A.placeCatch(st, salt.id);
  assert.equal(p.where, 'tank');
  assert.ok(salt.fish.some((f) => f.uid === r.fish.uid));
  // いっぱい → えらんでも おやすみすいそう
  const small = seaFish().find((f) => f.kind !== 'snail' && (f.space ?? 1) <= 1);
  while (salt.fish.length < balance.TANK.fishMax) salt.fish.push(sim.createFish(st, small.id));
  A.fish(st, seeded(7));
  const p2 = A.placeCatch(st, salt.id);
  assert.equal(p2.where, 'box');
});

test('つり：レア度の 出やすさ（10000かい）は おもみ どおり・★4いじょうの てんじょう', () => {
  const st = freshState();
  open(st);
  const odds = A.rarityOdds('fishing');
  const have = new Set(seaFish().map((f) => f.rarity));
  for (let r = 1; r <= 5; r++) if (have.has(r)) assert.ok(Math.abs(odds[r] - R.fishing.weights[r] / 100) < 1e-9 || !have.has(r));
  const rnd = seeded(11);
  const cnt = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  st.adventure.pity.fishing = -1e9;   // てんじょう なしで かぞえる
  for (let i = 0; i < 10000; i++) { const g = A.roll(st, 'fishing', rnd); cnt[g.rarity]++; }
  for (let r = 1; r <= 5; r++) if (have.has(r)) assert.ok(Math.abs(cnt[r] / 10000 - odds[r]) < 0.02, `★${r} ${cnt[r]}`);
  assert.ok(cnt[1] > cnt[4] * 4, 'ふつうの 子が ずっと おおい');
  // タコ・イカは レア
  for (const id of ['madako', 'aoriika']) { const f = FISH.find((x) => x.id === id); if (f) assert.ok(f.rarity >= 4, id); }
  // てんじょう：9かい ★4いじょうが でないと 10かいめは ★4いじょう
  st.adventure.pity.fishing = R.fishing.pity.every - 1;
  for (let i = 0; i < 50; i++) assert.ok(A.roll(st, 'fishing', seeded(100 + i)).rarity >= 4);
});

test('いけ：1日 1かい（あさ 6:00 で もどる）・gasagasa を かぞえる・いけの すいそうへ', () => {
  const st = freshState();
  assert.equal(A.canGasa(st).reason, 'closed');
  open(st);
  const pond = st.tanks.find((t) => t.water === 'pond');
  assert.equal(A.gasaLeft(st), 1);
  const r = A.gasagasa(st, seeded(2));
  assert.ok(r.ok);
  assert.equal(r.spec.obtain, 'gasagasa');
  assert.equal(r.spec.water, 'pond');
  assert.equal(st.stats.gasagasa, 1);
  const tg = A.catchTargets(st);
  assert.equal(tg.length, 1);
  assert.equal(tg[0].tank.id, pond.id);
  assert.equal(A.placeCatch(st, pond.id).where, 'tank');
  assert.equal(A.canGasa(st).reason, 'done');
  // よる（つぎの日の 5:59）でも まだ だめ、6:00 で もどる
  const toNext = A.minutesToNextDay(st);
  sim.tick(st, toNext - 1);
  assert.equal(A.canGasa(st).reason, 'done');
  sim.tick(st, 1);
  assert.equal(A.canGasa(st).ok, true);
});

test('いけ：レア度の 出やすさ・20しゅるい くらい・いけの 生きものは pond・おみせに ない', () => {
  const st = freshState();
  open(st);
  const list = pondFish();
  assert.ok(list.length >= 15, `いけの 生きもの ${list.length}`);
  for (const f of list) { assert.equal(f.water, 'pond', f.id); assert.equal(f.price, null, f.id); }
  for (const f of seaFish()) { assert.equal(f.water, 'salt', f.id); assert.equal(f.price, null, f.id); }
  const rnd = seeded(21);
  st.adventure.pity.gasagasa = -1e9;
  const cnt = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (let i = 0; i < 10000; i++) cnt[A.roll(st, 'gasagasa', rnd).rarity]++;
  const odds = A.rarityOdds('gasagasa');
  for (let r = 1; r <= 5; r++) assert.ok(Math.abs(cnt[r] / 10000 - odds[r]) < 0.02, `★${r}`);
  assert.ok(odds[5] < odds[1]);
});

test('いけの すいそう：かわの 飾りが つかえる・うみの 飾りは だめ・いけの 生きものは いけだけ', () => {
  const st = freshState({ coins: 99999 });
  open(st);
  const pond = st.tanks.find((t) => t.water === 'pond');
  assert.equal(sim.canBuyItem(st, 'plant', pond).ok, true);
  assert.equal(sim.canBuyItem(st, 'stone', pond).ok, true);
  assert.notEqual(sim.canBuyItem(st, 'coral', pond).ok, true);
  assert.equal(sim.tankName(st, pond), 'いけの すいそう');
  const pf = pondFish()[0];
  assert.equal(A.canPut(st, pond, pf.id).ok, true);
  assert.equal(A.canPut(st, st.tanks[0], pf.id).reason, 'water');
  // おみせの いけの すいそう：ぼうけんが ひらいてから
  const st2 = freshState({ coins: 99999 });
  st2.unlocks.tank6 = 1;
  assert.equal(sim.canBuyItem(st2, 'tank_pond').reason, 'locked');
  open(st2);
  assert.equal(sim.canBuyItem(st2, 'tank_pond').ok, true);
  const r = sim.buyItem(st2, 'tank_pond');
  assert.equal(r.tank.water, 'pond');
});

test('古い セーブ：adventure が なくても うごく・pond は fresh に もどらない・まつ 子は のこる', () => {
  const st = freshState();
  open(st); A.enterSea(st); A.claimFirstBait(st);
  A.fish(st, seeded(9));
  const raw = JSON.parse(JSON.stringify(st));
  const back = S.migrate(raw, sim.initialValues());
  sim.normalize(back);
  A.norm(back);
  assert.ok(back.tanks.some((t) => t.water === 'pond'));
  assert.ok(back.adventure.catch, 'まって いる 子');
  assert.equal(A.bait(back), 2);
  // v0.5 の セーブ（adventure なし・heartsTotal 350）
  const old = { v: 2, coins: 10, tanks: [{ id: 't1', water: 'fresh', slot: 0, fish: [] }], heartsTotal: 350, hearts: 5, tutorial: { step: 99, done: true } };
  const m = S.migrate(old, sim.initialValues());
  sim.normalize(m);
  assert.equal(A.isOpen(m), false);
  A.checkOpen(m, []);
  assert.equal(A.isOpen(m), true);
  assert.equal(m.notices.adventure, true);
  // しらない 水の なまえは fresh に
  const odd = S.migrate({ v: 2, tanks: [{ id: 't1', water: 'LAVA!', slot: 0, fish: [] }] }, sim.initialValues());
  assert.equal(odd.tanks[0].water, 'fresh');
});

test('ぼうけん：画面の 文字に かんじ なし・道具の アイコン・ヘルプ・main の よみこみ・sw', () => {
  for (const f of ['js/adventure.js', 'js/ui/adventure.js']) {
    const bad = uiStrings(read(f)).filter((s) => KANJI.test(s.text));
    assert.deepEqual(bad.map((s) => `${f}:${s.line} ${s.text}`), []);
  }
  for (const id of ['fishing_rod', 'bait', 'gasa_net', 'tank_pond']) {
    const it = ITEMS.find((i) => i.id === id);
    assert.ok(it, id);
    assert.ok(exists(it.icon), it.icon);
  }
  for (const p of ['assets/adventure/bg_sea.jpg', 'assets/adventure/bg_pond.jpg', 'assets/items/adventure.png']) assert.ok(exists(p), p);
  assert.match(read('js/main.js'), /'\.\/ui\/adventure\.js'/);
  assert.match(read('index.html'), /css\/adventure\.css/);
  assert.match(read('js/data/help.js'), /id: 'adventure'/);
});
