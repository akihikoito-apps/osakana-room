// v0.10 の テスト（のうりょく係）：しゅるいの とくい・こたいち・そだち・コンディション・migrate・出られない 生きもの・cpuStats・カード
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, S, freshState, seeded, read, exists, uiStrings, KANJI, FISH } from './_lib.js';
import { PROFILE, DREAM_PROFILE, STAT_KEYS, RULE } from '../js/data/raceStats.js';

const DAY = 1440;
const ART = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const avg = (s) => STAT_KEYS.reduce((a, k) => a + s[k], 0) / STAT_KEYS.length;
const R = () => sim.race;
const mk = (id, o = {}) => { const st = freshState(); const f = sim.createFish(st, id, { rnd: seeded(o.seed || 3) }); Object.assign(f, o.f || {}); return { st, f }; };
const neutral = (f) => { f.rIndiv = Object.fromEntries(STAT_KEYS.map((k) => [k, 0])); return f; };

// ---------------- データ ----------------
test('レースに でられる さかなは ぜんぶ PROFILE が ある・6つ 0〜100・合計 320〜340・とくい 70 いじょう', () => {
  freshState();
  const fishes = FISH.filter((sp) => sp.obtain !== 'dream' && R().canRaceSpecies(sp.id));
  assert.ok(fishes.length >= 45, 'でられる しゅるい ' + fishes.length);
  for (const sp of fishes) {
    const p = PROFILE[sp.id];
    assert.ok(Array.isArray(p) && p.length === 6, 'PROFILE が ない：' + sp.id);
    assert.ok(p.every((v) => Number.isInteger(v) && v >= 0 && v <= 100), sp.id);
    const sum = p.reduce((a, b) => a + b);
    assert.ok(sum >= 320 && sum <= 340, `${sp.id} 合計 ${sum}`);
    assert.ok(Math.max(...p) >= 70, `${sp.id} に よい ところが ない`);
  }
  for (const id of Object.keys(PROFILE)) assert.ok(FISH.find((x) => x.id === id), 'fish.js に ない：' + id);
  for (const [k, p] of Object.entries(DREAM_PROFILE)) assert.equal(p.reduce((a, b) => a + b), 330, k);
  assert.deepEqual(PROFILE.gold_goldfish, PROFILE.goldfish, 'とくべつ コーナーは もとの しゅるいと おなじ');
});

test('しゅるいの とくい の れい：マアジ はやさ・エンゼル まがり・メダカ かそく・フグ パワー・グッピー ジャンプ', () => {
  freshState();
  const top = (id) => R().tokuiOf({ speciesId: id }).key;
  assert.equal(top('aji'), 'speed');
  assert.equal(top('angelfish'), 'turn');
  assert.equal(top('medaka'), 'accel');
  assert.equal(top('kusafugu'), 'power');
  assert.equal(top('boxfish'), 'power');
  assert.equal(top('guppy'), 'jump');
});

// ---------------- 出られない 生きもの ----------------
test('canRace：エビ・カニ・かい・カメ・カエル・むし・イカ は でられない（reason）。さかなは ok。おなかが すくないと hungry', () => {
  const { st } = mk('medaka');
  const chk = (id, reason) => { const f = sim.createFish(st, id); f.onaka = 80; const r = R().canRace(f); assert.equal(r.ok, !reason, id); if (reason) { assert.equal(r.reason, reason, id); assert.ok(r.text && !KANJI.test(r.text)); } };
  chk('medaka', null); chk('aji', null); chk('namazu', null); chk('gold_goldfish', null);
  chk('minami_shrimp', 'shrimp'); chk('zarigani', 'shrimp'); chk('sawagani', 'shrimp'); chk('madako', 'shrimp');
  chk('ishimaki', 'snail'); chk('tanishi', 'snail');
  chk('kusagame', 'turtle'); chk('ishigame', 'turtle'); chk('albino_suppon', 'turtle');
  chk('tonosamagaeru', 'frog'); chk('amagaeru', 'frog'); chk('otamajakushi', 'frog');
  chk('gengorou', 'bug'); chk('aoriika', 'squid');
  const f = sim.createFish(st, 'medaka'); f.onaka = RULE.minOnaka - 1;
  assert.deepEqual([R().canRace(f).ok, R().canRace(f).reason], [false, 'hungry']);
  f.onaka = RULE.minOnaka;
  assert.equal(R().canRace(f).ok, true);
  assert.equal(R().canRace(null).reason, 'none');
});

