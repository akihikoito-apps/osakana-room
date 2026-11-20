// v0.8 3D係：ゆめの いきもの（f.dream）の うごき・大きさ と ゆめのすいそうの かたち。
// きまり：
// - はやさ slow ×0.6・normal ×1・fast ×1.6（さいごの はやさは 0.35〜1.8。貝は のぞく）。
// - おおきさ s 3cm・m 6cm・l 10cm（ゆめ係の sizeOf と おなじ）→ 3D の 全長 1.15・1.75・2.55。そだたない・うみの ×1.2 も かさねない。
// - ぬりえ（base あり）は もとの しゅるいの swim・look を そのまま（むれ には しない）。オリジナルは ひらたい いた（flat）。
// - kind：fish＝およぐ、crab＝底を あるく（エビの しくみ）、frog＝りくで ぴょん・みずで およぐ、reptile＝りくを あるく・みずでは ゆっくり。
// - りくの ない ゆめのすいそう では frog・reptile は およぐ（onFloor に しない）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { read, exists, balance as B } from './_lib.js';
import { dreamSpec, dreamKey, dreamSpeedMul, dreamSizeCm, dreamLookMul, DREAM_SPEED, DREAM_SIZE_CM, DREAM_KIND_SPEC, DREAM_SPEED_RANGE, DREAM_LOOK_MUL } from '../js/aquarium/dreamSpec.js';
import { FishAgent, fishLength, HOP } from '../js/aquarium/swim.js';
import { mergeSpec } from '../js/aquarium/speciesDefaults.js';
import { FISH } from '../js/data/fish.js';
import { Tank } from '../js/aquarium/tank.js';
import { alphaBox } from '../js/aquarium/fishModel.js';

const specOf = (id) => mergeSpec(id, FISH.find((s) => s.id === id));
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('はやさと おおきさの 倍率', () => {
  assert.deepEqual(DREAM_SPEED, { slow: 0.6, normal: 1, fast: 1.6 });
  assert.deepEqual(DREAM_SIZE_CM, { s: 3, m: 6, l: 10 });
  assert.equal(dreamSpeedMul('zzz'), 1, 'しらない はやさは ふつう');
  assert.equal(dreamSizeCm(undefined), 6, 'しらない おおきさは ふつう');
  const lens = ['s', 'm', 'l'].map((size) => fishLength(dreamSpec({ kind: 'fish', size, speed: 'normal' }, null, 'u'), 2));
  assert.ok(close(lens[0], 1.15) && close(lens[1], 1.75) && close(lens[2], 2.55), `全長 ${lens}`);
  // そだたない：stage が ちがっても おなじ
  const sp = dreamSpec({ kind: 'fish', size: 'm' }, null, 'u');
  assert.equal(fishLength(sp, 0), fishLength(sp, 2));
  // うみの さかなを もとに しても ×1.2 しない
  const salt = dreamSpec({ base: 'clownfish', kind: 'fish', size: 'm', art: 'x' }, specOf('clownfish'), 'u');
  assert.ok(close(fishLength(salt, 2), 1.75), 'うみの ×1.2 を かさねない');
});

test('見た目の そろえ：ぬりえの 立体は すこし 大きく、ひらたい いたは すこし 小さく（s<m<l は かわらない）', () => {
  assert.equal(dreamLookMul({ base: 'medaka' }), DREAM_LOOK_MUL.model);
  assert.equal(dreamLookMul({ base: null }), DREAM_LOOK_MUL.flat);
  const r = DREAM_LOOK_MUL.model / DREAM_LOOK_MUL.flat;
  assert.ok(r > 1.25 && r < 1.6, `差 ${r}`);
  for (const m of [DREAM_LOOK_MUL.model, DREAM_LOOK_MUL.flat]) assert.ok(m >= 0.6 && m <= 1.4, 'swim.js の sizeMul の はば（0.6〜1.4）の 中');
  const L = (size, mul) => fishLength(dreamSpec({ kind: 'fish', size }, null, 'u'), 2) * mul;
  assert.ok(L('s', DREAM_LOOK_MUL.model) < L('m', DREAM_LOOK_MUL.flat) && L('m', DREAM_LOOK_MUL.model) < L('l', DREAM_LOOK_MUL.flat), 'ちがう おおきさは いた・立体を まぜても じゅんばん どおり');
});

test('ゆめ係の sizeOf と おなじ cm（balance に あれば くらべる）', () => {
  const d = B.DREAM || {};
  const cm = d.sizeCm || d.SIZE_CM || d.sizes;
  if (!cm || typeof cm !== 'object') return;   // まだ ない ときは とばす
  for (const k of ['s', 'm', 'l']) if (cm[k] !== undefined) assert.equal(+(cm[k].cm ?? cm[k]), DREAM_SIZE_CM[k], `size ${k}`);
});

