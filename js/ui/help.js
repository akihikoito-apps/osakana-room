// ヘルプ（案内係）。ひだりに 7つの みだし、みぎに その なかみの カード。うしろは うみの え（assets/ui/help_bg.jpg）。
// なかみは js/data/help.js（数字は balance.js から つくる）。
import { $, el } from './common.js';
import { helpTopics } from '../data/help.js';

/** したに つづきが ある ときだけ「▼ つづき」を 出す（ヘルプ・りれき で つかう） */
export function moreCue(box) {
  // replaceChildren で けされるので、まいかい さいごに つけなおす。scroll の みはりは 1かいだけ
  const cue = box._cue ||= el('div', { class: 'more-cue', 'aria-hidden': 'true' }, el('span', { text: '▼ つづき' }));
  if (!box._cueBound) { box._cueBound = true; box.addEventListener('scroll', () => box._cueUpdate?.(), { passive: true }); }
  box.append(cue);
  const update = () => { cue.hidden = box.scrollTop + box.clientHeight >= box.scrollHeight - 6; };
  box._cueUpdate = update;
  requestAnimationFrame(() => box._cueUpdate?.());
  return update;
}

let G = null;
let current = null;

export function init(g) {
  G = g;
  G.addScreen('help', { show, hide });
  const b = $('#btn-help');
  if (b) b.hidden = false;
}

function cats() { return helpTopics(G.sim.balance?.() || {}); }

function show(g, opts = {}) {
  G = g;
  const list = cats();
  const id = opts.tab && list.some((c) => c.id === opts.tab) ? opts.tab : (current && list.some((c) => c.id === current) ? current : list[0].id);
  $('#help-nav').replaceChildren(...list.map((c) => el('button', {
    class: 'help-tab', 'data-tab': c.id, role: 'tab', onclick: () => pick(c.id),
  }, el('span', { class: 'help-tab-ic', 'aria-hidden': 'true', text: c.ic }), el('span', { class: 'help-tab-lb', text: c.label }))));
  pick(id);
}

function pick(id) {
  current = id;
  const c = cats().find((x) => x.id === id);
  for (const b of document.querySelectorAll('#help-nav .help-tab')) {
    const on = b.dataset.tab === id;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    if (on) b.scrollIntoView?.({ block: 'nearest' });
  }
  const body = $('#help-body');
  body.replaceChildren(
    el('div', { class: 'help-title' },
      c.pic ? el('img', { class: 'help-title-pic', src: c.pic, alt: '' }) : el('span', { class: 'help-title-ic', text: c.ic }),
      el('h3', { text: c.label })),
    ...c.topics.map((t) => el('section', { class: 'help-topic' },
      el('div', { class: 'help-h' },
        t.pic ? el('img', { class: 'help-h-pic', src: t.pic, alt: '' }) : el('span', { class: 'help-h-dot', 'aria-hidden': 'true' }),
        el('h4', { text: t.h })),
      el('ul', {}, ...t.lines.map((s) => el('li', { text: s }))),
      t.note ? el('p', { class: 'help-note' }, el('span', { class: 'help-note-lb', text: 'おうちの ひとへ' }), t.note) : null)),
  );
  body.scrollTop = 0;
  moreCue(body);
}

function hide() { /* なにも しない（つぎに ひらいた ときは さっきの みだし） */ }
