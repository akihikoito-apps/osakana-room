// BGM：「おんがく」ボタン と「おんがくを えらぶ」画面（部屋・ゲーム係）。
// 音そのものは 音楽係の js/bgm.js（TRACKS・initBgm・play(id)・stop・setVolume・current）。
// - js/bgm.js が まだ 無いときは ボタンを 出さない（あそびは そのまま）。
// - initBgm は 起動時に 1かい。iOS で 音が 出せる ように なる タイミング（さいしょの タップ）は bgm.js が まつ。
// - えらんだ 曲・オン／オフは bgm.js が localStorage 'osakana-room-bgm' に のこす（ここでは もたない）。
import { $, el, toast } from './common.js';

let G = null;
let B = null;          // js/bgm.js
let started = false;

const title = (t) => t.title || t.name || t.label || t.id;
const note = (t) => t.desc || t.note || t.comment || t.line || '';

export async function initBgmUi(g) {
  G = g;
  try { B = await import('../bgm.js'); } catch { B = null; }
  if (!B || !Array.isArray(B.TRACKS) || !B.TRACKS.length) return;
  // 起動時に 1かい（前回 オンなら、つぎの タップで 自動で ながれる。えらんだ 曲・オン／オフは bgm.js が おぼえる）
  try { B.initBgm?.(); started = true; } catch (e) { console.warn('bgm', e); }
  const btn = $('#btn-bgm');
  btn.hidden = false;
  btn.addEventListener('click', openPicker);
  G.on('screen', render);
  B.onBgmChange?.(() => render());
  render();
}

/** いまの ようす（bgm.js の current()） */
function cur() {
  try { return (typeof B.current === 'function' ? B.current() : null) || {}; } catch { return {}; }
}

/** タップの 中で よぶ */
function playId(id) {
  try { const r = B.play?.(id); if (r && r.catch) r.catch(() => {}); } catch (e) { console.warn('bgm', e); }
}

function render() {
  const btn = $('#btn-bgm');
  if (!B) return;
  const scr = G.screen;
  btn.hidden = !(scr === 'room' || scr === 'tank');
  btn.classList.toggle('playing', !!cur().on);
}

function openPicker() {
  const box = $('#bgm-picker');
  const list = box.querySelector('.bgm-list');
  const c = cur();
  const sel = c.on ? c.id : null;
  list.replaceChildren(...B.TRACKS.map((t) => el('button', { class: 'bgm-row' + (t.id === sel ? ' on' : ''), 'data-id': t.id, onclick: () => choose(t.id) },
    el('span', { class: 'bgm-body' }, el('span', { class: 'bgm-title', text: title(t) }), note(t) ? el('span', { class: 'bgm-note', text: note(t) }) : null),
    t.id === sel ? el('span', { class: 'bgm-mark', text: '✓ えらんでいる' }) : null)));
  box.querySelector('.bgm-state').textContent = sel ? '' : 'とまっている';
  box.hidden = false;
}

function choose(id) {
  playId(id);                         // タップの 中で（iOS）
  $('#bgm-picker').hidden = true;     // えらんだら とじる（agy：もどりかたに まよわない）
  render();
}

function stopBgm() {
  try { B.stop?.(); } catch { /* なし */ }
  $('#bgm-picker').hidden = true;
  render();
  toast('おんがくを とめたよ');
}

export function wirePicker() {
  const box = $('#bgm-picker');
  box.querySelector('.bgm-stop').addEventListener('click', stopBgm);
  box.querySelector('.bgm-close').addEventListener('click', () => { box.hidden = true; });
  box.addEventListener('click', (e) => { if (e.target === box) box.hidden = true; });
}
export const bgmNow = () => (B ? cur() : null);
