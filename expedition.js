/* Starts the summit beacon exactly when the statement's "Jesteś TY." line comes in, instead of on
   a free-running timer, so the first double blink always lands while the words are on screen,
   in both scroll directions. logo-reveal.js publishes the scene progress as data-progress. */
(() => {
  const summit = document.querySelector('.bs-summit');
  const scene = summit?.closest('[data-progress]') || document.querySelector('[data-progress]');
  if (!summit || !scene) return;
  const ON = 0.665, OFF_LOW = 0.6, OFF_HIGH = 0.85; // second line lands at ~0.67; statement leaves at 0.85
  let on = false;
  function update() {
    const p = Number(scene.dataset.progress);
    const next = p >= ON && p < OFF_HIGH ? true : p < OFF_LOW || p >= OFF_HIGH ? false : on;
    if (next === on) return;
    on = next;
    summit.classList.remove('is-on');
    if (on) { void summit.offsetWidth; summit.classList.add('is-on'); } // restart: blink right away
  }
  new MutationObserver(update).observe(scene, { attributes: true, attributeFilter: ['data-progress'] });
  update();
})();
