import Phaser from "phaser";
import { PARTS_BY_ID } from "../data/parts.js";
import { STARTER_ROCKET, cloneBuildParts, createStarterRocketBuild } from "../data/starterRocket.js";
import BuildValidator from "../systems/BuildValidator.js";
import ShipStatsCalculator from "../systems/ShipStatsCalculator.js";
import BuildContextMenu from "../ui/build/BuildContextMenu.js";
import BuildGridView from "../ui/build/BuildGridView.js";
import BuildInspectorPanel from "../ui/build/BuildInspectorPanel.js";
import { computeBuildLayout } from "../ui/build/BuildLayout.js";
import { createBuildPalette } from "../ui/build/BuildPalette.js";
import BuildStatsPanel from "../ui/build/BuildStatsPanel.js";
import BuildSurface from "../ui/build/BuildSurface.js";
import BuildToast from "../ui/build/BuildToast.js";
import BuildToolbar from "../ui/build/BuildToolbar.js";

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
    this.baseGrid = {
      columns: 7,
      rows: 10,
    };
  }

  init(data) {
    const hasExplicitBuild = Array.isArray(data.build);
    const storedBuild = hasExplicitBuild ? data.build : this.registry.get("rocket-build");
    this.usedStarterBuild = !hasExplicitBuild && (!Array.isArray(storedBuild) || storedBuild.length === 0);
    this.initialBuild = this.resolveInitialBuild(storedBuild, {
      preserveEmpty: hasExplicitBuild,
    });
    this.initialSelectedPartId = data.selectedPartId || "capsule";
  }

  create() {
    this.placedParts = new Map();
    this.paletteCards = new Map();
    this.selectedPartId = this.initialSelectedPartId;
    this.selectedPlacedKey = null;
    this.hoveredInfo = null;
    this.dragState = null;
    this.scrollState = null;
    this.currentValidation = BuildValidator.validate([]);
    this.resizePending = false;

    this.computeLayout();
    this.configureCameraBounds();
    this.createInterface();
    this.restoreBuild(this.initialBuild);
    this.registerInput();
    this.renderBuild();
    this.toast.show({
      tone: "neutral",
      label: "VEHICLE BAY",
      message: this.usedStarterBuild
        ? "Starter vehicle loaded. Adjust the stack or proceed directly to launch."
        : "Drag modules into the assembly area or click an empty cell to place the selected module.",
    });
  }

  resolveInitialBuild(build, { preserveEmpty = false } = {}) {
    if (Array.isArray(build) && (build.length > 0 || preserveEmpty)) {
      return cloneBuildParts(build);
    }

    return createStarterRocketBuild();
  }

  computeLayout() {
    const metrics = computeBuildLayout({
      width: this.scale.width,
      height: this.scale.height,
      grid: this.baseGrid,
    });

    this.theme = metrics.theme;
    this.layout = metrics.layout;
    this.grid = metrics.grid;
  }

  createInterface() {
    this.surface = new BuildSurface(this, {
      layout: this.layout,
      grid: this.grid,
      theme: this.theme,
    });
    this.gridView = new BuildGridView(this, {
      layout: this.layout,
      grid: this.grid,
      theme: this.theme,
    });
    this.statsPanel = new BuildStatsPanel(this, {
      layout: this.layout,
      theme: this.theme,
    });
    this.inspectorPanel = new BuildInspectorPanel(this, {
      layout: this.layout,
      theme: this.theme,
    });
    this.toolbar = new BuildToolbar(this, {
      layout: this.layout,
      theme: this.theme,
      onLaunch: () => this.launchRocket(),
      onClear: () => this.clearBuild(),
      onRemove: () => this.removeSelectedPlacedPart(),
      onReset: () => this.loadStarterRocket(),
    });
    this.toast = new BuildToast(this, {
      layout: this.layout,
      theme: this.theme,
    });
    this.contextMenu = new BuildContextMenu(this, {
      theme: this.theme,
      onSelect: (entry) => this.selectPlacedPart(entry),
      onDelete: (entry) => this.removePlacedPart(entry),
      onCancel: () => this.renderBuild(),
    });
    this.createGridInputZone();
    createBuildPalette(this);
    this.syncPaletteSelection();
  }

  configureCameraBounds() {
    const worldHeight = this.layout.worldHeight || this.scale.height;
    this.cameras.main.setBounds(0, 0, this.scale.width, worldHeight);
    this.cameras.main.setScroll(0, 0);
  }

  createGridInputZone() {
    this.gridInput = this.add
      .zone(this.grid.x, this.grid.y, this.layout.gridWidth, this.layout.gridHeight)
      .setOrigin(0)
      .setInteractive();

    this.gridInput.on("pointermove", (pointer) => this.handleGridPointerMove(pointer));
    this.gridInput.on("pointerout", () => {
      if (!this.dragState) {
        this.gridView.clearPlacementCandidate();
      }
    });
    this.gridInput.on("pointerdown", (pointer) => this.handleGridPointerDown(pointer));
  }

  registerInput() {
    this.input.mouse?.disableContextMenu();
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("pointerdown", this.handleScenePointerDown, this);
    this.input.on("wheel", this.handleWheel, this);
    this.input.keyboard.on("keydown-DELETE", this.removeSelectedPlacedPart, this);
    this.input.keyboard.on("keydown-BACKSPACE", this.removeSelectedPlacedPart, this);
    this.input.keyboard.on("keydown-R", this.clearBuild, this);
    this.input.keyboard.on("keydown-SPACE", this.handleLaunchShortcut, this);
    this.scale.on("resize", this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  handleShutdown() {
    this.input.off("pointermove", this.handlePointerMove, this);
    this.input.off("pointerup", this.handlePointerUp, this);
    this.input.off("pointerdown", this.handleScenePointerDown, this);
    this.input.off("wheel", this.handleWheel, this);
    this.input.keyboard.off("keydown-DELETE", this.removeSelectedPlacedPart, this);
    this.input.keyboard.off("keydown-BACKSPACE", this.removeSelectedPlacedPart, this);
    this.input.keyboard.off("keydown-R", this.clearBuild, this);
    this.input.keyboard.off("keydown-SPACE", this.handleLaunchShortcut, this);
    this.scale.off("resize", this.handleResize, this);
  }

  handleResize() {
    if (this.resizePending) {
      return;
    }

    this.resizePending = true;
    this.time.delayedCall(20, () => {
      this.scene.restart({
        build: this.serializeBuild(),
        selectedPartId: this.selectedPartId,
      });
    });
  }

  handleLaunchShortcut() {
    if (this.currentValidation.isValid) {
      this.launchRocket();
    }
  }

  handleScenePointerDown(pointer) {
    if (this.contextMenu.contains(pointer)) {
      return;
    }

    if (this.contextMenu.root.visible) {
      this.contextMenu.hide();
    }

    if (pointer.rightButtonDown()) {
      return;
    }

    if (!this.dragState && !this.gridView.getCellAtWorld(pointer.worldX, pointer.worldY)) {
      this.clearPlacedSelection();
    }

    this.beginScroll(pointer);
  }

  handleWheel(pointer, over, deltaX, deltaY) {
    if (!this.layout.scrollable) {
      return;
    }

    this.scrollBuild(deltaY * 0.65);
  }

  beginScroll(pointer) {
    if (
      !this.layout.scrollable ||
      this.dragState ||
      pointer.rightButtonDown() ||
      pointer.middleButtonDown() ||
      this.gridView.getCellAtWorld(pointer.worldX, pointer.worldY)
    ) {
      return;
    }

    this.scrollState = {
      pointerId: pointer.id,
      startY: pointer.y,
      startScrollY: this.cameras.main.scrollY,
      moved: false,
    };
  }

  updateScroll(pointer) {
    if (!this.scrollState || this.scrollState.pointerId !== pointer.id) {
      return false;
    }

    const deltaY = pointer.y - this.scrollState.startY;
    if (Math.abs(deltaY) > 3) {
      this.scrollState.moved = true;
    }
    this.setBuildScroll(this.scrollState.startScrollY - deltaY);
    return this.scrollState.moved;
  }

  endScroll(pointer) {
    if (this.scrollState?.pointerId === pointer.id) {
      this.scrollState = null;
    }
  }

  scrollBuild(deltaY) {
    this.setBuildScroll(this.cameras.main.scrollY + deltaY);
  }

  setBuildScroll(scrollY) {
    const maxScrollY = Math.max(
      0,
      (this.layout.worldHeight || this.scale.height) - this.scale.height,
    );
    this.cameras.main.setScroll(0, Phaser.Math.Clamp(scrollY, 0, maxScrollY));
  }

  handleGridPointerMove(pointer) {
    if (this.dragState) {
      return;
    }

    const cell = this.gridView.getCellAtWorld(pointer.worldX, pointer.worldY);
    if (!cell || !this.selectedPartId) {
      this.gridView.clearPlacementCandidate();
      return;
    }

    if (this.findPlacedPartAtCell(cell.cellX, cell.cellY)) {
      this.gridView.clearPlacementCandidate();
      return;
    }

    this.gridView.showPlacementCandidate(this.selectedPartId, {
      cell,
      valid: this.canPlacePart(this.selectedPartId, cell.cellX, cell.cellY),
    });
  }

  handleGridPointerDown(pointer) {
    if (pointer.rightButtonDown() || this.dragState) {
      return;
    }

    const cell = this.gridView.getCellAtWorld(pointer.worldX, pointer.worldY);
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

    const placement = this.getPlacementValidation(
      this.selectedPartId,
      cell.cellX,
      cell.cellY,
    );

    if (!placement.valid) {
      this.showPlacementToast(placement.reason);
      return;
    }

    this.addPlacedPart(this.selectedPartId, cell.cellX, cell.cellY);
  }

  handlePointerMove(pointer) {
    if (!this.dragState && this.updateScroll(pointer)) {
      return;
    }

    if (!this.dragState || this.dragState.pointerId !== pointer.id) {
      return;
    }

    if (this.dragState.mode === "palette") {
      this.gridView.movePreview(this.dragState.preview, pointer.worldX, pointer.worldY);
    }

    if (this.dragState.mode === "placed") {
      this.dragState.entry.view.setPosition(pointer.worldX, pointer.worldY);
    }

    this.updateDragCandidate(pointer);
  }

  handlePointerUp(pointer) {
    this.endScroll(pointer);

    if (!this.dragState || this.dragState.pointerId !== pointer.id) {
      return;
    }

    const drag = this.dragState;
    this.dragState = null;
    this.gridView.clearPlacementCandidate();

    if (drag.mode === "palette") {
      drag.preview.destroy();

      if (drag.candidate?.cell && drag.candidate.valid) {
        this.addPlacedPart(drag.partId, drag.candidate.cell.cellX, drag.candidate.cell.cellY);
      } else if (drag.candidate?.cell) {
        this.showPlacementToast(drag.candidate.reason);
        this.renderBuild();
      } else {
        this.renderBuild();
      }
      return;
    }

    const { entry } = drag;
    if (drag.candidate?.cell && drag.candidate.valid) {
      this.movePlacedPart(entry, drag.candidate.cell.cellX, drag.candidate.cell.cellY);
      return;
    }

    this.gridView.restorePartView(entry);
    if (drag.candidate?.cell) {
      this.showPlacementToast(drag.candidate.reason);
    }
    this.selectPlacedPart(entry);
  }

  updateDragCandidate(pointer) {
    const drag = this.dragState;
    if (!drag) {
      return;
    }

    const cell = this.gridView.getCellAtWorld(pointer.worldX, pointer.worldY);
    if (!cell) {
      drag.candidate = { cell: null, valid: false, reason: "" };
      this.gridView.clearPlacementCandidate();
      return;
    }

    const placement = this.getPlacementValidation(
      drag.partId,
      cell.cellX,
      cell.cellY,
      {
        ignoreKey: drag.mode === "placed" ? drag.entry.key : null,
      },
    );
    drag.candidate = {
      cell,
      valid: placement.valid,
      reason: placement.reason,
    };
    this.gridView.showPlacementCandidate(drag.partId, drag.candidate);
  }

  beginPaletteDrag(part, pointer) {
    if (pointer.rightButtonDown()) {
      return;
    }

    this.contextMenu.hide();
    this.selectPalettePart(part.id);

    const preview = this.gridView.createDragPreview(part, pointer.worldX, pointer.worldY);
    this.dragState = {
      mode: "palette",
      pointerId: pointer.id,
      partId: part.id,
      preview,
      candidate: null,
    };
    this.updateDragCandidate(pointer);
  }

  beginPlacedDrag(entry, pointer) {
    if (pointer.rightButtonDown()) {
      this.selectPlacedPart(entry);
      this.contextMenu.show(pointer.worldX, pointer.worldY, entry);
      return;
    }

    this.contextMenu.hide();
    this.selectPlacedPart(entry);
    this.dragState = {
      mode: "placed",
      pointerId: pointer.id,
      partId: entry.partId,
      entry,
      candidate: null,
    };
    this.gridView.setPartDragging(entry);
    this.updateDragCandidate(pointer);
  }

  createPlacedPartEntry(partId, cellX, cellY) {
    const view = this.gridView.createPlacedPartView(partId, cellX, cellY);
    const entry = {
      key: cellKey(cellX, cellY),
      partId,
      cellX,
      cellY,
      view,
    };
    this.attachPlacedPartInteraction(entry);
    return entry;
  }

  attachPlacedPartInteraction(entry) {
    const definition = PARTS_BY_ID[entry.partId];
    const width = definition.gridWidth * this.grid.cellSize;
    const height = definition.gridHeight * this.grid.cellSize;

    entry.view.setSize(width, height);
    entry.view.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains,
    );
    entry.view.on("pointerdown", (pointer) => this.beginPlacedDrag(entry, pointer));
    entry.view.on("pointerover", () => {
      this.setHoveredInfo({ source: "placed", key: entry.key });
    });
    entry.view.on("pointerout", () => {
      this.clearHoveredInfo("placed", entry.key);
    });
  }

  getOccupiedCells(partId, cellX, cellY) {
    const definition = PARTS_BY_ID[partId];
    const cells = [];

    if (!definition) {
      return cells;
    }

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

  findPlacedPartAtCell(cellX, cellY, ignoreKey = null) {
    return Array.from(this.placedParts.values()).find((entry) => {
      if (entry.key === ignoreKey) {
        return false;
      }

      return this.getOccupiedCells(entry.partId, entry.cellX, entry.cellY).some(
        (cell) => cell.cellX === cellX && cell.cellY === cellY,
      );
    });
  }

  getPlacementValidation(partId, cellX, cellY, { ignoreKey = null } = {}) {
    const definition = PARTS_BY_ID[partId];
    if (!definition) {
      return {
        valid: false,
        reason: "That module is not available in the current catalog.",
      };
    }

    if (!this.isWithinBounds(partId, cellX, cellY)) {
      return {
        valid: false,
        reason: "Move the module inside the assembly grid.",
      };
    }

    if (definition.type === "command") {
      const hasOtherCommandModule = Array.from(this.placedParts.values()).some(
        (entry) =>
          entry.key !== ignoreKey && PARTS_BY_ID[entry.partId]?.type === "command",
      );
      if (hasOtherCommandModule) {
        return {
          valid: false,
          reason: "Only one capsule can control the stack.",
        };
      }
    }

    const occupiedCells = this.getOccupiedCells(partId, cellX, cellY);
    if (
      occupiedCells.some((cell) =>
        Boolean(this.findPlacedPartAtCell(cell.cellX, cell.cellY, ignoreKey)),
      )
    ) {
      return {
        valid: false,
        reason: "That space is already occupied.",
      };
    }

    const remainingParts = Array.from(this.placedParts.keys()).filter(
      (key) => key !== ignoreKey,
    );
    if (remainingParts.length === 0) {
      return {
        valid: true,
        reason: "",
      };
    }

    const connected = occupiedCells.some((cell) =>
      GRID_NEIGHBORS.some((offset) =>
        Boolean(
          this.findPlacedPartAtCell(
            cell.cellX + offset.x,
            cell.cellY + offset.y,
            ignoreKey,
          ),
        ),
      ),
    );

    if (!connected) {
      return {
        valid: false,
        reason: "New modules must connect to the current rocket body.",
      };
    }

    return {
      valid: true,
      reason: "",
    };
  }

  canPlacePart(partId, cellX, cellY, options) {
    return this.getPlacementValidation(partId, cellX, cellY, options).valid;
  }

  addPlacedPart(partId, cellX, cellY, options = {}) {
    const placement = this.getPlacementValidation(partId, cellX, cellY);
    if (!placement.valid) {
      if (!options.silent) {
        this.showPlacementToast(placement.reason);
      }
      return null;
    }

    const entry = this.createPlacedPartEntry(partId, cellX, cellY);
    this.placedParts.set(entry.key, entry);
    this.persistBuild();

    if (options.select !== false) {
      this.selectPlacedPart(entry);
    } else {
      this.renderBuild();
    }

    return entry;
  }

  movePlacedPart(entry, cellX, cellY) {
    this.placedParts.delete(entry.key);
    entry.cellX = cellX;
    entry.cellY = cellY;
    entry.key = cellKey(cellX, cellY);
    this.placedParts.set(entry.key, entry);
    this.gridView.restorePartView(entry);
    this.gridView.positionPartView(entry);
    this.persistBuild();
    this.selectPlacedPart(entry);
  }

  removePlacedPart(entry) {
    if (!entry) {
      return;
    }

    if (this.selectedPlacedKey === entry.key) {
      this.selectedPlacedKey = null;
    }

    entry.view.destroy();
    this.placedParts.delete(entry.key);
    this.persistBuild();
    this.renderBuild();
      this.toast.show({
        tone: "neutral",
        label: "MODULE REMOVED",
        message: `${PARTS_BY_ID[entry.partId]?.name || "Module"} removed from the vehicle.`,
      });
  }

  removeSelectedPlacedPart() {
    if (!this.selectedPlacedKey) {
      return;
    }

    const entry = this.placedParts.get(this.selectedPlacedKey);
    this.removePlacedPart(entry);
  }

  clearBuild(options = {}) {
    const {
      silent = false,
      label = "VEHICLE CLEARED",
      message = "The current stack was cleared. Start a fresh build when ready.",
    } = options;

    if (this.placedParts.size === 0) {
      return;
    }

    this.placedParts.forEach((entry) => entry.view.destroy());
    this.placedParts.clear();
    this.selectedPlacedKey = null;
    this.contextMenu.hide();
    this.persistBuild();
    this.renderBuild();
    if (!silent) {
      this.toast.show({
        tone: "neutral",
        label,
        message,
      });
    }
  }

  selectPalettePart(partId) {
    this.selectedPartId = partId;
    this.syncPaletteSelection();
    this.refreshInspector();
  }

  syncPaletteSelection() {
    this.paletteCards.forEach((card, partId) => {
      const selected = partId === this.selectedPartId;
      const part = PARTS_BY_ID[partId];

      card.background.setStrokeStyle(2, part.color, selected ? 0.9 : 0.3);
      card.background.setFillStyle(
        selected ? this.theme.colors.cardFillRaised : this.theme.colors.cardFill,
        0.98,
      );
      card.inner.setFillStyle(
        selected ? this.theme.focusState.palette : this.theme.colors.cardFillAlt,
        selected ? 0.72 : 0.5,
      );
      card.accentStrip.setAlpha(selected ? 1 : 0.96);
      card.title.setColor(selected ? this.theme.colors.textSuccess : this.theme.colors.textPrimary);
      this.tweens.add({
        targets: card.card,
        scale: card.originalScale,
        duration: 120,
        ease: "Quad.easeOut",
      });
    });
  }

  selectPlacedPart(entry) {
    this.selectedPlacedKey = entry?.key || null;
    this.renderBuild();
  }

  clearPlacedSelection() {
    if (!this.selectedPlacedKey) {
      return;
    }

    this.selectedPlacedKey = null;
    this.renderBuild();
  }

  setHoveredInfo(info) {
    this.hoveredInfo = info;
    this.refreshInspector();
  }

  clearHoveredInfo(source, identifier) {
    if (!this.hoveredInfo) {
      return;
    }

    if (
      this.hoveredInfo.source === source &&
      (this.hoveredInfo.partId === identifier || this.hoveredInfo.key === identifier)
    ) {
      this.hoveredInfo = null;
      this.refreshInspector();
    }
  }

  restoreBuild(build) {
    build.forEach((part) => {
      if (PARTS_BY_ID[part.partId]) {
        this.addPlacedPart(part.partId, part.cellX, part.cellY, {
          select: false,
          silent: true,
        });
      }
    });

    this.selectedPlacedKey = null;
    this.persistBuild();
    this.renderBuild();
  }

  loadBlueprint(blueprint, options = {}) {
    const parts = Array.isArray(blueprint) ? blueprint : blueprint?.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
      return;
    }

    this.clearBuild({ silent: true });
    this.restoreBuild(cloneBuildParts(parts));

    if (options.toast !== false) {
      this.toast.show({
        tone: "neutral",
        label: options.label || "STARTER LOADED",
        message:
          options.message ||
          `${blueprint?.name || "Default vehicle"} restored to the assembly area.`,
      });
    }
  }

  loadStarterRocket() {
    this.loadBlueprint(STARTER_ROCKET, {
      label: "STARTER LOADED",
      message: "Starter vehicle restored. You can tune it or launch immediately.",
    });
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

  renderBuild() {
    const build = this.serializeBuild();
    this.currentValidation = BuildValidator.validate(build);

    this.gridView.renderBuild(build, this.currentValidation);
    this.statsPanel.update(this.currentValidation);

    const selectedEntry = this.selectedPlacedKey
      ? this.placedParts.get(this.selectedPlacedKey)
      : null;

    if (selectedEntry) {
      this.gridView.showSelection(selectedEntry);
    } else {
      this.gridView.clearSelection();
    }

    this.toolbar.setRemoveEnabled(Boolean(selectedEntry));
    this.toolbar.setLaunchEnabled(this.currentValidation.isValid);
    this.refreshInspector();
  }

  refreshInspector() {
    this.inspectorPanel.update(this.getInspectorModel());
  }

  getInspectorModel() {
    if (this.hoveredInfo?.source === "placed") {
      return this.createPlacedInspectorModel(this.hoveredInfo.key, "Hovered");
    }

    if (this.hoveredInfo?.source === "palette") {
      return this.createPaletteInspectorModel(this.hoveredInfo.partId, "Hovered");
    }

    if (this.selectedPlacedKey) {
      return this.createPlacedInspectorModel(this.selectedPlacedKey, "Selected");
    }

    if (this.selectedPartId) {
      return this.createPaletteInspectorModel(this.selectedPartId, "Catalog");
    }

    return null;
  }

  createPaletteInspectorModel(partId, stateLabel) {
    const definition = PARTS_BY_ID[partId];
    if (!definition) {
      return null;
    }

    return {
      name: definition.name,
      role: definition.role,
      description: definition.description,
      gridLabel: `Catalog module - ${definition.gridWidth}x${definition.gridHeight} cells`,
      mass: definition.mass,
      fuel: definition.fuel,
      thrust: definition.thrust,
      issues: [],
      stateLabel,
      stateColor: this.theme.focusState.palette,
      partColor: definition.color,
    };
  }

  createPlacedInspectorModel(key, stateLabel) {
    const entry = this.placedParts.get(key);
    if (!entry) {
      return null;
    }

    const definition = PARTS_BY_ID[entry.partId];
    const occupiedKeys = new Set(
      this.getOccupiedCells(entry.partId, entry.cellX, entry.cellY).map((cell) =>
        cellKey(cell.cellX, cell.cellY),
      ),
    );
    const issues = this.currentValidation.issues
      .filter((issue) =>
        issue.affectedCells.some((cell) => occupiedKeys.has(cellKey(cell.cellX, cell.cellY))),
      )
      .map((issue) => ({
        severity: issue.severity,
        message: issue.message,
      }));

    return {
      name: definition.name,
      role: definition.role,
      description: definition.description,
      gridLabel: `Grid ${entry.cellX + 1}, ${entry.cellY + 1} - ${definition.gridWidth}x${definition.gridHeight} cells`,
      mass: definition.mass,
      fuel: definition.fuel,
      thrust: definition.thrust,
      issues,
      stateLabel,
      stateColor:
        stateLabel === "Hovered"
          ? this.theme.focusState.hovered
          : this.theme.focusState.selected,
      partColor: definition.color,
    };
  }

  showPlacementToast(message) {
    this.toast.show({
      tone: "blocked",
      label: "PLACEMENT BLOCKED",
      message,
    });
  }

  launchRocket() {
    const build = this.serializeBuild();
    const validation = BuildValidator.validate(build);
    if (!validation.isValid) {
      this.toast.show({
        tone: "blocked",
        label: "LAUNCH BLOCKED",
        message: validation.errors[0] || "Resolve the remaining pad checks before launch.",
      });
      return;
    }

    const stats = ShipStatsCalculator.calculate(build);
    this.registry.set("rocket-build", build);
    this.scene.start("FlightScene", { build, stats });
  }
}
