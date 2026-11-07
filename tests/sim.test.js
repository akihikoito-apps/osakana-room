// sim.js の 計算の テスト（点検係）。node --test tests/sim.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, freshState, addFish, seeded, SOLD_FISH, balance, missions } from './_lib.js';

const B = balance;
const HOUR = 60, DAY = 1440;
const allFish = (st) => st.tanks.flatMap((t) => t.fish);

// ---------------- けんこう は 10 より 下がらない ----------------
test('さいあくの みずで 30にち ほうちしても けんこう は 10 より 下がらない（ぜんしゅるい）', () => {
  for (const sp of SOLD_FISH) {
    const st = freshState();
    addFish(st, sp.id); addFish(st, sp.id);
    const t = st.tanks[0];
    const rnd = seeded(7);
    let minH = 100;
    for (let h = 0; h < 30 * 24; h++) {
      t.temp = h % 48 < 24 ? 0 : 40; t.clean = 0; t.air = 0; t.leftover = B.CLEAN.leftoverMax;
      for (const f of t.fish) f.onaka = 0;
      sim.tick(st, HOUR, rnd);
      for (const f of t.fish) {
        assert.ok(Number.isFinite(f.health), `${sp.id} health が かずで ない: ${f.health}`);
        minH = Math.min(minH, f.health);
      }
    }
    assert.ok(minH >= B.HEALTH.min, `${sp.id} の けんこう が ${minH} まで 下がった`);
    assert.equal(minH, B.HEALTH.min, `${sp.id}: さいあくなら ${B.HEALTH.min} に はりつく はず`);
  }
});

test('いっきに 60にちぶん すすめても けんこう 10〜100・あたいは かずの まま', () => {
  const st = freshState();
  for (const id of ['goldfish', 'betta', 'angelfish', 'red_bee_shrimp']) addFish(st, id);   // にがて だらけ
  const t = st.tanks[0];
  t.clean = 0; t.air = 0;
  sim.tick(st, 60 * DAY, seeded(3));
  for (const f of t.fish) {
    assert.ok(f.health >= 10 && f.health <= 100, `health=${f.health}`);
    for (const k of ['onaka', 'mood', 'natsuki', 'grow']) assert.ok(Number.isFinite(f[k]), `${k}=${f[k]}`);
  }
  for (const k of ['temp', 'clean', 'air', 'leftover']) assert.ok(Number.isFinite(t[k]), `${k}=${t[k]}`);
});

test('こわれた あたい（NaN・マイナス）が 入っても normalize で 10 いじょうに もどる', () => {
  const st = freshState();
  const f = addFish(st, 'medaka');
  f.health = -50; f.onaka = NaN; f.mood = 'x';
  sim.normalize(st);
  assert.ok(f.health >= 10);
  assert.ok(Number.isFinite(f.onaka) && Number.isFinite(f.mood));
  sim.tick(st, DAY);
  assert.ok(f.health >= 10);
});

test('チュートリアル中は けんこう・ごきげん が 下がらない', () => {
  const st = freshState({ tutorialDone: false });
  const f = addFish(st, 'guppy');
  const h0 = f.health, m0 = f.mood;
  const t = st.tanks[0];
  for (let h = 0; h < 48; h++) { t.clean = 0; t.air = 0; t.temp = 5; sim.tick(st, HOUR); }
  assert.ok(f.health >= h0, `health ${h0} → ${f.health}`);
  assert.ok(f.mood >= m0 - 1e-9, `mood ${m0} → ${f.mood}`);
});

