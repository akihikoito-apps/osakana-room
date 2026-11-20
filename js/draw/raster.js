// おえかきの 絵の しょり（おえかき係）。DOM に よらない（node の テストでも うごく）。
// 絵は { width, height, data: Uint8ClampedArray(width*height*4) } の かたち（ImageData と おなじ）。
// マスク・線は Uint8Array(width*height)（0 か 1、線は こさ 0〜255）。

/** あたらしい すける 絵 */
export function blank(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function copyImg(img) {
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

/** すけない ところ（alpha > th）を 1 に した マスク。ぬりえの「ぬれる ところ」 */
export function maskFromAlpha(img, th = 24) {
  const n = img.width * img.height, m = new Uint8Array(n);
  for (let i = 0; i < n; i++) m[i] = img.data[i * 4 + 3] > th ? 1 : 0;
  return m;
}

/** マスクの 中で、そとから d ピクセル いないの ところ（＝そとの りんかく）。画面の はしも そと あつかい */
export function outlineOf(mask, w, h, d = 2) {
  const out = new Uint8Array(w * h);
  const dist = distanceToOutside(mask, w, h, d + 1);
  for (let i = 0; i < w * h; i++) if (mask[i] && dist[i] <= d) out[i] = 1;
  return out;
}

/** マスクの 中の 点が そとから なんピクセルか（チェビシェフ距離。max より とおい ところは max） */
export function distanceToOutside(mask, w, h, max = 255) {
  const dist = new Uint16Array(w * h);
  for (let i = 0; i < w * h; i++) dist[i] = mask[i] ? max : 0;
  // 2かい なめる（まえから・うしろから）
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!dist[i]) continue;
    let v = dist[i];
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) v = 1;
    else v = Math.min(v, dist[i - 1] + 1, dist[i - w] + 1, dist[i - w - 1] + 1, dist[i - w + 1] + 1);
    dist[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!dist[i]) continue;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { dist[i] = 1; continue; }
    dist[i] = Math.min(dist[i], dist[i + 1] + 1, dist[i + w] + 1, dist[i + w + 1] + 1, dist[i + w - 1] + 1);
  }
  return dist;
}

/** あかるさ（0〜255） */
const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

/**
 * もとの 絵から「中の 線」（目・えら・ひれの すじ など）を うすく とりだす。
 * ぼかした あかるさの 傾き（Sobel）の つよい ところ だけ。そとの りんかく ふきんは とらない。
 * かえす：線の こさ Uint8Array（0〜255）
 */
export function innerLinesOf(img, mask, { keep = 0.09, edgeSkip = 4, minGrad = 30, blur = 1, minArea = 0.0001 } = {}) {
  const { width: w, height: h, data: d } = img;
  const n = w * h;
  // あかるさ → ぼかし（写真の こまかい もようを ひろわない）
  const L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = mask[i] ? lum(d, i * 4) : 255;
  const B = boxBlur(L, w, h, blur);
  const dist = distanceToOutside(mask, w, h, edgeSkip + 1);
  const G = new Float32Array(n);
  const hist = new Uint32Array(256);
  let cnt = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (!mask[i] || dist[i] <= edgeSkip) continue;
    const gx = B[i - w + 1] + 2 * B[i + 1] + B[i + w + 1] - B[i - w - 1] - 2 * B[i - 1] - B[i + w - 1];
    const gy = B[i + w - 1] + 2 * B[i + w] + B[i + w + 1] - B[i - w - 1] - 2 * B[i - w] - B[i - w + 1];
    const g = Math.min(255, Math.hypot(gx, gy) / 4);
    G[i] = g; hist[g | 0]++; cnt++;
  }
  // つよい ほうから keep の わりあいの ところで きる
  let th = 255, acc = 0;
  for (let v = 255; v > 0; v--) { acc += hist[v]; if (acc >= cnt * keep) { th = v; break; } }
  th = Math.max(th, minGrad);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (G[i] >= th) out[i] = Math.min(255, Math.round(160 + (G[i] - th) * 2));
  // ちいさな てん・くずは けす（ひれの こまかい すじで ざらざら しない ように）
  dropSmall(out, w, h, Math.max(6, Math.round(n * minArea)));
  return out;
}

/**
 * 目を さがす（ぬりえで ぬっても 目が のこる ように：Codex・agy）。
 * あたま（右がわ）に ある、くらくて まるい 小さな かたまり。みつからなければ null。
 * かえす：{ mask: Uint8Array（目と その まわり 少し）, x, y, r }
 */
