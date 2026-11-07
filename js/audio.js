// Orbit Acres: every sound is synthesized, so there are no audio files to load.
(function (root) {
  const OA = root.OA;
  const Au = (OA.Audio = {});
  let ctx = null, master = null, musicBus = null, musicTimer = null;
  const on = () => { const S = OA.Sim.state(); return !S || S.settings.sound; };

  Au.unlock = () => {
    if (!ctx) {
      const C = root.AudioContext || root.webkitAudioContext;
      if (!C) return;
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.2;
      musicBus.connect(master);
      Au.music();
    }
    if (ctx.state === 'suspended') ctx.resume();
  };

  const tone = (freq, dur, o = {}) => {
    if (!ctx) return;
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.vol || 0.2, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(g);
    g.connect(o.bus || master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };
  const noise = (dur, o = {}) => {
    if (!ctx) return;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.value = o.freq || 1800;
    const g = ctx.createGain();
    g.gain.value = o.vol || 0.14;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(ctx.currentTime + (o.delay || 0));
  };
  const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  let step = 0;

  const S = {
    tap() { tone(740, 0.06, { type: 'triangle', vol: 0.09 }); },
    open() { tone(420, 0.1, { to: 720, type: 'triangle', vol: 0.11 }); },
    close() { tone(620, 0.09, { to: 380, type: 'triangle', vol: 0.09 }); },
    plant() { noise(0.06, { freq: 900, vol: 0.09 }); tone(330, 0.09, { type: 'sine', vol: 0.1 }); },
    harvest() { step = (step + 1) % notes.length; tone(notes[step], 0.15, { type: 'triangle', vol: 0.16 }); noise(0.05, { freq: 3000, filter: 'highpass', vol: 0.05 }); },
    collect() { tone(880, 0.1, { vol: 0.15 }); tone(1320, 0.14, { vol: 0.12, delay: 0.06 }); },
    coin() { tone(1200, 0.07, { type: 'square', vol: 0.05 }); tone(1800, 0.2, { type: 'square', vol: 0.05, delay: 0.06 }); },
    feed() { tone(280, 0.12, { to: 420, type: 'triangle', vol: 0.14 }); },
    critter() { tone(780, 0.12, { to: 1250, type: 'sine', vol: 0.11 }); tone(1100, 0.1, { to: 760, type: 'sine', vol: 0.09, delay: 0.1 }); },
    bad() { tone(220, 0.16, { type: 'sawtooth', vol: 0.06, to: 160 }); },
    build() { noise(0.14, { freq: 500, vol: 0.2 }); tone(180, 0.2, { to: 90, vol: 0.2 }); tone(660, 0.14, { vol: 0.1, delay: 0.12 }); },
    machine() { tone(200, 0.14, { type: 'square', vol: 0.05, to: 300 }); },
    whoosh() { noise(0.6, { freq: 1200, vol: 0.16 }); tone(240, 0.6, { to: 900, vol: 0.05 }); },
    level() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.34, { type: 'triangle', vol: 0.16, delay: i * 0.09 })); },
    splash() { noise(0.25, { freq: 1600, vol: 0.14 }); },
    dig() { noise(0.12, { freq: 700, vol: 0.22 }); tone(120, 0.1, { vol: 0.16 }); },
    gem() { [1320, 1760, 2093].forEach((f, i) => tone(f, 0.2, { vol: 0.09, delay: i * 0.07 })); },
  };
  Au.play = (name) => { if (ctx && on() && S[name]) S[name](); };

  // A slow, gentle loop: soft bell notes over a held chord.
  const SCALE = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
  const CHORDS = [[130.81, 196, 261.63], [110, 164.81, 246.94], [146.83, 220, 293.66], [98, 146.83, 246.94]];
  let bar = 0;
  const musicTick = () => {
    const st = OA.Sim.state();
    if (!ctx || !st || !st.settings.music || document.hidden) return;
    const chord = CHORDS[bar % CHORDS.length];
    chord.forEach((f) => tone(f, 6, { type: 'sine', vol: 0.09, bus: musicBus }));
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = SCALE[Math.floor(Math.random() * SCALE.length)] * 2;
      tone(f, 1.8, { type: 'sine', vol: 0.1, delay: Math.random() * 5, bus: musicBus });
    }
    bar++;
  };
  Au.music = () => {
    if (musicTimer) return;
    musicTick();
    musicTimer = setInterval(musicTick, 6000);
  };
})(window);
