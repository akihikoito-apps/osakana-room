// v0.9 の テスト（おせわき係）：じどう おせわき（もらう・とりつけ／はずす・ごはん・よごれ・ごほうびが ふえない・そうこ・ゆめのすいそう・古い セーブ）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, S, freshState, addFish, read, exists, uiStrings, KANJI, ITEMS, balance } from './_lib.js';

const AC = () => sim.autocare;
const R = balance.AUTOCARE;

/** すいそうを n こに する（へやが いっぱいなら そうこへ） */
function tanksTo(st, n, water = 'fresh') {
  while (st.tanks.length + st.storage.length < n) assert.ok(sim.addTank(st, water, ['heater', 'air_pump']));
}
/** おせわきを もらった セーブ（すいそう 6つ・1つめに メダカ 3びき） */
function gifted() {
  const st = freshState();
  for (let i = 0; i < 3; i++) addFish(st, 'medaka', st.tanks[0]);
  tanksTo(st, 6);
  const ev = sim.tick(st, 1);
  assert.ok(ev.some((e) => e.type === 'autoCareGift'), 'もらえて いない');
  return st;
}
/** 1じかんの はんてい（ありがとう など）を またがない よう 5ふんずつ */
const step = (st, min = 5) => sim.tick(st, min);

// ---------------- データ ----------------
test('AUTOCARE の 数・items の auto_care（price null・おみせに 出ない）・アイコン', () => {
  assert.equal(R.giftAt, 6); assert.equal(R.count, 3); assert.equal(R.feedBelow, 30); assert.equal(R.feedTo, 75);
  assert.ok(R.cleanBelow > 60 && R.cleanTo < 70 && R.cleanTo > R.cleanBelow, 'きれいさ：cleanMin 60 より うえ・ピカピカ 70 より した');
  assert.ok(R.wasteAt >= 1 && R.wasteTo < R.wasteAt);
  const it = ITEMS.find((i) => i.id === 'auto_care');
  assert.ok(it); assert.equal(it.name, 'じどう おせわき'); assert.equal(it.price, null); assert.equal(it.inTank, false);
  assert.ok(exists(it.icon), it.icon);
  assert.ok(read('sw.js').includes("'js/autocare.js'") && read('sw.js').includes("'assets/items/auto_care.png'"));
  for (const f of ['js/autocare.js', 'js/ui/autocare.js']) for (const s of uiStrings(read(f))) assert.ok(!KANJI.test(s.text), `${f}:${s.line} ${s.text}`);
});

// ---------------- もらう ----------------
test('すいそうが 6つで 1かい だけ 3つ もらう（unlocks.autoCare・notices・できごと）。5つ では もらえない', () => {
  const st = freshState();
  tanksTo(st, 5);
  assert.ok(!sim.tick(st, 1).some((e) => e.type === 'autoCareGift'));
  assert.ok(!st.unlocks.autoCare);
  assert.equal(AC().left(st), 0);
  tanksTo(st, 6);
  const ev = sim.tick(st, 1);
  assert.equal(ev.filter((e) => e.type === 'autoCareGift').length, 1);
  assert.ok(st.unlocks.autoCare >= 1);
  assert.equal(st.notices.autoCare, true);
  assert.equal(st.inv.auto_care, 3);
  // もう いちど・すいそうが ふえても もらわない
  tanksTo(st, 8);
  for (let i = 0; i < 5; i++) assert.ok(!sim.tick(st, 1).some((e) => e.type === 'autoCareGift'));
  assert.equal(AC().total(st), 3);
});

test('そうこの すいそう・ゆめのすいそう も かぞえる（へや＋そうこ。ゆめ こみで 6つ）', () => {
  const st = freshState();
  tanksTo(st, 5);
  const d = sim.addTank(st, 'dream', []);
  assert.ok(d);
  sim.tick(st, 1);
  assert.equal(AC().left(st), 3, 'ゆめのすいそう こみで 6つ');
  const st2 = freshState();
  tanksTo(st2, 7);   // 6つ めから そうこ
  assert.equal(st2.storage.length, 1);
  sim.tick(st2, 1);
  assert.equal(AC().left(st2), 3);
});

test('チュートリアル中は まつ（おわったら もらえる）', () => {
  const st = freshState({ tutorialDone: false });
  tanksTo(st, 6);
  sim.tick(st, 1);
  assert.ok(!st.unlocks.autoCare);
  st.tutorial.done = true;
  assert.ok(sim.tick(st, 1).some((e) => e.type === 'autoCareGift'));
});

