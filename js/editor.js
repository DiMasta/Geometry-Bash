// Level editor: place / erase shapes on a grid, scroll, undo, pick a test start.

const SHAPE_TOOLS = ['square', 'triangle', 'circle', 'boost'];

const Editor = {
  level: newLevel(),
  tool: 'square',     // square | triangle | circle | boost | eraser | pan | flag
  size: 1,
  rot: 0,
  variants: { square: 0, triangle: 0, circle: 0, boost: 0 },   // chosen texture per shape
  testStart: null,    // { x, y }: Play starts here instead of the level start (editor only)
  onTestStart: () => {},
  camX: CONFIG.START_X - 1,
  view: null,
  hover: null,        // { x, y } world position of the pointer
  stroke: null,       // { mode: 'place' | 'erase' | 'pan', before, lastKey, startX, startCam }
  undoStack: [],
  onChange: () => {},

  setLevel(level, keepUndo = false) {
    this.level = level;
    if (!keepUndo) this.undoStack = [];
    this.clampCamera();
    this.onChange();
  },

  maxCamX() {
    const viewCells = this.view ? this.view.W / this.view.scale : 20;
    return Math.max(CONFIG.START_X - 1, levelEnd(this.level) + 4 - viewCells * 0.5);
  },

  clampCamera() {
    this.camX = Math.min(this.maxCamX(), Math.max(CONFIG.START_X - 1, this.camX));
  },

  // Where the camera starts: show the spawn on wide screens, column 0 on phones.
  homeX() {
    const viewCells = this.view ? this.view.W / this.view.scale : 20;
    return viewCells < 14 ? -1 : CONFIG.START_X - 1;
  },

  scrollBy(cells) {
    this.camX += cells;
    this.clampCamera();
  },

  // ---------- Editing ----------

  snapshot() {
    return JSON.stringify(this.level.objects);
  },

  pushUndo(before) {
    this.undoStack.push(before);
    if (this.undoStack.length > 200) this.undoStack.shift();
  },

  undo() {
    const prev = this.undoStack.pop();
    if (prev == null) return false;
    this.level.objects = JSON.parse(prev);
    this.onChange();
    return true;
  },

  clear() {
    if (!this.level.objects.length) return;
    this.pushUndo(this.snapshot());
    this.level.objects = [];
    this.onChange();
  },

  cellFor(wx, wy) {
    const s = SHAPE_TOOLS.includes(this.tool) ? this.size : 1;
    // Centre multi-cell shapes on the pointer
    let x = Math.floor(wx - (s - 1) / 2);
    let y = Math.floor(wy - (s - 1) / 2);
    y = Math.max(0, Math.min(CONFIG.MAX_Y + 1 - s, y));
    return { x, y, s, valid: x >= 0 && wy >= 0 };
  },

  placeAt(wx, wy) {
    const c = this.cellFor(wx, wy);
    if (!c.valid) return false;
    const obj = {
      t: this.tool, x: c.x, y: c.y, s: c.s,
      r: this.tool === 'triangle' ? this.rot : 0,
      v: this.variants[this.tool] || 0,
    };
    const box = shapeBox(obj);
    const same = this.level.objects.find(o =>
      o.t === obj.t && o.x === obj.x && o.y === obj.y && o.s === obj.s && o.r === obj.r && o.v === obj.v);
    if (same) return false;
    this.level.objects = this.level.objects.filter(o => !boxesOverlap(shapeBox(o), box, 0.01));
    this.level.objects.push(obj);
    return true;
  },

  // Test start: tap a cell to start test runs there; tap it again to go back to the normal start.
  // A start inside a block moves up to the first free cell.
  setTestStart(wx, wy) {
    const c = this.cellFor(wx, wy);
    if (!c.valid) return;
    let y = c.y;
    const blocked = (yy) => this.level.objects.some(o => o.t === 'square' && pointInBox(c.x + 0.5, yy + 0.5, shapeBox(o)));
    while (y < CONFIG.MAX_Y && blocked(y)) y++;
    const same = this.testStart && this.testStart.x === c.x && this.testStart.y === y;
    this.testStart = same ? null : { x: c.x, y };
    this.onTestStart();
  },

  clearTestStart() {
    this.testStart = null;
    this.onTestStart();
  },

  eraseAt(wx, wy) {
    const t = this.testStart;
    if (t && pointInBox(wx, wy, { x: t.x, y: t.y, w: 1, h: 1 })) {
      this.clearTestStart();
      return false;
    }
    const before = this.level.objects.length;
    this.level.objects = this.level.objects.filter(o => !pointInBox(wx, wy, shapeBox(o)));
    return this.level.objects.length !== before;
  },

  // ---------- Input ----------

  pointerDown(px, py, button) {
    const w = screenToWorld(this.view, px, py);
    if (this.tool === 'flag' && button === 0) {
      this.setTestStart(w.x, w.y);
      return;
    }
    let mode;
    if (button === 1 || this.tool === 'pan') mode = 'pan';
    else if (button === 2 || this.tool === 'eraser') mode = 'erase';
    else mode = 'place';
    this.stroke = { mode, before: this.snapshot(), changed: false, startX: px, startCam: this.camX };
    if (mode !== 'pan') this.applyStroke(w);
  },

  // Second finger down: undo what the first finger painted and pan instead.
  beginTwoFingerPan(px) {
    if (this.stroke?.changed) {
      this.level.objects = JSON.parse(this.stroke.before);
      this.onChange();
    }
    this.stroke = { mode: 'pan', before: this.snapshot(), changed: false, startX: px, startCam: this.camX };
  },

  pointerMove(px, py) {
    if (!this.view) return;
    const w = screenToWorld(this.view, px, py);
    this.hover = w;
    if (!this.stroke) return;
    if (this.stroke.mode === 'pan') {
      this.camX = this.stroke.startCam - (px - this.stroke.startX) / this.view.scale;
      this.clampCamera();
    } else {
      this.applyStroke(w);
    }
  },

  applyStroke(w) {
    const changed = this.stroke.mode === 'erase' ? this.eraseAt(w.x, w.y) : this.placeAt(w.x, w.y);
    if (changed) {
      this.stroke.changed = true;
      this.onChange();
    }
  },

  pointerUp() {
    if (this.stroke?.changed) this.pushUndo(this.stroke.before);
    this.stroke = null;
  },

  pointerLeave() {
    this.hover = null;
  },

  // ---------- Drawing ----------

  draw(ctx, W, H, time) {
    const v = this.view = makeView(W, H, this.camX, 0, CONFIG.EDIT_MIN_COLS);
    drawBackground(ctx, v, 225);
    drawGround(ctx, v, 225);

    // Grid over the buildable area
    const x0 = Math.max(0, Math.floor(v.camX));
    const x1 = Math.ceil(v.camX + W / v.scale);
    const topY = sy(v, CONFIG.MAX_Y + 1), groundY = sy(v, 0);
    ctx.lineWidth = 1;
    for (let x = x0; x <= x1; x++) {
      ctx.strokeStyle = x % 5 === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(sx(v, x) + 0.5, topY);
      ctx.lineTo(sx(v, x) + 0.5, groundY);
      ctx.stroke();
    }
    const gx0 = sx(v, x0), gx1 = sx(v, x1);
    for (let y = 1; y <= CONFIG.MAX_Y + 1; y++) {
      ctx.strokeStyle = y === CONFIG.MAX_Y + 1 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(gx0, sy(v, y) + 0.5);
      ctx.lineTo(gx1, sy(v, y) + 0.5);
      ctx.stroke();
    }

    // Column numbers every 10 cells
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `${Math.max(10, v.scale * 0.32)}px sans-serif`;
    ctx.textAlign = 'center';
    for (let x = Math.ceil(x0 / 10) * 10; x <= x1; x += 10) {
      ctx.fillText(String(x), sx(v, x), groundY + v.scale * 0.6);
    }

    // Start area
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(sx(v, CONFIG.START_X - 1), 0, sx(v, 0) - sx(v, CONFIG.START_X - 1), groundY);
    drawPlayer(ctx, v, CONFIG.START_X, 0, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('START', sx(v, CONFIG.START_X + 0.5), sy(v, 1.5));

    drawFinishLine(ctx, v, levelEnd(this.level));

    for (const o of this.level.objects) {
      if (sx(v, o.x + o.s) < 0 || sx(v, o.x) > W) continue;
      drawShape(ctx, v, o, time);
    }

    if (this.testStart) {
      const t = this.testStart;
      drawPlayer(ctx, v, t.x, t.y, 0, 0.8);
      // Flag above the cube
      const fx = sx(v, t.x + 0.5), fy = sy(v, t.y + 1);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - v.scale * 0.8); ctx.stroke();
      ctx.fillStyle = '#3ddc84';
      ctx.beginPath();
      ctx.moveTo(fx, fy - v.scale * 0.8);
      ctx.lineTo(fx + v.scale * 0.45, fy - v.scale * 0.65);
      ctx.lineTo(fx, fy - v.scale * 0.5);
      ctx.fill();
    }

    this.drawHover(ctx, v, time);
  },

  drawHover(ctx, v, time) {
    if (!this.hover || this.tool === 'pan' || this.stroke?.mode === 'pan') return;
    const { x: wx, y: wy } = this.hover;
    if (this.tool === 'eraser' || this.stroke?.mode === 'erase') {
      const target = this.level.objects.find(o => pointInBox(wx, wy, shapeBox(o)));
      if (target) {
        ctx.strokeStyle = '#ff4d6d';
        ctx.lineWidth = 3;
        ctx.strokeRect(sx(v, target.x), sy(v, target.y + target.s), target.s * v.scale, target.s * v.scale);
      }
      return;
    }
    const c = this.cellFor(wx, wy);
    if (!c.valid) return;
    ctx.fillStyle = 'rgba(255,210,63,0.15)';
    ctx.fillRect(sx(v, c.x), sy(v, c.y + c.s), c.s * v.scale, c.s * v.scale);
    if (this.tool === 'flag') {
      drawPlayer(ctx, v, c.x, c.y, 0, 0.45);
      return;
    }
    drawShape(ctx, v, { t: this.tool, x: c.x, y: c.y, s: c.s, r: this.rot, v: this.variants[this.tool] || 0 }, time, 0.6);
  },
};
