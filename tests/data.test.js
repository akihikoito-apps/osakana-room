// データの つながり・画面の 文字・版・オフラインの ファイル一覧 の テスト（点検係）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  read, exists, walk, KANJI, uiStrings, htmlTexts,
  FISH, ITEMS, balance, missions, hints, tutorial, SOLD_FISH, SOLD_ITEMS,
} from './_lib.js';
import { COMPAT, COMPAT_DEFAULT, compatOf } from '../js/data/compat.js';

const fishById = Object.fromEntries(FISH.map((f) => [f.id, f]));
const itemById = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// ---------------- id・参照 ----------------
test('魚と どうぐの id が かぶらない・形が そろっている', () => {
  const ids = [...FISH, ...ITEMS].map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, 'id が かぶっている');
  for (const f of FISH) {
    assert.match(f.id, /^[a-z_]+$/);
    assert.ok(Object.keys(balance.WATERS).includes(f.water), f.id);   // v0.6：balance.js WATERS（fresh・salt・pond …）
    assert.ok(f.temp.min < f.temp.max && f.temp.best >= f.temp.min && f.temp.best <= f.temp.max, `${f.id} temp`);
    assert.ok(Array.isArray(f.growDays) && f.growDays.length === 2 && f.growDays.every((d) => d > 0), `${f.id} growDays`);
    // v0.3：かい は space 0（べつ枠）。さかな・エビは 0 より 大きい
    if (f.kind === 'snail') assert.equal(f.space, 0, `${f.id} space`); else assert.ok(f.space > 0 && f.space <= balance.TANK.capacity, `${f.id} space`);
    assert.ok(f.rarity >= 1 && f.rarity <= 5, `${f.id} rarity`);
  }
  for (const i of ITEMS) assert.ok(['both', ...Object.keys(balance.WATERS)].includes(i.water), i.id);   // v0.6：tank_pond は 'pond'
});

test('魚の えさ id は items.js に ある・売っている魚は 売っている えさで たべられる', () => {
  for (const f of FISH) {
    for (const id of f.food) assert.equal(itemById[id]?.type, 'food', `${f.id} の えさ ${id}`);
  }
  for (const f of SOLD_FISH) assert.ok(f.food.some((id) => itemById[id].price != null), `${f.id} は いま 売っている えさを たべない`);
});

test('likes の タグは items.js の tag に ある・売っている魚は すきな 飾りを 買える', () => {
  const tags = new Set(ITEMS.map((i) => i.tag).filter(Boolean));
  for (const f of FISH) for (const tg of f.likes) assert.ok(tags.has(tg), `${f.id} の likes ${tg}`);
  for (const f of SOLD_FISH) {
    const ok = f.likes.some((tg) => SOLD_ITEMS.some((i) => i.tag === tg && (i.water === 'both' || i.water === f.water)));
    assert.ok(ok, `${f.id} の すきな 飾りが お店に ない`);
  }
});

test('相性表：v0.1 の 10しゅるいは すべての くみあわせが 書いてある・キーと 値が ただしい・淡水×海水は 書かない', () => {
  const v01 = ['medaka', 'guppy', 'neon_tetra', 'goldfish', 'corydoras', 'minami_shrimp', 'betta', 'angelfish', 'red_bee_shrimp', 'albino_corydoras'];
  const missing = [];
  for (let i = 0; i < v01.length; i++) for (let j = i; j < v01.length; j++) {
    const [a, b] = [v01[i], v01[j]].sort();
    if (!(`${a}|${b}` in COMPAT)) missing.push(`${a}|${b}`);
  }
  assert.deepEqual(missing, [], '表に ない くみあわせ');
  for (const [k, v] of Object.entries(COMPAT)) {
    const [a, b] = k.split('|');
    assert.ok(fishById[a] && fishById[b], `しらない id: ${k}`);
    assert.ok(a <= b, `キーの じゅんばん: ${k}`);
    assert.ok([0, 1, 2].includes(v), `${k}=${v}`);
    assert.equal(fishById[a].water, fishById[b].water, `淡水×海水が 書いてある: ${k}`);
  }
  assert.equal(compatOf('medaka', 'guppy'), compatOf('guppy', 'medaka'));
  assert.equal(compatOf('clownfish', 'medaka'), COMPAT_DEFAULT);
});

