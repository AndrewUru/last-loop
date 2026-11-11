import FlightModel, { FLIGHT_TARGETS, FLIGHT_WORLD } from "./FlightModel.js";
import FlightPhaseController, { FLIGHT_PHASES } from "./FlightPhaseController.js";

export { FLIGHT_PHASES, FLIGHT_TARGETS, FLIGHT_WORLD };

const STEP = 1 / 120;
// Do not simulate a whole background-tab pause when the browser resumes.
const MAX_FRAME_SECONDS = 0.25;

export default class FlightSimulator {
  constructor(stats, options = {}) {
    this.model = new FlightModel(stats, options);
    this.phaseController = new FlightPhaseController();
    this.state = this.model.createInitialState();
    this.accumulator = 0;
    this.pendingSeparation = false;
  }

  update(delta, controls = {}) {
    if (!Number.isFinite(delta) || delta <= 0) return this.state;
    this.accumulator += Math.min(delta / 1000, MAX_FRAME_SECONDS);
    this.pendingSeparation ||= Boolean(controls.separate);
    const stepControls = { ...controls, separate: false };
    while (this.accumulator + 1e-10 >= STEP) {
      // Separation is an impulse, not a held control: consume it once even
      // when a render frame contains several physics steps.
      stepControls.separate = this.pendingSeparation;
      this.pendingSeparation = false;
      const previousResult = this.state.result;
      this.state = this.model.step(this.state, STEP, stepControls);
      this.state = this.phaseController.update(this.state, STEP, FLIGHT_WORLD);
      this.accumulator = Math.max(0, this.accumulator - STEP);
      if (!previousResult && this.state.result) {
        // Let the scene record the exact finish time before orbit animation.
        this.accumulator = 0;
        break;
      }
    }
    return this.state;
  }

  predictPath(state = this.state) {
    return this.model.predictPath(state);
  }
}
