// v0.8 ゆめ係：とけい（HUD の 小さな まるい とけい・へやの かべの とけい）。
// ゲームの 1日＝げんじつ 10ぷん。はりと すうじは 5ふん きざみ（きりすて）で そろえる（Codex。1びょうで 2.4ぷん すすむので、こまかいと ちらつく）。
// すうじは 12じかんせい（「6:30」。となりの「あさ／ゆうがた／よる」で ひるか よるか わかる。Codex・agy）。
import { minuteOfDay, phaseOf, PHASE_LABEL } from '../state.js';

export const STEP_MIN = 5;

/** ゲームの min → { h12, h24, m（5ふん きざみ）, text: '6:30', phase } */
export function clockOf(min) {
  const md = Math.floor(minuteOfDay(min) / STEP_MIN) * STEP_MIN;
  const h24 = Math.floor(md / 60), m = md % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { h24, h12, m, text: `${h12}:${String(m).padStart(2, '0')}`, phase: phaseOf(min) };
}

/** よみあげ用の ことば：「あさの 6じ30ぷん」（ちょうどの ときは「6じ」） */
export function clockWords(min) {
  const c = clockOf(min);
  // 5ふん きざみ なので 10・20…は「ぷん」、5・15…は「ふん」
  return `${PHASE_LABEL[c.phase]}の ${c.h12}じ${c.m ? c.m + (c.m % 10 === 0 ? 'ぷん' : 'ふん') : ''}`;
}

/** はりの かくど（ど）。みじかい はりは ふんの ぶん すこし すすむ */
export function handAngles(min) {
  const c = clockOf(min);
  return { hour: ((c.h24 % 12) + c.m / 60) * 30, minute: c.m * 6 };
}

/**
 * まるい とけいの SVG（viewBox 0 0 100 100）。opts.ticks：12この めもり（かべ）か 4つ（HUD）。
 * かえす svg に update(min) が ついている。
 * （URL の 文字を ソースに かかない きまり（tests/safety）なので、SVG は HTML の 文字から つくる）
 */
export function makeClock({ className = '', ticks = 4, numbers = false } = {}) {
  let inner = '<circle cx="50" cy="50" r="47" class="ck-rim"/><circle cx="50" cy="50" r="41" class="ck-dial"/>';
  for (let i = 0; i < ticks; i++) {
    const big = (i * 12 / ticks) % 3 === 0;
    inner += `<line x1="50" y1="${big ? 13 : 14.5}" x2="50" y2="${big ? 21 : 18.5}" class="ck-tick${big ? ' big' : ''}" transform="rotate(${(i * 360) / ticks} 50 50)"/>`;
  }
  if (numbers) for (const [n, x, y] of [[12, 50, 31], [3, 71, 50], [6, 50, 70], [9, 29, 50]]) inner += `<text x="${x}" y="${y}" class="ck-num" text-anchor="middle" dominant-baseline="central">${n}</text>`;
  inner += '<line x1="50" y1="54" x2="50" y2="30" class="ck-hour"/><line x1="50" y1="56" x2="50" y2="18" class="ck-min"/><circle cx="50" cy="50" r="4.5" class="ck-pin"/>';
  const box = document.createElement('div');
  box.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true" class="clock-face ${className}">${inner}</svg>`;
  const svg = box.firstElementChild;
  const hour = svg.querySelector('.ck-hour'), minute = svg.querySelector('.ck-min');
  let last = null;
  svg.update = (min) => {
    const a = handAngles(min);
    const key = a.hour + '|' + a.minute;
    if (key === last) return;
    last = key;
    hour.setAttribute('transform', `rotate(${a.hour} 50 50)`);
    minute.setAttribute('transform', `rotate(${a.minute} 50 50)`);
    svg.dataset.phase = phaseOf(min);
  };
  return svg;
}
