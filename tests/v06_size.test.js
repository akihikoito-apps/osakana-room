// v0.6 の テスト（個体差係）：おおきさの ばらつき・キラキラ・えいよう・えさの しゅるい・ずかんの きろく・古い セーブ
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, S, freshState, addFish, seeded, read, uiStrings, KANJI, FISH, ITEMS, exists } from './_lib.js';
import * as SZ from '../js/size.js';
import { SIZE, FOOD_ORDER } from '../js/data/sizes.js';

const fishById = Object.fromEntries(FISH.map((f) => [f.id, f]));
const NEW_FOODS = ['food_bloodworm', 'food_brine', 'food_veggie', 'food_krill'];

function grownBig(st, f) {
  // ビッグまで そだてる（そだちを 直接 たして addGrow を とおす：えさの ボーナス）
  const t = st.tanks.find((x) => x.fish.includes(f));
  st.inv.food_flake = 1; st.owned.food_flake = true;
  let now = 1e9;
  for (let i = 0; i < 400 && f.stage < 2; i++) {
    f.onaka = 0; now += 60000;
    const r = sim.feedStart(st, t, 'food_flake', now);
    if (r.ok) { sim.feedEat(st, f.uid, now + 1); sim.feedEnd(st); }
    f.day.feedGrow = 0;
  }
  return f;
}

// ---------------- 生まれつき ----------------
test('生まれつきの z は ふつう分布（平均 0・ばらつき 1・±3 で とまる）', () => {
  const st = freshState();
  const rnd = seeded(11);
  const zs = Array.from({ length: 20000 }, () => sim.createFish(st, 'medaka', { rnd }).sizeZ);
  const m = zs.reduce((a, b) => a + b) / zs.length;
  const sd = Math.sqrt(zs.reduce((a, b) => a + (b - m) ** 2, 0) / zs.length);
  assert.ok(Math.abs(m) < 0.03, 'へいきん ' + m);
  assert.ok(Math.abs(sd - 1) < 0.03, 'ばらつき ' + sd);
  assert.ok(zs.every((z) => z >= -SIZE.zMax && z <= SIZE.zMax));
  const top = zs.filter((z) => z >= SZ.CROWN_Z).length / zs.length;
  assert.ok(Math.abs(top - 0.1) < 0.01, '上位10% ' + top);
});

test('キラキラは 1%（手に入れた ときだけ・ずかんに かず・shinyGet）', () => {
  const st = freshState();
  const rnd = seeded(5);
  let n = 0;
  for (let i = 0; i < 30000; i++) if (sim.createFish(st, 'guppy', { rnd }).shiny) n++;
  assert.ok(Math.abs(n / 30000 - 0.01) < 0.002, 'わりあい ' + n / 30000);
  const st2 = freshState({ coins: 99999 });
  const f = sim.createFish(st2, 'medaka', { rnd: () => 0.001 });   // ぜんぶ 0.001 → キラキラ
  assert.equal(f.shiny, true);
  st2.tanks[0].fish.push(f);
  sim.addDex(st2, f);
  assert.equal(st2.dex.medaka.shiny, 1);
  assert.equal(st2.stats.shinyGet, 1);
});

test('メダカの ビッグは 平均 4.5cm・3.0〜6.0cm（ユーザーの 例）・どの しゅるいでも はばが きまる', () => {
  const P = SZ.sizeParams(fishById.medaka);
  assert.equal(P.mean, 4.5);
  assert.equal(Math.round(P.min * 10) / 10, 3.0);
  assert.equal(Math.round(P.max * 10) / 10, 6.0);
  for (const sp of FISH) {
    const q = SZ.sizeParams(sp);
    assert.ok(q.mean > 0 && q.min > 0 && q.max > q.mean && q.stages[0] < q.stages[2], sp.id);
  }
});

