import Phaser from "phaser";
import BootScene from "./game/scenes/BootScene.js";
import BuildScene from "./game/scenes/BuildScene.js";
import DeepSpaceScene from "./game/scenes/DeepSpaceScene.js";
import FlightScene from "./game/scenes/FlightScene.js";
import ResultScene from "./game/scenes/ResultScene.js";
import config from "./game/config.js";

config.scene = [BootScene, BuildScene, FlightScene, DeepSpaceScene, ResultScene];

new Phaser.Game(config);
