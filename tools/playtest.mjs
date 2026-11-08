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
const GPU = process.argv.includes('--gpu');   // ほんものの GPU で 描く（ソフト描画が おそくて とまるとき）
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
    // スクロールの 入れものの そとに はみでた ぶんは 見えないので きりとる
    const clip = (e) => {
      let r = e.getBoundingClientRect(); r = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      for (let x = e.parentElement; x; x = x.parentElement) {
        const s = getComputedStyle(x);
        if (s.overflowY === 'auto' || s.overflowY === 'scroll' || s.overflow === 'hidden') {
          const q = x.getBoundingClientRect();
          r = { left: Math.max(r.left, q.left), top: Math.max(r.top, q.top), right: Math.min(r.right, q.right), bottom: Math.min(r.bottom, q.bottom) };
        }
      }
      return r;
    };
    const MODAL = '#celebrate, #dialog, #guide, #bgm-picker';
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
      const A = btns[i], Bt = btns[j];
      if (A.contains(Bt) || Bt.contains(A)) continue;
      if (!!A.closest(MODAL) !== !!Bt.closest(MODAL)) continue;     // お知らせ・ダイアログの 下に かくれた ものは よい
      const a = clip(A), b = clip(Bt);
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 6 && oy > 6) {
        const top = document.elementFromPoint((Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2, (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2);
        if (top && !A.contains(top) && !Bt.contains(top)) continue;   // べつの ものが 上に ある
        issues.push(`ボタンが かさなっている: ${name(A)} ／ ${name(Bt)}`);
      }
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
  await p.click('#guide .guide-ok'); await p.waitForTimeout(1200);
  // v0.6：さいごは へやで ヘルプの ばしょを おしえる（t_help）
  if (!(await st()).done) { await shot('08b_tut_help'); await p.click('#guide .guide-ok'); await p.waitForTimeout(400); }
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

  // 8. v0.2：解放 → 大きな お知らせ → すいそうを かう → へやの わく → ズーム → ハート → そうじ → すいそうの きりかえ
  if (await p.evaluate(() => typeof G.sim.checkUnlock === 'function')) {
    try { await v02(); } catch (e) { notes.push('【不具合？】v0.2 の ながれが とちゅうで とまった: ' + e.message.split('\n').slice(0, 8).join(' / ')); await shot('99_v02_stopped').catch(() => {}); }
  }
  // 9. v0.3：かい 2ひき まで・ビタミン・おんど ダイヤル・じどう えさやり・おんがく
  if (await p.evaluate(() => typeof G.sim.vitaminStart === 'function')) {
    try { await v03(); } catch (e) { notes.push('【不具合？】v0.3 の ながれが とちゅうで とまった: ' + e.message.split('\n').slice(0, 8).join(' / ')); await shot('99_v03_stopped').catch(() => {}); }
  }
  await ctx.close();
  return { tag, errors, warns, notes, shots, audits };

  async function v02() {
    const goRoom = async () => { for (let i = 0; i < 3 && (await st()).scr !== 'room'; i++) { await p.click('#btn-back'); await p.waitForTimeout(500); } };
    const toFishShop = async () => { await goRoom(); await p.click('#room-nav [data-go="shop"]'); await p.waitForTimeout(300); await p.click('#scr-shop .tab[data-tab="fish"]'); await p.waitForTimeout(300); };
    await p.evaluate(() => { G.state.coins = Math.max(G.state.coins, 300); G.refreshHud(); });
    const before = await p.evaluate(() => ({ n: G.state.tanks[0].fish.length, unlocked: !!G.state.unlocks?.tank6 }));
    notes.push(`v0.2：1つめの すいそうの 生きもの ${before.n}ひき・解放 ${before.unlocked}`);
    // かぎつき カード
    await toFishShop();
    const locked = await p.evaluate(() => ({ cards: document.querySelectorAll('#shop-list .locked-card').length, heads: [...document.querySelectorAll('#shop-list .shop-head')].map((h) => h.textContent) }));
    notes.push(`v0.2：おみせの 見出し ${JSON.stringify(locked.heads)}・かぎつき カード ${locked.cards}まい`);
    const band = await p.evaluate(() => document.querySelector('#shop-list .lb-text, .lock-banner')?.textContent || '');
    notes.push('まだ かえない 帯: ' + (band || '（なし）'));
    if (!band) notes.push('【仕様と ちがう？】かぎつきの 案内の 帯（あと ◯ひき）が 見つからない');
    await p.evaluate(() => { const h = document.querySelector('#shop-list .locked-card'); h?.scrollIntoView({ block: 'center' }); });
    await shot('23_shop_locked');
    await p.evaluate(() => document.querySelector('#shop-list')?.scrollTo?.(0, 0));
    await shot('23b_shop_band');
    // 6ぴきに する（イシマキガイ。はじめから かえる）
    let need = 6 - before.n;
    while (need-- > 0) await buy('ishimaki');
    const cel = await p.waitForSelector('#celebrate:not([hidden])', { timeout: 4000 }).then(() => true, () => false);
    if (!cel) notes.push('【不具合】6ぴきに しても 大きな お知らせが でない');
    else {
      const m0 = await p.evaluate(() => G.state.clock.min);
      await p.waitForTimeout(3000);
      const m1 = await p.evaluate(() => G.state.clock.min);
      if (m1 !== m0) notes.push(`【不具合】お知らせの あいだに 時計が すすんだ（${m0}→${m1}）`);
      notes.push('お知らせ 1まいめ: ' + await p.textContent('#celebrate .cel-text'));
      await shot('24_unlock_1');
      await p.click('#celebrate .cel-ok'); await p.waitForTimeout(400);
      notes.push('お知らせ 2まいめ: ' + await p.textContent('#celebrate .cel-text'));
      await shot('25_unlock_2');
      await p.click('#celebrate .cel-shop'); await p.waitForTimeout(800);
    }
    if ((await st()).scr !== 'shop') { await goRoom(); await p.click('#room-nav [data-go="shop"]'); await p.click('#scr-shop .tab[data-tab="equip"]'); }
    const short = await p.evaluate(() => [...document.querySelectorAll('#shop-list .lock-line.short')].map((e) => e.closest('[data-id]')?.dataset.id + ':' + e.textContent));
    notes.push(`すいそうの カード（コイン ${await p.evaluate(() => G.state.coins)}）: ${JSON.stringify(short)}`);
    await shot('26_shop_tanks');
    // うみの すいそうを かう
    await p.evaluate(() => { G.state.coins += 3000; G.refreshHud(); G.emit('changed'); });
    await p.evaluate(() => document.querySelector('#shop-list [data-id="tank_salt"]')?.scrollIntoView({ block: 'center' }));
    await buy('tank_salt');
    const tanks = await p.evaluate(() => G.state.tanks.map((t) => ({ id: t.id, water: t.water, slot: t.slot, decor: t.decor })));
    if (tanks.length !== 2 || tanks[1].water !== 'salt') notes.push('【不具合】うみの すいそうが ふえない: ' + JSON.stringify(tanks));
    // へやの 6わく
    await goRoom();
    await p.waitForTimeout(800);
    const slots = await p.evaluate(() => [...document.querySelectorAll('.room-slot')].map((b) => b.className.replace('room-slot', '').trim()));
    notes.push('へやの わく: ' + JSON.stringify(slots));
    if (slots.length !== 6) notes.push(`【不具合】へやの わくが ${slots.length}こ（6こ の はず）`);
    await shot('27_room_slots');
    // ズーム
    const saltSlot = tanks.find((t) => t.water === 'salt')?.slot ?? 1;
    await p.click(`.room-slot[data-slot="${saltSlot}"]`);
    await p.waitForTimeout(220);
    { const f = join(OUT, `${tag}_28_zoom.png`); await p.screenshot({ path: f }); shots.push(f); }
    await p.waitForFunction(() => G.screen === 'tank', null, { timeout: 5000 }).catch(() => notes.push('【不具合】ズームの あと すいそうの 画面に ならない'));
    await p.waitForTimeout(1500);
    const cur = await p.evaluate(() => ({ id: G.tank().id, water: G.tank().water, title: document.querySelector('#tank-title')?.textContent }));
    if (cur.water !== 'salt') notes.push('【不具合】うみの すいそうを おしたのに ちがう すいそうが ひらいた: ' + JSON.stringify(cur));
    await shot('29_salt_tank_empty');
    // うみの 生きものを かう（おみせの「いれる すいそう」が うみ に なっているか）
    await goRoom(); await p.click('#room-nav [data-go="shop"]'); await p.waitForTimeout(300);
    await p.click('#scr-shop .tab[data-tab="fish"]'); await p.waitForTimeout(300);
    const shopTank = await p.textContent('#shop-tank .st-name').catch(() => '');
    notes.push('おみせの いれる すいそう: ' + shopTank);
    await shot('30_shop_salt');
    for (const id of ['clownfish', 'skunk_shrimp', 'shittaka']) await buy(id);
    await p.click('#scr-shop .tab[data-tab="equip"]'); await p.waitForTimeout(300);
    await buy('liverock');
    const saltFish = await p.evaluate(() => G.state.tanks.find((t) => t.water === 'salt').fish.map((f) => f.speciesId));
    if (saltFish.length !== 3) notes.push('【不具合】うみの すいそうに 生きものが 入らない: ' + JSON.stringify(saltFish));
    // すいそうへ（ズームで）
    await goRoom();
    await p.click(`.room-slot[data-slot="${saltSlot}"]`);
    await p.waitForFunction(() => G.screen === 'tank', null, { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(2500);
    await shot('31_salt_tank');
    // ハート：魚を なでる
    const h0 = await p.evaluate(() => ({ h: G.state.hearts, d: G.state.daily.hearts, text: document.getElementById('hud-heart-n')?.textContent }));
    const uids = await p.evaluate(() => G.tank().fish.map((f) => f.uid));
    let popSeen = false, popShot = false;
    for (const u of uids) {
      // 魚の いちが ボタンの 下なら おさない（しゃしん ボタンなどを おしてしまう）
      const pos = await p.evaluate((x) => { const q = G.aq?.screenPosOf?.(x); if (!q) return null; const e = document.elementFromPoint(q.x, q.y + 2); return e && e.tagName === 'CANVAS' ? q : null; }, u);
      if (!pos) continue;
      await p.mouse.click(pos.x, pos.y + 2);
      await p.waitForTimeout(250);
      if (await p.evaluate(() => !!document.querySelector('.pop-heart'))) {
        popSeen = true;
        if (!popShot) { popShot = true; const f = join(OUT, `${tag}_32a_heart_plus1.png`); await p.screenshot({ path: f }); shots.push(f); }
      }
      await p.waitForTimeout(150);
    }
    if (await p.evaluate(() => document.body.classList.contains('photo'))) { notes.push('（魚の タップで しゃしんに なった ので もどした）'); await p.click('#photo-exit'); }
    await p.waitForTimeout(300);
    await shot('32_hearts');
    const h1 = await p.evaluate(() => ({ h: G.state.hearts, d: G.state.daily.hearts, text: document.getElementById('hud-heart-n')?.textContent, card: !document.getElementById('fish-card').hidden }));
    notes.push(`ハート ${JSON.stringify(h0)} → ${JSON.stringify(h1)}`);
    if (!(h1.h > h0.h)) notes.push('【気になる】魚を タップしても ハートが ふえなかった（タップの いちが ずれた かも）');
    if (String(h1.h) !== h1.text) notes.push(`【不具合】ハートの カウンターの 表示 ${h1.text} が 数 ${h1.h} と ちがう`);
    const daily = await p.evaluate(() => ({ text: document.getElementById('hud-hearts')?.textContent || '', d: G.state.daily.hearts }));
    const dm = daily.text.match(/(\d+)\s*[／/]\s*20/);
    if (!dm) notes.push('【仕様と ちがう】ハートの カウンターに「きょう 8／20」の ような 今日の 数が 出ていない（仕様 6章）');
    else if (+dm[1] !== Math.min(20, daily.d)) notes.push(`【不具合】「きょう ${dm[1]}／20」が 今日の 数 ${daily.d} と ちがう`);
    if (h1.h > h0.h && !popSeen) notes.push('【仕様と ちがう？】ハートが ふえたのに「＋1」が 見えなかった');
    notes.push(`ハートの ＋1: ${popSeen ? 'みえた' : 'みえない'}・カウンター「${daily.text.trim()}」`);
    await p.mouse.click(5, H / 2); await p.waitForTimeout(300);
    // そうじ（あみの アニメ 2びょう、おわりに たべのこし 0）
    await p.evaluate(() => { G.tank().leftover = 2; G.emit('changed'); });
    await p.waitForTimeout(300);
    await p.click('#care [data-care="clean"]');
    await p.waitForTimeout(700);
    { const f = join(OUT, `${tag}_33_scoop_anim.png`); await p.screenshot({ path: f }); shots.push(f); }
    const mid = await p.evaluate(() => ({ left: G.tank().leftover, feedLocked: document.querySelector('#care [data-care="feed"]').classList.contains('cool') || document.querySelector('#care [data-care="feed"]').disabled }));
    if (mid.left === 0) notes.push('【仕様と ちがう】そうじの アニメの とちゅうで もう たべのこしが 0（仕様は アニメの おわり）');
    if (!mid.feedLocked) notes.push('【仕様と ちがう】そうじの アニメ中に えさボタンが おせる ように 見える');
    // アニメの おわり（仕様 2びょう）で 0 に なるか。なるまでの 時間を はかる
    const doneMs = await p.evaluate(async () => { const t0 = performance.now(); while (performance.now() - t0 < 8000) { if (G.tank().leftover === 0) return performance.now() - t0; await new Promise((r) => setTimeout(r, 100)); } return -1; });
    const total = doneMs < 0 ? -1 : Math.round(doneMs + 700);
    notes.push(`そうじ：たべのこしが 0 に なるまで ${total < 0 ? '8びょう いじょう' : total + 'ms'}`);
    if (total < 0) notes.push('【不具合】そうじの あと たべのこしが 0 に ならない');
    else if (total > 2800) notes.push(`【仕様と ちがう】そうじが おわるまで ${total}ms（仕様 7章は 2びょう）`);
    // たべのこし 0 でも あみを つかえる
    await p.waitForTimeout(400);
    await p.click('#care [data-care="clean"]');
    await p.waitForTimeout(2600);
    await shot('34_after_scoop');
    // しゃしん：すいそうの なまえ・◀▶ が きえるか
    await p.click('#care [data-care="photo"]'); await p.waitForTimeout(800);
    const titleVis = await p.evaluate(() => { const e = document.getElementById('tank-title'); if (!e) return false; const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return !e.hidden && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && r.width > 0 && r.bottom > 0 && r.top < innerHeight; });
    await shot('34b_photo');
    if (titleVis) notes.push('【不具合】しゃしんの とき すいそうの なまえ・◀▶ が のこる');
    await p.click('#photo-exit'); await p.waitForTimeout(400);
    // すいそうの きりかえ
    const id0 = await p.evaluate(() => G.tank().id);
    const nextBtn = await p.$('#tank-title .tt-next:not([hidden])');
    if (nextBtn) { await nextBtn.click(); await p.waitForTimeout(1500); }
    const id1 = await p.evaluate(() => G.tank().id);
    if (id0 === id1) notes.push('【不具合？】すいそうの きりかえ（▶）で かわらない');
    await shot('35_tank_switch');
    await goRoom(); await p.waitForTimeout(800);
    await shot('36_room_final');
    // リロードで のこる
    await p.evaluate(() => G.saveNow());
    await p.goto(base + '/index.html?nosw', { waitUntil: 'load' });
    await p.waitForFunction(() => window.G && G.state, null, { timeout: 20000 });
    await p.waitForTimeout(1200);
    const back = await p.evaluate(() => ({ tanks: G.state.tanks.length, unlocked: !!G.state.unlocks.tank6, hearts: G.state.hearts, cel: !document.getElementById('celebrate').hidden }));
    notes.push('v0.2 リロード あと: ' + JSON.stringify(back));
    if (back.cel) notes.push('【不具合】リロードすると お知らせが また でる');
    if (back.tanks !== 2 || !back.unlocked) notes.push('【不具合】リロードで すいそう・解放が のこらない');
  }

  async function v03() {
    const goRoom = async () => { for (let i = 0; i < 3 && (await st()).scr !== 'room'; i++) { await p.click('#btn-back'); await p.waitForTimeout(500); } };
    const openShop = async (tab) => { await goRoom(); await p.click('#room-nav [data-go="shop"]'); await p.waitForTimeout(300); await p.click(`#scr-shop .tab[data-tab="${tab}"]`); await p.waitForTimeout(300); };
    const openTank = async (slot) => { await goRoom(); await p.click(`.room-slot[data-slot="${slot}"]`); await p.waitForFunction(() => G.screen === 'tank', null, { timeout: 5000 }); await p.waitForTimeout(1500); };
    await p.evaluate(() => { G.state.coins += 3000; G.refreshHud(); G.emit('changed'); });
    const fresh = await p.evaluate(() => { const t = G.state.tanks.find((x) => x.water === 'fresh'); G.setTank(t.id); return { slot: t.slot, snails: t.fish.filter((f) => G.data.fishById[f.speciesId]?.kind === 'snail').length }; });
    // かい：2ひき まで（いま 2ひき なら 3びきめは かえない）
    await openShop('fish');
    if (fresh.snails < 2) for (let i = fresh.snails; i < 2; i++) await buy('ishimaki');
    await p.evaluate(() => document.querySelector('#shop-list [data-id="ishimaki"]')?.scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(300);
    await shot('40_shop_snail_full');
    await p.click('#shop-list [data-id="ishimaki"]'); await p.waitForTimeout(300);
    const snailMsg = await p.textContent('#dialog .modal-body').catch(() => '');
    const canBuy3 = !!(await p.$('#dialog .btn.primary'));
    await shot('41_snail_dialog');
    await p.click('#dialog .btn').catch(() => {}); await p.waitForTimeout(300);
    notes.push(`かい 3びきめ: ${canBuy3 ? '【不具合】かえて しまう' : 'かえない'}「${(snailMsg || '').replace(/\s+/g, ' ').slice(-50)}」`);
    // ビタミン：えさ タブで かう → すいそうで あげる
    await p.click('#scr-shop .tab[data-tab="food"]'); await p.waitForTimeout(300);
    await shot('42_shop_food');
    await buy('food_vitamin');
    const inv0 = await p.evaluate(() => G.state.inv.food_vitamin || 0);
    if (inv0 !== 5) notes.push(`【不具合】ビタミンを かっても のこり ${inv0}（5 の はず）`);
    await openTank(fresh.slot);
    await shot('43_tank_vitamin_button');
    const before = await p.evaluate(() => G.tank().fish.map((f) => ({ id: f.speciesId, h: Math.round(f.health), o: Math.round(f.onaka) })));
    await p.click('#care [data-care="vitamin"]');
    await p.waitForTimeout(1200);
    await shot('44_vitamin_drop');
    await p.waitForTimeout(6000);
    await shot('45_vitamin_after');
    const after = await p.evaluate(() => ({ left: G.state.inv.food_vitamin, today: G.state.daily.vitamin?.[G.tank().id] || 0, fish: G.tank().fish.map((f) => ({ id: f.speciesId, h: Math.round(f.health), o: Math.round(f.onaka) })), btn: document.querySelector('#care [data-care="vitamin"]')?.textContent, cool: document.querySelector('#care [data-care="vitamin"]')?.classList.contains('cool') }));
    notes.push(`ビタミン：のこり ${inv0}→${after.left}・きょう ${after.today}・ボタン「${(after.btn || '').trim()}」 灰色=${after.cool}`);
    notes.push('ビタミン まえ ' + JSON.stringify(before) + ' → あと ' + JSON.stringify(after.fish));
    if (after.left !== inv0 - 1) notes.push('【不具合】ビタミンを あげても のこりが 1 へらない');
    if (!after.cool) notes.push('【仕様と ちがう】ビタミンを あげた あとも ボタンが 灰色に ならない（1日1かい）');
    // もう 1かい おす → doneToday の ことば
    await p.click('#care [data-care="vitamin"]'); await p.waitForTimeout(500);
    await shot('46_vitamin_done_today');
    const left2 = await p.evaluate(() => G.state.inv.food_vitamin);
    if (left2 !== after.left) notes.push('【不具合】1日に 2かい ビタミンが へった');
    // おんど ダイヤル：ファンを 入れる（ヒーターは ある）
    await openShop('equip');
    await p.evaluate(() => document.querySelector('#shop-list [data-id="fan"]')?.scrollIntoView({ block: 'center' }));
    await buy('fan');
    await buy('auto_feeder');
    await openTank(fresh.slot);
    const thermoVis = await p.evaluate(() => !document.getElementById('thermo')?.hidden);
    if (!thermoVis) notes.push('【不具合】ヒーターと ファンが あるのに おんど ダイヤルが 出ない');
    await shot('47_thermo');
    // ベタを 入れて すずしい(23ど) を おす → えらべない はず
    await p.evaluate(() => { const t = G.tank(); G.state.coins += 500; const r = G.sim.buyFish(G.state, 'betta', t); G.emit('changed'); return r.ok; });
    await p.waitForTimeout(800);
    const thermo0 = await p.evaluate(() => G.tank().thermo);
    await p.click('#thermo [data-step="cool"]'); await p.waitForTimeout(600);
    await shot('48_thermo_unsafe');
    const thermo1 = await p.evaluate(() => G.tank().thermo);
    notes.push(`おんど：ベタが いる すいそうで すずしい を おした → ${thermo0}→${thermo1}`);
    if (thermo1 === 'cool') notes.push('【不具合】ベタが いるのに すずしい（23ど）を えらべて しまう（仕様 2-2 safeOnly）');
    await p.click('#thermo [data-step="warm"]'); await p.waitForTimeout(600);
    const thermo2 = await p.evaluate(() => G.tank().thermo);
    if (thermo2 !== 'warm') notes.push('【不具合】あたたかい（27ど）を えらべない');
    // じどう えさやり の スイッチ
    // おんど ダイヤル：あわない 段は 灰色（out）で、おしても かわらない
    const outCls = await p.evaluate(() => [...document.querySelectorAll('#thermo .th-step')].map((b) => b.dataset.step + ':' + (b.classList.contains('out') || b.disabled ? 'はいいろ' : 'おせる')));
    notes.push('おんど ダイヤル（ベタ いり）: ' + outCls.join(' '));
    // じどう えさやり の スイッチ
    const sw = await p.$('#feeder-sw:not([hidden])');
    if (!sw) notes.push('【仕様と ちがう】じどう えさやり の いり／きり スイッチが 見つからない（仕様 2-1）');
    else {
      const s0 = await p.evaluate(() => ({ on: G.tank().feederOn !== false, text: document.querySelector('#feeder-sw .fs-state')?.textContent }));
      await p.click('#feeder-sw'); await p.waitForTimeout(400);
      const s1 = await p.evaluate(() => ({ on: G.tank().feederOn !== false, text: document.querySelector('#feeder-sw .fs-state')?.textContent }));
      await shot('48b_feeder_off');
      notes.push(`じどう えさ スイッチ: ${JSON.stringify(s0)} → ${JSON.stringify(s1)}`);
      if (s0.on === s1.on) notes.push('【不具合】じどう えさ の スイッチを おしても かわらない');
      // きり の まま 8じを こえても あげない
      const fedOff = await p.evaluate(() => { const t = G.tank(); const f = t.fish.find((x) => G.data.fishById[x.speciesId]?.kind !== 'snail'); const m = ((G.state.clock.min % 1440) + 1440) % 1440; let d = 8 * 60 - 1 - m; if (d <= 0) d += 1440; G.sim.tick(G.state, d); f.onaka = 20; G.sim.tick(G.state, 2); return f.onaka; });
      if (fedOff > 25) notes.push(`【不具合】じどう えさ きり なのに 8じに あげた（おなか 20→${fedOff.toFixed(1)}）`);
      await p.click('#feeder-sw'); await p.waitForTimeout(300);
    }
    // エビ 7ひきめ：さかな・エビを 6ぴきに してから ミナミヌマエビを えらぶ
    {
      const n = await p.evaluate(() => G.tank().fish.filter((f) => G.data.fishById[f.speciesId]?.kind !== 'snail').length);
      await openShop('fish');
      for (let i = n; i < 6; i++) await buy('minami_shrimp');
      await p.evaluate(() => document.querySelector('#shop-list [data-id="minami_shrimp"]')?.scrollIntoView({ block: 'center' }));
      await p.click('#shop-list [data-id="minami_shrimp"]'); await p.waitForTimeout(300);
      const msg = await p.textContent('#dialog .modal-body').catch(() => '');
      const can7 = !!(await p.$('#dialog .btn.primary'));
      await shot('48c_shrimp7');
      await p.click('#dialog .btn').catch(() => {}); await p.waitForTimeout(300);
      notes.push(`エビ 7ひきめ: ${can7 ? '【不具合】かえて しまう' : 'かえない'}「${(msg || '').replace(/\s+/g, ' ').slice(-50)}」`);
      await openTank(fresh.slot);
    }
    // おんがく
    const bgmBtn = await p.$('#btn-bgm:not([hidden])');
    if (!bgmBtn) notes.push('おんがく ボタン：まだ 出ていない（BGM が とどいて いない？）');
    else {
      const tracks = await p.evaluate(async () => { try { const m = await import('./js/bgm.js'); return m.TRACKS.map((t) => t.file); } catch (e) { return []; } });
      const missing = tracks.filter((f) => !existsSync(join(ROOT, f)));
      notes.push(`おんがくの ファイル: ${tracks.length}きょく${missing.length ? '・【不具合】ない: ' + missing.join(', ') : '・ぜんぶ ある'}`);
      await p.click('#btn-bgm'); await p.waitForTimeout(500);
      await shot('49_bgm_picker');
      const rows = await p.$$('#bgm-picker .bgm-row');
      if (rows.length !== 5) notes.push(`【不具合】おんがくの 曲が ${rows.length}きょく（5きょく の はず）`);
      const cur = async () => p.evaluate(async () => { try { const m = await import('./js/bgm.js'); return m.current(); } catch (e) { return { err: e.message }; } });
      if (rows[0]) { await rows[0].click(); await p.waitForTimeout(2500); }
      const s1 = await cur();
      notes.push('おんがく えらぶ：' + JSON.stringify(s1));
      if (!s1.playing) notes.push('【不具合？】曲を えらんでも ながれない（ヘッドレスの ブラウザ では 音が 出ない ことも ある）');
      await shot('50_bgm_playing');
      // きりかえ（えらぶと パネルが とじるので もういちど ひらく）
      const reopen = async () => { if (await p.evaluate(() => document.getElementById('bgm-picker').hidden)) { await p.click('#btn-bgm'); await p.waitForTimeout(500); } };
      await reopen();
      const rows2 = await p.$$('#bgm-picker .bgm-row');
      if (rows2[3]) { await rows2[3].click(); await p.waitForTimeout(2500); }
      const s2 = await cur();
      notes.push('おんがく きりかえ：' + JSON.stringify(s2));
      if (s2.id === s1.id || !s2.playing) notes.push('【不具合】おんがくの きりかえが できない');
      await shot('50b_bgm_switch');
      await reopen();
      await p.click('#bgm-picker .bgm-stop'); await p.waitForTimeout(1200);
      const s3 = await cur();
      notes.push('おんがく とめる：' + JSON.stringify(s3));
      if (s3.on || s3.playing) notes.push('【不具合】「とめる」で おんがくが とまらない');
      await p.click('#bgm-picker .bgm-close').catch(() => {}); await p.waitForTimeout(300);
      // リロード しても えらんだ 曲・オフが のこる（localStorage）
      const saved = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('osakana-room-bgm') || 'null'); } catch { return null; } });
      notes.push('おんがくの せってい: ' + JSON.stringify(saved));
    }
    await goRoom(); await p.waitForTimeout(800);
    await shot('51_room_v03');
  }
}

const pw = findPlaywright();
const exe = findBrowser();
const srv = await serve();
const base = `http://127.0.0.1:${srv.address().port}`;
console.log('ブラウザ:', exe);
console.log('しゃしんの ばしょ:', OUT);
const browser = await pw.chromium.launch({ executablePath: exe, headless: !HEADED, args: GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
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
    if (r.errors.length || r.notes.some((n) => /【不具合|【仕様と/.test(n))) bad++;
  }
} finally {
  await browser.close();
  srv.close();
}
writeFileSync(join(OUT, 'result.json'), JSON.stringify(results, null, 2));
console.log(`\nけっか: ${bad ? '× だめな ところ あり' : '○ とおった'}（くわしくは ${join(OUT, 'result.json')}）`);
process.exit(bad ? 1 : 0);
