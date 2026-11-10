import { FLIGHT_WORLD } from "../systems/FlightModel.js";
import { UI_FONT } from "./theme.js";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const TONE_COLORS = {
  info: "#f3f7fb",
  success: "#8ff5c4",
  warning: "#ffd166",
  danger: "#ff9b8a",
};

const BAR_COLORS = {
  altitude: 0x68d9ff,
  speed: 0xb79bff,
  fuel: 0x73f7c0,
  done: 0x73f7c0,
  low: 0xff8d7a,
};

// One instruction, one hint and three bars: everything the pilot needs to
// decide what to do next, nothing else.
// extra.stageNames: names of the rocket's stages; extra.separateLabel: the
// key or button that drops a stage.
export function getFlightInstruction(state, thrustLabel, extra = {}) {
  if (state.orbitAchieved) {
    if (state.escaping) {
      return { title: "¡Rumbo a la Luna!", body: "La última etapa te ha sacado de la órbita.", tone: "success" };
    }
    return {
      title: state.finalOrbitAltitude ? "¡Órbita alta!" : "¡En órbita!",
      body: "El cohete ya no cae: ahora gira alrededor del planeta.",
      tone: "success",
    };
  }
  if (state.result) {
    return { title: state.phase, body: "", tone: "danger" };
  }
  if (!state.launched) {
    return {
      title: `Mantén ${thrustLabel} para despegar`,
      body: "Al soltar, el motor se apaga.",
      tone: "info",
    };
  }
  if (state.phaseId === "reentry") {
    const hasFuel = state.fuelRemaining > 0.01 && !state.engineLocked;
    if (state.altitude < 25 && hasFuel) {
      const tooFast = state.speed > FLIGHT_WORLD.safeLandingSpeed;
      return {
        title: tooFast ? "¡Frena para aterrizar!" : "Aterrizaje suave…",
        body: tooFast
          ? `Morro arriba y ${thrustLabel}: baja de ${FLIGHT_WORLD.safeLandingSpeed.toFixed(2)} km/s.`
          : "Mantén el cohete vertical hasta tocar el suelo.",
        tone: tooFast ? "danger" : "success",
      };
    }
    if (state.reentryHeat > 0.35) {
      return {
        title: `¡Reentrada! Calor ${Math.round(state.reentryHeat * 100)}%`,
        body: "El aire frena el cohete y lo calienta. Aguanta.",
        tone: "danger",
      };
    }
    return {
      title: "Reentrada",
      body: hasFuel
        ? `Vuelves a la atmósfera. Prepárate para frenar con ${thrustLabel}.`
        : "Vuelves a la atmósfera sin combustible.",
      tone: "warning",
    };
  }
  // An empty stage with another one above it: drop it, before anything else.
  if (state.separationCue) {
    const name = extra.stageNames?.[state.stage] || "La etapa";
    const next = extra.stageNames?.[state.stage + 1];
    return {
      title: `¡Separa la etapa!  (${extra.separateLabel || "S"})`,
      body: next ? `${name} está vacía: suéltala para encender ${next}.` : `${name} está vacía: suéltala.`,
      tone: "warning",
    };
  }
  // After orbit: the goal of the current phase.
  if (state.missionPhase > 0 && state.missionPhases) {
    const goal = state.missionPhases[state.missionPhase];
    const lock = Math.round(clamp(state.orbitHoldTime / FLIGHT_WORLD.orbitLockDuration, 0, 1) * 100);
    if (state.orbitWindow) {
      return goal.type === "escape"
        ? { title: `Saliendo de la órbita… ${lock}%`, body: "Mantén el empuje un momento más.", tone: "success" }
        : { title: `Fijando la órbita alta… ${lock}%`, body: "Mantén la altura: ni subas ni bajes.", tone: "success" };
    }
    if ((state.totalFuel ?? state.fuelRemaining) <= 0.01) {
      return { title: "Sin combustible", body: "No queda combustible para terminar la misión.", tone: "danger" };
    }
    if (goal.type === "escape") {
      return {
        title: "Acelera rumbo a la Luna",
        body: `Sigue la flecha hasta ${goal.speed.toFixed(1)} km/s.`,
        tone: "info",
      };
    }
    const distance = Math.round(goal.altitude - state.altitude);
    if (state.cutEngineCue) {
      return {
        title: `Planeando hacia ${goal.altitude} km`,
        body: Math.abs(distance) > 2 ? `Faltan ${Math.abs(distance)} km: suelta el motor y espera.` : "Ya casi: espera sin encender.",
        tone: "info",
      };
    }
    return {
      title: state.engineOn ? `Hacia la órbita alta: ${goal.altitude} km` : `Mantén ${thrustLabel} siguiendo la flecha`,
      body: distance > 0 ? `Sube ${distance} km y frena al llegar.` : `Baja ${-distance} km y estabilízate.`,
      tone: "info",
    };
  }
  if (state.orbitWindow) {
    const lock = Math.round(
      clamp(state.orbitHoldTime / FLIGHT_WORLD.orbitLockDuration, 0, 1) * 100,
    );
    return {
      title: `Fijando órbita… ${lock}%`,
      body: "Mantén el vuelo casi horizontal.",
      tone: "success",
    };
  }
  if (state.cutEngineCue) {
    return state.engineOn
      ? {
          title: "¡Suelta el motor!",
          body: "Ya tienes velocidad orbital: planea hasta el anillo verde.",
          tone: "success",
        }
      : {
          title: "Planeando hacia la órbita…",
          body: "Sin motor no gastas combustible.",
          tone: "info",
        };
  }
  if (state.engineLocked) {
    return {
      title: "Motor apagado",
      body: "En esta misión solo había un encendido.",
      tone: "danger",
    };
  }
  if (state.fuelRemaining <= 0.01) {
    return {
      title: "Sin combustible",
      body: "Ya no puedes acelerar. Prueba con más tanques.",
      tone: "danger",
    };
  }
  if (!state.engineOn) {
    return {
      title: `Mantén ${thrustLabel} para acelerar`,
      body: "Con el motor apagado, el cohete cae.",
      tone: "warning",
    };
  }

  const errorDegrees = (state.guidanceError * 180) / Math.PI;
  if (Math.abs(errorDegrees) > 7) {
    return {
      title: errorDegrees > 0 ? "Gira a la derecha  ▶" : "◀  Gira a la izquierda",
      body: "Alinea el cohete con la flecha.",
      tone: "warning",
    };
  }
  if (state.altitude < FLIGHT_WORLD.atmosphereHeight) {
    return {
      title: "Bien, sigue la flecha",
      body: "Sal de la atmósfera mientras ganas velocidad lateral.",
      tone: "info",
    };
  }
  return {
    title: "Gana velocidad lateral",
    body: `Al llegar a ${FLIGHT_WORLD.orbitTargetHorizontalSpeed.toFixed(1)} km/s podrás soltar el motor.`,
    tone: "info",
  };
}

