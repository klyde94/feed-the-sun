'use strict';
/* Feed the Sun — données du jeu (équilibrage, textes FR/EN). */
const FTS = (window.FTS = window.FTS || {});

FTS.SAVE_KEY = 'feedthesun.save.v1';
FTS.GROWTH = 1.15;                 // coût ×1,15 par exemplaire
FTS.POLLUTION_BASE = 2500;         // tonnes sur la planète 1
FTS.POLLUTION_GROWTH = 14;         // chaque planète est 14× plus polluée
FTS.VALUE_GROWTH = 1.15;           // et paie 15 % plus cher la tonne
FTS.JUMP_REQ = 3;                  // planètes à sauver avant le saut galactique
FTS.CRYSTAL_BONUS = 0.10;          // +10 % de production par cristal
FTS.ACH_BONUS = 0.02;              // +2 % de production par succès
FTS.SUN_MULT = 1.2;                // ×1,2 crédits par couleur du soleil
FTS.OFFLINE_CAP = 6 * 3600;        // 6 h hors ligne (24 h avec la technologie)

FTS.GENS = [
  { id: 'cannon', cost: 15, prod: 0.2, color: '#9fe8ff',
    name: { fr: 'Canon automatique', en: 'Auto-cannon' },
    desc: { fr: 'Tire de petites capsules de déchets vers le soleil.', en: 'Fires small trash capsules at the sun.' } },
  { id: 'drone', cost: 160, prod: 1.5, color: '#c9f59c',
    name: { fr: 'Drone collecteur', en: 'Collector drone' },
    desc: { fr: 'Ramasse les débris en orbite et les livre au soleil.', en: 'Picks up orbital debris and delivers it to the sun.' } },
  { id: 'shuttle', cost: 1900, prod: 10, color: '#ffd58a',
    name: { fr: 'Navette-benne', en: 'Garbage shuttle' },
    desc: { fr: 'Fait l’aller-retour planète-soleil, pleine à craquer.', en: 'Runs planet-to-sun trips, packed to the brim.' } },
  { id: 'driver', cost: 26000, prod: 70, color: '#ffb27a',
    name: { fr: 'Catapulte magnétique', en: 'Mass driver' },
    desc: { fr: 'Propulse des conteneurs entiers depuis la surface.', en: 'Launches whole containers from the surface.' } },
  { id: 'compactor', cost: 4e5, prod: 450, color: '#ff9b9b',
    name: { fr: 'Compacteur orbital', en: 'Orbital compactor' },
    desc: { fr: 'Écrase les ordures en briques ultra-denses.', en: 'Crushes garbage into ultra-dense bricks.' } },
  { id: 'elevator', cost: 6e6, prod: 3000, color: '#f3a6ff',
    name: { fr: 'Ascenseur spatial', en: 'Space elevator' },
    desc: { fr: 'Un câble géant hisse les déchets hors de l’atmosphère.', en: 'A giant cable hoists trash out of the atmosphere.' } },
  { id: 'beam', cost: 1e8, prod: 20000, color: '#b9a8ff',
    name: { fr: 'Rayon tracteur', en: 'Tractor beam' },
    desc: { fr: 'Aspire la pollution directement dans le soleil.', en: 'Pulls pollution straight into the sun.' } },
  { id: 'wormhole', cost: 1.8e9, prod: 140000, color: '#8fd0ff',
    name: { fr: 'Trou de ver', en: 'Wormhole' },
    desc: { fr: 'Un raccourci de l’espace-temps entre la planète et le soleil.', en: 'A space-time shortcut from planet to sun.' } },
];

FTS.MILESTONES = [10, 25, 50, 100, 200, 300, 400, 500];
FTS.GEN_UPS = [{ req: 1, mul: 10 }, { req: 5, mul: 75 }, { req: 25, mul: 1000 }, { req: 50, mul: 1e5 }];
FTS.MK = ['II', 'III', 'IV', 'V'];

const t2 = (fr, en) => ({ fr, en });

