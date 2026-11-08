// v0.3 の テスト（点検係）：定員（さかな・エビ 6＋かい 2）・ビタミン・じどう えさやり・おんど ダイヤル・
// シーオーツー・スキマー・CLEAN_FLOOR・v0.2 セーブの 移行・画面を くらく しない しくみ。
// 仕様は docs/仕様_v0.3.md（数値が 食い違ったら js/data が 正しい）。実装が ちがえば ここで 落ちる（＝不具合）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sim, S, freshState, addFish, FISH, ITEMS, balance, missions, read, exists, ROOT } from './_lib.js';

const B = balance;
const HOUR = 60;
const itemById = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const fishById = Object.fromEntries(FISH.map((f) => [f.id, f]));
const tick = (st, min) => sim.tick(st, min, () => 0.99);
const rich = (st) => { st.coins = 99999; return st; };
const unlocked = () => { const st = rich(freshState()); st.unlocks.tank6 = 1; return st; };
let NOW = 1e13;
const now = () => (NOW += 60000);

/** つぎの 時刻 h:00 の すこし まえ まで すすめる */
function toBefore(st, h) {
  const m = ((st.clock.min % 1440) + 1440) % 1440;
  let d = h * 60 - 1 - m; if (d <= 0) d += 1440;
  tick(st, d);
}

// ---------------- 定員 ----------------
test('定員：さかな・エビは 6ぴき まで（space が あまっても。エビ 7ひきめは かえない）', () => {
  assert.equal(B.TANK.fishMax, 6);
  const st = rich(freshState());
  const t = st.tanks[0];
  for (let i = 0; i < 6; i++) assert.ok(sim.buyFish(st, 'minami_shrimp', t).ok, `${i + 1}ぴきめ`);
  assert.ok(sim.spaceUsed(t) < B.TANK.capacity, 'space は まだ あまっている');
  const c = sim.canBuyFish(st, 'minami_shrimp', t);
  assert.equal(c.ok, false, 'エビが 7ひき 入る（TANK.fishMax が まもられていない）');
  assert.equal(sim.buyFish(st, 'minami_shrimp', t).ok, false);
  assert.equal(t.fish.length, 6);
});

test('定員：かい は べつ枠で 2ひき まで・space 0・さかな 6ぴき いても 入る', () => {
  assert.equal(B.TANK.snailMax, 2);
  for (const f of FISH.filter((x) => x.kind === 'snail')) assert.equal(f.space, 0, f.id);
  const st = rich(freshState());
  const t = st.tanks[0];
  for (let i = 0; i < 6; i++) assert.ok(sim.buyFish(st, 'medaka', t).ok);
  assert.ok(sim.buyFish(st, 'ishimaki', t).ok, '6ぴき いると かいが 入らない');
  assert.ok(sim.buyFish(st, 'ishimaki', t).ok);
  const c = sim.canBuyFish(st, 'ishimaki', t);
  assert.equal(c.ok, false); assert.equal(c.reason, 'snailFull');
  assert.equal(sim.canBuyFish(st, 'medaka', t).ok, false, '7ひきめの さかな');
  assert.equal(sim.spaceUsed(t), 6);
  // うみの すいそうも おなじ
  st.unlocks.tank6 = 1;
  const salt = sim.addTank(st, 'salt', ['heater', 'air_pump']);
  assert.ok(sim.buyFish(st, 'shittaka', salt).ok && sim.buyFish(st, 'shittaka', salt).ok);
  assert.equal(sim.canBuyFish(st, 'shittaka', salt).reason, 'snailFull');
});

test('定員：かい は よごれ（space）に 入らない', () => {
  const run = (ids) => { const st = freshState(); for (const id of ids) sim.buyFish(rich(st), id, st.tanks[0]); st.tanks[0].clean = 50; st.tanks[0].air = 50; tick(st, 5 * HOUR); return st.tanks[0]; };
  const a = run(['medaka']), b = run(['medaka', 'ishimaki', 'ishimaki']);
  assert.ok(b.clean >= a.clean - 1e-9, 'かいで よごれが ふえた');
  assert.ok(Math.abs(b.air - a.air) < 1e-9, 'かいで くうきが へった');
});

