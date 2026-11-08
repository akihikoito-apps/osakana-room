// プレイヤー（v0.5 ゲーム係）：これまでに あつめた ハート（heartsTotal）を 大きく。ほかの きろくも ならべる。
import { $, el } from './common.js';

let G = null;

export function init(g) {
  G = g;
  G.addScreen('player', { show, hide() {} });
  const nav = () => { const b = $('#btn-player'); if (b) b.hidden = !G.state.tutorial.done; };
  nav();
  G.on('screen', nav);
  G.on('tutorialDone', nav);
  G.on('tick', () => { if (G.screen === 'player') render(); });
}

function show() { $('#toasts').replaceChildren(); render(); }   // まえの 画面の おしらせは けす

const fmt = (n) => String(Math.max(0, Math.floor(n || 0)));

/** 画面に 出す かず（テストからも 見られるように export） */
export function playerStats(g = G) {
  const s = g.state, sim = g.sim;
  const all = sim.allCreatures(s);
  const dexAll = g.data.FISH.filter((f) => f.price != null).length;
  return {
    heartsTotal: s.heartsTotal || 0,
    hearts: s.hearts || 0,
    coins: s.coins || 0,
    days: sim.gameDay(s.clock.min),
    creatures: all.length,
    inBox: (s.box || []).length,
    big: all.filter((f) => f.stage === 2).length,
    dex: Object.keys(s.dex || {}).filter((id) => g.data.fishById[id]?.price != null).length,
    dexAll,
    quizBest: s.stats.quizBest,
    quizN: sim.quizRule().questions ?? 5,
    pets: s.stats.pet || 0,
  };
}

function render() {
  const p = playerStats();
  const tile = (ic, lb, val, sub, key) => el('div', { class: 'pl-tile', 'data-k': key },
    el('div', { class: 'pl-ic', text: ic }),
    el('div', { class: 'pl-lb', text: lb }),
    el('div', { class: 'pl-val' }, val),
    sub ? el('div', { class: 'pl-sub', text: sub }) : null);
  $('#player-body').replaceChildren(
    el('div', { class: 'pl-hero' },
      el('div', { class: 'pl-hero-ic' }, el('span', { class: 'heart-ic' })),
      el('div', { class: 'pl-hero-body' },
        el('div', { class: 'pl-hero-lb', text: 'これまでに あつめた ハート' }),
        el('div', { class: 'pl-hero-n' }, el('b', { text: fmt(p.heartsTotal) }), el('span', { text: 'こ' })),
        el('div', { class: 'pl-hero-sub', text: 'ミニゲームで つかっても へらないよ' }))),
    el('div', { class: 'pl-grid' },
      tile('💗', 'いまの ハート', fmt(p.hearts) + 'こ', null, 'hearts'),
      tile('🪙', 'いまの コイン', fmt(p.coins), null, 'coins'),
      tile('📅', 'あそんだ ひ', fmt(p.days) + 'にち', null, 'days'),
      tile('🐟', 'いっしょに いる いきもの', fmt(p.creatures) + 'ひき', p.inBox ? `かりすいそう ${p.inBox}ひき` : null, 'creatures'),
      tile('🌟', 'ビッグの なかま', fmt(p.big) + 'ひき', null, 'big'),
      tile('📖', 'ずかん', `${p.dex}／${p.dexAll}`, null, 'dex'),
      tile('🎮', 'クイズ さいこう', p.quizBest != null ? `${p.quizBest}／${p.quizN}もん` : 'まだ', null, 'quiz'),
      tile('🤚', 'なでた かず', fmt(p.pets) + 'かい', null, 'pets')),
  );
}
