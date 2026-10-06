'use strict';
/* Feed the Sun — moteur du jeu : économie, progression, sauvegarde. Aucun accès au DOM ici. */
(function () {
  const F = window.FTS;
  const C = (F.C = {});

  /* ---------- Améliorations : celles de la flotte sont générées ---------- */
  const UPS = [];
  F.GENS.forEach((g, i) => F.GEN_UPS.forEach((u, k) => UPS.push({
    id: 'g' + i + '_' + k, kind: 'gen', gen: i, tier: k, mult: 2, cost: g.cost * u.mul,
    req: s => s.gens[i] >= u.req,
  })));
  F.EXTRA_UPS.forEach(u => UPS.push(u));
  F.UPS = UPS;
  const BY_ID = {};
  const BY_KIND = {};
  UPS.forEach(u => { BY_ID[u.id] = u; (BY_KIND[u.kind] = BY_KIND[u.kind] || []).push(u); });
  const ofKind = k => BY_KIND[k] || [];
  const RELIC = {};
  F.RELICS.forEach(r => { RELIC[r.id] = r; });
  C.upById = id => BY_ID[id];

  /* ---------- Événements (le rendu et l'interface s'y abonnent) ---------- */
  const L = {};
  C.on = (type, fn) => { (L[type] = L[type] || []).push(fn); };
  C.emit = (type, data) => { if (!C._mute) (L[type] || []).forEach(fn => fn(data)); };

  /* ---------- État ---------- */
  C.pollution = n => F.POLLUTION_BASE * Math.pow(F.POLLUTION_GROWTH, n);
  C.planetValue = n => Math.pow(F.VALUE_GROWTH, n);

  C.fresh = function () {
    const now = Date.now();
    return {
      v: 1, credits: 0, creditsLife: 0, tonnesRun: 0, tonnesLife: 0, shots: 0,
      gens: F.GENS.map(() => 0), ups: {},
      planet: 0, planetLeft: C.pollution(0), cleanedRun: 0, cleanedLife: 0, awaitingTravel: false,
      crystals: 0, crystalsLife: 0, relics: {}, jumps: 0,
      wrecks: 0, ach: {}, buffs: [], longestAway: 0, playTime: 0, tutorial: 0,
      started: now, last: now,
      settings: { lang: null, sound: true, buy: 1, autoGens: true, autoUps: true },
    };
  };

  const ROMAN = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  C.roman = n => { let out = ''; for (const [v, r] of ROMAN) while (n >= v) { out += r; n -= v; } return out || 'I'; };

  C.planetInfo = (s, n = s.planet) => {
    const p = F.PLANETS[n % F.PLANETS.length];
    const cycle = Math.floor(n / F.PLANETS.length);
    const sfx = cycle ? ' ' + C.roman(cycle + 1) : '';
    return { bad: p.bad + sfx, good: p.good + sfx, sea: p.sea, land: p.land, index: n };
  };

  C.totalGens = s => s.gens.reduce((a, b) => a + b, 0);
  C.relic = (s, id) => !!s.relics[id];
  C.achCount = s => Object.keys(s.ach).length;
  C.sunStage = s => { let k = 0; for (let i = 0; i < F.SUN.length; i++) if (s.tonnesLife >= F.SUN[i].at) k = i; return k; };
  /* Un nouvel engin par planète atteinte (Canon et Drone dès le départ). */
  C.unlockPlanet = i => Math.max(0, i - 1);
  C.genUnlocked = (s, i) => s.planet >= C.unlockPlanet(i) && (i === 0 || s.gens[i - 1] > 0 || s.gens[i] > 0);

  /* ---------- Coûts ---------- */
  C.genCost = (s, i, n = s.gens[i]) => F.GENS[i].cost * Math.pow(F.GROWTH, n);
  C.bulkCost = (s, i, k) => C.genCost(s, i) * (Math.pow(F.GROWTH, k) - 1) / (F.GROWTH - 1);
  C.maxAfford = (s, i, budget = s.credits) => {
    const c0 = C.genCost(s, i);
    if (budget < c0) return 0;
    let k = Math.floor(Math.log(budget * (F.GROWTH - 1) / c0 + 1) / Math.log(F.GROWTH));
    while (k > 0 && C.bulkCost(s, i, k) > budget) k--;
    return k;
  };

  /* ---------- Multiplicateurs ---------- */
  C.msCount = n => { let c = 0; for (const m of F.MILESTONES) if (n >= m) c++; return c; };
  C.nextMilestone = n => F.MILESTONES.find(m => n < m) || null;
  C.msFactor = s => (C.relic(s, 'forge') ? 3 : 2);

  C.genMult = (s, i) => {
    let m = Math.pow(C.msFactor(s), C.msCount(s.gens[i]));
    for (const u of ofKind('gen')) if (u.gen === i && s.ups[u.id]) m *= u.mult;
    for (const u of ofKind('syn')) if (u.target === i && s.ups[u.id]) m *= 1 + u.per * s.gens[u.source];
    return m;
  };
  C.prodMult = s => {
    let m = (1 + F.CRYSTAL_BONUS * s.crystalsLife) * (1 + F.ACH_BONUS * C.achCount(s));
    for (const u of ofKind('prod')) if (s.ups[u.id]) m *= u.mult;
    return m;
  };
  C.buffMult = (s, type) => { let m = 1; for (const b of s.buffs) if (b.type === type) m *= b.mult; return m; };
  C.genTps = (s, i) => F.GENS[i].prod * s.gens[i] * C.genMult(s, i) * C.prodMult(s);
  C.tps = (s, withBuffs = true) => {
    let t = 0;
    for (let i = 0; i < F.GENS.length; i++) if (s.gens[i]) t += F.GENS[i].prod * s.gens[i] * C.genMult(s, i);
    t *= C.prodMult(s);
    return withBuffs ? t * C.buffMult(s, 'frenzy') : t;
  };
  C.value = s => {
    let v = C.planetValue(s.planet) * Math.pow(F.SUN_MULT, C.sunStage(s));
    for (const u of ofKind('value')) if (s.ups[u.id]) v *= u.mult;
    if (C.relic(s, 'sunmem')) v *= 2;
    return v;
  };
  C.cps = (s, withBuffs = true) => (s.awaitingTravel ? 0 : C.tps(s, withBuffs) * C.value(s));
  C.shotTonnes = s => {
    let base = 1, pct = 0;
    for (const u of ofKind('click')) if (s.ups[u.id]) base *= u.mult;
    for (const u of ofKind('clickPct')) if (s.ups[u.id]) pct += u.add;
    if (C.relic(s, 'quantum')) base *= 10;
    return (base * C.prodMult(s) + pct * C.tps(s, true)) * C.buffMult(s, 'overdrive');
  };
  C.buffDur = s => { let m = 1; for (const u of ofKind('buffDur')) if (s.ups[u.id]) m *= u.mult; return m; };
  C.wreckInterval = s => {
    let base = 75;
    for (const u of ofKind('wreckRate')) if (s.ups[u.id]) base /= u.mult;
    if (C.relic(s, 'detector')) base /= 2;
    return base;
  };

  /* ---------- Incinération ---------- */
  C.addTonnes = (s, t) => {
    if (s.awaitingTravel || !(t > 0)) return 0;
    const burned = Math.min(t, s.planetLeft);
    const cr = burned * C.value(s);
    s.planetLeft -= burned;
    s.tonnesRun += burned; s.tonnesLife += burned;
    s.credits += cr; s.creditsLife += cr;
    if (s.planetLeft <= C.pollution(s.planet) * 1e-9) {
      s.planetLeft = 0; s.cleanedRun++; s.cleanedLife++; s.awaitingTravel = true;
      C.emit('cleaned', s.planet);
    }
    return burned;
  };

  C.shoot = (s, auto = false) => {
    if (s.awaitingTravel) return 0;
    const t = C.shotTonnes(s);
    s.shots++;
    C.addTonnes(s, t);
    C.emit('shot', { tonnes: t, auto });
    return t;
  };

  C.travel = s => {
    if (!s.awaitingTravel) return;
    s.planet++; s.planetLeft = C.pollution(s.planet); s.awaitingTravel = false;
    C.emit('travel', s.planet);
  };

  /* ---------- Achats ---------- */
  C.buyGen = (s, i, k) => {
    if (!C.genUnlocked(s, i)) return 0;
    if (k === 'max') k = C.maxAfford(s, i);
    if (!(k > 0)) return 0;
    const cost = C.bulkCost(s, i, k);
    if (cost > s.credits) return 0;
    const before = C.msCount(s.gens[i]);
    s.credits -= cost; s.gens[i] += k;
    const after = C.msCount(s.gens[i]);
    C.emit('buy', { i, k });
    if (after > before) C.emit('milestone', { i, count: F.MILESTONES[after - 1] });
    return k;
  };
  C.availableUps = s => UPS.filter(u => !s.ups[u.id] && u.req(s)).sort((a, b) => a.cost - b.cost);
  C.buyUp = (s, id) => {
    const u = BY_ID[id];
    if (!u || s.ups[id] || !u.req(s) || s.credits < u.cost) return false;
    s.credits -= u.cost; s.ups[id] = true;
    C.emit('upgrade', u);
    return true;
  };
  C.buyRelic = (s, id) => {
    const r = RELIC[id];
    if (!r || s.relics[id] || s.crystals < r.cost) return false;
    s.crystals -= r.cost; s.relics[id] = true;
    if (id === 'fleet') { s.gens[0] = Math.max(s.gens[0], 10); s.gens[1] = Math.max(s.gens[1], 5); }
    C.emit('relic', r);
    return true;
  };
  C.autobuy = s => {
    if (C.relic(s, 'factory') && s.settings.autoGens) {
      for (let pass = 0; pass < 6; pass++) {
        let bought = false;
        for (let i = F.GENS.length - 1; i >= 0; i--) {
          if (C.genUnlocked(s, i) && C.genCost(s, i) <= s.credits * 0.5) bought = C.buyGen(s, i, 1) > 0 || bought;
        }
        if (!bought) break;
      }
    }
    if (C.relic(s, 'office') && s.settings.autoUps) {
      for (const u of C.availableUps(s)) { if (u.cost <= s.credits * 0.5) C.buyUp(s, u.id); else break; }
    }
  };

  /* ---------- Épaves scintillantes ---------- */
  C.salvage = (s, r = Math.random()) => {
    s.wrecks++;
    const dur = C.buffDur(s);
    let res;
    if (r < 0.45) {
      const c = Math.max(C.cps(s, false) * 90, 50 * C.value(s));
      s.credits += c; s.creditsLife += c;
      res = { type: 'cargo', credits: c };
    } else if (r < 0.8) {
      const d = 30 * dur; s.buffs.push({ type: 'frenzy', mult: 5, left: d, total: d });
      res = { type: 'frenzy', secs: d };
    } else {
      const d = 15 * dur; s.buffs.push({ type: 'overdrive', mult: 10, left: d, total: d });
      res = { type: 'overdrive', secs: d };
    }
    C.emit('salvage', res);
    return res;
  };

  /* ---------- Saut galactique (prestige) ---------- */
  C.canJump = s => s.cleanedRun >= F.JUMP_REQ;
  C.jumpGain = s => (s.cleanedRun * (s.cleanedRun + 1)) / 2;
  C.jump = s => {
    if (!C.canJump(s)) return 0;
    const g = C.jumpGain(s);
    s.crystals += g; s.crystalsLife += g; s.jumps++;
    s.credits = 0; s.tonnesRun = 0; s.gens = F.GENS.map(() => 0); s.ups = {}; s.buffs = [];
    s.planet = 0; s.planetLeft = C.pollution(0); s.cleanedRun = 0; s.awaitingTravel = false;
    if (C.relic(s, 'fleet')) { s.gens[0] = 10; s.gens[1] = 5; }
    C.emit('jump', g);
    return g;
  };

  /* ---------- Succès ---------- */
  C.checkAch = s => {
    for (const a of F.ACHIEVEMENTS) if (!s.ach[a.id] && a.ok(s)) { s.ach[a.id] = Date.now(); C.emit('ach', a); }
  };

  /* ---------- Boucle ---------- */
  C.tick = (s, dt) => {
    s.playTime += dt;
    const base = C.tps(s, false);
    let extra = 0;
    for (const b of s.buffs) if (b.type === 'frenzy') extra += (b.mult - 1) * Math.min(dt, Math.max(0, b.left));
    C.addTonnes(s, base * (dt + extra));
    for (const b of s.buffs) b.left -= dt;
    if (s.buffs.length) s.buffs = s.buffs.filter(b => b.left > 0);
    if (C.relic(s, 'gatling')) {
      s._gat = (s._gat || 0) + dt;
      while (s._gat >= 0.5) { s._gat -= 0.5; C.shoot(s, true); }
    }
    s._ab = (s._ab || 0) + dt;
    if (s._ab >= 0.25) { s._ab = 0; C.autobuy(s); }
    s._ac = (s._ac || 0) + dt;
    if (s._ac >= 1) { s._ac = 0; C.checkAch(s); }
  };

  /* Gains hors ligne : la flotte continue, s'arrête sur une planète propre sauf avec le pilote automatique. */
  C.offline = (s, secs) => {
    const cap = C.relic(s, 'offline') ? 24 * 3600 : F.OFFLINE_CAP;
    let left = Math.min(secs, cap);
    const res = { secs, tonnes: 0, credits: 0, planets: 0, capped: secs > cap, stopped: false };
    s.buffs = [];
    s.longestAway = Math.max(s.longestAway, secs);
    const t0 = s.tonnesLife, c0 = s.credits, p0 = s.cleanedLife;
    for (let guard = 0; left > 0 && guard < 300; guard++) {
      if (s.awaitingTravel) { if (C.relic(s, 'autopilot')) C.travel(s); else { res.stopped = true; break; } }
      const tps = C.tps(s, false);
      if (!(tps > 0)) break;
      const need = s.planetLeft / tps;
      const dt = Math.min(left, need);
      C.addTonnes(s, dt >= need ? s.planetLeft : tps * dt);
      left -= dt;
    }
    if (s.awaitingTravel && !C.relic(s, 'autopilot')) res.stopped = true;
    res.tonnes = s.tonnesLife - t0; res.credits = s.credits - c0; res.planets = s.cleanedLife - p0;
    C.checkAch(s);
    return res;
  };

  /* ---------- Sauvegarde ---------- */
  C.serialize = s => JSON.stringify(s, (k, v) => (k && k[0] === '_' ? undefined : v));
  C.revive = obj => {
    const s = C.fresh();
    if (!obj || typeof obj !== 'object' || obj.v !== 1 || !Array.isArray(obj.gens)) return null;
    for (const k of Object.keys(s)) if (obj[k] !== undefined && typeof obj[k] === typeof s[k]) s[k] = obj[k];
    s.settings = Object.assign(C.fresh().settings, obj.settings || {});
    s.gens = F.GENS.map((_, i) => Math.max(0, Math.floor(Number(obj.gens[i]) || 0)));
    for (const k of ['credits', 'creditsLife', 'tonnesRun', 'tonnesLife', 'planetLeft', 'crystals', 'crystalsLife']) {
      if (!Number.isFinite(s[k]) || s[k] < 0) s[k] = 0;
    }
    if (!Array.isArray(s.buffs)) s.buffs = [];
    if (s.planetLeft <= 0 && !s.awaitingTravel) s.planetLeft = C.pollution(s.planet);
    return s;
  };
  C.save = s => {
    s.last = Date.now();
    try { localStorage.setItem(F.SAVE_KEY, C.serialize(s)); return true; } catch (e) { return false; }
  };
  C.load = () => {
    try { const raw = localStorage.getItem(F.SAVE_KEY); return raw ? C.revive(JSON.parse(raw)) : null; } catch (e) { return null; }
  };
  C.wipe = () => { try { localStorage.removeItem(F.SAVE_KEY); } catch (e) { /* stockage indisponible */ } };
  C.exportSave = s => btoa(unescape(encodeURIComponent(C.serialize(s))));
  C.importSave = str => {
    try { return C.revive(JSON.parse(decodeURIComponent(escape(atob(String(str).trim()))))); } catch (e) { return null; }
  };

  /* ---------- Simulation d'équilibrage (joueur glouton, sans affichage) ---------- */
  C.simulate = (opts = {}) => {
    const minutes = opts.minutes || 60, clicks = opts.clicks == null ? 3 : opts.clicks;
    const s = C.fresh();
    Object.assign(s, opts.state || {});
    C._mute = true;
    const ev = [], seen = {};
    const mark = (k, t) => { if (!(k in seen)) { seen[k] = t; ev.push((t / 60).toFixed(1) + ' min ' + k); } };
    const rate = st => C.tps(st, false) * C.value(st) + clicks * C.shotTonnes(st) * C.value(st);
    let t = 0;
    while (t < minutes * 60) {
      for (let guard = 0; guard < 60; guard++) {
        const r0 = rate(s);
        let best = null, ratio = Infinity;
        for (let i = 0; i < F.GENS.length; i++) {
          if (!C.genUnlocked(s, i)) continue;
          const c = C.genCost(s, i);
          s.gens[i]++; const d = rate(s) - r0; s.gens[i]--;
          if (d > 0 && c / d < ratio) { ratio = c / d; best = { g: i, c }; }
        }
        for (const u of C.availableUps(s)) {
          s.ups[u.id] = true; const d = rate(s) - r0; delete s.ups[u.id];
          if (d > 0 && u.cost / d < ratio) { ratio = u.cost / d; best = { u: u.id, c: u.cost }; }
          else if (d <= 0 && u.cost < s.credits * 0.1) C.buyUp(s, u.id);
        }
        if (!best || best.c > s.credits) break;
        if (best.g !== undefined) { C.buyGen(s, best.g, 1); mark('gen' + (best.g + 1), t); } else C.buyUp(s, best.u);
      }
      for (let k = 0; k < clicks; k++) C.shoot(s);
      C.tick(s, 1);
      if (s.awaitingTravel) { mark('planete' + (s.planet + 1) + '-sauvee', t); C.travel(s); }
      mark('soleil' + C.sunStage(s), t);
      if (C.canJump(s)) mark('saut-possible(' + C.jumpGain(s) + ')', t);
      t++;
    }
    C._mute = false;
    return { events: ev, planet: s.planet + 1, pollutionLeft: s.planetLeft, tps: C.tps(s, false), gens: s.gens.slice(), ups: Object.keys(s.ups).length, state: s };
  };
})();
