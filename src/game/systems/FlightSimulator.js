import FlightModel, { FLIGHT_TARGETS, FLIGHT_WORLD } from "./FlightModel.js";
import FlightPhaseController, {
  FLIGHT_PHASES,
  getPhaseMeta,
} from "./FlightPhaseController.js";

export { FLIGHT_PHASES, FLIGHT_TARGETS, FLIGHT_WORLD, getPhaseMeta };

export default class FlightSimulator {
  constructor(stats) {
    this.model = new FlightModel(stats);
    this.phaseController = new FlightPhaseController();
    this.state = this.model.createInitialState();
  }

  update(delta, controls = {}) {
    const dt = Math.min(delta / 1000, 0.033);
    this.state = this.model.step(this.state, dt, controls);
    this.state = this.phaseController.update(this.state, dt, FLIGHT_WORLD);
    return this.state;
  }

  predictPath(state = this.state) {
    return this.model.predictPath(state);
  }
}
