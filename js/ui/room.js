// へや：部屋の絵の上の 水槽台（v0.2 は 2だん×3れつ＝6わく）に 水槽を重ねる。
// 水槽をタップ → その水槽へ ズームして すいそう画面へ。もどるときは ズームアウト。
// - 持っていない わくは うすい「＋」（おみせの 水槽へ）、かいほう前は かぎ。
// - assets/room/room_v2.jpg が 読めないときは v0.1 の 部屋（台 1つ）で 1つめの 水槽だけ 出す。
import { $, $$, el, toast } from './common.js';
import { lightOf } from '../state.js';

const IMG_W = 1920, IMG_H = 1080;
// 絵ごとの わく（絵に対する割合）。x0〜x1 が 天板の 左右、bottom が 水槽の 底の 高さ。
// room_v2 の 数値は docs/アート.md（デザイン係）に あわせる。
const ROOMS = {
  v2: {
    src: 'assets/room/room_v2.jpg', night: 'assets/room/room_v2_night.jpg', floorY: 0.80,
    // docs/アート.md 5章：x 左・右、bottom ＝ 奥 y と 手前 y の あいだ、top ＝ 上の限り
    slots: [
      { x0: 0.302, x1: 0.435, bottom: 0.5395, top: 0.314 }, { x0: 0.450, x1: 0.586, bottom: 0.5395, top: 0.314 }, { x0: 0.601, x1: 0.734, bottom: 0.5395, top: 0.314 },
      { x0: 0.302, x1: 0.435, bottom: 0.7535, top: 0.565 }, { x0: 0.450, x1: 0.586, bottom: 0.7535, top: 0.565 }, { x0: 0.601, x1: 0.734, bottom: 0.7535, top: 0.565 },
    ],
  },
  v1: { src: 'assets/room/room_base.jpg', floorY: 0.775, slots: [{ x0: 0.382, x1: 0.708, bottom: 0.571 }] },
};
let ROOM = ROOMS.v1;

let G = null;
const keys = {};
let zoomed = null;        // ズームして 入った わく（もどる ときに つかう）

export function init(g) {
  G = g;
  $$('#room-nav [data-go]').forEach((b) => b.addEventListener('click', () => G.go(b.dataset.go)));
  window.addEventListener('resize', () => { layout(); render(true); });
  G.on('tick', () => { if (G.screen === 'room') { renderNight(); render(); } });
  G.on('changed', () => { if (G.screen === 'room') render(true); });
  // 新しい 部屋の 絵が あれば つかう（無ければ v0.1 の 部屋）
  const probe = new Image();
  probe.onload = () => { ROOM = ROOMS.v2; $('#room-bg').src = ROOM.src; buildSlots(); layout(); renderNight(); render(true); G.emit('roomReady'); };
  probe.src = ROOMS.v2.src;
  buildSlots();
  layout();
}

export function show(g, opts = {}) {
  G = g;
  layout();
  renderNight();
  render(true);
  // すいそうから もどってきた：ズームアウト
  if (zoomed != null && opts.from === 'tank') zoomOut(zoomed);
  zoomed = null;
}

// ---------- わく ----------
function buildSlots() {
  const box = $('#room-slots');
  box.replaceChildren();
  ROOM.slots.forEach((s, k) => {
    const b = el('button', { class: 'room-slot', 'data-slot': String(k), 'aria-label': 'すいそう' });
    if (k === 0) b.id = 'room-tank';      // チュートリアル・てんけんの テストが さがす なまえ
    b.addEventListener('click', () => onSlot(k, b));
    box.append(b, el('div', { class: 'slot-tag', 'data-slot': String(k) }));
  });
  for (const k of Object.keys(keys)) delete keys[k];
}

function onSlot(k, b) {
  const t = G.state.tanks.find((x) => x.slot === k);
  if (t) {
    G.setTank(t.id);
    G.emit('action', { type: 'openTank', tankId: t.id });
    zoomIn(b, () => G.go('tank'));
    return;
  }
  if (!G.sim.isUnlocked(G.state, 'tank6')) { toast(G.sim.balance().UNLOCK?.tank6?.lockedLine || '1つめの すいそうに 6ぴき いると おけるよ'); return; }
  G.go('shop', { tab: 'tanks' });
}

