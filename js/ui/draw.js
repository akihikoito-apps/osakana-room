// v0.8 おえかき係：ゆめのすいそうの おえかき がめん（がめん いっぱい）。
// ながれ：えらぶ？（ぬりえ／じぶんで かく）→ いきものを えらぶ（ぬりえ）→ かく → しゅるい・はやさ・おおきさ・なまえ → できあがり
// ゆめ係の sim.dream（canAdd・addCreature・baseChoices・kindOf）を よぶ。絵の しょりは js/draw/*.js（DOM に よらない）。
import { el, toast, dialog } from './common.js';
import * as R from '../draw/raster.js';
import * as T from '../draw/tools.js';

let G = null;
let root = null;
/** いまの おえかき（がめんを ひらく たびに つくりなおす） */
let S = null;

const WORK_LONG = 1000;          // かく キャンバスの 長い辺（なかの ピクセル）
const ORIGINAL_W = 1000, ORIGINAL_H = 600;
const ART_MAX = 512;             // 書き出しの 長い辺
const LINE_SHOW = 0.5, LINE_EXPORT = 0.35;   // 中の 線の こさ（がめん・書き出し）
const OUTLINE_COLOR = [150, 172, 186];
// もじペンの ふきだし（Codex・agy：えらんだ ときだけ・かきはじめたら きえる・はんたいに 見える はなしは しない）
const MOJI_HINT = 'なまえや もじは この ペンで かいてね';

const api = () => G?.sim?.dream || null;
const speciesOf = (id) => G.data?.fishById?.[id] || (G.data?.FISH || []).find((f) => f.id === id) || null;
const textureOf = (id) => speciesOf(id)?.texture || `assets/fish/${id}.png`;
const nameOf = (id) => speciesOf(id)?.name || '';

export function init(g) {
  G = g;
  root = el('section', { id: 'scr-draw', class: 'screen', 'data-screen': 'draw', hidden: true });
  document.getElementById('app')?.append(root);
  G.addScreen('draw', { show, hide }, { sheet: false });
}

function show(g, opts = {}) {
  document.body.classList.add('on-draw');
  const t = G.state.tanks.find((x) => x.id === opts.tankId) || G.tank();
  S = { tankId: t?.id, step: 'pick', base: null, cleanup: [] };
  const d = api();
  if (!d) { toast('まだ じゅんびちゅう だよ'); setTimeout(() => G.go('tank'), 0); return; }
  const can = d.canAdd?.(G.state, t);
  if (can && !can.ok) { toast(reasonText(can.reason)); setTimeout(() => G.go('tank'), 0); return; }
  stepPick();
}

function hide() {
  document.body.classList.remove('on-draw');
  endStage();
  S = null;
  root?.replaceChildren();
}

function reasonText(r) {
  const map = { full: 'この すいそうは いっぱい だよ', max: 'ゆめの いきものが いっぱい だよ', limit: 'ゆめの いきものが いっぱい だよ', notDream: 'ゆめのすいそう で かいてね' };
  if (map[r]) return map[r];
  if (typeof r === 'string' && /^[぀-ヿ　\s！？。、ー・]+$/u.test(r)) return r;
  return 'いまは いきものを ふやせないよ';
}

const btn = (cls, label, onclick, extra = {}) => el('button', { class: cls, onclick, ...extra }, label);
/**
 * どうぐ・いろ 用：ゆびを はなした ときに すぐ うごく ボタン。
 * main.js の「ダブルタップで 拡大しない」しくみが すばやい 2かいめの タップの click を けすので、
 * 「ひとつもどす」を つづけて おす・いろを つぎつぎ えらぶ ときも ちゃんと うごく ように pointerup で うごかす。
 */
function tapBtn(cls, label, fn, extra = {}) {
  const b = el('button', { class: cls, ...extra }, label);
  let last = 0;
  b.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' || b.disabled) return;
    const r = b.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    last = Date.now();
    fn(e);
  });
  b.addEventListener('click', (e) => { if (Date.now() - last < 700) return; fn(e); });
  return b;
}
const backBtn = (onclick) => btn('dr-back', [el('span', { class: 'dr-back-ic', text: '◀' }), el('span', { text: 'もどる' })], onclick, { 'aria-label': 'もどる' });

