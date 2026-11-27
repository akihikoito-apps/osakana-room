// v0.10 レース係：1レースの すすみ（DOM・GPU に よらない。テストでも 画面でも おなじ ものを つかう）。
//   const R = createRace({ level, player: { id, stats }, cpus: [{ id, stats }...], seed });
//   R.update(dt, input)  … input は プレイヤーの そうさ。auto: true なら プレイヤーも コンピューターが うごかす
//   R.phase：'count'（3・2・1）→ 'run' → 'done'（プレイヤーが ゴール、または みんな ゴール）
import { buildCourse, seeded } from './course.js';
import { makeRacer, step, collide, ranking, applyCatchup } from './physics.js';
import { makeBrain, decide, SKILL } from './ai.js';

export const COUNT_SEC = 3;
export const LANES = [-2.4, -0.8, 0.8, 2.4];   // スタートの ならび（プレイヤーは うしろの まんなか寄り）
export const AFTER_GOAL_MAX = 25;              // プレイヤーが ゴールして から まつ さいだい（秒。のこりは きょりで じゅんい）

export function createRace({ level = 'easy', player, cpus = [], seed = 1, course } = {}) {
  const c = course || buildCourse(level);
  const rnd = seeded(seed);
  const lanes = LANES.slice();
  // プレイヤーは 2れつめ（すこし うしろ）から。コンピューターは まえと よこ
  const order = [1, 0, 2, 3];
  const racers = [];
  const all = [{ ...player, isPlayer: true }, ...cpus.map((x) => ({ ...x, isPlayer: false }))];
  all.forEach((x, i) => {
    const lane = lanes[order[i % 4]];
    const back = x.isPlayer ? -2.2 : (i % 2 ? -1.0 : 0);
    const r = makeRacer({ id: x.id, stats: x.stats, lane, s: back, isPlayer: x.isPlayer });
    r.info = x;
    racers.push(r);
  });
  const skill = SKILL[level] ?? SKILL.normal;
  const brains = new Map();
  for (const r of racers) brains.set(r, makeBrain(r.isPlayer ? 0.85 : skill, seeded(Math.floor(rnd() * 1e9)), (rnd() * 2 - 1)));
  const R = {
    course: c, level, racers, brains, time: 0, phase: 'count', count: COUNT_SEC, events: [], doneAt: 0,
    get player() { return racers.find((r) => r.isPlayer); },
    rankOf(r) { return ranking(racers).indexOf(r) + 1; },
    standings() { return ranking(racers); },
    update(dt, input = {}) {
      dt = Math.min(Math.max(0, dt), 0.05);
      R.events = [];
      if (R.phase === 'count') {
        const before = Math.ceil(R.count);
        R.count -= dt;
        if (Math.ceil(R.count) !== before && R.count > 0) R.events.push({ type: 'count', n: Math.ceil(R.count) });
        if (R.count <= 0) { R.phase = 'run'; R.events.push({ type: 'go' }); }
        return R.events;
      }
      R.time += dt;
      if (R.phase === 'done') {
        // おわった あとも 見た目の ために すすめる（できごとは 出さない。じゅんいは もう きまっている）
        for (const r of racers) step(c, r, decide(c, r, brains.get(r), dt), dt, R.time);
        return R.events;
      }
      applyCatchup(racers, level, dt);
      for (const r of racers) {
        const inp = r.isPlayer && !input.auto ? input : decide(c, r, brains.get(r), dt);
        for (const e of step(c, r, inp, dt, R.time)) R.events.push({ type: e, id: r.id, player: r.isPlayer });
      }
      for (const [a, b] of collide(c, racers)) R.events.push({ type: 'bump', a, b });
      const me = R.player;
      if (me?.finished && !R.doneAt) R.doneAt = R.time;
      const allDone = racers.every((r) => r.finished);
      if (allDone || (R.doneAt && R.time - R.doneAt > (input.waitAll ? AFTER_GOAL_MAX : 0))) {
        R.phase = 'done';
        R.events.push({ type: 'done', rank: R.rankOf(me) });
      }
      return R.events;
    },
  };
  return R;
}

/** さいごまで 自動で はしらせる（テスト・ためし用）。maxSec を こえたら とめる */
export function simulate(opts, { maxSec = 400, dt = 1 / 60, waitAll = true } = {}) {
  const R = createRace(opts);
  let guard = 0;
  while (R.phase !== 'done' && guard++ < maxSec / dt) R.update(dt, { auto: true, waitAll });
  return R;
}
