import Phaser from "phaser";
import { ART } from "../data/art.js";
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
import { UI_COLORS, addText, formatSeconds } from "../ui/theme.js";

const TALLEST = Math.max(...ROCKETS.map((rocket) => rocket.height));
const SILHOUETTE = 0x1c2c3d;
// Hangar palette, taken from the work lights and steel in the backdrop.
const AMBER = 0xf2a33a;
const AMBER_TEXT = "#ffc46b";
const PANEL = 0x0a1520;
const PANEL_EDGE = 0x4a6a8c;
// The floor colour along the bottom edge of the backdrop, for screens taller
// than the picture.
const FLOOR = 0x22283a;
// Neighbours on the side gantries are drawn smaller and in the shade.
const SIDE_SCALE = 0.62;
const SIDE_TINT = 0x9aa8ba;
const STATUS = {
  done: { label: "COMPLETADA", background: "#22508a", color: "#d6e8ff" },
  open: { label: "DISPONIBLE", background: "#1f7a4d", color: "#dcffec" },
  locked: { label: "BLOQUEADA", background: "#7a2a2a", color: "#ffdcdc" },
};
// Pilot rank, earned with missions.
const RANKS = [
  { from: 0, title: "CADETE" },
  { from: 1, title: "PILOTO" },
  { from: 3, title: "COMANDANTE" },
  { from: 6, title: "VETERANO" },
  { from: ROCKETS.length, title: "LEYENDA" },
];
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
    { label: "POTENCIA", value: (twr - 1) / 1.8 },
    { label: "COMBUSTIBLE", value: getPrediction(rocket).fuelPercent / 80 },
    { label: "AGILIDAD", value: 0.3 + controlAuthority * 2 },
  ];
}

function getStatus(rocket) {
  if (!MissionSystem.isUnlocked(rocket.id)) {
    return STATUS.locked;
  }
  return MissionSystem.isCompleted(rocket.id) ? STATUS.done : STATUS.open;
}

