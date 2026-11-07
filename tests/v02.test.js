// v0.2 の テスト（点検係）：解放・水槽を ふやす・海水・ハート・コインの 上限・v0.1 セーブの 移行。
// 仕様は docs/仕様_v0.2.md（数値が 食い違ったら js/data が 正しい）。テストは 仕様に あわせて 書き、
// 実装が ちがえば ここで 落ちる（＝不具合として 持ち主の 係へ）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, S, freshState, addFish, seeded, FISH, ITEMS, SALT_FISH, FRESH_FISH, balance, missions, hints } from './_lib.js';

const B = balance;
const HOUR = 60;
const itemById = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const rich = (st) => { st.coins = 99999; return st; };
const tick = (st, min) => sim.tick(st, min, () => 0.99);    // ありがとうが 出にくい 乱数

// ---------------- 解放 ----------------
test('解放：はじめは かぎ。1つめの すいそうに 生きもの 5ひきでは ひらかない', () => {
  const st = rich(freshState());
  for (const id of ['medaka', 'medaka', 'neon_tetra', 'minami_shrimp', 'ishimaki']) assert.ok(sim.buyFish(st, id).ok, id);
  assert.equal(st.unlocks.tank6, undefined);
  for (const id of ['ramshorn', 'platy', 'clownfish']) assert.equal(sim.canBuyFish(st, id).reason, 'locked', id);
  for (const id of ['tank_salt', 'tank_fresh', 'liverock', 'coral']) assert.equal(sim.canBuyItem(st, id).reason, 'locked', id);
  assert.equal(sim.canBuyFish(st, 'ishimaki').ok, true, 'イシマキガイは はじめから');
});

test('解放：6ぴき目（エビ・かいも 1ぴき）で ひらき、unlock の できごと と お知らせが 出る', () => {
  const st = rich(freshState());
  for (const id of ['medaka', 'medaka', 'neon_tetra', 'minami_shrimp', 'ishimaki']) sim.buyFish(st, id);
  const r = sim.buyFish(st, 'ishimaki');
  assert.ok(r.ok);
  assert.ok(st.unlocks.tank6, 'ひらいていない');
  assert.ok(r.events.some((e) => e.type === 'unlock' && e.key === 'tank6'), 'unlock の できごとが ない');
  assert.equal(st.notices.tank6, true);
  for (const id of ['ramshorn', 'platy', 'cherry_barb', 'otocinclus', 'rummy_nose', 'dwarf_gourami']) assert.notEqual(sim.canBuyFish(st, id).reason, 'locked', id);
  for (const id of ['tank_salt', 'tank_fresh']) assert.ok(sim.canBuyItem(st, id).ok, id);
});

test('解放：6ぴきに とどかなくても 1つめの すいそうが いっぱい（space）なら ひらく（キンギョ 3びき）', () => {
  const st = rich(freshState());
  for (let i = 0; i < 3; i++) sim.buyFish(st, 'goldfish');
  assert.equal(st.tanks[0].fish.length, 3);
  assert.ok(st.unlocks.tank6, 'いっぱいでも ひらかない（つみ に なる）');
});

test('解放：2つめ いこうの すいそうの 生きものは かぞえない', () => {
  const st = rich(freshState());
  sim.buyFish(st, 'medaka');
  const t2 = sim.addTank(st, 'fresh', ['heater']);
  for (let i = 0; i < 6; i++) sim.buyFish(st, 'medaka', t2);
  assert.equal(st.unlocks.tank6, undefined);
});

test('解放：いちど ひらいたら、あとで 数が へっても・よみなおしても もどらない', () => {
  const st = rich(freshState());
  for (let i = 0; i < 6; i++) sim.buyFish(st, 'medaka');
  const day = st.unlocks.tank6;
  assert.ok(day);
  st.tanks[0].fish.splice(0, 5);       // （v0.2 では てばなせないが、こわれた セーブ などで へった とき）
  sim.normalize(st);
  sim.checkUnlock(st);
  tick(st, 3 * 1440);
  assert.equal(st.unlocks.tank6, day);
  assert.ok(sim.canBuyItem(st, 'tank_salt').ok);
  // セーブ → ロード
  const back = S.migrate(JSON.parse(JSON.stringify(st)), sim.initialValues());
  sim.normalize(back);
  assert.equal(back.unlocks.tank6, day);
});

