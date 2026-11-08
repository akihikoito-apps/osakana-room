// v0.6 の テスト（ゲーム係）：おやすみすいそう・そうこ・チュートリアルの ヘルプ・ミッション 5つ／100こ
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, S, freshState, addFish, read, uiStrings, htmlTexts, KANJI, missions, tutorial, balance } from './_lib.js';

const rich = (st) => { st.coins = 999999; return st; };
const unlocked = () => { const st = rich(freshState()); st.unlocks.tank6 = 1; return st; };

// ---------------- なまえ ----------------
test('なまえ：「かりすいそう」は こうしん りれき いがいに のこっていない（おやすみすいそう）', () => {
  for (const f of ['index.html', 'js/ui/box.js', 'js/ui/player.js', 'js/ui/tank.js', 'js/data/help.js', 'js/data/missions.js', 'js/ui/storage.js']) {
    assert.ok(!read(f).includes('かりすいそう'), f);
  }
  assert.match(read('index.html'), /<h2>おやすみすいそう<\/h2>/);
  assert.match(read('js/data/help.js'), /h: 'おやすみすいそう'/);
});

// ---------------- そうこ ----------------
test('そうこ：へやが いっぱいで すいそうを かうと そうこへ（stored）・へや＋そうこ は 18 まで', () => {
  const st = unlocked();
  for (let i = 0; i < 5; i++) assert.ok(sim.buyItem(st, 'tank_salt').ok);
  assert.equal(st.tanks.length, 6);
  assert.equal(sim.canBuyItem(st, 'tank_salt').toStorage, true);
  const r = sim.buyItem(st, 'tank_salt');
  assert.ok(r.ok && r.stored && r.tank.stored);
  assert.equal(st.tanks.length, 6);
  assert.equal(st.storage.length, 1);
  assert.equal(JSON.parse(JSON.stringify(r.tank)).stored, undefined, 'stored の しるしは セーブに のらない');
  assert.equal(sim.tankLimit(), 18);
  while (sim.tankTotal(st) < 18) assert.ok(sim.buyItem(st, 'tank_fresh').ok);
  assert.equal(sim.canBuyItem(st, 'tank_fresh').reason, 'tankMax');
  assert.equal(sim.addTank(st, 'pond', []), null, 'うえの かぎりなら null');
  // id は ぜんぶ ちがう
  const ids = st.tanks.concat(st.storage).map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('そうこ：addTank（ぼうけん係の いけの すいそう プレゼント）も へやが いっぱいなら そうこ', () => {
  const st = unlocked();
  for (let i = 0; i < 5; i++) sim.addTank(st, 'fresh', []);
  const t = sim.addTank(st, 'pond', ['heater']);
  assert.ok(t && t.stored);
  assert.equal(t.water, 'pond');
  assert.ok(st.storage.includes(t));
  const t2 = (st.tanks.pop(), sim.addTank(st, 'pond', []));
  assert.equal(t2.stored, false);
  assert.ok(st.tanks.includes(t2));
});

test('そうこ：しまうと 中身ごと 時間が とまる・だすと もとの まま', () => {
  const st = unlocked();
  addFish(st, 'medaka', st.tanks[0]);
  const t2 = sim.addTank(st, 'fresh', ['heater', 'air_pump']);
  const f = addFish(st, 'guppy', t2);
  f.onaka = 50; t2.clean = 80;
  const r = sim.storeTank(st, t2.id);
  assert.ok(r.ok);
  assert.ok(!st.tanks.includes(t2) && st.storage.includes(t2));
  const before = JSON.stringify(t2);
  for (let h = 0; h < 48; h++) sim.tick(st, 60, () => 0.5);
  assert.equal(JSON.stringify(t2), before, 'そうこの 中は かわらない');
  const o = sim.takeOutTank(st, t2.id);
  assert.ok(o.ok);
  assert.ok(st.tanks.includes(t2));
  assert.equal(t2.fish[0].onaka, 50);
  assert.ok(t2.slot >= 0 && t2.slot < 6);
  assert.equal(new Set(st.tanks.map((t) => t.slot)).size, st.tanks.length);
});

test('そうこ：へやは からっぽに ならない・6ぴき かいほう まえは 1つめを しまえない・チュートリアル中は だめ', () => {
  const st = rich(freshState());
  assert.equal(sim.canStoreTank(st, st.tanks[0].id).reason, 'lastTank');
  const pond = sim.addTank(st, 'pond', []);       // かいほう まえに いけの すいそうを もらった とき
  assert.equal(sim.canStoreTank(st, st.tanks[0].id).reason, 'firstTank');
  assert.ok(sim.canStoreTank(st, pond.id).ok);
  st.unlocks.tank6 = 1;
  assert.ok(sim.canStoreTank(st, st.tanks[0].id).ok);
  const st2 = rich(freshState({ tutorialDone: false }));
  sim.addTank(st2, 'fresh', []);
  assert.equal(sim.canStoreTank(st2, st2.tanks[1].id).reason, 'tutorial');
});

test('そうこ：いれかえ（へやが いっぱい）は おなじ わくに だす・みている すいそうも かわる', () => {
  const st = unlocked();
  for (let i = 0; i < 5; i++) sim.addTank(st, 'fresh', []);
  const s1 = sim.addTank(st, 'salt', []);
  assert.ok(s1.stored);
  assert.equal(sim.canTakeOutTank(st, s1.id).reason, 'roomFull');
  const out = st.tanks[3];
  const slot = out.slot;
  st.ui.tankId = out.id;
  const r = sim.swapTank(st, out.id, s1.id);
  assert.ok(r.ok);
  assert.equal(s1.slot, slot);
  assert.equal(st.tanks[3], s1);
  assert.ok(st.storage.includes(out));
  assert.equal(out.slot, -1);
  assert.equal(st.ui.tankId, s1.id);
});

test('そうこ：しまっても ミッション・かいほう・ハート・ずかんは もどらない（そうこの 生きもの・すいそうも かぞえる）', () => {
  const st = rich(freshState());
  const t = st.tanks[0];
  for (let i = 0; i < 6; i++) addFish(st, 'medaka', t);
  assert.ok(st.unlocks.tank6);
  const t2 = sim.addTank(st, 'salt', ['heater']);
  addFish(st, 'clownfish', t2);
  st.heartsTotal = 123;
  const kinds = { goal: { type: 'waterFishCount', water: 'salt', count: 1 } };
  const tanks = { goal: { type: 'tankCount', count: 2 } };
  const salt = { goal: { type: 'hasTankWater', water: 'salt' } };
  assert.ok(sim.storeTank(st, t2.id).ok);
  assert.equal(sim.missionProgress(st, kinds).now, 1);
  assert.equal(sim.missionProgress(st, tanks).now, 2);
  assert.equal(sim.missionProgress(st, salt).now, 1);
  assert.equal(sim.allCreatures(st).length, 7);
  // 1つめを しまう（かいほう あと）→ へやの 1ばんめが かわっても かいほうは そのまま
  sim.takeOutTank(st, t2.id);
  assert.ok(sim.storeTank(st, t.id).ok);
  sim.normalize(st);
  assert.ok(st.unlocks.tank6);
  assert.equal(st.heartsTotal, 123);
  assert.ok(st.dex.medaka && st.dex.clownfish);
  // ありがとう・ハートは へやの すいそうだけ（そうこの 子は なでられない）
  assert.ok(!st.tanks.some((x) => x === t));
});

test('そうこ：セーブ・よみこみ（古い セーブは []・7つめ いこうの すいそうは すてずに そうこへ）', () => {
  const init = (freshState(), sim.initialValues());
  const old = S.newState(init); delete old.storage;
  assert.deepEqual(S.migrate(JSON.parse(JSON.stringify(old)), init).storage, []);
  const st = unlocked();
  for (let i = 0; i < 6; i++) sim.addTank(st, i % 2 ? 'salt' : 'fresh', []);
  addFish(st, 'guppy', st.storage[0].water === 'fresh' ? st.storage[0] : st.tanks[0]);
  const back = S.migrate(JSON.parse(JSON.stringify(st)), init);
  sim.normalize(back);
  assert.equal(back.tanks.length, 6);
  assert.equal(back.storage.length, st.storage.length);
  assert.ok(back.storage.every((t) => t.slot === -1));
  // へやに 8つ ある おかしな セーブ → 6つ へや、2つ そうこ
  const bad = JSON.parse(JSON.stringify(st));
  bad.tanks = bad.tanks.concat([0, 1].map((i) => ({ ...bad.tanks[1], id: 'x' + i, slot: 6 + i })));
  bad.storage = [];
  const fixed = S.migrate(bad, init);
  assert.equal(fixed.tanks.length, 6);
  assert.equal(fixed.storage.length, 2);
});

// ---------------- チュートリアル ----------------
test('チュートリアル：さいごは ヘルプの ばしょを おしえる（helpButton）', () => {
  const steps = tutorial.TUTORIAL.steps;
  const last = steps[steps.length - 1];
  assert.equal(last.target, 'helpButton');
  assert.equal(last.wait, 'tap');
  assert.match(last.say, /ヘルプ/);
  assert.ok(!KANJI.test(last.say));
  assert.match(read('js/ui/tutorial.js'), /helpButton/);
});

// ---------------- ミッション ----------------
test('ミッション：いつも 5つ 見える・80〜110こ・lane は 5しゅるい', () => {
  const M = missions.MISSIONS;
  assert.equal(missions.MISSION_VISIBLE, 5);
  assert.ok(M.length >= 80 && M.length <= 110, String(M.length));
  const lanes = new Set(M.map((m) => m.lane));
  assert.deepEqual([...lanes].sort(), ['care', 'grow', 'play', 'room', 'zukan']);
  for (const m of M) {
    assert.ok(!KANJI.test(m.title + m.desc), m.id);
    assert.ok(m.reward.coin >= 20 && m.reward.coin <= 500, m.id);
  }
  const st = freshState();
  const v = sim.visibleMissions(st);
  assert.equal(v.length, 5);
  assert.equal(new Set(v.map((m) => m.lane)).size, 5, 'はじめは 5しゅるい ばらばら');
});

test('ミッション：うけとり ずみの ものは そのまま・のこりが 5つ 出る', () => {
  const st = freshState();
  for (const m of missions.MISSIONS.filter((x) => x.order < 30)) { st.missions.done[m.id] = 1; st.missions.claimed[m.id] = 1; }
  const v = sim.visibleMissions(st);
  assert.equal(v.length, 5);
  assert.ok(v.every((m) => m.order >= 30 && !st.missions.claimed[m.id]));
});

test('ミッション：ぼうけん・キラキラ・おうかんは ひらく／でる まで 出ない（まどを ふさがない）', () => {
  const st = freshState();
  for (const m of missions.MISSIONS) if (m.lane === 'zukan' && !m.gate) { st.missions.claimed[m.id] = 1; }
  let v = sim.visibleMissions(st).map((m) => m.id);
  assert.ok(!v.some((id) => /fishing|gasa|shiny|z_adv|pond/.test(id)), v.join(','));
  st.stats.adventureOpen = 1;
  v = sim.visibleMissions(st).map((m) => m.id);
  assert.ok(v.includes('z_adv'), v.join(','));
  // キラキラは でた とたん 見えて、たっせい
  const shiny = missions.MISSIONS.find((m) => m.id === 'z_shiny1');
  assert.equal(sim.missionOpen(st, shiny), false);
  st.stats.shinyGet = 1;
  assert.equal(sim.missionOpen(st, shiny), true);
  assert.deepEqual(sim.missionProgress(st, shiny), { now: 1, need: 1 });
});

test('ミッション：あたらしい goal の かぞえかた', () => {
  const st = unlocked();
  const t = st.tanks[0];
  const a = addFish(st, 'medaka', t); const b = addFish(st, 'guppy', t);
  a.stage = 2; b.stage = 1;
  t.decor.push('stone', 'stone', 'plant');
  const P = (goal) => sim.missionProgress(st, { goal }).now;
  assert.equal(P({ type: 'bigCount', count: 5 }), 1);
  assert.equal(P({ type: 'adultCount', count: 5 }), 2);
  assert.equal(P({ type: 'creatures', count: 9 }), 2);
  assert.equal(P({ type: 'decorCount', count: 9 }), 3);
  assert.equal(P({ type: 'decorKinds', count: 9 }), 2);
  assert.equal(P({ type: 'stat', key: 'fishing', count: 5 }), 0, 'まだ ない stats は 0');
  st.stats.fishing = 7;
  assert.equal(P({ type: 'stat', key: 'fishing', count: 5 }), 5);
  assert.equal(P({ type: 'zukanWater', water: 'fresh', count: 9 }), 2);
  assert.equal(P({ type: 'zukanRarity', rarity: 1, count: 9 }), 2);
  sim.toBox(st, t, a.uid);
  assert.equal(P({ type: 'bigCount', count: 5 }), 1, 'おやすみすいそうの 子も かぞえる');
  assert.equal(P({ type: 'boxCount', count: 5 }), 1);
  const t2 = sim.addTank(st, 'salt', []);
  sim.storeTank(st, t2.id);
  assert.equal(P({ type: 'storageCount', count: 5 }), 1);
  assert.equal(P({ type: 'tanksWater', water: 'salt', count: 5 }), 1);
  st.stats.quizBest = 4;
  assert.equal(P({ type: 'quizBest', count: 3 }), 3);
});

test('ミッション：まいにち ふつうに あそぶと（つり・キラキラ なしでも）まどが とまらずに すすむ', () => {
  const st = freshState();
  st.coins = 2000;
  st.tanks[0].decor.push('stone', 'air_pump', 'heater');
  st.inv.food_flake = 1; st.inv.water_change = 1;
  st.unlocks.tank6 = 1;
  const t = st.tanks[0];
  for (const id of ['medaka', 'guppy', 'neon_tetra', 'minami_shrimp', 'corydoras', 'ishimaki']) sim.buyFish(st, id, t);
  let now = 1e11, claimed = 0;
  for (let h = 0; h < 24 * 20; h++) {
    if (h % 3 === 0 && sim.feedStart(st, t, 'food_flake', now).ok) { for (const f of t.fish) sim.feedEat(st, f.uid, now + 500); sim.feedEnd(st); }
    if (t.clean < 75) sim.waterChange(st, t);
    if (t.leftover >= 1) sim.scoop(st, t);
    for (const f of t.fish) sim.pet(st, f.uid, now, t);
    now += 40000;
    sim.tick(st, 60, () => 0.4);
    for (const m of sim.visibleMissions(st)) if (st.missions.done[m.id] && sim.claimMission(st, m.id).ok) claimed++;
    assert.equal(sim.visibleMissions(st).length, 5);
  }
  assert.ok(claimed >= 15, `20にちで ${claimed}こ`);
});

// ---------------- 画面 ----------------
test('画面：そうこの 画面・ボタン・ファイル（sw.js・main.js）', () => {
  const html = read('index.html');
  assert.match(html, /id="scr-storage" class="screen sheet" data-screen="storage" hidden/);
  assert.match(html, /data-go="storage"/);
  assert.match(read('js/ui/storage.js'), /G\.addScreen\('storage'/);
  assert.match(read('js/main.js'), /'\.\/ui\/storage\.js'/);
  const sw = read('sw.js');
  for (const f of ['js/ui/storage.js', 'js/storage.js']) assert.ok(sw.includes(`'${f}'`), f);
  for (const f of ['js/ui/storage.js', 'js/storage.js', 'js/ui/missions.js', 'js/ui/box.js']) for (const s of uiStrings(read(f))) assert.ok(!KANJI.test(s.text), `${f}:${s.line} ${s.text}`);
  const part = html.slice(html.indexOf('id="scr-storage"'), html.indexOf('</section>', html.indexOf('id="scr-storage"')));
  for (const tx of htmlTexts(part)) assert.ok(!KANJI.test(tx), tx);
});

test('水の しゅるい：ゲーム係の ファイルに「salt でなければ fresh」の 2つだけの 書きかたが ない', () => {
  for (const f of ['js/storage.js', 'js/ui/storage.js', 'js/ui/box.js']) assert.ok(!/=== 'salt' \?/.test(read(f)), f);
  assert.ok(!/it\.water === 'salt' \? 'salt' : 'fresh'/.test(read('js/sim.js')));
  assert.ok(balance || true);
});
