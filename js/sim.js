// Orbit Acres: the game rules. No drawing here, so it can run headless in tests.
// Everything is stored as timestamps, which is why the colony keeps running
// while the game is closed.
(function (root) {
  const OA = root.OA;
  const I = OA.ITEMS;
  OA.now = OA.now || (() => Date.now());
  const now = () => OA.now();
  const Sim = (OA.Sim = {});
  let S = null;
  let index = new Map();
  let occ = new Map();

  const ok = (extra) => Object.assign({ ok: true }, extra);
  const no = (why, extra) => Object.assign({ ok: false, why }, extra);
  const MIN = 60000;

  // ---- Lookups ----
  Sim.state = () => S;
  Sim.obj = (id) => index.get(id);
  Sim.objs = (type) => S.objs.filter((o) => o.type === type);
  const reindex = () => {
    index = new Map(S.objs.map((o) => [o.id, o]));
    occ = new Map();
    S.objs.forEach((o) => {
      const { w, d } = Sim.size(o);
      for (let x = o.x; x < o.x + w; x++) for (let z = o.z; z < o.z + d; z++) occ.set(x + ',' + z, o.id);
    });
    S.rocks.forEach((r) => { for (let x = r.x; x < r.x + r.w; x++) for (let z = r.z; z < r.z + r.w; z++) occ.set(x + ',' + z, 'rock' + r.id); });
  };
  Sim.size = (o) => {
    if (o.type === 'decor') { const d = OA.DECOR.find((k) => k.id === o.kind); return { w: d.w, d: d.d }; }
    return OA.BUILD[o.type];
  };
  Sim.objAt = (x, z) => { const id = occ.get(x + ',' + z); return id && index.get(id); };
  Sim.rockAt = (x, z) => {
    const id = occ.get(x + ',' + z);
    return typeof id === 'string' && id.startsWith('rock') ? S.rocks.find((r) => 'rock' + r.id === id) : null;
  };

  const sectorOf = (t) => Math.floor((t + OA.SECTOR / 2) / OA.SECTOR);
  Sim.sectorKey = (x, z) => sectorOf(x) + ',' + sectorOf(z);
  Sim.owned = (x, z) => !!S.sectors[Sim.sectorKey(x, z)];

  // ---- Inventory ----
  Sim.have = (id) => S.inv[id] || 0;
  Sim.capacity = (store) => OA.STORE[store].start + OA.STORE[store].step * S.storeLv[store];
  Sim.used = (store) => {
    let n = 0;
    for (const id in S.inv) if (OA.storeOf(id) === store) n += S.inv[id];
    return n;
  };
  Sim.spaceFor = (id, n) => Sim.used(OA.storeOf(id)) + n <= Sim.capacity(OA.storeOf(id));
  const give = (id, n) => { S.inv[id] = (S.inv[id] || 0) + n; if (!S.seen[id]) S.seen[id] = 1; };
  const take = (id, n) => { S.inv[id] = (S.inv[id] || 0) - n; if (S.inv[id] <= 0) delete S.inv[id]; };
  const hasAll = (need) => Object.keys(need).every((k) => Sim.have(k) >= need[k]);
  const missing = (need) => Object.keys(need).filter((k) => Sim.have(k) < need[k]).map((k) => ({ id: k, n: need[k] - Sim.have(k) }));
  Sim.missing = missing;
  const takeAll = (need) => Object.keys(need).forEach((k) => take(k, need[k]));

  const earn = (n) => { S.credits += n; S.stats.earned += n; goalCheck(); };
  const stat = (k, n = 1) => { S.stats[k] = (S.stats[k] || 0) + n; goalCheck(); };

  // ---- Experience ----
  Sim.addXP = (n) => {
    S.xp += n;
    let need = OA.xpNeed(S.level);
    while (S.xp >= need) {
      S.xp -= need;
      S.level++;
      const dust = S.level % 5 === 0 ? 5 : 2;
      const credits = S.level * 25;
      S.dust += dust;
      S.credits += credits;
      afterLevel();
      OA.emit('level', { level: S.level, dust, credits, unlocks: OA.unlocksAt(S.level) });
      need = OA.xpNeed(S.level);
    }
  };

  const afterLevel = () => {
    if (S.level >= OA.BUILD.post.lvl && !Sim.objs('post').length) autoPlace('post', -11, 4);
    if (S.level >= OA.BUILD.gazette.lvl && !Sim.objs('gazette').length) autoPlace('gazette', -6, 5);
    if (S.level === OA.SITES.dock.lvl) { give('bait', 5); }
    if (S.level === OA.SITES.mine.lvl) { give('drill', 8); give('charge', 1); }
    while (S.orders.length < Sim.orderSlots()) S.orders.push(makeOrder());
    OA.emit('objects');
  };

  const autoPlace = (type, x, z) => {
    const b = OA.BUILD[type];
    const spot = Sim.findSpot(b.w, b.d, x, z);
    if (!spot) return null;
    return addObj({ type, x: spot.x, z: spot.z });
  };

  // ---- Placing things ----
  const addObj = (o) => {
    o.id = S.nextId++;
    S.objs.push(o);
    reindex();
    return o;
  };

  Sim.canPlace = (w, d, x, z, ignoreId) => {
    for (let i = x; i < x + w; i++) {
      for (let k = z; k < z + d; k++) {
        if (!Sim.owned(i, k)) return false;
        const id = occ.get(i + ',' + k);
        if (id !== undefined && id !== ignoreId) return false;
      }
    }
    return true;
  };
  Sim.findSpot = (w, d, cx, cz, ignoreId) => {
    for (let r = 0; r < 60; r++) {
      for (let x = cx - r; x <= cx + r; x++) {
        for (let z = cz - r; z <= cz + r; z++) {
          if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) !== r) continue;
          if (Sim.canPlace(w, d, x, z, ignoreId)) return { x, z };
        }
      }
    }
    return null;
  };

  Sim.fieldCount = () => Sim.objs('field').length;
  Sim.maxFields = () => Math.min(64, 8 + S.level * 2);
  Sim.fieldCost = () => { const n = Sim.fieldCount(); return Math.round(10 + 5 * n + (n * n) / 4); };
  Sim.pensOf = (kind) => Sim.objs('pen').filter((p) => p.kind === kind);
  Sim.maxPens = (kind) => {
    const c = OA.CRITTERS.find((k) => k.id === kind);
    if (S.level < c.lvl) return 0;
    return Math.min(3, 1 + Math.floor((S.level - c.lvl) / 6));
  };
  Sim.penCost = (kind) => {
    const c = OA.CRITTERS.find((k) => k.id === kind);
    return Math.round(c.penCost * Math.pow(2.2, Sim.pensOf(kind).length));
  };
  Sim.critterCount = (kind) => Sim.pensOf(kind).reduce((n, p) => n + p.critters.length, 0);
  Sim.critterCost = (kind) => {
    const c = OA.CRITTERS.find((k) => k.id === kind);
    return Math.round(c.cost * (1 + 0.3 * Math.max(0, Sim.critterCount(kind) - 1)));
  };
  Sim.treeCost = (kind) => {
    const t = OA.TREES.find((k) => k.id === kind);
    const n = Sim.objs('tree').filter((o) => o.kind === kind).length;
    return Math.round(t.cost * (1 + 0.25 * n));
  };
  Sim.maxTrees = () => 3 + Math.floor(S.level / 4);
  Sim.factoryOwned = (kind) => Sim.objs('factory').some((f) => f.kind === kind);

  // Buying from the build menu. `spec` = {type, kind}.
  Sim.quote = (spec) => {
    const L = S.level;
    if (spec.type === 'field') {
      if (Sim.fieldCount() >= Sim.maxFields()) return no('Reach the next level to buy more plots.');
      return ok({ cost: Sim.fieldCost(), w: 2, d: 2 });
    }
    if (spec.type === 'pen') {
      const c = OA.CRITTERS.find((k) => k.id === spec.kind);
      if (L < c.lvl) return no('Unlocks at level ' + c.lvl + '.', { locked: c.lvl });
      if (Sim.pensOf(spec.kind).length >= Sim.maxPens(spec.kind)) return no('Reach a higher level for another pen.');
      return ok({ cost: Sim.penCost(spec.kind), w: OA.BUILD.pen.w, d: OA.BUILD.pen.d });
    }
    if (spec.type === 'factory') {
      const f = OA.FACTORIES[spec.kind];
      if (L < f.lvl) return no('Unlocks at level ' + f.lvl + '.', { locked: f.lvl });
      if (Sim.factoryOwned(spec.kind)) return no('You already have one.', { owned: true });
      return ok({ cost: f.cost, w: OA.BUILD.factory.w, d: OA.BUILD.factory.d });
    }
    if (spec.type === 'tree') {
      const t = OA.TREES.find((k) => k.id === spec.kind);
      if (L < t.lvl) return no('Unlocks at level ' + t.lvl + '.', { locked: t.lvl });
      if (Sim.objs('tree').length >= Sim.maxTrees()) return no('Reach a higher level for more trees.');
      return ok({ cost: Sim.treeCost(spec.kind), w: 2, d: 2 });
    }
    if (spec.type === 'decor') {
      const d = OA.DECOR.find((k) => k.id === spec.kind);
      if (L < d.lvl) return no('Unlocks at level ' + d.lvl + '.', { locked: d.lvl });
      return ok({ cost: d.cost, w: d.w, d: d.d });
    }
    return no('You cannot buy that.');
  };

  Sim.buy = (spec, x, z) => {
    const q = Sim.quote(spec);
    if (!q.ok) return q;
    if (S.credits < q.cost) return no('You need ' + OA.fmt(q.cost) + ' credits.', { credits: true });
    if (!Sim.canPlace(q.w, q.d, x, z)) return no('That spot is taken.');
    S.credits -= q.cost;
    let o;
    if (spec.type === 'field') o = addObj({ type: 'field', x, z, crop: null, readyAt: 0, planted: 0 });
    if (spec.type === 'pen') o = addObj({ type: 'pen', kind: spec.kind, x, z, critters: [{ readyAt: null }] });
    if (spec.type === 'factory') o = addObj({ type: 'factory', kind: spec.kind, x, z, queue: [], done: [], slots: 2 });
    if (spec.type === 'tree') {
      const t = OA.TREES.find((k) => k.id === spec.kind);
      o = addObj({ type: 'tree', kind: spec.kind, x, z, picks: t.picks, readyAt: now() + t.time * 1000, planted: now() });
    }
    if (spec.type === 'decor') {
      o = addObj({ type: 'decor', kind: spec.kind, x, z });
      Sim.setCharm();
      stat('decor');
    }
    Sim.addXP(Math.max(1, Math.round(q.cost / 20)));
    OA.emit('built', { id: o.id, type: o.type, kind: o.kind });
    OA.emit('objects');
    return ok({ id: o.id });
  };

  Sim.move = (id, x, z) => {
    const o = Sim.obj(id);
    if (!o) return no('Nothing there.');
    const { w, d } = Sim.size(o);
    if (!Sim.canPlace(w, d, x, z, id)) return no('That spot is taken.');
    o.x = x; o.z = z;
    reindex();
    OA.emit('objects');
    return ok();
  };

  Sim.sellDecor = (id) => {
    const o = Sim.obj(id);
    if (!o || o.type !== 'decor') return no('Only decorations can be sold back.');
    const d = OA.DECOR.find((k) => k.id === o.kind);
    S.objs = S.objs.filter((k) => k !== o);
    reindex();
    S.credits += Math.floor(d.cost / 2);
    Sim.setCharm();
    OA.emit('objects');
    return ok({ refund: Math.floor(d.cost / 2) });
  };

  Sim.charm = () => S.objs.reduce((n, o) => n + (o.type === 'decor' ? OA.DECOR.find((d) => d.id === o.kind).charm : 0), 0);
  Sim.setCharm = () => { S.stats.charm = Sim.charm(); goalCheck(); };
  const charmSpeed = () => 1 / (1 + Math.min(Sim.charm(), 150) / 100);

  // ---- Crop plots ----
  Sim.emergencySeed = () => {
    const growing = Sim.objs('field').some((f) => f.crop === 'wheat');
    if (Sim.have('wheat') === 0 && !growing) { give('wheat', 2); return true; }
    return false;
  };
  Sim.seedPrice = (crop) => I[crop].value * 2 + 1;

  Sim.plant = (id, crop) => {
    const f = Sim.obj(id);
    if (!f || f.type !== 'field') return no('That is not a plot.');
    if (f.crop) return no('This plot is already growing.');
    const c = I[crop];
    if (S.level < c.lvl) return no('Unlocks at level ' + c.lvl + '.');
    if (Sim.have(crop) < 1) {
      Sim.emergencySeed();
      if (Sim.have(crop) < 1) {
        const price = Sim.seedPrice(crop);
        if (S.credits < price) return no('No ' + c.name + ' seed left.', { seed: crop });
        S.credits -= price;
        give(crop, 1);
      }
    }
    take(crop, 1);
    f.crop = crop;
    f.planted = now();
    f.readyAt = now() + c.time * 1000;
    OA.emit('planted', { id, crop });
    return ok();
  };

  Sim.fieldReady = (f) => !!f.crop && now() >= f.readyAt;

  Sim.harvest = (id) => {
    const f = Sim.obj(id);
    if (!f || !Sim.fieldReady(f)) return no('Not ripe yet.');
    if (!Sim.spaceFor(f.crop, 2)) return no(OA.STORE.silo.name + ' is full.', { full: 'silo' });
    const crop = f.crop;
    give(crop, 2);
    f.crop = null;
    f.readyAt = 0;
    stat('harvests');
    Sim.addXP(I[crop].xp);
    const part = maybePart(0.05);
    OA.emit('harvested', { id, crop, n: 2, part });
    return ok({ crop, n: 2, part });
  };

  // ---- Orchard ----
  Sim.pickTree = (id) => {
    const t = Sim.obj(id);
    if (!t || t.type !== 'tree') return no('That is not a tree.');
    const def = OA.TREES.find((k) => k.id === t.kind);
    if (t.picks <= 0) return no('This tree has given all its fruit.', { spent: true });
    if (now() < t.readyAt) return no('No fruit yet.');
    if (!Sim.spaceFor(def.fruit, 3)) return no(OA.STORE.silo.name + ' is full.', { full: 'silo' });
    give(def.fruit, 3);
    t.picks--;
    t.readyAt = now() + def.time * 1000;
    stat('harvests');
    Sim.addXP(I[def.fruit].xp * 2);
    OA.emit('picked', { id, fruit: def.fruit, n: 3 });
    return ok({ fruit: def.fruit, n: 3 });
  };
  Sim.replantTree = (id) => {
    const t = Sim.obj(id);
    if (!t || t.type !== 'tree' || t.picks > 0) return no('This tree is still bearing fruit.');
    const def = OA.TREES.find((k) => k.id === t.kind);
    const cost = Math.round(def.cost / 2);
    if (S.credits < cost) return no('You need ' + OA.fmt(cost) + ' credits.', { credits: true });
    S.credits -= cost;
    t.picks = def.picks;
    t.readyAt = now() + def.time * 1000;
    t.planted = now();
    OA.emit('objects');
    return ok();
  };

  // ---- Critters ----
  Sim.critterState = (c) => (c.readyAt === null ? 'hungry' : now() >= c.readyAt ? 'ready' : 'growing');
  Sim.penInfo = (p) => {
    const out = { hungry: 0, ready: 0, growing: 0, soonest: null };
    p.critters.forEach((c) => {
      const st = Sim.critterState(c);
      out[st]++;
      if (st === 'growing' && (out.soonest === null || c.readyAt < out.soonest)) out.soonest = c.readyAt;
    });
    return out;
  };

  Sim.feedPen = (id) => {
    const p = Sim.obj(id);
    if (!p) return no('Nothing there.');
    const def = OA.CRITTERS.find((k) => k.id === p.kind);
    let fed = 0;
    const list = [];
    p.critters.forEach((c, i) => {
      if (c.readyAt === null && Sim.have(def.feed) > 0) {
        take(def.feed, 1);
        c.readyAt = now() + (S.fastEggs ? 15 : def.time) * 1000;
        fed++;
        list.push(i);
      }
    });
    if (!fed) {
      if (p.critters.some((c) => c.readyAt === null)) return no('You need ' + I[def.feed].name + '. Make it at the Feed Synth.', { feed: def.feed });
      return no('They are all full.');
    }
    stat('feeds', fed);
    OA.emit('fed', { id, list, feed: def.feed });
    return ok({ fed });
  };

  Sim.collectPen = (id) => {
    const p = Sim.obj(id);
    if (!p) return no('Nothing there.');
    const def = OA.CRITTERS.find((k) => k.id === p.kind);
    let got = 0;
    let blocked = false;
    const list = [];
    p.critters.forEach((c, i) => {
      if (Sim.critterState(c) === 'ready') {
        if (Sim.spaceFor(def.product, 1)) {
          give(def.product, 1);
          c.readyAt = null;
          got++;
          list.push(i);
        } else blocked = true;
      }
    });
    if (got) {
      S.fastEggs = false;
      Sim.addXP(I[def.product].xp * got);
      const part = maybePart(0.06);
      OA.emit('collected', { id, list, item: def.product, n: got, part });
      return ok({ got, item: def.product, blocked });
    }
    if (blocked) return no(OA.STORE.bay.name + ' is full.', { full: 'bay' });
    return no('Nothing to collect yet.');
  };

  Sim.buyCritter = (id) => {
    const p = Sim.obj(id);
    if (!p) return no('Nothing there.');
    const def = OA.CRITTERS.find((k) => k.id === p.kind);
    if (p.critters.length >= def.perPen) return no('This pen is full.');
    const cost = Sim.critterCost(p.kind);
    if (S.credits < cost) return no('You need ' + OA.fmt(cost) + ' credits.', { credits: true });
    S.credits -= cost;
    p.critters.push({ readyAt: null });
    Sim.addXP(Math.round(cost / 20));
    OA.emit('objects');
    return ok();
  };

  // ---- Factories ----
  Sim.factoryRecipes = (f) => OA.FACTORIES[f.kind].recipes.map((r) => OA.RECIPES[r]);
  const settleFactory = (f, t) => {
    let moved = false;
    while (f.queue.length && f.queue[0].end <= t) {
      f.done.push(f.queue.shift().r);
      moved = true;
    }
    return moved;
  };
  Sim.slotCost = (f) => Math.round(120 * Math.pow(2.6, f.slots - 2));
  Sim.maxSlots = 7;

  Sim.queue = (id, recipe) => {
    const f = Sim.obj(id);
    if (!f) return no('Nothing there.');
    settleFactory(f, now());
    const r = OA.RECIPES[recipe];
    if (S.level < r.lvl) return no('Unlocks at level ' + r.lvl + '.');
    if (f.queue.length + f.done.length >= f.slots) return no('All slots are busy. Collect goods or add a slot.', { slots: true });
    const lack = missing(r.inputs);
    if (lack.length) return no('You need ' + lack.map((m) => m.n + ' ' + I[m.id].name).join(' and ') + '.', { lack });
    takeAll(r.inputs);
    const last = f.queue.length ? f.queue[f.queue.length - 1].end : now();
    f.queue.push({ r: recipe, start: last, end: last + r.time * 1000 });
    OA.emit('queued', { id, recipe });
    return ok();
  };

  Sim.collectGood = (id, index = 0) => {
    const f = Sim.obj(id);
    if (!f) return no('Nothing there.');
    settleFactory(f, now());
    if (!f.done.length) return no('Nothing finished yet.');
    const recipe = f.done[index];
    if (!recipe) return no('Nothing finished yet.');
    const r = OA.RECIPES[recipe];
    if (!Sim.spaceFor(recipe, r.out)) return no(OA.STORE.bay.name + ' is full.', { full: 'bay' });
    f.done.splice(index, 1);
    give(recipe, r.out);
    stat('goods', r.out);
    Sim.addXP(I[recipe].xp * r.out);
    const part = maybePart(0.07);
    OA.emit('goodCollected', { id, item: recipe, n: r.out, part });
    return ok({ item: recipe, n: r.out, part });
  };

  Sim.rushCost = (ms) => Math.max(1, Math.ceil(ms / (8 * MIN)));
  Sim.rush = (id) => {
    const f = Sim.obj(id);
    if (!f || !f.queue.length) return no('Nothing is being made.');
    const left = f.queue[0].end - now();
    const cost = Sim.rushCost(left);
    if (S.dust < cost) return no('You need ' + cost + ' Stardust.', { dust: true });
    S.dust -= cost;
    f.queue.forEach((q) => { q.start -= left; q.end -= left; });
    settleFactory(f, now());
    OA.emit('rushed', { id });
    return ok();
  };

  Sim.buySlot = (id) => {
    const f = Sim.obj(id);
    if (!f) return no('Nothing there.');
    if (f.slots >= Sim.maxSlots) return no('This factory has every slot.');
    const cost = Sim.slotCost(f);
    if (S.credits < cost) return no('You need ' + OA.fmt(cost) + ' credits.', { credits: true });
    S.credits -= cost;
    f.slots++;
    return ok();
  };

  // ---- Parts turn up at random as you work ----
  const partRoll = () => {
    const pool = ['bolt', 'plate', 'seal', 'flag', 'spike', 'permit'];
    if (S.level >= OA.SITES.mine.lvl) pool.push('drill', 'drill');
    if (S.level >= OA.SITES.dock.lvl) pool.push('bait', 'bait');
    return OA.pick(pool);
  };
  const maybePart = (chance) => {
    // A steady trickle: the odds climb a little after each miss, so dry spells stay short.
    S.partLuck = (S.partLuck || 0) + chance * 0.25;
    if (Math.random() < chance + S.partLuck) {
      S.partLuck = 0;
      const id = partRoll();
      give(id, 1);
      return id;
    }
    return null;
  };

  // ---- Delivery Board ----
  Sim.orderSlots = () => Math.min(9, 3 + Math.floor(S.level / 2));

  const orderPool = () => {
    const L = S.level;
    const out = [];
    OA.CROPS.forEach((c) => { if (c.lvl <= L) out.push(c.id); });
    OA.CRITTERS.forEach((c) => { if (Sim.pensOf(c.id).length) out.push(c.product); });
    Sim.objs('tree').forEach((t) => {
      const d = OA.TREES.find((k) => k.id === t.kind);
      if (!out.includes(d.fruit)) out.push(d.fruit);
    });
    Sim.objs('factory').forEach((f) => {
      if (f.kind === 'synth') return;
      Sim.factoryRecipes(f).forEach((r) => { if (r.lvl <= L && !out.includes(r.id)) out.push(r.id); });
    });
    return out;
  };

  const makeOrder = () => {
    const L = S.level;
    const pool = orderPool();
    const kinds = Math.min(4, 1 + (L >= 3 ? 1 : 0) + (Math.random() < 0.25 + L / 40 ? 1 : 0) + (L >= 14 && Math.random() < 0.3 ? 1 : 0));
    // Newer, pricier goods are more likely to be asked for as you climb.
    const weigh = (id) => 1 + I[id].lvl * 0.35 + (Sim.have(id) ? 0.6 : 0);
    const chosen = [];
    const bag = pool.slice();
    while (chosen.length < kinds && bag.length) {
      const total = bag.reduce((s, id) => s + weigh(id), 0);
      let r = Math.random() * total;
      let at = 0;
      for (; at < bag.length - 1; at++) { r -= weigh(bag[at]); if (r <= 0) break; }
      chosen.push(bag.splice(at, 1)[0]);
    }
    const scale = 1 + L / 12;
    const items = chosen.map((id) => {
      const v = I[id].value;
      const n = OA.clamp(Math.round(OA.rand(1.2, 3.2) * scale * Math.sqrt(12 / (v + 4))), 1, 12);
      return { id, n };
    });
    return priceOrder(items);
  };
  const priceOrder = (items) => {
    const worth = items.reduce((s, it) => s + I[it.id].value * it.n, 0);
    return {
      who: OA.pick(OA.FOLK).id,
      items,
      credits: Math.max(3, Math.round(worth * OA.rand(1.3, 1.55))),
      xp: Math.max(2, Math.round(worth * 0.55)),
      wait: 0,
    };
  };
  Sim.orderReady = (o) => !o.wait && o.items.every((it) => Sim.have(it.id) >= it.n);

  Sim.ship = (i) => {
    const o = S.orders[i];
    if (!o || o.wait) return no('That order is on its way.');
    const lack = o.items.filter((it) => Sim.have(it.id) < it.n);
    if (lack.length) return no('You still need ' + lack.map((m) => m.n - Sim.have(m.id) + ' ' + I[m.id].name).join(' and ') + '.');
    o.items.forEach((it) => take(it.id, it.n));
    earn(o.credits);
    stat('orders');
    Sim.addXP(o.xp);
    const part = maybePart(0.1);
    S.orders[i] = { wait: now() + 20000 };
    OA.emit('shipped', { i, credits: o.credits, xp: o.xp, part, who: o.who });
    return ok({ credits: o.credits, xp: o.xp, part });
  };
  Sim.trashOrder = (i) => {
    const o = S.orders[i];
    if (!o || o.wait) return no('That order is on its way.');
    S.orders[i] = { wait: now() + 2 * MIN };
    return ok();
  };

  // ---- Trading Post ----
  Sim.shopLimits = (item, n) => {
    const fair = I[item].value * n;
    return { fair, min: Math.max(1, Math.round(fair * 0.5)), max: Math.max(2, Math.round(fair * 2)) };
  };
  Sim.shopSlotCost = () => Math.round(80 * Math.pow(2.5, S.shop.size - 4));
  Sim.shopMax = 10;
  Sim.list = (slot, item, n, price) => {
    if (S.shop.slots[slot]) return no('That crate is in use.');
    if (slot >= S.shop.size) return no('Buy this crate first.');
    if (n < 1 || Sim.have(item) < n) return no('You do not have that many.');
    const lim = Sim.shopLimits(item, n);
    price = OA.clamp(Math.round(price), lim.min, lim.max);
    const ratio = price / lim.fair;
    const wait = (40 + 80 * ratio * ratio) * 1000 * OA.rand(0.8, 1.25) * charmSpeed();
    take(item, n);
    S.shop.slots[slot] = { item, n, price, sellAt: now() + wait, sold: false, who: OA.pick(OA.FOLK).id };
    OA.emit('listed', { slot });
    return ok({ wait });
  };
  Sim.unlist = (slot) => {
    const s = S.shop.slots[slot];
    if (!s || s.sold) return no('Nothing to take back.');
    if (!Sim.spaceFor(s.item, s.n)) return no(OA.STORE[OA.storeOf(s.item)].name + ' is full.');
    give(s.item, s.n);
    S.shop.slots[slot] = null;
    return ok();
  };
  Sim.collectSale = (slot) => {
    const s = S.shop.slots[slot];
    if (!s || !s.sold) return no('Not sold yet.');
    earn(s.price);
    stat('sales');
    Sim.addXP(Math.max(1, Math.round(s.price / 8)));
    S.shop.slots[slot] = null;
    OA.emit('sale', { slot, credits: s.price });
    return ok({ credits: s.price });
  };
  Sim.buyShopSlot = () => {
    if (S.shop.size >= Sim.shopMax) return no('The post is at full size.');
    const cost = Sim.shopSlotCost();
    if (S.credits < cost) return no('You need ' + OA.fmt(cost) + ' credits.', { credits: true });
    S.credits -= cost;
    S.shop.size++;
    S.shop.slots.push(null);
    return ok();
  };

  // ---- Colony Gazette: other settlers' sales ----
  const refreshGazette = () => {
    const pool = orderPool();
    const list = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      const item = roll < 0.22 ? OA.pick(['bolt', 'plate', 'seal', 'flag', 'spike', 'permit']) : OA.pick(pool);
      const n = I[item].kind === 'part' ? 1 : OA.randi(1, 5);
      const markup = I[item].kind === 'part' ? 6 : OA.rand(1.2, 1.7);
      list.push({ item, n, price: Math.ceil(I[item].value * n * markup), who: OA.pick(OA.FOLK).id, sold: false });
    }
    S.gazette = { list, nextAt: now() + 8 * MIN };
  };
  Sim.buyListing = (i) => {
    const g = S.gazette.list[i];
    if (!g || g.sold) return no('Already sold.');
    if (S.credits < g.price) return no('You need ' + OA.fmt(g.price) + ' credits.', { credits: true });
    if (!Sim.spaceFor(g.item, g.n) && I[g.item].kind !== 'part') return no(OA.STORE[OA.storeOf(g.item)].name + ' is full.', { full: OA.storeOf(g.item) });
    S.credits -= g.price;
    give(g.item, g.n);
    g.sold = true;
    OA.emit('bought', { item: g.item, n: g.n });
    return ok();
  };
  Sim.gazetteRefreshCost = 1;
  Sim.refreshGazetteNow = () => {
    if (S.dust < Sim.gazetteRefreshCost) return no('You need 1 Stardust.', { dust: true });
    S.dust -= Sim.gazetteRefreshCost;
    refreshGazette();
    return ok();
  };

  // ---- Storage ----
  Sim.upgradeNeed = (store) => {
    const n = 1 + S.storeLv[store];
    const need = {};
    OA.STORE[store].parts.forEach((p) => { need[p] = n; });
    return need;
  };
  Sim.upgradeStore = (store) => {
    const need = Sim.upgradeNeed(store);
    const lack = missing(need);
    if (lack.length) return no('You need ' + lack.map((m) => m.n + ' more ' + I[m.id].name).join(', ') + '.', { lack });
    takeAll(need);
    S.storeLv[store]++;
    Sim.addXP(10 * S.storeLv[store]);
    OA.emit('upgraded', { store });
    return ok();
  };
  Sim.scrap = (id, n) => {
    if (Sim.have(id) < n) return no('You do not have that many.');
    const credits = Math.max(1, Math.floor(I[id].value * n * 0.5));
    take(id, n);
    earn(credits);
    return ok({ credits });
  };

  // ---- Land ----
  Sim.claimable = () => {
    const out = [];
    const M = OA.SECTOR_MAX;
    for (let sx = -M; sx <= M; sx++) {
      for (let sz = -M; sz <= M; sz++) {
        const k = sx + ',' + sz;
        if (S.sectors[k]) continue;
        if (S.sectors[sx - 1 + ',' + sz] || S.sectors[sx + 1 + ',' + sz] || S.sectors[sx + ',' + (sz - 1)] || S.sectors[sx + ',' + (sz + 1)]) out.push({ sx, sz, key: k });
      }
    }
    return out;
  };
  Sim.claimQuote = () => {
    const n = S.stats.sectors || 0;
    const parts = 1 + Math.floor(n / 2);
    return { credits: Math.round(120 * Math.pow(1.42, n)), need: { flag: parts, spike: parts, permit: parts }, lvl: 4 + Math.floor(n * 1.6) };
  };
  Sim.claim = (sx, sz) => {
    const key = sx + ',' + sz;
    if (!Sim.claimable().some((c) => c.key === key)) return no('You can only claim land next to your own.');
    const q = Sim.claimQuote();
    if (S.level < q.lvl) return no('Reach level ' + q.lvl + ' to claim more land.');
    if (S.credits < q.credits) return no('You need ' + OA.fmt(q.credits) + ' credits.', { credits: true });
    const lack = missing(q.need);
    if (lack.length) return no('You need ' + lack.map((m) => m.n + ' more ' + I[m.id].name).join(', ') + '.', { lack });
    S.credits -= q.credits;
    takeAll(q.need);
    S.sectors[key] = 1;
    stat('sectors');
    Sim.addXP(20 + 10 * S.stats.sectors);
    reindex();
    OA.emit('claimed', { sx, sz });
    OA.emit('objects');
    return ok();
  };

  // Rocks and thickets block building until cleared.
  Sim.rockCost = (r) => (r.kind === 'rock' ? 15 : 8) * (r.w > 1 ? 3 : 1);
  Sim.clearRock = (id) => {
    const r = S.rocks.find((k) => k.id === id);
    if (!r) return no('Nothing there.');
    const cost = Sim.rockCost(r);
    if (S.credits < cost) return no('You need ' + cost + ' credits.', { credits: true });
    S.credits -= cost;
    S.rocks = S.rocks.filter((k) => k !== r);
    reindex();
    Sim.addXP(3);
    const part = maybePart(0.3);
    OA.emit('cleared', { id, x: r.x + r.w / 2, z: r.z + r.w / 2, part });
    return ok({ part });
  };

  // ---- Falling supply crates ----
  Sim.openMeteor = (id) => {
    const m = S.meteors.find((k) => k.id === id);
    if (!m) return no('It is gone.');
    S.meteors = S.meteors.filter((k) => k !== m);
    const roll = Math.random();
    const out = {};
    if (roll < 0.12) { out.dust = 1; S.dust += 1; }
    else if (roll < 0.6) { out.part = partRoll(); give(out.part, 1); }
    else { out.credits = 10 + S.level * 8; earn(out.credits); }
    Sim.addXP(2);
    stat('meteors');
    OA.emit('meteorOpened', Object.assign({ id, x: m.x, z: m.z }, out));
    return ok(out);
  };

  // ---- Supply Rocket ----
  Sim.rocketOpen = () => S.level >= OA.SITES.rocket.lvl;
  const makeRocket = () => {
    const pool = orderPool().filter((id) => I[id].kind !== 'crop' || I[id].lvl > 2);
    const picks = OA.shuffle(pool).slice(0, 3);
    while (picks.length < 3) picks.push(OA.pick(orderPool()));
    const crates = [];
    picks.forEach((id) => {
      const n = OA.clamp(Math.round(Math.sqrt(120 / (I[id].value + 6)) + S.level / 10), 2, 10);
      for (let i = 0; i < 3; i++) {
        crates.push({ item: id, n, done: false, credits: Math.round(I[id].value * n * 1.6), xp: Math.round(I[id].value * n * 0.7) });
      }
    });
    return crates;
  };
  Sim.fillCrate = (i) => {
    const r = S.rocket;
    if (r.state !== 'here') return no('The rocket is away.');
    const c = r.crates[i];
    if (!c || c.done) return no('Already loaded.');
    if (Sim.have(c.item) < c.n) return no('You need ' + c.n + ' ' + I[c.item].name + '.');
    take(c.item, c.n);
    c.done = true;
    earn(c.credits);
    Sim.addXP(c.xp);
    OA.emit('crate', { i, credits: c.credits, xp: c.xp });
    if (r.crates.every((k) => k.done)) launchRocket(true);
    return ok();
  };
  const launchRocket = (full) => {
    const r = S.rocket;
    const reward = {};
    if (full) {
      reward.credits = Math.round(r.crates.reduce((s, c) => s + c.credits, 0) * 0.4);
      reward.dust = 3;
      reward.part = partRoll();
      earn(reward.credits);
      S.dust += reward.dust;
      give(reward.part, 1);
      stat('rockets');
    }
    S.rocket = { state: 'away', at: now() + 12 * MIN, crates: [] };
    OA.emit('rocketLeft', { full, reward });
  };

  // ---- Town ----
  Sim.townOpen = () => S.level >= OA.SITES.town.lvl;
  Sim.lotOpen = (lot) => S.level >= lot.lvl;
  Sim.restore = (id) => {
    const lot = OA.TOWN_LOTS.find((l) => l.id === id);
    if (!lot || S.town.lots[id]) return no('Already open.');
    if (S.level < lot.lvl) return no('Unlocks at level ' + lot.lvl + '.');
    if (S.credits < lot.cost) return no('You need ' + OA.fmt(lot.cost) + ' credits.', { credits: true });
    const lack = missing(lot.need);
    if (lack.length) return no('You need ' + lack.map((m) => m.n + ' more ' + I[m.id].name).join(', ') + '.', { lack });
    S.credits -= lot.cost;
    takeAll(lot.need);
    S.town.lots[id] = 1;
    Sim.addXP(40);
    S.town.nextAt = Math.min(S.town.nextAt || Infinity, now() + 8000);
    OA.emit('restored', { id });
    OA.emit('objects');
    return ok();
  };
  Sim.townCap = () => OA.TOWN_LOTS.reduce((n, l) => n + (S.town.lots[l.id] ? l.cap : 0), 0);
  Sim.townTip = () => OA.TOWN_LOTS.reduce((n, l) => n + (S.town.lots[l.id] ? l.tip : 0), 0);
  const makeVisitor = () => {
    const pool = orderPool();
    const kinds = OA.randi(1, S.level >= 20 ? 3 : 2);
    const picked = OA.shuffle(pool).slice(0, kinds);
    const items = picked.map((id) => ({ id, n: OA.clamp(Math.round(Math.sqrt(40 / (I[id].value + 4))) + 1, 1, 5) }));
    const worth = items.reduce((s, it) => s + I[it.id].value * it.n, 0);
    return {
      who: OA.pick(OA.FOLK).id,
      items,
      credits: Math.round(worth * (1.6 + Sim.townTip())),
      xp: Math.round(worth * 0.6),
      rep: 1 + Math.floor(worth / 150),
    };
  };
  Sim.repNeed = () => 10 + 8 * S.town.rank;
  Sim.serve = (i) => {
    const v = S.town.visitors[i];
    if (!v) return no('They already left.');
    const lack = v.items.filter((it) => Sim.have(it.id) < it.n);
    if (lack.length) return no('You still need ' + lack.map((m) => m.n - Sim.have(m.id) + ' ' + I[m.id].name).join(' and ') + '.');
    v.items.forEach((it) => take(it.id, it.n));
    earn(v.credits);
    Sim.addXP(v.xp);
    stat('visitors');
    S.town.visitors.splice(i, 1);
    S.town.rep += v.rep;
    let ranked = false;
    while (S.town.rep >= Sim.repNeed()) {
      S.town.rep -= Sim.repNeed();
      S.town.rank++;
      S.dust += 3;
      ranked = true;
    }
    if (!S.town.nextAt || S.town.nextAt > now() + 60000) S.town.nextAt = now() + 60000;
    OA.emit('served', { credits: v.credits, ranked, rank: S.town.rank });
    return ok({ credits: v.credits, ranked });
  };

  // ---- Hollow Mine ----
  Sim.MINE_W = 6;
  Sim.MINE_H = 6;
  const newMine = () => {
    const cells = [];
    const L = S.level;
    for (let i = 0; i < Sim.MINE_W * Sim.MINE_H; i++) {
      const deep = Math.floor(i / Sim.MINE_W) / (Sim.MINE_H - 1);
      const r = Math.random();
      let k = null;
      if (r < 0.04 + deep * 0.04) k = L >= 18 && Math.random() < 0.25 ? 'diamond' : L >= 12 && Math.random() < 0.5 ? 'opal' : 'ruby';
      else if (r < 0.14 + deep * 0.1) k = L >= 15 && deep > 0.4 ? 'voidium' : 'lumite';
      else if (r < 0.42) k = 'ferrite';
      else if (r < 0.46) k = 'part';
      cells.push({ k, dug: false, glint: !!k && Math.random() < 0.55 });
    }
    S.mine = { cells, resetAt: now() + 45 * MIN };
  };
  const digCell = (i) => {
    const c = S.mine.cells[i];
    if (!c || c.dug) return null;
    c.dug = true;
    stat('digs');
    if (!c.k) return { i };
    if (c.k === 'part') {
      const id = partRoll();
      give(id, 1);
      return { i, item: id };
    }
    give(c.k, 1);
    Sim.addXP(I[c.k].xp);
    return { i, item: c.k };
  };
  Sim.dig = (i, tool) => {
    if (!S.mine) newMine();
    const c = S.mine.cells[i];
    if (!c || c.dug) return no('Already dug.');
    if (Sim.have(tool) < 1) return no('You need a ' + I[tool].name + '.', { tool });
    take(tool, 1);
    const cells = tool === 'charge'
      ? [i, i - 1, i + 1, i - Sim.MINE_W, i + Sim.MINE_W].filter((k) => k >= 0 && k < S.mine.cells.length && (Math.abs(k % Sim.MINE_W - i % Sim.MINE_W) <= 1))
      : [i];
    const found = cells.map(digCell).filter(Boolean);
    OA.emit('dug', { found });
    return ok({ found });
  };
  Sim.toolPrice = { drill: 18, charge: 60, bait: 10 };
  Sim.buyTool = (id, n = 1) => {
    const cost = Sim.toolPrice[id] * n;
    if (S.credits < cost) return no('You need ' + OA.fmt(cost) + ' credits.', { credits: true });
    S.credits -= cost;
    give(id, n);
    OA.emit('bought', { item: id, n });
    return ok();
  };
  Sim.freshMine = () => { newMine(); return ok(); };
  Sim.mineLeft = () => S.mine ? S.mine.cells.filter((c) => !c.dug && c.k).length : 0;

  // ---- Star Sea ----
  Sim.cast = () => {
    if (Sim.have('bait') < 1) return no('You need Glow Bait.', { tool: 'bait' });
    take('bait', 1);
    const pool = OA.FISH.filter((f) => f.lvl <= S.level);
    const total = pool.reduce((s, f) => s + f.weight, 0);
    let r = Math.random() * total;
    let fish = pool[0];
    for (const f of pool) { r -= f.weight; if (r <= 0) { fish = f; break; } }
    return ok({ fish: fish.id });
  };
  Sim.landFish = (id) => {
    if (!Sim.spaceFor(id, 1)) return no(OA.STORE.bay.name + ' is full.', { full: 'bay' });
    give(id, 1);
    stat('fish');
    Sim.addXP(I[id].xp * 2);
    OA.emit('fished', { id });
    return ok({ id });
  };

  // ---- Mission log and daily gift ----
  const goalCheck = () => { S.goalsDirty = true; };
  Sim.goalProgress = (g) => Math.min(g.goal, S.stats[g.stat] || 0);
  Sim.goalClaimable = (g) => !S.goals[g.id] && Sim.goalProgress(g) >= g.goal;
  Sim.claimGoal = (id) => {
    const g = OA.GOALS.find((k) => k.id === id);
    if (!g || !Sim.goalClaimable(g)) return no('Not finished yet.');
    S.goals[id] = 1;
    S.dust += g.dust;
    OA.emit('goal', { id, dust: g.dust });
    return ok({ dust: g.dust });
  };
  Sim.goalsReady = () => OA.GOALS.filter(Sim.goalClaimable).length;

  const dayKey = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  Sim.dailyReady = () => S.daily.day !== dayKey(now());
  Sim.claimDaily = () => {
    if (!Sim.dailyReady()) return no('Come back tomorrow.');
    const today = dayKey(now());
    const yesterday = dayKey(now() - 24 * 3600 * 1000);
    S.daily.streak = S.daily.day === yesterday ? S.daily.streak + 1 : 1;
    S.daily.day = today;
    const step = (S.daily.streak - 1) % 7;
    const out = { streak: S.daily.streak, credits: 0, dust: 0, part: null };
    out.credits = 20 + S.level * 10 * (1 + step);
    earn(out.credits);
    if (step === 2 || step === 5) { out.part = partRoll(); give(out.part, 1); }
    if (step === 6) { out.dust = 5; S.dust += 5; } else if (step % 3 === 0) { out.dust = 1; S.dust += 1; }
    return ok(out);
  };

  // ---- Time passes ----
  Sim.tick = () => {
    const t = now();
    Sim.objs('factory').forEach((f) => { if (settleFactory(f, t)) OA.emit('goodReady', { id: f.id }); });

    S.shop.slots.forEach((s, i) => {
      if (s && !s.sold && t >= s.sellAt) { s.sold = true; OA.emit('sold', { slot: i, s }); }
    });

    S.orders.forEach((o, i) => { if (o.wait && t >= o.wait) { S.orders[i] = makeOrder(); OA.emit('newOrder', { i }); } });

    if (S.level >= OA.BUILD.gazette.lvl && (!S.gazette || t >= S.gazette.nextAt)) refreshGazette();

    if (Sim.rocketOpen()) {
      const r = S.rocket;
      if (r.state === 'locked') { S.rocket = { state: 'away', at: t + 45000, crates: [] }; }
      else if (r.state === 'away' && t >= r.at) {
        S.rocket = { state: 'here', at: t + 30 * MIN, crates: makeRocket() };
        OA.emit('rocketArrived', {});
      } else if (r.state === 'here' && t >= r.at) launchRocket(false);
    }

    if (Sim.townOpen() && Sim.townCap() > 0) {
      const T = S.town;
      if (!T.nextAt) T.nextAt = t + 15000;
      if (t >= T.nextAt) {
        if (T.visitors.length < Sim.townCap() + 1) { T.visitors.push(makeVisitor()); OA.emit('visitor', {}); }
        T.nextAt = t + OA.rand(3, 6) * MIN * charmSpeed();
      }
    }

    if (S.mine && t >= S.mine.resetAt) newMine();
    if (S.mine && Sim.mineLeft() === 0) newMine();

    // Supply crates only fall while you are here to see them.
    if (t >= S.meteorAt) {
      S.meteorAt = t + OA.rand(5, 11) * MIN;
      if (S.meteors.length < 2 && S.lastSeen && t - S.lastSeen < 5000) {
        for (let tries = 0; tries < 30; tries++) {
          const x = OA.randi(-OA.LAND_EDGE, OA.LAND_EDGE - 1);
          const z = OA.randi(-OA.LAND_EDGE, OA.LAND_EDGE - 1);
          if (Sim.owned(x, z) && !occ.has(x + ',' + z)) {
            const m = { id: S.nextId++, x: x + 0.5, z: z + 0.5, at: t };
            S.meteors.push(m);
            OA.emit('meteor', m);
            break;
          }
        }
      }
    }
    S.lastSeen = t;
    if (S.goalsDirty) { S.goalsDirty = false; OA.emit('goals', {}); }
  };

  // Tally what happened while the game was closed.
  const awaySummary = (since, until) => {
    const out = { ms: until - since, fields: 0, critters: 0, goods: 0, sales: 0, credits: 0 };
    Sim.objs('field').forEach((f) => { if (f.crop && f.readyAt > since && f.readyAt <= until) out.fields++; });
    Sim.objs('pen').forEach((p) => p.critters.forEach((c) => { if (c.readyAt && c.readyAt > since && c.readyAt <= until) out.critters++; }));
    Sim.objs('factory').forEach((f) => f.queue.forEach((q) => { if (q.end > since && q.end <= until) out.goods++; }));
    S.shop.slots.forEach((s) => { if (s && !s.sold && s.sellAt > since && s.sellAt <= until) { out.sales++; out.credits += s.price; } });
    return out;
  };

  // ---- New colony ----
  const startRocks = () => {
    S.rocks = [];
    const spots = [[-9, 9], [-3, 9], [2, 10], [9, 8], [10, 3], [-10, 2], [-4, 3], [7, 9], [-1, 7], [9, -9], [11, -3], [-11, 8]];
    spots.forEach(([x, z], i) => {
      const r = { id: i + 1, x, z, w: 1, kind: i % 3 === 0 ? 'rock' : i % 3 === 1 ? 'thicket' : 'crystal', seed: i };
      S.rocks.push(r);
    });
  };

  Sim.newGame = (name) => {
    const t = now();
    S = {
      v: OA.SAVE_VERSION,
      uid: Math.random().toString(36).slice(2, 12),
      name: name || 'New Haven',
      created: t,
      lastSeen: t,
      level: 1,
      xp: 0,
      credits: 50,
      dust: 5,
      inv: { wheat: 6, corn: 4, feed_puff: 3 },
      seen: { wheat: 1, corn: 1 },
      storeLv: { silo: 0, bay: 0 },
      sectors: {},
      objs: [],
      rocks: [],
      nextId: 100,
      orders: [],
      shop: { size: 4, slots: [null, null, null, null] },
      gazette: null,
      rocket: { state: 'locked', at: 0, crates: [] },
      town: { lots: {}, rep: 0, rank: 0, visitors: [], nextAt: 0 },
      mine: null,
      meteors: [],
      meteorAt: t + 4 * MIN,
      daily: { day: 0, streak: 0 },
      goals: {},
      stats: { orders: 0, harvests: 0, feeds: 0, goods: 0, sales: 0, fish: 0, digs: 0, sectors: 0, charm: 0, visitors: 0, rockets: 0, earned: 0, meteors: 0, decor: 0 },
      tut: 0,
      fastEggs: true,
      settings: { sound: true, music: true },
    };
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) S.sectors[a + ',' + b] = 1;
    startRocks();
    reindex();
    addObj({ type: 'pad', x: -12, z: -12 });
    addObj({ type: 'board', x: -6, z: -12 });
    addObj({ type: 'silo', x: -2, z: -12 });
    addObj({ type: 'bay', x: 3, z: -12 });
    addObj({ type: 'factory', kind: 'synth', x: -12, z: -5, queue: [], done: [], slots: 2 });
    addObj({ type: 'pen', kind: 'puffling', x: 4, z: -6, critters: [{ readyAt: null }, { readyAt: null }, { readyAt: null }] });
    for (let i = 0; i < 6; i++) {
      const x = -5 + (i % 3) * 2;
      const z = -4 + Math.floor(i / 3) * 2;
      const ripe = i < 3;
      addObj({ type: 'field', x, z, crop: ripe ? 'wheat' : null, readyAt: ripe ? t - 1000 : 0, planted: ripe ? t - 60000 : 0 });
    }
    // The first orders are simple so the opening goes smoothly.
    S.orders = [
      Object.assign(priceOrder([{ id: 'wheat', n: 4 }]), { who: 'zib' }),
      Object.assign(priceOrder([{ id: 'egg', n: 2 }]), { who: 'juno' }),
      Object.assign(priceOrder([{ id: 'corn', n: 2 }]), { who: 'nana' }),
    ];
    reindex();
    return S;
  };

  // ---- Loading and saving ----
  Sim.save = () => { S.lastSeen = now(); return JSON.stringify(S); };
  Sim.load = (text) => {
    const data = typeof text === 'string' ? JSON.parse(text) : text;
    if (!data || !data.objs) throw new Error('Not an Orbit Acres save.');
    const since = data.lastSeen || now();
    S = data;
    reindex();
    const until = now();
    const away = awaySummary(since, until);
    Sim.tick();
    return away;
  };
})(typeof window !== 'undefined' ? window : globalThis);
