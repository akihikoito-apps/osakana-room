// そうこ（v0.6 ゲーム係）：へやの すいそうを 中身ごと しまう／だす 1まいの 画面（Codex・agy の あん）。
// 上：へやの 6わく（しまう）、下：そうこの すいそう（だす。へやが いっぱいなら いれかえ）。しくみは js/storage.js。
import { $, el, toast, dialog } from './common.js';

let G = null;

export function init(g) {
  G = g;
  G.addScreen('storage', { show, hide() {} });
  const nav = () => {
    const b = $('#room-nav [data-go="storage"]');
    if (b) b.hidden = !G.state.tutorial.done || !(G.sim.isUnlocked(G.state, 'tank6') || (G.state.storage || []).length);
  };
  nav();
  G.on('screen', nav);
  G.on('tutorialDone', nav);
  G.on('changed', () => { nav(); if (G.screen === 'storage') render(); });
}

function show() { $('#toasts').replaceChildren(); render(); }

const waterName = (w) => G.sim.balance().WATERS?.[w]?.name || 'みず';
const ROOM = () => G.sim.balance().TANKS?.max ?? 6;

/** すいそうの 小さな カード */
function tankCard(t, where, btn) {
  const n = t.fish.length;
  return el('div', { class: 'stg-card ' + where + ' w-' + t.water, 'data-id': t.id },
    el('div', { class: 'stg-pic' }, el('img', { src: `assets/items/tank_${t.water}.png`, alt: '', onerror: (e) => { e.target.replaceWith(el('span', { class: 'stg-alt', text: '🫙' })); } }),
      n ? el('span', { class: 'stg-n', text: `🐟${n}` }) : null),
    el('div', { class: 'stg-name', text: G.sim.tankName(G.state, t) }),
    el('span', { class: 'water-tag ' + t.water, text: waterName(t.water) }),
    btn);
}

function reasonText(r) {
  switch (r.reason) {
    case 'lastTank': return 'さいごの 1つは しまえないよ';
    case 'firstTank': return 'さきに 6ぴき あつめよう';
    case 'roomFull': return 'へやが いっぱい だよ';
    default: return 'いまは できないよ';
  }
}

function render() {
  const s = G.state, sim = G.sim;
  const store = s.storage || [];
  $('#storage-count').textContent = `すいそう ${sim.tankTotal(s)}／${sim.tankLimit()}`;
  // へや（わくの じゅん）
  const room = [];
  for (let k = 0; k < ROOM(); k++) {
    const t = s.tanks.find((x) => x.slot === k);
    if (!t) { room.push(el('div', { class: 'stg-card empty' }, el('div', { class: 'stg-pic' }, el('span', { class: 'stg-alt', text: '＋' })), el('div', { class: 'stg-name', text: 'あき' }))); continue; }
    const c = sim.canStoreTank(s, t.id);
    room.push(tankCard(t, 'room', el('button', { class: 'btn soft stg-btn' + (c.ok ? '' : ' cant'), onclick: () => onStore(t) }, '📦 しまう')));
  }
  const kids = [
    el('h3', { class: 'stg-head', text: '🏠 へやの すいそう' }),
    el('div', { class: 'stg-row' }, ...room),
    el('h3', { class: 'stg-head', text: `📦 そうこ（${store.length}）` }),
  ];
  if (!store.length) kids.push(el('div', { class: 'stg-empty', text: 'そうこは からっぽ。すいそうを しまうと なかの いきものも いっしょに おやすみ するよ。' }));
  else {
    const full = sim.freeSlot(s) < 0;
    kids.push(el('div', { class: 'stg-row' }, ...store.map((t) => tankCard(t, 'store', el('button', { class: 'btn primary stg-btn', onclick: () => onTakeOut(t) }, full ? '🔁 いれかえ' : '🏠 だす')))));
  }
  $('#storage-body').replaceChildren(...kids);
}

async function onStore(t) {
  const s = G.state, sim = G.sim;
  const c = sim.canStoreTank(s, t.id);
  if (!c.ok) { toast(reasonText(c)); return; }
  const name = sim.tankName(s, t);
  const yes = await dialog([
    el('div', { class: 'big', text: `${name}を しまう？` }),
    el('div', { class: 'small', text: t.fish.length ? `なかの ${t.fish.length}ぴきも いっしょに おやすみ するよ。いつでも だせるよ。` : 'いつでも だせるよ。' }),
  ], [{ label: 'やめる', value: false, kind: 'soft' }, { label: '📦 しまう', value: true, kind: 'primary' }], { cancelValue: false });
  if (!yes) return;
  const r = sim.storeTank(s, t.id);
  if (!r.ok) { toast(reasonText(r)); return; }
  toast(`${name}を そうこに しまったよ`, 'gold');
  after(r);
}

async function onTakeOut(t) {
  const s = G.state, sim = G.sim;
  const name = sim.tankName(s, t);
  if (sim.freeSlot(s) >= 0) {
    const r = sim.takeOutTank(s, t.id);
    if (!r.ok) { toast(reasonText(r)); return; }
    toast(`${sim.tankName(s, r.tank)}を へやに だしたよ`, 'gold');
    after(r);
    return;
  }
  // へやが いっぱい：どれと いれかえる？（agy の あん）
  const list = s.tanks.slice().sort((a, b) => a.slot - b.slot).filter((x) => sim.swapTank && !(x === s.tanks[0] && !sim.isUnlocked(s, 'tank6')));
  // Codex・agy：「〜と」は わかりにくい → 「どれを しまう？」と きいて、ボタンは なまえ＋なかの かず
  const v = await dialog([
    el('div', { class: 'big', text: 'へやが いっぱい だよ' }),
    el('div', { class: 'small', text: `${name}を だすので、かわりに しまう すいそうを えらんでね` }),
  ], [...list.map((x) => ({ label: `📦 ${sim.tankName(s, x)}${x.fish.length ? `（🐟${x.fish.length}）` : ''}`, value: x.id, kind: 'soft go-tank' })), { label: 'やめる', value: null, kind: 'soft' }]);
  if (!v) return;
  const r = sim.swapTank(s, v, t.id);
  if (!r.ok) { toast(reasonText(r)); return; }
  toast(`${sim.tankName(s, r.tank)}を だして、${sim.tankName(s, r.stored)}を しまったよ`, 'gold');
  after(r);
}

function after(r) {
  G.markDirty(); G.saveNow();
  G.emit('changed');
  G.handleEvents(r.events);
  render();
}
