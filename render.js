'use strict';
/* Feed the Sun v4 — rendu de la planète ensevelie (vue de dessus) et outils partagés avec l'orbite. */
(function () {
  const G = window.FTS3, Wd = G.W, P = G.PLANET;
  const R = (G.R = {});
  const TAU = Math.PI * 2;
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cv, ctx, W = 0, H = 0, dpr = 1, T = 32, camX = 0, camY = 0, getState, time = 0, last = 0, shake = 0;
  let sunRGB = null, sunFlash = 0, celebrate = 0, fade = -1, combo = { n: 0, t: 9 };
  let chunks = new Map(), chunkKey = '', atlas = null;
  const launches = [], sparks = [], floaters = [], flares = [], bits = [], arcs = [];

  const rnd = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
  Object.assign(R, { rnd, lerp, clamp, mix, rgba, ease, TAU, reduced });
  const sx = x => (x - camX) * T, sy = y => (y - camY) * T;

  R.init = (canvas, stateFn) => { cv = canvas; ctx = cv.getContext('2d'); getState = stateFn; R.resize(); window.addEventListener('resize', R.resize); };
  R.resize = () => {
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    T = Math.round(clamp(Math.min(W / 24, H / 13.5), 24, 52)); chunkKey = '';
  };
  R.size = () => ({ W, H });
  R.toWorld = (px, py) => ({ x: px / T + camX, y: py / T + camY });
  R.itemAt = () => null;
  R.time = () => time;

  /* ---------- Déchets (partagé) ---------- */
  R.drawJunk = (c2, kind, x, y, s, a, alpha, gold) => {
    const base = G.JUNK[kind] ? G.JUNK[kind].col : kind === 'box' ? [178, 136, 88] : kind === 'paper' ? [236, 234, 226] : [120, 160, 120];
    const col = gold ? [255, 206, 84] : base;
    c2.save(); c2.translate(x, y); c2.rotate(a); c2.globalAlpha = alpha;
    if (gold) { const g = c2.createRadialGradient(0, 0, 0, 0, 0, s * 2.6); g.addColorStop(0, 'rgba(255,214,110,0.6)'); g.addColorStop(1, 'rgba(255,214,110,0)'); c2.fillStyle = g; c2.beginPath(); c2.arc(0, 0, s * 2.6, 0, TAU); c2.fill(); }
    c2.fillStyle = rgba(col, 1); c2.strokeStyle = rgba(mix(col, [0, 0, 0], 0.45), 1); c2.lineWidth = Math.max(1, s * 0.1);
    c2.beginPath();
    if (kind === 'bag') { c2.moveTo(-s, -s * 0.3); c2.quadraticCurveTo(-s * 1.05, s, 0, s); c2.quadraticCurveTo(s * 1.05, s, s, -s * 0.3); c2.quadraticCurveTo(0, -s * 0.75, -s, -s * 0.3); c2.fill(); c2.stroke(); }
    else if (kind === 'tire') { c2.arc(0, 0, s, 0, TAU); c2.fill(); c2.fillStyle = 'rgba(18,18,20,1)'; c2.beginPath(); c2.arc(0, 0, s * 0.45, 0, TAU); c2.fill(); }
    else if (kind === 'barrel') { c2.fillRect(-s * 0.62, -s, s * 1.24, s * 2); c2.fillStyle = 'rgba(40,30,20,0.6)'; c2.fillRect(-s * 0.62, -s * 0.45, s * 1.24, s * 0.18); c2.fillRect(-s * 0.62, s * 0.3, s * 1.24, s * 0.18); }
    else if (kind === 'can') { c2.fillRect(-s * 0.42, -s * 0.72, s * 0.84, s * 1.44); c2.fillStyle = 'rgba(225,225,230,1)'; c2.fillRect(-s * 0.42, -s * 0.72, s * 0.84, s * 0.24); }
    else if (kind === 'fridge') { c2.fillRect(-s * 0.62, -s, s * 1.24, s * 2); c2.strokeRect(-s * 0.62, -s, s * 1.24, s * 2); }
    else if (kind === 'box') { c2.fillRect(-s, -s * 0.75, s * 2, s * 1.5); c2.fillStyle = 'rgba(230,210,150,0.9)'; c2.fillRect(-s * 0.15, -s * 0.75, s * 0.3, s * 1.5); }
    else if (kind === 'paper') { c2.moveTo(-s, -s * 0.2); c2.lineTo(-s * 0.3, -s); c2.lineTo(s * 0.8, -s * 0.5); c2.lineTo(s, s * 0.4); c2.lineTo(0, s); c2.lineTo(-s * 0.8, s * 0.6); c2.closePath(); c2.fill(); c2.stroke(); }
    else if (kind === 'sat') { c2.fillStyle = gold ? rgba(col, 1) : 'rgba(70,92,150,1)'; c2.fillRect(-s * 1.8, -s * 0.35, s * 1.1, s * 0.7); c2.fillRect(s * 0.7, -s * 0.35, s * 1.1, s * 0.7); c2.fillStyle = rgba(col, 1); c2.fillRect(-s * 0.55, -s * 0.55, s * 1.1, s * 1.1); }
    else if (kind === 'stage') { c2.fillRect(-s * 1.6, -s * 0.5, s * 2.6, s); }
    else if (kind === 'panel') { c2.fillRect(-s, -s * 0.55, s * 2, s * 1.1); }
    else if (kind === 'bolt') { c2.fillRect(-s * 0.9, -s * 0.25, s * 1.8, s * 0.5); c2.fillRect(-s * 0.9, -s * 0.5, s * 0.4, s); }
    else { c2.globalAlpha = alpha * 0.9; c2.fillRect(-s * 0.36, -s * 0.5, s * 0.72, s * 1.5); c2.fillRect(-s * 0.17, -s * 0.95, s * 0.34, s * 0.48); }
    c2.restore();
  };
  R.strip = k2 => (k2.endsWith('*') ? [k2.slice(0, -1), true] : [k2, false]);

  /* ---------- Le hippie (partagé : la garde-robe l'utilise) ---------- */
  R.drawPerson = (c2, x, y, d, dir, sw, vest, load, arm, outfit, sucking) => {
    c2.fillStyle = 'rgba(0,0,0,0.28)'; c2.beginPath(); c2.ellipse(x, y, 2.4 * d, 0.8 * d, 0, 0, TAU); c2.fill();
    c2.save(); c2.translate(x, y); c2.scale(dir, 1);
    c2.strokeStyle = '#3d5a9e'; c2.lineWidth = 1.1 * d; c2.lineCap = 'round';
    c2.beginPath(); c2.moveTo(-0.5 * d, -4.2 * d); c2.lineTo(-0.7 * d + sw * 1.2 * d, 0); c2.moveTo(0.5 * d, -4.2 * d); c2.lineTo(0.7 * d - sw * 1.2 * d, 0); c2.stroke();
    c2.fillStyle = '#3d5a9e'; c2.beginPath(); c2.moveTo(-1.4 * d + sw * 1.2 * d, 0); c2.lineTo(0 + sw * 1.2 * d, 0); c2.lineTo(-0.5 * d + sw * d, -1 * d); c2.fill();
    if (outfit === 'cape') { c2.fillStyle = '#6b3fb5'; c2.beginPath(); c2.moveTo(-1.2 * d, -8.6 * d); c2.lineTo(1.2 * d, -8.6 * d); c2.lineTo(2.2 * d - sw * 0.6 * d, -1.2 * d); c2.lineTo(-2.6 * d - sw * 0.6 * d, -1.2 * d); c2.closePath(); c2.fill(); }
    c2.fillStyle = '#c9ced8'; c2.fillRect(-2.6 * d, -8.4 * d, 1.4 * d, 3.6 * d); c2.fillStyle = '#8b93a8'; c2.fillRect(-2.6 * d, -8.4 * d, 1.4 * d, 0.5 * d);
    c2.fillStyle = 'rgba(255,214,107,' + (0.4 + 0.6 * Math.min(1, load)) + ')'; c2.fillRect(-2.4 * d, -5.4 * d - 2.4 * d * Math.min(1, load), 1 * d, 2.4 * d * Math.min(1, load));
    const tie = c2.createRadialGradient(0, -6.4 * d, 0.2 * d, 0, -6.4 * d, 2.6 * d);
    tie.addColorStop(0, '#ffd23f'); tie.addColorStop(0.35, '#ff6b9a'); tie.addColorStop(0.65, '#7c5cff'); tie.addColorStop(1, '#3ec5d6');
    c2.fillStyle = vest === '#ff8a2a' ? tie : vest; c2.fillRect(-1.4 * d, -8.6 * d, 2.8 * d, 4.8 * d);
    c2.strokeStyle = '#8b93a8'; c2.lineWidth = 0.35 * d; c2.beginPath(); c2.moveTo(-1.9 * d, -5 * d); c2.quadraticCurveTo(0.5 * d, -3.8 * d, 1.7 * d, -2.6 * d); c2.stroke();
    c2.fillStyle = '#5a6278'; c2.fillRect(1.4 * d, -2.9 * d, 1 * d, 0.6 * d);
    if (sucking) { c2.strokeStyle = 'rgba(255,255,255,0.6)'; c2.lineWidth = 0.2 * d; for (let k = 0; k < 3; k++) { const a = time * 9 + k * 2.1; c2.beginPath(); c2.arc(1.9 * d, -2.2 * d, (0.6 + k * 0.45) * d, a, a + 1.6); c2.stroke(); } }
    c2.fillStyle = '#e8b896'; c2.beginPath(); c2.arc(0, -10 * d, 1.45 * d, 0, TAU); c2.fill();
    if (outfit !== 'astro') { c2.fillStyle = '#7a4a26'; c2.beginPath(); c2.moveTo(-1.6 * d, -10.6 * d); c2.quadraticCurveTo(-2.2 * d, -7.2 * d, -1.5 * d, -6.6 * d); c2.lineTo(-0.6 * d, -8.6 * d); c2.lineTo(-0.4 * d, -11.3 * d); c2.closePath(); c2.fill(); c2.beginPath(); c2.arc(0, -10.4 * d, 1.5 * d, Math.PI * 1.05, Math.PI * 1.95); c2.fill(); }
    c2.fillStyle = '#20232c'; c2.beginPath(); c2.arc(0.55 * d, -10 * d, 0.42 * d, 0, TAU); c2.arc(1.3 * d, -10 * d, 0.36 * d, 0, TAU); c2.fill();
    if (!outfit || outfit === 'helmet') { c2.fillStyle = '#5bbf6a'; c2.fillRect(-1.5 * d, -11.1 * d, 3 * d, 0.45 * d); [[-1, '#ff6b9a'], [0.2, '#ffd23f'], [1.2, '#ffffff']].forEach(([fx, fc]) => { c2.fillStyle = fc; c2.beginPath(); c2.arc(fx * d, -11 * d, 0.38 * d, 0, TAU); c2.fill(); }); }
    else if (outfit === 'goldcap') { c2.fillStyle = '#f2c14e'; for (let k = 0; k < 5; k++) { c2.beginPath(); c2.arc((-1.2 + k * 0.6) * d, -11.1 * d, 0.42 * d, 0, TAU); c2.fill(); } c2.fillStyle = '#fff1b8'; c2.beginPath(); c2.arc(0, -11.3 * d, 0.3 * d, 0, TAU); c2.fill(); }
    else if (outfit === 'astro') { c2.strokeStyle = 'rgba(200,235,255,0.9)'; c2.lineWidth = 0.35 * d; c2.fillStyle = 'rgba(160,220,255,0.18)'; c2.beginPath(); c2.arc(0, -10 * d, 2.2 * d, 0, TAU); c2.fill(); c2.stroke(); c2.fillStyle = 'rgba(255,255,255,0.7)'; c2.fillRect(-1.2 * d, -11.4 * d, 0.6 * d, 0.3 * d); }
    else if (outfit === 'headband') { c2.fillStyle = '#e8453c'; c2.fillRect(-1.5 * d, -11 * d, 3 * d, 0.55 * d); c2.fillStyle = '#ffd23f'; c2.fillRect(-1.5 * d, -10.75 * d, 3 * d, 0.15 * d); }
    else if (outfit === 'chef') { c2.fillStyle = '#ffffff'; c2.fillRect(-1.1 * d, -13.6 * d, 2.2 * d, 2.6 * d); c2.beginPath(); c2.arc(-0.6 * d, -13.6 * d, 0.9 * d, 0, TAU); c2.arc(0.6 * d, -13.6 * d, 0.9 * d, 0, TAU); c2.fill(); }
    else if (outfit === 'nightcap') { c2.fillStyle = '#3d5bd9'; c2.beginPath(); c2.moveTo(-1.5 * d, -10.6 * d); c2.lineTo(1.5 * d, -10.6 * d); c2.quadraticCurveTo(0.5 * d, -13.5 * d, -2.6 * d, -12.4 * d); c2.closePath(); c2.fill(); c2.fillStyle = '#ffffff'; c2.beginPath(); c2.arc(-2.6 * d, -12.4 * d, 0.55 * d, 0, TAU); c2.fill(); }
    c2.restore();
  };

  /* ---------- Soleil, épave, particules (partagés) ---------- */
  R.tickSun = s => { const d = G.SUN[Wd.sunStage(s)]; sunRGB = sunRGB ? mix(sunRGB, d.rgb, 0.02) : d.rgb.slice(); return sunRGB; };
  R.sunColor = () => sunRGB || [255, 98, 66];
  R.drawSun = (c2, x, y, r, flash, fl, dt) => {
    const c = R.sunColor(); r *= 1 + Math.sin(time * 1.2) * 0.015 + flash * 0.1;
    c2.save(); c2.globalCompositeOperation = 'lighter';
    let g = c2.createRadialGradient(x, y, r * 0.3, x, y, r * 6); g.addColorStop(0, rgba(c, 0.6 + flash * 0.3)); g.addColorStop(0.2, rgba(c, 0.2)); g.addColorStop(1, rgba(c, 0));
    c2.fillStyle = g; c2.beginPath(); c2.arc(x, y, r * 6, 0, TAU); c2.fill();
    for (let i = fl.length - 1; i >= 0; i--) {
      const f = fl[i]; f.t += dt / f.life; if (f.t >= 1) { fl.splice(i, 1); continue; }
      const q = Math.sin(f.t * Math.PI); c2.strokeStyle = rgba(mix(c, [255, 255, 255], 0.3), 0.75 * q); c2.lineWidth = r * 0.14;
      c2.beginPath(); c2.moveTo(x + Math.cos(f.a - 0.3) * r, y + Math.sin(f.a - 0.3) * r); c2.quadraticCurveTo(x + Math.cos(f.a) * r * (1 + f.h * q), y + Math.sin(f.a) * r * (1 + f.h * q), x + Math.cos(f.a + 0.3) * r, y + Math.sin(f.a + 0.3) * r); c2.stroke();
    }
    c2.restore();
    g = c2.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.05, x, y, r); g.addColorStop(0, '#fffef8'); g.addColorStop(0.5, rgba(mix(c, [255, 255, 255], 0.6), 1)); g.addColorStop(1, rgba(mix(c, [90, 30, 10], 0.1), 1));
    c2.fillStyle = g; c2.beginPath(); c2.arc(x, y, r, 0, TAU); c2.fill();
  };
  R.wreck = null;
  R.spawnWreck = (w, h) => { if (R.wreck) return false; const l = Math.random() < 0.5; R.wreck = { x: l ? -30 : w + 30, y: h * rnd(0.2, 0.7), vx: (l ? 1 : -1) * w / rnd(13, 17), vy: rnd(-0.02, 0.02) * h, a: 0, va: rnd(-1, 1), w }; return true; };
  R.hitWreck = (x, y, coarse) => { const w = R.wreck; if (!w || Math.hypot(x - w.x, y - w.y) > (coarse ? 42 : 30)) return false; R.wreck = null; R.burstAt = { x, y }; return true; };
  R.drawWreck = (c2, dt, sp) => {
    const w = R.wreck; if (!w) return;
    w.x += w.vx * dt; w.y += w.vy * dt; w.a += w.va * dt; if (w.x < -60 || w.x > w.w + 60) { R.wreck = null; return; }
    const g = c2.createRadialGradient(w.x, w.y, 0, w.x, w.y, 30); g.addColorStop(0, 'rgba(255,214,120,0.6)'); g.addColorStop(1, 'rgba(255,214,120,0)'); c2.fillStyle = g; c2.beginPath(); c2.arc(w.x, w.y, 30, 0, TAU); c2.fill();
    c2.save(); c2.translate(w.x, w.y); c2.rotate(w.a); c2.fillStyle = '#f2c96b'; c2.fillRect(-7, -5, 14, 10); c2.fillStyle = '#ffe7a8'; c2.fillRect(-17, -3, 9, 6); c2.fillRect(8, -3, 9, 6); c2.restore();
    if (Math.random() < 0.35) sp.push({ x: w.x + rnd(-10, 10), y: w.y + rnd(-10, 10), vx: rnd(-10, 10), vy: rnd(-10, 10), t: 0, life: 0.6, c: [255, 236, 170] });
  };
  R.drawParticles = (c2, dt, sp, fl, toX, toY) => {
    for (let i = sp.length - 1; i >= 0; i--) { const p = sp[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t >= p.life) { sp.splice(i, 1); continue; } c2.fillStyle = rgba(p.c, 1 - p.t / p.life); c2.fillRect(p.x - 1, p.y - 1, 2.2, 2.2); }
    c2.font = '600 15px "Martian Mono", ui-monospace, monospace'; c2.textAlign = 'center';
    for (let i = fl.length - 1; i >= 0; i--) { const f = fl[i]; f.t += dt * 0.6; if (f.t >= 1) { fl.splice(i, 1); continue; } c2.fillStyle = 'rgba(255,224,140,' + (1 - f.t) + ')'; c2.fillText(f.text, toX(f.x), toY(f.y) - f.t * 40); }
  };

  /* ---------- Planète : morceaux de carte (8 × 8 tuiles) dessinés à l'avance ---------- */
  const CH = 16, CT = CH / P.CPT;
  const BIOME = {
    prairie: { a: [92, 158, 84], b: [120, 176, 96] }, beach: { a: [218, 198, 150], b: [232, 214, 170] }, forest: { a: [54, 108, 64], b: [72, 128, 74] },
    city: { a: [150, 146, 136], b: [168, 164, 154] }, desert: { a: [214, 164, 104], b: [230, 186, 126] },
  };
  const KINDS = ['bag', 'can', 'bottle', 'tire', 'barrel', 'box', 'paper', 'bag', 'paper', 'can'];
  function buildAtlas(cs) {
    atlas = document.createElement('canvas'); atlas.width = cs * KINDS.length * 2; atlas.height = cs * 2;
    const a = atlas.getContext('2d');
    KINDS.forEach((k, i) => R.drawJunk(a, k, (i * 2 + 1) * cs, cs, cs * 0.42, (i % 3) * 0.6 - 0.5, 1, false));
  }
  function drawTerrain(c2, pl, tx0, ty0) {
    const bio = BIOME[pl.biome];
    for (let ty = ty0; ty < ty0 + CT && ty < P.H; ty++) for (let tx = tx0; tx < tx0 + CT && tx < P.W; tx++) {
      const n = pl.nz2(tx / 9, ty / 9), px = (tx - tx0) * T, py = (ty - ty0) * T;
      let col = mix(bio.a, bio.b, n);
      if (pl.biome === 'beach' && ty > P.H - 7) col = mix([46, 128, 176], [70, 160, 200], (Math.sin(tx * 0.7 + ty) + 1) / 2);
      if (pl.biome === 'city' && (tx % 10 < 2 || ty % 10 < 2)) col = (tx % 10 < 2 && ty % 10 < 2) ? [70, 72, 80] : [62, 64, 72];
      if (pl.biome === 'desert') col = mix(col, [196, 140, 88], (Math.sin(tx * 0.35 + ty * 0.9) + 1) * 0.15);
      c2.fillStyle = rgba(col, 1); c2.fillRect(px, py, T + 1, T + 1);
      const h = hash(tx, ty);
      if (h > 0.7 && pl.biome !== 'city') { c2.fillStyle = rgba(mix(col, [255, 255, 255], 0.18), 0.8); c2.fillRect(px + h * T * 0.7, py + (1 - h) * T * 0.6, 2, 3); }
    }
  }
  function drawDecor(c2, pl, tx0, ty0, top) {
    for (const d of pl.decor) {
      if (d.x < tx0 || d.x >= tx0 + CT || d.y < ty0 || d.y >= ty0 + CT) continue;
      const tall = d.type === 'tree' || d.type === 'palm' || d.type === 'cactus' || d.type === 'lamp';
      if (tall !== top) continue;
      if (!tall && P.amountAt(pl, d.x, d.y) > 0.3) continue;
      const x = (d.x - tx0) * T, y = (d.y - ty0) * T, s = d.s * T;
      if (d.type === 'tree') { c2.fillStyle = 'rgba(0,0,0,0.25)'; c2.beginPath(); c2.ellipse(x + s * 0.15, y + s * 0.25, s * 0.45, s * 0.2, 0, 0, TAU); c2.fill(); c2.fillStyle = '#5a4030'; c2.fillRect(x - s * 0.07, y - s * 0.1, s * 0.14, s * 0.3); c2.fillStyle = pl.biome === 'forest' ? '#2f6b3c' : '#3f8a48'; c2.beginPath(); c2.arc(x, y - s * 0.35, s * 0.5, 0, TAU); c2.fill(); c2.fillStyle = 'rgba(255,255,255,0.12)'; c2.beginPath(); c2.arc(x - s * 0.15, y - s * 0.5, s * 0.2, 0, TAU); c2.fill(); }
      else if (d.type === 'palm') { c2.strokeStyle = '#8a6a3e'; c2.lineWidth = s * 0.12; c2.beginPath(); c2.moveTo(x, y); c2.quadraticCurveTo(x + s * 0.2, y - s * 0.5, x + s * 0.05, y - s * 0.9); c2.stroke(); c2.strokeStyle = '#3f9a52'; c2.lineWidth = s * 0.14; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; c2.beginPath(); c2.moveTo(x + s * 0.05, y - s * 0.9); c2.quadraticCurveTo(x + Math.cos(a) * s * 0.4, y - s * 1.1 + Math.sin(a) * s * 0.2, x + Math.cos(a) * s * 0.6, y - s * 0.75 + Math.sin(a) * s * 0.3); c2.stroke(); } }
      else if (d.type === 'cactus') { c2.fillStyle = '#4f8a4a'; c2.fillRect(x - s * 0.1, y - s * 0.7, s * 0.2, s * 0.7); c2.fillRect(x - s * 0.32, y - s * 0.45, s * 0.14, s * 0.25); c2.fillRect(x + s * 0.18, y - s * 0.55, s * 0.14, s * 0.3); }
      else if (d.type === 'lamp') { c2.fillStyle = '#3a3f4c'; c2.fillRect(x - s * 0.05, y - s * 0.9, s * 0.1, s * 0.9); c2.fillStyle = '#ffe8a0'; c2.beginPath(); c2.arc(x, y - s * 0.95, s * 0.14, 0, TAU); c2.fill(); }
      else if (d.type === 'flower') { [['#ff6b9a', -0.12], ['#ffd23f', 0.12], ['#ffffff', 0]].forEach(([c, o], k) => { c2.fillStyle = c; c2.beginPath(); c2.arc(x + o * s, y - k * s * 0.08, s * 0.08, 0, TAU); c2.fill(); }); }
      else if (d.type === 'shell') { c2.fillStyle = '#f4d6c4'; c2.beginPath(); c2.arc(x, y, s * 0.12, Math.PI, TAU); c2.fill(); }
      else if (d.type === 'mushroom') { c2.fillStyle = '#e8e2d0'; c2.fillRect(x - s * 0.04, y - s * 0.12, s * 0.08, s * 0.12); c2.fillStyle = '#d9483c'; c2.beginPath(); c2.arc(x, y - s * 0.12, s * 0.13, Math.PI, TAU); c2.fill(); }
      else if (d.type === 'bench') { c2.fillStyle = '#7a5a3c'; c2.fillRect(x - s * 0.35, y - s * 0.08, s * 0.7, s * 0.16); }
      else { c2.fillStyle = '#8a8478'; c2.beginPath(); c2.ellipse(x, y, s * 0.22, s * 0.15, 0, 0, TAU); c2.fill(); }
    }
  }
  function drawTrash(c2, pl, cx0, cy0) {
    const cs = T / P.CPT;
    for (let j = cy0; j < cy0 + CH && j < P.GH; j++) for (let i = cx0; i < cx0 + CH && i < P.GW; i++) {
      const v = pl.trash[j * P.GW + i]; if (v <= 0.05) continue;
      const px = (i - cx0) * cs, py = (j - cy0) * cs, h = hash(i, j), vv = v / (G.TRASH_K || 1);
      c2.fillStyle = rgba(mix([118, 98, 72], [46, 38, 32], Math.min(1, vv / 14)), Math.min(0.95, 0.32 + vv * 0.12)); c2.fillRect(px - 1, py - 1, cs + 2, cs + 2);
      const n = Math.min(4, Math.ceil(vv / 1.2));
      for (let k = 0; k < n; k++) { const kk = Math.floor(hash(i + k * 7, j - k * 3) * KINDS.length), ox = hash(i * 3 + k, j) * cs * 0.8 - cs * 0.4, oy = hash(i, j * 5 + k) * cs * 0.8 - cs * 0.4; c2.drawImage(atlas, kk * 2 * cs, 0, cs * 2, cs * 2, px + ox - cs * 0.3, py + oy - cs * 0.3, cs * 1.6, cs * 1.6); }
      if (vv > 7) { c2.fillStyle = 'rgba(20,14,10,' + Math.min(0.42, (vv - 7) * 0.035) + ')'; c2.fillRect(px - 1, py - 1, cs + 2, cs + 2); }
      if (pl.gold[j * P.GW + i] && vv < 2.5) { c2.fillStyle = 'rgba(255,214,90,' + (0.5 + h * 0.4) + ')'; c2.beginPath(); c2.arc(px + cs / 2, py + cs / 2, cs * 0.3, 0, TAU); c2.fill(); }
    }
  }
  function buildChunk(pl, ci, cj) {
    const key = (cj << 8) | ci; let c = chunks.get(key);
    if (!c) { c = document.createElement('canvas'); c.width = CT * T; c.height = CT * T; chunks.set(key, c); }
    const c2 = c.getContext('2d'); c2.clearRect(0, 0, c.width, c.height);
    drawTerrain(c2, pl, ci * CT, cj * CT); drawDecor(c2, pl, ci * CT, cj * CT, false); drawTrash(c2, pl, ci * CH, cj * CH);
    return c;
  }

  /* ---------- Van et rampe ---------- */
  function drawVan(s) {
    const x = sx(P.DEPOT.x), y = sy(P.DEPOT.y), u = T;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + u * 0.2, y + u * 0.75, u * 1.7, u * 0.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f2eee0'; ctx.fillRect(x - u * 1.5, y - u * 0.9, u * 3, u * 0.9);
    ctx.fillStyle = '#e8743b'; ctx.fillRect(x - u * 1.5, y, u * 3, u * 0.7);
    ctx.fillStyle = '#9ad1e8'; ctx.fillRect(x - u * 1.25, y - u * 0.75, u * 0.6, u * 0.5); ctx.fillRect(x - u * 0.45, y - u * 0.75, u * 0.6, u * 0.5); ctx.fillRect(x + u * 0.35, y - u * 0.75, u * 0.75, u * 0.5);
    ctx.fillStyle = '#2b2d36'; ctx.beginPath(); ctx.arc(x - u * 0.9, y + u * 0.72, u * 0.26, 0, TAU); ctx.arc(x + u * 0.9, y + u * 0.72, u * 0.26, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = u * 0.06; ctx.beginPath(); ctx.arc(x, y + u * 0.33, u * 0.22, 0, TAU); ctx.moveTo(x, y + u * 0.11); ctx.lineTo(x, y + u * 0.55); ctx.moveTo(x, y + u * 0.33); ctx.lineTo(x - u * 0.15, y + u * 0.5); ctx.moveTo(x, y + u * 0.33); ctx.lineTo(x + u * 0.15, y + u * 0.5); ctx.stroke();
    [['#ff6b9a', -1.2], ['#ffd23f', 1.15]].forEach(([c, o]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + o * u, y + u * 0.35, u * 0.12, 0, TAU); ctx.fill(); });
    const n = s.contG, cap = Wd.contCap(s, 'ground'), L2 = Wd.Z.ground.launching, lt = Wd.launchTime(s);
    const bx = x + u * 2.1, by = y + u * 0.15;
    ctx.fillStyle = '#3a3f4c'; ctx.beginPath(); ctx.arc(sx(P.PAD.x), sy(P.PAD.y), u * 0.85, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = u * 0.1; ctx.setLineDash([u * 0.22, u * 0.18]); ctx.beginPath(); ctx.arc(sx(P.PAD.x), sy(P.PAD.y), u * 0.68, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (L2 > lt - 0.35) return;
    const drop = L2 > 0 ? clamp(L2 / 0.5, 0, 1) : 0, cy2 = by - drop * u * 3;
    ctx.globalAlpha = 1 - drop * 0.6;
    ctx.fillStyle = '#2f5d7a'; ctx.fillRect(bx - u * 0.75 + u * 1.3, cy2 - u * 0.5, u * 1.5, u * 1.0);
    ctx.fillStyle = 'rgba(255,211,107,0.95)'; ctx.fillRect(bx - u * 0.75 + u * 1.3, cy2 + u * 0.42, u * 1.5 * Math.min(1, n / cap), u * 0.1);
    ctx.globalAlpha = 1;
    ctx.font = '600 ' + Math.max(11, u * 0.3) + 'px "Martian Mono", ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = n >= cap - 0.5 ? '#ffd36b' : 'rgba(255,255,255,0.92)'; ctx.fillText(G.U ? G.U.fmt(n) + '/' + G.U.fmt(cap) : '', bx + u * 1.3, cy2 - u * 0.7);
  }

  /* ---------- Machines ---------- */
  function drawMachine(m, s) {
    const x = sx(m.x), y = sy(m.y), u = T;
    if (m.type === 'robot') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + u * 0.06, y + u * 0.1, u * 0.42, u * 0.3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d7dce6'; ctx.beginPath(); ctx.arc(x, y, u * 0.38, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#5ad1a0'; ctx.lineWidth = u * 0.06; ctx.beginPath(); ctx.arc(x, y, u * 0.3, time * 3, time * 3 + 4); ctx.stroke();
      ctx.fillStyle = m.state === 'home' ? '#ffd36b' : '#5ad1a0'; ctx.beginPath(); ctx.arc(x + Math.cos(m.ang) * u * 0.22, y + Math.sin(m.ang) * u * 0.22, u * 0.07, 0, TAU); ctx.fill();
    } else if (m.type === 'dozer') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(m.ang);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-u * 0.6, -u * 0.45, u * 1.3, u * 1);
      ctx.fillStyle = '#2b2d36'; ctx.fillRect(-u * 0.6, -u * 0.52, u * 1.1, u * 0.2); ctx.fillRect(-u * 0.6, u * 0.32, u * 1.1, u * 0.2);
      ctx.fillStyle = '#f2b41f'; ctx.fillRect(-u * 0.55, -u * 0.35, u * 1, u * 0.7);
      ctx.fillStyle = '#9ad1e8'; ctx.fillRect(-u * 0.35, -u * 0.22, u * 0.35, u * 0.44);
      ctx.fillStyle = '#8b93a8'; ctx.fillRect(u * 0.55, -u * 0.65, u * 0.18, u * 1.3);
      ctx.restore();
    } else {
      const tx = m.tx != null ? sx(m.tx) : x + u, ty = m.tx != null ? sy(m.ty) : y;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - u * 0.7, y - u * 0.4, u * 1.5, u * 1);
      ctx.fillStyle = '#2b2d36'; ctx.fillRect(x - u * 0.75, y - u * 0.55, u * 1.5, u * 1.1);
      ctx.fillStyle = '#e04f3c'; ctx.fillRect(x - u * 0.55, y - u * 0.42, u * 1.1, u * 0.84);
      const lift = m.lift > 0 ? Math.sin((1.2 - m.lift) / 1.2 * Math.PI) : 0;
      ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = u * 0.16; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lerp(x, tx, 0.95), lerp(y, ty, 0.95) - u * (1.6 + lift * 0.8)); ctx.stroke();
      ctx.strokeStyle = 'rgba(200,200,210,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(lerp(x, tx, 0.95), lerp(y, ty, 0.95) - u * (1.6 + lift * 0.8)); ctx.lineTo(tx, ty - u * lift * 1.2); ctx.stroke();
      ctx.fillStyle = '#5a6278'; ctx.beginPath(); ctx.arc(tx, ty - u * lift * 1.2, u * 0.45, 0, TAU); ctx.fill();
      if (lift > 0.05) { ctx.fillStyle = 'rgba(110,92,70,0.95)'; ctx.beginPath(); ctx.ellipse(tx, ty - u * lift * 1.2 + u * 0.4, u * 0.7, u * 0.4, 0, 0, TAU); ctx.fill(); }
    }
    const tank = Wd.machTank(s, m.type);
    if (m.load > 0.5 && m.type !== 'crane') { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x - u * 0.4, y - u * 0.75, u * 0.8, u * 0.09); ctx.fillStyle = m.load >= tank - 0.5 ? '#ffd36b' : '#ece6d9'; ctx.fillRect(x - u * 0.4, y - u * 0.75, u * 0.8 * Math.min(1, m.load / tank), u * 0.09); }
  }

  /* ---------- L'objet rare ---------- */
  function drawNeedle(pl) {
    const nd = pl.needle; if (nd.state !== 'visible') return;
    const x = sx((nd.cx + 0.5) / P.CPT), y = sy((nd.cy + 0.5) / P.CPT), u = T, pulse = 1 + Math.sin(time * 4) * 0.12;
    const g = ctx.createRadialGradient(x, y, 0, x, y, u * 1.4 * pulse); g.addColorStop(0, 'rgba(255,230,140,0.75)'); g.addColorStop(1, 'rgba(255,230,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, u * 1.4 * pulse, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time * 2) * 0.15);
    const item = G.NEEDLES[pl.n % G.NEEDLES.length];
    if (item === 'guitar') { ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.ellipse(0, u * 0.15, u * 0.32, u * 0.38, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#7a4a26'; ctx.fillRect(-u * 0.05, -u * 0.6, u * 0.1, u * 0.6); ctx.fillStyle = '#20232c'; ctx.beginPath(); ctx.arc(0, u * 0.12, u * 0.1, 0, TAU); ctx.fill(); }
    else if (item === 'vinyl') { ctx.fillStyle = '#1b1c22'; ctx.beginPath(); ctx.arc(0, 0, u * 0.42, 0, TAU); ctx.fill(); ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(0, 0, u * 0.14, 0, TAU); ctx.fill(); }
    else if (item === 'peace') { ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = u * 0.1; ctx.beginPath(); ctx.arc(0, 0, u * 0.36, 0, TAU); ctx.moveTo(0, -u * 0.36); ctx.lineTo(0, u * 0.36); ctx.moveTo(0, 0); ctx.lineTo(-u * 0.25, u * 0.25); ctx.moveTo(0, 0); ctx.lineTo(u * 0.25, u * 0.25); ctx.stroke(); }
    else if (item === 'camera') { ctx.fillStyle = '#c9ced8'; ctx.fillRect(-u * 0.4, -u * 0.25, u * 0.8, u * 0.5); ctx.fillStyle = '#20232c'; ctx.beginPath(); ctx.arc(0, 0, u * 0.17, 0, TAU); ctx.fill(); }
    else { ctx.fillStyle = '#ff6b9a'; ctx.beginPath(); ctx.moveTo(-u * 0.18, u * 0.4); ctx.lineTo(u * 0.18, u * 0.4); ctx.lineTo(u * 0.1, -u * 0.35); ctx.lineTo(-u * 0.1, -u * 0.35); ctx.fill(); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, 0, u * 0.08, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  /* ---------- Effets ---------- */
  R.fxSuck = e => { if (reduced || bits.length > 60) return; for (const [i, j] of e.cells.slice(0, 2)) bits.push({ x: (i + 0.5) / P.CPT, y: (j + 0.5) / P.CPT, t: 0, k: KINDS[Math.floor(Math.random() * KINDS.length)] }); };
  R.fxPickup = () => {};
  R.fxDump = e => { if (e.who !== 'me' || arcs.length > 10 || Math.random() < 0.7) return; const p = Wd.player; arcs.push({ x0: p.x, y0: p.y - 0.5, x1: P.DEPOT.x + 2.3, y1: P.DEPOT.y, t: 0, dur: 0.25 }); };
  R.fxCrane = e => { for (let k = 0; k < 6; k++) arcs.push({ x0: e.x + rnd(-0.6, 0.6), y0: e.y - 1, x1: P.DEPOT.x + 2.3, y1: P.DEPOT.y, t: -k * 0.06, dur: 0.7 }); };
  R.fxLaunch = e => { launches.push({ t: 0 }); shake = reduced || e.auto ? 0 : 0.45; floaters.push({ text: '+' + e.label + ' $', x: P.DEPOT.x + 2.3, y: P.DEPOT.y - 1.2, t: 0 }); };
  R.fxClean = () => { celebrate = 1; for (let i = 0; i < 8; i++) burst(rnd(0.1, 0.9) * W, rnd(0.2, 0.8) * H, [140, 255, 190], 18, 140); };
  R.fxTravel = () => { fade = 0; chunkKey = ''; };
  R.fxJump = () => { fade = 0; chunkKey = ''; };
  R.fxSunUp = () => { sunFlash = 1; for (let i = 0; i < 4; i++) flares.push({ a: rnd(0, TAU), t: 0, life: rnd(1.2, 2), h: rnd(1, 1.6) }); };
  R.fxCombo = n => { if (n >= 2) combo = { n, t: 0 }; };
  R.fxGold = () => { const p = Wd.player; floaters.push({ text: '★', x: p.x, y: p.y - 1.4, t: 0 }); };
  R.fxNeedle = () => { const nd = Wd.pl.needle; burst(sx((nd.cx + 0.5) / P.CPT), sy((nd.cy + 0.5) / P.CPT), [255, 230, 140], 60, 160); };
  function burst(x, y, c, n, sp) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(0.3, 1) * sp; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(0.5, 1.3), c }); } }
  const sunPos = () => ({ x: W - Math.min(W, H) * 0.12, y: Math.min(W, H) * 0.14, r: Math.min(W, H) * 0.045 });
  function drawLaunches(dt) {
    const sp = sunPos();
    for (let i = launches.length - 1; i >= 0; i--) {
      const L2 = launches[i]; L2.t += dt;
      let x, y, sc;
      if (L2.t < 0.35) { const q = ease(L2.t / 0.35); x = sx(lerp(P.DEPOT.x + 2.3, P.PAD.x, q)); y = sy(P.DEPOT.y); sc = 1; }
      else {
        const q = clamp((L2.t - 0.35) / 1.5, 0, 1), e = ease(q), ax = sx(P.PAD.x), ay = sy(P.PAD.y);
        x = lerp(ax, sp.x, e); y = lerp(ay, sp.y, e) - Math.sin(e * Math.PI) * H * 0.12; sc = lerp(1.25, 0.2, e);
        if (Math.random() < 0.9) sparks.push({ x, y, vx: rnd(-20, 20), vy: rnd(-5, 30), t: 0, life: rnd(0.3, 0.7), c: q > 0.7 ? [255, 160, 90] : [255, 220, 170] });
        if (q >= 1) { launches.splice(i, 1); sunFlash = Math.min(1, sunFlash + 0.5); flares.push({ a: rnd(0, TAU), t: 0, life: rnd(1, 1.6), h: rnd(0.8, 1.3) }); burst(sp.x, sp.y, [255, 200, 140], 26, 90); continue; }
      }
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.fillStyle = '#2f5d7a'; ctx.fillRect(-T * 0.75, -T * 0.5, T * 1.5, T * 1.0);
      if (L2.t >= 0.35) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,180,90,0.75)'; ctx.beginPath(); ctx.ellipse(0, T * 0.8, T * 0.35, T * 0.7, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }

  /* ---------- Image ---------- */
  R.frame = (now, active) => {
    if (!ctx || !W) return 0;
    const dt = clamp(last ? (now - last) / 1000 : 0.016, 0, 0.05);
    last = Math.max(last, now); time += dt; combo.t += dt;
    const s = getState(); R.tickSun(s);
    if (!active || !Wd.pl) return dt;
    const pl = Wd.pl, key = pl.n + '|' + T;
    if (key !== chunkKey) { chunks = new Map(); buildAtlas(T / P.CPT); chunkKey = key; Wd.dirty.clear(); }
    if (Wd.dirty.has(-1)) { chunks = new Map(); Wd.dirty.clear(); }
    let budget = 6;
    for (const k of Wd.dirty) { if (budget-- <= 0) break; Wd.dirty.delete(k); if (chunks.has(k)) buildChunk(pl, k & 255, k >> 8); }
    sunFlash = Math.max(0, sunFlash - dt * 1.2); celebrate = Math.max(0, celebrate - dt * 0.5); shake = Math.max(0, shake - dt * 2);
    const vw = W / T, vh = H / T, p = Wd.player;
    const cx = clamp(p.x - vw / 2, 0, Math.max(0, P.W - vw)), cy = clamp(p.y - vh / 2, 0, Math.max(0, P.H - vh));
    // caméra posée directement sur le hippie au chargement (ou après un grand saut), puis elle le suit en douceur
    if (Math.abs(cx - camX) > vw * 0.6 || Math.abs(cy - camY) > vh * 0.6) { camX = cx; camY = cy; }
    else { camX = lerp(camX, cx, Math.min(1, dt * 6)); camY = lerp(camY, cy, Math.min(1, dt * 6)); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, W, H);
    if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 4, rnd(-1, 1) * shake * 4);
    const ci0 = Math.max(0, Math.floor(camX / CT)), ci1 = Math.min(Math.ceil(P.W / CT) - 1, Math.floor((camX + vw) / CT)), cj0 = Math.max(0, Math.floor(camY / CT)), cj1 = Math.min(Math.ceil(P.H / CT) - 1, Math.floor((camY + vh) / CT));
    for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) { const k = (cj << 8) | ci; const c = chunks.get(k) || buildChunk(pl, ci, cj); ctx.drawImage(c, Math.round(sx(ci * CT)), Math.round(sy(cj * CT))); }
    drawNeedle(pl);
    const list = [{ y: P.DEPOT.y + 0.5, f: () => drawVan(s) }];
    for (const m of Wd.mach) if (m.x > camX - 3 && m.x < camX + vw + 3 && m.y > camY - 3 && m.y < camY + vh + 3) list.push({ y: m.y, f: () => drawMachine(m, s) });
    for (const d of pl.decor) if ((d.type === 'tree' || d.type === 'palm' || d.type === 'cactus' || d.type === 'lamp') && d.x > camX - 2 && d.x < camX + vw + 2 && d.y > camY - 2 && d.y < camY + vh + 2) list.push({ y: d.y, f: () => { ctx.save(); ctx.translate(Math.round(sx(Math.floor(d.x / CT) * CT)), Math.round(sy(Math.floor(d.y / CT) * CT))); drawDecor(ctx, { decor: [d], biome: pl.biome, trash: pl.trash }, Math.floor(d.x / CT) * CT, Math.floor(d.y / CT) * CT, true); ctx.restore(); } });
    list.push({ y: p.y + 0.01, f: () => {
      const cap = Wd.tankCap(s), x = sx(p.x), y = sy(p.y);
      R.drawPerson(ctx, x, y - (p.moving ? Math.abs(Math.cos(p.walk)) * T * 0.04 : 0), T / 9.5, p.dir, p.moving ? Math.sin(p.walk) : 0, '#ff8a2a', s.tank / cap, 0, s.outfit, p.sucking > 0);
      if (s.tank >= cap - 0.5 && G.U) { ctx.font = '600 ' + Math.max(11, T * 0.3) + 'px "Martian Mono", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd36b'; ctx.fillText(G.U.T('full'), x, y - T * 1.45); }
      if (combo.n >= 2 && combo.t < 1.1) { const al = 1 - combo.t / 1.1, pop = 1 + Math.max(0, 0.35 - combo.t) * 1.5; ctx.save(); ctx.translate(x + T * 0.6, y - T * 1.5 - combo.t * T * 0.4); ctx.scale(pop, pop); ctx.font = Math.max(14, T * 0.42) + 'px Michroma, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,211,107,' + al + ')'; ctx.fillText('×' + combo.n, 0, 0); ctx.restore(); }
    } });
    list.sort((a, b) => a.y - b.y).forEach(o => o.f());
    for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.t += dt / 0.22; if (b.t >= 1) { bits.splice(i, 1); continue; } const q = ease(b.t); R.drawJunk(ctx, b.k, sx(lerp(b.x, p.x + p.dir * 0.2, q)), sy(lerp(b.y, p.y - 0.3, q)), T * 0.12 * (1 - q * 0.6), q * 6, 1, false); }
    for (let i = arcs.length - 1; i >= 0; i--) { const a = arcs[i]; a.t += dt / a.dur; if (a.t < 0) continue; if (a.t >= 1) { arcs.splice(i, 1); continue; } const q = ease(a.t); R.drawJunk(ctx, 'bag', sx(lerp(a.x0, a.x1, q)), sy(lerp(a.y0, a.y1, q)) - Math.sin(q * Math.PI) * T * 1.4, T * 0.16, q * 4, 1, false); }
    const poll = Wd.pollution(s);
    if (poll > 0.02) { ctx.fillStyle = rgba([110, 90, 58], 0.2 * poll); ctx.fillRect(0, 0, W, H); }
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    const sp = sunPos(); R.drawSun(ctx, sp.x, sp.y, sp.r, sunFlash, flares, dt);
    drawLaunches(dt);
    R.drawWreck(ctx, dt, sparks);
    if (R.burstAt) { burst(R.burstAt.x, R.burstAt.y, [255, 214, 120], 44, 130); R.burstAt = null; }
    R.drawParticles(ctx, dt, sparks, floaters, sx, sy);
    if (celebrate > 0) { ctx.fillStyle = 'rgba(160,255,200,' + celebrate * 0.15 + ')'; ctx.fillRect(0, 0, W, H); }
    if (fade >= 0) { fade += dt / 1.6; ctx.fillStyle = 'rgba(4,5,10,' + Math.sin(Math.min(1, fade) * Math.PI) + ')'; ctx.fillRect(0, 0, W, H); if (fade >= 1) fade = -1; }
    return dt;
  };
})();
