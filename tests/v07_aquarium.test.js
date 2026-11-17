// v0.7 3D水槽係：ピンセットで えさ・みずかえの えんしゅつ。
// きまり：
// - ピンセットは 1ぴきずつ 口もとへ（りくちの カエル・カメにも とどく）。たべた ときは まくと おなじ onEat（ハート・'eat'）、きらいな えさは ぷいっ。
// - かぞえかたは まくと おなじ（feedStart → feedEat → feedEnd）。ピンセットは 粒が のこらないので たべのこしは ふえない。
// - みずかえは 水の ふかさを 3分の2 まで さげて → そそいで もとへ（約3びょう）。とちゅうで おわらせても 水位は もどる。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, freshState, addFish, read, balance as B } from './_lib.js';
import * as THREE from '../vendor/three.module.min.js';
import { Tweezers, TWEEZERS_DUR } from '../js/aquarium/tweezers.js';

// ---------------- ピンセット（3D の うごき） ----------------
function fakeTank() {
  return { levelNow: 5, waterMaxX: 0, bounds: { minZ: -2.6, maxZ: 2.7 }, foodKinds: {}, ripples: 0, addRipple() { this.ripples++; } };
}
function fakeAgent(x, y, yaw = 0) {
  const a = { uid: 'f1', pos: new THREE.Vector3(x, y, 0), yaw, pitch: 0, len: 1.2, wave: 0, amp: 0.05, speed: 0.5, clock: 0, sx: 1, flash: 0, reacts: [] };
  a.mouth = (out) => out.set(a.pos.x + Math.cos(a.yaw) * a.len * 0.46, a.pos.y, a.pos.z - Math.sin(a.yaw) * a.len * 0.46);
  a.startReact = (t) => a.reacts.push(t);
  return a;
}
const run = (tw, sec, dt = 1 / 60) => { for (let t = 0; t < sec; t += dt) tw.update(dt); };

test('ピンセット：りくちの 上（水の 外）の 子にも 口もとまで とどいて、1かいだけ たべる・おわると うごける', async () => {
  const scene = new THREE.Scene();
  const tw = new Tweezers(scene, fakeTank(), null);
  const a = fakeAgent(4, 6.0, Math.PI);   // りくち（水位 5 より 上）・ひだり むき
  const eats = [];
  const p = tw.play(a, { kind: 'flake', pref: () => 'ok', onEat: (ag, k) => eats.push([ag.uid, k]) });
  assert.ok(p, 'はじまらない');
  assert.equal(a.held, true, 'まっている あいだ その子は とまる');
  assert.equal(tw.play(a, {}), null, 'うごいている あいだは 2ほんめを ださない');
  run(tw, 0.62);
  const tip = tw.rig.position, m = a.mouth(new THREE.Vector3());
  assert.ok(tip.distanceTo(m) < 0.5, `口もとに とどいて いない（${tip.distanceTo(m).toFixed(2)}）`);
  assert.ok(tw.axis.x < 0, 'かおを むけている がわ（ひだり）から 入る');
  run(tw, TWEEZERS_DUR);
  assert.deepEqual(eats, [['f1', 'flake']]);
  assert.equal(await p, 'ate');
  assert.equal(a.held, false);
  assert.equal(tw.busy, false);
  assert.equal(tw.rig.visible, false);
  tw.dispose();
});

test('ピンセット：きらいな えさは ぷいっ（たべない）。とちゅうで おわらせると その場で たべた ことに なる', async () => {
  const tw = new Tweezers(new THREE.Scene(), fakeTank(), null);
  const a = fakeAgent(-3, 3, 0);
  const eats = [], puis = [];
  const p = tw.play(a, { kind: 'bloodworm', pref: () => 'dislike', onEat: () => eats.push(1), onPui: (ag, k) => puis.push(k) });
  run(tw, TWEEZERS_DUR + 0.1);
  assert.equal(await p, 'pui');
  assert.deepEqual(eats, []);
  assert.deepEqual(puis, ['bloodworm']);
  assert.ok(a.reacts.includes('pui'));
  // とちゅうで finish（画面を はなれた とき）
  const b = fakeAgent(-2, 3, 0);
  const p2 = tw.play(b, { pref: () => 'ok', onEat: () => eats.push(2) });
  run(tw, 0.2);
  tw.finish();
  assert.equal(await p2, 'ate');
  assert.deepEqual(eats, [2]);
  assert.equal(b.held, false);
  // いなくなった 子は たべない
  const c = fakeAgent(-1, 3, 0);
  const p3 = tw.play(c, { pref: () => 'ok', onEat: () => eats.push(3) });
  c.gone = true;
  run(tw, 0.1);
  assert.equal(await p3, 'gone');
  assert.deepEqual(eats, [2]);
  tw.dispose();
});

