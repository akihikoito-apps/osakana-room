// v0.7 課金係：おみせの「✨ とくべつ」タブ（ほんものの おかねで かう コーナー）。しくみは js/iap.js。
// - 公開版（プロバイダ 'none'）：3しゅるいを「もうすぐ」で 見せるだけ。買う 道は ない。
// - ?iaptest：にせの 購入（おかねは うごかない・セーブは べつ）。上に「テスト」の おびを 出す。
// - 買う ながれ：カード → くわしく（ねだん「160えん」・おうちの ひとと いっしょに）→ おうちの ひとの かくにん（かけ算）→ ストア → なかまに なった
// 画面の 文字は ひらがな・カタカナだけ。
import { $, el, toast, dialog, stars } from './common.js';
import * as IAP from '../iap.js';

let G = null;
const WATER = { fresh: 'かわ', salt: 'うみ', pond: 'いけ' };

export function init(g) {
  G = g;
  if (IAP.isTest()) document.body.classList.add('iap-test');
  // 起動の とき、買ったのに いなかった 子を もどしたら おしらせ
  if (G.iapHealed?.length) {
    G.saveNow();
    setTimeout(() => toast(`とくべつな なかまが おやすみすいそうで まっているよ`, 'gold'), 1500);
  }
}

/** ショップの リスト（#shop-list）に とくべつ コーナーを かく */
export function renderPremium(g, list) {
  G = g;
  const s = G.state;
  const items = IAP.getProducts(s);
  const kids = [banner()];
  for (const p of items) kids.push(card(p));
  if (IAP.isAvailable()) kids.push(el('div', { class: 'pm-foot' }, el('span', { class: 'pm-foot-note', text: 'まえに かった いきものを もういちど うけとる ボタン（おかねは かからないよ）' }), el('button', { class: 'btn soft pm-restore', onclick: onRestore }, 'かった いきものを もどす')));
  list.replaceChildren(...kids);
}

function banner() {
  return el('div', { class: 'pm-banner', 'data-head': 'premium' },
    el('div', { class: 'pm-b-title' }, '✨ とくべつ コーナー'),
    el('div', { class: 'pm-b-text' }, 'ほんものの おかねで かう コーナーだよ。かう ときは おうちの ひとと いっしょに。'),
    IAP.isTest() ? el('div', { class: 'pm-test' }, 'テスト：おかねは うごかないよ（セーブも べつ）') : null);
}

function lineOf(p) {
  if (p.state === 'owned') return 'もう なかまだよ';
  if (p.state === 'soon') return 'もうすぐ かえるよ';
  if (p.state === 'needTank') return `${WATER[p.spec?.water] || ''}の すいそうが いるよ`;
  return 'ほんものの おかねで かうよ';
}

function card(p) {
  const sp = p.spec || {};
  return el('button', { class: 'shop-item pm-card pm-' + p.state, 'data-id': sp.id || p.speciesId, 'data-product': p.id, onclick: () => onPick(p.id) },
    el('div', { class: 'pic' }, el('img', { src: sp.texture, alt: '', onerror: (e) => { e.target.replaceWith(el('span', { class: 'pic-alt', text: '✨' })); } })),
    el('span', { class: 'pm-ribbon', text: 'とくべつ' }),
    el('div', { class: 'nm', text: sp.name || '' }),
    el('div', { class: 'stars', text: stars(sp.rarity || 1) }),
    el('div', { class: 'lock-line pm-line', text: lineOf(p) }),
    p.state === 'owned' ? el('span', { class: 'price pm-price owned', text: 'もってる' }) : el('span', { class: 'price pm-price', text: p.priceLabel }));
}

const current = (id) => IAP.getProducts(G.state).find((x) => x.id === id);

/** とくべつ コーナーの ダイアログ（ひくい 画面でも ボタンが 見える ように つめる：css/premium.css の body.pm-dlg） */
async function pmDialog(...args) {
  document.body.classList.add('pm-dlg');
  try { return await dialog(...args); } finally { document.body.classList.remove('pm-dlg'); }
}

async function onPick(productId) {
  const p = current(productId);
  if (!p) return;
  const sp = p.spec || {};
  const body = [
    el('img', { src: sp.texture, alt: '' }),
    el('div', { class: 'big', text: sp.name }),
    el('div', {}, el('span', { class: 'stars', text: stars(sp.rarity || 1) }), ' ', el('span', { class: 'water-tag ' + sp.water, text: WATER[sp.water] || '' })),
    el('div', { class: 'small', text: sp.intro || '' }),
  ];
  if (p.state === 'owned') {
    body.push(el('div', { class: 'pm-note', text: 'もう なかまだよ。1しゅるい 1ぴき だけ かえるよ。' }));
    await pmDialog(body, [{ label: 'とじる', value: false, kind: 'soft' }], { cancelValue: false });
    return;
  }
  body.push(el('div', { class: 'pm-yen' }, el('span', { class: 'pm-yen-n', text: p.priceLabel }), el('span', { class: 'pm-yen-sub', text: '（ほんものの おかね）' })));
  if (p.state === 'soon') {
    body.push(el('div', { class: 'pm-note', text: 'もうすぐ かえるように なるよ。たのしみに まっていてね。' }));
    await pmDialog(body, [{ label: 'とじる', value: false, kind: 'soft' }], { cancelValue: false });
    return;
  }
  if (p.state === 'needTank') {
    body.push(el('div', { class: 'pm-note warn', text: `${sp.name}は ${WATER[sp.water]}の すいそうで くらすよ。さきに ${WATER[sp.water]}の すいそうを よういしてね。` }));
    if (sp.water === 'pond') body.push(el('div', { class: 'small', text: 'いけの すいそうは ぼうけんが ひらくと かえるよ。' }));
    await pmDialog(body, [{ label: 'とじる', value: false, kind: 'soft' }], { cancelValue: false });
    return;
  }
  body.push(el('div', { class: 'pm-note', text: '1しゅるい 1ぴき だけ。おうちの ひとと いっしょに かってね。' }));
  if (IAP.isTest()) body.push(el('div', { class: 'pm-test', text: 'テスト：おかねは うごかないよ' }));
  const go = await pmDialog(body, [
    { label: 'やめる', value: false, kind: 'soft' },
    { label: 'おうちの ひとを よぶ', value: true, kind: 'primary pm-buy' },
  ], { cancelValue: false });
  if (!go) return;
  const token = await parentGate(p);
  if (!token) return;
  await doBuy(productId, token);
}

