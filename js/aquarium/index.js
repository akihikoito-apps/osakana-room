// 3D水槽（部屋・ゲーム係はこのファイルの createAquarium だけを使う）。
// 使い方は docs/設計.md の「3D水槽のAPI」を参照。補足：
// - 餌を食べると小さいハートを自動で出す（opts.autoHeartOnEat:false で止められる）。'eat' で react(uid,'heart') を重ねる必要はない。
// - feed() は 1回で 5粒。画面の x の位置の水面から落ちる（y はほぼ使わない）。
// - screenPosOf() は canvas の左上を 0,0 とした CSS ピクセル（魚の頭の少し上）。見えない・いない魚は null。
// - 絵（assets/fish/<id>.png）が無い種は仮の魚を描く。絵があれば読み込めしだい自動で差し替える（1種につき 1回だけ読みにいく）。
// - 重いと感じたら解像度を自動で下げる（最大 2 → 1.5 → 1）。stats で fps などが見られる。
// - 指でドラッグすると左右に少し見回せる（opts.look:false で無効）。4秒さわらないと正面に戻る。
import * as THREE from '../../vendor/three.module.min.js';
import { FISH } from '../data/fish.js';
import { SpeciesLibrary, makeFishMaterial } from './fishModel.js';
import { FishAgent } from './swim.js';
import { Tank, TANK_H, TANK_D, WATER_TOP } from './tank.js';
import { FxLayer } from './fx.js';
import { Cleaner } from './clean.js';
import { mergeSpec } from './speciesDefaults.js';

// canvas ごとに renderer を使い回す（水槽を何度作り直しても WebGL コンテキストを増やさない）
const RENDERERS = new WeakMap();

const FOV = 30;
const REACTIONS = ['heart', 'jump', 'spin', 'happy', 'sad', 'thanks', 'sleepy', 'pui'];

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ water?: 'fresh'|'salt', species?: object[], autoHeartOnEat?: boolean, look?: boolean, maxPixelRatio?: number }} opts
 */
