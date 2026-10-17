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
    const pts = trianglePoints(o).map(([x, y]) => [sx(v, x), sy(v, y)]);
    const ys = pts.map(p => p[1]);
    const g = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
    g.addColorStop(0, '#2a1240');
    g.addColorStop(1, '#05060f');
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowColor = '#ff4d6d';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = lw;
    ctx.stroke();
  } else if (o.t === 'circle') {
    const r = (o.s / 2) * s;
    const cx = sx(v, o.x + o.s / 2), cy = sy(v, o.y + o.s / 2);
    const teeth = 8 + o.s * 4;
    ctx.translate(cx, cy);
    ctx.rotate(time * 5);
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const rr = i % 2 ? r * 0.8 : r * 0.98;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = '#16182e';
    ctx.shadowColor = '#ff4d6d';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,77,109,0.8)';
    ctx.lineWidth = lw;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(ctx, v, x, y, angle) {
  const s = v.scale;
  const cx = sx(v, x + 0.5), cy = sy(v, y + 0.5);
  ctx.save();
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
  ctx.strokeStyle = style.outline;
  ctx.lineWidth = lw * 0.8;
  ctx.strokeRect(x + lw * 0.4, y + lw * 0.4, w - lw * 0.8, w - lw * 0.8);
}
