// v0.10 レース係：レースの 3D（Three.js）。コース・しょうがいぶつ・魚・カメラ。
// 魚の 見た目は js/aquarium/fishModel.js を import して つかう だけ（中身は かえない）。
// レースを でたら dispose() で geometry・material・texture・renderer を ぜんぶ すてる。
import * as THREE from '../../vendor/three.module.min.js';
import { SpeciesLibrary, makeFishMaterial, loadDreamLook } from '../aquarium/fishModel.js';
import { mergeSpec } from '../aquarium/speciesDefaults.js';
import { dreamSpec } from '../aquarium/dreamSpec.js';
import { frameAt, worldOf, seeded, curvatureAt } from './course.js';
import { createBackdrop } from './backdrop.js';

const FISH_LEN = 2.1;
const THICK = 1.9;   // うしろから 見ても ほそすぎない ように あつみを ふやす（見た目だけ）   // 魚の 見た目の ながさ（みんな おなじ。見た目で 不公平に しない）

export function createRaceScene(canvas, race, { fishList = [], speciesById = {}, rootUrl = new URL('../../', import.meta.url).href } = {}) {
  const c = race.course;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 120);
  const textures = [];
  const own = (t) => { textures.push(t); return t; };
  const rnd = seeded(c.def.seed * 7 + 3);
  // 海の 中の 景色（水の 色・フォグ・遠景・むれの 魚・ひかり・つぶ）は backdrop.js
  const bd = createBackdrop(scene, c, { rootUrl, own });
  const LOOK = LOOKS[c.level] || LOOKS.easy;
  scene.add(new THREE.HemisphereLight(LOOK.sky, LOOK.ground, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(20, 40, 10);
  scene.add(sun);

  // ---------- 床（すな）----------
  const sandTex = own(new THREE.CanvasTexture(sandCanvas(c.level)));
  sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
  sandTex.colorSpace = THREE.SRGBColorSpace;
  {
    // よこの ならび：コースの 中（あかるい みち）と そと（くらい すな）の さかいを くっきり。
    // いちばん そとは とおくの 床（backdrop の groundY）まで なだらかに おりる
    const EXT = 9, OUT2 = 17;
    const lats = [-(c.half + OUT2), -(c.half + 13), -(c.half + EXT), -(c.half + 4), -(c.half + 1.2), -c.half - 0.02, -c.half + 0.02, -c.half * 0.5, 0, c.half * 0.5, c.half - 0.02, c.half + 0.02, c.half + 1.2, c.half + 4, c.half + EXT, c.half + 13, c.half + OUT2];
    const COLS = lats.length - 1;
    const n = Math.ceil(c.length / 1.0);
    const pos = [], uv = [], idx = [], col = [];
    const road = new THREE.Color(LOOK.road), outside = new THREE.Color(LOOK.outside), cc = new THREE.Color();
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * c.length;
      const f = frameAt(c, s);
      for (let j = 0; j <= COLS; j++) {
        const lat = lats[j];
        const out = Math.max(0, Math.abs(lat) - c.half);
        let y = f.y + (out > 0 ? out * 0.18 + Math.sin(s * 0.3 + j) * 0.15 * Math.min(1, out) : -0.02);
        if (out > EXT) { const k = Math.min(1, (out - EXT) / (OUT2 - EXT)); y = y + (bd.groundY + 0.05 - y) * k * k * (3 - 2 * k) + Math.sin(s * 0.21 + j * 1.7) * 0.35 * (1 - k); }
        pos.push(f.x + f.rx * lat, y, f.z + f.rz * lat);
        uv.push(lat / 4, s / 4);
        if (out > 0.01) cc.copy(outside).multiplyScalar(1 - Math.min(1, out / OUT2) * 0.25); else cc.copy(road);
        col.push(cc.r, cc.g, cc.b);
      }
    }
    const R = COLS + 1;
    for (let i = 0; i < n; i++) for (let j = 0; j < COLS; j++) {
      const a = i * R + j, b = (i + 1) * R + j;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const floor = new THREE.Mesh(g, bd.addCaustics(new THREE.MeshLambertMaterial({ map: sandTex, vertexColors: true, side: THREE.DoubleSide }), 1));
    scene.add(floor);
  }

  // ---------- コースの ふち（こいしの ならび）と そとの いわ・さんご・かいそう ----------
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
  // ふちの こいし：まるく ひらたい 石。2しょく を 3こずつ（みちの はしが わかる）
  const pebbleGeo = rockGeo(91, 0, 0.1);
  const pebbleMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  const nPeb = Math.floor(c.length / 1.6) * 2;
  const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, nPeb);
  const colA = new THREE.Color(LOOK.pebA), colB = new THREE.Color(LOOK.pebB);
  for (let i = 0; i < nPeb; i++) {
    const k = Math.floor(i / 2), side = i % 2 ? 1 : -1;
    const s = k * 1.6;
    const w = worldOf(c, s, side * (c.half + 0.15), 0.06);
    e.set(0, rnd() * 6, 0); q.setFromEuler(e);
    const r = 0.24 + rnd() * 0.1;
    m4.compose(v3.set(w.x, w.y, w.z), q, sc.set(r * 1.25, r * 0.7, r));
    pebbles.setMatrixAt(i, m4);
    pebbles.setColorAt(i, Math.floor(k / 3) % 2 ? colA : colB);
  }
  scene.add(pebbles);

  // そとの いわ：なめらかに でこぼこ した 3しゅるいの 形（下は くらく、上に こけ・もの いろ）
  const wallMat = bd.addCaustics(new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), 0.7);
  const wallGeos = [rockGeo(11, 2, 0.24, LOOK.moss), rockGeo(23, 2, 0.3, LOOK.moss), rockGeo(37, 1, 0.2, LOOK.moss)];
  const nWall = Math.floor(c.length / 2.2) * 2;
  const wallSets = wallGeos.map((g) => ({ g, list: [] }));
  const rockCols = LOOK.rocks.map((x) => new THREE.Color(x));
  for (let i = 0; i < nWall; i++) {
    const s = Math.floor(i / 2) * 2.2 + rnd() * 1.5, side = i % 2 ? 1 : -1;
    const w = worldOf(c, s, side * (c.half + 2.4 + rnd() * 3.5), 0.1);
    e.set((rnd() - 0.5) * 0.4, rnd() * 6, (rnd() - 0.5) * 0.4); q.setFromEuler(e);
    const r = 0.7 + rnd() * 1.4;
    m4.compose(v3.set(w.x, w.y + r * 0.12, w.z), q, sc.set(r * (1 + rnd() * 0.4), r * (0.55 + rnd() * 0.5), r));
    wallSets[i % 3].list.push([m4.clone(), rockCols[Math.floor(rnd() * rockCols.length)]]);
  }
  for (const ws of wallSets) {
    const im = new THREE.InstancedMesh(ws.g, wallMat, ws.list.length);
    ws.list.forEach(([mm, cc], k) => { im.setMatrixAt(k, mm); im.setColorAt(k, cc); });
    scene.add(im);
  }

  // さんご：えだサンゴ と まるい ドーム（コースごとに いろ・かず が ちがう）
  {
    const coralMat = bd.addCaustics(new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), 0.6);
    const kinds = [branchCoralGeo(5), domeCoralGeo(8)];
    const lists = [[], []];
    const coralCols = LOOK.corals.map((x) => new THREE.Color(x));
    const nCoral = Math.floor(c.length / LOOK.coralStep);
    for (let i = 0; i < nCoral; i++) {
      const s = i * LOOK.coralStep + rnd() * 3, side = rnd() < 0.5 ? 1 : -1;
      const lat = side * (c.half + 1.3 + rnd() * 2.2);
      const cc = coralCols[Math.floor(rnd() * coralCols.length)];
      const kind = rnd() < LOOK.branch ? 0 : 1;
      const w = worldOf(c, s, lat, -0.05);
      e.set(0, rnd() * 6, 0); q.setFromEuler(e);
      const r = kind ? 0.45 + rnd() * 0.45 : 0.7 + rnd() * 0.6;
      m4.compose(v3.set(w.x, w.y, w.z), q, sc.set(r, r * (kind ? 0.8 + rnd() * 0.4 : 1), r));
      lists[kind].push([m4.clone(), cc]);
    }
    kinds.forEach((g, k) => {
      if (!lists[k].length) { g.dispose(); return; }
      const im = new THREE.InstancedMesh(g, coralMat, lists[k].length);
      lists[k].forEach(([mm, cc], j) => { im.setMatrixAt(j, mm); im.setColorAt(j, cc); });
      scene.add(im);
    });
  }

  // かいそう（そとの かざり と コースの 中の しょうがいぶつ）。ぜんぶ 1つの InstancedMesh、ゆれは シェーダーで
  // 十字に 組んだ 2まい（どこから 見ても ほそい 棒に ならない）
  const bladeGeo = mergeBlade();
  const bladeTex = own(new THREE.CanvasTexture(bladeCanvas()));
  bladeTex.colorSpace = THREE.SRGBColorSpace;
  const bladeTime = { value: 0 };
  const bladeMat = new THREE.MeshLambertMaterial({ map: bladeTex, color: 0xffffff, alphaTest: 0.4, side: THREE.DoubleSide });
  bladeMat.onBeforeCompile = (sh) => {
    sh.uniforms.uBladeT = bladeTime;
    sh.vertexShader = 'uniform float uBladeT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      { // カメラの すぐ まえの はっぱは ちぢめる（がめんを ふさがない）
        vec4 bw = modelMatrix * vec4(instanceMatrix[3].xyz, 1.0);
        transformed *= smoothstep(1.4, 3.2, distance(bw.xyz, cameraPosition));
        float ph = instanceMatrix[3].x * 1.3 + instanceMatrix[3].z * 0.9;
        float hs = length(instanceMatrix[1].xyz);
        float yy = position.y * position.y;
        transformed.x += sin(uBladeT * 1.6 + ph) * (0.12 + 0.06 * sin(ph * 3.1)) * hs * yy;
        transformed.z += sin(uBladeT * 1.1 + ph * 1.7) * 0.05 * hs * yy; }
      #endif`);
  };
  bladeMat.customProgramCacheKey = () => 'blade';
  const bladeCols = LOOK.blades.map((x) => new THREE.Color(x));
  const bladeList = [];
  const addBlade = (x, y, z, hgt, colIdx) => {
    e.set(0, rnd() * Math.PI, 0); q.setFromEuler(e);
    bladeList.push([new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q.clone(), new THREE.Vector3(1, hgt, 1)), bladeCols[colIdx % bladeCols.length]]);
  };
  for (let i = 0; i < c.length / LOOK.bladeStep; i++) {
    const s = i * LOOK.bladeStep + rnd() * 2, side = rnd() < 0.5 ? 1 : -1;
    const w = worldOf(c, s, side * (c.half + 0.9 + rnd() * 4.5), 0);
    const tall = LOOK.bladeTall && rnd() < 0.5;
    addBlade(w.x, w.y, w.z, tall ? 2.8 + rnd() * 2.6 : 1.2 + rnd() * 1.6, i);
  }

  // ---------- しょうがいぶつ ----------
  const rockMat = bd.addCaustics(new THREE.MeshLambertMaterial({ color: LOOK.obstacle }), 0.7);
  const rockTopMat = new THREE.MeshLambertMaterial({ color: 0x6fae7a });
  // あわの わ：とおくからも 見えるように あかるく ふとく
  const ringMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x7fe9ff, emissiveIntensity: 1.0, transparent: true, opacity: 0.95, fog: false });
  const ringGeo = new THREE.TorusGeometry(1, 0.16, 10, 32);
  const bubbleGeo = new THREE.SphereGeometry(0.09, 8, 6);
  const bubbleMat = new THREE.MeshLambertMaterial({ color: 0xeaffff, emissive: 0x9fe8ff, emissiveIntensity: 0.4, transparent: true, opacity: 0.8 });
  const rings = [];
  for (const o of c.obstacles) {
    const w = worldOf(c, o.s, o.lat, 0);
    if (o.kind === 'rock') {
      const g = new THREE.IcosahedronGeometry(1, 2);
      jiggle(g, seeded(o.seed));
      smoothNormals(g);
      const m = new THREE.Mesh(g, rockMat);
      m.position.set(w.x, w.y + o.height * 0.42, w.z);
      m.scale.set(o.w * 1.05, o.height * 0.62, o.len * 1.2);
      m.rotation.y = -w.heading + Math.PI / 2;
      scene.add(m);
      // うえの こけ（めじるし）
      const top = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), rockTopMat);
      top.position.set(w.x, w.y + o.height * 0.66, w.z);
      top.scale.set(o.w * 0.8, o.height * 0.32, o.len * 0.9);
      top.rotation.y = m.rotation.y;
      scene.add(top);
    } else if (o.kind === 'weed') {
      const r2 = seeded(o.seed);
      const n = Math.round(o.w * o.len * 2.4);
      for (let i = 0; i < n; i++) {
        const ww = worldOf(c, o.s + (r2() * 2 - 1) * o.len, o.lat + (r2() * 2 - 1) * o.w, 0);
        addBlade(ww.x, ww.y, ww.z, o.height * (0.85 + r2() * 0.5), i);
      }
    } else {
      const m = new THREE.Mesh(ringGeo, ringMat);
      const ww = worldOf(c, o.s, o.lat, o.h);
      m.position.set(ww.x, ww.y, ww.z);
      m.scale.setScalar(o.r);
      m.rotation.y = Math.PI / 2 - ww.heading;
      scene.add(m);
      const g = new THREE.Group();
      for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(bubbleGeo, bubbleMat); const a = (i / 6) * Math.PI * 2; b.position.set(Math.cos(a) * o.r, Math.sin(a) * o.r, 0); g.add(b); }
      g.position.copy(m.position); g.rotation.y = m.rotation.y;
      scene.add(g);
      rings.push({ o, m, g, pulse: 0 });
    }
  }

  // ---------- カーブの まえの やじるし（そとがわに ならべる） ----------
  {
    const arrowTex = own(new THREE.CanvasTexture(arrowCanvas()));
    arrowTex.colorSpace = THREE.SRGBColorSpace;
    const arrowMat = new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, side: THREE.DoubleSide });
    const arrowGeo = new THREE.PlaneGeometry(1.6, 1.6);
    let last = -99;
    for (let s = 20; s < c.length; s += 2) {
      const k = curvatureAt(c, s + 8);
      if (Math.abs(k) < 0.035 || s - last < 7) continue;
      last = s;
      const side = k > 0 ? 1 : -1;   // ひだりカーブ → みぎがわ（そと）に ひだりむきの やじるし
      const w = worldOf(c, s, side * (c.half + 1.0), 1.0);
      const m = new THREE.Mesh(arrowGeo, arrowMat);
      m.position.set(w.x, w.y, w.z);
      m.rotation.y = Math.PI / 2 - w.heading;   // まえから 見える むき
      m.scale.x = side > 0 ? 1 : -1;            // うらから 見るので、みぎむきの え が ひだりむきに 見える（みぎカーブは ひっくりかえす）
      scene.add(m);
    }
  }

  // ---------- スタート・ゴールの アーチ ----------
  {
    const f = frameAt(c, 0);
    const flagTex = own(new THREE.CanvasTexture(checkerCanvas()));
    flagTex.colorSpace = THREE.SRGBColorSpace;
    const poleMat = new THREE.MeshLambertMaterial({ color: 0xffd36b });
    const pole = new THREE.CylinderGeometry(0.22, 0.28, 6, 10);
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(pole, poleMat);
      p.position.set(f.x + f.rx * side * (c.half + 0.6), f.y + 3, f.z + f.rz * side * (c.half + 0.6));
      scene.add(p);
    }
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(c.width + 1.6, 0.9), new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide }));
    banner.position.set(f.x, f.y + 5.6, f.z);
    banner.rotation.y = -f.h - Math.PI / 2;   // よこはばを コースの 右むきに
    scene.add(banner);
    // 床の チェックの せん
    const lineGeo = new THREE.PlaneGeometry(c.width, 0.9);
    lineGeo.rotateX(-Math.PI / 2);
    const line = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ map: flagTex, transparent: true, opacity: 0.8 }));
    line.rotation.y = -f.h - Math.PI / 2;
    line.position.set(f.x, f.y + 0.02, f.z);
    scene.add(line);
  }

  // かいそうを ぜんぶ 1つに（そとの かざり＋しょうがいぶつ）
  {
    const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, bladeList.length);
    bladeList.forEach(([mm, cc], k) => { blades.setMatrixAt(k, mm); blades.setColorAt(k, cc); });
    blades.frustumCulled = false;   // ゆれで はみでる ので
    scene.add(blades);
  }
  // ひかりの すじ・あわ・つぶ は backdrop.js

  // ---------- 魚 ----------
  const lib = new SpeciesLibrary(rootUrl);
  const shadowTex = own(new THREE.CanvasTexture(shadowCanvas()));
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55 });
  const shadowGeo = new THREE.PlaneGeometry(1.4, 0.8);
  shadowGeo.rotateX(-Math.PI / 2);
  const dreamOwn = [];   // ゆめの さかなの 形と 絵（その レースだけ）
  const fishes = new Map();
  for (const r of race.racers) {
    const info = fishList.find((x) => x.id === r.id) || {};
    const spData = speciesById[info.speciesId] || { id: info.speciesId || 'medaka' };
    const holder = new THREE.Group();
    const mat = makeFishMaterial(null, { flat: false });
    let mesh;
    const fit = (geo) => {
      const hr = geo.userData.heightRatio || 0.3;
      const flatW = geo.userData.flatW || 1;
      const sz = FISH_LEN / flatW * (hr > 0.7 ? 0.75 : 1);
      mesh.scale.set(sz, sz * 1.1, sz * THICK);
    };
    if (info.dream && typeof info.dream.art === 'string') {
      const base = info.dream.base ? mergeSpec(info.dream.base, speciesById[info.dream.base]) : null;
      const spec = dreamSpec(info.dream, base, r.id);
      const flat = spec.dream.flat;
      const dmat = makeFishMaterial(null, { flat, twoSided: typeof info.dream.overlay === 'string' && info.dream.overlay.length > 0 });
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), dmat);
      mesh.visible = false;
      const cancel = loadDreamLook(spec, info.dream.art, (look) => {
        if (disposed) { look.geometry.dispose(); look.texture.dispose(); look.textureBack?.dispose(); return; }
        dreamOwn.push(look);
        mesh.geometry.dispose();
        mesh.geometry = look.geometry;
        dmat.map = look.texture; dmat.needsUpdate = true;
        if (dmat.userData.u.uMapB) dmat.userData.u.uMapB.value = look.textureBack || look.texture;
        fit(look.geometry);
        mesh.visible = true;
      }, info.dream.overlay);
      dreamOwn.push({ cancel });
      mat.dispose();
      fishes.set(r.id, { r, holder, mesh, mat: dmat, wave: rnd() * 6 });
    } else {
      const spec = mergeSpec(spData.id, spData);
      const entry = lib.get(spec, (en) => { const f = fishes.get(r.id); if (f) { f.mesh.geometry = en.geometry; f.mat.map = en.texture; f.mat.needsUpdate = true; fit(en.geometry); } });
      mat.map = entry.texture; mat.needsUpdate = true;
      mesh = new THREE.Mesh(entry.geometry, mat);
      fit(entry.geometry);
      fishes.set(r.id, { r, holder, mesh, mat, wave: rnd() * 6 });
    }
    mesh.rotation.order = 'YZX';
    mesh.frustumCulled = false;
    holder.add(mesh);
    scene.add(holder);
    const sh = new THREE.Mesh(shadowGeo, shadowMat);
    scene.add(sh);
    fishes.get(r.id).shadow = sh;
    // プレイヤーの めじるし（あたまの 上の ▼）
    if (r.isPlayer) {
      // じぶんの 魚：ふちを あかるく・あしもとに ひかる わ
      mat.userData.u.uRim.value = 0.9;
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.0, 32), new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      glow.rotation.x = -Math.PI / 2;
      // あかるい すなの 上でも わかる ように、わの そとに こい ふち
      glow.add(new THREE.Mesh(new THREE.RingGeometry(1.0, 1.1, 32), new THREE.MeshBasicMaterial({ color: 0x8a5200, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, fog: false })));
      scene.add(glow);
      fishes.get(r.id).glow = glow;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 10), new THREE.MeshBasicMaterial({ color: 0xffd23f, fog: false }));
      // ▼の ふち（すこし 大きい うらがわ だけの こい いろ）
      const coneEdge = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 10), new THREE.MeshBasicMaterial({ color: 0x7a4800, side: THREE.BackSide, fog: false }));
      coneEdge.scale.setScalar(1.3);
      cone.add(coneEdge);
      cone.rotation.x = Math.PI;
      cone.position.y = 1.1;
      holder.add(cone);
      fishes.get(r.id).marker = cone;
    }
  }

  // ---------- カメラ ----------
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), shake: 0, ready: false };
  function placeCamera(dt) {
    const me = race.player;
    if (!me) return;
    const f = frameAt(c, me.s);
    const head = f.h + me.yaw * 0.35;
    const fx = Math.cos(head), fz = Math.sin(head);
    const p = worldOf(c, me.s, me.lat * 0.9, 0);
    // ななめ うしろ 上から（魚の よこの 絵が すこし 見える）
    const rx = -fz, rz = fx, side = 1.7;
    const want = new THREE.Vector3(p.x - fx * 4.0 + rx * side, p.y + 1.9 + me.h * 0.4, p.z - fz * 4.0 + rz * side);
    const look = new THREE.Vector3(p.x + fx * 4 + rx * 0.2, p.y + 0.6 + me.h * 0.5, p.z + fz * 4 + rz * 0.2);
    if (!cam.ready) { cam.pos.copy(want); cam.look.copy(look); cam.ready = true; }
    const k = 1 - Math.exp(-dt * 12);
    cam.pos.lerp(want, k); cam.look.lerp(look, 1 - Math.exp(-dt * 8));
    camera.position.copy(cam.pos);
    if (cam.shake > 0) { cam.shake -= dt; camera.position.x += (Math.random() - 0.5) * 0.25; camera.position.y += (Math.random() - 0.5) * 0.2; }
    camera.lookAt(cam.look);
  }

  // ---------- 1こま ----------
  let disposed = false, t = 0;
  function render(dt) {
    if (disposed) return;
    t += dt;
    for (const f of fishes.values()) {
      const r = f.r;
      const w = worldOf(c, r.s, r.lat, r.h);
      const head = w.heading + r.yaw;
      f.holder.position.set(w.x, w.y, w.z);
      f.mesh.rotation.y = -head;
      const pitch = r.air ? Math.atan2(r.vh, Math.max(1, r.speed)) * 0.8 : Math.atan(w.slope) * 0.8;
      f.mesh.rotation.z = pitch;
      const u = f.mat.userData.u;
      f.wave += dt * (4 + r.speed * (r.dashing ? 1.4 : 0.9));
      u.uWave.value = f.wave;
      u.uAmp.value = r.stun > 0 ? 0.03 : r.dashing ? 0.11 : 0.07;
      u.uBend.value = -r.yaw * 0.25;
      u.uFlash.value = r.boost > 0 ? 0.25 + Math.sin(t * 20) * 0.1 : r.dashing ? 0.15 : 0;
      u.uTime.value = t;
      const g = worldOf(c, r.s, r.lat, 0.03);
      f.shadow.position.set(g.x, g.y, g.z);
      f.shadow.rotation.y = -head;
      const hh = Math.max(0, r.h - 0.55);
      f.shadow.scale.setScalar(Math.max(0.5, 1 - hh * 0.25));
      if (f.glow) { f.glow.position.set(g.x, g.y + 0.04, g.z); f.glow.scale.setScalar(1 + Math.sin(t * 5) * 0.08); }
      if (f.marker) f.marker.position.y = 1.1 + Math.sin(t * 4) * 0.08;
      // しっぽの うしろに あわの すじ（はやい ほど・ダッシュ ほど おおい）
      if (r.speed > 1.5) {
        f.bAcc = (f.bAcc || 0) + dt * (2 + r.speed * 0.5) * (r.dashing || r.boost > 0 ? 2.6 : 1);
        const hx = Math.cos(head), hz = Math.sin(head);
        for (; f.bAcc >= 1; f.bAcc--) bd.emitBubble(w.x - hx * FISH_LEN * 0.55, w.y + 0.05, w.z - hz * FISH_LEN * 0.55, r.dashing ? 1.4 : 1);
      }
      // カメラと じぶんの あいだに いる 魚は うすく（じぶんが かくれない）
      const me = race.player;
      if (!r.isPlayer && me) {
        const behind = me.s - r.s;
        const fade = behind > -0.5 && behind < 5 ? Math.min(1, Math.max(0.3, 1 - (1.2 - Math.abs(r.lat - me.lat)) * 0.6 - (5 - behind) * 0.08)) : 1;
        if (fade < 0.99) { f.mat.transparent = true; f.mat.opacity = fade; f.mat.depthWrite = false; f.mat.alphaTest = 0.08; }
        else if (f.mat.transparent) { f.mat.transparent = false; f.mat.opacity = 1; f.mat.depthWrite = true; f.mat.alphaTest = 0.5; }
      }
    }
    bladeTime.value = t;
    for (const rg of rings) {
      rg.g.rotation.z = t * 0.8;
      if (rg.pulse > 0) { rg.pulse -= dt; const s = rg.o.r * (1 + rg.pulse * 0.6); rg.m.scale.setScalar(s); } else rg.m.scale.setScalar(rg.o.r);
    }
    placeCamera(dt);
    bd.update(dt, t, camera, race.player, cssH * dpr);
    resize();
    renderer.render(scene, camera);
  }
  let cssW = 0, cssH = 0;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (w === cssW && h === cssH) return;
    cssW = w; cssH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // たてが みじかい スマホ横は すこし ひろく 見せる
    camera.fov = w / h > 1.7 ? 58 : 66;
    camera.updateProjectionMatrix();
  }
  function onEvent(ev) {
    if (ev.type === 'rock' && ev.player) cam.shake = 0.3;
    if (ev.type === 'ring') {
      const r = race.racers.find((x) => x.id === ev.id);
      const near = rings.reduce((best, rg) => { const d = Math.abs(((rg.o.s - (r.s % c.length)) + c.length * 1.5) % c.length - c.length * 0.5); return !best || d < best.d ? { rg, d } : best; }, null);
      if (near) near.rg.pulse = 0.4;
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    bd.dispose();
    for (const d of dreamOwn) { if (d.cancel) d.cancel(); if (d.geometry) d.geometry.dispose(); d.texture?.dispose(); d.textureBack?.dispose(); }
    const geos = new Set(), mats = new Set();
    // InstancedMesh の ならびの バッファ（instanceMatrix・instanceColor）も すてる
    scene.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    scene.traverse((o) => { if (o.geometry && !o.geometry.userData?.libOwned) geos.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m)); });
    // 種の 形と 絵は lib が すてる
    for (const e of lib.map.values()) geos.delete(e.geometry);
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
    for (const t2 of textures) t2.dispose();
    lib.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
  }
  return { render, onEvent, dispose, renderer, scene, camera, get info() { return renderer.info; } };
}

