// v0.6 おそうじロボ（インテリア係）：そこの ごみ（t.waste）を じどうで へらす 器具。
// きまり：effect.wastePerHour だけ へらす。1こ より 下には しない（さいごは あみの「そうじ」）。どの 水でも つかえる（water 'both'）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, freshState, addFish, ITEMS, read, exists } from './_lib.js';

const robot = ITEMS.find((i) => i.id === 'clean_robot');
const HOUR = 60;

/** ごみが たまりやすい 川の すいそう（メダカ など 6ぴき） */
function tankWithFish(withRobot) {
  const st = freshState();
  st.unlocks.tank6 = 1;
  const t = st.tanks[0];
  for (const id of ['medaka', 'medaka', 'guppy', 'guppy', 'neon_tetra', 'neon_tetra']) addFish(st, id, t);
  if (!t.decor.includes('heater')) t.decor.push('heater');
  if (withRobot) t.decor.push('clean_robot');
  t.waste = 0;
  return { st, t };
}

test('おそうじロボ：データ（both・器具・効果は wastePerHour・アイコンが ある・ひらがな カタカナ）', () => {
  assert.ok(robot, 'clean_robot が items.js に ない');
  assert.equal(robot.water, 'both');
  assert.equal(robot.inTank, true);
  assert.equal(robot.max, 1);
  assert.ok(robot.price > 0);
  assert.ok(robot.effect.wastePerHour > 0);
  assert.ok(exists(robot.icon), robot.icon);
  assert.match(robot.name + robot.desc, /^[぀-ゟ゠-ヿ　\s、。！？ー0-9]+$/);
  assert.ok(read('sw.js').includes(robot.icon), 'sw.js の キャッシュ一覧に アイコンが ない');
});

test('おそうじロボ：ありの ほうが ごみが すくない（ないときより へる）', () => {
  const a = tankWithFish(false), b = tankWithFish(true);
  for (let i = 0; i < 24; i++) { sim.tick(a.st, HOUR, () => 0.5); sim.tick(b.st, HOUR, () => 0.5); }
  assert.ok(a.t.waste > 1.5, `なし：ごみが たまって いない ${a.t.waste}`);
  assert.ok(b.t.waste < a.t.waste, `あり ${b.t.waste} ＜ なし ${a.t.waste} に ならない`);
});

test('おそうじロボ：たまった ごみが へっていく（魚が いなくても）', () => {
  const st = freshState();
  st.unlocks.tank6 = 1;
  const t = st.tanks[0];
  t.decor.push('clean_robot');
  t.waste = 6;
  sim.tick(st, 10 * HOUR, () => 0.5);
  assert.ok(Math.abs(t.waste - (6 - robot.effect.wastePerHour * 10)) < 0.05, `10じかんで ${robot.effect.wastePerHour * 10} へる はず：${t.waste}`);
});

test('おそうじロボ：ごみは 1こ より 下には ならない → そうじ ボタンは つかえて、ミッションにも かぞえる', () => {
  const st = freshState();
  st.unlocks.tank6 = 1;
  const t = st.tanks[0];
  t.decor.push('clean_robot');
  t.waste = 3;
  sim.tick(st, 3 * 24 * HOUR, () => 0.5);
  assert.ok(Math.abs(t.waste - 1) < 1e-9, `1 で とまる はず：${t.waste}`);
  const before = st.stats?.scoop || 0;
  const r = sim.scoop(st, t);
  assert.equal(r.ok, true);
  assert.equal(r.had, true);
  assert.equal(t.waste, 0);
  assert.equal((st.stats?.scoop || 0), before + 1);
});

test('おそうじロボ：1こ より すくない ごみは へらさない（へんに ふえたり マイナスに ならない）', () => {
  const st = freshState();
  const t = st.tanks[0];
  t.decor.push('clean_robot');
  t.waste = 0.5;
  sim.tick(st, HOUR, () => 0.5);
  assert.ok(t.waste >= 0.5 - 1e-9, `${t.waste}`);
});

test('おそうじロボ：3D に うごく ロボが ある（tank.js）', () => {
  const src = read('js/aquarium/tank.js');
  assert.match(src, /clean_robot:/);
  assert.match(src, /makeCleanRobot/);
});
