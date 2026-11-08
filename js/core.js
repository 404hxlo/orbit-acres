// Orbit Acres: shared namespace, small helpers and the event bus.
(function (root) {
  const OA = (root.OA = root.OA || {});
  OA.VERSION = '1.3.1';
  OA.SAVE_VERSION = 1;

  const listeners = {};
  OA.on = (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); return fn; };
  OA.off = (name, fn) => { listeners[name] = (listeners[name] || []).filter((f) => f !== fn); };
  OA.emit = (name, data) => { (listeners[name] || []).slice().forEach((fn) => fn(data)); };

  OA.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  OA.lerp = (a, b, t) => a + (b - a) * t;
  OA.damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  OA.rand = (a, b) => a + Math.random() * (b - a);
  OA.randi = (a, b) => Math.floor(OA.rand(a, b + 1));
  OA.pick = (list) => list[Math.floor(Math.random() * list.length)];
  OA.shuffle = (list) => {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  // Repeatable noise for art, so a colony looks the same on every visit.
  OA.hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  OA.noise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = OA.hash(ix, iy), b = OA.hash(ix + 1, iy);
    const c = OA.hash(ix, iy + 1), d = OA.hash(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  OA.fbm = (x, y, n = 4) => {
    let v = 0, amp = 0.5, f = 1;
    for (let i = 0; i < n; i++) { v += OA.noise(x * f, y * f) * amp; amp *= 0.5; f *= 2.03; }
    return v;
  };

  OA.fmt = (n) => {
    n = Math.floor(n);
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1e5) return Math.round(n / 1e3) + 'k';
    return n.toLocaleString('en-US');
  };
  OA.fmtTime = (ms) => {
    let s = Math.max(0, Math.ceil(ms / 1000));
    if (s < 60) return s + 's';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    s = s % 60;
    if (h) return m ? h + 'h ' + m + 'm' : h + 'h';
    return s ? m + 'm ' + s + 's' : m + 'm';
  };
  OA.plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
})(typeof window !== 'undefined' ? window : globalThis);