export function eyeOf(img, mask, { dark = 70, head = 0.4, grow = 2 } = {}) {
  const { width: w, height: h, data: d } = img;
  const bb = bboxOfMask(mask, w, h);
  if (!bb) return null;
  let maskArea = 0;
  for (let i = 0; i < w * h; i++) maskArea += mask[i];
  const x0 = Math.floor(bb.x + bb.w * (1 - head));
  const isDark = new Uint8Array(w * h);
  for (let y = bb.y; y < bb.y + bb.h; y++) for (let x = x0; x < bb.x + bb.w; x++) {
    const i = y * w + x;
    // くろい（あかい もようは のぞく：どの いろも くらい）
    if (mask[i] && d[i * 4 + 3] > 200 && Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) < dark) isDark[i] = 1;
  }
  const dist = distanceToOutside(mask, w, h, 4);
  const seen = new Uint8Array(w * h);
  let best = null;
  for (let s = 0; s < w * h; s++) {
    if (!isDark[s] || seen[s]) continue;
    const comp = [], stack = [s];
    seen[s] = 1;
    let touchesEdge = false;
    while (stack.length) {
      const i = stack.pop(); comp.push(i);
      if (dist[i] <= 3) touchesEdge = true;
      const x = i % w, y = (i / w) | 0;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= w * h || seen[j] || !isDark[j]) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue;
        seen[j] = 1; stack.push(j);
      }
      void y;
    }
    const a = comp.length;
    if (touchesEdge || a < maskArea * 0.0002 || a > maskArea * 0.02) continue;
    let mx = w, my = h, Mx = 0, My = 0, sx = 0, sy = 0;
    for (const i of comp) { const x = i % w, y = (i / w) | 0; mx = Math.min(mx, x); Mx = Math.max(Mx, x); my = Math.min(my, y); My = Math.max(My, y); sx += x; sy += y; }
    const bw = Mx - mx + 1, bh = My - my + 1;
    const fill = a / (bw * bh);
    if (bw / bh > 2 || bh / bw > 2 || fill < 0.5) continue;      // まるく ない（しま・ふち）
    const cx = sx / a, cy = sy / a;
    const score = fill + cx / w;                                   // まるくて あたまに ちかい ほど よい
    if (!best || score > best.score) best = { score, comp, cx, cy, r: Math.max(bw, bh) / 2 };
  }
  if (!best) return null;
  const out = new Uint8Array(w * h);
  const R = best.r + grow;
  for (let y = Math.max(0, Math.floor(best.cy - R)); y <= Math.min(h - 1, Math.ceil(best.cy + R)); y++) {
    for (let x = Math.max(0, Math.floor(best.cx - R)); x <= Math.min(w - 1, Math.ceil(best.cx + R)); x++) {
      if (mask[y * w + x] && Math.hypot(x - best.cx, y - best.cy) <= R) out[y * w + x] = 1;
    }
  }
  return { mask: out, x: best.cx, y: best.cy, r: R };
}

function bboxOfMask(mask, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** よこ・たての はこ ぼかし（はんけい r）を 2かい */
function boxBlur(src, w, h, r) {
  if (r <= 0) return Float32Array.from(src);
  let a = Float32Array.from(src);
  const tmp = new Float32Array(w * h);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) { const xx = x + k; if (xx < 0 || xx >= w) continue; s += a[y * w + xx]; c++; }
      tmp[y * w + x] = s / c;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) { const yy = y + k; if (yy < 0 || yy >= h) continue; s += tmp[yy * w + x]; c++; }
      a[y * w + x] = s / c;
    }
  }
  return a;
}

