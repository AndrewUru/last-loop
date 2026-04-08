import Phaser from "phaser";
import ShipPart from "../entities/ShipPart.js";
import { PARTS_BY_ID } from "../data/parts.js";
import BuildValidator from "../systems/BuildValidator.js";
import { computeBuildLayout } from "../ui/build/BuildLayout.js";
import { createBuildPalette } from "../ui/build/BuildPalette.js";
import {
  createBuildControls,
  createBuildStatsPanel,
} from "../ui/build/BuildSidebar.js";

function cellKey(cellX, cellY) {
  return `${cellX},${cellY}`;
}

export default class BuildScene extends Phaser.Scene {
  constructor() {
    super({ key: "BuildScene" });
    this.grid = {
      columns: 9,
      rows: 12,
      cellSize: 56,
      x: 368,
      y: 112,
    };
  }

  init(data) {
    this.initialBuild = data.build || this.registry.get("rocket-build") || [];
  }

  setupLayout() {
    const { grid, baseGridCellSize, gridZoom, layout } = computeBuildLayout({
      width: this.scale.width,
      height: this.scale.height,
      grid: this.grid,
      gridZoom: this.gridZoom,
    });

    this.grid = grid;
    this.baseGridCellSize = baseGridCellSize;
    this.gridZoom = gridZoom;
    this.layout = layout;
  }

  create() {
    this.placedParts = new Map();
    this.selectedPartId = null;
    this.hoveredInfo = null;
    this.draggingPart = null;
    this.dragPreviewCell = null;
    this.pendingMove = null;
    this.currentValidation = null;

    this.input.mouse?.disableContextMenu();
    this.cameras.main.setBackgroundColor("#04111d");
    this.setupLayout();

    this.createBackground();
    this.createPanels();
    this.createPartPalette();
    this.createGrid();
    this.createControls();
    this.createContextMenu();
    this.createStatsPanel();
    this.registerInput();
    this.restoreBuild(this.initialBuild);
    this.renderCurrentBuild();
  }

  createBackground() {
    const { width, height, titleX, compactUi } = this.layout;
    const nebula = this.add.graphics().setDepth(-20);

    nebula.fillGradientStyle(0x061522, 0x0a2132, 0x0f2740, 0x030812, 1);
    nebula.fillRect(0, 0, width, height);
    nebula.fillStyle(0x154a75, 0.18);
    nebula.fillCircle(width * 0.78, height * 0.18, 160);
    nebula.fillStyle(0xff8457, 0.08);
    nebula.fillCircle(width * 0.22, height * 0.82, 220);

    for (let index = 0; index < 75; index += 1) {
      this.add
        .circle(
          Phaser.Math.Between(0, width),
          Phaser.Math.Between(0, height),
          Phaser.Math.FloatBetween(1, 2.5),
          Phaser.Math.Between(0xb6dfff, 0xffffff),
          Phaser.Math.FloatBetween(0.18, 0.75),
        )
        .setDepth(-19);
    }

    this.add.text(titleX, 26, "Assembly & Validation Deck", {
      fontSize: compactUi ? "15px" : "16px",
      color: "#73f7c0",
      fontStyle: "bold",
      letterSpacing: 1.2,
    });
    this.add.text(titleX, 42, "Orbital Yard", {
      fontSize: compactUi ? "40px" : "44px",
      color: "#effcff",
      fontStyle: "bold",
    });
    this.add.text(
      titleX,
      88,
      "Drag modules onto the grid, rebalance the stack, then send it to orbit.",
      {
        fontSize: "20px",
        color: "#8fd7ff",
      },
    );
  }