test('解放の お知らせの ことば：本人の ことばに あわせて まとめ役が きめた 文（仕様 2章）', () => {
  const banner = B.UNLOCK.tank6.banner;
  assert.equal(banner.length, 2);
  assert.equal(banner[0], 'うみの すいそうが かえるように なったよ！ おみせで 1000コイン だよ。');
  assert.equal(banner[1], 'あたらしい さかなや かい、かわの すいそうも おみせに ふえたよ！');
  assert.equal(B.UNLOCK.tank6.lockedLine, hints.SHOP_LINES.locked, 'かぎつきカードの 文が 2かしょで ちがう');
});

// ---------------- 水槽を ふやす ----------------
test('すいそうの 値段：うみ 1000・かわ 800（なんこめでも おなじ）、ヒーター・ブクブクつき・25ど で はじまる', () => {
  assert.equal(itemById.tank_salt.price, 1000);
  assert.equal(itemById.tank_fresh.price, 800);
  const st = freshState();
  st.unlocks.tank6 = 1;
  st.coins = 999;
  assert.equal(sim.canBuyItem(st, 'tank_salt').reason, 'coins', '999 で うみの すいそうが かえて しまう');
  st.coins = 1000;
  const r = sim.buyItem(st, 'tank_salt');
  assert.ok(r.ok);
  assert.equal(st.coins, 0);
  assert.equal(r.tank.water, 'salt');
  assert.deepEqual([...r.tank.decor].sort(), ['air_pump', 'heater']);
  assert.equal(r.tank.temp, 25);
  assert.equal(st.tanks.length, 2);
  st.coins = 1000;
  assert.ok(sim.buyItem(st, 'tank_salt').ok, '2つめも 1000');
  assert.equal(st.coins, 0);
});

test('すいそうは へやに 6つ まで（はじめの 1つ を ふくむ）・わく（slot）と id が かぶらない', () => {
  const st = rich(freshState());
  st.unlocks.tank6 = 1;
  for (let i = 0; i < 5; i++) assert.ok(sim.buyItem(st, i % 2 ? 'tank_salt' : 'tank_fresh').ok, `${i + 2}つめ`);
  assert.equal(st.tanks.length, 6);
  for (const id of ['tank_salt', 'tank_fresh']) {
    const c = sim.canBuyItem(st, id);
    assert.equal(c.ok, false); assert.equal(c.reason, 'tankMax');
    assert.equal(sim.buyItem(st, id).ok, false);
  }
  assert.equal(st.tanks.length, 6);
  assert.deepEqual(st.tanks.map((t) => t.slot).sort(), [0, 1, 2, 3, 4, 5]);
  assert.equal(new Set(st.tanks.map((t) => t.id)).size, 6);
  assert.equal(B.TANKS.max, 6);
});

test('すべての すいそうの 時間が いっしょに すすむ（見ていない すいそうも よごれる・おなかが へる）', () => {
  const st = rich(freshState());
  const a = addFish(st, 'medaka');
  const b = addFish(st, 'clownfish');
  const o = [a.onaka, b.onaka];
  const c2 = st.tanks[1].clean;
  tick(st, 6 * HOUR);
  assert.ok(a.onaka < o[0] && b.onaka < o[1]);
  assert.ok(st.tanks[1].clean < c2);
});

// ---------------- 海水と 淡水が まざらない ----------------
test('うみの 生きものは かわの すいそうに、かわの 生きものは うみの すいそうに 入らない', () => {
  const st = rich(freshState());
  st.unlocks.tank6 = 1;
  const salt = sim.addTank(st, 'salt', ['heater', 'air_pump']);
  salt.decor.push('liverock');
  for (const sp of SALT_FISH) assert.equal(sim.canBuyFish(st, sp.id, st.tanks[0]).reason, 'water', sp.id);
  for (const sp of FRESH_FISH) assert.equal(sim.canBuyFish(st, sp.id, salt).reason, 'water', sp.id);
  for (const sp of SALT_FISH) assert.ok(sim.canBuyFish(st, sp.id, salt).ok, `${sp.id} が うみの すいそうに 入らない`);
  // 品物
  for (const id of ['plant', 'driftwood']) assert.equal(sim.canBuyItem(st, id, salt).reason, 'water', id);
  for (const id of ['liverock', 'coral']) assert.equal(sim.canBuyItem(st, id, st.tanks[0]).reason, 'water', id);
  for (const id of ['stone', 'rock', 'filter', 'light']) assert.ok(sim.canBuyItem(st, id, salt).ok, `${id} は どちらにも 入る`);
  // 相性表に 淡水×海水の くみあわせは 書かない
  const water = Object.fromEntries(FISH.map((f) => [f.id, f.water]));
  return import('../js/data/compat.js').then(({ COMPAT }) => {
    const mixed = Object.keys(COMPAT).filter((k) => { const [x, y] = k.split('|'); return water[x] !== water[y]; });
    assert.deepEqual(mixed, []);
  });
});

