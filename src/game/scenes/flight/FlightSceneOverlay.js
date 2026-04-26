export const flightSceneOverlayMethods = {
  createMissionOverlay() {
    const { width, height } = this.scale;

    this.resultOverlay = this.add
      .container(0, 0)
      .setDepth(120)
      .setVisible(false);
    this.resultShade = this.add
      .rectangle(width / 2, height / 2, width, height, 0x05080c, 0.7)
      .setScrollFactor(0);
    this.resultPanel = this.add
      .rectangle(width / 2, height / 2, 660, 360, 0x151b22, 0.96)
      .setStrokeStyle(1, 0x82b6ff, 0.46)
      .setScrollFactor(0);
    this.resultTitle = this.add
      .text(width / 2, height / 2 - 118, "", {
        fontSize: "40px",
        color: "#f4f7fb",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.resultBody = this.add
      .text(width / 2, height / 2 - 66, "", {
        fontSize: "20px",
        color: "#cad4de",
        align: "center",
        wordWrap: { width: 560 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.resultStats = this.add
      .text(width / 2, height / 2 + 16, "", {
        fontSize: "20px",
        color: "#f4f7fb",
        align: "center",
        lineSpacing: 10,
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.resultHint = this.add
      .text(width / 2, height / 2 + 104, "R assembly    SPACE relaunch", {
        fontSize: "18px",
        color: "#9eb4ca",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.resultBuildButton = this.createOverlayButton(
      width / 2 - 144,
      height / 2 + 138,
      "Assembly",
      0x82b6ff,
      () => this.returnToBuild(),
    );
    this.resultRetryButton = this.createOverlayButton(
      width / 2 + 12,
      height / 2 + 138,
      "Relaunch",
      0x7bc48a,
      () => this.handleResultPrimaryAction(),
    );

    this.resultOverlay.add([
      this.resultShade,
      this.resultPanel,
      this.resultTitle,
      this.resultBody,
      this.resultStats,
      this.resultHint,
      this.resultBuildButton.container,
      this.resultRetryButton.container,
    ]);

    this.layoutMissionOverlay(width, height);
  },

  createOverlayButton(x, y, label, accent, callback) {
    const container = this.add.container(0, 0).setScrollFactor(0);
    const background = this.add
      .rectangle(x, y, 252, 56, 0x1d252f, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(1, accent, 0.72)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    const text = this.add
      .text(x + 126, y + 28, label, {
        fontSize: "18px",
        color: "#f4f7fb",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    background.on("pointerdown", callback);
    background.on("pointerover", () => background.setStrokeStyle(2, accent, 1));
    background.on("pointerout", () =>
      background.setStrokeStyle(2, accent, 0.72),
    );

    container.add([background, text]);
    return { container, background, text };
  },

  layoutMissionOverlay(width, height) {
    const panelWidth = Math.min(660, Math.max(320, width - 80));
    const panelHeight = Math.min(360, Math.max(280, height - 100));
    const panelTop = height / 2 - panelHeight / 2;
    const buttonY = panelTop + panelHeight - 70;

    this.resultShade.setPosition(width / 2, height / 2).setSize(width, height);
    this.resultPanel
      .setPosition(width / 2, height / 2)
      .setSize(panelWidth, panelHeight);
    this.resultTitle.setPosition(width / 2, panelTop + 54);
    this.resultBody.setPosition(width / 2, panelTop + 108);
    this.resultBody.setWordWrapWidth(panelWidth - 100);
    this.resultStats.setPosition(width / 2, panelTop + 184);
    this.resultHint.setPosition(width / 2, panelTop + panelHeight - 98);

    this.layoutOverlayButton(this.resultBuildButton, width / 2 - 144, buttonY);
    this.layoutOverlayButton(this.resultRetryButton, width / 2 + 12, buttonY);
  },

  layoutOverlayButton(button, x, y) {
    button.background.setPosition(x, y);
    button.text.setPosition(x + 126, y + 28);
  },

  showMissionOverlay(resultData) {
    const success = resultData.result === "success";
    const accent = success ? "#9ef6ca" : "#ffb0b0";
    const accentStroke = success ? 0x73f7c0 : 0xff8d8d;
    this.lastResultData = resultData;

    this.resultTitle.setText(success ? "Orbit Reached" : "Mission Failed");
    this.resultTitle.setColor(accent);
    this.resultBody.setText(
      success
        ? "Stable Earth orbit achieved. You can now commit the same vehicle to a translunar injection burn."
        : resultData.reason,
    );
    this.resultStats.setText(
      [
        `Peak altitude: ${resultData.altitude.toFixed(1)} km`,
        `Horizontal speed: ${resultData.horizontalVelocity.toFixed(2)} km/s`,
        `Transfer fuel: ${(resultData.fuelRemaining || 0).toFixed(1)}`,
        `Flight time: ${resultData.time.toFixed(1)} s`,
        `Launch TWR: ${(this.stats.twr || 0).toFixed(2)}`,
      ].join("\n"),
    );
    this.resultHint.setText(
      success ? "R assembly    SPACE moon transfer" : "R assembly    SPACE relaunch",
    );
    this.resultRetryButton.text.setText(success ? "Moon Transfer" : "Relaunch");
    this.resultPanel.setStrokeStyle(2, accentStroke, 0.42);
    this.resultOverlay.setVisible(true);
    this.resultOverlayVisible = true;
  },

  handleResultPrimaryAction() {
    if (this.lastResultData?.result === "success") {
      this.continueToMoon();
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

  continueToMoon() {
    this.scene.start("DeepSpaceScene", {
      build: this.build,
      stats: this.stats,
      departure: this.lastResultData || {},
    });
  },
};
