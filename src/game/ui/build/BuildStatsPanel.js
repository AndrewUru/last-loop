function getReadinessModel(theme, validation) {
  if (!validation.isValid) {
    return {
      label: "Blocked",
      title: "Launch blocked",
      body: `${validation.errors.length} error${validation.errors.length === 1 ? "" : "s"} prevent liftoff.`,
      tone: theme.status.blocked,
    };
  }

  if (validation.warnings.length > 0) {
    return {
      label: "Caution",
      title: "Ready with caution",
      body: `${validation.warnings.length} warning${validation.warnings.length === 1 ? "" : "s"} detected, but launch is allowed.`,
      tone: theme.status.caution,
    };
  }

  return {
    label: "Ready",
    title: "Ready to launch",
    body: "The current stack passes all pad checks.",
    tone: theme.status.ready,
  };
}

export default class BuildStatsPanel {
  constructor(scene, { layout, theme }) {
    this.scene = scene;
    this.layout = layout;
    this.theme = theme;

    this.root = scene.add.container(layout.statsPanelX, layout.statsPanelY);
    this.createReadinessCard();
    this.createStatCards();
    this.createProgressBars();
    this.createValidationLists();
  }

  createReadinessCard() {
    const { colors, stats, spacing, chips } = this.theme;
    const cardTop = spacing.lg;

    this.sectionTitle = this.scene.add.text(0, 0, "Readiness", {
      fontSize: `${stats.sectionTitleSize}px`,
      color: colors.textAccent,
    });
    this.readinessShadow = this.scene.add
      .rectangle(
        this.layout.statsPanelWidth / 2,
        cardTop + stats.readinessHeight / 2 + 3,
        this.layout.statsPanelWidth,
        stats.readinessHeight,
        colors.shadow,
        0.24,
      )
      .setStrokeStyle(2, colors.cardEdge, 0.08);
    this.readinessCard = this.scene.add
      .rectangle(
        this.layout.statsPanelWidth / 2,
        cardTop + stats.readinessHeight / 2,
        this.layout.statsPanelWidth,
        stats.readinessHeight,
        colors.successFill,
        0.96,
      )
      .setStrokeStyle(2, colors.successEdge, 0.46);
    this.readinessBadge = this.scene.add
      .text(this.layout.statsPanelWidth - spacing.md, cardTop + stats.badgeY, "", {
        fontSize: `${stats.badgeSize}px`,
        color: colors.textPrimary,
        backgroundColor: "#1c5746",
        padding: chips.padding,
      })
      .setOrigin(1, 0);
    this.readinessTitle = this.scene.add.text(spacing.md, cardTop + spacing.md, "", {
      fontSize: `${stats.readinessTitleSize}px`,
      color: colors.textPrimary,
      fontStyle: "bold",
    });
    this.readinessBody = this.scene.add.text(
      spacing.md,
      cardTop + spacing.md + 24,
      "",
      {
        fontSize: `${stats.readinessBodySize}px`,
        color: colors.textSecondary,
        wordWrap: { width: this.layout.statsPanelWidth - spacing.xl },
      },
    );

    this.root.add([
      this.sectionTitle,
      this.readinessShadow,
      this.readinessCard,
      this.readinessBadge,
      this.readinessTitle,
      this.readinessBody,
    ]);
  }

