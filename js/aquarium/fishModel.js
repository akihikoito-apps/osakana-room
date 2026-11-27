// 魚の立体づくり：真横の絵（透過）から輪郭を読み取り、列ごとに断面をふくらませた「厚みのある体」を作る。
// UV は側面からの平行投影。くねりは頂点シェーダー（MeshLambertMaterial に onBeforeCompile で注入）。
import * as THREE from '../../vendor/three.module.min.js';
import { drawFallbackFish } from './fallbackArt.js';

const COLS = 44;       // 長さ方向の分割
const RING = 18;       // 断面の分割
const SAMPLE_W = 192;  // 輪郭読み取り用に縮小する幅

/**
 * v0.10 正面から 見た 「まんなかの われめ」対策（Codex・agy と 相談）。
 * われめの 正体：背・腹の 稜線と 頭先の 刃（正面から 見ると ちょうど まんなかの 縦線）の 頂点が 絵の ふち ちょうど
 * （ふちの 外は 透過＝黒 alpha 0）を さして いて、線形補間・mipmap で alpha が 0.5 を わり 捨てられる＋黒・白っぽい ふちが 出る。
 * - solid：これ いじょうの alpha を 「しっかり 不透明」と みなす（0..255）。
 * - dilate：不透明の ふちを 外へ ふくらませる 画素数（原寸。alpha も 1 に。Codex 2px）。
 * - bleed：透過画素の 色だけ ふちの 色で 外へ のばす 画素数（alpha は そのまま。黒い ふち・mipmap の 黒まじりを ふせぐ）。
 * - inset：背・腹の 稜線と 頭先の 頂点を 不透明の ふちから 内がわへ 寄せる 画素数（原寸）。
 * - ridgePow：稜線への 寄せを 断面の どこまで きかせるか（|cos|^ridgePow。側面の 絵・字は ほぼ 動かさない＝Codex）。
 * - headScan：頭先の 列で すける 頂点を 体の がわへ さがす 最大の 画素数（原寸。agy：はしの 列は 鼻先しか 不透明が ない）。
 */
export const SEAM = { solid: 128, dilate: 2, bleed: 12, inset: 2.5, ridgePow: 4, headScan: 48 };
const ART_W = 1024;    // 絵の 前処理を する 幅の 上限

/**
 * 絵の 画素（RGBA・上の 行から）に ふくらまし＋色の にじみ出しを かける（DOM に よらない）。
 * 不透明（alpha ≥ solid）を 起点に 4近傍で 外へ ひろげ、とどいた 画素の 色は いちばん 近い 不透明画素の 色。
 * dilate 画素 までは alpha も 255、その 外 bleed 画素 までは 色だけ（alpha は もとの まま）。もとの 不透明は alpha 255 に そろえる。
 */
export function bleedPixels(src, w, h, dilate = SEAM.dilate, bleed = SEAM.bleed, solid = SEAM.solid) {
  const out = new Uint8Array(src.length);
  out.set(src);
  const n = w * h, dist = new Uint8Array(n).fill(255), q = new Int32Array(n);
  let qn = 0;
  for (let p = 0; p < n; p++) if (src[p * 4 + 3] >= solid) { dist[p] = 0; out[p * 4 + 3] = 255; q[qn++] = p; }
  const lim = Math.min(254, Math.max(dilate, bleed));
  for (let head = 0; head < qn; head++) {
    const p = q[head], d = dist[p];
    if (d >= lim) continue;
    const x = p % w;
    for (let k = 0; k < 4; k++) {
      const np = k === 0 ? (x > 0 ? p - 1 : -1) : k === 1 ? (x < w - 1 ? p + 1 : -1) : k === 2 ? p - w : p + w;
      if (np < 0 || np >= n || dist[np] !== 255) continue;
      dist[np] = d + 1;
      const a = np * 4, b = p * 4;
      out[a] = out[b]; out[a + 1] = out[b + 1]; out[a + 2] = out[b + 2];
      if (d + 1 <= dilate) out[a + 3] = 255;
      q[qn++] = np;
    }
  }
  return out;
}

/** 絵（Image / Canvas）→ 前処理した 画素 { w, h, data }（幅は ART_W まで） */
function prepArt(src) {
  const w = Math.max(1, Math.min(ART_W, src.width)), h = Math.max(1, Math.round(src.height * w / src.width));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, w, h);
  return { w, h, data: bleedPixels(g.getImageData(0, 0, w, h).data, w, h) };
}

