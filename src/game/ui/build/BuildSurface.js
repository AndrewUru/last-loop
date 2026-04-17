import Phaser from "phaser";

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
    const { width, height, titleX } = this.layout;
    const { colors, depth, stars, title } = this.theme;

    this.nebula = this.scene.add.graphics().setDepth(depth.background);
    this.nebula.fillGradientStyle(
      colors.backgroundTopLeft,
      colors.backgroundTopRight,
      colors.backgroundBottomRight,
      colors.backgroundBottomLeft,
      1,
    );
    this.nebula.fillRect(0, 0, width, height);
    this.nebula.fillStyle(colors.nebulaBlue, 0.18);
    this.nebula.fillCircle(width * 0.78, height * 0.18, 160);
    this.nebula.fillStyle(colors.nebulaOrange, 0.08);
    this.nebula.fillCircle(width * 0.22, height * 0.82, 220);

    for (let index = 0; index < stars.count; index += 1) {
      this.scene.add
        .circle(
          Phaser.Math.Between(0, width),
          Phaser.Math.Between(0, height),
          Phaser.Math.FloatBetween(stars.minRadius, stars.maxRadius),
          Phaser.Math.Between(0xb6dfff, 0xffffff),
          Phaser.Math.FloatBetween(stars.minAlpha, stars.maxAlpha),
        )
        .setDepth(depth.stars);
    }

    this.kickerText = this.scene.add.text(titleX, 26, "Assembly & Validation Deck", {
      fontSize: `${title.kickerSize}px`,
      color: colors.textSuccess,
      fontStyle: "bold",
      letterSpacing: 1.2,
    });
    this.headlineText = this.scene.add.text(titleX, 42, "Orbital Yard", {
      fontSize: `${title.headlineSize}px`,
      color: colors.textPrimary,
      fontStyle: "bold",
    });
    this.descriptionText = this.scene.add.text(
      titleX,
      88,
      "Drag modules onto the grid, rebalance the stack, then send it to orbit.",
      {
        fontSize: `${title.descriptionSize}px`,
        color: colors.textAccent,
      },
    );
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

    this.partsLabel = this.scene.add.text(0, 0, "Catalog", {
      fontSize: `${this.theme.fontSizes.caption}px`,
      color: colors.textAccent,
      fontStyle: "bold",
      letterSpacing: 1,
    });
    this.partsHeading = this.scene.add.text(0, 0, "Parts", {
      fontSize: `${title.panelHeadingSize - 1}px`,
      color: colors.textPrimary,
      fontStyle: "bold",
    });

    this.gridLabel = this.scene.add.text(0, 0, "Workbench", {
      fontSize: `${this.theme.fontSizes.caption}px`,
      color: colors.textAccent,
      fontStyle: "bold",
      letterSpacing: 1,
    });
    this.gridHeading = this.scene.add.text(0, 0, "Assembly Grid", {
      fontSize: `${title.panelHeadingSize - 1}px`,
      color: colors.textPrimary,
      fontStyle: "bold",
    });

    this.readinessLabel = this.scene.add.text(0, 0, "Systems", {
      fontSize: `${this.theme.fontSizes.caption}px`,
      color: colors.textAccent,
      fontStyle: "bold",
      letterSpacing: 1,
    });
    this.readinessHeading = this.scene.add.text(0, 0, "Flight Readiness", {
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

    this.gridCaption = this.scene.add.text(0, 0, "Drag modules onto the grid or click an empty cell to place the selected one.", {
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
      leftPanelWidth,
      rightPanelX,
      rightPanelWidth,
      centerPanelX,
      centerPanelWidth,
      centerPanelHeight,
      centerStartX,
    } = layout;

    this.updatePanel(
      this.leftPanelGlow,
      this.leftPanelShadow,
      this.leftPanel,
      this.leftPanelInset,
      this.leftHeaderBar,
      leftPanelX,
      panelY,
      leftPanelWidth,
      panelHeight,
    );
    this.updatePanel(
      this.centerPanelGlow,
      this.centerPanelShadow,
      this.centerPanel,
      this.centerPanelInset,
      this.centerHeaderBar,
      centerPanelX,
      grid.y + layout.gridHeight / 2 + 10,
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
      panelY,
      rightPanelWidth,
      panelHeight,
    );

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
