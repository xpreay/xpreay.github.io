/* Risk Lab UI glue. 1) The simulator marks chips with .active; mirror that into aria-pressed so the
   liquid glass segmented control can follow it. 2) Draw the hero's static fan of Monte Carlo paths:
   one seeded set of random walks, so the picture is the same on every visit. */
(() => {
  const chips = document.querySelectorAll('.chip[data-account-mode], .chip[data-view-mode]');
  const sync = () => chips.forEach((c) => c.setAttribute('aria-pressed', String(c.classList.contains('active'))));
  new MutationObserver(sync).observe(document.querySelector('.rl-body') || document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  sync();

  const group = document.querySelector('.rl-paths');
  if (!group) return;
  let seed = 20260925;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const W = 520, H = 320, START = 196, STEPS = 60, N = 34;
  const paths = [];
  for (let p = 0; p < N; p++) {
    let y = START; const pts = [[0, y]];
    // 45% wins at 2R: a positive edge, so the fan drifts up (smaller y) while single paths still lose.
    for (let s = 1; s <= STEPS; s++) { const u = 3.2 + rand() * 1.6; y += rand() < 0.45 ? -2 * u : u; pts.push([(s / STEPS) * W, Math.max(12, Math.min(H - 12, y))]); }
    paths.push(pts);
  }
  const finals = paths.map((pts) => pts.at(-1)[1]).sort((a, b) => a - b);
  const median = finals[Math.floor(N / 2)];
  const d = (pts) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L');
  let markup = '';
  paths.forEach((pts) => {
    const end = pts.at(-1)[1];
    const cls = end < START - 10 ? 'up' : end > START + 10 ? 'down' : '';
    markup += `<path class="${cls}" d="${d(pts)}"/>`;
  });
  const mid = paths.reduce((best, pts) => (Math.abs(pts.at(-1)[1] - median) < Math.abs(best.at(-1)[1] - median) ? pts : best));
  markup += `<path class="median" d="${d(mid)}"/>`;
  group.innerHTML = markup;
})();
