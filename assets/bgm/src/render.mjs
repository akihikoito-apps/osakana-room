// BGM の 書き出し（音楽係）。くわしくは docs/音楽.md。
//   node assets/bgm/src/render.mjs [曲id ...] [--install]
//   → 作業フォルダ（既定は OS の一時フォルダ/osakana-bgm、OUT で変更）に <id>.wav・<id>.m4a を作り、音量・つなぎ目を測る。
//     --install を つけると できた m4a を assets/bgm/ に コピーする。
// ひつようなもの：Node、ffmpeg（PATH）、Chrome、playwright-core（PLAYWRIGHT_CORE に パス、または Claude の 作業フォルダの */pw/node_modules）。
// このリポジトリには npm の 依存を 入れない。
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync, copyFileSync } from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
function findPlaywright() {
  const tries = [];
  if (process.env.PLAYWRIGHT_CORE) tries.push(process.env.PLAYWRIGHT_CORE);
  const tmp = join(os.tmpdir(), 'claude');
  const walk = (d, depth) => {
    if (depth > 5) return;
    let list = []; try { list = readdirSync(d); } catch { return; }
    if (list.includes('node_modules') && existsSync(join(d, 'node_modules', 'playwright-core'))) tries.push(join(d, 'node_modules', 'playwright-core'));
    for (const n of list) { if (n === 'node_modules') continue; const p = join(d, n); try { if (statSync(p).isDirectory()) walk(p, depth + 1); } catch { /* なし */ } }
  };
  if (existsSync(tmp)) walk(tmp, 0);
  for (const t of tries) { try { return createRequire(join(HERE, 'x.js'))(t); } catch { /* つぎ */ } }
  throw new Error('playwright-core が みつからない。PLAYWRIGHT_CORE に パスを つけてね');
}
const { chromium } = findPlaywright();
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(existsSync);
const OUT = process.env.OUT || join(os.tmpdir(), 'osakana-bgm');
const INSTALL = process.argv.includes('--install');
mkdirSync(OUT, { recursive: true });
const SR = 48000;
const BITRATE = process.env.BR || '96k';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ids = args.length ? args : ['pokapoka', 'hidamari', 'yurayura', 'suichu', 'ohirune'];
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
page.on('console', (m) => console.log('  [chrome]', m.text()));
await page.goto('about:blank');
await page.addScriptTag({ content: readFileSync(join(HERE, 'engine.js'), 'utf8') });
await page.addScriptTag({ content: readFileSync(join(HERE, 'songs.js'), 'utf8') });

function wav16(pcmBuf, ch, sr) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcmBuf.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22); h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * ch * 2, 28); h.writeUInt16LE(ch * 2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcmBuf.length, 40);
  return Buffer.concat([h, pcmBuf]);
}

