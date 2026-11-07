// チュートリアル：js/data/tutorial.js の steps を順に進める。
// ふきだし・光る目印・ほかのボタンを押せなくする（lockOthers）を受け持つ。
import { $, $$, el, toast, bumpCoins } from './common.js';
import * as shop from './shop.js';

let G = null;
let T = null;            // TUTORIAL データ
let fishName = '';
let arrowTimer = 0;
let autoGo = 0;

export function init(g) {
  G = g;
  T = G.data.tutorialModule?.TUTORIAL || null;
  if (!T || !Array.isArray(T.steps) || !T.steps.length) {
    // データが無いときは チュートリアルなしで はじめる（えさ・みずかえは もたせる）
    if (!G.state.tutorial.done) { G.state.tutorial.done = true; G.state.inv.food_flake = 1; G.state.inv.water_change = 1; }
    return;
  }
  G.tutorialBusy = () => !G.state.tutorial.done;
  G.tutorialShows = (care) => {
    if (G.state.tutorial.done) return true;
    const i = G.state.tutorial.step, feedAt = idx('feedEaten');
    if (i < feedAt) return false;
    if (i === feedAt) return care === 'feed';
    return true;
  };
  G.tutorialLocks = (target) => isLocked(target);

  // ほかの ボタンを おせなくする（つかまえる 段階で 止める）
  document.addEventListener('click', (e) => {
    if (!isLocked(e.target)) return;
    e.stopPropagation(); e.preventDefault();
    nudge();
  }, true);

  $('#guide').addEventListener('click', (e) => { e.stopPropagation(); if (cur()?.wait === 'tap') next(); });

  G.on('action', onAction);
  G.on('screen', () => { checkAuto(); render(); });
  G.on('changed', () => { checkAuto(); });
  G.on('shopRendered', () => render());
  window.addEventListener('resize', () => render());
  setInterval(() => { if (!G.state.tutorial.done) placeArrow(); }, 400);
}

const cur = () => (G.state.tutorial.done || !T ? null : T.steps[G.state.tutorial.step] || null);
const idx = (wait) => T.steps.findIndex((s) => s.wait === wait);

/** チュートリアル中は 時計を とめる（balance.js TIME.stopDuringTutorial） */
export function pausesClock(g) { return !!T && !g.state.tutorial.done && g.sim.balance().TIME.stopDuringTutorial !== false; }

/** その段階で もらえる もの */
function applyGive(st) {
  const id = st?.give?.item;
  if (!id || G.state.owned[id]) return;
  const it = G.data.itemById[id];
  if (!it) return;
  if (it.inTank) G.tank().decor.push(id); else G.state.inv[id] = 1;
  G.state.owned[id] = true;
  G.state.stats['free_' + id] = 1;
}

export function resume(g) {
  G = g;
  if (!T || G.state.tutorial.done) { hideGuide(); return; }
  const t = G.tank();
  if (t.fish[0]) fishName = G.data.fishById[t.fish[0].speciesId]?.name || '';
  applyGive(cur());
  checkAuto();
  render();
}

/** いまの段階で もう できていること（リロードしたとき など）は とばす */
function satisfied(st) {
  if (!st) return false;
  const s = G.state, t = G.tank();
  if (st.wait === 'buyFish') return t.fish.length > 0;
  if (st.wait.startsWith('buyItem:')) { const id = st.wait.slice(8); return !!s.owned[id]; }
  if (st.wait === 'openShop') return G.screen === 'shop';
  if (st.wait === 'openTank') return G.screen === 'tank';
  return false;
}

function checkAuto() {
  let guard = 0;
  while (cur() && satisfied(cur()) && guard++ < 30) advance();
  render();
}

function onAction(a) {
  const st = cur();
  if (!st) return;
  if (a.type === 'buyFish') { fishName = G.data.fishById[a.id]?.name || fishName; render(); }
  // ヒーターを うけとったら すぐ あたたかく（時計が とまっているので）
  if (a.type === 'buyItem' && a.id === 'heater' && T.heaterWarmsNow) {
    const e = G.data.itemById.heater?.effect;
    if (e?.targetTemp) G.tank().temp = e.targetTemp;
    G.emit('changed');
  }
  const ok =
    (st.wait === 'openShop' && a.type === 'openShop') ||
    (st.wait === 'buyFish' && a.type === 'buyFish') ||
    (st.wait === 'buyItem:' + a.id && a.type === 'buyItem') ||
    (st.wait === 'openTank' && a.type === 'openTank') ||
    (st.wait === 'feedEaten' && a.type === 'feed' && a.result?.ate?.length);
  if (ok) setTimeout(() => { if (cur() === st) next(); }, st.wait === 'feedEaten' ? 1600 : 250);
}

function advance() {
  G.state.tutorial.step++;
  if (G.state.tutorial.step >= T.steps.length) finish();
  else applyGive(cur());
  G.markDirty();
}

function next() {
  if (!cur()) return;
  advance();
  checkAuto();
  G.saveNow();
  G.emit('changed');
}

function finish() {
  G.state.tutorial.done = true;
  hideGuide();
  const c = T.doneReward?.coin || 0;
  if (c) { G.state.coins += c; bumpCoins(); toast(`おいわいに +${c} コイン！`, 'gold'); }
  G.refreshHud();
  G.saveNow();
  G.handleEvents(G.sim.checkMissions(G.state));
  G.emit('changed');
}

