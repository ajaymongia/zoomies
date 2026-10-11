# Zoomies!

A colourful endless-runner/platformer for the browser. Pick an animal, type your name, then dash, hop,
slide and bop your way through five hand-scripted stages. Built with plain HTML5 Canvas and
JavaScript: no frameworks, no build step, no image or audio files. All art is drawn in code and all
sound is synthesised with Web Audio, so the game works offline once loaded.

## Run it

- **Quickest:** open `index.html` in a browser (works from `file://`).
- **Local server (recommended while editing):** `python3 tools/dev-server.py 5391`, then visit
  http://localhost:5391. This server disables caching so edits show up on reload.

The display fonts (Lilita One, Baloo 2) come from Google Fonts. Without a connection the game falls
back to system rounded fonts and still plays normally.

## Controls

| Action | Keyboard | Mouse | Touch |
| --- | --- | --- | --- |
| Jump (hold = higher) | Space, ↑ or W | Click / hold | Tap / hold anywhere, or the Jump button |
| Double jump | Jump again in mid-air (Feather power-up, or always in Stage 5) | Click again | Tap again |
| Slide / fast-fall | ↓ or S (hold) | — | Swipe down, or hold the Slide button |
| Pause / resume | Esc or P | Pause button | Pause button |
| Mute sound effects | M | Sound button | Sound button |

The game auto-pauses when the window loses focus. Resuming plays a short 3-2-1 so you are ready.

**On phones** the game plays in landscape. Holding a phone upright shows a "Please rotate your phone"
screen; if a run is in progress it pauses, and turning the phone sideways resumes it automatically
with a 3-2-1. Tablets and desktops play in any orientation. A phone is a touch device whose shorter
screen side is under 600 CSS px (`isPhone` in `js/main.js`).

## The game

| Stage | World | New idea | Length |
| --- | --- | --- | --- |
| 1 | Sunny Meadow | Jumping, hold for height | ~480 m |
| 2 | Candy Canyon | Springs, moving and bouncy platforms, rolling gumballs | ~540 m |
| 3 | Jungle Dash | Sliding under overhangs, beetles and frogs you can bop | ~600 m |
| 4 | Lava Rush | Falling rocks (marked with a red !), timed geysers, fireball pits | ~640 m |
| 5 | Sky Adventure | Sky boots (double jump), birds, and a crumbling-cloud finale | ~700 m |

- **Hearts:** 3 per stage. Hazards cost a heart (with a short invulnerable blink); falling in a pit
  costs a heart and drops you back on safe ground ahead. A heart pickup appears in stages 3–5.
- **Power-ups:** Shield (blocks one hit or one fall), Magnet (pulls coins), Feather (double jump),
  Turbo (speed burst; nothing can hurt you and gaps get a rainbow floor).
- **Scoring:** 2 points per metre, coins 10, gems 100, stars 500, each obstacle passed 20, bopping a
  critter 100, a bonus of 100 for every 5 obstacles in a row. Completing a stage adds 300 per heart
  left, 1,000 for a flawless run and 750 for finding all three stars.
- **Rating:** 1 star for reaching the flag, +1 for collecting half the coins, +1 for losing no hearts.
- **Saved locally:** name, critter, unlocked stages, best score and stars per stage, sound/music and
  reduced-motion settings (`localStorage`). Total play time for the session lives in
  `sessionStorage`. Everything degrades gracefully when storage is blocked.

## Project layout

```
index.html            markup: icon sprite, HUD, touch controls, all screens
css/styles.css        interface styles (sticker look, responsive HUD, modals)
js/util.js            maths, seeded RNG, formatting, safe storage
js/config.js          physics tuning, critters, stage scripts, power-ups
js/level.js           stage builder: hand-designed sections placed by a seeded script
js/sim.js             simulation (no DOM): physics, collisions, scoring, events
js/art.js             every drawing: critters, obstacles, pickups, five themed worlds
js/render.js          camera, parallax, particles, pop-up text, screen effects
js/audio.js           synthesised sound effects and per-stage music loops
js/input.js           keyboard, mouse, tap, swipe and on-screen buttons
js/ui.js              DOM components: menu, HUD, intro, pause, results, game over, confetti
js/main.js            state machine, fixed-step loop, persistence, wiring
tools/verify-levels.js  plays every stage with a search bot to prove it is fair
tools/dev-server.py   no-cache static server
tools/art-sheet.html  visual QA sheet for all critter poses and obstacle skins (?p=critters|meadow|candy|jungle|lava|sky)
tools/build-artifact.py  writes dist/index.html for publishing as a claude.ai Artifact
```

### How it fits together

- `main.js` runs a state machine: `loading → menu → intro → countdown → playing ⇄ paused →
  completing → complete` or `dying → gameover`. Stage completion and game over can each fire only
  once per run; confetti is tied to the run that triggered it.
- Every frame is split into simulation steps of at most 1/120 s, so jump heights and timings are the
  same at 30, 60 or 144 Hz. Input presses are queued as edges, so a tap is never missed or doubled.
- The run timer lives in the simulation and only advances while playing; total session time only
  advances in the `playing` state, so pauses, menus and countdowns are excluded.
- Layouts are deterministic (seeded) so each stage can be learned. Gap widths, platform heights and
  spring distances are computed from the real jump physics at the speed you will be running there.

## Checking fairness

```
node tools/verify-levels.js        # all stages
node tools/verify-levels.js 3      # one stage
```

The bot only uses player inputs (run, slide, jump with a few hold lengths, timed double jumps),
decided 30 times a second, with power-ups disabled. A `PASS` means the stage can be cleared without
losing a heart. Run it after changing physics in `config.js` or sections in `level.js`.

## Tuning

- Physics: `Z.PHYS` in `js/config.js` (gravity, jump speed, coyote time, jump buffer, hitboxes).
- Difficulty per stage: `speed`, `breath` (free running between sections), `gapK` (gap width as a
  share of a full jump) and the `pool` weights in `Z.STAGES`.
- New obstacle: add a factory and a section in `level.js`, collision in `sim.js` (`hits`), and a
  drawing in `art.js`, then add it to a stage pool and re-run the verifier.

## Testing hooks

`window.Zoomies` exposes a few helpers for automated play-testing from the console:
`warp(fraction)`, `finish()`, `kill()`, `advance(seconds)`, plus `manual = true` (stop the real-time
clock so only `advance` moves the game) and `noAutoPause = true`.
