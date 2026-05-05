export default class BuildStatsPanel {
  constructor(scene, { layout }) {
    this.scene = scene;
    this.layout = layout;
    this.root = scene.add.container(layout.statsPanelX, layout.statsPanelY);

    this.statsText = scene.add
      .text(0, 0, "", {
        fontSize: "20px",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
        lineSpacing: 6,
        stroke: "#25446d",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0);
    this.issueText = scene.add
      .text(0, 68, "", {
        fontSize: "12px",
        color: "#ffd6d6",
        align: "center",
        wordWrap: { width: layout.statsPanelWidth },
      })
      .setOrigin(0.5, 0);

    this.root.add([this.statsText, this.issueText]);
  }

  update(validation) {
    const stats = validation.stats;
    this.statsText.setText(
      [
        `Masa: ${stats.mass.toFixed(0)}t`,
        `Empuje: ${stats.thrust.toFixed(0)}t`,
        `Empuje / Peso: ${stats.twr.toFixed(2)}`,
      ].join("\n"),
    );

    const issue = validation.errors[0] || validation.warnings[0] || "";
    this.issueText.setText(issue);
    this.issueText.setColor(validation.errors.length > 0 ? "#ffd6d6" : "#d8ecff");
  }
}
