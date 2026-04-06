import Phaser from "phaser";

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameOverScene" });
  }

  init(data) {
    this.didWin = Boolean(data.didWin);
    this.finalScore = data.score || 0;
    this.finalTime = data.time || 0;
    this.finalLevel = data.level || 1;
    this.finalKills = data.kills || 0;
    this.targetTime = data.targetTime || 0;
  }

  create() {
    this.cameras.main.setBackgroundColor("#080810");

    this.panel = this.add.rectangle(0, 0, 680, 380, 0x11111f, 0.96);
    this.titleText = this.add.text(0, 0, this.didWin ? "Run Complete" : "Game Over", {
      fontSize: "44px",
      color: this.didWin ? "#75f6ff" : "#ff5f76",
    });
    this.subtitleText = this.add.text(
      0,
      0,
      this.didWin
        ? `You held the line for ${Math.floor(this.targetTime / 60)} minutes`
        : "The swarm closed the loop",
      {
        fontSize: "18px",
        color: "#b6dfff",
      },
    );
    this.scoreText = this.add.text(0, 0, `Score: ${this.finalScore}`, {
      fontSize: "22px",
      color: "#ffffff",
    });
    this.timeText = this.add.text(0, 0, `Time: ${this.finalTime}s`, {
      fontSize: "22px",
      color: "#ffffff",
    });
    this.levelText = this.add.text(0, 0, `Level: ${this.finalLevel}`, {
      fontSize: "22px",
      color: "#ffffff",
    });
    this.killsText = this.add.text(0, 0, `Kills: ${this.finalKills}`, {
      fontSize: "22px",
      color: "#ffffff",
    });
    this.restartText = this.add.text(
      0,
      0,
      this.didWin ? "Press R to run it again" : "Press R to restart",
      {
      fontSize: "18px",
      color: "#75f6ff",
      },
    );
    this.restartButton = this.add
      .rectangle(0, 0, 220, 44, 0x13263a, 0.98)
      .setStrokeStyle(2, 0x75f6ff, 0.4)
      .setInteractive({ useHandCursor: true });
    this.restartButtonLabel = this.add.text(0, 0, "Restart Run", {
      fontSize: "18px",
      color: "#ffffff",
    });

    [
      this.titleText,
      this.subtitleText,
      this.scoreText,
      this.timeText,
      this.levelText,
      this.killsText,
      this.restartText,
      this.restartButtonLabel,
    ].forEach((item) => item.setOrigin(0.5));

    this.handleResize({ width: this.scale.width, height: this.scale.height });
    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    this.restartButton.on("pointerdown", () => {
      this.restartGame();
    });
    this.input.keyboard.once("keydown-R", () => {
      this.restartGame();
    });
  }

  restartGame() {
    this.scene.start("GameScene");
    this.scene.launch("UIScene");
  }

  handleResize(gameSize) {
    const { width, height } = gameSize;
    const centerX = width / 2;
    const centerY = height / 2;

    this.cameras.main.setViewport(0, 0, width, height);
    this.panel.setPosition(centerX, centerY);
    this.panel.setSize(Math.min(width - 48, 680), Math.min(height - 48, 420));
    this.titleText.setPosition(centerX, centerY - 128);
    this.subtitleText.setPosition(centerX, centerY - 88);
    this.scoreText.setPosition(centerX, centerY - 34);
    this.timeText.setPosition(centerX, centerY + 8);
    this.levelText.setPosition(centerX, centerY + 50);
    this.killsText.setPosition(centerX, centerY + 92);
    this.restartButton.setPosition(centerX, centerY + 146);
    this.restartButtonLabel.setPosition(centerX, centerY + 146);
    this.restartText.setPosition(centerX, centerY + 188);
  }

  handleShutdown() {
    this.scale.off("resize", this.handleResize, this);
  }
}
