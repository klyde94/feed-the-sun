'use strict';
/* Feed the Sun v3 — réglages du jeu (étapes 1 à 5). Textes affichés : i18n.js.
   Unités du monde : la scène fait 100 unités de haut. */
const G = (window.FTS3 = window.FTS3 || {});

G.SAVE_KEY = 'feedthesun.v3.save';
G.VERSION = 3;

/* ---------- Zones ---------- */
G.ZONES = {
  ground: { w: 260, base: 24, ramp: 9, top: 75, bottom: 94, visible: 34, spawnMin: 42 },
  orbit: { w: 220, base: 22, baseY: 60, top: 16, bottom: 68, visible: 26, spawnMin: 40 },
};
G.SPEED = 26;              // marche du joueur
G.SHIP_SPEED = 34;         // vaisseau du joueur
G.EMP_SPEED = 17;          // éboueurs
G.PILOT_SPEED = 22;        // pilotes
G.FULL_BONUS = 1.1;        // conteneur plein : +10 %
G.LAUNCH_TIME = 1.4;       // temps avant qu'un nouveau conteneur arrive

G.JUNK = {
  bag: { value: 1, size: 2.6, col: [214, 210, 196] },
  can: { value: 1, size: 1.9, col: [196, 72, 60] },
  bottle: { value: 1, size: 2.1, col: [150, 200, 220] },
  tire: { value: 3, size: 3, col: [52, 50, 48] },
  barrel: { value: 5, size: 3.1, col: [204, 156, 52] },
  fridge: { value: 8, size: 3.6, col: [226, 226, 218] },
  bolt: { value: 4, size: 1.6, col: [170, 176, 190] },
  panel: { value: 8, size: 2.8, col: [70, 92, 150] },
  sat: { value: 14, size: 2.6, col: [160, 176, 200] },
  stage: { value: 22, size: 3, col: [206, 202, 192] },
};
G.WEIGHTS = {
  ground: [['bag', 30], ['can', 24], ['bottle', 20], ['tire', 12], ['barrel', 9], ['fridge', 5]],
  orbit: [['bolt', 40], ['panel', 30], ['sat', 20], ['stage', 10]],
};
G.GOLD_CHANCE = { ground: 0.014, orbit: 0.022 };
G.GOLD_VALUE = 3;

G.planetItems = (n, zone) => Math.round((zone === 'orbit' ? 50 : 240) * Math.pow(2.2, n));
G.planetValue = n => Math.pow(1.6, n);
G.JUMP_REQ = 3;
G.CRYSTAL_BONUS = 0.1;     // +10 % de dollars par cristal

G.PLANETS = [
  { bad: 'Ordura', good: 'Aurora', grass: [86, 160, 96], sky: [96, 170, 230], sea: [47, 111, 168] },
  { bad: 'Smogon', good: 'Selena', grass: [120, 170, 84], sky: [80, 160, 200], sea: [43, 125, 154] },
  { bad: 'Plastika', good: 'Pacifica', grass: [70, 150, 120], sky: [70, 130, 220], sea: [37, 96, 184] },
  { bad: 'Rouillor', good: 'Floralis', grass: [140, 176, 88], sky: [110, 160, 220], sea: [58, 111, 160] },
  { bad: 'Toxia', good: 'Thalassa', grass: [84, 170, 110], sky: [60, 150, 210], sea: [31, 120, 168] },
];

/* ---------- Équipement (dollars) ---------- */
G.GEAR = [
  { id: 'bag', who: 'me', base: 12, growth: 1.55, max: 20, eff: l => 5 + 2 * l },
  { id: 'boots', who: 'me', base: 18, growth: 1.6, max: 15, eff: l => 1 + 0.12 * l },
  { id: 'container', who: 'me', base: 25, growth: 1.6, max: 20, eff: l => 20 + 10 * l },
  { id: 'magnet', who: 'me', base: 40, growth: 1.7, max: 10, eff: l => 3 + 1.4 * l },
  { id: 'ramp', who: 'me', base: 60, growth: 1.75, max: 25, eff: l => 1 + 0.15 * l },
  { id: 'hold', who: 'ship', base: 150, growth: 1.6, max: 20, eff: l => 6 + 3 * l },
  { id: 'thrust', who: 'ship', base: 180, growth: 1.65, max: 15, eff: l => 1 + 0.12 * l },
  { id: 'tractor', who: 'ship', base: 220, growth: 1.7, max: 10, eff: l => 4 + 1.6 * l },
  { id: 'cannon', who: 'ship', base: 300, growth: 1.75, max: 25, eff: l => 1 + 0.15 * l },
];
G.SHIP_COST = 250;