/** 絵（Image / Canvas）から列ごとの上端・下端を読み取る。 */
function readProfile(src) {
  const sw = SAMPLE_W;
  const sh = Math.max(8, Math.round(sw * (src.height / src.width)));
  const cv = document.createElement('canvas');
  cv.width = sw; cv.height = sh;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, sw, sh);
  const data = g.getImageData(0, 0, sw, sh).data;
  const TH = 90;
  let x0 = sw, x1 = -1, y0 = sh, y1 = -1;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    if (data[(y * sw + x) * 4 + 3] > TH) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) { x0 = 0; x1 = sw - 1; y0 = 0; y1 = sh - 1; }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const top = new Float32Array(COLS + 1), bot = new Float32Array(COLS + 1), has = new Uint8Array(COLS + 1);
  for (let i = 0; i <= COLS; i++) {
    const cx = x0 + (i / COLS) * (bw - 1);
    const xa = Math.max(x0, Math.floor(cx - 1)), xb = Math.min(x1, Math.ceil(cx + 1));
    let t = -1, b = -1;
    for (let y = y0; y <= y1 && t < 0; y++) for (let x = xa; x <= xb; x++) if (data[(y * sw + x) * 4 + 3] > TH) { t = y; break; }
    for (let y = y1; y >= y0 && b < 0; y--) for (let x = xa; x <= xb; x++) if (data[(y * sw + x) * 4 + 3] > TH) { b = y + 1; break; }
    if (t >= 0) { top[i] = t; bot[i] = b; has[i] = 1; }
  }
  // 空の列は隣から埋める
  const mid = (y0 + y1 + 1) / 2;
  for (let i = 0; i <= COLS; i++) if (!has[i]) { top[i] = mid; bot[i] = mid; }
  // 切れ込みで急に変わらないよう少しならす
  const sm = (a) => { const o = Float32Array.from(a); for (let i = 1; i < COLS; i++) o[i] = (a[i - 1] + 2 * a[i] + a[i + 1]) / 4; return o; };
  return { top: sm(top), bot: sm(bot), x0, y0, bw, bh, sw, sh };
}

/** 長さ方向の厚み（0..1）。尾びれ部分はうすい膜、胴は頭寄りが一番太い。 */
function widthEnvelope(heights, round = false) {
  if (round) {
    // 貝：その列の高さに合わせた丸い太さ（から が回転体に近い形になる）＋ 両はしだけ少し細く
    const e = new Float32Array(COLS + 1);
    let mh = 0; for (const h of heights) mh = Math.max(mh, h);
    for (let i = 0; i <= COLS; i++) { const u = i / COLS * 2 - 1; e[i] = Math.sqrt(heights[i] / Math.max(mh, 1e-6)) * Math.pow(Math.max(0, 1 - u * u), 0.25); }
    return e;
  }
  // 尾の付け根 = 後ろ半分で一番細い列
  let ped = Math.round(COLS * 0.2), minH = Infinity;
  for (let i = Math.round(COLS * 0.08); i <= Math.round(COLS * 0.45); i++) if (heights[i] < minH) { minH = heights[i]; ped = i; }
  const uPed = ped / COLS;
  const uPeak = uPed + (1 - uPed) * 0.55;
  const env = new Float32Array(COLS + 1);
  for (let i = 0; i <= COLS; i++) {
    const u = i / COLS;
    let w;
    if (u < uPed) w = 0.05 * (u / Math.max(uPed, 0.01));
    else if (u < uPeak) { const s = (u - uPed) / (uPeak - uPed); w = 0.2 + 0.8 * s * s * (3 - 2 * s); }
    else { const s = (u - uPeak) / (1 - uPeak); w = Math.sqrt(Math.max(0, 1 - s * s)); }
    env[i] = w;
  }
  return env;
}

/**
 * v0.10 稜線の 寄せ（DOM に よらない）：画素 x の 列で、上端 tImg・下端 bImg（原寸の 画像 y）から 内がわへ
 * 「しっかり 不透明」まで の きょり＋inset を かえす。列の まんなかまでに 不透明が なければ 0。寄せは 列の 高さの 半分×maxK まで
 * （|cos|^4 で かけるので maxK×4 < 1 なら 断面の 中で UV が いきつもどりつ しない）。
 */
