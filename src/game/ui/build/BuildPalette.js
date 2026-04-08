import Phaser from "phaser";
import ShipPart from "../../entities/ShipPart.js";
import { SHIP_PARTS } from "../../data/parts.js";

export function createBuildPalette(scene) {
  const {
    cardX,
    cardWidth,
    cardHeight,
    cardStartY,
    cardGapY,
    controlsX,
    controlsY,
    paletteIconCellSize,
    paletteTitleSize,
    paletteMetaSize,
    paletteHintSize,
    compactUi,
  } = scene.layout;

  SHIP_PARTS.forEach((part, index) => {
    const card = scene.add.container(cardX, cardStartY + index * cardGapY);
    const accentStrip = scene.add.rectangle(
      -cardWidth / 2 + 7,
      0,
      6,
      cardHeight - 16,
      part.color,
      0.92,
    );
    const background = scene.add
      .rectangle(0, 0, cardWidth, cardHeight, 0x102233, 0.96)
      .setStrokeStyle(2, part.color, 0.28);
    const shadow = scene.add
      .rectangle(0, 2, cardWidth, cardHeight, 0x000000, 0.3)
      .setStrokeStyle(2, part.color, 0.08);

    const icon = new ShipPart(scene, -cardWidth / 2 + 50, 0, part, {
      cellSize: paletteIconCellSize,
      padding: 1,
      showLabel: false,
      showPlate: false,
      iconMode: true,
    });
    const title = scene.add
      .text(-cardWidth / 2 + 92, -26, part.name, {
        fontSize: `${paletteTitleSize}px`,
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    const meta = scene.add
      .text(
        -cardWidth / 2 + 92,
        0,
        `M ${part.mass}   F ${part.fuel}   T ${part.thrust}`,
        {
          fontSize: `${paletteMetaSize}px`,
          color: "#91c9e8",
          wordWrap: { width: cardWidth - 114 },
        },
      )
      .setOrigin(0, 0.5);
    const hint = scene.add
      .text(-cardWidth / 2 + 92, 28, part.description, {
        fontSize: `${paletteHintSize}px`,
        color: "#bfdff4",
        wordWrap: { width: cardWidth - 114 },
      })
      .setOrigin(0, 0.5);
    const roleChip = scene.add
      .text(cardWidth / 2 - 18, -26, part.role.toUpperCase(), {
        fontSize: compactUi ? "9px" : "10px",
        color: "#081624",
        backgroundColor: "#a7e8ff",
        padding: { left: 7, right: 7, top: 3, bottom: 3 },
      })
      .setOrigin(1, 0.5);

    card.add([
      shadow,
      background,
      accentStrip,
      icon,
      title,
      meta,
      hint,
      roleChip,
    ]);
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

    const originalScale = card.scale;
    card.on("pointerdown", (pointer) => scene.beginPaletteDrag(part, pointer));
    card.on("pointerover", () => {
      scene.setHoveredInfo({ source: "palette", partId: part.id });
      background.setStrokeStyle(2, part.color, 0.6);
      scene.tweens.add({
        targets: card,
        scale: originalScale * 1.05,
        duration: 150,
        ease: "Quad.easeOut",
      });
    });
    card.on("pointerout", () => {
      scene.clearHoveredInfo("palette", part.id);
      background.setStrokeStyle(2, part.color, 0.28);
      scene.tweens.add({
        targets: card,
        scale: originalScale,
        duration: 150,
        ease: "Quad.easeOut",
      });
    });
  });

  scene.add.text(controlsX, controlsY, "Controls", {
    fontSize: compactUi ? "20px" : "22px",
    color: "#effcff",
    fontStyle: "bold",
  });
  scene.add.text(
    controlsX,
    controlsY + 38,
    "Drag from the catalog to add modules.\nClick selects a placed part.\nDrag a placed part to reposition it.\nRight click opens part actions.",
    {
      fontSize: compactUi ? "14px" : "16px",
      color: "#a9d9f3",
      lineSpacing: 6,
      wordWrap: { width: scene.layout.leftPanelWidth - 42 },
    },
  );
}
