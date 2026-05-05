import Phaser from "phaser";
import ShipPart from "../../entities/ShipPart.js";
import { SHIP_PARTS } from "../../data/parts.js";

const PART_LABELS = {
  capsule: "Capsula",
  avionics_ring: "SAS",
  fuel_tank_small: "Tanque S",
  fuel_tank_large: "Tanque L",
  engine_main: "Motor",
};

export function createBuildPalette(scene) {
  const {
    cardX,
    cardWidth,
    cardHeight,
    cardStartY,
    cardGapY,
    paletteIconCellSize,
  } = scene.layout;
  scene.paletteCards = new Map();

  SHIP_PARTS.forEach((part, index) => {
    const y = cardStartY + index * (cardHeight + cardGapY);
    const card = scene.add.container(cardX, y);
    const background = scene.add
      .rectangle(0, 0, cardWidth, cardHeight, 0x86a9df, 0.92)
      .setStrokeStyle(1, 0x688bc0, 0.45);
    const label = scene.add
      .text(0, -cardHeight / 2 + 12, PART_LABELS[part.id] || part.name, {
        fontSize: "12px",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: cardWidth - 6 },
      })
      .setOrigin(0.5);
    const icon = new ShipPart(scene, 0, 16, part, {
      cellSize: paletteIconCellSize,
      padding: 0,
      showLabel: false,
      showPlate: false,
      iconMode: true,
    });

    card.add([background, label, icon]);
    card.setSize(cardWidth, cardHeight);
    card.setInteractive(
      new Phaser.Geom.Rectangle(
        -cardWidth / 2,
        -cardHeight / 2,
        cardWidth,
        cardHeight,
      ),
      Phaser.Geom.Rectangle.Contains,
    );

    scene.paletteCards.set(part.id, {
      card,
      background,
      inner: background,
      accentStrip: background,
      title: label,
      meta: label,
      hint: label,
      roleChip: label,
      originalScale: 1,
    });

    card.on("pointerdown", (pointer) => scene.beginPaletteDrag(part, pointer));
    card.on("pointerover", () => {
      scene.setHoveredInfo({ source: "palette", partId: part.id });
      background.setFillStyle(0x9ab9ea, 1);
    });
    card.on("pointerout", () => {
      scene.clearHoveredInfo("palette", part.id);
      scene.syncPaletteSelection?.();
    });
  });

  scene.syncPaletteSelection?.();
}
