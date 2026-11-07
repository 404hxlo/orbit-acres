// Orbit Acres: every window in the game.
(function (root) {
  const OA = root.OA;
  const Sim = OA.Sim;
  const I = OA.ITEMS;
  const UI = OA.UI;
  const Au = OA.Audio;
  const Ic = () => OA.Icons;
  const icon = (key, size, extra) => OA.Icons.html(key, size, extra);
  const item = (id, size) => OA.Icons.item(id, size);
  const P = UI.panels;
  const S = () => Sim.state();
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const coin = (n) => '<span class="cost">' + icon('coin', 20) + OA.fmt(n) + '</span>';
  const xp = (n) => '<span class="cost xp">' + icon('xpstar', 20) + OA.fmt(n) + '</span>';
  const dust = (n) => '<span class="cost blue">' + icon('stardust', 20) + n + '</span>';
  const folk = (id) => OA.FOLK.find((f) => f.id === id);
  const need = (id, n) => {
    const have = Sim.have(id);
    return '<span class="need ' + (have >= n ? 'yes' : 'no') + '" title="' + esc(I[id].name) + '">' + item(id, 34) + '<small>' + have + '/' + n + '</small></span>';
  };

  // ---- Window frame ----
  let cur = null;
  UI.open = (name, args = {}) => {
    UI.close(true);
    const p = P[name];
    const wrap = UI.make(`
      <div class="sheet-wrap">
        <div class="scrim"></div>
        <section class="sheet ${p.wide ? 'wide' : ''}" role="dialog" aria-modal="true">
          <header class="sheet-head">
            <h2></h2>
            <button class="round small sheet-x" aria-label="Close">&times;</button>
          </header>
          <div class="sheet-body"></div>
        </section>
      </div>`);
    UI.$('#sheetRoot').appendChild(wrap);
    cur = { name, args, wrap, body: wrap.querySelector('.sheet-body'), p };
    wrap.querySelector('.scrim').onclick = () => { Au.play('close'); UI.close(); };
    wrap.querySelector('.sheet-x').onclick = () => { Au.play('close'); UI.close(); };
    cur.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b || b.disabled) return;
      Au.unlock();
      Au.play('tap');
      p.on(b.dataset.a, b.dataset, cur.args, e);
      if (cur && cur.name === name) UI.rerender(true);
      UI.update();
    });
    UI.rerender(true);
    OA.emit('panelOpened', { name, args });
  };
  UI.close = (quiet) => {
    if (!cur) return;
    const c = cur;
    cur = null;
    if (c.p.onClose) c.p.onClose(c.args);
    c.wrap.classList.add('out');
    setTimeout(() => c.wrap.remove(), quiet ? 0 : 170);
    if (!quiet) OA.emit('panelClosed', { name: c.name });
  };
  UI.rerender = (force) => {
    if (!cur) return;
    const typing = document.activeElement;
    if (force !== true && typing && cur.body.contains(typing) && /^(INPUT|TEXTAREA)$/.test(typing.tagName)) return;
    const top = cur.body.scrollTop;
    const ok = cur.p.render(cur.body, cur.args);
    if (ok === false) { UI.close(); return; }
    const title = typeof cur.p.title === 'function' ? cur.p.title(cur.args) : cur.p.title;
    cur.wrap.querySelector('h2').textContent = title;
    cur.body.scrollTop = top;
  };
  UI.current = () => cur;

  const tabs = (list, on) => '<div class="tabs" role="tablist">' + list.map(([id, label]) => '<button role="tab" class="tab ' + (id === on ? 'on' : '') + '" data-a="tab" data-tab="' + id + '">' + label + '</button>').join('') + '</div>';

  // ---- Build menu ----
  const specCard = (spec, key, name, blurb) => {
    const q = Sim.quote(spec);
    const lock = q.locked;
    return `
      <button class="card buy ${lock ? 'locked' : ''} ${q.owned ? 'owned' : ''}" data-a="buy" data-type="${spec.type}" data-kind="${spec.kind || ''}" ${q.ok ? '' : 'aria-disabled="true"'}>
        ${icon(key, 72)}
        <b>${esc(name)}</b>
        <small>${esc(blurb || '')}</small>
        <span class="foot">${q.ok ? coin(q.cost) : lock ? '<span class="lockt">Level ' + lock + '</span>' : q.owned ? '<span class="oktxt">Built</span>' : '<span class="lockt">Max for now</span>'}</span>
      </button>`;
  };
  P.build = {
    title: 'Build', wide: true,
    render(el, a) {
      const tab = a.tab || 'farm';
      let html = tabs([['farm', 'Crops'], ['critters', 'Critters'], ['factories', 'Factories'], ['decor', 'Decorate']], tab) + '<div class="grid">';
      if (tab === 'farm') {
        html += specCard({ type: 'field' }, 'field', 'Crop Plot', Sim.fieldCount() + ' of ' + Sim.maxFields() + ' plots');
        OA.TREES.forEach((t) => { html += specCard({ type: 'tree', kind: t.id }, 'tree:' + t.id, t.name, t.picks + ' picks, ' + OA.fmtTime(t.time * 1000) + ' apart'); });
      } else if (tab === 'critters') {
        OA.CRITTERS.forEach((c) => {
          const n = Sim.pensOf(c.id).length;
          html += specCard({ type: 'pen', kind: c.id }, 'pen:' + c.id, c.name + ' Pen', n ? n + ' pen' + (n > 1 ? 's' : '') + '. Tap a pen to add ' + c.name + 's.' : c.blurb);
        });
      } else if (tab === 'factories') {
        Object.values(OA.FACTORIES).sort((x, y) => x.lvl - y.lvl).forEach((f) => { html += specCard({ type: 'factory', kind: f.id }, 'factory:' + f.id, f.name, f.blurb); });
      } else {
        html = tabs([['farm', 'Crops'], ['critters', 'Critters'], ['factories', 'Factories'], ['decor', 'Decorate']], tab) +
          '<div class="note"><span>Colony charm: <b>' + Sim.charm() + '</b>. Charm brings customers and visitors in faster.</span><button class="btn mini" data-a="movemode">Move things</button></div><div class="grid">';
        OA.DECOR.forEach((d) => { html += specCard({ type: 'decor', kind: d.id }, 'decor:' + d.id, d.name, d.charm ? '+' + d.charm + ' charm' : 'Paving'); });
      }
      el.innerHTML = html + '</div>';
    },
    on(act, d, a) {
      if (act === 'tab') a.tab = d.tab;
      if (act === 'movemode') { UI.close(); UI.moveMode = true; UI.toast('Tap anything to pick it up and move it.'); }
      if (act === 'buy') {
        const spec = { type: d.type, kind: d.kind || undefined };
        const q = Sim.quote(spec);
        if (!q.ok) { UI.fail(q); return; }
        if (S().credits < q.cost) { UI.fail({ why: 'You need ' + OA.fmt(q.cost) + ' credits.' }); return; }
        const M = OA.Gfx.M;
        const geo = spec.type === 'field' ? M.field() : spec.type === 'pen' ? M.pen(spec.kind) : spec.type === 'factory' ? M.factory(spec.kind) : spec.type === 'tree' ? M.tree(spec.kind, 'leaf') : M.decor(spec.kind);
        UI.startPlace(spec, geo, q.w, q.d);
      }
    },
  };

  // ---- Factory ----
  P.factory = {
    title: (a) => { const f = Sim.obj(a.id); return f ? OA.FACTORIES[f.kind].name : ''; },
    render(el, a) {
      const f = Sim.obj(a.id);
      if (!f) return false;
      const now = OA.now();
      let slots = '';
      f.done.forEach((r, i) => { slots += '<button class="slot done" data-a="collect" data-i="' + i + '" aria-label="Collect ' + esc(I[r].name) + '">' + item(r, 46) + '<small>Collect</small></button>'; });
      f.queue.forEach((q, i) => {
        if (i === 0) {
          slots += '<div class="slot run">' + item(q.r, 46) + '<small data-end="' + q.end + '">' + OA.fmtTime(q.end - now) + '</small><span class="bar"><i data-from="' + q.start + '" data-to="' + q.end + '"></i></span></div>';
        } else slots += '<div class="slot wait">' + item(q.r, 46) + '<small>Queued</small></div>';
      });
      for (let i = f.queue.length + f.done.length; i < f.slots; i++) slots += '<div class="slot empty"></div>';
      const rush = f.queue.length ? '<button class="btn blue" data-a="rush">' + dust(Sim.rushCost(f.queue[0].end - now)) + ' Finish now</button>' : '';
      const addSlot = f.slots < Sim.maxSlots ? '<button class="btn" data-a="slot">Add slot ' + coin(Sim.slotCost(f)) + '</button>' : '';
      const recipes = Sim.factoryRecipes(f).map((r) => {
        const locked = r.lvl > S().level;
        const can = !locked && Object.keys(r.inputs).every((k) => Sim.have(k) >= r.inputs[k]);
        return `
          <button class="recipe ${can ? 'can' : ''} ${locked ? 'locked' : ''}" data-a="make" data-r="${r.id}" data-tg="recipe-${r.id}">
            <span class="r-main">${item(r.id, 56)}<span class="r-text"><b>${esc(r.name)}${r.out > 1 ? ' x' + r.out : ''}</b><small>${locked ? 'Unlocks at level ' + r.lvl : OA.fmtTime(r.time * 1000)}</small></span></span>
            ${locked ? '' : '<span class="r-need">' + Object.keys(r.inputs).map((k) => need(k, r.inputs[k])).join('') + '</span>'}
          </button>`;
      }).join('');
      el.innerHTML = '<div class="slots">' + slots + '</div><div class="row wrap">' + rush + addSlot + '</div><div class="recipes">' + recipes + '</div>';
    },
    on(act, d, a) {
      if (act === 'collect') UI.result(Sim.collectGood(a.id, Number(d.i)));
      if (act === 'make') UI.result(Sim.queue(a.id, d.r));
      if (act === 'rush') UI.result(Sim.rush(a.id));
      if (act === 'slot') UI.result(Sim.buySlot(a.id));
    },
  };

  // ---- Critter pen ----
  P.pen = {
    title: (a) => { const p = Sim.obj(a.id); return p ? OA.CRITTERS.find((c) => c.id === p.kind).name + ' Pen' : ''; },
    render(el, a) {
      const p = Sim.obj(a.id);
      if (!p) return false;
      const def = OA.CRITTERS.find((c) => c.id === p.kind);
      const info = Sim.penInfo(p);
      const cards = p.critters.map((c) => {
        const st = Sim.critterState(c);
        return '<div class="crit ' + st + '">' + icon('critter:' + p.kind, 56) + '<small>' + (st === 'hungry' ? 'Hungry' : st === 'ready' ? 'Ready' : '<span data-end="' + c.readyAt + '" data-done-text="Ready">' + OA.fmtTime(c.readyAt - OA.now()) + '</span>') + '</small></div>';
      }).join('');
      el.innerHTML = `
        <p class="lead">${esc(def.blurb)} Each one gives ${esc(I[def.product].name)} every ${OA.fmtTime(def.time * 1000)}.</p>
        <div class="crits">${cards}</div>
        <div class="row wrap">
          <button class="btn mint" data-a="feed" ${info.hungry ? '' : 'disabled'}>${item(def.feed, 26)} Feed (${Sim.have(def.feed)} left)</button>
          <button class="btn gold" data-a="collect" ${info.ready ? '' : 'disabled'}>${item(def.product, 26)} Collect ${info.ready || ''}</button>
          ${p.critters.length < def.perPen ? '<button class="btn" data-a="buy">Add ' + esc(def.name) + ' ' + coin(Sim.critterCost(p.kind)) + '</button>' : ''}
        </div>`;
    },
    on(act, d, a) {
      if (act === 'feed') UI.result(Sim.feedPen(a.id));
      if (act === 'collect') UI.result(Sim.collectPen(a.id));
      if (act === 'buy') { const r = UI.result(Sim.buyCritter(a.id)); if (r.ok) Au.play('critter'); }
    },
  };

  P.tree = {
    title: (a) => { const t = Sim.obj(a.id); return t ? OA.TREES.find((k) => k.id === t.kind).name : ''; },
    render(el, a) {
      const t = Sim.obj(a.id);
      if (!t) return false;
      const def = OA.TREES.find((k) => k.id === t.kind);
      el.innerHTML = '<p class="lead">This tree has given all its fruit. Replant it to get ' + def.picks + ' more picks.</p><div class="row"><button class="btn mint" data-a="replant">Replant ' + coin(Math.round(def.cost / 2)) + '</button></div>';
    },
    on(act, d, a) { if (act === 'replant') { const r = UI.result(Sim.replantTree(a.id)); if (r.ok) UI.close(); } },
  };

  // ---- Delivery board ----
  P.orders = {
    title: 'Delivery Board', wide: true,
    render(el) {
      const now = OA.now();
      el.innerHTML = '<div class="orders">' + S().orders.map((o, i) => {
        if (o.wait) return '<div class="order waiting"><small>New order in</small><b data-end="' + o.wait + '" data-done-text="a moment">' + OA.fmtTime(o.wait - now) + '</b></div>';
        const ready = Sim.orderReady(o);
        const who = folk(o.who);
        return `
          <div class="order ${ready ? 'ready' : ''}" data-tg="order-${i}">
            <div class="o-head">${icon('folk:' + o.who, 42)}<b>${esc(who.name)}</b><button class="trash" data-a="trash" data-i="${i}" aria-label="Throw away this order">&times;</button></div>
            <div class="o-items">${o.items.map((it) => need(it.id, it.n)).join('')}</div>
            <div class="o-foot">${coin(o.credits)}${xp(o.xp)}</div>
            <button class="btn ${ready ? 'mint' : ''} ship" data-a="ship" data-i="${i}" data-tg="ship-${i}">Ship it</button>
          </div>`;
      }).join('') + '</div>';
    },
    on(act, d) {
      if (act === 'ship') UI.result(Sim.ship(Number(d.i)));
      if (act === 'trash') UI.result(Sim.trashOrder(Number(d.i)));
    },
  };

  // ---- Storage ----
  const stackList = (store) => Object.keys(S().inv).filter((id) => OA.storeOf(id) === store).sort((a, b) => I[a].lvl - I[b].lvl || a.localeCompare(b));
  P.storage = {
    title: (a) => OA.STORE[a.tab || 'silo'].name, wide: true,
    render(el, a) {
      const store = a.tab || 'silo';
      const used = Sim.used(store), cap = Sim.capacity(store);
      const list = stackList(store);
      const sel = a.sel && Sim.have(a.sel) ? a.sel : null;
      const upNeed = Sim.upgradeNeed(store);
      el.innerHTML = tabs([['silo', 'Seed Vault'], ['bay', 'Cargo Bay']], store) + `
        <div class="cap"><span class="bar big ${used >= cap ? 'full' : ''}"><i style="width:${Math.min(100, (used / cap) * 100)}%"></i></span><b>${used} / ${cap}</b></div>
        ${list.length ? '<div class="stacks">' + list.map((id) => '<button class="stack ' + (id === sel ? 'on' : '') + '" data-a="sel" data-id="' + id + '" aria-label="' + esc(I[id].name) + '">' + item(id, 52) + '<b>' + Sim.have(id) + '</b></button>').join('') + '</div>' : '<p class="lead">Nothing stored yet.</p>'}
        ${sel ? `<div class="note"><span><b>${esc(I[sel].name)}</b> · fair price ${OA.fmt(I[sel].value)} credits each</span>
          <span class="row"><button class="btn mini" data-a="scrap" data-n="1">Sell 1 for ${Math.max(1, Math.floor(I[sel].value * 0.5))}</button><button class="btn mini" data-a="scrap" data-n="${Sim.have(sel)}">Sell all for ${OA.fmt(Math.max(1, Math.floor(I[sel].value * Sim.have(sel) * 0.5)))}</button></span></div>` : ''}
        <div class="upgrade"><div><b>Add ${OA.STORE[store].step} more space</b><small>Parts turn up as you harvest, collect and ship.</small></div>
          <div class="up-need">${Object.keys(upNeed).map((k) => need(k, upNeed[k])).join('')}</div>
          <button class="btn gold" data-a="upgrade">Upgrade</button></div>`;
    },
    on(act, d, a) {
      if (act === 'tab') { a.tab = d.tab; a.sel = null; }
      if (act === 'sel') a.sel = a.sel === d.id ? null : d.id;
      if (act === 'scrap') { const r = UI.result(Sim.scrap(a.sel, Number(d.n))); if (r.ok) { Au.play('coin'); UI.toast('Sold for ' + r.credits + ' credits.', 'good'); } }
      if (act === 'upgrade') { const r = UI.result(Sim.upgradeStore(a.tab || 'silo')); if (r.ok) { Au.play('build'); UI.toast('Upgraded! More room for your goods.', 'good'); } }
    },
  };

  // ---- Trading Post ----
  P.post = {
    title: 'Trading Post', wide: true,
    render(el, a) {
      const shop = S().shop;
      if (a.list !== undefined) {
        const L = a.draft || {};
        const items = Object.keys(S().inv).filter((id) => I[id].kind !== 'part');
        let html = '<button class="btn mini" data-a="back">Back to crates</button>';
        if (!L.item) {
          html += '<p class="lead">Pick what to sell.</p><div class="stacks">' + items.map((id) => '<button class="stack" data-a="pick" data-id="' + id + '" aria-label="' + esc(I[id].name) + '">' + item(id, 52) + '<b>' + Sim.have(id) + '</b></button>').join('') + '</div>';
        } else {
          const lim = Sim.shopLimits(L.item, L.n);
          L.price = OA.clamp(L.price === undefined ? Math.round(lim.fair * 1.3) : L.price, lim.min, lim.max);
          const pct = Math.round((L.price / lim.fair) * 100);
          html += `
            <div class="listing">
              <div class="l-item">${item(L.item, 72)}<b>${esc(I[L.item].name)}</b></div>
              <div class="stepper"><span>How many</span><button class="round small" data-a="n" data-d="-1" aria-label="Fewer">-</button><b>${L.n}</b><button class="round small" data-a="n" data-d="1" aria-label="More">+</button></div>
              <label class="price" for="priceRange"><span>Price <b id="priceOut">${OA.fmt(L.price)}</b> credits</span>
                <input id="priceRange" type="range" min="${lim.min}" max="${lim.max}" value="${L.price}" step="1"></label>
              <small class="lead" id="priceHint">${priceHint(pct)}</small>
              <button class="btn mint" data-a="confirm">Put on sale</button>
            </div>`;
        }
        el.innerHTML = html;
        const range = el.querySelector('#priceRange');
        if (range) range.oninput = () => {
          L.price = Number(range.value);
          el.querySelector('#priceOut').textContent = OA.fmt(L.price);
          el.querySelector('#priceHint').textContent = priceHint(Math.round((L.price / lim2(L)) * 100));
        };
        return;
      }
      const now = OA.now();
      let html = '<p class="lead">Customers pay more for good goods, but high prices take longer to sell.</p><div class="crates">';
      shop.slots.forEach((s, i) => {
        if (!s) html += '<button class="crate-slot empty" data-a="add" data-i="' + i + '" data-tg="crate-' + i + '">' + icon('crate', 46) + '<small>Add goods</small></button>';
        else if (s.sold) html += '<button class="crate-slot sold" data-a="collect" data-i="' + i + '">' + icon('coin', 46) + '<b>' + OA.fmt(s.price) + '</b><small>Collect</small></button>';
        else html += '<div class="crate-slot sale">' + item(s.item, 46) + '<b>x' + s.n + '</b><small>' + OA.fmt(s.price) + ' credits</small><button class="trash" data-a="unlist" data-i="' + i + '" aria-label="Take back">&times;</button></div>';
      });
      if (shop.size < Sim.shopMax) html += '<button class="crate-slot add" data-a="slot"><b>More space</b>' + coin(Sim.shopSlotCost()) + '</button>';
      el.innerHTML = html + '</div>';
    },
    on(act, d, a) {
      if (act === 'add') { a.list = Number(d.i); a.draft = {}; }
      if (act === 'back') { a.list = undefined; a.draft = null; }
      if (act === 'pick') { a.draft = { item: d.id, n: Math.min(5, Sim.have(d.id)) }; }
      if (act === 'n') {
        const L = a.draft;
        L.n = OA.clamp(L.n + Number(d.d), 1, Math.min(10, Sim.have(L.item)));
        L.price = undefined;
      }
      if (act === 'confirm') {
        const L = a.draft;
        const r = UI.result(Sim.list(a.list, L.item, L.n, L.price));
        if (r.ok) { Au.play('collect'); a.list = undefined; a.draft = null; }
      }
      if (act === 'collect') UI.result(Sim.collectSale(Number(d.i)));
      if (act === 'unlist') UI.result(Sim.unlist(Number(d.i)));
      if (act === 'slot') UI.result(Sim.buyShopSlot());
    },
  };
  const lim2 = (L) => Sim.shopLimits(L.item, L.n).fair;
  const priceHint = (pct) => (pct <= 80 ? 'A bargain. This will sell very quickly.' : pct <= 130 ? 'A fair price. This should sell soon.' : pct <= 170 ? 'A high price. It may take a few minutes.' : 'The highest price. Expect a long wait.');

  // ---- Gazette ----
  P.gazette = {
    title: 'Colony Gazette', wide: true,
    render(el) {
      const g = S().gazette;
      if (!g) { el.innerHTML = '<p class="lead">The next issue is being printed.</p>'; return; }
      el.innerHTML = '<div class="note"><span>Settlers selling spare goods. New issue in <b data-end="' + g.nextAt + '" data-done-text="a moment">' + OA.fmtTime(g.nextAt - OA.now()) + '</b></span><button class="btn mini blue" data-a="fresh">' + dust(1) + ' New issue</button></div><div class="grid">' +
        g.list.map((l, i) => `
          <button class="card buy ${l.sold ? 'owned' : ''}" data-a="buy" data-i="${i}" ${l.sold ? 'disabled' : ''}>
            ${item(l.item, 64)}
            <b>${l.n} ${esc(I[l.item].name)}</b>
            <small>from ${esc(folk(l.who).name)}</small>
            <span class="foot">${l.sold ? '<span class="oktxt">Bought</span>' : coin(l.price)}</span>
          </button>`).join('') + '</div>';
    },
    on(act, d) {
      if (act === 'buy') { const r = UI.result(Sim.buyListing(Number(d.i))); if (r.ok) Au.play('coin'); }
      if (act === 'fresh') UI.result(Sim.refreshGazetteNow());
    },
  };

  // ---- Small dialogs ----
  P.rock = {
    title: (a) => { const r = S().rocks.find((k) => k.id === a.id); return r ? (r.kind === 'rock' ? 'Space Rock' : r.kind === 'thicket' ? 'Spiny Thicket' : 'Crystal Cluster') : ''; },
    render(el, a) {
      const r = S().rocks.find((k) => k.id === a.id);
      if (!r) return false;
      el.innerHTML = '<p class="lead">Clear this to free up the land. You might find parts underneath.</p><div class="row"><button class="btn mint" data-a="clear">Clear it ' + coin(Sim.rockCost(r)) + '</button></div>';
    },
    on(act, d, a) { if (act === 'clear') { const r = UI.result(Sim.clearRock(a.id)); if (r.ok) { Au.play('build'); UI.close(); } } },
  };
  P.claim = {
    title: 'Claim New Land',
    render(el) {
      const q = Sim.claimQuote();
      const locked = S().level < q.lvl;
      el.innerHTML = `<p class="lead">${locked ? 'You can claim this sector at level ' + q.lvl + '.' : 'Plant a beacon here to turn this sector into colony land.'}</p>
        <div class="up-need center">${Object.keys(q.need).map((k) => need(k, q.need[k])).join('')}</div>
        <div class="row"><button class="btn mint" data-a="claim" ${locked ? 'disabled' : ''}>Claim ${coin(q.credits)}</button></div>`;
    },
    on(act, d, a) { if (act === 'claim') { const r = UI.result(Sim.claim(a.sx, a.sz)); if (r.ok) { Au.play('build'); UI.close(); UI.toast('New land claimed!', 'good'); } } },
  };

  // ---- Supply Rocket ----
  P.rocket = {
    title: 'Supply Rocket', wide: true,
    render(el) {
      const r = S().rocket;
      const now = OA.now();
      if (r.state !== 'here') {
        el.innerHTML = '<div class="empty-note">' + icon('rocket', 96) + '<p class="lead">The rocket is out on its route. Back in <b data-end="' + r.at + '" data-done-text="a moment">' + OA.fmtTime(r.at - now) + '</b>.</p></div>';
        return;
      }
      const done = r.crates.filter((c) => c.done).length;
      el.innerHTML = '<div class="note"><span>Loaded <b>' + done + ' / ' + r.crates.length + '</b> crates. Leaves in <b data-end="' + r.at + '" data-done-text="now">' + OA.fmtTime(r.at - now) + '</b></span></div><div class="crates nine">' + r.crates.map((c, i) => {
        if (c.done) return '<div class="crate-slot sold">' + icon('crate', 40) + '<small>Loaded</small></div>';
        const can = Sim.have(c.item) >= c.n;
        return '<button class="crate-slot ' + (can ? 'can' : '') + '" data-a="fill" data-i="' + i + '">' + item(c.item, 44) + '<small>' + Sim.have(c.item) + '/' + c.n + '</small>' + coin(c.credits) + '</button>';
      }).join('') + '</div><p class="lead">Fill all nine for a bonus of credits, Stardust and a rare part.</p>';
    },
    on(act, d) { if (act === 'fill') UI.result(Sim.fillCrate(Number(d.i))); },
  };

  // ---- Starport Town ----
  P.town = {
    title: 'Starport Town', wide: true,
    render(el, a) {
      const T = S().town;
      const tab = a.tab || (Sim.townCap() ? 'visitors' : 'lots');
      let html = tabs([['visitors', 'Visitors'], ['lots', 'Buildings']], tab);
      if (tab === 'visitors') {
        html += '<div class="note"><span>Town rank <b>' + T.rank + '</b>. ' + T.rep + ' of ' + Sim.repNeed() + ' reputation to the next rank.</span></div>';
        if (!Sim.townCap()) html += '<p class="lead">Nobody will visit until you fix up a building.</p>';
        else if (!T.visitors.length) html += '<p class="lead">No visitors right now. Next arrival in <b data-end="' + T.nextAt + '" data-done-text="a moment">' + OA.fmtTime(T.nextAt - OA.now()) + '</b>.</p>';
        html += '<div class="orders">' + T.visitors.map((v, i) => {
          const ready = v.items.every((it) => Sim.have(it.id) >= it.n);
          return `<div class="order ${ready ? 'ready' : ''}">
            <div class="o-head">${icon('folk:' + v.who, 42)}<b>${esc(folk(v.who).name)}</b></div>
            <div class="o-items">${v.items.map((it) => need(it.id, it.n)).join('')}</div>
            <div class="o-foot">${coin(v.credits)}${xp(v.xp)}</div>
            <button class="btn ${ready ? 'mint' : ''}" data-a="serve" data-i="${i}">Serve</button></div>`;
        }).join('') + '</div>';
      } else {
        html += '<div class="lots">' + OA.TOWN_LOTS.map((l) => {
          const open = T.lots[l.id];
          const locked = S().level < l.lvl;
          return `<div class="lot ${open ? 'open' : ''}">
            ${icon('lot:' + l.id, 72)}
            <div class="lot-text"><b>${esc(l.name)}</b><small>${esc(l.blurb)}</small>
            ${open ? '<span class="oktxt">Open for business</span>' : locked ? '<span class="lockt">Level ' + l.lvl + '</span>' : '<div class="up-need">' + Object.keys(l.need).map((k) => need(k, l.need[k])).join('') + '</div><button class="btn gold" data-a="restore" data-id="' + l.id + '">Fix up ' + coin(l.cost) + '</button>'}
            </div></div>`;
        }).join('') + '</div>';
      }
      el.innerHTML = html;
    },
    on(act, d, a) {
      if (act === 'tab') a.tab = d.tab;
      if (act === 'serve') UI.result(Sim.serve(Number(d.i)));
      if (act === 'restore') { const r = UI.result(Sim.restore(d.id)); if (r.ok) { Au.play('build'); UI.toast('Reopened! Visitors are on their way.', 'good'); } }
    },
  };

  UI.openSite = (id) => {
    if (id === 'rocket') UI.open('rocket');
    if (id === 'town') UI.open('town');
    if (id === 'mine') OA.Games.mine();
    if (id === 'dock') OA.Games.fish();
  };

  // ---- Mission log ----
  P.log = {
    title: 'Mission Log', wide: true,
    render(el) {
      const st = S();
      const daily = Sim.dailyReady();
      const goals = OA.GOALS.filter((g) => !st.goals[g.id]).sort((a, b) => Sim.goalClaimable(b) - Sim.goalClaimable(a) || (Sim.goalProgress(b) / b.goal) - (Sim.goalProgress(a) / a.goal));
      const stats = [['Orders shipped', st.stats.orders], ['Plots harvested', st.stats.harvests], ['Goods made', st.stats.goods], ['Credits earned', st.stats.earned]];
      el.innerHTML = `
        <div class="note"><span>${daily ? '<b>Your daily gift is ready.</b>' : 'Daily gift claimed. Streak: <b>' + st.daily.streak + ' day' + (st.daily.streak === 1 ? '' : 's') + '</b>'}</span>${daily ? '<button class="btn mini gold" data-a="daily">Open gift</button>' : ''}</div>
        <div class="goals">${goals.map((g) => {
          const p = Sim.goalProgress(g), can = Sim.goalClaimable(g);
          return `<div class="goal ${can ? 'can' : ''}"><div><b>${esc(g.name)}</b><small>${esc(g.text)}</small><span class="bar"><i style="width:${(p / g.goal) * 100}%"></i></span></div>
            ${can ? '<button class="btn mini mint" data-a="claim" data-id="' + g.id + '">Claim ' + dust(g.dust) + '</button>' : '<span class="g-r">' + OA.fmt(p) + ' / ' + OA.fmt(g.goal) + '<br>' + dust(g.dust) + '</span>'}</div>`;
        }).join('') || '<p class="lead">Every mission is complete. What a colony!</p>'}</div>
        <div class="stats">${stats.map(([k, v]) => '<div><b>' + OA.fmt(v) + '</b><small>' + k + '</small></div>').join('')}</div>`;
    },
    on(act, d) {
      if (act === 'claim') { const r = UI.result(Sim.claimGoal(d.id)); if (r.ok) UI.toast('Mission complete! +' + r.dust + ' Stardust.', 'good'); }
      if (act === 'daily') UI.dailyGift();
    },
  };

  // ---- Settings ----
  P.settings = {
    title: 'Settings',
    render(el) {
      const st = S();
      el.innerHTML = `
        <label class="field" for="colonyName"><span>Colony name</span><input id="colonyName" maxlength="22" value="${esc(st.name)}"></label>
        <div class="toggles">
          <button class="toggle ${st.settings.sound ? 'on' : ''}" data-a="sound" aria-pressed="${st.settings.sound}">Sound effects</button>
          <button class="toggle ${st.settings.music ? 'on' : ''}" data-a="music" aria-pressed="${st.settings.music}">Music</button>
        </div>
        <p class="lead">Your colony saves itself. Crops and goods keep working while the game is closed.</p>
        <details class="keys"><summary>Controls</summary><p class="lead">Drag to spin the planet. Pinch or scroll to zoom. Drag across ripe plots to harvest. Hold on a building to move it. On a keyboard, arrow keys pan, plus and minus zoom, and Esc closes windows.</p></details>
        <div class="row wrap"><button class="btn mint" data-a="move">Move colony to another device</button><button class="btn coral" data-a="wipe">Start a new colony</button></div>
        <p class="lead small">Orbit Acres ${OA.VERSION}</p>`;
      const input = el.querySelector('#colonyName');
      input.onchange = () => { st.name = input.value.trim() || 'New Haven'; UI.update(); };
    },
    on(act) {
      const st = S();
      if (act === 'sound') st.settings.sound = !st.settings.sound;
      if (act === 'music') st.settings.music = !st.settings.music;
      if (act === 'move') UI.open('move');
      if (act === 'wipe') {
        UI.confirm('Start over?', 'This erases your whole colony, on every device. It cannot be undone.', 'Erase everything', async () => {
          OA.Store.clearLocal();
          OA.Store.noSave = true;
          if (OA.Store.doc) { try { await OA.Store.doc.delete(); } catch (e) { /* still restart locally */ } }
          root.location.reload();
        }, 'coral');
      }
    },
  };

  // ---- Moving a colony between devices ----
  P.move = {
    title: 'Move Your Colony',
    render(el, a) {
      const Tr = OA.Transfer;
      const live = Tr.liveOK();
      const copyLabel = Tr.linkOK() ? 'Copy colony link' : 'Copy save code';
      if (a.code === undefined) {
        a.code = null;
        Tr.encode().then((code) => {
          a.code = code;
          const b = el.querySelector('#copyColony');
          if (b) b.disabled = false;
        });
      }
      const send = a.send || {};
      let liveHtml = '';
      if (live) {
        if (send.state === 'waiting') {
          liveHtml = '<div class="mv-code">' + send.code.slice(0, 3) + ' ' + send.code.slice(3) + '</div><p class="lead">Type this on your other device, under Receive a colony. Keep this window open.</p><div class="row"><button class="btn" data-a="cancel">Cancel</button></div>';
        } else if (send.state === 'starting') {
          liveHtml = '<p class="lead">Getting a code...</p>';
        } else if (send.state === 'sent') {
          liveHtml = '<p class="lead oktxt">Sent! Your colony is on the other device now.</p>';
        } else {
          liveHtml = '<p class="lead">Open the game on your other device, then get a short code to type there.</p><div class="row"><button class="btn mint" data-a="send">Get a code</button></div>';
        }
      }
      el.innerHTML =
        '<section class="mv"><h3>Send this colony</h3>' + liveHtml +
        '<p class="lead">' + (live ? 'Other device not handy? Copy a link and paste it anywhere, like email or your notes.' : 'Copy the code and paste it anywhere, like email or your notes.') + '</p>' +
        '<div class="row"><button class="btn ' + (live ? '' : 'mint') + '" id="copyColony" data-a="copy" ' + (a.code ? '' : 'disabled') + '>' + copyLabel + '</button></div>' +
        (a.showCode ? '<textarea id="codeOut" rows="3" readonly aria-label="Your colony, ready to copy"></textarea><p class="lead small">Your browser blocked copying, so select this text and copy it yourself.</p>' : '') +
        '</section>' +
        '<section class="mv"><h3>Receive a colony</h3>' +
        '<label class="field" for="codeIn"><span>' + (live ? 'Type a code, or paste a link' : 'Paste a code or link') + '</span>' +
        '<textarea id="codeIn" rows="2" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false"></textarea></label>' +
        '<p class="lead">This replaces the colony on this device. After that, the two copies carry on separately.</p>' +
        '<div class="row"><button class="btn gold" data-a="get" ' + (a.getting ? 'disabled' : '') + '>' + (a.getting ? 'Connecting...' : 'Get colony') + '</button></div>' +
        (OA.Store.readBackup() ? '<div class="row"><button class="btn mini" data-a="undo">Bring back the colony from before</button></div>' : '') +
        '</section>';
      const box = el.querySelector('#codeIn');
      box.value = a.input || '';
      box.oninput = () => { a.input = box.value; };
      const out = el.querySelector('#codeOut');
      if (out) out.value = Tr.share(a.code);
    },
    on(act, d, a) {
      const Tr = OA.Transfer;
      const here = () => cur && cur.args === a;
      const refresh = () => { if (here()) UI.rerender(true); };
      if (act === 'send') {
        a.send = { state: 'starting' };
        Tr.send({
          code: (code) => { a.send = { state: 'waiting', code }; refresh(); },
          sent: () => { a.send = { state: 'sent' }; Au.play('gem'); refresh(); },
          fail: (why) => { a.send = {}; UI.fail({ why: Tr.failText(why) }); refresh(); },
        }).then((stop) => { a.stopSend = stop; if (!here()) stop(); });
      }
      if (act === 'cancel') { if (a.stopSend) a.stopSend(); a.send = {}; }
      if (act === 'copy') {
        const show = () => {
          a.showCode = true;
          refresh();
          const out = cur && cur.body.querySelector('#codeOut');
          if (out) { out.focus(); out.select(); }
        };
        const text = Tr.share(a.code);
        if (root.navigator.clipboard && root.navigator.clipboard.writeText) {
          root.navigator.clipboard.writeText(text).then(() => UI.toast('Copied! Paste it somewhere you can reach from the other device.', 'good'), show);
        } else show();
      }
      if (act === 'get') {
        const text = (a.input || '').trim();
        if (!text) { UI.fail({ why: 'Type a code or paste a link first.' }); return; }
        if (Tr.isShort(text)) {
          a.getting = true;
          Tr.receive(text, {
            got: (data) => { a.getting = false; refresh(); UI.offerColony(data); },
            fail: (why) => { a.getting = false; UI.fail({ why: Tr.failText(why) }); refresh(); },
          }).then((stop) => { a.stopGet = stop; if (!here()) stop(); });
        } else {
          Tr.decode(text).then(UI.offerColony).catch((e) => UI.fail({ why: Tr.why(e) }));
        }
      }
      if (act === 'undo') UI.confirm('Bring back the old colony?', 'This swaps back to the colony this device had before the last move.', 'Bring it back', () => Tr.undo());
    },
    onClose(a) {
      if (a.stopSend) a.stopSend();
      if (a.stopGet) a.stopGet();
    },
  };

  UI.offerColony = (data) => {
    Au.play('gem');
    UI.confirm('Load this colony?', data.name + ', level ' + data.level + '. It replaces the colony on this device. You can undo this from Settings.', 'Load it', () => OA.Transfer.apply(data));
  };

  // ---- Full-screen moments ----
  const overlay = (html, cls) => {
    const box = UI.$('#overlay');
    const el = UI.make('<div class="moment ' + (cls || '') + '"><div class="moment-card">' + html + '</div></div>');
    box.appendChild(el);
    return { el, close: () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); } };
  };
  UI.confirm = (title, text, yes, fn, cls) => {
    const o = overlay('<h2>' + esc(title) + '</h2><p>' + esc(text) + '</p><div class="row"><button class="btn" data-no>Keep playing</button><button class="btn ' + (cls || 'mint') + '" data-yes>' + esc(yes) + '</button></div>');
    o.el.querySelector('[data-no]').onclick = o.close;
    o.el.querySelector('[data-yes]').onclick = () => { o.close(); fn(); };
  };

  const unlockKey = (u) => {
    if (u.item) return 'item:' + u.item;
    if (u.critter) return 'critter:' + u.critter;
    if (u.factory) return 'factory:' + u.factory;
    return { rocket: 'rocket', town: 'lot:diner', mine: 'mine', dock: 'dock', post: 'post', gazette: 'gazette' }[u.site];
  };
  const levels = [];
  let showingLevel = false;
  const nextLevel = () => {
    if (showingLevel || !levels.length) return;
    const e = levels.shift();
    showingLevel = true;
    Au.play('level');
    const o = overlay(`
      <div class="lv-star">${icon('xpstar', 120)}<b>${e.level}</b></div>
      <h2>Level ${e.level}!</h2>
      <div class="lv-rew">${coin(e.credits)}${dust(e.dust)}</div>
      ${e.unlocks.length ? '<h3>New on your planet</h3><div class="lv-new">' + e.unlocks.map((u) => '<span>' + icon(unlockKey(u), 62) + '<small>' + esc(u.label) + '</small></span>').join('') + '</div>' : ''}
      <button class="btn mint big" data-ok>Keep going</button>`, 'level');
    o.el.querySelector('[data-ok]').onclick = () => {
      Au.play('tap');
      o.close();
      showingLevel = false;
      UI.update();
      nextLevel();
    };
  };
  UI.levelQueue = (e) => { levels.push(e); setTimeout(nextLevel, 500); };

  UI.welcomeBack = (a) => {
    const lines = [];
    if (a.fields) lines.push(['field', OA.plural(a.fields, 'plot') + ' ripened']);
    if (a.critters) lines.push(['critter:puffling', OA.plural(a.critters, 'critter') + ' ready to collect']);
    if (a.goods) lines.push(['factory:bakery', OA.plural(a.goods, 'batch') .replace('batchs', 'batches') + ' of goods finished']);
    if (a.sales) lines.push(['coin', OA.plural(a.sales, 'sale') + ' worth ' + OA.fmt(a.credits) + ' credits']);
    if (!lines.length) { if (Sim.dailyReady() && S().tut >= 99) UI.dailyGift(); return; }
    const o = overlay(`
      ${icon('rivet', 92)}
      <h2>Welcome back!</h2>
      <p>The colony kept busy for ${OA.fmtTime(a.ms)} while you were away.</p>
      <div class="away">${lines.map(([k, t]) => '<div>' + icon(k, 40) + '<span>' + esc(t) + '</span></div>').join('')}</div>
      <button class="btn mint big" data-ok>Let's go</button>`);
    o.el.querySelector('[data-ok]').onclick = () => { Au.unlock(); o.close(); if (Sim.dailyReady() && S().tut >= 99) setTimeout(UI.dailyGift, 250); };
  };

  UI.dailyGift = () => {
    if (!Sim.dailyReady()) return;
    const r = Sim.claimDaily();
    const parts = [coin(r.credits)];
    if (r.dust) parts.push(dust(r.dust));
    if (r.part) parts.push('<span class="cost">' + item(r.part, 24) + esc(I[r.part].name) + '</span>');
    Au.play('gem');
    const o = overlay(`
      ${icon('crate', 96)}
      <h2>Daily gift</h2>
      <p>Day ${r.streak} in a row. Come back tomorrow for a bigger one.</p>
      <div class="lv-rew">${parts.join('')}</div>
      <button class="btn mint big" data-ok>Thanks, Rivet</button>`);
    o.el.querySelector('[data-ok]').onclick = () => { o.close(); UI.update(); UI.rerender(); };
  };

  UI.bootPanels = () => {
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (UI.placing) UI.endPlace();
        else if (OA.Games && OA.Games.open()) OA.Games.close();
        else if (cur) UI.close();
        else UI.closeTray();
      }
    });
  };
})(window);
