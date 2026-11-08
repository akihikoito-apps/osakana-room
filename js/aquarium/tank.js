// 水槽そのもの：水・底砂（コースティクス）・水面・光の筋・ガラスの縁・飾りと器具・泡・餌。
import * as THREE from '../../vendor/three.module.min.js';

export const TANK_H = 9;        // 高さ（ワールド単位）
export const TANK_D = 7;        // 奥行き
export const WATER_TOP = TANK_H - 0.6;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const WATER_COLORS = {
  fresh: { top: new THREE.Color('#a4e4e8'), mid: new THREE.Color('#3a98ad'), deep: new THREE.Color('#1b5873'), fog: new THREE.Color('#4aa2b4'), sand: new THREE.Color('#d7c7a2') },
  salt:  { top: new THREE.Color('#b4ecff'), mid: new THREE.Color('#2a8fd6'), deep: new THREE.Color('#123f8a'), fog: new THREE.Color('#3b9be0'), sand: new THREE.Color('#f6f2e8') },
  // v0.6 いけ（ぼうけん係）：みどりがかった 水・どろっぽい 茶色の 底
  pond:  { top: new THREE.Color('#cfe8b4'), mid: new THREE.Color('#5f9c74'), deep: new THREE.Color('#2c5a45'), fog: new THREE.Color('#6fa27a'), sand: new THREE.Color('#8a6c4c') },
};
// v0.6 いけの すいそう：半分 りくち・半分 みず（Codex・agy に 相談：みぎに りくち 約4わり＋なだらかな さか、奥行きは ぜんぶ。
// 水位は agy の あんで さげる（りくちの 上に カメ・カエルが のる すきまを のこす）。x は 横幅 W に たいする わりあい）
export const POND = { waterTop: 5.0, landTop: 5.6, slopeFrom: -0.05, slopeTo: 0.13, soil: '#8a6a45', wet: '#5b4631', grass: '#78b04f', grass2: '#a5d061' };
const MURK = new THREE.Color('#6d8a3c');
const NIGHT = new THREE.Color('#132a55');