// コースごとの 近くの 色（みち・そとの すな・いわ・サンゴ・かいそう）。みちは あかるく のこして 道が わかる ように
const LOOKS = {
  easy: {
    sky: 0xe4fbff, ground: 0x4f7f7a, road: 0xf1efe0, outside: 0xbcbfa6,
    pebA: 0xf6ecd2, pebB: 0xe7a3a6, rocks: [0xa79c8c, 0x9aa1a3, 0xb3a690, 0x8f9a9e], moss: 0xd98f8f, obstacle: 0x8c7f74,
    corals: [0xf08ca0, 0xf5a86a, 0xb393e6, 0xf2d56b, 0x79cbbd], coralStep: 3.6, branch: 0.55,
    blades: [0x3fae6a, 0x5cc27c, 0x2e9460], bladeStep: 4, bladeTall: false,
  },
  normal: {
    sky: 0xe0fff4, ground: 0x41705e, road: 0xe9efdf, outside: 0x96a78e,
    pebA: 0xefe8d0, pebB: 0xc9b07a, rocks: [0x8b9488, 0x7f8c86, 0x9a9a88, 0x76847c], moss: 0x6f9e62, obstacle: 0x857a70,
    corals: [0xd9b45a, 0x9fc27a, 0xe08f78, 0x7bb5a6], coralStep: 6, branch: 0.3,
    blades: [0x5d9a3c, 0x7aa848, 0x4c8a3a], bladeStep: 2.2, bladeTall: true,
  },
  hard: {
    sky: 0xd4ecff, ground: 0x2c4a5e, road: 0xcdd8e2, outside: 0x65727e,
    pebA: 0xe6e4da, pebB: 0xa9bccb, rocks: [0x6f7884, 0x5f6b78, 0x7a7f88, 0x667280], moss: 0x7d8fc4, obstacle: 0x9a8e82,
    corals: [0x9c8fe0, 0x6fc9d6, 0xd98fc9, 0x8fb0e8], coralStep: 7, branch: 0.6,
    blades: [0x3f8f6a, 0x4f9e7a, 0x357a5c], bladeStep: 5, bladeTall: false,
  },
};

