/* Zoomies! — renderer: camera, parallax layers, entities, particles and pop-up text. */
(function (root) {
  'use strict';
  const Z = root.Z, U = Z.U, P = Z.PHYS, A = Z.Art, GY = P.GY;

  function Renderer(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1; this.k = 1; this.w = 1; this.h = 1;
    this.viewW = P.MIN_VIEW_W; this.top = 0;
    this.camX = 0; this.t = 0;
    this.parts = []; this.pops = []; this.amb = [];
    this.shake = 0; this.shY = 0; this.hurtFlash = 0; this.unfade = 0; this.flashCol = '255,255,255';
    this.theme = A.THEMES.meadow;
    this.reduced = false;
    this.bot = 640;
  }
  const R = Renderer.prototype;

  R.resize = function (w, h) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.dpr = Math.min(root.devicePixelRatio || 1, 2);
    this.cv.width = Math.round(this.w * this.dpr);
    this.cv.height = Math.round(this.h * this.dpr);
    let k = this.h / P.VIEW_H;
    if (this.w / k < P.MIN_VIEW_W) k = this.w / P.MIN_VIEW_W;
    this.k = k;
    this.viewW = this.w / k;
    // On tall (portrait) screens the extra height is split: most becomes sky above, some becomes
    // ground below, so touch controls sit in the dirt instead of over the running lane.
    const extra = Math.max(0, this.h / k - P.VIEW_H);
    this.top = -extra * 0.7;              // world y at the top edge
    this.bot = this.top + this.h / k + 20; // a little past the bottom edge
    this.seedAmbient();
  };

  /** Sets a parallax transform (f = 0 sky-fixed, 1 = world) and returns the visible x range in layer space. */
  R.lay = function (f) {
    const s = this.k * this.dpr, x0 = this.camX * f;
    this.ctx.setTransform(s, 0, 0, s, -x0 * s, -(this.top + this.shY) * s);
    return [x0, x0 + this.viewW];
  };

  R.setStage = function (idx) {
    this.theme = A.THEMES[Z.STAGES[idx].key];
    this.parts.length = 0;
    this.pops.length = 0;
    this.shake = 0; this.hurtFlash = 0; this.unfade = 0;
    this.seedAmbient();
  };

  R.seedAmbient = function () {
    const dense = this.theme && (this.theme.ambient === 'rain' || this.theme.ambient === 'snow');
    const n = this.reduced ? 8 : dense ? 60 : 26;
    this.amb = [];
    for (let i = 0; i < n; i++) {
      this.amb.push({ x: Math.random() * this.viewW, y: this.top + Math.random() * (GY - this.top), s: 0.5 + Math.random(), ph: Math.random() * 6.28, c: Math.floor(Math.random() * 5) });
    }
  };

  /* ---------------- particles & pops ---------------- */
  R.burst = function (x, y, n, o) {
    if (this.reduced) n = Math.ceil(n / 3);
    for (let i = 0; i < n && this.parts.length < 360; i++) {
      const a = o.angle != null ? o.angle + (Math.random() - 0.5) * (o.spread || 1) : Math.random() * Math.PI * 2;
      const sp = (o.speed || 200) * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.g == null ? 600 : o.g,
        life: (o.life || 0.6) * (0.6 + Math.random() * 0.6), max: 0, size: (o.size || 4) * (0.6 + Math.random() * 0.8),
        col: Array.isArray(o.col) ? o.col[Math.floor(Math.random() * o.col.length)] : o.col, kind: o.kind || 'dot',
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12,
      });
      this.parts[this.parts.length - 1].max = this.parts[this.parts.length - 1].life;
    }
  };

  R.pop = function (x, y, text, o) {
    o = o || {};
    if (this.pops.length > 40) this.pops.shift();
    this.pops.push({ x, y, text, col: o.col || '#FFD23F', size: o.size || 18, life: o.life || 0.9, max: o.life || 0.9, vy: o.vy || -70 });
  };

  /** Turns simulation events into visual feedback. */
  R.handle = function (ev, sim) {
    const p = sim.p, th = this.theme;
    const dust = th.dust;
    switch (ev.type) {
      case 'jump': this.burst(ev.x - 6, ev.y, 5, { angle: Math.PI * 0.9, spread: 1.2, speed: 120, g: -60, life: 0.35, size: 6, col: dust, kind: 'puff' }); break;
      case 'djump':
        this.burst(ev.x, ev.y - 10, 10, { speed: 160, g: 200, life: 0.5, size: 5, col: ['#FFFFFF', '#D9CCFF'], kind: 'feather' });
        this.ring(ev.x, ev.y - 6, '#FFFFFF');
        break;
      case 'land': this.burst(ev.x, ev.y, Math.min(10, 3 + ev.v / 200), { angle: -Math.PI / 2, spread: 2.6, speed: 110, g: 80, life: 0.4, size: 6, col: dust, kind: 'puff' }); break;
      case 'slide': this.burst(ev.x - 10, ev.y, 6, { angle: Math.PI, spread: 0.8, speed: 140, g: -30, life: 0.35, size: 5, col: dust, kind: 'puff' }); break;
      case 'take':
        if (ev.item === 'coin') { this.burst(ev.x, ev.y, 6, { speed: 140, g: 0, life: 0.35, size: 3, col: ['#FFE45C', '#FFFFFF'], kind: 'spark' }); this.pop(ev.x, ev.y - 10, '+10', { size: 15 }); }
        else if (ev.item === 'gem') { this.burst(ev.x, ev.y, 12, { speed: 200, g: 0, life: 0.5, size: 4, col: ['#C99BFF', '#FFFFFF'], kind: 'spark' }); this.pop(ev.x, ev.y - 12, '+100', { col: '#D7B3FF', size: 20 }); }
        else if (ev.item === 'star') { this.burst(ev.x, ev.y, 18, { speed: 260, g: 100, life: 0.8, size: 6, col: ['#FFE45C', '#FFB020', '#FFFFFF'], kind: 'star' }); this.ring(ev.x, ev.y, '#FFE45C'); this.pop(ev.x, ev.y - 20, '★ +500', { size: 26, life: 1.3 }); }
        else if (ev.item === 'heart') { this.burst(ev.x, ev.y, 10, { speed: 160, g: -40, life: 0.7, size: 7, col: '#FF4D6D', kind: 'heart' }); this.pop(ev.x, ev.y - 16, ev.extra ? '+1 heart' : '+250', { col: '#FF8FA6', size: 20 }); }
        else if (ev.item === 'power') { const c = Z.POWERS[ev.kind].color; this.ring(ev.x, ev.y, c); this.burst(ev.x, ev.y, 14, { speed: 220, g: 0, life: 0.55, size: 5, col: [c, '#FFFFFF'], kind: 'spark' }); this.pop(p.x, p.y - 96, Z.POWERS[ev.kind].name + '!', { col: '#FFFFFF', size: 24, life: 1.2, vy: -40 }); }
        break;
      case 'bump':
        this.parts.push({ x: ev.x, y: ev.y - 14, vx: 0, vy: -360, g: 900, life: 0.5, max: 0.5, size: 12, col: '#FFC93C', kind: ev.item === 'gem' ? 'gemFly' : ev.item === 'star' ? 'starFly' : 'coinFly', rot: 0, vr: 0 });
        this.pop(ev.x, ev.y - 30, ev.item === 'star' ? '★ +500' : '+' + ev.pts, { size: ev.item === 'star' ? 26 : 16, col: ev.item === 'gem' ? '#D7B3FF' : '#FFD23F' });
        break;
      case 'bumpEmpty': this.burst(ev.x, ev.y + 40, 3, { speed: 60, life: 0.25, size: 3, col: '#C9A37A' }); break;
      case 'avoid': this.pop(ev.x, ev.y, '+20', { size: 14, col: '#FFFFFF', life: 0.7 }); break;
      case 'stomp':
        this.burst(ev.x, ev.y + 10, 10, { speed: 220, g: 300, life: 0.5, size: 6, col: ['#FFE45C', '#FFFFFF'], kind: 'star' });
        this.pop(ev.x, ev.y - 10, 'Bop! +100', { size: 20, col: '#FFFFFF' });
        break;
      case 'smash':
        this.burst(ev.x, ev.y, 14, { speed: 300, g: 600, life: 0.6, size: 6, col: ['#FFB020', '#FFFFFF', '#FF4F8B'], kind: 'shard' });
        this.pop(ev.x, ev.y - 10, 'Smash! +50', { size: 18, col: '#FFE45C' });
        break;
      case 'streak':
        this.pop(ev.x + 30, ev.y, 'Streak ×' + ev.n + '  +100', { size: 22, col: '#7CF0FF', life: 1.3, vy: -36 });
        break;
      case 'hurt':
        this.addShake(0.6);
        this.hurtFlash = 0.45; this.flashCol = '255,60,90';
        this.burst(ev.x, ev.y, 10, { speed: 200, g: 300, life: 0.5, size: 5, col: ['#FF4D6D', '#FFFFFF'], kind: 'star' });
        this.pop(ev.x, ev.y - 30, ev.hearts > 0 ? 'Ouch! −1 heart' : 'Ouch!', { size: 22, col: '#FF8FA6', life: 1.1 });
        break;
      case 'shieldBreak':
        this.addShake(0.3);
        this.burst(ev.x, ev.y, 16, { speed: 260, g: 400, life: 0.6, size: 6, col: ['#9CC6FF', '#FFFFFF', '#3D8BFF'], kind: 'shard' });
        this.pop(p.x, p.y - 96, ev.saved ? 'Shield saved you!' : 'Blocked!', { size: 22, col: '#9CC6FF', life: 1.2 });
        break;
      case 'fall': this.pop(p.x, GY - 60, 'Whoops! −1 heart', { size: 22, col: '#FF8FA6', life: 1.1 }); break;
      case 'respawn':
        this.unfade = 0.45;
        this.burst(ev.x, ev.y - 30, 14, { speed: 180, g: 0, life: 0.6, size: 7, col: ['#FFFFFF', '#CFE8FF'], kind: 'puff' });
        break;
      case 'spring': case 'bounce':
        this.ring(ev.x, ev.y, '#FFFFFF');
        this.pop(ev.x, ev.y - 34, 'Boing!', { size: 18, col: '#FFFFFF', life: 0.7 });
        break;
      case 'rockLand':
        this.addShake(0.35);
        this.burst(ev.x, ev.y, 12, { angle: -Math.PI / 2, spread: 2.4, speed: 200, g: 500, life: 0.5, size: 5, col: ['#8C6A8F', '#FF8A3D'], kind: 'shard' });
        break;
      case 'crumble': this.burst(ev.x, ev.y + 10, 8, { speed: 90, g: 300, life: 0.6, size: 6, col: '#FFFFFF', kind: 'puff' }); break;
      case 'finish':
        this.burst(ev.x, GY - 260, 40, { speed: 380, g: 500, life: 1.4, size: 6, col: ['#FF4F8B', '#FFC93C', '#3DB8FF', '#7EE07A', '#B47CFF'], kind: 'confetti' });
        break;
      case 'cheer': this.burst(p.x, p.y - 40, 12, { speed: 200, g: 100, life: 0.7, size: 6, col: ['#FFE45C', '#FFFFFF'], kind: 'star' }); break;
      case 'dead': this.addShake(0.8); this.hurtFlash = 0.5; this.flashCol = '255,60,90'; break;
      case 'tip': case 'banner': break;
    }
  };

  R.ring = function (x, y, col) {
    if (this.parts.length < 360) this.parts.push({ x, y, vx: 0, vy: 0, g: 0, life: 0.45, max: 0.45, size: 10, col, kind: 'ring', rot: 0, vr: 0 });
  };
  R.addShake = function (a) { if (!this.reduced) this.shake = Math.min(1, this.shake + a); };

  R.updateParts = function (dt) {
    const ps = this.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const q = ps[i];
      q.life -= dt;
      if (q.life <= 0) { ps.splice(i, 1); continue; }
      q.vy += q.g * dt;
      if (q.kind === 'confetti') { q.vx *= 0.985; q.vy = Math.min(q.vy, 160); }
      q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const o = this.pops[i];
      o.life -= dt; o.y += o.vy * dt; o.vy *= 0.96;
      if (o.life <= 0) this.pops.splice(i, 1);
    }
  };

  R.drawParts = function (ctx) {
    for (const q of this.parts) {
      const a = U.clamp(q.life / q.max, 0, 1);
      ctx.globalAlpha = a;
      switch (q.kind) {
        case 'puff': A.circ(ctx, q.x, q.y, q.size * (1.6 - a * 0.6)); ctx.fillStyle = q.col; ctx.fill(); break;
        case 'spark': ctx.fillStyle = q.col; A.starPath(ctx, q.x, q.y, q.size * 1.4, q.size * 0.4, 4, q.rot); ctx.fill(); break;
        case 'star': ctx.fillStyle = q.col; A.starPath(ctx, q.x, q.y, q.size, q.size * 0.45, 5, q.rot); ctx.fill(); break;
        case 'heart': ctx.fillStyle = q.col; A.heartPath(ctx, q.x, q.y, q.size * 0.6); ctx.fill(); break;
        case 'shard': ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.col; ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2); ctx.restore(); break;
        case 'feather': ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); A.ell(ctx, 0, 0, q.size, q.size * 0.4); ctx.fillStyle = q.col; ctx.fill(); ctx.restore(); break;
        case 'confetti': ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(1, Math.cos(q.rot * 2)); ctx.fillStyle = q.col; ctx.fillRect(-q.size / 2, -q.size / 3, q.size, q.size * 0.66); ctx.restore(); break;
        case 'ring': A.circ(ctx, q.x, q.y, 10 + (1 - a) * 40); ctx.strokeStyle = q.col; ctx.lineWidth = 4 * a; ctx.stroke(); break;
        case 'coinFly': A.coin(ctx, q.x, q.y, this.t * 3); break;
        case 'gemFly': A.gem(ctx, q.x, q.y, this.t); break;
        case 'starFly': A.star(ctx, q.x, q.y, this.t, 16); break;
        default: A.circ(ctx, q.x, q.y, q.size); ctx.fillStyle = q.col; ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  R.drawPops = function (ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const o of this.pops) {
      const a = U.clamp(o.life / o.max, 0, 1), grow = 1 + (1 - Math.min(1, (o.max - o.life) * 8)) * 0.4;
      ctx.globalAlpha = Math.min(1, a * 1.6);
      ctx.font = Math.round(o.size * grow) + 'px ' + A.FONT;
      ctx.lineWidth = Math.max(3, o.size * 0.28);
      ctx.strokeStyle = 'rgba(43,29,74,.85)';
      ctx.strokeText(o.text, o.x, o.y);
      ctx.fillStyle = o.col;
      ctx.fillText(o.text, o.x, o.y);
    }
    ctx.globalAlpha = 1;
  };

  /* ---------------- ambient atmosphere ---------------- */
  R.drawAmbient = function (ctx, dt, speed) {
    const th = this.theme, t = this.t;
    this.lay(0);
    const drift = (speed || 0) * 0.25 * dt;
    const cols = ['#FFFFFF', '#5CC8FF', '#FFE45C', '#8CFF8A', '#FF7FBF'];
    for (const a of this.amb) {
      switch (th.ambient) {
        case 'pollen': a.x -= drift + 10 * dt * a.s; a.y += Math.sin(t + a.ph) * 8 * dt; break;
        case 'sprinkles': a.x -= drift; a.y += 40 * dt * a.s; break;
        case 'fireflies': a.x -= drift * 0.6; a.y += Math.sin(t * 0.8 + a.ph) * 14 * dt; break;
        case 'embers': a.x -= drift * 0.8 - Math.sin(t + a.ph) * 6 * dt; a.y -= 50 * dt * a.s; break;
        case 'snow': a.x -= drift * 0.7 + (14 + Math.sin(t + a.ph) * 10) * dt; a.y += 46 * dt * a.s; break;
        case 'leaves': a.x -= drift * 0.8 + (20 + Math.sin(t * 1.3 + a.ph) * 24) * dt; a.y += 34 * dt * a.s; break;
        case 'rain': a.x -= drift + 90 * dt; a.y += 620 * dt * (0.8 + a.s * 0.3); break;
        case 'dust': a.x -= drift * 1.2 + 40 * dt * a.s; a.y += Math.sin(t * 2 + a.ph) * 10 * dt; break;
        case 'stars': a.x -= drift * 0.15; break;
        default: a.x -= drift * 0.5;
      }
      if (a.x < -10) a.x += this.viewW + 20;
      if (a.x > this.viewW + 10) a.x -= this.viewW + 20;
      if (a.y > GY) a.y = this.top;
      if (a.y < this.top) a.y = GY;
      switch (th.ambient) {
        case 'pollen':
          ctx.fillStyle = 'rgba(255,255,255,.75)'; A.circ(ctx, a.x, a.y, 1.6 * a.s); ctx.fill();
          if (a.c === 0 && a.s > 1.2) {
            const f = Math.sin(t * 14 + a.ph);
            ctx.fillStyle = '#FF7FBF';
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - 6, a.y - 5 * f); ctx.lineTo(a.x - 6, a.y + 3); ctx.fill();
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + 6, a.y - 5 * f); ctx.lineTo(a.x + 6, a.y + 3); ctx.fill();
          }
          break;
        case 'sprinkles':
          ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(t * a.s + a.ph); ctx.fillStyle = cols[a.c]; ctx.fillRect(-4, -1.5, 8, 3); ctx.restore();
          break;
        case 'fireflies': {
          const g = (Math.sin(t * 3 + a.ph) + 1) / 2;
          ctx.fillStyle = 'rgba(' + th.ffCol + ',' + (0.15 + g * 0.25) + ')'; A.circ(ctx, a.x, a.y, 7 * a.s); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,230,' + (0.4 + g * 0.6) + ')'; A.circ(ctx, a.x, a.y, 2 * a.s); ctx.fill();
          break;
        }
        case 'snow':
          ctx.fillStyle = 'rgba(255,255,255,.9)'; A.circ(ctx, a.x, a.y, 2.2 * a.s); ctx.fill();
          break;
        case 'leaves': {
          const lc = ['#E0522A', '#FFB347', '#D97A2A', '#C2410C', '#FFD27A'];
          ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(t * 2 * a.s + a.ph); ctx.scale(1, Math.cos(t * 3 + a.ph));
          A.ell(ctx, 0, 0, 5 * a.s, 2.6 * a.s); ctx.fillStyle = lc[a.c]; ctx.fill(); ctx.restore();
          break;
        }
        case 'rain':
          ctx.strokeStyle = 'rgba(190,205,255,.45)'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - 5, a.y + 16); ctx.stroke();
          break;
        case 'dust':
          ctx.fillStyle = U.rgba(th.dust, 0.55); A.circ(ctx, a.x, a.y, 1.4 * a.s); ctx.fill();
          break;
        case 'stars': {
          const g = (Math.sin(t * 2 + a.ph * 3) + 1) / 2;
          ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + g * 0.75) + ')'; A.starPath(ctx, a.x, a.y, 3 * a.s * g + 1, 0.8, 4); ctx.fill();
          break;
        }
        case 'embers':
          ctx.fillStyle = 'rgba(255,' + (140 + a.c * 20) + ',60,' + (0.5 + 0.4 * Math.sin(t * 5 + a.ph)) + ')';
          A.circ(ctx, a.x, a.y, 2 * a.s); ctx.fill();
          break;
        default: {
          const g = (Math.sin(t * 2.5 + a.ph) + 1) / 2;
          ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + g * 0.7) + ')';
          A.starPath(ctx, a.x, a.y, 4 * a.s * g + 1, 1, 4); ctx.fill();
        }
      }
    }
  };

  /* ---------------- player ---------------- */
  function poseOf(sim, t) {
    const p = sim.p;
    let mode = 'run', mood = '';
    if (p.state === 'dead') mode = 'dizzy';
    else if (p.hurtT > 0) mode = 'hurt';
    else if (p.sliding) mode = 'slide';
    else if (!p.onGround) mode = p.vy < 0 ? 'jump' : 'fall';
    else if (p.state === 'finish' && p.vx < 60) mode = 'happy';
    if (sim.pw.boost > 0 && mode !== 'hurt') mood = 'fierce';
    if (p.state === 'finish') mood = 'happy';
    return { mode, mood, phase: p.phase, t, blink: t % 3.3 < 0.12, land: p.landT > 0 ? (p.landT / 0.16) * 0.16 : 0 };
  }

  R.drawPlayer = function (ctx, sim, critter) {
    const p = sim.p, t = this.t;
    if (p.state === 'respawn') return;
    // shadow
    if (p.state !== 'dead' && sim.supported(p.x - 10, p.x + 10) && p.y <= GY + 2) {
      const surfY = p.onGround ? p.y : GY, d = U.clamp((surfY - p.y) / 260, 0, 1);
      A.ell(ctx, p.x + 2, surfY + 1, 22 * (1 - d * 0.6), 5 * (1 - d * 0.6));
      ctx.fillStyle = 'rgba(30,15,50,' + (0.25 * (1 - d)) + ')'; ctx.fill();
    }
    const boost = sim.pw.boost > 0;
    if (boost) {
      // rainbow speed streak
      const cols = ['#FF5C8A', '#FFB04D', '#FFE45C', '#6EE07A', '#5CC8FF', '#9C7CFF'];
      for (let i = 0; i < cols.length; i++) {
        ctx.fillStyle = U.rgba(cols[i], 0.75);
        ctx.fillRect(p.x - 150, p.y - 46 + i * 6 + Math.sin(t * 20 + i) * 1.5, 130, 6);
      }
      if (!sim.supported(p.x - 14, p.x + 14) && p.y >= GY - 1) {
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(p.x - 40, GY - 2, 90, 6);
      }
    }
    let alpha = 1;
    if (p.invuln > 0 && p.state === 'run' && !boost) alpha = Math.floor(t * 14) % 2 ? 0.35 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    if (p.state === 'dead') ctx.rotate(Math.sin(t * 10) * 0.2);
    if (sim.pw.feather > 0 && p.state !== 'dead' && !p.sliding) {
      const flap = p.djT > 0 ? Math.sin(t * 40) : p.onGround ? 0.1 : Math.sin(t * 8) * 0.3;
      A.wings(ctx, flap, sim.pw.feather < 2.5 && Math.floor(t * 8) % 2 ? 0.4 : 0.95);
    }
    A.critter(ctx, critter, poseOf(sim, t));
    if (sim.stage.doubleJump && sim.pw.feather <= 0 && p.state !== 'dead' && !p.sliding) {
      // sky boots
      ctx.fillStyle = '#5CC8FF'; ctx.strokeStyle = '#1B4F9C'; ctx.lineWidth = 1.6;
      A.rr(ctx, -21, -4, 12, 6, 3); ctx.fill(); ctx.stroke();
      A.rr(ctx, 0, -4, 12, 6, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFFFFF'; A.circ(ctx, -12, -5, 1.6); ctx.fill(); A.circ(ctx, 9, -5, 1.6); ctx.fill();
    }
    if (p.state === 'dead') {
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = '#FFE45C'; A.starPath(ctx, 12 + Math.cos(a) * 22, -76 + Math.sin(a) * 6, 6, 2.6); ctx.fill();
      }
    }
    ctx.restore();
    // shield / magnet auras
    if (sim.pw.shield > 0 && p.state !== 'dead') {
      const end = sim.pw.shield < 2.5 && Math.floor(t * 8) % 2;
      const cy = p.y - (p.sliding ? 18 : 32);
      A.circ(ctx, p.x + 4, cy, p.sliding ? 36 : 46);
      const g = ctx.createRadialGradient(p.x - 8, cy - 14, 6, p.x + 4, cy, 46);
      g.addColorStop(0, 'rgba(255,255,255,.05)'); g.addColorStop(0.75, 'rgba(120,180,255,.18)'); g.addColorStop(1, 'rgba(90,160,255,.55)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = end ? 'rgba(255,255,255,.3)' : 'rgba(200,230,255,.9)'; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x - 6, cy - 12, 26, Math.PI * 1.1, Math.PI * 1.45); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 4; ctx.stroke();
    }
    if (sim.pw.magnet > 0 && p.state !== 'dead') {
      ctx.save();
      ctx.setLineDash([6, 10]); ctx.lineDashOffset = -t * 40;
      ctx.strokeStyle = 'rgba(255,77,109,' + (sim.pw.magnet < 2.5 ? 0.25 : 0.45) + ')'; ctx.lineWidth = 2;
      A.circ(ctx, p.x, p.y - 28, 70 + Math.sin(t * 6) * 4); ctx.stroke();
      ctx.restore();
    }
  };

  /* ---------------- frame ---------------- */
  R.draw = function (sim, dt, o) {
    o = o || {};
    const ctx = this.ctx, th = this.theme;
    this.t += dt;
    this.updateParts(dt);
    const p = sim.p;
    // camera
    this.shY = 0;
    let sx = 0;
    if (this.shake > 0) {
      sx = (Math.random() - 0.5) * this.shake * 14;
      this.shY = (Math.random() - 0.5) * this.shake * 10;
      this.shake = Math.max(0, this.shake - dt * 2.6);
    }
    this.camX = p.x - this.viewW * 0.26 + sx;

    A.backdrop(ctx, this, th, this.t);
    A.abyss(ctx, this, th, this.t);

    const [v0, v1] = this.lay(1);
    const L = v0 - 260, Rr = v1 + 260;
    const ents = sim.ents;
    const fin = sim.finishX;
    if (fin > L && fin - 200 < Rr) A.finishBack(ctx, fin, this.t);
    for (const e of ents) if (e.type === 'sign' && e.x > L && e.x < Rr) A.sign(ctx, e, this.t);
    for (const g of sim.ground) if (g[1] > v0 - 40 && g[0] < v1 + 40) A.ground(ctx, this, th, g, this.t);
    this.lay(1);

    for (const e of ents) {
      const ex = e.x;
      if (ex < L || ex > Rr) continue;
      switch (e.type) {
        case 'spikes': A.spikes(ctx, e, th); break;
        case 'block': A.block(ctx, e, th); break;
        case 'lucky': A.lucky(ctx, e, this.t); break;
        case 'plat': if (!e.gone || e.y < GY + 400) A.plat(ctx, e, th, this.t); break;
        case 'spring': A.spring(ctx, e); break;
        case 'geyser': A.geyser(ctx, e, this.t, th); break;
        case 'rock':
          if (e.st === 0 && p.x > e.x - e.trig * 1.9 && !e.dead) A.rockWarn(ctx, e, this.t, p.x > e.x - e.trig * 1.2);
          break;
      }
    }
    for (const e of ents) {
      if (e.taken || e.x < L || e.x > Rr) continue;
      switch (e.type) {
        case 'coin': A.coin(ctx, e.x, e.y, this.t); break;
        case 'gem': A.gem(ctx, e.x, e.y, this.t); break;
        case 'star': A.star(ctx, e.x, e.y, this.t); break;
        case 'heart': A.heart(ctx, e.x, e.y, this.t); break;
        case 'power': A.power(ctx, e.kind, e.x, e.y, this.t); break;
      }
    }
    for (const e of ents) {
      if (e.dead || e.x < L || e.x > Rr) continue;
      switch (e.type) {
        case 'roller': A.roller(ctx, e, th); break;
        case 'beetle': A.beetle(ctx, e, th, this.t); break;
        case 'frog': A.frog(ctx, e, this.t); break;
        case 'bird': A.bird(ctx, e, this.t, th); break;
        case 'rock': if (e.st > 0) A.rock(ctx, e, th); break;
        case 'fireball': A.fireball(ctx, e, this.t, th); break;
      }
    }
    if (o.critter) this.drawPlayer(ctx, sim, o.critter);
    for (const e of ents) if (e.type === 'gate' && e.x + e.w > L && e.x < Rr) A.gate(ctx, e, th, this.t, this.top);
    if (fin > L && fin - 200 < Rr) A.finishFront(ctx, fin, this.t);

    this.drawParts(ctx);
    this.drawPops(ctx);
    if (!o.noAmbient) this.drawAmbient(ctx, dt, o.paused ? 0 : p.vx);

    // full-screen overlays (CSS pixels)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (sim.pw.boost > 0 && !this.reduced) {
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const y = (U.hash(i * 7.7 + Math.floor(this.t * 12)) * this.h);
        const x = (U.hash(i * 3.1 + Math.floor(this.t * 12)) * this.w);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 80, y); ctx.stroke();
      }
    }
    if (th.lightning && !this.reduced) {
      const ph = this.t % 2.7;
      if (ph < 0.14) { ctx.fillStyle = 'rgba(235,240,255,' + 0.22 * (1 - ph / 0.14) + ')'; ctx.fillRect(0, 0, this.w, this.h); }
    }
    if (this.hurtFlash > 0) {
      const a = this.hurtFlash;
      const g = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
      g.addColorStop(0, 'rgba(' + this.flashCol + ',0)'); g.addColorStop(1, 'rgba(' + this.flashCol + ',' + a + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.4);
    }
    let fade = 0;
    if (p.state === 'respawn') fade = U.clamp(1 - p.respawnT / 0.75, 0, 1) * 0.9;
    if (this.unfade > 0) { fade = Math.max(fade, (this.unfade / 0.45) * 0.9); this.unfade -= dt; }
    if (fade > 0) { ctx.fillStyle = 'rgba(255,255,255,' + fade + ')'; ctx.fillRect(0, 0, this.w, this.h); }
  };

  Z.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
