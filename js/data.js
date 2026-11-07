// Orbit Acres: everything you can grow, raise, make, build and buy.
(function (root) {
  const OA = root.OA;

  // Items. `art` picks the sticker drawn for the item: [archetype, color, color2].
  const I = (OA.ITEMS = {});
  const add = (id, name, kind, lvl, art, extra) => { I[id] = Object.assign({ id, name, kind, lvl, art }, extra); };

  // ---- Crops: plant one, harvest two. ----
  OA.CROPS = [
    { id: 'wheat', name: 'Moonwheat', lvl: 1, time: 20, value: 2, art: ['grain', 0xdfe6ff, 0xa8b6ff], blurb: 'Silver grain that rustles without wind.' },
    { id: 'corn', name: 'Glowcorn', lvl: 1, time: 60, value: 4, art: ['corn', 0x7cf7c0, 0x35b98c], blurb: 'Lights up the rows at night.' },
    { id: 'bean', name: 'Fizzbeans', lvl: 2, time: 120, value: 6, art: ['bean', 0xff9bd2, 0xd94f9b], blurb: 'Pods pop softly when ripe.' },
    { id: 'cane', name: 'Bubblecane', lvl: 4, time: 240, value: 9, art: ['cane', 0x8ee9ff, 0x3fa7d6], blurb: 'Hollow stalks full of sweet foam.' },
    { id: 'gourd', name: 'Starkin', lvl: 6, time: 360, value: 13, art: ['gourd', 0xffa24d, 0xd9682a], blurb: 'A heavy gourd with a star-shaped stem.' },
    { id: 'berry', name: 'Zapberries', lvl: 8, time: 480, value: 16, art: ['berry', 0x9d7bff, 0x5f3fd1], blurb: 'They tingle on the tongue.' },
    { id: 'cotton', name: 'Puffcotton', lvl: 10, time: 720, value: 20, art: ['boll', 0xfff4fb, 0xe7c8ff], blurb: 'Floats away if you do not pick it.' },
    { id: 'root', name: 'Emberroot', lvl: 12, time: 900, value: 24, art: ['root', 0xff6a3d, 0xffc15c], blurb: 'Warm to the touch, even underground.' },
    { id: 'chili', name: 'Frost Chili', lvl: 15, time: 1200, value: 30, art: ['chili', 0x78e0ff, 0x2f8fd8], blurb: 'Tastes hot, feels cold.' },
    { id: 'melon', name: 'Plasmelon', lvl: 18, time: 1800, value: 40, art: ['melon', 0xff5fa8, 0xffd0e6], blurb: 'Crackles when you tap it.' },
    { id: 'shroom', name: 'Dreamcaps', lvl: 22, time: 2400, value: 50, art: ['shroom', 0xc77bff, 0xfff0a8], blurb: 'Only grow when nobody is looking.' },
    { id: 'bloom', name: 'Solarbloom', lvl: 26, time: 3600, value: 64, art: ['bloom', 0xffd94d, 0xff8a3d], blurb: 'Turns to follow the nearest star.' },
  ];
  OA.CROPS.forEach((c) => add(c.id, c.name, 'crop', c.lvl, c.art, { value: c.value, time: c.time, blurb: c.blurb }));

  // ---- Orchard trees: bought once, picked many times. ----
  OA.TREES = [
    { id: 'apple', name: 'Star Apple Tree', fruit: 'fapple', fruitName: 'Star Apple', lvl: 9, time: 1200, value: 18, picks: 8, cost: 120, canopy: 0xff8fc7, fruitColor: 0xffe05c },
    { id: 'plum', name: 'Nebuplum Tree', fruit: 'plum', fruitName: 'Nebuplum', lvl: 14, time: 1800, value: 26, picks: 8, cost: 300, canopy: 0x7ce8ff, fruitColor: 0x8a5cff },
    { id: 'cocoa', name: 'Cosmo Cocoa Tree', fruit: 'cocoa', fruitName: 'Cosmo Cocoa', lvl: 20, time: 2700, value: 38, picks: 8, cost: 600, canopy: 0xffa96b, fruitColor: 0x9c5a33 },
  ];
  add('fapple', 'Star Apple', 'crop', 9, ['fruit', 0xffe05c, 0xff9d3d], { value: 18, tree: true });
  add('plum', 'Nebuplum', 'crop', 14, ['fruit', 0x8a5cff, 0xff78d8], { value: 26, tree: true });
  add('cocoa', 'Cosmo Cocoa', 'crop', 20, ['pod', 0x9c5a33, 0xffc98a], { value: 38, tree: true });

  // ---- Critters. ----
  OA.CRITTERS = [
    { id: 'puffling', name: 'Puffling', lvl: 1, time: 120, feed: 'feed_puff', product: 'egg', cost: 30, perPen: 6, penCost: 80, blurb: 'A fluffy ball that lays Star Eggs.' },
    { id: 'moonmoo', name: 'Moonmoo', lvl: 4, time: 300, feed: 'feed_moo', product: 'milk', cost: 120, perPen: 5, penCost: 220, blurb: 'Gentle grazer full of Nebula Milk.' },
    { id: 'snuffle', name: 'Snuffle', lvl: 8, time: 600, feed: 'feed_snuf', product: 'truffle', cost: 260, perPen: 5, penCost: 480, blurb: 'Roots out Glowtruffles with its snout.' },
    { id: 'nimbaa', name: 'Nimbaa', lvl: 11, time: 900, feed: 'feed_nim', product: 'wool', cost: 420, perPen: 5, penCost: 800, blurb: 'A floating cloud that grows soft wool.' },
    { id: 'lumibee', name: 'Lumibee', lvl: 16, time: 1200, feed: 'feed_bee', product: 'honey', cost: 700, perPen: 4, penCost: 1300, blurb: 'Glowing bees that bottle starlight.' },
    { id: 'drift', name: 'Drift Jelly', lvl: 24, time: 2400, feed: 'feed_drift', product: 'silk', cost: 1500, perPen: 4, penCost: 2600, blurb: 'Drifts overhead, trailing silver silk.' },
  ];
  add('egg', 'Star Egg', 'animal', 1, ['egg', 0xfff0c9, 0xffc95c], { from: 'puffling' });
  add('milk', 'Nebula Milk', 'animal', 4, ['flask', 0xe9dcff, 0x8f6bff], { from: 'moonmoo' });
  add('truffle', 'Glowtruffle', 'animal', 8, ['truffle', 0x8d5fc9, 0x7cf7c0], { from: 'snuffle' });
  add('wool', 'Cloud Wool', 'animal', 11, ['puff', 0xf3f6ff, 0xb5c8ff], { from: 'nimbaa' });
  add('honey', 'Lumihoney', 'animal', 16, ['jar', 0xffc94d, 0xff8f2e], { from: 'lumibee' });
  add('silk', 'Jelly Silk', 'animal', 24, ['ribbon', 0xc9f6ff, 0x8fd8ff], { from: 'drift' });

  // ---- Fish and mine finds. ----
  OA.FISH = [
    { id: 'trout', name: 'Void Trout', value: 14, lvl: 7, speed: 0.8, zone: 0.34, weight: 50, art: ['fish', 0x7f8cff, 0xc9d0ff] },
    { id: 'lumafish', name: 'Lumafish', value: 24, lvl: 7, speed: 1.15, zone: 0.28, weight: 30, art: ['fish', 0x6ff5c8, 0xfff4a8] },
    { id: 'eel', name: 'Comet Eel', value: 40, lvl: 10, speed: 1.55, zone: 0.24, weight: 14, art: ['eel', 0xff8f5c, 0xffe08a] },
    { id: 'ray', name: 'Star Ray', value: 64, lvl: 14, speed: 1.9, zone: 0.2, weight: 5, art: ['ray', 0xff6fd0, 0xffd0f0] },
    { id: 'kraken', name: 'Pocket Kraken', value: 120, lvl: 20, speed: 2.4, zone: 0.17, weight: 1, art: ['kraken', 0xb06bff, 0xffd0f0] },
  ];
  OA.FISH.forEach((f) => add(f.id, f.name, 'fish', f.lvl, f.art, { value: f.value }));

  add('ferrite', 'Ferrite Ore', 'ore', 9, ['ore', 0x9fa8c9, 0xd6dcff], { value: 16 });
  add('lumite', 'Lumite Ore', 'ore', 9, ['ore', 0x46d6c0, 0xa8fff0], { value: 28 });
  add('voidium', 'Voidium Ore', 'ore', 15, ['ore', 0x6a3fd0, 0xff7be0], { value: 48 });
  add('ruby', 'Star Ruby', 'ore', 9, ['gem', 0xff4d6d, 0xffa8b8], { value: 70 });
  add('opal', 'Moon Opal', 'ore', 12, ['gem', 0x8ee9ff, 0xf3e0ff], { value: 100 });
  add('diamond', 'Void Diamond', 'ore', 18, ['gem', 0xf4f0ff, 0xb9a8ff], { value: 160 });

  // ---- Parts and tools: these turn up while you work. ----
  add('bolt', 'Hull Bolt', 'part', 1, ['bolt', 0xc9d0e8, 0x7c86ad], { value: 12 });
  add('plate', 'Hull Plate', 'part', 1, ['plate', 0x9fd8ff, 0x4f8fd0], { value: 12 });
  add('seal', 'Sealant Tape', 'part', 1, ['tape', 0xffc94d, 0x8a6a2e], { value: 12 });
  add('flag', 'Survey Flag', 'part', 1, ['flag', 0xff7a6b, 0xe9e4ff], { value: 16 });
  add('spike', 'Terra Spike', 'part', 1, ['spike', 0x6ff5c8, 0x4b3f8f], { value: 16 });
  add('permit', 'Land Permit', 'part', 1, ['permit', 0xfff4d6, 0xff7a6b], { value: 16 });
  add('drill', 'Hand Drill', 'tool', 9, ['drill', 0xffb03d, 0xc9d0e8], { value: 10 });
  add('charge', 'Plasma Charge', 'tool', 9, ['charge', 0xff5f7e, 0xffe08a], { value: 30 });
  add('bait', 'Glow Bait', 'tool', 7, ['bait', 0x7cf7c0, 0xff7be0], { value: 6 });

  // ---- Factories and what they make. ----
  // Recipe row: [id, name, level, seconds, {inputs}, outputCount, art]
  const FACTORY_ROWS = [
    { id: 'synth', name: 'Feed Synth', lvl: 1, cost: 40, blurb: 'Turns crops into critter feed.', recipes: [
      ['feed_puff', 'Puffling Pellets', 1, 30, { wheat: 2, corn: 1 }, 3, ['sack', 0xffd08a, 0xff9d3d]],
      ['feed_moo', 'Moonmoo Mash', 4, 90, { bean: 2, corn: 1 }, 3, ['sack', 0xc9b0ff, 0x8f6bff]],
      ['feed_snuf', 'Snuffle Chow', 8, 180, { corn: 2, cane: 1 }, 3, ['sack', 0xffb0d8, 0xe0559b]],
      ['feed_nim', 'Nimbaa Nibbles', 11, 300, { wheat: 2, cotton: 1 }, 3, ['sack', 0xc9f0ff, 0x4fb8e0]],
      ['feed_bee', 'Bloom Dust', 16, 480, { berry: 2, cane: 1 }, 3, ['sack', 0xfff0a8, 0xe0a82e]],
      ['feed_drift', 'Drift Plankton', 24, 720, { melon: 1, bean: 3 }, 3, ['sack', 0xa8fff0, 0x35b98c]],
    ] },
    { id: 'bakery', name: 'Bio-Bakery', lvl: 2, cost: 60, blurb: 'Warm bread, even in hard vacuum.', recipes: [
      ['bread', 'Moon Loaf', 2, 60, { wheat: 3 }, 1, ['loaf', 0xe8b070, 0xfff0d0]],
      ['cornbread', 'Glow Cornbread', 3, 150, { corn: 2, egg: 1 }, 1, ['loaf', 0xbfe870, 0xf4ffc0]],
      ['bun', 'Comet Bun', 6, 300, { wheat: 2, egg: 1, butter: 1 }, 1, ['bun', 0xe8a060, 0xfff4e0]],
      ['cookie', 'Star Cookies', 7, 480, { wheat: 2, egg: 2, sugar: 1 }, 1, ['cookie', 0xe8b878, 0x7a4a2e]],
    ] },
    { id: 'dairy', name: 'Cream Module', lvl: 5, cost: 150, blurb: 'Spins Nebula Milk into richer things.', recipes: [
      ['cream', 'Nebula Cream', 5, 120, { milk: 1 }, 1, ['pot', 0xf3e8ff, 0xb08fff]],
      ['butter', 'Moon Butter', 5, 240, { milk: 2 }, 1, ['block', 0xffe58a, 0xfff4c0]],
      ['cheese', 'Crater Cheese', 7, 480, { milk: 3 }, 1, ['wedge', 0xffd24d, 0xffa82e]],
    ] },
    { id: 'sugar', name: 'Sugar Spinner', lvl: 6, cost: 220, blurb: 'Whirls Bubblecane into sweet stuff.', recipes: [
      ['sugar', 'Bubble Sugar', 6, 120, { cane: 1 }, 1, ['cubes', 0xeaf6ff, 0xa8d8ff]],
      ['syrup', 'Cane Syrup', 7, 300, { cane: 2 }, 1, ['flask', 0x8ee9ff, 0x2f8fd8]],
      ['candy', 'Zap Candy', 9, 480, { berry: 1, sugar: 1 }, 1, ['candy', 0xb07bff, 0xfff0ff]],
    ] },
    { id: 'snack', name: 'Snack Printer', lvl: 8, cost: 320, blurb: 'Prints crunchy snacks layer by layer.', recipes: [
      ['popcorn', 'Pop-Nova', 8, 180, { corn: 2 }, 1, ['tub', 0xfff4c0, 0xff7a6b]],
      ['chips', 'Ember Crisps', 12, 480, { root: 2, butter: 1 }, 1, ['tub', 0xff9d3d, 0x4b3f8f]],
      ['chilipop', 'Frost Pop-Nova', 15, 600, { corn: 2, chili: 1 }, 1, ['tub', 0xbff0ff, 0x2f8fd8]],
    ] },
    { id: 'grill', name: 'Galley Grill', lvl: 11, cost: 500, blurb: 'Hot plates from the old flagship.', recipes: [
      ['tbites', 'Truffle Bites', 11, 360, { truffle: 1, butter: 1 }, 1, ['skewer', 0x8d5fc9, 0xffe58a]],
      ['burger', 'Fizzburger', 12, 600, { bean: 3, bread: 1, cheese: 1 }, 1, ['burger', 0xe8a060, 0xff9bd2]],
      ['roast', 'Starkin Roast', 13, 720, { gourd: 1, root: 1, butter: 1 }, 1, ['plated', 0xffa24d, 0xff6a3d]],
    ] },
    { id: 'pie', name: 'Pie Reactor', lvl: 13, cost: 700, blurb: 'Fusion-baked crusts, perfectly golden.', recipes: [
      ['gpie', 'Starkin Pie', 13, 720, { gourd: 2, egg: 1, wheat: 2 }, 1, ['pie', 0xffa24d, 0xe8b070]],
      ['bpie', 'Zapberry Pie', 14, 900, { berry: 3, egg: 1, wheat: 2 }, 1, ['pie', 0x9d7bff, 0xe8b070]],
      ['apie', 'Star Apple Pie', 15, 1200, { fapple: 2, sugar: 1, egg: 1 }, 1, ['pie', 0xffe05c, 0xe8b070]],
    ] },
    { id: 'loom', name: 'Nebula Loom', lvl: 12, cost: 800, blurb: 'Weaves fluff into fine cloth.', recipes: [
      ['cloth', 'Puff Cloth', 12, 480, { cotton: 2 }, 1, ['bolt_cloth', 0xffc9e8, 0xfff4fb]],
      ['wcloth', 'Cloud Cloth', 12, 720, { wool: 2 }, 1, ['bolt_cloth', 0xb5c8ff, 0xf3f6ff]],
      ['scloth', 'Jelly Silk Cloth', 24, 1500, { silk: 2 }, 1, ['bolt_cloth', 0x8fe8ff, 0xe8fbff]],
    ] },
    { id: 'smelter', name: 'Ion Smelter', lvl: 14, cost: 1000, blurb: 'Melts raw ore down into bars.', recipes: [
      ['fbar', 'Ferrite Bar', 14, 480, { ferrite: 3 }, 1, ['ingot', 0xaab4d8, 0xe0e6ff]],
      ['lbar', 'Lumite Bar', 15, 900, { lumite: 3 }, 1, ['ingot', 0x46d6c0, 0xbffff4]],
      ['vbar', 'Voidium Bar', 20, 1800, { voidium: 3 }, 1, ['ingot', 0x7a4fe0, 0xff9be8]],
    ] },
    { id: 'stitch', name: 'Suit Stitcher', lvl: 16, cost: 1200, blurb: 'Colonists never stop tearing their suits.', recipes: [
      ['scarf', 'Flight Scarf', 16, 900, { wcloth: 1, cloth: 1 }, 1, ['scarf', 0xff7a6b, 0xffd0a8]],
      ['beanie', 'Cosmo Beanie', 17, 1200, { wcloth: 2 }, 1, ['beanie', 0x6ff5c8, 0xfff4d6]],
      ['suit', 'Explorer Suit', 19, 2400, { cloth: 2, wcloth: 2, fbar: 1 }, 1, ['suit', 0xf3eeff, 0xff7a6b]],
    ] },
    { id: 'galley', name: 'Deep Galley', lvl: 18, cost: 1400, blurb: 'Serves the catch of the Star Sea.', recipes: [
      ['fishroll', 'Star Rolls', 18, 600, { trout: 2, wheat: 2 }, 1, ['rolls', 0xf4f0ff, 0x7f8cff]],
      ['chowder', 'Void Chowder', 19, 900, { lumafish: 2, root: 1, cream: 1 }, 1, ['bowl', 0xffe0b0, 0x4b3f8f]],
      ['kebab', 'Comet Kebab', 20, 1200, { eel: 1, chili: 1 }, 1, ['skewer', 0xff8f5c, 0x78e0ff]],
    ] },
    { id: 'cake', name: 'Cake Lab', lvl: 19, cost: 1700, blurb: 'Three-tier science.', recipes: [
      ['starcake', 'Starcake', 19, 1500, { egg: 3, cream: 2, sugar: 1, wheat: 2 }, 1, ['cake', 0xffd0e8, 0xffe05c]],
      ['chococake', 'Cocoa Comet Cake', 21, 2100, { cocoa: 2, egg: 3, cream: 2 }, 1, ['cake', 0x9c5a33, 0xfff0d6]],
    ] },
    { id: 'juice', name: 'Juice Bar', lvl: 21, cost: 2000, blurb: 'Fresh-pressed in low gravity.', recipes: [
      ['ajuice', 'Apple Fizz', 21, 720, { fapple: 3 }, 1, ['cup', 0xffe05c, 0xff7a6b]],
      ['mjuice', 'Melon Blast', 22, 1080, { melon: 2, sugar: 1 }, 1, ['cup', 0xff5fa8, 0x6ff5c8]],
      ['pjuice', 'Plum Nectar', 23, 1500, { plum: 3, honey: 1 }, 1, ['cup', 0x8a5cff, 0xffe05c]],
    ] },
    { id: 'cryo', name: 'Cryo Creamery', lvl: 23, cost: 2400, blurb: 'Colder than the dark side of a moon.', recipes: [
      ['icecream', 'Cryo Cream', 23, 900, { cream: 2, sugar: 1 }, 1, ['icecream', 0xbff0ff, 0xffd0e8]],
      ['sundae', 'Frost Sundae', 24, 1500, { cream: 2, chili: 1, candy: 1 }, 1, ['icecream', 0x78e0ff, 0xb07bff]],
    ] },
    { id: 'gems', name: 'Gem Workshop', lvl: 25, cost: 3000, blurb: 'Rare stones set in fine metal.', recipes: [
      ['ring', 'Star Ring', 25, 1800, { fbar: 1, ruby: 1 }, 1, ['ring', 0xffd24d, 0xff4d6d]],
      ['amulet', 'Moon Amulet', 26, 2700, { lbar: 1, opal: 1 }, 1, ['amulet', 0x46d6c0, 0x8ee9ff]],
      ['crown', 'Void Crown', 28, 3600, { vbar: 2, diamond: 1 }, 1, ['crown', 0x7a4fe0, 0xf4f0ff]],
    ] },
    { id: 'lantern', name: 'Lantern Works', lvl: 27, cost: 3600, blurb: 'Keeps the long nights cozy.', recipes: [
      ['hlantern', 'Honey Lantern', 27, 1800, { honey: 2, lbar: 1 }, 1, ['lantern', 0xffc94d, 0x46d6c0]],
      ['dlamp', 'Dream Lamp', 28, 2400, { shroom: 2, honey: 2 }, 1, ['lantern', 0xc77bff, 0xffe05c]],
    ] },
  ];

  OA.FACTORIES = {};
  OA.RECIPES = {};
  FACTORY_ROWS.forEach((f) => {
    OA.FACTORIES[f.id] = { id: f.id, name: f.name, lvl: f.lvl, cost: f.cost, blurb: f.blurb, recipes: f.recipes.map((r) => r[0]) };
    f.recipes.forEach(([id, name, lvl, time, inputs, out, art]) => {
      OA.RECIPES[id] = { id, name, lvl, time, inputs, out, factory: f.id };
      add(id, name, id.startsWith('feed') ? 'feed' : 'good', lvl, art, { recipe: id });
    });
  });

  // ---- Fair prices are worked out from what goes into each item. ----
  const valueOf = (id) => {
    const it = I[id];
    if (it.value) return it.value;
    if (it.kind === 'animal') {
      const c = OA.CRITTERS.find((k) => k.product === id);
      it.value = Math.round(valueOf(c.feed) * 1.2 + (c.time / 60) * 2);
      return it.value;
    }
    const r = OA.RECIPES[it.recipe];
    let cost = 0;
    for (const k in r.inputs) cost += valueOf(k) * r.inputs[k];
    it.value = Math.max(1, Math.round((cost * 1.15 + (r.time / 60) * 2.2) / r.out));
    return it.value;
  };
  Object.keys(I).forEach(valueOf);
  Object.values(I).forEach((it) => { it.xp = Math.max(1, Math.round(it.value / 7)); });

  // ---- Storage. ----
  OA.STORE = {
    silo: { name: 'Seed Vault', holds: ['crop'], start: 80, step: 30, parts: ['bolt', 'plate', 'seal'] },
    bay: { name: 'Cargo Bay', holds: ['animal', 'feed', 'good', 'fish', 'ore', 'part', 'tool'], start: 70, step: 30, parts: ['bolt', 'plate', 'seal'] },
  };
  OA.storeOf = (id) => (I[id].kind === 'crop' ? 'silo' : 'bay');

  // ---- Everything that can stand on the map. w/d are tiles. ----
  OA.BUILD = {
    field: { name: 'Crop Plot', w: 2, d: 2, h: 0.8 },
    silo: { name: 'Seed Vault', w: 4, d: 4, h: 6, fixed: true },
    bay: { name: 'Cargo Bay', w: 5, d: 4, h: 4, fixed: true },
    board: { name: 'Delivery Board', w: 3, d: 2, h: 3.4, fixed: true },
    pad: { name: 'Shuttle Pad', w: 5, d: 5, h: 1.8, fixed: true },
    post: { name: 'Trading Post', w: 4, d: 3, h: 3.4, lvl: 3, fixed: true },
    gazette: { name: 'Colony Gazette', w: 2, d: 2, h: 2.6, lvl: 5, fixed: true },
    pen: { name: 'Critter Pen', w: 7, d: 6, h: 1.4 },
    factory: { name: 'Factory', w: 5, d: 5, h: 4.4 },
    tree: { name: 'Orchard Tree', w: 2, d: 2, h: 3.4 },
    decor: { name: 'Decoration', w: 1, d: 1, h: 1 },
  };

  // Fixed sites out past the colony fence. Reached by the roads.
  OA.SITES = {
    rocket: { name: 'Rocket Pad', lvl: 10, x: 0, z: -37, r: 6 },
    town: { name: 'Starport Town', lvl: 12, x: 38, z: -6, r: 11 },
    mine: { name: 'Hollow Mine', lvl: 9, x: -36, z: 9, r: 5 },
    dock: { name: 'Star Sea Dock', lvl: 7, x: 7, z: 37, r: 5 },
  };

  OA.SECTOR = 8;
  OA.SECTOR_MAX = 3; // sectors run -3..3 on both axes
  OA.LAND_EDGE = (OA.SECTOR_MAX + 0.5) * OA.SECTOR;

  // ---- Decorations. Charm brings customers in faster. ----
  OA.DECOR = [
    { id: 'hexpath', name: 'Hex Paving', lvl: 2, cost: 4, charm: 0, w: 1, d: 1 },
    { id: 'fence', name: 'Light Fence', lvl: 2, cost: 8, charm: 1, w: 1, d: 1 },
    { id: 'lamp', name: 'Orb Lamp', lvl: 3, cost: 20, charm: 2, w: 1, d: 1 },
    { id: 'pot', name: 'Fuzzy Planter', lvl: 3, cost: 15, charm: 2, w: 1, d: 1 },
    { id: 'bench', name: 'Star Bench', lvl: 5, cost: 40, charm: 3, w: 2, d: 1 },
    { id: 'mail', name: 'Comet Mailbox', lvl: 6, cost: 45, charm: 3, w: 1, d: 1 },
    { id: 'crystal', name: 'Pink Crystal', lvl: 7, cost: 70, charm: 5, w: 1, d: 1 },
    { id: 'dish', name: 'Radio Dish', lvl: 9, cost: 120, charm: 6, w: 2, d: 2 },
    { id: 'solar', name: 'Solar Twirler', lvl: 10, cost: 150, charm: 7, w: 1, d: 1 },
    { id: 'scope', name: 'Backyard Telescope', lvl: 12, cost: 220, charm: 9, w: 2, d: 2 },
    { id: 'gnome', name: 'Garden Alien', lvl: 13, cost: 90, charm: 6, w: 1, d: 1 },
    { id: 'fountain', name: 'Holo Fountain', lvl: 15, cost: 400, charm: 14, w: 3, d: 3 },
    { id: 'swing', name: 'Low-G Swing', lvl: 18, cost: 500, charm: 16, w: 2, d: 2 },
    { id: 'rivet', name: 'Statue of Rivet', lvl: 20, cost: 900, charm: 24, w: 2, d: 2 },
    { id: 'orrery', name: 'Giant Orrery', lvl: 25, cost: 1800, charm: 40, w: 3, d: 3 },
  ];
  OA.DECOR.forEach((d) => { d.h = d.w > 1 ? 2 : 1.4; });

  // ---- Starport Town. Each lot is fixed up with goods and parts. ----
  OA.TOWN_LOTS = [
    { id: 'diner', name: 'Comet Diner', lvl: 12, need: { bolt: 2, plate: 2, bread: 8, egg: 10 }, cost: 300, cap: 1, tip: 0.1, blurb: 'Brings hungry travelers to town.' },
    { id: 'inn', name: 'Airlock Inn', lvl: 14, need: { bolt: 3, seal: 3, cloth: 6, cheese: 6 }, cost: 700, cap: 1, tip: 0.1, blurb: 'Guests stay longer and pay more.' },
    { id: 'cinema', name: 'Holo Cinema', lvl: 17, need: { plate: 4, seal: 4, popcorn: 12, syrup: 8 }, cost: 1200, cap: 1, tip: 0.15, blurb: 'Pulls in the evening crowd.' },
    { id: 'spa', name: 'Zero-G Spa', lvl: 20, need: { bolt: 5, plate: 5, cream: 12, wcloth: 6 }, cost: 2000, cap: 1, tip: 0.15, blurb: 'Rich visitors love floating.' },
    { id: 'observatory', name: 'Observatory', lvl: 24, need: { bolt: 6, seal: 6, lbar: 4, fbar: 6 }, cost: 3200, cap: 1, tip: 0.2, blurb: 'Astronomers tip in Stardust.' },
    { id: 'plaza', name: 'Star Plaza', lvl: 28, need: { plate: 8, seal: 8, starcake: 4, ring: 1 }, cost: 5000, cap: 2, tip: 0.25, blurb: 'The heart of the whole planet.' },
  ];

  // ---- People and aliens of the colony. ----
  OA.FOLK = [
    { id: 'juno', name: 'Captain Juno', body: 'human', skin: 0xc98a5c, top: 0xff7a6b, hair: 0x3a2352 },
    { id: 'zib', name: 'Zib', body: 'blob', skin: 0x7cf7c0, top: 0x35b98c, hair: 0xfff4a8 },
    { id: 'quasar', name: 'Doc Quasar', body: 'human', skin: 0xf0c8a8, top: 0xf3eeff, hair: 0xd6dcff },
    { id: 'cosmo', name: 'Old Cosmo', body: 'human', skin: 0x8d5a3c, top: 0x6c8cff, hair: 0xf3f3f3 },
    { id: 'lumi', name: 'Lumi', body: 'tall', skin: 0xff9bd2, top: 0xc77bff, hair: 0xfff0a8 },
    { id: 'grub', name: 'Grub', body: 'blob', skin: 0xffb03d, top: 0xd9682a, hair: 0x7cf7c0 },
    { id: 'tess', name: 'Tess', body: 'human', skin: 0xe8b890, top: 0x46d6c0, hair: 0xff6a3d },
    { id: 'pollux', name: 'Pollux', body: 'tall', skin: 0x8ee9ff, top: 0x3f6fd6, hair: 0xff78d8 },
    { id: 'nana', name: 'Nana Nebula', body: 'blob', skin: 0xc9a8ff, top: 0x8f6bff, hair: 0xffffff },
    { id: 'sol', name: 'Chef Sol', body: 'human', skin: 0xa86a44, top: 0xffd24d, hair: 0x201030 },
    { id: 'vex', name: 'Vex', body: 'tall', skin: 0xb6f56f, top: 0x4b8f3f, hair: 0xff5f7e },
    { id: 'mox', name: 'Mox', body: 'bot', skin: 0xd6dcff, top: 0xff9d3d, hair: 0x6ff5c8 },
  ];

  // ---- Mission log. ----
  OA.GOALS = [
    { id: 'firstorder', name: 'First Delivery', text: 'Ship 1 order', stat: 'orders', goal: 1, dust: 2 },
    { id: 'orders25', name: 'Regular Route', text: 'Ship 25 orders', stat: 'orders', goal: 25, dust: 4 },
    { id: 'orders100', name: 'Freight Baron', text: 'Ship 100 orders', stat: 'orders', goal: 100, dust: 8 },
    { id: 'harvest100', name: 'Green Thumb', text: 'Harvest 100 plots', stat: 'harvests', goal: 100, dust: 3 },
    { id: 'harvest500', name: 'Crop Commander', text: 'Harvest 500 plots', stat: 'harvests', goal: 500, dust: 8 },
    { id: 'feed50', name: 'Critter Keeper', text: 'Feed critters 50 times', stat: 'feeds', goal: 50, dust: 3 },
    { id: 'goods100', name: 'Production Line', text: 'Collect 100 factory goods', stat: 'goods', goal: 100, dust: 4 },
    { id: 'shop25', name: 'Open for Business', text: 'Sell 25 stacks at the Trading Post', stat: 'sales', goal: 25, dust: 4 },
    { id: 'fish10', name: 'Star Angler', text: 'Catch 10 fish', stat: 'fish', goal: 10, dust: 3 },
    { id: 'mine30', name: 'Deep Digger', text: 'Dig 30 mine tiles', stat: 'digs', goal: 30, dust: 3 },
    { id: 'land5', name: 'Land Rush', text: 'Claim 5 new sectors', stat: 'sectors', goal: 5, dust: 5 },
    { id: 'charm50', name: 'Prettiest Colony', text: 'Reach 50 charm', stat: 'charm', goal: 50, dust: 5 },
    { id: 'visitors10', name: 'Warm Welcome', text: 'Serve 10 town visitors', stat: 'visitors', goal: 10, dust: 4 },
    { id: 'rockets3', name: 'Launch Crew', text: 'Fill 3 Supply Rockets', stat: 'rockets', goal: 3, dust: 6 },
    { id: 'rich', name: 'Star Banker', text: 'Earn 25,000 credits', stat: 'earned', goal: 25000, dust: 6 },
  ];

  // Level curve and unlock list. The first few levels come quickly.
  OA.xpNeed = (lvl) => Math.round(10 + 6 * lvl + 4 * Math.pow(lvl, 2.25));
  OA.unlocksAt = (lvl) => {
    const out = [];
    OA.CROPS.forEach((c) => { if (c.lvl === lvl) out.push({ item: c.id, label: c.name }); });
    OA.TREES.forEach((t) => { if (t.lvl === lvl) out.push({ item: t.fruit, label: t.name }); });
    OA.CRITTERS.forEach((c) => { if (c.lvl === lvl) out.push({ critter: c.id, label: c.name }); });
    Object.values(OA.FACTORIES).forEach((f) => { if (f.lvl === lvl) out.push({ factory: f.id, label: f.name }); });
    Object.values(OA.RECIPES).forEach((r) => { if (r.lvl === lvl && OA.FACTORIES[r.factory].lvl !== lvl) out.push({ item: r.id, label: r.name }); });
    Object.entries(OA.SITES).forEach(([id, s]) => { if (s.lvl === lvl) out.push({ site: id, label: s.name }); });
    if (lvl === OA.BUILD.post.lvl) out.push({ site: 'post', label: 'Trading Post' });
    if (lvl === OA.BUILD.gazette.lvl) out.push({ site: 'gazette', label: 'Colony Gazette' });
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