export function ridgePull(alphaAt, x, tImg, bImg, o = SEAM, maxK = 0.24) {
  const mid = (tImg + bImg) / 2, lim = Math.max(0, (bImg - tImg) / 2 * maxK);
  let dT = 0, dB = 0;
  for (let y = Math.max(0, Math.floor(tImg)); y <= mid; y++) if (alphaAt(x, y) >= o.solid) { dT = Math.min(lim, Math.max(0, y + 0.5 + o.inset - tImg)); break; }
  for (let y = Math.ceil(bImg) - 1; y >= mid; y--) if (alphaAt(x, y) >= o.solid) { dB = Math.min(lim, Math.max(0, bImg - (y + 0.5 - o.inset))); break; }
  return { dT, dB };
}

/** v0.10 頭先の 頂点：(x, y) が すけて いたら 体の がわ（−x）へ headScan 画素まで さがし、不透明＋inset の x を かえす（なければ x） */
export function headPull(alphaAt, x, y, o = SEAM) {
  if (alphaAt(Math.round(x), Math.round(y)) >= o.solid) return x;
  for (let d = 1; d <= o.headScan; d++) if (alphaAt(Math.round(x - d), Math.round(y)) >= o.solid) return x - d - o.inset;
  return x;
}

/**
 * 輪郭から厚みのあるジオメトリを作る（全長 1、頭が +x、体の中心が原点）。
 * art（前処理した 原寸の 画素）が あれば、背・腹の 稜線と 頭先の UV を 不透明の 内がわへ 寄せる。
 * 頂点の 位置は かえない（横から 見た 輪郭・くねりは おなじ）。
 */
