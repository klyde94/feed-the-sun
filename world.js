'use strict';
/* Feed the Sun v3 — moteur : ville (vue de dessus), orbite, employés, économie, arbre, missions, sauvegarde. */
(function () {
  const G = window.FTS3, C = G.CITY;
  const W = (G.W = {});
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const L = {};
  W.on = (type, fn) => { (L[type] = L[type] || []).push(fn); };
  const emit = (type, data) => { if (!W.mute) (L[type] || []).forEach(fn => fn(data)); };
  const DIST = C.DISTRICTS.map(d => d.id);

  /* ---------- État sauvegardé ---------- */
  W.fresh = () => ({
    v: 4, money: 0, moneyLife: 0, sent: 0, planet: 0, saved: 0, savedRun: 0, jumps: 0, crystals: 0,
    pollution: G.planetPollution(0), districts: { centre: true },
    cont: { ground: [], orbit: [] }, bag: [], hold: [],
    gear: Object.fromEntries(G.GEAR.map(g => [g.id, 0])), ship: false,
    team: { collector: 0, operator: 0, pilot: 0, gunner: 0 }, teamUps: { trolleys: 0, training: 0 },
    crew: { ground: { xp: 0, lvl: 1 }, orbit: { xp: 0, lvl: 1 } },
    xp: 0, level: 1, skillPts: 0, techPts: 0, tree: { root: 1 }, goldLife: 0, wrecks: 0, ach: {},
    picked: 0, dumped: 0, launches: 0, orbitPicked: 0, mission: 0,
    walked: 0, fridges: 0, maxCombo: 0, fullLaunches: 0, insomniac: false, outfit: 'helmet', outfits: { helmet: true },
    frenzy: 0, awaitingTravel: false, seenOrbit: false, playTime: 0, view: 'ground',
    rate: { items: 0, money: 0 }, settings: { lang: null, sound: true }, last: Date.now(),
  });

  /* ---------- Monde en mémoire ---------- */
  W.city = null;
  W.Z = { ground: { items: [], launching: 0, agents: [], dump: 0, acc: 0 }, orbit: { items: [], launching: 0, agents: [], dump: 0, acc: 0 } };
  W.player = { x: C.START.x, y: C.START.y, path: null, dir: 1, walk: 0, moving: false };
  W.ship = { x: 40, y: 42, tx: null, ty: null, dir: 1, moving: false };
  W.input = { x: 0, y: 0 };
  W.combo = { n: 0, t: -9 };
  let nextId = 1, acc = { items: 0, money: 0, t: 0 }, pathBudget = 0;

  /* ---------- Modificateurs ---------- */
  const gearDef = id => G.GEAR.find(g => g.id === id);
  W.gearEff = (s, id) => gearDef(id).eff(s.gear[id]);
  const sk = (s, id) => !!s.tree[id];
  const tl = (s, id) => s.tree[id] || 0;
  W.achCount = s => Object.keys(s.ach).length;
  W.globalMult = s => (1 + 0.05 * tl(s, 'tether')) * (1 + 0.04 * tl(s, 'sorting')) * (1 + G.CRYSTAL_BONUS * s.crystals) * (1 + G.ACH_BONUS * W.achCount(s));
  W.zoneMult = (s, z) => z === 'ground' ? W.gearEff(s, 'ramp') * W.gearEff(s, 'sorting') * (sk(s, 'sorter') ? 1.5 : 1)
    : W.gearEff(s, 'cannon') * (sk(s, 'orbitalShot') ? 1.5 : 1) * (1 + 0.08 * tl(s, 'magnetic'));
  W.itemValue = (s, z, key) => { const gold = key.endsWith('*'); return G.JUNK[gold ? key.slice(0, -1) : key].value * (gold ? G.GOLD_VALUE : 1) * G.planetValue(s.planet) * W.zoneMult(s, z) * W.globalMult(s); };
  W.bagCap = s => W.gearEff(s, 'bag') + (sk(s, 'pockets') ? 4 : 0);
  W.holdCap = s => W.gearEff(s, 'hold') * (sk(s, 'doubleHold') ? 2 : 1);
  W.contCap = (s, z) => { const c = W.gearEff(s, 'container') * (1 + 0.1 * tl(s, 'driver')); return Math.round(z === 'orbit' ? c * 0.6 : c); };
  const boost = s => (s.frenzy > 0 ? 2 : 1);
  W.walkSpeed = s => G.SPEED * W.gearEff(s, 'boots') * (sk(s, 'sprint') ? 1.25 : 1) * boost(s);
  W.shipSpeed = s => G.SHIP_SPEED * W.gearEff(s, 'thrust') * (sk(s, 'reactors') ? 1.25 : 1) * (1 + 0.08 * tl(s, 'ion')) * boost(s);
  W.reach = s => W.gearEff(s, 'magnet') * (sk(s, 'broom') ? 2 : 1) * (1 + 0.1 * tl(s, 'harpoon'));
  W.shipReach = s => W.gearEff(s, 'tractor') * (sk(s, 'debrisMagnet') ? 2 : 1) * (1 + 0.1 * tl(s, 'harpoon'));
  const teamSpeed = s => (1 + 0.06 * s.teamUps.training) * (sk(s, 'teamSpirit') ? 1.25 : 1) * boost(s);
  W.empCap = s => 5 + s.teamUps.trolleys + (sk(s, 'carts') ? 2 : 0) + tl(s, 'net');
  W.pilotCap = s => 5 + s.teamUps.trolleys + tl(s, 'arm');
  W.empSpeed = s => G.EMP_SPEED * teamSpeed(s) * (1 + 0.04 * tl(s, 'vests')) * (1 + 0.02 * (s.crew.ground.lvl - 1));
  W.pilotSpeed = s => G.PILOT_SPEED * teamSpeed(s) * (sk(s, 'trainedPilots') ? 1.3 : 1) * (1 + 0.08 * tl(s, 'ion')) * (1 + 0.04 * (s.crew.orbit.lvl - 1));
  W.launchTime = s => G.LAUNCH_TIME * (1 - 0.15 * tl(s, 'laser'));
  W.goldChance = (s, z) => G.GOLD_CHANCE[z] * (sk(s, 'lynx') ? 2 : 1) * (1 + 0.15 * tl(s, 'prospect'));
  W.wreckInterval = s => 70 / (1 + 0.2 * tl(s, 'radar'));
  W.offlineCap = s => (sk(s, 'allNighter') ? 12 : 6) * 3600;
  W.spawnRate = s => { let r = 0; for (const d of DIST) if (s.districts[d]) r += G.DISTRICT_SPAWN[d]; return G.SPAWN_BASE * r * W.gearEff(s, 'bins'); };
  W.mapCap = s => { let n = 0; C.DISTRICTS.forEach((d, i) => { if (s.districts[d.id] && W.city) n += Math.round(W.city.spawns[i].length * G.MAP_FILL); }); return Math.max(20, n); };
  W.allMax = s => G.GEAR.every(g => g.sec === 'ship' || s.gear[g.id] >= g.max) && DIST.every(d => s.districts[d]) && s.team.collector >= G.HIRES[0].max && s.team.operator >= 1 && G.TEAM_UPS.every(u => s.teamUps[u.id] >= u.max);
  W.setOutfit = (s, id) => { if (s.outfits[id]) { s.outfit = id; emit('outfit', id); return true; } return false; };
  W.contValue = (s, z) => { let v = 0; for (const it of s.cont[z]) v += W.itemValue(s, z, it); return Math.round(v * (s.cont[z].length >= W.contCap(s, z) ? G.FULL_BONUS : 1)); };

  /* ---------- Boutique ---------- */
  W.gearCost = (s, id) => { const g = gearDef(id); return Math.round(g.base * Math.pow(g.growth, s.gear[id])); };
  W.canGear = (s, id) => { const g = gearDef(id); return (g.sec !== 'ship' || s.ship) && s.gear[id] < g.max && s.money >= W.gearCost(s, id); };
  W.buyGear = (s, id) => { if (!W.canGear(s, id)) return false; s.money -= W.gearCost(s, id); s.gear[id]++; emit('buy', id); return true; };
  W.shipCost = s => Math.round(G.SHIP_COST * G.planetValue(s.planet));
  W.canShip = s => !s.ship && s.saved >= 1 && s.money >= W.shipCost(s);
  W.buyShip = s => { if (!W.canShip(s)) return false; s.money -= W.shipCost(s); s.ship = true; emit('ship'); return true; };
  W.districtCost = (s, id) => Math.round(G.DISTRICT_COST[id] * G.planetValue(s.planet));
  W.canDistrict = (s, id) => !s.districts[id] && s.money >= W.districtCost(s, id);
  W.openDistrict = (s, id) => { if (!W.canDistrict(s, id)) return false; s.money -= W.districtCost(s, id); s.districts[id] = true; emit('district', id); return true; };
  const hireDef = id => G.HIRES.find(h => h.id === id);
  W.hireCost = (s, id) => { const h = hireDef(id); return Math.round(h.base * Math.pow(h.growth, s.team[id]) * (sk(s, 'recruiter') ? 0.8 : 1)); };
  W.canHire = (s, id) => { const h = hireDef(id); return (!h.needShip || s.ship) && s.team[id] < h.max && s.money >= W.hireCost(s, id); };
  W.hire = (s, id) => { if (!W.canHire(s, id)) return false; s.money -= W.hireCost(s, id); s.team[id]++; emit('hire', id); return true; };
  const tupDef = id => G.TEAM_UPS.find(u => u.id === id);
  W.tupCost = (s, id) => { const u = tupDef(id); return Math.round(u.base * Math.pow(u.growth, s.teamUps[id])); };
  W.canTup = (s, id) => s.teamUps[id] < tupDef(id).max && s.money >= W.tupCost(s, id);
  W.buyTup = (s, id) => { if (!W.canTup(s, id)) return false; s.money -= W.tupCost(s, id); s.teamUps[id]++; emit('buy', id); return true; };

  /* ---------- Le grand arbre ---------- */
  W.node = id => G.TREE.find(n => n.id === id);
  W.nodeCost = (s, n) => (n.type === 'tech' ? G.techCost(tl(s, n.id)) : n.cost);
  W.nodeState = (s, n) => {
    if (n.id === 'root') return 'owned';
    const lvl = s.tree[n.id] || 0, done = n.type === 'tech' ? lvl >= n.max : lvl > 0;
    if (done) return 'owned';
    if (!s.tree[n.parent]) return 'locked';
    const pts = n.type === 'tech' ? s.techPts : s.skillPts;
    return pts >= W.nodeCost(s, n) ? 'can' : (lvl > 0 ? 'partial' : 'poor');
  };
  W.treeBuy = (s, id) => {
    const n = W.node(id); if (!n || W.nodeState(s, n) !== 'can') return false;
    const c = W.nodeCost(s, n);
    if (n.type === 'tech') s.techPts -= c; else s.skillPts -= c;
    s.tree[id] = (s.tree[id] || 0) + 1; emit('learn', id); return true;
  };

  /* ---------- Planètes, soleil, prestige ---------- */
  W.sunStage = s => { let k = 0; for (let i = 0; i < G.SUN.length; i++) if (s.sent >= G.SUN[i].at) k = i; return k; };
  W.planetInfo = (s, n = s.planet) => {
    const p = G.PLANETS[n % G.PLANETS.length], c = Math.floor(n / G.PLANETS.length), sfx = c ? ' ' + ['II', 'III', 'IV', 'V', 'VI', 'VII'][Math.min(5, c - 1)] : '';
    return Object.assign({}, p, { bad: p.bad + sfx, good: p.good + sfx });
  };
  W.pollution = s => clamp(s.pollution / G.planetPollution(s.planet), 0, 1);
  W.canJump = s => s.savedRun >= G.JUMP_REQ;
  W.jumpGain = s => (s.savedRun * (s.savedRun + 1)) / 2;
  W.jump = s => {
    if (!W.canJump(s)) return 0;
    const g = W.jumpGain(s), f = W.fresh();
    s.crystals += g; s.jumps++;
    for (const k of ['money', 'planet', 'savedRun', 'pollution', 'districts', 'cont', 'bag', 'hold', 'gear', 'ship', 'team', 'teamUps', 'crew', 'frenzy', 'awaitingTravel', 'rate']) s[k] = f[k];
    s.view = 'ground'; W.reset(s); emit('jump', g);
    return g;
  };
  function checkClean(s) {
    if (!s.awaitingTravel && s.pollution <= 0) { s.pollution = 0; s.awaitingTravel = true; s.saved++; s.savedRun++; emit('cleaned', s.planet); }
  }
  W.travel = s => {
    if (!s.awaitingTravel) return;
    s.planet++; s.pollution = G.planetPollution(s.planet); s.districts = { centre: true }; s.awaitingTravel = false;
    W.reset(s); emit('travel', s.planet);
  };

  /* ---------- Déchets ---------- */
  function pick(table) { let t = 0; for (const [, w] of table) t += w; let r = Math.random() * t; for (const [k, w] of table) { r -= w; if (r <= 0) return k; } return table[0][0]; }
  function spawnGround(s) {
    const p = C.spawnTile(W.city, s); if (!p) return;
    const d = C.DISTRICTS[C.districtAt(p.x, p.y)].id;
    W.Z.ground.items.push({ id: nextId++, kind: pick(G.DISTRICT_JUNK[d]), gold: Math.random() < W.goldChance(s, 'ground'), x: p.x + rnd(0.2, 0.8), y: p.y + rnd(0.2, 0.8), a: rnd(-0.6, 0.6), born: performance.now() });
  }
  function spawnOrbit(s) {
    const c = G.ZONES.orbit;
    W.Z.orbit.items.push({ id: nextId++, kind: pick(G.ORBIT_JUNK), gold: Math.random() < W.goldChance(s, 'orbit'), x: c.spawnMin + (c.w - 6 - c.spawnMin) * Math.random(), y: rnd(c.top + 1.5, c.bottom - 1), a: rnd(-0.6, 0.6), va: rnd(-0.5, 0.5), born: performance.now() });
  }
  W.reset = s => {
    W.city = C.build(s.planet + 1);
    for (const z of ['ground', 'orbit']) Object.assign(W.Z[z], { items: [], launching: 0, agents: [], dump: 0, acc: 0 });
    for (let i = 0; i < 40; i++) spawnGround(s);
    for (let i = 0; i < 14; i++) spawnOrbit(s);
    Object.assign(W.player, { x: C.START.x, y: C.START.y, path: null });
    Object.assign(W.ship, { x: 40, y: 42, tx: null, ty: null });
  };
  function take(s, z, it, who) {
    const zz = W.Z[z]; zz.items.splice(zz.items.indexOf(it), 1);
    if (it.claim) { it.claim.target = null; it.claim.path = null; }
    const key = it.kind + (it.gold ? '*' : '');
    if (it.gold) { const n = Math.random() < 0.15 ? 3 : 1; s.techPts += n; s.goldLife++; emit('gold', { n, who, z }); }
    let cash = 0;
    if (who === 'me') {
      W.combo.n = s.playTime - W.combo.t <= G.COMBO_WINDOW ? Math.min(G.COMBO_MAX, W.combo.n + 1) : 1; W.combo.t = s.playTime;
      cash = W.itemValue(s, z, key) * G.COMBO_CASH * W.combo.n; s.money += cash; s.moneyLife += cash; if (W.combo.n > s.maxCombo) s.maxCombo = W.combo.n;
      if (z === 'ground') s.picked++; else s.orbitPicked++;
    }
    emit('pickup', { it, who, z, cash, combo: who === 'me' ? W.combo.n : 0 });
    return key;
  }

  /* ---------- Commandes ---------- */
  W.goTo = (s, x, y) => {
    if (s.view === 'ground') W.player.path = C.path(W.city, s, W.player.x, W.player.y, x, y);
    else { const c = G.ZONES.orbit; W.ship.tx = clamp(x, 4, c.w - 4); W.ship.ty = clamp(y, c.top, c.bottom); }
  };
  W.launch = (s, z, auto) => {
    const zz = W.Z[z], cont = s.cont[z];
    if (!cont.length || zz.launching > 0) return false;
    const n = cont.length, full = n >= W.contCap(s, z), money = W.contValue(s, z), kinds = cont.slice(0, 12);
    for (const k of cont) if (k === 'fridge' || k === 'fridge*') s.fridges++;
    if (full) s.fullLaunches++;
    s.money += money; s.moneyLife += money; s.sent += n; s.launches++; s.cont[z] = [];
    s.pollution -= n * (z === 'orbit' ? 2 : 1);
    zz.launching = W.launchTime(s);
    if (auto) { acc.items += n; acc.money += money; }
    gainXp(s, n);
    emit('launch', { z, n, money, full, kinds, auto });
    checkClean(s);
    return true;
  };
  function gainXp(s, n) {
    s.xp += n;
    while (s.xp >= G.xpNeed(s.level)) { s.xp -= G.xpNeed(s.level); s.level++; s.skillPts++; emit('level', s.level); }
  }
  W.salvage = s => {
    s.wrecks++;
    const r = Math.random(); let res;
    if (r < 0.45) { const m = Math.round(Math.max(90 * s.rate.money, 40 * G.planetValue(s.planet) * W.globalMult(s))); s.money += m; s.moneyLife += m; res = { type: 'cargo', money: m }; }
    else if (r < 0.8) { s.frenzy = 30; res = { type: 'frenzy', secs: 30 }; }
    else { s.techPts += 3; res = { type: 'goldRain' }; }
    emit('salvage', res); return res;
  };

  /* ---------- Déplacements dans la ville ---------- */
  function walkStep(m, speed, dt) {
    const ox = m.x, oy = m.y;
    if (m.path && m.path.length) {
      const p = m.path[0], dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy), st = speed * dt;
      if (d <= st) { m.x = p.x; m.y = p.y; m.path.shift(); } else { m.x += dx / d * st; m.y += dy / d * st; }
      if (!m.path.length) m.path = null;
    }
    const mx = m.x - ox, my = m.y - oy;
    m.moving = Math.abs(mx) + Math.abs(my) > 1e-4;
    if (m.moving) { if (Math.abs(mx) > 0.002) m.dir = mx > 0 ? 1 : -1; m.walk = (m.walk || 0) + Math.hypot(mx, my) * 2.2; }
  }
  function playerMove(s, dt) {
    const p = W.player, x0 = p.x, y0 = p.y;
    movePlayer(s, dt);
    s.walked += Math.hypot(p.x - x0, p.y - y0);
  }
  function movePlayer(s, dt) {
    const p = W.player, sp = W.walkSpeed(s);
    if (s.view === 'ground' && (W.input.x || W.input.y)) {
      p.path = null;
      const len = Math.hypot(W.input.x, W.input.y), vx = W.input.x / len * sp * dt, vy = W.input.y / len * sp * dt;
      const ox = p.x, oy = p.y;
      if (C.freeAt(W.city, s, p.x + vx, p.y)) p.x += vx;
      if (C.freeAt(W.city, s, p.x, p.y + vy)) p.y += vy;
      p.moving = p.x !== ox || p.y !== oy;
      if (Math.abs(vx) > 0.001) p.dir = vx > 0 ? 1 : -1;
      if (p.moving) p.walk += Math.hypot(p.x - ox, p.y - oy) * 2.2;
    } else walkStep(p, sp, dt);
  }
  function collectGround(s, dt) {
    const p = W.player, items = W.Z.ground.items, cap = W.bagCap(s), reach = W.reach(s);
    for (let i = items.length - 1; i >= 0 && s.bag.length < cap; i--) {
      const it = items[i], dx = p.x - it.x, dy = p.y - it.y, d = Math.hypot(dx, dy);
      if (d > reach && d <= reach * G.PULL) { const st = Math.min(d - reach * 0.6, 5 * dt) / d; it.x += dx * st; it.y += dy * st; }
      if (d <= reach) { s.bag.push(take(s, 'ground', it, 'me')); if (s.bag.length >= cap) emit('full', 'ground'); }
    }
  }
  function dumpInto(s, z, load, dt, who) {
    const zz = W.Z[z], cap = W.contCap(s, z);
    if ((zz.launching > 0 && zz.launching > W.launchTime(s) - 0.8) || !load.length) return;
    zz.dump -= dt;
    while (zz.dump <= 0 && load.length && s.cont[z].length < cap) {
      s.cont[z].push(load.pop()); zz.dump += who === 'me' ? 0.05 : 0.02;
      if (who === 'me') s.dumped++;
      emit('dump', { z, who });
      if (s.cont[z].length >= cap) emit('contFull', z);
    }
    if (zz.dump < -0.2) zz.dump = 0;
  }

  /* ---------- Employés ---------- */
  function syncAgents(s, z) {
    const want = Math.min(z === 'ground' ? s.team.collector : s.team.pilot, 40), list = W.Z[z].agents;
    while (list.length < want) list.push(z === 'ground'
      ? { x: C.DEPOT.x + rnd(-1, 1), y: C.DEPOT.y + 1.6, load: [], state: 'seek', target: null, path: null, dir: 1, walk: rnd(0, 6), hue: list.length % 5, moving: false }
      : { x: G.ZONES.orbit.base + rnd(-3, 3), y: rnd(30, 60), load: [], state: 'seek', target: null, dir: 1, walk: 0, hue: list.length });
    while (list.length > want) list.pop();
  }
  function crewXp(s, z) { const crew = s.crew[z]; crew.xp++; if (crew.xp >= G.empXpNeed(crew.lvl)) { crew.xp = 0; crew.lvl++; emit('crewLevel', { z, lvl: crew.lvl }); } }
  function runGroundAgents(s, dt) {
    const zz = W.Z.ground, cap = W.empCap(s), speed = W.empSpeed(s);
    for (const a of zz.agents) {
      if (a.state === 'seek') {
        if (a.load.length >= cap || (!zz.items.length && a.load.length)) { a.state = 'return'; if (a.target && a.target.claim === a) a.target.claim = null; a.target = null; a.path = null; continue; }
        if (!a.target || zz.items.indexOf(a.target) < 0) {
          let best = null, bd = 1e9;
          for (const it of zz.items) { if (it.claim && it.claim !== a) continue; const d = Math.hypot(it.x - a.x, it.y - a.y); if (d < bd) { bd = d; best = it; } }
          a.target = best; a.path = null; if (best) best.claim = a;
        }
        const t = a.target;
        if (!t) { a.moving = false; continue; }
        if (Math.hypot(t.x - a.x, t.y - a.y) < 0.55) { a.load.push(take(s, 'ground', t, 'crew')); a.target = null; a.path = null; crewXp(s, 'ground'); continue; }
        if (!a.path && pathBudget > 0) { pathBudget--; a.path = C.path(W.city, s, a.x, a.y, t.x, t.y) || [{ x: t.x, y: t.y }]; }
        if (a.path) walkStep(a, speed, dt); else a.moving = false;
      } else {
        if (Math.hypot(C.DEPOT.x - a.x, C.DEPOT.y + 1.3 - a.y) > 1.3) {
          if (!a.path && pathBudget > 0) { pathBudget--; a.path = C.path(W.city, s, a.x, a.y, C.DEPOT.x + rnd(-0.8, 0.8), C.DEPOT.y + 1.3) || [{ x: C.DEPOT.x, y: C.DEPOT.y + 1.3 }]; }
          if (a.path) walkStep(a, speed, dt); else a.moving = false;
        } else { a.moving = false; a.path = null; dumpInto(s, 'ground', a.load, dt, 'crew'); if (!a.load.length) a.state = 'seek'; }
      }
    }
  }
  function runOrbitAgents(s, dt) {
    const c = G.ZONES.orbit, zz = W.Z.orbit, cap = W.pilotCap(s), speed = W.pilotSpeed(s);
    for (const a of zz.agents) {
      if (a.state === 'seek') {
        if (a.load.length >= cap || (!zz.items.length && a.load.length)) { a.state = 'return'; if (a.target) a.target.claim = null; a.target = null; continue; }
        if (!a.target || zz.items.indexOf(a.target) < 0) { let best = null, bd = 1e9; for (const it of zz.items) { if (it.claim && it.claim !== a) continue; const d = Math.abs(it.x - a.x) + Math.abs(it.y - a.y); if (d < bd) { bd = d; best = it; } } a.target = best; if (best) best.claim = a; }
        const t = a.target; if (!t) continue;
        const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy);
        if (d < 1.3) { a.load.push(take(s, 'orbit', t, 'crew')); a.target = null; crewXp(s, 'orbit'); }
        else { a.x += dx / d * speed * dt; a.y += dy / d * speed * dt; a.dir = dx > 0 ? 1 : -1; }
      } else {
        const dx = c.base + 2 - a.x, dy = c.baseY - a.y, d = Math.hypot(dx, dy);
        if (d > 2.5) { a.x += dx / d * speed * dt; a.y += dy / d * speed * dt; a.dir = dx > 0 ? 1 : -1; }
        else { dumpInto(s, 'orbit', a.load, dt, 'crew'); if (!a.load.length) a.state = 'seek'; }
      }
    }
  }

  /* ---------- Mise à jour ---------- */
  W.update = (s, dt) => {
    s.playTime += dt; pathBudget = 3;
    if (s.frenzy > 0) s.frenzy = Math.max(0, s.frenzy - dt);
    for (const z of ['ground', 'orbit']) if (W.Z[z].launching > 0) W.Z[z].launching = Math.max(0, W.Z[z].launching - dt);
    if (!s.awaitingTravel) {
      const g = W.Z.ground; g.acc += W.spawnRate(s) * dt;
      while (g.acc >= 1) { g.acc -= 1; if (g.items.length < W.mapCap(s)) spawnGround(s); }
      if (s.ship) { const o = W.Z.orbit; o.acc += G.ORBIT_SPAWN * dt; while (o.acc >= 1) { o.acc -= 1; if (o.items.length < G.ZONES.orbit.visible) spawnOrbit(s); } }
    }
    playerMove(s, dt);
    collectGround(s, dt);
    if (Math.hypot(W.player.x - C.DEPOT.x, W.player.y - C.DEPOT.y) < 1.8) dumpInto(s, 'ground', s.bag, dt, 'me');
    if (s.ship) {
      const oc = G.ZONES.orbit, sh = W.ship, sp = W.shipSpeed(s);
      let vx = 0, vy = 0;
      if (s.view === 'orbit' && (W.input.x || W.input.y)) { sh.tx = sh.ty = null; const len = Math.hypot(W.input.x, W.input.y); vx = W.input.x / len; vy = W.input.y / len; }
      else if (sh.tx != null) { const dx = sh.tx - sh.x, dy = sh.ty - sh.y, d = Math.hypot(dx, dy); if (d < 0.6) sh.tx = sh.ty = null; else { vx = dx / d; vy = dy / d; } }
      sh.moving = !!(vx || vy);
      if (sh.moving) { sh.x = clamp(sh.x + vx * sp * dt, 4, oc.w - 4); sh.y = clamp(sh.y + vy * sp * dt, oc.top, oc.bottom); if (Math.abs(vx) > 0.05) sh.dir = vx > 0 ? 1 : -1; }
      const items = W.Z.orbit.items, cap = W.holdCap(s), reach = W.shipReach(s);
      for (let i = items.length - 1; i >= 0 && s.hold.length < cap; i--) {
        const it = items[i], dx = sh.x - it.x, dy = sh.y - it.y, d = Math.hypot(dx, dy);
        if (d > reach && d <= reach * G.PULL) { const st = Math.min(d - reach * 0.6, 30 * dt) / d; it.x += dx * st; it.y += dy * st; }
        if (d <= reach) { s.hold.push(take(s, 'orbit', it, 'me')); if (s.hold.length >= cap) emit('full', 'orbit'); }
      }
      if (Math.hypot(sh.x - oc.base, sh.y - oc.baseY) < 9) dumpInto(s, 'orbit', s.hold, dt, 'me');
    }
    syncAgents(s, 'ground'); runGroundAgents(s, dt);
    if (s.ship) { syncAgents(s, 'orbit'); runOrbitAgents(s, dt); }
    for (const z of ['ground', 'orbit']) {
      const op = z === 'ground' ? s.team.operator : s.team.gunner, cont = s.cont[z].length;
      if (!op || !cont || W.Z[z].launching > 0) continue;
      const busy = W.Z[z].agents.some(a => a.load.length);
      if (cont >= Math.ceil(W.contCap(s, z) * (sk(s, 'proDriver') ? 0.5 : 1)) || (!busy && s.playTime % 6 < dt)) W.launch(s, z, true);
    }
    if (W.combo.n && s.playTime - W.combo.t > G.COMBO_WINDOW) { W.combo.n = 0; emit('comboEnd'); }
    W.checkMission(s);
    acc.t += dt;
    if (acc.t >= 5) { s.rate.items = s.rate.items * 0.7 + 0.3 * acc.items / acc.t; s.rate.money = s.rate.money * 0.7 + 0.3 * acc.money / acc.t; acc = { items: 0, money: 0, t: 0 }; }
    checkClean(s);
  };

  /* ---------- Hors ligne ---------- */
  W.offline = (s, secs) => {
    if (!(s.rate.items > 0) || s.awaitingTravel) return null;
    const t = Math.min(secs, W.offlineCap(s)), n = Math.min(Math.floor(s.rate.items * t), Math.ceil(s.pollution));
    const money = Math.round(n * s.rate.money / s.rate.items);
    s.money += money; s.moneyLife += money; s.sent += n; s.pollution -= n; gainXp(s, n);
    const stop = s.pollution <= 0; checkClean(s);
    return { secs, n, money, stop };
  };

  /* ---------- Missions et succès ---------- */
  W.mission = s => { const m = G.MISSIONS[s.mission]; return m ? { id: m.id, val: Math.min(m.need, m.val(s)), need: m.need, cash: Math.round(m.cash * G.planetValue(s.planet)) } : null; };
  W.checkMission = s => {
    const m = G.MISSIONS[s.mission];
    if (!m || m.val(s) < m.need) return;
    const cash = Math.round(m.cash * G.planetValue(s.planet));
    s.money += cash; s.moneyLife += cash; s.mission++;
    emit('mission', { id: m.id, cash });
  };
  W.checkAch = s => {
    const h = new Date().getHours(); if (h >= 2 && h < 5) s.insomniac = true;
    for (const a of G.ACHIEVEMENTS) if (!s.ach[a.id] && a.ok(s)) { s.ach[a.id] = Date.now(); if (a.outfit) s.outfits[a.outfit] = true; emit('ach', a.id); }
  };

  /* ---------- Sauvegarde ---------- */
  W.save = s => { s.last = Date.now(); try { localStorage.setItem(G.SAVE_KEY, JSON.stringify(s)); return true; } catch (e) { return false; } };
  W.revive = o => {
    if (!o || typeof o !== 'object') return null;
    const s = W.fresh();
    if (o.v !== 4) { if (o.settings) Object.assign(s.settings, o.settings); return s; }
    for (const k of Object.keys(s)) if (o[k] !== undefined && typeof o[k] === typeof s[k] && (typeof s[k] !== 'object' || s[k] === null)) s[k] = o[k];
    for (const k of ['districts', 'cont', 'gear', 'team', 'teamUps', 'crew', 'tree', 'ach', 'rate', 'settings', 'outfits']) if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) s[k] = Object.assign(s[k], o[k]);
    for (const k of ['bag', 'hold']) if (Array.isArray(o[k])) s[k] = o[k];
    if (!Array.isArray(s.cont.ground)) s.cont.ground = [];
    if (!Array.isArray(s.cont.orbit)) s.cont.orbit = [];
    s.tree.root = 1;
    return s;
  };
  W.load = () => { try { const raw = localStorage.getItem(G.SAVE_KEY); return raw ? W.revive(JSON.parse(raw)) : null; } catch (e) { return null; } };
  W.wipe = () => { try { localStorage.removeItem(G.SAVE_KEY); } catch (e) { /* stockage indisponible */ } };
})();