/** 部屋の絵を画面に合わせる。少しの切り取りなら cover、大きく切れるなら contain にして余白を壁と床の色で埋める。 */
function layout() {
  const W = innerWidth, H = innerHeight;
  const cover = Math.max(W / IMG_W, H / IMG_H), contain = Math.min(W / IMG_W, H / IMG_H);
  const cropX = (IMG_W * cover - W) / (IMG_W * cover), cropY = (IMG_H * cover - H) / (IMG_H * cover);
  const s = cropX > 0.1 || cropY > 0.12 ? contain : cover;
  const w = IMG_W * s, h = IMG_H * s;
  const left = (W - w) / 2;
  const top = h < H ? Math.min(H - h, Math.max(0, (H - h) * 0.55)) : (H - h) / 2;
  const st = $('#room-stage');
  Object.assign(st.style, { left: left + 'px', top: top + 'px', width: w + 'px', height: h + 'px' });
  st.classList.toggle('lb-y', s === contain && h < H - 2);
  st.classList.toggle('lb-x', s === contain && w < W - 2);
  $('#scr-room').style.setProperty('--floor-y', (top + h * ROOM.floorY) + 'px');
  ROOM.slots.forEach((sl, k) => {
    const tw = (sl.x1 - sl.x0) * 0.94;
    const x0 = sl.x0 + (sl.x1 - sl.x0) * 0.03;
    let th = tw * w * 0.6 / h;             // 横:縦 ≒ 1 : 0.6
    if (sl.top != null) th = Math.min(th, (sl.bottom - sl.top) * 0.92);
    const b = $(`.room-slot[data-slot="${k}"]`);
    if (!b) return;
    Object.assign(b.style, { left: x0 * 100 + '%', width: tw * 100 + '%', top: (sl.bottom - th) * 100 + '%', height: th * 100 + '%' });
    const tag = $(`.slot-tag[data-slot="${k}"]`);
    Object.assign(tag.style, { left: (x0 + tw / 2) * 100 + '%', top: (sl.bottom + 0.012) * 100 + '%' });
  });
  const tip = $('#room-tank-tip');
  const s0 = ROOM.slots[0];
  tip.style.left = ((s0.x0 + s0.x1) / 2) * 100 + '%';
  tip.style.top = (s0.top != null ? s0.top - 0.01 : s0.bottom - (s0.x1 - s0.x0) * w * 0.6 / h - 0.03) * 100 + '%';
}

function renderNight() {
  const l = lightOf(G.state.clock.min);
  const n = $('#room-night');
  if (!n.dataset.ready) { n.style.transition = 'none'; n.dataset.ready = '1'; requestAnimationFrame(() => requestAnimationFrame(() => { n.style.transition = ''; })); }
  // よるの 絵が ある 部屋は 絵を かえて、かさねる くらさは すこしだけ
  const night = l < 0.6;
  if (ROOM.night) { const want = night ? ROOM.night : ROOM.src; if (!$('#room-bg').src.endsWith(want)) $('#room-bg').src = want; }
  n.style.opacity = String(Math.max(0, (1 - l) * (ROOM.night ? 0.25 : 0.85)));
}

/** わくごとの 中身。中身が かわったときだけ 作りなおす。 */
function render(force) {
  const s = G.state;
  const first = s.tanks.find((t) => t.slot === 0) || s.tanks[0];
  const tip = $('#room-tank-tip');
  tip.textContent = first.fish.length ? 'タップ してね' : 'からっぽの すいそう';
  tip.hidden = !s.tutorial.done || (first.fish.length > 0 && (s.stats.openTank || 0) > 3);
  ROOM.slots.forEach((sl, k) => {
    const b = $(`.room-slot[data-slot="${k}"]`);
    const tag = $(`.slot-tag[data-slot="${k}"]`);
    if (!b) return;
    const t = s.tanks.find((x) => x.slot === k);
    const kind = t ? 'tank' : G.sim.isUnlocked(s, 'tank6') ? 'free' : 'lock';
    const weak = !!t && t.fish.some((f) => f.health < G.sim.balance().HEALTH.weak);
    const key = kind + '|' + weak + '|' + (t ? t.water + t.fish.map((f) => f.uid + f.stage).join(',') + '|' + t.decor.join(',') + '|' + G.sim.tankName(s, t) : '');
    const glow = b.classList.contains('guide-target');
    b.className = 'room-slot ' + kind + (t ? ' ' + t.water : '') + (t && t.clean < 40 ? ' dirty' : '') + (glow ? ' guide-target' : '');
    if (!force && keys[k] === key) return;
    keys[k] = key;
    tag.hidden = !t;
    if (t) tag.textContent = G.sim.tankName(s, t);
    if (kind === 'tank') { b.setAttribute('aria-label', G.sim.tankName(s, t)); b.replaceChildren(...miniTank(t, b), weak ? el('span', { class: 'slot-drop', text: '💧' }) : ''); }
    else if (kind === 'free') { b.setAttribute('aria-label', 'すいそうを おく'); b.replaceChildren(el('span', { class: 'slot-plus', text: '＋' }), el('span', { class: 'slot-free', text: 'すいそうを おける' })); }
    else { b.setAttribute('aria-label', 'まだ つかえない'); b.replaceChildren(el('span', { class: 'slot-lock', text: '🔒' })); }
  });
}

