/* Zoomies! — game controller: state machine, main loop, persistence and wiring. */
(function (root) {
  'use strict';
  const Z = root.Z, U = Z.U, P = Z.PHYS, UI = Z.UI, AU = Z.Audio, IN = Z.Input;
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = 'zoomies.save.v1', SESSION_KEY = 'zoomies.session.v1';
  const STEP = 1 / 120;          // simulation step; frames are split into steps this size or smaller
  const CD_TICK = 0.6;           // countdown seconds per number

  const G = {
    state: 'loading', prev: null,
    sim: null, demo: null, stage: 0,
    save: null, session: null,
    countdown: 0, cdTick: CD_TICK, cdShown: '', goT: 0,
    wait: null, celebrated: null, results: null, over: null,
    t: 0, saveTimer: 0, touch: false, rotateBlock: false, pausedByRotate: false,
  };

  /* ---------------- persistence ---------------- */
  function loadSave() {
    const d = U.store.get(SAVE_KEY, {}) || {};
    const n = Z.STAGES.length;
    const arr = (a) => Z.STAGES.map((_, i) => (Array.isArray(a) ? Math.max(0, +a[i] || 0) : 0));
    const unlocked = U.clamp((d.unlocked | 0) || 1, 1, n);
    let reducedOS = false;
    try { reducedOS = root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }
    return {
      name: typeof d.name === 'string' ? d.name.slice(0, 14) : '',
      critter: Number.isInteger(d.critter) && d.critter >= 0 && d.critter < Z.CRITTERS.length ? d.critter : 0,
      unlocked,
      stage: U.clamp(d.stage | 0, 0, unlocked - 1),
      best: arr(d.best),
      stars: arr(d.stars).map((v) => U.clamp(v, 0, 3)),
      sfx: d.sfx !== false,
      music: d.music !== false,
      reduced: typeof d.reduced === 'boolean' ? d.reduced : reducedOS,
      played: !!d.played,
    };
  }
  const persist = () => U.store.set(SAVE_KEY, G.save);
  function loadSession() {
    const d = U.store.get(SESSION_KEY, {}, true) || {};
    return { play: Math.max(0, +d.play || 0), best: Math.max(0, +d.best || 0), runs: Math.max(0, d.runs | 0) };
  }
  const persistSession = () => U.store.set(SESSION_KEY, G.session, true);

  const critter = () => Z.CRITTERS[G.save.critter];
  const playerName = () => (G.save.name || '').trim() || 'Player';

  /* ---------------- screens ---------------- */
  const OVERLAYS = ['scr-loading', 'scr-menu', 'scr-intro', 'scr-pause', 'scr-complete', 'scr-over'];
  function only(id) { for (const s of OVERLAYS) if (s !== id && UI.isOpen(s)) UI.hide(s); if (id) UI.show(id); }
  function setState(s) { G.state = s; $('app').dataset.state = s; }

  function showMenu() {
    setState('menu');
    UI.clearToasts();
    AU.stopMusic();
    IN.enabled = false; IN.releaseAll();
    UI.Countdown.clear();
    UI.Confetti.clear();
    UI.HUD.hide();
    $('touch').hidden = true;
    G.sim = null; G.wait = null;
    G.demo = new Z.Sim(G.save.stage, { demo: true });
    G.renderer.setStage(G.save.stage);
    renderMenu();
    only('scr-menu');
    persistSession();
  }

  function renderMenu() {
    UI.Menu.render({ name: G.save.name, critter: G.save.critter, stage: G.save.stage, unlocked: G.save.unlocked,
      stars: G.save.stars, best: G.save.best, returning: G.save.played });
  }

  function startStage(idx, withIntro) {
    G.stage = idx;
    UI.clearToasts();
    G.sim = new Z.Sim(idx);
    G.celebrated = null; G.results = null; G.over = null; G.wait = null;
    G.renderer.setStage(idx);
    UI.Confetti.clear();
    UI.Countdown.clear();
    UI.HUD.show(Z.STAGES[idx], critter(), G.save.best[idx]);
    UI.HUD.sound(G.save.sfx);
    $('touch').hidden = !G.touch;
    AU.stopMusic();
    IN.enabled = false; IN.releaseAll();
    if (withIntro) {
      setState('intro');
      only('scr-intro');
      UI.Intro.show(idx, critter(), G.sim.lengthM(), G.touch);
      UI.lock(450);
      setTimeout(() => { if (G.state === 'intro') $('btn-start').focus({ preventScroll: true }); }, 60);
    } else {
      only(null);
      beginCountdown(CD_TICK);
    }
  }

  function beginCountdown(tick) {
    if (UI.isOpen('scr-intro')) UI.Intro.hide();
    setState('countdown');
    G.cdTick = tick;
    G.countdown = tick * 3;
    G.cdShown = '';
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    IN.enabled = false;
  }

  function tickCountdown(dt) {
    G.countdown -= dt;
    if (G.countdown > 0) {
      const label = String(Math.ceil(G.countdown / G.cdTick));
      if (label !== G.cdShown) { G.cdShown = label; UI.Countdown.show(label); AU.play('tick'); }
      return;
    }
    setState('playing');
    UI.Countdown.show('GO!', true);
    G.goT = 0.7;
    AU.play('go');
    if (AU.song) AU.resumeMusic(); else AU.startMusic(Z.STAGES[G.stage].key);
    IN.clearQueue();
    IN.enabled = true;
  }

  function pause() {
    if (G.state !== 'playing' && G.state !== 'countdown') return;
    G.prev = G.state;
    setState('paused');
    IN.enabled = false; IN.releaseAll();
    UI.Countdown.clear();
    AU.pauseMusic();
    AU.play('pause');
    UI.Pause.show(G.sim, G.session.play);
    UI.lock(200);
    persistSession();
  }

  function resume() {
    if (G.state !== 'paused') return;
    UI.Pause.hide();
    AU.play('unpause');
    beginCountdown(0.4); // a short 3-2-1 so you are ready when the action restarts
  }

  /* ---------------- outcomes ---------------- */
  function onFinish() {
    if (G.state !== 'playing') return;      // completion can only fire once per run
    setState('completing');
    IN.enabled = false; IN.releaseAll();
    AU.stopMusic();
    AU.play('finish');
    const r = G.sim.results(), idx = G.stage, save = G.save, n = Z.STAGES.length;
    const prevBest = save.best[idx];
    r.newBest = r.final > prevBest;
    save.best[idx] = Math.max(prevBest, r.final);
    save.stars[idx] = Math.max(save.stars[idx], r.rating);
    let unlockText = '';
    if (idx + 1 < n) {
      if (save.unlocked < idx + 2) { save.unlocked = idx + 2; unlockText = 'Stage ' + (idx + 2) + ' unlocked: ' + Z.STAGES[idx + 1].name; }
      save.stage = idx + 1;
    } else unlockText = 'All ' + n + ' worlds cleared. You are a Zoomies legend!';
    persist();
    G.session.best = Math.max(G.session.best, r.final);
    G.session.runs++;
    persistSession();
    G.results = Object.assign(r, { name: playerName(), critter: critter(), last: idx === n - 1, unlockText });
    G.wait = { t: 1.15, fn: showComplete };
  }

  function showComplete() {
    if (G.celebrated === G.sim) return;     // confetti and fanfare exactly once per completion
    G.celebrated = G.sim;
    setState('complete');
    UI.clearToasts();
    $('touch').hidden = true;
    UI.Confetti.burst();
    AU.play('fanfare');
    UI.Results.show(G.results, { onStar: (i) => AU.play('rate', i), onBest: () => AU.play('best') });
    const r = G.results;
    UI.announce('Stage complete! ' + r.rating + ' of 3 stars. Final score ' + U.fmtNum(r.final) + '.' + (r.unlockText ? ' ' + r.unlockText + '.' : ''));
  }

  function onDead() {
    if (G.state !== 'playing') return;
    setState('dying');
    IN.enabled = false; IN.releaseAll();
    AU.stopMusic();
    const r = G.sim.results(), idx = G.stage, prevBest = G.save.best[idx];
    G.over = {
      score: r.base, time: r.time, coins: r.coins, avoided: r.avoided, progress: r.progress, meters: r.meters,
      lengthM: r.lengthM, stage: idx, cause: r.cause, critter: critter(),
      best: Math.max(prevBest, r.base), newBest: r.base > prevBest && prevBest > 0,
    };
    G.save.best[idx] = Math.max(prevBest, r.base);
    persist();
    G.session.best = Math.max(G.session.best, r.base);
    G.session.runs++;
    persistSession();
    G.wait = { t: 1.5, fn: showGameOver };
  }

  function showGameOver() {
    setState('gameover');
    UI.clearToasts();
    $('touch').hidden = true;
    AU.play('gameover');
    UI.Over.show(G.over);
    UI.announce('Out of hearts. Score ' + U.fmtNum(G.over.score) + '. Try again?');
  }

  /* ---------------- events from the simulation ---------------- */
  const TIP_TEXT = {
    jump: (t) => (t ? 'Tap to jump. Hold for a higher leap.' : 'Press <kbd>Space</kbd> or <kbd>↑</kbd> to jump. Hold for a higher leap.'),
    spring: () => 'Run onto springs to bounce over big gaps.',
    moving: () => 'Platforms drift. Time your hop onto them.',
    slide: (t) => (t ? 'Swipe down or tap Slide to duck under.' : 'Hold <kbd>↓</kbd> to slide under low ceilings.'),
    stomp: () => 'Land on beetles to bop them for points.',
    rock: () => 'A red ! marks where a rock will land.',
    geyser: () => 'Geysers bubble, then blast. Jump high or pass while they rest.',
    double: (t) => (t ? 'Sky boots! Tap again in mid-air to double jump.' : 'Sky boots! Press jump again in mid-air.'),
  };

  function handleEvents(sim) {
    const evs = sim.events;
    for (let i = 0; i < evs.length; i++) {
      const ev = evs[i];
      G.renderer.handle(ev, sim);
      switch (ev.type) {
        case 'jump': AU.play('jump'); break;
        case 'djump': AU.play('djump'); break;
        case 'land': AU.play('land'); break;
        case 'slide': AU.play('slide'); break;
        case 'take':
          if (ev.item === 'power') {
            AU.play('power');
            const pw = Z.POWERS[ev.kind];
            UI.toast('<b>' + pw.name + '</b> ' + pw.desc, { icon: 'i-' + ({ shield: 'shield', magnet: 'magnet', feather: 'feather', boost: 'bolt' })[ev.kind] });
            UI.announce(pw.name + ' power-up: ' + pw.desc);
          } else AU.play(ev.item);
          if (ev.item === 'star') UI.announce('Star found: ' + sim.s.stars + ' of ' + sim.lv.totalStars);
          if (ev.item === 'heart' && ev.extra) UI.announce('Extra heart. ' + ev.hearts + ' hearts.');
          break;
        case 'bump': AU.play('bump'); AU.play(ev.item === 'star' ? 'star' : ev.item === 'gem' ? 'gem' : 'coin'); break;
        case 'bumpEmpty': AU.play('bump'); break;
        case 'avoid': AU.play('avoid'); break;
        case 'stomp': AU.play('stomp'); break;
        case 'smash': AU.play('smash'); break;
        case 'streak': AU.play('streak'); break;
        case 'hurt':
          AU.play('hurt');
          UI.announce('Ouch! ' + ev.hearts + (ev.hearts === 1 ? ' heart' : ' hearts') + ' left.');
          try { if (G.touch && navigator.vibrate) navigator.vibrate(60); } catch (e) { /* optional */ }
          break;
        case 'shieldBreak': AU.play('shieldBreak'); UI.announce('Your shield blocked it.'); break;
        case 'fall': AU.play('fall'); UI.announce('Fell in. ' + ev.hearts + (ev.hearts === 1 ? ' heart' : ' hearts') + ' left.'); break;
        case 'spring': case 'bounce': AU.play('spring'); break;
        case 'powerEnd': AU.play('powerEnd'); break;
        case 'rockFall': AU.play('rockFall'); break;
        case 'rockLand': AU.play('rockLand'); break;
        case 'crumble': AU.play('crumble'); break;
        case 'tip': AU.play('tip'); if (TIP_TEXT[ev.kind]) UI.toast(TIP_TEXT[ev.kind](G.touch), { icon: 'i-flag', cls: 'tip', ms: 3200 }); break;
        case 'banner': AU.play('tip'); UI.toast(ev.text, { icon: 'i-star', cls: 'big', ms: 3200 }); UI.announce(ev.text); break;
        case 'cheer': AU.play('cheer'); break;
        case 'finish': onFinish(); break;
        case 'dead': onDead(); break;
      }
    }
    evs.length = 0;
  }

  function stepSim(dt) {
    const sim = G.sim;
    const n = Math.max(1, Math.ceil(dt / STEP - 1e-6)), h = dt / n;
    const first = IN.consume();
    const rest = { jumpPressed: false, downPressed: false, swipe: false, jumpHeld: first.jumpHeld, downHeld: first.downHeld };
    for (let i = 0; i < n; i++) {
      sim.step(h, i === 0 ? first : rest);
      if (sim.events.length) handleEvents(sim);
    }
  }

  /* ---------------- main loop ---------------- */
  let last = 0;
  function frame(now) {
    let dt = last ? (now - last) / 1000 : 0;
    last = now;
    if (dt > 0.1) dt = 0.1;        // after a stall, slow down rather than teleport
    if (dt < 0) dt = 0;
    if (!root.Zoomies.manual) tick(dt);   // `manual` lets automated tests own the clock
    requestAnimationFrame(frame);
  }

  function tick(dt) {
    if (G.rotateBlock) return;    // nothing runs behind the rotate prompt
    G.t += dt;
    const st = G.state;
    if (st === 'menu' || st === 'loading') {
      const n = Math.max(1, Math.ceil(dt / STEP)), h = dt / n;
      for (let i = 0; i < n; i++) { G.demo.step(h); G.demo.events.length = 0; }
      G.renderer.draw(G.demo, dt, { critter: critter() });
      if (st === 'menu') UI.Menu.tick(G.t, G.save.critter);
    } else if (G.sim) {
      const live = st === 'playing' || st === 'completing' || st === 'dying';
      if (live) stepSim(dt);
      if (G.state === 'playing') {
        G.session.play += dt;
        G.saveTimer += dt;
        if (G.saveTimer > 3) { G.saveTimer = 0; persistSession(); }
      }
      if (G.state === 'countdown') tickCountdown(dt);
      if (G.goT > 0) { G.goT -= dt; if (G.goT <= 0) UI.Countdown.clear(); }
      if (G.wait) { G.wait.t -= dt; if (G.wait.t <= 0) { const fn = G.wait.fn; G.wait = null; fn(); } }
      const frozen = G.state === 'paused';
      G.renderer.draw(G.sim, frozen ? 0 : dt, { critter: critter(), paused: !live });
      if (!$('hud').hidden) UI.HUD.update(G.sim, G.session.play);
      if (G.state === 'intro') UI.Intro.draw(dt);
    }
  }

  /* ---------------- settings ---------------- */
  function syncToggles() {
    const s = G.save;
    document.querySelectorAll('[data-toggle]').forEach((b) => {
      const k = b.dataset.toggle;
      if (k === 'fullscreen') return;
      const on = k === 'sfx' ? s.sfx : k === 'music' ? s.music : s.reduced;
      b.setAttribute('aria-pressed', String(on));
      const use = b.querySelector('use');
      if (k === 'sfx') use.setAttribute('href', on ? '#i-sound' : '#i-mute');
      if (k === 'music') use.setAttribute('href', on ? '#i-music' : '#i-music-off');
      const label = { sfx: 'Sound effects', music: 'Music', motion: 'Reduce motion' }[k];
      if (b.classList.contains('icon-btn')) b.setAttribute('aria-label', label + (on ? ' on' : ' off'));
      const stEl = b.querySelector('.state');
      if (stEl) stEl.textContent = on ? 'On' : 'Off';
    });
    UI.HUD.sound(s.sfx);
    document.documentElement.classList.toggle('reduce-motion', s.reduced);
  }
  function toggle(kind) {
    const s = G.save;
    AU.init();
    if (kind === 'sfx') { s.sfx = !s.sfx; AU.setSfx(s.sfx); UI.toast(s.sfx ? 'Sound effects on' : 'Sound effects off', { icon: s.sfx ? 'i-sound' : 'i-mute', ms: 1400 }); }
    else if (kind === 'music') { s.music = !s.music; AU.setMusic(s.music); }
    else if (kind === 'motion') { s.reduced = !s.reduced; UI.reduced = s.reduced; G.renderer.reduced = s.reduced; G.renderer.seedAmbient(); }
    else if (kind === 'fullscreen') { toggleFullscreen(); return; }
    persist();
    syncToggles();
    AU.play('click');
  }
  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => UI.toast('Full screen is not available here', { ms: 1800 }));
      else UI.toast('Full screen is not available here', { ms: 1800 });
    } catch (e) { UI.toast('Full screen is not available here', { ms: 1800 }); }
  }

  function setTouch(on) {
    G.touch = on;
    document.documentElement.classList.toggle('is-touch', on);
    if (G.sim && (G.state === 'playing' || G.state === 'countdown')) $('touch').hidden = !on;
    checkOrientation();
  }

  function onResize() {
    G.renderer.resize(root.innerWidth, root.innerHeight);
    UI.Confetti.resize();
    checkOrientation();
  }

  /** A touch device whose shorter screen side is phone-sized (tablets play in any orientation). */
  function isPhone() {
    let coarse = G.touch;
    try { coarse = coarse || root.matchMedia('(pointer: coarse)').matches; } catch (e) { /* ignore */ }
    const sw = (root.screen && root.screen.width) || root.innerWidth;
    const sh = (root.screen && root.screen.height) || root.innerHeight;
    return coarse && Math.min(sw, sh) < 600;
  }

  /** Phones held upright get a "please rotate" screen; the game pauses and resumes once sideways. */
  function checkOrientation() {
    const block = isPhone() && root.innerHeight > root.innerWidth;
    if (block === G.rotateBlock) return;
    G.rotateBlock = block;
    $('scr-rotate').hidden = !block;
    if (block) {
      $('app').setAttribute('inert', '');
      if (G.state === 'playing' || G.state === 'countdown') { pause(); G.pausedByRotate = true; }
      UI.announce('Please rotate your phone to landscape to play.');
    } else {
      $('app').removeAttribute('inert');
      if (G.pausedByRotate && G.state === 'paused') resume();
      G.pausedByRotate = false;
    }
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    const on = (id, fn) => $(id).addEventListener('click', (e) => {
      if (UI.locked()) return;
      AU.init();
      AU.play('click');
      fn(e);
    });
    on('btn-start', () => { if (G.state === 'intro') beginCountdown(CD_TICK); });
    on('btn-pause', pause);
    on('btn-resume', resume);
    on('btn-restart', () => startStage(G.stage, false));
    on('btn-pause-menu', showMenu);
    on('btn-next', () => { if (G.stage + 1 < Z.STAGES.length) startStage(G.stage + 1, true); });
    on('btn-again', () => startStage(G.stage, false));
    on('btn-done-menu', showMenu);
    on('btn-retry', () => startStage(G.stage, false));
    on('btn-over-menu', showMenu);
    $('btn-sound-hud').addEventListener('click', () => toggle('sfx'));
    document.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => toggle(b.dataset.toggle)));
    $('scr-intro').addEventListener('click', (e) => {
      if (e.target === e.currentTarget && G.state === 'intro' && !UI.locked()) { AU.init(); beginCountdown(CD_TICK); }
    });

    UI.Menu.init({
      onCritter(i) {
        AU.init();
        if (i === G.save.critter) return;
        G.save.critter = i;
        persist();
        AU.play('select');
        renderMenu();
        if (G.demo) G.renderer.burst(G.demo.p.x, G.demo.p.y - 30, 18, { speed: 220, g: 0, life: 0.5, size: 8, col: ['#FFFFFF', critter().body], kind: 'puff' });
      },
      onStage(i) {
        AU.init();
        if (i === G.save.stage || i >= G.save.unlocked) return;
        G.save.stage = i;
        persist();
        AU.play('click');
        G.demo = new Z.Sim(i, { demo: true });
        G.renderer.setStage(i);
        renderMenu();
        const tile = document.querySelector('.stage-tile[data-i="' + i + '"]');
        if (tile) tile.focus({ preventScroll: true });
      },
      onLocked(i) {
        AU.init();
        AU.play('bump');
        UI.toast('Clear Stage ' + i + ' to unlock ' + Z.STAGES[i].name, { icon: 'i-lock', ms: 2200 });
      },
      onName(v) { G.save.name = v.slice(0, 14); persist(); },
      onSfx(name) { AU.init(); AU.play(name); },
      onPlay() {
        if (G.state !== 'menu') return;
        AU.init();
        AU.play('select');
        if (!G.save.name.trim()) {
          const names = ['Zippy', 'Biscuit', 'Pickle', 'Nova', 'Mochi', 'Pip', 'Comet', 'Noodle', 'Sprout', 'Pixel'];
          G.save.name = names[Math.floor(Math.random() * names.length)];
          $('inp-name').value = G.save.name;
        }
        G.save.name = G.save.name.trim();
        G.save.played = true;
        persist();
        startStage(G.save.stage, true);
      },
    });

    root.addEventListener('keydown', (e) => {
      const code = e.code;
      const typing = e.target && e.target.tagName === 'INPUT';
      if (code === 'KeyM' && !typing && !e.repeat && !e.metaKey && !e.ctrlKey) { toggle('sfx'); return; }
      if (typing) return;
      const isPause = code === 'Escape' || code === 'KeyP';
      switch (G.state) {
        case 'playing':
        case 'countdown':
          if (IN.isJumpKey(code) || IN.isDownKey(code)) { e.preventDefault(); if (!e.repeat) IN.keyDown(code); return; }
          if (isPause && !e.repeat) { e.preventDefault(); pause(); }
          return;
        case 'completing': case 'dying':
          if (IN.isJumpKey(code) || IN.isDownKey(code)) e.preventDefault();
          return;
        case 'paused':
          if (isPause && !e.repeat) { e.preventDefault(); if (!UI.locked()) resume(); }
          return;
        case 'intro':
          if ((code === 'Space' || code === 'Enter' || code === 'ArrowUp') && !e.repeat) { e.preventDefault(); if (!UI.locked()) { AU.init(); beginCountdown(CD_TICK); } }
          else if (code === 'Escape') { e.preventDefault(); showMenu(); }
          return;
        case 'menu':
          if (code === 'Enter' && !e.repeat && (!document.activeElement || document.activeElement === document.body)) { e.preventDefault(); $('btn-play').click(); }
          return;
        case 'complete': case 'gameover':
          if (UI.locked() && (code === 'Space' || code === 'Enter')) e.preventDefault();
          if (code === 'Escape' && !UI.locked()) { e.preventDefault(); showMenu(); }
          return;
      }
    }, { passive: false });
    root.addEventListener('keyup', (e) => IN.keyUp(e.code));

    const wake = () => AU.init();
    root.addEventListener('pointerdown', wake, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && !(root.Zoomies && root.Zoomies.noAutoPause)) { pause(); IN.releaseAll(); persistSession(); } });
    root.addEventListener('blur', () => { if (root.Zoomies && root.Zoomies.noAutoPause) return; pause(); IN.releaseAll(); });
    root.addEventListener('pagehide', persistSession);
    root.addEventListener('resize', onResize);
    root.addEventListener('orientationchange', () => setTimeout(onResize, 200));
  }

  function boot() {
    G.save = loadSave();
    G.session = loadSession();
    UI.reduced = G.save.reduced;
    AU.sfxOn = G.save.sfx;
    AU.musicOn = G.save.music;
    G.renderer = new Z.Renderer($('game'));
    G.renderer.reduced = G.save.reduced;
    UI.Confetti.init($('fx'));
    IN.onTouch = () => setTouch(true);
    try { if (root.matchMedia('(pointer: coarse)').matches) setTouch(true); } catch (e) { /* ignore */ }
    IN.bindSurface($('game'));
    IN.bindButton($('touch-jump'), 'jump');
    IN.bindButton($('touch-slide'), 'slide');
    wire();
    syncToggles();
    onResize();
    G.demo = new Z.Sim(G.save.stage, { demo: true });
    G.renderer.setStage(G.save.stage);
    const fonts = document.fonts && document.fonts.load
      ? Promise.race([Promise.all([document.fonts.load('32px "Lilita One"'), document.fonts.load('600 16px "Baloo 2"')]), new Promise((r) => setTimeout(r, 2500))])
      : Promise.resolve();
    fonts.catch(() => {}).then(() => setTimeout(showMenu, 250));
    requestAnimationFrame(frame);
  }

  /* Small hooks used for automated play-testing from the console. */
  root.Zoomies = {
    G,
    warp(frac) {
      const s = G.sim;
      if (!s || G.state !== 'playing') return 'start a stage first';
      s.p.x = P.START_X + (s.finishX - P.START_X) * frac;
      s.respawn();
      return Math.round(s.meters()) + ' m';
    },
    finish() { return this.warp((G.sim.finishX - 300 - P.START_X) / (G.sim.finishX - P.START_X)); },
    /** Advances the game by `sec` seconds in 60 Hz frames (for testing in throttled tabs). */
    advance(sec) { for (let t = 0; t < sec - 1e-9; t += 1 / 60) tick(Math.min(1 / 60, sec - t)); return G.state; },
    kill() { const s = G.sim; if (!s || G.state !== 'playing') return 'start a stage first'; s.p.invuln = 0; s.pw.shield = 0; s.hearts = 1; s.hurt(null); return 'ouch'; },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
