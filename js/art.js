/* Zoomies! — all artwork, drawn procedurally on canvas (no image files, works offline). */
(function (root) {
  'use strict';
  const Z = root.Z, U = Z.U, GY = Z.PHYS.GY;
  const A = (Z.Art = {});
  const TAU = Math.PI * 2;
  const FONT = '"Lilita One", "Baloo 2", ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
  A.FONT = FONT;

  /* ---------------- primitives ---------------- */
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function ell(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function circ(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function fs(ctx, fill, stroke, lw) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 2.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function line(ctx, x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function starPath(ctx, x, y, r, ir, n, rot) {
    n = n || 5; ir = ir || r * 0.5; rot = rot || -Math.PI / 2;
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const rad = i % 2 ? ir : r, a = rot + (i * Math.PI) / n;
      const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  function heartPath(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.25, y + s * 0.05, x - s * 0.95, y - s * 0.95, x, y - s * 0.38);
    ctx.bezierCurveTo(x + s * 0.95, y - s * 0.95, x + s * 1.25, y + s * 0.05, x, y + s * 0.9);
    ctx.closePath();
  }
  function paw(ctx, x, y, s) {
    ell(ctx, x, y + s * 0.35, s * 0.62, s * 0.5); ctx.fill();
    circ(ctx, x - s * 0.62, y - s * 0.22, s * 0.24); ctx.fill();
    circ(ctx, x - s * 0.22, y - s * 0.6, s * 0.25); ctx.fill();
    circ(ctx, x + s * 0.22, y - s * 0.6, s * 0.25); ctx.fill();
    circ(ctx, x + s * 0.62, y - s * 0.22, s * 0.24); ctx.fill();
  }
  function cloudPuff(ctx, x, y, s) {
    ctx.beginPath();
    ctx.arc(x - 26 * s, y, 18 * s, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(x - 8 * s, y - 16 * s, 22 * s, Math.PI, Math.PI * 1.9);
    ctx.arc(x + 16 * s, y - 10 * s, 18 * s, Math.PI * 1.2, Math.PI * 0.1);
    ctx.arc(x + 30 * s, y + 2 * s, 14 * s, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath();
  }
  A.rr = rr; A.ell = ell; A.circ = circ; A.heartPath = heartPath; A.starPath = starPath; A.paw = paw;

  /* ---------------- themes ----------------
     Each world picks art styles (scene, ground, platforms, blocks, rollers, gates) and colours.
     Anything not set falls back to BASE. */
  const BASE = {
    scene: 'meadow', groundStyle: 'grass', abyss: 'pit', block: 'stump', plat: 'turf', roller: 'log', gate: 'canopy',
    flowers: ['#FF6F91', '#FFD25A', '#FFFFFF', '#B78CFF'], treeDots: '#FF6F91',
    turf: ['#71D65C', '#3A8F3A', '#3FA64B', '#B98049', '#85552E'],   // top, top outline, tufts, body light, body dark
    slab: ['#5E4869', '#1E1426', '#FF8A3D'],                          // fill, outline, glow
    cloudPlat: ['#FFFFFF', '#D5DFFF'],
    stoneBlock: ['#8D9C8E', '#3E4A3F', '#4DC456'],
    crate: ['#C98E55', '#6B4423', '#E8B878'],
    crack: '#FF8A3D', crackGround: null, craters: false,
    snowball: ['#FFFFFF', '#6F8BD8', '#DDE6FF'],
    barrel: ['#FF3DCB', '#4A0A3A', '#22F2FF'],
    canopy: ['#0F4D33', '#1F7A4A', '#2E9F55'],
    gateCol: ['#2A1C33', '#4E3A5C', '#120A18', '#FF8A3D'],            // top, bottom, outline, crack
    beetle: ['#7B5CFF', '#2E1B7A', '#C2B3FF'],
    bird: ['#FF7A9A', '#FF5C86', '#FFE1EA', '#FF9EC0', '#9E2457'],    // body, wing, belly, tail, outline
    rock: ['#6E5A7C', '#1E1426', '#FF8A3D'],
    geyser: ['rgba(255,240,140,.95)', '#FF9A2E', '#FF4A1F', 'rgba(255,255,220,.75)'],
    vent: ['#3A2A47', '#120A18', '#FF6A2A', '#FFD23F'],
    fire: ['#FFB13D', '#FFF0A0', '#B33A00', 'rgba(255,140,40,.75)', '#5A1400'],
    dust: '#E8D2B0', ffCol: '255,240,140', moveArrow: 'rgba(255,255,255,.9)',
    sunSize: 44, sunGlow: 140,
  };
  const T = (key, o) => Object.assign({ key }, BASE, o);

  A.THEMES = {
    meadow: T('meadow', { sky: ['#3DB8FF', '#8FDBFF', '#FFF1C4'], sun: '#FFE15C',
      far: ['#86B9E8', '#B5D9F2'], hillA: '#86DB72', hillB: '#55C25F', tree: '#2E9F55', treeHi: '#4FC46D', trunk: '#8A5A3B',
      ground: ['#B0773F', '#7A4A27'], top: '#71D65C', topDk: '#3FA64B', pit: ['#3B2A5C', '#160E29'], stone: '#C8955F',
      spike: '#B266FF', spikeDk: '#5B2A99', spikeBase: '#3E8F3A', ambient: 'pollen' }),
    candy: T('candy', { sky: ['#FF86C8', '#FFB5DC', '#FFE6C7'], sun: '#FFF4A8',
      far: ['#BE95FF', '#DCC4FF'], hillA: '#FF8CC6', hillB: '#FF66AE', tree: '#FF4FA0', treeHi: '#FFFFFF', trunk: '#FFFFFF',
      ground: ['#86503D', '#5A3125'], top: '#FFC2E3', topDk: '#FF8DC4', pit: ['#4E1C44', '#22081E'], stone: '#A8664E',
      spike: '#6FE3FF', spikeDk: '#1C8FB8', spikeBase: '#FF8DC4', ambient: 'sprinkles',
      scene: 'candy', groundStyle: 'frosting', block: 'cake', plat: 'wafer', roller: 'gumball', gate: 'rock',
      gateCol: ['#5A3125', '#86503D', '#2A140C', '#FFC2E3'], dust: '#FFD6EC' }),
    jungle: T('jungle', { sky: ['#14A89C', '#6FDAB4', '#E2FFD0'], sun: '#FFF6B0',
      far: ['#2B8C7E', '#55AE98'], hillA: '#1F8257', hillB: '#166443', tree: '#0F5233', treeHi: '#2E8C55', trunk: '#6B4423',
      ground: ['#62402A', '#3B2416'], top: '#4DC456', topDk: '#2B8A3A', pit: ['#123628', '#05130D'], stone: '#7E5A3E',
      spike: '#E7C79A', spikeDk: '#8C5B2C', spikeBase: '#5B3A22', ambient: 'fireflies',
      scene: 'jungle', flowers: ['#FF5C8A'], block: 'stone', plat: 'log', roller: 'coconut' }),
    lava: T('lava', { sky: ['#24092F', '#6E1B4A', '#FF7A3D'], sun: '#FF9A4D',
      far: ['#3A1442', '#5A2050'], hillA: '#4A193C', hillB: '#33112C', tree: '#24101F', treeHi: '#FF7A3D', trunk: '#24101F',
      ground: ['#44314F', '#211628'], top: '#5E4569', topDk: '#FF8A3D', pit: ['#FF5A1F', '#FFB13D'], stone: '#2E2036',
      spike: '#FF5E3A', spikeDk: '#4A0F1E', spikeBase: '#2A1D33', ambient: 'embers',
      scene: 'lava', groundStyle: 'lava', abyss: 'lava', block: 'basalt', plat: 'slab', roller: 'boulder', gate: 'rock',
      crackGround: '#FF8A3D', beetle: ['#FF5A3D', '#7A1A0A', '#FFC93C'], dust: '#8C6A8F', sunSize: 64, sunGlow: 220 }),
    sky: T('sky', { sky: ['#4D7DFF', '#93BDFF', '#FFD6F0'], sun: '#FFF2A8',
      far: ['#C9D7FF', '#E6ECFF'], hillA: '#FFFFFF', hillB: '#EEF2FF', tree: '#79D98B', treeHi: '#B8F0C2', trunk: '#A98BDB',
      ground: ['#FFFFFF', '#D5DFFF'], top: '#FFFFFF', topDk: '#C3D0FF', pit: ['#7EA6FF', '#4A6FE0'], stone: '#E2E8FF',
      spike: '#6CCBFF', spikeDk: '#1F5FA8', spikeBase: '#B9CCFF', ambient: 'sparkles',
      scene: 'sky', groundStyle: 'cloud', abyss: 'clouds', block: 'gold', plat: 'cloud', roller: 'snowball', gate: 'storm',
      rainbow: true, islands: true, dust: '#FFFFFF', moveArrow: 'rgba(90,110,200,.8)' }),
    snow: T('snow', { sky: ['#6FB8EE', '#B8E2FF', '#F2FAFF'], sun: '#FFF6D6',
      far: ['#8FA9D6', '#C9DAF5'], hillA: '#EAF4FF', hillB: '#D4E6FA', tree: '#2E7D63', treeHi: '#FFFFFF', trunk: '#6B4A2E',
      ground: ['#8FA6CC', '#5A6F99'], top: '#FFFFFF', topDk: '#AFC8EA', pit: ['#22305A', '#0D1428'], stone: '#B5C6E3',
      spike: '#8FD8FF', spikeDk: '#1F5FA8', spikeBase: '#DDEBFF', ambient: 'snow',
      scene: 'snow', groundStyle: 'snow', block: 'ice', roller: 'snowball', gate: 'rock',
      turf: ['#FFFFFF', '#9DB9E0', '#DDEBFF', '#9FB6D8', '#6B83AD'], snowball: ['#FFFFFF', '#5A7FC0', '#DDE9FF'],
      gateCol: ['#7F9CCF', '#C3D6F2', '#3A4E7A', '#FFFFFF'], rock: ['#D6ECFF', '#4A6FA8', '#FFFFFF'],
      beetle: ['#3D8BFF', '#123C99', '#BDE0FF'], dust: '#FFFFFF' }),
    desert: T('desert', { sky: ['#FF8A5C', '#FFC07A', '#FFE9B0'], sun: '#FFF4C2',
      far: ['#D9774A', '#EFA06A'], hillA: '#F2BE76', hillB: '#E3A45C', tree: '#43A35A', treeHi: '#79CC7E', trunk: '#43A35A',
      ground: ['#E6AF68', '#BF7E45'], top: '#F8D493', topDk: '#D39C55', pit: ['#5A2E1E', '#22100A'], stone: '#C98E55',
      spike: '#5CC86A', spikeDk: '#1F6B30', spikeBase: '#D39C55', ambient: 'dust',
      scene: 'desert', groundStyle: 'sand', block: 'stone', stoneBlock: ['#E2B47A', '#8A5A30', null], roller: 'tumbleweed', gate: 'rock',
      turf: ['#F8D493', '#C48A4A', '#E3B26A', '#D99B5C', '#B07A45'],
      gateCol: ['#9C5232', '#D98552', '#4A2414', null], rock: ['#D9A35A', '#7A4A28', '#FFE0A0'],
      geyser: ['rgba(255,244,214,.95)', '#F2C27A', '#C98E55', 'rgba(255,250,235,.7)'], vent: ['#B07A45', '#5A2E1E', '#8A5A30', '#F8D493'],
      beetle: ['#2FB5A8', '#0E5A54', '#A8F0E6'], dust: '#F7D9A8', sunSize: 58, sunGlow: 200 }),
    cave: T('cave', { sky: ['#140B29', '#2A1850', '#45286E'], sun: '#B98CFF', noSun: true,
      far: ['#22163F', '#33225A'], hillA: '#2A1C4A', hillB: '#1F1538', tree: '#7CF0FF', treeHi: '#E0B0FF', trunk: '#4E3D6E',
      ground: ['#3A2D52', '#1A1230'], top: '#4E3D6E', topDk: '#9C7CFF', pit: ['#0E0820', '#040209'], stone: '#2A1F3D',
      spike: '#C29CFF', spikeDk: '#3D1A99', spikeBase: '#2A1D33', ambient: 'sparkles',
      scene: 'cave', groundStyle: 'rock', block: 'basalt', crack: '#B98CFF', crackGround: '#9C7CFF', plat: 'slab',
      slab: ['#4E3D6E', '#14092A', '#9C7CFF'], roller: 'boulder', gate: 'rock', gateCol: ['#1A1230', '#3A2D52', '#0A0612', '#9C7CFF'],
      rock: ['#7A5FB0', '#1A1028', '#E0CCFF'], geyser: ['rgba(230,220,255,.95)', '#B98CFF', '#6B45C8', 'rgba(255,255,255,.7)'],
      vent: ['#2A1D33', '#0A0612', '#6B45C8', '#E0CCFF'], beetle: ['#7CF0FF', '#1A6B78', '#E0FFFF'],
      bird: ['#B98CFF', '#E0B0FF', '#F2E6FF', '#9C7CFF', '#3D1A99'], dust: '#9C7CFF', ffCol: '180,140,255', moveArrow: 'rgba(200,180,255,.9)' }),
    autumn: T('autumn', { sky: ['#5EAEE6', '#B7DBF2', '#FFE3BF'], sun: '#FFD27A',
      far: ['#9F8AB8', '#C6B4D9'], hillA: '#E39A48', hillB: '#CC7136', tree: '#E0522A', treeHi: '#FFB347', trunk: '#6B4423',
      ground: ['#97602F', '#663A1B'], top: '#D99A45', topDk: '#A2632A', pit: ['#3B2416', '#170C06'], stone: '#B07A45',
      spike: '#9C4AD6', spikeDk: '#4A1A6B', spikeBase: '#A2632A', ambient: 'leaves',
      flowers: ['#FFB347', '#E0522A', '#FFE45C', '#FFFFFF'], treeDots: '#FFE45C',
      turf: ['#D99A45', '#9C5E24', '#A2632A', '#B98049', '#85552E'], canopy: ['#7A2E12', '#B8461C', '#E0522A'], dust: '#E8C49A' }),
    beach: T('beach', { sky: ['#FF6FA8', '#FFA97A', '#FFE2A0'], sun: '#FFE9A8',
      far: ['#3FA7D6', '#7FD0F0'], hillA: '#F5D08A', hillB: '#EBC07A', tree: '#1E8A4E', treeHi: '#5BD66A', trunk: '#8A5A3B',
      ground: ['#F0C987', '#D3A05A'], top: '#FFE4A8', topDk: '#E0B070', pit: ['#1E6FA0', '#0B3E66'], stone: '#E0B070',
      spike: '#4A2D73', spikeDk: '#1A0F2E', spikeBase: '#E0B070', ambient: 'sparkles',
      scene: 'beach', groundStyle: 'sand', abyss: 'water', block: 'crate', plat: 'log', roller: 'coconut',
      canopy: ['#13693A', '#1E8A4E', '#5BD66A'], beetle: ['#FF5A3D', '#8E1A0A', '#FFB38A'],
      bird: ['#FFFFFF', '#E6ECF5', '#FFFFFF', '#DDE3EE', '#5A6B8C'], dust: '#FFE3A8', sunSize: 60, sunGlow: 200 }),
    city: T('city', { sky: ['#0B0824', '#251852', '#5E2A80'], sun: '#FFF1C4', moon: true,
      far: ['#1E1745', '#2C2160'], hillA: '#241B4F', hillB: '#1A1338', tree: '#FF3DCB', treeHi: '#22F2FF', trunk: '#3A3456',
      ground: ['#2C2742', '#14111E'], top: '#3A3456', topDk: '#22F2FF', pit: ['#080614', '#000000'], stone: '#3A3456',
      spike: '#FF3DCB', spikeDk: '#4A0A3A', spikeBase: '#2C2742', ambient: 'rain',
      scene: 'city', groundStyle: 'neon', block: 'crate', crate: ['#3A3456', '#0E0B18', '#22F2FF'], plat: 'slab',
      slab: ['#3A3456', '#0E0B18', '#FF3DCB'], roller: 'barrel', gate: 'rock', gateCol: ['#120F1F', '#2C2742', '#05030A', '#22F2FF'],
      rock: ['#4A4466', '#120F1F', '#22F2FF'], geyser: ['rgba(255,255,255,.95)', '#CFE8FF', '#7FA8D8', 'rgba(255,255,255,.6)'],
      vent: ['#2C2742', '#05030A', '#3A3456', '#22F2FF'], beetle: ['#22F2FF', '#0A4A55', '#FFFFFF'],
      bird: ['#FF3DCB', '#B0208F', '#FFC2F0', '#FF7FE0', '#4A0A3A'], dust: '#22F2FF', sunSize: 34, sunGlow: 120 }),
    spooky: T('spooky', { sky: ['#180C30', '#3A1C5A', '#76407A'], sun: '#FFF0C9', moon: true,
      far: ['#2A1840', '#3D2458'], hillA: '#2A1840', hillB: '#1E1030', tree: '#140A20', treeHi: '#3D2458', trunk: '#140A20',
      ground: ['#3A2A3A', '#170E1A'], top: '#56704A', topDk: '#2E4426', pit: ['#0E0618', '#000000'], stone: '#2A1F2A',
      spike: '#E8DCC8', spikeDk: '#3A2A3A', spikeBase: '#2E4426', ambient: 'fireflies', ffCol: '156,255,122',
      scene: 'spooky', flowers: [], block: 'grave', plat: 'log', roller: 'pumpkin', canopy: ['#140A20', '#2A1840', '#3D2458'],
      fire: ['#9CFF7A', '#E8FFD8', '#2E6B1E', 'rgba(156,255,122,.6)', '#14300E'], beetle: ['#FF8A2B', '#5A1E00', '#FFE45C'],
      bird: ['#A88AD6', '#8A68BE', '#E2D6F5', '#A88AD6', '#2A1840'], dust: '#56704A', sunSize: 52, sunGlow: 180 }),
    storm: T('storm', { sky: ['#2E3656', '#5A6488', '#9AA3C2'], sun: '#FFFFFF', noSun: true,
      far: ['#3A4366', '#56608A'], hillA: '#5A6488', hillB: '#727CA0', tree: '#79D98B', treeHi: '#B8F0C2', trunk: '#A98BDB',
      ground: ['#E3E7F2', '#9AA3C2'], top: '#F2F4FA', topDk: '#9AA3C2', pit: ['#232A48', '#10142A'], stone: '#C9CFE3',
      spike: '#FFE45C', spikeDk: '#7A5A00', spikeBase: '#9AA3C2', ambient: 'rain', lightning: true,
      scene: 'storm', groundStyle: 'cloud', abyss: 'clouds', block: 'gold', plat: 'cloud', cloudPlat: ['#EEF1F8', '#A7AFC9'],
      roller: 'snowball', snowball: ['#DDE2F0', '#4A5375', '#C3CAE0'], gate: 'storm', dust: '#FFFFFF', moveArrow: 'rgba(60,70,110,.85)' }),
    space: T('space', { sky: ['#04020C', '#120A2E', '#2E1858'], sun: '#FFB86B', planet: true,
      far: ['#3E3A5C', '#5E5A80'], hillA: '#4A4566', hillB: '#5E5A78', tree: '#5CFFC8', treeHi: '#B47CFF', trunk: '#3E3A52',
      ground: ['#7A7590', '#3E3A52'], top: '#A39FBA', topDk: '#5E5A78', pit: ['#04020C', '#000000'], stone: '#5E5A78',
      spike: '#5CFFC8', spikeDk: '#0E6B55', spikeBase: '#3E3A52', ambient: 'stars',
      scene: 'space', groundStyle: 'rock', abyss: 'void', craters: true, block: 'basalt', crack: '#5CFFC8', plat: 'slab',
      slab: ['#5E5A78', '#1E1A30', '#5CFFC8'], roller: 'boulder', gate: 'rock', gateCol: ['#2A2640', '#4A4566', '#0A0816', '#5CFFC8'],
      geyser: ['rgba(220,255,250,.95)', '#5CFFC8', '#1FA88A', 'rgba(255,255,255,.7)'], vent: ['#3E3A52', '#0A0816', '#1FA88A', '#5CFFC8'],
      beetle: ['#B47CFF', '#3D1A99', '#E0CCFF'], bird: ['#5CFFC8', '#1FA88A', '#DFFFF5', '#5CFFC8', '#0E6B55'],
      dust: '#A39FBA', moveArrow: 'rgba(92,255,200,.9)' }),
    castle: T('castle', { sky: ['#6E5CFF', '#B3A2FF', '#FFD3F2'], sun: '#FFF2A8', rainbow: true,
      far: ['#C9BFFF', '#E6E0FF'], hillA: '#FFFFFF', hillB: '#F1EEFF', tree: '#79D98B', treeHi: '#B8F0C2', trunk: '#A98BDB',
      ground: ['#FFFFFF', '#D8D0FF'], top: '#FFFFFF', topDk: '#C5BAF5', pit: ['#8F7CFF', '#4F3BD8'], stone: '#E6E0FF',
      spike: '#FFD45C', spikeDk: '#8A5A00', spikeBase: '#E6E0FF', ambient: 'sparkles',
      scene: 'castle', groundStyle: 'cloud', abyss: 'clouds', block: 'gold', plat: 'cloud', roller: 'gumball', gate: 'rock',
      gateCol: ['#B9AEE8', '#E8E2FF', '#5A48D8', '#FFD45C'],
      geyser: ['rgba(255,255,255,.95)', '#FFB3E6', '#B47CFF', 'rgba(255,255,255,.7)'], vent: ['#E6E0FF', '#5A48D8', '#B47CFF', '#FFD45C'],
      fire: ['#FFD45C', '#FFFFFF', '#B07400', 'rgba(255,212,92,.7)', '#5A3A00'], dust: '#FFFFFF', moveArrow: 'rgba(90,72,216,.8)' }),
  };

  /* ---------------- critters ---------------- */
  A.prepCritter = function (c) {
    if (c._prep) return c;
    c.bodyFar = U.shade(c.body, -0.14);
    c.legsC = c.legs || c.body;
    c.legsFar = U.shade(c.legsC, -0.16);
    c.pawFar = U.shade(c.paw || c.legsC, -0.16);
    c.eye = c.eye || '#21142F';
    c._prep = true;
    return c;
  };

  function leg(ctx, c, hx, hy, a, far) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(a);
    rr(ctx, -4.6, -3, 9.2, 15.5, 4.6);
    fs(ctx, far ? c.legsFar : c.legsC, c.dark, 2.2);
    ell(ctx, 1.2, 11.8, 5.6, 3.6);
    fs(ctx, far ? c.pawFar : c.paw || c.legsC, c.dark, 2.2);
    ctx.restore();
  }

  function tail(ctx, c, wag, mode, ax, ay) {
    const O = c.dark;
    ctx.save();
    ctx.translate(ax == null ? -19 : ax, ay == null ? -28 : ay);
    ctx.rotate(wag);
    switch (c.tail) {
      case 'fox':
        ctx.beginPath();
        ctx.moveTo(2, -5);
        ctx.bezierCurveTo(-12, -20, -36, -16, -40, -3);
        ctx.bezierCurveTo(-34, 9, -14, 10, 2, 6);
        ctx.closePath();
        fs(ctx, c.body, O, 2.5);
        ctx.save(); ctx.clip(); circ(ctx, -38, -3, 11); ctx.fillStyle = c.light; ctx.fill(); ctx.restore();
        ctx.beginPath();
        ctx.moveTo(2, -5);
        ctx.bezierCurveTo(-12, -20, -36, -16, -40, -3);
        ctx.bezierCurveTo(-34, 9, -14, 10, 2, 6);
        ctx.strokeStyle = O; ctx.lineWidth = 2.5; ctx.stroke();
        break;
      case 'cat':
      case 'tiger': {
        const long = c.tail === 'tiger';
        ctx.beginPath();
        ctx.moveTo(2, 0);
        ctx.bezierCurveTo(-16, -2, -22, -14, long ? -20 : -16, long ? -30 : -24);
        ctx.lineCap = 'round';
        ctx.strokeStyle = O; ctx.lineWidth = 9.5; ctx.stroke();
        ctx.strokeStyle = c.body; ctx.lineWidth = 5.2; ctx.stroke();
        if (long) { ctx.setLineDash([3, 5]); ctx.strokeStyle = O; ctx.lineWidth = 5.2; ctx.stroke(); ctx.setLineDash([]); }
        break;
      }
      case 'panda':
        circ(ctx, -3, 0, 6.5); fs(ctx, c.dark, null);
        break;
      case 'bunny':
        circ(ctx, -4, 0, 7); fs(ctx, c.light, c.dark, 2.2);
        circ(ctx, -8, -3, 3); ctx.fillStyle = '#FFFFFF'; ctx.fill();
        break;
      case 'dino':
        ctx.beginPath();
        ctx.moveTo(4, -8);
        ctx.quadraticCurveTo(-18, -8, -30, 6);
        ctx.quadraticCurveTo(-14, 8, 4, 10);
        ctx.closePath();
        // tail spikes
        ctx.save();
        ctx.fillStyle = c.spikes;
        for (let i = 0; i < 3; i++) {
          const px = -6 - i * 8, py = -8 + i * 4.2;
          ctx.beginPath(); ctx.moveTo(px - 3, py + 1); ctx.lineTo(px - 1, py - 6); ctx.lineTo(px + 3, py + 1); ctx.closePath();
          fs(ctx, c.spikes, O, 1.8);
        }
        ctx.restore();
        ctx.beginPath();
        ctx.moveTo(4, -8);
        ctx.quadraticCurveTo(-18, -8, -30, 6);
        ctx.quadraticCurveTo(-14, 8, 4, 10);
        ctx.closePath();
        fs(ctx, c.body, O, 2.5);
        break;
    }
    ctx.restore();
  }

  function ears(ctx, c, back, flop) {
    const O = c.dark;
    ctx.save();
    ctx.rotate(-back);
    switch (c.ear) {
      case 'fox':
      case 'cat': {
        const tip = c.ear === 'fox' ? -34 : -29;
        const earTri = (bx0, by0, bx1, by1, tx, ty, far) => {
          ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.quadraticCurveTo(tx - 2, ty + 2, tx, ty); ctx.quadraticCurveTo(tx + 2, ty + 4, bx1, by1); ctx.closePath();
          fs(ctx, far ? c.bodyFar : c.body, O, 2.5);
          ctx.save(); ctx.clip();
          ctx.beginPath(); ctx.moveTo(bx0 + 3, by0); ctx.lineTo(tx, ty + 7); ctx.lineTo(bx1 - 3, by1); ctx.closePath();
          ctx.fillStyle = c.inner; ctx.fill();
          if (c.ear === 'fox') { ctx.fillStyle = c.dark; ctx.fillRect(tx - 12, ty - 4, 24, 11); }
          ctx.restore();
        };
        earTri(-1, -16, 12, -12, 8 + flop, tip + 1, true);
        earTri(-16, -8, -3, -18, -12 + flop, tip, false);
        break;
      }
      case 'tiger':
      case 'panda': {
        const col = c.ear === 'panda' ? c.dark : c.body;
        circ(ctx, 7, -16.5, 7); fs(ctx, c.ear === 'panda' ? col : c.bodyFar, O, 2.4);
        circ(ctx, -9, -15, 7.5); fs(ctx, col, O, 2.4);
        if (c.ear === 'tiger') {
          circ(ctx, -9, -15, 3.8); ctx.fillStyle = c.inner; ctx.fill();
          circ(ctx, 7, -16.5, 3.5); ctx.fill();
        }
        break;
      }
      case 'bunny':
        ctx.save(); ctx.translate(4, -16); ctx.rotate(0.18 + flop * 0.04);
        ell(ctx, 0, -15, 6, 16); fs(ctx, c.bodyFar, O, 2.4);
        ell(ctx, 0, -14, 2.8, 11); ctx.fillStyle = c.inner; ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(-7, -15); ctx.rotate(-0.22 + flop * 0.06);
        ell(ctx, 0, -16, 6.6, 17); fs(ctx, c.body, O, 2.4);
        ell(ctx, 0, -15, 3, 12); ctx.fillStyle = c.inner; ctx.fill();
        ctx.restore();
        break;
      case 'none':
        if (c.spikes) {
          for (let i = 0; i < 4; i++) {
            const a = Math.PI * (1.05 + i * 0.17), r = 19;
            const px = Math.cos(a) * r, py = Math.sin(a) * r;
            ctx.save(); ctx.translate(px, py); ctx.rotate(a + Math.PI / 2);
            ctx.beginPath(); ctx.moveTo(-4.5, 2); ctx.lineTo(0, -7.5); ctx.lineTo(4.5, 2); ctx.closePath();
            fs(ctx, c.spikes, O, 2);
            ctx.restore();
          }
        }
        break;
    }
    ctx.restore();
  }

  function eyes(ctx, c, mood, blink) {
    const E = c.eye;
    const e1 = [1.5, -3.5], e2 = [11.5, -3.5];
    ctx.lineCap = 'round';
    ctx.strokeStyle = c.panda ? '#FFFFFF' : E;
    ctx.lineWidth = 2.3;
    if (mood === 'hurt') {
      for (const [x, y, d] of [[e1[0], e1[1], 1], [e2[0], e2[1], -1]]) {
        ctx.beginPath(); ctx.moveTo(x - 3 * d, y - 3); ctx.lineTo(x + 2 * d, y); ctx.lineTo(x - 3 * d, y + 3); ctx.stroke();
      }
      return;
    }
    if (mood === 'dizzy') {
      for (const [x, y] of [e1, e2]) { line(ctx, x - 3, y - 3, x + 3, y + 3); line(ctx, x + 3, y - 3, x - 3, y + 3); }
      return;
    }
    if (mood === 'happy') {
      for (const [x, y] of [e1, e2]) { ctx.beginPath(); ctx.arc(x, y + 1.5, 3.4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      return;
    }
    if (blink) {
      for (const [x, y] of [e1, e2]) { ctx.beginPath(); ctx.arc(x, y - 0.5, 3.2, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
      return;
    }
    const big = mood === 'wow' ? 1.18 : 1;
    for (const [x, y, s] of [[e1[0], e1[1], 1], [e2[0], e2[1], 0.94]]) {
      if (c.panda) { ell(ctx, x, y, 3.2 * s * big, 3.9 * s * big); ctx.fillStyle = '#FFFFFF'; ctx.fill(); }
      ell(ctx, x + (c.panda ? 0.6 : 0), y + (c.panda ? 0.4 : 0), (c.panda ? 2.2 : 3.3) * s * big, (c.panda ? 2.9 : 4.3) * s * big);
      ctx.fillStyle = E; ctx.fill();
      circ(ctx, x + 1.1, y - 1.7, 1.35 * s); ctx.fillStyle = '#FFFFFF'; ctx.fill();
      circ(ctx, x - 0.9, y + 1.5, 0.6 * s); ctx.fill();
    }
    if (mood === 'fierce') {
      ctx.strokeStyle = c.dark; ctx.lineWidth = 2;
      line(ctx, e1[0] - 3.5, e1[1] - 7, e1[0] + 2.5, e1[1] - 5);
      line(ctx, e2[0] - 2.5, e2[1] - 5.5, e2[0] + 3.5, e2[1] - 7.5);
    }
  }

  function head(ctx, c, pose, earBack) {
    const O = c.dark, mood = pose.mood;
    ears(ctx, c, earBack, pose.flop || 0);
    const dino = c.id === 'dino';
    const shape = () => { if (dino) ell(ctx, 2, 0, 21, 18.5); else circ(ctx, 0, 0, 19.5); };
    shape();
    fs(ctx, c.body, O, 2.6);
    ctx.save();
    shape(); ctx.clip();
    if (c.id === 'fox') { ell(ctx, 7, 10, 16, 9); ctx.fillStyle = c.light; ctx.fill(); }
    if (c.panda) {
      ell(ctx, 1, -2.5, 5.8, 7.2, 0.35); ctx.fillStyle = c.dark; ctx.fill();
      ell(ctx, 12, -2.5, 5.2, 6.6, -0.35); ctx.fill();
    }
    if (c.stripes) {
      ctx.strokeStyle = c.dark; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      line(ctx, -6, -18, -3, -11); line(ctx, 1, -19.5, 1.5, -12); line(ctx, 7, -18, 5.5, -12);
      line(ctx, -19, 1, -12, 2.5); line(ctx, -19, 7, -13, 7);
    }
    if (dino) {
      ctx.fillStyle = U.shade(c.body, 0.25);
      circ(ctx, -9, -8, 3); ctx.fill(); circ(ctx, -4, -13, 2); ctx.fill(); circ(ctx, -13, 2, 2.2); ctx.fill();
    }
    ctx.restore();
    // muzzle + nose
    ell(ctx, dino ? 13 : 11, 7, dino ? 11 : 9.5, dino ? 7.5 : 7);
    ctx.fillStyle = c.light; ctx.fill();
    if (dino) { ctx.fillStyle = c.dark; circ(ctx, 20, 3, 1.2); ctx.fill(); circ(ctx, 16.5, 2.5, 1.2); ctx.fill(); }
    else { ell(ctx, 19.5, 3.4, 3.5, 2.6); ctx.fillStyle = c.nose; ctx.fill(); circ(ctx, 18.6, 2.6, 0.9); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill(); }
    // cheek blush
    ell(ctx, -3.5, 6, 4.4, 2.7); ctx.fillStyle = 'rgba(255,92,140,0.38)'; ctx.fill();
    eyes(ctx, c, mood, pose.blink);
    // mouth
    ctx.strokeStyle = c.dark; ctx.lineWidth = 1.9; ctx.lineCap = 'round';
    if (mood === 'happy' || mood === 'wow' || pose.open) {
      ctx.beginPath(); ctx.moveTo(12.5, 9); ctx.quadraticCurveTo(15.5, 16.5, 19.5, 9.2); ctx.closePath();
      fs(ctx, '#7A1F3D', c.dark, 1.6);
      ell(ctx, 16, 12.2, 2.4, 1.5); ctx.fillStyle = '#FF7FA0'; ctx.fill();
    } else if (mood === 'hurt' || mood === 'dizzy') {
      ctx.beginPath(); ctx.moveTo(12, 11); ctx.quadraticCurveTo(14, 9, 16, 11); ctx.quadraticCurveTo(18, 13, 20, 11); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(13, 9.5); ctx.quadraticCurveTo(16, 13, 19.5, 9.4); ctx.stroke();
    }
    if (c.teeth) { rr(ctx, 15.4, 9.8, 4, 3.6, 1); fs(ctx, '#FFFFFF', c.dark, 1); }
    if (c.whiskers) {
      ctx.strokeStyle = U.rgba(c.dark, 0.55); ctx.lineWidth = 1.1;
      line(ctx, 17, 6.5, 27, 4.5); line(ctx, 17, 8.5, 27, 9.5);
    }
  }

  function dinoBackSpikes(ctx, c, cx, cy, rx, ry) {
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * (1.12 + i * 0.16);
      const px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
      ctx.save(); ctx.translate(px, py); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(-5, 3); ctx.lineTo(0, -8); ctx.lineTo(5, 3); ctx.closePath();
      fs(ctx, c.spikes, c.dark, 2);
      ctx.restore();
    }
  }

  /**
   * Draws a critter facing right with its feet at (0,0).
   * pose: { mode: run|jump|fall|slide|idle|hurt|dizzy|happy, phase, t, blink, land, mood }
   */
  A.critter = function (ctx, c, pose) {
    A.prepCritter(c);
    const m = pose.mode || 'run', ph = pose.phase || 0, t = pose.t || 0;
    const O = c.dark;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const mood = pose.mood || (m === 'hurt' ? 'hurt' : m === 'dizzy' ? 'dizzy' : m === 'happy' ? 'happy' : m === 'fall' ? 'wow' : '');
    const hp = { mood, blink: pose.blink, flop: 0, open: m === 'jump' };

    if (m === 'slide') {
      const wig = Math.sin(t * 30) * 0.6;
      ctx.translate(0, wig * 0.3);
      const sw = { fox: 0.12, cat: -1.05, tiger: -1.15, dino: -0.25 }[c.tail] || 0;
      tail(ctx, c, sw + Math.sin(t * 20) * 0.05, m, -22, -13);
      leg(ctx, c, -14, -7, 1.35, true);
      leg(ctx, c, 12, -7, -1.25, true);
      if (c.spikes) dinoBackSpikes(ctx, c, -2, -13, 25, 11);
      ell(ctx, -2, -13, 25, 11); fs(ctx, c.body, O, 2.6);
      ctx.save(); ell(ctx, -2, -13, 25, 11); ctx.clip();
      ell(ctx, 4, -6, 16, 7); ctx.fillStyle = c.light; ctx.fill();
      if (c.panda) { ell(ctx, 10, -14, 9, 14); ctx.fillStyle = c.dark; ctx.fill(); }
      ctx.restore();
      leg(ctx, c, -18, -6, 1.45, false);
      leg(ctx, c, 8, -6, -1.35, false);
      ctx.save(); ctx.translate(19, -20); ctx.scale(0.9, 0.9); ctx.rotate(0.12);
      hp.mood = mood || 'fierce';
      head(ctx, c, hp, 1.05);
      ctx.restore();
      ctx.restore();
      return;
    }

    const s = Math.sin(ph);
    let bob = 0, tilt = 0, la = 0, lb = 0, earBack = 0, wag = Math.sin(ph) * 0.25;
    if (m === 'run') { bob = -Math.abs(Math.cos(ph)) * 3.5; la = s * 0.85; lb = -s * 0.85; tilt = 0.03; hp.flop = Math.sin(ph * 2); }
    else if (m === 'jump') { tilt = -0.14; la = -0.95; lb = 0.75; earBack = 0.35; wag = -0.25; }
    else if (m === 'fall') { tilt = 0.07; la = 0.45; lb = -0.35; earBack = -0.18; wag = 0.35; }
    else if (m === 'idle' || m === 'happy') { bob = Math.sin(t * 3.2) * 1.6; wag = Math.sin(t * 4) * 0.22; hp.flop = Math.sin(t * 3); }
    else if (m === 'hurt' || m === 'dizzy') { tilt = Math.sin(t * 16) * 0.13; la = 0.4; lb = -0.4; }

    ctx.translate(0, bob);
    const sq = pose.land > 0 ? 1 - pose.land * 0.9 : m === 'jump' ? 1.05 : 1;
    ctx.scale(1 / Math.sqrt(sq), sq);
    ctx.translate(0, -24); ctx.rotate(tilt); ctx.translate(0, 24);

    tail(ctx, c, wag, m);
    leg(ctx, c, -10, -13, lb, true);
    leg(ctx, c, 9, -13, la, true);
    if (c.spikes) dinoBackSpikes(ctx, c, -2, -25, 21, 15.5);
    ell(ctx, -2, -25, 21, 15.5); fs(ctx, c.body, O, 2.6);
    ctx.save();
    ell(ctx, -2, -25, 21, 15.5); ctx.clip();
    ell(ctx, 6, -16, 14, 9.5); ctx.fillStyle = c.light; ctx.fill();
    if (c.panda) { ell(ctx, 9, -28, 9.5, 17); ctx.fillStyle = c.dark; ctx.fill(); }
    if (c.stripes) {
      ctx.strokeStyle = c.dark; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      line(ctx, -15, -41, -12, -30); line(ctx, -7, -42, -5.5, -31); line(ctx, 1, -41, 0.5, -32);
    }
    if (c.id === 'dino') {
      ctx.strokeStyle = U.rgba(c.dark, 0.35); ctx.lineWidth = 1.4;
      line(ctx, 0, -12, 14, -14); line(ctx, -2, -17, 15, -19);
    }
    ctx.restore();
    leg(ctx, c, -15, -12, la, false);
    leg(ctx, c, 4, -12, lb, false);
    ctx.save();
    ctx.translate(13, -45);
    ctx.rotate(-tilt * 0.4 + (m === 'run' ? Math.sin(ph * 2) * 0.03 : 0));
    head(ctx, c, hp, earBack);
    ctx.restore();
    ctx.restore();
  };

  /** Feather wings shown while the double jump power is active. */
  A.wings = function (ctx, flap, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (const [dx, sc] of [[-6, 0.85], [0, 1]]) {
      ctx.save(); ctx.translate(dx - 6, -36); ctx.rotate(-0.5 - flap * 0.7); ctx.scale(sc, sc);
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-26, -12, -30, -30); ctx.quadraticCurveTo(-18, -22, -8, -24); ctx.quadraticCurveTo(-10, -12, 0, 0);
      fs(ctx, '#FFFFFF', '#8C6BE0', 2);
      ctx.strokeStyle = 'rgba(140,107,224,.5)'; ctx.lineWidth = 1.4;
      line(ctx, -6, -6, -22, -24);
      ctx.restore();
    }
    ctx.restore();
  };

  /* ---------------- collectibles ---------------- */
  A.coin = function (ctx, x, y, t, r) {
    r = r || 12;
    const sx = 0.22 + 0.78 * Math.abs(Math.cos(t * 3.2 + x * 0.013));
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1);
    circ(ctx, 0, 0, r); fs(ctx, '#FFC93C', '#B86E00', 2.2);
    circ(ctx, 0, 0, r * 0.7); ctx.strokeStyle = '#FFE89A'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.fillStyle = '#E39A12'; paw(ctx, 0, 0.6, r * 0.42);
    ctx.restore();
    if (sx > 0.85) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ell(ctx, x - r * 0.35, y - r * 0.45, r * 0.18, r * 0.32, 0.6); ctx.fill(); }
  };

  A.gem = function (ctx, x, y, t) {
    const b = Math.sin(t * 3 + x) * 3;
    ctx.save(); ctx.translate(x, y + b);
    ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(9, -9); ctx.lineTo(15, -2); ctx.lineTo(0, 14); ctx.lineTo(-15, -2); ctx.closePath();
    const g = ctx.createLinearGradient(0, -9, 0, 14); g.addColorStop(0, '#E2B8FF'); g.addColorStop(1, '#7A3CFF');
    fs(ctx, g, '#3D1A99', 2.2);
    ctx.strokeStyle = 'rgba(61,26,153,.55)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-15, -2); ctx.lineTo(15, -2); ctx.moveTo(-9, -9); ctx.lineTo(-4, -2); ctx.lineTo(0, 14); ctx.lineTo(4, -2); ctx.lineTo(9, -9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(-2, -7); ctx.lineTo(-5, -3); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
    const tw = (Math.sin(t * 5 + x) + 1) / 2;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + tw * 0.6) + ')';
    starPath(ctx, 10, -12, 4 * tw + 1, 1, 4); ctx.fill();
    ctx.restore();
  };

  A.star = function (ctx, x, y, t, r) {
    r = r || 20;
    ctx.save(); ctx.translate(x, y + Math.sin(t * 2.4) * 3);
    const pulse = 1 + Math.sin(t * 4) * 0.08;
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2.2 * pulse);
    g.addColorStop(0, 'rgba(255,236,120,.65)'); g.addColorStop(1, 'rgba(255,236,120,0)');
    ctx.fillStyle = g; circ(ctx, 0, 0, r * 2.2 * pulse); ctx.fill();
    ctx.rotate(Math.sin(t * 2) * 0.15);
    ctx.lineJoin = 'round';
    starPath(ctx, 0, 0, r, r * 0.52);
    const sg = ctx.createLinearGradient(0, -r, 0, r); sg.addColorStop(0, '#FFF27A'); sg.addColorStop(1, '#FFAE1A');
    fs(ctx, sg, '#B45F00', 3);
    ctx.fillStyle = '#5A2A00';
    ell(ctx, -4, -1, 1.8, 2.8); ctx.fill(); ell(ctx, 4, -1, 1.8, 2.8); ctx.fill();
    ctx.strokeStyle = '#5A2A00'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 3, 3, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.restore();
  };

  A.heart = function (ctx, x, y, t, s) {
    s = s || 17;
    const b = 1 + Math.sin(t * 6) * 0.06;
    ctx.save(); ctx.translate(x, y + Math.sin(t * 2.6) * 3); ctx.scale(b, b);
    heartPath(ctx, 0, 0, s);
    fs(ctx, '#FF4D6D', '#9E1238', 2.6);
    ell(ctx, -s * 0.42, -s * 0.28, s * 0.2, s * 0.3, 0.6); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill();
    ctx.restore();
  };

  A.powerIcon = function (ctx, kind, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 15, s / 15);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (kind === 'shield') {
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(8, -9, 12, -10); ctx.quadraticCurveTo(13, 7, 0, 14);
      ctx.quadraticCurveTo(-13, 7, -12, -10); ctx.quadraticCurveTo(-8, -9, 0, -14); ctx.closePath();
      fs(ctx, '#3D8BFF', '#123C99', 2.4);
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(5, -6, 7.5, -6.5); ctx.quadraticCurveTo(8, 4, 0, 9); ctx.closePath();
      ctx.fillStyle = '#9CC6FF'; ctx.fill();
    } else if (kind === 'magnet') {
      ctx.beginPath(); ctx.arc(0, -1, 8.5, Math.PI, 0); ctx.lineTo(8.5, 9); ctx.moveTo(-8.5, -1); ctx.lineTo(-8.5, 9);
      ctx.strokeStyle = '#7A0F2B'; ctx.lineWidth = 9; ctx.stroke();
      ctx.strokeStyle = '#FF4D6D'; ctx.lineWidth = 5.6; ctx.stroke();
      rr(ctx, -12.5, 5, 8, 7, 2); fs(ctx, '#EEF1FA', '#7A0F2B', 1.8);
      rr(ctx, 4.5, 5, 8, 7, 2); fs(ctx, '#EEF1FA', '#7A0F2B', 1.8);
    } else if (kind === 'feather') {
      ctx.rotate(0.6);
      ctx.beginPath(); ctx.moveTo(0, 15); ctx.quadraticCurveTo(-11, 2, 0, -15); ctx.quadraticCurveTo(11, 2, 0, 15); ctx.closePath();
      fs(ctx, '#FFFFFF', '#6B45C8', 2.2);
      ctx.strokeStyle = '#A07CF0'; ctx.lineWidth = 1.6; line(ctx, 0, 14, 0, -11);
      line(ctx, 0, 2, -5, -3); line(ctx, 0, 6, 5, 1); line(ctx, 0, -3, 5, -8);
    } else if (kind === 'boost') {
      ctx.beginPath(); ctx.moveTo(3, -15); ctx.lineTo(-9, 2); ctx.lineTo(-1, 2); ctx.lineTo(-4, 15); ctx.lineTo(9, -3); ctx.lineTo(1, -3); ctx.closePath();
      fs(ctx, '#FFC93C', '#A34B00', 2.4);
    }
    ctx.restore();
  };

  A.power = function (ctx, kind, x, y, t) {
    const col = Z.POWERS[kind].color;
    ctx.save(); ctx.translate(x, y + Math.sin(t * 2.5 + x * 0.01) * 4);
    const pulse = 1 + Math.sin(t * 5) * 0.05;
    const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, 24 * pulse);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.6, U.rgba(col, 0.22)); g.addColorStop(1, U.rgba(col, 0.55));
    circ(ctx, 0, 0, 23 * pulse); fs(ctx, g, '#FFFFFF', 2.6);
    circ(ctx, 0, 0, 23 * pulse); ctx.strokeStyle = U.rgba(col, 0.8); ctx.lineWidth = 1.2; ctx.stroke();
    A.powerIcon(ctx, kind, 0, 0, 13);
    ctx.beginPath(); ctx.arc(0, 0, 17, Math.PI * 1.15, Math.PI * 1.45); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  };

  /* ---------------- obstacles ---------------- */
  A.spikes = function (ctx, e, th) {
    const n = Math.max(1, Math.round(e.w / 18)), sw = e.w / n;
    rr(ctx, e.x - 2, GY - 9, e.w + 4, 11, 5); fs(ctx, th.spikeBase, th.spikeDk, 2);
    for (let i = 0; i < n; i++) {
      const x0 = e.x + i * sw;
      ctx.beginPath();
      ctx.moveTo(x0 + 1, GY - 5);
      ctx.lineTo(x0 + sw / 2 - 1.5, GY - 28);
      ctx.quadraticCurveTo(x0 + sw / 2, GY - 31, x0 + sw / 2 + 1.5, GY - 28);
      ctx.lineTo(x0 + sw - 1, GY - 5);
      ctx.closePath();
      const g = ctx.createLinearGradient(x0, GY - 30, x0 + sw, GY);
      g.addColorStop(0, U.shade(th.spike, 0.35)); g.addColorStop(1, th.spike);
      fs(ctx, g, th.spikeDk, 2);
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5;
      line(ctx, x0 + 4, GY - 8, x0 + sw / 2 - 1, GY - 25);
    }
  };

  A.block = function (ctx, e, th) {
    const { x, y, w, h } = e;
    switch (th.block) {
      case 'cake': {
        rr(ctx, x, y + 8, w, h - 8, 8); fs(ctx, '#FFF0D9', '#9C5A3C', 2.4);
        ctx.strokeStyle = '#F2B8C9'; ctx.lineWidth = 3; line(ctx, x + 6, y + h * 0.6, x + w - 6, y + h * 0.6);
        ctx.beginPath(); ctx.moveTo(x - 2, y + 14);
        for (let i = 0; i <= 4; i++) ctx.quadraticCurveTo(x + (i + 0.5) * (w / 4), y + 22 + (i % 2) * 5, x + (i + 1) * (w / 4), y + 14);
        ctx.lineTo(x + w + 2, y + 2); ctx.quadraticCurveTo(x + w / 2, y - 6, x - 2, y + 2); ctx.closePath();
        fs(ctx, '#FF7FBF', '#C43C83', 2.2);
        circ(ctx, x + w / 2, y - 3, 6); fs(ctx, '#FF3B5C', '#9E1238', 2);
        break;
      }
      case 'stone': {
        const c = th.stoneBlock;
        rr(ctx, x, y, w, h, 8); fs(ctx, c[0], c[1], 2.4);
        ctx.strokeStyle = U.rgba(c[1], 0.5); ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.58, 8, 0, Math.PI * 1.6); ctx.stroke();
        if (c[2]) { rr(ctx, x - 2, y - 3, w + 4, 11, 5); fs(ctx, c[2], U.shade(c[2], -0.35), 2); }
        break;
      }
      case 'basalt': {
        rr(ctx, x, y, w, h, 7); fs(ctx, '#4A3757', '#1E1426', 2.4);
        ctx.strokeStyle = th.crack; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 8, y + 6); ctx.lineTo(x + 18, y + h * 0.45); ctx.lineTo(x + 12, y + h - 6); ctx.moveTo(x + 18, y + h * 0.45); ctx.lineTo(x + w - 9, y + h * 0.6); ctx.stroke();
        break;
      }
      case 'gold': {
        rr(ctx, x, y, w, h, 8); fs(ctx, '#FFD45C', '#B07400', 2.4);
        rr(ctx, x + 5, y + 5, w - 10, h - 10, 5); ctx.strokeStyle = '#FFF1B0'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#E5A51A'; starPath(ctx, x + w / 2, y + h / 2, 8, 4); ctx.fill();
        break;
      }
      case 'ice': {
        rr(ctx, x, y, w, h, 8);
        const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#EAF8FF'); g.addColorStop(1, '#9CCBF2');
        fs(ctx, g, '#3E6FA8', 2.4);
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.4; line(ctx, x + 8, y + 12, x + 18, y + 12); line(ctx, x + 8, y + 12, x + 8, y + 22);
        ctx.strokeStyle = 'rgba(62,111,168,.35)'; ctx.lineWidth = 1.6; line(ctx, x + w - 10, y + h - 8, x + w - 20, y + h * 0.45);
        ctx.beginPath(); ctx.moveTo(x - 2, y + 6); ctx.quadraticCurveTo(x + w / 2, y - 8, x + w + 2, y + 6);
        ctx.quadraticCurveTo(x + w * 0.7, y + 12, x + w * 0.5, y + 8); ctx.quadraticCurveTo(x + w * 0.25, y + 14, x - 2, y + 6); ctx.closePath();
        fs(ctx, '#FFFFFF', '#AFC8EA', 2);
        break;
      }
      case 'crate': {
        const c = th.crate;
        rr(ctx, x, y, w, h, 5); fs(ctx, c[0], c[1], 2.4);
        rr(ctx, x + 5, y + 5, w - 10, h - 10, 3); ctx.strokeStyle = c[1]; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = c[2]; ctx.lineWidth = 3; line(ctx, x + 7, y + 7, x + w - 7, y + h - 7); line(ctx, x + w - 7, y + 7, x + 7, y + h - 7);
        break;
      }
      case 'grave': {
        ctx.beginPath(); ctx.moveTo(x + 3, y + h); ctx.lineTo(x + 3, y + w / 2 - 1); ctx.arc(x + w / 2, y + w / 2 - 1, w / 2 - 3, Math.PI, 0); ctx.lineTo(x + w - 3, y + h); ctx.closePath();
        fs(ctx, '#9C94A8', '#2A1F2A', 2.4);
        ctx.fillStyle = '#5E5468'; ctx.fillRect(x + w / 2 - 2.5, y + 10, 5, 18); ctx.fillRect(x + w / 2 - 8, y + 15, 16, 5);
        ctx.fillStyle = '#56704A'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + 6 + i * 16, y + h); ctx.lineTo(x + 9 + i * 16, y + h - 8); ctx.lineTo(x + 12 + i * 16, y + h); ctx.fill(); }
        break;
      }
      default: { // tree stump
        rr(ctx, x, y + 5, w, h - 5, 6);
        const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#9C6640'); g.addColorStop(1, '#7A4A2A');
        fs(ctx, g, '#4A2A14', 2.4);
        ctx.strokeStyle = 'rgba(74,42,20,.45)'; ctx.lineWidth = 2;
        line(ctx, x + 12, y + 14, x + 11, y + h - 6); line(ctx, x + 26, y + 12, x + 27, y + h - 4); line(ctx, x + 38, y + 16, x + 37, y + h - 8);
        ell(ctx, x + w / 2, y + 6, w / 2 + 1, 7); fs(ctx, '#EBC48F', '#4A2A14', 2.2);
        ell(ctx, x + w / 2, y + 6, w / 4, 3.4); ctx.strokeStyle = '#C79A62'; ctx.lineWidth = 1.5; ctx.stroke();
        circ(ctx, x + w - 4, y + h - 10, 5); fs(ctx, '#FF5C6C', '#9E1238', 1.6);
        ctx.fillStyle = '#FFFFFF'; circ(ctx, x + w - 5.5, y + h - 11.5, 1.2); ctx.fill();
      }
    }
  };

  A.lucky = function (ctx, e, t) {
    const off = -Math.sin(e.bump * Math.PI) * 9;
    const x = e.x, y = e.y + off;
    rr(ctx, x, y, e.w, e.h, 9);
    if (e.used) { fs(ctx, '#C9A37A', '#6B4A2A', 2.6); return; }
    const g = ctx.createLinearGradient(0, y, 0, y + e.h); g.addColorStop(0, '#FFD45C'); g.addColorStop(1, '#FF9F1C');
    fs(ctx, g, '#8A4A00', 2.6);
    rr(ctx, x + 4, y + 4, e.w - 8, e.h - 8, 6); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.6; ctx.stroke();
    const glow = 0.75 + Math.sin(t * 5 + x) * 0.25;
    ctx.fillStyle = 'rgba(255,255,255,' + glow + ')';
    paw(ctx, x + e.w / 2, y + e.h / 2 + 1, 9);
    ctx.fillStyle = '#8A4A00';
    for (const [dx, dy] of [[6, 6], [e.w - 6, 6], [6, e.h - 6], [e.w - 6, e.h - 6]]) { circ(ctx, x + dx, y + dy, 1.6); ctx.fill(); }
  };

  A.plat = function (ctx, e, th, t) {
    let { x, y, w } = e;
    const h = 22;
    ctx.save();
    if (e.crumble) {
      if (e.cT >= 0 && !e.gone) x += Math.sin(t * 70) * 2;
      if (e.gone) ctx.globalAlpha = U.clamp(1 - (e.y - e.py) * 0, 0, 1) * 0.85;
    }
    if (e.bouncy) {
      const sq = Math.sin(e.squish * Math.PI) * 0.35;
      ctx.translate(x + w / 2, y + h); ctx.scale(1 + sq * 0.4, 1 - sq); ctx.translate(-(x + w / 2), -(y + h));
      rr(ctx, x, y, w, h + 4, 12);
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#9CF5E8'); g.addColorStop(1, '#2FC7B5');
      fs(ctx, g, '#0E7F72', 2.6);
      ell(ctx, x + w * 0.3, y + 6, w * 0.18, 3); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fill();
      ctx.fillStyle = '#0E7F72';
      circ(ctx, x + w / 2 - 8, y + 12, 2); ctx.fill(); circ(ctx, x + w / 2 + 8, y + 12, 2); ctx.fill();
      ctx.restore();
      return;
    }
    switch (th.plat) {
      case 'wafer':
        rr(ctx, x, y + 2, w, h, 6); fs(ctx, '#F5C27A', '#9C5A2C', 2.4);
        ctx.strokeStyle = 'rgba(156,90,44,.4)'; ctx.lineWidth = 1.5;
        for (let i = x + 14; i < x + w - 6; i += 14) line(ctx, i, y + 9, i, y + h);
        rr(ctx, x - 3, y - 3, w + 6, 10, 5); fs(ctx, '#FFB3DA', '#D35B98', 2);
        break;
      case 'log':
        rr(ctx, x, y, w, h, 11);
        { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#A06A42'); g.addColorStop(1, '#6B4423'); fs(ctx, g, '#3B2412', 2.4); }
        ctx.strokeStyle = 'rgba(59,36,18,.4)'; ctx.lineWidth = 1.6;
        for (let i = x + 20; i < x + w - 16; i += 26) line(ctx, i, y + 6, i + 12, y + 6);
        ell(ctx, x + 9, y + h / 2, 7, 9.5); fs(ctx, '#E0B07A', '#3B2412', 2);
        ell(ctx, x + w - 9, y + h / 2, 7, 9.5); fs(ctx, '#E0B07A', '#3B2412', 2);
        ctx.strokeStyle = th.canopy[2]; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + w * 0.35, y + h - 2); ctx.quadraticCurveTo(x + w * 0.38, y + h + 14, x + w * 0.33, y + h + 22); ctx.stroke();
        break;
      case 'slab': {
        const c = th.slab;
        { const g = ctx.createLinearGradient(0, y + h, 0, y + h + 26); g.addColorStop(0, U.rgba(c[2], 0.45)); g.addColorStop(1, U.rgba(c[2], 0)); ctx.fillStyle = g; ctx.fillRect(x + 6, y + h, w - 12, 26); }
        rr(ctx, x, y, w, h, 7); fs(ctx, c[0], c[1], 2.4);
        rr(ctx, x + 2, y + h - 6, w - 4, 5, 2); ctx.fillStyle = c[2]; ctx.fill();
        break;
      }
      case 'cloud': {
        const c = th.cloudPlat;
        ctx.fillStyle = c[1];
        rr(ctx, x + 4, y + 6, w - 8, h - 2, 10); ctx.fill();
        ctx.beginPath();
        for (let i = 0; i <= Math.ceil(w / 26); i++) { const cx = x + 8 + Math.min(i * 26, w - 16); ctx.moveTo(cx + 15, y + 6); ctx.arc(cx, y + 6, 15 - (i % 2) * 3, 0, TAU); }
        ctx.fillStyle = e.crumble ? U.shade(c[0], -0.05) : c[0]; ctx.fill();
        if (e.crumble) {
          ctx.strokeStyle = 'rgba(122,110,180,.55)'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(x + w * 0.3, y - 4); ctx.lineTo(x + w * 0.36, y + 6); ctx.lineTo(x + w * 0.3, y + 14);
          ctx.moveTo(x + w * 0.68, y - 2); ctx.lineTo(x + w * 0.62, y + 8); ctx.lineTo(x + w * 0.7, y + 16); ctx.stroke();
        }
        break;
      }
      default: { // floating turf
        const c = th.turf;
        rr(ctx, x, y + 2, w, h, 9);
        { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c[3]); g.addColorStop(1, c[4]); fs(ctx, g, '#4A2A14', 2.4); }
        rr(ctx, x - 3, y - 3, w + 6, 11, 6); fs(ctx, c[0], c[1], 2);
        ctx.fillStyle = c[2];
        for (let i = x + 8; i < x + w - 4; i += 16) { ctx.beginPath(); ctx.moveTo(i, y - 3); ctx.lineTo(i + 3, y - 9); ctx.lineTo(i + 6, y - 3); ctx.fill(); }
      }
    }
    if (e.crumble && th.plat !== 'cloud') {
      ctx.strokeStyle = 'rgba(30,20,40,.55)'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(x + w * 0.32, y); ctx.lineTo(x + w * 0.38, y + 10); ctx.lineTo(x + w * 0.31, y + 20);
      ctx.moveTo(x + w * 0.7, y); ctx.lineTo(x + w * 0.64, y + 12); ctx.lineTo(x + w * 0.72, y + 21); ctx.stroke();
    }
    if (e.move) {
      ctx.fillStyle = th.moveArrow;
      const cy = y + 12;
      if (e.move.axis === 'x') {
        ctx.beginPath(); ctx.moveTo(x + 6, cy); ctx.lineTo(x + 13, cy - 5); ctx.lineTo(x + 13, cy + 5); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + w - 6, cy); ctx.lineTo(x + w - 13, cy - 5); ctx.lineTo(x + w - 13, cy + 5); ctx.fill();
      } else {
        const mx = x + w / 2;
        ctx.beginPath(); ctx.moveTo(mx - 14, cy - 1); ctx.lineTo(mx - 9, cy - 7); ctx.lineTo(mx - 4, cy - 1); ctx.fill();
        ctx.beginPath(); ctx.moveTo(mx + 4, cy - 3); ctx.lineTo(mx + 9, cy + 3); ctx.lineTo(mx + 14, cy - 3); ctx.fill();
      }
    }
    ctx.restore();
  };

  A.spring = function (ctx, e) {
    const ext = Math.sin(e.squish * Math.PI) * 16;
    const top = GY - 22 - ext;
    rr(ctx, e.x + 3, GY - 7, e.w - 6, 8, 3); fs(ctx, '#6A5A99', '#2B1D4A', 2);
    ctx.strokeStyle = '#2B1D4A'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    const zig = () => {
      ctx.beginPath(); const n = 4;
      for (let i = 0; i <= n; i++) { const yy = GY - 7 + ((top + 8) - (GY - 7)) * (i / n); ctx.lineTo(e.x + (i % 2 ? e.w - 12 : 12), yy); }
      ctx.stroke();
    };
    zig(); ctx.strokeStyle = '#C9D2E8'; ctx.lineWidth = 2.6; zig();
    rr(ctx, e.x, top, e.w, 11, 5.5); fs(ctx, '#FF4F6E', '#8E1230', 2.4);
    rr(ctx, e.x + 6, top + 2, e.w - 22, 3, 1.5); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
  };

  A.roller = function (ctx, e, th) {
    const r = e.r;
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.rotate(e.rot);
    switch (th.roller) {
      case 'gumball': {
        const cols = ['#FF5C8A', '#5CC8FF', '#FFC93C', '#7EE07A', '#B47CFF'], col = cols[e.tint % cols.length];
        circ(ctx, 0, 0, r); fs(ctx, col, U.shade(col, -0.5), 2.6);
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = r * 0.28;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0.2, 1.4); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.62, Math.PI + 0.2, Math.PI + 1.4); ctx.stroke();
        break;
      }
      case 'coconut':
        circ(ctx, 0, 0, r); fs(ctx, '#7A4A28', '#3B2412', 2.6);
        ctx.strokeStyle = 'rgba(59,36,18,.5)'; ctx.lineWidth = 1.4;
        for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; line(ctx, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, Math.cos(a + 0.2) * r * 0.95, Math.sin(a + 0.2) * r * 0.95); }
        ctx.fillStyle = '#3B2412';
        circ(ctx, -4, -3, 2.6); ctx.fill(); circ(ctx, 4, -3, 2.6); ctx.fill(); circ(ctx, 0, 4, 2.6); ctx.fill();
        break;
      case 'boulder':
        ctx.beginPath();
        for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, rad = r * (0.86 + U.hash(i + e.tint) * 0.16); ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
        ctx.closePath(); fs(ctx, '#4B3A57', '#1A1020', 2.6);
        ctx.strokeStyle = th.crack; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(0, r * 0.1); ctx.lineTo(r * 0.3, -r * 0.4); ctx.moveTo(0, r * 0.1); ctx.lineTo(r * 0.1, r * 0.55); ctx.stroke();
        break;
      case 'snowball': {
        const c = th.snowball;
        circ(ctx, 0, 0, r); fs(ctx, c[0], c[1], 2.6);
        ctx.fillStyle = c[2]; ell(ctx, r * 0.2, r * 0.3, r * 0.6, r * 0.4); ctx.fill();
        break;
      }
      case 'pumpkin':
        ell(ctx, 0, 0, r, r * 0.92); fs(ctx, '#FF8A2B', '#7A2E00', 2.6);
        ctx.strokeStyle = 'rgba(122,46,0,.55)'; ctx.lineWidth = 1.8;
        ell(ctx, 0, 0, r * 0.45, r * 0.9); ctx.stroke();
        rr(ctx, -3, -r - 6, 6, 9, 2); fs(ctx, '#4A7A2A', '#24400F', 1.6);
        ctx.fillStyle = '#3A1400';
        ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(-r * 0.25, -r * 0.45); ctx.lineTo(-r * 0.12, -r * 0.15); ctx.fill();
        ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.2); ctx.lineTo(r * 0.25, -r * 0.45); ctx.lineTo(r * 0.12, -r * 0.15); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-r * 0.55, r * 0.15); ctx.lineTo(-r * 0.3, r * 0.5); ctx.lineTo(0, r * 0.3); ctx.lineTo(r * 0.3, r * 0.5); ctx.lineTo(r * 0.55, r * 0.15); ctx.closePath(); ctx.fill();
        break;
      case 'tumbleweed':
        circ(ctx, 0, 0, r); ctx.fillStyle = 'rgba(201,142,85,.28)'; ctx.fill();
        ctx.strokeStyle = '#9C6A3A'; ctx.lineWidth = 2;
        for (let i = 0; i < 9; i++) {
          const a = U.hash(i * 2.1 + e.tint) * TAU, rr2 = r * (0.45 + U.hash(i * 4.7) * 0.5);
          ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, rr2, a, a + 2.4); ctx.stroke();
        }
        circ(ctx, 0, 0, r); ctx.strokeStyle = '#7A4E28'; ctx.lineWidth = 2.4; ctx.stroke();
        break;
      case 'barrel': {
        const c = th.barrel;
        circ(ctx, 0, 0, r); fs(ctx, c[0], c[1], 2.6);
        circ(ctx, 0, 0, r * 0.68); ctx.strokeStyle = c[1]; ctx.lineWidth = 2.6; ctx.stroke();
        circ(ctx, 0, 0, r * 0.3); ctx.fillStyle = c[2]; ctx.fill();
        ctx.strokeStyle = c[2]; ctx.lineWidth = 2; line(ctx, -r * 0.68, 0, r * 0.68, 0);
        break;
      }
      default: // rolling log, end-on
        circ(ctx, 0, 0, r); fs(ctx, '#E3B57E', '#5A3418', 2.6);
        ctx.strokeStyle = '#B98A55'; ctx.lineWidth = 1.6;
        circ(ctx, 0, 0, r * 0.66); ctx.stroke(); circ(ctx, 0, 0, r * 0.33); ctx.stroke();
        circ(ctx, 0, 0, r); ctx.strokeStyle = '#8A5A3B'; ctx.lineWidth = 4; ctx.stroke();
        ctx.strokeStyle = '#5A3418'; ctx.lineWidth = 2; line(ctx, 0, 0, r * 0.8, 0);
    }
    ctx.restore();
    if (th.roller !== 'boulder' && th.roller !== 'tumbleweed') {
      ell(ctx, e.x - r * 0.35, e.y - r * 0.4, r * 0.22, r * 0.14, -0.6); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
    }
  };

  A.beetle = function (ctx, e, th, t) {
    const shell = th.beetle[0], dk = th.beetle[1], spot = th.beetle[2];
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h);
    if (e.squash > 0) ctx.scale(1.25, 0.35);
    const st = Math.sin((e.walk || 0) * 18);
    ctx.strokeStyle = dk; ctx.lineWidth = 2.6;
    for (let i = 0; i < 3; i++) { const lx = -12 + i * 11; line(ctx, lx, -6, lx + (i % 2 ? st : -st) * 4, 0); }
    ctx.beginPath(); ctx.arc(2, -8, 19, Math.PI, 0); ctx.closePath();
    fs(ctx, shell, dk, 2.6);
    ctx.fillStyle = spot;
    circ(ctx, -4, -17, 3.4); ctx.fill(); circ(ctx, 8, -19, 2.8); ctx.fill(); circ(ctx, 12, -11, 2.3); ctx.fill();
    ell(ctx, -6, -21, 5, 2.6, -0.4); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fill();
    circ(ctx, -17, -10, 9); fs(ctx, '#2B1D4A', '#14092A', 2.2);
    ctx.fillStyle = '#FFFFFF'; circ(ctx, -20, -12, 3); ctx.fill(); circ(ctx, -14.5, -12.5, 2.7); ctx.fill();
    ctx.fillStyle = '#14092A'; circ(ctx, -21, -12, 1.5); ctx.fill(); circ(ctx, -15.5, -12.3, 1.4); ctx.fill();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.6; line(ctx, -23, -16.5, -18.5, -15); line(ctx, -16.5, -15, -12, -16.5);
    ctx.restore();
  };

  A.frog = function (ctx, e, t) {
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h);
    if (e.squash > 0) ctx.scale(1.3, 0.35);
    const air = e.air;
    ctx.strokeStyle = '#1F6B30'; ctx.lineWidth = 2.4;
    if (air) {
      ell(ctx, -12, -2, 5, 9, 0.5); fs(ctx, '#4CC75E', '#1F6B30', 2.2);
      ell(ctx, 12, -2, 5, 9, -0.5); fs(ctx, '#4CC75E', '#1F6B30', 2.2);
    } else {
      ell(ctx, -14, -5, 8, 5); fs(ctx, '#4CC75E', '#1F6B30', 2.2);
      ell(ctx, 14, -5, 8, 5); fs(ctx, '#4CC75E', '#1F6B30', 2.2);
    }
    ell(ctx, 0, -14, 19, 14); fs(ctx, '#5BD66A', '#1F6B30', 2.6);
    ell(ctx, 0, -9, 12, 7); ctx.fillStyle = '#E8FFC9'; ctx.fill();
    circ(ctx, -9, -27, 7); fs(ctx, '#5BD66A', '#1F6B30', 2.2);
    circ(ctx, 7, -27, 7); fs(ctx, '#5BD66A', '#1F6B30', 2.2);
    ctx.fillStyle = '#FFFFFF'; circ(ctx, -9, -27, 4.3); ctx.fill(); circ(ctx, 7, -27, 4.3); ctx.fill();
    ctx.fillStyle = '#14092A'; circ(ctx, -10.5, -27, 2.3); ctx.fill(); circ(ctx, 5.5, -27, 2.3); ctx.fill();
    ctx.strokeStyle = '#1F6B30'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(-2, -16, 7, 0.3, Math.PI - 0.3); ctx.stroke();
    ell(ctx, -10, -13, 3.4, 2); ctx.fillStyle = 'rgba(255,110,150,.45)'; ctx.fill();
    ctx.restore();
  };

  A.bird = function (ctx, e, t, th) {
    const c = (th && th.bird) || BASE.bird;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.squash > 0) ctx.scale(1.2, 0.5);
    const flap = Math.sin(t * 16 + e.ph);
    ctx.beginPath(); ctx.moveTo(14, -2); ctx.lineTo(28, -8); ctx.lineTo(26, 0); ctx.lineTo(30, 6); ctx.closePath();
    fs(ctx, c[3], c[4], 2);
    ell(ctx, 0, 0, 20, 15); fs(ctx, c[0], c[4], 2.6);
    ell(ctx, -2, 5, 11, 7); ctx.fillStyle = c[2]; ctx.fill();
    ctx.save(); ctx.translate(4, -4); ctx.rotate(-0.3 + flap * 0.8);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -22, 22, -18); ctx.quadraticCurveTo(14, -6, 0, 0);
    fs(ctx, c[1], c[4], 2.2);
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(-18, -4); ctx.lineTo(-30, 0); ctx.lineTo(-18, 4); ctx.closePath();
    fs(ctx, '#FFC93C', '#A34B00', 2);
    ctx.fillStyle = '#FFFFFF'; circ(ctx, -9, -5, 4.4); ctx.fill();
    ctx.fillStyle = '#14092A'; circ(ctx, -10.5, -4.6, 2.3); ctx.fill();
    ctx.strokeStyle = c[4]; ctx.lineWidth = 2; line(ctx, -14, -11, -5, -9.5);
    ctx.restore();
  };

  /** Overhanging ceiling you slide under. Drawn from the top of the screen down to its lower edge. */
  A.gate = function (ctx, e, th, t, topY) {
    const x = e.x, w = e.w, bot = e.y + e.h, top = Math.min(topY - 20, e.y);
    ctx.save();
    switch (th.gate) {
      case 'rock': {
        const c = th.gateCol;
        ctx.beginPath(); ctx.moveTo(x - 6, top); ctx.lineTo(x + w + 6, top); ctx.lineTo(x + w + 6, bot - 14);
        const n = Math.max(2, Math.round(w / 22));
        for (let i = n; i >= 0; i--) { const px = x - 6 + ((w + 12) * i) / n; ctx.lineTo(px, i % 2 ? bot : bot - 10); }
        ctx.closePath();
        const g = ctx.createLinearGradient(0, bot - 140, 0, bot); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
        fs(ctx, g, c[2], 2.6);
        if (c[3]) {
          ctx.strokeStyle = c[3]; ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.moveTo(x + w * 0.3, bot - 60); ctx.lineTo(x + w * 0.45, bot - 34); ctx.lineTo(x + w * 0.38, bot - 18); ctx.stroke();
        }
        break;
      }
      case 'storm': {
        const g = ctx.createLinearGradient(0, bot - 160, 0, bot); g.addColorStop(0, '#5A5F8C'); g.addColorStop(1, '#8C90BE');
        ctx.fillStyle = g;
        ctx.fillRect(x - 4, top, w + 8, bot - 20 - top);
        ctx.beginPath();
        const n = Math.max(2, Math.round(w / 26));
        for (let i = 0; i <= n; i++) { const px = x + (w * i) / n; ctx.moveTo(px + 18, bot - 20); ctx.arc(px, bot - 20, 18, 0, TAU); }
        ctx.fill();
        ctx.strokeStyle = '#FFE45C'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
        if (Math.sin(t * 9 + x) > 0.6) {
          ctx.beginPath(); ctx.moveTo(x + w * 0.5, bot - 30); ctx.lineTo(x + w * 0.42, bot - 52); ctx.lineTo(x + w * 0.56, bot - 56); ctx.lineTo(x + w * 0.48, bot - 80); ctx.stroke();
        }
        break;
      }
      default: { // leafy canopy wall with a hanging log
        const c = th.canopy;
        const g = ctx.createLinearGradient(0, bot - 200, 0, bot); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
        ctx.fillStyle = g;
        ctx.fillRect(x + 2, top, w - 4, bot - 26 - top);
        ctx.fillStyle = c[2];
        for (let yy = bot - 40; yy > top - 20 && yy > bot - 420; yy -= 26) {
          for (let xx = x + 10; xx < x + w - 4; xx += 22) { ell(ctx, xx + ((yy / 26) % 2) * 8, yy, 9, 5.5, 0.5); ctx.fill(); }
        }
        rr(ctx, x - 6, bot - 30, w + 12, 30, 14);
        { const lg = ctx.createLinearGradient(0, bot - 30, 0, bot); lg.addColorStop(0, '#A06A42'); lg.addColorStop(1, '#6B4423'); fs(ctx, lg, '#3B2412', 2.6); }
        ell(ctx, x + w + 6 - 10, bot - 15, 8, 13); fs(ctx, '#E0B07A', '#3B2412', 2);
        ctx.strokeStyle = 'rgba(59,36,18,.45)'; ctx.lineWidth = 1.6;
        for (let i = x + 8; i < x + w - 16; i += 24) line(ctx, i, bot - 20, i + 12, bot - 20);
      }
    }
    // duck badge: tells players (without relying on colour) to go low
    const bx = x + w / 2, by = bot - (th.gate === 'storm' ? 54 : 58);
    circ(ctx, bx, by, 11); fs(ctx, 'rgba(255,255,255,.92)', 'rgba(43,29,74,.6)', 1.6);
    ctx.fillStyle = '#2B1D4A';
    ctx.beginPath(); ctx.moveTo(bx - 6, by - 2); ctx.lineTo(bx, by + 5); ctx.lineTo(bx + 6, by - 2); ctx.closePath(); ctx.fill();
    ctx.fillRect(bx - 2, by - 7, 4, 6);
    ctx.restore();
  };

  A.rockWarn = function (ctx, e, t, near) {
    const a = near ? 1 : 0.6, pulse = (Math.sin(t * 10) + 1) / 2;
    ctx.save();
    ell(ctx, e.x, GY - 2, 26 + pulse * 4, 6 + pulse); ctx.fillStyle = 'rgba(255,60,80,' + 0.25 * a + ')'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,60,80,' + 0.9 * a + ')'; ctx.lineWidth = 2.4; ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
    const ty = GY - 70 - pulse * 4;
    ctx.beginPath(); ctx.moveTo(e.x, ty - 16); ctx.lineTo(e.x + 14, ty + 9); ctx.lineTo(e.x - 14, ty + 9); ctx.closePath();
    fs(ctx, '#FFD23F', '#7A1F0A', 2.4);
    ctx.fillStyle = '#7A1F0A'; ctx.fillRect(e.x - 1.6, ty - 7, 3.2, 9); circ(ctx, e.x, ty + 5, 1.8); ctx.fill();
    ctx.restore();
  };

  A.rock = function (ctx, e, th) {
    const c = (th && th.rock) || BASE.rock;
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.rot);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, rad = e.r * (0.85 + U.hash(i * 3.1) * 0.18); ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
    ctx.closePath(); fs(ctx, c[0], c[1], 2.6);
    ctx.strokeStyle = c[2]; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(-2, 2); ctx.lineTo(8, -4); ctx.stroke();
    ell(ctx, -8, -10, 6, 3.5, -0.5); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fill();
    ctx.restore();
  };

  A.geyser = function (ctx, e, t, th) {
    th = th || BASE;
    const cx = e.x + e.w / 2, G = th.geyser, V = th.vent;
    if (e.fh > 1) {
      const h = e.fh;
      const g = ctx.createLinearGradient(0, GY - h, 0, GY);
      g.addColorStop(0, G[0]); g.addColorStop(0.5, G[1]); g.addColorStop(1, G[2]);
      ctx.beginPath();
      ctx.moveTo(cx - 13, GY - 6);
      for (let i = 0; i <= 8; i++) { const yy = GY - 6 - (h * i) / 8; ctx.lineTo(cx - 13 + Math.sin(t * 30 + i) * 3 - i * 0.6, yy); }
      ctx.quadraticCurveTo(cx, GY - h - 18, cx + 8, GY - h);
      for (let i = 8; i >= 0; i--) { const yy = GY - 6 - (h * i) / 8; ctx.lineTo(cx + 13 + Math.cos(t * 28 + i) * 3 + i * 0.6, yy); }
      ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      ell(ctx, cx, GY - h * 0.5, 5, h * 0.4); ctx.fillStyle = G[3]; ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(e.x - 4, GY + 2); ctx.quadraticCurveTo(e.x + 2, GY - 16, cx, GY - 13); ctx.quadraticCurveTo(e.x + e.w - 2, GY - 16, e.x + e.w + 4, GY + 2); ctx.closePath();
    fs(ctx, V[0], V[1], 2.4);
    ell(ctx, cx, GY - 12, 10, 3.6); ctx.fillStyle = e.warn || e.fh > 1 ? V[3] : V[2]; ctx.fill();
    if (e.warn) {
      ctx.fillStyle = V[3];
      for (let i = 0; i < 3; i++) { const k = (t * 3 + i / 3) % 1; circ(ctx, cx - 6 + i * 6, GY - 14 - k * 22, 3 * (1 - k) + 1); ctx.fill(); }
    }
  };

  A.fireball = function (ctx, e, t, th) {
    if (e.y > GY + 50) return;
    const c = (th && th.fire) || BASE.fire;
    ctx.save(); ctx.translate(e.x, e.y);
    const d = e.dir;
    ctx.beginPath(); ctx.moveTo(-12, 0);
    ctx.quadraticCurveTo(-8, 26 * -d, 0, 30 * -d + Math.sin(t * 30) * 3);
    ctx.quadraticCurveTo(8, 26 * -d, 12, 0); ctx.closePath();
    ctx.fillStyle = c[3]; ctx.fill();
    circ(ctx, 0, 0, e.r); fs(ctx, c[0], c[2], 2.4);
    circ(ctx, -3, -3, e.r * 0.55); ctx.fillStyle = c[1]; ctx.fill();
    ctx.fillStyle = c[4];
    ell(ctx, -5, -1, 1.8, 2.8); ctx.fill(); ell(ctx, 3, -1, 1.8, 2.8); ctx.fill();
    ctx.strokeStyle = c[4]; ctx.lineWidth = 1.6; line(ctx, -8, -6, -3, -4.5); line(ctx, 6, -6, 1, -4.5);
    ctx.restore();
  };

  /* ---------------- signs, banners and the finish ---------------- */
  const SIGN_TEXT = { jump: 'JUMP', spring: 'BOING', moving: 'TIMING', slide: 'SLIDE', stomp: 'BOP', rock: 'LOOK UP', geyser: 'WAIT IT OUT', double: '2× JUMP' };
  A.sign = function (ctx, e, t) {
    const x = e.x;
    rr(ctx, x - 4, GY - 66, 8, 66, 3); fs(ctx, '#9C6640', '#4A2A14', 2);
    rr(ctx, x - 40, GY - 116, 80, 54, 10); fs(ctx, '#FFF4DE', '#4A2A14', 2.6);
    ctx.save(); ctx.translate(x, GY - 98);
    ctx.fillStyle = '#2B1D4A'; ctx.strokeStyle = '#2B1D4A'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const k = e.kind, bob = Math.sin(t * 5) * 2;
    const arrowUp = (ax, ay) => { ctx.beginPath(); ctx.moveTo(ax - 6, ay + 3); ctx.lineTo(ax, ay - 4); ctx.lineTo(ax + 6, ay + 3); ctx.stroke(); };
    if (k === 'jump' || k === 'double' || k === 'spring') {
      arrowUp(-2, -2 + bob);
      if (k === 'double') arrowUp(-2, -9 + bob);
      if (k === 'spring') { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, 10); ctx.lineTo(20, 6); ctx.lineTo(14, 2); ctx.lineTo(20, -2); ctx.stroke(); }
    } else if (k === 'slide' || k === 'stomp') {
      ctx.beginPath(); ctx.moveTo(-8, -6 + bob); ctx.lineTo(-2, 2 + bob); ctx.lineTo(4, -6 + bob); ctx.stroke();
      if (k === 'slide') { ctx.fillRect(-18, -12, 36, 3); }
    } else if (k === 'moving') {
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, -5); ctx.lineTo(-14, 0); ctx.lineTo(-9, 5); ctx.moveTo(9, -5); ctx.lineTo(14, 0); ctx.lineTo(9, 5); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(11, 6); ctx.lineTo(-11, 6); ctx.closePath(); ctx.fillStyle = '#FFD23F'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#2B1D4A'; ctx.fillRect(-1.3, -6, 2.6, 7); circ(ctx, 0, 3.4, 1.5); ctx.fill();
    }
    ctx.restore();
    ctx.font = '13px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#2B1D4A';
    ctx.fillText(SIGN_TEXT[e.kind] || '', x, GY - 74);
  };

  A.finishBack = function (ctx, x, t) {
    for (const px of [x - 96, x + 82]) {
      rr(ctx, px, GY - 236, 14, 236, 6);
      const g = ctx.createLinearGradient(px, 0, px + 14, 0); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#D9DEF2');
      fs(ctx, g, '#2B1D4A', 2.4);
      ctx.fillStyle = '#FF4F8B';
      for (let yy = GY - 220; yy < GY - 10; yy += 34) { ctx.beginPath(); ctx.moveTo(px, yy); ctx.lineTo(px + 14, yy - 8); ctx.lineTo(px + 14, yy + 6); ctx.lineTo(px, yy + 14); ctx.fill(); }
    }
    const cols = ['#FF4F8B', '#FFC93C', '#3DB8FF', '#7EE07A', '#B47CFF'];
    for (let i = 0; i < 5; i++) {
      const bx = x - 140 + i * 18 + (i > 2 ? 230 : 0), by = GY - 280 - (i % 2) * 22 + Math.sin(t * 2 + i) * 6;
      ctx.strokeStyle = 'rgba(43,29,74,.5)'; ctx.lineWidth = 1.2; line(ctx, bx, by + 18, i > 2 ? x + 88 : x - 90, GY - 230);
      ell(ctx, bx, by, 12, 15); fs(ctx, cols[i], U.shade(cols[i], -0.45), 2);
      ell(ctx, bx - 4, by - 5, 3, 5, -0.4); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fill();
    }
  };
  A.finishFront = function (ctx, x, t) {
    rr(ctx, x - 112, GY - 268, 224, 48, 14); fs(ctx, '#FFFFFF', '#2B1D4A', 3);
    ctx.save(); rr(ctx, x - 112, GY - 268, 224, 48, 14); ctx.clip();
    for (let i = 0; i < 28; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) { ctx.fillStyle = '#2B1D4A'; ctx.fillRect(x - 112 + i * 8, GY - 268 + j * 8, 8, 8); }
    ctx.restore();
    ctx.font = '26px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = '#FFFFFF'; ctx.strokeText('FINISH', x, GY - 235);
    ctx.fillStyle = '#FF4F8B'; ctx.fillText('FINISH', x, GY - 235);
    // waving flag on top
    rr(ctx, x - 2, GY - 330, 4, 64, 2); ctx.fillStyle = '#2B1D4A'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 2, GY - 328);
    for (let i = 0; i <= 10; i++) ctx.lineTo(x + 2 + i * 4.4, GY - 328 + Math.sin(t * 6 - i * 0.6) * 3 * (i / 10));
    for (let i = 10; i >= 0; i--) ctx.lineTo(x + 2 + i * 4.4, GY - 300 + Math.sin(t * 6 - i * 0.6) * 3 * (i / 10));
    ctx.closePath(); fs(ctx, '#FFC93C', '#8A4A00', 2);
    // finish line on the ground
    ctx.save(); ctx.beginPath(); ctx.rect(x - 8, GY - 2, 16, 40); ctx.clip();
    for (let j = 0; j < 6; j++) for (let i = 0; i < 2; i++) { ctx.fillStyle = (i + j) % 2 ? '#2B1D4A' : '#FFFFFF'; ctx.fillRect(x - 8 + i * 8, GY - 2 + j * 7, 8, 7); }
    ctx.restore();
  };

  /* ---------------- scenery ---------------- */
  function slots(x0, x1, S, seed, fn) {
    const i0 = Math.floor(x0 / S) - 1, i1 = Math.ceil(x1 / S) + 1;
    for (let i = i0; i <= i1; i++) {
      const h1 = U.hash(i * 1.37 + seed), h2 = U.hash(i * 2.11 + seed * 1.3), h3 = U.hash(i * 3.73 + seed * 0.7);
      fn(i, i * S + h1 * S * 0.6, h1, h2, h3);
    }
  }
  function hills(ctx, x0, x1, base, waves, bottom) {
    ctx.beginPath();
    ctx.moveTo(x0 - 40, bottom);
    for (let x = x0 - 40; x <= x1 + 40; x += 20) {
      let y = base;
      for (const w of waves) y -= w[0] * Math.sin(x / w[1] + w[2]);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(x1 + 40, bottom);
    ctx.closePath();
  }
  function cloud(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    circ(ctx, x, y, 26 * s); ctx.fill();
    circ(ctx, x + 30 * s, y + 6 * s, 20 * s); ctx.fill();
    circ(ctx, x - 30 * s, y + 8 * s, 18 * s); ctx.fill();
    circ(ctx, x + 10 * s, y - 12 * s, 20 * s); ctx.fill();
    rr(ctx, x - 44 * s, y + 4 * s, 92 * s, 22 * s, 11 * s); ctx.fill();
  }
  A.cloud = cloud;

  function mountains(ctx, R, f, S, seed, base, hMin, hMax, col, cap) {
    const [x0, x1] = R.lay(f);
    slots(x0, x1, S, seed, (i, x, h1, h2) => {
      const h = hMin + h2 * (hMax - hMin), hw = h * (0.85 + h1 * 0.4);
      ctx.beginPath();
      ctx.moveTo(x - hw, base);
      ctx.quadraticCurveTo(x - hw * 0.35, base - h * 0.75, x - 14, base - h + 6);
      ctx.quadraticCurveTo(x, base - h - 6, x + 14, base - h + 6);
      ctx.quadraticCurveTo(x + hw * 0.35, base - h * 0.75, x + hw, base);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, base - h, 0, base);
      g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
      ctx.fillStyle = g; ctx.fill();
      if (cap) {
        ctx.beginPath();
        ctx.moveTo(x - hw * 0.3, base - h * 0.7);
        ctx.quadraticCurveTo(x - 14, base - h + 2, x, base - h - 2);
        ctx.quadraticCurveTo(x + 14, base - h + 2, x + hw * 0.3, base - h * 0.7);
        for (let k = 0; k < 4; k++) { const px = x + hw * 0.3 - (k + 1) * (hw * 0.15); ctx.quadraticCurveTo(px + hw * 0.075, base - h * 0.62 + (k % 2) * 8, px, base - h * 0.7); }
        ctx.closePath();
        ctx.fillStyle = cap; ctx.fill();
      }
    });
  }

  function lollipop(ctx, x, base, s, h1) {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 3 * s, base - 120 * s, 6 * s, 120 * s);
    const cols = [['#FF5C8A', '#FFD1E0'], ['#5CC8FF', '#D6F1FF'], ['#B47CFF', '#EBDDFF'], ['#FFC93C', '#FFF2C4']];
    const c = cols[Math.floor(h1 * 4) % 4];
    circ(ctx, x, base - 140 * s, 30 * s); ctx.fillStyle = c[0]; ctx.fill();
    ctx.strokeStyle = c[1]; ctx.lineWidth = 6 * s;
    ctx.beginPath();
    for (let a = 0; a < 10; a += 0.25) { const r = a * 2.8 * s; ctx.lineTo(x + Math.cos(a) * r, base - 140 * s + Math.sin(a) * r); }
    ctx.stroke();
  }

  function palm(ctx, x, base, s, t, h1) {
    ctx.strokeStyle = '#6B4423'; ctx.lineWidth = 10 * s; ctx.lineCap = 'round';
    const tx = x + 30 * s * (h1 - 0.3), ty = base - 170 * s;
    ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + 4 * s, base - 90 * s, tx, ty); ctx.stroke();
    ctx.fillStyle = '#1E8A4E';
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.55 + Math.sin(t * 1.2 + i + x) * 0.04;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(40 * s, -16 * s, 78 * s, 10 * s); ctx.quadraticCurveTo(40 * s, 0, 0, 0); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#7A4A28'; circ(ctx, tx - 4 * s, ty + 6 * s, 6 * s); ctx.fill(); circ(ctx, tx + 6 * s, ty + 8 * s, 6 * s); ctx.fill();
  }

  function pine(ctx, x, base, s, col, snow) {
    ctx.fillStyle = '#6B4A2E'; ctx.fillRect(x - 4 * s, base - 16 * s, 8 * s, 18 * s);
    for (let k = 0; k < 3; k++) {
      const w = (34 - k * 9) * s, y = base - 14 * s - k * 24 * s;
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x, y - 44 * s); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
      if (snow) {
        ctx.beginPath(); ctx.moveTo(x - w * 0.42, y - 25 * s); ctx.lineTo(x, y - 44 * s); ctx.lineTo(x + w * 0.42, y - 25 * s);
        ctx.quadraticCurveTo(x, y - 19 * s, x - w * 0.42, y - 25 * s); ctx.fillStyle = snow; ctx.fill();
      }
    }
  }
  function cactus(ctx, x, base, s, col, hi) {
    ctx.fillStyle = col;
    rr(ctx, x - 8 * s, base - 84 * s, 16 * s, 86 * s, 8 * s); ctx.fill();
    rr(ctx, x - 26 * s, base - 58 * s, 10 * s, 28 * s, 5 * s); ctx.fill();
    rr(ctx, x - 26 * s, base - 38 * s, 22 * s, 9 * s, 4.5 * s); ctx.fill();
    rr(ctx, x + 16 * s, base - 70 * s, 10 * s, 26 * s, 5 * s); ctx.fill();
    rr(ctx, x + 4 * s, base - 52 * s, 22 * s, 9 * s, 4.5 * s); ctx.fill();
    ctx.fillStyle = hi; ctx.fillRect(x - 2 * s, base - 78 * s, 3 * s, 70 * s);
  }
  function crystalCluster(ctx, x, base, s, col, ph) {
    const glow = 0.5 + Math.sin(ph * 1.5) * 0.2;
    ctx.fillStyle = U.rgba(col, 0.12 + 0.12 * glow); circ(ctx, x, base - 20 * s, 42 * s); ctx.fill();
    for (const [dx, hh, a] of [[-14, 30, -0.35], [0, 50, 0], [13, 36, 0.3], [24, 22, 0.55]]) {
      ctx.save(); ctx.translate(x + dx * s, base); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(-6 * s, 0); ctx.lineTo(-5 * s, -hh * s * 0.8); ctx.lineTo(0, -hh * s); ctx.lineTo(5 * s, -hh * s * 0.8); ctx.lineTo(6 * s, 0); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(-2 * s, -hh * s * 0.75, 2 * s, hh * s * 0.6);
      ctx.restore();
    }
  }
  function deadTree(ctx, x, base, s, col) {
    ctx.strokeStyle = col; ctx.lineCap = 'round';
    ctx.lineWidth = 9 * s; line(ctx, x, base, x + 4 * s, base - 80 * s);
    ctx.lineWidth = 5 * s; line(ctx, x + 3 * s, base - 50 * s, x - 26 * s, base - 78 * s); line(ctx, x + 4 * s, base - 70 * s, x + 30 * s, base - 100 * s);
    ctx.lineWidth = 3 * s; line(ctx, x - 16 * s, base - 66 * s, x - 22 * s, base - 96 * s); line(ctx, x + 18 * s, base - 84 * s, x + 34 * s, base - 82 * s); line(ctx, x + 4 * s, base - 80 * s, x + 2 * s, base - 110 * s);
  }
  function skyline(ctx, x0, x1, S, seed, base, hMin, hMax, col, win) {
    slots(x0, x1, S, seed, (i, x, h1, h2, h3) => {
      const w = S * (0.55 + h1 * 0.35), h = hMin + h2 * (hMax - hMin);
      ctx.fillStyle = col; ctx.fillRect(x, base - h, w, h + 400);
      if (h3 > 0.6) ctx.fillRect(x + w * 0.4, base - h - 24, 3, 24);
      ctx.fillStyle = win;
      for (let yy = base - h + 12; yy < base - 10; yy += 20) {
        for (let xx = x + 8; xx < x + w - 10; xx += 16) if (U.hash(xx * 0.13 + yy * 0.71 + seed) > 0.55) ctx.fillRect(xx, yy, 6, 9);
      }
    });
  }
  function starsField(ctx, R, f, seed, a, t) {
    const [x0, x1] = R.lay(f);
    slots(x0, x1, 34, seed, (i, x, h1, h2) => {
      const y = R.top + h2 * (GY - 140 - R.top);
      const tw = t ? 0.55 + 0.45 * Math.sin(t * 2 + i * 1.7) : 1;
      ctx.fillStyle = 'rgba(255,255,255,' + (a * (0.35 + h1 * 0.65) * tw) + ')';
      const sz = 1.2 + h1 * 1.6;
      ctx.fillRect(x, y, sz, sz);
    });
  }
  function planet(ctx, x, y) {
    const r = 46;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,220,180,.55)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.8, r * 0.42, -0.3, Math.PI, TAU); ctx.stroke();
    const g = ctx.createRadialGradient(x - 14, y - 16, 6, x, y, r); g.addColorStop(0, '#FFD9A6'); g.addColorStop(1, '#D9643A');
    circ(ctx, x, y, r); ctx.fillStyle = g; ctx.fill();
    ctx.save(); circ(ctx, x, y, r); ctx.clip();
    ctx.fillStyle = 'rgba(150,60,40,.3)';
    ell(ctx, x, y - 12, r * 1.2, 6, -0.3); ctx.fill(); ell(ctx, x + 6, y + 14, r * 1.2, 4, -0.3); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.8, r * 0.42, -0.3, 0, Math.PI); ctx.stroke();
    ctx.restore();
  }
  function castleSil(ctx, x, base, s) {
    cloud(ctx, x, base + 10 * s, 2.2 * s, 'rgba(255,255,255,.85)');
    const wall = 'rgba(160,140,230,.9)', roof = 'rgba(255,120,190,.9)';
    ctx.fillStyle = wall; ctx.fillRect(x - 60 * s, base - 70 * s, 120 * s, 72 * s);
    for (let k = -60; k < 60; k += 16) ctx.fillRect(x + k * s, base - 80 * s, 8 * s, 10 * s);
    for (const [dx, w, h] of [[-80, 26, 120], [54, 26, 130], [-15, 30, 162]]) {
      ctx.fillStyle = wall; ctx.fillRect(x + dx * s, base - h * s, w * s, h * s);
      ctx.beginPath(); ctx.moveTo(x + (dx - 4) * s, base - h * s); ctx.lineTo(x + (dx + w / 2) * s, base - (h + 40) * s); ctx.lineTo(x + (dx + w + 4) * s, base - h * s); ctx.closePath();
      ctx.fillStyle = roof; ctx.fill();
      ctx.fillStyle = '#FFD45C'; ctx.fillRect(x + (dx + w / 2) * s, base - (h + 58) * s, 2 * s, 18 * s);
      ctx.beginPath(); ctx.moveTo(x + (dx + w / 2 + 2) * s, base - (h + 58) * s); ctx.lineTo(x + (dx + w / 2 + 16) * s, base - (h + 53) * s); ctx.lineTo(x + (dx + w / 2 + 2) * s, base - (h + 48) * s); ctx.fill();
    }
    ctx.fillStyle = 'rgba(90,72,216,.8)'; ctx.beginPath(); ctx.arc(x, base - 14 * s, 13 * s, Math.PI, 0); ctx.lineTo(x + 13 * s, base); ctx.lineTo(x - 13 * s, base); ctx.closePath(); ctx.fill();
  }

  /** Draws everything behind the ground for a theme. */
  A.backdrop = function (ctx, R, th, t) {
    const top = R.top;
    // sky
    let [x0, x1] = R.lay(0);
    const sg = ctx.createLinearGradient(0, Math.min(top, -100), 0, GY);
    sg.addColorStop(0, th.sky[0]); sg.addColorStop(0.55, th.sky[1]); sg.addColorStop(1, th.sky[2]);
    ctx.fillStyle = sg; ctx.fillRect(x0 - 2, top - 2, x1 - x0 + 4, R.bot - top + 4);

    // sun / moon / planet / rainbow (screen-anchored)
    const sx = x0 + R.viewW * 0.8, sy = Math.max(top + 90, 90);
    if (th.rainbow) {
      ctx.save(); ctx.globalAlpha = 0.35; ctx.lineWidth = 16;
      const rc = ['#FF6B8B', '#FFB04D', '#FFE45C', '#6EE07A', '#5CC8FF', '#9C7CFF'];
      rc.forEach((c, i) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(x0 + R.viewW * 0.35, GY + 120, 420 - i * 16, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); });
      ctx.restore();
    }
    if (th.planet) planet(ctx, sx, sy + 10);
    else if (!th.noSun) {
      const glow = ctx.createRadialGradient(sx, sy, 10, sx, sy, th.sunGlow);
      glow.addColorStop(0, U.rgba(th.sun, 0.55)); glow.addColorStop(1, U.rgba(th.sun, 0));
      ctx.fillStyle = glow; circ(ctx, sx, sy, th.sunGlow); ctx.fill();
      circ(ctx, sx, sy, th.sunSize); ctx.fillStyle = th.sun; ctx.fill();
      if (th.scene === 'lava' || th.moon) {
        ctx.fillStyle = th.moon ? 'rgba(120,100,140,.25)' : 'rgba(255,200,120,.35)';
        circ(ctx, sx - th.sunSize * 0.3, sy - th.sunSize * 0.2, th.sunSize * 0.22); ctx.fill();
        circ(ctx, sx + th.sunSize * 0.3, sy + th.sunSize * 0.25, th.sunSize * 0.14); ctx.fill();
      }
    }

    switch (th.scene) {
      case 'meadow':
        mountains(ctx, R, 0.08, 520, 1, GY - 40, 170, 270, th.far, '#FFFFFF');
        drawClouds(ctx, R, t, 0.16, 'rgba(255,255,255,.95)');
        [x0, x1] = R.lay(0.3);
        hills(ctx, x0, x1, GY - 95, [[24, 140, 0], [14, 61, 2]], R.bot); ctx.fillStyle = th.hillA; ctx.fill();
        slots(x0, x1, 260, 7, (i, x, h1, h2) => {
          const y = GY - 95 - 24 * Math.sin(x / 140) - 14 * Math.sin(x / 61 + 2);
          ctx.fillStyle = U.shade(th.hillA, -0.08); circ(ctx, x, y + 6, 18 + h2 * 10); ctx.fill(); circ(ctx, x + 16, y + 10, 12); ctx.fill();
        });
        [x0, x1] = R.lay(0.5);
        hills(ctx, x0, x1, GY - 38, [[18, 110, 1], [10, 43, 0.5]], R.bot); ctx.fillStyle = th.hillB; ctx.fill();
        slots(x0, x1, 300, 11, (i, x, h1, h2) => {
          if (h2 < 0.35) return;
          const y = GY - 38 - 18 * Math.sin(x / 110 + 1) - 10 * Math.sin(x / 43 + 0.5), s = 0.8 + h1 * 0.5;
          ctx.fillStyle = th.trunk; ctx.fillRect(x - 5 * s, y - 50 * s, 10 * s, 52 * s);
          ctx.fillStyle = th.tree; circ(ctx, x, y - 66 * s, 30 * s); ctx.fill(); circ(ctx, x - 22 * s, y - 50 * s, 20 * s); ctx.fill(); circ(ctx, x + 22 * s, y - 52 * s, 22 * s); ctx.fill();
          ctx.fillStyle = th.treeHi; circ(ctx, x - 8 * s, y - 76 * s, 12 * s); ctx.fill();
          ctx.fillStyle = th.treeDots; circ(ctx, x + 12 * s, y - 60 * s, 3.4 * s); ctx.fill(); circ(ctx, x - 14 * s, y - 48 * s, 3 * s); ctx.fill();
        });
        break;
      case 'candy':
        mountains(ctx, R, 0.08, 480, 3, GY - 40, 160, 250, th.far, '#FFFFFF');
        drawClouds(ctx, R, t, 0.16, 'rgba(255,240,250,.95)');
        [x0, x1] = R.lay(0.3);
        hills(ctx, x0, x1, GY - 90, [[22, 120, 0.4], [12, 55, 1]], R.bot); ctx.fillStyle = th.hillA; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        slots(x0, x1, 70, 5, (i, x, h1, h2) => { const y = GY - 70 + h2 * 60 - 22 * Math.sin(x / 120 + 0.4); circ(ctx, x, y, 4 + h1 * 4); ctx.fill(); });
        [x0, x1] = R.lay(0.5);
        hills(ctx, x0, x1, GY - 36, [[16, 100, 2], [8, 37, 0]], R.bot); ctx.fillStyle = th.hillB; ctx.fill();
        slots(x0, x1, 260, 13, (i, x, h1, h2) => {
          if (h2 < 0.3) return;
          const y = GY - 30 - 16 * Math.sin(x / 100 + 2);
          if (h1 < 0.5) lollipop(ctx, x, y + 6, 0.7 + h2 * 0.4, h1 * 7);
          else {
            ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 9; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, y - 90); ctx.arc(x + 16, y - 90, 16, Math.PI, 0); ctx.stroke();
            ctx.strokeStyle = '#FF3B5C'; ctx.lineWidth = 9; ctx.setLineDash([9, 9]); ctx.stroke(); ctx.setLineDash([]);
          }
        });
        break;
      case 'jungle':
        mountains(ctx, R, 0.07, 420, 5, GY - 60, 180, 280, th.far, null);
        ctx.fillStyle = 'rgba(226,255,208,.35)'; [x0, x1] = R.lay(0); ctx.fillRect(x0, GY - 140, x1 - x0, 140);
        [x0, x1] = R.lay(0.25);
        hills(ctx, x0, x1, GY - 120, [[26, 90, 0], [16, 37, 1.5], [8, 17, 0.2]], R.bot); ctx.fillStyle = th.hillA; ctx.fill();
        [x0, x1] = R.lay(0.45);
        slots(x0, x1, 240, 17, (i, x, h1, h2) => { if (h2 > 0.4) palm(ctx, x, GY + 10, 0.8 + h1 * 0.5, t, h1); });
        hills(ctx, x0, x1, GY - 40, [[14, 80, 1], [10, 29, 0.3]], R.bot); ctx.fillStyle = th.hillB; ctx.fill();
        [x0, x1] = R.lay(0.6);
        ctx.strokeStyle = '#1E7A44'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        slots(x0, x1, 180, 23, (i, x, h1, h2) => {
          if (h1 < 0.4) return;
          const len = 60 + h2 * 140, sw = Math.sin(t * 1.4 + i) * 6;
          ctx.beginPath(); ctx.moveTo(x, top - 10); ctx.quadraticCurveTo(x + sw, top + len * 0.6, x + sw * 0.5, top + len); ctx.stroke();
          ctx.fillStyle = '#3FBF5F';
          for (let k = 1; k < 5; k++) { const yy = top + (len * k) / 5; ell(ctx, x + sw * (k / 6) + 6, yy, 7, 3.5, 0.6); ctx.fill(); }
        });
        break;
      case 'lava':
        [x0, x1] = R.lay(0.07);
        slots(x0, x1, 560, 9, (i, x, h1, h2) => {
          const h = 180 + h2 * 110, hw = 170 + h1 * 90, base = GY - 30;
          ctx.beginPath(); ctx.moveTo(x - hw, base); ctx.lineTo(x - 30, base - h); ctx.lineTo(x + 30, base - h); ctx.lineTo(x + hw, base); ctx.closePath();
          const g = ctx.createLinearGradient(0, base - h, 0, base); g.addColorStop(0, '#4A1A4F'); g.addColorStop(1, th.far[0]);
          ctx.fillStyle = g; ctx.fill();
          ctx.strokeStyle = 'rgba(255,122,61,.75)'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(x - 10, base - h + 2); ctx.quadraticCurveTo(x - 30, base - h * 0.6, x - 50 - h1 * 30, base - h * 0.2); ctx.stroke();
          const sm = (t * 0.25 + h1) % 1;
          ctx.fillStyle = 'rgba(60,30,70,' + (0.5 * (1 - sm)) + ')';
          circ(ctx, x + sm * 30, base - h - 20 - sm * 80, 20 + sm * 30); ctx.fill();
        });
        [x0, x1] = R.lay(0.3);
        ctx.beginPath(); ctx.moveTo(x0 - 40, R.bot);
        for (let x = Math.floor((x0 - 40) / 40) * 40; x <= x1 + 40; x += 40) ctx.lineTo(x, GY - 70 - U.hash(Math.floor(x / 40) * 1.7) * 60);
        ctx.lineTo(x1 + 40, R.bot); ctx.closePath(); ctx.fillStyle = th.hillA; ctx.fill();
        [x0, x1] = R.lay(0.5);
        hills(ctx, x0, x1, GY - 30, [[12, 70, 0], [8, 23, 1]], R.bot); ctx.fillStyle = th.hillB; ctx.fill();
        slots(x0, x1, 220, 31, (i, x, h1, h2) => {
          if (h2 < 0.45) return;
          const h = 60 + h1 * 80;
          ctx.beginPath(); ctx.moveTo(x - 16, GY - 20); ctx.lineTo(x - 4, GY - 20 - h); ctx.lineTo(x + 4, GY - 20 - h * 0.85); ctx.lineTo(x + 16, GY - 20); ctx.closePath();
          ctx.fillStyle = '#1C0E1C'; ctx.fill();
          ctx.strokeStyle = 'rgba(255,138,61,.6)'; ctx.lineWidth = 2; line(ctx, x - 2, GY - 24, x - 4, GY - 20 - h * 0.7);
        });
        break;
      case 'sky':
        [x0, x1] = R.lay(0.06);
        slots(x0, x1, 600, 19, (i, x, h1, h2) => {
          const y = 150 + h2 * 140, w = 90 + h1 * 80;
          ctx.fillStyle = 'rgba(169,139,219,.75)';
          ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.3, y + 70 + h1 * 30, x, y + 110); ctx.quadraticCurveTo(x + w * 0.3, y + 70, x + w, y); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(121,217,139,.85)'; rr(ctx, x - w - 6, y - 12, w * 2 + 12, 20, 10); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x + w * 0.4, y + 6, 6, 60 + h2 * 40);
        });
        drawClouds(ctx, R, t, 0.14, 'rgba(255,255,255,.75)');
        [x0, x1] = R.lay(0.3);
        slots(x0, x1, 220, 29, (i, x, h1, h2) => cloud(ctx, x, GY - 20 - h2 * 60, 1.6 + h1 * 1.2, 'rgba(255,255,255,.85)'));
        [x0, x1] = R.lay(0.5);
        slots(x0, x1, 200, 37, (i, x, h1, h2) => cloud(ctx, x, GY + 10 - h2 * 30, 1.4 + h1, 'rgba(238,242,255,.95)'));
        break;
      case 'snow':
        mountains(ctx, R, 0.08, 500, 61, GY - 40, 190, 300, th.far, '#FFFFFF');
        drawClouds(ctx, R, t, 0.16, 'rgba(255,255,255,.9)');
        [x0, x1] = R.lay(0.3);
        hills(ctx, x0, x1, GY - 100, [[26, 150, 0.5], [12, 57, 1.2]], R.bot); ctx.fillStyle = th.hillA; ctx.fill();
        slots(x0, x1, 120, 63, (i, x, h1, h2) => {
          if (h2 < 0.5) return;
          const y = GY - 100 - 26 * Math.sin(x / 150 + 0.5) - 12 * Math.sin(x / 57 + 1.2);
          pine(ctx, x, y + 12, 0.55 + h1 * 0.3, U.shade(th.tree, 0.2), '#FFFFFF');
        });
        [x0, x1] = R.lay(0.5);
        hills(ctx, x0, x1, GY - 40, [[18, 120, 2], [9, 45, 0.3]], R.bot); ctx.fillStyle = th.hillB; ctx.fill();
        slots(x0, x1, 170, 67, (i, x, h1, h2) => {
          if (h2 < 0.3) return;
          const y = GY - 40 - 18 * Math.sin(x / 120 + 2) - 9 * Math.sin(x / 45 + 0.3);
          pine(ctx, x, y + 10, 0.9 + h1 * 0.5, th.tree, '#FFFFFF');
        });
        break;
      case 'desert':
        [x0, x1] = R.lay(0.08);
        slots(x0, x1, 520, 71, (i, x, h1, h2) => {
          const h = 120 + h2 * 110, w = 120 + h1 * 160, base = GY - 30;
          ctx.beginPath(); ctx.moveTo(x - w - 40, base); ctx.lineTo(x - w, base - h); ctx.lineTo(x + w, base - h); ctx.lineTo(x + w + 40, base); ctx.closePath();
          const g = ctx.createLinearGradient(0, base - h, 0, base); g.addColorStop(0, th.far[0]); g.addColorStop(1, th.far[1]);
          ctx.fillStyle = g; ctx.fill();
          ctx.fillStyle = 'rgba(120,50,30,.18)'; ctx.fillRect(x - w + 10, base - h * 0.62, 2 * w - 20, 8); ctx.fillRect(x - w + 24, base - h * 0.35, 2 * w - 48, 6);
        });
        drawClouds(ctx, R, t, 0.16, 'rgba(255,245,230,.7)');
        [x0, x1] = R.lay(0.3);
        hills(ctx, x0, x1, GY - 70, [[30, 160, 0], [10, 60, 2]], R.bot); ctx.fillStyle = th.hillA; ctx.fill();
        [x0, x1] = R.lay(0.5);
        hills(ctx, x0, x1, GY - 30, [[16, 130, 1], [6, 40, 0]], R.bot); ctx.fillStyle = th.hillB; ctx.fill();
        slots(x0, x1, 230, 73, (i, x, h1, h2) => {
          if (h2 < 0.35) return;
          const y = GY - 30 - 16 * Math.sin(x / 130 + 1) - 6 * Math.sin(x / 40);
          cactus(ctx, x, y + 8, 0.8 + h1 * 0.5, th.tree, th.treeHi);
        });
        break;
      case 'cave': {
        [x0, x1] = R.lay(0.08);
        slots(x0, x1, 300, 81, (i, x, h1, h2) => {
          const h = 120 + h2 * 160, w = 18 + h1 * 20, col = h1 > 0.5 ? th.tree : th.treeHi;
          ctx.fillStyle = U.rgba(col, 0.06); circ(ctx, x, GY - 40 - h * 0.5, h * 0.36); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x - w, GY - 30); ctx.lineTo(x - w * 0.7, GY - 30 - h); ctx.lineTo(x, GY - 50 - h); ctx.lineTo(x + w * 0.7, GY - 30 - h); ctx.lineTo(x + w, GY - 30); ctx.closePath();
          ctx.fillStyle = U.rgba(col, 0.32); ctx.fill();
        });
        [x0, x1] = R.lay(0.25);
        ctx.fillStyle = th.far[0];
        ctx.beginPath(); ctx.moveTo(x0 - 40, top - 10);
        for (let x = Math.floor((x0 - 40) / 36) * 36; x <= x1 + 40; x += 36) {
          const hh = 30 + U.hash(Math.floor(x / 36) * 2.3) * 110;
          ctx.lineTo(x, top + 20); ctx.lineTo(x + 18, top + 20 + hh);
        }
        ctx.lineTo(x1 + 40, top + 20); ctx.lineTo(x1 + 40, top - 10); ctx.closePath(); ctx.fill();
        hills(ctx, x0, x1, GY - 90, [[30, 70, 0], [14, 23, 1]], R.bot); ctx.fillStyle = th.hillA; ctx.fill();
        [x0, x1] = R.lay(0.5);
        hills(ctx, x0, x1, GY - 34, [[14, 60, 2], [8, 21, 0.4]], R.bot); ctx.fillStyle = th.hillB; ctx.fill();
        slots(x0, x1, 190, 83, (i, x, h1, h2) => { if (h2 >= 0.35) crystalCluster(ctx, x, GY - 26, 0.7 + h1 * 0.6, h1 > 0.5 ? th.tree : th.treeHi, t + i); });
        break;
      }
      case 'beach': {
        const sea = GY - 150;
        const g = ctx.createLinearGradient(0, sea, 0, GY); g.addColorStop(0, th.far[0]); g.addColorStop(1, th.far[1]);
        ctx.fillStyle = g; ctx.fillRect(x0 - 2, sea, x1 - x0 + 4, R.bot - sea);
        ctx.fillStyle = 'rgba(255,240,200,.5)';
        for (let k = 0; k < 6; k++) { const yy = sea + 8 + k * 14, ww = 80 - k * 9; ctx.fillRect(sx - ww / 2 + Math.sin(t * 2 + k) * 6, yy, ww, 3); }
        [x0, x1] = R.lay(0.06);
        ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2;
        slots(x0, x1, 90, 91, (i, x, h1, h2) => { const yy = sea + 20 + h2 * 110; line(ctx, x + Math.sin(t + i) * 8, yy, x + 30 + Math.sin(t + i) * 8, yy); });
        slots(x0, x1, 900, 93, (i, x, h1) => { if (h1 < 0.5) return; ctx.fillStyle = 'rgba(46,120,110,.55)'; ctx.beginPath(); ctx.ellipse(x, sea + 2, 90, 26, 0, Math.PI, 0); ctx.fill(); });
        drawClouds(ctx, R, t, 0.12, 'rgba(255,230,240,.85)');
        [x0, x1] = R.lay(0.45);
        hills(ctx, x0, x1, GY - 26, [[10, 140, 1], [5, 40, 0]], R.bot); ctx.fillStyle = th.hillA; ctx.fill();
        slots(x0, x1, 260, 97, (i, x, h1, h2) => { if (h2 > 0.35) palm(ctx, x, GY - 18, 0.75 + h1 * 0.45, t, h1); });
        break;
      }
      case 'city': {
        starsField(ctx, R, 0.02, 101, 0.6, t);
        [x0, x1] = R.lay(0.1);
        skyline(ctx, x0, x1, 110, 103, GY - 40, 80, 230, th.far[1], 'rgba(255,214,102,.35)');
        [x0, x1] = R.lay(0.3);
        skyline(ctx, x0, x1, 90, 107, GY - 10, 60, 170, th.hillA, 'rgba(34,242,255,.5)');
        [x0, x1] = R.lay(0.5);
        slots(x0, x1, 320, 109, (i, x, h1, h2) => {
          ctx.strokeStyle = '#4A4466'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          line(ctx, x, GY + 4, x, GY - 120);
          ctx.beginPath(); ctx.moveTo(x, GY - 120); ctx.quadraticCurveTo(x + 4, GY - 132, x + 24, GY - 128); ctx.stroke();
          const on = 0.6 + 0.4 * Math.sin(t * 3 + i);
          ctx.fillStyle = 'rgba(255,240,200,' + on + ')'; circ(ctx, x + 24, GY - 124, 5); ctx.fill();
          ctx.fillStyle = 'rgba(255,240,200,' + 0.1 * on + ')';
          ctx.beginPath(); ctx.moveTo(x + 18, GY - 124); ctx.lineTo(x + 30, GY - 124); ctx.lineTo(x + 64, GY); ctx.lineTo(x - 16, GY); ctx.closePath(); ctx.fill();
          if (h2 > 0.5) {
            const c = h1 > 0.5 ? th.tree : th.treeHi;
            rr(ctx, x + 50, GY - 190 - h1 * 40, 70, 30, 8);
            ctx.fillStyle = U.rgba(c, 0.22 + 0.15 * Math.sin(t * 5 + i)); ctx.fill();
            ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke();
          }
        });
        break;
      }
      case 'spooky': {
        starsField(ctx, R, 0.02, 113, 0.7, t);
        mountains(ctx, R, 0.08, 460, 115, GY - 30, 140, 220, th.far, null);
        [x0, x1] = R.lay(0.28);
        hills(ctx, x0, x1, GY - 80, [[22, 120, 0], [10, 47, 1]], R.bot); ctx.fillStyle = th.hillA; ctx.fill();
        slots(x0, x1, 230, 117, (i, x, h1, h2) => {
          if (h2 < 0.4) return;
          const y = GY - 80 - 22 * Math.sin(x / 120) - 10 * Math.sin(x / 47 + 1);
          deadTree(ctx, x, y + 10, 0.7 + h1 * 0.4, U.shade(th.hillA, -0.35));
        });
        [x0, x1] = R.lay(0.5);
        hills(ctx, x0, x1, GY - 34, [[12, 90, 2], [6, 31, 0.5]], R.bot); ctx.fillStyle = th.hillB; ctx.fill();
        slots(x0, x1, 260, 119, (i, x, h1, h2) => {
          const y = GY - 34 - 12 * Math.sin(x / 90 + 2) - 6 * Math.sin(x / 31 + 0.5);
          if (h2 > 0.55) deadTree(ctx, x, y + 6, 1 + h1 * 0.5, th.tree);
          else if (h2 > 0.25) {
            ctx.fillStyle = '#2A1F3A';
            ctx.beginPath(); ctx.moveTo(x - 12, y + 8); ctx.lineTo(x - 12, y - 14); ctx.arc(x, y - 14, 12, Math.PI, 0); ctx.lineTo(x + 12, y + 8); ctx.closePath(); ctx.fill();
          }
        });
        [x0, x1] = R.lay(0.6);
        ctx.fillStyle = 'rgba(200,180,230,.12)';
        slots(x0, x1, 160, 121, (i, x, h1) => { ell(ctx, x + Math.sin(t * 0.4 + i) * 30, GY - 10, 140 + h1 * 60, 22); ctx.fill(); });
        break;
      }
      case 'storm': {
        [x0, x1] = R.lay(0.05);
        const fl = Math.floor(t / 2.7), ph = t % 2.7;
        if (ph < 0.18 && !R.reduced) {
          let xx = x0 + U.hash(fl * 3.3) * R.viewW, yy = Math.max(top, 0) + 30;
          ctx.strokeStyle = 'rgba(255,250,200,' + (1 - ph / 0.18) + ')'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(xx, yy);
          for (let k = 0; k < 6; k++) { yy += 50; xx += (U.hash(fl * 7 + k) - 0.5) * 60; ctx.lineTo(xx, yy); }
          ctx.stroke();
        }
        [[0.1, 131, 120, 2.2, 'rgba(58,67,102,.9)'], [0.2, 133, 200, 1.8, 'rgba(76,86,124,.9)']].forEach(([f, seed, yb, sc, col]) => {
          [x0, x1] = R.lay(f);
          slots(x0, x1, 260, seed, (i, x, h1, h2) => cloud(ctx, x, yb + h2 * 80 + (R.top < 0 ? R.top * 0.3 : 0), sc + h1, col));
        });
        [x0, x1] = R.lay(0.3);
        slots(x0, x1, 220, 135, (i, x, h1, h2) => cloud(ctx, x, GY - 30 - h2 * 60, 1.6 + h1 * 1.2, 'rgba(150,158,190,.85)'));
        [x0, x1] = R.lay(0.5);
        slots(x0, x1, 200, 137, (i, x, h1, h2) => cloud(ctx, x, GY + 10 - h2 * 30, 1.4 + h1, 'rgba(190,196,220,.95)'));
        break;
      }
      case 'space': {
        starsField(ctx, R, 0.01, 141, 1, t);
        starsField(ctx, R, 0.03, 143, 0.7, t * 1.3);
        [x0, x1] = R.lay(0.02);
        slots(x0, x1, 700, 145, (i, x, h1, h2) => {
          const cy = 150 + h2 * 100, g = ctx.createRadialGradient(x, cy, 10, x, cy, 220);
          g.addColorStop(0, h1 > 0.5 ? 'rgba(180,80,255,.18)' : 'rgba(60,200,255,.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; circ(ctx, x, cy, 220); ctx.fill();
        });
        [x0, x1] = R.lay(0.25);
        hills(ctx, x0, x1, GY - 80, [[20, 130, 0.3], [12, 37, 1]], R.bot); ctx.fillStyle = th.hillA; ctx.fill();
        [x0, x1] = R.lay(0.5);
        hills(ctx, x0, x1, GY - 30, [[12, 100, 1], [6, 29, 0]], R.bot); ctx.fillStyle = th.hillB; ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.2)';
        slots(x0, x1, 120, 147, (i, x, h1, h2) => { ell(ctx, x, GY - 20 + h2 * 20, 14 + h1 * 16, 4 + h1 * 3); ctx.fill(); });
        slots(x0, x1, 900, 149, (i, x, h1) => {
          if (h1 < 0.5) return;
          ctx.strokeStyle = '#8A86A6'; ctx.lineWidth = 4; line(ctx, x, GY - 20, x, GY - 140); line(ctx, x - 20, GY - 110, x + 20, GY - 110);
          ctx.fillStyle = Math.sin(t * 4 + i) > 0 ? '#FF4D6D' : '#5A2030'; circ(ctx, x, GY - 144, 5); ctx.fill();
        });
        break;
      }
      case 'castle':
        [x0, x1] = R.lay(0.06);
        slots(x0, x1, 640, 151, (i, x, h1, h2) => castleSil(ctx, x, 260 + h2 * 60, 0.8 + h1 * 0.5));
        drawClouds(ctx, R, t, 0.14, 'rgba(255,255,255,.8)');
        [x0, x1] = R.lay(0.3);
        slots(x0, x1, 220, 153, (i, x, h1, h2) => cloud(ctx, x, GY - 20 - h2 * 60, 1.6 + h1 * 1.2, 'rgba(255,255,255,.85)'));
        [x0, x1] = R.lay(0.5);
        slots(x0, x1, 200, 155, (i, x, h1, h2) => cloud(ctx, x, GY + 10 - h2 * 30, 1.4 + h1, 'rgba(245,240,255,.95)'));
        break;
    }
  };

  function drawClouds(ctx, R, t, f, col) {
    const [x0, x1] = R.lay(f);
    const drift = t * 10;
    slots(x0 - drift, x1 - drift, 380, 41, (i, x, h1, h2) => cloud(ctx, x + drift, 60 + h2 * 150 + (R.top < 0 ? R.top * 0.3 : 0), 0.7 + h1 * 0.7, col));
  }

  /** The pit below the ground surface, visible through gaps. */
  A.abyss = function (ctx, R, th, t) {
    const [x0, x1] = R.lay(1);
    if (th.abyss === 'lava') {
      const g = ctx.createLinearGradient(0, GY, 0, GY + 70); g.addColorStop(0, '#3A1430'); g.addColorStop(1, '#7A2030');
      ctx.fillStyle = g; ctx.fillRect(x0, GY - 2, x1 - x0, 72);
      ctx.beginPath(); ctx.moveTo(x0, R.bot);
      for (let x = Math.floor(x0 / 16) * 16; x <= x1 + 16; x += 16) ctx.lineTo(x, GY + 66 + Math.sin(x / 30 + t * 3) * 4);
      ctx.lineTo(x1 + 16, R.bot); ctx.closePath();
      const lg = ctx.createLinearGradient(0, GY + 60, 0, 620); lg.addColorStop(0, '#FFD45C'); lg.addColorStop(0.25, '#FF7A2A'); lg.addColorStop(1, '#C22A1A');
      ctx.fillStyle = lg; ctx.fill();
      ctx.fillStyle = 'rgba(255,240,170,.8)';
      slots(x0, x1, 90, 51, (i, x, h1) => { const k = (t * 0.8 + h1) % 1; circ(ctx, x, GY + 80 - k * 6, 5 * (1 - k)); ctx.fill(); });
      return;
    }
    const g = ctx.createLinearGradient(0, GY, 0, 600);
    g.addColorStop(0, th.pit[0]); g.addColorStop(1, th.pit[1]);
    ctx.fillStyle = g; ctx.fillRect(x0, GY - 2, x1 - x0, R.bot - GY);
    if (th.abyss === 'clouds') slots(x0, x1, 160, 53, (i, x, h1) => cloud(ctx, x, 590 + h1 * 30, 1.2, 'rgba(255,255,255,.35)'));
    else if (th.abyss === 'water') {
      ctx.beginPath(); ctx.moveTo(x0, R.bot);
      for (let x = Math.floor(x0 / 16) * 16; x <= x1 + 16; x += 16) ctx.lineTo(x, GY + 52 + Math.sin(x / 34 + t * 2.4) * 4);
      ctx.lineTo(x1 + 16, R.bot); ctx.closePath();
      const wg = ctx.createLinearGradient(0, GY + 50, 0, 600); wg.addColorStop(0, '#5CC8FF'); wg.addColorStop(1, '#0B5A8C');
      ctx.fillStyle = wg; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
      slots(x0, x1, 70, 159, (i, x) => { const yy = GY + 52 + Math.sin(x / 34 + t * 2.4) * 4; line(ctx, x - 10, yy, x + 10, yy); });
    } else if (th.abyss === 'void') {
      slots(x0, x1, 30, 157, (i, x, h1, h2) => {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + h1 * 0.6) + ')';
        ctx.fillRect(x, GY + 20 + h2 * (R.bot - GY - 30), 1.5 + h1, 1.5 + h1);
      });
    }
  };

  /** One solid ground segment, clipped to the visible range. */
  A.ground = function (ctx, R, th, seg, t) {
    const [v0, v1] = R.lay(1);
    const a = Math.max(seg[0], v0 - 40), b = Math.min(seg[1], v1 + 40);
    if (b <= a) return;
    const gs = th.groundStyle;
    const realL = seg[0] >= v0 - 40, realR = seg[1] <= v1 + 40;
    const r = 12;
    ctx.beginPath();
    ctx.moveTo(a, R.bot);
    if (realL) { ctx.lineTo(a, GY + r); ctx.quadraticCurveTo(a, GY, a + r, GY); } else ctx.lineTo(a, GY);
    if (realR) { ctx.lineTo(b - r, GY); ctx.quadraticCurveTo(b, GY, b, GY + r); } else ctx.lineTo(b, GY);
    ctx.lineTo(b, R.bot);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, GY, 0, 600); g.addColorStop(0, th.ground[0]); g.addColorStop(1, th.ground[1]);
    ctx.fillStyle = g; ctx.fill();
    if (gs === 'cloud') {
      ctx.fillStyle = th.top;
      for (let x = Math.floor(a / 34) * 34; x <= b; x += 34) { if (x < a - 10 || x > b + 10) continue; circ(ctx, U.clamp(x, a + 12, b - 12), GY + 6, 16 + U.hash(x) * 6); ctx.fill(); }
      ctx.fillStyle = U.rgba(th.topDk, 0.35);
      for (let x = Math.floor(a / 40) * 40; x <= b; x += 40) { if (x > a + 6 && x < b - 6) { circ(ctx, x, GY + 70 + U.hash(x * 3) * 40, 10 + U.hash(x) * 10); ctx.fill(); } }
      return;
    }
    ctx.save(); ctx.clip();
    ctx.fillStyle = U.rgba(th.stone, 0.55);
    for (let x = Math.floor(a / 46) * 46; x <= b; x += 46) {
      const h1 = U.hash(x * 0.37), h2 = U.hash(x * 0.71);
      ell(ctx, x + h1 * 30, GY + 40 + h2 * 80, 7 + h1 * 7, 4 + h2 * 4); ctx.fill();
    }
    if (gs === 'frosting') {
      const sp = ['#FFFFFF', '#5CC8FF', '#FFE45C', '#8CFF8A', '#B88CFF'];
      for (let x = Math.floor(a / 18) * 18; x <= b; x += 18) {
        const h1 = U.hash(x), h2 = U.hash(x * 1.9);
        ctx.fillStyle = sp[Math.floor(h1 * 5)];
        ctx.save(); ctx.translate(x, GY + 30 + h2 * 100); ctx.rotate(h1 * 3); ctx.fillRect(-4, -1.5, 8, 3); ctx.restore();
      }
    }
    if (th.crackGround) {
      ctx.strokeStyle = U.rgba(th.crackGround, 0.7); ctx.lineWidth = 2.4;
      for (let x = Math.floor(a / 90) * 90; x <= b; x += 90) {
        const h1 = U.hash(x * 1.3);
        ctx.beginPath(); ctx.moveTo(x, GY + 10); ctx.lineTo(x + 12 + h1 * 10, GY + 34); ctx.lineTo(x + 4, GY + 56); ctx.lineTo(x + 22, GY + 80); ctx.stroke();
      }
    }
    if (th.craters) {
      for (let x = Math.floor(a / 110) * 110; x <= b; x += 110) {
        const h1 = U.hash(x * 0.9), h2 = U.hash(x * 2.3);
        ell(ctx, x + h1 * 60, GY + 30 + h2 * 70, 16 + h1 * 12, 6 + h1 * 4); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fill();
        ell(ctx, x + h1 * 60, GY + 28 + h2 * 70, 14 + h1 * 10, 3); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
      }
    }
    if (gs === 'neon') {
      ctx.fillStyle = U.rgba(th.topDk, 0.45);
      for (let x = Math.floor(a / 80) * 80; x <= b; x += 80) ctx.fillRect(x, GY + 46, 40, 4);
    }
    ctx.restore();
    // edges at gaps
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    if (realL) ctx.fillRect(a, GY + 10, 6, R.bot - GY);
    if (realR) ctx.fillRect(b - 6, GY + 10, 6, R.bot - GY);
    // top band
    const ta = a - (realL ? 3 : 0), tb = b + (realR ? 3 : 0);
    if (gs === 'lava' || gs === 'rock' || gs === 'neon') {
      rr(ctx, ta, GY - 3, tb - ta, 10, 5); ctx.fillStyle = th.top; ctx.fill();
      ctx.fillStyle = th.topDk; ctx.fillRect(ta + 4, GY + 6, tb - ta - 8, gs === 'neon' ? 3.5 : 2.5);
      if (gs === 'neon') { ctx.fillStyle = U.rgba(th.topDk, 0.25); ctx.fillRect(ta + 4, GY + 9, tb - ta - 8, 6); }
      if (gs === 'rock' && th.crackGround) {
        for (let x = Math.floor(a / 60) * 60; x <= b; x += 60) {
          const px = x + U.hash(x * 0.7) * 40; if (px < a + 8 || px > b - 8) continue;
          ctx.fillStyle = th.topDk; ctx.beginPath(); ctx.moveTo(px - 4, GY - 2); ctx.lineTo(px, GY - 12); ctx.lineTo(px + 4, GY - 2); ctx.fill();
        }
      }
      return;
    }
    ctx.beginPath();
    ctx.moveTo(ta, GY + 4);
    ctx.lineTo(ta, GY - 2);
    ctx.quadraticCurveTo(ta, GY - 5, ta + 5, GY - 5);
    ctx.lineTo(tb - 5, GY - 5);
    ctx.quadraticCurveTo(tb, GY - 5, tb, GY - 2);
    ctx.lineTo(tb, GY + 6);
    const step = gs === 'frosting' ? 22 : 16;
    for (let x = tb; x > ta; x -= step) {
      const nx = Math.max(ta, x - step);
      const drip = (gs === 'frosting' && U.hash(Math.floor(x / step)) > 0.65) || (gs === 'snow' && U.hash(Math.floor(x / step) * 1.7) > 0.8) ? 12 : 0;
      ctx.quadraticCurveTo((x + nx) / 2, GY + 14 + drip, nx, GY + 6);
    }
    ctx.closePath();
    ctx.fillStyle = th.top; ctx.fill();
    ctx.strokeStyle = th.topDk; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(ta + 6, GY - 3, tb - ta - 12, 2);
    if (gs === 'grass') {
      for (let x = Math.floor(a / 70) * 70; x <= b; x += 70) {
        const h1 = U.hash(x * 0.13), h2 = U.hash(x * 0.29);
        const px = x + h1 * 50;
        if (px < a + 8 || px > b - 8) continue;
        ctx.fillStyle = th.topDk;
        ctx.beginPath(); ctx.moveTo(px - 6, GY - 3); ctx.lineTo(px - 3, GY - 12); ctx.lineTo(px, GY - 3); ctx.lineTo(px + 3, GY - 14); ctx.lineTo(px + 6, GY - 3); ctx.fill();
        if (h2 > 0.55 && th.flowers.length) {
          const fc = th.flowers[Math.floor(h2 * 40) % th.flowers.length];
          ctx.strokeStyle = th.topDk; ctx.lineWidth = 1.6; line(ctx, px + 14, GY - 3, px + 14, GY - 14);
          ctx.fillStyle = fc; for (let k = 0; k < 5; k++) { circ(ctx, px + 14 + Math.cos(k * 1.26) * 3.6, GY - 16 + Math.sin(k * 1.26) * 3.6, 2.6); ctx.fill(); }
          ctx.fillStyle = '#FFC93C'; circ(ctx, px + 14, GY - 16, 2); ctx.fill();
        }
      }
    } else if (gs === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      for (let x = Math.floor(a / 54) * 54; x <= b; x += 54) {
        const px = x + U.hash(x * 0.31) * 30, tw = (Math.sin(t * 3 + x) + 1) / 2;
        if (px < a + 6 || px > b - 6 || tw < 0.6) continue;
        starPath(ctx, px, GY + 2, 3 * tw + 1, 0.8, 4); ctx.fill();
      }
    } else if (gs === 'sand') {
      for (let x = Math.floor(a / 64) * 64; x <= b; x += 64) {
        const px = x + U.hash(x * 0.53) * 40, h2 = U.hash(x * 1.1);
        if (px < a + 8 || px > b - 8) continue;
        ctx.fillStyle = h2 > 0.7 ? '#FFB3C7' : U.shade(th.topDk, -0.1);
        ell(ctx, px, GY - 2, h2 > 0.7 ? 4 : 3, h2 > 0.7 ? 3 : 2); ctx.fill();
      }
    }
  };

  /* ---------------- tiny looping demos for the stage intro card ---------------- */
  /** Draws a looping demo of one mechanic into a w x h box. The obstacle reaches the critter at loop phase 0.5. */
  A.demo = function (ctx, kind, t, w, h, critter, th) {
    const k = h / 130, W = w / k, base = 104;
    ctx.save();
    ctx.scale(k, k);
    const g = ctx.createLinearGradient(0, 0, 0, base); g.addColorStop(0, th.sky[1]); g.addColorStop(1, th.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 130);
    const LOOP = 2.4, c = (t % LOOP) / LOOP, px = Math.round(W * 0.32), span = W + 220;
    const ox = px + (0.5 - c) * span;
    let jumpY = 0, mode = 'run';
    const arc = (c0, c1, hgt) => {
      if (c <= c0 || c >= c1) return false;
      const u = (c - c0) / (c1 - c0);
      jumpY = -4 * hgt * u * (1 - u); mode = u < 0.5 ? 'jump' : 'fall';
      return true;
    };
    // ground (with a pit for the double-jump demo)
    const pit = kind === 'double' ? [ox - 20, ox + 150] : null;
    const groundFill = th.groundStyle === 'cloud' ? th.top : th.ground[0];
    ctx.fillStyle = groundFill;
    const gr = (a, b) => { ctx.fillRect(a, base, b - a, 30); ctx.fillStyle = th.top; ctx.fillRect(a, base - 3, b - a, 7); ctx.fillStyle = groundFill; };
    if (pit) { gr(0, Math.max(0, pit[0])); gr(Math.min(W, pit[1]), W); ctx.fillStyle = th.pit[0]; ctx.fillRect(pit[0], base + 2, pit[1] - pit[0], 30); }
    else gr(0, W);
    ctx.save();
    ctx.translate(0, base);
    if (kind === 'jump') {
      for (let i = 0; i < 2; i++) {
        ctx.beginPath(); ctx.moveTo(ox - 15 + i * 15, 0); ctx.lineTo(ox - 7.5 + i * 15, -24); ctx.lineTo(ox + i * 15, 0); ctx.closePath();
        fs(ctx, th.spike, th.spikeDk, 2);
      }
      arc(0.4, 0.66, 66);
    } else if (kind === 'spring') {
      ctx.save(); ctx.translate(0, -GY); A.spring(ctx, { x: ox - 18, w: 36, squish: c > 0.5 && c < 0.62 ? (0.62 - c) / 0.12 : 0 }); ctx.restore();
      arc(0.5, 0.96, 96);
    } else if (kind === 'slide') {
      ctx.fillStyle = '#1F7A4A'; ctx.fillRect(ox, -140, 70, 104);
      rr(ctx, ox - 5, -42, 80, 22, 11); fs(ctx, '#8A5A3B', '#3B2412', 2);
      if (c > 0.42 && c < 0.72) mode = 'slide';
    } else if (kind === 'stomp') {
      const squashed = c > 0.5;
      ctx.save(); ctx.translate(ox, 0); ctx.scale(0.8, 0.8);
      A.beetle(ctx, { x: -22, y: -30, w: 44, h: 30, walk: t, squash: squashed ? 1 : 0 }, th, t);
      ctx.restore();
      if (!arc(0.32, 0.5, 64)) arc(0.5, 0.72, 50);
    } else if (kind === 'rock') {
      const fall = U.clamp((c - 0.08) / 0.22, 0, 1);
      if (c < 0.3) { ctx.save(); ctx.translate(0, -GY); A.rockWarn(ctx, { x: ox }, t, true); ctx.restore(); }
      ctx.save(); ctx.translate(0, -GY); A.rock(ctx, { x: ox, y: GY - 18 - (1 - fall) * 140, r: 18, rot: fall * 3 }, th); ctx.restore();
      arc(0.42, 0.64, 62);
    } else if (kind === 'double') {
      if (c > 0.42 && c <= 0.55) { const u = (c - 0.55) / 0.13; jumpY = -52 * (1 - u * u); mode = 'jump'; }
      else if (c > 0.55 && c < 0.86) {
        if (c < 0.64) { const u = (c - 0.64) / 0.09; jumpY = -98 + 46 * u * u; mode = 'jump'; }
        else { const u = (c - 0.64) / 0.22; jumpY = -98 * (1 - u * u); mode = 'fall'; }
      }
    }
    ctx.translate(px, jumpY);
    ctx.scale(0.85, 0.85);
    A.critter(ctx, critter, { mode, phase: t * 14, t, blink: false });
    if (kind === 'double' && c > 0.55 && c < 0.62) { ctx.globalAlpha = 1 - (c - 0.55) / 0.07; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ell(ctx, 0, 6, 26, 7); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
  };
})(typeof window !== 'undefined' ? window : globalThis);
