import { SHIP_PARTS } from "../../data/parts.js";
import { getBuildTheme } from "./BuildTheme.js";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function computeBuildLayout({ width, height, grid, gridZoom }) {
  const theme = getBuildTheme(true);
  const mobileLayout = width < 760 || (width < 920 && height > width * 1.15);
  const zoom = clamp(gridZoom ?? 1, 0.7, 2.15);
  const paletteWidth = mobileLayout ? 82 : 92;
  const topBarHeight = mobileLayout ? 60 : 64;
  const bottomBarHeight = mobileLayout ? 92 : 76;
  const gridAreaWidth = width - paletteWidth;
  const gridAreaHeight = height - topBarHeight - bottomBarHeight;
  const baseCellSize = clamp(
    Math.floor(Math.min(gridAreaWidth / grid.columns, gridAreaHeight / grid.rows)),
    mobileLayout ? 18 : 20,
    mobileLayout ? 34 : 44,
  );
  const cellSize = Math.round(baseCellSize * zoom);
  const gridWidth = grid.columns * cellSize;
  const gridHeight = grid.rows * cellSize;
  const gridX = paletteWidth + Math.floor((gridAreaWidth - gridWidth) / 2);
  const gridY = topBarHeight + Math.floor((gridAreaHeight - gridHeight) / 2);
  const cardHeight = mobileLayout ? 82 : 88;
  const cardGapY = 0;
  const paletteTopY = topBarHeight;
  const toolbarButtonSize = mobileLayout ? 44 : 48;
  const smallButtonSize = mobileLayout ? 52 : 54;

  return {
    grid: {
      ...grid,
      cellSize,
      x: gridX,
      y: gridY,
    },
    baseGridCellSize: baseCellSize,
    gridZoom: zoom,
    theme,
    layout: {
      width,
      height,
      worldHeight: height,
      mobileLayout,
      scrollable: false,
      compactUi: true,
      outerPadding: 8,
      panelGap: 0,
      topBarHeight,
      bottomBarHeight,
      paletteWidth,
      leftPanelWidth: paletteWidth,
      rightPanelWidth: 0,
      centerStartX: paletteWidth,
      centerEndX: width,
      centerWidth: gridAreaWidth,
      gridWidth,
      gridHeight,
      gridX,
      gridY,
      leftPanelX: paletteWidth / 2,
      leftPanelY: height / 2,
      leftPanelHeight: height,
      rightPanelX: width + 1,
      rightPanelY: height / 2,
      rightPanelHeight: height,
      panelY: height / 2,
      panelHeight: height,
      panelTop: topBarHeight,
      centerPanelX: paletteWidth + gridAreaWidth / 2,
      centerPanelY: topBarHeight + gridAreaHeight / 2,
      centerPanelWidth: gridAreaWidth,
      centerPanelHeight: gridAreaHeight,
      titleX: 8,
      cardWidth: paletteWidth - 10,
      cardHeight,
      cardX: paletteWidth / 2,
      cardStartY: paletteTopY + cardHeight / 2,
      cardGapY,
      paletteTopY,
      paletteBottomY: paletteTopY + SHIP_PARTS.length * cardHeight,
      paletteColumns: 1,
      paletteIconCellSize: mobileLayout ? 24 : 28,
      controlsX: 8,
      controlsY: height - bottomBarHeight + 8,
      toolbarX: 0,
      toolbarY: 0,
      toolbarWidth: width,
      toolbarHeight: height,
      primaryButtonX: width - 8 - 96,
      primaryButtonY: 9,
      primaryButtonWidth: 96,
      primaryButtonHeight: toolbarButtonSize,
      secondaryButtonX: 8,
      secondaryButtonY: height - bottomBarHeight + 10,
      secondaryButtonWidth: smallButtonSize,
      secondaryButtonGap: 10,
      tertiaryButtonX: width - 8 - 64,
      tertiaryButtonY: height - bottomBarHeight + 10,
      tertiaryButtonWidth: 64,
      rightColumnX: 0,
      rightColumnY: height - bottomBarHeight + 10,
      rightColumnWidth: width,
      rightColumnHeight: bottomBarHeight,
      statsPanelX: width / 2,
      statsPanelY: height - bottomBarHeight + 16,
      statsPanelWidth: Math.min(360, width - paletteWidth - 24),
      statsPanelHeight: bottomBarHeight - 18,
      inspectorPanelX: width + 100,
      inspectorPanelY: height + 100,
      inspectorPanelWidth: 1,
      inspectorPanelHeight: 1,
      messageX: width / 2,
      messageY: height - 18,
      toastWidth: Math.min(360, width - 24),
    },
  };
}