FTS.EXTRA_UPS = [
  { id: 'cap1', kind: 'click', mult: 2, cost: 50, req: s => s.shots >= 10,
    name: t2('Capsule moyenne', 'Medium capsule'), desc: t2('Tes tirs emportent 2× plus de déchets.', 'Your shots carry 2× more trash.') },
  { id: 'cap2', kind: 'click', mult: 2, cost: 600, req: s => s.shots >= 40,
    name: t2('Grosse capsule', 'Large capsule'), desc: t2('Tes tirs emportent 2× plus de déchets.', 'Your shots carry 2× more trash.') },
  { id: 'cap3', kind: 'click', mult: 3, cost: 12000, req: s => s.shots >= 150,
    name: t2('Capsule cargo', 'Cargo capsule'), desc: t2('Tes tirs emportent 3× plus de déchets.', 'Your shots carry 3× more trash.') },
  { id: 'cap4', kind: 'click', mult: 3, cost: 1.5e6, req: s => s.shots >= 400,
    name: t2('Capsule titan', 'Titan capsule'), desc: t2('Tes tirs emportent 3× plus de déchets.', 'Your shots carry 3× more trash.') },
  { id: 'cap5', kind: 'click', mult: 5, cost: 2e8, req: s => s.shots >= 1000,
    name: t2('Capsule à fusion', 'Fusion capsule'), desc: t2('Tes tirs emportent 5× plus de déchets.', 'Your shots carry 5× more trash.') },
  { id: 'sync1', kind: 'clickPct', add: 0.02, cost: 2e4, req: s => FTS.C.totalGens(s) >= 15,
    name: t2('Canon synchronisé', 'Synced cannon'), desc: t2('Chaque tir ajoute 2 % de ta production par seconde.', 'Each shot adds 2% of your production per second.') },
  { id: 'sync2', kind: 'clickPct', add: 0.03, cost: 5e6, req: s => FTS.C.totalGens(s) >= 60,
    name: t2('Visée assistée', 'Assisted aiming'), desc: t2('Chaque tir ajoute 3 % de ta production par seconde.', 'Each shot adds 3% of your production per second.') },
  { id: 'sync3', kind: 'clickPct', add: 0.05, cost: 5e8, req: s => FTS.C.totalGens(s) >= 150,
    name: t2('Canon jumeau', 'Twin cannon'), desc: t2('Chaque tir ajoute 5 % de ta production par seconde.', 'Each shot adds 5% of your production per second.') },
  { id: 'log1', kind: 'prod', mult: 1.25, cost: 20000, req: s => s.planet >= 1,
    name: t2('Logistique de flotte', 'Fleet logistics'), desc: t2('Toute la flotte produit 25 % de plus.', 'The whole fleet produces 25% more.') },
  { id: 'log2', kind: 'prod', mult: 1.5, cost: 2e7, req: s => s.planet >= 2,
    name: t2('Réseau de balises', 'Beacon network'), desc: t2('Toute la flotte produit 50 % de plus.', 'The whole fleet produces 50% more.') },
  { id: 'log3', kind: 'prod', mult: 2, cost: 1e10, req: s => s.planet >= 4,
    name: t2('IA de coordination', 'Coordination AI'), desc: t2('Toute la flotte produit 2× plus.', 'The whole fleet produces 2× more.') },
  { id: 'val1', kind: 'value', mult: 1.5, cost: 1e5, req: s => s.tonnesRun >= 2e4,
    name: t2('Tri sélectif', 'Sorting line'), desc: t2('Chaque tonne rapporte 50 % de crédits en plus.', 'Each ton pays 50% more credits.') },
  { id: 'val2', kind: 'value', mult: 2, cost: 5e8, req: s => s.tonnesRun >= 5e6,
    name: t2('Contrat galactique', 'Galactic contract'), desc: t2('Chaque tonne rapporte 2× plus de crédits.', 'Each ton pays 2× more credits.') },
  { id: 'wr1', kind: 'wreckRate', mult: 1.5, cost: 25000, req: s => s.wrecks >= 1,
    name: t2('Radar à épaves', 'Wreck radar'), desc: t2('Les épaves scintillantes passent 50 % plus souvent.', 'Glittering wrecks show up 50% more often.') },
  { id: 'wr2', kind: 'buffDur', mult: 1.5, cost: 2.5e6, req: s => s.wrecks >= 4,
    name: t2('Aimant longue portée', 'Long-range magnet'), desc: t2('Les bonus des épaves durent 50 % plus longtemps.', 'Wreck bonuses last 50% longer.') },
  { id: 'syn1', kind: 'syn', target: 2, source: 0, per: 0.01, cost: 60000, req: s => s.gens[0] >= 25 && s.gens[2] >= 10,
    name: t2('Canons d’escorte', 'Escort cannons'), desc: t2('Navettes-bennes : +1 % par Canon automatique.', 'Garbage shuttles: +1% per Auto-cannon.') },
  { id: 'syn2', kind: 'syn', target: 4, source: 1, per: 0.005, cost: 8e6, req: s => s.gens[1] >= 50 && s.gens[4] >= 10,
    name: t2('Essaim de compactage', 'Compaction swarm'), desc: t2('Compacteurs : +0,5 % par Drone collecteur.', 'Compactors: +0.5% per Collector drone.') },
];

