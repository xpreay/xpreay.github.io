/* XPREAY „Blueprint Chrome” — kinowa wersja logo-reveal (port sceny outro z wideo, 1:1 w three.js).
   Scroll sekcji (scene.dataset.progress z logo-reveal.js) steruje czasem sceny: linia rysuje belkę X, rodzi się szkic kreślarski,
   kamera robi crane, z czerni wyłania się logo z czarnego chromu, przy domknięciu fala kropek z hero, na końcu jedna smuga światła.
   Tylko desktop z WebGL2 i bez „ogranicz ruch”; inaczej zostaje lekka wersja 2D (logo-reveal.js). */
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const scene = document.querySelector('.brand-reveal'), sequence = document.querySelector('.logo-sequence');
const reduced = matchMedia('(prefers-reduced-motion:reduce)'), wide = matchMedia('(min-width:900px)');
const probe = document.createElement('canvas');
if (scene && sequence && !reduced.matches && wide.matches && probe.getContext('webgl2')) init();

function init() {
// ——— narzędzia ———
const clamp = (n) => Math.max(0, Math.min(1, n));
const ramp = (p, a, b) => { const x = clamp((p - a) / (b - a)); return x * x * (3 - 2 * x); };
const inOutC = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const outQ = (x) => 1 - Math.pow(1 - clamp(x), 4);
const slice = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const v3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const S = 0.006, CX = 500, CY = 311.5, DEPTH = 0.36, BEV = 0.13, TOP = DEPTH + 2.3 * BEV;
const W2 = (x, y, z = 0.004) => [(x - CX) * S, -(y - CY) * S, z];

// ——— geometria logo i szkic (te same dane co logo-reveal.js) ———
const CONTOURS = [
  [[79, 0], [331, 0], [448, 117], [448, 119], [327, 239], [326, 242], [324, 242], [324, 244], [322, 244], [79, 0]],
  [[622, 0], [1000, 0], [1000, 319], [947, 383], [942, 388], [775, 388], [660, 273], [883, 272], [883, 137], [737, 137], [252, 623], [1, 623], [1, 621], [622, 0]],
  [[630, 300], [632, 300], [954, 623], [703, 623], [506, 426], [506, 424], [630, 300]],
];
const BUILD = (() => {
  const paths = [], guides = [];
  CONTOURS.forEach((poly) => { for (let i = 0; i < poly.length - 1; i++) { const a = poly[i], b = poly[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); if (len < 5) continue;
    paths.push(paths.length % 2 ? { a: b, b: a } : { a, b }); if (len > 100) { const ex = dx / len * 36, ey = dy / len * 36; guides.push({ cls: 'ext', d: `M${a[0] - ex},${a[1] - ey}L${b[0] + ex},${b[1] + ey}` }); } } });
  const guide = (a, b, cls = 'dim') => guides.push({ cls, ends: { a, b } });
  const tick = (x, y) => guide([x - 5, y + 6], [x + 5, y - 6], 'tick');
  guide([1, -56], [1000, -56]); guide([1, -70], [1, -16]); guide([1000, -70], [1000, -16]); tick(1, -56); tick(1000, -56);
  guide([1050, 0], [1050, 623]); guide([1016, 0], [1065, 0]); guide([970, 623], [1065, 623]); tick(1050, 0); tick(1050, 623);
  guide([737, 100], [883, 100]); guide([737, 86], [737, 155]); guide([883, 86], [883, 155]); tick(737, 100); tick(883, 100);
  guide([500, -90], [500, 700], 'center'); guide([-70, 311.5], [1090, 311.5], 'center'); guide([1, 623], [115, 623]); guide([1, 623], [81, 543]);
  guides.push({ cls: 'angle', d: 'M91 623 A90 90 0 0 0 64.64 559.36' });
  [[500, 311.5, 311.5], [500, 311.5, 192.5], [810, 205, 73]].forEach(([cx, cy, r], i) => { const st = i % 2 ? cx - r : cx + r, sw = i % 2 ? 0 : 1, op = i % 2 ? cx + r : cx - r;
    guides.push({ cls: 'compass', d: `M${st} ${cy} A${r} ${r} 0 1 ${sw} ${op} ${cy} A${r} ${r} 0 1 ${sw} ${st} ${cy}` }); });
  [[1, 623], [622, 0], [1000, 0], [883, 137], [737, 137], [660, 273]].forEach(([x, y]) => { guide([x - 7, y], [x + 7, y], 'reg'); guide([x, y - 7], [x, y + 7], 'reg'); });
  const measures = [['999', 500, -70, -3], ['623', 1074, 316, 3], ['146', 810, 85, -4], ['45°', 116, 589, -5]].map(([s, x, y, ang]) => ({ s, x, y, ang, kind: 'm' }));
  const cands = [];
  const studies = [...Array.from({ length: 5 }, (_, i) => [26 + i * 34, 240 + Math.sin(i * 1.7) * 22]), ...Array.from({ length: 5 }, (_, i) => [900 + i * 34, 465 - Math.sin(i * 0.9) * 32]),
    ...Array.from({ length: 4 }, (_, i) => [400 + i * 30, -34 + Math.sin(i) * 14]), ...Array.from({ length: 5 }, (_, i) => [340 + i * 32, 650 - Math.sin(i * 1.3) * 14])];
  studies.forEach(([x, y], i) => { const h = 21 + (i % 4) * 8, wick = 12 + (i % 3) * 7, t = y - h / 2, b = y + h / 2, tilt = ((i % 3) - 1) * 1.3;
    cands.push({ cls: 'candle', d: `M${x + tilt},${t - wick}Q${x - 1.2},${y} ${x + 0.8},${b + wick}M${x - 8},${t + 1}Q${x},${t - 1.3} ${x + 9},${t}L${x + 8 + tilt},${b}Q${x},${b + 1.2} ${x - 8.5},${b - 0.8}Z`, rot: { a: ((i % 5) - 2) * 1.8, x, y } });
    if (i % 3 === 0) cands.push({ cls: 'hatch', d: `M${x - 7},${t + 3}L${x + 7},${t + 9}M${x - 7},${t + 11}L${x + 7},${t + 17}` }); });
  ['M20 302 Q85 293 190 309 M22 305 Q90 297 188 311', 'M913 524 Q985 513 1080 527', 'M395 -2 Q450 6 515 -5', 'M320 699 Q410 688 511 700', 'M170 280 Q218 254 235 217 M227 225 L235 217 234 230', 'M1007 435 Q1021 395 1000 365 M998 375 L1000 365 1008 372'].forEach((d) => cands.push({ cls: 'note', d }));
  const formulas = [['H − L', 40, 335, -4], ['|C − O|', 112, 359, 3], ['risk / trade', 905, 561, -5], ['R = reward / risk', 330, 730, -2], ['price × time', 270, -78, 3]].map(([s, x, y, ang]) => ({ s, x, y, ang, kind: 'f' }));
  return { paths, guides, measures, cands, formulas };
})();
const COL = { ext: [124, 135, 129, 0.75], dim: [179, 189, 181, 0.8], center: [108, 120, 113, 0.75], compass: [141, 156, 146, 0.7], reg: [201, 211, 203, 0.85], angle: [179, 189, 181, 0.8], tick: [192, 210, 205, 0.9], candle: [166, 170, 160, 0.85], hatch: [166, 170, 160, 0.7], note: [166, 170, 160, 0.75] };
const mkPoly = (pts) => { const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, len, total: len[len.length - 1] || 1 }; };
const parseD = (d, rot) => { const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`), out = [];
  const c = rot ? Math.cos(rot.a * Math.PI / 180) : 1, s = rot ? Math.sin(rot.a * Math.PI / 180) : 0;
  data.paths.forEach((sp) => sp.subPaths.forEach((path) => { const pts = path.getPoints(48).map((v) => rot ? [rot.x + (v.x - rot.x) * c - (v.y - rot.y) * s, rot.y + (v.x - rot.x) * s + (v.y - rot.y) * c] : [v.x, v.y]); if (pts.length > 1) out.push(mkPoly(pts)); }));
  return out; };
const pushPoly = (arr, col, P, frac, rgb, dash) => { const lim = P.total * frac; if (lim <= 0) return; const pat = dash ? dash.reduce((a, b) => a + b, 0) : 0;
  const on = (u) => { if (!dash) return true; let m = u % pat; for (let i = 0; i < dash.length; i++) { if (m < dash[i]) return i % 2 === 0; m -= dash[i]; } return true; };
  for (let i = 1; i < P.pts.length; i++) { const l0 = P.len[i - 1], l1 = P.len[i]; if (l0 >= lim) break; const a = P.pts[i - 1], b = P.pts[i], segL = l1 - l0 || 1, steps = dash ? Math.max(1, Math.ceil(segL / 2)) : 1;
    for (let k = 0; k < steps; k++) { const u0 = l0 + segL * k / steps, u1 = Math.min(lim, l0 + segL * (k + 1) / steps); if (u0 >= lim) break; if (!on((u0 + u1) / 2)) continue;
      const f0 = (u0 - l0) / segL, f1 = (u1 - l0) / segL; arr.push(...W2(a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0), ...W2(a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1)); col.push(...rgb, ...rgb); } } };

// ——— choreografia (sekundy sceny, jak w wideo) ———
const PATH_SHARD = CONTOURS.flatMap((poly, k) => poly.slice(1).map((b, i) => (Math.hypot(b[0] - poly[i][0], b[1] - poly[i][1]) < 5 ? -1 : k)).filter((v) => v >= 0));
const SHARD_ORDER = [0.6, 0.66, 0.63];
const DIAG = BUILD.paths.reduce((bi, s, i, arr) => (Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > Math.hypot(arr[bi].b[0] - arr[bi].a[0], arr[bi].b[1] - arr[bi].a[1]) ? i : bi), 0);
const findPath = (p, q) => { const near = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]) < 4; for (let i = 0; i < BUILD.paths.length; i++) { const s = BUILD.paths[i]; if (near(s.a, p) && near(s.b, q)) return { i, rev: false }; if (near(s.a, q) && near(s.b, p)) return { i, rev: true }; } return null; };
const baseI = findPath([252, 623], [1, 623]).i;
const HERO_SEGS = [{ ...findPath([622, 0], [1, 621]), t0: 0.25, dur: 0.8 }, { ...findPath([252, 623], [1, 623]), t0: 1.05, dur: 0.22 }, { ...findPath([252, 623], [737, 137]), t0: 1.27, dur: 0.75 }].map((h) => ({ ...h, rev: h.i === baseI ? !h.rev : h.rev }));
const HERO_MAP = new Map(HERO_SEGS.map((h) => [h.i, h]));
const segPts = (i) => { const s = BUILD.paths[i], h = HERO_MAP.get(i); return h && h.rev ? { a: s.b, b: s.a } : { a: s.a, b: s.b }; };
const HERO_A = BUILD.paths[DIAG].a, WAVE0 = 1.2, WAVE_K = 0.0001;
const TIER = { center: 0.2, compass: 0.2, ext: 0.32, dim: 0.44, reg: 0.44, tick: 0.5, angle: 0.5 };
const waveAt = (x, y) => WAVE0 + Math.hypot(x - HERO_A[0], y - HERO_A[1]) * WAVE_K;
const pathT0 = (i) => HERO_MAP.get(i)?.t0 ?? waveAt(BUILD.paths[i].a[0], BUILD.paths[i].a[1]) + 0.08;
const pathDur = (i) => HERO_MAP.get(i)?.dur ?? 1.0;
const heroTip = (t) => { for (let k = HERO_SEGS.length - 1; k >= 0; k--) { const h = HERO_SEGS[k]; if (t >= h.t0 || k === 0) { const { a, b } = segPts(h.i), n = ramp(t, h.t0, h.t0 + h.dur); return [a[0] + (b[0] - a[0]) * n, a[1] + (b[1] - a[1]) * n]; } } return [0, 0]; };
const OUTRO_HIT = 0.15 + 4.4 * (0.66 + 0.069);

// ——— renderer, scena, kamera ———
const canvas = document.createElement('canvas'); canvas.className = 'logo-cine'; canvas.setAttribute('aria-hidden', 'true');
scene.prepend(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x000000, 1);
const world = new THREE.Scene(); world.background = new THREE.Color(0x000000); world.fog = new THREE.Fog(0x000000, 14, 60);
const camera = new THREE.PerspectiveCamera(27, 16 / 9, 0.05, 200);
const sheet = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0x000000 })); world.add(sheet);

// miękki softbox (gradient) i środowisko odbić z „lightformerów” (jak w wideo)
const softTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'), img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const u = (x - 127.5) / 127.5, v = (y - 127.5) / 127.5; const a = Math.exp(-u * u * 4.2) * Math.min(1, Math.exp(-Math.pow(Math.max(0, Math.abs(v) - 0.55), 2) * 30)); const c = Math.round(255 * a), o = (y * 256 + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = c; img.data[o + 3] = 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const envScene = new THREE.Scene(); envScene.background = new THREE.Color(0x000000);
const mkLF = (color, sx, sy) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softTex, color: new THREE.Color(color), side: THREE.DoubleSide, toneMapped: false })); m.scale.set(sx, sy, 1); m.userData.base = new THREE.Color(color); envScene.add(m); return m; };
const LF = { top: mkLF('#ffffff', 12, 4), band: mkLF('#f4f8fa', 3.4, 20), sideL: mkLF('#eef6fa', 3.5, 11), sideR: mkLF('#efe8f7', 3.5, 11), orb: mkLF('#effcff', 2.2, 8), orb2: mkLF('#f3eafa', 1.8, 7), sweep: mkLF('#ffffff', 4, 18) };
const setLF = (m, pos, intensity, rotZ = 0) => { m.position.set(...pos); m.lookAt(0, 0, 0); m.rotateZ(rotZ); m.material.color.copy(m.userData.base).multiplyScalar(intensity); m.visible = intensity > 0.001; };
const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null;

// światła (tylko odblaski na metalu; tło jest nieoświetlone)
const ambient = new THREE.AmbientLight(0xffffff, 0); world.add(ambient);
const key = new THREE.SpotLight(0xeef4f8, 0, 0, 0.3, 1, 2); key.position.set(-4.5, 5.5, 8.5); world.add(key, key.target);
const edge = new THREE.PointLight(0xe6f1f6, 0, 16, 2); world.add(edge);
const rim = new THREE.SpotLight(0xc9d6f0, 0, 0, 0.5, 1, 2); rim.position.set(5, -4, 3); world.add(rim, rim.target);

// szkic: linie pomocnicze jednym obiektem
const prepGuides = BUILD.guides.map((g) => ({ cls: g.cls, polys: g.ends ? [mkPoly([g.ends.a, g.ends.b])] : parseD(g.d) }));
const prepCands = BUILD.cands.map((c) => ({ cls: c.cls, polys: parseD(c.d, c.rot) }));
const draftGeo = new THREE.BufferGeometry();
world.add(new THREE.LineSegments(draftGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
const updateDraft = (p, t, fade) => { const pos = [], col = [], candleA = 1 - ramp(p, 0.56, 0.72);
  prepGuides.forEach((g) => { const a0 = g.polys[0].pts[0], st = waveAt(a0[0], a0[1]) + (TIER[g.cls] ?? 0.3), n = ramp(t, st, st + 0.9); if (n <= 0) return; const c = COL[g.cls], k = c[3] * fade / 255;
    g.polys.forEach((P) => pushPoly(pos, col, P, n, [c[0] * k, c[1] * k, c[2] * k], g.cls === 'center' ? [18, 5, 3, 5] : undefined)); });
  let study = -1, note = -1;
  prepCands.forEach((g) => { let st; if (g.cls === 'candle' || g.cls === 'hatch') { if (g.cls === 'candle') study++; const grp = study < 5 ? 0 : study < 10 ? 1 : study < 14 ? 2 : 3, inG = study - [0, 5, 10, 14][grp]; st = WAVE0 + 0.5 + grp * 0.05 + inG * 0.13 + (g.cls === 'hatch' ? 0.26 : 0); } else { note++; st = WAVE0 + 0.55 + note * 0.09; }
    const c = COL[g.cls], k = c[3] * fade * candleA / 255; g.polys.forEach((P, j) => { const s0 = st + j * 0.12, n = ramp(t, s0, s0 + (g.cls === 'note' ? 0.45 : 0.24)); if (n > 0) pushPoly(pos, col, P, n, [c[0] * k, c[1] * k, c[2] * k]); }); });
  draftGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); draftGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); };

// odręczne wymiary i wzory
const labels = [...BUILD.measures, ...BUILD.formulas].map((m) => { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128; const g = cv.getContext('2d'); const font = `${m.kind === 'f' ? 'italic ' : ''}64px "Segoe Print","Bradley Hand",cursive`; g.font = font;
  const w = Math.ceil(g.measureText(m.s).width) + 16; g.fillStyle = m.kind === 'f' ? 'rgb(169,175,162)' : 'rgb(182,189,176)'; g.font = font; g.fillText(m.s, 8, 88);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(w / 1024, 1); const h = 36, wu = h * (w / 128);
  const cx = m.x + (wu / 2) * Math.cos(m.ang * Math.PI / 180), cy = m.y - h * 0.18 + (wu / 2) * Math.sin(m.ang * Math.PI / 180);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wu * S, h * S), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 }));
  mesh.position.set(...W2(cx, cy, 0.005)); mesh.rotation.z = -m.ang * Math.PI / 180; world.add(mesh); return { m, mesh }; });
const updateLabels = (p, t, fade) => labels.forEach(({ m, mesh }) => { const st = waveAt(m.x, m.y) + 0.55; mesh.material.opacity = ramp(t, st, st + 0.45) * (m.kind === 'm' ? 1 : 1 - ramp(p, 0.6, 0.73)) * fade; mesh.visible = mesh.material.opacity > 0.005; });

// kontury = cięcie w świetle (gruba linia, gorący koniec grota)
const lineMats = [];
const contourLines = BUILD.paths.map(() => { const g = new LineGeometry(); g.setPositions([0, 0, 0, 0, 0, 0, 0, 0, 0]); g.setColors([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const m = new LineMaterial({ vertexColors: true, linewidth: 1.7, transparent: true, depthWrite: false, toneMapped: false }); lineMats.push(m); const l = new Line2(g, m); l.visible = false; world.add(l); return l; });
const updateContours = (p, t, out) => BUILD.paths.forEach((s0, i) => { const line = contourLines[i], s = segPts(i), start = pathT0(i), dur = pathDur(i), n = ramp(t, start, start + dur);
  const k = PATH_SHARD[i], o = SHARD_ORDER[k], e = outQ(slice(p, o, o + 0.13)), z = 0.006 + TOP * e, fade = (1 - ramp(p, o + 0.09, o + 0.2)) * (1 - out);
  if (n <= 0 || fade <= 0.003) { line.visible = false; return; }
  const close = Math.exp(-Math.pow((t - (start + dur)) / 0.08, 2)), lift = Math.sin(Math.PI * slice(p, o, o + 0.15)), hot = 1 + 0.9 * close + 0.5 * lift;
  const x = s.a[0] + (s.b[0] - s.a[0]) * n, y = s.a[1] + (s.b[1] - s.a[1]) * n, base = 0.9 * hot * fade, tipHot = n < 1 ? 1.75 * fade : base;
  const len = Math.hypot(x - s.a[0], y - s.a[1]), tail = Math.min(40, len * 0.5), mx = x - ((x - s.a[0]) / (len || 1)) * tail, my = y - ((y - s.a[1]) / (len || 1)) * tail;
  line.geometry.setPositions([...W2(s.a[0], s.a[1], z), ...W2(mx, my, z), ...W2(x, y, z)]);
  line.geometry.setColors([base, base * 1.01, base * 0.995, base, base * 1.01, base * 0.995, tipHot, tipHot * 1.02, tipHot * 1.04]); line.visible = true; });

// stal: czarny płynny chrom (fazka do środka = obrys 1:1)
const steelMat = new THREE.MeshPhysicalMaterial({ color: '#08080a', metalness: 1, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.8, iridescence: 0.22, iridescenceIOR: 1.35, iridescenceThicknessRange: [120, 420] });
const shards = CONTOURS.map((poly) => { const pts = []; poly.slice(0, -1).forEach((q) => { const l = pts[pts.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) >= 6) pts.push(q); });
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2((x - CX) * S, -(y - CY) * S))), { depth: DEPTH, bevelEnabled: true, bevelThickness: BEV * 1.15, bevelSize: BEV, bevelOffset: -BEV, bevelSegments: 14, curveSegments: 1 });
  g.translate(0, 0, BEV * 1.15); const m = new THREE.Mesh(toCreasedNormals(g, Math.PI / 5), steelMat); m.visible = false; world.add(m); return m; });

// fala przy uderzeniu = raster kropek z hero (current-field.js)
const dotMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, uniforms: { tau: { value: 0 }, R: { value: 0 }, amp: { value: 0 }, vis: { value: 0 }, pitch: { value: 0.075 } },
  vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `precision highp float; varying vec2 vP; uniform float tau,R,amp,vis,pitch;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
  float fbm(vec2 p){return .57*noise(p)+.28*noise(p*2.03+7.)+.15*noise(p*4.1-4.);}
  float field(vec2 c){ float r=length(vec2(c.x*.82,c.y)), a=atan(c.y,c.x); float d=r-R-.35*(fbm(vec2(a*2.,tau*1.3))-.5); float w=.2+.14*fbm(vec2(a*3.,r*.6));
    float ring=exp(-d*d/(w*w)); float packets=.35+.65*(.5+.5*sin(a*9.+r*2.+fbm(vec2(a*2.,r))*3.)); float wake=exp(-max(0.,-d)*2.2)*step(d,0.)*.05; return (ring*packets+wake*packets)*amp*exp(-r/13.); }
  void main(){ vec2 cell=(floor(vP/pitch)+.5)*pitch; float light=field(cell)*vis, s=clamp(light,0.,1.); vec2 local=(vP-cell)/pitch;
    float radius=.62*.5*mix(1.,.32+.68*s,.35); float aa=fwidth(vP.x)/pitch; float disc=1.-smoothstep(radius-aa*.7,radius+aa*.7,length(local));
    float halo=exp(-dot(local,local)*8.)*light*.6*.075; float c=disc*s*.76+halo+light*.6*.025; gl_FragColor=vec4(vec3(c)*vec3(.86,.9,.95),1.); }` });
const dots = new THREE.Mesh(new THREE.PlaneGeometry(34, 22), dotMat); dots.position.z = 0.004; dots.visible = false; world.add(dots);

// postprocessing: głębia ostrości, bloom tylko na odblaskach, delikatna aberracja + ziarno + winieta
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(world, camera));
const bokeh = new BokehPass(world, camera, { focus: 6, aperture: 0.002, maxblur: 0.008 }); composer.addPass(bokeh);
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.4, 0.9); composer.addPass(bloom);
const finish = new ShaderPass({ uniforms: { tDiffuse: { value: null }, seed: { value: 0 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float seed; varying vec2 vUv; float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){ vec2 o=vec2(.0005,.0004); vec3 c=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);
    c+= (h(vUv*1000.+seed)-.5)*.022; float v=smoothstep(.95,.22,length(vUv-.5)*1.2); c*=mix(.22,1.,v); gl_FragColor=vec4(c,1.); }` });
