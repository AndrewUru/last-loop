import { AiClient } from "./AiClient.js";

// The voice on the radio. Each flight event becomes one short transmission:
// written by Claude when the AI is on, otherwise picked from the built-in
// lines below. Transmissions are shown as subtitles and read aloud with the
// browser's speech synthesis (unless the game is muted).

const BUILT_IN = {
  briefing: [
    "Aquí Control. Sistemas en verde, piloto. Sigue la flecha y separa cada etapa en cuanto se vacíe.",
    "Control a piloto: cuenta atrás en marcha. Despegue vertical, giro suave a la derecha y a por la órbita.",
  ],
  liftoff: ["¡Despegue confirmado! Torre despejada.", "Despegue. Tenemos ascenso nominal.", "¡Arriba! La torre queda atrás."],
  maxq: ["Entrando en Max-Q, máxima presión aerodinámica.", "Max-Q. Mantén el rumbo, piloto."],
  stageEmpty: ["Etapa agotada. Separa ya, piloto.", "Combustible a cero en esta etapa: ¡separación!"],
  separation: ["Separación confirmada. Encendido de la siguiente etapa.", "Etapa fuera. Buen trabajo, sigue la flecha."],
  space: ["Superas los 100 km: bienvenido al espacio.", "Línea de Kármán superada. Ya estás en el espacio."],
  orbit: ["¡Órbita confirmada! Siguiente objetivo en pantalla.", "Inserción orbital nominal. Prepárate para la siguiente fase."],
  success: ["Misión cumplida. Control felicita a la tripulación.", "Objetivo alcanzado. Gran vuelo, piloto."],
  failure: ["Perdimos el vehículo. Revisemos la telemetría y lo intentamos otra vez.", "Fallo de misión. Tranquilo, piloto: analizamos y volvemos a intentarlo."],
  lowFuel: ["Atención: combustible bajo en la última etapa.", "Combustible bajo. Gestiona cada segundo de motor."],
};

function pick(lines) {
  return lines[Math.floor(Math.random() * lines.length)];
}

export default class MissionControl {
  // onTransmit(text, { ai }) draws the subtitle.
  constructor({ audio, onTransmit }) {
    this.audio = audio;
    this.onTransmit = onTransmit;
    this.queue = [];
    this.busyUntil = 0;
    this.lastByEvent = new Map();
    this.closed = false;
    this.voice = null;
    this.pickVoice();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => this.pickVoice();
    }
  }

  pickVoice() {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    this.voice =
      voices.find((voice) => /^es[-_]ES/i.test(voice.lang)) ||
      voices.find((voice) => /^es/i.test(voice.lang)) ||
      null;
  }

  // event: a key of BUILT_IN; telemetry: what Claude gets to talk about.
  // cooldown (s) stops the same event from repeating too often.
  report(event, telemetry, { cooldown = 6, priority = false } = {}) {
    const now = performance.now();
    if (now - (this.lastByEvent.get(event) ?? -Infinity) < cooldown * 1000) return;
    this.lastByEvent.set(event, now);
    const fallback = pick(BUILT_IN[event] || BUILT_IN.separation);
    // Claude writes the line; if it is slow, the moment has passed, so the
    // built-in line goes out instead.
    const line = Promise.race([
      AiClient.ask("comms", { event, telemetry }).then((reply) => (reply.text ? { text: reply.text, ai: true } : null)),
      new Promise((resolve) => setTimeout(() => resolve(null), 4500)),
    ]).then((reply) => reply || { text: fallback, ai: false });
    this.enqueue(line, priority);
  }

  // A ready-made text (the briefing, the debrief).
  transmit(text, { ai = false, priority = false } = {}) {
    if (text) this.enqueue(Promise.resolve({ text, ai }), priority);
  }

  enqueue(linePromise, priority) {
    if (priority) this.queue = [];
    this.queue.push(linePromise);
    this.pump();
  }

  async pump() {
    if (this.pumping) return;
    this.pumping = true;
    while (this.queue.length && !this.closed) {
      const { text, ai } = await this.queue.shift();
      if (this.closed) break;
      // Keep at most two lines waiting; old news is dropped.
      if (this.queue.length > 2) this.queue.splice(0, this.queue.length - 2);
      await this.say(text, ai);
    }
    this.pumping = false;
  }

  // ElevenLabs voice from /api/tts, or null when it is off or fails (then
  // the browser voice takes over). After one 503 it is not asked again.
  async fetchVoice(text) {
    if (this.ttsDisabled || this.audio?.muted || !this.audio?.ready) return null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 503 || res.status === 404) this.ttsDisabled = true;
      if (!res.ok) return null;
      return await res.arrayBuffer();
    } catch (e) {
      return null;
    }
  }

  async say(text, ai) {
    const clip = await this.fetchVoice(text);
    if (this.closed) return;
    if (clip) {
      this.audio.playRadio?.();
      this.onTransmit?.(text, { ai });
      const stopStatic = this.audio.startRadioStatic?.() || (() => {});
      try {
        await this.audio.playRadioVoice(clip);
      } catch (e) {
        // Undecodable clip: fall through silently, the subtitle was shown.
      }
      stopStatic();
      await new Promise((resolve) => setTimeout(resolve, 250));
      return;
    }
    return this.sayWithBrowser(text, ai);
  }

  sayWithBrowser(text, ai) {
    this.audio?.playRadio?.();
    this.onTransmit?.(text, { ai });
    const words = text.split(/\s+/).length;
    const readTime = Math.max(2200, words * 380);
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      if (!synth || this.audio?.muted || !this.voice) {
        setTimeout(resolve, readTime);
        return;
      }
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = this.voice;
      utterance.lang = this.voice.lang;
      utterance.rate = 1.12;
      utterance.pitch = 0.85;
      let stopStatic = () => {};
      utterance.onstart = () => {
        stopStatic = this.audio?.startRadioStatic?.() || (() => {});
      };
      const done = () => {
        stopStatic();
        setTimeout(resolve, 250);
      };
      utterance.onend = done;
      utterance.onerror = done;
      synth.speak(utterance);
      // Some browsers never fire onend; never wait forever.
      setTimeout(done, readTime + 4000);
    });
  }

  close() {
    this.closed = true;
    this.queue = [];
    window.speechSynthesis?.cancel();
  }
}
