'use strict';
/* Feed the Sun v3 — contenu des onglets : Équipement, Équipe, Arbres, Galaxie, Options.
   Chaque onglet est construit une fois (tant que sa structure ne change pas), puis mis à jour sur place. */
(function () {
  const G = window.FTS3, Wd = G.W;
  const P = (G.P = { sig: {}, up: {}, treeView: 'skills' });
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const U = () => G.U;

  function card(box, ups, o) {
    const r = el('div', 'gen-row up-row' + (o.locked ? ' is-locked' : ''));
    const main = el('div', 'gen-main'), top = el('div', 'gen-top'), name = el('span', 'gen-name', o.name), badge = el('span', 'gen-count');
    top.append(name, badge); main.append(top, el('div', 'gen-desc', o.desc));
    const info = el('div', 'gen-prod'); main.append(info);
    if (o.fact) { const d = el('details', 'fact'); d.append(el('summary', null, U().T('factLabel')), el('p', null, o.fact)); main.append(d); }
    r.append(main);
    let btn = null;
    if (o.onBuy) { btn = el('button', 'buy-btn'); btn.type = 'button'; btn.append(el('span', 'buy-qty'), el('span', 'buy-cost')); btn.onclick = () => { if (o.onBuy()) { U().sfx('buy'); P.render(true); } }; r.append(btn); }
    box.append(r);
    ups.push(() => {
      const v = o.view();
      if (badge.textContent !== v.badge) badge.textContent = v.badge || '';
      if (info.textContent !== (v.info || '')) info.textContent = v.info || '';
      if (btn) { btn.disabled = !!v.disabled; btn.classList.toggle('can', !!v.can); btn.children[0].textContent = v.qty || ''; btn.children[1].textContent = v.cost || ''; }
    });
  }
  const section = (box, title, text) => { const s = el('section', 'panel-sec'); s.append(el('h3', null, title)); if (text) s.append(el('p', 'muted', text)); box.append(s); return s; };

  /* ---------- Équipement ---------- */
  function buildGear(box, ups, s) {
    const { T, fmt, fmtNum } = U();
    const gearCards = who => G.GEAR.filter(g => g.who === who).forEach(g => card(box, ups, {
      name: T('gear.' + g.id), desc: T('gear.' + g.id + '.d'), onBuy: () => Wd.buyGear(s, g.id),
      view: () => { const l = s.gear[g.id], max = l >= g.max, v = g.eff(l); return { badge: T('lvl', { n: l }), info: T('now', { v: T('gear.' + g.id + '.u').replace('{v}', Number.isInteger(v) ? v : fmtNum(v)) }), disabled: max, can: Wd.canGear(s, g.id), qty: max ? '' : '+1', cost: max ? T('maxed') : fmt(Wd.gearCost(s, g.id)) + ' $' }; },
    }));
    section(box, T('me')); gearCards('me');
    section(box, T('myShip'));
    if (!s.ship) card(box, ups, { name: T('buyShip'), desc: T('shipDesc'), onBuy: () => Wd.buyShip(s), view: () => ({ can: s.money >= G.SHIP_COST, qty: '', cost: fmt(G.SHIP_COST) + ' $' }) });
    else gearCards('ship');
  }

  /* ---------- Équipe ---------- */
  function buildTeam(box, ups, s) {
    const { T, fmt, fmtNum } = U();
    box.append(el('p', 'muted', T('teamIntro')));
    G.HIRES.forEach(h => card(box, ups, {
      name: T('hire.' + h.id), desc: T('hire.' + h.id + '.d'), locked: h.needShip && !s.ship, onBuy: () => Wd.hire(s, h.id),
      view: () => {
        const n = s.team[h.id], max = n >= h.max, crew = s.crew[h.zone], lvlTxt = n && h.max > 1 ? ' · ' + T('avgLvl', { n: crew.lvl }) : '';
        if (h.needShip && !s.ship) return { badge: '', info: T('shipNeed'), disabled: true, cost: '' };
        return { badge: T('hired', { n, m: h.max }), info: lvlTxt.slice(3), disabled: max, can: Wd.canHire(s, h.id), qty: max ? '' : T('hireBtn'), cost: max ? T('maxed') : fmt(Wd.hireCost(s, h.id)) + ' $' };
      },
    }));
    section(box, T('teamUps'));
    G.TEAM_UPS.forEach(u => card(box, ups, {
      name: T('team.' + u.id), desc: T('team.' + u.id + '.d'), onBuy: () => Wd.buyTup(s, u.id),
      view: () => { const l = s.teamUps[u.id], max = l >= u.max, v = u.eff(l); return { badge: T('lvl', { n: l }), info: T('now', { v: T('team.' + u.id + '.u').replace('{v}', Number.isInteger(v) ? v : fmtNum(v)) }), disabled: max, can: Wd.canTup(s, u.id), qty: max ? '' : '+1', cost: max ? T('maxed') : fmt(Wd.tupCost(s, u.id)) + ' $' }; },
    }));
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
    const pts = el('p', 'points'); box.append(pts);
    ups.push(() => { pts.textContent = T('points', { n: skills ? s.skillPts : s.techPts }); });
    const grid = el('div', 'tree-grid'); box.append(grid);
    (skills ? G.SKILLS : G.TECHS).forEach(b => {
      const col = el('div', 'tree-col'); col.append(el('div', 'tree-head', T('branch.' + b.branch)));
      b.nodes.forEach((n, i) => {
        const node = el('button', 'node'); node.type = 'button';
        const nm = el('span', 'node-name', T((skills ? 'skill.' : 'tech.') + n.id)), ds = el('span', 'node-desc', T((skills ? 'skill.' : 'tech.') + n.id + '.d')), st = el('span', 'node-state');
        node.append(nm, ds, st);
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
    const j = section(box, T('jumpTitle'), T('jumpDesc'));
    if (Wd.canJump(s)) {
      j.append(el('p', 'jump-gain', T('jumpGain', { n: Wd.jumpGain(s) })), el('p', 'muted', T('jumpRule')));
      const b = el('button', 'btn btn-sun', T('jumpBtn', { g: roman(s.jumps + 2) })); b.type = 'button';
      b.onclick = () => modal(T('jumpConfirm', { g: roman(s.jumps + 2) }), [T('jumpGain', { n: Wd.jumpGain(s) })], [{ label: T('jumpGo'), cls: 'btn-sun', fn: () => { Wd.jump(s); Wd.save(s); P.render(true); } }, { label: T('cancel'), cls: 'btn-ghost' }]);
      j.append(b);
    } else {
      j.append(el('p', 'muted', T('jumpLocked', { n: G.JUMP_REQ, c: s.savedRun })));
      const bar = el('div', 'bar'), f = el('div', 'bar-fill'); f.style.width = (s.savedRun / G.JUMP_REQ) * 100 + '%'; bar.append(f); j.append(bar);
    }
    const a = section(box, T('achTitle'), T('achHead', { n: Wd.achCount(s), m: G.ACHIEVEMENTS.length, p: Math.round(Wd.achCount(s) * G.ACH_BONUS * 100) }));
    const grid = el('div', 'ach-grid');
    G.ACHIEVEMENTS.forEach(x => { const [n, d] = U().A(x.id), c = el('div', 'ach' + (s.ach[x.id] ? ' got' : '')); c.append(el('div', 'ach-name', n), el('div', 'ach-desc', d)); grid.append(c); });
    a.append(grid);
  }

  /* ---------- Options ---------- */
  function buildOptions(box, ups, s) {
    const { T, fmt, fmtTime, modal, setLang } = U();
    const a = section(box, T('lang')), seg = el('div', 'seg');
    [['fr', 'Français'], ['en', 'English']].forEach(([k, label]) => { const b = el('button', 'seg-btn' + (U().lang() === k ? ' is-on' : ''), label); b.type = 'button'; b.onclick = () => setLang(k); seg.append(b); });
    a.append(seg);
    const b = section(box, T('sound')), snd = el('button', 'btn btn-ghost', s.settings.sound ? T('on') : T('off')); snd.type = 'button';
    snd.onclick = () => { s.settings.sound = !s.settings.sound; P.render(true); }; b.append(snd);
    section(box, T('controls'), T('controlsText'));
    const inst = section(box, T('installTitle'), T('installText'));
    if (U().canInstall()) { const ib = el('button', 'btn btn-sun', T('installBtn')); ib.type = 'button'; ib.onclick = () => U().install(); inst.append(ib); }
    const st = section(box, T('stats')), dl = el('dl', 'stats'); st.append(dl);
    ups.push(() => {
      const rows = [[T('stTime'), fmtTime(s.playTime)], [T('stSent'), fmt(s.sent)], [T('stMoney'), fmt(s.moneyLife) + ' $'], [T('stPlanets'), String(s.saved)], [T('stGold'), String(s.goldLife)], [T('stJumps'), String(s.jumps)]];
      if (dl.children.length !== rows.length * 2) { dl.innerHTML = ''; rows.forEach(() => dl.append(el('dt'), el('dd'))); }
      rows.forEach(([k2, v], i) => { dl.children[i * 2].textContent = k2; dl.children[i * 2 + 1].textContent = v; });
    });
    const ln = section(box, T('version')), row = el('div', 'btn-row');
    [['oldVersion', 'https://klyde94.github.io/feed-the-sun/v2/'], ['plan', 'https://klyde94.github.io/feed-the-sun/plan.html']].forEach(([k, href]) => { const x = el('a', 'btn btn-ghost', T(k)); x.href = href; x.target = '_blank'; x.rel = 'noopener'; row.append(x); });
    ln.append(row);
    const r = section(box, T('resetTitle')), rb = el('button', 'btn btn-danger', T('resetBtn')); rb.type = 'button';
    rb.onclick = () => modal(T('resetConfirm'), [T('resetText')], [{ label: T('resetGo'), cls: 'btn-danger', fn: () => U().reset() }, { label: T('cancel'), cls: 'btn-ghost' }]);
    r.append(rb);
  }

  const BUILD = { gear: buildGear, team: buildTeam, trees: buildTrees, galaxy: buildGalaxy, opt: buildOptions };
  function signature(tab, s) {
    const base = U().lang() + '|';
    if (tab === 'gear') return base + s.ship + s.jumps;
    if (tab === 'team') return base + s.ship + s.jumps;
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
  P.dots = s => ({
    gear: G.GEAR.some(g => Wd.canGear(s, g.id)) || (!s.ship && s.money >= G.SHIP_COST),
    team: G.HIRES.some(h => Wd.canHire(s, h.id)),
    trees: s.skillPts > 0 || G.TECHS.some(b => b.nodes.some(n => (s.tech[n.id] || 0) < n.max && s.techPts >= G.techCost(s.tech[n.id] || 0))),
    galaxy: Wd.canJump(s),
  });
})();
