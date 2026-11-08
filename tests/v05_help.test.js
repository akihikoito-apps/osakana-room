// v0.5 の テスト（案内係）：こうしん りれき の かたち・ヘルプの 数字が balance.js と ずれない・ファイルの もれ
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balance, read, exists, KANJI } from './_lib.js';
import { CHANGELOG } from '../js/data/changelog.js';
import { helpTopics, quizCost } from '../js/data/help.js';

const VER = /^\d+\.\d+\.\d+$/;
const verNum = (v) => v.split('.').map(Number).reduce((a, n) => a * 1000 + n, 0);

test('こうしん りれき：かたち・あたらしい ものが うえ・かんじ なし', () => {
  assert.ok(Array.isArray(CHANGELOG) && CHANGELOG.length >= 6);
  assert.match(CHANGELOG[0].ver, VER, 'いちばん うえの ver は 0.5.0 の かたち（js/version.js と おなじ かたち）');
  const seen = new Set();
  CHANGELOG.forEach((e, i) => {
    assert.match(e.ver, VER, e.ver);
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, e.ver + ' の date');
    assert.ok(!seen.has(e.ver), 'おなじ 版が 2かい ' + e.ver); seen.add(e.ver);
    assert.ok(typeof e.title === 'string' && e.title.length > 0, e.ver + ' の title');
    assert.ok(Array.isArray(e.items) && e.items.length > 0, e.ver + ' の items');
    for (const t of [e.title, ...e.items]) assert.ok(!KANJI.test(t), `かんじが ある：${e.ver} ${t}`);
    if (i > 0) {
      const prev = CHANGELOG[i - 1];
      assert.ok(verNum(prev.ver) > verNum(e.ver), `${prev.ver} は ${e.ver} より うえ`);
      assert.ok(prev.date >= e.date, `${prev.ver} の 日づけ`);
    }
  });
  for (const v of ['0.1.0', '0.2.0', '0.3.0', '0.3.1', '0.4.0']) assert.ok(seen.has(v), v + ' が ない');
});

test('こうしん りれき：いまの 版（js/version.js）より ふるい ものは のって いる', () => {
  const m = read('js/version.js').match(/VERSION\s*=\s*'([\d.]+)'/);
  assert.ok(m);
  assert.ok(verNum(CHANGELOG[0].ver) >= verNum(m[1]), 'りれきの いちばん うえが いまの 版より ふるい');
});

test('ヘルプ：7つの みだし・かんじ なし・1つの ばめんは 4ぎょう まで・絵が ある', () => {
  const cats = helpTopics(balance);
  assert.equal(cats.length, 7);
  const ids = new Set();
  for (const c of cats) {
    assert.ok(!ids.has(c.id)); ids.add(c.id);
    assert.ok(c.ic && c.label && c.topics.length > 0, c.id);
    if (c.pic) assert.ok(exists(c.pic), c.pic + ' が ない');
    for (const t of c.topics) {
      assert.ok(t.lines.length >= 1 && t.lines.length <= 4, `${c.id}/${t.h} は ${t.lines.length}ぎょう`);
      if (t.pic) assert.ok(exists(t.pic), t.pic + ' が ない');
      for (const s of [c.label, t.h, ...t.lines, t.note || '']) {
        assert.ok(!KANJI.test(s), `かんじが ある：${s}`);
        assert.ok(!/undefined|NaN|\$\{/.test(s), `数が うまって いない：${s}`);
      }
    }
  }
});

test('ヘルプ：数字が balance.js と おなじ', () => {
  const all = helpTopics(balance).flatMap((c) => c.topics.flatMap((t) => [...t.lines, t.note || ''])).join('\n');
  const has = (s, why) => assert.ok(all.includes(s), `${why}：「${s}」が ヘルプに ない`);
  has(`${balance.HEART.perDay}こ まで`, 'ハートの 1にちの かず');
  has(`あさ ${balance.TIME.dayStartHour}じ`, '1にちの はじまり');
  const sec = Math.round((balance.HEART.perFishEveryGameMinutes / 60) * balance.TIME.realSecPerGameHour);
  has(`${sec}びょう`, 'おなじ さかなの まちじかん');
  has(`えさを あげると ${balance.COIN.care.feed.coin}コイン`, 'えさの コイン');
  has(`みずかえで ${balance.COIN.care.waterChange.coin}コイン`, 'みずかえの コイン');
  has(`ときどき ${balance.COIN.pet.coin}コイン`, 'なでた ときの コイン');
  has(`1にち ${balance.COIN.care.feed.perDay}かい`, 'えさの かいすう');
  has(`${balance.COIN.care.waterChange.perDay}かい まで`, 'みずかえの かいすう');
  has(`1にち ${balance.COIN.careDailyCap}まで`, 'おせわ コインの 上限');
  has(`ハート ${quizCost(balance)}こ`, 'クイズの ハート');
  has(`${balance.UNLOCK.tank6.count}ぴき いると`, 'うみの すいそう');
  has(`${balance.TANKS.max}つまで`, 'すいそうの かず');
  has(`1にち ${balance.VITAMIN.perTankPerDay}かい`, 'ビタミン');
  has(balance.THERMO.steps.map((s) => s.temp).join('・') + 'ど', 'おんど ダイヤル');
  // ゲーム係が balance.js に ミニゲームの 数を 足したら、それに あわせる（いまは 10）
  const sim = read('js/sim.js').match(/MINIGAME:\s*\{\s*quiz:\s*\{\s*cost:\s*(\d+)/);
  assert.equal(quizCost(balance), balance.MINIGAME?.quiz?.cost ?? (sim ? Number(sim[1]) : 10), 'ゲーム係の クイズの ハートの かずと ちがう');
});

test('ヘルプ・りれき：画面・ボタン・キャッシュ・せの え', () => {
  const html = read('index.html');
  for (const s of ['id="scr-help"', 'data-screen="help"', 'id="scr-changelog"', 'data-screen="changelog"', 'id="help-nav"', 'id="help-body"', 'id="log-list"', 'id="btn-help"', 'id="btn-log"', 'css/help.css']) assert.ok(html.includes(s), s);
  const sw = read('sw.js');
  for (const f of ['js/ui/help.js', 'js/ui/changelog.js', 'js/data/help.js', 'js/data/changelog.js', 'assets/ui/help_bg.jpg']) {
    assert.ok(exists(f), f + ' が ない');
    assert.ok(sw.includes(`'${f}'`), 'sw.js に ' + f + ' が ない');
  }
  assert.ok(read('css/help.css').includes('assets/ui/help_bg.jpg'));
  const main = read('js/main.js');
  assert.ok(main.includes("'./ui/help.js'") && main.includes("'./ui/changelog.js'"));
});
