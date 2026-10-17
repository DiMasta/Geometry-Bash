// Shape geometry shared by the editor (placement, erasing) and the game (collisions).
// A shape: { t: 'square' | 'triangle' | 'circle' | 'boost' | 'glass' | 'speed' | 'rocket', x, y, s, r, v }
//   x, y = bottom-left cell, s = size in cells, r = triangle rotation (0 up, 1 right, 2 down, 3 left),
//   v = texture / variation (index into STYLE_NAMES[t])

// Order matters: share links store the index, so only ever append.
const SHAPE_TYPES = ['square', 'triangle', 'circle', 'boost', 'glass', 'speed', 'rocket'];
const ROT_NAMES = ['Up', 'Right', 'Down', 'Left'];
// Index 0 of each list is the classic look. Cloud blocks vanish after you land on them; glass ones shatter.
const BLOCK_STYLE_NAMES = ['Night', 'Brick', 'Crate', 'Stone', 'Metal', 'Grass', 'Ice', 'Neon', 'Candy', 'Cloud', 'Glass'];
const SPIKE_STYLE_NAMES = ['Night', 'Lava', 'Ice', 'Metal', 'Thorn', 'Gold', 'Neon', 'Candy', 'Crystal'];
const SAW_STYLE_NAMES = ['Saw', 'Gear', 'Fireball', 'Spike ball', 'Ice saw', 'Neon', 'Peppermint', 'Gold saw'];
// Speed pickups: the multiplier stays until you collect another one.
const SPEED_NAMES = ['2×', '3×', '½×', '¾×', '1×'];
const SPEED_VALUES = [2, 3, 0.5, 0.75, 1];
const STYLE_NAMES = {
  square: BLOCK_STYLE_NAMES, triangle: SPIKE_STYLE_NAMES, circle: SAW_STYLE_NAMES,
  boost: ['Boost'], glass: ['Glass wall'], speed: SPEED_NAMES, rocket: ['Rockets'],
};
const CLOUD_STYLE = BLOCK_STYLE_NAMES.indexOf('Cloud');
const GLASS_STYLE = BLOCK_STYLE_NAMES.indexOf('Glass');

// What the editor's Items tool can place (its palette), in order.
const ITEM_KINDS = [
  { t: 'boost', v: 0, name: 'Jump boost — launches you ~3 blocks up' },
  { t: 'glass', v: 0, name: 'Glass wall — shatters when you touch it' },
  { t: 'speed', v: 0, name: 'Speed 2×' },
  { t: 'speed', v: 1, name: 'Speed 3×' },
  { t: 'speed', v: 2, name: 'Slow ½×' },
  { t: 'speed', v: 3, name: 'Slow ¾×' },
  { t: 'speed', v: 4, name: 'Normal speed 1×' },
  { t: 'rocket', v: 0, name: 'Rockets — 3 shots that blow up blocks' },
];

function shapeBox(o) {
  return { x: o.x, y: o.y, w: o.s, h: o.s };
}

function boxesOverlap(a, b, eps = 0) {
  return a.x + a.w > b.x + eps && a.x < b.x + b.w - eps &&
         a.y + a.h > b.y + eps && a.y < b.y + b.h - eps;
}

function pointInBox(px, py, b) {
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

// Triangle corners in world space, rotated clockwise in 90° steps around the box centre.
function trianglePoints(o) {
  const h = o.s / 2;
  const cx = o.x + h, cy = o.y + h;
  let pts = [[-h, -h], [h, -h], [0, h]];
  for (let i = 0; i < (o.r || 0); i++) pts = pts.map(([dx, dy]) => [dy, -dx]);
  return pts.map(([dx, dy]) => [cx + dx, cy + dy]);
}

function scalePolygon(pts, k) {
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

function boxPolygon(b) {
  return [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];
}

// Separating-axis test for two convex polygons.
function polygonsOverlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      const nx = y2 - y1, ny = x1 - x2;
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const [x, y] of a) { const d = x * nx + y * ny; minA = Math.min(minA, d); maxA = Math.max(maxA, d); }
      for (const [x, y] of b) { const d = x * nx + y * ny; minB = Math.min(minB, d); maxB = Math.max(maxB, d); }
      if (maxA < minB || maxB < minA) return false;
    }
  }
  return true;
}

function circleBoxOverlap(cx, cy, r, b) {
  const nx = Math.max(b.x, Math.min(cx, b.x + b.w));
  const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

// Does a hazard (triangle / circle) kill a player occupying box b?
function hazardHits(o, b) {
  if (o.t === 'triangle') {
    return polygonsOverlap(scalePolygon(trianglePoints(o), CONFIG.SPIKE_SCALE), boxPolygon(b));
  }
  if (o.t === 'circle') {
    const r = o.s / 2;
    return circleBoxOverlap(o.x + r, o.y + r, r * CONFIG.SAW_SCALE, b);
  }
  return false;
}
