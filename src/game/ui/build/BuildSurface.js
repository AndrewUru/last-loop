export default class BuildSurface {
  constructor(scene, { layout, grid, theme }) {
    this.scene = scene;
    this.layout = layout;
    this.grid = grid;
    this.theme = theme;

    this.createBackground();
    this.createPanels();
    this.updateLayout(layout, grid);
  }

  createBackground() {
    const { width, height, titleX, worldHeight } = this.layout;
    const { colors, depth, title, surface } = this.theme;
    const compact = this.layout.compactUi;
    const kickerY = compact ? 16 : 26;
    const headlineY = compact ? 28 : 42;
    const descriptionY = compact ? 56 : 88;
    const paperHeight = worldHeight || height;

    this.paper = this.scene.add.graphics().setDepth(depth.background);
    this.paper.fillStyle(colors.paperBackground, 1);
    this.paper.fillRect(0, 0, width, paperHeight);
    this.paper.fillGradientStyle(
      colors.paperInnerGlow,
      colors.backgroundTopRight,
      colors.backgroundBottomRight,
      colors.backgroundBottomLeft,
      surface.innerGlowAlpha,
    );
    this.paper.fillRect(0, 0, width, paperHeight);

    this.drawPaperGrid(width, paperHeight);

    this.kickerText = this.scene.add.text(titleX, kickerY, "VEHICLE ASSEMBLY", {
      fontSize: `${title.kickerSize}px`,
      color: colors.textSuccess,
      fontStyle: "bold",
      letterSpacing: 1.2,
    });
    this.headlineText = this.scene.add.text(titleX, headlineY, "Launch Vehicle", {
      fontSize: `${title.headlineSize}px`,
      color: colors.textPrimary,
      fontStyle: "bold",
    });
    this.descriptionText = this.scene.add.text(
      titleX,
      descriptionY,
      compact
        ? "Assemble, validate, launch."
        : "Assemble the stack, verify stability, then commit the vehicle to launch.",
      {
        fontSize: `${title.descriptionSize}px`,
        color: colors.textAccent,
      },
    );
  }

  drawPaperGrid(width, height) {
    const { colors, surface } = this.theme;
    const gap = surface.minorGap;
    const frame = surface.frameInset;
    const majorEvery = surface.majorEvery;
    const crossSize = surface.crossSize;

    this.paper.lineStyle(1, colors.paperMinor, 0.08);
    for (let x = frame, column = 0; x <= width - frame; x += gap, column += 1) {
      if (column % majorEvery === 0) {
        continue;
      }
      this.paper.lineBetween(x, frame, x, height - frame);
    }
    for (let y = frame, row = 0; y <= height - frame; y += gap, row += 1) {
      if (row % majorEvery === 0) {
        continue;
      }
      this.paper.lineBetween(frame, y, width - frame, y);
    }

    this.paper.lineStyle(1, colors.paperMajor, 0.2);
    for (let x = frame, column = 0; x <= width - frame; x += gap, column += 1) {
      if (column % majorEvery === 0) {
        this.paper.lineBetween(x, frame, x, height - frame);
      }
    }
    for (let y = frame, row = 0; y <= height - frame; y += gap, row += 1) {
      if (row % majorEvery === 0) {
        this.paper.lineBetween(frame, y, width - frame, y);
      }
    }

    this.paper.lineStyle(1, colors.paperCross, 0.34);
    for (let x = frame, column = 0; x <= width - frame; x += gap, column += 1) {
      if (column % majorEvery !== 0) {
        continue;
      }

      for (let y = frame, row = 0; y <= height - frame; y += gap, row += 1) {
        if (row % majorEvery !== 0) {
          continue;
        }

        this.paper.lineBetween(x - crossSize, y, x + crossSize, y);
        this.paper.lineBetween(x, y - crossSize, x, y + crossSize);
        this.paper.fillStyle(colors.paperBackground, 1);
        this.paper.fillCircle(x, y, 1.5);
      }
    }

    this.paper.lineStyle(1, colors.paperCross, 0.36);
    this.paper.strokeRect(frame, frame, width - frame * 2, height - frame * 2);
    this.paper.lineStyle(1, colors.paperFrame, 0.5);
    this.paper.strokeRect(frame + 1, frame + 1, width - frame * 2 - 2, height - frame * 2 - 2);
  }

  createPanels() {
    const { colors, alpha, title, panel, spacing } = this.theme;

    this.leftPanelGlow = this.scene.add
      .rectangle(0, 0, 0, 0, colors.panelGlow, 0.08)
      .setStrokeStyle(panel.glowWidth, colors.cardEdge, 0.1);
    this.leftPanelShadow = this.scene.add
      .rectangle(0, 0, 0, 0, colors.shadow, alpha.panelShadow)
      .setStrokeStyle(2, colors.cardEdge, 0.08);
    this.leftPanel = this.scene.add
      .rectangle(0, 0, 0, 0, colors.panelFill, alpha.panelFill)
      .setStrokeStyle(2, colors.cardEdge, alpha.panelStroke);
    this.leftPanelInset = this.scene.add
      .rectangle(0, 0, 0, 0, colors.panelInset, 0.76)
      .setStrokeStyle(1, colors.cardEdgeSoft, 0.18);
    this.leftHeaderBar = this.scene.add.rectangle(
      0,
      0,
      0,
      panel.headerHeight,
      colors.panelInsetAlt,
      0.94,
    );

    this.centerPanelGlow = this.scene.add
      .rectangle(0, 0, 0, 0, colors.panelGlow, 0.08)
      .setStrokeStyle(panel.glowWidth, colors.cardEdge, 0.1);
    this.centerPanelShadow = this.scene.add
      .rectangle(0, 0, 0, 0, colors.shadow, alpha.centerPanelShadow)
      .setStrokeStyle(2, colors.cardEdge, 0.1);
    this.centerPanel = this.scene.add
      .rectangle(0, 0, 0, 0, colors.panelFillCenter, alpha.centerPanelFill)
      .setStrokeStyle(2, colors.cardEdge, 0.28);
    this.centerPanelInset = this.scene.add
      .rectangle(0, 0, 0, 0, colors.panelInset, 0.5)
      .setStrokeStyle(1, colors.cardEdgeSoft, 0.12);
    this.centerHeaderBar = this.scene.add.rectangle(
      0,
      0,
      0,
      panel.headerHeight,
      colors.panelInsetAlt,
      0.88,
    );

    this.rightPanelGlow = this.scene.add
      .rectangle(0, 0, 0, 0, colors.panelGlow, 0.08)
      .setStrokeStyle(panel.glowWidth, colors.cardEdge, 0.1);
    this.rightPanelShadow = this.scene.add
      .rectangle(0, 0, 0, 0, colors.shadow, alpha.panelShadow)
      .setStrokeStyle(2, colors.cardEdge, 0.08);
    this.rightPanel = this.scene.add
      .rectangle(0, 0, 0, 0, colors.panelFill, alpha.panelFill)
      .setStrokeStyle(2, colors.cardEdge, alpha.panelStroke);
    this.rightPanelInset = this.scene.add
      .rectangle(0, 0, 0, 0, colors.panelInset, 0.76)
      .setStrokeStyle(1, colors.cardEdgeSoft, 0.18);
    this.rightHeaderBar = this.scene.add.rectangle(
      0,
      0,
      0,
      panel.headerHeight,
      colors.panelInsetAlt,
      0.94,
    );

    this.partsLabel = this.scene.add.text(0, 0, "CATALOG", {
      fontSize: `${this.theme.fontSizes.caption}px`,
      color: colors.textAccent,
      fontStyle: "bold",
      letterSpacing: 1,
    });
    this.partsHeading = this.scene.add.text(0, 0, "Modules", {
      fontSize: `${title.panelHeadingSize - 1}px`,
      color: colors.textPrimary,
      fontStyle: "bold",
    });

    this.gridLabel = this.scene.add.text(0, 0, "VEHICLE", {
      fontSize: `${this.theme.fontSizes.caption}px`,
      color: colors.textAccent,
      fontStyle: "bold",
      letterSpacing: 1,
    });
    this.gridHeading = this.scene.add.text(0, 0, "Assembly Area", {
      fontSize: `${title.panelHeadingSize - 1}px`,
      color: colors.textPrimary,
      fontStyle: "bold",
    });

    this.readinessLabel = this.scene.add.text(0, 0, "FLIGHT", {
      fontSize: `${this.theme.fontSizes.caption}px`,
      color: colors.textAccent,
      fontStyle: "bold",
      letterSpacing: 1,
    });
    this.readinessHeading = this.scene.add.text(0, 0, "Mission Status", {
      fontSize: `${title.panelHeadingSize}px`,
      color: colors.textPrimary,
      fontStyle: "bold",
    });

    this.leftRule = this.scene.add
      .line(0, 0, 0, 0, 0, 0, colors.cardEdge, 0.18)
      .setLineWidth(2)
      .setDepth(2);
    this.rightRule = this.scene.add
      .line(0, 0, 0, 0, 0, 0, colors.cardEdge, 0.18)
      .setLineWidth(2)
      .setDepth(2);
    this.centerTopRule = this.scene.add
      .line(0, 0, 0, 0, 0, 0, colors.cardEdge, 0.14)
      .setLineWidth(2)
      .setDepth(2);
    this.centerBottomRule = this.scene.add
      .line(0, 0, 0, 0, 0, 0, colors.cardEdge, 0.1)
      .setLineWidth(2)
      .setDepth(2);

    this.gridCaption = this.scene.add.text(0, 0, "Drag modules into the assembly area or click an empty cell to place the selected item.", {
      fontSize: `${this.theme.fontSizes.caption}px`,
      color: colors.textMuted,
    });
  }

  updateLayout(layout, grid) {
    this.layout = layout;
    this.grid = grid;

    const { spacing, panel } = this.theme;
    const {
      width,
      outerPadding,
      panelTop,
      panelY,
      panelHeight,
      leftPanelX,
      leftPanelY,
      leftPanelHeight,
      leftPanelWidth,
      rightPanelX,
      rightPanelY,
      rightPanelHeight,
      rightPanelWidth,
      centerPanelX,
      centerPanelY,
      centerPanelWidth,
      centerPanelHeight,
      centerStartX,
    } = layout;
    const resolvedLeftPanelY = leftPanelY ?? panelY;
    const resolvedLeftPanelHeight = leftPanelHeight ?? panelHeight;
    const resolvedRightPanelY = rightPanelY ?? panelY;
    const resolvedRightPanelHeight = rightPanelHeight ?? panelHeight;
    const resolvedCenterPanelY =
      centerPanelY ?? grid.y + layout.gridHeight / 2 + 10;

    this.updatePanel(
      this.leftPanelGlow,
      this.leftPanelShadow,
      this.leftPanel,
      this.leftPanelInset,
      this.leftHeaderBar,
      leftPanelX,
      resolvedLeftPanelY,
      leftPanelWidth,
      resolvedLeftPanelHeight,
    );
    this.updatePanel(
      this.centerPanelGlow,
      this.centerPanelShadow,
      this.centerPanel,
      this.centerPanelInset,
      this.centerHeaderBar,
      centerPanelX,
      resolvedCenterPanelY,
      centerPanelWidth,
      centerPanelHeight,
    );
    this.updatePanel(
      this.rightPanelGlow,
      this.rightPanelShadow,
      this.rightPanel,
      this.rightPanelInset,
      this.rightHeaderBar,
      rightPanelX,
      resolvedRightPanelY,
      rightPanelWidth,
      resolvedRightPanelHeight,
    );

    if (layout.mobileLayout) {
      const leftPanelTop = resolvedLeftPanelY - resolvedLeftPanelHeight / 2;
      const rightPanelTop = resolvedRightPanelY - resolvedRightPanelHeight / 2;
      const centerPanelTop = resolvedCenterPanelY - centerPanelHeight / 2;
      const headerInset = spacing.md;

      this.gridLabel.setPosition(centerPanelX - centerPanelWidth / 2 + headerInset, centerPanelTop + 8);
      this.gridHeading.setPosition(centerPanelX - centerPanelWidth / 2 + headerInset, centerPanelTop + 22);
      this.readinessLabel.setPosition(rightPanelX - rightPanelWidth / 2 + headerInset, rightPanelTop + 8);
      this.readinessHeading.setPosition(rightPanelX - rightPanelWidth / 2 + headerInset, rightPanelTop + 22);
      this.partsLabel.setPosition(leftPanelX - leftPanelWidth / 2 + headerInset, leftPanelTop + 8);
      this.partsHeading.setPosition(leftPanelX - leftPanelWidth / 2 + headerInset, leftPanelTop + 22);

      this.leftRule.setTo(
        leftPanelX,
        leftPanelTop + panel.headerHeight - 2,
        -leftPanelWidth / 2 + spacing.md,
        0,
        leftPanelWidth / 2 - spacing.md,
        0,
      );
      this.rightRule.setTo(
        rightPanelX,
        rightPanelTop + panel.headerHeight - 2,
        -rightPanelWidth / 2 + spacing.md,
        0,
        rightPanelWidth / 2 - spacing.md,
        0,
      );
    } else {
      const headingY = panelTop - 2;
      const subheadingY = headingY - spacing.md;
      this.partsLabel.setPosition(outerPadding + spacing.md, subheadingY);
      this.partsHeading.setPosition(outerPadding + spacing.md, headingY);

      this.gridLabel.setPosition(centerStartX + spacing.md, subheadingY);
      this.gridHeading.setPosition(centerStartX + spacing.md, headingY);

      this.readinessLabel.setPosition(
        width - outerPadding - rightPanelWidth + spacing.md,
        subheadingY,
      );
      this.readinessHeading.setPosition(
        width - outerPadding - rightPanelWidth + spacing.md,
        headingY,
      );

      this.leftRule.setTo(
        leftPanelX,
        panelTop - 12,
        -leftPanelWidth / 2 + spacing.md,
        0,
        leftPanelWidth / 2 - spacing.md,
        0,
      );
      this.rightRule.setTo(
        rightPanelX,
        panelTop - 12,
        -rightPanelWidth / 2 + spacing.md,
        0,
        rightPanelWidth / 2 - spacing.md,
        0,
      );
    }
    this.centerTopRule.setTo(
      centerPanelX,
      grid.y - spacing.md,
      -centerPanelWidth / 2 + spacing.lg,
      0,
      centerPanelWidth / 2 - spacing.lg,
      0,
    );
    this.centerBottomRule.setTo(
      centerPanelX,
      grid.y + layout.gridHeight + spacing.lg,
      -centerPanelWidth / 2 + spacing.lg,
      0,
      centerPanelWidth / 2 - spacing.lg,
      0,
    );
    this.gridCaption.setPosition(centerStartX + spacing.md, grid.y + layout.gridHeight + spacing.sm);
  }

  updatePanel(glow, shadow, panelRect, insetRect, headerBar, x, y, width, height) {
    const { spacing, panel: panelTheme, colors } = this.theme;

    glow.setPosition(x, y);
    glow.setSize(width + spacing.xs, height + spacing.xs);
    shadow.setPosition(x, y + 3);
    shadow.setSize(width, height);
    panelRect.setPosition(x, y);
    panelRect.setSize(width, height);
    insetRect.setPosition(x, y + panelTheme.headerHeight / 2 + spacing.sm);
    insetRect.setSize(width - spacing.md, height - panelTheme.headerHeight - spacing.md);
    headerBar.setPosition(x, y - height / 2 + panelTheme.headerHeight / 2);
    headerBar.setSize(width, panelTheme.headerHeight);
    headerBar.setStrokeStyle(1, colors.panelDivider, 0.26);
  }
}