/* Planètes : nom pollué → nom une fois sauvée. Couleurs : océan, terres (propres). */
FTS.PLANETS = [
  { bad: 'Ordura', good: 'Aurora', sea: '#2f6fa8', land: '#55a36f' },
  { bad: 'Smogon', good: 'Selena', sea: '#2b7d9a', land: '#7fae5a' },
  { bad: 'Plastika', good: 'Pacifica', sea: '#2560b8', land: '#4f9d8a' },
  { bad: 'Rouillor', good: 'Floralis', sea: '#3a6fa0', land: '#8fb35a' },
  { bad: 'Toxia', good: 'Thalassa', sea: '#1f78a8', land: '#5ab07a' },
  { bad: 'Ferraille', good: 'Verdance', sea: '#2d6aa0', land: '#3f9a52' },
  { bad: 'Fumerolle', good: 'Azura', sea: '#2a84b8', land: '#7aa86a' },
  { bad: 'Mazoutia', good: 'Marina', sea: '#1d6ab0', land: '#68a87a' },
  { bad: 'Décharge-9', good: 'Eden-9', sea: '#2f74a0', land: '#4caf6a' },
  { bad: 'Cendria', good: 'Celestia', sea: '#3168b0', land: '#86b866' },
];

/* Le soleil se réchauffe avec les déchets incinérés (cumul de toutes les parties). */
FTS.SUN = [
  { at: 0, k: 3200, rgb: [255, 98, 66], name: t2('Naine rouge', 'Red dwarf') },
  { at: 2e3, k: 4600, rgb: [255, 150, 74], name: t2('Étoile orange', 'Orange star') },
  { at: 1e5, k: 5800, rgb: [255, 212, 118], name: t2('Naine jaune', 'Yellow dwarf') },
  { at: 1e7, k: 7200, rgb: [255, 238, 200], name: t2('Étoile blanc-jaune', 'Yellow-white star') },
  { at: 1e9, k: 9800, rgb: [236, 242, 255], name: t2('Étoile blanche', 'White star') },
  { at: 1e11, k: 21000, rgb: [168, 198, 255], name: t2('Géante bleu-blanc', 'Blue-white giant') },
  { at: 1e13, k: 42000, rgb: [126, 158, 255], name: t2('Géante bleue', 'Blue giant') },
  { at: 1e15, k: 90000, rgb: [196, 140, 255], name: t2('Étoile étrange', 'Strange star') },
  { at: 1e17, k: 0, rgb: [255, 255, 255], prism: true, name: t2('Étoile prismatique', 'Prismatic star') },
];