function buildGeometry(prof, thickness, round = false, art = null) {
  const { top, bot, x0, y0, bw, bh, sw, sh } = prof;
  const scale = 1 / bw;                    // 画像 px → 長さ 1
  const cy = y0 + bh / 2;
  const heights = new Float32Array(COLS + 1);
  for (let i = 0; i <= COLS; i++) heights[i] = (bot[i] - top[i]) * scale;
  const env = widthEnvelope(heights, round);
  const halfW = Math.max(0.03, thickness * 0.5);
  const pos = [], uv = [], idx = [];
  // 原寸の 画素（UV の 寄せ だけに つかう）。fx・fy＝縮小画像の 1px が 原寸の 何px か
  const fx = art ? art.w / sw : 1, fy = art ? art.h / sh : 1;
  const alphaAt = art ? (x, y) => (x < 0 || y < 0 || x >= art.w || y >= art.h ? 0 : art.data[(y * art.w + x) * 4 + 3]) : null;
  const P = SEAM.ridgePow;
  for (let i = 0; i <= COLS; i++) {
    const u = i / COLS;
    const x = u - 0.5;
    // 貝は両はしを丸くとじる（正面から見てもすき間ができないように）。形と絵は内側の列から借りる
    const k = round ? Math.min(i, COLS - i) : 2;
    const si = round && k < 2 ? (i < COLS / 2 ? 2 : COLS - 2) : i;
    const capK = k === 0 ? 0 : k === 1 ? 0.7 : 1;
    const ui = round && k < 2 ? Math.round(COLS * 0.45) : si;   // ふたの絵は から の真ん中の列から
    const px = x0 + (ui / COLS) * (bw - 1) + 0.5;
    const ytU = (cy - top[ui]) * scale, ybU = (cy - bot[ui]) * scale;
    const yt = (cy - top[si]) * scale, yb = (cy - bot[si]) * scale;
    const c = (yt + yb) / 2, hh = (yt - yb) / 2;
    // v0.10 頭先・尾先の 列は ほぼ 0 の はばで とじる（正面から 見て 刃の すきまが 見えない）
    const wMin = !round && (i === 0 || i === COLS) ? 0.0005 : 0.002;
    const w = Math.max(wMin, Math.min(halfW * env[si], round ? hh * 1.2 + 0.002 : hh * 0.95 + wMin));
    // 画像の y（縮小画像の px）：まんなか midImg・半分の 高さ halfImg（貝は ふちの すけた所を拾わない よう 0.9）
    const midImg = cy - (ytU + ybU) / 2 / scale, halfImg = (ytU - ybU) / 2 / scale * (round ? 0.9 : 1);
    const X = Math.max(0, Math.round(px * fx - 0.5));
    const { dT, dB } = alphaAt ? ridgePull(alphaAt, X, (midImg - halfImg) * fy, (midImg + halfImg) * fy) : { dT: 0, dB: 0 };
    for (let j = 0; j <= RING; j++) {
      const phi = (j / RING) * Math.PI * 2;
      const s = Math.sin(phi), co = Math.cos(phi);
      const y = c + hh * co * capK;
      const z = w * capK * Math.sign(s) * Math.pow(Math.abs(s), round ? 0.25 : 1.4);
      pos.push(x, y, z);
      // 原寸の 画像 y：側面は いままで どおり、背・腹の 稜線 ちかく だけ 内がわへ
      let iy = (midImg - halfImg * co) * fy;
      if (co > 0) iy += dT * Math.pow(co, P); else iy -= dB * Math.pow(-co, P);
      // 頭先の 2列：すける 頂点は 体の がわの 不透明な 画素へ（正面の まんなかの 縦の われめ）
      let ix = px * fx;
      if (alphaAt && !round && i >= COLS - 1) ix = headPull(alphaAt, ix, Math.min(art.h - 1, Math.max(0, iy)));
      uv.push(ix / fx / sw, 1 - iy / fy / sh);
    }
  }
  const R = RING + 1;
  for (let i = 0; i < COLS; i++) for (let j = 0; j < RING; j++) {
    const a = i * R + j, b = (i + 1) * R + j, c2 = (i + 1) * R + j + 1, d = i * R + j + 1;
    idx.push(a, d, b, b, d, c2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  joinSeamNormals(geo.attributes.normal.array);
  geo.computeBoundingSphere();
  geo.userData.heightRatio = bh / bw;
  return geo;
}

/** v0.10 背の 稜線（j=0 と j=RING は おなじ 位置の べつ頂点）の 法線を 平均して つなぐ（左右の 明るさの 段・リムの 白い 線を けす） */
export function joinSeamNormals(n, cols = COLS, ring = RING) {
  const R = ring + 1;
  for (let i = 0; i <= cols; i++) {
    const a = i * R * 3, b = (i * R + ring) * 3;
    let x = n[a] + n[b], y = n[a + 1] + n[b + 1], z = n[a + 2] + n[b + 2];
    const l = Math.hypot(x, y, z);
    if (l < 1e-6) { x = 0; y = 1; z = 0; } else { x /= l; y /= l; z /= l; }
    n[a] = n[b] = x; n[a + 1] = n[b + 1] = y; n[a + 2] = n[b + 2] = z;
  }
  return n;
}

/**
 * 前処理した 画素 → テクスチャ。上下を いれかえて ふつうの 絵と おなじ UV に する。
 * Canvas に もどすと alpha 0 の 画素の 色（にじみ出し）が きえるので DataTexture で わたす（Codex）。GPU に のせたら 画素は 手ばなす。
 */
function makeTexture(art) {
  const { w, h, data } = art;
  const flip = new Uint8Array(data.length), row = w * 4;
  for (let y = 0; y < h; y++) flip.set(data.subarray(y * row, y * row + row), (h - 1 - y) * row);
  const tex = new THREE.DataTexture(flip, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;   // 正面から 見ると 長さ方向に つよく ちぢむ（Codex 2→4 で くらべる・agy 8 → 4）
  tex.onUpdate = () => { tex.image = { data: null, width: w, height: h }; };
  tex.needsUpdate = true;
  return tex;
}

/**
 * 種ごとの見た目（ジオメトリとテクスチャ）。まず仮の魚で作り、絵が読めたら差し替えて onUpgrade を呼ぶ。
 */
export class SpeciesLibrary {
  constructor(rootUrl) {
    this.rootUrl = rootUrl;
    this.map = new Map();
  }
  get(spec, onUpgrade) {
    let e = this.map.get(spec.id);
    if (e) { if (onUpgrade) e.listeners.add(onUpgrade); return e; }
    const thick = spec.look?.thickness ?? 0.18;
    const round = spec.kind === 'snail';
    const fb = drawFallbackFish(spec);
    const fa = prepArt(fb);
    e = { spec, geometry: buildGeometry(readProfile(fb), thick, round, fa), texture: makeTexture(fa), real: false, listeners: new Set() };
    if (onUpgrade) e.listeners.add(onUpgrade);
    this.map.set(spec.id, e);
    if (spec.texture) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (!img.width || this.disposed) return;
        try {
          const art = prepArt(img);
          const geo = buildGeometry(readProfile(img), thick, round, art);
          const tex = makeTexture(art);
          const oldG = e.geometry, oldT = e.texture;
          e.geometry = geo; e.texture = tex; e.real = true;
          for (const fn of e.listeners) fn(e);
          oldG.dispose(); oldT.dispose();
        } catch (err) { /* 読めない絵は仮の魚のまま */ }
      };
      img.onerror = () => {};
      img.src = new URL(spec.texture, this.rootUrl).href;
    }
    return e;
  }
  dispose() {
    this.disposed = true;
    for (const e of this.map.values()) { e.geometry.dispose(); e.texture.dispose(); e.listeners.clear(); }
    this.map.clear();
  }
}

/**
 * v0.8 ゆめの いきもの：かいた 絵（f.dream.art の dataURL）から 見た目を つくる。
 * flat＝ひらたい いた（オリジナル）。そうでなければ もとの しゅるいと おなじ「輪郭→ふくらませる」立体（ぬりえ）。
 * overlay（もじペンの 層。art と おなじ 大きさ・位置。無くて よい）が あれば、表（art＋字）と 裏（art＋字を 字の はんいの 中で 左右もどし）の
 * 2まいを 作る。鏡うつしに 見える がわ（立体の −z 面・板の 左むき）は 裏を つかうので、どちらから 見ても 字が 読める。
 * できたら done({ geometry, texture, textureBack|null, heightRatio }) を よぶ。もどりの 関数を よぶと とりやめ（あとから できても すぐ dispose）。
 */
export function loadDreamLook(spec, art, done, overlay = null) {
  let cancelled = false;
  if (typeof art !== 'string' || !art.startsWith('data:image/')) return () => {};
  const okOv = typeof overlay === 'string' && overlay.startsWith('data:image/');
  const load = (src) => new Promise((ok) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i.width && i.height ? i : null); i.onerror = () => ok(null); i.src = src; });
  Promise.all([load(art), okOv ? load(overlay) : null]).then(([img, ov]) => {
    if (cancelled || !img) return;
    try {
      let geometry;
      const sides = ov ? composeOverlay(img, ov, !spec.dream?.flat) : null;   // ぬりえは 字を 体の 中だけに（agy・Codex）
      // v0.10 表と 裏は おなじ 形（ぬりえの 字は 体の 中だけ）なので、稜線の 寄せは 表の 画素で きめ、にじみ出しは それぞれに かける
      const front = prepArt(sides ? sides.front : img);
      if (spec.dream?.flat) geometry = buildFlatGeometry(img.height / img.width);
      else geometry = buildGeometry(readProfile(img), spec.look?.thickness ?? 0.18, spec.kind === 'snail', front);   // 形は art だけで きめる
      const texture = makeTexture(front);
      const textureBack = sides ? makeTexture(prepArt(sides.back)) : null;
      done({ geometry, texture, textureBack, heightRatio: geometry.userData.heightRatio || 0.3 });
    } catch (err) { /* 読めない 絵は 出さない */ }
  });
  return () => { cancelled = true; };
}