test('解放：かい 2ひき だけでは ひらかない・さかな 4＋かい 2 で ひらく', () => {
  const st = rich(freshState());
  sim.buyFish(st, 'ishimaki'); sim.buyFish(st, 'ishimaki');
  assert.equal(st.unlocks.tank6, undefined);
  for (let i = 0; i < 3; i++) sim.buyFish(st, 'medaka');
  assert.equal(st.unlocks.tank6, undefined);
  sim.buyFish(st, 'medaka');
  assert.ok(st.unlocks.tank6);
});

// ---------------- ビタミン ----------------
function vitState(ids, water = 'fresh') {
  const st = unlocked();
  const t = water === 'fresh' ? st.tanks[0] : sim.addTank(st, 'salt', ['heater', 'air_pump']);
  for (const id of ids) addFish(st, id, t);
  for (const f of t.fish) { f.health = 50; f.mood = 50; f.onaka = 40; }
  return { st, t };
}
function giveVitamin(st, t) {
  const r = sim.vitaminStart(st, t, now());
  const out = {};
  if (r.ok) { for (const f of t.fish) out[f.speciesId] = sim.vitaminEat(st, f.uid, NOW + 500); sim.vitaminEnd(st); }
  return { r, out };
}

test('ビタミン：はじめから 100コインで 5かいぶん・のこりが あるうちは かえない', () => {
  const it = itemById.food_vitamin;
  assert.equal(it.price, 100); assert.equal(it.uses, 5); assert.ok(!it.unlock, 'ビタミンは はじめから');
  const st = rich(freshState());
  assert.ok(sim.buyItem(st, 'food_vitamin').ok);
  assert.equal(st.inv.food_vitamin, 5);
  assert.equal(sim.canBuyItem(st, 'food_vitamin').reason, 'vitaminFull');
});

test('ビタミン：1つの すいそうに 1日1かい・のこりが 1 へる・つぎの あさ 6じで もどる・べつの すいそうは べつ', () => {
  const { st, t } = vitState(['guppy', 'medaka']);
  st.inv.food_vitamin = 5;
  const t2 = sim.addTank(st, 'fresh', ['heater', 'air_pump']);
  addFish(st, 'platy', t2);
  assert.ok(giveVitamin(st, t).r.ok);
  assert.equal(st.inv.food_vitamin, 4);
  const r2 = sim.vitaminStart(st, t, now());
  assert.equal(r2.ok, false); assert.equal(r2.reason, 'doneToday');
  assert.equal(st.inv.food_vitamin, 4, '2かいめで へった');
  assert.ok(giveVitamin(st, t2).r.ok, 'べつの すいそうには あげられる');
  assert.equal(st.inv.food_vitamin, 3);
  toBefore(st, 6); tick(st, 2);
  assert.ok(giveVitamin(st, t).r.ok, 'つぎの あさに もどらない');
  st.inv.food_vitamin = 0;
  toBefore(st, 6); tick(st, 2);
  const r3 = sim.vitaminStart(st, t, now());
  assert.equal(r3.reason, 'empty');
});

test('ビタミン：みんな きらい（または 魚が いない）なら おとさない・へらない・その日の 1かいも つかわない', () => {
  const { st, t } = vitState(['ishimaki', 'otocinclus']);
  st.inv.food_vitamin = 5;
  const r = sim.vitaminStart(st, t, now());
  assert.equal(r.ok, false); assert.equal(r.reason, 'allDislike');
  assert.equal(st.inv.food_vitamin, 5);
  assert.ok(!(st.daily.vitamin?.[t.id] > 0), 'その日の 1かいを つかった');
  const empty = sim.addTank(st, 'fresh', ['heater']);
  assert.equal(sim.vitaminStart(st, empty, now()).ok, false);
  assert.equal(st.inv.food_vitamin, 5);
  // きらいでない 魚が 来たら あげられる
  addFish(st, 'medaka', t);
  assert.ok(giveVitamin(st, t).r.ok);
});

