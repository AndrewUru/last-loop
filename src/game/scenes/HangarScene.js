import Phaser from "phaser";
import {
  ROCKETS,
  describeChallenge,
  getPatchTextureKey,
  getRocketTextureKey,
  loadSelectedRocketId,
  saveSelectedRocketId,
} from "../data/rockets.js";
import FlightPredictor from "../systems/FlightPredictor.js";
import MissionSystem from "../systems/MissionSystem.js";
import { UI_COLORS, addText, drawPanel, formatSeconds } from "../ui/theme.js";

const TALLEST = Math.max(...ROCKETS.map((rocket) => rocket.height));
const SILHOUETTE = 0x1c2c3d;
const predictions = new Map();

// What a perfect pilot gets out of each rocket. The numbers never change, so
// each rocket is only flown once per session.
function getPrediction(rocket) {
  if (!predictions.has(rocket.id)) {
    predictions.set(rocket.id, FlightPredictor.predict(rocket.stats));
  }
  return predictions.get(rocket.id);
}

// 0-1 scores for the bars, read from the same numbers the physics uses.
function getRatings(rocket) {
  const { twr, controlAuthority } = rocket.stats;
  return [
    { label: "Potencia", value: (twr - 1) / 1.8 },
    { label: "Combustible", value: getPrediction(rocket).fuelPercent / 80 },
    { label: "Agilidad", value: 0.3 + controlAuthority * 2 },
  ];
}

export default class HangarScene extends Phaser.Scene {
  constructor() {
    super({ key: "HangarScene" });
  }

  init(data = {}) {
    const wanted = data.rocketId || loadSelectedRocketId();
    this.selectedIndex = Math.max(0, ROCKETS.findIndex((rocket) => rocket.id === wanted));
    this.revealId = data.revealId || null;
    this.audio = this.registry.get("audio");
  }

  create() {
    this.cameras.main.setBackgroundColor(UI_COLORS.background);
    this.layout = this.computeLayout(this.scale.width, this.scale.height);
    this.drawBackground();
    this.createHeader();
    this.createStage();
    this.createThumbnails();
    this.createInfoPanel();
    this.createLaunchButton();
    this.registerInput();
    this.select(this.selectedIndex, { silent: true });

    if (this.revealId === ROCKETS[this.selectedIndex].id) {
      this.playReveal();
    }
  }