/** 字の 層の すけない 画素の 外接四角（無ければ null） */
export function alphaBox(data, w, h, th = 8) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > th) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** 表＝art＋字、裏＝art＋字（字の 外接四角の 中で 左右もどし）。字は art の 大きさに あわせて かさねる */
function composeOverlay(img, ov, maskToArt = false) {
  const w = img.width, h = img.height;
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const o = mk(), og = o.getContext('2d', { willReadFrequently: true });
  og.drawImage(ov, 0, 0, w, h);
  // 立体（ぬりえ）は 輪郭の 外に 体が ないので、字も art の 中だけに する（外接四角が ずれない・すきまに 字が うかない）
  if (maskToArt) { og.globalCompositeOperation = 'destination-in'; og.drawImage(img, 0, 0); og.globalCompositeOperation = 'source-over'; }
  const box = alphaBox(og.getImageData(0, 0, w, h).data, w, h);
  const front = mk(), fg = front.getContext('2d');
  fg.drawImage(img, 0, 0); fg.drawImage(o, 0, 0);
  const back = mk(), bg = back.getContext('2d');
  bg.drawImage(img, 0, 0);
  if (box) {
    const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
    bg.save(); bg.translate(box.x0 * 2 + bw, 0); bg.scale(-1, 1);
    bg.drawImage(o, box.x0, box.y0, bw, bh, box.x0, box.y0, bw, bh);
    bg.restore();
  }
  return { front, back };
}

