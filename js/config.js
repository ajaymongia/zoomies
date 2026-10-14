/* Zoomies! — tuning: physics, critters and the fifteen stages. */
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
    INVULN: 1.3,
    RESPAWN_INVULN: 1.8,
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
   * Stage scripts. `intro` runs first, in order, to show that stage's idea once before the mix.
   * `pool` weights random sections: name: weight, or [weight, minimum difficulty 0..1].
   * `stars`/`powers`/`hearts` are placed at fixed points (fraction of the stage).
   * Speed rises every stage; `breath` is free running (seconds) between sections, shrinking as
   * the stage goes on; `gapK` is gap width as a share of a full jump at the current speed.
   */
  Z.STAGES = [
    {
      id: 1, key: 'meadow', name: 'Sunny Meadow', length: 470, speed: [350, 400], seed: 4101,
      blurb: 'Warm-up laps through flowery hills. Hop the thorns, clear the gaps and keep your rhythm.',
      breath: [0.85, 0.6], gapK: [0.42, 0.6],
      intro: ['sign:jump', 'spikes:easy', 'stump', 'gap:easy', 'lucky'],
      pool: { spikes: 3, stump: 1.6, gap: 2.4, spikePair: [1.6, 0.15], platforms: 1, lucky: 0.6,
        stumpSpikes: [1.4, 0.3], spikeTriple: [1.1, 0.55], coins: 0.5 },
      stars: [[0.24, 'starHighJump'], [0.55, 'starPlatforms'], [0.8, 'starLucky']],
      powers: [[0.42, 'shield']],
      hearts: [],
      mech: { demo: 'jump', title: 'Jump, and hold for height', text: 'Tap, click or press Space to jump. Keep it held to leap higher.' },
    },
    {
      id: 2, key: 'candy', name: 'Candy Canyon', length: 510, speed: [372, 423], seed: 5207,
      blurb: 'Sticky-sweet cliffs with springy marshmallows, drifting wafers and gumballs that roll in pairs.',
      breath: [0.82, 0.58], gapK: [0.45, 0.62],
      intro: ['sign:spring', 'springGap', 'sign:moving', 'movingGap:easy', 'bouncy'],
      pool: { gemRun: 0.5, spikes: 1.6, stump: 0.8, gap: 2, spikePair: 1.2, platforms: 0.7, lucky: 0.5,
        springGap: 1.4, movingGap: [1.8, 0.1], roller: [1.8, 0.1], rollerPair: [1.1, 0.5], bouncy: 0.5,
        stumpSpikes: [1, 0.3], spikeTriple: [0.9, 0.45] },
      stars: [[0.3, 'starSpring'], [0.6, 'starMoving'], [0.84, 'starHighJump']],
      powers: [[0.36, 'magnet'], [0.7, 'shield']],
      hearts: [],
      mech: { demo: 'spring', title: 'Springs and moving platforms', text: 'Run onto a spring to bounce over big gaps. Time your hops onto platforms that drift.' },
    },
    {
      id: 3, key: 'jungle', name: 'Jungle Dash', length: 560, speed: [395, 446], seed: 6311,
      blurb: 'Dense, wild and full of critters. Duck under low branches and bop beetles from above.',
      breath: [0.79, 0.56], gapK: [0.5, 0.67],
      intro: ['sign:slide', 'gate:easy', 'sign:stomp', 'beetle', 'gap'],
      pool: { spikes: 1.4, gap: 1.6, gapWide: [1.4, 0.2], gate: 2, beetle: 1.8, frog: [1.4, 0.15], roller: 1,
        spikePlat: [1.3, 0.2], movingGap: [1, 0.25], gateSpikes: [1.8, 0.15], gatePair: [1.4, 0.3],
        beetleGap: [1.6, 0.25], spikeTriple: [0.8, 0.4], lucky: 0.4 },
      stars: [[0.3, 'starSpikePlat'], [0.56, 'starHighJump'], [0.82, 'starLucky']],
      powers: [[0.3, 'feather'], [0.66, 'shield']],
      hearts: [],
      mech: { demo: 'slide', title: 'Slide under, bop on top', text: 'Press Down or swipe down to slide under low branches. Land on beetles to bop them.' },
    },
    {
      id: 4, key: 'lava', name: 'Lava Rush', length: 610, speed: [418, 469], seed: 7411,
      blurb: 'Hot ground, falling boulders and geysers that blast on a beat. Things move fast down here.',
      breath: [0.77, 0.54], gapK: [0.52, 0.69],
      intro: ['sign:rock', 'rock', 'lavaPit', 'sign:geyser', 'geysers:easy'],
      pool: { lavaPit: 2, rock: 1.4, rockPair: [1.2, 0.3], geysers: 1.6, roller: 1.2, rollerPair: [0.8, 0.4],
        gate: 1.2, spikes: 1, gapWide: [1.4, 0.15], movingGap: [1, 0.2], spikePlat: [1, 0.25], beetle: 0.8,
        rockGeyser: [1.4, 0.2], gateSpikes: [1, 0.2], beetleGap: [1, 0.35] },
      stars: [[0.3, 'starGeyser'], [0.58, 'starMoving'], [0.85, 'starSpring']],
      powers: [[0.3, 'shield'], [0.62, 'boost']],
      hearts: [],
      mech: { demo: 'rock', title: 'Falling rocks and geysers', text: 'A red ! marks where a rock will land. Geysers bubble before they blast, so jump high or pass while they rest.' },
    },
    {
      id: 5, key: 'sky', name: 'Sky Adventure', length: 660, speed: [440, 492], seed: 8513, doubleJump: true,
      blurb: 'Cloud-hopping high above the world, with sky boots that let you jump twice. The finale crumbles.',
      breath: [0.74, 0.52], gapK: [0.85, 1.15],
      intro: ['sign:double', 'cloudHop:easy', 'bird:mid', 'gap'],
      pool: { cloudHop: 2.2, bird: 1.4, birdPair: [1.2, 0.2], movingGap: 1.4, springGap: 0.6, gate: 1,
        gateBird: [1, 0.3], spikes: 0.8, gap: 1.4, gapWide: [1.2, 0.3], birdGap: [1.4, 0.2], roller: [0.8, 0.3],
        spikeTriple: [0.8, 0.4] },
      stars: [[0.25, 'starDouble'], [0.55, 'starSpring']],
      powers: [[0.4, 'shield']],
      hearts: [0.62],
      outroAt: 0.8,
      outro: ['banner:Final challenge: crumbling clouds!', 'crumbleRun:star', 'bird:low', 'crumbleRun', 'springGap'],
      mech: { demo: 'double', title: 'Sky boots: double jump', text: 'Press jump again in mid-air for a second leap. You will need it between the clouds.' },
    },
    {
      id: 6, key: 'snow', name: 'Frosty Peaks', length: 710, speed: [462, 515], seed: 9617,
      blurb: 'Icy ridges where icicles drop from above and snowballs come rolling two at a time.',
      breath: [0.71, 0.5], gapK: [0.54, 0.7],
      intro: ['sign:rock', 'rock', 'rollerPair'],
      pool: { rock: 1.4, rockPair: [1.4, 0.2], roller: 1.4, rollerPair: [1.2, 0.3], spikes: 1.2, spikeTriple: [1, 0.3],
        gap: 1.4, gapWide: [1.4, 0.2], gate: 1.2, gateSpikes: [1.2, 0.25], spikePlat: [1, 0.2], movingGap: [1, 0.3],
        beetle: 1, platforms: 0.4 },
      stars: [[0.3, 'starHighJump'], [0.6, 'starSpikePlat'], [0.85, 'starLucky']],
      powers: [[0.48, 'shield']],
      hearts: [],
      mech: { demo: 'rock', title: 'Icicles and snowballs', text: 'Icicles drop where the red ! appears, and snowballs roll in pairs. Read ahead and keep your rhythm.' },
    },
    {
      id: 7, key: 'desert', name: 'Desert Dunes', length: 760, speed: [485, 538], seed: 10723,
      blurb: 'Scorching dunes with sand spouts, cactus thorns and tumbleweeds bouncing your way.',
      breath: [0.68, 0.49], gapK: [0.56, 0.71],
      intro: ['sign:geyser', 'geysers:easy', 'roller', 'spikeTriple'],
      pool: { geysers: 1.8, rockGeyser: [1.2, 0.2], roller: 1.6, rollerPair: [1.2, 0.25], spikes: 1.4,
        spikeTriple: [1.2, 0.2], stumpSpikes: 1, gapWide: 1.4, gap: 1, beetle: 1.2, beetleGap: [1.2, 0.3],
        springGap: 0.8, movingGap: [1, 0.3], frog: [0.8, 0.3] },
      stars: [[0.3, 'starGeyser'], [0.6, 'starSpring'], [0.85, 'starHighJump']],
      powers: [[0.52, 'boost']],
      hearts: [],
      mech: { demo: 'jump', title: 'Sand spouts and tumbleweeds', text: 'Sand geysers burst on a beat and tumbleweeds bounce your way. Jump high and time it well.' },
    },
    {
      id: 8, key: 'cave', name: 'Crystal Caverns', length: 820, speed: [508, 561], seed: 11827,
      blurb: 'Glittering tunnels with low ceilings, falling crystals and moths fluttering in the dark.',
      breath: [0.65, 0.47], gapK: [0.58, 0.72],
      intro: ['sign:slide', 'gatePair', 'sign:rock', 'rock'],
      pool: { gate: 1.8, gatePair: 1.4, gateSpikes: 1.6, gateBird: [1.2, 0.3], rock: 1.2, rockPair: [1.2, 0.25],
        rockGeyser: [1, 0.3], spikes: 1.2, spikePlat: [1.2, 0.2], beetle: 1, beetleGap: [1, 0.3], gapWide: 1.2,
        lucky: 0.5 },
      stars: [[0.3, 'starSpikePlat'], [0.6, 'starLucky'], [0.85, 'starGeyser']],
      powers: [[0.5, 'shield']],
      hearts: [],
      mech: { demo: 'slide', title: 'Low ceilings, falling crystals', text: 'Slide through tight tunnels, then be ready to jump straight after. Crystals fall where the red ! glows.' },
    },
    {
      id: 9, key: 'autumn', name: 'Autumn Woods', length: 870, speed: [530, 584], seed: 12931,
      blurb: 'Golden forest paths packed with beetles, frogs and birds that all want to get in your way.',
      breath: [0.63, 0.45], gapK: [0.6, 0.72],
      intro: ['sign:stomp', 'beetle', 'birdPair'],
      pool: { beetle: 1.8, beetleGap: 1.6, frog: 1.4, bird: 1.4, birdPair: 1.4, gateBird: [1.2, 0.2], roller: 1.2,
        rollerPair: [1, 0.3], gap: 1, gapWide: [1.4, 0.2], spikes: 1, spikeTriple: [1, 0.3], gateSpikes: [1, 0.3],
        platforms: 0.5, stump: 0.6 },
      stars: [[0.3, 'starPlatforms'], [0.6, 'starHighJump'], [0.85, 'starLucky']],
      powers: [[0.36, 'feather'], [0.72, 'shield']],
      hearts: [0.55],
      mech: { demo: 'stomp', title: 'Critter stampede', text: 'Beetles, frogs and birds come in packs. Bop them, slide under them or hop over them.' },
    },
    {
      id: 10, key: 'beach', name: 'Sunset Beach', length: 930, speed: [552, 607], seed: 14033,
      blurb: 'Golden sand and open sea. Bounce across the water, ride the rafts and dodge the crabs.',
      breath: [0.6, 0.43], gapK: [0.62, 0.73],
      intro: ['sign:spring', 'springGap', 'sign:moving', 'movingGap'],
      pool: { springGap: 1.6, movingGap: 2, bouncy: 0.8, beetle: 1.2, beetleGap: 1.2, roller: 1.2,
        rollerPair: [1, 0.3], gap: 1, gapWide: 1.6, spikePair: 1, spikeTriple: [1, 0.3], spikePlat: [1.2, 0.2],
        lucky: 0.4 },
      stars: [[0.3, 'starSpring'], [0.6, 'starMoving'], [0.85, 'starSpikePlat']],
      powers: [[0.3, 'magnet'], [0.62, 'shield']],
      hearts: [],
      mech: { demo: 'spring', title: 'Springs over the sea', text: 'Bounce over open water and time your landings on drifting rafts. Crabs scuttle along the sand.' },
    },
    {
      id: 11, key: 'city', name: 'Neon City', length: 990, speed: [575, 630], seed: 15137,
      blurb: 'Rush hour after dark: barriers, drones, rolling barrels and steam vents under neon lights.',
      breath: [0.57, 0.41], gapK: [0.63, 0.74],
      intro: ['sign:slide', 'gateSpikes', 'bird:mid'],
      pool: { gate: 1.4, gatePair: 1.4, gateSpikes: 1.6, gateBird: 1.6, bird: 1.2, birdPair: 1.4, roller: 1.2,
        rollerPair: 1, geysers: 1.2, rockGeyser: [1, 0.3], spikes: 1, spikeTriple: 1, gapWide: 1.4, movingGap: 1 },
      stars: [[0.3, 'starHighJump'], [0.6, 'starMoving'], [0.85, 'starGeyser']],
      powers: [[0.56, 'boost']],
      hearts: [],
      mech: { demo: 'slide', title: 'Rush hour', text: 'Duck under barriers and drones, then jump the barrels rolling in right after. Steam vents blast on a beat.' },
    },
    {
      id: 12, key: 'spooky', name: 'Spooky Hollow', length: 1060, speed: [598, 653], seed: 16241,
      blurb: 'A moonlit hollow where bridges crumble, pumpkins roll and wisps leap out of the pits.',
      breath: [0.54, 0.39], gapK: [0.64, 0.74],
      intro: ['sign:jump', 'crumbleRun', 'lavaPit'],
      pool: { crumbleRun: [1.4, 0.15], lavaPit: 1.6, bird: 1.2, birdPair: 1, roller: 1.4, rollerPair: 1, frog: 1,
        beetle: 1, beetleGap: 1.2, gate: 1, gateSpikes: 1.2, spikes: 1, gapWide: 1.4, spikeTriple: 1 },
      stars: [[0.3, 'starHighJump'], [0.6, 'starLucky'], [0.85, 'starSpikePlat']],
      powers: [[0.5, 'shield']],
      hearts: [0.62],
      mech: { demo: 'jump', title: 'Crumbling bridges', text: 'Bridges crumble a moment after you land, so keep moving. Pumpkins roll, bats swoop and wisps leap from the pits.' },
    },
    {
      id: 13, key: 'storm', name: 'Storm Front', length: 1120, speed: [620, 676], seed: 17347, doubleJump: true,
      blurb: 'Sky boots are back for a dash through thunderclouds, gusts and diving birds.',
      breath: [0.51, 0.37], gapK: [0.9, 1.2],
      intro: ['sign:double', 'cloudHop', 'birdPair'],
      pool: { cloudHop: 2, crumbleRun: [1.4, 0.2], bird: 1.2, birdPair: 1.4, birdGap: 1.4, gate: 1, gateBird: 1.2,
        springGap: 0.8, movingGap: 1.2, gapWide: 1.6, gap: 1, spikeTriple: 0.8, roller: 0.8 },
      stars: [[0.3, 'starDouble'], [0.6, 'starSpring'], [0.85, 'starMoving']],
      powers: [[0.5, 'shield']],
      hearts: [],
      mech: { demo: 'double', title: 'Into the storm', text: 'Double jump across storm clouds while birds dive through the wind. Bridges crumble behind you.' },
    },
    {
      id: 14, key: 'space', name: 'Starlight Station', length: 1190, speed: [642, 699], seed: 18451, doubleJump: true,
      blurb: 'A dash across the moon under a meteor shower, hopping between drifting asteroids.',
      breath: [0.49, 0.35], gapK: [0.92, 1.22],
      intro: ['sign:rock', 'rockPair', 'cloudHop'],
      pool: { cloudHop: 1.8, movingGap: 1.6, rock: 1.2, rockPair: 1.4, rockGeyser: 1.2, geysers: 1.2, roller: 1.2,
        rollerPair: 1.2, gapWide: 1.6, birdGap: 1, spikeTriple: 1, gateSpikes: 1, crumbleRun: [1, 0.3] },
      stars: [[0.3, 'starDouble'], [0.6, 'starGeyser'], [0.85, 'starMoving']],
      powers: [[0.42, 'magnet']],
      hearts: [],
      mech: { demo: 'rock', title: 'Meteor shower', text: 'Meteors crash where the red ! shines. Double jump between drifting asteroids.' },
    },
    {
      id: 15, key: 'castle', name: 'Rainbow Castle', length: 1260, speed: [665, 722], seed: 19559, doubleJump: true,
      blurb: 'The final climb. Everything you have learned, at top speed, all the way to the castle gates.',
      breath: [0.46, 0.33], gapK: [0.95, 1.25],
      intro: ['sign:double', 'birdGap', 'gateBird'],
      pool: { cloudHop: 1.4, crumbleRun: 1.2, movingGap: 1.2, springGap: 0.8, bird: 1, birdPair: 1.2, birdGap: 1.2,
        gate: 0.8, gateBird: 1.2, gateSpikes: 1, gatePair: 1, rock: 1, rockPair: 1, rockGeyser: 1, geysers: 1,
        roller: 1, rollerPair: 1, beetleGap: 1, lavaPit: 1, spikeTriple: 1, gapWide: 1.4 },
      stars: [[0.3, 'starDouble'], [0.6, 'starGeyser']],
      powers: [[0.6, 'shield']],
      hearts: [0.5],
      outroAt: 0.85,
      outro: ['banner:Final gauntlet: reach the castle!', 'crumbleRun:star', 'birdPair', 'crumbleRun', 'springGap'],
      mech: { demo: 'double', title: 'The final climb', text: 'Everything you have learned, at top speed. Reach the castle gates to become a Zoomies legend.' },
    },
  ];

  Z.POWERS = {
    shield: { name: 'Shield', desc: 'Blocks one hit', color: '#3D8BFF' },
    magnet: { name: 'Magnet', desc: 'Pulls in nearby coins', color: '#FF4D6D' },
    feather: { name: 'Feather', desc: 'Double jump unlocked', color: '#A879FF' },
    boost: { name: 'Turbo', desc: 'Super speed, nothing can hurt you', color: '#FFA51F' },
  };
})(typeof window !== 'undefined' ? window : globalThis);
