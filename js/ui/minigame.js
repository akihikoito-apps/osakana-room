// ミニゲーム（v0.5 ゲーム係）。ハートを つかって あそび、せいかいの かずで コインが もらえる。
// いまは「さかな あて クイズ」1つ。GAMES に 足せば ふやせる（start(G) で はじめて、画面は #mg-body に かく）。
// - ハートは state.hearts だけ へる（これまでに あつめた heartsTotal は へらない）。
// - とちゅうの 問題は state.quiz に のこる。へやに もどっても・とじても つづきから。
import { $, el, toast, bumpCoins } from './common.js';

let G = null;
let lock = false;            // こたえた あとの えんしゅつ中
let nextTimer = 0;

const GAMES = [
  { id: 'quiz', ic: '🐟', name: 'さかな あて クイズ', desc: 'えを みて なまえを あてよう', rule: () => G.sim.quizRule(), start: startQuiz },
];

export function init(g) {
  G = g;
  G.addScreen('minigame', { show, hide });
  const nav = () => { const b = $('#room-nav [data-go="minigame"]'); if (b) b.hidden = !G.state.tutorial.done; };
  nav();
  G.on('screen', nav);
  G.on('tutorialDone', nav);
}

function show() {
  lock = false;
  $('#toasts').replaceChildren();      // まえの 画面の おしらせを けす
  if (G.state.quiz) renderQuestion(); else renderMenu();
}
function hide() { clearTimeout(nextTimer); lock = false; }

const heartIc = () => el('span', { class: 'heart-ic sm', 'aria-hidden': 'true' });
const coinIc = () => el('span', { class: 'coin-ic sm', 'aria-hidden': 'true' });

// ---------- えらぶ 画面 ----------
function renderMenu() {
  const s = G.state;
  const body = $('#mg-body');
  body.className = 'mg-menu';
  body.replaceChildren(...GAMES.map((g) => {
    const R = g.rule();
    const cost = R.cost ?? 10, n = R.questions ?? 5;
    const can = G.sim.canPlayQuiz(s);
    const max = n * (R.coinPerCorrect ?? 10) + (R.perfectBonus ?? 0);
    return el('div', { class: 'mg-card' },
      el('div', { class: 'mg-ic', text: g.ic }),
      el('div', { class: 'mg-info' },
        el('div', { class: 'mg-name', text: g.name }),
        el('div', { class: 'mg-desc', text: `${g.desc}。${n}もん` }),
        el('div', { class: 'mg-prize' }, 'せいかい 1もん ', coinIc(), `${R.coinPerCorrect ?? 10}`, R.perfectBonus ? el('span', {}, '・ぜんもん せいかいで ＋', coinIc(), `${R.perfectBonus}`) : null),
        el('div', { class: 'mg-best', text: s.stats.quizBest != null ? `さいこう きろく ${s.stats.quizBest}／${n}もん` : 'はじめて あそぶよ！' })),
      el('div', { class: 'mg-go' },
        el('button', { class: 'btn primary mg-play' + (can.ok ? '' : ' cant'), onclick: () => onPlay(g) }, 'あそぶ ', el('span', { class: 'mg-cost' }, heartIc(), `${cost}`, el('small', { text: 'つかう' }))),
        can.ok ? el('div', { class: 'mg-max' }, 'さいだい ', coinIc(), `${max}`) : el('div', { class: 'mg-short', text: `ハートが あと ${can.need}こ` })));
  }), el('div', { class: 'mg-tip' }, heartIc(), ' ハートは さかなを なでると たまるよ（いま ', el('b', { text: String(s.hearts || 0) }), 'こ）'));
}

function onPlay(g) {
  const can = G.sim.canPlayQuiz(G.state);
  if (!can.ok) { toast(can.reason === 'hearts' ? `ハートが あと ${can.need}こ たりないよ。さかなを なでて あつめよう` : 'いまは あそべないよ'); return; }
  g.start();
}

// ---------- クイズ ----------
function startQuiz() {
  const r = G.sim.startQuiz(G.state);
  if (!r.ok) { renderMenu(); return; }
  G.refreshHud();
  G.markDirty(); G.saveNow();
  G.emit('action', { type: 'minigame', id: 'quiz' });
  renderQuestion();
}

function renderQuestion() {
  const q = G.state.quiz;
  if (!q) { renderMenu(); return; }
  if (q.i >= q.qs.length) { finish(); return; }
  const cur = q.qs[q.i];
  const sp = G.data.fishById[cur.answer] || {};
  const body = $('#mg-body');
  body.className = 'mg-play-area';
  const dots = el('div', { class: 'qz-dots' }, ...q.qs.map((x, i) => el('i', { class: i < q.i ? (x.pick === x.answer ? 'ok' : 'ng') : i === q.i ? 'now' : '' })));
  body.replaceChildren(
    el('div', { class: 'qz-left' },
      el('div', { class: 'qz-top' }, el('span', { class: 'qz-n', text: `${q.i + 1}／${q.qs.length}もんめ` }), dots),
      el('div', { class: 'qz-pic' }, el('img', { src: sp.texture, alt: '', draggable: 'false' }), el('div', { class: 'qz-mark', hidden: true }))),
    el('div', { class: 'qz-right' },
      el('div', { class: 'qz-ask', text: 'この こは だれかな？' }),
      ...cur.choices.map((id) => el('button', { class: 'qz-choice', 'data-id': id, text: G.data.fishById[id]?.name || '', onclick: (e) => onAnswer(id, e.currentTarget) })),
      el('div', { class: 'qz-after', hidden: true })),
  );
}

