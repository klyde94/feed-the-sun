'use strict';
/* Feed the Sun — rendu v2 : vue au ras de la planète. Les déchets décollent, filent vers un soleil lointain et y brûlent. */
(function () {
  const F = window.FTS, C = F.C;
  const S = (F.Scene = {});
  const TAU = Math.PI * 2;
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cv, ctx, W = 0, H = 0, dpr = 1, M = 600, getState, fmt;
  let sun = { x: 0, y: 0, r: 0 }, pl = { cx: 0, cy: 0, R: 0, top: 0 }, ship = { x: 0, y: 0, a: 0, s: 10, recoil: 0, flash: 0 };
  let stars = [], bg = null, bgGalaxy = -1, time = 0, last = 0;
  const flights = [], effects = [], sparks = [], floaters = [], flares = [];
  let field = [], fieldPlanet = -1, wreck = null, sunFlash = 0, celebrate = 0, travelT = -1, jumpT = -1;
  let shownPoll = 1, sunRGB = null, texPlanet = -1, texBad = null, texGood = null, texCloud = null, rot = 0;
  const spawnAcc = F.GENS.map(() => 0);

  const rnd = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------- Bruit pour les textures de planète (périodique en x) ---------- */
  function noiseFn(seed) {
    const h = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return v - Math.floor(v); };
    const vn = (x, y, p) => {
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), w = i => ((i % p) + p) % p;
      const a = h(w(ix), iy), b = h(w(ix + 1), iy), c = h(w(ix), iy + 1), d = h(w(ix + 1), iy + 1);
      return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
    };
    return (x, y, p) => { let s = 0, amp = 0.5, f = 1; for (let o = 0; o < 5; o++) { s += amp * vn(x * f, y * f, p * f); amp *= 0.5; f *= 2; } return s / 0.97; };
  }
  const TW = 768, TH = 150;
  function makeTex(fill) {
    const c = document.createElement('canvas'); c.width = TW * 2; c.height = TH;
    const g = c.getContext('2d'), img = g.createImageData(TW, TH), d = img.data;
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) { const k = (y * TW + x) * 4, col = fill(x, y); d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = col[3] == null ? 255 : col[3]; }
    g.putImageData(img, 0, 0); g.putImageData(img, TW, 0);
    return c;
  }
  function buildPlanetTex(n) {
    const info = C.planetInfo(getState(), n), sea = hex(info.sea), land = hex(info.land);
    const nz = noiseFn(n * 13 + 7), nz2 = noiseFn(n * 29 + 3);
    const P = 6, val = (x, y) => [nz(x / TW * P, y / TH * 1.4, P), nz2(x / TW * P * 2, y / TH * 2.8, P * 2)];
    const cache = [];
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) cache.push(val(x, y));
    texBad = makeTex((x, y) => {
      const [a, b] = cache[y * TW + x];
      if (a < 0.5) return mix([58, 54, 40], [96, 86, 58], a * 1.6);
      if (b > 0.68) return mix([46, 40, 33], [150, 138, 112], (b - 0.68) * 3);
      return mix([82, 66, 46], [128, 108, 74], b);
    });
    texGood = makeTex((x, y) => {
      const [a, b] = cache[y * TW + x];
      if (a < 0.47) return mix(mix(sea, [10, 30, 70], 0.45), sea, a * 2);
      if (a < 0.5) return mix(sea, [120, 200, 210], 0.5);
      return mix(land, [176, 160, 110], clamp((b - 0.45) * 2, 0, 1));
    });
    if (!texCloud) {
      const nc = noiseFn(91);
      texCloud = makeTex((x, y) => { const v = nc(x / TW * 8, y / TH * 1.2, 8); return [255, 255, 255, v > 0.55 ? Math.min(220, (v - 0.55) * 900) : 0]; });
    }
    texPlanet = n;
  }

  /* ---------- Débris reconnaissables ---------- */
  const KINDS = ['bag', 'tire', 'barrel', 'can', 'fridge', 'sat', 'stage', 'bottle'];
  const KCOL = { bag: [214, 210, 196], tire: [52, 50, 48], barrel: [196, 150, 52], can: [190, 70, 60], fridge: [222, 222, 214], sat: [150, 170, 196], stage: [200, 196, 186], bottle: [150, 200, 220] };
  function drawJunk(kind, x, y, s, a, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = alpha;
    const c = KCOL[kind]; ctx.fillStyle = rgba(c, 1); ctx.strokeStyle = rgba(mix(c, [0, 0, 0], 0.45), 1); ctx.lineWidth = Math.max(1, s * 0.12);
    ctx.beginPath();
    if (kind === 'bag') { ctx.moveTo(-s, -s * 0.4); ctx.quadraticCurveTo(-s * 0.9, s, 0, s); ctx.quadraticCurveTo(s * 0.9, s, s, -s * 0.4); ctx.lineTo(s * 0.5, -s * 0.9); ctx.lineTo(s * 0.2, -s * 0.4); ctx.lineTo(-s * 0.2, -s * 0.4); ctx.lineTo(-s * 0.5, -s * 0.9); ctx.closePath(); ctx.fill(); }
    else if (kind === 'tire') { ctx.arc(0, 0, s, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(20,20,22,1)'; ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(110,110,110,0.8)'; ctx.beginPath(); ctx.arc(0, 0, s * 0.75, 0, TAU); ctx.stroke(); }
    else if (kind === 'barrel') { ctx.fillRect(-s * 0.6, -s, s * 1.2, s * 2); ctx.fillStyle = 'rgba(40,30,20,0.7)'; ctx.fillRect(-s * 0.6, -s * 0.45, s * 1.2, s * 0.18); ctx.fillRect(-s * 0.6, s * 0.3, s * 1.2, s * 0.18); }
    else if (kind === 'can') { ctx.fillRect(-s * 0.4, -s * 0.7, s * 0.8, s * 1.4); ctx.fillStyle = 'rgba(220,220,225,1)'; ctx.fillRect(-s * 0.4, -s * 0.7, s * 0.8, s * 0.22); }
    else if (kind === 'fridge') { ctx.fillRect(-s * 0.65, -s, s * 1.3, s * 2); ctx.strokeRect(-s * 0.65, -s, s * 1.3, s * 2); ctx.beginPath(); ctx.moveTo(-s * 0.65, -s * 0.3); ctx.lineTo(s * 0.65, -s * 0.3); ctx.stroke(); }
    else if (kind === 'sat') { ctx.fillStyle = 'rgba(70,90,150,1)'; ctx.fillRect(-s * 1.8, -s * 0.35, s * 1.1, s * 0.7); ctx.fillRect(s * 0.7, -s * 0.35, s * 1.1, s * 0.7); ctx.fillStyle = rgba(c, 1); ctx.fillRect(-s * 0.55, -s * 0.55, s * 1.1, s * 1.1); }
    else if (kind === 'stage') { ctx.fillRect(-s * 1.6, -s * 0.5, s * 2.6, s); ctx.fillStyle = 'rgba(70,70,74,1)'; ctx.beginPath(); ctx.moveTo(s, -s * 0.4); ctx.lineTo(s * 1.6, -s * 0.7); ctx.lineTo(s * 1.6, s * 0.7); ctx.lineTo(s, s * 0.4); ctx.fill(); }
    else { ctx.globalAlpha = alpha * 0.85; ctx.fillRect(-s * 0.35, -s * 0.6, s * 0.7, s * 1.5); ctx.fillRect(-s * 0.18, -s, s * 0.36, s * 0.45); }
    ctx.restore();
  }
  function newJunk(fadeIn) {
    const z = rnd(0.35, 1);
    return { kind: KINDS[Math.floor(Math.random() * KINDS.length)], x: rnd(-0.05, 1.05) * W, h: rnd(0.02, 0.3), z, a: rnd(0, TAU), va: rnd(-0.6, 0.6), vx: rnd(4, 12) * z * (Math.random() < 0.5 ? -1 : 1), born: fadeIn ? time : -9 };
  }
  const junkY = j => horizonAt(j.x) - j.h * H * 0.9 - 6;
  const junkSize = j => (6 + j.z * 10) * (M / 650);
  function syncField(st) {
    if (fieldPlanet !== st.planet) { field = []; fieldPlanet = st.planet; }
    const want = Math.round((reduced ? 34 : 64) * shownPoll + (shownPoll > 0.01 ? 4 : 0));
    while (field.length < want) field.push(newJunk(field.length > 0));
    while (field.length > want) field.splice(Math.floor(Math.random() * field.length), 1);
  }

  /* ---------- Mise en place ---------- */
  S.init = (canvas, stateFn, formatFn) => {
    cv = canvas; ctx = cv.getContext('2d'); getState = stateFn; fmt = formatFn;
    stars = Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() < 0.9 ? rnd(0.4, 1.1) : rnd(1.2, 2), p: rnd(0, TAU), w: rnd(0.4, 1.6) }));
    S.resize();
    window.addEventListener('resize', S.resize);
  };
  S.resize = () => {
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height); M = Math.min(W, H);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const land = W >= H * 1.05;
    pl.R = Math.max(W, H) * 1.7;
    pl.cx = W * 0.5; pl.top = H * (land ? 0.74 : 0.7); pl.cy = pl.top + pl.R;
    sun = land ? { x: W * 0.27, y: H * 0.3, r: M * 0.085 } : { x: W * 0.5, y: H * 0.3, r: M * 0.1 };
    ship.s = Math.max(9, M * 0.03);
    bgGalaxy = -1; fieldPlanet = -1;
  };
  function horizonAt(x, off = 0) { const dx = x - pl.cx; return pl.cy + off - Math.sqrt(Math.max(0, pl.R * pl.R - dx * dx)); }

  function buildBg(galaxy) {
    bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
    const b = bg.getContext('2d'); b.scale(dpr, dpr);
    const sky = b.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#03040a'); sky.addColorStop(1, '#0a0d1a');
    b.fillStyle = sky; b.fillRect(0, 0, W, H);
    const hues = [[70, 40, 120], [20, 70, 110], [110, 40, 70], [40, 90, 80], [90, 60, 20]];
    const h1 = hues[galaxy % hues.length], h2 = hues[(galaxy + 2) % hues.length];
    [[0.8, 0.15, h1, 0.5], [0.1, 0.6, h2, 0.55], [0.55, 0.05, h2, 0.3]].forEach(([x, y, c, sz]) => {
      const g = b.createRadialGradient(W * x, H * y, 0, W * x, H * y, Math.max(W, H) * sz);
      g.addColorStop(0, rgba(c, 0.2)); g.addColorStop(1, rgba(c, 0)); b.fillStyle = g; b.fillRect(0, 0, W, H);
    });
    bgGalaxy = galaxy;
  }

  /* ---------- Soleil ---------- */
  function hsl(h) { const f = n => { const k = (n + h / 30) % 12; return 255 * (0.75 - 0.25 * Math.max(-1, Math.min(k - 3, 9 - k, 1))); }; return [f(0), f(8), f(4)].map(Math.round); }
  S.sunColor = () => sunRGB || [255, 98, 66];
  function drawSun(st) {
    const d = F.SUN[C.sunStage(st)], target = d.prism ? hsl((time * 30) % 360) : d.rgb;
    sunRGB = sunRGB ? mix(sunRGB, target, d.prism ? 1 : 0.02) : target.slice();
    const c = sunRGB, r = sun.r * (1 + Math.sin(time * 1.3) * 0.015 + sunFlash * 0.08);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    let g = ctx.createRadialGradient(sun.x, sun.y, r * 0.3, sun.x, sun.y, r * 7);
    g.addColorStop(0, rgba(c, 0.55 + sunFlash * 0.3)); g.addColorStop(0.18, rgba(c, 0.2)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sun.x, sun.y, r * 7, 0, TAU); ctx.fill();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + time * 0.04 + (i % 2) * 0.1, len = r * (2.2 + Math.sin(time * 0.7 + i * 1.7) * 0.6 + (i % 3) * 0.4);
      const rg = ctx.createLinearGradient(sun.x, sun.y, sun.x + Math.cos(a) * len, sun.y + Math.sin(a) * len);
      rg.addColorStop(0, rgba(c, 0.1)); rg.addColorStop(1, rgba(c, 0));
      ctx.strokeStyle = rg; ctx.lineWidth = r * 0.35; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sun.x, sun.y); ctx.lineTo(sun.x + Math.cos(a) * len, sun.y + Math.sin(a) * len); ctx.stroke();
    }
    for (let i = flares.length - 1; i >= 0; i--) {
      const f = flares[i]; f.t += 0.016 / f.life;
      if (f.t >= 1) { flares.splice(i, 1); continue; }
      const k = Math.sin(f.t * Math.PI), x0 = sun.x + Math.cos(f.a - 0.25) * r, y0 = sun.y + Math.sin(f.a - 0.25) * r, x1 = sun.x + Math.cos(f.a + 0.25) * r, y1 = sun.y + Math.sin(f.a + 0.25) * r;
      ctx.strokeStyle = rgba(mix(c, [255, 255, 255], 0.3), 0.7 * k); ctx.lineWidth = r * 0.12;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(sun.x + Math.cos(f.a) * r * (1 + f.h * k), sun.y + Math.sin(f.a) * r * (1 + f.h * k), x1, y1); ctx.stroke();
    }
    ctx.restore();
    g = ctx.createRadialGradient(sun.x - r * 0.25, sun.y - r * 0.25, r * 0.05, sun.x, sun.y, r);
    g.addColorStop(0, '#fffef8'); g.addColorStop(0.5, rgba(mix(c, [255, 255, 255], 0.6), 1)); g.addColorStop(1, rgba(mix(c, [80, 30, 10], 0.12), 1));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sun.x, sun.y, r, 0, TAU); ctx.fill();
  }
  function sunHit(big, c) {
    sunFlash = Math.min(1, sunFlash + (big ? 0.3 : 0.04));
    const a = rnd(0, TAU);
    if (big || Math.random() < 0.08) flares.push({ a, t: 0, life: rnd(0.8, 1.6), h: big ? rnd(0.8, 1.4) : rnd(0.4, 0.8) });
    const n = big ? 22 : 4;
    for (let i = 0; i < n; i++) { const b = a + rnd(-0.8, 0.8), v = rnd(20, big ? 90 : 40); sparks.push({ x: sun.x + Math.cos(a) * sun.r * 0.8, y: sun.y + Math.sin(a) * sun.r * 0.8, vx: Math.cos(b) * v, vy: Math.sin(b) * v, t: 0, life: rnd(0.4, 1), c: c || [255, 220, 160] }); }
  }

  /* ---------- Planète (gros plan) ---------- */
  const AIR_BAD = [190, 150, 90], AIR_GOOD = [110, 180, 255];
  function drawPlanet(st, off, alpha) {
    if (texPlanet !== st.planet) buildPlanetTex(st.planet);
    const clean = 1 - shownPoll, air = mix(AIR_BAD, AIR_GOOD, clean), cy = pl.cy + off;
    ctx.save(); ctx.globalAlpha = alpha;
    let g = ctx.createRadialGradient(pl.cx, cy, pl.R * 0.995, pl.cx, cy, pl.R * 1.05);
    g.addColorStop(0, rgba(air, 0.55)); g.addColorStop(0.3, rgba(air, 0.18)); g.addColorStop(1, rgba(air, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(pl.cx, cy, pl.R, 0, TAU); ctx.clip();
    const slices = 36, span = TW * 0.45, sw = W / slices;
    const drawTex = (tex, a) => {
      if (a <= 0.01) return; ctx.globalAlpha = alpha * a;
      for (let i = 0; i < slices; i++) {
        const x = i * sw, y = Math.min(horizonAt(x, off), horizonAt(x + sw, off)) - 1;
        const sx = (rot + (i / slices) * span) % TW;
        ctx.drawImage(tex, sx, 0, span / slices, TH, x, y, sw + 1, Math.max(4, H - y + 2));
      }
    };
    drawTex(texBad, 1); drawTex(texGood, clean);
    ctx.globalAlpha = alpha * 0.55 * clean;
    for (let i = 0; i < slices; i++) {
      const x = i * sw, y = Math.min(horizonAt(x, off), horizonAt(x + sw, off)) - 1;
      ctx.drawImage(texCloud, (rot * 1.6 + (i / slices) * span) % TW, 0, span / slices, TH, x, y, sw + 1, Math.max(4, H - y + 2));
    }
    ctx.globalAlpha = alpha;
    if (shownPoll > 0.01) { ctx.fillStyle = rgba([120, 100, 62], 0.42 * shownPoll); ctx.fillRect(0, pl.top + off - 40, W, H); }
    g = ctx.createLinearGradient(sun.x, 0, W, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(2,3,12,0.4)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createLinearGradient(0, pl.top + off, 0, H);
    g.addColorStop(0, rgba(air, 0.32)); g.addColorStop(0.08, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,8,0.2)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.strokeStyle = rgba(mix(air, [255, 255, 255], 0.35), 0.5); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(pl.cx, cy, pl.R, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    if (shownPoll > 0.01) {
      g = ctx.createLinearGradient(0, pl.top + off - H * 0.16, 0, pl.top + off + 10);
      g.addColorStop(0, 'rgba(150,126,80,0)'); g.addColorStop(1, rgba([150, 126, 80], 0.45 * shownPoll));
      ctx.fillStyle = g; ctx.fillRect(0, pl.top + off - H * 0.16, W, H * 0.16 + 10);
    }
    if (celebrate > 0) {
      ctx.strokeStyle = rgba([140, 255, 190], 0.7 * celebrate); ctx.lineWidth = 3 + 10 * celebrate;
      ctx.beginPath(); ctx.arc(pl.cx, cy, pl.R + (1 - celebrate) * 40, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    }
    if (st.gens[7] > 0) {
      const x0 = W * 0.12, y0 = horizonAt(x0, off);
      ctx.strokeStyle = 'rgba(143,208,255,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + M * 0.12, y0 - M * 0.07); ctx.moveTo(x0 + 6, y0 + 4); ctx.lineTo(x0 + M * 0.12 + 6, y0 - M * 0.07 + 4); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- Vaisseau ---------- */
  function placeShip() {
    const land = W >= H * 1.05;
    ship.x = W * (land ? 0.72 : 0.7) + Math.sin(time * 0.3) * M * 0.01;
    ship.y = pl.top - M * (land ? 0.14 : 0.12) + Math.sin(time * 0.55) * M * 0.008;
    ship.a = Math.atan2(sun.y - ship.y, sun.x - ship.x);
  }
  function drawShip() {
    const s = ship.s;
    ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.a); ctx.translate(-ship.recoil * s * 0.5, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const eg = ctx.createRadialGradient(-s * 1.3, 0, 0, -s * 1.3, 0, s * 1.1);
    eg.addColorStop(0, 'rgba(140,210,255,0.9)'); eg.addColorStop(1, 'rgba(140,210,255,0)');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.ellipse(-s * 1.4, 0, s * (0.9 + Math.sin(time * 22) * 0.1), s * 0.35, 0, 0, TAU); ctx.fill();
    ctx.restore();
    const hull = ctx.createLinearGradient(0, -s * 0.7, 0, s * 0.7);
    hull.addColorStop(0, '#f2f4fa'); hull.addColorStop(1, '#7d8598');
    ctx.fillStyle = hull;
    ctx.beginPath(); ctx.moveTo(s * 1.2, 0); ctx.lineTo(s * 0.2, s * 0.42); ctx.lineTo(-s * 1, s * 0.75); ctx.lineTo(-s * 0.7, 0); ctx.lineTo(-s * 1, -s * 0.75); ctx.lineTo(s * 0.2, -s * 0.42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a6278'; ctx.fillRect(s * 0.1, -s * 0.13, s * 1.6, s * 0.26);
    ctx.fillStyle = 'rgba(120,220,255,0.9)'; ctx.beginPath(); ctx.ellipse(s * 0.35, 0, s * 0.22, s * 0.12, 0, 0, TAU); ctx.fill();
    if (ship.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,236,190,' + ship.flash + ')'; ctx.beginPath(); ctx.arc(s * 1.9, 0, s * 0.6 * ship.flash + 2, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  /* ---------- Envois vers le soleil ---------- */
  function launch(o) {
    if (flights.length > 170) flights.shift();
    const tx = sun.x + rnd(-0.4, 0.4) * sun.r, ty = sun.y + rnd(-0.4, 0.4) * sun.r;
    const cx = (o.x + tx) / 2 + rnd(-0.15, 0.15) * W, cy = Math.min(o.y, ty) - rnd(0.05, 0.2) * H;
    flights.push(Object.assign({ x0: o.x, y0: o.y, x1: tx, y1: ty, cx, cy, t: 0, a: rnd(0, TAU), va: rnd(-3, 3) }, o));
  }
  const bez = (p, t) => { const u = 1 - t; return [u * u * p.x0 + 2 * u * t * p.cx + t * t * p.x1, u * u * p.y0 + 2 * u * t * p.cy + t * t * p.y1]; };

  S.playerShot = (tonnes, auto) => {
    ship.recoil = 1; ship.flash = 1;
    const s = ship.s, size = clamp(3 + Math.log10(1 + tonnes) * 1.6, 3, 10) * (M / 650) * (auto ? 0.7 : 1);
    launch({ x: ship.x + Math.cos(ship.a) * s * 1.9, y: ship.y + Math.sin(ship.a) * s * 1.9, dur: auto ? 1.3 : 1.5, kind: 'capsule', size, z: 1, color: [255, 226, 170], big: !auto, label: auto ? null : tonnes });
    for (let i = 0; i < 6; i++) sparks.push({ x: ship.x + Math.cos(ship.a) * s * 2, y: ship.y + Math.sin(ship.a) * s * 2, vx: Math.cos(ship.a + rnd(-0.6, 0.6)) * rnd(20, 60), vy: Math.sin(ship.a + rnd(-0.6, 0.6)) * rnd(20, 60), t: 0, life: rnd(0.2, 0.5), c: [255, 230, 180] });
  };

  function capture(i, col) {
    let j;
    if (field.length > 6) j = field.splice(Math.floor(Math.random() * field.length), 1)[0];
    else { j = newJunk(false); j.h = 0; j.z = rnd(0.6, 1); }
    const x = j.x, y = junkY(j), size = junkSize(j);
    const src = i === 1 ? { x: ship.x, y: ship.y } : i === 5 ? { x: W * 0.88, y: horizonAt(W * 0.88) } : i === 6 ? { x: x + rnd(-1, 1) * M * 0.12, y: y - M * 0.1 } : null;
    effects.push({ type: F.GENS[i].id, x, y, t: 0, size, col, src });
    launch({ x, y, dur: rnd(1.7, 2.6), kind: j.kind, size, z: j.z, color: col, delay: 0.3 });
    if (field.length < 70) field.push(newJunk(true));
  }
  function spawnAuto(st, dt) {
    if (st.awaitingTravel || travelT >= 0) return;
    for (let i = 0; i < F.GENS.length; i++) {
      const n = st.gens[i];
      if (!n) continue;
      spawnAcc[i] += Math.min(i < 2 ? 4 : 2.5, 0.35 + Math.log10(1 + n)) * (reduced ? 0.5 : 1) * dt;
      while (spawnAcc[i] >= 1) {
        spawnAcc[i] -= 1;
        const col = hex(F.GENS[i].color);
        if (i === 7) { const x0 = W * 0.12 + M * 0.12, y0 = horizonAt(W * 0.12) - M * 0.07; launch({ x: x0, y: y0, dur: 0.9, kind: 'container', size: 5 * (M / 650), z: 1, color: col }); }
        else capture(i, col);
      }
    }
  }

  function drawEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i]; e.t += dt / 0.4;
      if (e.t >= 1) { effects.splice(i, 1); continue; }
      const k = 1 - e.t, r = e.size * 2.2;
      ctx.strokeStyle = rgba(e.col, 0.85 * k); ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (e.type === 'net') { for (let a = -1; a <= 1; a++) { ctx.moveTo(e.x - r, e.y + a * r * 0.5); ctx.lineTo(e.x + r, e.y + a * r * 0.5); ctx.moveTo(e.x + a * r * 0.5, e.y - r); ctx.lineTo(e.x + a * r * 0.5, e.y + r); } }
      else if (e.type === 'magnet') { ctx.arc(e.x, e.y, r * (0.6 + e.t), 0, TAU); ctx.moveTo(e.x + r * (1.1 + e.t), e.y); ctx.arc(e.x, e.y, r * (1.1 + e.t), 0, TAU); }
      else if (e.type === 'arm') { for (let a = 0; a < 4; a++) { const ang = a * Math.PI / 2 + 0.6; ctx.moveTo(e.x + Math.cos(ang) * r * 1.6, e.y + Math.sin(ang) * r * 1.6); ctx.lineTo(e.x + Math.cos(ang) * r * 0.6, e.y + Math.sin(ang) * r * 0.6); } }
      else if (e.type === 'tether') { ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + r * 0.5, e.y + H * 0.2); }
      else if (e.src) { ctx.lineWidth = e.type === 'laser' ? 2 : 1.4; if (e.type === 'ion') ctx.setLineDash([3, 4]); ctx.moveTo(e.src.x, e.src.y); ctx.lineTo(e.x, e.y); }
      ctx.stroke(); ctx.setLineDash([]);
    }
  }

  function updateFlights(dt) {
    for (let i = flights.length - 1; i >= 0; i--) {
      const p = flights[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.t += dt / p.dur; p.a += p.va * dt;
      if (p.t >= 1) {
        flights.splice(i, 1);
        sunHit(p.big, p.color);
        if (p.label != null && fmt && floaters.length < 20) floaters.push({ x: p.x1 + rnd(-12, 12), y: p.y1 - sun.r * 1.3, t: 0, text: '+' + fmt(p.label) + ' t' });
      }
    }
  }
  function drawFlights() {
    for (const p of flights) {
      if (p.delay > 0) continue;
      const t = ease(Math.min(1, p.t)), [x, y] = bez(p, t), [tx, ty] = bez(p, Math.max(0, t - 0.06));
      const persp = lerp(1, 0.22, t), s = p.size * persp, heat = clamp((t - 0.7) / 0.3, 0, 1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(mix(p.color, [255, 170, 90], heat), 0.45); ctx.lineWidth = Math.max(1, s * 0.7); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      ctx.restore();
      if (p.kind === 'capsule' || p.kind === 'container') {
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(y - ty, x - tx));
        ctx.fillStyle = rgba(mix([235, 238, 245], [255, 190, 120], heat), 1);
        ctx.beginPath(); ctx.ellipse(0, 0, s * (p.kind === 'container' ? 1.2 : 1.1), s * 0.5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = rgba(p.color, 0.9); ctx.fillRect(-s * 0.2, -s * 0.5, s * 0.4, s);
        ctx.restore();
      } else drawJunk(p.kind, x, y, s, p.a, 1);
      if (heat > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba([255, 160, 80], 0.6 * heat); ctx.beginPath(); ctx.arc(x, y, s * 1.6, 0, TAU); ctx.fill(); ctx.restore(); }
    }
  }
  function drawField(dt, off, alpha) {
    for (const j of field) {
      j.x += j.vx * dt; j.a += j.va * dt;
      if (j.x < -0.08 * W) j.x = 1.08 * W; else if (j.x > 1.08 * W) j.x = -0.08 * W;
      const fade = j.born > 0 ? clamp((time - j.born) / 1.2, 0, 1) : 1;
      drawJunk(j.kind, j.x, junkY(j) + off, junkSize(j), j.a, alpha * fade * (0.55 + 0.45 * j.z));
    }
  }
  function drawParticles(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t >= p.life) { sparks.splice(i, 1); continue; }
      ctx.fillStyle = rgba(p.c, 1 - p.t / p.life); ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    ctx.font = '600 13px "Martian Mono", ui-monospace, monospace'; ctx.textAlign = 'center';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.t += dt * 0.7;
      if (f.t >= 1) { floaters.splice(i, 1); continue; }
      ctx.fillStyle = 'rgba(255,248,232,' + (1 - f.t) + ')'; ctx.fillText(f.text, f.x, f.y - f.t * 36);
    }
  }
  function burst(x, y, c, n, speed) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(0.3, 1) * speed; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(0.6, 1.4), c }); } }

  /* ---------- Prochaine planète, visible dans le ciel ---------- */
  function drawNextPlanet(st) {
    const land = W >= H * 1.05, x = W * (land ? 0.86 : 0.84), y = H * (land ? 0.16 : 0.46), r = M * 0.028, info = C.planetInfo(st, st.planet + 1);
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, rgba(mix(hex(info.land), [150, 130, 90], 0.6), 1)); g.addColorStop(1, 'rgba(30,24,20,1)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(200,180,140,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.9, r * 0.45, -0.3, 0, TAU); ctx.stroke();
  }

  /* ---------- Épave scintillante ---------- */
  S.spawnWreck = () => {
    if (wreck) return false;
    const fromLeft = Math.random() < 0.5;
    wreck = { x: fromLeft ? -30 : W + 30, y: H * rnd(0.12, 0.55), vx: (fromLeft ? 1 : -1) * W / rnd(13, 17), vy: rnd(-0.03, 0.03) * H, a: 0, va: rnd(-1, 1) };
    return true;
  };
  S.hasWreck = () => !!wreck;
  S.hitWreck = (x, y, coarse) => {
    if (!wreck || Math.hypot(x - wreck.x, y - wreck.y) > (coarse ? 42 : 30)) return false;
    burst(wreck.x, wreck.y, [255, 214, 120], 44, 130); wreck = null; return true;
  };
  function drawWreck(dt) {
    if (!wreck) return;
    wreck.x += wreck.vx * dt; wreck.y += wreck.vy * dt; wreck.a += wreck.va * dt;
    if (wreck.x < -60 || wreck.x > W + 60) { wreck = null; return; }
    const g = ctx.createRadialGradient(wreck.x, wreck.y, 0, wreck.x, wreck.y, 30);
    g.addColorStop(0, 'rgba(255,214,120,0.6)'); g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(wreck.x, wreck.y, 30, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(wreck.x, wreck.y); ctx.rotate(wreck.a);
    ctx.fillStyle = '#f2c96b'; ctx.fillRect(-7, -5, 14, 10);
    ctx.fillStyle = '#ffe7a8'; ctx.fillRect(-17, -3, 9, 6); ctx.fillRect(8, -3, 9, 6);
    ctx.restore();
    if (Math.random() < 0.35) sparks.push({ x: wreck.x + rnd(-10, 10), y: wreck.y + rnd(-10, 10), vx: rnd(-10, 10), vy: rnd(-10, 10), t: 0, life: 0.6, c: [255, 236, 170] });
  }

  /* ---------- Moments forts ---------- */
  S.cleaned = () => { celebrate = 1; for (let i = 0; i < 6; i++) burst(rnd(0.1, 0.9) * W, pl.top, [140, 255, 190], 18, 140); };
  S.travel = () => { travelT = 0; };
  S.jump = () => { jumpT = 0; };
  S.sunUp = () => { sunFlash = 1; burst(sun.x, sun.y, S.sunColor(), 90, 240); for (let i = 0; i < 4; i++) flares.push({ a: rnd(0, TAU), t: 0, life: rnd(1.2, 2), h: rnd(1, 1.8) }); };
  S.busy = () => travelT >= 0 || jumpT >= 0;

  /* ---------- Image ---------- */
  S.frame = now => {
    if (!ctx || !W) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now; time += dt; rot = (rot + dt * 6) % TW;
    const st = getState();
    shownPoll = lerp(shownPoll, st.awaitingTravel ? 0 : st.planetLeft / C.pollution(st.planet), Math.min(1, dt * 3));
    sunFlash = Math.max(0, sunFlash - dt * 1.4); celebrate = Math.max(0, celebrate - dt * 0.5);
    ship.recoil = Math.max(0, ship.recoil - dt * 6); ship.flash = Math.max(0, ship.flash - dt * 8);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (bgGalaxy !== st.jumps) buildBg(st.jumps);
    ctx.drawImage(bg, 0, 0, W, H);
    const warp = jumpT >= 0 ? Math.sin(Math.min(1, jumpT) * Math.PI) : 0;
    for (const s of stars) {
      const x = s.x * W, y = s.y * H, tw = 0.55 + 0.45 * Math.sin(time * s.w + s.p);
      if (warp > 0.05) { const dx = x - W / 2, dy = y - H / 2; ctx.strokeStyle = 'rgba(235,238,255,0.7)'; ctx.lineWidth = s.s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * warp * 0.6, y + dy * warp * 0.6); ctx.stroke(); }
      else { ctx.fillStyle = 'rgba(235,238,255,' + (0.25 + 0.6 * tw) + ')'; ctx.fillRect(x, y, s.s, s.s); }
    }
    let off = 0, pa = 1;
    if (travelT >= 0) {
      travelT += dt / 2;
      const k = travelT < 0.5 ? travelT * 2 : (1 - travelT) * 2;
      off = ease(clamp(k, 0, 1)) * H * 0.45; pa = 1 - clamp(k, 0, 1) * 0.6;
      if (travelT >= 1) travelT = -1;
    }
    drawSun(st);
    if (!st.awaitingTravel) drawNextPlanet(st);
    syncField(st);
    placeShip();
    spawnAuto(st, dt);
    updateFlights(dt);
    drawFlights();
    drawField(dt, off, pa);
    drawPlanet(st, off, pa);
    drawEffects(dt);
    drawShip();
    drawWreck(dt);
    drawParticles(dt);
    if (jumpT >= 0) {
      jumpT += dt / 2.4;
      ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, warp - 0.55) * 1.8 + ')'; ctx.fillRect(0, 0, W, H);
      if (jumpT >= 1) jumpT = -1;
    }
  };
})();
