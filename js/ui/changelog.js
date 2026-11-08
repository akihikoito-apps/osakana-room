// こうしん りれき（案内係）。あたらしい 版が うえ。いちばん うえは「いま これ」で ひらいた まま、
// ほかの 版は タイトルだけ（タップで ひらく）。なかみは js/data/changelog.js。
import { $, el } from './common.js';
import { CHANGELOG } from '../data/changelog.js';
import { moreCue } from './help.js';

let G = null;

export function init(g) {
  G = g;
  G.addScreen('changelog', { show });
  const b = $('#btn-log');
  if (b) b.hidden = false;
}

function show(g) {
  G = g;
  const box = $('#log-list');
  box.replaceChildren(...CHANGELOG.map((e, i) => {
    const now = i === 0;
    const card = el('article', { class: 'log-card' + (now ? ' newest open' : '') });
    const head = el('button', { class: 'log-head', 'aria-expanded': now ? 'true' : 'false' },
      el('span', { class: 'log-ver', text: 'v' + e.ver }),
      now ? el('span', { class: 'log-new', text: 'いま これ' }) : null,
      el('span', { class: 'log-date', text: (e.date || '').replaceAll('-', '/') }),
      el('span', { class: 'log-name', text: e.title }),
      now ? null : el('span', { class: 'log-more', 'aria-hidden': 'true', text: '▼' }));
    head.addEventListener('click', () => {
      if (now) return;
      const open = card.classList.toggle('open');
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      box._cueUpdate?.();
    });
    card.append(head, el('ul', { class: 'log-items' }, ...(e.items || []).map((t) => el('li', { text: t }))));
    return card;
  }));
  box.scrollTop = 0;
  moreCue(box);
}
