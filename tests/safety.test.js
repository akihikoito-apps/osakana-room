// こどもの あんぜんの テスト（点検係）：通信しない・死を 連想させる ことばが ない・魚が うらがえらない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, walk, uiStrings, htmlTexts, FISH, ITEMS, balance, missions, hints, tutorial } from './_lib.js';

// 自分たちの コード（vendor の three.js は のぞく。three は 通信しない ライブラリ）
const OWN = () => [
  'index.html', 'sw.js', 'manifest.json', 'css/style.css',
  ...walk('js', (p) => p.endsWith('.js')),
];
const stripComments = (src, file) => file.endsWith('.html')
  ? src.replace(/<!--[\s\S]*?-->/g, '')
  : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

// ---------------- 外部通信 ----------------
test('外部の URL（http:// https:// //ドメイン）を よみこまない', () => {
  const bad = [];
  const ALLOW = [/xmlns='http:\/\/www\.w3\.org\/2000\/svg'/, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/];
  for (const f of OWN()) {
    let src = stripComments(read(f), f);
    for (const a of ALLOW) src = src.replace(new RegExp(a.source, 'g'), '');
    const lines = src.split('\n');
    lines.forEach((l, i) => {
      if (/https?:\/\//i.test(l)) bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 120)}`);
      // src="//example.com" や url(//example.com) の ような プロトコルなしの 外部
      if (/(?:src|href)\s*=\s*["']\/\/|url\(\s*["']?\/\/|(?:fetch|import)\s*\(\s*["'`]\/\//.test(l)) bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 120)}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('通信の しくみ（WebSocket・XMLHttpRequest・sendBeacon・EventSource・外部フォント）を つかわない', () => {
  const bad = [];
  for (const f of OWN()) {
    const src = stripComments(read(f), f);
    for (const re of [/\bWebSocket\b/, /\bXMLHttpRequest\b/, /\bsendBeacon\b/, /\bEventSource\b/, /\bRTCPeerConnection\b/, /@import\s/, /@font-face/, /fonts\.googleapis/, /\bnavigator\.geolocation\b/, /\bgetUserMedia\b/]) {
      if (re.test(src)) bad.push(`${f}: ${re}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('fetch と import() の さきは 同じ サイトの ファイルだけ', () => {
  const bad = [];
  for (const f of walk('js', (p) => p.endsWith('.js')).concat(['sw.js'])) {
    const src = stripComments(read(f), f);
    for (const m of src.matchAll(/\b(fetch|import)\s*\(\s*([^)]*)\)/g)) {
      const arg = m[2].trim();
      // 'リテラル' なら ./ か ../ か 同じ フォルダの パス。変数（req など）は sw.js の 同じサイト チェックを べつに みる
      const lit = arg.match(/^['"`]([^'"`]*)['"`]$/);
      if (lit && /^(?:[a-z]+:|\/\/)/i.test(lit[1])) bad.push(`${f}: ${m[0]}`);
    }
    for (const m of src.matchAll(/^\s*import\s[^'"]*?from\s*['"]([^'"]+)['"]/gm)) if (!/^\.{1,2}\//.test(m[1])) bad.push(`${f}: import ${m[1]}`);
  }
  assert.deepEqual(bad, []);
  // sw.js は ほかの サイトへの リクエストに さわらない
  assert.match(read('sw.js'), /url\.origin\s*!==\s*location\.origin\)\s*return/);
});

test('vendor の three.js に WebSocket・sendBeacon・EventSource が 入っていない', () => {
  const src = read('vendor/three.module.min.js');
  assert.ok(!/\bWebSocket\b|\bsendBeacon\b|\bEventSource\b/.test(src));
});

// ---------------- 死を 連想させる ことば ----------------
const DEATH = ['しぬ', 'しんだ', 'しんじゃ', 'しんで', 'しにそう', 'しなせ', 'しなない', 'おはか', 'おそうしき', 'ころす', 'ころさ', 'ころし', 'たべられ', 'いきたえ', 'あのよ', 'てんごく', 'ゆうれい', 'おばけ', 'ちが でる', 'シヌ', '死', '墓', '殺', '亡'];

function allScreenTexts() {
  const out = [];
  const walkVal = (v, p) => {
    if (typeof v === 'string') out.push([p, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => walkVal(x, `${p}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!['id', 'texture', 'icon', 'type', 'tag', 'water'].includes(k)) walkVal(x, `${p}.${k}`);
  };
  walkVal(FISH, 'FISH'); walkVal(ITEMS, 'ITEMS'); walkVal(balance.LABELS, 'LABELS');
  walkVal(missions.MISSIONS, 'MISSIONS'); walkVal(tutorial.TUTORIAL, 'TUTORIAL');
  for (const [k, v] of Object.entries(hints)) walkVal(v, k);
  for (const f of [...walk('js/ui'), 'js/main.js', 'js/sim.js', 'js/state.js', ...walk('js/aquarium')]) for (const s of uiStrings(read(f))) out.push([`${f}:${s.line}`, s.text]);
  for (const s of htmlTexts(read('index.html'))) out.push(['index.html', s]);
  const m = JSON.parse(read('manifest.json'));
  out.push(['manifest', m.name], ['manifest', m.description]);
  return out;
}

test('画面の 文字に「しぬ・しんだ・おはか」など 死を 連想させる ことばが ない', () => {
  const texts = allScreenTexts();
  assert.ok(texts.length > 300, `しらべた 文字が すくない ${texts.length}`);
  const bad = [];
  for (const [p, s] of texts) for (const w of DEATH) if (s.includes(w)) bad.push(`${p}: 「${w}」 ${s}`);
  assert.deepEqual(bad, []);
});

test('コードに 魚が しぬ じょうたい（dead・die・death・bellyUp）が ない', () => {
  const bad = [];
  for (const f of walk('js', (p) => p.endsWith('.js'))) {
    const src = stripComments(read(f), f);
    const m = src.match(/\b(dead|die|died|dies|dying|death|bellyUp|belly_up|corpse)\b/i);
    if (m) bad.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(bad, []);
});

// ---------------- 魚が うらがえらない ----------------
test('aquarium：魚の からだの ロール（rotation.z）は ±90° より ずっと 小さく おさえている', () => {
  const src = stripComments(read('js/aquarium/index.js'), 'x.js');
  const lines = src.split('\n').filter((l) => /\.mesh\.rotation\.z\s*[+\-*]?=/.test(l));
  assert.ok(lines.length >= 1, '魚の rotation.z を さがせない（コードが かわった？ テストを なおす）');
  for (const l of lines) {
    const m = l.match(/clamp\([^,]+,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
    assert.ok(m, `clamp されていない: ${l.trim()}`);
    assert.ok(Math.abs(+m[1]) < Math.PI / 2 && Math.abs(+m[2]) < Math.PI / 2, `はばが ひろすぎる: ${l.trim()}`);
  }
  for (const m of src.matchAll(/\.mesh\.rotation\.x\s*=\s*([^;\n]+)/g)) assert.equal(m[1].trim(), '0', `魚の rotation.x（よこだおし）を うごかしている: ${m[0]}`);
});

test('aquarium：180°（Math.PI）で ひっくりかえす・上下を 反転させる うごきが ない', () => {
  const bad = [];
  for (const f of walk('js/aquarium')) {
    const src = stripComments(read(f), f);
    src.split('\n').forEach((l, i) => {
      // rotation.z / rotateZ / rotation.x に まるごとの π（π/2 などの わり算は のぞく）
      if (/(?:rotation\.[zx]\s*[+\-]?=|rotate[ZX]\s*\(|rotation\.set\()[^;\n]*Math\.PI(?!\s*[/*]\s*[\d.])/.test(l) && !/rotateX\(-?Math\.PI\s*\/\s*2\)/.test(l)) bad.push(`${f}:${i + 1}: ${l.trim()}`);
      if (/rotation\.[zx]\s*[+\-]?=\s*-?3\.14/.test(l)) bad.push(`${f}:${i + 1}: ${l.trim()}`);
      if (/\.scale\.y\s*=\s*-|\.scale\.set\([^,]+,\s*-/.test(l)) bad.push(`${f}:${i + 1}: ${l.trim()}`);
      if (/rotation\.z\s*\+=/.test(l)) bad.push(`${f}:${i + 1}: ${l.trim()}（たしつづけると まわりきる）`);
    });
  }
  assert.deepEqual(bad, []);
});
