// へや：部屋の絵の上、台の天板に水槽を重ねる。水槽をタップで すいそう画面へ。
import { $, $$, el } from './common.js';
import { lightOf } from '../state.js';

const IMG_W = 1920, IMG_H = 1080;
// 台の天板（絵に対する割合）。docs/アート.md
const TOP = { x0: 0.37, x1: 0.72, back: 0.54, front: 0.59 };

let G = null;
let lastKey = '';

export function init(g) {
  G = g;
  $('#room-tank').addEventListener('click', () => { G.emit('action', { type: 'openTank' }); G.go('tank'); });
  $$('#room-nav [data-go]').forEach((b) => b.addEventListener('click', () => G.go(b.dataset.go)));
  window.addEventListener('resize', layout);
  G.on('tick', () => { if (G.screen === 'room') { renderNight(); renderTank(); } });
  G.on('changed', () => { if (G.screen === 'room') renderTank(true); });
  layout();
}

export function show() {
  layout();
  renderNight();
  renderTank(true);
}

/** 部屋の絵を画面に合わせる。少しの切り取りなら cover、大きく切れるなら contain にして余白を壁と床の色で埋める。 */
function layout() {
  const W = innerWidth, H = innerHeight;
  const cover = Math.max(W / IMG_W, H / IMG_H), contain = Math.min(W / IMG_W, H / IMG_H);
  const sCover = { w: IMG_W * cover, h: IMG_H * cover };
  const cropX = (sCover.w - W) / sCover.w, cropY = (sCover.h - H) / sCover.h;
  const s = cropX > 0.1 || cropY > 0.12 ? contain : cover;
  const w = IMG_W * s, h = IMG_H * s;
  const left = (W - w) / 2;
  // 縦に余るときは、上の帯の下に絵を寄せすぎないよう、少し下に置く
  const top = h < H ? Math.min(H - h, Math.max(0, (H - h) * 0.55)) : (H - h) / 2;
  const st = $('#room-stage');
  Object.assign(st.style, { left: left + 'px', top: top + 'px', width: w + 'px', height: h + 'px' });
  st.classList.toggle('lb-y', s === contain && h < H - 2);
  st.classList.toggle('lb-x', s === contain && w < W - 2);
  // 余白の色：床の線（絵の y≈0.77）から下を床色に
  $('#scr-room').style.setProperty('--floor-y', (top + h * 0.775) + 'px');
  // 水槽の位置：天板の左右の内側、底は奥と手前の間
  const tank = $('#room-tank');
  const tx0 = TOP.x0 + 0.012, tx1 = TOP.x1 - 0.012;
  const bottom = (TOP.back + TOP.front) / 2 + 0.006;
  const tw = (tx1 - tx0);
  const th = tw * w * 0.52 / h;   // 横:縦 ≒ 1 : 0.52
  Object.assign(tank.style, { left: tx0 * 100 + '%', width: tw * 100 + '%', top: (bottom - th) * 100 + '%', height: th * 100 + '%', bottom: 'auto' });
  const tip = $('#room-tank-tip');
  tip.style.left = ((tx0 + tx1) / 2) * 100 + '%';
  tip.style.top = (bottom - th - 0.03) * 100 + '%';
}

function renderNight() {
  const l = lightOf(G.state.clock.min);
  const n = $('#room-night');
  if (!n.dataset.ready) { n.style.transition = 'none'; n.dataset.ready = '1'; requestAnimationFrame(() => requestAnimationFrame(() => { n.style.transition = ''; })); }
  n.style.opacity = String(Math.max(0, (1 - l) * 0.85));
}

/** 部屋の水槽の中（2D のかんたんな絵）。中身が変わったときだけ作り直す。 */
function renderTank(force) {
  const t = G.tank();
  const key = t.fish.map((f) => f.uid + f.stage).join(',') + '|' + t.decor.join(',');
  $('#room-tank').classList.toggle('dirty', t.clean < 40);
  const tip = $('#room-tank-tip');
  tip.textContent = t.fish.length ? 'タップ してね' : 'からっぽの すいそう';
  // チュートリアル中は 案内を 1つに しぼる（ふきだし だけ）
  tip.hidden = !G.state.tutorial.done || (t.fish.length > 0 && (G.state.stats.openTank || 0) > 3);
  if (!force && key === lastKey) return;
  lastKey = key;
  const decorBox = $('#room-tank-decor');
  decorBox.replaceChildren();
  const pics = { stone: 'assets/room/stone1.png', plant: 'assets/room/plant1.png', driftwood: 'assets/room/driftwood.png' };
  const plants = ['assets/room/plant1.png', 'assets/room/plant2.png', 'assets/room/plant3.png'];
  let pi = 0, si = 0;
  t.decor.forEach((id, i) => {
    let src = pics[id];
    if (id === 'plant') src = plants[pi++ % 3];
    if (id === 'stone') src = ['assets/room/stone1.png', 'assets/room/stone3.png'][si++ % 2];
    if (id === 'air_pump') { decorBox.append(el('div', { class: 'rt-bubbles' }, el('i'), el('i'), el('i'), el('i'))); return; }
    if (id === 'heater') { decorBox.append(el('div', { class: 'rt-heater' })); return; }
    if (id === 'filter') { decorBox.append(el('div', { class: 'rt-filter' })); return; }
    if (id === 'light') { decorBox.append(el('div', { class: 'rt-light' })); return; }
    if (!src) return;
    const img = el('img', { src, alt: '' });
    const pos = { stone: [12, 58], plant: [4, 78, 30, 62], driftwood: [36] }[id] || [50];
    const x = pos[(id === 'plant' ? pi - 1 : id === 'stone' ? si - 1 : 0) % pos.length];
    img.style.left = x + '%';
    img.style.height = id === 'plant' ? '62%' : id === 'driftwood' ? '28%' : '22%';
    decorBox.append(img);
  });
  const fishBox = $('#room-tank-fish');
  fishBox.replaceChildren();
  const box = $('#room-tank').getBoundingClientRect();
  t.fish.slice(0, 12).forEach((f, i) => {
    const sp = G.data.fishById[f.speciesId];
    if (!sp) return;
    const bottomish = sp.swim?.layer === 'bottom';
    const wPct = (sp.kind === 'shrimp' ? 8 : 11) * [0.7, 1, 1.25][f.stage];
    const d = el('div', { class: 'rf' }, el('img', { src: sp.texture, alt: '' }));
    const yPct = bottomish ? 70 + (i % 2) * 4 : 22 + ((i * 37) % 40);
    const x0 = 6 + ((i * 53) % 50);
    d.style.width = wPct + '%';
    d.style.left = x0 + '%';
    d.style.top = yPct + '%';
    d.style.setProperty('--d', (7 + (i % 4) * 2.3) / (sp.swim?.speed || 1) + 's');
    d.style.setProperty('--dx', Math.max(20, (box.width || 300) * (0.86 - x0 / 100 - wPct / 100)) + 'px');
    d.style.animationDelay = -i * 1.7 + 's';
    d.firstChild.style.animationDelay = -i * 1.7 + 's';
    fishBox.append(d);
  });
}
