import Phaser from "phaser";

function toColor(hexColor) {
  return Phaser.Display.Color.HexStringToColor(hexColor).color;
}

export default class BuildToolbar {
  constructor(scene, { layout, theme, onLaunch, onClear, onRemove, onReset }) {
    this.scene = scene;
    this.layout = layout;
    this.theme = theme;

    this.createInstructions();
    this.createToolbarShell();

    this.launchButton = this.createButton({
      label: "Launch",
      variant: theme.toolbar.buttons.launch,
      x: layout.primaryButtonX,
      y: layout.primaryButtonY,
      width: layout.primaryButtonWidth,
      callback: onLaunch,
      eyebrow: "PRIMARY",
    });
    this.clearButton = this.createButton({
      label: "Clear",
      variant: theme.toolbar.buttons.clear,
      x: layout.secondaryButtonX,
      y: layout.secondaryButtonY,
      width: layout.secondaryButtonWidth,
      callback: onClear,
      eyebrow: "UTILITY",
    });
    this.removeButton = this.createButton({
      label: "Remove",
      variant: theme.toolbar.buttons.remove,
      x:
        layout.secondaryButtonX +
        layout.secondaryButtonWidth +
        layout.secondaryButtonGap,
      y: layout.secondaryButtonY,
      width: layout.secondaryButtonWidth,
      callback: onRemove,
      eyebrow: "UTILITY",
    });
    this.resetButton = this.createButton({
      label: "Restore",
      variant: theme.toolbar.buttons.secondary,
      x: layout.tertiaryButtonX,
      y: layout.tertiaryButtonY,
      width: layout.tertiaryButtonWidth,
      callback: onReset,
      eyebrow: "DEFAULT",
    });

    this.setRemoveEnabled(false);
  }

  createInstructions() {
    const { colors, toolbar, spacing, chips } = this.theme;
    const compact = this.layout.compactUi;

    this.scene.add.text(this.layout.controlsX, this.layout.controlsY, "Build Notes", {
      fontSize: `${toolbar.titleSize}px`,
      color: colors.textPrimary,
      fontStyle: "bold",
    });
    this.scene.add.text(
      this.layout.controlsX,
      this.layout.controlsY + spacing.lg,
      compact
        ? "Drag to add. Drag placed parts to move.\nRestore reloads the baseline ship."
        : "Drag modules from the catalog to add them.\nSelect a placed part to inspect it, drag to reposition it, and use Restore to recover the baseline vehicle.",
      {
        fontSize: `${toolbar.bodySize}px`,
        color: colors.textSecondary,
        lineSpacing: compact ? 2 : 5,
        wordWrap: { width: this.layout.leftPanelWidth - (compact ? 20 : 42) },
      },
    );
    this.scene.add
      .text(
        this.layout.controlsX,
        this.layout.controlsY - spacing.md,
        "COMMANDS",
        {
          fontSize: `${toolbar.sectionLabelSize}px`,
          color: colors.textAccent,
          backgroundColor: colors.chipMutedFill,
          padding: chips.padding,
        },
      )
      .setOrigin(0, 0.5);
  }

  createToolbarShell() {
    const { colors, spacing } = this.theme;
    const compact = this.layout.compactUi;

    this.toolbarShadow = this.scene.add
      .rectangle(
        this.layout.toolbarX + this.layout.toolbarWidth / 2,
        this.layout.toolbarY + this.layout.toolbarHeight / 2 + 3,
        this.layout.toolbarWidth,
        this.layout.toolbarHeight,
        colors.shadow,
        0.28,
      )
      .setStrokeStyle(2, colors.cardEdge, 0.08);
    this.toolbarPanel = this.scene.add
      .rectangle(
        this.layout.toolbarX + this.layout.toolbarWidth / 2,
        this.layout.toolbarY + this.layout.toolbarHeight / 2,
        this.layout.toolbarWidth,
        this.layout.toolbarHeight,
        colors.panelInsetAlt,
        0.92,
      )
      .setStrokeStyle(2, colors.cardEdge, 0.22);
    this.toolbarInset = this.scene.add
      .rectangle(
        this.layout.toolbarX + this.layout.toolbarWidth / 2,
        this.layout.toolbarY + this.layout.toolbarHeight / 2 + spacing.sm,
        this.layout.toolbarWidth - spacing.md,
        this.layout.toolbarHeight - spacing.md,
        colors.cardFill,
        0.62,
      )
      .setStrokeStyle(1, colors.cardEdgeSoft, 0.16);
    this.toolbarTitle = this.scene.add.text(
      this.layout.toolbarX + spacing.md,
      this.layout.toolbarY + spacing.md,
      "Pad Controls",
      {
        fontSize: `${this.theme.toolbar.titleSize}px`,
        color: colors.textPrimary,
        fontStyle: "bold",
      },
    );
    this.toolbarBody = this.scene.add.text(
      this.layout.toolbarX + spacing.md,
      this.layout.toolbarY + spacing.md + (compact ? 16 : 24),
      compact
        ? "Launch uses the current build."
        : "Launch commits the current vehicle. Utility controls stay grouped below for rapid rebuild cycles.",
      {
        fontSize: `${this.theme.toolbar.bodySize}px`,
        color: colors.textMuted,
        wordWrap: { width: this.layout.toolbarWidth - spacing.xl },
      },
    );
  }