test('ゆめの いきもの：さかな（オリジナル・ぬりえ）は でられる。カエル・カメ・エビカニ は でられない。ぬりえは もとの しゅるいの とくい', () => {
  const st = freshState();
  sim.tick(st, sim.dayStartMin() + 4 * DAY + 1 - st.clock.min);
  const t = st.tanks.concat(st.storage).find((x) => x.water === 'dream');
  assert.ok(t);
  st.dex.aji = { first: 1, count: 1 }; st.dex.zarigani = { first: 1, count: 1 };
  const add = (o) => sim.dream.addCreature(st, t, { art: ART, base: null, kind: 'fish', speed: 'normal', size: 'm', name: 'ゆめ', ...o });
  const orig = add({}); const fast = add({ speed: 'fast' }); const nuri = add({ base: 'aji' });
  const frog = add({ kind: 'frog' }); const rep = add({ kind: 'reptile' }); const crab = add({ base: 'zarigani' });
  for (const f of [orig, fast, nuri]) assert.equal(R().canRace(f).ok, true, f.speciesId);
  assert.equal(R().canRace(frog).reason, 'frog');
  assert.equal(R().canRace(rep).reason, 'turtle');
  assert.equal(R().canRace(crab).reason, 'shrimp');
  assert.deepEqual(R().profileOf(nuri), PROFILE.aji);
  assert.deepEqual(R().profileOf(orig), DREAM_PROFILE.normal);
  assert.equal(R().tokuiOf(orig).key, 'all');
  neutral(orig); neutral(fast);
  const so = R().statsOf(st, orig), sf = R().statsOf(st, fast);
  assert.ok(sf.speed > so.speed, 'はやい を えらぶと はやさが すこし 上');
  assert.ok(sf.speed - so.speed <= 15, 'すこし だけ');
});

// ---------------- 約束の 関数 ----------------
test('statsOf：6つ ぜんぶ 0〜100 の 整数（どの さかな・どの だんかい・へんな あたい でも）', () => {
  const st = freshState();
  for (const sp of FISH.filter((x) => x.kind === 'fish')) {
    for (const stage of [0, 1, 2]) {
      const f = sim.createFish(st, sp.id, { rnd: seeded(stage + 7) });
      f.stage = stage; f.rQ = 1; f.rH = 1e6; f.rIndiv = Object.fromEntries(STAT_KEYS.map((k) => [k, 7]));
      const s = R().statsOf(st, f);
      assert.deepEqual(Object.keys(s), STAT_KEYS);
      for (const k of STAT_KEYS) assert.ok(Number.isInteger(s[k]) && s[k] >= 0 && s[k] <= 100, `${sp.id} ${k} ${s[k]}`);
      const e = R().effectiveStats(st, f);
      for (const k of STAT_KEYS) assert.ok(Number.isInteger(e[k]) && e[k] >= 0 && e[k] <= 100);
    }
  }
});