test('既存プレイヤー：もう 6つ いじょう ある セーブは ひらいた とき（normalize）に もらう・おしらせが まつ', () => {
  const st = freshState();
  tanksTo(st, 7);
  delete st.unlocks.autoCare; delete st.notices.autoCare; delete st.inv.auto_care;
  const loaded = S.migrate(JSON.parse(JSON.stringify(st)), sim.initialValues());
  sim.normalize(loaded);
  assert.ok(loaded.unlocks.autoCare >= 1);
  assert.equal(loaded.notices.autoCare, true);
  assert.equal(AC().left(loaded), 3);
});

// ---------------- とりつけ／はずす ----------------
test('とりつけ：のこりが へる・stats.autoCareAttach・3つ まで。はずすと もどる・つけかえで かずは 3 の まま', () => {
  const st = gifted();
  const [a, b, c, d] = st.tanks;
  for (const t of [a, b, c]) assert.ok(AC().attach(st, t).ok);
  assert.equal(st.stats.autoCareAttach, 3);
  assert.equal(AC().left(st), 0);
  assert.equal(AC().attach(st, d).reason, 'empty');
  assert.equal(AC().attach(st, a).ok, false);   // もう ついている
  assert.ok(AC().detach(st, a).ok);
  assert.equal(AC().left(st), 1);
  assert.ok(AC().attach(st, d).ok);
  assert.equal(AC().total(st), 3);
  assert.equal(a.autoCare, false); assert.equal(d.autoCare, true);
  // セーブ → よみこみ でも 3 の まま
  const back = S.migrate(JSON.parse(JSON.stringify(st)), sim.initialValues());
  sim.normalize(back);
  assert.equal(AC().total(back), 3);
  assert.equal(back.tanks.filter((t) => t.autoCare === true).length, 3);
});

test('こわれた かず（inv が おおすぎ・とりつけ 4つ）は 3 に そろう。もらう まえの とりつけは はずれる', () => {
  const st = gifted();
  st.inv.auto_care = 10;
  for (const t of st.tanks.slice(0, 4)) t.autoCare = true;
  sim.normalize(st);
  assert.equal(AC().total(st), 3);
  assert.equal(AC().attachedTanks(st).length, 3);
  const st2 = freshState();
  st2.tanks[0].autoCare = true; st2.inv.auto_care = 2;
  sim.normalize(st2);
  assert.equal(st2.tanks[0].autoCare, false);
  assert.equal(AC().left(st2), 0);
});

test('ゆめのすいそう には つけられない（とりつけ・セーブの よみこみ でも）', () => {
  const st = gifted();
  const d = sim.addTank(st, 'dream', []);
  assert.equal(AC().attach(st, d).reason, 'dream');
  assert.equal(AC().canHold(d), false);
  d.autoCare = true; st.inv.auto_care = 2;
  const back = S.migrate(JSON.parse(JSON.stringify(st)), sim.initialValues());
  sim.normalize(back);
  assert.notEqual(back.tanks.concat(back.storage).find((t) => t.water === 'dream').autoCare, true);
  assert.equal(AC().left(back), 3);
});

// ---------------- うごき ----------------
test('ごはん：30% を きった 子だけ 75% まで（いきもの ごと。75 より 上・30 いじょう の 子には あげない）', () => {
  const st = gifted();
  const t = st.tanks[0];
  AC().attach(st, t);
  const [f1, f2, f3] = t.fish;
  f1.onaka = 29; f2.onaka = 50; f3.onaka = 80;
  const ev = step(st, 1);
  assert.equal(f1.onaka, 75);
  assert.ok(f2.onaka < 50 && f2.onaka > 49, 'あげない');
  assert.ok(f3.onaka < 80 && f3.onaka > 79, 'あげない');
  const e = ev.find((x) => x.type === 'autoCare');
  assert.deepEqual(e.fed, [f1.uid]);
  assert.equal(e.tankId, t.id);
});

test('ごはん：75 で とまる（そのあと 30 を きるまで あげない）', () => {
  const st = gifted();
  const t = st.tanks[0];
  AC().attach(st, t);
  for (const f of t.fish) f.onaka = 5;
  step(st, 1);
  for (const f of t.fish) assert.equal(f.onaka, 75);
  step(st, 30);
  for (const f of t.fish) { assert.ok(f.onaka < 75, 'へって いく'); assert.ok(f.onaka > 70); }
});

