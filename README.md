# Learn 3D Math

Interactive study notes for **"Mathematics for 3D Game Programming and Computer Graphics"** (3rd ed.,
Eric Lengyel). Every section of the book is a topic page with three tabs:

* **📖 Learn**: the idea, the derivation, the formulas, where it shows up in a game engine, a key-formula
  summary, and practice questions with hidden answers.
* **🎮 Simulate**: interactive simulations. Drag points, orbit 3D views, and move sliders to see the math react.
* **💻 C++ Code**: each formula next to the C++ function that computes it.

Progress ("I've learned this") and your own notes are saved per topic in the browser.

## Running it

Double-click `index.html`. Everything runs from disk. Formulas are rendered with KaTeX from a CDN, so you need
an internet connection the first time.

To serve it over http (e.g. for the VS Code launch config in `.vscode/launch.json`):

```bash
pwsh tools/serve.ps1
```

then open http://localhost:8080.

## Project layout

```
index.html              app shell (top bar, sidebar, main area)
assets/css/site.css     all styles; light/dark theme tokens (the --sim-* colors are used by canvases)
js/core/math.js         L3D.math: vectors, matrices, quaternions (same conventions as the book)
js/core/sim.js          L3D.Sim: the simulation toolkit (layout, controls, 2D/3D views, loops)
js/core/cpp.js          C++ syntax highlighter for the C++ tab
js/core/app.js          router, sidebar, tabs, progress and notes
js/data/toc.js          the book's chapters and sections
js/data/cpp-types.js    the C++ structs (Vector3D, Matrix3D, …) the code examples use
js/chapters/chNN.js     one file per chapter: lessons, simulations, and C++ blocks for its sections
js/chapters/appendix.js Appendices A–D
tools/selftest.html     automated check for a chapter: ?ch=ch05 (or ?ch=all)
tools/serve.ps1         tiny static server
docs/AUTHORING.md       how to write or edit a topic (start here to add your own)
archive/old-site/       the previous version of the site, kept for reference (safe to delete)
```

## Editing a topic

Open the chapter file (e.g. `js/chapters/ch05.js`). Each section is one `L3D.topic({ … })` call with `lesson`,
`sims`, and `cpp` fields. `docs/AUTHORING.md` explains every field and the full simulation API. After editing, open
`tools/selftest.html?ch=ch05` to check that nothing is broken.