/**
 * ひらたい いた（頭が +x、中心が 原点）。長い ほうの 辺を 1 に する（たて長の 絵が 大きく なりすぎない）。
 * userData.heightRatio＝全長に たいする 高さ（せいかくには 板の 横はばを 全長 1 と みなした 高さ）。
 */
export function buildFlatGeometry(aspect) {
  const a = Math.max(0.05, Math.min(4, +aspect || 0.5));
  const w = a > 1 ? 1 / a : 1, h = w * a;
  const geo = new THREE.PlaneGeometry(w, h, 20, 8);   // v0.10 下の ふちを 波うたせる ので たても こまかく（agy）
  geo.userData.heightRatio = h;
  geo.userData.flatW = w;
  return geo;
}

const VERT_COMMON = /* glsl */`
uniform float uWave;
uniform float uAmp;
uniform float uBend;
uniform float uK;
float fishDz(float x) {
  float tl = clamp((0.32 - x) / 0.82, 0.0, 1.0);
  float sway = sin(x * uK + uWave) * uAmp * (0.05 + tl * tl);
  float d = x - 0.2;
  float bend = uBend * d * d * (d < 0.0 ? 1.0 : 0.35);
  return sway + bend;
}
`;

/**
 * v0.10 カエル・カメの 足の あたり（真横の 絵の 中の 正規化 座標。U＝0 尾がわ〜1 頭、V＝0 上〜1 下）。
 * [U0, U1, V0, V1]：U は はしで なめらかに 0、V は 下へ いくほど つよく（根もとは よわく、足先ほど うごく）。
 * 絵を 見て きめた 目安（Codex）。ぬりえは もとの しゅるいの ものを つかう。しらない しゅるいは 型の 目安。
 */
export const LIMB_AREAS = {
  frog:          { hind: [0.06, 0.53, 0.56, 0.98], fore: [0.53, 0.82, 0.57, 0.99] },
  turtle:        { hind: [0.10, 0.34, 0.69, 1.00], fore: [0.62, 0.84, 0.65, 1.00] },
  tonosamagaeru: { hind: [0.06, 0.53, 0.56, 0.98], fore: [0.53, 0.82, 0.57, 0.99] },
  amagaeru:      { hind: [0.05, 0.52, 0.60, 0.99], fore: [0.51, 0.81, 0.59, 0.99] },
  kusagame:      { hind: [0.10, 0.34, 0.69, 1.00], fore: [0.62, 0.84, 0.65, 1.00] },
  ishigame:      { hind: [0.13, 0.36, 0.71, 1.00], fore: [0.60, 0.87, 0.66, 1.00] },
  albino_suppon: { hind: [0.08, 0.31, 0.66, 1.00], fore: [0.55, 0.86, 0.65, 1.00] },
};
/** しゅるい id（ぬりえは もとの id）と 足の しゅるいから 足の あたり */
export const limbAreaOf = (id, limb) => (Object.prototype.hasOwnProperty.call(LIMB_AREAS, id) && id !== 'frog' && id !== 'turtle' ? LIMB_AREAS[id] : LIMB_AREAS[limb === 'frog' ? 'frog' : 'turtle']);

/**
 * v0.10 足の うごきの 大きさ（全長＝1。Y は 体の 高さ 1 あたり）。シェーダーの 定数に なる。
 * Codex（ひかえめ：カエル 後ろ足 0.10〜0.16・カメ 前あし ±0.035〜0.055）と agy（大きめ：0.24〜0.26・0.10〜0.11）の あいだで、連写を 見て きめた。
 * 仕上げの 確認で カエルは のびすぎ（Codex 0.16・agy 0.20 → 0.19）、板は 小さすぎ（agy 2倍・Codex そのまま → 1.5倍）に なおした。
 * frog：後ろ足 うしろへ hindX・うえへ hindY×体高、前足 うしろへ foreX。板（オリジナル）は 後ろ半分を flatX だけ のばす。
 * turtle：前あし 前後 ±foreX・もどしで うえへ foreY・横へ ひらく foreZ、後ろあし（逆位相）±hindX・hindY。板は 下の ふちを ±flatX・flatY×体高。
 */