composer.addPass(finish); composer.addPass(new OutputPass());

// ——— klatka sceny dla czasu t ———
function frame(t) {
  const W = canvas.clientWidth, H = canvas.clientHeight, land = W > H;
  const p = clamp((t - 0.15) / 4.4), out = 0, draftFade = 1 - ramp(p, 0.62, 0.76), dark = ramp(p, 0.58, 0.8), faces = ramp(p, 0.8, 0.98);
  const edgeK = ramp(p, 0.6, 0.7) * (1 - 0.55 * ramp(p, 0.9, 1)), edgeA = (205 - 250 * inOutC(slice(p, 0.6, 1)) - 10 * ramp(t, 4.6, 6.3)) * Math.PI / 180;
  // kamera: za grotem na zejściu, potem szeroki tor i crane do ujęcia z góry
  const dA = inOutC(slice(t, 0.1, 2.9)), tA = v3(W2(150, 590, 0), W2(470, 250, 0), dA), side = [0.707, -0.707];
  const offA = v3([side[0] * 3.0, side[1] * 3.0, 1.45], [side[0] * 3.6, side[1] * 3.6, 2.1], dA), camA = [tA[0] + offA[0], tA[1] + offA[1], tA[2] + offA[2]];
  const kB = inOutC(slice(t, 2.35, 4.15)), dist = (land ? 13.2 : 22.5) * (1 - 0.018 * ramp(t, 4.2, 6.3));
  let pos = v3(camA, [0, -0.12 * dist / 13, dist], kB), target = v3(tA, [0, 0, DEPTH * 0.5], kB), up = v3([0, 0, 1], [0, 1, 0], ramp(kB, 0.15, 0.85)), fov = lerp(land ? 27 : 36, land ? 24 : 32, kB), aper = lerp(0.0016, 0.0003, kB);
  const kM = inOutC(slice(t, 0.8, 2.0));
  if (kM < 1) { const sm = [0, 0.04, 0.08, 0.12].map((o) => heroTip(t - o)), tip = W2(sm.reduce((a, q) => a + q[0], 0) / 4, sm.reduce((a, q) => a + q[1], 0) / 4, 0), push = 1 - 0.15 * inOutC(slice(t, 0, 0.6));
    pos = v3([tip[0] + 0.55 * push, tip[1] - 0.95 * push, 0.32 * push + 0.06], pos, kM); target = v3([tip[0], tip[1], 0.01], target, kM); up = v3([0, 0, 1], up, kM); fov = lerp(land ? 34 : 46, fov, kM); aper = lerp(0.004, aper, kM); }
  camera.position.set(...pos); camera.up.set(...up).normalize(); camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix(); camera.lookAt(...target);
  bokeh.uniforms.focus.value = camera.position.distanceTo(new THREE.Vector3(...target)); bokeh.uniforms.aperture.value = aper;
  // światło
  const orbit = (-75 + ramp(p, 0.72, 0.95) * 290 + 70 * ramp(t, 4.5, 6.4)) * Math.PI / 180, lk = ramp(p, 0.55, 0.7), sweep = Math.sin(Math.PI * slice(t, 4.0, 5.1)), dr = slice(t, 2.8, 6.4), sideA = 0.25 - 1.1 * inOutC(dr);
  setLF(LF.top, [lerp(-5, 5, inOutC(dr)), 7, 9], 5 * faces);
  setLF(LF.band, [lerp(-3, 3, dr), lerp(3.0, 0.4, dr), 15], 1.9 * faces, Math.PI / 2 + 0.12);
  setLF(LF.sideL, [Math.cos(sideA + Math.PI) * 9, Math.sin(sideA + Math.PI) * 9, 5], 6 * faces, sideA);
  setLF(LF.sideR, [Math.cos(sideA) * 9, Math.sin(sideA) * 9, 5], 4 * faces, sideA);
  setLF(LF.orb, [Math.cos(orbit) * 7, Math.sin(orbit) * 7, 1.6], 14 * lk, orbit);
  setLF(LF.orb2, [Math.cos(orbit + 2.9) * 7, Math.sin(orbit + 2.9) * 7, 1.6], 7 * lk, orbit + 2.9);
  setLF(LF.sweep, [lerp(-3, 3, inOutC(slice(t, 4.0, 5.1))), 0, 16], 22 * sweep);
  if (envRT) envRT.dispose(); envRT = pmrem.fromScene(envScene, 0, 0.1, 100); world.environment = envRT.texture;
  ambient.intensity = 0.03 * (1 - dark); key.intensity = 190 * faces; rim.intensity = 40 * faces;
  edge.position.set(Math.cos(edgeA) * 7.2, Math.sin(edgeA) * 4.8, 0.7); edge.intensity = 46 * edgeK;
  // elementy
  updateDraft(p, t, draftFade); updateLabels(p, t, draftFade); updateContours(p, t, out);
  shards.forEach((m, i) => { const e = outQ(slice(p, SHARD_ORDER[i], SHARD_ORDER[i] + 0.13)); m.visible = e > 0.002; m.scale.set(1, 1, Math.max(0.004, e)); });
  const tau = t - OUTRO_HIT; dots.visible = tau >= 0 && tau < 1.5;
  if (dots.visible) { dotMat.uniforms.tau.value = tau; dotMat.uniforms.R.value = 2.6 + 4.6 * tau; dotMat.uniforms.amp.value = 0.8 * Math.exp(-tau * 0.7); dotMat.uniforms.vis.value = ramp(tau, 0, 0.1) * (1 - ramp(tau, 0.75, 1.45)); }
  finish.uniforms.seed.value = (finish.uniforms.seed.value + 1.37) % 100;
  composer.render();
}

