import Phaser from "phaser";
import ShipPart from "../entities/ShipPart.js";
import { PARTS_BY_ID } from "../data/parts.js";
import BuildValidator from "../systems/BuildValidator.js";
import ShipStatsCalculator from "../systems/ShipStatsCalculator.js";
import BuildHud from "../ui/BuildHud.js";

const GRID_NEIGHBORS = [
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
];

function cellKey(cellX, cellY) {
  return `${cellX},${cellY}`;
}

export default class BuildScene extends Phaser.Scene {
  constructor() {
    super({ key: "BuildScene" });
    this.grid = {
      columns: 7,
      rows: 10,
      cellSize: 54,
      x: 0,
      y: 0,
    };
  }

  init(data) {
    this.initialBuild = data.build || this.registry.get("rocket-build") || [];
  }

  create() {
    this.placedParts = new Map();
    this.selectedPartId = "capsule";
    this.selectedPlacedKey = null;
    this.hoverCell = null;

    this.layoutGrid();
    this.createBackground();
    this.createGrid();
    this.createHud();
    this.restoreBuild(this.initialBuild);
    this.registerInput();
    this.renderBuild();
  }

  layoutGrid() {
    const availableWidth = this.scale.width - 660;
    const availableHeight = this.scale.height - 180;
    this.grid.cellSize = Math.max(
      40,
      Math.min(
        62,
        Math.floor(
          Math.min(
            availableWidth / this.grid.columns,
            availableHeight / this.grid.rows,
          ),
        ),
      ),
    );
    const gridWidth = this.grid.columns * this.grid.cellSize;
    const gridHeight = this.grid.rows * this.grid.cellSize;
    this.grid.x = Math.round((this.scale.width - gridWidth) / 2);
    this.grid.y = Math.round((this.scale.height - gridHeight) / 2 + 16);
  }

  createBackground() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#04111d");
    const backdrop = this.add.graphics();
    backdrop.fillGradientStyle(0x061522, 0x0a2132, 0x061522, 0x030812, 1);
    backdrop.fillRect(0, 0, width, height);
    backdrop.fillStyle(0x134269, 0.18);
    backdrop.fillCircle(width * 0.75, height * 0.18, 180);
    backdrop.fillStyle(0xff8457, 0.08);
    backdrop.fillCircle(width * 0.22, height * 0.78, 220);

