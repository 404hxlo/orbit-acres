// Orbit Acres: Rivet walks a new settler through the first few minutes.
(function (root) {
  const OA = root.OA;
  const Sim = OA.Sim;
  const UI = OA.UI;
  const Au = OA.Audio;
  const Guide = (OA.Guide = {});
  let bubble, arrow, spot = null, target = null;

  const S = () => Sim.state();
  const firstField = (fn) => Sim.objs('field').find(fn);
  const pen = () => Sim.objs('pen')[0];
  const synth = () => Sim.objs('factory').find((f) => f.kind === 'synth');
  const board = () => Sim.objs('board')[0];
  const worldOf = (o, y) => {
    if (!o) return null;
    const { w, d } = Sim.size(o);
    return { x: o.x + w / 2, y, z: o.z + d / 2 };
  };

  // Each step: what Rivet says, what to point at, and when it counts as done.
  const STEPS = [
    {
      id: 'hello',
      say: 'Hi, I\'m Rivet, your colony helper! Welcome to your own tiny planet. What should we call this place?',
      form: true,
    },
    {
      id: 'harvest',
      say: 'These Moonwheat plots are ripe. Tap them, or drag across all three to harvest.',
      world: () => worldOf(firstField((f) => Sim.fieldReady(f)), 1.2),
      done: () => !Sim.objs('field').some(Sim.fieldReady) && S().stats.harvests >= 1,
    },
    {
      id: 'plant',
      say: 'Every seed you plant gives back two. Tap an empty plot, then pick Moonwheat.',
      world: () => worldOf(firstField((f) => !f.crop), 0.8),
      ui: () => (document.querySelector('#tray:not([hidden]) [data-crop="wheat"]') ? '[data-crop="wheat"]' : null),
      done: () => Sim.objs('field').some((f) => f.crop),
    },
    {
      id: 'feed',
      say: 'The Pufflings look hungry. Tap their pen to feed them.',
      world: () => worldOf(pen(), 2.4),
      done: () => pen().critters.some((c) => c.readyAt !== null),
    },
    {
      id: 'order',
      say: 'Zib needs Moonwheat. Tap the Delivery Board and ship the order. Credits and XP come from orders.',
      world: () => worldOf(board(), 3.6),
      ui: () => (document.querySelector('.order[data-tg="order-0"] .ship') ? '.order[data-tg="order-0"] .ship' : null),
      done: () => S().stats.orders >= 1,
    },
    {
      id: 'eggs',
      say: 'Star Eggs are ready. Tap the pen to collect them.',
      world: () => worldOf(pen(), 2.4),
      ready: () => pen().critters.some((c) => Sim.critterState(c) === 'ready'),
      wait: 'Your Pufflings are laying. It only takes a few seconds.',
      done: () => Sim.have('egg') >= 1 || S().stats.orders >= 2,
    },
    {
      id: 'synth',
      say: 'Critters need feed. Tap the Feed Synth and make a batch of Puffling Pellets.',
      world: () => worldOf(synth(), 4.6),
      ui: () => (document.querySelector('[data-tg="recipe-feed_puff"]') ? '[data-tg="recipe-feed_puff"]' : null),
      done: () => synth().queue.length + synth().done.length > 0,
    },
    {
      id: 'free',
      say: 'That\'s the whole loop: grow, feed, make, ship. When you reach level 2, tap Build for a Bio-Bakery. The planet is yours!',
      finish: true,
    },
  ];

  const stepNow = () => STEPS[S().tut];

  const render = () => {
    const s = stepNow();
    if (!s) { bubble.hidden = true; arrow.hidden = true; clearSpot(); return; }
    bubble.hidden = false;
    let html = OA.Icons.html('rivet', 58) + '<div class="rv-text"><p></p>';
    if (s.form) html += '<form id="nameForm"><input id="nameInput" maxlength="22" value="New Haven" aria-label="Colony name"><button class="btn mint" type="submit">Let\'s go</button></form>';
    if (s.finish) html += '<button class="btn mint" id="rvOk">Got it</button>';
    bubble.innerHTML = html + '</div>';
    bubble.querySelector('p').textContent = s.say;
    if (s.form) {
      bubble.querySelector('#nameForm').onsubmit = (e) => {
        e.preventDefault();
        Au.unlock();
        Au.play('collect');
        const v = bubble.querySelector('#nameInput').value.trim();
        S().name = v || 'New Haven';
        next();
      };
    }
    if (s.finish) bubble.querySelector('#rvOk').onclick = () => { Au.unlock(); Au.play('tap'); S().tut = 99; render(); UI.update(); };
  };
  const next = () => {
    S().tut++;
    Au.play('tap');
    render();
    UI.update();
  };

  const clearSpot = () => { if (spot) { spot.classList.remove('spot'); spot = null; } };

  Guide.tick = () => {
    const s = stepNow();
    if (!s) return;
    if (s.done && s.done()) { next(); return; }
    const p = bubble.querySelector('p');
    if (s.ready && p) p.textContent = s.ready() ? s.say : s.wait;
  };

  Guide.frame = () => {
    const s = stepNow();
    if (!s) return;
    // Point at a control if one is on screen, otherwise at the thing in the world.
    const uiSel = s.ui ? s.ui() : null;
    const el = uiSel ? document.querySelector(uiSel) : null;
    if (el !== spot) { clearSpot(); if (el) { el.classList.add('spot'); spot = el; } }
    const covered = !!UI.current();
    target = !el && !covered && s.world && (!s.ready || s.ready()) ? s.world() : null;
    if (target) {
      const P = OA.World.project(target.x, target.y, target.z);
      arrow.hidden = false;
      arrow.style.transform = 'translate(' + Math.round(P.x) + 'px,' + Math.round(P.y) + 'px)';
    } else arrow.hidden = true;
  };

  Guide.init = (fresh) => {
    const box = document.getElementById('ui');
    bubble = UI.make('<div id="rivet" hidden></div>');
    arrow = UI.make('<div id="arrow" hidden aria-hidden="true"><i></i></div>');
    box.appendChild(bubble);
    box.appendChild(arrow);
    if (S().tut < STEPS.length) render();
  };
})(window);