function bubbles() {
  const b = el('div', { class: 'dr-bubbles', 'aria-hidden': 'true' });
  for (let i = 0; i < 10; i++) {
    const s = el('i');
    s.style.left = ((i * 37 + 7) % 100) + '%';
    s.style.setProperty('--sz', 10 + ((i * 13) % 26) + 'px');
    s.style.animationDelay = -((i * 1.7) % 9) + 's';
    b.append(s);
  }
  return b;
}

// ---------------- ① えらぶ？ ----------------
function stepPick() {
  endStage();
  S.step = 'pick';
  const choices = baseChoices();
  const sample = choices[0];
  const nurie = btn('dr-big dr-big-nurie', [
    el('span', { class: 'dr-big-pic' }, sample ? el('img', { src: textureOf(sample), alt: '', draggable: false, class: 'dr-silhouette' }) : el('span', { class: 'dr-big-emoji', text: '🐟' })),
    el('span', { class: 'dr-big-tag', text: 'ぬりえ' }),
    el('span', { class: 'dr-big-lb', text: 'えらぶ' }),
    el('span', { class: 'dr-big-sub', text: choices.length ? 'いきものの かたちに いろを ぬる' : 'ずかんに いきものが いないよ' }),
  ], () => stepBase(), { disabled: !choices.length, 'data-v': 'nurie' });
  const free = btn('dr-big dr-big-free', [
    el('span', { class: 'dr-big-pic' }, el('span', { class: 'dr-big-emoji', text: '✏️' })),
    el('span', { class: 'dr-big-tag', text: 'オリジナル' }),
    el('span', { class: 'dr-big-lb', text: 'じぶんで かく' }),
    el('span', { class: 'dr-big-sub', text: 'すきな いきものを じゆうに かく' }),
  ], () => stepPaint(null), { 'data-v': 'free' });
  root.replaceChildren(el('div', { class: 'dr-page dr-pick' },
    bubbles(),
    el('div', { class: 'dr-head' }, backBtn(() => G.go('tank')), el('h2', { class: 'dr-title', text: 'もとに する いきものを えらぶ？' })),
    el('div', { class: 'dr-big-row' }, nurie, free),
  ));
}

function baseChoices() {
  try { return (api()?.baseChoices?.(G.state) || []).filter((id) => speciesOf(id)); } catch (e) { console.error(e); return []; }
}

// ---------------- ② いきものを えらぶ（ぬりえ） ----------------
function stepBase() {
  endStage();
  S.step = 'base';
  const grid = el('div', { class: 'grid dr-grid' });
  for (const id of baseChoices()) {
    grid.append(btn('dr-card', [
      el('span', { class: 'dr-card-pic' }, el('img', { src: textureOf(id), alt: '', draggable: false, loading: 'lazy' })),
      el('span', { class: 'dr-card-lb', text: nameOf(id) }),
    ], () => stepPaint(id), { 'data-id': id }));
  }
  root.replaceChildren(el('div', { class: 'dr-page dr-base' },
    el('div', { class: 'dr-head' }, backBtn(() => stepPick()), el('h2', { class: 'dr-title', text: 'どの いきものに ぬる？' })),
    grid,
  ));
}