// ---------------- 成長 3段階 ----------------
test('よい じょうたいなら ちびっこ → おとな → ビッグ の じゅんに そだち、ビッグで とまる', () => {
  for (const sp of SOLD_FISH) {
    const st = freshState();
    st.tanks[0].decor.push('heater');
    st.tanks[0].temp = 25;
    const f = addFish(st, sp.id);
    const t = st.tanks[0];
    const grows = [];
    let hours = 0;
    while (f.stage < 2 && hours < 24 * 60) {
      f.onaka = 80; t.clean = 100; t.air = 80;
      if (sp.temp.min > 25 || sp.temp.max < 25) t.temp = sp.temp.best;
      for (const ev of sim.tick(st, HOUR, seeded(hours + 1))) if (ev.type === 'grow') grows.push(ev.stage);
      hours++;
    }
    assert.deepEqual(grows, [1, 2], `${sp.id}: grow の できごと ${JSON.stringify(grows)}`);
    const need = (sp.growDays[0] + sp.growDays[1]) * B.GROW.hoursPerGrowDay;
    assert.ok(Math.abs(hours - need) <= 2, `${sp.id}: ビッグまで ${hours} じかん（よてい ${need}）`);
    for (let h = 0; h < 100; h++) { f.onaka = 80; sim.tick(st, HOUR); }
    assert.equal(f.stage, 2, 'ビッグより 大きく ならない');
    assert.equal(sim.growRatio(f), 1);
    assert.equal(st.stats.maxStage, 2);
  }
});

test('えさの そだちボーナスは 1日 4かい まで', () => {
  const st = freshState();
  const f = addFish(st, 'medaka');
  let now = 1e9;
  const g0 = f.grow;
  for (let i = 0; i < 10; i++) {
    f.onaka = 10;
    assert.equal(sim.feedStart(st, st.tanks[0], 'food_flake', now).ok, i === 0 ? false : true, 'えさを もつ まえは だめ');
    if (i === 0) { st.inv.food_flake = 1; assert.ok(sim.feedStart(st, st.tanks[0], 'food_flake', now).ok); }
    sim.feedEat(st, f.uid, now + 1000);
    sim.feedEnd(st);
    now += 6000;
  }
  assert.equal(f.grow - g0, B.GROW.feedBonusPerDay * B.GROW.feedBonusHours);
});

// ---------------- コインの 1日の 上限 ----------------
function feedOnce(st, now, makeHungry = true) {
  const t = st.tanks[0];
  if (makeHungry) for (const f of t.fish) f.onaka = 10;
  const r = sim.feedStart(st, t, 'food_flake', now);
  let coin = 0;
  if (r.ok) for (const f of t.fish) coin += sim.feedEat(st, f.uid, now + 500)?.coin || 0;
  coin += 0;
  sim.feedEnd(st);
  return { r, coin };
}

test('お世話の コインは 1日 50 まで（えさ 4かい・みずかえ 3かい の かいすう上限も）', () => {
  const st = freshState();
  for (const id of ['medaka', 'medaka', 'guppy']) addFish(st, id);
  st.coins = 0;
  st.inv.food_flake = 1; st.inv.water_change = 1;
  let now = 1e9;
  for (let day = 0; day < 3; day++) {
    const c0 = st.coins;
    let feedCoin = 0, waterCoin = 0;
    for (let i = 0; i < 40; i++) {
      feedCoin += feedOnce(st, now).coin; now += 6000;
      st.tanks[0].clean = 0;
      waterCoin += sim.waterChange(st).coin;
    }
    assert.ok(feedCoin <= B.COIN.care.feed.coin * B.COIN.care.feed.perDay, `えさ ${feedCoin}`);
    assert.ok(waterCoin <= B.COIN.care.waterChange.coin * B.COIN.care.waterChange.perDay, `みずかえ ${waterCoin}`);
    assert.ok(st.coins - c0 <= B.COIN.careDailyCap, `1日の お世話 ${st.coins - c0}`);
    assert.ok(st.daily.care <= B.COIN.careDailyCap);
    // つぎの日へ（ありがとうが 入らない ように ごきげんを 下げて すすめる）
    for (const f of allFish(st)) f.mood = 0;
    const d0 = st.daily.day;
    while (st.daily.day === d0) { for (const f of allFish(st)) { f.mood = 0; f.onaka = 50; } sim.tick(st, HOUR, () => 0.99); }
    assert.equal(st.daily.care, 0, 'あさ 6:00 で もどる');
  }
});

