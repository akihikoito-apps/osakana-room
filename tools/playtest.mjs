#!/usr/bin/env node
// 画面の 通し確認（点検係）。ブラウザで ほんとうに あそんで スクリーンショットを とる。
//   node tools/playtest.mjs [--out <フォルダ>] [--size 740x390,1024x768] [--headed]
// ながれ：新しい セーブ → チュートリアル → 魚を 3しゅるい かう → きぐ → はやおくり 2にち → 成長・ミッション → リロード
// ひつようなもの：playwright-core（npm の どこかに あれば よい。PLAYWRIGHT_CORE に パスを 入れても よい）と Chrome/Edge/Chromium。
// このリポジトリには npm の 依存を 入れない（テストは tools/run-tests.mjs。こちらは 手で うごかす 確認用）。
import http from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import os from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = resolve(arg('--out', join(os.tmpdir(), 'osakana-playtest')));
const SIZES = arg('--size', '740x390,1024x768').split(',').map((s) => s.split('x').map(Number));
const HEADED = process.argv.includes('--headed');
mkdirSync(OUT, { recursive: true });

// ---------------- playwright-core と ブラウザを さがす ----------------
function findPlaywright() {
  const tries = [];
  if (process.env.PLAYWRIGHT_CORE) tries.push(process.env.PLAYWRIGHT_CORE);
  const bases = [ROOT, process.cwd()];
  try { bases.push(execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); } catch { /* npm なし */ }
  // Claude の 作業フォルダ（scratchpad/*/pw/node_modules）も さがす
  const tmp = join(os.tmpdir(), 'claude');
  if (existsSync(tmp)) {
    const walk = (d, depth) => {
      if (depth > 5) return;
      let list = [];
      try { list = readdirSync(d); } catch { return; }
      if (list.includes('node_modules') && existsSync(join(d, 'node_modules', 'playwright-core'))) bases.push(d);
      for (const n of list) { if (n === 'node_modules') continue; const p = join(d, n); try { if (statSync(p).isDirectory()) walk(p, depth + 1); } catch { /* なし */ } }
    };
    walk(tmp, 0);
  }
  for (const b of bases) tries.push(join(b, 'node_modules', 'playwright-core'), join(b, 'playwright-core'));
  for (const t of tries) {
    try { return createRequire(join(ROOT, 'x.js'))(t); } catch { /* つぎ */ }
  }
  throw new Error('playwright-core が みつからない。PLAYWRIGHT_CORE=<node_modules/playwright-core の パス> を つけて うごかしてね');
}
function findBrowser() {
  const c = [process.env.CHROME_PATH].filter(Boolean);
  const pf = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
  for (const p of pf) c.push(join(p, 'Google/Chrome/Application/chrome.exe'), join(p, 'Microsoft/Edge/Application/msedge.exe'));
  const ms = join(process.env.LOCALAPPDATA || join(os.homedir(), '.cache'), 'ms-playwright');
  if (existsSync(ms)) for (const d of readdirSync(ms).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) c.push(join(ms, d, 'chrome-win/chrome.exe'), join(ms, d, 'chrome-win64/chrome.exe'), join(ms, d, 'chrome-linux/chrome'));
  c.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  const hit = c.find((p) => existsSync(p));
  if (!hit) throw new Error('Chrome・Edge・Chromium が みつからない。CHROME_PATH を つけてね');
  return hit;
}

// ---------------- かんたんな サーバー ----------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
function serve() {
  return new Promise((ok) => {
    const srv = http.createServer((req, res) => {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const f = join(ROOT, p === '/' ? 'index.html' : p);
      if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(readFileSync(f));
    });
    srv.listen(0, '127.0.0.1', () => ok(srv));
  });
}

