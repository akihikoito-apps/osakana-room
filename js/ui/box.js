// おやすみすいそう（v0.5 ゲーム係）：ポケモンの ボックスの ように 生きものを そのまま あずけておく ところ。
// - 入口：へやの「💤 おやすみすいそう」・すいそう画面の 魚カードの「おやすみすいそうへ」（G.toBoxAsk）
// - 中では 時間が すすまない（sim.tick は 水槽しか 見ない）。もどすのは 水が あって あきの ある 水槽だけ。
import { $, el, toast, dialog, STAGE_LABEL } from './common.js';

let G = null;
let filter = 'all';          // all か 水の しゅるい（fresh・salt・pond … WATERS）

// 水の なまえは balance の WATERS（かわ・うみ・いけ … これから ふえる）
const wname = (w) => G.sim.balance().WATERS?.[w]?.name || { fresh: 'かわ', salt: 'うみ' }[w] || 'みず';
const WATER_IC = { fresh: '🌿', salt: '🌊', pond: '🪷' };
const KIND_IC = { fish: '🐟', shrimp: '🦐', snail: '🐚' };

export function init(g) {
  G = g;
  G.addScreen('box', { show, hide() {} });
  G.toBoxAsk = toBoxAsk;
  const nav = () => { const b = $('#room-nav [data-go="box"]'); if (b) b.hidden = !G.state.tutorial.done; };
  nav();
  G.on('screen', nav);
  G.on('tutorialDone', nav);
  G.on('changed', () => { if (G.screen === 'box') render(); });
}

function show() { $('#toasts').replaceChildren(); render(); }   // まえの 画面の おしらせは けす

const spOf = (f) => G.data.fishById[f.speciesId] || {};

/** もどせない わけ（やさしい ことば） */
function reasonText(r, f) {
  const sp = spOf(f);
  switch (r.reason) {
    case 'water': return `${wname(sp.water)}の いきもの だよ`;
    case 'full': return 'いっぱい だよ';
    case 'snailFull': return 'かいが いっぱい だよ';
    case 'needs': return `${G.sim.data().itemById[r.item]?.name || ''}が いるよ`;
    default: return 'もどせないよ';
  }
}

function render() {
  const s = G.state;
  const box = s.box || [];
  const max = G.sim.boxMax();
  $('#box-count').textContent = box.length >= max ? `${box.length}ひき（いっぱい）` : `${box.length}ひき あずかって いるよ`;
  // タブ（ぜんぶ・かわ・うみ）
  const tabs = $('#box-tabs');
  const waters = Object.keys(G.sim.balance().WATERS || { fresh: 1, salt: 1 }).filter((w) => w === 'fresh' || w === 'salt' || box.some((f) => spOf(f).water === w));
  if (filter !== 'all' && !waters.includes(filter)) filter = 'all';
  tabs.replaceChildren(...[['all', 'ぜんぶ'], ...waters.map((w) => [w, `${WATER_IC[w] || '💧'} ${wname(w)}`])].map(([k, lb]) =>
    el('button', { class: 'tab' + (filter === k ? ' on' : ''), text: lb, onclick: () => { filter = k; render(); } })));
  // あたらしく あずけた じゅん
  const list = box.slice().reverse().filter((f) => filter === 'all' || spOf(f).water === filter);
  const grid = $('#box-list');
  if (!box.length) {
    grid.replaceChildren(el('div', { class: 'box-empty' },
      el('div', { class: 'be-ic', text: '💤' }),
      el('div', { text: 'まだ だれも いないよ' }),
      el('div', { class: 'small', text: 'すいそうで さかなを タップして「おやすみすいそうへ」を おすと あずけられるよ。そのままの すがたで まっていてくれるよ。' })));
    return;
  }
  if (!list.length) { grid.replaceChildren(el('div', { class: 'box-empty' }, el('div', { text: `${wname(filter)}の いきものは いないよ` }))); return; }
  grid.replaceChildren(...list.map((f) => {
    const sp = spOf(f);
    const canAny = G.sim.boxTargets(s, f.uid).some((x) => x.ok);
    return el('button', { class: 'box-item' + (canAny ? '' : ' no-room'), 'data-uid': f.uid, onclick: () => pick(f) },
      el('div', { class: 'pic' }, el('img', { src: sp.texture, alt: '', onerror: (e) => { e.target.replaceWith(el('span', { class: 'pic-alt', text: KIND_IC[sp.kind] || '🐟' })); } })),
      el('div', { class: 'nm', text: sp.name || '' }),
      el('div', { class: 'bx-tags' },
        el('span', { class: 'bx-stage s' + f.stage, text: STAGE_LABEL[f.stage] }),
        el('span', { class: 'water-tag ' + sp.water, text: wname(sp.water) })));
  }));
}

