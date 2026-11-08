// v0.6 図鑑係：つり（うみ）と ガサガサ（いけ）の 生きもの データの テスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FISH, exists, read, KANJI } from './_lib.js';
import { COMPAT, compatOf } from '../js/data/compat.js';
import { SPECIES_DEFAULTS } from '../js/aquarium/speciesDefaults.js';

const byId = Object.fromEntries(FISH.map((f) => [f.id, f]));
const FISHING = FISH.filter((f) => f.obtain === 'fishing');
const GASA = FISH.filter((f) => f.obtain === 'gasagasa');
const SALT = FISH.filter((f) => f.water === 'salt');
const POND = FISH.filter((f) => f.water === 'pond');
const KINDS = ['fish', 'shrimp', 'snail'];

test('v0.6 図鑑：obtain は shop（なし）・fishing・gasagasa だけ。fishing は うみ、gasagasa は いけ、どちらも おみせに 出ない', () => {
  for (const f of FISH) {
    if (f.obtain === undefined) { assert.notEqual(f.water, 'pond', `${f.id}：いけの 子が おみせに いる`); continue; }
    assert.ok(['fishing', 'gasagasa'].includes(f.obtain), `${f.id} obtain=${f.obtain}`);
    assert.equal(f.price, null, `${f.id} は price: null`);
    assert.equal(f.unlock, undefined, `${f.id} に unlock は いらない`);
  }
  for (const f of FISHING) assert.equal(f.water, 'salt', f.id);
  for (const f of GASA) assert.equal(f.water, 'pond', f.id);
  assert.deepEqual(POND.map((f) => f.id), GASA.map((f) => f.id), 'いけの 子は ぜんぶ ガサガサ');
});

test('v0.6 図鑑：かず（つり 15〜18・いけ 18〜24）と レア度 1〜5 が ぜんぶ ある', () => {
  assert.ok(FISHING.length >= 15 && FISHING.length <= 18, `つり ${FISHING.length}`);
  assert.ok(GASA.length >= 18 && GASA.length <= 24, `いけ ${GASA.length}`);
  for (const list of [FISHING, GASA]) {
    for (let r = 1; r <= 5; r++) assert.ok(list.some((f) => f.rarity === r), `rarity ${r} が いない`);
    // レアほど すくない（1 が いちばん おおい、5 が いちばん すくない）
    const n = (r) => list.filter((f) => f.rarity === r).length;
    assert.ok(n(1) >= n(3) && n(3) >= n(5), 'レアほど すくない');
  }
});

test('v0.6 図鑑：タコと イカは うみの つりで レア（4〜5）', () => {
  const tako = FISHING.filter((f) => /[タダ]コ$/.test(f.name));   // マダコ など
  const ika = FISHING.filter((f) => /イカ$/.test(f.name));
  assert.ok(tako.length >= 1 && ika.length >= 1, 'タコ・イカが いない');
  for (const f of [...tako, ...ika]) assert.ok(f.rarity >= 4, `${f.name} rarity ${f.rarity}`);
});

test('v0.6 図鑑：いけに カメ・カエル・ザリガニが いて、カメ・カエルは りくちに あがる（habit land）', () => {
  const kame = GASA.filter((f) => /[カガ]メ$/.test(f.name) && f.name !== 'タガメ');   // タガメは むし
  const kaeru = GASA.filter((f) => f.name.endsWith('ガエル'));
  assert.ok(kame.length >= 1 && kaeru.length >= 1, 'カメ・カエルが いない');
  assert.ok(GASA.some((f) => f.name.includes('ザリガニ')), 'ザリガニが いない');
  for (const f of [...kame, ...kaeru]) {
    assert.equal(f.swim.habit, 'land', f.id);
    assert.equal(SPECIES_DEFAULTS[f.id].swim.habit, 'land', f.id);
  }
  // ほかの 水の 子には land を つけない（いけの すいそう だけが りくち つき）
  for (const f of FISH) if (f.swim?.habit === 'land') assert.equal(f.water, 'pond', f.id);
});

test('v0.6 図鑑：新しい 子の 形（kind・space・likes・vitamin・文字・絵・3D の 予備）', () => {
  const pondTags = new Set(['plant', 'stone', 'driftwood']);
  const saltTags = new Set(['stone', 'liverock', 'coral', 'seaweed', 'anemone', 'shell', 'cave']);
  for (const f of [...FISHING, ...GASA]) {
    assert.ok(KINDS.includes(f.kind), `${f.id} kind`);
    if (f.kind === 'snail') assert.equal(f.space, 0, f.id); else assert.ok(f.space > 0 && f.space <= 2, `${f.id} space`);
    assert.ok(f.likes.length >= 1, f.id);
    for (const t of f.likes) assert.ok((f.water === 'pond' ? pondTags : saltTags).has(t), `${f.id} の likes ${t}`);
    assert.ok(['love', 'ok', 'dislike'].includes(f.vitamin), f.id);
    assert.ok(f.sizeCm.length === 3 && f.sizeCm[0] < f.sizeCm[1] && f.sizeCm[1] <= f.sizeCm[2], `${f.id} sizeCm`);
    for (const k of ['name', 'intro', 'hint']) assert.ok(f[k] && !KANJI.test(f[k]), `${f.id} ${k} に 漢字`);
    assert.equal(f.texture, `assets/fish/${f.id}.png`);
    assert.ok(exists(f.texture), `${f.texture} が ない`);
    assert.ok(read('sw.js').includes(`'${f.texture}'`), `${f.texture} が sw.js に ない`);
    const d = SPECIES_DEFAULTS[f.id];
    assert.ok(d && d.kind === f.kind && d.water === f.water, `${f.id} の speciesDefaults`);
  }
});

test('v0.6 図鑑：相性は 新しい 子の くみあわせが ぜんぶ 書いてある（いけどうし・うみの つり×うみ ぜんぶ）', () => {
  const missing = [];
  const check = (a, b) => { const k = a < b ? `${a}|${b}` : `${b}|${a}`; if (!(k in COMPAT)) missing.push(k); };
  for (const a of FISHING) for (const b of SALT) check(a.id, b.id);
  for (const a of GASA) for (const b of POND) check(a.id, b.id);
  assert.deepEqual([...new Set(missing)], []);
  // たべる 子は ちいさな 子と にがて、でも だれとでも にがて では ない
  assert.equal(compatOf('madako', 'skunk_shrimp'), 0);
  assert.equal(compatOf('tagame', 'otamajakushi'), 0);
  for (const id of ['madako', 'aoriika', 'tagame', 'namazu']) {
    const pool = byId[id].water === 'pond' ? POND : SALT;
    assert.ok(pool.some((o) => o.id !== id && compatOf(id, o.id) >= 1), `${id} が だれとでも にがて`);
  }
});
