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

function drawBackground(ctx, v, hue) {
  const g = ctx.createLinearGradient(0, 0, 0, v.H);
  g.addColorStop(0, `hsl(${hue}, 70%, 32%)`);
  g.addColorStop(1, `hsl(${hue + 25}, 75%, 16%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, v.W, v.H);

  // Parallax squares
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

  if (o.t === 'square') {
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
