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
| `js/gfx.js` | The planet-bending shaders and the model builder |
| `js/art.js`, `js/models.js` | Every item and world model |
| `js/world.js` | The living scene, camera and picking |
| `js/icons.js` | Renders models into the sticker sheet |
| `js/ui.js`, `js/panels.js`, `js/games.js`, `js/guide.js`, `js/input.js`, `js/audio.js` | Screens, mine and fishing, tutorial, controls, sound |
| `js/main.js` | Startup and saving |

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
