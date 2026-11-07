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
    assert.ok(['fresh', 'salt'].includes(f.water), f.id);
    assert.ok(f.temp.min < f.temp.max && f.temp.best >= f.temp.min && f.temp.best <= f.temp.max, `${f.id} temp`);
    assert.ok(Array.isArray(f.growDays) && f.growDays.length === 2 && f.growDays.every((d) => d > 0), `${f.id} growDays`);
    assert.ok(f.space > 0 && f.space <= balance.TANK.capacity, `${f.id} space`);
    assert.ok(f.rarity >= 1 && f.rarity <= 5, `${f.id} rarity`);
  }
  for (const i of ITEMS) assert.ok(['both', 'fresh', 'salt'].includes(i.water), i.id);
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

test('相性表：売っている魚の すべての くみあわせ（同じ種類も）が 書いてある・キーと 値が ただしい', () => {
  const sold = SOLD_FISH.map((f) => f.id);
  const missing = [];
  for (let i = 0; i < sold.length; i++) for (let j = i; j < sold.length; j++) {
    const [a, b] = [sold[i], sold[j]].sort();
    if (!(`${a}|${b}` in COMPAT)) missing.push(`${a}|${b}`);
  }
  assert.deepEqual(missing, [], '表に ない くみあわせ');
  for (const [k, v] of Object.entries(COMPAT)) {
    const [a, b] = k.split('|');
    assert.ok(fishById[a] && fishById[b], `しらない id: ${k}`);
    assert.ok(a <= b, `キーの じゅんばん: ${k}`);
    assert.ok([0, 1, 2].includes(v), `${k}=${v}`);
  }
  assert.equal(compatOf('medaka', 'guppy'), compatOf('guppy', 'medaka'));
  assert.equal(compatOf('clownfish', 'medaka'), COMPAT_DEFAULT);
});

test('相性表：docs/相性表.md の 表と compat.js が おなじ', () => {
  const md = read('docs/相性表.md');
  const rows = md.split('\n').filter((l) => /^\|\s*\*\*/.test(l));
  const head = md.split('\n').find((l) => /^\|\s*\|/.test(l)).split('|').slice(2, -1).map((s) => s.trim());
  const byName = Object.fromEntries(FISH.map((f) => [f.name, f.id]));
  const mark = { '◎': 2, '○': 1, '×': 0 };
  const diff = [];
  for (const r of rows) {
    const cells = r.split('|').slice(1, -1).map((s) => s.trim());
    const a = byName[cells[0].replace(/\*/g, '')];
    assert.ok(a, `docs の 行 ${cells[0]}`);
    cells.slice(1).forEach((c, i) => {
      const b = byName[head[i]];
      assert.ok(b, `docs の 列 ${head[i]}`);
      if (mark[c] !== compatOf(a, b)) diff.push(`${a}×${b}: docs ${c} / compat ${compatOf(a, b)}`);
    });
  }
  assert.equal(rows.length, SOLD_FISH.length);
  assert.deepEqual(diff, []);
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
  const KNOWN = ['buyFish', 'fishCount', 'speciesCount', 'placeItem', 'feed', 'waterChange', 'scoop', 'pet', 'thanks', 'grow', 'natsuki', 'friends', 'allHealthy', 'days', 'zukan'];
  const M = missions.MISSIONS;
  assert.equal(new Set(M.map((m) => m.id)).size, M.length);
  assert.equal(new Set(M.map((m) => m.order)).size, M.length);
  for (const m of M) {
    assert.ok(KNOWN.includes(m.goal.type), `${m.id} ${m.goal.type}`);
    assert.ok(m.reward.coin > 0, m.id);
    if (m.goal.type === 'placeItem') assert.ok(itemById[m.goal.id]?.price != null, `${m.id} の ${m.goal.id} は 売っていない`);
    if (m.goal.type === 'grow') assert.ok([1, 2].includes(m.goal.stage));
  }
  assert.ok(missions.MISSION_VISIBLE >= 1);
});

test('ヒント：when.type と action が わかる もの・{like} は 飾りの なまえに なる', () => {
  const TYPES = ['noHeaterCold', 'tempLow', 'tempHigh', 'veryDirty', 'dirty', 'noPumpAirLow', 'airLow', 'hungry', 'leftover', 'lonelySchool', 'noLikedDecor', 'nigate', 'tankFull', 'noCoins'];
  const ACTIONS = [null, 'shop', 'water_change', 'feed', 'scoop'];
  assert.equal(new Set(hints.HINTS.map((h) => h.id)).size, hints.HINTS.length);
  for (const h of hints.HINTS) {
    assert.ok(TYPES.includes(h.when.type), `${h.id} ${h.when.type}`);
    assert.ok(ACTIONS.includes(h.action ?? null), `${h.id} action ${h.action}`);
    const vars = [...h.text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    for (const v of vars) assert.ok(['name', 'like'].includes(v), `${h.id} {${v}}`);
  }
});

test('チュートリアル：wait・target・魚・どうぐの id が ただしく、うけとる どうぐは プレゼント（0コイン）', () => {
  const T = tutorial.TUTORIAL;
  const WAITS = /^(tap|openShop|buyFish|openTank|feedEaten|buyItem:[a-z_]+)$/;
  const TARGETS = /^(shopButton|shopFish|tank|feedButton|meters|coins|shopItem:[a-z_]+)$/;
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
  for (const [k, v] of Object.entries(hints)) if (typeof v === 'string' || k === 'HAPPY_LINES') collectUi(v, k, out, true);
  assert.ok(out.length > 100, `しらべた 文字が すくない ${out.length}`);
  const bad = out.filter(([, s]) => KANJI.test(s)).map(([p, s]) => `${p}: ${s}`);
  assert.deepEqual(bad, []);
});

test('index.html の 画面の 文字に 漢字が ない', () => {
  const bad = htmlTexts(read('index.html')).filter((s) => KANJI.test(s));
  assert.deepEqual(bad, []);
});

test('js/ui・main.js・sim.js・state.js・aquarium の 文字列（console を のぞく）に 漢字が ない', () => {
  const files = [...walk('js/ui'), 'js/main.js', 'js/sim.js', 'js/state.js', ...walk('js/aquarium')];
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