export const LIMB_MOVE = {
  frog:   { hindX: 0.19, hindY: 0.12, foreX: 0.04, flatX: 0.11, flatY: 0.09 },
  turtle: { foreX: 0.11, foreY: 0.045, foreZ: 0.035, hindX: 0.065, hindY: 0.03, flatX: 0.05, flatY: 0.03 },
};

/** v0.10 足の 変形（変形前の position → ずらす 量）。limb：'frog'|'turtle'、flat：ひらたい いた */
function limbGlsl(limb, flat) {
  const M = LIMB_MOVE[limb], n = (v) => Number(v).toFixed(4);
  const head = /* glsl */`
uniform vec2 uLimb;
uniform vec2 uHalf;
uniform vec4 uHind;
uniform vec4 uFore;
float limbBox(vec4 b, float U, float V) {
  return smoothstep(b.x - 0.06, b.x + 0.06, U) * (1.0 - smoothstep(b.y - 0.06, b.y + 0.06, U)) * smoothstep(b.z - 0.05, b.w, V);
}
vec3 fishLimb(vec3 p) {
  float U = clamp(p.x / (2.0 * uHalf.x) + 0.5, 0.0, 1.0);
  float V = clamp(0.5 - p.y / (2.0 * uHalf.y), 0.0, 1.0);
  vec3 d = vec3(0.0);
`;
  let body;
  // カエル：尾がわ（たたんだ ひざ）は 上の ほうから 足に する（agy）
  if (limb === 'frog' && !flat) body = `
  vec4 hb = uHind;
  hb.z = mix(uHind.z - 0.15, uHind.z, clamp(U / 0.35, 0.0, 1.0));
  float h = limbBox(hb, U, V), f = limbBox(uFore, U, V);
  d.x = -uLimb.x * (${n(M.hindX)} * h + ${n(M.foreX)} * f);
  d.y = uLimb.x * ${n(M.hindY * 2)} * uHalf.y * h;`;
  else if (limb === 'frog') body = `
  float r = pow(1.0 - U, 1.5);
  d.x = -uLimb.x * ${n(M.flatX * 2)} * uHalf.x * r * (0.5 + 0.5 * V);
  d.y = uLimb.x * ${n(M.flatY * 2)} * uHalf.y * r * (V - 0.5);`;
  else if (!flat) body = `
  float f = limbBox(uFore, U, V), h = limbBox(uHind, U, V);
  float amp = length(uLimb);
  float side = p.z / sqrt(p.z * p.z + 0.0001);
  d.x = ${n(M.foreX)} * uLimb.x * f - ${n(M.hindX)} * uLimb.x * h;
  d.y = ${n(M.foreY)} * max(0.0, -uLimb.y) * f + ${n(M.hindY)} * max(0.0, uLimb.y) * h;
  d.z = side * ${n(M.foreZ)} * (0.5 * amp + 0.5 * uLimb.y) * f;`;
  else body = `
  float wb = smoothstep(0.50, 0.95, V);
  float cu = cos(U * 3.14159), su = sin(U * 3.14159);
  float c = uLimb.x * cu + uLimb.y * su, s = uLimb.y * cu - uLimb.x * su;
  d.x = ${n(M.flatX * 2)} * uHalf.x * wb * c;
  d.y = ${n(M.flatY * 2)} * uHalf.y * wb * max(0.0, -s);`;
  return head + body + '\n  return d;\n}\n';
}

/**
 * 1匹ぶんのマテリアル（くねり・くすみ・光る を個別に持つ）。
 * o.flat（v0.8 ゆめの ひらたい いた）：尾がわ ほど 上下にも やわらかく くねる＋絵の 色が くらく ならない よう 少し 自分で 光る。
 */
