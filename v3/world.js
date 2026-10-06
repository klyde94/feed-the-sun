'use strict';
/* Feed the Sun v3 — moteur : zones (sol, orbite), joueur, vaisseau, employés, économie, progression, sauvegarde. */
(function () {
  const G = window.FTS3;
  const W = (G.W = {});
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const L = {};
  W.on = (type, fn) => { (L[type] = L[type] || []).push(fn); };
  const emit = (type, data) => { if (!W.mute) (L[type] || []).forEach(fn => fn(data)); };

  /* ---------- État sauvegardé ---------- */
  W.fresh = () => ({
    v: 3, money: 0, moneyLife: 0, sent: 0, planet: 0, saved: 0, savedRun: 0, jumps: 0, crystals: 0,
    pools: { ground: G.planetItems(0, 'ground'), orbit: G.planetItems(0, 'orbit') },
    cont: { ground: [], orbit: [] }, bag: [], hold: [],
    gear: Object.fromEntries(G.GEAR.map(g => [g.id, 0])), ship: false,
    team: { collector: 0, operator: 0, pilot: 0, gunner: 0 }, teamUps: { trolleys: 0, training: 0 },
    crew: { ground: { xp: 0, lvl: 1 }, orbit: { xp: 0, lvl: 1 } },
    xp: 0, level: 1, skillPts: 0, skills: {}, techPts: 0, tech: {}, goldLife: 0, wrecks: 0, ach: {},
    frenzy: 0, awaitingTravel: false, tutorial: 0, seenOrbit: false, playTime: 0, view: 'ground',
    rate: { items: 0, money: 0 }, settings: { lang: null, sound: true }, last: Date.now(),
  });

  /* ---------- Monde en mémoire (recréé au chargement) ---------- */
  W.Z = { ground: { items: [], launching: 0, agents: [], dump: 0 }, orbit: { items: [], launching: 0, agents: [], dump: 0 } };
  W.player = { x: 46, y: 84, tx: null, ty: null, dir: 1, walk: 0, moving: false };
  W.ship = { x: 40, y: 42, tx: null, ty: null, dir: 1, moving: false };
  W.input = { x: 0, y: 0 };
  let nextId = 1, acc = { items: 0, money: 0, t: 0 };

  /* ---------- Modificateurs (équipement, compétences, technologies) ---------- */
  const gearDef = id => G.GEAR.find(g => g.id === id);
  W.gearEff = (s, id) => gearDef(id).eff(s.gear[id]);
  const sk = (s, id) => !!s.skills[id];
  const tl = (s, id) => s.tech[id] || 0;
  W.achCount = s => Object.keys(s.ach).length;
  W.globalMult = s => (1 + 0.05 * tl(s, 'tether')) * (1 + 0.04 * tl(s, 'sorting')) * (1 + G.CRYSTAL_BONUS * s.crystals) * (1 + G.ACH_BONUS * W.achCount(s));
  W.zoneMult = (s, z) => z === 'ground' ? W.gearEff(s, 'ramp') * (sk(s, 'sorter') ? 1.5 : 1)
    : W.gearEff(s, 'cannon') * (sk(s, 'orbitalShot') ? 1.5 : 1) * (1 + 0.08 * tl(s, 'magnetic'));
  W.itemValue = (s, z, item) => { const gold = item.endsWith('*'); return G.JUNK[gold ? item.slice(0, -1) : item].value * (gold ? G.GOLD_VALUE : 1) * G.planetValue(s.planet) * W.zoneMult(s, z) * W.globalMult(s); };
  W.bagCap = s => W.gearEff(s, 'bag') + (sk(s, 'pockets') ? 3 : 0);
  W.holdCap = s => W.gearEff(s, 'hold') * (sk(s, 'doubleHold') ? 2 : 1);
  W.contCap = (s, z) => { const c = W.gearEff(s, 'container') * (1 + 0.1 * tl(s, 'driver')); return Math.round(z === 'orbit' ? c * 0.6 : c); };
  const boost = s => (s.frenzy > 0 ? 2 : 1);
  W.walkSpeed = s => G.SPEED * W.gearEff(s, 'boots') * (sk(s, 'sprint') ? 1.25 : 1) * boost(s);
  W.shipSpeed = s => G.SHIP_SPEED * W.gearEff(s, 'thrust') * (sk(s, 'reactors') ? 1.25 : 1) * (1 + 0.08 * tl(s, 'ion')) * boost(s);
  W.reach = s => W.gearEff(s, 'magnet') * (sk(s, 'broom') ? 2 : 1) * (1 + 0.1 * tl(s, 'harpoon'));
  W.shipReach = s => W.gearEff(s, 'tractor') * (sk(s, 'debrisMagnet') ? 2 : 1) * (1 + 0.1 * tl(s, 'harpoon'));
  const teamSpeed = s => (1 + 0.1 * s.teamUps.training) * (sk(s, 'teamSpirit') ? 1.25 : 1) * boost(s);
  W.empCap = s => 4 + s.teamUps.trolleys + (sk(s, 'carts') ? 2 : 0) + tl(s, 'net');
  W.pilotCap = s => 5 + s.teamUps.trolleys + tl(s, 'arm');
  W.empSpeed = s => G.EMP_SPEED * teamSpeed(s) * (1 + 0.05 * tl(s, 'vests')) * (1 + 0.04 * (s.crew.ground.lvl - 1));
  W.pilotSpeed = s => G.PILOT_SPEED * teamSpeed(s) * (sk(s, 'trainedPilots') ? 1.3 : 1) * (1 + 0.08 * tl(s, 'ion')) * (1 + 0.04 * (s.crew.orbit.lvl - 1));
  W.launchTime = s => G.LAUNCH_TIME * (1 - 0.15 * tl(s, 'laser'));
  W.goldChance = (s, z) => G.GOLD_CHANCE[z] * (sk(s, 'lynx') ? 2 : 1) * (1 + 0.15 * tl(s, 'prospect'));
  W.wreckInterval = s => 70 / (1 + 0.2 * tl(s, 'radar'));
  W.offlineCap = s => (sk(s, 'allNighter') ? 12 : 6) * 3600;
  W.contValue = (s, z) => {
    let v = 0; for (const it of s.cont[z]) v += W.itemValue(s, z, it);
    return Math.round(v * (s.cont[z].length >= W.contCap(s, z) ? G.FULL_BONUS : 1));
  };

  /* ---------- Coûts et achats ---------- */
  W.gearCost = (s, id) => { const g = gearDef(id); return Math.round(g.base * Math.pow(g.growth, s.gear[id])); };
  W.canGear = (s, id) => { const g = gearDef(id); return (g.who === 'me' || s.ship) && s.gear[id] < g.max && s.money >= W.gearCost(s, id); };
  W.buyGear = (s, id) => { if (!W.canGear(s, id)) return false; s.money -= W.gearCost(s, id); s.gear[id]++; emit('buy', id); return true; };
  W.buyShip = s => { if (s.ship || s.money < G.SHIP_COST) return false; s.money -= G.SHIP_COST; s.ship = true; emit('ship'); return true; };
  const hireDef = id => G.HIRES.find(h => h.id === id);
  W.hireCost = (s, id) => { const h = hireDef(id); return Math.round(h.base * Math.pow(h.growth, s.team[id]) * (sk(s, 'recruiter') ? 0.8 : 1)); };
  W.canHire = (s, id) => { const h = hireDef(id); return (!h.needShip || s.ship) && s.team[id] < h.max && s.money >= W.hireCost(s, id); };
  W.hire = (s, id) => { if (!W.canHire(s, id)) return false; s.money -= W.hireCost(s, id); s.team[id]++; emit('hire', id); return true; };
  const tupDef = id => G.TEAM_UPS.find(u => u.id === id);
  W.tupCost = (s, id) => { const u = tupDef(id); return Math.round(u.base * Math.pow(u.growth, s.teamUps[id])); };
  W.canTup = (s, id) => s.teamUps[id] < tupDef(id).max && s.money >= W.tupCost(s, id);
  W.buyTup = (s, id) => { if (!W.canTup(s, id)) return false; s.money -= W.tupCost(s, id); s.teamUps[id]++; emit('buy', id); return true; };
  W.skillState = (s, branch, i) => {
    const b = G.SKILLS.find(x => x.branch === branch), n = b.nodes[i];
    if (s.skills[n.id]) return 'owned';
    if (i > 0 && !s.skills[b.nodes[i - 1].id]) return 'locked';
    return s.skillPts >= n.cost ? 'can' : 'poor';
  };
  W.learn = (s, branch, i) => { if (W.skillState(s, branch, i) !== 'can') return false; const n = G.SKILLS.find(x => x.branch === branch).nodes[i]; s.skillPts -= n.cost; s.skills[n.id] = true; emit('learn', n.id); return true; };
  W.techUp = (s, id) => {
    const n = G.TECHS.flatMap(b => b.nodes).find(x => x.id === id), lvl = tl(s, id), cost = G.techCost(lvl);
    if (lvl >= n.max || s.techPts < cost) return false;
    s.techPts -= cost; s.tech[id] = lvl + 1; emit('tech', id); return true;
  };

  /* ---------- Planètes, soleil, prestige ---------- */
  W.sunStage = s => { let k = 0; for (let i = 0; i < G.SUN.length; i++) if (s.sent >= G.SUN[i].at) k = i; return k; };
  W.planetInfo = (s, n = s.planet) => {
    const p = G.PLANETS[n % G.PLANETS.length], c = Math.floor(n / G.PLANETS.length), sfx = c ? ' ' + ['II', 'III', 'IV', 'V', 'VI', 'VII'][Math.min(5, c - 1)] : '';
    return Object.assign({}, p, { bad: p.bad + sfx, good: p.good + sfx });
  };
  const total = s => G.planetItems(s.planet, 'ground') + G.planetItems(s.planet, 'orbit');
  const carried = () => { let n = 0; for (const z of ['ground', 'orbit']) for (const a of W.Z[z].agents) n += a.load.length; return n; };
  W.pollution = s => (s.pools.ground + s.pools.orbit + s.bag.length + s.hold.length + s.cont.ground.length + s.cont.orbit.length + carried()) / total(s);
  W.canJump = s => s.savedRun >= G.JUMP_REQ;
  W.jumpGain = s => (s.savedRun * (s.savedRun + 1)) / 2;
  W.jump = s => {
    if (!W.canJump(s)) return 0;
    const g = W.jumpGain(s), f = W.fresh();
    s.crystals += g; s.jumps++;
    for (const k of ['money', 'planet', 'savedRun', 'pools', 'cont', 'bag', 'hold', 'gear', 'ship', 'team', 'teamUps', 'crew', 'frenzy', 'awaitingTravel', 'rate']) s[k] = f[k];
    s.view = 'ground'; W.reset(s); emit('jump', g);
    return g;
  };
  function checkClean(s) {
    if (!s.awaitingTravel && s.pools.ground <= 0 && s.pools.orbit <= 0 && W.pollution(s) <= 0) {
      s.awaitingTravel = true; s.saved++; s.savedRun++; emit('cleaned', s.planet);
    }
  }
  W.travel = s => {
    if (!s.awaitingTravel) return;
    s.planet++; s.pools = { ground: G.planetItems(s.planet, 'ground'), orbit: G.planetItems(s.planet, 'orbit') }; s.awaitingTravel = false;
    W.reset(s); emit('travel', s.planet);
  };

  /* ---------- Déchets dans les zones ---------- */
  function pickKind(z) { const ws = G.WEIGHTS[z]; let t = 0; for (const [, w] of ws) t += w; let r = Math.random() * t; for (const [k, w] of ws) { r -= w; if (r <= 0) return k; } return ws[0][0]; }
  function spawn(s, z, near) {
    const c = G.ZONES[z], x = near ? rnd(c.spawnMin, c.spawnMin + 60) : c.spawnMin + (c.w - 6 - c.spawnMin) * Math.pow(Math.random(), 1.3);
    W.Z[z].items.push({ id: nextId++, kind: pickKind(z), gold: Math.random() < W.goldChance(s, z), x, y: rnd(c.top + 1.5, c.bottom - 1), a: rnd(-0.6, 0.6), va: z === 'orbit' ? rnd(-0.5, 0.5) : 0, born: performance.now() });
  }
  function fill(s, z, first) {
    const items = W.Z[z].items, want = Math.min(G.ZONES[z].visible, s.pools[z]);
    while (items.length < want) spawn(s, z, first && items.length < 8);
    while (items.length > s.pools[z]) items.pop();
  }
  W.reset = s => {
    for (const z of ['ground', 'orbit']) { W.Z[z].items = []; W.Z[z].launching = 0; W.Z[z].agents = []; fill(s, z, true); }
    Object.assign(W.player, { x: 46, y: 84, tx: null, ty: null }); Object.assign(W.ship, { x: 40, y: 42, tx: null, ty: null });
  };
  function take(s, z, it, who) {
    const zz = W.Z[z]; zz.items.splice(zz.items.indexOf(it), 1); s.pools[z]--;
    if (it.gold) { const n = Math.random() < 0.15 ? 3 : 1; s.techPts += n; s.goldLife++; emit('gold', { n, who, z }); }
    emit('pickup', { it, who, z });
    return it.kind + (it.gold ? '*' : '');
  }

  /* ---------- Commandes ---------- */
  W.goTo = (s, x, y) => {
    const c = G.ZONES[s.view], m = s.view === 'ground' ? W.player : W.ship;
    m.tx = clamp(x, 4, c.w - 4); m.ty = clamp(y, c.top, c.bottom);
  };
  W.launch = (s, z, auto) => {
    const zz = W.Z[z], cont = s.cont[z];
    if (!cont.length || zz.launching > 0) return false;
    const n = cont.length, full = n >= W.contCap(s, z), money = W.contValue(s, z), kinds = cont.slice(0, 12);
    s.money += money; s.moneyLife += money; s.sent += n; s.cont[z] = [];
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
    const r = Math.random();
    let res;
    if (r < 0.45) { const m = Math.round(Math.max(90 * s.rate.money, 40 * G.planetValue(s.planet) * W.globalMult(s))); s.money += m; s.moneyLife += m; res = { type: 'cargo', money: m }; }
    else if (r < 0.8) { s.frenzy = 30; res = { type: 'frenzy', secs: 30 }; }
    else { s.techPts += 3; res = { type: 'goldRain' }; }
    emit('salvage', res); return res;
  };

  /* ---------- Déplacement du joueur et du vaisseau ---------- */
  function steer(m, speed, dt, c, active, vyScale) {
    let vx = 0, vy = 0;
    if (active && (W.input.x || W.input.y)) { m.tx = m.ty = null; const len = Math.hypot(W.input.x, W.input.y); vx = W.input.x / len; vy = (W.input.y / len) * vyScale; }
    else if (m.tx != null) { const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy); if (d < 0.6) m.tx = m.ty = null; else { vx = dx / d; vy = dy / d; } }
    m.moving = !!(vx || vy);
    if (m.moving) {
      m.x = clamp(m.x + vx * speed * dt, 4, c.w - 4); m.y = clamp(m.y + vy * speed * dt, c.top, c.bottom);
      if (Math.abs(vx) > 0.05) m.dir = vx > 0 ? 1 : -1;
      m.walk = (m.walk || 0) + dt * speed * 0.35;
    }
  }
  function collect(s, z, m, load, cap, reach, who) {
    const items = W.Z[z].items;
    for (let i = items.length - 1; i >= 0 && load.length < cap; i--) {
      const it = items[i];
      if (Math.hypot(it.x - m.x, (it.y - m.y) * (z === 'ground' ? 1.6 : 1)) <= reach) { if (it.claim) it.claim.target = null; load.push(take(s, z, it, who)); if (load.length >= cap && who === 'me') emit('full', z); }
    }
  }
  function dumpInto(s, z, load, dt, who) {
    const zz = W.Z[z], cap = W.contCap(s, z);
    if (zz.launching > W.launchTime(s) - 0.8 || !load.length) return false;
    zz.dump -= dt;
    let moved = false;
    while (zz.dump <= 0 && load.length && s.cont[z].length < cap) {
      s.cont[z].push(load.pop()); zz.dump += who === 'me' ? 0.06 : 0.02; moved = true;
      emit('dump', { z, who });
      if (s.cont[z].length >= cap) emit('contFull', z);
    }
    if (zz.dump < -0.2) zz.dump = 0;
    return moved;
  }

  /* ---------- Employés (éboueurs au sol, pilotes en orbite) ---------- */
  function syncAgents(s, z) {
    const want = Math.min(z === 'ground' ? s.team.collector : s.team.pilot, 30), list = W.Z[z].agents, c = G.ZONES[z];
    while (list.length < want) list.push({ x: c.base + rnd(-3, 3), y: rnd(c.top + 2, c.bottom - 2), load: [], state: 'seek', target: null, dir: 1, walk: rnd(0, 6), hue: list.length });
    while (list.length > want) list.pop();
  }
  function runAgents(s, z, dt) {
    const c = G.ZONES[z], zz = W.Z[z], cap = z === 'ground' ? W.empCap(s) : W.pilotCap(s), speed = z === 'ground' ? W.empSpeed(s) : W.pilotSpeed(s), crew = s.crew[z];
    for (const a of zz.agents) {
      if (a.state === 'seek') {
        if (a.load.length >= cap || (!zz.items.length && a.load.length)) { a.state = 'return'; if (a.target) a.target.claim = null; a.target = null; }
        else {
          if (!a.target || zz.items.indexOf(a.target) < 0) {
            let best = null, bd = 1e9;
            for (const it of zz.items) { if (it.claim && it.claim !== a) continue; const d = Math.abs(it.x - a.x) + Math.abs(it.y - a.y); if (d < bd) { bd = d; best = it; } }
            a.target = best; if (best) best.claim = a;
          }
          if (a.target) {
            const dx = a.target.x - a.x, dy = a.target.y - a.y, d = Math.hypot(dx, dy);
            if (d < 1.3) { const k = take(s, z, a.target, 'crew'); a.load.push(k); a.target = null; crew.xp++; if (crew.xp >= G.empXpNeed(crew.lvl)) { crew.xp = 0; crew.lvl++; emit('crewLevel', { z, lvl: crew.lvl }); } }
            else { a.x += dx / d * speed * dt; a.y += dy / d * speed * dt; a.dir = dx > 0 ? 1 : -1; a.walk += dt * speed * 0.35; }
          }
        }
      } else {
        const tx = c.base + 2, ty = z === 'ground' ? clamp(a.y, c.top, c.bottom) : c.baseY, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
        if (d > 2.5) { a.x += dx / d * speed * dt; a.y += dy / d * speed * dt; a.dir = dx > 0 ? 1 : -1; a.walk += dt * speed * 0.35; }
        else { dumpInto(s, z, a.load, dt, 'crew'); if (!a.load.length) a.state = 'seek'; }
      }
    }
  }

  /* ---------- Mise à jour ---------- */
  W.update = (s, dt) => {
    s.playTime += dt;
    if (s.frenzy > 0) s.frenzy = Math.max(0, s.frenzy - dt);
    for (const z of ['ground', 'orbit']) if (W.Z[z].launching > 0) W.Z[z].launching = Math.max(0, W.Z[z].launching - dt);
    const gc = G.ZONES.ground, oc = G.ZONES.orbit;
    steer(W.player, W.walkSpeed(s), dt, gc, s.view === 'ground', 0.6);
    collect(s, 'ground', W.player, s.bag, W.bagCap(s), W.reach(s), 'me');
    if (Math.abs(W.player.x - gc.base) < 7) dumpInto(s, 'ground', s.bag, dt, 'me');
    if (s.ship) {
      steer(W.ship, W.shipSpeed(s), dt, oc, s.view === 'orbit', 1);
      collect(s, 'orbit', W.ship, s.hold, W.holdCap(s), W.shipReach(s), 'me');
      if (Math.hypot(W.ship.x - oc.base, W.ship.y - oc.baseY) < 9) dumpInto(s, 'orbit', s.hold, dt, 'me');
    }
    for (const z of ['ground', 'orbit']) {
      if (z === 'orbit' && !s.ship) continue;
      syncAgents(s, z); runAgents(s, z, dt); fill(s, z, false);
      const op = z === 'ground' ? s.team.operator : s.team.gunner, cap = W.contCap(s, z), cont = s.cont[z].length;
      const idle = !W.Z[z].agents.some(a => a.load.length) && s.pools[z] <= 0;
      if (op && cont && (cont >= Math.ceil(cap * (sk(s, 'proDriver') ? 0.5 : 1)) || idle)) W.launch(s, z, true);
    }
    acc.t += dt;
    if (acc.t >= 5) { s.rate.items = s.rate.items * 0.7 + 0.3 * acc.items / acc.t; s.rate.money = s.rate.money * 0.7 + 0.3 * acc.money / acc.t; acc = { items: 0, money: 0, t: 0 }; }
    checkClean(s);
  };

  /* ---------- Hors ligne : l'équipe continue au rythme mesuré ---------- */
  W.offline = (s, secs) => {
    const t = Math.min(secs, W.offlineCap(s)), poolsLeft = s.pools.ground + s.pools.orbit;
    if (!(s.rate.items > 0) || !poolsLeft || s.awaitingTravel) return null;
    const n = Math.min(Math.floor(s.rate.items * t), poolsLeft), money = Math.round(n * s.rate.money / s.rate.items);
    const g = Math.round(n * s.pools.ground / poolsLeft);
    s.pools.ground -= g; s.pools.orbit -= n - g;
    s.money += money; s.moneyLife += money; s.sent += n; gainXp(s, n);
    for (const z of ['ground', 'orbit']) { W.Z[z].items = []; fill(s, z, false); }
    const stop = s.pools.ground + s.pools.orbit <= 0;
    if (stop) { s.cont.ground = []; s.cont.orbit = []; s.bag = []; s.hold = []; checkClean(s); }
    return { secs, n, money, stop };
  };

  W.checkAch = s => { for (const a of G.ACHIEVEMENTS) if (!s.ach[a.id] && a.ok(s)) { s.ach[a.id] = Date.now(); emit('ach', a.id); } };

  /* ---------- Sauvegarde ---------- */
  W.save = s => { s.last = Date.now(); try { localStorage.setItem(G.SAVE_KEY, JSON.stringify(s)); return true; } catch (e) { return false; } };
  W.revive = o => {
    if (!o || o.v !== 3) return null;
    const s = W.fresh();
    for (const k of Object.keys(s)) if (o[k] !== undefined && typeof o[k] === typeof s[k] && !Array.isArray(s[k]) && typeof s[k] !== 'object') s[k] = o[k];
    for (const k of ['pools', 'cont', 'gear', 'team', 'teamUps', 'crew', 'skills', 'tech', 'ach', 'rate', 'settings']) if (o[k] && typeof o[k] === 'object') s[k] = Object.assign(s[k], o[k]);
    for (const k of ['bag', 'hold']) if (Array.isArray(o[k])) s[k] = o[k];
    if (o.pools === undefined && typeof o.remaining === 'number') { s.pools.ground = o.remaining; s.pools.orbit = G.planetItems(s.planet, 'orbit'); }
    if (Array.isArray(o.cont)) s.cont = { ground: o.cont, orbit: [] };
    if (o.lvl && typeof o.lvl === 'object') for (const k in o.lvl) if (k in s.gear) s.gear[k] = o.lvl[k];
    if (!Array.isArray(s.cont.ground)) s.cont.ground = [];
    if (!Array.isArray(s.cont.orbit)) s.cont.orbit = [];
    return s;
  };
  W.load = () => { try { const raw = localStorage.getItem(G.SAVE_KEY); return raw ? W.revive(JSON.parse(raw)) : null; } catch (e) { return null; } };
  W.wipe = () => { try { localStorage.removeItem(G.SAVE_KEY); } catch (e) { /* stockage indisponible */ } };
})();
