import { FLIGHT_TARGETS, FLIGHT_WORLD } from "../systems/FlightModel.js";
import { FLIGHT_PHASES, getPhaseMeta } from "../systems/FlightPhaseController.js";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatSigned(value, digits = 2) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}`;
}

function radToDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function formatOrbitDelta(value, target) {
  return formatSigned(value - target, 0);
}

export default class FlightHud {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.onEngineToggle = options.onEngineToggle;
    this.helpVisible = false;
    this.objects = [];
    this.currentPhaseId = null;
    this.useStackedLayout = false;
    this.isMobile = false;
    this.isCompact = false;
  }

  create() {
    const panelDepth = 40;
    const textDepth = 41;
    const overlayDepth = 60;
    const overlayTextDepth = 61;

    this.leftPanel = this.createPanel(0, 0, 320, 378, panelDepth);
    this.rightPanel = this.createPanel(0, 0, 320, 404, panelDepth);
    this.banner = this.createPanel(0, 0, 520, 120, panelDepth);
    this.bannerGlow = this.scene.add
      .rectangle(0, 0, 536, 136, 0xffffff, 0.035)
      .setScrollFactor(0)
      .setDepth(panelDepth - 1);
    this.bannerTrack = this.scene.add
      .rectangle(0, 0, 456, 6, 0x1a212a, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.bannerProgress = this.scene.add
      .rectangle(0, 0, 0, 6, 0x7fb7ff, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(textDepth + 1);
    this.bannerChip = this.scene.add
      .text(0, 0, "", {
        fontSize: "12px",
        color: "#eef4fb",
        backgroundColor: "#18212b",
        padding: { left: 8, right: 8, top: 3, bottom: 3 },
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(textDepth + 1);
    this.bannerTitle = this.scene.add
      .text(0, 0, "", {
        fontSize: "24px",
        color: "#f3f7fb",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(textDepth + 1);
    this.bannerBody = this.scene.add
      .text(0, 0, "", {
        fontSize: "15px",
        color: "#b8c7d6",
        wordWrap: { width: 430 },
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(textDepth + 1);
    this.bannerStatus = this.scene.add
      .text(0, 0, "", {
        fontSize: "13px",
        color: "#8fb2d2",
        fontStyle: "bold",
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(textDepth + 1);

    this.leftHeading = this.scene.add
      .text(0, 0, "Flight Data", {
        fontSize: "22px",
        color: "#f3f7fb",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.leftSubheading = this.scene.add
      .text(0, 0, "Core ascent and orbit numbers.", {
        fontSize: "13px",
        color: "#7c99b6",
      })
      .setScrollFactor(0)
      .setDepth(textDepth);

    this.metricCards = [
      this.createMetricCard("ALT", "Altitude"),
      this.createMetricCard("SPD", "Speed"),
      this.createMetricCard("VRT", "Vertical"),
      this.createMetricCard("HOR", "Horizontal"),
      this.createMetricCard("PIT", "Pitch"),
      this.createMetricCard("G", "Crew Load"),
    ];

    this.resourcesLabel = this.scene.add
      .text(0, 0, "Systems", {
        fontSize: "18px",
        color: "#d7e2ee",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.fuelBar = this.createStatusBar("Fuel Reserve", 0x73f7c0);
    this.throttleBar = this.createStatusBar("Throttle", 0xffd773);
    this.lockBar = this.createStatusBar("Orbit Lock", 0x68d9ff);

    this.rightHeading = this.scene.add
      .text(0, 0, "Mission", {
        fontSize: "22px",
        color: "#f3f7fb",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.rightSubheading = this.scene.add
      .text(0, 0, "Guidance, target orbit and mission checks.", {
        fontSize: "13px",
        color: "#7c99b6",
      })
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.guidanceCard = this.createCalloutCard();
    this.objectiveTitle = this.scene.add
      .text(0, 0, "Target Orbit", {
        fontSize: "18px",
        color: "#d7e2ee",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.objectiveText = this.scene.add
      .text(0, 0, "", {
        fontSize: "15px",
        color: "#d6e0ea",
        lineSpacing: 7,
        wordWrap: { width: 276 },
      })
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.checklistTitle = this.scene.add
      .text(0, 0, "Checklist", {
        fontSize: "18px",
        color: "#d7e2ee",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.checklistText = this.scene.add
      .text(0, 0, "", {
        fontSize: "15px",
        color: "#d6e0ea",
        lineSpacing: 7,
        wordWrap: { width: 276 },
      })
      .setScrollFactor(0)
      .setDepth(textDepth);

    this.engineButtonShadow = this.scene.add
      .rectangle(0, 0, 320, 72, 0x000000, 0.22)
      .setScrollFactor(0)
      .setDepth(textDepth - 1);
    this.engineButton = this.scene.add
      .rectangle(0, 0, 320, 72, 0x131a22, 0.96)
      .setStrokeStyle(2, 0x7ea3c7, 0.55)
      .setScrollFactor(0)
      .setDepth(textDepth)
      .setInteractive({ useHandCursor: true });
    this.engineButtonStatus = this.scene.add
      .text(0, 0, "Engine Idle", {
        fontSize: "12px",
        color: "#8fb2d2",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(textDepth + 1);
    this.engineButtonLabel = this.scene.add
      .text(0, 0, "Ignite", {
        fontSize: "22px",
        color: "#f3f7fb",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(textDepth + 1);
    this.bottomHint = this.scene.add
      .text(0, 0, "W/S throttle  A/D steer  Shift boost  RMB pan  Wheel zoom  H help", {
        fontSize: "14px",
        color: "#7c99b6",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(textDepth);

    this.helpPanel = this.createPanel(0, 0, 520, 254, overlayDepth);
    this.helpTitle = this.scene.add
      .text(0, 0, "Commands", {
        fontSize: "22px",
        color: "#f3f7fb",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(overlayTextDepth);
    this.helpText = this.scene.add
      .text(
        0,
        0,
        [
          "Space / F  Toggle engine",
          "G          Toggle stability assist",
          "W / S      Raise or lower cruise throttle",
          "0-4        Set cruise throttle preset",
          "Shift      Full burn while held",
          "A / D      Steer the rocket",
          "RMB Drag   Pan the camera",
          "Wheel      Zoom in or out",
          "H          Toggle this help",
          "Esc        Return to the hangar",
        ].join("\n"),
        {
          fontSize: "16px",
          color: "#d6e0ea",
          lineSpacing: 9,
          align: "left",
        },
      )
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(overlayTextDepth);
    this.helpPanel.setVisible(false);

    this.engineButton.on("pointerdown", () => this.onEngineToggle?.());
    this.engineButton.on("pointerover", () => {
      this.engineButton.setStrokeStyle(2, 0x9dc2e8, 0.95);
      this.scene.tweens.add({
        targets: [this.engineButton, this.engineButtonShadow],
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 120,
        ease: "Quad.easeOut",
      });
    });
    this.engineButton.on("pointerout", () => {
      this.engineButton.setStrokeStyle(2, 0x7ea3c7, 0.55);
      this.scene.tweens.add({
        targets: [this.engineButton, this.engineButtonShadow],
        scaleX: 1,
        scaleY: 1,
        duration: 120,
        ease: "Quad.easeOut",
      });
    });

    this.objects.push(
      this.leftPanel,
      this.rightPanel,
      this.banner,
      this.bannerGlow,
      this.bannerTrack,
      this.bannerProgress,
      this.bannerChip,
      this.bannerTitle,
      this.bannerBody,
      this.bannerStatus,
      this.leftHeading,
      this.leftSubheading,
      this.resourcesLabel,
      this.rightHeading,
      this.rightSubheading,
      this.objectiveTitle,
      this.objectiveText,
      this.checklistTitle,
      this.checklistText,
      this.engineButtonShadow,
      this.engineButton,
      this.engineButtonStatus,
      this.engineButtonLabel,
      this.bottomHint,
      this.helpPanel,
      this.helpTitle,
      this.helpText,
      this.guidanceCard.background,
      this.guidanceCard.accent,
      this.guidanceCard.title,
      this.guidanceCard.body,
    );

    this.metricCards.forEach((card) => {
      this.objects.push(card.shadow, card.background, card.kicker, card.value, card.detail);
    });
    [this.fuelBar, this.throttleBar, this.lockBar].forEach((bar) => {
      this.objects.push(
        bar.label,
        bar.value,
        bar.track,
        bar.fill,
        bar.glow,
      );
    });

    this.resize(this.scene.scale.width, this.scene.scale.height);
  }

  createPanel(x, y, width, height, depth = 40) {
    return this.scene.add
      .rectangle(x, y, width, height, 0x11171e, 0.72)
      .setOrigin(0)
      .setStrokeStyle(1, 0xa8b7c6, 0.18)
      .setScrollFactor(0)
      .setDepth(depth);
  }

  createMetricCard(kicker, detail) {
    const shadow = this.scene.add
      .rectangle(0, 0, 96, 86, 0x000000, 0.08)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(40);
    const background = this.scene.add
      .rectangle(0, 0, 96, 86, 0x181f28, 0.52)
      .setOrigin(0)
      .setStrokeStyle(1, 0xa8b7c6, 0.1)
      .setScrollFactor(0)
      .setDepth(40);
    const kickerText = this.scene.add
      .text(0, 0, kicker, {
        fontSize: "13px",
        color: "#9eb4ca",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(41);
    const value = this.scene.add
      .text(0, 0, "0", {
        fontSize: "30px",
        color: "#f7fbff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(41);
    const detailText = this.scene.add
      .text(0, 0, detail, {
        fontSize: "13px",
        color: "#9daebb",
      })
      .setScrollFactor(0)
      .setDepth(41);

    return {
      shadow,
      background,
      kicker: kickerText,
      value,
      detail: detailText,
    };
  }

  createStatusBar(label, color) {
    const labelText = this.scene.add
      .text(0, 0, label, {
        fontSize: "15px",
        color: "#d6e0ea",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(41);
    const valueText = this.scene.add
      .text(0, 0, "0%", {
        fontSize: "15px",
        color: "#f4f7fb",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(41);
    const track = this.scene.add
      .rectangle(0, 0, 256, 12, 0x1b242d, 0.78)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0xa8b7c6, 0.12)
      .setScrollFactor(0)
      .setDepth(40);
    const glow = this.scene.add
      .rectangle(0, 0, 0, 12, color, 0.12)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(40);
    const fill = this.scene.add
      .rectangle(0, 0, 0, 12, color, 0.92)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(41);

    return {
      label: labelText,
      value: valueText,
      track,
      glow,
      fill,
      color,
    };
  }

  createCalloutCard() {
    const background = this.scene.add
      .rectangle(0, 0, 288, 110, 0x181f28, 0.5)
      .setOrigin(0)
      .setStrokeStyle(1, 0xa8b7c6, 0.1)
      .setScrollFactor(0)
      .setDepth(40);
    const accent = this.scene.add
      .rectangle(0, 0, 4, 92, 0x7fb7ff, 0.92)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(41);
    const title = this.scene.add
      .text(0, 0, "", {
        fontSize: "18px",
        color: "#f3f7fb",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(41);
    const body = this.scene.add
      .text(0, 0, "", {
        fontSize: "14px",
        color: "#d6e0ea",
        lineSpacing: 6,
        wordWrap: { width: 246 },
      })
      .setScrollFactor(0)
      .setDepth(41);

    return { background, accent, title, body };
  }

  applyResponsiveStyles() {
    const mobile = this.isMobile;
    const compact = this.isCompact;
    const stacked = this.useStackedLayout;

    this.bannerChip.setFontSize(mobile ? 9 : 10);
    this.bannerTitle.setFontSize(mobile ? 16 : stacked ? 18 : compact ? 18 : 20);
    this.bannerBody.setFontSize(mobile ? 11 : stacked ? 12 : compact ? 12 : 13);
    this.bannerStatus.setFontSize(mobile ? 10 : stacked ? 11 : compact ? 11 : 12);
    this.leftHeading.setFontSize(mobile ? 15 : stacked ? 16 : compact ? 16 : 17);
    this.leftSubheading.setFontSize(mobile ? 10 : 11);
    this.rightHeading.setFontSize(mobile ? 15 : stacked ? 16 : compact ? 16 : 17);
    this.rightSubheading.setFontSize(mobile ? 10 : 11);
    this.resourcesLabel.setFontSize(mobile ? 13 : stacked ? 14 : 15);
    this.objectiveTitle.setFontSize(mobile ? 13 : stacked ? 14 : 15);
    this.checklistTitle.setFontSize(mobile ? 13 : stacked ? 14 : 15);
    this.objectiveText.setFontSize(mobile ? 11 : stacked ? 11 : compact ? 11 : 12);
    this.checklistText.setFontSize(mobile ? 11 : stacked ? 11 : compact ? 11 : 12);
    this.guidanceCard.title.setFontSize(mobile ? 13 : stacked ? 14 : 15);
    this.guidanceCard.body.setFontSize(mobile ? 11 : stacked ? 11 : compact ? 11 : 12);
    this.engineButtonStatus.setFontSize(mobile ? 10 : 11);
    this.engineButtonLabel.setFontSize(mobile ? 15 : stacked ? 17 : 18);
    this.bottomHint.setFontSize(mobile ? 10 : 11);
    this.helpTitle.setFontSize(mobile ? 18 : 22);
    this.helpText.setFontSize(mobile ? 13 : 16);

    this.metricCards.forEach((card) => {
      card.kicker.setFontSize(mobile ? 9 : 10);
      card.value.setFontSize(mobile ? 14 : stacked ? 16 : compact ? 17 : 19);
      card.detail.setFontSize(mobile ? 8 : 10);
    });

    [this.fuelBar, this.throttleBar, this.lockBar].forEach((bar) => {
      bar.label.setFontSize(mobile ? 10 : 11);
      bar.value.setFontSize(mobile ? 10 : 11);
    });

    this.leftSubheading.setVisible(false);
    this.rightSubheading.setVisible(false);
    this.bottomHint.setVisible(!mobile && !stacked);
  }

  getObjects() {
    return this.objects;
  }

  syncVisibilityForLayout() {
    if (this.isMobile) {
      this.objects.forEach((object) => object.setVisible(false));
      this.helpVisible = false;
      return false;
    }

    this.objects.forEach((object) => object.setVisible(true));
    this.leftSubheading.setVisible(false);
    this.rightSubheading.setVisible(false);
    this.bottomHint.setVisible(!this.useStackedLayout);
    this.helpPanel.setVisible(this.helpVisible);
    this.helpTitle.setVisible(this.helpVisible);
    this.helpText.setVisible(this.helpVisible);
    return true;
  }

  resize(width, height) {
    this.useStackedLayout =
      width < 1100 && (width < 760 || height > width * 0.9);
    this.isMobile = width < 760 || (width < 920 && height > width * 1.15);
    this.isCompact = this.useStackedLayout || width < 1240;
    this.applyResponsiveStyles();
    if (!this.syncVisibilityForLayout()) {
      return;
    }

    if (this.useStackedLayout) {
      const margin = this.isMobile ? 12 : 16;
      const topMargin = this.isMobile ? 10 : 14;
      const contentWidth = width - margin * 2;
      const bannerHeight = this.isMobile ? 86 : 92;
      const buttonHeight = this.isMobile ? 48 : 52;
      const panelGap = this.isMobile ? 10 : 12;
      const buttonBottomMargin = 12;
      const bannerToTelemetryGap = 10;
      const telemetryY = topMargin + bannerHeight + bannerToTelemetryGap;
      const buttonY = height - buttonHeight - buttonBottomMargin;
      const availablePanelHeight = Math.max(360, buttonY - telemetryY - panelGap - 12);
      const telemetryMinHeight = this.isMobile ? 220 : 246;
      const guidanceMinHeight = this.isMobile ? 180 : 196;
      const telemetryPreferred = this.isMobile ? 300 : 320;
      const panelContentHeight = Math.max(320, availablePanelHeight - panelGap);
      let telemetryHeight = clamp(
        Math.floor(panelContentHeight * 0.54),
        telemetryMinHeight,
        telemetryPreferred,
      );
      let guidanceHeight = panelContentHeight - telemetryHeight;
      if (guidanceHeight < guidanceMinHeight) {
        guidanceHeight = guidanceMinHeight;
        telemetryHeight = panelContentHeight - guidanceHeight;
      }
      const guidanceY = telemetryY + telemetryHeight + panelGap;
      const innerPad = this.isMobile ? 12 : 14;
      const cardGap = 8;
      const cardWidth = Math.floor((contentWidth - innerPad * 2 - 12) / 2);
      const cardHeight = this.isMobile ? 56 : 60;
      const telemetryHeaderY = telemetryY + 14;
      const cardsStartY = telemetryHeaderY + 28;
      const resourceSectionY = cardsStartY + cardHeight * 3 + cardGap * 2 + 8;
      const guidanceHeaderY = guidanceY + 14;
      const guidanceCardY = guidanceHeaderY + 24;
      const guidanceCardHeight = this.isMobile ? 72 : 78;
      const objectiveTitleY = guidanceCardY + guidanceCardHeight + 10;
      const objectiveTextY = objectiveTitleY + 18;
      const checklistTitleY = objectiveTextY + (this.isMobile ? 60 : 68);
      const checklistTextY = checklistTitleY + 18;

      this.bannerGlow.setPosition(width / 2, topMargin + bannerHeight / 2).setSize(contentWidth + 12, bannerHeight + 12);
      this.banner.setPosition(margin, topMargin).setSize(contentWidth, bannerHeight);
      this.bannerChip.setPosition(margin + 12, topMargin + 14);
      this.bannerTitle.setPosition(margin + 12, topMargin + 32);
      this.bannerBody.setPosition(margin + 12, topMargin + 44);
      this.bannerBody.setWordWrapWidth(contentWidth - 28);
      this.bannerStatus.setPosition(margin + 12, topMargin + bannerHeight - 20);
      this.bannerTrack.setPosition(margin + 12, topMargin + bannerHeight - 8).setSize(contentWidth - 24, 4);
      this.bannerProgress.setPosition(margin + 12, topMargin + bannerHeight - 8);

      this.leftPanel.setPosition(margin, telemetryY).setSize(contentWidth, telemetryHeight);
      this.leftHeading.setPosition(margin + innerPad, telemetryHeaderY);
      this.leftSubheading.setPosition(margin + innerPad, telemetryHeaderY + 20);

      this.metricCards.forEach((card, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = margin + innerPad + column * (cardWidth + 12);
        const y = cardsStartY + row * (cardHeight + cardGap);
        card.shadow.setPosition(x, y + 2).setSize(cardWidth, cardHeight);
        card.background.setPosition(x, y).setSize(cardWidth, cardHeight);
        card.kicker.setPosition(x + 8, y + 6);
        card.value.setPosition(x + 8, y + 21);
        card.detail.setPosition(x + 8, y + 40);
      });

      this.resourcesLabel.setPosition(margin + innerPad, resourceSectionY);
      this.layoutStatusBar(this.fuelBar, margin + innerPad, resourceSectionY + 12, contentWidth - innerPad * 2, 14, 10);
      this.layoutStatusBar(this.throttleBar, margin + innerPad, resourceSectionY + 30, contentWidth - innerPad * 2, 14, 10);
      this.layoutStatusBar(this.lockBar, margin + innerPad, resourceSectionY + 48, contentWidth - innerPad * 2, 14, 10);

      this.rightPanel.setPosition(margin, guidanceY).setSize(contentWidth, guidanceHeight);
      this.rightHeading.setPosition(margin + innerPad, guidanceHeaderY);
      this.rightSubheading.setPosition(margin + innerPad, guidanceHeaderY + 20);
      this.guidanceCard.background.setPosition(margin + innerPad, guidanceCardY).setSize(contentWidth - innerPad * 2, guidanceCardHeight);
      this.guidanceCard.accent.setPosition(margin + innerPad, guidanceCardY + 6).setSize(4, guidanceCardHeight - 12);
      this.guidanceCard.title.setPosition(margin + innerPad + 10, guidanceCardY + 8);
      this.guidanceCard.body.setPosition(margin + innerPad + 10, guidanceCardY + 26);
      this.guidanceCard.body.setWordWrapWidth(contentWidth - innerPad * 2 - 22);
      this.objectiveTitle.setPosition(margin + innerPad, objectiveTitleY);
      this.objectiveText.setPosition(margin + innerPad, objectiveTextY);
      this.objectiveText.setWordWrapWidth(contentWidth - innerPad * 2);
      this.checklistTitle.setPosition(margin + innerPad, checklistTitleY);
      this.checklistText.setPosition(margin + innerPad, checklistTextY);
      this.checklistText.setWordWrapWidth(contentWidth - innerPad * 2);

      this.engineButtonShadow.setPosition(margin + 2, buttonY + 3).setSize(contentWidth, buttonHeight);
      this.engineButton.setPosition(margin, buttonY).setSize(contentWidth, buttonHeight);
      this.engineButtonStatus.setPosition(margin + 12, buttonY + 14);
      this.engineButtonLabel.setPosition(margin + 12, buttonY + 31);
      this.bottomHint.setPosition(width / 2, height - 12).setWordWrapWidth(contentWidth).setText("");

      const helpWidth = width - 24;
      const helpHeight = Math.min(250, height - 80);
      this.helpPanel
        .setPosition(12, height - helpHeight - 18)
        .setSize(helpWidth, helpHeight);
      this.helpTitle.setPosition(width / 2, height - helpHeight - 2);
      this.helpText.setPosition(28, height - helpHeight + 26);
      return;
    }

    const margin = this.isCompact ? 14 : 18;
    const topMargin = this.isCompact ? 12 : 14;
    const leftWidth = Math.min(this.isCompact ? 220 : 236, Math.max(196, Math.floor(width * 0.18)));
    const rightWidth = Math.min(this.isCompact ? 230 : 248, Math.max(208, Math.floor(width * 0.19)));
    const leftX = margin;
    const rightX = width - margin - rightWidth;
    const leftPanelY = 144;
    const rightPanelY = 144;
    const leftPanelHeight = this.isCompact ? 312 : 332;
    const rightPanelHeight = this.isCompact ? 308 : 332;

    this.leftPanel.setPosition(leftX, leftPanelY).setSize(leftWidth, leftPanelHeight);
    this.rightPanel.setPosition(rightX, rightPanelY).setSize(rightWidth, rightPanelHeight);

    const bannerWidth = Math.min(this.isCompact ? 420 : 470, Math.max(300, width - leftWidth - rightWidth - 120));
    const bannerHeight = this.isCompact ? 82 : 88;
    const bannerX = (width - bannerWidth) / 2;
    this.bannerGlow.setPosition(width / 2, topMargin + bannerHeight / 2).setSize(bannerWidth + 24, bannerHeight + 16);
    this.banner.setPosition(bannerX, topMargin).setSize(bannerWidth, bannerHeight);
    this.bannerChip.setPosition(bannerX + 12, topMargin + 14);
    this.bannerTitle.setPosition(bannerX + 12, topMargin + 32);
    this.bannerBody.setPosition(bannerX + 12, topMargin + 44);
    this.bannerBody.setWordWrapWidth(bannerWidth - 24);
    this.bannerStatus.setPosition(bannerX + 12, topMargin + bannerHeight - 18);
    this.bannerTrack.setPosition(bannerX + 12, topMargin + bannerHeight - 8).setSize(bannerWidth - 24, 4);
    this.bannerProgress.setPosition(bannerX + 12, topMargin + bannerHeight - 8);

    const leftInnerTop = leftPanelY + 12;
    const rightInnerTop = rightPanelY + 12;

    this.leftHeading.setPosition(leftX + 16, leftInnerTop);
    this.leftSubheading.setPosition(leftX + 16, leftInnerTop + 30);

    const cardWidth = Math.floor((leftWidth - 38) / 2);
    const cardHeight = this.isCompact ? 48 : 52;
    this.metricCards.forEach((card, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = leftX + 10 + column * (cardWidth + 8);
      const y = leftPanelY + 42 + row * (cardHeight + 8);
      card.shadow.setPosition(x, y + 2).setSize(cardWidth, cardHeight);
      card.background.setPosition(x, y).setSize(cardWidth, cardHeight);
      card.kicker.setPosition(x + 8, y + 5);
      card.value.setPosition(x + 8, y + 19);
      card.detail.setPosition(x + 8, y + 34);
    });

    const telemetryBaseY = leftPanelY + 220;
    this.resourcesLabel.setPosition(leftX + 10, telemetryBaseY);
    this.layoutStatusBar(this.fuelBar, leftX + 10, telemetryBaseY + 16, leftWidth - 20, 14, 10);
    this.layoutStatusBar(this.throttleBar, leftX + 10, telemetryBaseY + 36, leftWidth - 20, 14, 10);
    this.layoutStatusBar(this.lockBar, leftX + 10, telemetryBaseY + 56, leftWidth - 20, 14, 10);

    this.rightHeading.setPosition(rightX + 10, rightInnerTop);
    this.rightSubheading.setPosition(rightX + 10, rightInnerTop + 24);
    this.guidanceCard.background.setPosition(rightX + 10, rightPanelY + 42).setSize(rightWidth - 20, this.isCompact ? 74 : 80);
    this.guidanceCard.accent.setPosition(rightX + 10, rightPanelY + 48).setSize(4, this.isCompact ? 62 : 68);
    this.guidanceCard.title.setPosition(rightX + 22, rightPanelY + 48);
    this.guidanceCard.body.setPosition(rightX + 22, rightPanelY + 66);
    this.guidanceCard.body.setWordWrapWidth(rightWidth - 34);
    this.objectiveTitle.setPosition(rightX + 10, rightPanelY + 132);
    this.objectiveText.setPosition(rightX + 10, rightPanelY + 150);
    this.objectiveText.setWordWrapWidth(rightWidth - 20);
    this.checklistTitle.setPosition(rightX + 10, rightPanelY + 212);
    this.checklistText.setPosition(rightX + 10, rightPanelY + 230);
    this.checklistText.setWordWrapWidth(rightWidth - 20);

    const buttonWidth = Math.min(170, Math.max(140, Math.floor(width * 0.11)));
    const buttonHeight = 46;
    this.engineButtonShadow.setPosition(margin + 2, height - (buttonHeight + 18) + 3).setSize(buttonWidth, buttonHeight);
    this.engineButton.setPosition(margin, height - (buttonHeight + 18)).setSize(buttonWidth, buttonHeight);
    this.engineButtonStatus.setPosition(margin + 10, height - (buttonHeight + 18) + 14);
    this.engineButtonLabel.setPosition(margin + 10, height - (buttonHeight + 18) + 29);
    this.bottomHint
      .setPosition(width / 2, height - 18)
      .setWordWrapWidth(width - margin * 2)
      .setText("W/S throttle  A/D steer  G assist  Shift boost  RMB pan  Wheel zoom");

    const helpWidth = Math.min(520, Math.max(360, width - 80));
    this.helpPanel
      .setPosition(width / 2 - helpWidth / 2, height - 298)
      .setSize(helpWidth, 254);
    this.helpTitle.setPosition(width / 2, height - 276);
    this.helpText.setPosition(width / 2 - helpWidth / 2 + 28, height - 242);
  }

  layoutStatusBar(bar, x, y, width, trackOffset = 24, trackHeight = 14) {
    bar.label.setPosition(x, y);
    bar.value.setPosition(x + width, y);
    bar.track.setPosition(x, y + trackOffset).setSize(width, trackHeight);
    bar.glow.setPosition(x, y + trackOffset).setSize(bar.glow.width, trackHeight);
    bar.fill.setPosition(x, y + trackOffset).setSize(bar.fill.width, trackHeight);
  }

  flashPhase(state) {
    const meta = getPhaseMeta(state.phaseId);
    const flashColor =
      state.phaseId === FLIGHT_PHASES.ORBIT
        ? 0x7bc48a
        : state.result === "failure"
          ? 0xff8d8d
          : 0x7fb7ff;
    this.bannerChip.setText(meta.label.toUpperCase());
    this.bannerGlow.setFillStyle(flashColor, 0.05);
    this.scene.tweens.killTweensOf(this.bannerGlow);
    this.scene.tweens.add({
      targets: this.bannerGlow,
      alpha: { from: 1, to: 0.42 },
      duration: 320,
      yoyo: true,
      ease: "Sine.easeInOut",
    });
    this.scene.tweens.add({
      targets: [this.banner, this.bannerChip],
      scaleX: 1.015,
      scaleY: 1.015,
      duration: 130,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  update(state, uiState) {
    const phaseMeta = getPhaseMeta(state.phaseId);
    const mobile = this.isMobile;
    if (this.currentPhaseId !== state.phaseId) {
      this.currentPhaseId = state.phaseId;
      this.flashPhase(state);
    }

    const fuelPct =
      uiState.stats.fuel > 0 ? clamp(state.fuelRemaining / uiState.stats.fuel, 0, 1) : 0;
    const orbitLockPct = clamp(
      state.orbitHoldTime / Math.max(FLIGHT_WORLD.orbitLockDuration, 0.001),
      0,
      1,
    );
    const prediction = uiState.predictionSummary || {
      apoapsis: state.apoapsis,
      periapsis: state.periapsis,
    };
    const pitch = radToDegrees(state.localOrientation) + 90;

    this.bannerTitle.setText(phaseMeta.title.toUpperCase());
    this.bannerBody.setText(phaseMeta.message);
    this.bannerStatus.setText(phaseMeta.status);
    this.bannerProgress.setSize(
      (this.bannerTrack.width || 0) * clamp(phaseMeta.index / phaseMeta.total, 0, 1),
      this.bannerTrack.height || 8,
    );

    const metricValues = [
      {
        value: `${state.altitude.toFixed(1)} km`,
        detail: state.altitude >= FLIGHT_WORLD.atmosphereHeight ? (mobile ? "Vacuum" : "Above dense atmosphere") : (mobile ? "Ascent" : "Atmospheric ascent"),
      },
      {
        value: `${state.speed.toFixed(2)} km/s`,
        detail: mobile ? "Velocity" : "Inertial velocity",
      },
      {
        value: `${formatSigned(state.verticalVelocity, 2)} km/s`,
        detail: state.verticalVelocity >= 0 ? (mobile ? "Climb" : "Vertical climb rate") : "Descent rate",
      },
      {
        value: `${formatSigned(state.horizontalVelocity, 2)} km/s`,
        detail: mobile ? "Lateral" : "Horizontal orbital speed",
      },
      {
        value: `${formatSigned(pitch, 0)} deg`,
        detail: mobile ? "Pitch" : "Vehicle pitch from horizon",
      },
      {
        value: `${state.currentG.toFixed(1)} g`,
        detail: state.currentG > 4 ? (mobile ? "Peak load" : "High acceleration load") : (mobile ? "Nominal" : "Nominal acceleration load"),
      },
    ];

    this.metricCards.forEach((card, index) => {
      card.value.setText(metricValues[index].value);
      card.detail.setText(metricValues[index].detail);
    });

    this.updateStatusBar(this.fuelBar, fuelPct, `${Math.round(fuelPct * 100)}%`);
    this.updateStatusBar(this.throttleBar, state.throttle, `${Math.round(state.throttle * 100)}%`);
    this.updateStatusBar(this.lockBar, orbitLockPct, `${state.orbitHoldTime.toFixed(1)} / ${FLIGHT_WORLD.orbitLockDuration}s`);

    const corridorDelta = Math.abs(prediction.apoapsis - FLIGHT_WORLD.targetOrbitAltitude);
    const steerHint = this.getSteerHint(state);
    const targetPitch = radToDegrees(state.assistTargetAngle ?? -Math.PI / 2);
    const autoThrottleActive = Boolean(uiState.controls?.autoThrottleActive);
    const assistLabel = state.assistEnabled
      ? autoThrottleActive
        ? "AUTO-CUTOFF"
        : "ON"
      : "OFF";
    this.guidanceCard.title.setText(mobile ? "Guidance" : "Flight Director");
    this.guidanceCard.body.setText(
      mobile
        ? [
          `SAS ${assistLabel}  target ${formatSigned(targetPitch, 0)} deg`,
          `Steer ${steerHint}`,
          `Apo ${corridorDelta.toFixed(1)} km off`,
        ].join("\n")
        : [
          `SAS ${assistLabel}  target pitch ${formatSigned(targetPitch, 0)} deg`,
          `Steer cue  ${steerHint}`,
          `Predicted apoapsis error  ${corridorDelta.toFixed(1)} km`,
        ].join("\n"),
    );
    this.guidanceCard.accent.setFillStyle(
      state.result === "failure"
        ? 0xff8d8d
        : state.phaseId === FLIGHT_PHASES.ORBIT
          ? 0x7bc48a
          : 0x7fb7ff,
      0.92,
    );

    const apoDelta = formatOrbitDelta(
      prediction.apoapsis,
      FLIGHT_WORLD.targetOrbitAltitude,
    );
    const periDelta = formatOrbitDelta(
      prediction.periapsis,
      FLIGHT_WORLD.targetOrbitAltitude,
    );
    const periapsisSafe = prediction.periapsis >= FLIGHT_WORLD.orbitMinAltitude;

    this.objectiveTitle.setText(mobile ? "Orbit" : "Orbit Shape");
    this.objectiveText.setText(
      mobile
        ? [
            `AP ${prediction.apoapsis.toFixed(0)} km (${apoDelta})`,
            `PE ${prediction.periapsis.toFixed(0)} km (${periDelta})`,
            `${periapsisSafe ? "PE safe" : "PE too low"}  target ${FLIGHT_WORLD.targetOrbitAltitude} km`,
          ].join("\n")
        : [
            `Apoapsis   ${prediction.apoapsis.toFixed(0)} km  ${apoDelta} km`,
            `Periapsis  ${prediction.periapsis.toFixed(0)} km  ${periDelta} km`,
            `Target     ${FLIGHT_WORLD.targetOrbitAltitude} km / ${FLIGHT_TARGETS.orbitalVelocity.toFixed(2)} km/s`,
            periapsisSafe
              ? "Periapsis is inside the orbital corridor"
              : "Raise periapsis before cutting throttle",
          ].join("\n"),
    );

    this.checklistText.setText(
      mobile
        ? [
            `${state.launched ? "[x]" : "[ ]"} Liftoff`,
            `${state.altitude >= FLIGHT_WORLD.atmosphereHeight ? "[x]" : "[ ]"} Clear air`,
            `${Math.abs(state.horizontalVelocity) >= FLIGHT_TARGETS.orbitalVelocity * 0.72 ? "[x]" : "[ ]"} Lateral speed`,
            `${state.orbitHoldTime > 0.08 ? "[x]" : "[ ]"} Orbit lock`,
          ].join("\n")
        : [
            `${state.launched ? "[x]" : "[ ]"} Liftoff confirmed`,
            `${state.altitude >= FLIGHT_WORLD.atmosphereHeight ? "[x]" : "[ ]"} Atmosphere cleared`,
            `${Math.abs(state.horizontalVelocity) >= FLIGHT_TARGETS.orbitalVelocity * 0.72 ? "[x]" : "[ ]"} Horizontal speed built`,
            `${state.orbitHoldTime > 0.08 ? "[x]" : "[ ]"} Orbit lock active`,
          ].join("\n"),
    );

    if (state.engineOn && autoThrottleActive) {
      this.engineButton.setFillStyle(0x122433, 0.96).setStrokeStyle(2, 0x68d9ff, 0.82);
      this.engineButtonStatus.setText("SAS Auto-Cutoff");
      this.engineButtonStatus.setColor("#9adfff");
      this.engineButtonLabel.setText("Engine Armed");
    } else if (state.engineOn) {
      this.engineButton.setFillStyle(0x2a1a12, 0.96).setStrokeStyle(2, 0xff9b5d, 0.82);
      this.engineButtonStatus.setText("Engine Active");
      this.engineButtonStatus.setColor("#ffcfb0");
      this.engineButtonLabel.setText("Cutoff");
    } else {
      this.engineButton.setFillStyle(0x131a22, 0.96).setStrokeStyle(2, 0x7ea3c7, 0.55);
      this.engineButtonStatus.setText("Engine Idle");
      this.engineButtonStatus.setColor("#8fb2d2");
      this.engineButtonLabel.setText(state.launched ? "Reignite" : "Ignite");
    }
  }

  updateStatusBar(bar, progress, label) {
    const clamped = clamp(progress, 0, 1);
    const width = bar.track.width || 0;
    bar.value.setText(label);
    bar.fill.width = width * clamped;
    bar.glow.width = width * clamped;
  }

  getSteerHint(state) {
    const pitch = radToDegrees(state.localOrientation) + 90;
    if (state.phaseId === FLIGHT_PHASES.PAD || state.phaseId === FLIGHT_PHASES.LIFTOFF) {
      return Math.abs(pitch) < 8 ? "hold near vertical" : "correct to vertical";
    }
    if (state.phaseId === FLIGHT_PHASES.ASCENT) {
      return pitch < -8 ? "pitch slightly flatter" : "maintain vertical climb";
    }
    if (state.phaseId === FLIGHT_PHASES.GRAVITY_TURN) {
      return pitch > -28 ? "lean deeper into turn" : "hold current turn";
    }
    if (state.phaseId === FLIGHT_PHASES.ORBIT_PUSH) {
      return Math.abs(state.verticalVelocity) > 0.35 ? "flatten for horizontal speed" : "hold shallow profile";
    }
    if (state.phaseId === FLIGHT_PHASES.ORBIT) {
      return "hold level, trim gently";
    }
    return "stabilize vehicle";
  }

  toggleHelp() {
    this.helpVisible = !this.helpVisible;
    this.helpPanel.setVisible(this.helpVisible);
    this.helpTitle.setVisible(this.helpVisible);
    this.helpText.setVisible(this.helpVisible);
    this.bottomHint.setText(
      this.helpVisible
        ? "H hide help  Esc hangar"
        : this.isMobile
          ? ""
          : "W/S throttle  A/D steer  G assist  Shift boost  RMB pan  Wheel zoom  H help",
    );
  }
}
