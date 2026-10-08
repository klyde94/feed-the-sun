'use strict';
/* Feed the Sun v3 — réglages du jeu. Textes affichés : i18n.js. La ville se mesure en tuiles (city.js). */
const G = (window.FTS3 = window.FTS3 || {});

G.SAVE_KEY = 'feedthesun.v3.save';

/* ---------- Ville (sol) ---------- */
G.SPEED = 5.2;              // marche du joueur (tuiles/s)
G.EMP_SPEED = 3.4;          // éboueurs
G.SPAWN_BASE = 2.5;         // déchets qui apparaissent par seconde dans le centre-ville
G.MAP_FILL = 0.08;          // la carte se remplit au plus à 8 % de déchets (moyenne visée : 5 à 10 %)
G.FULL_BONUS = 1.1;         // conteneur plein : +10 %
G.LAUNCH_TIME = 1.2;
G.COMBO_WINDOW = 1.6;
G.COMBO_MAX = 10;
G.COMBO_CASH = 0.08;        // chaque ramassage rapporte tout de suite 8 % de sa valeur × combo
G.PULL = 2.2;               // aspiration des déchets proches (× la portée)

/* ---------- Orbite (vue de côté, unités : la scène fait 100 de haut) ---------- */
G.ZONES = { orbit: { w: 220, base: 22, baseY: 60, top: 16, bottom: 68, visible: 26, spawnMin: 40 } };
G.SHIP_SPEED = 34;
G.PILOT_SPEED = 22;
G.ORBIT_SPAWN = 0.5;

G.JUNK = {
  bag: { value: 1, size: 2.6, col: [214, 210, 196] }, can: { value: 1, size: 1.9, col: [196, 72, 60] },
  bottle: { value: 1, size: 2.1, col: [150, 200, 220] }, tire: { value: 3, size: 3, col: [52, 50, 48] },
  barrel: { value: 5, size: 3.1, col: [204, 156, 52] }, fridge: { value: 8, size: 3.6, col: [226, 226, 218] },
  bolt: { value: 4, size: 1.6, col: [170, 176, 190] }, panel: { value: 8, size: 2.8, col: [70, 92, 150] },
  sat: { value: 14, size: 2.6, col: [160, 176, 200] }, stage: { value: 22, size: 3, col: [206, 202, 192] },
};
/* Chaque quartier a ses déchets : l'est et le port donnent des objets plus lourds, qui rapportent plus. */
G.DISTRICT_JUNK = {
  centre: [['bag', 32], ['can', 26], ['bottle', 22], ['tire', 10], ['barrel', 6], ['fridge', 4]],
  north: [['bag', 26], ['can', 20], ['bottle', 18], ['tire', 16], ['barrel', 12], ['fridge', 8]],
  east: [['bag', 16], ['can', 14], ['bottle', 12], ['tire', 22], ['barrel', 20], ['fridge', 16]],
  port: [['bag', 8], ['can', 8], ['bottle', 8], ['tire', 22], ['barrel', 30], ['fridge', 24]],
};
G.ORBIT_JUNK = [['bolt', 40], ['panel', 30], ['sat', 20], ['stage', 10]];
G.GOLD_CHANCE = { ground: 0.014, orbit: 0.022 };
G.GOLD_VALUE = 3;
G.DISTRICT_COST = { north: 450, east: 3600, port: 18000 };
G.DISTRICT_SPAWN = { centre: 1, north: 0.8, east: 0.9, port: 1 };

/* Pollution à éliminer (en déchets envoyés au soleil) : environ 30 à 60 min pour la première ville. */
G.planetPollution = n => Math.round(20000 * Math.pow(2.4, n));
G.planetValue = n => Math.pow(1.7, n);
G.JUMP_REQ = 3;
G.CRYSTAL_BONUS = 0.1;