test('よごれの きじゅん：きれいさ < 62 → 68・ごみ 3 → 1・たべのこし → 0。きじゅんの てまえ では うごかない', () => {
  const st = gifted();
  const t = st.tanks[0];
  AC().attach(st, t);
  t.clean = R.cleanBelow + 3; t.waste = R.wasteAt - 0.5; t.leftover = 0;
  let ev = step(st, 1);
  assert.ok(t.clean > R.cleanBelow && t.clean < R.cleanBelow + 3, 'みずかえ しない');
  assert.ok(t.waste >= R.wasteAt - 0.5, 'そうじ しない');
  assert.ok(!ev.some((e) => e.type === 'autoCare'));
  t.clean = R.cleanBelow - 1; t.waste = R.wasteAt; t.leftover = 2;
  ev = step(st, 1);
  assert.equal(t.clean, R.cleanTo);
  assert.equal(t.waste, R.wasteTo);
  assert.equal(t.leftover, 0);
  const e = ev.find((x) => x.type === 'autoCare');
  assert.ok(e.water && e.scoop);
  // きれいさは ピカピカ（70）まで あげない（じぶんで みずかえ する ねうちを のこす）
  assert.ok(t.clean < balance.LABELS.clean.goodMin);
});

test('じどうでは コイン・ハート・なつき・ミッションの おせわ回数 は ふえない', () => {
  const st = gifted();
  const t = st.tanks[0];
  AC().attach(st, t);
  const before = { coins: st.coins, hearts: st.hearts, heartsTotal: st.heartsTotal, care: st.daily.care, natsuki: t.fish.map((f) => f.natsuki), feed: st.stats.feed || 0, wc: st.stats.waterChange || 0, wcAll: st.stats.waterChangeAll || 0, scoop: st.stats.scoop || 0, earned: st.stats.coinsEarned || 0 };
  for (let i = 0; i < 3; i++) {
    for (const f of t.fish) f.onaka = 10;
    t.clean = 20; t.waste = 8; t.leftover = 4;
    const ev = step(st, 5);
    assert.ok(ev.some((e) => e.type === 'autoCare'));
  }
  assert.equal(st.coins, before.coins);
  assert.equal(st.stats.coinsEarned || 0, before.earned);
  assert.equal(st.hearts, before.hearts); assert.equal(st.heartsTotal, before.heartsTotal);
  assert.equal(st.daily.care, before.care);
  assert.deepEqual(t.fish.map((f) => f.natsuki), before.natsuki);
  assert.equal(st.stats.feed || 0, before.feed);
  assert.equal(st.stats.waterChange || 0, before.wc);
  assert.equal(st.stats.waterChangeAll || 0, before.wcAll);
  assert.equal(st.stats.scoop || 0, before.scoop);
});

test('つけて いない すいそう・そうこに しまった すいそう は うごかない（時間が とまる）', () => {
  const st = gifted();
  const t = st.tanks[1];
  addFish(st, 'medaka', t);
  AC().attach(st, t);
  const r = sim.storeTank(st, t.id);
  assert.ok(r.ok, r.reason);
  t.fish[0].onaka = 10; t.clean = 10; t.waste = 9;
  // つけて いない へやの すいそう も うごかない
  const u = st.tanks[0];
  u.fish[0].onaka = 10;
  const ev = step(st, 5);
  assert.ok(!ev.some((e) => e.type === 'autoCare'));
  assert.equal(t.fish[0].onaka, 10); assert.equal(t.clean, 10); assert.equal(t.waste, 9);
  assert.ok(u.fish[0].onaka < 10);
  // そうこに あっても かずには はいる（3 の まま）・だしたら また うごく
  assert.equal(AC().total(st), 3);
  assert.ok(sim.storeTank(st, st.tanks[st.tanks.length - 1].id).ok);   // へやに あきを つくる
  assert.ok(sim.takeOutTank(st, t.id).ok);
  step(st, 1);
  assert.equal(t.fish[0].onaka, 75);
});

test('じどう えさやり・おそうじロボ と いっしょでも こわれない（2にち まわして かずが まもられる）', () => {
  const st = gifted();
  const t = st.tanks[0];
  t.decor.push('auto_feeder', 'clean_robot');
  AC().attach(st, t);
  for (let i = 0; i < 2 * 24 * 12; i++) step(st, 5);
  for (const f of t.fish) { assert.ok(f.onaka >= R.feedBelow - 1, `おなか ${f.onaka}`); assert.ok(f.onaka <= 100); }
  assert.ok(t.clean >= R.cleanBelow - 1, `きれいさ ${t.clean}`);
  assert.ok(t.waste < R.wasteAt, `ごみ ${t.waste}`);
  assert.equal(AC().total(st), 3);
});
