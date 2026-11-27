// v0.10 レース係：水の 中の コース（DOM・GPU に よらない。tests/v010_race.test.js）。
// まんなかの 線は とじた Catmull-Rom（上下 あり）。魚の 位置は「コース座標」で もつ：
//   s＝スタートからの きょり（しゅうを こえても ふえつづける）、lat＝右が＋の 左右、h＝床からの 高さ。
// 3D に なおすのは 絵を かく ときだけ（worldOf）。

export const LEVELS = ['easy', 'normal', 'hard'];
export const LEVEL_NAME = { easy: 'かんたん', normal: 'ふつう', hard: 'むずかしい' };

// むずかしさ ごとの コース。形は 円に うねり（2・3・4 の 波）を たした もの。length＝1しゅうの ながさ
export const COURSES = {
  easy: {
    name: 'さんごの いりえ', laps: 3, length: 250, width: 10, seed: 11,
    shape: { a2: 0.22, a3: 0.0, a4: 0.0, p2: 0.3, p3: 0, p4: 0 }, elev: { amp: 0.6, waves: 1 },
    rocks: 4, weeds: 3, rings: 6, rockW: [0.9, 1.3],
  },
  normal: {
    name: 'こんぶの もり', laps: 3, length: 270, width: 9, seed: 23,
    shape: { a2: 0.18, a3: 0.12, a4: 0.0, p2: 1.1, p3: 0.4, p4: 0 }, elev: { amp: 1.2, waves: 2 },
    rocks: 7, weeds: 5, rings: 6, rockW: [1.0, 1.6],
  },
  hard: {
    name: 'しんかいの どうくつ', laps: 3, length: 290, width: 8.5, seed: 37,
    shape: { a2: 0.16, a3: 0.14, a4: 0.07, p2: 2.0, p3: 1.3, p4: 0.5 }, elev: { amp: 2.0, waves: 3 },
    rocks: 11, weeds: 6, rings: 6, rockW: [1.1, 1.8],
  },
};

export const ROCK_H = 1.0;     // いわの 高さ（ふつうに およぐ 高さ では こえられない）
export const WEED_H = 1.25;    // かいそうの 高さ
export const SWIM_H = [0.25, 0.85];   // ふつうに およげる 高さ（スティックの 上下）
export const START_CLEAR = 24; // スタートの まえ・あと は なにも おかない