  createPanels() {
    const {
      width,
      leftPanelX,
      rightPanelX,
      panelY,
      panelHeight,
      leftPanelWidth,
      rightPanelWidth,
      centerPanelX,
      centerPanelWidth,
      centerPanelHeight,
      centerStartX,
      outerPadding,
      panelTop,
    } = this.layout;

    // Left panel with shadow
    this.add
      .rectangle(
        leftPanelX,
        panelY + 2,
        leftPanelWidth,
        panelHeight,
        0x000000,
        0.2,
      )
      .setStrokeStyle(2, 0x68d9ff, 0.08);
    this.add
      .rectangle(
        leftPanelX,
        panelY,
        leftPanelWidth,
        panelHeight,
        0x081624,
        0.95,
      )
      .setStrokeStyle(2, 0x68d9ff, 0.25);

    // Center panel with shadow
    this.add
      .rectangle(
        centerPanelX,
        this.grid.y + this.layout.gridHeight / 2 + 12,
        centerPanelWidth,
        centerPanelHeight,
        0x000000,
        0.25,
      )
      .setStrokeStyle(2, 0x68d9ff, 0.1);
    this.add
      .rectangle(
        centerPanelX,
        this.grid.y + this.layout.gridHeight / 2 + 10,
        centerPanelWidth,
        centerPanelHeight,
        0x071321,
        0.78,
      )
      .setStrokeStyle(2, 0x68d9ff, 0.28);

    // Right panel with shadow
    this.add
      .rectangle(
        rightPanelX,
        panelY + 2,
        rightPanelWidth,
        panelHeight,
        0x000000,
        0.2,
      )
      .setStrokeStyle(2, 0x68d9ff, 0.08);
    this.add
      .rectangle(
        rightPanelX,
        panelY,
        rightPanelWidth,
        panelHeight,
        0x081624,
        0.95,
      )
      .setStrokeStyle(2, 0x68d9ff, 0.25);

    this.add.text(outerPadding + 18, 142, "Parts", {
      fontSize: "23px",
      color: "#effcff",
      fontStyle: "bold",
    });
    this.add.text(centerStartX + 18, 142, "Assembly Grid", {
      fontSize: "23px",
      color: "#effcff",
      fontStyle: "bold",
    });
    this.add.text(
      width - outerPadding - rightPanelWidth + 18,
      142,
      "Flight Readiness",
      {
        fontSize: "24px",
        color: "#effcff",
        fontStyle: "bold",
      },
    );

    this.add
      .line(leftPanelX, panelTop - 10, -leftPanelWidth / 2 + 18, 0, leftPanelWidth / 2 - 18, 0, 0x68d9ff, 0.18)
      .setLineWidth(2)
      .setDepth(2);
    this.add
      .line(rightPanelX, panelTop - 10, -rightPanelWidth / 2 + 18, 0, rightPanelWidth / 2 - 18, 0, 0x68d9ff, 0.18)
      .setLineWidth(2)
      .setDepth(2);
  }

  createPartPalette() {
    createBuildPalette(this);
  }

