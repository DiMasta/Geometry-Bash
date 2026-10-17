// Drawing helpers shared by the editor and the game.

function makeView(W, H, camX, camY = 0, minCols = CONFIG.MIN_VIEW_COLS) {
  const scale = Math.min(H / CONFIG.VIEW_ROWS, W / minCols);
  return { W, H, scale, camX, camY, groundY: H - CONFIG.GROUND_ROWS * scale };
}

const sx = (v, x) => (x - v.camX) * v.scale;
const sy = (v, y) => v.groundY - (y - v.camY) * v.scale;

function screenToWorld(v, px, py) {
  return { x: px / v.scale + v.camX, y: (v.groundY - py) / v.scale + v.camY };
}

// Photo of the creators, tiled behind the level.
const BG_PHOTO = new Image();
BG_PHOTO.src = 'assets/creators.jpg';

function drawBackground(ctx, v, hue) {
  const g = ctx.createLinearGradient(0, 0, 0, v.H);
  g.addColorStop(0, `hsl(${hue}, 70%, 32%)`);
  g.addColorStop(1, `hsl(${hue + 25}, 75%, 16%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, v.W, v.H);

  if (BG_PHOTO.complete && BG_PHOTO.naturalWidth) {
    drawPhotoTiles(ctx, v, hue);
    return;
  }

  // Parallax squares (until the photo has loaded)
  const size = v.scale * 3;
  const off = -(v.camX * v.scale * 0.15) % size;
  ctx.strokeStyle = `hsla(${hue + 10}, 80%, 70%, 0.07)`;
  ctx.lineWidth = 2;
  for (let x = off - size; x < v.W + size; x += size) {
    for (let y = 0; y < v.groundY; y += size) {
      const k = (Math.floor((x - off) / size) * 7 + Math.floor(y / size) * 3) % 5;
      if (k === 0) ctx.strokeRect(x + 6, y + 6, size - 12, size - 12);
    }
  }
}

// Fill the sky with framed copies of the photo (aspect ratio kept), scrolling with
// parallax, then dim everything with a blue wash so the level stays readable.
function drawPhotoTiles(ctx, v, hue) {
  const border = Math.max(4, Math.round(v.scale * 0.15));
  const aspect = BG_PHOTO.naturalWidth / BG_PHOTO.naturalHeight;
  // As tall as the sky, but never wider than the screen (phones get stacked rows instead).
  const tileW = Math.max(40, Math.min((v.groundY - border * 2) * aspect, v.W - border * 2));
  const tileH = tileW / aspect;
  const stepX = tileW + border * 2, stepY = tileH + border * 2;
  const off = ((v.camX * v.scale * 0.3) % stepX + stepX) % stepX;

  for (let y = 0; y < v.groundY; y += stepY) {
    for (let x = -off; x < v.W; x += stepX) {
      ctx.fillStyle = '#0a0f2e';
      ctx.fillRect(x, y, stepX, stepY);
      ctx.drawImage(BG_PHOTO, x + border, y + border, tileW, tileH);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + border - 1, y + border - 1, tileW + 2, tileH + 2);
    }
  }

  ctx.fillStyle = `hsla(${hue}, 80%, 18%, 0.62)`;
  ctx.fillRect(0, 0, v.W, v.H);
}

function drawGround(ctx, v, hue) {
  const top = sy(v, 0);
  if (top > v.H) return;
  const g = ctx.createLinearGradient(0, top, 0, v.H);
  g.addColorStop(0, `hsl(${hue + 20}, 70%, 22%)`);
  g.addColorStop(1, `hsl(${hue + 30}, 70%, 10%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, top, v.W, v.H - top);

  // Ground tiles
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  const tile = 4;
  const first = Math.floor(v.camX / tile) * tile;
  for (let x = first; sx(v, x) < v.W; x += tile) {
    ctx.beginPath();
    ctx.moveTo(sx(v, x), top);
    ctx.lineTo(sx(v, x), v.H);
    ctx.stroke();
  }

  // Glowing top line
  ctx.save();
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(v.W, top);
  ctx.stroke();
  ctx.restore();
}

function drawShape(ctx, v, o, time = 0, alpha = 1) {
  const s = v.scale;
  const lw = Math.max(1.5, s * 0.07);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = 'round';

  if (o.t === 'square' && o.v) {
    drawTexturedBlock(ctx, o, sx(v, o.x), sy(v, o.y + o.s), s, lw);
  } else if (o.t === 'square') {
    const x = sx(v, o.x), y = sy(v, o.y + o.s), w = o.s * s;
    const g = ctx.createLinearGradient(0, y, 0, y + w);
    g.addColorStop(0, '#1d1f3f');
    g.addColorStop(1, '#05060f');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, w);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = lw * 0.6;
    const inset = s * 0.18;
    ctx.strokeRect(x + inset, y + inset, w - inset * 2, w - inset * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = lw;
    ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, w - lw);
  } else if (o.t === 'triangle') {
    drawSpike(ctx, o, trianglePoints(o).map(([x, y]) => [sx(v, x), sy(v, y)]), lw);
  } else if (o.t === 'circle') {
    ctx.translate(sx(v, o.x + o.s / 2), sy(v, o.y + o.s / 2));
    drawSaw(ctx, o, (o.s / 2) * s, lw, time);
  } else if (o.t === 'boost') {
    drawBoost(ctx, sx(v, o.x), sy(v, o.y + o.s), o.s * s, lw, time);
  }
  ctx.restore();
}