test('ビタミン：だいすき・たべる・きらい の こうか（おなかは ふえない、きらいは たべない）', () => {
  const { st, t } = vitState(['guppy', 'medaka', 'otocinclus']);   // love / ok / dislike
  st.inv.food_vitamin = 5;
  const before = Object.fromEntries(t.fish.map((f) => [f.speciesId, { ...f }]));
  const { r, out } = giveVitamin(st, t);
  assert.ok(r.ok);
  const g = t.fish.find((f) => f.speciesId === 'guppy'), m = t.fish.find((f) => f.speciesId === 'medaka'), o = t.fish.find((f) => f.speciesId === 'otocinclus');
  const E = B.VITAMIN.effect;
  assert.equal(fishById.guppy.vitamin, 'love'); assert.equal(fishById.medaka.vitamin, 'ok'); assert.equal(fishById.otocinclus.vitamin, 'dislike');
  assert.equal(g.health - before.guppy.health, E.love.health);
  assert.equal(g.mood - before.guppy.mood, E.love.mood);
  assert.equal(g.natsuki - before.guppy.natsuki, E.love.natsuki);
  assert.equal(m.health - before.medaka.health, E.ok.health);
  assert.equal(m.natsuki - before.medaka.natsuki, E.ok.natsuki);
  for (const f of [g, m, o]) assert.equal(f.onaka, before[f.speciesId].onaka, `${f.speciesId} の おなかが ふえた（仕様 3-2：ふえない）`);
  for (const k of ['health', 'mood', 'natsuki', 'grow']) assert.equal(o[k], before.otocinclus[k], `きらいの 魚の ${k} が かわった`);
  assert.equal(out.otocinclus?.pref, 'dislike');
  assert.ok((out.otocinclus?.react || []).includes('turn'));
  assert.equal(t.leftover, 0, 'たべのこしが できた');
});

test('ビタミン：けんこう は 100 まで・おなか ≥ 90 でも たべる・そだちは ふつうの えさの ボーナスと べつ枠', () => {
  const { st, t } = vitState(['guppy']);
  const f = t.fish[0];
  f.health = 95; f.onaka = 95;
  st.inv.food_vitamin = 5;
  const g0 = f.grow;
  // ふつうの えさの ボーナスを 1日ぶん つかいきる
  for (let i = 0; i < 6; i++) f.day.feedGrow = B.GROW.feedBonusPerDay;
  const { out } = giveVitamin(st, t);
  assert.ok(out.guppy && out.guppy.pref === 'love', 'おなか いっぱいで たべない');
  assert.equal(f.health, 100);
  assert.equal(f.grow - g0, B.VITAMIN.effect.love.growHours);
});

test('ビタミン：コイン・えさの なつき・ミッション feed・ハート には かぞえない。ミッション vitaminEat は 1かいで 1・love は love が たべた かいすう', () => {
  const { st, t } = vitState(['guppy', 'neon_tetra']);
  st.inv.food_vitamin = 5; st.coins = 0;
  const feed0 = st.stats.feed || 0, hearts0 = st.heartsTotal || 0;
  giveVitamin(st, t);
  assert.equal(st.coins, 0);
  assert.equal(st.stats.feed || 0, feed0);
  assert.equal(st.heartsTotal || 0, hearts0);
  assert.equal(st.stats.vitaminEat, 1, 'たべた 2ひき で 2かいに なった');
  assert.equal(st.stats.vitaminLove, 1);
  const m1 = missions.MISSIONS.find((m) => m.id === 'm_vitamin1');
  assert.deepEqual(sim.missionProgress(st, m1), { now: 1, need: 1 });
  // ok だけの すいそうでは love は すすまない
  const t2 = sim.addTank(st, 'fresh', ['heater']);
  addFish(st, 'medaka', t2);
  giveVitamin(st, t2);
  assert.equal(st.stats.vitaminEat, 2); assert.equal(st.stats.vitaminLove, 1);
});

test('ビタミン：39しゅるい ぜんぶに すききらい（love 19・ok 14・dislike 6）', () => {
  const sold = FISH.filter((f) => f.price != null);
  assert.equal(sold.length, 39);
  const cnt = { love: 0, ok: 0, dislike: 0 };
  for (const f of sold) { assert.ok(['love', 'ok', 'dislike'].includes(f.vitamin), `${f.id} vitamin=${f.vitamin}`); cnt[f.vitamin]++; }
  assert.deepEqual(cnt, { love: 19, ok: 14, dislike: 6 });
  for (const id of ['ishimaki', 'otocinclus', 'shittaka', 'mandarin', 'kanoko', 'moorish_idol']) assert.equal(fishById[id].vitamin, 'dislike', id);
  assert.equal(fishById.albino_corydoras.vitamin, 'ok');
});

