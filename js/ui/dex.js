// ずかん：持ったことのある魚は絵、まだの魚はシルエット。コンプリート率。
import { $, el, dialog, stars, RARITY_LABEL } from './common.js';
import { sizeParams } from '../size.js';   // v0.6 個体差（個体差係）

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
      el('div', { class: 'pic' }, el('img', { src: f.texture, alt: '' }), ...badges(f.id)),
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
      ...sizeLines(f),
      likes.length ? el('div', { class: 'small', text: `すきな もの：${likes.join('、')}` }) : null,
      friends.length ? el('div', { class: 'small', text: `なかよし：${friends.slice(0, 4).join('、')}${friends.length > 4 ? ` ほか ${friends.length - 4}しゅるい` : ''}` }) : null,
      nigate.length ? el('div', { class: 'small', text: `にがて：${nigate.slice(0, 4).join('、')}${nigate.length > 4 ? ` ほか ${nigate.length - 4}しゅるい` : ''}` }) : null,   // ながく なりすぎない ように 4つまで
      el('div', { class: 'small', text: `ビタミン：${(G.state.dex[f.id]?.vitaminTried || G.state.vitaminSeen?.[f.id]) ? (G.sim.data().VITAMIN_DEX?.[f.vitamin || 'ok'] || '') : '？'}` }),
      f.hint ? el('div', { class: 'small', text: '💡 ' + f.hint }) : null,
    );
  }
  await dialog(body.filter(Boolean), [{ label: 'とじる', value: true, kind: 'soft' }]);
}

// ---------- v0.6 個体差：おうかん・キラキラ・おおきさの きろく（個体差係）----------
/** えの すみの しるし：👑（上位10% の おおきさの 子を ビッグまで そだてた／手に入れた）・✨（キラキラ。2ひき いじょうは かず） */
function badges(id) {
  const d = G.state.dex[id];
  if (!d) return [];
  const out = [];
  if (d.crown) out.push(el('span', { class: 'dex-crown', title: 'おうかん', text: '👑' }));
  if (d.shiny > 0) out.push(el('span', { class: 'dex-shiny', title: 'キラキラ', text: d.shiny > 1 ? '✨' + d.shiny : '✨' }));
  return out;
}
const cm = (x) => String(Math.round(x * 10) / 10);   // カードと おなじ 0.1 きざみ
/** しょうさい：おおきさの めやす・きろく・おうかん・キラキラ */
function sizeLines(f) {
  const d = G.state.dex[f.id] || {};
  const P = sizeParams(f);
  const r = (x) => String(Math.round(x));
  const lines = [el('div', { class: 'small', text: `おおきさ：ちびっこ ${cm(P.stages[0])} → おとな ${cm(P.stages[1])} → ビッグ ${r(P.min)}〜${r(P.max)} センチ` })];
  if (Number.isFinite(d.maxCm)) {
    if (d.minCm === d.maxCm) lines.push(el('div', { class: 'small dex-rec', text: `📏 ビッグに そだった こ：${cm(d.maxCm)}cm` }));
    else lines.push(el('div', { class: 'small dex-rec' }, el('span', { class: 'nw', text: `📏 いちばん おおきい ${cm(d.maxCm)}cm` }), ' ', el('span', { class: 'nw', text: `いちばん ちいさい ${cm(d.minCm)}cm` })));
  } else lines.push(el('div', { class: 'small dex-rec', text: '📏 ビッグに そだてると おおきさが きろく されるよ' }));
  if (d.crown) lines.push(el('div', { class: 'small dex-rec', text: '👑 おうかん サイズを そだてたよ！' }));
  if (d.shiny > 0) lines.push(el('div', { class: 'small dex-rec', text: `✨ キラキラの こ：${d.shiny}ひき` }));
  return lines;
}
