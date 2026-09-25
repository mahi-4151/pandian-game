/* ==========================================================================
   PANDYA · Shared Lives (hearts)
   --------------------------------------------------------------------------
   ONE lives pool for the WHOLE game, exactly like a real mobile game:

     • The player owns 5 hearts (lives).
     • Every heart broken in a battle takes 1 HOUR to refill.
       → 1 heart  = 1 hour, 5 hearts = 5 hours for a full refill.
     • Hearts keep regenerating in real time even while the player is on the
       map / task pages or the browser is closed (the refill runs on saved
       timestamps, not on a running timer).
     • Every page reads the same pool, so the hearts shown on the map are the
       hearts the battle actually uses.

   Storage shape:  { lives: 0..5, nextAt: <timestamp when the next heart is full> }
   nextAt = 0 means the pool is full (or nothing left to regenerate).

   This file only ADDS the shared lives store. It does not change any
   existing game logic by itself.
   ========================================================================== */

(function () {
  const KEY = 'pandya.lives';
  const NOTICE_KEY = 'pandya.lives.notice';
  const MAX = 5;
  const MAX_HEARTS = 5;
  const REGEN_MS = 3600000; // exactly 1 hour per heart
  const CHANNEL = 'pandya.lives';

  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && Number.isFinite(saved.lives)) {
        return {
          lives: Math.min(MAX, Math.max(0, Math.floor(saved.lives))),
          nextAt: Number.isFinite(saved.nextAt) && saved.nextAt > 0 ? saved.nextAt : 0,
        };
      }
    } catch (e) {
      /* storage unavailable / corrupted → full hearts */
    }
    return { lives: MAX, nextAt: 0 };
  }

  function write(state) {
    const payload = {
      lives: Math.min(MAX, Math.max(0, Math.floor(state.lives))),
      nextAt: state.lives < MAX && Number.isFinite(state.nextAt) && state.nextAt > 0 ? state.nextAt : 0,
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(payload));
    } catch (e) {
      /* private mode etc. — lives still live for this session */
    }
    session = payload;
    notify(payload);
    return payload;
  }

  let session = null;
  let channel = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => {
      session = null;
    };
  } catch (e) {
    channel = null;
  }

  function notify(state) {
    try {
      window.dispatchEvent(new CustomEvent('pandya-lives-change', { detail: snapshot(state) }));
    } catch (e) { /* ignore */ }
    try {
      channel?.postMessage(snapshot(state));
    } catch (e) { /* ignore */ }
  }

  function snapshot(state, now = Date.now()) {
    const lives = Math.min(MAX, Math.max(0, Math.floor(state.lives)));
    const nextAt = lives < MAX && state.nextAt > 0 ? state.nextAt : 0;
    return {
      lives,
      max: MAX,
      nextAt,
      msToNext: lives < MAX && nextAt > 0 ? Math.max(0, nextAt - now) : 0,
    };
  }

  /* Applies every refill that is due, then returns the live state.
     Offline time is calculated from saved timestamps, so closing the
     browser for 2 hours restores the correct number of hearts. */
  function current() {
    const now = Date.now();
    const state = session ? { lives: session.lives, nextAt: session.nextAt } : read();
    let changed = false;

    while (state.lives < MAX && state.nextAt > 0 && now >= state.nextAt) {
      state.lives += 1;
      // One hour until the heart AFTER this one (or done when full).
      state.nextAt = state.lives < MAX ? state.nextAt + REGEN_MS : 0;
      changed = true;
    }
    if (state.lives >= MAX && state.nextAt !== 0) {
      state.nextAt = 0;
      changed = true;
    }
    if (changed) write(state);
    session = { lives: state.lives, nextAt: state.nextAt };

    return snapshot(session, now);
  }

  /* Break one heart (called by the battle when the player dies).
     A battle WIN must never call this. Never goes below 0. */
  function lose() {
    const live = current(); // refill anything already due first
    if (live.lives <= 0) {
      recordNotice(0);
      return current();
    }
    const state = { lives: live.lives - 1, nextAt: live.nextAt };
    if (state.lives < MAX && !state.nextAt) state.nextAt = Date.now() + REGEN_MS;
    write(state);
    recordNotice(state.lives);
    return current();
  }

  function recordNotice(hearts) {
    try {
      localStorage.setItem(NOTICE_KEY, JSON.stringify({ hearts: Math.max(0, hearts), at: Date.now() }));
    } catch (e) { /* ignore */ }
  }

  /* Map page reads this once after a lost battle, then clears it. */
  function consumeLossNotice() {
    try {
      const raw = localStorage.getItem(NOTICE_KEY);
      if (!raw) return null;
      localStorage.removeItem(NOTICE_KEY);
      const data = JSON.parse(raw);
      if (data && Number.isFinite(data.hearts)) return Math.max(0, Math.floor(data.hearts));
    } catch (e) { /* ignore */ }
    return null;
  }

  /* Full hearts again (RESET GAME). */
  function reset() {
    session = { lives: MAX, nextAt: 0 };
    write(session);
    try { localStorage.removeItem(NOTICE_KEY); } catch (e) { /* ignore */ }
    return current();
  }

  window.PandyaLives = { MAX, MAX_HEARTS, REGEN_MS, current, lose, reset, consumeLossNotice };

  // Keep multiple open pages in sync.
  window.addEventListener('storage', (event) => {
    if (!event.key || event.key === KEY) session = null;
  });
})();