  createButton({ label, variant, x, y, width, callback, eyebrow }) {
    const { buttons, toolbar, colors, spacing, fontSizes } = this.theme;
    const compact = this.layout.compactUi;
    const fillColor = toColor(variant.fill);
    const fillHoverColor = toColor(variant.fillHover);
    const strokeColor = toColor(variant.stroke);
    const glowColor = toColor(variant.glow);
    const container = this.scene.add.container(x, y);

    const shadow = this.scene.add
      .rectangle(
        0,
        buttons.shadowOffset,
        width,
        this.layout.primaryButtonHeight,
        colors.shadow,
        0.32,
      )
      .setOrigin(0);
    const glow = this.scene.add
      .rectangle(
        width / 2,
        this.layout.primaryButtonHeight / 2,
        width + spacing.xs,
        this.layout.primaryButtonHeight + spacing.xs,
        glowColor,
        0.08,
      )
      .setVisible(false);
    const background = this.scene.add
      .rectangle(
        0,
        0,
        width,
        this.layout.primaryButtonHeight,
        fillColor,
        buttons.baseFillAlpha,
      )
      .setOrigin(0)
      .setStrokeStyle(buttons.borderWidth, strokeColor, buttons.baseStrokeAlpha)
      .setInteractive({ useHandCursor: true });
    const eyebrowText = this.scene.add
      .text(spacing.sm, compact ? 4 : spacing.xs, eyebrow, {
        fontSize: `${fontSizes.micro}px`,
        color: colors.textMuted,
        fontStyle: "bold",
        letterSpacing: 0.8,
      })
      .setAlpha(0.9);
    const labelText = this.scene.add
      .text(spacing.sm, this.layout.primaryButtonHeight / 2 + (compact ? 1 : 4), label, {
        fontSize: `${toolbar.buttonTextSize}px`,
        color: colors.textPrimary,
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);

    container.add([shadow, glow, background, eyebrowText, labelText]);
    container.disabled = false;
    container.restY = y;
    container.setDisabled = (disabled) => {
      container.disabled = disabled;
      background.disableInteractive();
      if (!disabled) {
        background.setInteractive({ useHandCursor: true });
      }
      background.setFillStyle(fillColor, disabled ? buttons.disabledFillAlpha : buttons.baseFillAlpha);
      background.setStrokeStyle(
        buttons.borderWidth,
        strokeColor,
        disabled ? 0.24 : buttons.baseStrokeAlpha,
      );
      glow.setVisible(false);
      labelText.setAlpha(disabled ? buttons.disabledTextAlpha : 1);
      eyebrowText.setAlpha(disabled ? 0.34 : 0.9);
    };

    background.on("pointerdown", () => {
      if (container.disabled) {
        return;
      }

      background.setFillStyle(fillHoverColor, 1);
      this.scene.tweens.add({
        targets: container,
        y: container.restY + toolbar.pressOffset,
        duration: 90,
        yoyo: true,
        ease: "Quad.easeInOut",
      });
      callback?.();
    });
    background.on("pointerover", () => {
      if (container.disabled) {
        return;
      }

      glow.setVisible(true);
      background.setFillStyle(fillHoverColor, 1);
      background.setStrokeStyle(
        buttons.borderWidth,
        strokeColor,
        buttons.hoverStrokeAlpha,
      );
      this.scene.tweens.add({
        targets: container,
        scale: toolbar.hoverScale,
        duration: 150,
        ease: "Quad.easeOut",
      });
    });
    background.on("pointerout", () => {
      glow.setVisible(false);
      background.setFillStyle(fillColor, buttons.baseFillAlpha);
      background.setStrokeStyle(
        buttons.borderWidth,
        strokeColor,
        buttons.baseStrokeAlpha,
      );
      this.scene.tweens.add({
        targets: container,
        scale: 1,
        duration: 150,
        ease: "Quad.easeOut",
      });
    });

    return container;
  }

  setRemoveEnabled(enabled) {
    this.removeButton.setDisabled(!enabled);
  }

  setLaunchEnabled(enabled) {
    this.launchButton.setDisabled(!enabled);
  }
}
