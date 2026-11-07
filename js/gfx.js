// Orbit Acres: rendering foundation.
// The game map is a flat grid. A vertex shader wraps that grid around a sphere
// centered under the camera's focus, which is what makes the colony a tiny planet.
// Models are built here from primitives, each tagged with what it is made of
// (painted hull, brushed metal, glass, soil, leaf...) so the lighting can treat
// them like real materials.
(function (root) {
  const OA = root.OA;
  const G = (OA.Gfx = {});
  const T = root.THREE;

  G.R = 30; // planet radius in tiles

  // ---- Graphics quality ----
  G.TIERS = {
    high: { name: 'high', pbr: true, linear: true, detail: true, msaa: 4, bloom: 5, tilt: 0.5, shadow: 4096, ao: 30, aoDirs: 16, grass: 14000, seg: 1.6, plant: 1, scatter: 1, ground: 2048, pixel: 2, detailSize: 512 },
    medium: { name: 'medium', pbr: true, linear: true, detail: true, msaa: 0, bloom: 3, tilt: 0, shadow: 2048, ao: 18, aoDirs: 8, grass: 3000, seg: 1, plant: 0.55, scatter: 0.5, ground: 1024, pixel: 1.5, detailSize: 256 },
    low: { name: 'low', pbr: false, linear: false, detail: false, msaa: 0, bloom: 0, tilt: 0, shadow: 1024, ao: 0, aoDirs: 0, grass: 0, seg: 1, plant: 0.5, scatter: 0.5, ground: 1024, pixel: 1.25, detailSize: 0 },
  };
  G.Q = G.TIERS.high;
  G.setTier = (name) => { G.Q = G.TIERS[name] || G.TIERS.high; return G.Q; };

  G.U = {
    uFocus: { value: new T.Vector2(0, 0) },
    uR: { value: G.R },
    uTime: { value: 0 },
    uNight: { value: 0 },
    uNightGlow: { value: 0.15 },
    uGlowK: { value: 1 },
    uRim: { value: new T.Color(0x9f8cff) },
    uAtmo: { value: new T.Color(0x5fd8ff) },
    uDetail: { value: null },
  };

  // CPU copy of the bend, for placing screen-space things on the planet.
  G.bend = (x, y, z, out) => {
    const f = G.U.uFocus.value;
    const dx = x - f.x, dz = z - f.y;
    const r = Math.sqrt(dx * dx + dz * dz);
    const a = Math.min(r / G.R, 3.1415);
    const rad = G.R + y;
    const s = r > 1e-4 ? Math.sin(a) * rad / r : 0;
    out = out || new T.Vector3();
    out.set(f.x + dx * s, Math.cos(a) * rad - G.R, f.y + dz * s);
    return out;
  };
  // Angular distance from the focus: used to hide things over the horizon.
  G.angle = (x, z) => {
    const f = G.U.uFocus.value;
    return Math.hypot(x - f.x, z - f.y) / G.R;
  };

  const BEND_GLSL = `
    uniform vec2 uFocus;
    uniform float uR;
    varying float vAng;
    vec4 oaBend(vec4 w) {
      vec2 d = w.xz - uFocus;
      float r = length(d);
      float a = min(r / uR, 3.1415);
      vAng = a;
      float rad = uR + w.y;
      vec2 dir = r > 0.0001 ? d / r : vec2(0.0);
      w.xz = uFocus + dir * sin(a) * rad;
      w.y = cos(a) * rad - uR;
      return w;
    }`;
  G.BEND_GLSL = BEND_GLSL;

  const LIMB_GLSL = `
    float limb = smoothstep(0.7, 1.75, vAng);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.55 + uAtmo * 0.28, limb);`;

  const insert = (src, find, add, before) => {
    if (!src.includes(find)) throw new Error('Shader hook missing: ' + find);
    return src.replace(find, before ? add + '\n' + find : find + '\n' + add);
  };
  const INSTANCED_WORLD = `
    vec4 oaW = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      oaW = instanceMatrix * oaW;
    #endif
    oaW = modelMatrix * oaW;`;
  const SWAY = `
    #ifdef OA_SWAY
      vec4 oaO = vec4(0.0, 0.0, 0.0, 1.0);
      #ifdef USE_INSTANCING
        oaO = instanceMatrix * oaO;
      #endif
      oaO = modelMatrix * oaO;
      float oaT = uTime * 1.7 + oaO.x * 0.55 + oaO.z * 0.7 + position.x * 1.6 + position.z * 1.3;
      float oaS = aMisc.y * aMisc.y;
      transformed.x += (sin(oaT) * 0.055 + sin(oaT * 2.3) * 0.018) * oaS;
      transformed.z += cos(oaT * 0.83) * 0.045 * oaS;
    #endif`;

  // ---- Physically based materials ----
  const bendStandard = (mat, opts) => {
    const rim = (opts.rim === undefined ? 0.2 : opts.rim).toFixed(3);
    const key = 'oa-std-' + JSON.stringify(opts);
    mat.defines = mat.defines || {};
    if (opts.detail) mat.defines.OA_DETAIL = '';
    if (opts.sway) mat.defines.OA_SWAY = '';
    if (opts.flat) mat.defines.OA_FLATSURF = '';
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, G.U);
      let v = sh.vertexShader;
      let f = sh.fragmentShader;
      v = insert(v, '#include <common>', BEND_GLSL + `
        uniform float uTime;
        varying vec4 vSurf;
        varying vec2 vMisc;
        varying vec3 vDP;
        varying vec3 vDN;
        #ifndef OA_FLATSURF
          attribute vec4 aSurf;
          attribute vec2 aMisc;
        #endif`);
      v = insert(v, '#include <begin_vertex>', SWAY);
      v = insert(v, '#include <fog_vertex>', `
        ${INSTANCED_WORLD}
        #ifdef OA_FLATSURF
          vSurf = vec4(0.94, 0.0, 3.0, 0.0);
          vMisc = vec2(1.0, 0.0);
          vDP = vec3(oaW.x, 0.0, oaW.z) * 0.62;
          vDN = vec3(0.0, 1.0, 0.0);
        #else
          vSurf = aSurf;
          vMisc = aMisc;
          float oaK = aSurf.z < 1.5 ? 0.42 : aSurf.z < 2.5 ? 0.8 : aSurf.z < 3.5 ? 1.1 : 2.4;
          vDP = position * oaK;
          vDN = normal;
        #endif
        ${opts.noBend ? 'vAng = 0.0;' : 'gl_Position = projectionMatrix * viewMatrix * oaBend(oaW);'}`);
      f = insert(f, '#include <common>', `
        uniform vec3 uAtmo;
        uniform vec3 uRim;
        uniform float uNight;
        uniform float uNightGlow;
        uniform float uGlowK;
        uniform sampler2D uDetail;
        varying float vAng;
        varying vec4 vSurf;
        varying vec2 vMisc;
        varying vec3 vDP;
        varying vec3 vDN;
        #ifdef OA_DETAIL
          vec4 oaTri(vec3 p, vec3 n) {
            vec3 w = pow(abs(n), vec3(4.0));
            w /= (w.x + w.y + w.z + 0.0001);
            return texture2D(uDetail, p.zy) * w.x + texture2D(uDetail, p.xz) * w.y + texture2D(uDetail, p.xy) * w.z;
          }
        #endif`);
      f = insert(f, '#include <color_fragment>', `
        float oaCls = floor(vSurf.z + 0.5);
        float oaDet = 0.5;
        #ifdef OA_DETAIL
          if (oaCls > 0.5) {
            vec4 oaD = oaTri(vDP, normalize(vDN));
            oaDet = oaCls < 1.5 ? oaD.r : oaCls < 2.5 ? oaD.g : oaCls < 3.5 ? oaD.b : oaD.a;
            float oaMix = oaCls < 1.5 ? 0.62 : oaCls < 2.5 ? 0.3 : 0.85;
            diffuseColor.rgb *= mix(1.0, 0.5 + oaDet, oaMix);
          }
        #endif`);
      f = insert(f, '#include <roughnessmap_fragment>', 'roughnessFactor = clamp(vSurf.x + (oaDet - 0.5) * 0.4, 0.04, 1.0);');
      f = insert(f, '#include <metalnessmap_fragment>', 'metalnessFactor = vSurf.y;');
      f = insert(f, '#include <normal_fragment_maps>', `
        #ifdef OA_DETAIL
          if (oaCls > 0.5) {
            float oaAmp = oaCls < 1.5 ? 0.05 : oaCls < 2.5 ? 0.012 : oaCls < 3.5 ? 0.09 : 0.03;
            vec3 oaSp = -vViewPosition;
            vec3 oaSx = dFdx(oaSp);
            vec3 oaSy = dFdy(oaSp);
            vec3 oaR1 = cross(oaSy, normal);
            vec3 oaR2 = cross(normal, oaSx);
            float oaDetM = dot(oaSx, oaR1) * (float(gl_FrontFacing) * 2.0 - 1.0);
            vec3 oaGrad = sign(oaDetM) * (dFdx(oaDet) * oaAmp * oaR1 + dFdy(oaDet) * oaAmp * oaR2);
            normal = normalize(abs(oaDetM) * normal - oaGrad);
          }
        #endif`);
      f = insert(f, '#include <emissivemap_fragment>', `
        float oaGlow = vSurf.w >= 0.0 ? vSurf.w : -vSurf.w * uNightGlow;
        totalEmissiveRadiance += diffuseColor.rgb * oaGlow * uGlowK;
        totalEmissiveRadiance += uRim * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0) * ${rim};`);
      f = insert(f, '#include <aomap_fragment>', `
        reflectedLight.indirectDiffuse *= vMisc.x;
        reflectedLight.indirectSpecular *= vMisc.x;
        reflectedLight.directDiffuse *= mix(1.0, vMisc.x, 0.35);`);
      if (!opts.noLimb) f = insert(f, '#include <dithering_fragment>', LIMB_GLSL);
      sh.vertexShader = v;
      sh.fragmentShader = f;
      mat.userData.shader = sh;
    };
    mat.customProgramCacheKey = () => key;
    return mat;
  };

  // ---- Lighter shading for weak devices, and for grass ----
  const bendLambert = (mat, opts) => {
    const glow = !opts.flat;
    const key = 'oa-lam-' + JSON.stringify(opts);
    mat.defines = mat.defines || {};
    if (opts.sway) mat.defines.OA_SWAY = '';
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, G.U);
      let v = sh.vertexShader;
      let f = sh.fragmentShader;
      v = insert(v, '#include <common>', BEND_GLSL + `
        uniform float uTime;
        ${glow ? 'attribute vec4 aSurf;\nvarying float vGlow;\nvarying float vRim;\n' : ''}
        attribute vec2 aMisc;
        varying float vAO;`);
      v = insert(v, '#include <begin_vertex>', SWAY);
      v = insert(v, '#include <fog_vertex>', `
        vAO = ${glow ? 'aMisc.x' : '1.0'};
        ${glow ? `vGlow = aSurf.w >= 0.0 ? aSurf.w : -aSurf.w * 0.8;
        vRim = pow(1.0 - clamp(dot(normalize(transformedNormal), normalize(-mvPosition.xyz)), 0.0, 1.0), 2.4);` : ''}
        ${INSTANCED_WORLD}
        ${opts.noBend ? 'vAng = 0.0;' : 'gl_Position = projectionMatrix * viewMatrix * oaBend(oaW);'}`);
      f = insert(f, '#include <common>', `
        uniform vec3 uAtmo;
        uniform vec3 uRim;
        uniform float uNight;
        varying float vAng;
        varying float vAO;
        ${glow ? 'varying float vGlow;\nvarying float vRim;\n' : ''}`);
      if (glow) {
        f = insert(f, '#include <emissivemap_fragment>', `
          totalEmissiveRadiance += diffuseColor.rgb * vGlow * (0.75 + 0.55 * uNight);
          totalEmissiveRadiance += uRim * vRim * ${(opts.rim === undefined ? 0.34 : opts.rim).toFixed(3)};`);
      }
      f = insert(f, '#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= vAO;');
      if (!opts.noLimb) f = insert(f, '#include <dithering_fragment>', LIMB_GLSL);
      sh.vertexShader = v;
      sh.fragmentShader = f;
      mat.userData.shader = sh;
    };
    mat.customProgramCacheKey = () => key;
    return mat;
  };

  // ---- Bend only: soft shadows, placement guides ----
  const bendBasic = (mat, opts) => {
    const key = 'oa-basic-' + JSON.stringify(opts);
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, G.U);
      let v = sh.vertexShader;
      let f = sh.fragmentShader;
      v = insert(v, '#include <common>', BEND_GLSL);
      v = insert(v, '#include <fog_vertex>', INSTANCED_WORLD + '\ngl_Position = projectionMatrix * viewMatrix * oaBend(oaW);');
      f = insert(f, '#include <common>', 'uniform vec3 uAtmo;\nvarying float vAng;');
      if (!opts.noLimb) f = insert(f, '#include <dithering_fragment>', LIMB_GLSL);
      sh.vertexShader = v;
      sh.fragmentShader = f;
    };
    mat.customProgramCacheKey = () => key;
    return mat;
  };

  G.bendMaterial = (mat, opts = {}) => {
    if (mat.isMeshStandardMaterial) return bendStandard(mat, opts);
    if (mat.isMeshLambertMaterial) return bendLambert(mat, opts);
    return bendBasic(mat, opts);
  };

  G.mat = {};
  G.initMaterials = () => {
    const m = G.mat;
    const Q = G.Q;
    if (Q.pbr) {
      const std = (o) => new T.MeshStandardMaterial(Object.assign({ vertexColors: true }, o));
      m.solid = G.bendMaterial(std(), { detail: Q.detail, rim: 0.16 });
      m.soft = G.bendMaterial(std(), { detail: Q.detail, rim: 0.08 });
      m.plant = G.bendMaterial(std({ side: T.DoubleSide }), { sway: true, rim: 0.05 });
      m.ground = G.bendMaterial(new T.MeshStandardMaterial({ roughness: 1, metalness: 0 }), { flat: true, detail: Q.detail, rim: 0 });
      m.terrain = G.bendMaterial(std({ roughness: 1, metalness: 0 }), { flat: true, detail: Q.detail, rim: 0 });
      m.icon = G.bendMaterial(std(), { noBend: true, noLimb: true, rim: 0.1 });
      m.grass = G.bendMaterial(new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }), { flat: true, sway: true, rim: 0 });
    } else {
      const lam = (o) => new T.MeshLambertMaterial(Object.assign({ vertexColors: true }, o));
      m.solid = G.bendMaterial(lam());
      m.soft = G.bendMaterial(lam(), { rim: 0.22 });
      m.plant = G.bendMaterial(lam({ side: T.DoubleSide }), { sway: true, rim: 0.1 });
      m.ground = G.bendMaterial(new T.MeshLambertMaterial({ vertexColors: false }), { flat: true });
      m.terrain = G.bendMaterial(lam(), { flat: true });
      m.icon = G.bendMaterial(lam(), { noBend: true, noLimb: true, rim: 0.3 });
      m.grass = G.bendMaterial(lam({ side: T.DoubleSide }), { flat: true, sway: true });
    }
    G.U.uGlowK.value = Q.pbr ? 2.6 : 1;
  };

  // ---- Surface detail: plating, brushed metal, grit and soft organic texture ----
  // All four live in one small tiling texture, one per color channel.
  G.makeDetail = (S) => {
    const data = new Uint8Array(S * S * 4);
    const hash = (x, y) => OA.hash(x + 0.37, y + 0.71);
    const pnoise = (x, y, px, py) => {
      const ix = Math.floor(x), iy = Math.floor(y);
      const fx = x - ix, fy = y - iy;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const w = (i, j) => hash(((i % px) + px) % px, ((j % py) + py) % py);
      const a = w(ix, iy), b = w(ix + 1, iy), c = w(ix, iy + 1), d = w(ix + 1, iy + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    const fbm = (x, y, per, oct) => {
      let v = 0, amp = 0.5, total = 0;
      for (let i = 0; i < oct; i++) {
        const f = 1 << i;
        v += pnoise(x * per * f, y * per * f, per * f, per * f) * amp;
        total += amp;
        amp *= 0.5;
      }
      return v / total;
    };
    const K = S / 512;
    const rows = 4, rh = S / rows;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = x / S, v = y / S;
        const grain = fbm(u, v, 12, 4);
        // Red: hull plates with seams and rivets.
        const r = Math.floor(y / rh);
        const cols = r % 2 ? 2 : 3;
        const cw = S / cols;
        const xx = (x + (r % 2 ? cw / 2 : 0)) % S;
        const c = Math.floor(xx / cw);
        const dx = Math.min(xx % cw, cw - (xx % cw));
        const dy = Math.min(y % rh, rh - (y % rh));
        const seam = Math.min(dx, dy) / K;
        let h = 0.5 + (hash(r + 1, c + 5) - 0.5) * 0.12 + (grain - 0.5) * 0.14;
        if (seam < 2.6) h *= 0.2 + 0.8 * (seam / 2.6);
        const ry = dy / K - 9;
        const rx = (((xx / K + 21) % 42) + 42) % 42 - 21;
        const rd = Math.hypot(rx, ry);
        if (rd < 3.4) h = 0.86 - rd * 0.07;
        // Green: brushed metal.
        const brush = 0.5 + (pnoise(u * 5, v * 90, 5, 90) - 0.5) * 0.55 + (pnoise(u * 11, v * 190, 11, 190) - 0.5) * 0.25;
        // Blue: grit for soil, rock and wood.
        const grit = OA.clamp((fbm(u, v, 7, 5) - 0.5) * 2.1 + 0.5, 0, 1);
        // Alpha: soft ridges for leaves, fur and fruit skin.
        const n = fbm(u, v, 18, 3);
        const soft = OA.clamp(0.72 - Math.abs(n - 0.5) * 2.2 + (grain - 0.5) * 0.4, 0, 1);
        const o = (y * S + x) * 4;
        data[o] = OA.clamp(h, 0, 1) * 255;
        data[o + 1] = OA.clamp(brush, 0, 1) * 255;
        data[o + 2] = grit * 255;
        data[o + 3] = soft * 255;
      }
    }
    const tex = new T.DataTexture(data, S, S, T.RGBAFormat);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.minFilter = T.LinearMipmapLinearFilter;
    tex.magFilter = T.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    G.U.uDetail.value = tex;
    return tex;
  };

  // ---- What things are made of ----
  // r roughness, m metalness, c detail channel (0 none, 1 plates, 2 brushed, 3 grit, 4 soft).
  const SURF = (G.SURF = {
    hull: { r: 0.38, m: 0.08, c: 1 },
    paint: { r: 0.3, m: 0, c: 0 },
    metal: { r: 0.3, m: 0.95, c: 2 },
    chrome: { r: 0.1, m: 1, c: 0 },
    dark: { r: 0.55, m: 0.35, c: 2 },
    rubber: { r: 0.8, m: 0, c: 3 },
    glass: { r: 0.05, m: 0.9, c: 0 },
    lamp: { r: 0.25, m: 0, c: 0 },
    wood: { r: 0.72, m: 0, c: 3 },
    soil: { r: 0.97, m: 0, c: 3 },
    rock: { r: 0.82, m: 0.02, c: 3 },
    crystal: { r: 0.1, m: 0.25, c: 0 },
    leaf: { r: 0.55, m: 0, c: 0 },
    fruit: { r: 0.32, m: 0, c: 4 },
    fur: { r: 0.92, m: 0, c: 4 },
    skin: { r: 0.48, m: 0, c: 4 },
    fabric: { r: 0.86, m: 0, c: 4 },
    eye: { r: 0.06, m: 0, c: 0 },
  });

  // ---- Baked shading: crevices and undersides get darker ----
  const fibonacci = (n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.399963;
      out.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
    return out;
  };
  const bakeAO = (pos, nor, idx, mis, N, dirs, ground) => {
    const count = pos.length / 3;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < count; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    const s = Math.max(x1 - x0, y1 - y0, z1 - z0, 0.001) / N;
    const ox = x0 - s, oy = y0 - s, oz = z0 - s;
    const nx = Math.ceil((x1 - x0) / s) + 3, ny = Math.ceil((y1 - y0) / s) + 3, nz = Math.ceil((z1 - z0) / s) + 3;
    const grid = new Uint8Array(nx * ny * nz);
    const mark = (x, y, z) => {
      const i = ((x - ox) / s) | 0, j = ((y - oy) / s) | 0, k = ((z - oz) / s) | 0;
      grid[i + nx * (j + ny * k)] = 1;
    };
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
      const bx = pos[b], by = pos[b + 1], bz = pos[b + 2];
      const cx = pos[c], cy = pos[c + 1], cz = pos[c + 2];
      const e = Math.max(Math.abs(bx - ax), Math.abs(by - ay), Math.abs(bz - az), Math.abs(cx - ax), Math.abs(cy - ay), Math.abs(cz - az));
      const q = Math.min(16, Math.ceil(e / (s * 0.75)) || 1);
      for (let u = 0; u <= q; u++) {
        for (let v = 0; v <= q - u; v++) {
          const w = q - u - v;
          mark((ax * u + bx * v + cx * w) / q, (ay * u + by * v + cy * w) / q, (az * u + bz * v + cz * w) / q);
        }
      }
    }
    const D = fibonacci(dirs * 2);
    const steps = 8;
    for (let i = 0; i < count; i++) {
      if (mis[i * 2] > 1) { mis[i * 2] = 1; continue; }
      const nxv = nor[i * 3], nyv = nor[i * 3 + 1], nzv = nor[i * 3 + 2];
      const px = pos[i * 3] + nxv * s * 1.2, py = pos[i * 3 + 1] + nyv * s * 1.2, pz = pos[i * 3 + 2] + nzv * s * 1.2;
      let occ = 0, sum = 0;
      for (let d = 0; d < D.length; d += 3) {
        const dot = D[d] * nxv + D[d + 1] * nyv + D[d + 2] * nzv;
        if (dot < 0.12) continue;
        sum += dot;
        for (let k = 1; k <= steps; k++) {
          const t = s * (0.8 + k * 0.95);
          const qx = px + D[d] * t, qy = py + D[d + 1] * t, qz = pz + D[d + 2] * t;
          if (ground && qy < 0.02) { occ += dot * (1 - (k - 1) / (steps + 2)); break; }
          const a = ((qx - ox) / s) | 0, b = ((qy - oy) / s) | 0, c = ((qz - oz) / s) | 0;
          if (a < 0 || b < 0 || c < 0 || a >= nx || b >= ny || c >= nz) continue;
          if (grid[a + nx * (b + ny * c)]) { occ += dot * (1 - (k - 1) / steps); break; }
        }
      }
      mis[i * 2] = sum > 0 ? 1 - Math.min(0.88, (occ / sum) * 1.45) : 1;
    }
  };

  // ---- Shapes ----
  const baseGeo = {};
  const shape = (key, make) => (baseGeo[key] = baseGeo[key] || make());
  const tmpM = new T.Matrix4();
  const tmpQ = new T.Quaternion();
  const tmpE = new T.Euler();
  const tmpP = new T.Vector3();
  const tmpS = new T.Vector3();
  const tmpV = new T.Vector3();
  const tmpN = new T.Vector3();
  const nm = new T.Matrix3();
  const colA = new T.Color();
  const colB = new T.Color();
  const colC = new T.Color();
  const toLinear = (c) => { if (G.Q.linear) c.convertSRGBToLinear(); return c; };
  const segs = (n) => (n < 8 ? n : Math.round(n * G.Q.seg));

  // A box with soft corners: looks like a molded part.
  const roundedBox = (w, h, d, r, seg = 3) => {
    const g = new T.BoxGeometry(1, 1, 1, seg * 2, seg * 2, seg * 2);
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const inner = [w / 2 - r, h / 2 - r, d / 2 - r];
    const edge = 1 / seg;
    // The middle band stays flat; the outer bands wrap around the corners.
    const remap = (t, i) => {
      const q = Math.abs(t) * 2;
      const v = q <= edge ? (q / edge) * inner[i] : inner[i] + ((q - edge) / (1 - edge)) * r;
      return Math.sign(t) * v;
    };
    const clamp = (v, m) => Math.max(-m, Math.min(m, v));
    for (let i = 0; i < pos.count; i++) {
      const px = remap(pos.getX(i), 0), py = remap(pos.getY(i), 1), pz = remap(pos.getZ(i), 2);
      const cx = clamp(px, inner[0]), cy = clamp(py, inner[1]), cz = clamp(pz, inner[2]);
      let nx = px - cx, ny = py - cy, nz = pz - cz;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      pos.setXYZ(i, cx + nx * r, cy + ny * r, cz + nz * r);
      nor.setXYZ(i, nx, ny, nz);
    }
    return g;
  };

  // Spins a profile around the Y axis. Each profile point is [radius, y, normalR, normalY].
  const latheGeo = (prof, seg) => {
    const pos = [], nor = [], uv = [], idx = [];
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      for (let i = 0; i < prof.length; i++) {
        const [r, y, nr, ny] = prof[i];
        pos.push(r * s, y, r * c);
        nor.push(nr * s, ny, nr * c);
        uv.push(j / seg, i / (prof.length - 1));
      }
    }
    const n = prof.length;
    for (let j = 0; j < seg; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i, b = a + 1, c = (j + 1) * n + i, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  };
  // A cylinder whose rims are softly rounded, so edges catch the light.
  const bevelCyl = (rt, rb, h, b, seg) => {
    const hy = h / 2;
    const side = Math.hypot(h, rb - rt) || 1;
    const sn = [h / side, (rb - rt) / side];
    const prof = [[0, -hy, 0, -1], [Math.max(rb - b, 0.001), -hy, 0, -1]];
    prof.push([rb - b * 0.29, -hy + b * 0.29, 0.707, -0.707]);
    prof.push([rb, -hy + b, sn[0], sn[1]]);
    prof.push([rt, hy - b, sn[0], sn[1]]);
    prof.push([rt - b * 0.29, hy - b * 0.29, 0.707, 0.707]);
    prof.push([Math.max(rt - b, 0.001), hy, 0, 1], [0, hy, 0, 1]);
    return latheGeo(prof, seg);
  };
  // An indexed sphere, so lumpy shapes keep smooth shading.
  const icoSphere = (detail) => {
    const t = (1 + Math.sqrt(5)) / 2;
    let verts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    verts = verts.map(([x, y, z]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; });
    let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let d = 0; d < detail; d++) {
      const mid = new Map();
      const next = [];
      const midpoint = (a, b) => {
        const k = a < b ? a + '_' + b : b + '_' + a;
        if (mid.has(k)) return mid.get(k);
        const p = verts[a], q = verts[b];
        let x = p[0] + q[0], y = p[1] + q[1], z = p[2] + q[2];
        const l = Math.hypot(x, y, z);
        x /= l; y /= l; z /= l;
        verts.push([x, y, z]);
        mid.set(k, verts.length - 1);
        return verts.length - 1;
      };
      faces.forEach(([a, b, c]) => {
        const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
        next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
      });
      faces = next;
    }
    return { verts, faces };
  };

  class Mesher {
    constructor(opts = {}) {
      this.pos = []; this.nor = []; this.col = []; this.sur = []; this.mis = []; this.idx = [];
      this.count = 0;
      this.surf = opts.surf || 'hull';
      this.noAO = !!opts.noAO;
      this.ground = opts.ground !== false;
      this.sway = !!opts.sway;
    }
    // Sets what the next parts are made of.
    use(name) { this.surf = name; return this; }
    // Draws with another material, then switches back.
    made(name, fn) { const keep = this.surf; this.surf = name; fn(this); this.surf = keep; return this; }

    // o: p [x,y,z], r [rx,ry,rz], s number|[x,y,z], glow, night (glows after dark),
    // top (color at the top), paint (x,y,z)=>hex, surf (material name)
    add(geo, color, o = {}) {
      const p = o.p || [0, 0, 0];
      const rot = o.r || [0, 0, 0];
      const sc = o.s === undefined ? 1 : o.s;
      tmpP.set(p[0], p[1], p[2]);
      tmpQ.setFromEuler(tmpE.set(rot[0], rot[1], rot[2]));
      if (Array.isArray(sc)) tmpS.set(sc[0], sc[1], sc[2]); else tmpS.set(sc, sc, sc);
      tmpM.compose(tmpP, tmpQ, tmpS);
      if (this.xf) tmpM.premultiply(this.xf);
      nm.getNormalMatrix(tmpM);
      const pa = geo.attributes.position;
      const na = geo.attributes.normal;
      const glow = o.night ? -o.night : o.glow || 0;
      const mat = SURF[o.surf || this.surf];
      toLinear(colA.setHex(color));
      if (o.top !== undefined) toLinear(colB.setHex(o.top));
      let minY = Infinity, maxY = -Infinity;
      if (o.top !== undefined) {
        for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      const base = this.count;
      for (let i = 0; i < pa.count; i++) {
        const lx = pa.getX(i), ly = pa.getY(i), lz = pa.getZ(i);
        tmpV.set(lx, ly, lz).applyMatrix4(tmpM);
        tmpN.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
        this.pos.push(tmpV.x, tmpV.y, tmpV.z);
        this.nor.push(tmpN.x, tmpN.y, tmpN.z);
        let r = colA.r, g = colA.g, b = colA.b;
        if (o.paint) {
          toLinear(colC.setHex(o.paint(lx, ly, lz)));
          r = colC.r; g = colC.g; b = colC.b;
        } else if (o.top !== undefined) {
          const t = (ly - minY) / Math.max(1e-5, maxY - minY);
          r += (colB.r - r) * t; g += (colB.g - g) * t; b += (colB.b - b) * t;
        }
        this.col.push(r, g, b);
        this.sur.push(mat.r, mat.m, mat.c, glow);
        this.mis.push(o.noBake ? 2 : 1, 0);
      }
      if (geo.index) {
        const ia = geo.index;
        for (let i = 0; i < ia.count; i++) this.idx.push(base + ia.getX(i));
      } else {
        for (let i = 0; i < pa.count; i++) this.idx.push(base + i);
      }
      this.count += pa.count;
      return this;
    }
    // Draw a sub-model at an offset and scale (signs on roofs and so on).
    at(p, s, fn, rotY = 0) {
      const keep = this.xf;
      const xf = new T.Matrix4().compose(new T.Vector3(p[0], p[1], p[2]), new T.Quaternion().setFromEuler(new T.Euler(0, rotY, 0)), new T.Vector3(s, s, s));
      this.xf = keep ? keep.clone().multiply(xf) : xf;
      fn(this);
      this.xf = keep;
      return this;
    }
    box(w, h, d, color, o = {}) {
      return this.add(shape('box', () => new T.BoxGeometry(1, 1, 1)), color, Object.assign({}, o, { s: [w, h, d] }));
    }
    // Rounded box. r is the corner radius.
    rbox(w, h, d, r, color, o = {}) {
      const key = 'rb' + w.toFixed(2) + h.toFixed(2) + d.toFixed(2) + r.toFixed(2);
      return this.add(shape(key, () => roundedBox(w, h, d, Math.min(r, w / 2, h / 2, d / 2))), color, o);
    }
    sph(rad, color, o = {}) {
      const seg = segs(o.seg || 14);
      const s = o.s === undefined ? 1 : o.s;
      const sv = Array.isArray(s) ? [s[0] * rad, s[1] * rad, s[2] * rad] : [s * rad, s * rad, s * rad];
      return this.add(shape('sph' + seg, () => new T.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.7)))), color, Object.assign({}, o, { s: sv }));
    }
    dome(rad, color, o = {}) {
      const seg = segs(o.seg || 16);
      const s = o.s === undefined ? 1 : o.s;
      const sv = Array.isArray(s) ? [s[0] * rad, s[1] * rad, s[2] * rad] : [s * rad, s * rad, s * rad];
      return this.add(shape('dome' + seg, () => new T.SphereGeometry(1, seg, Math.round(seg / 2), 0, Math.PI * 2, 0, Math.PI / 2)), color, Object.assign({}, o, { s: sv }));
    }
    cyl(rt, rb, h, color, o = {}) {
      const seg = segs(o.seg || 14);
      const big = Math.max(rt, rb) > 0.2 && h > 0.08 && !o.open && seg >= 8;
      const b = o.bevel !== undefined ? o.bevel : big ? Math.min(0.045, h * 0.22, Math.min(rt, rb) * 0.5) : 0;
      if (b > 0.004 && Math.min(rt, rb) > b * 1.2) {
        const key = 'bc' + seg + rt.toFixed(3) + rb.toFixed(3) + h.toFixed(3) + b.toFixed(3);
        const sc = o.s || 1;
        return this.add(shape(key, () => bevelCyl(rt, rb, h, b, seg)), color, Object.assign({}, o, { s: [sc, 1, sc] }));
      }
      const key = 'cyl' + seg + (o.open ? 'o' : '') + rt.toFixed(3) + rb.toFixed(3);
      return this.add(shape(key, () => new T.CylinderGeometry(rt, rb, 1, seg, 1, !!o.open)), color, Object.assign({}, o, { s: o.s ? [o.s, h, o.s] : [1, h, 1] }));
    }
    cone(rad, h, color, o = {}) {
      const seg = segs(o.seg || 10);
      return this.add(shape('cone' + seg, () => new T.ConeGeometry(1, 1, seg)), color, Object.assign({}, o, { s: [rad, h, rad] }));
    }
    tor(rad, tube, color, o = {}) {
      const seg = segs(o.seg || 18);
      const arc = o.arc || 6.2832;
      const key = 'tor' + seg + arc.toFixed(2) + (tube / rad).toFixed(3);
      return this.add(shape(key, () => new T.TorusGeometry(1, tube / rad, 8, seg, arc)), color, Object.assign({}, o, { s: o.s ? o.s : rad }));
    }
    // Low-poly faceted shapes for rock and crystal.
    ico(rad, color, o = {}) {
      const g = shape('ico' + (o.detail || 0), () => {
        const k = new T.IcosahedronGeometry(1, o.detail || 0);
        k.computeVertexNormals();
        return k;
      });
      const s = o.s === undefined ? 1 : o.s;
      const sv = Array.isArray(s) ? [s[0] * rad, s[1] * rad, s[2] * rad] : [s * rad, s * rad, s * rad];
      return this.add(g, color, Object.assign({}, o, { s: sv }));
    }
    octa(rad, color, o = {}) {
      const g = shape('octa', () => { const k = new T.OctahedronGeometry(1, 0); k.computeVertexNormals(); return k; });
      const s = o.s === undefined ? 1 : o.s;
      const sv = Array.isArray(s) ? [s[0] * rad, s[1] * rad, s[2] * rad] : [s * rad, s * rad, s * rad];
      return this.add(g, color, Object.assign({}, o, { s: sv }));
    }
    // A lumpy rounded shape, for tree crowns, fluff and boulders.
    // bump(x,y,z) returns how far to push each point outward.
    blob(rad, color, o = {}) {
      const detail = o.detail === undefined ? 3 : o.detail;
      const seed = o.seed || 0;
      const lump = o.lump === undefined ? 0.2 : o.lump;
      const freq = o.freq || 2.2;
      const { verts, faces } = icoSphere(detail);
      const bump = o.bump || ((x, y, z) => (OA.fbm(x * freq + seed * 3.1 + z * 1.3, y * freq + seed + z * 0.7, 3) - 0.48) * lump * 2);
      const pos = [], idx = [];
      verts.forEach(([x, y, z]) => {
        const k = 1 + bump(x, y, z);
        pos.push(x * k, y * k, z * k);
      });
      faces.forEach((f) => idx.push(f[0], f[1], f[2]));
      let g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      if (o.facets) g = g.toNonIndexed();
      g.computeVertexNormals();
      const s = o.s === undefined ? 1 : o.s;
      const sv = Array.isArray(s) ? [s[0] * rad, s[1] * rad, s[2] * rad] : [s * rad, s * rad, s * rad];
      return this.add(g, color, Object.assign({}, o, { s: sv }));
    }
    // A shape turned on a lathe. points are [radius, y]; smooth unless sharp is set.
    lathe(points, color, o = {}) {
      const seg = segs(o.seg || 16);
      const prof = points.map((p, i) => {
        const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
        const dr = b[0] - a[0], dy = b[1] - a[1];
        const l = Math.hypot(dr, dy) || 1;
        return [p[0], p[1], dy / l, -dr / l];
      });
      return this.add(latheGeo(prof, seg), color, o);
    }
    // A tube from point a to point b.
    pipe(a, b, rad, color, o = {}) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz);
      const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx / len, dy / len, dz / len));
      const e = new T.Euler().setFromQuaternion(q);
      return this.cyl(rad, rad, len, color, Object.assign({}, o, { p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r: [e.x, e.y, e.z], seg: o.seg || 8, bevel: 0 }));
    }
    // One raw vertex, in model space.
    vert(x, y, z, nx, ny, nz, r, g, b, mat, glow) {
      if (this.xf) {
        tmpV.set(x, y, z).applyMatrix4(this.xf);
        nm.getNormalMatrix(this.xf);
        tmpN.set(nx, ny, nz).applyMatrix3(nm).normalize();
        this.pos.push(tmpV.x, tmpV.y, tmpV.z);
        this.nor.push(tmpN.x, tmpN.y, tmpN.z);
      } else {
        this.pos.push(x, y, z);
        this.nor.push(nx, ny, nz);
      }
      this.col.push(r, g, b);
      this.sur.push(mat.r, mat.m, mat.c, glow || 0);
      this.mis.push(1, 0);
      return this.count++;
    }
    // A tube along a list of points, with a radius for each. Stems, vines, trunks.
    tube(pts, radii, color, o = {}) {
      const sides = o.sides || 5;
      const mat = SURF[o.surf || this.surf];
      const c0 = toLinear(new T.Color(color));
      const c1 = o.top !== undefined ? toLinear(new T.Color(o.top)) : c0;
      const n = pts.length;
      const ref = [0.31, 0.2, 0.93];
      const first = this.count;
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl; ty /= tl; tz /= tl;
        let ux = ty * ref[2] - tz * ref[1], uy = tz * ref[0] - tx * ref[2], uz = tx * ref[1] - ty * ref[0];
        const ul = Math.hypot(ux, uy, uz) || 1;
        ux /= ul; uy /= ul; uz /= ul;
        const vx = ty * uz - tz * uy, vy = tz * ux - tx * uz, vz = tx * uy - ty * ux;
        const rad = Array.isArray(radii) ? radii[i] : radii;
        const t = i / (n - 1);
        const r = c0.r + (c1.r - c0.r) * t, g = c0.g + (c1.g - c0.g) * t, bl = c0.b + (c1.b - c0.b) * t;
        for (let s = 0; s < sides; s++) {
          const q = (s / sides) * Math.PI * 2;
          const cs = Math.cos(q), sn = Math.sin(q);
          const nx = ux * cs + vx * sn, ny = uy * cs + vy * sn, nz = uz * cs + vz * sn;
          this.vert(pts[i][0] + nx * rad, pts[i][1] + ny * rad, pts[i][2] + nz * rad, nx, ny, nz, r, g, bl, mat, o.glow);
        }
      }
      for (let i = 0; i < n - 1; i++) {
        for (let s = 0; s < sides; s++) {
          const a = first + i * sides + s, b = first + i * sides + ((s + 1) % sides);
          const c = a + sides, d = b + sides;
          this.idx.push(a, c, b, b, c, d);
        }
      }
      return this;
    }
    // A flat strip along a line, folded down its middle. Leaves, blades, petals.
    ribbon(pts, widths, color, o = {}) {
      const mat = SURF[o.surf || this.surf || 'leaf'];
      const c0 = toLinear(new T.Color(color));
      const c1 = o.tip !== undefined ? toLinear(new T.Color(o.tip)) : c0;
      const fold = o.fold === undefined ? 0.25 : o.fold;
      const n = pts.length;
      const first = this.count;
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl; ty /= tl; tz /= tl;
        // Sideways across the strip, staying level with the ground.
        let sx = o.side ? o.side[0] : -tz, sy = o.side ? o.side[1] : 0, sz = o.side ? o.side[2] : tx;
        let sl = Math.hypot(sx, sy, sz);
        if (sl < 0.001) { sx = 1; sy = 0; sz = 0; sl = 1; }
        sx /= sl; sy /= sl; sz /= sl;
        // Facing direction of the strip.
        const nx = sy * tz - sz * ty, ny = sz * tx - sx * tz, nz = sx * ty - sy * tx;
        const w = widths[i] / 2;
        const t = i / (n - 1);
        const r = c0.r + (c1.r - c0.r) * t, g = c0.g + (c1.g - c0.g) * t, bl = c0.b + (c1.b - c0.b) * t;
        const p = pts[i];
        const lift = w * fold;
        if (o.up) {
          [[-1, 0.9], [0, 1.12], [1, 0.9]].forEach(([k, shade]) => this.vert(p[0] + sx * w * k, p[1] + sy * w * k, p[2] + sz * w * k, 0.06 * k, 1, 0.06, r * shade, g * shade, bl * shade, mat, 0));
          continue;
        }
        this.vert(p[0] - sx * w + nx * lift, p[1] - sy * w + ny * lift, p[2] - sz * w + nz * lift, nx - sx * fold, ny - sy * fold, nz - sz * fold, r * 0.9, g * 0.9, bl * 0.9, mat, o.glow);
        this.vert(p[0], p[1], p[2], nx, ny, nz, r * 1.12, g * 1.12, bl * 1.12, mat, o.glow);
        this.vert(p[0] + sx * w + nx * lift, p[1] + sy * w + ny * lift, p[2] + sz * w + nz * lift, nx + sx * fold, ny + sy * fold, nz + sz * fold, r * 0.9, g * 0.9, bl * 0.9, mat, o.glow);
      }
      for (let i = 0; i < n - 1; i++) {
        const a = first + i * 3, b = a + 3;
        this.idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
      }
      return this;
    }
    build() {
      const Q = G.Q;
      if (Q.ao && !this.noAO && this.count > 0 && this.count < 90000) bakeAO(this.pos, this.nor, this.idx, this.mis, Q.ao, Q.aoDirs, this.ground);
      for (let i = 0; i < this.count; i++) if (this.mis[i * 2] > 1) this.mis[i * 2] = 1;
      if (this.sway) {
        let top = 0.001;
        for (let i = 1; i < this.pos.length; i += 3) if (this.pos[i] > top) top = this.pos[i];
        for (let i = 0; i < this.count; i++) this.mis[i * 2 + 1] = Math.max(0, this.pos[i * 3 + 1] - 0.22) / top;
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
      g.setAttribute('aSurf', new T.Float32BufferAttribute(this.sur, 4));
      g.setAttribute('aMisc', new T.Float32BufferAttribute(this.mis, 2));
      g.setIndex(this.count > 65000 ? new T.Uint32BufferAttribute(this.idx, 1) : new T.Uint16BufferAttribute(this.idx, 1));
      this.pos = this.nor = this.col = this.sur = this.mis = this.idx = null;
      return g;
    }
  }
  G.Mesher = Mesher;

  // Models are built once and shared.
  const models = new Map();
  G.iconPass = false;
  G.model = (key, fn, opts) => {
    if (models.has(key)) return models.get(key);
    const k = G.iconPass ? key + '#icon' : key;
    if (models.has(k)) return models.get(k);
    const m = new Mesher(opts);
    if (G.iconPass) m.noAO = true;
    fn(m);
    const g = m.build();
    models.set(k, g);
    return g;
  };
  G.dropIconModels = () => {
    models.forEach((g, k) => { if (k.endsWith('#icon')) { g.dispose(); models.delete(k); } });
  };

  G.mesh = (geo, o = {}) => {
    const mesh = new T.Mesh(geo, o.mat || G.mat.solid);
    mesh.frustumCulled = false;
    mesh.castShadow = !!o.cast;
    mesh.receiveShadow = !!o.receive;
    return mesh;
  };
})(typeof window !== 'undefined' ? window : globalThis);
