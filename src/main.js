import { Game } from './game/game.js';

const canvas = document.querySelector('#scene');
const game = new Game(canvas);

game.boot().catch((error) => {
  console.error(error);
  const text = document.querySelector('[data-load-text]');
  if (text) {
    text.textContent = 'The battlefield could not be summoned. Please reload.';
    text.style.color = '#ff9c8b';
  }
  // Never leave the player stuck on the loading veil.
  const loading = document.querySelector('[data-loading]');
  if (loading) {
    setTimeout(() => {
      loading.classList.add('is-fading');
      loading.hidden = true;
    }, 1800);
  }
});

// Handy for tuning from the console during development.
if (import.meta.env?.DEV) window.game = game;