// ---------------- ③ かく ----------------
async function stepPaint(baseId) {
  endStage();
  S.step = 'paint';
  S.base = baseId || null;
  const P = S.paint = {
    base: S.base, tool: 'pen', color: T.COLORS[4].hex, size: 'm',
    sizes: { pen: 'm', moji: 'xs', eraser: 'm' },   // どうぐごとの ふとさ（もじペンは はじめ いちばん ほそい）
    hist: new T.History(12), view: { scale: 1, x: 0, y: 0 }, pointers: new Map(), mode: 'none',
  };
  let src = null;
  if (P.base) {
    try { src = await loadImage(textureOf(P.base)); } catch (e) { console.error(e); toast('えが よみこめなかったよ'); stepBase(); return; }
    if (S?.paint !== P) return;     // まっている あいだに もどった
    const s = R.fitLong(src.naturalWidth, src.naturalHeight, WORK_LONG);
    P.w = s.w; P.h = s.h;
  } else { P.w = ORIGINAL_W; P.h = ORIGINAL_H; }
  P.paintCv = canvas(P.w, P.h);
  P.paintCtx = P.paintCv.getContext('2d', { willReadFrequently: true });
  P.overCv = canvas(P.w, P.h);        // もじペンの そう（f.dream.overlay）
  P.overCtx = P.overCv.getContext('2d', { willReadFrequently: true });
  if (src) buildNurieLayers(P, src);

  // ---- がめん ----
  const view = P.viewCv = canvas(P.w, P.h);
  view.className = 'dr-canvas';
  P.viewCtx = view.getContext('2d');
  const zoom = el('div', { class: 'dr-zoom' }, view);
  const stage = P.stage = el('div', { class: 'dr-stage' + (P.base ? ' is-nurie' : ' is-free') }, zoom);
  P.zoomEl = zoom;
  const zoomReset = P.zoomReset = btn('dr-zoom-reset', '🔍 もとの おおきさ', () => setView(P, { scale: 1, x: 0, y: 0 }), { hidden: true });
  const done = P.doneBtn = btn('dr-done', [el('span', { text: 'できた！' })], () => finishPaint(P), { 'aria-label': 'できた' });
  const tag = P.base
    ? el('div', { class: 'dr-name-tag', text: nameOf(P.base) })
    : el('div', { class: 'dr-head-sign', 'aria-hidden': 'true' }, el('span', { text: 'あたまは こっち' }), el('b', { text: '➡' }));
  P.hint = el('div', { class: 'dr-hint', hidden: true, 'aria-live': 'polite' });
  const area = el('div', { class: 'dr-area' }, stage, zoomReset, P.hint);
  const wrap = el('div', { class: 'dr-canvas-wrap' }, el('div', { class: 'dr-topbar' }, tag, el('span', { class: 'dr-grow' }), done), area);

  const toolBtn = (id, ic, lb) => tapBtn('dr-tool', [el('span', { class: 'dr-ic ' + 'ic-' + id, text: ic }), el('span', { class: 'dr-lb', text: lb })], () => { P.tool = id; if (P.sizes[id]) P.size = P.sizes[id]; if (id === 'pen' || id === 'moji') P.lastPen = id; if (id === 'moji') mojiHint(P); else hideHint(P); refreshTools(P); }, { 'data-tool': id, 'aria-label': lb });
  const sizes = el('div', { class: 'dr-sizes' }, ...T.PEN_SIZES.map((s) => tapBtn('dr-size', el('i', { class: 'dot' }), () => { if (P.tool === 'fill') P.tool = P.lastPen || 'pen'; P.size = s.id; P.sizes[P.tool] = s.id; refreshTools(P); }, { 'data-size': s.id, 'aria-label': s.name })));
  const left = el('div', { class: 'dr-side dr-left' },
    backBtn(() => leavePaint()),
    el('div', { class: 'dr-tools' },
      toolBtn('pen', '✏️', 'ペン'),
      toolBtn('moji', 'あ', 'もじ'),
      toolBtn('eraser', '', 'けしゴム'),
      toolBtn('fill', '🪣', 'ぬりつぶし'),
    ),
    el('div', { class: 'dr-sub', text: 'ふとさ' }),
    sizes,
    el('div', { class: 'dr-tools2' },
      tapBtn('dr-tool dr-undo', [el('span', { class: 'dr-ic', text: '↩️' }), el('span', { class: 'dr-lb', text: 'ひとつ もどす' })], () => undo(P), { 'aria-label': 'ひとつ もどす' }),
      btn('dr-tool dr-clear', [el('span', { class: 'dr-ic', text: '🗑️' }), el('span', { class: 'dr-lb', text: 'ぜんぶ けす' })], () => clearAll(P), { 'aria-label': 'ぜんぶ けす' }),
    ),
  );
  const colors = el('div', { class: 'dr-colors' }, ...T.COLORS.map((c) => tapBtn('dr-color', null, () => { P.color = c.hex; if (P.tool === 'eraser') { P.tool = P.lastPen || 'pen'; P.size = P.sizes[P.tool]; } refreshTools(P); }, { 'data-color': c.hex, 'aria-label': c.name, style: `--c: ${c.hex}` })));
  const right = el('div', { class: 'dr-side dr-right' }, colors);

  root.replaceChildren(el('div', { class: 'dr-page dr-paint' + (P.base ? ' is-nurie' : ' is-free') }, left, wrap, right));
  refreshTools(P);
  render(P);
  bindStage(P, area);
}

