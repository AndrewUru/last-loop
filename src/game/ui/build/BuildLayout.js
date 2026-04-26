import { SHIP_PARTS } from "../../data/parts.js";
import { getBuildTheme } from "./BuildTheme.js";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function computeBuildLayout({ width, height, grid, gridZoom }) {
  const mobileLayout = width < 760 || (width < 920 && height > width * 1.15);
  const compactUi = true;
  const theme = getBuildTheme(compactUi);
  const { spacing, toolbar } = theme;

  if (mobileLayout) {
    return computeMobileBuildLayout({
      width,
      height,
      grid,
      gridZoom,
      theme,
      spacing,
      toolbar,
    });
  }

  const outerPadding = clamp(
    Math.round(Math.min(width, height) * 0.014),
    14,
    22,
  );
  const panelGap = clamp(
    Math.round(Math.min(width, height) * 0.012),
    12,
    18,
  );
  const leftPanelWidth = clamp(
    Math.round(width * 0.17),
    232,
    300,
  );
  const rightPanelWidth = clamp(
    Math.round(width * 0.19),
    250,
    330,
  );
  const centerStartX = outerPadding + leftPanelWidth + panelGap;
  const centerEndX = width - outerPadding - rightPanelWidth - panelGap;
  const centerWidth = centerEndX - centerStartX;
  const cellSize = clamp(
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
  const cardHeight = clamp(
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
  const statsPanelHeight = clamp(
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
      worldHeight: height,
      mobileLayout,
      scrollable: false,
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
      rightPanelY: panelTop + panelHeight / 2,
      rightPanelHeight: panelHeight,
      panelY: panelTop + panelHeight / 2,
      leftPanelY: panelTop + panelHeight / 2,
      leftPanelHeight: panelHeight,
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

function computeMobileBuildLayout({
  width,
  height,
  grid,
  gridZoom,
  theme,
  spacing,
  toolbar,
}) {
  const outerPadding = clamp(
    Math.round(Math.min(width, height) * 0.028),
    8,
    14,
  );
  const contentWidth = Math.max(260, width - outerPadding * 2);
  const titleX = outerPadding + 8;
  const panelGap = 12;
  const panelTop = 88;
  const gridCellByWidth = Math.floor((contentWidth - 72) / grid.columns);
  const gridCellByHeight = Math.floor((height * 0.33) / grid.rows);
  const cellSize = clamp(
    Math.floor(Math.min(gridCellByWidth, gridCellByHeight)),
    26,
    34,
  );
  const gridWidth = grid.columns * cellSize;
  const gridHeight = grid.rows * cellSize;
  const centerPanelWidth = Math.min(contentWidth, gridWidth + 64);
  const centerPanelHeight = gridHeight + 64;
  const centerPanelX = width / 2;
  const centerPanelTop = panelTop;
  const centerPanelY = centerPanelTop + centerPanelHeight / 2;
  const gridX = centerPanelX - gridWidth / 2;
  const gridY = centerPanelTop + 44;
  const rightPanelTop = centerPanelTop + centerPanelHeight + panelGap;
  const rightPanelWidth = contentWidth;
  const rightColumnX = outerPadding + 12;
  const rightColumnWidth = contentWidth - 24;
  const statsPanelY = rightPanelTop + 18;
  const statsPanelHeight = 230;
  const inspectorPanelY = statsPanelY + statsPanelHeight + spacing.sm;
  const inspectorPanelHeight = 204;
  const rightPanelHeight =
    inspectorPanelY + inspectorPanelHeight - rightPanelTop + spacing.md;
  const rightPanelY = rightPanelTop + rightPanelHeight / 2;
  const leftPanelTop = rightPanelTop + rightPanelHeight + panelGap;
  const cardWidth = contentWidth - 24;
  const cardHeight = 52;
  const paletteGap = 6;
  const cardGapY = cardHeight + paletteGap;
  const paletteTopY = leftPanelTop + 46;
  const cardStartY = paletteTopY + cardHeight / 2;
  const paletteBottomY =
    cardStartY +
    (SHIP_PARTS.length - 1) * cardGapY +
    cardHeight / 2;
  const controlsY = paletteBottomY + 24;
  const buttonHeight = toolbar.buttonHeight;
  const buttonGap = toolbar.buttonGap;
  const toolbarButtonStartOffset = 54;
  const toolbarHeight = Math.max(
    toolbar.toolbarHeight,
    toolbarButtonStartOffset + buttonHeight * 3 + buttonGap * 2 + spacing.md,
  );
  const toolbarY = controlsY + 62;
  const leftPanelBottom = toolbarY + toolbarHeight + spacing.md;
  const leftPanelHeight = leftPanelBottom - leftPanelTop;
  const leftPanelWidth = contentWidth;
  const leftPanelX = width / 2;
  const leftPanelY = leftPanelTop + leftPanelHeight / 2;
  const primaryButtonWidth = cardWidth;
  const secondaryButtonWidth = Math.floor((primaryButtonWidth - buttonGap) / 2);
  const tertiaryButtonWidth = primaryButtonWidth;
  const worldHeight = Math.max(height, leftPanelBottom + outerPadding);
  const toastWidth = Math.min(contentWidth - 24, theme.toast.maxWidth);

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
      worldHeight,
      mobileLayout: true,
      scrollable: worldHeight > height + 2,
      compactUi: true,
      outerPadding,
      panelGap,
      leftPanelWidth,
      rightPanelWidth,
      centerStartX: centerPanelX - centerPanelWidth / 2,
      centerEndX: centerPanelX + centerPanelWidth / 2,
      centerWidth: centerPanelWidth,
      gridWidth,
      gridHeight,
      gridX,
      gridY,
      leftPanelX,
      leftPanelY,
      leftPanelHeight,
      rightPanelX: width / 2,
      rightPanelY,
      rightPanelHeight,
      panelY: leftPanelY,
      panelHeight: leftPanelHeight,
      panelTop,
      centerPanelX,
      centerPanelY,
      centerPanelWidth,
      centerPanelHeight,
      titleX,
      cardWidth,
      cardHeight,
      cardX: width / 2,
      cardStartY,
      cardGapY,
      paletteTopY,
      paletteBottomY,
      paletteColumns: 1,
      paletteIconCellSize: 14,
      controlsX: outerPadding + 16,
      controlsY,
      toolbarX: outerPadding + 12,
      toolbarY,
      toolbarWidth: primaryButtonWidth,
      toolbarHeight,
      primaryButtonX: outerPadding + 12,
      primaryButtonY: toolbarY + toolbarButtonStartOffset,
      primaryButtonWidth,
      primaryButtonHeight: buttonHeight,
      secondaryButtonX: outerPadding + 12,
      secondaryButtonY:
        toolbarY + toolbarButtonStartOffset + buttonHeight + buttonGap,
      secondaryButtonWidth,
      secondaryButtonGap: buttonGap,
      tertiaryButtonX: outerPadding + 12,
      tertiaryButtonY:
        toolbarY + toolbarButtonStartOffset + (buttonHeight + buttonGap) * 2,
      tertiaryButtonWidth,
      rightColumnX,
      rightColumnY: rightPanelTop + 18,
      rightColumnWidth,
      rightColumnHeight: rightPanelHeight - 36,
      statsPanelX: rightColumnX,
      statsPanelY,
      statsPanelWidth: rightColumnWidth,
      statsPanelHeight,
      inspectorPanelX: rightColumnX,
      inspectorPanelY,
      inspectorPanelWidth: rightColumnWidth,
      inspectorPanelHeight,
      messageX: width / 2,
      messageY: gridY + gridHeight + spacing.lg,
      toastWidth,
    },
  };
}
