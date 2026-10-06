'use strict';
/* Feed the Sun v3 — interface, commandes, sons, sauvegarde et démarrage. */
(function () {
  const G = window.FTS3, Wd = G.W, R = G.R;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  let s = null, lang = 'fr', tab = 'gear';

  const T = (k, v) => { let str = (G.I18N[lang] && G.I18N[lang][k]) || G.I18N.fr[k] || k; if (v) for (const x in v) str = str.split('{' + x + '}').join(v[x]); return str; };
  const N = o => o[lang] || o.fr;
  const SUF = { fr: ['', 'k', 'M', 'Md', 'Bn'], en: ['', 'K', 'M', 'B', 'T'] };
  const loc = str => (lang === 'fr' ? str.replace('.', ',') : str);
  function fmt(n) {
    if (n < 1e4) return Math.floor(n).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
    const e = Math.min(4, Math.floor(Math.log10(n) / 3)), v = n / Math.pow(1000, e);
    return loc(v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0)) + ' ' + SUF[lang][e];
  }
  const fmtNum = v => loc(String(Math.round(v * 100) / 100));
  function fmtTime(sec) { sec = Math.floor(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, x = sec % 60; return h ? h + ' ' + T('h') + ' ' + m + ' ' + T('min') : m ? m + ' ' + T('min') + ' ' + x + ' ' + T('s') : x + ' ' + T('s'); }

  /* ---------- Sons synthétisés ---------- */
  let ac = null, lastDump = 0;
  function sfx(type) {
    if (!s || !s.settings.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const P = { pickup: [600, 900, 0.07, 0.035, 'sine'], dump: [220, 160, 0.06, 0.04, 'triangle'], launch: [120, 520, 0.7, 0.06, 'sawtooth'],
        buy: [520, 780, 0.09, 0.04, 'sine'], full: [440, 330, 0.18, 0.04, 'square'], clean: [330, 660, 0.9, 0.07, 'sine'], sun: [220, 440, 1.2, 0.06, 'sine'] }[type];
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = P[4]; o.frequency.setValueAtTime(P[0], t); o.frequency.exponentialRampToValueAtTime(P[1], t + P[2]);
      g.gain.setValueAtTime(P[3], t); g.gain.exponentialRampToValueAtTime(0.0001, t + P[2]);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + P[2] + 0.02);
    } catch (e) { /* audio indisponible */ }
  }

  /* ---------- Toasts et fenêtre ---------- */
  function toast(title, text, kind) {
    const box = $('toasts');
    while (box.children.length >= 3) box.firstChild.remove();
    const t = el('div', 'toast' + (kind ? ' toast-' + kind : ''));
    t.append(el('div', 'toast-title', title), el('div', 'toast-text', text || ''));
    box.append(t);
    setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3800);
  }
  function modal(title, lines, actions) {
    $('modalTitle').textContent = title;
    const b = $('modalBody'); b.innerHTML = ''; lines.forEach(p => b.append(el('p', null, p)));
    const a = $('modalActions'); a.innerHTML = '';
    actions.forEach(x => { const btn = el('button', 'btn ' + (x.cls || ''), x.label); btn.type = 'button'; btn.onclick = () => { $('modal').hidden = true; if (x.fn) x.fn(); }; a.append(btn); });
    $('modal').hidden = false; const f = a.querySelector('button'); if (f) f.focus();
  }

  /* ---------- Équipement ---------- */
  const rows = {};
  function buildGear() {
    const box = $('tab-gear'); box.innerHTML = '';
    G.UPGRADES.forEach(u => {
      const r = el('div', 'gen-row up-row');
      const main = el('div', 'gen-main');
      const top = el('div', 'gen-top'); top.append(el('span', 'gen-name', N(u.name)), el('span', 'gen-count'));
      main.append(top, el('div', 'gen-desc', N(u.desc)), el('div', 'gen-prod'));
      const btn = el('button', 'buy-btn'); btn.type = 'button'; btn.append(el('span', 'buy-qty'), el('span', 'buy-cost'));
      btn.onclick = () => { if (Wd.buy(s, u.id)) refreshGear(); };
      r.append(main, btn); box.append(r); rows[u.id] = r;
    });
    refreshGear();
  }
  function refreshGear() {
    let any = false;
    G.UPGRADES.forEach(u => {
      const r = rows[u.id]; if (!r) return;
      const lvl = s.lvl[u.id], maxed = lvl >= u.max, cost = Wd.cost(s, u.id), can = Wd.canBuy(s, u.id);
      any = any || can;
      const v = u.eff(lvl), shown = Number.isInteger(v) ? String(v) : fmtNum(v);
      r.querySelector('.gen-count').textContent = T('lvl', { n: lvl });
      r.querySelector('.gen-prod').textContent = T('now', { v: N(u.unit).replace('{v}', shown) });
      const b = r.querySelector('.buy-btn'); b.disabled = maxed; b.classList.toggle('can', can);
      r.querySelector('.buy-qty').textContent = maxed ? '' : '+1';
      r.querySelector('.buy-cost').textContent = maxed ? T('maxed') : fmt(cost) + ' $';
    });
    $('gearDot').hidden = !any;
  }

  /* ---------- Équipe (aperçu de l'étape 2) ---------- */
  function buildTeam() {
    const box = $('tab-team'); box.innerHTML = '';
    const sec = el('section', 'jump-box'); sec.append(el('h3', null, T('teamTitle')), el('p', 'muted', T('teamText')));
    box.append(sec);
    [['teamCard1', 'teamCard1d'], ['teamCard2', 'teamCard2d']].forEach(([a, b]) => {
      const r = el('div', 'gen-row is-locked');
      const m = el('div', 'gen-main'); const top = el('div', 'gen-top'); top.append(el('span', 'gen-name', T(a)), el('span', 'tag-soon', T('soon')));
      m.append(top, el('div', 'gen-desc', T(b))); r.append(m); box.append(r);
    });
  }

  /* ---------- Options ---------- */
  function buildOptions() {
    const box = $('tab-opt'); box.innerHTML = '';
    const sec = t => { const x = el('section', 'opt-section'); x.append(el('h3', null, t)); box.append(x); return x; };
    const a = sec(T('lang')), seg = el('div', 'seg');
    [['fr', 'Français'], ['en', 'English']].forEach(([k, label]) => { const b = el('button', 'seg-btn' + (lang === k ? ' is-on' : ''), label); b.type = 'button'; b.onclick = () => setLang(k); seg.append(b); });
    a.append(seg);
    const b = sec(T('sound')), snd = el('button', 'btn btn-ghost', s.settings.sound ? T('on') : T('off')); snd.type = 'button';
    snd.onclick = () => { s.settings.sound = !s.settings.sound; buildOptions(); }; b.append(snd);
    sec(T('controls')).append(el('p', 'muted', T('controlsText')));
    const st = sec(T('stats')), dl = el('dl', 'stats'); dl.id = 'statsList'; st.append(dl);
    const ln = sec(T('version')), row = el('div', 'btn-row');
    [['oldVersion', 'https://klyde94.github.io/feed-the-sun/'], ['plan', 'https://klyde94.github.io/feed-the-sun/plan.html']].forEach(([k, href]) => { const x = el('a', 'btn btn-ghost', T(k)); x.href = href; x.target = '_blank'; x.rel = 'noopener'; row.append(x); });
    ln.append(row);
    const r = sec(T('resetTitle')), rb = el('button', 'btn btn-danger', T('resetBtn')); rb.type = 'button';
    rb.onclick = () => modal(T('resetConfirm'), [T('resetText')], [{ label: T('resetGo'), cls: 'btn-danger', fn: () => { Wd.wipe(); s = Wd.fresh(); s.settings.lang = lang; s.tutorial = 0; Wd.reset(s); afterLoad(); } }, { label: T('cancel'), cls: 'btn-ghost' }]);
    r.append(rb);
    refreshStats();
  }
  function refreshStats() {
    const dl = $('statsList'); if (!dl || tab !== 'opt') return;
    dl.innerHTML = '';
    [[T('stTime'), fmtTime(s.playTime)], [T('stSent'), fmt(s.sent)], [T('stMoney'), fmt(s.moneyLife) + ' $'], [T('stPlanets'), String(s.saved)]]
      .forEach(([k, v]) => dl.append(el('dt', null, k), el('dd', null, v)));
  }

  function showTab(name) {
    tab = name;
    document.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); });
    ['gear', 'team', 'opt'].forEach(n => { $('tab-' + n).hidden = n !== name; });
    if (name === 'opt') buildOptions();
  }
  function setLang(k) {
    lang = k; s.settings.lang = k; document.documentElement.lang = k;
    document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = T(e.dataset.i18n); });
    $('launchSub').textContent = T('launchKey');
    buildGear(); buildTeam(); showTab(tab);
  }

  /* ---------- Affichage principal ---------- */
  let lastStage = -1;
  function hud() {
    $('money').textContent = fmt(s.money);
    $('sent').textContent = fmt(s.sent);
    const info = Wd.planetInfo(s);
    $('planetName').textContent = s.awaitingTravel ? info.good : info.bad;
    $('planetMeta').textContent = T('planetN', { n: s.planet + 1 });
    const stage = Wd.sunStage(s), sd = G.SUN[stage];
    $('sunMeta').textContent = N(sd.name) + ' · ' + sd.k.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') + ' K';
    if (lastStage >= 0 && stage > lastStage) { toast(T('sunToast'), T('sunText', { name: N(sd.name), k: sd.k }), 'sun'); R.fxSunUp(); sfx('sun'); }
    lastStage = stage;
    document.documentElement.style.setProperty('--sun', 'rgb(' + R.sunColor().join(',') + ')');
    const bc = Wd.bagCap(s), cc = Wd.contCap(s), poll = Wd.pollution(s) * 100;
    $('bagTxt').textContent = s.bag.length + '/' + bc; $('bagBar').style.width = (s.bag.length / bc) * 100 + '%';
    $('contTxt').textContent = s.cont.length + '/' + cc; $('contBar').style.width = (s.cont.length / cc) * 100 + '%';
    $('pollTxt').textContent = (poll > 0 && poll < 1 ? loc(poll.toFixed(1)) : Math.ceil(poll)) + ' %'; $('pollBar').style.width = poll + '%';
    const lb = $('launchBtn');
    lb.disabled = !s.cont.length || Wd.launching > 0;
    lb.classList.toggle('is-full', s.cont.length >= cc);
    lb.querySelector('span').textContent = T('launch') + (s.cont.length ? ' · ' + fmt(Wd.contValue(s)) + ' $' : '');
    $('banner').hidden = !s.awaitingTravel;
    if (s.awaitingTravel) {
      const next = Wd.planetInfo(s, s.planet + 1);
      $('bannerTitle').textContent = T('cleanTitle', { name: info.good });
      $('bannerText').textContent = T('cleanText', { old: info.bad, next: next.bad });
      $('travelBtn').textContent = T('travel', { next: next.bad });
    }
    hints();
  }
  function hints() {
    let key = null;
    if (s.tutorial === 0) key = 'hint0';
    else if (s.tutorial === 1 && s.bag.length >= Wd.bagCap(s)) key = 'hint1';
    else if (s.tutorial === 2) key = 'hint2';
    else if (s.tutorial === 3) key = 'hint3';
    const h = $('hint'); h.hidden = !key;
    if (key && h.dataset.k !== key + lang) { h.textContent = T(key); h.dataset.k = key + lang; }
  }

  /* ---------- Événements du monde ---------- */
  Wd.on('pickup', it => { R.fxPickup(it); sfx('pickup'); if (s.tutorial === 0) s.tutorial = 1; });
  Wd.on('bagFull', () => sfx('full'));
  Wd.on('dump', k => { R.fxDump(k); const n = performance.now(); if (n - lastDump > 70) { sfx('dump'); lastDump = n; } if (s.tutorial === 1) s.tutorial = 2; });
  Wd.on('contFull', () => toast(T('contFull'), '', 'sun'));
  Wd.on('launch', e => {
    R.fxLaunch(e); sfx('launch');
    R.floater(T('launchToast', { m: fmt(e.money) }), G.BASE_X, G.GROUND_TOP - 12);
    if (e.full) toast(T('launchToast', { m: fmt(e.money) }), T('fullBonus'), 'sun');
    if (s.tutorial === 2) s.tutorial = 3;
  });
  Wd.on('buy', () => { sfx('buy'); if (s.tutorial === 3) s.tutorial = 4; });
  Wd.on('cleaned', () => { R.fxClean(); sfx('clean'); });
  Wd.on('travel', () => R.fxTravel());

  /* ---------- Commandes ---------- */
  const keys = new Set();
  const KEYMAP = { KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0], KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1] };
  function syncKeys() { let x = 0, y = 0; keys.forEach(c => { x += KEYMAP[c][0]; y += KEYMAP[c][1]; }); Wd.input.x = Math.sign(x); Wd.input.y = Math.sign(y); }
  function typing() { const t = document.activeElement && document.activeElement.tagName; return t === 'INPUT' || t === 'TEXTAREA'; }
  function bindInputs() {
    document.addEventListener('keydown', e => {
      if (typing()) return;
      if (KEYMAP[e.code]) { keys.add(e.code); syncKeys(); e.preventDefault(); }
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') { if (!e.repeat && document.activeElement.tagName !== 'BUTTON') { Wd.launch(s); e.preventDefault(); } }
      else if (e.key === 'Escape' && !$('modal').hidden) $('modal').hidden = true;
    });
    document.addEventListener('keyup', e => { if (keys.delete(e.code)) syncKeys(); });
    window.addEventListener('blur', () => { keys.clear(); syncKeys(); });
    const cv = $('scene'); let dragging = false;
    const aim = ev => {
      const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      const it = R.itemAt(x, y);
      if (it) Wd.goTo(it.x, it.y); else { const p = R.toWorld(x, y); Wd.goTo(p.x, p.y); }
    };
    cv.addEventListener('pointerdown', ev => { dragging = true; cv.setPointerCapture(ev.pointerId); aim(ev); });
    cv.addEventListener('pointermove', ev => { if (dragging) aim(ev); });
    cv.addEventListener('pointerup', () => { dragging = false; });
    cv.addEventListener('pointercancel', () => { dragging = false; });
    $('launchBtn').addEventListener('click', () => Wd.launch(s));
    $('travelBtn').addEventListener('click', () => Wd.travel(s));
    document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  }

  /* ---------- Boucle ---------- */
  let lastUi = 0, lastSave = Date.now();
  function loop(now) {
    const dt = R.frame(now);
    if (dt) Wd.update(s, dt);
    if (now - lastUi > 120) { lastUi = now; hud(); refreshGear(); if (tab === 'opt') refreshStats(); }
    if (Date.now() - lastSave > 10000) { Wd.save(s); lastSave = Date.now(); }
    requestAnimationFrame(loop);
  }
  function afterLoad() {
    lang = s.settings.lang || ((navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en');
    lastStage = -1; setLang(lang);
  }
  function start(data) {
    s = null;
    if (data && data.save) { try { const o = JSON.parse(data.save); if (o && o.v === 3) { s = Wd.fresh(); Object.assign(s, o); } } catch (e) { s = null; } }
    const loaded = !!(s || (s = Wd.load()));
    if (!s) s = Wd.fresh();
    Wd.reset(s);
    R.init($('scene'), () => s);
    G.dbg = () => s; // accès de test depuis la console
    try { const t = localStorage.getItem('feedthesun.v3.tab'); if (t && $('tab-' + t)) tab = t; } catch (e) { /* stockage indisponible */ }
    bindInputs(); afterLoad();
    if (!loaded) modal(T('introTitle'), [T('introText1'), T('introText2')], [{ label: T('introGo'), cls: 'btn-sun' }]);
    requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => { if (document.hidden) Wd.save(s); });
    window.addEventListener('pagehide', () => Wd.save(s));
    document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { try { localStorage.setItem('feedthesun.v3.tab', b.dataset.tab); } catch (e) { /* stockage indisponible */ } }));
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ save: JSON.stringify(s) }));
  }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