/** きまった じゅんの 乱数 */
export function seeded(seed = 1) {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** コースを つくる。level か 自分の 定義 */
export function buildCourse(level = 'easy', def = COURSES[level] || COURSES.easy) {
  const N = 18;
  const { a2, a3, a4, p2, p3, p4 } = def.shape;
  const ctrl = [];
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const r = 1 + a2 * Math.cos(2 * th + p2) + a3 * Math.sin(3 * th + p3) + a4 * Math.cos(4 * th + p4);
    // ひだり まわり（上から 見て 反時計）。z を マイナスに して 「左カーブ」が おおい コースに する
    ctrl.push([Math.cos(th) * r, def.elev.amp * Math.sin(def.elev.waves * th), -Math.sin(th) * r]);
  }
  // こまかく たどって ながさを はかる
  const SUB = 60, raw = [];
  for (let i = 0; i < N; i++) {
    const P = [ctrl[(i - 1 + N) % N], ctrl[i], ctrl[(i + 1) % N], ctrl[(i + 2) % N]];
    for (let k = 0; k < SUB; k++) {
      const t = k / SUB;
      raw.push([0, 1, 2].map((j) => catmull(P[0][j], P[1][j], P[2][j], P[3][j], t)));
    }
  }
  // 水平の 大きさを 1しゅう＝length に あわせる（たかさは そのまま）
  let len0 = 0;
  for (let i = 0; i < raw.length; i++) { const a = raw[i], b = raw[(i + 1) % raw.length]; len0 += Math.hypot(b[0] - a[0], b[2] - a[2]); }
  const sc = def.length / len0;
  for (const p of raw) { p[0] *= sc; p[2] *= sc; }
  const cum = [0];
  for (let i = 1; i <= raw.length; i++) { const a = raw[i - 1], b = raw[i % raw.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); }
  const L = cum[raw.length];
  // 0.5 ごとに ならべなおす
  const DS = 0.5, M = Math.ceil(L / DS);
  const px = new Float32Array(M), py = new Float32Array(M), pz = new Float32Array(M);
  let j = 0;
  for (let i = 0; i < M; i++) {
    const s = (i / M) * L;
    while (cum[j + 1] < s) j++;
    const a = raw[j], b = raw[(j + 1) % raw.length], u = (s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
    px[i] = a[0] + (b[0] - a[0]) * u; py[i] = a[1] + (b[1] - a[1]) * u; pz[i] = a[2] + (b[2] - a[2]) * u;
  }
  const ds = L / M;
  const head = new Float32Array(M), slope = new Float32Array(M), curv = new Float32Array(M);
  for (let i = 0; i < M; i++) {
    const n = (i + 1) % M, p = (i - 1 + M) % M;
    head[i] = Math.atan2(pz[n] - pz[p], px[n] - px[p]);
    slope[i] = (py[n] - py[p]) / (2 * ds);
  }
  for (let i = 0; i < M; i++) {
    let d = head[(i + 1) % M] - head[(i - 1 + M) % M];
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    curv[i] = -d / (2 * ds);   // ＋＝ひだりカーブ
  }
  // ならす（かくかく しない）
  const sm = Float32Array.from(curv);
  for (let k = 0; k < 6; k++) {
    for (let i = 0; i < M; i++) sm[i] = (curv[(i - 2 + M) % M] + curv[(i - 1 + M) % M] + curv[i] + curv[(i + 1) % M] + curv[(i + 2) % M]) / 5;
    curv.set(sm);
  }

  const course = { level, def, name: def.name, laps: def.laps, width: def.width, half: def.width / 2, length: L, total: L * def.laps, M, ds, px, py, pz, head, slope, curv };
  course.obstacles = placeObstacles(course, def);
  return course;
}

const wrap = (c, s) => ((s % c.length) + c.length) % c.length;
function at(c, arr, s) {
  const f = wrap(c, s) / c.ds, i = Math.floor(f) % c.M, u = f - Math.floor(f);
  return arr[i] + (arr[(i + 1) % c.M] - arr[i]) * u;
}
function atAngle(c, s) {
  const f = wrap(c, s) / c.ds, i = Math.floor(f) % c.M, u = f - Math.floor(f);
  let d = c.head[(i + 1) % c.M] - c.head[i];
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return c.head[i] + d * u;
}
export const curvatureAt = (c, s) => at(c, c.curv, s);
export const slopeAt = (c, s) => at(c, c.slope, s);
export const headingAt = (c, s) => atAngle(c, s);

/** まんなかの 線の 点と むき（水平の 前 fx,fz・右 rx,rz） */
export function frameAt(c, s) {
  const x = at(c, c.px, s), y = at(c, c.py, s), z = at(c, c.pz, s);
  const h = atAngle(c, s);
  const fx = Math.cos(h), fz = Math.sin(h);
  return { x, y, z, h, fx, fz, rx: -fz, rz: fx, slope: at(c, c.slope, s) };
}

/** コース座標 → 3D の 位置 */
export function worldOf(c, s, lat, h) {
  const f = frameAt(c, s);
  return { x: f.x + f.rx * lat, y: f.y + h, z: f.z + f.rz * lat, heading: f.h, slope: f.slope };
}

/** いわ・かいそう・あわの わ を ならべる（むずかしさ ごとに きまった ならび） */
function placeObstacles(c, def) {
  const rnd = seeded(def.seed);
  const L = c.length, half = c.half;
  const out = [];
  const n = def.rocks + def.weeds + def.rings;
  // つかえる はんいを n こに わけ、それぞれの 区間の どこかに 1つ
  const span = (L - START_CLEAR * 2) / n;
  const kinds = [];
  for (let i = 0; i < def.rocks; i++) kinds.push('rock');
  for (let i = 0; i < def.weeds; i++) kinds.push('weed');
  for (let i = 0; i < def.rings; i++) kinds.push('ring');
  // まぜる（まえの 3つは いわ を さける：はじめは なれる 時間）
  for (let i = kinds.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [kinds[i], kinds[k]] = [kinds[k], kinds[i]]; }
  for (let i = 0; i < 2 && kinds[i] === 'rock'; i++) { const k = kinds.findIndex((x, j) => j > 2 && x !== 'rock'); if (k > 0) [kinds[i], kinds[k]] = [kinds[k], kinds[i]]; }
  kinds.forEach((kind, i) => {
    const s = START_CLEAR + span * (i + 0.25 + rnd() * 0.5);
    if (kind === 'rock') {
      // いわ：はばの 一部を ふさぐ。むずかしい ほど はばひろ。すきまは かならず のこす
      const w = def.rockW[0] + rnd() * (def.rockW[1] - def.rockW[0]);
      const lat = (rnd() * 2 - 1) * (half - w - 1.4);
      out.push({ kind, s, lat, w, len: 0.9, height: ROCK_H, seed: Math.floor(rnd() * 1e6) });
      // むずかしい コースは ときどき 2つ ならべて よけにくく（あいだは ジャンプ）
      if (def.rocks > 8 && rnd() < 0.45) {
        const w2 = def.rockW[0];
        const lat2 = lat > 0 ? lat - w - w2 - 2.4 : lat + w + w2 + 2.4;
        if (Math.abs(lat2) < half - w2) out.push({ kind, s: s + 0.6, lat: lat2, w: w2, len: 0.8, height: ROCK_H, seed: Math.floor(rnd() * 1e6) });
      }
    } else if (kind === 'weed') {
      const w = 1.6 + rnd() * 1.0;
      out.push({ kind, s, lat: (rnd() * 2 - 1) * (half - w - 0.6), w, len: 2.2, height: WEED_H, seed: Math.floor(rnd() * 1e6) });
    } else {
      // あわの わ：ふつうの 高さ（だれでも くぐれる）か、すこし 高い（ジャンプで とどく）
      const high = rnd() < 0.3;
      out.push({ kind, s, lat: (rnd() * 2 - 1) * (half - 1.6), h: high ? 1.45 : 0.55, r: 0.95, seed: Math.floor(rnd() * 1e6) });
    }
  });
  return out.sort((a, b) => a.s - b.s);
}

/** s（しゅうを こえた 数も こみ）の すぐ先 range まで（うしろは behind まで）に ある しょうがいぶつ（dist＝まんなかまでの きょり） */
export function obstaclesAhead(c, s, range, behind = 1.5) {
  const out = [];
  const base = wrap(c, s);
  for (const o of c.obstacles) {
    let d = o.s - base;
    if (d < -behind) d += c.length;
    if (d >= -behind && d <= range) out.push({ o, dist: d });
  }
  return out.sort((a, b) => a.dist - b.dist);
}
