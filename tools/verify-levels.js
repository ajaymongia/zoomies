#!/usr/bin/env node
/* Plays every stage with a search bot that uses only player inputs. Decisions happen 30 times a
   second while grounded: keep running, slide, or jump with one of a few hold lengths (plus a
   timed double jump where the stage allows it). Power-ups are switched off, so a pass proves
   each stage can be cleared without losing a heart on skill alone.
   Usage: node tools/verify-levels.js [stageNumber]   */
'use strict';
const path = require('path');
for (const f of ['util', 'config', 'level', 'sim']) require(path.join(__dirname, '..', 'js', f + '.js'));
const Z = globalThis.Z;
const P = Z.PHYS;

Z.Sim.prototype.activate = function () {}; // no power-ups for the bot

const DT = 1 / 120, SUB = 4;
const HOLDS = [10, 0.22, 0.12, 0];
const DJ_AT = [0.2, 0.35, 0.5];
const DJ_HOLD = [10, 0];

function clone(sim) {
  const c = structuredClone(sim);
  Object.setPrototypeOf(c, Z.Sim.prototype);
  return c;
}

function failed(sim) { return sim.s.hits > 0 || sim.over || sim.p.state === 'respawn'; }

function step(sim, inp) {
  sim.step(DT, inp);
  sim.events.length = 0;
  return !failed(sim);
}

const NONE = { jumpPressed: false, jumpHeld: false, downPressed: false, downHeld: false, swipe: false };

/** Runs one move. Returns false on damage. */
function runMove(sim, m) {
  if (m.kind === 'run' || m.kind === 'slide') {
    const down = m.kind === 'slide';
    for (let i = 0; i < SUB; i++) {
      if (!step(sim, { jumpPressed: false, jumpHeld: false, downPressed: down && i === 0 && !sim.p.sliding, downHeld: down, swipe: false })) return false;
      if (sim.finished) return true;
    }
    return true;
  }
  // jump (or air drift when m.kind === 'air'), with optional double jump
  let t = 0;
  const startAir = m.kind === 'air';
  for (let i = 0; i < 360; i++) {
    const press = (!startAir && i === 0) || (m.dj != null && Math.abs(t - m.dj) < DT / 2);
    const held = (!startAir && t < m.h) || (m.dj != null && t >= m.dj && t - m.dj < m.djh);
    if (!step(sim, { jumpPressed: press, jumpHeld: held, downPressed: false, downHeld: false, swipe: false })) return false;
    if (sim.finished) return true;
    t += DT;
    if (sim.p.onGround && t > 0.03) return true;
  }
  return !failed(sim);
}

function moves(sim) {
  const list = [];
  const dbl = sim.canDouble();
  if (!sim.p.onGround) {
    list.push({ kind: 'air' });
    if (dbl && sim.p.airJumps > 0) for (const d of [0, 0.15, 0.3]) for (const h of DJ_HOLD) list.push({ kind: 'air', dj: d, djh: h });
    return list;
  }
  list.push({ kind: 'run' }, { kind: 'slide' });
  for (const h of HOLDS) {
    list.push({ kind: 'jump', h });
    if (dbl) for (const d of DJ_AT) for (const dh of DJ_HOLD) list.push({ kind: 'jump', h, dj: d, djh: dh });
  }
  return list;
}

function key(sim) {
  const p = sim.p;
  let gone = 0;
  for (const e of sim.dyn) if (e.gone || e.squash > 0 || e.dead || e.st === 2) gone++;
  return Math.round(sim.t * 30) + '|' + Math.round(p.x / 3) + '|' + Math.round(p.y) + '|' + Math.round(p.vy / 40) + '|' +
    (p.onGround ? 1 : 0) + (p.sliding ? 1 : 0) + p.airJumps + '|' + gone;
}

function verify(idx, budget) {
  const root = new Z.Sim(idx);
  const lenM = root.lengthM();
  const stack = [{ sim: root, opts: moves(root), oi: 0, key: key(root) }];
  const dead = new Set();
  let nodes = 0, furthest = 0, committed = 0;
  while (stack.length) {
    if (++nodes > budget) break;
    const top = stack[stack.length - 1];
    if (top.oi >= top.opts.length) { dead.add(top.key); stack.pop(); continue; }
    const m = top.opts[top.oi++];
    const s2 = clone(top.sim);
    if (!runMove(s2, m)) continue;
    if (s2.finished) return { ok: true, nodes, lenM, sim: s2 };
    const k = key(s2);
    if (dead.has(k)) continue;
    furthest = Math.max(furthest, s2.p.x);
    stack.push({ sim: s2, opts: moves(s2), oi: 0, key: k });
    if (stack.length > 240) { stack.shift(); committed++; } // no backtracking further than ~8 s
  }
  return { ok: false, nodes, lenM, at: Math.round((furthest - P.START_X) / P.M), budget: nodes > budget };
}

const only = process.argv[2] ? [Number(process.argv[2]) - 1] : Z.STAGES.map((_, i) => i);
let fails = 0;
for (const idx of only) {
  const st = Z.STAGES[idx];
  const lv = Z.buildLevel(idx);
  const kinds = {};
  for (const e of lv.ents) if (e.type !== 'coin') kinds[e.type] = (kinds[e.type] || 0) + 1;
  const t0 = Date.now();
  const r = verify(idx, 400000);
  const ms = Date.now() - t0;
  if (r.ok) {
    const s = r.sim.s;
    console.log(`PASS  Stage ${st.id} ${st.name.padEnd(14)} ${r.lenM} m, cleared flawlessly in ${r.sim.runTime.toFixed(1)} s` +
      ` | bot ${r.nodes} moves, ${ms} ms | dodged ${s.avoided}, coins ${s.coins}/${lv.totalCoins}, stars ${s.stars}/${lv.totalStars}`);
  } else {
    fails++;
    console.log(`FAIL  Stage ${st.id} ${st.name}: stuck near ${r.at} m of ${r.lenM} m${r.budget ? ' (search budget hit)' : ''}`);
  }
  console.log('      ' + Object.entries(kinds).map(([k, v]) => k + ':' + v).join('  '));
}
process.exit(fails ? 1 : 0);