/** 0 で ない ところの つながり（8きんぼう）が minArea より ちいさければ 0 に */
export function dropSmall(lines, w, h, minArea) {
  const seen = new Uint8Array(w * h);
  const stack = [], comp = [];
  for (let s = 0; s < w * h; s++) {
    if (!lines[s] || seen[s]) continue;
    stack.length = 0; comp.length = 0;
    stack.push(s); seen[s] = 1;
    while (stack.length) {
      const i = stack.pop(); comp.push(i);
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (lines[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    if (comp.length < minArea) for (const i of comp) lines[i] = 0;
  }
  return lines;
}

/** 2つの 色が にているか（ちがいの いちばん 大きい チャンネルが tol いか。すける どうしは おなじ） */
function near(d, i, c, tol) {
  const a = d[i + 3];
  if (a < 16 && c[3] < 16) return true;
  return Math.abs(d[i] - c[0]) <= tol && Math.abs(d[i + 1] - c[1]) <= tol && Math.abs(d[i + 2] - c[2]) <= tol && Math.abs(a - c[3]) <= tol;
}

/**
 * ぬりつぶし。ref（見る 絵。なければ target）で (x,y) と にた 色の つながった ところを、target に color で ぬる。
 * mask が あれば その中 だけ。grow ピクセル ふちを ひろげて ペンの ふちの ぼかしの すきまを なくす。
 * かえす：ぬった ピクセルの かず
 */
export function floodFill(target, x, y, color, { ref = target, mask = null, tol = 48, grow = 1 } = {}) {
  const { width: w, height: h } = target;
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return 0;
  const start = y * w + x;
  if (mask && !mask[start]) return 0;
  const rd = ref.data;
  const seed = [rd[start * 4], rd[start * 4 + 1], rd[start * 4 + 2], rd[start * 4 + 3]];
  const hit = new Uint8Array(w * h);
  const ok = (i) => !hit[i] && (!mask || mask[i]) && near(rd, i * 4, seed, tol);
  // スキャンライン
  const stack = [start];
  let count = 0;
  while (stack.length) {
    const i = stack.pop();
    if (!ok(i)) continue;
    const yy = (i / w) | 0;
    let l = i, r = i;
    const row0 = yy * w, row1 = row0 + w - 1;
    while (l > row0 && ok(l - 1)) l--;
    while (r < row1 && ok(r + 1)) r++;
    for (let k = l; k <= r; k++) {
      hit[k] = 1; count++;
      if (yy > 0 && ok(k - w)) stack.push(k - w);
      if (yy < h - 1 && ok(k + w)) stack.push(k + w);
    }
  }
  let region = hit;
  for (let g = 0; g < grow; g++) {
    const next = new Uint8Array(region);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = yy * w + xx;
      if (region[i] || (mask && !mask[i])) continue;
      if ((xx > 0 && region[i - 1]) || (xx < w - 1 && region[i + 1]) || (yy > 0 && region[i - w]) || (yy < h - 1 && region[i + w])) next[i] = 1;
    }
    region = next;
  }
  const td = target.data;
  for (let i = 0; i < w * h; i++) {
    if (!region[i]) continue;
    td[i * 4] = color[0]; td[i * 4 + 1] = color[1]; td[i * 4 + 2] = color[2]; td[i * 4 + 3] = color[3] ?? 255;
  }
  return count;
}

/** 上に かさねる（ふつうの アルファ合成）。top は bottom と おなじ 大きさ。bottom を かきかえる */
export function over(bottom, top) {
  const b = bottom.data, t = top.data;
  for (let i = 0; i < b.length; i += 4) {
    const ta = t[i + 3] / 255;
    if (!ta) continue;
    const ba = b[i + 3] / 255;
    const oa = ta + ba * (1 - ta);
    for (let k = 0; k < 3; k++) b[i + k] = (t[i + k] * ta + b[i + k] * ba * (1 - ta)) / oa;
    b[i + 3] = oa * 255;
  }
  return bottom;
}

/**
 * ぬりえの 書き出し用に かさねる。
 * しろい 下地 → paint → 中の 線（lines。こさ×lineAlpha の こい はいいろ）。
 * すけぐあいは もとの 絵の alpha（srcAlpha）と おなじ → もとの 絵と おなじ 形に なる。
 */
export function composeNurie({ paint, srcAlpha, lines = null, lineAlpha = 0.35, lineColor = [70, 82, 92], outline = null, eye = null, src = null }) {
  const { width: w, height: h } = paint;
  const out = blank(w, h);
  const o = out.data, p = paint.data;
  for (let i = 0; i < w * h; i++) {
    const a = srcAlpha[i];
    if (!a) continue;
    const j = i * 4;
    const pa = p[j + 3] / 255;
    let r = 255 * (1 - pa) + p[j] * pa, g = 255 * (1 - pa) + p[j + 1] * pa, b = 255 * (1 - pa) + p[j + 2] * pa;
    const lv = Math.max(lines ? lines[i] : 0, outline && outline[i] ? 255 : 0);
    if (lv) {
      const la = (lv / 255) * lineAlpha;
      // かける（乗算）：下の 色を すこし くらく
      r = r * (1 - la) + (r * lineColor[0] / 255) * la;
      g = g * (1 - la) + (g * lineColor[1] / 255) * la;
      b = b * (1 - la) + (b * lineColor[2] / 255) * la;
    }
    if (eye && eye[i] && src) { r = src.data[j]; g = src.data[j + 1]; b = src.data[j + 2]; }   // 目は もとの 絵の まま
    o[j] = r; o[j + 1] = g; o[j + 2] = b; o[j + 3] = a;
  }
  return out;
}

/** alpha だけ とりだす */
export function alphaOf(img) {
  const n = img.width * img.height, a = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = img.data[i * 4 + 3];
  return a;
}

/** 見える ところ（alpha > th）を かこむ 四角。なにも なければ null */
export function bbox(img, th = 8) {
  const { width: w, height: h, data: d } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] <= th) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export const isBlank = (img, th = 8) => !bbox(img, th);

/** 四角を きりだす（そとは すける） */
export function crop(img, { x, y, w, h }) {
  const out = blank(w, h);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const sx = x + xx, sy = y + yy;
    if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue;
    const s = (sy * img.width + sx) * 4, t = (yy * w + xx) * 4;
    for (let k = 0; k < 4; k++) out.data[t + k] = img.data[s + k];
  }
  return out;
}

