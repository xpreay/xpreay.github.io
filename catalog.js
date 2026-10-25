/* Tools catalog helpers (cv2). app.js still filters and searches; this file adds the visible
   result count, hides empty groups, the "Więcej" toggles, the "/" shortcut and a soft light that
   follows the pointer on each card. */
(() => {
  const catalog = document.querySelector('.catalog.cv2');
  if (!catalog) return;
  const tools = [...catalog.querySelectorAll('.tool')];
  const count = catalog.querySelector('.cat-count');
  const search = catalog.querySelector('#search');

  const plural = (n) => (n === 1 ? 'narzędzie' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'narzędzia' : 'narzędzi');
  // Write only real changes: in Safari, setting `hidden` to its current value still counts as a
  // mutation, and an observer that re-triggers itself locks the page.
  const setHidden = (el, value) => { if (el && el.hidden !== value) el.hidden = value; };
  const setText = (el, value) => { if (el && el.textContent !== value) el.textContent = value; };
  function refresh() {
    const visible = tools.filter((t) => !t.hidden);
    setText(count, `${visible.length} ${plural(visible.length)}`);
    const webVisible = visible.some((t) => t.dataset.type === 'web');
    const tvVisible = visible.some((t) => t.dataset.type === 'tv');
    setHidden(catalog.querySelector('.apps-grid'), !webVisible);
    setHidden(catalog.querySelector('[data-group=web]'), !webVisible);
    setHidden(catalog.querySelector('[data-group=tv]'), !tvVisible);
  }
  // Watch only the tool cards that app.js filters, never the elements this file changes.
  const observer = new MutationObserver(refresh);
  tools.forEach((t) => observer.observe(t, { attributes: true, attributeFilter: ['hidden'] }));
  refresh();

  catalog.querySelectorAll('.tool-toggle').forEach((button) => {
    const more = document.getElementById(button.getAttribute('aria-controls'));
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      button.firstChild.textContent = open ? 'Mniej' : 'Więcej';
      more.hidden = !open;
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    search.focus();
    search.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    tools.forEach((card) => {
      let frame = 0, x = 0, y = 0;
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        x = e.clientX - r.left; y = e.clientY - r.top;
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; card.style.setProperty('--mx', `${x}px`); card.style.setProperty('--my', `${y}px`); });
      }, { passive: true });
      card.addEventListener('pointerleave', () => { card.style.removeProperty('--mx'); card.style.removeProperty('--my'); });
    });
  }
})();
