'use strict';
/* Feed the Sun v3 — logique de la phase au sol : déplacement, ramassage, conteneur, lancement, économie. */
(function () {
  const G = window.FTS3;
  const W = (G.W = {});
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- Événements ---------- */
  const L = {};
  W.on = (type, fn) => { (L[type] = L[type] || []).push(fn); };
  const emit = (type, data) => (L[type] || []).forEach(fn => fn(data));

  /* ---------- État sauvegardé ---------- */
  W.fresh = () => ({
    v: 3, money: 0, moneyLife: 0, sent: 0, planet: 0, remaining: G.planetItems(0), saved: 0,
    lvl: { bag: 0, boots: 0, container: 0, magnet: 0, ramp: 0 },
    bag: [], cont: [], awaitingTravel: false, tutorial: 0, playTime: 0,
    settings: { lang: null, sound: true }, last: Date.now(),
  });

  /* ---------- Monde (non sauvegardé, recréé au chargement) ---------- */
  W.items = [];
  W.player = { x: 46, y: 84, tx: null, ty: null, dir: 1, walk: 0, moving: false };
  W.input = { x: 0, y: 0 };
  W.launching = 0;
  let nextId = 1, dumpTimer = 0;

  const pickKind = () => {
    let total = 0; for (const [, w] of G.JUNK_WEIGHTS) total += w;
    let r = Math.random() * total;
    for (const [k, w] of G.JUNK_WEIGHTS) { r -= w; if (r <= 0) return k; }
    return 'bag';
  };
  function spawn(s, near) {
    const minX = 42, x = near ? rnd(minX, minX + 60) : minX + (G.WORLD_W - 6 - minX) * Math.pow(Math.random(), 1.3);
    W.items.push({ id: nextId++, kind: pickKind(), x, y: rnd(G.GROUND_TOP + 1.5, G.GROUND_BOTTOM - 1), a: rnd(-0.6, 0.6), born: performance.now() });
  }
  W.fill = (s, first) => {
    const want = Math.min(G.VISIBLE_MAX, s.remaining);
    while (W.items.length < want) spawn(s, first && W.items.length < 8);
  };
  W.reset = s => { W.items = []; W.player.x = 46; W.player.y = 84; W.player.tx = W.player.ty = null; W.launching = 0; W.fill(s, true); };

  /* ---------- Valeurs dérivées ---------- */
  const up = id => G.UPGRADES.find(u => u.id === id);
  W.eff = (s, id) => up(id).eff(s.lvl[id]);
  W.bagCap = s => W.eff(s, 'bag');
  W.contCap = s => W.eff(s, 'container');
  W.reach = s => W.eff(s, 'magnet');
  W.itemValue = (s, kind) => G.JUNK[kind].value * G.planetValue(s.planet) * W.eff(s, 'ramp');
  W.contValue = s => {
    let v = 0; for (const k of s.cont) v += W.itemValue(s, k);
    return Math.round(v * (s.cont.length >= W.contCap(s) ? G.FULL_BONUS : 1));
  };
  W.cost = (s, id) => { const u = up(id); return Math.round(u.base * Math.pow(u.growth, s.lvl[id])); };
  W.canBuy = (s, id) => s.lvl[id] < up(id).max && s.money >= W.cost(s, id);
  W.buy = (s, id) => {
    if (!W.canBuy(s, id)) return false;
    s.money -= W.cost(s, id); s.lvl[id]++;
    emit('buy', id);
    return true;
  };
  W.sunStage = s => { let k = 0; for (let i = 0; i < G.SUN.length; i++) if (s.sent >= G.SUN[i].at) k = i; return k; };
  W.pollution = s => (s.remaining + s.bag.length + s.cont.length) / G.planetItems(s.planet);
  W.planetInfo = (s, n = s.planet) => {
    const p = G.PLANETS[n % G.PLANETS.length], c = Math.floor(n / G.PLANETS.length);
    const sfx = c ? ' ' + ['II', 'III', 'IV', 'V', 'VI'][Math.min(4, c - 1)] : '';
    return { bad: p.bad + sfx, good: p.good + sfx, grass: p.grass, sky: p.sky };
  };
  W.nearBase = () => Math.abs(W.player.x - G.BASE_X) < 7;

  /* ---------- Commandes ---------- */
  W.goTo = (x, y) => { W.player.tx = clamp(x, 4, G.WORLD_W - 4); W.player.ty = clamp(y, G.GROUND_TOP, G.GROUND_BOTTOM); };

  W.launch = s => {
    if (!s.cont.length || W.launching > 0) return false;
    const n = s.cont.length, full = n >= W.contCap(s), money = W.contValue(s);
    s.money += money; s.moneyLife += money; s.sent += n;
    const kinds = s.cont.slice(0, 12);
    s.cont = [];
    W.launching = 1.4;
    emit('launch', { n, money, full, kinds });
    checkClean(s);
    return true;
  };
  W.travel = s => {
    if (!s.awaitingTravel) return;
    s.planet++; s.remaining = G.planetItems(s.planet); s.awaitingTravel = false;
    W.reset(s);
    emit('travel', s.planet);
  };
  function checkClean(s) {
    if (!s.awaitingTravel && s.remaining <= 0 && !s.bag.length && !s.cont.length) {
      s.awaitingTravel = true; s.saved++;
      emit('cleaned', s.planet);
    }
  }

  /* ---------- Mise à jour ---------- */
  W.update = (s, dt) => {
    s.playTime += dt;
    if (W.launching > 0) W.launching = Math.max(0, W.launching - dt);
    const p = W.player, speed = G.SPEED * W.eff(s, 'boots');
    let vx = 0, vy = 0;
    if (W.input.x || W.input.y) {
      p.tx = p.ty = null;
      const len = Math.hypot(W.input.x, W.input.y);
      vx = W.input.x / len; vy = (W.input.y / len) * 0.6;
    } else if (p.tx != null) {
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d < 0.6) { p.tx = p.ty = null; } else { vx = dx / d; vy = dy / d; }
    }
    p.moving = !!(vx || vy);
    if (p.moving) {
      p.x = clamp(p.x + vx * speed * dt, 4, G.WORLD_W - 4);
      p.y = clamp(p.y + vy * speed * dt, G.GROUND_TOP, G.GROUND_BOTTOM);
      if (Math.abs(vx) > 0.05) p.dir = vx > 0 ? 1 : -1;
      p.walk += dt * speed * 0.35;
    }
    // Ramassage
    const cap = W.bagCap(s), reach = W.reach(s);
    if (s.bag.length < cap) {
      for (let i = W.items.length - 1; i >= 0 && s.bag.length < cap; i--) {
        const it = W.items[i];
        if (Math.hypot(it.x - p.x, (it.y - p.y) * 1.6) <= reach) {
          W.items.splice(i, 1); s.bag.push(it.kind); s.remaining--;
          emit('pickup', it);
          if (s.bag.length >= cap) emit('bagFull');
        }
      }
      W.fill(s, false);
    }
    // Vidage dans le conteneur
    if (W.nearBase() && s.bag.length && W.launching <= 0.6) {
      dumpTimer -= dt;
      const ccap = W.contCap(s);
      while (dumpTimer <= 0 && s.bag.length && s.cont.length < ccap) {
        const k = s.bag.pop(); s.cont.push(k); dumpTimer += 0.06;
        emit('dump', k);
        if (s.cont.length >= ccap) emit('contFull');
      }
    } else dumpTimer = 0;
    checkClean(s);
  };

  /* ---------- Sauvegarde ---------- */
  W.save = s => { s.last = Date.now(); try { localStorage.setItem(G.SAVE_KEY, JSON.stringify(s)); return true; } catch (e) { return false; } };
  W.load = () => {
    try {
      const raw = localStorage.getItem(G.SAVE_KEY); if (!raw) return null;
      const o = JSON.parse(raw), s = W.fresh();
      if (!o || o.v !== 3) return null;
      for (const k of Object.keys(s)) if (o[k] !== undefined && typeof o[k] === typeof s[k]) s[k] = o[k];
      s.lvl = Object.assign(W.fresh().lvl, o.lvl || {});
      s.settings = Object.assign(W.fresh().settings, o.settings || {});
      if (!Array.isArray(s.bag)) s.bag = [];
      if (!Array.isArray(s.cont)) s.cont = [];
      return s;
    } catch (e) { return null; }
  };
  W.wipe = () => { try { localStorage.removeItem(G.SAVE_KEY); } catch (e) { /* stockage indisponible */ } };
})();