test('ニシキテグリは ライブロックが ない すいそうでは かえない', () => {
  const st = rich(freshState());
  st.unlocks.tank6 = 1;
  const salt = sim.addTank(st, 'salt', ['heater', 'air_pump']);
  const c = sim.canBuyFish(st, 'mandarin', salt);
  assert.equal(c.reason, 'needs'); assert.equal(c.item, 'liverock');
  assert.ok(sim.buyItem(st, 'liverock', salt).ok);
  assert.ok(sim.canBuyFish(st, 'mandarin', salt).ok);
});

test('つかう 水槽を えらべば、品物・器具の max は すいそう ごと', () => {
  const st = rich(freshState());
  st.unlocks.tank6 = 1;
  const t2 = sim.buyItem(st, 'tank_fresh').tank;
  assert.ok(sim.buyItem(st, 'filter').ok);
  assert.equal(sim.canBuyItem(st, 'filter').reason, 'max');
  assert.ok(sim.canBuyItem(st, 'filter', t2).ok, '2つめの すいそうにも フィルターを 入れられる');
});

// ---------------- ハート ----------------
function heartState() {
  const st = rich(freshState());
  st.unlocks.tank6 = 1;
  const fish = [];
  for (let i = 0; i < 5; i++) fish.push(addFish(st, 'medaka'));
  for (let i = 0; i < 5; i++) fish.push(addFish(st, 'clownfish'));
  for (const f of fish) f.health = 100;
  return { st, fish, tank: (f) => st.tanks.find((t) => t.fish.includes(f)) };
}

test('ハート：なでると +1、おなじ魚は ゲーム内 72ふん（balance HEART.perFishEveryGameMinutes）たつまで 出ない', () => {
  const { st, fish, tank } = heartState();
  const f = fish[0];
  let now = 1e12;
  const r1 = sim.pet(st, f.uid, now, tank(f));
  assert.equal(r1.heart, true);
  assert.equal(st.hearts, 1); assert.equal(st.heartsTotal, 1); assert.equal(st.daily.hearts, 1);
  // 現実の 時間だけ すすめても（ゲームの 時計が とまっていれば）出ない
  for (let i = 0; i < 20; i++) { now += 60000; assert.equal(sim.pet(st, f.uid, now, tank(f)).heart, false, '時計が とまって いるのに 出た'); }
  const wait = B.HEART.perFishEveryGameMinutes;
  assert.equal(wait, 72);
  st.clock.min += wait - 1;   // 71ふん
  now += 60000;
  assert.equal(sim.pet(st, f.uid, now, tank(f)).heart, false, `ゲーム ${wait - 1}ふん で もう 出た（仕様は ${wait}ふん）`);
  st.clock.min += 1;
  now += 60000;
  assert.equal(sim.pet(st, f.uid, now, tank(f)).heart, true, `${wait}ふん たっても 出ない`);
  assert.equal(st.hearts, 2);
});

test('ハート：1日に ぜんぶの すいそう あわせて 20こ まで・つぎの 日の あさに もどる', () => {
  const { st, fish, tank } = heartState();
  let now = 1e12, got = 0;
  for (let round = 0; round < 6; round++) {
    for (const f of fish) { now += 4000; if (sim.pet(st, f.uid, now, tank(f)).heart) got++; }
    st.clock.min += 80; st.clock.judged = Math.floor(st.clock.min / 60);   // 時計だけ すすめる（日は かえない）
    if (sim.gameDay(st.clock.min) !== st.daily.day) break;
  }
  assert.equal(got, B.HEART.perDay, `1日に ${got}こ`);
  assert.equal(st.daily.hearts, 20);
  // あさまで すすめる
  const d0 = st.daily.day;
  while (st.daily.day === d0) tick(st, HOUR);
  assert.equal(st.daily.hearts, 0);
  now += 4000;
  for (const f of fish) f.health = 100;
  assert.equal(sim.pet(st, fish[0].uid, now, tank(fish[0])).heart, true);
  assert.equal(st.heartsTotal, 21);
});

