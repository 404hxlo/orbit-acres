// Orbit Acres: exports models from the running game so Blender can bake them.
// Run it inside the game page on the dev server, at the High graphics level:
//   const s = document.createElement('script'); s.src = '/tools/cook/dump.js'; document.head.append(s);
//   await OA.CookDump.run(['silo', 'bay']);   // or run() for everything in cook-list.js
// Each model goes to tools/cook/raw/<key>.bin, with its parts listed in <key>.json.
(function (root) {
  const OA = root.OA;
  const G = OA.Gfx;
  const Mesher = G.Mesher;

  const SURFS = Object.keys(G.SURF);

  // Remember which indices each part wrote and what it is made of.
  const wrap = (name, surfOf) => {
    const fn = Mesher.prototype[name];
    Mesher.prototype[name] = function (...args) {
      const depth = (this.depth = (this.depth || 0) + 1);
      const i0 = this.idx.length, v0 = this.count;
      const out = fn.apply(this, args);
      this.depth = depth - 1;
      // A part drawn by another part is already covered by the inner call.
      if (depth === 1 && this.idx.length > i0) {
        const o = surfOf(args) || {};
        (this.parts = this.parts || []).push({ i0, i1: this.idx.length, v0, v1: this.count, surf: o.surf || this.surf });
      }
      return out;
    };
    return () => { Mesher.prototype[name] = fn; };
  };

  const capture = (key, fn, opts) => {
    const undo = [
      wrap('add', (a) => a[2]),
      wrap('tube', (a) => a[3]),
      wrap('ribbon', (a) => a[3]),
    ];
    const m = new Mesher(opts);
    let geo;
    try {
      fn(m);
      const parts = (m.parts || []).slice().sort((a, b) => a.i0 - b.i0);
      const total = m.idx.length;
      // Hand-built surfaces, like the tilled soil, write vertices directly.
      const full = [];
      let at = 0;
      const gap = (a, b) => { if (b > a) full.push({ i0: a, i1: b, v0: -1, v1: -1, surf: m.surf }); };
      parts.forEach((p) => { gap(at, p.i0); full.push(p); at = p.i1; });
      gap(at, total);
      geo = m.build();
      return { geo, parts: full };
    } finally {
      undo.forEach((f) => f());
    }
  };

  const post = (name, data) => fetch('/__cook/' + name, { method: 'POST', body: data }).then((r) => { if (!r.ok) throw new Error('save failed: ' + name); });

  const pack = (geo) => {
    const n = geo.attributes.position.count;
    const out = new Float32Array(n * 15);
    const P = geo.attributes.position.array, N = geo.attributes.normal.array, C = geo.attributes.color.array, S = geo.attributes.aSurf.array, M = geo.attributes.aMisc.array;
    for (let i = 0; i < n; i++) {
      const o = i * 15;
      out[o] = P[i * 3]; out[o + 1] = P[i * 3 + 1]; out[o + 2] = P[i * 3 + 2];
      out[o + 3] = N[i * 3]; out[o + 4] = N[i * 3 + 1]; out[o + 5] = N[i * 3 + 2];
      out[o + 6] = C[i * 3]; out[o + 7] = C[i * 3 + 1]; out[o + 8] = C[i * 3 + 2];
      out[o + 9] = S[i * 4]; out[o + 10] = S[i * 4 + 1]; out[o + 11] = S[i * 4 + 2]; out[o + 12] = S[i * 4 + 3];
      out[o + 13] = M[i * 2]; out[o + 14] = M[i * 2 + 1];
    }
    return new Uint8Array(out.buffer);
  };

  OA.CookDump = {
    // Every model worth baking, as [key, builder].
    all() {
      const M = G.M;
      const list = [
        ['silo', () => M.silo()], ['bay', () => M.bay()], ['board', () => M.board()], ['pad', () => M.pad()],
        ['post', () => M.post()], ['gazette', () => M.gazette()], ['rocketpad', () => M.rocketPad()],
        ['rocket', () => M.rocket()], ['shuttle', () => M.shuttle()], ['mine', () => M.mine()], ['dock', () => M.dock()],
        ['field', () => M.field()], ['beacon', () => M.beacon()], ['crate', () => M.crate()],
      ];
      Object.keys(OA.FACTORIES).forEach((k) => list.push(['factory-' + k, () => M.factory(k)]));
      OA.TOWN_LOTS.forEach((l) => list.push(['lot-' + l.id, () => M.lot(l.id)]));
      // Every ruin is the same model.
      list.push(['ruin', () => M.ruin(OA.TOWN_LOTS[0].id)]);
      OA.CRITTERS.forEach((c) => list.push(['pen-' + c.id, () => M.pen(c.id)]));
      OA.DECOR.forEach((d) => list.push(['decor-' + d.id, () => M.decor(d.id)]));
      return list;
    },
    async run(keys) {
      if (G.Q.name !== 'high') throw new Error('Run this at the High graphics level.');
      const real = G.model;
      const log = [];
      const jobs = this.all().filter(([k]) => !keys || keys.includes(k));
      for (const [key, make] of jobs) {
        let result = null;
        // The real builder is used, but with nothing cached.
        G.model = (k, fn, opts) => {
          if (k !== key && !(key === 'ruin' && k.startsWith('ruin-'))) return real(k, fn, opts);
          result = capture(k, fn, opts);
          return result.geo;
        };
        try { make(); } finally { G.model = real; }
        if (!result) throw new Error('No model came back for ' + key);
        const geo = result.geo;
        const info = {
          key,
          verts: geo.attributes.position.count,
          tris: geo.index.count / 3,
          surfs: SURFS,
          parts: result.parts.map((p) => [p.i0, p.i1, SURFS.indexOf(p.surf)]),
        };
        await post(key + '.bin', pack(geo));
        await post(key + '.idx', new Uint8Array(new Uint32Array(geo.index.array).buffer));
        await post(key + '.json', JSON.stringify(info));
        geo.dispose();
        log.push(key + ': ' + info.tris + ' tris, ' + info.parts.length + ' parts');
      }
      // The tiling plate, brush, grit and soft texture, so bakes keep the same look.
      const d = G.U.uDetail.value;
      await post('detail.rgba', d.image.data);
      await post('detail.json', JSON.stringify({ size: d.image.width }));
      return log;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
