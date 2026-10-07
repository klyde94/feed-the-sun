'use strict';
/* Feed the Sun v3 — les trois pages qui montent du bas : Améliorer, Arbre (à parcourir en glissant), Réglages. */
(function () {
  const G = window.FTS3, Wd = G.W;
  const P = (G.P = { sig: {}, up: {}, sel: 'root', pan: null });
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const U = () => G.U;

  function row(box, ups, o) {
    const r = el('div', 'shop-row' + (o.big ? ' is-big' : ''));
    const main = el('div', 'shop-main'), eff = el('div', 'shop-eff');
    main.append(el('div', 'shop-name', o.name), eff);
    if (o.desc) main.append(el('div', 'shop-desc', o.desc));
    const btn = el('button', 'buy-btn'); btn.type = 'button'; btn.append(el('span', 'buy-cost'));
    btn.onclick = () => { if (o.onBuy()) { U().sfx('buy'); P.render(true); } };
    r.append(main, btn); box.append(r);
    ups.push(() => {
      const v = o.view();
      if (eff.textContent !== (v.eff || '')) eff.textContent = v.eff || '';
      btn.disabled = !!v.max || !!v.locked; btn.classList.toggle('can', !!v.can);
      const c = v.max ? U().T('maxed') : v.cost; if (btn.firstChild.textContent !== c) btn.firstChild.textContent = c;
    });
  }
  const head = (box, title, note) => { box.append(el('h3', 'shop-head', title)); if (note) box.append(el('p', 'muted small', note)); };

  /* ---------- Améliorer ---------- */
  function buildShop(box, ups, s) {
    const { T, fmt, fmtNum, modal, roman } = U();
    const num = v => (Number.isInteger(v) ? String(v) : fmtNum(v));
    const gearRow = g => row(box, ups, {
      name: T('gear.' + g.id), onBuy: () => Wd.buyGear(s, g.id),
      view: () => { const l = s.gear[g.id], u = T('gear.' + g.id + '.u'); return { eff: u.replace('{v}', num(g.eff(l)) + (l < g.max ? ' → ' + num(g.eff(l + 1)) : '')), max: l >= g.max, can: Wd.canGear(s, g.id), cost: fmt(Wd.gearCost(s, g.id)) + ' $' }; },
    });
    const hireRow = h => row(box, ups, {
      name: T('hire.' + h.id), desc: T('hire.' + h.id + '.d'), big: true, onBuy: () => Wd.hire(s, h.id),
      view: () => { const n = s.team[h.id]; return { eff: h.max > 1 ? T('hired', { n, m: h.max }) + (n ? ' · ' + T('avgLvl', { n: s.crew[h.zone].lvl }) : '') : (n ? T('hiredOne') : ''), max: n >= h.max, can: Wd.canHire(s, h.id), cost: fmt(Wd.hireCost(s, h.id)) + ' $' }; },
    });
    const sec = id => G.GEAR.filter(g => g.sec === id).forEach(gearRow);
    head(box, T('me')); sec('me');
    head(box, T('depot')); sec('depot');
    if (s.launches >= 1) {
      head(box, T('city'), T('cityNote'));
      ['north', 'east', 'port'].forEach(id => row(box, ups, {
        name: T('district.' + id), desc: T('district.' + id + '.d'), big: true, onBuy: () => Wd.openDistrict(s, id),
        view: () => ({ eff: s.districts[id] ? T('opened') : '', max: !!s.districts[id], can: Wd.canDistrict(s, id), cost: fmt(Wd.districtCost(s, id)) + ' $' }),
      }));
      sec('city');
      head(box, T('crew'));
      hireRow(G.HIRES[0]);
      if (s.team.collector >= 1) hireRow(G.HIRES[1]);
      if (s.team.collector >= 3) G.TEAM_UPS.forEach(u => row(box, ups, {
        name: T('team.' + u.id), onBuy: () => Wd.buyTup(s, u.id),
        view: () => { const l = s.teamUps[u.id], t = T('team.' + u.id + '.u'); return { eff: t.replace('{v}', num(u.eff(l)) + (l < u.max ? ' → ' + num(u.eff(l + 1)) : '')), max: l >= u.max, can: Wd.canTup(s, u.id), cost: fmt(Wd.tupCost(s, u.id)) + ' $' }; },
      }));
    }
    head(box, T('myShip'), s.ship ? null : T('shipLocked'));
    if (!s.ship) row(box, ups, { name: T('buyShip'), desc: T('shipDesc'), big: true, onBuy: () => Wd.buyShip(s), view: () => ({ locked: s.saved < 1, can: Wd.canShip(s), cost: s.saved < 1 ? T('afterSave') : fmt(Wd.shipCost(s)) + ' $' }) });
    else { hireRow(G.HIRES[2]); if (s.team.pilot >= 1) hireRow(G.HIRES[3]); sec('ship'); }
    if (s.saved >= 1) {
      head(box, T('jumpTitle'), T('jumpDesc'));
      if (Wd.canJump(s)) {
        const b = el('button', 'btn btn-sun', T('jumpBtn', { g: roman(s.jumps + 2) }) + ' · +' + Wd.jumpGain(s)); b.type = 'button';
        b.onclick = () => modal(T('jumpConfirm', { g: roman(s.jumps + 2) }), [T('jumpGain', { n: Wd.jumpGain(s) })], [{ label: T('jumpGo'), cls: 'btn-sun', fn: () => { Wd.jump(s); Wd.save(s); P.render(true); } }, { label: T('cancel'), cls: 'btn-ghost' }]);
        box.append(b);
      } else box.append(el('p', 'muted small', T('jumpLocked', { n: G.JUMP_REQ, c: s.savedRun })));
    }
  }

  /* ---------- Arbre ---------- */
  function buildTree(box, ups, s) {
    const { T } = U();
    const bar = el('div', 'tree-bar'), pts = el('div', 'tree-pts'); bar.append(pts, el('div', 'muted small', T('treeHint'))); box.append(bar);
    ups.push(() => { pts.textContent = '✦ ' + s.skillPts + ' ' + T('skillPts') + '   ★ ' + s.techPts + ' ' + T('techPts'); });
    const view = el('div', 'tree-view'), pan = el('div', 'tree-pan'); view.append(pan); box.append(view);
    const SIZE = 1400, O = SIZE / 2;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('width', SIZE); svg.setAttribute('height', SIZE); svg.classList.add('tree-lines');
    pan.append(svg);
    const nodes = {};
    G.TREE.forEach(n => {
      if (n.parent) {
        const p = Wd.node(n.parent), ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        ln.setAttribute('x1', O + p.x); ln.setAttribute('y1', O + p.y); ln.setAttribute('x2', O + n.x); ln.setAttribute('y2', O + n.y); svg.append(ln);
        ups.push(() => ln.setAttribute('class', s.tree[n.id] ? 'on' : s.tree[n.parent] ? 'next' : ''));
      }
      const b = el('button', 'tnode ' + (n.type || 'root')); b.type = 'button'; b.style.left = O + n.x + 'px'; b.style.top = O + n.y + 'px';
      b.append(el('span', 'tnode-ico', n.type === 'tech' ? '★' : n.type === 'skill' ? '✦' : '◉'), el('span', 'tnode-name', T(n.id === 'root' ? 'treeRoot' : (n.type === 'tech' ? 'tech.' : 'skill.') + n.id)), el('span', 'tnode-lvl'));
      b.onclick = () => { if (P.moved) return; P.sel = n.id; detail(); };
      pan.append(b); nodes[n.id] = b;
      ups.push(() => {
        const st = Wd.nodeState(s, n); b.className = 'tnode ' + (n.type || 'root') + ' is-' + st + (P.sel === n.id ? ' is-sel' : '');
        b.lastChild.textContent = n.type === 'tech' ? (s.tree[n.id] || 0) + '/' + n.max : '';
      });
    });
    const card = el('div', 'tree-card'); box.append(card);
    function detail() {
      card.innerHTML = '';
      const n = Wd.node(P.sel), pre = n.type === 'tech' ? 'tech.' : 'skill.';
      if (n.id === 'root') { card.append(el('div', 'tc-name', T('treeRoot')), el('div', 'muted small', T('treeRootD'))); return; }
      card.append(el('div', 'tc-name', T(pre + n.id)), el('div', 'tc-desc', T(pre + n.id + '.d')));
      if (n.type === 'tech') card.append(el('div', 'tc-fact', T('tech.' + n.id + '.f')));
      const st = Wd.nodeState(s, n), b = el('button', 'btn ' + (st === 'can' ? 'btn-sun' : 'btn-ghost')); b.type = 'button';
      const cost = Wd.nodeCost(s, n), unit = n.type === 'tech' ? '★' : '✦';
      b.textContent = st === 'owned' ? T('learned') : st === 'locked' ? T('locked') : T('learnFor', { n: cost, u: unit });
      b.disabled = st !== 'can';
      b.onclick = () => { if (Wd.treeBuy(s, n.id)) { U().sfx('learn'); P.render(true); } };
      card.append(b);
    }
    detail();
    const st = P.pan || { x: 0, y: 0 };
    const apply = () => { pan.style.transform = 'translate(' + (st.x - O) + 'px,' + (st.y - O) + 'px)'; };
    requestAnimationFrame(() => { if (!P.pan) { st.x = view.clientWidth / 2; st.y = view.clientHeight / 2 + 40; } P.pan = st; apply(); });
    apply();
    let drag = null;
    view.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, sx: st.x, sy: st.y }; P.moved = false; });
    view.addEventListener('pointermove', e => {
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) { P.moved = true; if (!view.hasPointerCapture(e.pointerId)) view.setPointerCapture(e.pointerId); }
      if (P.moved) { st.x = drag.sx + dx; st.y = drag.sy + dy; apply(); }
    });
    const end = () => { drag = null; setTimeout(() => { P.moved = false; }, 0); };
    view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
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
    const a = sec(T('achTitle')); a.append(el('p', 'muted small', T('achHead', { n: Wd.achCount(s), m: G.ACHIEVEMENTS.length, p: Math.round(Wd.achCount(s) * G.ACH_BONUS * 100) })));
    const grid = el('div', 'ach-grid');
    G.ACHIEVEMENTS.forEach(x => { const [n, d] = U().A(x.id), c = el('div', 'ach' + (s.ach[x.id] ? ' got' : '')); c.append(el('div', 'ach-name', n), el('div', 'ach-desc', d)); grid.append(c); });
    a.append(grid);
    const row2 = el('div', 'btn-row');
    [['oldVersion', 'https://klyde94.github.io/feed-the-sun/v2/'], ['plan', 'https://klyde94.github.io/feed-the-sun/plan.html']].forEach(([k, href]) => { const x = el('a', 'btn btn-ghost', T(k)); x.href = href; x.target = '_blank'; x.rel = 'noopener'; row2.append(x); });
    sec(T('version')).append(row2);
    const rb = el('button', 'btn btn-danger', T('resetBtn')); rb.type = 'button';
    rb.onclick = () => modal(T('resetConfirm'), [T('resetText')], [{ label: T('resetGo'), cls: 'btn-danger', fn: () => U().reset() }, { label: T('cancel'), cls: 'btn-ghost' }]);
    sec(T('resetTitle')).append(rb);
  }

  const BUILD = { shop: buildShop, tree: buildTree, opt: buildOptions };
  function signature(tab, s) {
    const base = U().lang() + '|';
    if (tab === 'shop') return base + [s.ship, s.jumps, s.launches >= 1, s.team.collector >= 1, s.team.collector >= 3, s.saved, Wd.canJump(s), s.team.pilot >= 1].join();
    if (tab === 'tree') return base + 'tree';
    return base + s.settings.sound + U().canInstall() + Wd.achCount(s);
  }
  P.render = force => {
    const tab = U().tab(); if (!tab) return;
    const s = U().state(), box = document.getElementById('sheetBody'), sig = signature(tab, s);
    if (force || sig !== P.sig[tab] || box.dataset.tab !== tab) {
      const keep = tab === 'shop' ? box.scrollTop : 0;
      P.sig[tab] = sig; box.innerHTML = ''; box.dataset.tab = tab; P.up[tab] = []; BUILD[tab](box, P.up[tab], s);
      if (tab === 'shop') box.scrollTop = keep;
    }
    (P.up[tab] || []).forEach(f => f());
  };
  P.dots = s => ({
    shop: G.GEAR.some(g => Wd.canGear(s, g.id)) || G.HIRES.some(h => Wd.canHire(s, h.id) && (h.id !== 'operator' || s.team.collector)) || ['north', 'east', 'port'].some(id => s.launches >= 1 && Wd.canDistrict(s, id)) || Wd.canShip(s),
    tree: G.TREE.some(n => Wd.nodeState(s, n) === 'can'),
  });
})();