// ---------------- かぞえかた（sim） ----------------
test('ピンセット：かぞえかたは まくと おなじ（えさの かいすう 1・コイン 1かい・1ぴき 1かい）。たべのこしは ふえない', () => {
  const st = freshState();
  const t = st.tanks[0];
  for (const id of ['medaka', 'medaka', 'guppy', 'guppy']) addFish(st, id, t);
  st.inv.food_flake = 1;
  st.inv.food_bloodworm = 3;
  // 半分 以上 おなか いっぱい（まく なら たべのこしが ふえる じょうたい）
  t.fish.forEach((f, i) => { f.onaka = i < 2 ? 95 : 20; });
  const eater = t.fish.find((f) => f.onaka < 90 && sim.foodPrefOf(f.speciesId, 'food_bloodworm') !== 'no');
  assert.ok(eater, 'たべる 子が いない（データが かわった？）');
  t.leftover = 0;
  const now = Date.now() + 1e7;
  const r = sim.feedStart(st, t, 'food_bloodworm', now, { tweezers: true });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(t.leftover, 0, 'ピンセットで たべのこしが ふえた');
  assert.equal(st.inv.food_bloodworm, 2, 'えさの かいすうは 1かい へる');
  const coin0 = st.coins;
  const e1 = sim.feedEat(st, eater.uid, now + 10);
  assert.ok(e1 && e1.uid === eater.uid);
  assert.equal(sim.feedEat(st, eater.uid, now + 20), null, 'おなじ 子は 1かいだけ');
  const other = t.fish.find((f) => f !== eater && f.onaka < 90);
  if (other && sim.foodPrefOf(other.speciesId, 'food_bloodworm') !== 'no') sim.feedEat(st, other.uid, now + 30);
  assert.ok(st.coins - coin0 <= B.COIN.care.feed.coin, 'コインは 1かいぶん まで');
  sim.feedEnd(st);
  // くらべ：まく と たべのこしが ふえる
  const st2 = freshState(); const t2 = st2.tanks[0];
  for (const id of ['medaka', 'medaka', 'guppy', 'guppy']) addFish(st2, id, t2);
  t2.fish.forEach((f, i) => { f.onaka = i < 2 ? 95 : 20; });
  t2.leftover = 0;
  st2.inv.food_flake = 1;
  sim.feedStart(st2, t2, 'food_flake', now);
  assert.ok(t2.leftover > 0, 'まく ときは いままでどおり');
  sim.feedEnd(st2);
});