// ---- 小さな道具 ----
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** 同じ材質のメッシュを1つにまとめる（描画回数を減らす）。 */
function mergeMeshes(meshes, material) {
  const pos = [], nor = [];
  for (const m of meshes) {
    m.updateMatrix();
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    g.dispose(); m.geometry.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return new THREE.Mesh(g, material);
}

/** 底のごみの仮の絵（茶色の葉っぱ）。dirt_bits.png が読めたら差し替える。 */
function makeDirtTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const cols = ['#8a4f22', '#a8642c', '#6e3e1c', '#b97a3a'];
  for (let i = 0; i < 5; i++) {
    g.save(); g.translate(40 + (i % 3) * 22, 40 + Math.floor(i / 2) * 20); g.rotate(i * 1.3);
    g.fillStyle = cols[i % 4]; g.beginPath(); g.ellipse(0, 0, 30, 17, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(60,30,10,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-26, 0); g.lineTo(26, 0); g.stroke();
    g.restore();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 光の網目（コースティクス）のタイル画像。ボロノイの境目を明るく。 */
function makeCausticTexture() {
  const N = 128, P = 14;
  const r = rng(7);
  const pts = [];
  for (let i = 0; i < P; i++) pts.push([r() * N, r() * N]);
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let f1 = 1e9, f2 = 1e9;
    for (const [px, py] of pts) {
      let dx = Math.abs(x - px), dy = Math.abs(y - py);
      if (dx > N / 2) dx = N - dx; if (dy > N / 2) dy = N - dy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    const e = f2 - f1;
    const v = Math.pow(clamp(1 - e / 13, 0, 1), 2.0);
    const o = (y * N + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = Math.round(v * 255); img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function gradientTexture(w, h, stops, vertical = true) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const gr = vertical ? g.createLinearGradient(0, 0, 0, h) : g.createLinearGradient(0, 0, w, 0);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(cv);
  return t;
}

/** v0.6 いけ：りくちの 断面（手前の ガラスごしに 見える 土）。下＝0、上＝hTot の 高さ。うえに 草の ふち、水ぎわは ぬれた 色 */
function landStrataTexture(hTot, wt) {
  const H = 256, Wc = 128;
  const cv = document.createElement('canvas');
  cv.width = Wc; cv.height = H;
  const g = cv.getContext('2d');
  const yOf = (h) => clamp(H * (1 - h / hTot), 0, H);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#86c457');
  gr.addColorStop(yOf(hTot - 0.42) / H, '#73b04a');
  gr.addColorStop(yOf(hTot - 0.55) / H, '#b48d62');
  gr.addColorStop(yOf(wt + 0.2) / H, '#a37e57');
  gr.addColorStop(yOf(wt - 0.1) / H, '#87684a');
  gr.addColorStop(1, '#6e5238');
  g.fillStyle = gr; g.fillRect(0, 0, Wc, H);
  // 土の 中の 小石（大きめで まばら。穴の あつまりに 見えない ように）
  const R = rng(5);
  // 土の しま（うすい よこの すじ。つぶつぶは 描かない）
  for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(255, 235, 200, 0.08)'; g.fillRect(0, yOf(wt * 0.25 + i * wt * 0.22), Wc, 4); }
  // （石の もようは 横に のびて 穴に 見えたので 描かない。りくちの 石は 3D で 上に のせる）
  void R;
  // 草の ふち
  g.fillStyle = '#8cc95a';
  for (let x = 0; x < Wc; x += 4) { const hh = 4 + R() * 7; g.beginPath(); g.moveTo(x, yOf(hTot - 0.38)); g.lineTo(x + 2, yOf(hTot - 0.38) - hh); g.lineTo(x + 4, yOf(hTot - 0.38)); g.fill(); }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
const LAND_COL = { soil: new THREE.Color('#8a6a45'), wet: new THREE.Color('#5b4631'), g1: new THREE.Color('#78b04f'), g2: new THREE.Color('#a5d061') };

function rayTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 256;
  const g = cv.getContext('2d');
  const img = g.createImageData(64, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
    const sx = Math.sin((x / 63) * Math.PI);
    const v = Math.pow(sx, 2.5) * Math.pow(1 - y / 255, 1.6);
    const o = (y * 64 + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = Math.round(v * 255);
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cv);
}

function bubbleTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 10, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.25)'); gr.addColorStop(0.92, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.ellipse(23, 22, 6, 4, -0.6, 0, 7); g.fill();
  return new THREE.CanvasTexture(cv);
}

function moteTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(cv);
}

// ---- 粒（泡・浮遊物）のシェーダー：粒ごとに大きさと透明度 ----
function pointsMaterial(tex, color, additive = false) {
  return new THREE.ShaderMaterial({
    uniforms: { uTex: { value: tex }, uScale: { value: 400 }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 } },
    vertexShader: `attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / -mv.z; vA = aAlpha; }`,
    fragmentShader: `uniform sampler2D uTex; uniform vec3 uColor; uniform float uOpacity; varying float vA;
      void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(uColor * t.rgb, t.a * vA * uOpacity); if (gl_FragColor.a < 0.01) discard; }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

export class Tank {
  constructor(scene, waterType = 'fresh') {
    this.scene = scene;
    this.waterType = WATER_COLORS[waterType] ? waterType : 'fresh';
    this.colors = WATER_COLORS[this.waterType];
    this.waterTop = this.waterType === 'pond' ? POND.waterTop : WATER_TOP;   // v0.6 いけは 水位が ひくい
    this.land = null;                                                        // v0.6 いけ：{ x0 さかの はじまり, x1 たいらな ところ, shore 水ぎわ, top }
    this.W = 16;
    this.group = new THREE.Group();
    this.decorGroup = new THREE.Group();
    scene.add(this.group, this.decorGroup);
    this.decorIds = [];
    this.water = { dirt: 0, waste: undefined, bubbles: undefined, light: 1 };
    this.time = 0;
    this.caustic = makeCausticTexture();
    this.rayTex = rayTexture();
    this.uniforms = { uTime: { value: 0 }, uCaustic: { value: this.caustic }, uCausticAmt: { value: 0.35 }, uLight: { value: 1 }, uHalfW: { value: 8 }, uGrain: { value: waterType === 'salt' ? 22 : waterType === 'pond' ? 52 : 38 }, uWaterTop: { value: 99 } };
    this.sandSeed = Math.random() * 100;

    // 光
    this.hemi = new THREE.HemisphereLight(0xe6fbff, 0x7a6a48, 1.7);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
    this.sun.position.set(2, 10, 6);
    scene.add(this.hemi, this.sun);
    scene.fog = new THREE.Fog(this.colors.fog.clone(), 10, 40);

    this.rocks = [];
    this.bounds = { minX: -7, maxX: 7, minZ: -2.6, maxZ: 2.7, top: this.waterTop, glassZ: -TANK_D / 2 + 0.12, sandY: (x, z) => this.sandHeight(x, z), groundY: (x, z) => this.groundHeight(x, z) };

    // 泡
    this.bubbleTex = bubbleTexture();
    this.maxBubbles = 160;
    this.bubbles = [];
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.maxBubbles * 3), 3));
    bg.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(this.maxBubbles), 1));
    bg.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(this.maxBubbles), 1));
    this.bubblePoints = new THREE.Points(bg, pointsMaterial(this.bubbleTex, 0xffffff));
    this.bubblePoints.frustumCulled = false;
    this.bubblePoints.renderOrder = 3;
    scene.add(this.bubblePoints);
    for (let i = 0; i < this.maxBubbles; i++) this.bubbles.push({ alive: false, x: 0, y: 0, z: 0, vy: 0, ph: 0, s: 0 });
    this.emitters = [];

    // 浮遊物（奥行きの手がかり・にごりの表現）
    this.moteCount = 140;
    const mg = new THREE.BufferGeometry();
    const mp = new Float32Array(this.moteCount * 3), ms = new Float32Array(this.moteCount), ma = new Float32Array(this.moteCount);
    for (let i = 0; i < this.moteCount; i++) { ms[i] = 0.04 + Math.random() * 0.06; ma[i] = 0.3 + Math.random() * 0.7; }
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    mg.setAttribute('aSize', new THREE.BufferAttribute(ms, 1));
    mg.setAttribute('aAlpha', new THREE.BufferAttribute(ma, 1));
    this.moteTex = moteTexture();
    this.motes = new THREE.Points(mg, pointsMaterial(this.moteTex, 0xf4fff4, true));
    this.motes.frustumCulled = false;
    this.motes.renderOrder = 2;
    this.motePh = Array.from({ length: this.moteCount }, () => [Math.random(), Math.random(), Math.random(), Math.random() * 6]);
    scene.add(this.motes);

    // 餌
    this.maxFood = 48;
    this.foods = [];
    const fgeo = new THREE.IcosahedronGeometry(0.075, 0);
    fgeo.scale(1, 0.55, 1);
    this.foodMesh = new THREE.InstancedMesh(fgeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), this.maxFood);
    this.foodMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.foodMesh.frustumCulled = false;
    const fc = [new THREE.Color('#c8742e'), new THREE.Color('#e2a24a'), new THREE.Color('#a5582a'), new THREE.Color('#d9893c')];
    for (let i = 0; i < this.maxFood; i++) this.foodMesh.setColorAt(i, fc[i % 4]);
    this.foodFlakeColors = fc;
    // v0.6 えさの しゅるい（個体差係）：いろ・おおきさ・しずむ はやさ（aq.feed の kind）
    this.foodKinds = {
      bloodworm: { colors: ['#c4202f', '#a3152a', '#d8323a'], scale: [0.7, 0.55, 1.9], sink: 0.85 },   // ほそながい あかい むし
      brine: { colors: ['#ff9a5c', '#ff7f6a', '#ffb072'], scale: [0.6, 0.6, 0.6], sink: 0.45 },         // ちいさな オレンジの つぶ・ゆっくり
      veggie: { colors: ['#4f9a3a', '#3f8a35', '#5fae46'], scale: [1.5, 0.45, 1.5], sink: 1.4 },        // ひらたい みどりの タブレット・はやく しずむ
      krill: { colors: ['#ff8f7a', '#f47a63', '#ffa58a'], scale: [1.7, 0.9, 0.9], sink: 0.75 },         // ピンクの 小えび・おおきめ
    };
    for (const k of Object.values(this.foodKinds)) k.colors = k.colors.map((c) => new THREE.Color(c));
    this.foodMesh.count = 0;
    scene.add(this.foodMesh);
    const vgeo = new THREE.IcosahedronGeometry(0.085, 1);
    this.vitMesh = new THREE.InstancedMesh(vgeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), this.maxFood);
    this.vitMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.vitMesh.frustumCulled = false;
    const vc = ['#ff6fb5', '#ffd23f', '#5ce1ff', '#9dff5c', '#c38bff'].map((c) => new THREE.Color(c));
    for (let i = 0; i < this.maxFood; i++) this.vitMesh.setColorAt(i, vc[i % vc.length]);
    this.vitMesh.count = 0;
    scene.add(this.vitMesh);
    this.ripples = [];
    this.rippleTex = (() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const g = cv.getContext('2d'); g.beginPath(); g.arc(32, 32, 26, 0, 7); g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke();
      return new THREE.CanvasTexture(cv);
    })();

    // 底のごみ（にごりに合わせて手前の砂の上に出る。そうじの あみ が すくう）
    this.dirtTex = makeDirtTexture();
    this.dirtMat = new THREE.MeshLambertMaterial({ map: this.dirtTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, depthWrite: false });
    this.dirtMat.userData.shared = true;
    this.dirtPatches = [];
    const dimg = new Image();
    dimg.onload = () => {
      if (this.disposed) return;
      // 大きさがちがう絵なので、テクスチャごと作りなおす（同じテクスチャに入れ替えると GL のエラーになる）
      const t = new THREE.Texture(dimg); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
      this.dirtTex.dispose(); this.dirtTex = t; this.dirtMat.map = t; this.dirtMat.needsUpdate = true;
    };
    dimg.onerror = () => {};
    dimg.src = new URL('../../assets/items/dirt_bits.png', import.meta.url).href;
    this.build(16);
  }

  sandHeight(x, z) {
    // 手前が低く、奥に向かってゆるく盛り上がる
    const d = (z + TANK_D / 2) / TANK_D;            // 0=奥 1=手前
    const back = 0.75 + (1 - d) * (1 - d) * 0.9;
    const y = back + (vnoise(x * 0.35 + this.sandSeed, z * 0.35) - 0.5) * 0.3;
    const L = this.land;
    if (!L) return y;
    // v0.6 いけ：みぎは りくち（なだらかな さかで あがる。上は ほぼ たいら＋ひくい でこぼこ）
    const t = clamp((x - L.x0) / (L.x1 - L.x0), 0, 1), k = t * t * (3 - 2 * t);
    const top = L.top + (vnoise(x * 0.45 + 7, z * 0.5 + 3) - 0.5) * 0.35;
    return y + (top - y) * k;
  }

  /** v0.6 いけ：水の ある ところの 右はし（水ぎわ）。りくちが ない すいそうは 右の ガラス */
  get waterMaxX() { return this.land ? this.land.shore : this.W / 2; }

  /** v0.6 いけ：りくちの ばしょを きめる（build の さいしょ）。bounds.land は カメ・カエル（swim.habit 'land'）が つかう */
  setupLand(W) {
    if (this.waterType !== 'pond') { this.land = null; this.bounds.land = null; return; }
    const x0 = POND.slopeFrom * W, x1 = POND.slopeTo * W;
    this.land = { x0, x1, top: POND.landTop, shore: x1 };
    for (let x = x0; x <= x1; x += 0.05) if (this.sandHeight(x, 0) >= this.waterTop) { this.land.shore = x; break; }
    // りくちで やすむ 点（たいらな ところ）
    const spots = [];
    for (let i = 0; i < 6; i++) { const x = x1 + 0.6 + ((W / 2 - 0.8) - (x1 + 0.6)) * ((i % 3) + 0.5) / 3, z = i < 3 ? -1.2 : 1.0; spots.push({ x, z }); }
    this.bounds.land = { x0, x1, shore: this.land.shore, xMax: W / 2 - 0.5, waterTop: this.waterTop, spots };
  }

  /** v0.6 いけ：底の 色（水の 中＝どろ、水ぎわ＝ぬれた 土、うえ＝土と 草） */
  landColor(x, z, y) {
    const wt = this.waterTop, c = this.colors.sand.clone();
    if (y < wt - 0.35) return c;
    if (y < wt + 0.12) return c.lerp(LAND_COL.wet, clamp((y - (wt - 0.35)) / 0.35, 0, 1));
    const gk = clamp(clamp((y - (wt + 0.12)) / 0.3, 0, 1) * (0.7 + vnoise(x * 1.3, z * 1.3) * 0.6), 0, 1);
    return LAND_COL.soil.clone().lerp(LAND_COL.g1.clone().lerp(LAND_COL.g2, vnoise(x * 2.1 + 5, z * 2.1)), gk);
  }

  /** v0.6 いけ：りくちの 草・小石・やすむ 石（飾りでは ない。いけの すいそうに いつも ある） */
  buildLandDeco() {
    if (this.landDeco) { this.scene.remove(this.landDeco); this.landDeco.traverse((o) => { o.geometry?.dispose(); if (o.material && !o.material.userData.shared) o.material.dispose(); }); this.landDeco = null; }
    if (!this.land) return;
    const g = new THREE.Group();
    const L = this.land, W = this.W;
    const R = rng(808);
    // 草むら（奥と はし。まんなか手前は カメが よく 見えるように あける）
    const tufts = [[0.82, -2.6], [0.55, -2.8], [0.95, -0.4], [0.3, -2.2], [0.7, 2.4]];
    tufts.forEach(([f, z], i) => { const x = L.x1 + (W / 2 - 0.5 - L.x1) * f; g.add(this.makeBlades(x, z, 900 + i, { blades: 10, hMin: 0.6, hMax: 1.6 + R() * 0.6, w: 0.13, spread: 0.7, cA: '#4f8f2f', cB: '#a6d65a', sway: 0.6 })); });
    // 水ぎわの 小石（りくちの ふち。さかの とちゅうには おかない）
    for (let i = 0; i < 3; i++) g.add(this.makeStones(L.x1 + 0.4 + i * 0.9, -1.6 + i * 1.3, 820 + i, true));
    // やすむ ための ひらたい 石（りくちの まんなか）
    const flat = new THREE.Mesh(this.rockGeometry(840, 0.9, 0.35), new THREE.MeshLambertMaterial({ color: '#9b9488', flatShading: true }));
    const fx = L.x1 + (W / 2 - L.x1) * 0.45;
    flat.position.set(fx, this.sandHeight(fx, 0.2) + 0.05, 0.2);
    g.add(flat);
    this.landDeco = g;
    this.scene.add(g);
  }

  /** 砂と石・ライブロックの上の高さ（貝・はりつく魚用）。 */
  groundHeight(x, z) {
    let y = this.sandHeight(x, z);
    for (const r of this.rocks) {
      const u = (x - r.x) / r.rx, v = (z - r.z) / r.rz;
      const q = 1 - u * u - v * v;
      if (q > 0) y = Math.max(y, r.base + (r.top - r.base) * Math.sqrt(q));
    }
    return y;
  }

  /** 横幅 W で水槽を作りなおす（画面の縦横比が変わったとき）。 */
  build(W) {
    this.W = W;
    for (const c of [...this.group.children]) { this.group.remove(c); c.geometry?.dispose(); if (c.material && !c.material.userData.shared) c.material.dispose(); }
    const H = TANK_H, D = TANK_D, col = this.colors;
    const b = this.bounds;
    this.uniforms.uHalfW.value = W / 2;
    this.setupLand(W);
    this.uniforms.uWaterTop.value = this.land ? this.waterTop : 99;
    b.minX = -W / 2 + 0.35; b.maxX = (this.land ? this.land.x0 - 0.15 : W / 2) - 0.35;   // v0.6 いけ：ふつうの 魚は さかの てまえまで b.minZ = -D / 2 + 0.9; b.maxZ = D / 2 - 0.7;

    // 奥と横の壁（水の色のグラデーション）
    const wallTex = gradientTexture(4, 256, [[0, '#' + col.top.getHexString()], [0.45, '#' + col.mid.getHexString()], [1, '#' + col.deep.getHexString()]]);
    wallTex.colorSpace = THREE.SRGBColorSpace;
    const wallMat = new THREE.MeshBasicMaterial({ map: wallTex, fog: true });
    this.wallMat = wallMat;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
    back.position.set(0, H / 2, -D / 2);
    const sideMat = wallMat.clone(); sideMat.color = new THREE.Color(0.85, 0.9, 0.92); this.sideMat = sideMat;
    const left = new THREE.Mesh(new THREE.PlaneGeometry(D, H), sideMat);
    left.rotation.y = Math.PI / 2; left.position.set(-W / 2, H / 2, 0);
    const right = new THREE.Mesh(new THREE.PlaneGeometry(D, H), sideMat);
    right.rotation.y = -Math.PI / 2; right.position.set(W / 2, H / 2, 0);
    this.group.add(back, left, right);

    // 底砂
    const sx = Math.ceil(W * 4), sz = 28;
    const sg = new THREE.PlaneGeometry(W, D, sx, sz);
    sg.rotateX(-Math.PI / 2);
    const p = sg.attributes.position;
    const sc = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, this.sandHeight(x, z));
      const n = 0.9 + hash2(x * 13.1, z * 7.7) * 0.2;
      sc[i * 3] = col.sand.r * n; sc[i * 3 + 1] = col.sand.g * n; sc[i * 3 + 2] = col.sand.b * n;
      if (this.land) { const c = this.landColor(x, z, p.getY(i)).multiplyScalar(n); sc[i * 3] = c.r; sc[i * 3 + 1] = c.g; sc[i * 3 + 2] = c.b; }
    }
    sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    sg.computeVertexNormals();
    const sandMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const U = this.uniforms;
    sandMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWp; uniform float uTime; uniform sampler2D uCaustic; uniform float uCausticAmt; uniform float uLight; uniform float uHalfW; uniform float uGrain; uniform float uWaterTop;
        float sgrain(vec2 p){ return fract(sin(dot(floor(p), vec2(12.9898,78.233))) * 43758.5453); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float gr = sgrain(vWp.xz * uGrain) * 0.5 + sgrain(vWp.xz * uGrain * 0.45 + 3.1) * 0.5;
          diffuseColor.rgb *= 0.86 + gr * 0.22;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          vec2 cu = vWp.xz * 0.16;
          float c1 = texture2D(uCaustic, cu + vec2(uTime * 0.021, uTime * 0.013)).r;
          float c2 = texture2D(uCaustic, cu * 1.31 + vec2(-uTime * 0.017, uTime * 0.019) + 0.37).r;
          float cc = (min(c1, c2) * 1.3 + c1 * c2 * 0.9) * smoothstep(0.0, 1.6, uHalfW - abs(vWp.x)) * smoothstep(0.0, 1.2, 3.5 - abs(vWp.z)) * step(vWp.y, uWaterTop);
          totalEmissiveRadiance += vec3(0.85, 1.0, 0.95) * cc * uCausticAmt;`);
    };
    const sand = new THREE.Mesh(sg, sandMat);
    this.group.add(sand);

    // 砂の断面（手前のガラス越しに見える層）
    const fg = new THREE.PlaneGeometry(W, 1, sx, 1);
    const fp = fg.attributes.position;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i); fp.setY(i, fp.getY(i) > 0 ? this.sandHeight(x, D / 2) : 0); }
    const strata = this.land ? landStrataTexture(this.land.top + 0.35, this.waterTop) : gradientTexture(4, 64, [[0, '#' + col.sand.clone().multiplyScalar(0.95).getHexString()], [0.5, '#' + col.sand.clone().multiplyScalar(0.78).getHexString()], [1, '#' + col.sand.clone().multiplyScalar(0.55).getHexString()]]);
    strata.colorSpace = THREE.SRGBColorSpace;
    const front = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: strata, fog: false }));
    front.position.set(0, 0, D / 2 - 0.02);
    // UV を高さにあわせる
    for (let i = 0; i < fp.count; i++) fg.attributes.uv.setY(i, fp.getY(i) / (this.land ? this.land.top + 0.35 : 1.2));
    this.group.add(front);

    // 水面（下から見たゆらぎ）
    const surfMat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uCaustic: U.uCaustic, uLight: U.uLight, uTop: { value: col.top.clone() } },
      vertexShader: `varying vec3 vWp; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `varying vec3 vWp; uniform float uTime; uniform sampler2D uCaustic; uniform float uLight; uniform vec3 uTop;
        void main(){
          vec2 p = vWp.xz * 0.12;
          float a = texture2D(uCaustic, p + vec2(uTime*0.03, uTime*0.02)).r;
          float b = texture2D(uCaustic, p*0.7 + vec2(-uTime*0.025, uTime*0.03)).r;
          float s = a * 0.6 + b * 0.6;
          vec3 c = mix(uTop * 0.82, vec3(0.95, 1.0, 1.0), smoothstep(0.15, 1.1, s) * 0.45);
          gl_FragColor = vec4(c * (0.5 + 0.5 * uLight), 0.9);
          #include <colorspace_fragment>
        }`,
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
    });
    const wW = this.waterMaxX + W / 2 + (this.land ? 0.4 : 0), wC = -W / 2 + wW / 2;   // v0.6 いけ：水の ある はば
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(wW, D), surfMat);
    surf.rotation.x = Math.PI / 2;
    surf.position.set(wC, this.waterTop, 0);
    surf.renderOrder = 1;
    this.group.add(surf);

    // 水面より上（ふたの裏）
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ color: 0x3d4c55, fog: false }));
    lid.rotation.x = Math.PI / 2; lid.position.y = H - 0.01;
    const air = new THREE.Mesh(new THREE.PlaneGeometry(W, H - this.waterTop), new THREE.MeshBasicMaterial({ color: 0xcfe9ee, fog: false }));
    air.position.set(0, (H + this.waterTop) / 2, -D / 2 + 0.01);
    this.group.add(lid, air);

    // 光の筋
    this.rays = [];
    const rr = rng(11);
    for (let i = 0; i < 6; i++) {
      const w = 1.0 + rr() * 2.2;
      const m = new THREE.MeshBasicMaterial({ map: this.rayTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.1, color: 0xeafff8 });
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(w, this.waterTop - 0.6), m);
      ray.position.set(wC + (rr() - 0.5) * wW * 0.9, (this.waterTop + 0.6) / 2, -D / 2 + 0.6 + rr() * (D - 1.8));
      ray.rotation.z = -0.12 + rr() * 0.08;
      ray.userData = { x0: ray.position.x, ph: rr() * 6, base: 0.04 + rr() * 0.06 };
      ray.renderOrder = 4;
      this.rays.push(ray);
      this.group.add(ray);
    }

    // ガラスの縁
    const frameMat = new THREE.MeshBasicMaterial({ color: 0x1d2a30, fog: false });
    const fz = D / 2 + 0.01;
    const topBar = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.22), frameMat); topBar.position.set(0, H - 0.11, fz);
    const botBar = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.16), frameMat); botBar.position.set(0, 0.08, fz);
    const lBar = new THREE.Mesh(new THREE.PlaneGeometry(0.1, H), frameMat); lBar.position.set(-W / 2 + 0.05, H / 2, fz);
    const rBar = new THREE.Mesh(new THREE.PlaneGeometry(0.1, H), frameMat); rBar.position.set(W / 2 - 0.05, H / 2, fz);
    for (const m of [topBar, botBar, lBar, rBar]) m.renderOrder = 12;
    this.group.add(topBar, botBar, lBar, rBar);
    // 奥のかどのシリコン（明るい線）と水面のきわ
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xdff8f4, transparent: true, opacity: 0.35, fog: true, depthWrite: false });
    for (const sx2 of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.PlaneGeometry(0.06, H), edgeMat);
      e.position.set(sx2 * (W / 2 - 0.04), H / 2, -D / 2 + 0.03);
      this.group.add(e);
    }
    const menMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, fog: false, depthWrite: false });
    const men = new THREE.Mesh(new THREE.PlaneGeometry(wW, 0.06), menMat); men.position.set(wC, this.waterTop, fz - 0.005); men.renderOrder = 11;
    this.group.add(men);
    // ガラスの映りこみ（うすい斜めの光）
    const glare = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({
      map: gradientTexture(256, 4, [[0, 'rgba(255,255,255,0)'], [0.62, 'rgba(255,255,255,0)'], [0.7, 'rgba(255,255,255,0.07)'], [0.76, 'rgba(255,255,255,0.02)'], [0.8, 'rgba(255,255,255,0.06)'], [0.86, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']], false),
      transparent: true, depthWrite: false, depthTest: false, fog: false }));
    glare.position.set(0, H / 2, fz + 0.005); glare.renderOrder = 11;
    this.group.add(glare);
    // にごり（手前に一枚かぶせる）
    this.murk = new THREE.Mesh(new THREE.PlaneGeometry(wW, this.waterTop), new THREE.MeshBasicMaterial({ color: MURK, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false }));
    this.murk.position.set(wC, this.waterTop / 2, D / 2 - 0.05); this.murk.renderOrder = 9;
    this.group.add(this.murk);

    // 浮遊物の位置
    const mp = this.motes.geometry.attributes.position;
    for (let i = 0; i < this.moteCount; i++) { const ph = this.motePh[i]; mp.setXYZ(i, wC + (ph[0] - 0.5) * wW, 1 + ph[1] * (this.waterTop - 1.4), (ph[2] - 0.5) * D); }
    mp.needsUpdate = true;

    this.setDecor(this.decorIds, true);
    this.buildDirt();
    this.applyWater();
  }

  /** 底のごみを置きなおす（まんなかの帯 z=-0.5〜0.5 にならべる。手前すぎるとボタンにかくれる）。 */
  buildDirt() {
    for (const d of this.dirtPatches) { this.scene.remove(d.mesh); d.mesh.geometry.dispose(); }
    this.dirtPatches = [];
    const R = rng(55), W = this.W;
    const N = 9;
    for (let i = 0; i < N; i++) {
      let x = (-0.4 + (0.8 * (i + 0.2 + R() * 0.6)) / N) * W;
      if (this.land) { const a = -W / 2 + 0.9, b2 = this.land.x0 - 0.6; x = a + ((x / W) + 0.4) / 0.8 * (b2 - a); }   // v0.6 いけ：水の 底だけ
      const z = -0.5 + R() * 1.0;
      const sz = 0.7 + R() * 0.35;
      const g = new THREE.PlaneGeometry(sz, sz);
      const m = new THREE.Mesh(g, this.dirtMat);
      m.rotation.set(-Math.PI / 2 + 0.55, 0, R() * 6);   // 少し手前に起こして見やすく
      const y = this.sandHeight(x, z) + 0.06;
      m.position.set(x, y, z);
      m.renderOrder = 1;
      m.visible = false;
      this.scene.add(m);
      this.dirtPatches.push({ mesh: m, x, y, z, order: R(), caught: false });
    }
    // 出る順番（にごりが少ないときは ちらほら）
    this.dirtPatches.sort((a, b) => a.order - b.order);
  }

  /** ごみの数を変える（waste を もらったら それで。ないときは にごりに合わせる）。 */
  updateDirtPatches() {
    const w = this.water.waste;
    const d = w ?? (this.dirtShown ?? this.water.dirt);
    const n = w !== undefined ? Math.round(w * this.dirtPatches.length) : Math.round(d * this.dirtPatches.length * 1.1);
    const cleaned = this.cleanedPatches && (this.time < this.cleanedUntil || (w === undefined && d > this.water.dirt + 0.01)) ? this.cleanedPatches : null;
    if (!cleaned) this.cleanedPatches = null;
    this.dirtPatches.forEach((p, i) => {
      if (p.caught) return;   // あみの中のものは そうじ係が動かす
      p.mesh.visible = i < n && !(cleaned && cleaned.includes(p));   // すくったごみは にごりが下がりきるまで出さない
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.scale.setScalar(1);
    });
  }

  // ---------------- 飾り・器具 ----------------
  setDecor(ids, force = false) {
    ids = Array.isArray(ids) ? ids.slice() : [];
    if (!force && ids.join('|') === this.decorIds.join('|')) return;
    this.decorIds = ids;
    for (const c of [...this.decorGroup.children]) { this.decorGroup.remove(c); c.traverse((o) => { o.geometry?.dispose(); if (o.material && !o.material.userData.shared) o.material.dispose(); }); }
    this.emitters = [];
    this.swayMats = [];
    this.heaterGlow = null;
    this.feeder = null; this.fanBlades = null; this.robot = null;
    // v0.6 いけ：飾りは 水の ある ところ（りくちの てまえ）に ちぢめて ならべる。W と sandHeight を 水の はばで かりに かえて つくり、あとで ずらす
    const realW = this.W, pond = !!this.land;
    let dOff = 0;
    if (pond) {
      const Ww = this.land.x0 - 0.5 + realW / 2;
      dOff = -realW / 2 + Ww / 2;
      this.W = Ww;
      const base = Tank.prototype.sandHeight.bind(this);
      this.sandHeight = (x, z) => base(x + dOff, z);
    }
    const W = this.W, D = TANK_D;
    const used = {};
    const restFrom = [];
    const rockFrom = [], coralFrom = [], woodFrom = [];
    const extra = { rest: [], coral: [], cling: [] };   // v0.5：せの たかい 飾りが もつ、まんなかの たかさの 点
    const builders = {
      stone: (i) => this.makeStones(i === 0 ? -0.24 * W : 0.12 * W, -1.2 - i * 0.6, 21 + i),
      rock: (i) => this.makeStones(0.1 * W, -1.5, 31 + i),
      plant: (i) => { const s = [[-0.4, -2.5], [0.33, -2.6], [-0.08, -2.7], [0.42, -1.3]][i % 4]; return this.makePlant(s[0] * W, s[1], 5 + i); },
      driftwood: () => this.makeDriftwood(0.02 * W, -1.9),
      liverock: (i) => this.makeLiverock([0.16, -0.26, 0.36][i % 3] * W, [-1.6, -1.9, -2.2][i % 3], i),
      coral: (i) => this.makeCoral([-0.3, 0.05, 0.38][i % 3] * W, [-1.3, -2.4, -1.0][i % 3], i),
      // v0.4 の飾り（置き場所は Codex と agy の案を くらべて きめた。ほかの飾りと 重ならない ように）
      seaweed: (i) => { const s = [[-0.32, -2.85], [0.16, -2.85], [-0.16, -2.9], [0.39, -2.9]][i % 4]; return this.makeSeaweed(s[0] * W, s[1], 61 + i); },
      anemone: (i) => this.makeAnemone(-0.11 * W, -1.45, i),
      shell: (i) => this.makeShell([-0.24, 0.17][i % 2] * W, [-0.55, -0.5][i % 2], i),
      coral_stone: (i) => this.makeCoralStone([-0.4, 0.23][i % 2] * W, [-1.8, -1.25][i % 2], i),
      color_stone: (i) => this.makeColorStones([-0.35, 0.07][i % 2] * W, [-0.95, -0.85][i % 2], i),
      pot: () => this.makePot(0.33 * W, -1.05),
      // v0.5：せの たかい 飾り・器具（奥か はしに おいて、さかなを かくしすぎない）
      ukikusa: (i) => this.makeUkikusa([-0.2, 0.12][i % 2] * W, [-2.2, -1.7][i % 2], i),
      sponge_filter: () => this.makeSpongeFilter(-0.27 * W, -2.95),
      coral_tree: (i) => this.makeCoralTree(-0.09 * W, -3.0, i),
      filter_tower: () => this.makeFilterTower(0.19 * W, -3.0),
      air_pump: () => this.makeAirStone(0.27 * W, -2.5),
      air: () => this.makeAirStone(0.27 * W, -2.5),
      heater: () => this.makeHeater(-0.44 * W, -D / 2 + 0.35),
      filter: () => this.makeFilter(0.45 * W, -D / 2 + 0.45),
      light: () => this.makeLight(),
      auto_feeder: () => this.makeAutoFeeder(-0.3 * W),
      fan: () => this.makeFan(0.3 * W),
      co2_kit: () => this.makeCo2(-0.36 * W, -2.4),
      skimmer: () => (this.waterType === 'salt' ? this.makeSkimmer(-0.45 * W, -D / 2 + 0.5) : null),
      clean_robot: () => this.makeCleanRobot(-0.12 * W, 0.3),   // v0.6：そこの ごみの 帯の 手前がわ（z 0.15〜0.5、飾りの ない 通り道）を うごく
    };
    for (const id of ids) {
      const n = used[id] = (used[id] ?? -1) + 1;
      const fn = builders[id];
      let obj = fn ? fn(n) : this.makeStones((((n * 37 + id.length * 13) % 10) / 10 - 0.5) * 0.7 * W, -1.4, id.length * 7 + n, true);
      if (obj) {
        this.decorGroup.add(obj);
        if (['stone', 'rock', 'plant', 'driftwood', 'liverock', 'coral', 'seaweed', 'coral_stone', 'color_stone', 'pot'].includes(id) || !fn) restFrom.push(obj);
        if (['stone', 'rock', 'liverock', 'coral_stone', 'color_stone', 'pot'].includes(id) || !fn) rockFrom.push(obj);
        if (id === 'coral' || id === 'liverock' || id === 'anemone') coralFrom.push(obj);
        if (id === 'anemone') coralFrom.push(obj);   // イソギンチャクは 2回 入れて、クマノミが よく よる ように
        if (id === 'driftwood') woodFrom.push(obj);
        const sp = obj.userData.spots;
        if (sp) for (const k of ['rest', 'coral', 'cling']) if (sp[k]) extra[k].push(...sp[k]);
      }
    }
    if (pond) {
      this.W = realW;
      delete this.sandHeight;
      for (const e of this.emitters) e.x += dOff;
      for (const k of ['rest', 'coral', 'cling']) for (const sp of extra[k]) sp.x += dOff;
      if (this.feeder) this.feeder.x += dOff;
    }
    this.decorGroup.position.x = dOff;
    this.decorGroup.updateMatrixWorld(true);
    this.buildLandDeco();
    // 休む場所（石・水草・流木の手前、底から少し上）
    const spots = [];
    for (const o of restFrom) {
      const bx = new THREE.Box3().setFromObject(o);
      const cx = (bx.min.x + bx.max.x) / 2;
      const z = Math.min(bx.max.z + 0.6, this.bounds.maxZ - 0.3);
      const sand = this.sandHeight(cx, z);
      spots.push({ x: cx, z, y: sand + clamp((bx.max.y - sand) * 0.5, 0.9, 2.2) });
    }
    spots.push(...extra.rest);
    if (!spots.length) for (const fx of [-0.3, 0.3]) spots.push({ x: fx * W + dOff, z: -0.5, y: this.sandHeight(fx * W + dOff, -0.5) + 1.3 });
    this.bounds.restSpots = spots;
    // 石の上の高さ（貝が上を這う）
    this.rocks = [];
    for (const g of rockFrom) for (const m of g.children) {
      if (!m.isMesh || m.userData.noGround) continue;
      const bx = new THREE.Box3().setFromObject(m);
      this.rocks.push({ x: (bx.min.x + bx.max.x) / 2, z: (bx.min.z + bx.max.z) / 2, rx: (bx.max.x - bx.min.x) * 0.45, rz: (bx.max.z - bx.min.z) * 0.45, top: bx.max.y, base: this.sandHeight((bx.min.x + bx.max.x) / 2, (bx.min.z + bx.max.z) / 2) });
    }
    this.bounds.rocks = this.rocks;
    // サンゴ・ライブロックのそば（クマノミがいる場所）
    this.bounds.coralSpots = coralFrom.map((o) => { const bx = new THREE.Box3().setFromObject(o); return { x: (bx.min.x + bx.max.x) / 2, y: bx.max.y, z: Math.min(bx.max.z + 0.3, this.bounds.maxZ - 0.3) }; });
    this.bounds.coralSpots.push(...extra.coral);
    // はりつく場所（奥のガラス・流木の手前・石の上）
    const cs = [];
    const gz = this.bounds.glassZ;
    for (let i = 0; i < 6; i++) { const x = (-0.38 + i * 0.15) * W + dOff; cs.push({ x, y: this.sandHeight(x, gz) + 0.9 + (i % 3) * 1.1, z: gz, glass: true }); }
    for (const o of woodFrom) { const bx = new THREE.Box3().setFromObject(o); for (const f of [0.3, 0.6]) cs.push({ x: bx.min.x + (bx.max.x - bx.min.x) * f, y: bx.min.y + (bx.max.y - bx.min.y) * 0.35, z: Math.min(bx.max.z, this.bounds.maxZ - 0.3) }); }
    for (const r of this.rocks) if (r.top - r.base > 0.4) cs.push({ x: r.x, y: r.top + 0.12, z: r.z + r.rz * 0.4 });
    cs.push(...extra.cling);
    this.bounds.clingSpots = cs;
    // setWater で bubbles: true なのに エアポンプが無いときは、エアストーンを自動で置く
    this.autoStone = null;
    this.applyWater();
  }

  _ensureAutoStone() {
    if (this.autoStone || this.emitters.some((e) => e.kind === 'air')) return;
    const gx = this.decorGroup.position.x;   // v0.6 いけ：飾りの グループは ずれている
    this.autoStone = this.makeAirStone((this.land ? this.land.x0 - 1.4 : 0.27 * this.W) - gx, -2.5);
    const em = this.emitters[this.emitters.length - 1];
    if (em && gx) em.x += gx;
    this.decorGroup.add(this.autoStone);
  }

  rockGeometry(seed, r = 1, flat = 0.6) {
    const g = new THREE.IcosahedronGeometry(r, 2);
    const p = g.attributes.position;
    const R = rng(seed);
    const ox = R() * 10, oz = R() * 10;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 0.78 + vnoise(x * 1.6 + ox, z * 1.6 + y * 1.3 + oz) * 0.45;
      p.setXYZ(i, x * n, Math.max(y * n * flat, -0.15 * r), z * n * 0.85);
    }
    g.computeVertexNormals();
    return g;
  }

  makeStones(x, z, seed, single = false) {
    const grp = new THREE.Group();
    const R = rng(seed);
    const cols = ['#8d8f8a', '#7b7f80', '#9b958a', '#6f7473'];
    const n = single ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const r = (single ? 0.6 : [1.0, 0.65, 0.45][i]) * (0.9 + R() * 0.2);
      const m = new THREE.Mesh(this.rockGeometry(seed * 7 + i, r, 0.62), new THREE.MeshLambertMaterial({ color: cols[i % 4], flatShading: true }));
      const px = x + (i === 0 ? 0 : (i === 1 ? 1.1 : -0.9) * (0.8 + R() * 0.3));
      const pz = z + (i === 0 ? 0 : 0.5 * (R() - 0.3));
      m.position.set(px, this.sandHeight(px, pz) + r * 0.1, pz);
      m.rotation.y = R() * 6;
      grp.add(m);
    }
    return grp;
  }

  makeLiverock(x, z, n = 0) {
    const grp = new THREE.Group();
    const R = rng(91 + n * 17);
    const tan = new THREE.Color('#c9a98a'), purple = new THREE.Color('#9a5ca8'), pink = new THREE.Color('#e3829a'), dark = new THREE.Color('#6b5248');
    const parts = [[0, 0.25, 0, 1.15, 0.8], [1.0, 0.15, 0.35, 0.8, 0.75], [-0.95, 0.1, 0.25, 0.7, 0.8], [0.25, 1.15, -0.1, 0.6, 0.85], [-0.4, 0.95, 0.2, 0.45, 0.9]];
    for (let i = 0; i < parts.length; i++) {
      const [ox, oy, oz, r, flat] = parts[i];
      const g = this.rockGeometry(200 + n * 10 + i, r, flat);
      const p = g.attributes.position;
      const col = new Float32Array(p.count * 3);
      const c = new THREE.Color();
      for (let k = 0; k < p.count; k++) {
        const vx = p.getX(k), vy = p.getY(k), vz = p.getZ(k);
        const m1 = vnoise(vx * 2.2 + i * 3, vz * 2.2 + vy * 1.7);
        const hole = vnoise(vx * 6.3 + 9, vy * 6.3 + vz * 5.1);
        c.copy(tan).lerp(purple, clamp((m1 - 0.45) * 2.5, 0, 1)).lerp(pink, clamp((vy / r - 0.3) * m1, 0, 0.5));
        if (hole > 0.72) c.lerp(dark, 0.7);   // 小さな穴
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
      const px = x + ox, pz = z + oz;
      m.position.set(px, this.sandHeight(px, pz) + oy, pz);
      m.rotation.set((R() - 0.5) * 0.6, R() * 6, (R() - 0.5) * 0.6);
      grp.add(m);
    }
    return grp;
  }

  /** サンゴ：0=えだサンゴ＋のうサンゴ、1=ウミキノコ（v0.3 までは イソギンチャク風）、2=きいろい えだサンゴ。 */
  makeCoral(x, z, n = 0) {
    const grp = new THREE.Group();
    const kind = n % 3;
    const R = rng(77 + n * 5);
    const base = this.sandHeight(x, z);
    if (kind === 1) return this.makeToadstool(x, z, n);   // v0.4：イソギンチャクは べつの 飾り（anemone）に なったので、サンゴの 2つめは ウミキノコに
    const mat = new THREE.MeshLambertMaterial({ color: kind === 0 ? '#ff7d9a' : '#ffc93a' });
    const branch = (px, py, pz, len, ang, tilt, depth) => {
      const g = new THREE.CylinderGeometry(0.05 * (depth + 1) * 0.55, 0.075 * (depth + 1) * 0.55, len, 7);
      g.translate(0, len / 2, 0);
      const m = new THREE.Mesh(g, mat);
      m.position.set(px, py, pz); m.rotation.z = ang; m.rotation.x = tilt;
      grp.add(m);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05 * (depth + 1) * 0.6, 6, 4), mat);
      tip.position.set(px - Math.sin(ang) * len, py + Math.cos(ang) * Math.cos(tilt) * len, pz + Math.sin(tilt) * len);
      grp.add(tip);
      if (depth > 0) {
        const ex = tip.position.x, ey = tip.position.y, ez = tip.position.z;
        branch(ex, ey, ez, len * 0.78, ang - 0.45 - R() * 0.2, tilt + (R() - 0.5) * 0.5, depth - 1);
        branch(ex, ey, ez, len * 0.78, ang + 0.4 + R() * 0.2, tilt + (R() - 0.5) * 0.5, depth - 1);
      }
    };
    for (let k = 0; k < 3; k++) branch(x + (k - 1) * 0.5, base - 0.05, z + (R() - 0.5) * 0.4, 0.8 + R() * 0.3, (k - 1) * 0.35, (R() - 0.5) * 0.4, 3);
    const parts = [...grp.children];
    grp.clear();
    grp.add(mergeMeshes(parts, mat));
    if (kind === 0) {
      // のうサンゴ（まるい・みぞ）
      const g = new THREE.SphereGeometry(0.75, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55);
      const p = g.attributes.position;
      const col = new Float32Array(p.count * 3);
      const c1 = new THREE.Color('#a3c25a'), c2 = new THREE.Color('#5f7d33');
      for (let k = 0; k < p.count; k++) {
        const v = Math.sin((p.getX(k) * 9 + Math.sin(p.getZ(k) * 7) * 1.5)) * 0.5 + 0.5;
        const c = c1.clone().lerp(c2, v > 0.6 ? 1 : 0);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const brain = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
      brain.position.set(x + 1.4, base - 0.1, z + 0.4); brain.scale.y = 0.8;
      grp.add(brain);
    }
    return grp;
  }

  /** ゆれる葉・触手の束（水草とイソギンチャクで共用）。 */
  makeBlades(x, z, seed, o) {
    const R = rng(seed * 13);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const U = this.uniforms;
    const sw = (o.sway || 1).toFixed(2);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aPh; attribute float aH;')
        .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
          float hh = max(aH, 0.0);
          transformed.x += sin(uTime * 0.9 * ${sw} + aPh + hh * 0.5) * 0.06 * hh * hh * 0.25 * ${sw};
          transformed.z += cos(uTime * 0.7 * ${sw} + aPh * 1.3) * 0.04 * hh * hh * 0.25 * ${sw};`);
    };
    mat.customProgramCacheKey = () => 'blades' + sw;
    const pos = [], colr = [], ph = [], hs = [], idx = [];
    const cA = new THREE.Color(o.cA), cB = new THREE.Color(o.cB);
    let vi = 0;
    for (let k = 0; k < o.blades; k++) {
      const h = o.hMin + R() * (o.hMax - o.hMin);
      const w = o.w * (0.8 + R() * 0.5);
      let bx, bz, lx, lz;
      if (o.radial) { const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * o.spread * 0.6; bx = Math.cos(a) * rr; bz = Math.sin(a) * rr * 0.7; lx = Math.cos(a) * 0.5; lz = Math.sin(a) * 0.35; }
      else { bx = (R() - 0.5) * o.spread; bz = (R() - 0.5) * o.spread * 0.8; lx = (R() - 0.5) * 0.9; lz = 0; }
      const rot0 = R() * Math.PI, p = R() * 6, segs = o.ribbon ? 12 : 8, twist = o.ribbon ? (R() - 0.5) * 2.2 : 0;
      for (let s2 = 0; s2 <= segs; s2++) {
        const t = s2 / segs, y = t * h;
        // ribbon：はばが ほぼ おなじで 先が まるい（アマモ）。すこし ねじれる
        const ww = w * (o.ribbon ? (t > 0.8 ? Math.sqrt(Math.max(0, 1 - ((t - 0.8) / 0.2) ** 2)) : 1) * (t < 0.06 ? 0.7 : 1)
          : o.radial ? (1 - t * 0.35) : (1 - t * 0.75) * (t < 0.08 ? 0.6 : 1));
        const rot = rot0 + twist * t;
        const wav = o.ribbon ? Math.sin(t * 7 + p) * 0.13 * t : 0;   // リボンの 葉は ゆるく なみうつ
        const cx = bx + lx * t * t * h * 0.3 * (o.ribbon ? 1.6 : 1) + wav, cz = bz + lz * t * t * h * 0.3;
        for (const side of [-1, 1]) {
          pos.push(cx + Math.cos(rot) * ww * side * 0.5, y, cz + Math.sin(rot) * ww * side * 0.5);
          const c = cA.clone().lerp(cB, o.radial ? Math.pow(t, 2.5) : t * 0.8 + R() * 0.1);
          colr.push(c.r, c.g, c.b); ph.push(p); hs.push(y * (o.radial ? 2.2 : 1));
        }
        if (s2 < segs) { const a2 = vi + s2 * 2; idx.push(a2, a2 + 1, a2 + 2, a2 + 1, a2 + 3, a2 + 2); }
      }
      vi += (segs + 1) * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    g.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 1));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(hs, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, o.y ?? this.sandHeight(x, z) - 0.1, z);
    return m;
  }

  makePlant(x, z, seed) {
    const grp = new THREE.Group();
    grp.add(this.makeBlades(x, z, seed, { blades: 11, hMin: 2.6, hMax: 6.0, w: 0.2, spread: 0.9, cA: '#2f7a2c', cB: '#7fcf4a' }));
    return grp;
  }

  // ---------------- v0.4 の飾り（インテリア係）----------------
  /** ゆれる材質（頂点の aPh・aH で ゆらす。makeBlades と おなじ しくみ）。 */
  swayMaterial(sway, opts = {}) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });
    const U = this.uniforms;
    const sw = sway.toFixed(2);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aPh; attribute float aH;')
        .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
          float hh = max(aH, 0.0);
          transformed.x += sin(uTime * 0.8 * ${sw} + aPh + hh * 0.6) * 0.05 * hh * hh * ${sw};
          transformed.z += cos(uTime * 0.6 * ${sw} + aPh * 1.3) * 0.035 * hh * hh * ${sw};`);
    };
    mat.customProgramCacheKey = () => 'sway' + sw;
    return mat;
  }

  /** うみくさ（アマモ風）：はばの ある 細長い リボンの 葉。ゆらゆら ゆれる。 */
  makeSeaweed(x, z, seed) {
    const grp = new THREE.Group();
    grp.add(this.makeBlades(x, z, seed, { blades: 9, hMin: 2.0, hMax: 4.2, w: 0.34, spread: 0.8, cA: '#3f7a1f', cB: '#c4de5a', ribbon: true, sway: 1.25 }));
    return grp;
  }

  /** イソギンチャク（タマイタダキ風）：ぷっくりした つつの からだ＋先が まるく ふくらむ ふとい しょくしゅ。石の台は つけない（サンゴと見分ける）。 */
  makeAnemone(x, z, n = 0) {
    const grp = new THREE.Group();
    const R = rng(611 + n * 7);
    const base = this.sandHeight(x, z);
    const bodyG = new THREE.CylinderGeometry(0.6, 0.66, 0.34, 22, 3);
    const bp = bodyG.attributes.position, bcol = new Float32Array(bp.count * 3);
    const bLo = new THREE.Color('#b8606c'), bHi = new THREE.Color('#d97a86');
    for (let i = 0; i < bp.count; i++) {
      const y = bp.getY(i); const k = 1 + 0.07 * Math.sin((y + 0.17) * 9);
      bp.setX(i, bp.getX(i) * k); bp.setZ(i, bp.getZ(i) * k);
      const c = bLo.clone().lerp(bHi, clamp(y / 0.34 + 0.5, 0, 1)); bcol[i * 3] = c.r; bcol[i * 3 + 1] = c.g; bcol[i * 3 + 2] = c.b;
    }
    bodyG.setAttribute('color', new THREE.BufferAttribute(bcol, 3));
    bodyG.computeVertexNormals();
    const body = new THREE.Mesh(bodyG, new THREE.MeshLambertMaterial({ vertexColors: true }));
    body.position.set(x, base + 0.1, z); body.userData.noGround = true;
    grp.add(body);
    // しょくしゅ（1つの メッシュに まとめて、頂点で ゆらす）
    const cRoot = new THREE.Color('#d2707c'), cMid = new THREE.Color('#f08aa8'), cTip = new THREE.Color('#ffc4d8');
    const pos = [], nor = [], col = [], ph = [], hs = [];
    let p0x = 0, p0z = 0;
    const add = (g, phase, y0, len) => {
      const ng = g.index ? g.toNonIndexed() : g;   // 法線は もとの（なめらかな）ものを つかう
      const p = ng.attributes.position, q = ng.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const t = clamp(Math.hypot(p.getX(i) - p0x, y - y0, p.getZ(i) - p0z) / len, 0, 1);
        const c = t < 0.6 ? cRoot.clone().lerp(cMid, t / 0.6) : cMid.clone().lerp(cTip, (t - 0.6) / 0.4);
        pos.push(p.getX(i), y, p.getZ(i)); nor.push(q.getX(i), q.getY(i), q.getZ(i)); col.push(c.r, c.g, c.b);
        ph.push(phase); hs.push(t * 1.6);
      }
      g.dispose(); if (ng !== g) ng.dispose();
    };
    const top = 0.3;
    const rings = [[9, 0.12, 0.85, 0.25], [16, 0.36, 0.95, 0.85], [24, 0.58, 0.9, 1.7]];   // かず・ねもとの はんけい・ながさ・そとへの かたむき
    rings.forEach(([cnt, rr0, len0, lean0], ri) => {
      for (let k = 0; k < cnt; k++) {
        const a = (k / cnt) * Math.PI * 2 + ri * 0.37 + (R() - 0.5) * 0.25;
        const rr = rr0 + (R() - 0.5) * 0.06;
        const len = len0 * (0.85 + R() * 0.3);
        const lean = lean0 * (0.85 + R() * 0.3);
        const p0 = new THREE.Vector3(Math.cos(a) * rr, top, Math.sin(a) * rr);
        const dir = new THREE.Vector3(Math.cos(a) * lean, 1, Math.sin(a) * lean).normalize();
        const p1 = p0.clone().addScaledVector(dir, len * 0.5).add(new THREE.Vector3(0, 0.08, 0));
        const p2 = p0.clone().addScaledVector(dir, len).add(new THREE.Vector3(Math.cos(a) * 0.08, -0.16 * ri, Math.sin(a) * 0.08));
        p0x = p0.x; p0z = p0.z;
        const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, p1, p2]), 5, 0.085, 6, false);
        const phase = R() * 6;
        add(tg, phase, top, len);
        const bulb = new THREE.SphereGeometry(0.12, 10, 8);
        bulb.scale(1, 1.15, 1); bulb.translate(p2.x, p2.y, p2.z);
        add(bulb, phase, top, len);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 1));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(hs, 1));
    const ten = new THREE.Mesh(g, this.swayMaterial(0.9));
    ten.position.set(x, base + 0.1, z); ten.userData.noGround = true;
    grp.add(ten);
    return grp;
  }

  /** かいがら：0=ホタテの かたほう、1=まきがい。 */
  makeShell(x, z, n = 0) {
    const grp = new THREE.Group();
    const base = this.sandHeight(x, z);
    const cream = new THREE.Color('#f6e7d2');
    if (n % 2 === 0) {
      const NU = 26, NV = 10, S = 0.62;
      const pos = [], col = [], idx = [];
      const pink = new THREE.Color('#f29a9c');
      for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
        const th = -1.2 + (2.4 * i) / NU, r = (j / NV) * S, v = j / NV;
        const y = 0.2 * (1 - v * v) + 0.04 * Math.cos(th * 15) * v + (v > 0.9 ? 0.04 : 0);
        pos.push(Math.sin(th) * r, y, Math.cos(th) * r);
        const c = cream.clone().lerp(pink, 0.35 + 0.35 * Math.sin(v * 9)).multiplyScalar(0.93 + 0.07 * Math.cos(th * 15));
        col.push(c.r, c.g, c.b);
        if (i < NU && j < NV) { const a = j * (NU + 1) + i; idx.push(a, a + NU + 1, a + 1, a + 1, a + NU + 1, a + NU + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx); g.computeVertexNormals();
      const fan = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.12), new THREE.MeshLambertMaterial({ color: '#efcdbf' }));
      ear.position.set(0, 0.16, 0.02);
      const sh = new THREE.Group(); sh.add(fan, ear);
      sh.scale.setScalar(1.5);
      sh.position.set(x, base + 0.06, z); sh.rotation.set(0.62, 0.5, 0);   // ちょうつがいを おくに、すこし 手前に おこす
      grp.add(sh);
    } else {
      // まきがい（らせんの 管を 手続きで）
      const NU = 90, NV = 12, T = 3.4, K = 2.3;
      const pos = [], col = [], idx = [];
      const band = new THREE.Color('#c98d6b');
      for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
        const u = i / NU, v = (j / NV) * Math.PI * 2;
        const gr = Math.exp(K * (u - 1)), th = u * T * Math.PI * 2;
        const Rc = 0.2 * gr, rho = 0.19 * gr;
        pos.push((Rc + rho * Math.cos(v)) * Math.cos(th), 0.62 * (1 - gr) + rho * Math.sin(v) * 1.1, (Rc + rho * Math.cos(v)) * Math.sin(th));
        const c = cream.clone().lerp(band, clamp(Math.sin(v * 2 + 0.6) * 0.8, 0, 0.6));
        col.push(c.r, c.g, c.b);
        if (i < NU && j < NV) { const a = i * (NV + 1) + j; idx.push(a, a + 1, a + NV + 1, a + 1, a + NV + 2, a + NV + 1); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      m.scale.setScalar(1.15);
      m.position.set(x, base + 0.12, z); m.rotation.set(0.2, 2.2, 1.25);   // よこに ねかせる
      grp.add(m);
    }
    return grp;
  }

  /** サンゴいし：Y字に えだわかれした しろい サンゴの かけら＋小さな かたまり。穴は あけない。 */
  makeCoralStone(x, z, n = 0) {
    const grp = new THREE.Group();
    const R = rng(733 + n * 11);
    const mat = new THREE.MeshLambertMaterial({ color: '#e9dcc3' });
    const ivory = new THREE.Color('#ede2cc'), shade = new THREE.Color('#cdb994');
    const lumpG = new THREE.IcosahedronGeometry(0.5, 4);
    { const p = lumpG.attributes.position, ox = n * 3.1;
      for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i); const f = 0.82 + vnoise(vx * 1.8 + ox, vz * 1.8 + vy * 1.4) * 0.3 + vnoise(vx * 4 + 7, vy * 4 + vz * 3) * 0.06; p.setXYZ(i, vx * f * 1.15, Math.max(vy * f * 0.62, -0.1), vz * f * 0.85); }
      lumpG.computeVertexNormals(); }
    const lp = lumpG.attributes.position, lc = new Float32Array(lp.count * 3);
    for (let i = 0; i < lp.count; i++) { const c = ivory.clone().lerp(shade, clamp(vnoise(lp.getX(i) * 3 + 5, lp.getZ(i) * 3 + lp.getY(i) * 2) - 0.35, 0, 0.7)); lc[i * 3] = c.r; lc[i * 3 + 1] = c.g; lc[i * 3 + 2] = c.b; }
    lumpG.setAttribute('color', new THREE.BufferAttribute(lc, 3));
    const lump = new THREE.Mesh(lumpG, new THREE.MeshLambertMaterial({ vertexColors: true }));
    lump.position.set(x - 0.7, this.sandHeight(x - 0.7, z) + 0.03, z - 0.15); lump.rotation.y = R() * 6;
    grp.add(lump);
    // Y字の えだの かけら（アイコンと おなじ かたち。でこぼこは ゆるく、穴は あけない）
    const knob = (r, len, seed) => {
      const g = new THREE.CapsuleGeometry(r, len, 5, 10);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const f = 1 + (vnoise(p.getY(i) * 3.5 + seed, p.getX(i) * 3 + p.getZ(i) * 3) - 0.5) * 0.3; p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); }
      g.computeVertexNormals();
      g.translate(0, len / 2 + r * 0.6, 0);   // ねもとを 原点に
      return new THREE.Mesh(g, mat);
    };
    const piece = new THREE.Group();
    const stem = knob(0.19, 1.0, n * 5 + 1); stem.rotation.z = -Math.PI / 2 + 0.12; piece.add(stem);   // +x へ ねかせる
    const tipX = 1.15;
    for (const [ang, len, up] of [[0.65, 0.6, 0.55], [-0.55, 0.75, 0.4]]) {
      const br = knob(0.16, len, n * 5 + 2 + ang);
      br.position.set(tipX * 0.82, 0.08, 0);
      br.rotation.set(0, ang, -Math.PI / 2 + up, 'YXZ');
      br.userData.noGround = true;
      piece.add(br);
    }
    const side = knob(0.14, 0.45, n * 5 + 4); side.position.set(0.35, 0.05, 0); side.rotation.set(0, -1.6, -Math.PI / 2 + 0.9, 'YXZ'); side.userData.noGround = true;
    piece.add(side);
    const px = x + 0.35, pz = z + 0.45;
    piece.position.set(px - 0.6, this.sandHeight(px, pz) + 0.12, pz);
    piece.rotation.y = n ? 2.6 : 0.35;
    grp.add(piece);
    return grp;
  }

  /** いろいし：ひらたく ふぞろいな 小石の よせいし（くすんだ パステル・つやは ひかえめ。お菓子に 見えない ように）。 */
  makeColorStones(x, z, n = 0) {
    const grp = new THREE.Group();
    const R = rng(911 + n * 13);
    const cols = n % 2 ? ['#93aebf', '#c9a465', '#e6e0d2', '#c08c90', '#93b3a0'] : ['#c08c90', '#93b3a0', '#c9a465', '#a59bbd', '#e6e0d2'];
    const place = [[0, 0, 0.36], [0.55, 0.15, 0.27], [-0.5, 0.2, 0.3], [0.2, 0.5, 0.24], [-0.15, -0.35, 0.22]];
    place.forEach(([ox, oz, r], i) => {
      const g = new THREE.SphereGeometry(r, 18, 12);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const f = 1 + (vnoise(p.getX(k) * 1.6 / r + i * 3, p.getZ(k) * 1.6 / r + p.getY(k)) - 0.5) * 0.32; p.setXYZ(k, p.getX(k) * f * (1.1 + i * 0.04), p.getY(k) * f * 0.5, p.getZ(k) * f * 0.85); }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: cols[i], shininess: 18, specular: 0x161616 }));
      const px = x + ox, pz = z + oz;
      m.position.set(px, this.sandHeight(px, pz) + r * 0.32, pz);
      m.rotation.y = R() * 6;
      grp.add(m);
    });
    return grp;
  }

  /** つぼ：よこだおしの すやきの つぼ（かくれが）。口は 手前の まんなかへ むける。中は あたたかい こげちゃ。 */
  makePot(x, z) {
    const grp = new THREE.Group();
    const prof = [[0.02, 0], [0.32, 0.03], [0.56, 0.16], [0.7, 0.4], [0.74, 0.7], [0.7, 1.0], [0.58, 1.24], [0.47, 1.4], [0.43, 1.5], [0.45, 1.6]];
    const outerG = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y - 0.8)), 28);
    const op = outerG.attributes.position, oc = new Float32Array(op.count * 3);
    const terra = new THREE.Color('#d0692f'), pale = new THREE.Color('#e7a77c');
    for (let i = 0; i < op.count; i++) { const c = terra.clone().lerp(pale, clamp((vnoise(op.getX(i) * 2.5 + 3, op.getY(i) * 2.5 + op.getZ(i) * 2) - 0.55) * 1.6, 0, 0.55)); oc[i * 3] = c.r; oc[i * 3 + 1] = c.g; oc[i * 3 + 2] = c.b; }
    outerG.setAttribute('color', new THREE.BufferAttribute(oc, 3));
    const outer = new THREE.Mesh(outerG, new THREE.MeshLambertMaterial({ vertexColors: true }));
    const innerG = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(0.01, r - 0.07), Math.min(y, 1.58) - 0.8)), 28);
    const inner = new THREE.Mesh(innerG, new THREE.MeshLambertMaterial({ color: '#6e4029', side: THREE.DoubleSide }));
    inner.userData.noGround = true;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 28), new THREE.MeshLambertMaterial({ color: '#c8622c' }));
    lip.rotation.x = Math.PI / 2; lip.position.y = 0.8; lip.userData.noGround = true;
    const pot = new THREE.Group(); pot.add(outer, inner, lip);
    const yaw = Math.atan2(-x, 6);   // 口を 手前の まんなかへ
    pot.rotation.set(Math.PI / 2 - 0.12, yaw, 0, 'YXZ');
    const s = 1.05;
    pot.scale.setScalar(s);
    pot.position.set(x, this.sandHeight(x, z) + 0.74 * s * 0.78, z);
    grp.add(pot);
    return grp;
  }

  /** サンゴの 2つめ（v0.4 から）：ウミキノコ（やわらかい きのこの かたちの サンゴ）。前は イソギンチャク風だった。 */
  makeToadstool(x, z, n = 0) {
    const grp = new THREE.Group();
    const R = rng(501 + n * 3);
    const base = this.sandHeight(x, z);
    const stalkMat = new THREE.MeshLambertMaterial({ color: '#efe1b8' });
    const cA = new THREE.Color('#d8c36e'), cB = new THREE.Color('#f3e7b0');
    for (let k = 0; k < 2; k++) {
      const h = k ? 0.8 : 1.3, cr = k ? 0.6 : 0.85;
      const px = x + (k ? 0.95 : 0), pz = z + (k ? 0.35 : 0);
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, h, 12), stalkMat);
      stalk.position.set(px, base + h / 2 - 0.05, pz); stalk.rotation.z = (k ? -0.2 : 0.12);
      const g = new THREE.SphereGeometry(cr, 26, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
      const p = g.attributes.position, col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const ax = p.getX(i), az = p.getZ(i), a = Math.atan2(az, ax);
        const edge = 1 - p.getY(i) / cr;
        p.setY(i, p.getY(i) * 0.38 + Math.sin(a * 6 + k) * 0.07 * edge);
        const c = cA.clone().lerp(cB, edge * 0.9);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      const cap = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      cap.position.set(px + (k ? -0.15 : 0.15), base + h - 0.1, pz); cap.rotation.set((R() - 0.5) * 0.3, 0, k ? -0.25 : 0.15);
      grp.add(stalk, cap);
    }
    return grp;
  }

  // ---------------- v0.5 の せの たかい 飾り・器具（インテリア係）----------------
  /** 管・球などを 1つの ゆれる メッシュに まとめる。parts = [{ g, phase, h(頂点→ゆれの つよさ), col(頂点→色) }] */
  mergeSway(parts, sway) {
    const pos = [], nor = [], col = [], ph = [], hs = [];
    for (const { g, phase, h, col: cf } of parts) {
      const ng = g.index ? g.toNonIndexed() : g;
      const p = ng.attributes.position, q = ng.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const c = cf(x, y, z);
        pos.push(x, y, z); nor.push(q.getX(i), q.getY(i), q.getZ(i)); col.push(c.r, c.g, c.b);
        ph.push(phase); hs.push(h(x, y, z));
      }
      g.dispose(); if (ng !== g) ng.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 1));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(hs, 1));
    return new THREE.Mesh(g, this.swayMaterial(sway));
  }

  /** うきくさ（川）：すいめんに うかぶ まるい はっぱ＋まんなか（y≈4）まで たれる ねっこ。ねっこは まばらで、さかなが すりぬけても めだたない。 */
  makeUkikusa(x, z, n = 0) {
    const grp = new THREE.Group();
    const R = rng(1201 + n * 17);
    const top = this.waterTop - 0.06;
    // はっぱ（つぶした 円ばん。うらも 見える ように 両面）
    const leafMat = new THREE.MeshLambertMaterial({ color: '#86cc4f', emissive: '#3f7a1f', emissiveIntensity: 0.55, side: THREE.DoubleSide });
    const leaves = [];
    const L = 9;
    for (let k = 0; k < L; k++) {
      const a = (k / L) * Math.PI * 2 + R() * 0.5, rr = k === 0 ? 0 : 0.5 + R() * 0.55;
      const r = 0.32 + R() * 0.16;
      const g = new THREE.CylinderGeometry(r, r * 0.92, 0.05, 18);
      const m = new THREE.Mesh(g, leafMat);
      m.position.set(x + Math.cos(a) * rr, top - R() * 0.04, z + Math.sin(a) * rr * 0.7);
      m.rotation.set((R() - 0.5) * 0.35, 0, (R() - 0.5) * 0.35);   // すこし かたむけて、下からも はっぱの かたちが 見える
      leaves.push(m);
    }
    grp.add(mergeMeshes(leaves, leafMat));
    // ねっこ（白っぽい ほそい 管。下ほど よく ゆれる）
    const cTop = new THREE.Color('#f7f5ea'), cEnd = new THREE.Color('#dbe6c4');
    const parts = [];
    const N = 6;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2 + R() * 0.6, rr = 0.15 + R() * 0.55;
      const len = 2.8 + R() * 1.8;
      const x0 = x + Math.cos(a) * rr, z0 = z + Math.sin(a) * rr * 0.6;
      const pts = [];
      for (let s = 0; s <= 5; s++) { const t = s / 5; pts.push(new THREE.Vector3(x0 + Math.sin(t * 3.2 + k * 1.7) * 0.28 * t, top - t * len, z0 + Math.cos(t * 2.6 + k) * 0.18 * t)); }
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.028, 5, false);
      parts.push({ g, phase: R() * 6, h: (px, py) => clamp((top - py) / 2.2, 0, 2.2), col: (px, py) => cTop.clone().lerp(cEnd, clamp((top - py) / len, 0, 1)) });
    }
    const roots = this.mergeSway(parts, 0.8);
    roots.material.transparent = true; roots.material.opacity = 0.8;
    roots.position.set(0, 0, 0);
    grp.add(roots);
    // 休む場所：ねっこの 手前（はっぱの 下の まんなかの たかさ）
    grp.userData.spots = { rest: [{ x, y: top - 3.0, z: Math.min(z + 0.9, this.bounds.maxZ - 0.3) }] };
    return grp;
  }

  /** スポンジフィルター（川）：まるい 台に スポンジ 2だん、てっぺんから 透明な 管が y≈6.6 まで。管の 中を あわが のぼる。 */
  makeSpongeFilter(x, z) {
    const grp = new THREE.Group();
    const base = this.sandHeight(x, z);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.22, 24), new THREE.MeshLambertMaterial({ color: '#f1f4f2' }));
    foot.position.set(x, base + 0.08, z);
    grp.add(foot);
    const spongeMat = new THREE.MeshLambertMaterial({ color: '#c8df3a' });
    let y = base + 0.19;
    for (let k = 0; k < 1; k++) {
      const h = 2.6;
      const g = new THREE.CylinderGeometry(0.58, 0.58, h, 32, 24);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {   // ふとい よこみぞ 2本・かどを まるく（あなは あけない）
        const t = (p.getY(i) + h / 2) / h;
        let f = 1 - 0.09 * (Math.exp(-(((t - 0.33) / 0.035) ** 2)) + Math.exp(-(((t - 0.67) / 0.035) ** 2)));
        f *= 1 - 0.1 * (Math.max(0, Math.abs(t - 0.5) - 0.45) / 0.05) ** 2;
        p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, spongeMat);
      m.position.set(x, y + h / 2, z);
      grp.add(m);
      y += h + 0.04;
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.16, 18), new THREE.MeshLambertMaterial({ color: '#f1f4f2' }));
    cap.position.set(x, y + 0.04, z);
    grp.add(cap);
    // 透明な 管（のぼり管）＋さきの まがり
    const tubeTop = 6.6;
    const tubeMat = new THREE.MeshLambertMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.4, depthWrite: false });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, tubeTop - y, 12, 1, true), tubeMat);
    tube.position.set(x, (tubeTop + y) / 2, z);
    const bend = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.11, 8, 12, Math.PI / 2), tubeMat);
    bend.position.set(x + 0.22, tubeTop, z); bend.rotation.z = Math.PI / 2;
    grp.add(tube, bend);
    // あわ（ブクブクの スイッチと かんけいなく いつも でる。管の 中を のぼって 先から でる）
    this.emitters.push({ kind: 'sponge', x, y: y + 0.15, z, rate: 6, spread: 0.06, size: [0.1, 0.17], acc: 0, tube: true, tubeR: 0.05, tubeTop: tubeTop });
    // 休む場所：スポンジの 横に はりつく／管の 横で 休む
    grp.userData.spots = {
      cling: [{ x: x + 0.05, y: base + 1.0, z: z + 0.6 }, { x: x - 0.1, y: base + 2.2, z: z + 0.6 }],
      rest: [{ x: x + 0.9, y: 4.0, z: Math.min(z + 0.9, this.bounds.maxZ - 0.3) }],
    };
    return grp;
  }

  /** サンゴツリー（海）：小さな 岩から 幹が y≈5.8 まで のびて、先の まるい ふとい えだが 木のように ひろがる。えだの あいだは ひろく あける。ゆっくり ゆれる。 */
  makeCoralTree(x, z, n = 0) {
    const grp = new THREE.Group();
    const R = rng(1301 + n * 7);
    const base = this.sandHeight(x, z);
    const rock = new THREE.Mesh(this.rockGeometry(1310 + n, 0.65, 0.55), new THREE.MeshLambertMaterial({ color: '#b79b86', flatShading: true }));
    rock.position.set(x, base + 0.05, z);
    grp.add(rock);
    const cTrunk = new THREE.Color('#ef5a4a'), cTip = new THREE.Color('#ffb27a');
    const yTop = 5.8;
    const parts = [];
    const tint = (py) => cTrunk.clone().lerp(cTip, clamp((py - base) / (yTop - base), 0, 1) ** 1.6);
    const sway = (px, py) => clamp((py - base - 1) / 2.4, 0, 2);
    const tube = (pts, r0, r1, phase, cap = true) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      const TS = 12, RS = 12;
      const g = new THREE.TubeGeometry(curve, TS, 1, RS, false);
      const p = g.attributes.position;
      for (let i = 0; i <= TS; i++) {
        const c = curve.getPointAt(i / TS), r = r0 + (r1 - r0) * (i / TS);
        for (let j = 0; j <= RS; j++) { const k = i * (RS + 1) + j; p.setXYZ(k, c.x + (p.getX(k) - c.x) * r, c.y + (p.getY(k) - c.y) * r, c.z + (p.getZ(k) - c.z) * r); }
      }
      g.computeVertexNormals();
      parts.push({ g, phase, h: sway, col: (px, py) => tint(py) });
      if (!cap) return;
      const tip = new THREE.SphereGeometry(r1, 14, 10);   // 先は 管と おなじ ふとさで まるく とじる（こぶに しない）
      const e = pts[pts.length - 1]; tip.translate(e.x, e.y, e.z);
      parts.push({ g: tip, phase, h: sway, col: (px, py) => tint(py) });
    };
    const V = (a, b, c) => new THREE.Vector3(a, b, c);
    // 幹（ふとく みじかい）
    const t0 = V(x, base + 0.25, z), t1 = V(x + 0.05, base + 1.1, z), t2 = V(x, base + 1.9, z);
    tube([t0, t1, t2], 0.42, 0.34, 0, false);
    // えだ 5本（ふとく、先は まるく。左右に ひろげ、手前・奥へは すこしだけ）
    const BR = [[-0.95, 2.2, 5.2, 0.1], [-0.4, 1.0, 5.9, -0.15], [0.15, 0.2, 6.2, 0.05], [0.6, 1.1, 5.7, 0.15], [1.0, 2.3, 4.9, -0.1]];
    BR.forEach(([dir, w, top, dz], i) => {
      const s0 = V(x + dir * 0.2, t2.y - 0.15, z);
      const e = V(x + Math.sign(dir || 1) * w * (Math.abs(dir) > 0.3 ? 1 : 0.4) + (dir === 0.15 ? 0 : 0), top + (R() - 0.5) * 0.2, z + dz);
      if (i === 2) e.x = x + 0.1;
      const m = V(s0.x + (e.x - s0.x) * 0.35, s0.y + (e.y - s0.y) * 0.55, z + dz * 0.5);
      const ph = R() * 6;
      tube([s0, m, e], 0.3, 0.21, ph);
      if (i !== 2) {   // 小えだ 1本（外がわへ）
        const s2 = s0.clone().lerp(e, 0.5);
        const sd = Math.sign(dir);
        const e2 = s2.clone().add(V(sd * 0.95, 0.85 + R() * 0.3, (R() - 0.5) * 0.3));
        tube([s2, s2.clone().lerp(e2, 0.5).add(V(0, 0.08, 0)), e2], 0.22, 0.17, ph + 0.4);
      }
    });
    grp.add(this.mergeSway(parts, 0.45));
    // 休む場所：えだの 手前・よこの 空いた ところ（クマノミの なかまが あつまる）
    grp.userData.spots = { coral: [{ x: x - 1.3, y: 4.6, z: Math.min(z + 1.2, this.bounds.maxZ - 0.3) }, { x: x + 1.3, y: 4.9, z: Math.min(z + 1.2, this.bounds.maxZ - 0.3) }] };
    return grp;
  }

  /** ろかタワー（海）：とうめいな つつ（y≈6 まで）の 中に 大きな まるい ろ材が 5こ。上の 出口から あわ。 */
  makeFilterTower(x, z) {
    const grp = new THREE.Group();
    const base = this.sandHeight(x, z);
    const H = 5.6, r = 0.55;
    const footMat = new THREE.MeshLambertMaterial({ color: '#8fd0e8' });
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.12, r + 0.18, 0.32, 28), footMat);
    foot.position.set(x, base + 0.12, z);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(r, r, H, 28, 1, true), new THREE.MeshLambertMaterial({ color: '#e6f7ff', transparent: true, opacity: 0.36, side: THREE.DoubleSide, depthWrite: false }));
    glass.position.set(x, base + 0.28 + H / 2, z); glass.renderOrder = 2;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.08, r + 0.08, 0.28, 28), new THREE.MeshLambertMaterial({ color: '#f4f6f6' }));
    lid.position.set(x, base + 0.28 + H + 0.1, z);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.45, 12), new THREE.MeshLambertMaterial({ color: '#f4f6f6' }));
    spout.rotation.z = Math.PI / 2; spout.position.set(x + r + 0.15, base + 0.28 + H - 0.05, z);
    grp.add(foot, glass, lid, spout);
    // ろ材：パステルの ひらたい 円ばん（アイコンと おなじ）。小さな 穴は あけない
    const cols = ['#f3b6c4', '#f6e7c4', '#c9b3e3', '#f6e7c4', '#f3b6c4', '#c9b3e3'];
    const nDisc = 6, dh = (H - 0.5) / nDisc;
    for (let k = 0; k < nDisc; k++) {
      const g = new THREE.CylinderGeometry(r - 0.08, r - 0.08, dh * 0.86, 28, 4);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {   // ふちを まるく（まんじゅう がた）
        const t = Math.abs(p.getY(i)) / (dh * 0.43);
        const f = 1 - 0.18 * Math.max(0, t - 0.55) ** 2 / 0.2;
        p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: cols[k] }));
      m.position.set(x, base + 0.35 + dh * (k + 0.5), z);
      m.userData.noGround = true;
      grp.add(m);
    }
    // 筒の ふち（上と下の わ）
    for (const yy of [base + 0.3, base + 0.28 + H - 0.05]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.01, 0.05, 8, 32), new THREE.MeshLambertMaterial({ color: '#dff4ff' }));
      ring.rotation.x = Math.PI / 2; ring.position.set(x, yy, z); ring.userData.noGround = true;
      grp.add(ring);
    }
    // あわ：つつの 中を のぼって、上の 出口の よこへ
    this.emitters.push({ kind: 'tower', x, y: base + 0.4, z, rate: 10, spread: 0.3, size: [0.06, 0.11], acc: 0, tube: true, tubeR: 0.32, maxY: base + H });
    this.emitters.push({ kind: 'tower', x: x + r + 0.4, y: base + 0.28 + H - 0.05, z, rate: 3, spread: 0.1, size: [0.1, 0.18], acc: 0 });
    grp.userData.spots = {
      cling: [{ x, y: base + 2.6, z: z + r + 0.05 }],
      rest: [{ x: x - 1.0, y: 4.0, z: Math.min(z + 0.9, this.bounds.maxZ - 0.3) }],
    };
    return grp;
  }

  makeDriftwood(x, z) {
    const grp = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: '#6e4b2e', flatShading: true });
    const base = this.sandHeight(x, z);
    const V = (a, b2, c) => new THREE.Vector3(a, b2, c);
    // 曲がった枝（太さが先に向かって細くなる管）
    const limb = (p0, p1, r0, r1, seed) => {
      const mid = p0.clone().lerp(p1, 0.5).add(V((vnoise(seed, 1) - 0.5) * 0.8, (vnoise(seed, 2) - 0.3) * 0.5, (vnoise(seed, 3) - 0.5) * 0.4));
      const curve = new THREE.CatmullRomCurve3([p0, p0.clone().lerp(mid, 0.6), mid, mid.clone().lerp(p1, 0.5), p1]);
      const TS = 14, RS = 7;
      const g = new THREE.TubeGeometry(curve, TS, 1, RS, false);
      const pos = g.attributes.position;
      for (let i = 0; i <= TS; i++) {
        const c = curve.getPointAt(i / TS);
        const r = r0 + (r1 - r0) * (i / TS);
        for (let j = 0; j <= RS; j++) {
          const k = i * (RS + 1) + j;
          const n = 1 + (vnoise(i * 0.9 + seed, j * 1.7) - 0.5) * 0.6;
          pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * r * n, c.y + (pos.getY(k) - c.y) * r * n, c.z + (pos.getZ(k) - c.z) * r * n);
        }
      }
      g.computeVertexNormals();
      grp.add(new THREE.Mesh(g, mat));
      const capR = r0 * 1.0;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(capR, 7, 5), mat); cap.position.copy(p0); grp.add(cap);
    };
    const a0 = V(x - 2.4, base + 0.05, z + 0.3), a1 = V(x + 1.6, base + 1.1, z - 0.4);
    limb(a0, a1, 0.32, 0.2, 1);
    const at = (t) => a0.clone().lerp(a1, t);
    const b1 = at(0.55), b1e = b1.clone().add(V(-0.6, 2.4, -0.2));
    limb(b1, b1e, 0.17, 0.07, 2);
    limb(b1e, b1e.clone().add(V(-0.7, 0.9, 0.1)), 0.07, 0.03, 3);
    const b2 = at(0.9), b2e = b2.clone().add(V(0.9, 1.9, 0.1));
    limb(b2, b2e, 0.15, 0.05, 4);
    limb(at(0.25), at(0.25).add(V(-0.3, 1.1, 0.4)), 0.12, 0.04, 5);
    return grp;
  }

  makeAirStone(x, z) {
    const grp = new THREE.Group();
    const y = this.sandHeight(x, z);
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.32, 14), new THREE.MeshLambertMaterial({ color: '#a7b6c4' }));
    stone.position.set(x, y + 0.12, z);
    const tubeMat = new THREE.MeshLambertMaterial({ color: '#e8f4f4', transparent: true, opacity: 0.45 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, TANK_H - y, 6), tubeMat);
    tube.position.set(x + 0.15, y + (TANK_H - y) / 2, -TANK_D / 2 + 0.1);
    const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, Math.abs(z + TANK_D / 2 - 0.1) + 0.1, 6), tubeMat);
    hose.rotation.x = Math.PI / 2; hose.position.set(x + 0.15, y + 0.15, (z - TANK_D / 2 + 0.1) / 2);
    grp.add(stone, tube, hose);
    this.emitters.push({ kind: 'air', x, y: y + 0.3, z, rate: 26, spread: 0.18, size: [0.08, 0.2], acc: 0 });
    return grp;
  }

  makeHeater(x, z) {
    const grp = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.6, 12), new THREE.MeshLambertMaterial({ color: '#e6f6ff', transparent: true, opacity: 0.4 }));
    glass.position.set(x, 4.7, z);
    const coilMat = new THREE.MeshLambertMaterial({ color: '#ff8a3a', emissive: '#ff5a1a', emissiveIntensity: 0.6 });
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 8), coilMat);
    coil.position.set(x, 4.5, z);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.6, 12), new THREE.MeshLambertMaterial({ color: '#2b3236' }));
    cap.position.set(x, 7.3, z);
    const cupMat = new THREE.MeshLambertMaterial({ color: '#dfeff0', transparent: true, opacity: 0.6 });
    for (const yy of [3.2, 6.2]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), cupMat); c.position.set(x, yy, z - 0.2); c.scale.z = 0.4; grp.add(c); }
    grp.add(glass, coil, cap);
    this.heaterGlow = coilMat;
    return grp;
  }

  makeFilter(x, z) {
    const grp = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: '#3d4a4f' });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.3, 6, 14), mat);
    body.scale.z = 0.6;
    body.position.set(x - 0.75, TANK_H - 1.55, z);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.5, 10), mat);
    lip.rotation.z = Math.PI / 2; lip.position.set(x - 1.3, this.waterTop - 0.45, z + 0.15);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.4, 8), mat);
    pipe.position.set(x - 0.75, TANK_H - 2.6 - 2.2, z + 0.05);
    const grate = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.7, 10), new THREE.MeshLambertMaterial({ color: '#5c6a70' }));
    grate.position.set(x - 0.75, TANK_H - 7.2, z + 0.05);
    grp.add(body, lip, pipe, grate);
    this.emitters.push({ kind: 'filter', x: x - 1.55, y: this.waterTop - 0.45, z: z + 0.2, rate: 7, spread: 0.25, size: [0.05, 0.1], acc: 0 });
    return grp;
  }

  /** v0.6 おそうじロボ（インテリア係）：まるい ドーム（アイコンと おなじ 白・水色の帯・ランプ・車輪・すいこみ口）。そこの ごみの 帯の 手前がわ（かいがら などと かさならない 通り道）を ゆっくり うごき、見えている ごみの 上で すこし とまって あわを だす。目・口は つけない。 */
  makeCleanRobot(x, z) {
    const grp = new THREE.Group();
    const body = new THREE.Group();
    // 足もとの やわらかい かげ（白い 砂でも 見うしなわない・うかんで 見えない）
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), new THREE.MeshBasicMaterial({ color: '#1d3340', transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; shadow.renderOrder = 1;
    const white = new THREE.MeshLambertMaterial({ color: '#eef3f6' });
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.68, 0.3, 36), new THREE.MeshLambertMaterial({ color: '#cfd9df' }));
    skirt.position.y = 0.17;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.66, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2), white);
    dome.scale.y = 0.55; dome.position.y = 0.32;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.06, 10, 44), new THREE.MeshLambertMaterial({ color: '#2fb2e6' }));
    band.rotation.x = Math.PI / 2; band.position.y = 0.32;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 24), white);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.68;
    const lampMat = new THREE.MeshLambertMaterial({ color: '#9fe8ff', emissive: '#4fc9f2', emissiveIntensity: 0.8 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), lampMat);
    lamp.position.y = 0.69; lamp.scale.y = 0.65;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.06), new THREE.MeshLambertMaterial({ color: '#3c474d' }));
    slot.position.set(0, 0.12, 0.66);   // まえの 下の すいこみ口（よこに 1本だけ）
    body.add(shadow, skirt, dome, band, rim, lamp, slot);
    for (const sx of [-1, 1]) {   // よこの 車輪（アイコンと おなじ 灰色）
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 20), new THREE.MeshLambertMaterial({ color: '#7d878d' }));
      wheel.rotation.z = Math.PI / 2; wheel.position.set(sx * 0.68, 0.17, 0.12);
      body.add(wheel);
    }
    grp.add(body);
    const em = { kind: 'robot', x, y: 0.5, z, rate: 0, spread: 0.3, size: [0.08, 0.14], acc: 0 };
    this.emitters.push(em);
    this.robot = { grp, body, lampMat, em, x, z, tx: x, tz: z, wait: 1.5, ang: 0.6, t: 0 };
    this.placeRobot();
    return grp;
  }

  /** ロボの 下の 砂の たかさ（まんなかと まわり 4てんの いちばん 高い ところ。砂に うまらない ように） */
  robotGround(x, z) {
    let y = this.sandHeight(x, z);
    for (const [ox, oz] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) y = Math.max(y, this.sandHeight(x + ox, z + oz));
    return y;
  }

  placeRobot() {
    const r = this.robot;
    const g = this.robotGround(r.x, r.z);
    r.body.position.set(r.x, g, r.z);
    r.body.rotation.y = r.ang;
    r.em.x = r.x - Math.sin(r.ang) * 0.6; r.em.z = r.z - Math.cos(r.ang) * 0.6; r.em.y = g + 0.45;
  }

  /** つぎの いきさき：見えている ごみの うち いちばん ちかい もの。なければ 帯の はしから はしへ。通り道は z 0.15〜0.5（かいがらの 手前）。 */
  pickRobotTarget() {
    const r = this.robot, lim = 0.36 * this.W;
    const vis = (this.dirtPatches || []).filter((p) => p.mesh.visible && !p.caught && Math.abs(p.x) < lim && Math.hypot(p.x - r.x, p.z - r.z) > 0.3);
    if (vis.length) { vis.sort((a, b) => Math.hypot(a.x - r.x, a.z - r.z) - Math.hypot(b.x - r.x, b.z - r.z)); r.tx = vis[0].x; r.tz = clamp(vis[0].z, 0.15, 0.5); r.onDirt = true; return; }
    r.tx = r.x > 0 ? -lim * (0.6 + Math.random() * 0.4) : lim * (0.6 + Math.random() * 0.4);
    r.tz = 0.15 + Math.random() * 0.35; r.onDirt = false;
  }

  updateCleanRobot(dt) {
    const r = this.robot;
    r.t += dt;
    r.lampMat.emissiveIntensity = 0.55 + Math.sin(r.t * 2) * 0.25;   // ランプが ゆっくり ひかる
    if (r.wait > 0) {
      r.wait -= dt;
      r.em.rate = r.onDirt ? 4 : 0;   // ごみの 上では あわが ぷくぷく
      if (r.wait <= 0) this.pickRobotTarget();
      this.placeRobot();
      return;
    }
    r.em.rate = 0;
    const dx = r.tx - r.x, dz = r.tz - r.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { r.wait = r.onDirt ? 2.5 : 1.5; this.placeRobot(); return; }
    // むきを ゆっくり かえてから すすむ（はやさ 0.4／びょう：はしから はしまで 30びょう くらい）
    const want = Math.atan2(dx, dz);
    let da = want - r.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
    r.ang += clamp(da, -dt * 1.2, dt * 1.2);
    if (Math.abs(da) < 0.5) { const st = Math.min(d, 0.4 * dt); r.x += Math.sin(r.ang) * st; r.z = clamp(r.z + Math.cos(r.ang) * st, 0.15, 0.5); }
    this.placeRobot();
  }

  /** 自動えさやり機：前のふち（左）に のっている箱。ドラムが回って えさが落ちる。 */
  makeAutoFeeder(x) {
    const grp = new THREE.Group();
    const z = TANK_D / 2 - 0.55;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: '#f2f4f2' }));
    body.position.set(x, TANK_H - 0.12, z);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.7, 14), new THREE.MeshLambertMaterial({ color: '#9fd9f0', transparent: true, opacity: 0.85 }));
    drum.rotation.x = Math.PI / 2;
    drum.position.set(x + 0.15, WATER_TOP + 0.12, z);
    const inside = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 10), new THREE.MeshLambertMaterial({ color: '#c8742e' }));
    inside.rotation.x = Math.PI / 2; inside.position.copy(drum.position);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.25), new THREE.MeshLambertMaterial({ color: '#8a9399' }));
    clip.position.set(x - 0.45, TANK_H - 0.3, z + 0.3);
    grp.add(body, drum, inside, clip);
    this.feeder = { drum, x: x + 0.15, z, spin: 0 };
    return grp;
  }

  /** クリップ式ファン：前のふち（右）。羽根が回る。 */
  makeFan(x) {
    const grp = new THREE.Group();
    const z = TANK_D / 2 - 0.6;
    const gray = new THREE.MeshLambertMaterial({ color: '#e9ecef' });
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 24), gray);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 12), new THREE.MeshLambertMaterial({ color: '#7fc8ff' }));
    hub.rotation.x = Math.PI / 2;
    const blades = new THREE.Group();
    const bladeMat = new THREE.MeshLambertMaterial({ color: '#7fc8ff', side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const bl = new THREE.Mesh(new THREE.CircleGeometry(0.28, 10), bladeMat);
      bl.scale.set(1, 0.45, 1);
      bl.position.set(Math.cos(i * Math.PI / 2) * 0.3, Math.sin(i * Math.PI / 2) * 0.3, 0);
      bl.rotation.z = i * Math.PI / 2; bl.rotation.y = 0.4;
      blades.add(bl);
    }
    const head = new THREE.Group();
    head.add(guard, hub, blades);
    head.position.set(x, TANK_H - 0.05, z);
    head.rotation.x = 0.9;   // 水面のほうへ向ける
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), gray);
    arm.position.set(x, TANK_H - 0.25, z + 0.25);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.3), new THREE.MeshLambertMaterial({ color: '#8a9399' }));
    clip.position.set(x, TANK_H - 0.55, z + 0.35);
    grp.add(head, arm, clip);
    this.fanBlades = blades;
    this.fanRipple = { x, z: z - 1.2, t: 0 };
    return grp;
  }

  /** CO2：水中の小さな筒（ディフューザー）から細かい泡。ボンベは水槽の外。 */
  makeCo2(x, z) {
    const grp = new THREE.Group();
    const y = this.sandHeight(x, z) + 1.1;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 12), new THREE.MeshLambertMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.5 }));
    glass.position.set(x, y, z);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 12), new THREE.MeshLambertMaterial({ color: '#f4f4f4' }));
    disc.position.set(x, y + 0.3, z);
    const tubeMat = new THREE.MeshLambertMaterial({ color: '#e8f4f4', transparent: true, opacity: 0.45 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, TANK_H - y, 6), tubeMat);
    tube.position.set(x - 0.1, y + (TANK_H - y) / 2, z - 0.1);
    grp.add(glass, disc, tube);
    this.emitters.push({ kind: 'co2', x, y: y + 0.35, z, rate: 14, spread: 0.18, size: [0.03, 0.06], acc: 0 });
    return grp;
  }

  /** プロテインスキマー（海水だけ）：うしろの角の筒。中で白い泡がのぼる。 */
  makeSkimmer(x, z) {
    const grp = new THREE.Group();
    const base = this.sandHeight(x, z);
    const dark = new THREE.MeshLambertMaterial({ color: '#2f3a40' });
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.7), dark);
    foot.position.set(x, base + 0.3, z);
    const tubeH = 5.2;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, tubeH, 16, 1, true), new THREE.MeshLambertMaterial({ color: '#dff4ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    tube.position.set(x, base + 0.6 + tubeH / 2, z);
    const foam = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.9, 14), new THREE.MeshLambertMaterial({ color: '#f6f1e2' }));
    foam.position.set(x, base + 0.6 + tubeH - 0.9, z);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.25, 16), dark);
    cap.position.set(x, base + 0.6 + tubeH + 0.1, z);
    grp.add(foot, tube, foam, cap);
    this.emitters.push({ kind: 'skimmer', x, y: base + 0.7, z, rate: 40, spread: 0.45, size: [0.04, 0.09], acc: 0, maxY: base + 0.6 + tubeH - 1.3 });
    return grp;
  }

  /** 自動えさやり機のドラムを回して、少しえさを落とす。機械が無ければ右上から。 */
  autoFeed(kind = 'flake') {
    const fd = this.feeder;
    const x = fd ? fd.x : 0.3 * this.W, z = fd ? fd.z - 0.4 : 0.5;
    if (fd) fd.spin = 1.2;
    setTimeout(() => { if (!this.disposed) this.dropFood(x, clamp(z, this.bounds.minZ, this.bounds.maxZ), kind, 3, this.waterTop - 0.05); }, fd ? 450 : 0);
    return { x, z };
  }

  makeLight() {
    const grp = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(this.W * 0.7, 0.1, 0.8), new THREE.MeshBasicMaterial({ color: '#fffbe8', fog: false }));
    bar.position.set(0, TANK_H - 0.08, -0.3);
    grp.add(bar);
    return grp;
  }

  // ---------------- 水のようす ----------------
  setWater(w = {}) {
    if (w.dirt !== undefined) {
      this.water.dirt = clamp(+w.dirt || 0, 0, 1);
      if (!this.dirtInit) { this.dirtShown = this.water.dirt; this.dirtInit = true; }
    }
    if (w.waste !== undefined) this.water.waste = clamp(+w.waste || 0, 0, 1);   // そこの ごみ（そうじ で へる）
    if (w.light !== undefined) this.water.light = clamp(+w.light, 0, 1);
    if (w.bubbles !== undefined) this.water.bubbles = w.bubbles;
    this.applyWater();
  }

  get hasLightDecor() { return this.decorIds.includes('light'); }

  applyWater() {
    const dirt = this.dirtShown ?? this.water.dirt;
    if (this.dirtPatches) this.updateDirtPatches();
    const light = clamp(this.water.light * (this.hasLightDecor ? 1.12 : 1), 0, 1.15);
    const lf = 0.2 + 0.8 * light;
    if (this.water.bubbles === true) this._ensureAutoStone();
    else if (this.autoStone) { this.decorGroup.remove(this.autoStone); this.autoStone = null; this.emitters = this.emitters.filter((e) => e.kind !== 'air' || this.decorIds.some((d) => d === 'air_pump' || d === 'air')); }
    this.hemi.intensity = 1.7 * lf;
    this.sun.intensity = 1.6 * lf;
    const fog = this.colors.fog.clone().lerp(MURK, dirt * 0.65).lerp(NIGHT, 1 - lf).multiplyScalar(0.35 + 0.65 * lf);
    this.scene.fog.color.copy(fog);
    this.fogBase = { dirt };
    if (this.wallMat) {
      this.wallMat.color.setScalar(0.3 + 0.7 * lf).lerp(NIGHT, (1 - lf) * 0.6).lerp(MURK, dirt * 0.4);
      this.sideMat.color.setScalar((0.3 + 0.7 * lf) * 0.88).lerp(NIGHT, (1 - lf) * 0.6).lerp(MURK, dirt * 0.4);
    }
    if (this.murk) this.murk.material.opacity = dirt * 0.42;
    this.uniforms.uLight.value = lf;
    this.uniforms.uCausticAmt.value = 0.36 * light * (1 - dirt * 0.75);
    this.motes.material.uniforms.uOpacity.value = 0.25 + dirt * 0.9;
    this.motes.material.uniforms.uColor.value.set(0xf4fff4).lerp(new THREE.Color('#c9e28a'), dirt);
    if (this.rays) for (const r of this.rays) r.userData.amt = light * (1 - dirt * 0.8);
  }

  /** 霧の距離はカメラとの距離で決める。 */
  setFogRange(camDist) {
    this.camDist = camDist;
    const d = this.dirtShown ?? this.water.dirt;
    this.scene.fog.near = camDist - 1 - d * 6;
    this.scene.fog.far = camDist + TANK_D + 14 - d * (TANK_D + 9);
  }

  get bubblesOn() {
    if (this.water.bubbles === false) return false;
    return true;
  }

  // ---------------- 餌 ----------------
  /**
   * 粒を落とす。kind: 'flake'（ふつう）| 'vitamin'（カラフル・きらきら）| 'sinking'（早く沈む）
   * y を渡すと水面ではなくその高さから（自動えさやり機の口など）。
   */
  dropFood(x, z, kind = 'flake', n = 0, y = this.waterTop - 0.05) {
    if (this.land) x = Math.min(x, this.waterMaxX - 0.6);   // v0.6 いけ：えさは 水の ある ところだけ
    // 粒の数は 生きものの数に合わせる（みんなに行きわたるように。5〜12粒）
    if (!n) n = clamp((this.creatures || 4) + 1, 5, 12);
    // 底の生きもの（エビ・貝・コリドラスなど）がいるときは、何粒かを「底のぶん」にする。
    // 底のぶんは少し早く沈み、ふつうの魚は追わない（魚が先に全部食べてしまわないように）。
    const reserve = Math.min(n - 2, this.bottomEaters || 0);
    const snailOnly = Math.min(reserve, this.snails || 0);   // 貝はとてもゆっくりなので、貝だけの粒も（底で90秒まつ）
    for (let i = 0; i < n; i++) {
      let f = this.foods.find((q) => !q.alive && q.gone);
      if (!f) { if (this.foods.length >= this.maxFood) { f = this.foods.find((q) => q.landed) || this.foods[0]; } else { f = { pos: new THREE.Vector3() }; this.foods.push(f); } }
      Object.assign(f, { alive: true, gone: false, landed: false, age: -i * 0.12, claims: 0, sway: Math.random() * 6, vy: (kind === 'sinking' ? 1.3 : this.foodKinds?.[kind]?.sink ?? 0.6) + Math.random() * 0.15 + (i < reserve ? 0.35 : 0), fade: 1, kind, reserved: i < reserve, snailOnly: i < snailOnly });
      f.pos.set(clamp(x + (Math.random() - 0.5) * 0.9, this.bounds.minX + 0.3, this.bounds.maxX - 0.3), y, clamp(z + (Math.random() - 0.5) * 0.9, this.bounds.minZ, this.bounds.maxZ));
    }
    this.addRipple(x, z);
  }

  addRipple(x, z) {
    let r = this.ripples.find((q) => !q.alive);
    if (!r) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.rippleTex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      m.rotation.x = Math.PI / 2; m.renderOrder = 6;
      this.scene.add(m);
      r = { m }; this.ripples.push(r);
    }
    r.alive = true; r.t = 0;
    r.m.position.set(x, this.waterTop - 0.02, z);
    r.m.visible = true;
  }

  updateFood(dt) {
    const m4 = _m4, q = _q, s = _s;
    let n = 0, nv = 0;
    for (const f of this.foods) {
      if (f.gone) continue;
      if (!f.alive) { f.gone = true; continue; }
      f.age += dt;
      if (f.age < 0) { continue; }
      const sand = this.sandHeight(f.pos.x, f.pos.z) + 0.04;
      if (!f.landed) {
        if (f.age > 0.7) {
          f.pos.y -= f.vy * dt;
          f.pos.x += Math.sin(f.age * 2.2 + f.sway) * 0.12 * dt;
          f.pos.z += Math.cos(f.age * 1.7 + f.sway) * 0.08 * dt;
        }
        if (f.pos.y <= sand) { f.pos.y = sand; f.landed = true; f.landT = 0; }
      } else {
        f.landT += dt;
        // 底の粒は 貝やエビが来るまで しばらく残る
        if (f.landT > 90) { f.fade -= dt * 0.5; if (f.fade <= 0) { f.alive = false; f.gone = true; continue; } }
      }
      q.setFromEuler(_e.set(f.sway, f.age * 0.6 + f.sway, 0));
      s.setScalar(Math.min(1, f.fade) * Math.min(1, (f.age + 0.2) * 3));
      if (f.kind === 'vitamin') {
        s.multiplyScalar(0.85 + 0.3 * Math.abs(Math.sin(this.time * 6 + f.sway * 3)));   // きらきら
        m4.compose(f.pos, q, s);
        this.vitMesh.setMatrixAt(nv++, m4);
      } else {
        const fk = this.foodKinds?.[f.kind];
        if (fk) s.multiply(_fs.set(fk.scale[0], fk.scale[1], fk.scale[2]));
        m4.compose(f.pos, q, s);
        this.foodMesh.setColorAt(n, fk ? fk.colors[n % fk.colors.length] : this.foodFlakeColors[n % 4]);
        this.foodMesh.setMatrixAt(n++, m4);
      }
    }
    this.foodMesh.count = n;
    this.foodMesh.instanceMatrix.needsUpdate = true;
    if (this.foodMesh.instanceColor) this.foodMesh.instanceColor.needsUpdate = true;
    this.vitMesh.count = nv;
    this.vitMesh.instanceMatrix.needsUpdate = true;
    for (const r of this.ripples) {
      if (!r.alive) continue;
      r.t += dt;
      const k = r.t / 0.9;
      if (k >= 1) { r.alive = false; r.m.visible = false; continue; }
      const sc = 0.4 + k * 2.2;
      r.m.scale.set(sc, sc, 1);
      r.m.material.opacity = 1 - k;
    }
  }

  // ---------------- 毎フレーム ----------------
  update(dt) {
    this.time += dt;
    if (this.cleanedPatches) { if (this.cleanedUntil === undefined || this.cleanedUntil < 0) this.cleanedUntil = this.time + 3; this.updateDirtPatches(); if (!this.cleanedPatches) this.cleanedUntil = -1; }
    // にごりの見た目は少しずつ変える（そうじ中は あみが出ていくまで待つ）
    const ds = this.dirtShown ?? this.water.dirt;
    if (!this.holdDirt && Math.abs(ds - this.water.dirt) > 0.001) {
      this.dirtShown = ds + clamp(this.water.dirt - ds, -dt * 0.9, dt * 0.9);
      this.applyWater();
      if (this.camDist) this.setFogRange(this.camDist);
    }
    this.uniforms.uTime.value = this.time;
    // 光の筋
    for (const r of this.rays) {
      const u = r.userData;
      r.position.x = u.x0 + Math.sin(this.time * 0.15 + u.ph) * 0.6;
      r.material.opacity = (u.base + Math.sin(this.time * 0.5 + u.ph) * 0.04) * (u.amt ?? 1);
    }
    if (this.heaterGlow) this.heaterGlow.emissiveIntensity = 0.45 + Math.sin(this.time * 1.3) * 0.15;
    if (this.fanBlades) {
      this.fanBlades.rotation.z += dt * 14;
      const fr = this.fanRipple; fr.t -= dt;
      if (fr.t <= 0) { fr.t = 0.7; this.addRipple(fr.x + (Math.random() - 0.5) * 1.2, clamp(fr.z + (Math.random() - 0.5), this.bounds.minZ, this.bounds.maxZ)); }   // 風で水面がゆれる
    }
    if (this.feeder && this.feeder.spin > 0) { this.feeder.spin -= dt; this.feeder.drum.rotation.y += dt * 6; }
    if (this.robot) this.updateCleanRobot(dt);
    // 浮遊物
    const mp = this.motes.geometry.attributes.position;
    for (let i = 0; i < this.moteCount; i++) {
      const ph = this.motePh[i];
      mp.setY(i, mp.getY(i) + Math.sin(this.time * 0.3 + ph[3]) * 0.002);
      mp.setX(i, mp.getX(i) + Math.cos(this.time * 0.2 + ph[3]) * 0.002);
    }
    mp.needsUpdate = true;
    // 泡
    const on = this.bubblesOn;
    for (const e of this.emitters) {
      if (!on && e.kind === 'air') continue;
      e.acc += dt * e.rate;
      while (e.acc >= 1) {
        e.acc -= 1;
        const bb = this.bubbles.find((q) => !q.alive);
        if (!bb) break;
        bb.alive = true; bb.x = e.x + (Math.random() - 0.5) * e.spread; bb.y = e.y; bb.z = e.z + (Math.random() - 0.5) * e.spread;
        bb.s = e.size[0] + Math.random() * (e.size[1] - e.size[0]);
        bb.vy = 1.4 + bb.s * 4 + Math.random() * 0.6; bb.ph = Math.random() * 6; bb.kind = e.kind;
        if (e.kind === 'filter') { bb.vx = -0.8 - Math.random() * 0.6; bb.vy = 0.1; } else bb.vx = 0;
        if (e.kind === 'co2') bb.vy = 0.8 + Math.random() * 0.3;
        bb.maxY = e.maxY ?? this.waterTop - 0.05; bb.cx = e.x; bb.inTube = e.kind === 'skimmer' || !!e.tube; bb.tubeR = e.tubeR ?? 0.25; bb.tubeTop = e.tubeTop ?? Infinity;
      }
    }
    const bp = this.bubblePoints.geometry.attributes;
    for (let i = 0; i < this.maxBubbles; i++) {
      const bb = this.bubbles[i];
      if (bb.alive) {
        bb.ph += dt * 6;
        bb.y += bb.vy * dt;
        bb.x += (Math.sin(bb.ph) * 0.25 + (bb.vx || 0)) * dt;
        if (bb.kind === 'filter') { bb.vx *= 1 - dt * 0.8; bb.vy += dt * 0.6; }
        if (bb.inTube && bb.y < bb.tubeTop) bb.x = bb.cx + clamp(bb.x - bb.cx, -bb.tubeR, bb.tubeR);
        if (bb.y > bb.maxY || bb.x < this.bounds.minX) bb.alive = false;
      }
      bp.position.setXYZ(i, bb.x, bb.y, bb.z);
      bp.aSize.setX(i, bb.alive ? bb.s : 0);
      bp.aAlpha.setX(i, bb.alive ? 0.9 : 0);
    }
    bp.position.needsUpdate = bp.aSize.needsUpdate = bp.aAlpha.needsUpdate = true;
    this.updateFood(dt);
  }

  setPointScale(px) {
    this.bubblePoints.material.uniforms.uScale.value = px;
    this.motes.material.uniforms.uScale.value = px;
  }

  dispose() {
    const kill = (o) => o.traverse((c) => { c.geometry?.dispose(); if (c.material) { c.material.map?.dispose(); c.material.dispose(); } });
    kill(this.group); kill(this.decorGroup);
    this.disposed = true;
    for (const d of this.dirtPatches) { this.scene.remove(d.mesh); d.mesh.geometry.dispose(); }
    this.dirtMat.dispose(); this.dirtTex.dispose();
    kill(this.bubblePoints); kill(this.motes); kill(this.foodMesh); kill(this.vitMesh);
    for (const r of this.ripples) kill(r.m);
    this.caustic.dispose(); this.rayTex.dispose(); this.bubbleTex.dispose(); this.rippleTex.dispose(); this.moteTex.dispose();
    this.scene.remove(this.group, this.decorGroup, this.bubblePoints, this.motes, this.foodMesh, this.vitMesh, this.hemi, this.sun);
  }
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _fs = new THREE.Vector3();   // v0.6 えさの しゅるいの かたち