FTS.RELICS = [
  { id: 'autopilot', cost: 3, name: t2('Pilote automatique', 'Autopilot'),
    desc: t2('Le vaisseau part seul vers la planète suivante, même hors ligne.', 'Your ship travels to the next planet on its own, even offline.') },
  { id: 'fleet', cost: 3, name: t2('Flotte de départ', 'Starter fleet'),
    desc: t2('Chaque galaxie commence avec 10 Canons et 5 Drones.', 'Each galaxy starts with 10 Cannons and 5 Drones.') },
  { id: 'gatling', cost: 4, name: t2('Gâchette automatique', 'Auto trigger'),
    desc: t2('Ton canon tire tout seul 2 fois par seconde.', 'Your cannon fires on its own twice per second.') },
  { id: 'detector', cost: 5, name: t2('Détecteur d’épaves', 'Wreck detector'),
    desc: t2('Les épaves passent 2× plus souvent.', 'Wrecks show up 2× more often.') },
  { id: 'offline', cost: 6, name: t2('Moteur de veille', 'Standby engine'),
    desc: t2('Gains hors ligne jusqu’à 24 h au lieu de 6 h.', 'Offline gains for up to 24 h instead of 6 h.') },
  { id: 'quantum', cost: 7, name: t2('Capsules quantiques', 'Quantum capsules'),
    desc: t2('Tes tirs emportent 10× plus de déchets.', 'Your shots carry 10× more trash.') },
  { id: 'factory', cost: 8, name: t2('Usine autonome', 'Autonomous factory'),
    desc: t2('Achète la flotte toute seule (sans jamais dépenser plus de la moitié de tes crédits).', 'Buys fleet units on its own (never spends more than half your credits).') },
  { id: 'sunmem', cost: 10, name: t2('Mémoire solaire', 'Solar memory'),
    desc: t2('Chaque tonne rapporte 2× plus de crédits.', 'Each ton pays 2× more credits.') },
  { id: 'office', cost: 12, name: t2('Bureau d’études', 'Design office'),
    desc: t2('Achète les améliorations tout seul (moitié des crédits au maximum).', 'Buys upgrades on its own (half your credits at most).') },
  { id: 'forge', cost: 40, name: t2('Forge des paliers', 'Milestone forge'),
    desc: t2('Les paliers de la flotte donnent ×3 au lieu de ×2.', 'Fleet milestones give ×3 instead of ×2.') },
];

