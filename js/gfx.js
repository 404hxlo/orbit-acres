// Orbit Acres: rendering foundation.
// The game map is a flat grid. A vertex shader wraps that grid around a sphere
// centered under the camera's focus, which is what makes the colony a tiny planet.
(function (root) {
  const OA = root.OA;
  const G = (OA.Gfx = {});
  const T = root.THREE;

  G.R = 30; // planet radius in tiles

  G.U = {
    uFocus: { value: new T.Vector2(0, 0) },
    uR: { value: G.R },
    uTime: { value: 0 },
    uNight: { value: 0 },
    uRim: { value: new T.Color(0x9f8cff) },
    uAtmo: { value: new T.Color(0x5fd8ff) },
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

  // Adds the bend, plus optional glow and rim light, to a stock material.
  G.bendMaterial = (mat, opts = {}) => {
    const glow = opts.glow !== false;
    const rim = opts.rim === undefined ? 0.34 : opts.rim;
    const key = 'oa-' + glow + '-' + rim + '-' + mat.type + (opts.noBend ? '-flat' : '') + (opts.noLimb ? '-nolimb' : '');
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, G.U);
      let v = sh.vertexShader;
      let f = sh.fragmentShader;
      const head = BEND_GLSL + (glow ? '\nattribute float aGlow;\nvarying float vGlow;\nvarying float vRim;\n' : '');
      v = v.replace('#include <common>', '#include <common>\n' + head);
      const bendBlock = opts.noBend ? 'vAng = 0.0;' : `
        {
          vec4 oaW = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            oaW = instanceMatrix * oaW;
          #endif
          oaW = modelMatrix * oaW;
          gl_Position = projectionMatrix * viewMatrix * oaBend(oaW);
        }`;
      const glowBlock = glow
        ? `vGlow = aGlow;
           vRim = pow(1.0 - clamp(dot(normalize(transformedNormal), normalize(-mvPosition.xyz)), 0.0, 1.0), 2.4);`
        : '';
      v = v.replace('#include <fog_vertex>', '#include <fog_vertex>\n' + glowBlock + bendBlock);
      const fhead = 'uniform vec3 uAtmo;\nuniform vec3 uRim;\nuniform float uNight;\nvarying float vAng;\n' + (glow ? 'varying float vGlow;\nvarying float vRim;\n' : '');
      f = f.replace('#include <common>', '#include <common>\n' + fhead);
      if (glow) {
        f = f.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           totalEmissiveRadiance += diffuseColor.rgb * vGlow * (0.75 + 0.55 * uNight);
           totalEmissiveRadiance += uRim * vRim * ${rim.toFixed(3)};`
        );
      }
      f = f.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + (opts.noLimb ? '' : LIMB_GLSL));
      sh.vertexShader = v;
      sh.fragmentShader = f;
      mat.userData.shader = sh;
    };
    mat.customProgramCacheKey = () => key;
    return mat;
  };

  G.mat = {};
  G.initMaterials = () => {
    const m = G.mat;
    m.solid = G.bendMaterial(new T.MeshLambertMaterial({ vertexColors: true }));
    m.soft = G.bendMaterial(new T.MeshLambertMaterial({ vertexColors: true }), { rim: 0.22 });
    m.ground = G.bendMaterial(new T.MeshLambertMaterial({ vertexColors: false }), { glow: false });
    m.terrain = G.bendMaterial(new T.MeshLambertMaterial({ vertexColors: true }), { glow: false });
    m.icon = G.bendMaterial(new T.MeshLambertMaterial({ vertexColors: true }), { noBend: true, noLimb: true, rim: 0.3 });
  };

  // ---- Mesher: glues primitives into one colored geometry per model. ----
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

  // A box with soft corners: looks like a molded toy.
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

  class Mesher {
    constructor() {
      this.pos = []; this.nor = []; this.col = []; this.glo = []; this.idx = [];
      this.count = 0;
    }
    // o: p [x,y,z], r [rx,ry,rz], s number|[x,y,z], glow, top (color at the top of the shape), a (shade factor)
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
      const glow = o.glow || 0;
      colA.setHex(color);
      if (o.top !== undefined) colB.setHex(o.top);
      let minY = Infinity, maxY = -Infinity;
      if (o.top !== undefined) {
        for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      const base = this.count;
      for (let i = 0; i < pa.count; i++) {
        tmpV.fromBufferAttribute(pa, i).applyMatrix4(tmpM);
        tmpN.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
        this.pos.push(tmpV.x, tmpV.y, tmpV.z);
        this.nor.push(tmpN.x, tmpN.y, tmpN.z);
        let r = colA.r, g = colA.g, b = colA.b;
        if (o.top !== undefined) {
          const t = (pa.getY(i) - minY) / Math.max(1e-5, maxY - minY);
          r += (colB.r - r) * t; g += (colB.g - g) * t; b += (colB.b - b) * t;
        }
        this.col.push(r, g, b);
        this.glo.push(glow);
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
      const seg = o.seg || 14;
      const s = o.s === undefined ? 1 : o.s;
      const sv = Array.isArray(s) ? [s[0] * rad, s[1] * rad, s[2] * rad] : [s * rad, s * rad, s * rad];
      return this.add(shape('sph' + seg, () => new T.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.7)))), color, Object.assign({}, o, { s: sv }));
    }
    dome(rad, color, o = {}) {
      const seg = o.seg || 16;
      const s = o.s === undefined ? 1 : o.s;
      const sv = Array.isArray(s) ? [s[0] * rad, s[1] * rad, s[2] * rad] : [s * rad, s * rad, s * rad];
      return this.add(shape('dome' + seg, () => new T.SphereGeometry(1, seg, Math.round(seg / 2), 0, Math.PI * 2, 0, Math.PI / 2)), color, Object.assign({}, o, { s: sv }));
    }
    cyl(rt, rb, h, color, o = {}) {
      const seg = o.seg || 14;
      const key = 'cyl' + seg + (o.open ? 'o' : '') + rt.toFixed(3) + rb.toFixed(3);
      return this.add(shape(key, () => new T.CylinderGeometry(rt, rb, 1, seg, 1, !!o.open)), color, Object.assign({}, o, { s: o.s ? [o.s, h, o.s] : [1, h, 1] }));
    }
    cone(rad, h, color, o = {}) {
      const seg = o.seg || 10;
      return this.add(shape('cone' + seg, () => new T.ConeGeometry(1, 1, seg)), color, Object.assign({}, o, { s: [rad, h, rad] }));
    }
    tor(rad, tube, color, o = {}) {
      const seg = o.seg || 18;
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
    // A tube from point a to point b.
    pipe(a, b, rad, color, o = {}) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz);
      const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx / len, dy / len, dz / len));
      const e = new T.Euler().setFromQuaternion(q);
      return this.cyl(rad, rad, len, color, Object.assign({}, o, { p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r: [e.x, e.y, e.z], seg: o.seg || 8 }));
    }
    build() {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
      g.setAttribute('aGlow', new T.Float32BufferAttribute(this.glo, 1));
      g.setIndex(this.count > 65000 ? new T.Uint32BufferAttribute(this.idx, 1) : new T.Uint16BufferAttribute(this.idx, 1));
      this.pos = this.nor = this.col = this.glo = this.idx = null;
      return g;
    }
  }
  G.Mesher = Mesher;

  // Models are built once and shared.
  const models = new Map();
  G.model = (key, fn) => {
    if (models.has(key)) return models.get(key);
    const m = new Mesher();
    fn(m);
    const g = m.build();
    models.set(key, g);
    return g;
  };

  G.mesh = (geo, o = {}) => {
    const mesh = new T.Mesh(geo, o.mat || G.mat.solid);
    mesh.frustumCulled = false;
    mesh.castShadow = !!o.cast;
    mesh.receiveShadow = !!o.receive;
    return mesh;
  };
})(typeof window !== 'undefined' ? window : globalThis);
