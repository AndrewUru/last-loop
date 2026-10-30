export const ROCKET_CELL_SIZE = 5;
// Trail samples are taken every 0.25 s, so this keeps the whole flight.
export const TRAIL_LIMIT = 480;
export const STAR_COUNT = 130;
export const TRAJECTORY_REVEAL_ALTITUDE = 30;
export const PAD_FADE_ALTITUDE = 60;
export const DAY_SKY_FADE_START_ALTITUDE = 40;
export const DAY_SKY_FADE_END_ALTITUDE = 160;
// The planet is small next to the rocket, so on the pad its edge would curve
// on screen. There the ground is drawn as a circle this many times larger,
// touching the pad (a flat horizon), and it bends into the real planet while
// the camera pulls back between these rendered altitudes.
export const FLAT_GROUND_SCALE = 40;
export const GROUND_CURVE_START = 2;
export const GROUND_CURVE_END = 30;
// Sprites kept ready for exhaust particles; fewer are used on phones.
export const SMOKE_POOL_SIZE = 150;
export const FIRE_POOL_SIZE = 70;
// Extra altitude added on screen low down so liftoff reads as fast; it fades
// out before the orbit band so the orbit is drawn at its true size.
export const PRESENTATION_BOOST = 40;
export const PRESENTATION_BOOST_SCALE = 4;
export const PRESENTATION_FADE_START = 100;
export const PRESENTATION_FADE_END = 200;
