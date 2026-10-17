# Geometry Bash

A Geometry Dash–style browser game where you **build the level first, then play it**.
Plain HTML/CSS/JavaScript: no build step and no dependencies, so it runs as-is on GitHub Pages.

## Build a level

| Shape | What it does |
| --- | --- |
| ◼ **Square** | Solid block. Land on top of it; running into its side or hitting its underside kills you. |
| ▲ **Triangle** | Spike. Deadly. Rotate it (Up / Right / Down / Left) to make floor, wall or ceiling spikes. |
| ● **Circle** | Spinning saw. Deadly. |

- Every shape comes in 1×, 2× or 3× size.
- Left-click (or tap) places a shape, and you can drag to paint. Right-click or the **Erase** tool removes shapes.
- Scroll the level with the mouse wheel, the arrow keys, the slider and ◀ ▶ buttons under the canvas, the **Pan** tool,
  or a two-finger drag on touch screens.
- Saving, loading, sharing and clearing live in the **☰** menu.
- The finish line moves automatically to 10 cells after your last shape.

**Editor shortcuts:** `1` square · `2` triangle · `3` circle · `E` eraser · `H` pan · `R` rotate triangle ·
`[` / `]` size · `Ctrl+Z` undo · `P` or `Enter` play

## Play

The cube runs on its own. Press `Space`, `↑`, `W`, click or tap to jump. Hold the key to keep jumping as soon as you land.

**Double jump:** press or tap again while in the air to jump a second time, which takes you to about 3.7 cells high,
enough to clear a 3-block wall. You get **3 double jumps per attempt** (shown as ●●● in the top bar), and they refill each time you restart.
`Esc` returns to the editor.

When you crash, the result screen shows your **score** (how far you got, in %), your **best** score on that level
(remembered in your browser), the attempt number, the time and the double jumps you had left, with:

- **↻ Retry** (`Space`): next attempt
- **★ New game** (`N`): start over from attempt 1
- **✎ Edit level** (`Esc`): back to the editor

## Save & share

- The level you are working on is saved automatically in your browser.
- **Save** stores the level under its name, and **Load…** brings it back.
- **🔗 Share** copies a link that contains the whole level. Anyone who opens it gets the level in their editor.
- **Export** / **Import** save and load levels as `.json` files.

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy to GitHub Pages

1. On GitHub, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
3. Choose branch **`main`** and folder **`/ (root)`**, then click **Save**.

After a minute the game is live at `https://<user>.github.io/<repo>/`.

## Code layout

```
index.html        page and toolbar
style.css         styles
js/config.js      physics and layout tuning values
js/shapes.js      shape geometry and collision tests
js/level.js       level data, share-link encoding, saving
js/render.js      canvas drawing
js/editor.js      level editor
js/game.js        play mode and physics
js/main.js        wiring: input, UI, main loop
```
