'use strict';
/* Feed the Sun v3 — étape 1 (phase au sol) : réglages et textes FR/EN.
   Unités du monde : l'écran fait 100 unités de haut, le monde 360 de large. */
const G = (window.FTS3 = window.FTS3 || {});

G.SAVE_KEY = 'feedthesun.v3.save';
G.WORLD_W = 260;
G.BASE_X = 24;            // conteneur
G.RAMP_X = 9;             // rampe de lancement
G.GROUND_TOP = 75;
G.GROUND_BOTTOM = 94;
G.VISIBLE_MAX = 34;       // déchets visibles au sol en même temps
G.SPEED = 26;             // vitesse de marche de base (unités/s)
G.FULL_BONUS = 1.1;       // conteneur plein : +10 %

G.JUNK = {
  bag: { value: 1, size: 2.6, col: [214, 210, 196] },
  can: { value: 1, size: 1.9, col: [196, 72, 60] },
  bottle: { value: 1, size: 2.1, col: [150, 200, 220] },
  tire: { value: 3, size: 3, col: [52, 50, 48] },
  barrel: { value: 5, size: 3.1, col: [204, 156, 52] },
  fridge: { value: 8, size: 3.6, col: [226, 226, 218] },
};
G.JUNK_WEIGHTS = [['bag', 30], ['can', 24], ['bottle', 20], ['tire', 12], ['barrel', 9], ['fridge', 5]];

G.planetItems = n => Math.round(240 * Math.pow(2.2, n));
G.planetValue = n => Math.pow(1.6, n);

G.PLANETS = [
  { bad: 'Ordura', good: 'Aurora', grass: [86, 160, 96], sky: [96, 170, 230] },
  { bad: 'Smogon', good: 'Selena', grass: [120, 170, 84], sky: [80, 160, 200] },
  { bad: 'Plastika', good: 'Pacifica', grass: [70, 150, 120], sky: [70, 130, 220] },
  { bad: 'Rouillor', good: 'Floralis', grass: [140, 176, 88], sky: [110, 160, 220] },
  { bad: 'Toxia', good: 'Thalassa', grass: [84, 170, 110], sky: [60, 150, 210] },
];

const t2 = (fr, en) => ({ fr, en });
G.UPGRADES = [
  { id: 'bag', base: 12, growth: 1.55, max: 20, eff: l => 5 + 2 * l,
    name: t2('Sac plus grand', 'Bigger bag'), desc: t2('+2 places dans ton sac.', '+2 slots in your bag.'), unit: t2('{v} places', '{v} slots') },
  { id: 'boots', base: 18, growth: 1.6, max: 15, eff: l => 1 + 0.12 * l,
    name: t2('Bottes rapides', 'Fast boots'), desc: t2('Tu marches 12 % plus vite.', 'You walk 12% faster.'), unit: t2('×{v} vitesse', '×{v} speed') },
  { id: 'container', base: 25, growth: 1.6, max: 20, eff: l => 20 + 10 * l,
    name: t2('Conteneur plus grand', 'Bigger container'), desc: t2('+10 places dans le conteneur.', '+10 slots in the container.'), unit: t2('{v} places', '{v} slots') },
  { id: 'magnet', base: 40, growth: 1.7, max: 10, eff: l => 3 + 1.4 * l,
    name: t2('Pince à long manche', 'Long grabber'), desc: t2('Tu attrapes les déchets de plus loin.', 'You grab trash from further away.'), unit: t2('portée {v}', 'reach {v}') },
  { id: 'ramp', base: 60, growth: 1.75, max: 20, eff: l => 1 + 0.15 * l,
    name: t2('Rampe renforcée', 'Reinforced ramp'), desc: t2('Chaque conteneur rapporte 15 % de plus.', 'Each container pays 15% more.'), unit: t2('×{v} dollars', '×{v} dollars') },
];

/* Le soleil change de couleur avec le nombre de déchets envoyés (toutes planètes confondues). */
G.SUN = [
  { at: 0, k: 3200, rgb: [255, 98, 66], name: t2('Naine rouge', 'Red dwarf') },
  { at: 150, k: 4600, rgb: [255, 150, 74], name: t2('Étoile orange', 'Orange star') },
  { at: 1500, k: 5800, rgb: [255, 212, 118], name: t2('Naine jaune', 'Yellow dwarf') },
  { at: 12000, k: 7200, rgb: [255, 238, 200], name: t2('Étoile blanc-jaune', 'Yellow-white star') },
  { at: 80000, k: 9800, rgb: [236, 242, 255], name: t2('Étoile blanche', 'White star') },
];