export default class FlightHud {
  constructor(scene) {
    this.scene = scene;
    this.objects = [];
    this.isCompact = false;
    this.lastText = new Map();
  }

  create() {
    const depth = 40;

    this.panel = this.scene.add.graphics().setScrollFactor(0).setDepth(depth);
    this.title = this.createText(22, "#f3f7fb", true).setOrigin(0.5, 0);
    this.body = this.createText(14, "#aebdcb").setOrigin(0.5, 0);
    this.bars = {
      altitude: this.createBar("ALTITUD", BAR_COLORS.altitude),
      speed: this.createBar("VELOCIDAD", BAR_COLORS.speed),
      fuel: this.createBar("COMBUSTIBLE", BAR_COLORS.fuel),
    };
    this.keyHint = this.createText(14, "#cfe0f0")
      .setOrigin(0.5, 1)
      .setText("ESPACIO / W  impulso      A / D  girar      S  separar      ESC  hangar")
      .setShadow(0, 1, "#000000", 3, true, true);

    this.objects.push(this.panel, this.title, this.body, this.keyHint);
    Object.values(this.bars).forEach((bar) => {
      this.objects.push(bar.label, bar.value, bar.graphics);
    });

    this.resize(this.scene.scale.width, this.scene.scale.height);
  }

  createText(size, color, bold = false) {
    return this.scene.add
      .text(0, 0, "", {
        fontFamily: UI_FONT,
        fontSize: `${size}px`,
        color,
        fontStyle: bold ? "bold" : "normal",
      })
      .setScrollFactor(0)
      .setDepth(41);
  }

  createBar(label, color) {
    return {
      color,
      progress: 0,
      label: this.createText(11, "#8fa8c0", true).setText(label).setOrigin(0, 1),
      value: this.createText(12, "#f3f7fb", true).setOrigin(1, 1),
      graphics: this.scene.add.graphics().setScrollFactor(0).setDepth(41),
      x: 0,
      y: 0,
      width: 0,
    };
  }

  getObjects() {
    return this.objects;
  }