// ---------------- そだち ----------------
test('えいよう：いろいろな えさを こまめに あげると おおきく なりやすい（でも 生まれつきの ほうが 大きい）', () => {
  const run = (foods, vit) => {
    const st = freshState({ coins: 99999 });
    for (const id of FOOD_ORDER) { st.inv[id] = 999; st.owned[id] = true; }
    st.inv.food_vitamin = 999; st.owned.food_vitamin = true;
    const t = st.tanks[0];
    t.decor.push('heater', 'air_pump', 'filter');
    const f = addFish(st, 'medaka', t);
    f.sizeZ = 0;
    let now = 1e9, k = 0;
    for (let h = 0; h < 24 * 30 && f.stage < 2; h++) {
      if (foods.length && h % 6 === 0) { now += 60000; const r = sim.feedStart(st, t, foods[k++ % foods.length], now); if (r.ok) { sim.feedEat(st, f.uid, now + 1); sim.feedEnd(st); } }
      if (vit && h % 24 === 12) { now += 60000; if (sim.vitaminStart(st, t, now).ok) { sim.vitaminEat(st, f.uid, now + 1); sim.vitaminEnd(st); } }
      sim.tick(st, 60, seeded(h + 1));
      t.clean = 100;
    }
    assert.equal(f.stage, 2);
    return f.bigCm;
  };
  const flake = run(['food_flake'], false);
  const mix = run(['food_flake', 'food_bloodworm', 'food_brine'], true);
  assert.ok(mix > flake, `いろいろ ${mix} > フレーク ${flake}`);
  const P = SZ.sizeParams(fishById.medaka);
  assert.ok(mix - flake < P.sd, 'そだちの さは 1σ より ちいさい');
  assert.ok(SIZE.careMaxZ - SIZE.careBaseZ < SIZE.zMax / 2, 'そだちボーナスは 生まれつきの はばより ずっと ちいさい');
});

test('バランス：おなじ えさを くりかえしても へらない・ちがう えさが まじると ふえる', () => {
  const sp = fishById.medaka;
  const a = { eiyo: 0, recent: [] };
  const g1 = [1, 2, 3, 4].map(() => SZ.eatFood(sp, a, 'food_flake'));
  assert.ok(g1.every((x) => x === g1[0]), 'フレークだけでも へらない');
  const b = { eiyo: 0, recent: ['food_flake', 'food_flake', 'food_flake'] };
  const mixed = SZ.eatFood(sp, b, 'food_bloodworm');
  assert.ok(mixed > g1[0] * 1.2);
});

test('えさの すききらい：たべない えさは たべない・たべる 子が いない すいそうでは へらない', () => {
  assert.equal(sim.foodPrefOf('ishimaki', 'food_bloodworm'), 'no');
  assert.equal(sim.foodPrefOf('ishimaki', 'food_veggie'), 'love');
  assert.equal(sim.foodPrefOf('medaka', 'food_krill'), 'no');      // くちに はいらない
  assert.equal(sim.foodPrefOf('medaka', 'food_bloodworm'), 'love');
  assert.equal(sim.foodPrefOf('clownfish', 'food_brine'), 'love');
  for (const sp of FISH) for (const id of FOOD_ORDER) assert.ok(['love', 'ok', 'no'].includes(sim.foodPrefOf(sp.id, id)), sp.id + id);
  for (const sp of FISH) assert.notEqual(sim.foodPrefOf(sp.id, 'food_flake'), 'no', 'フレークは みんな たべる ' + sp.id);
  const st = freshState({ coins: 99999 });
  const t = st.tanks[0];
  addFish(st, 'ishimaki', t);
  st.inv.food_bloodworm = 10; st.owned.food_bloodworm = true;
  t.fish[0].onaka = 10;
  const r = sim.feedStart(st, t, 'food_bloodworm', 2e9);
  assert.equal(r.reason, 'noEater');
  assert.equal(st.inv.food_bloodworm, 10);
  const r2 = sim.feedStart(st, t, 'food_veggie', 2e9);
  assert.equal(r2.reason, 'noTool');
});

test('かいすうの ある えさ：1かい まくと 1へる・feedKinds は しゅるいの かず', () => {
  const st = freshState({ coins: 99999 });
  const t = st.tanks[0];
  const f = addFish(st, 'medaka', t);
  st.inv.food_flake = 1; st.owned.food_flake = true;
  assert.ok(sim.buyItem(st, 'food_bloodworm', t).ok);
  assert.equal(st.inv.food_bloodworm, 10);
  assert.deepEqual(sim.foodsOwned(st), ['food_flake', 'food_bloodworm']);
  f.onaka = 10;
  assert.ok(sim.feedStart(st, t, 'food_bloodworm', 3e9).ok);
  assert.equal(st.inv.food_bloodworm, 9);
  assert.ok(sim.feedEat(st, f.uid, 3e9 + 1));
  sim.feedEnd(st);
  f.onaka = 10;
  assert.ok(sim.feedStart(st, t, 'food_flake', 4e9).ok);
  sim.feedEat(st, f.uid, 4e9 + 1); sim.feedEnd(st);
  assert.equal(st.stats.feedKinds, 2);
  f.onaka = 10;
  sim.feedStart(st, t, 'food_flake', 5e9); sim.feedEat(st, f.uid, 5e9 + 1); sim.feedEnd(st);
  assert.equal(st.stats.feedKinds, 2, 'おなじ しゅるいは ふえない');
});

