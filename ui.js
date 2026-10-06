'use strict';
/* Feed the Sun — interface : panneaux, entrées, sons, sauvegarde, démarrage. */
(function () {
  const F = window.FTS, C = F.C, Scene = F.Scene;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  let s = null, lang = 'fr', tab = 'fleet';

  /* ---------- Textes et nombres ---------- */
  const T = (k, v) => { let str = (F.I18N[lang] && F.I18N[lang][k]) || F.I18N.fr[k] || k; if (v) for (const x in v) str = str.split('{' + x + '}').join(v[x]); return str; };
  const N = o => o[lang] || o.fr;
  const SUF = { fr: ['', 'k', 'M', 'Md', 'Bn', 'Bd', 'Tn', 'Td', 'Qn', 'Qd'], en: ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'] };
  const loc = str => (lang === 'fr' ? str.replace('.', ',') : str);
  function fmt(n) {
    if (!Number.isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n);
    if (n < 1000) return loc(n >= 100 || n === Math.floor(n) ? String(Math.floor(n)) : n.toFixed(n < 10 ? 2 : 1));
    if (n < 1e4) return Math.floor(n).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
    const e = Math.floor(Math.log10(n) / 3), suf = SUF[lang];
    if (e >= suf.length) return loc(n.toExponential(2).replace('e+', 'e'));
    const v = n / Math.pow(1000, e);
    return loc(v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0)) + ' ' + suf[e];
  }
  function fmtTime(sec) {
    sec = Math.floor(sec);
    const d = Math.floor(sec / 86400), h = Math.floor(sec / 3600) % 24, m = Math.floor(sec / 60) % 60, x = sec % 60;
    if (d) return d + ' ' + T('d') + ' ' + h + ' ' + T('h');
    if (h) return h + ' ' + T('h') + ' ' + m + ' ' + T('min');
    if (m) return m + ' ' + T('min') + ' ' + x + ' ' + T('s');
    return x + ' ' + T('s');
  }
  const kelvin = k => (lang === 'fr' ? k.toLocaleString('fr-FR') : k.toLocaleString('en-US'));

  /* ---------- Son (synthétisé, aucun fichier) ---------- */
  let ac = null;
  function sfx(type) {
    if (!s || !s.settings.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      const P = { shot: [180, 70, 0.12, 0.06, 'triangle'], buy: [520, 780, 0.08, 0.04, 'sine'], ach: [660, 990, 0.35, 0.06, 'sine'],
        wreck: [880, 1320, 0.3, 0.05, 'sine'], clean: [330, 660, 0.9, 0.07, 'sine'], sun: [220, 440, 1.2, 0.07, 'sine'], jump: [90, 900, 1.6, 0.06, 'sawtooth'] }[type];
      if (!P) return;
      o.type = P[4]; o.frequency.setValueAtTime(P[0], t); o.frequency.exponentialRampToValueAtTime(P[1], t + P[2]);
      g.gain.setValueAtTime(P[3], t); g.gain.exponentialRampToValueAtTime(0.0001, t + P[2]);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + P[2] + 0.02);
    } catch (e) { /* audio indisponible */ }
  }

  /* ---------- Toasts et fenêtre modale ---------- */
  function toast(title, text, kind) {
    const box = $('toasts');
    while (box.children.length >= 4) box.firstChild.remove();
    const t = el('div', 'toast' + (kind ? ' toast-' + kind : ''));
    t.append(el('div', 'toast-title'), el('div', 'toast-text'));
    t.firstChild.textContent = title; t.lastChild.textContent = text || '';
    box.append(t);
    setTimeout(() => t.classList.add('out'), 4200);
    setTimeout(() => t.remove(), 4800);
  }
  function modal(title, body, actions) {
    $('modalTitle').textContent = title;
    const b = $('modalBody'); b.innerHTML = '';
    (Array.isArray(body) ? body : [body]).forEach(p => { const e = el('p'); e.textContent = p; b.append(e); });
    const a = $('modalActions'); a.innerHTML = '';
    actions.forEach(x => { const btn = el('button', 'btn ' + (x.cls || '')); btn.type = 'button'; btn.textContent = x.label; btn.onclick = () => { closeModal(); if (x.fn) x.fn(); }; a.append(btn); });
    $('modal').hidden = false;
    const first = a.querySelector('button'); if (first) first.focus();
  }
  const closeModal = () => { $('modal').hidden = true; };

  /* ---------- Icônes de la flotte ---------- */
  const ICON = {
    net: '<path d="M4 6l16 0-3 13H7z"/><path d="M8 6l2 13M16 6l-2 13M5.5 11h13M6.5 15.5h11"/>',
    harpoon: '<path d="M3 21L17 7"/><path d="M14 4h6v6M17 7l3-3"/>',
    magnet: '<path d="M6 4v8a6 6 0 0 0 12 0V4"/><path d="M6 8h3M15 8h3"/>',
    arm: '<path d="M4 20l5-8 6-2"/><path d="M15 10l4-4M15 10l5 1"/><circle cx="9" cy="12" r="1.5"/>',
    tether: '<path d="M12 2v14"/><path d="M8 20h8l-4-4z"/><path d="M9 6c2 1 4 1 6 0M9 10c2 1 4 1 6 0"/>',
    laser: '<path d="M3 15h7l2 2h-9z"/><path d="M12 15l9-9"/><path d="M18 3l3 3"/>',
    ion: '<circle cx="6" cy="12" r="3"/><path d="M10 12h2M14 12h2M18 12h2M11 8l2-1M15 8l2-1M11 16l2 1M15 16l2 1"/>',
    driver: '<path d="M3 19h18M3 15h18"/><path d="M14 6l5 4-5 4"/><rect x="5" y="9" width="5" height="4" rx="1"/>',
  };
  const svg = id => '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[id] + '</svg>';

  /* ---------- Onglet Flotte ---------- */
  const rows = [];
  function buildFleet() {
    const box = $('tab-fleet'); box.innerHTML = '';
    const head = el('div', 'fleet-head');
    const seg = el('div', 'seg'); seg.setAttribute('role', 'group');
    [1, 10, 100, 'max'].forEach(m => {
      const b = el('button', 'seg-btn'); b.type = 'button'; b.dataset.mode = m;
      b.textContent = m === 'max' ? T('max') : '×' + m;
      b.onclick = () => { s.settings.buy = m; refreshFleet(); };
      seg.append(b);
    });
    head.append(el('span', 'fleet-label', T('buy')), seg);
    box.append(head);
    rows.length = 0;
    F.GENS.forEach((g, i) => {
      const r = el('div', 'gen-row');
      r.style.setProperty('--c', g.color);
      r.innerHTML = '<div class="gen-icon">' + svg(g.id) + '</div><div class="gen-main"><div class="gen-top"><span class="gen-name"></span><span class="gen-count"></span></div>' +
        '<div class="gen-desc"></div><div class="gen-prod"></div><div class="ms"><div class="ms-bar"><div class="ms-fill"></div></div><span class="ms-label"></span></div>' +
        '<details class="fact"><summary></summary><p></p></details></div>' +
        '<button type="button" class="buy-btn"><span class="buy-qty"></span><span class="buy-cost"></span></button>';
      r.querySelector('.buy-btn').onclick = () => { const k = C.buyGen(s, i, s.settings.buy === 'max' ? 'max' : s.settings.buy); if (k) sfx('buy'); refreshFleet(); };
      box.append(r);
      rows.push(r);
    });
    refreshFleet();
  }
  function refreshFleet() {
    if (!rows.length) return;
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('is-on', String(s.settings.buy) === b.dataset.mode));
    let shownLocked = false;
    F.GENS.forEach((g, i) => {
      const r = rows[i], unlocked = C.genUnlocked(s, i), owned = s.gens[i];
      const visible = unlocked || owned > 0 || (!shownLocked && (i === 0 || s.gens[i - 1] > 0 || s.planet >= C.unlockPlanet(i) - 1));
      r.hidden = !visible;
      if (!visible) return;
      if (!unlocked) shownLocked = true;
      r.classList.toggle('is-locked', !unlocked);
      const q = (sel, txt) => { const e = r.querySelector(sel); if (e.textContent !== txt) e.textContent = txt; };
      q('.gen-name', unlocked ? N(g.name) : '???');
      q('.gen-count', owned ? String(owned) : '');
      q('.gen-desc', unlocked ? N(g.desc) : (s.planet < C.unlockPlanet(i) ? T('lockedGen', { n: C.unlockPlanet(i) + 1 }) : T('lockedPrev', { prev: N(F.GENS[i - 1].name) })));
      const each = F.GENS[i].prod * C.genMult(s, i) * C.prodMult(s);
      q('.gen-prod', unlocked ? T('each', { x: fmt(each) }) + (owned ? ' · ' + T('total', { x: fmt(C.genTps(s, i)) }) : '') : '');
      const next = C.nextMilestone(owned), prev = F.MILESTONES.filter(m => m <= owned).pop() || 0;
      r.querySelector('.ms').hidden = !unlocked;
      r.querySelector('.fact').hidden = !unlocked;
      q('.fact summary', T('fact'));
      q('.fact p', N(g.fact));
      r.querySelector('.ms-fill').style.width = next ? Math.min(100, ((owned - prev) / (next - prev)) * 100) + '%' : '100%';
      q('.ms-label', next ? owned + '/' + next + ' → ×' + C.msFactor(s) : T('allMs'));
      let k = s.settings.buy === 'max' ? Math.max(1, C.maxAfford(s, i)) : s.settings.buy;
      const cost = C.bulkCost(s, i, k), btn = r.querySelector('.buy-btn');
      btn.disabled = !unlocked;
      btn.classList.toggle('can', unlocked && cost <= s.credits);
      q('.buy-qty', '×' + k);
      q('.buy-cost', fmt(cost) + ' cr');
    });
  }

  /* ---------- Onglet Améliorations ---------- */
  let upsSig = '';
  function upName(u) { return u.kind === 'gen' ? T('upGenName', { gen: N(F.GENS[u.gen].name), mk: F.MK[u.tier] }) : N(u.name); }
  function upDesc(u) { return u.kind === 'gen' ? T('upGen', { gen: N(F.GENS[u.gen].name) }) : N(u.desc); }
  function refreshUps(force) {
    const list = C.availableUps(s), sig = list.map(u => u.id).join(',') + lang;
    $('upsDot').hidden = !list.some(u => u.cost <= s.credits);
    if (tab !== 'ups') return;
    const box = $('tab-ups');
    if (force || sig !== upsSig) {
      upsSig = sig; box.innerHTML = '';
      const head = el('div', 'ups-head');
      const all = el('button', 'btn btn-ghost'); all.type = 'button'; all.textContent = T('buyAll');
      all.onclick = () => { let n = 0; for (const u of C.availableUps(s)) if (C.buyUp(s, u.id)) n++; if (n) sfx('buy'); refreshUps(true); };
      head.append(el('span', 'ups-count', T('upsOwned', { n: Object.keys(s.ups).length })), all);
      box.append(head);
      if (!list.length) box.append(el('p', 'empty', T('noUps')));
      const grid = el('div', 'up-grid');
      list.forEach(u => {
        const c = el('button', 'up-card'); c.type = 'button'; c.dataset.id = u.id;
        if (u.kind === 'gen') c.style.setProperty('--c', F.GENS[u.gen].color);
        c.append(el('span', 'up-name'), el('span', 'up-desc'), el('span', 'up-cost'));
        c.children[0].textContent = upName(u); c.children[1].textContent = upDesc(u); c.children[2].textContent = fmt(u.cost) + ' cr';
        c.onclick = () => { if (C.buyUp(s, u.id)) { sfx('buy'); refreshUps(true); } };
        grid.append(c);
      });
      box.append(grid);
    }
    box.querySelectorAll('.up-card').forEach(c => c.classList.toggle('can', C.upById(c.dataset.id).cost <= s.credits));
  }

  /* ---------- Onglet Galaxie ---------- */
  let galSig = '';
  function refreshGalaxy(force) {
    $('galaxyDot').hidden = !C.canJump(s);
    if (tab !== 'galaxy') return;
    const sig = [s.crystals, s.crystalsLife, s.cleanedRun, Object.keys(s.relics).join(), s.settings.autoGens, s.settings.autoUps, lang].join('|');
    if (!force && sig === galSig) return;
    galSig = sig;
    const box = $('tab-galaxy'); box.innerHTML = '';
    const sum = el('div', 'gal-summary');
    sum.innerHTML = '<div class="stat-big"></div><div class="stat-label"></div><div class="stat-sub"></div>';
    sum.children[0].textContent = fmt(s.crystals); sum.children[1].textContent = T('crystals');
    sum.children[2].textContent = T('crystalBonus', { p: fmt(s.crystalsLife * F.CRYSTAL_BONUS * 100) });
    box.append(sum);
    const j = el('section', 'jump-box');
    j.append(el('h3', null, T('jumpTitle')), el('p', null, T('jumpDesc')));
    if (C.canJump(s)) {
      j.append(el('p', 'jump-gain', T('jumpGain', { n: fmt(C.jumpGain(s)) })), el('p', 'muted', T('jumpRule')));
      const b = el('button', 'btn btn-sun'); b.type = 'button'; b.textContent = T('jumpBtn', { g: C.roman(s.jumps + 2) });
      b.onclick = () => modal(T('confirmJumpTitle', { g: C.roman(s.jumps + 2) }), T('confirmJumpText', { n: fmt(C.jumpGain(s)) }),
        [{ label: T('jumpGo'), cls: 'btn-sun', fn: () => { C.jump(s); C.save(s); } }, { label: T('cancel'), cls: 'btn-ghost' }]);
      j.append(b);
    } else {
      j.append(el('p', 'muted', T('jumpLocked', { n: F.JUMP_REQ, c: s.cleanedRun })));
      const bar = el('div', 'bar'); const fill = el('div', 'bar-fill'); fill.style.width = (s.cleanedRun / F.JUMP_REQ) * 100 + '%'; bar.append(fill); j.append(bar);
    }
    box.append(j);
    const rel = el('section', 'relics');
    rel.append(el('h3', null, T('relicsTitle')), el('p', 'muted', T('relicsDesc')));
    F.RELICS.forEach(r => {
      const own = !!s.relics[r.id], row = el('div', 'relic' + (own ? ' owned' : ''));
      row.append(el('div', 'relic-main'));
      row.firstChild.append(el('div', 'relic-name'), el('div', 'relic-desc'));
      row.firstChild.children[0].textContent = N(r.name); row.firstChild.children[1].textContent = N(r.desc);
      if (own) {
        const tag = el('span', 'relic-tag'); tag.textContent = T('owned'); row.append(tag);
        const key = r.id === 'factory' ? 'autoGens' : r.id === 'office' ? 'autoUps' : null;
        if (key) {
          const lab = el('label', 'toggle'), cb = el('input'); cb.type = 'checkbox'; cb.id = 'tg-' + key; cb.checked = !!s.settings[key];
          cb.onchange = () => { s.settings[key] = cb.checked; }; lab.append(cb, document.createTextNode(T(key))); row.firstChild.append(lab);
        }
      } else {
        const b = el('button', 'btn btn-ghost' + (s.crystals >= r.cost ? ' can' : '')); b.type = 'button'; b.textContent = T('cost', { n: r.cost });
        b.disabled = s.crystals < r.cost; b.onclick = () => { if (C.buyRelic(s, r.id)) { sfx('ach'); refreshGalaxy(true); } };
        row.append(b);
      }
      rel.append(row);
    });
    box.append(rel);
  }

  /* ---------- Onglet Succès ---------- */
  let achSig = '';
  function refreshAch(force) {
    if (tab !== 'ach') return;
    const sig = C.achCount(s) + lang;
    if (!force && sig === achSig) return;
    achSig = sig;
    const box = $('tab-ach'); box.innerHTML = '';
    box.append(el('p', 'ach-head', T('achHead', { n: C.achCount(s), m: F.ACHIEVEMENTS.length, p: C.achCount(s) * F.ACH_BONUS * 100 })));
    const grid = el('div', 'ach-grid');
    F.ACHIEVEMENTS.forEach(a => {
      const c = el('div', 'ach' + (s.ach[a.id] ? ' got' : ''));
      c.append(el('div', 'ach-name'), el('div', 'ach-desc'));
      c.children[0].textContent = N(a.name); c.children[1].textContent = N(a.desc);
      grid.append(c);
    });
    box.append(grid);
  }

  /* ---------- Onglet Options ---------- */
  function buildOptions() {
    const box = $('tab-opt'); box.innerHTML = '';
    const sec = (title) => { const x = el('section', 'opt-section'); x.append(el('h3', null, title)); box.append(x); return x; };
    const a = sec(T('lang')), row = el('div', 'seg');
    [['fr', 'Français'], ['en', 'English']].forEach(([k, label]) => {
      const b = el('button', 'seg-btn' + (lang === k ? ' is-on' : '')); b.type = 'button'; b.textContent = label;
      b.onclick = () => { setLang(k); }; row.append(b);
    });
    a.append(row);
    const b = sec(T('sound')), snd = el('button', 'btn btn-ghost'); snd.type = 'button';
    snd.textContent = s.settings.sound ? T('on') : T('off');
    snd.onclick = () => { s.settings.sound = !s.settings.sound; buildOptions(); };
    b.append(snd);
    const c = sec(T('exportTitle'));
    c.append(el('p', 'muted', T('saveNote')));
    const ex = el('button', 'btn btn-ghost'); ex.type = 'button'; ex.textContent = T('exportBtn');
    const ta = el('textarea', 'save-box'); ta.id = 'saveCode'; ta.rows = 3; ta.setAttribute('aria-label', T('importLabel')); ta.placeholder = T('importLabel');
    ex.onclick = () => {
      const code = C.exportSave(s); ta.value = code;
      const fallback = () => { ta.focus(); ta.select(); toast(T('copyFail')); };
      try { navigator.clipboard.writeText(code).then(() => toast(T('copied')), fallback); } catch (e) { fallback(); }
    };
    const im = el('button', 'btn btn-ghost'); im.type = 'button'; im.textContent = T('importBtn');
    im.onclick = () => { const ns = C.importSave(ta.value); if (!ns) { toast(T('importErr')); return; } s = ns; afterLoad(); C.save(s); toast(T('imported')); };
    const btns = el('div', 'btn-row'); btns.append(ex, im);
    c.append(btns, ta);
    const d = sec(T('stats')), dl = el('dl', 'stats'); dl.id = 'statsList'; d.append(dl);
    const e = sec(T('resetTitle')), rb = el('button', 'btn btn-danger'); rb.type = 'button'; rb.textContent = T('resetBtn');
    rb.onclick = () => modal(T('resetConfirm'), T('resetText'), [{ label: T('resetGo'), cls: 'btn-danger', fn: () => { C.wipe(); s = C.fresh(); s.settings.lang = lang; afterLoad(); C.save(s); } }, { label: T('cancel'), cls: 'btn-ghost' }]);
    e.append(rb);
    refreshStats();
  }
  function refreshStats() {
    const dl = $('statsList'); if (!dl || tab !== 'opt') return;
    const st = F.SUN[C.sunStage(s)];
    const items = [[T('stTime'), fmtTime(s.playTime)], [T('stShots'), fmt(s.shots)], [T('stTons'), fmt(s.tonnesLife) + ' t'], [T('stPlanets'), fmt(s.cleanedLife)],
      [T('stWrecks'), fmt(s.wrecks)], [T('stJumps'), fmt(s.jumps)], [T('stSun'), N(st.name)]];
    dl.innerHTML = '';
    items.forEach(([k, v]) => { const dt = el('dt'), dd = el('dd'); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); });
  }

  /* ---------- Onglets, langue ---------- */
  function showTab(name) {
    tab = name;
    document.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); });
    ['fleet', 'ups', 'galaxy', 'ach', 'opt'].forEach(n => { $('tab-' + n).hidden = n !== name; });
    if (name === 'ups') refreshUps(true);
    if (name === 'galaxy') refreshGalaxy(true);
    if (name === 'ach') refreshAch(true);
    if (name === 'opt') buildOptions();
    try { localStorage.setItem('feedthesun.tab', name); } catch (e) { /* stockage indisponible */ }
  }
  function setLang(k) {
    lang = k; s.settings.lang = k; document.documentElement.lang = k;
    document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = T(e.dataset.i18n); });
    buildFleet(); showTab(tab); hud(true);
  }

  /* ---------- Affichage principal ---------- */
  let lastStage = -1, hintTimer = 0;
  function hud() {
    $('credits').textContent = fmt(s.credits);
    $('cps').textContent = fmt(C.cps(s));
    $('tps').textContent = fmt(s.awaitingTravel ? 0 : C.tps(s));
    const info = C.planetInfo(s), total = C.pollution(s.planet);
    $('planetName').textContent = s.awaitingTravel ? info.good : info.bad;
    $('planetMeta').textContent = T('planetN', { n: s.planet + 1 }) + ' · ' + T('galaxyN', { g: C.roman(s.jumps + 1) });
    const stage = C.sunStage(s), sd = F.SUN[stage];
    $('sunMeta').textContent = N(sd.name) + (sd.k ? ' · ' + kelvin(sd.k) + ' K' : '');
    const pct = s.awaitingTravel ? 0 : (s.planetLeft / total) * 100;
    $('pollPct').textContent = (pct > 0 && pct < 1 ? loc(pct.toFixed(1)) : Math.ceil(pct)) + ' %';
    $('pollBar').style.width = pct + '%';
    $('pollSub').textContent = T('tonsLeft', { t: fmt(s.planetLeft) }) + ' · ' + T('perTon', { v: fmt(C.value(s)) });
    const c = Scene.sunColor();
    document.documentElement.style.setProperty('--sun', 'rgb(' + c.join(',') + ')');
    $('fireBtn').disabled = s.awaitingTravel;
    if (lastStage >= 0 && stage > lastStage) {
      toast(T('sunToast'), sd.k ? T('sunToastText', { name: N(sd.name), k: kelvin(sd.k) }) : T('sunToastPrism', { name: N(sd.name) }), 'sun');
      Scene.sunUp(); sfx('sun');
    }
    lastStage = stage;
    const bf = $('buffs');
    bf.innerHTML = '';
    s.buffs.forEach(b => {
      const x = el('div', 'buff'); x.textContent = T(b.type === 'frenzy' ? 'buffFrenzy' : 'buffOverdrive') + ' · ' + Math.ceil(b.left) + ' s';
      x.style.setProperty('--p', (b.left / b.total) * 100 + '%'); bf.append(x);
    });
    banner();
    hints();
  }
  function banner() {
    const show = s.awaitingTravel;
    $('banner').hidden = !show;
    if (!show) return;
    const now = C.planetInfo(s), next = C.planetInfo(s, s.planet + 1);
    $('bannerTitle').textContent = T('cleanTitle', { name: now.good });
    $('bannerText').textContent = T('cleanText', { old: now.bad, next: next.bad });
    $('travelBtn').textContent = C.relic(s, 'autopilot') ? T('travelAuto', { next: next.bad }) : T('travel', { next: next.bad });
  }
  function hints() {
    const h = $('hint');
    let key = null;
    if (Scene.hasWreck() && s.wrecks === 0) key = 'hintWreck';
    else if (s.tutorial === 0) { key = 'hint0'; if (s.shots >= 3) s.tutorial = 1; }
    else if (s.tutorial === 1) { key = 'hint1'; if (s.gens[0] >= 1) { s.tutorial = 2; hintTimer = Date.now(); } }
    else if (s.tutorial === 2) { key = 'hint2'; if (Date.now() - hintTimer > 12000 || s.gens[0] >= 10) s.tutorial = 3; }
    h.hidden = !key;
    if (key && h.dataset.k !== key + lang) { h.textContent = T(key); h.dataset.k = key + lang; }
  }

  /* ---------- Événements du moteur ---------- */
  C.on('shot', e => { Scene.playerShot(e.tonnes, e.auto); if (!e.auto) sfx('shot'); });
  C.on('cleaned', () => {
    Scene.cleaned(); sfx('clean');
    if (C.relic(s, 'autopilot')) setTimeout(() => { if (s.awaitingTravel) C.travel(s); }, 2600);
  });
  C.on('travel', p => {
    Scene.travel();
    F.GENS.forEach((g, i) => { if (C.unlockPlanet(i) === p && i >= 2) toast(T('newGen', { gen: N(g.name) }), N(g.fact)); });
    refreshFleet();
  });
  C.on('milestone', e => toast(T('msToast', { gen: N(F.GENS[e.i].name), n: e.count, f: C.msFactor(s) }), '', 'ms'));
  C.on('ach', a => { toast(T('achToast'), N(a.name), 'ach'); sfx('ach'); });
  C.on('salvage', r => {
    sfx('wreck');
    if (r.type === 'cargo') toast(T('cargo', { c: fmt(r.credits) }), '', 'sun');
    else toast(T(r.type, { s: Math.round(r.secs) }), '', 'sun');
  });
  C.on('jump', g => { Scene.jump(); sfx('jump'); toast(T('jumpToast', { g: C.roman(s.jumps + 1), n: g }), '', 'sun'); buildFleet(); refreshGalaxy(true); });
  C.on('relic', r => toast(T('relicToast', { name: N(r.name) }), '', 'ach'));

  /* ---------- Entrées ---------- */
  function fire() { if (!s.awaitingTravel) C.shoot(s); }
  function bindInputs() {
    const cv = $('scene');
    cv.addEventListener('pointerdown', ev => {
      const r = cv.getBoundingClientRect();
      if (Scene.hitWreck(ev.clientX - r.left, ev.clientY - r.top, ev.pointerType !== 'mouse')) { C.salvage(s); return; }
      fire();
    });
    $('fireBtn').addEventListener('click', fire);
    $('travelBtn').addEventListener('click', () => C.travel(s));
    document.addEventListener('keydown', ev => {
      if (ev.code !== 'Space' || ev.repeat || /INPUT|TEXTAREA|BUTTON|SELECT/.test(document.activeElement.tagName)) return;
      ev.preventDefault(); fire();
    });
    document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('modal').hidden) closeModal(); });
  }

  /* ---------- Boucles ---------- */
  let lastTick = Date.now(), nextWreck = 0, lastSave = Date.now(), lastUi = 0;
  function scheduleWreck(first) { nextWreck = Date.now() + (first ? 35 : C.wreckInterval(s) * (0.6 + Math.random() * 0.8)) * 1000; }
  function tick() {
    const now = Date.now(), dt = (now - lastTick) / 1000;
    lastTick = now;
    if (dt > 10) awayReturn(dt); else if (dt > 0) C.tick(s, dt);
    if (!document.hidden && now >= nextWreck && !Scene.busy()) { if (Scene.spawnWreck()) scheduleWreck(false); }
    if (now - lastSave > 10000) { C.save(s); lastSave = now; }
  }
  function loop(now) {
    Scene.frame(now);
    if (now - lastUi > 150) {
      lastUi = now; hud(); refreshFleet(); refreshUps(); refreshGalaxy(); refreshAch();
      if (tab === 'opt' && Math.floor(now / 1000) !== Math.floor((now - 150) / 1000)) refreshStats();
    }
    requestAnimationFrame(loop);
  }
  function awayReturn(secs) {
    const r = C.offline(s, secs);
    if (secs < 60 || r.tonnes <= 0 && !r.stopped) return;
    const lines = [T('offlineText', { time: fmtTime(secs), t: fmt(r.tonnes), c: fmt(r.credits) })];
    if (r.planets) lines.push(T('offlinePlanets', { n: r.planets }));
    if (r.stopped) lines.push(T('offlineStopped'));
    if (r.capped) lines.push(T('offlineCap', { h: C.relic(s, 'offline') ? 24 : F.OFFLINE_CAP / 3600 }));
    modal(T('welcomeBack'), lines, [{ label: T('continue'), cls: 'btn-sun' }]);
  }

  /* ---------- Démarrage ---------- */
  function afterLoad() {
    lang = s.settings.lang || ((navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en');
    lastStage = -1; upsSig = galSig = achSig = '';
    setLang(lang);
  }
  function start(data) {
    s = null;
    if (data && data.save) { try { s = C.revive(JSON.parse(data.save)); } catch (e) { s = null; } }
    if (!s) s = C.load();
    const loaded = !!s;
    if (!s) s = C.fresh();
    Scene.init($('scene'), () => s, fmt);
    F.dbg = () => s; // accès de test depuis la console
    try { const t = localStorage.getItem('feedthesun.tab'); if (t && $('tab-' + t)) tab = t; } catch (e) { /* stockage indisponible */ }
    bindInputs();
    afterLoad();
    if (loaded && !(data && data.save)) awayReturn((Date.now() - s.last) / 1000);
    if (!loaded) modal(T('introTitle'), [T('introText1'), T('introText2'), T('introText3')], [{ label: T('introGo'), cls: 'btn-sun' }]);
    scheduleWreck(s.wrecks === 0);
    lastTick = Date.now();
    setInterval(tick, 100);
    requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => { if (document.hidden) C.save(s); });
    window.addEventListener('pagehide', () => C.save(s));
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ save: C.serialize(s) }));
  }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
