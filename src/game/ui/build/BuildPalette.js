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
    paletteIconCellSize,
  } = scene.layout;
  const { colors, palette, spacing, chips } = scene.theme;
  scene.paletteCards = new Map();

  SHIP_PARTS.forEach((part, index) => {
    const card = scene.add.container(cardX, cardStartY + index * cardGapY);
    const shadow = scene.add
      .rectangle(0, 3, cardWidth, cardHeight, colors.shadow, 0.28)
      .setStrokeStyle(2, part.color, 0.08);
    const background = scene.add
      .rectangle(0, 0, cardWidth, cardHeight, colors.cardFill, 0.98)
      .setStrokeStyle(2, part.color, 0.3);
    const inner = scene.add
      .rectangle(0, 0, cardWidth - spacing.md, cardHeight - spacing.md, colors.cardFillAlt, 0.5)
      .setStrokeStyle(1, colors.cardEdgeSoft, 0.12);
    const accentStrip = scene.add.rectangle(
      -cardWidth / 2 + spacing.sm,
      0,
      palette.accentWidth,
      cardHeight - spacing.md,
      part.color,
      0.96,
    );
    const iconRing = scene.add
      .rectangle(
        -cardWidth / 2 + 50,
        0,
        58,
        58,
        colors.panelInsetAlt,
        0.92,
      )
      .setStrokeStyle(1, part.color, 0.22);

    const icon = new ShipPart(scene, -cardWidth / 2 + 50, 0, part, {
      cellSize: paletteIconCellSize,
      padding: 1,
      showLabel: false,
      showPlate: false,
      iconMode: true,
    });
    const title = scene.add
      .text(-cardWidth / 2 + 92, -26, part.name, {
        fontSize: `${palette.titleSize}px`,
        color: colors.textPrimary,
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    const meta = scene.add
      .text(
        -cardWidth / 2 + 92,
        0,
        `M ${part.mass}   F ${part.fuel}   T ${part.thrust}`,
        {
          fontSize: `${palette.metaSize}px`,
          color: colors.textMuted,
          wordWrap: { width: cardWidth - 114 },
        },
      )
      .setOrigin(0, 0.5);
    const hint = scene.add
      .text(-cardWidth / 2 + 92, 28, part.description, {
        fontSize: `${palette.hintSize}px`,
        color: colors.textSecondary,
        wordWrap: { width: cardWidth - 114 },
      })
      .setOrigin(0, 0.5);
    const roleChip = scene.add
      .text(cardWidth / 2 - spacing.md, -26, part.role.toUpperCase(), {
        fontSize: `${palette.roleChipSize}px`,
        color: colors.chipText,
        backgroundColor: colors.chipFill,
        padding: chips.padding,
      })
      .setOrigin(1, 0.5);

    card.add([
      shadow,
      background,
      inner,
      accentStrip,
      iconRing,
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
    scene.paletteCards.set(part.id, {
      card,
      background,
      inner,
      accentStrip,
      title,
      meta,
      hint,
      roleChip,
      originalScale,
    });
    card.on("pointerdown", (pointer) => scene.beginPaletteDrag(part, pointer));
    card.on("pointerover", () => {
      scene.setHoveredInfo({ source: "palette", partId: part.id });
      background.setStrokeStyle(2, part.color, 0.72);
      inner.setFillStyle(colors.cardFillRaised, 0.58);
      scene.tweens.add({
        targets: card,
        scale: originalScale * palette.hoverScale,
        duration: 150,
        ease: "Quad.easeOut",
      });
    });
    card.on("pointerout", () => {
      scene.clearHoveredInfo("palette", part.id);
      scene.syncPaletteSelection?.();
    });
  });

  scene.syncPaletteSelection?.();
}
