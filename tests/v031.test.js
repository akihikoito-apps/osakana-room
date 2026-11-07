// v0.3.1 の テスト：そこの ごみ（ふん）は「そうじ」で きえる。「みずかえ」では きえない。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, S, freshState, addFish, balance, read } from './_lib.js';

const tick = (st, min) => sim.tick(st, min, () => 0.99);

test('そこの ごみ：じかんで たまり、そうじ で 0・みずかえ では へらない', () => {
  const st = freshState();
  st.tutorial.done = true; st.inv.water_change = 1;
  for (let i = 0; i < 6; i++) addFish(st, 'medaka');
  const t = st.tanks[0];
  tick(st, 24 * 60);
  assert.ok(t.waste >= 3 && t.waste <= balance.CLEAN.wasteMax, `ごみ ${t.waste}`);
  const before = t.waste;
  sim.waterChange(st, t);
  assert.equal(t.waste, before, 'みずかえ で ごみが へった');
  t.leftover = 0;
  const r = sim.scoop(st, t);
  assert.ok(r.ok && r.had);
  assert.equal(t.waste, 0);
  assert.equal(st.stats.scoop, 1);
  assert.equal(sim.scoop(st, t).ok, false);
});

test('そこの ごみ：かい だけでは たまらない・ヒントが そうじ を すすめる', () => {
  const st = freshState();
  st.tutorial.done = true;
  addFish(st, 'ishimaki');
  tick(st, 24 * 60);
  assert.equal(st.tanks[0].waste, 0);
  const st2 = freshState();
  st2.tutorial.done = true;
  addFish(st2, 'medaka');
  st2.tanks[0].waste = 5; st2.tanks[0].clean = 100; st2.tanks[0].fish[0].onaka = 80;
  const h = sim.currentHint(st2);
  assert.equal(h?.action, 'scoop', JSON.stringify(h));
});

test('ふるい セーブ（waste なし）でも 0 で はじまる・3D に waste を わたす', () => {
  const st = freshState();
  delete st.tanks[0].waste;
  const m = S.migrate(JSON.parse(JSON.stringify(st)));
  assert.equal(m.tanks[0].waste, 0);
  assert.match(read('js/ui/tank.js'), /setWater\(\{[^}]*waste:/);
});
