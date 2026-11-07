// おみせ：いきもの（さかな・エビ・かい の 見出し）・きぐ（すいそう・どうぐ・かざり）・えさ のタブ。
// 仕様 v0.2 1章：上に「いま えらんでいる すいそう」（◀ ▶ で きりかえ）。並べるのは その水槽と おなじ 水の もの だけ。
// 買った 生きもの・かざりは その水槽に 入る（水が あわない ものは そもそも 並ばない）。解放前の ものは かぎつきカード。
import { $, $$, el, toast, dialog, coinIcon, stars, bumpCoins } from './common.js';

let G = null;
let tab = 'fish';
let focus = null;

const WATER = { fresh: 'かわ', salt: 'うみ', both: 'どちらでも' };
const KIND_IC = { fish: '🐟', shrimp: '🦐', snail: '🐚' };

export function init(g) {
  G = g;
  $$('#scr-shop .tab').forEach((b) => b.addEventListener('click', () => { if (G.tutorialLocks?.(b)) return; tab = b.dataset.tab; focus = null; render(); G.emit('shopTab', tab); }));
  $('#shop-tank .st-prev').addEventListener('click', () => stepTank(-1));
  $('#shop-tank .st-next').addEventListener('click', () => stepTank(1));
  G.on('changed', () => { if (G.screen === 'shop') render(); });
}

export function show(g, opts = {}) {
  G = g;
  if (opts.tab) tab = opts.tab;
  focus = opts.focus || null;
  render();
  if (focus) requestAnimationFrame(() => $(`#shop-list [data-head="${focus}"]`)?.scrollIntoView({ block: 'start' }));
  G.emit('action', { type: 'openShop' });
}
export const setTab = (t) => { tab = t; if (G?.screen === 'shop') render(); };
export const currentTab = () => tab;

function stepTank(dir) {
  if (G.tutorialLocks?.($('#shop-tank'))) return;
  const list = G.state.tanks.slice().sort((a, b) => a.slot - b.slot);
  if (list.length < 2) return;
  const i = list.findIndex((t) => t.id === G.tank().id);
  G.setTank(list[(i + dir + list.length) % list.length].id);
  render();
}

/** そのタブに 出す もの：[{ head, key, items }] */
function groupsOf(kind) {
  const { FISH, ITEMS } = G.data;
  const s = G.state, t = G.tank(), B = G.sim.balance();
  if (kind === 'fish') {
    let list = FISH.filter((f) => f.price != null && f.water === t.water);
    const tut = G.data.tutorialModule?.TUTORIAL;
    if (!s.tutorial.done && tut?.firstFish) list = list.filter((f) => tut.firstFish.includes(f.id));
    // 解放ずみ → かぎつき、その中は やすい じゅん
    list.sort((a, b) => (G.sim.isUnlocked(s, a.unlock) === G.sim.isUnlocked(s, b.unlock) ? a.price - b.price : G.sim.isUnlocked(s, a.unlock) ? -1 : 1));
    const tabs = B.SHOP_TABS || [{ kind: 'fish', label: 'さかな' }, { kind: 'shrimp', label: 'エビ' }, { kind: 'snail', label: 'かい' }];
    const out = tabs.map((x) => ({ key: x.kind, head: `${KIND_IC[x.kind] || '✨'} ${x.label}`, items: list.filter((f) => (f.kind || 'fish') === x.kind) }));
    const other = list.filter((f) => !tabs.some((x) => x.kind === (f.kind || 'fish')));
    if (other.length) out.push({ key: 'other', head: '✨ そのほか', items: other });
    return out.filter((g) => g.items.length);
  }
  if (kind === 'food') return [{ key: 'food', head: '', items: ITEMS.filter((i) => i.type === 'food' && i.price != null) }];
  const tanks = ITEMS.filter((i) => i.type === 'tank' && i.price != null);
  if (kind === 'tanks') return [{ key: 'tanks', head: '', items: tanks }];
  const gear = ITEMS.filter((i) => i.type !== 'food' && i.type !== 'tank' && i.price != null && (i.water === 'both' || i.water === t.water));
  return [{ key: 'gear', head: '', items: gear }];
}

