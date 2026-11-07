// おさかなルーム BGM 5曲の作曲データ（全部オリジナル）
// 書き方：コードは chart('Fmaj7 | Am7 D7 | ...')、メロディは '音:拍' をならべる（r は休み）。
(function () {
  'use strict';
  const { Song, chart, voice, bassNote, mel } = BGM;

  // 小道具：コード表から、ある拍で鳴っているコードを返す
  const at = (chs, beat) => { let c = chs[0]; for (const x of chs) if (x.beat <= beat + 1e-6) c = x; return c; };
  const fifthOf = (root, max) => (root + 7 <= max ? root + 7 : root - 5);
  // 和音を下から少しずつずらして弾く（ポロロン）
  function strum(s, ch, beat, notes, dur, vel, o = {}) {
    const spread = o.spread ?? 0.012;
    notes.forEach((m, i) => {
      const v = vel * (i === notes.length - 1 ? 1 : (o.inner ?? 0.85));
      s.note(ch, beat, m, dur, v, { late: (o.late || 0) + i * spread, humanize: o.humanize, inst: o.inst });
    });
  }

  // =====================================================================
  // 1. ぽかぽか おへや（ほのぼの：マリンバ＋ピアノ＋ピチカート、F 100BPM 軽いスウィング）
  // =====================================================================
  BGM.SONGS.pokapoka = () => {
    const s = new Song({
      bpm: 100, meter: 4, bars: 32, swing: 0.58, seed: 11,
      reverb: { time: 1.8, damp: 0.6, pre: 0.02 },
      channels: {
        mel: { type: 'marimba', gain: 0.62, pan: 0.12, rev: 0.22 },
        glock: { type: 'musicbox', gain: 0.10, pan: 0.35, rev: 0.35 },
        pno: { type: 'piano', gain: 0.30, pan: -0.18, rev: 0.28 },
        bass: { type: 'bass', gain: 0.62, pan: 0, rev: 0.04, eq: [{ type: 'peaking', f: 160, q: 1, g: 3 }, { type: 'lowpass', f: 2500, q: 0.5 }] },
        shk: { type: 'shaker', gain: 0.10, pan: 0.35, rev: 0.08 },
        kick: { type: 'kick', gain: 0.14, pan: 0, rev: 0 },
      },
    });
    const A = 'F6 | Am7 D7 | Gm7 | C7 | F6 | Cm7 F7 | Bbmaj7 | Gm7 C7';
    const A2 = 'F6 | Am7 D7 | Gm7 | C7 | Am7 | D7 | Gm7 C7 | F6';
    const B = 'Bbmaj7 | Bbm6 | Am7 | D7 | Gm7 | C7 | Am7 D7 | Gm7 C7';
    const A3 = 'F6 | Am7 D7 | Gm7 | C7 | F6 | Cm7 F7 | Bbmaj7 Bbm6 | F6 C7';
    const chs = chart([A, A2, B, A3].join(' | '), 4);

    const mA = 'A4:1 C5:.5 F5:1 E5:.5 C5:1 | E5:.5 D5:.5 C5:1 A4:.5 C5:.5 D5:1 | Bb4:1 D5:.5 G5:1 F5:.5 D5:1 | E5:1.5 D5:.5 C5:1 r:1 |'
      + ' A4:1 C5:.5 F5:1 G5:.5 A5:1 | G5:.5 F5:.5 Eb5:1 D5:.5 C5:.5 A4:1 | D5:1 F5:.5 A5:1.5 G5:1 | D5:2 E5:1 r:1';
    const mA2 = 'A4:1 C5:.5 F5:1 E5:.5 C5:1 | E5:.5 D5:.5 C5:1 A4:.5 C5:.5 D5:1 | Bb4:1 D5:.5 G5:1 F5:.5 D5:1 | E5:.5 D5:.5 C5:1 r:2 |'
      + ' C5:1 E5:.5 A5:1 G5:.5 E5:1 | F#5:1.5 E5:.5 D5:1 C5:1 | D5:1 F5:1 E5:1 Bb4:1 | C5:.5 A4:1.5 r:2';
    const mB = 'D5:.5 F5:.5 A5:2 G5:1 | F5:1.5 Db5:.5 Bb4:2 | C5:.5 E5:.5 G5:2 E5:1 | F#5:1.5 A5:.5 F#5:1 D5:1 |'
      + ' Bb4:.5 D5:.5 F5:1.5 G5:.5 A5:1 | Bb5:1.5 A5:.5 G5:1 E5:1 | G5:1 E5:.5 C5:.5 F#5:1 D5:1 | D5:1 F5:1 E5:1 G5:1';
    const mA3 = 'A4:1 C5:.5 F5:1 E5:.5 C5:1 | E5:.5 D5:.5 C5:1 A4:.5 C5:.5 D5:1 | Bb4:1 D5:.5 G5:1 F5:.5 D5:1 | E5:1.5 D5:.5 C5:1 r:1 |'
      + ' A4:1 C5:.5 F5:1 G5:.5 A5:1 | G5:.5 F5:.5 Eb5:1 D5:.5 C5:.5 A4:1 | D5:1 A5:1 F5:1 Db5:1 | C5:1 A4:1 r:2';
    let b = 0;
    b = s.melody('mel', mA, b, 0.62);
    b = s.melody('mel', mA2, b, 0.64);
    const bB = b;
    b = s.melody('mel', mB, b, 0.6);
    s.melody('glock', mB, bB, 0.45); // B だけ オルゴールを 同じ高さで うすく重ねる（Codex・agy：1オクターブ上は高すぎ）
    b = s.melody('mel', mA3, b, 0.62);

    // ピアノ（A は 1拍目と2拍目のウラ、B はゆったり伸ばす）
    let prev = null;
    for (const c of chs) {
      const v = voice(c.ch, prev, { lo: 50, hi: 68, n: 4 }); prev = v;
      const bar = Math.floor(c.beat / 4);
      const inB = bar >= 16 && bar < 24;
      if (inB) strum(s, 'pno', c.beat, v, c.dur * 0.95, 0.46, { spread: 0.02 });
      else {
        strum(s, 'pno', c.beat, v, c.dur === 4 ? 1.4 : 1.3, 0.48, { spread: 0.006 });
        if (c.dur === 4) strum(s, 'pno', c.beat + 2.5, v, 1.2, 0.36, { spread: 0.006 });
      }
    }
    // ベース（1拍目と3拍目、ときどき次へのつなぎ）
    chs.forEach((c, i) => {
      const r = bassNote(c.ch, 36);
      s.note('bass', c.beat, r, 1.4, 0.72);
      if (c.dur === 4) {
        s.note('bass', c.beat + 2, fifthOf(r, 50), 1.2, 0.6);
        const nx = chs[(i + 1) % chs.length];
        const nr = bassNote(nx.ch, 36);
        if (i % 2 === 1) s.note('bass', c.beat + 3.5, nr + (nr > r ? -1 : 1), 0.45, 0.42); // 半音でつなぐ
      }
    });
    // シェイカー（ウラを少し強く）とやわらかいキック（A2 から）
    for (let bt = 0; bt < 128; bt += 0.5) {
      const off = bt % 1 !== 0;
      s.note('shk', bt, 60, 0.2, off ? 0.55 : 0.36);
    }
    for (let bar = 8; bar < 32; bar++) { s.note('kick', bar * 4, 36, 0.5, 0.6); s.note('kick', bar * 4 + 2, 36, 0.5, 0.45); }
    return s;
  };

  // =====================================================================
  // 2. ひだまり カフェ（ボサノバ：ナイロンギター＋ウッドベース＋ブラシ＋ビブラフォン、D 120BPM）
  // =====================================================================
  BGM.SONGS.hidamari = () => {
    const s = new Song({
      bpm: 120, meter: 4, bars: 32, swing: 0.5, seed: 22, humanize: 0.005,
      reverb: { time: 1.6, damp: 0.65, pre: 0.018 },
      channels: {
        vib: { type: 'vibes', gain: 0.40, pan: 0.18, rev: 0.3 },
        gtr: { type: 'nylon', gain: 0.55, pan: -0.2, rev: 0.2, eq: [{ type: 'peaking', f: 120, q: 1.2, g: 3 }, { type: 'peaking', f: 230, q: 1.4, g: 2 }, { type: 'highshelf', f: 4000, g: -4 }] },
        bass: { type: 'bass', gain: 0.55, pan: 0.05, rev: 0.04, eq: [{ type: 'peaking', f: 170, q: 1, g: 3 }, { type: 'lowpass', f: 2200, q: 0.5 }] },
        rim: { type: 'rim', gain: 0.10, pan: 0.25, rev: 0.12 },
        brush: { type: 'brush', gain: 0.16, pan: -0.1, rev: 0.12 },
        shk: { type: 'shaker', gain: 0.07, pan: 0.35, rev: 0.08 },
        kick: { type: 'kick', gain: 0.18, pan: 0, rev: 0 },
      },
    });
    const A = 'Dmaj7 | Bm9 | Em9 | A13 | F#m7 | B7b13 | Em9 | A7sus4 A7';
    const A2 = 'Dmaj7 | Bm9 | Em9 | A13 | F#m7 B7 | Em7 A7 | Dmaj7 | Am7 D7';
    const B = 'Gmaj7 | Gm6 | F#m7 | B7 | Em9 | A13 | Dmaj7 | Em7 A7';
    const A3 = 'Dmaj7 | Bm9 | Em9 | A13 | F#m7 B7 | Em7 A7 | Dmaj7 | Em7 A7';
    const chs = chart([A, A2, B, A3].join(' | '), 4);

    const head = 'r:.5 F#5:1 E5:.5 F#5:1.5 A5:2.5 F#5:.5 E5:.5 D5:1 | r:.5 B4:.5 E5:.5 G5:1.5 F#5:1 | E5:1 B5:1.5 A5:.5 F#5:1 |';
    const mA = head + ' r:.5 C#5:1 E5:.5 A5:1.5 F#5:.5 | D#5:1.5 F#5:.5 A5:1 G5:1 | F#5:2 E5:1 B4:1 | D5:1.5 E5:.5 C#5:2';
    const mA2 = head + ' r:.5 C#5:1 E5:.5 A5:1 F#5:1 | G5:1.5 F#5:.5 E5:1 C#5:1 | D5:3 r:1 | r:.5 C5:1 E5:.5 F#5:1 A5:1';
    const mB = 'B5:2.5 A5:.5 F#5:1 | E5:2.5 D5:.5 Bb4:1 | A4:.5 C#5:.5 E5:1 A5:2 | F#5:1 D#5:1 B4:1 D#5:1 |'
      + ' F#5:1.5 G5:.5 B5:2 | A5:1 F#5:1 E5:1 C#5:1 | A4:1 D5:.5 E5:.5 F#5:2 | G5:1 E5:1 C#5:1 E5:1';
    const mA3 = head + ' r:.5 C#5:1 E5:.5 A5:1 F#5:1 | G5:1.5 F#5:.5 E5:1 C#5:1 | A5:2 F#5:2 | E5:1.5 D5:.5 C#5:1 r:1';
    let b = 0;
    b = s.melody('vib', mA, b, 0.58);
    b = s.melody('vib', mA2, b, 0.6);
    b = s.melody('vib', mB, b, 0.58);
    b = s.melody('vib', mA3, b, 0.6);

    // ギター：2小節でひとまわりの刻み（1小節目 0, 1.5, 3 / 2小節目 1, 2.5）
    const pat = [[0, 1.5, 3], [1, 2.5]];
    const pat2 = [0, 2, 3]; // 1小節に コードが 2つの 小節（agy：前のコードが のこって ぶつかる）
    let prev = null;
    const vCache = new Map();
    const vOf = (c) => { if (!vCache.has(c)) { const v = voice(c.ch, prev, { lo: 52, hi: 67, n: 4 }); prev = v; vCache.set(c, v); } return vCache.get(c); };
    for (let bar = 0; bar < 32; bar++) {
      const two = at(chs, bar * 4) !== at(chs, bar * 4 + 2);
      for (const p of (two ? pat2 : pat[bar % 2])) {
        const bt = bar * 4 + p;
        const c = at(chs, bt);
        const v = vOf(c);
        const accent = p === 0 ? 0.56 : 0.48;
        strum(s, 'gtr', bt, v, 0.85, accent, { spread: 0.008, inner: 0.8 });
      }
    }
    // ベース：ドーン・ド ドーン・ド（1拍目と3拍目、裏はそっと）
    for (let bar = 0; bar < 32; bar++) {
      const c1 = at(chs, bar * 4), c2 = at(chs, bar * 4 + 2);
      const r1 = bassNote(c1.ch, 38), r2 = bassNote(c2.ch, 38);
      s.note('bass', bar * 4, r1, 1.4, 0.7);
      s.note('bass', bar * 4 + 1.5, r1, 0.45, 0.38);
      const f2 = c1 === c2 ? fifthOf(r1, 50) : r2;
      s.note('bass', bar * 4 + 2, f2, 1.4, 0.62);
      s.note('bass', bar * 4 + 3.5, f2, 0.45, 0.36);
      s.note('kick', bar * 4, 36, 0.4, 0.5); s.note('kick', bar * 4 + 2, 36, 0.4, 0.42);
    }
    // ブラシ：毎拍そっと（2拍目と4拍目を少し強く）、リム：クラーベ（A2 から）、シェイカー：B から
    const clave = [[0, 1.5, 3], [1, 2]];
    for (let bar = 0; bar < 32; bar++) {
      for (let q = 0; q < 4; q++) s.note('brush', bar * 4 + q, 60, 0.5, q % 2 ? 0.6 : 0.42);
      if (bar >= 8 && !(bar >= 16 && bar < 24)) for (const p of clave[bar % 2]) s.note('rim', bar * 4 + p, 60, 0.1, 0.5);
      if (bar >= 16 && bar < 24) for (let e = 0; e < 8; e++) s.note('shk', bar * 4 + e * 0.5, 60, 0.2, e % 2 ? 0.5 : 0.32);
    }
    return s;
  };

  // =====================================================================
  // 3. ゆらゆら ティータイム（ローファイジャズ：エレピ＋フェルトピアノ＋やわらかいドラム、E♭ 80BPM スウィング）
  // =====================================================================
  BGM.SONGS.yurayura = () => {
    const s = new Song({
      bpm: 80, meter: 4, bars: 24, swing: 0.61, seed: 33, humanize: 0.008,
      masterLP: 8500,
      reverb: { time: 2.0, damp: 0.75, pre: 0.025 },
      channels: {
        lead: { type: 'felt', gain: 0.55, pan: 0.15, rev: 0.3 },
        rh: { type: 'rhodes', gain: 0.40, pan: -0.1, rev: 0.22, autopan: { f: 0.25, depth: 0.35 }, eq: [{ type: 'lowpass', f: 3500, q: 0.4 }] },
        rhl: { type: 'rhodes', gain: 0.22, pan: 0.3, rev: 0.35, delay: { time: 0.75, fb: 0.3, mix: 0.25, lp: 2500, pan: -0.4 } },
        bass: { type: 'bass', gain: 0.65, pan: 0, rev: 0.03, eq: [{ type: 'peaking', f: 200, q: 1, g: 4 }, { type: 'lowpass', f: 1800, q: 0.5 }] },
        kick: { type: 'kick', gain: 0.20, pan: 0, rev: 0.02 },
        snr: { type: 'snare', gain: 0.14, pan: 0.05, rev: 0.15, eq: [{ type: 'lowpass', f: 3500, q: 0.5 }] },
        hat: { type: 'hat', gain: 0.07, pan: 0.25, rev: 0.05, eq: [{ type: 'lowpass', f: 8000, q: 0.5 }] },
      },
    });
    const C = 'Abmaj9 | Gm7 | Fm9 | Bb13 | Ebmaj9 | Cm9 | Fm9 | Bb9sus4';
    const C3 = 'Abmaj9 | Gm7 | Fm9 | Bb13 | Ebmaj9 | Cm9 | Fm9 | Bb13';
    const chs = chart([C, C, C3].join(' | '), 4);

    const m2 = 'r:1 C5:.5 Eb5:.5 G5:1 F5:1 | D5:2 Bb4:1 r:1 | r:.5 Ab4:.5 C5:.5 Eb5:.5 G5:1.5 F5:.5 | F5:1 D5:1 r:2 |'
      + ' r:1 G5:.5 Bb5:.5 F5:1 D5:1 | Eb5:2 r:.5 G4:.5 Bb4:.5 C5:.5 | Eb5:1.5 C5:.5 Ab4:2 | r:2 F4:.5 Ab4:.5 Bb4:.5 C5:.5';
    const m3 = 'r:1 C5:.5 Eb5:.5 G5:1 F5:1 | D5:2 Bb4:1 r:1 | r:.5 Ab4:.5 C5:.5 Eb5:.5 G5:1.5 F5:.5 | F5:1 D5:1 r:2 |'
      + ' G5:2 F5:1 D5:1 | Eb5:1 D5:.5 C5:.5 Bb4:2 | r:1 Ab4:.5 C5:.5 Eb5:1 F5:1 | D5:2 r:2';
    const m1 = 'r:2.5 Eb5:.5 G5:1 | F5:1.5 D5:.5 r:2 | r:2.5 C5:.5 Eb5:1 | D5:2 r:2 | r:2.5 G5:.5 Bb5:1 | G5:1.5 Eb5:.5 r:2 | r:2.5 Ab4:.5 C5:1 | Bb4:2 r:2';
    s.melody('rhl', m1, 0, 0.5, { late: 0.01 });
    s.melody('lead', m2, 32, 0.6, { late: 0.012 });
    s.melody('lead', m3, 64, 0.62, { late: 0.012 });

    let prev = null;
    for (const c of chs) {
      const v = voice(c.ch, prev, { lo: 50, hi: 67, n: 4 }); prev = v;
      strum(s, 'rh', c.beat, v, 2.4, 0.48, { spread: 0.01, late: 0.018 });
      strum(s, 'rh', c.beat + 2.5, v, 1.65, 0.44, { spread: 0.01, late: 0.018 }); // 4拍目で やせないよう 長めに
    }
    chs.forEach((c, i) => {
      const r = bassNote(c.ch, 36);
      s.note('bass', c.beat, r, 1.6, 0.72);
      s.note('bass', c.beat + 2.5, r + 12 <= 52 ? r + 12 : fifthOf(r, 50), 0.4, 0.45);
      s.note('bass', c.beat + 3, i % 2 ? fifthOf(r, 50) : r, 1.0, 0.55); // 半音のつなぎは和音とぶつかる（agy）ので 5度に
    });
    for (let bar = 0; bar < 24; bar++) {
      const B = bar * 4;
      const soft = bar < 8 ? 0.75 : 1; // 1まわり目は かるく
      s.note('kick', B, 36, 0.5, 0.6 * soft); s.note('kick', B + 2.5, 36, 0.5, 0.5 * soft);
      if (bar % 4 === 3) s.note('kick', B + 3.5, 36, 0.5, 0.35);
      s.note('snr', B + 1, 60, 0.3, 0.55 * soft, { late: 0.012 }); s.note('snr', B + 3, 60, 0.3, 0.55 * soft, { late: 0.012 });
      for (let e = 0; e < 8; e++) s.note('hat', B + e * 0.5, 60, 0.1, e % 2 ? 0.45 : 0.32);
    }
    return s;
  };

  // =====================================================================
  // 4. すいちゅう さんぽ（アンビエント：パッド＋ガラスのベル＋小さな泡、E 72BPM）
  // =====================================================================
  BGM.SONGS.suichu = () => {
    const s = new Song({
      bpm: 72, meter: 4, bars: 24, swing: 0.5, seed: 44, humanize: 0.01,
      masterLP: 9000,
      reverb: { time: 3.6, damp: 0.7, pre: 0.03 },
      channels: {
        pad: { type: 'pad', gain: 0.55, pan: 0, rev: 0.45, opt: { atk: 1.8, rel: 2.2, cut: 950, wob: { f: 0.15, depth: 250 } } },
        low: { type: 'subbass', gain: 0.30, pan: 0, rev: 0.05, eq: [{ type: 'lowpass', f: 600, q: 0.5 }] },
        bell: { type: 'glass', gain: 0.30, pan: 0.2, rev: 0.45, delay: { time: 0.75, fb: 0.35, mix: 0.28, lp: 2400, pan: -0.45 } },
        mel: { type: 'glass', gain: 0.32, pan: -0.1, rev: 0.55 },
        bub: { type: 'bubble', gain: 0.05, pan: 0, rev: 0.6, eq: [{ type: 'lowpass', f: 1600, q: 0.5 }] },
      },
    });
    const C1 = 'Emaj9 | Emaj9 | C#m9 | C#m9 | Amaj9 | Amaj7#11 | B9sus4 | B9sus4';
    const C3 = 'Emaj9 | Emaj9 | G#m7 | G#m7 | Amaj9 | Amaj7#11 | B9sus4 | B9sus4';
    const chs = chart([C1, C1, C3].join(' | '), 4);
    // パッド：同じコードが続くときはつなげて伸ばす
    let prev = null;
    for (let i = 0; i < chs.length; i++) {
      const c = chs[i];
      if (i > 0 && chs[i - 1].ch.sym === c.ch.sym) continue;
      let dur = c.dur; for (let j = i + 1; j < chs.length && chs[j].ch.sym === c.ch.sym; j++) dur += chs[j].dur;
      const v = voice(c.ch, prev, { lo: 52, hi: 71, n: 4 }); prev = v;
      v.forEach((m) => s.note('pad', c.beat, m, dur, 0.6, { humanize: 0 }));
      s.note('low', c.beat, bassNote(c.ch, 40), dur, 0.55, { humanize: 0 });
    }
    // ベル：和音の音を ゆっくり上下（1・3まわり目は4分、2まわり目は8分）
    for (let bar = 0; bar < 24; bar++) {
      const c = at(chs, bar * 4).ch;
      const tones = [];
      for (let m = 64; m <= 76; m++) if (c.ints.some((iv) => (c.root + iv) % 12 === m % 12)) tones.push(m);
      const cyc = Math.floor(bar / 8);
      const step = 1; // Codex：8分は 残響と かさなって さわがしい
      const order = [0, 2, 1, 3, 2, 4, 3, 1];
      for (let k = 0; k < 4 / step; k++) {
        if (cyc !== 1 && k === 3 && bar % 2 === 1) continue; // ときどき休む
        const m = tones[order[k % order.length] % tones.length];
        const shape = 0.32 + 0.1 * Math.sin((k / (4 / step)) * Math.PI);
        s.note('bell', bar * 4 + k * step, m, 1, bar >= 8 ? shape * 0.8 : shape); // メロディが あるときは ひかえめ（agy）
      }
    }
    // ゆっくりのメロディ（2まわり目と3まわり目）
    const m = 'G#5:3 F#5:1 | E5:2 B4:2 | G#5:3 B5:1 | G#5:4 | A5:2 G#5:1 E5:1 | D#5:4 | F#5:3 E5:1 | C#5:4';
    s.melody('mel', m, 32, 0.45);
    s.melody('mel', m.replace('C#5:4', 'B4:4'), 64, 0.42);
    // 泡：1小節に 1〜3こ（seed 固定）
    const r = BGM.mulberry32(4444);
    for (let bar = 0; bar < 24; bar++) {
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const bt = bar * 4 + r() * 4;
        s.note('bub', bt, 60, 0.2, 0.35 + r() * 0.25, { humanize: 0 });
        if (r() < 0.4) s.note('bub', bt + 0.12 + r() * 0.1, 60, 0.2, 0.25 + r() * 0.2, { humanize: 0 });
      }
    }
    return s;
  };

  // =====================================================================
  // 5. おひるね オルゴール（3/4 拍子 90BPM、C、オルゴール＋うすいパッド）
  // =====================================================================
  BGM.SONGS.ohirune = () => {
    const s = new Song({
      bpm: 90, meter: 3, bars: 48, swing: 0.5, seed: 55, humanize: 0.004,
      masterLP: 9500,
      reverb: { time: 2.6, damp: 0.6, pre: 0.025 },
      channels: {
        mb: { type: 'musicbox', gain: 0.48, pan: 0.1, rev: 0.35 },
        acc: { type: 'musicbox', gain: 0.34, pan: -0.12, rev: 0.35 },
        pad: { type: 'pad', gain: 0.22, pan: 0, rev: 0.5, opt: { atk: 1.5, rel: 1.8, cut: 700 } },
      },
    });
    const A = 'C | Am | Dm | G7 | C | Em | F | G7';
    const A2 = 'C | Am | Dm | G7 | F | G7 | C | C';
    const B = 'F | Em | Dm | C | F | Em | D7 | G7';
    const I = 'Am | F | C | G | Am | F | Dm7 | G7';
    const secs = [A, A2, B, A2, I, A2];
    const chs = chart(secs.join(' | '), 3);
    const mA = 'E5:2 G5:1 | A5:1.5 G5:.5 E5:1 | F5:2 D5:1 | B4:1.5 C5:.5 D5:1 | E5:2 G5:1 | G5:1 B5:1.5 A5:.5 | A5:2 F5:1 | G5:2 r:1';
    const mA2 = 'E5:2 G5:1 | A5:1.5 G5:.5 E5:1 | F5:2 D5:1 | B4:1.5 C5:.5 D5:1 | A5:2 F5:1 | G5:1.5 F5:.5 D5:1 | E5:2 D5:1 | C5:3';
    const mB = 'F5:1 A5:1 C6:1 | B5:2 G5:1 | A5:1 F5:1 D5:1 | G5:2 E5:1 | F5:1 A5:1 C6:1 | B5:1.5 A5:.5 G5:1 | F#5:2 A5:1 | G5:2 F5:1';
    const mI = 'E5:3 | F5:3 | G5:3 | D5:3 | E5:3 | C5:3 | D5:3 | B4:2 r:1';
    let b = 0;
    b = s.melody('mb', mA, b, 0.6);
    b = s.melody('mb', mA2, b, 0.62);
    b = s.melody('mb', mB, b, 0.6);
    b = s.melody('mb', mA2, b, 0.6);
    b = s.melody('mb', mI, b, 0.45);
    b = s.melody('mb', mA2, b, 0.55);
    // 伴奏：はじめの4つは「ブン・チャ・チャ」、5つめ（間奏）と最後は分散和音
    for (let bar = 0; bar < 48; bar++) {
      const c = at(chs, bar * 3).ch;
      const r = bassNote(c, 48);
      const t3 = r + (c.ints.includes(3) ? 3 : 4), t5 = r + 7;
      const top = c.ints.includes(10) ? r + 10 : r + 12;
      const sec = Math.floor(bar / 8);
      if (sec >= 4) {
        const arp = [r, t5, top, t3 + 12 > 69 ? t3 : t3 + 12, top, t5]; // メロディより 下に（agy）
        arp.forEach((m, k) => s.note('acc', bar * 3 + k * 0.5, m, 0.5, k === 0 ? 0.42 : 0.3));
      } else {
        s.note('acc', bar * 3, r, 1, 0.45);
        [1, 2].forEach((q) => { s.note('acc', bar * 3 + q, t3 + 12 > 67 ? t3 : t3 + 12, 1, 0.3); s.note('acc', bar * 3 + q, t5 + 12 > 69 ? t5 : t5 + 12, 1, 0.27); });
      }
    }
    // パッド（2つめの段から、うすく）
    let prev = null;
    for (const c of chs) {
      if (c.beat < 24) continue;
      const v = voice(c.ch, prev, { lo: 48, hi: 64, n: 3 }); prev = v;
      v.forEach((m) => s.note('pad', c.beat, m, c.dur, 0.5, { humanize: 0 }));
    }
    return s;
  };

  BGM.META = {
    pokapoka: { name: 'ぽかぽか おへや', mood: 'ほのぼの（マリンバ・ピアノ）' },
    hidamari: { name: 'ひだまり カフェ', mood: 'カフェ ボサノバ（ギター・ビブラフォン）' },
    yurayura: { name: 'ゆらゆら ティータイム', mood: 'ローファイ ジャズ（エレピ・やわらかいドラム）' },
    suichu: { name: 'すいちゅう さんぽ', mood: 'すいちゅう（パッド・ガラスのベル・あわ）' },
    ohirune: { name: 'おひるね オルゴール', mood: 'オルゴール（3びょうし）' },
  };
})();
