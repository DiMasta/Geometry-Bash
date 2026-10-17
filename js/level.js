// Level data: create, validate, serialize (for files, links and localStorage).

const STORAGE_CURRENT = 'geometryBash.current';
const STORAGE_LEVELS = 'geometryBash.levels';
const STORAGE_BEST = 'geometryBash.best';

function newLevel(name = 'My Level') {
  return { name, objects: [] };
}

function levelEnd(level) {
  let maxX = 0;
  for (const o of level.objects) maxX = Math.max(maxX, o.x + o.s);
  return Math.max(CONFIG.MIN_LENGTH, maxX + CONFIG.END_PADDING);
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
  return { t, x, y, s, r };
}

function sanitizeLevel(raw) {
  const level = newLevel(typeof raw?.name === 'string' ? raw.name.slice(0, 40) : 'My Level');
  if (Array.isArray(raw?.objects)) {
    for (const o of raw.objects) {
      const clean = sanitizeObject(o);
      if (clean) level.objects.push(clean);
    }
  }
  return level;
}

// Compact form: { n: name, o: [[type, x, y, size, rot], ...] }
function encodeLevel(level) {
  const compact = {
    n: level.name,
    o: level.objects.map(o => [SHAPE_TYPES.indexOf(o.t), o.x, o.y, o.s, o.r]),
  };
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
    objects: (compact.o || []).map(([t, x, y, s, r]) => ({ t, x, y, s, r })),
  });
}

function levelToJSON(level) {
  return JSON.stringify({ game: 'geometry-bash', version: 1, ...level }, null, 2);
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

function loadSavedLevels() {
  const map = storageGet(STORAGE_LEVELS, {});
  return map && typeof map === 'object' ? map : {};
}

function saveLevelByName(level) {
  const map = loadSavedLevels();
  map[level.name] = level;
  return storageSet(STORAGE_LEVELS, map);
}

function deleteSavedLevel(name) {
  const map = loadSavedLevels();
  delete map[name];
  storageSet(STORAGE_LEVELS, map);
}

// ---------- Best scores, keyed by level layout (renaming keeps the record) ----------

function levelId(level) {
  const text = JSON.stringify(level.objects.map(o => [o.t, o.x, o.y, o.s, o.r]).sort());
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
  return level;
}
