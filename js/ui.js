/* Zoomies! — DOM interface components: menu, HUD, stage intro, pause, results, game over,
   toasts and confetti. Each component only renders; main.js owns the game state. */
(function (root) {
  'use strict';
  const Z = root.Z, U = Z.U, A = Z.Art;
  const $ = (id) => document.getElementById(id);
  const UI = (Z.UI = {});
  const svg = (id, cls) => '<svg' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true"><use href="#' + id + '"/></svg>';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  UI.reduced = false;
  UI.lockUntil = 0;

  /* ---------------- screens ---------------- */
  UI.show = function (id) {
    const el = $(id);
    el.hidden = false;
    el.removeAttribute('inert');
    void el.offsetWidth; // restart the entrance transition
    el.classList.add('is-visible');
  };
  UI.hide = function (id) {
    const el = $(id);
    el.classList.remove('is-visible');
    el.setAttribute('inert', '');
  };
  UI.isOpen = (id) => $(id).classList.contains('is-visible');
  /** Ignore clicks for a moment after a screen appears, so a held jump can't skip it. */
  UI.lock = function (ms) { UI.lockUntil = performance.now() + ms; };
  UI.locked = () => performance.now() < UI.lockUntil;
  UI.announce = function (text) { const el = $('sr'); el.textContent = ''; setTimeout(() => { el.textContent = text; }, 30); };

  UI.clearToasts = function () { $('toasts').innerHTML = ''; };
  UI.toast = function (html, o) {
    o = o || {};
    const box = $('toasts');
    while (box.children.length > 2) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast' + (o.cls ? ' ' + o.cls : '');
    el.innerHTML = (o.icon ? svg(o.icon) : '') + '<span>' + html + '</span>';
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, o.ms || 2600);
  };

  /* ---------------- critter portraits ---------------- */
  UI.portrait = function (cv, critter, mode, t, opts) {
    opts = opts || {};
    const dpr = Math.min(root.devicePixelRatio || 1, 2);
    const css = cv.clientWidth || cv.width;
    const px = Math.round(css * dpr);
    if (cv.width !== px) { cv.width = px; cv.height = px; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);
    const s = (px / 100) * (opts.zoom || 1);
    ctx.setTransform(s, 0, 0, s, px * 0.47, px * (opts.feet || 0.86));
    A.critter(ctx, critter, { mode, t, phase: t * 12, blink: t % 3.4 < 0.12 });
  };

  /* ---------------- menu ---------------- */
  const NAMES = ['Zippy', 'Biscuit', 'Pickle', 'Nova', 'Mochi', 'Ziggy', 'Pip', 'Rocket', 'Sunny', 'Bean', 'Comet', 'Noodle',
    'Peaches', 'Sprout', 'Maple', 'Pixel', 'Bubbles', 'Waffles', 'Juniper', 'Pepper', 'Dash', 'Clover'];

  UI.Menu = {
    init(cb) {
      this.cb = cb;
      const grid = $('critter-grid');
      grid.innerHTML = Z.CRITTERS.map((c, i) =>
        '<button type="button" class="critter" role="radio" aria-checked="false" data-i="' + i + '" style="--tint:' + c.body + '" aria-label="' + c.name + '">' +
        '<canvas class="critter-cv" width="64" height="64" aria-hidden="true"></canvas>' +
        '<span class="critter-name">' + c.name + '</span><span class="tick">' + svg('i-check') + '</span></button>').join('');
      grid.addEventListener('click', (e) => {
        const b = e.target.closest('.critter');
        if (b) cb.onCritter(+b.dataset.i);
      });
      grid.addEventListener('keydown', (e) => this.radioKeys(e, '.critter', (i) => cb.onCritter(i)));

      const row = $('stage-row');
      row.addEventListener('click', (e) => {
        const b = e.target.closest('.stage-tile');
        if (!b) return;
        if (b.getAttribute('aria-disabled') === 'true') { cb.onLocked(+b.dataset.i); return; }
        cb.onStage(+b.dataset.i);
      });
      row.addEventListener('keydown', (e) => this.radioKeys(e, '.stage-tile:not([aria-disabled="true"])', (i) => cb.onStage(i)));

      const inp = $('inp-name');
      inp.addEventListener('input', () => cb.onName(inp.value));
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); cb.onPlay(); } });
      $('btn-dice').addEventListener('click', () => {
        let n;
        do { n = NAMES[Math.floor(Math.random() * NAMES.length)]; } while (n === inp.value && NAMES.length > 1);
        inp.value = n;
        cb.onName(n);
        cb.onSfx('select');
      });
      $('btn-play').addEventListener('click', () => cb.onPlay());
    },

    radioKeys(e, sel, pick) {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!keys[e.key]) return;
      e.preventDefault();
      const items = Array.from(e.currentTarget.querySelectorAll(sel));
      const cur = items.indexOf(document.activeElement);
      const next = items[(cur + keys[e.key] + items.length) % items.length];
      if (next) { pick(+next.dataset.i); next.focus(); }
    },

    render(s) {
      const crit = Z.CRITTERS[s.critter];
      document.querySelectorAll('.critter').forEach((b, i) => {
        const on = i === s.critter;
        b.setAttribute('aria-checked', on);
        b.tabIndex = on ? 0 : -1;
        b.classList.toggle('is-on', on);
        UI.portrait(b.querySelector('canvas'), Z.CRITTERS[i], 'idle', on ? 0.3 : 0, { zoom: 0.92 });
      });
      $('critter-blurb').innerHTML = '<b>' + crit.name + '</b> · ' + crit.tagline;
      if ($('inp-name').value !== s.name) $('inp-name').value = s.name;
      $('menu-greet').textContent = s.returning && s.name ? 'Welcome back, ' + s.name + '!' : 'Pick a critter, then hit play.';

      const row = $('stage-row');
      row.innerHTML = Z.STAGES.map((st, i) => {
        const locked = i >= s.unlocked, on = i === s.stage;
        const stars = s.stars[i] || 0;
        const th = A.THEMES[st.key];
        const starHtml = [0, 1, 2].map((k) => svg(k < stars ? 'i-star' : 'i-star-o', k < stars ? 'got' : '')).join('');
        return '<button type="button" class="stage-tile' + (on ? ' is-on' : '') + (locked ? ' is-locked' : '') + '" role="radio" data-i="' + i + '"' +
          ' aria-checked="' + on + '" aria-disabled="' + locked + '" tabindex="' + (on ? 0 : -1) + '"' +
          ' style="--a:' + th.sky[0] + ';--b:' + th.sky[2] + '"' +
          ' aria-label="Stage ' + st.id + ', ' + st.name + (locked ? ', locked' : ', ' + stars + ' of 3 stars') + '" title="' + st.name + '">' +
          '<span class="stage-n">' + (locked ? svg('i-lock') : st.id) + '</span>' +
          '<span class="stage-stars">' + starHtml + '</span></button>';
      }).join('');
      const st = Z.STAGES[s.stage];
      let info = row.nextElementSibling;
      if (!info || !info.classList.contains('stage-info')) {
        info = document.createElement('p');
        info.className = 'stage-info';
        row.after(info);
      }
      info.innerHTML = '<b>' + st.id + '. ' + st.name + '</b>' + (s.best[s.stage] ? ' · Best ' + U.fmtNum(s.best[s.stage]) : ' · Not played yet');
      const on = row.querySelector('.stage-tile.is-on');
      if (on) {
        const target = on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
        row.scrollLeft = Math.max(0, target);
      }
    },

    tick(t, critterIdx) {
      const b = document.querySelector('.critter.is-on canvas');
      if (b) UI.portrait(b, Z.CRITTERS[critterIdx], 'idle', t, { zoom: 0.92 });
    },
  };

  /* ---------------- HUD ---------------- */
  UI.HUD = {
    last: {},
    set(id, v) { if (this.last[id] !== v) { this.last[id] = v; $(id).textContent = v; } },

    show(stage, critter, best) {
      this.last = {};
      $('hud').hidden = false;
      $('hud-stage-num').textContent = 'S' + stage.id;
      $('hud-stage-name').textContent = stage.name;
      UI.portrait($('hud-marker'), critter, 'run', 0.2, { zoom: 1.05, feet: 0.84 });
      this.best = best;
      this.hearts(Z.PHYS.HEARTS, Z.PHYS.HEARTS, false);
      $('hud-powers').innerHTML = '';
      this.powerEls = {};
    },
    hide() { $('hud').hidden = true; },

    hearts(n, max, lost) {
      const el = $('hud-hearts');
      let html = '';
      for (let i = 0; i < max; i++) html += '<span class="heart' + (i < n ? '' : ' empty') + (lost && i === n ? ' lost' : '') + '">' + svg('i-heart') + '</span>';
      el.innerHTML = html;
      el.setAttribute('aria-label', 'Hearts: ' + n + ' of ' + max);
    },

    update(sim, session) {
      const s = sim.s;
      this.set('hud-score', U.fmtNum(s.score));
      const best = Math.max(this.best, s.score);
      const newBest = this.best > 0 && s.score > this.best;
      this.set('hud-best-val', newBest ? 'New best!' : this.best > 0 ? 'Best ' + U.fmtNum(best) : 'Best \u2014');
      if (this.last.nb !== newBest) { this.last.nb = newBest; $('hud-best').classList.toggle('is-new', newBest); }
      this.set('hud-time', U.fmtTime(sim.runTime, true));
      this.set('hud-total', 'Session ' + U.fmtClock(session));
      this.set('hud-coins', String(s.coins));
      this.set('hud-avoid', String(s.avoided));
      this.set('hud-speed', String(Math.round((sim.p.vx / Z.PHYS.M) * 3.6)));
      const pct = Math.floor(sim.progress() * 100);
      if (this.last.pct !== pct) {
        this.last.pct = pct;
        $('hud-pct').textContent = pct + '%';
        $('hud-fill').style.width = pct + '%';
        $('hud-marker').style.left = pct + '%';
        $('hud-progress').setAttribute('aria-valuenow', pct);
      }
      if (this.last.hearts !== sim.hearts) {
        const lost = this.last.hearts != null && sim.hearts < this.last.hearts;
        this.last.hearts = sim.hearts;
        this.hearts(sim.hearts, Z.PHYS.HEARTS, lost);
      }
      // power-up timers
      const box = $('hud-powers');
      for (const k in sim.pw) {
        const v = sim.pw[k];
        let el = this.powerEls[k];
        if (v > 0 && !el) {
          el = document.createElement('div');
          el.className = 'power-chip';
          el.style.setProperty('--c', Z.POWERS[k].color);
          el.innerHTML = svg('i-' + ({ shield: 'shield', magnet: 'magnet', feather: 'feather', boost: 'bolt' })[k]) +
            '<span class="pname">' + Z.POWERS[k].name + '</span><span class="ptime"></span><span class="pbar"><i></i></span>';
          box.appendChild(el);
          this.powerEls[k] = el;
        }
        if (el) {
          if (v <= 0) { el.remove(); delete this.powerEls[k]; continue; }
          const sec = Math.ceil(v);
          if (el._s !== sec) { el._s = sec; el.querySelector('.ptime').textContent = sec + 's'; }
          el.querySelector('i').style.transform = 'scaleX(' + U.clamp(v / Z.PHYS.POWER_DUR[k], 0, 1) + ')';
          el.classList.toggle('ending', v < 2.5);
        }
      }
    },

    sound(on) {
      const b = $('btn-sound-hud');
      b.setAttribute('aria-pressed', on);
      b.setAttribute('aria-label', on ? 'Sound effects on' : 'Sound effects off');
      b.querySelector('use').setAttribute('href', on ? '#i-sound' : '#i-mute');
    },
  };

  /* ---------------- stage intro ---------------- */
  UI.Intro = {
    show(idx, critter, lengthM, touch) {
      const st = Z.STAGES[idx];
      this.stage = st; this.critter = critter; this.t = 0;
      $('intro-kicker').textContent = 'Stage ' + st.id + ' of ' + Z.STAGES.length;
      $('intro-title').textContent = st.name;
      $('intro-blurb').textContent = st.blurb;
      $('intro-goal').textContent = 'Reach the flag · ' + lengthM + ' m';
      $('intro-mech-title').textContent = st.mech.title;
      $('intro-mech-text').textContent = touch ? st.mech.text.replace('Tap, click or press Space', 'Tap').replace('Press Down or swipe down', 'Swipe down or tap Slide') : st.mech.text;
      $('intro-hint').innerHTML = touch ? 'or tap anywhere' : 'or press <kbd>Space</kbd>';
      $('scr-intro').style.setProperty('--a', A.THEMES[st.key].sky[0]);
      UI.show('scr-intro');
      this.draw(0);
    },
    draw(dt) {
      this.t += dt;
      const cv = $('intro-demo');
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      const w = cv.clientWidth || 300, h = cv.clientHeight || 130;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      A.demo(ctx, this.stage.mech.demo, UI.reduced ? 0.55 * 2.4 + this.t * 0.4 : this.t, w, h, this.critter, A.THEMES[this.stage.key]);
    },
    hide() { UI.hide('scr-intro'); },
  };

  /* ---------------- countdown ---------------- */
  UI.Countdown = {
    show(text, go) {
      const el = $('countdown');
      el.innerHTML = '<span class="cd' + (go ? ' go' : '') + '">' + text + '</span>';
    },
    clear() { $('countdown').innerHTML = ''; },
  };

  /* ---------------- pause ---------------- */
  UI.Pause = {
    show(sim, session) {
      $('pause-stats').innerHTML =
        stat('Score', U.fmtNum(sim.s.score)) + stat('Run time', U.fmtTime(sim.runTime, true)) +
        stat('Coins', sim.s.coins) + stat('Session play time', U.fmtClock(session));
      UI.show('scr-pause');
      setTimeout(() => $('btn-resume').focus({ preventScroll: true }), 60);
    },
    hide() { UI.hide('scr-pause'); },
  };
  function stat(label, value, icon) {
    return '<div class="st"><dt>' + (icon ? svg(icon) : '') + label + '</dt><dd>' + value + '</dd></div>';
  }

  /** Animated number count-up (instant with reduced motion). */
  function countUp(el, to, ms, done) {
    if (UI.reduced || ms <= 0) { el.textContent = U.fmtNum(to); if (done) done(); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = U.fmtNum(to * U.ease.outCubic(k));
      if (k < 1) requestAnimationFrame(tick); else if (done) done();
    };
    requestAnimationFrame(tick);
  }

  /* ---------------- stage complete ---------------- */
  UI.Results = {
    show(d, cb) {
      const crit = d.critter;
      $('done-title').textContent = d.last ? 'Adventure Complete!' : 'Stage Complete!';
      $('done-name').textContent = d.name;
      $('done-sub').textContent = 'the ' + crit.name + ' · ' + Z.STAGES[d.stage].name;
      UI.portrait($('done-avatar'), crit, 'happy', 0.4, { zoom: 0.95 });

      const rating = $('done-rating');
      rating.innerHTML = [0, 1, 2].map((i) => '<span class="rstar' + (i < d.rating ? ' on' : '') + '" style="--d:' + (0.35 + i * 0.32) + 's">' + svg(i < d.rating ? 'i-star' : 'i-star-o') + '</span>').join('');
      rating.setAttribute('aria-label', d.rating + ' of 3 stars');
      $('done-criteria').innerHTML = d.criteria.map((c) => '<li class="' + (c.ok ? 'ok' : 'no') + '">' + svg(c.ok ? 'i-check' : 'i-x') + '<span>' + c.label + '</span><span class="sr-only">' + (c.ok ? ' done' : ' not yet') + '</span></li>').join('');

      $('done-stats').innerHTML =
        stat('Time', U.fmtTime(d.time, true), 'i-clock') +
        stat('Coins', d.coins + ' / ' + d.coinTotal, 'i-coin') +
        stat('Stars', d.stars + ' / ' + d.starTotal, 'i-star') +
        stat('Dodged', d.avoided, 'i-dodge') +
        stat('Dodge rate', Math.round(d.dodgeRate * 100) + '%', 'i-gauge') +
        stat('Hearts left', d.hearts + ' / ' + Z.PHYS.HEARTS, 'i-heart');
      $('done-bonus').innerHTML = '<li><span>Run score</span><b>' + U.fmtNum(d.base) + '</b></li>' +
        d.bonusLines.map((l) => '<li><span>' + l.label + '</span><b>+' + U.fmtNum(l.pts) + '</b></li>').join('') +
        (d.bonusLines.length ? '' : '<li class="muted"><span>No bonus this time</span><b>+0</b></li>');

      const unlock = $('done-unlock');
      unlock.hidden = !d.unlockText;
      if (d.unlockText) unlock.querySelector('span').textContent = d.unlockText;
      $('btn-next').hidden = d.last;
      $('done-best').hidden = true;
      $('done-score').textContent = '0';

      UI.show('scr-complete');
      UI.lock(900);
      const ms = UI.reduced ? 0 : 1200;
      setTimeout(() => {
        countUp($('done-score'), d.final, ms, () => {
          if (d.newBest) { $('done-best').hidden = false; cb.onBest(); }
        });
      }, UI.reduced ? 0 : 450);
      for (let i = 0; i < d.rating; i++) setTimeout(() => cb.onStar(i), UI.reduced ? 0 : 350 + i * 320 + 250);
      setTimeout(() => ($('btn-next').hidden ? $('btn-again') : $('btn-next')).focus({ preventScroll: true }), 950);
    },
    hide() { UI.hide('scr-complete'); },
  };

  /* ---------------- game over ---------------- */
  const TIPS = {
    spikes: 'Tip: hold jump a little longer to clear wide thorns.',
    gate: 'Tip: press Down or swipe down to slide under low ceilings.',
    fall: 'Tip: jump right at the edge and hold for the longest leap.',
    beetle: 'Tip: land on top of beetles to bop them.',
    frog: 'Tip: watch the frog. Run under it while it is high, hop over it when it lands.',
    bird: 'Tip: slide under high birds and jump over low ones.',
    roller: 'Tip: hop over rolling things just before they reach you.',
    rock: 'Tip: the red ! shows where a rock will land. Jump it after it lands.',
    geyser: 'Tip: geysers bubble before they blast. Jump high or pass while they rest.',
    fireball: 'Tip: use a full, held jump to sail over fireballs.',
    block: 'Tip: hop onto stumps and blocks, or jump them early.',
  };
  UI.Over = {
    show(d) {
      const pct = Math.round(d.progress * 100);
      const left = Math.max(0, d.lengthM - d.meters);
      let msg;
      if (d.progress >= 0.85) msg = 'So close! Only ' + left + ' m to the flag.';
      else if (d.progress >= 0.5) msg = 'Over halfway there. You have got this!';
      else if (d.progress >= 0.2) msg = 'Nice run! Every try teaches you the course.';
      else msg = 'Warm-up done. Now for the real run!';
      $('over-msg').textContent = msg;
      $('over-tip').textContent = TIPS[d.cause] || 'Tip: collect a shield bubble to block one hit.';
      UI.portrait($('over-avatar'), d.critter, 'dizzy', 0.5, { zoom: 0.95 });
      $('over-stage').textContent = 'Stage ' + (d.stage + 1) + ' · ' + Z.STAGES[d.stage].name;
      $('over-pct').textContent = pct + '% of the way';
      $('over-fill').style.width = pct + '%';
      $('over-stats').innerHTML =
        stat('Final score', U.fmtNum(d.score), 'i-trophy') +
        stat('Time survived', U.fmtTime(d.time, true), 'i-clock') +
        stat('Coins', d.coins, 'i-coin') +
        stat('Dodged', d.avoided, 'i-dodge');
      const best = Math.max(d.best, 1), mine = d.score;
      const max = Math.max(best, mine, 1);
      $('over-compare').innerHTML =
        '<div class="bar-row"><span>This run</span><span class="bar"><i style="width:' + Math.max(3, (mine / max) * 100) + '%"></i></span><b>' + U.fmtNum(mine) + '</b></div>' +
        '<div class="bar-row best"><span>Your best</span><span class="bar"><i style="width:' + Math.max(3, (d.best / max) * 100) + '%"></i></span><b>' + U.fmtNum(d.best) + '</b></div>' +
        (d.newBest ? '<p class="nb">' + svg('i-trophy') + 'New best score for this stage!</p>' : '');
      UI.show('scr-over');
      UI.lock(900);
      setTimeout(() => $('btn-retry').focus({ preventScroll: true }), 950);
    },
    hide() { UI.hide('scr-over'); },
  };

  /* ---------------- confetti ---------------- */
  UI.Confetti = {
    init(cv) { this.cv = cv; this.ctx = cv.getContext('2d'); this.parts = []; this.running = false; this.resize(); },
    resize() {
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      this.w = root.innerWidth; this.h = root.innerHeight; this.dpr = dpr;
      this.cv.width = Math.round(this.w * dpr); this.cv.height = Math.round(this.h * dpr);
    },
    burst() {
      const cols = ['#FF4F8B', '#FFC93C', '#3DB8FF', '#4CD97B', '#A879FF', '#FF8A2B', '#FFFFFF'];
      const n = UI.reduced ? 50 : 190;
      for (let i = 0; i < n; i++) {
        let x, y, vx, vy;
        if (UI.reduced || i % 3 === 2) { x = Math.random() * this.w; y = -20 - Math.random() * 200; vx = (Math.random() - 0.5) * 60; vy = 60 + Math.random() * 80; }
        else {
          const left = i % 3 === 0;
          x = left ? -10 : this.w + 10; y = this.h * (0.75 + Math.random() * 0.2);
          const a = left ? -Math.PI / 3 - Math.random() * 0.5 : -Math.PI * 2 / 3 + Math.random() * 0.5;
          const sp = this.h * (1.1 + Math.random() * 0.9);
          vx = Math.cos(a) * sp; vy = Math.sin(a) * sp;
        }
        this.parts.push({ x, y, vx, vy, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, w: 6 + Math.random() * 7, h: 4 + Math.random() * 5,
          col: cols[i % cols.length], shape: i % 5 === 0 ? 'c' : i % 7 === 0 ? 's' : 'r', life: 3.4 + Math.random() * 1.6, sway: Math.random() * 6 });
      }
      if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame((t) => this.frame(t)); }
    },
    frame(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const q = this.parts[i];
        q.life -= dt;
        if (q.life <= 0 || q.y > this.h + 40) { this.parts.splice(i, 1); continue; }
        q.vy += 900 * dt; q.vx *= Math.pow(0.35, dt); q.vy = Math.min(q.vy, 170 + Math.sin(q.sway + now / 300) * 30);
        q.x += (q.vx + Math.sin(now / 250 + q.sway) * 30) * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
        ctx.save();
        ctx.globalAlpha = Math.min(1, q.life);
        ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(1, Math.cos(q.rot * 1.7));
        ctx.fillStyle = q.col;
        if (q.shape === 'c') { ctx.beginPath(); ctx.arc(0, 0, q.w / 2, 0, Math.PI * 2); ctx.fill(); }
        else if (q.shape === 's') { A.starPath(ctx, 0, 0, q.w * 0.8, q.w * 0.35); ctx.fill(); }
        else ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
        ctx.restore();
      }
      if (this.parts.length) requestAnimationFrame((t) => this.frame(t));
      else { this.running = false; ctx.clearRect(0, 0, this.w, this.h); }
    },
    clear() { this.parts.length = 0; },
  };

  UI.esc = esc;
})(typeof window !== 'undefined' ? window : globalThis);