function drawPlayer(ctx, v, x, y, angle, alpha = 1) {
  const s = v.scale;
  const cx = sx(v, x + 0.5), cy = sy(v, y + 0.5);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const h = s / 2;
  ctx.shadowColor = '#3ee0ff';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(-h, -h, s, s);
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(2, s * 0.08);
  ctx.strokeStyle = '#111';
  ctx.strokeRect(-h, -h, s, s);
  // Face
  ctx.fillStyle = '#3ee0ff';
  ctx.fillRect(-h * 0.55, -h * 0.55, s * 0.55, s * 0.55);
  ctx.strokeRect(-h * 0.55, -h * 0.55, s * 0.55, s * 0.55);
  ctx.fillStyle = '#111';
  ctx.fillRect(-h * 0.35, -h * 0.3, s * 0.1, s * 0.12);
  ctx.fillRect(h * 0.05, -h * 0.3, s * 0.1, s * 0.12);
  ctx.fillRect(-h * 0.35, h * 0.1, s * 0.5, s * 0.07);
  ctx.restore();
}

function drawFinishLine(ctx, v, x) {
  const px = sx(v, x);
  if (px < -40 || px > v.W + 40) return;
  const top = 0, bottom = sy(v, 0);
  const sq = v.scale / 2;
  for (let y = top, row = 0; y < bottom; y += sq, row++) {
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = (row + c) % 2 ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.6)';
      ctx.fillRect(px + c * sq, y, sq, Math.min(sq, bottom - y));
    }
  }
}

// ---------- Block textures ----------
// Each style paints one 64px cell; blocks are drawn cell by cell so textures keep their scale.
// Style 0 ("Night") is the classic look drawn directly in drawShape.

