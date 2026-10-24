# Writing a topic

Every section of the book (2.2, 4.6, 7.9, …) is one **topic page** with three tabs:

| Tab | What it holds |
|---|---|
| 📖 **Learn** | The lesson: explanation, derivation sketch, formulas, game-engine context, key-formula summary, practice questions |
| 🎮 **Simulate** | One or more interactive simulations built with the `L3D.Sim` toolkit |
| 💻 **C++ Code** | Short blocks that pair a formula with the C++ that computes it |

The chapter list lives in `js/data/toc.js`. Each chapter's topics live in one file,
`js/chapters/chNN.js` (appendices: `js/chapters/appendix.js`). **`js/chapters/ch02.js` is the reference
example.** Copy its patterns.

## Adding another book

The sidebar is a library tree: **book → chapter → topic**. `L3D.library` in
`js/data/toc.js` holds the books. To add one, create its chapter list and add a
book object with an `id`, `shortTitle`, `title`, `author`, and `chapters` array.
Each chapter uses the same shape already used by `L3D.toc` (`id`, `number`,
`title`, `file`, `sections`). Its topic files use `L3D.topic(...)` exactly like
the current book, so they can use the same Learn, Simplified, Simulate, C++,
and C# tab system and the same simulation toolkit.

Keep topic IDs unique across books for now. That keeps old links such as
`#/2.2` working while the library grows.

---

## 1. File skeleton

```js
// Chapter 5 - Geometry for 3D Engines
(function () {
  "use strict";
  const { V, M, Q, fmt, fmtVec, rad, deg, clamp, lerp } = L3D.math;

  L3D.topic({
    id: "5.1",                       // must match js/data/toc.js
    summary: "One sentence shown under the title.",
    lesson: String.raw`...HTML...`,
    keyFormulas: [ ["Label", String.raw`TeX`], ... ],
    exercises: [ { q: "html", a: "html" }, ... ],
    sims: [ { title, help, mount(sim) { ... } }, ... ],
    cpp: [ { title, formula, note, code }, ... ],
  });

  // ...one L3D.topic({...}) per section...
})();
```

Put shared helpers for a chapter (e.g. a ray-sphere function used by two sims) at the top of the IIFE.

## 2. Lesson HTML

* Write it in a `String.raw` template so TeX backslashes survive: ``String.raw`\frac{a}{b}` ``.
  **Never use `${` inside a `String.raw` lesson**, because it starts a JS interpolation. Backticks are also not allowed.
* Math: inline `\( ... \)`, display `\[ ... \]`. (Not `$...$`.)
* **Never write a raw `<` or `>` inside TeX.** The HTML parser eats it (for example `k<i` becomes an `<i>` tag).
  Use `\lt` / `\gt` (or `&lt;` / `&gt;`).
* Subsections from the TOC **must** appear as `<h2 data-sub="4.6.1">Quaternion Mathematics</h2>`.
  The app adds the number badge and the sidebar links to it. Use plain `<h2>`/`<h3>` for other headings.
* Callout boxes (the label is added by CSS):
  * `<div class="key">…</div>`: the core idea
  * `<div class="formula">\[ … \]</div>`: a boxed important formula
  * `<div class="game">…</div>`: where it is used in a game engine
  * `<div class="warn">…</div>`: pitfalls (precision, singularities, conventions)
  * `<div class="note">…</div>`: an aside
* Tables: plain `<table><tr><th>…`. Links to other topics: `<a href="#/5.3">Section 5.3</a>`.
* End the lesson with a link to the sim: `<p><a class="btn goto-sim" href="#/5.1/sim">Try it: … →</a></p>`
* Explain in your own words, based on the book's content, derivations and results. Don't copy the book's
  prose. Use the book's notation (bold **P**, **Q**, **N**, `\langle x, y, z \rangle`, theorem names/numbers when
  helpful).

`keyFormulas` mirrors the book's chapter summary: 3–7 `[label, TeX]` pairs.
`exercises`: 3–5 questions with worked answers (`q`/`a` are HTML and may contain `\( \)` math).

## 3. Simulations