  resize(width, height) {
    this.isCompact = width < 640;
    const margin = this.isCompact ? 10 : 16;
    const panelWidth = Math.min(600, width - margin * 2);
    const panelHeight = this.isCompact ? 112 : 124;
    const panelX = (width - panelWidth) / 2;
    const panelY = margin;
    const inner = this.isCompact ? 12 : 18;
    const gap = this.isCompact ? 10 : 16;
    const barWidth = (panelWidth - inner * 2 - gap * 2) / 3;
    const barY = panelY + panelHeight - (this.isCompact ? 16 : 18);

    this.panelBounds = { x: panelX, y: panelY, width: panelWidth, height: panelHeight };
    this.panel.clear();
    this.panel.fillStyle(0x0b121a, 0.78);
    this.panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 14);
    this.panel.lineStyle(1, 0xa8c4de, 0.22);
    this.panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 14);

    this.title
      .setFontSize(this.isCompact ? 17 : 22)
      .setPosition(width / 2, panelY + (this.isCompact ? 10 : 12));
    this.body
      .setFontSize(this.isCompact ? 12 : 14)
      .setPosition(width / 2, panelY + (this.isCompact ? 33 : 42))
      .setWordWrapWidth(panelWidth - inner * 2);

    ["altitude", "speed", "fuel"].forEach((key, index) => {
      const bar = this.bars[key];
      bar.x = panelX + inner + index * (barWidth + gap);
      bar.y = barY;
      bar.width = barWidth;
      bar.label.setPosition(bar.x, barY - 9).setFontSize(this.isCompact ? 9 : 11);
      bar.value.setPosition(bar.x + barWidth, barY - 9).setFontSize(this.isCompact ? 10 : 12);
      this.drawBar(bar);
    });

    this.keyHint.setPosition(width / 2, height - 14);
    this.keyHint.setVisible(!this.scene.touchControlsUi?.visible);
  }

  drawBar(bar) {
    const height = this.isCompact ? 7 : 8;
    bar.graphics.clear();
    bar.graphics.fillStyle(0x1d2a38, 1);
    bar.graphics.fillRoundedRect(bar.x, bar.y - 2, bar.width, height, height / 2);
    if (bar.progress > 0.005) {
      bar.graphics.fillStyle(bar.fillColor ?? bar.color, 1);
      bar.graphics.fillRoundedRect(
        bar.x,
        bar.y - 2,
        Math.max(height, bar.width * bar.progress),
        height,
        height / 2,
      );
    }
  }

  setTextIfChanged(target, key, text) {
    if (this.lastText.get(key) !== text) {
      this.lastText.set(key, text);
      target.setText(text);
    }
  }

  updateBar(bar, progress, text, fillColor) {
    const rounded = Math.round(clamp(progress, 0, 1) * 200) / 200;
    if (rounded !== bar.progress || fillColor !== bar.fillColor) {
      bar.progress = rounded;
      bar.fillColor = fillColor;
      this.drawBar(bar);
    }
    if (bar.value.text !== text) {
      bar.value.setText(text);
    }
  }

  // instruction: a mission's own instruction, shown instead of the usual one.
  update(state, { stats, stageNames, instruction: missionInstruction }) {
    const touch = Boolean(this.scene.touchControlsUi?.visible);
    // Dropping a stage outranks a mission's own hint.
    const instruction =
      (!state.separationCue && missionInstruction) ||
      getFlightInstruction(state, touch ? "IMPULSO" : "ESPACIO", { stageNames, separateLabel: touch ? "SEPARAR" : "S" });
    this.setTextIfChanged(this.title, "title", instruction.title);
    this.setTextIfChanged(this.body, "body", instruction.body);
    this.title.setColor(TONE_COLORS[instruction.tone]);

    // The bars aim at the current phase: the high orbit's altitude, or the
    // escape speed; the fuel bar is the burning stage's tank.
    const goal = state.missionPhases?.[state.missionPhase];
    const orbitAltitude = goal?.type === "raise" ? goal.altitude : FLIGHT_WORLD.orbitMinAltitude;
    const orbitSpeed = goal?.type === "escape" ? goal.speed : FLIGHT_WORLD.orbitTargetHorizontalSpeed;
    const lateralSpeed = Math.abs(state.horizontalVelocity);
    const capacity = state.stageCapacity ?? stats.fuel;
    const fuelShare = capacity > 0 ? clamp(state.fuelRemaining / capacity, 0, 1) : 0;
    const stageCount = state.stageCount || 1;
    const fuelLabel = stageCount > 1 ? `ETAPA ${state.stage + 1}/${stageCount}` : "COMBUSTIBLE";
    if (this.bars.fuel.label.text !== fuelLabel) {
      this.bars.fuel.label.setText(fuelLabel);
    }

    this.updateBar(
      this.bars.altitude,
      state.altitude / orbitAltitude,
      this.isCompact
        ? `${Math.round(state.altitude)}/${orbitAltitude}`
        : `${Math.round(state.altitude)}/${orbitAltitude} km`,
      state.altitude >= orbitAltitude ? BAR_COLORS.done : BAR_COLORS.altitude,
    );
    this.updateBar(
      this.bars.speed,
      lateralSpeed / orbitSpeed,
      this.isCompact
        ? `${lateralSpeed.toFixed(1)}/${orbitSpeed.toFixed(1)}`
        : `${lateralSpeed.toFixed(1)}/${orbitSpeed.toFixed(1)} km/s`,
      lateralSpeed >= orbitSpeed * FLIGHT_WORLD.orbitSpeedRatio ? BAR_COLORS.done : BAR_COLORS.speed,
    );
    this.updateBar(
      this.bars.fuel,
      fuelShare,
      `${Math.round(fuelShare * 100)}%`,
      fuelShare < 0.2 || state.separationCue ? BAR_COLORS.low : BAR_COLORS.fuel,
    );
  }
}