// ---------------- みずかえ ----------------
test('みずかえ：水の ふかさを 3分の2 まで さげて もどす（約3びょう）・とちゅうで おわらせても 水位は もどる', async () => {
  // 線の 絵（canvas）だけ ある ふりを する
  const g = { fillRect() {}, set fillStyle(v) {} };
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => g }) };
  const { WaterChanger, WATER_CHANGE_DUR, DRAIN_TO, WC } = await import('../js/aquarium/waterchange.js');
  assert.ok(WATER_CHANGE_DUR >= 2.5 && WATER_CHANGE_DUR <= 3.5, `ながさ ${WATER_CHANGE_DUR}`);
  assert.ok(Math.abs(DRAIN_TO - 2 / 3) < 0.05);
  const levels = [];
  const tank = {
    W: 16, waterTop: 8.4, land: null, water: { dirt: 0.7 }, bounds: { minX: -7.6, maxX: 7.6, minZ: -2.6, maxZ: 2.7 },
    sandHeight: () => 1.0, setLevel(y) { this.level = y; levels.push(y); }, addRipple() {}, spawnBubble() {}, applyWater() {},
  };
  const fx = { add() {} };
  const w = new WaterChanger(new THREE.Scene(), tank, fx);
  const ctx = {};
  const p = w.play({ dirtTo: 0.1 });
  assert.equal(w.busy, true);
  for (let t = 0; t < WATER_CHANGE_DUR + 0.1; t += 1 / 60) w.update(1 / 60, ctx);
  await p;
  const low = Math.min(...levels);
  const want = 1.0 + (8.4 - 1.0) * DRAIN_TO;
  assert.ok(Math.abs(low - want) < 0.05, `いちばん ひくい 水位 ${low.toFixed(2)}（${want.toFixed(2)} の はず）`);
  assert.equal(tank.level, 8.4, 'おわったら もとの 高さ');
  assert.ok(Math.abs(tank.dirtShown - 0.1) < 1e-6, 'そそいだ あとは あたらしい 水の にごり');
  assert.equal(w.busy, false);
  // さがる → そそぐ の じゅん（さいごの 水位が いちばん 高い）
  const iLow = levels.indexOf(low);
  assert.ok(iLow > 0 && iLow < levels.length - 1);
  assert.ok(WC.drain < WC.pour + 0.2, 'さがる ほうが みじかめ');
  // とちゅうで おわらせる
  const p2 = w.play();
  for (let t = 0; t < 0.8; t += 1 / 60) w.update(1 / 60, ctx);
  assert.ok(tank.level < 8.3, 'とちゅうでは さがっている');
  w.finish();
  await p2;
  assert.equal(tank.level, 8.4);
  assert.equal(ctx.avoid, null, 'よけ の めあては のこらない');
  w.dispose();
});

test('水槽：setLevel は 水面・およげる 高さ・いけの 水ぎわ を いっしょに うごかす（コードの つながり）', () => {
  const src = read('js/aquarium/tank.js');
  const body = src.slice(src.indexOf('  setLevel(y) {'), src.indexOf('get levelNow()'));
  for (const k of ['this.surf', 'this.bounds.top = y', 'this.bounds.land.waterTop', 'this.murk', 'this.rays', 'this.men']) assert.ok(body.includes(k), `setLevel に ${k} が ない`);
  assert.match(src, /bb\.y > Math\.min\(bb\.maxY, this\.levelNow/, 'あわは さがった 水面で きえる');
  assert.match(src, /f\.pos\.y > this\.levelNow - 0\.05/, 'えさは さがった 水面に うく');
  const idx = read('js/aquarium/index.js');
  assert.match(idx, /if \(!a\.held\) a\.update\(dt, ctx\)/, 'ピンセットを まつ 子は とまる');
  assert.match(idx, /finishCare\(\) \{ waterer\.finish\(\); tweezers\.finish\(\); \}/);
});

test('画面：あげかたの えらびと みずかえの アニメ（ほかの お世話は おせない・はなれたら おわる）', () => {
  const ui = read('js/ui/tank.js');
  assert.match(ui, /howBtn\('scatter', 'まく'\), howBtn\('tweezers', 'ピンセット'\)/);
  assert.match(ui, /const careLocked = \(\) => cleaning \|\| watering;/);
  assert.match(ui, /if \(careLocked\(\)\) return;/);
  assert.match(ui, /aq\.playWaterChange\(\{ dirtTo, onPour/);
  assert.match(ui, /visibilitychange[^\n]*finishCare/);
  assert.match(ui, /export function hide\(\) \{[\s\S]{0,200}finishCare/);
  assert.match(ui, /sim\.feedStart\(s, t, tw\.food, Date\.now\(\), \{ tweezers: true \}\)/);
  const sw = read('sw.js');
  for (const f of ['js/aquarium/waterchange.js', 'js/aquarium/tweezers.js']) assert.ok(sw.includes(f), `sw.js に ${f} が ない`);
});
