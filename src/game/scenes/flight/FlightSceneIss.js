import Phaser from "phaser";
import { getIssPosition } from "../../data/realSpace.js";
import { getPresentationAltitude } from "./FlightSceneUtils.js";
import { FLIGHT_WORLD } from "../../systems/FlightSimulator.js";

// The real International Space Station, drawn where it actually is: its
// longitude around the planet (the pad sits at Cape Canaveral's) at its real
// height. It shows once the camera has pulled back far enough to see the
// curve of the planet, and is moved along its orbit between updates.

const PAD_LONGITUDE = -80.6;
const ORBIT_MINUTES = 92.7;
const REFRESH_MS = 15000;

export const flightSceneIssMethods = {
  createIss() {
    this.iss = { data: null, angle: 0, alpha: 0 };
    this.issGraphics = this.addWorldObject(this.add.graphics().setDepth(-13));
    this.issLabel = this.addWorldObject(
      this.add
        .text(0, 0, "ISS · EN VIVO", { fontFamily: "Arial, sans-serif", fontSize: "13px", fontStyle: "bold", color: "#ffe9a8" })
        .setOrigin(0, 0.5)
        .setDepth(-13)
        .setAlpha(0),
    );
    const refresh = async () => {
      const data = await getIssPosition();
      if (data && this.issGraphics?.active) this.iss.data = data;
    };
    refresh();
    this.issTimer = this.time.addEvent({ delay: REFRESH_MS, loop: true, callback: refresh });
  },

  updateIss(delta) {
    const g = this.issGraphics;
    if (!g) return;
    g.clear();
    const data = this.iss.data;
    // Visible only when the planet reads as round (zoomed out).
    const target = data ? Phaser.Math.Clamp((this.groundCurve - 0.6) / 0.3, 0, 1) : 0;
    this.iss.alpha += (target - this.iss.alpha) * Math.min(1, delta / 400);
    if (!data || this.iss.alpha < 0.02) {
      this.issLabel.setAlpha(0);
      return;
    }
    // Extrapolate along the orbit since the last fix (eastward, ~92.7 min a lap).
    const minutes = (Date.now() - data.at) / 60000;
    const longitude = data.longitude + (minutes / ORBIT_MINUTES) * 360;
    const angle = Phaser.Math.DegToRad(longitude - PAD_LONGITUDE);
    const radius = FLIGHT_WORLD.planetRadius + getPresentationAltitude(Math.min(data.altitude, FLIGHT_WORLD.earthEscapeAltitude - 5));
    const x = Math.sin(angle) * radius;
    const y = -Math.cos(angle) * radius;
    const zoom = Math.max(this.cameras.main.zoom, 0.01);
    const s = 7 / zoom;
    const a = this.iss.alpha;
    // A tiny station: truss, two solar wings, and a soft glow.
    g.fillStyle(0xffe9a8, 0.18 * a);
    g.fillCircle(x, y, s * 2.2);
    g.fillStyle(0x5b8fd6, a);
    g.fillRect(x - s * 1.6, y - s * 0.55, s * 1.1, s * 1.1);
    g.fillRect(x + s * 0.5, y - s * 0.55, s * 1.1, s * 1.1);
    g.fillStyle(0xe8eef4, a);
    g.fillRect(x - s * 0.5, y - s * 0.2, s, s * 0.4);
    this.issLabel
      .setPosition(x + s * 2.2, y)
      .setScale(1 / zoom)
      .setAlpha(a);
  },
};
