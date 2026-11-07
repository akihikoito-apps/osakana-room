// おさかなルーム BGM エンジン（ヘッドレス Chrome の OfflineAudioContext で書き出す）
// 作曲データ（songs/*.js）を受け取り、ループがつながる 2ch の音を返す。
// 乱数は seed 固定なので、同じデータなら毎回同じ音になる。
(function () {
  'use strict';
  const SR = 48000;
  const TAU = Math.PI * 2;

  // ---------- 小道具 ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function pc(s) {
    const m = /^([A-G])([#b]?)$/.exec(s);
    if (!m) throw new Error('音名がへん: ' + s);
    return (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  }
  function pn(s) {
    const m = /^([A-G][#b]?)(-?\d)$/.exec(s);
    if (!m) throw new Error('音がへん: ' + s);
    return 12 * (+m[2] + 1) + ((PC[m[1][0]] + (m[1][1] === '#' ? 1 : m[1][1] === 'b' ? -1 : 0)));
  }

  // メロディ記法： "A4:1 C5:.5 r:.5 ..."（音:拍数、r は休み、| は飾り）
  function mel(str, startBeat = 0) {
    const ev = [];
    let pos = startBeat;
    for (const tok of str.trim().split(/\s+/)) {
      if (tok === '|' || tok === '') continue;
      const [p, d, v] = tok.split(':');
      const dur = Number(d);
      if (!(dur > 0)) throw new Error('長さがへん: ' + tok);
      if (p !== 'r') ev.push({ beat: pos, midi: pn(p), dur, vel: v ? Number(v) : undefined });
      pos += dur;
    }
    return { ev, end: pos };
  }

  // コード
  const Q = {
    '': [0, 4, 7], 'm': [0, 3, 7], '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9], '69': [0, 4, 7, 9, 14],
    'maj7': [0, 4, 7, 11], 'maj9': [0, 4, 7, 11, 14], 'maj7#11': [0, 4, 7, 11, 18], 'maj9#11': [0, 4, 11, 14, 18],
    'm7': [0, 3, 7, 10], 'm9': [0, 3, 7, 10, 14], 'm11': [0, 3, 7, 10, 14, 17], 'mmaj7': [0, 3, 7, 11],
    '7': [0, 4, 7, 10], '9': [0, 4, 7, 10, 14], '13': [0, 4, 10, 14, 21], '7b9': [0, 4, 7, 10, 13], '7b13': [0, 4, 10, 20],
    '7sus4': [0, 5, 7, 10], '9sus4': [0, 5, 10, 14], 'sus4': [0, 5, 7], 'sus2': [0, 2, 7], 'add9': [0, 4, 7, 14], 'madd9': [0, 3, 7, 14],
    'm7b5': [0, 3, 6, 10], 'dim7': [0, 3, 6, 9], '6sus2': [0, 2, 7, 9],
  };
  function chord(sym) {
    const [main, slash] = sym.split('/');
    const m = /^([A-G][#b]?)(.*)$/.exec(main);
    if (!m || !(m[2] in Q)) throw new Error('コードがへん: ' + sym);
    const root = pc(m[1]);
    return { sym, root, q: m[2], ints: Q[m[2]], bass: slash ? pc(slash) : root };
  }
  // "Fmaj7 | Am7 D7 | ..." → [{beat, dur, ch}]
  function chart(str, meter, startBeat = 0) {
    const out = [];
    const bars = str.split('|').map((s) => s.trim()).filter((s) => s.length);
    bars.forEach((b, i) => {
      const syms = b.split(/\s+/);
      const each = meter / syms.length;
      syms.forEach((s, j) => out.push({ beat: startBeat + i * meter + j * each, dur: each, ch: chord(s) }));
    });
    return out;
  }
  // 和音の積み方：n 声、音域 lo..hi、前の和音から近い形を選ぶ
  function pickTones(ch, n) {
    let ints = ch.ints.slice();
    if (ints.length > n) {
      // 5度 → 根音 の順にはずす（ベースが根音を弾くので）
      const drop = [7, 0];
      for (const d of drop) { if (ints.length > n && ints.includes(d)) ints = ints.filter((x) => x !== d); }
      ints = ints.slice(0, n);
    } else if (ints.length < n) {
      ints = ints.concat([12]).slice(0, n); // 根音を重ねる
    }
    return ints.map((i) => (ch.root + i) % 12);
  }
  function voice(ch, prev, o = {}) {
    const n = o.n || 4, lo = o.lo ?? 53, hi = o.hi ?? 74;
    const pcs = [...new Set(pickTones(ch, n))];
    const cands = [];
    for (let s = 0; s < pcs.length; s++) {
      for (let base = lo - 2; base <= lo + 11; base++) {
        if ((base % 12) !== pcs[s]) continue;
        const v = [base];
        for (let k = 1; k < pcs.length; k++) {
          const p = pcs[(s + k) % pcs.length];
          let x = v[v.length - 1] + 1;
          while (x % 12 !== p) x++;
          v.push(x);
        }
        cands.push(v);
        if (v.length >= 4) { // ドロップ2（上から2番目を1オクターブ下げる）
          const d = v.slice(); const x = d.splice(d.length - 2, 1)[0] - 12; d.unshift(x); cands.push(d);
        }
      }
    }
    let best = null, bc = Infinity;
    const center = (lo + hi) / 2;
    for (const v of cands) {
      let c = 0;
      const top = v[v.length - 1], bot = v[0];
      if (top > hi) c += (top - hi) * 3;
      if (bot < lo - 3) c += (lo - 3 - bot) * 3;
      if (v[1] - v[0] <= 2 && bot < 57) c += 4; // 低い所の2度はにごる
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      c += Math.abs(mean - center) * 0.35;
      if (prev && prev.length === v.length) for (let i = 0; i < v.length; i++) c += Math.abs(v[i] - prev[i]) * 0.6;
      else if (prev) c += Math.abs(mean - prev.reduce((a, b) => a + b, 0) / prev.length);
      if (o.top != null) c += Math.abs(top - o.top) * 0.5;
      if (c < bc) { bc = c; best = v; }
    }
    return best;
  }
  function bassNote(ch, lo = 36, interval = 0) {
    let m = lo + ((((ch.bass + interval) % 12) - (lo % 12)) + 12) % 12;
    return m;
  }

  // ---------- 音色（JS で 1音ぶんの波形を作る） ----------
  function partialsBuf(f, parts, dur, opt = {}) {
    const n = Math.floor(dur * SR);
    const buf = new Float32Array(n);
    const rnd = opt.rnd || Math.random;
    for (const p of parts) {
      const fr = f * p.r;
      if (fr > 15000) continue;
      const w = TAU * fr / SR;
      const ph = rnd() * TAU;
      const k = Math.exp(-1 / (p.d * SR));
      const k2 = p.d2 ? Math.exp(-1 / (p.d2 * SR)) : 0;
      const atk = Math.max(1, Math.floor((p.atk ?? opt.atk ?? 0.002) * SR));
      let e = p.a * (p.d2 ? (1 - (p.mix ?? 0.5)) : 1), e2 = p.d2 ? p.a * (p.mix ?? 0.5) : 0;
      const trem = p.trem || opt.trem;
      for (let i = 0; i < n; i++) {
        let env = e + e2;
        if (env < 1e-6 && i > atk) break;
        if (i < atk) env *= i / atk;
        let s = Math.sin(ph + w * i);
        if (trem) s *= 1 - trem.depth * (0.5 - 0.5 * Math.cos(TAU * trem.f * i / SR));
        buf[i] += env * s;
        e *= k; e2 *= k2;
      }
    }
    return buf;
  }

  function genPiano(m, rnd) {
    const f = mtof(m);
    const T = clamp(5.0 * Math.pow(261.6 / f, 0.6), 0.9, 9);
    const B = 0.0002 * Math.pow(f / 261.6, 0.8);
    const parts = [];
    for (let h = 1; h <= 14; h++) {
      const fr = h * Math.sqrt(1 + B * h * h);
      const a = Math.pow(h, -1.35) * Math.exp(-(h - 1) * 0.18) * (h === 2 ? 0.8 : 1);
      const d = T / (1 + 0.55 * (h - 1));
      // 2本の弦（すこしずらすと うなりが出て生っぽくなる）
      parts.push({ r: fr * (1 + 0.00035), a: a * 0.5, d: d, d2: d * 0.22, mix: 0.55, atk: 0.003 });
      parts.push({ r: fr * (1 - 0.00035), a: a * 0.5, d: d * 0.95, d2: d * 0.2, mix: 0.55, atk: 0.003 });
    }
    const buf = partialsBuf(f, parts, Math.min(T * 1.6, 7), { rnd });
    // ハンマーの小さな音
    let y = 0;
    for (let i = 0; i < Math.min(buf.length, 0.012 * SR); i++) { y += 0.25 * ((rnd() * 2 - 1) - y); buf[i] += y * 0.04 * (1 - i / (0.012 * SR)); }
    return buf;
  }
  function genMarimba(m, rnd) {
    const f = mtof(m);
    const T = clamp(1.0 * Math.pow(440 / f, 0.55), 0.3, 2.0);
    const buf = partialsBuf(f, [
      { r: 1, a: 1, d: T, atk: 0.0015 },
      { r: 1.003, a: 0.25, d: T * 0.8, atk: 0.0015 },
      { r: 3.93, a: 0.16, d: T * 0.16, atk: 0.001 },
      { r: 9.2, a: 0.035, d: T * 0.05, atk: 0.001 },
    ], T * 4, { rnd });
    let y = 0; // やわらかいマレットの「とん」
    for (let i = 0; i < 0.006 * SR; i++) { y += 0.15 * ((rnd() * 2 - 1) - y); buf[i] += y * 0.12 * (1 - i / (0.006 * SR)); }
    return buf;
  }
  function genVibes(m, rnd) {
    const f = mtof(m);
    const T = clamp(3.2 * Math.pow(440 / f, 0.3), 1.5, 5);
    return partialsBuf(f, [
      { r: 1, a: 1, d: T, atk: 0.003 },
      { r: 4.0, a: 0.07, d: 0.35, atk: 0.002 },
      { r: 10.0, a: 0.012, d: 0.06, atk: 0.001 },
    ], T * 3, { rnd, trem: { f: 4.8, depth: 0.22 } });
  }
  function genMusicBox(m, rnd) {
    const f = mtof(m);
    const T = clamp(2.0 * Math.pow(523 / f, 0.45), 0.8, 4);
    const buf = partialsBuf(f, [
      { r: 1, a: 0.6, d: T, atk: 0.001 },
      { r: 1.0012, a: 0.4, d: T * 0.9, atk: 0.001 }, // わずかなうなり（オルゴールらしいゆらぎ）
      { r: 2.0, a: 0.06, d: T * 0.3, atk: 0.001 },
      { r: 5.97, a: 0.09, d: 0.12, atk: 0.0008 },
      { r: 3.0, a: 0.03, d: T * 0.2, atk: 0.001 },
    ], T * 3.5, { rnd });
    for (let i = 0; i < 0.0015 * SR; i++) buf[i] += (rnd() * 2 - 1) * 0.03 * (1 - i / (0.0015 * SR));
    return buf;
  }
  function genGlass(m, rnd) {
    const f = mtof(m);
    const T = clamp(4.5 * Math.pow(523 / f, 0.3), 2.5, 7);
    return partialsBuf(f, [
      { r: 1, a: 1, d: T, atk: 0.006 },
      { r: 2.756, a: 0.14, d: T * 0.3, atk: 0.004 },
      { r: 5.40, a: 0.04, d: T * 0.1, atk: 0.003 },
      { r: 8.93, a: 0.012, d: 0.12, atk: 0.002 },
    ], T * 2.8, { rnd });
  }
  function genRhodes(m, vb, rnd) {
    const f = mtof(m);
    const T = clamp(3.6 * Math.pow(261.6 / f, 0.5), 1.2, 7);
    const dur = Math.min(T * 2.2, 8);
    const n = Math.floor(dur * SR);
    const buf = new Float32Array(n);
    const v = vb; // 0..1
    const I0 = 0.5 + 1.5 * v;
    const ph1 = rnd() * TAU, ph2 = rnd() * TAU;
    const w = TAU * f / SR, w2 = TAU * f * 1.0007 / SR;
    const ft = Math.min(f * 7.0, 9000), wt = TAU * ft / SR;
    const kA = Math.exp(-1 / (T * SR)), kA2 = Math.exp(-1 / (0.35 * SR)), kI = Math.exp(-1 / (0.3 * SR)), kT = Math.exp(-1 / (0.025 * SR));
    let a1 = 0.7, a2 = 0.3, idx = I0, tine = 0.05 * v;
    const atk = 0.002 * SR;
    for (let i = 0; i < n; i++) {
      const e = (a1 + a2) * (i < atk ? i / atk : 1);
      if (e < 1e-6 && i > atk) break;
      const I = idx + 0.18;
      const s1 = Math.sin(w * i + ph1 + I * Math.sin(w * i));
      const s2 = Math.sin(w2 * i + ph2 + I * 0.9 * Math.sin(w2 * i));
      buf[i] = e * 0.5 * (s1 + s2) + tine * Math.sin(wt * i);
      a1 *= kA; a2 *= kA2; idx *= kI; tine *= kT;
    }
    return buf;
  }
  // Karplus-Strong（ナイロンギター・ウッドベース）
  function genKS(m, o, rnd) {
    const f = mtof(m);
    const N = SR / f;
    const S1 = o.s1 ?? 0.5; // 小さいほど明るい
    const D = Math.floor(N - S1 - 0.1);
    const frac = N - S1 - D;
    const C = (1 - frac) / (1 + frac);
    const T60 = o.t60 ?? 3;
    const g = Math.pow(10, -3 / (T60 * f));
    const dur = o.dur ?? Math.min(T60 * 1.1, 6);
    const n = Math.floor(dur * SR);
    const buf = new Float32Array(n);
    // 励起：ローパスしたノイズ＋はじく位置のくし形
    const exc = new Float32Array(D);
    let y = 0;
    const a = o.soft ?? 0.5;
    for (let i = 0; i < D; i++) { y += (1 - a) * ((rnd() * 2 - 1) - y); exc[i] = y; }
    let mean = 0; for (let i = 0; i < D; i++) mean += exc[i]; mean /= D;
    const pk = Math.max(1, Math.round((o.pick ?? 0.2) * D));
    const ex2 = new Float32Array(D);
    for (let i = 0; i < D; i++) ex2[i] = (exc[i] - mean) - (i >= pk ? exc[i - pk] - mean : 0);
    let apIn = 0, apOut = 0;
    for (let i = 0; i < n; i++) {
      const d1 = i - D >= 0 ? buf[i - D] : 0;
      const d2 = i - D - 1 >= 0 ? buf[i - D - 1] : 0;
      const lp = g * ((1 - S1) * d1 + S1 * d2);
      const ap = C * lp + apIn - C * apOut;
      apIn = lp; apOut = ap;
      buf[i] = (i < D ? ex2[i] : 0) + ap;
    }
    if (o.sine) { // 低音を足す（ウッドベースの胴鳴り）
      const kd = Math.exp(-1 / (T60 * 0.25 * SR));
      let e = o.sine; const ph = rnd() * TAU;
      for (let i = 0; i < n; i++) { const at = Math.min(1, i / (0.008 * SR)); buf[i] += e * at * Math.sin(ph + TAU * f * i / SR); e *= kd; }
    }
    let pk2 = 0; for (let i = 0; i < n; i++) pk2 = Math.max(pk2, Math.abs(buf[i]));
    if (pk2 > 0) for (let i = 0; i < n; i++) buf[i] /= pk2;
    return buf;
  }

  // ---------- 曲 ----------
  class Song {
    constructor(o) {
      Object.assign(this, { bpm: 100, meter: 4, bars: 32, swing: 0.5, seed: 1, humanize: 0.006, channels: {}, reverb: { time: 2.2, damp: 0.6, pre: 0.02 } }, o);
      this.spb = 60 / this.bpm;
      this.L = Math.round(this.bars * this.meter * this.spb * 100) / 100; // 0.01 秒の倍数
      this.events = [];
      this.rng = mulberry32(this.seed * 7919 + 13);
    }
    t(beat) {
      const i = Math.floor(beat), f = beat - i, s = this.swing;
      const ff = f < 0.5 ? f * (s / 0.5) : s + (f - 0.5) * ((1 - s) / 0.5);
      return (i + ff) * this.spb;
    }
    note(ch, beat, midi, dur, vel = 0.7, opt = {}) {
      const h = opt.humanize ?? this.humanize;
      const vj = opt.vj ?? 0.06;
      this.events.push({
        ch, beat, midi, dur,
        vel: clamp(vel * (1 + (this.rng() - 0.5) * 2 * vj), 0.02, 1),
        jit: (this.rng() - 0.5) * 2 * h + (opt.late || 0),
        opt, r: this.rng(),
      });
    }
    melody(ch, str, start, vel = 0.7, opt = {}) {
      const { ev, end } = mel(str, start);
      (this.log || (this.log = [])).push(ch + ' ' + start + '→' + end);
      for (const e of ev) {
        // 拍頭はすこし強く、裏はすこし弱く
        const onBeat = Math.abs(e.beat - Math.round(e.beat)) < 1e-6;
        this.note(ch, e.beat, e.midi, e.dur, (e.vel ?? vel) * (onBeat ? 1 : 0.88), opt);
      }
      return end;
    }
  }

  // ---------- 書き出し ----------
  function makeIR(ctx, o, rnd) {
    const time = o.time ?? 2.2, damp = o.damp ?? 0.6, pre = o.pre ?? 0.02;
    const len = Math.floor((pre + time * 1.2) * SR);
    const ir = ctx.createBuffer(2, len, SR);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let y = 0, ss = 0;
      for (let i = 0; i < len; i++) {
        const t = i / SR - pre;
        if (t < 0) { d[i] = 0; continue; }
        const a = clamp(0.15 + damp * 0.8 * (t / time), 0, 0.97); // 後ろほど暗く
        y += (1 - a) * ((rnd() * 2 - 1) - y);
        const env = Math.exp(-6.9 * t / time) * Math.min(1, t / 0.01);
        d[i] = y * env / Math.sqrt(1 - a + 0.02);
        ss += d[i] * d[i];
      }
      const g = 1 / Math.sqrt(ss);
      for (let i = 0; i < len; i++) d[i] *= g;
    }
    return ir;
  }

  async function render(song) {
    const L = song.L;
    const Ls = Math.round(L * SR);
    const total = 2 * L + 1.5;
    const ctx = new OfflineAudioContext(2, Math.ceil(total * SR), SR);
    const rnd = mulberry32(song.seed * 31 + 7);

    // マスター
    const master = ctx.createGain(); master.gain.value = 1;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = song.masterHP ?? 55; hp.Q.value = 0.6;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = song.masterLP ?? 11000; lp.Q.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 2.2; comp.attack.value = 0.03; comp.release.value = 0.35;
    master.connect(hp); hp.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
    const rev = ctx.createConvolver(); rev.normalize = false; rev.buffer = makeIR(ctx, song.reverb, rnd);
    const revOut = ctx.createGain(); revOut.gain.value = 1;
    rev.connect(revOut); revOut.connect(master);

    // 共通ノイズ
    const noise = ctx.createBuffer(1, SR * 3, SR);
    { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }

    // チャンネル
    const chans = {};
    for (const [name, c] of Object.entries(song.channels)) {
      const inp = ctx.createGain(); inp.gain.value = c.gain ?? 0.5;
      let node = inp;
      for (const e of (c.eq || [])) {
        const b = ctx.createBiquadFilter(); b.type = e.type; b.frequency.value = e.f; if (e.q != null) b.Q.value = e.q; if (e.g != null) b.gain.value = e.g;
        node.connect(b); node = b;
      }
      const pan = ctx.createStereoPanner(); pan.pan.value = c.pan ?? 0;
      node.connect(pan);
      if (c.autopan) { // ループの長さで割り切れる速さにする（つなぎ目がずれないように）
        const lf = ctx.createOscillator(); lf.frequency.value = Math.max(1, Math.round(c.autopan.f * L)) / L;
        const lg = ctx.createGain(); lg.gain.value = c.autopan.depth;
        lf.connect(lg); lg.connect(pan.pan); lf.start(0);
      }
      let out = pan;
      if (c.delay) {
        const dly = ctx.createDelay(2); dly.delayTime.value = c.delay.time * song.spb;
        const fb = ctx.createGain(); fb.gain.value = c.delay.fb;
        const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = c.delay.lp ?? 3000;
        const wet = ctx.createGain(); wet.gain.value = c.delay.mix;
        const dpan = ctx.createStereoPanner(); dpan.pan.value = c.delay.pan ?? -0.4;
        pan.connect(dly); dly.connect(dlp); dlp.connect(fb); fb.connect(dly); dlp.connect(wet); wet.connect(dpan); dpan.connect(master);
        const ws = ctx.createGain(); ws.gain.value = (c.rev ?? 0.2) * 0.8; dpan.connect(ws); ws.connect(rev);
      }
      out.connect(master);
      const send = ctx.createGain(); send.gain.value = c.rev ?? 0.2; out.connect(send); send.connect(rev);
      chans[name] = { cfg: c, inp };
    }

    // 音色のキャッシュ
    const cache = new Map();
    const getBuf = (key, gen) => {
      let b = cache.get(key);
      if (!b) {
        const data = gen();
        b = ctx.createBuffer(1, data.length, SR); b.copyToChannel(data, 0);
        cache.set(key, b);
      }
      return b;
    };

    const playBuf = (dest, buf, t, durS, vel, o) => {
      const src = ctx.createBufferSource(); src.buffer = buf;
      if (o.detune) src.detune.value = o.detune;
      const g = ctx.createGain();
      const lvl = Math.pow(vel, o.curve ?? 1.6);
      g.gain.setValueAtTime(lvl, t);
      let node = src;
      if (o.bright) {
        const f = ctx.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.value = o.bright[0] + o.bright[1] * vel; f.Q.value = 0.4;
        src.connect(f); node = f;
      }
      node.connect(g); g.connect(dest);
      if (o.release != null && durS != null) {
        const off = t + Math.max(0.03, durS);
        g.gain.setValueAtTime(lvl, off);
        g.gain.setTargetAtTime(0, off, o.release / 4);
        src.start(t); src.stop(Math.min(off + o.release * 2, t + buf.duration));
      } else src.start(t);
    };

    const vb = (v) => Math.round(clamp(v, 0, 1) * 4) / 4;
    const P = {
      piano(dest, t, m, d, v, o) { playBuf(dest, getBuf('pi' + m, () => genPiano(m, rnd)), t, d, v, { release: 0.35, bright: [900, 4200], ...o }); },
      felt(dest, t, m, d, v, o) { playBuf(dest, getBuf('pi' + m, () => genPiano(m, rnd)), t, d, v, { release: 0.5, bright: [600, 1800], ...o }); },
      marimba(dest, t, m, d, v, o) { playBuf(dest, getBuf('ma' + m, () => genMarimba(m, rnd)), t, null, v, { bright: [1500, 4000], ...o }); },
      vibes(dest, t, m, d, v, o) { playBuf(dest, getBuf('vi' + m, () => genVibes(m, rnd)), t, d, v, { release: 0.6, bright: [1500, 4000], ...o }); },
      musicbox(dest, t, m, d, v, o) { playBuf(dest, getBuf('mb' + m, () => genMusicBox(m, rnd)), t, null, v, { bright: [2500, 4000], ...o }); },
      glass(dest, t, m, d, v, o) { playBuf(dest, getBuf('gl' + m, () => genGlass(m, rnd)), t, null, v, { bright: [1200, 2500], ...o }); },
      rhodes(dest, t, m, d, v, o) { const b = vb(v); playBuf(dest, getBuf('rh' + m + '_' + b, () => genRhodes(m, b, rnd)), t, d, v, { release: 0.3, curve: 1.2, bright: [1200, 3500], ...o }); },
      nylon(dest, t, m, d, v, o) { playBuf(dest, getBuf('ny' + m, () => genKS(m, { t60: clamp(4 * Math.pow(196 / mtof(m), 0.5), 1.5, 5), soft: 0.55, pick: 0.18, s1: 0.45 }, rnd)), t, d, v, { release: 0.25, bright: [1400, 3500], ...o }); },
      bass(dest, t, m, d, v, o) { playBuf(dest, getBuf('ba' + m, () => genKS(m, { t60: 2.2, soft: 0.85, pick: 0.25, s1: 0.5, sine: 0.6 }, rnd)), t, d, v, { release: 0.12, bright: [500, 900], curve: 1.2, ...o }); },
      subbass(dest, t, m, d, v, o) {
        const os = ctx.createOscillator(); os.type = 'sine'; os.frequency.value = mtof(m);
        const os2 = ctx.createOscillator(); os2.type = 'triangle'; os2.frequency.value = mtof(m);
        const g2 = ctx.createGain(); g2.gain.value = 0.25;
        const g = ctx.createGain(); const lvl = Math.pow(v, 1.2);
        const end = t + Math.max(0.1, d);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.015);
        g.gain.setTargetAtTime(lvl * 0.6, t + 0.02, 0.4);
        g.gain.setTargetAtTime(0, end - 0.02, 0.05);
        os.connect(g); os2.connect(g2); g2.connect(g); g.connect(dest);
        os.start(t); os2.start(t); os.stop(end + 0.4); os2.stop(end + 0.4);
      },
      pad(dest, t, m, d, v, o) {
        const f = mtof(m);
        const atk = o.atk ?? 1.2, rel = o.rel ?? 1.8;
        const end = t + Math.max(0.2, d);
        const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = o.cut ?? 900; flt.Q.value = 0.3;
        const g = ctx.createGain(); const lvl = Math.pow(v, 1.4) * 0.18;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + atk);
        g.gain.setValueAtTime(lvl, end); g.gain.linearRampToValueAtTime(0, end + rel);
        flt.connect(g); g.connect(dest);
        const det = [-8, 8, 0];
        const types = ['sawtooth', 'sawtooth', 'triangle'];
        det.forEach((dt, i) => {
          const os = ctx.createOscillator(); os.type = types[i]; os.frequency.value = f; os.detune.value = dt;
          const p = ctx.createStereoPanner(); p.pan.value = i === 0 ? -0.5 : i === 1 ? 0.5 : 0;
          const og = ctx.createGain(); og.gain.value = i === 2 ? 0.8 : 0.5;
          os.connect(og); og.connect(p); p.connect(flt);
          os.start(t); os.stop(end + rel + 0.05);
        });
        if (o.wob) { // フィルタのゆらぎ（1音ごとに頭から）
          const lf = ctx.createOscillator(); lf.frequency.value = o.wob.f;
          const lg = ctx.createGain(); lg.gain.value = o.wob.depth;
          lf.connect(lg); lg.connect(flt.frequency); lf.start(t); lf.stop(end + rel);
        }
      },
      // ---- 打楽器 ----
      kick(dest, t, m, d, v) {
        const os = ctx.createOscillator(); os.type = 'sine';
        os.frequency.setValueAtTime(115, t); os.frequency.exponentialRampToValueAtTime(46, t + 0.1);
        const g = ctx.createGain(); const lvl = Math.pow(v, 1.5);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.004); g.gain.setTargetAtTime(0, t + 0.01, 0.09);
        os.connect(g); g.connect(dest); os.start(t); os.stop(t + 0.6);
      },
      noiseHit(dest, t, v, o, r) {
        const src = ctx.createBufferSource(); src.buffer = noise;
        const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.f; f.Q.value = o.q ?? 0.8;
        const g = ctx.createGain(); const lvl = Math.pow(v, 1.5) * (o.gain ?? 1);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + (o.atk ?? 0.002));
        g.gain.setTargetAtTime(0, t + (o.atk ?? 0.002) + (o.hold ?? 0), o.dec / 3);
        src.connect(f); f.connect(g); g.connect(dest);
        const off = (r * 2.4);
        src.start(t, off, (o.atk ?? 0.002) + (o.hold ?? 0) + o.dec * 2.5);
      },
      brush(dest, t, m, d, v, o, r) { P.noiseHit(dest, t, v, { f: 3500, q: 0.6, atk: 0.03, dec: 0.18, gain: 0.5 }, r); },
      brushtap(dest, t, m, d, v, o, r) { P.noiseHit(dest, t, v, { f: 2200, q: 0.7, atk: 0.004, dec: 0.12, gain: 0.9 }, r); },
      rim(dest, t, m, d, v, o, r) {
        P.noiseHit(dest, t, v, { f: 1800, q: 4, atk: 0.001, dec: 0.025, gain: 1.6 }, r);
        const os = ctx.createOscillator(); os.frequency.value = 1650; const g = ctx.createGain();
        g.gain.setValueAtTime(Math.pow(v, 1.5) * 0.25, t); g.gain.setTargetAtTime(0, t, 0.008);
        os.connect(g); g.connect(dest); os.start(t); os.stop(t + 0.06);
      },
      shaker(dest, t, m, d, v, o, r) { P.noiseHit(dest, t, v, { type: 'highpass', f: 6000, q: 0.5, atk: 0.012, dec: 0.05, gain: 0.5 }, r); },
      hat(dest, t, m, d, v, o, r) { P.noiseHit(dest, t, v, { type: 'bandpass', f: 7500, q: 0.7, atk: 0.001, dec: 0.035, gain: 0.6 }, r); },
      snare(dest, t, m, d, v, o, r) {
        P.noiseHit(dest, t, v, { f: 1600, q: 0.6, atk: 0.002, dec: 0.16, gain: 0.9 }, r);
        const os = ctx.createOscillator(); os.frequency.setValueAtTime(200, t); os.frequency.exponentialRampToValueAtTime(160, t + 0.08);
        const g = ctx.createGain(); g.gain.setValueAtTime(Math.pow(v, 1.5) * 0.35, t); g.gain.setTargetAtTime(0, t, 0.03);
        os.connect(g); g.connect(dest); os.start(t); os.stop(t + 0.2);
      },
      bubble(dest, t, m, d, v, o, r) {
        const f0 = 380 + r * 520; const len = 0.05 + r * 0.07;
        const os = ctx.createOscillator(); os.type = 'sine';
        os.frequency.setValueAtTime(f0, t); os.frequency.exponentialRampToValueAtTime(f0 * (2.2 + r), t + len);
        const g = ctx.createGain(); const lvl = Math.pow(v, 1.5);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.006); g.gain.setTargetAtTime(0, t + len * 0.5, len * 0.35);
        const p = ctx.createStereoPanner(); p.pan.value = (r - 0.5) * 1.2;
        os.connect(g); g.connect(p); p.connect(dest); os.start(t); os.stop(t + len * 3 + 0.05);
      },
    };

    // 予定を入れる（ループ 0,1,2 回目。書き出すのは 1 回目＝前の回の残響が乗った状態）
    for (const e of song.events) {
      const c = chans[e.ch];
      if (!c) throw new Error('チャンネルがない: ' + e.ch);
      const fn = P[c.cfg.type];
      if (!fn) throw new Error('音色がない: ' + c.cfg.type);
      const t0 = song.t(e.beat) + e.jit;
      const dS = song.t(e.beat + e.dur) - song.t(e.beat);
      for (let k = 0; k < 3; k++) {
        const t = t0 + k * L;
        if (t < 0 || t > total - 0.1) continue;
        fn(c.inp, t, e.midi, dS * (e.opt.legato ?? 1), e.vel, { ...(c.cfg.opt || {}), ...(e.opt.inst || {}) }, e.r);
      }
    }

    const out = await ctx.startRendering();
    const Lc = out.getChannelData(0).slice(Ls, 2 * Ls);
    const Rc = out.getChannelData(1).slice(Ls, 2 * Ls);
    return { L, Ls, left: Lc, right: Rc };
  }

  // 音量をそろえて 16bit に（RMS 目標、ピーク上限）
  function finish(r, o = {}) {
    const targetRms = Math.pow(10, (o.rmsDb ?? -20) / 20);
    const peakMax = Math.pow(10, (o.peakDb ?? -3) / 20);
    let ss = 0, pk = 0;
    const n = r.left.length;
    for (let i = 0; i < n; i++) { const a = r.left[i], b = r.right[i]; ss += a * a + b * b; pk = Math.max(pk, Math.abs(a), Math.abs(b)); }
    const rms = Math.sqrt(ss / (2 * n));
    let g = targetRms / rms;
    if (pk * g > peakMax) g = peakMax / pk;
    // 先頭 2 秒をうしろにつけたす（エンコーダの遅れがあっても周期区間で切れるように）
    const extra = Math.round((o.extraSec ?? 2) * SR);
    const m = n + extra;
    const pcm = new Int16Array(m * 2);
    const rnd = mulberry32(99);
    for (let i = 0; i < m; i++) {
      const j = i % n;
      for (let c = 0; c < 2; c++) {
        const x = (c ? r.right[j] : r.left[j]) * g;
        const dith = (rnd() - rnd()) / 32768;
        pcm[i * 2 + c] = clamp(Math.round((x + dith) * 32767), -32768, 32767);
      }
    }
    // base64
    const u8 = new Uint8Array(pcm.buffer);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { b64: btoa(s), gainDb: 20 * Math.log10(g), rmsDb: 20 * Math.log10(rms * g), peakDb: 20 * Math.log10(pk * g), frames: m, loopFrames: n };
  }

  window.BGM = { SR, Song, mel, chart, chord, voice, bassNote, pn, render, finish, mulberry32, SONGS: {} };
})();
