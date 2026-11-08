// ぼうけん の 画面（v0.6 ぼうけん係）。しくみは js/adventure.js。
// - へやの 左下に「ぼうけん」ボタン（はじめから 見える。ひらく まえは かぎ＋「ハートを 300 あつめよう」＋ いま なんこ）。
// - ひらいたら おいわい（いけの すいそう・ガサガサの あみ の プレゼント）。
// - ぼうけん画面：行き先の カード（balance.js ADVENTURE.places）→ うみ（つり）・いけ（ガサガサ）。
// - 画面の 部品は ここで つくる（index.html には css の link だけ）。
import { $, el, toast, bumpCoins, stars } from './common.js';
import * as A from '../adventure.js';

let G = null;
let view = 'menu';          // 'menu' | 'sea' | 'pond'
let busy = false;           // えんしゅつ中
let timers = [];
let lastBtnKey = '';
let celShowing = false;

const KIND_IC = { fish: '🐟', shrimp: '🦐', snail: '🐚' };
const RARE_WORD = { 1: '', 2: '', 3: 'めずらしい！', 4: 'レア！', 5: 'でんせつ！' };
const later = (ms, fn) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
const clearTimers = () => { for (const id of timers) clearTimeout(id); timers = []; };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const icon = (id) => G.data.itemById[id]?.icon || '';
const spOf = (id) => G.data.fishById[id] || {};
const save = () => { G.markDirty(); G.saveNow(); };