const TILE = 64;

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BLOCK_PAINTERS = {
  Brick: { outline: '#2a0d06', paint(c, rnd) {
    c.fillStyle = '#d6c3a5';
    c.fillRect(0, 0, TILE, TILE);
    for (let row = 0; row < 4; row++) {
      for (let col = -1; col < 2; col++) {
        const x = col * 32 + (row % 2 ? 16 : 0);
        c.fillStyle = `hsl(${10 + rnd() * 8}, 55%, ${30 + rnd() * 10}%)`;
        c.fillRect(x + 2, row * 16 + 2, 28, 12);
        c.fillStyle = 'rgba(255,255,255,0.12)';
        c.fillRect(x + 2, row * 16 + 2, 28, 3);
      }
    }
  } },

  Crate: { outline: '#3b2208', paint(c) {
    c.fillStyle = '#b8823f';
    c.fillRect(0, 0, TILE, TILE);
    c.fillStyle = '#8a5a2a';
    for (const y of [21, 42]) c.fillRect(0, y, TILE, 2);
    c.strokeStyle = '#6b4219';
    c.lineWidth = 8;
    c.strokeRect(4, 4, TILE - 8, TILE - 8);
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(8, TILE - 8);
    c.lineTo(TILE - 8, 8);
    c.stroke();
    c.fillStyle = '#d9d0b8';
    for (const [x, y] of [[4, 4], [60, 4], [4, 60], [60, 60]]) c.fillRect(x - 1.5, y - 1.5, 3, 3);
  } },

  Stone: { outline: '#2b2e33', paint(c, rnd) {
    c.fillStyle = '#4a4e55';
    c.fillRect(0, 0, TILE, TILE);
    const cells = [[0, 0, 28, 22], [28, 0, 36, 22], [0, 22, 20, 21], [20, 22, 26, 21], [46, 22, 18, 21], [0, 43, 34, 21], [34, 43, 30, 21]];
    for (const [x, y, w, h] of cells) {
      c.fillStyle = `hsl(215, 6%, ${42 + rnd() * 18}%)`;
      c.beginPath();
      c.roundRect(x + 2, y + 2, w - 4, h - 4, 5);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.15)';
      c.fillRect(x + 5, y + 3, w - 10, 2);
    }
  } },

  Metal: { outline: '#d5dde6', paint(c) {
    const g = c.createLinearGradient(0, 0, TILE, TILE);
    g.addColorStop(0, '#c3ccd6');
    g.addColorStop(1, '#5d6774');
    c.fillStyle = g;
    c.fillRect(0, 0, TILE, TILE);
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 1;
    for (let i = -TILE; i < TILE; i += 6) {
      c.beginPath();
      c.moveTo(i, TILE);
      c.lineTo(i + TILE, 0);
      c.stroke();
    }
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = 2;
    c.strokeRect(7, 7, TILE - 14, TILE - 14);
    for (const [x, y] of [[12, 12], [52, 12], [12, 52], [52, 52]]) {
      c.fillStyle = '#39414c';
      c.beginPath(); c.arc(x + 1, y + 1, 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e7edf3';
      c.beginPath(); c.arc(x, y, 3.5, 0, Math.PI * 2); c.fill();
    }
  } },

  Grass: { outline: '#1d3410', top: true, paint(c, rnd, top) {
    c.fillStyle = '#7a4b2a';
    c.fillRect(0, 0, TILE, TILE);
    for (let i = 0; i < 26; i++) {
      c.fillStyle = rnd() < 0.5 ? '#5e3920' : '#946038';
      c.fillRect(rnd() * TILE, rnd() * TILE, 3 + rnd() * 3, 3 + rnd() * 3);
    }
    if (!top) return;
    c.fillStyle = '#3f9e3a';
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(TILE, 0);
    for (let x = TILE; x >= 0; x -= 8) c.lineTo(x, 16 + (x / 8 % 2 ? 6 : 0));
    c.closePath();
    c.fill();
    c.fillStyle = '#6fd35f';
    c.fillRect(0, 0, TILE, 5);
  } },

  Ice: { outline: '#eafcff', paint(c) {
    const g = c.createLinearGradient(0, 0, 0, TILE);
    g.addColorStop(0, '#d6f6ff');
    g.addColorStop(1, '#5bb8e6');
    c.fillStyle = g;
    c.fillRect(0, 0, TILE, TILE);
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = 4;
    c.beginPath(); c.moveTo(10, 30); c.lineTo(30, 10); c.stroke();
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(14, 44); c.lineTo(44, 14); c.stroke();
    c.strokeStyle = 'rgba(30,110,160,0.35)';
    c.beginPath(); c.moveTo(40, 64); c.lineTo(52, 40); c.lineTo(64, 46); c.stroke();
  } },

  Neon: { outline: '#3ee0ff', paint(c) {
    c.fillStyle = '#12082a';
    c.fillRect(0, 0, TILE, TILE);
    c.shadowColor = '#ff3df2';
    c.shadowBlur = 8;
    c.strokeStyle = '#ff5cf4';
    c.lineWidth = 3;
    c.strokeRect(10, 10, 18, 18);
    c.strokeRect(36, 36, 18, 18);
    c.strokeStyle = '#3ee0ff';
    c.shadowColor = '#3ee0ff';
    c.strokeRect(36, 10, 18, 18);
    c.strokeRect(10, 36, 18, 18);
    c.shadowBlur = 0;
  } },

  Candy: { outline: '#ffffff', paint(c) {
    c.fillStyle = '#fff4f9';
    c.fillRect(0, 0, TILE, TILE);
    c.fillStyle = '#ff5fa8';
    for (let i = -TILE; i < TILE * 2; i += 16) {
      c.beginPath();
      c.moveTo(i, 0); c.lineTo(i + 8, 0); c.lineTo(i + 8 - TILE, TILE); c.lineTo(i - TILE, TILE);
      c.closePath();
      c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(0, 0, TILE, 10);
  } },
};

BLOCK_PAINTERS.Cloud = { outline: null, paint(c) {
  // Puffs reach the top of the cell so you visibly stand on the cloud
  const puffs = [[16, 28, 15], [32, 21, 18], [48, 28, 15], [18, 44, 15], [46, 44, 15], [32, 40, 18]];
  c.fillStyle = '#b9d4ef';
  for (const [x, y, r] of puffs) { c.beginPath(); c.arc(x, y + 3, r, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#ffffff';
  for (const [x, y, r] of puffs) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,0.9)';
  c.fillRect(8, 28, 48, 18);
} };

const tileCache = new Map();

// Canvas with one cell of block style v (top = the cell is on the block's top row).
function blockTile(v, top = false) {
  const style = BLOCK_PAINTERS[BLOCK_STYLE_NAMES[v]];
  if (!style) return null;
  const key = `${v}:${top && style.top ? 1 : 0}`;
  if (!tileCache.has(key)) {
    const c = document.createElement('canvas');
    c.width = c.height = TILE;
    style.paint(c.getContext('2d'), seededRandom(v * 97 + 13), top);
    tileCache.set(key, c);
  }
  return tileCache.get(key);
}

function drawTexturedBlock(ctx, o, x, y, cell, lw) {
  const style = BLOCK_PAINTERS[BLOCK_STYLE_NAMES[o.v]];
  const w = o.s * cell;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, w);
  ctx.clip();
  for (let j = 0; j < o.s; j++) {
    const tile = blockTile(o.v, j === 0);
    for (let i = 0; i < o.s; i++) {
      // +1px overlap hides seams between cells; the clip keeps it inside the block
      ctx.drawImage(tile, Math.floor(x + i * cell), Math.floor(y + j * cell), Math.ceil(cell) + 1, Math.ceil(cell) + 1);
    }
  }
  ctx.restore();
  if (!style.outline) return;
  ctx.strokeStyle = style.outline;
  ctx.lineWidth = lw * 0.8;
  ctx.strokeRect(x + lw * 0.4, y + lw * 0.4, w - lw * 0.8, w - lw * 0.8);
}

// ---------- Spikes (triangles) ----------

const SPIKE_STYLES = {
  Night: { stops: ['#2a1240', '#05060f'], outline: '#fff', glow: '#ff4d6d' },
  Lava: { stops: ['#ffe066', '#ff7a1a', '#b3170a'], outline: '#ffd27a', glow: '#ff6a00', core: 'rgba(255,245,170,0.7)' },
  Ice: { stops: ['#f2fdff', '#9fe3ff', '#3a9bd8'], outline: '#ffffff', glow: '#9fe3ff', shine: true },
  Metal: { stops: ['#e9eef3', '#8a96a3', '#4b5560'], outline: '#f5f8fb', shine: true },
  Thorn: { stops: ['#9be15d', '#3d8b2a', '#1f4d14'], outline: '#0f2a09', veins: true },
  Gold: { stops: ['#fff6b0', '#ffcf33', '#b8860b'], outline: '#fff3b0', glow: '#ffd23f', shine: true },
  Neon: { stops: ['#1a0838', '#0a0420'], outline: '#ff5cf4', glow: '#ff3df2', inner: '#3ee0ff' },
  Candy: { candy: true, outline: '#ffffff', glow: '#ff5fa8' },
  Crystal: { stops: ['#f3d9ff', '#b06bff', '#5a1fa8'], outline: '#f6e8ff', glow: '#c77dff', facets: true },
};

function polyPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// pts = screen corners: [base, base, tip]
function drawSpike(ctx, o, pts, lw) {
  const st = SPIKE_STYLES[SPIKE_STYLE_NAMES[o.v]] || SPIKE_STYLES.Night;
  const [b0, b1, tip] = pts;
  const mid = [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2];

  ctx.save();
  polyPath(ctx, pts);
  if (st.candy) {
    ctx.clip();
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const size = Math.max(...xs) - Math.min(...xs);
    ctx.drawImage(blockTile(BLOCK_STYLE_NAMES.indexOf('Candy')), Math.min(...xs), Math.min(...ys), size, size);
  } else {
    const g = ctx.createLinearGradient(tip[0], tip[1], mid[0], mid[1]);
    st.stops.forEach((c, i) => g.addColorStop(i / (st.stops.length - 1), c));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
  }

  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const line = (a, b, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
  };
  if (st.core) {
    ctx.fillStyle = st.core;
    polyPath(ctx, [lerp(mid, b0, 0.45), lerp(mid, b1, 0.45), lerp(mid, tip, 0.6)]);
    ctx.fill();
  }
  if (st.shine) line(lerp(tip, b0, 0.08), lerp(b0, mid, 0.55), 'rgba(255,255,255,0.7)', lw * 0.9);
  if (st.veins) {
    line(tip, mid, 'rgba(15,42,9,0.8)', lw * 0.6);
    for (const t of [0.35, 0.6]) {
      const p = lerp(tip, mid, t);
      line(p, lerp(p, b0, 0.35), 'rgba(15,42,9,0.6)', lw * 0.4);
      line(p, lerp(p, b1, 0.35), 'rgba(15,42,9,0.6)', lw * 0.4);
    }
  }
  if (st.facets) {
    const c = lerp(mid, tip, 0.33);
    for (const p of [tip, b0, b1]) line(c, p, 'rgba(255,255,255,0.45)', lw * 0.5);
  }
  if (st.inner) {
    ctx.shadowColor = st.inner;
    ctx.shadowBlur = 8;
    polyPath(ctx, scalePolygon(pts, 0.5));
    ctx.strokeStyle = st.inner;
    ctx.lineWidth = lw * 0.7;
    ctx.stroke();
  }
  ctx.restore();

  polyPath(ctx, pts);
  if (st.glow) {
    ctx.shadowColor = st.glow;
    ctx.shadowBlur = 8;
  }
  ctx.strokeStyle = st.outline;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// ---------- Saws (circles) ----------
// Drawn around (0, 0); the caller has translated to the centre.

function sawPath(ctx, r, teeth, inner = 0.8) {
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * inner : r * 0.98;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

function ring(ctx, r, color, width) {
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function dot(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// Classic-style toothed saw with a custom fill.
function toothedSaw(ctx, o, r, lw, time, fill, outline, glow, hub) {
  ctx.rotate(time * 5);
  sawPath(ctx, r, 8 + o.s * 4);
  ctx.fillStyle = fill;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = outline;
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();
  ring(ctx, r * 0.55, hub, lw);
  dot(ctx, 0, 0, r * 0.15, '#fff');
}

const SAW_PAINTERS = {
  Saw(ctx, o, r, lw, time) {
    toothedSaw(ctx, o, r, lw, time, '#16182e', '#fff', '#ff4d6d', 'rgba(255,77,109,0.8)');
  },

  'Ice saw'(ctx, o, r, lw, time) {
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#effcff');
    g.addColorStop(1, '#4aa8e0');
    toothedSaw(ctx, o, r, lw, time, g, '#ffffff', '#9fe3ff', 'rgba(20,90,150,0.7)');
  },

  'Gold saw'(ctx, o, r, lw, time) {
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#fff6b0');
    g.addColorStop(0.5, '#ffcf33');
    g.addColorStop(1, '#9c6f00');
    toothedSaw(ctx, o, r, lw, time, g, '#fff3b0', '#ffd23f', 'rgba(110,70,0,0.8)');
  },

  Gear(ctx, o, r, lw, time) {
    ctx.rotate(time * 2);
    const teeth = 6 + o.s * 2;
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2, w = Math.PI / teeth;
      for (const [da, rr] of [[-w * 0.95, 0.78], [-w * 0.5, 0.98], [w * 0.5, 0.98], [w * 0.95, 0.78]]) {
        ctx.lineTo(Math.cos(a + da) * r * rr, Math.sin(a + da) * r * rr);
      }
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#e8edf2');
    g.addColorStop(1, '#5d6774');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#2b3138';
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      dot(ctx, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.11, '#2b3138');
    }
    dot(ctx, 0, 0, r * 0.22, '#1a1d22');
    ring(ctx, r * 0.22, '#c9d1da', lw * 0.6);
  },

  Fireball(ctx, o, r, lw, time) {
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const rr = r * (0.84 + 0.13 * Math.sin(a * 7 + time * 14) * Math.sin(a * 3 - time * 9));
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,90,20,0.85)';
    ctx.shadowColor = '#ff6a00';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.75);
    g.addColorStop(0, '#fffbe0');
    g.addColorStop(0.45, '#ffd23f');
    g.addColorStop(1, '#ff7a1a');
    dot(ctx, 0, 0, r * 0.72, g);
  },

  'Spike ball'(ctx, o, r, lw, time) {
    ctx.rotate(time * 1.5);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, w = 0.28;
      polyPath(ctx, [
        [Math.cos(a - w) * r * 0.5, Math.sin(a - w) * r * 0.5],
        [Math.cos(a) * r * 0.99, Math.sin(a) * r * 0.99],
        [Math.cos(a + w) * r * 0.5, Math.sin(a + w) * r * 0.5],
      ]);
      ctx.fillStyle = '#c9d1da';
      ctx.fill();
      ctx.strokeStyle = '#2b2f36';
      ctx.lineWidth = lw * 0.5;
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.05, 0, 0, r * 0.62);
    g.addColorStop(0, '#7b8390');
    g.addColorStop(1, '#1f2329');
    dot(ctx, 0, 0, r * 0.6, g);
    ring(ctx, r * 0.6, '#0d0f12', lw * 0.6);
    dot(ctx, -r * 0.2, -r * 0.22, r * 0.12, 'rgba(255,255,255,0.45)');
  },

  Neon(ctx, o, r, lw, time) {
    ctx.rotate(time * 3);
    dot(ctx, 0, 0, r * 0.95, '#0d0623');
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#3ee0ff';
    ctx.setLineDash([r * 0.35, r * 0.18]);
    ring(ctx, r * 0.88, '#3ee0ff', lw);
    ctx.setLineDash([]);
    ctx.shadowColor = '#ff3df2';
    ring(ctx, r * 0.55, '#ff5cf4', lw);
    ctx.shadowBlur = 0;
    dot(ctx, 0, 0, r * 0.18, '#ffffff');
  },

  Peppermint(ctx, o, r, lw, time) {
    ctx.rotate(time * 3);
    dot(ctx, 0, 0, r * 0.95, '#ffffff');
    const n = 8;
    for (let i = 0; i < n; i += 2) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(a0 + 0.5) * r * 0.5, Math.sin(a0 + 0.5) * r * 0.5, Math.cos(a0) * r * 0.95, Math.sin(a0) * r * 0.95);
      ctx.arc(0, 0, r * 0.95, a0, a1);
      ctx.quadraticCurveTo(Math.cos(a1 + 0.5) * r * 0.5, Math.sin(a1 + 0.5) * r * 0.5, 0, 0);
      ctx.fillStyle = '#e8243c';
      ctx.fill();
    }
    ring(ctx, r * 0.95, '#b3122a', lw * 0.8);
  },
};

function drawSaw(ctx, o, r, lw, time) {
  (SAW_PAINTERS[SAW_STYLE_NAMES[o.v]] || SAW_PAINTERS.Saw)(ctx, o, r, lw, time);
}

// ---------- Jump boost ----------

function drawBoost(ctx, x, y, w, lw, time) {
  const pad = w * 0.1;
  const bob = Math.sin(time * 6) * w * 0.04;
  ctx.shadowColor = '#ffd23f';
  ctx.shadowBlur = 12 + Math.sin(time * 6) * 4;
  const g = ctx.createLinearGradient(0, y, 0, y + w);
  g.addColorStop(0, '#fff3a0');
  g.addColorStop(1, '#ff9f1a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x + pad, y + pad, w - pad * 2, w - pad * 2, w * 0.18);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#7a3d00';
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();
  // Up chevrons
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, w * 0.09);
  ctx.lineCap = 'round';
  for (const k of [0.38, 0.62]) {
    const cy = y + w * k + bob;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, cy + w * 0.1);
    ctx.lineTo(x + w * 0.5, cy - w * 0.1);
    ctx.lineTo(x + w * 0.7, cy + w * 0.1);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}