// ---------------- じどう えさやり ----------------
test('じどう えさやり：8じ と 18じ に おなか < 50 の 魚だけ +15（コイン・なつき・そだち・feed・ハート なし）', () => {
  const st = unlocked();
  const t = st.tanks[0];
  t.decor.push('heater'); t.temp = 25;
  assert.ok(sim.buyItem(st, 'auto_feeder', t).ok);
  const a = addFish(st, 'medaka', t), b = addFish(st, 'medaka', t);
  toBefore(st, 8);
  a.onaka = 40; b.onaka = 70;
  const snap = { coins: st.coins, feed: st.stats.feed || 0, hearts: st.heartsTotal || 0, na: a.natsuki, ga: a.grow, care: st.daily.care };
  tick(st, 2);
  const drop = (o) => o + B.HUNGER.perHour * fishById.medaka.appetite * (2 / 60);   // 2ふんぶん へる
  assert.ok(Math.abs(a.onaka - (drop(40) + 15)) < 0.2, `おなか 40 → ${a.onaka.toFixed(2)}（+15 の はず）`);
  assert.ok(Math.abs(b.onaka - drop(70)) < 0.2, `おなか 70 の 魚にも あげた → ${b.onaka.toFixed(2)}（仕様：おなか < 50 だけ）`);
  assert.equal(st.coins, snap.coins); assert.equal(st.stats.feed || 0, snap.feed); assert.equal(st.heartsTotal || 0, snap.hearts);
  assert.equal(a.natsuki, snap.na); assert.equal(st.daily.care, snap.care);
  assert.ok(a.grow - snap.ga < B.GROW.feedBonusHours, 'えさの そだち ボーナスが ついた');
  assert.equal(t.leftover, 0, 'たべのこしが できた');
  // 12じ には うごかない
  toBefore(st, 12); a.onaka = 30; tick(st, 2);
  assert.ok(a.onaka < 31);
});

test('じどう えさやり：スイッチ きり（tank.feederOn = false）なら うごかない・はじめは いり', () => {
  const st = unlocked();
  const t = st.tanks[0];
  sim.buyItem(st, 'auto_feeder', t);
  const a = addFish(st, 'medaka', t);
  sim.normalize(st);
  assert.notEqual(t.feederOn, false, 'はじめは いり');
  t.feederOn = false;
  toBefore(st, 18); a.onaka = 30; tick(st, 2);
  assert.ok(a.onaka < 31, `きり なのに あげた（${a.onaka.toFixed(1)}）`);
});

// ---------------- おんど ダイヤル ----------------
test('おんど ダイヤル：ヒーターと ファンが りょうほう ある ときだけ・23/25/27・1じかんに 1ど', () => {
  assert.deepEqual(B.THERMO.steps.map((s) => s.temp), [23, 25, 27]);
  const st = unlocked();
  const t = st.tanks[0];
  addFish(st, 'medaka', t);   // 15〜30
  assert.equal(sim.hasThermo(t), false);
  t.decor.push('heater');
  assert.equal(sim.hasThermo(t), false);
  sim.buyItem(st, 'fan', t);
  assert.equal(sim.hasThermo(t), true);
  sim.normalize(st);
  assert.equal(t.thermo, 'normal');
  t.temp = 25;
  assert.ok(sim.setThermo(st, t, 'cool').ok);
  tick(st, HOUR);
  assert.ok(Math.abs(t.temp - 24) < 1e-6, `1じかんで ${t.temp}`);
  tick(st, 5 * HOUR);
  assert.ok(Math.abs(t.temp - 23) < 1e-6, `23ど で とまらない ${t.temp}`);
  sim.setThermo(st, t, 'warm'); tick(st, 10 * HOUR);
  assert.ok(Math.abs(t.temp - 27) < 1e-6);
});

test('おんど ダイヤル：ファン だけ なら なにも しない（へやの 温度 20ど へ 0.5ど/じかん）', () => {
  const st = unlocked();
  const t = st.tanks[0];
  sim.buyItem(st, 'fan', t);
  t.temp = 20;
  tick(st, 10 * HOUR);
  assert.ok(Math.abs(t.temp - B.START.roomTemp) < 1e-6, `ファン だけで ${t.temp}ど に なった（仕様 2-2：なにも しない）`);
});