function loadImage(src) {
  return new Promise((ok, ng) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => ng(new Error('image ' + src));
    im.src = src;
  });
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** ぬりえの したじ（まっしろ）・そとの りんかく・中の 線 を つくる */
function buildNurieLayers(P, src) {
  const tmp = canvas(P.w, P.h);
  const tc = tmp.getContext('2d', { willReadFrequently: true });
  tc.drawImage(src, 0, 0, P.w, P.h);
  const img = tc.getImageData(0, 0, P.w, P.h);
  P.srcAlpha = R.alphaOf(img);
  P.mask = R.maskFromAlpha(img, 24);
  P.lines = R.innerLinesOf(img, P.mask);
  const outline = R.outlineOf(P.mask, P.w, P.h, Math.max(2, Math.round(P.w / 340)));
  // まっしろ（もとの 絵と おなじ すけぐあい）
  const white = R.blank(P.w, P.h);
  for (let i = 0; i < P.w * P.h; i++) { const j = i * 4; white.data[j] = white.data[j + 1] = white.data[j + 2] = 255; white.data[j + 3] = P.srcAlpha[i]; }
  P.whiteCv = toCanvas(white);
  const ln = R.blank(P.w, P.h);
  for (let i = 0; i < P.w * P.h; i++) {
    const j = i * 4;
    if (outline[i]) { ln.data[j] = OUTLINE_COLOR[0]; ln.data[j + 1] = OUTLINE_COLOR[1]; ln.data[j + 2] = OUTLINE_COLOR[2]; ln.data[j + 3] = 230; }
    else if (P.lines[i]) { ln.data[j] = 70; ln.data[j + 1] = 82; ln.data[j + 2] = 92; ln.data[j + 3] = P.lines[i] * LINE_SHOW; }
  }
  P.lineCv = toCanvas(ln);
  P.outline = outline;
  P.outlineThin = R.outlineOf(P.mask, P.w, P.h, Math.max(1, Math.round(P.w / 500)));   // 書き出し用（512 で 1ピクセル くらい）
  // 目（ぬっても のこる）
  P.src = img;
  const eye = R.eyeOf(img, P.mask);
  P.eye = eye ? eye.mask : null;
  if (P.eye) {
    const ey = R.blank(P.w, P.h);
    for (let i = 0; i < P.w * P.h; i++) if (P.eye[i]) { const j = i * 4; ey.data.set([img.data[j], img.data[j + 1], img.data[j + 2], img.data[j + 3]], j); }
    P.eyeCv = toCanvas(ey);
  }
}

function toCanvas(img) {
  const c = canvas(img.width, img.height);
  const ctx = c.getContext('2d');
  const id = ctx.createImageData(img.width, img.height);
  id.data.set(img.data);
  ctx.putImageData(id, 0, 0);
  return c;
}

/** みえる キャンバスを かきなおす */
function render(P) {
  const c = P.viewCtx;
  c.save();
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, P.w, P.h);
  if (P.base) {
    c.drawImage(P.whiteCv, 0, 0);
    c.globalCompositeOperation = 'source-atop';     // かたちの 中 だけ（はみだしは みえない）
    c.drawImage(P.paintCv, 0, 0);
    c.drawImage(P.lineCv, 0, 0);
    if (P.eyeCv) c.drawImage(P.eyeCv, 0, 0);
    c.drawImage(P.overCv, 0, 0);                    // もじも かたちの 中 だけ
  } else {
    c.drawImage(P.paintCv, 0, 0);
    c.drawImage(P.overCv, 0, 0);
  }
  c.restore();
  if (P.doneBtn) P.doneBtn.disabled = !P.base && !P.inkCache;
}