G.PLANETS = [
  { bad: 'Ordura', good: 'Aurora', grass: [86, 160, 96], sky: [96, 170, 230], sea: [47, 111, 168] },
  { bad: 'Smogon', good: 'Selena', grass: [120, 170, 84], sky: [80, 160, 200], sea: [43, 125, 154] },
  { bad: 'Plastika', good: 'Pacifica', grass: [70, 150, 120], sky: [70, 130, 220], sea: [37, 96, 184] },
  { bad: 'Rouillor', good: 'Floralis', grass: [140, 176, 88], sky: [110, 160, 220], sea: [58, 111, 160] },
  { bad: 'Toxia', good: 'Thalassa', grass: [84, 170, 110], sky: [60, 150, 210], sea: [31, 120, 168] },
];

/* ---------- Boutique (dollars) ---------- */
G.GEAR = [
  { id: 'bag', sec: 'me', base: 30, growth: 1.6, max: 10, eff: l => 8 + 3 * l },
  { id: 'boots', sec: 'me', base: 45, growth: 1.6, max: 10, eff: l => 1 + 0.1 * l },
  { id: 'magnet', sec: 'me', base: 90, growth: 1.7, max: 8, eff: l => 0.9 + 0.3 * l },
  { id: 'container', sec: 'depot', base: 60, growth: 1.6, max: 10, eff: l => 24 + 12 * l },
  { id: 'ramp', sec: 'depot', base: 180, growth: 1.55, max: 12, eff: l => 1 + 0.15 * l },
  { id: 'sorting', sec: 'depot', base: 360, growth: 1.55, max: 12, eff: l => 1 + 0.2 * l },
  { id: 'bins', sec: 'city', base: 150, growth: 1.6, max: 10, eff: l => 1 + 0.3 * l },
  { id: 'hold', sec: 'ship', base: 600, growth: 1.6, max: 10, eff: l => 6 + 3 * l },
  { id: 'thrust', sec: 'ship', base: 700, growth: 1.6, max: 10, eff: l => 1 + 0.12 * l },
  { id: 'tractor', sec: 'ship', base: 900, growth: 1.7, max: 8, eff: l => 4 + 1.6 * l },
  { id: 'cannon', sec: 'ship', base: 1200, growth: 1.55, max: 12, eff: l => 1 + 0.15 * l },
];
G.SHIP_COST = 40000;
G.HIRES = [
  { id: 'collector', zone: 'ground', base: 120, growth: 1.22, max: 30 },
  { id: 'operator', zone: 'ground', base: 750, growth: 1, max: 1 },
  { id: 'pilot', zone: 'orbit', base: 1500, growth: 1.3, max: 15, needShip: true },
  { id: 'gunner', zone: 'orbit', base: 4000, growth: 1, max: 1, needShip: true },
];
G.TEAM_UPS = [
  { id: 'trolleys', base: 450, growth: 1.7, max: 6, eff: l => l },
  { id: 'training', base: 600, growth: 1.55, max: 10, eff: l => 1 + 0.06 * l },
];
G.empXpNeed = lvl => Math.round(20 * Math.pow(lvl, 1.5));
G.xpNeed = lvl => Math.round(30 * Math.pow(1.3, lvl - 1));

/* ---------- Le grand arbre : compétences (points de niveau) et technologies (ordures dorées) ----------
   x, y : position dans l'arbre (0, 0 = racine). parent : nœud à posséder avant. */
