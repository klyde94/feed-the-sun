'use strict';
/* Feed the Sun v3 — onglets : Améliorer (toi, équipe, vaisseau), Arbres, Galaxie, Réglages.
   Les sections apparaissent au moment où elles servent. Chaque onglet est construit une fois, puis mis à jour sur place. */
(function () {
  const G = window.FTS3, Wd = G.W;
  const P = (G.P = { sig: {}, up: {}, treeView: 'skills' });
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const U = () => G.U;

  /* Une ligne d'achat compacte : nom, effet (avant → après), prix. */
  function row(box, ups, o) {
    const r = el('div', 'shop-row' + (o.big ? ' is-big' : ''));
    const main = el('div', 'shop-main'), name = el('div', 'shop-name', o.name), eff = el('div', 'shop-eff');
    main.append(name, eff);
    if (o.desc) main.append(el('div', 'shop-desc', o.desc));
    const btn = el('button', 'buy-btn'); btn.type = 'button'; btn.append(el('span', 'buy-cost'));
    btn.onclick = () => { if (o.onBuy()) { U().sfx('buy'); P.render(true); } };
    r.append(main, btn); box.append(r);
    ups.push(() => {
      const v = o.view();
      if (eff.textContent !== v.eff) eff.textContent = v.eff || '';
      btn.disabled = !!v.max; btn.classList.toggle('can', !!v.can);
      const c = v.max ? U().T('maxed') : v.cost; if (btn.firstChild.textContent !== c) btn.firstChild.textContent = c;
    });
  }
  const head = (box, title) => box.append(el('h3', 'shop-head', title));

  /* ---------- Améliorer ---------- */
  function buildShop(box, ups, s) {
    const { T, fmt, fmtNum } = U();
    const num = v => (Number.isInteger(v) ? String(v) : fmtNum(v));
    const gearRow = g => row(box, ups, {
      name: T('gear.' + g.id), onBuy: () => Wd.buyGear(s, g.id),
      view: () => { const l = s.gear[g.id], u = T('gear.' + g.id + '.u'); return { eff: u.replace('{v}', num(g.eff(l)) + (l < g.max ? ' → ' + num(g.eff(l + 1)) : '')), max: l >= g.max, can: Wd.canGear(s, g.id), cost: fmt(Wd.gearCost(s, g.id)) + ' $' }; },
    });
    const hireRow = h => row(box, ups, {
      name: T('hire.' + h.id), desc: T('hire.' + h.id + '.d'), big: true, onBuy: () => Wd.hire(s, h.id),
      view: () => { const n = s.team[h.id]; return { eff: h.max > 1 ? T('hired', { n, m: h.max }) + (n ? ' · ' + T('avgLvl', { n: s.crew[h.zone].lvl }) : '') : (n ? T('hiredOne') : ''), max: n >= h.max, can: Wd.canHire(s, h.id), cost: fmt(Wd.hireCost(s, h.id)) + ' $' }; },
    });
    head(box, T('me'));
    G.GEAR.filter(g => g.who === 'me').forEach(gearRow);
    if (s.launches >= 1 || s.team.collector) {
      head(box, T('crew'));
      hireRow(G.HIRES[0]);
      if (s.team.collector >= 1) hireRow(G.HIRES[1]);
      if (s.team.collector >= 3) G.TEAM_UPS.forEach(u => row(box, ups, {
        name: T('team.' + u.id), onBuy: () => Wd.buyTup(s, u.id),
        view: () => { const l = s.teamUps[u.id], t = T('team.' + u.id + '.u'); return { eff: t.replace('{v}', num(u.eff(l)) + (l < u.max ? ' → ' + num(u.eff(l + 1)) : '')), max: l >= u.max, can: Wd.canTup(s, u.id), cost: fmt(Wd.tupCost(s, u.id)) + ' $' }; },
      }));
    }
    if (s.ship || s.saved >= 1 || s.money >= 150) {
      head(box, T('myShip'));
      if (!s.ship) row(box, ups, { name: T('buyShip'), desc: T('shipDesc'), big: true, onBuy: () => Wd.buyShip(s), view: () => ({ eff: '', can: s.money >= G.SHIP_COST, cost: fmt(G.SHIP_COST) + ' $' }) });
      else { hireRow(G.HIRES[2]); if (s.team.pilot >= 1) hireRow(G.HIRES[3]); G.GEAR.filter(g => g.who === 'ship').forEach(gearRow); }
    }
  }

  /* ---------- Arbres ---------- */
  function buildTrees(box, ups, s) {
    const { T } = U();
    const seg = el('div', 'seg tree-seg');
    [['skills', T('treesSkills') + ' · ' + s.skillPts], ['tech', T('treesTech') + ' · ' + s.techPts]].forEach(([k, label]) => {
      const b = el('button', 'seg-btn' + (P.treeView === k ? ' is-on' : ''), label); b.type = 'button'; b.onclick = () => { P.treeView = k; P.render(true); }; seg.append(b);
    });
    box.append(seg);
    const skills = P.treeView === 'skills';
    box.append(el('p', 'muted', skills ? T('skillsIntro') : T('techIntro')));
    const grid = el('div', 'tree-grid'); box.append(grid);
    (skills ? G.SKILLS : G.TECHS).forEach(b => {
      const col = el('div', 'tree-col'); col.append(el('div', 'tree-head', T('branch.' + b.branch)));
      b.nodes.forEach((n, i) => {
        const node = el('button', 'node'); node.type = 'button';
        const pre = skills ? 'skill.' : 'tech.', st = el('span', 'node-state');
        node.append(el('span', 'node-name', T(pre + n.id)), el('span', 'node-desc', T(pre + n.id + '.d')), st);
        if (!skills) node.title = T('tech.' + n.id + '.f');
        node.onclick = () => { if (skills ? Wd.learn(s, b.branch, i) : Wd.techUp(s, n.id)) { U().sfx('learn'); P.render(true); } };
        col.append(node);
        if (i < b.nodes.length - 1) col.append(el('div', 'node-link'));
        ups.push(() => {
          if (skills) {
            const state = Wd.skillState(s, b.branch, i);
            node.className = 'node is-' + state; node.disabled = state !== 'can';
            st.textContent = state === 'owned' ? T('learned') : state === 'locked' ? T('locked') : T('learn', { n: n.cost });
          } else {
            const l = s.tech[n.id] || 0, max = l >= n.max, cost = G.techCost(l);
            node.className = 'node ' + (max ? 'is-owned' : s.techPts >= cost ? 'is-can' : 'is-poor'); node.disabled = max || s.techPts < cost;
            st.textContent = T('upTech', { l, m: n.max, n: max ? '–' : cost });
          }
        });
      });
      grid.append(col);
    });
  }

  /* ---------- Galaxie ---------- */
  function buildGalaxy(box, ups, s) {
    const { T, fmt, modal, roman } = U();
    const sum = el('div', 'gal-summary');
    sum.append(el('div', 'stat-big', fmt(s.crystals)), el('div', 'stat-label', T('crystals')), el('div', 'stat-sub', T('crystalBonus', { p: Math.round(s.crystals * G.CRYSTAL_BONUS * 100) })));
    box.append(sum);
    const j = el('section', 'panel-sec'); j.append(el('h3', null, T('jumpTitle')), el('p', 'muted', T('jumpDesc'))); box.append(j);
    if (Wd.canJump(s)) {
      j.append(el('p', 'jump-gain', T('jumpGain', { n: Wd.jumpGain(s) })), el('p', 'muted', T('jumpRule')));
      const b = el('button', 'btn btn-sun', T('jumpBtn', { g: roman(s.jumps + 2) })); b.type = 'button';
      b.onclick = () => modal(T('jumpConfirm', { g: roman(s.jumps + 2) }), [T('jumpGain', { n: Wd.jumpGain(s) })], [{ label: T('jumpGo'), cls: 'btn-sun', fn: () => { Wd.jump(s); Wd.save(s); P.render(true); } }, { label: T('cancel'), cls: 'btn-ghost' }]);
      j.append(b);
    } else {
      j.append(el('p', 'muted', T('jumpLocked', { n: G.JUMP_REQ, c: s.savedRun })));
      const bar = el('div', 'bar'), f = el('div', 'bar-fill'); f.style.width = (s.savedRun / G.JUMP_REQ) * 100 + '%'; bar.append(f); j.append(bar);
    }
    const a = el('section', 'panel-sec'); a.append(el('h3', null, T('achTitle')), el('p', 'muted', T('achHead', { n: Wd.achCount(s), m: G.ACHIEVEMENTS.length, p: Math.round(Wd.achCount(s) * G.ACH_BONUS * 100) })));
    const grid = el('div', 'ach-grid');
    G.ACHIEVEMENTS.forEach(x => { const [n, d] = U().A(x.id), c = el('div', 'ach' + (s.ach[x.id] ? ' got' : '')); c.append(el('div', 'ach-name', n), el('div', 'ach-desc', d)); grid.append(c); });
    a.append(grid); box.append(a);
  }

  /* ---------- Réglages ---------- */
  function buildOptions(box, ups, s) {
    const { T, fmt, fmtTime, modal, setLang } = U();
    const sec = t => { const x = el('section', 'panel-sec'); x.append(el('h3', null, t)); box.append(x); return x; };
    const seg = el('div', 'seg');
    [['fr', 'Français'], ['en', 'English']].forEach(([k, label]) => { const b = el('button', 'seg-btn' + (U().lang() === k ? ' is-on' : ''), label); b.type = 'button'; b.onclick = () => setLang(k); seg.append(b); });
    sec(T('lang')).append(seg);
    const snd = el('button', 'btn btn-ghost', s.settings.sound ? T('on') : T('off')); snd.type = 'button';
    snd.onclick = () => { s.settings.sound = !s.settings.sound; P.render(true); }; sec(T('sound')).append(snd);
    sec(T('controls')).append(el('p', 'muted', T('controlsText')));
    const inst = sec(T('installTitle')); inst.append(el('p', 'muted', T('installText')));
    if (U().canInstall()) { const ib = el('button', 'btn btn-sun', T('installBtn')); ib.type = 'button'; ib.onclick = () => U().install(); inst.append(ib); }
    const dl = el('dl', 'stats'); sec(T('stats')).append(dl);
    ups.push(() => {
      const rows = [[T('stTime'), fmtTime(s.playTime)], [T('stSent'), fmt(s.sent)], [T('stMoney'), fmt(s.moneyLife) + ' $'], [T('stPlanets'), String(s.saved)], [T('stGold'), String(s.goldLife)], [T('stJumps'), String(s.jumps)]];
      if (dl.children.length !== rows.length * 2) { dl.innerHTML = ''; rows.forEach(() => dl.append(el('dt'), el('dd'))); }
      rows.forEach(([k2, v], i) => { dl.children[i * 2].textContent = k2; dl.children[i * 2 + 1].textContent = v; });
    });
    const row2 = el('div', 'btn-row');
    [['oldVersion', 'https://klyde94.github.io/feed-the-sun/v2/'], ['plan', 'https://klyde94.github.io/feed-the-sun/plan.html']].forEach(([k, href]) => { const x = el('a', 'btn btn-ghost', T(k)); x.href = href; x.target = '_blank'; x.rel = 'noopener'; row2.append(x); });
    sec(T('version')).append(row2);
    const rb = el('button', 'btn btn-danger', T('resetBtn')); rb.type = 'button';
    rb.onclick = () => modal(T('resetConfirm'), [T('resetText')], [{ label: T('resetGo'), cls: 'btn-danger', fn: () => U().reset() }, { label: T('cancel'), cls: 'btn-ghost' }]);
    sec(T('resetTitle')).append(rb);
  }

  const BUILD = { shop: buildShop, trees: buildTrees, galaxy: buildGalaxy, opt: buildOptions };
  function signature(tab, s) {
    const base = U().lang() + '|';
    if (tab === 'shop') return base + [s.ship, s.jumps, s.launches >= 1, s.team.collector >= 1, s.team.collector >= 3, s.team.operator, s.saved >= 1 || s.money >= 150, s.team.pilot >= 1].join();
    if (tab === 'trees') return base + P.treeView + JSON.stringify(s.skills) + JSON.stringify(s.tech) + s.skillPts + s.techPts;
    if (tab === 'galaxy') return base + s.crystals + Wd.canJump(s) + s.savedRun + Wd.achCount(s) + s.jumps;
    return base + s.settings.sound + U().canInstall();
  }
  P.render = force => {
    const s = U().state(), tab = U().tab(), box = document.getElementById('tab-' + tab);
    const sig = signature(tab, s);
    if (force || sig !== P.sig[tab]) { P.sig[tab] = sig; box.innerHTML = ''; P.up[tab] = []; BUILD[tab](box, P.up[tab], s); }
    (P.up[tab] || []).forEach(f => f());
  };
  /* Onglets visibles : ils apparaissent quand ils deviennent utiles. */
  P.visible = s => ({ shop: true, trees: s.level >= 2 || s.techPts > 0 || Object.keys(s.skills).length > 0, galaxy: s.saved >= 1 || s.jumps > 0, opt: true });
  P.dots = s => ({
    shop: G.GEAR.some(g => Wd.canGear(s, g.id)) || G.HIRES.some(h => Wd.canHire(s, h.id) && (h.id !== 'operator' || s.team.collector)) || (!s.ship && s.money >= G.SHIP_COST),
    trees: s.skillPts > 0 || G.TECHS.some(b => b.nodes.some(n => (s.tech[n.id] || 0) < n.max && s.techPts >= G.techCost(s.tech[n.id] || 0))),
    galaxy: Wd.canJump(s),
  });
})();