function refreshTools(P) {
  for (const b of root.querySelectorAll('.dr-tool[data-tool]')) b.classList.toggle('on', b.dataset.tool === P.tool);
  for (const b of root.querySelectorAll('.dr-size')) {
    b.classList.toggle('on', b.dataset.size === P.size && P.tool !== 'fill');
    const px = { xs: 4, s: 8, m: 16, l: 26 }[b.dataset.size];
    b.style.setProperty('--d', px + 'px');
    b.style.setProperty('--c', P.tool === 'eraser' ? '#ffffff' : P.color);
  }
  for (const b of root.querySelectorAll('.dr-color')) b.classList.toggle('on', b.dataset.color === P.color && P.tool !== 'eraser');
  const u = root.querySelector('.dr-undo');
  if (u) u.disabled = P.hist.size === 0;
  P.stage?.setAttribute('data-tool', P.tool);
}

// ---- ゆび・ペン ----
function bindStage(P, wrap) {
  const stage = P.stage;
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); S.cleanup.push(() => t.removeEventListener(ev, fn, o)); };
  const pos = (e) => T.toCanvas(e.clientX, e.clientY, P.viewCv.getBoundingClientRect(), P.w, P.h);
  const local = (e) => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  on(stage, 'pointerdown', (e) => {
    e.preventDefault();
    try { stage.setPointerCapture(e.pointerId); } catch { /* なし */ }
    P.pointers.set(e.pointerId, local(e));
    if (P.pointers.size === 1) {
      if (P.mode !== 'none') return;
      const p = pos(e);
      if (P.tool === 'fill') { P.mode = 'fill'; P.fillAt = { p, start: local(e) }; return; }
      P.mode = 'stroke';
      hideHint(P);
      P.strokeSnap = snapshot(P);
      P.last = p;
      strokeAll(P, [p]);
      render(P);
    } else if (P.pointers.size === 2) {
      // 2ほんめの ゆび：かきかけの 線は なかった ことに して、ズームに する（ピンチで よけいな 線が でない）
      if (P.mode === 'stroke' && P.strokeSnap) { restore(P, P.strokeSnap); render(P); }
      P.strokeSnap = null;
      P.mode = 'pinch';
      P.pinchPrev = [...P.pointers.values()].map((v) => ({ ...v }));
    } else P.mode = 'pinch';
  });
  on(stage, 'pointermove', (e) => {
    if (!P.pointers.has(e.pointerId)) return;
    e.preventDefault();
    P.pointers.set(e.pointerId, local(e));
    if (P.mode === 'stroke') {
      const evs = e.getCoalescedEvents?.() || [e];
      const pts = [P.last];
      for (const ce of (evs.length ? evs : [e])) pts.push(pos(ce));
      strokeAll(P, pts);
      P.last = pts[pts.length - 1];
      render(P);
    } else if (P.mode === 'pinch' && P.pointers.size === 2 && P.pinchPrev?.length === 2) {
      const now = [...P.pointers.values()];
      const v = T.pinchView(P.view, P.pinchPrev[0], P.pinchPrev[1], now[0], now[1], { min: 1, max: 3 });
      setView(P, v);
      P.pinchPrev = now.map((x) => ({ ...x }));
    }
  });
  const up = (e) => {
    if (!P.pointers.has(e.pointerId)) return;
    P.pointers.delete(e.pointerId);
    if (P.mode === 'stroke' && P.pointers.size === 0) {
      if (e.type === 'pointercancel' && P.strokeSnap) restore(P, P.strokeSnap);
      else if (P.strokeSnap) P.hist.push(P.strokeSnap);
      P.strokeSnap = null; P.mode = 'none';
      afterChange(P);
    } else if (P.mode === 'fill' && P.pointers.size === 0) {
      P.mode = 'none';
      if (e.type !== 'pointercancel') doFill(P, P.fillAt.p);
    } else if (P.pointers.size === 0) {
      P.mode = 'none';
    } else if (P.mode === 'pinch' && P.pointers.size === 1) {
      P.pinchPrev = null;   // のこりの ゆびを はなすまで なにも しない
    }
  };
  on(stage, 'pointerup', up);
  on(stage, 'pointercancel', up);
  on(stage, 'lostpointercapture', (e) => { if (P.pointers.has(e.pointerId)) up(e); });
  // キャンバスの 大きさを わくに あわせる
  const fit = () => {
    const r = wrap.getBoundingClientRect();
    const pad = 6;
    const k = Math.min((r.width - pad * 2) / P.w, (r.height - pad * 2) / P.h);
    stage.style.width = Math.max(10, Math.floor(P.w * k)) + 'px';
    stage.style.height = Math.max(10, Math.floor(P.h * k)) + 'px';
    setView(P, { scale: 1, x: 0, y: 0 });
  };
  fit();
  if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(fit); ro.observe(wrap); S.cleanup.push(() => ro.disconnect()); }
  else on(window, 'resize', fit);
}