// ---------- 絵（canvas） ----------
function sandCanvas(level) {
  const N = 256;
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d');
  g.fillStyle = level === 'hard' ? '#cfcabd' : '#efe4c4'; g.fillRect(0, 0, N, N);
  // 砂の なみもよう（たてに つながる）
  for (let k = 0; k < 9; k++) {
    const y0 = (k / 9) * N;
    g.strokeStyle = 'rgba(170,140,95,0.16)'; g.lineWidth = 7;
    g.beginPath(); for (let x = 0; x <= N; x += 8) g.lineTo(x, y0 + Math.sin((x / N) * Math.PI * 2 * 2 + k) * 6); g.stroke();
    g.strokeStyle = 'rgba(255,255,245,0.22)'; g.lineWidth = 3;
    g.beginPath(); for (let x = 0; x <= N; x += 8) g.lineTo(x, y0 + 5 + Math.sin((x / N) * Math.PI * 2 * 2 + k) * 6); g.stroke();
  }
  const r = seeded(5);
  for (let i = 0; i < 1400; i++) { g.fillStyle = r() < 0.5 ? 'rgba(150,120,85,0.22)' : 'rgba(255,255,245,0.3)'; g.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r() * 2); }
  return cv;
}
function bladeCanvas() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#f4ffe8'); grd.addColorStop(0.6, '#e0f2d4'); grd.addColorStop(1, '#a9c49c');
  g.fillStyle = grd;
  // なみうつ ふちの はっぱ
  g.beginPath(); g.moveTo(22, 256);
  for (let y = 256; y >= 6; y -= 8) g.lineTo(32 - (6 + 18 * Math.sin((y / 256) * Math.PI) ** 0.6) - Math.sin(y * 0.09) * 2.5, y);
  g.quadraticCurveTo(32, -6, 40, 6);
  for (let y = 6; y <= 256; y += 8) g.lineTo(32 + (6 + 18 * Math.sin((y / 256) * Math.PI) ** 0.6) + Math.sin(y * 0.09 + 1) * 2.5, y);
  g.closePath(); g.fill();
  // まんなかの すじ
  g.strokeStyle = 'rgba(120,150,100,0.45)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(32, 256); g.quadraticCurveTo(31, 120, 32, 14); g.stroke();
  return cv;
}
function checkerCanvas() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32;
  const g = cv.getContext('2d');
  for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#ffffff' : '#2b3a4a'; g.fillRect(x * 16, y * 16, 16, 16); }
  return cv;
}
function arrowCanvas() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffd23f'; g.strokeStyle = '#c47a00'; g.lineWidth = 4;
  g.beginPath(); g.roundRect ? g.roundRect(3, 3, 58, 58, 12) : g.rect(3, 3, 58, 58); g.fill(); g.stroke();
  g.fillStyle = '#ffffff'; g.strokeStyle = '#c45a1a'; g.lineWidth = 3;
  // みぎむきの やじるし（≫）
  for (const x0 of [12, 30]) { g.beginPath(); g.moveTo(x0, 14); g.lineTo(x0 + 16, 32); g.lineTo(x0, 50); g.lineTo(x0 + 7, 50); g.lineTo(x0 + 23, 32); g.lineTo(x0 + 7, 14); g.closePath(); g.fill(); }
  return cv;
}
function shadowCanvas() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30); grd.addColorStop(0, 'rgba(10,40,60,0.75)'); grd.addColorStop(1, 'rgba(10,40,60,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return cv;
}
/** いわを でこぼこに */
function jiggle(g, r) {
  const p = g.attributes.position;
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
    if (!seen.has(key)) seen.set(key, 0.82 + r() * 0.3);
    const k = seen.get(key);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  g.computeVertexNormals();
}

