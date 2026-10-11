/* Zoomies! — gameplay input: keyboard, mouse, touch taps, swipes and on-screen buttons.
   Presses are queued as edges and holds are tracked per source, so the simulation sees
   exactly one "pressed" per tap no matter how many frames it lasts. */
(function (root) {
  'use strict';
  const Z = root.Z;
  const JUMP_KEYS = { Space: 1, ArrowUp: 1, KeyW: 1 };
  const DOWN_KEYS = { ArrowDown: 1, KeyS: 1 };

  const IN = {
    enabled: false,
    jq: 0, dq: 0, swipe: false,
    jHeld: new Set(), dHeld: new Set(), track: new Map(),
    touchSeen: false, onTouch: null,

    isJumpKey: (code) => !!JUMP_KEYS[code],
    isDownKey: (code) => !!DOWN_KEYS[code],

    pressJump(id) { if (!this.jHeld.has(id)) { this.jHeld.add(id); if (this.enabled) this.jq++; } },
    releaseJump(id) { this.jHeld.delete(id); },
    pressDown(id, swipe) {
      if (!this.dHeld.has(id)) { this.dHeld.add(id); if (this.enabled) { this.dq++; if (swipe) this.swipe = true; } }
    },
    releaseDown(id) { this.dHeld.delete(id); },

    keyDown(code) {
      if (JUMP_KEYS[code]) this.pressJump('k' + code);
      else if (DOWN_KEYS[code]) this.pressDown('k' + code, false);
    },
    keyUp(code) {
      if (JUMP_KEYS[code]) this.releaseJump('k' + code);
      else if (DOWN_KEYS[code]) this.releaseDown('k' + code);
    },

    /** Returns this frame's input and clears the queued presses. */
    consume() {
      const o = { jumpPressed: this.jq > 0, downPressed: this.dq > 0, swipe: this.swipe, jumpHeld: this.jHeld.size > 0, downHeld: this.dHeld.size > 0 };
      this.jq = 0; this.dq = 0; this.swipe = false;
      return o;
    },
    held() { return { jumpPressed: false, downPressed: false, swipe: false, jumpHeld: this.jHeld.size > 0, downHeld: this.dHeld.size > 0 }; },
    clearQueue() { this.jq = 0; this.dq = 0; this.swipe = false; },
    releaseAll() { this.jHeld.clear(); this.dHeld.clear(); this.track.clear(); this.clearQueue(); },

    markTouch() {
      if (!this.touchSeen) { this.touchSeen = true; if (this.onTouch) this.onTouch(); }
    },

    /** The play surface: tap or click to jump (hold for higher), swipe down to slide. */
    bindSurface(el) {
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.pointerType !== 'mouse') this.markTouch();
        if (!this.enabled) return;
        e.preventDefault();
        this.pressJump('p' + e.pointerId);
        this.track.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), swiped: false });
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
      });
      el.addEventListener('pointermove', (e) => {
        const tr = this.track.get(e.pointerId);
        if (!tr || tr.swiped) return;
        const dx = e.clientX - tr.x, dy = e.clientY - tr.y;
        if (dy > 30 && dy > Math.abs(dx) * 1.2 && performance.now() - tr.t < 450) {
          tr.swiped = true;
          this.releaseJump('p' + e.pointerId);
          this.pressDown('s' + e.pointerId, true);
        }
      });
      const end = (e) => {
        this.track.delete(e.pointerId);
        this.releaseJump('p' + e.pointerId);
        this.releaseDown('s' + e.pointerId);
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    },

    /** On-screen touch buttons. */
    bindButton(el, kind) {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.markTouch();
        if (!this.enabled) return;
        if (kind === 'jump') this.pressJump('b' + e.pointerId); else this.pressDown('b' + e.pointerId, false);
        el.classList.add('is-pressed');
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
      });
      const end = (e) => {
        if (kind === 'jump') this.releaseJump('b' + e.pointerId); else this.releaseDown('b' + e.pointerId);
        el.classList.remove('is-pressed');
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    },
  };

  Z.Input = IN;
})(typeof window !== 'undefined' ? window : globalThis);
