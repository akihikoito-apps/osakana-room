// v0.10 の テスト（レース係）：コース・うごき・のうりょくの きき・ジャンプ・コンピューター・ごほうび・ハートの 上限・画面の 文字
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, freshState, addFish, KANJI, read, exists, uiStrings, seeded } from './_lib.js';
import { buildCourse, COURSES, LEVELS, ROCK_H, frameAt, worldOf } from '../js/race/course.js';
import { derive, makeRacer, step, collide, ranking, jumpPeak, TUNE, CATCHUP, catchupTarget } from '../js/race/physics.js';
import { createRace, simulate } from '../js/race/race.js';
import { REWARD, finish, levelOpen, prizeOf } from '../js/race/reward.js';

const flat = (v) => ({ speed: v, accel: v, stamina: v, turn: v, jump: v, power: v });
const DT = 1 / 60;
/** まっすぐな ところ だけで うごきを しらべる ための コース（しょうがいぶつ なし・カーブ なし に ちかい） */
function plainCourse() {
  const c = buildCourse('easy');
  c.obstacles = [];
  c.curv = new Float32Array(c.M);   // カーブの ながされ なし
  return c;
}
/** n びょう はしらせて すすんだ きょり */
function run(c, stats, sec, input = {}) {
  const r = makeRacer({ id: 'a', stats });
  for (let t = 0; t < sec; t += DT) step(c, r, input, DT, t);
  return r;
}

test('コース：3つの むずかしさ・1しゅうの ながさ・とじた わ・しょうがいぶつ', () => {
  for (const lv of LEVELS) {
    const c = buildCourse(lv);
    assert.ok(Math.abs(c.length - COURSES[lv].length) / COURSES[lv].length < 0.08, `${lv} ${c.length}`);
    // とじている：さいごと はじめが つながる
    const a = frameAt(c, 0), b = frameAt(c, c.length - 0.01);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.5);
    const kinds = new Set(c.obstacles.map((o) => o.kind));
    assert.deepEqual([...kinds].sort(), ['ring', 'rock', 'weed']);
    // いわの よこには かならず すきまが ある（よけても とおれる）
    for (const o of c.obstacles.filter((x) => x.kind === 'rock')) assert.ok(c.half - Math.abs(o.lat) - o.w > TUNE.radius * 2 || o.w < c.half, 'すきま');
    // スタートの ちかくには なにも ない
    assert.ok(c.obstacles.every((o) => o.s > 20 && o.s < c.length - 20));
    // むずかしい ほど いわが おおい
  }
  assert.ok(buildCourse('hard').obstacles.filter((o) => o.kind === 'rock').length > buildCourse('easy').obstacles.filter((o) => o.kind === 'rock').length);
  const w = worldOf(buildCourse('easy'), 10, 2, 1);
  assert.ok(Number.isFinite(w.x + w.y + w.z + w.heading));
});

test('うごき：speed が 高いと はやい・accel が 高いと はやく かそく', () => {
  const c = plainCourse();
  const slow = run(c, flat(10), 8), fast = run(c, flat(90), 8);
  assert.ok(fast.s > slow.s * 1.15, `${slow.s} ${fast.s}`);
  const lo = derive({ ...flat(50), speed: 10 }), hi = derive({ ...flat(50), speed: 90 });
  assert.ok(hi.maxSpeed > lo.maxSpeed);
  // おなじ speed で accel だけ ちがう：さいしょの 1びょうで 差が つく
  const a1 = run(c, { ...flat(50), accel: 5 }, 1), a2 = run(c, { ...flat(50), accel: 95 }, 1);
  assert.ok(a2.s > a1.s + 0.8, `${a1.s} ${a2.s}`);
  assert.ok(derive({ accel: 95 }).stun < derive({ accel: 5 }).stun, 'たちなおり');
});

test('うごき：ダッシュは スタミナを つかって はやく なる・stamina で ゲージが ちがう', () => {
  const c = plainCourse();
  const normal = run(c, flat(50), 6), dash = run(c, flat(50), 6, { dash: true });
  assert.ok(dash.s > normal.s + 3, `${normal.s} ${dash.s}`);
  assert.ok(dash.dash < 0.05, 'ゲージを つかいきる');
  assert.ok(derive({ stamina: 90 }).dashCap > derive({ stamina: 10 }).dashCap);
  // つかいおわると もどる
  const r = run(c, flat(50), 6, { dash: true });
  for (let t = 0; t < 4; t += DT) step(c, r, {}, DT, t);
  assert.ok(r.dash > 0.3);
});