/** docs/相性表.md の 表（## ごと）を よむ。[{ title, rows: [[a, b, mark]] }] */
function docsTables() {
  const lines = read('docs/相性表.md').split('\n');
  const byName = Object.fromEntries(FISH.map((f) => [f.name, f.id]));
  const out = [];
  let head = null, cur = null;
  for (const l of lines) {
    if (/^##\s/.test(l)) { cur = { title: l.replace(/^#+\s*/, ''), rows: [], ids: [] }; out.push(cur); head = null; continue; }
    if (/^\|\s*\|/.test(l)) {
      head = l.split('|').slice(2, -1).map((x) => x.trim());
      if (!cur) { cur = { title: '(表)', rows: [], ids: [] }; out.push(cur); }
      cur.ids = head.map((n) => byName[n] || '?' + n);
      continue;
    }
    if (head && /^\|\s*\*\*/.test(l)) {
      const cells = l.split('|').slice(1, -1).map((x) => x.trim());
      const a = byName[cells[0].replace(/\*/g, '')] || '?' + cells[0];
      cells.slice(1).forEach((c, i) => cur.rows.push([a, cur.ids[i], c]));
    }
  }
  return out.filter((t) => t.rows.length);
}

test('相性表：docs/相性表.md の 表（淡水・海水）と compat.js が おなじ', () => {
  const mark = { '◎': 2, '○': 1, '×': 0 };
  const tables = docsTables();
  const diff = [], unknown = [], seen = new Set();
  for (const t of tables) for (const [a, b, c] of t.rows) {
    if (a.startsWith('?') || b.startsWith('?')) { unknown.push(`${t.title}: ${a} / ${b}`); continue; }
    seen.add(a); seen.add(b);
    if (mark[c] !== compatOf(a, b)) diff.push(`${fishById[a].name}×${fishById[b].name}（${[a, b].sort().join('|')}）: docs ${c} / compat.js ${compatOf(a, b)}`);
  }
  assert.deepEqual(unknown, [], 'docs に しらない なまえ');
  const asym = [];
  for (const t of tables) {
    const m = new Map(t.rows.map(([a, b, c]) => [a + '|' + b, c]));
    for (const [a, b, c] of t.rows) if (m.get(b + '|' + a) !== c) asym.push(`${t.title}: ${a}×${b} ${c} / ${b}×${a} ${m.get(b + '|' + a)}`);
  }
  assert.deepEqual([...new Set(asym)], [], 'docs の 表が たいしょうで ない');
  const notInDocs = SOLD_FISH.filter((f) => !seen.has(f.id)).map((f) => f.id);
  assert.deepEqual(notInDocs, [], 'docs の 表に ない 売りものの 魚');
  assert.deepEqual([...new Set(diff)], []);
});

test('売っている魚の 絵・売っている どうぐの アイコンが 実在する', () => {
  const miss = [];
  for (const f of SOLD_FISH) if (!exists(f.texture)) miss.push(f.texture);
  for (const i of SOLD_ITEMS) if (!exists(i.icon)) miss.push(i.icon);
  assert.deepEqual(miss, []);
});

test('texture の パスは assets/fish/<id>.png の 形', () => {
  for (const f of FISH) assert.equal(f.texture, `assets/fish/${f.id}.png`, f.id);
});

test('ミッション：id・order が かぶらない、goal の type が わかる もの、placeItem の id が 売っている', () => {
  const KNOWN = ['buyFish', 'fishCount', 'speciesCount', 'placeItem', 'feed', 'waterChange', 'scoop', 'pet', 'thanks', 'grow', 'natsuki', 'friends', 'allHealthy', 'days', 'zukan',
    'tankCreatures', 'unlock', 'kindCount', 'tankCount', 'hasTankWater', 'waterFishCount', 'hearts',
    'vitaminEat', 'gadgetCount',
    // v0.6（ゲーム係）
    'stat', 'bigCount', 'adultCount', 'creatures', 'boxCount', 'storageCount', 'decorCount', 'decorKinds', 'zukanWater', 'zukanRarity', 'tanksWater', 'quizBest'];
  const M = missions.MISSIONS;
  assert.equal(new Set(M.map((m) => m.id)).size, M.length);
  assert.equal(new Set(M.map((m) => m.order)).size, M.length);
  for (const m of M) {
    assert.ok(KNOWN.includes(m.goal.type), `${m.id} ${m.goal.type}`);
    assert.ok(m.reward.coin > 0, m.id);
    if (m.goal.type === 'placeItem') assert.ok(itemById[m.goal.id]?.price != null, `${m.id} の ${m.goal.id} は 売っていない`);
    if (m.goal.type === 'grow') assert.ok([1, 2].includes(m.goal.stage));
    if (m.goal.type === 'unlock') assert.ok(balance.UNLOCK[m.goal.id], `${m.id} の unlock ${m.goal.id}`);
    if (m.goal.type === 'kindCount') assert.ok(balance.SHOP_TABS.some((t) => t.kind === m.goal.kind), `${m.id} kind`);
    if (['hasTankWater', 'waterFishCount', 'zukanWater', 'tanksWater'].includes(m.goal.type)) assert.ok(['fresh', 'salt', 'pond'].includes(m.goal.water));   // v0.6：いけ も
    if (m.goal.type === 'zukan' && !m.gate) assert.ok(m.goal.count <= SOLD_FISH.length, `${m.id}: ずかん ${m.goal.count} は 売っている ${SOLD_FISH.length}しゅるい より 多い`);
  }
  assert.ok(missions.MISSION_VISIBLE >= 1);
});

test('ヒント：when.type と action が わかる もの・{like} は 飾りの なまえに なる', () => {
  const TYPES = ['noHeaterCold', 'tempLow', 'tempHigh', 'veryDirty', 'dirty', 'noPumpAirLow', 'airLow', 'hungry', 'leftover', 'lonelySchool', 'noLikedDecor', 'nigate', 'tankFull', 'noCoins',
    'airLowSalt', 'saltNoLiverock', 'unlockNear', 'tankEmpty',
    'fanCold', 'co2NoPlant', 'weakVitamin'];
  const ACTIONS = [null, 'shop', 'water_change', 'feed', 'scoop', 'thermo', 'vitamin'];
  assert.equal(new Set(hints.HINTS.map((h) => h.id)).size, hints.HINTS.length);
  for (const h of hints.HINTS) {
    assert.ok(TYPES.includes(h.when.type), `${h.id} ${h.when.type}`);
    assert.ok(ACTIONS.includes(h.action ?? null), `${h.id} action ${h.action}`);
    const vars = [...h.text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    for (const v of vars) assert.ok(['name', 'like', 'n'].includes(v), `${h.id} {${v}}`);
  }
});

test('チュートリアル：wait・target・魚・どうぐの id が ただしく、うけとる どうぐは プレゼント（0コイン）', () => {
  const T = tutorial.TUTORIAL;
  const WAITS = /^(tap|openShop|buyFish|openTank|feedEaten|buyItem:[a-z_]+)$/;
  const TARGETS = /^(shopButton|shopFish|tank|feedButton|meters|coins|helpButton|shopItem:[a-z_]+)$/;   // v0.6：helpButton
  for (const id of T.firstFish) assert.ok(fishById[id]?.price != null, `firstFish ${id}`);
  assert.ok(T.firstFish.includes(T.recommend));
  const firstMax = Math.max(...T.firstFish.map((id) => fishById[id].price));
  assert.ok(firstMax <= balance.START.coins, 'さいしょの コインで 魚が 買える');
  for (const s of T.steps) {
    assert.match(s.wait, WAITS, s.id);
    if (s.target != null) assert.match(s.target, TARGETS, s.id);
    if (s.wait.startsWith('buyItem:')) {
      const it = itemById[s.wait.slice(8)];
      assert.ok(it && it.price != null, `${s.id} の どうぐ`);
      assert.equal(it.tutorialFree, true, `${s.id}: ${it.id} が プレゼントで ない（コインが たりなく なる）`);
      assert.equal(s.target, 'shopItem:' + it.id, `${s.id} の target と wait が ちがう`);
    }
    if (s.give?.item) assert.ok(itemById[s.give.item], `${s.id} give`);
  }
});

test('はじめの お金で チュートリアルの あと 魚の 2ひきめが 買える', () => {
  const T = tutorial.TUTORIAL;
  const spent = fishById[T.recommend].price;
  const left = balance.START.coins - spent + (T.doneReward?.coin || 0);
  const cheapest = Math.min(...SOLD_FISH.map((f) => f.price));
  assert.ok(left >= cheapest, `のこり ${left}`);
});

test('けんこうの したの かぎりは 0 より 大きい（死なない）', () => {
  assert.ok(balance.HEALTH.min > 0);
  assert.equal(balance.HEALTH.min, 10);
});

// ---------------- 画面に 出る 文字に 漢字が ない ----------------
const UI_KEYS = new Set(['name', 'intro', 'hint', 'desc', 'title', 'text', 'say', 'speaker']);
function collectUi(val, path, out, all = false) {
  if (typeof val === 'string') { if (all) out.push([path, val]); return; }
  if (Array.isArray(val)) { val.forEach((v, i) => collectUi(v, `${path}[${i}]`, out, all)); return; }
  if (val && typeof val === 'object') for (const [k, v] of Object.entries(val)) collectUi(v, `${path}.${k}`, out, all || UI_KEYS.has(k));
}

test('data の 画面の 文字（name/intro/hint/desc/title/text/セリフ/ことば）に 漢字が ない', () => {
  const out = [];
  collectUi(FISH, 'FISH', out); collectUi(ITEMS, 'ITEMS', out);
  collectUi(missions.MISSIONS, 'MISSIONS', out);
  collectUi(hints.HINTS, 'HINTS', out);
  collectUi(tutorial.TUTORIAL, 'TUTORIAL', out);
  collectUi(balance.LABELS, 'LABELS', out, true);
  for (const [k, v] of Object.entries(hints)) if (k !== 'HINTS') collectUi(v, k, out, true);   // SHOP_LINES など
  collectUi(balance.UNLOCK.tank6.banner, 'UNLOCK.banner', out, true); collectUi(balance.UNLOCK.tank6.lockedLine, 'UNLOCK.lockedLine', out, true);
  for (const k of ['doneLine', 'restLine']) collectUi(balance.HEART[k], 'HEART.' + k, out, true);
  collectUi(balance.SHOP_TABS.map((t) => t.label), 'SHOP_TABS', out, true); collectUi(balance.WATER_LABELS, 'WATER_LABELS', out, true); collectUi(balance.HEART_LABEL, 'HEART_LABEL', out, true);
  assert.ok(out.length > 100, `しらべた 文字が すくない ${out.length}`);
  const bad = out.filter(([, s]) => KANJI.test(s)).map(([p, s]) => `${p}: ${s}`);
  assert.deepEqual(bad, []);
});

test('index.html の 画面の 文字に 漢字が ない', () => {
  const bad = htmlTexts(read('index.html')).filter((s) => KANJI.test(s));
  assert.deepEqual(bad, []);
});

test('js/ui・main.js・sim.js・state.js・aquarium の 文字列（console を のぞく）に 漢字が ない', () => {
  const files = [...walk('js/ui'), 'js/main.js', 'js/sim.js', 'js/state.js', ...walk('js/aquarium'), ...(exists('js/bgm.js') ? ['js/bgm.js'] : [])];
  const bad = [];
  for (const f of files) for (const s of uiStrings(read(f))) if (KANJI.test(s.text)) bad.push(`${f}:${s.line}: ${s.text}`);
  assert.deepEqual(bad, []);
});

test('manifest.json の なまえ・せつめいに 漢字が ない', () => {
  const m = JSON.parse(read('manifest.json'));
  for (const k of ['name', 'short_name', 'description']) assert.ok(!KANJI.test(m[k] || ''), `${k}: ${m[k]}`);
});

test('文字列の とりだしが はたらいている（じぶんの テスト）', () => {
  const got = uiStrings("const a = 'あ'; // '漢字'\n/* \"字\" */ const b = `い${x ? 'う' : \"え\"}お`; const r = /'[^']*'/g;\nconsole.log('漢')")
    .map((s) => s.text);
  assert.deepEqual(got, ['あ', 'い', 'う', 'え', 'お']);
  assert.ok(KANJI.test('魚') && !KANJI.test('さかな サカナ ー！？'));
});

// ---------------- 版・オフライン ----------------
test('js/version.js と sw.js の 版が おなじ', () => {
  const v1 = read('js/version.js').match(/VERSION\s*=\s*'([^']+)'/)[1];
  const v2 = read('sw.js').match(/const VERSION\s*=\s*'([^']+)'/)[1];
  assert.equal(v1, v2);
  assert.match(v1, /^\d+\.\d+\.\d+$/);
});

