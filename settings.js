/* ==========================================================================
   PANDYA · Shared Game Settings
   --------------------------------------------------------------------------
   ONE settings store for the WHOLE game. Whatever the player sets on the
   settings page (index.html — the first page) is saved in localStorage and
   re-applied on EVERY page, so the whole game always looks/behaves exactly
   as configured:

     • Every settings popup toggle/select that has a  data-setting="key"
       attribute is kept in sync with the saved value automatically.
     • Fullscreen is a game-wide state: turn it ON once and every page of
       the game opens fullscreen (browsers need one tap/keypress to allow
       fullscreen after a page load, so the restore happens on the player's
       first interaction). Turning it off anywhere turns it off everywhere,
       including the browser's own ESC exit.

   This file only ADDS persistence + sync. It does not change any existing
   page logic.
   ========================================================================== */

(function () {
  const KEY = 'pandya.settings';

  /* Defaults = exactly how the settings popup ships. */
  const DEFAULTS = {
    sound: true,
    music: true,
    graphics: 'Ultra',
    fullscreen: false,
    fullsize: false,
    language: 'English',
    notifications: true,
    vibration: true,
    autosave: true,
    hints: true,
    battleEffects: true,
    subtitles: true,
  };

  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && typeof saved === 'object') return { ...DEFAULTS, ...saved };
    } catch (e) {
      /* storage unavailable / corrupted → defaults */
    }
    return { ...DEFAULTS };
  }

  let state = read();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* private mode etc. — settings still live for this session */
    }
  }

  /* Push the saved values into every settings control on the page. */
  function applyToUi() {
    document.querySelectorAll('[data-setting]').forEach((el) => {
      const key = el.dataset.setting;
      if (!(key in state)) return;
      if (el.tagName === 'SELECT') {
        el.value = state[key];
      } else {
        el.classList.toggle('active', !!state[key]);
      }
    });
  }

  /* ------------------------------------------------------------- syncing */

  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-setting]');
    if (!el) return;
    const key = el.dataset.setting;
    if (!(key in state)) return;

    if (key === 'fullscreen' || key === 'fullsize') {
      // Persist immediately so every other page of the game re-applies it.
      const want = el.classList.contains('active');
      state.fullscreen = want;
      if ('fullsize' in state) state.fullsize = want;
      save();
      // The page's own click handler starts/exits fullscreen; the
      // `fullscreenchange` listener below stores the real state. This
      // timeout only catches requests the browser refused.
      setTimeout(() => {
        if (!document.fullscreenElement && !el.classList.contains('active')) {
          state.fullscreen = false;
          save();
          applyToUi();
        }
      }, 450);
      return;
    }

    state[key] = el.tagName === 'SELECT' ? el.value : el.classList.contains('active');
    save();
  });

  document.addEventListener('change', (event) => {
    const el = event.target.closest('select[data-setting]');
    if (!el) return;
    const key = el.dataset.setting;
    if (!(key in state)) return;
    state[key] = el.value;
    save();
  });

  /* Keep every toggle honest when fullscreen is entered/exited — including
     the browser's own ESC key or exit button. */
  document.addEventListener('fullscreenchange', () => {
    state.fullscreen = !!document.fullscreenElement;
    save();
    applyToUi();
  });

  /* ------------------------------------------------fullscreen everywhere */

  // Browsers only allow fullscreen inside a user gesture, so a fresh page
  // cannot enter fullscreen by itself. If the player turned fullscreen ON in
  // the settings, the first tap/keypress on this page puts the game back
  // into fullscreen — on every page of the whole game.
  function requestFullscreen() {
    const request = document.documentElement.requestFullscreen?.();
    if (request && typeof request.catch === 'function') request.catch(() => {});
  }

  function onFirstGesture() {
    if ((state.fullscreen || state.fullsize) && !document.fullscreenElement) requestFullscreen();
  }

  window.addEventListener('pointerdown', onFirstGesture, { capture: true });
  window.addEventListener('keydown', onFirstGesture, { capture: true });
  window.addEventListener('touchstart', onFirstGesture, { capture: true });

  /* --------------------------------------------------------- public API */

  window.PandyaSettings = {
    all() {
      return { ...state };
    },
    get(key) {
      return state[key];
    },
    set(key, value) {
      if (!(key in DEFAULTS)) return;
      state[key] = value;
      save();
      applyToUi();
    },
  };

  window.addEventListener('storage', (event) => {
    if (event.key === KEY) {
      state = read();
      applyToUi();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyToUi);
  } else {
    applyToUi();
  }
})();
