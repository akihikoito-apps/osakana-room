// v0.10 レース係：コンピューターの 魚（DOM に よらない）。
// コースの すこし先を 見て、いわは ジャンプ か よける、かいそうは よける、あわの わは ねらう。
// うまさ（skill 0〜1）で ジャンプの タイミングの ずれ・ふらつき・ダッシュの つかいかたが かわる。
// ミスは 出走の ときに きめた 乱数で きまる（おなじ seed なら おなじ レース）。
import { obstaclesAhead, curvatureAt } from './course.js';
import { TUNE } from './physics.js';

export const SKILL = { easy: 0.45, normal: 0.7, hard: 0.9 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** コンピューター 1ぴきぶんの あたま */
export function makeBrain(skill, rnd = Math.random, lineBias = 0) {
  return {
    skill, rnd, lineBias,                 // lineBias：すきな はしり すじ（-1..1）
    wobbleT: rnd() * 10, wobbleF: 0.4 + rnd() * 0.5,
    jumpErr: 0, planned: null, ringTarget: null, dashHold: 0, think: 0, avoidSide: 0,
  };
}

/** そうさを きめる（input を かえす） */
export function decide(c, r, brain, dt = 1 / 60) {
  const b = brain, sk = b.skill;
  b.wobbleT += dt;
  if (r.finished) return { steer: 0, dash: false, jump: false };
  // いわに ぶつかって とまった：つぎは かならず とぶ（おなじ いわに ずっと ひっかからない）
  if (r.stun > 0 && b.planned) { b.planned.miss = false; b.planned.dodge = false; b.planned.err = 0; b.planned.retry = true; }
  const look = 10 + r.speed * 1.1;
  const ahead = obstaclesAhead(c, r.s, look);
  // ふだんの すじ：うちがわ寄り（うまい ほど）＋ 自分の すきな すじ ＋ ふらつき（へた ほど）
  const k = curvatureAt(c, r.s + 6);
  let target = clamp(-Math.sign(k) * Math.min(1, Math.abs(k) * 25) * c.half * 0.45 * sk + b.lineBias * c.half * 0.35, -c.half + 1, c.half - 1);
  target += Math.sin(b.wobbleT * b.wobbleF * 2) * (1 - sk) * 1.6;
  let jump = false;
  for (const { o, dist } of ahead) {
    if (dist < -0.5) continue;
    if (o.kind === 'rock') {
      const inLine = Math.abs(target - o.lat) < o.w + TUNE.radius + 0.4 || Math.abs(r.lat - o.lat) < o.w + TUNE.radius + 0.2;
      if (!inLine) continue;
      // よけるか とぶか（はじめて 見た ときに きめる）
      if (b.planned?.o !== o) {
        const room = c.half - Math.abs(o.lat) - o.w;   // いわの よこの すきま
        const dodge = room > 1.6 && b.rnd() < 0.5;
        // とぶ タイミングの ずれ（へた ほど 大きい）。早すぎ・おそすぎ で ぶつかる ことも ある
        b.planned = { o, dodge, err: (b.rnd() * 2 - 1) * (1 - sk) * 1.4, side: o.lat > 0 ? -1 : 1, miss: b.rnd() > 0.55 + sk * 0.45 };
      }
      const p = b.planned;
      if (p.dodge) { target = o.lat + p.side * (o.w + TUNE.radius + 1.0); }
      else if (!p.miss) {
        // ちょうど いわの 手前で とぶ（空中の 時間の まんなかが いわに くる ように）
        // ちょうてんの 時間（jumpV ÷ gravity）に いわの まんなかへ つく ように
        const at = Math.max(o.len + 0.6, r.speed * (r.d.jumpV / r.d.gravity) + p.err);
        if ((dist <= at || p.retry) && !r.air && r.stun <= 0) jump = true;
      }
      break;
    }
    if (o.kind === 'weed' && dist < 9 && Math.abs(target - o.lat) < o.w + 0.8) {
      const side = (o.lat >= 0 ? -1 : 1);
      if (b.rnd() < 0.02 + sk * 0.06 || b.avoidSide) { b.avoidSide = side; target = o.lat + side * (o.w + 1.0); }
    }
    if (o.kind === 'ring' && o.h < 1 && dist < look && sk > 0.3) {
      if (b.ringTarget !== o) b.ringTarget = b.rnd() < sk ? o : null;
      if (b.ringTarget === o) target = o.lat;
    }
  }
  if (!ahead.some(({ o }) => o.kind === 'weed')) b.avoidSide = 0;
  target = clamp(target, -c.half + 0.7, c.half - 0.7);
  // むき：すこし先で target に つくように
  const want = Math.atan2(target - r.lat, Math.max(4, r.speed * 0.9));
  const steer = clamp((want - r.yaw) * 3, -1, 1);
  // ダッシュ：まっすぐな ところで、ゲージが たまって いたら（うまい ほど よく つかう）
  b.think -= dt;
  if (b.think <= 0) {
    b.think = 0.5;
    const straight = Math.abs(curvatureAt(c, r.s + 10)) < 0.03;
    if (b.dashHold <= 0 && straight && r.dash > r.d.dashCap * 0.7 && b.rnd() < 0.15 + sk * 0.5) b.dashHold = r.d.dashCap * (0.4 + sk * 0.5);
  }
  let dash = false;
  if (b.dashHold > 0) { b.dashHold -= dt; dash = r.dash > 0.05; }
  return { steer, dash, jump };
}
