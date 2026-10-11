/* Zoomies! — shared helpers. Plain script so it runs from file:// and in Node (for level tests). */
(function (root) {
  'use strict';
  const Z = root.Z || (root.Z = {});

  const U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    smooth: (t) => t * t * (3 - 2 * t),

    /** Deterministic 0..1 hash for decoration placement. */
    hash(n) {
      const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
      return s - Math.floor(s);
    },

    /** Seeded PRNG (mulberry32) so every stage layout is identical on each attempt. */
    rng(seed) {
      let a = seed >>> 0;
      return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },

    ease: {
      outCubic: (t) => 1 - Math.pow(1 - t, 3),
      outBack: (t) => {
        const c1 = 1.70158, c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      },
      inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    },

    /** m:ss (or m:ss.t with tenths). */
    fmtTime(sec, tenths) {
      sec = Math.max(0, sec || 0);
      const whole = Math.floor(sec);
      const m = Math.floor(whole / 60), s = whole % 60;
      let out = m + ':' + String(s).padStart(2, '0');
      if (tenths) out += '.' + Math.min(9, Math.floor((sec - whole) * 10));
      return out;
    },

    /** h:mm:ss once past an hour, otherwise m:ss. */
    fmtClock(sec) {
      sec = Math.max(0, Math.floor(sec || 0));
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      return h > 0
        ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
        : m + ':' + String(s).padStart(2, '0');
    },

    fmtNum: (n) => Math.round(n || 0).toLocaleString('en-US'),

    overlap: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,

    circleRect(cx, cy, r, b) {
      const nx = cx < b.x ? b.x : cx > b.x + b.w ? b.x + b.w : cx;
      const ny = cy < b.y ? b.y : cy > b.y + b.h ? b.y + b.h : cy;
      const dx = cx - nx, dy = cy - ny;
      return dx * dx + dy * dy < r * r;
    },

    /** Mix a #rrggbb colour toward black (amt < 0) or white (amt > 0). */
    shade(hex, amt) {
      const n = parseInt(hex.slice(1), 16);
      let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
      else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
      const h = (v) => Math.round(v).toString(16).padStart(2, '0');
      return '#' + h(r) + h(g) + h(b);
    },

    rgba(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    },
  };

  /** Storage that never throws (private windows, sandboxed frames, Node). */
  U.store = {
    get(key, fallback, session) {
      try {
        const s = session ? root.sessionStorage : root.localStorage;
        const v = s && s.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch (e) { return fallback; }
    },
    set(key, value, session) {
      try {
        const s = session ? root.sessionStorage : root.localStorage;
        if (s) s.setItem(key, JSON.stringify(value));
      } catch (e) { /* storage unavailable: the game still works for this visit */ }
    },
  };

  Z.U = U;
})(typeof window !== 'undefined' ? window : globalThis);
