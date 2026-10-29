import Phaser from "phaser";
import ShipPart from "../entities/ShipPart.js";
import { PARTS_BY_ID } from "../data/parts.js";
import {
  DESIGN_SLOTS,
  STARTER_DESIGN,
  buildToDesign,
  designToBuild,
  loadSavedDesign,
  normalizeDesign,
  saveDesign,
} from "../data/rocketDesign.js";
import BuildValidator from "../systems/BuildValidator.js";
import FlightPredictor from "../systems/FlightPredictor.js";
import MissionSystem, { MISSIONS } from "../systems/MissionSystem.js";
import { UI_COLORS, addText, drawPanel } from "../ui/theme.js";

function getTwrVerdict(twr) {
  if (twr < 1.05) return { label: "No despega", color: UI_COLORS.dangerText };
  if (twr < 1.4) return { label: "Lento", color: UI_COLORS.warningText };
  if (twr <= 2.6) return { label: "Bien", color: UI_COLORS.accentText };
  return { label: "Muy potente", color: "#9fd7ff" };
}

function describePrediction(validation, prediction) {
  if (!validation.isValid) {
    return { title: "✖  No puede despegar", body: validation.errors[0], color: UI_COLORS.dangerText };
  }
  if (prediction.success) {
    return {
      title: "✔  Puede llegar a la órbita",
      body: `Con un vuelo perfecto: ${Math.round(prediction.time)} s y sobra un ${prediction.fuelPercent}% de combustible.`,
      color: UI_COLORS.accentText,
    };
  }
  if (prediction.failure === "escaped") {
    return {
      title: "✖  No llega a la órbita",
      body: "Sube muy rápido pero se queda sin combustible antes de girar. Añade tanques.",
      color: UI_COLORS.dangerText,
    };
  }
  return {
    title: "✖  No llega a la órbita",
    body: `Se queda sin combustible a ${Math.round(prediction.maxAltitude)} km. Añade tanques o quita peso.`,
    color: UI_COLORS.dangerText,
  };
}

export default class BuildScene extends Phaser.Scene {
  constructor() {
    super({ key: "BuildScene" });
  }

  init(data = {}) {
    if (data.design) {
      this.design = normalizeDesign(data.design);
    } else if (Array.isArray(data.build) && data.build.length > 0) {
      this.design = buildToDesign(data.build);
    } else {
      this.design = loadSavedDesign();
    }
    this.audio = this.registry.get("audio");
  }

  create() {
    this.unlocked = MissionSystem.getUnlockedParts();
    DESIGN_SLOTS.forEach((slot) => {
      if (!this.unlocked.has(slot.partId)) {
        this.design[slot.partId] = 0;
      }
    });

    this.cameras.main.setBackgroundColor(UI_COLORS.background);
    this.layout = this.computeLayout(this.scale.width, this.scale.height);
    this.drawBackground();
    this.createMissionCard();
    this.createPartRows();
    this.createPreview();
    this.createStatsPanel();
    this.createLaunchButton();
    this.registerInput();
    this.refresh();
  }

  computeLayout(width, height) {
    const compact = width < 760;
    const margin = compact ? 12 : 20;
    const missionHeight = compact ? 62 : 72;
    const top = margin + missionHeight + margin * 0.6;
    const bottom = height - margin;
    const mission = { x: margin, y: margin, width: width - margin * 2, height: missionHeight };

    if (!compact) {
      const listWidth = Math.min(360, width * 0.31);
      const statsWidth = Math.min(300, width * 0.26);
      const launchHeight = 60;
      return {
        compact,
        mission,
        list: { x: margin, y: top, width: listWidth, height: bottom - top },
        preview: {
          x: margin * 2 + listWidth,
          y: top,
          width: width - listWidth - statsWidth - margin * 4,
          height: bottom - top,
        },
        stats: {
          x: width - margin - statsWidth,
          y: top,
          width: statsWidth,
          height: bottom - top - launchHeight - margin * 0.6,
        },
        launch: { x: width - margin - statsWidth, y: bottom - launchHeight, width: statsWidth, height: launchHeight },
      };
    }

    const launchHeight = 54;
    const rowHeight = Phaser.Math.Clamp(Math.floor((height * 0.4) / DESIGN_SLOTS.length), 40, 52);
    const listHeight = rowHeight * DESIGN_SLOTS.length + 12;
    const launch = { x: margin, y: bottom - launchHeight, width: width - margin * 2, height: launchHeight };
    const list = { x: margin, y: launch.y - margin * 0.6 - listHeight, width: width - margin * 2, height: listHeight };
    const middleHeight = list.y - margin * 0.6 - top;
    const previewWidth = Math.floor((width - margin * 3) * 0.42);
    return {
      compact,
      mission,
      list,
      preview: { x: margin, y: top, width: previewWidth, height: middleHeight },
      stats: { x: margin * 2 + previewWidth, y: top, width: width - previewWidth - margin * 3, height: middleHeight },
      launch,
    };
  }

