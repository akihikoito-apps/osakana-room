// しゃしん：ボタンを隠して水槽だけを見せる。レアな魚（★3 以上）がいるとキラキラの枠。
import { $, el, toast } from './common.js';

let G = null;
const RARE = 3;

export function init(g) {
  G = g;
  G.on('photo', enter);
  $('#photo-exit').addEventListener('click', exit);
  // 水槽を ふつうに タップしても もどれるよう、もどるボタンは 4びょうで うすくなる
}

function enter() {
  if (G.screen !== 'tank') return;
  document.body.classList.add('photo');
  const frame = $('#photo-frame');
  const rare = G.tank().fish.some((f) => (G.data.fishById[f.speciesId]?.rarity || 1) >= RARE);
  frame.classList.toggle('rare', rare);
  const sp = frame.querySelector('.sparkles');
  sp.replaceChildren();
  if (rare) {
    for (let i = 0; i < 18; i++) {
      const s = el('i');
      const side = i % 4, k = ((i * 37) % 100) / 100;
      const pos = [[k * 100, 0], [100, k * 100], [k * 100, 100], [0, k * 100]][side];
      s.style.left = pos[0] + '%'; s.style.top = pos[1] + '%';
      s.style.animationDelay = (i * 0.23) % 1.8 + 's';
      sp.append(s);
    }
  }
  const day = G.sim.gameDay(G.state.clock.min);
  frame.querySelector('.photo-stamp').textContent = `おさかなルーム　${day}にちめ`;
  frame.hidden = false;
  $('#photo-exit').hidden = false;
  toast('スクリーンショットで とってね');
  G.emit('action', { type: 'photo' });
}

export function exit() {
  document.body.classList.remove('photo');
  $('#photo-frame').hidden = true;
  $('#photo-exit').hidden = true;
}
