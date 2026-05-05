export default class BuildToolbar {
  constructor(scene, { layout, onLaunch, onClear, onRemove, onReset }) {
    this.scene = scene;
    this.layout = layout;

    this.launchButton = this.createTextButton({
      x: layout.primaryButtonX,
      y: layout.primaryButtonY,
      width: layout.primaryButtonWidth,
      height: layout.primaryButtonHeight,
      label: "Lanzar",
      callback: onLaunch,
    });
    this.clearButton = this.createIconButton({
      x: layout.secondaryButtonX,
      y: layout.secondaryButtonY,
      label: "-",
      callback: onClear,
    });
    this.removeButton = this.createIconButton({
      x: layout.secondaryButtonX + layout.secondaryButtonWidth + layout.secondaryButtonGap,
      y: layout.secondaryButtonY,
      label: "|",
      callback: onRemove,
    });
    this.resetButton = this.createUndoButton({
      x: layout.tertiaryButtonX,
      y: layout.tertiaryButtonY,
      callback: onReset,
    });

    this.setRemoveEnabled(false);
  }

  createTextButton({ x, y, width, height, label, callback }) {
    const background = this.scene.add
      .rectangle(x, y, width, height, 0x172d4d, 0.98)
      .setOrigin(0)
      .setStrokeStyle(1, 0x5f7fae, 0.4)
      .setInteractive({ useHandCursor: true });
    const text = this.scene.add
      .text(x + width / 2, y + height / 2, label, {
        fontSize: "20px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const button = { background, text, disabled: false };

    background.on("pointerdown", () => {
      if (!button.disabled) {
        callback?.();
      }
    });
    button.setDisabled = (disabled) => {
      button.disabled = disabled;
      background.setAlpha(disabled ? 0.45 : 1);
      text.setAlpha(disabled ? 0.5 : 1);
    };
    return button;
  }

  createIconButton({ x, y, label, callback }) {
    const size = this.layout.secondaryButtonWidth;
    const background = this.scene.add
      .rectangle(x, y, size, size, 0x172d4d, 0.98)
      .setOrigin(0)
      .setStrokeStyle(1, 0x5f7fae, 0.4)
      .setInteractive({ useHandCursor: true });
    const text = this.scene.add
      .text(x + size / 2, y + size / 2, label, {
        fontSize: "34px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const button = { background, text, disabled: false };

    background.on("pointerdown", () => {
      if (!button.disabled) {
        callback?.();
      }
    });
    button.setDisabled = (disabled) => {
      button.disabled = disabled;
      background.setAlpha(disabled ? 0.42 : 1);
      text.setAlpha(disabled ? 0.5 : 1);
    };
    return button;
  }

  createUndoButton({ x, y, callback }) {
    const width = this.layout.tertiaryButtonWidth;
    const height = this.layout.secondaryButtonWidth;
    const background = this.scene.add
      .rectangle(x, y, width, height, 0x172d4d, 0.98)
      .setOrigin(0)
      .setStrokeStyle(1, 0x5f7fae, 0.4)
      .setInteractive({ useHandCursor: true });
    const icon = this.scene.add.graphics();
    icon.fillStyle(0xb9c7d9, 1);
    icon.fillTriangle(x + 18, y + height / 2, x + 34, y + 16, x + 34, y + height - 16);
    icon.lineStyle(8, 0xb9c7d9, 1);
    icon.beginPath();
    icon.arc(x + 38, y + height / 2 + 4, 20, -1.55, 0.72, false);
    icon.strokePath();
    background.on("pointerdown", () => callback?.());
    return { background, text: icon, setDisabled() {} };
  }

  setRemoveEnabled(enabled) {
    this.removeButton.setDisabled(!enabled);
  }

  setLaunchEnabled(enabled) {
    this.launchButton.setDisabled(!enabled);
  }
}
