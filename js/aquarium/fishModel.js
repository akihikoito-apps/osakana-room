// 魚の立体づくり：真横の絵（透過）から輪郭を読み取り、列ごとに断面をふくらませた「厚みのある体」を作る。
// UV は側面からの平行投影。くねりは頂点シェーダー（MeshLambertMaterial に onBeforeCompile で注入）。
import * as THREE from '../../vendor/three.module.min.js';
import { drawFallbackFish } from './fallbackArt.js';

const COLS = 44;       // 長さ方向の分割
const RING = 18;       // 断面の分割
const SAMPLE_W = 192;  // 輪郭読み取り用に縮小する幅

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

/** 輪郭から厚みのあるジオメトリを作る（全長 1、頭が +x、体の中心が原点）。 */
function buildGeometry(prof, thickness, round = false) {
  const { top, bot, x0, y0, bw, bh, sw, sh } = prof;
  const scale = 1 / bw;                    // 画像 px → 長さ 1
  const cy = y0 + bh / 2;
  const heights = new Float32Array(COLS + 1);
  for (let i = 0; i <= COLS; i++) heights[i] = (bot[i] - top[i]) * scale;
  const env = widthEnvelope(heights, round);
  const halfW = Math.max(0.03, thickness * 0.5);
  const pos = [], uv = [], idx = [];
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
    const w = Math.max(0.002, Math.min(halfW * env[si], round ? hh * 1.2 + 0.002 : hh * 0.95 + 0.002));
    for (let j = 0; j <= RING; j++) {
      const phi = (j / RING) * Math.PI * 2;
      const s = Math.sin(phi), co = Math.cos(phi);
      const yUv = (ytU + ybU) / 2 + (ytU - ybU) / 2 * co * (round ? 0.9 : 1);   // 貝は ふちの すけた所を拾わない
      const y = c + hh * co * capK;
      const z = w * capK * Math.sign(s) * Math.pow(Math.abs(s), round ? 0.25 : 1.4);
      pos.push(x, y, z);
      const imgY = cy - yUv / scale;
      uv.push(px / sw, 1 - imgY / sh);
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
  geo.computeBoundingSphere();
  geo.userData.heightRatio = bh / bw;
  return geo;
}

function makeTexture(src) {
  const tex = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
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
    e = { spec, geometry: buildGeometry(readProfile(fb), thick, round), texture: makeTexture(fb), real: false, listeners: new Set() };
    if (onUpgrade) e.listeners.add(onUpgrade);
    this.map.set(spec.id, e);
    if (spec.texture) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (!img.width || this.disposed) return;
        try {
          const geo = buildGeometry(readProfile(img), thick, round);
          const tex = makeTexture(img);
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
      if (spec.dream?.flat) geometry = buildFlatGeometry(img.height / img.width);
      else geometry = buildGeometry(readProfile(img), spec.look?.thickness ?? 0.18, spec.kind === 'snail');   // 形は art だけで きめる
      const sides = ov ? composeOverlay(img, ov, !spec.dream?.flat) : null;   // ぬりえは 字を 体の 中だけに（agy・Codex）
      const texture = makeTexture(sides ? sides.front : img);
      const textureBack = sides ? makeTexture(sides.back) : null;
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
  const geo = new THREE.PlaneGeometry(w, h, 16, 4);
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
  const mat = new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.5, side: THREE.DoubleSide });
  mat.userData.u = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_COMMON + (two ? '\nvarying float vFishSide;' : ''))
      .replace('#include <beginnormal_vertex>', `
        vec3 objectNormal = vec3( normal );
        float fishSl = (fishDz(position.x + 0.01) - fishDz(position.x - 0.01)) / 0.02;
        objectNormal = normalize(vec3(objectNormal.x - fishSl * objectNormal.z, objectNormal.y, objectNormal.z));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3( position );${two ? '\n        vFishSide = position.z;' : ''}
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
  mat.customProgramCacheKey = () => (flat ? 'osakana-fish-flat-v1' : 'osakana-fish-v2') + (two ? '-2side' : '');
  return mat;
}
// v0.8 ひらたい いたの くねり（uAmp に かける。尾の はしで 体長の やく 3〜5%）と 自分で 光る 量（絵の 色を くすませない）
const FLAT_WOBBLE = 0.9;
const FLAT_SELF_LIGHT = 0.22;
