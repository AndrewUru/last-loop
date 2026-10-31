import Phaser from "phaser";
import { ART } from "../data/art.js";
import {
  ROCKETS,
  getPatchImagePath,
  getPatchTextureKey,
  getRocketImagePath,
  getRocketTextureKey,
} from "../data/rockets.js";
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
    this.load.image("cover-hangar", `${import.meta.env.BASE_URL}assets/cover-hangar.webp`);
    ROCKETS.forEach((rocket) => {
      this.load.image(getRocketTextureKey(rocket), getRocketImagePath(rocket));
      this.load.image(getPatchTextureKey(rocket), getPatchImagePath(rocket));
    });
    Object.values(ART).forEach((art) => this.load.image(art.key, art.path));
  }

  create() {
    const { width, height } = this.scale;
    const compact = width < 700;

    // The game renders without antialiasing, which turns scaled-down artwork
    // into jagged pixels; the artwork is smooth images, so filter it.
    [
      "cover-hangar",
      ...ROCKETS.flatMap((rocket) => [getRocketTextureKey(rocket), getPatchTextureKey(rocket)]),
      ...Object.values(ART).map((art) => art.key),
    ].forEach((key) => this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR));

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

  }

  drawBackdrop(width, height) {
    const background = this.add.image(0, 0, "cover-hangar").setOrigin(0);
    const shade = this.add.rectangle(0, 0, width, height, 0x08111b).setOrigin(0);
    const layout = ({ width, height }) => {
      // Cover the viewport without stretching the artwork. Keep the rocket
      // visible on portrait screens, with a scrim for readable menu text.
      const scale = Math.max(width / background.width, height / background.height);
      background.setScale(scale);
      const focus = width < 700 ? 0.72 : 0.5;
      background.setPosition(
        (width - background.displayWidth) * focus,
        (height - background.displayHeight) / 2,
      );
      shade.setSize(width, height).setAlpha(width < 700 ? 0.58 : 0.22);
    };
    layout({ width, height });
    this.scale.on("resize", layout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", layout);
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
