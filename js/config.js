/* Zoomies! — tuning: physics, critters and the five stages. */
(function (root) {
  'use strict';
  const Z = root.Z, U = Z.U;

  /* World units: the visible world is 600 units tall; 40 units = 1 metre. */
  const P = (Z.PHYS = {
    GY: 470,            // ground surface y
    VIEW_H: 600,
    MIN_VIEW_W: 700,
    M: 40,
    START_X: 200,

    G_UP: 2300,         // gravity while rising
    G_DOWN: 2900,       // gravity while falling (snappier landings)
    JUMP_V: 880,
    JUMP_CUT: 430,      // releasing jump early caps upward speed here
    MIN_HOLD: 0.08,     // even a tiny tap counts as this much hold
    DJUMP_V: 800,
    MAX_FALL: 1500,
    FAST_FALL: 1100,
    COYOTE: 0.1,        // grace period after running off a ledge
    BUFFER: 0.14,       // a jump pressed just before landing still fires

    SPRING_V: 1250,
    BOUNCY_V: 1080,
    STOMP_V: 640,
    STOMP_V_HELD: 860,

    PW: 34, PH: 54, PH_SLIDE: 26,   // player collision box
    FOOT: 14,           // feet count as supported this far either side of centre
    STEP: 16,           // auto step-up onto low blocks

    SLIDE_MIN: 0.32,
    SLIDE_SWIPE: 0.55,
    INVULN: 1.6,
    RESPAWN_INVULN: 2.2,
    HEARTS: 3,

    BOOST: 1.55,
    MAGNET_R: 250,
    ACT: 1300,          // moving hazards wake up at this distance
    POWER_DUR: { shield: 15, magnet: 10, feather: 12, boost: 4.5 },
  });

  Z.speedAt = (st, prog) => U.lerp(st.speed[0], st.speed[1], U.clamp(prog, 0, 1));

  /**
   * Simulates a jump with the exact physics the game uses.
   * holdT: seconds jump is held (null = cannot be cut, e.g. springs).
   * Returns points {t, x, y} where y is relative height (negative = up).
   */
  Z.jumpPath = function (speed, holdT, v0, y0) {
    const dt = 1 / 120;
    v0 = v0 || P.JUMP_V;
    let x = 0, y = y0 || 0, vy = -v0, t = 0, cutOK = holdT != null;
    const pts = [];
    for (let i = 0; i < 2000; i++) {
      if (cutOK && t >= P.MIN_HOLD && t >= holdT && vy < -P.JUMP_CUT) { vy = -P.JUMP_CUT; cutOK = false; }
      if (vy >= 0) cutOK = false;
      vy = Math.min(vy + (vy < 0 ? P.G_UP : P.G_DOWN) * dt, P.MAX_FALL);
      x += speed * dt; y += vy * dt; t += dt;
      if (y >= 0 && vy > 0) { pts.push({ t, x, y: 0 }); break; }
      pts.push({ t, x, y });
    }
    return pts;
  };
  (function () {
    const full = Z.jumpPath(1, 10);
    Z.JUMP_T = full[full.length - 1].t;  // airtime of a full jump on flat ground
  })();

  Z.CRITTERS = [
    { id: 'fox', name: 'Fox', tagline: 'Clever and quick on its paws',
      body: '#FF6F3C', light: '#FFF4E8', dark: '#6E2A14', legs: '#7A3218', paw: '#4A1D0E',
      inner: '#FFC4A3', nose: '#2E1626', ear: 'fox', tail: 'fox', trail: '#FFA05C' },
    { id: 'cat', name: 'Cat', tagline: 'Curious, nimble, always lands on its feet',
      body: '#8F8BFF', light: '#F6F4FF', dark: '#38337F', paw: '#FFFFFF',
      inner: '#FFB0CF', nose: '#FF6F9E', ear: 'cat', tail: 'cat', whiskers: true, trail: '#B8B5FF' },
    { id: 'panda', name: 'Panda', tagline: 'Chill vibes, unstoppable rolls',
      body: '#FCFBFF', light: '#FFFFFF', dark: '#2C2838', legs: '#2C2838', paw: '#2C2838',
      inner: '#2C2838', nose: '#2C2838', ear: 'panda', tail: 'panda', panda: true, trail: '#CFC9FF' },
    { id: 'bunny', name: 'Bunny', tagline: 'Bouncy, brave and a little dramatic',
      body: '#FFB0D2', light: '#FFF6FA', dark: '#8E2F5E', paw: '#FFF6FA',
      inner: '#FF7DB2', nose: '#E8457E', ear: 'bunny', tail: 'bunny', teeth: true, trail: '#FFC6E0' },
    { id: 'tiger', name: 'Tiger', tagline: 'Bold stripes, even bolder leaps',
      body: '#FFAA2B', light: '#FFF8EA', dark: '#3A2313', paw: '#FFF8EA',
      inner: '#FFE2B5', nose: '#3A2313', ear: 'tiger', tail: 'tiger', stripes: true, trail: '#FFC85C' },
    { id: 'dino', name: 'Dino', tagline: 'Tiny roar, enormous heart',
      body: '#34D399', light: '#FFF2B0', dark: '#0F5E43', paw: '#1F9C6E',
      inner: '#FF9D4D', nose: '#0F5E43', ear: 'none', tail: 'dino', spikes: '#FF9D4D', trail: '#7CF0C0' },
  ];

  /*
   * Stage scripts. `intro` runs first, in order, to teach that stage's new idea gently.
   * `pool` weights random sections: name: weight, or [weight, minimum difficulty 0..1].
   * `stars`/`powers`/`hearts` are placed at fixed points (fraction of the stage).
   */
  Z.STAGES = [
    {
      id: 1, key: 'meadow', name: 'Sunny Meadow', length: 480, speed: [330, 390], seed: 4101,
      blurb: 'Warm-up laps through flowery hills. Hop the thorns, clear little gaps and scoop up coins.',
      breath: [1.0, 0.7], gapK: [0.32, 0.5],
      intro: ['sign:jump', 'spikes:easy', 'coins', 'stump', 'gap:easy', 'lucky'],
      pool: { coins: 1.6, spikes: 3, stump: 2, gap: 2.2, spikePair: [1.2, 0.3], platforms: 1.4, lucky: 1, stumpSpikes: [1, 0.5] },
      stars: [[0.24, 'starHighJump'], [0.55, 'starPlatforms'], [0.8, 'starLucky']],
      powers: [[0.38, 'shield'], [0.68, 'magnet']],
      hearts: [],
      mech: { demo: 'jump', title: 'Jump, and hold for height', text: 'Tap, click or press Space to jump. Keep it held to leap higher.' },
    },
    {
      id: 2, key: 'candy', name: 'Candy Canyon', length: 540, speed: [360, 425], seed: 5207,
      blurb: 'Sticky-sweet cliffs with springy marshmallows and drifting wafer platforms. Lots of loot here.',
      breath: [0.9, 0.6], gapK: [0.38, 0.56],
      intro: ['sign:spring', 'springGap', 'coins', 'sign:moving', 'movingGap:easy', 'bouncy'],
      pool: { coins: 1.2, gemRun: 1.2, spikes: 2, stump: 1.2, gap: 2, spikePair: 1, platforms: 1.2, lucky: 1,
        springGap: 1.4, movingGap: [1.6, 0.15], roller: [1.6, 0.2], bouncy: 0.8 },
      stars: [[0.3, 'starSpring'], [0.6, 'starMoving'], [0.84, 'starHighJump']],
      powers: [[0.34, 'magnet'], [0.64, 'shield']],
      hearts: [],
      mech: { demo: 'spring', title: 'Springs and moving platforms', text: 'Run onto a spring to bounce over big gaps. Time your hops onto platforms that drift.' },
    },
    {
      id: 3, key: 'jungle', name: 'Jungle Dash', length: 600, speed: [390, 460], seed: 6311,
      blurb: 'Dense, wild and full of critters. Duck under low branches and bop beetles from above.',
      breath: [0.8, 0.5], gapK: [0.45, 0.64],
      intro: ['sign:slide', 'gate:easy', 'coins', 'sign:stomp', 'beetle', 'gap'],
      pool: { coins: 0.6, spikes: 1.4, gap: 1.6, gapWide: [1.2, 0.3], gate: 2.4, beetle: 2, frog: [1.4, 0.2],
        roller: 1, spikePlat: [1.3, 0.25], platforms: 0.6, movingGap: [1, 0.3], lucky: 0.5, stump: 0.6,
        gateSpikes: [1.6, 0.2], gatePair: [1.2, 0.35], beetleGap: [1.4, 0.3] },
      stars: [[0.3, 'starSpikePlat'], [0.56, 'starHighJump'], [0.82, 'starLucky']],
      powers: [[0.27, 'feather'], [0.6, 'shield'], [0.75, 'boost']],
      hearts: [0.48],
      mech: { demo: 'slide', title: 'Slide under, bop on top', text: 'Press Down or swipe down to slide under low branches. Land on beetles to bop them.' },
    },
    {
      id: 4, key: 'lava', name: 'Lava Rush', length: 640, speed: [440, 515], seed: 7411,
      blurb: 'Hot ground, falling boulders and geysers that blast on a beat. Things move fast down here.',
      breath: [0.72, 0.45], gapK: [0.48, 0.66],
      intro: ['sign:rock', 'rock', 'coins', 'lavaPit', 'sign:geyser', 'geysers:easy'],
      pool: { lavaPit: 2, rock: 1.6, geysers: 1.6, roller: 1.2, gate: 1.2, spikes: 1.1, gapWide: [1.2, 0.2],
        movingGap: [1, 0.2], spikePlat: [1, 0.3], beetle: 0.8, stump: 0.5, coins: 0.4,
        rockGeyser: [1.4, 0.25], gateSpikes: [1.1, 0.2], beetleGap: [0.9, 0.4] },
      stars: [[0.3, 'starGeyser'], [0.58, 'starMoving'], [0.85, 'starSpring']],
      powers: [[0.22, 'shield'], [0.5, 'boost'], [0.72, 'feather']],
      hearts: [0.44],
      mech: { demo: 'rock', title: 'Falling rocks and geysers', text: 'A red ! marks where a rock will land. Geysers bubble before they blast, so jump high or pass while they rest.' },
    },
    {
      id: 5, key: 'sky', name: 'Sky Adventure', length: 640, speed: [420, 495], seed: 8513, doubleJump: true,
      blurb: 'Cloud-hopping high above the world, with sky boots that let you jump twice. The finale crumbles.',
      breath: [0.75, 0.5], gapK: [0.75, 1.05],
      intro: ['sign:double', 'cloudHop:easy', 'coins', 'bird:mid', 'gap'],
      pool: { cloudHop: 2.2, bird: 1.6, birdPair: [1.1, 0.3], movingGap: 1.4, springGap: 0.8, gate: 1, spikes: 1,
        gap: 1.5, platforms: 0.6, lucky: 0.5, roller: [0.8, 0.3], coins: 0.5, birdGap: [1.4, 0.2], gateSpikes: [0.8, 0.3] },
      stars: [[0.25, 'starDouble'], [0.55, 'starSpring']],
      powers: [[0.32, 'shield'], [0.62, 'magnet']],
      hearts: [0.48],
      outroAt: 0.78,
      outro: ['banner:Final challenge: crumbling clouds!', 'crumbleRun:star', 'bird:low', 'crumbleRun', 'springGap'],
      mech: { demo: 'double', title: 'Sky boots: double jump', text: 'Press jump again in mid-air for a second leap. You will need it between the clouds.' },
    },
  ];

  Z.POWERS = {
    shield: { name: 'Shield', desc: 'Blocks one hit', color: '#3D8BFF' },
    magnet: { name: 'Magnet', desc: 'Pulls in nearby coins', color: '#FF4D6D' },
    feather: { name: 'Feather', desc: 'Double jump unlocked', color: '#A879FF' },
    boost: { name: 'Turbo', desc: 'Super speed, nothing can hurt you', color: '#FFA51F' },
  };
})(typeof window !== 'undefined' ? window : globalThis);
