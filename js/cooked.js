// Orbit Acres: swaps code-built models for ones baked in Blender (tools/cook).
// The code-built model always shows first, so the game never waits on a download.
// When a baked file arrives it takes over; if it never does, nothing changes.
(function (root) {
  const OA = root.OA;
  const G = OA.Gfx;
  const T = root.THREE;
  const C = (G.Cooked = {});
  const entries = new Map();
  const queue = [];
  let loading = false;

  C.stats = { loaded: 0, failed: 0, bytes: 0 };

  // Data Saver means the player would rather not spend a download on looks.
  const lean = () => !!(root.navigator.connection && root.navigator.connection.saveData);
  const has = (key) => !!(G.Q.cook && root.DecompressionStream && root.createImageBitmap && OA.COOKED && OA.COOKED[key] && !lean());

  C.idle = () => !loading && !queue.length;
  C.will = (key) => has(key.startsWith('ruin-') ? 'ruin' : key);

  const inflate = (bytes) => new root.Response(new root.Blob([bytes]).stream().pipeThrough(new root.DecompressionStream('deflate-raw'))).arrayBuffer();
  // Geometry is stored as the difference from the vertex before.
  const undelta = (a, stride) => {
    for (let i = stride; i < a.length; i++) a[i] += a[i - stride];
    return a;
  };

  // Reads one baked file: a small header, deflated geometry, then the images.
  const read = async (buf) => {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x3243414f) throw new Error('Not a baked model');
    const len = dv.getUint32(4, true);
    const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, len)));
    const start = 8 + len;
    const shape = await inflate(new Uint8Array(buf, start, head.z[0]));
    const after = start + head.z[0];
    const arr = (name, Type) => { const [at, n] = head.s[name]; return new Type(shape, at, n); };
    const bytes = (name) => { const [at, n] = head.s[name]; return new Uint8Array(buf, after + at, n); };
    const [nA, tA] = head.a;
    const [nB, tB] = head.b;
    const total = nA + nB;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    const col = new Float32Array(total * 3).fill(1), sur = new Float32Array(total * 4), mis = new Float32Array(total * 2);
    const decode = (p, n, from) => {
      for (let i = 0; i < p.length; i += 3) {
        const o = from + i;
        pos[o] = head.lo[0] + (p[i] / 65535) * head.span[0];
        pos[o + 1] = head.lo[1] + (p[i + 1] / 65535) * head.span[1];
        pos[o + 2] = head.lo[2] + (p[i + 2] / 65535) * head.span[2];
        nor[o] = n[i] / 32767; nor[o + 1] = n[i + 1] / 32767; nor[o + 2] = n[i + 2] / 32767;
      }
    };
    decode(undelta(arr('p', Uint16Array), 3), arr('n', Int16Array), 0);
    const u = undelta(arr('u', Uint16Array), 2);
    for (let i = 0; i < u.length; i++) uv[i] = u[i] / 65535;
    for (let i = 0; i < nA; i++) mis[i * 2] = 1;
    const Index = total > 65000 ? Uint32Array : Uint16Array;
    const idx = new Index((tA + tB) * 3);
    idx.set(undelta(arr('i', nA > 65000 ? Uint32Array : Uint16Array), 3));
    if (nB) {
      decode(undelta(arr('P', Uint16Array), 3), arr('N', Int16Array), nA * 3);
      const c = arr('C', Uint16Array), s = arr('S', Int16Array), m = arr('M', Int16Array);
      for (let i = 0; i < c.length; i++) col[nA * 3 + i] = G.Q.linear ? c[i] / 65535 : Math.pow(c[i] / 65535, 1 / 2.2);
      for (let i = 0; i < s.length; i++) sur[nA * 4 + i] = s[i] / 1000;
      for (let i = 0; i < m.length; i++) mis[(nA + i) * 2] = m[i] / 1000;
      const b = undelta(arr('I', nB > 65000 ? Uint32Array : Uint16Array), 3);
      for (let i = 0; i < b.length; i++) idx[tA * 3 + i] = b[i] + nA;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.setAttribute('aSurf', new T.BufferAttribute(sur, 4));
    geo.setAttribute('aMisc', new T.BufferAttribute(mis, 2));
    geo.setIndex(new T.BufferAttribute(idx, 1));
    geo.addGroup(0, tA * 3, 0);
    if (nB) geo.addGroup(tA * 3, tB * 3, 1);
    return { geo, images: { base: bytes('base'), normal: bytes('normal'), orm: bytes('orm'), cls: bytes('cls') } };
  };

  const texture = async (data, sRGB) => {
    const blob = new Blob([data], { type: 'image/webp' });
    let img;
    try {
      img = await root.createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    } catch (e) {
      img = await root.createImageBitmap(blob);
    }
    const tex = new T.Texture(img);
    tex.flipY = false;
    tex.encoding = sRGB ? T.sRGBEncoding : T.LinearEncoding;
    tex.minFilter = T.LinearMipmapLinearFilter;
    tex.anisotropy = G.Q.name === 'high' ? 8 : 4;
    tex.needsUpdate = true;
    return tex;
  };

  const swap = (mesh, e) => {
    mesh.geometry = e.geo;
    mesh.material = [e.mat, mesh.material];
  };

  const finish = async (key, e, buf) => {
    const { geo, images } = await read(buf);
    const [base, orm] = await Promise.all([texture(images.base, G.Q.linear), texture(images.orm, false)]);
    if (G.Q.pbr) {
      const [normal, cls] = await Promise.all([texture(images.normal, false), texture(images.cls, false)]);
      // Says which live surface detail goes where, so it must not blur.
      cls.minFilter = cls.magFilter = T.NearestFilter;
      cls.generateMipmaps = false;
      const mat = new T.MeshStandardMaterial({
        map: base, normalMap: normal, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1,
        normalScale: new T.Vector2(1, -1),
      });
      mat.userData.classMap = cls;
      e.mat = G.bendMaterial(mat, { cooked: true, detail: G.Q.detail, rim: 0.16 });
    } else {
      // Simple shading: the baked colors and shade do nearly all the work.
      const mat = new T.MeshLambertMaterial({ map: base });
      mat.userData.shadeMap = orm;
      e.mat = G.bendMaterial(mat, { cooked: true, rim: 0.2 });
    }
    e.geo = geo;
    geo.userData.key = key;
    geo.userData.cooked = true;
    e.ready = true;
    e.meshes.forEach((m) => swap(m, e));
    e.meshes = [];
    C.stats.loaded++;
    C.stats.bytes += buf.byteLength;
    if (OA.World && OA.World.shadowsDirty) OA.World.shadowsDirty();
  };

  // One at a time, so a colony full of buildings doesn't stall the frame rate.
  const next = async () => {
    if (loading) return;
    const key = queue.shift();
    if (!key) return;
    loading = true;
    const e = entries.get(key);
    try {
      const res = await root.fetch('assets/cooked/' + key + '.' + G.Q.cook + '.bin?v=' + OA.COOKED[key]);
      if (!res.ok) throw new Error('Missing');
      await finish(key, e, await res.arrayBuffer());
    } catch (err) {
      // The code-built model simply stays.
      e.failed = true;
      e.meshes = [];
      C.stats.failed++;
    }
    loading = false;
    root.setTimeout(next, 30);
  };

  // Called for every model on its way into the world.
  C.attach = (mesh, key) => {
    if (key.startsWith('ruin-')) key = 'ruin';
    if (!has(key)) return;
    let e = entries.get(key);
    if (!e) {
      e = { meshes: [], ready: false, failed: false, geo: null, mat: null };
      entries.set(key, e);
      queue.push(key);
      next();
    }
    if (e.ready) swap(mesh, e);
    else if (!e.failed) e.meshes.push(mesh);
  };
})(typeof window !== 'undefined' ? window : globalThis);
