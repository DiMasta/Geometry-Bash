// App wiring: canvas, main loop, toolbar, keyboard, saving and sharing.

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

  // ---------- Editor state & UI sync ----------

  Editor.onChange = () => {
    storageSet(STORAGE_CURRENT, Editor.level);
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
    $('texturePalette').hidden = tool !== 'square';
  }

  // ---------- Square textures ----------

  function previewTile(v) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const view = { W: 64, H: 64, scale: 64, camX: 0, camY: 0, groundY: 64 };
    drawShape(c.getContext('2d'), view, { t: 'square', x: 0, y: 0, s: 1, r: 0, v });
    return c;
  }

  function setVariant(v) {
    Editor.variant = v;
    $('texturePalette').querySelectorAll('button').forEach((b, i) => {
      b.classList.toggle('active', i === v);
      b.setAttribute('aria-checked', String(i === v));
    });
  }

  BLOCK_STYLE_NAMES.forEach((name, v) => {
    const b = document.createElement('button');
    b.title = `${name} block`;
    b.setAttribute('role', 'radio');
    b.appendChild(previewTile(v));
    b.addEventListener('click', () => setVariant(v));
    $('texturePalette').appendChild(b);
  });
  setVariant(0);
  document.querySelectorAll('.tool').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

  function setSize(size) {
    Editor.size = size;
    $('sizeLabel').textContent = `${size}×`;
  }
  $('sizeBtn').addEventListener('click', () => setSize((Editor.size % 3) + 1));

  function rotate() {
    Editor.rot = (Editor.rot + 1) % 4;
    $('rotLabel').textContent = ROT_NAMES[Editor.rot];
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
    Editor.level.name = e.target.value.slice(0, 40);
    storageSet(STORAGE_CURRENT, Editor.level);
  });

  function loadIntoEditor(level, message) {
    Editor.camX = Editor.homeX();
    Editor.setLevel(level);
    $('levelName').value = level.name;
    $('doubleJumpToggle').checked = level.doubleJump;
    closeMenu();
    if (message) toast(message);
  }

  $('doubleJumpToggle').addEventListener('change', (e) => {
    Editor.level.doubleJump = e.target.checked;
    storageSet(STORAGE_CURRENT, Editor.level);
    toast(e.target.checked ? 'Double jump on for this level' : 'Double jump off');
  });

  // ---------- Saved levels ----------

  function refreshLevelList() {
    const sel = $('levelSelect');
    const names = Object.keys(loadSavedLevels()).sort((a, b) => a.localeCompare(b));
    sel.innerHTML = '<option value="">Load…</option>';
    for (const n of names) {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n;
      sel.appendChild(opt);
    }
  }

  $('saveBtn').addEventListener('click', () => {
    const name = ($('levelName').value.trim() || 'My Level').slice(0, 40);
    Editor.level.name = name;
    $('levelName').value = name;
    if (saveLevelByName(Editor.level)) {
      refreshLevelList();
      $('levelSelect').value = name;
      toast(`Saved “${name}”`);
    } else {
      toast('Could not save — browser storage is unavailable');
    }
  });

  $('levelSelect').addEventListener('change', (e) => {
    const name = e.target.value;
    if (!name) return;
    const level = loadSavedLevels()[name];
    if (level) loadIntoEditor(sanitizeLevel(level), `Loaded “${name}”`);
  });

  $('deleteBtn').addEventListener('click', () => {
    const name = $('levelSelect').value;
    if (!name) return toast('Pick a saved level to delete first');
    if (!confirm(`Delete saved level “${name}”?`)) return;
    deleteSavedLevel(name);
    refreshLevelList();
    toast(`Deleted “${name}”`);
  });

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
      const prev = Editor.snapshot();
      loadIntoEditor(levelFromJSON(await file.text()), `Imported “${file.name}”`);
      Editor.pushUndo(prev);
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
    Game.start(sanitizeLevel(Editor.level));
  }

  function stopPlay() {
    mode = 'edit';
    document.body.classList.remove('playing');
    $('hud').hidden = true;
    hideResult();
    canvas.classList.remove('playing');
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
    $('resultScore').textContent = `${stats.score}%`;
    $('resultBest').textContent = `${stats.best}%`;
    $('resultAttempt').textContent = stats.attempts;
    $('resultTime').textContent = `${stats.time.toFixed(1)}s`;
    $('resultAir').textContent = stats.airJumps;
    $('resultAirRow').hidden = !Game.level.doubleJump;
    $('newBest').hidden = !stats.newBest;
    $('retryBtn').hidden = kind === 'win';
    $('newGameBtn').classList.toggle('play', kind === 'win');
    $('resultScreen').querySelector('.keys').textContent = kind === 'win'
      ? 'Space: new game · Esc: edit'
      : 'Space: retry · N: new game · Esc: edit';
    $('resultScreen').hidden = false;
  }

  function hideResult() {
    resultKind = null;
    $('resultScreen').hidden = true;
  }

  function retry() {
    hideResult();
    Game.jumpHeld = false;
    Game.restart();
  }

  function newGame() {
    hideResult();
    Game.start(Game.level);
  }

  Game.onResult = showResult;

  Game.onHud = (attempts, progress, airJumps) => {
    $('attempt').textContent = `Attempt ${attempts}`;
    $('airJumpsHud').hidden = !Game.level.doubleJump;
    $('airJumps').textContent = '●'.repeat(airJumps) + '○'.repeat(CONFIG.AIR_JUMPS - airJumps);
    const pct = Math.floor(progress * 100);
    $('percent').textContent = `${pct}%`;
    $('progressFill').style.width = `${pct}%`;
  };

  $('playBtn').addEventListener('click', startPlay);
  $('stopBtn').addEventListener('click', stopPlay);
  $('retryBtn').addEventListener('click', retry);
  $('newGameBtn').addEventListener('click', newGame);
  $('editBtn').addEventListener('click', stopPlay);

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
      } else if (e.code === 'Escape') {
        stopPlay();
      }
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

  // ---------- Initial level: link > autosave > demo ----------

  function initialLevel() {
    const m = location.hash.match(/^#L=([\w-]+)/);
    if (m) {
      try {
        return { level: decodeLevel(m[1]), msg: 'Level loaded from link — press ▶ Play!' };
      } catch {
        toast('That level link looks broken');
      }
    }
    const saved = storageGet(STORAGE_CURRENT, null);
    if (saved) return { level: sanitizeLevel(saved) };
    return { level: demoLevel(), msg: 'Build your level, then press ▶ Play' };
  }

  window.addEventListener('hashchange', () => {
    const m = location.hash.match(/^#L=([\w-]+)/);
    if (!m) return;
    try {
      const prev = Editor.snapshot();
      stopPlay();
      loadIntoEditor(decodeLevel(m[1]), 'Level loaded from link');
      Editor.pushUndo(prev);
    } catch {
      toast('That level link looks broken');
    }
  });

  Editor.view = makeView(W, H, 0, 0, CONFIG.EDIT_MIN_COLS);   // so homeX() knows the screen size
  const init = initialLevel();
  loadIntoEditor(init.level, init.msg);
  refreshLevelList();

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
