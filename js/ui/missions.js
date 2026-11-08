// ミッション一覧：いま出ている 5つ（v0.6。lane ごとに アイコンの いろを かえる）。おわったら「もらう」でごほうび。
import { $, el, toast, coinIcon, bumpCoins } from './common.js';

let G = null;
// あそびの しゅるい（lane）ごとの アイコン
const LANE_IC = { care: '🍙', grow: '🌱', zukan: '📖', room: '🫙', play: '💗' };
export function init(g) {
  G = g;
  G.on('sim', (ev) => {
    if (ev.type !== 'mission') return;
    const m = G.data.MISSIONS.find((x) => x.id === ev.id);
    if (m) toast(`⭐ ミッション クリア！「${m.title}」`, 'gold');
    G.refreshHud();
    if (G.screen === 'missions') render();
  });
}

export function claimableCount(g) {
  const s = g.state;
  if (!s.tutorial.done) return 0;
  return g.sim.visibleMissions(s).filter((m) => s.missions.done[m.id] && !s.missions.claimed[m.id]).length;
}

export function show(g) { G = g; $('#toasts').replaceChildren(); render(); }

function render() {
  const s = G.state, sim = G.sim;
  const box = $('#mission-list');
  if (!s.tutorial.done) { box.replaceChildren(el('div', { class: 'mission' }, el('div', { class: 'm-body', text: 'さいしょの おせわが おわったら でてくるよ' }))); return; }
  const list = sim.visibleMissions(s);
  if (!list.length) { box.replaceChildren(el('div', { class: 'mission' }, el('span', { class: 'm-ic', text: '🏆' }), el('div', { class: 'm-body', text: 'ぜんぶ クリア！ すごいね！' }))); return; }
  box.replaceChildren(...list.map((m) => {
    const p = sim.missionProgress(s, m);
    const done = !!s.missions.done[m.id];
    const right = done
      ? el('button', { class: 'btn primary', onclick: () => claim(m) }, 'もらう ', coinIcon(), String(m.reward?.coin || 0))
      : el('span', { class: 'm-reward' }, coinIcon(), String(m.reward?.coin || 0));
    const ic = done ? '🌟' : LANE_IC[m.lane] || '⭐';
    const count = p.need > 1 && !done ? el('span', { class: 'm-count', text: `${Math.min(p.now, p.need)}／${p.need}` }) : null;
    return el('div', { class: 'mission' + (done ? ' done' : ''), 'data-lane': m.lane || 'care', 'data-id': m.id },
      el('span', { class: 'm-ic', text: ic }),
      el('div', { class: 'm-body' },
        el('div', { class: 'm-title', text: m.title }),
        el('div', { class: 'm-prog' }, el('span', { text: m.desc }), count, el('span', { class: 'm-face', text: done ? '😊 できた！' : p.now / p.need >= 0.5 ? '🙂 あとすこし' : '🌱 これから' })),
        el('div', { class: 'm-bar' }, el('i', { style: { width: (done ? 100 : (p.now / p.need) * 100) + '%' } }))),
      right);
  }));
}

function claim(m) {
  const r = G.sim.claimMission(G.state, m.id);
  if (!r.ok) return;
  toast(`+${r.coin} コイン ゲット！`, 'gold');
  bumpCoins();
  G.markDirty(); G.saveNow();
  G.refreshHud();
  G.handleEvents(r.events);
  render();
}
