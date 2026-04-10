import { SHIP_PARTS } from "../data/parts.js";

export default class BuildHud {
  constructor(scene, options) {
    this.scene = scene;
    this.options = options;
    this.paletteCards = new Map();
    this.objects = [];
  }

  create() {
    const { width, height } = this.scene.scale;
    this.leftPanel = this.scene.add
      .rectangle(0, 0, 280, height - 120, 0x081624, 0.94)
      .setOrigin(0)
      .setStrokeStyle(2, 0x68d9ff, 0.3);
    this.rightPanel = this.scene.add
      .rectangle(width - 300, 0, 280, height - 120, 0x081624, 0.94)
      .setOrigin(0)
      .setStrokeStyle(2, 0x68d9ff, 0.3);

    this.title = this.scene.add.text(32, 28, "Build Ship", {
      fontSize: "44px",
      color: "#effcff",
      fontStyle: "bold",
    });
    this.subtitle = this.scene.add.text(
      34,
      82,
      "Pick a module, place it on the grid, then launch when the stack is valid.",
      {
        fontSize: "18px",
        color: "#8fd7ff",
        wordWrap: { width: 420 },
      },
    );

    this.paletteTitle = this.scene.add.text(32, 148, "Modules", {
      fontSize: "24px",
      color: "#effcff",
      fontStyle: "bold",
    });
    this.statusTitle = this.scene.add.text(width - 268, 28, "Readiness", {
      fontSize: "24px",
      color: "#effcff",
      fontStyle: "bold",
    });

    this.readinessBadge = this.scene.add
      .rectangle(width - 268, 72, 236, 40, 0x3a1a1a, 0.95)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0xff8d8d, 0.55);
    this.readinessText = this.scene.add.text(width - 150, 72, "NOT READY", {
      fontSize: "18px",
      color: "#ffd6d6",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.statsText = this.scene.add.text(width - 268, 112, "", {
      fontSize: "18px",
      color: "#d7efff",
      lineSpacing: 8,
    });
    this.selectionTitle = this.scene.add.text(width - 268, 272, "Selection", {
      fontSize: "22px",
      color: "#effcff",
      fontStyle: "bold",
    });
    this.selectionText = this.scene.add.text(width - 268, 308, "", {
      fontSize: "17px",
      color: "#bfdff4",
      wordWrap: { width: 236 },
      lineSpacing: 8,
    });
    this.issuesTitle = this.scene.add.text(width - 268, 430, "Issues", {
      fontSize: "22px",
      color: "#effcff",
      fontStyle: "bold",
    });
    this.issuesText = this.scene.add.text(width - 268, 466, "", {
      fontSize: "16px",
      color: "#ffd2b5",
      wordWrap: { width: 236 },
      lineSpacing: 7,
    });

    this.clearButton = this.createButton(32, height - 86, 116, "Clear", 0x163248, 0x68d9ff, () =>
      this.options.onClear?.(),
    );
    this.removeButton = this.createButton(164, height - 86, 116, "Remove", 0x2d2137, 0xc78dff, () =>
      this.options.onRemove?.(),
    );
    this.launchButton = this.createButton(width - 236, height - 86, 216, "Launch", 0x183c2d, 0x73f7c0, () =>
      this.options.onLaunch?.(),
    );

    this.instructions = this.scene.add.text(width / 2, height - 46, "Click a module, then click the grid. Delete removes the selected module.", {
      fontSize: "16px",
      color: "#8fd7ff",
    }).setOrigin(0.5);

    this.createPaletteCards();

    this.objects.push(
      this.leftPanel,
      this.rightPanel,
      this.title,
      this.subtitle,
      this.paletteTitle,
      this.statusTitle,
      this.readinessBadge,
      this.readinessText,
      this.statsText,
      this.selectionTitle,
      this.selectionText,
      this.issuesTitle,
      this.issuesText,
      this.clearButton.container,
      this.removeButton.container,
      this.launchButton.container,
      this.instructions,
    );
  }

  createPaletteCards() {
    let y = 190;
    SHIP_PARTS.forEach((part) => {
      const background = this.scene.add
        .rectangle(32, y, 236, 64, 0x102233, 0.96)
        .setOrigin(0)
        .setStrokeStyle(2, 0x68d9ff, 0.2)
        .setInteractive({ useHandCursor: true });
      const name = this.scene.add.text(48, y + 10, part.name, {
        fontSize: "20px",
        color: "#effcff",
        fontStyle: "bold",
      });
      const meta = this.scene.add.text(
        48,
        y + 38,
        `${part.gridWidth}x${part.gridHeight}  mass ${part.mass}  fuel ${part.fuel}  thrust ${part.thrust}`,
        {
          fontSize: "14px",
          color: "#8fd7ff",
        },
      );

      background.on("pointerdown", () => this.options.onSelectPart?.(part.id));
      this.paletteCards.set(part.id, { background, name, meta });
      this.objects.push(background, name, meta);
      y += 78;
    });
  }

  createButton(x, y, width, label, fill, stroke, callback) {
    const shadow = this.scene.add.rectangle(x + 2, y + 2, width, 52, 0x000000, 0.3).setOrigin(0);
    const background = this.scene.add
      .rectangle(x, y, width, 52, fill, 0.96)
      .setOrigin(0)
      .setStrokeStyle(2, stroke, 0.6)
      .setInteractive({ useHandCursor: true });
    const text = this.scene.add.text(x + width / 2, y + 26, label, {
      fontSize: "18px",
      color: "#effcff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    background.on("pointerdown", callback);
    background.on("pointerover", () => background.setStrokeStyle(2, stroke, 1));
    background.on("pointerout", () => background.setStrokeStyle(2, stroke, 0.6));

    return {
      container: [shadow, background, text],
      background,
      text,
      setEnabled(enabled) {
        background.disableInteractive();
        if (enabled) {
          background.setInteractive({ useHandCursor: true });
        }
        background.setFillStyle(fill, enabled ? 0.96 : 0.36);
        text.setAlpha(enabled ? 1 : 0.45);
      },
    };
  }

  setSelectedPart(partId) {
    this.paletteCards.forEach((card, currentPartId) => {
      const active = currentPartId === partId;
      card.background.setStrokeStyle(2, active ? 0x73f7c0 : 0x68d9ff, active ? 0.95 : 0.2);
      card.background.setFillStyle(active ? 0x153246 : 0x102233, 0.96);
    });
  }

  update(validation, selectionInfo, canRemove = false) {
    const { width } = this.scene.scale;
    const ready = validation.isValid;
    this.readinessBadge
      .setFillStyle(ready ? 0x183c2d : 0x3a1a1a, 0.95)
      .setStrokeStyle(2, ready ? 0x73f7c0 : 0xff8d8d, 0.55);
    this.readinessText
      .setText(ready ? "READY TO LAUNCH" : "NOT READY")
      .setColor(ready ? "#cffff0" : "#ffd6d6");

    this.statsText.setText(
      [
        `Mass   ${validation.stats.mass.toFixed(0)}`,
        `Fuel   ${validation.stats.fuel.toFixed(0)}`,
        `Thrust ${validation.stats.thrust.toFixed(0)}`,
        `TWR    ${validation.stats.twr.toFixed(2)}`,
        `Parts  ${validation.stats.partCount}`,
        `Width  ${validation.stats.width || 0}`,
      ].join("\n"),
    );

    if (selectionInfo) {
      this.selectionText.setText(
        [
          selectionInfo.name,
          selectionInfo.role,
          `Mass ${selectionInfo.mass}`,
          `Fuel ${selectionInfo.fuel}`,
          `Thrust ${selectionInfo.thrust}`,
        ].join("\n"),
      );
    } else {
      this.selectionText.setText("No module selected.");
    }

    const issueLines = validation.errors.length > 0
      ? validation.errors.slice(0, 4)
      : validation.warnings.length > 0
        ? validation.warnings.slice(0, 4)
        : ["No blocking issues."];
    this.issuesText.setColor(validation.errors.length > 0 ? "#ffd2b5" : "#bfdff4");
    this.issuesText.setText(issueLines.join("\n"));
    this.launchButton.setEnabled(validation.isValid);
    this.removeButton.setEnabled(canRemove);
    this.rightPanel.setPosition(width - 300, 0);
    this.statusTitle.setPosition(width - 268, 28);
    this.readinessBadge.setPosition(width - 268, 72);
    this.readinessText.setPosition(width - 150, 72);
    this.statsText.setPosition(width - 268, 112);
    this.selectionTitle.setPosition(width - 268, 272);
    this.selectionText.setPosition(width - 268, 308);
    this.issuesTitle.setPosition(width - 268, 430);
    this.issuesText.setPosition(width - 268, 466);
  }
}
