// App wiring: canvas, main loop, toolbar, keyboard, level library, saving and sharing.

(() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  let mode = 'edit';
  let W = 0, H = 0;

  // ---------- Canvas sizing ----------

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // ---------- Toast ----------

  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  // ---------- Level library (autosaved) ----------

  let library = loadLibrary();   // { [id]: level }; Editor.level is one of these objects
  let saveTimer = null;

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!Editor.level) return;
    Editor.level.updated = Date.now();
    library[Editor.level.id] = Editor.level;
    if (!storeLibrary(library, Editor.level.id)) toast('Could not save — browser storage is full or blocked');
  }
  // Edits arrive many times per drag; write at most a few times a second.
  function saveSoon() {
    if (!saveTimer) saveTimer = setTimeout(saveNow, 300);
  }
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

  Editor.onChange = () => {
    saveSoon();
    syncScroll();
  };

  function syncScroll() {
    const min = CONFIG.START_X - 1, max = Editor.maxCamX();
    const el = $('scroll');
    el.value = max > min ? ((Editor.camX - min) / (max - min)) * 100 : 0;
  }

  $('scroll').addEventListener('input', (e) => {
    const min = CONFIG.START_X - 1, max = Editor.maxCamX();
    Editor.camX = min + (max - min) * (e.target.value / 100);
  });

  // ◀ ▶ buttons: tap to step, hold to keep scrolling.
  function holdToScroll(btn, dir) {
    let timer = null;
    const stop = () => { clearInterval(timer); timer = null; };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stop();
      Editor.scrollBy(dir * 3);
      syncScroll();
      timer = setInterval(() => { Editor.scrollBy(dir * 0.6); syncScroll(); }, 30);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
  }
  holdToScroll($('scrollLeft'), -1);
  holdToScroll($('scrollRight'), 1);

  function setTool(tool) {
    Editor.tool = tool;
    document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    canvas.classList.toggle('pan', tool === 'pan');
    renderOptionsBar();
  }

  // ---------- Options bar: size, rotation and texture of the selected shape ----------

  function previewTile(t, v) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const view = { W: 64, H: 64, scale: 56, camX: -4 / 56, camY: 0, groundY: 60 };
    drawShape(c.getContext('2d'), view, { t, x: 0, y: 0, s: 1, r: 0, v }, 0.3);
    return c;
  }

  function renderOptionsBar() {
    const tool = Editor.tool;
    $('optionsBar').hidden = !SHAPE_TOOLS.includes(tool);
    $('rotateBtn').hidden = tool !== 'triangle';
    const sw = $('swatches');
    sw.innerHTML = '';
    const kinds = tool === 'item'
      ? ITEM_KINDS
      : (STYLE_NAMES[tool] || []).map((name, v) => ({ t: tool, v, name }));
    if (kinds.length < 2) return;
    kinds.forEach(({ t, v: kv, name }, v) => {
      const b = document.createElement('button');
      b.title = name;
      b.setAttribute('role', 'radio');
      b.appendChild(previewTile(t, kv));
      b.addEventListener('click', () => setVariant(v));
      sw.appendChild(b);
    });
    setVariant(Editor.variants[tool] || 0);
  }

  function setVariant(v) {
    Editor.variants[Editor.tool] = v;
    $('swatches').querySelectorAll('button').forEach((b, i) => {
      b.classList.toggle('active', i === v);
      b.setAttribute('aria-checked', String(i === v));
    });
  }

  // ---------- Test start ----------

  Editor.onTestStart = () => {
    const t = Editor.testStart;
    $('testChip').hidden = !t;
    if (t) $('testCol').textContent = ` ${t.x}`;
    $('playBtn').title = t ? `Test from column ${t.x} (P / Enter)` : 'Play this level (P / Enter)';
    $('playBtn').querySelector('.lbl-play').textContent = t ? ' Test' : ' Play';
  };
  $('testChip').addEventListener('click', () => Editor.clearTestStart());
  renderOptionsBar();
  document.querySelectorAll('.tool').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

  function setSize(size) {
    Editor.size = size;
    $('sizeLabel').textContent = `${size}×`;
  }
  $('sizeBtn').addEventListener('click', () => setSize((Editor.size % 3) + 1));

  function rotate() {
    Editor.rot = (Editor.rot + 1) % 4;
    $('rotateBtn').title = `Rotate triangle (R) — pointing ${ROT_NAMES[Editor.rot]}`;
    $('rotIcon').style.transform = `rotate(${Editor.rot * 90}deg)`;
    if (Editor.tool !== 'triangle') setTool('triangle');
  }
  $('rotateBtn').addEventListener('click', rotate);

  $('undoBtn').addEventListener('click', () => Editor.undo());
  $('clearBtn').addEventListener('click', () => {
    if (Editor.level.objects.length && confirm('Remove every shape from this level?')) {
      Editor.clear();
      closeMenu();
    }
  });

  // ---------- Level menu (☰) ----------

  function openMenu() {
    $('menu').hidden = false;
    $('menuBtn').setAttribute('aria-expanded', 'true');
  }
  function closeMenu() {
    $('menu').hidden = true;
    $('menuBtn').setAttribute('aria-expanded', 'false');
  }
  $('menuBtn').addEventListener('click', () => ($('menu').hidden ? openMenu() : closeMenu()));
  document.addEventListener('pointerdown', (e) => {
    if (!$('menu').hidden && !$('menu').contains(e.target) && e.target !== $('menuBtn')) closeMenu();
  });

  $('levelName').addEventListener('input', (e) => {
    Editor.level.name = e.target.value.slice(0, 40) || 'My Level';
    saveSoon();
  });

  // Open a level from the library in the editor.
  function openLevel(level, message) {
    if (Editor.level && Editor.level !== level) saveNow();
    library[level.id] = level;
    Editor.view = Editor.view || makeView(W, H, 0, 0, CONFIG.EDIT_MIN_COLS);
    Editor.level = level;
    Editor.camX = Editor.homeX();
    Editor.setLevel(level);
    $('levelName').value = level.name;
    $('doubleJumpToggle').checked = level.doubleJump;
    $('levelCount').textContent = Object.keys(library).length;
    closeMenu();
    saveNow();
    if (message) toast(message);
  }

  // Add a level that came from outside (link / file); reuse an identical one if it's already there.
  function addExternalLevel(level, message) {
    const same = Object.values(library).find(l => l.name === level.name && levelKey(l) === levelKey(level));
    if (same) return openLevel(same, message);
    level.id = newLevelId();
    openLevel(level, message);
  }

  $('doubleJumpToggle').addEventListener('change', (e) => {
    Editor.level.doubleJump = e.target.checked;
    saveSoon();
    toast(e.target.checked ? 'Double jump on for this level' : 'Double jump off');
  });

  // ---------- My levels screen ----------

  const THUMB_COLORS = ['#ffffff', '#c0583b', '#b8823f', '#8a9099', '#c3ccd6', '#4caf50', '#9fe3ff', '#ff5cf4', '#ff8fc4', '#ffffff', '#bfe8ff'];

  function drawThumb(canvas, level) {
    canvas.width = 220;
    canvas.height = 72;
    const c = canvas.getContext('2d');
    const from = CONFIG.START_X, end = levelEnd(level);
    const kx = canvas.width / (end - from + 2), ky = (canvas.height - 8) / (CONFIG.MAX_Y + 1);
    const X = (x) => (x - from + 1) * kx, Y = (y) => canvas.height - 8 - y * ky;
    c.fillStyle = '#0a0f2e';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = '#2c3a85';
    c.fillRect(0, canvas.height - 8, canvas.width, 8);
    for (const o of level.objects) {
      c.fillStyle = o.t === 'square' ? THUMB_COLORS[o.v] : (o.t === 'triangle' || o.t === 'circle') ? '#ff4d6d' : '#ffd23f';
      c.fillRect(X(o.x), Y(o.y + o.s), Math.max(1.5, o.s * kx), Math.max(1.5, o.s * ky));
    }
    c.fillStyle = '#3ddc84';
    c.fillRect(X(level.start.x), Y(level.start.y + 1), Math.max(3, kx), ky);
  }

  function timeAgo(t) {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
  }

  function renderLevelList() {
    const list = $('levelList');
    list.innerHTML = '';
    const levels = Object.values(library).sort((a, b) => b.updated - a.updated);
    for (const level of levels) {
      const li = document.createElement('li');
      li.className = 'level-item' + (level === Editor.level ? ' current' : '');
      const thumb = document.createElement('canvas');
      drawThumb(thumb, level);
      const info = document.createElement('div');
      info.className = 'info';
      const name = document.createElement('b');
      name.textContent = level.name;
      const meta = document.createElement('small');
      const best = loadBest(levelKey(level));
      meta.textContent = `${level.objects.length} shapes · best ${best}% · ${timeAgo(level.updated)}`;
      info.append(name, meta);
      const btn = (label, title, fn) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.title = title;
        b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
        return b;
      };
      li.append(thumb, info,
        btn('✎', 'Rename', () => renameLevel(level)),
        btn('⧉', 'Duplicate', () => duplicateLevel(level)),
        btn('🗑', 'Delete', () => deleteLevel(level)));
      li.addEventListener('click', () => {
        closeLevels();
        if (level !== Editor.level) openLevel(level, `Opened “${level.name}”`);
      });
      list.appendChild(li);
    }
  }

  function openLevels() {
    saveNow();
    closeMenu();
    renderLevelList();
    $('levelsScreen').hidden = false;
  }
  function closeLevels() {
    $('levelsScreen').hidden = true;
  }

  function createLevel() {
    const name = prompt('Name your new level:', `Level ${Object.keys(library).length + 1}`);
    if (name === null) return;
    closeLevels();
    openLevel(newLevel(name.trim().slice(0, 40) || 'My Level'), 'New level — start building!');
  }

  function renameLevel(level) {
    const name = prompt('Rename level:', level.name);
    if (name === null || !name.trim()) return;
    level.name = name.trim().slice(0, 40);
    if (level === Editor.level) $('levelName').value = level.name;
    library[level.id] = level;
    storeLibrary(library, Editor.level.id);
    renderLevelList();
  }

  function duplicateLevel(level) {
    saveNow();
    const copy = sanitizeLevel(JSON.parse(JSON.stringify(level)));
    copy.id = newLevelId();
    copy.name = `${level.name} copy`.slice(0, 40);
    copy.updated = Date.now();
    library[copy.id] = copy;
    storeLibrary(library, Editor.level.id);
    $('levelCount').textContent = Object.keys(library).length;
    renderLevelList();
  }

  function deleteLevel(level) {
    if (!confirm(`Delete “${level.name}”? This can't be undone.`)) return;
    delete library[level.id];
    if (level === Editor.level) {
      const next = Object.values(library).sort((a, b) => b.updated - a.updated)[0];
      Editor.level = null;
      openLevel(next || newLevel('My Level'));
    } else {
      storeLibrary(library, Editor.level.id);
    }
    $('levelCount').textContent = Object.keys(library).length;
    renderLevelList();
  }

  $('levelsBtn').addEventListener('click', openLevels);
  $('newLevelMenuBtn').addEventListener('click', createLevel);
  $('newLevelBtn').addEventListener('click', createLevel);
  $('closeLevelsBtn').addEventListener('click', closeLevels);
  $('levelsScreen').addEventListener('pointerdown', (e) => { if (e.target === $('levelsScreen')) closeLevels(); });

  // ---------- Share / export / import ----------

  $('shareBtn').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#L=${encodeLevel(Editor.level)}`;
    history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied! Anyone with it can play your level.');
    } catch {
      prompt('Copy this link to share your level:', url);
    }
  });

  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([levelToJSON(Editor.level)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(Editor.level.name || 'level').replace(/[^\w-]+/g, '_')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      addExternalLevel(levelFromJSON(await file.text()), `Imported “${file.name}” into My levels`);
    } catch {
      toast('That file is not a valid level');
    }
  });

  // ---------- Modes ----------

  function startPlay() {
    if (mode === 'play') return;
    mode = 'play';
    closeMenu();
    document.body.classList.add('playing');
    $('hud').hidden = false;
    hideResult();
    canvas.classList.add('playing');
    $('toast').hidden = true;
    Editor.stroke = null;
    Game.start(sanitizeLevel(Editor.level), Editor.testStart);
  }

  function stopPlay() {
    mode = 'edit';
    document.body.classList.remove('playing');
    $('hud').hidden = true;
    hideResult();
    canvas.classList.remove('playing');
    $('rocketBtn').hidden = true;
    Game.jumpHeld = false;
    syncScroll();
  }

  // ---------- Result screen: crash or level complete ----------

  let resultKind = null;      // 'dead' | 'win' while the screen is open
  let resultShownAt = 0;

  function showResult(kind, stats) {
    resultKind = kind;
    resultShownAt = performance.now();
    Game.jumpHeld = false;
    const card = $('resultScreen').querySelector('.card');
    card.classList.toggle('win', kind === 'win');
    $('resultTitle').textContent = kind === 'win'
      ? (stats.attempts === 1 ? 'Flawless!' : 'Level Complete!')
      : 'Crashed!';
    if (stats.testing) $('resultTitle').textContent += ' (test run)';
    $('resultScore').textContent = `${stats.score}%`;
    $('resultBest').textContent = `${stats.best}%`;
    $('resultAttempt').textContent = stats.attempts;
    $('resultTime').textContent = `${stats.time.toFixed(1)}s`;
    $('resultAir').textContent = stats.airJumps;
    $('resultAirRow').hidden = !Game.level.doubleJump;
    document.querySelector('#resultScreen .stats').classList.toggle('three', !Game.level.doubleJump);
    $('newBest').hidden = !stats.newBest;
    $('retryBtn').hidden = kind === 'win';
    $('newGameBtn').classList.toggle('play', kind === 'win');
    $('resultScreen').querySelector('.keys').textContent = kind === 'win'
      ? 'Space: new game · Esc: edit'
      : 'Space: retry · N: new game · Esc: edit';
    $('resultScreen').hidden = false;
    document.body.classList.add('result-open');
  }

  function hideResult() {
    resultKind = null;
    $('resultScreen').hidden = true;
    document.body.classList.remove('result-open');
  }

  function retry() {
    hideResult();
    Game.jumpHeld = false;
    Game.restart();
  }

  function newGame() {
    hideResult();
    Game.start(Game.level, Game.startPos);
  }

  Game.onResult = showResult;

  Game.onHud = (attempts, progress, p) => {
    $('attempt').textContent = Game.startPos ? `Test · Attempt ${attempts}` : `Attempt ${attempts}`;
    $('airJumpsHud').hidden = !Game.level.doubleJump;
    $('airJumps').textContent = '●'.repeat(p.airJumps) + '○'.repeat(CONFIG.AIR_JUMPS - p.airJumps);
    $('speedHud').hidden = p.speedMul === 1;
    $('speedHud').textContent = `${p.speedMul > 1 ? '⏩' : '🐢'} ${SPEED_NAMES[SPEED_VALUES.indexOf(p.speedMul)] || p.speedMul + '×'}`;
    $('rocketBtn').hidden = p.rockets <= 0 || p.dead || p.won;
    $('rocketCount').textContent = p.rockets;
    const pct = Math.floor(progress * 100);
    $('percent').textContent = `${pct}%`;
    $('progressFill').style.width = `${pct}%`;
  };

  $('playBtn').addEventListener('click', startPlay);
  $('stopBtn').addEventListener('click', stopPlay);
  $('retryBtn').addEventListener('click', retry);
  $('newGameBtn').addEventListener('click', newGame);
  $('editBtn').addEventListener('click', stopPlay);
  $('rocketBtn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    Game.fire();
  });

  // ---------- Pointer input ----------

  const localPos = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Active touches in the editor: one finger draws, two fingers pan.
  const touches = new Map();
  const avgX = () => [...touches.values()].reduce((a, x) => a + x, 0) / touches.size;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    if (mode === 'play') {
      Game.jumpHeld = true;
      Game.jumpPressed = true;
      return;
    }
    const [x, y] = localPos(e);
    touches.set(e.pointerId, x);
    if (touches.size === 1) {
      Editor.pointerDown(x, y, e.button);
    } else if (touches.size === 2) {
      Editor.beginTwoFingerPan(avgX());
    }
    if (Editor.stroke?.mode === 'pan') canvas.classList.add('panning');
  });

  canvas.addEventListener('pointermove', (e) => {
    if (mode !== 'edit') return;
    const [x, y] = localPos(e);
    if (touches.has(e.pointerId)) touches.set(e.pointerId, x);
    if (touches.size > 1 && !touches.has(e.pointerId)) return;
    Editor.pointerMove(touches.size > 1 ? avgX() : x, y);
    if (Editor.stroke?.mode === 'pan') syncScroll();
  });

  const endPointer = (e) => {
    if (mode === 'play') {
      Game.jumpHeld = false;
    } else {
      // The stroke ends when the first finger lifts; the rest are ignored until all are up.
      if (touches.delete(e.pointerId) && Editor.stroke) Editor.pointerUp();
      if (!touches.size) Editor.stroke = null;
    }
    canvas.classList.remove('panning');
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => Editor.pointerLeave());

  canvas.addEventListener('wheel', (e) => {
    if (mode !== 'edit') return;
    e.preventDefault();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const px = e.deltaMode === 1 ? delta * 16 : delta;
    Editor.scrollBy(px / (Editor.view?.scale || 40));
    syncScroll();
  }, { passive: false });

  // ---------- Keyboard ----------

  const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'];
  const typing = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;

  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    if (e.code === 'Escape' && !$('menu').hidden) {
      closeMenu();
      return;
    }
    if (mode === 'play' && resultKind) {
      // Ignore held / repeated keys and presses right as the screen opens.
      if (e.repeat || performance.now() - resultShownAt < 250) return;
      if (['Space', 'Enter', 'KeyR', ...JUMP_KEYS].includes(e.code)) {
        e.preventDefault();
        resultKind === 'win' ? newGame() : retry();
      } else if (e.code === 'KeyN') {
        newGame();
      } else if (e.code === 'Escape') {
        stopPlay();
      }
      return;
    }
    if (mode === 'play') {
      if (JUMP_KEYS.includes(e.code)) {
        e.preventDefault();
        Game.jumpHeld = true;
        if (!e.repeat) Game.jumpPressed = true;
      } else if (e.code === 'KeyX' && !e.repeat) {
        Game.fire();
      } else if (e.code === 'Escape') {
        stopPlay();
      }
      return;
    }
    if (e.code === 'Escape' && !$('levelsScreen').hidden) {
      closeLevels();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      e.preventDefault();
      Editor.undo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (e.code) {
      case 'Digit1': setTool('square'); break;
      case 'Digit2': setTool('triangle'); break;
      case 'Digit3': setTool('circle'); break;
      case 'Digit4': setTool('item'); break;
      case 'KeyF': setTool('flag'); break;
      case 'KeyE': setTool('eraser'); break;
      case 'KeyH': setTool('pan'); break;
      case 'KeyR': rotate(); break;
      case 'BracketLeft': setSize(Math.max(1, Editor.size - 1)); break;
      case 'BracketRight': setSize(Math.min(3, Editor.size + 1)); break;
      case 'ArrowLeft': case 'KeyA': Editor.scrollBy(-2); syncScroll(); break;
      case 'ArrowRight': case 'KeyD': Editor.scrollBy(2); syncScroll(); break;
      case 'Home': Editor.camX = Editor.homeX(); syncScroll(); break;
      case 'End': Editor.camX = Editor.maxCamX(); syncScroll(); break;
      case 'KeyP': case 'Enter': startPlay(); break;
      default: return;
    }
    e.preventDefault();
  });

  window.addEventListener('keyup', (e) => {
    if (mode === 'play' && JUMP_KEYS.includes(e.code)) Game.jumpHeld = false;
  });

  window.addEventListener('blur', () => { Game.jumpHeld = false; });

  // ---------- Initial level: shared link > last level you worked on > newest > demo ----------

  function openLinkLevel() {
    const m = location.hash.match(/^#L=([\w-]+)/);
    if (!m) return false;
    try {
      addExternalLevel(decodeLevel(m[1]), 'Level from link added to My levels — press ▶ Play!');
      return true;
    } catch {
      toast('That level link looks broken');
      return false;
    }
  }

  window.addEventListener('hashchange', () => {
    if (mode === 'play') stopPlay();
    openLinkLevel();
  });

  Editor.view = makeView(W, H, 0, 0, CONFIG.EDIT_MIN_COLS);   // so homeX() knows the screen size
  Editor.level = null;
  if (!openLinkLevel()) {
    const levels = Object.values(library).sort((a, b) => b.updated - a.updated);
    const current = library[storageGet(STORAGE_CURRENT_ID, null)] || levels[0];
    if (current) openLevel(current);
    else openLevel(demoLevel(), 'Build your level, then press ▶ Play');
  }

  // ---------- Main loop ----------

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const time = now / 1000;
    if (W > 0 && H > 0) {
      if (mode === 'play') {
        Game.update(dt);
        Game.draw(ctx, W, H, time);
      } else {
        Editor.draw(ctx, W, H, time);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
