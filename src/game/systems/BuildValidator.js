import ShipStatsCalculator from "./ShipStatsCalculator.js";

export const MIN_LAUNCH_TWR = 1.05;

// The hangar stacks parts automatically, so the only ways a design can be
// unflyable are missing thrust, missing fuel or too much weight.
export default class BuildValidator {
  static validate(parts) {
    const stats = ShipStatsCalculator.calculate(parts);
    const errors = [];

    if (stats.engineCount + stats.boosterCount === 0) {
      errors.push("Añade un motor.");
    } else if (stats.fuel <= 0) {
      errors.push("Añade un tanque de combustible.");
    } else if (stats.twr < MIN_LAUNCH_TWR) {
      errors.push("Pesa demasiado para despegar: quita tanques o añade boosters.");
    }

    return { isValid: errors.length === 0, errors, stats };
  }
}
