// テストの共通部品（点検係）。npm の依存なし。node だけで動く。
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const read = (p) => readFileSync(join(ROOT, p), 'utf8');
export const exists = (p) => existsSync(join(ROOT, p));

/** ROOT からの相対パスで、dir の下の ファイルを ぜんぶ（/ 区切り） */
export function walk(dir, filter = () => true) {
  const out = [];
  const go = (d) => {
    for (const name of readdirSync(join(ROOT, d))) {
      const p = d ? d + '/' + name : name;
      if (statSync(join(ROOT, p)).isDirectory()) go(p);
      else if (filter(p)) out.push(p);
    }
  };
  go(dir);
  return out;
}
export const rel = (abs) => relative(ROOT, abs).split(sep).join('/');

// ---------------- 文字 ----------------
// 漢字（CJK 統合漢字・拡張A・互換・々〆ヶ は ひらがな カタカナで ないので 漢字あつかい）
export const KANJI = /[㐀-䶿一-鿿豈-﫿々〆ヶ]|[\ud840-\ud87f][\udc00-\udfff]/u;

/**
 * JS の ソースから 文字列リテラル（'…' "…" `…` の 文字の 部分）を とりだす。コメントは とばす。
 * かえす：[{ text, line, lineText }]
 */
export function jsStrings(src) {
  const out = [];
  const lines = src.split('\n');
  let i = 0, line = 1;
  const n = src.length;
  let lastSig = '';           // さいごの 意味のある 文字（正規表現か わり算かの 見わけ）
  const push = (text, ln) => out.push({ text, line: ln, lineText: lines[ln - 1] || '' });
  function adv() { if (src[i] === '\n') line++; i++; }
  function readQuote(q) {
    const ln = line; let s = '';
    adv();
    while (i < n && src[i] !== q) {
      if (src[i] === '\\') { adv(); s += src[i] ?? ''; adv(); continue; }
      if (src[i] === '\n') break;
      s += src[i]; adv();
    }
    adv();
    push(s, ln);
  }
  function readTemplate() {
    let ln = line; let s = '';
    adv();
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { adv(); s += src[i] ?? ''; adv(); continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        if (s) push(s, ln);
        s = ''; adv(); adv();
        scan(true);                 // ${ … } の なか
        ln = line;
        continue;
      }
      s += src[i]; adv();
    }
    adv();
    if (s) push(s, ln);
  }
  function readRegex() {
    adv();
    let inClass = false;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { adv(); adv(); continue; }
      if (c === '\n') break;
      if (c === '[') inClass = true; else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) { adv(); break; }
      adv();
    }
    while (i < n && /[a-z]/i.test(src[i])) adv();
  }
  function scan(untilBrace) {
    let depth = 0;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') adv(); continue; }
      if (c === '/' && d === '*') { adv(); adv(); while (i < n && !(src[i] === '*' && src[i + 1] === '/')) adv(); adv(); adv(); continue; }
      if (c === "'" || c === '"') { readQuote(c); lastSig = 'a'; continue; }
      if (c === '`') { readTemplate(); lastSig = 'a'; continue; }
      if (c === '/') {
        const kw = /(?:^|[^\w$])(return|typeof|case|in|of|void|delete)\s*$/.test(src.slice(Math.max(0, i - 12), i));
        if (!lastSig || '(,=:[!&|?{};+-*%<>~^'.includes(lastSig) || kw) { readRegex(); lastSig = 'a'; continue; }
      }
      if (untilBrace) {
        if (c === '{') depth++;
        else if (c === '}') { if (depth === 0) { adv(); return; } depth--; }
      }
      if (!/\s/.test(c)) lastSig = c;
      adv();
    }
  }
  scan(false);
  return out;
}

/** console.* の 行（画面に 出ない）は のぞいた 文字列 */
export const uiStrings = (src) => jsStrings(src).filter((s) => !/console\.\w+\(/.test(s.lineText));

/** HTML の 画面に 出る 文字（本文・alt・aria-label・title・placeholder）。コメント・script・style は のぞく */
export function htmlTexts(html) {
  const body = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const texts = [];
  for (const m of body.matchAll(/\s(?:alt|aria-label|title|placeholder|content)="([^"]*)"/g)) texts.push(m[1]);
  for (const m of body.replace(/<[^>]*>/g, '\n').split('\n')) if (m.trim()) texts.push(m.trim());
  return texts;
}

// ---------------- ゲームの 準備 ----------------
import * as sim from '../js/sim.js';
import * as S from '../js/state.js';
import { FISH } from '../js/data/fish.js';
import { ITEMS } from '../js/data/items.js';
import { compatOf } from '../js/data/compat.js';
import * as balance from '../js/data/balance.js';
import * as missions from '../js/data/missions.js';
import * as hints from '../js/data/hints.js';
import * as tutorial from '../js/data/tutorial.js';

export { sim, S, FISH, ITEMS, compatOf, balance, missions, hints, tutorial };

export function setupSim() {
  return sim.setup({ FISH, ITEMS, compatOf, balance, missions, hints, tutorial });
}

/** 新しい セーブ（チュートリアルは おわった ことに する） */
export function freshState({ tutorialDone = true, coins } = {}) {
  setupSim();
  const st = S.newState(sim.initialValues());
  sim.normalize(st);
  st.tutorial.done = tutorialDone;
  if (coins != null) st.coins = coins;
  return st;
}

/** きまった じゅんの 乱数 */
export function seeded(seed = 1) {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

/**
 * 魚を 入れる（コインは 気にしない）。
 * v0.2：解放が いる 生きものは 解放ずみに し、水が ちがえば その水の 水槽を つくって 入れる。
 * t を わたせば その水槽に 入れる。
 */
export function addFish(st, id, t) {
  st.coins = Math.max(st.coins, 99999);
  const sp = FISH.find((f) => f.id === id);
  if (sp?.unlock) st.unlocks = { ...(st.unlocks || {}), [sp.unlock]: st.unlocks?.[sp.unlock] || 1 };
  if (!t) {
    t = st.tanks.find((x) => x.water === sp.water && sim.spaceUsed(x) + (sp.space ?? 1) <= balance.TANK.capacity + 1e-9);
    if (!t) t = sim.addTank(st, sp.water, ['heater', 'air_pump']);
  }
  for (const need of sp?.needs || []) if (!t.decor.includes(need)) t.decor.push(need);
  const r = sim.buyFish(st, id, t);
  if (!r.ok) throw new Error('buyFish ' + id + ' ' + r.reason);
  return r.fish;
}

export const SOLD_FISH = FISH.filter((f) => f.price != null);
export const SOLD_ITEMS = ITEMS.filter((i) => i.price != null);
export const FRESH_FISH = SOLD_FISH.filter((f) => f.water === 'fresh');
export const SALT_FISH = SOLD_FISH.filter((f) => f.water === 'salt');
