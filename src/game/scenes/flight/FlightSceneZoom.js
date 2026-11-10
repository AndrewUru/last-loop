import Phaser from "phaser";

// The player's own zoom on top of the automatic camera: the camera keeps
// framing the rocket, and this multiplies how close it is.
//   mouse wheel, + / - keys, 0 to reset, or a two-finger pinch on screen
// A pinch only counts fingers that did not start on a touch button, so
// holding IMPULSO and a steering button never zooms.

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
const WHEEL_SPEED = 0.0015;
const KEY_STEP = 1.25;

export const flightSceneZoomMethods = {
  createZoomControls() {
    this.userZoom = 1;
    this.pinch = { pointers: new Map(), startDistance: 0, startZoom: 1 };

    this.onZoomWheel = (_pointer, _over, _dx, dy) => this.setUserZoom(this.userZoom * Math.exp(-dy * WHEEL_SPEED));
    this.onZoomKey = (event) => {
      if (event.key === "+" || event.key === "=") this.setUserZoom(this.userZoom * KEY_STEP);
      else if (event.key === "-" || event.key === "_") this.setUserZoom(this.userZoom / KEY_STEP);
      else if (event.key === "0") this.setUserZoom(1);
    };
    this.onPinchDown = (pointer, over) => {
      if (over.length === 0) {
        this.pinch.pointers.set(pointer.id, pointer);
        this.startPinchIfReady();
      }
    };
    this.onPinchUp = (pointer) => {
      this.pinch.pointers.delete(pointer.id);
      this.pinch.startDistance = 0;
      this.startPinchIfReady();
    };

    this.input.on("wheel", this.onZoomWheel);
    this.input.keyboard.on("keydown", this.onZoomKey);
    this.input.on("pointerdown", this.onPinchDown);
    this.input.on("pointerup", this.onPinchUp);
    this.input.on("pointerupoutside", this.onPinchUp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off("wheel", this.onZoomWheel);
      this.input.keyboard.off("keydown", this.onZoomKey);
      this.input.off("pointerdown", this.onPinchDown);
      this.input.off("pointerup", this.onPinchUp);
      this.input.off("pointerupoutside", this.onPinchUp);
    });
  },

  pinchDistance() {
    const [a, b] = [...this.pinch.pointers.values()];
    return Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
  },

  startPinchIfReady() {
    if (this.pinch.pointers.size === 2) {
      this.pinch.startDistance = Math.max(this.pinchDistance(), 1);
      this.pinch.startZoom = this.userZoom;
    }
  },

  // Called every frame: follows a pinch in progress.
  updateZoomPinch() {
    if (this.pinch?.pointers.size === 2 && this.pinch.startDistance > 0) {
      this.setUserZoom(this.pinch.startZoom * (this.pinchDistance() / this.pinch.startDistance), true);
    }
  },

  setUserZoom(value, quiet = false) {
    const zoom = Phaser.Math.Clamp(value, ZOOM_MIN, ZOOM_MAX);
    // Snap back to exactly 1 near it, so "normal" is easy to find again.
    this.userZoom = Math.abs(zoom - 1) < 0.04 ? 1 : zoom;
    if (!quiet || Math.abs(this.userZoom - (this.zoomLabelValue ?? 1)) > 0.05) {
      this.showZoomLabel();
    }
  },

  showZoomLabel() {
    this.zoomLabelValue = this.userZoom;
    const { width } = this.scale;
    if (!this.zoomLabel) {
      this.zoomLabel = this.add
        .text(0, 0, "", {
          fontFamily: "Arial, sans-serif", fontSize: "15px", fontStyle: "bold",
          color: "#f3f7fb", backgroundColor: "#0b121acc", padding: { x: 10, y: 6 },
        })
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(800);
      this.cameras.main.ignore(this.zoomLabel);
      this.backdropCamera?.ignore(this.zoomLabel);
    }
    const hud = this.hud.panelBounds;
    this.zoomLabel
      .setText(this.userZoom === 1 ? "Zoom normal" : `Zoom ×${this.userZoom.toFixed(1).replace(".", ",")}`)
      .setPosition(width - 16, hud ? hud.y + hud.height + 12 : 16)
      .setAlpha(1);
    this.tweens.killTweensOf(this.zoomLabel);
    this.tweens.add({ targets: this.zoomLabel, alpha: 0, delay: 1200, duration: 500 });
  },
};
