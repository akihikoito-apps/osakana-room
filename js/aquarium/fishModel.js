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
function widthEnvelope(heights) {
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
function buildGeometry(prof, thickness) {
  const { top, bot, x0, y0, bw, bh, sw, sh } = prof;
  const scale = 1 / bw;                    // 画像 px → 長さ 1
  const cy = y0 + bh / 2;
  const heights = new Float32Array(COLS + 1);
  for (let i = 0; i <= COLS; i++) heights[i] = (bot[i] - top[i]) * scale;
  const env = widthEnvelope(heights);
  const halfW = Math.max(0.03, thickness * 0.5);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= COLS; i++) {
    const u = i / COLS;
    const px = x0 + u * (bw - 1) + 0.5;
    const x = u - 0.5;
    const yt = (cy - top[i]) * scale, yb = (cy - bot[i]) * scale;
    const c = (yt + yb) / 2, hh = (yt - yb) / 2;
    const w = Math.max(0.002, Math.min(halfW * env[i], hh * 0.95 + 0.002));
    for (let j = 0; j <= RING; j++) {
      const phi = (j / RING) * Math.PI * 2;
      const s = Math.sin(phi), co = Math.cos(phi);
      const y = c + hh * co;
      const z = w * Math.sign(s) * Math.pow(Math.abs(s), 1.4);
      pos.push(x, y, z);
      const imgY = cy - y / scale;
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
    const fb = drawFallbackFish(spec);
    e = { spec, geometry: buildGeometry(readProfile(fb), thick), texture: makeTexture(fb), real: false, listeners: new Set() };
    if (onUpgrade) e.listeners.add(onUpgrade);
    this.map.set(spec.id, e);
    if (spec.texture) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (!img.width || this.disposed) return;
        try {
          const geo = buildGeometry(readProfile(img), thick);
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

/** 1匹ぶんのマテリアル（くねり・くすみ・光る を個別に持つ）。 */
export function makeFishMaterial(texture) {
  const u = {
    uWave: { value: Math.random() * 6 },
    uAmp: { value: 0.06 },
    uBend: { value: 0 },
    uK: { value: 5.6 },
    uDull: { value: 0 },
    uFlash: { value: 0 },
    uRim: { value: 0.35 },
  };
  const mat = new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.5, side: THREE.DoubleSide });
  mat.userData.u = u;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_COMMON)
      .replace('#include <beginnormal_vertex>', `
        vec3 objectNormal = vec3( normal );
        float fishSl = (fishDz(position.x + 0.01) - fishDz(position.x - 0.01)) / 0.02;
        objectNormal = normalize(vec3(objectNormal.x - fishSl * objectNormal.z, objectNormal.y, objectNormal.z));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3( position );
        transformed.z += fishDz(position.x);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDull;\nuniform float uFlash;\nuniform float uRim;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float fishLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(fishLum) * vec3(0.78, 0.84, 0.92) * 0.9, uDull);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * uFlash;`)
      .replace('#include <opaque_fragment>', `
        float fishRim = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
        outgoingLight += vec3(0.75, 0.95, 1.0) * pow(fishRim, 3.0) * uRim * (1.0 - uDull * 0.6);
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'osakana-fish-v1';
  return mat;
}
