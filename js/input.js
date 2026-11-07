// Orbit Acres: touch, mouse and keyboard. One finger pans, taps and paints across
// plots. Two fingers zoom. Holding on a building picks it up.
(function (root) {
  const OA = root.OA;
  const Sim = OA.Sim;
  const UI = OA.UI;
  const W = OA.World;
  const Input = (OA.Input = {});
  const pts = new Map();
  let mode = 'idle'; // idle | maybe | pan | paint | pinch | place
  let startX = 0, startY = 0, lastX = 0, lastY = 0, moved = 0;
  let downHit = null, holdTimer = 0, pinchD = 0, lastT = 0, vx = 0, vz = 0;
  let painted = new Set();
  let paintTool = null;
  let dragIcon = null;

  const canvasPos = (e) => ({ x: e.clientX, y: e.clientY });

  // Drag across plots with a seed or the harvester.
  const paintAt = (x, y) => {
    const tile = W.tileAt(x, y);
    if (!tile) return;
    const o = Sim.objAt(tile.x, tile.z);
    if (!o || o.type !== 'field' || painted.has(o.id)) return;
    if (paintTool === 'harvest') {
      if (Sim.fieldReady(o)) {
        painted.add(o.id);
        const r = Sim.harvest(o.id);
        if (!r.ok) { UI.fail(r); paintTool = null; }
      }
    } else if (UI.tool && UI.tool.type === 'seed' && !o.crop) {
      painted.add(o.id);
      UI.plant(o.id);
    }
  };

  const onDown = (e) => {
    if (e.target !== Input.canvas) return;
    OA.Audio.unlock();
    pts.set(e.pointerId, canvasPos(e));
    try { Input.canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    if (pts.size === 2) {
      clearTimeout(holdTimer);
      const [a, b] = [...pts.values()];
      pinchD = Math.hypot(a.x - b.x, a.y - b.y);
      mode = 'pinch';
      return;
    }
    const p = canvasPos(e);
    startX = lastX = p.x; startY = lastY = p.y;
    moved = 0; vx = vz = 0; lastT = performance.now();
    if (UI.placing) {
      mode = 'place';
      UI.placing.locked = true;
      const t = W.tileAt(p.x, p.y);
      if (t) UI.placeAt(t);
      return;
    }
    downHit = W.pick(p.x, p.y);
    painted = new Set();
    paintTool = null;
    if (downHit.obj && downHit.obj.type === 'field') {
      const f = downHit.obj;
      if (Sim.fieldReady(f)) { paintTool = 'harvest'; mode = 'paint'; UI.closeTray(); paintAt(p.x, p.y); return; }
      if (!f.crop && UI.tool && UI.tool.type === 'seed') { paintTool = 'seed'; mode = 'paint'; paintAt(p.x, p.y); return; }
    }
    mode = 'maybe';
    if (downHit.obj) {
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        if (mode === 'maybe' && moved < 8) { mode = 'idle'; UI.hold(downHit); }
      }, 550);
    }
  };

  const onMove = (e) => {
    if (dragIcon) {
      dragIcon.style.transform = 'translate(' + (e.clientX - 26) + 'px,' + (e.clientY - 40) + 'px)';
      if (e.target !== dragIcon) paintAt(e.clientX, e.clientY);
      return;
    }
    if (!pts.has(e.pointerId)) {
      if (UI.placing && !UI.placing.locked && e.pointerType === 'mouse' && e.target === Input.canvas) {
        const t = W.tileAt(e.clientX, e.clientY);
        if (t) UI.placeAt(t);
      }
      return;
    }
    pts.set(e.pointerId, canvasPos(e));
    if (mode === 'pinch' && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchD > 0) W.zoomBy(pinchD / d);
      pinchD = d;
      return;
    }
    const p = canvasPos(e);
    const dx = p.x - lastX, dy = p.y - lastY;
    moved = Math.max(moved, Math.hypot(p.x - startX, p.y - startY));
    if (mode === 'place') {
      const t = W.tileAt(p.x, p.y);
      if (t) UI.placeAt(t);
    } else if (mode === 'paint') {
      // Sample along the stroke so fast swipes do not skip plots.
      const steps = Math.ceil(Math.hypot(dx, dy) / 16);
      for (let i = 1; i <= steps; i++) paintAt(lastX + (dx * i) / steps, lastY + (dy * i) / steps);
    } else if (mode === 'maybe' && moved > 8) {
      mode = 'pan';
      clearTimeout(holdTimer);
    }
    if (mode === 'pan') {
      const m = W.panBy(dx, dy);
      const t = performance.now();
      const el = Math.max(1, t - lastT) / 1000;
      vx = OA.lerp(vx, m.mx / el, 0.4);
      vz = OA.lerp(vz, m.mz / el, 0.4);
      lastT = t;
    }
    lastX = p.x; lastY = p.y;
  };

  const onUp = (e) => {
    if (dragIcon) { dragIcon.remove(); dragIcon = null; }
    const had = pts.delete(e.pointerId);
    clearTimeout(holdTimer);
    if (!had) return;
    if (mode === 'pinch') { if (pts.size < 2) mode = pts.size ? 'pan' : 'idle'; return; }
    if (mode === 'maybe' && moved <= 8) {
      if (UI.moveMode) {
        UI.moveMode = false;
        if (downHit && downHit.obj) UI.startMove(downHit.obj.id);
      } else UI.tap(downHit);
    } else if (mode === 'pan') {
      if (performance.now() - lastT < 90) W.fling(OA.clamp(vx, -45, 45), OA.clamp(vz, -45, 45));
    }
    mode = 'idle';
    paintTool = null;
  };

  // Press a seed in the tray and drag it out over the plots.
  Input.trayDown = (crop, e) => {
    const startY2 = e.clientY;
    const startX2 = e.clientX;
    let live = false;
    const move = (ev) => {
      if (live) return;
      if (startY2 - ev.clientY > 24 || Math.abs(ev.clientX - startX2) > 60 && startY2 - ev.clientY > 8) {
        live = true;
        UI.pickSeed(crop);
        painted = new Set();
        paintTool = 'seed';
        dragIcon = UI.make(OA.Icons.item(crop, 52, 'dragging'));
        dragIcon.style.transform = 'translate(' + (ev.clientX - 26) + 'px,' + (ev.clientY - 40) + 'px)';
        document.getElementById('fx').appendChild(dragIcon);
      }
    };
    const up = () => {
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', up);
      root.removeEventListener('pointercancel', up);
    };
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
  };

  const onWheel = (e) => {
    e.preventDefault();
    const k = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    W.zoomBy(Math.exp(OA.clamp(k, -200, 200) * 0.0016));
  };

  const keys = new Set();
  const onKey = (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === '+' || e.key === '=') W.zoomBy(0.88);
    if (e.key === '-' || e.key === '_') W.zoomBy(1.14);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { keys.add(e.key); e.preventDefault(); }
  };
  const onKeyUp = (e) => keys.delete(e.key);
  const keyLoop = () => {
    if (keys.size) {
      const dx = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
      const dy = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
      W.panBy(dx * 10, dy * 10);
    }
    requestAnimationFrame(keyLoop);
  };

  Input.init = () => {
    Input.canvas = document.getElementById('view');
    Input.canvas.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);
    Input.canvas.addEventListener('wheel', onWheel, { passive: false });
    Input.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    root.addEventListener('keydown', onKey);
    root.addEventListener('keyup', onKeyUp);
    keyLoop();
  };
})(window);
