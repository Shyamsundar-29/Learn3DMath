// L3D.Sim - the toolkit every topic simulation is built with.
//
// A simulation is defined in a chapter file as
//     { title: "...", help: "<p>...</p>", mount(sim) { ... } }
// The app creates `sim = new L3D.Sim(container)` and calls mount(sim). Everything the
// simulation creates through `sim` (loops, listeners, views) is cleaned up automatically
// when the reader leaves the page, so a mount function never needs its own teardown.
//
//   const { stage, controls, readout } = sim.layout();
//   const view = sim.view2d(stage, { range: 5 });          // 2D world-space canvas
//   const a = view.handle([3, 1], { color: "a", label: "a" });
//   sim.slider(controls, { label: "Angle", min: 0, max: 360, value: 30, unit: "°", onInput: view.redraw });
//   view.onDraw((v) => { v.grid(); v.axes(); v.arrow([0, 0], a.pos, { color: "a" }); });
(function () {
  "use strict";

  const { V, M, clamp } = L3D.math;
  const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

  // ------------------------------------------------------------------ colors
  // Named colors come from CSS variables so simulations follow the light/dark theme.
  const COLOR_KEYS = ["a", "b", "c", "d", "e", "f", "g", "fg", "muted", "grid", "grid2", "axis", "bg", "panel", "accent"];

  function readPalette() {
    const css = getComputedStyle(document.documentElement);
    const p = {};
    for (const k of COLOR_KEYS) p[k] = css.getPropertyValue("--sim-" + k).trim() || "#888";
    return p;
  }

  function parseColor(c) {
    if (c.startsWith("#")) {
      const h = c.length === 4 ? [...c.slice(1)].map((x) => x + x).join("") : c.slice(1, 7);
      return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    }
    const m = c.match(/[\d.]+/g);
    return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
  }

  // Scale a color's brightness (k < 1 darker, k > 1 lighter) and optionally set alpha.
  function shade(color, k = 1, alpha = 1) {
    const [r, g, b] = parseColor(color).map((x) => clamp(Math.round(x * k), 0, 255));
    return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
  }

  const withAlpha = (color, alpha) => shade(color, 1, alpha);

  // ================================================================== Sim
  class Sim {
    constructor(root) {
      this.root = root;
      this._cleanups = [];
      this._views = [];
      this.destroyed = false;
      this.colors = readPalette();
      this.on(document, "l3d:theme", () => {
        this.colors = readPalette();
        this._views.forEach((v) => v.redraw());
        this._themeFns && this._themeFns.forEach((fn) => fn(this.colors));
      });
    }

    // Resolve a color key ("a", "fg", ...) or pass a CSS color through.
    color(c) {
      return (c && this.colors[c]) || c || this.colors.fg;
    }

    onTheme(fn) {
      (this._themeFns = this._themeFns || []).push(fn);
    }

    cleanup(fn) {
      this._cleanups.push(fn);
    }

    on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      this._cleanups.push(() => target.removeEventListener(type, fn, opts));
    }

    destroy() {
      this.destroyed = true;
      this._cleanups.splice(0).reverse().forEach((fn) => {
        try { fn(); } catch (e) { console.error(e); }
      });
      this.root.innerHTML = "";
    }

    // rAF loop: fn(dt, time) with dt in seconds (capped so a background tab doesn't explode).
    // Returns { start(), stop(), toggle(), running }.
    loop(fn, { autostart = true } = {}) {
      let id = 0, last = 0, t = 0;
      const ctl = {
        running: false,
        start() {
          if (ctl.running) return;
          ctl.running = true;
          last = performance.now();
          id = requestAnimationFrame(tick);
        },
        stop() {
          ctl.running = false;
          cancelAnimationFrame(id);
        },
        toggle() {
          ctl.running ? ctl.stop() : ctl.start();
          return ctl.running;
        },
      };
      const tick = (now) => {
        if (!ctl.running) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        t += dt;
        fn(dt, t);
        id = requestAnimationFrame(tick);
      };
      this.cleanup(() => ctl.stop());
      if (autostart) ctl.start();
      return ctl;
    }

    // ------------------------------------------------------------- layout
    // Standard layout: a stage for canvases and a side column with controls + readout.
    layout({ side = "right" } = {}) {
      const el = (cls) => Object.assign(document.createElement("div"), { className: cls });
      const wrap = el("sim-layout" + (side === "bottom" ? " sim-layout--bottom" : ""));
      const stage = el("sim-stage");
      const sideEl = el("sim-side");
      const controls = el("sim-controls");
      const readout = el("sim-readout");
      sideEl.append(controls, readout);
      wrap.append(stage, sideEl);
      this.root.append(wrap);
      return { stage, controls, readout, side: sideEl };
    }

    // Two canvases side by side (stacked on narrow screens).
    split(parent, n = 2) {
      const row = document.createElement("div");
      row.className = "sim-split";
      row.style.setProperty("--cols", n);
      parent.append(row);
      return Array.from({ length: n }, () => {
        const cell = document.createElement("div");
        cell.className = "sim-split-cell";
        row.append(cell);
        return cell;
      });
    }

    // ------------------------------------------------------------ controls
    group(parent, title) {
      const g = document.createElement("div");
      g.className = "ctl-group";
      if (title) g.innerHTML = `<div class="ctl-title">${title}</div>`;
      parent.append(g);
      return g;
    }

    slider(parent, { label, min = 0, max = 1, step, value = min, unit = "", digits, onInput, format }) {
      step = step ?? (max - min) / 100;
      digits = digits ?? (step >= 1 ? 0 : step >= 0.1 ? 1 : 2);
      const row = document.createElement("label");
      row.className = "ctl ctl-slider";
      row.innerHTML = `<span class="ctl-label">${label}</span><output></output><input type="range">`;
      const input = row.querySelector("input");
      const out = row.querySelector("output");
      Object.assign(input, { min, max, step, value });
      const show = () => (out.textContent = format ? format(+input.value) : (+input.value).toFixed(digits) + unit);
      show();
      input.addEventListener("input", () => {
        show();
        onInput && onInput(+input.value);
      });
      parent.append(row);
      return {
        el: row,
        input,
        get value() { return +input.value; },
        set value(v) { input.value = v; show(); },
      };
    }

    checkbox(parent, { label, value = false, onChange }) {
      const row = document.createElement("label");
      row.className = "ctl ctl-check";
      row.innerHTML = `<input type="checkbox"><span>${label}</span>`;
      const input = row.querySelector("input");
      input.checked = value;
      input.addEventListener("change", () => onChange && onChange(input.checked));
      parent.append(row);
      return {
        el: row,
        get value() { return input.checked; },
        set value(v) { input.checked = v; },
      };
    }

    // options: ["a", "b"] or [["value", "Label"], ...]
    select(parent, { label, options, value, onChange }) {
      const row = document.createElement("label");
      row.className = "ctl ctl-select";
      row.innerHTML = `<span class="ctl-label">${label}</span><select></select>`;
      const sel = row.querySelector("select");
      for (const o of options) {
        const [v, text] = Array.isArray(o) ? o : [o, o];
        sel.add(new Option(text, v));
      }
      if (value !== undefined) sel.value = value;
      sel.addEventListener("change", () => onChange && onChange(sel.value));
      parent.append(row);
      return {
        el: row,
        get value() { return sel.value; },
        set value(v) { sel.value = v; },
      };
    }

    // A row of mutually-exclusive pill buttons.
    segmented(parent, { label, options, value, onChange }) {
      const row = document.createElement("div");
      row.className = "ctl ctl-seg";
      if (label) row.innerHTML = `<span class="ctl-label">${label}</span>`;
      const pills = document.createElement("div");
      pills.className = "seg";
      row.append(pills);
      let current = value ?? (Array.isArray(options[0]) ? options[0][0] : options[0]);
      const buttons = options.map((o) => {
        const [v, text] = Array.isArray(o) ? o : [o, o];
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        b.dataset.value = v;
        b.addEventListener("click", () => {
          api.value = v;
          onChange && onChange(v);
        });
        pills.append(b);
        return b;
      });
      const api = {
        el: row,
        get value() { return current; },
        set value(v) {
          current = v;
          buttons.forEach((b) => b.classList.toggle("on", b.dataset.value === String(v)));
        },
      };
      api.value = current;
      parent.append(row);
      return api;
    }

    button(parent, { label, onClick, primary = false }) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn" + (primary ? " btn-primary" : "");
      b.textContent = label;
      b.addEventListener("click", () => onClick && onClick(b));
      parent.append(b);
      return b;
    }

    buttons(parent, list) {
      const row = document.createElement("div");
      row.className = "ctl-buttons";
      parent.append(row);
      return list.map((def) => this.button(row, def));
    }

    // Live text panel. set() only touches the DOM when the content changes.
    readout(parent) {
      const box = document.createElement("div");
      box.className = "readout";
      parent.append(box);
      let last = "";
      return {
        el: box,
        set(html) {
          if (html !== last) box.innerHTML = last = html;
        },
      };
    }

    // HTML helpers for readouts:
    //   readout.set(sim.rows([["|a|", fmt(len)], ["a · b", fmt(d), d > 0 ? "ok" : "bad"]]))
    rows(list) {
      return list.map(([k, v, cls]) =>
        `<div class="row"><span>${k}</span><span${cls ? ` class="${cls}"` : ""}>${v}</span></div>`).join("");
    }

    // Small colored square matching a sim color key, for use inside readout labels.
    swatch(c) {
      return `<i class="swatch" style="background:${this.color(c)}"></i>`;
    }

    note(parent, html) {
      const n = document.createElement("p");
      n.className = "sim-note";
      n.innerHTML = html;
      parent.append(n);
      return n;
    }

    // [["a", "vector a"], ["b", "vector b"]]
    legend(parent, items) {
      const l = document.createElement("div");
      l.className = "sim-legend";
      l.innerHTML = items.map(([c, t]) => `<span><i style="background:${this.color(c)}"></i>${t}</span>`).join("");
      this.onTheme(() => {
        l.querySelectorAll("i").forEach((i, k) => (i.style.background = this.color(items[k][0])));
      });
      parent.append(l);
      return l;
    }

    // ------------------------------------------------------------ canvases
    // Raw DPR-aware canvas. ctx is pre-scaled so you draw in CSS pixels.
    canvas(parent, { height = 420, aspect } = {}) {
      return new Canvas(this, parent, { height, aspect });
    }

    // Low-resolution pixel buffer shown scaled up - for per-pixel demos
    // (ray tracing, shading, rasterization). Write RGBA bytes into .data then call put().
    raster(parent, { width = 160, height = 120, displayHeight = 400, smooth = false } = {}) {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      c.className = "sim-canvas sim-raster";
      c.style.height = displayHeight + "px";
      c.style.aspectRatio = `${width} / ${height}`;
      c.style.imageRendering = smooth ? "auto" : "pixelated";
      parent.append(c);
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(width, height);
      return {
        el: c,
        width,
        height,
        data: img.data,
        set(x, y, r, g, b, a = 255) {
          const i = (y * width + x) * 4;
          img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
        },
        put() { ctx.putImageData(img, 0, 0); },
      };
    }

    view2d(parent, opts = {}) {
      const v = new View2D(this, parent, opts);
      this._views.push(v);
      return v;
    }

    view3d(parent, opts = {}) {
      const v = new View3D(this, parent, opts);
      this._views.push(v);
      return v;
    }
  }

  // ================================================================ Canvas
  class Canvas {
    constructor(sim, parent, { height, aspect }) {
      this.sim = sim;
      this.el = document.createElement("canvas");
      this.el.className = "sim-canvas";
      this.el.style.height = height + "px";
      if (aspect) {
        this.el.style.height = "auto";
        this.el.style.aspectRatio = String(aspect);
      }
      parent.append(this.el);
      this.ctx = this.el.getContext("2d");
      this.w = 1;
      this.h = 1;
      this._resizeFns = [];
      this._drawFn = null;
      this._queued = false;
      const ro = new ResizeObserver(() => this._resize());
      ro.observe(this.el);
      sim.cleanup(() => ro.disconnect());
      this._resize();
    }

    _resize() {
      const r = this.el.getBoundingClientRect();
      if (r.width < 2) return;
      const d = DPR();
      this.w = r.width;
      this.h = r.height;
      this.el.width = Math.round(r.width * d);
      this.el.height = Math.round(r.height * d);
      this.ctx.setTransform(d, 0, 0, d, 0, 0);
      this._resizeFns.forEach((fn) => fn(this.w, this.h));
      this.redraw(true);
    }

    onResize(fn) {
      this._resizeFns.push(fn);
    }

    onDraw(fn) {
      this._drawFn = fn;
      this.redraw();
      return this;
    }

    // Coalesces many redraw requests into one paint per frame. redraw(true) paints now.
    redraw(now = false) {
      if (!this._drawFn || this.sim.destroyed) return;
      if (now === true) {
        this._paint();
        return;
      }
      if (this._queued) return;
      this._queued = true;
      requestAnimationFrame(() => {
        this._queued = false;
        if (!this.sim.destroyed) this._paint();
      });
    }

    _paint() {
      this.ctx.clearRect(0, 0, this.w, this.h);
      this._drawFn(this);
    }

    // Screen-space text helper.
    label(x, y, text, { color = "fg", size = 12, weight = 500, align = "left", baseline = "alphabetic", bg } = {}) {
      const ctx = this.ctx;
      ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = align;
      ctx.textBaseline = baseline;
      if (bg) {
        const w = ctx.measureText(text).width;
        const x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
        ctx.fillStyle = this.sim.color(bg);
        ctx.fillRect(x0 - 3, y - size, w + 6, size + 5);
      }
      ctx.fillStyle = this.sim.color(color);
      ctx.fillText(text, x, y);
    }
  }

  // ================================================================ View2D
  // World-space 2D view with y pointing up.
  //   opts.range   half the visible height in world units (uniform scale)   default 5
  //   opts.center  world point at the middle of the canvas                  default [0, 0]
  //   opts.xRange / opts.yRange  [min, max] for a non-uniform plot-style view
  //   opts.height  canvas height in px                                      default 420
  //   opts.zoom    wheel zoom (uniform views only)                          default false
  class View2D extends Canvas {
    constructor(sim, parent, opts) {
      super(sim, parent, { height: opts.height || 420, aspect: opts.aspect });
      this.opts = opts;
      this.range = opts.range || 5;
      this.center = opts.center ? [...opts.center] : [0, 0];
      this.handles = [];
      this._drag = null;
      this._setupPointer();
      if (opts.zoom) {
        sim.on(this.el, "wheel", (e) => {
          e.preventDefault();
          this.range = clamp(this.range * Math.exp(e.deltaY * 0.001), 0.5, 200);
          this.redraw();
        }, { passive: false });
      }
    }

    // pixels per world unit, for x and y
    get sx() {
      return this.opts.xRange ? this.w / (this.opts.xRange[1] - this.opts.xRange[0]) : this.h / (2 * this.range);
    }
    get sy() {
      return this.opts.yRange ? this.h / (this.opts.yRange[1] - this.opts.yRange[0]) : this.h / (2 * this.range);
    }
    get scale() {
      return this.sy;
    }

    toScreen(p) {
      if (this.opts.xRange) {
        return [(p[0] - this.opts.xRange[0]) * this.sx, this.h - (p[1] - this.opts.yRange[0]) * this.sy];
      }
      return [this.w / 2 + (p[0] - this.center[0]) * this.sx, this.h / 2 - (p[1] - this.center[1]) * this.sy];
    }

    toWorld(x, y) {
      if (this.opts.xRange) {
        return [x / this.sx + this.opts.xRange[0], (this.h - y) / this.sy + this.opts.yRange[0]];
      }
      return [(x - this.w / 2) / this.sx + this.center[0], -(y - this.h / 2) / this.sy + this.center[1]];
    }

    // visible world rectangle
    get bounds() {
      const a = this.toWorld(0, this.h), b = this.toWorld(this.w, 0);
      return { xmin: a[0], ymin: a[1], xmax: b[0], ymax: b[1] };
    }

    _paint() {
      const ctx = this.ctx;
      ctx.fillStyle = this.sim.color("bg");
      ctx.fillRect(0, 0, this.w, this.h);
      this._drawFn(this);
      this.handles.forEach((h) => h.visible !== false && this._drawHandle(h));
    }

    // ---------------------------------------------------------- primitives
    _stroke(style, defWidth = 2) {
      const ctx = this.ctx;
      ctx.strokeStyle = withAlpha(this.sim.color(style.color), style.alpha ?? 1);
      ctx.lineWidth = style.width ?? defWidth;
      ctx.setLineDash(style.dash || []);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }

    _niceStep(pxPerUnit, target = 48) {
      const raw = target / pxPerUnit;
      const p = Math.pow(10, Math.floor(Math.log10(raw)));
      const n = raw / p;
      return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
    }

    grid({ step, stepX, stepY, color = "grid", major = true } = {}) {
      const ctx = this.ctx;
      const b = this.bounds;
      const gx = stepX || step || this._niceStep(this.sx);
      const gy = stepY || step || this._niceStep(this.sy);
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = this.sim.color(color);
      ctx.beginPath();
      for (let x = Math.ceil(b.xmin / gx) * gx; x <= b.xmax; x += gx) {
        const [px] = this.toScreen([x, 0]);
        ctx.moveTo(Math.round(px) + 0.5, 0);
        ctx.lineTo(Math.round(px) + 0.5, this.h);
      }
      for (let y = Math.ceil(b.ymin / gy) * gy; y <= b.ymax; y += gy) {
        const [, py] = this.toScreen([0, y]);
        ctx.moveTo(0, Math.round(py) + 0.5);
        ctx.lineTo(this.w, Math.round(py) + 0.5);
      }
      ctx.stroke();
      if (major) this._gridStep = [gx, gy];
    }

    axes({ color = "axis", ticks = false, labels = ["x", "y"] } = {}) {
      const ctx = this.ctx;
      const [ox, oy] = this.toScreen([0, 0]);
      const y0 = clamp(oy, 0, this.h), x0 = clamp(ox, 0, this.w);
      ctx.lineWidth = 1.25;
      ctx.setLineDash([]);
      ctx.strokeStyle = this.sim.color(color);
      ctx.beginPath();
      ctx.moveTo(0, y0); ctx.lineTo(this.w, y0);
      ctx.moveTo(x0, 0); ctx.lineTo(x0, this.h);
      ctx.stroke();
      if (labels) {
        this.label(this.w - 8, y0 - 6, labels[0], { color: "muted", align: "right", size: 12 });
        this.label(x0 + 6, 14, labels[1], { color: "muted", size: 12 });
      }
      if (ticks) {
        const [gx, gy] = this._gridStep || [this._niceStep(this.sx), this._niceStep(this.sy)];
        const b = this.bounds;
        const dec = (s) => (s >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(s))));
        for (let x = Math.ceil(b.xmin / gx) * gx; x <= b.xmax; x += gx) {
          if (Math.abs(x) < gx / 2) continue;
          const [px] = this.toScreen([x, 0]);
          this.label(px, clamp(y0 + 14, 12, this.h - 4), x.toFixed(dec(gx)), { color: "muted", size: 10, align: "center" });
        }
        for (let y = Math.ceil(b.ymin / gy) * gy; y <= b.ymax; y += gy) {
          if (Math.abs(y) < gy / 2) continue;
          const [, py] = this.toScreen([0, y]);
          this.label(clamp(x0 - 4, 24, this.w), py + 3, y.toFixed(dec(gy)), { color: "muted", size: 10, align: "right" });
        }
      }
    }

    line(a, b, style = {}) {
      this._stroke(style);
      const ctx = this.ctx;
      const [x1, y1] = this.toScreen(a), [x2, y2] = this.toScreen(b);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Infinite line through p with direction d, clipped to the view.
    infiniteLine(p, d, style = {}) {
      const b = this.bounds;
      const big = 4 * Math.max(b.xmax - b.xmin, b.ymax - b.ymin) + V.len(p);
      const u = V.norm(d);
      this.line(V.sub(p, V.scale(u, big)), V.add(p, V.scale(u, big)), style);
    }

    polyline(pts, style = {}) {
      if (pts.length < 2) return;
      this._stroke(style);
      const ctx = this.ctx;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const [x, y] = this.toScreen(p);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      if (style.closed) ctx.closePath();
      ctx.stroke();
    }

    polygon(pts, style = {}) {
      const ctx = this.ctx;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const [x, y] = this.toScreen(p);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.closePath();
      if (style.fill) {
        ctx.fillStyle = withAlpha(this.sim.color(style.fill), style.fillAlpha ?? 0.25);
        ctx.fill();
      }
      if (style.color !== null && style.stroke !== false) {
        this._stroke(style, 1.5);
        ctx.stroke();
      }
    }

    rect(min, max, style = {}) {
      this.polygon([min, [max[0], min[1]], max, [min[0], max[1]]], style);
    }

    circle(c, r, style = {}) {
      const ctx = this.ctx;
      const [x, y] = this.toScreen(c);
      ctx.beginPath();
      ctx.ellipse(x, y, Math.abs(r * this.sx), Math.abs(r * this.sy), 0, 0, Math.PI * 2);
      if (style.fill) {
        ctx.fillStyle = withAlpha(this.sim.color(style.fill), style.fillAlpha ?? 0.25);
        ctx.fill();
      }
      if (style.stroke !== false) {
        this._stroke(style, 1.5);
        ctx.stroke();
      }
    }

    point(p, style = {}) {
      const ctx = this.ctx;
      const [x, y] = this.toScreen(p);
      ctx.beginPath();
      ctx.arc(x, y, style.r ?? 4, 0, Math.PI * 2);
      ctx.fillStyle = this.sim.color(style.color);
      ctx.fill();
      if (style.label) this.text(p, style.label, { color: style.color, offset: style.labelOffset || [8, -8] });
    }

    arrow(from, to, style = {}) {
      const [x1, y1] = this.toScreen(from), [x2, y2] = this.toScreen(to);
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 0.5) return;
      const ctx = this.ctx;
      const head = Math.min(style.head ?? 11, len * 0.5);
      const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      this._stroke(style, 2.5);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2 - ux * head * 0.8, y2 - uy * head * 0.8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = withAlpha(this.sim.color(style.color), style.alpha ?? 1);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - ux * head - uy * head * 0.45, y2 - uy * head + ux * head * 0.45);
      ctx.lineTo(x2 - ux * head + uy * head * 0.45, y2 - uy * head - ux * head * 0.45);
      ctx.closePath();
      ctx.fill();
      if (style.label) {
        const mid = [(x1 + x2) / 2, (y1 + y2) / 2];
        const off = style.labelOffset || [-uy * 14, ux * 14];
        this.label(mid[0] + off[0], mid[1] + off[1] + 4, style.label, {
          color: style.color, weight: 700, size: 14, align: "center",
        });
      }
    }

    // Text at a world position. offset is in pixels.
    text(p, str, { color = "fg", size = 13, weight = 600, align = "left", offset = [0, 0], bg } = {}) {
      const [x, y] = this.toScreen(p);
      this.label(x + offset[0], y + offset[1], str, { color, size, weight, align, bg });
    }

    // Arc between two angles (radians, counterclockwise) around a world center.
    arc(c, r, a0, a1, style = {}) {
      const ctx = this.ctx;
      const [x, y] = this.toScreen(c);
      this._stroke(style, 1.5);
      ctx.beginPath();
      ctx.arc(x, y, r * this.sx, -a0, -a1, a1 > a0);
      ctx.stroke();
    }

    // Graph of y = f(x) across the visible x range.
    plot(f, style = {}) {
      const b = this.bounds;
      const n = style.samples || Math.ceil(this.w / 2);
      const x0 = style.from ?? b.xmin, x1 = style.to ?? b.xmax;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const y = f(x);
        if (Number.isFinite(y)) pts.push([x, clamp(y, b.ymin - (b.ymax - b.ymin), b.ymax + (b.ymax - b.ymin))]);
      }
      this.polyline(pts, style);
    }

    // ------------------------------------------------------------- handles
    // Draggable point. handle.pos is a live [x, y] array.
    //   opts: color, label, r, snap (grid step), constrain(pos) -> pos, onDrag(pos)
    handle(pos, opts = {}) {
      const h = { pos: [...pos], ...opts };
      h.set = (p) => {
        h.pos[0] = p[0];
        h.pos[1] = p[1];
        this.redraw();
      };
      this.handles.push(h);
      this.redraw();
      return h;
    }

    _drawHandle(h) {
      const ctx = this.ctx;
      const [x, y] = this.toScreen(h.pos);
      const active = this._drag === h || this._hover === h;
      ctx.beginPath();
      ctx.arc(x, y, (h.r ?? 7) + (active ? 2 : 0), 0, Math.PI * 2);
      ctx.fillStyle = this.sim.color(h.color || "accent");
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeStyle = this.sim.color("bg");
      ctx.stroke();
      if (h.label) this.label(x + 10, y - 10, h.label, { color: h.color || "accent", weight: 700, size: 14 });
    }

    _pick(px, py) {
      let best = null, bestD = 18;
      for (const h of this.handles) {
        if (h.visible === false) continue;
        const [x, y] = this.toScreen(h.pos);
        const d = Math.hypot(x - px, y - py);
        if (d < bestD) { best = h; bestD = d; }
      }
      return best;
    }

    _setupPointer() {
      const local = (e) => {
        const r = this.el.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
      };
      this.sim.on(this.el, "pointerdown", (e) => {
        const [x, y] = local(e);
        const h = this._pick(x, y);
        if (h) {
          this._drag = h;
          this.el.setPointerCapture(e.pointerId);
          e.preventDefault();
          this.redraw();
        } else if (this._onClick) {
          this._onClick(this.toWorld(x, y), e);
        }
      });
      this.sim.on(this.el, "pointermove", (e) => {
        const [x, y] = local(e);
        if (this._drag) {
          const h = this._drag;
          let p = this.toWorld(x, y);
          if (h.snap) p = p.map((c) => Math.round(c / h.snap) * h.snap);
          if (h.constrain) p = h.constrain(p);
          h.pos[0] = p[0];
          h.pos[1] = p[1];
          h.onDrag && h.onDrag(h.pos);
          this.redraw();
        } else {
          const h = this._pick(x, y);
          if (h !== this._hover) {
            this._hover = h;
            this.el.style.cursor = h ? "grab" : this._onClick ? "crosshair" : "";
            this.redraw();
          }
        }
      });
      const end = () => {
        if (!this._drag) return;
        const h = this._drag;
        this._drag = null;
        h.onRelease && h.onRelease(h.pos);
        this.redraw();
      };
      this.sim.on(this.el, "pointerup", end);
      this.sim.on(this.el, "pointercancel", end);
      this.el.style.touchAction = "none";
    }

    // Called with the world position when the user clicks empty space.
    onClick(fn) {
      this._onClick = fn;
      this.el.style.cursor = "crosshair";
    }
  }

  // ================================================================ View3D
  // Orbit-camera 3D view (y up, right-handed). Drag to orbit, wheel to zoom.
  // Primitives are queued while your draw function runs, then depth-sorted
  // (painter's algorithm) and painted far-to-near.
  //   opts: height, yaw, pitch (radians), distance, target, fov (degrees), orbit, zoom
  class View3D extends Canvas {
    constructor(sim, parent, opts) {
      super(sim, parent, { height: opts.height || 440, aspect: opts.aspect });
      this.opts = opts;
      this.yaw = opts.yaw ?? 0.6;
      this.pitch = opts.pitch ?? 0.45;
      this.distance = opts.distance ?? 10;
      this.target = opts.target ? [...opts.target] : [0, 0, 0];
      this.fov = L3D.math.rad(opts.fov ?? 45);
      this.light = V.norm(opts.light || [0.4, 0.9, 0.6]);
      this._queue = [];
      if (opts.orbit !== false) this._setupOrbit();
      if (opts.zoom !== false) {
        sim.on(this.el, "wheel", (e) => {
          e.preventDefault();
          this.distance = clamp(this.distance * Math.exp(e.deltaY * 0.001), 1.5, 200);
          this.redraw();
        }, { passive: false });
      }
    }

    get eye() {
      const cp = Math.cos(this.pitch);
      return V.add(this.target, V.scale([cp * Math.sin(this.yaw), Math.sin(this.pitch), cp * Math.cos(this.yaw)], this.distance));
    }

    // Camera basis, recomputed each paint.
    _updateCamera() {
      this.view = M.lookAt(this.eye, this.target, [0, 1, 0]);
      this.focal = this.h / 2 / Math.tan(this.fov / 2);
    }

    // World -> camera space (camera looks down -z).
    toCamera(p) {
      return M.transformPoint(this.view, p);
    }

    // World -> screen. Returns { x, y, depth, ok } where depth > 0 is in front of the camera.
    project(p) {
      const c = this.toCamera(p);
      const depth = -c[2];
      if (depth < 0.05) return { x: 0, y: 0, depth, ok: false };
      return { x: this.w / 2 + (c[0] * this.focal) / depth, y: this.h / 2 - (c[1] * this.focal) / depth, depth, ok: true };
    }

    _paint() {
      this._updateCamera();
      const ctx = this.ctx;
      ctx.fillStyle = this.sim.color("bg");
      ctx.fillRect(0, 0, this.w, this.h);
      this._queue = [];
      this._overlay = [];
      this._drawFn(this);
      this._queue.sort((a, b) => b.depth - a.depth);
      for (const item of this._queue) item.paint(ctx);
      for (const item of this._overlay) item.paint(ctx);
      if (this.opts.hint !== false) {
        this.label(this.w - 10, this.h - 10, "drag to orbit · scroll to zoom", { color: "muted", size: 11, align: "right" });
      }
    }

    _push(depth, paint, overlay) {
      (overlay ? this._overlay : this._queue).push({ depth, paint });
    }

    // Clip a segment to the near plane in camera space.
    _clipSegment(a, b) {
      let ca = this.toCamera(a), cb = this.toCamera(b);
      const near = -0.05;
      if (ca[2] > near && cb[2] > near) return null;
      if (ca[2] > near) ca = V.lerp(ca, cb, (ca[2] - near) / (ca[2] - cb[2]));
      else if (cb[2] > near) cb = V.lerp(cb, ca, (cb[2] - near) / (cb[2] - ca[2]));
      const s = (c) => ({ x: this.w / 2 + (c[0] * this.focal) / -c[2], y: this.h / 2 - (c[1] * this.focal) / -c[2], depth: -c[2] });
      return [s(ca), s(cb)];
    }

    _strokeStyle(ctx, style, w = 2) {
      ctx.strokeStyle = withAlpha(this.sim.color(style.color), style.alpha ?? 1);
      ctx.lineWidth = style.width ?? w;
      ctx.setLineDash(style.dash || []);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }

    // ---------------------------------------------------------- primitives
    line(a, b, style = {}) {
      const seg = this._clipSegment(a, b);
      if (!seg) return;
      const [p, q] = seg;
      this._push((p.depth + q.depth) / 2 - (style.bias ?? 0.01), (ctx) => {
        this._strokeStyle(ctx, style);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }, style.overlay);
    }

    polyline(pts, style = {}) {
      for (let i = 0; i + 1 < pts.length; i++) this.line(pts[i], pts[i + 1], style);
      if (style.closed && pts.length > 2) this.line(pts[pts.length - 1], pts[0], style);
    }

    arrow(from, to, style = {}) {
      const seg = this._clipSegment(from, to);
      if (!seg) return;
      const [p, q] = seg;
      this._push(Math.min(p.depth, q.depth) - (style.bias ?? 0.02), (ctx) => {
        const len = Math.hypot(q.x - p.x, q.y - p.y);
        if (len < 0.5) return;
        const head = Math.min(style.head ?? 11, len * 0.5);
        const ux = (q.x - p.x) / len, uy = (q.y - p.y) / len;
        this._strokeStyle(ctx, style, 2.5);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x - ux * head * 0.8, q.y - uy * head * 0.8);
        ctx.stroke();
        ctx.fillStyle = withAlpha(this.sim.color(style.color), style.alpha ?? 1);
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(q.x - ux * head - uy * head * 0.45, q.y - uy * head + ux * head * 0.45);
        ctx.lineTo(q.x - ux * head + uy * head * 0.45, q.y - uy * head - ux * head * 0.45);
        ctx.closePath();
        ctx.fill();
        if (style.label) this.label(q.x + 8, q.y - 8, style.label, { color: style.color, weight: 700, size: 14 });
      }, style.overlay);
    }

    point(p, style = {}) {
      const s = this.project(p);
      if (!s.ok) return;
      this._push(s.depth - 0.03, (ctx) => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, style.r ?? 4.5, 0, Math.PI * 2);
        ctx.fillStyle = this.sim.color(style.color);
        ctx.fill();
        if (style.label) this.label(s.x + 8, s.y - 8, style.label, { color: style.color, weight: 700, size: 13 });
      }, style.overlay);
    }

    text(p, str, { color = "fg", size = 13, weight = 600, align = "left", offset = [0, 0], overlay = true } = {}) {
      const s = this.project(p);
      if (!s.ok) return;
      this._push(s.depth, () => this.label(s.x + offset[0], s.y + offset[1], str, { color, size, weight, align }), overlay);
    }

    // Filled polygon. style: fill, alpha, color (outline), lit (shade by facing), cull (skip back faces)
    poly(pts, style = {}) {
      const ps = pts.map((p) => this.project(p));
      if (ps.some((s) => !s.ok)) return;
      let fill = style.fill ? this.sim.color(style.fill) : null;
      if (pts.length >= 3 && (style.lit || style.cull)) {
        const n = V.norm(V.cross(V.sub(pts[1], pts[0]), V.sub(pts[2], pts[0])));
        const toEye = V.sub(this.eye, pts[0]);
        const facing = V.dot(n, toEye) > 0;
        if (style.cull && !facing) return;
        if (style.lit && fill) {
          const nn = facing ? n : V.neg(n);
          fill = shade(fill, 0.45 + 0.65 * Math.max(0, V.dot(nn, this.light)));
        }
      }
      const depth = ps.reduce((s, p) => s + p.depth, 0) / ps.length + (style.bias ?? 0);
      this._push(depth, (ctx) => {
        ctx.beginPath();
        ps.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)));
        ctx.closePath();
        if (fill) {
          ctx.fillStyle = withAlpha(fill, style.alpha ?? 1);
          ctx.fill();
        }
        if (style.color) {
          this._strokeStyle(ctx, style, 1);
          ctx.stroke();
        }
      }, style.overlay);
    }

    // Shaded sphere (drawn as a gradient disk).
    sphere(c, r, style = {}) {
      const s = this.project(c);
      if (!s.ok) return;
      const pr = (r * this.focal) / s.depth;
      const base = this.sim.color(style.fill || style.color || "a");
      this._push(s.depth + (style.bias ?? 0), (ctx) => {
        const g = ctx.createRadialGradient(s.x - pr * 0.35, s.y - pr * 0.4, pr * 0.1, s.x, s.y, pr);
        g.addColorStop(0, shade(base, 1.45, style.alpha ?? 1));
        g.addColorStop(0.6, shade(base, 1.0, style.alpha ?? 1));
        g.addColorStop(1, shade(base, 0.55, style.alpha ?? 1));
        ctx.beginPath();
        ctx.arc(s.x, s.y, pr, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        if (style.color && style.fill) {
          this._strokeStyle(ctx, style, 1);
          ctx.stroke();
        }
      }, style.overlay);
    }

    // Circle in 3D: center, unit normal, radius.
    circle(c, n, r, style = {}) {
      const u = V.anyPerp(n), v = V.cross(n, u);
      const pts = [];
      const k = style.segments || 48;
      for (let i = 0; i <= k; i++) {
        const t = (i / k) * Math.PI * 2;
        pts.push(V.add(c, V.add(V.scale(u, r * Math.cos(t)), V.scale(v, r * Math.sin(t)))));
      }
      if (style.fill) this.poly(pts.slice(0, -1), { ...style, color: null });
      if (style.color !== null) this.polyline(pts, style);
    }

    // Grid on the y = 0 plane (or opts.y).
    grid({ size = 5, step = 1, color = "grid", y = 0 } = {}) {
      for (let x = -size; x <= size + 1e-9; x += step) {
        this.line([x, y, -size], [x, y, size], { color, width: 1, bias: -1000 });
        this.line([-size, y, x], [size, y, x], { color, width: 1, bias: -1000 });
      }
    }

    // RGB = XYZ axes.
    axes({ length = 2, labels = true, width = 2 } = {}) {
      const ax = [[[length, 0, 0], "e", "x"], [[0, length, 0], "c", "y"], [[0, 0, length], "a", "z"]];
      for (const [d, c, name] of ax) {
        this.arrow([0, 0, 0], d, { color: c, width, head: 9 });
        if (labels) this.text(V.scale(d, 1.08), name, { color: c, size: 12, weight: 700 });
      }
    }

    // Quad patch of a plane through p with normal n.
    plane(p, n, size = 3, style = {}) {
      n = V.norm(n);
      const u = V.scale(V.anyPerp(n), size), v = V.scale(V.cross(n, V.anyPerp(n)), size);
      const corners = [V.add(V.add(p, u), v), V.add(V.sub(p, u), v), V.sub(V.sub(p, u), v), V.sub(V.add(p, u), v)];
      this.poly(corners, { fill: "a", alpha: 0.18, color: style.color ?? "a", width: 1, ...style });
    }

    // Mesh: { vertices: [[x,y,z]...], faces: [[i,j,k,...]...] } with counterclockwise faces.
    //   style.transform: function(p) -> p, or a 4x4 matrix
    //   style.fill / faceColors[i], lit (default true), cull (default true), wire, alpha
    mesh(mesh, style = {}) {
      const T = style.transform;
      const xf = !T ? (p) => p : typeof T === "function" ? T : (p) => M.transformPoint(T, p);
      const vs = mesh.vertices.map(xf);
      mesh.faces.forEach((f, i) => {
        this.poly(f.map((k) => vs[k]), {
          fill: (style.faceColors && style.faceColors[i]) || style.fill || "a",
          lit: style.lit ?? true,
          cull: style.cull ?? true,
          alpha: style.alpha ?? 1,
          color: style.wire ? style.wireColor || "fg" : null,
          width: 1,
        });
      });
    }

    // Axis-aligned box from min to max corner.
    box(min, max, style = {}) {
      this.mesh(L3D.shapes.box(min, max), style);
    }

    _setupOrbit() {
      let drag = null;
      this.sim.on(this.el, "pointerdown", (e) => {
        if (e.button !== 0) return;
        drag = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch };
        this.el.setPointerCapture(e.pointerId);
        this.el.style.cursor = "grabbing";
      });
      this.sim.on(this.el, "pointermove", (e) => {
        if (!drag) return;
        this.yaw = drag.yaw - (e.clientX - drag.x) * 0.008;
        this.pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.008, -1.45, 1.45);
        this.redraw();
        this._orbitFns && this._orbitFns.forEach((fn) => fn());
      });
      const end = () => {
        drag = null;
        this.el.style.cursor = "grab";
      };
      this.sim.on(this.el, "pointerup", end);
      this.sim.on(this.el, "pointercancel", end);
      this.el.style.cursor = "grab";
      this.el.style.touchAction = "none";
    }

    onOrbit(fn) {
      (this._orbitFns = this._orbitFns || []).push(fn);
    }
  }

  // ================================================================ shapes
  // Simple meshes for View3D.mesh(). Faces are counterclockwise seen from outside.
  const shapes = {
    box(min = [-1, -1, -1], max = [1, 1, 1]) {
      const [x0, y0, z0] = min, [x1, y1, z1] = max;
      return {
        vertices: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
        faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [0, 1, 5, 4], [3, 7, 6, 2]],
      };
    },
    // UV sphere
    sphere(r = 1, seg = 16, rings = 10) {
      const vertices = [], faces = [];
      for (let i = 0; i <= rings; i++) {
        const phi = (i / rings) * Math.PI;
        for (let j = 0; j < seg; j++) {
          const th = (j / seg) * Math.PI * 2;
          vertices.push([r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), -r * Math.sin(phi) * Math.sin(th)]);
        }
      }
      for (let i = 0; i < rings; i++)
        for (let j = 0; j < seg; j++) {
          const a = i * seg + j, b = i * seg + ((j + 1) % seg);
          faces.push([a, a + seg, b + seg, b]);
        }
      return { vertices, faces };
    },
    // Square-based pyramid with apex on +y
    pyramid(s = 1, h = 1.5) {
      return {
        vertices: [[-s, 0, -s], [s, 0, -s], [s, 0, s], [-s, 0, s], [0, h, 0]],
        faces: [[0, 1, 2, 3], [3, 2, 4], [2, 1, 4], [1, 0, 4], [0, 3, 4]],
      };
    },
  };

  window.L3D = window.L3D || {};
  L3D.Sim = Sim;
  L3D.shapes = shapes;
  L3D.color = { shade, withAlpha, parse: parseColor };
})();
