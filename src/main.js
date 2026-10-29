import Phaser from "phaser";
import BootScene from "./game/scenes/BootScene.js";
import BuildScene from "./game/scenes/BuildScene.js";
import FlightScene from "./game/scenes/FlightScene.js";
import config from "./game/config.js";

config.scene = [BootScene, BuildScene, FlightScene];

const game = new Phaser.Game(config);

if (import.meta.env.DEV) {
  // Handy for poking at scenes from the browser console while developing.
  window.__game = game;
}