export function makeFishMaterial(texture, o = {}) {
  const flat = !!o.flat;
  // v0.8 もじペン（o.twoSided）：鏡うつしに 見える がわは uMapB（裏の 絵＝字だけ 左右もどし）。
  //   ぬりえ＝変形前の position.z が マイナスの 面。板＝scale.x が マイナス（uFlipX）と 裏面から 見ている（!gl_FrontFacing）の どちらか 一方
  const two = !!o.twoSided;
  const u = {
    uWave: { value: Math.random() * 6 },
    uAmp: { value: 0.06 },
    uBend: { value: 0 },
    uK: { value: 5.6 },
    uDull: { value: 0 },
    uFlash: { value: 0 },
    uRim: { value: 0.35 },
    uShiny: { value: 0 },     // v0.6 キラキラ（0/1）
    uTime: { value: 0 },
  };
  if (two) { u.uMapB = { value: texture }; u.uFlipX = { value: 0 }; }
  // v0.10 カエル・カメ（o.limb）：足を うごかす。uLimb＝（カエル：足の のび・0／カメ：前あしの cos・sin）×つよさ、uHalf＝体の 半分の 長さ・高さ
  const limb = o.limb === 'frog' || o.limb === 'turtle' ? o.limb : null;
  if (limb) {
    const A = o.limbArea || limbAreaOf('', limb);
    u.uLimb = { value: new THREE.Vector2() };
    u.uHalf = { value: new THREE.Vector2(0.5, 0.15) };
    u.uHind = { value: new THREE.Vector4(...A.hind) };
    u.uFore = { value: new THREE.Vector4(...A.fore) };
  }
  const mat = new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.5, side: THREE.DoubleSide });
  mat.userData.u = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_COMMON + (limb ? limbGlsl(limb, flat) : '') + (two ? '\nvarying float vFishSide;' : ''))
      .replace('#include <beginnormal_vertex>', `
        vec3 objectNormal = vec3( normal );
        float fishSl = (fishDz(position.x + 0.01) - fishDz(position.x - 0.01)) / 0.02;
        objectNormal = normalize(vec3(objectNormal.x - fishSl * objectNormal.z, objectNormal.y, objectNormal.z));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3( position );${two ? '\n        vFishSide = position.z;' : ''}${limb ? '\n        transformed += fishLimb(position);' : ''}
        transformed.z += fishDz(position.x)${flat ? ' * 0.6' : ''};${flat ? `
        float flatTl = clamp((0.25 - position.x) / 0.75, 0.0, 1.0);
        transformed.y += sin(position.x * uK * 0.8 + uWave + 0.8) * uAmp * (0.15 + flatTl * flatTl) * ${FLAT_WOBBLE.toFixed(2)};` : ''}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDull;\nuniform float uFlash;\nuniform float uRim;\nuniform float uShiny;\nuniform float uTime;' + (two ? '\nuniform sampler2D uMapB;\nuniform float uFlipX;\nvarying float vFishSide;' : ''))
      .replace('#include <map_fragment>', `${two ? `#ifdef USE_MAP
        bool fishBack = ${flat ? '(uFlipX > 0.5) != !gl_FrontFacing' : 'vFishSide < 0.0'};
        vec4 sampledDiffuseColor = fishBack ? texture2D( uMapB, vMapUv ) : texture2D( map, vMapUv );
        diffuseColor *= sampledDiffuseColor;
        #endif` : '#include <map_fragment>'}
        float fishLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(fishLum) * vec3(0.78, 0.84, 0.92) * 0.9, uDull);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * (uFlash${flat ? ` + ${FLAT_SELF_LIGHT.toFixed(2)}` : ''});`)
      .replace('#include <opaque_fragment>', `
        float fishRim = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
        outgoingLight += vec3(0.75, 0.95, 1.0) * pow(fishRim, 3.0) * uRim * (1.0 - uDull * 0.6);
        // v0.6 キラキラ：ふちに パステルの にじいろ＋ゆっくり とおる ひかりの おび（はやい てんめつは しない）
        if (uShiny > 0.5) {
          float fr = pow(fishRim, 1.6);
          vec3 irid = 0.55 + 0.45 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + fr * 0.9 + uTime * 0.05));
          float band = pow(max(0.0, sin(gl_FragCoord.x * 0.012 - gl_FragCoord.y * 0.006 - uTime * 1.1)), 24.0);
          outgoingLight += irid * (0.05 + 0.28 * fr) * (1.0 - uDull * 0.6) + vec3(1.0, 0.97, 0.88) * band * 0.2 * diffuseColor.a;
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => (flat ? 'osakana-fish-flat-v1' : 'osakana-fish-v2') + (two ? '-2side' : '') + (limb ? '-limb-' + limb : '');
  return mat;
}
// v0.8 ひらたい いたの くねり（uAmp に かける。尾の はしで 体長の やく 3〜5%）と 自分で 光る 量（絵の 色を くすませない）
const FLAT_WOBBLE = 0.9;
const FLAT_SELF_LIGHT = 0.22;
