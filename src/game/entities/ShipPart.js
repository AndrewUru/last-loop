import Phaser from "phaser";

function getTrimmedTextureKey(scene, textureKey) {
  const trimmedKey = `${textureKey}__trimmed`;
  if (scene.textures.exists(trimmedKey)) {
    return trimmedKey;
  }

  if (!scene.textures.exists(textureKey) || typeof document === "undefined") {
    return textureKey;
  }

  const sourceImage = scene.textures.get(textureKey).getSourceImage();
  if (!sourceImage?.width || !sourceImage?.height) {
    return textureKey;
  }

  const scanCanvas = document.createElement("canvas");
  scanCanvas.width = sourceImage.width;
  scanCanvas.height = sourceImage.height;
  const scanContext = scanCanvas.getContext("2d", { willReadFrequently: true });

  if (!scanContext) {
    return textureKey;
  }

  scanContext.drawImage(sourceImage, 0, 0);
  const { data, width, height } = scanContext.getImageData(0, 0, scanCanvas.width, scanCanvas.height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return textureKey;
  }

  const trimmedWidth = maxX - minX + 1;
  const trimmedHeight = maxY - minY + 1;
  const trimmedCanvas = document.createElement("canvas");
  trimmedCanvas.width = trimmedWidth;
  trimmedCanvas.height = trimmedHeight;
  const trimmedContext = trimmedCanvas.getContext("2d");

  if (!trimmedContext) {
    return textureKey;
  }

  trimmedContext.drawImage(
    sourceImage,
    minX,
    minY,
    trimmedWidth,
    trimmedHeight,
    0,
    0,
    trimmedWidth,
    trimmedHeight,
  );
  scene.textures.addCanvas(trimmedKey, trimmedCanvas);
  return trimmedKey;
}

export default class ShipPart extends Phaser.GameObjects.Container {
  constructor(scene, x, y, part, options = {}) {
    super(scene, x, y);
    this.part = part;
    this.options = {
      cellSize: 56,
      padding: 8,
      alpha: 1,
      ghost: false,
      showLabel: true,
      showPlate: false,
      iconMode: false,
      ...options,
    };

    this.plate = scene.add.graphics();
    this.sprite = null;
    this.fallback = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, this.options.showLabel ? part.shortLabel : "", {
        fontSize: `${Math.max(10, Math.round(this.options.cellSize * 0.2))}px`,
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add([this.plate, this.fallback, this.label]);
    this.redraw();
    scene.add.existing(this);
  }

  redraw(options = {}) {
    this.options = { ...this.options, ...options };
    const width = this.part.gridWidth * this.options.cellSize;
    const height = this.part.gridHeight * this.options.cellSize;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const frameAlpha = this.options.ghost ? 0.18 : 0.92;
    const contentAlpha = this.options.ghost ? 0.45 : 1;

    this.setSize(width, height);
    this.setAlpha(this.options.alpha);
    this.plate.clear();
    this.fallback.clear();

    if (this.options.showPlate) {
      this.plate.lineStyle(2, this.part.stroke, this.options.ghost ? 0.45 : 1);
      this.plate.fillStyle(0x0f1722, frameAlpha);
      this.plate.fillRoundedRect(-halfWidth, -halfHeight, width, height, 16);
      this.plate.strokeRoundedRect(-halfWidth, -halfHeight, width, height, 16);
    }

    this.createPartSprite(width, height, contentAlpha);

    this.label.setText(this.options.showLabel ? this.part.shortLabel : "");
    this.label.setAlpha(this.options.ghost ? 0.82 : 1);
    this.label.setPosition(
      0,
      halfHeight + Math.max(10, Math.round(this.options.cellSize * 0.18)),
    );
  }

  createPartSprite(width, height, alpha) {
    this.sprite?.destroy();
    this.sprite = null;

    const padding = this.options.padding;
    const targetWidth = Math.max(8, width - padding * 2);
    const targetHeight = Math.max(8, height - padding * 2);

    if (this.part.texture && this.scene.textures.exists(this.part.texture)) {
      const renderTexture = getTrimmedTextureKey(this.scene, this.part.texture);
      const textureFrame = this.scene.textures.get(renderTexture).getSourceImage();
      const sourceWidth = textureFrame.width || 1;
      const sourceHeight = textureFrame.height || 1;
      const textureScale = this.options.iconMode
        ? this.part.iconScale ?? 1
        : this.part.displayScale ?? 1;

      this.sprite = this.scene.add.image(0, 0, renderTexture);
      this.sprite.setDisplaySize(
        Math.max(8, targetWidth * textureScale),
        Math.max(8, targetHeight * textureScale),
      );
      this.sprite.setAlpha(alpha);
      this.addAt(this.sprite, this.options.showPlate ? 1 : 0);
      return;
    }

    this.fallback.lineStyle(2, this.part.stroke, this.options.ghost ? 0.55 : 1);
    this.fallback.fillStyle(this.part.color, alpha);
    this.fallback.fillRoundedRect(-targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight, 12);
    this.fallback.strokeRoundedRect(
      -targetWidth / 2,
      -targetHeight / 2,
      targetWidth,
      targetHeight,
      12,
    );
    this.fallback.fillStyle(this.part.accent, alpha);
    this.fallback.fillRect(-targetWidth * 0.2, -targetHeight * 0.25, targetWidth * 0.4, targetHeight * 0.14);
  }
}