test('うごき：turn が 高いと よこに はやく うごける・カーブで ながされにくい', () => {
  const c = plainCourse();
  const side = (tv) => { const r = makeRacer({ id: 't', stats: { ...flat(50), turn: tv } }); r.speed = 11; for (let t = 0; t < 0.4; t += DT) step(c, r, { steer: 1 }, DT, t); return r; };
  const lo = side(5), hi = side(95);
  assert.ok(hi.yaw > lo.yaw + 0.3 && hi.lat > lo.lat + 0.2, `${lo.lat} ${hi.lat}`);
  assert.ok(derive({ turn: 95 }).drift < derive({ turn: 5 }).drift);
  // さわらないと コースの むきに もどる
  const r = run(c, flat(50), 0.5, { steer: 1 });
  for (let t = 0; t < 2; t += DT) step(c, r, {}, DT, t);
  assert.ok(Math.abs(r.yaw) < 0.05);
});

test('ジャンプ：いわを こえられる（よわい 魚でも）・ジャンプが 高いと 高く とぶ・とばないと ぶつかる', () => {
  for (const jv of [0, 50, 100]) {
    const d = derive({ jump: jv });
    assert.ok(jumpPeak(d) > ROCK_H + 0.3, `jump ${jv} ちょうてん ${jumpPeak(d)}`);
  }
  assert.ok(jumpPeak(derive({ jump: 100 })) > jumpPeak(derive({ jump: 0 })));
  // いわの まえで とぶ → こえる。とばない → ぶつかって とまる
  const mk = () => { const c = plainCourse(); c.obstacles = [{ kind: 'rock', s: 40, lat: 0, w: 2, len: 0.8, height: ROCK_H }]; return c; };
  for (const jv of [0, 100]) {
    const c = mk();
    const r = makeRacer({ id: 'j', stats: { ...flat(50), jump: jv } });
    let jumped = false, ev = [];
    for (let t = 0; t < 8; t += DT) {
      const dist = 40 - r.s;
      const want = r.speed * (r.d.jumpV / r.d.gravity);
      const e = step(c, r, { jump: !jumped && dist <= want }, DT, t);
      if (!jumped && dist <= want) jumped = true;
      ev = ev.concat(e);
    }
    assert.equal(r.bumpRock, 0, `jump ${jv} で ぶつかった`);
    assert.ok(ev.includes('over'), 'こえた');
    assert.ok(r.s > 60);
  }
  const c = mk();
  const r = makeRacer({ id: 'n', stats: flat(50) });
  const ev = [];
  for (let t = 0; t < 8; t += DT) ev.push(...step(c, r, {}, DT, t));
  assert.ok(ev.includes('rock'), 'とばないと ぶつかる');
});

test('かいそうで おそく・あわの わで はやく・power が つよいと おされにくい', () => {
  const c = plainCourse();
  c.obstacles = [15, 22, 29, 36, 43].map((s) => ({ kind: 'weed', s, lat: 0, w: 3, len: 2.2, height: 1.25 }));
  const inWeed = run(c, flat(50), 6), clear = run(plainCourse(), flat(50), 6);
  assert.ok(inWeed.s < clear.s - 2, `${inWeed.s} ${clear.s}`);
  const c2 = plainCourse();
  c2.obstacles = [{ kind: 'ring', s: 15, lat: 0, h: TUNE.swimH, r: 0.95 }];
  const ring = run(c2, flat(50), 5);
  assert.equal(ring.rings, 1);
  assert.ok(ring.s > run(plainCourse(), flat(50), 5).s + 1);
  // おしあい
  const c3 = plainCourse();
  const A = makeRacer({ id: 'A', stats: { ...flat(50), power: 95 }, lane: -0.2 }), B = makeRacer({ id: 'B', stats: { ...flat(50), power: 5 }, lane: 0.2 });
  A.s = B.s = 10;
  collide(c3, [A, B]);
  assert.ok(Math.abs(B.lat - 0.2) > Math.abs(A.lat + 0.2), 'よわい ほうが よけいに おされる');
});

