// state.js（セーブ・時計）の テスト（点検係）。localStorage・document・performance・setInterval は 簡単な 偽物。
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { S, sim, setupSim, freshState, addFish } from './_lib.js';

// ---------------- 偽物 ----------------
function fakeStorage({ throwOnSet = false, throwOnGet = false } = {}) {
  const m = new Map();
  return {
    m,
    getItem(k) { if (throwOnGet) throw new Error('SecurityError'); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { if (throwOnSet) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem(k) { m.delete(k); },
  };
}
const savedGlobals = {};
function setGlobal(name, value) {
  if (!(name in savedGlobals)) savedGlobals[name] = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true, enumerable: true });
}
function restoreGlobals() {
  for (const [k, d] of Object.entries(savedGlobals)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; delete savedGlobals[k]; }
}
const warn = console.warn;
beforeEach(() => { console.warn = () => {}; });
afterEach(() => { restoreGlobals(); console.warn = warn; });

function fakeDom() {
  const listeners = {};
  const doc = {
    visibilityState: 'visible',
    addEventListener(n, fn) { (listeners[n] ||= []).push(fn); },
    removeEventListener(n, fn) { listeners[n] = (listeners[n] || []).filter((f) => f !== fn); },
    fire(n) { for (const fn of listeners[n] || []) fn(); },
    listeners,
  };
  let now = 1000;
  let intervalFn = null;
  setGlobal('document', doc);
  setGlobal('performance', { now: () => now });
  setGlobal('setInterval', (fn) => { intervalFn = fn; return 1; });
  setGlobal('clearInterval', () => { intervalFn = null; });
  return {
    doc,
    advance(ms) { now += ms; },
    step() { intervalFn?.(); },
    get running() { return !!intervalFn; },
  };
}

// ---------------- 時計 ----------------
test('1日 ＝ 600びょう：1びょうごとに 600かい で ゲームの 1440ぷん', () => {
  assert.equal(S.REAL_SEC_PER_GAME_DAY, 600);
  setupSim();
  assert.equal(sim.balance().TIME.realSecPerGameDay, 600);
  const dom = fakeDom();
  let total = 0;
  const c = S.createClock((m) => { total += m; });
  c.start();
  dom.step();                   // はじめの 1かいは きじゅんを きめるだけ
  for (let i = 0; i < 600; i++) { dom.advance(1000); dom.step(); }
  assert.ok(Math.abs(total - 1440) < 1e-6, `total=${total}`);
  c.stop();
  assert.equal(dom.running, false);
});

test('hidden の あいだは 時計が とまり、もどっても その あいだを たさない', () => {
  const dom = fakeDom();
  let total = 0;
  const c = S.createClock((m) => { total += m; });
  c.start(); dom.step();
  dom.advance(1000); dom.step();
  const t1 = total;
  assert.ok(Math.abs(t1 - 2.4) < 1e-9);
  // かくれる
  dom.doc.visibilityState = 'hidden'; dom.doc.fire('visibilitychange');
  for (let i = 0; i < 100; i++) { dom.advance(60_000); dom.step(); }   // 100ぷん
  assert.equal(total, t1, 'hidden の あいだに すすんだ');
  // もどる
  dom.doc.visibilityState = 'visible'; dom.doc.fire('visibilitychange');
  assert.equal(total, t1, 'もどった しゅんかんに とりもどした');
  dom.advance(1000); dom.step();
  assert.ok(Math.abs(total - t1 - 2.4) < 1e-9, `もどって 1びょうで ${total - t1}`);
  c.stop();
});

test('ブラウザが かたまっていた あいだ（タイマーが こない）も 3びょうぶん までしか すすまない', () => {
  const dom = fakeDom();
  let total = 0;
  const c = S.createClock((m) => { total += m; });
  c.start(); dom.step();
  dom.advance(3600_000); dom.step();         // 1じかん とんだ
  assert.ok(total <= 3 * 2.4 + 1e-9, `total=${total}`);
  c.stop();
});

test('はやおくり（speed）は かけざん、0 なら とまる', () => {
  const dom = fakeDom();
  let total = 0;
  const c = S.createClock((m) => { total += m; });
  c.speed = 10; c.start(); dom.step();
  dom.advance(1000); dom.step();
  assert.ok(Math.abs(total - 24) < 1e-9);
  c.speed = 0; dom.advance(1000); dom.step();
  assert.ok(Math.abs(total - 24) < 1e-9);
  c.speed = 'abc'; assert.equal(c.speed, 0);
  c.stop();
});

test('とじていた あいだを とりもどさない：むかしの セーブを よんでも 時刻は セーブの まま', () => {
  const ls = fakeStorage();
  setGlobal('localStorage', ls);
  const st = freshState();
  addFish(st, 'medaka');
  st.clock.min = 3000;
  st.created = Date.now() - 30 * 24 * 3600 * 1000;    // 30にち まえ
  st.savedAt = Date.now() - 30 * 24 * 3600 * 1000;
  S.save(st);
  const back = S.load(sim.initialValues());
  sim.normalize(back);
  assert.equal(back.clock.min, 3000);
  assert.equal(back.tanks[0].fish[0].health, st.tanks[0].fish[0].health);
});

