import Phaser from "phaser";

export default class BuildContextMenu {
  constructor(scene, { theme, onSelect, onDelete, onCancel }) {
    this.scene = scene;
    this.theme = theme;
    this.callbacks = { onSelect, onDelete, onCancel };
    this.entry = null;

    this.root = scene.add.container(0, 0).setDepth(theme.depth.contextMenu).setVisible(false);
    this.shadow = scene.add
      .rectangle(
        0,
        3,
        theme.contextMenu.width,
        theme.contextMenu.height,
        theme.colors.shadow,
        0.32,
      )
      .setOrigin(0)
      .setStrokeStyle(2, theme.colors.cardEdge, 0.08);
    this.background = scene.add
      .rectangle(
        0,
        0,
        theme.contextMenu.width,
        theme.contextMenu.height,
        theme.colors.panelFillCenter,
        0.98,
      )
      .setOrigin(0)
      .setStrokeStyle(2, theme.colors.cardEdge, 0.35);
    this.header = scene.add.text(theme.contextMenu.itemInset, 8, "PART ACTIONS", {
      fontSize: `${theme.fontSizes.micro}px`,
      color: theme.colors.textAccent,
      fontStyle: "bold",
      letterSpacing: 0.8,
    });
    this.root.add([this.shadow, this.background, this.header]);

    this.buttons = [
      this.createItem(0, "Select", () => this.invoke(this.callbacks.onSelect)),
      this.createItem(1, "Delete", () => this.invoke(this.callbacks.onDelete)),
      this.createItem(2, "Cancel", () => {
        this.hide();
        this.callbacks.onCancel?.();
      }),
    ];
    this.buttons.forEach((item) => this.root.add(item));
  }

  createItem(index, label, callback) {
    const { itemInset, itemHeight, itemGap, itemWidth, fontSize } =
      this.theme.contextMenu;
    const y = itemInset + 18 + index * (itemHeight + itemGap);
    const item = this.scene.add.container(itemInset, y);
    const shadow = this.scene.add
      .rectangle(0, 2, itemWidth, itemHeight, this.theme.colors.shadow, 0.22)
      .setOrigin(0);
    const background = this.scene.add
      .rectangle(0, 0, itemWidth, itemHeight, this.theme.colors.cardFill, 0.96)
      .setOrigin(0)
      .setStrokeStyle(1, this.theme.colors.cardEdge, 0.24)
      .setInteractive({ useHandCursor: true });
    const text = this.scene.add
      .text(12, itemHeight / 2, label, {
        fontSize: `${fontSize}px`,
        color: this.theme.colors.textPrimary,
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);

    background.on("pointerover", () => {
      background.setFillStyle(this.theme.colors.cardFillRaised, 0.98);
      background.setStrokeStyle(1, this.theme.colors.cardEdge, 0.8);
    });
    background.on("pointerout", () => {
      background.setFillStyle(this.theme.colors.cardFill, 0.96);
      background.setStrokeStyle(1, this.theme.colors.cardEdge, 0.24);
    });
    background.on("pointerdown", callback);

    item.add([shadow, background, text]);
    return item;
  }

  invoke(callback) {
    if (!this.entry || !callback) {
      return;
    }

    callback(this.entry);
    this.hide();
  }

  show(worldX, worldY, entry) {
    this.entry = entry;
    this.root.setPosition(
      Phaser.Math.Clamp(
        worldX,
        12,
        this.scene.scale.width - this.theme.contextMenu.width - 12,
      ),
      Phaser.Math.Clamp(
        worldY,
        12,
        this.scene.scale.height - this.theme.contextMenu.height - 12,
      ),
    );
    this.root.setVisible(true);
  }

  hide() {
    this.entry = null;
    this.root.setVisible(false);
  }

  contains(pointer) {
    if (!this.root.visible) {
      return false;
    }

    const bounds = new Phaser.Geom.Rectangle(
      this.root.x,
      this.root.y,
      this.theme.contextMenu.width,
      this.theme.contextMenu.height,
    );
    return bounds.contains(pointer.worldX, pointer.worldY);
  }
}