const C_ = () => FTS.C;
FTS.ACHIEVEMENTS = [
  { id: 'shot1', name: t2('Premier tir', 'First shot'), desc: t2('Tirer une capsule.', 'Fire one capsule.'), ok: s => s.shots >= 1 },
  { id: 'shot100', name: t2('Gâchette facile', 'Trigger happy'), desc: t2('Tirer 100 capsules.', 'Fire 100 capsules.'), ok: s => s.shots >= 100 },
  { id: 'shot1k', name: t2('Artilleur', 'Gunner'), desc: t2('Tirer 1 000 capsules.', 'Fire 1,000 capsules.'), ok: s => s.shots >= 1000 },
  { id: 't1k', name: t2('Petit ménage', 'Light cleaning'), desc: t2('Incinérer 1 000 t.', 'Burn 1,000 t.'), ok: s => s.tonnesLife >= 1e3 },
  { id: 't1m', name: t2('Grand ménage', 'Deep cleaning'), desc: t2('Incinérer 1 million de t.', 'Burn 1 million t.'), ok: s => s.tonnesLife >= 1e6 },
  { id: 't1b', name: t2('Éboueur céleste', 'Celestial binman'), desc: t2('Incinérer 1 milliard de t.', 'Burn 1 billion t.'), ok: s => s.tonnesLife >= 1e9 },
  { id: 't1t', name: t2('Fournaise', 'Furnace'), desc: t2('Incinérer 10¹² t.', 'Burn 10¹² t.'), ok: s => s.tonnesLife >= 1e12 },
  { id: 'tps10', name: t2('Ça tourne', 'Up and running'), desc: t2('Produire 10 t/s.', 'Produce 10 t/s.'), ok: s => C_().tps(s, false) >= 10 },
  { id: 'tps1k', name: t2('Chaîne logistique', 'Supply chain'), desc: t2('Produire 1 000 t/s.', 'Produce 1,000 t/s.'), ok: s => C_().tps(s, false) >= 1e3 },
  { id: 'tps1m', name: t2('Industrie stellaire', 'Stellar industry'), desc: t2('Produire 1 million de t/s.', 'Produce 1 million t/s.'), ok: s => C_().tps(s, false) >= 1e6 },
  { id: 'gen1', name: t2('Renfort', 'Backup'), desc: t2('Acheter un premier engin.', 'Buy your first unit.'), ok: s => C_().totalGens(s) >= 1 },
  { id: 'gen50', name: t2('Escadrille', 'Squadron'), desc: t2('Posséder 50 engins.', 'Own 50 units.'), ok: s => C_().totalGens(s) >= 50 },
  { id: 'gen200', name: t2('Armada', 'Armada'), desc: t2('Posséder 200 engins.', 'Own 200 units.'), ok: s => C_().totalGens(s) >= 200 },
  { id: 'gen500', name: t2('Nuée', 'Swarm'), desc: t2('Posséder 500 engins.', 'Own 500 units.'), ok: s => C_().totalGens(s) >= 500 },
  { id: 'one100', name: t2('Centurion', 'Centurion'), desc: t2('Posséder 100 exemplaires d’un même engin.', 'Own 100 of a single unit.'), ok: s => s.gens.some(n => n >= 100) },
  { id: 'all8', name: t2('Flotte complète', 'Full fleet'), desc: t2('Posséder au moins un engin de chaque type.', 'Own at least one of every unit.'), ok: s => s.gens.every(n => n >= 1) },
  { id: 'planet1', name: t2('Première planète', 'First planet'), desc: t2('Sauver une planète.', 'Save a planet.'), ok: s => s.cleanedLife >= 1 },
  { id: 'planet5', name: t2('Écologiste', 'Ecologist'), desc: t2('Sauver 5 planètes.', 'Save 5 planets.'), ok: s => s.cleanedLife >= 5 },
  { id: 'planet15', name: t2('Jardinier des étoiles', 'Star gardener'), desc: t2('Sauver 15 planètes.', 'Save 15 planets.'), ok: s => s.cleanedLife >= 15 },
  { id: 'wreck1', name: t2('Récupérateur', 'Scavenger'), desc: t2('Récupérer une épave.', 'Salvage a wreck.'), ok: s => s.wrecks >= 1 },
  { id: 'wreck10', name: t2('Ferrailleur', 'Scrapper'), desc: t2('Récupérer 10 épaves.', 'Salvage 10 wrecks.'), ok: s => s.wrecks >= 10 },
  { id: 'wreck50', name: t2('Chasseur d’épaves', 'Wreck hunter'), desc: t2('Récupérer 50 épaves.', 'Salvage 50 wrecks.'), ok: s => s.wrecks >= 50 },
  { id: 'jump1', name: t2('Hyperespace', 'Hyperspace'), desc: t2('Faire un saut galactique.', 'Make a galactic jump.'), ok: s => s.jumps >= 1 },
  { id: 'jump5', name: t2('Vagabond galactique', 'Galactic drifter'), desc: t2('Faire 5 sauts galactiques.', 'Make 5 galactic jumps.'), ok: s => s.jumps >= 5 },
  { id: 'sunG', name: t2('Soleil jaune', 'Yellow sun'), desc: t2('Faire passer ton soleil au jaune.', 'Turn your sun yellow.'), ok: s => C_().sunStage(s) >= 2 },
  { id: 'sunA', name: t2('Lumière blanche', 'White light'), desc: t2('Faire passer ton soleil au blanc.', 'Turn your sun white.'), ok: s => C_().sunStage(s) >= 4 },
  { id: 'sunO', name: t2('Feu bleu', 'Blue fire'), desc: t2('Faire passer ton soleil au bleu.', 'Turn your sun blue.'), ok: s => C_().sunStage(s) >= 6 },
  { id: 'ups10', name: t2('Ingénieur', 'Engineer'), desc: t2('Posséder 10 améliorations.', 'Own 10 upgrades.'), ok: s => Object.keys(s.ups).length >= 10 },
  { id: 'ups30', name: t2('Architecte', 'Architect'), desc: t2('Posséder 30 améliorations.', 'Own 30 upgrades.'), ok: s => Object.keys(s.ups).length >= 30 },
  { id: 'away', name: t2('Patience cosmique', 'Cosmic patience'), desc: t2('Revenir après au moins 1 h d’absence.', 'Come back after at least 1 h away.'), ok: s => s.longestAway >= 3600 },
];