// ---------------- セーブ ----------------
const BROKEN = [
  '{こわれた',
  'null', '[]', '123', '"text"', 'true', '',
  '{}',
  '{"v":1,"coins":"abc","tanks":"x","clock":5}',
  '{"v":1,"coins":-50,"tanks":[{"fish":[{"speciesId":"medaka","health":-5},{"speciesId":"nope"},null,7],"decor":["heater",3,"unknown"]}],"clock":{"min":-4}}',
  '{"v":1,"tanks":[{"fish":[{"uid":"a","speciesId":"medaka","stage":9,"food":50,"happy":80,"bond":30}]}],"tutorial":{"done":true,"step":99},"inv":{"food_flake":1}}',
  '{"v":99,"coins":10,"tanks":[],"missions":"x","stats":[1,2],"daily":null}',
  '{"v":1,"tanks":[null,{"id":5,"temp":"hot","clean":1e9,"air":-1e9,"fish":"many"}]}',
];

test('こわれた・からの・へんな セーブでも おちずに あそべる じょうたいで はじまる', () => {
  setupSim();
  for (const txt of BROKEN) {
    const ls = fakeStorage();
    setGlobal('localStorage', ls);
    if (txt !== '') ls.setItem(S.SAVE_KEY, txt);
    let st;
    assert.doesNotThrow(() => { st = S.load(sim.initialValues()); sim.normalize(st); }, `load: ${txt}`);
    assert.ok(Array.isArray(st.tanks) && st.tanks.length >= 1, `tanks: ${txt}`);
    assert.ok(Number.isFinite(st.coins) && st.coins >= 0, `coins: ${txt}`);
    assert.ok(Number.isFinite(st.clock.min) && st.clock.min >= 0, `clock: ${txt}`);
    for (const t of st.tanks) {
      assert.ok(Array.isArray(t.fish) && Array.isArray(t.decor));
      for (const f of t.fish) {
        assert.ok(f.health >= 10 && f.health <= 100, `health ${f.health}: ${txt}`);
        assert.ok([0, 1, 2].includes(f.stage));
        assert.ok(sim.data().fishById[f.speciesId], 'しらない 魚は のこらない');
      }
      for (const id of t.decor) assert.ok(sim.data().itemById[id]?.inTank, `decor ${id}`);
    }
    // そのまま 時間を すすめても、お世話しても おちない
    assert.doesNotThrow(() => {
      sim.tick(st, 1440, () => 0.5);
      sim.currentHint(st); sim.visibleMissions(st); sim.checkMissions(st);
      sim.waterChange(st); sim.scoop(st);
      sim.feedStart(st); sim.feedEnd(st);
      S.save(st);
    }, `あそぶ: ${txt}`);
  }
});

test('JSON が よめない セーブは -broken に のこして 新しく はじめる', () => {
  const ls = fakeStorage();
  setGlobal('localStorage', ls);
  ls.setItem(S.SAVE_KEY, '{こわれた');
  const st = S.load({ coins: 200 });
  assert.equal(st.coins, 200);
  assert.equal(ls.getItem(S.SAVE_KEY + '-broken'), '{こわれた');
});

test('localStorage が つかえない（プライベート・いっぱい）ときも おちない', () => {
  setGlobal('localStorage', fakeStorage({ throwOnGet: true, throwOnSet: true }));
  let st;
  assert.doesNotThrow(() => { st = S.load({ coins: 200 }); });
  assert.equal(st.coins, 200);
  assert.equal(S.save(st), false);
  assert.doesNotThrow(() => S.resetSave());
});

test('localStorage そのものが ない ときも おちない', () => {
  setGlobal('localStorage', undefined);
  let st;
  assert.doesNotThrow(() => { st = S.load({ coins: 200 }); });
  assert.equal(S.save(st), false);
});

test('セーブ → ロード で なかみが もどる', () => {
  setGlobal('localStorage', fakeStorage());
  const st = freshState();
  addFish(st, 'guppy'); st.coins = 321; st.missions.claimed.m_feed3 = 2;
  assert.equal(S.save(st), true);
  const back = S.load(sim.initialValues());
  sim.normalize(back);
  assert.equal(back.coins, 321);
  assert.equal(back.tanks[0].fish[0].speciesId, 'guppy');
  assert.equal(back.missions.claimed.m_feed3, 2);
  assert.equal(back.tutorial.done, true);
});

test('ふるい なまえ（food/happy/bond）を よみかえる', () => {
  setGlobal('localStorage', fakeStorage());
  localStorage.setItem(S.SAVE_KEY, BROKEN[10]);
  setupSim();
  const st = S.load(sim.initialValues()); sim.normalize(st);
  const f = st.tanks[0].fish[0];
  assert.equal(f.onaka, 50); assert.equal(f.mood, 80); assert.equal(f.natsuki, 30);
  assert.equal(f.stage, 0);
});

test('時刻の くぎり：日づけは あさ 6:00 で かわる・あさ ひる ゆうがた よる', () => {
  setupSim();
  assert.equal(sim.gameDay(6 * 60), 1);
  assert.equal(sim.gameDay(6 * 60 + 1439), 1);
  assert.equal(sim.gameDay(6 * 60 + 1440), 2);
  assert.equal(S.phaseOf(7 * 60), 'morning');
  assert.equal(S.phaseOf(12 * 60), 'noon');
  assert.equal(S.phaseOf(18 * 60), 'evening');
  assert.equal(S.phaseOf(23 * 60), 'night');
  for (let m = 0; m < 1440; m += 30) { const l = S.lightOf(m); assert.ok(l >= 0.45 && l <= 1, `light ${m}: ${l}`); }
});
