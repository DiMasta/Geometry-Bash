// Play mode: auto-running cube, jumping, collisions, death / restart, finish.

// Pure physics simulation (no drawing), so it can also be tested headless.
// start: optional { x, y } to begin mid-level (editor test runs).
function createSim(level, start = null) {
  const columns = new Map();   // integer x -> shapes covering that column
  for (const o of level.objects) {
    for (let c = o.x; c < o.x + o.s; c++) {
      if (!columns.has(c)) columns.set(c, []);
      columns.get(c).push(o);
    }
  }

  const nearby = (x) => {
    const out = new Set();
    for (let c = Math.floor(x) - 1; c <= Math.floor(x) + 2; c++) {
      const list = columns.get(c);
      if (list) list.forEach(o => out.add(o));
    }
    return out;
  };

  const p = {
    x: start ? start.x : CONFIG.START_X, y: start ? start.y : 0,
    vy: 0, grounded: !start || start.y === 0, dead: false, won: false,
    airJumps: level.doubleJump ? CONFIG.AIR_JUMPS : 0, airJumped: false,
  };
  const end = levelEnd(level);
  let time = 0;

  // Cloud blocks vanish CLOUD_DELAY seconds after the first landing on them.
  const vanishAt = new Map();
  const gone = (o) => vanishAt.has(o) && time >= vanishAt.get(o);
  const solid = (o) => o.t === 'square' && !gone(o);
  const touchCloud = (o) => {
    if (o.v === CLOUD_STYLE && !vanishAt.has(o)) vanishAt.set(o, time + CONFIG.CLOUD_DELAY);
  };
  // 1 = solid, fading to 0 while it disappears.
  const cloudAlpha = (o) => (vanishAt.has(o) ? Math.max(0, (vanishAt.get(o) - time) / CONFIG.CLOUD_DELAY) : 1);

  let boosting = new Set();   // boosts the player is currently inside (each fires once per touch)

  // held: jump input is down (auto-jumps on landing); pressed: a new tap this step (double jump).
  // Returns 'air' when a double jump was used, 'boost' when a jump boost fired.
  function step(held, pressed = false) {
    if (p.dead || p.won) return;
    const dt = CONFIG.DT;
    time += dt;
    const near = nearby(p.x);
    let event = null;

    if (p.grounded) {
      p.airJumped = false;
      if (held || pressed) {
        p.vy = CONFIG.JUMP_V;
        p.grounded = false;
      }
    } else if (pressed && !p.airJumped && p.airJumps > 0) {
      p.vy = CONFIG.AIR_JUMP_V;
      p.airJumps--;
      p.airJumped = true;
      event = 'air';
    }

    // Horizontal: run into a block's side = death, unless only its top edge was clipped.
    p.x += CONFIG.SPEED * dt;
    for (const o of near) {
      if (!solid(o)) continue;
      const b = shapeBox(o);
      if (!boxesOverlap({ x: p.x, y: p.y, w: 1, h: 1 }, b, 1e-6)) continue;
      const top = b.y + b.h;
      if (top - p.y <= CONFIG.STEP_UP) {
        p.y = top;
        if (p.vy < 0) {
          p.vy = 0;
          touchCloud(o);
        }
      } else {
        p.dead = true;
        return;
      }
    }

    // Vertical: gravity, land on ground / block tops, die on block undersides.
    p.vy = Math.max(p.vy - CONFIG.GRAVITY * dt, -CONFIG.MAX_FALL);
    p.y += p.vy * dt;
    p.grounded = false;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.grounded = true;
    }
    for (const o of near) {
      if (!solid(o)) continue;
      const b = shapeBox(o);
      if (!boxesOverlap({ x: p.x, y: p.y, w: 1, h: 1 }, b, 1e-6)) continue;
      const top = b.y + b.h;
      if (p.vy <= 0 && top - p.y <= 0.5) {
        p.y = top;
        p.vy = 0;
        p.grounded = true;
        touchCloud(o);
      } else {
        p.dead = true;
        return;
      }
    }

    // Hazards and boosts (forgiving hitbox)
    const k = CONFIG.HAZARD_SHRINK;
    const hb = { x: p.x + k, y: p.y + k, w: 1 - 2 * k, h: 1 - 2 * k };
    const touching = new Set();
    for (const o of near) {
      if (o.t !== 'boost' || !boxesOverlap(hb, shapeBox(o))) continue;
      touching.add(o);
      if (!boosting.has(o)) {
        p.vy = Math.max(p.vy, CONFIG.BOOST_V);
        p.grounded = false;
        event = 'boost';
      }
    }
    boosting = touching;
    for (const o of near) {
      if ((o.t === 'triangle' || o.t === 'circle') && hazardHits(o, hb)) {
        p.dead = true;
        return;
      }
    }

    if (p.x >= end) p.won = true;
    return event;
  }

  return { p, end, step, gone, cloudAlpha };
}

