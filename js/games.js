// Orbit Acres: the two side activities, the Hollow Mine and the Star Sea.
(function (root) {
  const OA = root.OA;
  const Sim = OA.Sim;
  const I = OA.ITEMS;
  const UI = OA.UI;
  const Au = OA.Audio;
  const icon = (k, s) => OA.Icons.html(k, s);
  const item = (id, s) => OA.Icons.item(id, s);
  const Games = (OA.Games = {});
  let active = null;

  const frame = (cls, title, body) => {
    Games.close();
    const el = UI.make(`
      <div class="game ${cls}">
        <header class="sheet-head"><h2>${title}</h2><button class="round small sheet-x" aria-label="Close">&times;</button></header>
        <div class="game-body">${body}</div>
      </div>`);
    UI.$('#overlay').appendChild(el);
    el.querySelector('.sheet-x').onclick = () => { Au.play('close'); Games.close(); };
    return el;
  };
  Games.open = () => !!active;
  Games.close = () => {
    if (!active) return;
    if (active.stop) active.stop();
    active.el.remove();
    active = null;
    UI.update();
  };

  // ---- Hollow Mine: dig tiles, look for the glint ----
  Games.mine = () => {
    const S = Sim.state();
    if (!S.mine || Sim.mineLeft() === 0) Sim.freshMine();
    const el = frame('mine', 'Hollow Mine', `
      <p class="lead">Dig with a drill. Tiles that glint are hiding something, and deeper rows hold rarer finds.</p>
      <div class="m-tools">
        <button class="tool on" data-tool="drill">${item('drill', 38)}<b id="nDrill">0</b></button>
        <button class="tool" data-tool="charge">${item('charge', 38)}<b id="nCharge">0</b></button>
        <button class="btn mini" data-buy="drill">Buy drill ${Sim.toolPrice.drill}</button>
        <button class="btn mini" data-buy="charge">Buy charge ${Sim.toolPrice.charge}</button>
      </div>
      <div class="m-grid" id="mineGrid"></div>
      <div class="m-found"><small id="mineLeft"></small><button class="btn mini" id="mineNew">New tunnel</button></div>`);
    active = { el };
    let tool = 'drill';
    const grid = el.querySelector('#mineGrid');
    const paint = () => {
      el.querySelector('#nDrill').textContent = Sim.have('drill');
      el.querySelector('#nCharge').textContent = Sim.have('charge');
      el.querySelector('#mineLeft').textContent = 'Tunnel refreshes in ' + OA.fmtTime(S.mine.resetAt - OA.now());
      grid.innerHTML = S.mine.cells.map((c, i) => {
        const row = Math.floor(i / Sim.MINE_W);
        if (c.dug) return '<span class="m-cell dug" data-row="' + row + '">' + (c.shown ? item(c.shown, 34) : '') + '</span>';
        return '<button class="m-cell ' + (c.glint ? 'glint' : '') + '" data-row="' + row + '" data-i="' + i + '" aria-label="Dig here"></button>';
      }).join('');
    };
    paint();
    grid.onclick = (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      Au.unlock();
      const r = Sim.dig(Number(b.dataset.i), tool);
      if (!r.ok) { UI.fail(r); return; }
      Au.play('dig');
      r.found.forEach((f) => {
        const c = S.mine.cells[f.i];
        c.shown = f.item || null;
        if (f.item) {
          Au.play('gem');
          const rect = b.getBoundingClientRect();
          UI.fly('item:' + f.item, rect.left + rect.width / 2, rect.top, UI.$('#storeBtn'));
          UI.float(rect.left + rect.width / 2, rect.top - 8, I[f.item].name, 'mint');
        }
      });
      paint();
      if (Sim.mineLeft() === 0) { UI.toast('You cleaned out this tunnel! A new one opens up.', 'good'); Sim.freshMine(); setTimeout(paint, 600); }
    };
    el.querySelectorAll('.tool').forEach((b) => {
      b.onclick = () => {
        tool = b.dataset.tool;
        el.querySelectorAll('.tool').forEach((k) => k.classList.toggle('on', k === b));
        Au.play('tap');
      };
    });
    el.querySelectorAll('[data-buy]').forEach((b) => {
      b.onclick = () => { const r = UI.result(Sim.buyTool(b.dataset.buy)); if (r.ok) { Au.play('coin'); paint(); } };
    });
    el.querySelector('#mineNew').onclick = () => {
      UI.confirm('Open a new tunnel?', 'This caves in the current one, along with anything still buried in it.', 'Open it', () => { Sim.freshMine(); paint(); });
    };
  };

  // ---- Star Sea: hold to reel, keep the hook on the fish ----
  Games.fish = () => {
    const el = frame('fish', 'Star Sea', `
      <div class="f-sea" id="fSea">
        <div class="f-stars"></div>
        <div class="f-line" id="fLine"></div>
        <div class="f-meter" id="fMeter" hidden><div class="f-zone" id="fZone"></div><div class="f-hook" id="fHook"></div></div>
        <div class="f-progress" id="fProg" hidden><i id="fProgFill"></i></div>
        <p class="f-msg" id="fMsg"></p>
      </div>
      <div class="f-foot">
        <span class="f-bait">${item('bait', 34)}<b id="fBait">0</b></span>
        <button class="btn mini" id="fBuy">Buy 5 bait ${Sim.toolPrice.bait * 5}</button>
        <button class="btn mint big" id="fAct">Cast line</button>
      </div>`);
    const sea = el.querySelector('#fSea');
    const msg = el.querySelector('#fMsg');
    const act = el.querySelector('#fAct');
    const meter = el.querySelector('#fMeter');
    const zoneEl = el.querySelector('#fZone');
    const hookEl = el.querySelector('#fHook');
    const prog = el.querySelector('#fProg');
    const fill = el.querySelector('#fProgFill');
    const line = el.querySelector('#fLine');
    let state = 'idle', raf = 0, fish = null, hold = false, t = 0, last = 0;
    let hook = 0.5, vel = 0, zone = 0.5, zoneV = 0, caught = 0, wait = 0;

    const bait = () => { el.querySelector('#fBait').textContent = Sim.have('bait'); };
    bait();
    msg.textContent = 'Cast into the glowing water and wait for a bite.';

    const reset = () => {
      state = 'idle';
      meter.hidden = prog.hidden = true;
      line.className = 'f-line';
      act.textContent = 'Cast line';
      act.disabled = false;
      bait();
    };
    const cast = () => {
      Au.unlock();
      const r = Sim.cast();
      if (!r.ok) { UI.fail(r); return; }
      fish = OA.FISH.find((f) => f.id === r.fish);
      Au.play('splash');
      state = 'wait';
      wait = OA.rand(1.2, 3.4);
      line.className = 'f-line down';
      act.textContent = 'Waiting';
      act.disabled = true;
      msg.textContent = 'Line is in the water...';
      bait();
    };
    const begin = () => {
      state = 'reel';
      hook = 0.3; vel = 0; zone = 0.5; zoneV = 0; caught = 0.28;
      meter.hidden = prog.hidden = false;
      zoneEl.style.height = fish.zone * 100 + '%';
      act.disabled = false;
      act.textContent = 'Hold to reel';
      msg.textContent = 'A bite! Hold to rise and let go to sink. Keep the hook in the glow.';
      line.className = 'f-line bite';
      Au.play('splash');
    };
    const finish = (won) => {
      state = 'done';
      meter.hidden = prog.hidden = true;
      if (won) {
        const r = Sim.landFish(fish.id);
        if (r.ok) {
          Au.play('gem');
          msg.innerHTML = 'You caught a ' + fish.name + '!';
          const rect = sea.getBoundingClientRect();
          UI.fly('item:' + fish.id, rect.left + rect.width / 2, rect.top + rect.height / 2, UI.$('#storeBtn'));
        } else UI.fail(r);
      } else {
        Au.play('bad');
        msg.textContent = 'It got away. Try again!';
      }
      setTimeout(() => { if (state === 'done') reset(); }, 500);
    };
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      t += dt;
      if (state === 'wait') {
        wait -= dt;
        if (wait <= 0) begin();
      } else if (state === 'reel') {
        // The hook rises while held and sinks when released.
        vel += (hold ? 1.7 : -1.45) * dt;
        vel *= Math.pow(0.12, dt);
        hook = OA.clamp(hook + vel * dt * 1.4, 0, 1);
        if ((hook === 0 && vel < 0) || (hook === 1 && vel > 0)) vel = 0;
        // The fish darts around.
        if (Math.random() < dt * (0.9 + fish.speed)) zoneV = OA.rand(-1, 1) * fish.speed * 0.6;
        zone = OA.clamp(zone + zoneV * dt, fish.zone / 2, 1 - fish.zone / 2);
        if (zone <= fish.zone / 2 || zone >= 1 - fish.zone / 2) zoneV *= -1;
        const inside = Math.abs(hook - zone) < fish.zone / 2;
        caught += (inside ? 0.3 : -0.2) * dt;
        hookEl.style.bottom = hook * 100 + '%';
        zoneEl.style.bottom = (zone - fish.zone / 2) * 100 + '%';
        zoneEl.classList.toggle('on', inside);
        fill.style.height = OA.clamp(caught, 0, 1) * 100 + '%';
        if (caught >= 1) finish(true);
        else if (caught <= 0) finish(false);
      }
    };
    raf = requestAnimationFrame(loop);
    active = { el, stop: () => cancelAnimationFrame(raf) };

    const down = (e) => {
      e.preventDefault();
      if (state === 'reel') hold = true;
    };
    const up = () => { hold = false; };
    act.addEventListener('pointerdown', down);
    sea.addEventListener('pointerdown', down);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    const keyDown = (e) => { if (e.code === 'Space') { e.preventDefault(); if (state === 'idle') cast(); else if (state === 'reel') hold = true; } };
    const keyUp = (e) => { if (e.code === 'Space') hold = false; };
    root.addEventListener('keydown', keyDown);
    root.addEventListener('keyup', keyUp);
    const stop = active.stop;
    active.stop = () => {
      stop();
      root.removeEventListener('pointerup', up);
      root.removeEventListener('pointercancel', up);
      root.removeEventListener('keydown', keyDown);
      root.removeEventListener('keyup', keyUp);
    };
    act.onclick = () => { if (state === 'idle') cast(); };
    el.querySelector('#fBuy').onclick = () => { const r = UI.result(Sim.buyTool('bait', 5)); if (r.ok) { Au.play('coin'); bait(); } };
  };
})(window);