test('コンピューター：3つの むずかしさで みんな ゴール できる・1レース 1ぷん ちょっと', () => {
  for (const level of LEVELS) {
    const cpu = sim.race?.cpuStats ? null : flat(45);
    for (let seed = 1; seed <= 4; seed++) {
      const cpus = [1, 2, 3].map((i) => ({ id: 'c' + i, stats: cpu || flat(30 + i * 10) }));
      const R = simulate({ level, seed, player: { id: 'p', stats: flat(50) }, cpus });
      assert.ok(R.racers.every((r) => r.finished), `${level} seed ${seed}：ゴール できない 魚が いる`);
      const t = R.player.finishTime;
      assert.ok(t > 45 && t < 120, `${level} ${t}びょう`);
    }
  }
});

test('コンピューター：むずかしさで つよく なる（cpuStats）・つよい 魚の ほうが かちやすい', () => {
  freshState();
  const avg = (lv) => { let s = 0; const rnd = seeded(7); for (let i = 0; i < 30; i++) { const st = sim.race.cpuStats(lv, rnd).stats; s += Object.values(st).reduce((a, b) => a + b, 0) / 6; } return s / 30; };
  assert.ok(avg('easy') < avg('normal') && avg('normal') < avg('hard'));
  let strongWins = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const R = simulate({ level: 'normal', seed, player: { id: 'p', stats: flat(85) }, cpus: [1, 2, 3].map((i) => ({ id: 'c' + i, stats: flat(35) })) });
    if (R.rankOf(R.player) === 1) strongWins++;
  }
  assert.ok(strongWins >= 5, `つよい 魚が ${strongWins}/6`);
  // 追いつき 補正は やさしめ（さいだい 6%）
  for (const lv of LEVELS) assert.ok(CATCHUP[lv].ahead <= 0.06 && CATCHUP[lv].behind <= 0.03 && CATCHUP[lv].player <= 0.03);
  const me = { isPlayer: true, s: 100 };
  assert.equal(catchupTarget({ isPlayer: false, s: 105 }, me, 105, 'normal'), 1, 'ちかい ときは 補正 なし');
});

test('レース：カウントダウン → スタート → ゴールで おわる・じゅんいは ゴールの じゅん', () => {
  const R = createRace({ level: 'easy', seed: 3, player: { id: 'me', stats: flat(60) }, cpus: [1, 2, 3].map((i) => ({ id: 'c' + i, stats: flat(30) })) });
  assert.equal(R.phase, 'count');
  const p0 = R.player.s;
  for (let i = 0; i < 60; i++) R.update(DT, {});
  assert.equal(R.player.s, p0, 'カウント中は うごかない');
  let guard = 0;
  while (R.phase !== 'done' && guard++ < 60 * 200) R.update(DT, { auto: true });
  assert.equal(R.phase, 'done');
  assert.ok(R.player.finished);
  const order = ranking(R.racers);
  assert.equal(order[0].finished, true);
});

test('ごほうび：1〜3いで その 魚からの ハート（1日の 上限とは べつ）と すこしの コイン・おなかが へる', () => {
  const st = freshState();
  const f = addFish(st, 'medaka');
  f.onaka = 80;
  st.coins = 100;
  st.daily.hearts = 20;          // きょうの ハートは もう いっぱい
  const h0 = st.hearts, ht0 = st.heartsTotal;
  const r = finish(st, f.uid, 'easy', 1, { time: 62.3 });
  assert.ok(r.ok);
  assert.equal(r.hearts, REWARD.hearts[0]);
  assert.equal(st.hearts, h0 + 5, '1いは 5こ');
  assert.equal(st.heartsTotal, ht0 + 5, 'heartsTotal にも 入る');
  assert.equal(st.daily.hearts, 20, '1日の 上限の かずは かわらない');
  assert.equal(r.coins, REWARD.coins.easy[0]);
  assert.equal(r.first, REWARD.firstWin, 'はじめての 1い');
  assert.equal(st.coins, 100 + REWARD.coins.easy[0] + REWARD.firstWin);
  assert.equal(f.onaka, 80 - REWARD.onaka);
  assert.equal(r.unlocked, 'normal');
  assert.equal(st.stats.raceRun, 1);
  assert.equal(st.stats.raceWin, 1);
  // 2かいめの 1いは ボーナス なし・4いは ハートも コインも なし（でも はしった 回数は ふえる）
  const r2 = finish(st, f.uid, 'easy', 1);
  assert.equal(r2.first, 0);
  const c0 = st.coins, h1 = st.hearts;
  const r4 = finish(st, f.uid, 'easy', 4);
  assert.equal(r4.hearts, 0); assert.equal(r4.coins, 0);
  assert.equal(st.coins, c0); assert.equal(st.hearts, h1);
  assert.equal(st.stats.raceRun, 3); assert.equal(st.stats.raceWin, 2);
  // 2い・3い
  assert.deepEqual([prizeOf('normal', 2).hearts, prizeOf('normal', 3).hearts], [3, 2]);
  // コインは すこし（回数 上限 なし なので）
  for (const lv of LEVELS) assert.ok(REWARD.coins[lv][0] <= 15);
  // おなかは マイナスに ならない（魚は しなない）
  f.onaka = 3; finish(st, f.uid, 'easy', 2);
  assert.equal(f.onaka, 0);
  assert.equal(st.tanks[0].fish.includes(f), true);
});

