// Everything is synthesised with Web Audio: no audio files to load.
//
// Routing:  engine ─┐
//           ambience ┼─> master ─> compressor ─> speakers
//           sfx ─────┤
//           ui ──────┘
// Engine and ambience are continuous layers that are created once and only
// faded in and out, so starting and stopping them never clicks.

const ATMOSPHERE_TOP = 110;
const FADE = 0.06;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function vary(value, amount = 0.08) {
  return value * (1 + (Math.random() * 2 - 1) * amount);
}

export default class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.muted = false;
    this.volume = 0.5;
    this.buses = null;
    this.buffers = null;
    this.engine = null;
    this.ambience = null;
    this.isEnginePlaying = false;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.enabled = false;
      return;
    }
    try {
      this.muted = window.localStorage?.getItem("last-loop:muted") === "1";
    } catch (e) {}

    const ctx = this.ctx;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 12;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.25;
    compressor.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.volume;
    master.connect(compressor);

    const bus = (level) => {
      const gain = ctx.createGain();
      gain.gain.value = level;
      gain.connect(master);
      return gain;
    };
    this.buses = {
      master,
      engine: bus(0.9),
      ambience: bus(0.7),
      sfx: bus(0.9),
      ui: bus(0.6),
    };
    // Kept for older callers.
    this.masterGain = master;
    this.buffers = this.createNoiseBuffers();
  }

  // Generated once and reused by every sound.
  createNoiseBuffers() {
    const ctx = this.ctx;
    const length = ctx.sampleRate * 2;
    const make = (fill) => {
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      fill(buffer.getChannelData(0));
      return buffer;
    };
    return {
      white: make((data) => {
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }),
      // Brown noise: integrated white noise, all rumble and no hiss.
      brown: make((data) => {
        let last = 0;
        for (let i = 0; i < data.length; i++) {
          last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
          data[i] = last * 3.5;
        }
      }),
      // Sparse random pops: the crackle of an exhaust plume or burning air.
      crackle: make((data) => {
        for (let i = 0; i < data.length; i++) {
          data[i] = Math.random() < 0.0016 ? (Math.random() * 2 - 1) * (0.5 + Math.random() * 0.5) : 0;
        }
        for (let i = 1; i < data.length; i++) data[i] += data[i - 1] * 0.55;
      }),
    };
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  get ready() {
    return this.enabled && Boolean(this.ctx);
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.buses && !this.muted) {
      this.buses.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    try {
      window.localStorage?.setItem("last-loop:muted", this.muted ? "1" : "0");
    } catch (e) {}
    if (this.buses) {
      this.buses.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // Briefly lowers the continuous layers so a big moment cuts through.
  duck(amount = 0.35, hold = 0.8) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    [["engine", 0.9], ["ambience", 0.7]].forEach(([name, level]) => {
      const gain = this.buses[name].gain;
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(level * amount, now, 0.03);
      gain.setTargetAtTime(level, now + hold, 0.4);
    });
  }

  // ---------- building blocks ----------

  noise(type, { loop = false, offset = Math.random() * 1.5 } = {}) {
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffers[type];
    source.loop = loop;
    source._offset = loop ? offset : 0;
    return source;
  }

  filter(type, frequency, q = 0.7) {
    const node = this.ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    return node;
  }

  gain(value = 0) {
    const node = this.ctx.createGain();
    node.gain.value = value;
    return node;
  }

  chain(...nodes) {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    return nodes[nodes.length - 1];
  }

  // Short noise burst through a filter with an attack/decay envelope.
  burst({ type = "white", filterType = "lowpass", frequency = 1000, q = 0.7, level = 0.3, attack = 0.005, decay = 0.3, bus = "sfx", when = 0 }) {
    const t = this.ctx.currentTime + when;
    const source = this.noise(type);
    const env = this.gain(0);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(level, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    this.chain(source, this.filter(filterType, frequency, q), env, this.buses[bus]);
    source.start(t, Math.random() * 1.2);
    source.stop(t + attack + decay + 0.05);
    return source;
  }

  tone({ type = "sine", from, to = from, level = 0.2, attack = 0.005, decay = 0.2, bus = "sfx", when = 0 }) {
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const env = this.gain(0);
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(level, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    this.chain(osc, env, this.buses[bus]);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
    return osc;
  }

  softClipCurve(drive) {
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
    }
    return curve;
  }

  // ---------- interface ----------

  playClick() {
    if (!this.ready) return;
    this.tone({ type: "triangle", from: vary(1400, 0.04), to: 900, level: 0.09, decay: 0.05, bus: "ui" });
    this.burst({ filterType: "highpass", frequency: 3500, level: 0.05, decay: 0.025, bus: "ui" });
  }

  playHover() {
    if (!this.ready) return;
    this.tone({ from: vary(1800, 0.05), level: 0.025, decay: 0.03, bus: "ui" });
  }

  // A part locking into place: metallic clank with a low thud.
  playPlace() {
    if (!this.ready) return;
    this.tone({ type: "sine", from: vary(140), to: 70, level: 0.3, decay: 0.12 });
    this.burst({ filterType: "bandpass", frequency: vary(2400), q: 6, level: 0.18, decay: 0.09 });
    this.tone({ type: "square", from: vary(880, 0.03), level: 0.03, decay: 0.12, when: 0.01 });
  }

  playError() {
    if (!this.ready) return;
    this.tone({ type: "square", from: 220, to: 180, level: 0.07, decay: 0.12, bus: "ui" });
    this.tone({ type: "square", from: 180, to: 140, level: 0.07, decay: 0.16, bus: "ui", when: 0.13 });
  }

  // Bright rising chord over a warm pad.
  playSuccess() {
    if (!this.ready) return;
    this.duck(0.3, 1.4);
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.tone({ type: "triangle", from: freq, level: 0.13, attack: 0.02, decay: 0.9, when: i * 0.1 });
    });
    [261.63, 392.0].forEach((freq) => {
      this.tone({ type: "sine", from: freq, level: 0.1, attack: 0.2, decay: 1.6, when: 0.3 });
    });
  }

  // ---------- one-shot flight sounds ----------

  playExplosion() {
    if (!this.ready) return;
    this.duck(0.15, 1.6);
    this.tone({ from: 90, to: 25, level: 0.8, attack: 0.005, decay: 1.1 });
    this.burst({ type: "brown", frequency: 900, level: 0.9, attack: 0.004, decay: 1.8 });
    this.burst({ frequency: vary(2500), level: 0.35, attack: 0.002, decay: 0.35 });
    // Debris crackle after the blast.
    const t = this.ctx.currentTime;
    const crackle = this.noise("crackle");
    const env = this.gain(0);
    env.gain.setValueAtTime(0.0001, t + 0.1);
    env.gain.exponentialRampToValueAtTime(0.6, t + 0.2);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    this.chain(crackle, this.filter("highpass", 900), env, this.buses.sfx);
    crackle.start(t + 0.1);
    crackle.stop(t + 2.5);
  }

  // A deep thump and a crackle when the engines light on the pad.
  playIgnition() {
    if (!this.ready) return;
    this.tone({ from: 75, to: 28, level: 0.7, attack: 0.01, decay: 0.8 });
    this.burst({ type: "brown", frequency: 600, level: 0.6, attack: 0.02, decay: 1.2 });
    this.burst({ filterType: "bandpass", frequency: 1800, q: 1.5, level: 0.2, decay: 0.5 });
  }

  // Double crack of the shock wave, then a low rumble.
  playSonicBoom() {
    if (!this.ready) return;
    this.burst({ type: "brown", frequency: 500, level: 0.8, attack: 0.002, decay: 0.5 });
    this.burst({ type: "brown", frequency: 450, level: 0.6, attack: 0.002, decay: 0.6, when: 0.12 });
    this.tone({ from: 60, to: 35, level: 0.4, decay: 0.7 });
  }

  playAtmosphereWhoosh(intensity) {
    if (!this.ready) return;
    const strength = clamp(intensity, 0, 3);
    const t = this.ctx.currentTime;
    const source = this.noise("white");
    const band = this.filter("bandpass", 400, 1.2);
    band.frequency.setValueAtTime(300, t);
    band.frequency.exponentialRampToValueAtTime(900 + strength * 600, t + 0.35);
    band.frequency.exponentialRampToValueAtTime(250, t + 0.9);
    const env = this.gain(0);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(clamp(strength * 0.12, 0.02, 0.3), t + 0.25);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    this.chain(source, band, env, this.buses.sfx);
    source.start(t, Math.random());
    source.stop(t + 1);
  }

  // Radio squelch before Mission Control speaks: a click, a short hiss and a
  // two-tone beep.
  playRadio() {
    if (!this.ready) return;
    this.burst({ filterType: "bandpass", frequency: 2600, q: 1.2, level: 0.08, attack: 0.002, decay: 0.12, bus: "ui" });
    this.tone({ type: "sine", from: 1400, level: 0.05, attack: 0.004, decay: 0.06, bus: "ui", when: 0.02 });
    this.tone({ type: "sine", from: 1900, level: 0.05, attack: 0.004, decay: 0.07, bus: "ui", when: 0.1 });
  }

  // Band-limited hiss that sits under a transmission while it is spoken.
  // Returns a function that fades it out and plays the closing squelch.
  startRadioStatic() {
    if (!this.ready) return () => {};
    const t = this.ctx.currentTime;
    const source = this.noise("white", { loop: true });
    const band = this.filter("bandpass", 2200, 0.8);
    const env = this.gain(0);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.025, t + 0.08);
    // Slow wobble so the static breathes like a real link.
    const lfo = this.ctx.createOscillator();
    const depth = this.gain(0.01);
    lfo.frequency.value = 3.3;
    this.chain(lfo, depth, env.gain);
    this.chain(source, band, env, this.buses.ui);
    source.start(t, source._offset);
    lfo.start(t);
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      const end = this.ctx.currentTime;
      env.gain.cancelScheduledValues(end);
      env.gain.setValueAtTime(env.gain.value || 0.02, end);
      env.gain.exponentialRampToValueAtTime(0.0001, end + 0.12);
      source.stop(end + 0.15);
      lfo.stop(end + 0.15);
      this.burst({ filterType: "bandpass", frequency: 3000, q: 1, level: 0.07, attack: 0.002, decay: 0.09, bus: "ui" });
    };
  }

  // Pyro bang and the clatter of the stage falling away.
  playStageSeparation() {
    if (!this.ready) return;
    this.tone({ from: 300, to: 120, level: 0.3, decay: 0.2 });
    this.burst({ filterType: "bandpass", frequency: 1600, q: 3, level: 0.3, decay: 0.15 });
    this.burst({ type: "brown", frequency: 700, level: 0.3, decay: 0.4, when: 0.03 });
  }

  // ---------- engine ----------

  // Rocket roar: brown-noise rumble, a distorted body and an airy hiss,
  // with a slow flutter and exhaust crackle on top.
  createEngine() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this.gain(0);
    out.connect(this.buses.engine);

    const shaper = ctx.createWaveShaper();
    shaper.curve = this.softClipCurve(2.5);
    shaper.oversample = "2x";
    // In the vacuum the roar turns into a dull thrum heard through the hull.
    const muffle = this.filter("lowpass", 6000, 0.5);
    this.chain(shaper, muffle, out);

    const brown = this.noise("brown", { loop: true });
    const rumbleGain = this.gain(0);
    const rumble = this.filter("lowpass", 140, 0.9);
    this.chain(brown, rumble, rumbleGain, shaper);

    const bodyGain = this.gain(0);
    const body = this.filter("bandpass", 380, 0.8);
    brown.connect(body);
    this.chain(body, bodyGain, shaper);

    const white = this.noise("white", { loop: true });
    const hissGain = this.gain(0);
    const hiss = this.filter("highpass", 2200, 0.5);
    this.chain(white, hiss, hissGain, muffle);

    const crackle = this.noise("crackle", { loop: true });
    const crackleGain = this.gain(0);
    this.chain(crackle, this.filter("bandpass", 1400, 0.8), crackleGain, muffle);

    // Flutter: two slow LFOs wobbling the overall level.
    const flutter = this.gain(1);
    out.disconnect();
    out.connect(flutter);
    flutter.connect(this.buses.engine);
    const lfos = [
      [5.3, 0.08],
      [11.7, 0.05],
    ].map(([rate, depth]) => {
      const lfo = ctx.createOscillator();
      const amount = this.gain(depth);
      lfo.frequency.value = rate;
      this.chain(lfo, amount, flutter.gain);
      lfo.start(now);
      return lfo;
    });

    [brown, white, crackle].forEach((source) => source.start(now, source._offset));

    return {
      out,
      muffle,
      rumbleGain,
      bodyGain,
      hissGain,
      crackleGain,
      body,
      sources: [brown, white, crackle, ...lfos],
      stopTimer: null,
    };
  }

  startEngine() {
    if (!this.ready) return;
    if (!this.engine) {
      this.engine = this.createEngine();
      // Ignition pop when the engine lights.
      this.burst({ type: "brown", frequency: 700, level: 0.35, attack: 0.005, decay: 0.25 });
    }
    if (this.engine.stopTimer) {
      clearTimeout(this.engine.stopTimer);
      this.engine.stopTimer = null;
    }
    if (!this.isEnginePlaying) {
      this.isEnginePlaying = true;
      this.engine.out.gain.setTargetAtTime(1, this.ctx.currentTime, FADE);
    }
  }

  updateEngine(throttle, altitude) {
    if (!this.ready || !this.engine || !this.isEnginePlaying) return;
    const t = this.ctx.currentTime;
    const power = clamp(throttle, 0, 1);
    const air = clamp(1 - altitude / ATMOSPHERE_TOP, 0, 1);
    const nearGround = clamp(1 - altitude / 8, 0, 1);
    const e = this.engine;

    e.rumbleGain.gain.setTargetAtTime(power * (0.35 + 0.45 * air + 0.4 * nearGround), t, 0.1);
    e.bodyGain.gain.setTargetAtTime(power * (0.2 + 0.25 * air), t, 0.1);
    e.hissGain.gain.setTargetAtTime(power * 0.09 * air * air, t, 0.15);
    e.crackleGain.gain.setTargetAtTime(power * (0.15 + 0.5 * air), t, 0.1);
    e.body.frequency.setTargetAtTime(300 + power * 180, t, 0.2);
    e.muffle.frequency.setTargetAtTime(500 + 5500 * air * air, t, 0.3);
  }

  // Fades out with a short tail and a cut-off pop; the nodes are torn down
  // only after a while, so a quick re-light just fades back in.
  stopEngine() {
    if (!this.isEnginePlaying || !this.engine) return;
    this.isEnginePlaying = false;
    const e = this.engine;
    e.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
    this.burst({ type: "brown", frequency: 400, level: 0.12, attack: 0.003, decay: 0.18 });
    e.stopTimer = setTimeout(() => this.destroyEngine(), 2000);
  }

  destroyEngine() {
    const e = this.engine;
    if (!e) return;
    clearTimeout(e.stopTimer);
    e.sources.forEach((source) => {
      try {
        source.stop();
      } catch (err) {}
    });
    e.out.disconnect();
    this.engine = null;
    this.isEnginePlaying = false;
  }

  // ---------- atmosphere ----------

  // Continuous wind past the hull plus the roar and crackle of reentry.
  createAmbience() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this.gain(1);
    out.connect(this.buses.ambience);

    const white = this.noise("white", { loop: true });
    const windGain = this.gain(0);
    const windBand = this.filter("bandpass", 500, 0.9);
    const windLow = this.filter("lowpass", 2500, 0.5);
    this.chain(white, windBand, windLow, windGain, out);

    // Gusts: a slow LFO sweeping the wind band.
    const gust = ctx.createOscillator();
    const gustAmount = this.gain(120);
    gust.frequency.value = 0.23;
    this.chain(gust, gustAmount, windBand.frequency);

    const brown = this.noise("brown", { loop: true });
    const roarGain = this.gain(0);
    const roar = this.filter("lowpass", 300, 0.8);
    this.chain(brown, roar, roarGain, out);

    const crackle = this.noise("crackle", { loop: true });
    const crackleGain = this.gain(0);
    this.chain(crackle, this.filter("highpass", 1200, 0.6), crackleGain, out);

    gust.start(now);
    [white, brown, crackle].forEach((source) => source.start(now, source._offset));

    return {
      out,
      windGain,
      windBand,
      roarGain,
      roar,
      crackleGain,
      sources: [white, brown, crackle, gust],
    };
  }

  // speed in km/s, density 0..1, heat 0..1 (reentry).
  updateAtmosphere({ speed = 0, density = 0, heat = 0 }) {
    if (!this.ready) return;
    if (!this.ambience) this.ambience = this.createAmbience();
    const t = this.ctx.currentTime;
    const a = this.ambience;
    const pace = clamp(speed / 3, 0, 1);
    const pressure = clamp(density * pace * 1.6, 0, 1);

    a.windGain.gain.setTargetAtTime(pressure * 0.32, t, 0.25);
    a.windBand.frequency.setTargetAtTime(350 + pace * 1100, t, 0.4);
    a.roarGain.gain.setTargetAtTime(heat * 0.85, t, 0.2);
    a.roar.frequency.setTargetAtTime(200 + heat * 500, t, 0.3);
    a.crackleGain.gain.setTargetAtTime(heat * heat * 0.7, t, 0.15);
  }

  stopAtmosphere() {
    const a = this.ambience;
    if (!a) return;
    this.ambience = null;
    a.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    setTimeout(() => {
      a.sources.forEach((source) => {
        try {
          source.stop();
        } catch (err) {}
      });
      a.out.disconnect();
    }, 1500);
  }

  // Leaving a flight: silence every continuous layer.
  stopFlightSounds() {
    this.stopEngine();
    this.stopAtmosphere();
  }
}
