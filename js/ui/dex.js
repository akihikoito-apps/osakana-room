// ずかん：持ったことのある魚は絵、まだの魚はシルエット。コンプリート率。
import { $, el, dialog, stars, RARITY_LABEL } from './common.js';

let G = null;
export function init(g) { G = g; }

/** ずかんに のせる 魚（いまの版で てに はいる もの＝お店に ある もの） */
function dexList() { return G.data.FISH.filter((f) => f.price != null); }

export function show(g) {
  G = g;
  const list = dexList();
  const got = list.filter((f) => G.state.dex[f.id]).length;
  const pct = list.length ? Math.floor((got / list.length) * 100) : 0;
  $('#dex-rate').replaceChildren(`みつけた ${got}／${list.length}`, el('span', { class: 'rate-bar', title: pct + '%' }, el('i', { style: { width: pct + '%' } })));
  $('#dex-list').replaceChildren(...list.map((f) => {
    const have = !!G.state.dex[f.id];
    return el('button', { class: 'dex-item' + (have ? '' : ' unknown'), onclick: () => detail(f, have) },
      el('div', { class: 'pic' }, el('img', { src: f.texture, alt: '' })),
      el('div', { class: 'nm', text: have ? f.name : '？？？' }),
      el('div', { class: 'stars', text: stars(f.rarity || 1) }));
  }));
}

async function detail(f, have) {
  const body = [el('img', { src: f.texture, alt: '', style: have ? {} : { filter: 'brightness(0) opacity(0.25)' } })];
  if (!have) {
    body.push(el('div', { class: 'big', text: '？？？' }), el('div', { class: 'small', text: `${RARITY_LABEL[f.rarity] || ''}　おみせで みつけてみよう` }));
  } else {
    const likes = (f.likes || []).map((tag) => G.data.ITEMS.find((i) => i.tag === tag && i.price != null)?.name).filter(Boolean);
    const friends = G.data.FISH.filter((o) => o.price != null && o.id !== f.id && G.data.compatOf(f.id, o.id) === 2).map((o) => o.name);
    const nigate = G.data.FISH.filter((o) => o.price != null && G.data.compatOf(f.id, o.id) === 0).map((o) => o.name);
    body.push(
      el('div', { class: 'big', text: f.name }),
      el('div', { class: 'stars', text: stars(f.rarity || 1) + '　' + (RARITY_LABEL[f.rarity] || '') }),
      el('div', { class: 'small', text: f.intro || '' }),
      el('div', { class: 'small', text: `みずの あたたかさ：${f.temp?.min}〜${f.temp?.max}ど（${f.temp?.best}どが すき）` }),
      el('div', { class: 'small', text: `おおきさ：${(f.sizeCm || []).join(' → ')} センチ` }),
      likes.length ? el('div', { class: 'small', text: `すきな もの：${likes.join('、')}` }) : null,
      friends.length ? el('div', { class: 'small', text: `なかよし：${friends.join('、')}` }) : null,
      nigate.length ? el('div', { class: 'small', text: `にがて：${nigate.join('、')}` }) : null,
      f.hint ? el('div', { class: 'small', text: '💡 ' + f.hint }) : null,
    );
  }
  await dialog(body.filter(Boolean), [{ label: 'とじる', value: true, kind: 'soft' }]);
}