test('むずかしさ：かんたん は さいしょから・1いで つぎが ひらく', () => {
  const st = freshState();
  const f = addFish(st, 'medaka');
  assert.equal(levelOpen(st, 'easy'), true);
  assert.equal(levelOpen(st, 'normal'), false);
  finish(st, f.uid, 'easy', 2);
  assert.equal(levelOpen(st, 'normal'), false, '2いでは ひらかない');
  finish(st, f.uid, 'easy', 1);
  assert.equal(levelOpen(st, 'normal'), true);
  assert.equal(levelOpen(st, 'hard'), false);
  finish(st, f.uid, 'normal', 1);
  assert.equal(levelOpen(st, 'hard'), true);
  // セーブに のこる
  const st2 = JSON.parse(JSON.stringify(st));
  assert.equal(levelOpen(st2, 'hard'), true);
});

test('のうりょく係と つながっている：sim.race と sim.raceReward・effectiveStats で うごく', () => {
  const st = freshState();
  const f = addFish(st, 'medaka');
  assert.equal(typeof sim.race.effectiveStats, 'function');
  assert.equal(sim.raceReward.finish, finish);
  const s = sim.race.effectiveStats(st, f);
  for (const k of ['speed', 'accel', 'stamina', 'turn', 'jump', 'power']) assert.ok(s[k] >= 0 && s[k] <= 100);
  // コンディションが わるいと すこし おそい
  f.health = 100; const good = derive(sim.race.effectiveStats(st, f));
  f.health = 10; const bad = derive(sim.race.effectiveStats(st, f));
  assert.ok(good.maxSpeed > bad.maxSpeed);
  // レースに 出られる・出られない
  assert.equal(sim.race.canRace(f).ok, true);
  const sh = addFish(st, 'minami_shrimp');
  assert.equal(sim.race.canRace(sh).ok, false);
});

test('画面：ひらがな カタカナ だけ・ファイルが sw.js に ある・GPU の ものを すてる', () => {
  for (const p of ['js/ui/race.js', 'js/race/course.js', 'js/race/reward.js', 'js/race/scene.js']) {
    for (const s of uiStrings(read(p))) assert.ok(!KANJI.test(s.text), `${p}:${s.line} ${s.text}`);
  }
  const sw = read('sw.js');
  for (const p of ['js/race/course.js', 'js/race/physics.js', 'js/race/ai.js', 'js/race/race.js', 'js/race/reward.js', 'js/race/scene.js', 'js/ui/race.js', 'css/race.css']) {
    assert.ok(exists(p), p);
    assert.ok(sw.includes(`'${p}'`), `sw.js に ${p}`);
  }
  assert.ok(read('index.html').includes('css/race.css'));
  assert.ok(read('js/main.js').includes("'./ui/race.js'"));
  const sc = read('js/race/scene.js');
  assert.match(sc, /renderer\.dispose\(\)/);
  assert.match(sc, /lib\.dispose\(\)/);
  assert.match(sc, /\.dispose\(\)/);
  // fishModel は import して つかう だけ
  assert.match(sc, /from '\.\.\/aquarium\/fishModel\.js'/);
});
