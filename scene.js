'use strict';
/* Feed the Sun — rendu de la scène sur canvas : soleil, planète, vaisseau, tirs, épaves. */
(function () {
  const F = window.FTS, C = F.C;
  const S = (F.Scene = {});
  const TAU = Math.PI * 2;
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cv, ctx, W = 0, H = 0, dpr = 1, getState, fmt;
  let sun = { x: 0, y: 0, r: 0 }, planet = { x: 0, y: 0, r: 0 }, ship = { x: 0, y: 0, a: 0, recoil: 0, flash: 0 };
  let stars = [], bg = null, bgGalaxy = -1;
  const shots = [], impacts = [], floaters = [], sparks = [];
  let wreck = null, time = 0, sunFlash = 0, celebrate = 0, travelT = -1, jumpT = -1;
  let shownPoll = 1, blobs = [], blobPlanet = -1, sunRGB = null;
  const spawnAcc = F.GENS.map(() => 0);

  const rnd = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  S.init = (canvas, stateFn, formatFn) => {
    cv = canvas; ctx = cv.getContext('2d'); getState = stateFn; fmt = formatFn;
    stars = Array.from({ length: 240 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() < 0.9 ? rnd(0.4, 1.1) : rnd(1.2, 1.9), p: rnd(0, TAU), w: rnd(0.4, 1.6) }));
    S.resize();
    window.addEventListener('resize', S.resize);
  };

  S.resize = () => {
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const m = Math.min(W, H);
    if (W >= H * 1.05) {
      sun = { x: W * 0.27, y: H * 0.5, r: m * 0.15 };
      planet = { x: W * 0.75, y: H * 0.52, r: m * 0.125 };
    } else {
      sun = { x: W * 0.5, y: H * 0.36, r: m * 0.15 };
      planet = { x: W * 0.5, y: H * 0.72, r: m * 0.12 };
    }
    bgGalaxy = -1;
  };

  /* ---------- Fond étoilé (mis en cache) ---------- */
  function buildBg(galaxy) {
    bg = document.createElement('canvas');
    bg.width = cv.width; bg.height = cv.height;
    const b = bg.getContext('2d');
    b.scale(dpr, dpr);
    b.fillStyle = '#04050a'; b.fillRect(0, 0, W, H);
    const hues = [[70, 40, 120], [20, 70, 110], [110, 40, 70], [40, 90, 80], [90, 60, 20]];
    const h1 = hues[galaxy % hues.length], h2 = hues[(galaxy + 2) % hues.length];
    [[0.15, 0.2, h1, 0.55], [0.85, 0.85, h2, 0.6], [0.6, 0.1, h2, 0.35]].forEach(([x, y, c, sz]) => {
      const g = b.createRadialGradient(W * x, H * y, 0, W * x, H * y, Math.max(W, H) * sz);
      g.addColorStop(0, rgba(c, 0.18)); g.addColorStop(1, rgba(c, 0));
      b.fillStyle = g; b.fillRect(0, 0, W, H);
    });
    bgGalaxy = galaxy;
  }

  /* ---------- Planète ---------- */
  function planetBlobs(n) {
    const r = mulberry(n * 977 + 13);
    blobs = Array.from({ length: 9 }, () => ({ lon: r() * TAU, lat: (r() - 0.5) * 1.5, size: 0.18 + r() * 0.32 }));
    blobPlanet = n;
  }
  const BAD_SEA = [86, 74, 52], BAD_LAND = [66, 54, 38], SMOG = [150, 126, 78], AIR_BAD = [170, 140, 90], AIR_GOOD = [120, 190, 255];

  function drawPlanet(st, alpha, scale) {
    if (blobPlanet !== st.planet) planetBlobs(st.planet);
    const info = C.planetInfo(st);
    const clean = 1 - shownPoll;
    const r = planet.r * scale, px = planet.x, py = planet.y;
    const rot = time * 0.05;
    ctx.save();
    ctx.globalAlpha = alpha;
    // anneau de débris (moitié arrière)
    drawDebris(st, r, false);
    // atmosphère
    const air = mix(AIR_BAD, AIR_GOOD, clean);
    let g = ctx.createRadialGradient(px, py, r * 0.9, px, py, r * 1.35);
    g.addColorStop(0, rgba(air, 0.35)); g.addColorStop(1, rgba(air, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r * 1.35, 0, TAU); ctx.fill();
    // océan et terres
    ctx.save();
    ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.clip();
    ctx.fillStyle = rgba(mix(BAD_SEA, hex(info.sea), clean), 1); ctx.fillRect(px - r, py - r, r * 2, r * 2);
    const land = mix(BAD_LAND, hex(info.land), clean);
    for (const b of blobs) {
      const a = b.lon + rot, depth = Math.cos(a);
      if (depth < -0.15) continue;
      const bx = px + r * Math.sin(a) * Math.cos(b.lat), by = py + r * Math.sin(b.lat) * 0.85;
      ctx.fillStyle = rgba(land, 1);
      ctx.beginPath(); ctx.ellipse(bx, by, b.size * r * (0.35 + 0.65 * Math.max(0, depth)), b.size * r * 0.8, 0, 0, TAU); ctx.fill();
    }
    // nuages blancs quand la planète guérit, smog quand elle est polluée
    if (clean > 0.05) {
      ctx.fillStyle = rgba([255, 255, 255], 0.28 * clean);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1 + time * 0.09, depth = Math.cos(a);
        if (depth < 0) continue;
        ctx.beginPath(); ctx.ellipse(px + r * Math.sin(a) * 0.9, py + r * (i % 3 - 1) * 0.45, r * 0.32 * depth + 2, r * 0.07, 0, 0, TAU); ctx.fill();
      }
    }
    if (shownPoll > 0.01) {
      ctx.fillStyle = rgba(SMOG, 0.5 * shownPoll); ctx.fillRect(px - r, py - r, r * 2, r * 2);
      ctx.fillStyle = rgba([110, 92, 58], 0.35 * shownPoll);
      for (let i = 0; i < 5; i++) {
        const a = i * 1.7 + time * 0.03;
        ctx.beginPath(); ctx.ellipse(px + r * Math.sin(a) * 0.8, py + r * Math.cos(a * 1.3) * 0.6, r * 0.45, r * 0.16, a, 0, TAU); ctx.fill();
      }
    }
    // ombre côté nuit (lumière venant du soleil)
    const dx = sun.x - px, dy = sun.y - py, dl = Math.hypot(dx, dy) || 1;
    g = ctx.createRadialGradient(px + dx / dl * r * 0.55, py + dy / dl * r * 0.55, r * 0.2, px, py, r * 1.45);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(2,3,10,0.25)'); g.addColorStop(1, 'rgba(2,3,10,0.88)');
    ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2);
    ctx.restore();
    drawDebris(st, r, true);
    if (celebrate > 0) {
      const k = 1 - celebrate;
      ctx.strokeStyle = rgba([140, 255, 190], 0.6 * celebrate); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px, py, r * (1.1 + k * 1.6), 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  function drawDebris(st, r, front) {
    const n = Math.round(110 * shownPoll);
    if (!n) return;
    ctx.fillStyle = 'rgba(170,150,120,0.85)';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + time * 0.12 + (i % 7) * 0.05;
      if ((Math.sin(a) > 0) !== front) continue;
      const rr = r * (1.45 + (i % 5) * 0.04);
      const x = planet.x + Math.cos(a) * rr, y = planet.y + Math.sin(a) * rr * 0.28 + (i % 3 - 1) * 1.5;
      const s = 1 + (i % 3) * 0.6;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }

  /* ---------- Soleil ---------- */
  function targetSunRGB(st) {
    const k = C.sunStage(st), d = F.SUN[k];
    if (d.prism) { const h = (time * 30) % 360; return hsl(h); }
    return d.rgb;
  }
  function hsl(h) { const f = n => { const k = (n + h / 30) % 12; return 255 * (0.75 - 0.25 * Math.max(-1, Math.min(k - 3, 9 - k, 1))); }; return [f(0), f(8), f(4)].map(Math.round); }
  S.sunColor = () => sunRGB || [255, 98, 66];

  function drawSun(st) {
    const target = targetSunRGB(st);
    sunRGB = sunRGB ? mix(sunRGB, target, F.SUN[C.sunStage(st)].prism ? 1 : 0.02) : target.slice();
    const c = sunRGB, pulse = 1 + Math.sin(time * 1.3) * 0.015 + sunFlash * 0.06;
    const r = sun.r * pulse;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    let g = ctx.createRadialGradient(sun.x, sun.y, r * 0.4, sun.x, sun.y, r * 4.2);
    g.addColorStop(0, rgba(c, 0.5 + sunFlash * 0.25)); g.addColorStop(0.25, rgba(c, 0.16)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sun.x, sun.y, r * 4.2, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a = time * (0.07 + i * 0.03) + i * 2.1, off = r * 0.08;
      g = ctx.createRadialGradient(sun.x + Math.cos(a) * off, sun.y + Math.sin(a) * off, r * 0.8, sun.x, sun.y, r * (1.5 + i * 0.25));
      g.addColorStop(0, rgba(c, 0.22)); g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sun.x, sun.y, r * 2, 0, TAU); ctx.fill();
    }
    ctx.restore();
    g = ctx.createRadialGradient(sun.x - r * 0.2, sun.y - r * 0.2, r * 0.05, sun.x, sun.y, r);
    g.addColorStop(0, '#fffdf6'); g.addColorStop(0.45, rgba(mix(c, [255, 255, 255], 0.55), 1)); g.addColorStop(1, rgba(mix(c, [60, 20, 10], 0.15), 1));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sun.x, sun.y, r, 0, TAU); ctx.fill();
  }

  /* ---------- Vaisseau ---------- */
  function placeShip() {
    const base = Math.atan2(sun.y - planet.y, sun.x - planet.x);
    const a = base + Math.sin(time * 0.22) * 0.55;
    const d = planet.r * 1.85;
    ship.x = planet.x + Math.cos(a) * d; ship.y = planet.y + Math.sin(a) * d;
    ship.a = Math.atan2(sun.y - ship.y, sun.x - ship.x);
  }
  function drawShip() {
    const s = Math.max(7, planet.r * 0.16);
    ctx.save();
    ctx.translate(ship.x, ship.y); ctx.rotate(ship.a);
    ctx.translate(-ship.recoil * s * 0.5, 0);
    ctx.fillStyle = 'rgba(120,200,255,0.25)';
    ctx.beginPath(); ctx.ellipse(-s * 1.25, 0, s * 0.5 + Math.sin(time * 20) * 1.2, s * 0.22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d9dde8';
    ctx.beginPath(); ctx.moveTo(s * 1.1, 0); ctx.lineTo(-s * 0.9, s * 0.62); ctx.lineTo(-s * 0.6, 0); ctx.lineTo(-s * 0.9, -s * 0.62); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8b93a8'; ctx.fillRect(s * 0.2, -s * 0.12, s * 1.3, s * 0.24);
    if (ship.flash > 0) {
      ctx.fillStyle = 'rgba(255,240,200,' + ship.flash + ')';
      ctx.beginPath(); ctx.arc(s * 1.6, 0, s * 0.45 * ship.flash + 2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- Tirs et effets ---------- */
  function addShot(x0, y0, opt) {
    if (shots.length > 260) shots.shift();
    const tx = sun.x + rnd(-0.45, 0.45) * sun.r, ty = sun.y + rnd(-0.45, 0.45) * sun.r;
    const mx = (x0 + tx) / 2, my = (y0 + ty) / 2, dx = tx - x0, dy = ty - y0;
    const bend = opt.bend == null ? rnd(-0.25, 0.25) : opt.bend;
    shots.push({ x0, y0, x1: tx, y1: ty, cx: mx - dy * bend, cy: my + dx * bend, t: 0, dur: opt.dur || 1.2,
      size: opt.size || 2, color: opt.color || [200, 240, 255], shape: opt.shape || 'dot', label: opt.label || null, big: !!opt.big });
  }
  const bez = (p, t) => {
    const u = 1 - t;
    return [u * u * p.x0 + 2 * u * t * p.cx + t * t * p.x1, u * u * p.y0 + 2 * u * t * p.cy + t * t * p.y1];
  };

  S.playerShot = (tonnes, auto) => {
    ship.recoil = 1; ship.flash = 1;
    const s = Math.max(7, planet.r * 0.16);
    addShot(ship.x + Math.cos(ship.a) * s * 1.6, ship.y + Math.sin(ship.a) * s * 1.6,
      { dur: 0.9, size: auto ? 2.6 : 3.4, color: [255, 236, 190], shape: 'capsule', bend: rnd(-0.08, 0.08), label: auto ? null : tonnes, big: !auto });
  };

  function spawnAuto(st, dt) {
    if (st.awaitingTravel || travelT >= 0) return;
    for (let i = 0; i < F.GENS.length; i++) {
      const n = st.gens[i];
      if (!n) continue;
      const rate = Math.min(i < 2 ? 5 : 3, 0.35 + 1.1 * Math.log10(1 + n)) * (reduced ? 0.5 : 1);
      spawnAcc[i] += rate * dt;
      while (spawnAcc[i] >= 1) {
        spawnAcc[i] -= 1;
        const col = hex(F.GENS[i].color), a = rnd(0, TAU);
        if (i === 0) addShot(ship.x, ship.y, { dur: 1, size: 1.8, color: col, bend: rnd(-0.1, 0.1) });
        else if (i === 1) addShot(planet.x + Math.cos(a) * planet.r * 1.5, planet.y + Math.sin(a) * planet.r * 0.4, { dur: 2.2, size: 1.6, color: col, bend: rnd(-0.4, 0.4) });
        else if (i === 2) addShot(planet.x + Math.cos(a) * planet.r, planet.y + Math.sin(a) * planet.r, { dur: 2.6, size: 3.2, color: col, shape: 'capsule', bend: rnd(-0.3, 0.3) });
        else if (i === 3) addShot(planet.x + Math.cos(a) * planet.r, planet.y + Math.sin(a) * planet.r, { dur: 0.7, size: 2.2, color: col, shape: 'streak', bend: 0 });
        else if (i === 4) addShot(planet.x + Math.cos(a) * planet.r * 1.3, planet.y + Math.sin(a) * planet.r * 1.3, { dur: 1.8, size: 3.6, color: col, shape: 'cube', bend: rnd(-0.2, 0.2) });
        else addShot(planet.x + rnd(-0.3, 0.3) * planet.r, planet.y + rnd(-0.3, 0.3) * planet.r, { dur: i === 7 ? 0.5 : 1.4, size: 2.4, color: col, bend: i === 6 ? 0 : rnd(-0.15, 0.15) });
      }
    }
  }

  function drawPersistent(st) {
    const dx = sun.x - planet.x, dy = sun.y - planet.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
    if (st.gens[5] > 0) {
      ctx.strokeStyle = 'rgba(243,166,255,0.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(planet.x + ux * planet.r, planet.y + uy * planet.r); ctx.lineTo(planet.x + ux * planet.r * 2.6, planet.y + uy * planet.r * 2.6); ctx.stroke();
    }
    if (st.gens[6] > 0) {
      const g = ctx.createLinearGradient(planet.x, planet.y, sun.x, sun.y);
      g.addColorStop(0, 'rgba(185,168,255,0.16)'); g.addColorStop(1, 'rgba(185,168,255,0.03)');
      ctx.strokeStyle = g; ctx.lineWidth = planet.r * 0.5;
      ctx.beginPath(); ctx.moveTo(planet.x, planet.y); ctx.lineTo(sun.x, sun.y); ctx.stroke();
    }
    if (st.gens[7] > 0) {
      const wx = planet.x + uy * planet.r * 1.9, wy = planet.y - ux * planet.r * 1.9;
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = 'rgba(143,208,255,' + (0.5 - k * 0.14) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(wx, wy, planet.r * (0.22 + k * 0.08), time * (2 + k) , time * (2 + k) + 4.2); ctx.stroke();
      }
    }
  }

  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const p = shots[i];
      p.t += dt / p.dur;
      if (p.t >= 1) {
        shots.splice(i, 1);
        sunFlash = Math.min(1, sunFlash + (p.big ? 0.35 : 0.05));
        if (impacts.length < 60) impacts.push({ x: p.x1, y: p.y1, t: 0, size: p.size * (p.big ? 5 : 3), color: p.color });
        if (p.label != null && fmt) floaters.push({ x: p.x1 + rnd(-10, 10), y: p.y1 - sun.r * 0.4, t: 0, text: '+' + fmt(p.label) + ' t' });
      }
    }
  }
  function drawShots() {
    for (const p of shots) {
      const t = ease(Math.min(1, p.t)), [x, y] = bez(p, t), [tx, ty] = bez(p, Math.max(0, t - 0.07));
      ctx.strokeStyle = rgba(p.color, 0.35); ctx.lineWidth = p.size * 0.9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = rgba(p.color, 1);
      if (p.shape === 'cube') ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
      else if (p.shape === 'streak') { ctx.lineWidth = p.size; ctx.strokeStyle = rgba(p.color, 0.9); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(x, y, p.size * (p.shape === 'capsule' ? 0.9 : 0.6), 0, TAU); ctx.fill(); }
    }
  }
  function drawEffects(dt) {
    for (let i = impacts.length - 1; i >= 0; i--) {
      const m = impacts[i]; m.t += dt * 2.2;
      if (m.t >= 1) { impacts.splice(i, 1); continue; }
      ctx.strokeStyle = rgba(m.color, 0.7 * (1 - m.t)); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.size * (0.5 + m.t * 2), 0, TAU); ctx.stroke();
    }
    ctx.font = '600 13px "Martian Mono", ui-monospace, monospace'; ctx.textAlign = 'center';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.t += dt * 0.8;
      if (f.t >= 1 || floaters.length > 24) { floaters.splice(i, 1); continue; }
      ctx.fillStyle = 'rgba(255,248,232,' + (1 - f.t) + ')';
      ctx.fillText(f.text, f.x, f.y - f.t * 40);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t >= p.life) { sparks.splice(i, 1); continue; }
      ctx.fillStyle = rgba(p.c, 1 - p.t / p.life); ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
  }
  function burst(x, y, c, n, speed) {
    for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(0.3, 1) * speed; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(0.6, 1.4), c }); }
  }

  /* ---------- Épave scintillante ---------- */
  S.spawnWreck = () => {
    if (wreck) return false;
    const fromLeft = Math.random() < 0.5, y = H * rnd(0.2, 0.8);
    wreck = { x: fromLeft ? -30 : W + 30, y, vx: (fromLeft ? 1 : -1) * W / rnd(13, 17), vy: rnd(-0.04, 0.04) * H, a: 0, va: rnd(-1, 1) };
    return true;
  };
  S.hasWreck = () => !!wreck;
  S.hitWreck = (x, y, coarse) => {
    if (!wreck) return false;
    if (Math.hypot(x - wreck.x, y - wreck.y) > (coarse ? 40 : 28)) return false;
    burst(wreck.x, wreck.y, [255, 214, 120], 40, 120);
    wreck = null;
    return true;
  };
  function drawWreck(dt) {
    if (!wreck) return;
    wreck.x += wreck.vx * dt; wreck.y += wreck.vy * dt; wreck.a += wreck.va * dt;
    if (wreck.x < -60 || wreck.x > W + 60) { wreck = null; return; }
    const g = ctx.createRadialGradient(wreck.x, wreck.y, 0, wreck.x, wreck.y, 26);
    g.addColorStop(0, 'rgba(255,214,120,0.55)'); g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(wreck.x, wreck.y, 26, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(wreck.x, wreck.y); ctx.rotate(wreck.a);
    ctx.fillStyle = '#f2c96b';
    ctx.beginPath(); ctx.moveTo(9, -3); ctx.lineTo(4, 7); ctx.lineTo(-8, 5); ctx.lineTo(-10, -4); ctx.lineTo(0, -9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff3cf'; ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
    if (Math.random() < 0.3) sparks.push({ x: wreck.x + rnd(-8, 8), y: wreck.y + rnd(-8, 8), vx: rnd(-10, 10), vy: rnd(-10, 10), t: 0, life: 0.6, c: [255, 236, 170] });
  }

  /* ---------- Moments forts ---------- */
  S.cleaned = () => { celebrate = 1; burst(planet.x, planet.y, [140, 255, 190], 90, 160); };
  S.travel = () => { travelT = 0; };
  S.jump = () => { jumpT = 0; };
  S.sunUp = () => { sunFlash = 1; burst(sun.x, sun.y, S.sunColor(), 80, 220); };
  S.busy = () => travelT >= 0 || jumpT >= 0;

  /* ---------- Image ---------- */
  let last = 0;
  S.frame = now => {
    if (!ctx || !W) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now; time += dt;
    const st = getState();
    const target = st.awaitingTravel ? 0 : st.planetLeft / C.pollution(st.planet);
    shownPoll = lerp(shownPoll, target, Math.min(1, dt * 3));
    sunFlash = Math.max(0, sunFlash - dt * 1.5); celebrate = Math.max(0, celebrate - dt * 0.6);
    ship.recoil = Math.max(0, ship.recoil - dt * 6); ship.flash = Math.max(0, ship.flash - dt * 8);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (bgGalaxy !== st.jumps) buildBg(st.jumps);
    ctx.drawImage(bg, 0, 0, W, H);
    const warp = jumpT >= 0 ? Math.sin(Math.min(1, jumpT) * Math.PI) : 0;
    for (const s of stars) {
      const tw = 0.55 + 0.45 * Math.sin(time * s.w + s.p);
      const x = s.x * W, y = s.y * H;
      ctx.fillStyle = 'rgba(235,238,255,' + (0.25 + 0.6 * tw) + ')';
      if (warp > 0.05) {
        const dx = x - W / 2, dy = y - H / 2;
        ctx.strokeStyle = 'rgba(235,238,255,0.7)'; ctx.lineWidth = s.s;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * warp * 0.6, y + dy * warp * 0.6); ctx.stroke();
      } else ctx.fillRect(x, y, s.s, s.s);
    }

    placeShip();
    spawnAuto(st, dt);
    updateShots(dt);
    drawSun(st);
    drawPersistent(st);

    let pa = 1, ps = 1;
    if (travelT >= 0) {
      travelT += dt / 1.8;
      if (travelT < 0.5) { pa = 1 - travelT * 2; ps = 1 - travelT * 0.6; }
      else { pa = (travelT - 0.5) * 2; ps = 1.3 - (travelT - 0.5) * 0.6; }
      if (travelT >= 1) travelT = -1;
    }
    drawPlanet(st, Math.max(0, Math.min(1, pa)), ps);
    drawShots();
    drawShip();
    drawWreck(dt);
    drawEffects(dt);

    if (jumpT >= 0) {
      jumpT += dt / 2.4;
      ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, warp - 0.55) * 1.8 + ')';
      ctx.fillRect(0, 0, W, H);
      if (jumpT >= 1) jumpT = -1;
    }
  };
})();
