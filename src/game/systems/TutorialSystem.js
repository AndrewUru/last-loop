export default class TutorialSystem {
  constructor(scene, steps) {
    this.scene = scene;
    this.steps = steps;
    this.currentStep = 0;
    this.panel = null;
    this.highlight = null;
    this.overlay = null;
    this.arrow = null;
    this.completed = false;
  }

  start() {
    const meta = this.scene.registry.get("tutorial-complete");
    if (meta && meta[this.getTutorialId()]) return;
    if (this.steps.length === 0) return;
    this.showStep();
  }

  getTutorialId() {
    return this.scene.scene.key;
  }

  showStep() {
    if (this.currentStep >= this.steps.length) {
      this.complete();
      return;
    }

    const step = this.steps[this.currentStep];
    this.hideCurrent();
    this.createOverlay();
    this.createPanel(step);
    if (step.highlight) {
      this.createHighlight(step.highlight);
    }
    if (step.arrow) {
      this.createArrow(step.arrow);
    }

    if (step.waitForKey) {
      this.waitForInput(() => {
        this.currentStep++;
        this.showStep();
      });
    } else if (step.autoAdvance) {
      this.scene.time.delayedCall(step.autoAdvance, () => {
        this.currentStep++;
        this.showStep();
      });
    } else if (step.condition) {
      this.scene.time.addEvent({
        delay: 200,
        loop: true,
        callback: () => {
          if (step.condition()) {
            this.currentStep++;
            this.showStep();
          }
        }
      });
    }
  }

  createOverlay() {
    if (this.overlay) return;
    this.overlay = this.scene.add.graphics().setDepth(999).setScrollFactor(0);
    this.overlay.fillStyle(0x000000, 0.4);
    this.overlay.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);
    this.overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.scene.scale.width, this.scene.scale.height), Phaser.Geom.Rectangle.Contains);
  }

  createPanel(step) {
    const { width, height } = this.scene.scale;
    const panelW = Math.min(320, width - 24);
    const panelH = width < 520 ? 154 : 140;
    const x = step.panelX || (width - panelW) / 2;
    const y = Math.min(
      step.panelY || height - panelH - 40,
      height - panelH - 16,
    );

    this.panel = this.scene.add.container(x, y).setDepth(1000).setScrollFactor(0);

    const bg = this.scene.add.rectangle(0, 0, panelW, panelH, 0x12181f, 0.95)
      .setOrigin(0)
      .setStrokeStyle(2, 0x68d9ff, 0.6);
    this.panel.add(bg);

    const stepNum = this.scene.add.text(16, 12, `Step ${this.currentStep + 1}/${this.steps.length}`, {
      fontSize: "12px",
      color: "#73f7c0",
      fontStyle: "bold"
    });
    this.panel.add(stepNum);

    const title = this.scene.add.text(16, 32, step.title, {
      fontSize: width < 520 ? "16px" : "18px",
      color: "#f4f7fb",
      fontStyle: "bold"
    });
    this.panel.add(title);

    const body = this.scene.add.text(16, 60, step.body, {
      fontSize: width < 520 ? "13px" : "14px",
      color: "#aebdcb",
      wordWrap: { width: panelW - 32 }
    });
    this.panel.add(body);

    const skipText = this.scene.add.text(panelW - 60, panelH - 24, "SKIP", {
      fontSize: "12px",
      color: "#666"
    });
    this.panel.add(skipText);

    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => {
      this.currentStep++;
      this.showStep();
    });

    skipText.setInteractive({ useHandCursor: true });
    skipText.on("pointerdown", () => this.complete());
  }

  createHighlight(config) {
    this.highlight = this.scene.add.graphics().setDepth(998).setScrollFactor(0);
    const { x, y, width, height, color = 0x68d9ff } = config;
    this.highlight.lineStyle(3, color, 0.8);
    this.highlight.strokeRect(x - 4, y - 4, width + 8, height + 8);
  }

  createArrow(config) {
    const { fromX, fromY, toX, toY } = config;
    this.arrow = this.scene.add.graphics().setDepth(998).setScrollFactor(0);
    this.arrow.lineStyle(2, 0x73f7c0, 0.8);
    this.arrow.beginPath();
    this.arrow.moveTo(fromX, fromY);
    this.arrow.lineTo(toX, toY);
    this.arrow.strokePath();
    this.arrow.fillStyle(0x73f7c0, 0.8);
    this.arrow.fillTriangle(toX - 6, toY - 6, toX + 6, toY - 6, toX, toY + 4);
  }

  hideCurrent() {
    this.panel?.destroy();
    this.highlight?.destroy();
    this.arrow?.destroy();
    this.overlay?.destroy();
    this.panel = null;
    this.highlight = null;
    this.arrow = null;
    this.overlay = null;
  }

  waitForInput(callback) {
    const onKeyDown = () => {
      this.scene.input.keyboard.off("keydown", onKeyDown);
      callback();
    };
    this.scene.input.keyboard.on("keydown", onKeyDown);
    this.overlay?.once("pointerdown", () => {
      this.scene.input.keyboard.off("keydown", onKeyDown);
      callback();
    });
  }

  complete() {
    this.hideCurrent();
    this.completed = true;
    const meta = this.scene.registry.get("tutorial-complete") || {};
    meta[this.getTutorialId()] = true;
    this.scene.registry.set("tutorial-complete", meta);
    this.scene.audio?.playSuccess();
  }

  destroy() {
    this.hideCurrent();
  }
}