    for (let index = 0; index < 60; index += 1) {
      this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.FloatBetween(1, 2.3),
        Phaser.Math.Between(0xb6dfff, 0xffffff),
        Phaser.Math.FloatBetween(0.18, 0.75),
      );
    }
  }

  createGrid() {
    const { x, y, columns, rows, cellSize } = this.grid;
    const gridWidth = columns * cellSize;
    const gridHeight = rows * cellSize;

    this.gridPanel = this.add
      .rectangle(
        x - 18,
        y - 18,
        gridWidth + 36,
        gridHeight + 36,
        0x071321,
        0.82,
      )
      .setOrigin(0)
      .setStrokeStyle(2, 0x68d9ff, 0.28);
    this.gridGraphics = this.add.graphics();
    this.placementHighlight = this.add
      .rectangle(0, 0, cellSize - 6, cellSize - 6, 0x73f7c0, 0.16)
      .setStrokeStyle(2, 0x73f7c0, 0.9)
      .setVisible(false);
    this.selectionHighlight = this.add
      .rectangle(0, 0, cellSize - 4, cellSize - 4, 0xffffff, 0)
      .setStrokeStyle(3, 0xffd773, 1)
      .setVisible(false);
    this.gridInput = this.add
      .zone(x, y, gridWidth, gridHeight)
      .setOrigin(0)
      .setInteractive();
    this.gridInput.on("pointermove", (pointer) => this.handleGridHover(pointer));
    this.gridInput.on("pointerout", () => {
      this.hoverCell = null;
      this.placementHighlight.setVisible(false);
    });
    this.gridInput.on("pointerdown", (pointer) => this.handleGridPointer(pointer));

    this.redrawGrid();
  }

  createHud() {
    this.hud = new BuildHud(this, {
      onSelectPart: (partId) => this.selectPalettePart(partId),
      onClear: () => this.clearBuild(),
      onRemove: () => this.removeSelectedPlacedPart(),
      onLaunch: () => this.launchRocket(),
    });
    this.hud.create();
    this.hud.setSelectedPart(this.selectedPartId);
  }

  registerInput() {
    this.input.keyboard.on("keydown-DELETE", () => this.removeSelectedPlacedPart());
    this.input.keyboard.on("keydown-BACKSPACE", () => this.removeSelectedPlacedPart());
    this.input.keyboard.on("keydown-R", () => this.clearBuild());
    this.input.keyboard.on("keydown-SPACE", () => {
      const validation = BuildValidator.validate(this.serializeBuild());
      if (validation.isValid) {
        this.launchRocket();
      }
    });
  }

  redrawGrid() {
    const { x, y, columns, rows, cellSize } = this.grid;
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, 0x68d9ff, 0.18);

    for (let column = 0; column <= columns; column += 1) {
      const lineX = x + column * cellSize;
      this.gridGraphics.lineBetween(lineX, y, lineX, y + rows * cellSize);
    }

    for (let row = 0; row <= rows; row += 1) {
      const lineY = y + row * cellSize;
      this.gridGraphics.lineBetween(x, lineY, x + columns * cellSize, lineY);
    }
  }

  handleGridHover(pointer) {
    const cell = this.getCellAtWorld(pointer.worldX, pointer.worldY);
    this.hoverCell = cell;

    if (!cell || !this.selectedPartId) {
      this.placementHighlight.setVisible(false);
      return;
    }

    const definition = PARTS_BY_ID[this.selectedPartId];
    const valid = this.canPlacePart(this.selectedPartId, cell.cellX, cell.cellY);
    const center = this.getPartCenterFromCell(
      this.selectedPartId,
      cell.cellX,
      cell.cellY,
    );

    this.placementHighlight
      .setVisible(true)
      .setPosition(center.worldX, center.worldY)
      .setDisplaySize(
        definition.gridWidth * this.grid.cellSize - 8,
        definition.gridHeight * this.grid.cellSize - 8,
      )
      .setFillStyle(valid ? 0x73f7c0 : 0xff7373, valid ? 0.18 : 0.16)
      .setStrokeStyle(2, valid ? 0x73f7c0 : 0xff7373, 0.92);
  }

  handleGridPointer(pointer) {
    const cell = this.getCellAtWorld(pointer.worldX, pointer.worldY);
    if (!cell) {
      this.clearPlacedSelection();
      return;
    }

    const existing = this.findPlacedPartAtCell(cell.cellX, cell.cellY);
    if (existing) {
      this.selectPlacedPart(existing);
      return;
    }

    if (!this.selectedPartId) {
      return;
    }

    if (!this.canPlacePart(this.selectedPartId, cell.cellX, cell.cellY)) {
      return;
    }

    this.addPlacedPart(this.selectedPartId, cell.cellX, cell.cellY);
  }

  selectPalettePart(partId) {
    this.selectedPartId = partId;
    this.hud.setSelectedPart(partId);
    if (this.hoverCell) {
      const fakePointer = {
        worldX: this.grid.x + this.hoverCell.cellX * this.grid.cellSize + 1,
        worldY: this.grid.y + this.hoverCell.cellY * this.grid.cellSize + 1,
      };
      this.handleGridHover(fakePointer);
    }
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

    return {
      cellX: Math.floor((worldX - x) / cellSize),
      cellY: Math.floor((worldY - y) / cellSize),
    };
  }

  getOccupiedCells(partId, cellX, cellY) {
    const definition = PARTS_BY_ID[partId];
    const cells = [];

    for (let offsetY = 0; offsetY < definition.gridHeight; offsetY += 1) {
      for (let offsetX = 0; offsetX < definition.gridWidth; offsetX += 1) {
        cells.push({ cellX: cellX + offsetX, cellY: cellY + offsetY });
      }
    }

    return cells;
  }

  isWithinBounds(partId, cellX, cellY) {
    return this.getOccupiedCells(partId, cellX, cellY).every(
      (cell) =>
        cell.cellX >= 0 &&
        cell.cellY >= 0 &&
        cell.cellX < this.grid.columns &&
        cell.cellY < this.grid.rows,
    );
  }

  findPlacedPartAtCell(cellX, cellY) {
    return Array.from(this.placedParts.values()).find((entry) =>
      this.getOccupiedCells(entry.partId, entry.cellX, entry.cellY).some(
        (cell) => cell.cellX === cellX && cell.cellY === cellY,
      ),
    );
  }

  canPlacePart(partId, cellX, cellY) {
    const definition = PARTS_BY_ID[partId];
    if (!definition || !this.isWithinBounds(partId, cellX, cellY)) {
      return false;
    }

    if (definition.type === "command") {
      const hasCommandModule = Array.from(this.placedParts.values()).some(
        (part) => PARTS_BY_ID[part.partId]?.type === "command",
      );
      if (hasCommandModule) {
        return false;
      }
    }

    const occupiedCells = this.getOccupiedCells(partId, cellX, cellY);
    if (
      occupiedCells.some((cell) =>
        Boolean(this.findPlacedPartAtCell(cell.cellX, cell.cellY)),
      )
    ) {
      return false;
    }

    if (this.placedParts.size === 0) {
      return true;
    }

    return occupiedCells.some((cell) =>
      GRID_NEIGHBORS.some((offset) =>
        Boolean(this.findPlacedPartAtCell(cell.cellX + offset.x, cell.cellY + offset.y)),
      ),
    );
  }

  addPlacedPart(partId, cellX, cellY) {
    const definition = PARTS_BY_ID[partId];
    const center = this.getPartCenterFromCell(partId, cellX, cellY);
    const view = new ShipPart(this, center.worldX, center.worldY, definition, {
      cellSize: this.grid.cellSize,
      padding: 6,
      showLabel: false,
      showPlate: false,
    });

    const entry = { partId, cellX, cellY, view };
    view.setDepth(10);
    view.setInteractive();
    view.on("pointerdown", () => this.selectPlacedPart(entry));
    this.placedParts.set(cellKey(cellX, cellY), entry);
    this.selectPlacedPart(entry);
    this.persistBuild();
    this.renderBuild();
  }

  removeSelectedPlacedPart() {
    if (!this.selectedPlacedKey) {
      return;
    }

    const entry = this.placedParts.get(this.selectedPlacedKey);
    if (!entry) {
      return;
    }

    entry.view.destroy();
    this.placedParts.delete(this.selectedPlacedKey);
    this.selectedPlacedKey = null;
    this.selectionHighlight.setVisible(false);
    this.persistBuild();
    this.renderBuild();
  }

  clearBuild() {
    this.placedParts.forEach((entry) => entry.view.destroy());
    this.placedParts.clear();
    this.selectedPlacedKey = null;
    this.selectionHighlight.setVisible(false);
    this.persistBuild();
    this.renderBuild();
  }

  selectPlacedPart(entry) {
    this.selectedPlacedKey = cellKey(entry.cellX, entry.cellY);
    const definition = PARTS_BY_ID[entry.partId];
    this.selectionHighlight
      .setVisible(true)
      .setPosition(entry.view.x, entry.view.y)
      .setDisplaySize(
        definition.gridWidth * this.grid.cellSize - 4,
        definition.gridHeight * this.grid.cellSize - 4,
      );
    this.renderBuild();
  }

  clearPlacedSelection() {
    this.selectedPlacedKey = null;
    this.selectionHighlight.setVisible(false);
    this.renderBuild();
  }

  restoreBuild(build) {
    build.forEach((part) => {
      if (PARTS_BY_ID[part.partId] && this.canPlacePart(part.partId, part.cellX, part.cellY)) {
        this.addPlacedPart(part.partId, part.cellX, part.cellY);
      }
    });

    this.selectedPlacedKey = null;
    this.selectionHighlight.setVisible(false);
    this.persistBuild();
    this.renderBuild();
  }

  serializeBuild() {
    return Array.from(this.placedParts.values()).map((entry) => ({
      partId: entry.partId,
      cellX: entry.cellX,
      cellY: entry.cellY,
    }));
  }

  persistBuild() {
    this.registry.set("rocket-build", this.serializeBuild());
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

  renderBuild() {
    const build = this.serializeBuild();
    const validation = BuildValidator.validate(build);
    const selectedEntry = this.selectedPlacedKey
      ? this.placedParts.get(this.selectedPlacedKey)
      : null;
    const selectedInfo = selectedEntry
      ? PARTS_BY_ID[selectedEntry.partId]
      : PARTS_BY_ID[this.selectedPartId] || null;

    this.hud.update(validation, selectedInfo, Boolean(selectedEntry));
  }

  launchRocket() {
    const build = this.serializeBuild();
    const validation = BuildValidator.validate(build);
    if (!validation.isValid) {
      return;
    }

    const stats = ShipStatsCalculator.calculate(build);
    this.registry.set("rocket-build", build);
    this.scene.start("FlightScene", { build, stats });
  }
}
