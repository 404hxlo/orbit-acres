// Headless playtest: a greedy bot plays for a set amount of game time, and we
// report how long each level takes and whether any rule ever goes wrong.
// Run: node tools/bot.js [hours] [checksPerMinute] [saveFile]
// With a save file, the bot's colony is written there, ending at the present moment,
// so the game can be tested with a grown colony.
require('../js/core.js');
require('../js/data.js');
require('../js/sim.js');
const OA = globalThis.OA;
const Sim = OA.Sim;

const hours = Number(process.argv[2] || 6);
const rate = Number(process.argv[3] || 4); // how many times a minute the bot acts
const saveTo = process.argv[4];
let clock = saveTo ? Date.now() - hours * 3600000 : 1_800_000_000_000;
OA.now = () => clock;
const levelTimes = {};
const start = clock;
OA.on('level', (e) => { levelTimes[e.level] = (clock - start) / 60000; });

Sim.newGame('Bot');
const S = Sim.state();

const firstFree = (w, d) => Sim.findSpot(w, d, 0, 0);
const need = () => {
  // What the current orders want, in plain counts.
  const want = {};
  S.orders.forEach((o) => { if (!o.wait) o.items.forEach((it) => { want[it.id] = (want[it.id] || 0) + it.n; }); });
  return want;
};

const act = () => {
  Sim.tick();
  // Harvest and collect everything.
  Sim.objs('field').forEach((f) => { if (Sim.fieldReady(f)) Sim.harvest(f.id); });
  Sim.objs('tree').forEach((t) => { Sim.pickTree(t.id); });
  Sim.objs('pen').forEach((p) => { Sim.collectPen(p.id); Sim.feedPen(p.id); });
  Sim.objs('factory').forEach((f) => { while (Sim.collectGood(f.id).ok); });

  // Ship anything we can.
  S.orders.forEach((o, i) => { if (Sim.orderReady(o)) Sim.ship(i); });

  // Decide what to brew: inputs for orders first, then critter feed.
  const want = need();
  const walk = (id, n, depth) => {
    if (depth > 4) return;
    const have = Sim.have(id);
    if (have >= n) return;
    const r = OA.RECIPES[id];
    if (r) {
      Object.keys(r.inputs).forEach((k) => walk(k, r.inputs[k] * (n - have), depth + 1));
      const f = Sim.objs('factory').find((o) => o.kind === r.factory);
      if (f) Sim.queue(f.id, id);
    }
  };
  Object.keys(want).forEach((id) => walk(id, want[id], 0));
  OA.CRITTERS.forEach((c) => {
    if (Sim.pensOf(c.id).length && Sim.have(c.feed) < 6) walk(c.feed, 6, 0);
  });

  // Plant what is short, keeping cheap staples going.
  const crops = OA.CROPS.filter((c) => c.lvl <= S.level);
  const shortage = (c) => (want[c.id] || 0) * 2 + 8 - Sim.have(c.id);
  Sim.objs('field').forEach((f) => {
    if (f.crop) return;
    const c = crops.slice().sort((a, b) => shortage(b) - shortage(a))[0];
    Sim.plant(f.id, c.id);
  });

  // Clear surplus the way a player would, so storage never jams.
  ['silo', 'bay'].forEach((store) => {
    if (Sim.used(store) > Sim.capacity(store) * 0.8) {
      const ids = Object.keys(S.inv).filter((id) => OA.storeOf(id) === store && OA.ITEMS[id].kind !== 'part' && !want[id]).sort((a, b) => Sim.have(b) - Sim.have(a));
      if (ids[0]) Sim.scrap(ids[0], Math.ceil(Sim.have(ids[0]) / 2));
    }
  });

  // Spend money on growth.
  const buy = (spec) => {
    const q = Sim.quote(spec);
    if (!q.ok || S.credits < q.cost * 1.1) return false;
    const spot = firstFree(q.w, q.d);
    if (!spot) return false;
    return Sim.buy(spec, spot.x, spot.z).ok;
  };
  Object.keys(OA.FACTORIES).forEach((k) => buy({ type: 'factory', kind: k }));
  OA.CRITTERS.forEach((c) => {
    if (S.level >= c.lvl && !Sim.pensOf(c.id).length) buy({ type: 'pen', kind: c.id });
    Sim.pensOf(c.id).forEach((p) => { if (S.credits > 200) Sim.buyCritter(p.id); });
  });
  const saving = OA.CRITTERS.some((c) => S.level >= c.lvl && !Sim.pensOf(c.id).length) || Object.values(OA.FACTORIES).some((f) => S.level >= f.lvl && !Sim.factoryOwned(f.id));
  if (!saving && S.credits > 80 && Sim.fieldCount() < 12 + S.level) buy({ type: 'field' });
  ['silo', 'bay'].forEach((s) => Sim.upgradeStore(s));
  if (S.credits > 800) { const c = Sim.claimable()[0]; if (c) Sim.claim(c.sx, c.sz); }
  // Sell surplus at the post.
  if (Sim.objs('post').length) {
    S.shop.slots.forEach((s, i) => {
      if (s && s.sold) Sim.collectSale(i);
      if (!s && i < S.shop.size) {
        const extra = Object.keys(S.inv).filter((id) => OA.ITEMS[id].kind === 'good' && Sim.have(id) > 3);
        if (extra.length) { const id = extra[0]; Sim.list(i, id, 2, OA.ITEMS[id].value * 2 * 1.5); }
      }
    });
  }
  // Fill the rocket and serve visitors.
  if (S.rocket.state === 'here') S.rocket.crates.forEach((c, i) => { if (!c.done && Sim.have(c.item) >= c.n) Sim.fillCrate(i); });
  S.town.visitors.forEach((v, i) => { Sim.serve(i); });
  OA.TOWN_LOTS.forEach((l) => { Sim.restore(l.id); });
  // Clear old orders that have stalled for a while.
  if (Math.random() < 0.02) { const i = OA.randi(0, S.orders.length - 1); if (S.orders[i] && !S.orders[i].wait && !Sim.orderReady(S.orders[i])) Sim.trashOrder(i); }
};

const step = 60000 / rate;
const end = start + hours * 3600000;
let peak = 0;
while (clock < end) {
  act();
  // The sanity rules: nothing may ever be negative or broken.
  if (S.credits < 0 || S.dust < 0) throw new Error('negative money');
  for (const id in S.inv) if (!(S.inv[id] > 0)) throw new Error('bad stack ' + id);
  S.objs.forEach((o) => { if (o.x === undefined) throw new Error('bad object'); });
  peak = Math.max(peak, S.credits);
  clock += step;
}

// Save, reload, and confirm nothing changed.
const text = Sim.save();
Sim.load(text);
const again = Sim.save();
if (JSON.parse(text).objs.length !== JSON.parse(again).objs.length) throw new Error('save lost objects');
if (saveTo) require('fs').writeFileSync(saveTo, text);

console.log('Played', hours, 'hours at', rate, 'checks a minute');
console.log('Level reached', S.level, '| credits', OA.fmt(S.credits), '| stardust', S.dust, '| plots', Sim.fieldCount(), '| factories', Sim.objs('factory').length, '| pens', Sim.objs('pen').length);
console.log('Stats', JSON.stringify(S.stats));
console.log('Storage', Sim.used('silo') + '/' + Sim.capacity('silo'), Sim.used('bay') + '/' + Sim.capacity('bay'), '| save size', (text.length / 1024).toFixed(1) + ' KB');
console.log('Minutes to reach level:', Object.keys(levelTimes).map((k) => k + ':' + levelTimes[k].toFixed(0)).join(' '));