function swFiles() {
  const src = read('sw.js');
  const body = src.match(/const FILES\s*=\s*\[([\s\S]*?)\];/)[1];
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('sw.js の キャッシュ一覧の ファイルが ぜんぶ 実在する・かぶりが ない', () => {
  const files = swFiles();
  assert.equal(new Set(files).size, files.length, 'かぶり');
  const miss = files.filter((f) => f !== './' && !exists(f));
  assert.deepEqual(miss, []);
});

test('sw.js の キャッシュ一覧に 必要な ファイルが もれていない（js・vendor・css・アイコン・つかう 絵）', () => {
  const files = new Set(swFiles());
  const need = new Set(['index.html', 'manifest.json']);
  for (const f of walk('js', (p) => p.endsWith('.js'))) need.add(f);
  for (const f of walk('vendor')) need.add(f);
  for (const f of walk('css')) need.add(f);
  for (const ic of JSON.parse(read('manifest.json')).icons) need.add(ic.src);
  // ソースに 書いてある 絵の パス（ある ものだけ）
  const srcs = ['index.html', 'css/style.css', ...walk('js', (p) => p.endsWith('.js'))];
  for (const f of srcs) for (const m of read(f).matchAll(/(?:assets\/[\w\/.-]+\.(?:png|jpg|jpeg|webp|svg)|icon-\d+\.png)/g)) if (exists(m[0])) need.add(m[0]);
  for (const f of SOLD_FISH) need.add(f.texture);
  for (const i of SOLD_ITEMS) need.add(i.icon);
  const miss = [...need].filter((f) => !files.has(f));
  assert.deepEqual(miss, []);
});

test('index.html が よぶ ファイル（script・link・img）が 実在する', () => {
  const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
  const refs = [...html.matchAll(/\s(?:src|href)="([^"#?]+)/g)].map((m) => m[1]);
  assert.ok(refs.length > 5);
  const miss = refs.filter((r) => !exists(r));
  assert.deepEqual(miss, []);
});

test('js の import の さきが 実在する', () => {
  const miss = [];
  for (const f of walk('js', (p) => p.endsWith('.js'))) {
    const dir = f.split('/').slice(0, -1).join('/');
    for (const m of read(f).matchAll(/(?:import\s[^'"]*?from\s*|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const parts = (dir + '/' + m[1]).split('/');
      const out = [];
      for (const p of parts) { if (p === '.' || p === '') continue; if (p === '..') out.pop(); else out.push(p); }
      const target = out.join('/');
      if (!exists(target)) miss.push(`${f} → ${m[1]}`);
    }
  }
  assert.deepEqual(miss, []);
});

// ---------------- v0.2 の データ ----------------
test('v0.2：新しい 生きもの 15しゅるいの 絵・すいそうと サンゴの アイコンが 実在する', () => {
  const NEW = ['ishimaki', 'ramshorn', 'platy', 'cherry_barb', 'otocinclus', 'rummy_nose', 'dwarf_gourami', 'shittaka', 'blue_damsel', 'clownfish', 'skunk_shrimp', 'firefish', 'yellow_tang', 'blue_tang', 'mandarin'];
  for (const id of NEW) assert.ok(fishById[id]?.price != null, `${id} が 売られていない`);
  const miss = NEW.map((id) => fishById[id].texture).filter((p) => !exists(p));
  for (const id of ['tank_fresh', 'tank_salt', 'coral', 'liverock']) if (!exists(itemById[id].icon)) miss.push(itemById[id].icon);
  assert.deepEqual(miss, []);
});

test('v0.2：kind は SHOP_TABS の どれか・unlock は UNLOCK の キー・needs は おなじ水の 売りもの・見出しが はじめから からっぽに ならない', () => {
  const kinds = balance.SHOP_TABS.map((t) => t.kind);
  for (const f of SOLD_FISH) {
    assert.ok(kinds.includes(f.kind), `${f.id} kind ${f.kind}`);
    if (f.unlock) assert.ok(balance.UNLOCK[f.unlock], `${f.id} unlock ${f.unlock}`);
    for (const n of f.needs || []) { const it = itemById[n]; assert.ok(it?.price != null && (it.water === 'both' || it.water === f.water), `${f.id} needs ${n}`); }
  }
  for (const i of SOLD_ITEMS) if (i.unlock) assert.ok(balance.UNLOCK[i.unlock], `${i.id} unlock`);
  for (const k of kinds) assert.ok(SOLD_FISH.some((f) => f.kind === k && f.water === 'fresh' && !f.unlock), `見出し「${k}」が はじめ から からっぽ`);
});

test('v0.2：すいそうの しなもの（tank_fresh 800・tank_salt 1000・includes は ある 器具）', () => {
  assert.equal(itemById.tank_fresh.price, 800);
  assert.equal(itemById.tank_salt.price, 1000);
  for (const id of ['tank_fresh', 'tank_salt']) {
    assert.equal(itemById[id].type, 'tank');
    assert.equal(itemById[id].unlock, 'tank6');
    for (const inc of itemById[id].includes) assert.ok(itemById[inc]?.inTank, `${id} includes ${inc}`);
  }
  assert.equal(itemById.tank_salt.water, 'salt');
  assert.equal(itemById.tank_fresh.water, 'fresh');
});

test('v0.2：ハートの 歯止めの 数値（72ふん＝現実30びょう・1日20こ・けんこう40）', () => {
  assert.equal(balance.HEART.perFishEveryGameMinutes, 72);
  assert.equal(balance.HEART.perDay, 20);
  assert.equal(balance.HEART.need.health, 40);
  assert.equal(balance.HEART.perFishEveryGameMinutes * balance.TIME.realSecPerGameDay / 1440, balance.BOND.petCooldownRealSec);
});

test('js と sw.js の ファイルが ぜんぶ 文法エラー なし（ブラウザで ひらけなく なる ことを ふせぐ）', async () => {
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'osakana-check-'));
  const bad = [];
  try {
    for (const f of [...walk('js', (p) => p.endsWith('.js')), 'sw.js']) {
      const tmp = join(dir, f.split('/').join('_') + (f === 'sw.js' ? '.cjs' : '.mjs'));
      writeFileSync(tmp, read(f));
      const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
      if (r.status !== 0) bad.push(`${f}: ${(r.stderr.match(/SyntaxError[^\n]*/) || [''])[0]} ${(r.stderr.match(/:(\d+)\n/) || ['', '?'])[1]}ぎょうめ`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  assert.deepEqual(bad, []);
});
