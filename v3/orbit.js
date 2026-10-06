'use strict';
/* Feed the Sun v3 — rendu de l'orbite : vaisseau-benne, pilotes, débris spatiaux, station et canon orbital. */
(function () {
  const G = window.FTS3, Wd = G.W, R = G.R;
  const O = (G.O = {});
  const { rnd, lerp, clamp, mix, rgba, ease, TAU, reduced } = R;
  const Z = G.ZONES.orbit, BASE_Y = Z.baseY;
  let cv, ctx, W = 0, H = 0, dpr = 1, k = 1, camX = 0, getState, last = 0, sunFlash = 0, shownClean = 0;
  const shots = [], sparks = [], floaters = [], flares = [];
  let stars = [];
  const sx = x => (x - camX) * k, sy = y => y * k;
  const SHIPS = ['#5aa9e6', '#4fc3a1', '#9b8cf2', '#e6c84f', '#e67fa8'];

  O.init = (canvas, stateFn) => {
    cv = canvas; ctx = cv.getContext('2d'); getState = stateFn;
    stars = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() < 0.9 ? rnd(0.4, 1.1) : rnd(1.2, 2), p: rnd(0, TAU), w: rnd(0.4, 1.6), par: rnd(0.02, 0.12) }));
    O.resize(); window.addEventListener('resize', O.resize);
  };
  O.resize = () => {
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.max(1, r.width); H = Math.max(1, r.height); k = H / 100;
  };
  O.toWorld = (px, py) => ({ x: px / k + camX, y: py / k });
  O.itemAt = (px, py) => {
    const p = O.toWorld(px, py); let best = null, bd = 6;
    for (const it of Wd.Z.orbit.items) { const d = Math.hypot(it.x - p.x, it.y - p.y); if (d < bd) { bd = d; best = it; } }
    return best;
  };
  const sunPos = () => ({ x: W * 0.74 - camX * k * 0.03, y: H * 0.2, r: Math.min(W, H) * 0.08 });

  function drawShip(x, y, a, s, hull, flash) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const eg = ctx.createRadialGradient(-s * 1.3, 0, 0, -s * 1.3, 0, s * 1.1);
    eg.addColorStop(0, 'rgba(140,210,255,0.9)'); eg.addColorStop(1, 'rgba(140,210,255,0)');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.ellipse(-s * 1.4, 0, s * (0.9 + Math.sin(R.time() * 22) * 0.1), s * 0.35, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = hull;
    ctx.beginPath(); ctx.moveTo(s * 1.2, 0); ctx.lineTo(s * 0.2, s * 0.42); ctx.lineTo(-s, s * 0.75); ctx.lineTo(-s * 0.7, 0); ctx.lineTo(-s, -s * 0.75); ctx.lineTo(s * 0.2, -s * 0.42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(120,220,255,0.9)'; ctx.beginPath(); ctx.ellipse(s * 0.35, 0, s * 0.22, s * 0.12, 0, 0, TAU); ctx.fill();
    if (flash) { ctx.strokeStyle = 'rgba(255,214,120,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, s * 2.2, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  function drawStation(s) {
    const x = sx(Z.base), y = sy(BASE_Y), u = k;
    ctx.strokeStyle = '#6f7890'; ctx.lineWidth = 0.6 * u;
    ctx.beginPath(); ctx.moveTo(x - 12 * u, y); ctx.lineTo(x + 6 * u, y); ctx.stroke();
    ctx.fillStyle = '#3b5aa0'; ctx.fillRect(x - 18 * u, y - 3 * u, 6 * u, 6 * u); ctx.fillRect(x + 6 * u, y - 3 * u, 6 * u, 6 * u);
    ctx.strokeStyle = 'rgba(160,190,255,0.5)'; ctx.lineWidth = 1;
    for (const ox of [-18, 6]) { ctx.beginPath(); ctx.moveTo(x + (ox + 3) * u, y - 3 * u); ctx.lineTo(x + (ox + 3) * u, y + 3 * u); ctx.stroke(); }
    ctx.fillStyle = '#d9dde8'; ctx.fillRect(x - 5 * u, y - 5 * u, 10 * u, 10 * u);
    const sp = sunPos(), a = Math.atan2(sp.y - y, sp.x - x);
    ctx.save(); ctx.translate(x, y - 5 * u); ctx.rotate(a); ctx.fillStyle = '#8b93a8'; ctx.fillRect(0, -1 * u, 9 * u, 2 * u); ctx.restore();
    const fill = s.cont.orbit.length / Wd.contCap(s, 'orbit');
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 5 * u, y + 6 * u, 10 * u, 1 * u);
    ctx.fillStyle = 'rgba(255,211,107,0.9)'; ctx.fillRect(x - 5 * u, y + 6 * u, 10 * u * Math.min(1, fill), 1 * u);
    ctx.fillStyle = s.team.gunner ? (Math.sin(R.time() * 4) > 0 ? '#5ad1a0' : '#2f6b55') : 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(x, y - 1 * u, 1.2 * u, 0, TAU); ctx.fill();
  }
  function drawPlanet(s) {
    const info = Wd.planetInfo(s), c = shownClean, R2 = Math.max(W, H) * 1.6, cx = W / 2 - camX * k * 0.05, cy = H * 0.86 + R2;
    const air = mix([190, 150, 90], [110, 180, 255], c);
    let g = ctx.createRadialGradient(cx, cy, R2 * 0.995, cx, cy, R2 * 1.05);
    g.addColorStop(0, rgba(air, 0.5)); g.addColorStop(1, rgba(air, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createLinearGradient(0, H * 0.86, 0, H);
    g.addColorStop(0, rgba(mix([120, 96, 64], info.sea, c), 1)); g.addColorStop(1, rgba(mix([60, 48, 36], mix(info.grass, [10, 30, 20], 0.5), c), 1));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R2, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(mix(air, [255, 255, 255], 0.4), 0.55); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R2, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
  }

  O.fxLaunch = e => { shots.push({ t: 0 }); floaters.push({ text: '+' + e.label + ' $', x: Z.base, y: BASE_Y - 10, t: 0 }); };
  O.fxSunUp = () => { sunFlash = 1; };

  O.frame = (now, active) => {
    if (!ctx || !W || !active) return;
    const dt = clamp(last ? (now - last) / 1000 : 0.016, 0, 0.05); last = Math.max(last, now);
    const s = getState(), t = R.time();
    shownClean = lerp(shownClean, 1 - Wd.pollution(s), Math.min(1, dt * 2)); sunFlash = Math.max(0, sunFlash - dt * 1.2);
    const viewW = W / k; camX = lerp(camX, clamp(Wd.ship.x - viewW * 0.4, 0, Math.max(0, Z.w - viewW)), Math.min(1, dt * 5));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#04050a'; ctx.fillRect(0, 0, W, H);
    for (const st of stars) { const x = ((st.x * W - camX * k * st.par) % W + W) % W; ctx.fillStyle = 'rgba(235,238,255,' + (0.3 + 0.55 * (0.5 + 0.5 * Math.sin(t * st.w + st.p))) + ')'; ctx.fillRect(x, st.y * H, st.s, st.s); }
    const sp = sunPos(); R.drawSun(ctx, sp.x, sp.y, sp.r, sunFlash, flares, dt);
    drawPlanet(s);
    for (const it of Wd.Z.orbit.items) {
      it.x += Math.sin(it.id) * 1.2 * dt; it.a += it.va * dt;
      if (it.x < Z.spawnMin) it.x = Z.w - 8; if (it.x > Z.w - 4) it.x = Z.spawnMin;
      const sz = G.JUNK[it.kind].size * k * 0.75, pop = clamp((now - it.born) / 250, 0, 1);
      R.drawJunk(ctx, it.kind, sx(it.x), sy(it.y), sz * pop, it.a, 1, it.gold);
    }
    drawStation(s);
    Wd.Z.orbit.agents.forEach((a, i) => {
      const tgt = a.state === 'return' ? { x: Z.base, y: BASE_Y } : a.target || { x: a.x + a.dir, y: a.y };
      drawShip(sx(a.x), sy(a.y), Math.atan2(tgt.y - a.y, tgt.x - a.x), Math.max(6, k * 1.7), SHIPS[i % SHIPS.length], a.load.length >= Wd.pilotCap(s));
    });
    const sh = Wd.ship, ang = sh.tx != null ? Math.atan2(sh.ty - sh.y, sh.tx - sh.x) : (sh.dir > 0 ? 0 : Math.PI);
    drawShip(sx(sh.x), sy(sh.y), ang, Math.max(9, k * 2.6), '#e8ecf4', false);
    const cap = Wd.holdCap(s);
    if (s.hold.length) { const n = Math.min(cap, 20), w = Math.min(14, n * 1.1) * k, x0 = sx(sh.x) - w / 2; for (let i = 0; i < n; i++) { ctx.fillStyle = i < s.hold.length * n / cap ? (s.hold.length >= cap ? '#ffd36b' : '#ece6d9') : 'rgba(255,255,255,0.18)'; ctx.fillRect(x0 + (i / n) * w, sy(sh.y) - 5 * k, Math.max(2, w / n - 1.5), 0.7 * k); } }
    const ox = sx(Z.base), oy = sy(BASE_Y - 5);
    for (let i = shots.length - 1; i >= 0; i--) {
      const L2 = shots[i]; L2.t += dt / 1.5;
      if (L2.t >= 1) { shots.splice(i, 1); sunFlash = Math.min(1, sunFlash + 0.5); flares.push({ a: rnd(0, TAU), t: 0, life: rnd(1, 1.6), h: rnd(0.8, 1.3) }); for (let j = 0; j < 24; j++) { const b = rnd(0, TAU), v = rnd(20, 90); sparks.push({ x: sp.x, y: sp.y, vx: Math.cos(b) * v, vy: Math.sin(b) * v, t: 0, life: rnd(0.4, 1), c: [255, 200, 140] }); } continue; }
      const e = ease(L2.t), x = lerp(ox, sp.x, e), y = lerp(oy, sp.y, e) - Math.sin(e * Math.PI) * H * 0.08, sc = lerp(1, 0.25, e);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,200,140,0.8)'; ctx.beginPath(); ctx.arc(x, y, 2.4 * k * sc, 0, TAU); ctx.fill(); ctx.restore();
      if (!reduced) sparks.push({ x, y, vx: rnd(-10, 10), vy: rnd(-10, 10), t: 0, life: 0.5, c: [255, 210, 160] });
    }
    R.drawWreck(ctx, dt, sparks);
    if (R.burstAt) { for (let j = 0; j < 44; j++) { const b = rnd(0, TAU), v = rnd(30, 130); sparks.push({ x: R.burstAt.x, y: R.burstAt.y, vx: Math.cos(b) * v, vy: Math.sin(b) * v, t: 0, life: rnd(0.5, 1.2), c: [255, 214, 120] }); } R.burstAt = null; }
    if (sh.moving && Math.random() < 0.5) sparks.push({ x: sx(sh.x) - Math.cos(ang) * 2 * k, y: sy(sh.y) - Math.sin(ang) * 2 * k, vx: rnd(-6, 6), vy: rnd(-6, 6), t: 0, life: 0.4, c: [140, 210, 255] });
    R.drawParticles(ctx, dt, sparks, floaters, sx, sy);
  };
})();
