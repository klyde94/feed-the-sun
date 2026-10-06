'use strict';
/* Feed the Sun v3 — rendu du sol (vue de côté en 2,5D) et outils partagés avec l'orbite (soleil, déchets, épaves). */
(function () {
  const G = window.FTS3, Wd = G.W;
  const R = (G.R = {});
  const TAU = Math.PI * 2;
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const Z = G.ZONES.ground;
  let cv, ctx, W = 0, H = 0, dpr = 1, k = 1, camX = 0, getState, time = 0, shake = 0, last = 0;
  let shownClean = 0, sunRGB = null, sunFlash = 0, celebrate = 0, travelT = -1, jumpT = -1;
  const arcs = [], launches = [], sparks = [], floaters = [], flares = [];
  let stars = [];

  const rnd = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  Object.assign(R, { rnd, lerp, clamp, mix, rgba, ease, TAU, reduced });
  const sx = x => (x - camX) * k, sy = y => y * k;
  const depth = y => lerp(0.86, 1.12, (y - Z.top) / (Z.bottom - Z.top));
  const ridge = (x, seed, f) => Math.sin(x * f + seed) * 0.5 + Math.sin(x * f * 2.3 + seed * 1.7) * 0.3 + Math.sin(x * f * 5.1 + seed * 0.3) * 0.2;

  R.init = (canvas, stateFn) => {
    cv = canvas; ctx = cv.getContext('2d'); getState = stateFn;
    stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.45, s: rnd(0.5, 1.4), p: rnd(0, TAU) }));
    R.resize(); window.addEventListener('resize', R.resize);
  };
  R.resize = () => {
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height); k = H / 100;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  };
  R.toWorld = (px, py) => ({ x: px / k + camX, y: py / k });
  R.itemAt = (px, py) => {
    const p = R.toWorld(px, py); let best = null, bd = 5;
    for (const it of Wd.Z.ground.items) { const d = Math.hypot(it.x - p.x, it.y - p.y); if (d < bd) { bd = d; best = it; } }
    return best;
  };

  /* ---------- Déchets (partagé avec l'orbite) ---------- */
  R.drawJunk = (c2, kind, x, y, s, a, alpha, gold) => {
    const col = gold ? [255, 206, 84] : G.JUNK[kind].col;
    c2.save(); c2.translate(x, y); c2.rotate(a); c2.globalAlpha = alpha;
    if (gold) { const g = c2.createRadialGradient(0, 0, 0, 0, 0, s * 2.6); g.addColorStop(0, 'rgba(255,214,110,0.55)'); g.addColorStop(1, 'rgba(255,214,110,0)'); c2.fillStyle = g; c2.beginPath(); c2.arc(0, 0, s * 2.6, 0, TAU); c2.fill(); }
    c2.fillStyle = rgba(col, 1); c2.strokeStyle = rgba(mix(col, [0, 0, 0], 0.45), 1); c2.lineWidth = Math.max(1, s * 0.1);
    c2.beginPath();
    if (kind === 'bag') { c2.moveTo(-s, -s * 0.3); c2.quadraticCurveTo(-s * 1.05, s, 0, s); c2.quadraticCurveTo(s * 1.05, s, s, -s * 0.3); c2.quadraticCurveTo(0, -s * 0.75, -s, -s * 0.3); c2.fill(); c2.stroke(); c2.beginPath(); c2.moveTo(-s * 0.2, -s * 0.55); c2.lineTo(0, -s * 1.05); c2.lineTo(s * 0.2, -s * 0.55); c2.stroke(); }
    else if (kind === 'tire') { c2.arc(0, 0, s, 0, TAU); c2.fill(); c2.fillStyle = 'rgba(18,18,20,1)'; c2.beginPath(); c2.arc(0, 0, s * 0.45, 0, TAU); c2.fill(); }
    else if (kind === 'barrel') { c2.fillRect(-s * 0.62, -s, s * 1.24, s * 2); c2.fillStyle = 'rgba(40,30,20,0.6)'; c2.fillRect(-s * 0.62, -s * 0.45, s * 1.24, s * 0.18); c2.fillRect(-s * 0.62, s * 0.3, s * 1.24, s * 0.18); }
    else if (kind === 'can') { c2.fillRect(-s * 0.42, -s * 0.72, s * 0.84, s * 1.44); c2.fillStyle = 'rgba(225,225,230,1)'; c2.fillRect(-s * 0.42, -s * 0.72, s * 0.84, s * 0.24); }
    else if (kind === 'fridge') { c2.fillRect(-s * 0.62, -s, s * 1.24, s * 2); c2.strokeRect(-s * 0.62, -s, s * 1.24, s * 2); c2.beginPath(); c2.moveTo(-s * 0.62, -s * 0.3); c2.lineTo(s * 0.62, -s * 0.3); c2.stroke(); }
    else if (kind === 'sat') { c2.fillStyle = gold ? rgba(col, 1) : 'rgba(70,92,150,1)'; c2.fillRect(-s * 1.8, -s * 0.35, s * 1.1, s * 0.7); c2.fillRect(s * 0.7, -s * 0.35, s * 1.1, s * 0.7); c2.fillStyle = rgba(col, 1); c2.fillRect(-s * 0.55, -s * 0.55, s * 1.1, s * 1.1); }
    else if (kind === 'stage') { c2.fillRect(-s * 1.6, -s * 0.5, s * 2.6, s); c2.fillStyle = 'rgba(70,70,74,1)'; c2.beginPath(); c2.moveTo(s, -s * 0.4); c2.lineTo(s * 1.6, -s * 0.7); c2.lineTo(s * 1.6, s * 0.7); c2.lineTo(s, s * 0.4); c2.fill(); }
    else if (kind === 'panel') { c2.fillRect(-s, -s * 0.55, s * 2, s * 1.1); c2.strokeStyle = 'rgba(160,190,255,0.5)'; c2.beginPath(); c2.moveTo(0, -s * 0.55); c2.lineTo(0, s * 0.55); c2.moveTo(-s, 0); c2.lineTo(s, 0); c2.stroke(); }
    else if (kind === 'bolt') { c2.fillRect(-s * 0.9, -s * 0.25, s * 1.8, s * 0.5); c2.fillRect(-s * 0.9, -s * 0.5, s * 0.4, s); }
    else { c2.globalAlpha = alpha * 0.9; c2.fillRect(-s * 0.36, -s * 0.5, s * 0.72, s * 1.5); c2.fillRect(-s * 0.17, -s * 0.95, s * 0.34, s * 0.48); }
    c2.restore();
  };
  const strip = k2 => (k2.endsWith('*') ? [k2.slice(0, -1), true] : [k2, false]);
  R.strip = strip;

  /* ---------- Soleil (couleur partagée) ---------- */
  R.tickSun = s => { const d = G.SUN[Wd.sunStage(s)]; sunRGB = sunRGB ? mix(sunRGB, d.rgb, 0.02) : d.rgb.slice(); return sunRGB; };
  R.sunColor = () => sunRGB || [255, 98, 66];
  R.time = () => time;
  R.drawSun = (c2, x, y, r, flash, fl, dt) => {
    const c = R.sunColor(); r *= 1 + Math.sin(time * 1.2) * 0.015 + flash * 0.1;
    c2.save(); c2.globalCompositeOperation = 'lighter';
    let g = c2.createRadialGradient(x, y, r * 0.3, x, y, r * 6);
    g.addColorStop(0, rgba(c, 0.6 + flash * 0.3)); g.addColorStop(0.2, rgba(c, 0.2)); g.addColorStop(1, rgba(c, 0));
    c2.fillStyle = g; c2.beginPath(); c2.arc(x, y, r * 6, 0, TAU); c2.fill();
    for (let i = fl.length - 1; i >= 0; i--) {
      const f = fl[i]; f.t += dt / f.life;
      if (f.t >= 1) { fl.splice(i, 1); continue; }
      const q = Math.sin(f.t * Math.PI);
      c2.strokeStyle = rgba(mix(c, [255, 255, 255], 0.3), 0.75 * q); c2.lineWidth = r * 0.14;
      c2.beginPath(); c2.moveTo(x + Math.cos(f.a - 0.3) * r, y + Math.sin(f.a - 0.3) * r);
      c2.quadraticCurveTo(x + Math.cos(f.a) * r * (1 + f.h * q), y + Math.sin(f.a) * r * (1 + f.h * q), x + Math.cos(f.a + 0.3) * r, y + Math.sin(f.a + 0.3) * r); c2.stroke();
    }
    c2.restore();
    g = c2.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.05, x, y, r);
    g.addColorStop(0, '#fffef8'); g.addColorStop(0.5, rgba(mix(c, [255, 255, 255], 0.6), 1)); g.addColorStop(1, rgba(mix(c, [90, 30, 10], 0.1), 1));
    c2.fillStyle = g; c2.beginPath(); c2.arc(x, y, r, 0, TAU); c2.fill();
  };

  /* ---------- Épave scintillante (coordonnées écran, partagée) ---------- */
  R.wreck = null;
  R.spawnWreck = (w, h) => { if (R.wreck) return false; const L2 = Math.random() < 0.5; R.wreck = { x: L2 ? -30 : w + 30, y: h * rnd(0.1, 0.45), vx: (L2 ? 1 : -1) * w / rnd(13, 17), vy: rnd(-0.02, 0.02) * h, a: 0, va: rnd(-1, 1), w }; return true; };
  R.hitWreck = (x, y, coarse) => { const w = R.wreck; if (!w || Math.hypot(x - w.x, y - w.y) > (coarse ? 42 : 30)) return false; R.wreck = null; R.burstAt = { x, y }; return true; };
  R.drawWreck = (c2, dt, sp) => {
    const w = R.wreck; if (!w) return;
    w.x += w.vx * dt; w.y += w.vy * dt; w.a += w.va * dt;
    if (w.x < -60 || w.x > w.w + 60) { R.wreck = null; return; }
    const g = c2.createRadialGradient(w.x, w.y, 0, w.x, w.y, 30);
    g.addColorStop(0, 'rgba(255,214,120,0.6)'); g.addColorStop(1, 'rgba(255,214,120,0)');
    c2.fillStyle = g; c2.beginPath(); c2.arc(w.x, w.y, 30, 0, TAU); c2.fill();
    c2.save(); c2.translate(w.x, w.y); c2.rotate(w.a);
    c2.fillStyle = '#f2c96b'; c2.fillRect(-7, -5, 14, 10); c2.fillStyle = '#ffe7a8'; c2.fillRect(-17, -3, 9, 6); c2.fillRect(8, -3, 9, 6);
    c2.restore();
    if (Math.random() < 0.35) sp.push({ x: w.x + rnd(-10, 10), y: w.y + rnd(-10, 10), vx: rnd(-10, 10), vy: rnd(-10, 10), t: 0, life: 0.6, c: [255, 236, 170] });
  };

  /* ---------- Décor du sol ---------- */
  function sunPos() { return { x: W * 0.6 - camX * k * 0.02, y: H * 0.24, r: Math.min(W, H) * 0.075 }; }
  function drawSky(s, info, dt) {
    const c = shownClean;
    const g = ctx.createLinearGradient(0, 0, 0, sy(Z.top));
    g.addColorStop(0, rgba(mix([30, 22, 28], [18, 34, 80], c), 1)); g.addColorStop(1, rgba(mix([170, 104, 62], info.sky, c), 1));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const st of stars) { ctx.fillStyle = 'rgba(240,240,255,' + (0.35 + 0.3 * Math.sin(time + st.p)) * (1 - c * 0.7) + ')'; ctx.fillRect(st.x * W, st.y * H, st.s, st.s); }
    const sp = sunPos(); R.drawSun(ctx, sp.x, sp.y, sp.r, sunFlash, flares, dt);
    if (c < 0.98) { ctx.fillStyle = rgba([150, 118, 74], 0.32 * (1 - c)); ctx.fillRect(0, sy(40), W, sy(Z.top) - sy(40)); }
  }
  function drawRidge(par, base, amp, f, seed, col) {
    ctx.fillStyle = rgba(col, 1); ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 8; x += 8) { const wx = x / k + camX * par; ctx.lineTo(x, sy(base - amp * (ridge(wx, seed, f) + 1) / 2)); }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  function drawLand(s, info) {
    const c = shownClean, seed = s.planet * 3.1 + 1;
    drawRidge(0.15, 64, 22, 0.035, seed, mix([56, 42, 46], mix(info.grass, [70, 100, 140], 0.55), c));
    drawRidge(0.4, 72, 14, 0.06, seed + 5, mix([74, 56, 46], mix(info.grass, [40, 60, 50], 0.4), c));
    if (c < 0.95) for (let i = 0; i < 5; i++) {
      const x = (i * 70 + 30 - camX * 0.4) * k; if (x < -80 || x > W + 80) continue;
      ctx.fillStyle = rgba([92, 74, 58], 1 - c); ctx.beginPath(); ctx.ellipse(x, sy(72), 9 * k, 4 * k, 0, Math.PI, TAU); ctx.fill();
      for (let j = 0; j < 5; j++) { ctx.fillStyle = rgba(j % 2 ? [150, 140, 120] : [70, 60, 50], 1 - c); ctx.fillRect(x + (j - 2.5) * 2.6 * k, sy(70.5 - (j % 3)), 2 * k, 1.4 * k); }
    }
    const g = ctx.createLinearGradient(0, sy(Z.top - 2), 0, H);
    g.addColorStop(0, rgba(mix([110, 88, 62], info.grass, c), 1)); g.addColorStop(1, rgba(mix([62, 50, 38], mix(info.grass, [20, 40, 20], 0.5), c), 1));
    ctx.fillStyle = g; ctx.fillRect(0, sy(Z.top - 2), W, H);
    ctx.strokeStyle = rgba(mix([150, 120, 84], mix(info.grass, [255, 255, 255], 0.3), c), 0.6); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, sy(Z.top - 2)); ctx.lineTo(W, sy(Z.top - 2)); ctx.stroke();
    for (let wx = Math.floor(camX / 6) * 6; wx < camX + W / k + 6; wx += 6) {
      const h = Math.abs(Math.sin(wx * 12.9898) * 43758.5453) % 1, y = Z.top + h * (Z.bottom - Z.top + 4);
      ctx.fillStyle = c > 0.5 && h > 0.5 ? rgba(mix(info.grass, [255, 255, 255], 0.15), 0.6 * c) : 'rgba(40,30,22,0.35)';
      ctx.fillRect(sx(wx + h * 3), sy(y), (1 + h * 2) * k * 0.6, 0.5 * k);
    }
  }

  /* ---------- Base : rampe, conteneur, conducteur ---------- */
  const rampTop = () => ({ x: Z.ramp + 9, y: Z.top - 28 });
  function drawBase(s) {
    const x0 = Z.ramp - 3, y0 = Z.top - 1, t = rampTop();
    ctx.strokeStyle = '#7d8598'; ctx.lineWidth = 0.9 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx(x0), sy(y0)); ctx.lineTo(sx(t.x), sy(t.y)); ctx.stroke();
    ctx.lineWidth = 0.4 * k; ctx.strokeStyle = '#5b6274';
    for (let i = 1; i < 6; i++) { const q = i / 6, x = lerp(x0, t.x, q), y = lerp(y0, t.y, q); ctx.beginPath(); ctx.moveTo(sx(x), sy(y)); ctx.lineTo(sx(x + 1.5), sy(Z.top)); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,211,107,0.85)'; ctx.beginPath(); ctx.arc(sx(t.x), sy(t.y), 0.9 * k, 0, TAU); ctx.fill();
    if (s.team.operator) drawPerson(sx(Z.ramp + 3), sy(Z.top + 1), depth(Z.top + 1) * k * 0.95, 1, 0, '#5ad1a0', 0, Wd.Z.ground.launching > 0 ? 1 : 0);
    const L2 = Wd.Z.ground.launching, lt = Wd.launchTime(s);
    if (L2 > lt - 0.45) return;
    const drop = L2 > 0 ? clamp(L2 / 0.5, 0, 1) : 0, cw = 9, ch = 6.5, cx = Z.base, cy = Z.top + 1 - drop * 30;
    const fill = s.cont.ground.length / Wd.contCap(s, 'ground');
    ctx.fillStyle = '#2f5d7a'; ctx.fillRect(sx(cx - cw / 2), sy(cy - ch), cw * k, ch * k);
    ctx.fillStyle = '#3d7499'; for (let i = 0; i < 4; i++) ctx.fillRect(sx(cx - cw / 2 + 1 + i * 2.1), sy(cy - ch + 0.6), 0.9 * k, (ch - 1.2) * k);
    ctx.fillStyle = 'rgba(255,211,107,0.9)'; ctx.fillRect(sx(cx - cw / 2), sy(cy + 0.4), cw * k * Math.min(1, fill), 0.7 * k);
    const c = s.cont.ground;
    for (let i = 0; i < Math.min(6, c.length); i++) { const [kk, g] = strip(c[c.length - 1 - i]); R.drawJunk(ctx, kk, sx(cx - 3 + i * 1.2), sy(cy - ch - 0.4), 1.1 * k, i * 0.7, 1, g); }
  }

  /* ---------- Personnages ---------- */
  function drawPerson(x, y, d, dir, sw, vest, load, arm) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, 2.4 * d, 0.7 * d, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    ctx.strokeStyle = '#2c3140'; ctx.lineWidth = 0.9 * d; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-0.5 * d, -4.2 * d); ctx.lineTo(-0.5 * d + sw * 1.2 * d, 0); ctx.moveTo(0.5 * d, -4.2 * d); ctx.lineTo(0.5 * d - sw * 1.2 * d, 0); ctx.stroke();
    const bs = (1.4 + load * 1.6) * d;
    ctx.fillStyle = '#cfcab8'; ctx.beginPath(); ctx.ellipse(-1.6 * d - bs * 0.3, -6.4 * d, bs * 0.8, bs, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = vest; ctx.fillRect(-1.4 * d, -8.6 * d, 2.8 * d, 4.8 * d);
    ctx.fillStyle = '#e9edf2'; ctx.fillRect(-1.4 * d, -7.2 * d, 2.8 * d, 0.45 * d); ctx.fillRect(-1.4 * d, -5.6 * d, 2.8 * d, 0.45 * d);
    ctx.strokeStyle = vest; ctx.lineWidth = 0.7 * d;
    ctx.beginPath(); ctx.moveTo(0.6 * d, -7.8 * d); ctx.lineTo(arm ? 2.2 * d : 1.6 * d - sw * 0.8 * d, arm ? -9.5 * d : -5 * d); ctx.stroke();
    ctx.fillStyle = '#f1f3f7'; ctx.beginPath(); ctx.arc(0, -10 * d, 1.45 * d, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1d2a3a'; ctx.beginPath(); ctx.ellipse(0.65 * d, -10 * d, 0.75 * d, 0.6 * d, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(140,210,255,0.8)'; ctx.fillRect(0.6 * d, -10.3 * d, 0.5 * d, 0.2 * d);
    ctx.restore();
  }
  const VESTS = ['#4fc3a1', '#5aa9e6', '#9b8cf2', '#e6c84f', '#e67fa8'];
  function drawPlayer(s) {
    const p = Wd.player, d = depth(p.y) * k, x = sx(p.x), y = sy(p.y), sw = p.moving ? Math.sin(p.walk) : 0, bob = p.moving ? Math.abs(Math.cos(p.walk)) * 0.3 * d : 0;
    const cap = Wd.bagCap(s);
    drawPerson(x, y - bob, d, p.dir, sw, '#ff8a2a', s.bag.length / cap, 0);
    if (s.bag.length) {
      const n = Math.min(cap, 20), w = Math.min(14, n * 1.1) * k, x0 = x - w / 2;
      for (let i = 0; i < n; i++) { ctx.fillStyle = i < s.bag.length * n / cap ? (s.bag.length >= cap ? '#ffd36b' : '#ece6d9') : 'rgba(255,255,255,0.18)'; ctx.fillRect(x0 + (i / n) * w, y - 13.4 * depth(p.y) * k, Math.max(2, w / n - 1.5), 0.7 * k); }
    }
  }

  /* ---------- Effets ---------- */
  R.fxPickup = e => { if (e.who !== 'me') return; const p = Wd.player; arcs.push({ kind: e.it.kind, gold: e.it.gold, x0: e.it.x, y0: e.it.y, x1: p.x - p.dir * 1.6, y1: p.y - 6.4, t: 0, dur: 0.25 }); };
  R.fxDump = e => { if (e.who !== 'me') return; const p = Wd.player; arcs.push({ kind: 'bag', x0: p.x, y0: p.y - 6.4, x1: Z.base + rnd(-2.5, 2.5), y1: Z.top - 6, t: 0, dur: 0.22 }); };
  R.fxLaunch = e => { launches.push({ t: 0 }); shake = reduced || e.auto ? 0 : 0.5; floaters.push({ text: '+' + e.label + ' $', x: Z.base, y: Z.top - 12, t: 0 }); };
  R.fxClean = () => { celebrate = 1; for (let i = 0; i < 8; i++) burst(rnd(0.1, 0.9) * W, sy(Z.top), [140, 255, 190], 16, 120); };
  R.fxTravel = () => { travelT = 0; shownClean = 0; };
  R.fxJump = () => { jumpT = 0; shownClean = 0; };
  R.fxSunUp = () => { sunFlash = 1; const sp = sunPos(); burst(sp.x, sp.y, R.sunColor(), 80, 200); for (let i = 0; i < 4; i++) flares.push({ a: rnd(0, TAU), t: 0, life: rnd(1.2, 2), h: rnd(1, 1.6) }); };
  R.fxGold = () => { const p = Wd.player; floaters.push({ text: '★', x: p.x, y: p.y - 14, t: 0 }); };
  function burst(x, y, c, n, sp) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(0.3, 1) * sp; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(0.5, 1.3), c }); } }

  function drawArcs(dt) {
    for (let i = arcs.length - 1; i >= 0; i--) {
      const a = arcs[i]; a.t += dt / a.dur;
      if (a.t >= 1) { arcs.splice(i, 1); continue; }
      const q = ease(a.t), x = lerp(a.x0, a.x1, q), y = lerp(a.y0, a.y1, q) - Math.sin(q * Math.PI) * 5;
      R.drawJunk(ctx, a.kind, sx(x), sy(y), G.JUNK[a.kind].size * k * 0.45 * (1 - q * 0.4), q * 4, 1, a.gold);
    }
  }
  function drawLaunches(dt) {
    const sp = sunPos(), t0 = rampTop(), x0 = Z.ramp - 3;
    for (let i = launches.length - 1; i >= 0; i--) {
      const L2 = launches[i]; L2.t += dt;
      let x, y, sc = 1;
      if (L2.t < 0.45) { const q = ease(L2.t / 0.45); x = sx(lerp(Z.base, x0, Math.min(1, q * 2))); y = sy(Z.top - 2); if (q > 0.5) { const r = (q - 0.5) * 2; x = sx(lerp(x0, t0.x, r)); y = sy(lerp(Z.top - 2, t0.y, r)); } }
      else {
        const q = clamp((L2.t - 0.45) / 1.5, 0, 1), e = ease(q), ax = sx(t0.x), ay = sy(t0.y), cx = (ax + sp.x) / 2 - W * 0.05, cy = Math.min(ay, sp.y) - H * 0.12;
        x = (1 - e) * (1 - e) * ax + 2 * (1 - e) * e * cx + e * e * sp.x; y = (1 - e) * (1 - e) * ay + 2 * (1 - e) * e * cy + e * e * sp.y; sc = lerp(1, 0.2, e);
        if (Math.random() < 0.9) sparks.push({ x, y, vx: rnd(-14, 14), vy: rnd(10, 30), t: 0, life: rnd(0.3, 0.7), c: q > 0.7 ? [255, 160, 90] : [255, 220, 170] });
        if (q >= 1) { launches.splice(i, 1); sunFlash = Math.min(1, sunFlash + 0.5); flares.push({ a: rnd(0, TAU), t: 0, life: rnd(1, 1.6), h: rnd(0.8, 1.3) }); burst(sp.x, sp.y, [255, 200, 140], 26, 90); continue; }
      }
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.fillStyle = '#2f5d7a'; ctx.fillRect(-4.5 * k, -3.2 * k, 9 * k, 6.4 * k);
      ctx.fillStyle = 'rgba(255,211,107,0.9)'; ctx.fillRect(-4.5 * k, 2.4 * k, 9 * k, 0.8 * k);
      if (L2.t >= 0.45) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,180,90,0.7)'; ctx.beginPath(); ctx.ellipse(5.5 * k, 2 * k, 3 * k, 1.4 * k, 0.5, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
  R.drawParticles = (c2, dt, sp, fl, toX, toY) => {
    for (let i = sp.length - 1; i >= 0; i--) {
      const p = sp[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t >= p.life) { sp.splice(i, 1); continue; }
      c2.fillStyle = rgba(p.c, 1 - p.t / p.life); c2.fillRect(p.x - 1, p.y - 1, 2.2, 2.2);
    }
    c2.font = '600 15px "Martian Mono", ui-monospace, monospace'; c2.textAlign = 'center';
    for (let i = fl.length - 1; i >= 0; i--) {
      const f = fl[i]; f.t += dt * 0.6;
      if (f.t >= 1) { fl.splice(i, 1); continue; }
      c2.fillStyle = 'rgba(255,224,140,' + (1 - f.t) + ')'; c2.fillText(f.text, toX(f.x), toY(f.y) - f.t * 40);
    }
  };

  /* ---------- Image ---------- */
  R.frame = (now, active) => {
    if (!ctx || !W) return 0;
    const dt = clamp(last ? (now - last) / 1000 : 0.016, 0, 0.05);
    last = Math.max(last, now); time += dt;
    const s = getState();
    R.tickSun(s);
    if (!active) return dt;
    const info = Wd.planetInfo(s);
    shownClean = lerp(shownClean, 1 - Wd.pollution(s), Math.min(1, dt * 2));
    sunFlash = Math.max(0, sunFlash - dt * 1.2); celebrate = Math.max(0, celebrate - dt * 0.5); shake = Math.max(0, shake - dt * 2);
    const viewW = W / k, target = clamp(Wd.player.x - viewW * 0.38, 0, Math.max(0, Z.w - viewW));
    camX = lerp(camX, target, Math.min(1, dt * 5));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 4, rnd(-1, 1) * shake * 4);
    drawSky(s, info, dt);
    drawLand(s, info);
    drawBase(s);
    const list = Wd.Z.ground.items.map(it => ({ y: it.y, f: () => { const pop = clamp((now - it.born) / 250, 0, 1), sz = G.JUNK[it.kind].size * depth(it.y) * k * 0.72; R.drawJunk(ctx, it.kind, sx(it.x), sy(it.y) - sz * 0.97, sz * pop, it.a, 1, it.gold); } }));
    Wd.Z.ground.agents.forEach(a => list.push({ y: a.y, f: () => drawPerson(sx(a.x), sy(a.y), depth(a.y) * k * 0.92, a.dir, a.state === 'return' || a.target ? Math.sin(a.walk) : 0, VESTS[a.hue % VESTS.length], a.load.length / Wd.empCap(s), 0) }));
    list.push({ y: Wd.player.y + 0.01, f: () => drawPlayer(s) });
    list.sort((a, b) => a.y - b.y).forEach(o => o.f());
    drawArcs(dt); drawLaunches(dt);
    R.drawWreck(ctx, dt, sparks);
    if (R.burstAt) { burst(R.burstAt.x, R.burstAt.y, [255, 214, 120], 44, 130); R.burstAt = null; }
    R.drawParticles(ctx, dt, sparks, floaters, sx, sy);
    if (Wd.player.moving && Math.random() < 0.3) sparks.push({ x: sx(Wd.player.x), y: sy(Wd.player.y), vx: rnd(-8, 8), vy: rnd(-8, -2), t: 0, life: 0.4, c: [150, 126, 96] });
    if (celebrate > 0) { ctx.fillStyle = 'rgba(160,255,200,' + celebrate * 0.15 + ')'; ctx.fillRect(0, 0, W, H); }
    if (travelT >= 0) { travelT += dt / 1.6; ctx.fillStyle = 'rgba(4,5,10,' + Math.sin(Math.min(1, travelT) * Math.PI) + ')'; ctx.fillRect(0, 0, W, H); if (travelT >= 1) travelT = -1; }
    if (jumpT >= 0) { jumpT += dt / 2.2; ctx.fillStyle = 'rgba(255,255,255,' + Math.sin(Math.min(1, jumpT) * Math.PI) * 0.9 + ')'; ctx.fillRect(0, 0, W, H); if (jumpT >= 1) jumpT = -1; }
    return dt;
  };
  R.size = () => ({ W, H });
})();
