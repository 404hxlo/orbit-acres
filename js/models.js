// Orbit Acres: every model in the world. Origin is the middle of the footprint at
// ground level. The camera looks from the +x +z side, so doors and windows sit on
// those faces. Each part says what it is made of, so metal, paint, glass, soil and
// leaves all catch the light differently.
(function (root) {
  const OA = root.OA;
  const G = OA.Gfx;
  const T = root.THREE;
  const A = G.ART;
  const PI = Math.PI, PH = PI / 2;
  const W = 0xe9e4f5, W2 = 0xc8c2e0, DK = 0x342b6c, DK2 = 0x251d50, PLAT = 0x4a3d8f;
  const STEEL = 0xa8acc4, IRON = 0x4c4c66, SEAM = 0x777392, BRASS = 0xd6a24a;
  const GOLD = 0xffcf5c, MINT = 0x6ff5c8, TEAL = 0x2fbfa8, CORAL = 0xff6f5e, CYAN = 0x66e3ff, PINK = 0xff7bd0, VIO = 0x8a6bff, LAMP = 0xffdf9e;
  const GLASS = 0x8fd0ea, BROWN = 0x7a4f34, TIMBER = 0xa8784e, SOIL = 0x33212f, SOIL2 = 0x5a3e4a;
  const LEAF = 0x46c98f, LEAF2 = 0x1f8f6c, LEAF3 = 0x2fb07c;
  const FX = [0, 0, PH]; // disc facing +x
  const FZ = [PH, 0, 0]; // disc facing +z
  const fine = () => G.Q.name !== 'low';

  G.SURF.window = { r: 0.14, m: 0.3, c: 0 };

  const M = (G.M = {});

  // ---- Shared parts ----
  const tone = (hex, k) => {
    const r = Math.min(255, ((hex >> 16) & 255) * k), g = Math.min(255, ((hex >> 8) & 255) * k), b = Math.min(255, (hex & 255) * k);
    return (r << 16) | (g << 8) | b;
  };
  const base = (m, w, d, c = PLAT) => {
    m.rbox(w, 0.16, d, 0.05, 0x5c5678, { p: [0, 0.08, 0], surf: 'rock' });
    m.rbox(w - 0.22, 0.2, d - 0.22, 0.07, c, { p: [0, 0.25, 0], top: tone(c, 1.3) });
    if (!fine()) return;
    const bx = (w - 0.22) / 2 - 0.15, bz = (d - 0.22) / 2 - 0.15;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => m.cyl(0.055, 0.065, 0.05, STEEL, { p: [a * bx, 0.37, b * bz], surf: 'metal', seg: 6 }));
    m.box(w - 0.5, 0.025, 0.03, MINT, { p: [0, 0.2, d / 2 - 0.1], glow: 0.8, surf: 'lamp' });
    m.box(0.03, 0.025, d - 0.5, MINT, { p: [w / 2 - 0.1, 0.2, 0], glow: 0.8, surf: 'lamp' });
  };
  const rivets = (m, x, z, y, r, n, size = 0.022) => {
    if (!fine()) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2;
      m.sph(size, STEEL, { p: [x + Math.cos(a) * r, y, z + Math.sin(a) * r], surf: 'metal', seg: 5 });
    }
  };
  const seam = (m, x, z, y, r) => m.tor(r, 0.014, SEAM, { p: [x, y, z], r: [PH, 0, 0], surf: 'dark', seg: 26 });
  // A round plated tank with seams, rivets and an optional painted band.
  const tank = (m, x, z, r, h, y, c, band) => {
    m.cyl(r, r + 0.02, h, c, { p: [x, y + h / 2, z], seg: 22, top: tone(c, 1.12) });
    const rows = Math.max(1, Math.round(h / 0.75));
    for (let i = 0; i <= rows; i++) {
      const yy = y + 0.05 + ((h - 0.1) * i) / rows;
      seam(m, x, z, yy, r + 0.008);
      rivets(m, x, z, yy + (i === rows ? -0.05 : 0.05), r + 0.006, Math.round(r * 15));
    }
    if (band !== undefined) m.tor(r + 0.018, 0.045, band, { p: [x, y + h * 0.56, z], r: [PH, 0, 0], seg: 26, surf: 'paint' });
  };
  // A round window: a steel frame, glass that reflects by day and glows after dark.
  const port = (m, p, r, side) => {
    const ring = side === 'x' ? [0, PH, 0] : [0, 0, 0];
    const disc = side === 'x' ? FX : FZ;
    m.tor(r, r * 0.2, STEEL, { p, r: ring, surf: 'metal', seg: 16 });
    m.cyl(r * 0.96, r * 0.96, 0.05, LAMP, { p, r: disc, night: 2.6, glow: undefined, surf: 'window', seg: 16, bevel: 0 });
    if (r > 0.25) {
      const a = side === 'x' ? [0, r * 0.62, 0] : [0, r * 0.62, 0];
      m.box(side === 'x' ? 0.03 : r * 1.8, 0.022, side === 'x' ? r * 1.8 : 0.03, IRON, { p: [p[0] + (side === 'x' ? 0.03 : 0), p[1], p[2] + (side === 'x' ? 0 : 0.03)], surf: 'dark' });
      m.box(side === 'x' ? 0.03 : 0.022, r * 1.8, side === 'x' ? 0.022 : 0.03, IRON, { p: [p[0] + (side === 'x' ? 0.03 : 0) + a[0], p[1], p[2] + (side === 'x' ? 0 : 0.03)], surf: 'dark' });
    }
  };
  const antenna = (m, x, y, z, h, c = CORAL) => {
    m.cyl(0.09, 0.12, 0.08, IRON, { p: [x, y + 0.04, z], surf: 'dark', seg: 10 });
    m.cyl(0.025, 0.05, h, STEEL, { p: [x, y + h / 2, z], seg: 8, surf: 'metal', bevel: 0 });
    m.tor(0.05, 0.012, STEEL, { p: [x, y + h * 0.5, z], r: [PH, 0, 0], surf: 'metal', seg: 10 });
    m.sph(0.075, c, { p: [x, y + h, z], glow: 1.8, seg: 8, surf: 'lamp' });
  };
  // A framed door with a light above it.
  const door = (m, p, w, h, c, side) => {
    const on = side === 'x';
    const frame = (dw, dh) => [on ? 0.12 : dw, dh, on ? dw : 0.12];
    const [fx, fy, fz] = frame(w + 0.18, h + 0.1);
    m.rbox(fx, fy, fz, 0.04, IRON, { p: [p[0], p[1] + 0.03, p[2]], surf: 'dark' });
    const [dx, dy, dz] = frame(w, h);
    const off = on ? [0.05, 0, 0] : [0, 0, 0.05];
    m.rbox(dx, dy, dz, 0.03, c, { p: [p[0] + off[0], p[1], p[2] + off[2]], top: tone(c, 1.2), surf: 'paint' });
    m.sph(0.035, STEEL, { p: [p[0] + off[0] * 2 + (on ? 0 : w * 0.34), p[1], p[2] + off[2] * 2 + (on ? w * 0.34 : 0)], surf: 'metal', seg: 8 });
    m.sph(0.05, LAMP, { p: [p[0] + off[0] * 1.6, p[1] + h / 2 + 0.14, p[2] + off[2] * 1.6], glow: 0.5, night: undefined, seg: 8, surf: 'lamp' });
  };
  const sign = (m, y, id) => {
    const [fn, a, b] = OA.ITEMS[id].art;
    m.made('paint', () => m.at([0, y, 0], 0.72, () => A[fn](m, a, b), PI / 4));
  };
  // Pipe with collars at the joints.
  const pipes = (m, pts, r, c = STEEL) => {
    m.tube(pts, r, c, { sides: 8, surf: 'metal' });
    pts.forEach((p) => m.sph(r * 1.5, c, { p, surf: 'metal', seg: 8 }));
  };
  const vent = (m, p, w, h, side) => {
    const on = side === 'x';
    m.rbox(on ? 0.08 : w, h, on ? w : 0.08, 0.02, IRON, { p, surf: 'dark' });
    const n = Math.max(3, Math.round(h / 0.08));
    for (let i = 0; i < n; i++) {
      const y = p[1] - h / 2 + ((i + 0.5) * h) / n;
      m.box(on ? 0.1 : w * 0.86, 0.022, on ? w * 0.86 : 0.1, STEEL, { p: [p[0], y, p[2]], surf: 'metal' });
    }
  };
  const crate = (m, x, y, z, s, c = TIMBER, ry = 0) => {
    m.at([x, y, z], s, () => {
      m.rbox(1, 1, 1, 0.05, c, { p: [0, 0.5, 0], surf: 'wood', top: tone(c, 1.15) });
      const e = 0.5;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => m.box(0.1, 1.02, 0.1, tone(c, 0.7), { p: [a * (e - 0.03), 0.5, b * (e - 0.03)], surf: 'wood' }));
      m.box(1.03, 0.08, 1.03, IRON, { p: [0, 0.82, 0], surf: 'dark' });
      m.box(1.03, 0.08, 1.03, IRON, { p: [0, 0.18, 0], surf: 'dark' });
    }, ry);
  };
  const barrel = (m, x, y, z, s, c) => {
    m.at([x, y, z], s, () => {
      m.lathe([[0, 0], [0.36, 0], [0.42, 0.12], [0.46, 0.5], [0.42, 0.88], [0.36, 1], [0, 1]], c, { seg: 14, surf: 'paint' });
      [0.2, 0.8].forEach((yy) => m.tor(0.43, 0.02, IRON, { p: [0, yy, 0], r: [PH, 0, 0], surf: 'dark', seg: 16 }));
    });
  };
  const lightPost = (m, x, y, z, h) => {
    m.cyl(0.03, 0.045, h, IRON, { p: [x, y + h / 2, z], surf: 'dark', seg: 6, bevel: 0 });
    m.sph(0.09, LAMP, { p: [x, y + h + 0.04, z], glow: 0.6, seg: 8, surf: 'lamp' });
  };

  // ---- Planter beds ----
  const fieldBody = (m) => {
    // Steel-edged raised bed.
    const E = 0.96, H = 0.27;
    m.use('metal');
    [[0, E, 1.92, 0.08], [0, -E, 1.92, 0.08]].forEach(([x, z, a, b]) => m.rbox(a, H, b, 0.025, 0x6d6c8a, { p: [x, H / 2, z] }));
    [[E, 0, 0.08, 1.92], [-E, 0, 0.08, 1.92]].forEach(([x, z, a, b]) => m.rbox(a, H, b, 0.025, 0x6d6c8a, { p: [x, H / 2, z] }));
    if (fine()) {
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => {
        m.rbox(0.13, H + 0.05, 0.13, 0.03, 0x8a8aa6, { p: [a * E, (H + 0.05) / 2, b * E] });
        m.sph(0.022, 0xd0d4ea, { p: [a * (E + 0.07), H - 0.04, b * (E - 0.02)], seg: 6 });
      });
      // Drip line along the back, with a status light.
      m.pipe([-0.88, 0.3, -E + 0.1], [0.88, 0.3, -E + 0.1], 0.016, 0x8fd0ea);
      for (let i = 0; i < 6; i++) m.cyl(0.018, 0.012, 0.05, STEEL, { p: [-0.75 + i * 0.3, 0.27, -E + 0.1], seg: 6 });
      m.sph(0.03, MINT, { p: [E, 0.335, E], glow: 1.8, seg: 8, surf: 'lamp' });
    }
    // Tilled soil: furrows with clods, darker in the troughs.
    const n = G.Q.pbr ? 34 : 14;
    const S = 1.84, first = m.count, soil = G.SURF.soil;
    const height = (x, z) => {
      const ridge = Math.cos((z / S) * PI * 6) * 0.5 + 0.5;
      return 0.2 + ridge * ridge * 0.07 + (OA.fbm(x * 7 + 3, z * 7 + 1, 3) - 0.5) * 0.05;
    };
    const low = new T.Color(SOIL), high = new T.Color(SOIL2);
    if (G.Q.linear) { low.convertSRGBToLinear(); high.convertSRGBToLinear(); }
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const x = (i / n - 0.5) * S, z = (j / n - 0.5) * S;
        const e = 0.02;
        const hh = height(x, z);
        const nx = height(x - e, z) - height(x + e, z), nz = height(x, z - e) - height(x, z + e);
        const l = Math.hypot(nx, 2 * e, nz);
        const t = OA.clamp((hh - 0.19) / 0.08 + (OA.hash(i, j) - 0.5) * 0.5, 0, 1);
        m.vert(x, hh, z, nx / l, (2 * e) / l, nz / l, low.r + (high.r - low.r) * t, low.g + (high.g - low.g) * t, low.b + (high.b - low.b) * t, soil);
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = first + j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
        m.idx.push(a, c, b, b, c, d);
      }
    }
    if (fine()) {
      for (let i = 0; i < 16; i++) {
        const x = (OA.hash(i, 3) - 0.5) * 1.6, z = (OA.hash(i, 8) - 0.5) * 1.6;
        m.ico(0.02 + OA.hash(i, 1) * 0.02, 0x6a4a5c, { p: [x, height(x, z) + 0.01, z], surf: 'soil', r: [i, i * 2, 0] });
      }
    }
  };
  M.field = () => G.model('field', fieldBody);

  // ---- Plant parts ----
  const Y = 0.25; // soil level
  const leaf = (m, x, y, z, yaw, pitch, len, wid, col, tip, droop = 0.4, seg = 4) => {
    const pts = [], w = [];
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, r = len * t * cp;
      pts.push([x + cy * r, y + len * t * sp - droop * len * t * t, z + sy * r]);
      w.push(wid * Math.sin(PI * Math.pow(t * 0.97 + 0.015, 0.72)) + 0.002);
    }
    m.ribbon(pts, w, col, { tip: tip === undefined ? col : tip, surf: 'leaf' });
  };
  const blade = (m, x, y, z, yaw, h, lean, wid, col, tip, up) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const pts = [], w = [];
    for (let i = 0; i <= 3; i++) {
      const t = i / 3;
      pts.push([x + cy * lean * t * t, y + h * t, z + sy * lean * t * t]);
      w.push(wid * (1 - t * t) + 0.002);
    }
    m.ribbon(pts, w, col, { tip, side: [-sy, 0, cy], surf: 'leaf', fold: 0.15, up });
  };
  const stem = (m, pts, r0, r1, col, top) => {
    const n = pts.length;
    m.tube(pts, pts.map((p, i) => r0 + (r1 - r0) * (i / (n - 1))), col, { sides: 5, top, surf: 'leaf' });
  };

  const plant = {
    wheat(m, s, x, z, k) {
      const h = [0.13, 0.3, 0.52, 0.68][s];
      const ripe = s === 3;
      const green = 0x4fd8a0, silver = s >= 2 ? 0xcfdcff : 0x8ff0c0;
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + k * 6, px = x + Math.cos(a) * 0.035, pz = z + Math.sin(a) * 0.035;
        const hh = h * (0.86 + (i % 3) * 0.1), lean = 0.05 + (i % 2) * 0.07;
        blade(m, px, Y, pz, a, hh, lean, 0.028, green, silver);
        blade(m, px, Y, pz, a + 1.7, hh * 0.55, 0.09, 0.024, green, 0x8ff0c0);
        if (s >= 2) {
          const tx = px + Math.cos(a) * lean, tz = pz + Math.sin(a) * lean, ty = Y + hh;
          const bend = ripe ? 0.05 : 0.02;
          m.tube([[tx, ty - 0.02, tz], [tx + Math.cos(a) * bend * 0.4, ty + 0.05, tz + Math.sin(a) * bend * 0.4], [tx + Math.cos(a) * bend, ty + 0.12, tz + Math.sin(a) * bend], [tx + Math.cos(a) * bend * 1.9, ty + 0.17, tz + Math.sin(a) * bend * 1.9]],
            [0.012, 0.026, 0.021, 0.003], ripe ? 0xeef2ff : 0xbfd0f0, { sides: 5, surf: 'leaf', glow: ripe ? 0.2 : 0, top: 0xffffff });
        }
      }
    },
    corn(m, s, x, z, k) {
      const h = [0.22, 0.5, 0.82, 0.98][s];
      const lean = (k - 0.5) * 0.08;
      stem(m, [[x, Y, z], [x + lean * 0.4, Y + h * 0.5, z], [x + lean, Y + h, z + lean * 0.5]], 0.03, 0.012, LEAF2, LEAF);
      const count = 2 + s * 2;
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count, a = i * 2.4 + k * 5;
        leaf(m, x + lean * t, Y + h * t * 0.86, z, a, 0.8, 0.26 + h * 0.34, 0.075, LEAF3, 0x8ff5c8, 0.8, 5);
      }
      if (s >= 2) {
        m.ribbon([[x + 0.03, Y + h * 0.5, z + 0.03], [x + 0.09, Y + h * 0.66, z + 0.09], [x + 0.11, Y + h * 0.82, z + 0.11]], [0.07, 0.09, 0.01], LEAF, { surf: 'leaf', tip: 0xc8ffd8 });
        m.sph(0.055, s === 3 ? 0x9affd8 : 0x5fcfa8, { p: [x + 0.085, Y + h * 0.68, z + 0.085], s: [1, 2.3, 1], seg: 8, surf: 'fruit', glow: s === 3 ? 1.1 : 0.1, top: 0xeafff4 });
      }
      if (s === 3) for (let i = 0; i < 4; i++) blade(m, x + lean, Y + h, z + lean * 0.5, i * 1.57, 0.14, 0.09, 0.012, 0xe8d090, 0xfff0b0);
    },
    bean(m, s, x, z, k) {
      const h = [0.12, 0.24, 0.36, 0.4][s];
      stem(m, [[x, Y, z], [x + (k - 0.5) * 0.04, Y + h, z]], 0.014, 0.006, LEAF2, LEAF);
      const count = 3 + s * 3;
      for (let i = 0; i < count; i++) {
        const t = i / count, a = i * 2.4 + k * 6;
        leaf(m, x, Y + h * (0.35 + t * 0.65), z, a, 0.55 - t * 0.2, 0.1 + s * 0.03, 0.09 + s * 0.012, LEAF3, 0x7ff0b8, 0.45, 3);
      }
      if (s >= 2) {
        for (let i = 0; i < 3; i++) {
          const a = i * 2.1 + k * 3;
          const px = x + Math.cos(a) * 0.075, pz = z + Math.sin(a) * 0.075, py = Y + h * 0.72;
          m.tube([[px, py, pz], [px + 0.01, py - 0.07, pz], [px + 0.03, py - 0.14, pz + 0.01], [px + 0.06, py - 0.19, pz + 0.02]], [0.008, 0.024, 0.02, 0.004],
            s === 3 ? 0xff8fca : 0xe0a0c8, { sides: 6, surf: 'fruit', glow: s === 3 ? 0.35 : 0, top: 0xffb8e0 });
        }
      }
    },
    cane(m, s, x, z, k) {
      const h = [0.22, 0.48, 0.76, 0.95][s];
      [[0, 0], [0.05, 0.035], [-0.04, 0.045]].forEach(([ox, oz], i) => {
        const hh = h * (1 - i * 0.14), parts = 4 + s;
        const pts = [], rad = [];
        for (let j = 0; j <= parts * 2; j++) {
          const t = j / (parts * 2);
          pts.push([x + ox + (k - 0.5) * 0.05 * t, Y + hh * t, z + oz]);
          rad.push(j % 2 ? 0.02 : 0.026);
        }
        m.tube(pts, rad, 0x5fc8ec, { sides: 6, surf: 'fruit', top: 0xd0f6ff });
        if (s >= 1) leaf(m, x + ox, Y + hh * 0.95, z + oz, i * 2.1 + k * 4, 1, 0.26, 0.034, 0x57d8b0, 0xa8f8e0, 1, 4);
        if (s >= 2) leaf(m, x + ox, Y + hh * 0.7, z + oz, i * 2.1 + 2, 0.8, 0.22, 0.03, LEAF3, 0xa8f8e0, 0.9, 4);
        if (s === 3) m.sph(0.03 + i * 0.005, 0xeaffff, { p: [x + ox, Y + hh + 0.03, z + oz], seg: 7, surf: 'crystal', glow: 0.5 });
      });
    },
    gourd(m, s, x, z, k) {
      const spread = [0.16, 0.26, 0.34, 0.36][s];
      for (let i = 0; i < 4 + s * 2; i++) {
        const a = i * 2.2 + k * 5;
        leaf(m, x, Y + 0.02, z, a, 0.5, spread, 0.2, LEAF2, LEAF, 0.6, 4);
      }
      m.tube([[x - 0.1, Y + 0.02, z], [x + 0.08, Y + 0.05, z + 0.12], [x + 0.2, Y + 0.03, z + 0.05], [x + 0.28, Y + 0.05, z - 0.07]], 0.008, LEAF2, { sides: 4, surf: 'leaf' });
      const r = [0, 0.09, 0.18, 0.25][s];
      if (r) {
        m.blob(r, s === 3 ? 0xf78a2c : 0xe7a050, {
          p: [x, Y + r * 0.76, z], detail: G.Q.pbr ? 3 : 2, s: [1, 0.84, 1], surf: 'fruit', top: 0xffb864, glow: s === 3 ? 0.08 : 0,
          bump: (px, py, pz) => (Math.abs(Math.cos(Math.atan2(pz, px) * 4)) - 0.6) * 0.14 * (1 - py * py) - py * py * 0.1,
        });
        if (s >= 2) {
          m.cyl(0.02, 0.035, 0.09, LEAF2, { p: [x, Y + r * 1.5, z], seg: 6, r: [0.1, 0, 0.15], surf: 'leaf' });
          for (let i = 0; i < 5; i++) { const a = i * 1.257; leaf(m, x, Y + r * 1.45, z, a, 0.2, 0.09, 0.05, LEAF, 0xa8f0c0, 0.5, 2); }
        }
      }
    },
    berry(m, s, x, z, k) {
      const r = [0.1, 0.2, 0.3, 0.32][s];
      const count = 6 + s * 7;
      stem(m, [[x, Y, z], [x, Y + r, z]], 0.018, 0.008, 0x5c4a6a);
      for (let i = 0; i < count; i++) {
        const t = i / count, a = i * 2.4 + k * 6, h = Y + 0.03 + r * 1.2 * Math.sqrt(t), rr = r * 0.34 * (1 - t * 0.5);
        leaf(m, x + Math.cos(a) * rr, h, z + Math.sin(a) * rr, a, 0.45 + t * 0.5, r * 0.75, 0.08, 0x4a3fa8, 0x8f7fe0, 0.4, 3);
      }
      if (s >= 2) {
        for (let i = 0; i < 12; i++) {
          const a = i * 2.4 + k, h = Y + r * (0.35 + ((i % 4) / 4) * 0.8), rr = r * 0.7 * (1 - (i % 4) * 0.13);
          m.sph(0.036, s === 3 ? 0xb49bff : 0x7f6fd6, { p: [x + Math.cos(a) * rr, h, z + Math.sin(a) * rr], seg: 6, surf: 'fruit', glow: s === 3 ? 1.1 : 0.1, top: 0xe6dcff });
        }
      }
    },
    cotton(m, s, x, z, k) {
      const h = [0.16, 0.34, 0.5, 0.56][s];
      stem(m, [[x, Y, z], [x + 0.02, Y + h * 0.5, z], [x, Y + h, z + 0.02]], 0.016, 0.006, BROWN, 0x9a7050);
      for (let i = 0; i < 3 + s * 2; i++) {
        const a = i * 2.4 + k * 5, t = (i + 1) / (4 + s * 2);
        leaf(m, x, Y + h * t, z, a, 0.5, 0.12 + s * 0.02, 0.1, LEAF2, LEAF, 0.45, 3);
      }
      if (s >= 2) {
        for (let i = 0; i < 3; i++) {
          const a = i * 2.1 + k * 4, px = x + Math.cos(a) * 0.08, pz = z + Math.sin(a) * 0.08, py = Y + h - i * 0.07;
          const r = s === 3 ? 0.075 : 0.042;
          m.blob(r, 0xfff6fb, { p: [px, py, pz], detail: 1, lump: 0.3, freq: 3.5, seed: i, surf: 'fur', top: 0xffffff });
          m.cone(0.04, 0.05, BROWN, { p: [px, py - r * 0.9, pz], r: [PI, 0, 0], seg: 5, surf: 'wood' });
        }
      }
    },
    root(m, s, x, z, k) {
      const h = [0.1, 0.2, 0.3, 0.36][s];
      for (let i = 0; i < 3 + s; i++) {
        const a = i * 2.3 + k * 6;
        const tipx = Math.cos(a) * h * 0.4, tipz = Math.sin(a) * h * 0.4;
        m.tube([[x, Y + 0.01, z], [x + tipx * 0.3, Y + h * 0.6, z + tipz * 0.3], [x + tipx, Y + h, z + tipz]], [0.008, 0.005, 0.002], LEAF2, { sides: 3, surf: 'leaf' });
        for (let j = 1; j <= 3; j++) {
          const t = j / 4;
          leaf(m, x + tipx * t * 0.8, Y + h * (0.45 + t * 0.5), z + tipz * t * 0.8, a + 1.2, 0.3, 0.07, 0.04, LEAF3, 0x9ff5c8, 0.3, 2);
          leaf(m, x + tipx * t * 0.8, Y + h * (0.45 + t * 0.5), z + tipz * t * 0.8, a - 1.2, 0.3, 0.07, 0.04, LEAF3, 0x9ff5c8, 0.3, 2);
        }
      }
      if (s >= 2) m.lathe([[0, -0.03], [0.05, -0.02], [0.062, 0.03], [0.04, 0.07], [0, 0.085]], 0xff6a3d, { p: [x, Y, z], seg: 8, surf: 'fruit', glow: s === 3 ? 0.55 : 0.1, top: 0xffb060 });
    },
    chili(m, s, x, z, k) {
      const h = [0.14, 0.28, 0.44, 0.48][s];
      stem(m, [[x, Y, z], [x + 0.01, Y + h * 0.6, z], [x, Y + h, z + 0.01]], 0.018, 0.007, LEAF2, LEAF);
      for (let i = 0; i < 5 + s * 4; i++) {
        const a = i * 2.4 + k * 6, t = (i + 1) / (6 + s * 4);
        leaf(m, x, Y + h * (0.3 + t * 0.7), z, a, 0.5 - t * 0.3, 0.12 + s * 0.02, 0.07, LEAF3, 0x8ff0c0, 0.35, 3);
      }
      if (s >= 2) {
        for (let i = 0; i < 6; i++) {
          const a = i * 1.05 + k * 3, rr = 0.09 + (i % 2) * 0.05;
          const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr, py = Y + h * (0.5 + (i % 3) * 0.2);
          m.tube([[px, py, pz], [px + 0.008, py - 0.05, pz], [px + 0.022, py - 0.1, pz + 0.008], [px + 0.045, py - 0.15, pz + 0.018]], [0.008, 0.024, 0.016, 0.002],
            s === 3 ? 0x7ae4ff : 0xa8d8e8, { sides: 5, surf: 'fruit', glow: s === 3 ? 0.5 : 0, top: 0xc0f4ff });
        }
      }
    },
    melon(m, s, x, z, k) {
      for (let i = 0; i < 4 + s * 2; i++) leaf(m, x, Y + 0.02, z, i * 2.2 + k * 5, 0.45, 0.2 + s * 0.05, 0.2, LEAF2, LEAF, 0.55, 3);
      m.tube([[x - 0.06, Y + 0.02, z - 0.06], [x + 0.14, Y + 0.05, z - 0.14], [x + 0.26, Y + 0.03, z + 0.02]], 0.008, LEAF2, { sides: 4, surf: 'leaf' });
      const r = [0, 0.1, 0.19, 0.27][s];
      if (r) {
        const c1 = s === 3 ? 0xff4d9e : 0xe58fbf, c2 = s === 3 ? 0xffd0e6 : 0xf0c8dc;
        m.sph(r, c1, {
          p: [x, Y + r * 0.84, z], seg: 18, s: [1, 0.92, 1], surf: 'fruit', glow: s === 3 ? 0.22 : 0,
          paint: (px, py, pz) => (Math.abs(Math.sin(Math.atan2(pz, px) * 5 + Math.sin(py * 3) * 0.25)) < 0.34 ? c2 : c1),
        });
      }
    },
    shroom(m, s, x, z, k) {
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1 + k * 3, ox = Math.cos(a) * 0.075, oz = Math.sin(a) * 0.075;
        const h = [0.08, 0.16, 0.26, 0.34][s] * (1 - i * 0.18), r = [0.04, 0.08, 0.125, 0.16][s] * (1 - i * 0.12);
        m.lathe([[r * 0.22, 0], [r * 0.2, h * 0.5], [r * 0.16, h]], 0xfff0e6, { p: [x + ox, Y, z + oz], seg: 8, surf: 'skin' });
        m.lathe([[r * 0.18, h * 0.92], [r * 0.8, h * 0.84], [r, h * 0.92], [r * 0.82, h * 1.2], [r * 0.34, h * 1.42], [0, h * 1.46]], s === 3 ? 0xb75cf0 : 0xa08bc8,
          { p: [x + ox, Y, z + oz], seg: 12, surf: 'skin', glow: s === 3 ? 0.3 : 0, top: s === 3 ? 0xe2b0ff : 0xc4b4e0 });
        if (s >= 2) for (let j = 0; j < 4; j++) { const q = j * 1.57 + k; m.sph(r * 0.11, 0xfff0a8, { p: [x + ox + Math.cos(q) * r * 0.55, Y + h * 1.26, z + oz + Math.sin(q) * r * 0.55], seg: 5, surf: 'lamp', glow: s === 3 ? 1.5 : 0.2 }); }
      }
    },
    bloom(m, s, x, z, k) {
      const h = [0.26, 0.56, 0.9, 1.1][s];
      stem(m, [[x, Y, z], [x + 0.01, Y + h * 0.55, z], [x + 0.04, Y + h, z + 0.04]], 0.028, 0.014, LEAF2, LEAF);
      for (let i = 0; i < 2 + s; i++) {
        const a = i * 2.4 + k * 5;
        leaf(m, x, Y + h * (0.2 + i * 0.17), z, a, 0.5, 0.24, 0.17, LEAF3, 0x9ff0b8, 0.6, 4);
      }
      if (s >= 2) {
        const r = s === 3 ? 0.13 : 0.08, len = s === 3 ? 0.17 : 0.09;
        m.at([x + 0.05, Y + h + 0.02, z + 0.05], 1, () => {
          for (let ring = 0; ring < 2; ring++) {
            const n = 13;
            for (let i = 0; i < n; i++) {
              const a = ((i + ring * 0.5) / n) * PI * 2, c = Math.cos(a), q = Math.sin(a);
              const l = len * (ring ? 0.8 : 1);
              m.ribbon([[c * r * 0.9, q * r * 0.9, 0.012 * ring], [c * (r + l * 0.45), q * (r + l * 0.45), 0.03 - ring * 0.02], [c * (r + l), q * (r + l), 0.005]], [0.055, 0.075, 0.006], s === 3 ? 0xffc92e : 0xe0c060,
                { tip: s === 3 ? 0xffe98a : 0xeed890, side: [-q, c, 0], surf: 'leaf', glow: s === 3 ? 0.3 : 0 });
            }
          }
          m.cyl(r, r, 0.04, 0x6a3f24, { r: FZ, seg: 16, surf: 'soil', paint: (px, py, pz) => (Math.hypot(px, pz) / r > 0.55 ? 0xff9a3d : 0x6a3f24), glow: 0, bevel: 0 });
        }, PI / 4);
      }
    },
  };
  const DENSITY = { wheat: 6, corn: 3, bean: 4, cane: 4, gourd: 2, berry: 3, cotton: 4, root: 5, chili: 3, melon: 2, shroom: 4, bloom: 3 };

  const cropBody = (m, crop, stage) => {
    const fn = plant[crop];
    const dense = DENSITY[crop];
    const n = Math.max(2, G.Q.plant >= 1 ? dense : Math.round(dense * (0.45 + G.Q.plant * 0.45)));
    const step = 1.54 / n, start = -0.77 + step / 2;
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        const k = OA.hash(a * 3.1 + 2, b * 1.7 + 5);
        fn(m, stage, start + a * step + (k - 0.5) * step * 0.3, start + b * step + (OA.hash(b + 9, a) - 0.5) * step * 0.3, k);
      }
    }
  };
  M.crop = (crop, stage) => G.model('crop-' + crop + stage, (m) => cropBody(m, crop, stage), { noAO: true, sway: true, ground: false, surf: 'leaf' });
  // A planted bed for the Build window: the crop alone reads as a pale blob on a sticker.
  M.plotSticker = () => G.model('plot-sticker', (m) => {
    fieldBody(m);
    m.made('leaf', () => cropBody(m, 'wheat', 3));
  });

  // ---- Ground cover ----
  M.tuft = () => G.model('tuft', (m) => {
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4, r = 0.05 + (i % 3) * 0.05;
      blade(m, Math.cos(a) * r, 0, Math.sin(a) * r, a, 0.11 + (i % 3) * 0.06, 0.05 + (i % 2) * 0.05, 0.036, 0x2f9c84, 0x9ff5cc, true);
    }
  }, { noAO: true, sway: true, surf: 'leaf' });
  M.tuft2 = () => G.model('tuft2', (m) => {
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4, r = 0.04 + (i % 3) * 0.06;
      blade(m, Math.cos(a) * r, 0, Math.sin(a) * r, a, 0.2 + (i % 3) * 0.1, 0.1 + (i % 2) * 0.08, 0.04, 0x2a9484, 0xb4f8d0, true);
    }
  }, { noAO: true, sway: true, surf: 'leaf' });
  M.flowers = () => G.model('flowers', (m) => {
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1, r = 0.07, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.13 + i * 0.05;
      const col = [0xff8fd0, 0xffe07a, 0xc9b0ff][i];
      m.tube([[x, 0, z], [x, h, z]], 0.006, 0x2a9a80, { sides: 3, surf: 'leaf' });
      for (let p = 0; p < 5; p++) { const q = p * 1.257; leaf(m, x, h, z, q, 0.3, 0.05, 0.04, col, 0xffffff, 0.2, 2); }
      m.sph(0.012, 0xfff0a8, { p: [x, h + 0.008, z], seg: 5, surf: 'lamp' });
    }
  }, { noAO: true, sway: true, surf: 'leaf' });
  M.scrub = () => G.model('scrub', (m) => {
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, r = 0.03 + (i % 3) * 0.04;
      blade(m, Math.cos(a) * r, 0, Math.sin(a) * r, a, 0.1 + (i % 3) * 0.05, 0.08, 0.03, 0x7a6ab8, 0xd0c4f4, true);
    }
  }, { noAO: true, sway: true, surf: 'leaf' });
  M.pebble = (kind) => G.model('pebble' + kind, (m) => {
    const c = kind ? 0x8a7cc0 : 0x7fa8a0;
    m.blob(0.07, c, { p: [0, 0.03, 0], detail: 1, lump: 0.35, facets: true, s: [1.3, 0.7, 1], surf: 'rock', top: tone(c, 1.3), seed: 2 });
    m.blob(0.045, c, { p: [0.1, 0.02, 0.05], detail: 1, lump: 0.35, facets: true, s: [1, 0.7, 1.2], surf: 'rock', seed: 5 });
  }, { noAO: true });

  // ---- Orchard ----
  M.tree = (kind, state) => G.model('tree-' + kind + state, (m) => {
    const def = OA.TREES.find((t) => t.id === kind);
    m.cyl(0.7, 0.82, 0.1, 0x3a2a4a, { p: [0, 0.05, 0], seg: 14, surf: 'soil' });
    m.tor(0.74, 0.05, IRON, { p: [0, 0.1, 0], r: [PH, 0, 0], surf: 'dark', seg: 20 });
    m.use('wood');
    m.tube([[0, 0, 0], [0.04, 0.5, 0.02], [0.14, 1.1, 0.05], [0.1, 1.5, 0.05]], [0.2, 0.14, 0.11, 0.08], 0x6e4a78, { sides: 8, top: 0x9a70a0, surf: 'wood' });
    m.tube([[0.12, 1.05, 0.05], [-0.1, 1.4, 0.1], [-0.42, 1.85, 0.12]], [0.09, 0.07, 0.04], 0x6e4a78, { sides: 6, top: 0x9a70a0, surf: 'wood' });
    m.tube([[0.13, 1.1, 0.05], [0.34, 1.45, -0.02], [0.56, 1.8, -0.12]], [0.09, 0.07, 0.04], 0x6e4a78, { sides: 6, top: 0x9a70a0, surf: 'wood' });
    if (state === 'spent') {
      m.tube([[0.1, 1.45, 0.05], [0.05, 1.9, 0.1], [0.2, 2.2, 0.05]], [0.06, 0.04, 0.012], 0x6e5a7a, { sides: 5, surf: 'wood' });
      return;
    }
    const c = def.canopy;
    m.use('leaf');
    const pts = [[0.05, 2.5, 0, 0.98], [-0.66, 2.08, 0.18, 0.7], [0.72, 2.1, -0.12, 0.72], [0.12, 1.98, 0.64, 0.68], [-0.05, 2.02, -0.62, 0.64], [0.4, 2.75, 0.3, 0.5]];
    pts.forEach(([x, y, z, r], i) => m.blob(r, tone(c, 0.72), { p: [x, y, z], detail: G.Q.pbr ? 3 : 2, lump: 0.22, freq: 3, seed: i * 2 + 1, top: tone(c, 1.25), surf: 'leaf' }));
    if (state === 'fruit') {
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4, y = 1.7 + (i % 5) * 0.34;
        const r = 1.1 - Math.abs(y - 2.3) * 0.42;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        m.tube([[x, y + 0.14, z], [x, y + 0.05, z]], 0.008, BROWN, { sides: 3, surf: 'wood' });
        m.sph(0.13, def.fruitColor, { p: [x, y, z], seg: 8, glow: 0.45, top: 0xffffff, surf: 'fruit' });
      }
    }
  });

  // ---- Pens and critters ----
  M.pen = (kind) => G.model('pen-' + kind, (m) => {
    const WW = OA.BUILD.pen.w - 0.4, DD = OA.BUILD.pen.d - 0.4;
    const floors = { puffling: 0x6fbf8f, moonmoo: 0x7fcfa4, snuffle: 0x9a7a60, nimbaa: 0x98b8ee, lumibee: 0xe8c898, drift: 0x6fa8d8 };
    const c = floors[kind];
    m.rbox(WW, 0.07, DD, 0.03, c, { p: [0, 0.04, 0], surf: 'soil', top: tone(c, 1.15), noBake: true });
    const hw = WW / 2, hd = DD / 2;
    const rail = (a, b) => {
      m.pipe([a[0], 0.66, a[1]], [b[0], 0.66, b[1]], 0.038, MINT, { glow: 0.9, surf: 'lamp' });
      m.pipe([a[0], 0.38, a[1]], [b[0], 0.38, b[1]], 0.026, MINT, { glow: 0.7, surf: 'lamp' });
    };
    const k = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
    rail(k[0], k[1]); rail(k[1], k[2]); rail(k[3], k[0]);
    rail([-hw, hd], [-0.9, hd]); rail([0.9, hd], [hw, hd]);
    const post = (x, z) => {
      m.cyl(0.11, 0.14, 0.1, IRON, { p: [x, 0.08, z], surf: 'dark', seg: 10 });
      m.cyl(0.065, 0.085, 0.72, W, { p: [x, 0.47, z], seg: 10 });
      m.tor(0.08, 0.018, STEEL, { p: [x, 0.66, z], r: [PH, 0, 0], surf: 'metal', seg: 10 });
      m.tor(0.08, 0.018, STEEL, { p: [x, 0.38, z], r: [PH, 0, 0], surf: 'metal', seg: 10 });
      m.sph(0.09, GOLD, { p: [x, 0.88, z], seg: 8, glow: 0.9, surf: 'lamp' });
    };
    k.forEach(([x, z]) => post(x, z));
    post(-0.9, hd); post(0.9, hd); post(0, -hd); post(-hw, 0); post(hw, 0);
    // Gate arch.
    m.tor(0.9, 0.04, W, { p: [0, 0.8, hd], arc: PI, seg: 20 });
    m.sph(0.07, MINT, { p: [0, 1.7, hd], seg: 8, glow: 1.5, surf: 'lamp' });
    // Feed trough on the right.
    m.at([hw - 0.65, 0, 0.3], 1, () => {
      m.rbox(0.72, 0.3, 1.9, 0.08, TIMBER, { p: [0, 0.26, 0], surf: 'wood', top: tone(TIMBER, 1.2) });
      m.rbox(0.52, 0.05, 1.7, 0.02, 0xe8b070, { p: [0, 0.41, 0], surf: 'fabric' });
      [-0.8, 0.8].forEach((z) => m.box(0.8, 0.34, 0.08, IRON, { p: [0, 0.25, z], surf: 'dark' }));
    });
    // Each critter gets a home in the back corner.
    if (kind === 'puffling') {
      m.at([-hw + 1.25, 0, -hd + 1.15], 1, () => {
        m.lathe([[1.02, 0.08], [0.98, 0.45], [0.86, 0.8], [0.6, 1.05], [0.3, 1.2], [0, 1.25]], 0xefc08a, { seg: 20, surf: 'wood', top: 0xffe0b0 });
        for (let i = 0; i < 4; i++) m.tor(0.96 - i * 0.2, 0.03, 0xd09a60, { p: [0, 0.34 + i * 0.26, 0], r: [PH, 0, 0], surf: 'wood', seg: 24 });
        m.cone(0.26, 0.26, CORAL, { p: [0, 1.32, 0], surf: 'paint' });
        m.sph(0.07, GOLD, { p: [0, 1.5, 0], seg: 8, glow: 1 , surf: 'lamp' });
        m.sph(0.36, 0x1c1236, { p: [0.62, 0.44, 0.62], s: [1, 1.2, 0.3], r: [0, PI / 4, 0], surf: 'rubber' });
        m.tor(0.38, 0.05, 0xa8784e, { p: [0.65, 0.44, 0.65], r: [0, PI / 4, 0], s: [0.38, 0.45, 0.38], surf: 'wood', seg: 16 });
        m.rbox(0.6, 0.04, 0.3, 0.01, TIMBER, { p: [0.84, 0.1, 0.84], r: [0, PI / 4, 0], surf: 'wood' });
      });
    } else if (kind === 'moonmoo') {
      m.at([-hw + 1.3, 0, -hd + 1.15], 1, () => {
        m.cyl(0.7, 0.7, 0.9, 0xc9a86a, { p: [0, 0.8, 0], r: [0, 0, PH], seg: 14, surf: 'fabric', top: 0xe8d090 });
        m.cyl(0.7, 0.7, 0.9, 0xbfa060, { p: [0.3, 0.8, 1.15], r: [PH, 0, 0], seg: 14, surf: 'fabric', top: 0xe8d090 });
        [-0.25, 0.25].forEach((x) => m.tor(0.71, 0.02, 0x8a6a3a, { p: [x, 0.8, 0], r: [0, PH, 0], surf: 'fabric', seg: 18 }));
      });
    } else if (kind === 'snuffle') {
      m.cyl(1.4, 1.5, 0.05, 0x4a3448, { p: [-0.9, 0.1, -0.4], seg: 18, surf: 'soil' });
      m.blob(0.3, 0x8d5fc9, { p: [-1.4, 0.2, -0.9], detail: 2, s: [1, 0.6, 1], glow: 0.3, surf: 'rock' });
      m.blob(0.2, 0x7cf7c0, { p: [-0.6, 0.16, -0.1], detail: 2, s: [1, 0.6, 1], glow: 0.5, surf: 'rock' });
    } else if (kind === 'nimbaa') {
      m.at([-1.2, 0, -1], 1, () => {
        m.cyl(0.05, 0.08, 1.3, STEEL, { p: [0, 0.65, 0], surf: 'metal', bevel: 0 });
        m.tor(0.6, 0.05, CYAN, { p: [0, 1.3, 0], r: [PH, 0, 0], seg: 22, glow: 1.2, surf: 'lamp' });
      });
    } else if (kind === 'lumibee') {
      m.at([-hw + 1.4, 0, -hd + 1.3], 1, () => {
        for (let i = 0; i < 4; i++) m.lathe([[0.84 - i * 0.14, 0], [0.9 - i * 0.14, 0.2], [0.82 - i * 0.14, 0.4]], i % 2 ? 0xe89d32 : 0xffc94d, { p: [0, 0.1 + i * 0.4, 0], seg: 16, surf: 'wood' });
        m.sph(0.16, 0x1c1236, { p: [0.5, 0.42, 0.5], seg: 8, surf: 'rubber' });
      });
      for (let i = 0; i < 7; i++) {
        const x = -0.6 + (i % 4) * 0.9, z = 0.1 + (i % 3) * 0.7;
        m.cyl(0.02, 0.03, 0.42, LEAF2, { p: [x, 0.25, z], seg: 6, surf: 'leaf', bevel: 0 });
        m.blob(0.14, i % 2 ? PINK : GOLD, { p: [x, 0.5, z], detail: 2, s: [1, 0.5, 1], glow: 0.5, surf: 'leaf' });
      }
    } else if (kind === 'drift') {
      for (let i = 0; i < 3; i++) m.tor(0.66 - i * 0.1, 0.05, CYAN, { p: [-1 + i * 1.1, 1.5 - i * 0.2, -0.8 + i * 0.5], r: [PH, 0, 0], seg: 22, glow: 1.2, surf: 'lamp' });
      m.cyl(1.7, 1.8, 0.05, 0x2f6fc8, { p: [-0.4, 0.1, -0.2], seg: 22, glow: 0.2, surf: 'glass' });
    }
  });

  const eyes = (m, x, y, z, gap, r, side = 'x') => {
    // Big glossy cartoon eyes looking toward +x/+z.
    const a = side === 'x' ? [x, y, z - gap] : [x - gap, y, z];
    const b = side === 'x' ? [x, y, z + gap] : [x + gap, y, z];
    [a, b].forEach((p) => {
      m.sph(r, 0xffffff, { p, seg: 10, surf: 'eye' });
      m.sph(r * 0.62, 0x160d30, { p: side === 'x' ? [p[0] + r * 0.55, p[1], p[2]] : [p[0], p[1], p[2] + r * 0.55], seg: 8, surf: 'eye' });
      m.sph(r * 0.22, 0xffffff, { p: side === 'x' ? [p[0] + r * 0.95, p[1] + r * 0.32, p[2] + r * 0.2] : [p[0] + r * 0.2, p[1] + r * 0.32, p[2] + r * 0.95], seg: 6, glow: 1.4, surf: 'eye' });
    });
  };

  // Critters face +x; the world turns them as they walk.
  M.critter = (kind) => G.model('critter-' + kind, (m) => {
    if (kind === 'puffling') {
      m.blob(0.42, 0xfff0c9, { p: [0, 0.46, 0], detail: 3, lump: 0.1, freq: 6, top: 0xffffff, surf: 'fur' });
      for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2; m.blob(0.14, 0xfff4dc, { p: [Math.cos(a) * 0.4, 0.3 + (i % 2) * 0.1, Math.sin(a) * 0.4], detail: 1, lump: 0.2, seed: i, surf: 'fur' }); }
      for (let i = -1; i <= 1; i++) m.cone(0.09, 0.32, CORAL, { p: [i * 0.13 - 0.04, 0.94, 0], r: [0, 0, -i * 0.42], seg: 8, glow: 0.15, surf: 'skin' });
      m.cone(0.09, 0.2, 0xffa82e, { p: [0.42, 0.42, 0], r: [0, 0, -PH], seg: 8, surf: 'skin' });
      eyes(m, 0.28, 0.58, 0, 0.17, 0.12);
      m.blob(0.17, 0xffd9a8, { p: [-0.04, 0.42, 0.42], detail: 1, s: [1, 0.55, 0.3], lump: 0.12, surf: 'fur' });
      m.blob(0.17, 0xffd9a8, { p: [-0.04, 0.42, -0.42], detail: 1, s: [1, 0.55, 0.3], lump: 0.12, surf: 'fur' });
      m.cyl(0.04, 0.05, 0.14, 0xffa82e, { p: [0.05, 0.08, 0.16], seg: 6, surf: 'skin' });
      m.cyl(0.04, 0.05, 0.14, 0xffa82e, { p: [0.05, 0.08, -0.16], seg: 6, surf: 'skin' });
    } else if (kind === 'moonmoo') {
      m.rbox(1.34, 0.86, 0.9, 0.4, 0xd9c8ff, { p: [-0.1, 0.78, 0], top: 0xf1e8ff, surf: 'fur' });
      [[-0.32, 1.1, 0.26, 0.3], [0.2, 0.9, 0.43, 0.26], [-0.5, 0.72, -0.4, 0.28], [0.12, 1.14, -0.22, 0.24]].forEach(([x, y, z, r]) => m.sph(r, 0x8a6bff, { p: [x, y, z], s: [1, 0.72, 1], seg: 9, glow: 0.15, surf: 'fur' }));
      m.sph(0.42, 0xe6dbff, { p: [0.66, 0.92, 0], s: [1, 0.95, 1], top: 0xffffff, surf: 'fur' });
      m.sph(0.25, 0xffc8e4, { p: [0.96, 0.82, 0], s: [0.9, 0.7, 1.1], seg: 10, surf: 'skin' });
      m.sph(0.04, 0x8a3f7a, { p: [1.17, 0.86, 0.1], seg: 5, surf: 'skin' }); m.sph(0.04, 0x8a3f7a, { p: [1.17, 0.86, -0.1], seg: 5, surf: 'skin' });
      eyes(m, 0.93, 1.08, 0, 0.2, 0.1);
      m.tor(0.17, 0.05, GOLD, { p: [0.6, 1.36, 0.25], r: [0, 0.5, -0.6], arc: PI * 1.25, seg: 10, glow: 0.8, surf: 'paint' });
      m.tor(0.17, 0.05, GOLD, { p: [0.6, 1.36, -0.25], r: [0, -0.5, -0.6], arc: PI * 1.25, seg: 10, glow: 0.8, surf: 'paint' });
      m.sph(0.19, 0xc9b0ff, { p: [0.42, 1.06, 0.46], s: [1, 0.4, 0.5], seg: 7, surf: 'fur' });
      m.sph(0.19, 0xc9b0ff, { p: [0.42, 1.06, -0.46], s: [1, 0.4, 0.5], seg: 7, surf: 'fur' });
      [[0.34, 0.3], [0.34, -0.3], [-0.5, 0.3], [-0.5, -0.3]].forEach(([x, z]) => {
        m.cyl(0.14, 0.17, 0.4, 0x8a6bff, { p: [x, 0.24, z], seg: 8, surf: 'fur' });
        m.cyl(0.17, 0.18, 0.08, 0x3a2e6a, { p: [x, 0.04, z], seg: 8, surf: 'rubber' });
      });
      m.pipe([-0.74, 0.92, 0], [-0.96, 0.62, 0], 0.03, 0xc9b0ff, { surf: 'fur' }); m.sph(0.1, 0x8a6bff, { p: [-0.98, 0.56, 0], seg: 7, glow: 0.2, surf: 'fur' });
    } else if (kind === 'snuffle') {
      m.sph(0.58, 0xffa8c8, { p: [-0.05, 0.56, 0], s: [1.15, 0.92, 0.92], top: 0xffd0e0, surf: 'skin' });
      m.sph(0.32, 0xff8fb8, { p: [0.54, 0.52, 0], s: [0.65, 0.85, 0.95], top: 0xffc0d4, surf: 'skin' });
      m.sph(0.05, 0xb83f7a, { p: [0.75, 0.56, 0.1], seg: 6, surf: 'skin' }); m.sph(0.05, 0xb83f7a, { p: [0.75, 0.56, -0.1], seg: 6, surf: 'skin' });
      eyes(m, 0.42, 0.82, 0, 0.21, 0.11);
      m.sph(0.2, 0xff8fb8, { p: [0.2, 1.02, 0.3], s: [0.8, 0.3, 1.2], r: [0.5, 0, 0], seg: 8, surf: 'skin' });
      m.sph(0.2, 0xff8fb8, { p: [0.2, 1.02, -0.3], s: [0.8, 0.3, 1.2], r: [-0.5, 0, 0], seg: 8, surf: 'skin' });
      m.tor(0.11, 0.035, 0xff8fb8, { p: [-0.7, 0.68, 0], seg: 10, surf: 'skin' });
      [[0.26, 0.3], [0.26, -0.3], [-0.34, 0.3], [-0.34, -0.3]].forEach(([x, z]) => m.cyl(0.1, 0.13, 0.22, 0xe87fa8, { p: [x, 0.11, z], seg: 8, surf: 'skin' }));
      m.sph(0.14, 0x7cf7c0, { p: [-0.2, 1.0, 0.12], seg: 7, glow: 0.8, surf: 'fruit' });
    } else if (kind === 'nimbaa') {
      [[0, 0.95, 0, 0.5], [-0.42, 0.88, 0.1, 0.38], [0.38, 0.86, -0.08, 0.36], [0, 0.8, 0.4, 0.34], [0, 0.82, -0.4, 0.36], [-0.2, 1.18, 0, 0.32], [0.2, 1.16, 0.05, 0.28]].forEach(([x, y, z, r], i) => m.blob(r, 0xf0f4ff, { p: [x, y, z], detail: 2, lump: 0.14, freq: 5, seed: i, top: 0xffffff, surf: 'fur' }));
      m.sph(0.26, 0x8fa4e8, { p: [0.56, 0.86, 0], s: [0.8, 1, 1], top: 0xb5c8ff, surf: 'skin' });
      eyes(m, 0.72, 0.92, 0, 0.13, 0.09);
      [[0.2, 0.2], [0.2, -0.2], [-0.25, 0.2], [-0.25, -0.2]].forEach(([x, z]) => m.cyl(0.05, 0.07, 0.34, 0x8fa4e8, { p: [x, 0.42, z], seg: 6, surf: 'skin' }));
    } else if (kind === 'lumibee') {
      m.sph(0.34, 0xffd24d, { p: [0, 1.2, 0], s: [1.25, 1, 1], glow: 0.7, surf: 'fur' });
      for (let i = -1; i <= 1; i++) m.tor(0.3 - Math.abs(i) * 0.06, 0.07, 0x3a2358, { p: [i * 0.2 - 0.06, 1.2, 0], r: [0, PH, 0], seg: 14, surf: 'fur' });
      eyes(m, 0.32, 1.28, 0, 0.13, 0.09);
      m.sph(0.3, 0xe8fbff, { p: [-0.05, 1.48, 0.3], s: [0.6, 0.12, 1], r: [0.5, 0, 0], seg: 8, glow: 0.4, surf: 'crystal' });
      m.sph(0.3, 0xe8fbff, { p: [-0.05, 1.48, -0.3], s: [0.6, 0.12, 1], r: [-0.5, 0, 0], seg: 8, glow: 0.4, surf: 'crystal' });
    } else if (kind === 'drift') {
      m.dome(0.72, 0x8fe8ff, { p: [0, 1.85, 0], s: [1, 0.85, 1], top: 0xe8fbff, glow: 0.5, seg: 18, surf: 'crystal' });
      m.tor(0.72, 0.07, 0xff9be8, { p: [0, 1.85, 0], r: [PH, 0, 0], seg: 20, glow: 1, surf: 'lamp' });
      eyes(m, 0.6, 2.05, 0, 0.17, 0.09);
      for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2; m.pipe([Math.cos(a) * 0.5, 1.85, Math.sin(a) * 0.5], [Math.cos(a) * 0.3, 0.75 + (i % 3) * 0.15, Math.sin(a) * 0.3], 0.03, 0xc9f6ff, { glow: 0.8, surf: 'lamp' }); }
    }
  }, { surf: 'fur' });

  // ---- People ----
  M.folk = (id) => G.model('folk-' + id, (m) => {
    const f = OA.FOLK.find((k) => k.id === id);
    if (f.body === 'human') {
      m.cyl(0.08, 0.1, 0.34, DK, { p: [0, 0.17, 0.13], seg: 7, surf: 'fabric' }); m.cyl(0.08, 0.1, 0.34, DK, { p: [0, 0.17, -0.13], seg: 7, surf: 'fabric' });
      m.rbox(0.42, 0.58, 0.54, 0.16, f.top, { p: [0, 0.62, 0], top: tone(f.top, 1.3), surf: 'fabric' });
      m.rbox(0.44, 0.08, 0.56, 0.03, IRON, { p: [0, 0.42, 0], surf: 'dark' });
      m.sph(0.33, f.skin, { p: [0, 1.15, 0], seg: 12, surf: 'skin' });
      m.dome(0.35, f.hair, { p: [-0.03, 1.2, 0], r: [0, 0, 0.35], seg: 12, surf: 'fabric' });
      eyes(m, 0.27, 1.16, 0, 0.13, 0.07);
      m.sph(0.08, f.top, { p: [0, 0.68, 0.33], s: [1, 2.2, 1], seg: 7, surf: 'fabric' }); m.sph(0.08, f.top, { p: [0, 0.68, -0.33], s: [1, 2.2, 1], seg: 7, surf: 'fabric' });
    } else if (f.body === 'blob') {
      m.sph(0.56, f.skin, { p: [0, 0.54, 0], s: [1, 0.96, 1], top: tone(f.skin, 1.3), glow: 0.08, surf: 'skin' });
      eyes(m, 0.44, 0.74, 0, 0.2, 0.13);
      m.pipe([-0.1, 1.02, 0.14], [-0.2, 1.36, 0.28], 0.025, f.top, { surf: 'skin' }); m.sph(0.08, f.hair, { p: [-0.2, 1.38, 0.28], seg: 7, glow: 1, surf: 'lamp' });
      m.pipe([-0.1, 1.02, -0.14], [-0.2, 1.36, -0.28], 0.025, f.top, { surf: 'skin' }); m.sph(0.08, f.hair, { p: [-0.2, 1.38, -0.28], seg: 7, glow: 1, surf: 'lamp' });
      m.sph(0.16, f.top, { p: [0.12, 0.07, 0.24], s: [1.3, 0.5, 1], seg: 7, surf: 'skin' }); m.sph(0.16, f.top, { p: [0.12, 0.07, -0.24], s: [1.3, 0.5, 1], seg: 7, surf: 'skin' });
    } else if (f.body === 'tall') {
      m.cyl(0.14, 0.34, 0.95, f.top, { p: [0, 0.48, 0], seg: 12, top: tone(f.top, 1.4), surf: 'fabric' });
      m.cyl(0.06, 0.08, 0.34, f.skin, { p: [0, 1.06, 0], seg: 7, surf: 'skin' });
      m.sph(0.3, f.skin, { p: [0, 1.42, 0], s: [0.9, 1.15, 1], seg: 12, surf: 'skin' });
      eyes(m, 0.22, 1.5, 0, 0.12, 0.07);
      m.sph(0.07, 0xffffff, { p: [0.26, 1.64, 0], seg: 8, surf: 'eye' }); m.sph(0.045, 0x20153f, { p: [0.31, 1.64, 0], seg: 6, surf: 'eye' });
      m.cone(0.07, 0.3, f.hair, { p: [0, 1.86, 0], seg: 6, glow: 0.7, surf: 'lamp' });
    } else {
      m.rbox(0.74, 0.74, 0.74, 0.16, f.skin, { p: [0, 0.72, 0], top: 0xffffff, surf: 'hull' });
      m.rbox(0.1, 0.46, 0.56, 0.06, DK2, { p: [0.37, 0.76, 0], surf: 'glass' });
      m.sph(0.08, f.hair, { p: [0.42, 0.8, 0.15], seg: 7, glow: 1.6, surf: 'lamp' }); m.sph(0.08, f.hair, { p: [0.42, 0.8, -0.15], seg: 7, glow: 1.6, surf: 'lamp' });
      m.cyl(0.26, 0.32, 0.26, f.top, { p: [0, 0.16, 0], seg: 12, surf: 'paint' });
      antenna(m, 0, 1.08, 0, 0.3, f.hair);
    }
  }, { surf: 'skin' });

  const rivet = (m, gold) => {
    const a = gold ? GOLD : W, c = gold ? 0xffa82e : CORAL, e = gold ? 0x8a5a1f : DK2;
    const body = gold ? 'chrome' : 'paint';
    m.cyl(0.22, 0.3, 0.2, gold ? 0xffa82e : IRON, { p: [0, 0.14, 0], seg: 12, surf: gold ? 'chrome' : 'dark' });
    m.tor(0.32, 0.09, gold ? 0xffa82e : 0x2a2440, { p: [0, 0.13, 0], r: [PH, 0, 0], seg: 14, surf: gold ? 'chrome' : 'rubber' });
    m.sph(0.46, a, { p: [0, 0.68, 0], top: 0xffffff, surf: body });
    m.tor(0.46, 0.05, c, { p: [0, 0.62, 0], r: [PH, 0, 0], seg: 20, glow: gold ? 0 : 0.2, surf: body });
    rivets(m, 0, 0, 0.74, 0.452, 18, 0.016);
    m.sph(0.3, e, { p: [0.28, 0.76, 0], s: [0.5, 0.75, 1], seg: 12, surf: gold ? 'chrome' : 'glass' });
    m.sph(0.09, gold ? 0xfff0b0 : MINT, { p: [0.42, 0.8, 0.13], s: [0.6, 1, 1], seg: 8, glow: 1.8, surf: 'lamp' });
    m.sph(0.09, gold ? 0xfff0b0 : MINT, { p: [0.42, 0.8, -0.13], s: [0.6, 1, 1], seg: 8, glow: 1.8, surf: 'lamp' });
    antenna(m, -0.05, 1.1, 0, 0.26, gold ? 0xfff0b0 : CORAL);
    m.sph(0.1, a, { p: [0, 0.68, 0.48], seg: 8, surf: body }); m.sph(0.1, a, { p: [0, 0.68, -0.48], seg: 8, surf: body });
  };
  M.rivet = () => G.model('rivet', (m) => rivet(m, false));

  // ---- Core colony buildings ----
  M.silo = () => G.model('silo', (m) => {
    base(m, 3.8, 3.8);
    const y0 = 0.37;
    // Three stacked plated drums, each a little narrower.
    tank(m, 0, 0, 1.56, 1.22, y0, W, MINT);
    tank(m, 0, 0, 1.52, 1.2, y0 + 1.22, W);
    tank(m, 0, 0, 1.48, 1.14, y0 + 2.42, W, MINT);
    m.lathe([[1.6, y0 + 0.02], [1.68, y0 + 0.04], [1.64, y0 + 0.14], [1.57, y0 + 0.22]], STEEL, { seg: 26, surf: 'metal' });
    // Vertical ribs.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI * 2 + 0.13;
      m.rbox(0.05, 3.5, 0.09, 0.02, W2, { p: [Math.sin(a) * 1.55, y0 + 1.76, Math.cos(a) * 1.55], r: [0, a, 0] });
    }
    // Glass dome in a steel frame.
    const top = y0 + 3.56;
    m.lathe([[1.5, top], [1.56, top + 0.06], [1.56, top + 0.16], [1.46, top + 0.2]], STEEL, { seg: 26, surf: 'metal' });
    m.dome(1.42, GLASS, { p: [0, top + 0.16, 0], top: 0xd8f4ff, surf: 'glass', seg: 24 });
    for (let i = 0; i < 4; i++) m.tor(1.44, 0.026, STEEL, { p: [0, top + 0.16, 0], r: [0, (i * PI) / 4, 0], arc: PI, surf: 'metal', seg: 22 });
    m.tor(1.2, 0.022, STEEL, { p: [0, top + 0.9, 0], r: [PH, 0, 0], surf: 'metal', seg: 22 });
    m.tor(0.72, 0.022, STEEL, { p: [0, top + 1.36, 0], r: [PH, 0, 0], surf: 'metal', seg: 18 });
    m.cyl(0.26, 0.34, 0.14, IRON, { p: [0, top + 1.6, 0], surf: 'dark', seg: 12 });
    antenna(m, 0, top + 1.66, 0, 0.5, MINT);
    // Catwalk ring with a railing.
    const cw = y0 + 2.44;
    m.cyl(1.9, 1.86, 0.07, STEEL, { p: [0, cw, 0], seg: 30, surf: 'metal' });
    m.tor(1.9, 0.02, IRON, { p: [0, cw + 0.42, 0], r: [PH, 0, 0], surf: 'dark', seg: 32 });
    for (let i = 0; i < 16; i++) { const a = (i / 16) * PI * 2; m.cyl(0.014, 0.014, 0.42, IRON, { p: [Math.cos(a) * 1.9, cw + 0.21, Math.sin(a) * 1.9], surf: 'dark', seg: 5, bevel: 0 }); }
    // Ladder up to it.
    const lx = 1.28, lz = 1.28;
    m.pipe([lx + 0.16, 0.37, lz - 0.16], [lx + 0.16, cw + 0.45, lz - 0.16], 0.022, IRON, { surf: 'dark' });
    m.pipe([lx - 0.16, 0.37, lz + 0.16], [lx - 0.16, cw + 0.45, lz + 0.16], 0.022, IRON, { surf: 'dark' });
    for (let i = 0; i < 9; i++) m.pipe([lx + 0.16, 0.6 + i * 0.27, lz - 0.16], [lx - 0.16, 0.6 + i * 0.27, lz + 0.16], 0.014, STEEL, { surf: 'metal' });
    // Door, windows, pipes.
    door(m, [0, 1.02, 1.6], 0.86, 1.28, TEAL, 'z');
    port(m, [1.54, 2.2, 0.3], 0.3, 'x');
    port(m, [0.1, 2.26, 1.55], 0.3, 'z');
    port(m, [1.5, 3.2, -0.2], 0.24, 'x');
    pipes(m, [[-1.5, 2.5, 0.72], [-1.75, 2.3, 0.84], [-1.75, 0.6, 0.84], [-1.6, 0.42, 0.72]], 0.06);
    barrel(m, 1.5, 0.37, -1.3, 0.5, 0x4fb8e0);
    m.at([1.56, 2.9, 0.96], 0.42, () => m.made('paint', () => A.grain(m, 0xdfe6ff, 0xa8b6ff)), PI / 4);
  });

  M.bay = () => G.model('bay', (m) => {
    base(m, 4.8, 3.8, 0x46497e);
    const L = 4.1, R = 1.72, cy = 0.62;
    m.add(new T.CylinderGeometry(R, R, L, 44, 1, true, 0, PI), W, { p: [0, cy, 0], r: [0, 0, PH], top: 0xfdfbff, surf: 'hull' });
    // End walls and low side walls.
    m.add(new T.CircleGeometry(R, 34, 0, PI), tone(W, 0.92), { p: [L / 2, cy, 0], r: [0, PH, 0] });
    m.add(new T.CircleGeometry(R, 34, 0, PI), tone(W, 0.92), { p: [-L / 2, cy, 0], r: [0, -PH, 0] });
    m.rbox(L, 0.3, 0.1, 0.03, W2, { p: [0, 0.48, R - 0.05] });
    m.rbox(L, 0.3, 0.1, 0.03, W2, { p: [0, 0.48, -R + 0.05] });
    // Corrugated ribs and painted arches.
    for (let i = 0; i <= 30; i++) {
      const x = -L / 2 + 0.03 + (i * (L - 0.06)) / 30;
      m.tor(R + 0.006, 0.018, tone(W, 0.86), { p: [x, cy, 0], r: [0, PH, 0], arc: PI, seg: 22, surf: 'hull' });
    }
    for (let i = 0; i < 5; i++) {
      const x = -1.84 + i * 0.92;
      m.tor(R + 0.03, 0.05, CORAL, { p: [x, cy, 0], r: [0, PH, 0], arc: PI, seg: 26, surf: 'paint' });
      m.rbox(0.14, 0.24, 0.14, 0.03, IRON, { p: [x, 0.5, R + 0.03], surf: 'dark' });
    }
    // Skylight and roof vents.
    m.rbox(2.6, 0.06, 0.5, 0.03, GLASS, { p: [-0.3, cy + R + 0.01, 0], surf: 'glass' });
    m.rbox(2.72, 0.05, 0.62, 0.02, STEEL, { p: [-0.3, cy + R - 0.005, 0], surf: 'metal' });
    [-1.4, 1.2].forEach((x) => {
      m.cyl(0.13, 0.15, 0.2, STEEL, { p: [x, cy + R + 0.08, 0.5], surf: 'metal', seg: 10, r: [0.3, 0, 0] });
      m.dome(0.2, W2, { p: [x, cy + R + 0.17, 0.52], s: [1, 0.5, 1], seg: 10 });
    });
    // Big roll-up door.
    const dx = L / 2 + 0.06, dy = 1.1;
    m.rbox(0.14, 1.66, 2.26, 0.04, IRON, { p: [dx - 0.03, dy + 0.04, 0], surf: 'dark' });
    for (let i = 0; i < 9; i++) m.rbox(0.07, 0.15, 1.98, 0.02, i % 2 ? 0xf08a7a : CORAL, { p: [dx + 0.03, 0.45 + i * 0.165, 0], surf: 'paint' });
    for (let i = 0; i < 8; i++) m.box(0.03, 0.09, 0.26, i % 2 ? 0x1c1830 : GOLD, { p: [dx + 0.09, 0.42, -0.94 + i * 0.27], surf: 'paint' });
    m.sph(0.07, LAMP, { p: [dx + 0.08, 2.06, 0], s: [1, 0.6, 2], glow: 0.7, seg: 8, surf: 'lamp' });
    port(m, [-1.1, 1.28, R - 0.13], 0.27, 'z'); port(m, [0, 1.28, R - 0.13], 0.27, 'z'); port(m, [1.1, 1.28, R - 0.13], 0.27, 'z');
    // Freight waiting by the door.
    crate(m, 2.05, 0.37, 1.42, 0.62, TIMBER, 0.12);
    crate(m, 2.08, 0.99, 1.38, 0.42, 0xc98f58, -0.25);
    barrel(m, 2.1, 0.37, -1.36, 0.46, 0xff9d3d);
    barrel(m, 1.64, 0.37, -1.5, 0.46, 0x4fb8e0);
    antenna(m, -1.2, cy + R + 0.02, -0.3, 0.7, CORAL);
    m.at([0.6, cy + R + 0.34, -0.42], 0.34, () => m.made('fabric', () => A.sack(m, 0xffd08a, 0xff9d3d)));
  });

  M.board = () => G.model('board', (m) => {
    // Steel frame carrying a glowing screen.
    [-1.26, 1.26].forEach((x) => {
      m.rbox(0.3, 0.14, 0.5, 0.05, IRON, { p: [x, 0.07, 0], surf: 'dark' });
      m.cyl(0.075, 0.1, 2.9, STEEL, { p: [x, 1.5, 0], seg: 10, surf: 'metal' });
      m.tor(0.11, 0.024, IRON, { p: [x, 0.95, 0], r: [PH, 0, 0], surf: 'dark', seg: 12 });
    });
    m.rbox(2.96, 1.94, 0.18, 0.09, 0x2c2650, { p: [0, 1.9, 0], surf: 'dark' });
    m.rbox(2.7, 1.66, 0.04, 0.03, 0x12486a, { p: [0, 1.9, 0.09], glow: 0.5, surf: 'glass' });
    const cols = [MINT, GOLD, PINK, CYAN, CORAL, MINT];
    for (let i = 0; i < 6; i++) {
      const x = -0.86 + (i % 3) * 0.86, y = 2.3 - Math.floor(i / 3) * 0.76;
      m.rbox(0.74, 0.6, 0.03, 0.03, cols[i], { p: [x, y, 0.125], glow: 0.9, top: 0xffffff, surf: 'lamp' });
      m.box(0.5, 0.05, 0.01, 0x12304a, { p: [x, y + 0.16, 0.145], surf: 'paint' });
      m.box(0.34, 0.04, 0.01, 0x12304a, { p: [x - 0.08, y + 0.04, 0.145], surf: 'paint' });
      m.sph(0.06, 0x12304a, { p: [x + 0.24, y - 0.14, 0.145], s: [1, 1, 0.2], seg: 8, surf: 'paint' });
    }
    // Sloped roof with a light strip.
    m.rbox(3.3, 0.1, 0.84, 0.04, CORAL, { p: [0, 3.02, 0.12], r: [0.12, 0, 0], top: 0xff9a8a, surf: 'paint' });
    m.box(3, 0.03, 0.05, LAMP, { p: [0, 2.94, 0.4], glow: 1.2, surf: 'lamp' });
    antenna(m, 0.9, 3.04, -0.08, 0.5, MINT);
    m.rbox(1.5, 0.74, 0.34, 0.05, W, { p: [0, 0.42, 0.18], top: 0xffffff });
    m.rbox(1.2, 0.14, 0.03, 0.01, 0x12486a, { p: [0, 0.56, 0.36], glow: 0.8, surf: 'glass' });
  });

  M.pad = () => G.model('pad', (m) => {
    m.cyl(2.42, 2.5, 0.16, 0x5c5678, { p: [0, 0.08, 0], seg: 34, surf: 'rock' });
    m.cyl(2.26, 2.32, 0.14, PLAT, { p: [0, 0.22, 0], seg: 34, top: 0x6a5cc8 });
    // Hazard ring.
    const n = 24;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2;
      m.box(0.56, 0.015, 0.2, i % 2 ? GOLD : 0x1c1830, { p: [Math.cos(a) * 1.96, 0.3, Math.sin(a) * 1.96], r: [0, -a + PH, 0], surf: 'paint' });
    }
    m.tor(1.68, 0.03, MINT, { p: [0, 0.3, 0], r: [PH, 0, 0], seg: 38, glow: 1.3, surf: 'lamp' });
    m.tor(1.04, 0.022, GOLD, { p: [0, 0.3, 0], r: [PH, 0, 0], seg: 30, glow: 0.8, surf: 'lamp' });
    m.box(1.4, 0.012, 0.16, W, { p: [0, 0.3, 0], surf: 'paint', r: [0, PI / 4, 0] }); m.box(0.16, 0.012, 1.4, W, { p: [0, 0.3, 0], surf: 'paint', r: [0, PI / 4, 0] });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2 + 0.2;
      m.cyl(0.08, 0.1, 0.07, IRON, { p: [Math.cos(a) * 2.34, 0.33, Math.sin(a) * 2.34], seg: 8, surf: 'dark' });
      m.sph(0.07, CORAL, { p: [Math.cos(a) * 2.34, 0.4, Math.sin(a) * 2.34], seg: 7, glow: 1.5, surf: 'lamp' });
    }
    // Fuel point.
    m.at([-1.72, 0.28, 1.72], 1, () => {
      m.rbox(0.4, 0.64, 0.34, 0.06, W, { p: [0, 0.34, 0], top: 0xffffff });
      m.rbox(0.3, 0.16, 0.02, 0.01, 0x12486a, { p: [0, 0.48, 0.18], glow: 0.8, surf: 'glass' });
      m.tube([[0.2, 0.3, 0], [0.42, 0.22, 0.1], [0.48, 0.08, 0.28], [0.4, 0.06, 0.5]], 0.02, 0x2a2440, { sides: 6, surf: 'rubber' });
    });
  });

  M.shuttle = () => G.model('shuttle', (m) => {
    // Body turned on its side, nose toward +x.
    m.lathe([[0, -1.5], [0.28, -1.46], [0.5, -1.2], [0.66, -0.7], [0.72, -0.1], [0.62, 0.6], [0.4, 1.1], [0.14, 1.42], [0, 1.5]], W, { p: [0, 0.86, 0], r: [0, 0, -PH], seg: 18, surf: 'paint', top: 0xffffff });
    m.tor(0.71, 0.05, CORAL, { p: [-0.2, 0.86, 0], r: [0, PH, 0], seg: 24, surf: 'paint' });
    m.tor(0.68, 0.03, CORAL, { p: [0.28, 0.86, 0], r: [0, PH, 0], seg: 24, surf: 'paint' });
    // Cockpit.
    m.sph(0.5, 0x1a3a5a, { p: [0.72, 1.12, 0], s: [1.25, 0.56, 0.72], surf: 'glass', seg: 16 });
    m.tor(0.42, 0.018, STEEL, { p: [0.72, 1.16, 0], r: [0, 0, 1.1], s: [0.42, 0.42, 0.34], surf: 'metal', seg: 16 });
    // Wings.
    [1, -1].forEach((k) => {
      m.rbox(1, 0.07, 1.1, 0.03, W, { p: [-0.4, 0.68, k * 0.92], r: [0, k * 0.3, k * 0.08], top: 0xffffff, surf: 'paint' });
      m.rbox(0.42, 0.075, 0.3, 0.02, CORAL, { p: [-0.62, 0.72, k * 1.42], r: [0, k * 0.3, k * 0.08], surf: 'paint' });
      m.cyl(0.13, 0.1, 0.7, W2, { p: [-0.72, 0.78, k * 0.62], r: [0, 0, PH], seg: 12, surf: 'metal' });
      m.cyl(0.08, 0.13, 0.14, 0xff9d3d, { p: [-1.1, 0.78, k * 0.62], r: [0, 0, PH], seg: 12, glow: 1.5, surf: 'lamp', bevel: 0 });
      m.pipe([0.3, 0.5, k * 0.5], [0.3, 0.16, k * 0.62], 0.03, IRON, { surf: 'dark' });
      m.pipe([-0.6, 0.5, k * 0.5], [-0.6, 0.16, k * 0.62], 0.03, IRON, { surf: 'dark' });
      m.rbox(1.3, 0.04, 0.1, 0.02, STEEL, { p: [-0.15, 0.14, k * 0.62], surf: 'metal' });
    });
    // Tail.
    m.rbox(0.62, 0.74, 0.07, 0.03, W, { p: [-1.02, 1.42, 0], r: [0, 0, 0.5], top: 0xffffff, surf: 'paint' });
    m.rbox(0.22, 0.2, 0.08, 0.02, CORAL, { p: [-1.28, 1.72, 0], r: [0, 0, 0.5], surf: 'paint' });
    m.cyl(0.26, 0.2, 0.24, IRON, { p: [-1.5, 0.86, 0], r: [0, 0, PH], seg: 14, surf: 'dark' });
    m.cyl(0.17, 0.2, 0.05, 0x66e3ff, { p: [-1.62, 0.86, 0], r: [0, 0, PH], seg: 14, glow: 2, surf: 'lamp', bevel: 0 });
    for (let i = 0; i < 3; i++) port(m, [0.2 - i * 0.42, 0.98, 0.665 - i * 0.02], 0.1, 'z');
  });

  M.post = () => G.model('post', (m) => {
    base(m, 3.8, 2.8, 0x54469a);
    // Timber stall with a striped awning.
    m.rbox(3.2, 0.9, 1.14, 0.1, 0xb98a5c, { p: [0, 0.82, 0.55], surf: 'wood', top: 0xd8a878 });
    for (let i = 0; i < 9; i++) m.box(0.02, 0.8, 1.16, 0x8a6240, { p: [-1.4 + i * 0.35, 0.82, 0.55], surf: 'wood' });
    m.rbox(3.34, 0.1, 1.26, 0.04, W, { p: [0, 1.3, 0.55], top: 0xffffff });
    m.rbox(3.3, 0.16, 0.05, 0.02, CORAL, { p: [0, 1.04, 1.13], surf: 'paint' });
    [[-1.5, 0.95], [1.5, 0.95], [-1.5, -0.8], [1.5, -0.8]].forEach(([x, z]) => { m.cyl(0.07, 0.09, 2.5, STEEL, { p: [x, 1.6, z], seg: 8, surf: 'metal' }); });
    for (let i = 0; i < 8; i++) m.rbox(0.45, 0.07, 2.5, 0.03, i % 2 ? W : CORAL, { p: [-1.57 + i * 0.45, 2.92, 0.1], r: [0.14, 0, 0], top: 0xffffff, surf: 'fabric' });
    for (let i = 0; i < 8; i++) m.cone(0.23, 0.26, i % 2 ? W : CORAL, { p: [-1.57 + i * 0.45, 2.7, 1.3], r: [PI, 0, 0], s: [1, 1, 0.3], seg: 3, surf: 'fabric' });
    crate(m, -0.92, 1.35, 0.5, 0.5, TIMBER, 0.2);
    m.blob(0.26, 0xfff0c9, { p: [0.04, 1.6, 0.55], detail: 2, lump: 0.04, s: [0.9, 1.2, 0.9], surf: 'fruit' });
    m.at([0.9, 1.36, 0.55], 0.42, () => m.made('fruit', () => A.jar(m, 0xffc94d, 0xff8f2e)));
    m.rbox(2.6, 1.8, 0.1, 0.05, PLAT, { p: [0, 1.4, -1.1] });
    for (let i = 0; i < 3; i++) m.rbox(2.2, 0.05, 0.3, 0.02, TIMBER, { p: [0, 0.9 + i * 0.5, -0.92], surf: 'wood' });
    for (let i = 0; i < 6; i++) m.sph(0.07, LAMP, { p: [-1.25 + i * 0.5, 2.62 - Math.sin(((i + 0.5) / 6) * PI) * 0.12, 1.28], seg: 7, glow: 1.2, surf: 'lamp' });
  });

  M.gazette = () => G.model('gazette', (m) => {
    m.cyl(0.84, 0.92, 0.16, PLAT, { p: [0, 0.08, 0], seg: 18 });
    tank(m, 0, 0, 0.66, 1.68, 0.16, W);
    m.rbox(1.08, 0.9, 0.1, 0.04, IRON, { p: [0, 1.25, 0.66], surf: 'dark' });
    m.rbox(0.98, 0.8, 0.03, 0.02, 0x12486a, { p: [0, 1.25, 0.72], glow: 0.7, surf: 'glass' });
    for (let i = 0; i < 4; i++) m.box(0.78, 0.05, 0.01, 0xdffbff, { p: [0, 1.5 - i * 0.16, 0.74], glow: 1.4, surf: 'lamp' });
    m.lathe([[0.92, 1.84], [0.86, 1.92], [0.5, 2.1], [0.08, 2.2], [0, 2.2]], CORAL, { seg: 18, top: 0xffb0a0, surf: 'paint' });
    antenna(m, 0, 2.18, 0, 0.3, GOLD);
    m.tor(0.16, 0.03, GOLD, { p: [0, 2.3, 0], r: [PH, 0, 0], seg: 12, glow: 0.8, surf: 'lamp' });
  });

  // ---- Factories ----
  const F = {
    synth(m) {
      tank(m, 0, 0, 1.3, 1.9, 0.37, W, 0xffa24d);
      // Hopper with crops inside.
      m.lathe([[1.0, 2.24], [1.5, 3.06], [1.52, 3.2], [1.42, 3.22]], GOLD, { seg: 22, top: 0xffe39c, surf: 'paint' });
      m.cyl(1.36, 1.36, 0.04, 0xc99a5a, { p: [0, 3.14, 0], seg: 22, surf: 'soil' });
      for (let i = 0; i < 16; i++) { const a = i * 2.4, r = 0.2 + (i % 5) * 0.2; m.blob(0.13, i % 3 ? 0xdfe6ff : 0x7cf7c0, { p: [Math.cos(a) * r, 3.2, Math.sin(a) * r], detail: 1, lump: 0.2, surf: 'fruit', glow: 0.15 }); }
      rivets(m, 0, 0, 3.14, 1.52, 22);
      // Motor and drive belt on top of a strut.
      m.rbox(0.2, 0.34, 2.9, 0.04, IRON, { p: [0, 3.46, 0], surf: 'dark' });
      m.cyl(0.26, 0.26, 0.5, STEEL, { p: [0, 3.76, 0], seg: 14, surf: 'metal' });
      m.cyl(0.08, 0.08, 0.5, IRON, { p: [0, 3.14, 0], seg: 8, surf: 'dark', bevel: 0 });
      // Output chute and conveyor.
      m.rbox(0.7, 0.14, 1.5, 0.04, 0x3a3656, { p: [0.92, 0.62, 1.66], r: [0.12, PI / 4 * 0, 0], surf: 'rubber' });
      m.rbox(0.8, 0.08, 1.56, 0.02, STEEL, { p: [0.92, 0.55, 1.66], r: [0.12, 0, 0], surf: 'metal' });
      pipes(m, [[0.5, 1.2, 1.2], [0.9, 0.98, 1.24], [0.92, 0.82, 1.3]], 0.1);
      port(m, [1.3, 1.5, -0.2], 0.3, 'x'); port(m, [-0.3, 1.5, 1.3], 0.3, 'z');
      vent(m, [1.28, 0.8, 0.6], 0.5, 0.42, 'x');
      m.at([1.7, 0.38, 0.8], 0.46, () => m.made('fabric', () => A.sack(m, 0xffd08a, 0xff9d3d)));
      m.at([0.9, 0.38, 1.9], 0.42, () => m.made('fabric', () => A.sack(m, 0xc9b0ff, 0x8f6bff)));
    },
    bakery(m) {
      m.lathe([[1.95, 0.36], [1.94, 0.9], [1.8, 1.45], [1.46, 1.88], [0.9, 2.2], [0.3, 2.34], [0, 2.36]], 0xe8b47c, { seg: 26, top: 0xfff0d8, surf: 'hull' });
      m.tor(1.97, 0.1, CORAL, { p: [0, 0.46, 0], r: [PH, 0, 0], seg: 30, surf: 'paint' });
      for (let i = 0; i < 3; i++) m.tor(1.9 - i * 0.27, 0.02, tone(0xe8b47c, 0.78), { p: [0, 1.0 + i * 0.42, 0], r: [PH, 0, 0], seg: 28, surf: 'hull' });
      m.rbox(1.1, 1.3, 0.16, 0.08, CORAL, { p: [1.3, 0.96, 1.3], r: [0, PI / 4, 0], top: 0xffb0a0, surf: 'paint' });
      m.rbox(1.34, 0.14, 0.34, 0.04, W, { p: [1.42, 1.72, 1.42], r: [0.3, PI / 4, 0], surf: 'paint' });
      port(m, [1.8, 1.2, -0.6], 0.34, 'x'); port(m, [-0.6, 1.2, 1.8], 0.34, 'z');
      m.cyl(0.3, 0.36, 1.3, 0x9a7a5c, { p: [-0.7, 2.4, -0.7], seg: 12, surf: 'rock', top: 0xc0a080 });
      m.cyl(0.4, 0.4, 0.14, IRON, { p: [-0.7, 3.04, -0.7], seg: 12, surf: 'dark' });
      m.cyl(0.26, 0.26, 0.05, 0x201830, { p: [-0.7, 3.12, -0.7], seg: 12, surf: 'rubber' });
    },
    dairy(m) {
      [[-0.7, -0.7, 1.15, 2.6], [0.9, -0.3, 0.95, 2.1], [-0.3, 1.0, 0.9, 1.7]].forEach(([x, z, r, h]) => {
        tank(m, x, z, r, h, 0.37, W, VIO);
        m.lathe([[r, 0], [r * 0.9, r * 0.32], [r * 0.5, r * 0.54], [0, r * 0.6]], 0xc9b0ff, { p: [x, 0.37 + h, z], seg: 20, top: 0xf1e8ff, surf: 'paint' });
        m.cyl(0.08, 0.1, 0.14, STEEL, { p: [x, 0.37 + h + r * 0.62, z], surf: 'metal', seg: 8 });
      });
      pipes(m, [[-0.2, 1.8, -0.5], [0.4, 1.8, -0.4]], 0.09);
      pipes(m, [[-0.4, 1.2, 0.3], [-0.5, 1.2, 0.5]], 0.09);
      port(m, [1.85, 1.5, -0.3], 0.26, 'x'); port(m, [-0.3, 1.2, 1.9], 0.26, 'z');
      vent(m, [1.84, 0.8, -0.3], 0.5, 0.36, 'x');
    },
    sugar(m) {
      m.lathe([[1.62, 0.36], [1.6, 0.5], [1.28, 1.36], [1.22, 1.44]], W, { seg: 24, top: 0xffffff, surf: 'hull' });
      m.lathe([[1.2, 1.44], [1.7, 2.5], [1.72, 2.58]], GLASS, { seg: 26, surf: 'glass', top: 0xd8f4ff });
      m.tor(1.72, 0.09, 0x3fa7d6, { p: [0, 2.58, 0], r: [PH, 0, 0], seg: 30, surf: 'paint' });
      m.tor(1.24, 0.06, 0x3fa7d6, { p: [0, 1.44, 0], r: [PH, 0, 0], seg: 26, surf: 'paint' });
      for (let i = 0; i < 12; i++) { const a = i * 2.1, r = 0.4 + (i % 3) * 0.35; m.blob(0.22, 0xffffff, { p: [Math.cos(a) * r, 2.2 + (i % 3) * 0.14, Math.sin(a) * r], detail: 1, lump: 0.2, seed: i, surf: 'fur', glow: 0.25 }); }
      m.cyl(0.1, 0.1, 0.7, STEEL, { p: [0, 2.9, 0], seg: 8, surf: 'metal' });
      m.rbox(1.9, 0.07, 0.22, 0.03, GOLD, { p: [0, 3.2, 0], r: [0, 0.6, 0], surf: 'chrome' });
      m.sph(0.14, GOLD, { p: [0, 3.26, 0], surf: 'chrome', seg: 10 });
      port(m, [1.42, 0.85, 0.3], 0.26, 'x');
    },
    snack(m) {
      m.rbox(3.3, 2.2, 3, 0.3, W, { p: [0, 1.46, 0], top: 0xffffff });
      m.rbox(3.34, 0.3, 3.04, 0.1, CORAL, { p: [0, 0.88, 0], surf: 'paint' });
      m.rbox(1.9, 1, 0.1, 0.05, 0x12486a, { p: [0.2, 1.76, 1.52], glow: 0.6, surf: 'glass' });
      m.rbox(0.1, 1, 1.5, 0.05, 0x12486a, { p: [1.67, 1.76, 0], glow: 0.6, surf: 'glass' });
      m.rbox(2.9, 0.12, 0.14, 0.03, STEEL, { p: [0, 2.74, 0], surf: 'metal' });
      m.rbox(0.6, 0.5, 0.6, 0.1, GOLD, { p: [0.5, 2.94, 0], surf: 'paint' });
      vent(m, [-0.9, 1.4, 1.52], 0.7, 0.5, 'z');
      m.at([-0.6, 3.29, -0.2], 0.72, () => m.made('paint', () => A.tub(m, 0xfff4c0, 0xff7a6b)), 0.5);
      antenna(m, 1.4, 2.56, -1.2, 0.8, MINT);
    },
    grill(m) {
      m.rbox(3.5, 1.2, 2.5, 0.3, 0x4a4470, { p: [0, 0.98, 0], top: 0x7a70b0, surf: 'dark' });
      m.lathe([[1.2, 0], [1.18, 0.3], [1, 0.64], [0.6, 0.86], [0, 0.96]], W, { p: [0, 1.56, 0], s: [1.42, 1, 1], seg: 22, top: 0xffffff, surf: 'hull' });
      for (let i = 0; i < 5; i++) m.rbox(3.1, 0.06, 0.1, 0.02, 0xff8f3d, { p: [0, 1.6, -0.8 + i * 0.4], glow: 1.6, surf: 'lamp' });
      m.cyl(0.28, 0.34, 1.2, W2, { p: [-1.1, 3, -0.6], seg: 12, surf: 'metal' });
      m.cone(0.46, 0.36, CORAL, { p: [-1.1, 3.78, -0.6], seg: 12, surf: 'paint' });
      m.rbox(0.9, 0.18, 0.16, 0.06, GOLD, { p: [0.6, 1.44, 1.36], surf: 'chrome' });
      m.rbox(0.9, 0.18, 0.16, 0.06, GOLD, { p: [-0.6, 1.44, 1.36], surf: 'chrome' });
      port(m, [1.76, 1, 0.4], 0.24, 'x');
    },
    pie(m) {
      m.cyl(1.1, 1.4, 0.9, 0x4a4470, { p: [0, 0.79, 0], seg: 22, top: 0x7a70b0, surf: 'dark' });
      m.tor(1.58, 0.28, W, { p: [0, 1.94, 0], r: [PH + 0.14, 0, 0.14], seg: 34, surf: 'hull' });
      m.tor(1.58, 0.08, 0xff9d3d, { p: [0, 1.94, 0], r: [PH + 0.14, 0, 0.14], seg: 34, glow: 1.5, surf: 'lamp' });
      m.sph(0.8, 0xffd24d, { p: [0, 1.94, 0], glow: 1.6, top: 0xffffff, surf: 'lamp' });
      m.cyl(0.14, 0.14, 2, STEEL, { p: [0, 1.54, 0], seg: 10, surf: 'metal' });
      m.at([0, 3.19, 0], 0.72, () => m.made('paint', () => A.pie(m, 0xffa24d, 0xe8b070)));
      port(m, [1.2, 0.84, 0.4], 0.22, 'x');
    },
    loom(m) {
      m.rbox(0.3, 3, 0.3, 0.1, W, { p: [-1.6, 1.84, 0] }); m.rbox(0.3, 3, 0.3, 0.1, W, { p: [1.6, 1.84, 0] });
      m.rbox(3.6, 0.3, 0.4, 0.1, CORAL, { p: [0, 3.29, 0], surf: 'paint' });
      m.rbox(3.4, 0.2, 1.8, 0.08, TIMBER, { p: [0, 0.94, 0.2], surf: 'wood' });
      for (let i = 0; i < 17; i++) { const c = [PINK, CYAN, GOLD, MINT][i % 4]; m.pipe([-1.45 + i * 0.18, 3.14, 0], [-1.45 + i * 0.18, 1.04, 0.8], 0.016, c, { seg: 5, glow: 0.7, surf: 'fabric' }); }
      m.cyl(0.2, 0.2, 3, 0xffc9e8, { p: [0, 0.99, 1.1], r: [0, 0, PH], seg: 12, top: 0xffffff, surf: 'fabric' });
      m.rbox(3, 0.04, 1, 0.02, 0xffc9e8, { p: [0, 1.08, 0.5], surf: 'fabric' });
    },
    smelter(m) {
      m.cyl(1, 1.5, 2.6, 0x5a5078, { p: [0, 1.66, 0], seg: 14, top: 0x8a7cd0, surf: 'dark' });
      m.tor(1.26, 0.12, 0xff6a3d, { p: [0, 1.54, 0], r: [PH, 0, 0], seg: 24, glow: 1.8, surf: 'lamp' });
      m.rbox(1.1, 1, 0.2, 0.08, 0xff8f3d, { p: [0.98, 1.14, 0.98], r: [0, PI / 4, 0], glow: 2, surf: 'lamp' });
      m.cyl(0.42, 0.56, 1.3, W2, { p: [0, 3.54, 0], seg: 12, surf: 'metal' });
      m.cyl(0.56, 0.56, 0.16, CORAL, { p: [0, 4.18, 0], seg: 12, surf: 'paint' });
      m.at([1.7, 0.42, 0.4], 0.4, () => m.made('metal', () => A.ingot(m, 0xaab4d8, 0xe0e6ff)));
      m.at([0.4, 0.42, 1.7], 0.4, () => m.made('metal', () => A.ingot(m, 0x46d6c0, 0xbffff4)));
    },
    stitch(m) {
      tank(m, 0, 0, 1.28, 2.96, 0.37, W, CORAL);
      m.lathe([[1.28, 0], [1.2, 0.3], [0.86, 0.68], [0.3, 0.86], [0, 0.88]], CORAL, { p: [0, 3.33, 0], seg: 22, top: 0xffb0a0, surf: 'paint' });
      port(m, [1.42 - 0.12, 2, 0.4], 0.3, 'x'); port(m, [0.4, 2, 1.42 - 0.12], 0.3, 'z');
      for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; m.box(0.2, 0.05, 0.04, 0xffffff, { p: [Math.cos(a) * 1.3, 0.99, Math.sin(a) * 1.3], r: [0, -a + PH, 0], surf: 'paint' }); }
      m.at([0, 4.54, 0], 0.72, () => m.made('fabric', () => A.suit(m, 0xf3eeff, 0xff7a6b)), 0.2);
    },
    galley(m) {
      m.sph(2, 0x2f7fc8, { p: [0, 1.54, 0], s: [1, 0.68, 0.72], top: 0x7fc8ff, seg: 22, surf: 'paint' });
      for (let i = 0; i < 3; i++) m.tor(1.9 - i * 0.12, 0.016, STEEL, { p: [0, 1.2 + i * 0.3, 0], r: [PH, 0, 0], s: [1.9 - i * 0.12, (1.9 - i * 0.12) * 0.74, 1], surf: 'metal', seg: 34 });
      m.rbox(3, 0.2, 2.2, 0.08, TIMBER, { p: [0, 2.24, 0], surf: 'wood' });
      m.rbox(1.6, 0.8, 1.2, 0.2, W, { p: [-0.3, 2.74, 0], top: 0xffffff });
      port(m, [1.2, 1.54, 1.12], 0.24, 'z'); port(m, [0.2, 1.44, 1.34], 0.24, 'z'); port(m, [-0.9, 1.54, 1.2], 0.24, 'z');
      m.tor(0.32, 0.05, GOLD, { p: [1.9, 1.94, 0], r: [0, PH, 0], seg: 12, surf: 'chrome' });
      m.at([0.9, 2.76, 0], 0.6, () => m.made('skin', () => A.fish(m, 0x7f8cff, 0xc9d0ff)), 0.4);
    },
    cake(m) {
      [[1.85, 1], [1.4, 0.9], [0.95, 0.8]].reduce((y, [r, h], i) => {
        m.cyl(r, r, h, i === 1 ? 0xffd0e8 : W, { p: [0, y + h / 2, 0], seg: 24, top: 0xffffff, surf: 'paint' });
        m.tor(r, 0.1, i === 1 ? GOLD : PINK, { p: [0, y + h, 0], r: [PH, 0, 0], seg: 28, glow: 0.15, surf: 'paint' });
        for (let d = 0; d < 10; d++) { const a = (d / 10) * PI * 2; m.sph(0.1, i === 1 ? GOLD : PINK, { p: [Math.cos(a) * r, y + h - 0.12 - (d % 3) * 0.05, Math.sin(a) * r], s: [1, 2, 1], seg: 6, surf: 'paint' }); }
        return y + h;
      }, 0.36);
      port(m, [1.86, 0.86, 0.4], 0.26, 'x'); port(m, [0.4, 0.86, 1.86], 0.26, 'z');
      port(m, [1.42, 1.79, 0.3], 0.2, 'x');
      m.cyl(0.1, 0.1, 0.5, CORAL, { p: [0, 3.31, 0], seg: 8, surf: 'paint' }); m.sph(0.14, GOLD, { p: [0, 3.64, 0], glow: 1.8, seg: 8, surf: 'lamp' });
    },
    juice(m) {
      m.cyl(1.7, 1.15, 2.9, 0xff7fb0, { p: [0, 1.8, 0], seg: 24, glow: 0.2, top: 0xffd8e8, surf: 'glass' });
      m.tor(1.7, 0.1, W, { p: [0, 3.24, 0], r: [PH, 0, 0], seg: 30, surf: 'paint' });
      m.pipe([0.3, 2.64, 0], [1.1, 4.44, 0.5], 0.13, MINT, { glow: 0.3, surf: 'paint' });
      m.cyl(0.95, 0.95, 0.12, GOLD, { p: [-1.4, 3.34, -0.6], r: [PH, 0, 0.5], seg: 20, surf: 'fruit' });
      for (let i = 0; i < 6; i++) { const a = i * 2.4; m.sph(0.14, 0xffffff, { p: [Math.cos(a) * 0.8, 3.04 + (i % 2) * 0.1, Math.sin(a) * 0.8], seg: 6, glow: 0.7, surf: 'crystal' }); }
    },
    cryo(m) {
      m.dome(1.85, 0xc8ecff, { p: [0, 0.36, 0], top: 0xffffff, seg: 26, glow: 0.12, surf: 'paint' });
      [[-1, 1.44, 0.7, 0.3], [0.6, 2.24, 0.45, -0.2], [0.9, 1.24, 0.5, 0.4], [-0.4, 1.94, 0.6, 0.1]].forEach(([x, y, r, k]) => m.octa(r, CYAN, { p: [x, y, -0.8], s: [0.55, 1.5, 0.55], r: [0, k, k], glow: 0.5, top: 0xffffff, surf: 'crystal' }));
      m.rbox(1, 1.3, 0.16, 0.08, 0x3fa7d6, { p: [1.25, 1.04, 1.25], r: [0, PI / 4, 0], surf: 'paint' });
      m.at([0, 3.09, 0], 0.72, () => m.made('paint', () => A.icecream(m, 0xbff0ff, 0xffd0e8)));
    },
    gems(m) {
      m.rbox(3.2, 1.6, 3.2, 0.2, 0x4a4470, { p: [0, 1.16, 0], top: 0x7a70b0, surf: 'dark' });
      m.octa(1.5, 0xff3d5f, { p: [0, 2.94, 0], s: [1.1, 0.95, 1.1], top: 0xffb8c8, glow: 0.3, surf: 'crystal' });
      port(m, [1.62, 1.24, 0.6], 0.28, 'x'); port(m, [0.6, 1.24, 1.62], 0.28, 'z');
      door(m, [-0.6, 0.94, 1.62], 0.7, 1, GOLD, 'z');
    },
    lantern(m) {
      tank(m, 0, 0, 1.44, 1.3, 0.37, W, CORAL);
      m.cyl(0.9, 1.1, 1.3, W2, { p: [0, 2.32, 0], seg: 18, surf: 'hull' });
      m.cyl(0.8, 0.8, 1, 0xffc94d, { p: [0, 3.52, 0], seg: 14, glow: 1.8, top: 0xffffff, surf: 'lamp' });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; m.cyl(0.05, 0.05, 1.1, IRON, { p: [Math.cos(a) * 0.84, 3.52, Math.sin(a) * 0.84], seg: 6, surf: 'dark' }); }
      m.cone(1.1, 0.7, CORAL, { p: [0, 4.38, 0], seg: 14, surf: 'paint' });
      port(m, [1.44, 1.1, 0.4], 0.26, 'x');
    },
  };
  const FSIGN = { bakery: 'bread', dairy: 'cheese', sugar: 'candy', grill: 'burger', loom: 'cloth', cake: 'starcake', juice: 'mjuice', gems: 'ring' };
  const FSIGNY = { bakery: 3.1, dairy: 3.9, sugar: 3.9, grill: 3.5, loom: 4.2, cake: 4.5, juice: 4.8, gems: 4.9 };
  const FBASE = { synth: 0x4a3d8f, bakery: 0x7a4a6a, dairy: 0x5a4aa8, sugar: 0x3f5fa8, snack: 0x6a4a8f, grill: 0x5a3a5a, pie: 0x7a4a4f, loom: 0x6a3f7a, smelter: 0x4a3a5a, stitch: 0x4a4f9f, galley: 0x2f5a8f, cake: 0x8a5a8a, juice: 0x8a4a6a, cryo: 0x3f7a9f, gems: 0x5a3a7a, lantern: 0x7a6a4a };
  M.factory = (kind) => G.model('factory-' + kind, (m) => {
    base(m, 4.5, 4.5, FBASE[kind]);
    F[kind](m);
    if (FSIGN[kind]) sign(m, FSIGNY[kind], FSIGN[kind]);
  });

  // ---- Rocks, thickets, crystals ----
  M.rock = (kind, seed) => G.model('rock-' + kind + (seed % 4), (m) => {
    const k = seed % 4;
    if (kind === 'rock') {
      m.blob(0.52, 0x7a6cb0, { p: [0, 0.3, 0], detail: 2, lump: 0.32, freq: 2.6, facets: true, s: [1.15, 0.78, 1], top: 0xb4a8e8, surf: 'rock', seed: k * 3 + 1 });
      m.blob(0.28, 0x6a5ca0, { p: [0.36, 0.17, 0.2], detail: 1, lump: 0.3, facets: true, top: 0xa89cdc, surf: 'rock', seed: k + 7 });
      m.blob(0.16, 0x6a5ca0, { p: [-0.4, 0.09, 0.26], detail: 1, lump: 0.3, facets: true, surf: 'rock', seed: k + 11 });
    } else if (kind === 'thicket') {
      [[0, 0.4, 0, 0.4], [0.28, 0.3, 0.1, 0.28], [-0.25, 0.28, 0.15, 0.3]].forEach(([x, y, z, r], i) => m.blob(r, 0xb83f98, { p: [x, y, z], detail: 2, lump: 0.25, freq: 4, seed: i + k, top: 0xff9edc, surf: 'leaf' }));
      for (let i = 0; i < 10; i++) { const a = i * 2.4 + k, y = 0.3 + (i % 3) * 0.14; m.cone(0.035, 0.3, 0xffd0f0, { p: [Math.cos(a) * 0.36, y, Math.sin(a) * 0.36], r: [Math.sin(a) * 1, 0, -Math.cos(a) * 1], seg: 5, glow: 0.3, surf: 'crystal' }); }
    } else {
      m.blob(0.3, 0x5a4f90, { p: [0, 0.08, 0], detail: 1, lump: 0.3, facets: true, s: [1.3, 0.4, 1.3], surf: 'rock', seed: k });
      [[0, 0.5, 0, 0.3, 0], [0.26, 0.34, 0.1, 0.2, -0.4], [-0.22, 0.32, 0.15, 0.2, 0.4], [0.06, 0.26, -0.22, 0.14, 0.2]].forEach(([x, y, z, r, tilt]) => m.octa(r, 0x7bdcff, { p: [x, y, z], s: [0.7, 1.8, 0.7], r: [0, k, tilt], top: 0xf0fbff, glow: 0.5, surf: 'crystal' }));
    }
  });

  M.beacon = () => G.model('beacon', (m) => {
    m.cyl(0.44, 0.54, 0.18, IRON, { p: [0, 0.09, 0], seg: 12, surf: 'dark' });
    m.tor(0.46, 0.03, GOLD, { p: [0, 0.18, 0], r: [PH, 0, 0], seg: 18, surf: 'paint' });
    m.cyl(0.05, 0.075, 1.9, STEEL, { p: [0, 1.1, 0], seg: 8, surf: 'metal', bevel: 0 });
    m.add(new T.ConeGeometry(0.42, 0.9, 3), CORAL, { p: [0.5, 1.68, 0], r: [0, 0, -PH], s: [1, 1, 0.15], top: 0xffb0a0, surf: 'fabric' });
    m.sph(0.15, MINT, { p: [0, 2.12, 0], seg: 9, glow: 2, surf: 'lamp' });
  });

  M.crate = () => G.model('crate', (m) => {
    m.cyl(0.8, 1, 0.1, 0x1c1236, { p: [0, 0.05, 0], seg: 14, surf: 'soil' });
    m.rbox(0.9, 0.9, 0.9, 0.16, W, { p: [0, 0.6, 0], r: [0.1, 0.5, 0.08], top: 0xffffff });
    m.rbox(0.94, 0.14, 0.94, 0.05, CYAN, { p: [0, 0.64, 0], r: [0.1, 0.5, 0.08], glow: 1.5, surf: 'lamp' });
    m.octa(0.15, GOLD, { p: [0.02, 1.2, 0], glow: 1.6, surf: 'lamp' });
  });

  // ---- Decorations ----
  const D = {
    hexpath(m) { m.cyl(0.57, 0.58, 0.08, 0xb0a8dc, { p: [0, 0.05, 0], seg: 6, top: 0xe2dcff, surf: 'rock' }); },
    fence(m) {
      m.cyl(0.08, 0.11, 0.84, W, { p: [0, 0.42, 0], seg: 8 });
      m.sph(0.1, GOLD, { p: [0, 0.88, 0], seg: 7, glow: 1, surf: 'lamp' });
      m.pipe([-0.5, 0.64, 0], [0.5, 0.64, 0], 0.04, MINT, { glow: 0.9, surf: 'lamp' });
      m.pipe([-0.5, 0.36, 0], [0.5, 0.36, 0], 0.03, MINT, { glow: 0.7, surf: 'lamp' });
    },
    lamp(m) {
      m.cyl(0.16, 0.26, 0.2, IRON, { p: [0, 0.1, 0], seg: 12, surf: 'dark' });
      m.cyl(0.04, 0.06, 1.4, STEEL, { p: [0, 0.8, 0], seg: 8, surf: 'metal', bevel: 0 });
      m.tor(0.09, 0.02, BRASS, { p: [0, 1.46, 0], r: [PH, 0, 0], seg: 12, surf: 'chrome' });
      m.sph(0.24, LAMP, { p: [0, 1.66, 0], glow: 2.2, top: 0xffffff, surf: 'lamp' });
      m.dome(0.28, IRON, { p: [0, 1.76, 0], s: [1, 0.4, 1], seg: 12, surf: 'dark' });
    },
    pot(m) {
      m.lathe([[0.2, 0], [0.26, 0.04], [0.33, 0.34], [0.36, 0.38], [0.3, 0.38]], CORAL, { seg: 14, top: 0xffb0a0, surf: 'paint' });
      m.cyl(0.3, 0.3, 0.03, SOIL, { p: [0, 0.36, 0], seg: 12, surf: 'soil' });
      for (let i = 0; i < 6; i++) { const a = i * 1.05; m.blob(0.16, i % 2 ? PINK : MINT, { p: [Math.cos(a) * 0.18, 0.5 + (i % 3) * 0.1, Math.sin(a) * 0.18], detail: 2, lump: 0.2, freq: 4, seed: i, top: 0xffffff, glow: 0.2, surf: 'leaf' }); }
    },
    bench(m) {
      for (let i = 0; i < 3; i++) m.rbox(1.7, 0.05, 0.14, 0.02, TIMBER, { p: [0, 0.46, -0.16 + i * 0.16], top: 0xd8a878, surf: 'wood' });
      for (let i = 0; i < 2; i++) m.rbox(1.7, 0.13, 0.04, 0.02, TIMBER, { p: [0, 0.7 + i * 0.2, -0.22], r: [-0.14, 0, 0], surf: 'wood' });
      [[-0.7, 0.16], [0.7, 0.16], [-0.7, -0.16], [0.7, -0.16]].forEach(([x, z]) => m.cyl(0.05, 0.06, 0.44, IRON, { p: [x, 0.22, z], seg: 6, surf: 'dark' }));
      m.octa(0.1, GOLD, { p: [0, 1.04, -0.24], glow: 1, surf: 'lamp' });
    },
    mail(m) {
      m.cyl(0.06, 0.08, 0.9, STEEL, { p: [0, 0.45, 0], seg: 7, surf: 'metal' });
      m.rbox(0.66, 0.38, 0.4, 0.14, 0x3fa7d6, { p: [0, 1, 0], top: 0x8ee9ff, surf: 'paint' });
      m.add(new T.ConeGeometry(0.16, 0.34, 3), CORAL, { p: [0.28, 1.34, 0.2], r: [0, 0, -PH], s: [1, 1, 0.2], surf: 'paint' });
      m.pipe([0.1, 1.15, 0.2], [0.1, 1.42, 0.2], 0.018, W);
    },
    crystal(m) {
      m.blob(0.3, 0x5a4f90, { p: [0, 0.08, 0], detail: 1, lump: 0.3, facets: true, s: [1.2, 0.4, 1.2], surf: 'rock' });
      [[0, 0.7, 0, 0.42, 0], [0.26, 0.45, 0.12, 0.28, -0.35], [-0.24, 0.42, 0.14, 0.26, 0.35]].forEach(([x, y, z, r, tilt]) => m.octa(r, 0xff8fd8, { p: [x, y, z], s: [0.7, 1.9, 0.7], r: [0, 0.4, tilt], top: 0xffe8f8, glow: 0.6, surf: 'crystal' }));
    },
    dish(m) {
      m.cyl(0.4, 0.56, 0.3, W2, { p: [0, 0.15, 0], seg: 12, surf: 'metal' });
      m.pipe([0, 0.2, 0], [0, 0.95, 0], 0.1, W);
      m.dome(0.9, W, { p: [0.18, 1.05, 0.18], r: [PI - 0.7, PI / 4, 0], s: [1, 0.42, 1], seg: 18, top: 0xc9c2ea, surf: 'paint' });
      m.pipe([0.18, 1.1, 0.18], [0.62, 1.52, 0.62], 0.03, IRON, { surf: 'dark' });
      m.sph(0.1, CORAL, { p: [0.64, 1.56, 0.64], seg: 8, glow: 1.6, surf: 'lamp' });
    },
    solar(m) {
      m.cyl(0.05, 0.1, 1.5, STEEL, { p: [0, 0.75, 0], seg: 7, surf: 'metal' });
      for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2; m.rbox(0.72, 0.22, 0.03, 0.01, 0x24509a, { p: [Math.cos(a) * 0.4 + 0.05, 1.5 + Math.sin(a) * 0.4, 0.05], r: [0, 0, a], glow: 0.1, surf: 'glass' }); }
      m.sph(0.1, GOLD, { p: [0.05, 1.5, 0.1], seg: 8, surf: 'chrome' });
    },
    scope(m) {
      m.pipe([0, 0, 0], [0, 0.9, 0], 0.06, IRON, { surf: 'dark' }); m.pipe([0.5, 0, 0.3], [0, 0.9, 0], 0.05, IRON, { surf: 'dark' }); m.pipe([-0.4, 0, 0.4], [0, 0.9, 0], 0.05, IRON, { surf: 'dark' });
      m.pipe([-0.6, 0.6, -0.5], [0.5, 1.5, 0.45], 0.2, W, { seg: 12, surf: 'paint' });
      m.tor(0.21, 0.04, BRASS, { p: [0.5, 1.5, 0.45], r: [0.7, 0.8, 0], seg: 14, surf: 'chrome' });
      m.pipe([-0.74, 0.5, -0.62], [-0.6, 0.6, -0.5], 0.08, CORAL, { surf: 'paint' });
    },
    gnome(m) {
      m.sph(0.25, 0x8cf07c, { p: [0, 0.3, 0], s: [1, 1.05, 1], top: 0xc8ffb8, surf: 'skin' });
      m.cone(0.25, 0.6, CORAL, { p: [0, 0.78, 0], seg: 12, surf: 'fabric' });
      eyes(m, 0.17, 0.36, 0, 0.1, 0.08, 'x');
      m.sph(0.1, 0xff9d3d, { p: [0, 0.12, 0.15], seg: 7, s: [1.2, 0.5, 1], surf: 'skin' });
      m.sph(0.1, 0xff9d3d, { p: [0, 0.12, -0.15], seg: 7, s: [1.2, 0.5, 1], surf: 'skin' });
    },
    fountain(m) {
      m.lathe([[1.42, 0], [1.42, 0.3], [1.34, 0.42], [1.2, 0.42], [1.16, 0.3]], W, { seg: 24, top: 0xffffff, surf: 'rock' });
      m.cyl(1.17, 1.17, 0.04, 0x46d6c0, { p: [0, 0.34, 0], seg: 24, glow: 0.6, surf: 'glass' });
      m.cyl(0.26, 0.4, 1, W2, { p: [0, 0.82, 0], seg: 14, surf: 'rock' });
      m.cyl(0.64, 0.5, 0.2, W, { p: [0, 1.36, 0], seg: 18, surf: 'rock' });
      for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; m.tube([[0, 1.46, 0], [Math.cos(a) * 0.5, 1.5, Math.sin(a) * 0.5], [Math.cos(a) * 0.9, 0.9, Math.sin(a) * 0.9], [Math.cos(a) * 1, 0.36, Math.sin(a) * 1]], 0.03, CYAN, { glow: 1.3, sides: 5, surf: 'lamp' }); }
      m.octa(0.2, MINT, { p: [0, 1.8, 0], glow: 1.6, surf: 'lamp' });
    },
    swing(m) {
      m.pipe([-0.9, 0, 0.4], [-0.9, 1.9, 0], 0.07, W); m.pipe([-0.9, 0, -0.4], [-0.9, 1.9, 0], 0.07, W);
      m.pipe([0.9, 0, 0.4], [0.9, 1.9, 0], 0.07, W); m.pipe([0.9, 0, -0.4], [0.9, 1.9, 0], 0.07, W);
      m.pipe([-0.95, 1.9, 0], [0.95, 1.9, 0], 0.08, CORAL, { surf: 'paint' });
      m.pipe([-0.3, 1.9, 0], [-0.3, 0.7, 0.3], 0.02, MINT, { glow: 0.8, surf: 'lamp' }); m.pipe([0.3, 1.9, 0], [0.3, 0.7, 0.3], 0.02, MINT, { glow: 0.8, surf: 'lamp' });
      m.rbox(0.8, 0.08, 0.3, 0.03, GOLD, { p: [0, 0.68, 0.3], surf: 'paint' });
    },
    rivet(m) { m.cyl(0.72, 0.86, 0.42, 0x8a7cc0, { p: [0, 0.21, 0], seg: 18, top: 0xb8acec, surf: 'rock' }); m.at([0, 0.42, 0], 1.3, () => rivet(m, true), PI / 4); },
    orrery(m) {
      m.cyl(0.7, 1, 0.3, BRASS, { p: [0, 0.15, 0], seg: 20, top: 0xffe0a0, surf: 'chrome' });
      m.cyl(0.08, 0.12, 2.2, 0xffa82e, { p: [0, 1.4, 0], seg: 10, surf: 'chrome' });
      m.sph(0.44, 0xffd94d, { p: [0, 2.5, 0], glow: 1.8, top: 0xffffff, surf: 'lamp' });
      [[1, 0.14, CYAN, 0], [1.34, 0.18, CORAL, 2], [1.08, 0.1, MINT, 4]].forEach(([r, s, c, a], i) => {
        m.tor(r, 0.02, BRASS, { p: [0, 2.5, 0], r: [PH + i * 0.34, 0, i * 0.3], seg: 28, surf: 'chrome' });
        m.sph(s, c, { p: [Math.cos(a) * r, 2.5 + Math.sin(a) * r * 0.25 * i, Math.sin(a) * r], glow: 0.4, seg: 10, surf: 'paint' });
      });
    },
  };
  M.decor = (kind) => G.model('decor-' + kind, (m) => D[kind](m));

  // ---- Sites out past the fence ----
  M.rocketPad = () => G.model('rocketpad', (m) => {
    m.cyl(5.1, 5.3, 0.2, 0x5c5678, { p: [0, 0.1, 0], seg: 38, surf: 'rock' });
    m.cyl(4.9, 5, 0.26, PLAT, { p: [0, 0.3, 0], seg: 38, top: 0x6a5cc8 });
    m.tor(4.3, 0.06, GOLD, { p: [0, 0.44, 0], r: [PH, 0, 0], seg: 44, glow: 1.2, surf: 'lamp' });
    for (let i = 0; i < 32; i++) { const a = (i / 32) * PI * 2; m.box(0.8, 0.02, 0.28, i % 2 ? GOLD : 0x1c1830, { p: [Math.cos(a) * 3.7, 0.44, Math.sin(a) * 3.7], r: [0, -a + PH, 0], surf: 'paint' }); }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; m.box(1, 0.04, 0.3, i % 2 ? CORAL : W, { p: [Math.cos(a) * 2.6, 0.44, Math.sin(a) * 2.6], r: [0, -a, 0], surf: 'paint' }); }
    // Service tower.
    m.at([-3.4, 0.4, -2.2], 1, () => {
      for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]]) m.pipe([x, 0, z], [x * 0.7, 8.4, z * 0.7], 0.09, STEEL, { surf: 'metal' });
      for (let y = 1; y < 8.4; y += 1.4) {
        const k = 1 - y * 0.035;
        m.rbox(1.6 * k, 0.12, 1.6 * k, 0.04, CORAL, { p: [0, y, 0], surf: 'paint' });
        m.pipe([-0.7 * k, y, 0.7 * k], [0.7 * k, y + 1.3, 0.7 * k], 0.03, IRON, { surf: 'dark' });
        m.pipe([0.7 * k, y, 0.7 * k], [0.7 * k, y + 1.3, -0.7 * k], 0.03, IRON, { surf: 'dark' });
      }
      m.pipe([0.4, 6.6, 0.4], [2.2, 6.6, 1.6], 0.12, STEEL, { surf: 'metal' });
      antenna(m, 0, 8.4, 0, 1, MINT);
    });
  });

  M.rocket = () => G.model('rocket', (m) => {
    m.lathe([[0.9, 0.4], [1.36, 0.9], [1.68, 2.2], [1.72, 3.7], [1.6, 5], [1.3, 6.3], [1.24, 6.6]], W, { seg: 24, top: 0xffffff, surf: 'paint' });
    m.lathe([[1.24, 6.6], [1.1, 7.2], [0.74, 8], [0.3, 8.5], [0, 8.6]], CORAL, { seg: 22, top: 0xffb0a0, surf: 'paint' });
    for (let i = 0; i < 5; i++) m.tor(1.73 - Math.abs(i - 1) * 0.12, 0.014, SEAM, { p: [0, 2.2 + i * 0.9, 0], r: [PH, 0, 0], surf: 'dark', seg: 30 });
    rivets(m, 0, 0, 2.3, 1.72, 26, 0.03);
    rivets(m, 0, 0, 5.05, 1.58, 26, 0.03);
    m.tor(1.26, 0.09, CORAL, { p: [0, 6.6, 0], r: [PH, 0, 0], seg: 28, surf: 'paint' });
    m.tor(1.72, 0.09, MINT, { p: [0, 4.3, 0], r: [PH, 0, 0], seg: 28, glow: 0.8, surf: 'lamp' });
    port(m, [1.05, 5.5, 1.05], 0.46, 'z'); port(m, [1.66, 3.5, 0.4], 0.32, 'x'); port(m, [0.4, 3.5, 1.66], 0.32, 'z');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      m.rbox(1.5, 2, 0.2, 0.08, CORAL, { p: [Math.cos(a) * 1.76, 1.4, Math.sin(a) * 1.76], r: [0, -a, 0], top: 0xffb0a0, surf: 'paint' });
    }
    m.cyl(0.8, 1.2, 0.7, IRON, { p: [0, 0.32, 0], seg: 18, surf: 'dark' });
    m.cyl(0.62, 0.62, 0.08, 0xff9d3d, { p: [0, -0.02, 0], seg: 18, glow: 2.2, surf: 'lamp', bevel: 0 });
  });

  M.road = () => G.model('roadlamp', (m) => {
    m.cyl(0.11, 0.15, 0.1, IRON, { p: [0, 0.05, 0], seg: 8, surf: 'dark' });
    m.cyl(0.04, 0.07, 1.4, STEEL, { p: [0, 0.74, 0], seg: 6, surf: 'metal', bevel: 0 });
    m.sph(0.14, MINT, { p: [0, 1.52, 0], seg: 8, glow: 2, surf: 'lamp' });
    m.dome(0.16, IRON, { p: [0, 1.6, 0], s: [1, 0.4, 1], seg: 10, surf: 'dark' });
  });

  M.mine = () => G.model('mine', (m) => {
    [[0, 1.5, -1.6, 4.2, 1], [-3.3, 1, -0.6, 2.9, 2], [3.2, 1, -0.8, 3.1, 3], [-1.4, 3.6, -2.4, 2.4, 4], [1.6, 3.2, -2.2, 2.4, 5]].forEach(([x, y, z, r, k]) => m.blob(r, 0x5e4f9c, { p: [x, y, z], detail: 3, lump: 0.22, freq: 2.2, seed: k, facets: true, s: [1.15, 0.8, 1], top: 0xa090dc, surf: 'rock' }));
    [[-2.6, 3.4, -0.6], [2.4, 3.2, -0.2], [0.3, 5.6, -1.4]].forEach(([x, y, z], i) => m.octa(0.48, i === 1 ? PINK : CYAN, { p: [x, y, z], s: [0.7, 1.7, 0.7], r: [0, 0.4, i * 0.3 - 0.2], glow: 0.7, top: 0xffffff, surf: 'crystal' }));
    m.rbox(3.5, 3.2, 1.6, 0.3, 0x120a28, { p: [0, 1.6, 1.2], surf: 'rubber' });
    m.rbox(0.42, 3.4, 0.42, 0.08, TIMBER, { p: [-1.86, 1.7, 2], surf: 'wood' }); m.rbox(0.42, 3.4, 0.42, 0.08, TIMBER, { p: [1.86, 1.7, 2], surf: 'wood' });
    m.rbox(4.3, 0.46, 0.46, 0.08, 0x8a5c3c, { p: [0, 3.42, 2], surf: 'wood' });
    m.box(0.14, 0.05, 6, STEEL, { p: [-0.6, 0.06, 4], surf: 'metal' }); m.box(0.14, 0.05, 6, STEEL, { p: [0.6, 0.06, 4], surf: 'metal' });
    for (let i = 0; i < 9; i++) m.box(1.7, 0.05, 0.22, 0x8a5c3c, { p: [0, 0.03, 1.3 + i * 0.7], surf: 'wood' });
    m.at([0, 0.1, 4.6], 1, () => {
      m.rbox(1.4, 0.8, 1.6, 0.14, 0x6a6488, { p: [0, 0.8, 0], surf: 'metal' });
      [[-0.3, 0.1, -0.3], [0.3, 0.1, 0.2], [0, 0.26, 0]].forEach(([x, y, z]) => m.octa(0.34, GOLD, { p: [x, 1.1 + y, z], glow: 0.5, surf: 'crystal' }));
      [[-0.7, 0.5], [0.7, 0.5], [-0.7, -0.5], [0.7, -0.5]].forEach(([x, z]) => m.cyl(0.24, 0.24, 0.1, IRON, { p: [x, 0.26, z], r: [0, 0, PH], seg: 12, surf: 'dark' }));
    });
    m.sph(0.26, LAMP, { p: [-1.5, 3, 2.5], seg: 8, glow: 2, surf: 'lamp' }); m.sph(0.26, LAMP, { p: [1.5, 3, 2.5], seg: 8, glow: 2, surf: 'lamp' });
  });

  M.dock = () => G.model('dock', (m) => {
    for (let i = 0; i < 11; i++) m.rbox(3, 0.14, 0.6, 0.04, i % 3 ? TIMBER : 0x98704a, { p: [0, 0.36, -3 + i * 0.68], top: 0xd8a878, surf: 'wood' });
    for (let i = 0; i < 5; i++) {
      const z = -2.8 + i * 1.7;
      m.cyl(0.14, 0.14, 1.4, 0x6a4a34, { p: [-1.4, 0.2, z], seg: 8, surf: 'wood' });
      m.cyl(0.14, 0.14, 1.4, 0x6a4a34, { p: [1.4, 0.2, z], seg: 8, surf: 'wood' });
    }
    m.pipe([-1.4, 1, 3.8], [-1.4, 1, -3], 0.03, MINT, { glow: 0.8, surf: 'lamp' });
    m.at([1.3, 0.4, 3.6], 1, () => {
      m.cyl(0.07, 0.1, 2, STEEL, { p: [0, 1, 0], seg: 7, surf: 'metal' });
      m.sph(0.26, LAMP, { p: [0, 2.2, 0], glow: 2, surf: 'lamp' });
    });
    m.at([-1, 0.46, 2.2], 1, () => {
      m.cyl(0.2, 0.24, 0.4, BROWN, { p: [0, 0.2, 0], seg: 10, surf: 'wood' });
      m.pipe([0, 0.4, 0], [0.9, 1.6, 1], 0.03, STEEL, { surf: 'metal' });
    });
    m.at([2.9, 0, 1.2], 1, () => {
      m.sph(1, 0xff6f5e, { p: [0, 0.35, 0], s: [0.8, 0.42, 1.5], top: 0xffb0a0, seg: 14, surf: 'paint' });
      m.rbox(0.9, 0.08, 1.8, 0.04, TIMBER, { p: [0, 0.6, 0], surf: 'wood' });
      m.cyl(0.04, 0.05, 1.3, STEEL, { p: [0, 1.2, 0], seg: 6, surf: 'metal' });
    });
  });

  // ---- Starport Town ----
  M.ruin = (id) => G.model('ruin-' + id, (m) => {
    base(m, 5.4, 5.4, 0x54486f);
    m.rbox(3.6, 1.2, 3.2, 0.2, 0x7a7498, { p: [0, 0.96, 0], top: 0x9a94b8, surf: 'rock' });
    for (const [x, z] of [[-2.2, -2], [2.2, -2], [2.2, 2], [-2.2, 2]]) m.pipe([x, 0.3, z], [x, 3.2, z], 0.06, STEEL, { surf: 'metal' });
    m.pipe([-2.2, 3, -2], [2.2, 3, -2], 0.05, STEEL, { surf: 'metal' }); m.pipe([2.2, 3, -2], [2.2, 3, 2], 0.05, STEEL, { surf: 'metal' }); m.pipe([-2.2, 2, 2], [2.2, 2, 2], 0.05, STEEL, { surf: 'metal' });
    m.rbox(3, 0.08, 2.4, 0.04, CORAL, { p: [0, 1.66, 0], r: [0.1, 0, 0.1], top: 0xffb0a0, surf: 'fabric' });
    crate(m, 1.8, 0.37, 2, 0.8, TIMBER, 0.3);
    m.blob(0.4, 0x8a7cc0, { p: [-1.8, 0.56, 2], detail: 2, lump: 0.3, facets: true, s: [1, 0.5, 1], surf: 'rock' });
  });

  const L = {
    diner(m) {
      m.cyl(1.6, 1.6, 4.6, 0xdfe6ff, { p: [0, 1.79, 0], r: [0, 0, PH], seg: 24, top: 0xffffff, surf: 'metal' });
      m.sph(1.6, 0xdfe6ff, { p: [2.3, 1.79, 0], s: [0.5, 1, 1], seg: 18, surf: 'metal' }); m.sph(1.6, 0xdfe6ff, { p: [-2.3, 1.79, 0], s: [0.5, 1, 1], seg: 18, surf: 'metal' });
      m.tor(1.63, 0.1, CORAL, { p: [0, 1.79, 0], r: [PH, 0, 0], s: [2.05, 1, 1], seg: 34, glow: 0.2, surf: 'paint' });
      for (let i = 0; i < 4; i++) port(m, [-1.6 + i * 1.1, 2.14, 1.42], 0.34, 'z');
      door(m, [2.2, 1.24, 0.2], 1, 1.6, CORAL, 'x');
      m.cyl(0.05, 0.05, 1.3, STEEL, { p: [-1.2, 3.84, 0], seg: 6, surf: 'metal' });
      m.octa(0.5, GOLD, { p: [-1.2, 4.74, 0], glow: 1.6, s: [1, 1, 0.3], r: [0, PI / 4, 0], surf: 'lamp' });
    },
    inn(m) {
      [[2.2, 1.5], [1.8, 1.4], [1.35, 1.3]].reduce((y, [r, h], i) => {
        tank(m, 0, 0, r, h, y, i === 1 ? 0xffd0a8 : W);
        for (let k = 0; k < 5; k++) { const a = PI / 4 + (k - 2) * 0.5; port(m, [Math.cos(a) * r, y + h / 2, Math.sin(a) * r], 0.24, k < 2 ? 'x' : 'z'); }
        return y + h;
      }, 0.36);
      m.dome(1.4, 0x8a6bff, { p: [0, 4.56, 0], s: [1, 0.6, 1], seg: 20, top: 0xc9b0ff, surf: 'paint' });
      antenna(m, 0, 5.36, 0, 0.7, GOLD);
    },
    cinema(m) {
      m.rbox(4.8, 3.2, 3.8, 0.3, 0x4a4470, { p: [0, 1.96, -0.4], top: 0x7a70b0, surf: 'dark' });
      m.rbox(5, 0.9, 1, 0.2, GOLD, { p: [0, 3.14, 1.6], top: 0xfff0b0, glow: 0.45, surf: 'paint' });
      for (let i = 0; i < 10; i++) m.sph(0.1, i % 2 ? 0xffffff : CORAL, { p: [-2.25 + i * 0.5, 3.6, 2.12], seg: 7, glow: 1.8, surf: 'lamp' });
      m.rbox(2, 2.2, 0.1, 0.06, CORAL, { p: [0, 1.36, 1.5], surf: 'paint' });
      m.rbox(0.9, 1.4, 0.1, 0.05, DK2, { p: [-1.6, 1.06, 1.56], surf: 'glass' }); m.rbox(0.9, 1.4, 0.1, 0.05, DK2, { p: [1.6, 1.06, 1.56], surf: 'glass' });
      m.octa(0.7, CYAN, { p: [0, 4.64, 0], glow: 1.1, s: [1, 1, 0.3], r: [0, PI / 4, 0], surf: 'lamp' });
    },
    spa(m) {
      m.dome(2.5, 0xa8e0f8, { p: [0, 0.36, -0.3], top: 0xeafcff, seg: 26, surf: 'glass' });
      for (let i = 0; i < 4; i++) m.tor(2.52, 0.03, STEEL, { p: [0, 0.36, -0.3], r: [0, (i * PI) / 4, 0], arc: PI, surf: 'metal', seg: 26 });
      m.tor(2.52, 0.14, W, { p: [0, 0.44, -0.3], r: [PH, 0, 0], seg: 34 });
      m.cyl(1.1, 1.14, 0.16, W, { p: [1.4, 0.44, 1.6], seg: 20, surf: 'rock' });
      m.cyl(0.96, 0.96, 0.05, 0x46d6c0, { p: [1.4, 0.54, 1.6], seg: 20, glow: 0.8, surf: 'glass' });
      [[0, 1.5, 0.8, 0.5], [-1, 1.2, 0.4, 0.4], [0.9, 1.1, 0.2, 0.42]].forEach(([x, y, z, r], i) => m.blob(r, PINK, { p: [x, y, z], detail: 2, lump: 0.2, freq: 4, seed: i, glow: 0.25, top: 0xffffff, surf: 'leaf' }));
    },
    observatory(m) {
      tank(m, 0, 0, 2, 1.8, 0.36, W);
      m.dome(2.05, 0xc8c2e4, { p: [0, 2.14, 0], seg: 26, top: 0xffffff, surf: 'metal' });
      m.rbox(0.9, 2.2, 0.4, 0.1, DK2, { p: [1, 3.04, 1], r: [0.5, PI / 4, 0], surf: 'dark' });
      m.pipe([0.3, 2.94, 0.3], [2, 4.84, 2], 0.42, 0xc9c2ea, { seg: 16, surf: 'paint' });
      m.tor(0.44, 0.09, BRASS, { p: [2, 4.84, 2], r: [0.9, 0.8, 0], seg: 18, surf: 'chrome' });
      for (let i = 0; i < 4; i++) port(m, [Math.cos(0.3 + i * 0.32) * 2.02, 1.34, Math.sin(0.3 + i * 0.32) * 2.02], 0.22, i < 2 ? 'x' : 'z');
    },
    plaza(m) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2 + 0.26;
        m.cyl(0.18, 0.24, 2.6, W, { p: [Math.cos(a) * 2.2, 1.64, Math.sin(a) * 2.2], seg: 12, surf: 'rock' });
        m.sph(0.26, GOLD, { p: [Math.cos(a) * 2.2, 3.04, Math.sin(a) * 2.2], seg: 9, glow: 1.6, surf: 'lamp' });
      }
      m.tor(2.2, 0.14, CORAL, { p: [0, 2.89, 0], r: [PH, 0, 0], seg: 36, surf: 'paint' });
      m.cyl(0.6, 1, 0.5, BRASS, { p: [0, 0.59, 0], seg: 18, surf: 'chrome' });
      m.octa(1.2, 0x8ee9ff, { p: [0, 2.34, 0], s: [0.6, 1.5, 0.6], glow: 0.7, top: 0xffffff, surf: 'crystal' });
    },
  };
  M.lot = (id) => G.model('lot-' + id, (m) => { base(m, 5.4, 5.4, 0x54488f); L[id](m); });

  // ---- Wild planet scatter ----
  M.wild = (i) => G.model('wild-' + i, (m) => {
    if (i === 0) { // bubble tree
      m.tube([[0, 0, 0], [0.04, 0.8, 0], [0.1, 1.6, 0]], [0.16, 0.11, 0.08], 0x7a5aa0, { sides: 6, surf: 'wood' });
      m.blob(1, 0xe870b0, { p: [0.1, 2.3, 0], detail: 2, lump: 0.2, freq: 3, top: 0xffc8e6, seed: 1, surf: 'leaf' });
      m.blob(0.6, 0xd85c9c, { p: [-0.6, 1.8, 0.2], detail: 2, lump: 0.2, freq: 3, top: 0xffb0d8, seed: 3, surf: 'leaf' });
    } else if (i === 1) { // cyan cap tree
      m.tube([[0, 0, 0], [-0.06, 1, 0], [-0.1, 2, 0]], [0.13, 0.09, 0.06], 0x5a7ab0, { sides: 6, surf: 'wood' });
      m.lathe([[1.24, 0], [1.1, 0.26], [0.7, 0.58], [0.2, 0.72], [0, 0.74]], 0x38c0d8, { p: [-0.1, 1.86, 0], seg: 12, top: 0xb0f8ff, glow: 0.15, surf: 'skin' });
    } else if (i === 2) { // rock
      m.blob(1, 0x7264b0, { detail: 2, lump: 0.3, freq: 2.4, facets: true, s: [1.2, 0.7, 1], top: 0xa89cdc, seed: 2, surf: 'rock' });
      m.blob(0.5, 0x6a5ca8, { p: [0.8, -0.1, 0.4], detail: 1, lump: 0.3, facets: true, top: 0x9c8ed0, seed: 4, surf: 'rock' });
    } else if (i === 3) { // crystal spire
      m.octa(0.8, 0xff8fd8, { p: [0, 1.5, 0], s: [0.55, 2.2, 0.55], top: 0xffe8f8, glow: 0.6, surf: 'crystal' });
      m.octa(0.5, 0x8ee9ff, { p: [0.6, 0.8, 0.2], s: [0.55, 1.9, 0.55], r: [0, 0, -0.3], top: 0xffffff, glow: 0.6, surf: 'crystal' });
    } else if (i === 4) { // yellow puff tree
      m.tube([[0, 0, 0], [0.1, 0.7, 0], [0.2, 1.3, 0]], [0.13, 0.09, 0.07], 0x8a5fa0, { sides: 6, surf: 'wood' });
      m.tube([[0.2, 1.2, 0], [-0.1, 1.6, 0], [-0.4, 2, 0]], [0.07, 0.05, 0.03], 0x8a5fa0, { sides: 5, surf: 'wood' });
      m.blob(0.72, 0xeec040, { p: [0.3, 2, 0], detail: 2, lump: 0.2, freq: 3, top: 0xfff0b0, seed: 5, surf: 'leaf' });
      m.blob(0.5, 0xee9c30, { p: [-0.5, 2.2, 0.1], detail: 2, lump: 0.2, freq: 3, top: 0xffe08a, seed: 7, surf: 'leaf' });
    } else { // lone mesa
      m.blob(1.7, 0x5e4f9c, { p: [0, 0.8, 0], detail: 2, lump: 0.24, freq: 2, facets: true, s: [1.1, 0.9, 1.1], top: 0xa89cdc, seed: 9, surf: 'rock' });
    }
  }, { surf: 'rock' });
})(typeof window !== 'undefined' ? window : globalThis);
