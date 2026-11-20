// v0.8 おえかき係：ぬりえ・オリジナルの 絵の しょり（js/draw/*.js）と おえかき がめんの とりきめ
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, exists, uiStrings, KANJI, freshState, sim } from './_lib.js';
import * as R from '../js/draw/raster.js';
import * as T from '../js/draw/tools.js';

// ---------- 小さな 絵を つくる 道具 ----------
/** w×h の 絵。fn(x,y) → [r,g,b,a] */
function makeImg(w, h, fn) {
  const img = R.blank(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y);
    if (c) img.data.set(c, (y * w + x) * 4);
  }
  return img;
}
const px = (img, x, y) => [...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];
/** まんなかに だえんの いきもの（すけない）。ふちは すこし すける */
const blob = (w, h) => makeImg(w, h, (x, y) => {
  const dx = (x - w / 2) / (w * 0.4), dy = (y - h / 2) / (h * 0.35), d = dx * dx + dy * dy;
  if (d > 1.05) return null;
  return [120, 130, 140, d > 0.95 ? 120 : 255];
});

// ---------- マスク・りんかく ----------
test('マスク：すけない ところ だけ 1・そとの りんかくは マスクの ふち だけ', () => {
  const img = blob(60, 40);
  const m = R.maskFromAlpha(img);
  assert.equal(m[0], 0);
  assert.equal(m[20 * 60 + 30], 1);
  const ol = R.outlineOf(m, 60, 40, 2);
  assert.equal(ol[20 * 60 + 30], 0, 'まんなかは りんかく では ない');
  for (let i = 0; i < m.length; i++) if (ol[i]) assert.equal(m[i], 1, 'りんかくは マスクの 中');
  // よこの はしの ちかくに りんかくが ある
  const row = [...ol.slice(20 * 60, 21 * 60)];
  assert.ok(row.indexOf(1) > 0 && row.indexOf(1) < 12);
});

test('中の 線：中の くろい しまの ふちを ひろう・そとの ふちや マスクの そとは ひろわない', () => {
  const w = 120, h = 60;
  const img = makeImg(w, h, (x, y) => {
    if (x < 10 || x >= 110 || y < 10 || y >= 50) return null;
    return x >= 55 && x < 65 ? [20, 20, 20, 255] : [230, 230, 230, 255];
  });
  const m = R.maskFromAlpha(img);
  const ln = R.innerLinesOf(img, m);
  let nearStripe = 0, nearEdge = 0, outside = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = ln[y * w + x];
    if (!v) continue;
    if (!m[y * w + x]) outside++;
    else if (Math.abs(x - 55) <= 3 || Math.abs(x - 65) <= 3) nearStripe++;
    else if (x < 16 || x > 103 || y < 16 || y > 43) nearEdge++;
  }
  assert.ok(nearStripe > 20, 'しまの ふちに 線が ある ' + nearStripe);
  assert.equal(nearEdge, 0);
  assert.equal(outside, 0);
});

test('ちいさな てんは けす（dropSmall）', () => {
  const w = 20, h = 10, ln = new Uint8Array(w * h);
  ln[2 * w + 2] = 200;                                   // 1こ だけ
  for (let x = 5; x < 15; x++) ln[5 * w + x] = 200;      // 10こ つながり
  R.dropSmall(ln, w, h, 4);
  assert.equal(ln[2 * w + 2], 0);
  assert.equal(ln[5 * w + 10], 200);
});

// ---------- ぬりつぶし ----------
test('ぬりつぶし：かこんだ 中 だけ ぬれる・そとへ もれない', () => {
  const w = 30, h = 30;
  const img = makeImg(w, h, (x, y) => (x === 5 || x === 24 || y === 5 || y === 24) && x >= 5 && x <= 24 && y >= 5 && y <= 24 ? [0, 0, 255, 255] : null);
  const n = R.floodFill(img, 15, 15, [255, 0, 0, 255], { grow: 0 });
  assert.equal(n, 18 * 18);
  assert.deepEqual(px(img, 15, 15), [255, 0, 0, 255]);
  assert.deepEqual(px(img, 2, 2), [0, 0, 0, 0], 'そとは すけた まま');
  assert.deepEqual(px(img, 5, 10), [0, 0, 255, 255], 'わくは のこる');
});

