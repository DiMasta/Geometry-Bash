// Shared tuning values. All world units are grid cells; y points up, ground is y = 0.
const CONFIG = {
  VIEW_ROWS: 13.5,      // world cells visible vertically
  GROUND_ROWS: 2,       // cells of ground visible below y = 0
  MIN_VIEW_COLS: 18,    // zoom out on narrow (portrait) screens to show at least this many cells
  MAX_Y: 11,            // highest row a shape can be placed in
  START_X: -6,          // player spawn x (the editor only allows x >= 0)
  END_PADDING: 10,      // empty cells after the last shape before the finish line
  MIN_LENGTH: 30,       // shortest possible level, in cells

  SPEED: 10.4,          // horizontal speed, cells / second
  GRAVITY: 88,          // cells / second^2
  JUMP_V: 19.6,         // initial jump velocity -> ~2.2 cells high, ~4.5 cells long
  MAX_FALL: 30,
  STEP_UP: 0.25,        // how far below a block's top you can clip it and still land
  DT: 1 / 240,          // fixed physics step

  HAZARD_SHRINK: 0.12,  // player hitbox inset when touching spikes / saws
  SPIKE_SCALE: 0.7,     // spike hitbox scale around its centroid
  SAW_SCALE: 0.85,      // saw hitbox radius scale
};
