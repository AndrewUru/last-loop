import MissionSystem from "../../systems/MissionSystem.js";
import { UI_FONT } from "../../ui/theme.js";

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
      this.returnToBuild(),
    );
    this.resultPrimaryButton = this.createOverlayButton("", 0x73f7c0, () =>
      this.handleResultPrimaryAction(),
    );

    this.resultOverlay.add([
      this.resultShade,
      this.resultPanel,
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
    const panelWidth = Math.min(620, width - 24);
    const panelHeight = Math.min(compact ? 440 : 400, height - 24);
    const left = (width - panelWidth) / 2;
    const top = (height - panelHeight) / 2;
    const centerX = width / 2;
    const textWidth = panelWidth - 48;

    this.resultShade.setSize(width, height);
    this.resultPanel.clear();
    this.resultPanel.fillStyle(0x121920, 0.97);
    this.resultPanel.fillRoundedRect(left, top, panelWidth, panelHeight, 18);
    this.resultPanel.lineStyle(2, this.resultAccent ?? 0x82b6ff, 0.5);
    this.resultPanel.strokeRoundedRect(left, top, panelWidth, panelHeight, 18);

    this.resultTitle.setFontSize(compact ? 28 : 36).setPosition(centerX, top + 26);
    this.resultBody
      .setFontSize(compact ? 15 : 17)
      .setWordWrapWidth(textWidth)
      .setPosition(centerX, top + (compact ? 70 : 82));
    this.resultStats.setFontSize(compact ? 14 : 16).setPosition(centerX, top + (compact ? 160 : 160));
    this.resultMissions
      .setFontSize(compact ? 15 : 17)
      .setWordWrapWidth(textWidth)
      .setPosition(centerX, top + (compact ? 196 : 200));

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
        `Tiempo ${result.time.toFixed(0)} s`,
        `Altura máx. ${Math.round(result.maxAltitude)} km`,
        `Combustible ${result.fuelPercent}%`,
      ].join("     "),
    );

    const missionLines = result.completedMissions.map(
      (mission) => `★ Misión cumplida: ${mission.title}`,
    );
    const unlocked = result.completedMissions.flatMap((mission) => mission.unlocks);
    if (unlocked.length > 0) {
      missionLines.push("¡Nuevas piezas en el hangar!");
    }
    const next = MissionSystem.getCurrentMission();
    if (missionLines.length === 0 && next) {
      missionLines.push(`Misión actual: ${next.title}`);
      missionLines.push(next.description);
    }
    this.resultMissions.setText(missionLines.join("\n"));
    this.resultMissions.setColor(result.completedMissions.length > 0 ? "#ffd166" : "#9eb4ca");

    this.resultPrimaryButton.text.setText(result.success ? "Siguiente  (ENTER)" : "Reintentar  (ENTER)");
    this.layoutMissionOverlay(this.scale.width, this.scale.height);
    this.resultOverlay.setVisible(true);
    this.resultOverlayVisible = true;
  },

  handleResultPrimaryAction() {
    if (this.lastResultData?.success) {
      this.returnToBuild();
      return;
    }

    this.restartFlight();
  },

  restartFlight() {
    this.scene.restart({ build: this.build, stats: this.stats });
  },

  returnToBuild() {
    this.scene.start("BuildScene", { build: this.build });
  },
};
