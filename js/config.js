// Shared tuning values. All world units are grid cells; y points up, ground is y = 0.
const CONFIG = {
  VIEW_ROWS: 13.5,      // world cells visible vertically
  GROUND_ROWS: 2,       // cells of ground visible below y = 0
  MIN_VIEW_COLS: 18,    // play mode: zoom out on narrow (portrait) screens to show at least this many cells
  EDIT_MIN_COLS: 8,     // editor: bigger cells on phones so they are easy to tap
  MAX_Y: 11,            // highest row a shape can be placed in
  START_X: -6,          // default player spawn x; levels can move it (level.start)
  END_PADDING: 10,      // empty cells after the last shape before the finish line
  MIN_LENGTH: 30,       // shortest possible level, in cells

  SPEED: 10.4,          // horizontal speed, cells / second
  GRAVITY: 88,          // cells / second^2
  JUMP_V: 19.6,         // initial jump velocity -> ~2.2 cells high, ~4.5 cells long
  AIR_JUMPS: 3,         // double jumps (tap again in mid-air) allowed per attempt
  AIR_JUMP_V: 17,       // velocity of a double jump -> ~1.6 cells extra height
  BOOST_V: 23.8,        // jump boost launch -> ~3.2 cells high
  CLOUD_DELAY: 0.35,    // seconds a cloud block holds you after you land on it
  GLASS_DELAY: 0.12,    // seconds before a glass block shatters under you
  ROCKETS: 3,           // shots per rocket pickup
  ROCKET_SPEED: 18,     // cells / second faster than the player
  ROCKET_RANGE: 2.5,    // seconds before a rocket fizzles out
  MAX_FALL: 30,
  STEP_UP: 0.25,        // how far below a block's top you can clip it and still land
  DT: 1 / 240,          // fixed physics step

  HAZARD_SHRINK: 0.12,  // player hitbox inset when touching spikes / saws
  SPIKE_SCALE: 0.7,     // spike hitbox scale around its centroid
  SAW_SCALE: 0.85,      // saw hitbox radius scale
};
