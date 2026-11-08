// Orbit Acres: the living planet. Turns the game state into a 3D scene,
// runs the camera, and works out what a tap landed on.
(function (root) {
  const OA = root.OA;
  const G = OA.Gfx;
  const T = root.THREE;
  const Sim = OA.Sim;
  const W = (OA.World = {});
  const PI = Math.PI;
  const R = G.R;
  const INNER = 48; // half-size of the detailed ground
  const LAKE = { x: 7, z: 53, r: 18 };
  const lakeR = (a) => LAKE.r * (1 + 0.14 * Math.sin(a * 3 + 1) + 0.08 * Math.sin(a * 5 + 2.2));
  const inLake = (x, z, pad = 0) => {
    const d = Math.hypot(x - LAKE.x, z - LAKE.z);
    return d < lakeR(Math.atan2(z - LAKE.z, x - LAKE.x)) + pad;
  };
  // Town lots sit around a central square.
  W.TOWN_POS = {
    diner: [-7, -6.5], inn: [0, -6.5], cinema: [7, -6.5],
    spa: [-7, 6.5], observatory: [0, 6.5], plaza: [7, 6.5],
  };
  const ROADS = [
    [[-2, -12], [-2, -24], [0, -31]],
    [[12, -6], [27, -6]],
    [[-12, 9], [-31, 9]],
    [[7, 12], [7, 33]],
  ];

  let renderer, scene, overlay, camera, sun, hemi;
  let world, things, sites, ground, groundTex, bgMat, stars, core, atmo, ring, ringMat, lake;
  let bubbleSys, partSys, blobSys;
  let pixelRatio = 1;
  // How many pixels a frame gets when the processor draws in software: about 1270 by 650
  // on a large screen, which a fast desktop processor can draw sixty times a second.
  const SOFT_PIXELS = 800000;
  let elapsed = 0;
  let needShadow = true;

  const cam = (W.cam = { fx: -1, fz: 0, d: 46, tfx: -1, tfz: 0, td: 46, vx: 0, vz: 0, yaw: PI / 4, pitch: 0.9, anim: null });
  W.DIST = { near: 20, home: 46, far: 170 };
  const clampFocus = () => {
    const m = 54;
    const len = Math.hypot(cam.tfx, cam.tfz);
    if (len > m) { cam.tfx *= m / len; cam.tfz *= m / len; }
  };

  // ---- Soft-edged textures ----
  const softTexture = (stops, size = 128) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([p, col]) => g.addColorStop(p, col));
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
    return new T.CanvasTexture(c);
  };

  // ---- Sky: painted once, then drifts a little as you pan ----
  const paintSky = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 1024, 1024);
    g.addColorStop(0, '#0d0a33');
    g.addColorStop(0.5, '#1c0f4d');
    g.addColorStop(1, '#0a1a4a');
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 1024);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    x.globalCompositeOperation = 'lighter';
    const tints = ['255,60,170', '60,220,230', '130,90,255', '255,150,90'];
    for (let i = 0; i < 90; i++) {
      const t = rnd();
      const px = t * 1024 + (rnd() - 0.5) * 320, py = 1024 - t * 1024 + (rnd() - 0.5) * 360;
      const r = 50 + rnd() * 190;
      const gr = x.createRadialGradient(px, py, 0, px, py, r);
      const c0 = tints[Math.floor(rnd() * tints.length)];
      gr.addColorStop(0, 'rgba(' + c0 + ',' + (0.04 + rnd() * 0.07) + ')');
      gr.addColorStop(1, 'rgba(' + c0 + ',0)');
      x.fillStyle = gr;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    for (let i = 0; i < 1500; i++) {
      const b = rnd();
      x.fillStyle = 'rgba(' + (200 + rnd() * 55 | 0) + ',' + (200 + rnd() * 55 | 0) + ',255,' + (0.15 + b * b * 0.85) + ')';
      const s = b > 0.97 ? 2.2 : b > 0.8 ? 1.4 : 0.9;
      x.beginPath();
      x.arc(rnd() * 1024, rnd() * 1024, s, 0, 7);
      x.fill();
    }
    // A ringed giant hanging over the colony.
    x.globalCompositeOperation = 'source-over';
    const px = 790, py = 215, pr = 118;
    const glow = x.createRadialGradient(px, py, pr * 0.7, px, py, pr * 1.9);
    glow.addColorStop(0, 'rgba(255,150,120,.28)');
    glow.addColorStop(1, 'rgba(255,150,120,0)');
    x.fillStyle = glow;
    x.fillRect(px - 300, py - 300, 600, 600);
    x.save();
    x.translate(px, py);
    x.rotate(-0.42);
    const ringDraw = (front) => {
      x.save();
      x.beginPath();
      x.rect(-400, front ? 0 : -400, 800, 400);
      x.clip();
      for (let i = 0; i < 16; i++) {
        x.strokeStyle = 'rgba(' + (255 - i * 4) + ',' + (205 - i * 3) + ',' + (170 + i * 3) + ',' + (0.09 + (i % 3) * 0.1) + ')';
        x.lineWidth = 4;
        x.beginPath();
        x.ellipse(0, 0, pr * (1.4 + i * 0.07), pr * (0.28 + i * 0.016), 0, 0, 7);
        x.stroke();
      }
      x.restore();
    };
    ringDraw(false);
    x.save();
    x.beginPath();
    x.arc(0, 0, pr, 0, 7);
    x.clip();
    const body = x.createLinearGradient(-pr, -pr, pr, pr);
    body.addColorStop(0, '#ffc78f');
    body.addColorStop(0.5, '#f0719b');
    body.addColorStop(1, '#5a2a8a');
    x.fillStyle = body;
    x.fillRect(-pr, -pr, pr * 2, pr * 2);
    for (let i = 0; i < 12; i++) {
      x.fillStyle = 'rgba(255,255,255,' + (0.02 + (i % 4) * 0.022) + ')';
      x.fillRect(-pr, -pr + i * 21 + 4, pr * 2, 7 + (i % 3) * 5);
    }
    const shade = x.createRadialGradient(-pr * 0.4, -pr * 0.4, pr * 0.3, -pr * 0.1, -pr * 0.1, pr * 1.5);
    shade.addColorStop(0, 'rgba(10,5,40,0)');
    shade.addColorStop(1, 'rgba(10,5,40,.82)');
    x.fillStyle = shade;
    x.fillRect(-pr, -pr, pr * 2, pr * 2);
    x.restore();
    ringDraw(true);
    x.restore();
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.MirroredRepeatWrapping;
    return tex;
  };

  const initSky = () => {
    const hdr = G.Q.pbr ? 'c = pow(c, vec3(2.2)) * 1.1;' : '';
    bgMat = new T.ShaderMaterial({
      depthWrite: false,
      uniforms: { t: { value: paintSky() }, uOff: { value: new T.Vector2() }, uScale: { value: new T.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: 'uniform sampler2D t; uniform vec2 uOff; uniform vec2 uScale; varying vec2 vUv; void main(){ vec3 c = texture2D(t, (vUv - 0.5) * uScale + 0.5 + uOff).rgb; ' + hdr + ' gl_FragColor = vec4(c, 1.0); }',
    });
    const sky = new T.Mesh(new T.PlaneGeometry(2, 2), bgMat);
    sky.frustumCulled = false;
    scene.add(sky);
    // A few stars that actually twinkle.
    const n = 140;
    const pos = new Float32Array(n * 3);
    const ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = OA.rand(-1, 1); pos[i * 3 + 1] = OA.rand(-1, 1); pos[i * 3 + 2] = 1; ph[i] = OA.rand(0, 7); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('aPh', new T.BufferAttribute(ph, 1));
    stars = new T.Points(g, new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uTime: G.U.uTime, uPx: { value: 1 } },
      vertexShader: 'attribute float aPh; uniform float uTime; uniform float uPx; varying float vA; void main(){ vA = 0.45 + 0.55 * sin(uTime * 1.6 + aPh * 3.0); gl_PointSize = uPx * (1.5 + 2.0 * fract(aPh * 3.3)); gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(' + (G.Q.pbr ? '1.6, 1.7, 2.0' : '0.85, 0.9, 1.0') + ', vA * smoothstep(0.5, 0.05, d)); }',
    }));
    stars.frustumCulled = false;
    scene.add(stars);
  };

  // ---- Ground ----
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const sstep = (a, b, v) => { const t = OA.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const wildColor = (x, z) => {
    const n = OA.fbm(x * 0.06 + 3, z * 0.06 + 8, 4);
    const m = OA.fbm(x * 0.11 + 40, z * 0.11 + 11, 3);
    let c = mix([104, 90, 172], [148, 128, 214], sstep(0.28, 0.68, n));
    c = mix(c, [64, 172, 170], sstep(0.5, 0.66, m) * 0.75);
    // Sandy rim around the Star Sea.
    if (inLake(x, z, 3.5)) c = mix(c, [255, 214, 196], 0.85);
    return c;
  };
  const wildHeight = (x, z) => {
    const d = Math.max(Math.abs(x), Math.abs(z));
    const e = sstep(INNER - 2, INNER + 22, d);
    let h = (OA.fbm(x * 0.045 + 5, z * 0.045 + 2, 4) - 0.42) * 15 * e;
    if (inLake(x, z, 4)) h = Math.min(h, -0.15);
    return Math.max(-0.3, h);
  };

  const roundRect = (x, l, t, w, h, r) => {
    x.beginPath();
    x.moveTo(l + r, t);
    x.arcTo(l + w, t, l + w, t + h, r);
    x.arcTo(l + w, t + h, l, t + h, r);
    x.arcTo(l, t + h, l, t, r);
    x.arcTo(l, t, l + w, t, r);
    x.closePath();
  };
  const paintGround = () => {
    const S = Sim.state();
    const size = G.Q.ground;
    const c = groundTex ? groundTex.image : document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const k = size / (INNER * 2);
    const tx = (v) => (v + INNER) * k;

    // Wild ground, shared with the outer planet so there is no seam.
    const low = document.createElement('canvas');
    low.width = low.height = 256;
    const lx = low.getContext('2d');
    const img = lx.createImageData(256, 256);
    for (let j = 0; j < 256; j++) {
      for (let i = 0; i < 256; i++) {
        const col = wildColor((i / 255) * INNER * 2 - INNER, (j / 255) * INNER * 2 - INNER);
        const o = (j * 256 + i) * 4;
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    lx.putImageData(img, 0, 0);
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    x.drawImage(low, 0, 0, size, size);

    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    // Dust, flecks and craters on the wild ground.
    for (let i = 0; i < 2600; i++) {
      x.fillStyle = rnd() > 0.5 ? 'rgba(224,214,255,.16)' : 'rgba(40,26,92,.2)';
      x.beginPath();
      x.ellipse(rnd() * size, rnd() * size, (0.08 + rnd() * 0.3) * k, (0.05 + rnd() * 0.16) * k, rnd() * 3, 0, 7);
      x.fill();
    }
    for (let i = 0; i < 110; i++) {
      const px = rnd() * size, py = rnd() * size, r = (0.7 + rnd() * rnd() * 4.8) * k;
      const pit = x.createRadialGradient(px, py - r * 0.15, r * 0.1, px, py, r);
      pit.addColorStop(0, 'rgba(34,20,84,.42)');
      pit.addColorStop(0.75, 'rgba(34,20,84,.24)');
      pit.addColorStop(1, 'rgba(34,20,84,0)');
      x.fillStyle = pit;
      x.beginPath(); x.ellipse(px, py, r, r * 0.86, 0, 0, 7); x.fill();
      x.strokeStyle = 'rgba(226,216,255,.34)';
      x.lineWidth = Math.max(1, r * 0.1);
      x.beginPath(); x.ellipse(px, py + r * 0.04, r, r * 0.86, 0, 0.2, 3.3); x.stroke();
    }

    // The claimed land grows thick moss.
    const lush = document.createElement('canvas');
    lush.width = lush.height = size;
    const u = lush.getContext('2d');
    u.fillStyle = '#26877a';
    u.fillRect(0, 0, size, size);
    const patch = (count, r0, r1, cols, a) => {
      for (let i = 0; i < count; i++) {
        const px = rnd() * size, py = rnd() * size, r = (r0 + rnd() * (r1 - r0)) * k;
        const gr = u.createRadialGradient(px, py, 0, px, py, r);
        const col = cols[Math.floor(rnd() * cols.length)];
        gr.addColorStop(0, 'rgba(' + col + ',' + a + ')');
        gr.addColorStop(1, 'rgba(' + col + ',0)');
        u.fillStyle = gr;
        u.fillRect(px - r, py - r, r * 2, r * 2);
      }
    };
    patch(170, 4, 11, ['52,170,140', '30,120,118', '84,190,146', '26,104,112'], 0.5);
    patch(900, 0.9, 3.2, ['72,190,150', '34,134,124', '118,206,150', '22,96,104', '150,214,140'], 0.42);
    patch(2600, 0.2, 0.75, ['110,214,160', '24,102,108', '170,226,150', '18,84,96'], 0.5);
    for (let i = 0; i < 9000; i++) {
      u.fillStyle = rnd() > 0.5 ? 'rgba(186,250,196,.32)' : 'rgba(12,70,84,.36)';
      u.beginPath();
      u.ellipse(rnd() * size, rnd() * size, (0.03 + rnd() * 0.06) * k, (0.02 + rnd() * 0.04) * k, rnd() * 3, 0, 7);
      u.fill();
    }
    const mask = document.createElement('canvas');
    mask.width = mask.height = INNER * 2;
    const mk = mask.getContext('2d');
    mk.fillStyle = '#fff';
    for (let j = 0; j < INNER * 2; j++) {
      for (let i = 0; i < INNER * 2; i++) {
        const px = i - INNER + 0.5, pz = j - INNER + 0.5;
        const wx = px + (OA.fbm(px * 0.22, pz * 0.22, 3) - 0.48) * 3.4;
        const wz = pz + (OA.fbm(px * 0.22 + 31, pz * 0.22 + 17, 3) - 0.48) * 3.4;
        if (Sim.owned(Math.floor(wx), Math.floor(wz))) mk.fillRect(i, j, 1, 1);
      }
    }
    u.globalCompositeOperation = 'destination-in';
    u.imageSmoothingEnabled = true;
    u.drawImage(mask, 0, 0, size, size);
    x.drawImage(lush, 0, 0);

    // Cobbled roads.
    const road = (pts, w) => {
      x.lineCap = x.lineJoin = 'round';
      x.strokeStyle = 'rgba(30,18,78,.5)';
      x.lineWidth = (w + 0.9) * k;
      x.beginPath();
      pts.forEach(([a, b], i) => (i ? x.lineTo(tx(a), tx(b)) : x.moveTo(tx(a), tx(b))));
      x.stroke();
      x.strokeStyle = '#514490';
      x.lineWidth = (w + 0.3) * k;
      x.stroke();
      for (let i = 0; i < pts.length - 1; i++) {
        const [a, b] = pts[i], [p, q] = pts[i + 1];
        const len = Math.hypot(p - a, q - b);
        const dx = (p - a) / len, dz = (q - b) / len;
        const ang = Math.atan2(dz, dx);
        for (let t = 0; t < len; t += 0.5) {
          const row = Math.round(t / 0.5);
          for (let col = -1; col <= 1; col++) {
            const off = col * 0.66 + (row % 2 ? 0.22 : -0.22) + (rnd() - 0.5) * 0.05;
            const px = a + dx * t - dz * off, pz = b + dz * t + dx * off;
            const L = 56 + rnd() * 20;
            x.fillStyle = 'hsl(' + (246 + rnd() * 16) + ',' + (20 + rnd() * 14) + '%,' + L + '%)';
            x.save();
            x.translate(tx(px), tx(pz));
            x.rotate(ang + (rnd() - 0.5) * 0.12);
            roundRect(x, -0.29 * k, -0.28 * k, (0.5 + rnd() * 0.08) * k, 0.56 * k, 0.09 * k);
            x.fill();
            x.restore();
          }
        }
      }
    };
    ROADS.forEach((p) => road(p, 2));

    // Town square.
    const t = OA.SITES.town;
    x.fillStyle = 'rgba(30,18,78,.5)';
    x.fillRect(tx(t.x - 11.6), tx(t.z - 10.6), 23.2 * k, 21.2 * k);
    x.fillStyle = '#4f4290';
    x.fillRect(tx(t.x - 11.2), tx(t.z - 10.2), 22.4 * k, 20.4 * k);
    for (let i = 0; i < 22; i++) {
      for (let j = 0; j < 20; j++) {
        x.fillStyle = 'hsl(' + (250 + rnd() * 12) + ',' + (20 + rnd() * 14) + '%,' + (66 + rnd() * 14) + '%)';
        roundRect(x, tx(t.x - 11 + i) + 0.04 * k, tx(t.z - 10 + j) + 0.04 * k, 0.92 * k, 0.92 * k, 0.08 * k);
        x.fill();
      }
    }
    x.fillStyle = '#d99a2e';
    x.beginPath(); x.arc(tx(t.x), tx(t.z), 2.4 * k, 0, 7); x.fill();
    x.fillStyle = '#ffcf5c';
    x.beginPath(); x.arc(tx(t.x), tx(t.z), 2.2 * k, 0, 7); x.fill();
    x.fillStyle = '#c9bff0';
    x.beginPath(); x.arc(tx(t.x), tx(t.z), 1.85 * k, 0, 7); x.fill();

    if (!groundTex) {
      groundTex = new T.CanvasTexture(c);
      groundTex.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
      groundTex.minFilter = T.LinearMipmapLinearFilter;
      if (G.Q.linear) groundTex.encoding = T.sRGBEncoding;
    }
    groundTex.needsUpdate = true;
  };

  const initGround = () => {
    paintGround();
    const g = new T.PlaneGeometry(INNER * 2, INNER * 2, INNER, INNER);
    g.rotateX(-PI / 2);
    G.mat.ground.map = groundTex;
    ground = new T.Mesh(g, G.mat.ground);
    ground.receiveShadow = true;
    ground.frustumCulled = false;
    scene.add(ground);

    // The rest of the planet, coarser and hilly.
    const step = 3, E = 138;
    const cols = Math.ceil((E * 2) / step) + 1;
    const pos = [], col = [], idx = [];
    const id = (i, j) => j * cols + i;
    for (let j = 0; j < cols; j++) {
      for (let i = 0; i < cols; i++) {
        const x = -E + i * step, z = -E + j * step;
        pos.push(x, wildHeight(x, z) - (Math.max(Math.abs(x), Math.abs(z)) <= INNER + 0.1 ? 0.2 : 0), z);
        const c = wildColor(x, z);
        const lin = (v) => (G.Q.linear ? Math.pow(v / 255, 2.2) : v / 255);
        col.push(lin(c[0]), lin(c[1]), lin(c[2]));
      }
    }
    for (let j = 0; j < cols - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const x = -E + i * step, z = -E + j * step;
        if (Math.abs(x + step / 2) < INNER - step && Math.abs(z + step / 2) < INNER - step) continue;
        idx.push(id(i, j), id(i, j + 1), id(i + 1, j), id(i + 1, j), id(i, j + 1), id(i + 1, j + 1));
      }
    }
    const og = new T.BufferGeometry();
    og.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    og.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    og.setIndex(idx);
    og.computeVertexNormals();
    const outer = new T.Mesh(og, G.mat.terrain);
    outer.frustumCulled = false;
    outer.receiveShadow = false;
    W.outer = outer;
    scene.add(outer);

    // Solid core so nothing shows through on the far side.
    core = new T.Mesh(new T.SphereGeometry(R - 0.6, 36, 24), new T.MeshBasicMaterial({ color: 0x3a2f7a }));
    scene.add(core);

    // Atmosphere halo behind the planet.
    const halo = softTexture([[0, 'rgba(90,216,255,0)'], [0.56, 'rgba(90,216,255,0)'], [0.62, 'rgba(120,230,255,.75)'], [0.7, 'rgba(120,150,255,.28)'], [1, 'rgba(120,120,255,0)']], 512);
    atmo = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: halo, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    atmo.renderOrder = -2;
    atmo.frustumCulled = false;
    scene.add(atmo);

    // Rings: only seen from far out.
    const rc = document.createElement('canvas');
    rc.width = 512; rc.height = 8;
    const rx = rc.getContext('2d');
    for (let i = 0; i < 512; i++) {
      const a = 0.25 + 0.5 * OA.noise(i * 0.03, 2) + 0.2 * OA.noise(i * 0.2, 5);
      const edge = sstep(0, 40, i) * sstep(512, 460, i);
      rx.fillStyle = 'rgba(' + (190 + i / 12 | 0) + ',' + (200 - i / 14 | 0) + ',255,' + a * edge + ')';
      rx.fillRect(i, 0, 1, 8);
    }
    const rt = new T.CanvasTexture(rc);
    const rg = new T.RingGeometry(R * 1.34, R * 1.86, 96, 1);
    const rp = rg.attributes.position, ruv = rg.attributes.uv;
    for (let i = 0; i < rp.count; i++) {
      const len = Math.hypot(rp.getX(i), rp.getY(i));
      ruv.setXY(i, (len - R * 1.34) / (R * 0.52), 0.5);
    }
    ringMat = new T.MeshBasicMaterial({ map: rt, transparent: true, side: T.DoubleSide, depthWrite: false, opacity: 0 });
    ring = new T.Mesh(rg, ringMat);
    ring.frustumCulled = false;
    scene.add(ring);

    initLake();
    scatter();
  };

  const initLake = () => {
    const pts = 120;
    const verts = [LAKE.x, 0, LAKE.z];
    const idx = [];
    const rings = 7;
    for (let r = 1; r <= rings; r++) {
      for (let i = 0; i < pts; i++) {
        const a = (i / pts) * PI * 2;
        const rr = lakeR(a) * (r / rings);
        verts.push(LAKE.x + Math.cos(a) * rr, 0, LAKE.z + Math.sin(a) * rr);
      }
    }
    const at = (r, i) => (r === 0 ? 0 : 1 + (r - 1) * pts + (i % pts));
    for (let r = 0; r < rings; r++) {
      for (let i = 0; i < pts; i++) {
        if (r === 0) idx.push(0, at(1, i + 1), at(1, i));
        else idx.push(at(r, i), at(r, i + 1), at(r + 1, i), at(r, i + 1), at(r + 1, i + 1), at(r + 1, i));
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    const m = new T.ShaderMaterial({
      uniforms: G.U,
      vertexShader: G.BEND_GLSL + '\nvarying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; w.y = 0.12; gl_Position = projectionMatrix * viewMatrix * oaBend(w); }',
      fragmentShader: `
        uniform float uTime; uniform vec3 uAtmo; uniform float uNight; varying vec2 vP; varying float vAng;
        float wave(vec2 p) {
          return sin(p.x * 0.9 + uTime * 0.7) + sin(p.y * 1.1 - uTime * 0.5) + sin((p.x + p.y) * 0.6 + uTime * 0.4)
            + 0.5 * sin(p.x * 2.3 + p.y * 1.7 + uTime * 1.3) + 0.35 * sin(p.y * 3.1 - p.x * 2.1 - uTime * 1.1);
        }
        void main(){
          float w = wave(vP);
          vec2 g = vec2(wave(vP + vec2(0.08, 0.0)) - w, wave(vP + vec2(0.0, 0.08)) - w) * 3.0;
          vec3 n = normalize(vec3(-g.x * 0.28, 1.0, -g.y * 0.28));
          vec3 v = normalize(vec3(0.5, 0.75, 0.5));
          vec3 c = mix(vec3(0.05, 0.13, 0.62), vec3(0.16, 0.80, 0.78), clamp(0.5 + 0.13 * w, 0.0, 1.0));
          c = mix(c, vec3(0.86, 0.24, 0.74), smoothstep(0.55, 1.0, sin(vP.x * 0.22 + vP.y * 0.31 + uTime * 0.2)) * 0.45);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          c = mix(c, vec3(0.55, 0.62, 1.1), fres * 0.7);
          vec3 h = normalize(normalize(vec3(-0.45, 0.8, 0.3)) + v);
          c += pow(max(dot(n, h), 0.0), 220.0) * vec3(3.2, 3.0, 3.4);
          float s = sin(vP.x * 2.3 + sin(vP.y * 1.3) * 2.0 + uTime) * sin(vP.y * 2.1 + sin(vP.x * 0.9) * 2.0 - uTime * 0.8);
          c += pow(max(0.0, s), 16.0) * vec3(1.0, 0.9, 1.0) * 1.1;
          c *= 0.9 + 0.3 * uNight;
          float limb = smoothstep(0.7, 1.75, vAng);
          c = mix(c, c * 0.55 + uAtmo * 0.28, limb);
          gl_FragColor = vec4(${G.Q.pbr ? 'c' : 'pow(c, vec3(0.6))'}, 1.0);
        }`,
    });
    lake = new T.Mesh(g, m);
    lake.frustumCulled = false;
    scene.add(lake);
  };

  const scatter = () => {
    const tmp = new T.Object3D();
    const kinds = [
      { i: 0, n: 90, s: [0.9, 1.5] }, { i: 1, n: 80, s: [0.9, 1.6] }, { i: 2, n: 110, s: [0.8, 2.2] },
      { i: 3, n: 80, s: [0.8, 1.7] }, { i: 4, n: 70, s: [0.9, 1.5] }, { i: 5, n: 30, s: [1.2, 2.4] },
    ];
    let seed = 21;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const free = (x, z) => {
      if (Math.max(Math.abs(x), Math.abs(z)) < OA.LAND_EDGE + 1.5) return false;
      if (inLake(x, z, 2)) return false;
      for (const k in OA.SITES) {
        const s = OA.SITES[k];
        const r = k === 'town' ? 16 : s.r + 3;
        if (Math.hypot(x - s.x, z - s.z) < r) return false;
      }
      for (const road of ROADS) {
        for (let i = 0; i < road.length - 1; i++) {
          const [a, b] = road[i], [c, d] = road[i + 1];
          const len = Math.hypot(c - a, d - b);
          for (let t = 0; t <= len; t += 2) {
            const px = a + ((c - a) * t) / len, pz = b + ((d - b) * t) / len;
            if (Math.hypot(x - px, z - pz) < 2.6) return false;
          }
        }
      }
      return true;
    };
    kinds.forEach((k) => {
      const count = Math.round(k.n * G.Q.scatter);
      const inst = new T.InstancedMesh(G.M.wild(k.i), G.mat.soft, count);
      inst.frustumCulled = false;
      inst.castShadow = false;
      inst.receiveShadow = false;
      let n = 0;
      for (let tries = 0; tries < count * 8 && n < count; tries++) {
        const near = rnd() < 0.55;
        const a = rnd() * PI * 2;
        const r = near ? 30 + rnd() * 40 : 60 + rnd() * 70;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (!free(x, z)) continue;
        const s = OA.lerp(k.s[0], k.s[1], rnd());
        tmp.position.set(x, wildHeight(x, z) - 0.05, z);
        tmp.rotation.set(0, rnd() * 6.28, 0);
        tmp.scale.setScalar(s);
        tmp.updateMatrix();
        inst.setMatrixAt(n++, tmp.matrix);
      }
      inst.count = n;
      inst.instanceMatrix.needsUpdate = true;
      scene.add(inst);
    });
  };

  // ---- Billboards: bubbles above things, drawn from the sticker sheet ----
  const initBubbles = () => {
    const MAX = 160;
    const g = new T.InstancedBufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const iPos = new T.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    const iSize = new T.InstancedBufferAttribute(new Float32Array(MAX), 1);
    const iUV = new T.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
    g.setAttribute('iPos', iPos); g.setAttribute('iSize', iSize); g.setAttribute('iUV', iUV);
    g.instanceCount = 0;
    const mat = new T.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: Object.assign({}, G.U, { map: { value: null } }),
      vertexShader: G.BEND_GLSL + `
        attribute vec3 iPos; attribute float iSize; attribute vec4 iUV; varying vec2 vUv;
        void main(){
          vec4 b = oaBend(vec4(iPos, 1.0));
          vec4 mv = viewMatrix * b;
          mv.xy += position.xy * iSize;
          gl_Position = projectionMatrix * mv;
          vUv = iUV.xy + uv * iUV.zw;
        }`,
      fragmentShader: `
        uniform sampler2D map; varying vec2 vUv; varying float vAng;
        void main(){
          vec4 c = texture2D(map, vUv);
          c.a *= 1.0 - smoothstep(1.25, 1.42, vAng);
          if (c.a < 0.02) discard;
          gl_FragColor = c;
        }`,
    });
    const mesh = new T.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 20;
    overlay.add(mesh);
    bubbleSys = {
      mesh, mat, n: 0, MAX,
      add(x, y, z, size, icon) {
        const uv = OA.Icons.uv(icon);
        if (!uv || this.n >= MAX) return;
        const i = this.n++;
        iPos.setXYZ(i, x, y, z);
        iSize.setX(i, size);
        iUV.setXYZW(i, uv[0], uv[1], uv[2], uv[3]);
      },
      end() {
        g.instanceCount = this.n;
        iPos.needsUpdate = iSize.needsUpdate = iUV.needsUpdate = true;
        this.n = 0;
      },
    };
  };

  // ---- Particles ----
  const initParticles = () => {
    const MAX = 600;
    const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 4), size = new Float32Array(MAX);
    const p = [];
    for (let i = 0; i < MAX; i++) p.push({ life: 0 });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('aCol', new T.BufferAttribute(col, 4));
    g.setAttribute('aSize', new T.BufferAttribute(size, 1));
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: Object.assign({}, G.U, { uPx: { value: 300 } }),
      vertexShader: G.BEND_GLSL + `
        attribute vec4 aCol; attribute float aSize; uniform float uPx; varying vec4 vC;
        void main(){
          vec4 b = oaBend(vec4(position, 1.0));
          vec4 mv = viewMatrix * b;
          vC = aCol;
          gl_PointSize = aSize * uPx / max(1.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec4 vC;
        void main(){
          vec2 q = gl_PointCoord - 0.5;
          float d = length(q);
          float star = max(0.0, 0.5 - (abs(q.x) * abs(q.y) * 18.0 + d * 0.9));
          float a = smoothstep(0.5, 0.0, d) * 0.6 + star * 1.6;
          gl_FragColor = vec4(vC.rgb * ${G.Q.pbr ? '3.0' : '1.0'}, vC.a * a);
        }`,
    });
    const mesh = new T.Points(g, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 15;
    scene.add(mesh);
    let cursor = 0;
    const color = new T.Color();
    partSys = {
      mat,
      spawn(x, y, z, o) {
        const q = p[cursor];
        cursor = (cursor + 1) % MAX;
        color.setHex(o.color === undefined ? 0xffffff : o.color);
        q.x = x; q.y = y; q.z = z;
        q.vx = o.vx || 0; q.vy = o.vy || 0; q.vz = o.vz || 0;
        q.g = o.g === undefined ? 4 : o.g;
        q.life = q.max = o.life || 1;
        q.size = o.size || 0.5;
        q.r = color.r; q.gc = color.g; q.b = color.b;
      },
      update(dt) {
        let alive = 0;
        for (let i = 0; i < MAX; i++) {
          const q = p[i];
          if (q.life > 0) {
            q.life -= dt;
            q.vy -= q.g * dt;
            q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
            if (q.y < 0.05 && q.g > 0) { q.y = 0.05; q.vy *= -0.4; }
          }
          const on = q.life > 0;
          const a = on ? Math.min(1, (q.life / q.max) * 2) : 0;
          pos[i * 3] = on ? q.x : 0; pos[i * 3 + 1] = on ? q.y : -500; pos[i * 3 + 2] = on ? q.z : 0;
          col[i * 4] = q.r || 0; col[i * 4 + 1] = q.gc || 0; col[i * 4 + 2] = q.b || 0; col[i * 4 + 3] = a;
          size[i] = on ? q.size * (0.6 + 0.6 * (q.life / q.max)) : 0;
          if (on) alive++;
        }
        if (alive || this.was) {
          g.attributes.position.needsUpdate = g.attributes.aCol.needsUpdate = g.attributes.aSize.needsUpdate = true;
        }
        this.was = alive;
      },
    };
  };

  W.burst = (x, y, z, o = {}) => {
    const n = o.n || 14;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * PI * 2;
      const sp = (o.speed || 3) * (0.4 + Math.random());
      partSys.spawn(x, y, z, {
        vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: (o.up || 3) * (0.4 + Math.random()),
        color: o.colors ? OA.pick(o.colors) : o.color, life: (o.life || 0.8) * (0.6 + Math.random() * 0.7), size: o.size || 0.7, g: o.g,
      });
    }
  };

  // ---- Soft shadows for things that move ----
  const initBlobs = () => {
    const tex = softTexture([[0, 'rgba(16,6,50,.5)'], [0.6, 'rgba(16,6,50,.3)'], [1, 'rgba(16,6,50,0)']], 64);
    const mat = G.bendMaterial(new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), { glow: false });
    const g = new T.PlaneGeometry(1, 1);
    g.rotateX(-PI / 2);
    const MAX = 96;
    const mesh = new T.InstancedMesh(g, mat, MAX);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    scene.add(mesh);
    const m = new T.Matrix4();
    blobSys = {
      n: 0,
      add(x, z, s) { if (this.n >= MAX) return; m.makeScale(s, 1, s); m.setPosition(x, 0.09, z); mesh.setMatrixAt(this.n++, m); },
      end() { mesh.count = this.n; mesh.instanceMatrix.needsUpdate = true; this.n = 0; },
    };
  };

  // Soft darkening where buildings meet the ground.
  let contactSys = null;
  const initContacts = () => {
    if (!G.Q.pbr) return;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.shadowColor = 'rgba(8,4,34,1)';
    x.shadowBlur = 20;
    x.fillStyle = 'rgba(8,4,34,1)';
    x.fillRect(30, 30, 68, 68);
    const mat = G.bendMaterial(new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.62 }), {});
    const g = new T.PlaneGeometry(1, 1, 3, 3);
    g.rotateX(-PI / 2);
    const mesh = new T.InstancedMesh(g, mat, 260);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
    const tmp = new T.Object3D();
    contactSys = (list) => {
      let n = 0;
      list.forEach(([x0, z0, w, d]) => {
        if (n >= 260) return;
        tmp.position.set(x0, 0.05, z0);
        tmp.scale.set(w * 1.9, 1, d * 1.9);
        tmp.updateMatrix();
        mesh.setMatrixAt(n++, tmp.matrix);
      });
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    };
  };

  // Grass, pebbles and tiny flowers scattered over the land.
  const litter = [];
  const nearRoad = (x, z, reach) => {
    for (const road of ROADS) {
      for (let i = 0; i < road.length - 1; i++) {
        const [a, b] = road[i], [c, d] = road[i + 1];
        const vx = c - a, vz = d - b;
        const t = OA.clamp(((x - a) * vx + (z - b) * vz) / (vx * vx + vz * vz), 0, 1);
        if (Math.hypot(x - (a + vx * t), z - (b + vz * t)) < reach) return true;
      }
    }
    return false;
  };
  const addLitter = (geo, mat, count, o) => {
    if (count < 1) return;
    const inst = new T.InstancedMesh(geo, mat, count);
    inst.frustumCulled = false;
    inst.receiveShadow = true;
    inst.castShadow = false;
    let seed = o.seed || 77;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const E = o.where === 'wild' ? INNER - 1 : OA.LAND_EDGE;
    const list = [];
    for (let i = 0; i < count; i++) {
      const x = (rnd() * 2 - 1) * E, z = (rnd() * 2 - 1) * E;
      const clump = OA.fbm(x * 0.35 + 7, z * 0.35 + 3, 2);
      if (o.clump && clump < o.clump) continue;
      if (nearRoad(x, z, 1.5) || inLake(x, z, 1)) continue;
      if (o.where === 'wild') {
        let hit = false;
        for (const k in OA.SITES) { const q = OA.SITES[k]; if (Math.hypot(x - q.x, z - q.z) < (k === 'town' ? 15 : q.r + 2)) hit = true; }
        if (hit) continue;
      }
      list.push({ x, z, r: rnd() * 6.28, s: OA.lerp(o.s0, o.s1, rnd()) * (0.8 + clump * 0.5), t: 0.82 + rnd() * 0.36 });
    }
    scene.add(inst);
    litter.push({ inst, list, where: o.where, tint: o.tint });
  };
  const initLitter = () => {
    const Q = G.Q;
    if (!Q.grass) return;
    const M = G.M;
    addLitter(M.tuft(), G.mat.grass, Q.grass, { s0: 0.8, s1: 1.45, tint: true, seed: 101 });
    addLitter(M.tuft2(), G.mat.grass, Math.round(Q.grass * 0.3), { s0: 0.9, s1: 1.5, tint: true, seed: 202, clump: 0.42 });
    addLitter(M.flowers(), G.mat.grass, Math.round(Q.grass * 0.05), { s0: 0.8, s1: 1.2, tint: true, seed: 303, clump: 0.5 });
    addLitter(M.pebble(0), G.mat.soft, Math.round(Q.grass * 0.05), { s0: 0.5, s1: 1.2, seed: 404 });
    addLitter(M.pebble(1), G.mat.soft, Math.round(Q.grass * 0.1), { s0: 0.7, s1: 1.9, seed: 505, where: 'wild' });
    addLitter(M.scrub(), G.mat.grass, Math.round(Q.grass * 0.14), { s0: 0.7, s1: 1.5, tint: true, seed: 606, where: 'wild', clump: 0.46 });
  };
  const regrow = () => {
    const tmp = new T.Object3D();
    const col = new T.Color();
    litter.forEach((l) => {
      let n = 0;
      l.list.forEach((p) => {
        const tx = Math.floor(p.x), tz = Math.floor(p.z);
        const own = Sim.owned(tx, tz);
        if (l.where === 'wild' ? own : !own || Sim.objAt(tx, tz) || Sim.rockAt(tx, tz)) return;
        tmp.position.set(p.x, 0.02, p.z);
        tmp.rotation.set(0, p.r, 0);
        tmp.scale.setScalar(p.s);
        tmp.updateMatrix();
        l.inst.setMatrixAt(n, tmp.matrix);
        if (l.tint) l.inst.setColorAt(n, col.setRGB(p.t, p.t, p.t));
        n++;
      });
      l.full = n;
      l.inst.count = Math.floor(n * Trim.grass);
      l.inst.instanceMatrix.needsUpdate = true;
      if (l.inst.instanceColor) l.inst.instanceColor.needsUpdate = true;
    });
  };

  // ---- Things on the map ----
  class Thing {
    constructor(o) {
      this.o = o;
      this.group = new T.Group();
      const { w, d } = Sim.size(o);
      this.w = w; this.d = d;
      this.pop = 0;
      world.add(this.group);
      this.place();
    }
    place() { this.group.position.set(this.o.x + this.w / 2, 0, this.o.z + this.d / 2); }
    get cx() { return this.o.x + this.w / 2; }
    get cz() { return this.o.z + this.d / 2; }
    bounce() { this.pop = 1; }
    tickPop(dt) {
      if (this.pop > 0) {
        this.pop = Math.max(0, this.pop - dt * 3.2);
        const k = Math.sin(this.pop * PI) * 0.1;
        this.group.scale.set(1 + k, 1 - k * 0.8, 1 + k);
      }
    }
    update() {}
    remove() { world.remove(this.group); }
  }

  class FieldThing extends Thing {
    constructor(o) {
      super(o);
      this.soil = G.mesh(G.M.field(), { receive: true });
      this.group.add(this.soil);
      this.crop = G.mesh(new T.BufferGeometry(), { mat: G.mat.plant, cast: G.Q.name === 'high', receive: true });
      this.crop.visible = false;
      this.group.add(this.crop);
      this.key = '';
      this.grow = 1;
    }
    update(dt, now) {
      const o = this.o;
      let stage = -1;
      if (o.crop) {
        const p = (now - o.planted) / Math.max(1, o.readyAt - o.planted);
        stage = p >= 1 ? 3 : p > 0.62 ? 2 : p > 0.28 ? 1 : 0;
      }
      const key = o.crop ? o.crop + stage : '';
      if (key !== this.key) {
        this.key = key;
        this.grow = 0;
        this.crop.visible = !!o.crop;
        if (o.crop) this.crop.geometry = G.M.crop(o.crop, stage);
        W.shadowsDirty();
      }
      if (this.grow < 1) {
        this.grow = Math.min(1, this.grow + dt * 3.4);
        const t = this.grow;
        const s = 0.72 + 0.28 * (1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2));
        this.crop.scale.set(1, s, 1);
      }
      this.tickPop(dt);
    }
  }

  class TreeThing extends Thing {
    constructor(o) {
      super(o);
      this.mesh = G.mesh(new T.BufferGeometry(), { cast: true });
      this.group.add(this.mesh);
      this.state = '';
    }
    update(dt, now) {
      const o = this.o;
      const st = o.picks <= 0 ? 'spent' : now >= o.readyAt ? 'fruit' : 'leaf';
      if (st !== this.state) {
        this.state = st;
        this.mesh.geometry = G.M.tree(o.kind, st);
        W.shadowsDirty();
      }
      if (st === 'fruit') {
        const def = OA.TREES.find((t) => t.id === o.kind);
        bubbleSys.add(this.cx, 4.2, this.cz, 1.4, 'item:' + def.fruit);
      }
      this.tickPop(dt);
    }
  }

  const STAND = { puffling: 1, moonmoo: 1, snuffle: 1, nimbaa: 1.25, lumibee: 1, drift: 1 };
  class Critter {
    constructor(pen, i) {
      this.pen = pen;
      this.i = i;
      this.mesh = G.mesh(G.M.critter(pen.o.kind));
      pen.group.add(this.mesh);
      const rw = OA.BUILD.pen.w / 2 - 1.3, rd = OA.BUILD.pen.d / 2 - 1.1;
      this.rw = rw; this.rd = rd;
      this.x = OA.rand(-rw, rw - 0.8); this.z = OA.rand(-rd * 0.3, rd);
      this.tx = this.x; this.tz = this.z;
      this.wait = OA.rand(0, 2);
      this.yaw = OA.rand(0, 6);
      this.t = OA.rand(0, 7);
      this.hop = 0;
      this.jump = 0;
    }
    update(dt) {
      const st = Sim.critterState(this.pen.o.critters[this.i] || { readyAt: null });
      this.t += dt;
      const kind = this.pen.o.kind;
      const speed = kind === 'moonmoo' ? 0.8 : kind === 'puffling' ? 1.5 : 1.1;
      const dx = this.tx - this.x, dz = this.tz - this.z;
      const dist = Math.hypot(dx, dz);
      let moving = false;
      if (dist > 0.1) {
        this.x += (dx / dist) * speed * dt;
        this.z += (dz / dist) * speed * dt;
        const want = Math.atan2(-dz, dx);
        let dy = want - this.yaw;
        while (dy > PI) dy -= PI * 2;
        while (dy < -PI) dy += PI * 2;
        this.yaw += dy * Math.min(1, dt * 8);
        moving = true;
      } else {
        this.wait -= dt;
        if (this.wait <= 0) {
          this.wait = st === 'hungry' ? OA.rand(2, 5) : OA.rand(1.5, 5);
          // Hungry critters drift toward the trough.
          this.tx = st === 'hungry' ? this.rw - 0.6 + OA.rand(-0.5, 0.2) : OA.rand(-this.rw, this.rw - 0.9);
          this.tz = st === 'hungry' ? OA.rand(-0.4, 1.2) : OA.rand(-this.rd * 0.2, this.rd);
        }
      }
      const float = kind === 'nimbaa' || kind === 'lumibee' || kind === 'drift';
      let y = 0;
      if (float) y = Math.sin(this.t * 1.7) * 0.14;
      else if (moving) y = Math.abs(Math.sin(this.t * 8)) * 0.16;
      if (this.jump > 0) { this.jump -= dt * 2.4; y += Math.sin(Math.max(0, this.jump) * PI) * 0.7; }
      const sq = moving && !float ? 1 + Math.sin(this.t * 16) * 0.05 : 1 + Math.sin(this.t * 2.4) * 0.02;
      const s = STAND[kind];
      this.mesh.position.set(this.x, y + 0.06, this.z);
      this.mesh.rotation.y = this.yaw;
      this.mesh.scale.set(s / sq, s * sq, s / sq);
      const wx = this.pen.cx + this.x, wz = this.pen.cz + this.z;
      if (kind !== 'lumibee' && kind !== 'drift') blobSys.add(wx, wz, kind === 'moonmoo' ? 2 : 1.3);
      if (st === 'ready') bubbleSys.add(wx, kind === 'moonmoo' ? 2.4 : kind === 'drift' ? 3.3 : 1.9, wz, 1.05, 'item:' + OA.CRITTERS.find((c) => c.id === kind).product);
    }
    remove() { this.pen.group.remove(this.mesh); }
  }

  class PenThing extends Thing {
    constructor(o) {
      super(o);
      this.group.add(G.mesh(G.M.pen(o.kind), { cast: true, receive: true }));
      this.list = [];
    }
    update(dt) {
      const o = this.o;
      while (this.list.length < o.critters.length) this.list.push(new Critter(this, this.list.length));
      this.list.forEach((c) => c.update(dt));
      if (o.critters.some((c) => c.readyAt === null)) {
        const def = OA.CRITTERS.find((c) => c.id === o.kind);
        bubbleSys.add(this.cx, 2.2, this.cz, 1.25, 'item:' + def.feed);
      }
      this.tickPop(dt);
    }
    celebrate(list) { list.forEach((i) => { if (this.list[i]) this.list[i].jump = 1; }); }
  }

  class FactoryThing extends Thing {
    constructor(o) {
      super(o);
      this.mesh = G.mesh(G.M.factory(o.kind), { cast: true, receive: true });
      this.group.add(this.mesh);
      this.puff = OA.rand(0, 1);
    }
    update(dt, now) {
      const o = this.o;
      const running = o.queue.length > 0;
      if (running) {
        this.mesh.scale.y = 1 + Math.sin(elapsed * 9) * 0.012;
        this.mesh.scale.x = this.mesh.scale.z = 1 - Math.sin(elapsed * 9) * 0.006;
        this.puff -= dt;
        if (this.puff <= 0) {
          this.puff = 0.5;
          partSys.spawn(this.cx + OA.rand(-0.6, 0.6), 4 + OA.rand(0, 0.5), this.cz + OA.rand(-0.6, 0.6), { vy: 1.6, vx: 0.2, g: -0.3, color: 0xcfe0ff, size: 1.3, life: 1.3 });
        }
      } else this.mesh.scale.set(1, 1, 1);
      if (o.done.length) {
        const bob = Math.sin(elapsed * 3 + this.cx) * 0.12;
        bubbleSys.add(this.cx, 5.3 + bob, this.cz, 1.75, 'bubble');
        bubbleSys.add(this.cx, 5.33 + bob, this.cz, 1.3, 'item:' + o.done[0]);
      }
      this.tickPop(dt);
    }
  }

  class StaticThing extends Thing {
    constructor(o, geo, yaw = 0) {
      super(o);
      const mesh = G.mesh(geo, { cast: true, receive: true });
      mesh.rotation.y = yaw;
      this.group.add(mesh);
      this.mesh = mesh;
    }
    update(dt) {
      this.tickPop(dt);
      const type = this.o.type;
      if (type === 'board') {
        if (Sim.state().orders.some((o) => Sim.orderReady(o))) {
          const bob = Math.sin(elapsed * 3) * 0.12;
          bubbleSys.add(this.cx, 4.3 + bob, this.cz, 1.5, 'bubble');
          bubbleSys.add(this.cx, 4.33 + bob, this.cz, 1.1, 'coin');
        }
      } else if (type === 'post') {
        if (Sim.state().shop.slots.some((s) => s && s.sold)) {
          const bob = Math.sin(elapsed * 3) * 0.12;
          bubbleSys.add(this.cx, 4.3 + bob, this.cz, 1.5, 'bubble');
          bubbleSys.add(this.cx, 4.33 + bob, this.cz, 1.1, 'coin');
        }
      }
    }
  }

  const makeThing = (o) => {
    switch (o.type) {
      case 'field': return new FieldThing(o);
      case 'tree': return new TreeThing(o);
      case 'pen': return new PenThing(o);
      case 'factory': return new FactoryThing(o);
      case 'silo': return new StaticThing(o, G.M.silo());
      case 'bay': return new StaticThing(o, G.M.bay());
      case 'board': return new StaticThing(o, G.M.board(), PI / 4);
      case 'pad': return new StaticThing(o, G.M.pad());
      case 'post': return new StaticThing(o, G.M.post(), PI / 4 * 0);
      case 'gazette': return new StaticThing(o, G.M.gazette(), PI / 4);
      case 'decor': return new StaticThing(o, G.M.decor(o.kind));
      default: return null;
    }
  };

  // ---- Rocks, sites and moving props ----
  let rockGroup, rockKey = '';
  const syncRocks = () => {
    const S = Sim.state();
    const key = S.rocks.map((r) => r.id).join(',');
    if (key === rockKey) return;
    rockKey = key;
    rockGroup.clear();
    S.rocks.forEach((r) => {
      const m = G.mesh(G.M.rock(r.kind, r.seed), { cast: true });
      m.position.set(r.x + 0.5, 0, r.z + 0.5);
      rockGroup.add(m);
    });
    W.shadowsDirty();
  };

  let beaconGroup, beaconKey = '';
  const syncBeacons = () => {
    const list = Sim.claimable();
    const key = list.map((c) => c.key).join('|');
    if (key === beaconKey) return;
    beaconKey = key;
    beaconGroup.clear();
    list.forEach((c) => {
      const m = G.mesh(G.M.beacon(), { cast: true });
      m.position.set(c.sx * OA.SECTOR, 0, c.sz * OA.SECTOR);
      beaconGroup.add(m);
    });
    W.shadowsDirty();
  };

  let lotMeshes = {}, lotKey = '';
  const syncTown = () => {
    const S = Sim.state();
    const key = Object.keys(S.town.lots).sort().join(',');
    if (key === lotKey && Object.keys(lotMeshes).length) return;
    lotKey = key;
    Object.values(lotMeshes).forEach((m) => sites.remove(m));
    lotMeshes = {};
    OA.TOWN_LOTS.forEach((l) => {
      const [dx, dz] = W.TOWN_POS[l.id];
      const m = G.mesh(S.town.lots[l.id] ? G.M.lot(l.id) : G.M.ruin(l.id), { cast: true, receive: true });
      m.position.set(OA.SITES.town.x + dx, 0, OA.SITES.town.z + dz);
      m.rotation.y = dz < 0 ? 0 : PI / 2 * 0;
      sites.add(m);
      lotMeshes[l.id] = m;
    });
    W.shadowsDirty();
  };

  const props = {};
  const initSites = () => {
    sites = new T.Group();
    scene.add(sites);
    rockGroup = new T.Group();
    beaconGroup = new T.Group();
    scene.add(rockGroup, beaconGroup);

    const add = (geo, x, z, yaw = 0) => {
      const m = G.mesh(geo, { cast: true, receive: true });
      m.position.set(x, 0, z);
      m.rotation.y = yaw;
      sites.add(m);
      return m;
    };
    add(G.M.rocketPad(), OA.SITES.rocket.x, OA.SITES.rocket.z);
    add(G.M.mine(), OA.SITES.mine.x, OA.SITES.mine.z, PI / 2);
    add(G.M.dock(), OA.SITES.dock.x, OA.SITES.dock.z + 1);
    // Lamps along each road.
    ROADS.forEach((road) => {
      for (let i = 0; i < road.length - 1; i++) {
        const [a, b] = road[i], [c, d] = road[i + 1];
        const len = Math.hypot(c - a, d - b);
        const nx = -(d - b) / len, nz = (c - a) / len;
        for (let t = 2; t < len; t += 5) {
          const px = a + ((c - a) * t) / len, pz = b + ((d - b) * t) / len;
          add(G.M.road(), px + nx * 1.5, pz + nz * 1.5);
        }
      }
    });

    props.shuttle = G.mesh(G.M.shuttle(), { cast: false });
    scene.add(props.shuttle);
    props.shuttleState = { t: -1 };

    props.rocket = G.mesh(G.M.rocket(), { cast: false });
    props.rocket.position.set(OA.SITES.rocket.x, 0.4, OA.SITES.rocket.z);
    props.rocket.visible = false;
    scene.add(props.rocket);
    props.rocketAnim = 0;

    props.rivet = G.mesh(G.M.rivet());
    scene.add(props.rivet);
    props.rv = { x: 2, z: 3, tx: 2, tz: 3, wait: 2, yaw: 0, t: 0 };

    props.crates = {};
    props.walkers = [];
    props.visitors = [];
  };

  const syncMeteors = () => {
    const S = Sim.state();
    const seen = {};
    S.meteors.forEach((m) => {
      seen[m.id] = true;
      if (!props.crates[m.id]) {
        const mesh = G.mesh(G.M.crate());
        mesh.position.set(m.x, 0, m.z);
        scene.add(mesh);
        props.crates[m.id] = { mesh, m, fall: OA.now() - m.at < 3000 ? 1 : 0 };
      }
    });
    Object.keys(props.crates).forEach((id) => {
      if (!seen[id]) { scene.remove(props.crates[id].mesh); delete props.crates[id]; }
    });
  };

  // ---- Walkers ----
  class Walker {
    constructor(id, path, done) {
      this.mesh = G.mesh(G.M.folk(id));
      this.path = path.slice();
      this.done = done;
      this.x = path[0][0]; this.z = path[0][1];
      this.i = 1;
      this.t = Math.random() * 6;
      this.speed = OA.rand(1.5, 2.1);
      this.pause = 0;
      scene.add(this.mesh);
    }
    update(dt) {
      this.t += dt;
      if (this.pause > 0) { this.pause -= dt; }
      else {
        const p = this.path[this.i];
        if (!p) { scene.remove(this.mesh); if (this.done) this.done(); return false; }
        const dx = p[0] - this.x, dz = p[1] - this.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.12) { this.i++; if (p[2]) this.pause = p[2]; }
        else {
          this.x += (dx / d) * this.speed * dt;
          this.z += (dz / d) * this.speed * dt;
          this.mesh.rotation.y = Math.atan2(-dz, dx);
        }
      }
      const moving = this.pause <= 0;
      this.mesh.position.set(this.x, moving ? Math.abs(Math.sin(this.t * 7)) * 0.1 : 0, this.z);
      this.mesh.rotation.z = moving ? Math.sin(this.t * 7) * 0.05 : 0;
      blobSys.add(this.x, this.z, 1.3);
      return true;
    }
  }

  const sendShopper = () => {
    const S = Sim.state();
    const post = Sim.objs('post')[0];
    if (!post || props.walkers.length >= 4) return;
    const x = post.x + 2, z = post.z + 4.2;
    const from = [[-34, 9], [x, 9.5]];
    const id = OA.pick(OA.FOLK).id;
    const near = Math.abs(x + 12) < 20;
    props.walkers.push(new Walker(id, near ? [[-14, 9], [x, z + 0.8], [x, z, 2.2], [x + 2, z + 1], [-14, 12]] : [from[1], [x, z, 2.2], from[1]]));
  };

  // ---- Camera helpers ----
  const updateCamera = (dt) => {
    if (cam.anim) {
      cam.anim.t = Math.min(1, cam.anim.t + dt / cam.anim.dur);
      const k = cam.anim.t * cam.anim.t * (3 - 2 * cam.anim.t);
      cam.tfx = cam.fx = OA.lerp(cam.anim.fx, cam.anim.x, k);
      cam.tfz = cam.fz = OA.lerp(cam.anim.fz, cam.anim.z, k);
      cam.td = cam.d = OA.lerp(cam.anim.d, cam.anim.td, k);
      if (cam.anim.t >= 1) cam.anim = null;
    } else {
      cam.tfx += cam.vx * dt;
      cam.tfz += cam.vz * dt;
      cam.vx = OA.damp(cam.vx, 0, 5, dt);
      cam.vz = OA.damp(cam.vz, 0, 5, dt);
      clampFocus();
      cam.fx = OA.damp(cam.fx, cam.tfx, 14, dt);
      cam.fz = OA.damp(cam.fz, cam.tfz, 14, dt);
      cam.d = OA.damp(cam.d, cam.td, 10, dt);
    }
    const aspect = camera.aspect;
    const bias = aspect < 1 ? 1 + (1 - aspect) * 1.1 : 1;
    const d = cam.d * bias;
    const z = OA.clamp((cam.d - W.DIST.near) / (W.DIST.far - W.DIST.near), 0, 1);
    cam.pitch = OA.lerp(0.74, 1.12, Math.pow(z, 0.55));
    G.U.uFocus.value.set(cam.fx, cam.fz);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    camera.position.set(cam.fx + d * cp * Math.sin(cam.yaw), d * sp, cam.fz + d * cp * Math.cos(cam.yaw));
    camera.lookAt(cam.fx, OA.lerp(0.6, -R * 0.7, sstep(70, 170, cam.d)), cam.fz);
    camera.updateMatrixWorld();

    core.position.set(cam.fx, -R, cam.fz);
    atmo.position.set(cam.fx, -R, cam.fz);
    atmo.quaternion.copy(camera.quaternion);
    atmo.scale.setScalar(R * 3.36);
    ring.position.set(cam.fx, -R, cam.fz);
    ring.quaternion.copy(camera.quaternion);
    ring.rotateZ(-0.34);
    ring.rotateX(-1.2);
    ringMat.opacity = sstep(80, 125, cam.d) * 0.8;
    ring.visible = ringMat.opacity > 0.01;
    bgMat.uniforms.uOff.value.set(cam.fx * 0.0012, -cam.fz * 0.0012);
    partSys.mat.uniforms.uPx.value = (renderer.domElement.height / (2 * Math.tan((camera.fov * PI) / 360))) * 1;
  };

  W.flyTo = (x, z, d, dur = 1) => {
    cam.anim = { t: 0, dur, fx: cam.fx, fz: cam.fz, d: cam.d, x, z, td: d === undefined ? cam.d : d };
    cam.vx = cam.vz = 0;
  };
  W.panBy = (dxPx, dyPx) => {
    cam.anim = null;
    const h = renderer.domElement.clientHeight;
    const aspect = camera.aspect;
    const bias = aspect < 1 ? 1 + (1 - aspect) * 1.1 : 1;
    const k = (2 * cam.d * bias * Math.tan((camera.fov * PI) / 360)) / h;
    const sp = Math.sin(cam.pitch);
    const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    const mx = -dxPx * k * rx + (dyPx * k * fx) / sp;
    const mz = -dxPx * k * rz + (dyPx * k * fz) / sp;
    cam.tfx += mx; cam.tfz += mz;
    clampFocus();
    return { mx, mz };
  };
  W.fling = (vx, vz) => { cam.vx = vx; cam.vz = vz; };
  W.zoomBy = (factor) => {
    cam.anim = null;
    cam.td = OA.clamp(cam.td * factor, W.DIST.near, W.DIST.far);
  };

  // ---- Screen projection and picking ----
  const v = new T.Vector3();
  W.project = (x, y, z) => {
    G.bend(x, y, z, v);
    v.project(camera);
    const el = renderer.domElement;
    return { x: ((v.x + 1) / 2) * el.clientWidth, y: ((1 - v.y) / 2) * el.clientHeight, ang: G.angle(x, z) };
  };

  const ray = new T.Raycaster();
  const ndc = new T.Vector2();
  const hitAt = (height, c) => {
    const o = ray.ray.origin, d = ray.ray.direction;
    const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
    const rad = R + height;
    const b = ox * d.x + oy * d.y + oz * d.z;
    const cc = ox * ox + oy * oy + oz * oz - rad * rad;
    const disc = b * b - cc;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    if (t < 0) return null;
    const px = ox + d.x * t, py = oy + d.y * t, pz = oz + d.z * t;
    const a = Math.acos(OA.clamp(py / rad, -1, 1));
    const hl = Math.hypot(px, pz) || 1;
    return { x: cam.fx + (px / hl) * a * R, z: cam.fz + (pz / hl) * a * R, a };
  };
  // Find what is under a screen point, front-most first.
  W.pick = (sx, sy) => {
    const el = renderer.domElement;
    ndc.set((sx / el.clientWidth) * 2 - 1, -(sy / el.clientHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const c = { x: cam.fx, y: -R, z: cam.fz };
    const S = Sim.state();
    for (let h = 6; h >= 0; h -= 0.5) {
      const p = hitAt(h, c);
      if (!p) continue;
      const tx = Math.floor(p.x), tz = Math.floor(p.z);
      const o = Sim.objAt(tx, tz);
      if (o) {
        const b = o.type === 'decor' ? OA.DECOR.find((k) => k.id === o.kind) : OA.BUILD[o.type];
        if (h <= b.h) return { obj: o, x: p.x, z: p.z };
      }
      if (h === 0) {
        const m = S.meteors.find((k) => Math.hypot(k.x - p.x, k.z - p.z) < 1.2);
        if (m) return { meteor: m, x: p.x, z: p.z };
        const rock = Sim.rockAt(tx, tz);
        if (rock) return { rock, x: p.x, z: p.z };
        for (const id in OA.SITES) {
          const s = OA.SITES[id];
          if (id === 'town') continue;
          if (Math.hypot(p.x - s.x, p.z - s.z) < s.r) return { site: id, x: p.x, z: p.z };
        }
        if (Math.abs(p.x - OA.SITES.town.x) < 11 && Math.abs(p.z - OA.SITES.town.z) < 10) return { site: 'town', x: p.x, z: p.z };
        if (!Sim.owned(tx, tz)) {
          const sx2 = Math.floor((tx + OA.SECTOR / 2) / OA.SECTOR), sz2 = Math.floor((tz + OA.SECTOR / 2) / OA.SECTOR);
          const hit = Sim.claimable().find((k) => k.sx === sx2 && k.sz === sz2);
          if (hit) return { claim: hit, x: p.x, z: p.z };
        }
        return { ground: true, x: p.x, z: p.z, tx, tz };
      }
    }
    return { sky: true };
  };
  // Tile under a screen point, ignoring buildings.
  W.tileAt = (sx, sy) => {
    const el = renderer.domElement;
    ndc.set((sx / el.clientWidth) * 2 - 1, -(sy / el.clientHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const p = hitAt(0, { x: cam.fx, y: -R, z: cam.fz });
    return p ? { x: Math.floor(p.x), z: Math.floor(p.z), fx: p.x, fz: p.z } : null;
  };

  // ---- Ghost for placing things ----
  const ghost = { group: null, plate: null, mesh: null, on: false, w: 1, d: 1 };
  const initGhost = () => {
    ghost.group = new T.Group();
    const g = new T.PlaneGeometry(1, 1, 6, 6);
    g.rotateX(-PI / 2);
    // Drawn over the model, because the taller models would otherwise hide the green and red.
    ghost.mat = G.bendMaterial(new T.MeshBasicMaterial({ color: 0x6ff5c8, transparent: true, opacity: 0.5, depthWrite: false, depthTest: false }), { glow: false });
    ghost.plate = new T.Mesh(g, ghost.mat);
    ghost.plate.position.y = 0.12;
    ghost.plate.frustumCulled = false;
    ghost.plate.renderOrder = 5;
    ghost.group.add(ghost.plate);
    ghost.group.visible = false;
    scene.add(ghost.group);
  };
  W.ghostShow = (geo, w, d, yaw = 0) => {
    if (ghost.mesh) ghost.group.remove(ghost.mesh);
    ghost.mesh = geo ? G.mesh(geo) : null;
    if (ghost.mesh) { ghost.mesh.rotation.y = yaw; ghost.group.add(ghost.mesh); }
    ghost.plate.scale.set(w, 1, d);
    ghost.w = w; ghost.d = d;
    ghost.group.visible = true;
  };
  W.ghostMove = (x, z, ok) => {
    ghost.group.position.set(x + ghost.w / 2, 0.02, z + ghost.d / 2);
    ghost.mat.color.setHex(ok ? 0x6ff5c8 : 0xff5f7e);
  };
  W.ghostHide = () => { ghost.group.visible = false; };

  // ---- Keeping the scene matched to the game state ----
  W.sync = () => {
    const S = Sim.state();
    const seen = new Set();
    S.objs.forEach((o) => {
      seen.add(o.id);
      let t = things.get(o.id);
      if (!t) {
        t = makeThing(o);
        if (t) { things.set(o.id, t); t.bounce(); }
      } else {
        t.o = o;
        t.place();
      }
    });
    things.forEach((t, id) => { if (!seen.has(id)) { t.remove(); things.delete(id); } });
    syncRocks();
    syncBeacons();
    syncTown();
    syncMeteors();
    regrow();
    if (contactSys) {
      const spots = [];
      things.forEach((t) => {
        if (['silo', 'bay', 'factory', 'post', 'field'].includes(t.o.type)) spots.push([t.cx, t.cz, t.w + 0.1, t.d + 0.1]);
      });
      contactSys(spots);
    }
    W.shadowsDirty();
  };
  W.thing = (id) => things.get(id);
  W.shadowsDirty = () => { needShadow = true; };
  W.repaint = () => { paintGround(); };

  // ---- Story beats ----
  const wireEvents = () => {
    OA.on('objects', W.sync);
    OA.on('claimed', () => { paintGround(); W.sync(); });
    OA.on('planted', (e) => { const t = things.get(e.id); if (t) { W.burst(t.cx, 0.4, t.cz, { n: 5, color: 0x8ff5c8, speed: 1.2, up: 1.5, size: 0.4 }); moveRivet(t.cx + 1.2, t.cz + 1.2); } });
    OA.on('harvested', (e) => { const t = things.get(e.id); if (t) { t.bounce(); W.burst(t.cx, 0.6, t.cz, { n: 12, colors: [0xfff0a8, 0x8ff5c8, 0xffffff], speed: 2.2, up: 3 }); moveRivet(t.cx + 1.2, t.cz + 1.2); } });
    OA.on('picked', (e) => { const t = things.get(e.id); if (t) { t.bounce(); W.burst(t.cx, 2.2, t.cz, { n: 16, colors: [0xfff0a8, 0xffb3df], speed: 2.4, up: 2 }); W.shadowsDirty(); } });
    OA.on('fed', (e) => { const t = things.get(e.id); if (t) { t.bounce(); t.celebrate(e.list); W.burst(t.cx, 1, t.cz, { n: 10, color: 0xffd08a, speed: 2, up: 2 }); } });
    OA.on('collected', (e) => { const t = things.get(e.id); if (t) { t.celebrate(e.list); W.burst(t.cx, 1.1, t.cz, { n: 14, colors: [0xfff0a8, 0xffffff], speed: 2.4, up: 3 }); } });
    OA.on('queued', (e) => { const t = things.get(e.id); if (t) t.bounce(); });
    OA.on('goodCollected', (e) => { const t = things.get(e.id); if (t) { t.bounce(); W.burst(t.cx, 3, t.cz, { n: 18, colors: [0xfff0a8, 0x8ff5c8], speed: 3, up: 3 }); } });
    OA.on('built', (e) => { const t = things.get(e.id); if (t) { t.bounce(); W.burst(t.cx, 0.8, t.cz, { n: 26, colors: [0x6ff5c8, 0xffcf5c, 0xffffff], speed: 4, up: 4 }); } });
    OA.on('cleared', (e) => { W.burst(e.x, 0.5, e.z, { n: 22, colors: [0xc9b0ff, 0xffb3df], speed: 3, up: 4 }); W.sync(); });
    OA.on('shipped', () => launchShuttle());
    OA.on('sold', sendShopper);
    OA.on('meteor', (m) => { syncMeteors(); });
    OA.on('meteorOpened', (e) => { W.burst(e.x, 0.8, e.z, { n: 30, colors: [0x66e3ff, 0xffcf5c, 0xffffff], speed: 4, up: 5 }); syncMeteors(); });
    OA.on('rocketArrived', () => { props.rocketAnim = 1; });
    OA.on('rocketLeft', () => { props.rocketAnim = -1; });
    OA.on('restored', (e) => { const p = W.TOWN_POS[e.id]; W.burst(OA.SITES.town.x + p[0], 2, OA.SITES.town.z + p[1], { n: 40, colors: [0xffcf5c, 0xff7bd0, 0x66e3ff], speed: 5, up: 6 }); W.sync(); });
    OA.on('level', () => { const f = cam; for (let i = 0; i < 40; i++) setTimeout(() => W.burst(f.fx + OA.rand(-8, 8), 3, f.fz + OA.rand(-6, 6), { n: 4, colors: [0xffcf5c, 0x6ff5c8, 0xff7bd0, 0x66e3ff], speed: 3, up: 6, g: 5 }), i * 40); });
  };

  const moveRivet = (x, z) => { const r = props.rv; r.tx = x; r.tz = z; r.wait = 3; };

  const launchShuttle = () => {
    if (props.shuttleState.t >= 0) return;
    props.shuttleState = { t: 0 };
    W.burst(props.pad.x, 0.6, props.pad.z, { n: 24, color: 0x66e3ff, speed: 4, up: 2 });
  };

  const updateProps = (dt, now) => {
    const S = Sim.state();
    const pad = Sim.objs('pad')[0];
    if (pad) props.pad = { x: pad.x + 2.5, z: pad.z + 2.5 };
    // Shuttle: lifts off, loops over the horizon, and glides back.
    const sh = props.shuttle, st = props.shuttleState, p = props.pad;
    if (p) {
      if (st.t < 0) {
        sh.position.set(p.x, 0.3 + Math.sin(elapsed * 1.6) * 0.04, p.z);
        sh.rotation.set(0, PI / 4 * -1, 0);
      } else {
        st.t += dt;
        const T1 = 3.2, T2 = 9;
        if (st.t < T1) {
          const k = st.t / T1;
          sh.position.set(p.x + k * k * 60, 0.3 + 14 * k, p.z - k * k * 60);
          sh.rotation.set(0, PI / 4, 0.2);
          if (Math.random() < 0.5) partSys.spawn(sh.position.x, sh.position.y, sh.position.z, { color: 0x66e3ff, size: 0.8, life: 0.6, g: 0 });
        } else if (st.t < T2) {
          const k = (st.t - T1) / (T2 - T1);
          const e = 1 - (1 - k) * (1 - k);
          sh.position.set(p.x - (1 - e) * 60, 0.3 + 12 * (1 - e), p.z + (1 - e) * 30);
          sh.rotation.set(0, -0.4 * (1 - e), 0);
        } else {
          props.shuttleState = { t: -1 };
        }
      }
    }
    // Rocket arrival and takeoff.
    const rk = props.rocket;
    const here = S.rocket.state === 'here';
    if (props.rocketAnim > 0) {
      props.rocketAnim = Math.max(0, props.rocketAnim - dt / 4);
      const k = props.rocketAnim;
      rk.visible = true;
      rk.position.y = 0.4 + k * k * 90;
      for (let i = 0; i < 3; i++) partSys.spawn(rk.position.x + OA.rand(-0.5, 0.5), rk.position.y, rk.position.z + OA.rand(-0.5, 0.5), { color: 0xff9d3d, size: 1.5, life: 0.6, g: 3, vy: -6 });
    } else if (props.rocketAnim < 0) {
      props.rocketAnim = Math.max(-1.0001, props.rocketAnim);
      props.rocketAnim += dt / 4;
      const k = 1 + props.rocketAnim;
      rk.position.y = 0.4 + k * k * 110;
      for (let i = 0; i < 3; i++) partSys.spawn(rk.position.x + OA.rand(-0.5, 0.5), rk.position.y, rk.position.z + OA.rand(-0.5, 0.5), { color: 0xff9d3d, size: 1.5, life: 0.6, g: 3, vy: -6 });
      if (props.rocketAnim >= 0) { props.rocketAnim = 0; rk.visible = false; }
    } else {
      rk.visible = here;
      rk.position.y = 0.4;
    }
    if (here) {
      const bob = Math.sin(elapsed * 2.5) * 0.14;
      bubbleSys.add(OA.SITES.rocket.x, 11 + bob, OA.SITES.rocket.z, 2.2, 'bubble');
      bubbleSys.add(OA.SITES.rocket.x, 11.05 + bob, OA.SITES.rocket.z, 1.6, 'coin');
    }

    // Rivet potters about.
    const r = props.rv;
    r.t += dt;
    const dx = r.tx - r.x, dz = r.tz - r.z, d = Math.hypot(dx, dz);
    if (d > 0.2) {
      const sp = Math.min(5, 1.5 + d * 0.8);
      r.x += (dx / d) * sp * dt; r.z += (dz / d) * sp * dt;
      r.yaw = Math.atan2(-dz, dx);
    } else {
      r.wait -= dt;
      if (r.wait <= 0) {
        r.wait = OA.rand(2, 6);
        r.tx = OA.rand(-10, 10); r.tz = OA.rand(-3, 10);
      }
    }
    props.rivet.position.set(r.x, Math.sin(r.t * 3) * 0.04, r.z);
    props.rivet.rotation.y = r.yaw;
    blobSys.add(r.x, r.z, 1.4);

    // Meteors falling.
    Object.values(props.crates).forEach((c) => {
      if (c.fall > 0) {
        c.fall = Math.max(0, c.fall - dt / 1.6);
        c.mesh.position.y = c.fall * c.fall * 40;
        partSys.spawn(c.m.x + OA.rand(-0.3, 0.3), c.mesh.position.y + 0.5, c.m.z + OA.rand(-0.3, 0.3), { color: 0xffb03d, size: 1.2, life: 0.5, g: 0 });
        if (c.fall === 0) W.burst(c.m.x, 0.3, c.m.z, { n: 30, colors: [0xffb03d, 0xffffff], speed: 5, up: 4 });
      } else {
        const b = Math.sin(elapsed * 3) * 0.1;
        bubbleSys.add(c.m.x, 2.2 + b, c.m.z, 1.3, 'bubble');
        bubbleSys.add(c.m.x, 2.22 + b, c.m.z, 0.95, 'stardust');
      }
    });

    // Shoppers.
    props.walkers = props.walkers.filter((w) => w.update(dt));

    // Town visitors wait in the square.
    const vis = S.town.visitors;
    while (props.visitors.length < vis.length) {
      const i = props.visitors.length;
      const mesh = G.mesh(G.M.folk(vis[i].who));
      scene.add(mesh);
      props.visitors.push({ mesh, who: vis[i].who });
    }
    while (props.visitors.length > vis.length) scene.remove(props.visitors.pop().mesh);
    props.visitors.forEach((pv, i) => {
      if (pv.who !== vis[i].who) { pv.mesh.geometry = G.M.folk(vis[i].who); pv.who = vis[i].who; }
      const a = i * 1.3 + 0.6;
      const x = OA.SITES.town.x + Math.cos(a) * 3.2, z = OA.SITES.town.z + Math.sin(a) * 2.4;
      pv.mesh.position.set(x, Math.abs(Math.sin(elapsed * 2 + i)) * 0.06, z);
      pv.mesh.rotation.y = PI / 4 * -1;
      blobSys.add(x, z, 1.3);
      const bob = Math.sin(elapsed * 2.6 + i) * 0.1;
      bubbleSys.add(x, 2.6 + bob, z, 1.4, 'bubble');
      bubbleSys.add(x, 2.62 + bob, z, 1, 'item:' + vis[i].items[0].id);
    });
  };

  // ---- Time of day ----
  W.look = { sun: 2.1, hemi: 0.3, env: 0.62, groundEnv: 0.6, exposure: 0.62, bloom: 0.04, sat: 1.14, halo: 0.34 };
  const CYCLE = 420;
  const dayC = { hs: new T.Color(0xe6dcff), hg: new T.Color(0x6a58b0), s: new T.Color(0xfff0dc) };
  const duskC = { hs: new T.Color(0xc2a0f0), hg: new T.Color(0x5a3f8f), s: new T.Color(0xffb088) };
  const nightC = { hs: new T.Color(0xa49cff), hg: new T.Color(0x4a3fb0), s: new T.Color(0xb4c4ff) };
  const c1 = new T.Color(), c2 = new T.Color();
  const updateLight = (now) => {
    const t = W.fixedDay !== undefined ? W.fixedDay : (((now - Sim.state().created) / 1000) % CYCLE) / CYCLE;
    // day 0-.5, dusk .5-.62, night .62-.9, dawn .9-1
    let night, warm;
    if (t < 0.5) { night = 0; warm = sstep(0.4, 0.5, t) * 0.8; }
    else if (t < 0.62) { night = sstep(0.5, 0.62, t); warm = 1 - night * 0.2; }
    else if (t < 0.9) { night = 1; warm = 0; }
    else { night = 1 - sstep(0.9, 1, t); warm = (1 - night) * 0.6; }
    const lerp3 = (out, key) => {
      c1.copy(dayC[key]).lerp(duskC[key], warm);
      out.copy(c1).lerp(nightC[key], night);
    };
    lerp3(hemi.color, 'hs');
    lerp3(hemi.groundColor, 'hg');
    lerp3(sun.color, 's');
    if (G.Q.pbr) {
      const L = W.look;
      hemi.intensity = OA.lerp(L.hemi, L.hemi * 1.3, night);
      sun.intensity = OA.lerp(L.sun, L.sun * 0.32, night);
      const env = OA.lerp(L.env, L.env * 0.5, night);
      G.mat.solid.envMapIntensity = G.mat.soft.envMapIntensity = G.mat.plant.envMapIntensity = env;
      G.mat.ground.envMapIntensity = G.mat.terrain.envMapIntensity = env * L.groundEnv;
      G.Post.set({ exposure: OA.lerp(L.exposure, L.exposure * 1.2, night), bloom: L.bloom, sat: L.sat });
      atmo.material.opacity = L.halo;
    } else {
      hemi.intensity = OA.lerp(0.56, 0.78, night);
      sun.intensity = OA.lerp(0.62, 0.42, night);
    }
    G.U.uNight.value = night;
    G.U.uNightGlow.value = OA.lerp(0.08, 1, night);
    G.U.uRim.value.setHex(night > 0.5 ? 0x8fa0ff : 0xb8a0ff);
  };

  // ---- Boot and frame ----
  W.resize = () => {
    const el = renderer.domElement;
    const w = el.parentElement.clientWidth, h = el.parentElement.clientHeight;
    // Drawn in software, every pixel costs processor time, so the picture keeps to a
    // fixed number of pixels and the page stretches it to fill the screen.
    const ratio = pixelRatio * (W.software ? Math.min(1, Math.sqrt(SOFT_PIXELS / (w * h))) : 1);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const a = w / h;
    bgMat.uniforms.uScale.value.set(a > 1 ? 1 : a, a > 1 ? 1 / a : 1);
    stars.material.uniforms.uPx.value = ratio;
    if (G.Post.on) {
      const size = renderer.getDrawingBufferSize(new T.Vector2());
      G.Post.resize(size.x, size.y);
    }
  };

  // Soft, colored studio light for reflections, built in code.
  const buildEnv = () => {
    const s0 = new T.Scene();
    s0.add(new T.Mesh(new T.SphereGeometry(50, 32, 16), new T.ShaderMaterial({
      side: T.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        varying vec3 vP;
        void main(){
          vec3 d = normalize(vP);
          vec3 top = vec3(0.34, 0.3, 0.72), hor = vec3(1.25, 0.95, 1.15), low = vec3(0.1, 0.36, 0.34);
          vec3 c = d.y > 0.0 ? mix(hor, top, pow(d.y, 0.55)) : mix(hor * 0.6, low, pow(-d.y, 0.4));
          c += vec3(11.0, 10.0, 8.5) * pow(max(dot(d, normalize(vec3(-0.45, 0.8, 0.3))), 0.0), 90.0);
          c += vec3(1.5, 1.4, 1.7) * pow(max(dot(d, normalize(vec3(0.7, 0.45, 0.55))), 0.0), 7.0);
          c += vec3(0.5, 0.9, 1.0) * pow(max(dot(d, normalize(vec3(-0.6, 0.1, -0.7))), 0.0), 5.0);
          gl_FragColor = vec4(c, 1.0);
          #include <encodings_fragment>
        }`,
    })));
    const auto = renderer.autoClear;
    renderer.autoClear = true;
    const pm = new T.PMREMGenerator(renderer);
    const rt = pm.fromScene(s0, 0.02);
    pm.dispose();
    renderer.autoClear = auto;
    scene.environment = rt.texture;
    G.envTex = rt.texture;
  };

  // Asks the browser what will draw the game. With graphics acceleration switched off,
  // or a graphics driver it refuses, the processor draws everything in software.
  const probeGpu = () => {
    const shut = (gl) => { const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); };
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return { name: '', none: true };
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      shut(gl);
      let soft = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
      // A browser that hides the name still refuses a context that must be fast.
      if (!name) {
        const fast = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
        if (fast) shut(fast); else soft = true;
      }
      return { name, soft };
    } catch (e) { return { name: '', none: true }; }
  };
  // Picks how much the device can handle, unless the player chose in Settings.
  const pickTier = () => {
    let pref = 'auto';
    try { pref = root.localStorage.getItem('orbitAcres.graphics') || 'auto'; } catch (e) { /* use the default */ }
    W.graphicsPref = pref;
    const gpu = probeGpu();
    W.software = !!gpu.soft;
    if (G.TIERS[pref]) return pref;
    const name = gpu.name;
    if (gpu.none || gpu.soft) return 'low';
    // A device that could not keep up, even at its lightest, starts a level lower.
    let cap = '';
    try { cap = root.localStorage.getItem('orbitAcres.graphicsCap') || ''; } catch (e) { /* no limit */ }
    if (cap === 'low') return 'low';
    const small = Math.min(root.innerWidth, root.innerHeight) < 560;
    const cores = root.navigator.hardwareConcurrency || 4;
    const mem = root.navigator.deviceMemory || 8;
    // iPhones under-report their cores, and they all have strong graphics chips.
    const iphone = /iPhone|iPad/.test(root.navigator.userAgent);
    if (small) {
      // Only the strongest phones can afford the full lighting; the rest stay smooth on Low.
      const strong = iphone || /adreno[^\d]*(7[3-9]\d|[89]\d\d)|immortalis|mali-g(7[7-9]|[89]\d|7\d\d)/i.test(name);
      return strong && cores >= 6 && mem >= 4 ? 'medium' : 'low';
    }
    if (cap === 'medium') return 'medium';
    // Graphics built into the processor share its power and memory.
    const shared = /intel|radeon\(tm\)|radeon graphics|vega \d/i.test(name);
    return cores <= 4 || mem <= 4 || shared ? 'medium' : 'high';
  };
  W.setGraphics = (pref) => {
    try {
      root.localStorage.setItem('orbitAcres.graphics', pref);
      // Choosing Auto again gives the device a fresh start.
      if (pref === 'auto') {
        root.localStorage.removeItem('orbitAcres.graphicsStep');
        root.localStorage.removeItem('orbitAcres.graphicsCap');
      }
    } catch (e) { /* session only */ }
  };

  // ---- Holding the frame rate ----
  // On Auto the game trims its own cost within a second or two of slowing down, and
  // puts the quality back once there is room. A busy graphics card or a hot phone
  // should mean a softer picture, not a slideshow. The on-screen buttons and text are
  // drawn by the page, so they stay sharp even when the world is drawn smaller.
  const Trim = W.trim = { steps: [], at: 0, grass: 1, tilt: 0, gaps: [], sum: 0, wait: 2, good: 0, need: 6, downs: 0, from: 0, fromAt: 0, cap: 0, upWindow: 0, slow: 0, warned: false };
  const buildSteps = () => {
    const Q = G.Q, px = pixelRatio, s = [];
    const add = (p, msaa, bloom, tilt, grass, detail) => s.push({ px: Math.min(px, p), msaa, bloom: Math.min(Q.bloom, bloom), tilt, grass, detail: Q.detail ? detail : 0 });
    add(px, Q.msaa, Q.bloom, Q.tilt, 1, 1);
    if (Q.msaa || Q.tilt) add(px, 0, Q.bloom, 0, 1, 1);
    if (px > 1.25) add(1.25, 0, 3, 0, 0.7, 1);
    if (px > 1) add(1, 0, 2, 0, 0.5, 1);
    add(0.85, 0, 2, 0, 0.3, 0);
    add(0.7, 0, 1, 0, 0.15, 0);
    add(0.6, 0, 1, 0, 0, 0);
    return s;
  };
  const useStep = (i) => {
    const s = Trim.steps[i];
    Trim.at = i;
    Trim.grass = s.grass;
    Trim.tilt = s.tilt;
    Trim.wait = 1;
    Trim.good = 0;
    litter.forEach((l) => { l.inst.count = Math.floor(l.full * s.grass); });
    G.U.uDetailK.value = s.detail;
    if (G.Post.on) G.Post.quality(s.msaa, s.bloom);
    pixelRatio = s.px;
    W.resize();
    try { root.localStorage.setItem('orbitAcres.graphicsStep', String(i)); } catch (e) { /* session only */ }
  };
  const startTrim = () => {
    Trim.steps = buildSteps();
    const top = Trim.steps[0];
    Trim.grass = 1;
    Trim.tilt = top.tilt;
    if (W.graphicsPref !== 'auto') return;
    let saved = 0;
    try { saved = Number(root.localStorage.getItem('orbitAcres.graphicsStep')) || 0; } catch (e) { /* start at the top */ }
    // Start one step above where the last session settled, and climb from there.
    if (saved > 1) useStep(Math.min(saved, Trim.steps.length - 1) - 1);
  };
  // gap: milliseconds since the last frame.
  const pace = W.pace = (gap) => {
    // A gap this long is a pause or a page in the background, not a frame rate.
    if (gap > 900) return;
    Trim.gaps.push(gap);
    Trim.sum += gap;
    if (Trim.sum < 1000) return;
    // The middle frame, so a one-off stall doesn't count as running slowly.
    const ms = Trim.gaps.sort((a, b) => a - b)[Trim.gaps.length >> 1];
    Trim.gaps = [];
    Trim.sum = 0;
    if (Trim.upWindow > 0) Trim.upWindow--;
    if (Trim.wait > 0) { Trim.wait--; return; }
    if (W.graphicsPref !== 'auto') {
      Trim.slow = ms > 36 ? Trim.slow + 1 : 0;
      if (Trim.slow === 6 && !Trim.warned && G.Q.name !== 'low' && OA.UI && OA.UI.toast) {
        Trim.warned = true;
        OA.UI.toast('Running slowly? Try Auto or a lower Graphics level in Settings.');
      }
      return;
    }
    const slowLine = Trim.cap ? Trim.cap + 8 : 26;
    const fastLine = Trim.cap ? Trim.cap + 3 : 19;
    if (ms > slowLine) {
      Trim.good = 0;
      if (!Trim.downs) { Trim.from = ms; Trim.fromAt = Trim.at; }
      Trim.downs++;
      // Two steps down and no change: this screen is locked to this rate, and nothing
      // is wrong. Battery savers do that to 30 frames a second.
      if (Trim.downs > 2 && Math.abs(ms - Trim.from) < 2.5 && Math.abs(ms - 33.3) < 3) {
        Trim.cap = ms;
        Trim.downs = 0;
        useStep(Trim.fromAt);
        return;
      }
      if (Trim.at >= Trim.steps.length - 1) {
        // Nothing left to trim, and still slow: the next start begins a level lower.
        if (++Trim.slow === 8 && G.Q.name !== 'low') {
          try {
            root.localStorage.setItem('orbitAcres.graphicsCap', G.Q.name === 'high' ? 'medium' : 'low');
            root.localStorage.removeItem('orbitAcres.graphicsStep');
            if (OA.UI && OA.UI.toast) OA.UI.toast('Graphics will drop a level next time you open the game, so it runs smoother.');
          } catch (e) { /* nowhere to remember it */ }
        }
        return;
      }
      // Going straight back down means that last step up was too hopeful.
      if (Trim.upWindow > 0) Trim.need = Math.min(120, Trim.need * 2);
      useStep(Trim.at + 1);
    } else {
      Trim.downs = 0;
      Trim.slow = 0;
      if (ms < fastLine && Trim.at > 0 && ++Trim.good >= Trim.need) {
        Trim.upWindow = 4;
        useStep(Trim.at - 1);
      }
    }
  };

  W.init = (canvas, opts) => {
    const Q = G.setTier(pickTier());
    pixelRatio = W.software ? 1 : Math.min(root.devicePixelRatio || 1, Q.pixel);
    // Smoothed edges take four samples a pixel, about a third of the frame in software.
    renderer = new T.WebGLRenderer({ canvas, antialias: !Q.pbr && !W.software, powerPreference: 'high-performance' });
    if (Q.pbr && !G.Post.supported(renderer)) G.setTier('low');
    renderer.autoClear = false;
    renderer.setClearColor(0x0b0830, 1);
    renderer.shadowMap.enabled = true;
    // Soft shadows read the shadow map sixteen times a pixel. Low reads it four times,
    // in a small pattern, which takes the stair steps off the edges for a quarter of the cost.
    renderer.shadowMap.type = G.Q.pbr ? T.PCFSoftShadowMap : T.BasicShadowMap;
    if (!G.Q.pbr) {
      T.ShaderChunk.shadowmap_pars_fragment = T.ShaderChunk.shadowmap_pars_fragment.replace(
        'shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );',
        `vec2 oaT = 0.9 / shadowMapSize;
        shadow = ( texture2DCompare( shadowMap, shadowCoord.xy + vec2( -oaT.x, -oaT.y * 0.4 ), shadowCoord.z )
          + texture2DCompare( shadowMap, shadowCoord.xy + vec2( oaT.x, oaT.y * 0.4 ), shadowCoord.z )
          + texture2DCompare( shadowMap, shadowCoord.xy + vec2( -oaT.x * 0.4, oaT.y ), shadowCoord.z )
          + texture2DCompare( shadowMap, shadowCoord.xy + vec2( oaT.x * 0.4, -oaT.y ), shadowCoord.z ) ) * 0.25;`,
      );
    }
    renderer.shadowMap.autoUpdate = false;
    W.renderer = renderer;

    G.initMaterials();
    if (G.Q.detail) G.makeDetail(G.Q.detailSize);
    if (G.Q.pbr) G.Post.init(renderer);
    scene = new T.Scene();
    overlay = new T.Scene();
    camera = new T.PerspectiveCamera(26, 1, 2, 900);
    W.camera = camera;
    hemi = new T.HemisphereLight(0xe6dcff, 0x6a58b0, 0.6);
    sun = new T.DirectionalLight(0xfff0dc, 0.75);
    sun.position.set(-24, 44, 16);
    sun.castShadow = true;
    const shadowSize = Math.min(G.Q.shadow, renderer.capabilities.maxTextureSize);
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    const s = sun.shadow.camera;
    s.left = -52; s.right = 52; s.top = 52; s.bottom = -52; s.near = 1; s.far = 130;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.05;
    scene.add(hemi, sun, sun.target);
    if (G.Q.pbr) buildEnv();

    world = new T.Group();
    scene.add(world);
    things = new Map();
    initSky();
    initGround();
    initBubbles();
    initParticles();
    initBlobs();
    initContacts();
    initLitter();
    initSites();
    initGhost();
    wireEvents();
    return true;
  };

  W.setAtlas = (tex) => { bubbleSys.mat.uniforms.map.value = tex; };

  W.start = () => {
    W.sync();
    W.resize();
    startTrim();
    root.addEventListener('resize', W.resize);
  };

  let lastStamp = 0;
  W.frame = (dt) => {
    elapsed += dt;
    G.U.uTime.value = elapsed;
    const now = OA.now();
    updateCamera(dt);
    updateLight(now);
    things.forEach((t) => t.update(dt, now));
    updateProps(dt, now);
    partSys.update(dt);
    bubbleSys.end();
    blobSys.end();
    if (OA.UI && OA.UI.worldTick) OA.UI.worldTick(dt);
    if (needShadow) { renderer.shadowMap.needsUpdate = true; needShadow = false; }
    if (G.Post.on) {
      G.Post.set({ tilt: Trim.tilt * (1 - sstep(44, 90, cam.d)) });
      G.Post.render(scene, camera, overlay);
    } else {
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.render(overlay, camera);
    }
    const stamp = root.performance.now();
    if (lastStamp) pace(stamp - lastStamp);
    lastStamp = stamp;
  };
})(typeof window !== 'undefined' ? window : globalThis);
