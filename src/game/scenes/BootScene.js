import Phaser from "phaser";
import ShipPart from "../entities/ShipPart.js";
import { PARTS_BY_ID } from "../data/parts.js";
import { designToBuild, loadSavedDesign } from "../data/rocketDesign.js";
import AudioSystem from "../systems/AudioSystem.js";
import MissionSystem from "../systems/MissionSystem.js";
import { UI_COLORS, addText } from "../ui/theme.js";

const STEPS = [
  { title: "Construye", body: "Elige tanques y motor." },
  { title: "Despega", body: "Mantén pulsado el impulso." },
  { title: "Orbita", body: "Sigue la flecha hasta el anillo verde." },
];

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    this.load.image("part-capsule", "assets/parts/capsule.png");
    this.load.image("part-fuel-small", "assets/parts/fuel_tank_small.png");
    this.load.image("part-fuel-large", "assets/parts/fuel_tank_large.png");
    this.load.image("part-engine-main", "assets/parts/engine_main.png");
  }

  create() {
    const { width, height } = this.scale;
    const compact = width < 700;

    this.audio = this.registry.get("audio") || new AudioSystem();
    this.audio.init();
    this.registry.set("audio", this.audio);

    this.cameras.main.setBackgroundColor(UI_COLORS.background);
    this.drawBackdrop(width, height);
    this.drawRocket(width, height, compact);

    const left = compact ? 24 : Math.max(40, width * 0.1);
    const textWidth = compact ? width - 48 : Math.min(560, width * 0.5);
    let y = compact ? height * 0.08 : height * 0.18;

    addText(this, left, y, "LAST LOOP", { size: compact ? 44 : 72, bold: true });
    y += compact ? 56 : 88;
    addText(this, left, y, "Construye un cohete y ponlo en órbita.", {
      size: compact ? 18 : 24,
      color: UI_COLORS.textMuted,
      wordWrap: { width: textWidth },
    });
    y += compact ? 52 : 64;

    STEPS.forEach((step, index) => {
      addText(this, left, y, `${index + 1}`, { size: compact ? 18 : 22, bold: true, color: UI_COLORS.accentText });
      addText(this, left + 30, y, step.title, { size: compact ? 18 : 22, bold: true });
      addText(this, left + 30, y + (compact ? 24 : 30), step.body, {
        size: compact ? 13 : 16,
        color: UI_COLORS.textMuted,
      });
      y += compact ? 56 : 70;
    });

    const progress = MissionSystem.getProgress();
    const label = progress.launches > 0 ? "CONTINUAR" : "EMPEZAR";
    this.createStartButton(left, y + (compact ? 10 : 18), compact ? width - 48 : 260, label);
  }

  drawBackdrop(width, height) {
    const stars = this.add.graphics();
    for (let i = 0; i < 120; i += 1) {
      stars.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.15, 0.7));
      stars.fillRect(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), 2, 2);
    }

    const planet = this.add.graphics();
    const radius = Math.max(width, height) * 0.55;
    planet.fillStyle(0x52d9ff, 0.12);
    planet.fillCircle(width * 0.72, height + radius * 0.62, radius + 26);
    planet.fillStyle(0x1f5f8e, 1);
    planet.fillCircle(width * 0.72, height + radius * 0.62, radius);
    planet.lineStyle(3, UI_COLORS.accent, 0.5);
    planet.strokeCircle(width * 0.72, height + radius * 0.62, radius + 90);
  }

  drawRocket(width, height, compact) {
    const build = designToBuild(loadSavedDesign());
    const minY = Math.min(...build.map((part) => part.cellY));
    const maxY = Math.max(...build.map((part) => part.cellY + PARTS_BY_ID[part.partId].gridHeight));
    const cell = Math.min((height * (compact ? 0.32 : 0.55)) / (maxY - minY), 64);
    const baseX = compact ? width - 70 : width * 0.72;
    const baseY = height - (compact ? 40 : height * 0.12);
    const rocket = this.add.container(baseX, baseY);

    build.forEach((part) => {
      const definition = PARTS_BY_ID[part.partId];
      rocket.add(
        new ShipPart(
          this,
          (part.cellX + definition.gridWidth / 2 - 11.5) * cell,
          (part.cellY + definition.gridHeight / 2 - maxY) * cell,
          definition,
          { cellSize: cell, padding: 0, showLabel: false, side: part.side },
        ),
      );
    });

    this.tweens.add({
      targets: rocket,
      y: baseY - 10,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  createStartButton(x, y, width, label) {
    const height = 58;
    const button = this.add
      .rectangle(x + width / 2, y + height / 2, width, height, 0x1f8a5f, 1)
      .setStrokeStyle(2, UI_COLORS.accent, 0.9)
      .setInteractive({ useHandCursor: true });
    addText(this, button.x, button.y, label, { size: 22, bold: true }).setOrigin(0.5);
    if (!this.sys.game.device.input.touch) {
      addText(this, x, y + height + 12, "o pulsa ENTER", { size: 13, color: UI_COLORS.textDim });
    }

    let started = false;
    const start = () => {
      if (started) {
        return;
      }
      started = true;
      this.audio.resume?.();
      this.audio.playClick?.();
      this.scene.start("BuildScene");
    };

    button.on("pointerover", () => button.setFillStyle(0x27a873, 1));
    button.on("pointerout", () => button.setFillStyle(0x1f8a5f, 1));
    button.on("pointerdown", start);
    this.input.keyboard.once("keydown-ENTER", start);
    this.input.keyboard.once("keydown-SPACE", start);
  }
}