test('ぬりつぶし：grow 1 で ふちの 1ピクセルも ぬる（ペンの ぼかしの すきま なし）', () => {
  const w = 30, h = 30;
  const img = makeImg(w, h, (x, y) => (x >= 5 && x <= 24 && y >= 5 && y <= 24 && (x === 5 || x === 24 || y === 5 || y === 24)) ? [0, 0, 255, 255] : null);
  R.floodFill(img, 15, 15, [255, 0, 0, 255], { grow: 1 });
  assert.deepEqual(px(img, 6, 15), [255, 0, 0, 255]);
  assert.deepEqual(px(img, 5, 15), [255, 0, 0, 255], 'わくの 内がわ 1ピクセル');
  assert.deepEqual(px(img, 4, 15), [0, 0, 0, 0], '2ピクセル さきは ぬらない');
});

test('ぬりつぶし（ぬりえ）：ref を 見て target に ぬる・マスクの そとは ぬらない', () => {
  const w = 40, h = 20;
  const ref = makeImg(w, h, (x) => (x < 30 ? [255, 255, 255, 255] : null));   // まっしろの かたち（x<30）
  const mask = R.maskFromAlpha(ref);
  const target = R.blank(w, h);
  const n = R.floodFill(target, 3, 3, [0, 200, 0, 255], { ref, mask });
  assert.equal(n, 30 * 20);
  assert.deepEqual(px(target, 29, 10), [0, 200, 0, 255]);
  assert.deepEqual(px(target, 31, 10), [0, 0, 0, 0]);
  assert.equal(R.floodFill(target, 35, 5, [0, 0, 0, 255], { ref, mask }), 0, 'マスクの そとを おしても なにも しない');
});

// ---------- 書き出し ----------
test('ぬりえの 書き出し：すけぐあいは もとの 絵と おなじ・ぬって いない ところは しろ・中の 線は うすく くらく', () => {
  const src = blob(80, 40);
  const a = R.alphaOf(src);
  const paint = R.blank(80, 40);
  paint.data.set([255, 0, 0, 255], (20 * 80 + 20) * 4);
  paint.data.set([0, 0, 255, 255], (0 * 80 + 0) * 4);              // かたちの そとに はみだした いろ
  const lines = new Uint8Array(80 * 40); lines[20 * 80 + 50] = 255;
  const out = R.composeNurie({ paint, srcAlpha: a, lines, lineAlpha: 0.35 });
  for (let i = 0; i < a.length; i++) assert.equal(out.data[i * 4 + 3], a[i]);
  assert.deepEqual(px(out, 40, 20), [255, 255, 255, 255]);
  assert.deepEqual(px(out, 20, 20), [255, 0, 0, 255]);
  assert.equal(px(out, 0, 0)[3], 0, 'はみだしは きえる');
  const l = px(out, 50, 20);
  assert.ok(l[0] < 255 && l[0] > 150, '線は うすい ' + l);
});

test('ぬりえの 書き出し：もとの 絵と おなじ わく・おなじ むき・長い辺 512 いか', () => {
  const src = blob(1000, 400);
  const out = R.fitForExport(R.composeNurie({ paint: R.blank(1000, 400), srcAlpha: R.alphaOf(src) }), 512);
  assert.equal(out.width, 512);
  assert.equal(out.height, Math.round(400 * 512 / 1000));
  // かたち（すける ところ）が もとの 絵を ちぢめた ものと おなじ
  const ref = R.fitForExport(src, 512);
  let diff = 0;
  for (let i = 3; i < out.data.length; i += 4) diff = Math.max(diff, Math.abs(out.data[i] - ref.data[i]));
  assert.ok(diff <= 1, 'すけぐあいの ずれ ' + diff);
  // ちいさい 絵は 大きく しない
  assert.deepEqual([R.fitForExport(blob(300, 200)).width, R.fitForExport(blob(300, 200)).height], [300, 200]);
});