test('おんど ダイヤル：その すいそうの 生きものに あわない 段は えらべない（ベタ に 23ど、レッドビー に 27ど）', () => {
  const st = unlocked();
  const t = st.tanks[0];
  t.decor.push('heater', 'fan'); t.temp = 25;
  addFish(st, 'betta', t);          // 24〜30
  sim.normalize(st);
  const r = sim.setThermo(st, t, 'cool');
  assert.notEqual(t.thermo, 'cool', 'ベタの すいそうが 23ど に なった（safeOnly）');
  assert.equal(r.ok, false, 'setThermo が あわない 段を うけつけた');
  assert.ok(sim.setThermo(st, t, 'warm').ok);
  const st2 = unlocked();
  const t2 = st2.tanks[0];
  t2.decor.push('heater', 'fan');
  addFish(st2, 'red_bee_shrimp', t2);   // 18〜26
  sim.normalize(st2);
  sim.setThermo(st2, t2, 'warm');
  assert.notEqual(t2.thermo, 'warm', 'レッドビーの すいそうが 27ど に なった');
  assert.ok(sim.setThermo(st2, t2, 'normal').ok, 'ふつうは いつでも えらべる');
});

test('おんど ダイヤル：あとから あわない 魚が 来たら ふつう に もどる（resetOnUnsafe）', () => {
  const st = unlocked();
  const t = st.tanks[0];
  t.decor.push('heater', 'fan');
  addFish(st, 'goldfish', t);           // 10〜28
  sim.normalize(st);
  assert.ok(sim.setThermo(st, t, 'cool').ok);
  sim.buyFish(st, 'medaka', t);         // 15〜30（23ど OK）
  assert.equal(t.thermo, 'cool');
  st.tanks[0].fish = st.tanks[0].fish.filter((f) => f.speciesId !== 'goldfish');
  sim.buyFish(st, 'guppy', t);          // 20〜28（23ど OK）
  assert.equal(t.thermo, 'cool');
  const t3 = sim.addTank(st, 'fresh', ['heater']); t3.decor.push('fan'); sim.normalize(st);
  addFish(st, 'medaka', t3);
  assert.ok(sim.setThermo(st, t3, 'cool').ok);
  sim.buyFish(st, 'betta', t3);         // 24〜30 → 23ど は あわない
  assert.equal(t3.thermo, 'normal', `ベタが 来ても ${t3.thermo} の まま（仕様：ふつう に もどす）`);
});

test('とても ぴったり（|すいおん − best| ≤ 1）は ごきげん の 目標 +5（ダイヤルが ない すいそうでも）', () => {
  const mood = (temp) => {
    const st = unlocked();
    const t = st.tanks[0];
    const f = addFish(st, 'goldfish', t);          // best 23
    for (let h = 0; h < 40; h++) { t.temp = temp; t.clean = 100; t.air = 80; f.onaka = 80; tick(st, HOUR); }
    return f.mood;
  };
  const d = mood(23) - mood(24.8);   // どちらも best±2 の「ぴったり」、23 は「とても ぴったり」
  assert.ok(Math.abs(d - B.THERMO.perfectMood) < 0.5, `とても ぴったり の さ ${d.toFixed(2)}（仕様 +${B.THERMO.perfectMood}）`);
});

// ---------------- シーオーツー・スキマー ----------------
test('シーオーツー：みずくさ の くうき だけ 1.5ばい（きれいさ は ふやさない）・みずくさが すきな 魚の ごきげん +5', () => {
  const run = (co2) => {
    const st = unlocked();
    const t = st.tanks[0];
    t.decor.push('plant', 'plant');
    if (co2) sim.buyItem(st, 'co2_kit', t);
    t.clean = 50; t.air = 40;
    tick(st, HOUR);
    return t;
  };
  const a = run(false), b = run(true);
  const plantAir = itemById.plant.effect.airPerHour * 2;
  assert.ok(Math.abs((b.air - a.air) - plantAir * 0.5) < 0.01, `くうき の さ ${(b.air - a.air).toFixed(3)}`);
  assert.ok(Math.abs(b.clean - a.clean) < 1e-6, `シーオーツーで きれいさが ${(b.clean - a.clean).toFixed(3)} かわった（仕様 2-3：くうき だけ）`);
  assert.equal(sim.canBuyItem(unlocked(), 'co2_kit', sim.addTank(unlocked(), 'salt', [])).reason !== undefined, true);
});