test('こたいち：手に入れた とき きまる・1ぴき ずつ ちがう・±7 の 整数・へいきん 0 くらい・セーブで のこる', () => {
  const st = freshState();
  const rnd = seeded(21);
  const fs = Array.from({ length: 3000 }, () => sim.createFish(st, 'medaka', { rnd }));
  const all = fs.flatMap((f) => STAT_KEYS.map((k) => f.rIndiv[k]));
  assert.ok(all.every((v) => Number.isInteger(v) && Math.abs(v) <= RULE.indivMax));
  const m = all.reduce((a, b) => a + b) / all.length;
  const sd = Math.sqrt(all.reduce((a, b) => a + (b - m) ** 2, 0) / all.length);
  assert.ok(Math.abs(m) < 0.2, 'へいきん ' + m);
  assert.ok(sd > 2.8 && sd < 4, 'ばらつき ' + sd);
  const edge = all.filter((v) => Math.abs(v) === RULE.indivMax).length / all.length;
  assert.ok(edge < 0.03, 'はしに たまらない ' + edge);
  const keys = new Set(fs.slice(0, 50).map((f) => JSON.stringify(f.rIndiv)));
  assert.ok(keys.size > 45, '1ぴき ずつ ちがう');
  // おなじ しゅるい・おなじ そだち でも のうりょくが ちがう
  const a = fs[0], b = fs.find((f) => JSON.stringify(f.rIndiv) !== JSON.stringify(a.rIndiv));
  assert.notDeepEqual(R().statsOf(st, a), R().statsOf(st, b));
  // セーブ → よみこみ で かわらない
  st.tanks[0].fish.push(a);
  const before = { ...a.rIndiv };
  const back = S.deserialize ? S.deserialize(S.serialize(st)) : JSON.parse(JSON.stringify(st));
  sim.normalize(back);
  assert.deepEqual(back.tanks[0].fish.find((x) => x.uid === a.uid).rIndiv, before);
  sim.normalize(back);
  assert.deepEqual(back.tanks[0].fish.find((x) => x.uid === a.uid).rIndiv, before);
});

test('とくいの こたいちは マイナスに ならない（ハズレで かなしく ならない）', () => {
  const { st, f } = mk('aji');
  f.rIndiv = Object.fromEntries(STAT_KEYS.map((k) => [k, -7]));
  f.stage = 2; f.rQ = 0; f.rH = 0;
  const s = R().statsOf(st, f);
  assert.equal(s.speed, Math.round((PROFILE.aji[0] + 7) * RULE.stageMul[2]));
  assert.equal(s.accel, Math.round((PROFILE.aji[1] - 7) * RULE.stageMul[2]));
});

test('そだつと 上がる：ちびっこ < おとな < ビッグ（とちゅうも なめらか）', () => {
  const { st, f } = mk('medaka');
  neutral(f); f.rQ = 0.5; f.rH = 100;
  const at = (stage, grow) => { f.stage = stage; f.grow = grow; return avg(R().statsOf(st, f)); };
  const need0 = FISH.find((x) => x.id === 'medaka').growDays[0] * sim.balance().GROW.hoursPerGrowDay;
  const a = at(0, 0), a2 = at(0, need0 / 2), b = at(1, 0), c = at(2, 0);
  assert.ok(a < a2 && a2 < b && b < c, `${a} ${a2} ${b} ${c}`);
  assert.ok(c - a > 15, 'ビッグは ちびっこより しっかり つよい');
});

test('けんこうと えいようが よいと 上がりやすい（おなじ 時間 そだてて くらべる）', () => {
  const run = (health, eiyo) => {
    const st = freshState();
    const f = sim.createFish(st, 'medaka', { rnd: seeded(9) });
    neutral(f); f.stage = 1;
    for (let h = 0; h < 150; h++) { f.health = health; f.eiyo = eiyo; f.onaka = 80; R().hourTick(f); }
    return { avg: avg(R().statsOf(st, f)), bonus: R().careBonus(f) };
  };
  const good = run(100, 90), mid = run(80, 50), lowE = run(100, 10), lowH = run(40, 90);
  assert.ok(good.avg > mid.avg, `${good.avg} > ${mid.avg}`);
  assert.ok(mid.avg > lowE.avg || mid.avg > lowH.avg);
  assert.ok(good.avg > lowE.avg, 'えいようの ある えさで 上がりやすい');
  assert.ok(good.avg > lowH.avg, 'けんこうで 上がりやすい');
  assert.ok(good.bonus <= RULE.careMax + 1e-9 && good.bonus > RULE.careMax * 0.8, 'ボーナス ' + good.bonus);
  // おなかが すきすぎ だと のびにくい
  const st = freshState(); const f = sim.createFish(st, 'medaka');
  f.health = 100; f.eiyo = 90; f.onaka = 80; const q1 = R().careQ(f); f.onaka = 5;
  assert.ok(R().careQ(f) < q1);
});