test('オリジナルの 書き出し：よけいな すきまを けずる・長い辺 512 いか・なにも ないと null', () => {
  assert.equal(R.trimForExport(R.blank(1000, 600)), null);
  const img = makeImg(1000, 600, (x, y) => (x >= 300 && x < 700 && y >= 200 && y < 300 ? [10, 20, 30, 255] : null));
  const out = R.trimForExport(img, { max: 512, pad: 0.03 });
  const p = Math.round(400 * 0.03);
  const s = R.fitLong(400 + p * 2, 100 + p * 2, 512);
  assert.deepEqual([out.width, out.height], [s.w, s.h]);
  assert.ok(Math.max(out.width, out.height) <= 512);
  assert.equal(px(out, 0, 0)[3], 0, 'すみは すける（すこし よはく）');
  assert.deepEqual(px(out, Math.floor(out.width / 2), Math.floor(out.height / 2)), [10, 20, 30, 255]);
  // 小さい 絵は 大きく しない
  const small = R.trimForExport(makeImg(1000, 600, (x, y) => (x >= 10 && x < 60 && y >= 10 && y < 30 ? [1, 2, 3, 255] : null)));
  assert.ok(small.width <= 60 && small.height <= 30);
});

test('ちぢめる とき すける ところの 色で ふちが くろく ならない', () => {
  const img = makeImg(4, 2, (x) => (x < 2 ? [255, 255, 255, 255] : [0, 0, 0, 0]));
  const out = R.downscale(img, 1, 1);
  assert.deepEqual(px(out, 0, 0).slice(0, 3), [255, 255, 255]);
  assert.ok(Math.abs(px(out, 0, 0)[3] - 128) <= 1);
});

test('bbox・fitLong・hexToRgba', () => {
  assert.equal(R.bbox(R.blank(5, 5)), null);
  assert.deepEqual(R.bbox(makeImg(10, 10, (x, y) => (x === 3 && y === 7 ? [0, 0, 0, 255] : null))), { x: 3, y: 7, w: 1, h: 1 });
  assert.deepEqual(R.fitLong(1024, 400, 512), { w: 512, h: 200 });
  assert.deepEqual(R.hexToRgba('#ff8800'), [255, 136, 0, 255]);
});

test('もじの そう：art と overlay は おなじ 四角で けずる（おなじ 大きさ・いち）・もじが なければ null', () => {
  const art = makeImg(1000, 600, (x, y) => (x >= 300 && x < 700 && y >= 200 && y < 400 ? [0, 0, 255, 255] : null));
  const over = makeImg(1000, 600, (x, y) => (x >= 650 && x < 800 && y >= 250 && y < 300 ? [255, 0, 0, 255] : null));   // はみでた もじ
  const r = R.trimPairForExport(art, over, { max: 512, pad: 0 });
  assert.deepEqual([r.overlay.width, r.overlay.height], [r.art.width, r.art.height]);
  assert.deepEqual([r.art.width, r.art.height], [500, 200], 'もじも ふくめた 四角');
  assert.equal(px(r.art, 499, 50)[3], 0, 'art の みぎはしは すける');
  assert.deepEqual(px(r.overlay, 499, 50), [255, 0, 0, 255]);
  const r2 = R.trimPairForExport(art, R.blank(1000, 600), { pad: 0 });
  assert.equal(r2.overlay, null);
  assert.deepEqual([r2.art.width, r2.art.height], [400, 200]);
  assert.equal(R.trimPairForExport(R.blank(10, 10), over), null, 'いきもの が ないと null');
});

test('ぬりえの もじは かたちの そとを けす（maskAlpha）', () => {
  const ov = makeImg(4, 1, () => [0, 0, 0, 255]);
  R.maskAlpha(ov, Uint8Array.from([255, 128, 0, 255]));
  assert.deepEqual([0, 1, 2, 3].map((x) => px(ov, x, 0)[3]), [255, 128, 0, 255]);
});