test('ありがとうの コインは 1日 1すいそう 4かい・1ぴき 1かい まで', () => {
  const st = freshState();
  for (const id of ['medaka', 'medaka', 'medaka', 'neon_tetra', 'neon_tetra', 'red_bee_shrimp']) addFish(st, id);
  const t = st.tanks[0];
  t.decor.push('heater', 'plant', 'light'); t.temp = 25;
  st.coins = 0;
  const rnd = () => 0;           // いつも あたり
  const perDay = {};
  for (let h = 0; h < 24 * 10; h++) {
    for (const f of t.fish) { f.onaka = 80; f.health = 100; f.mood = 100; }
    t.clean = 100; t.air = 80;
    for (const ev of sim.tick(st, HOUR, rnd)) {
      if (ev.type !== 'thanks') continue;
      const d = (perDay[st.daily.day] ||= { n: 0, coin: 0, who: {} });
      d.n++; d.coin += ev.coin; d.who[ev.uid] = (d.who[ev.uid] || 0) + 1;
    }
  }
  const T = B.COIN.thanks;
  const days = Object.values(perDay);
  assert.ok(days.length >= 8, 'ありがとうが でている');
  for (const d of days) {
    assert.ok(d.n <= T.perTankPerDay, `1日 ${d.n} かい`);
    for (const n of Object.values(d.who)) assert.ok(n <= T.perFishPerDay);
    assert.ok(d.coin <= T.perTankPerDay * (T.coinBase + T.coinPerRarity * 5));
  }
});

test('ありがとうは チュートリアル中には でない', () => {
  const st = freshState({ tutorialDone: false });
  addFish(st, 'medaka');
  let n = 0;
  for (let h = 0; h < 48; h++) { for (const f of allFish(st)) { f.onaka = 80; f.health = 100; f.mood = 100; } n += sim.tick(st, HOUR, () => 0).filter((e) => e.type === 'thanks').length; }
  assert.equal(n, 0);
});

// ---------------- 連打で かせげない ----------------
test('えさ連打：ロック中は busy、1回の えさやりで コインは 1かいだけ、おなか いっぱいなら おとさない', () => {
  const st = freshState();
  const a = addFish(st, 'medaka'), b = addFish(st, 'medaka');
  st.coins = 0; st.inv.food_flake = 1;
  let now = 5e9;
  a.onaka = 10; b.onaka = 10;
  assert.ok(sim.feedStart(st, st.tanks[0], 'food_flake', now).ok);
  for (let i = 1; i < 10; i++) assert.equal(sim.feedStart(st, st.tanks[0], 'food_flake', now + i * 400).reason, 'busy');
  const c1 = sim.feedEat(st, a.uid, now + 1000);
  const c2 = sim.feedEat(st, b.uid, now + 1000);
  const c3 = sim.feedEat(st, a.uid, now + 1200);
  assert.equal(c1.coin, B.COIN.care.feed.coin);
  assert.equal(c2.coin, 0, '2ひきめは コインなし（1回の えさやりで 1かい）');
  assert.equal(c3, null, 'おなじ魚は 1回の えさやりで 1かい');
  sim.feedEnd(st);
  // いっぱいのとき
  a.onaka = 95; b.onaka = 95;
  const r = sim.feedStart(st, st.tanks[0], 'food_flake', now + 10000);
  assert.equal(r.ok, false); assert.equal(r.reason, 'full');
  // おなかが すいていない（80 いじょう）魚だけが たべても コインなし
  a.onaka = 85; b.onaka = 85;
  assert.ok(sim.feedStart(st, st.tanks[0], 'food_flake', now + 20000).ok);
  assert.equal(sim.feedEat(st, a.uid, now + 20500).coin, 0);
  sim.feedEnd(st);
  // 時間ぎれ後の eat は うけつけない
  a.onaka = 10;
  assert.ok(sim.feedStart(st, st.tanks[0], 'food_flake', now + 30000).ok);
  assert.equal(sim.feedEat(st, a.uid, now + 30000 + sim.FEED_WINDOW_MS + 1), null);
  sim.feedEnd(st);
});

