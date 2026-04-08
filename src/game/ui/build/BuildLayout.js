import Phaser from "phaser";
import { SHIP_PARTS } from "../../data/parts.js";

export function computeBuildLayout({ width, height, grid, gridZoom }) {
  const compactUi = width < 1500 || height < 920;
  const outerPadding = Math.max(28, Math.round(width * 0.018));
  const panelGap = Math.max(26, Math.round(width * 0.014));
  const leftPanelWidth = Phaser.Math.Clamp(
    Math.round(width * 0.19),
    290,
    360,
  );
  const rightPanelWidth = Phaser.Math.Clamp(
    Math.round(width * 0.21),
    300,
    390,
  );
  const centerStartX = outerPadding + leftPanelWidth + panelGap;
  const centerEndX = width - outerPadding - rightPanelWidth - panelGap;
  const centerWidth = centerEndX - centerStartX;
  const cellSize = Phaser.Math.Clamp(
    Math.floor(
      Math.min((centerWidth - 40) / grid.columns, (height - 250) / grid.rows),
    ),
    52,
    78,
  );
  const gridWidth = grid.columns * cellSize;
  const gridHeight = grid.rows * cellSize;
  const gridX = centerStartX + (centerWidth - gridWidth) / 2;
  const gridY = Math.max(178, Math.round((height - gridHeight) / 2));
  const panelTop = 162;
  const leftPanelBottom = height - 32;
  const buttonHeight = 56;
  const buttonGap = 12;
  const buttonStackHeight = buttonHeight * 3 + buttonGap * 2;
  const controlsTextHeight = compactUi ? 88 : 112;
  const controlsY =
    leftPanelBottom - buttonStackHeight - controlsTextHeight - 18;
  const paletteTopY = panelTop + 82;
  const paletteBottomY = controlsY - 18;
  const paletteGap = compactUi ? 10 : 14;
  const availablePaletteHeight = Math.max(
    360,
    paletteBottomY - paletteTopY - paletteGap * (SHIP_PARTS.length - 1),
  );
  const cardHeight = Phaser.Math.Clamp(
    Math.floor(availablePaletteHeight / SHIP_PARTS.length),
    compactUi ? 82 : 88,
    compactUi ? 94 : 110,
  );
  const cardGapY = cardHeight + paletteGap;
  const cardStartY = paletteTopY + cardHeight / 2;
  const rightInnerTop = panelTop + 34;
  const stackBlockHeight = compactUi ? 154 : 190;
  const validationBlockHeight = compactUi ? 138 : 170;
  const focusBlockTop =
    rightInnerTop + stackBlockHeight + validationBlockHeight + 74;

  return {
    grid: {
      ...grid,
      cellSize,
      x: gridX,
      y: gridY,
    },
    baseGridCellSize: cellSize,
    gridZoom: gridZoom ?? 1,
    layout: {
      width,
      height,
      compactUi,
      outerPadding,
      panelGap,
      leftPanelWidth,
      rightPanelWidth,
      centerStartX,
      centerEndX,
      centerWidth,
      gridWidth,
      gridHeight,
      gridX,
      gridY,
      leftPanelX: outerPadding + leftPanelWidth / 2,
      rightPanelX: width - outerPadding - rightPanelWidth / 2,
      panelY: height / 2 + 20,
      panelHeight: height - 170,
      panelTop,
      centerPanelX: centerStartX + centerWidth / 2,
      centerPanelWidth: centerWidth + 36,
      centerPanelHeight: gridHeight + 70,
      titleX: outerPadding + 18,
      cardWidth: leftPanelWidth - 42,
      cardHeight,
      cardX: outerPadding + leftPanelWidth / 2,
      cardStartY,
      cardGapY,
      paletteTopY,
      paletteBottomY,
      paletteIconCellSize: compactUi ? 19 : 22,
      paletteTitleSize: compactUi ? 16 : 18,
      paletteMetaSize: compactUi ? 12 : 13,
      paletteHintSize: compactUi ? 11 : 12,
      controlsX: outerPadding + 18,
      controlsY,
      launchButtonX: outerPadding + 44,
      launchButtonY: leftPanelBottom - buttonStackHeight,
      sideButtonWidth: leftPanelWidth - 88,
      sideButtonGap: buttonGap,
      sideButtonHeight: 56,
      rightTextX: width - outerPadding - rightPanelWidth + 26,
      rightInnerTop,
      statsTitleY: rightInnerTop,
      statsBodyY: rightInnerTop + 36,
      validationTitleY: rightInnerTop + stackBlockHeight + 22,
      validationBodyY: rightInnerTop + stackBlockHeight + 58,
      focusTitleY: focusBlockTop,
      focusBodyY: focusBlockTop + 36,
      rightWrapWidth: rightPanelWidth - 52,
      messageX: gridX,
      messageY: gridY + gridHeight + 26,
    },
  };
}
