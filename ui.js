'use strict';
/* Feed the Sun v3 — interface : jeu en plein écran, trois boutons (Améliorer, Arbre, Réglages) qui ouvrent une page en bas,
   commandes, sons, événements, sauvegarde, installation, démarrage. */
(function () {
  const G = window.FTS3, Wd = G.W, R = G.R, O = G.O, P = G.P;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  let s = null, lang = 'fr', tab = null, deferredInstall = null;

  /* ---------- Textes et nombres ---------- */
  const T = (k, v) => { let str = G.I18N[lang][k]; if (str == null) str = G.I18N.fr[k]; if (str == null) str = k; if (v) for (const x in v) str = String(str).split('{' + x + '}').join(v[x]); return str; };
  const SUF = { fr: ['', 'k', 'M', 'Md', 'Bn', 'Bd', 'Tn'], en: ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'] };
  const loc = str => (lang === 'fr' ? str.replace('.', ',') : str);
  const fmt = n => {
    n = Math.max(0, n);
    if (n < 1e4) return Math.floor(n).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
    const e = Math.min(6, Math.floor(Math.log10(n) / 3)), v = n / Math.pow(1000, e);
    return loc(v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0)) + ' ' + SUF[lang][e];
  };
  const fmtNum = v => loc(String(Math.round(v * 100) / 100));
  const fmtTime = sec => { sec = Math.floor(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, x = sec % 60; return h ? h + ' ' + T('h') + ' ' + m + ' ' + T('min') : m ? m + ' ' + T('min') + ' ' + x + ' ' + T('s') : x + ' ' + T('s'); };
  const roman = n => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || String(n);
  const A = id => (G.I18N[lang].ach[id] || G.I18N.fr.ach[id]);

  /* ---------- Sons synthétisés ---------- */
  let ac = null; const lastSfx = {};
  function sfx(type) {
    if (!s || !s.settings.sound) return;
    const now = performance.now(); if (now - (lastSfx[type] || 0) < 60) return; lastSfx[type] = now;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const p = { pickup: [600, 900, 0.07, 0.03, 'sine'], combo: [700, 1100, 0.08, 0.035, 'sine'], dump: [220, 160, 0.06, 0.035, 'triangle'], launch: [120, 520, 0.7, 0.05, 'sawtooth'],
        buy: [520, 780, 0.09, 0.04, 'sine'], full: [440, 330, 0.18, 0.035, 'square'], clean: [330, 660, 0.9, 0.07, 'sine'], sun: [220, 440, 1.2, 0.06, 'sine'],
        gold: [880, 1320, 0.25, 0.05, 'sine'], level: [440, 880, 0.5, 0.06, 'triangle'], learn: [660, 990, 0.3, 0.05, 'sine'], hire: [392, 523, 0.25, 0.05, 'triangle'],
        wreck: [990, 1480, 0.3, 0.05, 'sine'], open: [300, 420, 0.08, 0.03, 'sine'] }[type];
      if (!p) return;
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = p[4]; o.frequency.setValueAtTime(p[0], t); o.frequency.exponentialRampToValueAtTime(p[1], t + p[2]);
      g.gain.setValueAtTime(p[3], t); g.gain.exponentialRampToValueAtTime(0.0001, t + p[2]);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + p[2] + 0.02);
    } catch (e) { /* audio indisponible */ }
  }

  /* ---------- Toasts et fenêtre ---------- */
  function toast(title, text, kind) {
    const box = $('toasts');
    while (box.children.length >= 3) box.firstChild.remove();
    const t = el('div', 'toast' + (kind ? ' toast-' + kind : '')); t.append(el('div', 'toast-title', title), el('div', 'toast-text', text || ''));
    box.append(t); setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3800);
  }
  function modal(title, lines, actions) {
    $('modalTitle').textContent = title;
    const b = $('modalBody'); b.innerHTML = ''; lines.forEach(p => b.append(el('p', null, p)));
    const a = $('modalActions'); a.innerHTML = '';
    actions.forEach(x => { const btn = el('button', 'btn ' + (x.cls || ''), x.label); btn.type = 'button'; btn.onclick = () => { $('modal').hidden = true; if (x.fn) x.fn(); }; a.append(btn); });
    $('modal').hidden = false; const f = a.querySelector('button'); if (f) f.focus();
  }

  /* ---------- Installation (application) ---------- */
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (tab === 'opt') P.render(true); });
  const canInstall = () => !!deferredInstall;
  const install = () => { if (!deferredInstall) return; deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; P.render(true); }); };
  if ('serviceWorker' in navigator && location.protocol === 'https:' && /github\.io$/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(() => {});

  G.U = { T, fmt, fmtNum, fmtTime, roman, A, sfx, toast, modal, state: () => s, tab: () => tab, lang: () => lang, setLang: k => setLang(k), canInstall, install,
    reset: () => { Wd.wipe(); s = Wd.fresh(); s.settings.lang = lang; Wd.reset(s); closeSheet(); afterLoad(); } };

  /* ---------- La page du bas ---------- */
  function openSheet(name) {
    if (tab === name) { closeSheet(); return; }
    tab = name; sfx('open');
    $('sheet').hidden = false; $('sheet').dataset.tab = name;
    $('sheetTitle').textContent = T(name === 'shop' ? 'tabShop' : name === 'tree' ? 'tabTree' : 'tabOpt');
    document.querySelectorAll('[data-open]').forEach(b => b.classList.toggle('is-on', b.dataset.open === name));
    $('sheetBody').scrollTop = 0; P.render(true);
    requestAnimationFrame(() => $('sheet').classList.add('is-open'));
  }
  function closeSheet() {
    tab = null; $('sheet').classList.remove('is-open');
    document.querySelectorAll('[data-open]').forEach(b => b.classList.remove('is-on'));
    setTimeout(() => { if (!tab) $('sheet').hidden = true; }, 220);
  }
  function setLang(k) {
    lang = k; s.settings.lang = k; document.documentElement.lang = k;
    document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = T(e.dataset.i18n); });
    if (tab) { $('sheetTitle').textContent = T(tab === 'shop' ? 'tabShop' : tab === 'tree' ? 'tabTree' : 'tabOpt'); P.render(true); }
  }
  function setView(v) {
    if (v === 'orbit' && !s.ship) return;
    s.view = v; Wd.input.x = Wd.input.y = 0;
    if (v === 'orbit' && !s.seenOrbit) { s.seenOrbit = true; toast(T('orbit'), T('hintOrbit')); }
  }

  /* ---------- Affichage ---------- */
  let lastStage = -1;
  function hud() {
    const z = s.view, info = Wd.planetInfo(s);
    $('money').textContent = fmt(s.money);
    $('lvlRow').hidden = s.level < 2;
    $('lvlTxt').textContent = T('level', { n: s.level }); $('xpBar').style.width = Math.min(100, (s.xp / G.xpNeed(s.level)) * 100) + '%';
    $('ptsTxt').textContent = (s.skillPts ? '✦ ' + s.skillPts + '  ' : '') + (s.techPts ? '★ ' + s.techPts : '');
    const m = Wd.mission(s);
    $('missionText').textContent = m ? T('mission.' + m.id, { n: m.need }) + (m.need > 1 ? ' · ' + m.val + '/' + m.need : '') : T('missionAll');
    $('missionReward').textContent = m && m.cash ? '+' + fmt(m.cash) + ' $' : '';
    $('missionBar').style.width = (m ? (m.val / m.need) * 100 : 100) + '%';
    $('planetName').textContent = s.awaitingTravel ? info.good : info.bad;
    const stage = Wd.sunStage(s), poll = Wd.pollution(s) * 100;
    if (lastStage >= 0 && stage > lastStage) { toast(T('sunToast'), G.I18N[lang].sun[stage], 'sun'); R.fxSunUp(); if (O.fxSunUp) O.fxSunUp(); sfx('sun'); }
    lastStage = stage;
    document.documentElement.style.setProperty('--sun', 'rgb(' + R.sunColor().join(',') + ')');
    $('pollTxt').textContent = (poll > 0 && poll < 1 ? loc(poll.toFixed(1)) : Math.ceil(poll)) + ' %'; $('pollBar').style.width = poll + '%';
    const cc = Wd.contCap(s, z), cont = s.cont[z].length, lb = $('launchBtn');
    lb.disabled = !cont || Wd.Z[z].launching > 0; lb.classList.toggle('is-full', cont >= cc);
    lb.querySelector('span').textContent = T('launch') + (cont ? ' · ' + fmt(Wd.contValue(s, z)) + ' $' : '');
    $('viewSeg').hidden = !s.ship;
    $('viewGround').classList.toggle('is-on', z === 'ground'); $('viewOrbit').classList.toggle('is-on', z === 'orbit');
    $('boost').hidden = !(s.frenzy > 0); if (s.frenzy > 0) $('boost').textContent = '×2 · ' + Math.ceil(s.frenzy) + ' s';
    $('banner').hidden = !s.awaitingTravel;
    if (s.awaitingTravel) {
      const next = Wd.planetInfo(s, s.planet + 1);
      $('bannerTitle').textContent = T('cleanTitle', { name: info.good }); $('bannerText').textContent = T('cleanText', { old: info.bad, next: next.bad }); $('travelBtn').textContent = T('travel', { next: next.bad });
    }
    const d = P.dots(s); for (const k in d) { const e = $('dot-' + k); if (e) e.hidden = !d[k]; }
    const h = $('hint'), key = R.wreck && !s.wrecks ? 'hintWreck' : null;
    h.hidden = !key; if (key && h.dataset.k !== key + lang) { h.textContent = T(key); h.dataset.k = key + lang; }
  }

  /* ---------- Événements du moteur ---------- */
  Wd.on('pickup', e => { if (e.who === 'me') { R.fxPickup(e); sfx(e.combo >= 3 ? 'combo' : 'pickup'); if (e.z === 'ground') R.fxCombo(e.combo); } });
  Wd.on('mission', e => { sfx('level'); toast(T('missionDone') + (e.cash ? ' · +' + fmt(e.cash) + ' $' : ''), T('mission.' + e.id, { n: (G.MISSIONS.find(m => m.id === e.id) || {}).need }), 'ach'); if (tab) P.render(true); });
  Wd.on('full', () => sfx('full'));
  Wd.on('dump', e => { R.fxDump(e); if (e.who === 'me') sfx('dump'); });
  Wd.on('contFull', z => { if (z === s.view && !(z === 'ground' ? s.team.operator : s.team.gunner)) toast(T('contFull'), '', 'sun'); });
  Wd.on('launch', e => {
    const label = fmt(e.money);
    if (e.z === s.view) { (e.z === 'ground' ? R : O).fxLaunch(Object.assign({ label }, e)); if (!e.auto || Math.random() < 0.3) sfx('launch'); }
    if (e.full && !e.auto) toast('+' + label + ' $', T('fullBonus'), 'sun');
  });
  Wd.on('ship', () => { sfx('hire'); toast(T('buyShip'), T('hintOrbit'), 'sun'); });
  Wd.on('district', id => { sfx('clean'); toast(T('districtOpen', { name: T('district.' + id) }), T('district.' + id + '.d'), 'sun'); });
  Wd.on('hire', id => { sfx('hire'); toast(T('hireToast', { name: T('hire.' + id) }), T('hire.' + id + '.d')); });
  Wd.on('gold', e => { sfx('gold'); if (e.who === 'me') { R.fxGold(); toast(T('goldToast'), T('goldText', { n: e.n }), 'sun'); } });
  Wd.on('level', n => { sfx('level'); toast(T('levelUp', { n }), T('levelUpText'), 'ach'); });
  Wd.on('crewLevel', e => { if (e.lvl % 5 === 0) toast(T('empLevel', { n: e.lvl }), ''); });
  Wd.on('cleaned', () => { R.fxClean(); sfx('clean'); });
  Wd.on('travel', () => R.fxTravel());
  Wd.on('salvage', r => { sfx('wreck'); toast(r.type === 'cargo' ? T('cargo', { m: fmt(r.money) }) : r.type === 'frenzy' ? T('frenzy', { s: r.secs }) : T('goldRain'), '', 'sun'); });
  Wd.on('jump', g => { R.fxJump(); sfx('clean'); toast(T('jumpToast', { g: roman(s.jumps + 1) }), T('jumpToastText', { n: g }), 'sun'); });
  Wd.on('ach', id => { sfx('learn'); toast(T('achToast'), A(id)[0], 'ach'); });

  /* ---------- Commandes ---------- */
  const keys = new Set();
  const KEYMAP = { KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0], KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1] };
  const syncKeys = () => { let x = 0, y = 0; keys.forEach(c => { x += KEYMAP[c][0]; y += KEYMAP[c][1]; }); Wd.input.x = Math.sign(x); Wd.input.y = Math.sign(y); };
  const typing = () => { const t = document.activeElement && document.activeElement.tagName; return t === 'INPUT' || t === 'TEXTAREA'; };
  function bindInputs() {
    document.addEventListener('keydown', e => {
      if (typing()) return;
      if (e.key === 'Escape') { if (!$('modal').hidden) $('modal').hidden = true; else if (tab) closeSheet(); return; }
      if (!$('modal').hidden) return;
      if (KEYMAP[e.code]) { keys.add(e.code); syncKeys(); e.preventDefault(); }
      else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat && document.activeElement.tagName !== 'BUTTON') { Wd.launch(s, s.view); e.preventDefault(); }
      else if (e.code === 'Tab' && s.ship) { setView(s.view === 'ground' ? 'orbit' : 'ground'); e.preventDefault(); }
    });
    document.addEventListener('keyup', e => { if (keys.delete(e.code)) syncKeys(); });
    window.addEventListener('blur', () => { keys.clear(); syncKeys(); });
    const cv = $('scene'); let dragging = false, lastAim = 0;
    const aim = (ev, force) => {
      const now = performance.now(); if (!force && now - lastAim < 120) return; lastAim = now;
      const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, rd = s.view === 'ground' ? R : O;
      const it = rd.itemAt(x, y);
      if (it) Wd.goTo(s, it.x, it.y); else { const p = rd.toWorld(x, y); Wd.goTo(s, p.x, p.y); }
    };
    cv.addEventListener('pointerdown', ev => {
      if (tab) { closeSheet(); return; }
      const r = cv.getBoundingClientRect();
      if (R.hitWreck(ev.clientX - r.left, ev.clientY - r.top, ev.pointerType !== 'mouse')) { Wd.salvage(s); return; }
      dragging = true; cv.setPointerCapture(ev.pointerId); aim(ev, true);
    });
    cv.addEventListener('pointermove', ev => { if (dragging) aim(ev, false); });
    cv.addEventListener('pointerup', () => { dragging = false; });
    cv.addEventListener('pointercancel', () => { dragging = false; });
    $('launchBtn').addEventListener('click', () => Wd.launch(s, s.view));
    $('travelBtn').addEventListener('click', () => Wd.travel(s));
    $('viewGround').addEventListener('click', () => setView('ground'));
    $('viewOrbit').addEventListener('click', () => setView('orbit'));
    $('sheetClose').addEventListener('click', closeSheet);
    document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openSheet(b.dataset.open)));
  }

  /* ---------- Boucle ---------- */
  let lastUi = 0, lastSave = Date.now(), lastAch = 0, lastTick = Date.now(), nextWreck = Date.now() + 50000;
  function loop(now) {
    const dt = R.frame(now, s.view === 'ground'); O.frame(now, s.view === 'orbit');
    const real = Date.now(), gap = (real - lastTick) / 1000; lastTick = real;
    if (gap > 10) awayReturn(gap); else if (dt) Wd.update(s, dt);
    if (now - lastUi > 150) { lastUi = now; hud(); if (tab) P.render(false); }
    if (real - lastAch > 1000) { lastAch = real; Wd.checkAch(s); }
    if (real > nextWreck && !document.hidden) { const sz = R.size(); if (R.spawnWreck(sz.W, sz.H)) nextWreck = real + Wd.wreckInterval(s) * (0.6 + Math.random() * 0.8) * 1000; }
    if (real - lastSave > 10000) { Wd.save(s); lastSave = real; }
    requestAnimationFrame(loop);
  }
  function awayReturn(secs) {
    const r = Wd.offline(s, secs);
    if (!r || secs < 60 || !r.n) return;
    const lines = [T('offlineText', { time: fmtTime(secs), n: fmt(r.n), m: fmt(r.money) })];
    if (r.stop) lines.push(T('offlineStop'));
    modal(T('welcomeBack'), lines, [{ label: T('continue'), cls: 'btn-sun' }]);
  }
  function afterLoad() {
    lang = s.settings.lang || ((navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en');
    lastStage = -1; P.sig = {}; setLang(lang);
  }
  function start(data) {
    s = null;
    if (data && data.save) { try { s = Wd.revive(JSON.parse(data.save)); } catch (e) { s = null; } }
    const fromHot = !!s, loaded = !!(s || (s = Wd.load()));
    if (!s) s = Wd.fresh();
    if (!s.ship) s.view = 'ground';
    Wd.reset(s);
    R.init($('scene'), () => s); O.init($('scene'), () => s);
    G.dbg = () => s; // accès de test depuis la console
    bindInputs(); afterLoad();
    if (loaded && !fromHot) awayReturn((Date.now() - s.last) / 1000);
    if (!loaded || s.playTime < 1) modal(T('introTitle'), [T('introText1'), T('introText2')], [{ label: T('introGo'), cls: 'btn-sun' }]);
    lastTick = Date.now();
    requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => { if (document.hidden) Wd.save(s); });
    window.addEventListener('pagehide', () => Wd.save(s));
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ save: JSON.stringify(s) }));
  }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