```js
{
  title: "Ray–sphere intersection",
  help: String.raw`<p>What to do and what to notice. May contain \( \) math.</p>`,
  mount(sim) {
    const { stage, controls, readout } = sim.layout();   // canvas area + side panel
    const view = sim.view2d(stage, { range: 5 });        // or sim.view3d(...)
    const out = sim.readout(readout);
    const a = view.handle([2, 1], { color: "a", label: "A" });
    const k = sim.slider(controls, { label: "Radius", min: 0.5, max: 3, step: 0.1, value: 1.5, onInput: () => view.redraw() });
    view.onDraw((v) => {
      v.grid(); v.axes();
      v.arrow([0, 0], a.pos, { color: "a", label: "a" });
      out.set(sim.rows([["‖a‖", fmt(V.len(a.pos))]]));
    });
  },
}
```

Everything created through `sim` is cleaned up automatically when the reader leaves, so you need no teardown code.
Never use `setInterval` or a raw `requestAnimationFrame`. Use `sim.loop`.

### Sim API (`js/core/sim.js`)

| Call | Notes |
|---|---|
| `sim.layout({side})` | returns `{stage, controls, readout}`; `side: "bottom"` puts controls under the stage |
| `sim.split(parent, n)` | n side-by-side cells (stacks on mobile); returns array of cells |
| `sim.group(parent, title)` | titled block of controls |
| `sim.slider(parent, {label, min, max, step, value, unit, digits, format, onInput})` | `.value` get/set |
| `sim.checkbox(parent, {label, value, onChange})` | `.value` |
| `sim.select(parent, {label, options, value, onChange})` | options: `["a","b"]` or `[["val","Label"],…]` |
| `sim.segmented(parent, {label, options, value, onChange})` | pill toggle, `.value` |
| `sim.button(parent, {label, onClick, primary})`, `sim.buttons(parent, [{label,onClick},…])` | |
| `sim.readout(parent)` → `{set(html)}` | live text panel |
| `sim.rows([[label, value, cls?], …])` | HTML rows for readouts; `cls` = `"ok"` / `"bad"` |
| `sim.swatch("a")` | colored square for labels |
| `sim.note(parent, html)`, `sim.legend(parent, [["a","label"],…])` | |
| `sim.loop((dt, t) => …)` | animation loop, returns `{start, stop, toggle, running}` |
| `sim.on(target, type, fn)` | auto-removed event listener |
| `sim.color("a")` | resolve a color key to CSS |
| `sim.canvas(parent, {height})` | raw DPR-aware canvas: `.ctx`, `.w`, `.h`, `.onDraw(fn)`, `.redraw()`, `.label(x,y,text,opts)` |
| `sim.raster(parent, {width, height, displayHeight, smooth})` | low-res pixel buffer: `.set(x,y,r,g,b,a)`, `.data`, `.put()`; for per-pixel demos (ray tracing, shading, textures, rasterization) |
| `sim.view2d(parent, opts)` | 2D world view, y up (below) |
| `sim.view3d(parent, opts)` | orbit-camera 3D view (below) |

**Colors** are theme-aware keys: `a` blue, `b` orange, `c` green, `d` purple, `e` red, `f` teal, `g` gold,
`fg`, `muted`, `grid`, `grid2`, `axis`, `bg`, `panel`, `accent`. Any CSS color string also works.
Use `L3D.color.shade(color, k, alpha)` to darken/lighten (for custom shading in `raster`), and read actual RGB with
`L3D.color.parse(sim.color("a"))`.

### `view2d(parent, opts)`

opts: `range` (half visible height in world units, default 5), `center`, `height` (px, default 420),
`xRange: [a,b]` + `yRange: [c,d]` for non-uniform plot axes (function graphs, physics time plots), `zoom` (wheel).

* `view.onDraw(fn)`: `fn(view)` paints the scene. `view.redraw()` schedules a repaint (call it from control callbacks).
* Primitives (world coordinates; style keys: `color, width, dash, alpha, fill, fillAlpha, label`):
  `grid({step})`, `axes({ticks, labels})`, `line(a,b)`, `infiniteLine(p,dir)`, `polyline(pts,{closed})`,
  `polygon(pts,{fill, fillAlpha, stroke:false})`, `rect(min,max)`, `circle(c,r)`, `point(p,{r,label})`,
  `arrow(from,to,{label})`, `text(p,str,{offset:[dx,dy], align, size})`, `arc(c,r,a0,a1)`, `plot(f,{from,to})`.
* `view.handle([x,y], {color, label, snap, constrain(p)→p, onDrag(pos)})` is a draggable point. Read `h.pos`, set with `h.set([x,y])`, hide with `h.visible = false`.
* `view.onClick((worldPos) => …)` fires on clicks on empty space.
* `view.toScreen(p)`, `view.toWorld(x,y)`, `view.bounds`, `view.ctx`, `view.label(x,y,text,opts)` for screen-space text.

