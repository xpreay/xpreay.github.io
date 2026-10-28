/* XPREAY sessions globe: monochrome land dots lit by the real sun position, the four session cities
   with their local time, and arcs passing the trading day between them. Drag to spin; momentum decays
   back to a slow drift. 30 fps cap, DPR 1.5, paused off-screen and in hidden tabs, static under
   reduced motion. Depends on sessions-globe-data.js (window.XPREAY_GLOBE_DOTS). */
(() => {
  const D = Math.PI / 180;
  // Colour sets for the dark and the light theme, picked every frame so a theme switch is live.
  const C = {};
  const themeColors = () => {
    const l = document.documentElement.dataset.theme === 'light';
    C.acc = l ? '63,90,97' : '190,214,216'; C.txt = l ? '27,28,26' : '239,240,237'; C.dim = l ? '120,128,124' : '150,170,184';
    C.hi = l ? '40,52,58' : '244,250,255'; C.hi2 = l ? '90,115,125' : '169,203,217'; C.bg = l ? '233,232,226' : '8,10,14';
  };
  themeColors();
  const CITIES = [
    { name: 'New York', short: 'NY', lat: 40.71, lon: -74.01, tz: 'America/New_York', open: [9.5, 16], color: '#d4a184' },
    { name: 'London', short: 'London', lat: 51.51, lon: -0.13, tz: 'Europe/London', open: [8, 16.5], color: '#86b0cb' },
    { name: 'Tokyo', short: 'Tokyo', lat: 35.68, lon: 139.65, tz: 'Asia/Tokyo', open: [9, 15], color: '#b49ccb' },
    { name: 'Sydney', short: 'Sydney', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney', open: [10, 16], color: '#b49ccb' }
  ];
  const ROUTE = [[3, 2], [2, 1], [1, 0]]; // Sydney → Tokyo → London → New York, the order the day travels
  const TILT = -20 * D;
  const AUTO_SPEED = 3.2; // degrees per second
  const FRAME_MS = 1000 / 30;

  function vec(lat, lon) {
    const p = lat * D, l = lon * D;
    return [Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)];
  }

  function sunVector(date) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 1);
    const day = (date - start) / 864e5;
    const decl = 23.44 * Math.sin((2 * Math.PI * (day - 81)) / 365);
    const hours = date.getUTCHours() + date.getUTCMinutes() / 60;
    return vec(decl, (12 - hours) * 15);
  }

  function localInfo(city, date) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: city.tz, hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(date);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const h = Number(get('hour')), m = Number(get('minute'));
    const weekend = get('weekday') === 'Sat' || get('weekday') === 'Sun';
    const t = h + m / 60;
    return { label: `${get('hour')}:${get('minute')}`, open: !weekend && t >= city.open[0] && t < city.open[1] };
  }

  function init(canvas) {
    if (!canvas || canvas.dataset.globeReady) return;
    const ctx = canvas.getContext('2d');
    const raw = window.XPREAY_GLOBE_DOTS;
    if (!ctx || !raw) return;
    canvas.dataset.globeReady = '1';

    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const dots = [];
    for (let i = 0; i < raw.length; i += 2) dots.push(vec(raw[i] / 10, raw[i + 1] / 10));
    const cityVecs = CITIES.map((c) => vec(c.lat, c.lon));

    let width = 0, height = 0, dpr = 1;
    let rotation = 40; // start with the Atlantic facing the viewer: Americas and Europe visible
    let velocity = 0; // extra degrees per second from a drag
    let dragging = false, lastX = 0, lastT = 0, samples = [];
    let running = false, visible = true, raf = 0, lastFrame = 0, lastTick = 0;
    let sun = sunVector(new Date()), cityState = CITIES.map((c) => localInfo(c, new Date())), stateAt = 0;

    function layout() {
      const mobile = width < 800;
      const r = mobile ? Math.min(width * 0.62, height * 0.34) : Math.min(height * 0.40, width * 0.27);
      return { r, cx: mobile ? width * 0.56 : width * 0.71, cy: mobile ? height - r * 0.78 : height * 0.5 };
    }

    // Rotate around the vertical axis, then tilt toward the viewer.
    function project(v, rot, g) {
      const c = Math.cos(rot * D), s = Math.sin(rot * D);
      const x = v[0] * c + v[2] * s;
      const z0 = -v[0] * s + v[2] * c;
      const y = v[1] * Math.cos(TILT) - z0 * Math.sin(TILT);
      const z = v[1] * Math.sin(TILT) + z0 * Math.cos(TILT);
      return { x: g.cx + g.r * x, y: g.cy - g.r * y, z };
    }

    function slerp(a, b, t) {
      const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      const w = Math.acos(dot), s = Math.sin(w) || 1;
      const ka = Math.sin((1 - t) * w) / s, kb = Math.sin(t * w) / s;
      const lift = 1 + Math.sin(t * Math.PI) * 0.06; // arc rises slightly above the surface
      return [(a[0] * ka + b[0] * kb) * lift, (a[1] * ka + b[1] * kb) * lift, (a[2] * ka + b[2] * kb) * lift];
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    }

    function draw(now) {
      if (now - stateAt > 30000) {
        const date = new Date();
        sun = sunVector(date);
        cityState = CITIES.map((c) => localInfo(c, date));
        stateAt = now;
      }
      const g = layout();
      const sunRot = project(sun, rotation, { cx: 0, cy: 0, r: 1 });
      themeColors();
      ctx.clearRect(0, 0, width, height);

      // Glass body: faint fill and a soft shadow edge.
      const body = ctx.createRadialGradient(g.cx - g.r * 0.35, g.cy - g.r * 0.4, g.r * 0.1, g.cx, g.cy, g.r);
      body.addColorStop(0, `rgba(${C.acc},.075)`);
      body.addColorStop(0.7, `rgba(${C.acc},.025)`);
      body.addColorStop(1, `rgba(${C.acc},0)`);
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2); ctx.fill();

      // Graticule, front half only.
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${C.txt},.055)`;
      for (let lat = -60; lat <= 60; lat += 30) line((t) => vec(lat, t * 360 - 180), g);
      for (let lon = -180; lon < 180; lon += 30) line((t) => vec(t * 164 - 82, lon), g);

      // Land dots: far side as a faint shell, near side lit by the sun.
      const size = width < 800 ? 1.5 : 1.7;
      for (const v of dots) {
        const p = project(v, rotation, g);
        if (p.z < 0) {
          ctx.fillStyle = `rgba(${C.acc},.07)`;
          ctx.fillRect(p.x - 0.6, p.y - 0.6, 1.2, 1.2);
          continue;
        }
        const light = v[0] * sun[0] + v[1] * sun[1] + v[2] * sun[2]; // >0 = daylight
        const day = Math.max(0, Math.min(1, light * 4 + 0.5));
        const depth = 0.35 + 0.65 * p.z;
        ctx.fillStyle = day > 0.5
          ? `rgba(${C.txt},${(0.4 + 0.55 * day) * depth})`
          : `rgba(${C.dim},${(0.32 + 0.2 * day) * depth})`;
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      }

      // Rim with a slow glint that travels around it, like the A button.
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${C.txt},.22)`; ctx.lineWidth = 1; ctx.stroke();
      const glint = reduced.matches ? -0.9 : (now / 7000) % (Math.PI * 2);
      const rim = ctx.createConicGradient ? ctx.createConicGradient(glint, g.cx, g.cy) : null;
      if (rim) {
        rim.addColorStop(0, `rgba(${C.hi},0)`);
        rim.addColorStop(0.06, `rgba(${C.hi},.75)`);
        rim.addColorStop(0.12, `rgba(${C.hi2},.25)`);
        rim.addColorStop(0.2, `rgba(${C.hi},0)`);
        rim.addColorStop(1, `rgba(${C.hi},0)`);
        ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2);
        ctx.strokeStyle = rim; ctx.lineWidth = 1.5; ctx.stroke();
      }

      // Session route arcs with a light passing along each one.
      ROUTE.forEach(([a, b], k) => {
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 48; i++) {
          const p = project(slerp(cityVecs[a], cityVecs[b], i / 48), rotation, g);
          if (p.z < -0.05) { started = false; continue; }
          started ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
          started = true;
        }
        ctx.strokeStyle = `rgba(${C.acc},.32)`; ctx.lineWidth = 1; ctx.stroke();
        if (reduced.matches) return;
        const t = ((now / 4200) + k / ROUTE.length) % 1;
        const p = project(slerp(cityVecs[a], cityVecs[b], t), rotation, g);
        if (p.z < 0) return;
        const a2 = Math.sin(t * Math.PI);
        ctx.fillStyle = `rgba(${C.hi},${0.85 * a2})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2); ctx.fill();
      });

      // Cities with local time; an open session gets a quiet ring.
      ctx.font = '500 13px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      CITIES.forEach((city, i) => {
        const p = project(cityVecs[i], rotation, g);
        if (p.z < 0.08) return;
        const fade = Math.min(1, (p.z - 0.08) * 5);
        const state = cityState[i];
        if (state.open) {
          ctx.strokeStyle = hexA(city.color, 0.55 * fade);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = hexA(city.color, fade);
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.6, 0, Math.PI * 2); ctx.fill();
        const label = `${city.short} ${state.label}`;
        const w = ctx.measureText(label).width;
        const lx = p.x + 14 + w + 8 > width ? p.x - 14 - w : p.x + 14, ly = p.y - 1; // flip near the edge
        ctx.fillStyle = `rgba(${C.bg},${0.72 * fade})`;
        ctx.fillRect(lx - 6, ly - 11, w + 12, 22);
        ctx.fillStyle = `rgba(${C.txt},${0.95 * fade})`;
        ctx.fillText(label, lx, ly);
      });
      canvas.dataset.sunFacing = sunRot.z > 0 ? 'day' : 'night';
    }

    function line(fn, g) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 72; i++) {
        const p = project(fn(i / 72), rotation, g);
        if (p.z < 0) { started = false; continue; }
        started ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
        started = true;
      }
      ctx.stroke();
    }

    function hexA(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
    }

    function tick(now) {
      raf = 0;
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (now - lastFrame < FRAME_MS) return;
      const dt = Math.min(0.05, (now - (lastTick || now)) / 1000);
      lastTick = now; lastFrame = now;
      if (!dragging) {
        velocity *= Math.pow(0.998, dt * 1000); // momentum decays like scroll deceleration
        if (Math.abs(velocity) < 0.05) velocity = 0;
        rotation += (AUTO_SPEED + velocity) * dt;
      }
      draw(now);
    }

    function setRunning() {
      const should = visible && !document.hidden && (!reduced.matches || dragging);
      if (should === running) return;
      running = should;
      if (running) { lastTick = 0; raf = requestAnimationFrame(tick); }
      else { cancelAnimationFrame(raf); raf = 0; draw(performance.now()); }
    }

    // Drag to spin. Horizontal only; vertical movement keeps scrolling the page.
    canvas.addEventListener('pointerdown', (e) => {
      const g = layout();
      if (Math.hypot(e.offsetX - g.cx, e.offsetY - g.cy) > g.r * 1.05) return;
      dragging = true; velocity = 0;
      lastX = e.clientX; lastT = e.timeStamp; samples = [];
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('is-dragging');
      setRunning();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const g = layout();
      const dx = e.clientX - lastX;
      const deg = (dx / g.r) * (180 / Math.PI);
      rotation += deg;
      samples.push({ deg, t: e.timeStamp });
      samples = samples.filter((s) => e.timeStamp - s.t < 90);
      lastX = e.clientX; lastT = e.timeStamp;
      if (!running) draw(performance.now());
    });
    const release = (e) => {
      if (!dragging) return;
      dragging = false;
      canvas.classList.remove('is-dragging');
      const span = samples.length ? (e.timeStamp - samples[0].t) / 1000 : 0;
      const moved = samples.reduce((sum, s) => sum + s.deg, 0);
      velocity = span > 0.01 && !reduced.matches ? Math.max(-240, Math.min(240, moved / span)) - AUTO_SPEED : 0;
      setRunning();
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    new ResizeObserver(resize).observe(canvas);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; setRunning(); }).observe(canvas);
    }
    document.addEventListener('visibilitychange', setRunning);
    reduced.addEventListener('change', setRunning);
    setInterval(() => { if (!running) { stateAt = 0; draw(performance.now()); } }, 60000);
    resize();
    setRunning();
  }

  window.XpreayGlobe = { init };
})();
