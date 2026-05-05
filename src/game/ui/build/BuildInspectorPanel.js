const PART_NAMES = {
  Capsule: "Capsula",
  "Fuel Tank S": "Tanque S",
  "Fuel Tank L": "Tanque L",
  "Avionics Ring": "SAS",
  "Main Engine": "Motor",
};

const ROLE_NAMES = {
  "Control module": "Control",
  "Fuel storage": "Combustible",
  "Flight assist": "Asistencia",
  "Main thrust": "Propulsion",
};

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

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(0) : "0";
}

export default class BuildInspectorPanel {
  constructor(scene, { layout }) {
    this.scene = scene;
    this.layout = layout;

    const left = layout.paletteWidth + 10;
    const rightLimit = layout.primaryButtonX - 10;
    this.width = Math.max(180, Math.min(420, rightLimit - left));
    this.height = layout.mobileLayout ? 44 : 48;

    this.root = scene.add.container(left, 8).setDepth(22);
    this.background = scene.add
      .rectangle(0, 0, this.width, this.height, 0x18365c, 0.94)
      .setOrigin(0)
      .setStrokeStyle(1, 0x6d91c4, 0.38);
    this.accent = scene.add
      .rectangle(0, 0, 4, this.height, 0x9bd6ff, 1)
      .setOrigin(0);
    this.titleText = scene.add
      .text(12, 7, "", {
        fontSize: layout.mobileLayout ? "13px" : "14px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0);
    this.metaText = scene.add
      .text(12, this.height - 19, "", {
        fontSize: layout.mobileLayout ? "10px" : "11px",
        color: "#cfe1f7",
      })
      .setOrigin(0);
    this.issueText = scene.add
      .text(this.width - 10, this.height - 19, "", {
        fontSize: layout.mobileLayout ? "10px" : "11px",
        color: "#ffd783",
        align: "right",
      })
      .setOrigin(1, 0);

    this.root.add([
      this.background,
      this.accent,
      this.titleText,
      this.metaText,
      this.issueText,
    ]);
  }

  update(model) {
    if (!model) {
      this.titleText.setText("Selecciona una pieza");
      this.metaText.setText("Arrastra al grid");
      this.issueText.setText("");
      this.accent.setFillStyle(0x9bd6ff, 1);
      return;
    }

    const name = PART_NAMES[model.name] || model.name;
    const role = ROLE_NAMES[model.role] || model.role || "Modulo";
    const state = model.stateLabel === "Selected" ? "Seleccionado" : "Catalogo";
    const issue = model.issues?.[0];
    const issueText = translateIssue(issue?.message);

    this.titleText.setText(`${name}  ${state}`);
    this.metaText.setText(
      `${role} | M ${formatNumber(model.mass)}t  F ${formatNumber(model.fuel)}  E ${formatNumber(model.thrust)}t`,
    );
    this.issueText.setText(issueText);
    this.issueText.setColor(issue?.severity === "error" ? "#ffd0d0" : "#ffe29b");
    this.accent.setFillStyle(model.partColor || 0x9bd6ff, 1);
  }
}
