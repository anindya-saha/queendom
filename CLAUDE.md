# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Queendom, a clone of LinkedIn's "Queens" puzzle in vanilla HTML/CSS/JS (ES modules, no framework), served and bundled with Vite. Includes a feature that loads maps from game screenshots using OpenCV.js.

## Commands

```shell
npm install
npm start                                 # Vite dev server at http://localhost:3050
npm test                                  # Vitest, all tests
npx vitest run tests/board.test.js        # single file
npx vitest run -t "auto X"                # tests matching a name
npm run build                             # production build into dist/
npm run preview                           # serve dist/
```

Vite config (`vite.config.mjs`): `root` is `public/`, `publicDir` is `public/static/` (copied verbatim, not bundled), `base: './'` so the build works under the GitHub Pages subpath.

Deployment: `.github/workflows/static.yml` runs tests, builds, and publishes `dist/` to GitHub Pages on every push to `main`.

## Architecture

Three views in `public/index.html` (`.view` elements, switched by `show_view()` in `public/main.js`): `#puzzle-select` (tile grid), `#game-view` (board), `#editor-view` (board editor). New puzzles and screenshot imports both go through the editor before saving. One `Game` instance is created at startup (it measures the canvas then) and reused via `Game.reload()`. Core modules in `public/js/`:

- `game.js` — `Game` composes `Board`, `Renderer`, and `InputStateHandler`, and wires them together via callback hooks. Also owns the timer and win detection. Exports `Global`, a runtime copy of `Configuaration` (sic) from `configure.js` (theme, colors, `auto_marks` flag), imported by other modules.
- `board.js` — `Board` holds the grid of marks (`Marks`: NONE / BASIC (X) / QUEEN) and region map; delegates rule checks to `QueensValidator` (`validator.js`). Also places/removes automatic X marks, tracked in `auto_marks` so manual X's are never removed.
- `input_handler.js` — state machine (NOOP / MARKING / CLEARING) for click, toggle, and drag-to-mark across mouse and touch.
- `render.js` — `Renderer` draws onto the `<svg id="canvas">` via `LayeredSVGToCanvasContext` (`adapters.js`), a Canvas-2D-like API that emits SVG elements. Layer order is set by the `Layers` object (board → errors → outlines → marks → hover).
- `storage.js` — the puzzle library in `localStorage`: one ordered list of `{ id, name }` for built-ins (maps resolved from `maps.js` by `builtin-<index>` id) and `{ id, name, map, color_map }` for screenshot puzzles. Migrates the legacy `queens-clone.saved-puzzles` key.
- `editor.js` — `BoardEditor`: paint regions with a palette, resize, trace over an image (opacity/zoom/pan). Edits palette indices `0..N-1`; saves `{ map, color_map }`. `layout_validation.js` checks each of the N colors forms exactly one connected region.
- `puzzle_select.js` — renders puzzle tiles (preview, rename, delete, drag-handle reordering via pointer events).
- `load_map.js` — `load_map_from_image()` finds the board via OpenCV (Canny + contours) and returns `{ color_map, map }`. If tile contours don't form a perfect square grid (faint separators), it estimates the grid from median tile size; if color thresholding yields the wrong number of colors (uneven lighting), it merges adjacent tiles by color similarity until there are N regions.
- `maps.js` — hard-coded maps (2D arrays of color-region IDs, keys into `theme.color_map`); `puzzles` lists the built-ins.

Components talk through `handlers` objects of optional callbacks (`handlers.on_x?.(...)`), e.g. validator → board → game → renderer. Follow this pattern when adding events.

OpenCV (`public/static/vendor/opencv.js`, ~10MB minified) is lazy-loaded by `opencv_loader.js` when the user clicks "Load screenshot"; it sets the global `cv` that `load_map.js` uses. Don't read or grep this file. Tests load it in Node via `require` and stub `cv.imread`; fixture images are in `tests/fixtures/`.

Images referenced from JS must use `new URL('../images/x.svg', import.meta.url)` so Vite bundles them.

## Conventions

snake_case for functions, methods, and variables; PascalCase for classes and enum-like constant objects; 4-space indentation.
