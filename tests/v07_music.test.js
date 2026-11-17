// v0.7 の テスト（音楽係）：たのしい 曲 3つ・TRACKS と sw.js と ファイルが そろう・大きさ・画面の わけかた
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, read, exists, KANJI } from './_lib.js';
import { TRACKS, KINDS } from '../js/bgm.js';

const NEW = ['parade', 'matsuri', 'skip'];
const OLD = ['pokapoka', 'hidamari', 'yurayura', 'suichu', 'ohirune'];

test('TRACKS：8曲（まえの 5曲は そのまま さきに・たのしい 3曲を たした）', () => {
  assert.equal(TRACKS.length, 8);
  assert.deepEqual(TRACKS.slice(0, 5).map((t) => t.id), OLD, 'まえの 曲の ならび（TRACKS[0] は 既定の 曲）');
  for (const id of NEW) assert.ok(TRACKS.some((t) => t.id === id), id + ' が ない');
  assert.equal(new Set(TRACKS.map((t) => t.id)).size, TRACKS.length, 'id が かぶっている');
  assert.equal(new Set(TRACKS.map((t) => t.name)).size, TRACKS.length, '曲名が かぶっている');
});

test('TRACKS：どの 曲にも 種類（たのしい／まったり）・絵・みじかい 説明・ループの 秒数が ある', () => {
  const kindIds = KINDS.map((k) => k.id);
  assert.deepEqual(kindIds.slice().sort(), ['mattari', 'tanoshii']);
  for (const t of TRACKS) {
    assert.ok(kindIds.includes(t.kind), t.id + ' の kind');
    assert.ok(typeof t.icon === 'string' && t.icon.length > 0, t.id + ' の icon');
    assert.ok(typeof t.note === 'string' && t.note.length > 0 && t.note.length <= 14, t.id + ' の note が ながい／ない: ' + t.note);
    assert.ok(t.loop > 30 && t.loop < 120, t.id + ' の loop');
    assert.ok(Math.abs(t.loop * 100 - Math.round(t.loop * 100)) < 1e-6, t.id + ' の loop が 0.01 秒の 倍数で ない');
  }
  for (const id of NEW) assert.equal(TRACKS.find((t) => t.id === id).kind, 'tanoshii', id);
  for (const id of OLD) assert.equal(TRACKS.find((t) => t.id === id).kind, 'mattari', id);
});

test('曲名・説明・見出しに 漢字が ない（ひらがな・カタカナ）', () => {
  for (const t of TRACKS) for (const s of [t.name, t.note, t.mood]) assert.ok(!KANJI.test(s), t.id + ': ' + s);
  for (const k of KINDS) assert.ok(!KANJI.test(k.label), k.label);
});

test('曲の ファイルが ぜんぶ ある・m4a（ftyp）・1曲 1.3MB まで', () => {
  for (const t of TRACKS) {
    assert.ok(exists(t.file), t.file + ' が ない');
    assert.match(t.file, /^assets\/bgm\/[a-z]+\.m4a$/);
    const p = join(ROOT, t.file);
    const size = statSync(p).size;
    assert.ok(size > 300 * 1024 && size < 1.3 * 1024 * 1024, `${t.file} が ${Math.round(size / 1024)}KB`);
    assert.equal(readFileSync(p).toString('latin1', 4, 8), 'ftyp', t.file + ' が mp4 で ない');
  }
  // あたらしい 3曲の 合計（ダウンロードが おもく なりすぎない）
  const sum = NEW.reduce((a, id) => a + statSync(join(ROOT, TRACKS.find((t) => t.id === id).file)).size, 0);
  assert.ok(sum < 3.3 * 1024 * 1024, `3曲で ${Math.round(sum / 1024)}KB`);
});

test('sw.js の キャッシュ一覧に 8曲 ぜんぶ ある（オフラインでも なる）', () => {
  const sw = read('sw.js');
  const miss = TRACKS.filter((t) => !sw.includes(`'${t.file}'`)).map((t) => t.file);
  assert.deepEqual(miss, []);
});

test('作曲データ（assets/bgm/src）に 新しい 3曲が あり、書き出し台本の 既定に 入っている', () => {
  const songs = read('assets/bgm/src/songs.js');
  for (const id of NEW) assert.match(songs, new RegExp(`BGM\\.SONGS\\.${id} = `), id);
  const render = read('assets/bgm/src/render.mjs');
  for (const id of [...OLD, ...NEW]) assert.ok(render.includes(`'${id}'`), 'render.mjs に ' + id + ' が ない');
  // ループの 秒数は 作曲データ（小節×拍子×60/BPM）と おなじ
  const want = { parade: [128, 4, 32], matsuri: [125, 4, 32], skip: [200, 6, 40] };
  for (const [id, [bpm, meter, bars]] of Object.entries(want)) {
    const blk = songs.slice(songs.indexOf(`BGM.SONGS.${id} = `)).slice(0, 400);
    assert.match(blk, new RegExp(`bpm: ${bpm}, meter: ${meter}, bars: ${bars}`), id + ' の テンポ');
    assert.equal(Math.round(bars * meter * 60 / bpm * 100) / 100, TRACKS.find((t) => t.id === id).loop, id + ' の loop');
  }
});

test('えらぶ 画面：種類ごとの 2れつ（bgm-ui.js が KINDS で わける・CSS が 2れつ）', () => {
  const ui = read('js/ui/bgm-ui.js');
  assert.match(ui, /B\.KINDS/);
  assert.match(ui, /bgm-col/);
  const css = read('css/style.css');
  assert.match(css, /\.bgm-list\.cols\s*\{[^}]*grid-template-columns:\s*1fr 1fr/);
  assert.match(css, /prefers-reduced-motion[^}]*bgm-row\.on \.bgm-ic/);
});