G.TREE = [
  { id: 'root', x: 0, y: 0 },
  { id: 'pockets', type: 'skill', cost: 1, parent: 'root', x: 0, y: -150 },
  { id: 'sprint', type: 'skill', cost: 1, parent: 'pockets', x: -110, y: -280 },
  { id: 'broom', type: 'skill', cost: 2, parent: 'pockets', x: 110, y: -280 },
  { id: 'lynx', type: 'skill', cost: 2, parent: 'sprint', x: -110, y: -410 },
  { id: 'sorter', type: 'skill', cost: 3, parent: 'broom', x: 110, y: -410 },
  { id: 'recruiter', type: 'skill', cost: 1, parent: 'root', x: -190, y: 0 },
  { id: 'carts', type: 'skill', cost: 1, parent: 'recruiter', x: -330, y: -90 },
  { id: 'teamSpirit', type: 'skill', cost: 2, parent: 'recruiter', x: -330, y: 90 },
  { id: 'allNighter', type: 'skill', cost: 2, parent: 'carts', x: -470, y: -90 },
  { id: 'proDriver', type: 'skill', cost: 3, parent: 'teamSpirit', x: -470, y: 90 },
  { id: 'reactors', type: 'skill', cost: 1, parent: 'root', x: 190, y: 0 },
  { id: 'doubleHold', type: 'skill', cost: 2, parent: 'reactors', x: 330, y: -90 },
  { id: 'debrisMagnet', type: 'skill', cost: 2, parent: 'reactors', x: 330, y: 90 },
  { id: 'trainedPilots', type: 'skill', cost: 2, parent: 'doubleHold', x: 470, y: -90 },
  { id: 'orbitalShot', type: 'skill', cost: 3, parent: 'debrisMagnet', x: 470, y: 90 },
  { id: 'sorting', type: 'tech', max: 10, parent: 'root', x: 0, y: 150 },
  { id: 'net', type: 'tech', max: 3, parent: 'sorting', x: -130, y: 270 },
  { id: 'harpoon', type: 'tech', max: 5, parent: 'sorting', x: 0, y: 270 },
  { id: 'magnetic', type: 'tech', max: 5, parent: 'sorting', x: 130, y: 270 },
  { id: 'vests', type: 'tech', max: 5, parent: 'net', x: -130, y: 390 },
  { id: 'laser', type: 'tech', max: 3, parent: 'harpoon', x: 0, y: 390 },
  { id: 'arm', type: 'tech', max: 3, parent: 'magnetic', x: 130, y: 390 },
  { id: 'tether', type: 'tech', max: 5, parent: 'vests', x: -130, y: 510 },
  { id: 'ion', type: 'tech', max: 5, parent: 'laser', x: 0, y: 510 },
  { id: 'driver', type: 'tech', max: 5, parent: 'arm', x: 130, y: 510 },
  { id: 'radar', type: 'tech', max: 3, parent: 'tether', x: -70, y: 630 },
  { id: 'prospect', type: 'tech', max: 5, parent: 'driver', x: 70, y: 630 },
];
G.techCost = lvl => 1 + lvl;

G.SUN = [
  { at: 0, k: 3200, rgb: [255, 98, 66] }, { at: 150, k: 4600, rgb: [255, 150, 74] }, { at: 1500, k: 5800, rgb: [255, 212, 118] },
  { at: 12000, k: 7200, rgb: [255, 238, 200] }, { at: 80000, k: 9800, rgb: [236, 242, 255] }, { at: 500000, k: 21000, rgb: [168, 198, 255] },
  { at: 3e6, k: 42000, rgb: [126, 158, 255] }, { at: 2e7, k: 90000, rgb: [196, 140, 255] },
];

