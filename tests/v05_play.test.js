// v0.5 の テスト（ゲーム係）：かりすいそう・ミニゲーム（さかな あて クイズ）・プレイヤー
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, S, freshState, addFish, seeded, read, uiStrings, htmlTexts, KANJI, FISH } from './_lib.js';

const fishById = Object.fromEntries(FISH.map((f) => [f.id, f]));

// ---------------- かりすいそう ----------------
test('かりすいそう：あずけると そのままの すがたで ボックスへ・水槽に あきが できて また かえる', () => {
  const st = freshState({ coins: 99999 });
  const t = st.tanks[0];
  for (let i = 0; i < 6; i++) addFish(st, 'medaka', t);
  assert.equal(sim.canBuyFish(st, 'guppy', t).reason, 'full');
  const f = t.fish[2];
  Object.assign(f, { stage: 2, natsuki: 77, health: 55, mood: 66, grow: 3 });
  const snap = JSON.stringify({ ...f });
  const r = sim.toBox(st, t, f.uid);
  assert.ok(r.ok);
  assert.equal(t.fish.length, 5);
  assert.equal(st.box.length, 1);
  const b = st.box[0];
  for (const k of ['uid', 'speciesId', 'stage', 'natsuki', 'health', 'mood', 'grow']) assert.equal(b[k], JSON.parse(snap)[k], k);
  assert.ok(sim.canBuyFish(st, 'guppy', t).ok, 'あきが できたら かえる');
});

test('かりすいそう：中では 時間が すすまない（おなか・けんこう・そだちが かわらない）', () => {
  const st = freshState({ coins: 99999 });
  const t = st.tanks[0];
  const f = addFish(st, 'medaka', t);
  addFish(st, 'medaka', t);
  sim.toBox(st, t, f.uid);
  const before = JSON.stringify(st.box[0]);
  for (let h = 0; h < 72; h++) sim.tick(st, 60, seeded(h + 1));
  assert.equal(JSON.stringify(st.box[0]), before);
});

test('かりすいそう：もどせるのは 水が あって あきの ある 水槽だけ（りゆうつき）', () => {
  const st = freshState({ coins: 99999 });
  const fresh = st.tanks[0];
  const clown = addFish(st, 'clownfish');          // うみの すいそうが できる
  const salt = st.tanks.find((x) => x.water === 'salt');
  const med = addFish(st, 'medaka', fresh);
  sim.toBox(st, salt, clown.uid);
  sim.toBox(st, fresh, med.uid);
  assert.equal(sim.canFromBox(st, clown.uid, fresh).reason, 'water');
  assert.equal(sim.canFromBox(st, med.uid, salt).reason, 'water');
  assert.ok(sim.canFromBox(st, clown.uid, salt).ok);
  // かわの 水槽を いっぱいに すると もどせない
  for (let i = 0; i < 6; i++) addFish(st, 'guppy', fresh);
  assert.equal(sim.canFromBox(st, med.uid, fresh).reason, 'full');
  const tg = sim.boxTargets(st, med.uid);
  assert.equal(tg.length, st.tanks.length);
  assert.ok(tg.every((x) => !x.ok));
  // かいは べつわく（2ひき）
  const sn = addFish(st, 'ishimaki', fresh);
  addFish(st, 'ishimaki', fresh);
  assert.equal(sim.canBuyFish(st, 'ishimaki', fresh).reason, 'snailFull');
  sim.toBox(st, fresh, sn.uid);
  assert.ok(sim.canFromBox(st, sn.uid, fresh).ok, 'さかなが いっぱいでも かいの わくが あけば もどせる');
  addFish(st, 'ramshorn', fresh);
  assert.equal(sim.canFromBox(st, sn.uid, fresh).reason, 'snailFull');
  // もどす
  const r = sim.fromBox(st, clown.uid, salt);
  assert.ok(r.ok);
  assert.ok(salt.fish.some((x) => x.uid === clown.uid));
  assert.ok(!st.box.some((x) => x.uid === clown.uid));
  assert.equal(salt.fish.find((x) => x.uid === clown.uid).boxedAt, undefined);
});

test('かりすいそう：ずかん・ハートの 合計・6ぴき かいほうは もどらない', () => {
  const st = freshState({ coins: 99999 });
  const t = st.tanks[0];
  for (let i = 0; i < 6; i++) addFish(st, i % 2 ? 'medaka' : 'guppy', t);
  assert.ok(st.unlocks.tank6);
  st.heartsTotal = 42;
  const dex = JSON.stringify(st.dex);
  for (const f of t.fish.slice()) assert.ok(sim.toBox(st, t, f.uid).ok);
  assert.equal(t.fish.length, 0);
  assert.equal(st.box.length, 6);
  sim.normalize(st);           // よみこみ なおしても
  assert.ok(st.unlocks.tank6, 'いちど ひらいたら もどさない');
  assert.equal(JSON.stringify(st.dex), dex);
  assert.equal(st.heartsTotal, 42);
  // もどしても ずかんの かずは ふえない（かったのでは ない）
  sim.fromBox(st, st.box[0].uid, t);
  assert.equal(JSON.stringify(st.dex), dex);
  assert.equal(sim.allCreatures(st).length, 6);
});

