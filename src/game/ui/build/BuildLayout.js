import Phaser from "phaser";
import { SHIP_PARTS } from "../../data/parts.js";
import { getBuildTheme } from "./BuildTheme.js";

export function computeBuildLayout({ width, height, grid, gridZoom }) {
  const compactUi = true;
  const theme = getBuildTheme(compactUi);
  const { spacing, toolbar } = theme;
  const outerPadding = Phaser.Math.Clamp(
    Math.round(Math.min(width, height) * 0.014),
    14,
    22,
  );
  const panelGap = Phaser.Math.Clamp(
    Math.round(Math.min(width, height) * 0.012),
    12,
    18,
  );
  const leftPanelWidth = Phaser.Math.Clamp(
    Math.round(width * 0.17),
    232,
    300,
  );
  const rightPanelWidth = Phaser.Math.Clamp(
    Math.round(width * 0.19),
    250,
    330,
  );
  const centerStartX = outerPadding + leftPanelWidth + panelGap;
  const centerEndX = width - outerPadding - rightPanelWidth - panelGap;
  const centerWidth = centerEndX - centerStartX;
  const cellSize = Phaser.Math.Clamp(
    Math.floor(
      Math.min((centerWidth - 24) / grid.columns, (height - 170) / grid.rows),
    ),
    36,
    66,
  );
  const gridWidth = grid.columns * cellSize;
  const gridHeight = grid.rows * cellSize;
  const gridX = centerStartX + (centerWidth - gridWidth) / 2;
  const panelTop = 108;
  const panelBottom = height - outerPadding;
  const panelHeight = panelBottom - panelTop + 10;
  const leftPanelBottom = panelBottom;
  const gridY = Math.max(panelTop + 56, Math.round((height - gridHeight) / 2) + 10);
  const buttonHeight = toolbar.buttonHeight;
  const buttonGap = toolbar.buttonGap;
  const toolbarButtonStartOffset = 56;
  const toolbarHeight = Math.max(
    toolbar.toolbarHeight,
    toolbarButtonStartOffset + buttonHeight * 3 + buttonGap * 2 + spacing.md,
  );
  const controlsTextHeight = compactUi ? 54 : 92;
  const toolbarY = leftPanelBottom - toolbarHeight;
  const controlsY = toolbarY - controlsTextHeight - spacing.sm;
  const paletteTopY = panelTop + 54;
  const paletteBottomY = controlsY - spacing.sm;
  const paletteGap = compactUi ? spacing.xxs : spacing.sm;
  const availablePaletteHeight = Math.max(
    220,
    paletteBottomY - paletteTopY - paletteGap * (SHIP_PARTS.length - 1),
  );
  const cardHeight = Phaser.Math.Clamp(
    Math.floor(availablePaletteHeight / SHIP_PARTS.length),
    compactUi ? 54 : 88,
    compactUi ? 72 : 110,
  );
  const cardGapY = cardHeight + paletteGap;
  const cardStartY = paletteTopY + cardHeight / 2;
  const rightColumnX = width - outerPadding - rightPanelWidth + 18;
  const rightColumnY = panelTop + 18;
  const rightColumnWidth = rightPanelWidth - 36;
  const rightColumnHeight = panelHeight - 36;
  const statsPanelHeight = Phaser.Math.Clamp(
    Math.round(rightColumnHeight * (compactUi ? 0.53 : 0.55)),
    compactUi ? 236 : 372,
    compactUi ? 300 : 410,
  );
  const inspectorPanelY = rightColumnY + statsPanelHeight + spacing.sm;
  const inspectorPanelHeight = Math.max(
    compactUi ? 132 : 228,
    rightColumnHeight - statsPanelHeight - spacing.sm,
  );
  const toastWidth = Math.min(theme.toast.maxWidth, centerWidth - spacing.xl);

  return {
    grid: {
      ...grid,
      cellSize,
      x: gridX,
      y: gridY,
    },
    baseGridCellSize: cellSize,
    gridZoom: gridZoom ?? 1,
    theme,
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
      panelY: panelTop + panelHeight / 2,
      panelHeight,
      panelTop,
      centerPanelX: centerStartX + centerWidth / 2,
      centerPanelWidth: centerWidth + 18,
      centerPanelHeight: gridHeight + 56,
      titleX: outerPadding + 10,
      cardWidth: leftPanelWidth - 20,
      cardHeight,
      cardX: outerPadding + leftPanelWidth / 2,
      cardStartY,
      cardGapY,
      paletteTopY,
      paletteBottomY,
      paletteIconCellSize: compactUi ? 14 : 22,
      controlsX: outerPadding + 10,
      controlsY,
      toolbarX: outerPadding + 10,
      toolbarY,
      toolbarWidth: leftPanelWidth - 20,
      toolbarHeight,
      primaryButtonX: outerPadding + 10,
      primaryButtonY: toolbarY + toolbarButtonStartOffset,
      primaryButtonWidth: leftPanelWidth - 20,
      primaryButtonHeight: buttonHeight,
      secondaryButtonX: outerPadding + 10,
      secondaryButtonY: toolbarY + toolbarButtonStartOffset + buttonHeight + buttonGap,
      secondaryButtonWidth:
        Math.floor((leftPanelWidth - 20 - buttonGap) / 2),
      secondaryButtonGap: buttonGap,
      tertiaryButtonX: outerPadding + 10,
      tertiaryButtonY: toolbarY + toolbarButtonStartOffset + (buttonHeight + buttonGap) * 2,
      tertiaryButtonWidth: leftPanelWidth - 20,
      rightColumnX,
      rightColumnY,
      rightColumnWidth,
      rightColumnHeight,
      statsPanelX: rightColumnX,
      statsPanelY: rightColumnY,
      statsPanelWidth: rightColumnWidth,
      statsPanelHeight,
      inspectorPanelX: rightColumnX,
      inspectorPanelY,
      inspectorPanelWidth: rightColumnWidth,
      inspectorPanelHeight,
      messageX: centerStartX + centerWidth / 2,
      messageY: gridY + gridHeight + spacing.sm,
      toastWidth,
    },
  };
}
