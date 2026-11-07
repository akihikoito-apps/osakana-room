// おみせ：さかな・きぐ・えさ のタブ。買うときは小さな確認を出す。
import { $, $$, el, toast, dialog, coinIcon, stars, bumpCoins } from './common.js';

let G = null;
let tab = 'fish';

export function init(g) {
  G = g;
  $$('#scr-shop .tab').forEach((b) => b.addEventListener('click', () => { if (G.tutorialLocks?.(b)) return; tab = b.dataset.tab; render(); G.emit('shopTab', tab); }));
  G.on('changed', () => { if (G.screen === 'shop') render(); });
}

export function show(g, opts = {}) {
  G = g;
  if (opts.tab) tab = opts.tab;
  render();
  G.emit('action', { type: 'openShop' });
}
export const setTab = (t) => { tab = t; if (G?.screen === 'shop') render(); };
export const currentTab = () => tab;

function itemsOf(kind) {
  const { FISH, ITEMS } = G.data;
  const t = G.tank();
  if (kind === 'fish') {
    let list = FISH.filter((f) => f.price != null && f.water === t.water);
    const tut = G.data.tutorialModule?.TUTORIAL;
    if (!G.state.tutorial.done && tut?.firstFish) list = list.filter((f) => tut.firstFish.includes(f.id));
    return list.sort((a, b) => a.price - b.price);
  }
  if (kind === 'food') return ITEMS.filter((i) => i.type === 'food' && i.price != null);
  return ITEMS.filter((i) => i.type !== 'food' && i.price != null && (i.water === 'both' || i.water === t.water));
}

function render() {
  $$('#scr-shop .tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  const list = $('#shop-list');
  const s = G.state, sim = G.sim, t = G.tank();
  const tut = G.data.tutorialModule?.TUTORIAL;
  list.replaceChildren(...itemsOf(tab).map((it) => {
    const isFish = tab === 'fish';
    const price = sim.priceOf(s, it.id);
    const c = isFish ? sim.canBuyFish(s, it.id) : sim.canBuyItem(s, it.id);
    let priceEl;
    if (!isFish && (c.reason === 'have' || c.reason === 'max')) priceEl = el('span', { class: 'price', text: c.reason === 'have' ? 'もってる' : 'いっぱい' });
    else if (price === 0) priceEl = el('span', { class: 'price', text: '🎁 プレゼント' });
    else priceEl = el('span', { class: 'price' }, coinIcon(), String(price));
    const count = !isFish && it.inTank ? t.decor.filter((x) => x === it.id).length : 0;
    const card = el('button', {
      class: 'shop-item' + (c.ok ? '' : c.reason === 'coins' ? ' cant' : c.reason === 'have' || c.reason === 'max' ? ' owned' : ' locked'),
      'data-id': it.id,
      onclick: () => onPick(it, isFish),
    },
    el('div', { class: 'pic' }, el('img', { src: isFish ? it.texture : it.icon, alt: '', onerror: (e) => { e.target.replaceWith(el('span', { text: isFish ? '🐟' : '📦', style: { fontSize: '40px' } })); } })),
    el('div', { class: 'nm', text: it.name }),
    isFish ? el('div', { class: 'stars', text: stars(it.rarity || 1) }) : (count && it.max > 1 ? el('div', { class: 'tagline', text: `いれた かず ${count}/${it.max}` }) : null),
    !G.state.tutorial.done && tut?.recommend === it.id ? el('span', { class: 'rec', text: 'おすすめ' }) : null,
    isFish ? compatMark(t, it.id) : null,
    priceEl);
    return card;
  }));
  G.emit('shopRendered');
}

// いまの すいそうの 魚との 相性マーク（◎ なかよし／○ ふつう／× にがて）
function compatMark(t, id) {
  const c = G.sim.compatWithTank(t, id);
  if (c == null) return null;
  return el('span', { class: 'compat c' + c, text: ['× にがて', '○ ふつう', '◎ なかよし'][c] });
}

const REASON = {
  coins: () => G.sim.hintText('noCoins') || 'コインが たりないよ',
  full: () => G.sim.hintText('tankFull') || 'すいそうが いっぱいだよ',
  max: () => 'もう これいじょう いれられないよ',
  have: () => 'もう もっているよ',
  water: () => 'この すいそうには いれられないよ',
  notSold: () => 'まだ うっていないよ',
};

async function onPick(it, isFish) {
  if (G.tutorialLocks?.($(`#shop-list [data-id="${it.id}"]`))) return;
  const s = G.state, sim = G.sim;
  const c = isFish ? sim.canBuyFish(s, it.id) : sim.canBuyItem(s, it.id);
  const price = sim.priceOf(s, it.id);
  const body = [
    el('img', { src: isFish ? it.texture : it.icon, alt: '' }),
    el('div', { class: 'big', text: it.name }),
  ];
  if (isFish) {
    body.push(el('div', { class: 'stars', text: stars(it.rarity || 1) }));
    body.push(el('div', { class: 'small', text: it.intro || '' }));
    if (it.temp) body.push(el('div', { class: 'small', text: `すきな みずの あたたかさ：${it.temp.min}〜${it.temp.max}ど` }));
  } else body.push(el('div', { class: 'small', text: it.desc || '' }));
  if (isFish && c.ok && sim.compatWithTank(G.tank(), it.id) === 0) {
    body.push(el('div', { text: sim.text('nigateConfirm', it.name), style: { marginTop: '6px', color: '#b4553f', fontSize: '15px' } }));
  }
  if (!c.ok) {
    body.push(el('div', { text: REASON[c.reason]?.() || '', style: { marginTop: '6px', color: '#b4553f' } }));
    await dialog(body, [{ label: 'とじる', value: false, kind: 'soft' }], { cancelValue: false });
    return;
  }
  const yes = await dialog(body, [
    { label: 'やめる', value: false, kind: 'soft' },
    { label: price === 0 ? 'うけとる' : `かう（${price}）`, value: true, kind: 'primary' },
  ], { cancelValue: false });
  if (!yes) return;
  const r = isFish ? sim.buyFish(s, it.id) : sim.buyItem(s, it.id);
  if (!r.ok) { toast(REASON[r.reason]?.() || 'かえなかったよ'); return; }
  bumpCoins();
  // なかよしの あいてが いたら いっしょに ハート、すきな かざりなら くるっ（すいそうに もどったとき）
  if (isFish && r.friends?.length) { G.queueReact(r.fish.uid, 'heart'); r.friends.forEach((u, i) => G.queueReact(u, 'heart', 150 * (i + 1))); }
  if (!isFish && r.fans?.length) r.fans.forEach((u, i) => G.queueReact(u, 'spin', 200 * i));
  if (isFish) toast(r.first ? `${it.name}が なかまに なったよ！ ずかんに のったよ` : `${it.name}が なかまに なったよ！`, 'gold');
  else toast(it.inTank ? `${it.name}を すいそうに いれたよ` : `${it.name}を てに いれたよ`);
  G.markDirty(); G.saveNow();
  G.emit('changed');
  G.refreshHud();
  G.emit('action', isFish ? { type: 'buyFish', id: it.id, fish: r.fish } : { type: 'buyItem', id: it.id });
  G.handleEvents(r.events);
}