test('バランスの よい えさ（いろいろ）は えいようが ふえて のうりょくも 上がりやすい（sim の 1じかんで）', () => {
  const grow = (foods) => {
    const st = freshState();
    const t = st.tanks[0];
    const f = sim.createFish(st, 'medaka', { rnd: seeded(4) }); neutral(f); t.fish.push(f);
    for (const id of foods) { st.inv[id] = 999; st.owned[id] = true; }
    let now = 1e9;
    for (let d = 0; d < 6; d++) {
      for (let i = 0; i < 3; i++) { f.onaka = 0; now += 60000; const fd = foods[(d * 3 + i) % foods.length]; if (sim.feedStart(st, t, fd, now).ok) { sim.feedEat(st, f.uid, now + 1); sim.feedEnd(st); } sim.tick(st, 240, seeded(d * 3 + i + 1)); }
      t.clean = 100; t.temp = 24; f.health = 100;
    }
    f.stage = 1; f.grow = 0;
    return R().careBonus(f);
  };
  const one = grow(['food_flake']);
  const many = grow(['food_flake', 'food_bloodworm', 'food_brine']);
  assert.ok(many > one, `いろいろ ${many} > フレークだけ ${one}`);
});

test('conditionOf：けんこう 10 → 0.7・90 いじょう → 1.0・あいだは まっすぐ。effectiveStats ＝ statsOf × コンディション', () => {
  const { st, f } = mk('aji');
  f.health = 10; assert.equal(R().conditionOf(f), 0.7);
  f.health = 90; assert.equal(R().conditionOf(f), 1);
  f.health = 100; assert.equal(R().conditionOf(f), 1);
  f.health = 50; assert.equal(R().conditionOf(f), 0.85);
  f.health = 40; const c = R().conditionOf(f);
  assert.ok(c > 0.7 && c < 1);
  const s = R().statsOf(st, f), e = R().effectiveStats(st, f);
  for (const k of STAT_KEYS) assert.equal(e[k], Math.round(s[k] * c));
  f.health = 100;
  assert.deepEqual(R().effectiveStats(st, f), R().statsOf(st, f));
  assert.equal(R().conditionWord(1).lvl, 'good'); assert.equal(R().conditionWord(0.7).lvl, 'bad');
});

test('sim の 1じかんで おせわが かぞえられる（すいそうの 魚）', () => {
  const st = freshState();
  const t = st.tanks[0];
  const f = sim.createFish(st, 'medaka'); t.fish.push(f);
  assert.equal(f.rH, 0);
  sim.tick(st, 600, seeded(1));
  assert.ok(f.rH >= 9, 'rH ' + f.rH);
  assert.ok(f.rQ > 0 && f.rQ <= 1);
});

// ---------------- migrate ----------------
test('migrate：こたいちの ない 古い 魚にも uid から つく（もらいそこね なし・なんかい よんでも おなじ）。だんかいに あった おせわ', () => {
  const st = freshState();
  const old = (uid, stage) => ({ uid, speciesId: 'medaka', stage, onaka: 60, health: 80, mood: 60, natsuki: 0 });
  st.tanks[0].fish.push(old('o1', 0), old('o2', 2));
  st.box = [old('o3', 1)];
  const json = JSON.stringify(st);
  sim.normalize(st);
  const all = st.tanks[0].fish.concat(st.box);
  for (const f of all) {
    assert.ok(f.rIndiv && STAT_KEYS.every((k) => Number.isInteger(f.rIndiv[k]) && Math.abs(f.rIndiv[k]) <= RULE.indivMax), f.uid);
    assert.equal(f.rQ, RULE.oldQ);
  }
  assert.deepEqual(all.map((f) => f.rH), [RULE.oldH[0], RULE.oldH[2], RULE.oldH[1]]);
  const again = JSON.parse(json); sim.normalize(again);
  assert.deepEqual(again.tanks[0].fish.map((f) => f.rIndiv), st.tanks[0].fish.map((f) => f.rIndiv), 'おなじ uid → おなじ こたいち');
  assert.notDeepEqual(all[0].rIndiv, all[1].rIndiv);
  // こわれた あたいは なおす
  const g = st.tanks[0].fish[0];
  g.rIndiv = { speed: 99, accel: 'x' }; g.rQ = 5; g.rH = -3;
  sim.normalize(st);
  assert.equal(g.rIndiv.speed, RULE.indivMax);
  assert.ok(Number.isInteger(g.rIndiv.accel));
  assert.equal(g.rQ, 1); assert.equal(g.rH, 0);
});