function analyze(f32, ch, sr, loopFrames, offsetSec = 1.0) {
  const n = f32.length / ch;
  const win = Math.round(0.4 * sr);
  const res = { peakDb: -Infinity, rmsDb: 0, winMaxDb: -Infinity, winMinDb: Infinity, maxJumpDb: 0, seamDiffDb: null };
  let ss = 0, pk = 0;
  for (let i = 0; i < f32.length; i++) { ss += f32[i] * f32[i]; pk = Math.max(pk, Math.abs(f32[i])); }
  res.peakDb = 20 * Math.log10(pk); res.rmsDb = 10 * Math.log10(ss / f32.length);
  // 0.4 秒ごとの RMS（ループ区間だけ）
  const s0 = Math.round(offsetSec * sr), s1 = Math.min(n, s0 + loopFrames);
  let prev = null; const wins = [];
  for (let a = s0; a + win <= s1; a += win) {
    let w = 0; for (let i = a; i < a + win; i++) for (let c = 0; c < ch; c++) w += f32[i * ch + c] ** 2;
    const db = 10 * Math.log10(w / (win * ch) + 1e-12);
    wins.push(db);
    res.winMaxDb = Math.max(res.winMaxDb, db); res.winMinDb = Math.min(res.winMinDb, db);
    if (prev != null) res.maxJumpDb = Math.max(res.maxJumpDb, db - prev);
    prev = db;
  }
  // 0.05 秒の短い窓での最大（急な大きな音）
  const sw = Math.round(0.05 * sr); let smax = -Infinity;
  for (let a = s0; a + sw <= s1; a += sw) { let w = 0; for (let i = a; i < a + sw; i++) for (let c = 0; c < ch; c++) w += f32[i * ch + c] ** 2; smax = Math.max(smax, 10 * Math.log10(w / (sw * ch) + 1e-12)); }
  res.shortMaxDb = smax;
  // つなぎ目：ループ点の前後 20ms と、1周後の同じ所の差
  if (s0 + loopFrames + 2000 < n) {
    let d = 0, e = 0;
    for (let i = -960; i < 960; i++) for (let c = 0; c < ch; c++) { const x = f32[(s0 + i) * ch + c], y = f32[(s0 + loopFrames + i) * ch + c]; d += (x - y) ** 2; e += x * x; }
    res.seamDiffDb = 10 * Math.log10(d / (e + 1e-12) + 1e-12); // 信号に対する差（dB、低いほどよい）
    // つなぎ目の段差：ループ終わり→はじめ に飛ぶときの1サンプル差 と 普段の1サンプル差
    let jump = 0; for (let c = 0; c < ch; c++) jump = Math.max(jump, Math.abs(f32[(s0 + loopFrames - 1) * ch + c] - f32[s0 * ch + c]));
    let typ = 0, cnt = 0; for (let i = s0; i < s1 - 1; i += 7) for (let c = 0; c < ch; c++) { typ += Math.abs(f32[(i + 1) * ch + c] - f32[i * ch + c]); cnt++; }
    res.seamStep = jump; res.typStep = typ / cnt;
  }
  res.wins = wins;
  return res;
}

const report = {};
for (const id of ids) {
  const t0 = Date.now();
  const r = await page.evaluate(async (id) => {
    const s = BGM.SONGS[id]();
    const bad = s.events.filter((e) => e.beat >= s.bars * s.meter - 1e-6 || e.beat < 0).length;
    const raw = await BGM.render(s);
    const f = BGM.finish(raw, { rmsDb: -20, peakDb: -3, extraSec: 2 });
    return { ...f, L: s.L, log: s.log, events: s.events.length, bad };
  }, id);
  const pcm = Buffer.from(r.b64, 'base64');
  const wavPath = join(OUT, id + '.wav');
  writeFileSync(wavPath, wav16(pcm, 2, SR));
  const m4a = join(OUT, id + '.m4a');
  const { spawnSync } = await import('node:child_process');
  const mr = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wavPath, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(mr.split('Summary:')[1])[1]);
  const TP = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(mr.split('Summary:')[1])[1]);
  const TARGET = Number(process.env.LUFS || -20);
  let gdb = TARGET - I; if (TP + gdb > -3) gdb = -3 - TP;
  console.log('  LUFS', I, 'TP', TP, '→ gain', gdb.toFixed(2), 'dB');
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', wavPath, '-af', 'volume=' + gdb.toFixed(2) + 'dB', '-c:a', 'aac', '-b:a', BITRATE, '-ar', String(SR), '-ac', '2', '-movflags', '+faststart', m4a]);
  const dec = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', m4a, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: 1 << 30 });
  const f32 = new Float32Array(dec.buffer, dec.byteOffset, dec.byteLength / 4);
  const a = analyze(f32, 2, SR, r.loopFrames, 1.0);
  const size = statSync(m4a).size;
  report[id] = { L: r.L, loopFrames: r.loopFrames, decodedFrames: f32.length / 2, sizeKB: Math.round(size / 1024), events: r.events, badEvents: r.bad, gainDb: +r.gainDb.toFixed(1), preRmsDb: +r.rmsDb.toFixed(1), prePeakDb: +r.peakDb.toFixed(1), ...Object.fromEntries(Object.entries(a).filter(([k]) => k !== 'wins').map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(k.includes('Step') ? 5 : 1) : v])), secs: ((Date.now() - t0) / 1000).toFixed(1) };
  console.log(id, JSON.stringify(report[id]));
  console.log('  melody:', r.log.join(' / '));
  if (INSTALL) copyFileSync(m4a, join(HERE, '..', id + '.m4a'));
  writeFileSync(join(OUT, id + '.wins.json'), JSON.stringify(a.wins.map((x) => +x.toFixed(1))));
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
await browser.close();