/** かいそうの 形：はばの ある 板を 十字に 2まい（根もとが 原点、たかさ 1） */
function mergeBlade() {
  const a = new THREE.PlaneGeometry(0.5, 1, 1, 5); a.translate(0, 0.5, 0);
  const b = a.clone(); b.rotateY(Math.PI / 2);
  const pos = [...a.attributes.position.array, ...b.attributes.position.array];
  const nor = [...a.attributes.normal.array, ...b.attributes.normal.array];
  const uv = [...a.attributes.uv.array, ...b.attributes.uv.array];
  const n = a.attributes.position.count;
  const idx = [...a.index.array, ...Array.from(b.index.array, (i) => i + n)];
  a.dispose(); b.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const keyOf = (p, i) => Math.round(p.getX(i) * 1000) + ',' + Math.round(p.getY(i) * 1000) + ',' + Math.round(p.getZ(i) * 1000);
/** バラバラの 三角形でも、おなじ 位置の 点の 法線を そろえて なめらかに 見せる */
function smoothNormals(g) {
  const p = g.attributes.position;
  if (!g.attributes.normal) g.computeVertexNormals();
  const acc = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), cc = new THREE.Vector3(), n = new THREE.Vector3();
  const tri = g.index ? null : p.count / 3;
  if (!tri) { g.computeVertexNormals(); return g; }
  for (let t = 0; t < tri; t++) {
    a.fromBufferAttribute(p, t * 3); b.fromBufferAttribute(p, t * 3 + 1); cc.fromBufferAttribute(p, t * 3 + 2);
    n.subVectors(cc, b).cross(a.clone().sub(b));   // 面積で おもみ
    for (let k = 0; k < 3; k++) { const key = keyOf(p, t * 3 + k); const v = acc.get(key) || [0, 0, 0]; v[0] += n.x; v[1] += n.y; v[2] += n.z; acc.set(key, v); }
  }
  const nr = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { const v = acc.get(keyOf(p, i)); n.set(v[0], v[1], v[2]).normalize(); nr.setXYZ(i, n.x, n.y, n.z); }
  nr.needsUpdate = true;
  return g;
}
/** なめらかな でこぼこ岩（下は ひらたく。頂点カラー：下ほど くらく、上むきの 面に こけ色） */
function rockGeo(seed, detail = 2, bumpy = 0.22, moss = null) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const r = seeded(seed);
  const o = [r() * 9, r() * 9, r() * 9];
  const p = g.attributes.position;
  const disp = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = keyOf(p, i);
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (!disp.has(key)) {
      const k = 1 + bumpy * (Math.sin(x * 2.3 + o[0]) * Math.sin(y * 2.9 + o[1]) * 0.8 + Math.sin(z * 3.1 + o[2] + x * 1.7) * 0.5) + (r() - 0.5) * bumpy * 0.35;
      disp.set(key, k);
    }
    const k = disp.get(key);
    x *= k; y *= k; z *= k;
    if (y < -0.2) y = -0.2 + (y + 0.2) * 0.2;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  smoothNormals(g);
  const nr = g.attributes.normal, col = [], mc = moss ? new THREE.Color(moss) : null, cc = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const h = Math.min(1, Math.max(0, (p.getY(i) + 0.2) / 1.3));
    const sh = 0.5 + 0.5 * h;
    cc.setRGB(sh, sh, sh);
    if (mc) { const m = Math.min(1, Math.max(0, (nr.getY(i) - 0.55) / 0.3)) * 0.6; cc.lerp(mc, m); }
    col.push(cc.r, cc.g, cc.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
/** バラバラの 三角形に して つなげる（position・normal・color） */
function mergeGeos(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const pos = [], nor = [], col = [];
  for (const g of parts) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    const c = g.attributes.color;
    for (let i = 0; i < g.attributes.position.count; i++) col.push(c ? c.getX(i) : 1, c ? c.getY(i) : 1, c ? c.getZ(i) : 1);
  }
  for (const g of list) g.dispose();
  for (const g of parts) g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
const shadeGeo = (g, lo, hi, y0, y1) => {
  const p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) { const k = Math.min(1, Math.max(0, (p.getY(i) - y0) / (y1 - y0))); const s = lo + (hi - lo) * k; col.push(s, s, s); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
};
/** えだサンゴ（ふとい えだが 上へ ひろがる。先は まるい） */
function branchCoralGeo(seed) {
  const r = seeded(seed), parts = [];
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), qq = new THREE.Quaternion();
  const twig = (x, y, z, dx, dy, dz, len, r0, r1, depth) => {
    dir.set(dx, dy, dz).normalize();
    const cy = new THREE.CylinderGeometry(r1, r0, len, 7, 1, true);
    cy.translate(0, len / 2, 0);
    qq.setFromUnitVectors(up, dir);
    cy.applyQuaternion(qq); cy.translate(x, y, z);
    parts.push(cy);
    const ex = x + dir.x * len, ey = y + dir.y * len, ez = z + dir.z * len;
    if (depth > 0) {
      const n = depth > 1 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + r() * 1.2;
        twig(ex, ey, ez, dir.x * 0.5 + Math.cos(a) * 0.6, 0.9, dir.z * 0.5 + Math.sin(a) * 0.6, len * (0.62 + r() * 0.15), r1, r1 * 0.75, depth - 1);
      }
    } else {
      const tip = new THREE.SphereGeometry(r1 * 1.25, 6, 4);
      tip.translate(ex, ey, ez);
      parts.push(tip);
    }
  };
  twig(0, -0.05, 0, 0, 1, 0, 0.45, 0.16, 0.12, 2);
  const g = mergeGeos(parts);
  // 先ほど あかるく
  return shadeGeo(g, 0.6, 1.08, 0, 1.3);
}
/** まるい ドームの サンゴ（ゆるい みぞ） */
function domeCoralGeo(seed) {
  const g = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const r = seeded(seed), o = r() * 6;
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + Math.sin(x * 7 + o) * Math.sin(z * 7 + y * 4) * 0.05;
    p.setXYZ(i, x * k, (y - 0.12) * k * 0.62, z * k);
  }
  g.computeVertexNormals();
  return shadeGeo(g, 0.62, 1.05, -0.1, 0.55);
}
