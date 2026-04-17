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
      .rectangle(0, 0, 536, 136, 0x73f7c0, 0.06)
      .setScrollFactor(0)
      .setDepth(panelDepth - 1);
    this.bannerTrack = this.scene.add
      .rectangle(0, 0, 456, 8, 0x102233, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.bannerProgress = this.scene.add
      .rectangle(0, 0, 0, 8, 0x73f7c0, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(textDepth + 1);
    this.bannerChip = this.scene.add
      .text(0, 0, "", {
        fontSize: "12px",
        color: "#081624",
        backgroundColor: "#9ef6ca",
        padding: { left: 8, right: 8, top: 3, bottom: 3 },
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(textDepth + 1);
    this.bannerTitle = this.scene.add
      .text(0, 0, "", {
        fontSize: "26px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(textDepth + 1);
    this.bannerBody = this.scene.add
      .text(0, 0, "", {
        fontSize: "16px",
        color: "#d8f7ff",
        wordWrap: { width: 430 },
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(textDepth + 1);
    this.bannerStatus = this.scene.add
      .text(0, 0, "", {
        fontSize: "14px",
        color: "#8fd7ff",
        fontStyle: "bold",
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(textDepth + 1);

    this.leftHeading = this.scene.add
      .text(0, 0, "Flight Telemetry", {
        fontSize: "22px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.leftSubheading = this.scene.add
      .text(0, 0, "Core numbers that matter during ascent and orbit insertion.", {
        fontSize: "13px",
        color: "#8fd7ff",
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
      .text(0, 0, "Vehicle Resources", {
        fontSize: "18px",
        color: "#8fd7ff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.fuelBar = this.createStatusBar("Fuel Reserve", 0x73f7c0);
    this.throttleBar = this.createStatusBar("Throttle", 0xffd773);
    this.lockBar = this.createStatusBar("Orbit Lock", 0x68d9ff);

    this.rightHeading = this.scene.add
      .text(0, 0, "Guidance", {
        fontSize: "22px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.rightSubheading = this.scene.add
      .text(0, 0, "Stay ahead of the flight profile and the orbital corridor.", {
        fontSize: "13px",
        color: "#8fd7ff",
      })
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.guidanceCard = this.createCalloutCard();
    this.objectiveTitle = this.scene.add
      .text(0, 0, "Mission Targets", {
        fontSize: "18px",
        color: "#8fd7ff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.objectiveText = this.scene.add
      .text(0, 0, "", {
        fontSize: "15px",
        color: "#d8f7ff",
        lineSpacing: 7,
        wordWrap: { width: 276 },
      })
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.checklistTitle = this.scene.add
      .text(0, 0, "Mission Checklist", {
        fontSize: "18px",
        color: "#8fd7ff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(textDepth);
    this.checklistText = this.scene.add
      .text(0, 0, "", {
        fontSize: "15px",
        color: "#d8f7ff",
        lineSpacing: 7,
        wordWrap: { width: 276 },
      })
      .setScrollFactor(0)
      .setDepth(textDepth);

    this.engineButtonShadow = this.scene.add
      .rectangle(0, 0, 320, 72, 0x000000, 0.3)
      .setScrollFactor(0)
      .setDepth(textDepth - 1);
    this.engineButton = this.scene.add
      .rectangle(0, 0, 320, 72, 0x183c2d, 0.96)
      .setStrokeStyle(2, 0x73f7c0, 0.75)
      .setScrollFactor(0)
      .setDepth(textDepth)
      .setInteractive({ useHandCursor: true });
    this.engineButtonStatus = this.scene.add
      .text(0, 0, "Engine Offline", {
        fontSize: "12px",
        color: "#9ef6ca",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(textDepth + 1);
    this.engineButtonLabel = this.scene.add
      .text(0, 0, "Ignite Engine", {
        fontSize: "22px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(textDepth + 1);
    this.bottomHint = this.scene.add
      .text(0, 0, "W/S throttle  A/D steer  Shift max burn  RMB pan  Wheel zoom  H help  Esc hangar", {
        fontSize: "14px",
        color: "#8fd7ff",
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(textDepth);

    this.helpPanel = this.createPanel(0, 0, 520, 214, overlayDepth);
    this.helpTitle = this.scene.add
      .text(0, 0, "Flight Controls", {
        fontSize: "22px",
        color: "#effcff",
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
          "W / S      Raise or lower cruise throttle",
          "Shift      Full burn while held",
          "A / D      Steer the rocket",
          "RMB Drag   Pan the camera",
          "Wheel      Zoom in or out",
          "H          Toggle this help",
          "Esc        Return to the hangar",
        ].join("\n"),
        {
          fontSize: "16px",
          color: "#d8f7ff",
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
      this.engineButton.setStrokeStyle(2, 0x73f7c0, 1);
      this.scene.tweens.add({
        targets: [this.engineButton, this.engineButtonShadow],
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 120,
        ease: "Quad.easeOut",
      });
    });
    this.engineButton.on("pointerout", () => {
      this.engineButton.setStrokeStyle(2, 0x73f7c0, 0.75);
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
      .rectangle(x, y, width, height, 0x06111b, 0.97)
      .setOrigin(0)
      .setStrokeStyle(2, 0x68d9ff, 0.38)
      .setScrollFactor(0)
      .setDepth(depth);
  }

  createMetricCard(kicker, detail) {
    const shadow = this.scene.add
      .rectangle(0, 0, 96, 86, 0x000000, 0.2)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(40);
    const background = this.scene.add
      .rectangle(0, 0, 96, 86, 0x102233, 0.96)
      .setOrigin(0)
      .setStrokeStyle(1, 0x68d9ff, 0.18)
      .setScrollFactor(0)
      .setDepth(40);
    const kickerText = this.scene.add
      .text(0, 0, kicker, {
        fontSize: "12px",
        color: "#8fd7ff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(41);
    const value = this.scene.add
      .text(0, 0, "0", {
        fontSize: "26px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(41);
    const detailText = this.scene.add
      .text(0, 0, detail, {
        fontSize: "12px",
        color: "#bfdff4",
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
        fontSize: "14px",
        color: "#8fd7ff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(41);
    const valueText = this.scene.add
      .text(0, 0, "0%", {
        fontSize: "14px",
        color: "#effcff",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(41);
    const track = this.scene.add
      .rectangle(0, 0, 256, 12, 0x102233, 1)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, 0x68d9ff, 0.16)
      .setScrollFactor(0)
      .setDepth(40);
    const glow = this.scene.add
      .rectangle(0, 0, 0, 12, color, 0.1)
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
      .rectangle(0, 0, 288, 110, 0x102233, 0.98)
      .setOrigin(0)
      .setStrokeStyle(1, 0x68d9ff, 0.2)
      .setScrollFactor(0)
      .setDepth(40);
    const accent = this.scene.add
      .rectangle(0, 0, 6, 92, 0x73f7c0, 0.96)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(41);
    const title = this.scene.add
      .text(0, 0, "", {
        fontSize: "18px",
        color: "#effcff",
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(41);
    const body = this.scene.add
      .text(0, 0, "", {
        fontSize: "14px",
        color: "#d8f7ff",
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

    this.bannerChip.setFontSize(mobile ? 10 : 12);
    this.bannerTitle.setFontSize(mobile ? 17 : stacked ? 20 : compact ? 22 : 26);
    this.bannerBody.setFontSize(mobile ? 12 : stacked ? 13 : compact ? 14 : 16);
    this.bannerStatus.setFontSize(mobile ? 11 : stacked ? 12 : compact ? 13 : 14);
    this.leftHeading.setFontSize(mobile ? 16 : stacked ? 18 : compact ? 19 : 22);
    this.leftSubheading.setFontSize(mobile ? 10 : 13);
    this.rightHeading.setFontSize(mobile ? 16 : stacked ? 18 : compact ? 19 : 22);
    this.rightSubheading.setFontSize(mobile ? 10 : 13);
    this.resourcesLabel.setFontSize(mobile ? 14 : stacked ? 16 : 18);
    this.objectiveTitle.setFontSize(mobile ? 14 : stacked ? 16 : 18);
    this.checklistTitle.setFontSize(mobile ? 14 : stacked ? 16 : 18);
    this.objectiveText.setFontSize(mobile ? 12 : stacked ? 12 : compact ? 13 : 15);
    this.checklistText.setFontSize(mobile ? 12 : stacked ? 12 : compact ? 13 : 15);
    this.guidanceCard.title.setFontSize(mobile ? 15 : stacked ? 16 : 18);
    this.guidanceCard.body.setFontSize(mobile ? 12 : stacked ? 12 : compact ? 13 : 14);
    this.engineButtonStatus.setFontSize(mobile ? 11 : 12);
    this.engineButtonLabel.setFontSize(mobile ? 18 : stacked ? 20 : 22);
    this.bottomHint.setFontSize(mobile ? 11 : 14);
    this.helpTitle.setFontSize(mobile ? 18 : 22);
    this.helpText.setFontSize(mobile ? 13 : 16);

    this.metricCards.forEach((card) => {
      card.kicker.setFontSize(mobile ? 10 : 12);
      card.value.setFontSize(mobile ? 15 : stacked ? 18 : compact ? 21 : 26);
      card.detail.setFontSize(mobile ? 9 : 12);
    });

    [this.fuelBar, this.throttleBar, this.lockBar].forEach((bar) => {
      bar.label.setFontSize(mobile ? 11 : 14);
      bar.value.setFontSize(mobile ? 11 : 14);
    });

    this.leftSubheading.setVisible(!mobile && !stacked);
    this.rightSubheading.setVisible(!mobile && !stacked);
    this.bottomHint.setVisible(!stacked);
  }

  getObjects() {
    return this.objects;
  }

  resize(width, height) {
    this.useStackedLayout =
      width < 1100 && (width < 760 || height > width * 0.9);
    this.isMobile = width < 760 || (width < 920 && height > width * 1.15);
    this.isCompact = this.useStackedLayout || width < 1240;
    this.applyResponsiveStyles();

    if (this.useStackedLayout) {
      const margin = this.isMobile ? 12 : 16;
      const topMargin = this.isMobile ? 10 : 14;
      const contentWidth = width - margin * 2;
      const bannerHeight = this.isMobile ? 110 : 118;
      const buttonHeight = this.isMobile ? 64 : 68;
      const panelGap = this.isMobile ? 10 : 12;
      const buttonBottomMargin = 12;
      const bannerToTelemetryGap = 10;
      const telemetryY = topMargin + bannerHeight + bannerToTelemetryGap;
      const buttonY = height - buttonHeight - buttonBottomMargin;
      const availablePanelHeight = Math.max(360, buttonY - telemetryY - panelGap - 12);
      const telemetryMinHeight = this.isMobile ? 250 : 290;
      const guidanceMinHeight = this.isMobile ? 210 : 240;
      const telemetryPreferred = this.isMobile ? 360 : 400;
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
      const cardGap = 10;
      const cardWidth = Math.floor((contentWidth - innerPad * 2 - 12) / 2);
      const cardHeight = this.isMobile ? 68 : 74;
      const telemetryHeaderY = telemetryY + 14;
      const cardsStartY = telemetryHeaderY + (this.isMobile ? 30 : 38);
      const resourceSectionY = cardsStartY + cardHeight * 3 + cardGap * 2 + 10;
      const guidanceHeaderY = guidanceY + 14;
      const guidanceCardY = guidanceHeaderY + 28;
      const guidanceCardHeight = this.isMobile ? 88 : 96;
      const objectiveTitleY = guidanceCardY + guidanceCardHeight + 12;
      const objectiveTextY = objectiveTitleY + 22;
      const checklistTitleY = objectiveTextY + (this.isMobile ? 82 : 92);
      const checklistTextY = checklistTitleY + 22;

      this.bannerGlow.setPosition(width / 2, topMargin + bannerHeight / 2).setSize(contentWidth + 12, bannerHeight + 12);
      this.banner.setPosition(margin, topMargin).setSize(contentWidth, bannerHeight);
      this.bannerChip.setPosition(margin + 14, topMargin + 18);
      this.bannerTitle.setPosition(margin + 14, topMargin + 40);
      this.bannerBody.setPosition(margin + 14, topMargin + 56);
      this.bannerBody.setWordWrapWidth(contentWidth - 28);
      this.bannerStatus.setPosition(margin + 14, topMargin + bannerHeight - 28);
      this.bannerTrack.setPosition(margin + 14, topMargin + bannerHeight - 10).setSize(contentWidth - 28, 6);
      this.bannerProgress.setPosition(margin + 14, topMargin + bannerHeight - 10);

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
        card.kicker.setPosition(x + 10, y + 8);
        card.value.setPosition(x + 10, y + 25);
        card.detail.setPosition(x + 10, y + 50);
      });

      this.resourcesLabel.setPosition(margin + innerPad, resourceSectionY);
      this.layoutStatusBar(this.fuelBar, margin + innerPad, resourceSectionY + 16, contentWidth - innerPad * 2, 18, 10);
      this.layoutStatusBar(this.throttleBar, margin + innerPad, resourceSectionY + 38, contentWidth - innerPad * 2, 18, 10);
      this.layoutStatusBar(this.lockBar, margin + innerPad, resourceSectionY + 60, contentWidth - innerPad * 2, 18, 10);

      this.rightPanel.setPosition(margin, guidanceY).setSize(contentWidth, guidanceHeight);
      this.rightHeading.setPosition(margin + innerPad, guidanceHeaderY);
      this.rightSubheading.setPosition(margin + innerPad, guidanceHeaderY + 20);
      this.guidanceCard.background.setPosition(margin + innerPad, guidanceCardY).setSize(contentWidth - innerPad * 2, guidanceCardHeight);
      this.guidanceCard.accent.setPosition(margin + innerPad, guidanceCardY + 8).setSize(5, guidanceCardHeight - 16);
      this.guidanceCard.title.setPosition(margin + innerPad + 12, guidanceCardY + 10);
      this.guidanceCard.body.setPosition(margin + innerPad + 12, guidanceCardY + 32);
      this.guidanceCard.body.setWordWrapWidth(contentWidth - innerPad * 2 - 22);
      this.objectiveTitle.setPosition(margin + innerPad, objectiveTitleY);
      this.objectiveText.setPosition(margin + innerPad, objectiveTextY);
      this.objectiveText.setWordWrapWidth(contentWidth - innerPad * 2);
      this.checklistTitle.setPosition(margin + innerPad, checklistTitleY);
      this.checklistText.setPosition(margin + innerPad, checklistTextY);
      this.checklistText.setWordWrapWidth(contentWidth - innerPad * 2);

      this.engineButtonShadow.setPosition(margin + 2, buttonY + 3).setSize(contentWidth, buttonHeight);
      this.engineButton.setPosition(margin, buttonY).setSize(contentWidth, buttonHeight);
      this.engineButtonStatus.setPosition(margin + 14, buttonY + 18);
      this.engineButtonLabel.setPosition(margin + 14, buttonY + 42);
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

    const margin = this.isCompact ? 18 : 24;
    const topMargin = this.isCompact ? 14 : 18;
    const leftWidth = Math.min(this.isCompact ? 300 : 320, Math.max(260, Math.floor(width * 0.24)));
    const rightWidth = Math.min(this.isCompact ? 304 : 320, Math.max(270, Math.floor(width * 0.25)));
    const leftX = margin;
    const rightX = width - margin - rightWidth;
    const leftPanelY = 154;
    const rightPanelY = 154;
    const leftPanelHeight = this.isCompact ? 470 : 500;
    const rightPanelHeight = this.isCompact ? 452 : 492;

    this.leftPanel.setPosition(leftX, leftPanelY).setSize(leftWidth, leftPanelHeight);
    this.rightPanel.setPosition(rightX, rightPanelY).setSize(rightWidth, rightPanelHeight);

    const bannerWidth = Math.min(this.isCompact ? 500 : 560, Math.max(360, width - leftWidth - rightWidth - 100));
    const bannerHeight = this.isCompact ? 110 : 120;
    const bannerX = (width - bannerWidth) / 2;
    this.bannerGlow.setPosition(width / 2, topMargin + bannerHeight / 2).setSize(bannerWidth + 24, bannerHeight + 16);
    this.banner.setPosition(bannerX, topMargin).setSize(bannerWidth, bannerHeight);
    this.bannerChip.setPosition(bannerX + 18, topMargin + 20);
    this.bannerTitle.setPosition(bannerX + 18, topMargin + 46);
    this.bannerBody.setPosition(bannerX + 18, topMargin + 64);
    this.bannerBody.setWordWrapWidth(bannerWidth - 38);
    this.bannerStatus.setPosition(bannerX + 18, topMargin + (this.isCompact ? 90 : 96));
    this.bannerTrack.setPosition(bannerX + 18, topMargin + bannerHeight - 6).setSize(bannerWidth - 36, 8);
    this.bannerProgress.setPosition(bannerX + 18, topMargin + bannerHeight - 6);

    const leftInnerTop = leftPanelY + 20;
    const rightInnerTop = rightPanelY + 20;

    this.leftHeading.setPosition(leftX + 16, leftInnerTop);
    this.leftSubheading.setPosition(leftX + 16, leftInnerTop + 30);

    const cardWidth = Math.floor((leftWidth - 48) / 2);
    const cardHeight = this.isCompact ? 74 : 84;
    this.metricCards.forEach((card, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = leftX + 16 + column * (cardWidth + 12);
      const y = 236 + row * (cardHeight + 12);
      card.shadow.setPosition(x, y + 2).setSize(cardWidth, cardHeight);
      card.background.setPosition(x, y).setSize(cardWidth, cardHeight);
      card.kicker.setPosition(x + 12, y + 9);
      card.value.setPosition(x + 12, y + (this.isCompact ? 24 : 28));
      card.detail.setPosition(x + 12, y + (this.isCompact ? 54 : 62));
    });

    const telemetryBaseY = this.isCompact ? 474 : 506;
    this.resourcesLabel.setPosition(leftX + 16, telemetryBaseY);
    this.layoutStatusBar(this.fuelBar, leftX + 16, telemetryBaseY + 28, leftWidth - 32, 24, 12);
    this.layoutStatusBar(this.throttleBar, leftX + 16, telemetryBaseY + 64, leftWidth - 32, 24, 12);
    this.layoutStatusBar(this.lockBar, leftX + 16, telemetryBaseY + 100, leftWidth - 32, 24, 12);

    this.rightHeading.setPosition(rightX + 16, rightInnerTop);
    this.rightSubheading.setPosition(rightX + 16, rightInnerTop + 30);
    this.guidanceCard.background.setPosition(rightX + 16, 236).setSize(rightWidth - 32, this.isCompact ? 104 : 116);
    this.guidanceCard.accent.setPosition(rightX + 16, 244).setSize(6, this.isCompact ? 88 : 92);
    this.guidanceCard.title.setPosition(rightX + 32, 246);
    this.guidanceCard.body.setPosition(rightX + 32, 272);
    this.guidanceCard.body.setWordWrapWidth(rightWidth - 58);
    this.objectiveTitle.setPosition(rightX + 16, this.isCompact ? 350 : 370);
    this.objectiveText.setPosition(rightX + 16, this.isCompact ? 374 : 398);
    this.objectiveText.setWordWrapWidth(rightWidth - 32);
    this.checklistTitle.setPosition(rightX + 16, this.isCompact ? 458 : 490);
    this.checklistText.setPosition(rightX + 16, this.isCompact ? 482 : 518);
    this.checklistText.setWordWrapWidth(rightWidth - 32);

    const buttonWidth = Math.min(340, Math.max(260, Math.floor(width * 0.26)));
    const buttonHeight = this.isCompact ? 66 : 72;
    this.engineButtonShadow.setPosition(margin + 2, height - (buttonHeight + 18) + 3).setSize(buttonWidth, buttonHeight);
    this.engineButton.setPosition(margin, height - (buttonHeight + 18)).setSize(buttonWidth, buttonHeight);
    this.engineButtonStatus.setPosition(margin + 18, height - (buttonHeight + 18) + 20);
    this.engineButtonLabel.setPosition(margin + 18, height - (buttonHeight + 18) + 44);
    this.bottomHint
      .setPosition(width / 2, height - 18)
      .setWordWrapWidth(width - margin * 2)
      .setText("W/S throttle  A/D steer  Shift max burn  RMB pan  Wheel zoom  H help  Esc hangar");

    const helpWidth = Math.min(520, Math.max(360, width - 80));
    this.helpPanel
      .setPosition(width / 2 - helpWidth / 2, height - 258)
      .setSize(helpWidth, 214);
    this.helpTitle.setPosition(width / 2, height - 236);
    this.helpText.setPosition(width / 2 - helpWidth / 2 + 28, height - 202);
  }

  layoutStatusBar(bar, x, y, width, trackOffset = 24, trackHeight = 12) {
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
        ? 0x73f7c0
        : state.result === "failure"
          ? 0xff8d8d
          : 0x68d9ff;
    this.bannerChip.setText(meta.label.toUpperCase());
    this.bannerGlow.setFillStyle(flashColor, 0.08);
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

    this.bannerTitle.setText(phaseMeta.title);
    this.bannerBody.setText(phaseMeta.message);
    this.bannerStatus.setText(phaseMeta.status);
    this.bannerProgress.setSize(
      (this.bannerTrack.width || 0) * clamp(phaseMeta.index / phaseMeta.total, 0, 1),
      this.bannerTrack.height || 8,
    );

    const metricValues = [
      {
        value: `${state.altitude.toFixed(1)} km`,
        detail: state.altitude >= FLIGHT_WORLD.atmosphereHeight ? (mobile ? "Atmosphere clear" : "Clear of dense atmosphere") : (mobile ? "Climbing" : "Climbing through atmosphere"),
      },
      {
        value: `${state.speed.toFixed(2)} km/s`,
        detail: mobile ? "Velocity" : "Total velocity",
      },
      {
        value: `${formatSigned(state.verticalVelocity, 2)} km/s`,
        detail: state.verticalVelocity >= 0 ? (mobile ? "Upward" : "Upward climb rate") : "Descending",
      },
      {
        value: `${formatSigned(state.horizontalVelocity, 2)} km/s`,
        detail: mobile ? "Lateral" : "Sideways orbital speed",
      },
      {
        value: `${formatSigned(pitch, 0)} deg`,
        detail: mobile ? "Pitch" : "Rocket pitch relative to horizon",
      },
      {
        value: `${state.currentG.toFixed(1)} g`,
        detail: state.currentG > 4 ? (mobile ? "High load" : "High stress load") : (mobile ? "Nominal" : "Nominal load"),
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
    this.guidanceCard.title.setText(mobile ? "Callout" : "Immediate Callout");
    this.guidanceCard.body.setText(
      mobile
        ? [
            phaseMeta.status,
            `Steer: ${steerHint}`,
            `Apo offset: ${corridorDelta.toFixed(1)} km`,
          ].join("\n")
        : [
            phaseMeta.status,
            "",
            `Steer cue: ${steerHint}`,
            `Predicted apoapsis offset: ${corridorDelta.toFixed(1)} km`,
          ].join("\n"),
    );
    this.guidanceCard.accent.setFillStyle(
      state.result === "failure"
        ? 0xff8d8d
        : state.phaseId === FLIGHT_PHASES.ORBIT
          ? 0x73f7c0
          : 0x68d9ff,
      0.96,
    );

    this.objectiveText.setText(
      mobile
        ? [
            `Target: ${FLIGHT_WORLD.targetOrbitAltitude} km / ${FLIGHT_TARGETS.orbitalVelocity.toFixed(2)} km/s`,
            `Apo: ${prediction.apoapsis.toFixed(1)} km`,
            `Peri: ${prediction.periapsis.toFixed(1)} km`,
            `Escape: ${FLIGHT_WORLD.earthEscapeAltitude} km`,
          ].join("\n")
        : [
            `Target altitude: ${FLIGHT_WORLD.targetOrbitAltitude} km`,
            `Target orbital speed: ${FLIGHT_TARGETS.orbitalVelocity.toFixed(2)} km/s`,
            `Pred apoapsis: ${prediction.apoapsis.toFixed(1)} km`,
            `Pred periapsis: ${prediction.periapsis.toFixed(1)} km`,
            `Escape ceiling: ${FLIGHT_WORLD.earthEscapeAltitude} km`,
          ].join("\n"),
    );

    this.checklistText.setText(
      mobile
        ? [
            `${state.launched ? "[x]" : "[ ]"} Liftoff`,
            `${state.altitude >= FLIGHT_WORLD.atmosphereHeight ? "[x]" : "[ ]"} Atmosphere`,
            `${Math.abs(state.horizontalVelocity) >= FLIGHT_TARGETS.orbitalVelocity * 0.72 ? "[x]" : "[ ]"} Lateral speed`,
            `${state.orbitHoldTime > 0.08 ? "[x]" : "[ ]"} Orbit lock`,
          ].join("\n")
        : [
            `${state.launched ? "[x]" : "[ ]"} Liftoff committed`,
            `${state.altitude >= FLIGHT_WORLD.atmosphereHeight ? "[x]" : "[ ]"} Atmosphere cleared`,
            `${Math.abs(state.horizontalVelocity) >= FLIGHT_TARGETS.orbitalVelocity * 0.72 ? "[x]" : "[ ]"} Lateral speed built`,
            `${prediction.apoapsis >= FLIGHT_WORLD.orbitMinAltitude ? "[x]" : "[ ]"} Apoapsis in orbital zone`,
            `${state.orbitHoldTime > 0.08 ? "[x]" : "[ ]"} Stable orbit lock started`,
          ].join("\n"),
    );

    if (state.engineOn) {
      this.engineButton.setFillStyle(0x5b1f1f, 0.96).setStrokeStyle(2, 0xff9b7a, 0.82);
      this.engineButtonStatus.setText("Engine Online");
      this.engineButtonStatus.setColor("#ffd9c9");
      this.engineButtonLabel.setText("Shutdown Engine");
    } else {
      this.engineButton.setFillStyle(0x183c2d, 0.96).setStrokeStyle(2, 0x73f7c0, 0.75);
      this.engineButtonStatus.setText("Engine Offline");
      this.engineButtonStatus.setColor("#9ef6ca");
      this.engineButtonLabel.setText(state.launched ? "Reignite Engine" : "Ignite Engine");
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
      return Math.abs(pitch) < 8 ? "Hold nearly vertical" : "Reduce steering and stand the rocket up";
    }
    if (state.phaseId === FLIGHT_PHASES.ASCENT) {
      return pitch < -8 ? "Pitch a little flatter" : "Keep the climb mostly vertical";
    }
    if (state.phaseId === FLIGHT_PHASES.GRAVITY_TURN) {
      return pitch > -28 ? "Lean further into the turn" : "Good turn angle, keep it smooth";
    }
    if (state.phaseId === FLIGHT_PHASES.ORBIT_PUSH) {
      return Math.abs(state.verticalVelocity) > 0.35 ? "Flatten out to gain sideways speed" : "Hold the shallow profile";
    }
    if (state.phaseId === FLIGHT_PHASES.ORBIT) {
      return "Stay almost level and avoid abrupt throttle changes";
    }
    return "Keep the stack under control";
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
          : "W/S throttle  A/D steer  Shift max burn  RMB pan  Wheel zoom  H help  Esc hangar",
    );
  }
}
