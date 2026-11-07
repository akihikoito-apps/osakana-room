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
    tank() { return state.tanks[0]; },
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
  function go(name, opts = {}) {
    if (name === G.screen) return;
    const from = G.screen;
    if (from && !SHEETS.includes(from)) G.prevScreen = from;
    G.screen = name;
    for (const s of $$('.screen')) s.hidden = s.dataset.screen !== name;
    // すいそうの3Dは すいそう画面のときだけ動かす（シートの後ろでは止める）
    if (name === 'tank') tankUi.show(G); else tankUi.hide(G);
    if (name === 'room') room.show(G);
    if (name === 'shop') shop.show(G, opts);
    if (name === 'dex') dex.show(G);
    if (name === 'missions') missions.show(G);
    $('#btn-back').hidden = name === 'room';
    $('#btn-back .lb').textContent = SHEETS.includes(name) ? 'もどる' : 'へや';
    $('#btn-menu').hidden = name !== 'tank';
    state.ui.lastScreen = SHEETS.includes(name) ? G.prevScreen : name;
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
    if (tutorial.pausesClock(G)) return;
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

  // ---------- 各画面 ----------
  room.init(G); tankUi.init(G); shop.init(G); dex.init(G); missions.init(G); photo.init(G); tutorial.init(G);

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
