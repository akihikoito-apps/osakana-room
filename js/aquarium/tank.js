// 水槽そのもの：水・底砂（コースティクス）・水面・光の筋・ガラスの縁・飾りと器具・泡・餌。
import * as THREE from '../../vendor/three.module.min.js';

export const TANK_H = 9;        // 高さ（ワールド単位）
export const TANK_D = 7;        // 奥行き
export const WATER_TOP = TANK_H - 0.6;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const WATER_COLORS = {
  fresh: { top: new THREE.Color('#a4e4e8'), mid: new THREE.Color('#3a98ad'), deep: new THREE.Color('#1b5873'), fog: new THREE.Color('#4aa2b4'), sand: new THREE.Color('#d7c7a2') },
  salt:  { top: new THREE.Color('#a8e6ff'), mid: new THREE.Color('#2f8ec4'), deep: new THREE.Color('#174f86'), fog: new THREE.Color('#3f97c8'), sand: new THREE.Color('#efe8d8') },
};
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
    this.W = 16;
    this.group = new THREE.Group();
    this.decorGroup = new THREE.Group();
    scene.add(this.group, this.decorGroup);
    this.decorIds = [];
    this.water = { dirt: 0, bubbles: undefined, light: 1 };
    this.time = 0;
    this.caustic = makeCausticTexture();
    this.rayTex = rayTexture();
    this.uniforms = { uTime: { value: 0 }, uCaustic: { value: this.caustic }, uCausticAmt: { value: 0.35 }, uLight: { value: 1 }, uHalfW: { value: 8 } };
    this.sandSeed = Math.random() * 100;

    // 光
    this.hemi = new THREE.HemisphereLight(0xe6fbff, 0x7a6a48, 1.7);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
    this.sun.position.set(2, 10, 6);
    scene.add(this.hemi, this.sun);
    scene.fog = new THREE.Fog(this.colors.fog.clone(), 10, 40);

    this.bounds = { minX: -7, maxX: 7, minZ: -2.6, maxZ: 2.7, top: WATER_TOP, sandY: (x, z) => this.sandHeight(x, z) };

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
    this.motes = new THREE.Points(mg, pointsMaterial(moteTexture(), 0xf4fff4, true));
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
    this.foodMesh.count = 0;
    scene.add(this.foodMesh);
    this.ripples = [];
    this.rippleTex = (() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const g = cv.getContext('2d'); g.beginPath(); g.arc(32, 32, 26, 0, 7); g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke();
      return new THREE.CanvasTexture(cv);
    })();

    this.build(16);
  }

  sandHeight(x, z) {
    // 手前が低く、奥に向かってゆるく盛り上がる
    const d = (z + TANK_D / 2) / TANK_D;            // 0=奥 1=手前
    const back = 0.75 + (1 - d) * (1 - d) * 0.9;
    return back + (vnoise(x * 0.35 + this.sandSeed, z * 0.35) - 0.5) * 0.3;
  }

  /** 横幅 W で水槽を作りなおす（画面の縦横比が変わったとき）。 */
  build(W) {
    this.W = W;
    for (const c of [...this.group.children]) { this.group.remove(c); c.geometry?.dispose(); if (c.material && !c.material.userData.shared) c.material.dispose(); }
    const H = TANK_H, D = TANK_D, col = this.colors;
    const b = this.bounds;
    this.uniforms.uHalfW.value = W / 2;
    b.minX = -W / 2 + 0.35; b.maxX = W / 2 - 0.35; b.minZ = -D / 2 + 0.9; b.maxZ = D / 2 - 0.7;

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
        varying vec3 vWp; uniform float uTime; uniform sampler2D uCaustic; uniform float uCausticAmt; uniform float uLight; uniform float uHalfW;
        float sgrain(vec2 p){ return fract(sin(dot(floor(p), vec2(12.9898,78.233))) * 43758.5453); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float gr = sgrain(vWp.xz * 38.0) * 0.5 + sgrain(vWp.xz * 17.0 + 3.1) * 0.5;
          diffuseColor.rgb *= 0.86 + gr * 0.22;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          vec2 cu = vWp.xz * 0.16;
          float c1 = texture2D(uCaustic, cu + vec2(uTime * 0.021, uTime * 0.013)).r;
          float c2 = texture2D(uCaustic, cu * 1.31 + vec2(-uTime * 0.017, uTime * 0.019) + 0.37).r;
          float cc = (min(c1, c2) * 1.3 + c1 * c2 * 0.9) * smoothstep(0.0, 1.6, uHalfW - abs(vWp.x)) * smoothstep(0.0, 1.2, 3.5 - abs(vWp.z));
          totalEmissiveRadiance += vec3(0.85, 1.0, 0.95) * cc * uCausticAmt;`);
    };
    const sand = new THREE.Mesh(sg, sandMat);
    this.group.add(sand);

    // 砂の断面（手前のガラス越しに見える層）
    const fg = new THREE.PlaneGeometry(W, 1, sx, 1);
    const fp = fg.attributes.position;
    for (let i = 0; i < fp.count; i++) { const x = fp.getX(i); fp.setY(i, fp.getY(i) > 0 ? this.sandHeight(x, D / 2) : 0); }
    const strata = gradientTexture(4, 64, [[0, '#' + col.sand.clone().multiplyScalar(0.95).getHexString()], [0.5, '#' + col.sand.clone().multiplyScalar(0.78).getHexString()], [1, '#' + col.sand.clone().multiplyScalar(0.55).getHexString()]]);
    strata.colorSpace = THREE.SRGBColorSpace;
    const front = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: strata, fog: false }));
    front.position.set(0, 0, D / 2 - 0.02);
    // UV を高さにあわせる
    for (let i = 0; i < fp.count; i++) fg.attributes.uv.setY(i, fp.getY(i) / 1.2);
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
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(W, D), surfMat);
    surf.rotation.x = Math.PI / 2;
    surf.position.y = WATER_TOP;
    surf.renderOrder = 1;
    this.group.add(surf);

    // 水面より上（ふたの裏）
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ color: 0x3d4c55, fog: false }));
    lid.rotation.x = Math.PI / 2; lid.position.y = H - 0.01;
    const air = new THREE.Mesh(new THREE.PlaneGeometry(W, H - WATER_TOP), new THREE.MeshBasicMaterial({ color: 0xcfe9ee, fog: false }));
    air.position.set(0, (H + WATER_TOP) / 2, -D / 2 + 0.01);
    this.group.add(lid, air);

    // 光の筋
    this.rays = [];
    const rr = rng(11);
    for (let i = 0; i < 6; i++) {
      const w = 1.0 + rr() * 2.2;
      const m = new THREE.MeshBasicMaterial({ map: this.rayTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.1, color: 0xeafff8 });
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(w, WATER_TOP - 0.6), m);
      ray.position.set((rr() - 0.5) * W * 0.9, (WATER_TOP + 0.6) / 2, -D / 2 + 0.6 + rr() * (D - 1.8));
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
    const men = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.06), menMat); men.position.set(0, WATER_TOP, fz - 0.005); men.renderOrder = 11;
    this.group.add(men);
    // ガラスの映りこみ（うすい斜めの光）
    const glare = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({
      map: gradientTexture(256, 4, [[0, 'rgba(255,255,255,0)'], [0.62, 'rgba(255,255,255,0)'], [0.7, 'rgba(255,255,255,0.07)'], [0.76, 'rgba(255,255,255,0.02)'], [0.8, 'rgba(255,255,255,0.06)'], [0.86, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']], false),
      transparent: true, depthWrite: false, depthTest: false, fog: false }));
    glare.position.set(0, H / 2, fz + 0.005); glare.renderOrder = 11;
    this.group.add(glare);
    // にごり（手前に一枚かぶせる）
    this.murk = new THREE.Mesh(new THREE.PlaneGeometry(W, WATER_TOP), new THREE.MeshBasicMaterial({ color: MURK, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false }));
    this.murk.position.set(0, WATER_TOP / 2, D / 2 - 0.05); this.murk.renderOrder = 9;
    this.group.add(this.murk);

    // 浮遊物の位置
    const mp = this.motes.geometry.attributes.position;
    for (let i = 0; i < this.moteCount; i++) { const ph = this.motePh[i]; mp.setXYZ(i, (ph[0] - 0.5) * W, 1 + ph[1] * (WATER_TOP - 1.4), (ph[2] - 0.5) * D); }
    mp.needsUpdate = true;

    this.setDecor(this.decorIds, true);
    this.applyWater();
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
    const W = this.W, D = TANK_D;
    const used = {};
    const restFrom = [];
    const builders = {
      stone: (i) => this.makeStones(i === 0 ? -0.24 * W : 0.12 * W, -1.2 - i * 0.6, 21 + i),
      rock: (i) => this.makeStones(0.1 * W, -1.5, 31 + i),
      plant: (i) => { const s = [[-0.4, -2.5], [0.33, -2.6], [-0.08, -2.7], [0.42, -1.3]][i % 4]; return this.makePlant(s[0] * W, s[1], 5 + i); },
      driftwood: () => this.makeDriftwood(0.02 * W, -1.9),
      liverock: (i) => this.makeLiverock((0.18 - i * 0.4) * W, -1.6),
      coral: (i) => this.makeCoral((-0.3 + i * 0.5) * W, -2.0),
      air_pump: () => this.makeAirStone(0.27 * W, -2.5),
      air: () => this.makeAirStone(0.27 * W, -2.5),
      heater: () => this.makeHeater(-0.44 * W, -D / 2 + 0.35),
      filter: () => this.makeFilter(0.45 * W, -D / 2 + 0.45),
      light: () => this.makeLight(),
    };
    for (const id of ids) {
      const n = used[id] = (used[id] ?? -1) + 1;
      const fn = builders[id];
      let obj = fn ? fn(n) : this.makeStones((((n * 37 + id.length * 13) % 10) / 10 - 0.5) * 0.7 * W, -1.4, id.length * 7 + n, true);
      if (obj) {
        this.decorGroup.add(obj);
        if (['stone', 'rock', 'plant', 'driftwood', 'liverock', 'coral'].includes(id) || !fn) restFrom.push(obj);
      }
    }
    // 休む場所（石・水草・流木の手前、底から少し上）
    const spots = [];
    for (const o of restFrom) {
      const bx = new THREE.Box3().setFromObject(o);
      const cx = (bx.min.x + bx.max.x) / 2;
      const z = Math.min(bx.max.z + 0.6, this.bounds.maxZ - 0.3);
      const sand = this.sandHeight(cx, z);
      spots.push({ x: cx, z, y: sand + clamp((bx.max.y - sand) * 0.5, 0.9, 2.2) });
    }
    if (!spots.length) for (const fx of [-0.3, 0.3]) spots.push({ x: fx * W, z: -0.5, y: this.sandHeight(fx * W, -0.5) + 1.3 });
    this.bounds.restSpots = spots;
    // setWater で bubbles: true なのに エアポンプが無いときは、エアストーンを自動で置く
    this.autoStone = null;
    this.applyWater();
  }

  _ensureAutoStone() {
    if (this.autoStone || this.emitters.some((e) => e.kind === 'air')) return;
    this.autoStone = this.makeAirStone(0.27 * this.W, -2.5);
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

  makeLiverock(x, z) {
    const grp = new THREE.Group();
    const R = rng(91);
    const cols = ['#9b6c8e', '#b88a77', '#8a6aa0', '#c39a7a'];
    for (let i = 0; i < 4; i++) {
      const r = [1.1, 0.8, 0.6, 0.55][i];
      const m = new THREE.Mesh(this.rockGeometry(200 + i, r, 0.8), new THREE.MeshLambertMaterial({ color: cols[i], flatShading: true }));
      const px = x + [0, 0.9, -0.8, 0.2][i], pz = z + [0, 0.3, 0.2, -0.3][i];
      m.position.set(px, this.sandHeight(px, pz) + [0.2, 0.1, 0.1, 1.0][i], pz);
      m.rotation.set(R(), R() * 6, R());
      grp.add(m);
    }
    return grp;
  }

  makeCoral(x, z) {
    const grp = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: '#ff8a8a' });
    const R = rng(77);
    const base = this.sandHeight(x, z);
    const branch = (px, py, pz, len, ang, depth) => {
      const g = new THREE.CylinderGeometry(0.06 * (depth + 1) * 0.6, 0.08 * (depth + 1) * 0.6, len, 6);
      g.translate(0, len / 2, 0);
      const m = new THREE.Mesh(g, mat);
      m.position.set(px, py, pz); m.rotation.z = ang; m.rotation.x = (R() - 0.5) * 0.6;
      grp.add(m);
      if (depth > 0) {
        const ex = px - Math.sin(ang) * len, ey = py + Math.cos(ang) * len;
        branch(ex, ey, pz, len * 0.75, ang - 0.5, depth - 1);
        branch(ex, ey, pz, len * 0.75, ang + 0.45, depth - 1);
      }
    };
    branch(x, base, z, 0.9, 0, 3);
    return grp;
  }

  makePlant(x, z, seed) {
    const grp = new THREE.Group();
    const R = rng(seed * 13);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const U = this.uniforms;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aPh;')
        .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
          float hh = max(position.y, 0.0);
          transformed.x += sin(uTime * 0.9 + aPh + hh * 0.5) * 0.06 * hh * hh * 0.25;
          transformed.z += cos(uTime * 0.7 + aPh * 1.3) * 0.04 * hh * hh * 0.25;`);
    };
    const pos = [], colr = [], ph = [], idx = [];
    const cA = new THREE.Color('#2f7a2c'), cB = new THREE.Color('#7fcf4a');
    const blades = 11;
    let vi = 0;
    for (let k = 0; k < blades; k++) {
      const h = 2.6 + R() * 3.4;
      const w = 0.16 + R() * 0.12;
      const lean = (R() - 0.5) * 0.9;
      const bx = (R() - 0.5) * 0.9, bz = (R() - 0.5) * 0.7;
      const rot = R() * Math.PI;
      const p = R() * 6;
      const segs = 8;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const y = t * h;
        const ww = w * (1 - t * 0.75) * (t < 0.08 ? 0.6 : 1);
        const cx = bx + lean * t * t * h * 0.25;
        for (const side of [-1, 1]) {
          pos.push(cx + Math.cos(rot) * ww * side * 0.5, y, bz + Math.sin(rot) * ww * side * 0.5);
          const c = cA.clone().lerp(cB, t * 0.8 + R() * 0.1);
          colr.push(c.r, c.g, c.b);
          ph.push(p);
        }
        if (s < segs) { const a = vi + s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      vi += (segs + 1) * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    g.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, this.sandHeight(x, z) - 0.1, z);
    grp.add(m);
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
    lip.rotation.z = Math.PI / 2; lip.position.set(x - 1.3, WATER_TOP - 0.45, z + 0.15);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.4, 8), mat);
    pipe.position.set(x - 0.75, TANK_H - 2.6 - 2.2, z + 0.05);
    const grate = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.7, 10), new THREE.MeshLambertMaterial({ color: '#5c6a70' }));
    grate.position.set(x - 0.75, TANK_H - 7.2, z + 0.05);
    grp.add(body, lip, pipe, grate);
    this.emitters.push({ kind: 'filter', x: x - 1.55, y: WATER_TOP - 0.45, z: z + 0.2, rate: 7, spread: 0.25, size: [0.05, 0.1], acc: 0 });
    return grp;
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
    if (w.dirt !== undefined) this.water.dirt = clamp(+w.dirt || 0, 0, 1);
    if (w.light !== undefined) this.water.light = clamp(+w.light, 0, 1);
    if (w.bubbles !== undefined) this.water.bubbles = w.bubbles;
    this.applyWater();
  }

  get hasLightDecor() { return this.decorIds.includes('light'); }

  applyWater() {
    const { dirt } = this.water;
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
    const d = this.water.dirt;
    this.scene.fog.near = camDist - 1 - d * 6;
    this.scene.fog.far = camDist + TANK_D + 14 - d * (TANK_D + 9);
  }

  get bubblesOn() {
    if (this.water.bubbles === false) return false;
    return true;
  }

  // ---------------- 餌 ----------------
  dropFood(x, z) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      let f = this.foods.find((q) => !q.alive && q.gone);
      if (!f) { if (this.foods.length >= this.maxFood) { f = this.foods.find((q) => q.landed) || this.foods[0]; } else { f = { pos: new THREE.Vector3() }; this.foods.push(f); } }
      Object.assign(f, { alive: true, gone: false, landed: false, age: -i * 0.12, claims: 0, sway: Math.random() * 6, vy: 0.6 + Math.random() * 0.15, fade: 1 });
      f.pos.set(clamp(x + (Math.random() - 0.5) * 0.9, this.bounds.minX + 0.3, this.bounds.maxX - 0.3), WATER_TOP - 0.05, clamp(z + (Math.random() - 0.5) * 0.9, this.bounds.minZ, this.bounds.maxZ));
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
    r.m.position.set(x, WATER_TOP - 0.02, z);
    r.m.visible = true;
  }

  updateFood(dt) {
    const m4 = _m4, q = _q, s = _s;
    let n = 0;
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
        if (f.landT > 30) { f.fade -= dt * 0.5; if (f.fade <= 0) { f.alive = false; f.gone = true; continue; } }
      }
      q.setFromEuler(_e.set(f.sway, f.age * 0.6 + f.sway, 0));
      s.setScalar(Math.min(1, f.fade) * Math.min(1, (f.age + 0.2) * 3));
      m4.compose(f.pos, q, s);
      this.foodMesh.setMatrixAt(n, m4);
      n++;
    }
    this.foodMesh.count = n;
    this.foodMesh.instanceMatrix.needsUpdate = true;
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
    this.uniforms.uTime.value = this.time;
    // 光の筋
    for (const r of this.rays) {
      const u = r.userData;
      r.position.x = u.x0 + Math.sin(this.time * 0.15 + u.ph) * 0.6;
      r.material.opacity = (u.base + Math.sin(this.time * 0.5 + u.ph) * 0.04) * (u.amt ?? 1);
    }
    if (this.heaterGlow) this.heaterGlow.emissiveIntensity = 0.45 + Math.sin(this.time * 1.3) * 0.15;
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
        if (bb.y > WATER_TOP - 0.05 || bb.x < this.bounds.minX) bb.alive = false;
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
    kill(this.bubblePoints); kill(this.motes); kill(this.foodMesh);
    for (const r of this.ripples) kill(r.m);
    this.caustic.dispose(); this.rayTex.dispose(); this.bubbleTex.dispose(); this.rippleTex.dispose();
    this.scene.remove(this.group, this.decorGroup, this.bubblePoints, this.motes, this.foodMesh, this.hemi, this.sun);
  }
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