/** 長い 辺を max いかに した 大きさ（大きく は しない） */
export function fitLong(w, h, max) {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/** へいきんで ちぢめる（アルファを かけた 色で まぜるので ふちが くろく ならない） */
export function downscale(img, w, h) {
  if (w === img.width && h === img.height) return copyImg(img);
  const out = blank(w, h);
  const sx = img.width / w, sy = img.height / h;
  const s = img.data, o = out.data;
  for (let y = 0; y < h; y++) {
    const y0 = y * sy, y1 = y0 + sy;
    for (let x = 0; x < w; x++) {
      const x0 = x * sx, x1 = x0 + sx;
      let r = 0, g = 0, b = 0, a = 0, area = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(yy + 1, y1) - Math.max(yy, y0);
        if (wy <= 0 || yy >= img.height) continue;
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const wx = Math.min(xx + 1, x1) - Math.max(xx, x0);
          if (wx <= 0 || xx >= img.width) continue;
          const k = wx * wy, i = (yy * img.width + xx) * 4, al = s[i + 3] * k;
          r += s[i] * al; g += s[i + 1] * al; b += s[i + 2] * al; a += al; area += k;
        }
      }
      const j = (y * w + x) * 4;
      if (a > 0) { o[j] = r / a; o[j + 1] = g / a; o[j + 2] = b / a; }
      o[j + 3] = area ? a / area : 0;
    }
  }
  return out;
}

/**
 * オリジナルの 書き出し：よけいな すきまを けずり（長い辺の pad の わりあいだけ のこす）、長い辺 max いかに。
 * なにも かいて いなければ null
 */
export function trimForExport(img, { max = 512, pad = 0.03, th = 8 } = {}) {
  const bb = bbox(img, th);
  if (!bb) return null;
  const p = Math.round(Math.max(bb.w, bb.h) * pad);
  const c = crop(img, { x: bb.x - p, y: bb.y - p, w: bb.w + p * 2, h: bb.h + p * 2 });
  const s = fitLong(c.width, c.height, max);
  return downscale(c, s.w, s.h);
}

/**
 * オリジナルの 書き出し（もじの そう つき）：art と overlay を おなじ 四角で けずる（おなじ 大きさ・おなじ いち）。
 * 四角は 2つを あわせた ものから。art に なにも なければ null。overlay に なにも なければ overlay: null
 */
export function trimPairForExport(art, over, { max = 512, pad = 0.03, th = 8 } = {}) {
  const a = bbox(art, th);
  if (!a) return null;
  const o = over ? bbox(over, th) : null;
  const x0 = Math.min(a.x, o ? o.x : a.x), y0 = Math.min(a.y, o ? o.y : a.y);
  const x1 = Math.max(a.x + a.w, o ? o.x + o.w : 0), y1 = Math.max(a.y + a.h, o ? o.y + o.h : 0);
  const w = x1 - x0, h = y1 - y0;
  const p = Math.round(Math.max(w, h) * pad);
  const box = { x: x0 - p, y: y0 - p, w: w + p * 2, h: h + p * 2 };
  const s = fitLong(box.w, box.h, max);
  return { art: downscale(crop(art, box), s.w, s.h), overlay: o ? downscale(crop(over, box), s.w, s.h) : null };
}

/** すけぐあいを srcAlpha で しぼる（ぬりえの かたちの そとは けす）。img を かきかえる */
export function maskAlpha(img, srcAlpha) {
  for (let i = 0; i < srcAlpha.length; i++) img.data[i * 4 + 3] = (img.data[i * 4 + 3] * srcAlpha[i]) / 255;
  return img;
}

/** ぬりえの 書き出し：もとの 絵と おなじ わく（けずらない）で 長い辺 max いかに */
export function fitForExport(img, max = 512) {
  const s = fitLong(img.width, img.height, max);
  return downscale(img, s.w, s.h);
}

/** '#ff8800' → [255,136,0,255] */
export function hexToRgba(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16), 255];
}