// ---------------- おうかん・ずかん ----------------
test('ビッグで おおきさが きまり、ずかんに いちばん ちいさい／おおきい・おうかん（crownGet）', () => {
  const st = freshState({ coins: 99999 });
  const t = st.tanks[0];
  t.decor.push('heater');
  const a = addFish(st, 'medaka', t); a.sizeZ = 2.5;     // とても おおきい
  const b = addFish(st, 'medaka', t); b.sizeZ = -2;      // ちいさい
  grownBig(st, a); grownBig(st, b);
  assert.equal(a.stage, 2); assert.equal(b.stage, 2);
  const sa = sim.sizeOf(a), sb = sim.sizeOf(b);
  assert.ok(sa.fixed && sa.crown && sa.pct >= 90);
  assert.ok(!sb.crown && sb.pct < 25);
  assert.equal(st.dex.medaka.maxCm, a.bigCm);
  assert.equal(st.dex.medaka.minCm, b.bigCm);
  assert.equal(st.dex.medaka.crown, true);
  assert.equal(st.stats.crownGet, 1);
  // きまった あとは かわらない
  const cm = a.bigCm; a.eiyo = 0; sim.tick(st, 600, seeded(2));
  assert.equal(sim.sizeOf(a).cm, cm);
});

test('sizeOf の 形（ほかの 係が つかう）：{ cm, maxCm, pct, crown }・そだちちゅうは crown なし', () => {
  const st = freshState();
  const f = addFish(st, 'guppy');
  const z = sim.sizeOf(f);
  for (const k of ['cm', 'maxCm', 'pct', 'crown']) assert.ok(k in z, k);
  assert.ok(z.cm > 0 && z.cm < z.maxCm && z.pct >= 0 && z.pct <= 100);
  f.sizeZ = 3; assert.equal(sim.sizeOf(f).crown, false, 'ビッグに なるまでは おうかんに しない');
  assert.ok(sim.lookScaleOf(f) >= SIZE.lookMin && sim.lookScaleOf(f) <= SIZE.lookMax);
});

// ---------------- 古い セーブ ----------------
test('古い セーブ：生まれつきが ない 魚に uid から おだやかに つける（みんな おなじ では ない・読みなおしても おなじ）', () => {
  setupOld: {
    const st = freshState();
    const raw = JSON.parse(JSON.stringify(st));
    raw.tanks[0].fish = Array.from({ length: 6 }, (_, i) => ({ uid: 'old' + i, speciesId: 'medaka', stage: i < 3 ? 2 : 0, onaka: 60, health: 80, mood: 60, natsuki: 0, grow: 0 }));
    raw.dex = { medaka: { first: 1, count: 6 } };
    const m = sim.normalize(S.migrate(JSON.parse(JSON.stringify(raw)), sim.initialValues()));
    const zs = m.tanks[0].fish.map((f) => f.sizeZ);
    assert.ok(new Set(zs).size > 3, 'みんな おなじ では ない');
    assert.ok(zs.every((z) => Math.abs(z) <= SIZE.zMax));
    assert.ok(m.tanks[0].fish.every((f) => f.shiny === false));
    const bigs = m.tanks[0].fish.filter((f) => f.stage === 2);
    assert.ok(bigs.every((f) => Number.isFinite(f.bigCm)), 'もう ビッグの 子は おおきさが きまる');
    assert.ok(Number.isFinite(m.dex.medaka.maxCm) && m.dex.medaka.minCm <= m.dex.medaka.maxCm);
    const again = sim.normalize(S.migrate(JSON.parse(JSON.stringify(raw)), sim.initialValues()));
    assert.deepEqual(again.tanks[0].fish.map((f) => f.sizeZ), zs, 'よみなおしても おなじ');
    break setupOld;
  }
});

// ---------------- データ・文字 ----------------
test('あたらしい えさ 4つ：food・かいすう・ねだん・アイコン・ひらがな カタカナ', () => {
  for (const id of NEW_FOODS) {
    const it = ITEMS.find((i) => i.id === id);
    assert.ok(it, id);
    assert.equal(it.type, 'food');
    assert.ok(it.uses > 0 && it.price > 0 && it.effect.fill > 0);
    assert.ok(!KANJI.test(it.name + it.desc), id);
    assert.ok(exists(it.icon), it.icon);
  }
});

test('画面の 文字に 漢字が ない（size.js・sizes.js・tank.js・dex.js）', () => {
  for (const p of ['js/size.js', 'js/data/sizes.js', 'js/ui/tank.js', 'js/ui/dex.js']) {
    const bad = uiStrings(read(p)).filter((s) => KANJI.test(s.text));
    assert.deepEqual(bad.map((s) => `${p}:${s.line} ${s.text}`), []);
  }
});
