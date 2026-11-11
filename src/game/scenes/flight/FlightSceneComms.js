import { AiClient } from "../../ai/AiClient.js";
import MissionControl from "../../ai/MissionControl.js";
import { getMissionPhases } from "../../data/rockets.js";
import { getIssPosition, getUpcomingLaunches, summarizeLaunch } from "../../data/realSpace.js";
import { UI_FONT } from "../../ui/theme.js";

// Mission Control on the radio during a flight: a pre-launch briefing with
// real news, short calls at the key moments, and a debrief of the telemetry
// at the end. The flight log gathered here is what the debrief is built on.

const PANEL_DEPTH = 60;

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export const flightSceneCommsMethods = {
  createComms() {
    this.commsPanel = this.add.graphics().setScrollFactor(0).setDepth(PANEL_DEPTH);
    this.commsLabel = this.add
      .text(0, 0, "CONTROL DE MISIÓN", { fontFamily: UI_FONT, fontSize: "11px", fontStyle: "bold", color: "#73f7c0" })
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
    this.commsText = this.add
      .text(0, 0, "", { fontFamily: UI_FONT, fontSize: "15px", color: "#f3f7fb", lineSpacing: 3 })
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1);
    this.commsObjects = [this.commsPanel, this.commsLabel, this.commsText];
    this.commsObjects.forEach((obj) => obj.setAlpha(0));

    this.missionControl = new MissionControl({
      audio: this.audio,
      onTransmit: (text, { ai }) => this.showTransmission(text, ai),
    });
    this.flightLog = {
      separations: [],
      events: [],
      stageEmptyAt: null,
      maxQSpeed: 0,
      lastStageFuel: null,
    };
    this.commsSeen = { launched: false, maxq: false, space: false, cue: false, separations: 0, phase: 0, lowFuel: false };
    const control = this.missionControl;
    this.events.once("shutdown", () => control.close());
    this.startBriefing();
  },

  // Screen-space objects drawn by the HUD camera only.
  getCommsUiObjects() {
    return this.commsObjects || [];
  },

  layoutComms() {
    const { width, height } = this.scale;
    const compact = width < 640;
    const panelWidth = Math.min(compact ? width - 20 : 440, width - 20);
    const touch = this.touchControlsUi?.visible;
    const x = compact ? 10 : 16;
    const textWidth = panelWidth - 28;
    this.commsText.setWordWrapWidth(textWidth).setFontSize(compact ? 13 : 15);
    const panelHeight = Math.max(52, this.commsText.height + 34);
    const bottom = height - (touch ? (compact ? 210 : 170) : 44);
    const y = bottom - panelHeight;
    this.commsPanel.clear();
    this.commsPanel.fillStyle(0x0b121a, 0.82);
    this.commsPanel.fillRoundedRect(x, y, panelWidth, panelHeight, 10);
    this.commsPanel.fillStyle(0x73f7c0, 0.9);
    this.commsPanel.fillRect(x, y + 8, 3, panelHeight - 16);
    this.commsLabel.setPosition(x + 14, y + 8);
    this.commsText.setPosition(x + 14, y + 24);
  },

  showTransmission(text, ai) {
    if (!this.commsText?.active) return;
    this.commsLabel.setText(ai ? "CONTROL DE MISIÓN · IA" : "CONTROL DE MISIÓN");
    // Typewriter: the line appears as it is spoken.
    this.commsTyping?.remove();
    let shown = 0;
    this.commsText.setText("");
    this.layoutComms();
    this.tweens.killTweensOf(this.commsObjects);
    this.commsObjects.forEach((obj) => obj.setAlpha(1));
    this.commsTyping = this.time.addEvent({
      delay: 28,
      repeat: text.length - 1,
      callback: () => {
        shown += 1;
        this.commsText.setText(text.slice(0, shown));
        if (shown % 12 === 0 || shown === text.length) this.layoutComms();
      },
    });
    const hold = Math.max(4500, text.split(/\s+/).length * 420 + 1500);
    this.tweens.add({ targets: this.commsObjects, alpha: 0, delay: hold, duration: 600 });
  },

  // What Control knows about the flight right now.
  getTelemetry(state) {
    const stages = this.rocketDef.stages || [];
    const goal = state.missionPhases?.[state.missionPhase];
    return {
      cohete: this.rocketDef.name,
      tiempo_s: round(state.time, 0),
      altitud_km: round(state.altitude, 0),
      velocidad_kms: round(state.speed),
      velocidad_lateral_kms: round(Math.abs(state.horizontalVelocity)),
      etapa: stages.length ? `${state.stage + 1}/${stages.length} (${stages[state.stage]?.name})` : "única",
      combustible_etapa_pct: state.stageCapacity > 0 ? Math.round((state.fuelRemaining / state.stageCapacity) * 100) : 0,
      fase: goal ? (goal.type === "orbit" ? "llegar a la órbita" : goal.type === "raise" ? `subir a ${goal.altitude} km` : "rumbo a la Luna") : "",
      mision: this.rocketDef.challenge.title,
    };
  },

  async startBriefing() {
    const control = this.missionControl;
    const rocket = this.rocketDef;
    const phases = getMissionPhases(rocket);
    const [launches, iss] = await Promise.all([getUpcomingLaunches(), getIssPosition()]);
    if (control.closed || this.missionControl !== control) return;
    const ownLaunch = launches?.find((launch) => launch.gameRocketId === rocket.id);
    const news = {
      proximos_lanzamientos: (launches || []).slice(0, 3).map(summarizeLaunch),
      lanzamiento_real_de_este_cohete: ownLaunch ? summarizeLaunch(ownLaunch) : null,
      iss: iss ? `sobre lat ${round(iss.latitude, 0)}, lon ${round(iss.longitude, 0)}, a ${round(iss.altitude, 0)} km` : null,
    };
    this.realNews = news;
    const reply = await AiClient.ask("briefing", {
      rocket: { nombre: rocket.name, pais: rocket.country, año: rocket.year, etapas: (rocket.stages || []).map((s) => s.name) },
      mission: { titulo: rocket.challenge.title, fases: phases.map((p) => p.type) },
      news,
    });
    // Too late once the climb is under way: Control has other things to say.
    if (control.closed || this.missionControl !== control || this.simulator.state.altitude > 20 || this.finished) return;
    if (reply.text) {
      this.missionControl.transmit(reply.text, { ai: true, priority: true });
    } else {
      const extra = ownLaunch
        ? ` Por cierto: un ${ownLaunch.rocket} real despega ${summarizeLaunch(ownLaunch).split(") ")[1] || "pronto"}.`
        : "";
      this.missionControl.report("briefing", {}, { cooldown: 0 });
      if (extra) this.missionControl.transmit(extra.trim());
    }
  },

  // Called every frame: turns what just happened into radio calls and keeps
  // the log the debrief is built on.
  updateComms(state) {
    if (!this.missionControl || this.finished) return;
    const seen = this.commsSeen;
    const log = this.flightLog;
    const telemetry = () => this.getTelemetry(state);

    if (state.launched && !seen.launched) {
      seen.launched = true;
      this.missionControl.report("liftoff", telemetry(), { priority: true });
    }
    if (state.altitude > 12 && state.altitude < 40) {
      log.maxQSpeed = Math.max(log.maxQSpeed, state.speed);
    }
    if (!seen.maxq && state.altitude > 12 && state.verticalVelocity > 0) {
      seen.maxq = true;
      this.missionControl.report("maxq", telemetry());
    }
    if (!seen.space && state.altitude > 100) {
      seen.space = true;
      this.missionControl.report("space", telemetry());
    }
    if (state.separationCue && !seen.cue) {
      seen.cue = true;
      log.stageEmptyAt = state.time;
      this.missionControl.report("stageEmpty", telemetry(), { cooldown: 2 });
    }
    if (state.separations > seen.separations) {
      const stages = this.rocketDef.stages || [];
      const dropped = stages[seen.separations];
      const capacity = (dropped?.fuel || 0) * this.stats.fuel;
      log.separations.push({
        etapa: dropped?.name || `etapa ${seen.separations + 1}`,
        tiempo_s: round(state.time, 1),
        altitud_km: round(state.altitude, 0),
        velocidad_kms: round(state.speed),
        combustible_tirado_pct: capacity > 0 ? Math.round(((log.lastStageFuel ?? 0) / capacity) * 100) : 0,
        espera_tras_vaciarse_s: log.stageEmptyAt != null ? round(state.time - log.stageEmptyAt, 1) : null,
      });
      seen.separations = state.separations;
      seen.cue = false;
      log.stageEmptyAt = null;
      this.missionControl.report("separation", { ...telemetry(), separacion: log.separations.at(-1) }, { cooldown: 3 });
    }
    if (state.missionPhase > seen.phase) {
      seen.phase = state.missionPhase;
      log.events.push({ evento: "fase completada", tiempo_s: round(state.time, 0), fase: state.missionPhase });
      this.missionControl.report("orbit", telemetry(), { cooldown: 0, priority: true });
    }
    const lastStage = state.stage >= (state.stageCount || 1) - 1;
    if (!seen.lowFuel && lastStage && state.launched && state.stageCapacity > 0 && state.fuelRemaining / state.stageCapacity < 0.12) {
      seen.lowFuel = true;
      this.missionControl.report("lowFuel", telemetry());
    }
    log.lastStageFuel = state.fuelRemaining;
  },

  // The flight is over: a closing call, then the debrief in the result panel.
  async finishComms(state, result) {
    if (!this.missionControl) return;
    const control = this.missionControl;
    this.missionControl.report(result.success ? "success" : "failure", { ...this.getTelemetry(state), motivo: state.reason }, { cooldown: 0, priority: true });
    const telemetry = {
      ...this.getTelemetry(state),
      resultado: result.success ? "éxito" : "fallo",
      motivo: state.reason,
      tiempo_total_s: round(result.time, 1),
      altura_max_km: round(result.maxAltitude, 0),
      combustible_final_pct: result.fuelPercent,
      separaciones: this.flightLog.separations,
      velocidad_max_q_kms: round(this.flightLog.maxQSpeed),
      fases: getMissionPhases(this.rocketDef).map((p) => p.type),
      fase_alcanzada: state.missionPhase + 1,
      reto: { titulo: this.rocketDef.challenge.title, cumplido: result.challenge?.achieved, falta: result.challenge?.missed },
    };
    this.setDebrief("Analizando telemetría…", false);
    const reply = await AiClient.ask("debrief", { telemetry });
    if (control.closed || this.missionControl !== control || !this.resultOverlayVisible) return;
    const text = reply.text || this.buildLocalDebrief(telemetry);
    this.setDebrief(text, Boolean(reply.text));
  },

  // The debrief without AI: the most telling numbers from the log.
  buildLocalDebrief(t) {
    const late = t.separaciones.filter((s) => (s.espera_tras_vaciarse_s ?? 0) > 3);
    const wasted = t.separaciones.filter((s) => s.combustible_tirado_pct > 10);
    const parts = [];
    parts.push(t.resultado === "éxito" ? `Vuelo de ${t.tiempo_total_s} s hasta ${t.altura_max_km} km con ${t.combustible_final_pct}% de combustible.` : `${t.motivo}`);
    if (wasted.length) parts.push(`Soltaste ${wasted[0].etapa} con un ${wasted[0].combustible_tirado_pct}% de combustible dentro: espera a que se vacíe.`);
    else if (late.length) parts.push(`Tardaste ${late[0].espera_tras_vaciarse_s} s en separar ${late[0].etapa}: cada segundo sin motor te hace caer.`);
    else if (t.separaciones.length) parts.push("Separaciones limpias y a tiempo.");
    if (t.resultado !== "éxito") parts.push("Consejo: sigue la flecha verde y separa en cuanto el HUD lo pida.");
    return parts.join(" ");
  },

  setDebrief(text, ai) {
    if (!this.resultDebrief) return;
    this.resultDebrief.setText(ai ? `Control (IA): ${text}` : text);
    this.resultDebrief.setColor(ai ? "#cfe8ff" : "#9eb4ca");
  },
};
