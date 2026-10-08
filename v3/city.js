'use strict';
/* Feed the Sun v3 — la ville vue de dessus : carte en tuiles, quartiers, collisions, chemins (A*), points d'apparition des déchets.
   Unité : 1 = une tuile. */
(function () {
  const G = window.FTS3;
  const C = (G.CITY = {});
  C.W = 52; C.H = 36;
  C.ROADS_H = [5, 17, 29];
  C.ROADS_V = [6, 18, 31, 44];
  C.T = { GRASS: 0, ROAD: 1, WALK: 2, PLAZA: 3, BUILD: 4, TREE: 5 };
  C.DEPOT = { x: 12.5, y: 23.5 };     // conteneur
  C.PAD = { x: 15, y: 23.5 };         // rampe de lancement
  C.START = { x: 11.5, y: 25.5 };
  C.DISTRICTS = [
    { id: 'centre', x0: 0, y0: 12, x1: 25, y1: 35 },
    { id: 'north', x0: 0, y0: 0, x1: 25, y1: 11 },
    { id: 'east', x0: 26, y0: 12, x1: 51, y1: 35 },
    { id: 'port', x0: 26, y0: 0, x1: 51, y1: 11 },
  ];
  const T = C.T;
  function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  C.districtAt = (x, y) => { for (let i = 0; i < C.DISTRICTS.length; i++) { const d = C.DISTRICTS[i]; if (x >= d.x0 && x <= d.x1 && y >= d.y0 && y <= d.y1) return i; } return 0; };

  /* ---------- Génération (une ville différente par planète) ---------- */
  C.build = seed => {
    const r = mulberry(seed * 7919 + 17), W = C.W, H = C.H;
    const t = new Uint8Array(W * H), dec = [], buildings = [];
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) t[y * W + x] = v; };
    for (const y of C.ROADS_H) for (let x = 0; x < W; x++) { set(x, y, T.ROAD); set(x, y + 1, T.ROAD); }
    for (const x of C.ROADS_V) for (let y = 0; y < H; y++) { set(x, y, T.ROAD); set(x + 1, y, T.ROAD); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (t[y * W + x] === T.ROAD) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && t[yy * W + xx] === T.ROAD) { near = true; break; } }
      if (near) t[y * W + x] = T.WALK;
    }
    const xs = [-2, ...C.ROADS_V, W], ys = [-2, ...C.ROADS_H, H];
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      const bx0 = xs[i] + 3, bx1 = xs[i + 1] - 2, by0 = ys[j] + 3, by1 = ys[j + 1] - 2;
      if (bx1 - bx0 < 2 || by1 - by0 < 2) continue;
      const depot = C.DEPOT.x >= bx0 && C.DEPOT.x <= bx1 + 1 && C.DEPOT.y >= by0 && C.DEPOT.y <= by1 + 1;
      const roll = r(), kind = depot ? 'plaza' : roll < 0.58 ? 'build' : roll < 0.86 ? 'park' : 'plaza';
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) set(x, y, kind === 'park' ? T.GRASS : T.PLAZA);
      if (kind === 'build') {
        let x = bx0;
        while (x <= bx1 - 1) {
          const w = Math.min(bx1 - x + 1, 3 + Math.floor(r() * 4)), h = by1 - by0;
          if (w < 2) break;
          for (let yy = by0; yy < by0 + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, T.BUILD);
          buildings.push({ x, y: by0, w, h, roof: Math.floor(r() * 6), floors: 1 + Math.floor(r() * 3) });
          x += w + 1;
        }
      } else if (kind === 'park') {
        for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (r() < 0.13 && x % 2 === y % 2) { set(x, y, T.TREE); }
        if (r() < 0.6) dec.push({ type: 'pond', x: (bx0 + bx1) / 2 + 0.5, y: (by0 + by1) / 2 + 0.5, r: Math.min(bx1 - bx0, by1 - by0) * 0.28 });
      } else if (!depot) {
        for (let k = 0; k < 3; k++) dec.push({ type: 'bench', x: bx0 + 0.5 + r() * (bx1 - bx0), y: by0 + 0.5 + r() * (by1 - by0) });
      }
    }
    for (let k = 0; k < 40; k++) { const x = Math.floor(r() * W), y = Math.floor(r() * H); if (t[y * W + x] === T.WALK) dec.push({ type: 'bin', x: x + 0.5, y: y + 0.5 }); }
    for (const p of [C.DEPOT, C.PAD]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) set(Math.floor(p.x) + dx, Math.floor(p.y) + dy, T.PLAZA);
    const city = { t, buildings, dec, seed };
    city.spawns = C.DISTRICTS.map(() => []);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = t[y * W + x];
      if (v === T.BUILD || v === T.TREE) continue;
      if (Math.hypot(x + 0.5 - C.DEPOT.x, y + 0.5 - C.DEPOT.y) < 3.5) continue;
      const w = v === T.WALK ? 3 : v === T.GRASS ? 2 : v === T.PLAZA ? 2 : 1;
      city.spawns[C.districtAt(x, y)].push({ x, y, w });
    }
    return city;
  };

  /* ---------- Collisions ---------- */
  C.tile = (city, x, y) => (x < 0 || y < 0 || x >= C.W || y >= C.H ? T.BUILD : city.t[y * C.W + x]);
  C.open = (city, s, x, y) => { const v = C.tile(city, x, y); return v !== T.BUILD && v !== T.TREE && !!s.districts[C.DISTRICTS[C.districtAt(x, y)].id]; };
  C.freeAt = (city, s, px, py, rad = 0.28) => {
    for (const [dx, dy] of [[-rad, -rad], [rad, -rad], [-rad, rad], [rad, rad]]) if (!C.open(city, s, Math.floor(px + dx), Math.floor(py + dy))) return false;
    return true;
  };

  /* ---------- Chemins (A* sur 8 voisins, sans couper les coins) ---------- */
  C.path = (city, s, x0, y0, x1, y1) => {
    const W = C.W, sx = Math.floor(x0), sy = Math.floor(y0);
    let tx = Math.floor(x1), ty = Math.floor(y1);
    if (!C.open(city, s, tx, ty)) {
      let best = null, bd = 1e9;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = tx + dx, yy = ty + dy; if (C.open(city, s, xx, yy)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [xx, yy]; } } }
      if (!best) return null; [tx, ty] = best;
    }
    const start = sy * W + sx, goal = ty * W + tx;
    if (start === goal) return [{ x: x1, y: y1 }];
    const g = new Map([[start, 0]]), came = new Map(), open = [[0, start]], closed = new Set();
    const h = i => { const dx = Math.abs((i % W) - tx), dy = Math.abs(Math.floor(i / W) - ty); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
    let guard = 0;
    while (open.length && guard++ < 4000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur] = open.splice(bi, 1)[0];
      if (cur === goal) break;
      if (closed.has(cur)) continue; closed.add(cur);
      const cx = cur % W, cy = Math.floor(cur / W);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!C.open(city, s, nx, ny)) continue;
        if (dx && dy && (!C.open(city, s, cx + dx, cy) || !C.open(city, s, cx, cy + dy))) continue;
        const ni = ny * W + nx, ng = g.get(cur) + (dx && dy ? 1.41 : 1);
        if (ng < (g.has(ni) ? g.get(ni) : 1e9)) { g.set(ni, ng); came.set(ni, cur); open.push([ng + h(ni), ni]); }
      }
    }
    if (!came.has(goal)) return null;
    const pts = []; let c = goal;
    while (c !== start) { pts.push({ x: (c % W) + 0.5, y: Math.floor(c / W) + 0.5 }); c = came.get(c); }
    pts.reverse();
    if (pts.length) pts[pts.length - 1] = { x: x1, y: y1 };
    return pts;
  };

  /* ---------- Apparition des déchets ---------- */
  C.spawnTile = (city, s) => {
    const list = [];
    C.DISTRICTS.forEach((d, i) => { if (s.districts[d.id]) list.push(...city.spawns[i]); });
    let total = 0; for (const p of list) total += p.w;
    let r = Math.random() * total;
    for (const p of list) { r -= p.w; if (r <= 0) return p; }
    return list[0];
  };
})();
