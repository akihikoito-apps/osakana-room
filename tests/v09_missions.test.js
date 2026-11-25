// v0.9 の テスト（ミッション係）：すいそう 6つ の ミッション・20こ ふやした・ゆめのすいそうも すいそうの かずに かぞえる
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, freshState, addFish, KANJI, missions } from './_lib.js';

const M = missions.MISSIONS;
const byId = (id) => M.find((m) => m.id === id);
const V09 = ['r_tank4', 'r_tank5', 'r_waters3', 'r_gadget6', 'g_life6', 'g_creatures30', 'g_adult30', 'c_autocare1', 'c_autocare3', 'c_clean6', 'c_healthy6', 'c_water50',
  'z_fresh10', 'z_salt10', 'z_zukan40', 'p_dream1', 'p_dream5', 'p_quiz30', 'p_pet600', 'r_room6'];
const SIX = ['r_tank4', 'r_tank5', 'r_tank6', 'g_life6', 'c_clean6', 'c_healthy6', 'c_autocare1', 'c_autocare3'];

/** へやに すいそうを n こ（はじめの 1つ ふくむ） */
function withTanks(n, waters = ['salt', 'fresh', 'salt', 'fresh', 'salt']) {
  const st = freshState(); st.coins = 999999; st.unlocks.tank6 = 1;
  for (let i = 1; i < n; i++) sim.addTank(st, waters[(i - 1) % waters.length], []);
  return st;
}

test('ミッション（v0.9）：20こ ふえた・id も order も かぶらない・かんじ なし・lane は 5しゅるい', () => {
  for (const id of V09) assert.ok(byId(id), `${id} が ない`);
  assert.ok(M.length >= 106 + 20, String(M.length));
  assert.equal(new Set(M.map((m) => m.id)).size, M.length);
  assert.equal(new Set(M.map((m) => m.order)).size, M.length);
  assert.deepEqual([...new Set(M.map((m) => m.lane))].sort(), ['care', 'grow', 'play', 'room', 'zukan']);
  for (const m of M) {
    assert.ok(!KANJI.test(m.title + m.desc), m.id);
    assert.ok(m.title.length <= 12 && m.desc.length <= 32, `${m.id} の ことばが ながい`);
    assert.ok(m.reward.coin >= 20 && m.reward.coin <= 500, m.id);
  }
});

test('ミッション（v0.9）：すいそうの かずは 2・3・4・5・6・8 と ぬけなく つづく', () => {
  const counts = M.filter((m) => m.goal.type === 'tankCount').map((m) => m.goal.count).sort((a, b) => a - b);
  assert.deepEqual(counts, [2, 3, 4, 5, 6, 8]);
  // room lane の 中で 3 → 4 → 5 → 6 の じゅん、6 は かざりの ながい ミッション（r_decor20）より まえ
  const room = M.filter((m) => m.lane === 'room').sort((a, b) => a.order - b.order).map((m) => m.id);
  const at = (id) => room.indexOf(id);
  assert.ok(at('r_tank3') < at('r_tank4') && at('r_tank4') < at('r_tank5') && at('r_tank5') < at('r_tank6') && at('r_tank6') < at('r_tank8'), room.join(','));
  assert.ok(at('r_tank6') < at('r_decor20'), 'すいそう 6つ が かざり 20こ の うしろに うもれない');
  for (const id of SIX) assert.ok(byId(id), id);
});

test('ミッション（v0.9）：ゆめのすいそうも すいそうの かずに かぞえる（へやに 6つ ＝ 6）', () => {
  const st = withTanks(5);
  const P = (goal) => sim.missionProgress(st, { goal }).now;
  assert.equal(P({ type: 'tankCount', count: 6 }), 5);
  const d = sim.addTank(st, 'dream', []);
  d.clean = 100;
  assert.equal(st.tanks.length, 6);
  assert.equal(P({ type: 'tankCount', count: 6 }), 6, 'ゆめのすいそうも 1つ');
  assert.equal(P({ type: 'waterKinds', count: 3 }), 2, 'ゆめは うみ・かわ・いけ に かぞえない');
  // そうこの すいそうも かぞえる
  const s = sim.addTank(st, 'pond', []);
  assert.ok(s.stored);
  assert.equal(P({ type: 'tankCount', count: 8 }), 7);
  assert.equal(P({ type: 'waterKinds', count: 3 }), 3);
});

test('ミッション（v0.9）：6つ ぜんぶ の かぞえかた（ゆめのすいそうが あっても できる）', () => {
  const st = withTanks(5);
  const d = sim.addTank(st, 'dream', []);
  d.clean = 100;
  const P = (id) => { const p = sim.missionProgress(st, byId(id)); return p.now >= p.need; };
  assert.equal(P('g_life6'), false);
  for (const t of st.tanks) {
    if (t.water === 'dream') { const f = sim.createFish(st, 'dream_fish', { source: 'dream' }); f.health = 100; t.fish.push(f); continue; }
    addFish(st, t.water === 'salt' ? 'clownfish' : 'medaka', t);
  }
  for (const t of st.tanks) { t.clean = 90; for (const f of t.fish) f.health = 90; }
  assert.equal(P('g_life6'), true);
  assert.equal(P('c_clean6'), true);
  assert.equal(P('c_healthy6'), true);
  st.tanks[1].clean = 30;
  st.tanks[2].fish[0].health = 20;
  assert.equal(P('c_clean6'), false);
  assert.equal(P('c_healthy6'), false);
  // からの すいそうは 「みんな げんき」に かぞえない（all なしなら かず）
  st.tanks[2].fish = [];
  assert.equal(sim.missionProgress(st, { goal: { type: 'healthyTanks', count: 6, value: 70 } }).now, 5);
  assert.equal(sim.missionProgress(st, { goal: { type: 'roomTanks', count: 6 } }).now, 6);
  // ぜんぶ ピカピカ／げんき は そろった とき だけ 出る（まどを ふさがない）
  assert.equal(sim.missionOpen(st, byId('c_clean6')), false);
  st.tanks[1].clean = 90;
  assert.equal(sim.missionOpen(st, byId('c_clean6')), true);
});

