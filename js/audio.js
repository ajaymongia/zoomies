/* Zoomies! — sound effects and music, synthesised live with Web Audio (no files, works offline). */
(function (root) {
  'use strict';
  const Z = root.Z;
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const SFX_VOL = 0.55, MUSIC_VOL = 0.16;

  const SONGS = {
    meadow: { bpm: 116, root: 60, prog: [[0, 'M'], [5, 'M'], [7, 'M'], [5, 'M']] },
    candy: { bpm: 126, root: 62, prog: [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M']] },
    jungle: { bpm: 128, root: 57, prog: [[0, 'm'], [8, 'M'], [10, 'M'], [7, 'm']] },
    lava: { bpm: 140, root: 52, prog: [[0, 'm'], [0, 'm'], [3, 'M'], [5, 'm']] },
    sky: { bpm: 118, root: 65, prog: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']] },
    snow: { bpm: 130, root: 64, prog: [[0, 'M'], [9, 'm'], [4, 'm'], [5, 'M']] },
    desert: { bpm: 132, root: 57, prog: [[0, 'm'], [1, 'M'], [0, 'm'], [10, 'M']] },
    cave: { bpm: 134, root: 59, prog: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']] },
    autumn: { bpm: 136, root: 62, prog: [[0, 'M'], [5, 'M'], [9, 'm'], [7, 'M']] },
    beach: { bpm: 138, root: 67, prog: [[0, 'M'], [5, 'M'], [2, 'm'], [7, 'M']] },
    city: { bpm: 142, root: 58, prog: [[0, 'm'], [5, 'm'], [8, 'M'], [7, 'M']] },
    spooky: { bpm: 140, root: 55, prog: [[0, 'm'], [3, 'M'], [8, 'M'], [7, 'M']] },
    storm: { bpm: 146, root: 60, prog: [[0, 'm'], [8, 'M'], [10, 'M'], [5, 'm']] },
    space: { bpm: 148, root: 63, prog: [[0, 'M'], [4, 'm'], [9, 'm'], [7, 'M']] },
    castle: { bpm: 152, root: 65, prog: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M'], [0, 'M'], [5, 'M'], [7, 'M'], [7, 'M']] },
  };
  const ARP = [0, 1, 2, 3, 2, 1, 2, 1];

  const AU = {
    ctx: null, sfxOn: true, musicOn: true,
    song: null, step: 0, nextT: 0, timer: null, lastCoin: 0, coinRun: 0,

    /** Must be called from a user gesture (browsers block audio until then). */
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      comp.connect(c.destination);
      this.sfxGain = c.createGain(); this.sfxGain.gain.value = this.sfxOn ? SFX_VOL : 0; this.sfxGain.connect(comp);
      this.musicGain = c.createGain(); this.musicGain.gain.value = this.musicOn ? MUSIC_VOL : 0; this.musicGain.connect(comp);
      const len = c.sampleRate;
      const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    },

    setSfx(on) { this.sfxOn = on; if (this.ctx) this.sfxGain.gain.setTargetAtTime(on ? SFX_VOL : 0, this.ctx.currentTime, 0.02); },
    setMusic(on) { this.musicOn = on; if (this.ctx) this.musicGain.gain.setTargetAtTime(on ? MUSIC_VOL : 0, this.ctx.currentTime, 0.05); },

    tone(o) {
      const c = this.ctx;
      if (!c) return;
      const t0 = o.t0 != null ? o.t0 : c.currentTime + (o.at || 0);
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(o.f, t0);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.d);
      const v = o.v == null ? 0.3 : o.v;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + (o.a || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
      osc.connect(g); g.connect(o.dest || this.sfxGain);
      osc.start(t0); osc.stop(t0 + o.d + 0.03);
    },

    noise(o) {
      const c = this.ctx;
      if (!c) return;
      const t0 = o.t0 != null ? o.t0 : c.currentTime + (o.at || 0);
      const src = c.createBufferSource(); src.buffer = this.noiseBuf;
      const flt = c.createBiquadFilter(); flt.type = o.ft || 'bandpass';
      flt.frequency.setValueAtTime(o.f || 1000, t0);
      if (o.f2) flt.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.d);
      flt.Q.value = o.q || 1;
      const g = c.createGain();
      g.gain.setValueAtTime(o.v || 0.3, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
      src.connect(flt); flt.connect(g); g.connect(o.dest || this.sfxGain);
      src.start(t0, Math.random() * 0.5); src.stop(t0 + o.d + 0.03);
    },

    play(name, arg) {
      if (!this.ctx || !this.sfxOn) return;
      if (name === 'coin') {
        const now = this.ctx.currentTime;
        if (now - this.lastCoin < 0.03) return;
        this.coinRun = now - this.lastCoin < 0.45 ? Math.min(this.coinRun + 1, 7) : 0;
        this.lastCoin = now;
        arg = this.coinRun;
      }
      const fn = SFX[name];
      if (fn) fn(this, arg);
    },

    /* ---------- music ---------- */
    startMusic(key) {
      this.stopMusic();
      if (!this.ctx) return;
      this.song = SONGS[key] || SONGS.meadow;
      this.step = 0;
      this.resumeMusic();
    },
    resumeMusic() {
      if (!this.ctx || !this.song || this.timer) return;
      this.nextT = this.ctx.currentTime + 0.08;
      this.timer = setInterval(() => this.schedule(), 25);
    },
    pauseMusic() { if (this.timer) { clearInterval(this.timer); this.timer = null; } },
    stopMusic() { this.pauseMusic(); this.song = null; },
    schedule() {
      const c = this.ctx, s = this.song;
      if (!c || !s) return;
      const spb = 60 / s.bpm / 4;
      while (this.nextT < c.currentTime + 0.14) {
        this.note(this.step, this.nextT, spb);
        this.nextT += spb;
        this.step++;
      }
    },
    note(step, t, spb) {
      const s = this.song, dest = this.musicGain;
      const bar = Math.floor(step / 16) % s.prog.length, st = step % 16;
      const [off, q] = s.prog[bar];
      const tones = q === 'M' ? [0, 4, 7, 12] : [0, 3, 7, 12];
      const base = s.root + off;
      if (st % 2 === 0) this.tone({ t0: t, f: midi(base + 12 + tones[ARP[(st / 2) % 8]]), d: spb * 1.7, type: 'square', v: 0.05, dest });
      if (st === 0 || st === 6 || st === 8 || st === 14) this.tone({ t0: t, f: midi(base - 12 + (st === 8 ? 7 : 0)), d: spb * 1.9, type: 'triangle', v: 0.32, dest });
      if (st % 4 === 2) this.noise({ t0: t, d: 0.045, v: 0.07, f: 8000, ft: 'highpass', dest });
      if (st === 0 || st === 8) this.tone({ t0: t, f: 150, f2: 45, d: 0.14, type: 'sine', v: 0.45, dest });
      if (st === 4 || st === 12) this.noise({ t0: t, d: 0.09, v: 0.09, f: 1800, q: 0.8, dest });
    },
  };

  const up = (f, s) => f * Math.pow(2, s / 12);
  const SFX = {
    jump: (a) => a.tone({ f: 320, f2: 660, d: 0.15, type: 'square', v: 0.13 }),
    djump: (a) => { a.tone({ f: 520, f2: 1100, d: 0.16, type: 'triangle', v: 0.22 }); a.tone({ f: 780, f2: 1560, d: 0.12, type: 'sine', v: 0.1, at: 0.04 }); },
    land: (a) => a.noise({ d: 0.08, v: 0.14, f: 320, ft: 'lowpass' }),
    slide: (a) => a.noise({ d: 0.2, v: 0.12, f: 2600, f2: 800, q: 0.8 }),
    coin: (a, n) => { const f = up(988, n || 0); a.tone({ f, d: 0.07, type: 'square', v: 0.09 }); a.tone({ f: f * 1.335, d: 0.18, type: 'square', v: 0.09, at: 0.06 }); },
    gem: (a) => [0, 4, 7, 12].forEach((s, i) => a.tone({ f: up(784, s), d: 0.14, type: 'triangle', v: 0.2, at: i * 0.05 })),
    star: (a) => [0, 4, 7, 12, 16].forEach((s, i) => a.tone({ f: up(659, s), d: 0.22, type: 'square', v: 0.09, at: i * 0.06 })),
    heart: (a) => [0, 7, 12].forEach((s, i) => a.tone({ f: up(523, s), d: 0.22, type: 'sine', v: 0.28, at: i * 0.07 })),
    power: (a) => { for (let i = 0; i < 6; i++) a.tone({ f: up(392, i * 2), d: 0.1, type: 'square', v: 0.08, at: i * 0.045 }); a.tone({ f: 1046, d: 0.35, type: 'triangle', v: 0.16, at: 0.27 }); },
    powerEnd: (a) => a.tone({ f: 620, f2: 300, d: 0.25, type: 'triangle', v: 0.12 }),
    hurt: (a) => { a.tone({ f: 330, f2: 110, d: 0.32, type: 'sawtooth', v: 0.16 }); a.noise({ d: 0.2, v: 0.22, f: 800 }); },
    fall: (a) => a.tone({ f: 880, f2: 140, d: 0.6, type: 'triangle', v: 0.22 }),
    stomp: (a) => { a.tone({ f: 220, f2: 70, d: 0.15, type: 'sine', v: 0.45 }); a.tone({ f: 660, f2: 990, d: 0.1, type: 'square', v: 0.07, at: 0.03 }); },
    smash: (a) => a.noise({ d: 0.25, v: 0.32, f: 1200, f2: 200 }),
    spring: (a) => { a.tone({ f: 180, f2: 720, d: 0.3, type: 'sine', v: 0.32 }); a.tone({ f: 360, f2: 1100, d: 0.25, type: 'triangle', v: 0.1, at: 0.02 }); },
    avoid: (a) => a.tone({ f: 1320, d: 0.05, type: 'triangle', v: 0.05 }),
    streak: (a) => [0, 5, 9].forEach((s, i) => a.tone({ f: up(880, s), d: 0.1, type: 'square', v: 0.07, at: i * 0.05 })),
    shieldBreak: (a) => { a.noise({ d: 0.3, v: 0.25, f: 3000, q: 2 }); a.tone({ f: 1200, f2: 400, d: 0.3, type: 'triangle', v: 0.15 }); },
    bump: (a) => a.tone({ f: 170, f2: 120, d: 0.08, type: 'square', v: 0.16 }),
    rockFall: (a) => a.tone({ f: 1400, f2: 300, d: 0.75, type: 'sine', v: 0.08 }),
    rockLand: (a) => { a.noise({ d: 0.35, v: 0.35, f: 220, ft: 'lowpass' }); a.tone({ f: 90, f2: 40, d: 0.3, type: 'sine', v: 0.4 }); },
    crumble: (a) => a.noise({ d: 0.25, v: 0.12, f: 1500, q: 0.7 }),
    tick: (a) => a.tone({ f: 660, d: 0.12, type: 'square', v: 0.13 }),
    go: (a) => { a.tone({ f: 1320, d: 0.35, type: 'square', v: 0.12 }); a.tone({ f: 660, d: 0.35, type: 'triangle', v: 0.2 }); },
    finish: (a) => [0, 4, 7, 12].forEach((s, i) => a.tone({ f: up(523, s), d: 0.18, type: 'square', v: 0.11, at: i * 0.08 })),
    fanfare: (a) => {
      [[0, 0], [4, 0.12], [7, 0.24], [12, 0.36], [7, 0.54], [12, 0.66]].forEach(([s, t]) => {
        a.tone({ f: up(523, s), d: 0.22, type: 'square', v: 0.09, at: t });
        a.tone({ f: up(262, s), d: 0.22, type: 'triangle', v: 0.16, at: t });
      });
      a.tone({ f: 1046, d: 0.7, type: 'triangle', v: 0.2, at: 0.78 });
      a.tone({ f: 1318, d: 0.7, type: 'triangle', v: 0.12, at: 0.78 });
    },
    rate: (a, i) => a.tone({ f: up(880, (i || 0) * 4), d: 0.28, type: 'triangle', v: 0.24 }),
    best: (a) => [0, 7, 12, 16, 19].forEach((s, i) => a.tone({ f: up(659, s), d: 0.16, type: 'triangle', v: 0.16, at: i * 0.05 })),
    unlock: (a) => { a.tone({ f: 523, d: 0.1, type: 'square', v: 0.09 }); a.tone({ f: 1046, d: 0.25, type: 'square', v: 0.09, at: 0.09 }); },
    gameover: (a) => [0, -2, -4, -8].forEach((s, i) => a.tone({ f: up(392, s), d: i === 3 ? 0.7 : 0.26, type: 'triangle', v: 0.22, at: i * 0.24 })),
    click: (a) => a.tone({ f: 900, d: 0.04, type: 'triangle', v: 0.1 }),
    select: (a) => { a.tone({ f: 660, d: 0.06, type: 'square', v: 0.07 }); a.tone({ f: 990, d: 0.1, type: 'square', v: 0.07, at: 0.05 }); },
    pause: (a) => a.tone({ f: 523, f2: 392, d: 0.12, type: 'triangle', v: 0.15 }),
    unpause: (a) => a.tone({ f: 392, f2: 523, d: 0.12, type: 'triangle', v: 0.15 }),
    cheer: (a) => [0, 4, 7].forEach((s, i) => a.tone({ f: up(784, s), d: 0.12, type: 'triangle', v: 0.14, at: i * 0.05 })),
    tip: (a) => { a.tone({ f: 784, d: 0.08, type: 'sine', v: 0.18 }); a.tone({ f: 1175, d: 0.14, type: 'sine', v: 0.14, at: 0.07 }); },
  };

  Z.Audio = AU;
})(typeof window !== 'undefined' ? window : globalThis);