/** おうちの ひとの かくにん（かけ算）。とおったら token、やめたら・ちがったら null */
async function parentGate(p = null) {
  const g = IAP.makeGate();
  let input = '';
  const shown = el('div', { class: 'pg-input', 'aria-live': 'polite' });
  const draw = () => { shown.textContent = input || '　'; };
  const key = (k) => el('button', { class: 'pg-key', 'data-k': k, onclick: (e) => {
    e.stopPropagation();
    if (k === '⌫') input = input.slice(0, -1);
    else if (input.length < 3) input += k;
    draw();
  } }, k);
  const pad = el('div', { class: 'pg-pad' }, ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0'].map(key));
  draw();
  const body = [
    el('div', { class: 'pg-head', text: 'おうちの ひとへ' }),
    // 大人が なにに いくら はらうか を この 画面で たしかめられる ように（agy）。p が ない ときは もどす（復元）
    p ? el('div', { class: 'pg-what' }, el('b', { text: p.spec?.name || '' }), `　${p.priceLabel}（1かい きり・2かいめは かかりません）`)
      : el('div', { class: 'pg-what', text: 'まえに かった ものを もどします（おかねは かかりません）' }),
    el('div', { class: 'small', text: p ? 'かう ときは こたえを いれて「けってい」を おしてください。' : 'こたえを いれて「けってい」を おしてください。' }),
    el('div', { class: 'pg-q' }, `${g.a} × ${g.b} ＝ `, shown),
    pad,
  ];
  document.body.classList.add('pg-open');
  const ok = await pmDialog(body, [
    { label: 'やめる', value: false, kind: 'soft' },
    { label: 'けってい', value: true, kind: 'primary pg-ok' },
  ], { cancelValue: false });
  document.body.classList.remove('pg-open');
  if (!ok) return null;
  const token = IAP.passGate(g, input);
  if (!token) { toast('こたえが ちがうよ。おうちの ひとに きいてね'); return null; }
  return token;
}

async function doBuy(productId, token) {
  if (IAP.isBusy()) return;
  toast(IAP.isTest() ? 'テストの かいもの ちゅう…' : 'かいもの ちゅう…');
  const r = await IAP.purchase(G.state, productId, { gateToken: token, tankId: G.tank()?.id });
  $('#toasts')?.replaceChildren();   // 「かいもの ちゅう…」を けす（Codex）
  if (!r.ok) {
    const msg = { cancel: 'かうのを やめたよ', owned: 'もう なかまだよ', needTank: 'その すいそうが まだ ないよ', unavailable: 'いまは かえないよ', gate: 'もういちど おうちの ひとの かくにんを してね', busy: 'ちょっと まってね' }[r.reason] || 'いまは かえなかったよ。また あとで ためしてね';
    toast(msg);
    G.emit('changed');
    return;
  }
  G.saveNow();                     // すぐ セーブ（とりこぼし を へらす）
  G.handleEvents(r.events);
  G.emit('changed');
  G.refreshHud();
  G.emit('action', { type: 'premiumGet', id: r.spec.id, fish: r.fish });
  if (r.where === 'tank') G.queueReact?.(r.fish.uid, 'heart', 400);
  const where = r.where === 'tank' ? `${G.sim.tankName(G.state, r.tank)}に いるよ` : 'おやすみすいそうで まっているよ';
  await pmDialog([
    el('div', { class: 'pm-confetti', 'aria-hidden': 'true', text: '✨ 🎉 ✨' }),
    el('img', { src: r.spec.texture, alt: '' }),
    el('div', { class: 'big', text: `${r.spec.name}が なかまに なったよ！` }),
    el('div', { class: 'small', text: where }),
    r.first ? el('div', { class: 'small', text: 'ずかんに のったよ' }) : null,
  ].filter(Boolean), [{ label: 'やったー！', value: true, kind: 'primary' }]);
}

async function onRestore() {
  if (IAP.isBusy()) return;
  if (!(await parentGate(null))) return;   // ストアの アカウントを つかう ので おうちの ひとの かくにん（agy）
  toast('しらべて いるよ…');
  const r = await IAP.restore(G.state);
  $('#toasts')?.replaceChildren();
  if (!r.ok) { toast('いまは もどせなかったよ。また あとで ためしてね'); return; }
  if (!r.granted.length) { toast('もどす いきものは なかったよ'); G.emit('changed'); return; }
  G.saveNow();
  for (const g of r.granted) G.handleEvents(g.events);
  G.emit('changed');
  toast(`${r.granted.map((g) => g.spec.name).join('・')}が もどってきたよ！`, 'gold');
}
