export default class BuildToast {
  constructor(scene, { layout, theme }) {
    this.scene = scene;
    this.layout = layout;
    this.theme = theme;

    const { colors, toast, spacing, status } = theme;

    this.root = scene.add.container(layout.messageX, layout.messageY).setDepth(theme.depth.toast);
    this.shadow = scene.add
      .rectangle(0, 3, layout.toastWidth, toast.height, colors.shadow, 0.32)
      .setStrokeStyle(2, colors.cardEdge, 0.08);
    this.background = scene.add
      .rectangle(0, 0, layout.toastWidth, toast.height, status.neutral.fill, theme.alpha.toastFill)
      .setStrokeStyle(2, status.neutral.stroke, 0.32);
    this.accent = scene.add.rectangle(
      -layout.toastWidth / 2 + spacing.sm,
      0,
      6,
      toast.height - spacing.sm,
      status.neutral.stroke,
      0.96,
    );
    this.label = scene.add
      .text(-layout.toastWidth / 2 + spacing.lg, -toast.height / 2 + spacing.xs, "NOTICE", {
        fontSize: `${toast.labelSize}px`,
        color: colors.textMuted,
        fontStyle: "bold",
        letterSpacing: 0.8,
      })
      .setOrigin(0, 0);
    this.text = scene.add
      .text(-layout.toastWidth / 2 + spacing.lg, 2, "", {
        fontSize: `${toast.fontSize}px`,
        color: colors.textToast,
        wordWrap: { width: layout.toastWidth - spacing.xxl },
      })
      .setOrigin(0, 0.5);

    this.root.add([this.shadow, this.background, this.accent, this.label, this.text]);
    this.root.setVisible(false);
    this.root.setAlpha(0);
  }

  updateLayout(layout) {
    this.layout = layout;
    this.root.setPosition(layout.messageX, layout.messageY);
    this.shadow.setSize(layout.toastWidth, this.theme.toast.height);
    this.background.setSize(layout.toastWidth, this.theme.toast.height);
    this.accent.setPosition(
      -layout.toastWidth / 2 + this.theme.spacing.sm,
      0,
    );
    this.text.setWordWrapWidth(layout.toastWidth - this.theme.spacing.xxl);
    this.label.setX(-layout.toastWidth / 2 + this.theme.spacing.lg);
    this.text.setX(-layout.toastWidth / 2 + this.theme.spacing.lg);
  }

  show(message) {
    this.text.setText(message);
    this.scene.tweens.killTweensOf(this.root);
    this.root.setVisible(true);
    this.root.setAlpha(0);
    this.root.setY(this.layout.messageY + 8);
    this.scene.tweens.add({
      targets: this.root,
      alpha: 1,
      y: this.layout.messageY,
      duration: 150,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.root,
          alpha: 0,
          delay: 1400,
          duration: 300,
          ease: "Quad.easeIn",
          onComplete: () => this.root.setVisible(false),
        });
      },
    });
  }
}