test('オリジナル：kind → うごき（flat・habit・すむ ところ）', () => {
  const mk = (kind, speed = 'normal') => dreamSpec({ kind, speed, size: 'm', art: 'x' }, null, 'u1');
  for (const k of ['fish', 'crab', 'frog', 'reptile']) assert.equal(mk(k).dream.flat, true, k + ' は ひらたい いた');
  assert.equal(mk('fish').kind, 'fish'); assert.equal(mk('fish').swim.habit, undefined);
  assert.equal(mk('crab').kind, 'shrimp', 'カニは 底を あるく（エビの しくみ）');
  assert.equal(mk('frog').swim.habit, 'land'); assert.equal(mk('frog').swim.hop, true);
  assert.equal(mk('reptile').swim.habit, 'land'); assert.ok(!mk('reptile').swim.hop);
  assert.ok(mk('reptile').swim.speed < mk('fish').swim.speed, 'カメ・トカゲは さかなより ゆっくり');
  assert.equal(mk('zzz').dream.kind, 'fish', 'しらない kind は さかな');
  // はやさ
  assert.ok(close(mk('fish', 'fast').swim.speed, DREAM_KIND_SPEC.fish.swim.speed * 1.6));
  assert.ok(close(mk('fish', 'slow').swim.speed, DREAM_KIND_SPEC.fish.swim.speed * 0.6));
  for (const k of ['fish', 'crab', 'frog', 'reptile']) for (const s of ['slow', 'fast']) {
    const v = mk(k, s).swim.speed;
    assert.ok(v >= DREAM_SPEED_RANGE[0] - 1e-9 && v <= DREAM_SPEED_RANGE[1] + 1e-9, `${k}/${s} ${v}`);
  }
  // 1ぴきごとに べつの id（むれ・見た目の キャッシュが まざらない）
  assert.notEqual(dreamSpec({ kind: 'fish' }, null, 'a').id, dreamSpec({ kind: 'fish' }, null, 'b').id);
});

test('ぬりえ：もとの しゅるいの うごきと 形を そのまま つかう', () => {
  const med = specOf('medaka');
  const sp = dreamSpec({ base: 'medaka', kind: 'fish', speed: 'fast', size: 's', art: 'x' }, med, 'u2');
  assert.equal(sp.dream.flat, false);
  assert.equal(sp.baseId, 'medaka');
  assert.equal(sp.swim.layer, med.swim.layer);
  assert.equal(sp.look.thickness, med.look.thickness);
  assert.equal(sp.school, undefined); assert.equal(sp.swim.school, false, 'ひとりで およぐ');
  assert.ok(close(sp.swim.speed, Math.min(1.8, med.swim.speed * 1.6)));
  assert.equal(sp.texture, null, '絵は f.dream.art（ファイルを よまない）');
  const zari = dreamSpec({ base: 'zarigani', kind: 'crab', art: 'x' }, specOf('zarigani'), 'u3');
  assert.equal(zari.kind, 'shrimp'); assert.equal(zari.swim.habit, 'land');
  const frog = dreamSpec({ base: 'tonosamagaeru', kind: 'frog', art: 'x' }, specOf('tonosamagaeru'), 'u4');
  assert.equal(frog.swim.habit, 'land'); assert.equal(frog.swim.hop, true, 'カエルの ぬりえも りくでは ぴょん');
  const snail = dreamSpec({ base: 'ishimaki', kind: 'crab', speed: 'slow', art: 'x' }, specOf('ishimaki'), 'u5');
  assert.ok(snail.swim.speed < 0.2, '貝は ゆっくりの まま（下限を かけない）');
});

test('dreamKey：絵・おおきさ・はやさ が かわると ちがう かぎ', () => {
  const d = { base: null, kind: 'fish', speed: 'normal', size: 'm', art: 'data:image/png;base64,AAAA' };
  const k = dreamKey(d);
  assert.equal(k, dreamKey({ ...d }));
  assert.notEqual(k, dreamKey({ ...d, size: 'l' }));
  assert.notEqual(k, dreamKey({ ...d, speed: 'fast' }));
  assert.notEqual(k, dreamKey({ ...d, art: d.art + 'B' }));
  assert.equal(dreamKey(null), '');
  // もじペンの 層（overlay）が ついた・かわった ときも つくりなおす
  assert.notEqual(k, dreamKey({ ...d, overlay: 'data:image/png;base64,CCCC' }));
  assert.notEqual(dreamKey({ ...d, overlay: 'data:image/png;base64,CCCC' }), dreamKey({ ...d, overlay: 'data:image/png;base64,CCCD' }));
});

test('もじペン：字の 外接四角（裏は この 中だけ 左右もどす）', () => {
  const w = 8, h = 4, data = new Uint8ClampedArray(w * h * 4);
  assert.equal(alphaBox(data, w, h), null, '字が なければ null');
  for (const [x, y] of [[2, 1], [5, 2]]) data[(y * w + x) * 4 + 3] = 255;
  data[(3 * w + 7) * 4 + 3] = 5;   // うすすぎる 点は 字に しない
  assert.deepEqual(alphaBox(data, w, h), { x0: 2, y0: 1, x1: 5, y1: 2 });
});