test('ハート：けんこう 40 みまんの 魚からは 出ない（なでる ことは できる）', () => {
  const { st, fish, tank } = heartState();
  const f = fish[0];
  f.health = 39;
  const r = sim.pet(st, f.uid, 1e12, tank(f));
  assert.equal(r.ok, true); assert.equal(r.heart, false); assert.equal(st.hearts, 0);
  f.health = 40;
  assert.equal(sim.pet(st, f.uid, 1e12 + 5000, tank(f)).heart, true);
});

test('ハート：ミッション hearts は heartsTotal で かぞえる', () => {
  const st = freshState();
  st.heartsTotal = 20; st.hearts = 3;
  const m = missions.MISSIONS.find((x) => x.id === 'm_hearts20');
  assert.deepEqual(sim.missionProgress(st, m), { now: 20, need: 20 });
});

// ---------------- コインの 上限（水槽の 数で ふえる） ----------------
function careDay(st, now) {
  let coin = 0;
  for (let i = 0; i < 10; i++) {
    for (const t of st.tanks) {
      for (const f of t.fish) f.onaka = 10;
      const r = sim.feedStart(st, t, 'food_flake', now);
      if (r.ok) for (const f of t.fish) coin += sim.feedEat(st, f.uid, now + 500)?.coin || 0;
      sim.feedEnd(st); now += 6000;
      t.clean = 0;
      coin += sim.waterChange(st, t).coin;
    }
  }
  return coin;
}

test('お世話コイン：1日の 上限は 50＋25×（生きものが いる すいそう−1）、回数の 上限は すいそう ごと', () => {
  for (const n of [1, 2, 3, 6]) {
    const st = freshState();
    st.inv.food_flake = 1; st.inv.water_change = 1; st.unlocks.tank6 = 1;
    for (let i = 1; i < n; i++) sim.addTank(st, i % 2 ? 'salt' : 'fresh', ['heater', 'air_pump']);
    for (const t of st.tanks) addFish(st, t.water === 'salt' ? 'clownfish' : 'medaka', t);
    st.coins = 0;
    const coin = careDay(st, 1e12);
    const cap = B.COIN.careDailyCap + B.MULTI_TANK.careDailyCapPerExtraTank * (n - 1);
    const perTank = B.COIN.care.feed.coin * B.COIN.care.feed.perDay + B.COIN.care.waterChange.coin * B.COIN.care.waterChange.perDay;
    assert.equal(coin, Math.min(cap, perTank * n), `すいそう ${n}つ で ${coin}（よてい ${Math.min(cap, perTank * n)}）`);
  }
});

function oneFishFiveEmpty() {
  const st = freshState();
  st.inv.food_flake = 1; st.inv.water_change = 1; st.unlocks.tank6 = 1;
  addFish(st, 'medaka', st.tanks[0]);
  const empties = [];
  for (let i = 0; i < 5; i++) empties.push(sim.addTank(st, 'fresh', ['heater', 'air_pump']));
  st.coins = 0;
  return { st, empties };
}

test('お世話コイン：からの すいそうの みずかえは コインなし（MULTI_TANK.emptyTankNoCareCoin）', () => {
  const { st, empties } = oneFishFiveEmpty();
  const got = empties.map((t) => { t.clean = 0; return sim.waterChange(st, t).coin; });
  assert.deepEqual(got, [0, 0, 0, 0, 0], `からの すいそうの みずかえで コイン ${got.join(',')}`);
});

