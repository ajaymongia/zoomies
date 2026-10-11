/* Zoomies! — game simulation. Pure logic with no DOM access: the renderer, audio and UI
   read its state and the events it emits. Stepped at a fixed small timestep. */
(function (root) {
  'use strict';
  const Z = root.Z, U = Z.U, P = Z.PHYS, GY = P.GY;

  const HAZ = { spikes: 1, gate: 1, roller: 1, beetle: 1, frog: 1, bird: 1, rock: 1, geyser: 1, fireball: 1 };
  const ITEM = { coin: 1, gem: 1, star: 1, heart: 1, power: 1 };
  const SURF = { plat: 1, block: 1, lucky: 1 };

  function Sim(stageIdx, opts) {
    opts = opts || {};
    this.idx = stageIdx;
    this.stage = Z.STAGES[stageIdx];
    this.demo = !!opts.demo;
    const lv = this.demo ? Z.emptyLevel() : Z.buildLevel(stageIdx);
    this.lv = lv;
    this.ents = lv.ents;
    this.ground = lv.ground;
    this.finishX = lv.finishX;
    this.haz = []; this.items = []; this.surfs = []; this.springs = [];
    this.dyn = []; this.count = []; this.markers = []; this.gates = [];
    for (const e of this.ents) {
      if (HAZ[e.type]) this.haz.push(e);
      if (ITEM[e.type]) this.items.push(e);
      if (SURF[e.type]) this.surfs.push(e);
      if (e.type === 'spring') this.springs.push(e);
      if (e.type === 'gate') this.gates.push(e);
      if (e.count) this.count.push(e);
      if (e.type === 'sign' || e.type === 'banner') this.markers.push(e);
      if (e.dyn) this.dyn.push(e);
    }
    this.t = 0;
    this.runTime = 0;
    this.finished = false;
    this.over = false;
    this.hearts = P.HEARTS;
    this.pw = { shield: 0, magnet: 0, feather: 0, boost: 0 };
    this.s = { score: 0, coins: 0, gems: 0, stars: 0, avoided: 0, hits: 0, falls: 0, stomps: 0,
      streak: 0, bestStreak: 0, powerups: 0, lastCause: '' };
    this.lastM = 0;
    this.events = [];
    this.demoT = 2;
    this.p = {
      x: P.START_X, y: GY, vx: Z.speedAt(this.stage, 0), vy: 0, prevY: GY,
      onGround: true, surf: null, plat: null,
      coyote: 0, buffer: 0, held: false, cutOK: false, jumpT: 0, airJumps: 0,
      sliding: false, slideHold: 0, fastFall: false,
      invuln: 0, hurtT: 0, landT: 0, djT: 0, state: 'run', respawnT: 0, phase: 0, cheered: false,
    };
  }
  const S = Sim.prototype;

  S.emit = function (type, data) { const e = data || {}; e.type = type; this.events.push(e); };
  S.addScore = function (n) { this.s.score += n; };
  S.progress = function () { return U.clamp((this.p.x - P.START_X) / (this.finishX - P.START_X), 0, 1); };
  S.meters = function () { return Math.max(0, (this.p.x - P.START_X) / P.M); };
  S.lengthM = function () { return Math.round((this.finishX - P.START_X) / P.M); };
  S.canDouble = function () { return !!this.stage.doubleJump || this.pw.feather > 0; };
  S.pH = function () { return this.p.sliding ? P.PH_SLIDE : P.PH; };
  S.speed = function () { return this.p.vx; };

  /** True if any solid ground overlaps [x0, x1]. */
  S.supported = function (x0, x1) {
    const g = this.ground;
    let lo = 0, hi = g.length - 1, idx = g.length;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (g[m][1] >= x0) { idx = m; hi = m - 1; } else lo = m + 1;
    }
    return idx < g.length && g[idx][0] <= x1;
  };
  S.groundAt = function (x) { return this.supported(x, x); };

  /** Is there a low ceiling (gate) right above a sliding player? */
  S.ceilingAbove = function () {
    const p = this.p;
    for (const g of this.gates) {
      if (p.x + P.PW / 2 > g.x && p.x - P.PW / 2 < g.x + g.w && g.y + g.h > p.y - P.PH) return true;
    }
    return false;
  };

  /* ================= main step ================= */
  S.step = function (dt, inp) {
    const p = this.p;
    this.t += dt;
    if (!this.finished && !this.over) this.runTime += dt;
    this.updateDyn(dt);
    this.updatePowers(dt);
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.landT > 0) p.landT -= dt;
    if (p.djT > 0) p.djT -= dt;

    if (p.state === 'respawn') {
      p.respawnT -= dt;
      if (p.respawnT <= 0) this.respawn();
      return;
    }
    if (p.state === 'dead') {
      p.vy = Math.min(p.vy + P.G_DOWN * dt, P.MAX_FALL);
      p.y += p.vy * dt;
      return;
    }

    if (p.state === 'finish') {
      p.vx = Math.max(0, p.vx - 650 * dt);
      if (p.vx < 40 && p.onGround && !p.cheered) { p.cheered = true; p.vy = -620; p.onGround = false; this.emit('cheer'); }
    } else {
      const target = Z.speedAt(this.stage, this.progress()) * (this.pw.boost > 0 ? P.BOOST : 1);
      p.vx += (target - p.vx) * Math.min(1, dt * 5);
    }

    if (p.state === 'run') {
      if (this.demo) this.demoAI(dt); else this.input(dt, inp || NO_INPUT);
    }

    // variable jump height: letting go early trims the jump
    if (p.cutOK) {
      if (!p.held && p.jumpT >= P.MIN_HOLD && p.vy < -P.JUMP_CUT) { p.vy = -P.JUMP_CUT; p.cutOK = false; }
      if (p.vy >= 0) p.cutOK = false;
    }
    p.vy = Math.min(p.vy + (p.vy < 0 ? P.G_UP : P.G_DOWN) * dt, P.MAX_FALL);

    this.move(dt);
    p.jumpT += dt;

    if (p.state === 'run') {
      this.springCheck();
      this.hazards();
      if (p.state === 'run') {
        this.collect(dt);
        this.countPassed();
        this.markersCheck();
      }
    }
    if (p.onGround) p.phase += (p.vx * dt) / 26;
    else p.phase += dt * 4;

    if (p.y > GY + 240 && (p.state === 'run' || p.state === 'finish')) this.fall();

    if (!this.demo && p.state === 'run') {
      const m = Math.floor(this.meters());
      if (m > this.lastM) { this.addScore((m - this.lastM) * 2); this.lastM = m; }
      if (p.x >= this.finishX) {
        p.state = 'finish';
        this.finished = true;
        p.sliding = false;
        this.emit('finish', { x: p.x });
      }
    }
  };
  const NO_INPUT = { jumpPressed: false, downPressed: false, swipe: false, jumpHeld: false, downHeld: false };

  S.demoAI = function (dt) {
    const p = this.p;
    this.demoT -= dt;
    p.held = this.demoT > -0.25;
    if (this.demoT <= 0 && p.onGround) { this.jump(P.JUMP_V, 'jump', true); this.demoT = 1.6 + Math.random() * 1.8; }
  };

  S.input = function (dt, inp) {
    const p = this.p;
    // a swipe down that began as a tap means "go down", not "jump"
    const pressed = inp.jumpPressed && !(inp.swipe && inp.downPressed);
    if (inp.swipe && inp.downPressed) p.buffer = 0;
    if (pressed) p.buffer = P.BUFFER;
    p.held = !!inp.jumpHeld;
    if (inp.downPressed) {
      p.slideHold = Math.max(p.slideHold, inp.swipe ? P.SLIDE_SWIPE : P.SLIDE_MIN);
      if (!p.onGround) { p.fastFall = true; p.cutOK = false; p.vy = Math.max(p.vy, P.FAST_FALL); }
    }
    if (p.slideHold > 0) p.slideHold -= dt;
    if (p.buffer > 0) p.buffer -= dt;
    if (p.coyote > 0) p.coyote -= dt;
    const wantSlide = !!inp.downHeld || p.slideHold > 0;

    if (p.buffer > 0) {
      if (p.onGround || p.coyote > 0) {
        if (!(p.sliding && this.ceilingAbove())) this.jump(P.JUMP_V, 'jump');
      } else if (pressed && this.canDouble() && p.airJumps > 0) {
        p.airJumps--;
        this.jump(P.DJUMP_V, 'djump');
      }
    }

    if (p.onGround && wantSlide) {
      if (!p.sliding) { p.sliding = true; this.emit('slide', { x: p.x, y: p.y }); }
    } else if (p.sliding && (!p.onGround || !this.ceilingAbove())) {
      p.sliding = false;
    }
  };

  S.jump = function (v, kind, quiet) {
    const p = this.p;
    p.vy = -v;
    p.onGround = false; p.surf = null; p.plat = null;
    p.coyote = 0; p.buffer = 0; p.cutOK = true; p.jumpT = 0;
    p.sliding = false; p.fastFall = false;
    if (kind === 'jump') p.airJumps = this.canDouble() ? 1 : 0;
    else p.djT = 0.35;
    if (!quiet) this.emit(kind, { x: p.x, y: p.y });
  };

  /* ================= movement & collisions ================= */
  S.move = function (dt) {
    const p = this.p, h = this.pH(), hw = P.PW / 2;
    const prevY = p.y, prevX = p.x;
    const wasGround = p.onGround;
    const alive = p.state === 'run' || p.state === 'finish';
    p.prevY = prevY;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.onGround = false;

    // below the ground surface (inside a pit): the far cliff is a wall
    if (alive && p.y > GY + 12 && this.pw.boost <= 0) {
      const g = this.ground;
      for (let i = 0; i < g.length; i++) {
        const x0 = g[i][0];
        if (x0 > prevX + hw - 1 && x0 <= p.x + hw) { p.x = x0 - hw; break; }
        if (x0 > p.x + hw) break;
      }
    }

    let bestY = Infinity, bestE = null, found = false;

    // solid blocks: step up onto low ones, bonk into tall ones
    if (alive) {
      for (const e of this.surfs) {
        if (e.type !== 'block') continue;
        if (p.x + hw <= e.x || p.x - hw >= e.x + e.w) continue;
        if (p.y <= e.y || p.y - h >= e.y + e.h) continue;
        if (prevY <= e.y + 1) continue; // arriving from above: landing below handles it
        if (p.y - e.y <= P.STEP && p.vy >= 0) { found = true; bestY = e.y; bestE = e; continue; }
        if (p.state === 'run' && p.invuln <= 0 && this.pw.boost <= 0) this.hurt(e);
      }
    }

    // landing (one-way surfaces, ground, moving platforms)
    if (p.vy >= 0 && alive) {
      const f0 = p.x - P.FOOT, f1 = p.x + P.FOOT;
      const sp = p.plat;
      if (sp && !sp.gone && f1 > sp.x && f0 < sp.x + sp.w && Math.abs(prevY - sp.py) <= 3 && sp.y < bestY) {
        found = true; bestY = sp.y; bestE = sp;
      }
      if (p.y >= GY && prevY <= GY + 1 && GY < bestY && (this.supported(f0, f1) || this.pw.boost > 0)) {
        found = true; bestY = GY; bestE = null;
      }
      for (const e of this.surfs) {
        if (e.gone) continue;
        if (f1 <= e.x || f0 >= e.x + e.w) continue;
        const top = e.y, ptop = e.py !== undefined ? e.py : e.y;
        if (prevY <= ptop + 1 && p.y >= top && top < bestY) { found = true; bestY = top; bestE = e; }
      }
    }

    if (found) this.land(bestE, bestY, wasGround);
    else {
      p.plat = null; p.surf = null;
      if (wasGround && p.vy >= 0 && p.state === 'run') p.coyote = P.COYOTE;
    }

    // head-bonk lucky boxes from below
    if (p.vy < 0 && alive) {
      const top = p.y - h, ptop = prevY - h;
      for (const e of this.surfs) {
        if (e.type !== 'lucky') continue;
        if (p.x + 12 <= e.x || p.x - 12 >= e.x + e.w) continue;
        const bot = e.y + e.h;
        if (ptop >= bot - 1 && top < bot) { p.y = bot + h; p.vy = 120; p.cutOK = false; this.bump(e); break; }
      }
    }
  };

  S.land = function (e, y, wasGround) {
    const p = this.p, impact = p.vy;
    p.y = y; p.vy = 0; p.onGround = true; p.surf = e; p.fastFall = false; p.cutOK = false;
    p.plat = e && e.type === 'plat' ? e : null;
    p.airJumps = this.canDouble() ? 1 : 0;
    if (!wasGround) {
      p.landT = 0.16;
      if (impact > 250 && p.state !== 'dead') this.emit('land', { x: p.x, y, v: impact });
    }
    if (e && e.type === 'plat') {
      if (e.bouncy && p.state === 'run') {
        p.vy = -P.BOUNCY_V; p.onGround = false; p.plat = null; p.surf = null;
        e.squish = 1;
        this.emit('bounce', { x: p.x, y });
      }
      if (e.crumble && e.cT < 0) { e.cT = 0.55; this.emit('crumble', { x: e.x + e.w / 2, y: e.y }); }
    }
  };

  S.springCheck = function () {
    const p = this.p;
    if (p.vy < 0) return;
    for (const e of this.springs) {
      if (p.x + P.FOOT <= e.x || p.x - P.FOOT >= e.x + e.w) continue;
      if (p.y < e.y - 2 || p.y > e.y + e.h + 6) continue;
      p.y = e.y; p.vy = -P.SPRING_V;
      p.onGround = false; p.plat = null; p.surf = null;
      p.cutOK = false; p.sliding = false; p.fastFall = false;
      p.airJumps = this.canDouble() ? 1 : 0;
      e.squish = 1;
      this.emit('spring', { x: e.x + e.w / 2, y: e.y });
      return;
    }
  };

  /* ================= hazards ================= */
  S.hits = function (e, b) {
    switch (e.type) {
      case 'spikes': return U.overlap(b, { x: e.x + 4, y: e.y + 10, w: e.w - 8, h: e.h - 10 });
      case 'gate': return U.overlap(b, { x: e.x + 4, y: e.y, w: e.w - 8, h: e.h });
      case 'rock': if (e.st === 0) return false; return U.circleRect(e.x, e.y, e.r * 0.86, b);
      case 'roller': return U.circleRect(e.x, e.y, e.r * 0.86, b);
      case 'fireball': return e.y < GY + 6 && U.circleRect(e.x, e.y, e.r * 0.8, b);
      case 'beetle': case 'frog': return U.overlap(b, { x: e.x + 4, y: e.y + 4, w: e.w - 8, h: e.h - 4 });
      case 'bird': return U.overlap(b, { x: e.x - e.w / 2 + 5, y: e.y - e.h / 2 + 3, w: e.w - 10, h: e.h - 6 });
      case 'geyser': return e.fh > 10 && U.overlap(b, { x: e.x + 8, y: GY - e.fh, w: e.w - 16, h: e.fh });
    }
    return false;
  };
  S.topOf = function (e) { return e.type === 'bird' ? e.y - e.h / 2 : e.y; };

  S.hazards = function () {
    const p = this.p, h = this.pH();
    const box = { x: p.x - 13, y: p.y - h + 4, w: 26, h: h - 4 };
    for (const e of this.haz) {
      if (e.dead || e.squash > 0) continue;
      if (e.x < p.x - 400 || e.x > p.x + 400) continue;
      if (!this.hits(e, box)) continue;
      if (e.stomp && p.vy > 0 && p.prevY <= this.topOf(e) + 12) { this.stompE(e); continue; }
      if (this.pw.boost > 0) {
        if (e.stomp || e.type === 'roller' || e.type === 'rock') this.smash(e);
        continue;
      }
      if (p.invuln > 0) continue;
      this.hurt(e);
      if (p.state !== 'run') return;
    }
  };

  S.stompE = function (e) {
    const p = this.p;
    e.squash = 0.6;
    e.passed = true;
    p.vy = -(p.held ? P.STOMP_V_HELD : P.STOMP_V);
    p.cutOK = false; p.onGround = false; p.fastFall = false;
    p.airJumps = this.canDouble() ? 1 : 0;
    this.s.stomps++;
    this.avoid(e, 100, 'stomp');
  };

  S.smash = function (e) {
    e.dead = true;
    e.smashed = true;
    e.passed = true;
    this.avoid(e, 50, 'smash');
  };

  S.hurt = function (e) {
    const p = this.p;
    if (e) e.hit = true;
    this.s.streak = 0;
    this.s.lastCause = e ? e.type : 'fall';
    if (this.pw.shield > 0) {
      this.pw.shield = 0;
      p.invuln = 1.0;
      this.emit('shieldBreak', { x: p.x, y: p.y - 28 });
      return;
    }
    this.hearts--;
    this.s.hits++;
    p.invuln = P.INVULN;
    p.hurtT = 0.45;
    if (p.onGround) { p.vy = -420; p.onGround = false; p.plat = null; }
    this.emit('hurt', { x: p.x, y: p.y - 30, hearts: this.hearts, cause: this.s.lastCause });
    if (this.hearts <= 0) this.die();
  };

  S.die = function () {
    const p = this.p;
    this.over = true;
    p.state = 'dead';
    p.vy = -760;
    p.sliding = false;
    this.emit('dead', { x: p.x, y: p.y });
  };

  S.fall = function () {
    const p = this.p;
    for (const e of this.count) if (e.type === 'gap' && p.x >= e.x - 20 && p.x <= e.x + e.w + 40) e.hit = true;
    this.s.streak = 0;
    this.s.lastCause = 'fall';
    if (this.pw.shield > 0) {
      this.pw.shield = 0;
      this.emit('shieldBreak', { x: p.x, y: GY, saved: true });
      this.startRespawn();
      return;
    }
    this.hearts--;
    this.s.hits++;
    this.s.falls++;
    this.emit('fall', { x: p.x, hearts: this.hearts });
    if (this.hearts <= 0) {
      this.over = true;
      p.state = 'dead';
      p.vy = 0;
      p.y = GY + 400;
      this.emit('dead', { x: p.x, y: GY, fell: true });
      return;
    }
    this.startRespawn();
  };

  S.startRespawn = function () {
    const p = this.p;
    p.state = 'respawn'; p.respawnT = 0.75; p.vy = 0; p.sliding = false; p.plat = null;
  };

  S.safeAt = function (x) {
    let ok = false;
    for (const s of this.ground) if (s[0] <= x - 40 && s[1] >= x + 320) { ok = true; break; }
    if (!ok) return false;
    for (const e of this.haz) {
      if (e.dead) continue;
      if (e.type !== 'spikes' && e.type !== 'gate' && e.type !== 'geyser' && e.type !== 'rock') continue;
      const x0 = e.type === 'rock' ? e.x - e.r : e.x, x1 = e.type === 'rock' ? e.x + e.r : e.x + e.w;
      if (x1 > x - 60 && x0 < x + 320) return false;
    }
    for (const e of this.surfs) if (e.type === 'block' && e.x + e.w > x - 60 && e.x < x + 320) return false;
    return true;
  };

  S.respawn = function () {
    const p = this.p;
    let x = Math.ceil(p.x / 20) * 20 + 40;
    for (let i = 0; i < 400 && !this.safeAt(x); i++) x += 20;
    if (x > this.finishX - 60) x = Math.min(x, this.finishX - 60);
    p.x = x; p.y = GY; p.vy = 0;
    p.onGround = true; p.plat = null; p.surf = null; p.state = 'run';
    // obstacles skipped by the rescue are not "avoided"
    for (const e of this.count) if (!e.passed && rightEdge(e) < x - P.PW / 2) e.passed = true;
    for (const e of this.markers) if (e.x < x) e.shown = true;
    p.invuln = P.RESPAWN_INVULN; p.buffer = 0; p.coyote = 0; p.slideHold = 0;
    p.airJumps = this.canDouble() ? 1 : 0;
    this.lastM = Math.max(this.lastM, Math.floor(this.meters()));
    this.emit('respawn', { x: p.x, y: GY });
  };

  /* ================= pickups ================= */
  S.collect = function (dt) {
    const p = this.p, h = this.pH();
    const box = { x: p.x - P.PW / 2, y: p.y - h, w: P.PW, h };
    const cx = p.x, cy = p.y - h / 2;
    const mag = this.pw.magnet > 0, R2 = P.MAGNET_R * P.MAGNET_R;
    for (const e of this.items) {
      if (e.taken) continue;
      const dx = e.x - cx;
      if (dx < -300 || dx > 600) continue;
      if (mag && !e.mag && (e.type === 'coin' || e.type === 'gem')) {
        const dy = e.y - cy;
        if (dx * dx + dy * dy < R2) { e.mag = true; e.host = null; }
      }
      if (e.mag) {
        const ddx = cx - e.x, ddy = cy - e.y, d = Math.hypot(ddx, ddy) || 1;
        const step = Math.min(d, (700 + p.vx) * dt);
        e.x += (ddx / d) * step;
        e.y += (ddy / d) * step;
      }
      if (U.circleRect(e.x, e.y, e.r + 6, box)) this.take(e);
    }
  };

  S.take = function (e) {
    e.taken = true;
    const s = this.s;
    let pts = 0, extra = false;
    switch (e.type) {
      case 'coin': s.coins++; pts = 10; break;
      case 'gem': s.gems++; pts = 100; break;
      case 'star': s.stars++; pts = 500; break;
      case 'heart':
        if (this.hearts < P.HEARTS) { this.hearts++; extra = true; } else pts = 250;
        break;
      case 'power': this.activate(e.kind); s.powerups++; break;
    }
    if (pts) this.addScore(pts);
    this.emit('take', { item: e.type, kind: e.kind, x: e.x, y: e.y, pts, extra, hearts: this.hearts });
  };

  S.activate = function (kind) {
    this.pw[kind] = P.POWER_DUR[kind];
    if (kind === 'feather') this.p.airJumps = Math.max(this.p.airJumps, 1);
    this.emit('power', { kind, x: this.p.x, y: this.p.y - 30 });
  };

  S.updatePowers = function (dt) {
    const p = this.p;
    for (const k in this.pw) {
      if (this.pw[k] <= 0) continue;
      this.pw[k] -= dt;
      if (k === 'boost' && this.pw.boost <= 0 && p.state === 'run' && !this.supported(p.x - P.FOOT, p.x + P.FOOT)) {
        this.pw.boost = 0.05; // keep the rainbow floor until we are over solid ground
        continue;
      }
      if (this.pw[k] <= 0) { this.pw[k] = 0; this.emit('powerEnd', { kind: k }); }
    }
  };

  S.bump = function (e) {
    e.bump = 1;
    if (e.used) { this.emit('bumpEmpty', { x: e.x + e.w / 2, y: e.y }); return; }
    e.used = true;
    const s = this.s, c = e.content;
    let pts = 0;
    if (c === 'coin') { s.coins++; pts = 10; }
    else if (c === 'gem') { s.gems++; pts = 100; }
    else if (c === 'star') { s.stars++; pts = 500; }
    this.addScore(pts);
    this.emit('bump', { x: e.x + e.w / 2, y: e.y, item: c, pts });
  };

  /* ================= scoring obstacles ================= */
  function rightEdge(e) {
    if (e.type === 'roller' || e.type === 'rock') return e.x + e.r;
    if (e.type === 'bird') return e.x + e.w / 2;
    return e.x + e.w;
  }

  S.countPassed = function () {
    const p = this.p, left = p.x - P.PW / 2;
    for (const e of this.count) {
      if (e.passed || e.hit || e.dead) continue;
      if (rightEdge(e) >= left) continue;
      if (e.type === 'gap' && p.y > GY + 4) continue;
      e.passed = true;
      if (e.type === 'rock' && e.st === 0) continue;
      this.avoid(e, 20, 'avoid');
    }
  };

  S.avoid = function (e, pts, kind) {
    const s = this.s;
    s.avoided++;
    s.streak++;
    if (s.streak > s.bestStreak) s.bestStreak = s.streak;
    this.addScore(pts);
    const x = e.type === 'gap' ? e.x + e.w : e.x + (e.w ? e.w / 2 : 0);
    const y = e.type === 'gap' || e.type === 'gate' ? GY - 70 : (e.y || GY) - 20;
    this.emit(kind, { x, y, pts, streak: s.streak, obj: e.type });
    if (s.streak % 5 === 0) {
      this.addScore(100);
      this.emit('streak', { n: s.streak, pts: 100, x: this.p.x, y: this.p.y - 90 });
    }
  };

  S.markersCheck = function () {
    for (const e of this.markers) {
      if (e.shown) continue;
      if (this.p.x > e.x - (e.type === 'sign' ? 560 : 320)) {
        e.shown = true;
        this.emit(e.type === 'sign' ? 'tip' : 'banner', { kind: e.kind, text: e.text });
      }
    }
  };

  /* ================= moving things ================= */
  S.updateDyn = function (dt) {
    const p = this.p, t = this.t;
    for (const e of this.dyn) {
      switch (e.type) {
        case 'plat':
          e.px = e.x; e.py = e.y;
          if (e.move) {
            const a = Math.sin((t * Math.PI * 2) / e.move.per + e.move.ph) * e.move.amp;
            if (e.move.axis === 'x') e.x = e.bx + a; else e.y = e.by + a;
          }
          if (e.squish > 0) e.squish = Math.max(0, e.squish - dt * 3);
          if (e.cT >= 0 && !e.gone) { e.cT -= dt; if (e.cT <= 0) { e.gone = true; e.vy = 0; } }
          if (e.gone && e.y < GY + 600) { e.vy += 1800 * dt; e.y += e.vy * dt; }
          break;
        case 'coin': case 'gem': case 'star':
          if (e.host && !e.taken) { e.x = e.host.x + e.ox; e.y = e.host.y + e.oy; }
          break;
        case 'roller':
          if (e.dead) break;
          if (!e.act) { if (e.x - p.x < P.ACT) e.act = true; else break; }
          e.x += e.vx * dt;
          e.rot += (e.vx * dt) / e.r;
          if (e.vy || !this.groundAt(e.x)) { e.vy += 2400 * dt; e.y += e.vy * dt; if (e.y > GY + 500) e.dead = true; }
          break;
        case 'beetle':
          if (e.squash > 0) { e.squash -= dt; if (e.squash <= 0) e.dead = true; break; }
          if (e.dead) break;
          if (!e.act) { if (e.x - p.x < P.ACT) e.act = true; else break; }
          e.x += e.vx * dt;
          e.walk += dt;
          if (e.vy || !this.groundAt(e.x + e.w / 2)) { e.vy += 2400 * dt; e.y += e.vy * dt; if (e.y > GY + 500) e.dead = true; }
          break;
        case 'frog':
          if (e.squash > 0) { e.squash -= dt; if (e.squash <= 0) e.dead = true; break; }
          if (e.dead) break;
          e.hopT -= dt;
          if (e.air) {
            e.vy += 2000 * dt;
            e.y += e.vy * dt;
            if (e.y >= GY - e.h) { e.y = GY - e.h; e.vy = 0; e.air = false; }
          } else if (e.hopT <= 0 && Math.abs(e.x - p.x) < P.ACT) {
            e.vy = -700; e.air = true; e.hopT = 1.4;
          }
          break;
        case 'bird':
          if (e.squash > 0) { e.squash -= dt; if (e.squash <= 0) e.dead = true; break; }
          if (e.dead) break;
          if (!e.act) { if (e.x - p.x < P.ACT) e.act = true; else break; }
          e.x += e.vx * dt;
          e.y = e.cy + Math.sin(t * 5 + e.ph) * 5;
          break;
        case 'rock':
          if (e.dead) break;
          if (e.st === 0) {
            if (p.x > e.x - e.trig && p.state !== 'dead') { e.st = 1; e.y = -300; e.vy = 0; this.emit('rockFall', { x: e.x }); }
          } else if (e.st === 1) {
            e.vy += 2400 * dt;
            e.y += e.vy * dt;
            e.rot += dt * 4;
            if (e.y >= GY - e.r) { e.y = GY - e.r; e.st = 2; this.emit('rockLand', { x: e.x, y: GY }); }
          }
          break;
        case 'geyser': {
          const c = (((t + e.ph) % e.per) + e.per) % e.per / e.per;
          let fh = 0;
          if (c > 0.65) { const k = (c - 0.65) / 0.35; fh = 100 * Math.min(1, k * 6, (1 - k) * 6); }
          e.fh = fh;
          e.warn = c > 0.45 && c <= 0.65;
          break;
        }
        case 'fireball': {
          const c = (t + e.ph) % e.per, up = 0.8;
          if (c < up) { e.y = GY + 70 - (800 * c - 1000 * c * c); e.dir = c < up / 2 ? -1 : 1; }
          else e.y = GY + 70;
          break;
        }
        case 'lucky': if (e.bump > 0) e.bump = Math.max(0, e.bump - dt * 4); break;
        case 'spring': if (e.squish > 0) e.squish = Math.max(0, e.squish - dt * 4); break;
      }
    }
  };

  /* ================= results ================= */
  S.results = function () {
    const s = this.s, total = this.lv.totalCoins;
    const coinPct = total ? s.coins / total : 1;
    const lines = [];
    if (this.hearts > 0) lines.push({ label: 'Hearts left × ' + this.hearts, pts: this.hearts * 300 });
    if (s.hits === 0) lines.push({ label: 'Flawless run', pts: 1000 });
    if (s.stars >= this.lv.totalStars && this.lv.totalStars > 0) lines.push({ label: 'All stars found', pts: 750 });
    const bonus = lines.reduce((a, l) => a + l.pts, 0);
    const encounters = s.avoided + s.hits;
    const crit = [
      { label: 'Reached the flag', ok: true },
      { label: 'Collected half the coins', ok: coinPct >= 0.5 },
      { label: 'No hearts lost', ok: s.hits === 0 },
    ];
    return {
      stage: this.idx, base: s.score, bonus, bonusLines: lines, final: s.score + bonus,
      time: this.runTime, coins: s.coins, coinTotal: total, coinPct, gems: s.gems,
      stars: s.stars, starTotal: this.lv.totalStars, avoided: s.avoided, hits: s.hits, stomps: s.stomps,
      dodgeRate: encounters ? s.avoided / encounters : 1, hearts: this.hearts, bestStreak: s.bestStreak,
      rating: crit.filter((c) => c.ok).length, criteria: crit,
      meters: Math.round(this.meters()), lengthM: this.lengthM(), progress: this.progress(), cause: s.lastCause,
    };
  };

  Z.Sim = Sim;
})(typeof window !== 'undefined' ? window : globalThis);