export function createAquarium(canvas, opts = {}) {
  const speciesList = opts.species || FISH;
  const specCache = new Map();
  const specOf = (id) => { if (!specCache.has(id)) specCache.set(id, mergeSpec(id, speciesList.find((s) => s.id === id))); return specCache.get(id); };
  const rootUrl = new URL('../../', import.meta.url).href;
  const autoHeart = opts.autoHeartOnEat !== false;
  const lookEnabled = opts.look !== false;
  const maxDpr = Math.min(2, opts.maxPixelRatio || 2);

  let renderer = RENDERERS.get(canvas);
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, alpha: false, powerPreference: 'high-performance' });
    RENDERERS.set(canvas, renderer);
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0d1d24, 1);
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 80);
  const tank = new Tank(scene, opts.water || 'fresh');
  const fx = new FxLayer(scene);
  const cleaner = new Cleaner(scene, tank, fx);
  const lib = new SpeciesLibrary(rootUrl);

  /** @type {Map<string, {agent: FishAgent, mesh: THREE.Mesh, mat: THREE.Material}>} */
  const fishes = new Map();
  const listeners = { eat: new Set(), tapFish: new Set() };
  const emit = (name, data) => { for (const fn of listeners[name] || []) { try { fn(data); } catch (e) { console.error(e); } } };

  let camDist = 12;
  // えさの好み：uid → { [kind]: 'love'|'ok'|'dislike' }（文字だけなら ふつうのえさ以外 すべてに）
  const prefs = new Map();
  const foodPref = (agent, kind = 'flake') => {
    const p = prefs.get(agent.uid);
    if (!p) return 'ok';
    if (typeof p === 'string') return kind === 'flake' ? 'ok' : p;
    return p[kind] || 'ok';
  };
  let disposed = false;
  const ctx = { minLen: 0 };
  let cssW = 1, cssH = 1;
  let look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, idle: 0 };

  // ---------------- 大きさ ----------------
  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width || canvas.clientWidth || 740));
    const h = Math.max(1, Math.round(r.height || canvas.clientHeight || 390));
    if (w === cssW && h === cssH) return;
    cssW = w; cssH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const W = Math.max(9, Math.min(22, TANK_H * camera.aspect));
    if (Math.abs(W - tank.W) > 0.01) {
      tank.build(W);
      // 水槽の外に出た魚を中に戻す
      for (const f of fishes.values()) { f.agent.clampToTank(tank.bounds, f.agent.onFloor); if (f.agent.onFloor) { f.agent.surf = 'ground'; f.agent.pos.y = tank.groundHeight(f.agent.pos.x, f.agent.pos.z); } }
    }
    // 前面（W×H）がちょうど画面に入る距離
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    camDist = Math.max((TANK_H / 2) / t, (W / 2) / (t * camera.aspect));
    tank.setFogRange(camDist + TANK_D / 2);
    tank.setPointScale(h * dpr / (2 * t));
    // いちばん奥でも全長 28px 以上に見える長さ（ワールド単位）
    const farDist = camDist + TANK_D / 2 - tank.bounds.minZ;
    ctx.minLen = 28 / (h / (2 * t * farDist));
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  ro?.observe(canvas);
  window.addEventListener('resize', resize);

  function placeCamera() {
    const fz = TANK_D / 2;
    const zoom = 1 - Math.min(0.12, Math.abs(look.yaw) * 0.35 + Math.abs(look.pitch) * 0.3);
    const R = (camDist + fz) * zoom;
    const cx = Math.sin(look.yaw) * R, cz = Math.cos(look.yaw) * R;
    camera.position.set(cx, TANK_H / 2 + Math.sin(look.pitch) * R, cz);
    camera.lookAt(0, TANK_H / 2, 0);
  }

  // ---------------- 魚 ----------------
  function upgradeHandler(entry) {
    for (const f of fishes.values()) {
      if (f.agent.spec.id !== entry.spec.id) continue;
      f.mesh.geometry = entry.geometry;
      f.mat.map = entry.texture;
      f.mat.needsUpdate = true;
      f.agent.heightRatio = entry.geometry.userData.heightRatio || 0.3;
    }
  }

  function addFish(info) {
    const spec = specOf(info.speciesId);
    const entry = lib.get(spec, upgradeHandler);
    const agent = new FishAgent(info, spec, tank.bounds);
    agent.heightRatio = entry.geometry.userData.heightRatio || 0.3;
    agent.clampToTank(tank.bounds, agent.onFloor);
    if (agent.onFloor && agent.surf !== 'glass') agent.pos.y = tank.groundHeight(agent.pos.x, agent.pos.z);
    const mat = makeFishMaterial(entry.texture);
    if (agent.isShrimp) mat.userData.u.uK.value = 3;
    if (agent.isSnail) { mat.userData.u.uAmp.value = 0; mat.userData.u.uRim.value = 0.5; }
    const mesh = new THREE.Mesh(entry.geometry, mat);
    mesh.rotation.order = 'YZX';
    mesh.userData.uid = info.uid;
    mesh.frustumCulled = false;
    scene.add(mesh);
    fishes.set(info.uid, { agent, mesh, mat });
  }

  function removeFish(uid) {
    const f = fishes.get(uid);
    if (!f) return;
    scene.remove(f.mesh);
    f.mat.dispose();
    fishes.delete(uid);
  }

  /** 頭の上（ハートを出す位置）。 */
  function headTop(f, out) {
    const a = f.agent;
    const yaw = a.renderYaw();
    out.set(
      a.pos.x + Math.cos(yaw) * a.len * 0.25,
      a.pos.y + a.oy + a.len * a.heightRatio * 0.5 + 0.35,
      a.pos.z + a.oz - Math.sin(yaw) * a.len * 0.25,
    );
    return out;
  }
  const anchorFor = (uid) => (out) => { const f = fishes.get(uid); return f ? headTop(f, out) : null; };

  // ---------------- 入力（タップ・見回し） ----------------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const meshes = [...fishes.values()].map((f) => f.mesh);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (hit) return hit.object.userData.uid;
    // 小さい魚でも押しやすいように、近くの魚を探す（体の中心から画面上 48px 以内）
    let best = null, bd = 48 * 48;
    for (const [uid, f] of fishes) {
      const p = centerPos(f, _v);
      const d = (p.x - (clientX - r.left)) ** 2 + (p.y - (clientY - r.top)) ** 2;
      if (d < bd) { bd = d; best = uid; }
    }
    return best;
  }
  function onDown(e) {
    down = { x: e.clientX, y: e.clientY, t: performance.now(), yaw: look.tYaw, pitch: look.tPitch, id: e.pointerId, moved: false };
  }
  function onMove(e) {
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.abs(dx) + Math.abs(dy) > 10) down.moved = true;
    if (down.moved && lookEnabled) {
      look.tYaw = THREE.MathUtils.clamp(down.yaw - dx / cssW * 0.9, -0.33, 0.33);
      look.tPitch = THREE.MathUtils.clamp(down.pitch + dy / cssH * 0.35, -0.08, 0.12);
      look.idle = 0;
    }
  }
  function onUp(e) {
    if (!down || e.pointerId !== down.id) return;
    const d = down; down = null;
    if (!d.moved && performance.now() - d.t < 600) {
      const uid = pick(e.clientX, e.clientY);
      if (uid != null) {
        const f = fishes.get(uid);
        if (f) f.agent.flash = 0.6;
        emit('tapFish', { uid });
      }
    }
  }
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  canvas.style.touchAction = 'none';

  // ---------------- ループ ----------------
  const schools = {};
  let running = false, raf = 0, last = 0, simTime = 0;
  let fpsAcc = 0, fpsN = 0, fps = 60, slowSecs = 0;
  Object.assign(ctx, {
    bounds: tank.bounds, fishes: [], foods: tank.foods, schools, time: 0,
    onEat: (agent, kind) => {
      emit('eat', { uid: agent.uid, kind });
      const pref = foodPref(agent, kind);
      // 好きなえさ：大喜び（ハート大小3つ＋くるっ）。うるさくならないよう 1匹4秒に1回・水槽で同時に2匹まで
      const busy = [...fishes.values()].filter((f) => f.agent.react && f.agent.react.love).length;
      if (pref === 'love' && simTime - (agent.lastLove ?? -99) > 4 && busy < 2) {
        agent.lastLove = simTime;
        agent.startReact('spin'); agent.react.love = true;
        fx.spawn('love', anchorFor(agent.uid));
      } else if (autoHeart) fx.spawn('eat', anchorFor(agent.uid));
    },
    onPui: (agent) => { fx.spawn('pui', anchorFor(agent.uid)); },
    foodPref: (agent, kind) => foodPref(agent, kind),
  });

  function updateSchools(dt) {
    const counts = {};
    for (const f of fishes.values()) if (f.agent.school && !f.agent.weak) counts[f.agent.spec.id] = (counts[f.agent.spec.id] || 0) + 1;
    for (const id of Object.keys(counts)) {
      let s = schools[id];
      if (!s) {
        s = schools[id] = { target: new THREE.Vector3(), t: 0 };
      }
      s.count = counts[id];
      s.t -= dt;
      if (s.t <= 0) {
        const any = [...fishes.values()].find((f) => f.agent.spec.id === id);
        const b = tank.bounds;
        const x = b.minX + 2 + Math.random() * (b.maxX - b.minX - 4);
        const z = b.minZ + 0.6 + Math.random() * (b.maxZ - b.minZ - 1.2);
        const [lo, hi] = any.agent.yRange(b, x, z);
        s.target.set(x, lo + Math.random() * (hi - lo), z);
        s.t = 6 + Math.random() * 7;
      }
    }
    for (const id of Object.keys(schools)) if (!counts[id]) schools[id].count = 0;
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    resize();
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 1 / 60;
    // 性能の自動調整（重いときは解像度を下げる）
    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 1) {
      fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
      slowSecs = fps < 45 ? slowSecs + 1 : 0;
      if (slowSecs >= 3 && dpr > 1) { dpr = Math.max(1, dpr - 0.5); renderer.setPixelRatio(dpr); cssW = 0; resize(); slowSecs = 0; }
    }
    dt = Math.min(dt, 0.05);
    simTime += dt;
    ctx.time = simTime;
    ctx.fishes = [...fishes.values()].map((f) => f.agent);
    tank.bottomEaters = Math.min(5, ctx.fishes.filter((a) => a.eatsFromBottom).length);
    tank.creatures = ctx.fishes.length;
    tank.snails = Math.min(2, ctx.fishes.filter((a) => a.isSnail).length);
    updateSchools(dt);
    tank.update(dt);
    cleaner.update(dt, ctx);
    for (const f of fishes.values()) {
      const a = f.agent;
      a.update(dt, ctx);
      const u = f.mat.userData.u;
      // 貝は体の下（あし）が地面・ガラスにつくように持ち上げる
      const lift = a.isSnail ? a.len * a.heightRatio * 0.42 : 0;
      if (a.isSnail && a.surf === 'glass') f.mesh.position.set(a.pos.x - Math.sin(a.pitch) * lift * Math.cos(a.yaw), a.pos.y + a.oy + Math.cos(a.pitch) * lift, a.pos.z + a.oz);
      else f.mesh.position.set(a.pos.x, a.pos.y + a.oy + lift, a.pos.z + a.oz);
      f.mesh.rotation.y = a.renderYaw();
      f.mesh.rotation.z = THREE.MathUtils.clamp(a.pitch + a.opitch, -0.75, 0.75);   // ロール（横倒し）は絶対にしない
      f.mesh.rotation.x = 0;
      f.mesh.scale.set(a.len * a.sx, a.len * (2 - a.sx) * 0.5 + a.len * 0.5, a.len);
      u.uWave.value = a.wave;
      u.uAmp.value = a.amp;
      u.uBend.value = THREE.MathUtils.clamp(-a.yawRate * 0.22, -0.5, 0.5);
      u.uDull.value = a.dull;
      u.uFlash.value = a.flash;
      // v0.6 キラキラ（個体差係）：つや＋4〜8びょうに 1かい ちいさな ✦
      u.uShiny.value = a.shiny ? 1 : 0;
      u.uTime.value = simTime;
      if (a.shiny) { a.shineT = (a.shineT ?? Math.random() * 4) - dt; if (a.shineT <= 0) { a.shineT = 4 + Math.random() * 4; fx.spawn('shine', anchorFor(a.uid)); } }
    }
    fx.update(dt);
    // 見回し：しばらく触らないと正面に戻る
    look.idle += dt;
    if (look.idle > 4 && !down) { look.tYaw *= 1 - Math.min(1, dt * 0.8); look.tPitch *= 1 - Math.min(1, dt * 0.8); }
    look.yaw += (look.tYaw - look.yaw) * Math.min(1, dt * 6);
    look.pitch += (look.tPitch - look.pitch) * Math.min(1, dt * 6);
    placeCamera();
    renderer.render(scene, camera);
  }

  function centerPos(f, out) {
    _v3.set(f.agent.pos.x, f.agent.pos.y + f.agent.oy, f.agent.pos.z + f.agent.oz).project(camera);
    out.x = (_v3.x + 1) / 2 * cssW;
    out.y = (1 - _v3.y) / 2 * cssH;
    return out;
  }

  function screenPos(f, out) {
    headTop(f, _v3);
    _v3.y -= 0.35;
    _v3.project(camera);
    out.x = (_v3.x + 1) / 2 * cssW;
    out.y = (1 - _v3.y) / 2 * cssH;
    return out;
  }

  resize();
  placeCamera();

  // ---------------- 公開 API ----------------
  const api = {
    setFish(list = []) {
      const seen = new Set();
      for (const info of list) {
        if (info == null || info.uid == null) continue;
        seen.add(info.uid);
        const f = fishes.get(info.uid);
        if (!f) addFish(info);
        else if (f.agent.spec.id !== info.speciesId) { removeFish(info.uid); addFish(info); }
        else f.agent.setInfo(info);
      }
      for (const uid of [...fishes.keys()]) if (!seen.has(uid)) removeFish(uid);
    },
    setDecor(ids) { tank.setDecor(ids || []); },
    setWater(w) { tank.setWater(w || {}); tank.setFogRange(camDist + TANK_D / 2); },
    feed(xNorm = 0.5, yNorm = 0.3, o = {}) {
      ndc.set(xNorm * 2 - 1, -(yNorm * 2 - 1));
      ray.setFromCamera(ndc, camera);
      // 画面のその位置の真上（水面）に落とす
      const zPlane = 0.4;
      const t = (zPlane - ray.ray.origin.z) / ray.ray.direction.z;
      const p = ray.ray.at(t, _v);
      const b = tank.bounds;
      tank.dropFood(THREE.MathUtils.clamp(p.x, b.minX + 0.4, b.maxX - 0.4), THREE.MathUtils.clamp(zPlane + (Math.random() - 0.5) * 1.5, b.minZ, b.maxZ), o.kind || 'flake');
    },
    /** 水の中の餌を全部消す（水かえのときなど）。 */
    clearFood() { for (const f of tank.foods) { f.alive = false; f.gone = true; } },
    react(uid, type) {
      const f = fishes.get(uid);
      if (!f || !REACTIONS.includes(type)) return false;
      f.agent.startReact(type);
      fx.spawn(type, anchorFor(uid));
      return true;
    },
    on(name, fn) { (listeners[name] ||= new Set()).add(fn); return () => listeners[name].delete(fn); },
    off(name, fn) { listeners[name]?.delete(fn); },
    screenPosOf(uid) {
      const f = fishes.get(uid);
      if (!f) return null;
      return screenPos(f, { x: 0, y: 0 });
    },
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    /** 確認用（中身を見るだけ）。 */
    get _agents() { return [...fishes.values()].map((f) => f.agent); },
    /** 自動えさやり機から少しえさを落とす（機械が無ければ右上から）。 */
    autoFeed(o = {}) { tank.autoFeed(o.kind || 'flake'); },
    /**
     * えさの好みを渡す（何度呼んでもよい。渡した uid だけ上書き）。
     * 例：setFoodPrefs({ f1: { vitamin: 'love' }, f2: { vitamin: 'dislike' } })、f3: 'love' のように文字だけでも可。null で消す。
     */
    setFoodPrefs(map = {}) { for (const [uid, p] of Object.entries(map)) { if (p == null) prefs.delete(uid); else prefs.set(uid, p); } },
    /** そうじのアニメ（約2秒）。終わると解決する Promise を返す。 */
    playClean() { return cleaner.play(); },
    /**
     * 後片付け。canvas をまた使うなら dispose() のまま（renderer を使い回す）。
     * canvas ごと捨てるときは dispose({ releaseContext: true }) で WebGL コンテキストも手放す。
     * 戻り値：片付けたあとに残った GPU の geometry / texture の数（0 なら漏れなし）。
     */
    dispose(o = {}) {
      if (disposed) return null;
      disposed = true;
      api.stop();
      ro?.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      for (const uid of [...fishes.keys()]) removeFish(uid);
      cleaner.dispose(); fx.dispose(); tank.dispose(); lib.dispose();
      scene.clear();
      renderer.renderLists.dispose();
      const left = { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length ?? 0 };
      if (o.releaseContext) { renderer.dispose(); renderer.forceContextLoss(); RENDERERS.delete(canvas); }
      listeners.eat.clear(); listeners.tapFish.clear();
      return left;
    },
    /** 確認用：今の fps と解像度倍率。 */
    get stats() {
      // いちばん小さく見えている魚の全長（画面のピクセル。横から見たときの長さ）
      let minPx = Infinity;
      for (const f of fishes.values()) {
        const a = f.agent;
        const p0 = _v.set(a.pos.x - a.len / 2, a.pos.y, a.pos.z).project(camera);
        const x0 = p0.x, y0 = p0.y;
        const p1 = _v3.set(a.pos.x + a.len / 2, a.pos.y, a.pos.z).project(camera);
        minPx = Math.min(minPx, Math.hypot((p1.x - x0) / 2 * cssW, (p1.y - y0) / 2 * cssH));
      }
      return { fps: Math.round(fps), pixelRatio: dpr, fish: fishes.size, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, minFishPx: Math.round(minPx) };
    },
  };
  void WATER_TOP;
  return api;
}

const _v = new THREE.Vector3(), _v3 = new THREE.Vector3();
