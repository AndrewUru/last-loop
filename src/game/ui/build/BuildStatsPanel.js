const ISSUE_TEXT = {
  "Drag parts from the panel to start your rocket.": "Arrastra una pieza al grid.",
  "Add exactly one cockpit to control the rocket.": "Falta una capsula de control.",
  "Use only one cockpit.": "Usa solo una capsula.",
  "Add at least one engine or booster.": "Falta un motor.",
  "Add fuel with a tank or a booster.": "Falta combustible.",
  "Thrust is too low. Add more engines or remove mass.": "Empuje bajo: reduce masa o agrega motor.",
  "Every module must connect to the same rocket body.": "Todas las piezas deben estar conectadas.",
  "Center of mass is offset. The rocket may tumble.": "Centro de masa desviado.",
  "Wide stacks are harder to stabilize in flight.": "Un cohete ancho sera menos estable.",
  "Stability is low. Recenter mass or add an avionics module.": "Estabilidad baja: agrega SAS.",
};

function translateIssue(message) {
  return ISSUE_TEXT[message] || message || "";
}

export default class BuildStatsPanel {
  constructor(scene, { layout }) {
    this.scene = scene;
    this.layout = layout;
    this.root = scene.add.container(layout.statsPanelX, layout.statsPanelY);

    this.statsText = scene.add
      .text(0, 0, "", {
        fontSize: layout.mobileLayout ? "18px" : "20px",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
        lineSpacing: 3,
        stroke: "#25446d",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0);
    this.issueText = scene.add
      .text(0, layout.mobileLayout ? 62 : 58, "", {
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
    const status = validation.isValid ? "LISTO" : "BLOQUEADO";
    this.statsText.setText(
      [
        status,
        `Masa: ${stats.mass.toFixed(0)}t`,
        `Empuje: ${stats.thrust.toFixed(0)}t   TWR: ${stats.twr.toFixed(2)}`,
      ].join("\n"),
    );
    this.statsText.setColor(validation.isValid ? "#ffffff" : "#ffd6d6");

    const issue = validation.errors[0] || validation.warnings[0] || "";
    this.issueText.setText(translateIssue(issue));
    this.issueText.setColor(validation.errors.length > 0 ? "#ffd6d6" : "#d8ecff");
  }
}
