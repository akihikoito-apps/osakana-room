// v0.10.1 レース景色係：レースの 海の 中の 景色（水の 色・遠景・中景・むれの 魚・大きな いきもの・ひかり・つぶ）。
// あたり判定とは かんけい ない 見た目 だけ。scene.js から createBackdrop(scene, course, …) で つくり、
// 1こま ごとに update(dt, t, camera, player)。つくった geometry・material は scene に 入れて あるので
// scene.js の dispose（scene.traverse）で すてる。テクスチャは own() で scene.js の 一覧に のせる。
import * as THREE from '../../vendor/three.module.min.js';
import { frameAt, worldOf, seeded } from './course.js';

// Codex に 描かせた 絵（sw.js の キャッシュ一覧にも 入れる）
export const RACE_ART = {
  far: { easy: 'assets/race/far_reef.png', normal: 'assets/race/far_kelp.png', hard: 'assets/race/far_cave.png' },
  props: { easy: 'assets/race/props_reef.png', normal: 'assets/race/props_kelp.png', hard: 'assets/race/props_cave.png' },
  school: 'assets/race/school.png',
  manta: 'assets/race/manta.png',
  turtle: 'assets/race/turtle.png',
  whale: 'assets/race/whale.png',
};

// コースごとの 水の 色（上＝光の さす 水面がわ、hor＝水平・フォグ、deep＝下の 深い 青）
export const THEMES = {
  easy: {
    top: 0xbaf0f2, hor: 0x3aa6c9, deep: 0x0f4f7c, sun: 0xfff6dc, sunK: 1, fog: [16, 78],
    farTint: [0x3f98ba, 0x2a7fa6], farHaze: [0.72, 0.5], farH: [30, 22], farRep: [5, 7], propTint: 0xa9d3df, propHaze: 0.0,
    snow: 0xeafcff, ray: 0.11, caus: 0.26, school: 0xd4ecf4, creatures: ['manta', 'turtle'],
  },
  normal: {
    top: 0xa6e6da, hor: 0x2f8ea5, deep: 0x0c4560, sun: 0xf4ffe4, sunK: 0.8, fog: [15, 72],
    farTint: [0x348c94, 0x23727c], farHaze: [0.7, 0.48], farH: [44, 34], farRep: [7, 9], propTint: 0x9cc9c4, propHaze: 0.0,
    snow: 0xe6fff6, ray: 0.1, caus: 0.22, school: 0xcde8ea, creatures: ['turtle', 'manta'],
  },
  hard: {
    top: 0x5b9bcb, hor: 0x1d5f8e, deep: 0x061f3e, sun: 0xd8f0ff, sunK: 0, fog: [13, 62],
    farTint: [0x285f8a, 0x1b4b74], farHaze: [0.66, 0.44], farH: [36, 28], farRep: [5, 7], propTint: 0x7fa6c4, propHaze: 0.0,
    snow: 0xb4e2ff, ray: 0.05, caus: 0.12, school: 0xb4d4ea, creatures: ['whale', 'manta'],
  },
};

// 中景の 板の 絵（props_*.png は 横に 4つ ならんだ 絵。1つ＝横 1/4。w/h＝絵の よこ÷たて）
// size＝そとがわに おく ときの 高さの はんい
const PROP_CELLS = 4;

