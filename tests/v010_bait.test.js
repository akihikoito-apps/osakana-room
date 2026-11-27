// v0.10 つり係：キラキラ えさ（500コイン・★3いじょう・★4〜5 が でやすい）
// ねだん・えらべる・こうきゅうの ほうが レアが でやすい（たくさん まわした 統計）・0 の ときは つかえない・まえの セーブ
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, sim, S, balance, ITEMS, FISH, seeded, read, exists, uiStrings, KANJI } from './_lib.js';
import * as A from '../js/adventure.js';

const R = balance.ADVENTURE;
const PR = R.fishing.premium;
const seaFish = () => FISH.filter((f) => f.obtain === 'fishing');
/** ぼうけんを ひらいて、つりざお・ふつうの えさ 3こ まで */
function ready(coins = 0) {
  const st = freshState({ coins });
  st.heartsTotal = R.openHearts;
  A.checkOpen(st, []);
  A.enterSea(st);
  A.claimFirstBait(st);
  return st;
}
/** n かい つる（まいかい おやすみすいそうへ。えさは へらさない よう たす） */
function fishMany(st, kind, n, rnd) {
  const cnt = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const id = A.baitRule(kind).id;
  for (let i = 0; i < n; i++) {
    st.inv[id] = 5;
    const r = A.fish(st, rnd, kind);
    assert.ok(r.ok, r.reason);
    cnt[r.rarity]++;
    st.adventure.catch = null;
  }
  return cnt;
}

test('キラキラ えさ：ねだん 500・ふつう 100 は そのまま・もてる かず・アイテムと アイコン', () => {
  assert.equal(R.fishing.baitPrice, 100);
  assert.equal(PR.price, 500);
  assert.equal(PR.bait, 'bait_gold');
  assert.deepEqual(PR.buyPacks, [1]);
  assert.equal(PR.max, 10);
  const B = A.baitRule('premium');
  assert.equal(B.price, 500);
  assert.equal(B.max, 10);
  assert.equal(A.baitRule('normal').price, 100);
  assert.equal(A.baitRule('normal').max, R.fishing.baitMax);
  const it = ITEMS.find((i) => i.id === 'bait_gold');
  assert.ok(it);
  assert.equal(it.price, null, 'おみせ（すいそう）には ならばない');
  assert.equal(it.type, 'adventure');
  assert.equal(it.max, PR.max);
  assert.ok(!KANJI.test(it.name + it.desc));
  assert.ok(exists(it.icon), it.icon);
  assert.match(read('sw.js'), /assets\/items\/bait_gold\.png/);
  // おもみ：★1・★2 は でない。★4・★5 は ふつうより おおい。タコ（★5）は ★4 より すくない
  const W = PR.weights;
  assert.equal(W[1], 0); assert.equal(W[2], 0);
  assert.equal([1, 2, 3, 4, 5].reduce((a, r) => a + W[r], 0), 100);
  assert.ok(W[4] > R.fishing.weights[4] * 3 && W[5] > R.fishing.weights[5] * 3);
  assert.ok(W[5] < W[4] && W[5] <= 15, 'タコは レアの まま');
});

test('キラキラ えさ：かう（500・おためし 1こ・もちきれない・コイン たりない・まとめ買いの かず）', () => {
  const st = ready(1200);
  assert.equal(A.bait(st, 'premium'), 0);
  // ふつうの えさの プレゼント まえは かえない
  const st0 = freshState({ coins: 9999 });
  st0.heartsTotal = R.openHearts; A.checkOpen(st0, []); A.enterSea(st0);
  assert.equal(A.canBuyBait(st0, 1, 'premium').reason, 'gift');
  assert.equal(A.canClaimPremiumGift(st0), false);
  // おためし 1こ（いちど だけ）
  assert.equal(A.canClaimPremiumGift(st), true);
  assert.equal(A.claimPremiumGift(st).n, 1);
  assert.equal(A.bait(st, 'premium'), 1);
  assert.equal(A.claimPremiumGift(st).ok, false);
  // 500 で 1こ
  const r = A.buyBait(st, 1, 'premium');
  assert.ok(r.ok);
  assert.equal(r.price, 500);
  assert.equal(st.coins, 700);
  assert.equal(A.bait(st, 'premium'), 2);
  assert.equal(A.bait(st, 'normal'), 3, 'ふつうの えさは そのまま');
  assert.equal(st.stats.buyBaitPremium, 1);
  assert.equal(A.chosenBait(st), 'premium', 'かったら キラキラを えらぶ');
  // ふつうは 100 の まま
  assert.equal(A.buyBait(st, 1, 'normal').price, 100);
  assert.equal(st.coins, 600);
  // たりない
  st.coins = 499;
  const c = A.canBuyBait(st, 1, 'premium');
  assert.equal(c.reason, 'coins'); assert.equal(c.need, 1);
  assert.equal(A.buyBait(st, 1, 'premium').ok, false);
  assert.equal(st.coins, 499, 'かえない ときは へらない');
  // もちきれない（10こ）
  st.coins = 99999;
  st.inv.bait_gold = PR.max;
  assert.equal(A.canBuyBait(st, 1, 'premium').reason, 'max');
  // ふつうの 上限は べつ
  st.inv.bait = R.fishing.baitMax - 1;
  assert.equal(A.canBuyBait(st, 1, 'normal').ok, true);
});