/** なつきの ハート（0〜5） */
function heartsOf(f) {
  const step = G.sim.balance().BOND?.heartStep || 20;
  const n = Math.max(0, Math.min(5, Math.floor((f.natsuki || 0) / step)));
  return el('span', { class: 'c-hearts bx-hearts' }, ...Array.from({ length: 5 }, (_, i) => el('i', { class: i < n ? 'on' : '' })));
}

async function pick(f) {
  const s = G.state, sim = G.sim, sp = spOf(f);
  const targets = sim.boxTargets(s, f.uid);
  const ok = targets.filter((x) => x.ok);
  const ng = targets.filter((x) => !x.ok);
  const body = [
    el('img', { src: sp.texture, alt: '' }),
    el('div', { class: 'big', text: sp.name || '' }),
    el('div', { class: 'bx-line' }, el('span', { class: 'bx-stage s' + f.stage, text: STAGE_LABEL[f.stage] }), ' ', el('span', { class: 'water-tag ' + sp.water, text: wname(sp.water) }), ' ', heartsOf(f)),
  ];
  if (ok.length) body.push(el('div', { class: 'small', text: 'どの すいそうに もどす？' }));
  else body.push(el('div', { class: 'small bx-warn', text: !s.tanks.some((t) => t.water === sp.water) ? `へやに ${wname(sp.water)}の すいそうが ないよ` : 'いまは もどせる すいそうが ないよ' }));
  if (ng.length) body.push(el('div', { class: 'bx-ng' }, ...ng.map((x) => el('div', { class: 'bx-ng-row' }, `${sim.tankName(s, x.tank)}には もどせないよ（${reasonText(x, f)}）`))));
  const v = await dialog(body, [
    ...ok.map((x) => ({ label: `${sim.tankName(s, x.tank)}へ もどす`, value: x.tank.id, kind: 'primary go-tank' })),
    { label: ok.length ? 'やめる' : 'とじる', value: null, kind: 'soft' },
  ]);
  if (!v) return;
  const t = s.tanks.find((x) => x.id === v);
  const r = sim.fromBox(s, f.uid, t);
  if (!r.ok) { toast(reasonText(r, f)); return; }
  toast(`${sp.name}が ${sim.tankName(s, t)}に もどったよ！`, 'gold');
  G.queueReact?.(f.uid, 'happy', 300);
  G.markDirty(); G.saveNow();
  G.emit('changed');
  G.emit('action', { type: 'fromBox', uid: f.uid });
  G.handleEvents(r.events);
}

/** すいそうの 魚カードから：おやすみすいそうへ うつす（たしかめて から） */
async function toBoxAsk(uid) {
  const s = G.state, sim = G.sim, t = G.tank();
  const f = t.fish.find((x) => x.uid === uid);
  if (!f) return false;
  const sp = spOf(f);
  const c = sim.canToBox(s, t, uid);
  if (!c.ok) { toast(c.reason === 'boxFull' ? 'おやすみすいそうが いっぱい だよ' : 'いまは うつせないよ'); return false; }
  const yes = await dialog([
    el('img', { src: sp.texture, alt: '' }),
    el('div', { class: 'big', text: `${sp.name}を おやすみすいそうへ うつす？` }),
    el('div', { class: 'small', text: 'そのままの すがたで まっていて くれるよ。いつでも すいそうに もどせるよ。' }),
  ], [{ label: 'やめる', value: false, kind: 'soft' }, { label: '💤 うつす', value: true, kind: 'primary' }], { cancelValue: false });
  if (!yes) return false;
  const r = sim.toBox(s, t, uid);
  if (!r.ok) return false;
  toast(`${sp.name}を おやすみすいそうに あずけたよ`, 'gold');
  G.markDirty(); G.saveNow();
  G.emit('changed');
  G.emit('action', { type: 'toBox', uid });
  G.handleEvents(r.events);
  return true;
}
