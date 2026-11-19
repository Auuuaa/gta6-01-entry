// Synthesized WebAudio sound: no audio assets. Engine hum, siren, shots, punches,
// pickups, crashes and a tiny bass loop. Everything is guarded so a missing AudioContext
// (headless screenshots) never throws.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null, musicTimer = null;
  let enabled = true;
  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 400;
      engineOsc.connect(filt); filt.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    } catch { ctx = null; }
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!enabled || !ensure()) return;
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
    } catch { /* ignore */ }
  }
  function noise(dur, vol, low) {
    if (!enabled || !ensure()) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low || 1200;
      const g = ctx.createGain(); g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(master); src.start();
    } catch { /* ignore */ }
  }
  let sirenOn = false, sirenPhase = 0;
  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    setEngine(speed01, driving) {
      if (!ensure()) return;
      try {
        engineGain.gain.value = driving ? 0.05 + speed01 * 0.06 : 0;
        engineOsc.frequency.value = 45 + speed01 * 140;
      } catch { /* ignore */ }
    },
    setSiren(on) {
      sirenOn = on;
      if (on) tone(700, 0.4, 'sine', 0.05, 950);
    },
    sirenTick(dt) {
      if (!sirenOn || !ensure()) return;
      sirenPhase += dt;
      if (sirenPhase > 0.45) { sirenPhase = 0; tone(720, 0.42, 'sine', 0.045, 980); }
    },
    shoot() { noise(0.12, 0.4, 2500); tone(180, 0.08, 'square', 0.15, 60); },
    punch() { noise(0.08, 0.25, 500); },
    crash() { noise(0.25, 0.35, 700); },
    pickup() { tone(660, 0.1, 'sine', 0.2); setTimeout(() => tone(990, 0.15, 'sine', 0.2), 90); },
    cash() { tone(880, 0.08, 'sine', 0.18); setTimeout(() => tone(1320, 0.12, 'sine', 0.18), 80); },
    busted() { tone(440, 0.5, 'sawtooth', 0.2, 220); },
    mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.2), i * 110)); },
    toggle() { enabled = !enabled; return enabled; },
    startMusic() {
      if (musicTimer || !ensure()) return;
      const bass = [55, 55, 65.4, 49];
      let i = 0;
      musicTimer = setInterval(() => {
        if (!enabled) return;
        tone(bass[i % 4], 0.42, 'triangle', 0.12);
        if (i % 2 === 0) tone(bass[i % 4] * 2, 0.2, 'sine', 0.05);
        i++;
      }, 460);
    },
  };
}