function onAnswer(id, btn) {
  if (lock) return;
  lock = true;
  const r = G.sim.answerQuiz(G.state, id);
  if (!r.ok) { lock = false; return; }
  G.markDirty(); G.saveNow();
  const body = $('#mg-body');
  const right = body.querySelector(`.qz-choice[data-id="${r.answer}"]`);
  const mark = body.querySelector('.qz-mark');
  const pic = body.querySelector('.qz-pic');
  body.querySelectorAll('.qz-choice').forEach((b) => { b.disabled = true; b.classList.add('done'); });
  right.classList.add('right');
  mark.hidden = false;
  const name = G.data.fishById[r.answer]?.name || '';
  if (r.right) {
    mark.className = 'qz-mark ok';
    mark.replaceChildren(el('span', { class: 'qz-ring' }), el('span', { class: 'qz-word', text: 'せいかい！' }));
    pic.classList.add('jump');
    sparkle(pic);
    nextTimer = setTimeout(next, 1300);
  } else {
    btn.classList.add('wrong');
    mark.className = 'qz-mark ng';
    mark.replaceChildren(el('span', { class: 'qz-word', text: 'おしい！' }));
    pic.classList.add('wiggle');
    const after = body.querySelector('.qz-after');
    after.hidden = false;
    after.replaceChildren(el('div', { class: 'qz-teach' }, 'この こは ', el('b', { text: name }), ' だよ'),
      el('button', { class: 'btn primary qz-next', text: r.last ? 'けっかを みる' : 'つぎへ ▶', onclick: next }));
  }
}

function next() {
  clearTimeout(nextTimer);
  lock = false;
  renderQuestion();
}

/** せいかいの ときの キラキラ */
function sparkle(box) {
  const wrap = el('div', { class: 'qz-sparks' });
  for (let i = 0; i < 10; i++) {
    const p = el('i', { text: ['✨', '⭐', '💖'][i % 3] });
    const a = (i / 10) * Math.PI * 2;
    p.style.setProperty('--x', Math.cos(a) * 90 + 'px');
    p.style.setProperty('--y', Math.sin(a) * 70 + 'px');
    p.style.animationDelay = (i % 3) * 40 + 'ms';
    wrap.append(p);
  }
  box.append(wrap);
  setTimeout(() => wrap.remove(), 1200);
}

function finish() {
  const r = G.sim.finishQuiz(G.state);
  if (!r.ok) { renderMenu(); return; }
  if (r.coin) bumpCoins();
  G.refreshHud();
  G.markDirty(); G.saveNow();
  G.emit('changed');
  G.handleEvents(r.events);
  const perfect = r.correct >= r.total;
  const R = G.sim.quizRule();
  const can = G.sim.canPlayQuiz(G.state);
  const word = perfect ? 'ぜんもん せいかい！ すごい！' : r.correct >= Math.ceil(r.total / 2) ? 'よく できたね！' : 'また ちょうせん してね！';
  const body = $('#mg-body');
  body.className = 'mg-result';
  body.replaceChildren(el('div', { class: 'qz-res' + (perfect ? ' perfect' : '') },
    el('div', { class: 'qr-ic', text: perfect ? '🏆' : r.correct ? '🎉' : '🐟' }),
    el('div', { class: 'qr-score' }, `${r.total}もん ちゅう `, el('b', { text: String(r.correct) }), 'もん せいかい'),
    el('div', { class: 'qr-word', text: word }),
    el('div', { class: 'qr-coin' }, '＋', coinIc(), `${r.coin} コイン`),
    r.newBest ? el('div', { class: 'qr-best', text: '🌟 さいこう きろく！' }) : null,
    el('div', { class: 'qr-btns' },
      el('button', { class: 'btn soft', text: 'おわる', onclick: () => G.go('room') }),
      el('button', { class: 'btn primary' + (can.ok ? '' : ' cant'), onclick: () => onPlay(GAMES[0]) }, 'もういちど ', el('span', { class: 'mg-cost' }, heartIc(), `${R.cost ?? 10}`, el('small', { text: 'つかう' })))),
    can.ok ? null : el('div', { class: 'mg-short', text: `ハートが あと ${can.need}こ で また あそべるよ` })));
  if (perfect) sparkle(body.querySelector('.qz-res'));
}