/* ---------- Équipe (dollars) ---------- */
G.HIRES = [
  { id: 'collector', zone: 'ground', base: 30, growth: 1.32, max: 30 },
  { id: 'operator', zone: 'ground', base: 120, growth: 1, max: 1 },
  { id: 'pilot', zone: 'orbit', base: 400, growth: 1.38, max: 20, needShip: true },
  { id: 'gunner', zone: 'orbit', base: 900, growth: 1, max: 1, needShip: true },
];
G.TEAM_UPS = [
  { id: 'trolleys', base: 80, growth: 1.8, max: 6, eff: l => l },
  { id: 'training', base: 100, growth: 1.7, max: 12, eff: l => 1 + 0.1 * l },
];
G.empXpNeed = lvl => Math.round(20 * Math.pow(lvl, 1.5));

/* ---------- Niveau du joueur et compétences (points forts) ---------- */
G.xpNeed = lvl => Math.round(25 * Math.pow(1.32, lvl - 1));
G.SKILLS = [
  { branch: 'me', nodes: [{ id: 'pockets', cost: 1 }, { id: 'sprint', cost: 1 }, { id: 'broom', cost: 2 }, { id: 'lynx', cost: 2 }, { id: 'sorter', cost: 3 }] },
  { branch: 'pilot', nodes: [{ id: 'reactors', cost: 1 }, { id: 'doubleHold', cost: 2 }, { id: 'debrisMagnet', cost: 2 }, { id: 'trainedPilots', cost: 2 }, { id: 'orbitalShot', cost: 3 }] },
  { branch: 'boss', nodes: [{ id: 'recruiter', cost: 1 }, { id: 'carts', cost: 1 }, { id: 'teamSpirit', cost: 2 }, { id: 'allNighter', cost: 2 }, { id: 'proDriver', cost: 3 }] },
];

/* ---------- Technologies (ordures dorées, points faibles) ---------- */
G.TECHS = [
  { branch: 'capture', nodes: [{ id: 'net', max: 3 }, { id: 'harpoon', max: 5 }, { id: 'magnetic', max: 5 }, { id: 'arm', max: 3 }] },
  { branch: 'propulsion', nodes: [{ id: 'tether', max: 5 }, { id: 'laser', max: 3 }, { id: 'ion', max: 5 }, { id: 'driver', max: 5 }] },
  { branch: 'logistics', nodes: [{ id: 'sorting', max: 10 }, { id: 'vests', max: 5 }, { id: 'radar', max: 3 }, { id: 'prospect', max: 5 }] },
];
G.techCost = lvl => 1 + lvl;   // niveau 0→1 : 1 point, 1→2 : 2 points…

/* ---------- Soleil ---------- */
G.SUN = [
  { at: 0, k: 3200, rgb: [255, 98, 66] },
  { at: 150, k: 4600, rgb: [255, 150, 74] },
  { at: 1500, k: 5800, rgb: [255, 212, 118] },
  { at: 12000, k: 7200, rgb: [255, 238, 200] },
  { at: 80000, k: 9800, rgb: [236, 242, 255] },
  { at: 500000, k: 21000, rgb: [168, 198, 255] },
  { at: 3e6, k: 42000, rgb: [126, 158, 255] },
  { at: 2e7, k: 90000, rgb: [196, 140, 255] },
];

/* ---------- Succès (+2 % de dollars chacun) ---------- */
G.ACH_BONUS = 0.02;
G.ACHIEVEMENTS = [
  { id: 'launch1', ok: s => s.sent >= 1 }, { id: 'sent100', ok: s => s.sent >= 100 }, { id: 'sent1k', ok: s => s.sent >= 1000 },
  { id: 'sent10k', ok: s => s.sent >= 10000 }, { id: 'sent100k', ok: s => s.sent >= 100000 },
  { id: 'hire1', ok: s => s.team.collector >= 1 }, { id: 'hire10', ok: s => s.team.collector >= 10 }, { id: 'operator', ok: s => s.team.operator >= 1 },
  { id: 'ship', ok: s => s.ship }, { id: 'pilot1', ok: s => s.team.pilot >= 1 },
  { id: 'lvl5', ok: s => s.level >= 5 }, { id: 'lvl15', ok: s => s.level >= 15 },
  { id: 'gold1', ok: s => s.goldLife >= 1 }, { id: 'gold25', ok: s => s.goldLife >= 25 },
  { id: 'planet1', ok: s => s.saved >= 1 }, { id: 'planet3', ok: s => s.saved >= 3 }, { id: 'planet10', ok: s => s.saved >= 10 },
  { id: 'wreck1', ok: s => s.wrecks >= 1 }, { id: 'jump1', ok: s => s.jumps >= 1 }, { id: 'sunYellow', ok: s => s.sent >= 1500 },
];