test('目：あたまの くろくて まるい ところを みつける・ぬりえの 書き出しで 目は もとの 絵の まま', () => {
  const w = 200, h = 100;
  const src = makeImg(w, h, (x, y) => {
    const dx = (x - 100) / 90, dy = (y - 50) / 40;
    if (dx * dx + dy * dy > 1) return null;
    if (Math.hypot(x - 160, y - 45) <= 5) return [10, 10, 10, 255];          // 目
    if (x >= 60 && x < 66) return [20, 20, 20, 255];                          // くろい しま（たてながで 目では ない）
    return [200, 200, 200, 255];
  });
  const m = R.maskFromAlpha(src);
  const eye = R.eyeOf(src, m);
  assert.ok(eye, 'みつかる');
  assert.ok(Math.abs(eye.x - 160) < 1.5 && Math.abs(eye.y - 45) < 1.5);
  const out = R.composeNurie({ paint: makeImg(w, h, () => [255, 0, 0, 255]), srcAlpha: R.alphaOf(src), eye: eye.mask, src });
  assert.deepEqual(px(out, 160, 45), [10, 10, 10, 255], '目は のこる');
  assert.deepEqual(px(out, 100, 50), [255, 0, 0, 255]);
  assert.equal(R.eyeOf(makeImg(50, 20, () => [200, 200, 200, 255]), new Uint8Array(1000).fill(1)), null, 'くらい ところが なければ null');
  // あかい もようは 目に しない
  const red = makeImg(w, h, (x, y) => ((x - 100) ** 2 / 8100 + (y - 50) ** 2 / 1600 > 1 ? null : Math.hypot(x - 160, y - 45) <= 5 ? [200, 20, 20, 255] : [220, 220, 220, 255]));
  assert.equal(R.eyeOf(red, R.maskFromAlpha(red)), null);
});

test('ぬりえの 書き出しに そとの りんかくを うすく 入れられる', () => {
  const src = blob(60, 30);
  const m = R.maskFromAlpha(src);
  const ol = R.outlineOf(m, 60, 30, 1);
  const out = R.composeNurie({ paint: R.blank(60, 30), srcAlpha: R.alphaOf(src), outline: ol, lineAlpha: 0.35 });
  const i = ol.indexOf(1);
  const p = px(out, i % 60, Math.floor(i / 60));
  assert.ok(p[0] < 255 && p[0] > 150, 'うすい はいいろ ' + p);
  assert.deepEqual(px(out, 30, 15).slice(0, 3), [255, 255, 255]);
});

// ---------- どうぐ ----------
test('いろ 16しょく（しろ・くろ・はだいろ いり。かぶり なし）・ペンの ふとさ 4つ（いちばん ほそい＝字が かける）', () => {
  assert.equal(T.COLORS.length, 16);
  assert.equal(new Set(T.COLORS.map((c) => c.hex)).size, 16);
  for (const n of ['しろ', 'くろ', 'はだいろ']) assert.ok(T.COLORS.some((c) => c.name === n), n);
  for (const c of T.COLORS) assert.match(c.hex, /^#[0-9a-f]{6}$/);
  assert.equal(T.PEN_SIZES.length, 4);
  assert.equal(T.PEN_SIZES[0].name, 'いちばん ほそい');
  const w = T.PEN_SIZES.map((s) => T.penWidth(s.id, 1000));
  assert.ok(w[0] < w[1] && w[1] < w[2] && w[2] < w[3]);
  assert.ok(w[0] <= 6 && w[3] <= 100);
});

test('ペンと けしゴム：けしゴムは destination-out・1てんは まるを ぬる', () => {
  const log = [];
  const ctx = new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : (...a) => log.push([k, ...a])),
    set: (o, k, v) => { o[k] = v; log.push(['set', k, v]); return true; },
  });
  T.strokeOn(ctx, { mode: 'eraser', color: '#ff0000', width: 10 }, [{ x: 1, y: 1 }, { x: 5, y: 5 }]);
  assert.ok(log.some((l) => l[0] === 'set' && l[1] === 'globalCompositeOperation' && l[2] === 'destination-out'));
  assert.ok(log.some((l) => l[0] === 'stroke'));
  log.length = 0;
  T.strokeOn(ctx, { mode: 'pen', color: '#00ff00', width: 10 }, [{ x: 1, y: 1 }]);
  assert.ok(log.some((l) => l[0] === 'set' && l[1] === 'globalCompositeOperation' && l[2] === 'source-over'));
  assert.ok(log.some((l) => l[0] === 'arc') && log.some((l) => l[0] === 'fill'));
  assert.ok(log.some((l) => l[0] === 'restore'));
});