test('キラキラ えさ：つる ときに えらべる・0 の ときは つかえない（ふつうに もどる）', () => {
  const st = ready();
  assert.equal(A.chosenBait(st), 'normal');
  // もっていない キラキラは えらべない
  assert.equal(A.setBait(st, 'premium').ok, false);
  assert.equal(A.chosenBait(st), 'normal');
  assert.equal(A.canFish(st, 'premium').reason, 'noBait');
  assert.equal(A.fish(st, seeded(1), 'premium').ok, false);
  assert.equal(A.bait(st, 'normal'), 3, 'つかえない ときは ふつうも へらない');
  // 2こ もつ → えらぶ → キラキラが へる・ふつうは へらない
  st.inv.bait_gold = 2;
  assert.equal(A.setBait(st, 'premium').ok, true);
  assert.equal(A.chosenBait(st), 'premium');
  let r = A.fish(st, seeded(2));
  assert.ok(r.ok);
  assert.equal(r.bait, 'premium');
  assert.equal(st.adventure.catch.bait, 'premium');
  assert.ok(r.rarity >= 3, 'キラキラは ★3いじょう');
  assert.equal(A.bait(st, 'premium'), 1);
  assert.equal(A.bait(st, 'normal'), 3);
  assert.equal(st.stats.fishing, 1);
  assert.equal(st.stats.fishingPremium, 1);
  assert.equal(r.backToNormal, false);
  A.placeCatch(st, 'box');
  // さいごの 1こ → つかいきったら ふつうに もどる
  r = A.fish(st, seeded(3));
  assert.equal(r.bait, 'premium');
  assert.equal(r.backToNormal, true);
  assert.equal(A.bait(st, 'premium'), 0);
  assert.equal(A.chosenBait(st), 'normal');
  A.placeCatch(st, 'box');
  // useBait が premium の まま 0こ でも ふつうを つかう
  st.adventure.useBait = 'premium';
  assert.equal(A.chosenBait(st), 'normal');
  r = A.fish(st, seeded(4));
  assert.ok(r.ok);
  assert.equal(r.bait, null);
  assert.equal(A.bait(st, 'normal'), 2);
  A.placeCatch(st, 'box');
  // ふつうに もどす
  st.inv.bait_gold = 1;
  A.setBait(st, 'premium');
  A.setBait(st, 'normal');
  assert.equal(A.chosenBait(st), 'normal');
  // ふつうが 0 で キラキラが ある：ふつうを えらんで いたら つれない（かってに 500 の えさを つかわない）
  st.inv.bait = 0;
  assert.equal(A.canFish(st).reason, 'noBait');
  assert.equal(A.canFish(st, 'premium').ok, true);
  // まつ 子が いる ときは どちらも つれない
  A.fish(st, seeded(5), 'premium');
  st.inv.bait_gold = 3;
  assert.equal(A.canFish(st, 'premium').reason, 'pending');
});

test('キラキラ えさ：たくさん つると ふつうより ★4・★5 が でやすい（6000かい）・★1・★2 は でない', () => {
  const N = 6000;
  const st = ready();
  const nor = fishMany(st, 'normal', N, seeded(71));
  const st2 = ready();
  const pre = fishMany(st2, 'premium', N, seeded(72));
  const p = (c, r) => c[r] / N;
  assert.equal(pre[1] + pre[2], 0, 'キラキラで ★1・★2 は でない');
  // てんじょう こみの ふつう：★4 約 10.7%・★5 約 4.6%
  assert.ok(Math.abs(p(nor, 4) - 0.107) < 0.015, `ふつう ★4 ${p(nor, 4)}`);
  assert.ok(Math.abs(p(nor, 5) - 0.046) < 0.012, `ふつう ★5 ${p(nor, 5)}`);
  // キラキラ：★4 約 32%・★5 約 13%（タコ）・★4いじょう 約 45%
  assert.ok(Math.abs(p(pre, 4) - 0.32) < 0.02, `キラキラ ★4 ${p(pre, 4)}`);
  assert.ok(Math.abs(p(pre, 5) - 0.13) < 0.015, `キラキラ ★5 ${p(pre, 5)}`);
  const x4 = p(pre, 4) / p(nor, 4), x5 = p(pre, 5) / p(nor, 5);
  assert.ok(x4 > 2.5 && x4 < 3.6, `★4 は 約3ばい ${x4}`);
  assert.ok(x5 > 2.2 && x5 < 3.6, `★5 は 約2.8ばい ${x5}`);
  // タコは レアの まま（8かいに 1かい くらい・15% より すくない）。イカ（★4 の 3しゅの 1つ）は タコより すくない
  const tako = seaFish().filter((f) => f.rarity === 5);
  assert.ok(tako.length >= 1);
  assert.ok(p(pre, 5) < 0.15);
  // 500コインあたり：ふつう 5かいの ★4いじょう（約 0.77ひき）の ほうが おおい（キラキラは「1かいの ドキドキ」）
  const per500Normal = (p(nor, 4) + p(nor, 5)) * 5;
  const per500Premium = p(pre, 4) + p(pre, 5);
  assert.ok(per500Normal > per500Premium, `${per500Normal} > ${per500Premium}`);
  assert.ok(per500Premium > 0.4, 'キラキラ 1かいで ★4いじょう 4わり いじょう');
});

