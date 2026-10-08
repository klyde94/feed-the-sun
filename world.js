'use strict';
/* Feed the Sun v4 — moteur : planète ensevelie (aspiration), machines, van, orbite, économie, arbre, missions, sauvegarde. */
(function () {
  const G = window.FTS3, P = G.PLANET;
  const W = (G.W = {});
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const L = {};
  W.on = (type, fn) => { (L[type] = L[type] || []).push(fn); };
  const emit = (type, data) => { if (!W.mute) (L[type] || []).forEach(fn => fn(data)); };

  /* ---------- État sauvegardé ---------- */
  W.fresh = () => ({
    v: 5, money: 0, moneyLife: 0, sent: 0, planet: 0, saved: 0, savedRun: 0, jumps: 0, crystals: 0,
    grid: '', needle: 'hidden', tank: 0, contG: 0, cont: { orbit: [] }, hold: [],
    gear: Object.fromEntries(G.GEAR.map(g => [g.id, 0])), ship: false,
    team: { robot: 0, launcher: 0, dozer: 0, crane: 0, pilot: 0, gunner: 0 }, crew: { orbit: { xp: 0, lvl: 1 } },
    xp: 0, level: 1, skillPts: 0, techPts: 0, tree: { root: 1 }, goldLife: 0, wrecks: 0, ach: {},
    picked: 0, dumped: 0, launches: 0, orbitPicked: 0, mission: 0, needles: 0,
    walked: 0, maxCombo: 0, insomniac: false, outfit: 'helmet', outfits: { helmet: true },
    frenzy: 0, awaitingTravel: false, seenOrbit: false, playTime: 0, view: 'ground',
    rate: { items: 0, money: 0 }, settings: { lang: null, sound: true }, last: Date.now(),
  });

  /* ---------- Monde en mémoire ---------- */
  W.pl = null;                     // planète en cours (grille de déchets)
  W.dirty = new Set();             // morceaux de carte à redessiner
  W.mach = [];                     // machines au sol
  W.Z = { ground: { launching: 0 }, orbit: { items: [], launching: 0, agents: [], dump: 0, acc: 0 } };
  W.player = { x: P.START.x, y: P.START.y, tx: null, ty: null, dir: 1, walk: 0, moving: false, sucking: 0 };
  W.ship = { x: 40, y: 42, tx: null, ty: null, dir: 1, moving: false };
  W.input = { x: 0, y: 0 };
  W.combo = { n: 0, t: -9, acc: 0 };
  let nextId = 1, acc = { items: 0, money: 0, t: 0 }, sinceUnload = 0, fullSaid = false;

  /* ---------- Modificateurs ---------- */
  const gearDef = id => G.GEAR.find(g => g.id === id);
  W.gearEff = (s, id) => gearDef(id).eff(s.gear[id]);
  const sk = (s, id) => !!s.tree[id];
  const tl = (s, id) => s.tree[id] || 0;
  W.achCount = s => Object.keys(s.ach).length;
  const boost = s => (s.frenzy > 0 ? 2 : 1);
  W.globalMult = s => (1 + 0.05 * tl(s, 'tether')) * (1 + 0.04 * tl(s, 'sorting')) * (1 + G.CRYSTAL_BONUS * s.crystals) * (1 + G.ACH_BONUS * W.achCount(s));
  W.unitValue = s => G.UNIT_VALUE * G.planetValue(s.planet) * W.gearEff(s, 'ramp') * W.gearEff(s, 'sorting') * (sk(s, 'sorter') ? 1.5 : 1) * W.globalMult(s);
  W.tankCap = s => W.gearEff(s, 'tank') * (sk(s, 'pockets') ? 1.4 : 1);
  W.power = s => W.gearEff(s, 'power') * boost(s) * (1 + 0.1 * tl(s, 'harpoon'));
  W.nozzle = s => W.gearEff(s, 'nozzle') * (sk(s, 'broom') ? 1.4 : 1);
  W.walkSpeed = s => G.SPEED * W.gearEff(s, 'boots') * (sk(s, 'sprint') ? 1.25 : 1) * boost(s);
  W.contCap = (s, z) => (z === 'orbit' ? Math.round(W.gearEff(s, 'container') * 0.12) : Math.round(W.gearEff(s, 'container') * (1 + 0.1 * tl(s, 'driver'))));
  W.machSpeed = (s, t) => G.MACHINES[t].speed * W.gearEff(s, 'motors') * (sk(s, 'teamSpirit') ? 1.25 : 1) * (1 + 0.05 * tl(s, 'vests')) * boost(s);
  W.machTank = (s, t) => G.MACHINES[t].tank * W.gearEff(s, 'tanks') * (sk(s, 'carts') ? 1.3 : 1) * (1 + 0.1 * tl(s, 'net'));
  W.machRate = (s, t) => G.MACHINES[t].rate * W.gearEff(s, 'turbo') * boost(s);
  W.launchTime = s => G.LAUNCH_TIME * (1 - 0.15 * tl(s, 'laser'));
  W.goldChance = (s, z) => G.GOLD_CHANCE.orbit * (sk(s, 'lynx') ? 2 : 1) * (1 + 0.15 * tl(s, 'prospect'));
  W.wreckInterval = s => 70 / (1 + 0.2 * tl(s, 'radar'));
  W.offlineCap = s => (sk(s, 'allNighter') ? 12 : 6) * 3600;
  W.contValue = (s, z) => {
    if (z === 'ground') return Math.round(s.contG * W.unitValue(s) * (s.contG >= W.contCap(s, 'ground') ? G.FULL_BONUS : 1));
    let v = 0; for (const it of s.cont.orbit) v += W.itemValue(s, it); return Math.round(v * (s.cont.orbit.length >= W.contCap(s, 'orbit') ? G.FULL_BONUS : 1));
  };
  W.itemValue = (s, key) => { const gold = key.endsWith('*'); return G.JUNK[gold ? key.slice(0, -1) : key].value * (gold ? G.GOLD_VALUE : 1) * G.planetValue(s.planet) * W.gearEff(s, 'cannon') * (sk(s, 'orbitalShot') ? 1.5 : 1) * (1 + 0.08 * tl(s, 'magnetic')) * W.globalMult(s) * 6; };
  W.contLen = (s, z) => (z === 'ground' ? Math.floor(s.contG) : s.cont.orbit.length);

  /* ---------- Boutique ---------- */
  W.gearCost = (s, id) => { const g = gearDef(id); return Math.round(g.base * Math.pow(g.growth, s.gear[id])); };
  W.canGear = (s, id) => { const g = gearDef(id); return (g.sec !== 'ship' || s.ship) && (g.sec !== 'machines' || s.team.robot > 0) && s.gear[id] < g.max && s.money >= W.gearCost(s, id); };
  W.buyGear = (s, id) => { if (!W.canGear(s, id)) return false; s.money -= W.gearCost(s, id); s.gear[id]++; emit('buy', id); return true; };
  W.shipCost = s => Math.round(G.SHIP_COST * G.planetValue(s.planet));
  W.canShip = s => !s.ship && s.saved >= 1 && s.money >= W.shipCost(s);
  W.buyShip = s => { if (!W.canShip(s)) return false; s.money -= W.shipCost(s); s.ship = true; emit('ship'); return true; };
  const hireDef = id => G.HIRES.find(h => h.id === id);
  W.hireUnlocked = (s, id) => { const h = hireDef(id); return (!h.needShip || s.ship) && (!h.after || s.team[h.after] >= h.need); };
  W.hireCost = (s, id) => { const h = hireDef(id); return Math.round(h.base * Math.pow(h.growth, s.team[id]) * (sk(s, 'recruiter') ? 0.8 : 1)); };
  W.canHire = (s, id) => { const h = hireDef(id); return W.hireUnlocked(s, id) && s.team[id] < h.max && s.money >= W.hireCost(s, id); };
  W.hire = (s, id) => { if (!W.canHire(s, id)) return false; s.money -= W.hireCost(s, id); s.team[id]++; emit('hire', id); return true; };
  W.allMax = s => G.GEAR.every(g => g.sec === 'ship' || s.gear[g.id] >= g.max) && ['robot', 'launcher', 'dozer', 'crane'].every(id => s.team[id] >= hireDef(id).max);
  W.setOutfit = (s, id) => { if (s.outfits[id]) { s.outfit = id; emit('outfit', id); return true; } return false; };

  /* ---------- Le grand arbre ---------- */
  W.node = id => G.TREE.find(n => n.id === id);
  W.nodeCost = (s, n) => (n.type === 'tech' ? G.techCost(tl(s, n.id)) : n.cost);
  W.nodeState = (s, n) => {
    if (n.id === 'root') return 'owned';
    const lvl = s.tree[n.id] || 0, done = n.type === 'tech' ? lvl >= n.max : lvl > 0;
    if (done) return 'owned';
    if (!s.tree[n.parent]) return 'locked';
    return (n.type === 'tech' ? s.techPts : s.skillPts) >= W.nodeCost(s, n) ? 'can' : (lvl > 0 ? 'partial' : 'poor');
  };
  W.treeBuy = (s, id) => {
    const n = W.node(id); if (!n || W.nodeState(s, n) !== 'can') return false;
    const c = W.nodeCost(s, n); if (n.type === 'tech') s.techPts -= c; else s.skillPts -= c;
    s.tree[id] = (s.tree[id] || 0) + 1; emit('learn', id); return true;
  };

  /* ---------- Planètes, soleil, prestige ---------- */
  W.sunStage = s => { let k = 0; for (let i = 0; i < G.SUN.length; i++) if (s.sent >= G.SUN[i].at) k = i; return k; };
  W.planetInfo = (s, n = s.planet) => {
    const p = G.PLANETS[n % G.PLANETS.length], c = Math.floor(n / G.PLANETS.length), sfx = c ? ' ' + ['II', 'III', 'IV', 'V', 'VI', 'VII'][Math.min(5, c - 1)] : '';
    return Object.assign({}, p, { bad: p.bad + sfx, good: p.good + sfx, biome: P.BIOMES[n % P.BIOMES.length], needle: G.NEEDLES[n % G.NEEDLES.length] });
  };
  W.pollution = s => (W.pl ? clamp(W.pl.total / W.pl.initial, 0, 1) : 1);
  W.canJump = s => s.savedRun >= G.JUMP_REQ;
  W.jumpGain = s => (s.savedRun * (s.savedRun + 1)) / 2;
  W.jump = s => {
    if (!W.canJump(s)) return 0;
    const g = W.jumpGain(s), f = W.fresh();
    s.crystals += g; s.jumps++;
    for (const k of ['money', 'planet', 'savedRun', 'grid', 'needle', 'tank', 'contG', 'cont', 'hold', 'gear', 'ship', 'team', 'crew', 'frenzy', 'awaitingTravel', 'rate']) s[k] = f[k];
    s.view = 'ground'; W.reset(s, true); emit('jump', g);
    return g;
  };
  function checkClean(s) {
    if (s.awaitingTravel || !W.pl || W.pl.total / W.pl.initial > G.CLEAN_DONE) return;
    W.pl.trash.fill(0); W.pl.total = 0; W.dirty.add(-1);
    s.awaitingTravel = true; s.saved++; s.savedRun++; emit('cleaned', s.planet);
  }
  W.travel = s => {
    if (!s.awaitingTravel) return;
    s.planet++; s.awaitingTravel = false; s.needle = 'hidden';
    W.reset(s, true); emit('travel', s.planet);
  };

  /* ---------- Mise en place ---------- */
  W.reset = (s, fresh) => {
    W.pl = P.build(s.planet);
    if (!fresh && s.grid) { if (P.decode(W.pl, s.grid)) for (let i = 0; i < W.pl.gold.length; i++) if (W.pl.trash[i] <= 0) W.pl.gold[i] = 0; }
    W.pl.needle.state = s.needle;
    if (fresh) { s.grid = ''; s.needle = 'hidden'; }
    W.dirty.add(-1);
    W.mach = [];
    Object.assign(W.player, { x: P.START.x, y: P.START.y, tx: null, ty: null });
    W.Z.orbit = { items: [], launching: 0, agents: [], dump: 0, acc: 0 };
    for (let i = 0; i < 14; i++) spawnOrbit(s);
    Object.assign(W.ship, { x: 40, y: 42, tx: null, ty: null });
  };

  /* ---------- Commandes ---------- */
  W.goTo = (s, x, y) => {
    if (s.view === 'ground') { W.player.tx = clamp(x, 0.5, P.W - 0.5); W.player.ty = clamp(y, 0.5, P.H - 0.5); }
    else { const c = G.ZONES.orbit; W.ship.tx = clamp(x, 4, c.w - 4); W.ship.ty = clamp(y, c.top, c.bottom); }
  };
  W.launch = (s, z, auto) => {
    const zz = W.Z[z]; if (zz.launching > 0) return false;
    const n = W.contLen(s, z); if (!n) return false;
    const full = n >= W.contCap(s, z), money = W.contValue(s, z), kinds = z === 'orbit' ? s.cont.orbit.slice(0, 12) : [];
    s.money += money; s.moneyLife += money; s.launches++;
    const units = z === 'ground' ? s.contG : n * 30;
    s.sent += units; if (z === 'ground') s.contG = 0; else s.cont.orbit = [];
    zz.launching = W.launchTime(s);
    if (auto) { acc.items += units; acc.money += money; }
    gainXp(s, units);
    emit('launch', { z, n, money, full, kinds, auto });
    return true;
  };
  function gainXp(s, n) { s.xp += n; while (s.xp >= G.xpNeed(s.level)) { s.xp -= G.xpNeed(s.level); s.level++; s.skillPts++; emit('level', s.level); } }
  W.salvage = s => {
    s.wrecks++;
    const r = Math.random(); let res;
    if (r < 0.45) { const m = Math.round(Math.max(90 * s.rate.money, 60 * W.unitValue(s) * 10)); s.money += m; s.moneyLife += m; res = { type: 'cargo', money: m }; }
    else if (r < 0.8) { s.frenzy = 30; res = { type: 'frenzy', secs: 30 }; }
    else { s.techPts += 3; res = { type: 'goldRain' }; }
    emit('salvage', res); return res;
  };

  /* ---------- Le hippie et son aspirateur ---------- */
  function playerUpdate(s, dt) {
    const p = W.player, x0 = p.x, y0 = p.y, sp = W.walkSpeed(s);
    if (s.view === 'ground' && (W.input.x || W.input.y)) {
      p.tx = p.ty = null; const len = Math.hypot(W.input.x, W.input.y);
      p.x = clamp(p.x + W.input.x / len * sp * dt, 0.5, P.W - 0.5); p.y = clamp(p.y + W.input.y / len * sp * dt, 0.5, P.H - 0.5);
    } else if (p.tx != null) {
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d < 0.08) p.tx = p.ty = null; else { const st = Math.min(d, sp * dt); p.x += dx / d * st; p.y += dy / d * st; }
    }
    const mv = Math.hypot(p.x - x0, p.y - y0);
    p.moving = mv > 1e-4; if (p.moving) { if (Math.abs(p.x - x0) > 0.002) p.dir = p.x > x0 ? 1 : -1; p.walk += mv * 2.2; s.walked += mv; }
    p.sucking = Math.max(0, p.sucking - dt);
    const cap = W.tankCap(s);
    if (s.tank < cap - 0.01 && !s.awaitingTravel) {
      const r = P.suck(W.pl, p.x, p.y, W.nozzle(s), Math.min(cap - s.tank, W.power(s) * dt), W.dirty);
      if (r.got > 0) {
        s.tank += r.got; s.picked += r.got; p.sucking = 0.15;
        W.combo.acc += r.got; W.combo.t = s.playTime;
        while (W.combo.acc >= G.COMBO_STEP) { W.combo.acc -= G.COMBO_STEP; if (W.combo.n < G.COMBO_MAX) { W.combo.n++; if (W.combo.n > s.maxCombo) s.maxCombo = W.combo.n; emit('combo', W.combo.n); } }
        const cash = r.got * W.unitValue(s) * G.COMBO_CASH * Math.max(1, W.combo.n); s.money += cash; s.moneyLife += cash;
        emit('suck', { cells: r.cells, got: r.got });
        if (r.gold) gainGold(s, r.gold, 'me');
        if (s.tank >= cap - 0.01 && !fullSaid) { fullSaid = true; emit('full', 'ground'); }
      }
    }
    if (s.tank < cap - 0.01) fullSaid = false;
    if (W.combo.n && s.playTime - W.combo.t > G.COMBO_WINDOW) { W.combo.n = 0; W.combo.acc = 0; emit('comboEnd'); }
    const nd = W.pl.needle;
    if (nd.state === 'hidden' && P.needleOpen(W.pl)) { nd.state = s.needle = 'visible'; emit('needleSeen'); }
    if (nd.state === 'visible' && Math.hypot(p.x - (nd.cx + 0.5) / P.CPT, p.y - (nd.cy + 0.5) / P.CPT) < 0.9) {
      nd.state = s.needle = 'taken'; s.needles++;
      const cash = Math.round(Math.max(500 * G.planetValue(s.planet), G.NEEDLE_CASH * s.rate.money)); s.money += cash; s.moneyLife += cash; s.techPts += 5;
      emit('needle', { cash, item: G.NEEDLES[s.planet % G.NEEDLES.length] });
    }
    if (Math.hypot(p.x - P.DEPOT.x, p.y - P.DEPOT.y) < 2.4 && s.tank > 0) unload(s, 'me', dt);
  }
  function gainGold(s, n, who) { s.techPts += n * G.GOLD_POINTS; s.goldLife += n; emit('gold', { n, who }); }
  function unload(s, who, dt, m) {
    const room = W.contCap(s, 'ground') - s.contG; if (room <= 0) return false;
    const load = who === 'me' ? s.tank : m.load, amt = Math.min(load, room, dt * (who === 'me' ? 400 : 300));
    if (amt <= 0) return false;
    s.contG += amt; sinceUnload = 0;
    if (who === 'me') { s.tank -= amt; if (s.tank < 0.01) { s.tank = 0; s.dumped++; } } else m.load -= amt;
    emit('dump', { who, amt });
    if (s.contG >= W.contCap(s, 'ground') - 0.01) emit('contFull', 'ground');
    return true;
  }

  /* ---------- Machines ---------- */
  function syncMach(s) {
    for (const t of ['robot', 'dozer', 'crane']) {
      const list = W.mach.filter(m => m.type === t), want = s.team[t];
      for (let i = list.length; i < want; i++) W.mach.push({ type: t, id: nextId++, x: P.DEPOT.x + rnd(-2, 2), y: P.DEPOT.y + rnd(1.5, 2.5), tx: null, ty: null, load: 0, state: 'work', timer: rnd(0, 3), dir: 1, ang: 0, lift: 0 });
    }
  }
  function runMach(s, dt) {
    const pl = W.pl;
    for (const m of W.mach) {
      const spec = G.MACHINES[m.type], tank = W.machTank(s, m.type), sp = W.machSpeed(s, m.type);
      m.lift = Math.max(0, m.lift - dt);
      if (m.state === 'home') {
        const dx = P.DEPOT.x - m.x, dy = P.DEPOT.y + 1.6 - m.y, d = Math.hypot(dx, dy);
        if (d > 1.6) { m.x += dx / d * sp * dt; m.y += dy / d * sp * dt; m.ang = Math.atan2(dy, dx); }
        else { unload(s, 'mach', dt, m); if (m.load <= 0.01) { m.load = 0; m.state = 'work'; m.tx = null; } }
        continue;
      }
      if (s.awaitingTravel) { if (m.load > 0) m.state = 'home'; continue; }
      if (m.type === 'crane') {
        m.timer -= dt;
        if (m.tx == null || m.timer <= 0) { const t = P.findDense(pl, m.x, m.y, 14, 40); if (t) { m.tx = t.x; m.ty = t.y; } m.timer = spec.every / W.gearEff(s, 'turbo'); }
        if (m.tx != null) {
          const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
          if (d > 1) { m.x += dx / d * sp * dt; m.y += dy / d * sp * dt; m.ang = Math.atan2(dy, dx); }
          else if (m.lift <= 0) {
            const r = P.suck(pl, m.tx, m.ty, spec.rad, tank, W.dirty);
            if (r.gold) gainGold(s, r.gold, 'mach');
            if (r.got > 0) { m.lift = 1.2; const room = W.contCap(s, 'ground') - s.contG, put = Math.min(room, r.got); s.contG += put; m.load += r.got - put; if (m.load > 0) m.state = 'home'; emit('crane', { x: m.tx, y: m.ty, got: r.got }); sinceUnload = 0; }
            m.tx = null;
          }
        }
        continue;
      }
      if (m.load >= tank - 0.01) { m.state = 'home'; continue; }
      if (m.tx == null || P.amountAt(pl, m.tx, m.ty) < 0.15) { const t = P.findDense(pl, m.x, m.y, m.type === 'dozer' ? 18 : 10); if (t) { m.tx = t.x; m.ty = t.y; } else { m.tx = rnd(2, P.W - 2); m.ty = rnd(2, P.H - 2); } }
      const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
      if (d > 0.3) { const st = Math.min(d, sp * dt); m.x += dx / d * st; m.y += dy / d * st; m.ang = Math.atan2(dy, dx); if (Math.abs(dx) > 0.01) m.dir = dx > 0 ? 1 : -1; }
      const r = P.suck(pl, m.x, m.y, spec.rad, Math.min(tank - m.load, W.machRate(s, m.type) * dt), W.dirty);
      m.load += r.got; if (r.gold) gainGold(s, r.gold, 'mach');
    }
  }

  /* ---------- Orbite (vue de côté) ---------- */
  function pick(table) { let t = 0; for (const [, w] of table) t += w; let r = Math.random() * t; for (const [k, w] of table) { r -= w; if (r <= 0) return k; } return table[0][0]; }
  function spawnOrbit(s) { const c = G.ZONES.orbit; W.Z.orbit.items.push({ id: nextId++, kind: pick(G.ORBIT_JUNK), gold: Math.random() < W.goldChance(s, 'orbit'), x: c.spawnMin + (c.w - 6 - c.spawnMin) * Math.random(), y: rnd(c.top + 1.5, c.bottom - 1), a: rnd(-0.6, 0.6), va: rnd(-0.5, 0.5), born: performance.now() }); }
  W.holdCap = s => W.gearEff(s, 'hold') * (sk(s, 'doubleHold') ? 2 : 1);
  W.shipSpeed = s => G.SHIP_SPEED * W.gearEff(s, 'thrust') * (sk(s, 'reactors') ? 1.25 : 1) * (1 + 0.08 * tl(s, 'ion')) * boost(s);
  W.shipReach = s => W.gearEff(s, 'tractor') * (sk(s, 'debrisMagnet') ? 2 : 1) * (1 + 0.1 * tl(s, 'harpoon'));
  W.pilotCap = s => 5 + tl(s, 'arm');
  W.pilotSpeed = s => G.PILOT_SPEED * (sk(s, 'trainedPilots') ? 1.3 : 1) * (1 + 0.08 * tl(s, 'ion')) * (1 + 0.04 * (s.crew.orbit.lvl - 1)) * boost(s);
  function takeOrbit(s, it, who) {
    const zz = W.Z.orbit; zz.items.splice(zz.items.indexOf(it), 1);
    const key = it.kind + (it.gold ? '*' : '');
    if (it.gold) gainGold(s, Math.random() < 0.15 ? 3 : 1, who);
    if (who === 'me') s.orbitPicked++;
    emit('pickup', { it, who, z: 'orbit' }); return key;
  }
  function orbitDump(s, load, dt, who) {
    const zz = W.Z.orbit, cap = W.contCap(s, 'orbit');
    if ((zz.launching > 0 && zz.launching > W.launchTime(s) - 0.8) || !load.length) return;
    zz.dump -= dt;
    while (zz.dump <= 0 && load.length && s.cont.orbit.length < cap) { s.cont.orbit.push(load.pop()); zz.dump += who === 'me' ? 0.05 : 0.02; emit('dump', { z: 'orbit', who }); }
    if (zz.dump < -0.2) zz.dump = 0;
  }
  function runOrbit(s, dt) {
    const c = G.ZONES.orbit, o = W.Z.orbit, sh = W.ship, sp = W.shipSpeed(s);
    o.acc += G.ORBIT_SPAWN * dt; while (o.acc >= 1) { o.acc -= 1; if (o.items.length < c.visible) spawnOrbit(s); }
    let vx = 0, vy = 0;
    if (s.view === 'orbit' && (W.input.x || W.input.y)) { sh.tx = sh.ty = null; const len = Math.hypot(W.input.x, W.input.y); vx = W.input.x / len; vy = W.input.y / len; }
    else if (sh.tx != null) { const dx = sh.tx - sh.x, dy = sh.ty - sh.y, d = Math.hypot(dx, dy); if (d < 0.6) sh.tx = sh.ty = null; else { vx = dx / d; vy = dy / d; } }
    sh.moving = !!(vx || vy);
    if (sh.moving) { sh.x = clamp(sh.x + vx * sp * dt, 4, c.w - 4); sh.y = clamp(sh.y + vy * sp * dt, c.top, c.bottom); if (Math.abs(vx) > 0.05) sh.dir = vx > 0 ? 1 : -1; }
    const cap = W.holdCap(s), reach = W.shipReach(s);
    for (let i = o.items.length - 1; i >= 0 && s.hold.length < cap; i--) {
      const it = o.items[i], dx = sh.x - it.x, dy = sh.y - it.y, d = Math.hypot(dx, dy);
      if (d > reach && d <= reach * 2.2) { const st = Math.min(d - reach * 0.6, 30 * dt) / d; it.x += dx * st; it.y += dy * st; }
      if (d <= reach) { s.hold.push(takeOrbit(s, it, 'me')); if (s.hold.length >= cap) emit('full', 'orbit'); }
    }
    if (Math.hypot(sh.x - c.base, sh.y - c.baseY) < 9) orbitDump(s, s.hold, dt, 'me');
    while (o.agents.length < Math.min(s.team.pilot, 20)) o.agents.push({ x: c.base + rnd(-3, 3), y: rnd(30, 60), load: [], state: 'seek', target: null, dir: 1, hue: o.agents.length });
    while (o.agents.length > s.team.pilot) o.agents.pop();
    const pcap = W.pilotCap(s), psp = W.pilotSpeed(s), crew = s.crew.orbit;
    for (const a of o.agents) {
      if (a.state === 'seek') {
        if (a.load.length >= pcap || (!o.items.length && a.load.length)) { a.state = 'return'; if (a.target) a.target.claim = null; a.target = null; continue; }
        if (!a.target || o.items.indexOf(a.target) < 0) { let best = null, bd = 1e9; for (const it of o.items) { if (it.claim && it.claim !== a) continue; const d = Math.abs(it.x - a.x) + Math.abs(it.y - a.y); if (d < bd) { bd = d; best = it; } } a.target = best; if (best) best.claim = a; }
        const t = a.target; if (!t) continue;
        const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy);
        if (d < 1.3) { a.load.push(takeOrbit(s, t, 'crew')); a.target = null; crew.xp++; if (crew.xp >= G.empXpNeed(crew.lvl)) { crew.xp = 0; crew.lvl++; } }
        else { a.x += dx / d * psp * dt; a.y += dy / d * psp * dt; a.dir = dx > 0 ? 1 : -1; }
      } else {
        const dx = c.base + 2 - a.x, dy = c.baseY - a.y, d = Math.hypot(dx, dy);
        if (d > 2.5) { a.x += dx / d * psp * dt; a.y += dy / d * psp * dt; a.dir = dx > 0 ? 1 : -1; } else { orbitDump(s, a.load, dt, 'crew'); if (!a.load.length) a.state = 'seek'; }
      }
    }
    if (s.team.gunner && s.cont.orbit.length && (s.cont.orbit.length >= W.contCap(s, 'orbit') || s.playTime % 6 < dt)) W.launch(s, 'orbit', true);
  }

  /* ---------- Mise à jour ---------- */
  W.update = (s, dt) => {
    s.playTime += dt; sinceUnload += dt;
    if (s.frenzy > 0) s.frenzy = Math.max(0, s.frenzy - dt);
    for (const z of ['ground', 'orbit']) if (W.Z[z].launching > 0) W.Z[z].launching = Math.max(0, W.Z[z].launching - dt);
    playerUpdate(s, dt);
    syncMach(s); runMach(s, dt);
    if (s.team.launcher && s.contG >= 1 && W.Z.ground.launching <= 0) {
      const cap = W.contCap(s, 'ground');
      if (s.contG >= cap * (sk(s, 'proDriver') ? 0.5 : 0.98) || sinceUnload > 5) W.launch(s, 'ground', true);
    }
    if (s.ship) runOrbit(s, dt);
    W.checkMission(s);
    acc.t += dt;
    if (acc.t >= 5) { s.rate.items = s.rate.items * 0.7 + 0.3 * acc.items / acc.t; s.rate.money = s.rate.money * 0.7 + 0.3 * acc.money / acc.t; acc = { items: 0, money: 0, t: 0 }; }
    checkClean(s);
  };

  /* ---------- Hors ligne : les machines continuent au rythme mesuré ---------- */
  W.offline = (s, secs) => {
    if (!(s.rate.items > 0) || s.awaitingTravel || !W.pl) return null;
    const t = Math.min(secs, W.offlineCap(s)), n = Math.min(s.rate.items * t, W.pl.total);
    const f = 1 - n / W.pl.total; for (let i = 0; i < W.pl.trash.length; i++) W.pl.trash[i] *= f;
    W.pl.total -= n; W.dirty.add(-1);
    const money = Math.round(n * s.rate.money / s.rate.items);
    s.money += money; s.moneyLife += money; s.sent += n; gainXp(s, n);
    checkClean(s);
    return { secs, n: Math.round(n), money, stop: s.awaitingTravel };
  };

  /* ---------- Missions et succès ---------- */
  W.mission = s => { const m = G.MISSIONS[s.mission]; return m ? { id: m.id, val: Math.min(m.need, m.val(s)), need: m.need, cash: Math.round(m.cash * G.planetValue(s.planet)) } : null; };
  W.checkMission = s => {
    const m = G.MISSIONS[s.mission]; if (!m || m.val(s) < m.need) return;
    const cash = Math.round(m.cash * G.planetValue(s.planet)); s.money += cash; s.moneyLife += cash; s.mission++;
    emit('mission', { id: m.id, cash });
  };
  W.checkAch = s => {
    const h = new Date().getHours(); if (h >= 2 && h < 5) s.insomniac = true;
    for (const a of G.ACHIEVEMENTS) if (!s.ach[a.id] && a.ok(s)) { s.ach[a.id] = Date.now(); if (a.outfit) s.outfits[a.outfit] = true; emit('ach', a.id); }
  };

  /* ---------- Sauvegarde ---------- */
  W.save = s => { s.last = Date.now(); if (W.pl) s.grid = P.encode(W.pl); try { localStorage.setItem(G.SAVE_KEY, JSON.stringify(s)); return true; } catch (e) { return false; } };
  W.revive = o => {
    if (!o || typeof o !== 'object') return null;
    const s = W.fresh();
    if (o.v !== 5) return s;
    for (const k of Object.keys(s)) if (o[k] !== undefined && typeof o[k] === typeof s[k] && (typeof s[k] !== 'object' || s[k] === null)) s[k] = o[k];
    for (const k of ['cont', 'gear', 'team', 'crew', 'tree', 'ach', 'rate', 'settings', 'outfits']) if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) s[k] = Object.assign(s[k], o[k]);
    if (Array.isArray(o.hold)) s.hold = o.hold;
    if (!Array.isArray(s.cont.orbit)) s.cont.orbit = [];
    s.tree.root = 1;
    return s;
  };
  W.load = () => {
    try {
      const raw = localStorage.getItem(G.SAVE_KEY); if (raw) return W.revive(JSON.parse(raw));
      const old = localStorage.getItem('feedthesun.v3.save'); if (old) { const o = JSON.parse(old), s = W.fresh(); if (o && o.settings) Object.assign(s.settings, o.settings); return s; }
      return null;
    } catch (e) { return null; }
  };
  W.wipe = () => { try { localStorage.removeItem(G.SAVE_KEY); } catch (e) { /* stockage indisponible */ } };
})();