test('ひとつもどす：あたらしい じゅんに もどる・かずの 上限', () => {
  const h = new T.History(3);
  for (const s of [1, 2, 3, 4]) h.push(s);
  assert.equal(h.size, 3);
  assert.equal(h.undo(), 4);
  assert.equal(h.undo(), 3);
  assert.equal(h.undo(), 2);
  assert.equal(h.undo(), null);
});

test('ゆびの いち・ピンチの ズーム（1〜3ばい・はみださない）', () => {
  assert.deepEqual(T.toCanvas(150, 60, { left: 100, top: 50, width: 100, height: 40 }, 1000, 400), { x: 500, y: 100 });
  const v = T.pinchView({ scale: 1, x: 0, y: 0 }, { x: 40, y: 50 }, { x: 60, y: 50 }, { x: 30, y: 50 }, { x: 70, y: 50 });
  assert.equal(v.scale, 2);
  assert.equal(v.x, -50);                              // まんなか（50）が うごかない
  assert.equal(T.pinchView({ scale: 2.9, x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }).scale, 3);
  assert.equal(T.pinchView({ scale: 1.1, x: 0, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }).scale, 1);
  assert.deepEqual(T.clampView({ scale: 2, x: 30, y: -500 }, 100, 100), { scale: 2, x: 0, y: -100 });
});

test('なまえ：ひらがな・カタカナ だけ・8もじ まで・おまかせも かな', () => {
  assert.deepEqual(T.cleanName('ぴょんきち'), { name: 'ぴょんきち', dropped: false });
  assert.deepEqual(T.cleanName('ピョン吉'), { name: 'ピョン', dropped: true });
  assert.equal(T.cleanName('abcあいう').name, 'あいう');
  assert.equal(T.cleanName('あいうえおかきくけこ').name, 'あいうえおかきく');
  assert.equal(T.cleanName('').name, '');
  for (let i = 0; i < 30; i++) {
    const n = T.randomName(() => (i * 0.137) % 1);
    assert.equal(T.cleanName(n).name, n);
    assert.ok([...n].length <= 8);
  }
});

test('できあがりの きろくは 約束の かたち（f.dream）', () => {
  const art = 'data:image/png;base64,iVBORw0KGgo=';
  const d = T.makeDreamInfo({ art, base: 'medaka', kind: 'fish', speed: 'fast', size: 'l', name: 'メダ吉', made: 5.7 });
  assert.deepEqual(Object.keys(d).sort(), ['art', 'base', 'kind', 'made', 'name', 'size', 'speed']);
  assert.deepEqual({ ...d, art: 1 }, { art: 1, base: 'medaka', kind: 'fish', speed: 'fast', size: 'l', name: 'メダ', made: 5 });
  assert.equal('overlay' in d, false, 'もじが なければ overlay は はぶく');
  assert.equal(T.makeDreamInfo({ art, overlay: art, kind: 'fish' }).overlay, art);
  assert.equal('overlay' in T.makeDreamInfo({ art, overlay: 'data:image/jpeg;base64,x', kind: 'fish' }), false);
  const o = T.makeDreamInfo({ art, kind: 'nope', speed: 'x', size: 'xl' });
  assert.deepEqual([o.base, o.kind, o.speed, o.size, o.made], [null, 'fish', 'normal', 'm', 1]);
  assert.throws(() => T.makeDreamInfo({ art: 'data:image/jpeg;base64,xx', kind: 'fish' }));
  assert.deepEqual(T.KINDS.map((k) => k.id), ['fish', 'crab', 'frog', 'reptile']);
  assert.deepEqual(T.SPEEDS.map((k) => k.id), ['slow', 'normal', 'fast']);
  assert.deepEqual(T.SIZES.map((k) => k.id), ['s', 'm', 'l']);
});