### `view3d(parent, opts)`

Right-handed, **y up**. opts: `height` (default 440), `distance`, `yaw`, `pitch`, `target`, `fov` (deg), `light` (dir).
Drag to orbit, wheel to zoom. Primitives are depth-sorted (painter's algorithm), so keep scenes simple.

* `grid({size, step, y})`, `axes({length})`, `line(a,b)`, `polyline(pts)`, `arrow(a,b,{label})`, `point(p,{label})`,
  `text(p,str)`, `poly(pts,{fill, alpha, color, lit, cull})`, `sphere(c,r,{fill, alpha})`, `circle(c,n,r)`,
  `plane(p,n,size)`, `box(min,max,style)`, `mesh({vertices,faces},{fill, faceColors, transform, wire, alpha, lit, cull})`.
* `L3D.shapes.box(min,max)`, `.sphere(r,seg,rings)`, `.pyramid(s,h)` return meshes.
* `view.project(p)` → `{x, y, depth, ok}`; `view.eye`, `view.yaw/pitch/distance`; `view.onOrbit(fn)`.
* Style `overlay: true` draws on top of everything.

### Math helpers (`js/core/math.js`)

Vectors are arrays. `V.add, sub, scale, neg, mul, dot, cross, cross2, perp2, len, len2, dist, norm, lerp, proj,
reject, angle, rotate2, reflect, anyPerp`. Matrices are arrays of rows (`m[row][col]`, column-vector convention):
`M.identity(n), mul, mulVec, transpose, det, inverse, fromCols, col, rotX/Y/Z, rotAxis(axis,t), rot2, scale3, affine(m3,t),
translate, perspective(fovy,aspect,n,f), ortho, lookAt(eye,target,up), transformPoint, transformVec, project`.
Quaternions `[x,y,z,w]`: `Q.identity, fromAxisAngle, mul, conj, dot, norm, rotate(q,v), toMat3, slerp`.
Scalars: `clamp, lerp, rad, deg, smoothstep, fmt(x,digits), fmtVec(v,digits), solveQuadratic(a,b,c)`.

### What makes a good simulation

* It shows **this section's math**, not a generic demo. The reader changes an input and immediately sees the
  formula's output change, both in the picture and in the numbers in the readout.
* 1–3 sims per topic. Use several when the subsections are distinct (e.g. 6.2 → triangle, box, sphere/cylinder/torus).
* `help` says what to try and what to notice.
* Default values should show something interesting straight away.
* Keep per-frame work light. For `raster` demos stay around 200×150 pixels or less.

## 4. C++ blocks

```js
cpp: [
  {
    title: "Ray–sphere intersection",
    formula: String.raw`t = \frac{-b - \sqrt{b^2 - 4ac}}{2a}`,         // optional, rendered above the code
    note: "<p>Optional short explanation (HTML).</p>",                   // optional
    code: String.raw`
      bool IntersectRaySphere(const Ray& ray, const Point3D& center, float radius, float& t)
      {
          ...
      }
    `,
  },
]
```

* 3–5 blocks per topic, each a focused function (5–40 lines) that **directly implements the formula shown**.
  Name variables after the math and comment the lines that map to the formula.
* Use the types on the C++ types page (`js/data/cpp-types.js`): `Vector2D, Vector3D, Point3D, Vector4D,
  Matrix3D (m(row,col), m[col]), Matrix4D, Quaternion, Plane, Ray`, plus `Dot, Cross, Magnitude, SquaredMag,
  Normalize, Project, Reject, Transpose, Inverse, Determinant, TransformPoint, TransformVector, DotPoint`.
  Small helper structs (e.g. `struct ColorRGB`, `struct Sphere`, `struct Box`) may be declared inside a block.
* Write valid, idiomatic C++17 that compiles. Use `float` and `std::sqrt`/`std::sin`. No `using namespace std`.
  Game-engine style: pass by `const&`, return `bool` + out-param for intersections.
* Code is shown with its leading indentation removed, so indent naturally inside the template.

## 5. Checking your work

Start the site (`pwsh tools/serve.ps1`, or double-click `index.html`) and open:

* `http://localhost:8080/tools/selftest.html?ch=ch05` runs the automated check for one chapter. It reports missing
  topics or subsection headings, KaTeX errors, broken math, and any exception thrown while mounting and wiggling
  every simulation. **It must say PASS.**
* `http://localhost:8080/#/5.1/sim` lets you look at the real page.
