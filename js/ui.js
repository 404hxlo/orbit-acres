// Orbit Acres: the heads-up display, the seed tray, and what happens on a tap.
(function (root) {
  const OA = root.OA;
  const Sim = OA.Sim;
  const I = OA.ITEMS;
  const Au = OA.Audio;
  const UI = (OA.UI = { tool: null, panels: {} });
  const $ = (s, r) => (r || document).querySelector(s);
  const make = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
  UI.$ = $; UI.make = make;
  const icon = (key, size, extra) => OA.Icons.html(key, size, extra);
  const item = (id, size) => OA.Icons.item(id, size);
  UI.calm = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let ui, fx, toastBox;

  // ---- Heads-up display ----
  const buildHud = () => {
    ui = $('#ui');
    ui.innerHTML = `
      <div id="top">
        <button id="lvl" class="lvl" aria-label="Open mission log">
          <span class="lvl-ring" id="lvlRing"><b id="lvlN">1</b></span>
        </button>
        <button id="cname" class="cname" aria-label="Open mission log"><span id="cnameText"></span><small id="xpText"></small></button>
        <span class="grow"></span>
        <button class="money gold" id="credits" aria-label="Credits">${icon('coin', 26)}<b id="creditN">0</b></button>
        <button class="money blue" id="dust" aria-label="Stardust">${icon('stardust', 26)}<b id="dustN">0</b></button>
        <button class="round" id="gear" aria-label="Settings"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.6 5.3-1.8-.6a7 7 0 0 0 0-2.4l1.8-.6a1 1 0 0 0 .5-1.4l-1-1.8a1 1 0 0 0-1.3-.4l-1.8.9a7 7 0 0 0-2-1.2L14.700 4a1 1 0 0 0-1-.8h-2a1 1 0 0 0-1 .8l-.4 1.8a7 7 0 0 0-2 1.200l-1.800-.9a1 1 0 0 0-1.300.4l-1 1.800a1 1 0 0 0 .5 1.400l1.800.6a7 7 0 0 0 0 2.400l-1.800.6a1 1 0 0 0-.5 1.400l1 1.800a1 1 0 0 0 1.300.4l1.800-.9a7 7 0 0 0 2 1.200l.4 1.800a1 1 0 0 0 1 .8h2a1 1 0 0 0 1-.8l.4-1.800a7 7 0 0 0 2-1.200l1.800.9a1 1 0 0 0 1.300-.4l1-1.800a1 1 0 0 0-.5-1.400Z"/></svg></button>
      </div>
      <div id="dock">
        <button class="dockbtn" data-open="build">${icon('factory:bakery', 40)}<span>Build</span></button>
        <button class="dockbtn" data-open="orders">${icon('board', 40)}<span>Orders</span><em id="orderBadge" hidden></em></button>
        <button class="dockbtn" id="storeBtn" data-open="storage">${icon('silo', 40)}<span>Storage</span></button>
        <button class="dockbtn" data-open="log">${icon('xpstar', 40)}<span>Missions</span><em id="logBadge" hidden></em></button>
        <button class="dockbtn" id="planetBtn"><i class="planet-ic"></i><span>Planet</span></button>
      </div>
      <button id="harvestAll" hidden>${icon('harvester', 34)}<span>Harvest <b id="harvestN">0</b></span></button>
      <div id="tray" hidden></div>
      <div id="placebar" hidden></div>
      <div id="toasts" role="status" aria-live="polite"></div>
      <div id="labels"></div>
      <div id="tip" hidden></div>
      <div id="sheetRoot"></div>
      <div id="overlay"></div>
      <div id="fx"></div>`;
    fx = $('#fx');
    toastBox = $('#toasts');
    ui.addEventListener('click', (e) => {
      Au.unlock();
      const b = e.target.closest('[data-open]');
      if (b) { Au.play('open'); UI.open(b.dataset.open); }
    });
    $('#lvl').onclick = $('#cname').onclick = () => { Au.play('open'); UI.open('log'); };
    $('#gear').onclick = () => { Au.play('open'); UI.open('settings'); };
    $('#credits').onclick = () => UI.toast('Credits come from orders, the Trading Post, and town visitors.');
    $('#dust').onclick = () => UI.toast('Stardust comes from leveling up, missions and supply crates.');
    $('#planetBtn').onclick = UI.togglePlanet;
    $('#harvestAll').onclick = harvestAll;
  };

  UI.togglePlanet = () => {
    Au.play('whoosh');
    const W = OA.World;
    if (W.cam.td > 90) W.flyTo(-1, 0, W.DIST.home, 1.1);
    else W.flyTo(W.cam.fx, W.cam.fz, 150, 1.1);
  };

  const updateHud = () => {
    const S = Sim.state();
    const need = OA.xpNeed(S.level);
    $('#lvlN').textContent = S.level;
    $('#lvlRing').style.setProperty('--p', (S.xp / need) * 100 + '%');
    $('#cnameText').textContent = S.name;
    $('#xpText').textContent = OA.fmt(S.xp) + ' / ' + OA.fmt(need) + ' XP';
    $('#creditN').textContent = OA.fmt(S.credits);
    $('#dustN').textContent = OA.fmt(S.dust);
    const ready = S.orders.filter((o) => Sim.orderReady(o)).length;
    const ob = $('#orderBadge');
    ob.hidden = !ready; ob.textContent = ready;
    const lb = $('#logBadge');
    const lc = Sim.goalsReady() + (Sim.dailyReady() ? 1 : 0);
    lb.hidden = !lc; lb.textContent = lc;
    const ripe = Sim.objs('field').filter(Sim.fieldReady).length;
    const ha = $('#harvestAll');
    ha.hidden = ripe < 2 || !!UI.placing;
    $('#harvestN').textContent = ripe;
    const near = Sim.used('silo') >= Sim.capacity('silo') * 0.92 || Sim.used('bay') >= Sim.capacity('bay') * 0.92;
    $('#storeBtn').classList.toggle('warn', near);
  };
  UI.update = updateHud;

  const harvestAll = () => {
    Au.unlock();
    const list = Sim.objs('field').filter(Sim.fieldReady);
    let delay = 0;
    let stopped = false;
    list.forEach((f) => {
      setTimeout(() => {
        if (stopped) return;
        const r = Sim.harvest(f.id);
        if (!r.ok) { stopped = true; UI.fail(r); }
        updateHud();
      }, delay);
      delay += 55;
    });
  };

  // ---- Messages ----
  UI.toast = (text, kind) => {
    const el = make('<div class="toast ' + (kind || '') + '"></div>');
    el.textContent = text;
    toastBox.appendChild(el);
    while (toastBox.children.length > 3) toastBox.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2600);
  };
  UI.fail = (r) => {
    Au.play('bad');
    UI.toast(r.why, 'bad');
    if (r.full) { /* the storage button already glows */ }
  };

  // ---- Flying stickers and floating numbers ----
  const pulse = (el) => { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); };
  UI.fly = (key, x, y, target, delay = 0) => {
    if (!target) return;
    if (UI.calm) { pulse(target); return; }
    const size = 38;
    const el = make(icon(key, size, 'flyer'));
    fx.appendChild(el);
    const r = target.getBoundingClientRect();
    const tx = r.left + r.width / 2 - size / 2, ty = r.top + r.height / 2 - size / 2;
    const sx = x - size / 2 + OA.rand(-12, 12), sy = y - size / 2 + OA.rand(-8, 8);
    const a = el.animate([
      { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.5)', opacity: 0 },
      { transform: 'translate(' + sx + 'px,' + (sy - 34) + 'px) scale(1.2)', opacity: 1, offset: 0.26 },
      { transform: 'translate(' + (sx + (tx - sx) * 0.15) + 'px,' + (sy - 28) + 'px) scale(1.05)', opacity: 1, offset: 0.42 },
      { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(.62)', opacity: 0.9 },
    ], { duration: 780, delay, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' });
    a.onfinish = () => { el.remove(); pulse(target); };
  };
  UI.float = (x, y, text, cls) => {
    const el = make('<span class="floaty ' + (cls || '') + '"></span>');
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    fx.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  };
  const at = (id) => {
    const t = OA.World.thing(id);
    return t ? OA.World.project(t.cx, 1, t.cz) : { x: innerWidth / 2, y: innerHeight / 2 };
  };

  // ---- Small tooltip above something in the world ----
  let tipFor = null, tipUntil = 0;
  UI.tip = (x, y, z, html) => {
    const el = $('#tip');
    el.innerHTML = html;
    el.hidden = false;
    tipFor = { x, y, z };
    tipUntil = performance.now() + 2600;
    positionTip();
  };
  const positionTip = () => {
    if (!tipFor) return;
    const el = $('#tip');
    const p = OA.World.project(tipFor.x, tipFor.y, tipFor.z);
    el.style.transform = 'translate(' + Math.round(OA.clamp(p.x, 90, innerWidth - 90)) + 'px,' + Math.round(Math.max(90, p.y)) + 'px) translate(-50%,-100%)';
  };
  const hideTip = () => { tipFor = null; $('#tip').hidden = true; };

  // ---- Labels for places on the planet ----
  let labels = [];
  const buildLabels = () => {
    const box = $('#labels');
    labels = Object.keys(OA.SITES).map((id) => {
      const s = OA.SITES[id];
      const el = make('<button class="site-label"><span></span></button>');
      el.firstChild.textContent = s.name;
      el.onclick = () => { Au.unlock(); Au.play('tap'); UI.goSite(id); };
      box.appendChild(el);
      return { id, el, s };
    });
    const home = make('<button class="site-label home"><span>Colony</span></button>');
    home.onclick = () => { OA.World.flyTo(-1, 0, OA.World.DIST.home, 1.1); };
    box.appendChild(home);
    labels.push({ id: 'home', el: home, s: { x: 0, z: 2 } });
  };
  UI.goSite = (id) => {
    const s = OA.SITES[id];
    const W = OA.World;
    const off = id === 'town' ? 40 : 34;
    const near = Math.hypot(W.cam.fx - s.x, W.cam.fz - s.z) < 7 && W.cam.d < 60;
    if (near) { UI.openSite(id); return; }
    W.flyTo(s.x, s.z, off, 1.1);
    setTimeout(() => { if (Sim.state().level >= s.lvl) UI.openSite(id); else UI.toast(s.name + ' opens at level ' + s.lvl + '.'); }, 1250);
  };
  const updateLabels = () => {
    const W = OA.World;
    const show = W.cam.d > 70;
    const S = Sim.state();
    labels.forEach((l) => {
      const p = W.project(l.s.x, 2, l.s.z);
      const on = show && p.ang < 1.5;
      l.el.style.display = on ? 'block' : 'none';
      if (on) {
        l.el.style.transform = 'translate(' + Math.round(p.x) + 'px,' + Math.round(p.y) + 'px) translate(-50%,-120%)';
        l.el.classList.toggle('locked', l.s.lvl > S.level);
      }
    });
  };

  // ---- Seed tray ----
  UI.lastCrop = 'wheat';
  UI.openSeeds = (fieldId) => {
    const S = Sim.state();
    const tray = $('#tray');
    const crops = OA.CROPS.filter((c) => c.lvl <= S.level);
    const next = OA.CROPS.find((c) => c.lvl > S.level);
    tray.innerHTML =
      '<div class="tray-scroll">' +
      crops.map((c) => `
        <button class="seed" data-crop="${c.id}" aria-label="${c.name}">
          ${item(c.id, 46)}
          <b class="seed-n">${Sim.have(c.id)}</b>
          <small>${OA.fmtTime(c.time * 1000)}</small>
        </button>`).join('') +
      (next ? `<div class="seed lockd">${item(next.id, 46)}<small>Level ${next.lvl}</small></div>` : '') +
      '</div><div class="tray-side"><button id="fillAll" class="btn mini" hidden>Plant all</button><button id="trayClose" class="round small" aria-label="Close seed tray">&times;</button></div>';
    tray.hidden = false;
    UI.pendingField = fieldId;
    tray.querySelectorAll('[data-crop]').forEach((b) => {
      b.addEventListener('pointerdown', (e) => OA.Input.trayDown(b.dataset.crop, e));
      b.onclick = () => UI.pickSeed(b.dataset.crop);
    });
    $('#trayClose').onclick = UI.closeTray;
    $('#fillAll').onclick = plantAll;
    OA.emit('trayOpened', {});
  };
  UI.pickSeed = (crop) => {
    Au.unlock();
    UI.tool = { type: 'seed', crop };
    UI.lastCrop = crop;
    const tray = $('#tray');
    tray.querySelectorAll('.seed').forEach((b) => b.classList.toggle('on', b.dataset.crop === crop));
    const empties = Sim.objs('field').filter((f) => !f.crop).length;
    $('#fillAll').hidden = empties < 2;
    if (UI.pendingField) {
      const id = UI.pendingField;
      UI.pendingField = null;
      UI.plant(id);
    }
  };
  UI.refreshSeeds = () => {
    const tray = $('#tray');
    if (tray.hidden) return;
    tray.querySelectorAll('[data-crop]').forEach((b) => { b.querySelector('.seed-n').textContent = Sim.have(b.dataset.crop); });
    const f = $('#fillAll');
    if (f && UI.tool) f.hidden = Sim.objs('field').filter((k) => !k.crop).length < 2;
  };
  UI.plant = (id) => {
    if (!UI.tool) return false;
    const r = Sim.plant(id, UI.tool.crop);
    if (!r.ok) {
      if (r.seed) UI.toast('Out of ' + I[r.seed].name + ' seed. Harvest more, or earn credits to buy some.', 'bad');
      return false;
    }
    Au.play('plant');
    UI.refreshSeeds();
    updateHud();
    return true;
  };
  const plantAll = () => {
    const list = Sim.objs('field').filter((f) => !f.crop);
    let n = 0;
    list.forEach((f) => { if (UI.plant(f.id)) n++; });
    if (n) UI.closeTray();
  };
  UI.closeTray = () => {
    $('#tray').hidden = true;
    UI.tool = null;
    UI.pendingField = null;
  };

  // ---- What a tap on the world does ----
  UI.tap = (hit) => {
    Au.unlock();
    hideTip();
    if (UI.placing) return;
    if (hit.obj) { tapObject(hit.obj); return; }
    UI.closeTray();
    if (hit.rock) { UI.open('rock', { id: hit.rock.id }); return; }
    if (hit.meteor) { UI.result(Sim.openMeteor(hit.meteor.id)); return; }
    if (hit.claim) { UI.open('claim', { sx: hit.claim.sx, sz: hit.claim.sz }); return; }
    if (hit.site) {
      const s = OA.SITES[hit.site];
      if (Sim.state().level >= s.lvl) UI.openSite(hit.site);
      else UI.toast(s.name + ' opens at level ' + s.lvl + '.');
    }
  };

  const tapObject = (o) => {
    const now = OA.now();
    const t = OA.World.thing(o.id);
    switch (o.type) {
      case 'field': {
        if (Sim.fieldReady(o)) { UI.closeTray(); const r = Sim.harvest(o.id); if (!r.ok) UI.fail(r); }
        else if (!o.crop) {
          if (UI.tool && UI.tool.type === 'seed') UI.plant(o.id);
          else UI.openSeeds(o.id);
        } else {
          UI.closeTray();
          UI.tip(t.cx, 1.4, t.cz, '<b>' + I[o.crop].name + '</b><span>' + OA.fmtTime(o.readyAt - now) + ' left</span>');
        }
        break;
      }
      case 'tree': {
        UI.closeTray();
        const r = Sim.pickTree(o.id);
        if (!r.ok) {
          const def = OA.TREES.find((k) => k.id === o.kind);
          if (r.spent) UI.open('tree', { id: o.id });
          else UI.tip(t.cx, 4, t.cz, '<b>' + def.name + '</b><span>Fruit in ' + OA.fmtTime(o.readyAt - now) + ' · ' + o.picks + ' picks left</span>');
        }
        break;
      }
      case 'pen': {
        UI.closeTray();
        const info = Sim.penInfo(o);
        let did = false;
        if (info.ready) { const r = Sim.collectPen(o.id); if (r.ok) did = true; else UI.fail(r); }
        if (info.hungry && !did) {
          const def = OA.CRITTERS.find((k) => k.id === o.kind);
          if (Sim.have(def.feed)) { const r = Sim.feedPen(o.id); if (r.ok) did = true; }
        }
        if (!did) UI.open('pen', { id: o.id });
        break;
      }
      case 'factory':
        UI.closeTray();
        if (o.done.length) {
          const r = Sim.collectGood(o.id);
          if (!r.ok) UI.fail(r);
          else if (!o.done.length) UI.open('factory', { id: o.id });
        } else UI.open('factory', { id: o.id });
        break;
      case 'board': case 'pad': UI.closeTray(); UI.open('orders'); break;
      case 'silo': UI.closeTray(); UI.open('storage', { tab: 'silo' }); break;
      case 'bay': UI.closeTray(); UI.open('storage', { tab: 'bay' }); break;
      case 'post': UI.closeTray(); UI.open('post'); break;
      case 'gazette': UI.closeTray(); UI.open('gazette'); break;
      case 'decor': {
        UI.closeTray();
        const d = OA.DECOR.find((k) => k.id === o.kind);
        UI.tip(t.cx, 1.6, t.cz, '<b>' + d.name + '</b><span>' + (d.charm ? '+' + d.charm + ' charm' : 'Paving') + '</span>');
        break;
      }
      default: break;
    }
    if (t) t.bounce();
    Au.play('tap');
  };

  // Long press picks a building up.
  UI.hold = (hit) => {
    if (hit.obj && !UI.placing) { Au.play('tap'); UI.startMove(hit.obj.id); }
  };

  // ---- Placing and moving ----
  UI.startPlace = (spec, geo, w, d, yaw) => {
    UI.close();
    UI.closeTray();
    const W = OA.World;
    const center = W.tileAt(innerWidth / 2, innerHeight / 2) || { x: 0, z: 0 };
    const spot = Sim.findSpot(w, d, center.x, center.z) || { x: center.x, z: center.z };
    UI.placing = { spec, w, d, x: spot.x, z: spot.z };
    W.ghostShow(geo, w, d, yaw);
    W.ghostMove(spot.x, spot.z, Sim.canPlace(w, d, spot.x, spot.z));
    showPlaceBar();
  };
  UI.startMove = (id) => {
    const o = Sim.obj(id);
    if (!o) return;
    UI.close();
    UI.closeTray();
    const { w, d } = Sim.size(o);
    const W = OA.World;
    UI.placing = { move: id, w, d, x: o.x, z: o.z };
    const t = W.thing(id);
    const geo = t.mesh ? t.mesh.geometry : t.soil ? t.soil.geometry : null;
    W.ghostShow(geo, w, d, t.mesh ? t.mesh.rotation.y : 0);
    W.ghostMove(o.x, o.z, true);
    t.group.visible = false;
    showPlaceBar();
  };
  UI.placeAt = (tile) => {
    const p = UI.placing;
    if (!p) return;
    p.x = tile.x - Math.floor(p.w / 2);
    p.z = tile.z - Math.floor(p.d / 2);
    OA.World.ghostMove(p.x, p.z, Sim.canPlace(p.w, p.d, p.x, p.z, p.move));
  };
  const showPlaceBar = () => {
    const p = UI.placing;
    const bar = $('#placebar');
    const decor = p.move && Sim.obj(p.move).type === 'decor';
    bar.innerHTML = '<span>' + (p.move ? 'Drag to move it, then confirm' : 'Drag to choose a spot, then confirm') + '</span>' +
      '<div class="row">' +
      '<button class="btn" id="placeNo">Cancel</button>' +
      (decor ? '<button class="btn coral" id="placeSell">Sell</button>' : '') +
      '<button class="btn mint" id="placeYes">' + (p.move ? 'Move here' : 'Place here') + '</button></div>';
    bar.hidden = false;
    $('#harvestAll').hidden = true;
    $('#dock').classList.add('dim');
    $('#placeNo').onclick = UI.endPlace;
    $('#placeYes').onclick = confirmPlace;
    if (decor) $('#placeSell').onclick = () => { const id = p.move; endMoveVisual(); const r = Sim.sellDecor(id); UI.placing = null; closeBar(); if (r.ok) UI.toast('Sold for ' + r.refund + ' credits.'); };
  };
  const endMoveVisual = () => {
    const p = UI.placing;
    if (p && p.move) { const t = OA.World.thing(p.move); if (t) t.group.visible = true; }
  };
  const closeBar = () => {
    OA.World.ghostHide();
    $('#placebar').hidden = true;
    $('#dock').classList.remove('dim');
    updateHud();
  };
  UI.endPlace = () => { endMoveVisual(); UI.placing = null; closeBar(); };
  const confirmPlace = () => {
    const p = UI.placing;
    if (!p) return;
    if (p.move) {
      const r = Sim.move(p.move, p.x, p.z);
      if (!r.ok) { UI.fail(r); return; }
      Au.play('build');
      UI.endPlace();
    } else {
      const r = Sim.buy(p.spec, p.x, p.z);
      if (!r.ok) { UI.fail(r); return; }
      Au.play('build');
      const keep = p.spec.type === 'decor' || p.spec.type === 'field';
      const q = keep ? Sim.quote(p.spec) : null;
      if (keep && q.ok && Sim.state().credits >= q.cost) {
        const spot = Sim.findSpot(p.w, p.d, p.x + p.w, p.z);
        if (spot) { p.x = spot.x; p.z = spot.z; OA.World.ghostMove(p.x, p.z, true); updateHud(); return; }
      }
      UI.endPlace();
    }
  };

  // ---- Reactions to the game ----
  const wire = () => {
    const storeBtn = () => $('#storeBtn');
    OA.on('harvested', (e) => {
      const p = at(e.id);
      Au.play('harvest');
      UI.fly('item:' + e.crop, p.x, p.y, storeBtn());
      UI.fly('item:' + e.crop, p.x, p.y, storeBtn(), 90);
      UI.float(p.x, p.y - 26, '+' + I[e.crop].xp + ' XP', 'xp');
      if (e.part) foundPart(e.part, p);
      updateHud();
      UI.refreshSeeds();
    });
    OA.on('picked', (e) => {
      const p = at(e.id);
      Au.play('harvest');
      for (let i = 0; i < e.n; i++) UI.fly('item:' + e.fruit, p.x, p.y - 30, storeBtn(), i * 90);
      updateHud();
    });
    OA.on('fed', (e) => { Au.play('feed'); setTimeout(() => Au.play('critter'), 180); updateHud(); });
    OA.on('collected', (e) => {
      const p = at(e.id);
      Au.play('collect');
      for (let i = 0; i < e.n; i++) UI.fly('item:' + e.item, p.x, p.y, storeBtn(), i * 90);
      UI.float(p.x, p.y - 26, '+' + I[e.item].xp * e.n + ' XP', 'xp');
      if (e.part) foundPart(e.part, p);
      updateHud();
    });
    OA.on('queued', () => { Au.play('machine'); updateHud(); });
    OA.on('goodCollected', (e) => {
      const p = at(e.id);
      Au.play('collect');
      UI.fly('item:' + e.item, p.x, p.y - 30, storeBtn());
      UI.float(p.x, p.y - 50, '+' + I[e.item].xp * e.n + ' XP', 'xp');
      if (e.part) foundPart(e.part, p);
      updateHud();
    });
    OA.on('shipped', (e) => {
      Au.play('whoosh');
      setTimeout(() => Au.play('coin'), 300);
      const cx = innerWidth / 2, cy = innerHeight / 2;
      for (let i = 0; i < Math.min(6, 2 + e.credits / 40); i++) UI.fly('coin', cx, cy, $('#credits'), i * 70);
      UI.float(cx, cy - 40, '+' + OA.fmt(e.credits) + ' credits', 'gold');
      UI.float(cx, cy - 12, '+' + e.xp + ' XP', 'xp');
      if (e.part) foundPart(e.part, { x: cx, y: cy });
      updateHud();
    });
    OA.on('sale', (e) => { Au.play('coin'); UI.toast('Collected ' + OA.fmt(e.credits) + ' credits.', 'good'); updateHud(); });
    OA.on('sold', (e) => { UI.toast('Sold ' + e.s.n + ' ' + I[e.s.item].name + ' at the Trading Post!', 'good'); UI.rerender(); });
    OA.on('goals', updateHud);
    OA.on('goal', () => { Au.play('gem'); updateHud(); });
    OA.on('built', () => { updateHud(); });
    OA.on('level', (e) => UI.levelQueue(e));
    OA.on('meteor', () => UI.toast('A supply crate is falling! Look for it on your land.'));
    OA.on('meteorOpened', (e) => {
      const p = OA.World.project(e.x, 1, e.z);
      Au.play('gem');
      if (e.dust) { UI.fly('stardust', p.x, p.y, $('#dust')); UI.float(p.x, p.y - 30, '+1 Stardust', 'blue'); }
      if (e.credits) { UI.fly('coin', p.x, p.y, $('#credits')); UI.float(p.x, p.y - 30, '+' + e.credits + ' credits', 'gold'); }
      if (e.part) foundPart(e.part, p);
      updateHud();
    });
    OA.on('rocketArrived', () => { UI.toast('The Supply Rocket has landed! Fill its crates before it leaves.', 'good'); Au.play('whoosh'); });
    OA.on('rocketLeft', (e) => {
      Au.play('whoosh');
      if (e.full) UI.toast('Rocket launched! Bonus: ' + OA.fmt(e.reward.credits) + ' credits and ' + e.reward.dust + ' Stardust.', 'good');
      else UI.toast('The Supply Rocket left. Another one is coming.');
      UI.rerender();
    });
    OA.on('crate', (e) => { Au.play('coin'); UI.rerender(); updateHud(); });
    OA.on('visitor', () => UI.toast('A visitor has arrived in Starport Town.'));
    OA.on('served', (e) => { Au.play('coin'); if (e.ranked) UI.toast('Town rank ' + e.rank + '! You earned 3 Stardust.', 'good'); updateHud(); });
    OA.on('goodReady', () => UI.rerender());
    OA.on('newOrder', () => UI.rerender());
  };
  const foundPart = (id, p) => {
    Au.play('gem');
    UI.fly('item:' + id, p.x, p.y - 20, $('#storeBtn'), 180);
    UI.float(p.x, p.y - 64, 'Found: ' + I[id].name, 'mint');
  };
  UI.foundPart = foundPart;

  UI.result = (r) => { if (r && !r.ok) UI.fail(r); updateHud(); return r; };

  // ---- Time-driven refresh (twice a second) ----
  UI.tick = () => {
    updateHud();
    const now = OA.now();
    document.querySelectorAll('[data-end]').forEach((el) => {
      const left = Number(el.dataset.end) - now;
      el.textContent = left > 0 ? OA.fmtTime(left) : el.dataset.doneText || 'Done';
    });
    document.querySelectorAll('[data-from]').forEach((el) => {
      const a = Number(el.dataset.from), b = Number(el.dataset.to);
      el.style.width = OA.clamp(((now - a) / (b - a)) * 100, 0, 100) + '%';
    });
    if (tipFor && performance.now() > tipUntil) hideTip();
    if (OA.Guide) OA.Guide.tick();
  };
  // Runs every frame, for things pinned to the world.
  UI.worldTick = () => {
    if (!ui) return;
    positionTip();
    updateLabels();
    if (OA.Guide) OA.Guide.frame();
  };

  UI.offerCloud = (text) => {
    UI.confirm('Newer colony found', 'A more recent save exists on another device. Load it? This replaces what is on this screen.', 'Load it', () => {
      OA.Store.writeLocal(text);
      root.location.reload();
    });
  };

  UI.init = ({ fresh, away }) => {
    buildHud();
    buildLabels();
    wire();
    updateHud();
    UI.bootPanels();
    if (OA.Input) OA.Input.init();
    if (OA.Guide) OA.Guide.init(fresh);
    if (!fresh) {
      if (away && away.ms > 90000) UI.welcomeBack(away);
      else if (Sim.dailyReady() && Sim.state().tut >= 99) UI.dailyGift();
    }
  };
})(window);
