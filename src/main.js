import Phaser from "phaser";
import BootScene from "./game/scenes/BootScene.js";
import HangarScene from "./game/scenes/HangarScene.js";
import FlightScene from "./game/scenes/FlightScene.js";
import LandingScene from "./game/scenes/LandingScene.js";
import config from "./game/config.js";
import { installFx } from "./game/fx/Fx.js";

config.scene = [BootScene, HangarScene, FlightScene, LandingScene];

const game = new Phaser.Game(config);
installFx(game);

// Sound on / off from anywhere with M, or from the buttons on the cover and
// in the hangar. The choice is remembered by the audio system.
let toastTimer = null;
function showToast(text) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 1400);
}

function toggleMute() {
  const audio = game.registry.get("audio");
  if (!audio) return;
  const muted = audio.toggleMuted();
  if (muted) window.speechSynthesis?.cancel();
  game.events.emit("mute-changed", muted);
  showToast(muted ? "Sonido desactivado" : "Sonido activado");
}

game.events.on("toggle-mute", toggleMute);
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "m" && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
    toggleMute();
  }
});

if (import.meta.env.DEV) {
  // Handy for poking at scenes from the browser console while developing.
  window.__game = game;
}