  drawBackground() {
    const { width, height } = this.scale;
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1c2c3d, 0.6);
    for (let x = 0; x < width; x += 40) {
      grid.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y < height; y += 40) {
      grid.lineBetween(0, y, width, y);
    }

    const panels = this.add.graphics();
    const { mission, list, preview, stats } = this.layout;
    drawPanel(panels, mission.x, mission.y, mission.width, mission.height);
    drawPanel(panels, list.x, list.y, list.width, list.height);
    drawPanel(panels, stats.x, stats.y, stats.width, stats.height);
    drawPanel(panels, preview.x, preview.y, preview.width, preview.height, { alpha: 0.35, edgeAlpha: 0.12 });
  }

  createMissionCard() {
    const { mission, compact } = this.layout;
    const current = MissionSystem.getCurrentMission();
    const completed = MissionSystem.getProgress().completed.length;
    const pad = compact ? 12 : 18;

    addText(this, mission.x + pad, mission.y + (compact ? 9 : 11), current ? `MISIÓN ${completed + 1}/${MISSIONS.length}` : "VUELO LIBRE", {
      size: compact ? 11 : 12,
      color: UI_COLORS.textMuted,
      bold: true,
    });
    addText(this, mission.x + pad, mission.y + (compact ? 24 : 28), current ? current.title : "¡Todas las misiones completadas!", {
      size: compact ? 17 : 22,
      bold: true,
    });
    const description = addText(
      this,
      mission.x + (compact ? pad : pad + 250),
      mission.y + (compact ? 44 : 34),
      current ? current.description : "Prueba diseños nuevos y bate tus tiempos.",
      { size: compact ? 12 : 15, color: UI_COLORS.textMuted },
    );
    if (compact) {
      description.setPosition(mission.x + pad + 150, mission.y + 9).setWordWrapWidth(mission.width - 180);
    }

    const stars = MISSIONS.map((_, index) => (index < completed ? "★" : "☆")).join(" ");
    addText(this, mission.x + mission.width - pad, mission.y + mission.height / 2, stars, {
      size: compact ? 14 : 20,
      color: UI_COLORS.warningText,
    }).setOrigin(1, 0.5);
  }

  createPartRows() {
    const { list, compact } = this.layout;
    const inset = 6;
    const rowHeight = Math.floor((list.height - inset * 2) / DESIGN_SLOTS.length);
    this.rows = DESIGN_SLOTS.map((slot, index) =>
      this.createPartRow(slot, list.x + inset, list.y + inset + index * rowHeight, list.width - inset * 2, rowHeight, compact),
    );
  }

  createPartRow(slot, x, y, width, height, compact) {
    const definition = PARTS_BY_ID[slot.partId];
    const locked = !this.unlocked.has(slot.partId);
    const unlockMission = MISSIONS.find((mission) => mission.unlocks.includes(slot.partId));
    const iconSize = Math.min(height - 10, 52);
    const highlight = this.add.graphics();
    const iconCell = Math.min(iconSize / definition.gridHeight, iconSize * 0.9);
    const icon = new ShipPart(this, x + 10 + iconSize / 2, y + height / 2, definition, {
      cellSize: iconCell,
      padding: 0,
      showLabel: false,
      iconMode: true,
    }).setAlpha(locked ? 0.25 : 1);
    const textX = x + iconSize + 22;
    // Leave room for the  − n +  stepper on the right.
    const textWidth = width - (textX - x) - (locked ? 10 : 124);
    const label = addText(this, textX, y + height / 2 - 2, slot.label, {
      size: compact ? 14 : 16,
      bold: true,
      color: locked ? UI_COLORS.textDim : UI_COLORS.text,
    }).setOrigin(0, 1);
    const effect = addText(
      this,
      textX,
      y + height / 2 + 1,
      locked ? `Bloqueado · misión «${unlockMission?.title ?? "?"}»` : slot.effect,
      {
        size: compact ? 11 : 12,
        color: locked ? UI_COLORS.textDim : UI_COLORS.textMuted,
        wordWrap: { width: textWidth },
        maxLines: compact ? 1 : 2,
      },
    );

    const row = { slot, locked, highlight, icon, label, effect, x, y, width, height };
    if (locked) {
      return row;
    }

    const buttonSize = Math.min(32, height - 12);
    const plusX = x + width - buttonSize / 2 - 6;
    const countX = plusX - buttonSize / 2 - 18;
    const minusX = countX - 18 - buttonSize / 2;
    row.minus = this.createStepButton(minusX, y + height / 2, buttonSize, "−", () => this.changeCount(slot, -1));
    row.plus = this.createStepButton(plusX, y + height / 2, buttonSize, "+", () => this.changeCount(slot, 1));
    row.count = addText(this, countX, y + height / 2, "0", { size: compact ? 16 : 18, bold: true }).setOrigin(0.5);
    return row;
  }

  createStepButton(x, y, size, symbol, onPress) {
    const background = this.add
      .rectangle(x, y, size, size, 0x1d2f42, 1)
      .setStrokeStyle(1, UI_COLORS.panelEdge, 0.35)
      .setInteractive({ useHandCursor: true });
    const text = addText(this, x, y - 1, symbol, { size: Math.round(size * 0.62), bold: true }).setOrigin(0.5);
    const button = { background, text, enabled: true };

    background.on("pointerover", () => button.enabled && background.setFillStyle(0x2a4560, 1));
    background.on("pointerout", () => background.setFillStyle(0x1d2f42, 1));
    background.on("pointerdown", () => {
      if (button.enabled) {
        onPress();
      }
    });
    return button;
  }

  setButtonEnabled(button, enabled) {
    button.enabled = enabled;
    button.background.setAlpha(enabled ? 1 : 0.35);
    button.text.setAlpha(enabled ? 1 : 0.35);
  }

  changeCount(slot, delta) {
    const next = Phaser.Math.Clamp((this.design[slot.partId] || 0) + delta, 0, slot.max);
    if (next === this.design[slot.partId]) {
      return;
    }
    this.design[slot.partId] = next;
    this.audio?.playClick?.();
    this.refresh();
  }

  createPreview() {
    this.previewRocket = null;
    this.previewPad = this.add.graphics();
  }

  renderPreview() {
    const { preview } = this.layout;
    const stats = this.validation.stats;
    const bounds = stats.bounds;
    this.previewRocket?.destroy(true);
    this.previewRocket = this.add.container(0, 0);

    const columns = bounds.maxX - bounds.minX;
    const rows = bounds.maxY - bounds.minY;
    const cell = Math.min(
      (preview.height * 0.78) / rows,
      (preview.width * 0.7) / columns,
      this.layout.compact ? 40 : 56,
    );
    const centerX = preview.x + preview.width / 2;
    const groundY = preview.y + preview.height - (this.layout.compact ? 20 : 34);
    const columnCenter = (bounds.minX + bounds.maxX) / 2;

    this.build.forEach((part) => {
      const definition = PARTS_BY_ID[part.partId];
      const view = new ShipPart(
        this,
        centerX + (part.cellX + definition.gridWidth / 2 - columnCenter) * cell,
        groundY - (bounds.maxY - part.cellY - definition.gridHeight / 2) * cell,
        definition,
        { cellSize: cell, padding: 0, showLabel: false, side: part.side },
      );
      this.previewRocket.add(view);
    });

    const padWidth = columns * cell + cell * 1.4;
    this.previewPad.clear();
    this.previewPad.fillStyle(0x73f7c0, 0.08);
    this.previewPad.fillEllipse(centerX, groundY + 4, Math.min(padWidth * 2.2, preview.width - 16), 26, 24);
    this.previewPad.fillStyle(0x3a4654, 1);
    this.previewPad.fillRect(centerX - padWidth / 2, groundY, padWidth, 6);
  }

  createStatsPanel() {
    const { stats, compact } = this.layout;
    const pad = compact ? 12 : 18;
    const lineGap = compact ? 22 : 28;
    let y = stats.y + pad;

    addText(this, stats.x + pad, y, "TU COHETE", { size: compact ? 11 : 12, bold: true, color: UI_COLORS.textMuted });
    y += compact ? 20 : 26;
    const statRow = (label) => {
      addText(this, stats.x + pad, y, label, { size: compact ? 13 : 15, color: UI_COLORS.textMuted });
      const value = addText(this, stats.x + stats.width - pad, y, "", { size: compact ? 13 : 15, bold: true }).setOrigin(1, 0);
      y += lineGap;
      return value;
    };
    this.massValue = statRow("Peso");
    this.twrValue = statRow(compact ? "Empuje/peso" : "Empuje / peso");
    this.fuelValue = statRow("Combustible");

    y += compact ? 4 : 10;
    addText(this, stats.x + pad, y, "PREDICCIÓN", { size: compact ? 11 : 12, bold: true, color: UI_COLORS.textMuted });
    y += compact ? 18 : 24;
    this.predictionTitle = addText(this, stats.x + pad, y, "", {
      size: compact ? 14 : 17,
      bold: true,
      wordWrap: { width: stats.width - pad * 2 },
    });
    this.predictionBody = addText(this, stats.x + pad, y + (compact ? 22 : 28), "", {
      size: compact ? 12 : 14,
      color: UI_COLORS.textMuted,
      wordWrap: { width: stats.width - pad * 2 },
      lineSpacing: 3,
    });

    const resetY = stats.y + stats.height - pad - (compact ? 14 : 16);
    const reset = addText(this, stats.x + pad, resetY, "↺  Volver al cohete inicial", {
      size: compact ? 12 : 14,
      color: "#9fd7ff",
    })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    reset.on("pointerover", () => reset.setColor("#d6f1ff"));
    reset.on("pointerout", () => reset.setColor("#9fd7ff"));
    reset.on("pointerdown", () => {
      this.design = normalizeDesign(STARTER_DESIGN);
      this.audio?.playClick?.();
      this.refresh();
    });
  }

  createLaunchButton() {
    const { launch, compact } = this.layout;
    this.launchButton = this.add
      .rectangle(launch.x + launch.width / 2, launch.y + launch.height / 2, launch.width, launch.height, 0x1f8a5f, 1)
      .setStrokeStyle(2, UI_COLORS.accent, 0.9)
      .setInteractive({ useHandCursor: true });
    this.launchLabel = addText(this, this.launchButton.x, this.launchButton.y, "¡LANZAR!", {
      size: compact ? 20 : 24,
      bold: true,
    }).setOrigin(0.5);
    this.launchHint = addText(this, launch.x + launch.width - 12, this.launchButton.y, compact ? "" : "ENTER", {
      size: 11,
      color: "#c9f7e3",
      bold: true,
    }).setOrigin(1, 0.5);

    this.launchButton.on("pointerover", () => this.validation?.isValid && this.launchButton.setFillStyle(0x27a873, 1));
    this.launchButton.on("pointerout", () => this.updateLaunchButton());
    this.launchButton.on("pointerdown", () => this.launchRocket());
  }

  updateLaunchButton() {
    const enabled = this.validation.isValid;
    this.launchButton.setFillStyle(enabled ? 0x1f8a5f : 0x2a3542, 1);
    this.launchButton.setStrokeStyle(2, enabled ? UI_COLORS.accent : 0x4a5a6b, 0.9);
    this.launchLabel.setAlpha(enabled ? 1 : 0.45);
    this.launchHint.setAlpha(enabled ? 1 : 0);
  }

  registerInput() {
    this.input.keyboard.on("keydown-ENTER", this.launchRocket, this);
    this.input.keyboard.on("keydown-SPACE", this.launchRocket, this);
    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off("keydown-ENTER", this.launchRocket, this);
      this.input.keyboard.off("keydown-SPACE", this.launchRocket, this);
      this.scale.off("resize", this.handleResize, this);
    });
  }

  handleResize() {
    if (this.resizePending) {
      return;
    }
    this.resizePending = true;
    this.time.delayedCall(30, () => this.scene.restart({ design: this.design }));
  }

  refresh() {
    this.build = designToBuild(this.design);
    this.validation = BuildValidator.validate(this.build);
    this.prediction = this.validation.isValid ? FlightPredictor.predict(this.validation.stats) : null;
    saveDesign(this.design);
    this.registry.set("rocket-build", this.build);

    this.rows.forEach((row) => {
      if (row.locked) {
        return;
      }
      const count = this.design[row.slot.partId] || 0;
      row.count.setText(String(count * (row.slot.perStep || 1)));
      this.setButtonEnabled(row.minus, count > 0);
      this.setButtonEnabled(row.plus, count < row.slot.max);
    });

    const stats = this.validation.stats;
    const verdict = getTwrVerdict(stats.twr);
    this.massValue.setText(`${Math.round(stats.mass)} t`);
    this.twrValue.setText(`${stats.twr.toFixed(2)} · ${verdict.label}`).setColor(verdict.color);
    this.fuelValue.setText(String(Math.round(stats.fuel)));

    const summary = describePrediction(this.validation, this.prediction);
    this.predictionTitle.setText(summary.title).setColor(summary.color);
    this.predictionBody.setText(summary.body);
    this.predictionBody.setY(this.predictionTitle.y + this.predictionTitle.height + 6);

    this.renderPreview();
    this.updateLaunchButton();
  }

  launchRocket(event) {
    // A key held down from the previous screen must not launch straight away.
    if (event?.repeat) {
      return;
    }
    if (!this.validation?.isValid) {
      this.audio?.playError?.();
      return;
    }

    this.audio?.playClick?.();
    this.scene.start("FlightScene", { build: this.build, stats: this.validation.stats });
  }
}