test('キラキラ えさ：てんじょうは ふつうと おなじ カウンタ（1かい＝1・★4いじょうで 0）', () => {
  const st = ready();
  st.inv.bait_gold = 10;
  st.adventure.pity.fishing = 0;
  // ★3 が でる 乱数を さがして 1すすむ ことを みる
  let seen3 = false, seen4 = false;
  for (let i = 0; i < 60 && !(seen3 && seen4); i++) {
    const before = st.adventure.pity.fishing;
    st.inv.bait_gold = 10;
    const r = A.fish(st, seeded(300 + i), 'premium');
    if (r.rarity >= 4) { assert.equal(st.adventure.pity.fishing, 0); seen4 = true; }
    else { assert.equal(st.adventure.pity.fishing, before + PR.pityStep); seen3 = true; }
    A.placeCatch(st, 'box');
  }
  assert.ok(seen3 && seen4);
  // ふつうで 9かい ★4いじょうが なかった あと：キラキラでも ふつうでも 10かいめは ★4いじょう
  for (const kind of ['normal', 'premium']) {
    for (let i = 0; i < 30; i++) {
      st.adventure.pity.fishing = R.fishing.pity.every - 1;
      st.inv.bait = 5; st.inv.bait_gold = 5;
      assert.equal(A.pityNext(st), true);
      const r = A.fish(st, seeded(500 + i), kind);
      assert.ok(r.rarity >= 4, `${kind} ${r.rarity}`);
      assert.equal(r.pity, true);
      A.placeCatch(st, 'box');
    }
  }
  assert.equal(A.pityNext(st), false);
});

test('まえの セーブ：えさの かずは そのまま・キラキラは 0・ふつうを えらぶ・おためしは もらえる', () => {
  // v0.9 の セーブ（useBait・premiumGift・bait_gold なし）
  const st = ready();
  st.inv.bait = 17;
  st.adventure.pity.fishing = 4;
  const raw = JSON.parse(JSON.stringify(st));
  delete raw.adventure.useBait;
  delete raw.adventure.premiumGift;
  const back = S.migrate(raw, sim.initialValues());
  sim.normalize(back);
  A.norm(back);
  assert.equal(A.bait(back, 'normal'), 17, 'ふつうの えさは こわれない');
  assert.equal(A.bait(back, 'premium'), 0);
  assert.equal(back.adventure.useBait, 'normal');
  assert.equal(back.adventure.pity.fishing, 4);
  assert.equal(A.chosenBait(back), 'normal');
  assert.equal(A.canClaimPremiumGift(back), true);
  // へんな あたいは ふつうに
  back.adventure.useBait = 'LAVA';
  A.norm(back);
  assert.equal(back.adventure.useBait, 'normal');
  // キラキラを もった セーブを よみなおしても のこる
  back.inv.bait_gold = 4;
  A.setBait(back, 'premium');
  const again = S.migrate(JSON.parse(JSON.stringify(back)), sim.initialValues());
  sim.normalize(again);
  A.norm(again);
  assert.equal(A.bait(again, 'premium'), 4);
  assert.equal(A.bait(again, 'normal'), 17);
  assert.equal(A.chosenBait(again), 'premium');
});

test('キラキラ えさ：画面の 文字に かんじ なし・えらぶ ボタン・えさやさん・css', () => {
  for (const f of ['js/adventure.js', 'js/ui/adventure.js']) {
    const bad = uiStrings(read(f)).filter((s) => KANJI.test(s.text));
    assert.deepEqual(bad.map((s) => `${f}:${s.line} ${s.text}`), []);
  }
  const ui = read('js/ui/adventure.js');
  assert.match(ui, /bait-pick/);
  assert.match(ui, /confirmPremium/);
  assert.match(ui, /resetBaitChoice/);
  assert.match(read('css/adventure.css'), /\.bp-btn/);
});
