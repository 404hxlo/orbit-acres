// Orbit Acres: startup, saving, and the frame loop.
(function (root) {
  const OA = root.OA;
  const Sim = OA.Sim;
  const KEY = 'orbitAcres.save.v1';
  const Store = (OA.Store = { doc: null, dirty: false, writing: false });

  Store.readLocal = () => { try { return root.localStorage.getItem(KEY); } catch (e) { return null; } };
  Store.writeLocal = (text) => { try { root.localStorage.setItem(KEY, text); } catch (e) { /* private window: keep playing */ } };
  Store.clearLocal = () => { try { root.localStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ } };

  // Cloud saves work when the game runs as a published page and you are signed in.
  Store.connect = async () => {
    const c = root.claude;
    if (!c || !c.use) return null;
    try {
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (!db || !user) return null;
      const id = await user.id();
      if (!id) return null;
      Store.doc = db.doc('data/users/' + id + '/save');
      const snap = await Store.doc.get();
      return snap.exists ? snap.data() : null;
    } catch (e) { return null; }
  };
  Store.writeCloud = async (text) => {
    if (!Store.doc || Store.writing) return;
    Store.writing = true;
    try { await Store.doc.set({ text, at: OA.now(), version: OA.VERSION }); Store.dirty = false; } catch (e) { /* try again on the next save */ }
    Store.writing = false;
  };
  Store.save = (cloud) => {
    if (!Sim.state() || Store.noSave) return;
    const text = Sim.save();
    Store.writeLocal(text);
    if (cloud && Store.dirty) Store.writeCloud(text);
  };

  const savedAt = (text) => { try { return JSON.parse(text).lastSeen || 0; } catch (e) { return 0; } };
  const progressBar = (k) => {
    const el = document.getElementById('loadfill');
    if (el) el.style.width = Math.round(k * 100) + '%';
  };
  const fail = (msg) => {
    const el = document.getElementById('loadmsg');
    if (el) { el.textContent = msg; el.classList.add('bad'); }
  };

  const start = async (hotData) => {
    if (!root.THREE) { fail('The 3D library did not load. Check your connection and refresh.'); return; }
    const canvas = document.getElementById('view');
    try {
      const test = document.createElement('canvas');
      if (!(test.getContext('webgl2') || test.getContext('webgl'))) throw new Error('no webgl');
    } catch (e) { fail('This browser cannot show 3D graphics. Try turning on hardware acceleration.'); return; }

    progressBar(0.04);
    // Prefer whichever save is newest, but never hold the game up waiting.
    let text = (hotData && hotData.save) || Store.readLocal();
    const cloudWait = Store.connect();
    const cloud = await Promise.race([cloudWait, new Promise((r) => setTimeout(() => r('late'), 2500))]);
    if (cloud && cloud !== 'late' && cloud.text && savedAt(cloud.text) > savedAt(text)) text = cloud.text;

    let away = null;
    let fresh = false;
    try {
      if (text) away = Sim.load(text);
      else { Sim.newGame(); fresh = true; }
    } catch (e) {
      Sim.newGame();
      fresh = true;
    }

    progressBar(0.08);
    await new Promise((r) => setTimeout(r, 0));
    OA.World.init(canvas);
    progressBar(0.16);
    const tex = await OA.Icons.build(OA.World.renderer, (k) => progressBar(0.16 + k * 0.76));
    OA.World.setAtlas(tex);
    OA.World.start();
    if (OA.UI) OA.UI.init({ fresh, away });
    progressBar(1);
    OA.bootMs = Math.round(performance.now());

    if (cloud === 'late') {
      cloudWait.then((late) => {
        if (late && late.text && savedAt(late.text) > Sim.state().lastSeen + 60000 && OA.UI) OA.UI.offerCloud(late.text);
      });
    }

    ['planted', 'harvested', 'picked', 'fed', 'collected', 'queued', 'goodCollected', 'built', 'shipped', 'sale', 'listed', 'level', 'upgraded', 'claimed', 'crate', 'served', 'restored', 'dug', 'fished', 'bought', 'goal', 'objects'].forEach((name) => OA.on(name, () => { Store.dirty = true; }));

    let last = performance.now();
    let tickAt = 0, saveAt = 0, cloudAt = 0;
    const frame = (t) => {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      tickAt += dt; saveAt += dt; cloudAt += dt;
      if (tickAt >= 0.5) { tickAt = 0; Sim.tick(); if (OA.UI) OA.UI.tick(); }
      if (saveAt >= 8) { saveAt = 0; Store.save(false); }
      if (cloudAt >= 40) { cloudAt = 0; Store.save(true); }
      OA.World.frame(dt);
    };
    requestAnimationFrame(frame);

    const leave = () => { if (document.hidden) Store.save(true); };
    document.addEventListener('visibilitychange', leave);
    root.addEventListener('pagehide', () => Store.save(true));
    if (root.claude && root.claude.hot && root.claude.hot.snapshot) root.claude.hot.snapshot(() => ({ save: Sim.save() }));

    const loader = document.getElementById('loader');
    if (loader) { loader.classList.add('gone'); setTimeout(() => loader.remove(), 700); }
  };

  const go = () => {
    const hot = root.claude && root.claude.hot;
    if (hot && hot.ready) hot.ready(start);
    else start(hot && hot.data ? hot.data : {});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})(window);
