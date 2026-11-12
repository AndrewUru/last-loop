import { describeChallenge, getPatchTextureKey } from "../../data/rockets.js";
import { FX_COLORS, confetti, shockwave, sparkles, transitionTo } from "../../fx/Fx.js";
import MissionSystem from "../../systems/MissionSystem.js";
import { UI_FONT, formatSeconds } from "../../ui/theme.js";

const BUTTON_WIDTH = 220;
const BUTTON_HEIGHT = 52;

export const flightSceneOverlayMethods = {
  createMissionOverlay() {
    this.resultOverlay = this.add.container(0, 0).setDepth(120).setVisible(false);
    this.resultShade = this.add.rectangle(0, 0, 10, 10, 0x05080c, 0.62).setOrigin(0);
    this.resultPanel = this.add.graphics();
    this.resultTitle = this.add
      .text(0, 0, "", { fontFamily: UI_FONT, fontSize: "36px", color: "#f4f7fb", fontStyle: "bold" })
      .setOrigin(0.5, 0);
    this.resultBody = this.add
      .text(0, 0, "", { fontFamily: UI_FONT, fontSize: "17px", color: "#cad4de", align: "center", lineSpacing: 4 })
      .setOrigin(0.5, 0);
    this.resultStats = this.add
      .text(0, 0, "", { fontFamily: UI_FONT, fontSize: "16px", color: "#9eb4ca", align: "center" })
      .setOrigin(0.5, 0);
    this.resultMissions = this.add
      .text(0, 0, "", {
        fontFamily: UI_FONT,
        fontSize: "17px",
        color: "#ffd166",
        fontStyle: "bold",
        align: "center",
        lineSpacing: 6,
      })
      .setOrigin(0.5, 0);
    // Control's debrief of the flight (filled in after the panel opens).
    this.resultDebrief = this.add
      .text(0, 0, "", { fontFamily: UI_FONT, fontSize: "15px", color: "#9eb4ca", align: "center", lineSpacing: 4, fontStyle: "italic" })
      .setOrigin(0.5, 0);
    this.resultSecondaryButton = this.createOverlayButton("Hangar  (ESC)", 0x82b6ff, () =>
      this.returnToHangar(),
    );
    this.resultPrimaryButton = this.createOverlayButton("", 0x73f7c0, () =>
      this.handleResultPrimaryAction(),
    );
    // The mission patch, pinned to the top edge of the panel like a badge.
    this.resultPatch = this.add.image(0, 0, getPatchTextureKey(this.rocketDef));

    this.resultOverlay.add([
      this.resultShade,
      this.resultPanel,
      this.resultPatch,
      this.resultTitle,
      this.resultBody,
      this.resultStats,
      this.resultMissions,
      this.resultDebrief,
      this.resultSecondaryButton.background,
      this.resultSecondaryButton.text,
      this.resultPrimaryButton.background,
      this.resultPrimaryButton.text,
    ]);
  },

  createOverlayButton(label, accent, callback) {
    const background = this.add
      .rectangle(0, 0, BUTTON_WIDTH, BUTTON_HEIGHT, 0x1d252f, 0.96)
      .setStrokeStyle(2, accent, 0.8)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(0, 0, label, { fontFamily: UI_FONT, fontSize: "18px", color: "#f4f7fb", fontStyle: "bold" })
      .setOrigin(0.5);

    background.on("pointerdown", callback);
    background.on("pointerover", () => background.setFillStyle(0x2a3542, 1));
    background.on("pointerout", () => background.setFillStyle(0x1d252f, 0.96));
    return { background, text };
  },

  // The panel is as tall as what it says: title, reason, numbers, mission
  // lines and the debrief flow one under another, then the buttons.
  layoutMissionOverlay(width, height) {
    const compact = width < 560;
    // A phone on its side: everything a size down, in a wider panel.
    const short = height < 480;
    const badge = short ? 60 : compact ? 84 : 104;
    // The lower half of the badge sits inside the panel and pushes the text down.
    const shift = badge / 2 - 6;
    const panelWidth = Math.min(short ? 760 : 620, width - 24);
    const centerX = width / 2;
    const textWidth = panelWidth - 48;
    const buttonHeight = short ? 42 : BUTTON_HEIGHT;
    const edge = short ? 12 : 22;

    this.resultTitle.setFontSize(short ? 24 : compact ? 28 : 36);
    this.resultBody.setFontSize(short ? 14 : compact ? 15 : 17).setWordWrapWidth(textWidth);
    this.resultStats.setFontSize(short ? 13 : compact ? 14 : 16);
    this.resultMissions.setFontSize(short ? 14 : compact ? 15 : 17).setWordWrapWidth(textWidth);
    this.resultDebrief.setFontSize(short ? 12 : compact ? 13 : 15).setWordWrapWidth(textWidth);

    // Offsets from the top of the panel; empty texts take no room.
    const flow = [
      [this.resultTitle, shift + (short ? 10 : 22)],
      [this.resultBody, short ? 4 : 10],
      [this.resultStats, short ? 8 : 16],
      [this.resultMissions, short ? 8 : 16],
      [this.resultDebrief, short ? 6 : 12],
    ];
    const maxHeight = height - 24 - badge / 2;
    const footer = (short ? 14 : 24) + buttonHeight + edge;
    let y = 0;
    const offsets = flow.map(([text, gap]) => {
      text.setVisible(true);
      if (!text.text) return y;
      const at = y + gap;
      // The debrief is the one thing that goes when there is no room for it.
      if (text === this.resultDebrief && at + text.height + footer > maxHeight) {
        text.setVisible(false);
        return at;
      }
      y = at + text.height;
      return at;
    });
    const panelHeight = Math.min(Math.max(y + footer, short ? 0 : 300), maxHeight);
    const left = (width - panelWidth) / 2;
    const top = (height - panelHeight + badge / 2) / 2;
    flow.forEach(([text], index) => text.setPosition(centerX, top + offsets[index]));
    this.resultPatch.setPosition(centerX, top).setDisplaySize(badge, badge);

    this.resultShade.setSize(width, height);
    this.resultPanel.clear();
    this.resultPanel.fillStyle(0x121920, 0.97);
    this.resultPanel.fillRoundedRect(left, top, panelWidth, panelHeight, 18);
    this.resultPanel.lineStyle(2, this.resultAccent ?? 0x82b6ff, 0.5);
    this.resultPanel.strokeRoundedRect(left, top, panelWidth, panelHeight, 18);

    const buttonY = top + panelHeight - buttonHeight / 2 - edge;
    const buttonWidth = Math.min(BUTTON_WIDTH, (panelWidth - 60) / 2);
    const offset = buttonWidth / 2 + 8;
    this.layoutOverlayButton(this.resultSecondaryButton, centerX - offset, buttonY, buttonWidth, buttonHeight);
    this.layoutOverlayButton(this.resultPrimaryButton, centerX + offset, buttonY, buttonWidth, buttonHeight);
  },

  layoutOverlayButton(button, x, y, width, height = BUTTON_HEIGHT) {
    button.background.setPosition(x, y).setSize(width, height);
    button.background.input.hitArea.setTo(0, 0, width, height);
    button.text.setPosition(x, y);
  },

  showMissionOverlay(result) {
    this.lastResultData = result;
    this.resultAccent = result.success ? 0x73f7c0 : 0xff8d8d;

    const goal = this.rocketDef.challenge.goal;
    const successTitle = goal?.type === "escape" ? "¡Rumbo a la Luna!" : goal?.type === "raise" ? "¡Órbita alta!" : "¡En órbita!";
    this.resultTitle.setText(result.success ? successTitle : "Misión fallida");
    this.resultTitle.setColor(result.success ? "#9ef6ca" : "#ffb0b0");
    this.resultBody.setText(result.reason);
    this.resultStats.setText(
      [
        `Tiempo ${formatSeconds(result.time)}`,
        `Altura máx. ${Math.round(result.maxAltitude)} km`,
        `Combustible ${result.fuelPercent}%`,
      ].join(this.scale.width < 560 ? "  ·  " : "     "),
    );

    const { completed, unlocked, missed, missedAll = [] } = result.challenge;
    const title = this.rocketDef.challenge.title;
    const alreadyDone = !completed && MissionSystem.isCompleted(this.rocketDef.id);
    const missionLines = [];
    if (completed) {
      missionLines.push(`★ Misión cumplida: ${title}`);
      missionLines.push(
        unlocked ? `¡Nuevo cohete desbloqueado: ${unlocked.name}!` : "¡Has completado todas las misiones!",
      );
    } else if (!alreadyDone && missed) {
      // In orbit but the mission was not met: say what was missing.
      missionLines.push(`Misión sin cumplir: ${title}`);
      missionLines.push(...(missedAll.length ? missedAll : [missed]));
    } else {
      // Remind the player of this rocket's mission, or point them at the next one.
      const target = alreadyDone ? MissionSystem.getCurrentRocket() : this.rocketDef;
      if (target) {
        missionLines.push(`${alreadyDone ? "Tu próxima misión" : "Misión"} · ${target.name}: ${target.challenge.title}`);
        missionLines.push(describeChallenge(target.challenge));
      }
    }
    this.resultMissions.setText(missionLines.join("\n"));
    this.resultMissions.setColor(completed ? "#ffd166" : missed && !alreadyDone ? "#ff9b8a" : "#9eb4ca");

    // In orbit but short of the mission: the useful next step is another go.
    this.resultRetry = !result.success || Boolean(missed && !alreadyDone);
    const primaryLabel = unlocked ? `Ver ${unlocked.shortName || unlocked.name}` : this.resultRetry ? "Reintentar" : "Siguiente";
    // Key names only where there is room for them and a keyboard to press.
    const keys = this.scale.width >= 560 && !this.touchControlsUi.visible;
    this.resultPrimaryButton.text.setText(keys ? `${primaryLabel}  (ENTER)` : primaryLabel);
    this.resultSecondaryButton.text.setText(keys ? "Hangar  (ESC)" : "Hangar");
    this.layoutMissionOverlay(this.scale.width, this.scale.height);
    this.resultOverlay.setVisible(true);
    this.resultOverlayVisible = true;
    this.showResultPatch(result.challenge);
    if (result.success) this.celebrateResult(result.challenge);
  },

  // Confetti over the result card; gold and glitter on the patch when the
  // mission is completed for the first time.
  celebrateResult({ completed }) {
    const register = (obj) => {
      this.cameras.main.ignore(obj);
      this.backdropCamera?.ignore(obj);
    };
    const { width, height } = this.scale;
    confetti(this, width / 2, height * 0.42, { count: completed ? 110 : 60, depth: 200, register });
    if (completed) {
      const patch = this.resultPatch;
      this.time.delayedCall(450, () => {
        const x = patch.x + (patch.parentContainer?.x || 0);
        const y = patch.y + (patch.parentContainer?.y || 0);
        sparkles(this, x, y, { count: 36, colors: FX_COLORS.gold, speed: 260, scale: 0.55, depth: 200, register });
        shockwave(this, x, y, { color: 0xffd166, radius: 90, depth: 200, register });
      });
    }
  },

  // Earned now: the patch pops in. Earned before: shown as is. Not earned: faded.
  showResultPatch({ achieved, completed }) {
    const patch = this.resultPatch;
    this.tweens.killTweensOf(patch);
    patch.setAngle(0);
    if (!achieved) {
      patch.setTint(0x8a96a3).setAlpha(0.6);
      return;
    }
    patch.clearTint().setAlpha(1);
    if (completed) {
      const scale = patch.scale;
      patch.setScale(0).setAngle(-25);
      this.tweens.add({ targets: patch, scale, angle: 0, duration: 650, ease: "Back.easeOut" });
    }
  },

  handleResultPrimaryAction() {
    if (this.resultRetry) {
      this.restartFlight();
    } else {
      this.returnToHangar();
    }
  },

  restartFlight() {
    this.releasePause();
    this.scene.restart({ rocketId: this.rocketDef.id, retry: true });
  },

  // A freshly unlocked rocket is shown straight away in the hangar.
  returnToHangar() {
    const unlocked = this.lastResultData?.challenge.unlocked;
    this.releasePause();
    transitionTo(this, "HangarScene", unlocked ? { rocketId: unlocked.id, revealId: unlocked.id } : { rocketId: this.rocketDef.id });
  },
};
