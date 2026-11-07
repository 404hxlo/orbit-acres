// Orbit Acres: lines baked models up on the planet, to look them over in one go.
// Run it inside the game page on the dev server:
//   const s = document.createElement('script'); s.src = '/tools/cook/gallery.js'; document.head.append(s);
//   await OA.Gallery.show(['silo', 'bay', 'factory-synth'], { cooked: true });
(function (root) {
  const OA = root.OA;
  const G = OA.Gfx;
  const T = root.THREE;
  const code = (key) => {
    const M = G.M;
    if (key.startsWith('factory-')) return M.factory(key.slice(8));
    if (key.startsWith('lot-')) return M.lot(key.slice(4));
    if (key === 'ruin') return M.ruin(OA.TOWN_LOTS[0].id);
    if (key.startsWith('pen-')) return M.pen(key.slice(4));
    if (key.startsWith('decor-')) return M.decor(key.slice(6));
    if (key === 'rocketpad') return M.rocketPad();
    return M[key]();
  };
  let group = null;
  OA.Gallery = {
    code,
    async show(keys, opts = {}) {
      const W = OA.World;
      const scene = W.outer.parent;
      if (!group) {
        scene.children.forEach((c) => { if (c.isGroup) c.visible = false; });
        group = new T.Group();
        scene.add(group);
        document.querySelectorAll('#app > *').forEach((e) => { if (e.tagName !== 'CANVAS' && e.id !== 'game') e.style.visibility = 'hidden'; });
      }
      while (group.children.length) group.remove(group.children[0]);
      const cols = opts.cols || 4;
      const gap = opts.gap || 7;
      const rows = Math.ceil(keys.length / cols);
      if (opts.cooked === false) {
        const save = G.Cooked.attach;
        G.Cooked.attach = () => {};
        keys.forEach((k, i) => this.place(k, i, cols, rows, gap));
        G.Cooked.attach = save;
      } else {
        keys.forEach((k, i) => this.place(k, i, cols, rows, gap));
        for (let t = 0; t < 200 && !G.Cooked.idle(); t++) await new Promise((r) => setTimeout(r, 60));
      }
      const c = W.cam;
      c.anim = null;
      c.fx = c.tfx = opts.x || 0;
      c.fz = c.tfz = opts.z || 0;
      c.d = c.td = opts.d || 46;
      W.fixedDay = opts.day === undefined ? 0.2 : opts.day;
      W.shadowsDirty();
      for (let i = 0; i < 30; i++) W.frame(0.05);
      return { shown: keys.length, stats: G.Cooked.stats };
    },
    place(key, i, cols, rows, gap) {
      const m = G.mesh(code(key), { cast: true, receive: true });
      m.position.set(((i % cols) - (cols - 1) / 2) * gap, 0, (Math.floor(i / cols) - (rows - 1) / 2) * gap);
      group.add(m);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
