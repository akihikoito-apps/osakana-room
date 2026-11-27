// v0.10 のうりょく係：魚カードの「のうりょく」タブ（6かくの レーダー＋ぼう・とくい・ちょうし）。
// js/ui/tank.js の renderCard から よぶ。スマホ横（せまい カード）は ぼう だけ、ひろい 画面は レーダーも（css/stats.css）。
import { el } from './common.js';

const FACE = { good: '😊', ok: '😐', bad: '😟' };
const COLOR = { speed: '#3a9be0', accel: '#f0a020', stamina: '#3fb37a', turn: '#9a6fe0', jump: '#e0668a', power: '#d9603a' };

/** カードに「のうりょく」タブを 出すか（レースに でられる しゅるいの とき。おなかは かんけい なし） */
export function hasStats(sim, f) {
  if (!sim?.race || !f) return false;
  const r = sim.race.canRace(f);
  return r.ok || r.reason === 'hungry';
}

/** のうりょく タブの 中みの 要素の 配列 */
export function statsRows(sim, state, f) {
  const R = sim.race;
  const s = R.statsOf(state, f);
  const tk = R.tokuiOf(f);
  const cond = R.conditionOf(f);
  const cw = R.conditionWord(cond);
  const rows = [];
  rows.push(el('div', { class: 'st-tokui' },
    el('span', { class: 'st-tk-lb', text: 'とくい' }),
    el('span', { class: 'st-tk-word', text: tk.word })));
  const bars = el('div', { class: 'st-bars' }, ...R.STAT_KEYS.map((k) => el('div', { class: 'st-bar' + (k === tk.key ? ' tokui' : ''), 'data-k': k },
    el('span', { class: 'st-ic', text: R.STAT_ICONS[k], 'aria-hidden': 'true' }),
    el('span', { class: 'st-nm', text: R.STAT_NAMES[k] }),
    el('span', { class: 'st-track' }, el('i', { style: { width: Math.max(3, s[k]) + '%', background: COLOR[k] } })),
    el('b', { class: 'st-num', text: String(s[k]) }))));
  rows.push(el('div', { class: 'st-main' }, radar(R, s, tk.key), bars));
  rows.push(el('div', { class: 'c-row st-cond', 'data-lvl': cw.lvl },
    el('span', { class: 'c-lb', text: 'ちょうし' }),
    el('span', { class: 'c-face', text: FACE[cw.lvl] }),
    el('span', { class: 'c-word', text: cw.word })));
  const r = R.canRace(f);
  const note = r.reason === 'hungry' ? 'おなかが すいてると レースに でられないよ'
    : cw.lvl !== 'good' ? 'げんきに なると ちからが でるよ'
    : !f.dream && f.stage < 2 ? 'そだつと もっと つよく なるよ'
    : 'えいようの ある えさで もっと のびるよ';
  rows.push(el('div', { class: 'st-note', text: note }));
  return rows;
}

/** 6かくの レーダー（SVG の 文字で つくる）。ひろい 画面だけ 見える */
function radar(R, s, tokuiKey) {
  const N = R.STAT_KEYS.length, C = 60, RR = 40;
  const pt = (i, r) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / N; return [C + r * Math.cos(a), C + r * Math.sin(a)]; };
  const poly = (r) => R.STAT_KEYS.map((_, i) => pt(i, r(i)).map((v) => v.toFixed(1)).join(',')).join(' ');
  let h = '<svg viewBox="0 0 120 120" class="st-radar" aria-hidden="true">';
  for (const q of [1, 0.66, 0.33]) h += `<polygon class="st-grid" points="${poly(() => RR * q)}"/>`;
  R.STAT_KEYS.forEach((_, i) => { const [x, y] = pt(i, RR); h += `<line class="st-axis" x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; });
  h += `<polygon class="st-val" points="${poly((i) => RR * Math.max(0.04, s[R.STAT_KEYS[i]] / 100))}"/>`;
  R.STAT_KEYS.forEach((k, i) => { const [x, y] = pt(i, RR + 12); h += `<text class="st-rl${k === tokuiKey ? ' tokui' : ''}" x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle">${R.STAT_ICONS[k]}</text>`; });
  return el('span', { class: 'st-radar-box', html: h + '</svg>' });
}