// ——— scroll → czas sceny (z bezwładnością), render tylko gdy coś się zmienia ———
const T_END = 5.3;          // do końca smugi światła; dalej sekcja przechodzi w hasło i tekst (logo-reveal.js)
let tNow = 0, tDrawn = -1, visible = false, size = '', raf = 0;
function resize() { const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(devicePixelRatio || 1, 1.5), key = `${w}x${h}x${dpr}`; if (key === size || !w || !h) return false;
  size = key; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); composer.setPixelRatio(dpr); composer.setSize(w, h); bloom.setSize(w * dpr, h * dpr); lineMats.forEach((m) => m.resolution.set(w * dpr, h * dpr)); return true; }
function tick() { raf = 0; if (!visible) return;
  const progress = parseFloat(scene.dataset.progress || '0') || 0;
  const target = T_END * clamp(progress / 0.6);
  tNow += (target - tNow) * 0.12; if (Math.abs(target - tNow) < 0.0005) tNow = target;
  canvas.style.opacity = String(1 - ramp(progress, 0.6, 0.66));
  const resized = resize();
  if (resized || Math.abs(tNow - tDrawn) > 0.0004) { frame(tNow); tDrawn = tNow; }
  raf = requestAnimationFrame(tick); }
new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(tick); }, { rootMargin: '200px' }).observe(sequence);
document.documentElement.classList.add('cine');
window.__xpreayCine = (t) => { resize(); frame(t); return t; }; // podgląd/test: klatka dla czasu sceny
// eksport statycznego logo (kadr z góry, prawie ortograficzny, dokładnie w obrysie 1000×623) — do wersji 2D/układu z tekstem
window.__xpreayStill = (t, w = 2400) => { const h = Math.round(w * 623 / 1000); frame(t);
  renderer.setPixelRatio(1); renderer.setSize(w, h, false); composer.setPixelRatio(1); composer.setSize(w, h); bloom.setSize(w, h);
  const half = 1.869; camera.aspect = w / h; camera.fov = 2 * Math.atan(half / 60) * 180 / Math.PI; camera.position.set(0, 0, 60 + TOP); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
  bokeh.uniforms.aperture.value = 0; const fog = world.fog; world.fog = null; finish.enabled = false; composer.render(); const url = canvas.toDataURL('image/png'); world.fog = fog; finish.enabled = true; size = ''; return url; };
addEventListener('resize', () => { size = ''; });
}
