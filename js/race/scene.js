// v0.10 レース係：レースの 3D（Three.js）。コース・しょうがいぶつ・魚・カメラ。
// 魚の 見た目は js/aquarium/fishModel.js を import して つかう だけ（中身は かえない）。
// レースを でたら dispose() で geometry・material・texture・renderer を ぜんぶ すてる。
import * as THREE from '../../vendor/three.module.min.js';
import { SpeciesLibrary, makeFishMaterial, loadDreamLook } from '../aquarium/fishModel.js';
import { mergeSpec } from '../aquarium/speciesDefaults.js';
import { dreamSpec } from '../aquarium/dreamSpec.js';
import { frameAt, worldOf, seeded, curvatureAt } from './course.js';

const WATER = 0x3f9fc4, DEEP = 0x1f6f98;
const FISH_LEN = 2.1;
const THICK = 1.9;   // うしろから 見ても ほそすぎない ように あつみを ふやす（見た目だけ）   // 魚の 見た目の ながさ（みんな おなじ。見た目で 不公平に しない）

export function createRaceScene(canvas, race, { fishList = [], speciesById = {}, rootUrl = new URL('../../', import.meta.url).href } = {}) {
  const c = race.course;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);
  const scene = new THREE.Scene();
  const bgCol = c.level === 'hard' ? 0x1b5f86 : c.level === 'normal' ? 0x2f8bb3 : WATER;
  scene.background = new THREE.Color(bgCol);
  scene.fog = new THREE.Fog(bgCol, 14, c.level === 'hard' ? 48 : 60);
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 120);
  scene.add(new THREE.HemisphereLight(0xe8fbff, 0x3c6b5a, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(20, 40, 10);
  scene.add(sun);
  const textures = [];
  const own = (t) => { textures.push(t); return t; };
  const rnd = seeded(c.def.seed * 7 + 3);

  // ---------- 床（すな）----------
  const sandTex = own(new THREE.CanvasTexture(sandCanvas(c.level)));
  sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
  sandTex.colorSpace = THREE.SRGBColorSpace;
  {
    // よこの ならび：コースの 中（あかるい みち）と そと（くらい すな）の さかいを くっきり
    const EXT = 9;
    const lats = [-(c.half + EXT), -(c.half + 4), -(c.half + 1.2), -c.half - 0.02, -c.half + 0.02, -c.half * 0.5, 0, c.half * 0.5, c.half - 0.02, c.half + 0.02, c.half + 1.2, c.half + 4, c.half + EXT];
    const COLS = lats.length - 1;
    const n = Math.ceil(c.length / 1.0);
    const pos = [], uv = [], idx = [], col = [];
    const road = new THREE.Color(c.level === 'hard' ? 0xfff1cf : 0xfff8e4), outside = new THREE.Color(c.level === 'hard' ? 0x8f8a7c : 0xc9b98e);
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * c.length;
      const f = frameAt(c, s);
      for (let j = 0; j <= COLS; j++) {
        const lat = lats[j];
        const out = Math.max(0, Math.abs(lat) - c.half);
        const bump = out > 0 ? out * 0.18 + Math.sin(s * 0.3 + j) * 0.15 * Math.min(1, out) : -0.02;
        pos.push(f.x + f.rx * lat, f.y + bump, f.z + f.rz * lat);
        uv.push(lat / 4, s / 4);
        const cc = out > 0.01 ? outside : road;
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
    const floor = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: sandTex, vertexColors: true, side: THREE.DoubleSide }));
    scene.add(floor);
  }

  // ---------- コースの ふち（こいしの ならび）と そとの いわ・さんご・かいそう ----------
  const pebbleGeo = new THREE.DodecahedronGeometry(0.28, 0);
  const pebbleMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const nPeb = Math.floor(c.length / 1.6) * 2;
  const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, nPeb);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), sc = new THREE.Vector3();
  const colA = new THREE.Color(0xfff3c4), colB = new THREE.Color(0xff9fb2);
  for (let i = 0; i < nPeb; i++) {
    const k = Math.floor(i / 2), side = i % 2 ? 1 : -1;
    const s = k * 1.6;
    const w = worldOf(c, s, side * (c.half + 0.15), 0.05);
    e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
    m4.compose(v3.set(w.x, w.y, w.z), q, sc.setScalar(0.8 + rnd() * 0.5));
    pebbles.setMatrixAt(i, m4);
    pebbles.setColorAt(i, Math.floor(k / 3) % 2 ? colA : colB);
  }
  scene.add(pebbles);

  const wallGeo = new THREE.DodecahedronGeometry(1, 0);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const nWall = Math.floor(c.length / 2.2) * 2;
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, nWall);
  const rockCols = [0x8a8f9c, 0x9c8f80, 0x7d8a93, 0xa69a8a].map((x) => new THREE.Color(x));
  for (let i = 0; i < nWall; i++) {
    const s = Math.floor(i / 2) * 2.2 + rnd() * 1.5, side = i % 2 ? 1 : -1;
    const w = worldOf(c, s, side * (c.half + 2.2 + rnd() * 3.5), 0.1);
    e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
    const r = 0.7 + rnd() * 1.4;
    m4.compose(v3.set(w.x, w.y + r * 0.3, w.z), q, sc.set(r, r * (0.6 + rnd() * 0.6), r));
    walls.setMatrixAt(i, m4);
    walls.setColorAt(i, rockCols[i % 4]);
  }
  scene.add(walls);

  // さんご（まるい つぶの かたまり）
  const coralGeo = new THREE.IcosahedronGeometry(0.5, 1);
  const coralMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const nCoral = Math.floor(c.length / 5);
  const corals = new THREE.InstancedMesh(coralGeo, coralMat, nCoral * 3);
  const coralCols = [0xff8fa3, 0xffb36b, 0xb48cff, 0xffe066, 0x7fd8c8].map((x) => new THREE.Color(x));
  let ci = 0;
  for (let i = 0; i < nCoral; i++) {
    const s = i * 5 + rnd() * 3, side = rnd() < 0.5 ? 1 : -1;
    const lat = side * (c.half + 1.2 + rnd() * 1.8);
    const col = coralCols[Math.floor(rnd() * coralCols.length)];
    for (let k = 0; k < 3; k++) {
      const w = worldOf(c, s + (rnd() - 0.5) * 0.8, lat + (rnd() - 0.5) * 0.8, 0.25 + k * 0.35);
      m4.compose(v3.set(w.x, w.y, w.z), q.identity(), sc.setScalar(0.5 + rnd() * 0.6 - k * 0.1));
      corals.setMatrixAt(ci, m4); corals.setColorAt(ci, col); ci++;
    }
  }
  scene.add(corals);

  // かいそう（そとの かざり と コースの 中の しょうがいぶつ）。ゆれは 1まいずつ rotation で
  const bladeGeo = new THREE.PlaneGeometry(0.42, 1, 1, 4);
  bladeGeo.translate(0, 0.5, 0);
  const bladeTex = own(new THREE.CanvasTexture(bladeCanvas()));
  bladeTex.colorSpace = THREE.SRGBColorSpace;
  const bladeMats = [0x3fae6a, 0x5cc27c, 0x2e9460].map((col) => new THREE.MeshLambertMaterial({ map: bladeTex, color: col, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
  const blades = [];
  const addBlade = (x, y, z, hgt, mat) => {
    const m = new THREE.Mesh(bladeGeo, mat);
    m.position.set(x, y, z); m.scale.set(1, hgt, 1); m.rotation.y = rnd() * Math.PI;
    m.userData.ph = rnd() * 6; m.userData.amp = 0.12 + rnd() * 0.1;
    scene.add(m); blades.push(m);
  };
  for (let i = 0; i < c.length / 4; i++) {
    const s = i * 4 + rnd() * 2, side = rnd() < 0.5 ? 1 : -1;
    const w = worldOf(c, s, side * (c.half + 0.9 + rnd() * 4), 0);
    addBlade(w.x, w.y, w.z, 1.2 + rnd() * 1.6, bladeMats[i % 3]);
  }

  // ---------- しょうがいぶつ ----------
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8c7f74, flatShading: true });
  const rockTopMat = new THREE.MeshLambertMaterial({ color: 0x6fae7a, flatShading: true });
  // あわの わ：とおくからも 見えるように あかるく ふとく
  const ringMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x7fe9ff, emissiveIntensity: 1.0, transparent: true, opacity: 0.95, fog: false });
  const ringGeo = new THREE.TorusGeometry(1, 0.16, 10, 32);
  const bubbleGeo = new THREE.SphereGeometry(0.09, 8, 6);
  const bubbleMat = new THREE.MeshLambertMaterial({ color: 0xeaffff, emissive: 0x9fe8ff, emissiveIntensity: 0.4, transparent: true, opacity: 0.8 });
  const rings = [];
  for (const o of c.obstacles) {
    const w = worldOf(c, o.s, o.lat, 0);
    if (o.kind === 'rock') {
      const g = new THREE.DodecahedronGeometry(1, 1);
      jiggle(g, seeded(o.seed));
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
        addBlade(ww.x, ww.y, ww.z, o.height * (0.85 + r2() * 0.5), bladeMats[i % 3]);
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

  // ---------- ひかりの すじ・あわ ----------
  const rayTex = own(new THREE.CanvasTexture(rayCanvas()));
  const rayMat = new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const rays = [];
  const rayGeo = new THREE.PlaneGeometry(3, 16);
  for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(rayGeo, rayMat); r.userData.off = i; scene.add(r); rays.push(r); }
  const nB = 120;
  const bPos = new Float32Array(nB * 3);
  const bubbles = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xeaffff, size: 0.12, transparent: true, opacity: 0.7, depthWrite: false }));
  bubbles.geometry.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  for (let i = 0; i < nB; i++) { bPos[i * 3] = (rnd() - 0.5) * 30; bPos[i * 3 + 1] = rnd() * 8; bPos[i * 3 + 2] = (rnd() - 0.5) * 30; }
  scene.add(bubbles);

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
      scene.add(glow);
      fishes.get(r.id).glow = glow;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 10), new THREE.MeshBasicMaterial({ color: 0xffd23f, fog: false }));
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
    // ひかりの すじ・あわは カメラの まわりに
    rays.forEach((r, i) => {
      const a = head + (i - 3) * 0.35;
      r.position.set(cam.pos.x + Math.cos(a) * (12 + (i % 3) * 4), cam.pos.y + 6, cam.pos.z + Math.sin(a) * (12 + (i % 3) * 4));
      r.rotation.set(0, -a + Math.PI / 2, 0.25);
    });
    bubbles.position.set(cam.pos.x, p.y, cam.pos.z);
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
      // カメラと じぶんの あいだに いる 魚は うすく（じぶんが かくれない）
      const me = race.player;
      if (!r.isPlayer && me) {
        const behind = me.s - r.s;
        const fade = behind > -0.5 && behind < 5 ? Math.min(1, Math.max(0.3, 1 - (1.2 - Math.abs(r.lat - me.lat)) * 0.6 - (5 - behind) * 0.08)) : 1;
        if (fade < 0.99) { f.mat.transparent = true; f.mat.opacity = fade; f.mat.depthWrite = false; f.mat.alphaTest = 0.08; }
        else if (f.mat.transparent) { f.mat.transparent = false; f.mat.opacity = 1; f.mat.depthWrite = true; f.mat.alphaTest = 0.5; }
      }
    }
    for (const b of blades) { b.rotation.z = Math.sin(t * 1.6 + b.userData.ph) * b.userData.amp; }
    for (const rg of rings) {
      rg.g.rotation.z = t * 0.8;
      if (rg.pulse > 0) { rg.pulse -= dt; const s = rg.o.r * (1 + rg.pulse * 0.6); rg.m.scale.setScalar(s); } else rg.m.scale.setScalar(rg.o.r);
    }
    for (let i = 0; i < nB; i++) { bPos[i * 3 + 1] += dt * (0.6 + (i % 5) * 0.15); if (bPos[i * 3 + 1] > 8) bPos[i * 3 + 1] = 0; }
    bubbles.geometry.attributes.position.needsUpdate = true;
    placeCamera(dt);
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
    for (const d of dreamOwn) { if (d.cancel) d.cancel(); if (d.geometry) d.geometry.dispose(); d.texture?.dispose(); d.textureBack?.dispose(); }
    const geos = new Set(), mats = new Set();
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

// ---------- 絵（canvas） ----------
function sandCanvas(level) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = level === 'hard' ? '#b9b3a2' : '#ecdcb0'; g.fillRect(0, 0, 128, 128);
  const r = seeded(5);
  for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(160,130,90,0.25)' : 'rgba(255,255,240,0.35)'; g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2); }
  g.strokeStyle = 'rgba(190,160,110,0.25)'; g.lineWidth = 3;
  for (let y = 10; y < 128; y += 32) { g.beginPath(); for (let x = 0; x <= 128; x += 8) g.lineTo(x, y + Math.sin(x / 20) * 4); g.stroke(); }
  return cv;
}
function bladeCanvas() {
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 128;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128); grd.addColorStop(0, '#d8ffd0'); grd.addColorStop(1, '#ffffff');
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(4, 128); g.quadraticCurveTo(0, 50, 16, 2); g.quadraticCurveTo(32, 50, 28, 128); g.closePath(); g.fill();
  return cv;
}
function checkerCanvas() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32;
  const g = cv.getContext('2d');
  for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#ffffff' : '#2b3a4a'; g.fillRect(x * 16, y * 16, 16, 16); }
  return cv;
}
function rayCanvas() {
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 128;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128); grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(8, 0, 16, 128);
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
