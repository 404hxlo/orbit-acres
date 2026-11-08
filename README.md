# Orbit Acres

A cozy colony-building game on a tiny planet you can spin with your finger. Grow glowing crops, raise
odd little critters, run factories, ship orders, sell at your Trading Post, fish the Star Sea, dig in the
Hollow Mine, and fix up Starport Town.

Short timers keep running while the game is closed. Everything is drawn in code, with no image or audio
files. There are no real-money purchases.

## Play

Online: https://404hxlo.github.io/orbit-acres/

Or double-click `index.html`, or `dist/orbit-acres.html` for the single-file version. It needs internet the
first time, to load the 3D library and fonts.

## Controls

- Drag to spin the planet. Pinch or scroll to zoom.
- Tap a plot to plant. Drag across ripe plots to harvest.
- Tap pens and factories to work them. Hold on anything to move it.
- Keyboard: arrow keys pan, `+` and `-` zoom, Esc closes windows.

## Graphics

Settings has a Graphics choice: Auto, High, Medium or Low. Auto picks one for the device, then watches the frame rate while you play. If frames run slow it drops sharpness, grass and effects within a second or two, and it brings them back once there is room. The fixed levels stay as they are.

- **High:** physically based materials, reflections, film-style tone mapping, soft glow, dense grass and the sharpest baked models.
- **Medium:** the same look with less detail and half-size textures, for phones.
- **Low:** simple shading with baked models, the lightest setup. Most phones start here.

When a browser has graphics acceleration switched off, the processor draws the game in software, which is several times slower. The game notices, turns off edge smoothing, draws about 800,000 pixels a frame and stretches them to fill the screen, and shows once how to switch acceleration back on. Settings keeps a How to fix button while it lasts.

Every model starts out generated in code, so the game opens at once. Buildings then swap to versions baked in Blender as they download in the background. If a download fails, or Data Saver is on, the code-built model stays and nothing else changes.

## Move a colony to another device

Colonies save in the browser you play in. To carry one over, open Settings and choose Move colony to another device.

- **Short code:** open the game on both devices, press Get a code, and type the code on the other device.
- **Link:** copy the colony link and paste it anywhere, like email or your notes. Open it on the other device later.

Loading replaces the colony on that device, and the old one can be brought back from the same window. After a move, the two copies carry on separately.

## Project layout

| File | What it does |
|---|---|
| `js/data.js` | Everything you can grow, make, build and buy |
| `js/sim.js` | The game rules, with no drawing, so they run headless |
| `js/transfer.js` | Moving a colony between devices |
| `js/gfx.js` | Quality levels, the planet-bending shaders, materials and the model builder |
| `js/post.js` | Soft glow, focus falloff, tone mapping and color grading |
| `js/cooked.js`, `js/cooked-list.js` | Loads models baked in Blender and swaps them in |
| `js/art.js`, `js/models.js` | Every item and world model |
| `js/world.js` | The living scene, camera and picking |
| `js/icons.js` | Renders models into the sticker sheet |
| `js/ui.js`, `js/panels.js`, `js/games.js`, `js/guide.js`, `js/input.js`, `js/audio.js` | Screens, mine and fishing, tutorial, controls, sound |
| `js/main.js` | Startup and saving |
| `assets/cooked/` | Baked models, one file per model at two sizes |
| `tools/cook/` | The Blender baking pipeline |

## Tools

```bash
node tools/serve.js 8150
```

```bash
node tools/bot.js 8 4
```

```bash
node tools/bundle.js
```

`bot.js` plays the game headless for a given number of hours and reports pacing, as a balance check.
`bundle.js` rebuilds the single-file versions in `dist/`. Run it after every change.

## Baking models in Blender

Models are written in code, so baking starts from the running game.

1. Open the game from `tools/serve.js` at the High graphics level, then run this in the browser console. It exports models to `tools/cook/raw/`.

   ```js
   const s = document.createElement('script'); s.src = '/tools/cook/dump.js'; document.head.append(s);
   await OA.CookDump.run();
   ```

2. Bake them. This takes about 10 seconds a model on a recent graphics card.

   ```bash
   blender -b --factory-startup --python tools/cook/cook.py -- all
   ```

3. Update the list the game reads.

   ```bash
   node tools/cook/list.js
   ```

`cook.py` wraps each model in one light shell, keeps lamps, glass and railings as real geometry, and bakes the rest into textures with weathering added: grime in crevices, worn edges, streaks and dust. Change the look there. `tools/cook/gallery.js` lines models up on the planet to check them.