/** 部屋の 小さな 水槽（2D）。魚の 絵を 小さく 泳がせる */
function miniTank(t, b) {
  const decor = el('div', { class: 'rt-decor' });
  const pics = { stone: 'assets/room/stone1.png', driftwood: 'assets/room/driftwood.png' };
  const plants = ['assets/room/plant1.png', 'assets/room/plant2.png', 'assets/room/plant3.png'];
  let pi = 0, si = 0;
  for (const id of t.decor) {
    if (id === 'air_pump') { decor.append(el('div', { class: 'rt-bubbles' }, el('i'), el('i'), el('i'), el('i'))); continue; }
    if (id === 'heater') { decor.append(el('div', { class: 'rt-heater' })); continue; }
    if (id === 'filter') { decor.append(el('div', { class: 'rt-filter' })); continue; }
    if (id === 'light') { decor.append(el('div', { class: 'rt-light' })); continue; }
    let src = pics[id];
    if (id === 'plant') src = plants[pi++ % 3];
    if (id === 'stone') src = ['assets/room/stone1.png', 'assets/room/stone3.png'][si++ % 2];
    if (!src) continue;
    const img = el('img', { src, alt: '' });
    const pos = { stone: [12, 58], plant: [4, 78, 30, 62], driftwood: [36] }[id] || [50];
    img.style.left = pos[(id === 'plant' ? pi - 1 : id === 'stone' ? si - 1 : 0) % pos.length] + '%';
    img.style.height = id === 'plant' ? '62%' : id === 'driftwood' ? '28%' : '22%';
    decor.append(img);
  }
  const fishBox = el('div', { class: 'rt-fish' });
  const bw = b.getBoundingClientRect().width || 200;
  t.fish.slice(0, 12).forEach((f, i) => {
    const sp = G.data.fishById[f.speciesId];
    if (!sp) return;
    const bottomish = sp.swim?.layer === 'bottom' || sp.kind === 'snail';
    const wPct = (sp.kind === 'fish' ? 13 : 10) * [0.75, 1, 1.25][f.stage];
    const img = el('img', { src: sp.texture, alt: '', onerror: (e) => { e.target.replaceWith(el('i', { class: 'rf-dot' })); } });
    const d = el('div', { class: 'rf' }, img);
    const x0 = 6 + ((i * 53) % 50);
    d.style.width = wPct + '%';
    d.style.left = x0 + '%';
    d.style.top = (bottomish ? 70 + (i % 2) * 4 : 22 + ((i * 37) % 40)) + '%';
    d.style.setProperty('--d', (7 + (i % 4) * 2.3) / (sp.swim?.speed || 1) + 's');
    d.style.setProperty('--dx', Math.max(12, bw * (0.86 - x0 / 100 - wPct / 100)) + 'px');
    d.style.animationDelay = -i * 1.7 + 's';
    img.style.animationDelay = -i * 1.7 + 's';
    fishBox.append(d);
  });
  return [
    el('div', { class: 'glass' }, el('div', { class: 'water' }, el('div', { class: 'sand' }), decor, fishBox, el('div', { class: 'shine' }))),
    el('div', { class: 'tank-rim' }),
  ];
}

// ---------- ズーム ----------
/** その わくが 画面いっぱいに なる 変形 */
function zoomTransform(b) {
  const st = $('#room-stage');
  const L = parseFloat(st.style.left) || 0, T = parseFloat(st.style.top) || 0;
  const cx = b.offsetLeft + b.offsetWidth / 2, cy = b.offsetTop + b.offsetHeight / 2;
  const s = Math.min(innerWidth / b.offsetWidth, innerHeight / b.offsetHeight) * 1.05;
  return `translate(${innerWidth / 2 - L - s * cx}px, ${innerHeight / 2 - T - s * cy}px) scale(${s})`;
}
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function zoomIn(b, then) {
  const st = $('#room-stage');
  zoomed = Number(b.dataset.slot);
  if (reduced()) { then(); return; }
  document.body.classList.add('zooming');
  st.style.transition = 'transform 350ms cubic-bezier(.4,0,.2,1)';
  st.style.transform = zoomTransform(b);
  setTimeout(() => {
    then();
    st.style.transition = 'none'; st.style.transform = '';
    document.body.classList.remove('zooming');
  }, 360);
}

function zoomOut(k) {
  const b = $(`.room-slot[data-slot="${k}"]`);
  const st = $('#room-stage');
  if (!b || reduced()) return;
  st.style.transition = 'none';
  st.style.transform = zoomTransform(b);
  void st.offsetWidth;
  requestAnimationFrame(() => {
    st.style.transition = 'transform 300ms cubic-bezier(.4,0,.2,1)';
    st.style.transform = '';
  });
}
