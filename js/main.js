// おさかなルーム 本体（画面の切り替え・時計・セーブ）。
import { VERSION } from './version.js';
import { FISH } from './data/fish.js';
import { ITEMS } from './data/items.js';
import { compatOf } from './data/compat.js';
import * as S from './state.js';
import * as sim from './sim.js';
import { $, $$, toast, bumpCoins, dialog, el } from './ui/common.js';
import * as room from './ui/room.js';
import * as tankUi from './ui/tank.js';
import * as shop from './ui/shop.js';
import * as dex from './ui/dex.js';
import * as missions from './ui/missions.js';
import * as photo from './ui/photo.js';
import * as tutorial from './ui/tutorial.js';
import { initAwake, awakeState } from './ui/awake.js';
import { initBgmUi, wirePicker, bgmNow } from './ui/bgm-ui.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

// まだ届いていないかもしれないデータは、無くても動くように読む
async function optional(path) {
  try { return await import(path); } catch (e) { if (DEBUG) console.info('なし', path, e.message); return {}; }
}

async function boot() {
  const [balance, missionData, hintData, tutorialData] = await Promise.all([
    optional('./data/balance.js'), optional('./data/missions.js'), optional('./data/hints.js'), optional('./data/tutorial.js'),
  ]);
  const data = sim.setup({ FISH, ITEMS, compatOf, balance, missions: missionData, hints: hintData, tutorial: tutorialData });

  if (params.has('reset')) {
    S.resetSave();
    // もういちど よみこんでも 消えないように、URL から reset を とる
    params.delete('reset');
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : ''));
  }
  const state = S.load(sim.initialValues());
  sim.normalize(state);

  /** みんなで使う入れもの */
  const G = {
    version: VERSION, debug: DEBUG, data, state, sim, S,
    screen: null, prevScreen: 'room', aq: null,
    listeners: {},
    on(name, fn) { (this.listeners[name] ||= []).push(fn); },
    emit(name, payload) { for (const fn of this.listeners[name] || []) { try { fn(payload); } catch (e) { console.error(e); } } },
    /** いま 見ている 水槽 */
    tank() { return state.tanks.find((t) => t.id === state.ui.tankId) || state.tanks[0]; },
    setTank(id) { if (state.tanks.some((t) => t.id === id)) { state.ui.tankId = id; this.markDirty(); } },
    dirty: false,
    markDirty() { this.dirty = true; },
    saveNow() { this.dirty = false; S.save(state); },
    go, refreshHud,
    /** コインを足して数字を跳ねさせる */
    coins(n, why) { const got = S.addCoins(state, n); if (got) { bumpCoins(); if (why) toast(`+${got} コイン  ${why}`, 'gold'); refreshHud(); this.markDirty(); } return got; },
    /** sim のできごとを画面に出す */
    handleEvents(events) { for (const ev of events || []) this.emit('sim', ev); },
  };
  window.G = G;   // 確認用

  // ---------- 画面の切り替え ----------
  const SHEETS = ['shop', 'dex', 'missions'];
  // v0.5：あとから 足す 画面（js/ui/help.js など）。G.addScreen('help', { show(G, opts), hide(G) }) で とうろく
  const EXTRA = {};
  G.addScreen = (name, mod, { sheet = true } = {}) => { EXTRA[name] = mod; if (sheet && !SHEETS.includes(name)) SHEETS.push(name); };
  function go(name, opts = {}) {
    if (name === G.screen) {
      // おなじ 画面でも タブや 水槽が かわったら かきなおす
      if (name === 'shop') shop.show(G, opts);
      return;
    }
    const from = G.screen;
    if (from && !SHEETS.includes(from)) G.prevScreen = from;
    G.screen = name;
    for (const s of $$('.screen')) s.hidden = s.dataset.screen !== name;
    // すいそうの3Dは すいそう画面のときだけ動かす（シートの後ろでは止める）
    if (name === 'tank') tankUi.show(G); else tankUi.hide(G);
    if (name === 'room') room.show(G, { from });
    if (name === 'shop') shop.show(G, opts);
    if (name === 'dex') dex.show(G);
    if (name === 'missions') missions.show(G);
    if (from && EXTRA[from]) EXTRA[from].hide?.(G);
    if (EXTRA[name]) EXTRA[name].show?.(G, opts);
    $('#btn-back').hidden = name === 'room';
    $('#btn-back .lb').textContent = SHEETS.includes(name) ? 'もどる' : 'へや';
    $('#btn-menu').hidden = name !== 'tank';
    state.ui.lastScreen = SHEETS.includes(name) ? G.prevScreen : name;
    document.body.classList.toggle('on-sheet', SHEETS.includes(name));
    document.body.classList.toggle('on-room', name === 'room');
    G.emit('screen', name);
  }
  G.on('action', (a) => { if (a.type === 'openTank') state.stats.openTank = (state.stats.openTank || 0) + 1; });
  $('#btn-back').addEventListener('click', () => {
    if (SHEETS.includes(G.screen)) go(G.prevScreen || 'room'); else go('room');
  });
  $('#btn-menu').addEventListener('click', async () => {
    const v = await dialog([el('div', { class: 'big', text: 'どこへ いく？' })], [
      { label: '🛒 おみせ', value: 'shop' }, { label: '📖 ずかん', value: 'dex' }, { label: '⭐ ミッション', value: 'missions' },
    ]);
    if (v) go(v);
  });

  // ---------- 上の帯 ----------
  let lastPhase = null;
  function refreshHud() {
    const m = state.clock.min;
    $('#hud-day').textContent = `${sim.gameDay(m)}にちめ`;
    const ph = S.phaseOf(m);
    $('#hud-phase').textContent = S.PHASE_LABEL[ph];
    $('#hud-phase-ic').textContent = { morning: '🌅', noon: '☀️', evening: '🌇', night: '🌙' }[ph];
    $('#hud-coin-n').textContent = state.coins;
    $('#hud-heart-n').textContent = state.hearts > 9999 ? '9999＋' : String(state.hearts || 0);
    $('#hud-heart-day').textContent = `きょう ${Math.min(state.daily.hearts || 0, sim.balance().HEART.perDay ?? 20)}／${sim.balance().HEART.perDay ?? 20}`;
    document.body.classList.toggle('night', ph === 'night');
    if (ph !== lastPhase) { lastPhase = ph; G.emit('phase', ph); }
    const n = missions.claimableCount(G);
    const b = $('#room-nav .badge');
    b.hidden = !n; b.textContent = n;
    $('#btn-menu').classList.toggle('has-badge', n > 0);
  }

  // ---------- 時計 ----------
  let saveAcc = 0;
  const clock = S.createClock((gameMin) => {
    if (tutorial.pausesClock(G) || celebrating) return;   // チュートリアル・大きな お知らせの あいだは とめる
    const events = sim.tick(state, gameMin);
    G.handleEvents(events);
    refreshHud();
    G.emit('tick', gameMin);
    G.markDirty();
    saveAcc += gameMin;
    if (saveAcc >= 10) { saveAcc = 0; G.saveNow(); }   // ゲーム10分（4びょう）ごと
  });
  G.clock = clock;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') G.saveNow(); });
  window.addEventListener('pagehide', () => G.saveNow());

  // ---------- かいほうの おいわい ----------
  // balance.js UNLOCK.tank6.banner を 1まいずつ（タップで つぎへ）。出ている あいだは 時計を とめる。
  let celebrating = false;
  function celebrate() {
    if (!state.notices?.tank6 || celebrating) return;
    if (!state.tutorial.done) return;              // チュートリアルが おわってから
    const box = $('#celebrate');
    const pages = sim.balance().UNLOCK?.tank6?.banner || ['うみの すいそうが かえるように なったよ！'];
    let page = 0;
    celebrating = true;
    const showPage = () => {
      box.querySelector('.cel-ic').textContent = page === 0 ? '🌊' : '🐠';
      box.querySelector('.cel-text').textContent = pages[page];
      const last = page >= pages.length - 1;
      box.querySelector('.cel-sub').textContent = '';
      box.querySelector('.cel-ok').textContent = last ? 'やったー！' : 'つぎへ';
      box.querySelector('.cel-shop').hidden = !last;
      const cf = box.querySelector('.confetti');
      cf.replaceChildren();
      const colors = ['#b8e4f5', '#a8dcc3', '#ffe08a', '#f5b7a9'];
      for (let i = 0; i < 24; i++) {
        const p = el('i');
        p.style.left = ((i * 37 + page * 11) % 100) + '%';
        p.style.background = colors[i % 4];
        p.style.animationDelay = ((i * 0.07) % 0.6) + 's';
        p.style.setProperty('--rx', ((i * 53) % 360) + 'deg');
        cf.append(p);
      }
    };
    const close = (toShop) => {
      box.hidden = true;
      celebrating = false;
      delete state.notices.tank6;
      G.saveNow();
      if (toShop) go('shop', { tab: 'tanks' });      // 水槽の 売り場へ ちょくせつ
      G.emit('changed');
    };
    box.querySelector('.cel-ok').onclick = () => { if (page < pages.length - 1) { page++; showPage(); } else close(false); };
    box.querySelector('.cel-shop').onclick = () => close(true);
    showPage();
    box.hidden = false;
  }
  G.celebrating = () => celebrating;
  G.celebrate = celebrate;
  G.on('sim', (ev) => { if (ev.type === 'unlock') setTimeout(celebrate, 400); });
  $('#hud-hearts').addEventListener('click', () => toast('さかなを なでると ハートが たまるよ'));

  // ---------- 各画面 ----------
  room.init(G); tankUi.init(G); shop.init(G); dex.init(G); missions.init(G); photo.init(G); tutorial.init(G);
  // v0.5：ヘルプ・こうしん りれき（案内係）／ミニゲーム・かりすいそう・プレイヤー（ゲーム係）。無くても うごく
  for (const m of await Promise.all(['./ui/help.js', './ui/changelog.js', './ui/minigame.js', './ui/box.js', './ui/player.js', './ui/storage.js', './ui/adventure.js'].map(optional))) m.init?.(G);

  // ずっと押していると出るメニューや、ダブルタップの拡大を止める
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - lastTouch < 320 && !e.target.closest('.grid, .list')) e.preventDefault(); lastTouch = now; }, { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || !e.target.closest('.grid, .list')) e.preventDefault(); }, { passive: false });

  refreshHud();
  const start = state.tutorial.done ? (state.ui.lastScreen === 'tank' ? 'tank' : 'room') : 'room';
  go(start);
  clock.start();
  tutorial.resume(G);
  // v0.1 の セーブで もう 6ぴき いた・まえに 見のがした ときも ここで おいわい
  setTimeout(celebrate, 900);
  G.on('tutorialDone', () => setTimeout(celebrate, 1200));

  // あそんでいる あいだは 画面を くらく しない（Wake Lock、だめなら 無音の 小さな 動画）
  initAwake();
  G.awake = awakeState;
  // おんがく（js/bgm.js が とどいていれば ボタンを 出す）
  wirePicker();
  initBgmUi(G);
  G.bgmNow = bgmNow;
  if (DEBUG) setupDebug(G);
  registerSW();
}