test('お世話コイン：からの すいそうを ならべても 1日の 上限は ふえない', () => {
  const { st } = oneFishFiveEmpty();
  // 生きものが いる 1つめ だけで えさ4かい（24）＋みずかえ3かい（30）＝54。上限 50 で とまる はず
  const t = st.tanks[0];
  let now = 3e12;
  for (let i = 0; i < 6; i++) {
    for (const f of t.fish) f.onaka = 10;
    if (sim.feedStart(st, t, 'food_flake', now).ok) for (const f of t.fish) sim.feedEat(st, f.uid, now + 500);
    sim.feedEnd(st); now += 6000;
    t.clean = 0; sim.waterChange(st, t);
  }
  assert.ok(st.coins <= B.COIN.careDailyCap, `からの すいそう 5つ ある とき 1日 ${st.coins}（上限 ${B.COIN.careDailyCap} の はず。からの すいそうで 上限が ふえている）`);
});

test('ありがとう：すいそう ごとに 1日4かい、ぜんぶで 4＋3×（生きものが いる すいそう−1）かい まで', () => {
  for (const n of [1, 3, 6]) {
    const st = freshState();
    st.unlocks.tank6 = 1;
    for (let i = 1; i < n; i++) sim.addTank(st, 'fresh', ['heater', 'air_pump']);
    for (const t of st.tanks) { t.decor.push('heater'); t.temp = 25; for (let k = 0; k < 6; k++) addFish(st, 'medaka', t); }
    const per = {};
    for (let h = 0; h < 24 * 4; h++) {
      for (const t of st.tanks) { t.clean = 100; t.air = 80; for (const f of t.fish) { f.onaka = 80; f.health = 100; f.mood = 100; } }
      for (const ev of sim.tick(st, HOUR, () => 0)) if (ev.type === 'thanks') per[st.daily.day] = (per[st.daily.day] || 0) + 1;
    }
    const want = B.MULTI_TANK.thanksAllTanksBase + B.MULTI_TANK.thanksAllTanksPerExtra * (n - 1);
    const last = st.daily.day;      // さいごの 日は とちゅう なので のぞく
    const full = Object.entries(per).filter(([d]) => +d > 1 && +d < last).map(([, v]) => v);
    assert.ok(full.length >= 2);
    for (const v of full) assert.equal(v, want, `すいそう ${n}つ で 1日 ${v}かい（仕様 ${want}）`);
  }
});

// ---------------- かい・こけを たべる 魚 ----------------
test('かい と オトシンクルスは きれいさを すこし あげる（SNAIL.cleanPerHour、algaeEaterIds）', () => {
  const base = () => { const st = freshState(); st.unlocks.tank6 = 1; st.tanks[0].decor.push('heater'); st.tanks[0].temp = 25; return st; };
  const drop = (ids) => {
    const st = base();
    for (const id of ids) addFish(st, id, st.tanks[0]);
    st.tanks[0].clean = 50;
    tick(st, 10 * HOUR);
    return 50 - st.tanks[0].clean;
  };
  const sp = (id) => FISH.find((f) => f.id === id).space;
  // おなじ space どうしで くらべる
  const snail = drop(['ishimaki', 'ishimaki']);           // space 1
  const fish = drop(['medaka']);                           // space 1
  assert.ok(sp('ishimaki') * 2 === sp('medaka'));
  assert.ok(Math.abs((fish - snail) - 2 * B.SNAIL.cleanPerHour * 10) < 0.05, `かい: ${fish - snail}`);
  const oto = drop(['otocinclus']);
  assert.ok(Math.abs((fish - oto) - B.SNAIL.cleanPerHour * 10) < 0.05, `オトシンクルスが こけを たべていない（さ ${(fish - oto).toFixed(2)}）`);
});

// ---------------- そうじ ----------------
test('そうじ：たべのこし 0 でも おちない・コインと ミッションの かぞえは なし', () => {
  const st = freshState();
  addFish(st, 'medaka');
  st.tanks[0].leftover = 0;
  let r;
  assert.doesNotThrow(() => { r = sim.scoop(st, st.tanks[0]); });
  assert.equal(r.coin || 0, 0);
  assert.equal(st.stats.scoop || 0, 0);
  // 2つめの すいそうの そうじは その すいそうだけ
  st.unlocks.tank6 = 1;
  const t2 = sim.addTank(st, 'fresh', ['heater']);
  st.tanks[0].leftover = 3; t2.leftover = 3;
  sim.scoop(st, t2);
  assert.equal(t2.leftover, 0); assert.equal(st.tanks[0].leftover, 3);
});