test('そうじ連打・なでる連打・みずかえ連打では コインが ふえない', () => {
  const st = freshState();
  const f = addFish(st, 'medaka');
  st.coins = 0; st.inv.water_change = 1;
  const t = st.tanks[0];
  // そうじ
  t.leftover = 3;
  const s1 = sim.scoop(st);
  assert.ok(s1.ok); assert.equal(s1.coin, 0);
  for (let i = 0; i < 20; i++) assert.equal(sim.scoop(st).ok, false);
  assert.equal(st.stats.scoop, 1);
  // ちょっとだけの たべのこし（0.5）は かぞえない
  t.leftover = 0.5; sim.scoop(st);
  assert.equal(st.stats.scoop, 1);
  // なでる
  let now = 1e10;
  for (let i = 0; i < 200; i++) sim.pet(st, f.uid, now + i * 100);
  assert.ok(f.natsuki <= B.BOND.pet * B.BOND.petPerDay);
  // みずかえ（きれいな みずでは コインなし）
  t.clean = 100;
  for (let i = 0; i < 20; i++) assert.equal(sim.waterChange(st).coin, 0);
  assert.equal(st.coins, 0, 'コインは 0 の まま');
  assert.equal(st.stats.waterChange || 0, 0, 'きれいな ときの みずかえは ミッションに かぞえない');
});

// ---------------- ミッション ----------------
test('ミッション：チュートリアル中は たっせい しない・たっせいで うけとれる・2かい うけとれない', () => {
  const st = freshState({ tutorialDone: false });
  addFish(st, 'medaka');
  st.stats.feed = 3;
  assert.deepEqual(sim.checkMissions(st), []);
  st.tutorial.done = true;
  const ev = sim.checkMissions(st);
  assert.deepEqual(ev.map((e) => e.id), ['m_feed3']);
  assert.equal(sim.claimMission(st, 'm_pet5').ok, false, 'まだの ものは うけとれない');
  const c0 = st.coins;
  const r = sim.claimMission(st, 'm_feed3');
  assert.ok(r.ok); assert.equal(st.coins - c0, 30);
  assert.equal(sim.claimMission(st, 'm_feed3').ok, false, '2かいめは だめ');
  assert.equal(st.coins - c0, 30);
  assert.deepEqual(sim.visibleMissions(st).map((m) => m.id), ['m_pet5', 'm_water1', 'm_fish2']);
  assert.equal(sim.claimMission(st, 'nope').ok, false);
});

test('ミッション：見えている 3つ だけ たっせい する（さきの ものは まだ）', () => {
  const st = freshState();
  for (const id of ['medaka', 'guppy', 'neon_tetra', 'corydoras']) addFish(st, id);
  sim.checkMissions(st);
  assert.ok(st.missions.done.m_fish2 === undefined, 'm_fish2 は 4ばんめ なので まだ');
  assert.equal(sim.visibleMissions(st).length, missions.MISSION_VISIBLE);
});

test('ふつうに あそぶと v0.1 の ミッションが ぜんぶ うけとれる（30にち いない）', () => {
  const st = freshState();
  st.coins = 250;
  st.inv.food_flake = 1; st.inv.water_change = 1;
  const t = st.tanks[0];
  t.decor.push('stone', 'air_pump', 'heater');
  const rnd = seeded(11);
  let now = 1e11;
  const wish = ['medaka', 'medaka', 'minami_shrimp', 'plant', 'filter', 'neon_tetra', 'light', 'corydoras', 'plant'];
  let day = 0;
  for (let h = 0; h < 30 * 24 && Object.keys(st.missions.claimed).length < missions.MISSIONS.length; h++) {
    // かいもの
    while (wish.length) {
      const id = wish[0];
      const isFish = !!sim.data().fishById[id];
      const r = isFish ? sim.buyFish(st, id) : sim.buyItem(st, id);
      if (!r.ok) break;
      wish.shift();
    }
    // 3じかんごとに えさ、よごれたら みずかえ、たべのこしは そうじ、なでる
    if (h % 3 === 0) { feedOnce(st, now, false); now += 6000; }
    if (t.clean < 75) sim.waterChange(st);
    if (t.leftover >= 1) sim.scoop(st);
    for (const f of t.fish) { sim.pet(st, f.uid, now); }
    now += 31000;
    sim.tick(st, HOUR, rnd);
    for (const m of sim.visibleMissions(st)) if (st.missions.done[m.id]) sim.claimMission(st, m.id);
    day = st.daily.day;
  }
  const left = missions.MISSIONS.filter((m) => !st.missions.claimed[m.id]).map((m) => m.id);
  assert.deepEqual(left, [], `${day}にちめ で のこり: ${left.join(', ')}`);
});
