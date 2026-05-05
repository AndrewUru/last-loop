import ShipPart from "../../entities/ShipPart.js";
import { PARTS_BY_ID } from "../../data/parts.js";

function cellKey(cellX, cellY) {
  return `${cellX},${cellY}`;
}

function getOccupiedCells(partId, cellX, cellY) {
  const definition = PARTS_BY_ID[partId];
  if (!definition) {
    return [];
  }

  const cells = [];
  for (let offsetY = 0; offsetY < definition.gridHeight; offsetY += 1) {
    for (let offsetX = 0; offsetX < definition.gridWidth; offsetX += 1) {
      cells.push({
        cellX: cellX + offsetX,
        cellY: cellY + offsetY,
      });
    }
  }

  return cells;
}

export default class BuildGridView {
  constructor(scene, { grid, layout, theme }) {
    this.scene = scene;
    this.grid = grid;
    this.layout = layout;
    this.theme = theme;

    this.createObjects();
    this.updateLayout({ grid, layout });
  }

  createObjects() {
    const { colors, depth, grid, spacing } = this.theme;

    this.gridGraphics = this.scene.add.graphics();
    this.hullShadowGraphics = this.scene.add.graphics().setDepth(depth.hullShadow);
    this.hullGraphics = this.scene.add.graphics().setDepth(depth.hull);
    this.issueGraphics = this.scene.add.graphics().setDepth(depth.issues);
    this.placementGlow = this.scene.add
      .rectangle(0, 0, this.grid.cellSize, this.grid.cellSize, colors.highlight, 0.08)
      .setVisible(false)
      .setDepth(depth.placement);
    this.placementHighlight = this.scene.add
      .rectangle(
        0,
        0,
        this.grid.cellSize,
        this.grid.cellSize,
        colors.highlight,
        this.theme.alpha.previewFill,
      )
      .setStrokeStyle(3, colors.highlight, 0.96)
      .setVisible(false)
      .setDepth(depth.placement);
    this.selectionGlow = this.scene.add
      .rectangle(0, 0, this.grid.cellSize, this.grid.cellSize, colors.selectionGlow, 0.12)
      .setVisible(false)
      .setDepth(depth.selection);
    this.selectionHighlight = this.scene.add
      .rectangle(0, 0, this.grid.cellSize, this.grid.cellSize, colors.selection, 0.08)
      .setStrokeStyle(4, colors.selection, 0.98)
      .setVisible(false)
      .setDepth(depth.selection);

    this.centerOfMassMarker = this.scene.add.container(0, 0).setVisible(false).setDepth(depth.centerOfMass);
    const markerRing = this.scene.add
      .circle(0, 0, grid.centerOfMassRadius, colors.highlight, 0.14)
      .setStrokeStyle(2, colors.highlight, 1);
    const markerCrossH = this.scene.add.rectangle(0, 0, 22, 2, colors.highlight, 1);
    const markerCrossV = this.scene.add.rectangle(0, 0, 2, 22, colors.highlight, 1);
    const markerText = this.scene.add
      .text(0, -22, "COM", {
        fontSize: `${this.theme.fontSizes.caption}px`,
        color: this.theme.colors.textSuccess,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.centerOfMassMarker.add([markerRing, markerCrossH, markerCrossV, markerText]);
  }

  updateLayout({ grid, layout }) {
    this.grid = grid;
    this.layout = layout;
    this.placementGlow.setDisplaySize(
      grid.cellSize + this.theme.grid.previewGlowInset * 2,
      grid.cellSize + this.theme.grid.previewGlowInset * 2,
    );
    this.placementHighlight.setDisplaySize(
      grid.cellSize - this.theme.grid.previewInset,
      grid.cellSize - this.theme.grid.previewInset,
    );
    this.selectionGlow.setDisplaySize(
      grid.cellSize + this.theme.grid.selectionGlowInset,
      grid.cellSize + this.theme.grid.selectionGlowInset,
    );
    this.selectionHighlight.setDisplaySize(
      grid.cellSize - this.theme.grid.selectionInset,
      grid.cellSize - this.theme.grid.selectionInset,
    );
    this.redrawGrid();
  }

  redrawGrid() {
    const { columns, rows, cellSize, x, y } = this.grid;
    const { colors, grid: gridTheme } = this.theme;
    const width = columns * cellSize;
    const height = rows * cellSize;

    this.gridGraphics.clear();
    this.gridGraphics.fillStyle(0x41679b, 0.96);
    this.gridGraphics.fillRect(x, y, width, height);
    this.gridGraphics.lineStyle(2, 0x315784, 0.55);
    this.gridGraphics.strokeRect(x, y, width, height);
    this.gridGraphics.lineStyle(1, 0x315784, 0.34);

    for (let column = 0; column <= columns; column += 1) {
      const lineX = x + column * cellSize;
      if (column % gridTheme.majorEvery === 0) {
        continue;
      }
      this.gridGraphics.lineBetween(lineX, y, lineX, y + rows * cellSize);
    }

    for (let row = 0; row <= rows; row += 1) {
      const lineY = y + row * cellSize;
      if (row % gridTheme.majorEvery === 0) {
        continue;
      }
      this.gridGraphics.lineBetween(x, lineY, x + columns * cellSize, lineY);
    }

    this.gridGraphics.lineStyle(3, 0x315784, 0.48);
    for (let column = 0; column <= columns; column += 1) {
      if (column % gridTheme.majorEvery !== 0) {
        continue;
      }

      const lineX = x + column * cellSize;
      this.gridGraphics.lineBetween(lineX, y, lineX, y + height);
    }

    for (let row = 0; row <= rows; row += 1) {
      if (row % gridTheme.majorEvery !== 0) {
        continue;
      }

      const lineY = y + row * cellSize;
      this.gridGraphics.lineBetween(x, lineY, x + width, lineY);
    }

    this.gridGraphics.lineStyle(1, 0x2e527f, 0.28);
    for (let column = 0; column <= columns; column += gridTheme.majorEvery) {
      for (let row = 0; row <= rows; row += gridTheme.majorEvery) {
        const crossX = x + column * cellSize;
        const crossY = y + row * cellSize;

        this.gridGraphics.lineBetween(crossX - 4, crossY, crossX + 4, crossY);
        this.gridGraphics.lineBetween(crossX, crossY - 4, crossX, crossY + 4);
        this.gridGraphics.fillStyle(0x41679b, 1);
        this.gridGraphics.fillCircle(crossX, crossY, 1.25);
      }
    }
  }

  createPlacedPartView(partId, cellX, cellY) {
    const definition = PARTS_BY_ID[partId];
    const center = this.getPartCenterFromCell(partId, cellX, cellY);
    return new ShipPart(this.scene, center.worldX, center.worldY, definition, {
      cellSize: this.grid.cellSize,
      padding: this.theme.part.padding,
      showLabel: false,
      showPlate: false,
    }).setDepth(this.theme.depth.placedPart);
  }

  createDragPreview(definition, worldX, worldY) {
    return new ShipPart(this.scene, worldX, worldY, definition, {
      cellSize: this.grid.cellSize,
      padding: this.theme.part.padding,
      ghost: true,
      showLabel: false,
      showPlate: false,
    }).setDepth(this.theme.depth.draggingPart);
  }

  movePreview(preview, worldX, worldY) {
    preview.setPosition(worldX, worldY);
  }

  setPartDragging(entry) {
    entry.view.redraw({
      cellSize: this.grid.cellSize,
      padding: this.theme.part.padding,
      showLabel: false,
      showPlate: false,
      ghost: true,
      alpha: 0.95,
    });
    entry.view.setDepth(this.theme.depth.draggingPart);
  }

  restorePartView(entry) {
    this.positionPartView(entry, {
      ghost: false,
      alpha: 1,
    });
    entry.view.setDepth(this.theme.depth.placedPart);
  }

  positionPartView(entry, options = {}) {
    const center = this.getPartCenterFromCell(entry.partId, entry.cellX, entry.cellY);
    entry.view.setPosition(center.worldX, center.worldY);
    entry.view.redraw({
      cellSize: this.grid.cellSize,
      padding: this.theme.part.padding,
      showLabel: false,
      showPlate: false,
      ...options,
    });
  }

  showPlacementCandidate(partId, candidate) {
    this.placementHighlight.setVisible(Boolean(candidate.cell));
    this.placementGlow.setVisible(Boolean(candidate.cell));
    if (!candidate.cell) {
      return;
    }

    const size = this.getPartSizePx(partId);
    const center = this.getPartCenterFromCell(partId, candidate.cell.cellX, candidate.cell.cellY);
    const color = candidate.valid ? this.theme.colors.highlight : this.theme.colors.error;

    this.placementGlow
      .setPosition(center.worldX, center.worldY)
      .setDisplaySize(
        size.width + this.theme.grid.previewGlowInset * 2,
        size.height + this.theme.grid.previewGlowInset * 2,
      )
      .setFillStyle(color, this.theme.alpha.previewGlow);
    this.placementHighlight
      .setPosition(center.worldX, center.worldY)
      .setDisplaySize(
        size.width - this.theme.grid.previewInset,
        size.height - this.theme.grid.previewInset,
      )
      .setFillStyle(color, this.theme.alpha.previewFill)
      .setStrokeStyle(3, color, 0.98);
  }

  clearPlacementCandidate() {
    this.placementHighlight.setVisible(false);
    this.placementGlow.setVisible(false);
  }

  showSelection(entry) {
    const size = this.getPartSizePx(entry.partId);
    this.selectionGlow
      .setVisible(true)
      .setDisplaySize(
        size.width + this.theme.grid.selectionGlowInset,
        size.height + this.theme.grid.selectionGlowInset,
      )
      .setPosition(entry.view.x, entry.view.y)
      .setFillStyle(this.theme.colors.selectionGlow, 0.16);
    this.selectionHighlight
      .setVisible(true)
      .setDisplaySize(
        size.width - this.theme.grid.selectionInset,
        size.height - this.theme.grid.selectionInset,
      )
      .setPosition(entry.view.x, entry.view.y)
      .setFillStyle(this.theme.colors.selection, 0.08)
      .setStrokeStyle(4, this.theme.colors.selection, 0.98);
  }

  clearSelection() {
    this.selectionGlow.setVisible(false);
    this.selectionHighlight.setVisible(false);
  }

  getPartSizePx(partId) {
    const definition = PARTS_BY_ID[partId];
    return {
      width: definition.gridWidth * this.grid.cellSize,
      height: definition.gridHeight * this.grid.cellSize,
    };
  }

  getPartCenterFromCell(partId, cellX, cellY) {
    const definition = PARTS_BY_ID[partId];
    return {
      worldX:
        this.grid.x +
        cellX * this.grid.cellSize +
        (definition.gridWidth * this.grid.cellSize) / 2,
      worldY:
        this.grid.y +
        cellY * this.grid.cellSize +
        (definition.gridHeight * this.grid.cellSize) / 2,
    };
  }

  getCellAtWorld(worldX, worldY) {
    const { x, y, columns, rows, cellSize } = this.grid;

    if (
      worldX < x ||
      worldY < y ||
      worldX >= x + columns * cellSize ||
      worldY >= y + rows * cellSize
    ) {
      return null;
    }

    const cellX = Math.floor((worldX - x) / cellSize);
    const cellY = Math.floor((worldY - y) / cellSize);

    return {
      cellX,
      cellY,
      worldX: x + cellX * cellSize + cellSize / 2,
      worldY: y + cellY * cellSize + cellSize / 2,
    };
  }

  getWorldFromCell(cellX, cellY) {
    return {
      worldX: this.grid.x + cellX * this.grid.cellSize + this.grid.cellSize / 2,
      worldY: this.grid.y + cellY * this.grid.cellSize + this.grid.cellSize / 2,
    };
  }

  renderBuild(build, validation) {
    this.renderRocketHull(build);
    this.renderIssueHighlights(validation.issues);
    this.renderCenterOfMass(validation.stats);
  }

  renderIssueHighlights(issues) {
    const cellSize = this.grid.cellSize - this.theme.grid.issueInset;
    const severityByCell = new Map();

    issues.forEach((issue) => {
      issue.affectedCells.forEach((cell) => {
        const key = cellKey(cell.cellX, cell.cellY);
        const current = severityByCell.get(key);
        if (!current || (current !== "error" && issue.severity === "error")) {
          severityByCell.set(key, issue.severity);
        }
      });
    });

    this.issueGraphics.clear();

    severityByCell.forEach((severity, key) => {
      const [cellX, cellY] = key.split(",").map(Number);
      const cell = this.getWorldFromCell(cellX, cellY);
      const color =
        severity === "error" ? this.theme.colors.error : this.theme.colors.warning;
      const fillAlpha =
        severity === "error"
          ? this.theme.alpha.issueErrorFill
          : this.theme.alpha.issueWarningFill;
      const inset = cellSize / 2;
      const corner = this.theme.grid.issueCornerSize;

      this.issueGraphics.fillStyle(color, fillAlpha);
      this.issueGraphics.fillRoundedRect(
        cell.worldX - inset,
        cell.worldY - inset,
        cellSize,
        cellSize,
        8,
      );
      this.issueGraphics.lineStyle(3, color, 0.96);
      this.issueGraphics.strokeRoundedRect(
        cell.worldX - inset,
        cell.worldY - inset,
        cellSize,
        cellSize,
        8,
      );

      this.issueGraphics.lineBetween(
        cell.worldX - inset,
        cell.worldY - inset + corner,
        cell.worldX - inset,
        cell.worldY - inset,
      );
      this.issueGraphics.lineBetween(
        cell.worldX - inset,
        cell.worldY - inset,
        cell.worldX - inset + corner,
        cell.worldY - inset,
      );
      this.issueGraphics.lineBetween(
        cell.worldX + inset - corner,
        cell.worldY - inset,
        cell.worldX + inset,
        cell.worldY - inset,
      );
      this.issueGraphics.lineBetween(
        cell.worldX + inset,
        cell.worldY - inset,
        cell.worldX + inset,
        cell.worldY - inset + corner,
      );
      this.issueGraphics.lineBetween(
        cell.worldX - inset,
        cell.worldY + inset - corner,
        cell.worldX - inset,
        cell.worldY + inset,
      );
      this.issueGraphics.lineBetween(
        cell.worldX - inset,
        cell.worldY + inset,
        cell.worldX - inset + corner,
        cell.worldY + inset,
      );
      this.issueGraphics.lineBetween(
        cell.worldX + inset - corner,
        cell.worldY + inset,
        cell.worldX + inset,
        cell.worldY + inset,
      );
      this.issueGraphics.lineBetween(
        cell.worldX + inset,
        cell.worldY + inset - corner,
        cell.worldX + inset,
        cell.worldY + inset,
      );
    });
  }

  renderCenterOfMass(stats) {
    if (!stats.partCount) {
      this.centerOfMassMarker.setVisible(false);
      return;
    }

    const worldX = this.grid.x + stats.centerOfMassX * this.grid.cellSize;
    const worldY = this.grid.y + stats.centerOfMassY * this.grid.cellSize;

    this.centerOfMassMarker.setVisible(true);
    this.centerOfMassMarker.setPosition(worldX, worldY);
  }

  renderRocketHull(build) {
    this.hullShadowGraphics.clear();
    this.hullGraphics.clear();

    if (build.length === 0) {
      return;
    }

    const occupied = this.getBuildOccupancy(build);
    if (occupied.size === 0) {
      return;
    }

    const columns = new Map();
    occupied.forEach((cell) => {
      const list = columns.get(cell.cellX) || [];
      list.push(cell);
      columns.set(cell.cellX, list);
    });

    const shellWidth = this.grid.cellSize * 0.68;
    const shellInsetX = (this.grid.cellSize - shellWidth) / 2;
    const shellInsetY = this.grid.cellSize * 0.06;
    const shellRadius = Math.max(12, Math.round(this.grid.cellSize * 0.26));
    const coneHeight = this.grid.cellSize * 0.42;

    columns.forEach((cells, cellX) => {
      const sorted = cells.sort((a, b) => a.cellY - b.cellY);
      const segments = [];
      let segmentStart = sorted[0].cellY;
      let previousY = sorted[0].cellY;

      for (let index = 1; index < sorted.length; index += 1) {
        const currentY = sorted[index].cellY;
        if (currentY !== previousY + 1) {
          segments.push({ topY: segmentStart, bottomY: previousY });
          segmentStart = currentY;
        }
        previousY = currentY;
      }

      segments.push({ topY: segmentStart, bottomY: previousY });

      segments.forEach((segment) => {
        const segmentHeight =
          (segment.bottomY - segment.topY + 1) * this.grid.cellSize;
        const bodyX = this.grid.x + cellX * this.grid.cellSize + shellInsetX;
        const bodyY = this.grid.y + segment.topY * this.grid.cellSize + shellInsetY;
        const bodyHeight = Math.max(18, segmentHeight - shellInsetY * 2);
        const centerX = bodyX + shellWidth / 2;
        const topCell = occupied.get(cellKey(cellX, segment.topY));
        const bottomCell = occupied.get(cellKey(cellX, segment.bottomY));
        const shouldDrawCone = topCell?.type === "command";
        const bodyTop = shouldDrawCone ? bodyY + coneHeight * 0.58 : bodyY;
        const noseBaseY = bodyTop;

        this.hullShadowGraphics.fillStyle(this.theme.colors.shadow, 0.18);
        this.hullShadowGraphics.fillRoundedRect(
          bodyX + 4,
          bodyTop + 8,
          shellWidth,
          Math.max(12, bodyHeight - (bodyTop - bodyY)),
          shellRadius,
        );

        this.hullGraphics.fillStyle(0xd5e4f0, this.theme.alpha.hullFill);
        this.hullGraphics.fillRoundedRect(
          bodyX,
          bodyTop,
          shellWidth,
          Math.max(12, bodyHeight - (bodyTop - bodyY)),
          shellRadius,
        );

        this.hullGraphics.fillStyle(0xffffff, 0.18);
        this.hullGraphics.fillRoundedRect(
          bodyX + shellWidth * 0.14,
          bodyTop + 6,
          shellWidth * 0.18,
          Math.max(10, bodyHeight - (bodyTop - bodyY) - 12),
          shellRadius * 0.5,
        );

        this.hullGraphics.lineStyle(2, 0xffffff, 0.2);
        this.hullGraphics.strokeRoundedRect(
          bodyX,
          bodyTop,
          shellWidth,
          Math.max(12, bodyHeight - (bodyTop - bodyY)),
          shellRadius,
        );

        if (shouldDrawCone) {
          const coneTopY = bodyY - coneHeight * 0.3;
          this.hullGraphics.fillStyle(0xe9f2f8, 0.26);
          this.hullGraphics.fillTriangle(
            bodyX + shellWidth * 0.12,
            noseBaseY,
            bodyX + shellWidth * 0.88,
            noseBaseY,
            centerX,
            coneTopY,
          );
          this.hullGraphics.lineStyle(2, 0xffffff, 0.22);
          this.hullGraphics.strokeTriangle(
            bodyX + shellWidth * 0.12,
            noseBaseY,
            bodyX + shellWidth * 0.88,
            noseBaseY,
            centerX,
            coneTopY,
          );
        } else {
          this.hullGraphics.fillStyle(0xdce8f3, 0.18);
          this.hullGraphics.fillRoundedRect(
            bodyX,
            bodyY,
            shellWidth,
            Math.max(12, this.grid.cellSize * 0.34),
            shellRadius,
          );
        }

        if (bottomCell?.type === "engine") {
          const skirtY = bodyY + bodyHeight - this.grid.cellSize * 0.2;
          this.hullGraphics.fillStyle(0x9caaba, 0.2);
          this.hullGraphics.fillTriangle(
            bodyX,
            skirtY,
            bodyX + shellWidth,
            skirtY,
            centerX,
            skirtY + this.grid.cellSize * 0.24,
          );
          this.hullGraphics.lineStyle(2, 0xffffff, 0.18);
          this.hullGraphics.strokeTriangle(
            bodyX,
            skirtY,
            bodyX + shellWidth,
            skirtY,
            centerX,
            skirtY + this.grid.cellSize * 0.24,
          );
        }
      });
    });
  }

  getBuildOccupancy(build) {
    const occupied = new Map();

    build.forEach((part) => {
      const definition = PARTS_BY_ID[part.partId];
      if (!definition) {
        return;
      }

      getOccupiedCells(part.partId, part.cellX, part.cellY).forEach((cell) => {
        occupied.set(cellKey(cell.cellX, cell.cellY), {
          ...cell,
          partId: part.partId,
          type: definition.type,
        });
      });
    });

    return occupied;
  }
}
