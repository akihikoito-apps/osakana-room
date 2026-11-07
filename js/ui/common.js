// 画面の部品（おしらせ・ダイアログ・コインの ポップ など）。
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}

export function coinIcon() { return el('span', { class: 'coin-ic', 'aria-hidden': 'true' }); }

export function toast(text, kind = '') {
  const box = $('#toasts');
  const t = el('div', { class: 'toast ' + kind, text });
  box.append(t);
  while (box.children.length > 1) box.firstChild.remove();   // かさならない ように いちどに 1つ
  setTimeout(() => t.remove(), 2700);
}

let dialogResolve = null;
/**
 * ダイアログ。buttons: [{ label, value, kind }]。押したボタンの value を返す。
 * 外側を押すと cancelValue（なければ null）。
 */
export function dialog(body, buttons = [{ label: 'OK', value: true, kind: 'primary' }], { cancelValue = null } = {}) {
  const m = $('#dialog');
  if (dialogResolve) dialogResolve(cancelValue);
  const bodyEl = $('.modal-body', m);
  bodyEl.replaceChildren(...(Array.isArray(body) ? body : [body]).map((b) => (typeof b === 'string' ? el('div', { text: b }) : b)));
  const btns = $('.modal-btns', m);
  btns.replaceChildren();
  return new Promise((resolve) => {
    dialogResolve = (v) => { dialogResolve = null; m.hidden = true; resolve(v); };
    for (const b of buttons) {
      btns.append(el('button', { class: 'btn ' + (b.kind || ''), text: b.label, 'data-v': String(b.value), onclick: (e) => { e.stopPropagation(); dialogResolve?.(b.value); } }));
    }
    m.onclick = (e) => { if (e.target === m) dialogResolve?.(cancelValue); };
    m.hidden = false;
  });
}
export const dialogOpen = () => !$('#dialog').hidden;

/** 水槽の上に「+3」などを出す（x,y は canvas 基準の CSS px）。 */
export function popAt(x, y, html, cls = 'pop-coin') {
  const box = $('#tank-pops');
  const p = el('div', { class: cls, html });
  p.style.left = x + 'px'; p.style.top = y + 'px';
  box.append(p);
  setTimeout(() => p.remove(), 1500);
  return p;
}

export function bumpCoins() {
  const c = $('#hud-coins');
  c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
}

export const STAGE_LABEL = ['ちびっこ', 'おとな', 'ビッグ'];
export const stars = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
export const RARITY_LABEL = { 1: 'ふつう', 2: 'すこし めずらしい', 3: 'めずらしい', 4: 'とても めずらしい', 5: 'でんせつ' };
