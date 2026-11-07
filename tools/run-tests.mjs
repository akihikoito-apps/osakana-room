#!/usr/bin/env node
// テストを ぜんぶ まとめて はしらせる（点検係）。npm の 依存なし。
//   node tools/run-tests.mjs          … tests/*.test.js を ぜんぶ
//   node tools/run-tests.mjs sim data … なまえに sim か data が ふくまれる ものだけ
// おわりに けっかの かずを 出す。1つでも だめなら 終了コード 1（push の まえに つかう）。
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pick = process.argv.slice(2);
const files = readdirSync(join(ROOT, 'tests'))
  .filter((f) => f.endsWith('.test.js'))
  .filter((f) => !pick.length || pick.some((p) => f.includes(p)))
  .sort()
  .map((f) => join('tests', f));
if (!files.length) { console.error('テストが みつからない'); process.exit(1); }

const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const out = (r.stdout || '') + (r.stderr || '');

// TAP から ファイルごとの かずを まとめる
const lines = out.split('\n');
const fails = [];
let pass = 0, fail = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const m = l.match(/^\s{0,4}(not ok|ok) \d+ - (.*)$/);
  if (!m) continue;
  if (/^\s*#\s*(SKIP|TODO)/.test(m[2])) continue;
  if (m[1] === 'ok') pass++;
  else {
    fail++;
    // つづく YAML から いちばん だいじな ところ
    const detail = [];
    for (let j = i + 1; j < lines.length && !/^\s{0,4}(not )?ok \d+/.test(lines[j]); j++) {
      if (/error:|location:|^\s+[+-] /.test(lines[j])) detail.push(lines[j].trim());
      if (/error: \|-?$/.test(lines[j])) for (let k = 1; k <= 3 && lines[j + k]?.trim(); k++) detail.push('  ' + lines[j + k].trim());
      if (detail.length > 12) break;
    }
    fails.push({ name: m[2], detail });
  }
}
const sum = (k) => Number((out.match(new RegExp(`^# ${k} (\\d+)`, 'm')) || [])[1] || 0);
const total = sum('tests') || pass + fail;

console.log('');
console.log('==== おさかなルーム テスト ====');
console.log('ファイル: ' + files.map((f) => f.replace(/\\/g, '/')).join(', '));
if (fails.length) {
  console.log('');
  for (const f of fails) {
    console.log('✖ ' + f.name);
    for (const d of f.detail) console.log('    ' + d);
  }
}
console.log('');
console.log(`ぜんぶ ${total} けん ／ ○ ${sum('pass') || pass} ／ × ${sum('fail') || fail}`);
if (r.status !== 0 && !fails.length) { console.log(out); }
process.exit(r.status === 0 ? 0 : 1);