function status(it, isFish) {
  const s = G.state, t = G.tank();
  return isFish ? G.sim.canBuyFish(s, it.id, t) : G.sim.canBuyItem(s, it.id, t);
}

function renderTankBar() {
  const s = G.state, t = G.tank();
  const bar = $('#shop-tank');
  const many = s.tanks.length > 1;
  bar.hidden = !s.tutorial.done;
  bar.querySelector('.st-prev').hidden = !many;
  bar.querySelector('.st-next').hidden = !many;
  bar.querySelector('.st-name').replaceChildren(el('span', { class: 'water-tag ' + t.water, text: WATER[t.water] }), G.sim.tankName(s, t));
  // 定員：いっぱいの ものは ことばで
  const c = G.sim.capacityOf(t);
  const fishFull = c.full ?? (c.space >= c.capacity - 1e-9), snailFull = c.snail >= c.snailMax;
  let cap = bar.querySelector('.st-cap');
  if (!cap) { cap = el('span', { class: 'st-cap' }); bar.append(cap); }
  cap.replaceChildren(el('span', { class: fishFull ? 'full' : '', text: fishFull ? '🐟 いっぱい' : `🐟 ${c.fish}ひき` }), el('span', { class: snailFull ? 'full' : '', text: snailFull ? '🐚 いっぱい' : `🐚 ${c.snail}／${c.snailMax}` }));
}

/** かぎの 案内（一覧の 上に 1回だけ）：あと ◯ひき と ○●（うまった 数） */
function lockBanner() {
  const s = G.state, U = G.sim.balance().UNLOCK?.tank6 || {};
  const need = U.count ?? 6, have = Math.min(need, s.tanks[0].fish.length);
  const dots = el('span', { class: 'lb-dots' }, ...Array.from({ length: need }, (_, i) => el('i', { class: i < have ? 'on' : '' })));
  return el('div', { class: 'lock-banner', 'data-head': 'lock' }, el('span', { class: 'lb-ic', text: '🔒' }),
    el('span', { class: 'lb-text', text: `1つめの すいそうが あと ${need - have}ひきで あえるよ` }), dots);
}