export function createBackdrop(scene, c, { rootUrl, own, rnd = seeded(c.def.seed * 13 + 5), propInfo = null } = {}) {
  const T = THEMES[c.level] || THEMES.easy;
  const col = (x) => new THREE.Color(x);
  const hor = col(T.hor);
  scene.background = hor.clone();
  scene.fog = new THREE.Fog(T.hor, T.fog[0], T.fog[1]);
  const loader = new THREE.TextureLoader();
  const load = (path, onOk) => {
    const t = own(loader.load(rootUrl + path, (tt) => { if (!stopped) onOk?.(tt); }, undefined, () => {}));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  let stopped = false;
  const uTime = { value: 0 };
  const groundY = minOf(c.py) - 0.7;   // とおくの 床（コースの いちばん ひくい ところ より すこし 下）

  // ---------- 1. 水の 色（カメラに ついてくる 大きな 球） ----------
  const sunDir = new THREE.Vector3(0.25, 1, 0.35).normalize();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({
    uniforms: { uTop: { value: col(T.top) }, uHor: { value: hor }, uDeep: { value: col(T.deep) }, uSun: { value: col(T.sun) }, uSunDir: { value: sunDir }, uSunK: { value: T.sunK }, uTime },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uTop, uHor, uDeep, uSun, uSunDir; uniform float uTime, uSunK; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float y = d.y;
        vec3 c = y > 0.0 ? mix(uHor, uTop, pow(smoothstep(0.0, 0.9, y), 0.85)) : mix(uHor, uDeep, smoothstep(0.0, 0.35, -y));
        float s = max(dot(d, uSunDir), 0.0);
        c += uSun * (pow(s, 40.0) * 0.45 * uSunK + pow(s, 6.0) * 0.12 * (0.3 + 0.7 * uSunK));
        // 水面の ゆらぎ（上の ほう だけ）
        float w = sin(d.x * 22.0 + uTime * 0.7 + sin(d.z * 9.0 + uTime * 0.4) * 1.5) * sin(d.z * 19.0 - uTime * 0.55);
        c += uSun * 0.06 * w * smoothstep(0.45, 0.95, y);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  }));
  dome.renderOrder = -100; dome.frustumCulled = false;
  scene.add(dome);

  // ---------- 2. とおくの 床（コースの そとの すきまを うめる。フォグで 水の 色に とける） ----------
  const disc = new THREE.Mesh(new THREE.CircleGeometry(140, 40), new THREE.MeshLambertMaterial({ color: c.level === 'hard' ? 0x51606a : c.level === 'normal' ? 0x8a8f74 : 0xb9ab84 }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = groundY;
  disc.renderOrder = -50;
  scene.add(disc);

  // ---------- 3. 遠景の 帯（Codex の 絵。カメラに ついてくる 円筒 2そう） ----------
  const rings = [];
  const ringMat = (tex, tint, haze, rep, off) => new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uTint: { value: col(tint) }, uHor: { value: hor }, uHaze: { value: haze }, uRep: { value: rep }, uOff: { value: off } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform vec3 uTint, uHor; uniform float uHaze, uRep, uOff; varying vec2 vUv;
      void main(){
        vec4 t = texture2D(map, vec2(vUv.x * uRep + uOff, vUv.y));
        if (t.a < 0.03) discard;
        vec3 c = mix(t.rgb * uTint * 1.6, uHor, uHaze);
        c = mix(c, uHor, (1.0 - smoothstep(0.0, 0.35, vUv.y)) * 0.75);   // 下は 水の 色に とける
        gl_FragColor = vec4(c, t.a);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
  });
  {
    const tex = load(RACE_ART.far[c.level] || RACE_ART.far.easy, () => { for (const r of rings) r.visible = true; });
    tex.wrapS = THREE.RepeatWrapping;
    tex.generateMipmaps = true;
    // 遠い そう（うすい・大きい）と 手前の そう（すこし こい）
    const layers = [
      { r: 94, h: T.farH[0], rep: T.farRep[0], off: 0.0, i: 0, ord: -90 },
      { r: 82, h: T.farH[1], rep: T.farRep[1], off: 0.37, i: 1, ord: -80 },
    ];
    for (const L of layers) {
      const g = new THREE.CylinderGeometry(L.r, L.r, L.h, 72, 1, true);
      g.translate(0, L.h / 2, 0);
      const m = new THREE.Mesh(g, ringMat(tex, T.farTint[L.i], T.farHaze[L.i], L.rep, L.off));
      m.renderOrder = L.ord; m.frustumCulled = false; m.visible = false;
      m.userData.drop = L.i === 0 ? 6 : 4;
      scene.add(m); rings.push(m);
    }
  }

  // ---------- 4. 中景（Codex の 絵の 板を 十字に くんで ならべる。ぜんぶで 1つの 形） ----------
  {
    const cells = propInfo?.[c.level] || PROP_DEFAULT[c.level] || PROP_DEFAULT.easy;
    const pos = [], uv = [], colr = [], idx = [];
    const near = (x, z, minD) => { for (let i = 0; i < c.M; i += 2) { const dx = c.px[i] - x, dz = c.pz[i] - z; if (dx * dx + dz * dz < minD * minD) return true; } return false; };
    const quad = (cx, cy, cz, ang, w, h, cell, shade) => {
      const ax = Math.cos(ang) * w / 2, az = Math.sin(ang) * w / 2;
      const b = pos.length / 3;
      pos.push(cx - ax, cy, cz - az, cx + ax, cy, cz + az, cx + ax, cy + h, cz + az, cx - ax, cy + h, cz - az);
      const u0 = cell.i / PROP_CELLS, u1 = (cell.i + 1) / PROP_CELLS;
      uv.push(u0, 0, u1, 0, u1, 1, u0, 1);
      const lo = 0.55 * shade, hi = shade;
      colr.push(lo, lo, lo, lo, lo, lo, hi, hi, hi, hi, hi, hi);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    const step = c.level === 'normal' ? 2.6 : 3.2;
    for (let s = 0; s < c.length; s += step) {
      for (const side of [-1, 1]) {
        if (rnd() < 0.15) continue;
        const lat = side * (c.half + 8 + rnd() * 20);
        const w = worldOf(c, s + rnd() * step, lat, 0);
        if (near(w.x, w.z, c.half + 6)) continue;
        const cell = pick(cells, rnd);
        const far = Math.abs(lat) - c.half;
        const hgt = (cell.hMin + rnd() * (cell.hMax - cell.hMin)) * (0.8 + far / 40);
        const wid = hgt * cell.aspect;
        const ang = rnd() * Math.PI;
        const y = Math.min(w.y, groundY + 0.6 + (w.y - groundY) * 0.5) - 0.4;
        const shade = 0.75 + rnd() * 0.25;
        quad(w.x, y, w.z, ang, wid, hgt, cell, shade);
        if (cell.cross) quad(w.x, y, w.z, ang + Math.PI / 2, wid, hgt, cell, shade * 0.92);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    g.setIndex(idx);
    const tex = load(RACE_ART.props[c.level] || RACE_ART.props.easy, () => { props.visible = true; });
    const props = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, color: T.propTint, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide }));
    props.visible = false;
    scene.add(props);
  }

  // ---------- 5. むれの 小魚（板の InstancedMesh 1つ。うねって およぐ） ----------
  const schools = [];
  const nSchool = 3, perSchool = c.level === 'hard' ? 34 : 44;
  const fishGeo = new THREE.PlaneGeometry(1.15, 0.33);
  const fishTex = load(RACE_ART.school, () => { swarm.visible = true; });
  const swarm = new THREE.InstancedMesh(fishGeo, new THREE.MeshBasicMaterial({ map: fishTex, color: T.school, alphaTest: 0.4, side: THREE.DoubleSide }), nSchool * perSchool);
  swarm.frustumCulled = false; swarm.visible = false;
  scene.add(swarm);
  for (let k = 0; k < nSchool; k++) {
    const fish = [];
    for (let i = 0; i < perSchool; i++) {
      // まるい かたまり（すこし よこながの だえん）
      const a = rnd() * Math.PI * 2, b = Math.acos(rnd() * 2 - 1), r = Math.cbrt(rnd());
      fish.push({ a: Math.sin(b) * Math.cos(a) * r * 4.6, b: Math.sin(b) * Math.sin(a) * r * 2.6, c: Math.cos(b) * r * 1.5, ph: rnd() * 6, sz: 0.8 + rnd() * 0.45 });
    }
    schools.push({ s: -1e9, lat: 0, h: 6, dir: 1, v: 2, fish, ph: rnd() * 6 });
  }
  const respawnSchool = (sc, meS, first) => {
    sc.dir = rnd() < 0.35 ? -1 : 1;
    sc.s = meS + (first ? 22 + rnd() * 40 : 50 + rnd() * 25);
    sc.lat = (rnd() < 0.5 ? -1 : 1) * (2 + rnd() * 10);
    sc.h = (Math.abs(sc.lat) < 9.5 ? 5.5 : 4) + rnd() * 3;   // コースの 上は 高め（自分の 魚と かさならない）
    sc.v = sc.dir > 0 ? 2.5 + rnd() * 1.5 : 2 + rnd();
  };

  // ---------- 6. とおくの 大きな いきもの（マンタ・ウミガメ・クジラ の シルエット） ----------
  const beasts = [];
  for (const kind of T.creatures) {
    const spec = BEASTS[kind];
    const g = new THREE.PlaneGeometry(spec.w, spec.w / spec.aspect, 8, 1);
    if (spec.flat) { g.rotateX(-Math.PI / 2); g.rotateY(-Math.PI / 2); }   // マンタ：上から 見た 絵を 水平に、あたまを ＋x へ
    const mat = new THREE.MeshBasicMaterial({ color: spec.tint, alphaTest: 0.35, side: THREE.DoubleSide });
    mat.map = load(RACE_ART[kind], () => { b.m.userData.ready = true; });
    const fl = { value: spec.flap };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime; sh.uniforms.uFlap = fl;
      sh.vertexShader = 'uniform float uTime; uniform float uFlap;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        { float ax = abs(position.${spec.flat ? 'z' : 'x'}) / ${(spec.w / 2).toFixed(2)};
          ${spec.flat ? 'transformed.y += sin(uTime * 1.3) * uFlap * ax * ax;' : 'transformed.z += sin(uTime * 2.0 - position.x * 0.6) * uFlap * ax;'} }`);
    };
    mat.customProgramCacheKey = () => 'beast-' + kind;
    const m = new THREE.Mesh(g, mat);
    m.visible = false; m.frustumCulled = false;
    scene.add(m);
    const b = { kind, spec, m, s: 0, lat: 0, h: 0, dir: 1, wait: 3 + rnd() * 6, live: false };
    beasts.push(b);
  }

  // ---------- 7. ひかりの すじ（ゴッドレイ。コースに そって おいて、くぐり ぬける） ----------
  const rayTex = own(new THREE.CanvasTexture(rayCanvas()));
  const rayGeo = new THREE.PlaneGeometry(1, 1);
  rayGeo.translate(0, -0.5, 0);   // 上の はし が 原点
  const rays = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(rayGeo, new THREE.MeshBasicMaterial({ map: rayTex, color: T.sun, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    m.renderOrder = 5; m.frustumCulled = false;
    scene.add(m);
    rays.push({ m, s: -1e9, lat: 0, w: 2, len: 20, ph: rnd() * 6, tilt: 0 });
  }
  const respawnRay = (r, meS, first) => {
    r.s = meS + (first ? -4 + rnd() * 60 : 50 + rnd() * 15);
    r.lat = (rnd() * 2 - 1) * 14;
    r.w = 1.6 + rnd() * 3.2; r.len = 18 + rnd() * 10; r.tilt = 0.12 + rnd() * 0.12;
  };

  // ---------- 8. ただよう つぶ（マリンスノー）と あわ ----------
  const dotTex = own(new THREE.CanvasTexture(dotCanvas()));
  const BOX = [36, 14, 36];
  const ptScale = { value: 300 };   // 画面の 高さから きめる（update）
  const mkPoints = (n, size, opacity, color) => {
    const p = new Float32Array(n * 3), base = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { base[i * 3] = rnd() * BOX[0]; base[i * 3 + 1] = rnd() * BOX[1]; base[i * 3 + 2] = rnd() * BOX[2]; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    // ちかすぎる つぶは けし、とおい つぶは 水に とける
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { map: { value: dotTex }, uCol: { value: col(color) }, uScale: ptScale, uSize: { value: size }, uOp: { value: opacity } },
      vertexShader: `uniform float uScale, uSize, uOp; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float z = -mv.z;
          vA = uOp * smoothstep(1.5, 3.5, z) * (1.0 - smoothstep(16.0, 24.0, z));
          gl_PointSize = min(uSize * uScale / max(0.5, z), uScale * 0.025); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 uCol; varying float vA;
        void main(){ float a = texture2D(map, gl_PointCoord).a * vA; if (a < 0.02) discard; gl_FragColor = vec4(uCol, a);
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false,
    }));
    pts.frustumCulled = false;
    scene.add(pts);
    return { pts, p, base, n };
  };
  const snow = mkPoints(c.level === 'hard' ? 320 : 240, 0.13, 0.75, T.snow);
  const bubbles = mkPoints(36, 0.26, 0.85, 0xf2ffff);

  // ---------- 10. 魚の うしろの あわの すじ（はやく およぐ ほど おおい） ----------
  const NT = 180;
  const tPos = new Float32Array(NT * 3), tA = new Float32Array(NT), tS = new Float32Array(NT);
  const tVel = new Float32Array(NT * 3), tLife = new Float32Array(NT), tMax = new Float32Array(NT);
  let tNext = 0;
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  tg.setAttribute('aA', new THREE.BufferAttribute(tA, 1));
  tg.setAttribute('aS', new THREE.BufferAttribute(tS, 1));
  const trail = new THREE.Points(tg, new THREE.ShaderMaterial({
    uniforms: { map: { value: dotTex }, uCol: { value: col(0xf4ffff) }, uScale: ptScale },
    vertexShader: `attribute float aA; attribute float aS; uniform float uScale; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vA = aA * smoothstep(1.8, 3.6, -mv.z);   // カメラの すぐ まえは 消す（大きな ぼやけた 玉に しない）
        gl_PointSize = min(aS * uScale / max(0.5, -mv.z), uScale * 0.03); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 uCol; varying float vA;
      void main(){ vec4 t = texture2D(map, gl_PointCoord); float a = t.a * vA; if (a < 0.02) discard;
        // まるい ふちが すこし こい あわ
        float r = length(gl_PointCoord - 0.5) * 2.0; float rim = smoothstep(0.55, 0.85, r) * 0.6 + 0.4;
        gl_FragColor = vec4(uCol, a * rim);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  }));
  trail.frustumCulled = false;
  scene.add(trail);
  /** あわを 1つ だす（x,y,z＝魚の しっぽの あたり） */
  function emitBubble(x, y, z, big = 1) {
    const i = tNext; tNext = (tNext + 1) % NT;
    tPos[i * 3] = x + (rnd() - 0.5) * 0.25; tPos[i * 3 + 1] = y + (rnd() - 0.5) * 0.2; tPos[i * 3 + 2] = z + (rnd() - 0.5) * 0.25;
    tVel[i * 3] = (rnd() - 0.5) * 0.4; tVel[i * 3 + 1] = 0.5 + rnd() * 0.7; tVel[i * 3 + 2] = (rnd() - 0.5) * 0.4;
    tMax[i] = tLife[i] = 0.9 + rnd() * 0.7;
    tS[i] = (0.05 + rnd() * 0.07) * big;
  }
  function stepTrail(dt) {
    for (let i = 0; i < NT; i++) {
      if (tLife[i] <= 0) { tA[i] = 0; continue; }
      tLife[i] -= dt;
      tPos[i * 3] += tVel[i * 3] * dt; tPos[i * 3 + 1] += tVel[i * 3 + 1] * dt; tPos[i * 3 + 2] += tVel[i * 3 + 2] * dt;
      const k = tLife[i] / tMax[i];
      tA[i] = Math.max(0, Math.min(1, k * 3)) * 0.85;
    }
    tg.attributes.position.needsUpdate = true; tg.attributes.aA.needsUpdate = true; tg.attributes.aS.needsUpdate = true;
  }

  // ---------- 9. コースティクス（床・岩に 足す ゆらぐ ひかりの あみ） ----------
  const causTex = own(new THREE.CanvasTexture(causticsCanvas(256, seeded(77))));
  causTex.wrapS = causTex.wrapT = THREE.RepeatWrapping;
  const causU = { uCaus: { value: causTex }, uCausT: uTime, uCausK: { value: T.caus }, uCausCol: { value: col(T.sun) } };
  /** material に コースティクスを 足す（k＝つよさの わりあい） */
  function addCaustics(mat, k = 1) {
    const kk = { value: k };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, causU, { uCausM: kk });
      sh.vertexShader = 'varying vec3 vCausW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 cw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          cw = instanceMatrix * cw;
          #endif
          vCausW = (modelMatrix * cw).xyz; }`);
      sh.fragmentShader = 'uniform sampler2D uCaus; uniform float uCausT, uCausK, uCausM; uniform vec3 uCausCol; varying vec3 vCausW;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
        { vec2 cp = vCausW.xz + vec2(0.0, vCausW.y * 0.4);
          float ca = texture2D(uCaus, cp * 0.085 + vec2(uCausT * 0.016, uCausT * 0.011)).r;
          float cb = texture2D(uCaus, mat2(0.8, -0.6, 0.6, 0.8) * cp * 0.067 - vec2(uCausT * 0.012, -uCausT * 0.014)).r;
          // ばしょで つよさに ムラ（ぜんぶ 同じ 明るさに しない）
          float cPatch = 0.35 + 0.65 * smoothstep(-0.4, 0.8, sin(cp.x * 0.11 + uCausT * 0.05) * sin(cp.y * 0.09 - 1.3));
          outgoingLight += uCausCol * diffuseColor.rgb * min(ca, cb) * uCausK * uCausM * 1.6 * cPatch; }
        #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'caus';
    return mat;
  }

  // ---------- 1こま ----------
  const v = new THREE.Vector3();
  let started = false;
  function update(dt, t, camera, me, pxH = 0) {
    if (stopped) return;
    uTime.value = t;
    const cp = camera.position;
    dome.position.copy(cp);
    const meS = me ? me.s : 0;
    const fr = frameAt(c, meS);
    for (const r of rings) r.position.set(cp.x, fr.y - r.userData.drop, cp.z);
    if (!started) {
      started = true;
      for (const sc of schools) respawnSchool(sc, meS, true);
      for (const r of rays) respawnRay(r, meS, true);
    }
    // むれ
    const m4 = M4, q = Q, e = E, sc3 = SC;
    let n = 0;
    for (const sc of schools) {
      sc.s += sc.v * sc.dir * dt;
      if (sc.s < meS - 12 || sc.s > meS + 110) respawnSchool(sc, meS, false);
      const lat = sc.lat + Math.sin(t * 0.21 + sc.ph) * 3.5;
      const hh = sc.h + Math.sin(t * 0.33 + sc.ph * 2) * 1.2;
      const f = frameAt(c, sc.s);
      const cx = f.x + f.rx * lat, cz = f.z + f.rz * lat, cy = f.y + hh;
      const hd = f.h + (sc.dir < 0 ? Math.PI : 0);
      const fx = Math.cos(hd), fz = Math.sin(hd), rx = -fz, rz = fx;
      for (const fi of sc.fish) {
        const ph = t * 1.7 - fi.a * 0.55 + sc.ph;
        const along = fi.a + Math.sin(t * 0.4 + fi.ph) * 0.3;
        const side = fi.b + Math.sin(ph) * 0.9;
        const up = fi.c + Math.cos(ph * 0.8) * 0.45;
        v.set(cx + fx * along + rx * side, cy + up, cz + fz * along + rz * side);
        e.set(Math.sin(t * 9 + fi.ph) * 0.15, -(hd + Math.cos(ph) * 0.35), Math.sin(ph * 0.8) * 0.12, 'YXZ');
        q.setFromEuler(e);
        m4.compose(v, q, sc3.setScalar(fi.sz));
        swarm.setMatrixAt(n++, m4);
      }
    }
    swarm.instanceMatrix.needsUpdate = true;
    // 大きな いきもの：ずっと 先を ゆっくり よこぎる
    for (const b of beasts) {
      if (!b.m.userData.ready) continue;
      if (!b.live) {
        // 絵が とどいたら 1こまだけ 地面の 下に だして シェーダーを さきに つくる（とちゅうで かくっと しない）
        if (!b.warmed) { b.warmed = true; b.m.visible = true; b.m.position.set(0, -500, 0); continue; }
        b.wait -= dt;
        if (b.wait > 0 || beasts.some((o) => o.live)) { b.m.visible = false; continue; }   // 1ぴき ずつ
        b.live = true;
        b.off = 44 + rnd() * 10;          // 自分の 魚より どれだけ 先か（ゆっくり ちかづく）
        b.dir = rnd() < 0.5 ? -1 : 1;
        b.lat = -b.dir * (24 + rnd() * 4);
        b.h = b.spec.hMin + rnd() * (b.spec.hMax - b.spec.hMin);
      }
      b.lat += b.dir * b.spec.v * dt;
      b.off -= dt * 0.8;
      const f = frameAt(c, meS + b.off);
      const yy = f.y + b.h + Math.sin(t * 0.5) * 0.6;
      b.m.position.set(f.x + f.rx * b.lat, yy, f.z + f.rz * b.lat);
      // よこぎる むき（コースの 右むき × dir）
      const hd = Math.atan2(f.rz * b.dir, f.rx * b.dir);
      b.m.rotation.order = 'YXZ';
      b.m.rotation.set(b.spec.flat ? Math.sin(t * 0.6) * 0.15 : 0, -hd, b.spec.flat ? 0.12 : Math.sin(t * 0.4) * 0.05);
      b.m.visible = true;
      if (Math.abs(b.lat) > 30 || b.off < 14) { b.live = false; b.wait = 5 + rnd() * 9; b.m.visible = false; }
    }
    // ひかりの すじ
    for (const r of rays) {
      if (r.s < meS - 6) respawnRay(r, meS, false);
      const f = frameAt(c, r.s);
      const x = f.x + f.rx * r.lat, z = f.z + f.rz * r.lat;
      r.m.position.set(x, f.y + r.len * 0.82, z);
      r.m.scale.set(r.w, r.len, 1);
      // カメラの ほうを むく（たてじく だけ）・すこし かたむける
      r.m.rotation.set(0, Math.atan2(cp.x - x, cp.z - z), r.tilt);
      const d = Math.hypot(cp.x - x, cp.z - z);
      const fade = Math.min(1, Math.max(0, (d - 2) / 6)) * Math.min(1, Math.max(0, (70 - d) / 25));
      r.m.material.opacity = T.ray * fade * (0.65 + 0.35 * Math.sin(t * 0.5 + r.ph));
    }
    // つぶ・あわ（カメラの まわりの 箱で ぐるぐる）
    stepPoints(snow, dt, t, cp, 0.12, 0.25);
    stepPoints(bubbles, dt, t, cp, 0.9, 0);
    stepTrail(dt);
    if (pxH) ptScale.value = pxH * 0.5 / Math.tan((camera.fov * Math.PI) / 360);
  }
  function stepPoints(P, dt, t, cp, rise, sway) {
    const { p, base, n } = P;
    for (let i = 0; i < n; i++) {
      base[i * 3 + 1] += dt * rise * (0.5 + (i % 5) * 0.25);
      base[i * 3] += Math.sin(t * 0.3 + i) * sway * dt;
      p[i * 3] = cp.x + mod(base[i * 3] - cp.x, BOX[0]) - BOX[0] / 2;
      p[i * 3 + 1] = cp.y + mod(base[i * 3 + 1] - cp.y, BOX[1]) - BOX[1] * 0.55;
      p[i * 3 + 2] = cp.z + mod(base[i * 3 + 2] - cp.z, BOX[2]) - BOX[2] / 2;
    }
    P.pts.geometry.attributes.position.needsUpdate = true;
  }
  function dispose() { stopped = true; }
  return { update, addCaustics, emitBubble, dispose, theme: T, groundY };
}

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), SC = new THREE.Vector3();
const mod = (a, b) => ((a % b) + b) % b;
const minOf = (arr) => { let m = Infinity; for (let i = 0; i < arr.length; i++) if (arr[i] < m) m = arr[i]; return m; };
const pick = (arr, rnd) => { let tot = 0; for (const a of arr) tot += a.wt || 1; let x = rnd() * tot; for (const a of arr) { x -= a.wt || 1; if (x <= 0) return a; } return arr[arr.length - 1]; };