// ---------------- 画面の 点検（見切れ・かさなり・ちいさい ボタン） ----------------
async function audit(p) {
  return p.evaluate(() => {
    const W = innerWidth, H = innerHeight;
    if (document.body.classList.contains('idle')) return [];  // わざと よけている あいだは しらべない
    const vis = (e) => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[hidden]'); };
    const name = (e) => (e.id ? '#' + e.id : '') + (e.dataset.care ? `[care=${e.dataset.care}]` : '') + (e.dataset.go ? `[go=${e.dataset.go}]` : '') + (e.dataset.id ? `[id=${e.dataset.id}]` : '') + ' ' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 16);
    const issues = [];
    // スクロールできる 入れものの なか（おみせの 一覧 など）は 画面の そとに あっても よい
    const inScroller = (e) => { for (let x = e.parentElement; x; x = x.parentElement) { const s = getComputedStyle(x); if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && x.scrollHeight > x.clientHeight) return true; } return false; };
    const btns = [...document.querySelectorAll('button')].filter(vis).filter((b) => !b.closest('#debug'));
    for (const b of btns) {
      const r = b.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) issues.push(`ちいさい ボタン ${Math.round(r.width)}x${Math.round(r.height)}: ${name(b)}`);
      if ((r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) && !inScroller(b)) issues.push(`画面から はみでた ボタン: ${name(b)} (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`);
    }
    // 文字の 見切れ（はみだし・…）。絵文字 1こ だけの ところ（かおの マーク）は 字の はばが すこし ひろいだけ なので のぞく
    for (const e of document.querySelectorAll('#app *')) {
      if (!vis(e) || !e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      if ([...e.textContent.trim()].length <= 2 && /\p{Extended_Pictographic}/u.test(e.textContent)) continue;
      const s = getComputedStyle(e);
      if ((s.overflow !== 'visible' || s.textOverflow === 'ellipsis' || s.whiteSpace === 'nowrap') && (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 4) && s.overflowY !== 'auto' && s.overflowY !== 'scroll') {
        issues.push(`文字が きれている かも: ${name(e)} (${e.scrollWidth}>${e.clientWidth} / ${e.scrollHeight}>${e.clientHeight})`);
      }
      const r = e.getBoundingClientRect();
      if (r.right > W + 2 || r.left < -2) if (!e.closest('.grid, .list, #toasts')) issues.push(`文字が 画面の よこから はみでた: ${name(e)}`);
    }
    // ボタンどうしの かさなり
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
      const a = btns[i].getBoundingClientRect(), b = btns[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 6 && oy > 6 && !btns[i].contains(btns[j]) && !btns[j].contains(btns[i])) issues.push(`ボタンが かさなっている: ${name(btns[i])} ／ ${name(btns[j])}`);
    }
    return issues;
  });
}