test('かりすいそう：ミッションの「エビ ◯ひき」なども ボックスの 子を かぞえる', () => {
  const st = freshState({ coins: 99999 });
  const t = st.tanks[0];
  addFish(st, 'minami_shrimp', t); const e2 = addFish(st, 'minami_shrimp', t);
  const m = { goal: { type: 'kindCount', kind: 'shrimp', count: 2 } };
  assert.equal(sim.missionProgress(st, m).now, 2);
  sim.toBox(st, t, e2.uid);
  assert.equal(sim.missionProgress(st, m).now, 2);
});

test('かりすいそう：上限・チュートリアル中は あずけられない', () => {
  const st = freshState({ coins: 99999, tutorialDone: false });
  const f = addFish(st, 'medaka', st.tanks[0]);
  assert.equal(sim.canToBox(st, st.tanks[0], f.uid).reason, 'tutorial');
  st.tutorial.done = true;
  assert.ok(sim.boxMax() >= 60, '大きめ');
  st.box = Array.from({ length: sim.boxMax() }, (_, i) => ({ ...f, uid: 'b' + i }));
  assert.equal(sim.canToBox(st, st.tanks[0], f.uid).reason, 'boxFull');
});

test('セーブ：古い セーブには box が ない → []、あずけた 子は 保存・よみこみで そのまま', () => {
  const init = (setupDone(), sim.initialValues());
  const old = S.newState(init); delete old.box; delete old.quiz;
  const m = S.migrate(JSON.parse(JSON.stringify(old)), init);
  assert.deepEqual(m.box, []);
  assert.equal(m.quiz, null);
  const st = freshState({ coins: 99999 });
  const f = addFish(st, 'betta', st.tanks[0]);
  f.stage = 1; f.natsuki = 50;
  sim.toBox(st, st.tanks[0], f.uid);
  const back = S.migrate(JSON.parse(JSON.stringify(st)), init);
  sim.normalize(back);
  assert.equal(back.box.length, 1);
  assert.equal(back.box[0].uid, f.uid);
  assert.equal(back.box[0].stage, 1);
  assert.equal(back.box[0].natsuki, 50);
  // こわれた 中身は すてる
  const bad = S.migrate({ ...JSON.parse(JSON.stringify(st)), box: [null, 3, { x: 1 }, { speciesId: 'nai_sakana', uid: 'z' }] }, init);
  sim.normalize(bad);
  assert.deepEqual(bad.box, []);
});
function setupDone() { freshState(); }

// ---------------- ミニゲーム ----------------
test('クイズ：ハート10で あそべる・たりないときは あと ◯こ・heartsTotal は へらない', () => {
  const st = freshState();
  st.hearts = 7; st.heartsTotal = 30;
  const c = sim.canPlayQuiz(st);
  assert.equal(c.ok, false); assert.equal(c.reason, 'hearts'); assert.equal(c.need, 3);
  assert.equal(sim.startQuiz(st).ok, false);
  assert.equal(st.hearts, 7);
  st.hearts = 25;
  const r = sim.startQuiz(st, seeded(3));
  assert.ok(r.ok);
  assert.equal(st.hearts, 15);
  assert.equal(st.heartsTotal, 30);
  assert.equal(sim.quizRule().cost, 10);
});

test('クイズ：5もん・3たく・こたえが かならず はいっている・おなじ 問題は でない・まちがいは 見分けやすい', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const st = freshState({ coins: 99999 });
    for (const id of ['medaka', 'guppy', 'neon_tetra', 'goldfish', 'minami_shrimp', 'ishimaki', 'corydoras']) addFish(st, id);
    st.hearts = 10;
    const { quiz } = sim.startQuiz(st, seeded(seed));
    assert.equal(quiz.qs.length, sim.quizRule().questions);
    assert.equal(quiz.qs.length, 5);
    assert.equal(new Set(quiz.qs.map((q) => q.answer)).size, 5);
    for (const q of quiz.qs) {
      assert.equal(q.choices.length, 3);
      assert.equal(new Set(q.choices).size, 3);
      assert.ok(q.choices.includes(q.answer));
      assert.ok(st.dex[q.answer], 'ずかんに のった 子から 出す');
      const names = q.choices.map((id) => fishById[id].name);
      assert.equal(new Set(names.map((n) => n.slice(0, 2))).size, 3, 'はじめの 2もじが おなじ 名前を ならべない ' + names);
      for (const id of q.choices) assert.ok(fishById[id].texture && fishById[id].price != null);
    }
  }
});

test('クイズ：ずかんが すくなくても あそべる（かいほう前の 子は 出さない）', () => {
  const st = freshState();
  st.hearts = 10;
  const { quiz } = sim.startQuiz(st, seeded(9));
  assert.ok(quiz.qs.length >= 5);
  for (const q of quiz.qs) assert.ok(!fishById[q.answer].unlock || sim.isUnlocked(st, fishById[q.answer].unlock));
});

