/* Page shell for subpages: theme and hand preference (shared with the home page through the same
   storage keys) and the mobile menu dialog. Mirrors the shell part of app.js without the catalog code. */
(() => {
  const root = document.documentElement;
  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };

  function setTheme(theme) {
    root.dataset.theme = theme;
    storage.set('xpreay-theme', theme);
    document.querySelectorAll('.theme-toggle').forEach((b) => {
      b.querySelector('span').textContent = theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw';
      b.setAttribute('aria-label', theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw');
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#101112' : '#f5f5f1';
  }
  setTheme(storage.get('xpreay-theme') === 'light' ? 'light' : 'dark');
  document.querySelectorAll('.theme-toggle').forEach((b) => b.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark')));

  function setHand(hand) {
    root.dataset.hand = hand;
    storage.set('xpreay-hand', hand);
    document.querySelectorAll('[name=hand]').forEach((i) => { i.checked = i.value === hand; });
  }
  setHand(storage.get('xpreay-hand') === 'left' ? 'left' : 'right');
  document.querySelectorAll('[name=hand]').forEach((i) => i.addEventListener('change', () => setHand(i.value)));

  const menu = document.querySelector('#mobile-menu');
  const launch = document.querySelector('.menu-launch');
  if (!menu || !launch) return;
  launch.addEventListener('click', () => {
    menu.showModal();
    launch.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  });
  const close = () => menu.close();
  document.querySelector('#close-menu').addEventListener('click', close);
  menu.addEventListener('close', () => {
    launch.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    launch.focus();
  });
  menu.addEventListener('click', (e) => {
    if (e.target !== menu) return;
    const r = menu.getBoundingClientRect();
    if (e.clientY < r.top) close();
  });
  menu.querySelectorAll('nav a').forEach((a) => a.addEventListener('click', close));
})();
