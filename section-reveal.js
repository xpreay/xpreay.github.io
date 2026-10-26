// Adds .is-in once an element scrolls into view: the Framework steps draw in, and on touch screens
// the mentorship card's rim glint turns (hover does it on desktop). Watches visibility only.
(() => {
  const targets = document.querySelectorAll('.process-steps, .ment-card');
  if (!('IntersectionObserver' in window)) { targets.forEach(t => t.classList.add('is-in')); return; }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { threshold: 0.35 });
  document.documentElement.classList.add('reveal-ready');
  targets.forEach(t => io.observe(t));
})();
