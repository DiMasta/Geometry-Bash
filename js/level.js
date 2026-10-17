// Level data: create, validate, serialize (for files, links and localStorage).

const STORAGE_LIBRARY = 'geometryBash.library';     // { [id]: level } — all of the player's levels
const STORAGE_CURRENT_ID = 'geometryBash.currentId';
const STORAGE_BEST = 'geometryBash.best';
// Before the library existed: one autosaved level plus levels saved by name (migrated once).
const LEGACY_CURRENT = 'geometryBash.current';
const LEGACY_LEVELS = 'geometryBash.levels';

function newLevelId() {
  return 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const defaultStart = () => ({ x: CONFIG.START_X, y: 0 });

// doubleJump: lets players tap again in mid-air (CONFIG.AIR_JUMPS per attempt). Off by default.
// start: where the cube spawns (the editor's START cube can be dragged).
function newLevel(name = 'My Level') {
  return { id: newLevelId(), name, doubleJump: false, start: defaultStart(), objects: [], updated: Date.now() };
}

function levelEnd(level) {
  let maxX = 0;
  for (const o of level.objects) maxX = Math.max(maxX, o.x + o.s);
  return Math.max(CONFIG.MIN_LENGTH, maxX + CONFIG.END_PADDING, (level.start?.x ?? 0) + 10);
}

function sanitizeObject(raw) {
  if (!raw) return null;
  const t = typeof raw.t === 'number' ? SHAPE_TYPES[raw.t] : raw.t;
  if (!SHAPE_TYPES.includes(t)) return null;
  const s = Math.min(3, Math.max(1, Math.round(Number(raw.s) || 1)));
  const x = Math.round(Number(raw.x));
  const y = Math.round(Number(raw.y));
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || y + s > CONFIG.MAX_Y + 1) return null;
  const r = t === 'triangle' ? ((Math.round(Number(raw.r) || 0) % 4) + 4) % 4 : 0;
  const style = Math.round(Number(raw.v) || 0);
  const v = style > 0 && style < STYLE_NAMES[t].length ? style : 0;
  return { t, x, y, s, r, v };
}

function sanitizeStart(raw) {
  const x = Math.round(Number(raw?.x)), y = Math.round(Number(raw?.y));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return defaultStart();
  return { x: Math.max(CONFIG.START_X, Math.min(5000, x)), y: Math.max(0, Math.min(CONFIG.MAX_Y, y)) };
}

function sanitizeLevel(raw) {
  const level = newLevel(typeof raw?.name === 'string' ? raw.name.slice(0, 40) : 'My Level');
  if (typeof raw?.id === 'string' && /^[\w-]{1,40}$/.test(raw.id)) level.id = raw.id;
  if (Number.isFinite(raw?.updated)) level.updated = raw.updated;
  level.doubleJump = raw?.doubleJump === true;
  level.start = raw?.start ? sanitizeStart(raw.start) : defaultStart();
  if (Array.isArray(raw?.objects)) {
    for (const o of raw.objects) {
      const clean = sanitizeObject(o);
      if (clean) level.objects.push(clean);
    }
  }
  return level;
}