// ---------------- 通し ----------------
async function run(browser, base, W, H) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: false });
  const p = await ctx.newPage();
  p.setDefaultTimeout(10000);
  // 10びょう さわらないと ボタンが がめんの そとへ よける（body.idle）。ひとと おなじように、まず さわって もどしてから おす
  const rawClick = p.click.bind(p);
  p.click = async (sel, opts) => {
    const wasIdle = await p.evaluate(() => {
      if (!document.body.classList.contains('idle')) return false;
      window.dispatchEvent(new PointerEvent('pointerdown'));
      return true;
    });
    if (wasIdle) await p.waitForTimeout(600);
    return rawClick(sel, opts);
  };
  const errors = [], warns = [], notes = [], shots = [], audits = {};
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); else if (m.type() === 'warning') warns.push(m.text()); });
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  p.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errors.push('外部への 通信: ' + r.url()); });
  const tag = `${W}x${H}`;
  const shot = async (n) => {
    await p.waitForTimeout(600);
    const f = join(OUT, `${tag}_${n}.png`);
    await p.screenshot({ path: f });
    shots.push(f);
    audits[n] = await audit(p);
  };
  const st = () => p.evaluate(() => ({ step: G.state.tutorial.step, done: G.state.tutorial.done, scr: G.screen, coins: G.state.coins }));
  const toShop = async (tab) => {
    const s = await st();
    if (s.scr === 'tank') { await p.click('#btn-back'); await p.waitForTimeout(300); }
    else if (s.scr !== 'room' && s.scr !== 'shop') { await p.click('#btn-back'); await p.waitForTimeout(300); }
    if ((await st()).scr !== 'shop') await p.click('#room-nav [data-go="shop"]');
    await p.waitForTimeout(300);
    if (tab) { await p.click(`#scr-shop .tab[data-tab="${tab}"]`); await p.waitForTimeout(300); }
  };
  const buy = async (id) => {
    await p.click(`#shop-list [data-id="${id}"]`);
    await p.waitForTimeout(250);
    const ok = await p.$('#dialog .btn.primary');
    if (!ok) { const txt = await p.textContent('#dialog .modal-body'); await p.click('#dialog .btn'); throw new Error(`${id} を かえない: ${txt}`); }
    await ok.click();
    await p.waitForTimeout(500);
  };
  const toTank = async () => {
    const s = await st();
    if (s.scr === 'tank') return;
    if (s.scr !== 'room') { await p.click('#btn-back'); await p.waitForTimeout(300); }
    await p.click('#room-tank'); await p.waitForTimeout(1500);
  };

  // 1. 新しい セーブ
  await p.goto(base + '/index.html?nosw&reset', { waitUntil: 'load' });
  await p.waitForFunction(() => window.G && G.state, null, { timeout: 20000 });
  await p.waitForTimeout(1000);
  await shot('01_room_start');
  // 2. チュートリアル
  await p.click('#room-nav [data-go="shop"]');
  await shot('02_tut_shop');
  await buy('medaka');
  await shot('03_tut_bought');
  await p.click('#btn-back'); await p.waitForTimeout(300);
  await p.click('#room-tank'); await p.waitForTimeout(2000);
  await shot('04_tut_tank');
  let ate = false;
  for (let i = 0; i < 3 && !ate; i++) {
    await p.click('#care [data-care="feed"]');
    ate = await p.waitForFunction(() => G.state.tutorial.step > 3, null, { timeout: 25000 }).then(() => true, () => false);
    if (!ate) await p.waitForTimeout(6000 - 0);
  }
  if (!ate) {
    notes.push('【不具合】チュートリアルの「えさ」で 魚が えさを たべず、すすめなかった（3かい × 25びょう）。ここからは スクリプトで たべた ことに して つづけた');
    await p.evaluate(() => {
      const s = G.state, t = G.tank();
      const r0 = G.sim.feedStart(s, t, 'food_flake', Date.now() + 99999);
      const r = G.sim.feedEat(s, t.fish[0].uid, Date.now() + 99999 + 10);
      G.emit('action', { type: 'feed', result: { ate: [t.fish[0].uid] } });
      G.sim.feedEnd(s);
      return { r0, r };
    });
    await p.waitForFunction(() => G.state.tutorial.step > 3, null, { timeout: 5000 }).catch(() => notes.push('つよせいで すすめても だめ'));
  }
  await shot('05_tut_fed');
  await p.click('#guide .guide-ok'); await p.waitForTimeout(300);
  await toShop();
  await shot('06_tut_tools');
  for (const id of ['stone', 'air_pump', 'heater', 'water_change']) await buy(id);
  await p.waitForTimeout(1500);
  await shot('07_tut_meters');
  await p.click('#guide .guide-ok'); await p.waitForTimeout(400);
  await shot('08_tut_coins');
  await p.click('#guide .guide-ok'); await p.waitForTimeout(400);
  const afterTut = await st();
  if (!afterTut.done) notes.push('【不具合】チュートリアルが おわらない: ' + JSON.stringify(afterTut));
  await shot('09_tut_done');

  // 3. 魚を 3しゅるい かう（コインが たりなければ たす）
  await p.evaluate(() => { if (G.state.coins < 600) { G.state.coins = 600; G.refreshHud(); } });
  notes.push(`チュートリアル後の コイン ${afterTut.coins}（かいものの ために 600 に した）`);
  await toShop('fish');
  await shot('10_shop_fish');
  for (const id of ['minami_shrimp', 'neon_tetra', 'corydoras']) await buy(id);
  // 4. きぐ
  await p.click('#scr-shop .tab[data-tab="equip"]'); await p.waitForTimeout(300);
  await shot('11_shop_equip');
  await p.evaluate(() => { G.state.coins += 500; G.refreshHud(); G.emit('changed'); });
  for (const id of ['plant', 'filter', 'light']) await buy(id);
  await toTank();
  await shot('12_tank_full');
  // 魚を タップ（カード）
  const uid = await p.evaluate(() => G.tank().fish[0].uid);
  const pos = await p.evaluate((u) => G.aq?.screenPosOf?.(u), uid);
  if (pos) { await p.mouse.click(pos.x, pos.y + 4); await p.waitForTimeout(600); }
  const cardShown = await p.evaluate(() => !document.getElementById('fish-card').hidden);
  if (!cardShown) notes.push('魚を タップしても カードが でなかった（ばしょが ずれた だけ かも）');
  await shot('13_fish_card');

  // 5. はやおくり 2にち（6じかんごとに えさボタン）
  const before = await p.evaluate(() => ({ min: G.state.clock.min, coins: G.state.coins, stages: G.tank().fish.map((f) => f.stage) }));
  const res = await p.evaluate(async () => {
    const eaten = [];
    for (let h = 0; h < 48; h++) {
      G.handleEvents(G.sim.tick(G.state, 60));
      if (h % 6 === 0) {
        const o0 = G.tank().fish.map((f) => f.onaka);
        document.querySelector('#care [data-care="feed"]').click();
        await new Promise((r) => setTimeout(r, 6000));
        eaten.push(G.tank().fish.filter((f, i) => f.onaka > o0[i] + 1).length);
      }
    }
    G.refreshHud(); G.emit('changed');
    const t = G.tank();
    return { day: G.sim.gameDay(G.state.clock.min), coins: G.state.coins, eaten, fish: t.fish.map((f) => ({ id: f.speciesId, st: f.stage, h: Math.round(f.health), m: Math.round(f.mood), o: Math.round(f.onaka), n: f.natsuki })), clean: Math.round(t.clean), air: Math.round(t.air), temp: t.temp, done: Object.keys(G.state.missions.done), claimed: Object.keys(G.state.missions.claimed), stats: G.state.stats };
  });
  notes.push('はやおくり まえ: ' + JSON.stringify(before));
  notes.push('はやおくり 2にち あと: ' + JSON.stringify(res));
  if (res.eaten.every((n) => n === 0)) notes.push('【不具合】はやおくり中 えさボタンを 8かい おしたが 1ぴきも たべなかった');
  if (!res.fish.some((f) => f.st >= 1)) notes.push('【気になる】2にち たっても おとなに なった 魚が いない');
  await shot('14_tank_after2days');
  // 6. ミッション
  await p.click('#btn-back'); await p.waitForTimeout(300);
  await p.click('#room-nav [data-go="missions"]');
  await shot('15_missions');
  let claimed = 0;
  for (let i = 0; i < 20; i++) {
    const b = await p.$('#mission-list .btn.primary');
    if (!b) break;
    await b.click(); await p.waitForTimeout(400); claimed++;
  }
  notes.push(`ミッションを ${claimed} こ うけとった`);
  await shot('16_missions_claimed');
  await p.click('#btn-back'); await p.waitForTimeout(300);
  await p.click('#room-nav [data-go="dex"]');
  await shot('17_dex');
  await p.click('#btn-back'); await p.waitForTimeout(300);
  await shot('18_room_after');
  // しゃしん
  await p.click('#room-tank'); await p.waitForTimeout(1200);
  await p.click('#care [data-care="photo"]');
  await shot('19_photo');
  await p.click('#photo-exit'); await p.waitForTimeout(300);
  // よる
  await p.evaluate(() => { const s = G.state; s.clock.min = Math.floor(s.clock.min / 1440) * 1440 + 1440 + 22 * 60; s.clock.judged = Math.floor(s.clock.min / 60); G.refreshHud(); G.emit('changed'); });
  await shot('20_tank_night');
  await p.evaluate(() => { G.tank().clean = 15; G.emit('changed'); });
  await shot('21_hint');

  // 7. リロード
  const save1 = await p.evaluate(() => { G.saveNow(); const t = G.tank(); return { c: G.state.coins, f: t.fish.length, d: t.decor.length, m: Math.round(G.state.clock.min), cl: Object.keys(G.state.missions.claimed).length, tut: G.state.tutorial.done }; });
  await p.goto(base + '/index.html?nosw', { waitUntil: 'load' });
  await p.waitForFunction(() => window.G && G.state, null, { timeout: 20000 });
  await p.waitForTimeout(1500);
  const save2 = await p.evaluate(() => { const t = G.tank(); return { c: G.state.coins, f: t.fish.length, d: t.decor.length, m: Math.round(G.state.clock.min), cl: Object.keys(G.state.missions.claimed).length, tut: G.state.tutorial.done, scr: G.screen }; });
  const same = ['c', 'f', 'd', 'cl', 'tut'].every((k) => save1[k] === save2[k]) && Math.abs(save1.m - save2.m) < 30;
  notes.push(`リロード まえ ${JSON.stringify(save1)} → あと ${JSON.stringify(save2)} ${same ? 'OK' : '【不具合】もどらない'}`);
  await shot('22_after_reload');
  await ctx.close();
  return { tag, errors, warns, notes, shots, audits };
}