function setView(P, v) {
  const r = P.stage.getBoundingClientRect();
  P.view = T.clampView(v, r.width, r.height);
  P.zoomEl.style.transform = `translate(${P.view.x}px, ${P.view.y}px) scale(${P.view.scale})`;
  if (P.zoomReset) P.zoomReset.hidden = P.view.scale <= 1.01;
}

function toolNow(P) {
  return { mode: P.tool === 'eraser' ? 'eraser' : 'pen', color: P.color, width: T.penWidth(P.size, Math.max(P.w, P.h)) / Math.max(1, P.view.scale > 1 ? Math.sqrt(P.view.scale) : 1) };
}

/** ひとつもどす 用：ぬった そう と もじの そう の りょうほう */
function snapshot(P) { return { paint: P.paintCtx.getImageData(0, 0, P.w, P.h), over: P.overCtx.getImageData(0, 0, P.w, P.h) }; }
function restore(P, snap) { P.paintCtx.putImageData(snap.paint, 0, 0); P.overCtx.putImageData(snap.over, 0, 0); }

/** ペン（ぬる そう）・もじ（もじの そう）・けしゴム（りょうほう けす） */
function strokeAll(P, pts) {
  const t = toolNow(P);
  if (P.tool === 'eraser') { T.strokeOn(P.paintCtx, t, pts); T.strokeOn(P.overCtx, t, pts); }
  else T.strokeOn(P.tool === 'moji' ? P.overCtx : P.paintCtx, t, pts);
}

/** もじペンを えらんだ ときの ふきだし（すこし たったら きえる） */
function mojiHint(P) {
  if (!P.hint) return;
  P.hint.replaceChildren(el('b', { text: 'あ' }), el('span', { text: MOJI_HINT }));
  P.hint.hidden = false;
  clearTimeout(P.hintTimer);
  P.hintTimer = setTimeout(() => hideHint(P), 5000);
}
function hideHint(P) { clearTimeout(P.hintTimer); if (P.hint) P.hint.hidden = true; }

function afterChange(P) {
  if (!P.base) P.inkCache = !R.isBlank(P.paintCtx.getImageData(0, 0, P.w, P.h));
  refreshTools(P);
  render(P);
}

function doFill(P, p) {
  const before = snapshot(P);
  const target = { width: P.w, height: P.h, data: new Uint8ClampedArray(before.paint.data) };
  let n;
  if (P.base) {
    // 見る 絵＝まっしろ＋ぬった いろ（中の 線は 見ない。すきまから もれて こまらない ように：Codex・agy）
    const tmp = canvas(P.w, P.h);
    const tc = tmp.getContext('2d', { willReadFrequently: true });
    tc.drawImage(P.whiteCv, 0, 0);
    tc.globalCompositeOperation = 'source-atop';
    tc.drawImage(P.paintCv, 0, 0);
    const ref = tc.getImageData(0, 0, P.w, P.h);
    n = R.floodFill(target, p.x, p.y, R.hexToRgba(P.color), { ref, mask: P.mask });
  } else {
    n = R.floodFill(target, p.x, p.y, R.hexToRgba(P.color));
  }
  if (!n) return;
  P.hist.push(before);
  const id = P.paintCtx.createImageData(P.w, P.h);
  id.data.set(target.data);
  P.paintCtx.putImageData(id, 0, 0);
  afterChange(P);
}

function undo(P) {
  const snap = P.hist.undo();
  if (!snap) return;
  restore(P, snap);
  afterChange(P);
}

