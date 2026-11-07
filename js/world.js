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

  let renderer, scene, camera, bgScene, bgCam, sun, hemi;
  let world, things, sites, ground, groundTex, bgMat, stars, core, atmo, ring, ringMat, lake;
  let bubbleSys, partSys, blobSys;
  let pixelRatio = 1;
  let quality = { shadows: 2048, ground: 2048, scatter: 1 };
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
    bgScene = new T.Scene();
    bgCam = new T.Camera();
    bgMat = new T.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: { t: { value: paintSky() }, uOff: { value: new T.Vector2() }, uScale: { value: new T.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: 'uniform sampler2D t; uniform vec2 uOff; uniform vec2 uScale; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, (vUv - 0.5) * uScale + 0.5 + uOff); }',
    });
    bgScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), bgMat));
    // A few stars that actually twinkle.
    const n = 140;
    const pos = new Float32Array(n * 3);
    const ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = OA.rand(-1, 1); pos[i * 3 + 1] = OA.rand(-1, 1); pos[i * 3 + 2] = 1; ph[i] = OA.rand(0, 7); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('aPh', new T.BufferAttribute(ph, 1));
    stars = new T.Points(g, new T.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uTime: G.U.uTime, uPx: { value: 1 } },
      vertexShader: 'attribute float aPh; uniform float uTime; uniform float uPx; varying float vA; void main(){ vA = 0.45 + 0.55 * sin(uTime * 1.6 + aPh * 3.0); gl_PointSize = uPx * (1.5 + 2.0 * fract(aPh * 3.3)); gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.85, 0.9, 1.0, vA * smoothstep(0.5, 0.05, d)); }',
    }));
    stars.frustumCulled = false;
    bgScene.add(stars);
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

  const hexToCss = (n) => '#' + n.toString(16).padStart(6, '0');
  const paintGround = () => {
    const S = Sim.state();
    const size = quality.ground;
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
    // Craters and pebbles on the wild ground.
    for (let i = 0; i < 90; i++) {
      const px = rnd() * size, py = rnd() * size, r = (0.8 + rnd() * rnd() * 4.5) * k;
      x.fillStyle = 'rgba(40,24,100,.2)';
      x.beginPath(); x.ellipse(px, py, r, r * 0.86, 0, 0, 7); x.fill();
      x.strokeStyle = 'rgba(214,202,255,.28)';
      x.lineWidth = Math.max(1, r * 0.12);
      x.beginPath(); x.ellipse(px, py + r * 0.04, r, r * 0.86, 0, 0.3, 3.2); x.stroke();
    }

    // The claimed land grows lush.
    const lush = document.createElement('canvas');
    lush.width = lush.height = size;
    const u = lush.getContext('2d');
    u.fillStyle = '#46c9a6';
    u.fillRect(0, 0, size, size);
    const blobCols = ['94,224,176', '56,178,160', '126,234,186', '44,160,158', '160,240,190'];
    for (let i = 0; i < 520; i++) {
      const px = rnd() * size, py = rnd() * size, r = (1.2 + rnd() * 6) * k;
      const gr = u.createRadialGradient(px, py, 0, px, py, r);
      const col = blobCols[Math.floor(rnd() * blobCols.length)];
      gr.addColorStop(0, 'rgba(' + col + ',.42)');
      gr.addColorStop(1, 'rgba(' + col + ',0)');
      u.fillStyle = gr;
      u.fillRect(px - r, py - r, r * 2, r * 2);
    }
    for (let i = 0; i < 5200; i++) {
      const px = rnd() * size, py = rnd() * size;
      const b = rnd();
      u.fillStyle = b > 0.5 ? 'rgba(190,255,214,.36)' : 'rgba(30,130,130,.34)';
      u.beginPath();
      u.ellipse(px, py, (0.05 + rnd() * 0.07) * k, (0.03 + rnd() * 0.04) * k, rnd() * 3, 0, 7);
      u.fill();
    }
    for (let i = 0; i < 380; i++) {
      const px = rnd() * size, py = rnd() * size;
      u.fillStyle = ['#ffb3df', '#fff0a8', '#ffffff', '#c9b0ff'][Math.floor(rnd() * 4)];
      u.beginPath(); u.arc(px, py, (0.05 + rnd() * 0.05) * k, 0, 7); u.fill();
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

    // Roads and hard stands.
    const road = (pts, w) => {
      x.lineCap = x.lineJoin = 'round';
      x.strokeStyle = '#6d5fb0';
      x.lineWidth = (w + 0.5) * k;
      x.beginPath();
      pts.forEach(([a, b], i) => (i ? x.lineTo(tx(a), tx(b)) : x.moveTo(tx(a), tx(b))));
      x.stroke();
      x.strokeStyle = '#c8bdf2';
      x.lineWidth = w * k;
      x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.55)';
      x.lineWidth = 0.1 * k;
      x.setLineDash([0.7 * k, 0.9 * k]);
      x.stroke();
      x.setLineDash([]);
    };
    ROADS.forEach((p) => road(p, 2));
    // Town square.
    const t = OA.SITES.town;
    x.fillStyle = '#6d5fb0';
    x.fillRect(tx(t.x - 11.2), tx(t.z - 10.2), 22.4 * k, 20.4 * k);
    x.fillStyle = '#cfc5f4';
    x.fillRect(tx(t.x - 11), tx(t.z - 10), 22 * k, 20 * k);
    x.strokeStyle = 'rgba(109,95,176,.36)';
    x.lineWidth = 0.04 * k;
    for (let i = 0; i <= 22; i += 2) { x.beginPath(); x.moveTo(tx(t.x - 11 + i), tx(t.z - 10)); x.lineTo(tx(t.x - 11 + i), tx(t.z + 10)); x.stroke(); }
    for (let i = 0; i <= 20; i += 2) { x.beginPath(); x.moveTo(tx(t.x - 11), tx(t.z - 10 + i)); x.lineTo(tx(t.x + 11), tx(t.z - 10 + i)); x.stroke(); }
    x.fillStyle = '#ffcf5c';
    x.beginPath(); x.arc(tx(t.x), tx(t.z), 2.3 * k, 0, 7); x.fill();
    x.fillStyle = '#cfc5f4';
    x.beginPath(); x.arc(tx(t.x), tx(t.z), 1.9 * k, 0, 7); x.fill();

    if (!groundTex) {
      groundTex = new T.CanvasTexture(c);
      groundTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      groundTex.minFilter = T.LinearMipmapLinearFilter;
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
        col.push(c[0] / 255, c[1] / 255, c[2] / 255);
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
        void main(){
          float w = sin(vP.x * 0.9 + uTime * 0.7) + sin(vP.y * 1.1 - uTime * 0.5) + sin((vP.x + vP.y) * 0.6 + uTime * 0.4);
          vec3 c = mix(vec3(0.16, 0.30, 0.86), vec3(0.34, 0.94, 0.90), 0.5 + 0.17 * w);
          c = mix(c, vec3(0.95, 0.42, 0.86), smoothstep(0.55, 1.0, sin(vP.x * 0.22 + vP.y * 0.31 + uTime * 0.2)) * 0.5);
          float s = sin(vP.x * 2.3 + sin(vP.y * 1.3) * 2.0 + uTime) * sin(vP.y * 2.1 + sin(vP.x * 0.9) * 2.0 - uTime * 0.8);
          c += pow(max(0.0, s), 14.0) * vec3(1.0, 0.9, 1.0) * 0.9;
          c *= 0.9 + 0.3 * uNight;
          float limb = smoothstep(0.7, 1.75, vAng);
          gl_FragColor = vec4(mix(c, c * 0.55 + uAtmo * 0.28, limb), 1.0);
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
      const count = Math.round(k.n * quality.scatter);
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
    scene.add(mesh);
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
          gl_FragColor = vec4(vC.rgb, vC.a * a);
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
      this.crop = G.mesh(new T.BufferGeometry(), { mat: G.mat.soft });
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
      }
      if (this.grow < 1) {
        this.grow = Math.min(1, this.grow + dt * 3.4);
        const t = this.grow;
        const s = 0.72 + 0.28 * (1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2));
        this.crop.scale.set(1, s, 1);
      } else if (stage === 3) {
        const sway = Math.sin(elapsed * 2.2 + this.cx * 0.7 + this.cz) * 0.018;
        this.crop.rotation.z = sway;
        this.crop.rotation.x = sway * 0.6;
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
    ghost.mat = G.bendMaterial(new T.MeshBasicMaterial({ color: 0x6ff5c8, transparent: true, opacity: 0.55, depthWrite: false }), { glow: false });
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
    hemi.intensity = OA.lerp(0.56, 0.78, night);
    sun.intensity = OA.lerp(0.62, 0.42, night);
    G.U.uNight.value = night;
    G.U.uRim.value.setHex(night > 0.5 ? 0x8fa0ff : 0xb8a0ff);
  };

  // ---- Boot and frame ----
  W.resize = () => {
    const el = renderer.domElement;
    const w = el.parentElement.clientWidth, h = el.parentElement.clientHeight;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const a = w / h;
    bgMat.uniforms.uScale.value.set(a > 1 ? 1 : a, a > 1 ? 1 / a : 1);
    stars.material.uniforms.uPx.value = pixelRatio;
  };

  W.init = (canvas, opts) => {
    const small = Math.min(root.innerWidth, root.innerHeight) < 560 || (root.navigator.hardwareConcurrency || 8) <= 4;
    pixelRatio = Math.min(root.devicePixelRatio || 1, small ? 1.75 : 2);
    quality = small ? { shadows: 1024, ground: 1024, scatter: 0.6 } : { shadows: 2048, ground: 2048, scatter: 1 };
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.autoClear = false;
    renderer.setClearColor(0x0b0830, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    W.renderer = renderer;

    G.initMaterials();
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(26, 1, 2, 900);
    W.camera = camera;
    hemi = new T.HemisphereLight(0xe6dcff, 0x6a58b0, 0.6);
    sun = new T.DirectionalLight(0xfff0dc, 0.75);
    sun.position.set(-24, 44, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality.shadows, quality.shadows);
    const s = sun.shadow.camera;
    s.left = -52; s.right = 52; s.top = 52; s.bottom = -52; s.near = 1; s.far = 130;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.05;
    scene.add(hemi, sun, sun.target);

    world = new T.Group();
    scene.add(world);
    things = new Map();
    initSky();
    initGround();
    initBubbles();
    initParticles();
    initBlobs();
    initSites();
    initGhost();
    wireEvents();
    return true;
  };

  W.setAtlas = (tex) => { bubbleSys.mat.uniforms.map.value = tex; };

  W.start = () => {
    W.sync();
    W.resize();
    root.addEventListener('resize', W.resize);
  };

  let frameTimes = 0, frameCount = 0;
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
    renderer.clear();
    renderer.render(bgScene, bgCam);
    renderer.clearDepth();
    renderer.render(scene, camera);
    // If frames run long, trade a little sharpness for smoothness.
    frameTimes += dt; frameCount++;
    if (frameTimes > 3) {
      const avg = frameTimes / frameCount;
      frameTimes = 0; frameCount = 0;
      if (avg > 0.03 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); W.resize(); }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