// ---------- デバッグ（?debug=1）----------
function setupDebug(G) {
  const box = $('#debug');
  box.hidden = false;
  const btn = (label, fn) => box.append(el('button', { text: label, onclick: fn }));
  const spd = el('span', { text: ' x1 ' });
  box.append(spd);
  for (const v of [1, 10, 60, 300]) btn('x' + v, () => { G.clock.speed = v; spd.textContent = ` x${v} `; });
  btn('+1h', () => { G.handleEvents(G.sim.tick(G.state, 60)); G.refreshHud(); });
  btn('+1d', () => { for (let i = 0; i < 24; i++) G.handleEvents(G.sim.tick(G.state, 60)); G.refreshHud(); });
  btn('+500', () => G.coins(500));
  btn('reset', () => { G.S.resetSave(); window.removeEventListener('pagehide', G.saveNow); G.saveNow = () => {}; location.href = location.pathname + '?debug=1'; });
}

// ---------- オフライン（サービスワーカー）----------
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  if (params.has('nosw')) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const ask = (w) => {
      const bar = $('#update-bar');
      bar.hidden = false;
      $('#update-go').onclick = () => { window.G?.saveNow(); w.postMessage('skipWaiting'); };
    };
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); });
    });
    // ときどき 新しい版を見にいく（開いている間だけ）
    setInterval(() => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); }, 30 * 60 * 1000);
  }).catch((e) => console.warn('sw', e));
  // はじめて入ったとき（もともと コントローラーが いない）は リロードしない
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading || !hadController) return; reloading = true; location.reload(); });
}

boot().catch((e) => {
  console.error(e);
  document.body.append(el('div', { style: { position: 'fixed', inset: '0', display: 'grid', placeItems: 'center', background: '#f4faf7', fontSize: '20px', zIndex: 200 }, text: 'ごめんね、うまく ひらけなかったよ。もういちど ひらいてみてね。' }));
});