// ---------------- v0.1 セーブの 移行 ----------------
const V01_SAVE = {
  v: 1, created: 1, coins: 321,
  clock: { min: 4000 },
  tanks: [{ id: 't1', water: 'fresh', temp: 25, clean: 80, air: 60, leftover: 1, decor: ['stone', 'air_pump', 'heater', 'plant'], equip: [],
    fish: ['medaka', 'medaka', 'minami_shrimp', 'neon_tetra', 'neon_tetra', 'corydoras'].map((id, i) => ({ uid: 'u' + i, speciesId: id, stage: 1, onaka: 60, health: 90, mood: 80, natsuki: 30 })) }],
  inv: { food_flake: 1, water_change: 1 }, owned: {}, dex: { medaka: { first: 1, count: 2 } },
  missions: { done: { m_feed3: 1, m_pet5: 2 }, claimed: { m_feed3: 1 }, prog: {} },
  stats: { feed: 5 }, daily: { day: 2, care: 10, thanks: 1 }, tutorial: { step: 12, done: true }, settings: { sound: true }, ui: { lastScreen: 'tank' },
};

test('v0.1 の セーブ：おちずに よめて、ハート 0・わく 0・おなじ キー、6ぴき いれば よんだ すぐ あとに 解放＋お知らせ', () => {
  setupLs();
  localStorage.setItem(S.SAVE_KEY, JSON.stringify(V01_SAVE));
  assert.equal(S.SAVE_KEY, 'osakana-room-save-v1');
  const st = S.load(sim.initialValues());
  sim.normalize(st);
  assert.equal(st.coins, 321);
  assert.equal(st.tanks.length, 1);
  assert.equal(st.tanks[0].slot, 0);
  assert.equal(st.tanks[0].fish.length, 6);
  assert.equal(st.hearts, 0); assert.equal(st.heartsTotal, 0); assert.equal(st.daily.hearts, 0);
  for (const f of st.tanks[0].fish) assert.ok(f.lastHeartMin < st.clock.min - 1000, 'lastHeartMin が すぐ もらえる あたいで ない');
  assert.ok(st.unlocks.tank6, 'よんだ すぐ あとに 解放されない');
  assert.equal(st.notices.tank6, true, 'お知らせが 出ない');
  assert.deepEqual(st.missions.claimed, { m_feed3: 1 });
  assert.equal(st.ui.tankId, 't1');
  // すぐ ハートが もらえる
  assert.equal(sim.pet(st, 'u0', 1e13, st.tanks[0]).heart, true);
  // 時間を すすめても おちない
  assert.doesNotThrow(() => sim.tick(st, 1440));
});

test('v0.1 の セーブ（5ひき）：解放しない・お知らせも 出ない', () => {
  setupLs();
  const s5 = JSON.parse(JSON.stringify(V01_SAVE));
  s5.tanks[0].fish.pop();
  localStorage.setItem(S.SAVE_KEY, JSON.stringify(s5));
  const st = S.load(sim.initialValues());
  sim.normalize(st);
  assert.equal(st.unlocks.tank6, undefined);
  assert.ok(!st.notices.tank6);
});

test('v0.2 の セーブ（水槽 6つ・わく が こわれた）も おちずに よめる', () => {
  setupLs();
  const st0 = rich(freshState());
  st0.unlocks.tank6 = 1;
  for (let i = 0; i < 5; i++) sim.buyItem(st0, i % 2 ? 'tank_salt' : 'tank_fresh');
  const raw = JSON.parse(JSON.stringify(st0));
  raw.tanks.forEach((t) => { t.slot = 3; });        // ぜんぶ おなじ わく
  raw.tanks.push({ ...raw.tanks[1], id: 't9' });    // 7つめ
  raw.ui.tankId = 'nope';
  localStorage.setItem(S.SAVE_KEY, JSON.stringify(raw));
  const st = S.load(sim.initialValues());
  sim.normalize(st);
  assert.ok(st.tanks.length <= 6, `すいそうが ${st.tanks.length}つ`);
  assert.equal(new Set(st.tanks.map((t) => t.slot)).size, st.tanks.length, 'わくが かさなる');
  assert.ok(st.tanks.some((t) => t.id === st.ui.tankId));
});

function setupLs() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