// ---------------- うごき（FishAgent） ----------------
function bounds(land) {
  const b = { minX: -7, maxX: land ? -0.8 : 7, minZ: -2.6, maxZ: 2.8, top: land ? 5.0 : 8.4, glassZ: -3.38, sandY: () => (0), groundY: null, restSpots: [], coralSpots: [], clingSpots: [], rocks: [] };
  const L = land ? { x0: -0.8, x1: 2.1, shore: 1.4, xMax: 7.5, waterTop: 5.0, spots: [{ x: 4, z: 0 }] } : null;
  b.sandY = (x) => (!L ? 0.8 : x <= L.x0 ? 0.8 : x >= L.x1 ? 5.6 : 0.8 + (x - L.x0) / (L.x1 - L.x0) * 4.8);
  b.groundY = b.sandY;
  b.land = L;
  return b;
}
const ctxOf = (b) => ({ bounds: b, fishes: [], foods: [], schools: {}, time: 0, minLen: 0, onEat() {}, onPui() {} });
const info = (uid) => ({ uid, stage: 2, health: 100, happy: 80, sizeMul: 1 });

test('カエル（オリジナル）：りくでは ぴょんと はねて すすみ、着地すると とまる', () => {
  const b = bounds(true);
  const a = new FishAgent(info('fr'), dreamSpec({ kind: 'frog', speed: 'normal', size: 'm', art: 'x' }, null, 'fr'), b);
  a.heightRatio = 0.7;
  assert.equal(a.onFloor, true);
  assert.equal(a.flat, true);
  a.pos.set(3, 5.6, 0); a.target.set(6.5, 0, 0); a.landMode = 'land'; a.pauseT = 0; a.retarget = 99;
  const ctx = ctxOf(b);
  let maxHy = 0, x0 = a.pos.x, still = 0, airMoves = 0;
  for (let i = 0; i < 240; i++) {
    const px = a.pos.x;
    ctx.time += 1 / 60; a.update(1 / 60, ctx);
    maxHy = Math.max(maxHy, a.hy);
    if (a.hy > 0.01 && a.pos.x > px) airMoves++;
    if (a.hy === 0 && Math.abs(a.pos.x - px) < 1e-9) still++;
  }
  assert.ok(maxHy > 0.3 && maxHy <= HOP.hMax + 1e-9, `はねる 高さ ${maxHy}`);
  assert.ok(a.pos.x > x0 + 1, `すすむ ${x0} → ${a.pos.x}`);
  assert.ok(airMoves > 10 && still > 10, '空中で すすみ、地面では とまる');
  assert.ok(a.pos.y >= 5.6, 'りくに めりこまない（板の 下の はしが 地面）');
});

test('りくの ない ゆめのすいそう：カエル・カメは およいで 水の 中に いる', () => {
  const b = bounds(false);
  for (const kind of ['frog', 'reptile']) {
    const a = new FishAgent(info(kind), dreamSpec({ kind, speed: 'fast', size: 'l', art: 'x' }, null, kind), b);
    a.heightRatio = 0.6;
    assert.equal(a.onFloor, false, kind + ' は 底に はりつかない');
    const ctx = ctxOf(b);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 1800; i++) { ctx.time += 1 / 30; a.update(1 / 30, ctx); lo = Math.min(lo, a.pos.y); hi = Math.max(hi, a.pos.y); }
    assert.ok(lo > 0.8 && hi < b.top, `${kind}: ${lo.toFixed(2)}〜${hi.toFixed(2)}`);
    assert.equal(a.hy, 0, 'みずの 中では ぴょん しない');
  }
});

test('かたちを かえる：setHasLand で りくの ある なし に あわせる', () => {
  const a = new FishAgent(info('rp'), dreamSpec({ kind: 'reptile', art: 'x' }, null, 'rp'), bounds(false));
  assert.equal(a.onFloor, false);
  const bl = bounds(true);
  a.setHasLand(bl);
  assert.equal(a.onFloor, true);
  assert.ok(a.target.x !== undefined);
  a.setHasLand(bounds(false));
  assert.equal(a.onFloor, false);
  // カニ（エビの しくみ）は いつも 底
  const c = new FishAgent(info('cr'), dreamSpec({ kind: 'crab', art: 'x' }, null, 'cr'), bounds(false));
  assert.equal(c.onFloor, true);
  assert.ok(c.footLift > 0 || c.heightRatio === 0.3, 'ひらたい いたは 底で もちあげる');
});

test('ゆめのすいそうの りく：layout が land の ときだけ（いけ は いつも）', () => {
  const hasLand = Object.getOwnPropertyDescriptor(Tank.prototype, 'hasLand').get;
  assert.equal(hasLand.call({ waterType: 'dream', layout: 'land' }), true);
  assert.equal(hasLand.call({ waterType: 'dream', layout: 'water' }), false);
  assert.equal(hasLand.call({ waterType: 'pond', layout: 'water' }), true);
  assert.equal(hasLand.call({ waterType: 'fresh', layout: 'land' }), false, 'ふつうの すいそうは layout を 見ない');
});

test('3D の あたらしい ファイルは sw.js の キャッシュに ある', () => {
  assert.ok(exists('js/aquarium/dreamSpec.js'));
  assert.ok(read('sw.js').includes('js/aquarium/dreamSpec.js'), 'sw.js に dreamSpec.js を たす');
  void THREE;
});