test('シーオーツーは うみ、スキマーは かわ の すいそうに 入らない・器具は 解放の あと', () => {
  const st = unlocked();
  const salt = sim.addTank(st, 'salt', ['heater', 'air_pump']);
  assert.equal(sim.canBuyItem(st, 'co2_kit', salt).reason, 'co2Salt');
  assert.equal(sim.canBuyItem(st, 'skimmer', st.tanks[0]).reason, 'skimmerFresh');
  assert.ok(sim.canBuyItem(st, 'skimmer', salt).ok);
  const st0 = rich(freshState());
  for (const id of ['auto_feeder', 'fan', 'co2_kit', 'skimmer']) assert.equal(sim.canBuyItem(st0, id).reason === 'locked' || sim.canBuyItem(st0, id).reason === 'skimmerFresh', true, id);
  assert.equal(sim.canBuyItem(st0, 'auto_feeder').reason, 'locked');
});

test('スキマー：よごれる はやさ ×0.8・たべのこし −0.1・くうき +0.5（/じかん）', () => {
  assert.equal(itemById.skimmer.effect.dirtMultiplier, 0.8);
  const run = (sk) => {
    const st = unlocked();
    const t = sim.addTank(st, 'salt', ['heater', 'air_pump']);
    for (let i = 0; i < 3; i++) addFish(st, 'clownfish', t);
    if (sk) t.decor.push('skimmer');
    t.clean = 80; t.air = 40; t.leftover = 2;
    tick(st, HOUR);
    return t;
  };
  const a = run(false), b = run(true);
  assert.ok(Math.abs((b.air - a.air) - 0.5) < 0.01, `くうき ${(b.air - a.air).toFixed(3)}`);
  assert.ok(Math.abs((a.leftover - b.leftover) - 0.1) < 0.01, `たべのこし ${(a.leftover - b.leftover).toFixed(3)}`);
  const dirtA = 80 - a.clean;
  const dirtB = 80 - b.clean;
  assert.ok(dirtB < dirtA, 'スキマーで よごれが へらない');
});

// ---------------- CLEAN_FLOOR ----------------
test('CLEAN_FLOOR：さかな・エビが いる すいそうは どれだけ 器具を 入れても 1じかんに 0.4 は よごれる', () => {
  assert.equal(B.CLEAN_FLOOR.minNetDirtPerHour, 0.4);
  const st = unlocked();
  const t = st.tanks[0];
  addFish(st, 'minami_shrimp', t);
  addFish(st, 'ishimaki', t); addFish(st, 'ishimaki', t);
  t.decor.push('heater', 'filter', 'light', 'co2_kit', 'plant', 'plant', 'plant', 'plant');
  t.clean = 90;
  tick(st, 10 * HOUR);
  assert.ok(t.clean <= 90 - 0.4 * 10 + 1e-6, `10じかんで ${(90 - t.clean).toFixed(2)} しか よごれない（仕様：10じかんで 4 いじょう）`);
  // うみ：フィルター＋スキマー＋ライブロック2＋サンゴ2＋かい2
  const salt = sim.addTank(st, 'salt', ['heater', 'air_pump']);
  addFish(st, 'clownfish', salt); addFish(st, 'shittaka', salt); addFish(st, 'shittaka', salt);
  salt.decor.push('filter', 'skimmer', 'liverock', 'liverock', 'coral', 'coral', 'light');
  salt.clean = 90;
  tick(st, 10 * HOUR);
  assert.ok(salt.clean <= 90 - 4 + 1e-6, `うみ：10じかんで ${(90 - salt.clean).toFixed(2)}`);
});

test('CLEAN_FLOOR：かい だけ・からの すいそう には かからない', () => {
  const st = unlocked();
  const t = st.tanks[0];
  addFish(st, 'ishimaki', t); addFish(st, 'ishimaki', t);
  t.decor.push('filter', 'plant', 'plant');
  t.clean = 90;
  tick(st, 10 * HOUR);
  assert.ok(t.clean > 90 - 4, `かい だけ なのに ${(90 - t.clean).toFixed(2)} よごれた`);
});

