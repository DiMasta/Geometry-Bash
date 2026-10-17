# Geometry Bash

A Geometry Dash–style browser game where you **build the level first, then play it**.
Plain HTML/CSS/JavaScript: no build step and no dependencies, so it runs as-is on GitHub Pages.

## Build a level

| Shape | What it does |
| --- | --- |
| ◼ **Square** | Solid block. Land on top of it; running into its side or hitting its underside kills you. Textures: Night, Brick, Crate, Stone, Metal, Grass, Ice, Neon, Candy, **Cloud** and **Glass**. A cloud block fades away a moment after you first land on it; a glass block shatters almost at once. |
| ▲ **Triangle** | Spike. Deadly. Rotate it (Up / Right / Down / Left) to make floor, wall or ceiling spikes. Styles: Night, Lava, Ice, Metal, Thorn, Gold, Neon, Candy, Crystal. |
| ● **Circle** | Deadly. Styles: Saw, Gear, Fireball, Spike ball, Ice saw, Neon, Peppermint, Gold saw. |
| ★ **Items** | **Jump boost**: launches you about 3 blocks up. **Glass wall**: shatters harmlessly when you touch it. **Speed 2× / 3×** and **slow ½× / ¾×**: change your running speed until you collect another speed item (**1×** puts it back to normal). **Rockets**: gives you 3 rockets; fire with the 🚀 button on the left of the screen (or `X`), and each one blows up the first block or glass wall in front of you. |

- **My levels** (☰ menu): make as many levels as you like. Create, open, rename, duplicate and delete them; every change saves automatically.
- Every shape comes in 1×, 2× or 3× size. Size, rotation and texture are in the bar under the level.
- Drag the **START** cube to move where the level begins (saved with the level and in share links).
- **🚩 Test from**: tap a cell, and ▶ then starts the run there so you can test the rest of the level without playing it from the
  start. Tap the "Testing from column…" chip (or the flag again) to go back to the normal start. Test runs don't change your best score.
- Left-click (or tap) places a shape, and you can drag to paint. Right-click or the **Erase** tool removes shapes.
- Scroll the level with the mouse wheel, the arrow keys, the slider and ◀ ▶ buttons under the canvas, the **Pan** tool,
  or a two-finger drag on touch screens.
- Saving, loading, sharing and clearing live in the **☰** menu.
- The finish line moves automatically to 10 cells after your last shape.

**Editor shortcuts:** `1` square · `2` triangle · `3` circle · `4` items · `F` test start · `E` eraser · `H` pan · `R` rotate triangle ·
`[` / `]` size · `Ctrl+Z` undo · `P` or `Enter` play

## Play

The cube runs on its own. Press `Space`, `↑`, `W`, click or tap to jump. Hold the key to keep jumping as soon as you land.

**Double jump** (off by default; turn it on per level with *Allow double jump* in the ☰ menu): press or tap again while in
the air to jump a second time, which takes you to about 3.7 cells high, enough to clear a 3-block wall. You get **3 double jumps per
attempt** (shown as ●●● in the top bar), and they refill each time you restart. The setting is saved with the level and in share links.
`Esc` returns to the editor. If you have rockets, fire them with the 🚀 button on the left of the screen or `X`.

When you crash, the result screen shows your **score** (how far you got, in %), your **best** score on that level
(remembered in your browser), the attempt number, the time and the double jumps you had left, with:

- **↻ Retry** (`Space`): next attempt
- **★ New game** (`N`): start over from attempt 1
- **✎ Edit level** (`Esc`): back to the editor

## Save & share

- All your levels are saved automatically in your browser (☰ → **My levels**).
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

## Background

The background is a photo of the creators (`assets/creators.jpg`), tiled with a frame around each copy, aspect ratio kept,
and dimmed with a blue wash. To use a different photo, replace that file.

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