test('クイズ：せいかいの かずで コイン（1もん 8・ぜんもん せいかいで +10）・さいこう きろく', () => {
  assert.equal(sim.quizCoins(0, 5), 0);
  assert.equal(sim.quizCoins(3, 5), 24);
  assert.equal(sim.quizCoins(5, 5), 50);
  const st = freshState({ coins: 99999 });
  for (const id of ['medaka', 'guppy', 'neon_tetra', 'goldfish', 'corydoras', 'platy']) addFish(st, id);
  st.coins = 100; st.hearts = 20;
  sim.startQuiz(st, seeded(5));
  const qs = st.quiz.qs;
  // 3もん せいかい・2もん まちがい
  qs.forEach((q, i) => { const r = sim.answerQuiz(st, i < 3 ? q.answer : q.choices.find((c) => c !== q.answer)); assert.equal(r.right, i < 3); assert.equal(r.last, i === qs.length - 1); });
  const f1 = sim.finishQuiz(st);
  assert.equal(f1.correct, 3); assert.equal(f1.coin, 24); assert.equal(st.coins, 124);
  assert.ok(f1.newBest); assert.equal(st.stats.quizBest, 3);
  assert.equal(st.quiz, null);
  // ぜんもん せいかい
  sim.startQuiz(st, seeded(6));
  for (const q of st.quiz.qs) sim.answerQuiz(st, q.answer);
  const f2 = sim.finishQuiz(st);
  assert.equal(f2.coin, 50); assert.equal(st.stats.quizBest, 5); assert.equal(st.stats.quizPerfect, 1);
  assert.equal(st.hearts, 0);
  assert.equal(st.stats.quizPlays, 2);
});

test('クイズ：とちゅうで やめても つづきから（ハートは 2どめ とられない）・セーブに のこる', () => {
  const st = freshState({ coins: 99999 });
  for (const id of ['medaka', 'guppy', 'neon_tetra', 'goldfish', 'corydoras', 'platy']) addFish(st, id);
  st.hearts = 30;
  sim.startQuiz(st, seeded(2));
  sim.answerQuiz(st, st.quiz.qs[0].answer);
  const again = sim.startQuiz(st);
  assert.ok(again.resume);
  assert.equal(st.hearts, 20);
  const back = S.migrate(JSON.parse(JSON.stringify(st)), sim.initialValues());
  sim.normalize(back);
  assert.equal(back.quiz.i, 1);
  assert.equal(back.quiz.correct, 1);
});

// ---------------- 画面・ファイル ----------------
test('画面：3つの 画面が あり、G.addScreen で とうろく・へやの ボタンは チュートリアルの あと', () => {
  const html = read('index.html');
  for (const id of ['minigame', 'box', 'player']) assert.match(html, new RegExp(`id="scr-${id}" class="screen sheet" data-screen="${id}" hidden`));
  for (const [f, name] of [['minigame', 'minigame'], ['box', 'box'], ['player', 'player']]) {
    const src = read(`js/ui/${f}.js`);
    assert.match(src, /export function init\(/);
    assert.match(src, new RegExp(`G\\.addScreen\\('${name}'`));
    assert.match(src, /tutorial\.done/);
  }
  assert.match(read('js/ui/tank.js'), /toBoxAsk/, 'すいそうの 魚カードから かりすいそうへ');
  assert.match(read('js/ui/room.js'), /\$\$\('#room-nav \[data-go\], #room-corner \[data-go\]'\)/, 'すみの ボタンも きく');
  const sw = read('sw.js');
  for (const f of ['js/ui/minigame.js', 'js/ui/box.js', 'js/ui/player.js', 'css/play.css']) assert.ok(sw.includes(`'${f}'`), f);
});

test('画面の 文字に 漢字が ない（ゲーム係の あたらしい ファイル）', () => {
  for (const f of ['js/ui/minigame.js', 'js/ui/box.js', 'js/ui/player.js']) {
    for (const s of uiStrings(read(f))) assert.ok(!KANJI.test(s.text), `${f}:${s.line} ${s.text}`);
  }
  const html = read('index.html');
  const part = html.slice(html.indexOf('id="scr-minigame"'), html.indexOf('<!-- チュートリアルの'));
  for (const t of htmlTexts(part)) assert.ok(!KANJI.test(t), t);
});

test('ミニゲームの コインは つうしん なし・ハートの 合計は ミニゲームで へらない（pet だけで ふえる）', () => {
  const src = read('js/sim.js');
  const quizPart = src.slice(src.indexOf('// ---------------- ミニゲーム'));
  assert.ok(!/heartsTotal\s*[-]=|heartsTotal\s*=\s*[^=]/.test(quizPart));
  for (const f of ['js/ui/minigame.js', 'js/ui/box.js', 'js/ui/player.js']) assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|speechSynthesis/.test(read(f)), f);
});
