// Fully procedural sound: city hum, rushing wind, grapple shots, landings and pickup chimes.
// Nothing is downloaded; everything is synthesised with Web Audio.
const STORE_KEY = 'flightlog.sound';

export function createAudio() {
  let ctx, master, engineGain, engineA, engineB, engineFilter, windGain, windFilter;
  let enabled = true;
  try { enabled = localStorage.getItem(STORE_KEY) !== 'off'; } catch { /* default on */ }

  function noiseBuffer() {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.04; d[i] = last * 3.2; }
    return buf;
  }

  function start() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.55 : 0;
    master.connect(ctx.destination);

    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass'; engineFilter.frequency.value = 340; engineFilter.Q.value = 2;
    engineGain = ctx.createGain(); engineGain.gain.value = 0.012;
    engineA = ctx.createOscillator(); engineA.type = 'sawtooth'; engineA.frequency.value = 52;
    engineB = ctx.createOscillator(); engineB.type = 'square'; engineB.frequency.value = 78.5;
    const bGain = ctx.createGain(); bGain.gain.value = 0.35;
    engineA.connect(engineFilter); engineB.connect(bGain).connect(engineFilter);
    engineFilter.connect(engineGain).connect(master);
    engineA.start(); engineB.start();

    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuffer(); wind.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 600; windFilter.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0.05;
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();
  }

  function tone(freq, when, dur, type = 'sine', vol = 0.18) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(master);
    o.start(when); o.stop(when + dur + 0.05);
  }

  return {
    start,
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = on;
      try { localStorage.setItem(STORE_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
      if (ctx) { ctx.resume(); master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.1); }
    },
    /** Called each frame with speed 0..1 and whether the plane is boosting. */
    update(speed01) {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime;
      // A low, steady city hum; the wind does the talking as speed builds.
      engineFilter.frequency.setTargetAtTime(160, t, 0.5);
      engineGain.gain.setTargetAtTime(0.012, t, 0.5);
      windGain.gain.setTargetAtTime(0.02 + speed01 * speed01 * 0.3, t, 0.15);
      windFilter.frequency.setTargetAtTime(350 + speed01 * 1300, t, 0.15);
    },
    chime(step = 0) {
      if (!ctx || !enabled) return;
      const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
      const t = ctx.currentTime, base = scale[step % scale.length];
      tone(base, t, 0.5); tone(base * 1.5, t + 0.07, 0.6, 'sine', 0.12); tone(base * 2, t + 0.14, 0.8, 'triangle', 0.06);
    },
    fanfare() {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, t + i * 0.11, 0.9, 'triangle', 0.12));
    },
    /** The grapple line firing. */
    shot() {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer();
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
      f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.16);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      src.connect(f).connect(g).connect(master);
      src.start(t); src.stop(t + 0.25);
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.12);
      og.gain.setValueAtTime(0.05, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(og).connect(master); o.start(t); o.stop(t + 0.16);
    },
    /** Boots hitting a rooftop. */
    thud() {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.2);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.32);
    },
    whoosh() {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer();
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.5);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      src.connect(f).connect(g).connect(master);
      src.start(t); src.stop(t + 1);
      tone(392, t + 0.1, 0.7, 'sine', 0.08); tone(587.33, t + 0.2, 0.9, 'sine', 0.07);
    },
  };
}
