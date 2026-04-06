export default class SoundSystem {
  constructor(scene) {
    this.scene = scene;
    this.audioContext = null;
    this.enabled = false;

    const unlock = () => {
      this.ensureContext();
      if (this.audioContext?.state === "suspended") {
        this.audioContext.resume();
      }
    };

    scene.input.keyboard?.once("keydown", unlock);
    scene.input.once("pointerdown", unlock);
  }

  ensureContext() {
    if (this.audioContext || typeof window === "undefined") {
      return;
    }

    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) {
      return;
    }

    this.audioContext = new Context();
    this.enabled = true;
  }

  play(config) {
    this.ensureContext();

    if (!this.enabled || !this.audioContext || this.audioContext.state !== "running") {
      return;
    }

    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    oscillator.type = config.type || "square";
    oscillator.frequency.setValueAtTime(config.frequency, now);
    if (config.endFrequency) {
      oscillator.frequency.linearRampToValueAtTime(
        config.endFrequency,
        now + config.duration,
      );
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(config.volume || 0.03, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);

    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + config.duration);
  }

  hit() {
    this.play({
      frequency: 220,
      endFrequency: 150,
      duration: 0.07,
      volume: 0.018,
      type: "square",
    });
  }

  enemyDown() {
    this.play({
      frequency: 180,
      endFrequency: 90,
      duration: 0.11,
      volume: 0.025,
      type: "triangle",
    });
  }

  pickup() {
    this.pickupXp();
  }

  pickupXp() {
    this.play({
      frequency: 640,
      endFrequency: 880,
      duration: 0.09,
      volume: 0.022,
      type: "sine",
    });
  }

  pickupHeal() {
    this.play({
      frequency: 460,
      endFrequency: 620,
      duration: 0.12,
      volume: 0.024,
      type: "triangle",
    });
  }

  levelUp() {
    this.play({
      frequency: 420,
      endFrequency: 760,
      duration: 0.18,
      volume: 0.03,
      type: "triangle",
    });
  }

  playerHit() {
    this.play({
      frequency: 130,
      endFrequency: 85,
      duration: 0.14,
      volume: 0.035,
      type: "sawtooth",
    });
  }

  ambientPulse() {
    this.play({
      frequency: 110,
      endFrequency: 135,
      duration: 0.24,
      volume: 0.01,
      type: "sine",
    });
  }
}
