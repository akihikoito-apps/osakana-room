// v0.4 の テスト（まとめ役）：なでて コイン・ありがとう 15%・ごみ ゆっくり・ビタミンセット・うみの さかなは おおきめ
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sim, freshState, addFish, ITEMS, balance, read } from './_lib.js';
import { fishLength } from '../js/aquarium/swim.js';

const itemById = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

test('なでて ハートが 出たとき ときどき コイン（1日 上限あり・れんだ では ふえない）', () => {
  const st = freshState();
  st.tutorial.done = true;
  const f = addFish(st, 'medaka');
  f.health = 90;
  const c0 = st.coins;
  let now = 1e12, got = 0;
  // ハートは ゲーム1時間に 1こ なので、時計を すすめながら なでる。rnd は いつも あたり
  for (let i = 0; i < 30; i++) { st.clock.min += 61; const r = sim.pet(st, f.uid, (now += 60000), st.tanks[0], () => 0); if (r.coin) got++; }
  assert.equal(got, balance.COIN.pet.perDay);
  assert.equal(st.coins - c0, balance.COIN.pet.perDay * balance.COIN.pet.coin);
  // ハートが 出ない れんだ では コインも 出ない
  const st2 = freshState(); st2.tutorial.done = true;
  const g = addFish(st2, 'medaka'); g.health = 90;
  let n2 = 0;
  for (let i = 0; i < 50; i++) if (sim.pet(st2, g.uid, (now += 5000), st2.tanks[0], () => 0).coin) n2++;
  assert.equal(n2, 1);
});

test('ありがとう の かくりつは 15%・ごみは 0.025', () => {
  assert.equal(balance.COIN.thanks.chancePerHour, 0.15);
  assert.equal(balance.CLEAN.wastePerSpacePerHour, 0.025);
});

test('ビタミンセット：500で 30かいぶん・おとく・ふつうの ビタミンに たまる', () => {
  const it = itemById.food_vitamin_set;
  assert.equal(it.price, 500); assert.equal(it.uses, 30); assert.equal(it.deal, 'おとく');
  assert.ok(it.price < itemById.food_vitamin.price * 6);
  const st = freshState(); st.coins = 1000;
  const r = sim.buyItem(st, 'food_vitamin_set');
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(st.inv.food_vitamin, 30); assert.ok(st.owned.food_vitamin);
  assert.equal(st.coins, 500);
  assert.equal(sim.canBuyItem(st, 'food_vitamin').reason, 'vitaminFull');
  assert.equal(sim.canBuyItem(st, 'food_vitamin_set').reason, 'vitaminFull');
  assert.match(read('js/ui/shop.js'), /deal-badge/);
});

test('うみの さかなは かわの さかなより すこし おおきい（エビ・かいは そのまま）', () => {
  const fresh = fishLength({ kind: 'fish', water: 'fresh', sizeCm: [2, 4, 6] }, 2);
  const salt = fishLength({ kind: 'fish', water: 'salt', sizeCm: [2, 4, 6] }, 2);
  assert.ok(Math.abs(salt / fresh - 1.2) < 0.01, `${salt} / ${fresh}`);
  const shrimp = fishLength({ kind: 'shrimp', water: 'salt', sizeCm: [2, 4, 6] }, 2);
  assert.equal(shrimp, fresh);
});
