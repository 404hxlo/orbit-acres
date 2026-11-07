// Orbit Acres: moving a colony between devices.
// A colony travels two ways. A short code is typed on a second device that is
// open at the same moment, and the colony goes straight across. A long code or
// link can be pasted anywhere and loaded later.
(function (root) {
  const OA = root.OA;
  const Sim = OA.Sim;
  const T = (OA.Transfer = {});

  const HEAD = 'OA1';
  const MAX_CODE = 200000;
  const PEER_LIB = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no look-alikes such as O and 0
  const WAIT_MS = 5 * 60000;
  const CONNECT_MS = 25000;

  const has = (map, key) => Object.prototype.hasOwnProperty.call(map, key);
  const need = (ok, why) => { if (!ok) throw new Error(why || 'bad'); };

  // ---- Turning a colony into text and back ----
  const toB64 = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return root.btoa(s).replace(/=+$/, '');
  };
  const fromB64 = (text) => {
    const s = root.atob(text);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  };
  const pipe = async (bytes, stream) => {
    const w = stream.writable.getWriter();
    w.write(bytes).catch(() => {});
    w.close().catch(() => {});
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
  };
  // A short fingerprint, so a code that lost a few characters is caught.
  const print = (text) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(36);
  };

  T.encode = async () => {
    const data = JSON.parse(Sim.save());
    // These rebuild themselves, so leaving them out keeps the code shorter.
    data.gazette = null;
    data.mine = null;
    data.meteors = [];
    data.seen = {};
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    if (root.CompressionStream) {
      return HEAD + 'z' + print(json) + '.' + toB64(await pipe(bytes, new root.CompressionStream('deflate-raw')));
    }
    return HEAD + 'p' + print(json) + '.' + toB64(bytes);
  };

  // Accepts a bare code or a whole link, with any line breaks a chat app added.
  const pull = (text) => {
    let t = String(text || '').trim();
    const at = t.indexOf('#colony=');
    if (at >= 0) t = t.slice(at + 8);
    try { t = decodeURIComponent(t); } catch (e) { /* not URL-encoded */ }
    return t.replace(/\s+/g, '');
  };

  T.decode = async (text) => {
    const code = pull(text);
    need(code.length <= MAX_CODE);
    const m = /^OA1([zp])([0-9a-z]+)\.([A-Za-z0-9+/]+)$/.exec(code);
    need(m);
    let bytes = fromB64(m[3]);
    if (m[1] === 'z') {
      need(root.DecompressionStream, 'old');
      bytes = await pipe(bytes, new root.DecompressionStream('deflate-raw'));
    }
    const json = new TextDecoder().decode(bytes);
    need(print(json) === m[2]);
    return T.check(JSON.parse(json));
  };

  // A code may have come from anyone, so check it thoroughly before it replaces a colony.
  const SAFE = /^[A-Za-z0-9_:.,+-]{0,60}$/;
  const scan = (v, depth) => {
    need(depth <= 12);
    if (typeof v === 'string') { need(SAFE.test(v)); return; }
    if (typeof v === 'number') { need(Number.isFinite(v)); return; }
    if (v && typeof v === 'object') {
      Object.keys(v).forEach((k) => {
        need(SAFE.test(k) && k !== '__proto__' && k !== 'constructor' && k !== 'prototype');
        scan(v[k], depth + 1);
      });
    }
  };
  const isItem = (id) => need(has(OA.ITEMS, id));
  const isFolk = (id) => need(OA.FOLK.some((f) => f.id === id));
  T.check = (d) => {
    need(d && typeof d === 'object' && !Array.isArray(d));
    need(Number.isFinite(d.v));
    need(d.v <= OA.SAVE_VERSION, 'newer');
    const rest = Object.assign({}, d);
    delete rest.name;
    scan(rest, 0);
    need(Array.isArray(d.objs) && Array.isArray(d.orders) && Array.isArray(d.rocks));
    need(Number.isFinite(d.level) && d.level >= 1 && Number.isFinite(d.credits) && Number.isFinite(d.dust));
    need(d.inv && d.sectors && d.stats && d.storeLv && d.daily && d.settings && d.goals);
    need(d.shop && Array.isArray(d.shop.slots) && d.town && Array.isArray(d.town.visitors) && d.rocket);
    d.objs.forEach((o) => {
      need(o && has(OA.BUILD, o.type) && Number.isInteger(o.x) && Number.isInteger(o.z) && Number.isInteger(o.id));
      if (o.type === 'field' && o.crop) isItem(o.crop);
      if (o.type === 'tree') need(OA.TREES.some((t) => t.id === o.kind));
      if (o.type === 'decor') need(OA.DECOR.some((t) => t.id === o.kind));
      if (o.type === 'pen') need(OA.CRITTERS.some((t) => t.id === o.kind) && Array.isArray(o.critters));
      if (o.type === 'factory') {
        need(has(OA.FACTORIES, o.kind) && Array.isArray(o.queue) && Array.isArray(o.done));
        o.queue.forEach((q) => need(has(OA.RECIPES, q.r)));
        o.done.forEach((r) => need(has(OA.RECIPES, r)));
      }
    });
    Object.keys(d.inv).forEach(isItem);
    d.orders.forEach((o) => { if (!o.wait) { isFolk(o.who); o.items.forEach((it) => isItem(it.id)); } });
    d.shop.slots.forEach((s) => { if (s) { isItem(s.item); isFolk(s.who); } });
    (d.rocket.crates || []).forEach((c) => isItem(c.item));
    d.town.visitors.forEach((v) => { isFolk(v.who); v.items.forEach((it) => isItem(it.id)); });
    d.name = String(d.name || 'New Haven').replace(/[<>&"']/g, '').slice(0, 22) || 'New Haven';
    d.gazette = null;
    d.mine = null;
    d.meteors = [];
    d.seen = d.seen || {};
    return d;
  };

  T.why = (e) => {
    const m = e && e.message;
    if (m === 'newer') return 'That colony came from a newer version of the game. Refresh this page and try again.';
    if (m === 'old') return 'This browser is too old to open that code. Update it and try again.';
    return 'That code did not work. Copy the whole thing and try again.';
  };

  // ---- Replacing the colony on this device ----
  T.apply = async (data) => {
    const S = OA.Store;
    S.writeBackup(Sim.save());
    // Marked as just played, so it beats any older cloud save on the next start.
    data.lastSeen = OA.now();
    const text = JSON.stringify(data);
    S.noSave = true;
    S.writeLocal(text);
    await S.writeCloud(text);
    root.location.reload();
  };
  T.undo = () => {
    const text = OA.Store.readBackup();
    if (text) T.apply(JSON.parse(text));
  };

  // ---- Sharing as a link ----
  T.liveOK = () => !root.claude;
  T.linkOK = () => !root.claude && /^https?:/.test(root.location.protocol);
  T.share = (code) => (T.linkOK() ? root.location.origin + root.location.pathname + '#colony=' + code : code);

  // ---- Short codes: a direct connection between two open games ----
  const loadPeer = () => new Promise((resolve, reject) => {
    if (root.Peer) { resolve(); return; }
    const s = document.createElement('script');
    s.src = PEER_LIB;
    s.onload = () => resolve();
    s.onerror = () => { s.remove(); reject(new Error('no-peer-lib')); };
    document.head.appendChild(s);
  });
  const newCode = () => {
    const nums = root.crypto.getRandomValues(new Uint8Array(6));
    return Array.from(nums, (n) => LETTERS[n % LETTERS.length]).join('');
  };
  const peerId = (code) => 'orbit-acres-' + code.toLowerCase();
  T.cleanCode = (text) => String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  T.isShort = (text) => T.cleanCode(text).length <= 8 && !String(text).includes('#colony=');

  // cb: {code(code), sent(), fail(reason)}. Resolves to a function that cancels.
  T.send = async (cb) => {
    let peer = null, timer = 0, tries = 0, over = false;
    const stop = () => {
      over = true;
      clearTimeout(timer);
      if (peer) { try { peer.destroy(); } catch (e) { /* already closed */ } peer = null; }
    };
    try {
      await loadPeer();
    } catch (e) { cb.fail('no-peer-lib'); return stop; }
    const payload = await T.encode();
    const start = () => {
      if (over) return;
      const code = newCode();
      const p = new root.Peer(peerId(code));
      peer = p;
      p.on('open', () => {
        if (over) return;
        cb.code(code);
        timer = setTimeout(() => { stop(); cb.fail('expired'); }, WAIT_MS);
      });
      p.on('connection', (conn) => {
        conn.on('open', () => conn.send(payload));
        conn.on('data', (d) => { if (d === 'got-it' && !over) { stop(); cb.sent(); } });
      });
      p.on('error', (e) => {
        if (over) return;
        if (e.type === 'unavailable-id' && tries++ < 3) { p.destroy(); start(); return; }
        stop();
        cb.fail(e.type);
      });
    };
    start();
    return stop;
  };

  // cb: {got(colony), fail(reason)}. Resolves to a function that cancels.
  T.receive = async (text, cb) => {
    let peer = null, timer = 0, over = false;
    const stop = () => {
      over = true;
      clearTimeout(timer);
      if (peer) { try { peer.destroy(); } catch (e) { /* already closed */ } peer = null; }
    };
    const fail = (why) => { if (over) return; stop(); cb.fail(why); };
    try {
      await loadPeer();
    } catch (e) { cb.fail('no-peer-lib'); return stop; }
    if (over) return stop;
    peer = new root.Peer();
    timer = setTimeout(() => fail('timeout'), CONNECT_MS);
    peer.on('error', (e) => fail(e.type));
    peer.on('open', () => {
      if (over) return;
      const conn = peer.connect(peerId(T.cleanCode(text)), { reliable: true });
      conn.on('error', () => fail('connection'));
      conn.on('data', async (msg) => {
        if (over) return;
        clearTimeout(timer);
        try {
          const data = await T.decode(msg);
          conn.send('got-it');
          setTimeout(stop, 800);
          cb.got(data);
        } catch (e) { fail('bad'); }
      });
    });
    return stop;
  };

  T.failText = (why) => ({
    'peer-unavailable': 'No device is waiting with that code. Check it and try again.',
    'no-peer-lib': 'Could not reach the connection service. Use the copy option instead.',
    expired: 'That code ran out. Get a new one when you are ready.',
    timeout: 'That took too long. Try again, or use the copy option.',
    bad: 'That colony did not arrive in one piece. Try again.',
  }[why] || 'Could not connect the two devices. Try again, or use the copy option.');
})(typeof window !== 'undefined' ? window : globalThis);