// 大きな いきもの（w＝よこはば、aspect＝絵の よこ÷たて、flat＝上から 見た 絵、v＝よこぎる はやさ）
const BEASTS = {
  manta: { w: 8.5, aspect: 1.52, flat: true, flap: 0.9, v: 3.2, hMin: 9, hMax: 13, tint: 0xb4d2e2 },
  turtle: { w: 5.5, aspect: 1.85, flat: false, flap: 0.2, v: 2.4, hMin: 7, hMax: 11, tint: 0xc2dde0 },
  whale: { w: 17, aspect: 2.44, flat: false, flap: 0.5, v: 2.0, hMin: 12, hMax: 16, tint: 0x9fbdd4 },
};

// 中景の 板の きまり（i＝絵の 何ばんめ、aspect＝よこ÷たて、hMin/hMax＝高さ、cross＝十字に くむ、wt＝でやすさ）
const PROP_DEFAULT = {
  easy: [   // えだサンゴ・テーブルサンゴ・えだサンゴ（赤）・まるい サンゴ
    { i: 0, aspect: 1.0, hMin: 3, hMax: 6, cross: true, wt: 3 },
    { i: 1, aspect: 1.0, hMin: 3.5, hMax: 6, cross: true, wt: 2 },
    { i: 2, aspect: 1.0, hMin: 3, hMax: 5.5, cross: true, wt: 2 },
    { i: 3, aspect: 1.0, hMin: 2.5, hMax: 4.5, cross: true, wt: 2 },
  ],
  normal: [   // せの たかい ケルプ・2本の ケルプ・岩の こんぶ（絵の 下 1/4）・こけの 岩（下 1/4）
    { i: 0, aspect: 0.5, hMin: 7, hMax: 13, cross: true, wt: 4 },
    { i: 1, aspect: 0.5, hMin: 7, hMax: 12, cross: true, wt: 3 },
    { i: 2, aspect: 0.5, hMin: 10, hMax: 14, cross: true, wt: 2 },
    { i: 3, aspect: 0.5, hMin: 10, hMax: 16, cross: true, wt: 2 },
  ],
  hard: [   // 岩の 柱・管の 海綿・ウミウチワ・岩と サンゴ
    { i: 0, aspect: 1.0, hMin: 6, hMax: 11, cross: true, wt: 3 },
    { i: 1, aspect: 1.0, hMin: 3, hMax: 5, cross: true, wt: 2 },
    { i: 2, aspect: 1.0, hMin: 3.5, hMax: 6, cross: true, wt: 2 },
    { i: 3, aspect: 1.0, hMin: 4, hMax: 7, cross: true, wt: 2 },
  ],
};