function drawPanel(graphics, x, y, width, height, { radius = 10, alpha = 0.86, edge = PANEL_EDGE, edgeAlpha = 0.55 } = {}) {
  graphics.fillStyle(PANEL, alpha);
  graphics.fillRoundedRect(x, y, width, height, radius);
  graphics.lineStyle(1, edge, edgeAlpha);
  graphics.strokeRoundedRect(x, y, width, height, radius);
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
    this.createBackground();
    this.createHeader();
    this.createStage();
    this.createNameCard();
    this.createCarousel();
    this.createMissionPanel();
    this.createLaunchButton();
    this.registerInput();
    this.select(this.selectedIndex, { silent: true });

    if (this.revealId === ROCKETS[this.selectedIndex].id) {
      this.playReveal();
    }
  }

  // The rocket stands on the backdrop's pedestal at (stageX, pedestalY); the
  // name card sits on the pedestal's front, the carousel on the floor below
  // and, on wide screens, the missions down the dark right side.
  computeLayout(width, height) {
    const compact = width < 760;
    const short = height < 560;
    const small = compact || short;
    const margin = compact ? 10 : 18;
    const gap = compact ? 8 : 12;
    const headerHeight = small ? 48 : 58;
    const top = headerHeight + gap;
    const bottom = height - margin;

    if (!compact) {
      const panelWidth = Phaser.Math.Clamp(Math.round(width * 0.27), 280, 360);
      const launchHeight = short ? 50 : 62;
      const thumbsHeight = Phaser.Math.Clamp(Math.round(height * 0.15), 70, 104);
      const leftWidth = width - panelWidth - margin * 2 - gap;
      const thumbs = { x: margin, y: bottom - thumbsHeight, width: leftWidth, height: thumbsHeight };
      const cardHeight = short ? 66 : 96;
      const cardWidth = Math.min(leftWidth * 0.72, 540);
      const stageX = margin + leftWidth / 2;
      const card = { x: stageX - cardWidth / 2, y: thumbs.y - gap - cardHeight, width: cardWidth, height: cardHeight };
      const panel = { x: width - margin - panelWidth, y: top, width: panelWidth, height: bottom - launchHeight - gap - top };
      return {
        compact,
        short,
        small,
        margin,
        headerHeight,
        stageX,
        pedestalY: card.y - 6,
        stageTop: top + (short ? 8 : 26),
        card,
        thumbs,
        panel,
        launch: { x: panel.x, y: bottom - launchHeight, width: panelWidth, height: launchHeight },
        sideRockets: leftWidth >= 700,
        // As many of the following missions as fit under the selected one.
        missionCards: short ? 1 : ROCKETS.length,
      };
    }

    const fullWidth = width - margin * 2;
    const launchHeight = 54;
    const thumbsHeight = Phaser.Math.Clamp(Math.round(height * 0.09), 58, 76);
    const panelHeight = Phaser.Math.Clamp(Math.round(height * 0.19), 132, 170);
    const cardHeight = 64;
    const launch = { x: margin, y: bottom - launchHeight, width: fullWidth, height: launchHeight };
    const thumbs = { x: margin, y: launch.y - gap - thumbsHeight, width: fullWidth, height: thumbsHeight };
    const panel = { x: margin, y: thumbs.y - gap - panelHeight, width: fullWidth, height: panelHeight };
    const card = { x: margin, y: panel.y - gap - cardHeight, width: fullWidth, height: cardHeight };
    return {
      compact,
      short,
      small,
      margin,
      headerHeight,
      stageX: width / 2,
      pedestalY: card.y - 6,
      stageTop: top + 10,
      card,
      thumbs,
      panel,
      launch,
      sideRockets: false,
      missionCards: 1,
    };
  }

  // The backdrop is scaled and shifted so its pedestal lands under the stage
  // and it still covers the screen sideways and above.
  createBackground() {
    const { width, height } = this.scale;
    const { stageX, pedestalY, card } = this.layout;
    const { pedestal } = ART.hangar;
    this.add.rectangle(0, 0, width, height, FLOOR).setOrigin(0);
    const backdrop = this.add.image(stageX, pedestalY, ART.hangar.key).setOrigin(pedestal.x, pedestal.y);
    backdrop.setScale(
      Math.max(
        stageX / (pedestal.x * backdrop.width),
        (width - stageX) / ((1 - pedestal.x) * backdrop.width),
        pedestalY / (pedestal.y * backdrop.height),
      ),
    );
    this.backdrop = backdrop;

    // Darken the floor behind the cards and the carousel so they read.
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x050b12, 0x050b12, 0x050b12, 0x050b12, 0, 0, 0.85, 0.85);
    shade.fillRect(0, card.y, width, height - card.y);
  }

  // Screen position of a point on the backdrop, given as shares of its size.
  backdropPoint(u, v) {
    const { pedestal } = ART.hangar;
    return {
      x: this.backdrop.x + (u - pedestal.x) * this.backdrop.displayWidth,
      y: this.backdrop.y + (v - pedestal.y) * this.backdrop.displayHeight,
    };
  }

  createHeader() {
    const { width } = this.scale;
    const { headerHeight: height, margin, compact, small } = this.layout;
    const { completed, orbits } = MissionSystem.getProgress();
    const middle = height / 2;

    const bar = this.add.graphics();
    bar.fillGradientStyle(0x050b12, 0x050b12, 0x050b12, 0x050b12, 0.95, 0.95, 0.8, 0.8);
    bar.fillRect(0, 0, width, height);
    bar.lineStyle(1, PANEL_EDGE, 0.5);
    bar.lineBetween(0, height, width, height);

    // Pilot badge: the patch of the last mission completed, and the rank.
    const radius = Math.round(height * 0.36);
    const badgeX = margin + radius;
    bar.fillStyle(0x0f1d2b, 1);
    bar.fillCircle(badgeX, middle, radius);
    bar.lineStyle(2, AMBER, 0.9);
    bar.strokeCircle(badgeX, middle, radius);
    const lastDone = [...ROCKETS].reverse().find((rocket) => completed.includes(rocket.id));
    const patch = this.add
      .image(badgeX, middle, getPatchTextureKey(lastDone || ROCKETS[0]))
      .setDisplaySize(radius * 1.7, radius * 1.7);
    if (!lastDone) {
      patch.setTint(0x6c7b8c);
    }

    const rank = [...RANKS].reverse().find((entry) => completed.length >= entry.from);
    const textX = badgeX + radius + 10;
    addText(this, textX, middle - 3, rank.title, { size: small ? 12 : 14, bold: true, letterSpacing: 1 }).setOrigin(0, 1);
    const progressWidth = small ? 80 : 120;
    bar.fillStyle(0x1d2f42, 1);
    bar.fillRoundedRect(textX, middle + 3, progressWidth, 5, 2.5);
    if (completed.length > 0) {
      bar.fillStyle(AMBER, 1);
      bar.fillRoundedRect(textX, middle + 3, Math.max(5, (progressWidth * completed.length) / ROCKETS.length), 5, 2.5);
    }
    addText(this, textX + progressWidth + 8, middle + 5, `${completed.length}/${ROCKETS.length}`, {
      size: 11,
      color: UI_COLORS.textMuted,
    }).setOrigin(0, 0.5);

    if (!compact) {
      const title = addText(this, width / 2, middle - 2, "HANGAR", {
        size: small ? 14 : 16,
        bold: true,
        color: AMBER_TEXT,
        letterSpacing: 3,
      }).setOrigin(0.5);
      bar.fillStyle(AMBER, 1);
      bar.fillRect(title.x - title.width / 2 - 8, height - 3, title.width + 16, 3);
    }

    // Counters on the right, each in its own chip.
    const chips = compact ? [`★ ${completed.length}/${ROCKETS.length}`] : [`ÓRBITAS  ${orbits}`, `★  ${completed.length}/${ROCKETS.length}`];
    let right = width - margin;
    [...chips].reverse().forEach((label) => {
      const text = addText(this, 0, middle, label, {
        size: small ? 12 : 14,
        bold: true,
        color: label.startsWith("★") ? AMBER_TEXT : UI_COLORS.text,
      }).setOrigin(1, 0.5);
      const chipWidth = text.width + 24;
      const chipHeight = small ? 26 : 30;
      drawPanel(bar, right - chipWidth, middle - chipHeight / 2, chipWidth, chipHeight, { radius: chipHeight / 2 });
      text.setX(right - 12);
      right -= chipWidth + 8;
    });
  }

  createStage() {
    const { stageX, pedestalY, stageTop, compact, sideRockets } = this.layout;
    // Every rocket shares one scale, so the tallest just fits under the header.
    this.stageScale = ((pedestalY - stageTop) * 0.97) / TALLEST;

    if (sideRockets) {
      const { bays } = ART.hangar;
      this.sideRockets = [
        { offset: -1, ...this.backdropPoint(bays.left, bays.floor) },
        { offset: 1, ...this.backdropPoint(bays.right, bays.floor) },
      ].map((side) => {
        const image = this.add
          .image(side.x, side.y, getRocketTextureKey(ROCKETS[0]))
          .setOrigin(0.5, 1)
          .setInteractive({ useHandCursor: true });
        image.on("pointerdown", () => this.select(this.selectedIndex + side.offset));
        image.on("pointerover", () => image.setAlpha(1));
        image.on("pointerout", () => image.setAlpha(0.9));
        return { ...side, image };
      });
    }

    this.rocketShadow = this.add.graphics();
    this.stageRocket = this.add.image(stageX, pedestalY + 2, getRocketTextureKey(ROCKETS[0])).setOrigin(0.5, 1);
    this.lockIcon = this.add.graphics();
    this.lockLabel = addText(this, stageX, 0, "BLOQUEADO", {
      size: compact ? 12 : 14,
      bold: true,
      color: UI_COLORS.textMuted,
      letterSpacing: 1,
    }).setOrigin(0.5, 0);
  }

  // Name, origin and the three bars, on the front of the pedestal.
  createNameCard() {
    const { card, small, short } = this.layout;
    const pad = small ? 12 : 16;
    const frame = this.add.graphics();
    drawPanel(frame, card.x, card.y, card.width, card.height, { alpha: 0.9 });
    frame.fillStyle(AMBER, 1);
    frame.fillRect(card.x, card.y + 10, 3, card.height - 20);

    const textWidth = card.width * 0.54 - pad;
    this.nameSize = small ? 18 : 24;
    this.nameMaxWidth = card.width * 0.56 - pad - 10;
    this.nameText = addText(this, card.x + pad, card.y + (small ? 9 : 12), "", {
      size: this.nameSize,
      bold: true,
      letterSpacing: 1,
    });
    this.metaText = addText(this, card.x + pad, 0, "", { size: small ? 11 : 13, color: AMBER_TEXT });
    this.factText = short || small
      ? null
      : addText(this, card.x + pad, 0, "", {
          size: 12,
          color: UI_COLORS.textMuted,
          wordWrap: { width: textWidth },
          maxLines: 2,
        });

    this.bars = this.add.graphics();
    const barsX = card.x + card.width * 0.56;
    const rowGap = (card.height - pad * 2) / 3;
    this.barRows = [0, 1, 2].map((index) => {
      const y = card.y + pad + rowGap * (index + 0.5);
      const label = addText(this, barsX, y, "", {
        size: small ? 9 : 10,
        bold: true,
        color: UI_COLORS.textMuted,
        letterSpacing: small ? 0 : 1,
      }).setOrigin(0, 0.5);
      return { y, label };
    });
    this.barX = barsX + (small ? 74 : 92);
    this.barWidth = card.x + card.width - pad - this.barX;
  }

  createCarousel() {
    const { thumbs, compact } = this.layout;
    const arrowWidth = 28;
    const gap = compact ? 6 : 8;
    const stripX = thumbs.x + arrowWidth + gap;
    const stripWidth = thumbs.width - (arrowWidth + gap) * 2;
    const minCell = compact ? 58 : 70;
    this.visibleThumbs = Math.min(ROCKETS.length, Math.floor((stripWidth + gap) / (minCell + gap)));
    this.thumbWidth = (stripWidth - gap * (this.visibleThumbs - 1)) / this.visibleThumbs;
    this.thumbGap = gap;
    this.stripX = stripX;
    const { completed } = MissionSystem.getProgress();
    const showNames = this.thumbWidth >= 66;
    const imageArea = thumbs.height - (showNames ? 26 : 12);

    this.thumbs = ROCKETS.map((rocket, index) => {
      const container = this.add.container(0, thumbs.y);
      const unlocked = MissionSystem.isUnlocked(rocket.id);
      const background = this.add
        .rectangle(0, 0, this.thumbWidth, thumbs.height, PANEL, 0.85)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      background.on("pointerdown", () => this.select(index));
      background.on("pointerover", () => index !== this.selectedIndex && background.setFillStyle(UI_COLORS.rowHover, 0.95));
      background.on("pointerout", () => background.setFillStyle(PANEL, 0.85));

      const image = this.add.image(this.thumbWidth / 2, 6 + imageArea, getRocketTextureKey(rocket)).setOrigin(0.5, 1);
      // Sizes stay relative, but a tiny rocket like Electron would vanish in a thumbnail.
      const relativeHeight = Math.max(rocket.height / TALLEST, 0.7);
      image.setScale(Math.min((imageArea * relativeHeight) / image.height, (this.thumbWidth - 12) / image.width));
      if (!unlocked) {
        image.setTintFill(SILHOUETTE);
      }
      container.add([background, image]);

      if (showNames) {
        container.add(
          addText(this, this.thumbWidth / 2, thumbs.height - 6, (rocket.shortName || rocket.name).toUpperCase(), {
            size: 10,
            bold: true,
            color: unlocked ? UI_COLORS.text : UI_COLORS.textDim,
          }).setOrigin(0.5, 1),
        );
      }
      if (completed.includes(rocket.id)) {
        container.add(addText(this, this.thumbWidth - 5, 3, "★", { size: 13, color: AMBER_TEXT }).setOrigin(1, 0));
      }
      return { container, background };
    });

    const arrowY = thumbs.y + thumbs.height / 2;
    this.createArrow(thumbs.x + arrowWidth / 2, arrowY, "‹", () => this.select(this.selectedIndex - 1));
    this.createArrow(thumbs.x + thumbs.width - arrowWidth / 2, arrowY, "›", () => this.select(this.selectedIndex + 1));
  }

  createArrow(x, y, symbol, onPress) {
    const arrow = addText(this, x, y - 3, symbol, { size: 40, color: "#9fb8d2" })
      .setOrigin(0.5)
      .setPadding(8, 4, 8, 4)
      .setInteractive({ useHandCursor: true });
    arrow.on("pointerover", () => arrow.setColor(AMBER_TEXT));
    arrow.on("pointerout", () => arrow.setColor("#9fb8d2"));
    arrow.on("pointerdown", onPress);
  }

  // Shows the cards around the selected rocket when they do not all fit.
  layoutCarousel() {
    const first = Phaser.Math.Clamp(
      this.selectedIndex - Math.floor(this.visibleThumbs / 2),
      0,
      ROCKETS.length - this.visibleThumbs,
    );
    this.thumbs.forEach(({ container, background }, index) => {
      const slot = index - first;
      const visible = slot >= 0 && slot < this.visibleThumbs;
      container.setVisible(visible).setX(this.stripX + slot * (this.thumbWidth + this.thumbGap));
      background.input.enabled = visible;
      const selected = index === this.selectedIndex;
      background.setStrokeStyle(selected ? 2 : 1, selected ? AMBER : PANEL_EDGE, selected ? 1 : 0.4);
    });
  }

  createMissionPanel() {
    const { panel, compact } = this.layout;
    this.missionFrame = this.add.graphics();
    drawPanel(this.missionFrame, panel.x, panel.y, panel.width, panel.height, { alpha: compact ? 0.9 : 0.82 });
    if (!compact) {
      addText(this, panel.x + 16, panel.y + 14, "MISIONES", { size: 14, bold: true, letterSpacing: 2 });
      const { completed } = MissionSystem.getProgress();
      addText(this, panel.x + panel.width - 16, panel.y + 14, `★ ${completed.length}/${ROCKETS.length}`, {
        size: 13,
        bold: true,
        color: AMBER_TEXT,
      }).setOrigin(1, 0);
    }
    this.missionLayer = this.add.container(0, 0);
  }

  // The selected rocket's mission in full, then the next ones in short.
  renderMissions() {
    const { panel, compact, missionCards } = this.layout;
    this.missionLayer.removeAll(true);
    const pad = compact ? 10 : 12;
    const x = panel.x + pad;
    const width = panel.width - pad * 2;
    let y = panel.y + (compact ? pad : 44);
    y += this.addMissionDetail(ROCKETS[this.selectedIndex], x, y, width) + 10;

    const later = [];
    for (let offset = 1; later.length < missionCards - 1 && offset < ROCKETS.length; offset += 1) {
      const index = this.selectedIndex + offset;
      if (index < ROCKETS.length) {
        later.push(index);
      }
    }
    later.forEach((index) => {
      if (y + 66 <= panel.y + panel.height - pad) {
        y += this.addMissionSummary(index, x, y, width) + 8;
      }
    });
  }

  addMissionDetail(rocket, x, y, width) {
    const { compact } = this.layout;
    const pad = compact ? 10 : 12;
    const patchSize = compact ? 48 : 64;
    const status = getStatus(rocket);
    const unlocked = status !== STATUS.locked;
    const layer = this.missionLayer;
    const frame = this.add.graphics();
    layer.add(frame);

    const patch = this.add
      .image(x + pad + patchSize / 2, y + pad + patchSize / 2, getPatchTextureKey(rocket))
      .setDisplaySize(patchSize, patchSize);
    if (!unlocked) {
      patch.setTint(0x3a4a5c);
    }
    const textX = x + pad + patchSize + 10;
    const textWidth = x + width - pad - textX;
    const title = addText(this, textX, y + pad - 1, rocket.challenge.title, {
      size: compact ? 15 : 17,
      bold: true,
      wordWrap: { width: textWidth },
    });
    const chip = addText(this, textX, title.y + title.height + 5, status.label, {
      size: 10,
      bold: true,
      color: status.color,
      backgroundColor: status.background,
      padding: { x: 7, y: 3 },
      letterSpacing: 1,
    });
    layer.add([patch, title, chip]);

    let body;
    if (unlocked) {
      body = describeChallenge(rocket.challenge);
    } else {
      const previous = ROCKETS[ROCKETS.indexOf(rocket) - 1];
      body = `Completa «${previous.challenge.title}» con el ${previous.name} para desbloquear este cohete.`;
    }
    let bottom = Math.max(chip.y + chip.height, y + pad + patchSize) + 8;
    const description = addText(this, x + pad, bottom, body, {
      size: compact ? 12 : 13,
      color: UI_COLORS.textMuted,
      wordWrap: { width: width - pad * 2 },
      lineSpacing: 2,
    });
    layer.add(description);
    bottom = description.y + description.height + 8;

    if (unlocked) {
      const perfect = getPrediction(rocket);
      const best = MissionSystem.getBest(rocket.id);
      const { maxTime, minFuel } = rocket.challenge;
      const next = ROCKETS[ROCKETS.indexOf(rocket) + 1];
      const rows = [
        { label: "Vuelo perfecto", value: `${formatSeconds(perfect.time)} · ${perfect.fuelPercent}%` },
        {
          label: "Tu mejor marca",
          value: best ? `${formatSeconds(best.time)} · ${best.fuelPercent}%` : "—",
          good: best && ((maxTime && best.time < maxTime) || (minFuel && best.fuelPercent >= minFuel)),
        },
      ];
      if (!compact) {
        rows.push({ label: "Desbloquea", value: next ? next.name : "Última misión" });
      }
      rows.forEach((row) => {
        layer.add(addText(this, x + pad, bottom, row.label, { size: compact ? 11 : 12, color: UI_COLORS.textMuted }));
        layer.add(
          addText(this, x + width - pad, bottom, row.value, {
            size: compact ? 11 : 12,
            bold: true,
            color: row.good ? UI_COLORS.accentText : UI_COLORS.text,
          }).setOrigin(1, 0),
        );
        bottom += compact ? 16 : 19;
      });
    }

    const height = bottom - y + pad - 6;
    const done = status === STATUS.done;
    frame.fillStyle(done ? 0x15243a : 0x0f1c29, 1);
    frame.fillRoundedRect(x, y, width, height, 8);
    frame.lineStyle(1.5, AMBER, 0.85);
    frame.strokeRoundedRect(x, y, width, height, 8);
    return height;
  }

  addMissionSummary(index, x, y, width) {
    const rocket = ROCKETS[index];
    const status = getStatus(rocket);
    const height = 62;
    const patchSize = 44;
    const background = this.add
      .rectangle(x, y, width, height, 0x0f1c29, 1)
      .setOrigin(0)
      .setStrokeStyle(1, PANEL_EDGE, 0.45)
      .setInteractive({ useHandCursor: true });
    background.on("pointerdown", () => this.select(index));
    background.on("pointerover", () => background.setFillStyle(UI_COLORS.rowHover, 1));
    background.on("pointerout", () => background.setFillStyle(0x0f1c29, 1));

    const patch = this.add
      .image(x + 10 + patchSize / 2, y + height / 2, getPatchTextureKey(rocket))
      .setDisplaySize(patchSize, patchSize);
    if (status === STATUS.locked) {
      patch.setTint(0x3a4a5c);
    }
    const textX = x + 10 + patchSize + 10;
    const title = addText(this, textX, y + 10, rocket.challenge.title, {
      size: 14,
      bold: true,
      color: status === STATUS.locked ? UI_COLORS.textMuted : UI_COLORS.text,
      wordWrap: { width: width - (textX - x) - 30 },
      maxLines: 1,
    });
    const star = addText(this, x + width - 10, y + 10, status === STATUS.done ? "★" : "☆", {
      size: 14,
      color: status === STATUS.done ? AMBER_TEXT : UI_COLORS.textDim,
    }).setOrigin(1, 0);
    const chip = addText(this, textX, y + height - 10, status.label, {
      size: 9,
      bold: true,
      color: status.color,
      backgroundColor: status.background,
      padding: { x: 6, y: 2 },
      letterSpacing: 1,
    }).setOrigin(0, 1);
    this.missionLayer.add([background, patch, title, star, chip]);
    return height;
  }

  createLaunchButton() {
    const { launch, compact } = this.layout;
    this.launchGraphics = this.add.graphics();
    const centerY = launch.y + launch.height / 2;
    this.launchLabel = addText(this, launch.x + launch.width / 2, centerY, "", {
      size: compact ? 19 : 19,
      bold: true,
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.launchHint = addText(this, launch.x + launch.width - 12, centerY, compact ? "" : "ENTER", {
      size: 10,
      bold: true,
      color: "#6b4510",
    }).setOrigin(1, 0.5);
    this.launchHover = false;

    const zone = this.add
      .zone(launch.x, launch.y, launch.width, launch.height)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerover", () => {
      this.launchHover = true;
      this.drawLaunchButton();
    });
    zone.on("pointerout", () => {
      this.launchHover = false;
      this.drawLaunchButton();
    });
    zone.on("pointerdown", () => this.launchRocket());
  }

  drawLaunchButton() {
    const { launch, compact } = this.layout;
    const { x, y, width, height } = launch;
    const enabled = this.selectedUnlocked;
    const graphics = this.launchGraphics;
    graphics.clear();

    if (enabled) {
      graphics.fillStyle(AMBER, 0.18);
      graphics.fillRoundedRect(x - 3, y - 3, width + 6, height + 6, 12);
      graphics.fillStyle(this.launchHover ? 0xffb84d : AMBER, 1);
      graphics.fillRoundedRect(x, y, width, height, 10);
      graphics.fillStyle(0xffe1a0, 0.32);
      graphics.fillRoundedRect(x + 3, y + 3, width - 6, height * 0.42, 8);
      graphics.lineStyle(2, 0xffd88a, 1);
      graphics.strokeRoundedRect(x, y, width, height, 10);
    } else {
      graphics.fillStyle(0x1e2733, 0.95);
      graphics.fillRoundedRect(x, y, width, height, 10);
      graphics.lineStyle(2, 0x4a5a6b, 0.9);
      graphics.strokeRoundedRect(x, y, width, height, 10);
    }

    // The long label only where it fits beside the ENTER hint.
    const long = !compact && width >= 330;
    this.launchLabel
      .setText(enabled ? (long ? "INICIAR LANZAMIENTO" : "¡LANZAR!") : "BLOQUEADO")
      .setColor(enabled ? "#1b1206" : "#7d8a99");
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

    this.layoutCarousel();
    this.renderStage(rocket);
    this.renderNameCard(rocket);
    this.renderMissions();
    this.drawLaunchButton();
  }

  renderStage(rocket) {
    const { stageX, pedestalY } = this.layout;
    this.tweens.killTweensOf(this.stageRocket);
    const image = this.stageRocket.setTexture(getRocketTextureKey(rocket));
    image.setScale((rocket.height * this.stageScale) / image.height);
    if (this.selectedUnlocked) {
      image.clearTint();
    } else {
      image.setTintFill(SILHOUETTE);
    }

    // A soft contact shadow so the rocket sits on the pedestal.
    this.rocketShadow.clear();
    this.rocketShadow.fillStyle(0x000000, 0.4);
    this.rocketShadow.fillEllipse(stageX, pedestalY + 1, image.displayWidth * 1.5, Math.max(6, image.displayWidth * 0.12), 24);

    this.sideRockets?.forEach((side) => {
      const neighbour = ROCKETS[Phaser.Math.Wrap(this.selectedIndex + side.offset, 0, ROCKETS.length)];
      side.image.setTexture(getRocketTextureKey(neighbour)).setAlpha(0.9);
      side.image.setScale((neighbour.height * this.stageScale * SIDE_SCALE) / side.image.height);
      if (MissionSystem.isUnlocked(neighbour.id)) {
        side.image.setTint(SIDE_TINT);
      } else {
        side.image.setTintFill(SILHOUETTE);
      }
      // Never let a neighbour slide under the missions panel.
      side.image.setVisible(side.image.x + side.image.displayWidth / 2 < this.layout.panel.x - 8);
    });

    this.lockIcon.clear();
    this.lockLabel.setVisible(!this.selectedUnlocked);
    if (!this.selectedUnlocked) {
      const lockY = pedestalY - image.displayHeight * 0.5;
      this.drawLock(stageX, lockY);
      this.lockLabel.setY(lockY + 26);
    }
  }

  renderNameCard(rocket) {
    const { small } = this.layout;
    const unlocked = this.selectedUnlocked;
    // Long names shrink until they clear the bars beside them; past a point
    // the short name reads better than tiny letters.
    const fit = (name, minSize) => {
      let size = this.nameSize;
      this.nameText.setFontSize(size).setText(name.toUpperCase());
      while (this.nameText.width > this.nameMaxWidth && size > minSize) {
        size -= 1;
        this.nameText.setFontSize(size);
      }
      return this.nameText.width <= this.nameMaxWidth;
    };
    if (!fit(rocket.name, 15) && rocket.shortName) {
      fit(rocket.shortName, 12);
    }
    this.metaText
      .setText(`${rocket.year} · ${rocket.country} · ${rocket.realHeight} m`)
      .setY(this.nameText.y + this.nameText.height + 2);
    this.factText?.setText(rocket.fact).setY(this.metaText.y + this.metaText.height + 4);

    this.bars.clear();
    getRatings(rocket).forEach((rating, index) => {
      const row = this.barRows[index];
      const height = small ? 6 : 8;
      const value = Phaser.Math.Clamp(rating.value, 0.05, 1);
      row.label.setText(rating.label);
      this.bars.fillStyle(0x1d2f42, 1);
      this.bars.fillRoundedRect(this.barX, row.y - height / 2, this.barWidth, height, height / 2);
      this.bars.fillStyle(unlocked ? AMBER : 0x4a5a6b, 1);
      this.bars.fillRoundedRect(this.barX, row.y - height / 2, Math.max(height, this.barWidth * value), height, height / 2);
    });
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

  // A rocket just unlocked: show its silhouette, then flash it into colour.
  playReveal() {
    const { stageX, stageTop, small } = this.layout;
    const image = this.stageRocket;
    const baseScale = image.scale;
    image.setTintFill(SILHOUETTE);

    this.revealBanner = addText(this, stageX, stageTop - 14, "★ ¡NUEVO COHETE!", {
      size: small ? 14 : 18,
      bold: true,
      color: AMBER_TEXT,
      letterSpacing: 1,
    })
      .setOrigin(0.5, 0)
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
