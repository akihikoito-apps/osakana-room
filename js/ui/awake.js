// 画面が 暗くならないように する（あそんでいる あいだ＝visible の あいだ だけ）。
// 1. Screen Wake Lock API（navigator.wakeLock.request('screen')）。すぐ 解除される ことが あるので、
//    visible に もどったとき・つぎに さわったときに とりなおす。
// 2. Wake Lock が ない／ことわられた ときだけ、予備として 音なし・黒の 小さな 動画（stay-awake.mp4、同梱）を
//    muted playsinline loop で ながす（いわゆる NoSleep 方式。古い iPad・ホーム画面アプリ 用）。
// 外部通信は しない。設定の オン／オフは なし（いつも オン）。
let lock = null;          // WakeLockSentinel
let video = null;         // 予備の 動画
let useVideo = false;     // Wake Lock が つかえないと わかった
let pending = false;
const visible = () => document.visibilityState === 'visible';

async function acquire() {
  if (!visible() || pending) return;
  if (!useVideo && 'wakeLock' in navigator) {
    if (lock && !lock.released) return;
    pending = true;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener?.('release', () => { lock = null; if (visible()) armGesture(); });
      stopVideo();
      return;
    } catch (e) {
      // NotAllowedError（さわる まえ・電池の せつやく など）は つぎに さわったとき もういちど。
      // つづけて ことわられたら 予備の 動画に きりかえる
      fails++;
      if (fails >= 2) useVideo = true;
    } finally { pending = false; }
    if (!useVideo) { armGesture(); return; }
  }
  playVideo();
}
let fails = 0;

function playVideo() {
  if (!video) {
    video = document.createElement('video');
    video.setAttribute('muted', ''); video.muted = true;
    video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', '');
    video.loop = true;
    video.setAttribute('aria-hidden', 'true');
    video.src = 'stay-awake.mp4';
    Object.assign(video.style, { position: 'fixed', left: '0', bottom: '0', width: '1px', height: '1px', opacity: '0.01', pointerEvents: 'none', zIndex: '-1' });
    document.body.append(video);
  }
  if (video.paused) video.play().catch(() => armGesture());
}
function stopVideo() { if (video && !video.paused) video.pause(); }

let armed = false;
function armGesture() {
  if (armed) return;
  armed = true;
  const go = () => { armed = false; ['pointerdown', 'keydown', 'touchend'].forEach((t) => window.removeEventListener(t, go, true)); acquire(); };
  ['pointerdown', 'keydown', 'touchend'].forEach((t) => window.addEventListener(t, go, true));
}

/** はじめに 1かい よぶ */
export function initAwake() {
  document.addEventListener('visibilitychange', () => {
    if (visible()) acquire();
    else stopVideo();          // うらに まわったら 予備の 動画も とめる（Wake Lock は ブラウザが はずす）
  });
  armGesture();                // さいしょの 操作で
  acquire();                   // さわる まえでも とれる ブラウザなら すぐ
}

/** 確認用 */
export const awakeState = () => ({ wakeLock: !!lock && !lock.released, video: !!video && !video.paused, useVideo });