const pw = findPlaywright();
const exe = findBrowser();
const srv = await serve();
const base = `http://127.0.0.1:${srv.address().port}`;
console.log('ブラウザ:', exe);
console.log('しゃしんの ばしょ:', OUT);
const browser = await pw.chromium.launch({ executablePath: exe, headless: !HEADED, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const results = [];
let bad = 0;
try {
  for (const [W, H] of SIZES) {
    console.log(`\n==== ${W}x${H} ====`);
    let r;
    try { r = await run(browser, base, W, H); } catch (e) { r = { tag: `${W}x${H}`, errors: ['スクリプトが とまった: ' + e.message], warns: [], notes: [], shots: [], audits: {} }; }
    results.push(r);
    for (const n of r.notes) console.log('・' + n);
    console.log(`コンソールエラー ${r.errors.length} けん`); for (const e of r.errors) console.log('  ✖ ' + e);
    if (r.warns.length) { console.log(`けいこく ${r.warns.length} けん`); for (const w of [...new Set(r.warns)]) console.log('  △ ' + w); }
    const allIssues = Object.entries(r.audits).flatMap(([k, v]) => v.map((x) => `${k}: ${x}`));
    console.log(`画面の 気になる ところ ${allIssues.length} けん`); for (const x of [...new Set(allIssues)]) console.log('  ・' + x);
    if (r.errors.length || r.notes.some((n) => n.includes('【不具合】'))) bad++;
  }
} finally {
  await browser.close();
  srv.close();
}
writeFileSync(join(OUT, 'result.json'), JSON.stringify(results, null, 2));
console.log(`\nけっか: ${bad ? '× だめな ところ あり' : '○ とおった'}（くわしくは ${join(OUT, 'result.json')}）`);
process.exit(bad ? 1 : 0);