  createStatCards() {
    const { stats, colors, spacing } = this.theme;
    const cardWidth = (this.layout.statsPanelWidth - stats.cardGap * 2) / 3;
    const top = spacing.lg + stats.readinessHeight + spacing.xs;

    this.metricsLabel = this.scene.add.text(0, top - spacing.sm, "Stack Metrics", {
      fontSize: `${stats.listTitleSize}px`,
      color: colors.textAccent,
      fontStyle: "bold",
    });
    this.root.add(this.metricsLabel);

    this.statCards = Array.from({ length: 6 }, (_, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = column * (cardWidth + stats.cardGap);
      const y = top + row * (stats.cardHeight + stats.cardGap);
      const shadow = this.scene.add
        .rectangle(cardWidth / 2, stats.cardHeight / 2 + 2, cardWidth, stats.cardHeight, colors.shadow, 0.18)
        .setStrokeStyle(1, colors.cardEdge, 0.06);
      const background = this.scene.add
        .rectangle(cardWidth / 2, stats.cardHeight / 2, cardWidth, stats.cardHeight, colors.cardFill, 0.97)
        .setStrokeStyle(1, colors.cardEdge, 0.16);
      const label = this.scene.add.text(spacing.sm, spacing.xs, "", {
        fontSize: `${stats.cardLabelSize}px`,
        color: colors.textMuted,
      });
      const value = this.scene.add.text(spacing.sm, spacing.sm + 10, "", {
        fontSize: `${stats.cardValueSize}px`,
        color: colors.textPrimary,
        fontStyle: "bold",
      });
      const container = this.scene.add.container(x, y, [shadow, background, label, value]);
      this.root.add(container);
      return { label, value };
    });

    this.footprintText = this.scene.add.text(
      0,
      top + stats.cardHeight * 2 + stats.cardGap + spacing.sm,
      "",
      {
        fontSize: `${stats.cardSubValueSize}px`,
        color: colors.textSecondary,
      },
    );
    this.root.add(this.footprintText);
  }

  createProgressBars() {
    const { stats, colors, spacing } = this.theme;
    const top =
      spacing.lg +
      stats.readinessHeight +
      spacing.xs +
      stats.cardHeight * 2 +
      stats.cardGap +
      spacing.sm;

    this.balanceLabel = this.scene.add.text(0, top, "Flight Quality", {
      fontSize: `${stats.listTitleSize}px`,
      color: colors.textAccent,
      fontStyle: "bold",
    });
    this.root.add(this.balanceLabel);

    this.progressBars = [
      this.createProgressBar(top + spacing.lg, "Balance", colors.highlight),
      this.createProgressBar(top + spacing.lg + stats.barGap, "Stability", colors.warning),
    ];
  }

  createProgressBar(y, label, fillColor) {
    const { stats, colors, spacing, radii } = this.theme;
    const labelText = this.scene.add.text(0, y, label, {
      fontSize: `${stats.barLabelSize}px`,
      color: colors.textMuted,
      fontStyle: "bold",
    });
    const valueText = this.scene.add
      .text(this.layout.statsPanelWidth, y, "0%", {
        fontSize: `${stats.barLabelSize}px`,
        color: colors.textPrimary,
      })
      .setOrigin(1, 0);
    const trackY = y + spacing.md;
    const track = this.scene.add
      .rectangle(
        this.layout.statsPanelWidth / 2,
        trackY + stats.barHeight / 2,
        this.layout.statsPanelWidth,
        stats.barHeight,
        colors.cardFillMuted,
        1,
      )
      .setStrokeStyle(1, colors.cardEdge, 0.16);
    const fill = this.scene.add
      .rectangle(
        0,
        trackY + stats.barHeight / 2,
        0,
        stats.barHeight,
        fillColor,
        0.92,
      )
      .setOrigin(0, 0.5);

    this.root.add([labelText, valueText, track, fill]);
    return { valueText, fill };
  }

  createValidationLists() {
    const { stats, colors, spacing } = this.theme;
    const top =
      spacing.lg +
      stats.readinessHeight +
      spacing.xs +
      stats.cardHeight * 2 +
      stats.cardGap +
      spacing.sm +
      stats.barGap * 2 +
      spacing.xs;

    this.validationLabel = this.scene.add.text(0, top, "Validation Log", {
      fontSize: `${stats.listTitleSize}px`,
      color: colors.textAccent,
      fontStyle: "bold",
    });
    this.root.add(this.validationLabel);

    this.validationRows = Array.from({ length: 2 }, (_, index) => {
      const y = top + spacing.lg + index * (stats.issueRowHeight + stats.issueGap);
      const background = this.scene.add
        .rectangle(
          this.layout.statsPanelWidth / 2,
          stats.issueRowHeight / 2,
          this.layout.statsPanelWidth,
          stats.issueRowHeight,
          colors.cardFillAlt,
          0.96,
        )
        .setStrokeStyle(1, colors.cardEdge, 0.14);
      const tag = this.scene.add
        .text(spacing.sm, 9, "", {
          fontSize: `${this.theme.fontSizes.micro}px`,
          color: colors.textPrimary,
          backgroundColor: colors.chipMutedFill,
          padding: this.theme.chips.padding,
        })
        .setOrigin(0, 0);
      const text = this.scene.add.text(spacing.sm + 58, 9, "", {
        fontSize: `${stats.issueRowSize}px`,
        color: colors.textSecondary,
        wordWrap: { width: this.layout.statsPanelWidth - 72 },
      });
      const container = this.scene.add.container(0, y, [background, tag, text]);

      this.root.add(container);
      return { container, background, tag, text };
    });
  }