function render() {
  $('#scr-shop .tab-tanks').hidden = !G.sim.isUnlocked(G.state, 'tank6');
  if (tab === 'tanks' && !G.sim.isUnlocked(G.state, 'tank6')) tab = 'equip';
  $$('#scr-shop .tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  renderTankBar();
  const list = $('#shop-list');
  const s = G.state, sim = G.sim, t = G.tank();
  const tut = G.data.tutorialModule?.TUTORIAL;
  const isFish = tab === 'fish';
  const kids = [];
  const groups = groupsOf(tab);
  if (s.tutorial.done && !sim.isUnlocked(s, 'tank6') && groups.some((g) => g.items.some((it) => it.unlock && !sim.isUnlocked(s, it.unlock)))) kids.push(lockBanner());
  for (const g of groups) {
    if (g.head) kids.push(el('h3', { class: 'shop-head', 'data-head': g.key, text: g.head }));
    for (const it of g.items) {
      const price = sim.priceOf(s, it.id);
      const c = status(it, isFish);
      const locked = c.reason === 'locked';
      let priceEl;
      if (c.reason === 'vitaminFull') priceEl = el('span', { class: 'price', text: `のこり ${s.inv[it.id] || 0}かい` });
      else if (c.reason === 'have' || c.reason === 'max') priceEl = el('span', { class: 'price', text: c.reason === 'have' ? 'もってる' : 'いっぱい' });
      else if (locked) priceEl = el('span', { class: 'price', text: '🔒' });
      else if (price === 0) priceEl = el('span', { class: 'price', text: '🎁 プレゼント' });
      else priceEl = el('span', { class: 'price' }, coinIcon(), String(price));
      const short = c.reason === 'coins' && it.type === 'tank' ? el('div', { class: 'lock-line short', text: `あと ${price - s.coins}コイン` }) : null;
      const count = !isFish && it.inTank ? t.decor.filter((x) => x === it.id).length : 0;
      const src = isFish ? it.texture : it.icon;
      const pic = el('div', { class: 'pic' + (it.type === 'tank' ? ' tank-pic ' + it.water : '') },
        it.type === 'tank' ? el('img', { src, alt: '', onerror: (e) => { e.target.replaceWith(el('i')); } })
          : el('img', { src, alt: '', onerror: (e) => { e.target.replaceWith(el('span', { class: 'pic-alt', text: isFish ? (KIND_IC[it.kind] || '🐟') : '📦' })); } }));
      kids.push(el('button', {
        class: 'shop-item' + (locked ? ' locked-card' : '') + (c.ok ? '' : c.reason === 'coins' ? ' cant' : c.reason === 'have' || c.reason === 'max' ? ' owned' : ' locked'),
        'data-id': it.id,
        onclick: () => onPick(it, isFish),
      },
      pic,
      el('div', { class: 'nm', text: locked && isFish ? '？？？' : it.name }),
      locked ? el('div', { class: 'lock-line', text: '🔒 もうすこし' })
        : short ? short
        : it.uses ? el('div', { class: 'lock-line vit-note', text: `${it.uses}かいぶん・おなかは ふえないよ。げんきの もと` })
        : c.reason === 'needs' ? el('div', { class: 'lock-line', text: `${sim.data().itemById[c.item]?.name || ''}が いるよ` })
        : isFish ? el('div', { class: 'stars', text: stars(it.rarity || 1) }) : (count && it.max > 1 ? el('div', { class: 'tagline', text: `いれた かず ${count}/${it.max}` }) : null),
      !s.tutorial.done && tut?.recommend === it.id ? el('span', { class: 'rec', text: 'おすすめ' }) : null,
      s.tutorial.done && (isFish || it.water !== 'both') ? el('span', { class: 'water-tag ' + it.water, text: WATER[it.water] }) : null,
      isFish && !locked ? compatMark(t, it.id) : null,
      locked ? null : priceEl));
    }
  }
  list.replaceChildren(...kids);
  G.emit('shopRendered');
}

// いまの すいそうの 魚との 相性マーク（◎ なかよし／○ ふつう／× にがて）
function compatMark(t, id) {
  const c = G.sim.compatWithTank(t, id);
  if (c == null) return null;
  return el('span', { class: 'compat c' + c, text: ['× にがて', '○ ふつう', '◎ なかよし'][c] });
}

function reasonText(c, it) {
  const sim = G.sim, L = sim.data().SHOP_LINES || {};
  const name = it.name;
  switch (c.reason) {
    case 'coins': return sim.hintText('noCoins') || 'コインが たりないよ';
    case 'full': return sim.hintText('tankFull') || 'すいそうが いっぱいだよ';
    case 'max': return 'もう これいじょう いれられないよ';
    case 'have': return 'もう もっているよ';
    case 'water': return (it.water === 'salt' ? L.wrongWater : L.wrongWaterFresh || '').replaceAll('{name}', name) || 'この すいそうの みずには あわないよ';
    case 'needs': return (L.needs || '').replaceAll('{name}', name).replaceAll('{item}', sim.data().itemById[c.item]?.name || '');
    case 'locked': return L.locked || '1つめの すいそうに 6ぴき いると あえるよ';
    case 'snailFull': return L.snailFull || 'かいは 1つの すいそうに 2ひき までだよ。';
    case 'co2Salt': return L.co2Salt || 'かわの すいそうで つかうよ。';
    case 'skimmerFresh': return L.skimmerFresh || 'うみの すいそうで つかうよ。';
    case 'vitaminFull': return L.vitaminFull || 'まだ のこっているよ。';
    case 'tankMax': return L.tankMax || 'へやに すいそうが いっぱいだよ';
    default: return 'まだ うっていないよ';
  }
}

async function onPick(it, isFish) {
  if (G.tutorialLocks?.($(`#shop-list [data-id="${it.id}"]`))) return;
  const s = G.state, sim = G.sim, t = G.tank();
  const c = status(it, isFish);
  const price = sim.priceOf(s, it.id);
  const locked = c.reason === 'locked';
  const body = [
    el('img', { src: isFish ? it.texture : it.icon, alt: '', style: locked && isFish ? { filter: 'brightness(0) opacity(0.25)' } : {}, onerror: (e) => { e.target.replaceWith(el('div', { class: 'pic-alt', text: it.type === 'tank' ? '🫙' : isFish ? '🐟' : '📦' })); } }),
    el('div', { class: 'big', text: locked && isFish ? '？？？' : it.name }),
  ];
  if (isFish && !locked) {
    body.push(el('div', {}, el('span', { class: 'stars', text: stars(it.rarity || 1) }), ' ', el('span', { class: 'water-tag ' + it.water, text: WATER[it.water] })));
    body.push(el('div', { class: 'small', text: it.intro || '' }));
    if (it.temp) body.push(el('div', { class: 'small', text: `すきな みずの あたたかさ：${it.temp.min}〜${it.temp.max}ど` }));
  } else if (!locked) body.push(el('div', { class: 'small', text: it.desc || '' }));
  if (isFish && c.ok && sim.compatWithTank(t, it.id) === 0) {
    body.push(el('div', { text: sim.text('nigateConfirm', it.name), style: { marginTop: '6px', color: '#b4553f', fontSize: '15px' } }));
  }
  if (!c.ok) {
    body.push(el('div', { text: reasonText(c, it), style: { marginTop: '6px', color: '#b4553f' } }));
    await dialog(body, [{ label: 'とじる', value: false, kind: 'soft' }], { cancelValue: false });
    return;
  }
  // どの 水槽に 入るか を ことばで（水槽が 2つ以上 あるとき）
  if ((isFish || it.inTank) && s.tanks.length > 1) body.push(el('div', { class: 'small', style: { marginTop: '4px' } }, el('span', { class: 'water-tag ' + t.water, text: WATER[t.water] }), ` ${sim.tankName(s, t)}に いれるよ`));
  const yes = await dialog(body, [
    { label: 'やめる', value: false, kind: 'soft' },
    { label: price === 0 ? 'うけとる' : `かう（${price}）`, value: true, kind: 'primary' },
  ], { cancelValue: false });
  if (!yes) return;
  const r = isFish ? sim.buyFish(s, it.id, t) : sim.buyItem(s, it.id, t);
  if (!r.ok) { toast(reasonText(r, it)); return; }
  bumpCoins();
  // なかよしの あいてが いたら いっしょに ハート、すきな かざりなら くるっ（その すいそうを 見たとき）
  if (isFish && r.friends?.length) { G.queueReact(r.fish.uid, 'heart'); r.friends.forEach((u, i) => G.queueReact(u, 'heart', 150 * (i + 1))); }
  if (!isFish && r.fans?.length) r.fans.forEach((u, i) => G.queueReact(u, 'spin', 200 * i));
  if (isFish) toast(r.first ? `${it.name}が なかまに なったよ！ ずかんに のったよ` : `${it.name}が なかまに なったよ！`, 'gold');
  else if (it.type === 'tank') { toast(sim.data().SHOP_LINES?.newTank || 'あたらしい すいそうが へやに きたよ！', 'gold'); if (r.tank) G.setTank(r.tank.id); }
  else toast(it.inTank ? `${it.name}を すいそうに いれたよ` : `${it.name}を てに いれたよ`);
  G.markDirty(); G.saveNow();
  G.emit('changed');
  G.refreshHud();
  G.emit('action', isFish ? { type: 'buyFish', id: it.id, fish: r.fish } : { type: 'buyItem', id: it.id });
  G.handleEvents(r.events);
}
