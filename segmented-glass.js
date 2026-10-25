/* Liquid glass segmented control. Enhances existing button groups that use aria-pressed
   (home catalog filters, sessions pills and library tabs) with a glass thumb that follows the
   pressed button on a critically damped spring. The thumb starts from wherever it is on screen,
   so a new click mid-flight just re-targets it. In single-row groups the thumb can be grabbed and
   dragged across segments; release projects the momentum and picks the nearest segment.
   The page's own click handlers stay in charge of state: this file only reads aria-pressed. */
(() => {
  const GROUPS = '.catalog .filters, .pill-group, .library-tabs, .mode-switch, .view-seg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const RESPONSE = 0.34, DAMPING = 1; // Apple-style default: no overshoot
  const K = (2 * Math.PI / RESPONSE) ** 2, C = 4 * Math.PI * DAMPING / RESPONSE;

  function spring(value) {
    return { value, target: value, velocity: 0 };
  }
  function stepSpring(s, dt) {
    const force = K * (s.target - s.value) - C * s.velocity;
    s.velocity += force * dt;
    s.value += s.velocity * dt;
    if (Math.abs(s.target - s.value) < 0.05 && Math.abs(s.velocity) < 1) { s.value = s.target; s.velocity = 0; }
  }
  const rubber = (over, dim) => (over * dim * 0.55) / (dim + 0.55 * Math.abs(over));

  // Liquid glass lens: backdrop-filter with an SVG displacement map works in Chromium only.
  // Elsewhere the thumb keeps its plain blur.
  const lensOk = !!navigator.userAgentData?.brands?.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand)) && !reduced.matches;
  let lensHost = null, lensId = 0;
  function lensMap(w, h, radius, bezel) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
    const hx = w / 2, hy = h / 2, r = Math.min(radius, hx, hy);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = x + 0.5 - hx, py = y + 0.5 - hy;
      const qx = Math.abs(px) - (hx - r), qy = Math.abs(py) - (hy - r);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
      const sdf = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r; // <0 inside
      let nx = 0, ny = 0;
      if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1; nx = qx / l; ny = qy / l; } else if (qx > qy) nx = 1; else ny = 1;
      nx *= Math.sign(px) || 1; ny *= Math.sign(py) || 1;
      const t = Math.max(0, 1 - -sdf / bezel); // 1 at the rim, 0 deeper than the bezel
      const m = t * t * (3 - 2 * t); // smooth bezel profile
      const i = (y * w + x) * 4;
      d[i] = 128 + nx * m * 127; d[i + 1] = 128 + ny * m * 127; d[i + 2] = 128; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }
  function makeLens(thumb, w, h) {
    if (!lensOk || w < 8 || h < 8) return;
    w = Math.round(w); h = Math.round(h);
    if (thumb.dataset.lensSize === `${w}x${h}`) return;
    thumb.dataset.lensSize = `${w}x${h}`;
    if (!lensHost) {
      lensHost = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      lensHost.setAttribute('aria-hidden', 'true');
      lensHost.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      document.body.append(lensHost);
    }
    const id = thumb.dataset.lensId || `seg-lens-${++lensId}`;
    thumb.dataset.lensId = id;
    lensHost.querySelector('#' + id)?.remove();
    lensHost.insertAdjacentHTML('beforeend', `<filter id="${id}" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feImage href="${lensMap(w, h, 10, Math.min(12, h / 3))}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/><feDisplacementMap in="SourceGraphic" in2="map" scale="22" xChannelSelector="R" yChannelSelector="G"/></filter>`);
    thumb.style.setProperty('--lens', `url(#${id})`);
    thumb.classList.add('has-lens');
  }

  function enhance(group) {
    if (group.dataset.seg) return;
    const buttons = [...group.children].filter((el) => el.matches('button'));
    if (buttons.length < 2) return;
    group.dataset.seg = '1';
    group.classList.add('seg');
    const thumb = document.createElement('span');
    thumb.className = 'seg-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    group.prepend(thumb);

    const x = spring(0), y = spring(0), w = spring(0), h = spring(0), sc = spring(1);
    let held = false;
    let raf = 0, last = 0, placed = false, drag = null;

    const pressed = () => buttons.find((b) => b.getAttribute('aria-pressed') === 'true');
    const singleRow = () => buttons.every((b) => b.offsetTop === buttons[0].offsetTop);

    function render() {
      const speed = Math.abs(x.velocity);
      const stretch = reduced.matches ? 0 : Math.min(speed / 5200, 0.1); // a little stretch encodes speed
      const k = sc.value;
      thumb.style.transform = `translate3d(${x.value}px, ${y.value}px, 0) scale(${(1 + stretch) * k}, ${(1 - stretch * 0.5) * k})`;
      thumb.style.width = `${w.value}px`;
      thumb.style.height = `${h.value}px`;
    }
    function frame(now) {
      const dt = Math.min(0.032, (now - (last || now)) / 1000);
      last = now;
      const travelling = Math.abs(x.target - x.value) > 3 || Math.abs(y.target - y.value) > 3;
      sc.target = reduced.matches ? 1 : held ? 1.13 : travelling ? 1.06 : 1;
      for (let i = 0; i < 4; i++) [x, y, w, h, sc].forEach((s) => stepSpring(s, dt / 4));
      if (Math.abs(sc.target - sc.value) < 0.001 && Math.abs(sc.velocity) < 0.01) { sc.value = sc.target; sc.velocity = 0; }
      render();
      const moving = [x, y, w, h, sc].some((s) => s.velocity !== 0 || s.value !== s.target);
      if (!moving) makeLens(thumb, w.value, h.value);
      raf = moving ? requestAnimationFrame(frame) : 0;
      if (!moving) last = 0;
    }
    function moveTo(btn, animate) {
      if (!btn || !btn.offsetWidth) { thumb.style.opacity = '0'; return; }
      thumb.style.opacity = '1';
      x.target = btn.offsetLeft; y.target = btn.offsetTop; w.target = btn.offsetWidth; h.target = btn.offsetHeight;
      if (!animate || !placed || reduced.matches) {
        [x, y, w, h].forEach((s) => { s.value = s.target; s.velocity = 0; });
        placed = true;
        if (reduced.matches && animate) { thumb.classList.remove('seg-fade'); void thumb.offsetWidth; thumb.classList.add('seg-fade'); }
        render();
        makeLens(thumb, w.value, h.value);
        return;
      }
      if (!raf) raf = requestAnimationFrame(frame);
    }
    const sync = (animate = true) => { if (!drag) moveTo(pressed(), animate); };

    new MutationObserver(() => sync(true)).observe(group, { attributes: true, subtree: true, attributeFilter: ['aria-pressed'] });
    new ResizeObserver(() => sync(false)).observe(group);
    document.fonts?.ready.then(() => sync(false));
    sync(false);

    // Light catching the glass follows the pointer, as on the other glass controls.
    group.addEventListener('pointermove', (e) => {
      const r = thumb.getBoundingClientRect();
      thumb.style.setProperty('--light-x', `${e.clientX - r.left}px`);
      thumb.style.setProperty('--light-y', `${e.clientY - r.top}px`);
    }, { passive: true });
    group.addEventListener('pointerleave', () => { thumb.style.removeProperty('--light-x'); thumb.style.removeProperty('--light-y'); });

    // Drag the thumb: only from the selected segment, only in a single row.
    group.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('button');
      if (!btn || btn !== pressed() || !singleRow() || e.button !== 0) return;
      drag = { startX: e.clientX, origin: x.value, moved: false, id: e.pointerId, samples: [] };
      thumb.classList.add('is-held');
      held = true; if (!raf) raf = requestAnimationFrame(frame);
    });
    group.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.startX;
      if (!drag.moved && Math.abs(dx) < 8) return; // hysteresis before committing to a drag
      if (!drag.moved) { drag.moved = true; group.setPointerCapture(e.pointerId); }
      const min = buttons[0].offsetLeft, max = buttons.at(-1).offsetLeft + buttons.at(-1).offsetWidth - w.value;
      let next = drag.origin + dx;
      if (next < min) next = min - rubber(min - next, group.offsetWidth);
      if (next > max) next = max + rubber(next - max, group.offsetWidth);
      x.value = x.target = next; x.velocity = 0;
      drag.samples.push({ x: next, t: e.timeStamp });
      drag.samples = drag.samples.filter((s) => e.timeStamp - s.t < 100);
      if (!raf) raf = requestAnimationFrame(frame);
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      thumb.classList.remove('is-held');
      held = false; if (!raf) raf = requestAnimationFrame(frame);
      if (!d.moved) return; // a plain tap: the normal click does the rest
      const s = d.samples, v = s.length > 1 ? ((s.at(-1).x - s[0].x) / Math.max(1, s.at(-1).t - s[0].t)) * 1000 : 0;
      const projected = x.value + w.value / 2 + (v / 1000) * 0.99 / (1 - 0.99);
      const target = buttons.reduce((best, b) => (Math.abs(b.offsetLeft + b.offsetWidth / 2 - projected) < Math.abs(best.offsetLeft + best.offsetWidth / 2 - projected) ? b : best));
      x.velocity = v;
      if (target === pressed()) moveTo(target, true);
      else target.click();
      // Swallow the native click that follows this pointerup, so the drag doesn't also tap.
      const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      group.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => group.removeEventListener('click', swallow, { capture: true }), 0);
    };
    group.addEventListener('pointerup', end);
    group.addEventListener('pointercancel', end);
  }

  const run = () => document.querySelectorAll(GROUPS).forEach(enhance);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
