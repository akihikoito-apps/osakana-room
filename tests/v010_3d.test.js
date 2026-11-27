// v0.10 3D係：(1) 正面から 見た 「まんなかの われめ」対策（絵の にじみ出し・稜線と 頭先の UV の 寄せ・背の 法線つなぎ）
//            (2) カエル・カメの 泳ぎ（swim.limb：カエル＝けって すべる、カメ＝前あしで 漕ぐ）。DOM に よらない ところ だけ。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './_lib.js';
import { bleedPixels, ridgePull, headPull, joinSeamNormals, SEAM, LIMB_AREAS, LIMB_MOVE, limbAreaOf, makeFishMaterial } from '../js/aquarium/fishModel.js';
import { FishAgent, STROKE, frogStroke, turtleStroke } from '../js/aquarium/swim.js';
import { mergeSpec } from '../js/aquarium/speciesDefaults.js';
import { dreamSpec } from '../js/aquarium/dreamSpec.js';
import { FISH } from '../js/data/fish.js';

const specOf = (id) => mergeSpec(id, FISH.find((s) => s.id === id));
const mean = (fn, n = 2000) => { let s = 0; for (let i = 0; i < n; i++) s += fn((i + 0.5) / n); return s / n; };

// ---------------- (1) われめ ----------------
test('にじみ出し：ふちは dilate 画素だけ 不透明に ふくらみ、その外は 色だけ（alpha は 0 の まま）', () => {
  const w = 24, h = 3, src = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < 4; x++) { const i = (y * w + x) * 4; src.set([200, 50, 10, 253], i); }   // 左の 4列が 赤（alpha 253）
  const out = bleedPixels(src, w, h, 2, 12);
  const px = (x, y = 1) => Array.from(out.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
  assert.deepEqual(px(0), [200, 50, 10, 255], 'もとの 不透明は 255 に そろえる');
  assert.deepEqual(px(5), [200, 50, 10, 255], '2画素 までは 不透明に');
  assert.deepEqual(px(6), [200, 50, 10, 0], 'その外は 色だけ（黒く ならない）');
  assert.deepEqual(px(15), [200, 50, 10, 0], 'bleed の はしまで 色が とどく');
  assert.deepEqual(px(16), [0, 0, 0, 0], 'bleed より 外は そのまま');
  assert.equal(src[4 * 5 + 3], 0, 'もとの 画素は かえない');
  assert.ok(SEAM.dilate <= 3, 'ふくらましは ひかえめ（横から 見た 輪郭を かえない）');
});

test('稜線の 寄せ：ふちが すけて いたら 不透明＋inset まで 内がわへ、上限は 高さの 半分×0.24', () => {
  // 列 x=0：y 10〜59 が 不透明（上端・下端は ちょうど ふち）
  const al = (x, y) => (y >= 10 && y < 60 ? 255 : 0);
  const r = ridgePull(al, 0, 10, 60);
  assert.ok(Math.abs(r.dT - (0.5 + SEAM.inset)) < 1e-9 && Math.abs(r.dB - (0.5 + SEAM.inset)) < 1e-9, JSON.stringify(r));
  // 輪郭を ならした せいで 外がわ（6px 上）を さして いる → もっと 寄せる。ただし 上限まで
  const r2 = ridgePull(al, 0, 4, 60);
  assert.ok(Math.abs(r2.dT - (60 - 4) / 2 * 0.24) < 1e-9, '上限で とまる ' + JSON.stringify(r2));
  assert.ok(ridgePull(al, 0, 10, 30).dT <= (30 - 10) / 2 * 0.24 + 1e-9, 'ひくい 列は すこし だけ');
  // まんなかまで すけて いる 列（ひれの すきま など）は 寄せない
  assert.deepEqual(ridgePull(() => 0, 0, 0, 20), { dT: 0, dB: 0 });
  // 頭先：すけて いる 頂点は 体の がわ（−x）の 不透明へ
  const head = (x) => (x <= 100 ? 255 : 0);
  assert.equal(headPull(head, 90, 5), 90, '不透明なら そのまま');
  assert.equal(headPull(head, 110, 5), 100 - SEAM.inset);
  assert.equal(headPull(() => 0, 110, 5), 110, 'みつからなければ そのまま');
});