// ---------- 手で つくる テクスチャ ----------
function rayCanvas() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
  const g = cv.getContext('2d');
  const img = g.createImageData(64, 256);
  for (let y = 0; y < 256; y++) {
    const fy = Math.pow(1 - y / 255, 1.3) * Math.min(1, y / 20 + 0.4);
    for (let x = 0; x < 64; x++) {
      const dx = (x - 31.5) / 32;
      const fx = Math.exp(-dx * dx * 5) * (0.85 + 0.15 * Math.sin(x * 0.7));
      const a = fx * fy;
      const k = (y * 64 + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}
function dotCanvas() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 15);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.75)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  return cv;
}
/** シームレスな コースティクス（ボロノイの さかいめ が ひかる） */
export function causticsCanvas(N = 256, r = seeded(77)) {
  const G = 7, pts = [];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) pts.push([(i + 0.15 + r() * 0.7) / G, (j + 0.15 + r() * 0.7) / G]);
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x + 0.5) / N, w = (y + 0.5) / N;
    let d1 = 9, d2 = 9;
    const ci = Math.floor(u * G), cj = Math.floor(w * G);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ci + di, jj = cj + dj;
      const p = pts[(((jj % G) + G) % G) * G + (((ii % G) + G) % G)];
      const px = p[0] + Math.floor(ii / G), py = p[1] + Math.floor(jj / G);
      const d = Math.hypot(px - u, py - w);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    const e = (d2 - d1) * G;           // さかいめで 0
    const vv = Math.pow(Math.max(0, 1 - e / 0.22), 2.2);
    const k = (y * N + x) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.round(vv * 255); img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}
