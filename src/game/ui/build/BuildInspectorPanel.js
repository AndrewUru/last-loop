export default class BuildInspectorPanel {
  constructor(scene, { layout, theme }) {
    this.scene = scene;
    this.layout = layout;
    this.theme = theme;

    this.root = scene.add.container(layout.inspectorPanelX, layout.inspectorPanelY);
    this.createShell();
    this.createStatCards();
    this.createIssueSection();
    this.update(null);
  }

  createShell() {
    const { colors, inspector, spacing, chips } = this.theme;

    this.sectionTitle = this.scene.add.text(0, 0, "Inspector", {
      fontSize: `${inspector.sectionTitleSize}px`,
      color: colors.textAccent,
    });
    this.cardShadow = this.scene.add
      .rectangle(
        this.layout.inspectorPanelWidth / 2,
        32 + this.layout.inspectorPanelHeight / 2 + 3,
        this.layout.inspectorPanelWidth,
        this.layout.inspectorPanelHeight - 32,
        colors.shadow,
        0.24,
      )
      .setStrokeStyle(2, colors.cardEdge, 0.08);
    this.cardBackground = this.scene.add
      .rectangle(
        this.layout.inspectorPanelWidth / 2,
        32 + this.layout.inspectorPanelHeight / 2,
        this.layout.inspectorPanelWidth,
        this.layout.inspectorPanelHeight - 32,
        colors.cardFill,
        0.96,
      )
      .setStrokeStyle(1, colors.cardEdge, 0.18);
    this.headerBackground = this.scene.add
      .rectangle(
        this.layout.inspectorPanelWidth / 2,
        32 + inspector.headerHeight / 2,
        this.layout.inspectorPanelWidth,
        inspector.headerHeight,
        colors.cardFillAlt,
        0.9,
      )
      .setStrokeStyle(1, colors.cardEdgeSoft, 0.16);
    this.accentStrip = this.scene.add.rectangle(
      spacing.sm,
      32 + inspector.headerHeight / 2,
      6,
      inspector.headerHeight - spacing.sm,
      colors.cardEdge,
      0.96,
    );

    this.nameText = this.scene.add.text(spacing.lg, 44, "", {
      fontSize: `${inspector.nameSize}px`,
      color: colors.textPrimary,
      fontStyle: "bold",
    });
    this.roleChip = this.scene.add
      .text(spacing.lg, 72, "", {
        fontSize: `${inspector.chipSize}px`,
        color: colors.chipText,
        backgroundColor: colors.chipFill,
        padding: chips.padding,
      })
      .setVisible(false);
    this.stateChip = this.scene.add
      .text(0, 72, "", {
        fontSize: `${inspector.chipSize}px`,
        color: colors.chipMutedText,
        backgroundColor: colors.chipMutedFill,
        padding: chips.padding,
      })
      .setVisible(false);
    this.descriptionText = this.scene.add.text(spacing.lg, 102, "", {
      fontSize: `${inspector.descriptionSize}px`,
      color: colors.textSecondary,
      wordWrap: { width: this.layout.inspectorPanelWidth - spacing.xxl },
    });
    this.locationText = this.scene.add.text(spacing.lg, 128, "", {
      fontSize: `${inspector.locationSize}px`,
      color: colors.textMuted,
    });

    this.root.add([
      this.sectionTitle,
      this.cardShadow,
      this.cardBackground,
      this.headerBackground,
      this.accentStrip,
      this.nameText,
      this.roleChip,
      this.stateChip,
      this.descriptionText,
      this.locationText,
    ]);
  }

  createStatCards() {
    const { colors, inspector, spacing } = this.theme;
    const cardWidth =
      (this.layout.inspectorPanelWidth - inspector.statGap * 2) / 3;
    const y = 32 + inspector.headerHeight + spacing.sm;

    this.statCards = ["Mass", "Fuel", "Thrust"].map((label, index) => {
      const x = index * (cardWidth + inspector.statGap);
      const shadow = this.scene.add
        .rectangle(cardWidth / 2, inspector.statCardHeight / 2 + 2, cardWidth, inspector.statCardHeight, colors.shadow, 0.16)
        .setStrokeStyle(1, colors.cardEdge, 0.05);
      const background = this.scene.add
        .rectangle(cardWidth / 2, inspector.statCardHeight / 2, cardWidth, inspector.statCardHeight, colors.cardFillAlt, 0.96)
        .setStrokeStyle(1, colors.cardEdge, 0.16);
      const labelText = this.scene.add.text(spacing.sm, spacing.xs, label, {
        fontSize: `${inspector.statLabelSize}px`,
        color: colors.textMuted,
      });
      const valueText = this.scene.add.text(spacing.sm, spacing.sm + 10, "0", {
        fontSize: `${inspector.statValueSize}px`,
        color: colors.textPrimary,
        fontStyle: "bold",
      });
      const container = this.scene.add.container(x, y, [
        shadow,
        background,
        labelText,
        valueText,
      ]);

      this.root.add(container);
      return { valueText };
    });
  }

  createIssueSection() {
    const { colors, inspector, spacing } = this.theme;
    const issueTop =
      32 + inspector.headerHeight + spacing.sm + inspector.statCardHeight + spacing.lg;

    this.issueTitle = this.scene.add.text(0, issueTop, "Focused Issues", {
      fontSize: `${inspector.issueTitleSize}px`,
      color: colors.textAccent,
      fontStyle: "bold",
    });
    this.root.add(this.issueTitle);

    this.issueRows = Array.from({ length: 2 }, (_, index) => {
      const y = issueTop + spacing.lg + index * (inspector.issueRowHeight + inspector.issueGap);
      const background = this.scene.add
        .rectangle(
          this.layout.inspectorPanelWidth / 2,
          inspector.issueRowHeight / 2,
          this.layout.inspectorPanelWidth,
          inspector.issueRowHeight,
          colors.cardFillAlt,
          0.96,
        )
        .setStrokeStyle(1, colors.cardEdge, 0.14);
      const text = this.scene.add.text(spacing.sm, 9, "", {
        fontSize: `${inspector.issueRowSize}px`,
        color: colors.textSecondary,
        wordWrap: { width: this.layout.inspectorPanelWidth - spacing.xl },
      });
      const container = this.scene.add.container(0, y, [background, text]);

      this.root.add(container);
      return { container, background, text };
    });
  }

  update(model) {
    const { colors, status, focusState } = this.theme;

    if (!model) {
      this.accentStrip.setFillStyle(colors.cardEdge, 0.96);
      this.nameText.setText("Hover a part");
      this.roleChip.setVisible(false);
      this.stateChip.setVisible(false);
      this.descriptionText.setText(
        "Inspect any module to see its role, local stats, and any issues linked to it.",
      );
      this.locationText.setText("");
      this.statCards.forEach((card) => card.valueText.setText("-"));
      this.applyIssueRows([
        {
          message: "No module selected yet.",
          fillColor: status.neutral.fill,
          strokeColor: status.neutral.stroke,
          textColor: colors.textSecondary,
        },
      ]);
      return;
    }

    this.accentStrip.setFillStyle(model.partColor ?? colors.cardEdge, 0.96);
    this.nameText.setText(model.name);
    this.roleChip.setText(model.role.toUpperCase());
    this.roleChip.setVisible(true);
    this.stateChip.setText(model.stateLabel.toUpperCase());
    this.stateChip.setVisible(true);
    this.stateChip.setX(this.layout.inspectorPanelWidth - this.stateChip.width);
    this.stateChip.setBackgroundColor(model.stateColor || focusState.observed);
    this.descriptionText.setText(model.description);
    this.locationText.setText(model.gridLabel);
    this.statCards[0].valueText.setText(`${model.mass}`);
    this.statCards[1].valueText.setText(`${model.fuel}`);
    this.statCards[2].valueText.setText(`${model.thrust}`);

    const issueRows =
      model.issues.length > 0
        ? model.issues.slice(0, 2).map((issue) => ({
            message: issue.message,
            fillColor: issue.severity === "error" ? status.blocked.fill : status.caution.fill,
            strokeColor:
              issue.severity === "error" ? status.blocked.stroke : status.caution.stroke,
            textColor:
              issue.severity === "error" ? colors.textDanger : colors.textWarning,
          }))
        : [
            {
              message: "No direct issue on this module.",
              fillColor: status.ready.fill,
              strokeColor: status.ready.stroke,
              textColor: colors.textSuccess,
            },
          ];

    this.applyIssueRows(issueRows);
  }

  applyIssueRows(items) {
    this.issueRows.forEach((row, index) => {
      const item = items[index];
      if (!item) {
        row.container.setVisible(false);
        return;
      }

      row.container.setVisible(true);
      row.text.setText(item.message);
      row.text.setColor(item.textColor);
      row.background.setFillStyle(item.fillColor, 0.96);
      row.background.setStrokeStyle(1, item.strokeColor, 0.28);
    });
  }
}
