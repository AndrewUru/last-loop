import Phaser from "phaser";
import { SHIP_PARTS } from "../../data/parts.js";
import { getBuildTheme } from "./BuildTheme.js";

export function computeBuildLayout({ width, height, grid, gridZoom }) {
  const compactUi = width < 1500 || height < 920;
  const theme = getBuildTheme(compactUi);
  const { spacing, toolbar } = theme;
  const outerPadding = Math.max(28, Math.round(width * 0.018));
  const panelGap = Math.max(26, Math.round(width * 0.014));
  const leftPanelWidth = Phaser.Math.Clamp(
    Math.round(width * 0.19),
    290,
    360,
  );
  const rightPanelWidth = Phaser.Math.Clamp(
    Math.round(width * 0.22),
    312,
    398,
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
  const panelHeight = height - 170;
  const leftPanelBottom = height - spacing.xl;
  const buttonHeight = toolbar.buttonHeight;
  const buttonGap = toolbar.buttonGap;
  const buttonStackHeight = buttonHeight * 2 + buttonGap;
  const controlsTextHeight = compactUi ? 82 : 92;
  const toolbarHeight = toolbar.toolbarHeight;
  const toolbarY = leftPanelBottom - toolbarHeight;
  const controlsY = toolbarY - controlsTextHeight - spacing.lg;
  const paletteTopY = panelTop + 82;
  const paletteBottomY = controlsY - spacing.lg;
  const paletteGap = compactUi ? spacing.xs : spacing.sm;
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
  const rightColumnX = width - outerPadding - rightPanelWidth + 26;
  const rightColumnY = panelTop + 34;
  const rightColumnWidth = rightPanelWidth - 52;
  const rightColumnHeight = panelHeight - 68;
  const statsPanelHeight = Phaser.Math.Clamp(
    Math.round(rightColumnHeight * (compactUi ? 0.57 : 0.55)),
    compactUi ? 360 : 372,
    compactUi ? 392 : 410,
  );
  const inspectorPanelY = rightColumnY + statsPanelHeight + spacing.lg;
  const inspectorPanelHeight = Math.max(
    compactUi ? 208 : 228,
    rightColumnHeight - statsPanelHeight - spacing.lg,
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
      panelY: height / 2 + 20,
      panelHeight,
      panelTop,
      centerPanelX: centerStartX + centerWidth / 2,
      centerPanelWidth: centerWidth + 36,
      centerPanelHeight: gridHeight + 88,
      titleX: outerPadding + 18,
      cardWidth: leftPanelWidth - 42,
      cardHeight,
      cardX: outerPadding + leftPanelWidth / 2,
      cardStartY,
      cardGapY,
      paletteTopY,
      paletteBottomY,
      paletteIconCellSize: compactUi ? 19 : 22,
      controlsX: outerPadding + 18,
      controlsY,
      toolbarX: outerPadding + 18,
      toolbarY,
      toolbarWidth: leftPanelWidth - 36,
      toolbarHeight,
      primaryButtonX: outerPadding + 18,
      primaryButtonY: toolbarY + 78,
      primaryButtonWidth: leftPanelWidth - 36,
      primaryButtonHeight: buttonHeight,
      secondaryButtonX: outerPadding + 18,
      secondaryButtonY: toolbarY + 78 + buttonHeight + buttonGap,
      secondaryButtonWidth:
        Math.floor((leftPanelWidth - 36 - buttonGap) / 2),
      secondaryButtonGap: buttonGap,
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
      messageY: gridY + gridHeight + spacing.xl,
      toastWidth,
    },
  };
}
