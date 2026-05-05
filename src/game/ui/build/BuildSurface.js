export default class BuildSurface {
  constructor(scene, { layout, grid, theme }) {
    this.scene = scene;
    this.layout = layout;
    this.grid = grid;
    this.theme = theme;

    this.createBackground();
    this.createChrome();
  }

  createBackground() {
    const { width, height, paletteWidth, topBarHeight, bottomBarHeight } = this.layout;

    this.background = this.scene.add.graphics().setDepth(this.theme.depth.background);
    this.background.fillStyle(0x3f6293, 1);
    this.background.fillRect(0, 0, width, height);
    this.background.fillStyle(0x355783, 1);
    this.background.fillRect(0, 0, width, topBarHeight);
    this.background.fillRect(0, height - bottomBarHeight, width, bottomBarHeight);
    this.background.fillStyle(0x7fa4db, 0.82);
    this.background.fillRect(0, topBarHeight, paletteWidth, height - topBarHeight - bottomBarHeight);
    this.background.lineStyle(2, 0x2d4d78, 0.6);
    this.background.lineBetween(paletteWidth, topBarHeight, paletteWidth, height - bottomBarHeight);
  }

  createChrome() {
    const { width, topBarHeight, bottomBarHeight } = this.layout;

    this.scene.add
      .rectangle(8, 9, 72, 44, 0x172d4d, 0.96)
      .setOrigin(0)
      .setStrokeStyle(1, 0x5f7fae, 0.4);
    this.drawMenuIcon(44, 31);

    this.scene.add
      .rectangle(width - 168, 9, 54, 44, 0x172d4d, 0.96)
      .setOrigin(0)
      .setStrokeStyle(1, 0x5f7fae, 0.4);
    this.drawMenuIcon(width - 141, 31);

    this.scene.add
      .rectangle(0, topBarHeight - 1, width, 2, 0x2f507d, 0.6)
      .setOrigin(0);
    this.scene.add
      .rectangle(0, this.layout.height - bottomBarHeight, width, 2, 0x2f507d, 0.6)
      .setOrigin(0);
  }

  drawMenuIcon(x, y) {
    const graphics = this.scene.add.graphics().setDepth(4);
    graphics.lineStyle(4, 0xffffff, 0.95);
    graphics.lineBetween(x - 16, y - 10, x + 16, y - 10);
    graphics.lineBetween(x - 16, y, x + 16, y);
    graphics.lineBetween(x - 16, y + 10, x + 16, y + 10);
  }
}
