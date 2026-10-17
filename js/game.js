// Play mode: auto-running cube, jumping, collisions, death / restart, finish.

// Pure physics simulation (no drawing), so it can also be tested headless.
// start: optional { x, y } override (editor test runs); otherwise the level's own start.
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

  const from = start || level.start || { x: CONFIG.START_X, y: 0 };
  const p = {
    x: from.x, y: from.y, vy: 0, grounded: from.y === 0, dead: false, won: false,
    airJumps: level.doubleJump ? CONFIG.AIR_JUMPS : 0, airJumped: false,
    speedMul: 1, rockets: 0,
  };
  const end = levelEnd(level);
  let time = 0;

  const events = [];           // { type, x, y, o? } for effects; the game drains it every frame
  const emit = (type, o, x, y) => events.push({ type, o, x: x ?? o.x + o.s / 2, y: y ?? o.y + o.s / 2 });

  // Shapes taken out of play: collected pickups, shattered glass, blocks hit by rockets.
  const removed = new Set();
  // Cloud / glass blocks: time they disappear after first being landed on.
  const vanishAt = new Map();
  const gone = (o) => removed.has(o) || (vanishAt.has(o) && time >= vanishAt.get(o));
  const solid = (o) => o.t === 'square' && !gone(o);
  const landedOn = (o) => {
    if (vanishAt.has(o)) return;
    if (o.v === CLOUD_STYLE) vanishAt.set(o, time + CONFIG.CLOUD_DELAY);
    if (o.v === GLASS_STYLE) vanishAt.set(o, time + CONFIG.GLASS_DELAY);
  };
  const shattered = new Set();
  // Drawing opacity: 0 once gone; clouds fade out while vanishing.
  const alpha = (o) => {
    if (gone(o)) return 0;
    if (o.v === CLOUD_STYLE && vanishAt.has(o)) return Math.max(0, (vanishAt.get(o) - time) / CONFIG.CLOUD_DELAY);
    return 1;
  };

  let boosting = new Set();    // boosts the player is currently inside (each fires once per touch)
  const rockets = [];          // { x, y, life }
  let fireQueued = false;

  function fire() {
    if (p.rockets > 0 && !p.dead && !p.won) fireQueued = true;
  }

  function updateRockets(dt) {
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.x += (CONFIG.SPEED * p.speedMul + CONFIG.ROCKET_SPEED) * dt;
      r.life -= dt;
      const box = { x: r.x, y: r.y - 0.15, w: 0.6, h: 0.3 };
      let hit = null;
      for (const o of nearby(r.x)) {
        if ((solid(o) || (o.t === 'glass' && !gone(o))) && boxesOverlap(box, shapeBox(o))) { hit = o; break; }
      }
      if (hit) {
        removed.add(hit);
        emit('explode', hit);
        rockets.splice(i, 1);
      } else if (r.life <= 0) {
        rockets.splice(i, 1);
      }
    }
  }

  // held: jump input is down (auto-jumps on landing); pressed: a new tap this step (double jump).
  // Returns 'air' when a double jump was used, 'boost' when a jump boost fired.
  function step(held, pressed = false) {
    if (p.dead || p.won) return;
    const dt = CONFIG.DT;
    time += dt;
    let event = null;

    // Glass blocks that just broke under the player
    for (const [o, t] of vanishAt) {
      if (o.v === GLASS_STYLE && time >= t && !shattered.has(o)) {
        shattered.add(o);
        emit('shatter', o);
      }
    }

    if (fireQueued) {
      fireQueued = false;
      p.rockets--;
      rockets.push({ x: p.x + 0.8, y: p.y + 0.5, life: CONFIG.ROCKET_RANGE });
      emit('launch', null, p.x + 1, p.y + 0.5);
    }
    updateRockets(dt);

    const near = nearby(p.x);

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
    p.x += CONFIG.SPEED * p.speedMul * dt;
    for (const o of near) {
      if (!solid(o)) continue;
      const b = shapeBox(o);
      if (!boxesOverlap({ x: p.x, y: p.y, w: 1, h: 1 }, b, 1e-6)) continue;
      const top = b.y + b.h;
      if (top - p.y <= CONFIG.STEP_UP) {
        p.y = top;
        if (p.vy < 0) {
          p.vy = 0;
          landedOn(o);
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
        landedOn(o);
      } else {
        p.dead = true;
        return;
      }
    }

    // Touching things: glass walls break, pickups are collected, boosts launch (forgiving hitbox)
    const body = { x: p.x, y: p.y, w: 1, h: 1 };
    const k = CONFIG.HAZARD_SHRINK;
    const hb = { x: p.x + k, y: p.y + k, w: 1 - 2 * k, h: 1 - 2 * k };
    const touching = new Set();
    for (const o of near) {
      if (gone(o)) continue;
      if (o.t === 'glass' && boxesOverlap(body, shapeBox(o))) {
        removed.add(o);
        emit('shatter', o);
      } else if (o.t === 'speed' && boxesOverlap(hb, shapeBox(o))) {
        removed.add(o);
        p.speedMul = SPEED_VALUES[o.v] ?? 1;
        emit('collect', o);
      } else if (o.t === 'rocket' && boxesOverlap(hb, shapeBox(o))) {
        removed.add(o);
        p.rockets = CONFIG.ROCKETS;
        emit('collect', o);
      } else if (o.t === 'boost' && boxesOverlap(hb, shapeBox(o))) {
        touching.add(o);
        if (!boosting.has(o)) {
          p.vy = Math.max(p.vy, CONFIG.BOOST_V);
          p.grounded = false;
          event = 'boost';
        }
      }
    }
    boosting = touching;

    for (const o of near) {
      if ((o.t === 'triangle' || o.t === 'circle') && !gone(o) && hazardHits(o, hb)) {
        p.dead = true;
        return;
      }
    }

    if (p.x >= end) p.won = true;
    return event;
  }

  return { p, end, from, step, fire, gone, alpha, rockets, events };
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
    this.levelKey = levelKey(level);
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
    this.onHud(this.attempts, this.progress(), this.sim.p);
  },

  // Fire a rocket (if the player has any); it launches on the next physics step.
  fire() {
    if (this.sim) this.sim.fire();
  },

  // 0..1 of the way from the level's start to the finish line.
  progress() {
    const { p, end } = this.sim;
    const from = this.level.start?.x ?? CONFIG.START_X;
    return Math.max(0, Math.min(1, (p.x - from) / (end - from)));
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
    this.playEvents();
    for (const r of this.sim.rockets) {
      this.particles.push({
        x: r.x - 0.1, y: r.y + (Math.random() - 0.5) * 0.15, vx: -3, vy: (Math.random() - 0.5) * 2,
        life: 0.25, max: 0.25, size: 0.12, color: Math.random() < 0.5 ? '#ffd23f' : '#ff7a1a',
      });
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
    this.onHud(this.attempts, this.progress(), p);
  },

  // Particles for things that happened in the simulation this frame.
  playEvents() {
    for (const e of this.sim.events) {
      if (e.type === 'shatter') this.burst(e.x, e.y, ['#dff6ff', '#9fd8f5', '#ffffff'], 24, 7);
      else if (e.type === 'explode') this.burst(e.x, e.y, ['#ffd23f', '#ff7a1a', '#ff4d6d', '#555'], 34, 9);
      else if (e.type === 'collect') this.airBurst(e.x, e.y, e.o.t === 'rocket' ? '#ff4d6d' : speedColor(e.o.v));
      else if (e.type === 'launch') this.burst(e.x, e.y, ['#ffd23f', '#ffffff'], 8, 4);
    }
    this.sim.events.length = 0;
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
    this.camX = p.x - viewCells * (p.speedMul > 1 ? 0.22 : 0.3);   // look further ahead when fast
    const visibleAbove = CONFIG.VIEW_ROWS - CONFIG.GROUND_ROWS;
    const targetY = Math.max(0, p.y - visibleAbove * 0.55);
    this.camY += (targetY - this.camY) * Math.min(1, dt * 6);
  },

  explode(x, y) {
    this.burst(x, y, ['#ffd23f', '#3ee0ff'], 40, 9);
  },

  burst(x, y, colors, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.3 + Math.random() * 0.8);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.7, max: 0.7, size: 0.1 + Math.random() * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
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
      const alpha = this.sim.alpha(o);
      if (alpha > 0) drawShape(ctx, v, o, time, alpha);
    }
    for (const r of this.sim.rockets) drawRocket(ctx, v, r.x, r.y, time);

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