async function clearAll(P) {
  if (P.hist.size === 0 && (P.base || !P.inkCache)) return;
  const v = await dialog([el('div', { class: 'big', text: 'ほんとうに ぜんぶ けして いい？' })], [
    { label: 'はい', value: true, kind: 'soft' },          // agy：けす ほうは めだたせない（はんしゃで おさない）
    { label: 'やめる', value: false, kind: 'primary' },
  ], { cancelValue: false });
  if (!v || S?.paint !== P) return;
  P.hist.push(snapshot(P));      // ぜんぶけす も「ひとつ もどす」で もどせる
  P.paintCtx.clearRect(0, 0, P.w, P.h);
  P.overCtx.clearRect(0, 0, P.w, P.h);
  afterChange(P);
}

async function leavePaint() {
  const P = S.paint;
  const back = () => (P.base ? stepBase() : stepPick());
  if (P.hist.size === 0) { back(); return; }
  const v = await dialog([el('div', { class: 'big', text: 'かいた えが きえちゃうよ。もどる？' })], [
    { label: 'もどる', value: true, kind: 'soft' },
    { label: 'つづける', value: false, kind: 'primary' },
  ], { cancelValue: false });
  if (v && S?.paint === P) back();
}

function endStage() {
  if (!S) return;
  for (const f of S.cleanup.splice(0)) { try { f(); } catch { /* なし */ } }
}

/**
 * 書き出し（約束：すける PNG・真横・頭は 右・長い辺 512 いか）。
 * かえす：{ art, overlay }（overlay＝もじペンの そう。art と おなじ 大きさ・いち。なにも なければ null）。art が なければ null
 */
export function exportArt(P) {
  const paint = P.paintCtx.getImageData(0, 0, P.w, P.h);
  const over = P.overCtx.getImageData(0, 0, P.w, P.h);
  const url = (img) => toCanvas(img).toDataURL('image/png');
  if (P.base) {
    // ぬりえ：もとの 絵と おなじ わく。そとの りんかくも うすく（agy：しろく ぬった ところで からだが きれて 見えない ように）・目は のこす
    const comp = R.composeNurie({ paint, srcAlpha: P.srcAlpha, lines: P.lines, lineAlpha: LINE_EXPORT, outline: P.outlineThin, eye: P.eye, src: P.src });
    const ov = R.maskAlpha({ width: P.w, height: P.h, data: over.data }, P.srcAlpha);   // かたちの そとの もじは けす
    return { art: url(R.fitForExport(comp, ART_MAX)), overlay: R.isBlank(ov) ? null : url(R.fitForExport(ov, ART_MAX)) };
  }
  const pair = R.trimPairForExport(paint, over, { max: ART_MAX });
  if (!pair) return null;
  return { art: url(pair.art), overlay: pair.overlay ? url(pair.overlay) : null };
}

function finishPaint(P) {
  const out = exportArt(P);
  if (!out) { toast('いきものを かいてね'); return; }
  P.art = out.art;
  P.overlay = out.overlay;
  stepInfo(P);
}