export function init(g) {
  G = g;
  A.norm(G.state);
  buildScreen();
  buildRoomButton();
  buildCelebrate();
  G.addScreen('adventure', { show, hide });
  G.adventure = { open: (place) => G.go('adventure', { place }), A };
  // もどる：うみ・いけ に いるときは 行き先の カードへ（へやへは もう 1かい）
  document.addEventListener('click', (e) => {
    if (G.screen !== 'adventure' || !e.target.closest?.('#btn-back')) return;
    if (busy) { e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (view !== 'menu') { e.stopImmediatePropagation(); e.preventDefault(); closePanels(); view = 'menu'; render(); }
  }, true);
  G.on('tick', onTick);
  G.on('screen', () => renderRoomButton());
  G.on('changed', () => { renderRoomButton(true); if (G.screen === 'adventure' && !busy) render(); });
  G.on('tutorialDone', () => renderRoomButton(true));
  window.addEventListener('resize', () => renderRoomButton(true));
  renderRoomButton(true);
  // よみこんだ ときに もう 300 いじょう（古い セーブ）・おいわいを 見のがした とき
  setTimeout(() => { checkOpenNow(); maybeCelebrate(); }, 1600);
}

// ---------------- ひらく ----------------
function checkOpenNow() {
  const ev = A.checkOpen(G.state, []);
  if (!ev.length) return false;
  save();
  G.handleEvents(ev);
  G.emit('changed');
  renderRoomButton(true);
  if (ev.some((x) => x.type === 'unlock' && x.key === 'adventure')) setTimeout(maybeCelebrate, 500);
  return true;
}
let tickN = 0;
function onTick() {
  if (!G.state.tutorial.done) return;
  checkOpenNow();
  if (G.state.notices?.adventure) maybeCelebrate();
  if (G.screen === 'room' && (++tickN % 3 === 0)) renderRoomButton();
  if (G.screen === 'adventure' && view === 'pond' && !busy && (tickN % 5 === 0)) renderPondState();
}

// ---------------- へやの ボタン ----------------
function buildRoomButton() {
  const b = el('button', { id: 'btn-adventure', class: 'adv-room-btn locked', 'aria-label': 'ぼうけん' },
    el('span', { class: 'arb-ic' }, el('img', { src: 'assets/items/adventure.png', alt: '', draggable: 'false', onerror: (e) => { e.target.replaceWith(el('span', { class: 'arb-emoji', text: '🧭' })); } }), el('span', { class: 'arb-lock', text: '🔒' })),
    el('span', { class: 'arb-body' },
      el('span', { class: 'arb-name', text: 'ぼうけん' }),
      el('span', { class: 'arb-sub' }),
      el('span', { class: 'arb-bar' }, el('i'))),
    el('span', { class: 'arb-badge', hidden: true }));
  b.addEventListener('click', onRoomButton);
  $('#scr-room').append(b);
}

function renderRoomButton(force) {
  const b = $('#btn-adventure');
  if (!b) return;
  const s = G.state;
  const open = A.isOpen(s);
  const p = A.progress(s);
  const badge = A.badge(s);
  const key = [open, p.now, badge, s.tutorial.done].join('|');
  if (!force && key === lastBtnKey) return;
  lastBtnKey = key;
  b.classList.toggle('locked', !open);
  b.classList.toggle('open', open);
  b.classList.toggle('tut', !s.tutorial.done);
  b.querySelector('.arb-lock').hidden = open;
  const sub = b.querySelector('.arb-sub');
  const bar = b.querySelector('.arb-bar');
  if (open) {
    sub.textContent = 'うみ と いけ';
    bar.hidden = true;
  } else {
    sub.replaceChildren(el('span', { class: 'heart-ic sm', 'aria-hidden': 'true' }), `ハートを ${p.need} あつめよう`);
    bar.hidden = false;
    bar.querySelector('i').style.width = Math.round((p.now / p.need) * 100) + '%';
    bar.dataset.n = `あつめた ハート ${p.now}／${p.need}`;
  }
  const bd = b.querySelector('.arb-badge');
  bd.hidden = !badge;
  bd.textContent = badge === 'gasa' ? 'ガサガサ OK' : badge === 'catch' ? 'まってるよ' : badge === 'new' ? 'NEW' : '';
  b.setAttribute('aria-label', open ? 'ぼうけん' : `ぼうけん（ハート ${p.now}／${p.need}）`);
}

function onRoomButton() {
  const s = G.state;
  if (!A.isOpen(s)) {
    const p = A.progress(s);
    toast(`ハートが あと ${p.left}こ で ひらくよ。さかなを なでて あつめよう（つかっても へらないよ）`);
    const b = $('#btn-adventure');
    b.classList.remove('wiggle'); void b.offsetWidth; b.classList.add('wiggle');
    return;
  }
  G.go('adventure');
}

// ---------------- おいわい ----------------
function buildCelebrate() {
  $('#app').append(el('div', { id: 'adv-cel', hidden: true },
    el('div', { class: 'confetti' }),
    el('div', { class: 'cel-box' },
      el('div', { class: 'ac-pics' }),
      el('div', { class: 'cel-text' }),
      el('div', { class: 'cel-sub' }),
      el('div', { class: 'cel-btns' }, el('button', { class: 'btn soft ac-ok', text: 'つぎへ' }), el('button', { class: 'btn primary ac-go', text: '🧭 ぼうけんへ', hidden: true })))));
}

function maybeCelebrate() {
  const s = G.state;
  if (!s.notices?.adventure || celShowing || !s.tutorial.done) return;
  if (G.celebrating?.() || !$('#celebrate')?.hidden || !$('#dialog')?.hidden) { setTimeout(maybeCelebrate, 1500); return; }
  celShowing = true;
  const box = $('#adv-cel');
  const pondT = s.tanks.concat(s.storage || []).find((t) => t.water === 'pond');
  const stored = pondT && (s.storage || []).includes(pondT);
  const pic = (src, alt) => el('img', { src, alt: '', onerror: (e) => { e.target.replaceWith(el('span', { class: 'ac-emoji', text: alt })); } });
  const pages = [
    { pics: [pic('assets/items/adventure.png', '🧭')], text: 'ぼうけんに いけるように なったよ！', sub: `ハートが ${A.progress(s).need}こ たまったね。すごい！` },
    { pics: [pic(icon('tank_pond'), '🫙'), pic(icon('gasa_net'), '🥅')], text: 'プレゼント！ いけの すいそう と ガサガサの あみ', sub: stored ? 'へやが いっぱい なので、いけの すいそうは そうこに いれたよ。' : 'いけの すいそうは へやに おいたよ。' },
    { pics: [pic('assets/adventure/bg_sea.jpg', '🌊'), pic('assets/adventure/bg_pond.jpg', '🌿')], text: 'へやの ひだりしたの「ぼうけん」から うみと いけに いけるよ！', sub: 'うみでは つり、いけでは ガサガサが できるよ。' },
  ];
  let page = 0;
  const showPage = () => {
    const pg = pages[page];
    box.querySelector('.ac-pics').replaceChildren(...pg.pics);
    box.querySelector('.ac-pics').classList.toggle('wide', page === 2);
    box.querySelector('.cel-text').textContent = pg.text;
    box.querySelector('.cel-sub').textContent = pg.sub;
    const last = page >= pages.length - 1;
    box.querySelector('.ac-ok').textContent = last ? 'やったー！' : 'つぎへ';
    box.querySelector('.ac-go').hidden = !last;
    confetti(box.querySelector('.confetti'), page);
  };
  const close = (go) => {
    box.hidden = true;
    celShowing = false;
    delete s.notices.adventure;
    save();
    G.emit('changed');
    if (go) G.go('adventure');
  };
  box.querySelector('.ac-ok').onclick = () => { if (page < pages.length - 1) { page++; showPage(); } else close(false); };
  box.querySelector('.ac-go').onclick = () => close(true);
  showPage();
  box.hidden = false;
}

function confetti(cf, seed = 0) {
  cf.replaceChildren();
  const colors = ['#b8e4f5', '#a8dcc3', '#ffe08a', '#f5b7a9'];
  for (let i = 0; i < 24; i++) {
    const p = el('i');
    p.style.left = ((i * 37 + seed * 11) % 100) + '%';
    p.style.background = colors[i % 4];
    p.style.animationDelay = ((i * 0.07) % 0.6) + 's';
    p.style.setProperty('--rx', ((i * 53) % 360) + 'deg');
    cf.append(p);
  }
}

// ---------------- ぼうけん画面 ----------------
function buildScreen() {
  const sec = el('section', { id: 'scr-adventure', class: 'screen sheet', 'data-screen': 'adventure', hidden: true },
    el('div', { class: 'adv-bg' }, el('img', { alt: '', draggable: 'false' })),
    el('div', { class: 'adv-main' }),
    el('div', { class: 'adv-guide', hidden: true }, el('div', { class: 'ag-face', text: '🐟' }), el('div', { class: 'ag-text' }), el('button', { class: 'pill ag-ok', text: 'OK' })),
    el('div', { class: 'adv-panel', hidden: true }));
  $('#scr-help')?.before(sec) || $('#app').append(sec);
  if (!sec.isConnected) $('#app').append(sec);
}

function show(g, opts = {}) {
  G = g;
  $('#toasts').replaceChildren();
  A.norm(G.state);
  if (!A.isOpen(G.state)) { view = 'menu'; }
  else {
    if (!G.state.adventure.seen) { G.state.adventure.seen = true; save(); }
    view = opts.place === 'sea' || opts.place === 'pond' ? opts.place : 'menu';
  }
  busy = false;
  render();
  // まえに 手に入れて まだ 入れていない 子
  if (G.state.adventure.catch) later(250, () => showResult(null));
}
function hide() {
  clearTimers();
  busy = false;
  closePanels();
  renderRoomButton(true);
}

function closePanels() {
  $('#scr-adventure .adv-panel').hidden = true;
  $('#scr-adventure .adv-guide').hidden = true;
}

function setBg(src, cls) {
  const sec = $('#scr-adventure');
  sec.className = 'screen sheet adv-' + cls;
  const img = sec.querySelector('.adv-bg img');
  if (src) { if (!img.src.endsWith(src)) img.src = src; img.hidden = false; } else img.hidden = true;
}

function render() {
  const main = $('#scr-adventure .adv-main');
  if (!A.isOpen(G.state)) { setBg(null, 'menu'); main.replaceChildren(el('div', { class: 'adv-locked' }, '🔒 ', `ハートを ${A.progress(G.state).need} あつめると ひらくよ`)); return; }
  if (view === 'sea') return renderSea(main);
  if (view === 'pond') return renderPond(main);
  renderMenu(main);
}

// ---------- 行き先の カード ----------
function renderMenu(main) {
  setBg(null, 'menu');
  const s = G.state;
  const cards = A.places().map((pl) => {
    let chip = '';
    if (pl.mode === 'fishing') chip = !s.inv[A.rules().fishing.rod] ? '🎁 つりざお プレゼント' : `えさ ${A.bait(s)}こ`;
    else if (pl.mode === 'gasagasa') chip = A.canGasa(s).ok ? 'きょう できるよ！' : A.gasaLeft(s) < 1 ? 'また あした' : '';
    const hot = (pl.mode === 'gasagasa' && A.canGasa(s).ok) || (pl.mode === 'fishing' && !s.inv[A.rules().fishing.rod]);
    return el('button', { class: 'adv-card' + (hot ? ' hot' : ''), 'data-place': pl.id, onclick: () => go(pl.id) },
      el('img', { class: 'ac-bg', src: pl.bg, alt: '', draggable: 'false' }),
      el('span', { class: 'ac-label' }, el('span', { class: 'ac-name', text: pl.name }), el('span', { class: 'ac-line', text: pl.line || '' })),
      chip ? el('span', { class: 'ac-chip', text: chip }) : null);
  });
  main.replaceChildren(el('div', { class: 'adv-menu' }, el('h2', { class: 'adv-h', text: 'どこへ いく？' }), el('div', { class: 'adv-cards' }, ...cards)));
}

function go(place) {
  if (busy) return;
  view = place;
  render();
}

// ---------- うみ（つり） ----------
function renderSea(main) {
  const s = G.state;
  setBg(A.places().find((p) => p.mode === 'fishing')?.bg || 'assets/adventure/bg_sea.jpg', 'sea');
  const F = A.rules().fishing;
  const hasRod = !!s.inv[F.rod];
  main.replaceChildren(
    el('div', { class: 'adv-top' },
      el('div', { class: 'adv-title' }, el('span', { class: 'at-name', text: '🌊 うみ' }), el('span', { class: 'at-sub', text: 'つりを しよう' })),
      el('button', { class: 'adv-bait', onclick: openBaitShop },
        el('img', { src: icon(F.bait), alt: '' }),
        el('span', { class: 'ab-n' }, 'えさ ', el('b', { text: String(A.bait(s)) }), 'こ'),
        el('span', { class: 'ab-buy', text: 'かう' }))),
    el('div', { class: 'fish-stage' },
      el('img', { class: 'fs-rod', src: 'assets/adventure/rod_scene.png', alt: '', hidden: !hasRod, onerror: (e) => { e.target.src = icon(F.rod); } }),   // うきの ない さお（うきが 2つ 見えない ように）
      svgLine(),
      el('div', { class: 'fs-bobber', hidden: true }, el('i')),
      el('div', { class: 'fs-ripple' }),
      el('div', { class: 'fs-mark', hidden: true }, el('b', { text: '！' }), el('span', { text: 'タップ！' })),
      el('div', { class: 'fs-shadow', hidden: true })),
    el('div', { class: 'adv-actions' },
      el('button', { class: 'btn primary adv-go fish-go', onclick: onFish }, '🎣 つる', el('small', { text: 'えさ 1こ' }))),
  );
  updateFishButton();
  // はじめて：つりざお → えさ
  if (!hasRod || s.adventure.seaIntro < 2) later(300, seaIntro);
}

function svgLine() {
  // HTML として よむと svg の なまえ空間が つく（URL を 書かない）
  const box = el('div', { html: '<svg class="fs-line" aria-hidden="true"><path></path></svg>' });
  return box.firstChild;
}

function updateFishButton() {
  const b = $('#scr-adventure .fish-go');
  if (!b) return;
  const c = A.canFish(G.state);
  b.classList.toggle('cant', !c.ok);
  const n = $('#scr-adventure .adv-bait b');
  if (n) n.textContent = String(A.bait(G.state));
}

async function seaIntro() {
  const s = G.state;
  if (view !== 'sea') return;
  const r = A.enterSea(s);
  if (r.gotRod) {
    save();
    $('#scr-adventure .fs-rod').hidden = false;
    await guide('つりざおを プレゼント！ これで うみの いきものが つれるよ。', icon(A.rules().fishing.rod));
  }
  if (!s.adventure.baitGift) {
    await guide('でも、えさが ないと つれないよ。えさやさんへ いこう！', icon(A.rules().fishing.bait));
    openBaitShop();
  }
}

/** ふきだし（OK で つぎへ） */
function guide(text, pic) {
  const g = $('#scr-adventure .adv-guide');
  g.querySelector('.ag-text').replaceChildren(pic ? el('img', { class: 'ag-pic', src: pic, alt: '' }) : '', el('span', { text }));
  g.hidden = false;
  return new Promise((res) => {
    const done = () => { g.hidden = true; res(); };
    g.querySelector('.ag-ok').onclick = (e) => { e.stopPropagation(); done(); };
    g.onclick = done;
  });
}

// えさやさん
function openBaitShop() {
  if (busy) return;
  const s = G.state;
  const F = A.rules().fishing;
  const panel = $('#scr-adventure .adv-panel');
  const close = () => { panel.hidden = true; updateFishButton(); };
  const body = el('div', { class: 'ap-box bait-shop' },
    el('button', { class: 'ap-close', 'aria-label': 'とじる', text: '✕', onclick: close }),
    el('div', { class: 'ap-head' }, el('img', { src: icon(F.bait), alt: '' }), el('div', {},
      el('div', { class: 'ap-title', text: 'えさやさん' }),
      el('div', { class: 'ap-have' }, 'もっている えさ ', el('b', { text: String(A.bait(s)) }), `こ（${F.baitMax}こ まで）`))));
  if (!s.adventure.baitGift) {
    body.append(el('div', { class: 'ap-gift' },
      el('div', { class: 'ap-gift-t', text: `🎁 はじめての えさ ${F.firstBait}こ プレゼント！` }),
      el('button', { class: 'btn primary ap-take', text: 'うけとる', onclick: () => {
        A.claimFirstBait(s);
        save();
        toast(`えさを ${F.firstBait}こ もらったよ！`, 'gold');
        close();
        render();
        later(200, () => guide('これで つれるよ！「つる」を おしてみよう。'));
      } })));
  } else {
    body.append(el('div', { class: 'ap-price' }, 'えさ 1こ ', el('span', { class: 'coin-ic sm', 'aria-hidden': 'true' }), `${F.baitPrice}`));
    const row = el('div', { class: 'ap-packs' });
    for (const n of F.buyPacks || [1]) {
      const c = A.canBuyBait(s, n);
      row.append(el('button', { class: 'btn primary ap-pack' + (c.ok ? '' : ' cant'), onclick: () => buyBait(n) },
        `${n}こ かう`, el('small', {}, el('span', { class: 'coin-ic sm', 'aria-hidden': 'true' }), String(c.price)),
        !c.ok && c.reason === 'coins' ? el('em', { text: `あと ${c.need}` }) : !c.ok && c.reason === 'max' ? el('em', { text: 'もちきれないよ' }) : null));
    }
    body.append(row, el('div', { class: 'ap-note', text: '1かい つるのに えさを 1こ つかうよ。' }));
  }
  panel.replaceChildren(body);
  panel.hidden = false;
  panel.onclick = (e) => { if (e.target === panel) close(); };
}

function buyBait(n) {
  const r = A.buyBait(G.state, n);
  if (!r.ok) {
    toast(r.reason === 'coins' ? `コインが あと ${r.need} たりないよ` : r.reason === 'max' ? 'もう もちきれないよ' : 'いまは かえないよ');
    return;
  }
  bumpCoins();
  G.refreshHud();
  save();
  G.handleEvents(r.events);
  toast(`えさを ${n}こ かったよ！`, 'gold');
  openBaitShop();
  updateFishButton();
}

function onFish() {
  if (busy) return;
  const s = G.state;
  const c = A.canFish(s);
  if (!c.ok) {
    if (c.reason === 'noBait') { toast('えさが ないよ。えさやさんで かおう'); openBaitShop(); }
    else if (c.reason === 'noRod') seaIntro();
    else if (c.reason === 'pending') showResult(null);
    else toast('いまは つれないよ');
    return;
  }
  const r = A.fish(s);
  if (!r.ok) { toast('いまは つれないよ'); return; }
  save();
  G.handleEvents(r.events);
  updateFishButton();
  playFishing(r);
}

/** つりの えんしゅつ：なげる → うきが ゆれる → しずむ（！）→ ひく → つれた！ */
function playFishing(r) {
  busy = true;
  document.body.classList.add('adv-busy');
  const T = A.rules().fishingAnim;
  const stage = $('#scr-adventure .fish-stage');
  const btn = $('#scr-adventure .fish-go');
  const bob = stage.querySelector('.fs-bobber');
  const mark = stage.querySelector('.fs-mark');
  const shadow = stage.querySelector('.fs-shadow');
  const rare = r.rarity >= 4;
  const fast = reduced();
  const wait = fast ? 300 : T.wait[0] + Math.random() * (T.wait[1] - T.wait[0]);
  stage.className = 'fish-stage cast';
  bob.hidden = false;
  shadow.hidden = true;
  shadow.className = 'fs-shadow r' + r.rarity;
  drawLine();
  btn.classList.add('wait');
  btn.replaceChildren('…まってね');
  let reeled = false;
  const reel = () => {
    if (reeled) return;
    reeled = true;
    stage.className = 'fish-stage reel' + (rare ? ' rare' : '');
    mark.hidden = true;
    btn.classList.remove('pull');
    btn.replaceChildren('えいっ！');
    later(fast ? 200 : T.reel, () => { drawLine(); finishCatch(r); });
    drawLineLoop(T.reel);
  };
  later(fast ? 150 : T.cast, () => {
    stage.className = 'fish-stage wait';
    drawLine();
    // レアは かげが ちかづいて くる
    if (rare) { shadow.hidden = false; }
    later(wait, () => {
      stage.className = 'fish-stage bite' + (rare ? ' rare' : '');
      mark.hidden = false;
      btn.classList.remove('wait');
      btn.classList.add('pull');
      btn.replaceChildren('ひいてる！ タップ！');
      btn.onclick = reel;
      stage.onclick = reel;
      drawLineLoop(T.bite);
      later(fast ? 400 : T.bite + (rare ? T.rareExtra : 0), reel);   // おさなくても つれる
    });
  });
  drawLineLoop(T.cast + 50);
}

let lineRaf = 0;
function drawLineLoop(ms) {
  cancelAnimationFrame(lineRaf);
  const until = performance.now() + ms;
  const step = () => { drawLine(); if (performance.now() < until) lineRaf = requestAnimationFrame(step); };
  lineRaf = requestAnimationFrame(step);
}
/** さおの 先から うきまで 糸を ひく */
function drawLine() {
  const stage = $('#scr-adventure .fish-stage');
  if (!stage) return;
  const rod = stage.querySelector('.fs-rod'), bob = stage.querySelector('.fs-bobber'), path = stage.querySelector('.fs-line path');
  if (!rod || !bob || !path) return;
  const sr = stage.getBoundingClientRect(), rr = rod.getBoundingClientRect(), br = bob.getBoundingClientRect();
  const x1 = rr.right - sr.left - rr.width * 0.06, y1 = rr.top - sr.top + rr.height * 0.08;
  const x2 = br.left - sr.left + br.width / 2, y2 = br.top - sr.top + br.height * 0.2;
  const sag = stage.classList.contains('bite') || stage.classList.contains('reel') ? 6 : 34;
  path.setAttribute('d', bob.hidden ? '' : `M${x1},${y1} Q${(x1 + x2) / 2},${Math.max(y1, y2) + sag} ${x2},${y2}`);
}

// ---------- いけ（ガサガサ） ----------
function renderPond(main) {
  setBg(A.places().find((p) => p.mode === 'gasagasa')?.bg || 'assets/adventure/bg_pond.jpg', 'pond');
  const Gs = A.rules().gasagasa;
  main.replaceChildren(
    el('div', { class: 'adv-top' },
      el('div', { class: 'adv-title' }, el('span', { class: 'at-name', text: '🌿 いけ' }), el('span', { class: 'at-sub', text: 'あみで ガサガサ しよう' })),
      el('div', { class: 'adv-gasa-left' })),
    el('div', { class: 'gasa-stage' },
      el('div', { class: 'gs-splash' }),
      el('img', { class: 'gs-net', src: icon(Gs.net), alt: '' }),
      el('div', { class: 'gs-word', hidden: true })),
    el('div', { class: 'adv-actions' }, el('button', { class: 'btn primary adv-go gasa-go', onclick: onGasa }, '🥅 ガサガサ する')),
  );
  renderPondState();
}

function renderPondState() {
  const s = G.state;
  const left = A.gasaLeft(s);
  const per = A.rules().gasagasa.perDay ?? 1;
  const box = $('#scr-adventure .adv-gasa-left');
  if (box) box.replaceChildren('きょうの ガサガサ ', el('b', { text: `${left}／${per}` }));
  const b = $('#scr-adventure .gasa-go');
  if (!b || busy) return;
  const c = A.canGasa(s);
  b.classList.toggle('cant', !c.ok);
  if (!c.ok && c.reason === 'done') {
    const h = Math.ceil(A.minutesToNextDay(s) / 60);
    b.replaceChildren('きょうは おしまい', el('small', { text: `あさ 6じに また できるよ（あと ${h}じかん）` }));
  } else b.replaceChildren('🥅 ガサガサ する', el('small', { text: 'きょう 1かい' }));
}

function onGasa() {
  if (busy) return;
  const s = G.state;
  const c = A.canGasa(s);
  if (!c.ok) {
    if (c.reason === 'done') toast('ガサガサは 1にち 1かい。あさに なったら また できるよ');
    else if (c.reason === 'pending') showResult(null);
    else if (c.reason === 'noNet') toast('あみが ないよ');
    else toast('いまは できないよ');
    return;
  }
  const r = A.gasagasa(s);
  if (!r.ok) { toast('いまは できないよ'); return; }
  save();
  G.handleEvents(r.events);
  playGasa(r);
}

/** ガサガサの えんしゅつ：あみを みずくさに いれて ガサ・ガサ・ガサ → もちあげる → つかまえた！ */
function playGasa(r) {
  busy = true;
  document.body.classList.add('adv-busy');
  const T = A.rules().gasaAnim;
  const fast = reduced();
  const stage = $('#scr-adventure .gasa-stage');
  const word = stage.querySelector('.gs-word');
  const btn = $('#scr-adventure .gasa-go');
  btn.classList.add('wait');
  btn.replaceChildren('ガサガサ…');
  stage.className = 'gasa-stage sweep' + (r.rarity >= 4 ? ' rare' : '');
  const sweep = fast ? 400 : T.sweep;
  const words = ['ガサ', 'ガサ', 'ガサッ！'];
  words.forEach((w, i) => later((sweep / 3) * i + 150, () => {
    word.hidden = false;
    word.textContent = w;
    word.style.left = 30 + i * 18 + '%';
    word.classList.remove('pop'); void word.offsetWidth; word.classList.add('pop');
    splash(stage, 30 + i * 18);
  }));
  later(sweep, () => {
    word.hidden = true;
    stage.className = 'gasa-stage lift' + (r.rarity >= 4 ? ' rare' : '');
    later(fast ? 200 : T.lift + (r.rarity >= 4 ? T.rareExtra * 0.5 : 0), () => finishCatch(r));
  });
}

function splash(stage, xPct) {
  const sp = stage.querySelector('.gs-splash');
  for (let i = 0; i < 6; i++) {
    const d = el('i');
    d.style.left = xPct + (i - 2.5) * 2.2 + '%';
    d.style.setProperty('--dx', (i - 2.5) * 14 + 'px');
    d.style.animationDelay = i * 30 + 'ms';
    sp.append(d);
    setTimeout(() => d.remove(), 900);
  }
}

// ---------- つかまえた！ ----------
function finishCatch(r) {
  busy = false;
  document.body.classList.remove('adv-busy');
  const stage = $('#scr-adventure .fish-stage, #scr-adventure .gasa-stage');
  if (stage) { stage.onclick = null; stage.className = stage.classList.contains('fish-stage') ? 'fish-stage' : 'gasa-stage'; }
  const fb = $('#scr-adventure .fish-go');
  if (fb) { fb.onclick = onFish; fb.classList.remove('wait', 'pull'); fb.replaceChildren('🎣 つる', el('small', { text: 'えさ 1こ' })); updateFishButton(); }
  const bob = $('#scr-adventure .fs-bobber');
  if (bob) bob.hidden = true;
  drawLine();
  const gb = $('#scr-adventure .gasa-go');
  if (gb) { gb.classList.remove('wait'); renderPondState(); }
  showResult(r);
}

/** けっか：絵・なまえ・レア度 → どこに いれる？ */
function showResult(r) {
  const s = G.state;
  const c = s.adventure.catch;
  if (!c) return;
  const f = c.fish;
  const sp = spOf(f.speciesId);
  const rar = sp.rarity || 1;
  const first = r ? r.first : c.first;
  const panel = $('#scr-adventure .adv-panel');
  const targets = A.catchTargets(s);
  const ok = targets.filter((x) => x.ok);
  const waterName = G.sim.waterName ? G.sim.waterName(sp.water) : '';
  const verb = c.mode === 'gasagasa' ? 'つかまえた！' : 'つれた！';
  const btns = el('div', { class: 'ar-btns' });
  for (const x of ok) btns.append(el('button', { class: 'btn primary ar-tank', onclick: () => place(x.tank.id) }, `${G.sim.tankName(s, x.tank)}へ`));
  btns.append(el('button', { class: 'btn ' + (ok.length ? 'soft' : 'primary') + ' ar-box', onclick: () => place('box') }, '💤 おやすみすいそうへ'));
  let why = '';
  let whySub = '';
  if (!targets.length) { why = 'いまは おやすみすいそうで まっていてね'; whySub = `${waterName}の すいそうは おみせで かえるよ`; }
  else if (!ok.length) { why = 'いまは おやすみすいそうで まっていてね'; whySub = `${waterName}の すいそうが いっぱい だよ`; }
  const shiny = !!f.shiny;
  const box = el('div', { class: 'ap-box ar-box-wrap r' + rar + (shiny ? ' shiny' : '') },
    el('div', { class: 'ar-rays' }),
    el('div', { class: 'ar-verb', text: verb }),
    el('div', { class: 'ar-pic' }, el('img', { src: sp.texture, alt: '', onerror: (e) => { e.target.replaceWith(el('span', { class: 'ar-emoji', text: KIND_IC[sp.kind] || '🐟' })); } })),
    el('div', { class: 'ar-name' }, sp.name || ''),
    el('div', { class: 'ar-tags' }, el('span', { class: 'stars', text: stars(rar) }), RARE_WORD[rar] ? el('span', { class: 'ar-rare', text: RARE_WORD[rar] }) : null, shiny ? el('span', { class: 'ar-shiny', text: '✨ キラキラ！' }) : null),
    first ? el('div', { class: 'ar-first', text: '📖 はじめて！ ずかんに のったよ' }) : null,
    el('div', { class: 'ar-ask' + (why ? ' strong' : ''), text: why || 'どの すいそうに いれる？' }),
    btns,
    whySub ? el('div', { class: 'ar-sub', text: whySub }) : null);
  panel.replaceChildren(box);
  panel.onclick = null;
  panel.hidden = false;
  if (rar >= 4 || shiny) sparkle(box);
}

function place(to) {
  const s = G.state;
  const c = s.adventure.catch;
  if (!c) return;
  const sp = spOf(c.fish.speciesId);
  const r = A.placeCatch(s, to);
  if (!r.ok) return;
  save();
  G.handleEvents(r.events);
  G.emit('changed');
  $('#scr-adventure .adv-panel').hidden = true;
  if (r.where === 'tank') {
    toast(`${sp.name}が ${G.sim.tankName(s, r.tank)}に きたよ！`, 'gold');
    G.queueReact?.(r.fish.uid, 'happy', 400);
  } else toast(`${sp.name}は おやすみすいそうで まっているよ`, 'gold');
  G.emit('action', { type: c.mode === 'gasagasa' ? 'gasagasa' : 'fishing', id: c.fish.speciesId, where: r.where });
  updateFishButton();
  renderPondState();
}

function sparkle(box) {
  const wrap = el('div', { class: 'ar-sparks' });
  for (let i = 0; i < 12; i++) {
    const p = el('i', { text: ['✨', '⭐', '💖'][i % 3] });
    const a = (i / 12) * Math.PI * 2;
    p.style.setProperty('--x', Math.cos(a) * 120 + 'px');
    p.style.setProperty('--y', Math.sin(a) * 80 + 'px');
    p.style.animationDelay = (i % 4) * 60 + 'ms';
    wrap.append(p);
  }
  box.append(wrap);
  setTimeout(() => wrap.remove(), 1500);
}