function hideGuide() {
  $('#guide').hidden = true; $('#guide-arrow').hidden = true;
  document.body.classList.remove('tut-shop');
  $$('.guide-target').forEach((e) => e.classList.remove('guide-target'));
}

/** 光らせる ところ（いまの画面に あわせて「そこへ いく ボタン」に かえる） */
function targetEl(st) {
  if (!st?.target) return null;
  const scr = G.screen;
  const toShop = () => (scr === 'room' ? $('#room-nav [data-go="shop"]') : $('#btn-back'));
  const tg = st.target;
  if (tg === 'tank') return scr === 'room' ? $('#room-tank') : scr === 'tank' ? null : $('#btn-back');
  if (tg === 'shopButton') return scr === 'shop' ? null : toShop();
  if (tg === 'shopFish' || tg.startsWith('shopItem:')) {
    if (scr !== 'shop') return toShop();
    if (tg === 'shopFish') {
      if (shop.currentTab() !== 'fish') { shop.setTab('fish'); return null; }
      const rec = T.recommend && $(`#shop-list [data-id="${T.recommend}"]`);
      return rec || $('#shop-list');
    }
    const id = tg.slice(9);
    const it = G.data.itemById[id];
    const want = it?.type === 'food' ? 'food' : 'equip';
    if (shop.currentTab() !== want) { shop.setTab(want); return null; }
    return $(`#shop-list [data-id="${id}"]`);
  }
  if (tg === 'feedButton') return scr === 'tank' ? $('#care [data-care="feed"]') : scr === 'room' ? $('#room-tank') : $('#btn-back');
  if (tg === 'meters') return scr === 'tank' ? $('#gauges') : null;   // すいそう以外なら render で すいそうへ つれていく
  if (tg === 'coins') return $('#hud-coins');
  return null;
}

function allowedRoots(st) {
  const list = [$('#guide'), $('#dialog'), $('#update-bar'), $('#debug'), $('#rotate')];
  const t = targetEl(st);
  if (t) list.push(t);
  // 魚を えらぶ だんかいでは さかなの どれでも えらべる
  if (st.target === 'shopFish' && G.screen === 'shop') list.push($('#shop-list'));
  return list.filter(Boolean);
}

function isLocked(node) {
  const st = cur();
  if (!st || !st.lockOthers || !node || !node.closest) return false;
  if (node.closest('#aq')) return false;   // 3D水槽（見回し・なでる）は いつでも
  return !allowedRoots(st).some((r) => r.contains(node));
}

function nudge() {
  const g = $('#guide');
  g.animate([{ marginLeft: '0px' }, { marginLeft: '-8px' }, { marginLeft: '8px' }, { marginLeft: '0px' }], { duration: 300 });
}

function render() {
  if (!G || !T) return;
  G.refreshCare?.();
  const st = cur();
  $$('.guide-target').forEach((e) => e.classList.remove('guide-target'));
  if (!st) { hideGuide(); return; }
  const g = $('#guide');
  const text = (st.say || '').replaceAll('{name}', fishName || 'さかな');
  g.querySelector('.guide-text').textContent = text;
  g.querySelector('.guide-ok').hidden = st.wait !== 'tap';
  g.querySelector('.guide-ok').textContent = 'つぎへ';
  // ばしょ：へや は 上、おみせ は タブの した の わく、すいそう は 下
  const inShop = G.screen === 'shop';
  document.body.classList.toggle('tut-shop', inShop);
  g.classList.toggle('inshop', inShop);
  g.classList.toggle('top', G.screen === 'room');
  if (inShop) { const r = $('#shop-guide-slot').getBoundingClientRect(); g.style.top = r.top + 'px'; } else g.style.top = '';
  g.hidden = false;
  if (st.target === 'meters' && G.screen !== 'tank') { clearTimeout(autoGo); autoGo = setTimeout(() => { if (cur()?.target === 'meters' && G.screen !== 'tank') G.go('tank'); }, 700); }
  const t = targetEl(st);
  if (t && t.id !== 'shop-list' && t.id !== 'gauges') t.classList.add('guide-target');
  if (t?.id === 'gauges') t.querySelectorAll('.gauge').forEach((x) => x.classList.add('guide-target'));
  if (t && t.closest('#shop-list') && t.scrollIntoView) t.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  placeArrow();
}

function placeArrow() {
  const st = cur();
  const a = $('#guide-arrow');
  const t = st && targetEl(st);
  if (!t || t.id === 'shop-list' || document.body.classList.contains('photo')) { a.hidden = true; return; }
  const r = t.getBoundingClientRect();
  if (!r.width) { a.hidden = true; return; }
  if (t.id === 'gauges') { a.textContent = '👈'; a.style.left = (r.right + 26) + 'px'; a.style.top = (r.top + r.height / 2 + 18) + 'px'; }
  else if (t.id === 'hud-coins') { a.textContent = '👆'; a.style.left = (r.left + r.width / 2) + 'px'; a.style.top = (r.bottom + 44) + 'px'; }
  else if (t.closest('#shop-list')) { a.textContent = '👇'; a.style.left = (r.left + r.width / 2) + 'px'; a.style.top = (r.top + 34) + 'px'; }   // おみせでは カードの なかを さす（となりを おさない ように）
  else { a.textContent = '👇'; a.style.left = (r.left + r.width / 2) + 'px'; a.style.top = Math.max(40, r.top - 2) + 'px'; }
  a.hidden = false;
  void arrowTimer;
}
