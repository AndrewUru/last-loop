import Phaser from "phaser";
import { ROCKETS, getRocketImagePath, getRocketTextureKey } from "../data/rockets.js";
import AudioSystem from "../systems/AudioSystem.js";
import MissionSystem from "../systems/MissionSystem.js";
import { UI_COLORS, addText } from "../ui/theme.js";

const STEPS = [
  { title: "Elige", body: "Escoge un cohete en el hangar." },
  { title: "Despega", body: "Mantén pulsado el impulso." },
  { title: "Orbita", body: "Sigue la flecha hasta el anillo verde." },
];

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    ROCKETS.forEach((rocket) => this.load.image(getRocketTextureKey(rocket), getRocketImagePath(rocket)));
  }

  create() {
    const { width, height } = this.scale;
    const compact = width < 700;

    // The game renders without antialiasing, which turns scaled-down artwork
    // into jagged pixels; rockets are smooth images, so filter them.
    ROCKETS.forEach((rocket) => {
      this.textures.get(getRocketTextureKey(rocket)).setFilter(Phaser.Textures.FilterMode.LINEAR);
    });

    this.audio = this.registry.get("audio") || new AudioSystem();
    this.audio.init();
    this.registry.set("audio", this.audio);

    this.cameras.main.setBackgroundColor(UI_COLORS.background);
    this.drawBackdrop(width, height);

    const left = compact ? 24 : Math.max(40, width * 0.1);
    const textWidth = compact ? width - 48 : Math.min(560, width * 0.5);
    let y = compact ? height * 0.08 : height * 0.18;

    addText(this, left, y, "LAST LOOP", { size: compact ? 44 : 72, bold: true });
    y += compact ? 56 : 88;
    addText(this, left, y, "Pilota cohetes legendarios y ponlos en órbita.", {
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
    const buttonY = y + (compact ? 10 : 18);
    this.createStartButton(left, buttonY, compact ? width - 48 : 260, label);

    if (compact) {
      const top = buttonY + 110;
      this.drawLineup(24, top, width - 48, height - 24 - top);
    } else {
      const x = Math.max(left + textWidth + 40, width * 0.52);
      this.drawLineup(x, height * 0.2, width - 40 - x, height * 0.68);
    }
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

  // The whole collection standing side by side; locked rockets are silhouettes.
  drawLineup(x, y, width, height) {
    if (width < 120 || height < 60) {
      return;
    }

    const tallest = Math.max(...ROCKETS.map((rocket) => rocket.height));
    const images = ROCKETS.map((rocket) => {
      const image = this.add.image(0, 0, getRocketTextureKey(rocket)).setOrigin(0.5, 1);
      image.setScale(rocket.height / tallest / image.height);
      if (!MissionSystem.isUnlocked(rocket.id)) {
        image.setTintFill(0x1c2c3d);
      }
      return image;
    });

    // Fit the row: images are scaled to 1 unit for the tallest rocket, so the
    // total width at that size tells how big the row can be drawn.
    const gap = 0.04;
    const rowWidth = images.reduce((sum, image) => sum + image.displayWidth, 0) + gap * (images.length - 1);
    const size = Math.min(height, width / rowWidth);
    const baseY = y + height;
    let cursor = x + (width - rowWidth * size) / 2;

    images.forEach((image, index) => {
      const rocketWidth = image.displayWidth * size;
      image.setScale(image.scale * size).setPosition(cursor + rocketWidth / 2, baseY);
      cursor += rocketWidth + gap * size;
      this.tweens.add({
        targets: image,
        y: baseY - 6,
        duration: 1800,
        delay: index * 160,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
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
      this.scene.start("HangarScene");
    };

    button.on("pointerover", () => button.setFillStyle(0x27a873, 1));
    button.on("pointerout", () => button.setFillStyle(0x1f8a5f, 1));
    button.on("pointerdown", start);
    this.input.keyboard.once("keydown-ENTER", start);
    this.input.keyboard.once("keydown-SPACE", start);
  }
}