const Game = {
  level: null,
  sim: null,
  attempts: 0,
  jumpHeld: false,
  jumpPressed: false,   // set on a fresh key press / tap, consumed by the next physics step
  angle: 0,
  camX: 0,
  camY: 0,
  acc: 0,
  deathTimer: 0,
  particles: [],
  view: null,
  reported: false,      // result screen already shown for this attempt
  steps: 0,             // physics steps this attempt (for the time stat)
  levelKey: '',
  best: 0,
  onHud: () => {},
  onResult: () => {},   // (kind: 'dead' | 'win', stats)

  // New game: attempt counter back to 1. startPos ({ x, y }) = editor test run from that cell.
  start(level, startPos = null) {
    this.level = level;
    this.startPos = startPos;
    this.levelKey = levelId(level);
    this.best = loadBest(this.levelKey);
    this.attempts = 0;
    this.jumpHeld = false;
    this.jumpPressed = false;
    this.restart();
  },

  restart() {
    this.sim = createSim(this.level, this.startPos);
    this.attempts++;
    this.angle = 0;
    this.camY = 0;
    this.acc = 0;
    this.deathTimer = 0;
    this.reported = false;
    this.steps = 0;
    this.particles = [];
    this.jumpPressed = false;
    this.updateCamera(1);
    this.onHud(this.attempts, 0, CONFIG.AIR_JUMPS);
  },

  progress() {
    const { p, end } = this.sim;
    return Math.max(0, Math.min(1, (p.x - CONFIG.START_X) / (end - CONFIG.START_X)));
  },

  update(dt) {
    const { p } = this.sim;
    this.updateParticles(dt);

    if (p.dead || p.won) {
      // Let the explosion play out before showing the result screen.
      this.deathTimer -= dt;
      if (!this.reported && this.deathTimer <= 0) {
        this.reported = true;
        this.onResult(p.won ? 'win' : 'dead', this.finishAttempt());
      }
      return;
    }

    this.acc += Math.min(dt, 0.1);
    while (this.acc >= CONFIG.DT) {
      this.acc -= CONFIG.DT;
      const event = this.sim.step(this.jumpHeld, this.jumpPressed);
      this.jumpPressed = false;
      this.steps++;
      if (event === 'air') this.airBurst(p.x + 0.5, p.y + 0.5);
      if (event === 'boost') this.airBurst(p.x + 0.5, p.y + 0.2, '#ffd23f');
      if (p.dead) {
        this.explode(p.x + 0.5, p.y + 0.5);
        this.deathTimer = 0.8;
        break;
      }
      if (p.won) {
        this.deathTimer = 0.3;
        break;
      }
    }

    // Spin in the air, settle to the nearest quarter turn on the ground.
    if (!p.grounded) {
      this.angle += (Math.PI / 0.45) * dt;
    } else {
      const target = Math.round(this.angle / (Math.PI / 2)) * (Math.PI / 2);
      this.angle += (target - this.angle) * Math.min(1, dt * 25);
      if (Math.random() < dt * 40) {
        this.particles.push({
          x: p.x, y: p.y + 0.1 + Math.random() * 0.2,
          vx: -2 - Math.random() * 2, vy: Math.random() * 2,
          life: 0.35, max: 0.35, size: 0.12, color: '#3ee0ff',
        });
      }
    }

    this.updateCamera(dt);
    this.onHud(this.attempts, this.progress(), p.airJumps);
  },

  finishAttempt() {
    const { p } = this.sim;
    const score = p.won ? 100 : Math.floor(this.progress() * 100);
    const testing = !!this.startPos;   // test runs from the editor don't count for best
    const newBest = !testing && score > this.best;
    if (newBest) {
      this.best = score;
      saveBest(this.levelKey, score);
    }
    return {
      score, newBest, testing,
      best: this.best,
      attempts: this.attempts,
      time: this.steps * CONFIG.DT,
      airJumps: p.airJumps,
    };
  },

  updateCamera(dt) {
    const { p } = this.sim;
    const viewCells = this.view ? this.view.W / this.view.scale : 20;
    this.camX = p.x - viewCells * 0.3;
    const visibleAbove = CONFIG.VIEW_ROWS - CONFIG.GROUND_ROWS;
    const targetY = Math.max(0, p.y - visibleAbove * 0.55);
    this.camY += (targetY - this.camY) * Math.min(1, dt * 6);
  },

  explode(x, y) {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 9;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.7, max: 0.7, size: 0.1 + Math.random() * 0.2,
        color: Math.random() < 0.5 ? '#ffd23f' : '#3ee0ff',
      });
    }
  },

  airBurst(x, y, color = '#ffffff') {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.particles.push({
        x, y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6,
        life: 0.35, max: 0.35, size: 0.14, color,
      });
    }
  },

  updateParticles(dt) {
    for (const q of this.particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy -= 15 * dt;
      q.life -= dt;
    }
    this.particles = this.particles.filter(q => q.life > 0);
  },

  draw(ctx, W, H, time) {
    const { p, end } = this.sim;
    const v = this.view = makeView(W, H, this.camX, this.camY);
    const hue = 225 + Math.sin(p.x / 40) * 35;
    drawBackground(ctx, v, hue);
    drawGround(ctx, v, hue);
    drawFinishLine(ctx, v, end);

    for (const o of this.level.objects) {
      if (sx(v, o.x + o.s) < 0 || sx(v, o.x) > W) continue;
      const alpha = o.v === CLOUD_STYLE && o.t === 'square' ? this.sim.cloudAlpha(o) : 1;
      if (alpha > 0) drawShape(ctx, v, o, time, alpha);
    }

    for (const q of this.particles) {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.color;
      const s = q.size * v.scale;
      ctx.fillRect(sx(v, q.x) - s / 2, sy(v, q.y) - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    if (!p.dead) drawPlayer(ctx, v, p.x, p.y, this.angle);
  },
};
