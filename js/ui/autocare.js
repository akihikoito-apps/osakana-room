// v0.9 じどう おせわき（おせわき係）：すいそう画面の とりつけ／はずす ボタン・のこりの かず・じどうで おせわ した ときの 小さな しらせ。
// しくみは js/autocare.js（sim.autocare）。もらう ときの あんない（かみしばい）は main.js の celebrateAutoCare。
// へやの 棚の しるしは js/ui/room.js、すいそうの 3D の きかいは js/aquarium/tank.js（'auto_care' を decor の ように わたす）。
import { $, el, toast, dialog } from './common.js';

let G = null;
let lastNote = -1e9;         // さいごに 「おせわきが …したよ」を 出した 実時間（ms）
let noteEl = null, noteTimer = 0;

export function init(g) {
  G = g;
  if (!G.sim.autocare) return;
  // css は ここで よみこむ（index.html は さわらない）
  if (!document.querySelector('link[href="css/autocare.css"]')) document.head.append(el('link', { rel: 'stylesheet', href: 'css/autocare.css' }));
  G.autocareUi = { render, attach: (t) => attachAsk(t || G.tank()) };
  G.on('screen', render);
  G.on('changed', render);
  G.on('tick', () => { if (G.screen === 'tank') render(); });
  G.on('sim', onSim);
}

const AC = () => G.sim.autocare;
const tutorialOn = () => !!G?.tutorialBusy?.();

/** すいそう画面の ボタン（もらう まで・ゆめのすいそう・チュートリアル中 は 出さない） */
function render() {
  let b = $('#ac-sw');
  const t = G.tank();
  const on = G.screen === 'tank' && AC().unlocked(G.state) && AC().canHold(t) && !tutorialOn();
  if (!b) {
    if (!on) return;
    b = el('button', { id: 'ac-sw', 'aria-label': 'じどう おせわき', onclick: () => onTap() },
      el('img', { src: 'assets/items/auto_care.png', alt: '' }),
      el('span', { class: 'ac-txt' }, el('span', { class: 'ac-lb', text: 'じどう おせわき' }), el('small', { class: 'ac-left' })),
      el('span', { class: 'ac-state' }));
    $('#scr-tank').append(b);
  }
  b.hidden = !on;
  if (!on) return;
  const has = t.autoCare === true;
  const n = AC().left(G.state);
  b.classList.toggle('on', has);
  b.classList.toggle('cool', !has && n <= 0);
  b.querySelector('.ac-state').textContent = has ? 'ついてるよ' : 'つける';
  b.querySelector('.ac-left').textContent = `のこり ${n}こ`;
  b.setAttribute('aria-pressed', String(has));
}

async function onTap() {
  const t = G.tank();
  if (t.autoCare === true) {
    const v = await dialog([
      el('img', { src: 'assets/items/auto_care.png', alt: '', class: 'ac-dlg-pic' }),
      el('div', { class: 'big', text: 'じどう おせわきを はずす？' }),
      el('div', { class: 'small', text: 'はずすと のこりに もどるよ。ほかの すいそうに つけかえ できるよ。' }),
    ], [{ label: 'つけておく', value: false, kind: 'soft' }, { label: 'はずす', value: true, kind: 'primary' }], { cancelValue: false });
    if (!v) return;
    const r = AC().detach(G.state, t);
    if (!r.ok) return;
    toast(`じどう おせわきを はずしたよ（のこり ${r.left}こ）`);
    done();
    return;
  }
  attachAsk(t);
}

function attachAsk(t) {
  const c = AC().canAttach(G.state, t);
  if (!c.ok) {
    if (c.reason === 'empty') toast('のこりが ないよ。ほかの すいそうから はずすと つけられるよ');
    else if (c.reason === 'dream') toast('ゆめのすいそうは いつも ちょうど いいから いらないよ');
    return false;
  }
  const r = AC().attach(G.state, t);
  if (!r.ok) return false;
  toast(`じどう おせわきを つけたよ！（のこり ${r.left}こ）`, 'gold');
  done();
  setTimeout(() => G.aq?.autoCare?.({ attach: true }), 50);   // 3D の きかいが できてから ひからせる
  return true;
}

function done() {
  G.markDirty(); G.saveNow();
  G.emit('action', { type: 'autoCare' });
  G.emit('changed');
}

/** じどうで おせわ した：見ている すいそう なら 3D の きかいを ひからせて、小さく しらせる（うるさく ならない ように まを あける） */
function onSim(ev) {
  if (ev.type !== 'autoCare') return;
  if (G.screen !== 'tank' || G.tank().id !== ev.tankId || tutorialOn()) return;
  const feed = ev.fed?.length > 0;
  G.aq?.autoCare?.({ feed, water: !!ev.water, scoop: !!ev.scoop });
  const gap = (G.sim.balance().AUTOCARE?.noticeGapSec ?? 45) * 1000;
  const now = performance.now();
  if (now - lastNote < gap) return;
  lastNote = now;
  // なにを したか ぐたいてきに（Codex）：「ごはんと おそうじを したよ」など
  const what = [feed && 'ごはん', ev.water && 'みずかえ', ev.scoop && 'おそうじ'].filter(Boolean);
  note(feed && what.length === 1 ? 'おせわきが ごはんを あげたよ' : `おせわきが ${what.join('と ')}を したよ`);
}

/** ボタンの 上に 小さな ふきだし（3びょう） */
function note(text) {
  const b = $('#ac-sw');
  if (!noteEl) { noteEl = el('div', { id: 'ac-note', role: 'status' }); $('#scr-tank').append(noteEl); }
  noteEl.textContent = '🤖 ' + text;
  noteEl.hidden = false;
  noteEl.classList.remove('show'); void noteEl.offsetWidth; noteEl.classList.add('show');
  noteEl.classList.toggle('alone', !b || b.hidden);
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { if (noteEl) noteEl.hidden = true; }, 3000);
}
