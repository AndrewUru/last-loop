import { describeChallenge, getPatchTextureKey } from "../../data/rockets.js";
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

  layoutMissionOverlay(width, height) {
    const compact = width < 560;
    const badge = compact ? 84 : 104;
    // The lower half of the badge sits inside the panel and pushes the text down.
    const shift = badge / 2 - 6;
    const panelWidth = Math.min(620, width - 24);
    const panelHeight = Math.min((compact ? 440 : 400) + shift, height - 24 - badge / 2);
    const left = (width - panelWidth) / 2;
    const top = (height - panelHeight + badge / 2) / 2;
    const centerX = width / 2;
    const textWidth = panelWidth - 48;
    this.resultPatch.setPosition(centerX, top).setDisplaySize(badge, badge);

    this.resultShade.setSize(width, height);
    this.resultPanel.clear();
    this.resultPanel.fillStyle(0x121920, 0.97);
    this.resultPanel.fillRoundedRect(left, top, panelWidth, panelHeight, 18);
    this.resultPanel.lineStyle(2, this.resultAccent ?? 0x82b6ff, 0.5);
    this.resultPanel.strokeRoundedRect(left, top, panelWidth, panelHeight, 18);

    this.resultTitle.setFontSize(compact ? 28 : 36).setPosition(centerX, top + shift + 26);
    this.resultBody
      .setFontSize(compact ? 15 : 17)
      .setWordWrapWidth(textWidth)
      .setPosition(centerX, top + shift + (compact ? 70 : 82));
    this.resultStats.setFontSize(compact ? 14 : 16).setPosition(centerX, top + shift + 160);
    this.resultMissions
      .setFontSize(compact ? 15 : 17)
      .setWordWrapWidth(textWidth)
      .setPosition(centerX, top + shift + (compact ? 196 : 200));

    const buttonY = top + panelHeight - BUTTON_HEIGHT / 2 - 22;
    const buttonWidth = Math.min(BUTTON_WIDTH, (panelWidth - 60) / 2);
    const offset = buttonWidth / 2 + 8;
    this.layoutOverlayButton(this.resultSecondaryButton, centerX - offset, buttonY, buttonWidth);
    this.layoutOverlayButton(this.resultPrimaryButton, centerX + offset, buttonY, buttonWidth);
  },

  layoutOverlayButton(button, x, y, width) {
    button.background.setPosition(x, y).setSize(width, BUTTON_HEIGHT);
    button.background.input.hitArea.setTo(0, 0, width, BUTTON_HEIGHT);
    button.text.setPosition(x, y);
  },

  showMissionOverlay(result) {
    this.lastResultData = result;
    this.resultAccent = result.success ? 0x73f7c0 : 0xff8d8d;

    this.resultTitle.setText(result.success ? "¡En órbita!" : "Misión fallida");
    this.resultTitle.setColor(result.success ? "#9ef6ca" : "#ffb0b0");
    this.resultBody.setText(result.reason);
    this.resultStats.setText(
      [
        `Tiempo ${formatSeconds(result.time)}`,
        `Altura máx. ${Math.round(result.maxAltitude)} km`,
        `Combustible ${result.fuelPercent}%`,
      ].join("     "),
    );

    const { completed, unlocked, missed } = result.challenge;
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
      missionLines.push(missed);
    } else {
      // Remind the player of this rocket's mission, or point them at the next one.
      const target = alreadyDone ? MissionSystem.getCurrentRocket() : this.rocketDef;
      if (target) {
        missionLines.push(`Misión del ${target.name}: ${target.challenge.title}`);
        missionLines.push(describeChallenge(target.challenge));
      }
    }
    this.resultMissions.setText(missionLines.join("\n"));
    this.resultMissions.setColor(completed ? "#ffd166" : missed && !alreadyDone ? "#ff9b8a" : "#9eb4ca");

    const primaryLabel = unlocked ? `Ver ${unlocked.shortName || unlocked.name}` : result.success ? "Siguiente" : "Reintentar";
    this.resultPrimaryButton.text.setText(`${primaryLabel}  (ENTER)`);
    this.layoutMissionOverlay(this.scale.width, this.scale.height);
    this.resultOverlay.setVisible(true);
    this.resultOverlayVisible = true;
    this.showResultPatch(result.challenge);
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
    if (this.lastResultData?.success) {
      this.returnToHangar();
      return;
    }

    this.restartFlight();
  },

  restartFlight() {
    this.scene.restart({ rocketId: this.rocketDef.id });
  },

  // A freshly unlocked rocket is shown straight away in the hangar.
  returnToHangar() {
    const unlocked = this.lastResultData?.challenge.unlocked;
    this.scene.start("HangarScene", unlocked ? { rocketId: unlocked.id, revealId: unlocked.id } : { rocketId: this.rocketDef.id });
  },
};