test('ミッション（v0.9）：じどう おせわき・ゆめの いきもの の かぞえかた', () => {
  const st = withTanks(6);
  const P = (id) => sim.missionProgress(st, byId(id)).now;
  assert.equal(P('c_autocare1'), 0);
  st.stats.autoCareAttach = 1;
  assert.equal(P('c_autocare1'), 1);
  st.tanks[0].autoCare = true; st.tanks[3].autoCare = true;
  assert.equal(P('c_autocare3'), 2);
  st.tanks[5].autoCare = true;
  assert.equal(P('c_autocare3'), 3);
  st.stats.dreamMade = 5;
  assert.equal(P('p_dream1'), 1);
  assert.equal(P('p_dream5'), 5);
});

test('ミッション（v0.9）：6つ関係は すいそうが 6つに なって おせわきを もらうまで 出ない（まどを ふさがない）', () => {
  const st = withTanks(3);
  const open = (id) => sim.missionOpen(st, byId(id));
  for (const id of ['g_life6', 'c_autocare1', 'c_autocare3', 'c_clean6', 'c_healthy6']) assert.equal(open(id), false, id);
  assert.equal(open('p_dream1'), false, 'ゆめのすいそうを もらうまで');
  st.unlocks.autoCare = 1; st.unlocks.dreamTank = 5;
  for (const id of ['g_life6', 'c_autocare1', 'c_autocare3', 'p_dream1']) assert.equal(open(id), true, id);
  for (const id of ['c_clean6', 'c_healthy6']) assert.equal(open(id), false, `${id} は 6つ そろうまで 出ない`);
  // あたらしく はじめた 人：5つの まどは 5しゅるい、v0.9 の ものは まだ 出ない
  const fresh = freshState();
  const v = sim.visibleMissions(fresh);
  assert.equal(v.length, 5);
  assert.equal(new Set(v.map((m) => m.lane)).size, 5);
  assert.ok(!v.some((m) => V09.includes(m.id)), v.map((m) => m.id).join(','));
});

test('ミッション（v0.9）：とちゅうの 人（すいそう 6つ）は すぐ 6つ関係が 見える', () => {
  const st = withTanks(6);
  for (const m of M.filter((x) => x.order < 30)) { st.missions.done[m.id] = 1; st.missions.claimed[m.id] = 1; }
  st.unlocks.autoCare = 1;
  st.stats.adventureOpen = 1; st.unlocks.adventure = 1;
  const v = sim.visibleMissions(st).map((m) => m.id);
  assert.equal(v.length, 5);
  assert.ok(v.includes('c_autocare1'), v.join(','));
  assert.ok(v.includes('g_life6'), v.join(','));
  // room：r_decor3 など はじめの ものを おえていれば すいそうの かずが 見える
  for (const m of M.filter((x) => x.lane === 'room' && x.goal.type !== 'tankCount')) st.missions.claimed[m.id] = 1;
  const v2 = sim.visibleMissions(st).map((m) => m.id);
  assert.ok(v2.includes('r_tank3'), v2.join(','));
  sim.checkMissions(st);
  assert.ok(st.missions.done.r_tank3);
});

test('ミッション（v0.9）：どの goal も たっせい できる 形（しらない type が ない・かずが ほんとうに とどく）', () => {
  const st = withTanks(6);
  for (const m of M) {
    const p = sim.missionProgress(st, m);
    assert.ok(Number.isFinite(p.now) && Number.isFinite(p.need) && p.need >= 1, m.id);
    // default（しらない type）は { now:0, need:1 }。goal に count/value が あるのに need が 1 なら しらない type
    if ((m.goal.count ?? 1) > 1 && !m.goal.all) assert.equal(p.need, m.goal.count, `${m.id} の type ${m.goal.type} が かぞえられて いない`);
  }
  // すいそうの かずは かぎり（へや＋そうこ）まで、6つ関係は へやの 6つで とどく
  for (const m of M.filter((x) => x.goal.type === 'tankCount')) assert.ok(m.goal.count <= sim.tankLimit(), m.id);
  for (const m of M.filter((x) => ['roomTanks', 'lifeTanks', 'cleanTanks', 'healthyTanks'].includes(x.goal.type))) assert.ok(m.goal.count <= 6, m.id);
  for (const m of M.filter((x) => x.goal.type === 'autoCareOn')) assert.ok(m.goal.count <= 3, m.id);
  for (const m of M.filter((x) => x.goal.type === 'waterKinds')) assert.ok(m.goal.count <= 3, m.id);
});
