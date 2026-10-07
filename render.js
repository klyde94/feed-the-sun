'use strict';
/* Feed the Sun v3 — rendu de la ville vue de dessus, et outils partagés avec l'orbite (soleil, déchets, personnages, épaves). */
(function () {
  const G = window.FTS3, Wd = G.W, C = G.CITY, TT = G.CITY.T;
  const R = (G.R = {});
  const TAU = Math.PI * 2;
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cv, ctx, W = 0, H = 0, dpr = 1, T = 32, camX = 0, camY = 0, getState, time = 0, last = 0, shake = 0;
  let sunRGB = null, sunFlash = 0, celebrate = 0, fade = -1, combo = { n: 0, t: 9 };
  let bg = null, bgKey = '';
  const arcs = [], launches = [], sparks = [], floaters = [], flares = [];

  const rnd = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  Object.assign(R, { rnd, lerp, clamp, mix, rgba, ease, TAU, reduced });
  const sx = x => (x - camX) * T, sy = y => (y - camY) * T;
  const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };

  R.init = (canvas, stateFn) => { cv = canvas; ctx = cv.getContext('2d'); getState = stateFn; R.resize(); window.addEventListener('resize', R.resize); };
  R.resize = () => {
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    T = Math.round(clamp(Math.min(W / 24, H / 13.5), 24, 52)); bgKey = '';
  };
  R.size = () => ({ W, H });
  R.toWorld = (px, py) => ({ x: px / T + camX, y: py / T + camY });
  R.itemAt = (px, py) => { const p = R.toWorld(px, py); let best = null, bd = 0.9; for (const it of Wd.Z.ground.items) { const d = Math.hypot(it.x - p.x, it.y - p.y); if (d < bd) { bd = d; best = it; } } return best; };
  R.time = () => time;

  /* ---------- Déchets (partagé) ---------- */
  R.drawJunk = (c2, kind, x, y, s, a, alpha, gold) => {
    const col = gold ? [255, 206, 84] : G.JUNK[kind].col;
    c2.save(); c2.translate(x, y); c2.rotate(a); c2.globalAlpha = alpha;
    if (gold) { const g = c2.createRadialGradient(0, 0, 0, 0, 0, s * 2.6); g.addColorStop(0, 'rgba(255,214,110,0.6)'); g.addColorStop(1, 'rgba(255,214,110,0)'); c2.fillStyle = g; c2.beginPath(); c2.arc(0, 0, s * 2.6, 0, TAU); c2.fill(); }
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
  R.strip = k2 => (k2.endsWith('*') ? [k2.slice(0, -1), true] : [k2, false]);

  /* ---------- Personnage (partagé) ---------- */
  R.drawPerson = (c2, x, y, d, dir, sw, vest, load, arm) => {
    c2.fillStyle = 'rgba(0,0,0,0.28)'; c2.beginPath(); c2.ellipse(x, y, 2.2 * d, 0.8 * d, 0, 0, TAU); c2.fill();
    c2.save(); c2.translate(x, y); c2.scale(dir, 1);
    c2.strokeStyle = '#2c3140'; c2.lineWidth = 0.9 * d; c2.lineCap = 'round';
    c2.beginPath(); c2.moveTo(-0.5 * d, -4.2 * d); c2.lineTo(-0.5 * d + sw * 1.2 * d, 0); c2.moveTo(0.5 * d, -4.2 * d); c2.lineTo(0.5 * d - sw * 1.2 * d, 0); c2.stroke();
    const bs = (1.4 + load * 1.6) * d;
    c2.fillStyle = '#cfcab8'; c2.beginPath(); c2.ellipse(-1.6 * d - bs * 0.3, -6.4 * d, bs * 0.8, bs, 0, 0, TAU); c2.fill();
    c2.fillStyle = vest; c2.fillRect(-1.4 * d, -8.6 * d, 2.8 * d, 4.8 * d);
    c2.fillStyle = '#e9edf2'; c2.fillRect(-1.4 * d, -7.2 * d, 2.8 * d, 0.45 * d); c2.fillRect(-1.4 * d, -5.6 * d, 2.8 * d, 0.45 * d);
    c2.strokeStyle = vest; c2.lineWidth = 0.7 * d;
    c2.beginPath(); c2.moveTo(0.6 * d, -7.8 * d); c2.lineTo(arm ? 2.2 * d : 1.6 * d - sw * 0.8 * d, arm ? -9.5 * d : -5 * d); c2.stroke();
    c2.fillStyle = '#f1f3f7'; c2.beginPath(); c2.arc(0, -10 * d, 1.45 * d, 0, TAU); c2.fill();
    c2.fillStyle = '#1d2a3a'; c2.beginPath(); c2.ellipse(0.65 * d, -10 * d, 0.75 * d, 0.6 * d, 0, 0, TAU); c2.fill();
    c2.fillStyle = 'rgba(140,210,255,0.8)'; c2.fillRect(0.6 * d, -10.3 * d, 0.5 * d, 0.2 * d);
    c2.restore();
  };

  /* ---------- Soleil (partagé) ---------- */
  R.tickSun = s => { const d = G.SUN[Wd.sunStage(s)]; sunRGB = sunRGB ? mix(sunRGB, d.rgb, 0.02) : d.rgb.slice(); return sunRGB; };
  R.sunColor = () => sunRGB || [255, 98, 66];
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

  /* ---------- Épave scintillante (partagée, coordonnées écran) ---------- */
  R.wreck = null;
  R.spawnWreck = (w, h) => { if (R.wreck) return false; const l = Math.random() < 0.5; R.wreck = { x: l ? -30 : w + 30, y: h * rnd(0.2, 0.7), vx: (l ? 1 : -1) * w / rnd(13, 17), vy: rnd(-0.02, 0.02) * h, a: 0, va: rnd(-1, 1), w }; return true; };
  R.hitWreck = (x, y, coarse) => { const w = R.wreck; if (!w || Math.hypot(x - w.x, y - w.y) > (coarse ? 42 : 30)) return false; R.wreck = null; R.burstAt = { x, y }; return true; };
  R.drawWreck = (c2, dt, sp) => {
    const w = R.wreck; if (!w) return;
    w.x += w.vx * dt; w.y += w.vy * dt; w.a += w.va * dt;
    if (w.x < -60 || w.x > w.w + 60) { R.wreck = null; return; }
    const g = c2.createRadialGradient(w.x, w.y, 0, w.x, w.y, 30); g.addColorStop(0, 'rgba(255,214,120,0.6)'); g.addColorStop(1, 'rgba(255,214,120,0)');
    c2.fillStyle = g; c2.beginPath(); c2.arc(w.x, w.y, 30, 0, TAU); c2.fill();
    c2.save(); c2.translate(w.x, w.y); c2.rotate(w.a); c2.fillStyle = '#f2c96b'; c2.fillRect(-7, -5, 14, 10); c2.fillStyle = '#ffe7a8'; c2.fillRect(-17, -3, 9, 6); c2.fillRect(8, -3, 9, 6); c2.restore();
    if (Math.random() < 0.35) sp.push({ x: w.x + rnd(-10, 10), y: w.y + rnd(-10, 10), vx: rnd(-10, 10), vy: rnd(-10, 10), t: 0, life: 0.6, c: [255, 236, 170] });
  };
  R.drawParticles = (c2, dt, sp, fl, toX, toY) => {
    for (let i = sp.length - 1; i >= 0; i--) { const p = sp[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t >= p.life) { sp.splice(i, 1); continue; } c2.fillStyle = rgba(p.c, 1 - p.t / p.life); c2.fillRect(p.x - 1, p.y - 1, 2.2, 2.2); }
    c2.font = '600 15px "Martian Mono", ui-monospace, monospace'; c2.textAlign = 'center';
    for (let i = fl.length - 1; i >= 0; i--) { const f = fl[i]; f.t += dt * 0.6; if (f.t >= 1) { fl.splice(i, 1); continue; } c2.fillStyle = 'rgba(255,224,140,' + (1 - f.t) + ')'; c2.fillText(f.text, toX(f.x), toY(f.y) - f.t * 40); }
  };

  /* ---------- Ville : fond pré-dessiné ---------- */
  const ROOFS = [[178, 92, 72], [92, 104, 132], [70, 128, 120], [150, 120, 84], [120, 84, 120], [96, 120, 80]];
  function buildBg(s, clean) {
    const city = Wd.city, info = Wd.planetInfo(s), w = C.W * T, h = C.H * T;
    bg = document.createElement('canvas'); bg.width = w; bg.height = h;
    const b = bg.getContext('2d');
    const grass = mix([104, 98, 60], info.grass, clean), dirt = mix([92, 82, 64], [120, 112, 96], clean);
    for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
      const v = city.t[y * C.W + x], px = x * T, py = y * T, n = hash(x, y);
      if (v === TT.ROAD) { b.fillStyle = rgba(mix([52, 54, 62], [58, 62, 72], n * 0.5), 1); b.fillRect(px, py, T, T); }
      else if (v === TT.WALK) { b.fillStyle = rgba(mix(dirt, [168, 160, 146], 0.55 + n * 0.08), 1); b.fillRect(px, py, T, T); b.strokeStyle = 'rgba(0,0,0,0.08)'; b.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1); }
      else if (v === TT.PLAZA) { b.fillStyle = rgba(mix([150, 136, 116], [176, 164, 140], n * 0.4), 1); b.fillRect(px, py, T, T); b.fillStyle = 'rgba(0,0,0,0.05)'; b.fillRect(px, py + T / 2, T, 1); }
      else { b.fillStyle = rgba(mix(grass, [0, 0, 0], n * 0.1), 1); b.fillRect(px, py, T, T); if (n > 0.6) { b.fillStyle = rgba(mix(grass, [255, 255, 255], 0.15), 0.8); b.fillRect(px + n * T * 0.7, py + (1 - n) * T * 0.7, 2, 3); } }
    }
    b.strokeStyle = 'rgba(240,226,150,0.55)'; b.lineWidth = Math.max(1, T * 0.06); b.setLineDash([T * 0.4, T * 0.5]);
    for (const y of C.ROADS_H) { b.beginPath(); b.moveTo(0, (y + 1) * T); b.lineTo(w, (y + 1) * T); b.stroke(); }
    for (const x of C.ROADS_V) { b.beginPath(); b.moveTo((x + 1) * T, 0); b.lineTo((x + 1) * T, h); b.stroke(); }
    b.setLineDash([]);
    for (const d of city.dec) {
      if (d.type === 'pond') { b.fillStyle = rgba(mix([90, 96, 70], info.sea, clean), 0.95); b.beginPath(); b.ellipse(d.x * T, d.y * T, d.r * T, d.r * T * 0.7, 0, 0, TAU); b.fill(); b.strokeStyle = 'rgba(255,255,255,0.18)'; b.stroke(); }
      else if (d.type === 'bench') { b.fillStyle = '#7a5a3c'; b.fillRect(d.x * T - T * 0.35, d.y * T - T * 0.1, T * 0.7, T * 0.2); }
      else if (d.type === 'bin') { b.fillStyle = '#3f6b4a'; b.fillRect(d.x * T - T * 0.15, d.y * T - T * 0.2, T * 0.3, T * 0.35); b.fillStyle = '#2c4a34'; b.fillRect(d.x * T - T * 0.18, d.y * T - T * 0.24, T * 0.36, T * 0.08); }
    }
    for (const bd of city.buildings) {
      const px = bd.x * T, py = bd.y * T, bw = bd.w * T, bh = bd.h * T, lift = T * (0.35 + bd.floors * 0.18);
      b.fillStyle = 'rgba(0,0,0,0.28)'; b.fillRect(px + T * 0.25, py + T * 0.2, bw, bh);
      const wall = mix(ROOFS[bd.roof], [40, 36, 40], 0.45);
      b.fillStyle = rgba(wall, 1); b.fillRect(px, py + bh - lift, bw, lift);
      b.fillStyle = 'rgba(255,230,160,0.55)';
      for (let i = 0; i < bd.w * 2 - 1; i++) if (hash(bd.x + i, bd.y) > 0.35) b.fillRect(px + T * 0.25 + i * T * 0.5, py + bh - lift * 0.65, T * 0.2, T * 0.18);
      b.fillStyle = rgba(ROOFS[bd.roof], 1); b.fillRect(px, py - lift * 0.3, bw, bh - lift * 0.7);
      b.fillStyle = 'rgba(255,255,255,0.08)'; b.fillRect(px, py - lift * 0.3, bw, T * 0.12);
      b.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 1; i < bd.w; i++) b.fillRect(px + i * T, py - lift * 0.3, 1, bh - lift * 0.7);
    }
    for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) if (city.t[y * C.W + x] === TT.TREE) {
      const cx = (x + 0.5) * T, cy = (y + 0.5) * T, tone = mix([90, 96, 52], mix(info.grass, [20, 60, 30], 0.35), clean);
      b.fillStyle = 'rgba(0,0,0,0.25)'; b.beginPath(); b.ellipse(cx + T * 0.15, cy + T * 0.3, T * 0.45, T * 0.22, 0, 0, TAU); b.fill();
      b.fillStyle = '#5a4030'; b.fillRect(cx - T * 0.07, cy - T * 0.1, T * 0.14, T * 0.35);
      b.fillStyle = rgba(tone, 1); b.beginPath(); b.arc(cx, cy - T * 0.3, T * 0.48, 0, TAU); b.fill();
      b.fillStyle = rgba(mix(tone, [255, 255, 255], 0.18), 1); b.beginPath(); b.arc(cx - T * 0.14, cy - T * 0.44, T * 0.2, 0, TAU); b.fill();
    }
    C.DISTRICTS.forEach(d => {
      if (s.districts[d.id]) return;
      const px = d.x0 * T, py = d.y0 * T, w2 = (d.x1 - d.x0 + 1) * T, h2 = (d.y1 - d.y0 + 1) * T;
      b.fillStyle = 'rgba(6,7,12,0.55)'; b.fillRect(px, py, w2, h2);
      b.save(); b.beginPath(); b.rect(px, py, w2, h2); b.clip(); b.strokeStyle = 'rgba(255,211,107,0.07)'; b.lineWidth = T * 0.3;
      for (let k = -h2; k < w2; k += T * 1.2) { b.beginPath(); b.moveTo(px + k, py); b.lineTo(px + k + h2, py + h2); b.stroke(); }
      b.restore();
      b.strokeStyle = 'rgba(255,170,70,0.9)'; b.lineWidth = Math.max(2, T * 0.08); b.setLineDash([T * 0.35, T * 0.25]); b.strokeRect(px + 2, py + 2, w2 - 4, h2 - 4); b.setLineDash([]);
    });
    const dp = C.DEPOT, pad = C.PAD;
    b.fillStyle = 'rgba(255,211,107,0.18)'; b.fillRect((dp.x - 1.5) * T, (dp.y - 1.5) * T, 5 * T, 3 * T);
    b.strokeStyle = 'rgba(255,211,107,0.6)'; b.lineWidth = 2; b.strokeRect((dp.x - 1.5) * T, (dp.y - 1.5) * T, 5 * T, 3 * T);
    b.fillStyle = '#3a3f4c'; b.beginPath(); b.arc(pad.x * T, pad.y * T, T * 0.9, 0, TAU); b.fill();
    b.strokeStyle = '#ffd36b'; b.lineWidth = T * 0.12; b.setLineDash([T * 0.25, T * 0.2]); b.beginPath(); b.arc(pad.x * T, pad.y * T, T * 0.72, 0, TAU); b.stroke(); b.setLineDash([]);
  }

  /* ---------- Effets ---------- */
  R.fxPickup = e => { if (e.who !== 'me' || e.z !== 'ground') return; const p = Wd.player; arcs.push({ kind: e.it.kind, gold: e.it.gold, x0: e.it.x, y0: e.it.y, x1: p.x, y1: p.y - 0.5, t: 0, dur: 0.22 }); };
  R.fxDump = e => { if (e.who !== 'me' || e.z !== 'ground') return; const p = Wd.player; arcs.push({ kind: 'bag', x0: p.x, y0: p.y - 0.5, x1: C.DEPOT.x, y1: C.DEPOT.y - 0.3, t: 0, dur: 0.2 }); };
  R.fxLaunch = e => { launches.push({ t: 0 }); shake = reduced || e.auto ? 0 : 0.45; floaters.push({ text: '+' + e.label + ' $', x: C.DEPOT.x, y: C.DEPOT.y - 1.2, t: 0 }); };
  R.fxClean = () => { celebrate = 1; for (let i = 0; i < 8; i++) burst(rnd(0.1, 0.9) * W, rnd(0.2, 0.8) * H, [140, 255, 190], 18, 140); };
  R.fxTravel = () => { fade = 0; };
  R.fxJump = () => { fade = 0; };
  R.fxSunUp = () => { sunFlash = 1; for (let i = 0; i < 4; i++) flares.push({ a: rnd(0, TAU), t: 0, life: rnd(1.2, 2), h: rnd(1, 1.6) }); };
  R.fxCombo = n => { if (n >= 2) combo = { n, t: 0 }; };
  R.fxGold = () => { const p = Wd.player; floaters.push({ text: '★', x: p.x, y: p.y - 1.4, t: 0 }); };
  function burst(x, y, c, n, sp) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(0.3, 1) * sp; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(0.5, 1.3), c }); } }
  const sunPos = () => ({ x: W - Math.min(W, H) * 0.12, y: Math.min(W, H) * 0.14, r: Math.min(W, H) * 0.045 });

  function drawDepot(s) {
    const L2 = Wd.Z.ground.launching, lt = Wd.launchTime(s), d = C.DEPOT;
    if (s.team.operator) R.drawPerson(ctx, sx(C.PAD.x + 1.2), sy(C.PAD.y + 0.6), T / 10, -1, 0, '#5ad1a0', 0, L2 > 0 ? 1 : 0);
    if (L2 > lt - 0.35) return;
    const drop = L2 > 0 ? clamp(L2 / 0.5, 0, 1) : 0, x = sx(d.x), y = sy(d.y) - drop * T * 3, cw = T * 1.5, ch = T * 1.05;
    ctx.globalAlpha = 1 - drop * 0.6;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - cw / 2 + T * 0.1, sy(d.y) - ch / 2 + T * 0.15, cw, ch);
    ctx.fillStyle = '#2f5d7a'; ctx.fillRect(x - cw / 2, y - ch / 2, cw, ch);
    ctx.fillStyle = '#3d7499'; for (let i = 0; i < 4; i++) ctx.fillRect(x - cw / 2 + T * 0.12 + i * T * 0.35, y - ch / 2 + T * 0.1, T * 0.16, ch - T * 0.2);
    const cap = Wd.contCap(s, 'ground'), n = s.cont.ground.length;
    ctx.fillStyle = 'rgba(255,211,107,0.9)'; ctx.fillRect(x - cw / 2, y + ch / 2 - T * 0.1, cw * Math.min(1, n / cap), T * 0.1);
    for (let i = 0; i < Math.min(5, n); i++) { const [kk, g] = R.strip(s.cont.ground[n - 1 - i]); R.drawJunk(ctx, kk, x - cw * 0.3 + i * T * 0.22, y - ch / 2 - T * 0.05, T * 0.13, i * 0.7, 1, g); }
    ctx.globalAlpha = 1;
    ctx.font = '600 ' + Math.max(11, T * 0.32) + 'px "Martian Mono", ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = n >= cap ? '#ffd36b' : 'rgba(255,255,255,0.92)'; ctx.fillText(n + '/' + cap, x, y - ch / 2 - T * 0.3);
  }
  function drawLaunches(dt) {
    const sp = sunPos();
    for (let i = launches.length - 1; i >= 0; i--) {
      const L2 = launches[i]; L2.t += dt;
      let x, y, sc;
      if (L2.t < 0.35) { const q = ease(L2.t / 0.35); x = sx(lerp(C.DEPOT.x, C.PAD.x, q)); y = sy(C.DEPOT.y); sc = 1; }
      else {
        const q = clamp((L2.t - 0.35) / 1.5, 0, 1), e = ease(q), ax = sx(C.PAD.x), ay = sy(C.PAD.y);
        x = lerp(ax, sp.x, e); y = lerp(ay, sp.y, e) - Math.sin(e * Math.PI) * H * 0.12; sc = lerp(1.25, 0.2, e) * (1 + Math.sin(Math.min(1, q * 3) * Math.PI) * 0.3);
        if (Math.random() < 0.9) sparks.push({ x, y, vx: rnd(-20, 20), vy: rnd(-5, 30), t: 0, life: rnd(0.3, 0.7), c: q > 0.7 ? [255, 160, 90] : [255, 220, 170] });
        if (q >= 1) { launches.splice(i, 1); sunFlash = Math.min(1, sunFlash + 0.5); flares.push({ a: rnd(0, TAU), t: 0, life: rnd(1, 1.6), h: rnd(0.8, 1.3) }); burst(sp.x, sp.y, [255, 200, 140], 26, 90); continue; }
      }
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.fillStyle = '#2f5d7a'; ctx.fillRect(-T * 0.75, -T * 0.52, T * 1.5, T * 1.05);
      if (L2.t >= 0.35) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,180,90,0.75)'; ctx.beginPath(); ctx.ellipse(0, T * 0.8, T * 0.35, T * 0.7, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
  function drawSigns(s) {
    if (!G.U) return;
    ctx.textAlign = 'center';
    C.DISTRICTS.forEach(d => {
      if (s.districts[d.id]) return;
      const x = sx((d.x0 + d.x1 + 1) / 2), y = sy((d.y0 + d.y1 + 1) / 2);
      if (x < -200 || x > W + 200 || y < -80 || y > H + 80) return;
      ctx.fillStyle = 'rgba(8,10,16,0.85)'; const w = Math.max(170, T * 5.5), h = T * 1.5;
      ctx.fillRect(x - w / 2, y - h / 2, w, h); ctx.strokeStyle = 'rgba(255,170,70,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      ctx.font = '600 ' + Math.max(12, T * 0.36) + 'px "Instrument Sans", sans-serif'; ctx.fillStyle = '#ece6d9'; ctx.fillText(G.U.T('district.' + d.id), x, y - T * 0.08);
      ctx.font = '600 ' + Math.max(11, T * 0.3) + 'px "Martian Mono", monospace'; ctx.fillStyle = '#ffd36b'; ctx.fillText(G.U.fmt(Wd.districtCost(s, d.id)) + ' $ · ' + G.U.T('tabShop'), x, y + T * 0.42);
    });
  }

  /* ---------- Image ---------- */
  R.frame = (now, active) => {
    if (!ctx || !W) return 0;
    const dt = clamp(last ? (now - last) / 1000 : 0.016, 0, 0.05);
    last = Math.max(last, now); time += dt; combo.t += dt;
    const s = getState();
    R.tickSun(s);
    if (!active || !Wd.city) return dt;
    const clean = Math.round((1 - Wd.pollution(s)) * 20) / 20, key = [Wd.city.seed, T, clean, JSON.stringify(s.districts)].join('|');
    if (key !== bgKey) { buildBg(s, clean); bgKey = key; }
    sunFlash = Math.max(0, sunFlash - dt * 1.2); celebrate = Math.max(0, celebrate - dt * 0.5); shake = Math.max(0, shake - dt * 2);
    const vw = W / T, vh = H / T, p = Wd.player;
    const tx = vw >= C.W ? (C.W - vw) / 2 : clamp(p.x - vw / 2, 0, C.W - vw), ty = vh >= C.H ? (C.H - vh) / 2 : clamp(p.y - vh / 2, 0, C.H - vh);
    camX = lerp(camX, tx, Math.min(1, dt * 6)); camY = lerp(camY, ty, Math.min(1, dt * 6));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, W, H);
    if (shake > 0) ctx.translate(rnd(-1, 1) * shake * 4, rnd(-1, 1) * shake * 4);
    ctx.drawImage(bg, Math.round(-camX * T), Math.round(-camY * T));
    drawDepot(s);
    const list = [], z = Wd.Z.ground;
    for (const it of z.items) { if (it.x < camX - 1 || it.x > camX + vw + 1 || it.y < camY - 1 || it.y > camY + vh + 1) continue; list.push({ y: it.y, f: () => { const pop = clamp((now - it.born) / 250, 0, 1); R.drawJunk(ctx, it.kind, sx(it.x), sy(it.y), T * 0.11 * G.JUNK[it.kind].size * pop, it.a, 1, it.gold); } }); }
    const VESTS = ['#4fc3a1', '#5aa9e6', '#9b8cf2', '#e6c84f', '#e67fa8'];
    for (const a of z.agents) list.push({ y: a.y, f: () => R.drawPerson(ctx, sx(a.x), sy(a.y), T / 11, a.dir, a.moving ? Math.sin(a.walk) : 0, VESTS[a.hue], a.load.length / Wd.empCap(s), 0) });
    list.push({ y: p.y + 0.01, f: () => {
      const cap = Wd.bagCap(s), x = sx(p.x), y = sy(p.y);
      R.drawPerson(ctx, x, y - (p.moving ? Math.abs(Math.cos(p.walk)) * T * 0.04 : 0), T / 9.5, p.dir, p.moving ? Math.sin(p.walk) : 0, '#ff8a2a', s.bag.length / cap, 0);
      if (s.bag.length) {
        const n = Math.min(cap, 20), w = Math.min(T * 1.6, n * T * 0.13), x0 = x - w / 2;
        for (let i = 0; i < n; i++) { ctx.fillStyle = i < s.bag.length * n / cap ? (s.bag.length >= cap ? '#ffd36b' : '#ece6d9') : 'rgba(255,255,255,0.25)'; ctx.fillRect(x0 + (i / n) * w, y - T * 1.35, Math.max(2, w / n - 1.5), T * 0.08); }
        if (s.bag.length >= cap && G.U) { ctx.font = '600 ' + Math.max(11, T * 0.3) + 'px "Martian Mono", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd36b'; ctx.fillText(G.U.T('full'), x, y - T * 1.55); }
      }
      if (combo.n >= 2 && combo.t < 1.1) { const al = 1 - combo.t / 1.1, pop = 1 + Math.max(0, 0.35 - combo.t) * 1.5; ctx.save(); ctx.translate(x + T * 0.6, y - T * 1.5 - combo.t * T * 0.4); ctx.scale(pop, pop); ctx.font = Math.max(14, T * 0.42) + 'px Michroma, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,211,107,' + al + ')'; ctx.fillText('×' + combo.n, 0, 0); ctx.restore(); }
    } });
    list.sort((a, b) => a.y - b.y).forEach(o => o.f());
    for (let i = arcs.length - 1; i >= 0; i--) { const a = arcs[i]; a.t += dt / a.dur; if (a.t >= 1) { arcs.splice(i, 1); continue; } const q = ease(a.t); R.drawJunk(ctx, a.kind, sx(lerp(a.x0, a.x1, q)), sy(lerp(a.y0, a.y1, q)) - Math.sin(q * Math.PI) * T * 0.6, T * 0.16 * (1 - q * 0.4), q * 4, 1, a.gold); }
    if (p.path && p.path.length) { const end = p.path[p.path.length - 1]; ctx.strokeStyle = 'rgba(255,211,107,' + (0.5 + 0.3 * Math.sin(time * 6)) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx(end.x), sy(end.y), T * 0.28, 0, TAU); ctx.stroke(); }
    drawSigns(s);
    const poll = Wd.pollution(s);
    if (poll > 0.02) { ctx.fillStyle = rgba([120, 96, 60], 0.26 * poll); ctx.fillRect(0, 0, W, H); }
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    const sp = sunPos(); R.drawSun(ctx, sp.x, sp.y, sp.r, sunFlash, flares, dt);
    drawLaunches(dt);
    R.drawWreck(ctx, dt, sparks);
    if (R.burstAt) { burst(R.burstAt.x, R.burstAt.y, [255, 214, 120], 44, 130); R.burstAt = null; }
    R.drawParticles(ctx, dt, sparks, floaters, sx, sy);
    if (p.moving && Math.random() < 0.25) sparks.push({ x: sx(p.x), y: sy(p.y), vx: rnd(-8, 8), vy: rnd(-8, -2), t: 0, life: 0.35, c: [150, 126, 96] });
    if (celebrate > 0) { ctx.fillStyle = 'rgba(160,255,200,' + celebrate * 0.15 + ')'; ctx.fillRect(0, 0, W, H); }
    if (fade >= 0) { fade += dt / 1.6; ctx.fillStyle = 'rgba(4,5,10,' + Math.sin(Math.min(1, fade) * Math.PI) + ')'; ctx.fillRect(0, 0, W, H); if (fade >= 1) fade = -1; }
    return dt;
  };
})();
