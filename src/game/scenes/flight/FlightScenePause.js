import Phaser from "phaser";
import { UI_FONT } from "../../ui/theme.js";

// Pausing a flight: P (or a tap on the pause screen) toggles it, and the game
// pauses on its own when the window loses focus so a flight is never lost to
// a notification. While paused the simulation, the tweens and the scene clock
// stand still. R restarts the flight from the pause screen or once it is over.

// Above everything, the launch countdown included.
const DEPTH = 1100;

export const flightScenePauseMethods = {
  createPause() {
    const touch = Boolean(this.sys.game.device.input.touch);
    this.pauseShade = this.add
      .rectangle(0, 0, 10, 10, 0x05080c, 0.66)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTH)
      .setInteractive();
    this.pauseTitle = this.add
      .text(0, 0, "EN PAUSA", { fontFamily: UI_FONT, fontSize: "40px", fontStyle: "bold", color: "#f4f7fb" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);
    this.pauseHint = this.add
      .text(0, 0, touch ? "Toca para continuar" : "P / ENTER  continuar      R  reiniciar      M  sonido      ESC  hangar", {
        fontFamily: UI_FONT,
        fontSize: "16px",
        color: "#aebdcb",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);
    this.pauseObjects = [this.pauseShade, this.pauseTitle, this.pauseHint];
    this.pauseObjects.forEach((object) => object.setVisible(false));
    this.pauseShade.input.enabled = false;
    this.pauseShade.on("pointerdown", () => this.setPaused(false));

    // Phaser can deliver the same key press twice when the key goes down and
    // up within one frame, which would pause and resume in one go: each
    // browser event is acted on once.
    let lastEvent = null;
    const fresh = (event) => {
      if (event.repeat || event === lastEvent) return false;
      lastEvent = event;
      return true;
    };
    const onToggle = (event) => {
      if (fresh(event)) this.setPaused(!this.paused);
    };
    const onContinue = (event) => {
      if (this.paused && fresh(event)) this.setPaused(false);
    };
    const onRestart = (event) => {
      if (!this.__fxLeaving && (this.paused || this.finished) && fresh(event)) this.restartFlight();
    };
    const onFocusLost = () => this.setPaused(true);
    this.input.keyboard.on("keydown-P", onToggle);
    this.input.keyboard.on("keydown-ENTER", onContinue);
    this.input.keyboard.on("keydown-R", onRestart);
    this.game.events.on(Phaser.Core.Events.BLUR, onFocusLost);
    this.game.events.on(Phaser.Core.Events.HIDDEN, onFocusLost);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off("keydown-P", onToggle);
      this.input.keyboard.off("keydown-ENTER", onContinue);
      this.input.keyboard.off("keydown-R", onRestart);
      this.game.events.off(Phaser.Core.Events.BLUR, onFocusLost);
      this.game.events.off(Phaser.Core.Events.HIDDEN, onFocusLost);
      this.releasePause();
    });
  },

  getPauseUiObjects() {
    return this.pauseObjects || [];
  },

  layoutPause(width, height) {
    if (!this.pauseObjects) return;
    this.pauseShade.setSize(width, height);
    this.pauseShade.input.hitArea.setTo(0, 0, width, height);
    this.pauseTitle.setFontSize(width < 560 ? 30 : 40).setPosition(width / 2, height * 0.42);
    this.pauseHint
      .setFontSize(width < 560 ? 14 : 16)
      .setWordWrapWidth(width - 40)
      .setPosition(width / 2, height * 0.42 + 54);
  },

  setPaused(paused) {
    // Nothing to pause once the flight is over or the scene is fading out.
    if (paused === this.paused || (paused && (this.finished || this.__fxLeaving))) return;
    this.paused = paused;
    this.time.paused = paused;
    if (paused) {
      this.tweens.pauseAll();
      // Let go of everything, so nothing is still held down on resume.
      this.input.keyboard.resetKeys();
      this.touchControlsUi.buttons.forEach((button) => button.setActive(false));
      Object.assign(this.touchControls, { steerLeft: false, steerRight: false, thrust: false, separate: false });
      this.audio?.stopEngine?.();
      this.audio?.updateAtmosphere?.({ speed: 0, density: 0, heat: 0 });
    } else {
      this.tweens.resumeAll();
    }
    this.pauseObjects.forEach((object) => object.setVisible(paused));
    this.pauseShade.input.enabled = paused;
  },

  // Before leaving or restarting the scene: a paused clock would never run
  // the transition, and Phaser keeps the clock's state between runs.
  releasePause() {
    this.paused = false;
    if (this.time) this.time.paused = false;
    this.tweens?.resumeAll();
    this.pauseObjects?.forEach((object) => object.active && object.setVisible(false));
  },
};