// Compact form: { n: name, d: double jump 0/1, st: [x, y] start, o: [[type, x, y, size, rot, texture], ...] }
function encodeLevel(level) {
  const compact = {
    n: level.name,
    d: level.doubleJump ? 1 : 0,
    o: level.objects.map(o => [SHAPE_TYPES.indexOf(o.t), o.x, o.y, o.s, o.r, o.v]),
  };
  const st = level.start || defaultStart();
  if (st.x !== CONFIG.START_X || st.y !== 0) compact.st = [st.x, st.y];
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeLevel(code) {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  const compact = JSON.parse(new TextDecoder().decode(bytes));
  return sanitizeLevel({
    name: compact.n,
    doubleJump: compact.d === 1,
    start: compact.st ? { x: compact.st[0], y: compact.st[1] } : null,
    objects: (compact.o || []).map(([t, x, y, s, r, v]) => ({ t, x, y, s, r, v })),
  });
}

function levelToJSON(level) {
  const { id, updated, ...rest } = level;
  return JSON.stringify({ game: 'geometry-bash', version: 2, ...rest }, null, 2);
}

function levelFromJSON(text) {
  return sanitizeLevel(JSON.parse(text));
}

// ---------- localStorage (wrapped: storage can be unavailable) ----------

function storageGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ---------- Level library: every level the player has made ----------

function loadLibrary() {
  const map = storageGet(STORAGE_LIBRARY, null);
  if (map && typeof map === 'object') {
    const out = {};
    for (const raw of Object.values(map)) {
      const level = sanitizeLevel(raw);
      out[level.id] = level;
    }
    return out;
  }
  return migrateLegacyLevels();
}

// Fold the old single autosave + named saves into the library (once).
function migrateLegacyLevels() {
  const lib = {};
  const add = (raw) => {
    const level = sanitizeLevel(raw);
    level.id = newLevelId();
    const dupe = Object.values(lib).some(l => l.name === level.name && levelKey(l) === levelKey(level));
    if (!dupe) lib[level.id] = level;
    return level;
  };
  const current = storageGet(LEGACY_CURRENT, null);
  const named = storageGet(LEGACY_LEVELS, {});
  let currentId = null;
  if (current) currentId = add(current).id;
  if (named && typeof named === 'object') Object.values(named).forEach(add);
  if (!Object.keys(lib).length) currentId = add(demoLevel()).id;
  storageSet(STORAGE_LIBRARY, lib);
  storageSet(STORAGE_CURRENT_ID, currentId || Object.keys(lib)[0]);
  return lib;
}

function storeLibrary(lib, currentId) {
  storageSet(STORAGE_CURRENT_ID, currentId);
  return storageSet(STORAGE_LIBRARY, lib);
}

// ---------- Best scores, keyed by level layout (renaming keeps the record) ----------

function levelKey(level) {
  // Textures are cosmetic and don't count, except cloud/glass blocks (they behave differently).
  // Double jump, speed pickups and a moved start change the challenge, so they count too.
  const breakable = { [CLOUD_STYLE]: 'cloud', [GLASS_STYLE]: 'glass' };
  let text = JSON.stringify(level.objects.map(o => {
    const base = [o.t, o.x, o.y, o.s, o.r];
    if (o.t === 'square' && breakable[o.v]) base.push(breakable[o.v]);
    if (o.t === 'speed') base.push(o.v);
    return base;
  }).sort());
  if (level.doubleJump) text += '|double-jump';
  const st = level.start || defaultStart();
  if (st.x !== CONFIG.START_X || st.y !== 0) text += `|start:${st.x},${st.y}`;
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function loadBest(id) {
  return Number(storageGet(STORAGE_BEST, {})[id]) || 0;
}

function saveBest(id, percent) {
  const map = storageGet(STORAGE_BEST, {});
  map[id] = percent;
  storageSet(STORAGE_BEST, map);
}

// ---------- Demo level shown on first visit ----------

function demoLevel() {
  const level = newLevel('First Steps');
  const add = (t, x, y, s = 1, r = 0) => level.objects.push({ t, x, y, s, r });

  add('triangle', 8, 0);
  add('triangle', 16, 0); add('triangle', 17, 0);
  add('square', 24, 0); add('square', 25, 0); add('square', 26, 0);
  add('square', 27, 1); add('square', 28, 1); add('square', 29, 1);
  add('triangle', 27, 0); add('triangle', 28, 0); add('triangle', 29, 0);
  add('square', 30, 0);
  add('circle', 37, 0, 2);
  add('square', 44, 0); add('square', 45, 0);
  add('triangle', 46, 0); add('triangle', 47, 0);
  add('square', 48, 0); add('square', 48, 1);
  add('triangle', 52, 0); add('triangle', 53, 0); add('triangle', 54, 0);
  add('square', 60, 0); add('square', 61, 0);
  add('square', 64, 1); add('square', 65, 1);
  add('square', 68, 2); add('square', 69, 2);
  add('triangle', 62, 0); add('triangle', 63, 0); add('triangle', 64, 0); add('triangle', 65, 0);
  add('triangle', 66, 0); add('triangle', 67, 0); add('triangle', 68, 0); add('triangle', 69, 0);
  add('square', 72, 0); add('square', 72, 1);
  add('triangle', 80, 0);
  add('circle', 86, 0);
  add('triangle', 92, 0); add('triangle', 93, 0);
  // Show off a few block textures
  const textureAt = (x) => (x < 31 ? 1 : x < 49 ? 2 : x < 62 ? 3 : x < 70 ? 5 : 4);
  for (const o of level.objects) o.v = o.t === 'square' ? textureAt(o.x) : 0;

  // Finale: a jump boost up to a metal ledge, then cloud blocks that vanish under you
  add('boost', 98, 0);
  for (let x = 100; x <= 108; x++) add('triangle', x, 0);
  for (const x of [101, 102, 103]) level.objects.push({ t: 'square', x, y: 2, s: 1, r: 0, v: 4 });
  for (const x of [105, 106, 107, 108]) level.objects.push({ t: 'square', x, y: 2, s: 1, r: 0, v: CLOUD_STYLE });
  for (const o of level.objects) o.v = o.v || 0;
  return level;
}
