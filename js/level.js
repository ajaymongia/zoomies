/* Zoomies! — stage builder. Each stage is a fixed (seeded) sequence of hand-designed sections,
   so a layout is the same on every attempt and can be learned. All gaps and heights are
   derived from the real jump physics at the speed the player will be running there. */
(function (root) {
  'use strict';
  const Z = root.Z, U = Z.U, P = Z.PHYS, GY = P.GY;

  const FULL = 10, MID = 0.15, HOP = 0;   // jump hold times used for coin trails

  function Builder(st) {
    this.st = st;
    this.rng = U.rng(st.seed);
    this.ents = [];
    this.gaps = [];
    this.L = st.length * P.M;
    this.coins = 0;
    this.stars = 0;
    this.at(0);
  }
  const B = Builder.prototype;

  B.r = function () { return this.rng(); };
  B.ri = function (a, b) { return a + Math.floor(this.rng() * (b - a + 1)); };
  B.lp = function (a, b) { return U.lerp(a, b, this.d); };
  B.at = function (x) {
    this.d = U.clamp(x / this.L, 0, 1);
    this.v = Z.speedAt(this.st, this.d);
    this.J = this.v * Z.JUMP_T;   // full jump distance on flat ground
  };
  B.add = function (e) { this.ents.push(e); return e; };

  /* ---------- entity factories ---------- */
  B.item = function (type, x, y, r, host, extra) {
    const e = { type, x, y, r, host: host || null, ox: host ? x - host.x : 0, oy: host ? y - host.y : 0 };
    if (host) e.dyn = true;
    return this.add(Object.assign(e, extra));
  };
  B.coin = function (x, y, host) { this.coins++; return this.item('coin', x, y, 12, host); };
  B.gem = function (x, y, host) { return this.item('gem', x, y, 14, host); };
  B.star = function (x, y, host) { this.stars++; return this.item('star', x, y, 20, host); };
  B.heart = function (x, y) { return this.item('heart', x, y, 17); };
  B.power = function (x, y, kind) { return this.item('power', x, y, 22, null, { kind }); };

  B.spikes = function (x, w) { return this.add({ type: 'spikes', x, y: GY - 30, w, h: 30, count: true }); };
  B.block = function (x, w, h) { return this.add({ type: 'block', x, y: GY - h, w, h, count: true }); };
  B.lucky = function (x, y, content) {
    if (content === 'coin') this.coins++;
    if (content === 'star') this.stars++;
    return this.add({ type: 'lucky', x, y, w: 44, h: 44, content, used: false, bump: 0, dyn: true });
  };
  B.plat = function (x, y, w, o) {
    o = o || {};
    const e = { type: 'plat', x, y, w, h: 22, bx: x, by: y, px: x, py: y,
      move: o.move || null, bouncy: !!o.bouncy, crumble: !!o.crumble, cT: -1, gone: false, vy: 0, squish: 0 };
    if (e.move || e.bouncy || e.crumble) e.dyn = true;
    return this.add(e);
  };
  B.spring = function (x) { return this.add({ type: 'spring', x, y: GY - 24, w: 48, h: 24, squish: 0, dyn: true }); };
  B.roller = function (x, r, vx) {
    return this.add({ type: 'roller', x, y: GY - r, r, vx, vy: 0, rot: 0, act: false, count: true, dyn: true, tint: this.ri(0, 4) });
  };
  B.beetle = function (x, vx) {
    return this.add({ type: 'beetle', x, y: GY - 30, w: 44, h: 30, vx, vy: 0, act: false, walk: 0, squash: 0, count: true, stomp: true, dyn: true });
  };
  B.frog = function (x, phase) {
    return this.add({ type: 'frog', x, y: GY - 34, w: 40, h: 34, vy: 0, air: false, hopT: phase, squash: 0, count: true, stomp: true, dyn: true });
  };
  B.bird = function (x, cy, vx) {
    return this.add({ type: 'bird', x, y: cy, cy, w: 44, h: 30, vx, act: false, ph: this.r() * 6, squash: 0, count: true, stomp: true, dyn: true });
  };
  B.gate = function (x, w) { return this.add({ type: 'gate', x, w, y: GY - 420, h: 380, count: true }); };
  B.rock = function (x, trig) { return this.add({ type: 'rock', x, y: -300, r: 26, vy: 0, st: 0, trig, rot: 0, count: true, dyn: true }); };
  B.geyser = function (x, per, ph) { return this.add({ type: 'geyser', x, y: GY - 12, w: 44, h: 12, per, ph, fh: 0, warn: false, count: true, dyn: true }); };
  B.fireball = function (x, per, ph) { return this.add({ type: 'fireball', x, y: GY + 70, r: 16, per, ph, dir: -1, dyn: true }); };
  B.gap = function (x0, x1, kind) {
    this.gaps.push([x0, x1]);
    return this.add({ type: 'gap', x: x0, w: x1 - x0, kind: kind || '', count: true });
  };

  /** Coins along a jump arc centred over cx. */
  B.arc = function (cx, hold, n) {
    const pts = Z.jumpPath(this.v, hold);
    const span = pts[pts.length - 1].x, x0 = cx - span / 2;
    for (let i = 0; i < n; i++) {
      const pt = pts[Math.floor((0.12 + 0.76 * (n === 1 ? 0.5 : i / (n - 1))) * (pts.length - 1))];
      this.coin(x0 + pt.x, GY + pt.y - 28);
    }
  };

  /* ---------- sections: (builder, x, arg) -> end x ---------- */
  const CH = {};

  CH.sign = function (b, x, kind) { b.add({ type: 'sign', x: x + 80, kind, shown: false }); return x + 260; };
  CH.banner = function (b, x, text) { b.add({ type: 'banner', x: x + 60, text, shown: false }); return x + 120; };

  CH.coins = function (b, x) {
    const n = b.ri(5, 8), wave = b.r() < 0.45, x0 = x + 60;
    for (let i = 0; i < n; i++) b.coin(x0 + i * 42, GY - 28 - (wave ? Math.sin((i / (n - 1)) * Math.PI) * 46 : 0));
    return x0 + n * 42 + 30;
  };

  CH.gemRun = function (b, x) {
    const n = 7, x0 = x + 60;
    for (let i = 0; i < n; i++) {
      const y = GY - 40 - Math.sin((i / (n - 1)) * Math.PI) * 70;
      if (i === 3) b.gem(x0 + i * 46, y); else b.coin(x0 + i * 46, y);
    }
    return x0 + n * 46 + 40;
  };

  CH.spikes = function (b, x, mode) {
    const w = mode === 'easy' ? 36 : 18 * b.ri(2, b.d > 0.5 ? 4 : 3);
    const sx = x + 150;
    b.spikes(sx, w);
    b.arc(sx + w / 2, mode === 'easy' ? MID : FULL, 5);
    return sx + w + 90;
  };

  CH.stump = function (b, x) {
    const h = b.ri(38, 54), w = 48, sx = x + 140;
    b.block(sx, w, h);
    for (let i = 0; i < 3; i++) b.coin(sx + 6 + i * 18, GY - h - 30);
    return sx + w + 90;
  };

  CH.stumpSpikes = function (b, x) {
    const sx = x + 140, h = 44, gap = Math.round(b.lp(70, 44));
    b.block(sx, 48, h);
    b.spikes(sx + 48 + gap, 54);
    for (let i = 0; i < 3; i++) b.coin(sx + 6 + i * 18, GY - h - 30);
    return sx + 48 + gap + 54 + 90;
  };

  CH.gap = function (b, x, mode) {
    const g = b.st.gapK;
    let k = mode === 'easy' ? g[0] : b.lp(g[0], g[1]) * (0.92 + b.r() * 0.12);
    if (mode === 'wide') k = g[1] * (0.95 + b.r() * 0.08);
    const w = Math.round(b.J * k), gx = x + 140;
    b.gap(gx, gx + w);
    b.arc(gx + w / 2, FULL, w > b.J ? 7 : 5);
    return gx + w + 100;
  };
  CH.gapWide = function (b, x) { return CH.gap(b, x, 'wide'); };

  CH.spikePair = function (b, x) {
    const w = 36, s1 = x + 150, close = b.r() < 0.5;
    const sep = close ? Math.round(b.lp(46, 70)) : Math.round(b.J * b.lp(1.15, 0.98));
    b.spikes(s1, w);
    b.spikes(s1 + w + sep, w);
    if (close) b.arc(s1 + w + sep / 2, FULL, 6);
    else { b.arc(s1 + w / 2, MID, 4); b.arc(s1 + w + sep + w / 2, MID, 4); }
    return s1 + 2 * w + sep + 90;
  };

  CH.platforms = function (b, x, o) {
    o = o || {};
    const p1x = x + 120, p1y = GY - 105, p1w = 150;
    const p2x = p1x + p1w + Math.round(b.lp(70, 110)), p2y = GY - 185, p2w = 140;
    b.plat(p1x, p1y, p1w);
    b.plat(p2x, p2y, p2w);
    for (let i = 0; i < 3; i++) b.coin(p1x + 35 + i * 40, p1y - 28);
    if (o.star) b.star(p2x + p2w / 2, p2y - 52);
    else if (o.heart) b.heart(p2x + p2w / 2, p2y - 36);
    else b.gem(p2x + p2w / 2, p2y - 32);
    return p2x + p2w + 110;
  };

  CH.lucky = function (b, x, o) {
    o = o || {};
    const n = o.star ? 3 : b.ri(2, 4), bx = x + 150, top = GY - 162, special = b.ri(0, n - 1);
    for (let i = 0; i < n; i++) {
      let c = 'coin';
      if (o.star && i === 1) c = 'star';
      else if (i === special && b.r() < 0.4) c = 'gem';
      b.lucky(bx + i * 44, top, c);
    }
    return bx + n * 44 + 100;
  };

  CH.springGap = function (b, x, o) {
    o = o || {};
    const sx = x + 140;
    b.spring(sx);
    const pts = Z.jumpPath(b.v, null, P.SPRING_V, -24);
    const S = pts[pts.length - 1].x;
    const gw = Math.round(S - 120), gx = sx + 48 + 20;
    b.gap(gx, gx + gw);
    const n = 7, lx = sx - 12;
    for (let i = 0; i < n; i++) {
      const pt = pts[Math.floor((0.1 + 0.8 * i / (n - 1)) * (pts.length - 1))];
      if (o.star && i === 3) b.star(lx + pt.x, GY + pt.y - 28);
      else if (i === 3) b.gem(lx + pt.x, GY + pt.y - 28);
      else b.coin(lx + pt.x, GY + pt.y - 28);
    }
    return gx + gw + 110;
  };

  CH.movingGap = function (b, x, mode) {
    const o = typeof mode === 'object' ? mode : { easy: mode === 'easy' };
    const axis = o.axis || (o.easy ? 'x' : b.r() < 0.6 ? 'x' : 'y');
    const gw = Math.round(U.clamp(b.J * (o.easy ? 1.4 : b.lp(1.45, 1.7)), 360, 640));
    const gx = x + 140;
    b.gap(gx, gx + gw);
    const pw = Math.round(o.easy ? 190 : b.lp(180, 145));
    const amp = Math.round(o.easy ? 30 : axis === 'x' ? b.lp(40, 70) : b.lp(30, 55));
    const py = axis === 'x' ? GY - 40 : GY - 75;
    const pl = b.plat(gx + gw / 2 - pw / 2, py, pw,
      { move: { axis, amp, per: o.easy ? 3 : b.lp(2.8, 2.2), ph: b.r() * Math.PI * 2 } });
    for (let i = 0; i < 3; i++) b.coin(pl.x + pw / 2 - 36 + i * 36, py - 28, pl);
    if (o.star) b.star(pl.x + pw / 2, py - 118, pl);
    return gx + gw + 110;
  };

  CH.bouncy = function (b, x) {
    const n = b.ri(2, 3);
    let px = x + 140;
    for (let i = 0; i < n; i++) {
      const y = GY - b.ri(60, 90);
      b.plat(px, y, 110, { bouncy: true });
      b.coin(px + 55, y - 230);
      px += 110 + b.ri(110, 150);
    }
    return px + 320;
  };

  CH.roller = function (b, x) {
    const r = b.ri(20, 26), vr = Math.round(b.lp(90, 160)), meet = x + 280;
    const rx = Math.round(meet + (vr * P.ACT) / (b.v + vr));
    b.roller(rx, r, -vr);
    for (let i = 0; i < 4; i++) b.coin(meet - 170 + i * 36, GY - 28);
    return rx + 80;
  };

  CH.gate = function (b, x, mode) {
    const w = mode === 'easy' ? 60 : Math.round(b.lp(60, 170)), gx = x + 170;
    b.gate(gx, w);
    for (let cx = gx - 24; cx <= gx + w + 24; cx += 30) b.coin(cx, GY - 14);
    return gx + w + 100;
  };

  CH.beetle = function (b, x) {
    const vb = Math.round(b.lp(50, 90)), meet = x + 260;
    const bx = Math.round(meet + (vb * P.ACT) / (b.v + vb));
    b.beetle(bx, -vb);
    return bx + 90;
  };

  CH.frog = function (b, x) {
    const fx = x + 220;
    b.frog(fx, b.r() * 1.4);
    return fx + 130;
  };

  CH.spikePlat = function (b, x, o) {
    o = o || {};
    const sw = 18 * b.ri(11, 16), sx = x + 230, py = GY - Math.round(b.lp(108, 126));
    b.spikes(sx, sw);
    b.plat(sx - 70, py, sw + 120);
    for (let cx = sx + 10; cx < sx + sw; cx += 46) b.coin(cx, py - 28);
    if (o.star) b.star(sx + sw / 2, py - 150);
    return sx + sw + 140;
  };

  CH.rock = function (b, x) {
    const rx = x + 280;
    b.rock(rx, Math.round(b.v * 1.32));
    b.coin(rx, GY - 120);
    return rx + 140;
  };

  CH.geysers = function (b, x, mode) {
    const n = mode === 'easy' ? 1 : b.ri(1, b.d > 0.4 ? 3 : 2);
    let gx = x + 180;
    for (let i = 0; i < n; i++) {
      b.geyser(gx, 2.0, b.r() * 2.0);
      gx += Math.round(b.lp(280, 210));
    }
    return gx + 60;
  };

  CH.lavaPit = function (b, x) {
    const w = Math.round(b.J * b.lp(0.48, 0.66)), gx = x + 150;
    b.gap(gx, gx + w, 'lava');
    b.fireball(gx + w / 2, 1.8, b.r() * 1.8);
    b.arc(gx + w / 2, FULL, 5);
    return gx + w + 110;
  };

  CH.cloudHop = function (b, x, mode) {
    const easy = mode === 'easy', gx = x + 140, n = easy ? 2 : b.ri(2, 3);
    let cx = gx, y = GY;
    for (let i = 0; i < n; i++) {
      cx += Math.round(b.J * (easy ? 0.5 : b.lp(0.55, 0.85)));
      const w = b.ri(150, 200);
      const ny = U.clamp(y + b.ri(-90, 60), GY - 190, GY - 30);
      const move = !easy && b.r() < 0.35 ? { axis: 'y', amp: 35, per: 2.6, ph: b.r() * 6.28 } : null;
      const pl = b.plat(cx, ny, w, { move });
      for (let k = 0; k < 3; k++) b.coin(cx + w / 2 - 36 + k * 36, ny - 28, pl);
      y = ny;
      cx += w;
    }
    const end = cx + Math.round(b.J * (easy ? 0.5 : b.lp(0.5, 0.75)));
    b.gap(gx, end);
    return end + 100;
  };

  CH.bird = function (b, x, mode) {
    mode = mode || (b.r() < 0.5 ? 'mid' : 'low');
    const vb = Math.round(b.lp(70, 130)), meet = x + 260;
    const bx = Math.round(meet + (vb * P.ACT) / (b.v + vb));
    b.bird(bx, mode === 'mid' ? GY - 50 : GY - 20, -vb);
    return bx + 80;
  };

  CH.birdPair = function (b, x) {
    const e = CH.bird(b, x, 'low');
    return CH.bird(b, e - 120 + Math.round(b.J * 0.5), 'mid');
  };

  CH.crumbleRun = function (b, x, mode) {
    const gx = x + 140, n = b.ri(5, 6);
    let cx = gx, y = GY - 40;
    for (let i = 0; i < n; i++) {
      cx += Math.round(b.J * b.lp(0.5, 0.7) * (0.9 + b.r() * 0.2));
      const w = b.ri(120, 150);
      y = U.clamp(y + b.ri(-70, 50), GY - 180, GY - 20);
      b.plat(cx, y, w, { crumble: true });
      if (mode === 'star' && i === 3) b.star(cx + w / 2, y - 190);
      else for (let k = 0; k < 2; k++) b.coin(cx + w / 2 - 18 + k * 36, y - 28);
      cx += w;
    }
    const end = cx + Math.round(b.J * 0.6);
    b.gap(gx, end);
    return end + 100;
  };

  /* combos: two ideas back to back, used once a stage has introduced both */
  CH.gateSpikes = function (b, x) {
    const gx = x + 160, w = Math.round(b.lp(60, 120));
    b.gate(gx, w);
    for (let cx = gx - 20; cx <= gx + w + 20; cx += 30) b.coin(cx, GY - 14);
    const sx = gx + w + Math.round(b.v * b.lp(0.75, 0.55));
    b.spikes(sx, 36);
    b.arc(sx + 18, MID, 4);
    return sx + 36 + 90;
  };

  CH.gatePair = function (b, x) {
    const g1 = x + 160, w1 = 60, g2 = g1 + w1 + Math.round(b.v * b.lp(0.45, 0.35)), w2 = Math.round(b.lp(70, 120));
    b.gate(g1, w1);
    b.gate(g2, w2);
    for (let cx = g1 - 20; cx <= g2 + w2 + 20; cx += 34) b.coin(cx, GY - 14);
    return g2 + w2 + 100;
  };

  CH.beetleGap = function (b, x) {
    const w = Math.round(b.J * b.lp(b.st.gapK[0], b.st.gapK[1]) * 0.9), gx = x + 140;
    b.gap(gx, gx + w);
    b.arc(gx + w / 2, FULL, 5);
    const vb = Math.round(b.lp(40, 70)), meet = gx + w + Math.round(b.v * 0.6);
    const bx = Math.round(meet + (vb * P.ACT) / (b.v + vb));
    b.beetle(bx, -vb);
    return bx + 90;
  };

  CH.rockGeyser = function (b, x) {
    const rx = x + 260;
    b.rock(rx, Math.round(b.v * 1.32));
    const gx = rx + Math.round(b.v * b.lp(0.8, 0.6));
    b.geyser(gx, 2.0, b.r() * 2.0);
    return gx + 44 + 100;
  };

  CH.birdGap = function (b, x) {
    const w = Math.round(b.J * b.lp(b.st.gapK[0], b.st.gapK[1])), gx = x + 140;
    b.gap(gx, gx + w);
    b.arc(gx + w / 2, FULL, 6);
    return CH.bird(b, gx + w - 120, b.r() < 0.5 ? 'mid' : 'low');
  };

  /* power-ups, hearts and stars */
  CH.power = function (b, x, kind) {
    const px = x + 170;
    for (let i = 0; i < 3; i++) b.coin(px - 130 + i * 36, GY - 28);
    b.power(px, GY - 70, kind);
    return px + 130;
  };
  CH.heartPlat = function (b, x) { return CH.platforms(b, x, { heart: true }); };
  CH.starHighJump = function (b, x) {
    const sx = x + 160;
    b.spikes(sx, 36);
    b.star(sx + 18, GY - 192);
    return sx + 36 + 110;
  };
  CH.starPlatforms = function (b, x) { return CH.platforms(b, x, { star: true }); };
  CH.starLucky = function (b, x) { return CH.lucky(b, x, { star: true }); };
  CH.starSpring = function (b, x) { return CH.springGap(b, x, { star: true }); };
  CH.starMoving = function (b, x) { return CH.movingGap(b, x, { star: true, axis: 'x' }); };
  CH.starSpikePlat = function (b, x) { return CH.spikePlat(b, x, { star: true }); };
  CH.starGeyser = function (b, x) {
    const gx = x + 180;
    b.geyser(gx, 2.0, b.r() * 2);
    b.star(gx + 22, GY - 192);
    return gx + 44 + 110;
  };
  CH.starDouble = function (b, x) {
    const sx = x + 220;
    for (let i = 0; i < 4; i++) b.coin(sx - 150 + i * 40, GY - 40 - i * 40);
    b.star(sx, GY - 310);
    return sx + 160;
  };

  function run(b, x, spec) {
    const i = spec.indexOf(':');
    const name = i < 0 ? spec : spec.slice(0, i), arg = i < 0 ? undefined : spec.slice(i + 1);
    if (!CH[name]) throw new Error('Unknown section ' + name);
    b.at(x);
    return CH[name](b, x, arg);
  }

  function breather(b, x) {
    b.at(x);
    const len = Math.round(b.v * U.lerp(b.st.breath[0], b.st.breath[1], b.d));
    if (len > 260 && b.r() < 0.3) {
      const n = b.ri(3, 5), c0 = x + len / 2 - (n - 1) * 20;
      for (let i = 0; i < n; i++) b.coin(c0 + i * 40, GY - 28);
    }
    return x + len;
  }

  /** Weighted pick that avoids repeats and favours sections used less so far. */
  function pick(b, st, last, used) {
    const opts = [];
    let total = 0;
    for (const name in st.pool) {
      const w = st.pool[name];
      const minD = Array.isArray(w) ? w[1] : 0;
      if (b.d < minD || name === last) continue;
      const weight = (Array.isArray(w) ? w[0] : w) / (1 + (used[name] || 0) * 0.6);
      opts.push([name, weight]);
      total += weight;
    }
    let r = b.r() * total;
    for (const o of opts) { r -= o[1]; if (r <= 0) return o[0]; }
    return opts[opts.length - 1][0];
  }

  Z.buildLevel = function (idx) {
    const st = Z.STAGES[idx];
    const b = new Builder(st);
    const L = b.L;
    let x = 1000;

    const sched = [];
    st.stars.forEach((s) => sched.push({ at: s[0], spec: s[1] }));
    st.powers.forEach((s) => sched.push({ at: s[0], spec: 'power:' + s[1] }));
    (st.hearts || []).forEach((a) => sched.push({ at: a, spec: 'heartPlat' }));
    sched.sort((a, c) => a.at - c.at);

    for (const s of st.intro) x = breather(b, run(b, x, s));

    let last = '';
    const used = {};
    let outroDone = !st.outro;
    while (x < L - 700) {
      if (!outroDone && x >= st.outroAt * L) {
        for (const s of st.outro) x = breather(b, run(b, x, s));
        outroDone = true;
        continue;
      }
      if (sched.length && x >= sched[0].at * L) {
        x = breather(b, run(b, x, sched.shift().spec));
        continue;
      }
      b.at(x);
      last = pick(b, st, last, used);
      used[last] = (used[last] || 0) + 1;
      x = breather(b, run(b, x, last));
    }
    while (sched.length) x = breather(b, run(b, x, sched.shift().spec));
    if (!outroDone) for (const s of st.outro) x = breather(b, run(b, x, s));

    const finishX = Math.round(Math.max(L, x + 300));
    b.add({ type: 'finish', x: finishX });

    // solid ground = everything that is not a gap
    b.gaps.sort((a, c) => a[0] - c[0]);
    const ground = [];
    let gx = -3000;
    for (const g of b.gaps) { if (g[0] > gx) ground.push([gx, g[0]]); gx = Math.max(gx, g[1]); }
    ground.push([gx, finishX + 6000]);

    b.ents.sort((a, c) => a.x - c.x);
    return { ents: b.ents, ground, finishX, totalCoins: b.coins, totalStars: b.stars };
  };

  /** Endless flat ground for the title-screen attract run. */
  Z.emptyLevel = function () {
    return { ents: [], ground: [[-1e9, 1e9]], finishX: 1e12, totalCoins: 0, totalStars: 0 };
  };

  Z.SECTIONS = CH;
})(typeof window !== 'undefined' ? window : globalThis);
