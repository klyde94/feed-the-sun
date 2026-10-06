'use strict';
/* Feed the Sun v3 — rendu de la phase au sol : vue de côté en 2,5D avec décor en couches (parallaxe). */
(function () {
  const G = window.FTS3, Wd = G.W;
  const R = (G.R = {});
  const TAU = Math.PI * 2;
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cv, ctx, W = 0, H = 0, dpr = 1, k = 1, camX = 0, getState, time = 0, shake = 0;
  let shownClean = 0, sunRGB = null, sunFlash = 0, celebrate = 0, travelT = -1;
  const arcs = [], launches = [], sparks = [], floaters = [], flares = [];
  let stars = [];

  const rnd = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const sx = x => (x - camX) * k, sy = y => y * k;
  const depth = y => lerp(0.86, 1.12, (y - G.GROUND_TOP) / (G.GROUND_BOTTOM - G.GROUND_TOP));
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
    for (const it of Wd.items) { const d = Math.hypot(it.x - p.x, it.y - p.y); if (d < bd) { bd = d; best = it; } }
    return best;
  };

  /* ---------- Déchets ---------- */
  function drawJunk(kind, x, y, s, a, alpha) {
    const c = G.JUNK[kind].col;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = alpha;
    ctx.fillStyle = rgba(c, 1); ctx.strokeStyle = rgba(mix(c, [0, 0, 0], 0.45), 1); ctx.lineWidth = Math.max(1, s * 0.1);
    ctx.beginPath();
    if (kind === 'bag') { ctx.moveTo(-s, -s * 0.3); ctx.quadraticCurveTo(-s * 1.05, s, 0, s); ctx.quadraticCurveTo(s * 1.05, s, s, -s * 0.3); ctx.quadraticCurveTo(0, -s * 0.75, -s, -s * 0.3); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.55); ctx.lineTo(0, -s * 1.05); ctx.lineTo(s * 0.2, -s * 0.55); ctx.stroke(); }
    else if (kind === 'tire') { ctx.arc(0, 0, s, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(18,18,20,1)'; ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(120,120,120,0.8)'; ctx.beginPath(); ctx.arc(0, 0, s * 0.75, 0, TAU); ctx.stroke(); }
    else if (kind === 'barrel') { ctx.fillRect(-s * 0.62, -s, s * 1.24, s * 2); ctx.fillStyle = 'rgba(40,30,20,0.7)'; ctx.fillRect(-s * 0.62, -s * 0.45, s * 1.24, s * 0.18); ctx.fillRect(-s * 0.62, s * 0.3, s * 1.24, s * 0.18); ctx.fillStyle = 'rgba(30,30,30,0.85)'; ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.22, 0, TAU); ctx.fill(); }
    else if (kind === 'can') { ctx.fillRect(-s * 0.42, -s * 0.72, s * 0.84, s * 1.44); ctx.fillStyle = 'rgba(225,225,230,1)'; ctx.fillRect(-s * 0.42, -s * 0.72, s * 0.84, s * 0.24); }
    else if (kind === 'fridge') { ctx.fillRect(-s * 0.62, -s, s * 1.24, s * 2); ctx.strokeRect(-s * 0.62, -s, s * 1.24, s * 2); ctx.beginPath(); ctx.moveTo(-s * 0.62, -s * 0.3); ctx.lineTo(s * 0.62, -s * 0.3); ctx.moveTo(s * 0.4, -s * 0.8); ctx.lineTo(s * 0.4, -s * 0.5); ctx.stroke(); }
    else { ctx.globalAlpha = alpha * 0.9; ctx.fillRect(-s * 0.36, -s * 0.5, s * 0.72, s * 1.5); ctx.fillRect(-s * 0.17, -s * 0.95, s * 0.34, s * 0.48); }
    ctx.restore();
  }

  /* ---------- Ciel, soleil, décor ---------- */
  function sunPos() { return { x: W * 0.6 - camX * k * 0.02, y: H * 0.24, r: Math.min(W, H) * 0.075 }; }
  R.sunColor = () => sunRGB || [255, 98, 66];
  function drawSky(s, info) {
    const c = shownClean;
    const g = ctx.createLinearGradient(0, 0, 0, sy(G.GROUND_TOP));
    g.addColorStop(0, rgba(mix([30, 22, 28], [18, 34, 80], c), 1));
    g.addColorStop(1, rgba(mix([170, 104, 62], info.sky, c), 1));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const st of stars) { ctx.fillStyle = 'rgba(240,240,255,' + (0.35 + 0.3 * Math.sin(time + st.p)) * (1 - c * 0.7) + ')'; ctx.fillRect(st.x * W, st.y * H, st.s, st.s); }
    const sp = sunPos(), d = G.SUN[Wd.sunStage(s)];
    sunRGB = sunRGB ? mix(sunRGB, d.rgb, 0.02) : d.rgb.slice();
    const r = sp.r * (1 + Math.sin(time * 1.2) * 0.015 + sunFlash * 0.1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    let gl = ctx.createRadialGradient(sp.x, sp.y, r * 0.3, sp.x, sp.y, r * 6);
    gl.addColorStop(0, rgba(sunRGB, 0.6 + sunFlash * 0.3)); gl.addColorStop(0.2, rgba(sunRGB, 0.2)); gl.addColorStop(1, rgba(sunRGB, 0));
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sp.x, sp.y, r * 6, 0, TAU); ctx.fill();
    for (let i = flares.length - 1; i >= 0; i--) {
      const f = flares[i]; f.t += 0.016 / f.life;
      if (f.t >= 1) { flares.splice(i, 1); continue; }
      const q = Math.sin(f.t * Math.PI);
      ctx.strokeStyle = rgba(mix(sunRGB, [255, 255, 255], 0.3), 0.75 * q); ctx.lineWidth = r * 0.14;
      ctx.beginPath(); ctx.moveTo(sp.x + Math.cos(f.a - 0.3) * r, sp.y + Math.sin(f.a - 0.3) * r);
      ctx.quadraticCurveTo(sp.x + Math.cos(f.a) * r * (1 + f.h * q), sp.y + Math.sin(f.a) * r * (1 + f.h * q), sp.x + Math.cos(f.a + 0.3) * r, sp.y + Math.sin(f.a + 0.3) * r); ctx.stroke();
    }
    ctx.restore();
    gl = ctx.createRadialGradient(sp.x - r * 0.25, sp.y - r * 0.25, r * 0.05, sp.x, sp.y, r);
    gl.addColorStop(0, '#fffef8'); gl.addColorStop(0.5, rgba(mix(sunRGB, [255, 255, 255], 0.6), 1)); gl.addColorStop(1, rgba(mix(sunRGB, [90, 30, 10], 0.1), 1));
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, TAU); ctx.fill();
    if (c < 0.98) { ctx.fillStyle = rgba([150, 118, 74], 0.32 * (1 - c)); ctx.fillRect(0, sy(40), W, sy(G.GROUND_TOP) - sy(40)); }
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
    if (c < 0.95) {
      const a = 1 - c;
      for (let i = 0; i < 6; i++) {
        const wx = i * 70 + 30, x = (wx - camX * 0.4) * k;
        if (x < -80 || x > W + 80) continue;
        ctx.fillStyle = rgba([92, 74, 58], a); ctx.beginPath(); ctx.ellipse(x, sy(72), 9 * k, 4 * k, 0, Math.PI, TAU); ctx.fill();
        for (let j = 0; j < 5; j++) { ctx.fillStyle = rgba(j % 2 ? [150, 140, 120] : [70, 60, 50], a); ctx.fillRect(x + (j - 2.5) * 2.6 * k, sy(70.5 - (j % 3)), 2 * k, 1.4 * k); }
      }
    }
    const g = ctx.createLinearGradient(0, sy(G.GROUND_TOP - 2), 0, H);
    g.addColorStop(0, rgba(mix([110, 88, 62], info.grass, c), 1)); g.addColorStop(1, rgba(mix([62, 50, 38], mix(info.grass, [20, 40, 20], 0.5), c), 1));
    ctx.fillStyle = g; ctx.fillRect(0, sy(G.GROUND_TOP - 2), W, H);
    ctx.strokeStyle = rgba(mix([150, 120, 84], mix(info.grass, [255, 255, 255], 0.3), c), 0.6); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, sy(G.GROUND_TOP - 2)); ctx.lineTo(W, sy(G.GROUND_TOP - 2)); ctx.stroke();
    for (let wx = Math.floor(camX / 6) * 6; wx < camX + W / k + 6; wx += 6) {
      const h = Math.abs(Math.sin(wx * 12.9898) * 43758.5453) % 1, y = G.GROUND_TOP + h * (G.GROUND_BOTTOM - G.GROUND_TOP + 4);
      ctx.fillStyle = c > 0.5 && h > 0.5 ? rgba(mix(info.grass, [255, 255, 255], 0.15), 0.6 * c) : 'rgba(40,30,22,0.35)';
      ctx.fillRect(sx(wx + h * 3), sy(y), (1 + h * 2) * k * 0.6, 0.5 * k);
    }
  }

  /* ---------- Base : rampe et conteneur ---------- */
  const rampTop = () => ({ x: G.RAMP_X + 9, y: G.GROUND_TOP - 28 });
  function drawBase(s) {
    const x0 = G.RAMP_X - 3, y0 = G.GROUND_TOP - 1, t = rampTop();
    ctx.strokeStyle = '#7d8598'; ctx.lineWidth = 0.9 * k; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx(x0), sy(y0)); ctx.lineTo(sx(t.x), sy(t.y)); ctx.stroke();
    ctx.lineWidth = 0.4 * k; ctx.strokeStyle = '#5b6274';
    for (let i = 1; i < 6; i++) { const q = i / 6, x = lerp(x0, t.x, q), y = lerp(y0, t.y, q); ctx.beginPath(); ctx.moveTo(sx(x), sy(y)); ctx.lineTo(sx(x + 1.5), sy(G.GROUND_TOP)); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,211,107,0.85)'; ctx.beginPath(); ctx.arc(sx(t.x), sy(t.y), 0.9 * k, 0, TAU); ctx.fill();
    const drop = Wd.launching > 0 ? clamp((Wd.launching - 0.15) / 0.5, 0, 1) : 0;
    const cw = 9, ch = 6.5, cx = G.BASE_X, cy = G.GROUND_TOP + 1 - drop * 30;
    if (Wd.launching > 1.0) return;
    const fill = s.cont.length / Wd.contCap(s);
    ctx.fillStyle = '#2f5d7a'; ctx.fillRect(sx(cx - cw / 2), sy(cy - ch), cw * k, ch * k);
    ctx.fillStyle = '#3d7499'; for (let i = 0; i < 4; i++) ctx.fillRect(sx(cx - cw / 2 + 1 + i * 2.1), sy(cy - ch + 0.6), 0.9 * k, (ch - 1.2) * k);
    ctx.fillStyle = rgba([255, 211, 107], 0.9); ctx.fillRect(sx(cx - cw / 2), sy(cy + 0.4), cw * k * fill, 0.7 * k);
    for (let i = 0; i < Math.min(6, s.cont.length); i++) drawJunk(s.cont[s.cont.length - 1 - i], sx(cx - 3 + i * 1.2), sy(cy - ch - 0.4), 1.1 * k, i * 0.7, 1);
  }

  /* ---------- Éboueur ---------- */
  function drawPlayer(s) {
    const p = Wd.player, d = depth(p.y) * k, x = sx(p.x), y = sy(p.y), sw = p.moving ? Math.sin(p.walk) : 0, bob = p.moving ? Math.abs(Math.cos(p.walk)) * 0.3 * d : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, 2.4 * d, 0.7 * d, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y - bob); ctx.scale(p.dir, 1);
    ctx.strokeStyle = '#2c3140'; ctx.lineWidth = 0.9 * d; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-0.5 * d, -4.2 * d); ctx.lineTo(-0.5 * d + sw * 1.2 * d, 0); ctx.moveTo(0.5 * d, -4.2 * d); ctx.lineTo(0.5 * d - sw * 1.2 * d, 0); ctx.stroke();
    const fillRatio = s.bag.length / Wd.bagCap(s), bs = (1.4 + fillRatio * 1.6) * d;
    ctx.fillStyle = '#cfcab8'; ctx.beginPath(); ctx.ellipse(-1.6 * d - bs * 0.3, -6.4 * d, bs * 0.8, bs, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-1.4 * d, -8.6 * d, 2.8 * d, 4.8 * d, 0.8 * d) : ctx.rect(-1.4 * d, -8.6 * d, 2.8 * d, 4.8 * d); ctx.fill();
    ctx.fillStyle = '#e9edf2'; ctx.fillRect(-1.4 * d, -7.2 * d, 2.8 * d, 0.45 * d); ctx.fillRect(-1.4 * d, -5.6 * d, 2.8 * d, 0.45 * d);
    ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = 0.7 * d;
    ctx.beginPath(); ctx.moveTo(0.6 * d, -7.8 * d); ctx.lineTo(1.6 * d - sw * 0.8 * d, -5 * d); ctx.stroke();
    ctx.fillStyle = '#f1f3f7'; ctx.beginPath(); ctx.arc(0, -10 * d, 1.45 * d, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1d2a3a'; ctx.beginPath(); ctx.ellipse(0.65 * d, -10 * d, 0.75 * d, 0.6 * d, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(140,210,255,0.8)'; ctx.fillRect(0.6 * d, -10.3 * d, 0.5 * d, 0.2 * d);
    ctx.restore();
    const cap = Wd.bagCap(s);
    if (s.bag.length) {
      const n = Math.min(cap, 20), w = Math.min(14, n * 1.1) * k, x0 = x - w / 2;
      for (let i = 0; i < n; i++) { ctx.fillStyle = i < s.bag.length * n / cap ? (s.bag.length >= cap ? '#ffd36b' : '#ece6d9') : 'rgba(255,255,255,0.18)'; ctx.fillRect(x0 + (i / n) * w, y - 13.4 * depth(p.y) * k, Math.max(2, w / n - 1.5), 0.7 * k); }
    }
  }

  /* ---------- Effets ---------- */
  R.fxPickup = it => { const p = Wd.player; arcs.push({ kind: it.kind, x0: it.x, y0: it.y, x1: p.x - p.dir * 1.6, y1: p.y - 6.4, t: 0, dur: 0.25 }); };
  R.fxDump = kind => { const p = Wd.player; arcs.push({ kind, x0: p.x, y0: p.y - 6.4, x1: G.BASE_X + rnd(-2.5, 2.5), y1: G.GROUND_TOP - 6, t: 0, dur: 0.22 }); };
  R.fxLaunch = info => { launches.push({ t: 0, kinds: info.kinds, money: info.money, full: info.full }); shake = reduced ? 0 : 0.5; };
  R.fxClean = () => { celebrate = 1; for (let i = 0; i < 8; i++) burst(rnd(0.1, 0.9) * W, sy(G.GROUND_TOP), [140, 255, 190], 16, 120); };
  R.fxTravel = () => { travelT = 0; shownClean = 0; };
  R.fxSunUp = () => { sunFlash = 1; const sp = sunPos(); burst(sp.x, sp.y, R.sunColor(), 80, 200); for (let i = 0; i < 4; i++) flares.push({ a: rnd(0, TAU), t: 0, life: rnd(1.2, 2), h: rnd(1, 1.6) }); };
  function burst(x, y, c, n, sp) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(0.3, 1) * sp; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(0.5, 1.3), c }); } }

  function drawArcs(dt) {
    for (let i = arcs.length - 1; i >= 0; i--) {
      const a = arcs[i]; a.t += dt / a.dur;
      if (a.t >= 1) { arcs.splice(i, 1); continue; }
      const q = ease(a.t), x = lerp(a.x0, a.x1, q), y = lerp(a.y0, a.y1, q) - Math.sin(q * Math.PI) * 5;
      drawJunk(a.kind, sx(x), sy(y), G.JUNK[a.kind].size * k * 0.45 * (1 - q * 0.4), q * 4, 1);
    }
  }
  function drawLaunches(dt) {
    const sp = sunPos(), t0 = rampTop(), x0 = G.RAMP_X - 3;
    for (let i = launches.length - 1; i >= 0; i--) {
      const L = launches[i]; L.t += dt;
      let x, y, sc = 1;
      if (L.t < 0.45) { const q = ease(L.t / 0.45); x = sx(lerp(G.BASE_X, x0, Math.min(1, q * 2))); y = sy(lerp(G.GROUND_TOP - 2, G.GROUND_TOP - 2, q)); if (q > 0.5) { const r = (q - 0.5) * 2; x = sx(lerp(x0, t0.x, r)); y = sy(lerp(G.GROUND_TOP - 2, t0.y, r)); } }
      else {
        const q = clamp((L.t - 0.45) / 1.5, 0, 1), e = ease(q), ax = sx(t0.x), ay = sy(t0.y), cx = (ax + sp.x) / 2 - W * 0.05, cy = Math.min(ay, sp.y) - H * 0.12;
        x = (1 - e) * (1 - e) * ax + 2 * (1 - e) * e * cx + e * e * sp.x; y = (1 - e) * (1 - e) * ay + 2 * (1 - e) * e * cy + e * e * sp.y; sc = lerp(1, 0.2, e);
        if (Math.random() < 0.9) sparks.push({ x, y, vx: rnd(-14, 14), vy: rnd(10, 30), t: 0, life: rnd(0.3, 0.7), c: q > 0.7 ? [255, 160, 90] : [255, 220, 170] });
        if (q >= 1) { launches.splice(i, 1); sunFlash = Math.min(1, sunFlash + 0.5); flares.push({ a: rnd(0, TAU), t: 0, life: rnd(1, 1.6), h: rnd(0.8, 1.3) }); burst(sp.x, sp.y, [255, 200, 140], 26, 90); continue; }
      }
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.fillStyle = '#2f5d7a'; ctx.fillRect(-4.5 * k, -3.2 * k, 9 * k, 6.4 * k);
      ctx.fillStyle = rgba([255, 211, 107], 0.9); ctx.fillRect(-4.5 * k, 2.4 * k, 9 * k, 0.8 * k);
      if (L.t >= 0.45) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,180,90,0.7)'; ctx.beginPath(); ctx.ellipse(5.5 * k, 2 * k, 3 * k, 1.4 * k, 0.5, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
  function drawParticles(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t >= p.life) { sparks.splice(i, 1); continue; }
      ctx.fillStyle = rgba(p.c, 1 - p.t / p.life); ctx.fillRect(p.x - 1, p.y - 1, 2.2, 2.2);
    }
    ctx.font = '600 15px "Martian Mono", ui-monospace, monospace'; ctx.textAlign = 'center';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.t += dt * 0.6;
      if (f.t >= 1) { floaters.splice(i, 1); continue; }
      ctx.fillStyle = 'rgba(255,224,140,' + (1 - f.t) + ')'; ctx.fillText(f.text, sx(f.x), sy(f.y) - f.t * 40);
    }
  }
  R.floater = (text, x, y) => floaters.push({ text, x, y, t: 0 });

  /* ---------- Image ---------- */
  let last = 0;
  R.frame = now => {
    if (!ctx || !W) return 0;
    const dt = clamp(last ? (now - last) / 1000 : 0.016, 0, 0.05);
    last = Math.max(last, now); time += dt;
    const s = getState(), info = Wd.planetInfo(s);
    shownClean = lerp(shownClean, 1 - Wd.pollution(s), Math.min(1, dt * 2));
    sunFlash = Math.max(0, sunFlash - dt * 1.2); celebrate = Math.max(0, celebrate - dt * 0.5); shake = Math.max(0, shake - dt * 2);
    const viewW = W / k;
    const target = clamp(Wd.player.x - viewW * 0.38, 0, Math.max(0, G.WORLD_W - viewW));
    camX = lerp(camX, target, Math.min(1, dt * 5));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 4, rnd(-1, 1) * shake * 4);
    drawSky(s, info);
    drawLand(s, info);
    drawBase(s);
    const draw = Wd.items.map(it => ({ y: it.y, f: () => { const pop = clamp((now - it.born) / 250, 0, 1); drawJunk(it.kind, sx(it.x), sy(it.y) - G.JUNK[it.kind].size * depth(it.y) * k * 0.7, G.JUNK[it.kind].size * depth(it.y) * k * 0.72 * pop, it.a, 1); } }));
    draw.push({ y: Wd.player.y + 0.01, f: () => drawPlayer(s) });
    draw.sort((a, b) => a.y - b.y).forEach(o => o.f());
    drawArcs(dt);
    drawLaunches(dt);
    drawParticles(dt);
    if (Wd.player.moving && Math.random() < 0.3) sparks.push({ x: sx(Wd.player.x), y: sy(Wd.player.y), vx: rnd(-8, 8), vy: rnd(-8, -2), t: 0, life: 0.4, c: [150, 126, 96] });
    if (celebrate > 0) { ctx.fillStyle = 'rgba(160,255,200,' + celebrate * 0.15 + ')'; ctx.fillRect(0, 0, W, H); }
    if (travelT >= 0) { travelT += dt / 1.6; ctx.fillStyle = 'rgba(4,5,10,' + Math.sin(Math.min(1, travelT) * Math.PI) + ')'; ctx.fillRect(0, 0, W, H); if (travelT >= 1) travelT = -1; }
    return dt;
  };
})();
