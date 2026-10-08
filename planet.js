'use strict';
/* Feed the Sun v4 — les planètes ensevelies : paysage (biome), couche de déchets en grille fine, objet rare caché.
   Unité : 1 = une tuile. La grille de déchets a 2 cellules par tuile. */
(function () {
  const G = window.FTS3;
  const P = (G.PLANET = {});
  P.W = 64; P.H = 44; P.CPT = 2; P.GW = P.W * P.CPT; P.GH = P.H * P.CPT;
  P.DEPOT = { x: 32, y: 23 };          // le van
  P.PAD = { x: 37.2, y: 23 };          // rampe de lancement
  P.START = { x: 30.5, y: 24.5 };
  P.BIOMES = ['prairie', 'beach', 'forest', 'city', 'desert'];
  P.MAXCELL = 24;                      // déchets maximum par cellule (tas profonds)

  function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  P.mulberry = mulberry;
  function noise(seed) {
    const h = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7 + seed * 17.3) * 43758.5453; return v - Math.floor(v); };
    const vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
      const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1); return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; };
    return (x, y) => { let s = 0, amp = 0.5, f = 1; for (let o = 0; o < 4; o++) { s += amp * vn(x * f, y * f); amp *= 0.5; f *= 2; } return s / 0.94; };
  }
  P.noise = noise;

  /* ---------- Génération ---------- */
  P.build = n => {
    const biome = P.BIOMES[n % P.BIOMES.length], r = mulberry(n * 7919 + 101), nz = noise(n * 13 + 5), nz2 = noise(n * 31 + 9);
    const GW = P.GW, GH = P.GH, trash = new Float32Array(GW * GH), gold = new Uint8Array(GW * GH);
    const heaps = Array.from({ length: 34 }, () => ({ x: r() * GW, y: r() * GH, rad: (3 + r() * 7) * P.CPT, amp: 6 + r() * 10 }));
    const depth = 1 + 0.12 * n;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      let v = 2.4 + 12.6 * nz(x / 22, y / 22) * depth;
      for (const hp of heaps) { const d2 = ((x - hp.x) ** 2 + (y - hp.y) ** 2) / (hp.rad * hp.rad); if (d2 < 4) v += hp.amp * Math.exp(-d2 * 1.6); }
      const dd = Math.hypot(x / P.CPT - P.DEPOT.x - 1.5, y / P.CPT - P.DEPOT.y);
      if (dd < 4.5) v *= Math.max(0, (dd - 2.8) / 1.7);
      v = Math.max(0, Math.min(P.MAXCELL * (G.TRASH_K || 1), v * (G.TRASH_K || 1)));
      trash[y * GW + x] = v;
      if (v > 3 && r() < 0.004) gold[y * GW + x] = 1;
    }
    let nx, ny;
    do { nx = 4 + r() * (GW - 8); ny = 4 + r() * (GH - 8); } while (Math.hypot(nx / P.CPT - P.DEPOT.x, ny / P.CPT - P.DEPOT.y) < 16);
    // l'objet caché est enfoui, mais pas au fond d'un énorme tas : on allège un peu autour de lui
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const k = (Math.floor(ny) + j) * GW + Math.floor(nx) + i; trash[k] = Math.min(trash[k], 9 * (G.TRASH_K || 1)); gold[k] = 0; }
    let total = 0; for (let i = 0; i < trash.length; i++) total += trash[i];
    const decor = [];
    for (let k = 0; k < 140; k++) {
      const x = r() * P.W, y = r() * P.H; if (Math.hypot(x - P.DEPOT.x - 1.5, y - P.DEPOT.y) < 5) continue;
      const t = r(), type = biome === 'prairie' ? (t < 0.5 ? 'flower' : t < 0.8 ? 'tree' : 'rock')
        : biome === 'beach' ? (t < 0.4 ? 'shell' : t < 0.7 ? 'palm' : 'rock')
          : biome === 'forest' ? (t < 0.7 ? 'tree' : 'mushroom')
            : biome === 'city' ? (t < 0.5 ? 'lamp' : 'bench') : (t < 0.5 ? 'cactus' : 'rock');
      decor.push({ type, x, y, s: 0.7 + r() * 0.6 });
    }
    return { n, biome, seed: n * 7919 + 101, trash, gold, total, initial: total, needle: { cx: Math.floor(nx), cy: Math.floor(ny), state: 'hidden' }, decor, nz2 };
  };

  /* ---------- Aspiration ---------- */
  P.cellAt = (x, y) => [Math.floor(x * P.CPT), Math.floor(y * P.CPT)];
  /* Retire jusqu'à `want` déchets dans un disque. Renvoie { got, gold, cells } et marque les morceaux de carte à redessiner. */
  P.suck = (pl, x, y, rad, want, dirty) => {
    const GW = P.GW, GH = P.GH, cx = x * P.CPT, cy = y * P.CPT, rc = rad * P.CPT;
    const x0 = Math.max(0, Math.floor(cx - rc)), x1 = Math.min(GW - 1, Math.ceil(cx + rc)), y0 = Math.max(0, Math.floor(cy - rc)), y1 = Math.min(GH - 1, Math.ceil(cy + rc));
    let got = 0, gold = 0; const cells = [];
    for (let j = y0; j <= y1 && got < want; j++) for (let i = x0; i <= x1 && got < want; i++) {
      const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy); if (d > rc) continue;
      const k = j * GW + i, v = pl.trash[k]; if (v <= 0) continue;
      const fall = 1 - (d / rc) * 0.6, take = Math.min(v, (want - got) * fall + 0.02, v);
      const nv = v - take < 0.05 ? 0 : v - take;
      got += v - nv; pl.trash[k] = nv;
      if (nv === 0 && pl.gold[k]) { pl.gold[k] = 0; gold++; }
      if (cells.length < 6) cells.push([i, j]);
      if (dirty) dirty.add(((j >> 4) << 8) | (i >> 4));
    }
    pl.total = Math.max(0, pl.total - got);
    return { got, gold, cells };
  };
  /* Cherche une zone dense autour d'un point (pour les machines) */
  P.findDense = (pl, x, y, range, tries = 24) => {
    let best = null, bv = 0.3;
    if (pl.total < pl.initial * 0.08) bv = 0.04;
    for (let k = 0; k < tries; k++) {
      const a = Math.random() * Math.PI * 2, dist = Math.sqrt(Math.random()) * range, tx = x + Math.cos(a) * dist, ty = y + Math.sin(a) * dist;
      if (tx < 1 || ty < 1 || tx > P.W - 1 || ty > P.H - 1) continue;
      const i = Math.floor(tx * P.CPT), j = Math.floor(ty * P.CPT), v = pl.trash[j * P.GW + i] - dist * 0.05;
      if (v > bv) { bv = v; best = { x: tx, y: ty }; }
    }
    if (!best && pl.total > 0 && Math.random() < 0.25) {
      let bd = 1e9; const GW = P.GW;
      for (let k = 0; k < pl.trash.length; k += 3) if (pl.trash[k] > 0.04) { const tx = ((k % GW) + 0.5) / P.CPT, ty = (Math.floor(k / GW) + 0.5) / P.CPT, d = Math.abs(tx - x) + Math.abs(ty - y); if (d < bd) { bd = d; best = { x: tx, y: ty }; } }
    }
    return best;
  };
  P.amountAt = (pl, x, y) => { const i = Math.floor(x * P.CPT), j = Math.floor(y * P.CPT); return i < 0 || j < 0 || i >= P.GW || j >= P.GH ? 0 : pl.trash[j * P.GW + i]; };
  P.needleOpen = pl => { const nd = pl.needle; if (nd.state !== 'hidden') return false; let s = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += pl.trash[(nd.cy + j) * P.GW + nd.cx + i] || 0; return s < 0.5; };

  /* ---------- Sauvegarde compacte de la grille ---------- */
  /* 2 octets par cellule (millièmes) : les gros tas montent à 60 déchets, un seul octet les écrasait */
  P.encode = pl => { const n = pl.trash.length, b = new Uint8Array(n * 2); for (let i = 0; i < n; i++) { const v = Math.min(65535, Math.round(pl.trash[i] * 1000)); b[i * 2] = v & 255; b[i * 2 + 1] = v >> 8; } let s = ''; for (let i = 0; i < b.length; i += 4096) s += String.fromCharCode.apply(null, b.subarray(i, i + 4096)); return btoa(s); };
  P.decode = (pl, str) => {
    try {
      const s = atob(str), n = pl.trash.length; let t = 0;
      if (s.length === n * 2) for (let i = 0; i < n; i++) { pl.trash[i] = (s.charCodeAt(i * 2) | (s.charCodeAt(i * 2 + 1) << 8)) / 1000; t += pl.trash[i]; }
      else if (s.length === n) for (let i = 0; i < n; i++) { pl.trash[i] = s.charCodeAt(i) / 30; t += pl.trash[i]; }
      else return false;
      for (let i = 0; i < n; i++) if (pl.trash[i] <= 0) pl.gold[i] = 0;
      pl.total = t; return true;
    } catch (e) { return false; }
  };
})();