  computeLayout(width, height) {
    const compact = width < 760;
    const short = height < 560;
    const small = compact || short;
    const margin = compact ? 12 : 20;
    const gap = Math.round(margin * 0.6);
    const headerHeight = small ? 50 : 64;
    const header = { x: margin, y: margin, width: width - margin * 2, height: headerHeight };
    const top = header.y + headerHeight + gap;
    const bottom = height - margin;

    if (!compact) {
      const infoWidth = Phaser.Math.Clamp(Math.round(width * 0.32), 300, 380);
      const launchHeight = short ? 52 : 60;
      const thumbsHeight = Phaser.Math.Clamp(Math.round(height * 0.16), 76, 116);
      const leftWidth = width - infoWidth - margin * 2 - gap;
      const thumbs = { x: margin, y: bottom - thumbsHeight, width: leftWidth, height: thumbsHeight };
      const info = { x: width - margin - infoWidth, y: top, width: infoWidth };
      info.height = bottom - launchHeight - gap - top;
      return {
        compact,
        small,
        header,
        stage: { x: margin, y: top, width: leftWidth, height: thumbs.y - gap - top },
        thumbs,
        info,
        launch: { x: info.x, y: bottom - launchHeight, width: infoWidth, height: launchHeight },
      };
    }

    const fullWidth = width - margin * 2;
    const launchHeight = 54;
    const thumbsHeight = Phaser.Math.Clamp(Math.round(height * 0.1), 60, 80);
    const infoHeight = Phaser.Math.Clamp(Math.round(height * 0.3), 204, 240);
    const launch = { x: margin, y: bottom - launchHeight, width: fullWidth, height: launchHeight };
    const info = { x: margin, y: launch.y - gap - infoHeight, width: fullWidth, height: infoHeight };
    const thumbs = { x: margin, y: info.y - gap - thumbsHeight, width: fullWidth, height: thumbsHeight };
    return {
      compact,
      small,
      header,
      stage: { x: margin, y: top, width: fullWidth, height: thumbs.y - gap - top },
      thumbs,
      info,
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
    const { header, stage, info } = this.layout;
    drawPanel(panels, header.x, header.y, header.width, header.height);
    drawPanel(panels, info.x, info.y, info.width, info.height);
    drawPanel(panels, stage.x, stage.y, stage.width, stage.height, { alpha: 0.35, edgeAlpha: 0.12 });
  }

  createHeader() {
    const { header, compact, small } = this.layout;
    const pad = compact ? 12 : 18;
    const { completed } = MissionSystem.getProgress();

    if (small) {
      addText(this, header.x + pad, header.y + header.height / 2, "Elige tu cohete", { size: 18, bold: true }).setOrigin(
        0,
        0.5,
      );
    } else {
      addText(this, header.x + pad, header.y + 10, "HANGAR", { size: 12, bold: true, color: UI_COLORS.textMuted });
      addText(this, header.x + pad, header.y + 28, "Elige tu cohete", { size: 22, bold: true });
    }

    // A row of stars does not fit next to the title on a phone.
    const stars = compact ? "★" : ROCKETS.map((rocket) => (completed.includes(rocket.id) ? "★" : "☆")).join(" ");
    const right = header.x + header.width - pad;
    const count = addText(this, right, header.y + header.height / 2, `${completed.length}/${ROCKETS.length}`, {
      size: small ? 13 : 15,
      bold: true,
      color: UI_COLORS.textMuted,
    }).setOrigin(1, 0.5);
    addText(this, right - count.width - 10, header.y + header.height / 2, stars, {
      size: small ? 16 : 20,
      color: UI_COLORS.warningText,
    }).setOrigin(1, 0.5);
  }

  createStage() {
    const { stage, compact, small } = this.layout;
    const pad = small ? 12 : 22;
    // On wide screens the rocket stands right of the text; on phones it is centred.
    this.stageCenterX = compact ? stage.x + stage.width / 2 : stage.x + stage.width * 0.66;
    this.stageGroundY = stage.y + stage.height - (compact ? 16 : 30);
    // Leave the top of the stage for the name, even for the tallest rocket.
    this.stageScale = (stage.height * (compact ? 0.72 : 0.84)) / TALLEST;

    const floor = this.add.graphics();
    floor.fillStyle(UI_COLORS.accent, 0.07);
    floor.fillEllipse(this.stageCenterX, this.stageGroundY + 2, Math.min(stage.width * 0.7, 360), 30);
    floor.fillStyle(0x3a4654, 1);
    floor.fillRect(this.stageCenterX - 60, this.stageGroundY, 120, 6);

    this.stageRocket = this.add.image(this.stageCenterX, this.stageGroundY, getRocketTextureKey(ROCKETS[0])).setOrigin(
      0.5,
      1,
    );
    this.lockIcon = this.add.graphics();
    this.lockLabel = addText(this, this.stageCenterX, 0, "BLOQUEADO", {
      size: compact ? 12 : 14,
      bold: true,
      color: UI_COLORS.textMuted,
    }).setOrigin(0.5, 0);

    this.nameText = addText(this, stage.x + pad, stage.y + pad - 4, "", {
      size: small ? 22 : 30,
      bold: true,
      wordWrap: { width: compact ? stage.width * 0.6 : stage.width * 0.46 },
    });
    this.metaText = addText(this, stage.x + pad, 0, "", { size: small ? 12 : 14, color: UI_COLORS.textMuted });
    this.factText = compact
      ? null
      : addText(this, stage.x + pad, 0, "", {
          size: small ? 13 : 15,
          color: UI_COLORS.text,
          wordWrap: { width: stage.width * 0.42 },
          lineSpacing: 4,
        });

    // Wide screens have the keyboard and room for the text; phones get arrows.
    if (compact) {
      const arrowY = stage.y + stage.height * 0.55;
      this.createArrow(stage.x + 22, arrowY, "◀", () => this.select(this.selectedIndex - 1));
      this.createArrow(stage.x + stage.width - 22, arrowY, "▶", () => this.select(this.selectedIndex + 1));
    }
  }

  createArrow(x, y, symbol, onPress) {
    const arrow = addText(this, x, y, symbol, { size: 22, color: "#9fd7ff" })
      .setOrigin(0.5)
      .setPadding(10, 14, 10, 14)
      .setInteractive({ useHandCursor: true });
    arrow.on("pointerover", () => arrow.setColor("#d6f1ff"));
    arrow.on("pointerout", () => arrow.setColor("#9fd7ff"));
    arrow.on("pointerdown", onPress);
  }

  createThumbnails() {
    const { thumbs, compact } = this.layout;
    const gap = compact ? 6 : 10;
    const cellWidth = (thumbs.width - gap * (ROCKETS.length - 1)) / ROCKETS.length;
    const showNames = cellWidth >= 70;
    const imageArea = thumbs.height - (showNames ? 26 : 12);
    const { completed } = MissionSystem.getProgress();

    this.thumbs = ROCKETS.map((rocket, index) => {
      const x = thumbs.x + index * (cellWidth + gap);
      const centerX = x + cellWidth / 2;
      const unlocked = MissionSystem.isUnlocked(rocket.id);
      const background = this.add
        .rectangle(centerX, thumbs.y + thumbs.height / 2, cellWidth, thumbs.height, UI_COLORS.panel, 0.85)
        .setInteractive({ useHandCursor: true });
      background.on("pointerdown", () => this.select(index));
      background.on("pointerover", () => index !== this.selectedIndex && background.setFillStyle(UI_COLORS.rowHover, 1));
      background.on("pointerout", () => background.setFillStyle(UI_COLORS.panel, 0.85));

      const image = this.add.image(centerX, thumbs.y + 6 + imageArea, getRocketTextureKey(rocket)).setOrigin(0.5, 1);
      // Sizes stay relative, but a tiny rocket like Electron would vanish in a thumbnail.
      const relativeHeight = Math.max(rocket.height / TALLEST, 0.7);
      image.setScale(Math.min((imageArea * relativeHeight) / image.height, (cellWidth - 12) / image.width));
      if (!unlocked) {
        image.setTintFill(SILHOUETTE);
      }

      if (showNames) {
        addText(this, centerX, thumbs.y + thumbs.height - 6, rocket.shortName || rocket.name, {
          size: 12,
          bold: true,
          color: unlocked ? UI_COLORS.text : UI_COLORS.textDim,
        }).setOrigin(0.5, 1);
      }
      if (completed.includes(rocket.id)) {
        addText(this, x + cellWidth - 5, thumbs.y + 3, "★", { size: 14, color: UI_COLORS.warningText }).setOrigin(1, 0);
      }

      return { background };
    });
  }

  createInfoPanel() {
    const { info, small } = this.layout;
    const pad = small ? 12 : 18;
    const innerWidth = info.width - pad * 2;
    let y = info.y + pad;

    this.bars = this.add.graphics();
    this.barRows = [0, 1, 2].map(() => {
      const label = addText(this, info.x + pad, y, "", { size: small ? 12 : 14, color: UI_COLORS.textMuted });
      const row = { y: y + label.height / 2, label };
      y += small ? 20 : 26;
      return row;
    });
    this.barX = info.x + pad + (small ? 92 : 108);
    this.barWidth = info.x + info.width - pad - this.barX;

    y += small ? 6 : 12;
    const cardPad = small ? 10 : 14;
    this.challengeCard = { x: info.x + pad, y, width: innerWidth, maxHeight: info.y + info.height - pad - y, pad: cardPad };
    this.challengeFrame = this.add.graphics();
    const textX = this.challengeCard.x + cardPad;
    // The mission patch sits in the card's top right corner; the text wraps beside it.
    this.patchSize = small ? 48 : 72;
    this.challengePatch = this.add
      .image(
        this.challengeCard.x + innerWidth - cardPad - this.patchSize / 2,
        y + cardPad + this.patchSize / 2,
        getPatchTextureKey(ROCKETS[0]),
      )
      .setDisplaySize(this.patchSize, this.patchSize);
    const textWidth = innerWidth - cardPad * 2 - this.patchSize - 8;
    this.challengeLabel = addText(this, textX, y + cardPad - 2, "", {
      size: small ? 11 : 12,
      bold: true,
      color: UI_COLORS.warningText,
    });
    this.challengeTitle = addText(this, textX, 0, "", { size: small ? 15 : 18, bold: true, wordWrap: { width: textWidth } });
    this.challengeBody = addText(this, textX, 0, "", {
      size: small ? 12 : 14,
      color: UI_COLORS.textMuted,
      wordWrap: { width: textWidth },
      lineSpacing: 3,
    });
    this.challengeFooter = addText(this, textX, 0, "", {
      size: small ? 11 : 13,
      color: UI_COLORS.textMuted,
      wordWrap: { width: textWidth },
      lineSpacing: 2,
    });

    // Small screens stop at the challenge card.
    if (small) {
      return;
    }
    this.recordTitle = addText(this, info.x + pad, 0, "TU MEJOR MARCA", { size: 12, bold: true, color: UI_COLORS.textMuted });
    this.recordEmpty = addText(this, info.x + pad, 0, "Aún no has llegado a la órbita con este cohete.", {
      size: 14,
      color: UI_COLORS.textDim,
      wordWrap: { width: innerWidth },
    });
    this.recordRows = ["Tiempo", "Combustible"].map((text) => ({
      label: addText(this, info.x + pad, 0, text, { size: 15, color: UI_COLORS.textMuted }),
      value: addText(this, info.x + info.width - pad, 0, "", { size: 15, bold: true }).setOrigin(1, 0),
    }));
  }

  createLaunchButton() {
    const { launch, compact } = this.layout;
    this.launchButton = this.add
      .rectangle(launch.x + launch.width / 2, launch.y + launch.height / 2, launch.width, launch.height, 0x1f8a5f, 1)
      .setStrokeStyle(2, UI_COLORS.accent, 0.9)
      .setInteractive({ useHandCursor: true });
    this.launchLabel = addText(this, this.launchButton.x, this.launchButton.y, "", {
      size: compact ? 20 : 24,
      bold: true,
    }).setOrigin(0.5);
    this.launchHint = addText(this, launch.x + launch.width - 12, this.launchButton.y, compact ? "" : "ENTER", {
      size: 11,
      color: "#c9f7e3",
      bold: true,
    }).setOrigin(1, 0.5);

    this.launchButton.on("pointerover", () => this.selectedUnlocked && this.launchButton.setFillStyle(0x27a873, 1));
    this.launchButton.on("pointerout", () => this.updateLaunchButton());
    this.launchButton.on("pointerdown", () => this.launchRocket());
  }

  updateLaunchButton() {
    const enabled = this.selectedUnlocked;
    this.launchButton.setFillStyle(enabled ? 0x1f8a5f : 0x2a3542, 1);
    this.launchButton.setStrokeStyle(2, enabled ? UI_COLORS.accent : 0x4a5a6b, 0.9);
    this.launchLabel.setText(enabled ? "¡LANZAR!" : "BLOQUEADO").setAlpha(enabled ? 1 : 0.45);
    this.launchHint.setAlpha(enabled ? 1 : 0);
  }

  registerInput() {
    const previous = () => this.select(this.selectedIndex - 1);
    const next = () => this.select(this.selectedIndex + 1);
    this.input.keyboard.on("keydown-LEFT", previous);
    this.input.keyboard.on("keydown-A", previous);
    this.input.keyboard.on("keydown-RIGHT", next);
    this.input.keyboard.on("keydown-D", next);
    this.input.keyboard.on("keydown-ENTER", this.launchRocket, this);
    this.input.keyboard.on("keydown-SPACE", this.launchRocket, this);
    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off("keydown-LEFT", previous);
      this.input.keyboard.off("keydown-A", previous);
      this.input.keyboard.off("keydown-RIGHT", next);
      this.input.keyboard.off("keydown-D", next);
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
    this.time.delayedCall(30, () => this.scene.restart({ rocketId: ROCKETS[this.selectedIndex].id }));
  }

  select(index, { silent = false } = {}) {
    this.selectedIndex = Phaser.Math.Wrap(index, 0, ROCKETS.length);
    const rocket = ROCKETS[this.selectedIndex];
    this.selectedUnlocked = MissionSystem.isUnlocked(rocket.id);
    if (this.selectedUnlocked) {
      saveSelectedRocketId(rocket.id);
    }
    if (!silent) {
      this.audio?.playClick?.();
      this.revealBanner?.setVisible(false);
    }

    this.thumbs.forEach(({ background }, thumbIndex) => {
      const selected = thumbIndex === this.selectedIndex;
      background.setStrokeStyle(selected ? 2 : 1, selected ? UI_COLORS.accent : UI_COLORS.panelEdge, selected ? 0.95 : 0.2);
    });

    this.renderStage(rocket);
    this.renderInfo(rocket);
    this.updateLaunchButton();
  }

  renderStage(rocket) {
    this.tweens.killTweensOf(this.stageRocket);
    const image = this.stageRocket.setTexture(getRocketTextureKey(rocket));
    image.setScale((rocket.height * this.stageScale) / image.height);
    if (this.selectedUnlocked) {
      image.clearTint();
    } else {
      image.setTintFill(SILHOUETTE);
    }

    this.lockIcon.clear();
    this.lockLabel.setVisible(!this.selectedUnlocked);
    if (!this.selectedUnlocked) {
      const lockY = this.stageGroundY - image.displayHeight * 0.5;
      this.drawLock(this.stageCenterX, lockY);
      this.lockLabel.setY(lockY + 26);
    }

    this.nameText.setText(rocket.name);
    this.metaText
      .setText(`${rocket.year} · ${rocket.country} · ${rocket.realHeight} m de altura`)
      .setY(this.nameText.y + this.nameText.height + 2);
    this.factText?.setText(rocket.fact).setY(this.metaText.y + this.metaText.height + (this.layout.small ? 8 : 14));
  }

  drawLock(x, y) {
    const lock = this.lockIcon;
    lock.fillStyle(UI_COLORS.background, 0.9);
    lock.fillCircle(x, y, 22);
    lock.lineStyle(3, 0x9fb4c8, 1);
    lock.beginPath();
    lock.arc(x, y - 6, 6, Math.PI, 0);
    lock.strokePath();
    lock.lineBetween(x - 6, y - 6, x - 6, y - 2);
    lock.lineBetween(x + 6, y - 6, x + 6, y - 2);
    lock.fillStyle(0x9fb4c8, 1);
    lock.fillRoundedRect(x - 9, y - 2, 18, 13, 3);
  }

  renderInfo(rocket) {
    const { small } = this.layout;
    const unlocked = this.selectedUnlocked;
    this.bars.clear();
    getRatings(rocket).forEach((rating, index) => {
      const row = this.barRows[index];
      const height = small ? 8 : 10;
      const value = Phaser.Math.Clamp(rating.value, 0.05, 1);
      row.label.setText(rating.label);
      this.bars.fillStyle(0x1d2f42, 1);
      this.bars.fillRoundedRect(this.barX, row.y - height / 2, this.barWidth, height, height / 2);
      this.bars.fillStyle(unlocked ? UI_COLORS.accent : 0x4a5a6b, 1);
      this.bars.fillRoundedRect(this.barX, row.y - height / 2, this.barWidth * value, height, height / 2);
    });

    const index = ROCKETS.indexOf(rocket);
    const done = MissionSystem.isCompleted(rocket.id);
    const card = this.challengeCard;
    let label;
    let title;
    let body;
    let footer;

    if (!unlocked) {
      const previous = ROCKETS[index - 1];
      label = "BLOQUEADO";
      title = "Desbloquéalo";
      body = `Completa la misión «${previous.challenge.title}» con el ${previous.name}.`;
      footer = "";
    } else {
      const next = ROCKETS[index + 1];
      const best = getPrediction(rocket);
      label = done ? "★ MISIÓN CUMPLIDA" : "☆ MISIÓN";
      title = rocket.challenge.title;
      body = describeChallenge(rocket.challenge);
      const lines = [next ? `Desbloquea: ${next.name}` : "Es la última misión"];
      // Small screens have no room for the reference flight.
      if (!small) {
        lines.push(`Vuelo perfecto: ${formatSeconds(best.time)} · sobra un ${best.fuelPercent}%`);
      }
      footer = lines.join("\n");
    }

    this.challengeLabel.setText(label).setColor(unlocked ? UI_COLORS.warningText : UI_COLORS.textMuted);
    this.challengeTitle.setText(title).setY(this.challengeLabel.y + this.challengeLabel.height + 4);
    this.challengeBody.setText(body).setY(this.challengeTitle.y + this.challengeTitle.height + 4);
    this.challengeFooter.setText(footer).setY(this.challengeBody.y + this.challengeBody.height + (small ? 6 : 10));

    // In colour once earned, faded while it is still to win, a shadow while locked.
    this.challengePatch.setTexture(getPatchTextureKey(rocket)).setDisplaySize(this.patchSize, this.patchSize);
    if (!unlocked) {
      this.challengePatch.setTintFill(0x2a3a4c).setAlpha(1);
    } else if (done) {
      this.challengePatch.clearTint().setAlpha(1);
    } else {
      this.challengePatch.setTint(0x8a96a3).setAlpha(0.55);
    }

    const last = footer ? this.challengeFooter : this.challengeBody;
    const textBottom = Math.max(last.y + last.height, card.y + card.pad + this.patchSize);
    const height = Math.min(textBottom + card.pad - card.y, card.maxHeight);
    this.challengeFrame.clear();
    this.challengeFrame.fillStyle(done ? 0x2a2a14 : 0x101c28, 1);
    this.challengeFrame.fillRoundedRect(card.x, card.y, card.width, height, 10);
    this.challengeFrame.lineStyle(1, done ? UI_COLORS.warning : UI_COLORS.panelEdge, done ? 0.6 : 0.25);
    this.challengeFrame.strokeRoundedRect(card.x, card.y, card.width, height, 10);

    this.renderRecord(rocket, card.y + height + 22);
  }

  // Best time and best leftover fuel, each from the player's best flight for it,
  // in green once they are good enough for the challenge.
  renderRecord(rocket, y) {
    if (!this.recordTitle) {
      return;
    }
    const best = this.selectedUnlocked ? MissionSystem.getBest(rocket.id) : null;
    this.recordTitle.setVisible(this.selectedUnlocked).setY(y);
    this.recordEmpty.setVisible(this.selectedUnlocked && !best).setY(y + 22);
    this.recordRows.forEach((row) => {
      row.label.setVisible(Boolean(best));
      row.value.setVisible(Boolean(best));
    });
    if (!best) {
      return;
    }

    const { maxTime, minFuel } = rocket.challenge;
    const values = [
      { text: formatSeconds(best.time), good: maxTime && best.time < maxTime },
      { text: `${best.fuelPercent}%`, good: minFuel && best.fuelPercent >= minFuel },
    ];
    this.recordRows.forEach((row, index) => {
      const rowY = y + 24 + index * 26;
      row.label.setY(rowY);
      row.value
        .setY(rowY)
        .setText(values[index].text)
        .setColor(values[index].good ? UI_COLORS.accentText : UI_COLORS.text);
    });
  }

  // A rocket just unlocked: show its silhouette, then flash it into colour.
  playReveal() {
    const { stage, small } = this.layout;
    const image = this.stageRocket;
    const baseScale = image.scale;
    image.setTintFill(SILHOUETTE);

    // Bottom left of the stage is the one corner neither the text nor the rocket uses.
    this.revealBanner = addText(this, stage.x + (small ? 12 : 22), this.stageGroundY, "★ ¡NUEVO COHETE!", {
      size: small ? 14 : 18,
      bold: true,
      color: UI_COLORS.warningText,
    })
      .setOrigin(0, 1)
      .setAlpha(0);

    this.time.delayedCall(550, () => {
      if (ROCKETS[this.selectedIndex].id !== this.revealId) {
        return;
      }
      this.cameras.main.flash(260, 255, 255, 255);
      this.audio?.playSuccess?.();
      image.clearTint();
      this.tweens.add({ targets: image, scale: baseScale * 1.06, duration: 160, yoyo: true, ease: "Quad.easeOut" });
      this.tweens.add({ targets: this.revealBanner, alpha: 1, duration: 240 });
    });
  }

  launchRocket(event) {
    // A key held down from the previous screen must not launch straight away.
    if (event?.repeat) {
      return;
    }
    if (!this.selectedUnlocked) {
      this.audio?.playError?.();
      return;
    }

    this.audio?.playClick?.();
    this.scene.start("FlightScene", { rocketId: ROCKETS[this.selectedIndex].id });
  }
}
