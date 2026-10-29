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
export function getFlightInstruction(state, thrustLabel) {
  if (state.orbitAchieved) {
    return {
      title: "¡En órbita!",
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
      .setText("ESPACIO / W  impulso      A / D  girar      ESC  hangar")
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

  update(state, { stats }) {
    const touch = Boolean(this.scene.touchControlsUi?.visible);
    const instruction = getFlightInstruction(state, touch ? "IMPULSO" : "ESPACIO");
    this.setTextIfChanged(this.title, "title", instruction.title);
    this.setTextIfChanged(this.body, "body", instruction.body);
    this.title.setColor(TONE_COLORS[instruction.tone]);

    const orbitAltitude = FLIGHT_WORLD.orbitMinAltitude;
    const orbitSpeed = FLIGHT_WORLD.orbitTargetHorizontalSpeed;
    const lateralSpeed = Math.abs(state.horizontalVelocity);
    const fuelShare = stats.fuel > 0 ? clamp(state.fuelRemaining / stats.fuel, 0, 1) : 0;

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
      fuelShare < 0.2 ? BAR_COLORS.low : BAR_COLORS.fuel,
    );
  }
}