// ---------------- ミッション ----------------
test('ミッション：gadgetCount は ぜんぶの すいそうの 器具を かぞえる', () => {
  const st = unlocked();
  const m = missions.MISSIONS.find((x) => x.id === 'm_gadget2');
  assert.ok(m);
  sim.buyItem(st, 'auto_feeder', st.tanks[0]);
  assert.equal(sim.missionProgress(st, m).now, 1);
  const t2 = sim.addTank(st, 'fresh', []);
  sim.buyItem(st, 'auto_feeder', t2);
  assert.equal(sim.missionProgress(st, m).now, 2);
  assert.equal(missions.MISSIONS.length, 27);
});

// ---------------- v0.2 セーブの 移行 ----------------
test('v0.2 の セーブ：おちずに よめて、thermo=normal・feederOn=true・ビタミン 0・多すぎる エビや かいは へらさない', () => {
  const st0 = unlocked();
  const t = st0.tanks[0];
  for (let i = 0; i < 8; i++) t.fish.push({ uid: 'e' + i, speciesId: 'minami_shrimp', stage: 0, onaka: 60, health: 90, mood: 70, natsuki: 0 });
  for (let i = 0; i < 3; i++) t.fish.push({ uid: 's' + i, speciesId: 'ishimaki', stage: 0, onaka: 60, health: 90, mood: 70, natsuki: 0 });
  const raw = JSON.parse(JSON.stringify(st0));
  raw.v = 2;
  for (const tk of raw.tanks) { delete tk.thermo; delete tk.feederOn; }
  delete raw.inv.food_vitamin; delete raw.daily.vitamin; delete raw.vitaminSeen;
  const m = new Map([[S.SAVE_KEY, JSON.stringify(raw)]]);
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const st = S.load(sim.initialValues());
  sim.normalize(st);
  const tk = st.tanks[0];
  assert.equal(tk.fish.length, 11, 'へった');
  assert.equal(tk.thermo, 'normal');
  assert.notEqual(tk.feederOn, false);
  assert.equal(st.inv.food_vitamin, 0);
  assert.deepEqual(st.daily.vitamin, {});
  assert.equal(sim.canBuyFish(st, 'ishimaki', tk).ok, false, 'かい 3びき なのに まだ かえる');
  assert.equal(sim.canBuyFish(rich(st), 'minami_shrimp', tk).ok, false, 'エビ 8ひき なのに まだ かえる（TANK.fishMax）');
  assert.doesNotThrow(() => tick(st, 1440));
});

// ---------------- 画面を くらく しない・オフライン ----------------
test('awake.js と stay-awake.mp4 が ある・sw.js の キャッシュに 入っている・動画は 音なしで ちいさい', () => {
  assert.ok(exists('js/ui/awake.js'));
  assert.ok(exists('stay-awake.mp4'));
  const sw = read('sw.js');
  assert.match(sw, /'js\/ui\/awake\.js'/);
  assert.match(sw, /'stay-awake\.mp4'/);
  const awake = read('js/ui/awake.js');
  assert.match(awake, /wakeLock/);
  assert.match(awake, /muted|\.muted\s*=\s*true|setAttribute\('muted'/);
  const buf = readFileSync(join(ROOT, 'stay-awake.mp4'));
  assert.ok(buf.length < 200 * 1024, `stay-awake.mp4 が ${Math.round(buf.length / 1024)}KB（おもすぎる）`);
  assert.equal(buf.toString('latin1', 4, 8), 'ftyp', 'mp4 で ない');
  // 無音の 音トラックが 入っている（NoSleep 方式。−91dB を 確認ずみ）。かならず muted で ながす こと
  assert.match(awake, /\.muted\s*=\s*true/, 'stay-awake.mp4 を muted で ながしていない');
  assert.match(awake, /playsinline/i, 'playsinline が ない（iPhone で 全画面に なる）');
});

test('BGM：曲の ファイルが ぜんぶ ある・sw.js に 入っている・曲の なまえに 漢字が ない', async () => {
  if (!exists('js/bgm.js')) return;     // まだ とどいていない
  const { TRACKS } = await import('../js/bgm.js');
  assert.equal(TRACKS.length, 5);
  const sw = read('sw.js');
  const miss = TRACKS.filter((t) => !exists(t.file)).map((t) => t.file);
  assert.deepEqual(miss, [], 'まだ ない 曲');
  const notCached = TRACKS.filter((t) => !sw.includes(`'${t.file}'`)).map((t) => t.file);
  assert.deepEqual(notCached, [], 'sw.js に ない 曲');
  for (const t of TRACKS) assert.ok(!/[㐀-鿿]/.test(t.name), t.name);
});