G.I18N = {
  fr: {
    money: 'dollars', sent: 'déchets envoyés', planetN: 'Planète {n}', pollution: 'Pollution', left: '{n} déchets restants',
    launch: 'Lancer', launchKey: 'Entrée', bag: 'Sac', container: 'Conteneur',
    tabGear: 'Équipement', tabTeam: 'Équipe', tabOpt: 'Options',
    lvl: 'Niv. {n}', maxed: 'Au maximum', now: 'Actuel : {v}',
    teamTitle: 'Tes employés arrivent à l’étape 2',
    teamText: 'Bientôt, tu pourras embaucher des éboueurs qui ramassent à ta place, puis un conducteur de rampe qui lance les conteneurs tout seul. Ils te suivront de planète en planète.',
    teamCard1: 'Éboueur', teamCard1d: 'Ramasse les déchets et remplit le conteneur.', teamCard2: 'Conducteur de rampe', teamCard2d: 'Lance chaque conteneur plein.', soon: 'Étape 2',
    lang: 'Langue', sound: 'Son', on: 'Activé', off: 'Coupé', controls: 'Commandes',
    controlsText: 'Clique ou touche le sol pour marcher. Clavier : ZQSD ou flèches. Entrée : lancer le conteneur.',
    resetTitle: 'Recommencer de zéro', resetBtn: 'Effacer ma partie', resetConfirm: 'Effacer définitivement ta partie ?', resetText: 'Tout sera perdu.', resetGo: 'Tout effacer', cancel: 'Annuler',
    stats: 'Statistiques', stTime: 'Temps de jeu', stSent: 'Déchets envoyés', stMoney: 'Dollars gagnés', stPlanets: 'Planètes sauvées',
    hint0: 'Clique sur un déchet (ou utilise ZQSD) pour aller le ramasser.',
    hint1: 'Sac plein ! Ramène-le au conteneur, tout à gauche.',
    hint2: 'Lance le conteneur vers le soleil : bouton Lancer ou touche Entrée.',
    hint3: 'Ouvre l’Équipement et achète un sac plus grand.',
    bagFull: 'Sac plein', contFull: 'Conteneur plein : lance-le !',
    launchToast: '+{m} $', fullBonus: 'Conteneur plein : +10 %',
    cleanTitle: '{name} est sauvée !', cleanText: 'L’ancienne {old} respire à nouveau. Prochaine planète : {next}, plus sale mais mieux payée.', travel: 'Cap sur {next}',
    sunToast: 'Ton soleil change de couleur', sunText: '{name}, {k} K',
    introTitle: 'Mission : nettoyer Ordura', introText1: 'Ordura étouffe sous les ordures. Tu commences seul, avec un sac et un conteneur.',
    introText2: 'Ramasse les déchets, vide ton sac dans le conteneur, puis lance-le droit dans le soleil. Chaque conteneur rapporte des dollars.',
    introGo: 'C’est parti', version: 'Version 3, étape 1 : la phase au sol', oldVersion: 'Jouer à la v2', plan: 'Voir le plan du jeu',
    h: 'h', min: 'min', s: 's',
  },
  en: {
    money: 'dollars', sent: 'trash sent', planetN: 'Planet {n}', pollution: 'Pollution', left: '{n} pieces of trash left',
    launch: 'Launch', launchKey: 'Enter', bag: 'Bag', container: 'Container',
    tabGear: 'Gear', tabTeam: 'Team', tabOpt: 'Options',
    lvl: 'Lv. {n}', maxed: 'Maxed out', now: 'Now: {v}',
    teamTitle: 'Your crew arrives in step 2',
    teamText: 'Soon you will hire binmen who pick up trash for you, then a ramp operator who launches containers on their own. They will follow you from planet to planet.',
    teamCard1: 'Binman', teamCard1d: 'Picks up trash and fills the container.', teamCard2: 'Ramp operator', teamCard2d: 'Launches every full container.', soon: 'Step 2',
    lang: 'Language', sound: 'Sound', on: 'On', off: 'Off', controls: 'Controls',
    controlsText: 'Click or tap the ground to walk. Keyboard: WASD or arrows. Enter: launch the container.',
    resetTitle: 'Start over', resetBtn: 'Erase my game', resetConfirm: 'Erase your game for good?', resetText: 'Everything will be lost.', resetGo: 'Erase everything', cancel: 'Cancel',
    stats: 'Statistics', stTime: 'Play time', stSent: 'Trash sent', stMoney: 'Dollars earned', stPlanets: 'Planets saved',
    hint0: 'Click a piece of trash (or use WASD) to go and pick it up.',
    hint1: 'Bag full! Bring it back to the container, far left.',
    hint2: 'Launch the container into the sun: Launch button or Enter key.',
    hint3: 'Open your Gear and buy a bigger bag.',
    bagFull: 'Bag full', contFull: 'Container full: launch it!',
    launchToast: '+{m} $', fullBonus: 'Full container: +10%',
    cleanTitle: '{name} is saved!', cleanText: 'What used to be {old} can breathe again. Next planet: {next}, dirtier but better paid.', travel: 'Set course for {next}',
    sunToast: 'Your sun changes color', sunText: '{name}, {k} K',
    introTitle: 'Mission: clean up Ordura', introText1: 'Ordura is choking on garbage. You start alone, with a bag and a container.',
    introText2: 'Pick up trash, empty your bag into the container, then launch it straight into the sun. Every container pays dollars.',
    introGo: 'Let’s go', version: 'Version 3, step 1: the ground phase', oldVersion: 'Play v2', plan: 'See the game plan',
    h: 'h', min: 'min', s: 's',
  },
};