test('背の 稜線の 法線：j=0 と j=RING を 平均して つなぐ（左右で 明るさが 段に ならない）', () => {
  const cols = 1, ring = 4, R = ring + 1, n = new Float32Array((cols + 1) * R * 3);
  for (let i = 0; i <= cols; i++) { n.set([0, 0.6, 0.8], i * R * 3); n.set([0, 0.6, -0.8], (i * R + ring) * 3); }
  joinSeamNormals(n, cols, ring);
  for (let i = 0; i <= cols; i++) {
    assert.deepEqual(Array.from(n.slice(i * R * 3, i * R * 3 + 3)), [0, 1, 0]);
    assert.deepEqual(Array.from(n.slice((i * R + ring) * 3, (i * R + ring) * 3 + 3)), [0, 1, 0]);
  }
});

test('われめ対策の 組みこみ：テクスチャは 前処理した 画素（DataTexture）、形は かえず UV だけ 寄せる', () => {
  const src = read('js/aquarium/fishModel.js');
  assert.match(src, /new THREE\.DataTexture\(/, 'Canvas に もどすと alpha 0 の 色が きえる');
  assert.match(src, /buildGeometry\(readProfile\(img\), thick, round, art\)/, 'ふつうの しゅるい');
  assert.match(src, /buildGeometry\(readProfile\(img\)[^\n]*, front\)/, 'ゆめの ぬりえ');
  assert.match(src, /makeTexture\(prepArt\(sides\.back\)\)/, 'もじペンの 裏も にじみ出し');
  assert.doesNotMatch(src, /FrontSide/, '両面の まま（片面に すると 下半分が すける）');
});

// ---------------- (2) 泳ぎ ----------------
test('足で 泳ぐ しゅるい：カエル 2しゅ＋ゆめの カエル・ぬりえ、カメ 3しゅ＋ゆめの トカゲ・カメ', () => {
  for (const id of ['tonosamagaeru', 'amagaeru']) assert.equal(specOf(id).swim.limb, 'frog', id);
  for (const id of ['kusagame', 'ishigame', 'albino_suppon']) assert.equal(specOf(id).swim.limb, 'turtle', id);
  for (const id of ['medaka', 'goldfish', 'zarigani', 'otamajakushi']) assert.equal(specOf(id).swim.limb, undefined, id);
  assert.equal(dreamSpec({ kind: 'frog', art: 'x' }, null, 'u').swim.limb, 'frog');
  assert.equal(dreamSpec({ kind: 'reptile', art: 'x' }, null, 'u').swim.limb, 'turtle');
  assert.equal(dreamSpec({ kind: 'fish', art: 'x' }, null, 'u').swim.limb, undefined);
  const nu = dreamSpec({ base: 'kusagame', kind: 'reptile', art: 'x' }, specOf('kusagame'), 'u');
  assert.equal(nu.swim.limb, 'turtle', 'ぬりえは もとの しゅるいを うけつぐ');
  assert.deepEqual(limbAreaOf(nu.baseId, 'turtle'), LIMB_AREAS.kusagame);
  assert.deepEqual(limbAreaOf('dream~u', 'frog'), LIMB_AREAS.frog, 'しらない id は 型の 目安');
  assert.equal(new FishAgent({ uid: 'a' }, { ...specOf('medaka'), swim: { limb: 'constructor' } }, { minX: -5, maxX: 5, minZ: -2, maxZ: 2, top: 6, sandY: () => 0 }).limb, null);
});

test('足の あたり：U/V は 0〜1 の 中・下がわ（足）だけ、うごきの 大きさは ひかえめ', () => {
  for (const [k, A] of Object.entries(LIMB_AREAS)) for (const b of [A.hind, A.fore]) {
    assert.ok(b.length === 4 && b[0] < b[1] && b[2] < b[3] && b[0] >= 0 && b[1] <= 1 && b[3] <= 1, k);
    assert.ok(b[2] >= 0.5, `${k}：足は 体の 下 はんぶん`);
  }
  assert.ok(LIMB_AREAS.kusagame.hind[1] < LIMB_AREAS.kusagame.fore[0], 'カメは 後ろあしが 尾がわ・前あしが 頭がわ');
  assert.ok(LIMB_MOVE.frog.hindX <= 0.26 && LIMB_MOVE.turtle.foreX <= 0.11, '絵が のびすぎない（Codex・agy の めやすの 中）');
});

test('カエルの 1かい：けり→のびて すべる→たたむ。はやさは けりの あとに いちばん はやく、平均 1', () => {
  assert.equal(frogStroke(0).e, 0, 'はじめは たたんで いる（絵の まま）');
  assert.equal(frogStroke(0.3).e, 1, 'すべって いる あいだは のびきる');
  assert.ok(frogStroke(0.99).e < 0.01, 'さいごに たたむ');
  assert.ok(Math.abs(mean((p) => frogStroke(p).f) - 1) < 0.01, '平均の はやさは もとの まま');
  const fs = [0.02, 0.15, 0.4, 0.8].map((p) => frogStroke(p).f);
  assert.ok(fs[1] > 2 && fs[1] > fs[2] && fs[2] > fs[3] && fs[0] < 0.6, `波 ${fs.map((v) => v.toFixed(2))}`);
  assert.ok(Math.abs(frogStroke(0).f - frogStroke(0.9999).f) < 0.01, 'まわり目で つながる');
});

test('カメの 1かい：前あしを うしろへ 漕ぐ（sinθ>0）ときに すこし はやい、平均 1', () => {
  assert.ok(Math.abs(mean((p) => turtleStroke(p).f) - 1) < 0.01);
  assert.ok(turtleStroke(0.25).f > 1.15 && turtleStroke(0.75).f === 0.9);
  assert.ok(STROKE.turtle.period[0] > STROKE.frog.period[1], 'カメは カエルより ゆっくり');
});

// FishAgent を 水の 中で うごかす（v08 と おなじ かたちの bounds）
function bounds(land) {
  const b = { minX: -7, maxX: land ? -0.8 : 7, minZ: -2.6, maxZ: 2.8, top: land ? 5.0 : 8.4, glassZ: -3.38, sandY: () => 0, groundY: null, restSpots: [], coralSpots: [], clingSpots: [], rocks: [] };
  const L = land ? { x0: -0.8, x1: 2.1, shore: 1.4, xMax: 7.5, waterTop: 5.0, spots: [{ x: 4, z: 0 }] } : null;
  b.sandY = (x) => (!L ? 0.8 : x <= L.x0 ? 0.8 : x >= L.x1 ? 5.6 : 0.8 + (x - L.x0) / (L.x1 - L.x0) * 4.8);
  b.groundY = b.sandY;
  b.land = L;
  return b;
}
const ctxOf = (b) => ({ bounds: b, fishes: [], foods: [], schools: {}, time: 0, minLen: 0, onEat() {}, onPui() {} });
const info = (uid) => ({ uid, stage: 2, health: 100, happy: 80, sizeMul: 1 });
function swimRun(id, land, secs = 6) {
  const b = bounds(land);
  const a = new FishAgent(info(id), specOf(id), b);
  a.heightRatio = 0.45;
  const ctx = ctxOf(b);
  a.pos.set(-1.5, 2.6, 0); a.yaw = Math.PI;
  const log = [];
  for (let i = 0; i < secs * 60; i++) {
    a.pauseT = 0; a.food = null; a.retarget = 99; a.restAtBottom = false; a.landMode = 'water';
    if (a.pos.x < -5) a.pos.x = -1.5;
    a.target.set(a.pos.x - 6, 2.6, 0);
    ctx.time += 1 / 60; a.update(1 / 60, ctx);
    if (i > 120) log.push({ v: a.speed, A: a.limbA, B: a.limbB, amp: a.limbAmp, bob: a.sbob, pitch: a.spitch });
  }
  return { a, log };
}

test('いけの カエル：水の 中では 足が のびちぢみ し、すすむ はやさも 波うつ（りくの ぴょんは べつ）', () => {
  const { a, log } = swimRun('tonosamagaeru', true);
  const vs = log.map((l) => l.v), As = log.map((l) => l.A);
  assert.ok(Math.max(...As) > 0.9 && Math.min(...As) < 0.1, '足が のびて たたむ');
  assert.ok(Math.max(...vs) > 2.5 * Math.min(...vs), `はやさが 波うつ ${Math.min(...vs).toFixed(2)}〜${Math.max(...vs).toFixed(2)}`);
  assert.ok(a.amp < 0.02, '体は 魚のように くねらない');
  assert.equal(a.hy, 0, '水の 中では ぴょん しない');
});

test('いけの カメ・スッポン：前あしを 漕ぎ、からだが すこし 上下・かたむく', () => {
  for (const id of ['kusagame', 'albino_suppon']) {
    const { a, log } = swimRun(id, id !== 'albino_suppon');
    assert.ok(Math.max(...log.map((l) => l.A)) > 0.9 && Math.min(...log.map((l) => l.A)) < -0.9, id + '：前あしが 前後に');
    const bob = Math.max(...log.map((l) => Math.abs(l.bob))), pit = Math.max(...log.map((l) => Math.abs(l.pitch)));
    assert.ok(bob > 0.01 && bob < 0.03 * a.len, `${id}：上下 ${bob}`);
    assert.ok(pit > 0.02 && pit < 0.06, `${id}：かたむき ${pit}`);
    assert.ok(a.amp < 0.01, id + '：こうらは くねらない');
  }
});

test('りくに 上がると 足は 絵の 姿勢へ もどる（あるく・ぴょんは いままで どおり）', () => {
  const b = bounds(true);
  const a = new FishAgent(info('k'), specOf('kusagame'), b);
  a.heightRatio = 0.45;
  a.limbAmp = 1; a.limbA = 1;
  a.pos.set(4, 5.6, 0); a.target.set(6, 0, 0); a.landMode = 'land'; a.pauseT = 0; a.retarget = 99;
  const ctx = ctxOf(b);
  for (let i = 0; i < 120; i++) { ctx.time += 1 / 60; a.update(1 / 60, ctx); }
  assert.ok(a.limbAmp < 0.01 && Math.abs(a.limbA) < 0.01 && Math.abs(a.sbob) < 1e-3, 'りくでは 足を うごかさない');
});

test('マテリアル：足の ある 子だけ 足の uniform と べつの シェーダー（GPU の プログラムを わける）', () => {
  const plain = makeFishMaterial(null), frog = makeFishMaterial(null, { limb: 'frog', limbArea: LIMB_AREAS.tonosamagaeru });
  const turtleFlat = makeFishMaterial(null, { limb: 'turtle', flat: true });
  assert.equal(plain.userData.u.uLimb, undefined);
  assert.ok(frog.userData.u.uLimb && frog.userData.u.uHalf && frog.userData.u.uHind.value.x === LIMB_AREAS.tonosamagaeru.hind[0]);
  const keys = new Set([plain, frog, turtleFlat].map((m) => m.customProgramCacheKey()));
  assert.equal(keys.size, 3);
  for (const m of [plain, frog, turtleFlat]) m.dispose();
});

test('描画：泳ぎの 上下・かたむき・のびは ぴょん・リアクションと べつに たして、ロールは しない', () => {
  const src = read('js/aquarium/index.js');
  assert.match(src, /a\.pitch \+ a\.opitch \+ a\.hpitch \+ a\.spitch, -0\.75, 0\.75/);
  assert.match(src, /a\.hy \+ a\.sbob/);
  assert.ok((src.match(/setLimb\(f, a, u\)/g) || []).length >= 2, '立体と 板の どちらにも');
});
