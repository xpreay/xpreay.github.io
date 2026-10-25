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
  function refresh() {
    const visible = tools.filter((t) => !t.hidden);
    if (count) count.textContent = `${visible.length} ${plural(visible.length)}`;
    const webVisible = visible.some((t) => t.dataset.type === 'web');
    const tvVisible = visible.some((t) => t.dataset.type === 'tv');
    catalog.querySelector('.apps-grid').hidden = !webVisible;
    catalog.querySelector('[data-group=web]').hidden = !webVisible;
    catalog.querySelector('[data-group=tv]').hidden = !tvVisible;
  }
  new MutationObserver(refresh).observe(catalog, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
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
