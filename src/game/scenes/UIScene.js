import Phaser from "phaser";

export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: "UIScene" });
  }

  create() {
    this.pendingChoices = [];

    this.hudPanel = this.add
      .rectangle(16, 16, 300, 258, 0x0a1320, 0.84)
      .setOrigin(0)
      .setStrokeStyle(1, 0x75f6ff, 0.2);
    this.titleText = this.add.text(32, 24, "Last Loop", {
      fontSize: "22px",
      color: "#75f6ff",
    });
    this.scoreText = this.add.text(32, 58, "Score: 0", {
      fontSize: "18px",
      color: "#ffffff",
    });
    this.timeText = this.add.text(32, 86, "Time: 0s", {
      fontSize: "18px",
      color: "#ffffff",
    });
    this.goalText = this.add.text(32, 114, "Objective: 10:00", {
      fontSize: "18px",
      color: "#9cdcff",
    });
    this.levelText = this.add.text(32, 142, "Level: 1", {
      fontSize: "18px",
      color: "#ffffff",
    });
    this.killsText = this.add.text(32, 170, "Kills: 0", {
      fontSize: "18px",
      color: "#ffffff",
    });
    this.healthText = this.add.text(32, 198, "Health: 100 / 100", {
      fontSize: "18px",
      color: "#ffffff",
    });
    this.xpLabel = this.add.text(32, 230, "XP", {
      fontSize: "14px",
      color: "#75f6ff",
    });
    this.xpValueText = this.add.text(278, 230, "0 / 40", {
      fontSize: "14px",
      color: "#d8f7ff",
    });
    this.xpValueText.setOrigin(1, 0);
    this.xpBarBg = this.add
      .rectangle(32, 252, 246, 12, 0x15283a, 1)
      .setOrigin(0, 0.5);
    this.xpBarFill = this.add
      .rectangle(32, 252, 246, 12, 0x75f6ff, 1)
      .setOrigin(0, 0.5);
    this.xpBarFill.scaleX = 0;

    this.overlayBackdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x04070d, 0.84)
      .setOrigin(0)
      .setDepth(20)
      .setInteractive();
    this.overlayTitle = this.add
      .text(0, 0, "", {
        fontSize: "28px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.overlaySubtitle = this.add
      .text(0, 0, "Choose one upgrade to continue", {
        fontSize: "16px",
        color: "#9cdcff",
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.optionCards = [];
    for (let index = 0; index < 3; index += 1) {
      const box = this.add
        .rectangle(0, 0, 250, 150, 0x101d30, 0.98)
        .setStrokeStyle(2, 0x75f6ff, 0.4)
        .setDepth(21)
        .setInteractive({ useHandCursor: true });
      const title = this.add
        .text(0, 0, "", {
          fontSize: "22px",
          color: "#ffffff",
          align: "center",
          wordWrap: { width: 190 },
        })
        .setOrigin(0.5)
        .setDepth(22);
      const description = this.add
        .text(0, 0, "", {
          fontSize: "16px",
          color: "#b6dfff",
          align: "center",
          wordWrap: { width: 210 },
        })
        .setOrigin(0.5)
        .setDepth(22);
      const hotkey = this.add
        .text(0, 0, `${index + 1}`, {
          fontSize: "14px",
          color: "#75f6ff",
        })
        .setOrigin(0.5)
        .setDepth(22);

      box.on("pointerdown", () => this.selectUpgrade(index));
      this.optionCards.push({ box, title, description, hotkey });
    }

    this.optionKeys = this.input.keyboard.addKeys({
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
    });

    this.setUpgradeOverlayVisible(false);
    this.handleResize({ width: this.scale.width, height: this.scale.height });
    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  update() {
    const gameScene = this.scene.get("GameScene");

    if (!gameScene || !gameScene.player) {
      return;
    }

    this.scoreText.setText(`Score: ${gameScene.score}`);
    this.timeText.setText(`Time: ${gameScene.survivalTime}s`);
    this.goalText.setText(`Objective: ${this.formatSeconds(gameScene.remainingTime)}`);
    this.levelText.setText(`Level: ${gameScene.level}`);
    this.killsText.setText(`Kills: ${gameScene.kills}`);
    this.healthText.setText(
      `Health: ${Math.max(0, Math.floor(gameScene.player.health))} / ${gameScene.player.maxHealth}`,
    );
    this.xpValueText.setText(
      `${Math.floor(gameScene.experience)} / ${gameScene.experienceToNextLevel}`,
    );
    this.xpBarFill.scaleX = Phaser.Math.Clamp(
      gameScene.experience / gameScene.experienceToNextLevel,
      0,
      1,
    );

    if (!this.overlayBackdrop.visible) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.optionKeys.one)) {
      this.selectUpgrade(0);
    } else if (Phaser.Input.Keyboard.JustDown(this.optionKeys.two)) {
      this.selectUpgrade(1);
    } else if (Phaser.Input.Keyboard.JustDown(this.optionKeys.three)) {
      this.selectUpgrade(2);
    }
  }

  formatSeconds(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = Math.floor(totalSeconds % 60)
      .toString()
      .padStart(2, "0");

    return `${minutes}:${seconds}`;
  }

  showUpgradeChoices(choices, level) {
    this.pendingChoices = choices;
    this.overlayTitle.setText(`Level ${level}`);

    this.optionCards.forEach((card, index) => {
      const choice = choices[index];
      const visible = Boolean(choice);

      card.box.setVisible(visible);
      card.title.setVisible(visible);
      card.description.setVisible(visible);
      card.hotkey.setVisible(visible);

      if (!choice) {
        return;
      }

      card.title.setText(choice.title);
      card.description.setText(choice.description);
      card.hotkey.setText(`Press ${index + 1}`);
    });

    this.setUpgradeOverlayVisible(true);
  }

  hideUpgradeChoices() {
    this.pendingChoices = [];
    this.setUpgradeOverlayVisible(false);
  }

  selectUpgrade(index) {
    const choice = this.pendingChoices[index];

    if (!choice) {
      return;
    }

    const gameScene = this.scene.get("GameScene");
    gameScene.applyUpgrade(choice.id);
  }

  setUpgradeOverlayVisible(visible) {
    this.overlayBackdrop.setVisible(visible);
    this.overlayTitle.setVisible(visible);
    this.overlaySubtitle.setVisible(visible);

    this.optionCards.forEach((card) => {
      card.box.setVisible(visible);
      card.title.setVisible(visible);
      card.description.setVisible(visible);
      card.hotkey.setVisible(visible);
    });
  }

  handleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;

    this.cameras.main.setViewport(0, 0, width, height);
    this.overlayBackdrop.setSize(width, height);
    this.overlayTitle.setPosition(width / 2, height < 760 ? 96 : height / 2 - 180);
    this.overlaySubtitle.setPosition(
      width / 2,
      height < 760 ? 126 : height / 2 - 146,
    );

    if (width < 920) {
      const startY = Math.max(220, height / 2 - 110);
      this.optionCards.forEach((card, index) => {
        const y = startY + index * 170;
        card.box.setPosition(width / 2, y);
        card.title.setPosition(width / 2, y - 28);
        card.description.setPosition(width / 2, y + 14);
        card.hotkey.setPosition(width / 2, y + 52);
      });
      return;
    }

    this.optionCards.forEach((card, index) => {
      const x = width / 2 + (index - 1) * 280;
      const y = height / 2 + 10;
      card.box.setPosition(x, y);
      card.title.setPosition(x, y - 28);
      card.description.setPosition(x, y + 14);
      card.hotkey.setPosition(x, y + 52);
    });
  }

  handleShutdown() {
    this.scale.off("resize", this.handleResize, this);
  }
}