G.ACH_BONUS = 0.02;
/* 30 succès : 10 faciles, 10 moyens, 10 difficiles. Certains offrent une tenue pour l'éboueur. */
const nTree = s => G.TREE.filter(n => n.id !== 'root' && s.tree[n.id]).length;
const gearLv = s => G.GEAR.reduce((a, g) => a + s.gear[g.id], 0);
G.ACHIEVEMENTS = [
  { id: 'launch1', tier: 1, ok: s => s.launches >= 1 }, { id: 'sent100', tier: 1, ok: s => s.sent >= 100 },
  { id: 'hire1', tier: 1, ok: s => s.team.collector >= 1 }, { id: 'district', tier: 1, ok: s => Object.keys(s.districts).length >= 2 },
  { id: 'combo5', tier: 1, ok: s => s.maxCombo >= 5 }, { id: 'gold1', tier: 1, ok: s => s.goldLife >= 1 },
  { id: 'gear5', tier: 1, ok: s => gearLv(s) >= 5 }, { id: 'skill1', tier: 1, ok: s => nTree(s) >= 1 },
  { id: 'wreck1', tier: 1, ok: s => s.wrecks >= 1 }, { id: 'sunOrange', tier: 1, ok: s => s.sent >= 150 },
  { id: 'sent1k', tier: 2, ok: s => s.sent >= 1000 }, { id: 'hire10', tier: 2, ok: s => s.team.collector >= 10 },
  { id: 'operator', tier: 2, ok: s => s.team.operator >= 1 }, { id: 'combo10', tier: 2, ok: s => s.maxCombo >= 10 },
  { id: 'sunYellow', tier: 2, ok: s => s.sent >= 1500 }, { id: 'allDistricts', tier: 2, ok: s => Object.keys(s.districts).length >= 4 },
  { id: 'gold25', tier: 2, ok: s => s.goldLife >= 25 }, { id: 'lvl10', tier: 2, ok: s => s.level >= 10 },
  { id: 'full25', tier: 2, ok: s => s.fullLaunches >= 25 }, { id: 'halfway', tier: 2, ok: s => s.saved >= 1 || G.W.pollution(s) <= 0.5 },
  { id: 'save1', tier: 3, outfit: 'goldcap', ok: s => s.saved >= 1 }, { id: 'save2', tier: 3, outfit: 'astro', ok: s => s.saved >= 2 },
  { id: 'jump1', tier: 3, outfit: 'cape', ok: s => s.jumps >= 1 }, { id: 'allMax', tier: 3, ok: s => G.W.allMax(s) },
  { id: 'treeFull', tier: 3, ok: s => nTree(s) >= G.TREE.length - 1 && G.TREE.every(n => n.type !== 'tech' || (s.tree[n.id] || 0) >= n.max) },
  { id: 'team30', tier: 3, ok: s => s.team.collector >= 30 }, { id: 'sent100k', tier: 3, ok: s => s.sent >= 100000 },
  { id: 'marathon', tier: 3, outfit: 'headband', ok: s => s.walked >= 10000 }, { id: 'fridges', tier: 3, outfit: 'chef', ok: s => s.fridges >= 100 },
  { id: 'insomniac', tier: 3, outfit: 'nightcap', ok: s => s.insomniac },
];
/* Tenues de l'éboueur (débloquées par certains succès) */
G.OUTFITS = ['helmet', 'goldcap', 'astro', 'cape', 'headband', 'chef', 'nightcap'];

/* ---------- Missions : une à la fois ---------- */
G.MISSIONS = [
  { id: 'pick', need: 8, val: s => s.picked, cash: 5 },
  { id: 'dump', need: 1, val: s => s.dumped, cash: 5 },
  { id: 'launch', need: 1, val: s => s.launches, cash: 10 },
  { id: 'buy', need: 1, val: s => G.GEAR.reduce((a, g) => a + s.gear[g.id], 0), cash: 10 },
  { id: 'hire', need: 1, val: s => s.team.collector, cash: 20 },
  { id: 'district', need: 2, val: s => Object.keys(s.districts).length, cash: 40 },
  { id: 'hire3', need: 3, val: s => s.team.collector, cash: 40 },
  { id: 'operator', need: 1, val: s => s.team.operator, cash: 80 },
  { id: 'skill', need: 1, val: s => G.TREE.filter(n => n.type === 'skill' && s.tree[n.id]).length, cash: 80 },
  { id: 'bins', need: 1, val: s => s.gear.bins, cash: 100 },
  { id: 'hire6', need: 6, val: s => s.team.collector, cash: 150 },
  { id: 'east', need: 3, val: s => Object.keys(s.districts).length, cash: 250 },
  { id: 'half', need: 50, val: s => Math.round((1 - G.W.pollution(s)) * 100), cash: 400 },
  { id: 'gold', need: 1, val: s => s.goldLife, cash: 200 },
  { id: 'port', need: 4, val: s => Object.keys(s.districts).length, cash: 800 },
  { id: 'save1', need: 1, val: s => s.saved, cash: 1000 },
  { id: 'ship', need: 1, val: s => (s.ship ? 1 : 0), cash: 0 },
  { id: 'orbit', need: 10, val: s => s.orbitPicked, cash: 800 },
  { id: 'pilot', need: 1, val: s => s.team.pilot, cash: 800 },
  { id: 'save3', need: 3, val: s => s.saved, cash: 3000 },
  { id: 'jump', need: 1, val: s => s.jumps, cash: 0 },
];