test('ゆめ係の sim.dream.addCreature に そのまま わたせる（ある とき）', (t) => {
  const st = freshState();
  if (!sim.dream?.addCreature) { t.skip('sim.dream が まだ ない'); return; }
  const tank = sim.addTank(st, 'dream', []);
  const info = T.makeDreamInfo({ art: 'data:image/png;base64,iVBORw0KGgo=', base: null, kind: 'frog', speed: 'slow', size: 's', name: 'けろ', made: 5 });
  const f = sim.dream.addCreature(st, tank, info);
  assert.ok(f, 'いれられた');
  assert.equal(f.dream.kind, 'frog');
  assert.equal(f.dream.name, 'けろ');
  assert.equal(f.dream.art, info.art);
  assert.equal(f.speciesId, 'dream_frog');
});

// ---------- がめんの とりきめ ----------
test('おえかき がめんの とうろく・よみこみ・キャッシュ', () => {
  const ui = read('js/ui/draw.js');
  assert.match(ui, /G\.addScreen\('draw',\s*\{\s*show,\s*hide\s*\},\s*\{\s*sheet:\s*false\s*\}\)/);
  assert.match(read('js/main.js'), /'\.\/ui\/draw\.js'/);
  assert.match(read('index.html'), /<link rel="stylesheet" href="css\/draw\.css">/);
  const sw = read('sw.js');
  for (const f of ['js/ui/draw.js', 'js/draw/raster.js', 'js/draw/tools.js', 'css/draw.css']) {
    assert.ok(exists(f), f);
    assert.ok(sw.includes(`'${f}'`), 'sw.js に ' + f);
  }
  // ぜんぶけす の かくにん・もどる の かくにん
  assert.ok(ui.includes('ほんとうに ぜんぶ けして いい？'));
  assert.ok(ui.includes('かいた えが きえちゃうよ'));
  assert.match(ui, /sim\?\.dream/);
  assert.ok(ui.includes('addCreature') && ui.includes('baseChoices') && ui.includes('kindOf') && ui.includes('canAdd'));
  assert.ok(ui.includes('saveNow'));
  // もじペン（本人の ようぼう）：べつの そう・overlay で わたす・せつめい
  assert.ok(ui.includes(`toolBtn('moji'`));
  assert.match(ui, /overCtx/);
  assert.ok(ui.includes('overlay: P.overlay'));
  assert.ok(ui.includes('なまえや もじは この ペンで かいてね'));
});

test('js/draw は DOM に よらない（document・window を つかわない）', () => {
  for (const f of ['js/draw/raster.js', 'js/draw/tools.js']) {
    const src = read(f).replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(src, /\bdocument\b|\bwindow\b|\bnavigator\b/, f);
  }
});

test('おえかきの 画面の 文字は ひらがな・カタカナ だけ（漢字 なし）', () => {
  const bad = [];
  for (const f of ['js/ui/draw.js', 'js/draw/raster.js', 'js/draw/tools.js']) {
    for (const s of uiStrings(read(f))) if (KANJI.test(s.text)) bad.push(`${f}:${s.line} ${s.text}`);
  }
  assert.deepEqual(bad, []);
});

test('ゆび・ペンの しくみ：pointer events・2ほんゆびで かきかけを とりけす・スクロール しない', () => {
  const ui = read('js/ui/draw.js');
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) assert.ok(ui.includes(`'${ev}'`), ev);
  assert.match(ui, /setPointerCapture/);
  assert.match(ui, /P\.pointers\.size === 2/);
  const css = read('css/draw.css');
  assert.match(css, /\.dr-stage[^{]*\{[^}]*touch-action:\s*none/);
});