  update(validation) {
    const readiness = getReadinessModel(this.theme, validation);
    const cardValues = [
      { label: "Modules", value: validation.stats.partCount.toFixed(0) },
      { label: "Mass", value: validation.stats.mass.toFixed(0) },
      { label: "Fuel", value: validation.stats.fuel.toFixed(0) },
      { label: "Thrust", value: validation.stats.thrust.toFixed(0) },
      { label: "Burn", value: `${validation.stats.fuelUse.toFixed(2)}/s` },
      { label: "TWR", value: validation.stats.twr.toFixed(2) },
    ];

    this.readinessCard.setFillStyle(readiness.tone.fill, 0.96);
    this.readinessCard.setStrokeStyle(2, readiness.tone.stroke, 0.46);
    this.readinessBadge.setText(readiness.label.toUpperCase());
    this.readinessBadge.setBackgroundColor(readiness.tone.badgeFill);
    this.readinessBadge.setColor(readiness.tone.badgeText);
    this.readinessTitle.setText(readiness.title);
    this.readinessTitle.setColor(this.theme.colors.textPrimary);
    this.readinessBody.setText(readiness.body);

    this.statCards.forEach((card, index) => {
      card.label.setText(cardValues[index].label);
      card.value.setText(cardValues[index].value);
    });

    this.footprintText.setText(
      `Footprint ${validation.stats.width || 0}w x ${validation.stats.height || 0}h`,
    );

    [validation.stats.balanceScore, validation.stats.stability].forEach(
      (value, index) => {
        const clamped = Math.max(0, Math.min(1, value));
        this.progressBars[index].valueText.setText(
          `${Math.round(clamped * 100)}%`,
        );
        this.progressBars[index].fill.width = this.layout.statsPanelWidth * clamped;
      },
    );

    this.updateValidationRows(validation);
  }

  updateValidationRows(validation) {
    const { status, colors } = this.theme;
    const rows = [];

    validation.errors.slice(0, 1).forEach((message) => {
      rows.push({
        tag: "ERROR",
        tagFill: status.blocked.badgeFill,
        tagText: status.blocked.badgeText,
        fill: status.blocked.fill,
        stroke: status.blocked.stroke,
        text: colors.textDanger,
        message,
      });
    });
    validation.warnings.slice(0, 1).forEach((message) => {
      rows.push({
        tag: "WARN",
        tagFill: status.caution.badgeFill,
        tagText: status.caution.badgeText,
        fill: status.caution.fill,
        stroke: status.caution.stroke,
        text: colors.textWarning,
        message,
      });
    });

    if (rows.length === 0) {
      rows.push({
        tag: "OK",
        tagFill: status.ready.badgeFill,
        tagText: status.ready.badgeText,
        fill: status.ready.fill,
        stroke: status.ready.stroke,
        text: colors.textSuccess,
        message: "No validation errors or warnings.",
      });
    }

    this.validationRows.forEach((row, index) => {
      const item = rows[index];
      if (!item) {
        row.container.setVisible(false);
        return;
      }

      row.container.setVisible(true);
      row.tag.setText(item.tag);
      row.tag.setBackgroundColor(item.tagFill);
      row.tag.setColor(item.tagText);
      row.text.setText(item.message);
      row.text.setColor(item.text);
      row.background.setFillStyle(item.fill, 0.96);
      row.background.setStrokeStyle(1, item.stroke, 0.28);
    });
  }
}
