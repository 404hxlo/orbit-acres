// Orbit Acres: renders every model once into a sheet of die-cut stickers.
// The same sheet is used by the screens and by the bubbles floating in the world.
(function (root) {
  const OA = root.OA;
  const G = OA.Gfx;
  const T = root.THREE;
  const Icons = (OA.Icons = {});
  const CELL = 128, COLS = 16;
  const cells = {};
  let count = 0;

  Icons.has = (key) => key in cells;
  Icons.uv = (key) => {
    const c = cells[key];
    if (c === undefined) return null;
    const x = c % COLS, y = Math.floor(c / COLS);
    return [x / COLS, 1 - (y + 1) / COLS, 1 / COLS, 1 / COLS];
  };
  Icons.html = (key, size, extra) => {
    const c = cells[key];
    if (c === undefined) return '';
    const x = c % COLS, y = Math.floor(c / COLS);
    return '<i class="ic' + (extra ? ' ' + extra : '') + '" style="--ix:' + x + ';--iy:' + y + (size ? ';--is:' + size + 'px' : '') + '"></i>';
  };
  Icons.item = (id, size, extra) => Icons.html('item:' + id, size, extra);
  Icons.style = (key) => {
    const c = cells[key];
    return c === undefined ? '' : '--ix:' + (c % COLS) + ';--iy:' + Math.floor(c / COLS);
  };

  const FRONT = new T.Vector3(0.3, 0.42, 1).normalize();
  const CORNER = new T.Vector3(1, 0.8, 1).normalize();
  const SIDE = new T.Vector3(1, 0.32, 0.6).normalize();

  Icons.build = async (renderer, progress) => {
    const M = G.M;
    const jobs = [];
    const job = (key, make, dir, dispose = false, zoom = 1) => jobs.push({ key, make, dir, dispose, zoom });

    Object.keys(OA.ITEMS).forEach((id) => job('item:' + id, () => G.itemModel(id), FRONT, true));
    const coinModel = (fn) => () => { const m = new G.Mesher(); G.ART[fn](m); return m.build(); };
    job('coin', coinModel('coin'), new T.Vector3(0.15, 0.2, 1).normalize(), true);
    job('stardust', coinModel('stardust'), FRONT, true);
    job('xpstar', coinModel('xpstar'), new T.Vector3(0.1, 0.1, 1).normalize(), true);
    job('harvester', coinModel('harvester'), FRONT, true);
    OA.CRITTERS.forEach((c) => job('critter:' + c.id, () => M.critter(c.id), SIDE));
    OA.FOLK.forEach((f) => job('folk:' + f.id, () => M.folk(f.id), SIDE));
    job('rivet', () => M.rivet(), SIDE);
    Object.keys(OA.FACTORIES).forEach((k) => job('factory:' + k, () => M.factory(k), CORNER));
    OA.DECOR.forEach((d) => job('decor:' + d.id, () => M.decor(d.id), CORNER));
    OA.TREES.forEach((t) => job('tree:' + t.id, () => M.tree(t.id, 'fruit'), CORNER));
    OA.CRITTERS.forEach((c) => job('pen:' + c.id, () => M.pen(c.id), CORNER));
    job('field', () => M.crop('wheat', 3), CORNER);
    job('silo', () => M.silo(), CORNER);
    job('bay', () => M.bay(), CORNER);
    job('post', () => M.post(), CORNER);
    job('board', () => M.board(), SIDE);
    job('gazette', () => M.gazette(), CORNER);
    job('rocket', () => M.rocket(), CORNER);
    job('mine', () => M.mine(), CORNER);
    job('dock', () => M.dock(), CORNER);
    job('crate', () => M.crate(), CORNER);
    OA.TOWN_LOTS.forEach((l) => job('lot:' + l.id, () => M.lot(l.id), CORNER));

    const atlas = document.createElement('canvas');
    atlas.width = atlas.height = CELL * COLS;
    const ctx = atlas.getContext('2d');

    // The white speech bubble used in the world.
    const bx = 0, by = 0;
    ctx.save();
    ctx.translate(bx + CELL / 2, by + CELL / 2);
    ctx.shadowColor = 'rgba(20,8,60,.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -4, 52, 0, 7);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.moveTo(-14, 40); ctx.lineTo(0, 60); ctx.lineTo(14, 40);
    ctx.fill();
    ctx.restore();
    cells.bubble = count++;

    const SS = CELL * 2;
    const rt = new T.WebGLRenderTarget(SS, SS, { format: T.RGBAFormat, type: T.UnsignedByteType, minFilter: T.LinearFilter, magFilter: T.LinearFilter });
    const scene = new T.Scene();
    const hemi = new T.HemisphereLight(0xffffff, 0x8f7fd0, 0.78);
    const dir = new T.DirectionalLight(0xfff4e6, 0.72);
    dir.position.set(-2, 4, 5);
    scene.add(hemi, dir);
    const cam = new T.PerspectiveCamera(16, 1, 0.1, 200);
    const buf = new Uint8Array(SS * SS * 4);
    const raw = document.createElement('canvas');
    raw.width = raw.height = SS;
    const rawx = raw.getContext('2d');
    const img = rawx.createImageData(SS, SS);
    const sil = document.createElement('canvas');
    sil.width = sil.height = CELL;
    const silx = sil.getContext('2d');
    const center = new T.Vector3();
    renderer.setClearColor(0x000000, 0);

    for (let j = 0; j < jobs.length; j++) {
      const a = jobs[j];
      const geo = a.make();
      geo.computeBoundingSphere();
      const mesh = new T.Mesh(geo, G.mat.icon);
      scene.add(mesh);
      center.copy(geo.boundingSphere.center);
      const r = geo.boundingSphere.radius || 1;
      const dist = (r / Math.sin((cam.fov * Math.PI) / 360)) * 1.02 * a.zoom;
      cam.position.copy(center).addScaledVector(a.dir, dist);
      cam.lookAt(center);
      cam.near = Math.max(0.1, dist - r * 2);
      cam.far = dist + r * 2;
      cam.updateProjectionMatrix();
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, SS, SS, buf);
      scene.remove(mesh);
      if (a.dispose) geo.dispose();

      for (let y = 0; y < SS; y++) {
        const from = (SS - 1 - y) * SS * 4;
        img.data.set(buf.subarray(from, from + SS * 4), y * SS * 4);
      }
      rawx.putImageData(img, 0, 0);

      // Die-cut sticker: a white border and a soft drop shadow around the shape.
      const c = count++;
      cells[a.key] = c;
      const ox = (c % COLS) * CELL, oy = Math.floor(c / COLS) * CELL;
      const P = 8; // padding for the border
      silx.globalCompositeOperation = 'source-over';
      silx.clearRect(0, 0, CELL, CELL);
      silx.drawImage(raw, P, P, CELL - P * 2, CELL - P * 2);
      silx.globalCompositeOperation = 'source-in';
      silx.fillStyle = '#fff';
      silx.fillRect(0, 0, CELL, CELL);
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, oy, CELL, CELL);
      ctx.clip();
      ctx.globalAlpha = 0.4;
      ctx.filter = 'none';
      ctx.save();
      ctx.shadowColor = '#160a44';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 4;
      ctx.drawImage(sil, ox, oy);
      ctx.restore();
      ctx.globalAlpha = 1;
      const t = 3.6;
      for (let k = 0; k < 14; k++) {
        const q = (k / 14) * Math.PI * 2;
        ctx.drawImage(sil, ox + Math.cos(q) * t, oy + Math.sin(q) * t);
      }
      ctx.drawImage(raw, ox + P, oy + P, CELL - P * 2, CELL - P * 2);
      ctx.restore();

      if (j % 10 === 9) {
        if (progress) progress(j / jobs.length);
        await new Promise((res) => setTimeout(res, 0));
      }
    }
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x0b0830, 1);
    rt.dispose();

    const tex = new T.CanvasTexture(atlas);
    tex.minFilter = T.LinearMipmapLinearFilter;
    tex.anisotropy = 4;
    await new Promise((res) => {
      const apply = (url) => {
        const style = document.createElement('style');
        style.textContent = '.ic{background-image:url(' + url + ')}';
        document.head.appendChild(style);
        res();
      };
      // Blob images are lighter, but some pages refuse them, so fall back to a data URL.
      atlas.toBlob((blob) => {
        const url = blob ? URL.createObjectURL(blob) : null;
        if (!url) { apply(atlas.toDataURL('image/png')); return; }
        const test = new Image();
        test.onload = () => apply(url);
        test.onerror = () => apply(atlas.toDataURL('image/png'));
        test.src = url;
      }, 'image/png');
    });
    Icons.texture = tex;
    return tex;
  };
})(typeof window !== 'undefined' ? window : globalThis);
