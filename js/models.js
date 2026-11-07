// Orbit Acres: every model in the world, built from toy-like primitives.
// Origin is the middle of the footprint at ground level. The camera looks from
// the +x +z side, so doors and windows sit on those faces.
(function (root) {
  const OA = root.OA;
  const G = OA.Gfx;
  const T = root.THREE;
  const A = G.ART;
  const PI = Math.PI, PH = PI / 2;
  const W = 0xf4efff, W2 = 0xd9d2f5, DK = 0x3a2e78, DK2 = 0x2a2058, PLAT = 0x4a3d8f;
  const GOLD = 0xffcf5c, MINT = 0x6ff5c8, TEAL = 0x2fbfa8, CORAL = 0xff7a6b, CYAN = 0x66e3ff, PINK = 0xff7bd0, VIO = 0x8a6bff, LAMP = 0xffe9a8;
  const LEAF = 0x46d6a0, LEAF2 = 0x2aa884, SOIL = 0x46296b, SOIL2 = 0x5c3a86, GLASS = 0x9feaff;
  const FX = [0, 0, PH]; // disc facing +x
  const FZ = [PH, 0, 0]; // disc facing +z

  const M = (G.M = {});
  const base = (m, w, d, c = PLAT) => m.rbox(w, 0.32, d, 0.14, c, { p: [0, 0.16, 0], top: 0x6a5cc0 });
  const port = (m, p, r, side) => {
    m.tor(r, r * 0.24, DK, { p, r: side === 'x' ? [0, PH, 0] : [0, 0, 0], seg: 14 });
    m.cyl(r * 0.95, r * 0.95, 0.06, LAMP, { p, r: side === 'x' ? FX : FZ, glow: 1.1, seg: 14 });
  };
  const antenna = (m, x, y, z, h, c = CORAL) => {
    m.cyl(0.04, 0.06, h, W2, { p: [x, y + h / 2, z], seg: 6 });
    m.sph(0.12, c, { p: [x, y + h, z], glow: 1.1, seg: 8 });
  };
  const door = (m, p, w, h, c, side) => {
    m.rbox(side === 'x' ? 0.12 : w, h, side === 'x' ? w : 0.12, 0.05, c, { p, top: 0xffffff });
  };
  const sign = (m, y, id) => {
    const [fn, a, b] = OA.ITEMS[id].art;
    m.at([0, y, 0], 0.72, () => A[fn](m, a, b), PI / 4);
  };

  // ---- Crops ----
  M.field = () => G.model('field', (m) => {
    m.rbox(1.96, 0.24, 1.96, 0.1, SOIL, { p: [0, 0.12, 0], top: SOIL2 });
    for (let i = 0; i < 3; i++) m.rbox(1.74, 0.08, 0.34, 0.04, SOIL2, { p: [0, 0.25, -0.6 + i * 0.6], top: 0x7a52a8 });
  });

  const plant = {
    wheat(m, s, x, z, k) {
      const h = [0.2, 0.42, 0.66, 0.84][s];
      const ripe = s === 3;
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + k * 6;
        const px = x + Math.cos(a) * 0.11, pz = z + Math.sin(a) * 0.11;
        const tx = Math.cos(a) * 0.14, tz = Math.sin(a) * 0.14;
        m.cone(0.035, h, s >= 2 ? 0xc9d3ff : 0x7fe8c0, { p: [px, 0.24 + h / 2, pz], r: [tz, 0, -tx], seg: 4 });
        if (s >= 2) m.sph(0.05, ripe ? 0xf2f5ff : 0xd2dcff, { p: [px + tx * h * 0.9, 0.24 + h, pz + tz * h * 0.9], s: [1, 2.6, 1], seg: 6, glow: ripe ? 0.5 : 0.1 });
      }
    },
    corn(m, s, x, z) {
      const h = [0.26, 0.55, 0.86, 1.02][s];
      m.cyl(0.04, 0.06, h, LEAF2, { p: [x, 0.24 + h / 2, z], seg: 6 });
      for (let i = 0; i <= s; i++) {
        const a = i * 2.2;
        m.sph(0.2, LEAF, { p: [x + Math.cos(a) * 0.16, 0.3 + h * (0.3 + i * 0.2), z + Math.sin(a) * 0.16], s: [1.2, 0.2, 0.42], r: [0, -a, 0.5], seg: 6, top: 0x8ff5c8 });
      }
      if (s >= 2) m.sph(0.1, s === 3 ? 0x8cffcf : 0x4fcf9f, { p: [x + 0.09, 0.24 + h * 0.74, z + 0.09], s: [1, 2.1, 1], seg: 7, glow: s === 3 ? 1 : 0.2 });
    },
    bean(m, s, x, z) {
      const r = [0.12, 0.22, 0.3, 0.32][s];
      m.sph(r, 0x3fc79a, { p: [x, 0.26 + r * 0.8, z], s: [1, 0.85, 1], seg: 8, top: 0x8ff5c8 });
      if (s >= 2) for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; m.sph(0.13, s === 3 ? 0xff9bd2 : 0xd98fc4, { p: [x + Math.cos(a) * r, 0.34 + r * 0.5, z + Math.sin(a) * r], s: [1.2, 0.45, 0.45], r: [0, -a, 0.4], seg: 6, glow: s === 3 ? 0.5 : 0 }); }
    },
    cane(m, s, x, z) {
      const h = [0.26, 0.55, 0.85, 1.05][s];
      [[0, 0], [0.13, 0.07], [-0.1, 0.1]].forEach(([ox, oz], i) => {
        const hh = h * (1 - i * 0.14);
        m.cyl(0.05, 0.06, hh, 0x7fdcff, { p: [x + ox, 0.24 + hh / 2, z + oz], seg: 6, top: 0xd6f8ff });
        if (s >= 2) m.tor(0.06, 0.018, 0x3fa7d6, { p: [x + ox, 0.24 + hh * 0.6, z + oz], r: [PH, 0, 0], seg: 8 });
        if (s === 3) m.sph(0.07, 0xeaffff, { p: [x + ox, 0.3 + hh, z + oz], seg: 6, glow: 0.9 });
      });
    },
    gourd(m, s, x, z) {
      m.sph(0.26, LEAF2, { p: [x, 0.28, z], s: [1.1, 0.25, 1.1], seg: 8, top: LEAF });
      const r = [0, 0.1, 0.2, 0.27][s];
      if (r) for (let i = 0; i < 5; i++) { const a = i * 1.257; m.sph(r * 0.72, i % 2 ? 0xffa24d : 0xe57f33, { p: [x + Math.cos(a) * r * 0.55, 0.28 + r * 0.72, z + Math.sin(a) * r * 0.55], seg: 7, s: [0.85, 1, 0.85], glow: s === 3 ? 0.25 : 0 }); }
      if (s === 3) m.cone(0.05, 0.16, LEAF2, { p: [x, 0.28 + r * 1.6, z], seg: 5 });
    },
    berry(m, s, x, z, k) {
      const r = [0.12, 0.22, 0.31, 0.33][s];
      m.sph(r, 0x4b3f9f, { p: [x, 0.27 + r * 0.8, z], s: [1, 0.95, 1], seg: 8, top: 0x7f6fd6 });
      if (s >= 2) for (let i = 0; i < 7; i++) { const a = i * 2.4 + k; const y = 0.27 + r * (0.5 + (i % 3) * 0.4); m.sph(0.065, s === 3 ? 0xb49bff : 0x7f6fd6, { p: [x + Math.cos(a) * r * 0.9, y, z + Math.sin(a) * r * 0.9], seg: 6, glow: s === 3 ? 1 : 0.1 }); }
    },
    cotton(m, s, x, z) {
      const h = [0.2, 0.42, 0.62, 0.7][s];
      m.cyl(0.03, 0.05, h, BROWN, { p: [x, 0.24 + h / 2, z], seg: 5 });
      m.sph(0.15 + s * 0.03, LEAF2, { p: [x, 0.3 + h * 0.5, z], s: [1.3, 0.5, 1.3], seg: 7, top: LEAF });
      if (s >= 2) [[0, 0, 0], [0.13, -0.08, 0.05], [-0.1, -0.05, 0.1], [0.02, -0.1, -0.13]].forEach(([a, b, c]) => m.sph(s === 3 ? 0.13 : 0.08, 0xfff4fb, { p: [x + a, 0.3 + h + b, z + c], seg: 7, glow: s === 3 ? 0.15 : 0 }));
    },
    root(m, s, x, z) {
      for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.5; const h = [0.14, 0.3, 0.44, 0.5][s]; m.sph(0.08, LEAF, { p: [x + Math.cos(a) * 0.08, 0.3 + h / 2, z + Math.sin(a) * 0.08], s: [0.8, h * 7, 0.6], r: [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4], seg: 6, top: 0x8ff5c8 }); }
      if (s >= 2) m.sph(0.13, 0xff6a3d, { p: [x, 0.3, z], s: [1, 0.8, 1], seg: 8, glow: s === 3 ? 0.7 : 0.15 });
    },
    chili(m, s, x, z, k) {
      const r = [0.12, 0.2, 0.28, 0.3][s];
      m.cyl(0.03, 0.04, 0.2 + r, LEAF2, { p: [x, 0.3 + r / 2, z], seg: 5 });
      m.sph(r, 0x3fc79a, { p: [x, 0.42 + r * 0.6, z], s: [1, 0.72, 1], seg: 8, top: 0x8ff5c8 });
      if (s >= 2) for (let i = 0; i < 5; i++) { const a = i * 1.26 + k; m.cone(0.05, 0.24, s === 3 ? 0x78e0ff : 0x9fd0e0, { p: [x + Math.cos(a) * r * 0.85, 0.36 + r * 0.2, z + Math.sin(a) * r * 0.85], r: [PI, 0, 0], seg: 5, glow: s === 3 ? 0.7 : 0 }); }
    },
    melon(m, s, x, z) {
      m.sph(0.27, LEAF2, { p: [x, 0.27, z], s: [1.2, 0.2, 1.2], seg: 8, top: LEAF });
      const r = [0, 0.1, 0.2, 0.28][s];
      if (r) { m.sph(r, s === 3 ? 0xff5fa8 : 0xf08fbf, { p: [x, 0.28 + r * 0.85, z], seg: 9, glow: s === 3 ? 0.5 : 0, top: 0xffb8d8 }); if (s >= 2) m.tor(r * 1.01, 0.015, 0xffd0e6, { p: [x, 0.28 + r * 0.85, z], seg: 12, r: [0, 0.6, 0], glow: 0.7 }); }
    },
    shroom(m, s, x, z, k) {
      const n = 3;
      for (let i = 0; i < n; i++) {
        const a = i * 2.1 + k * 3, ox = Math.cos(a) * 0.13, oz = Math.sin(a) * 0.13;
        const h = [0.1, 0.2, 0.32, 0.4][s] * (1 - i * 0.18);
        const r = [0.05, 0.09, 0.15, 0.19][s] * (1 - i * 0.12);
        m.cyl(r * 0.34, r * 0.45, h, 0xfff4e8, { p: [x + ox, 0.24 + h / 2, z + oz], seg: 6 });
        m.dome(r, s === 3 ? 0xc77bff : 0xa98fd0, { p: [x + ox, 0.22 + h, z + oz], s: [1, 0.8, 1], seg: 8, glow: s === 3 ? 0.6 : 0 });
        if (s === 3) m.sph(0.03, 0xfff0a8, { p: [x + ox, 0.24 + h + r * 0.75, z + oz], seg: 5, glow: 1.2 });
      }
    },
    bloom(m, s, x, z) {
      const h = [0.28, 0.6, 0.95, 1.15][s];
      m.cyl(0.035, 0.05, h, LEAF2, { p: [x, 0.24 + h / 2, z], seg: 6 });
      for (let i = 0; i < 2; i++) m.sph(0.14, LEAF, { p: [x + (i ? 0.13 : -0.13), 0.28 + h * 0.5, z], s: [1.2, 0.2, 0.5], r: [0, 0, i ? 0.5 : -0.5], seg: 6 });
      if (s >= 2) {
        const r = s === 3 ? 0.24 : 0.14;
        const y = 0.24 + h, o = 0.05;
        const cx = x + o, cz = z + o;
        for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; const dx = Math.cos(a) * r, dy = Math.sin(a) * r; m.sph(r * 0.5, s === 3 ? 0xffd94d : 0xe8c86a, { p: [cx + dx * 0.7, y + dy, cz - dx * 0.7], s: [1, 1, 0.3], r: [0, PI / 4, a], seg: 6, glow: s === 3 ? 0.55 : 0 }); }
        m.sph(r * 0.55, 0xff8a3d, { p: [cx + 0.03, y, cz + 0.03], seg: 7, glow: 0.3, s: [1, 1, 1] });
      }
    },
  };
  const BROWN = 0x8a5a3c;

  M.crop = (crop, stage) => G.model('crop-' + crop + stage, (m) => {
    const fn = plant[crop];
    let n = 0;
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const k = OA.hash(a * 3.1 + 2, b * 1.7 + 5);
        fn(m, stage, a * 0.6 + (k - 0.5) * 0.12, b * 0.6 + (OA.hash(b + 9, a) - 0.5) * 0.12, k);
        n++;
      }
    }
  });

  // ---- Orchard ----
  M.tree = (kind, state) => G.model('tree-' + kind + state, (m) => {
    const def = OA.TREES.find((t) => t.id === kind);
    m.cyl(0.62, 0.74, 0.12, DK, { p: [0, 0.06, 0], seg: 12 });
    m.pipe([0, 0, 0], [0.12, 1.2, 0.05], 0.16, 0x8a5fa0, { seg: 8, top: 0xa87fb8 });
    m.pipe([0.12, 1.1, 0.05], [-0.3, 1.9, 0.1], 0.1, 0x8a5fa0, { seg: 7 });
    m.pipe([0.12, 1.1, 0.05], [0.5, 1.85, -0.1], 0.1, 0x8a5fa0, { seg: 7 });
    if (state === 'spent') { m.sph(0.3, 0x6a5a8a, { p: [0.1, 2, 0], seg: 8, s: [1, 0.6, 1] }); return; }
    const c = def.canopy;
    const pts = [[0.05, 2.5, 0, 0.95], [-0.62, 2.05, 0.15, 0.68], [0.68, 2.1, -0.1, 0.7], [0.12, 1.95, 0.6, 0.66], [-0.05, 2.0, -0.6, 0.62]];
    pts.forEach(([x, y, z, r]) => m.sph(r, c, { p: [x, y, z], top: 0xffffff, seg: 12, glow: 0.12 }));
    if (state === 'fruit') {
      for (let i = 0; i < 12; i++) {
        const a = i * 2.4, y = 1.75 + (i % 4) * 0.42;
        const r = 1.02 - Math.abs(y - 2.3) * 0.4;
        m.sph(0.14, def.fruitColor, { p: [Math.cos(a) * r, y, Math.sin(a) * r], seg: 7, glow: 0.7, top: 0xffffff });
      }
    }
  });

  // ---- Pens and critters ----
  M.pen = (kind) => G.model('pen-' + kind, (m) => {
    const W2W = OA.BUILD.pen.w - 0.4, D2D = OA.BUILD.pen.d - 0.4;
    const floors = { puffling: 0x7fd6a8, moonmoo: 0x8fdcb8, snuffle: 0xb08f70, nimbaa: 0xa8c8ff, lumibee: 0xffd8a8, drift: 0x7fb8e8 };
    m.rbox(W2W, 0.08, D2D, 0.04, floors[kind], { p: [0, 0.05, 0], top: floors[kind] });
    const rail = (a, b) => {
      m.pipe([a[0], 0.62, a[1]], [b[0], 0.62, b[1]], 0.05, MINT, { glow: 0.9 });
      m.pipe([a[0], 0.34, a[1]], [b[0], 0.34, b[1]], 0.035, MINT, { glow: 0.7 });
    };
    const hw = W2W / 2, hd = D2D / 2;
    const c = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
    rail(c[0], c[1]); rail(c[1], c[2]); rail(c[3], c[0]);
    rail([-hw, hd], [-0.9, hd]); rail([0.9, hd], [hw, hd]);
    const post = (x, z) => { m.cyl(0.09, 0.12, 0.8, W, { p: [x, 0.4, z], seg: 8 }); m.sph(0.1, GOLD, { p: [x, 0.84, z], seg: 7, glow: 0.8 }); };
    c.forEach(([x, z]) => post(x, z));
    post(-0.9, hd); post(0.9, hd); post(0, -hd); post(-hw, 0); post(hw, 0);
    // Feed trough on the right.
    m.rbox(0.7, 0.34, 1.9, 0.1, DK, { p: [hw - 0.65, 0.22, 0.3] });
    m.rbox(0.5, 0.06, 1.7, 0.03, 0xffc98a, { p: [hw - 0.65, 0.39, 0.3] });
    // Each critter gets a home in the back corner.
    if (kind === 'puffling') {
      m.at([-hw + 1.2, 0, -hd + 1.1], 1, () => {
        m.dome(1, 0xffd9a8, { p: [0, 0.1, 0], s: [1, 0.95, 1], top: 0xfff0d8 });
        m.cone(0.3, 0.3, CORAL, { p: [0, 1.15, 0] });
        m.cyl(0.32, 0.32, 0.06, DK2, { p: [0.68, 0.42, 0.68], r: [PH, PI / 4 * 0, 0], s: 1 });
        m.sph(0.36, DK2, { p: [0.62, 0.42, 0.62], s: [1, 1.1, 0.35], r: [0, PI / 4, 0] });
      });
    } else if (kind === 'moonmoo') {
      m.at([-hw + 1.2, 0, -hd + 1.1], 1, () => {
        m.cyl(0.8, 0.8, 0.7, 0xc9b0ff, { p: [0, 0.42, 0], r: [0, 0, PH], seg: 12, top: 0xe2d4ff });
        m.cyl(0.8, 0.8, 0.7, 0xb79cf0, { p: [0.2, 0.42, 1.1], r: [PH, 0, 0], seg: 12, top: 0xe2d4ff });
      });
    } else if (kind === 'snuffle') {
      m.cyl(1.4, 1.5, 0.06, 0x6a4a7a, { p: [-0.9, 0.12, -0.4], seg: 16 });
      m.sph(0.3, 0x8d5fc9, { p: [-1.4, 0.18, -0.9], s: [1, 0.5, 1], seg: 8, glow: 0.3 });
    } else if (kind === 'nimbaa') {
      m.at([-1.2, 0, -1], 1, () => {
        m.cyl(0.08, 0.1, 1.3, W2, { p: [0, 0.65, 0] });
        m.tor(0.6, 0.05, CYAN, { p: [0, 1.3, 0], r: [PH, 0, 0], seg: 18, glow: 0.8 });
      });
    } else if (kind === 'lumibee') {
      m.at([-hw + 1.4, 0, -hd + 1.3], 1, () => {
        for (let i = 0; i < 4; i++) m.cyl(0.74 - i * 0.14, 0.82 - i * 0.14, 0.42, i % 2 ? 0xffb03d : 0xffd24d, { p: [0, 0.3 + i * 0.4, 0], seg: 14, glow: 0.1 });
        m.sph(0.16, DK2, { p: [0.5, 0.42, 0.5], seg: 8 });
      });
      for (let i = 0; i < 7; i++) { const x = -0.6 + (i % 4) * 0.9, z = 0.1 + (i % 3) * 0.7; m.cyl(0.02, 0.03, 0.42, LEAF, { p: [x, 0.25, z], seg: 5 }); m.sph(0.14, i % 2 ? PINK : GOLD, { p: [x, 0.5, z], s: [1, 0.5, 1], seg: 7, glow: 0.6 }); }
    } else if (kind === 'drift') {
      for (let i = 0; i < 3; i++) m.tor(0.66 - i * 0.1, 0.05, CYAN, { p: [-1 + i * 1.1, 1.5 - i * 0.2, -0.8 + i * 0.5], r: [PH, 0, 0], seg: 18, glow: 0.9 });
      m.cyl(1.7, 1.8, 0.06, 0x3f6fd6, { p: [-0.4, 0.12, -0.2], seg: 18, glow: 0.2 });
    }
  });

  const eyes = (m, x, y, z, gap, r, side = 'x') => {
    // Big cartoon eyes looking toward +x/+z.
    const a = side === 'x' ? [x, y, z - gap] : [x - gap, y, z];
    const b = side === 'x' ? [x, y, z + gap] : [x + gap, y, z];
    [a, b].forEach((p) => {
      m.sph(r, 0xffffff, { p, seg: 10 });
      m.sph(r * 0.62, 0x20153f, { p: side === 'x' ? [p[0] + r * 0.55, p[1], p[2]] : [p[0], p[1], p[2] + r * 0.55], seg: 8 });
      m.sph(r * 0.22, 0xffffff, { p: side === 'x' ? [p[0] + r * 0.95, p[1] + r * 0.32, p[2] + r * 0.2] : [p[0] + r * 0.2, p[1] + r * 0.32, p[2] + r * 0.95], seg: 6, glow: 1 });
    });
  };

  // Critters face +x; the world turns them as they walk.
  M.critter = (kind) => G.model('critter-' + kind, (m) => {
    if (kind === 'puffling') {
      m.sph(0.42, 0xfff0c9, { p: [0, 0.46, 0], s: [1, 0.96, 1], top: 0xffffff });
      for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; m.sph(0.14, 0xfff4dc, { p: [Math.cos(a) * 0.4, 0.3 + (i % 2) * 0.1, Math.sin(a) * 0.4], seg: 7 }); }
      for (let i = -1; i <= 1; i++) m.cone(0.1, 0.32, CORAL, { p: [i * 0.13 - 0.04, 0.94, 0], r: [0, 0, -i * 0.42], seg: 6, glow: 0.2 });
      m.cone(0.09, 0.2, 0xffa82e, { p: [0.42, 0.42, 0], r: [0, 0, -PH], seg: 6 });
      eyes(m, 0.28, 0.58, 0, 0.17, 0.12);
      m.sph(0.17, 0xffd9a8, { p: [-0.04, 0.42, 0.42], s: [1, 0.55, 0.3] });
      m.sph(0.17, 0xffd9a8, { p: [-0.04, 0.42, -0.42], s: [1, 0.55, 0.3] });
      m.cyl(0.04, 0.05, 0.14, 0xffa82e, { p: [0.05, 0.08, 0.16], seg: 6 });
      m.cyl(0.04, 0.05, 0.14, 0xffa82e, { p: [0.05, 0.08, -0.16], seg: 6 });
    } else if (kind === 'moonmoo') {
      m.rbox(1.34, 0.86, 0.9, 0.4, 0xd9c8ff, { p: [-0.1, 0.78, 0], top: 0xf1e8ff });
      [[-0.32, 1.1, 0.26, 0.3], [0.2, 0.9, 0.43, 0.26], [-0.5, 0.72, -0.4, 0.28], [0.12, 1.14, -0.22, 0.24]].forEach(([x, y, z, r]) => m.sph(r, 0x8a6bff, { p: [x, y, z], s: [1, 0.72, 1], seg: 9, glow: 0.2 }));
      m.sph(0.42, 0xe6dbff, { p: [0.66, 0.92, 0], s: [1, 0.95, 1], top: 0xffffff });
      m.sph(0.25, 0xffd0e8, { p: [0.96, 0.82, 0], s: [0.9, 0.7, 1.1], seg: 10 });
      m.sph(0.04, 0x8a3f7a, { p: [1.17, 0.86, 0.1], seg: 5 }); m.sph(0.04, 0x8a3f7a, { p: [1.17, 0.86, -0.1], seg: 5 });
      eyes(m, 0.93, 1.08, 0, 0.2, 0.1);
      m.tor(0.17, 0.05, GOLD, { p: [0.6, 1.36, 0.25], r: [0, 0.5, -0.6], arc: PI * 1.25, seg: 10, glow: 0.8 });
      m.tor(0.17, 0.05, GOLD, { p: [0.6, 1.36, -0.25], r: [0, -0.5, -0.6], arc: PI * 1.25, seg: 10, glow: 0.8 });
      m.sph(0.19, 0xc9b0ff, { p: [0.42, 1.06, 0.46], s: [1, 0.4, 0.5], seg: 7 });
      m.sph(0.19, 0xc9b0ff, { p: [0.42, 1.06, -0.46], s: [1, 0.4, 0.5], seg: 7 });
      [[0.34, 0.3], [0.34, -0.3], [-0.5, 0.3], [-0.5, -0.3]].forEach(([x, z]) => m.cyl(0.14, 0.17, 0.44, 0x8a6bff, { p: [x, 0.22, z], seg: 8 }));
      m.pipe([-0.74, 0.92, 0], [-0.96, 0.62, 0], 0.03, 0xc9b0ff); m.sph(0.1, 0x8a6bff, { p: [-0.98, 0.56, 0], seg: 7, glow: 0.3 });
    } else if (kind === 'snuffle') {
      m.sph(0.58, 0xffa8c8, { p: [-0.05, 0.56, 0], s: [1.15, 0.92, 0.92], top: 0xffd0e0 });
      m.sph(0.32, 0xff8fb8, { p: [0.54, 0.52, 0], s: [0.65, 0.85, 0.95], top: 0xffc0d4 });
      m.sph(0.05, 0xb83f7a, { p: [0.75, 0.56, 0.1], seg: 6 }); m.sph(0.05, 0xb83f7a, { p: [0.75, 0.56, -0.1], seg: 6 });
      eyes(m, 0.42, 0.82, 0, 0.21, 0.11);
      m.sph(0.2, 0xff8fb8, { p: [0.2, 1.02, 0.3], s: [0.8, 0.3, 1.2], r: [0.5, 0, 0], seg: 8 });
      m.sph(0.2, 0xff8fb8, { p: [0.2, 1.02, -0.3], s: [0.8, 0.3, 1.2], r: [-0.5, 0, 0], seg: 8 });
      m.tor(0.11, 0.035, 0xff8fb8, { p: [-0.7, 0.68, 0], seg: 10 });
      [[0.26, 0.3], [0.26, -0.3], [-0.34, 0.3], [-0.34, -0.3]].forEach(([x, z]) => m.cyl(0.1, 0.13, 0.22, 0xe87fa8, { p: [x, 0.11, z], seg: 8 }));
      m.sph(0.14, 0x7cf7c0, { p: [-0.2, 1.0, 0.12], seg: 7, glow: 0.8 });
    } else if (kind === 'nimbaa') {
      [[0, 0.95, 0, 0.5], [-0.42, 0.88, 0.1, 0.38], [0.38, 0.86, -0.08, 0.36], [0, 0.8, 0.4, 0.34], [0, 0.82, -0.4, 0.36], [-0.2, 1.18, 0, 0.32], [0.2, 1.16, 0.05, 0.28]].forEach(([x, y, z, r]) => m.sph(r, 0xf3f6ff, { p: [x, y, z], top: 0xffffff, seg: 11 }));
      m.sph(0.26, 0x8fa4e8, { p: [0.56, 0.86, 0], s: [0.8, 1, 1], top: 0xb5c8ff });
      eyes(m, 0.72, 0.92, 0, 0.13, 0.09);
      [[0.2, 0.2], [0.2, -0.2], [-0.25, 0.2], [-0.25, -0.2]].forEach(([x, z]) => m.cyl(0.05, 0.07, 0.34, 0x8fa4e8, { p: [x, 0.42, z], seg: 6 }));
    } else if (kind === 'lumibee') {
      m.sph(0.34, 0xffd24d, { p: [0, 1.2, 0], s: [1.25, 1, 1], glow: 0.7 });
      for (let i = -1; i <= 1; i++) m.tor(0.3 - Math.abs(i) * 0.06, 0.07, 0x4b3070, { p: [i * 0.2 - 0.06, 1.2, 0], r: [0, PH, 0], seg: 14 });
      eyes(m, 0.32, 1.28, 0, 0.13, 0.09);
      m.sph(0.3, 0xe8fbff, { p: [-0.05, 1.48, 0.3], s: [0.6, 0.18, 1], r: [0.5, 0, 0], seg: 8, glow: 0.5 });
      m.sph(0.3, 0xe8fbff, { p: [-0.05, 1.48, -0.3], s: [0.6, 0.18, 1], r: [-0.5, 0, 0], seg: 8, glow: 0.5 });
    } else if (kind === 'drift') {
      m.dome(0.72, 0x8fe8ff, { p: [0, 1.85, 0], s: [1, 0.85, 1], top: 0xe8fbff, glow: 0.55, seg: 18 });
      m.tor(0.72, 0.07, 0xff9be8, { p: [0, 1.85, 0], r: [PH, 0, 0], seg: 20, glow: 0.9 });
      eyes(m, 0.6, 2.05, 0, 0.17, 0.09);
      for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2; m.pipe([Math.cos(a) * 0.5, 1.85, Math.sin(a) * 0.5], [Math.cos(a) * 0.3, 0.75 + (i % 3) * 0.15, Math.sin(a) * 0.3], 0.03, 0xc9f6ff, { glow: 0.7 }); }
    }
  });

  // ---- People ----
  M.folk = (id) => G.model('folk-' + id, (m) => {
    const f = OA.FOLK.find((k) => k.id === id);
    if (f.body === 'human') {
      m.cyl(0.08, 0.1, 0.34, DK, { p: [0, 0.17, 0.13], seg: 7 }); m.cyl(0.08, 0.1, 0.34, DK, { p: [0, 0.17, -0.13], seg: 7 });
      m.rbox(0.42, 0.58, 0.54, 0.16, f.top, { p: [0, 0.62, 0], top: 0xffffff });
      m.sph(0.33, f.skin, { p: [0, 1.15, 0], top: 0xffffff * 0 + f.skin, seg: 12 });
      m.dome(0.35, f.hair, { p: [-0.03, 1.2, 0], r: [0, 0, 0.35], seg: 12 });
      eyes(m, 0.27, 1.16, 0, 0.13, 0.07);
      m.sph(0.08, f.top, { p: [0, 0.68, 0.33], s: [1, 2.2, 1], seg: 7 }); m.sph(0.08, f.top, { p: [0, 0.68, -0.33], s: [1, 2.2, 1], seg: 7 });
    } else if (f.body === 'blob') {
      m.sph(0.56, f.skin, { p: [0, 0.54, 0], s: [1, 0.96, 1], top: 0xffffff, glow: 0.12 });
      eyes(m, 0.44, 0.74, 0, 0.2, 0.13);
      m.pipe([-0.1, 1.02, 0.14], [-0.2, 1.36, 0.28], 0.025, f.top); m.sph(0.08, f.hair, { p: [-0.2, 1.38, 0.28], seg: 7, glow: 1 });
      m.pipe([-0.1, 1.02, -0.14], [-0.2, 1.36, -0.28], 0.025, f.top); m.sph(0.08, f.hair, { p: [-0.2, 1.38, -0.28], seg: 7, glow: 1 });
      m.sph(0.16, f.top, { p: [0.12, 0.07, 0.24], s: [1.3, 0.5, 1], seg: 7 }); m.sph(0.16, f.top, { p: [0.12, 0.07, -0.24], s: [1.3, 0.5, 1], seg: 7 });
    } else if (f.body === 'tall') {
      m.cyl(0.14, 0.34, 0.95, f.top, { p: [0, 0.48, 0], seg: 12, top: 0xffffff });
      m.cyl(0.06, 0.08, 0.34, f.skin, { p: [0, 1.06, 0], seg: 7 });
      m.sph(0.3, f.skin, { p: [0, 1.42, 0], s: [0.9, 1.15, 1], seg: 12 });
      eyes(m, 0.22, 1.5, 0, 0.12, 0.07);
      m.sph(0.07, 0xffffff, { p: [0.26, 1.64, 0], seg: 8 }); m.sph(0.045, 0x20153f, { p: [0.31, 1.64, 0], seg: 6 });
      m.cone(0.07, 0.3, f.hair, { p: [0, 1.86, 0], seg: 6, glow: 0.7 });
    } else {
      m.rbox(0.74, 0.74, 0.74, 0.16, f.skin, { p: [0, 0.72, 0], top: 0xffffff });
      m.rbox(0.1, 0.46, 0.56, 0.06, DK2, { p: [0.37, 0.76, 0] });
      m.sph(0.08, f.hair, { p: [0.42, 0.8, 0.15], seg: 7, glow: 1.2 }); m.sph(0.08, f.hair, { p: [0.42, 0.8, -0.15], seg: 7, glow: 1.2 });
      m.cyl(0.26, 0.32, 0.26, f.top, { p: [0, 0.16, 0], seg: 12 });
      antenna(m, 0, 1.08, 0, 0.3, f.hair);
    }
  });

  const rivet = (m, gold) => {
    const a = gold ? GOLD : W, c = gold ? 0xffa82e : CORAL, e = gold ? 0x8a5a1f : DK2;
    m.cyl(0.22, 0.3, 0.2, gold ? 0xffa82e : DK, { p: [0, 0.14, 0], seg: 12 });
    m.tor(0.32, 0.09, gold ? 0xffa82e : DK2, { p: [0, 0.13, 0], r: [PH, 0, 0], seg: 14 });
    m.sph(0.46, a, { p: [0, 0.68, 0], top: 0xffffff });
    m.tor(0.46, 0.05, c, { p: [0, 0.62, 0], r: [PH, 0, 0], seg: 20, glow: gold ? 0 : 0.3 });
    m.sph(0.3, e, { p: [0.28, 0.76, 0], s: [0.5, 0.75, 1], seg: 12 });
    m.sph(0.09, gold ? 0xfff0b0 : MINT, { p: [0.42, 0.8, 0.13], s: [0.6, 1, 1], seg: 8, glow: 1.3 });
    m.sph(0.09, gold ? 0xfff0b0 : MINT, { p: [0.42, 0.8, -0.13], s: [0.6, 1, 1], seg: 8, glow: 1.3 });
    antenna(m, -0.05, 1.1, 0, 0.26, gold ? 0xfff0b0 : CORAL);
    m.sph(0.1, a, { p: [0, 0.68, 0.48], seg: 8 }); m.sph(0.1, a, { p: [0, 0.68, -0.48], seg: 8 });
  };
  M.rivet = () => G.model('rivet', (m) => rivet(m, false));

  // ---- Core colony buildings ----
  M.silo = () => G.model('silo', (m) => {
    base(m, 3.7, 3.7);
    m.cyl(1.42, 1.54, 3.7, W, { p: [0, 2.17, 0], seg: 22, top: 0xffffff });
    [1.1, 2.2, 3.3].forEach((y) => m.tor(1.52 - (y - 1) * 0.03, 0.08, MINT, { p: [0, y, 0], r: [PH, 0, 0], seg: 26, glow: 0.5 }));
    m.dome(1.44, GLASS, { p: [0, 4, 0], top: 0xeafcff, glow: 0.32, seg: 22 });
    m.cyl(0.7, 0.7, 0.5, 0xdfe6ff, { p: [0, 4.3, 0], seg: 14, glow: 0.3 });
    door(m, [0, 1, 1.46], 0.9, 1.3, TEAL, 'z');
    port(m, [1.5, 2.8, 0], 0.3, 'x');
    port(m, [0, 2.8, 1.48], 0.3, 'z');
    for (let i = 0; i < 7; i++) m.box(0.34, 0.05, 0.05, DK, { p: [1.42, 0.7 + i * 0.5, 1.0 - 0], r: [0, PI / 4, 0] });
    m.pipe([1.1, 0.4, 1.1], [1.1, 3.9, 1.1], 0.04, DK); m.pipe([1.32, 0.4, 0.86], [1.32, 3.9, 0.86], 0.04, DK);
    antenna(m, 0, 5.3, 0, 0.5, MINT);
    m.at([0, 5.1, 0], 0.5, () => A.grain(m, 0xdfe6ff, 0xa8b6ff));
  });

  M.bay = () => G.model('bay', (m) => {
    base(m, 4.7, 3.7);
    m.cyl(1.72, 1.72, 4.1, W, { p: [0, 0.82, 0], r: [0, 0, PH], seg: 24, top: 0xffffff });
    for (let i = 0; i < 5; i++) m.tor(1.75, 0.07, CORAL, { p: [-1.8 + i * 0.9, 0.82, 0], r: [0, PH, 0], seg: 26, glow: 0.1 });
    door(m, [2.1, 0.98, 0], 1.9, 1.4, CORAL, 'x');
    for (let i = 0; i < 3; i++) m.box(0.14, 0.05, 1.8, 0xffffff, { p: [2.13, 0.56 + i * 0.4, 0] });
    port(m, [-1.1, 1.3, 1.62], 0.28, 'z'); port(m, [0, 1.3, 1.62], 0.28, 'z'); port(m, [1.1, 1.3, 1.62], 0.28, 'z');
    m.rbox(0.8, 0.7, 0.8, 0.08, 0xffc98a, { p: [2.15, 0.65, 1.55] });
    m.rbox(0.5, 0.46, 0.5, 0.06, 0xff9d5c, { p: [2.1, 1.23, 1.5], r: [0, 0.4, 0] });
    antenna(m, -1.2, 2.5, 0, 0.7, CORAL);
    m.at([0.6, 3.1, 0], 0.55, () => A.sack(m, 0xffd08a, 0xff9d3d));
  });

  M.board = () => G.model('board', (m) => {
    m.cyl(0.12, 0.16, 2.4, W2, { p: [-1.2, 1.2, 0], seg: 8 });
    m.cyl(0.12, 0.16, 2.4, W2, { p: [1.2, 1.2, 0], seg: 8 });
    m.rbox(2.9, 1.86, 0.2, 0.1, DK, { p: [0, 1.9, 0] });
    m.rbox(2.6, 1.56, 0.06, 0.04, 0x1d6f8a, { p: [0, 1.9, 0.11], glow: 0.55 });
    const cols = [MINT, GOLD, PINK, CYAN, CORAL, MINT];
    for (let i = 0; i < 6; i++) m.rbox(0.72, 0.52, 0.05, 0.04, cols[i], { p: [-0.84 + (i % 3) * 0.84, 2.25 - Math.floor(i / 3) * 0.72, 0.15], glow: 0.9, top: 0xffffff });
    m.rbox(3.1, 0.14, 0.4, 0.06, CORAL, { p: [0, 2.92, 0] });
    antenna(m, 0, 3, 0, 0.42, MINT);
    base(m, 3, 0.8);
  });

  M.pad = () => G.model('pad', (m) => {
    m.cyl(2.35, 2.45, 0.28, PLAT, { p: [0, 0.14, 0], seg: 28, top: 0x7264d0 });
    m.tor(2.0, 0.06, MINT, { p: [0, 0.3, 0], r: [PH, 0, 0], seg: 34, glow: 1 });
    m.tor(1.3, 0.04, GOLD, { p: [0, 0.3, 0], r: [PH, 0, 0], seg: 28, glow: 0.8 });
    m.box(1.8, 0.03, 0.2, W, { p: [0, 0.3, 0] }); m.box(0.2, 0.03, 1.8, W, { p: [0, 0.3, 0] });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; m.sph(0.1, CORAL, { p: [Math.cos(a) * 2.24, 0.34, Math.sin(a) * 2.24], seg: 7, glow: 1 }); }
  });

  M.shuttle = () => G.model('shuttle', (m) => {
    m.sph(1, W, { p: [0, 0.82, 0], s: [1.35, 0.62, 0.86], top: 0xffffff, seg: 18 });
    m.sph(0.56, GLASS, { p: [0.55, 1.1, 0], s: [1.1, 0.72, 0.88], top: 0xeafcff, glow: 0.35, seg: 14 });
    m.tor(0.92, 0.09, CORAL, { p: [0, 0.76, 0], r: [PH, 0, 0], s: [1.45, 0.95, 0.9], seg: 26 });
    m.rbox(0.62, 0.26, 0.26, 0.1, CORAL, { p: [-0.42, 0.8, 0.95] }); m.rbox(0.62, 0.26, 0.26, 0.1, CORAL, { p: [-0.42, 0.8, -0.95] });
    m.cone(0.3, 0.7, MINT, { p: [-1.1, 1.35, 0], r: [0, 0, 0.7], s: [1, 1, 0.3], seg: 6 });
    m.cyl(0.42, 0.26, 0.12, CYAN, { p: [0, 0.26, 0], seg: 14, glow: 1 });
    m.cyl(0.16, 0.2, 0.3, DK, { p: [-1.36, 0.8, 0], r: [0, 0, PH], seg: 10 });
  });

  M.post = () => G.model('post', (m) => {
    base(m, 3.8, 2.8);
    m.rbox(3.2, 1, 1.2, 0.16, W, { p: [0, 0.82, 0.55], top: 0xffffff });
    m.rbox(3.24, 0.22, 1.24, 0.08, CORAL, { p: [0, 1.06, 0.55] });
    [[-1.5, 0.95], [1.5, 0.95], [-1.5, -0.8], [1.5, -0.8]].forEach(([x, z]) => m.cyl(0.08, 0.1, 2.6, W2, { p: [x, 1.6, z], seg: 8 }));
    for (let i = 0; i < 8; i++) m.rbox(0.45, 0.1, 2.5, 0.04, i % 2 ? W : CORAL, { p: [-1.57 + i * 0.45, 2.92, 0.1], r: [0.14, 0, 0], top: 0xffffff });
    for (let i = 0; i < 8; i++) m.cone(0.22, 0.26, i % 2 ? W : CORAL, { p: [-1.57 + i * 0.45, 2.7, 1.3], r: [PI, 0, 0], s: [1, 1, 0.3], seg: 3 });
    m.rbox(0.7, 0.42, 0.7, 0.05, 0xffc98a, { p: [-0.9, 1.5, 0.5] });
    m.sph(0.26, 0xfff0c9, { p: [0, 1.48, 0.55], s: [0.9, 1.2, 0.9], seg: 10 });
    m.cyl(0.2, 0.26, 0.42, 0x8a6bff, { p: [0.85, 1.5, 0.55], seg: 10, top: 0xc9b0ff });
    m.rbox(2.6, 1.8, 0.1, 0.05, PLAT, { p: [0, 1.4, -1.1] });
    m.sph(0.1, LAMP, { p: [-1, 2.5, 1], seg: 7, glow: 1.3 }); m.sph(0.1, LAMP, { p: [1, 2.5, 1], seg: 7, glow: 1.3 });
  });

  M.gazette = () => G.model('gazette', (m) => {
    m.cyl(0.84, 0.92, 0.16, PLAT, { p: [0, 0.08, 0], seg: 16 });
    m.cyl(0.66, 0.72, 1.7, W, { p: [0, 1.02, 0], seg: 18, top: 0xffffff });
    m.rbox(1.04, 0.86, 0.1, 0.04, 0x1d6f8a, { p: [0, 1.25, 0.68], glow: 0.7 });
    for (let i = 0; i < 4; i++) m.box(0.8, 0.05, 0.03, 0xdffbff, { p: [0, 1.5 - i * 0.16, 0.74], glow: 1 });
    m.dome(0.8, CORAL, { p: [0, 1.86, 0], s: [1, 0.46, 1], seg: 18, top: 0xffb0a0 });
    antenna(m, 0, 2.2, 0, 0.26, GOLD);
    m.tor(0.16, 0.03, GOLD, { p: [0, 2.28, 0], r: [PH, 0, 0], seg: 12, glow: 0.8 });
  });

  // ---- Factories ----
  const F = {
    synth(m) {
      m.cyl(1.3, 1.4, 1.9, W, { p: [0, 1.25, 0], seg: 20, top: 0xffffff });
      m.tor(1.38, 0.08, 0xffa24d, { p: [0, 0.9, 0], r: [PH, 0, 0], seg: 24 });
      m.cyl(1.5, 0.9, 1, GOLD, { p: [0, 2.7, 0], seg: 18, open: false, top: 0xfff0b0 });
      m.cyl(1.32, 1.32, 0.06, 0xffc98a, { p: [0, 3.2, 0], seg: 18 });
      for (let i = 0; i < 8; i++) { const a = i * 2.3; m.sph(0.18, i % 2 ? 0xdfe6ff : 0x7cf7c0, { p: [Math.cos(a) * 0.72, 3.26, Math.sin(a) * 0.72], seg: 7, glow: 0.3 }); }
      port(m, [1.3, 1.5, 0.4], 0.3, 'x'); port(m, [0.4, 1.5, 1.3], 0.3, 'z');
      m.pipe([1.1, 0.9, 1.1], [1.75, 0.5, 1.75], 0.18, W2, { seg: 10 });
      m.at([1.72, 0.65, 0.9], 0.5, () => A.sack(m, 0xffd08a, 0xff9d3d));
      m.at([1, 0.65, 1.76], 0.45, () => A.sack(m, 0xc9b0ff, 0x8f6bff));
    },
    bakery(m) {
      m.dome(1.95, 0xffcf9a, { p: [0, 0.32, 0], s: [1, 1.02, 1], top: 0xfff0d8, seg: 24 });
      m.tor(1.97, 0.1, CORAL, { p: [0, 0.42, 0], r: [PH, 0, 0], seg: 30 });
      door(m, [1.36, 0.95, 1.36], 0.1, 0.1, CORAL, 'z');
      m.rbox(1.1, 1.3, 0.16, 0.08, CORAL, { p: [1.28, 0.92, 1.28], r: [0, PI / 4, 0], top: 0xffb0a0 });
      port(m, [1.72, 1.2, -0.6], 0.34, 'x'); port(m, [-0.6, 1.2, 1.72], 0.34, 'z');
      m.cyl(0.32, 0.38, 1.4, 0xb08f70, { p: [-0.7, 2.3, -0.7], seg: 10, top: 0xd0b090 });
      m.cyl(0.42, 0.42, 0.14, DK, { p: [-0.7, 3, -0.7], seg: 12 });
    },
    dairy(m) {
      [[-0.7, -0.7, 1.15, 2.6], [0.9, -0.3, 0.95, 2.1], [-0.3, 1.0, 0.9, 1.7]].forEach(([x, z, r, h]) => {
        m.cyl(r, r + 0.04, h, W, { p: [x, 0.32 + h / 2, z], seg: 18, top: 0xffffff });
        m.dome(r, 0xc9b0ff, { p: [x, 0.32 + h, z], s: [1, 0.55, 1], seg: 18, top: 0xf1e8ff, glow: 0.15 });
        m.tor(r + 0.02, 0.06, VIO, { p: [x, 0.32 + h * 0.5, z], r: [PH, 0, 0], seg: 22, glow: 0.3 });
      });
      m.pipe([-0.2, 1.8, -0.5], [0.4, 1.8, -0.4], 0.1, W2); m.pipe([-0.4, 1.2, 0.3], [-0.5, 1.2, 0.5], 0.1, W2);
      port(m, [1.85, 1.5, -0.3], 0.26, 'x'); port(m, [-0.3, 1.2, 1.9], 0.26, 'z');
    },
    sugar(m) {
      m.cyl(1.2, 1.6, 1.1, W, { p: [0, 0.87, 0], seg: 20, top: 0xffffff });
      m.cyl(1.7, 1.2, 1.1, GLASS, { p: [0, 2, 0], seg: 22, glow: 0.3, top: 0xeafcff });
      m.tor(1.7, 0.1, 0x3fa7d6, { p: [0, 2.56, 0], r: [PH, 0, 0], seg: 28 });
      for (let i = 0; i < 9; i++) { const a = i * 2.1, r = 0.4 + (i % 3) * 0.35; m.sph(0.22, 0xffffff, { p: [Math.cos(a) * r, 2.1 + (i % 3) * 0.15, Math.sin(a) * r], seg: 7, glow: 0.4 }); }
      m.cyl(0.1, 0.1, 0.6, W2, { p: [0, 2.9, 0], seg: 8 }); m.box(1.8, 0.08, 0.2, 0xffcf5c, { p: [0, 3.2, 0], r: [0, 0.6, 0] });
      port(m, [1.42, 0.85, 0.3], 0.26, 'x');
    },
    snack(m) {
      m.rbox(3.3, 2.2, 3, 0.3, W, { p: [0, 1.42, 0], top: 0xffffff });
      m.rbox(3.34, 0.3, 3.04, 0.1, CORAL, { p: [0, 0.84, 0] });
      m.rbox(1.9, 1, 0.1, 0.05, 0x1d6f8a, { p: [0.2, 1.72, 1.52], glow: 0.7 });
      m.rbox(0.1, 1, 1.5, 0.05, 0x1d6f8a, { p: [1.67, 1.72, 0], glow: 0.7 });
      m.box(2.8, 0.12, 0.12, DK, { p: [0, 2.72, 0] }); m.rbox(0.6, 0.5, 0.6, 0.1, GOLD, { p: [0.5, 2.9, 0] });
      m.at([-0.6, 3.25, -0.2], 0.72, () => A.tub(m, 0xfff4c0, 0xff7a6b), 0.5);
      antenna(m, 1.4, 2.5, -1.2, 0.8, MINT);
    },
    grill(m) {
      m.rbox(3.5, 1.2, 2.5, 0.3, 0x5a4f93, { p: [0, 0.94, 0], top: 0x8a7cd0 });
      m.dome(1.2, W, { p: [0, 1.52, 0], s: [1.42, 0.8, 1], top: 0xffffff, seg: 20 });
      for (let i = 0; i < 5; i++) m.rbox(3.1, 0.06, 0.1, 0.02, 0xff8f3d, { p: [0, 1.56, -0.8 + i * 0.4], glow: 1 });
      m.cyl(0.28, 0.34, 1.2, W2, { p: [-1.1, 3, -0.6], seg: 10 });
      m.cone(0.46, 0.36, CORAL, { p: [-1.1, 3.74, -0.6], seg: 10 });
      m.rbox(0.9, 0.18, 0.16, 0.06, GOLD, { p: [0.6, 1.4, 1.36] });
      m.rbox(0.9, 0.18, 0.16, 0.06, GOLD, { p: [-0.6, 1.4, 1.36] });
      port(m, [1.76, 1, 0.4], 0.24, 'x');
    },
    pie(m) {
      m.cyl(1.1, 1.4, 0.9, 0x5a4f93, { p: [0, 0.75, 0], seg: 20, top: 0x8a7cd0 });
      m.tor(1.58, 0.28, W, { p: [0, 1.9, 0], r: [PH + 0.14, 0, 0.14], seg: 30 });
      m.tor(1.58, 0.08, 0xff9d3d, { p: [0, 1.9, 0], r: [PH + 0.14, 0, 0.14], seg: 30, glow: 1 });
      m.sph(0.8, 0xffd24d, { p: [0, 1.9, 0], glow: 1.3, top: 0xffffff });
      m.cyl(0.14, 0.14, 2, W2, { p: [0, 1.5, 0], seg: 8 });
      m.at([0, 3.15, 0], 0.72, () => A.pie(m, 0xffa24d, 0xe8b070));
      port(m, [1.2, 0.8, 0.4], 0.22, 'x');
    },
    loom(m) {
      m.rbox(0.3, 3, 0.3, 0.1, W, { p: [-1.6, 1.8, 0] }); m.rbox(0.3, 3, 0.3, 0.1, W, { p: [1.6, 1.8, 0] });
      m.rbox(3.6, 0.3, 0.4, 0.1, CORAL, { p: [0, 3.25, 0] });
      m.rbox(3.4, 0.2, 1.8, 0.08, 0x5a4f93, { p: [0, 0.9, 0.2] });
      for (let i = 0; i < 17; i++) { const c = [PINK, CYAN, GOLD, MINT][i % 4]; m.pipe([-1.45 + i * 0.18, 3.1, 0], [-1.45 + i * 0.18, 1, 0.8], 0.018, c, { seg: 5, glow: 0.8 }); }
      m.cyl(0.2, 0.2, 3, 0xffc9e8, { p: [0, 0.95, 1.1], r: [0, 0, PH], seg: 12, top: 0xffffff });
      m.rbox(3, 0.04, 1, 0.02, 0xffc9e8, { p: [0, 1.04, 0.5], glow: 0.2 });
    },
    smelter(m) {
      m.cyl(1, 1.5, 2.6, 0x6a5a9e, { p: [0, 1.62, 0], seg: 14, top: 0x8a7cd0 });
      m.tor(1.26, 0.12, 0xff6a3d, { p: [0, 1.5, 0], r: [PH, 0, 0], seg: 22, glow: 1.2 });
      m.rbox(1.1, 1, 0.2, 0.08, 0xff8f3d, { p: [0.98, 1.1, 0.98], r: [0, PI / 4, 0], glow: 1.2 });
      m.cyl(0.42, 0.56, 1.3, W2, { p: [0, 3.5, 0], seg: 12 });
      m.cyl(0.56, 0.56, 0.16, CORAL, { p: [0, 4.14, 0], seg: 12 });
      m.at([1.7, 0.42, 0.4], 0.4, () => A.ingot(m, 0xaab4d8, 0xe0e6ff));
      m.at([0.4, 0.42, 1.7], 0.4, () => A.ingot(m, 0x46d6c0, 0xbffff4));
    },
    stitch(m) {
      m.cyl(1.25, 1.45, 3, W, { p: [0, 1.82, 0], seg: 22, top: 0xffffff });
      m.dome(1.25, 0xff7a6b, { p: [0, 3.3, 0], s: [1, 0.7, 1], seg: 22, top: 0xffb0a0 });
      port(m, [1.42, 2, 0.4], 0.3, 'x'); port(m, [0.4, 2, 1.42], 0.3, 'z');
      for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; m.box(0.2, 0.05, 0.04, 0xffffff, { p: [Math.cos(a) * 1.41, 0.95, Math.sin(a) * 1.41], r: [0, -a + PH, 0] }); }
      m.at([0, 4.5, 0], 0.72, () => A.suit(m, 0xf3eeff, 0xff7a6b), 0.2);
    },
    galley(m) {
      m.sph(2, 0x3f8fd8, { p: [0, 1.5, 0], s: [1, 0.68, 0.72], top: 0x7fc8ff, seg: 22 });
      m.rbox(3, 0.2, 2.2, 0.08, W, { p: [0, 2.2, 0] });
      m.rbox(1.6, 0.8, 1.2, 0.2, W, { p: [-0.3, 2.7, 0], top: 0xffffff });
      port(m, [1.2, 1.5, 1.12], 0.24, 'z'); port(m, [0.2, 1.4, 1.34], 0.24, 'z'); port(m, [-0.9, 1.5, 1.2], 0.24, 'z');
      m.tor(0.32, 0.05, GOLD, { p: [1.9, 1.9, 0], r: [0, PH, 0], seg: 12, glow: 0.4 });
      m.at([0.9, 2.72, 0], 0.6, () => A.fish(m, 0x7f8cff, 0xc9d0ff), 0.4);
    },
    cake(m) {
      [[1.85, 1], [1.4, 0.9], [0.95, 0.8]].reduce((y, [r, h], i) => {
        m.cyl(r, r, h, i === 1 ? 0xffd0e8 : W, { p: [0, y + h / 2, 0], seg: 22, top: 0xffffff });
        m.tor(r, 0.1, i === 1 ? GOLD : PINK, { p: [0, y + h, 0], r: [PH, 0, 0], seg: 26, glow: 0.3 });
        return y + h;
      }, 0.32);
      port(m, [1.86, 0.82, 0.4], 0.26, 'x'); port(m, [0.4, 0.82, 1.86], 0.26, 'z');
      port(m, [1.42, 1.75, 0.3], 0.2, 'x');
      m.cyl(0.1, 0.1, 0.5, CORAL, { p: [0, 3.27, 0], seg: 8 }); m.sph(0.14, GOLD, { p: [0, 3.6, 0], glow: 1.3, seg: 8 });
    },
    juice(m) {
      m.cyl(1.7, 1.15, 2.9, 0xff8fb8, { p: [0, 1.76, 0], seg: 22, glow: 0.3, top: 0xffd8e8 });
      m.tor(1.7, 0.1, W, { p: [0, 3.2, 0], r: [PH, 0, 0], seg: 28 });
      m.pipe([0.3, 2.6, 0], [1.1, 4.4, 0.5], 0.13, MINT, { glow: 0.4 });
      m.cyl(0.95, 0.95, 0.12, GOLD, { p: [-1.4, 3.3, -0.6], r: [PH, 0, 0.5], seg: 18 });
      for (let i = 0; i < 6; i++) { const a = i * 2.4; m.sph(0.14, 0xffffff, { p: [Math.cos(a) * 0.8, 3 + (i % 2) * 0.1, Math.sin(a) * 0.8], seg: 6, glow: 0.8 }); }
    },
    cryo(m) {
      m.dome(1.85, 0xd8f4ff, { p: [0, 0.32, 0], top: 0xffffff, seg: 24, glow: 0.2 });
      [[-1, 1.4, 0.7, 0.3], [0.6, 2.2, 0.45, -0.2], [0.9, 1.2, 0.5, 0.4], [-0.4, 1.9, 0.6, 0.1]].forEach(([x, y, r, k]) => m.octa(r, CYAN, { p: [x, y, -0.8], s: [0.55, 1.5, 0.55], r: [0, k, k], glow: 0.7, top: 0xffffff }));
      m.rbox(1, 1.3, 0.16, 0.08, 0x3fa7d6, { p: [1.25, 1, 1.25], r: [0, PI / 4, 0] });
      m.at([0, 3.05, 0], 0.72, () => A.icecream(m, 0xbff0ff, 0xffd0e8));
    },
    gems(m) {
      m.rbox(3.2, 1.6, 3.2, 0.2, 0x5a4f93, { p: [0, 1.12, 0], top: 0x8a7cd0 });
      m.octa(1.5, 0xff4d6d, { p: [0, 2.9, 0], s: [1.1, 0.95, 1.1], top: 0xffb8c8, glow: 0.45 });
      port(m, [1.62, 1.2, 0.6], 0.28, 'x'); port(m, [0.6, 1.2, 1.62], 0.28, 'z');
      door(m, [-0.6, 0.9, 1.62], 0.7, 1, GOLD, 'z');
    },
    lantern(m) {
      m.cyl(1.3, 1.6, 1.4, W, { p: [0, 1.02, 0], seg: 18, top: 0xffffff });
      m.cyl(0.9, 1.1, 1.3, W2, { p: [0, 2.4, 0], seg: 16 });
      m.cyl(0.8, 0.8, 1, 0xffc94d, { p: [0, 3.5, 0], seg: 12, glow: 1.3, top: 0xffffff });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; m.cyl(0.05, 0.05, 1.1, DK, { p: [Math.cos(a) * 0.84, 3.5, Math.sin(a) * 0.84], seg: 6 }); }
      m.cone(1.1, 0.7, CORAL, { p: [0, 4.36, 0], seg: 12 });
      port(m, [1.46, 1.1, 0.4], 0.26, 'x');
    },
  };
  const FSIGN = { synth: null, bakery: 'bread', dairy: 'cheese', sugar: 'candy', snack: null, grill: 'burger', pie: null, loom: 'cloth', smelter: null, stitch: null, galley: null, cake: 'starcake', juice: 'mjuice', cryo: null, gems: 'ring', lantern: null };
  const FSIGNY = { bakery: 2.9, dairy: 3.8, sugar: 3.9, grill: 3.5, loom: 4.2, cake: 4.4, juice: 4.7, gems: 4.8 };
  M.factory = (kind) => G.model('factory-' + kind, (m) => {
    base(m, 4.5, 4.5, { synth: 0x4a3d8f, bakery: 0x7a4a6a, dairy: 0x5a4aa8, sugar: 0x3f5fa8, snack: 0x6a4a8f, grill: 0x5a3a5a, pie: 0x7a4a4f, loom: 0x6a3f7a, smelter: 0x4a3a5a, stitch: 0x4a4f9f, galley: 0x2f5a8f, cake: 0x8a5a8a, juice: 0x8a4a6a, cryo: 0x3f7a9f, gems: 0x5a3a7a, lantern: 0x7a6a4a }[kind]);
    F[kind](m);
    if (FSIGN[kind]) sign(m, FSIGNY[kind], FSIGN[kind]);
  });

  // ---- Rocks, thickets, crystals ----
  M.rock = (kind, seed) => G.model('rock-' + kind + (seed % 4), (m) => {
    const k = seed % 4;
    if (kind === 'rock') {
      m.ico(0.5, 0x8a7cc0, { detail: 0, p: [0, 0.34, 0], r: [k, k * 2, 0], s: [1.1, 0.8, 1], top: 0xb8acec });
      m.ico(0.28, 0x7264a8, { detail: 0, p: [0.34, 0.2, 0.2], r: [k * 3, 1, 0], top: 0xa89cdc });
    } else if (kind === 'thicket') {
      [[0, 0.4, 0, 0.4], [0.28, 0.3, 0.1, 0.28], [-0.25, 0.28, 0.15, 0.3]].forEach(([x, y, z, r]) => m.sph(r, 0xd04fa8, { p: [x, y, z], seg: 9, top: 0xffa8dc }));
      for (let i = 0; i < 6; i++) { const a = i * 1.05 + k; m.cone(0.05, 0.3, 0xffd0f0, { p: [Math.cos(a) * 0.32, 0.56, Math.sin(a) * 0.32], r: [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7], seg: 5, glow: 0.4 }); }
    } else {
      [[0, 0.45, 0, 0.3, 0], [0.26, 0.3, 0.1, 0.2, -0.4], [-0.22, 0.28, 0.15, 0.2, 0.4]].forEach(([x, y, z, r, tilt]) => m.octa(r, 0x7bdcff, { p: [x, y, z], s: [0.7, 1.7, 0.7], r: [0, k, tilt], top: 0xf0fbff, glow: 0.65 }));
    }
  });

  M.beacon = () => G.model('beacon', (m) => {
    m.cyl(0.44, 0.54, 0.2, DK, { p: [0, 0.1, 0], seg: 10 });
    m.cyl(0.06, 0.08, 1.9, W2, { p: [0, 1.1, 0], seg: 7 });
    m.add(new T.ConeGeometry(0.42, 0.9, 3), CORAL, { p: [0.5, 1.68, 0], r: [0, 0, -PH], s: [1, 1, 0.15], top: 0xffb0a0 });
    m.sph(0.15, MINT, { p: [0, 2.12, 0], seg: 9, glow: 1.4 });
  });

  M.crate = () => G.model('crate', (m) => {
    m.cyl(0.8, 1, 0.12, 0x2a1c52, { p: [0, 0.06, 0], seg: 14 });
    m.rbox(0.9, 0.9, 0.9, 0.16, W, { p: [0, 0.6, 0], r: [0.1, 0.5, 0.08], top: 0xffffff });
    m.rbox(0.94, 0.14, 0.94, 0.05, CYAN, { p: [0, 0.64, 0], r: [0.1, 0.5, 0.08], glow: 1.1 });
    m.octa(0.15, GOLD, { p: [0.02, 1.2, 0], glow: 1.3 });
  });

  // ---- Decorations ----
  const D = {
    hexpath(m) { m.cyl(0.57, 0.57, 0.08, 0xbcb4e8, { p: [0, 0.05, 0], seg: 6, top: 0xe2dcff }); },
    fence(m) {
      m.cyl(0.08, 0.11, 0.84, W, { p: [0, 0.42, 0], seg: 8 });
      m.sph(0.1, GOLD, { p: [0, 0.88, 0], seg: 7, glow: 0.9 });
      m.pipe([-0.5, 0.64, 0], [0.5, 0.64, 0], 0.045, MINT, { glow: 0.9 });
      m.pipe([-0.5, 0.36, 0], [0.5, 0.36, 0], 0.035, MINT, { glow: 0.7 });
    },
    lamp(m) {
      m.cyl(0.16, 0.26, 0.2, DK, { p: [0, 0.1, 0], seg: 10 });
      m.pipe([0, 0.1, 0], [0, 1.5, 0], 0.05, W2);
      m.sph(0.24, LAMP, { p: [0, 1.66, 0], glow: 1.5, top: 0xffffff });
      m.dome(0.28, DK, { p: [0, 1.76, 0], s: [1, 0.4, 1], seg: 12 });
    },
    pot(m) {
      m.cyl(0.32, 0.22, 0.34, CORAL, { p: [0, 0.2, 0], seg: 12, top: 0xffb0a0 });
      for (let i = 0; i < 6; i++) { const a = i * 1.05; m.sph(0.16, i % 2 ? PINK : MINT, { p: [Math.cos(a) * 0.2, 0.52 + (i % 3) * 0.1, Math.sin(a) * 0.2], seg: 8, top: 0xffffff, glow: 0.3 }); }
    },
    bench(m) {
      m.rbox(1.7, 0.1, 0.5, 0.04, 0xc9b0ff, { p: [0, 0.46, 0], top: 0xe2d4ff });
      m.rbox(1.7, 0.42, 0.08, 0.04, 0xc9b0ff, { p: [0, 0.76, -0.22], r: [-0.14, 0, 0] });
      [[-0.7, 0.16], [0.7, 0.16], [-0.7, -0.16], [0.7, -0.16]].forEach(([x, z]) => m.cyl(0.05, 0.06, 0.44, DK, { p: [x, 0.22, z], seg: 6 }));
      m.octa(0.1, GOLD, { p: [0, 1, -0.24], glow: 1 });
    },
    mail(m) {
      m.cyl(0.06, 0.08, 0.9, W2, { p: [0, 0.45, 0], seg: 7 });
      m.rbox(0.66, 0.38, 0.4, 0.14, 0x3fa7d6, { p: [0, 1, 0], top: 0x8ee9ff });
      m.add(new T.ConeGeometry(0.16, 0.34, 3), CORAL, { p: [0.28, 1.34, 0.2], r: [0, 0, -PH], s: [1, 1, 0.2] });
      m.pipe([0.1, 1.15, 0.2], [0.1, 1.42, 0.2], 0.018, W);
    },
    crystal(m) {
      [[0, 0.7, 0, 0.42, 0], [0.26, 0.45, 0.12, 0.28, -0.35], [-0.24, 0.42, 0.14, 0.26, 0.35]].forEach(([x, y, z, r, tilt]) => m.octa(r, 0xff8fd8, { p: [x, y, z], s: [0.7, 1.9, 0.7], r: [0, 0.4, tilt], top: 0xffe8f8, glow: 0.8 }));
    },
    dish(m) {
      m.cyl(0.4, 0.56, 0.3, W2, { p: [0, 0.15, 0], seg: 12 });
      m.pipe([0, 0.2, 0], [0, 0.95, 0], 0.1, W);
      m.dome(0.9, W, { p: [0.18, 1.05, 0.18], r: [PI - 0.7, PI / 4, 0], s: [1, 0.42, 1], seg: 18, top: 0xc9c2ea });
      m.pipe([0.18, 1.1, 0.18], [0.62, 1.52, 0.62], 0.03, DK);
      m.sph(0.1, CORAL, { p: [0.64, 1.56, 0.64], seg: 8, glow: 1.2 });
    },
    solar(m) {
      m.cyl(0.05, 0.1, 1.5, W2, { p: [0, 0.75, 0], seg: 7 });
      for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2; m.rbox(0.72, 0.22, 0.03, 0.01, 0x3f6fd6, { p: [Math.cos(a) * 0.4 + 0.05, 1.5 + Math.sin(a) * 0.4, 0.05], r: [0, 0, a], glow: 0.35 }); }
      m.sph(0.1, GOLD, { p: [0.05, 1.5, 0.1], seg: 8, glow: 1 });
    },
    scope(m) {
      m.pipe([0, 0, 0], [0, 0.9, 0], 0.06, DK); m.pipe([0.5, 0, 0.3], [0, 0.9, 0], 0.05, DK); m.pipe([-0.4, 0, 0.4], [0, 0.9, 0], 0.05, DK);
      m.pipe([-0.6, 0.6, -0.5], [0.5, 1.5, 0.45], 0.2, W, { seg: 12 });
      m.tor(0.21, 0.04, GOLD, { p: [0.5, 1.5, 0.45], r: [0.7, 0.8, 0], seg: 14, glow: 0.4 });
      m.pipe([-0.74, 0.5, -0.62], [-0.6, 0.6, -0.5], 0.08, CORAL);
    },
    gnome(m) {
      m.sph(0.25, 0x8cf07c, { p: [0, 0.3, 0], s: [1, 1.05, 1], top: 0xc8ffb8 });
      m.cone(0.25, 0.6, CORAL, { p: [0, 0.78, 0], seg: 10 });
      eyes(m, 0.17, 0.36, 0.08 - 0.08, 0.1, 0.08, 'x');
      m.sph(0.1, 0xff9d3d, { p: [0, 0.12, 0.15], seg: 7, s: [1.2, 0.5, 1] });
      m.sph(0.1, 0xff9d3d, { p: [0, 0.12, -0.15], seg: 7, s: [1.2, 0.5, 1] });
    },
    fountain(m) {
      m.cyl(1.32, 1.4, 0.42, W, { p: [0, 0.21, 0], seg: 22, top: 0xffffff });
      m.cyl(1.16, 1.16, 0.06, 0x46d6c0, { p: [0, 0.42, 0], seg: 22, glow: 0.9 });
      m.cyl(0.26, 0.4, 1, W2, { p: [0, 0.82, 0], seg: 12 });
      m.cyl(0.64, 0.5, 0.2, W, { p: [0, 1.36, 0], seg: 16 });
      for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; m.pipe([0, 1.46, 0], [Math.cos(a) * 0.86, 0.55, Math.sin(a) * 0.86], 0.04, CYAN, { glow: 1.2, seg: 5 }); }
      m.octa(0.2, MINT, { p: [0, 1.8, 0], glow: 1.3 });
    },
    swing(m) {
      m.pipe([-0.9, 0, 0.4], [-0.9, 1.9, 0], 0.07, W); m.pipe([-0.9, 0, -0.4], [-0.9, 1.9, 0], 0.07, W);
      m.pipe([0.9, 0, 0.4], [0.9, 1.9, 0], 0.07, W); m.pipe([0.9, 0, -0.4], [0.9, 1.9, 0], 0.07, W);
      m.pipe([-0.95, 1.9, 0], [0.95, 1.9, 0], 0.08, CORAL);
      m.pipe([-0.3, 1.9, 0], [-0.3, 0.7, 0.3], 0.02, MINT, { glow: 0.8 }); m.pipe([0.3, 1.9, 0], [0.3, 0.7, 0.3], 0.02, MINT, { glow: 0.8 });
      m.rbox(0.8, 0.08, 0.3, 0.03, GOLD, { p: [0, 0.68, 0.3] });
    },
    rivet(m) { m.cyl(0.72, 0.86, 0.42, 0x8a7cc0, { p: [0, 0.21, 0], seg: 16, top: 0xb8acec }); m.at([0, 0.42, 0], 1.3, () => rivet(m, true), PI / 4); },
    orrery(m) {
      m.cyl(0.7, 1, 0.3, 0xffcf5c, { p: [0, 0.15, 0], seg: 18, top: 0xfff0b0 });
      m.cyl(0.08, 0.12, 2.2, 0xffa82e, { p: [0, 1.4, 0], seg: 8 });
      m.sph(0.44, 0xffd94d, { p: [0, 2.5, 0], glow: 1.3, top: 0xffffff });
      [[1, 0.14, CYAN, 0], [1.34, 0.18, CORAL, 2], [1.08, 0.1, MINT, 4]].forEach(([r, s, c, a], i) => {
        m.tor(r, 0.02, 0xffa82e, { p: [0, 2.5, 0], r: [PH + i * 0.34, 0, i * 0.3], seg: 26 });
        m.sph(s, c, { p: [Math.cos(a) * r, 2.5 + Math.sin(a) * r * 0.25 * i, Math.sin(a) * r], glow: 0.5, seg: 9 });
      });
    },
  };
  M.decor = (kind) => G.model('decor-' + kind, (m) => D[kind](m));

  // ---- Sites out past the fence ----
  M.rocketPad = () => G.model('rocketpad', (m) => {
    m.cyl(5, 5.2, 0.4, PLAT, { p: [0, 0.2, 0], seg: 32, top: 0x7264d0 });
    m.tor(4.3, 0.1, GOLD, { p: [0, 0.42, 0], r: [PH, 0, 0], seg: 40, glow: 1 });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; m.box(1, 0.04, 0.3, i % 2 ? CORAL : W, { p: [Math.cos(a) * 3.3, 0.42, Math.sin(a) * 3.3], r: [0, -a, 0] }); }
    // Service tower.
    m.at([-3.4, 0.4, -2.2], 1, () => {
      for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]]) m.pipe([x, 0, z], [x * 0.7, 8.4, z * 0.7], 0.09, W2);
      for (let y = 1; y < 8.4; y += 1.4) { const k = 1 - y * 0.035; m.rbox(1.6 * k, 0.12, 1.6 * k, 0.04, CORAL, { p: [0, y, 0] }); }
      m.pipe([0.4, 6.6, 0.4], [2.2, 6.6, 1.6], 0.12, W2);
      antenna(m, 0, 8.4, 0, 1, MINT);
    });
  });

  M.rocket = () => G.model('rocket', (m) => {
    m.sph(1.7, W, { p: [0, 3.7, 0], s: [1, 2.1, 1], top: 0xffffff, seg: 20 });
    m.cone(1.25, 1.9, CORAL, { p: [0, 7.6, 0], seg: 18, top: 0xffb0a0 });
    m.tor(1.42, 0.12, CORAL, { p: [0, 6.5, 0], r: [PH, 0, 0], seg: 26, s: [1, 1, 1] });
    m.tor(1.66, 0.1, MINT, { p: [0, 4.6, 0], r: [PH, 0, 0], seg: 26, glow: 0.7 });
    port(m, [1.2, 5.4, 1.2 - 0.1], 0.46, 'z'); port(m, [1.65, 3.8, 0.4], 0.32, 'x'); port(m, [0.4, 3.8, 1.65], 0.32, 'z');
    for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; m.rbox(1.5, 2, 0.2, 0.08, CORAL, { p: [Math.cos(a) * 1.72, 1.4, Math.sin(a) * 1.72], r: [0, -a, 0], top: 0xffb0a0 }); }
    m.cyl(0.8, 1.2, 0.7, DK, { p: [0, 0.32, 0], seg: 16 });
    m.cyl(0.62, 0.62, 0.1, 0xff9d3d, { p: [0, -0.02, 0], seg: 16, glow: 1.4 });
  });

  M.road = () => G.model('roadlamp', (m) => {
    m.cyl(0.05, 0.08, 1.4, W2, { p: [0, 0.7, 0], seg: 6 });
    m.sph(0.14, MINT, { p: [0, 1.5, 0], seg: 8, glow: 1.4 });
  });

  M.mine = () => G.model('mine', (m) => {
    [[0, 1.5, -1.6, 4.2, 1], [-3.3, 1, -0.6, 2.9, 2], [3.2, 1, -0.8, 3.1, 3], [-1.4, 3.6, -2.4, 2.4, 4], [1.6, 3.2, -2.2, 2.4, 5]].forEach(([x, y, z, r, k]) => m.ico(r, 0x6a5aa8, { detail: 1, p: [x, y, z], r: [k, k * 2, 0], s: [1.15, 0.8, 1], top: 0x9f8fdc }));
    [[-2.6, 3.4, -0.6], [2.4, 3.2, -0.2], [0.3, 5.6, -1.4]].forEach(([x, y, z], i) => m.octa(0.48, i === 1 ? PINK : CYAN, { p: [x, y, z], s: [0.7, 1.7, 0.7], r: [0, 0.4, i * 0.3 - 0.2], glow: 0.9, top: 0xffffff }));
    m.rbox(3.5, 3.2, 1.6, 0.3, 0x201040, { p: [0, 1.6, 1.2] });
    m.rbox(0.42, 3.4, 0.42, 0.08, 0xc98a5c, { p: [-1.86, 1.7, 2] }); m.rbox(0.42, 3.4, 0.42, 0.08, 0xc98a5c, { p: [1.86, 1.7, 2] });
    m.rbox(4.3, 0.46, 0.46, 0.08, 0xa86f48, { p: [0, 3.42, 2] });
    m.box(0.14, 0.05, 6, 0xd6dcff, { p: [-0.6, 0.06, 4] }); m.box(0.14, 0.05, 6, 0xd6dcff, { p: [0.6, 0.06, 4] });
    for (let i = 0; i < 9; i++) m.box(1.7, 0.05, 0.22, 0xa86f48, { p: [0, 0.03, 1.3 + i * 0.7] });
    m.at([0, 0.1, 4.6], 1, () => {
      m.rbox(1.4, 0.8, 1.6, 0.14, 0x8a7cc0, { p: [0, 0.8, 0] });
      [[-0.3, 0.1, -0.3], [0.3, 0.1, 0.2], [0, 0.26, 0]].forEach(([x, y, z]) => m.octa(0.34, GOLD, { p: [x, 1.1 + y, z], glow: 0.7 }));
      [[-0.7, 0.5], [0.7, 0.5], [-0.7, -0.5], [0.7, -0.5]].forEach(([x, z]) => m.cyl(0.24, 0.24, 0.1, DK, { p: [x, 0.26, z], r: [0, 0, PH], seg: 10 }));
    });
    m.sph(0.26, LAMP, { p: [-1.5, 3, 2.5], seg: 8, glow: 1.5 }); m.sph(0.26, LAMP, { p: [1.5, 3, 2.5], seg: 8, glow: 1.5 });
  });

  M.dock = () => G.model('dock', (m) => {
    for (let i = 0; i < 11; i++) m.rbox(3, 0.14, 0.6, 0.04, i % 3 ? 0xc9b0ff : 0xb79cf0, { p: [0, 0.36, -3 + i * 0.68], top: 0xe2d4ff });
    for (let i = 0; i < 5; i++) { const z = -2.8 + i * 1.7; m.cyl(0.14, 0.14, 1.4, 0x6a5aa8, { p: [-1.4, 0.2, z], seg: 8 }); m.cyl(0.14, 0.14, 1.4, 0x6a5aa8, { p: [1.4, 0.2, z], seg: 8 }); }
    m.pipe([-1.4, 1, 3.8], [-1.4, 1, -3], 0.03, MINT, { glow: 0.8 });
    m.at([1.3, 0.4, 3.6], 1, () => {
      m.cyl(0.07, 0.1, 2, W2, { p: [0, 1, 0], seg: 7 });
      m.sph(0.26, LAMP, { p: [0, 2.2, 0], glow: 1.6 });
    });
    m.at([-1, 0.46, 2.2], 1, () => {
      m.cyl(0.2, 0.24, 0.4, 0x8a5a3c, { p: [0, 0.2, 0], seg: 10 });
      m.pipe([0, 0.4, 0], [0.9, 1.6, 1], 0.03, 0xd6dcff);
    });
    m.at([2.9, 0, 1.2], 1, () => {
      m.sph(1, 0xff7a6b, { p: [0, 0.35, 0], s: [0.8, 0.42, 1.5], top: 0xffb0a0, seg: 14 });
      m.rbox(0.9, 0.08, 1.8, 0.04, W, { p: [0, 0.6, 0] });
      m.cyl(0.04, 0.05, 1.3, W2, { p: [0, 1.2, 0], seg: 6 });
    });
  });

  // ---- Starport Town ----
  M.ruin = (id) => G.model('ruin-' + id, (m) => {
    base(m, 5.4, 5.4, 0x54486f);
    m.rbox(3.6, 1.2, 3.2, 0.2, 0x8a84a8, { p: [0, 0.92, 0], top: 0xa8a2c4 });
    for (const [x, z] of [[-2.2, -2], [2.2, -2], [2.2, 2], [-2.2, 2]]) m.pipe([x, 0.3, z], [x, 3.2, z], 0.06, 0xd6dcff);
    m.pipe([-2.2, 3, -2], [2.2, 3, -2], 0.05, 0xd6dcff); m.pipe([2.2, 3, -2], [2.2, 3, 2], 0.05, 0xd6dcff); m.pipe([-2.2, 2, 2], [2.2, 2, 2], 0.05, 0xd6dcff);
    m.rbox(3, 0.08, 2.4, 0.04, CORAL, { p: [0, 1.62, 0], r: [0.1, 0, 0.1], top: 0xffb0a0 });
    m.rbox(0.8, 0.7, 0.8, 0.06, 0xffc98a, { p: [1.8, 0.65, 2] });
    m.sph(0.4, GOLD, { p: [-1.8, 0.7, 2], s: [1, 0.3, 1], seg: 8, glow: 0.2 });
  });

  const L = {
    diner(m) {
      m.cyl(1.6, 1.6, 4.6, 0xdfe6ff, { p: [0, 1.75, 0], r: [0, 0, PH], seg: 22, top: 0xffffff });
      m.sph(1.6, 0xdfe6ff, { p: [2.3, 1.75, 0], s: [0.5, 1, 1], seg: 18 }); m.sph(1.6, 0xdfe6ff, { p: [-2.3, 1.75, 0], s: [0.5, 1, 1], seg: 18 });
      m.tor(1.63, 0.1, CORAL, { p: [0, 1.75, 0], r: [PH, 0, 0], s: [2.05, 1, 1], seg: 34, glow: 0.3 });
      for (let i = 0; i < 4; i++) port(m, [-1.6 + i * 1.1, 2.1, 1.42], 0.34, 'z');
      door(m, [2.2, 1.2, 0.2], 1, 1.6, CORAL, 'x');
      m.cyl(0.05, 0.05, 1.3, W2, { p: [-1.2, 3.8, 0], seg: 6 });
      m.octa(0.5, GOLD, { p: [-1.2, 4.7, 0], glow: 1.2, s: [1, 1, 0.3], r: [0, PI / 4, 0] });
    },
    inn(m) {
      [[2.2, 1.5], [1.8, 1.4], [1.35, 1.3]].reduce((y, [r, h], i) => {
        m.cyl(r, r + 0.1, h, i === 1 ? 0xffd0a8 : W, { p: [0, y + h / 2, 0], seg: 22, top: 0xffffff });
        for (let k = 0; k < 5; k++) { const a = PI / 4 + (k - 2) * 0.5; port(m, [Math.cos(a) * r, y + h / 2, Math.sin(a) * r], 0.24, k < 2 ? 'x' : 'z'); }
        return y + h;
      }, 0.32);
      m.dome(1.4, 0x8a6bff, { p: [0, 4.5, 0], s: [1, 0.6, 1], seg: 20, top: 0xc9b0ff });
      antenna(m, 0, 5.3, 0, 0.7, GOLD);
    },
    cinema(m) {
      m.rbox(4.8, 3.2, 3.8, 0.3, 0x5a4f93, { p: [0, 1.92, -0.4], top: 0x8a7cd0 });
      m.rbox(5, 0.9, 1, 0.2, GOLD, { p: [0, 3.1, 1.6], top: 0xfff0b0, glow: 0.45 });
      for (let i = 0; i < 10; i++) m.sph(0.1, i % 2 ? 0xffffff : CORAL, { p: [-2.25 + i * 0.5, 3.56, 2.12], seg: 7, glow: 1.3 });
      m.rbox(2, 2.2, 0.1, 0.06, CORAL, { p: [0, 1.32, 1.5] });
      m.rbox(0.9, 1.4, 0.1, 0.05, DK2, { p: [-1.6, 1.02, 1.56] }); m.rbox(0.9, 1.4, 0.1, 0.05, DK2, { p: [1.6, 1.02, 1.56] });
      m.octa(0.7, CYAN, { p: [0, 4.6, 0], glow: 0.9, s: [1, 1, 0.3], r: [0, PI / 4, 0] });
    },
    spa(m) {
      m.dome(2.5, 0xbfeaff, { p: [0, 0.32, -0.3], top: 0xffffff, glow: 0.3, seg: 24 });
      m.tor(2.52, 0.14, W, { p: [0, 0.4, -0.3], r: [PH, 0, 0], seg: 34 });
      m.cyl(1.1, 1.14, 0.16, W, { p: [1.4, 0.4, 1.6], seg: 18 });
      m.cyl(0.96, 0.96, 0.05, 0x46d6c0, { p: [1.4, 0.5, 1.6], seg: 18, glow: 1 });
      [[0, 1.5, 0.8, 0.5], [-1, 1.2, 0.4, 0.4], [0.9, 1.1, 0.2, 0.42]].forEach(([x, y, z, r]) => m.sph(r, PINK, { p: [x, y, z], seg: 10, glow: 0.4, top: 0xffffff }));
    },
    observatory(m) {
      m.cyl(2, 2.2, 1.8, W, { p: [0, 1.22, 0], seg: 22, top: 0xffffff });
      m.dome(2.05, 0xd9d2f5, { p: [0, 2.1, 0], seg: 24, top: 0xffffff });
      m.rbox(0.9, 2.2, 0.4, 0.1, DK2, { p: [1, 3, 1], r: [0.5, PI / 4, 0] });
      m.pipe([0.3, 2.9, 0.3], [2, 4.8, 2], 0.42, 0xc9c2ea, { seg: 14 });
      m.tor(0.44, 0.09, GOLD, { p: [2, 4.8, 2], r: [0.9, 0.8, 0], seg: 16, glow: 0.6 });
      for (let i = 0; i < 4; i++) port(m, [Math.cos(0.3 + i * 0.32) * 2.08, 1.3, Math.sin(0.3 + i * 0.32) * 2.08], 0.22, i < 2 ? 'x' : 'z');
    },
    plaza(m) {
      for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + 0.26; m.cyl(0.18, 0.24, 2.6, W, { p: [Math.cos(a) * 2.2, 1.6, Math.sin(a) * 2.2], seg: 10 }); m.sph(0.26, GOLD, { p: [Math.cos(a) * 2.2, 3, Math.sin(a) * 2.2], seg: 9, glow: 1.2 }); }
      m.tor(2.2, 0.14, CORAL, { p: [0, 2.85, 0], r: [PH, 0, 0], seg: 34 });
      m.cyl(0.6, 1, 0.5, 0xffcf5c, { p: [0, 0.55, 0], seg: 16 });
      m.octa(1.2, 0x8ee9ff, { p: [0, 2.3, 0], s: [0.6, 1.5, 0.6], glow: 0.9, top: 0xffffff });
    },
  };
  M.lot = (id) => G.model('lot-' + id, (m) => { base(m, 5.4, 5.4, 0x54488f); L[id](m); });

  // ---- Wild planet scatter ----
  M.wild = (i) => G.model('wild-' + i, (m) => {
    if (i === 0) { // bubble tree
      m.pipe([0, 0, 0], [0.1, 1.5, 0], 0.16, 0x7a5aa0, { seg: 6 });
      m.sph(1, 0xff8fc7, { p: [0.1, 2.3, 0], top: 0xffd8ee, seg: 9, glow: 0.14 });
      m.sph(0.6, 0xff6fb0, { p: [-0.6, 1.8, 0.2], top: 0xffc0de, seg: 7 });
    } else if (i === 1) { // cyan cap tree
      m.pipe([0, 0, 0], [-0.1, 2, 0], 0.13, 0x5a7ab0, { seg: 6 });
      m.dome(1.2, 0x4fd8e8, { p: [-0.1, 1.9, 0], s: [1, 0.62, 1], top: 0xc0fbff, seg: 10, glow: 0.3 });
    } else if (i === 2) { // rock
      m.ico(1, 0x7c6fb8, { s: [1.2, 0.7, 1], top: 0xa89cdc });
      m.ico(0.5, 0x6a5ca8, { p: [0.8, -0.1, 0.4], top: 0x9c8ed0 });
    } else if (i === 3) { // crystal spire
      m.octa(0.8, 0xff8fd8, { p: [0, 1.5, 0], s: [0.55, 2.2, 0.55], top: 0xffe8f8, glow: 0.8 });
      m.octa(0.5, 0x8ee9ff, { p: [0.6, 0.8, 0.2], s: [0.55, 1.9, 0.55], r: [0, 0, -0.3], top: 0xffffff, glow: 0.8 });
    } else if (i === 4) { // yellow puff tree
      m.pipe([0, 0, 0], [0.2, 1.3, 0], 0.13, 0x8a5fa0, { seg: 6 });
      m.pipe([0.2, 1.2, 0], [-0.4, 2, 0], 0.08, 0x8a5fa0, { seg: 5 });
      m.sph(0.72, 0xffd94d, { p: [0.3, 2, 0], top: 0xfff4c0, seg: 8, glow: 0.2 });
      m.sph(0.5, 0xffb03d, { p: [-0.5, 2.2, 0.1], top: 0xffe08a, seg: 7, glow: 0.2 });
    } else { // lone mesa
      m.cyl(1.4, 2.2, 1.8, 0x6a5aa8, { p: [0, 0.9, 0], seg: 7, top: 0xa89cdc });
      m.cyl(0.9, 1.3, 0.7, 0x7c6fb8, { p: [0.2, 2.1, 0.1], seg: 6, top: 0xb8acec });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