// ---------------- ④ しゅるい・はやさ・おおきさ・なまえ ----------------
function stepInfo(P) {
  endStage();
  S.step = 'info';
  const d = api();
  const fixedKind = P.base ? (d?.kindOf?.(P.base) || 'fish') : null;
  const I = S.info ||= { kind: 'fish', speed: 'normal', size: 'm', name: '' };
  if (fixedKind) I.kind = fixedKind;
  const row = (label, key, list) => el('div', { class: 'dr-row', 'data-key': key },
    el('span', { class: 'dr-row-lb', text: label }),
    el('div', { class: 'dr-opts' }, ...list.map((o) => btn('dr-opt' + (I[key] === o.id ? ' on' : ''), [o.ic ? el('span', { class: 'dr-opt-ic', text: o.ic }) : sizeDot(o.id), el('span', { text: o.name })], (e) => {
      I[key] = o.id;
      for (const b of e.currentTarget.parentElement.children) b.classList.toggle('on', b === e.currentTarget);
    }, { 'data-v': o.id }))),
  );
  const kindRow = fixedKind
    ? el('div', { class: 'dr-row', 'data-key': 'kind' }, el('span', { class: 'dr-row-lb', text: 'しゅるい' }),
      el('div', { class: 'dr-opts' }, el('span', { class: 'dr-fixed' }, el('span', { class: 'dr-opt-ic', text: (T.KINDS.find((k) => k.id === fixedKind) || T.KINDS[0]).ic }), el('span', { text: `${(T.KINDS.find((k) => k.id === fixedKind) || T.KINDS[0]).name}（${nameOf(P.base)}と おなじ）` }))))
    : row('しゅるい', 'kind', T.KINDS);
  const input = el('input', { class: 'dr-name', type: 'text', maxlength: String(T.NAME_MAX + 4), value: I.name, placeholder: 'なまえ（ひらがな）', autocomplete: 'off', enterkeyhint: 'done', 'aria-label': 'なまえ' });
  const note = el('span', { class: 'dr-name-note' });
  let composing = false;
  const clean = () => {
    if (composing) return;
    const c = T.cleanName(input.value);
    if (c.name !== input.value) input.value = c.name;
    note.textContent = c.dropped ? 'ひらがなか カタカナで かいてね' : '';
    I.name = c.name;
  };
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; clean(); });
  input.addEventListener('input', clean);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
  const nameRow = el('div', { class: 'dr-row', 'data-key': 'name' }, el('span', { class: 'dr-row-lb', text: 'なまえ' }),
    el('div', { class: 'dr-opts' }, input, btn('dr-opt dr-omakase', [el('span', { class: 'dr-opt-ic', text: '🎲' }), el('span', { text: 'おまかせ' })], () => { input.value = T.randomName(); clean(); }), note));
  const doneBtn = btn('dr-done dr-finish', [el('span', { text: 'できあがり！' })], () => complete(P));
  root.replaceChildren(el('div', { class: 'dr-page dr-info' },
    el('div', { class: 'dr-head' }, backBtn(() => backToPaint(P)), el('h2', { class: 'dr-title', text: 'どんな いきもの？' }), doneBtn),
    el('div', { class: 'dr-info-body' },
      el('div', { class: 'dr-preview' + (P.base ? '' : ' is-free') }, el('div', { class: 'dr-preview-art' }, el('img', { src: P.art, alt: '', draggable: false }), P.overlay ? el('img', { class: 'dr-preview-over', src: P.overlay, alt: '', draggable: false }) : null)),
      el('div', { class: 'dr-form list' }, kindRow, row('はやさ', 'speed', T.SPEEDS), row('おおきさ', 'size', T.SIZES), nameRow),
    ),
  ));
}

function sizeDot(id) { return el('i', { class: 'dr-size-dot', style: `--d: ${{ s: '10px', m: '16px', l: '24px' }[id] || '16px'}` }); }

/** かいた 絵は そのままで かく がめんに もどる */
function backToPaint(P) {
  S.step = 'paint';
  const keep = snapshot(P);
  const hist = P.hist;
  const color = P.color, size = P.size, tool = P.tool, sizes = P.sizes;
  stepPaint(P.base).then(() => {
    const Q = S?.paint;
    if (!Q || Q.w !== P.w) return;
    restore(Q, keep);
    Q.hist = hist; Q.color = color; Q.size = size; Q.tool = tool; Q.lastPen = P.lastPen; Q.sizes = sizes;
    afterChange(Q);
  });
}

function complete(P) {
  const d = api();
  const st = G.state;
  const t = st.tanks.find((x) => x.id === S.tankId);
  if (!d || !t) { toast('すいそうが みつからないよ'); return; }
  const can = d.canAdd?.(st, t);
  if (can && !can.ok) { toast(reasonText(can.reason)); return; }
  const I = S.info;
  let info;
  try {
    info = T.makeDreamInfo({ art: P.art, overlay: P.overlay, base: P.base, kind: I.kind, speed: I.speed, size: I.size, name: I.name, made: G.sim.gameDay(st.clock.min) });
  } catch (e) { console.error(e); toast('もういちど かいてみてね'); return; }
  let f = null;
  try { f = d.addCreature(st, t, info); } catch (e) { console.error(e); }
  if (!f) { toast('うまく いれられなかったよ'); return; }
  G.saveNow();
  G.setTank(t.id);
  toast(`${info.name || 'あたらしい いきもの'} が すいそうに はいったよ！`, 'gold');
  G.emit('changed');
  G.emit('dreamAdded', { tankId: t.id, uid: f.uid });
  G.go('tank');
}