// ---------------- コンピューター ----------------
test('cpuStats：{ speciesId, stats }・でられる しゅるい・とくべつ／ゆめ なし・easy < normal < hard・めやす', () => {
  freshState();
  const rnd = seeded(33);
  const mean = {};
  for (const lv of ['easy', 'normal', 'hard']) {
    let sum = 0;
    for (let i = 0; i < 400; i++) {
      const c = R().cpuStats(lv, rnd);
      assert.ok(R().canRaceSpecies(c.speciesId), c.speciesId);
      assert.notEqual(FISH.find((x) => x.id === c.speciesId).obtain, 'premium');
      assert.deepEqual(Object.keys(c.stats), STAT_KEYS);
      for (const k of STAT_KEYS) assert.ok(Number.isInteger(c.stats[k]) && c.stats[k] >= 0 && c.stats[k] <= 100);
      sum += avg(c.stats);
    }
    mean[lv] = sum / 400;
  }
  assert.ok(mean.easy < mean.normal && mean.normal < mean.hard, JSON.stringify(mean));
  assert.ok(Math.abs(mean.easy - 34) < 3, 'easy ' + mean.easy);
  assert.ok(Math.abs(mean.normal - 46) < 3, 'normal ' + mean.normal);
  assert.ok(Math.abs(mean.hard - 60) < 3, 'hard ' + mean.hard);
  assert.deepEqual(Object.keys(R().cpuStats('???', seeded(1)).stats), STAT_KEYS, 'しらない レベルは normal');
});

test('めやす：ふつうに そだてた おとなは normal より つよく、よく そだてた ビッグは hard より つよい', () => {
  const st = freshState();
  const f = sim.createFish(st, 'medaka'); neutral(f);
  f.health = 90;
  f.stage = 1; f.grow = 0; f.rQ = 0.58; f.rH = 100;
  const adult = avg(R().effectiveStats(st, f));
  f.stage = 2; f.rQ = 0.9;
  const bigGood = avg(R().effectiveStats(st, f));
  const cpuMean = (lv) => { const rnd = seeded(5); let s = 0; for (let i = 0; i < 300; i++) s += avg(R().cpuStats(lv, rnd).stats); return s / 300; };
  assert.ok(adult > cpuMean('normal'), `おとな ${adult} > normal ${cpuMean('normal')}`);
  assert.ok(bigGood > cpuMean('hard'), `ビッグ ${bigGood} > hard ${cpuMean('hard')}`);
  f.stage = 0; f.rQ = 0.5; f.rH = 0;
  assert.ok(avg(R().effectiveStats(st, f)) < cpuMean('normal'), 'ちびっこ では normal は むずかしい');
});

// ---------------- 画面・ファイル ----------------
test('カードの のうりょく：タブ（ようす／のうりょく）・raceCard.js・stats.css・sw.js・index.html・ひらがな カタカナ だけ', () => {
  for (const p of ['js/race/stats.js', 'js/data/raceStats.js', 'js/ui/raceCard.js', 'css/stats.css']) {
    assert.ok(exists(p), p);
    assert.ok(read('sw.js').includes(`'${p}'`), 'sw.js に ない ' + p);
  }
  assert.ok(read('index.html').includes('css/stats.css'));
  const tank = read('js/ui/tank.js');
  assert.ok(tank.includes("from './raceCard.js'") && tank.includes('のうりょく') && tank.includes('ようす'));
  assert.ok(read('js/sim.js').includes("export * as race from './race/stats.js'"));
  for (const p of ['js/race/stats.js', 'js/data/raceStats.js', 'js/ui/raceCard.js']) for (const s of uiStrings(read(p))) assert.ok(!KANJI.test(s.text), `${p}:${s.line} ${s.text}`);
});