  createGrid() {
    this.gridGraphics = this.add.graphics();
    this.hullShadowGraphics = this.add.graphics().setDepth(8);
    this.hullGraphics = this.add.graphics().setDepth(9);
    this.issueGraphics = this.add.graphics().setDepth(11);
    this.gridHighlight = this.add
      .rectangle(
        0,
        0,
        this.grid.cellSize - 8,
        this.grid.cellSize - 8,
        0x68d9ff,
        0.16,
      )
      .setStrokeStyle(2, 0x68d9ff, 0.78)
      .setVisible(false)
      .setDepth(12);
    this.selectionHighlight = this.add
      .rectangle(
        0,
        0,
        this.grid.cellSize - 4,
        this.grid.cellSize - 4,
        0xffffff,
        0,
      )
      .setStrokeStyle(3, 0xffd773, 0.95)
      .setVisible(false)
      .setDepth(13);

    this.centerOfMassMarker = this.add
      .container(0, 0)
      .setVisible(false)
      .setDepth(14);
    const markerRing = this.add
      .circle(0, 0, 12, 0x73f7c0, 0.14)
      .setStrokeStyle(2, 0x73f7c0, 1);
    const markerCrossH = this.add.rectangle(0, 0, 22, 2, 0x73f7c0, 1);
    const markerCrossV = this.add.rectangle(0, 0, 2, 22, 0x73f7c0, 1);
    const markerText = this.add
      .text(0, -22, "COM", {
        fontSize: "12px",
        color: "#9ef6ca",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.centerOfMassMarker.add([
      markerRing,
      markerCrossH,
      markerCrossV,
      markerText,
    ]);

    this.messageText = this.add.text(
      this.layout.messageX,
      this.layout.messageY,
      "",
      {
        fontSize: "18px",
        color: "#ffd8ad",
        wordWrap: { width: this.layout.gridWidth },
      },
    );

    this.redrawGrid();
  }

  createControls() {
    createBuildControls(this);
  }

  createContextMenu() {
    this.contextMenu = this.add.container(0, 0).setDepth(80).setVisible(false);
    this.contextMenuBackground = this.add
      .rectangle(0, 0, 192, 132, 0x091723, 0.98)
      .setOrigin(0)
      .setStrokeStyle(2, 0x68d9ff, 0.35);
    this.contextMenu.add(this.contextMenuBackground);

    this.contextMenuButtons = [
      this.createContextMenuItem(12, 12, "Select", () => {
        if (!this.contextMenuEntry) {
          return;
        }
        this.selectPlacedPart(
          this.contextMenuEntry.cellX,
          this.contextMenuEntry.cellY,
        );
        this.hideContextMenu();
      }),
      this.createContextMenuItem(12, 52, "Delete", () => {
        if (!this.contextMenuEntry) {
          return;
        }
        this.removePlacedPart(
          this.contextMenuEntry.cellX,
          this.contextMenuEntry.cellY,
        );
        this.hideContextMenu();
      }),
      this.createContextMenuItem(12, 92, "Cancel", () => {
        this.hideContextMenu();
      }),
    ];

    this.contextMenuButtons.forEach((item) => this.contextMenu.add(item));
  }

  createContextMenuItem(x, y, label, callback) {
    const item = this.add.container(x, y);
    const background = this.add
      .rectangle(0, 0, 168, 28, 0x102233, 0.96)
      .setOrigin(0)
      .setStrokeStyle(1, 0x68d9ff, 0.24)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(84, 14, label, {
        fontSize: "15px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    background.on("pointerover", () =>
      background.setStrokeStyle(1, 0x68d9ff, 0.8),
    );
    background.on("pointerout", () =>
      background.setStrokeStyle(1, 0x68d9ff, 0.24),
    );
    background.on("pointerdown", callback);
    item.add([background, text]);
    return item;
  }

  showContextMenu(worldX, worldY, entry) {
    this.contextMenuEntry = entry;
    const menuWidth = 192;
    const menuHeight = 132;
    this.contextMenu.setPosition(
      Phaser.Math.Clamp(worldX, 12, this.scale.width - menuWidth - 12),
      Phaser.Math.Clamp(worldY, 12, this.scale.height - menuHeight - 12),
    );
    this.contextMenu.setVisible(true);
  }

  hideContextMenu() {
    this.contextMenuEntry = null;
    this.contextMenu?.setVisible(false);
  }

  isPointerOverContextMenu(pointer) {
    if (!this.contextMenu?.visible) {
      return false;
    }

    const bounds = new Phaser.Geom.Rectangle(
      this.contextMenu.x,
      this.contextMenu.y,
      192,
      132,
    );
    return bounds.contains(pointer.worldX, pointer.worldY);
  }

  createStatsPanel() {
    createBuildStatsPanel(this);
  }

  registerInput() {
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("wheel", this.handleMouseWheel, this);

    this.input.keyboard.on("keydown-DELETE", () => this.removeSelectedPart());
    this.input.keyboard.on("keydown-BACKSPACE", () =>
      this.removeSelectedPart(),
    );
    this.input.keyboard.on("keydown-ESC", () =>
      this.cancelActiveDrag("Drag canceled."),
    );
  }

  handleMouseWheel(pointer, over, deltaX, deltaY) {
    if (this.draggingPart || this.isPointerOverContextMenu(pointer)) {
      return;
    }

    const nextZoom = Phaser.Math.Clamp(
      this.gridZoom + (deltaY > 0 ? -0.08 : 0.08),
      0.72,
      1.65,
    );

    if (Math.abs(nextZoom - this.gridZoom) < 0.001) {
      return;
    }

    this.gridZoom = nextZoom;
    this.refreshGridZoom();
  }

  handlePointerDown(pointer) {
    if (pointer.rightButtonDown() && this.draggingPart) {
      this.cancelActiveDrag("Drag canceled.");
      return;
    }

    if (this.contextMenu?.visible && !this.isPointerOverContextMenu(pointer)) {
      this.hideContextMenu();
    }
  }

  cancelActiveDrag(message = "") {
    if (!this.draggingPart) {
      return;
    }

    if (this.draggingPart.type === "palette") {
      this.draggingPart.preview.destroy();
      this.draggingPart = null;
      this.dragPreviewCell = null;
      this.gridHighlight.setVisible(false);
      this.renderCurrentBuild();
    } else {
      this.cancelPlacedPartDrag();
    }

    if (message) {
      this.showMessage(message);
    }
  }

  beginPaletteDrag(part, pointer) {
    this.hideContextMenu();
    this.pendingMove = null;
    this.draggingPart = {
      type: "palette",
      definition: part,
      dragOffsetX: 0,
      dragOffsetY: 0,
      preview: new ShipPart(this, pointer.worldX, pointer.worldY, part, {
        cellSize: this.grid.cellSize,
        padding: 8,
        ghost: true,
        showLabel: false,
        showPlate: false,
      }).setDepth(30),
    };
    this.draggingPart.preview.redraw({ ghost: true, alpha: 0.95 });
    this.clearSelection();
    this.handlePointerMove(pointer);
  }

  queuePlacedPartDrag(entry, pointer) {
    if (pointer.rightButtonDown()) {
      this.showContextMenu(pointer.worldX, pointer.worldY, entry);
      return;
    }

    this.hideContextMenu();
    this.selectPlacedPart(entry.cellX, entry.cellY);
    this.pendingMove = {
      entry,
      pointerId: pointer.id,
      startX: pointer.worldX,
      startY: pointer.worldY,
    };
  }

  beginPlacedPartDrag(entry, pointer) {
    this.hideContextMenu();
    const originalCell = { cellX: entry.cellX, cellY: entry.cellY };
    this.pendingMove = null;
    this.placedParts.delete(cellKey(entry.cellX, entry.cellY));
    this.draggingPart = {
      type: "move",
      definition: PARTS_BY_ID[entry.partId],
      entry,
      originalCell,
      dragOffsetX: pointer.worldX - entry.view.x,
      dragOffsetY: pointer.worldY - entry.view.y,
      preview: entry.view,
    };

    entry.view.disableInteractive();
    entry.view.redraw({ ghost: true, alpha: 0.95 });
    entry.view.setDepth(30);
    this.selectionHighlight.setVisible(false);
    this.handlePointerMove(pointer);
  }

  handlePointerMove(pointer) {
    if (
      this.pendingMove &&
      !this.draggingPart &&
      pointer.isDown &&
      pointer.id === this.pendingMove.pointerId
    ) {
      const dragDistance = Phaser.Math.Distance.Between(
        this.pendingMove.startX,
        this.pendingMove.startY,
        pointer.worldX,
        pointer.worldY,
      );

      if (dragDistance > 8) {
        this.beginPlacedPartDrag(this.pendingMove.entry, pointer);
      }
    }

    if (!this.draggingPart) {
      return;
    }

    this.draggingPart.preview.setPosition(
      pointer.worldX - this.draggingPart.dragOffsetX,
      pointer.worldY - this.draggingPart.dragOffsetY,
    );

    const candidate = this.getCandidatePlacement(pointer);
    this.updateDragPreview(candidate);
  }

  handlePointerUp(pointer) {
    if (
      this.pendingMove &&
      !this.draggingPart &&
      pointer.id === this.pendingMove.pointerId
    ) {
      this.pendingMove = null;
      return;
    }

    if (!this.draggingPart) {
      return;
    }

    const candidate = this.getCandidatePlacement(pointer);

    if (this.draggingPart.type === "palette") {
      this.draggingPart.preview.destroy();
      const definition = this.draggingPart.definition;
      this.draggingPart = null;
      this.dragPreviewCell = null;
      this.gridHighlight.setVisible(false);

      if (candidate.valid) {
        this.addPlacedPart(
          definition.id,
          candidate.cell.cellX,
          candidate.cell.cellY,
        );
        this.showMessage(`${definition.name} installed.`);
      } else {
        this.renderCurrentBuild();
        if (candidate.cell) {
          this.showMessage("Drop on a free connected cell.");
        }
      }
      return;
    }

    if (candidate.valid) {
      this.finishPlacedPartDrag(candidate.cell.cellX, candidate.cell.cellY);
    } else {
      this.cancelPlacedPartDrag();
      if (candidate.cell) {
        this.showMessage(
          "That slot is blocked. Drop on a free connected cell.",
        );
      }
    }
  }

  updateDragPreview(candidate) {
    const definition = this.draggingPart.definition;
    const size = this.getPartSizePx(definition.id);
    this.dragPreviewCell = candidate.valid ? candidate.cell : null;
    this.gridHighlight.setVisible(Boolean(candidate.cell));

    if (candidate.cell) {
      const center = this.getPartCenterFromCell(
        definition.id,
        candidate.cell.cellX,
        candidate.cell.cellY,
      );
      this.gridHighlight
        .setPosition(center.worldX, center.worldY)
        .setDisplaySize(size.width - 8, size.height - 8)
        .setFillStyle(candidate.valid ? 0x73f7c0 : 0xff7373, 0.16)
        .setStrokeStyle(2, candidate.valid ? 0x73f7c0 : 0xff7373, 0.92);
    }

    this.renderBuildState(this.getBuildPreview(candidate));
  }

  finishPlacedPartDrag(cellX, cellY) {
    const { entry, preview } = this.draggingPart;

    entry.cellX = cellX;
    entry.cellY = cellY;
    this.placedParts.set(cellKey(cellX, cellY), entry);
    this.makePlacedPartInteractive(entry);

    const snapped = this.getPartCenterFromCell(entry.partId, cellX, cellY);
    preview.setPosition(snapped.worldX, snapped.worldY);
    preview.setDepth(10);
    preview.redraw({ ghost: false, alpha: 1 });

    this.draggingPart = null;
    this.dragPreviewCell = null;
    this.gridHighlight.setVisible(false);
    this.selectPlacedPart(cellX, cellY);
    this.persistBuild();
    this.renderCurrentBuild();
    this.showMessage(`${PARTS_BY_ID[entry.partId].name} moved.`);
  }

  cancelPlacedPartDrag() {
    const { entry, originalCell, preview } = this.draggingPart;
    const snapped = this.getPartCenterFromCell(
      entry.partId,
      originalCell.cellX,
      originalCell.cellY,
    );

    entry.cellX = originalCell.cellX;
    entry.cellY = originalCell.cellY;
    this.placedParts.set(cellKey(entry.cellX, entry.cellY), entry);
    this.makePlacedPartInteractive(entry);

    preview.setPosition(snapped.worldX, snapped.worldY);
    preview.setDepth(10);
    preview.redraw({ ghost: false, alpha: 1 });

    this.draggingPart = null;
    this.dragPreviewCell = null;
    this.gridHighlight.setVisible(false);
    this.selectPlacedPart(entry.cellX, entry.cellY);
    this.persistBuild();
    this.renderCurrentBuild();
  }

  createButton(x, y, width, height, label, fillColor, strokeColor, callback) {
    const colorValue = Phaser.Display.Color.HexStringToColor(fillColor).color;
    const strokeValue =
      Phaser.Display.Color.HexStringToColor(strokeColor).color;
    const container = this.add.container(x, y);

    // Add shadow effect
    const shadow = this.add
      .rectangle(0, 2, width, height, 0x000000, 0.3)
      .setOrigin(0);

    const background = this.add
      .rectangle(0, 0, width, height, colorValue, 0.96)
      .setOrigin(0)
      .setStrokeStyle(2, strokeValue, 0.55)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(width / 2, height / 2, label, {
        fontSize: "18px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    container.add([shadow, background, text]);
    container.disabled = false;
    container.setDisabled = (disabled) => {
      container.disabled = disabled;
      background.disableInteractive();
      if (!disabled) {
        background.setInteractive({ useHandCursor: true });
      }
      background.setFillStyle(colorValue, disabled ? 0.35 : 0.96);
      text.setAlpha(disabled ? 0.45 : 1);
    };

    background.on("pointerdown", () => {
      if (!container.disabled) {
        // Add press animation
        this.tweens.add({
          targets: container,
          y: container.y + 2,
          duration: 80,
          ease: "Quad.easeInOut",
        });
        callback();
      }
    });
    background.on("pointerover", () => {
      if (!container.disabled) {
        background.setStrokeStyle(2, strokeValue, 0.95);
        this.tweens.add({
          targets: container,
          scale: 1.04,
          duration: 150,
          ease: "Quad.easeOut",
        });
      }
    });
    background.on("pointerout", () => {
      background.setStrokeStyle(2, strokeValue, 0.55);
      this.tweens.add({
        targets: container,
        scale: 1,
        duration: 150,
        ease: "Quad.easeOut",
      });
    });

    return container;
  }

  getCandidatePlacement(pointer) {
    const definition = this.draggingPart.definition;
    const previewCenterX = pointer.worldX - this.draggingPart.dragOffsetX;
    const previewCenterY = pointer.worldY - this.draggingPart.dragOffsetY;
    const topLeftWorldX =
      previewCenterX - (definition.gridWidth * this.grid.cellSize) / 2 + 1;
    const topLeftWorldY =
      previewCenterY - (definition.gridHeight * this.grid.cellSize) / 2 + 1;
    const cell = this.getCellAtWorld(topLeftWorldX, topLeftWorldY);
    if (!cell) {
      return { cell: null, valid: false };
    }

    return {
      cell,
      valid: this.canPlacePart(
        this.draggingPart.definition.id,
        cell.cellX,
        cell.cellY,
      ),
    };
  }

  getPartDefinition(partId) {
    return PARTS_BY_ID[partId];
  }

  getPartSizePx(partId) {
    const definition = this.getPartDefinition(partId);
    return {
      width: definition.gridWidth * this.grid.cellSize,
      height: definition.gridHeight * this.grid.cellSize,
    };
  }

  getPartCenterFromCell(partId, cellX, cellY) {
    const definition = this.getPartDefinition(partId);
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

  redrawGrid() {
    const { columns, rows, cellSize, x, y } = this.grid;

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

  refreshGridZoom() {
    const zoomedCellSize = Math.round(this.baseGridCellSize * this.gridZoom);
    const gridWidth = this.grid.columns * zoomedCellSize;
    const gridHeight = this.grid.rows * zoomedCellSize;

    this.grid.cellSize = zoomedCellSize;
    this.grid.x =
      this.layout.centerStartX + (this.layout.centerWidth - gridWidth) / 2;
    this.grid.y = Math.max(
      178,
      Math.round((this.layout.height - gridHeight) / 2),
    );
    this.layout.gridWidth = gridWidth;
    this.layout.gridHeight = gridHeight;
    this.layout.gridX = this.grid.x;
    this.layout.gridY = this.grid.y;
    this.layout.messageX = this.grid.x;
    this.layout.messageY = this.grid.y + gridHeight + 26;

    this.redrawGrid();
    this.messageText.setPosition(this.layout.messageX, this.layout.messageY);
    this.messageText.setWordWrapWidth(this.layout.gridWidth);
    this.gridHighlight.setDisplaySize(
      this.grid.cellSize - 8,
      this.grid.cellSize - 8,
    );
    this.selectionHighlight.setDisplaySize(
      this.grid.cellSize - 4,
      this.grid.cellSize - 4,
    );

    Array.from(this.placedParts.values()).forEach((entry) => {
      const center = this.getPartCenterFromCell(
        entry.partId,
        entry.cellX,
        entry.cellY,
      );
      entry.view.setPosition(center.worldX, center.worldY);
      entry.view.redraw({
        cellSize: this.grid.cellSize,
        padding: 8,
        showLabel: false,
        showPlate: false,
      });
      this.makePlacedPartInteractive(entry);
    });

    if (this.selectedPartId) {
      const selectedPart = this.placedParts.get(this.selectedPartId);
      if (selectedPart) {
        const size = this.getPartSizePx(selectedPart.partId);
        this.selectionHighlight
          .setPosition(selectedPart.view.x, selectedPart.view.y)
          .setDisplaySize(size.width - 4, size.height - 4)
          .setVisible(true);
      }
    }

    this.renderCurrentBuild();
    this.showMessage(`Zoom ${Math.round(this.gridZoom * 100)}%`);
  }

  getOccupiedCells(partId, cellX, cellY) {
    const definition = this.getPartDefinition(partId);
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

  isPartWithinBounds(partId, cellX, cellY) {
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

  canPlacePart(partId, cellX, cellY) {
    const definition = this.getPartDefinition(partId);

    if (!definition || !this.isPartWithinBounds(partId, cellX, cellY)) {
      return false;
    }

    if (definition.type === "command") {
      const hasCockpit = Array.from(this.placedParts.values()).some(
        (part) => this.getPartDefinition(part.partId).type === "command",
      );
      if (hasCockpit) {
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
      [
        { x: cell.cellX - 1, y: cell.cellY },
        { x: cell.cellX + 1, y: cell.cellY },
        { x: cell.cellX, y: cell.cellY - 1 },
        { x: cell.cellX, y: cell.cellY + 1 },
      ].some((neighbor) =>
        Boolean(this.findPlacedPartAtCell(neighbor.x, neighbor.y)),
      ),
    );
  }

  addPlacedPart(partId, cellX, cellY, options = {}) {
    const definition = PARTS_BY_ID[partId];
    const cell = this.getPartCenterFromCell(partId, cellX, cellY);
    const view = new ShipPart(this, cell.worldX, cell.worldY, definition, {
      cellSize: this.grid.cellSize,
      padding: 8,
      showLabel: false,
      showPlate: false,
    });

    const entry = {
      partId,
      cellX,
      cellY,
      view,
    };

    view.setDepth(10);
    this.makePlacedPartInteractive(entry);
    this.placedParts.set(cellKey(cellX, cellY), entry);

    if (!options.skipSelect) {
      this.selectPlacedPart(cellX, cellY);
    }

    this.persistBuild();
    this.renderCurrentBuild();
  }

  makePlacedPartInteractive(entry) {
    const definition = this.getPartDefinition(entry.partId);
    const hitWidth = definition.gridWidth * this.grid.cellSize - 6;
    const hitHeight = definition.gridHeight * this.grid.cellSize - 6;

    entry.view.removeAllListeners("pointerdown");
    entry.view.removeAllListeners("pointerover");
    entry.view.removeAllListeners("pointerout");
    entry.view.setInteractive(
      new Phaser.Geom.Rectangle(
        -hitWidth / 2,
        -hitHeight / 2,
        hitWidth,
        hitHeight,
      ),
      Phaser.Geom.Rectangle.Contains,
    );
    entry.view.on("pointerdown", (pointer) =>
      this.queuePlacedPartDrag(entry, pointer),
    );
    entry.view.on("pointerover", () =>
      this.setHoveredInfo({
        source: "placed",
        partId: entry.partId,
        cellX: entry.cellX,
        cellY: entry.cellY,
        key: cellKey(entry.cellX, entry.cellY),
      }),
    );
    entry.view.on("pointerout", () =>
      this.clearHoveredInfo(
        "placed",
        entry.partId,
        cellKey(entry.cellX, entry.cellY),
      ),
    );
  }

  selectPlacedPart(cellX, cellY) {
    const key = cellKey(cellX, cellY);
    const selectedPart = this.placedParts.get(key);
    const definition = this.getPartDefinition(selectedPart?.partId);

    if (!selectedPart || !definition) {
      return;
    }

    const size = this.getPartSizePx(selectedPart.partId);
    this.selectedPartId = key;
    this.selectionHighlight
      .setVisible(true)
      .setDisplaySize(size.width - 4, size.height - 4)
      .setPosition(selectedPart.view.x, selectedPart.view.y);
    this.removeButton.setDisabled(false);
    this.updateFocusPanel();
  }

  clearSelection() {
    this.selectedPartId = null;
    this.selectionHighlight.setVisible(false);
    this.removeButton.setDisabled(true);
    this.updateFocusPanel();
  }

  removeSelectedPart() {
    if (!this.selectedPartId || this.draggingPart) {
      return;
    }

    const part = this.placedParts.get(this.selectedPartId);
    if (!part) {
      this.clearSelection();
      return;
    }

    this.removePlacedPart(part.cellX, part.cellY);
  }

  removePlacedPart(cellX, cellY) {
    const key = cellKey(cellX, cellY);
    const entry = this.placedParts.get(key);

    if (!entry) {
      return;
    }

    entry.view.destroy();
    this.placedParts.delete(key);

    if (this.selectedPartId === key) {
      this.clearSelection();
    }

    this.persistBuild();
    this.renderCurrentBuild();
    this.showMessage(`${PARTS_BY_ID[entry.partId].name} removed.`);
  }

  clearBuild() {
    this.hideContextMenu();
    if (this.draggingPart?.type === "move") {
      this.cancelPlacedPartDrag();
    }

    Array.from(this.placedParts.values()).forEach((entry) => {
      entry.view.destroy();
    });
    this.placedParts.clear();
    this.clearSelection();
    this.persistBuild();
    this.renderCurrentBuild();
    this.showMessage("Assembly grid cleared.");
  }

  restoreBuild(build) {
    build.forEach((part) => {
      if (PARTS_BY_ID[part.partId]) {
        this.addPlacedPart(part.partId, part.cellX, part.cellY, {
          skipSelect: true,
        });
      }
    });

    this.clearSelection();
  }

  serializeBuild() {
    return Array.from(this.placedParts.values()).map((entry) => ({
      partId: entry.partId,
      cellX: entry.cellX,
      cellY: entry.cellY,
    }));
  }

  getBuildPreview(candidate) {
    const build = this.serializeBuild();

    if (!this.draggingPart) {
      return build;
    }

    if (candidate.valid) {
      build.push({
        partId: this.draggingPart.definition.id,
        cellX: candidate.cell.cellX,
        cellY: candidate.cell.cellY,
      });
      return build;
    }

    if (this.draggingPart.type === "move") {
      build.push({
        partId: this.draggingPart.definition.id,
        cellX: this.draggingPart.originalCell.cellX,
        cellY: this.draggingPart.originalCell.cellY,
      });
    }

    return build;
  }

  persistBuild() {
    this.registry.set("rocket-build", this.serializeBuild());
  }

  renderCurrentBuild() {
    this.renderBuildState(this.serializeBuild());
  }

  renderBuildState(build) {
    const validation = BuildValidator.validate(build);
    const { stats } = validation;
    const sections = [];
    this.currentValidation = validation;

    this.statsText.setText(
      [
        `Modules: ${stats.partCount}`,
        `Mass: ${stats.mass.toFixed(0)}`,
        `Fuel: ${stats.fuel.toFixed(0)}`,
        `Thrust: ${stats.thrust.toFixed(0)}`,
        `Fuel Burn: ${stats.fuelUse.toFixed(2)}/s`,
        `TWR: ${stats.twr.toFixed(2)}`,
        `Balance: ${Math.round(stats.balanceScore * 100)}%`,
        `Stability: ${Math.round(stats.stability * 100)}%`,
        `Footprint: ${stats.width || 0}w x ${stats.height || 0}h`,
      ].join("\n"),
    );

    if (validation.isValid) {
      sections.push("Ready to launch\nThe design passes the pad checks.");
    } else {
      sections.push(`Errors\n${validation.errors.join("\n")}`);
    }

    if (validation.warnings.length > 0) {
      sections.push(`Warnings\n${validation.warnings.join("\n")}`);
    }

    this.validationText.setText(sections.join("\n\n"));
    this.validationText.setColor(validation.isValid ? "#9ef6ca" : "#ffd2b5");
    this.renderRocketHull(build);
    this.renderIssueHighlights(validation.issues);
    this.renderCenterOfMass(stats);
    this.updateFocusPanel();
  }

  getBuildOccupancy(build) {
    const occupied = new Map();

    build.forEach((part) => {
      const definition = this.getPartDefinition(part.partId);
      if (!definition) {
        return;
      }

      this.getOccupiedCells(part.partId, part.cellX, part.cellY).forEach(
        (cell) => {
          occupied.set(cellKey(cell.cellX, cell.cellY), {
            ...cell,
            partId: part.partId,
            type: definition.type,
          });
        },
      );
    });

    return occupied;
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
        const bodyY =
          this.grid.y + segment.topY * this.grid.cellSize + shellInsetY;
        const bodyHeight = Math.max(18, segmentHeight - shellInsetY * 2);
        const centerX = bodyX + shellWidth / 2;
        const topCell = occupied.get(cellKey(cellX, segment.topY));
        const bottomCell = occupied.get(cellKey(cellX, segment.bottomY));
        const shouldDrawCone = topCell?.type === "command";
        const bodyTop = shouldDrawCone ? bodyY + coneHeight * 0.58 : bodyY;
        const noseBaseY = bodyTop;

        this.hullShadowGraphics.fillStyle(0x000000, 0.18);
        this.hullShadowGraphics.fillRoundedRect(
          bodyX + 4,
          bodyTop + 8,
          shellWidth,
          Math.max(12, bodyHeight - (bodyTop - bodyY)),
          shellRadius,
        );

        this.hullGraphics.fillStyle(0xd5e4f0, 0.22);
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

  setHoveredInfo(info) {
    this.hoveredInfo = info;
    this.updateFocusPanel();
  }

  clearHoveredInfo(source, partId, key = null) {
    if (
      !this.hoveredInfo ||
      this.hoveredInfo.source !== source ||
      this.hoveredInfo.partId !== partId ||
      (key && this.hoveredInfo.key !== key)
    ) {
      return;
    }

    this.hoveredInfo = null;
    this.updateFocusPanel();
  }

  getFocusedDescriptor() {
    if (this.draggingPart) {
      return {
        source:
          this.draggingPart.type === "move"
            ? "dragging-existing"
            : "dragging-palette",
        partId: this.draggingPart.definition.id,
        cellX:
          this.dragPreviewCell?.cellX ??
          (this.draggingPart.originalCell
            ? this.draggingPart.originalCell.cellX
            : null),
        cellY:
          this.dragPreviewCell?.cellY ??
          (this.draggingPart.originalCell
            ? this.draggingPart.originalCell.cellY
            : null),
      };
    }

    if (this.hoveredInfo) {
      return this.hoveredInfo;
    }

    if (this.selectedPartId) {
      const selected = this.placedParts.get(this.selectedPartId);
      if (selected) {
        return {
          source: "selected",
          partId: selected.partId,
          cellX: selected.cellX,
          cellY: selected.cellY,
        };
      }
    }

    return null;
  }

  updateFocusPanel() {
    if (!this.focusTitleText || !this.focusBodyText) {
      return;
    }

    const focused = this.getFocusedDescriptor();
    if (!focused) {
      this.focusTitleText.setText("Hover a part");
      this.focusBodyText.setText(
        "Inspect any module to see its role, stats, and any build issues linked to it.",
      );
      this.focusBodyText.setColor("#bfdff4");
      return;
    }

    const definition = PARTS_BY_ID[focused.partId];
    const issues = this.getIssuesForFocusedPart(focused);
    const stateLabel = this.getFocusStateLabel(focused);
    const gridLabel =
      focused.cellX == null || focused.cellY == null
        ? "Grid: not placed"
        : `Grid: ${focused.cellX + 1}, ${focused.cellY + 1}`;
    const issueLines =
      issues.length > 0
        ? issues.map(
            (issue) =>
              `${issue.severity === "error" ? "Error" : "Warn"}: ${issue.message}`,
          )
        : ["Status: No direct issue on this module."];

    this.focusTitleText.setText(definition.name);
    this.focusBodyText.setText(
      [
        `${definition.role}`,
        `Mass: ${definition.mass}`,
        `Fuel: ${definition.fuel}`,
        `Thrust: ${definition.thrust}`,
        `${gridLabel}`,
        `State: ${stateLabel}`,
        ...issueLines,
      ].join("\n"),
    );
    this.focusBodyText.setColor(
      issues.some((issue) => issue.severity === "error")
        ? "#ffd2b5"
        : "#bfdff4",
    );
  }

  getFocusStateLabel(focused) {
    if (
      focused.source === "dragging-existing" ||
      focused.source === "dragging-palette"
    ) {
      return "Dragging";
    }
    if (focused.source === "selected") {
      return "Selected";
    }
    if (focused.source === "placed") {
      return "Hovered";
    }
    if (focused.source === "palette") {
      return "Palette";
    }
    return "Observed";
  }

  getIssuesForFocusedPart(focused) {
    if (
      !this.currentValidation ||
      focused.cellX == null ||
      focused.cellY == null
    ) {
      return [];
    }

    const occupiedCells = this.getOccupiedCells(
      focused.partId,
      focused.cellX,
      focused.cellY,
    );

    return this.currentValidation.issues.filter((issue) =>
      issue.affectedCells.some((cell) =>
        occupiedCells.some(
          (occupiedCell) =>
            occupiedCell.cellX === cell.cellX &&
            occupiedCell.cellY === cell.cellY,
        ),
      ),
    );
  }

  renderIssueHighlights(issues) {
    const cellSize = this.grid.cellSize - 10;
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
      const color = severity === "error" ? 0xff8d8d : 0xffd773;

      this.issueGraphics.lineStyle(3, color, 0.92);
      this.issueGraphics.strokeRoundedRect(
        cell.worldX - cellSize / 2,
        cell.worldY - cellSize / 2,
        cellSize,
        cellSize,
        10,
      );
      this.issueGraphics.fillStyle(color, severity === "error" ? 0.1 : 0.08);
      this.issueGraphics.fillRoundedRect(
        cell.worldX - cellSize / 2,
        cell.worldY - cellSize / 2,
        cellSize,
        cellSize,
        10,
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

  launchRocket() {
    this.hideContextMenu();
    if (this.draggingPart?.type === "move") {
      this.cancelPlacedPartDrag();
    }

    const build = this.serializeBuild();
    const validation = BuildValidator.validate(build);

    if (!validation.isValid) {
      this.showMessage(validation.errors[0]);
      return;
    }

    this.registry.set("rocket-build", build);

    // Add smooth fade transition
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.time.delayedCall(620, () => {
      this.scene.start("FlightScene", {
        build,
        stats: validation.stats,
      });
    });
  }

  showMessage(message) {
    this.messageText.setText(message);
    this.tweens.killTweensOf(this.messageText);
    this.messageText.setAlpha(1);
    this.tweens.add({
      targets: this.messageText,
      alpha: 0.55,
      duration: 900,
      yoyo: true,
      repeat: 0,
    });
  }
}
