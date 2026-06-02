const THREE = window.THREE;
const canvas = document.getElementById("mountainCanvas");
const section = canvas?.closest(".hero");

if (THREE && canvas && section && !window.XPREAY_TERRAIN_ACTIVE) {
  window.XPREAY_TERRAIN_ACTIVE = true;
  const CONFIG = {
    segmentsX: 116,
    segmentsZ: 134,
    dprCap: 1.55,
    climbSpeed: 0.85,
    retreatSpeed: 0.24,
    baseAmplitude: 1.9,
    ridgeHeight: 4.9,
    detailHeight: 1.1,
    valleyEnabled: true,
    valleyStrength: 2.2,
    valleyWidth: 7.6,
    valleyWallHeight: 1.3,
    valleyFadeNearSummit: 0.82,
    summitHeight: 11.3,
    summitWidthX: 6.7,
    summitWidthZ: 10.07,
    summitProtection: 0.96,
    rippleAmplitude: 0.95,
    rippleWidthX: 7.8,
    rippleFreqZ: 0.46,
    rippleFreqX: 0.25,
    rippleTiltByY: 1.2,
    pointerInfluenceX: 12.5,
    smoothing: 0.075,
    cameraY: 5.6,
    cameraZ: 16.4,
    lookY: -1.9,
    lookZ: -28.5,
    backgroundTop: "#050505",
    backgroundBottom: "#000000",
    lineColor: "#ffffff",
    lineOpacity: 0.79,
    glowColor: "#ffffff",
    glowOpacity: 0.18,
    markerColor: "#ffffff",
    markerOpacity: 0.95,
    markerHaloOpacity: 0.1,
    fogDensity: 0.048,
    vignetteStrength: 0.9,
    sizeX: 46,
    sizeZ: 92,
    baseLift: -4
  };

  const THEME_VISUALS = {
    dark: {
      lineColor: "#f7faff",
      lineOpacity: 0.9,
      glowColor: "#dfe7ff",
      glowOpacity: 0.3,
      markerColor: "#ffffff",
      markerOpacity: 1,
      markerHaloOpacity: 0.24,
      markerRingOpacity: 0.48,
      fogColor: 0x000000,
      fogDensity: 0.03,
      mobileLineBoost: 0.1,
      mobileGlowBoost: 0.22,
      mobileMarkerHalo: 0.3,
      mobileMarkerRing: 0.56,
      flagColor: "#f05a43",
      flagPoleColor: "#f8f5ec",
      flagOpacity: 1
    },
    light: {
      lineColor: "#182033",
      lineOpacity: 0.62,
      glowColor: "#465fba",
      glowOpacity: 0.08,
      markerColor: "#101318",
      markerOpacity: 0.88,
      markerHaloOpacity: 0.16,
      markerRingOpacity: 0.34,
      fogColor: 0xf8f7f2,
      fogDensity: 0.014,
      mobileLineBoost: 0.06,
      mobileGlowBoost: 0.06,
      mobileMarkerHalo: 0.22,
      mobileMarkerRing: 0.42,
      flagColor: "#d83a32",
      flagPoleColor: "#101318",
      flagOpacity: 0.94
    }
  };
  let currentVisual = THEME_VISUALS.dark;
  const SHOW_SUMMIT_FLAG = false;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, CONFIG.fogDensity);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 140);
  camera.position.set(0, CONFIG.cameraY, CONFIG.cameraZ);
  camera.lookAt(0, CONFIG.lookY, CONFIG.lookZ);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  function fract(x) { return x - Math.floor(x); }
  function hash2(x, y) { return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123); }
  function smoothstep(t) { return t * t * (3 - 2 * t); }
  function clamp01(t) { return Math.max(0, Math.min(1, t)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function valueNoise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = smoothstep(xf);
    const v = smoothstep(yf);
    const a = hash2(xi, yi);
    const b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1);
    const d = hash2(xi + 1, yi + 1);
    const x1 = a + (b - a) * u;
    const x2 = c + (d - c) * u;
    return x1 + (x2 - x1) * v;
  }

  function fbm(x, y) {
    let total = 0;
    let amp = 0.58;
    let freq = 1;
    let norm = 0;

    for (let i = 0; i < 6; i += 1) {
      total += valueNoise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.02;
    }

    return total / norm;
  }

  function gaussian2d(x, z, cx, cz, sx, sz) {
    const dx = (x - cx) / sx;
    const dz = (z - cz) / sz;
    return Math.exp(-(dx * dx + dz * dz));
  }

  function terrainBase(x, worldZ) {
    const chain = Math.exp(-Math.pow(x / 11.5, 2.0));
    const n1 = fbm(x * 0.12 + 17.3, worldZ * 0.026 - 11.2);
    const n2 = fbm(x * 0.05 - 8.1, worldZ * 0.012 + 7.8);
    const n3 = fbm((x + worldZ * 0.18) * 0.05, (worldZ - x * 0.10) * 0.05);

    const ridge1 = Math.pow(1 - Math.abs(n1 * 2 - 1), 2.25);
    const ridge2 = Math.pow(1 - Math.abs(n3 * 2 - 1), 2.8);

    const shoulders = (n2 * 2 - 1) * CONFIG.baseAmplitude;
    const ridges = ridge1 * CONFIG.ridgeHeight * chain + ridge2 * CONFIG.detailHeight * (0.45 + chain * 0.55);
    const falloff = -Math.abs(x) * 0.028;

    return shoulders + ridges + falloff;
  }

  function valleyShape(localX, localZ) {
    if (!CONFIG.valleyEnabled) return 0;

    const centerMask = Math.exp(-Math.pow(localX / CONFIG.valleyWidth, 2.0));
    const leftWall = Math.exp(-Math.pow((localX + CONFIG.valleyWidth * 0.92) / (CONFIG.valleyWidth * 0.54), 2.0));
    const rightWall = Math.exp(-Math.pow((localX - CONFIG.valleyWidth * 0.92) / (CONFIG.valleyWidth * 0.54), 2.0));
    const depthProgress = clamp01(((-localZ) + 6.0) / 30.0);
    const pathProgress = smoothstep(depthProgress);
    const summitFade = 1.0 - clamp01(((-localZ) - 24.0) / 16.0) * CONFIG.valleyFadeNearSummit;
    const trench = -CONFIG.valleyStrength * (0.88 + pathProgress * 0.42) * centerMask;
    const walls = CONFIG.valleyWallHeight * (0.85 + pathProgress * 0.25) * (leftWall + rightWall);

    return (trench + walls) * summitFade;
  }

  function summitShape(localX, localZ, time) {
    const retreat = 0;
    const peakX = 0;
    const peakZ = -25.0 - retreat;
    const main = gaussian2d(localX, localZ, peakX, peakZ, CONFIG.summitWidthX, CONFIG.summitWidthZ);
    const tip = gaussian2d(localX, localZ, peakX, peakZ + 1.4, CONFIG.summitWidthX * 0.38, CONFIG.summitWidthZ * 0.38);
    const leftShoulder = gaussian2d(localX, localZ, peakX - 3.4, peakZ + 4.8, CONFIG.summitWidthX * 0.72, CONFIG.summitWidthZ * 0.72);
    const rightShoulder = gaussian2d(localX, localZ, peakX + 3.0, peakZ + 5.3, CONFIG.summitWidthX * 0.78, CONFIG.summitWidthZ * 0.78);

    return {
      height: main * CONFIG.summitHeight + tip * 4.2 + leftShoulder * 2.1 + rightShoulder * 2.3,
      peakX,
      peakZ
    };
  }

  function cursorRipple(localX, localZ, worldZ, pointerX, pointerY, peakX, peakZ) {
    const cx = pointerX * CONFIG.pointerInfluenceX;
    const dx = localX - cx;
    const xMask = Math.exp(-Math.pow(dx / CONFIG.rippleWidthX, 2.0));
    const depthPhaseTilt = pointerY * CONFIG.rippleTiltByY;
    const waveA = Math.sin(worldZ * CONFIG.rippleFreqZ + dx * CONFIG.rippleFreqX + depthPhaseTilt);
    const waveB = Math.sin(worldZ * (CONFIG.rippleFreqZ * 0.57) - dx * 0.18 + 1.1) * 0.42;
    const warp = (fbm(dx * 0.06 + 21.3, worldZ * 0.022 - 8.7) * 2 - 1) * 0.22;
    const frontBoost = 1.0 + clamp01((localZ + CONFIG.sizeZ * 0.5) / CONFIG.sizeZ) * 0.24;
    const summitProtection = 1.0 - gaussian2d(
      localX, localZ,
      peakX, peakZ,
      CONFIG.summitWidthX * 1.55,
      CONFIG.summitWidthZ * 1.55
    ) * CONFIG.summitProtection;

    return (waveA + waveB + warp) * CONFIG.rippleAmplitude * xMask * frontBoost * summitProtection;
  }

  let terrainGeometry;
  let glowGeometry;
  let terrain;
  let glowTerrain;

  const terrainMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(CONFIG.lineColor),
    wireframe: true,
    transparent: true,
    opacity: CONFIG.lineOpacity
  });

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(CONFIG.glowColor),
    wireframe: true,
    transparent: true,
    opacity: CONFIG.glowOpacity
  });

  function buildGeometry() {
    terrainGeometry?.dispose();
    glowGeometry?.dispose();

    terrainGeometry = new THREE.PlaneGeometry(
      CONFIG.sizeX,
      CONFIG.sizeZ,
      CONFIG.segmentsX,
      CONFIG.segmentsZ
    );

    terrainGeometry.rotateX(-Math.PI / 2);
    glowGeometry = terrainGeometry.clone();

    if (!terrain) {
      terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
      terrain.position.set(0, CONFIG.baseLift, -18.5);
      scene.add(terrain);

      glowTerrain = new THREE.Mesh(glowGeometry, glowMaterial);
      glowTerrain.position.copy(terrain.position);
      glowTerrain.position.y -= 0.08;
      glowTerrain.position.z -= 0.14;
      scene.add(glowTerrain);
    } else {
      terrain.geometry = terrainGeometry;
      glowTerrain.geometry = glowGeometry;
    }
  }

  const marker = new THREE.Group();
  const markerCoreMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(CONFIG.markerColor),
    transparent: true,
    opacity: CONFIG.markerOpacity
  });

  const markerHaloMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(CONFIG.markerColor),
    transparent: true,
    opacity: CONFIG.markerHaloOpacity,
    depthWrite: false
  });

  const markerRingMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(CONFIG.markerColor),
    transparent: true,
    opacity: 0.33,
    depthWrite: false
  });

  const markerCore = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 18), markerCoreMaterial);
  const markerHalo = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 20), markerHaloMaterial);
  const markerRing = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.018, 8, 64), markerRingMaterial);
  markerRing.rotation.x = Math.PI / 2;
  marker.add(markerHalo, markerCore, markerRing);
  marker.visible = false;

  const summitFlag = new THREE.Group();
  const flagPoleMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#f8f5ec"),
    transparent: true,
    opacity: 0.96,
    fog: false,
    toneMapped: false
  });
  function makeFlagTexture() {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 256;
    textureCanvas.height = 112;
    const textureCtx = textureCanvas.getContext("2d");
    const gradient = textureCtx.createLinearGradient(0, 0, textureCanvas.width, textureCanvas.height);
    gradient.addColorStop(0, "#dfe7ff");
    gradient.addColorStop(0.36, "#6b96ff");
    gradient.addColorStop(0.66, "#b879ef");
    gradient.addColorStop(1, "#f05a43");
    textureCtx.fillStyle = gradient;
    textureCtx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
    textureCtx.fillStyle = "rgba(255,255,255,0.28)";
    textureCtx.fillRect(0, 0, textureCanvas.width, 2);
    textureCtx.fillStyle = "rgba(0,0,0,0.22)";
    textureCtx.fillRect(0, textureCanvas.height - 2, textureCanvas.width, 2);
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  const flagTexture = makeFlagTexture();
  const flagMaterial = new THREE.MeshBasicMaterial({
    map: flagTexture,
    color: new THREE.Color("#ffffff"),
    transparent: false,
    opacity: 0.96,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.18, 12), flagPoleMaterial);
  flagPole.position.y = 1.02;
  const flagGeometry = new THREE.PlaneGeometry(2.05, 0.78, 18, 5);
  const flagBase = Float32Array.from(flagGeometry.attributes.position.array);
  const flagMesh = new THREE.Mesh(flagGeometry, flagMaterial);
  flagMesh.position.set(1.04, 1.72, 0);
  flagPole.renderOrder = 20;
  flagMesh.renderOrder = 21;
  summitFlag.renderOrder = 20;
  summitFlag.add(flagPole, flagMesh);
  summitFlag.visible = SHOW_SUMMIT_FLAG;
  if (SHOW_SUMMIT_FLAG) scene.add(summitFlag);
  const flagAnchor = { ready: false, x: 0, y: 0, z: -25 };

  buildGeometry();

  const pointer = { targetX: 0, targetY: 0, x: 0, y: 0 };

  function setPointerFromEvent(clientX, clientY) {
    const rect = section.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((clientY - rect.top) / rect.height) * 2 - 1;
    pointer.targetX = Math.max(-1, Math.min(1, nx));
    pointer.targetY = Math.max(-1, Math.min(1, ny));
  }

  section.addEventListener("pointermove", (event) => setPointerFromEvent(event.clientX, event.clientY));
  section.addEventListener("pointerdown", (event) => setPointerFromEvent(event.clientX, event.clientY));
  section.addEventListener("pointerleave", () => { pointer.targetX = 0; pointer.targetY = 0; });

  function getThemeName() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function applyThemeVisuals() {
    currentVisual = THEME_VISUALS[getThemeName()];
    terrainMaterial.color.set(currentVisual.lineColor);
    glowMaterial.color.set(currentVisual.glowColor);
    markerCoreMaterial.color.set(currentVisual.markerColor);
    markerHaloMaterial.color.set(currentVisual.markerColor);
    markerRingMaterial.color.set(currentVisual.markerColor);
    flagMaterial.color.set("#ffffff");
    flagPoleMaterial.color.set(currentVisual.flagPoleColor);
    flagMaterial.opacity = currentVisual.flagOpacity;
    flagMaterial.needsUpdate = true;
    scene.fog.color.setHex(currentVisual.fogColor);
    scene.fog.density = currentVisual.fogDensity;
    resize();
  }

  function updateTerrain(time) {
    const pos = terrainGeometry.attributes.position;
    const glowPos = glowGeometry.attributes.position;
    const arr = pos.array;
    const glowArr = glowPos.array;
    const travel = reducedMotion ? 0 : time * CONFIG.climbSpeed;

    let bestScore = -Infinity;
    let bestY = -Infinity;
    let bestX = 0;
    let bestZ = -26;

    for (let i = 0; i < pos.count; i += 1) {
      const ix = i * 3;
      const x = arr[ix];
      const localZ = arr[ix + 2];
      const worldZ = localZ - travel;
      const base = terrainBase(x, worldZ);
      const t = clamp01(((-localZ) - 4.0) / 24.0);
      const ascentRamp = smoothstep(t) * 2.25 * Math.exp(-Math.pow(x / 10.5, 2.0));
      const valley = valleyShape(x, localZ);
      const summit = summitShape(x, localZ, time);
      const ripple = cursorRipple(x, localZ, worldZ, pointer.x, pointer.y, summit.peakX, summit.peakZ);
      const y = base + valley + ascentRamp + summit.height + ripple;

      arr[ix + 1] = y;
      glowArr[ix + 1] = y - 0.10;

      const summitScore = summit.height - Math.abs(x - summit.peakX) * 0.05 - Math.abs(localZ - summit.peakZ) * 0.035;
      if (summitScore > bestScore) {
        bestScore = summitScore;
        bestY = y;
        bestX = x;
        bestZ = localZ;
      }
    }

    pos.needsUpdate = true;
    glowPos.needsUpdate = true;
    if (!flagAnchor.ready) {
      flagAnchor.ready = true;
      flagAnchor.x = bestX;
      flagAnchor.y = bestY;
      flagAnchor.z = bestZ;
    } else {
      flagAnchor.x = lerp(flagAnchor.x, bestX, 0.05);
      flagAnchor.y = lerp(flagAnchor.y, bestY, 0.05);
      flagAnchor.z = lerp(flagAnchor.z, bestZ, 0.05);
    }

    marker.position.set(terrain.position.x + flagAnchor.x, terrain.position.y + flagAnchor.y + 0.52, terrain.position.z + flagAnchor.z);
    const pulse = 1 + Math.sin(time * 2.1) * 0.055;
    markerHalo.scale.setScalar(pulse);
    markerRing.scale.setScalar(1 + Math.sin(time * 1.3) * 0.04);

    if (SHOW_SUMMIT_FLAG) {
      summitFlag.position.set(terrain.position.x + flagAnchor.x, terrain.position.y + flagAnchor.y + 0.16, terrain.position.z + flagAnchor.z);
      summitFlag.rotation.y = Math.sin(time * 0.35) * 0.08;
      const flagPos = flagGeometry.attributes.position;
      for (let i = 0; i < flagPos.count; i += 1) {
        const ix = i * 3;
        const x = flagBase[ix];
        const y = flagBase[ix + 1];
        const wave = Math.sin(time * 3.1 + x * 6.0 + y * 2.2) * 0.055;
        flagPos.array[ix + 2] = flagBase[ix + 2] + wave * (0.25 + (x + 0.48));
        flagPos.array[ix + 1] = flagBase[ix + 1] + Math.sin(time * 2.2 + x * 4.0) * 0.018;
      }
      flagPos.needsUpdate = true;
      flagMesh.lookAt(camera.position);
    }
  }

  function resize() {
    const rect = section.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.dprCap);
    camera.aspect = rect.width / rect.height;
    const isMobile = rect.width < 700;
    if (isMobile) {
      terrain.position.x = 4.6;
      glowTerrain.position.x = 4.6;
      terrain.position.z = -17.2;
      glowTerrain.position.z = -17.34;
      terrainMaterial.opacity = Math.min(1, currentVisual.lineOpacity + currentVisual.mobileLineBoost);
      glowMaterial.opacity = Math.min(1, currentVisual.glowOpacity + currentVisual.mobileGlowBoost);
      markerCoreMaterial.opacity = Math.min(1, currentVisual.markerOpacity + 0.05);
      markerHaloMaterial.opacity = currentVisual.mobileMarkerHalo;
      markerRingMaterial.opacity = currentVisual.mobileMarkerRing;
    } else {
      terrain.position.x = 0;
      glowTerrain.position.x = 0;
      terrain.position.z = -18.5;
      glowTerrain.position.z = -18.64;
      terrainMaterial.opacity = currentVisual.lineOpacity;
      glowMaterial.opacity = currentVisual.glowOpacity;
      markerCoreMaterial.opacity = currentVisual.markerOpacity;
      markerHaloMaterial.opacity = currentVisual.markerHaloOpacity;
      markerRingMaterial.opacity = currentVisual.markerRingOpacity;
    }
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(dpr);
    renderer.setSize(rect.width, rect.height, false);
  }

  let active = true;
  const observer = new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting;
    if (active) requestAnimationFrame(animate);
  }, { threshold: 0.05 });

  function animate(now) {
    if (!active) return;

    const time = now * 0.001;
    pointer.x = lerp(pointer.x, pointer.targetX, CONFIG.smoothing);
    pointer.y = lerp(pointer.y, pointer.targetY, CONFIG.smoothing);
    updateTerrain(time);
    camera.position.x = Math.sin(time * 0.22) * 0.05;
    camera.position.y = CONFIG.cameraY + Math.sin(time * 0.14) * 0.03;
    camera.position.z = CONFIG.cameraZ;
    camera.lookAt(Math.sin(time * 0.18) * 0.025, CONFIG.lookY, CONFIG.lookZ);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  resize();
  applyThemeVisuals();
  new MutationObserver(applyThemeVisuals).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });
  addEventListener("resize", resize);
  observer.observe(section);
  requestAnimationFrame(animate);
}
