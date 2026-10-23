// Chapter 7 - Lighting and Shading
(function () {
  "use strict";
  const { V, M, fmt, fmtVec, rad, deg, clamp, lerp, smoothstep } = L3D.math;

  // ===========================================================================
  // Shared helpers for the per-pixel demos in this chapter
  // ===========================================================================

  // Colors are [r, g, b] arrays with components in 0..1, so V.add / V.scale / V.mul work on them.
  const rgb = (css) => L3D.color.parse(css).map((x) => x / 255);
  const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const fmtCol = (c, d = 2) => "(" + c.map((x) => fmt(x, d)).join(", ") + ")";
  const cssCol = (c) => `rgb(${c.map((x) => Math.round(sat(x) * 255)).join(",")})`;
  const colSwatch = (c) => `<i class="swatch" style="background:${cssCol(c)};outline:1px solid rgba(128,128,128,.5)"></i>`;
  const n3 = (x, y, z) => {
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  };
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  // A low-resolution pixel buffer, drawn scaled up (nearest neighbour) into an ordinary sim canvas so
  // that labels, arrows and wireframes can be drawn on top in screen space.
  //   render(pc)      fills pc.data (RGBA bytes, pc.width x pc.height); runs only after invalidate()
  //   overlay(c, pc)  optional; draws on the canvas after the image (pc.toCanvas maps buffer -> canvas px)
  //   fill            buffer width follows the canvas aspect ratio (height stays fixed)
  function pixelCanvas(sim, parent, opts) {
    const { height = 150, canvasHeight = 400, render, overlay, fill = false, minWidth = 80, maxWidth = 360 } = opts;
    const off = document.createElement("canvas");
    const octx = off.getContext("2d");
    const cv = sim.canvas(parent, { height: canvasHeight });
    let img = null;
    let dirty = true;
    const pc = {
      canvas: cv,
      el: cv.el,
      width: 0,
      height,
      data: null,
      rect: { x: 0, y: 0, w: 1, h: 1 },
      invalidate() { dirty = true; cv.redraw(); },
      redraw() { cv.redraw(); },
      // write one pixel from 0..1 floats (the clamped byte array clamps and rounds)
      set(x, y, r, g, b) {
        const i = (y * pc.width + x) * 4, d = pc.data;
        d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = b * 255; d[i + 3] = 255;
      },
      toCanvas(px, py) {
        return [pc.rect.x + (px / pc.width) * pc.rect.w, pc.rect.y + (py / pc.height) * pc.rect.h];
      },
      fromClient(cx, cy) {
        const r = cv.el.getBoundingClientRect();
        return [((cx - r.left - pc.rect.x) / pc.rect.w) * pc.width, ((cy - r.top - pc.rect.y) / pc.rect.h) * pc.height];
      },
    };
    const alloc = (w) => {
      pc.width = w;
      off.width = w;
      off.height = height;
      img = octx.createImageData(w, height);
      pc.data = img.data;
      dirty = true;
    };
    alloc(opts.width || 200);
    cv.onDraw((c) => {
      if (fill) {
        const w = clamp(Math.round((height * c.w) / Math.max(1, c.h)), minWidth, maxWidth);
        if (w !== pc.width) alloc(w);
      }
      if (dirty) {
        dirty = false;
        render(pc);
        octx.putImageData(img, 0, 0);
      }
      const s = Math.min(c.w / pc.width, c.h / height);
      const w = pc.width * s, h = height * s;
      pc.rect = { x: (c.w - w) / 2, y: (c.h - h) / 2, w, h };
      c.ctx.imageSmoothingEnabled = false;
      c.ctx.drawImage(off, pc.rect.x, pc.rect.y, w, h);
      if (overlay) overlay(c, pc);
    });
    sim.onTheme(() => pc.invalidate());
    return pc;
  }

  // Pointer input on a pixel canvas, reported in buffer pixel coordinates.
  //   onDrag(px, py, first)  while a button is held (first = true on the press)
  //   onHover(px, py)        when the pointer moves with no button held
  function pointer(sim, pc, { onDrag, onHover }) {
    let down = false;
    const el = pc.el;
    el.style.touchAction = "none";
    el.style.cursor = "crosshair";
    sim.on(el, "pointerdown", (e) => {
      down = true;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
      const [x, y] = pc.fromClient(e.clientX, e.clientY);
      if (onDrag) onDrag(x, y, true);
    });
    sim.on(el, "pointermove", (e) => {
      const [x, y] = pc.fromClient(e.clientX, e.clientY);
      if (down) { if (onDrag) onDrag(x, y, false); }
      else if (onHover) onHover(x, y);
    });
    const up = () => (down = false);
    sim.on(el, "pointerup", up);
    sim.on(el, "pointercancel", up);
  }

  // Head-on (orthographic) view of a unit sphere inside a sub-rectangle of a pixel buffer.
  const sphereGeom = (x0, y0, w, h, k = 0.44) => ({ cx: x0 + w / 2, cy: y0 + h / 2, R: Math.min(w, h) * k });
  // Unit normal under buffer pixel (px, py), or null outside the disk. The viewer looks down -z, so V = (0, 0, 1).
  function sphereNormal(g, px, py) {
    const x = (px + 0.5 - g.cx) / g.R, y = (g.cy - py - 0.5) / g.R, r2 = x * x + y * y;
    return r2 > 1 ? null : [x, y, Math.sqrt(1 - r2)];
  }
  // Pointer -> unit direction. Inside the disk is the front hemisphere; the ring out to 2R is the back.
  function dirFromDisk(g, px, py) {
    const x = (px - g.cx) / g.R, y = (g.cy - py) / g.R;
    const r = Math.hypot(x, y);
    if (r < 1e-9) return [0, 0, 1];
    if (r <= 1) return [x, y, Math.sqrt(Math.max(0, 1 - r * r))];
    const rr = Math.max(0, 2 - Math.min(r, 2));
    return [(x / r) * rr, (y / r) * rr, -Math.sqrt(Math.max(0, 1 - rr * rr))];
  }
  // Inverse of dirFromDisk: where to draw the marker for direction L.
  function diskFromDir(g, L) {
    const rr = Math.hypot(L[0], L[1]);
    if (rr < 1e-9) return [g.cx, g.cy];
    const r = L[2] >= 0 ? rr : 2 - rr;
    return [g.cx + (L[0] / rr) * r * g.R, g.cy - (L[1] / rr) * r * g.R];
  }
  // Draw the light marker (a small sun) for a sphere demo.
  function drawLightMarker(c, pc, g, L, label = "L") {
    const [mx, my] = diskFromDir(g, L);
    const [x, y] = pc.toCanvas(mx, my);
    const [ox, oy] = pc.toCanvas(g.cx, g.cy);
    const ctx = c.ctx;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = L3D.color.withAlpha(c.sim.color("g"), 0.8);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = c.sim.color("g");
    ctx.strokeStyle = c.sim.color("bg");
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    c.label(x + 10, y - 8, label + (L[2] < 0 ? " (behind)" : ""), { color: "g", weight: 700, size: 13 });
  }
  // Small crosshair for a probe position.
  function drawProbe(c, pc, px, py, color = "fg") {
    const [x, y] = pc.toCanvas(px, py);
    const ctx = c.ctx;
    ctx.save();
    ctx.strokeStyle = c.sim.color("bg");
    ctx.lineWidth = 4;
    const cross = () => {
      ctx.beginPath();
      ctx.moveTo(x - 9, y); ctx.lineTo(x - 3, y); ctx.moveTo(x + 3, y); ctx.lineTo(x + 9, y);
      ctx.moveTo(x, y - 9); ctx.lineTo(x, y - 3); ctx.moveTo(x, y + 3); ctx.lineTo(x, y + 9);
      ctx.stroke();
    };
    cross();
    ctx.strokeStyle = c.sim.color(color);
    ctx.lineWidth = 2;
    cross();
    ctx.restore();
  }

  // Pinhole camera for the small ray-traced scenes (right-handed, y up).
  function makeCamera(eye, target, fovDeg) {
    const f = V.norm(V.sub(target, eye));
    const r = V.norm(V.cross(f, [0, 1, 0]));
    const u = V.cross(r, f);
    const k = Math.tan(rad(fovDeg) / 2);
    return {
      eye,
      // unnormalized ray direction through buffer pixel (px, py) of a W x H image
      ray(px, py, W, H) {
        const x = ((2 * (px + 0.5)) / W - 1) * k * (W / H), y = (1 - (2 * (py + 0.5)) / H) * k;
        return [f[0] + r[0] * x + u[0] * y, f[1] + r[1] * x + u[1] * y, f[2] + r[2] * x + u[2] * y];
      },
      // world point -> buffer pixel coordinates, or null when behind the camera
      project(P, W, H) {
        const d = V.sub(P, eye);
        const z = V.dot(d, f);
        if (z < 0.05) return null;
        const x = V.dot(d, r) / (z * k * (W / H)), y = V.dot(d, u) / (z * k);
        return [((x + 1) / 2) * W, ((1 - y) / 2) * H];
      },
    };
  }
  // Nearest positive hit of ray o + t d with a sphere, or Infinity.
  function hitSphere(o, d, c, r) {
    const ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
    const a = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    const b = 2 * (ox * d[0] + oy * d[1] + oz * d[2]);
    const cc = ox * ox + oy * oy + oz * oz - r * r;
    const disc = b * b - 4 * a * cc;
    if (disc < 0) return Infinity;
    const s = Math.sqrt(disc);
    let t = (-b - s) / (2 * a);
    if (t <= 1e-4) t = (-b + s) / (2 * a);
    return t > 1e-4 ? t : Infinity;
  }

  // Procedural textures: { w, h, data: Float32Array(w*h*3) } with values in 0..1. Row j grows with t.
  function makeTex(w, h, fn) {
    const data = new Float32Array(w * h * 3);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const c = fn(i, j, w, h);
        const k = (j * w + i) * 3;
        data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2];
      }
    return { w, h, data };
  }
  const wrapI = (i, n) => ((i % n) + n) % n;
  // Nearest texel (repeat wrapping). Writes into out[0..2].
  function sampleNearest(tex, s, t, out) {
    const i = wrapI(Math.floor(s * tex.w), tex.w), j = wrapI(Math.floor(t * tex.h), tex.h);
    const k = (j * tex.w + i) * 3;
    out[0] = tex.data[k]; out[1] = tex.data[k + 1]; out[2] = tex.data[k + 2];
    return out;
  }
  // Bilinear filtering, Equations (7.17) and (7.18), with repeat wrapping.
  function sampleBilinear(tex, s, t, out) {
    const x = s * tex.w - 0.5, y = t * tex.h - 0.5;
    const fi = Math.floor(x), fj = Math.floor(y);
    const a = x - fi, b = y - fj;
    const i0 = wrapI(fi, tex.w), i1 = wrapI(fi + 1, tex.w), j0 = wrapI(fj, tex.h), j1 = wrapI(fj + 1, tex.h);
    const d = tex.data, w = tex.w;
    const k00 = (j0 * w + i0) * 3, k10 = (j0 * w + i1) * 3, k01 = (j1 * w + i0) * 3, k11 = (j1 * w + i1) * 3;
    const w00 = (1 - a) * (1 - b), w10 = a * (1 - b), w01 = (1 - a) * b, w11 = a * b;
    for (let c = 0; c < 3; c++) out[c] = w00 * d[k00 + c] + w10 * d[k10 + c] + w01 * d[k01 + c] + w11 * d[k11 + c];
    return out;
  }
  // Mipmap chain: each level is a 2x2 box-filtered copy of the previous one, down to 1x1.
  function buildMips(tex) {
    const levels = [tex];
    let cur = tex;
    while (cur.w > 1 || cur.h > 1) {
      const w = Math.max(1, cur.w >> 1), h = Math.max(1, cur.h >> 1);
      const src = cur;
      cur = makeTex(w, h, (i, j) => {
        const c = [0, 0, 0];
        for (let dj = 0; dj < 2; dj++)
          for (let di = 0; di < 2; di++) {
            const k = (Math.min(src.h - 1, 2 * j + dj) * src.w + Math.min(src.w - 1, 2 * i + di)) * 3;
            c[0] += src.data[k] / 4; c[1] += src.data[k + 1] / 4; c[2] += src.data[k + 2] / 4;
          }
        return c;
      });
      levels.push(cur);
    }
    return levels;
  }
  // Deterministic value noise in 0..1 (tiles with period p).
  function hash2(i, j) {
    let h = (i * 374761393 + j * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function valueNoise(x, y, p) {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const h = (a, b) => hash2(wrapI(a, p), wrapI(b, p));
    return lerp(lerp(h(i, j), h(i + 1, j), sx), lerp(h(i, j + 1), h(i + 1, j + 1), sx), sy);
  }

  // Blinn-Phong for one light: returns [diffuse factor, specular factor] (Sections 7.3 and 7.4).
  function blinnPhong(N, L, Vw, m) {
    const nl = dot3(N, L);
    if (nl <= 0) return [0, 0];
    const H = n3(L[0] + Vw[0], L[1] + Vw[1], L[2] + Vw[2]);
    const nh = Math.max(0, dot3(N, H));
    return [nl, Math.pow(nh, m)];
  }

  // ===========================================================================
  // 7.1 RGB Color
  // ===========================================================================
  L3D.topic({
    id: "7.1",
    summary: "Colors are triplets of red, green and blue intensities. Lights add, surfaces and textures multiply (modulate), and the result is clamped for display.",

    lesson: String.raw`
      <p>Real light is a mix of many wavelengths, and an exact model of reflection would track every one of them.
      Our eyes don't need that much detail. The cone cells in the retina come in three kinds, sensitive to three
      overlapping bands of the spectrum that we call <strong>red</strong>, <strong>green</strong> and
      <strong>blue</strong>. A monitor exploits this by emitting only those three primaries in different amounts.
      Equal amounts of red and green light look yellow, red plus blue looks magenta, and all three at full strength
      look white. This is <strong>RGB color</strong>, and every lighting formula in this chapter works on RGB
      triplets.</p>

      <h2>Colors as triplets</h2>
      <p>The book writes colors with script letters so they don't get mixed up with vectors:
      \[ \mathcal C = (C_r, C_g, C_b), \qquad 0 \le C_r, C_g, C_b \le 1. \]
      One triplet carries two kinds of information at once: the <em>hue</em> (the ratios between the channels) and the
      <em>intensity</em> (how large the numbers are). \((0.5, 0.5, 0.5)\) is the same white as \((1, 1, 1)\), only
      half as bright. Every lighting calculation is done on all three channels at the same time, so we can write the
      formulas once, in terms of colors, instead of three times.</p>

      <h2>Arithmetic on colors</h2>
      <p>Scaling a color multiplies every channel (Equation 7.1), and adding or multiplying two colors works channel
      by channel (Equation 7.2):</p>
      <div class="formula">
        \[ s\mathcal C = (sC_r,\, sC_g,\, sC_b) \]
        \[ \mathcal C + \mathcal D = (C_r + D_r,\; C_g + D_g,\; C_b + D_b) \qquad
           \mathcal C\mathcal D = (C_rD_r,\; C_gD_g,\; C_bD_b) \]
      </div>
      <p>The two operations mean very different things physically:</p>
      <ul>
        <li><strong>Adding</strong> combines light. Two lamps shining on the same spot give the sum of their colors.
          This is why the total light at a point is a sum over all light sources (Section 7.2).</li>
        <li><strong>Multiplying</strong> filters light. A surface with color \(\mathcal D\) reflects the fraction
          \(D_r\) of the incoming red, \(D_g\) of the green and \(D_b\) of the blue. Multiplying colors (by another
          color or by a scalar) is called <strong>modulation</strong>.</li>
      </ul>
      <p>Some consequences you can check in the simulation. White light \((1,1,1)\) on red paint
      \((0.9, 0.1, 0.1)\) gives \((0.9, 0.1, 0.1)\): the paint shows its own color. Pure green light \((0,1,0)\) on the
      same paint gives \((0, 0.1, 0)\), nearly black, because the paint has almost no green to reflect. Multiplying by
      white \((1,1,1)\) changes nothing and multiplying by black \((0,0,0)\) gives black. Modulation is commutative,
      associative and distributes over addition, so
      \(\mathcal D(\mathcal C_1 + \mathcal C_2) = \mathcal D\mathcal C_1 + \mathcal D\mathcal C_2\). That is what lets the
      lighting formulas later in the chapter pull the surface color out of a sum over lights.</p>

      <div class="game">The color of a pixel on a rendered triangle usually comes from several sources combined. The
      classic case is a texel \(\mathcal T\) from a texture map multiplied by a color \(\mathcal V\) interpolated
      between the triangle's vertices: the texture is <em>modulated by the vertex color</em>. Engines use this for
      tinting (team colors, a red damage flash, darkening the corners of a room with baked vertex lighting) without
      having to store a separate texture for every variation.</div>

      <h2>Clamping (saturation)</h2>
      <p>Products of numbers in \([0,1]\) stay in \([0,1]\), but sums don't. Three lights of intensity 0.8 add up to
      2.4. A display can't show more than full brightness, so before the color is written to the screen each channel is
      clamped to \([0,1]\). Shader languages call this <code>saturate</code>. Clamping happens per channel, so it can
      change the hue as well as the brightness: \((1.5, 0.75, 0.3)\) is an orange, but it clamps to
      \((1, 0.75, 0.3)\), which is noticeably more yellow. The overexposed center of a strong colored light often
      washes out toward white or yellow for exactly this reason.</p>
      <div class="note">Modern engines render into floating-point buffers, keep values above 1 during lighting
      (<em>high dynamic range</em>), and only compress them into \([0,1]\) at the end with a tone-mapping curve. The
      arithmetic in this chapter is the same either way; only the final clamp is replaced.</div>
      <div class="warn">The formulas assume <em>linear</em> color values, where doubling a number doubles the light.
      Most 8-bit textures and images are stored in the nonlinear sRGB encoding instead. Engines convert texels to linear
      before lighting and convert back when writing to the screen. Mixing the two produces lighting that looks too
      dark or too contrasty.</div>

      <h2>Storing colors</h2>
      <p>In memory a color is usually stored with 8 bits per channel. The integer \(0\dots 255\) represents the value
      \(n/255\), so converting a clamped float \(C\) to a byte is \(\operatorname{round}(255\,C)\). Lighting is always
      computed in floating point and converted at the very end, because rounding in the middle of a calculation throws
      away precision.</p>

      <p><a class="btn goto-sim" href="#/7.1/sim">Try it: mix colored lights and modulate a texture →</a></p>
    `,

    keyFormulas: [
      ["Scalar multiplication", String.raw`s\mathcal C = (sC_r,\, sC_g,\, sC_b)`],
      ["Color addition (combining lights)", String.raw`\mathcal C + \mathcal D = (C_r + D_r,\; C_g + D_g,\; C_b + D_b)`],
      ["Modulation (filtering)", String.raw`\mathcal C\mathcal D = (C_rD_r,\; C_gD_g,\; C_bD_b)`],
      ["Saturation", String.raw`\operatorname{sat}(x) = \min(\max(x, 0), 1) \text{ per channel}`],
      ["8-bit storage", String.raw`n = \operatorname{round}(255\,C), \qquad C = n/255`],
    ],

    exercises: [
      { q: String.raw`Modulate \(\mathcal C = (0.8, 0.4, 0.2)\) by \(\mathcal D = (0.5, 1, 0.5)\).`,
        a: String.raw`Channel by channel: \((0.8\cdot0.5,\; 0.4\cdot1,\; 0.2\cdot0.5) = (0.4, 0.4, 0.1)\).` },
      { q: String.raw`A surface has diffuse color \((0.2, 0.6, 0.9)\). What does it reflect under white light, and under pure red light \((1, 0, 0)\)?`,
        a: String.raw`Under white light it reflects its own color \((0.2, 0.6, 0.9)\). Under red light only the red channel survives: \((0.2, 0, 0)\), a dark red.` },
      { q: String.raw`Two lights \((0.7, 0.5, 0.2)\) and \((0.6, 0.6, 0.6)\) shine on a white surface. What color is displayed?`,
        a: String.raw`The sum is \((1.3, 1.1, 0.8)\). Clamping each channel gives \((1, 1, 0.8)\), a pale yellow. The ratio between red and blue changed from 1.6 to 1.25, so clamping shifted the hue.` },
      { q: "Why can a pure blue object (0, 0, 1) never look yellow, however you light it?",
        a: "Reflection multiplies the light by the surface color channel by channel. The red and green channels of the surface are 0, so the reflected red and green are 0 for every possible light color. Only blue can come back." },
      { q: String.raw`Convert the color \((0.5, 0.25, 1.0)\) to 8-bit values.`,
        a: String.raw`\(\operatorname{round}(127.5, 63.75, 255) = (128, 64, 255)\).` },
    ],

    sims: [
      {
        title: "Mixing colored lights",
        help: String.raw`<p>Three spot lights (red, green, blue) shine on a wall. Where they overlap their colors
          <b>add</b>: red + green = yellow, all three = white. The wall's color \(\mathcal D\) then <b>modulates</b> the
          sum. Drag a light's circle to move it, click anywhere else to move the probe. Push an intensity above 1 to see
          clamping, and set the wall to a colored paint to see channels disappear.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const out = sim.readout(readout);
          const RADIUS = 0.3; // in units of the image height
          const lights = [
            { c: [1, 0, 0], p: [0.4, 0.4] },
            { c: [0, 1, 0], p: [0.6, 0.4] },
            { c: [0, 0, 1], p: [0.5, 0.62] },
          ];
          let probe = [0.5, 0.48];
          let drag = -1;
          const inv = () => pc.invalidate();

          const gl = sim.group(controls, "Light intensities");
          const I = ["Red light 𝒞₁", "Green light 𝒞₂", "Blue light 𝒞₃"].map((label) =>
            sim.slider(gl, { label, min: 0, max: 1.6, step: 0.05, value: 0.9, onInput: inv }));
          const gd = sim.group(controls, "Wall color 𝒟");
          const D = ["D_r", "D_g", "D_b"].map((label) => sim.slider(gd, { label, min: 0, max: 1, step: 0.05, value: 1, onInput: inv }));
          const setD = (c) => { D.forEach((s, i) => (s.value = c[i])); inv(); };
          sim.buttons(gd, [
            { label: "White", onClick: () => setD([1, 1, 1]) },
            { label: "Yellow paint", onClick: () => setD([0.95, 0.85, 0.1]) },
            { label: "Cyan paint", onClick: () => setD([0.1, 0.8, 0.9]) },
          ]);
          const clip = sim.checkbox(controls, { label: "Stripe pixels where a channel was clamped", value: true, onChange: inv });

          // light arriving at image point (u, v) (fractions of width / height)
          const lightAt = (u, v, W, H) => {
            const c = [0.04, 0.04, 0.04]; // faint ambient so the wall is visible
            lights.forEach((L, i) => {
              const dx = ((u - L.p[0]) * W) / H, dy = v - L.p[1];
              const f = 1 - smoothstep(0.75 * RADIUS, RADIUS, Math.hypot(dx, dy));
              if (f > 0) for (let k = 0; k < 3; k++) c[k] += I[i].value * L.c[k] * f;
            });
            return c;
          };

          const pc = pixelCanvas(sim, stage, {
            width: 200, height: 140, canvasHeight: 400,
            render(pc) {
              const W = pc.width, H = pc.height;
              const Dc = D.map((s) => s.value);
              for (let y = 0; y < H; y++)
                for (let x = 0; x < W; x++) {
                  const C = lightAt((x + 0.5) / W, (y + 0.5) / H, W, H);
                  let r = Dc[0] * C[0], g = Dc[1] * C[1], b = Dc[2] * C[2];
                  if (clip.value && (r > 1 || g > 1 || b > 1) && (x + y) % 6 < 2) { r *= 0.55; g *= 0.55; b *= 0.55; }
                  pc.set(x, y, r, g, b);
                }
            },
            overlay(c, pc) {
              lights.forEach((L, i) => {
                const [x, y] = pc.toCanvas(L.p[0] * pc.width, L.p[1] * pc.height);
                c.label(x, y + 4, "𝒞" + "₁₂₃"[i], { color: "#fff", weight: 800, size: 14, align: "center" });
              });
              drawProbe(c, pc, probe[0] * pc.width, probe[1] * pc.height);
              update();
            },
          });

          pointer(sim, pc, {
            onDrag(px, py, first) {
              const u = px / pc.width, v = py / pc.height;
              if (first) {
                drag = -1;
                lights.forEach((L, i) => {
                  if (Math.hypot(((u - L.p[0]) * pc.width) / pc.height, v - L.p[1]) < RADIUS * 0.5) drag = i;
                });
              }
              if (drag >= 0) {
                lights[drag].p = [clamp(u, 0, 1), clamp(v, 0, 1)];
                pc.invalidate();
              } else {
                probe = [clamp(u, 0, 1), clamp(v, 0, 1)];
                pc.redraw();
              }
            },
          });

          function update() {
            const C = lightAt(probe[0], probe[1], pc.width, pc.height);
            const Dc = D.map((s) => s.value);
            const K = V.mul(Dc, C);
            const shown = K.map(sat);
            const clipped = K.some((x) => x > 1);
            out.set(sim.rows([
              ["light sum 𝒞 = Σ 𝒞ᵢ", colSwatch(C) + fmtCol(C)],
              ["wall color 𝒟", colSwatch(Dc) + fmtCol(Dc)],
              ["reflected 𝒟𝒞", fmtCol(K)],
              ["displayed sat(𝒟𝒞)", colSwatch(shown) + fmtCol(shown)],
            ]) + `<hr>${clipped ? "<b class='bad'>Clamped:</b> at least one channel was above 1, so the displayed color is not exactly 𝒟𝒞." :
              "No channel exceeds 1, so the displayed color equals 𝒟𝒞."}`);
          }
        },
      },
      {
        title: "Texture modulated by vertex colors",
        help: String.raw`<p>A textured triangle with a color \(\mathcal V_i\) at each vertex. The vertex colors are
          interpolated across the triangle, then combined with the texel \(\mathcal T\). <b>Modulate</b> multiplies
          (\(\mathcal T\mathcal V\)), the usual way to tint a texture. <b>Add</b> sums and clamps. Click to move the
          probe and compare the numbers.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const out = sim.readout(readout);
          const inv = () => pc.invalidate();
          const presets = {
            rgb: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
            sunset: [[1, 0.6, 0.25], [1, 0.3, 0.45], [0.35, 0.35, 0.9]],
            white: [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
            team: [[0.35, 0.55, 1], [0.35, 0.55, 1], [0.35, 0.55, 1]],
            shadow: [[1, 1, 1], [0.25, 0.25, 0.3], [0.8, 0.8, 0.8]],
          };
          const mode = sim.segmented(controls, {
            label: "Combine",
            options: [["tex", "Texture 𝒯"], ["vert", "Vertex 𝒱"], ["mul", "Modulate 𝒯𝒱"], ["add", "Add 𝒯 + 𝒱"]],
            value: "mul", onChange: inv,
          });
          const preset = sim.select(controls, {
            label: "Vertex colors",
            options: [["rgb", "Red / green / blue"], ["sunset", "Sunset tint"], ["white", "White (no change)"], ["team", "Team blue"], ["shadow", "Baked shadow"]],
            value: "rgb", onChange: inv,
          });
          const s = sim.slider(controls, { label: "Brightness s (scalar multiply)", min: 0, max: 2, step: 0.05, value: 1, onInput: inv });

          // stone-tile texture
          const tex = makeTex(32, 32, (i, j) => {
            const gx = i % 16, gy = j % 16;
            const grout = gx < 1 || gy < 1;
            const n = 0.8 + 0.2 * valueNoise(i / 4, j / 4, 8);
            const tile = ((i >> 4) + (j >> 4)) & 1 ? [0.95, 0.9, 0.8] : [0.85, 0.85, 0.88];
            return grout ? [0.35, 0.33, 0.3] : tile.map((x) => x * n);
          });
          const P = [[0.1, 0.9], [0.9, 0.9], [0.5, 0.08]]; // vertex positions (fractions of the image, y down)
          const UV = [[0, 0], [3, 0], [1.5, 2.6]]; // texture coordinates (repeating)
          let probe = [0.5, 0.62];

          const bary = (u, v, W, H) => {
            const p = P.map(([a, b]) => [a * W, b * H]);
            const x = u * W, y = v * H;
            const e = (a, b) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
            const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]);
            return [e(p[1], p[2]) / area, e(p[2], p[0]) / area, e(p[0], p[1]) / area];
          };
          const evalAt = (b) => {
            const Vc = presets[preset.value];
            const vc = [0, 1, 2].map((k) => b[0] * Vc[0][k] + b[1] * Vc[1][k] + b[2] * Vc[2][k]);
            const st = [0, 1].map((k) => b[0] * UV[0][k] + b[1] * UV[1][k] + b[2] * UV[2][k]);
            const T = sampleNearest(tex, st[0], st[1], [0, 0, 0]);
            let K;
            if (mode.value === "tex") K = T.slice();
            else if (mode.value === "vert") K = vc.slice();
            else if (mode.value === "mul") K = V.mul(T, vc);
            else K = V.add(T, vc);
            return { vc, T, st, raw: V.scale(K, s.value) };
          };

          const pc = pixelCanvas(sim, stage, {
            width: 200, height: 150, canvasHeight: 400,
            render(pc) {
              const W = pc.width, H = pc.height;
              const bg = rgb(sim.color("bg"));
              for (let y = 0; y < H; y++)
                for (let x = 0; x < W; x++) {
                  const b = bary((x + 0.5) / W, (y + 0.5) / H, W, H);
                  if (b[0] < 0 || b[1] < 0 || b[2] < 0) { pc.set(x, y, bg[0], bg[1], bg[2]); continue; }
                  const K = evalAt(b).raw;
                  pc.set(x, y, K[0], K[1], K[2]);
                }
            },
            overlay(c, pc) {
              const Vc = presets[preset.value];
              P.forEach(([u, v], i) => {
                const [x, y] = pc.toCanvas(u * pc.width, v * pc.height);
                c.ctx.fillStyle = cssCol(Vc[i]);
                c.ctx.strokeStyle = c.sim.color("fg");
                c.ctx.lineWidth = 1.5;
                c.ctx.beginPath();
                c.ctx.arc(x, y, 8, 0, Math.PI * 2);
                c.ctx.fill();
                c.ctx.stroke();
                c.label(x + (i === 1 ? 12 : i === 0 ? -12 : 14), y + (i === 2 ? 4 : 20), "𝒱" + "₀₁₂"[i], { color: "fg", weight: 700, size: 13, align: i === 0 ? "right" : "left" });
              });
              drawProbe(c, pc, probe[0] * pc.width, probe[1] * pc.height);
              update();
            },
          });
          pointer(sim, pc, {
            onDrag(px, py) {
              probe = [clamp(px / pc.width, 0, 1), clamp(py / pc.height, 0, 1)];
              pc.redraw();
            },
          });

          function update() {
            const b = bary(probe[0], probe[1], pc.width, pc.height);
            if (b.some((x) => x < 0)) {
              out.set("The probe is outside the triangle. Click inside it.");
              return;
            }
            const r = evalAt(b);
            out.set(sim.rows([
              ["barycentric (w₀, w₁, w₂)", fmtCol(b)],
              ["𝒱 = Σ wᵢ𝒱ᵢ", colSwatch(r.vc) + fmtCol(r.vc)],
              ["texel 𝒯 at (s, t) = " + fmtVec(r.st, 1), colSwatch(r.T) + fmtCol(r.T)],
              ["s × combined", fmtCol(r.raw)],
              ["displayed", colSwatch(r.raw.map(sat)) + fmtCol(r.raw.map(sat))],
            ]) + `<hr>${mode.value === "mul" ? "Modulation keeps the texture's detail and tints it. A white vertex color leaves the texel unchanged." :
              mode.value === "add" ? "Addition brightens everything and quickly saturates toward white, washing out the texture." :
              "Pick <b>Modulate</b> to see the two combined."}`);
          }
        },
      },
    ],

    cpp: [
      {
        title: "A color type",
        formula: String.raw`s\mathcal C = (sC_r, sC_g, sC_b) \qquad \mathcal C + \mathcal D = (C_r + D_r, \dots) \qquad \mathcal C\mathcal D = (C_rD_r, \dots)`,
        note: "<p>Same shape as <code>Vector3D</code>, but a separate type, so the compiler stops you from adding a color to a position. The color-times-color operator is modulation.</p>",
        code: String.raw`
          struct ColorRGB
          {
              float red, green, blue;

              ColorRGB() : red(0.0f), green(0.0f), blue(0.0f) {}
              ColorRGB(float r, float g, float b) : red(r), green(g), blue(b) {}

              ColorRGB& operator+=(const ColorRGB& c) { red += c.red; green += c.green; blue += c.blue; return *this; }
          };

          inline ColorRGB operator*(const ColorRGB& c, float s) { return {c.red * s, c.green * s, c.blue * s}; }   // sC
          inline ColorRGB operator*(float s, const ColorRGB& c) { return c * s; }

          inline ColorRGB operator+(const ColorRGB& c, const ColorRGB& d)                                          // C + D
          {
              return {c.red + d.red, c.green + d.green, c.blue + d.blue};
          }

          inline ColorRGB operator*(const ColorRGB& c, const ColorRGB& d)                                          // CD (modulation)
          {
              return {c.red * d.red, c.green * d.green, c.blue * d.blue};
          }
        `,
      },
      {
        title: "Saturate and pack to 8 bits",
        formula: String.raw`\operatorname{sat}(C) = \min(\max(C, 0), 1) \qquad n = \operatorname{round}(255\,\operatorname{sat}(C))`,
        code: String.raw`
          #include <cstdint>

          inline ColorRGB Saturate(const ColorRGB& c)
          {
              return {Clamp(c.red, 0.0f, 1.0f), Clamp(c.green, 0.0f, 1.0f), Clamp(c.blue, 0.0f, 1.0f)};
          }

          // Packs a color as 0xAARRGGBB with 8 bits per channel.
          uint32_t PackColor(const ColorRGB& color, float alpha = 1.0f)
          {
              ColorRGB c = Saturate(color);
              auto toByte = [](float x) { return static_cast<uint32_t>(x * 255.0f + 0.5f); };   // round(255 x)
              return (toByte(Clamp(alpha, 0.0f, 1.0f)) << 24) | (toByte(c.red) << 16)
                   | (toByte(c.green) << 8) | toByte(c.blue);
          }
        `,
      },
      {
        title: "Texture modulated by an interpolated vertex color",
        formula: String.raw`\mathcal K = s\,\mathcal T\,(w_0\mathcal V_0 + w_1\mathcal V_1 + w_2\mathcal V_2)`,
        note: "<p>The weights <i>w</i> are the pixel's barycentric coordinates in the triangle (they sum to 1). This is the per-pixel work a fixed-function GPU did for a textured, vertex-colored triangle.</p>",
        code: String.raw`
          ColorRGB ShadeTexturedPixel(const ColorRGB vertexColor[3], const float w[3],
                                      const ColorRGB& texel, float brightness)
          {
              ColorRGB v = vertexColor[0] * w[0] + vertexColor[1] * w[1] + vertexColor[2] * w[2];  // interpolated V
              return Saturate(texel * v * brightness);                                           // s T V, clamped
          }
        `,
      },
      {
        title: "Adding lights, then reflecting",
        formula: String.raw`\mathcal K = \operatorname{sat}\!\Big(\mathcal D \sum_i \mathcal C_i\Big) = \operatorname{sat}\!\Big(\sum_i \mathcal D\mathcal C_i\Big)`,
        note: "<p>Because modulation distributes over addition, you can multiply by the surface color once, after the loop. Clamp only at the very end; clamping each light separately would give a different (wrong) answer.</p>",
        code: String.raw`
          ColorRGB ReflectLights(const ColorRGB& surface, const ColorRGB* lightColor, int lightCount)
          {
              ColorRGB total;                                   // starts at (0, 0, 0)
              for (int i = 0; i < lightCount; i++)
                  total += lightColor[i];                       // lights add
              return Saturate(surface * total);                 // the surface filters (modulates) the sum
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 7.2 Light Sources
  // ===========================================================================

  // A small ray-traced room used by the light-source demo: a tiled floor and two spheres.
  const SCENE_SPHERES = [
    { c: [-1.3, 0.9, -0.6], r: 0.9, col: [0.85, 0.36, 0.3] },
    { c: [1.5, 0.6, 0.7], r: 0.6, col: [0.3, 0.55, 0.92] },
  ];
  function traceScene(o, d) {
    let best = Infinity, hit = null;
    if (d[1] < -1e-6) {
      const t = -o[1] / d[1];
      const x = o[0] + t * d[0], z = o[2] + t * d[2];
      if (Math.abs(x) < 7 && z > -7 && z < 6) {
        best = t;
        const tile = (Math.floor(x) + Math.floor(z)) & 1;
        hit = { t, P: [x, 0, z], N: [0, 1, 0], col: tile ? [0.8, 0.8, 0.78] : [0.66, 0.66, 0.64], name: "floor" };
      }
    }
    SCENE_SPHERES.forEach((s, i) => {
      const t = hitSphere(o, d, s.c, s.r);
      if (t < best) {
        best = t;
        const P = V.add(o, V.scale(d, t));
        hit = { t, P, N: V.scale(V.sub(P, s.c), 1 / s.r), col: s.col, name: i ? "blue sphere" : "red sphere" };
      }
    });
    return hit;
  }
  function sceneShadowed(P, L, maxT) {
    return SCENE_SPHERES.some((s) => hitSphere(P, L, s.c, s.r) < maxT);
  }

  L3D.topic({
    id: "7.2",
    summary: "Ambient, directional, point and spot lights: where the light comes from and how its intensity falls off with distance and angle.",

    lesson: String.raw`
      <p>The color we compute at a point on a surface is the <strong>sum</strong> of the contributions from every light
      that reaches it. Graphics systems traditionally support four kinds of light source: ambient, directional, point
      and spot. For each kind we need two things at a surface point \(\mathbf Q\): the <em>intensity</em> (a color
      \(\mathcal C\)) of the light arriving there, and the unit <em>direction to the light</em> \(\mathbf L\), which
      the reflection formulas in Sections 7.3 and 7.4 use.</p>

      <h2 data-sub="7.2.1">Ambient Light</h2>
      <p>In a real room, light bounces off walls, floor and furniture many times, so even surfaces that face away from
      every lamp receive some light. Simulating all those bounces is expensive. <strong>Ambient light</strong> replaces
      them with a single low-intensity color \(\mathcal A\) that arrives equally from every direction. Because it has no
      direction, it lights every part of an object by the same amount. It keeps shadowed areas from going pitch black,
      but on its own it makes objects look flat, since nothing about it depends on the shape of the surface.</p>
      <p>\(\mathcal A\) is often one constant for a whole scene, but it can also vary with position. One way is to store
      ambient samples on a regular grid in a 3D texture that covers a region of the world and look up the value at each
      surface point.</p>
      <div class="game">Modern engines refine this idea with <em>light probes</em> or irradiance volumes: precomputed
      samples of the indirect light at many points, sometimes with a different value for each direction. The
      constant \(\mathcal A\) is the simplest version of the same thing.</div>

      <h2 data-sub="7.2.2">Directional Light Sources</h2>
      <p>A <strong>directional</strong> (or infinite) light is so far away that all its rays arrive parallel. The sun is
      the standard example. A directional light has a direction but no position. Its \(\mathbf L\) is the same unit
      vector at every point in the scene (the negation of the direction in which the light travels), and its intensity
      doesn't change with distance, so it has unlimited range. That makes it the cheapest light to evaluate. Shadows
      cast by a directional light are parallel to each other.</p>

      <h2 data-sub="7.2.3">Point Light Sources</h2>
      <p>A <strong>point light</strong> sits at a position \(\mathbf P\) and radiates equally in all directions, like a
      bare bulb or a torch. Physically, the intensity falls off with the inverse square of the distance. OpenGL and
      Direct3D generalized this into the reciprocal of a quadratic polynomial (Equation 7.3):</p>
      <div class="formula">
        \[ \mathcal C = \frac{1}{k_c + k_l\,d + k_q\,d^2}\,\mathcal C_0, \qquad d = \lVert \mathbf P - \mathbf Q \rVert \]
      </div>
      <p>Here \(\mathcal C_0\) is the light's color and \(k_c, k_l, k_q\) are the <strong>constant</strong>,
      <strong>linear</strong> and <strong>quadratic attenuation constants</strong>. Pure inverse square is
      \(k_c = k_l = 0,\ k_q = 1\), but that blows up as \(d\to 0\). A constant term \(k_c = 1\) caps the intensity at
      \(\mathcal C_0\) right next to the light, and a linear term softens the falloff. The direction to the light,
      \[ \mathbf L = \frac{\mathbf P - \mathbf Q}{\lVert\mathbf P - \mathbf Q\rVert}, \]
      changes from point to point, which is why the shadows of a point light spread out from it.</p>
      <p>The quadratic formula never actually reaches zero, so in principle every point light affects every object in
      the world. With programmable shaders any falloff function can be used, and engines usually pick one that becomes
      exactly zero beyond a chosen radius. Objects outside that sphere of influence don't need to be drawn for that
      light at all, which is a large saving when there are many lights.</p>

      <h2 data-sub="7.2.4">Spot Light Sources</h2>
      <p>A <strong>spot light</strong> is a point light with a preferred direction \(\mathbf R\) (a unit vector, the
      spot axis). It is attenuated with distance exactly like a point light, and then by an extra <em>spot light
      effect</em> (Equation 7.4):</p>
      <div class="formula">
        \[ \mathcal C = \frac{\max\{-\mathbf R\cdot\mathbf L,\, 0\}^{\,p}}{k_c + k_l\,d + k_q\,d^2}\,\mathcal C_0 \]
      </div>
      <p>\(\mathbf L\) points from the surface toward the light, so \(-\mathbf L\) points from the light toward the
      surface, and \(-\mathbf R\cdot\mathbf L\) is the cosine of the angle between the spot axis and the ray to
      \(\mathbf Q\). The spot is brightest on its axis (\(\mathbf R = -\mathbf L\)) and fades as the angle grows. Past
      \(90^\circ\) the cosine is negative, the <code>max</code> clamps it to zero, and no light arrives. The exponent
      \(p\) sets how focused the beam is. The book's Figure 7.1 shows \(p = 2, 10, 50, 100\) going from a broad wash to a
      tight spot. A handy way to read \(p\) is the angle at which the intensity has dropped to half,
      \(\theta_{1/2} = \cos^{-1}(0.5^{1/p})\): about \(45^\circ\) for \(p = 2\), \(21^\circ\) for \(p = 10\) and
      \(6.8^\circ\) for \(p = 100\).</p>
      <div class="note">Many engines describe a spot by an inner and an outer cone angle instead of an exponent: full
      intensity inside the inner cone, zero outside the outer cone, and a smooth blend in between. It is the same idea
      with a hard edge that artists find easier to control.</div>

      <h2>Summary of the four types</h2>
      <table>
        <tr><th>Light</th><th>Direction to light \(\mathbf L\)</th><th>Intensity at \(\mathbf Q\)</th><th>Typical use</th></tr>
        <tr><td>Ambient</td><td>none (all directions)</td><td>\(\mathcal A\)</td><td>bounce light, sky fill</td></tr>
        <tr><td>Directional</td><td>constant</td><td>\(\mathcal C_0\)</td><td>sun, moon</td></tr>
        <tr><td>Point</td><td>\((\mathbf P-\mathbf Q)/\lVert\mathbf P-\mathbf Q\rVert\)</td><td>\(\mathcal C_0/(k_c+k_ld+k_qd^2)\)</td><td>bulbs, torches, explosions</td></tr>
        <tr><td>Spot</td><td>same as point</td><td>point light \(\times\max\{-\mathbf R\cdot\mathbf L,0\}^p\)</td><td>flashlights, headlights, stage lights</td></tr>
      </table>
      <div class="game">A typical outdoor level has one directional light for the sun, an ambient or probe term for the
      sky, and many small point and spot lights (lamps, muzzle flashes, car headlights), each limited to a radius so
      that only nearby objects pay for it.</div>

      <p><a class="btn goto-sim" href="#/7.2/sim">Try it: switch between light types and attenuation settings →</a></p>
    `,

    keyFormulas: [
      ["Point light attenuation", String.raw`\mathcal C = \dfrac{\mathcal C_0}{k_c + k_l d + k_q d^2},\quad d = \lVert\mathbf P - \mathbf Q\rVert`],
      ["Spot light", String.raw`\mathcal C = \dfrac{\max\{-\mathbf R\cdot\mathbf L, 0\}^p}{k_c + k_l d + k_q d^2}\,\mathcal C_0`],
      ["Direction to a point or spot light", String.raw`\mathbf L = \dfrac{\mathbf P - \mathbf Q}{\lVert\mathbf P - \mathbf Q\rVert}`],
      ["Directional light", String.raw`\mathcal C = \mathcal C_0,\quad \mathbf L = \text{constant}`],
      ["Spot half-intensity angle", String.raw`\theta_{1/2} = \cos^{-1}\!\big(0.5^{1/p}\big)`],
    ],

    exercises: [
      { q: String.raw`A white point light \(\mathcal C_0 = (1,1,1)\) has \(k_c = 1, k_l = 0.5, k_q = 0.25\). What intensity reaches a point 2 units away?`,
        a: String.raw`The denominator is \(1 + 0.5\cdot2 + 0.25\cdot4 = 3\), so \(\mathcal C = (1/3, 1/3, 1/3)\).` },
      { q: String.raw`A spot light has exponent \(p = 10\). Ignoring distance attenuation, how bright is a point \(30^\circ\) off the spot axis?`,
        a: String.raw`\((\cos30^\circ)^{10} = 0.866^{10} \approx 0.237\), about a quarter of the on-axis intensity.` },
      { q: String.raw`A spot light at \(\mathbf P = (0, 4, 0)\) points straight down, \(\mathbf R = (0,-1,0)\), with \(p = 2\), \(k_c = 1, k_l = 0, k_q = 0.04\). Find the intensity factor at \(\mathbf Q = (3, 0, 0)\).`,
        a: String.raw`\(\mathbf P - \mathbf Q = (-3, 4, 0)\), \(d = 5\), \(\mathbf L = (-0.6, 0.8, 0)\). \(-\mathbf R\cdot\mathbf L = 0.8\), so the spot factor is \(0.8^2 = 0.64\). The attenuation is \(1/(1 + 0.04\cdot25) = 0.5\). Total: \(0.32\,\mathcal C_0\).` },
      { q: String.raw`Which exponent \(p\) makes a spot light's intensity drop to half at \(15^\circ\) off axis?`,
        a: String.raw`Solve \(\cos^p 15^\circ = 0.5\): \(p = \ln 0.5 / \ln\cos15^\circ = -0.693/-0.0347 \approx 20\).` },
      { q: "Why does a directional light have no attenuation constants?",
        a: "It models a source infinitely far away. Moving a few meters across the scene doesn't change the distance to the sun in any meaningful way, so the intensity is the same everywhere, and there is no position from which to measure d." },
    ],

    sims: [
      {
        title: "Four kinds of light",
        help: String.raw`<p>A small ray-traced room lit by one light. Switch the <b>light type</b> and use the sliders for
          its position, direction and attenuation. Hover over the picture to probe a point: the readout shows the
          distance \(d\), the attenuation, the spot factor and the final color. (The surfaces use the diffuse
          \(\mathbf N\cdot\mathbf L\) term from Section 7.3 so you can see their shape, plus the ambient color.) Compare
          the parallel shadows of the directional light with the spreading shadows of the point light.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const out = sim.readout(readout);
          const inv = () => pc.invalidate();
          const type = sim.segmented(controls, {
            label: "Light type",
            options: [["amb", "Ambient"], ["dir", "Directional"], ["point", "Point"], ["spot", "Spot"]],
            value: "point",
            onChange: () => { showGroups(); inv(); },
          });
          const amb = sim.slider(controls, { label: "Ambient 𝒜 (gray level)", min: 0, max: 1, step: 0.01, value: 0.12, onInput: inv });
          const I0 = sim.slider(controls, { label: "Light intensity 𝒞₀", min: 0, max: 8, step: 0.1, value: 3, onInput: inv });
          const gPos = sim.group(controls, "Light position P");
          const px = sim.slider(gPos, { label: "x", min: -4, max: 4, step: 0.1, value: 0.2, onInput: inv });
          const py = sim.slider(gPos, { label: "height y", min: 0.3, max: 5, step: 0.1, value: 2.6, onInput: inv });
          const pz = sim.slider(gPos, { label: "z", min: -4, max: 4, step: 0.1, value: 0.8, onInput: inv });
          const gAtt = sim.group(controls, "Attenuation");
          const kc = sim.slider(gAtt, { label: "k_c", min: 0, max: 2, step: 0.05, value: 1, onInput: inv });
          const kl = sim.slider(gAtt, { label: "k_l", min: 0, max: 1, step: 0.01, value: 0, onInput: inv });
          const kq = sim.slider(gAtt, { label: "k_q", min: 0, max: 1, step: 0.01, value: 0.15, onInput: inv });
          const gSpot = sim.group(controls, "Spot axis R (aims at a floor point)");
          const ax = sim.slider(gSpot, { label: "aim x", min: -4, max: 4, step: 0.1, value: -0.6, onInput: inv });
          const az = sim.slider(gSpot, { label: "aim z", min: -4, max: 4, step: 0.1, value: 1.2, onInput: inv });
          const pExp = sim.slider(gSpot, { label: "exponent p", min: 1, max: 100, step: 1, value: 8, onInput: inv });
          const gDir = sim.group(controls, "Direction to the light");
          const azim = sim.slider(gDir, { label: "azimuth", min: -180, max: 180, step: 1, value: 35, unit: "°", onInput: inv });
          const elev = sim.slider(gDir, { label: "elevation", min: 5, max: 90, step: 1, value: 45, unit: "°", onInput: inv });
          const shadows = sim.checkbox(controls, { label: "Cast shadows", value: true, onChange: inv });
          function showGroups() {
            const t = type.value;
            gPos.style.display = gAtt.style.display = t === "point" || t === "spot" ? "" : "none";
            gSpot.style.display = t === "spot" ? "" : "none";
            gDir.style.display = t === "dir" ? "" : "none";
            I0.el.style.display = t === "amb" ? "none" : "";
          }
          showGroups();

          const cam = makeCamera([0, 4.6, 8.6], [0, 0.4, -0.4], 48);
          let probe = null;

          // Intensity and direction of the light at Q (Equations 7.3 - 7.5).
          function lightAt(Q) {
            const t = type.value;
            if (t === "amb") return null;
            if (t === "dir") {
              const a = rad(azim.value), e = rad(elev.value);
              return { L: [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)], C: I0.value, d: Infinity, att: 1, spot: 1 };
            }
            const P = [px.value, py.value, pz.value];
            const v = V.sub(P, Q);
            const d = V.len(v);
            const L = V.scale(v, 1 / d);
            const att = 1 / Math.max(1e-4, kc.value + kl.value * d + kq.value * d * d);
            let spot = 1;
            if (t === "spot") {
              const R = V.norm(V.sub([ax.value, 0, az.value], P));
              spot = Math.pow(Math.max(-V.dot(R, L), 0), pExp.value);
            }
            return { L, C: I0.value * att * spot, d, att, spot };
          }
          function shade(hit) {
            const A = amb.value;
            const lt = lightAt(hit.P);
            let lit = 0, nl = 0, shadow = false;
            if (lt) {
              nl = V.dot(hit.N, lt.L);
              if (nl > 0 && lt.C > 0) {
                if (shadows.value) shadow = sceneShadowed(V.add(hit.P, V.scale(hit.N, 1e-3)), lt.L, lt.d);
                if (!shadow) lit = lt.C * nl;
              }
            }
            return { K: hit.col.map((x) => x * (A + lit)), lt, nl, shadow };
          }

          const pc = pixelCanvas(sim, stage, {
            height: 140, canvasHeight: 400, fill: true, maxWidth: 320,
            render(pc) {
              const W = pc.width, H = pc.height;
              const bg = rgb(sim.color("bg"));
              for (let y = 0; y < H; y++)
                for (let x = 0; x < W; x++) {
                  const hit = traceScene(cam.eye, cam.ray(x, y, W, H));
                  if (!hit) { pc.set(x, y, bg[0], bg[1], bg[2]); continue; }
                  const K = shade(hit).K;
                  pc.set(x, y, K[0], K[1], K[2]);
                }
            },
            overlay(c, pc) {
              const W = pc.width, H = pc.height;
              const toC = (P) => { const s = cam.project(P, W, H); return s && pc.toCanvas(s[0], s[1]); };
              const ctx = c.ctx;
              const t = type.value;
              if (t === "point" || t === "spot") {
                const P = [px.value, py.value, pz.value];
                const s = toC(P), f = toC([P[0], 0, P[2]]);
                if (s && f) {
                  ctx.setLineDash([3, 4]);
                  ctx.strokeStyle = c.sim.color("muted");
                  ctx.lineWidth = 1;
                  ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(f[0], f[1]); ctx.stroke();
                  ctx.setLineDash([]);
                }
                if (t === "spot") {
                  const T = toC([ax.value, 0, az.value]);
                  if (s && T) {
                    ctx.strokeStyle = c.sim.color("g");
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(T[0], T[1]); ctx.stroke();
                    ctx.beginPath(); ctx.arc(T[0], T[1], 4, 0, Math.PI * 2); ctx.fillStyle = c.sim.color("g"); ctx.fill();
                    c.label(s[0] + (T[0] - s[0]) * 0.5 + 8, s[1] + (T[1] - s[1]) * 0.5, "R", { color: "g", weight: 700 });
                  }
                }
                if (s) {
                  ctx.fillStyle = "#ffd75e";
                  ctx.strokeStyle = c.sim.color("fg");
                  ctx.lineWidth = 1.5;
                  ctx.beginPath(); ctx.arc(s[0], s[1], 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                  c.label(s[0] + 10, s[1] - 8, "P", { color: "fg", weight: 700 });
                }
              } else if (t === "dir") {
                const a = rad(azim.value), e = rad(elev.value);
                const L = [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
                for (const off of [[-2.5, 0, -2], [0, 0, -2], [2.5, 0, -2]]) {
                  const A = toC(V.add(off, V.scale(L, 2.6))), B = toC(V.add(off, V.scale(L, 0.4)));
                  if (A && B) {
                    const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1;
                    ctx.strokeStyle = ctx.fillStyle = c.sim.color("g");
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(B[0], B[1]);
                    ctx.lineTo(B[0] - (dx / len) * 9 - (dy / len) * 4, B[1] - (dy / len) * 9 + (dx / len) * 4);
                    ctx.lineTo(B[0] - (dx / len) * 9 + (dy / len) * 4, B[1] - (dy / len) * 9 - (dx / len) * 4);
                    ctx.fill();
                  }
                }
              }
              if (probe) drawProbe(c, pc, probe[0], probe[1]);
              c.label(c.w - 10, c.h - 10, "hover to probe", { color: "muted", size: 11, align: "right" });
              update();
            },
          });
          pointer(sim, pc, {
            onHover(x, y) { probe = [x, y]; pc.redraw(); },
            onDrag(x, y) { probe = [x, y]; pc.redraw(); },
          });

          function update() {
            const W = pc.width, H = pc.height;
            const p = probe || [W * 0.55, H * 0.82];
            const hit = traceScene(cam.eye, cam.ray(Math.floor(p[0]), Math.floor(p[1]), W, H));
            if (!hit) { out.set("The probe is not on a surface."); return; }
            const s = shade(hit);
            const rows = [["surface", hit.name], ["Q", fmtVec(hit.P)], ["ambient 𝒜", fmt(amb.value)]];
            const lt = s.lt;
            if (lt) {
              if (type.value !== "dir") {
                rows.push(["distance d", fmt(lt.d)], ["1 / (k_c + k_l d + k_q d²)", fmt(lt.att, 3)]);
                if (type.value === "spot") rows.push(["max(−R·L, 0)^p", fmt(lt.spot, 3)]);
              }
              rows.push(["intensity 𝒞 at Q", fmt(lt.C, 3)], ["L", fmtVec(lt.L)], ["N · L", fmt(s.nl, 3)]);
              if (s.shadow) rows.push(["shadowed", "<span class='bad'>yes</span>"]);
            }
            rows.push(["color 𝒦", colSwatch(s.K) + fmtCol(s.K)]);
            out.set(sim.rows(rows) + `<hr>${{
              amb: "Ambient light only: every surface gets 𝒜 times its color, so the spheres look like flat disks.",
              dir: "Directional: L and the intensity are the same everywhere. Shadows are parallel.",
              point: "Point light: intensity falls off with distance and L changes from point to point, so shadows spread out.",
              spot: "Spot light: point-light falloff times max(−R·L, 0)^p. Raise p to tighten the beam.",
            }[type.value]}`);
          }
        },
      },
      {
        title: "Attenuation and spot falloff curves",
        help: String.raw`<p>Left: the distance attenuation \(1/(k_c + k_ld + k_qd^2)\), with pure inverse square
          \(1/d^2\) dashed for comparison. Right: the spot factor \(\max\{\cos\theta, 0\}^p\) against the angle from the
          spot axis; the faint curves are \(p = 2, 10, 50, 100\) from the book's Figure 7.1. Drag the dots along the
          curves to read values.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const out = sim.readout(readout);
          const [cellA, cellB] = sim.split(stage, 2);
          const va = sim.view2d(cellA, { xRange: [-0.4, 10], yRange: [-0.08, 1.25], height: 340 });
          const vb = sim.view2d(cellB, { xRange: [-100, 100], yRange: [-0.08, 1.15], height: 340 });
          const redraw = () => { va.redraw(); vb.redraw(); };
          const g = sim.group(controls, "Distance attenuation");
          const kc = sim.slider(g, { label: "k_c (constant)", min: 0, max: 2, step: 0.05, value: 1, onInput: redraw });
          const kl = sim.slider(g, { label: "k_l (linear)", min: 0, max: 1, step: 0.01, value: 0.1, onInput: redraw });
          const kq = sim.slider(g, { label: "k_q (quadratic)", min: 0, max: 1, step: 0.01, value: 0.1, onInput: redraw });
          const gs = sim.group(controls, "Spot light");
          const p = sim.slider(gs, { label: "exponent p", min: 1, max: 100, step: 1, value: 10, onInput: redraw });
          const att = (d) => 1 / Math.max(1e-4, kc.value + kl.value * d + kq.value * d * d);
          const spot = (th) => Math.pow(Math.max(Math.cos(rad(th)), 0), p.value);
          const hd = va.handle([3, att(3)], { color: "a", constrain: ([x]) => { x = clamp(x, 0, 10); return [x, att(x)]; } });
          const ht = vb.handle([20, spot(20)], { color: "b", constrain: ([x]) => { x = clamp(x, -90, 90); return [x, spot(x)]; } });

          va.onDraw((v) => {
            v.grid({ stepX: 1, stepY: 0.2 });
            v.axes({ ticks: true, labels: ["d", "attenuation"] });
            v.plot((d) => (d > 0.05 ? 1 / (d * d) : NaN), { color: "muted", dash: [5, 5], width: 1.5, from: 0.3, to: 10 });
            v.plot(att, { color: "a", width: 3, from: 0, to: 10 });
            hd.pos[1] = att(hd.pos[0]);
            v.line([hd.pos[0], 0], hd.pos, { color: "a", dash: [3, 4], width: 1 });
            v.text([6.2, 1.12], "1/d² (dashed)", { color: "muted", size: 12 });
            update();
          });
          vb.onDraw((v) => {
            v.grid({ stepX: 30, stepY: 0.2 });
            v.axes({ ticks: true, labels: ["θ (degrees off axis)", "spot factor"] });
            for (const q of [2, 10, 50, 100]) v.plot((th) => Math.pow(Math.max(Math.cos(rad(th)), 0), q), { color: "b", alpha: 0.22, width: 1.2, from: -90, to: 90 });
            v.plot(spot, { color: "b", width: 3, from: -90, to: 90 });
            const half = deg(Math.acos(Math.pow(0.5, 1 / p.value)));
            for (const s of [-1, 1]) v.line([s * half, 0], [s * half, 0.5], { color: "d", dash: [4, 4], width: 1.5 });
            v.line([-half, 0.5], [half, 0.5], { color: "d", dash: [4, 4], width: 1.5 });
            v.text([half, 0.55], "θ½", { color: "d", size: 12, offset: [4, 0] });
            ht.pos[1] = spot(ht.pos[0]);
            update();
          });

          function update() {
            const d = hd.pos[0], th = ht.pos[0];
            const half = deg(Math.acos(Math.pow(0.5, 1 / p.value)));
            out.set(sim.rows([
              [sim.swatch("a") + "distance d", fmt(d)],
              ["k_c + k_l d + k_q d²", fmt(kc.value + kl.value * d + kq.value * d * d, 3)],
              ["attenuation", fmt(att(d), 3)],
              ["1 / d²", d > 0 ? fmt(1 / (d * d), 3) : "∞"],
              [sim.swatch("b") + "angle θ", fmt(th, 1) + "°"],
              ["cos θ", fmt(Math.cos(rad(th)), 3)],
              ["(cos θ)^p", fmt(spot(th), 3)],
              [sim.swatch("d") + "half-intensity θ½", fmt(half, 1) + "°"],
            ]) + `<hr>${kc.value === 0 && kl.value === 0 ? "With k_c = k_l = 0 the light becomes infinitely bright as d → 0." :
              "k_c keeps the attenuation finite at d = 0 (it is 1/k_c there)."}`);
          }
        },
      },
    ],

    cpp: [
      {
        title: "Describing a light",
        note: "<p>One struct covers all three positioned/directed light types; ambient light is just a color stored with the scene.</p>",
        code: String.raw`
          enum class LightType { Directional, Point, Spot };

          struct Light
          {
              LightType type;
              ColorRGB  color;          // C0
              Point3D   position;       // P            (point and spot)
              Vector3D  direction;      // unit vector: directional = direction the light travels,
                                        //              spot = spot axis R
              float     kc, kl, kq;     // attenuation constants (point and spot)
              float     spotExponent;   // p            (spot)
          };

          struct Scene
          {
              ColorRGB ambient;         // A, added once for the whole scene
              Light    lights[8];
              int      lightCount;
          };
        `,
      },
      {
        title: "Point light attenuation",
        formula: String.raw`\mathcal C = \frac{\mathcal C_0}{k_c + k_l d + k_q d^2}, \qquad d = \lVert\mathbf P - \mathbf Q\rVert`,
        code: String.raw`
          ColorRGB PointLightColor(const Light& light, const Point3D& q)
          {
              float d = Magnitude(light.position - q);
              float denom = light.kc + light.kl * d + light.kq * d * d;
              return light.color * (1.0f / denom);
          }
        `,
      },
      {
        title: "Spot light",
        formula: String.raw`\mathcal C = \frac{\max\{-\mathbf R\cdot\mathbf L, 0\}^p}{k_c + k_l d + k_q d^2}\,\mathcal C_0, \qquad \mathbf L = \frac{\mathbf P - \mathbf Q}{\lVert\mathbf P - \mathbf Q\rVert}`,
        code: String.raw`
          ColorRGB SpotLightColor(const Light& light, const Point3D& q)
          {
              Vector3D toLight = light.position - q;
              float d = Magnitude(toLight);
              Vector3D L = toLight / d;                                   // unit direction to the light

              float cosAngle = -Dot(light.direction, L);                  // -R . L
              if (cosAngle <= 0.0f) return ColorRGB(0.0f, 0.0f, 0.0f);   // more than 90 degrees off axis

              float spot = std::pow(cosAngle, light.spotExponent);       // max{-R . L, 0}^p
              return light.color * (spot / (light.kc + light.kl * d + light.kq * d * d));
          }
        `,
      },
      {
        title: "Direction and intensity for any light",
        note: "<p>Every lighting formula later in the chapter needs exactly these two values per light, so engines usually compute them in one place.</p>",
        code: String.raw`
          struct LightSample
          {
              Vector3D L;        // unit direction from the surface point to the light
              ColorRGB color;    // intensity arriving at the surface point
          };

          LightSample SampleLight(const Light& light, const Point3D& q)
          {
              if (light.type == LightType::Directional)
                  return {-light.direction, light.color};      // same L everywhere, no attenuation

              Vector3D L = Normalize(light.position - q);
              ColorRGB c = (light.type == LightType::Point) ? PointLightColor(light, q)
                                                            : SpotLightColor(light, q);
              return {L, c};
          }
        `,
      },
      {
        title: "A falloff that reaches zero (engine variant)",
        formula: String.raw`f(d) = \frac{\operatorname{sat}\!\big(1 - (d/r)^4\big)^2}{d^2 + 1}`,
        note: "<p>Not from the book: one popular choice for the range-limited falloff that Section 7.2.3 mentions. It behaves like inverse square up close and is exactly zero at the light's radius <i>r</i>, so the light can be culled outside a sphere.</p>",
        code: String.raw`
          float WindowedFalloff(float d, float radius)
          {
              float x = d / radius;
              float window = Clamp(1.0f - x * x * x * x, 0.0f, 1.0f);   // 1 near the light, 0 at d >= radius
              return (window * window) / (d * d + 1.0f);                // the +1 avoids the singularity at d = 0
          }

          bool LightAffectsSphere(const Point3D& lightPos, float radius, const Point3D& center, float r)
          {
              float reach = radius + r;
              return SquaredMag(center - lightPos) < reach * reach;     // otherwise skip this light entirely
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 7.3 Diffuse Reflection
  // ===========================================================================
  L3D.topic({
    id: "7.3",
    summary: "Lambertian (diffuse) reflection: brightness proportional to N · L, the same from every viewing direction.",

    lesson: String.raw`
      <p>A <strong>diffuse</strong> surface scatters the light that hits it in random directions. Chalk, unvarnished
      wood, cloth and matte paint behave this way. Averaged over many tiny scattering events, the effect is that a
      certain color of light, the surface's <strong>diffuse reflection color</strong> \(\mathcal D\), leaves the
      surface equally in every direction. This is called <strong>Lambertian reflection</strong>. Because every
      direction gets the same amount, the diffuse part of a surface's appearance doesn't depend on where the viewer
      is. Walk around a matte ball and its shading stays put.</p>

      <h2>Why the brightness is \(\mathbf N\cdot\mathbf L\)</h2>
      <p>What does depend on direction is how much light <em>arrives</em> per unit of surface area. Picture a beam of
      light with cross-sectional area \(A\). If it hits a surface head on, it lights an area \(A\). Tilt the surface so
      that its normal makes an angle \(\theta\) with the direction to the light, and the same beam spreads over a
      larger area \(A/\cos\theta\). The same amount of light now covers more surface, so each unit of area receives
      only \(\cos\theta\) times as much. (This is the book's Figure 7.2; the second simulation draws it.)</p>
      <p>For unit vectors the cosine is just a dot product. With \(\mathbf N\) the unit surface normal and
      \(\mathbf L\) the unit direction from the surface point toward the light,
      \[ \cos\theta = \mathbf N\cdot\mathbf L. \]
      When \(\mathbf N\cdot\mathbf L\) is negative the surface faces away from the light and shouldn't receive any of
      it, so the dot product is clamped to zero: \(\max\{\mathbf N\cdot\mathbf L, 0\}\).</p>

      <div class="key">Diffuse brightness depends only on the angle between the normal and the light. It is brightest
      where the surface faces the light (\(\mathbf N\cdot\mathbf L = 1\)), falls to zero at the <em>terminator</em>
      where the surface turns edge-on to the light (\(\mathbf N\cdot\mathbf L = 0\)), and stays zero beyond.</div>

      <h2>The diffuse lighting formula</h2>
      <p>Let \(n\) lights illuminate the point \(\mathbf Q\), the \(i\)-th with intensity \(\mathcal C_i\) at
      \(\mathbf Q\) (constant for a directional light, Equation 7.3 or 7.4 for point and spot lights) and unit direction
      \(\mathbf L_i\) from \(\mathbf Q\) toward it. Adding the ambient light \(\mathcal A\), which isn't affected by the
      normal at all, gives Equation 7.6:</p>
      <div class="formula">
        \[ \mathcal K_{\text{diffuse}} = \mathcal D\mathcal A + \sum_{i=1}^{n} \mathcal C_i\,\mathcal D\,\max\{\mathbf N\cdot\mathbf L_i, 0\} \]
      </div>
      <p>Every term is modulated by \(\mathcal D\), so in code you add up the light first and multiply by
      \(\mathcal D\) once: \(\mathcal D\big(\mathcal A + \sum_i \mathcal C_i\max\{\mathbf N\cdot\mathbf L_i,0\}\big)\).
      Where no light reaches, only \(\mathcal D\mathcal A\) is left, which is why the ambient term decides how dark
      the shadowed side of an object looks.</p>

      <h2>Practical details</h2>
      <ul>
        <li>Both vectors must have length 1, or the dot product is no longer a cosine. Normals that are interpolated
          across a triangle shrink and have to be renormalized (Section 7.7.3). \(\mathbf L\) for a point light must be
          normalized at every point because it changes from point to point.</li>
        <li>The clamp is essential. Without it, a surface facing away from one light would get <em>negative</em> light
          that cancels the contribution of other lights.</li>
        <li>The normal and the light direction must be in the same coordinate space (both in world space, or both in
          object or tangent space) before you take the dot product.</li>
      </ul>
      <div class="game">Lambert's \(\max\{\mathbf N\cdot\mathbf L, 0\}\) is the backbone of almost every real-time
      lighting model, including the diffuse term of modern physically based shaders (divided by \(\pi\), as Section 7.9
      explains). Some stylized games deliberately soften the terminator with a "wrapped" variant such as Valve's
      <em>half-Lambert</em>, \((0.5\,\mathbf N\cdot\mathbf L + 0.5)^2\), so characters never fall into pure
      darkness. That trades physical accuracy for readability.</div>
      <div class="warn">Don't use \(|\mathbf N\cdot\mathbf L|\) to "fix" dark back faces. It lights the back of an
      object as if a second light were behind it. If a surface really is two-sided (a leaf, a sheet of paper), flip the
      normal toward the viewer instead.</div>

      <p><a class="btn goto-sim" href="#/7.3/sim">Try it: light a sphere and tilt a beam →</a></p>
    `,

    keyFormulas: [
      ["Lambert factor", String.raw`\max\{\mathbf N\cdot\mathbf L, 0\} = \max\{\cos\theta, 0\}`],
      ["Diffuse lighting (Equation 7.6)", String.raw`\mathcal K_{\text{diffuse}} = \mathcal D\mathcal A + \sum_{i=1}^{n}\mathcal C_i\mathcal D\max\{\mathbf N\cdot\mathbf L_i, 0\}`],
      ["Area lit by a tilted beam", String.raw`A_{\text{lit}} = A/\cos\theta`],
    ],

    exercises: [
      { q: String.raw`A surface with normal \(\mathbf N = (0, 1, 0)\) is lit by a white directional light with \(\mathbf L = (0.6, 0.8, 0)\). The surface color is \((1, 0.5, 0.2)\) and there is no ambient light. What color is it?`,
        a: String.raw`\(\mathbf N\cdot\mathbf L = 0.8\), so \(\mathcal K = 0.8\,(1, 0.5, 0.2) = (0.8, 0.4, 0.16)\).` },
      { q: String.raw`At what angle between \(\mathbf N\) and \(\mathbf L\) does a diffuse surface receive half the light it gets head on?`,
        a: String.raw`\(\cos\theta = 0.5\), so \(\theta = 60^\circ\).` },
      { q: "Why does the diffuse term not depend on the position of the camera?",
        a: "A Lambertian surface reflects the light it receives equally in every direction. Only the amount received depends on the geometry (through N · L), and that has nothing to do with where the viewer stands." },
      { q: String.raw`Two lights shine on a point: \(\mathcal C_1 = (1,1,1)\) with \(\mathbf N\cdot\mathbf L_1 = 0.5\), and \(\mathcal C_2 = (0, 0, 1)\) with \(\mathbf N\cdot\mathbf L_2 = -0.3\). With \(\mathcal D = (0.8, 0.8, 0.8)\) and \(\mathcal A = (0.1, 0.1, 0.1)\), find \(\mathcal K_{\text{diffuse}}\).`,
        a: String.raw`The second light faces away, so it contributes \(\max\{-0.3, 0\} = 0\). \(\mathcal K = 0.8\,\big((0.1,0.1,0.1) + 0.5\,(1,1,1)\big) = (0.48, 0.48, 0.48)\).` },
    ],

    sims: [
      {
        title: "Lambert-lit sphere",
        help: String.raw`<p>Every pixel of the sphere is shaded with
          \(\mathcal D\big(\mathcal A + \sum_i\mathcal C_i\max\{\mathbf N\cdot\mathbf L_i, 0\}\big)\).
          <b>Drag</b> on the picture to move the light (the ring outside the sphere puts it behind). <b>Hover</b> to
          read \(\mathbf N\), \(\mathbf N\cdot\mathbf L\) and the color at a point. Turn on the raw view to see where the
          dot product goes negative and gets clamped.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const out = sim.readout(readout);
          const inv = () => pc.invalidate();
          const colors = { clay: [0.85, 0.45, 0.3], white: [0.9, 0.9, 0.9], grass: [0.35, 0.7, 0.3], ink: [0.3, 0.35, 0.85] };
          const mat = sim.select(controls, {
            label: "Diffuse color 𝒟", value: "clay", onChange: inv,
            options: [["clay", "Clay"], ["white", "White"], ["grass", "Grass"], ["ink", "Blue ink"]],
          });
          const amb = sim.slider(controls, { label: "Ambient 𝒜", min: 0, max: 0.6, step: 0.01, value: 0.08, onInput: inv });
          const I1 = sim.slider(controls, { label: "Light 1 intensity 𝒞₁", min: 0, max: 2, step: 0.05, value: 1, onInput: inv });
          const two = sim.checkbox(controls, { label: "Add a second light 𝒞₂ (blue, lower left)", value: false, onChange: inv });
          const raw = sim.checkbox(controls, { label: "Show raw N · L₁ (gray ≥ 0, red < 0)", value: false, onChange: inv });
          let L = n3(0.55, 0.55, 0.62);
          const L2 = n3(-0.85, -0.45, 0.25), C2 = [0.25, 0.45, 1.0];
          let probe = null;
          const geom = () => sphereGeom(0, 0, pc.width, pc.height);

          const shade = (N) => {
            const D = colors[mat.value];
            const nl1 = dot3(N, L), nl2 = dot3(N, L2);
            const light = [amb.value, amb.value, amb.value];
            for (let k = 0; k < 3; k++) light[k] += I1.value * Math.max(nl1, 0);
            if (two.value) for (let k = 0; k < 3; k++) light[k] += C2[k] * Math.max(nl2, 0);
            return { K: V.mul(D, light), nl1, nl2, light };
          };

          const pc = pixelCanvas(sim, stage, {
            width: 160, height: 120, canvasHeight: 400,
            render(pc) {
              const g = geom(), bg = rgb(sim.color("bg"));
              for (let y = 0; y < pc.height; y++)
                for (let x = 0; x < pc.width; x++) {
                  const N = sphereNormal(g, x, y);
                  if (!N) { pc.set(x, y, bg[0], bg[1], bg[2]); continue; }
                  if (raw.value) {
                    const d = dot3(N, L);
                    if (d >= 0) pc.set(x, y, d, d, d); else pc.set(x, y, -d * 0.9, 0.05, 0.05);
                    continue;
                  }
                  const K = shade(N).K;
                  pc.set(x, y, K[0], K[1], K[2]);
                }
            },
            overlay(c, pc) {
              const g = geom();
              drawLightMarker(c, pc, g, L, "L₁");
              if (two.value) {
                const [mx, my] = diskFromDir(g, L2);
                const [x, y] = pc.toCanvas(mx, my);
                c.ctx.fillStyle = cssCol(C2);
                c.ctx.beginPath(); c.ctx.arc(x, y, 6, 0, Math.PI * 2); c.ctx.fill();
                c.label(x + 9, y + 4, "L₂", { color: cssCol(C2), weight: 700 });
              }
              if (probe) drawProbe(c, pc, probe[0], probe[1]);
              update();
            },
          });
          pointer(sim, pc, {
            onDrag(x, y) { L = dirFromDisk(geom(), x, y); pc.invalidate(); },
            onHover(x, y) { probe = [x, y]; pc.redraw(); },
          });

          function update() {
            const g = geom();
            const N = probe ? sphereNormal(g, Math.floor(probe[0]), Math.floor(probe[1])) : [0, 0, 1];
            const rows = [["L₁", fmtVec(L)]];
            if (!N) { out.set(sim.rows(rows) + "<hr>Hover over the sphere to probe a point."); return; }
            const s = shade(N);
            rows.push(["N at probe", fmtVec(N)], ["N · L₁", fmt(s.nl1, 3)], ["max(N · L₁, 0)", fmt(Math.max(s.nl1, 0), 3)]);
            if (two.value) rows.push(["N · L₂", fmt(s.nl2, 3)]);
            rows.push(["light 𝒜 + Σ 𝒞ᵢ max(N·Lᵢ, 0)", fmtCol(s.light)], ["𝒦 = 𝒟 × light", colSwatch(s.K) + fmtCol(s.K)]);
            const angle = deg(Math.acos(clamp(s.nl1, -1, 1)));
            out.set(sim.rows(rows) + `<hr>Angle between N and L₁: <b>${fmt(angle, 1)}°</b>. ${s.nl1 < 0 ? "The point faces away from light 1, so it only gets ambient light (and light 2)." : "Brightness is proportional to cos θ."}`);
          }
        },
      },
      {
        title: "Why cos θ: a beam on a tilted surface",
        help: String.raw`<p>A beam of width \(A\) arrives from direction \(\mathbf L\). On the surface it covers a width
          \(A/\cos\theta\), so each unit of surface gets only \(\cos\theta = \mathbf N\cdot\mathbf L\) of the light it
          would get head on. Drag the light handle or use the slider and watch the footprint and the brightness.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 2.6, center: [0, 1.7], height: 420 });
          const out = sim.readout(readout);
          const theta = sim.slider(controls, {
            label: "Angle θ between N and L", min: -85, max: 85, step: 1, value: 50, unit: "°",
            onInput: () => { hL.set(lightPos()); },
          });
          const width = sim.slider(controls, { label: "Beam width A", min: 0.3, max: 1.6, step: 0.05, value: 0.9, onInput: () => view.redraw() });
          const lightPos = () => [3 * Math.sin(rad(theta.value)), 3 * Math.cos(rad(theta.value))];
          const hL = view.handle(lightPos(), {
            color: "g", label: "light",
            constrain: (p) => {
              const a = clamp(deg(Math.atan2(p[0], Math.max(p[1], 0.01))), -85, 85);
              return [3 * Math.sin(rad(a)), 3 * Math.cos(rad(a))];
            },
            onDrag: (p) => { theta.value = Math.round(deg(Math.atan2(p[0], p[1]))); },
          });

          view.onDraw((v) => {
            v.grid({ step: 0.5 });
            const t = rad(theta.value), A = width.value;
            const L = [Math.sin(t), Math.cos(t)], perp = [Math.cos(t), -Math.sin(t)];
            const c = Math.cos(t), half = A / 2 / c;
            // ground
            v.polygon([[-20, 0], [20, 0], [20, -5], [-20, -5]], { fill: "muted", fillAlpha: 0.18, stroke: false });
            v.line([-20, 0], [20, 0], { color: "fg", width: 2 });
            // beam
            const F1 = [-half, 0], F2 = [half, 0];
            v.polygon([F1, F2, V.add(F2, V.scale(L, 6)), V.add(F1, V.scale(L, 6))], { fill: "g", fillAlpha: 0.13, stroke: false });
            for (let k = 0; k <= 4; k++) {
              const base = V.lerp(F1, F2, k / 4);
              v.arrow(V.add(base, V.scale(L, 2.4)), base, { color: "g", width: 1.5, alpha: 0.85, head: 8 });
            }
            // cross-section A (perpendicular to the beam)
            const mid = V.scale(L, 1.9);
            v.line(V.add(mid, V.scale(perp, -A / 2)), V.add(mid, V.scale(perp, A / 2)), { color: "b", width: 3 });
            v.text(V.add(mid, V.scale(perp, A / 2 + 0.15)), "A", { color: "b", size: 14 });
            // footprint
            v.line(F1, F2, { color: "e", width: 5, alpha: Math.max(0.25, c) });
            v.text([0, -0.25], "A / cos θ = " + fmt(A / c, 2), { color: "e", size: 13, align: "center" });
            // normal and L at the center
            v.arrow([0, 0], [0, 1.3], { color: "a", label: "N", width: 3 });
            v.arrow([0, 0], V.scale(L, 1.0), { color: "g", label: "L", width: 3 });
            v.arc([0, 0], 0.55, Math.PI / 2, Math.atan2(L[1], L[0]), { color: "d", width: 2 });
            v.text(V.scale([Math.cos((Math.PI / 2 + Math.atan2(L[1], L[0])) / 2), Math.sin((Math.PI / 2 + Math.atan2(L[1], L[0])) / 2)], 0.75), "θ", { color: "d", size: 14, align: "center" });
            out.set(sim.rows([
              ["θ", fmt(theta.value, 0) + "°"],
              ["N · L = cos θ", fmt(c, 3)],
              ["beam width A", fmt(A)],
              ["footprint A / cos θ", fmt(A / c)],
              ["light per unit length", fmt(c, 3) + " × head-on"],
            ]) + `<hr>The same beam spread over ${fmt(1 / c, 2)}× the surface: each point gets ${fmt(100 * c, 0)}% of the head-on brightness.`);
          });
        },
      },
    ],

    cpp: [
      {
        title: "The Lambert factor",
        formula: String.raw`\max\{\mathbf N\cdot\mathbf L,\, 0\}`,
        code: String.raw`
          // N and L must both be unit length, in the same coordinate space.
          inline float LambertFactor(const Vector3D& normal, const Vector3D& toLight)
          {
              float d = Dot(normal, toLight);       // cos(theta)
              return (d > 0.0f) ? d : 0.0f;         // facing away from the light: no light at all
          }
        `,
      },
      {
        title: "Diffuse lighting from n lights",
        formula: String.raw`\mathcal K_{\text{diffuse}} = \mathcal D\Big(\mathcal A + \sum_{i=1}^{n}\mathcal C_i\max\{\mathbf N\cdot\mathbf L_i, 0\}\Big)`,
        note: "<p>Uses <code>Scene</code>, <code>SampleLight</code> and <code>ColorRGB</code> from Sections 7.1 and 7.2.</p>",
        code: String.raw`
          ColorRGB DiffuseLighting(const Scene& scene, const Point3D& q,
                                   const Vector3D& normal, const ColorRGB& diffuseColor)
          {
              ColorRGB light = scene.ambient;                              // A
              for (int i = 0; i < scene.lightCount; i++)
              {
                  LightSample s = SampleLight(scene.lights[i], q);         // L_i and C_i at q
                  light += s.color * LambertFactor(normal, s.L);           // C_i max{N . L_i, 0}
              }
              return Saturate(diffuseColor * light);                       // D modulates the sum
          }
        `,
      },
      {
        title: "Per-vertex sunlight",
        formula: String.raw`\mathcal K_j = \mathcal D_j\big(\mathcal A + \mathcal C_{\text{sun}}\max\{\mathbf N_j\cdot\mathbf L, 0\}\big)`,
        note: "<p>A directional light has the same <b>L</b> at every vertex, so it is computed once outside the loop. This is the kind of loop an engine uses to bake lighting into vertex colors for distant terrain.</p>",
        code: String.raw`
          void LightVertices(int count, const Vector3D* normal, const ColorRGB* diffuse, ColorRGB* result,
                             const Vector3D& sunTravelDirection, const ColorRGB& sunColor,
                             const ColorRGB& ambient)
          {
              Vector3D L = -Normalize(sunTravelDirection);      // direction TO the sun
              for (int j = 0; j < count; j++)
              {
                  float nl = LambertFactor(normal[j], L);
                  result[j] = Saturate(diffuse[j] * (ambient + sunColor * nl));
              }
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 7.4 Specular Reflection
  // ===========================================================================
  L3D.topic({
    id: "7.4",
    summary: "Shiny highlights that depend on the viewer: the Phong term (R · V)^m and the Blinn-Phong term (N · H)^m with the halfway vector.",

    lesson: String.raw`
      <p>Besides the even diffuse glow, most surfaces reflect some light strongly around the <em>mirror</em> direction.
      That produces a bright spot, a <strong>specular highlight</strong> (or specularity). Unlike diffuse light, the
      highlight moves when the viewer moves: you only see it when your eye is close to the direction in which the light
      bounces off the surface.</p>

      <h2>The vectors at a surface point</h2>
      <p>At a point \(\mathbf Q\) we have four unit vectors (the book's Figure 7.3):</p>
      <ul>
        <li>\(\mathbf N\), the surface normal;</li>
        <li>\(\mathbf L\), the direction from \(\mathbf Q\) to the light;</li>
        <li>\(\mathbf V\), the direction from \(\mathbf Q\) to the viewer;</li>
        <li>\(\mathbf R\), the <strong>reflection</strong> of \(\mathbf L\) across \(\mathbf N\), which is where a mirror
          would send the light:
          \[ \mathbf R = 2(\mathbf N\cdot\mathbf L)\,\mathbf N - \mathbf L. \]</li>
      </ul>
      <p>The formula for \(\mathbf R\) keeps the component of \(\mathbf L\) along \(\mathbf N\), which is
      \((\mathbf N\cdot\mathbf L)\mathbf N\), and flips the perpendicular part. It is the same reflection used for
      bouncing rays in Chapter 6.</p>

      <h2>The Phong specular term</h2>
      <p>The highlight should be strongest when \(\mathbf R\) points straight at the viewer and fade as the angle
      between \(\mathbf R\) and \(\mathbf V\) grows. A simple model with this behavior (believable, though it has almost
      no physical basis) raises the cosine of that angle to a power (Equation 7.7):</p>
      <div class="formula">
        \[ \mathcal S\,\mathcal C\,\max\{\mathbf R\cdot\mathbf V,\, 0\}^{m}\,(\mathbf N\cdot\mathbf L \gt 0) \]
      </div>
      <p>\(\mathcal S\) is the surface's <strong>specular reflection color</strong>, \(\mathcal C\) the light's
      intensity, and \(m\) the <strong>specular exponent</strong>. The factor \((\mathbf N\cdot\mathbf L \gt 0)\) is a
      boolean that is 1 when true and 0 when false. It removes highlights from points that face away from the light,
      where \(\mathbf R\cdot\mathbf V\) could otherwise still be positive.</p>
      <p>The exponent controls the <em>size</em> of the highlight. Raising a cosine (a number at most 1) to a large
      power makes it drop off quickly, so a large \(m\) gives a small, sharp highlight (polished plastic, wet
      surfaces), and a small \(m\) gives a broad, dull one (the book's Figure 7.4 uses \(m = 2, 10, 50, 100\)).</p>

      <h2>The halfway vector (Blinn–Phong)</h2>
      <p>An alternative uses the <strong>halfway vector</strong>, the unit vector exactly between the direction to the
      light and the direction to the viewer (Equation 7.9):</p>
      <div class="formula">
        \[ \mathbf H = \frac{\mathbf L + \mathbf V}{\lVert\mathbf L + \mathbf V\rVert} \]
      </div>
      <p>If the surface were a perfect mirror, light would reach the viewer exactly when its normal lies along
      \(\mathbf H\). So \(\mathbf N\cdot\mathbf H\) measures how close the surface is to the mirror orientation, and it
      can replace \(\mathbf R\cdot\mathbf V\). Summing over all lights gives the specular part of the lighting formula
      (Equation 7.8):</p>
      <div class="formula">
        \[ \mathcal K_{\text{specular}} = \sum_{i=1}^{n}\mathcal C_i\,\mathcal S\,\max\{\mathbf N\cdot\mathbf H_i, 0\}^{m}\,(\mathbf N\cdot\mathbf L_i \gt 0),
           \qquad \mathbf H_i = \frac{\mathbf L_i + \mathbf V}{\lVert\mathbf L_i + \mathbf V\rVert} \]
      </div>
      <p>The two terms give highlights in the same place but with a different falloff. When all the vectors lie in one
      plane, the angle between \(\mathbf N\) and \(\mathbf H\) is exactly <em>half</em> the angle between \(\mathbf R\)
      and \(\mathbf V\). Half the angle means a larger cosine, so for the same \(m\) the Blinn–Phong highlight is wider.
      Using roughly \(4m\) in Blinn–Phong gives a highlight of similar size to Phong with exponent \(m\). On flat
      surfaces seen at a glancing angle, Blinn–Phong highlights also stretch out into streaks, which matches real
      photographs better than Phong's round spots.</p>
      <div class="note">\(\mathbf H\) can be cheaper. For a directional light and a viewer treated as infinitely far
      away, \(\mathbf L\) and \(\mathbf V\) are constant, so \(\mathbf H\) is computed once instead of reflecting
      \(\mathbf L\) at every point.</div>

      <h2>Diffuse plus specular</h2>
      <p>Putting Sections 7.3 and 7.4 together, the color at a point lit by \(n\) lights is</p>
      <div class="formula">
        \[ \mathcal K = \mathcal D\mathcal A + \sum_{i=1}^{n}\mathcal C_i\Big[\mathcal D\max\{\mathbf N\cdot\mathbf L_i,0\} + \mathcal S\max\{\mathbf N\cdot\mathbf H_i,0\}^{m}(\mathbf N\cdot\mathbf L_i \gt 0)\Big]. \]
      </div>
      <p>Diffuse color \(\mathcal D\) carries the object's color. For plastics and paints the specular color
      \(\mathcal S\) is white or gray, so the highlight takes on the color of the light. For metals, \(\mathcal S\) is
      tinted (gold reflects a yellow highlight) and \(\mathcal D\) is dark.</p>
      <div class="warn">Clamp before calling <code>pow</code>. \(\mathbf N\cdot\mathbf H\) can be slightly negative,
      and <code>pow</code> of a negative number with a non-integer exponent is NaN, which then spreads through the
      whole pixel.</div>

      <p><a class="btn goto-sim" href="#/7.4/sim">Try it: R, V and H, and Phong vs Blinn–Phong →</a></p>
    `,

    keyFormulas: [
      ["Reflection of L", String.raw`\mathbf R = 2(\mathbf N\cdot\mathbf L)\mathbf N - \mathbf L`],
      ["Phong specular (7.7)", String.raw`\mathcal S\mathcal C\max\{\mathbf R\cdot\mathbf V, 0\}^m(\mathbf N\cdot\mathbf L \gt 0)`],
      ["Halfway vector (7.9)", String.raw`\mathbf H = \dfrac{\mathbf L + \mathbf V}{\lVert\mathbf L + \mathbf V\rVert}`],
      ["Blinn–Phong specular (7.8)", String.raw`\mathcal K_{\text{specular}} = \sum_i\mathcal C_i\mathcal S\max\{\mathbf N\cdot\mathbf H_i, 0\}^m(\mathbf N\cdot\mathbf L_i \gt 0)`],
    ],

    exercises: [
      { q: String.raw`With \(\mathbf N = (0,1,0)\) and \(\mathbf L = (-0.6, 0.8, 0)\), compute \(\mathbf R\).`,
        a: String.raw`\(\mathbf N\cdot\mathbf L = 0.8\), so \(\mathbf R = 1.6\,(0,1,0) - (-0.6, 0.8, 0) = (0.6, 0.8, 0)\): the mirror image across the normal.` },
      { q: String.raw`For the same \(\mathbf N\) and \(\mathbf L\), the viewer is at \(\mathbf V = (0, 1, 0)\). Compute \(\mathbf H\), \(\mathbf R\cdot\mathbf V\) and \(\mathbf N\cdot\mathbf H\).`,
        a: String.raw`\(\mathbf L + \mathbf V = (-0.6, 1.8, 0)\), length \(\sqrt{3.6} \approx 1.897\), so \(\mathbf H \approx (-0.316, 0.949, 0)\). \(\mathbf R\cdot\mathbf V = 0.8\) (angle \(36.9^\circ\)) and \(\mathbf N\cdot\mathbf H \approx 0.949\) (angle \(18.4^\circ\), exactly half).` },
      { q: String.raw`With \(m = 20\), what are the Phong and Blinn–Phong specular factors in the previous exercise?`,
        a: String.raw`Phong: \(0.8^{20} \approx 0.0115\). Blinn–Phong: \(0.949^{20} \approx 0.35\). The halfway version is much brighter here because its angle is half as large.` },
      { q: String.raw`Why is the factor \((\mathbf N\cdot\mathbf L \gt 0)\) needed?`,
        a: String.raw`When the light is behind the surface, \(\mathbf R\) or \(\mathbf H\) can still point roughly toward the viewer, so the power term could be positive. Physically no light reaches that side, so the boolean switches the highlight off.` },
      { q: "Does the diffuse term or the specular term change when the camera moves around a static object?",
        a: "Only the specular term, because it depends on V. The diffuse term depends only on N and L." },
    ],

    sims: [
      {
        title: "Reflection and halfway vectors",
        help: String.raw`<p>Drag the light direction <b>L</b> (gold) and the view direction <b>V</b> (blue) around the
          point \(\mathbf Q\). Purple is the reflection \(\mathbf R\), green the halfway vector \(\mathbf H\). The graph
          below shows how bright the highlight would be for every viewing angle, for both models; the dot marks the
          current \(\mathbf V\). Notice that the angle between \(\mathbf N\) and \(\mathbf H\) is always half the angle
          between \(\mathbf R\) and \(\mathbf V\).</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const out = sim.readout(readout);
          const view = sim.view2d(stage, { range: 1.45, center: [0, 1.0], height: 320 });
          const plot = sim.view2d(stage, { xRange: [-95, 95], yRange: [-0.1, 1.12], height: 200 });
          const redraw = () => { view.redraw(); plot.redraw(); };
          const m = sim.slider(controls, { label: "Specular exponent m", min: 1, max: 128, step: 1, value: 16, onInput: redraw });
          const onCircle = (p) => {
            const a = Math.atan2(p[1], p[0]);
            return [1.8 * Math.cos(a), 1.8 * Math.sin(a)];
          };
          const hL = view.handle([1.8 * Math.cos(rad(130)), 1.8 * Math.sin(rad(130))], { color: "g", label: "L", constrain: onCircle, onDrag: () => plot.redraw() });
          const hV = view.handle([1.8 * Math.cos(rad(65)), 1.8 * Math.sin(rad(65))], { color: "a", label: "V", constrain: onCircle, onDrag: () => plot.redraw() });
          const N = [0, 1];
          const terms = (L, Vv) => {
            const nl = V.dot(N, L);
            const R = V.sub(V.scale(N, 2 * nl), L);
            const H = V.norm(V.add(L, Vv));
            const on = nl > 0 ? 1 : 0;
            return { nl, R, H, rv: V.dot(R, Vv), nh: V.dot(N, H), phong: on * Math.pow(Math.max(V.dot(R, Vv), 0), m.value), blinn: on * Math.pow(Math.max(V.dot(N, H), 0), m.value) };
          };
          const angleFromN = (p) => deg(Math.atan2(p[0], p[1])); // signed angle from +y, positive toward +x

          view.onDraw((v) => {
            v.grid({ step: 0.5 });
            v.polygon([[-10, 0], [10, 0], [10, -5], [-10, -5]], { fill: "muted", fillAlpha: 0.2, stroke: false });
            v.line([-10, 0], [10, 0], { color: "fg", width: 2 });
            const L = V.norm(hL.pos), Vv = V.norm(hV.pos);
            const t = terms(L, Vv);
            v.arrow([0, 0], [0, 1.25], { color: "fg", label: "N", width: 2.5 });
            v.arrow([0, 0], V.scale(t.R, 1.45), { color: "d", label: "R", width: 2.5, dash: [6, 4] });
            v.arrow([0, 0], V.scale(t.H, 1.2), { color: "c", label: "H", width: 3 });
            v.arrow([0, 0], V.scale(L, 1.7), { color: "g", width: 3 });
            v.arrow([0, 0], V.scale(Vv, 1.7), { color: "a", width: 3 });
            const aR = Math.atan2(t.R[1], t.R[0]), aV = Math.atan2(Vv[1], Vv[0]), aH = Math.atan2(t.H[1], t.H[0]);
            v.arc([0, 0], 0.62, aR, aV, { color: "d", width: 2 });
            v.arc([0, 0], 0.42, Math.PI / 2, aH, { color: "c", width: 2 });
            v.point([0, 0], { color: "fg", r: 4, label: "Q", labelOffset: [6, 16] });
            if (t.nl <= 0) v.text([0, -0.3], "N · L ≤ 0: the light is behind the surface, no highlight", { color: "e", align: "center", size: 12 });
          });

          plot.onDraw((p) => {
            p.grid({ stepX: 30, stepY: 0.2 });
            p.axes({ ticks: true, labels: ["view angle from N (degrees)", ""] });
            const L = V.norm(hL.pos);
            const at = (th) => [Math.sin(rad(th)), Math.cos(rad(th))];
            p.plot((th) => terms(L, at(th)).phong, { color: "d", width: 2.5, from: -90, to: 90 });
            p.plot((th) => terms(L, at(th)).blinn, { color: "c", width: 2.5, from: -90, to: 90 });
            const Vv = V.norm(hV.pos), th = angleFromN(Vv);
            const t = terms(L, Vv);
            if (Math.abs(th) <= 90) {
              p.line([th, 0], [th, 1.05], { color: "a", dash: [4, 4], width: 1 });
              p.point([th, t.phong], { color: "d", r: 5 });
              p.point([th, t.blinn], { color: "c", r: 5 });
            }
            p.text([-88, 1.0], "Phong (R·V)^m", { color: "d", size: 12 });
            p.text([-88, 0.86], "Blinn–Phong (N·H)^m", { color: "c", size: 12 });
            const angRV = deg(Math.acos(clamp(t.rv, -1, 1))), angNH = deg(Math.acos(clamp(t.nh, -1, 1)));
            out.set(sim.rows([
              [sim.swatch("g") + "L", fmtVec(L)],
              [sim.swatch("a") + "V", fmtVec(Vv)],
              ["N · L", fmt(t.nl, 3), t.nl > 0 ? "ok" : "bad"],
              [sim.swatch("d") + "R = 2(N·L)N − L", fmtVec(t.R)],
              [sim.swatch("c") + "H = (L+V)/‖L+V‖", fmtVec(t.H)],
              ["R · V", fmt(t.rv, 3) + ` (${fmt(angRV, 1)}°)`],
              ["N · H", fmt(t.nh, 3) + ` (${fmt(angNH, 1)}°)`],
              ["(R · V)^m", fmt(t.phong, 3)],
              ["(N · H)^m", fmt(t.blinn, 3)],
            ]) + `<hr>The N–H angle is ${fmt(angNH, 1)}°, half of the R–V angle ${fmt(angRV, 1)}°, so with the same m the Blinn–Phong highlight is wider.`);
          });
        },
      },
      {
        title: "Phong vs Blinn–Phong highlights",
        help: String.raw`<p>The left sphere uses \(\max\{\mathbf R\cdot\mathbf V,0\}^m\), the right one
          \(\max\{\mathbf N\cdot\mathbf H,0\}^m\), with the same light and exponent. <b>Drag</b> on either sphere to move
          the light, <b>hover</b> to compare the two terms at a point. Raise \(m\) to sharpen the highlight, and tick
          the box to give Blinn–Phong the exponent \(4m\), which makes the two highlights about the same size.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const out = sim.readout(readout);
          const inv = () => pc.invalidate();
          const m = sim.slider(controls, { label: "Specular exponent m", min: 1, max: 200, step: 1, value: 20, onInput: inv });
          const match = sim.checkbox(controls, { label: "Blinn–Phong uses 4m", value: false, onChange: inv });
          const diff = sim.checkbox(controls, { label: "Include diffuse 𝒟 max(N·L, 0)", value: true, onChange: inv });
          const matSel = sim.select(controls, {
            label: "Material", value: "plastic", onChange: inv,
            options: [["plastic", "Red plastic (white 𝒮)"], ["gold", "Gold (tinted 𝒮, dark 𝒟)"]],
          });
          const mats = { plastic: { D: [0.7, 0.12, 0.1], S: [1, 1, 1] }, gold: { D: [0.12, 0.08, 0.02], S: [1, 0.78, 0.34] } };
          let L = n3(0.5, 0.45, 0.74);
          let probe = null;
          const geoms = () => [sphereGeom(0, 0, pc.width / 2, pc.height, 0.42), sphereGeom(pc.width / 2, 0, pc.width / 2, pc.height, 0.42)];
          const terms = (N) => {
            const nl = dot3(N, L);
            const Rz = 2 * nl * N[2] - L[2]; // R · V with V = (0, 0, 1)
            const H = n3(L[0], L[1], L[2] + 1);
            const nh = dot3(N, H);
            const on = nl > 0 ? 1 : 0;
            const mb = match.value ? 4 * m.value : m.value;
            return { nl, rv: Rz, nh, phong: on * Math.pow(Math.max(Rz, 0), m.value), blinn: on * Math.pow(Math.max(nh, 0), mb), mb };
          };
          const color = (t, which) => {
            const M = mats[matSel.value];
            const s = which ? t.blinn : t.phong;
            const d = diff.value ? Math.max(t.nl, 0) : 0;
            return [0, 1, 2].map((k) => M.D[k] * (0.06 + d) + M.S[k] * s);
          };
          const pc = pixelCanvas(sim, stage, {
            width: 240, height: 120, canvasHeight: 330,
            render(pc) {
              const gs = geoms(), bg = rgb(sim.color("bg"));
              for (let y = 0; y < pc.height; y++)
                for (let x = 0; x < pc.width; x++) {
                  const which = x < pc.width / 2 ? 0 : 1;
                  const N = sphereNormal(gs[which], x, y);
                  if (!N) { pc.set(x, y, bg[0], bg[1], bg[2]); continue; }
                  const K = color(terms(N), which);
                  pc.set(x, y, K[0], K[1], K[2]);
                }
            },
            overlay(c, pc) {
              const gs = geoms();
              const [x0, y0] = pc.toCanvas(pc.width / 4, 4);
              const [x1] = pc.toCanvas((3 * pc.width) / 4, 4);
              c.label(x0, y0 + 14, "Phong (R·V)^" + m.value, { color: "fg", weight: 700, align: "center", size: 13 });
              c.label(x1, y0 + 14, "Blinn–Phong (N·H)^" + (match.value ? 4 * m.value : m.value), { color: "fg", weight: 700, align: "center", size: 13 });
              gs.forEach((g) => drawLightMarker(c, pc, g, L));
              if (probe) {
                drawProbe(c, pc, probe[0], probe[1]);
                const other = probe[0] < pc.width / 2 ? probe[0] + pc.width / 2 : probe[0] - pc.width / 2;
                drawProbe(c, pc, other, probe[1], "muted");
              }
              update();
            },
          });
          pointer(sim, pc, {
            onDrag(x, y) { L = dirFromDisk(geoms()[x < pc.width / 2 ? 0 : 1], x, y); pc.invalidate(); },
            onHover(x, y) { probe = [x, y]; pc.redraw(); },
          });

          function update() {
            const gs = geoms();
            const which = probe && probe[0] >= pc.width / 2 ? 1 : 0;
            const N = probe ? sphereNormal(gs[which], Math.floor(probe[0]), Math.floor(probe[1])) : n3(0.25, 0.22, 1);
            if (!N) { out.set("Hover over a sphere to compare the two terms at a point."); return; }
            const t = terms(N);
            out.set(sim.rows([
              ["L", fmtVec(L)],
              ["N at probe", fmtVec(N)],
              ["N · L", fmt(t.nl, 3)],
              ["R · V", fmt(t.rv, 3)],
              ["N · H", fmt(t.nh, 3)],
              ["Phong (R·V)^" + m.value, fmt(t.phong, 3)],
              ["Blinn–Phong (N·H)^" + t.mb, fmt(t.blinn, 3)],
            ]) + "<hr>The viewer is straight in front (V = (0, 0, 1)), so each highlight sits where R, or H, lines up with the view.");
          }
        },
      },
    ],

    cpp: [
      {
        title: "Reflection vector",
        formula: String.raw`\mathbf R = 2(\mathbf N\cdot\mathbf L)\mathbf N - \mathbf L`,
        code: String.raw`
          // L points from the surface toward the light; N is unit length. R comes out unit length too.
          inline Vector3D Reflect(const Vector3D& L, const Vector3D& N)
          {
              return N * (2.0f * Dot(N, L)) - L;
          }
        `,
      },
      {
        title: "Phong specular term",
        formula: String.raw`\mathcal S\mathcal C\max\{\mathbf R\cdot\mathbf V, 0\}^m(\mathbf N\cdot\mathbf L \gt 0)`,
        code: String.raw`
          ColorRGB PhongSpecular(const Vector3D& N, const Vector3D& L, const Vector3D& V,
                                 const ColorRGB& specularColor, const ColorRGB& lightColor, float m)
          {
              if (Dot(N, L) <= 0.0f) return ColorRGB();      // the boolean (N . L > 0)
              float rv = Dot(Reflect(L, N), V);
              if (rv <= 0.0f) return ColorRGB();             // clamp before pow
              return specularColor * lightColor * std::pow(rv, m);
          }
        `,
      },
      {
        title: "Blinn–Phong specular term",
        formula: String.raw`\mathbf H = \frac{\mathbf L + \mathbf V}{\lVert\mathbf L + \mathbf V\rVert} \qquad \mathcal S\mathcal C\max\{\mathbf N\cdot\mathbf H, 0\}^m(\mathbf N\cdot\mathbf L \gt 0)`,
        code: String.raw`
          ColorRGB BlinnPhongSpecular(const Vector3D& N, const Vector3D& L, const Vector3D& V,
                                      const ColorRGB& specularColor, const ColorRGB& lightColor, float m)
          {
              if (Dot(N, L) <= 0.0f) return ColorRGB();
              Vector3D H = Normalize(L + V);                 // halfway vector
              float nh = Dot(N, H);
              if (nh <= 0.0f) return ColorRGB();
              return specularColor * lightColor * std::pow(nh, m);
          }
        `,
      },
      {
        title: "Diffuse plus specular for n lights",
        formula: String.raw`\mathcal K = \mathcal D\mathcal A + \sum_i\mathcal C_i\big[\mathcal D\max\{\mathbf N\cdot\mathbf L_i,0\} + \mathcal S\max\{\mathbf N\cdot\mathbf H_i,0\}^m(\mathbf N\cdot\mathbf L_i \gt 0)\big]`,
        code: String.raw`
          struct Material
          {
              ColorRGB diffuse;     // D
              ColorRGB specular;    // S
              float    exponent;    // m
          };

          ColorRGB ShadePoint(const Scene& scene, const Material& mat, const Point3D& q,
                              const Vector3D& N, const Point3D& cameraPos)
          {
              Vector3D V = Normalize(cameraPos - q);                      // direction to the viewer
              ColorRGB color = mat.diffuse * scene.ambient;               // D A
              for (int i = 0; i < scene.lightCount; i++)
              {
                  LightSample s = SampleLight(scene.lights[i], q);
                  float nl = Dot(N, s.L);
                  if (nl <= 0.0f) continue;                               // no diffuse and no specular
                  Vector3D H = Normalize(s.L + V);
                  float spec = std::pow(std::fmax(Dot(N, H), 0.0f), mat.exponent);
                  color += s.color * (mat.diffuse * nl + mat.specular * spec);
              }
              return Saturate(color);
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 7.5 Texture Mapping
  // ===========================================================================
  const CUBE_FACES = [
    { name: "+x", axis: 0, sign: 1, color: "e", cell: [2, 1] },
    { name: "−x", axis: 0, sign: -1, color: "b", cell: [0, 1] },
    { name: "+y", axis: 1, sign: 1, color: "c", cell: [1, 0] },
    { name: "−y", axis: 1, sign: -1, color: "f", cell: [1, 2] },
    { name: "+z", axis: 2, sign: 1, color: "a", cell: [1, 1] },
    { name: "−z", axis: 2, sign: -1, color: "d", cell: [3, 1] },
  ];
  // Cube map face selection (Table 7.1, same as the OpenGL convention).
  function cubeLookup(d) {
    const ax = Math.abs(d[0]), ay = Math.abs(d[1]), az = Math.abs(d[2]);
    let face, sc, tc, ma;
    if (ax >= ay && ax >= az) { ma = ax; face = d[0] > 0 ? 0 : 1; sc = d[0] > 0 ? -d[2] : d[2]; tc = -d[1]; }
    else if (ay >= az) { ma = ay; face = d[1] > 0 ? 2 : 3; sc = d[0]; tc = d[1] > 0 ? d[2] : -d[2]; }
    else { ma = az; face = d[2] > 0 ? 4 : 5; sc = d[2] > 0 ? d[0] : -d[0]; tc = -d[1]; }
    return { face, sc, tc, ma, s: 0.5 + (0.5 * sc) / ma, t: 0.5 + (0.5 * tc) / ma };
  }
  const fmtMat = (A, d = 2) => `<div class="eq">${A.map((r) => "[ " + r.map((x) => fmt(x, d).padStart(6)).join(" ") + " ]").join("\n")}</div>`;

  L3D.topic({
    id: "7.5",
    summary: "Texture coordinates, projective textures, cube maps, and how bilinear filtering and mipmaps keep textures from looking blocky or shimmering.",

    lesson: String.raw`
      <p>A <strong>texture map</strong> adds detail that would be far too expensive to model with geometry. At each
      point of a surface a <strong>texel</strong> (texture pixel) is looked up and combined with the lighting formula.
      In the simplest and most common case a filtered texture sample \(\mathcal T\) modulates the diffuse color
      (Equation 7.10):</p>
      <div class="formula">
        \[ \mathcal K_{\text{diffuse}} = \mathcal D\mathcal T\mathcal A + \sum_{i=1}^{n}\mathcal C_i\,\mathcal D\mathcal T\,\max\{\mathbf N\cdot\mathbf L_i, 0\} \]
      </div>
      <p>A second texture can modulate the specular term instead. That one is called a <strong>gloss map</strong>
      \(\mathcal G\) and controls how shiny each point is (Equation 7.11), so a single material can have polished metal
      rivets on dull painted panels:</p>
      <div class="formula">
        \[ \mathcal K_{\text{specular}} = \sum_{i=1}^{n}\mathcal C_i\,\mathcal S\mathcal G\,\max\{\mathbf N\cdot\mathbf H_i, 0\}^{m}\,(\mathbf N\cdot\mathbf L_i \gt 0) \]
      </div>
      <p>Which texel is used depends on the <strong>texture coordinates</strong>. They are either stored with each
      vertex or generated at run time for special effects, and they are interpolated across each triangle with the
      perspective-correct interpolation of Section 5.4.2. A vertex can carry up to four coordinates, named
      \(s, t, p, q\). (OpenGL originally called the third one \(r\), but that clashed with the red channel in shader
      swizzles like <code>.rgb</code>, so it was renamed.)</p>

      <h2 data-sub="7.5.1">Standard Texture Maps</h2>
      <p>One, two or three coordinates look up texels in a 1D, 2D or 3D texture. In each direction the whole width,
      height or depth of the image corresponds to coordinates from 0 to 1, whatever its size in pixels. A 2D texture of
      \(w\times h\) texels covers the unit square in \((s, t)\), and the texel containing \((s, t)\) has integer
      coordinates \(\lfloor ws\rfloor, \lfloor ht\rfloor\). A 1D texture is a 2D texture one pixel tall, and a 2D texture
      is a 3D texture one pixel deep, so missing \(t\) and \(p\) coordinates are taken to be 0.</p>
      <div class="game">Coordinates outside \([0,1]\) are handled by the <em>wrap mode</em>. <em>Repeat</em> keeps only
      the fractional part, which tiles a brick texture across a long wall; <em>clamp</em> sticks to the edge texels,
      which avoids seams on decals and UI images.</div>

      <h2 data-sub="7.5.2">Projective Texture Maps</h2>
      <p>The fourth coordinate \(q\) plays the role of the homogeneous \(w\). It defaults to 1, and the interpolated
      \(s, t, p\) are divided by the interpolated \(q\) before the lookup. Along a scanline whose endpoints have depths
      \(z_1, z_2\), the perspective-correct interpolation at parameter \(u\) therefore gives (Equation 7.12)</p>
      <div class="formula">
        \[ s = \frac{s_3}{q_3} = \frac{(1-u)\,\dfrac{s_1}{z_1} + u\,\dfrac{s_2}{z_2}}{(1-u)\,\dfrac{q_1}{z_1} + u\,\dfrac{q_2}{z_2}}, \]
      </div>
      <p>and similarly for \(t\) and \(p\). The classic use is a <strong>spot light that projects an image</strong>, like
      a slide projector or the stained-glass pattern of a window on the floor. The projected image grows with distance
      from the light, exactly like a perspective projection. A \(4\times4\) <em>texture matrix</em> maps each vertex
      position to \((s, t, 0, q)\) so that dividing by \(q\) gives the right 2D coordinates.</p>
      <p>Let the projector sit at \(\mathbf P\) and point along the unit vector \(\mathbf Z\), with unit vectors
      \(\mathbf S\) and \(\mathbf T\) perpendicular to \(\mathbf Z\) and aligned with the image's \(s\) and \(t\)
      axes. The first matrix moves points into the projector's frame, where \(\mathbf P\) is the origin and
      \(\mathbf S, \mathbf T, \mathbf Z\) are the axes. When \(\mathbf S\) and \(\mathbf T\) are orthogonal it is just
      the inverse of the matrix with columns \(\mathbf S, \mathbf T, \mathbf Z, \mathbf P\) (Equation 7.13):</p>
      <div class="formula">
        \[ \mathbf M_1 = \begin{bmatrix} S_x & S_y & S_z & -\mathbf S\cdot\mathbf P \\ T_x & T_y & T_z & -\mathbf T\cdot\mathbf P \\
             Z_x & Z_y & Z_z & -\mathbf Z\cdot\mathbf P \\ 0 & 0 & 0 & 1 \end{bmatrix} \]
      </div>
      <p>(This frame is left-handed, since \(\mathbf S\times\mathbf T = -\mathbf Z\).) The second matrix performs the
      projection. For an apex angle \(\alpha\) the focal length is \(e = 1/\tan(\alpha/2)\) (Equation 7.14). With
      \(a\) the image's aspect ratio (height divided by width), we want \([-1, 1]\) in \(x\) and \([-a, a]\) in \(y\) on
      the plane at distance \(e\) to map to \([0, 1]\) (Equation 7.15):</p>
      <div class="formula">
        \[ \mathbf M_2 = \begin{bmatrix} e/2 & 0 & 1/2 & 0 \\ 0 & e/(2a) & 1/2 & 0 \\ 0 & 0 & 0 & 0 \\ 0 & 0 & 1 & 0 \end{bmatrix},
           \qquad \mathbf M = \mathbf M_2\mathbf M_1. \]
      </div>
      <p>For a point at \((x, y, z)\) in the projector's frame the result is
      \(s = \tfrac12\big(e\,x/z + 1\big)\) and \(t = \tfrac12\big(e\,y/(az) + 1\big)\), with \(q = z\), the distance in
      front of the projector.</p>
      <div class="warn">Points <em>behind</em> the projector have \(q \lt 0\), and the division still produces valid
      looking coordinates: a mirrored copy of the image appears behind the light. Always reject \(q \le 0\) (or multiply
      by a spot-light falloff that is zero there). The projection also knows nothing about occlusion; an object between
      the projector and a wall doesn't block the image unless you add a shadow test.</div>

      <h2 data-sub="7.5.3">Cube Texture Maps</h2>
      <p>A <strong>cube texture map</strong> consists of six square 2D images, one for each face of a cube. The three
      coordinates are a <em>direction</em> \((x, y, z)\) from the cube's center (the book calls them \(s, t, p\)), and
      the texel sampled is the one that direction points at. The face is chosen by the coordinate with the
      <strong>largest absolute value</strong> and by its sign. The other two coordinates are divided by that one and
      remapped from \([-1,1]\) to \([0,1]\) (Table 7.1):</p>
      <table>
        <tr><th>Face</th><th>\(s\)</th><th>\(t\)</th></tr>
        <tr><td>\(+x\)</td><td>\(\tfrac12 - \tfrac{z}{2x}\)</td><td>\(\tfrac12 - \tfrac{y}{2x}\)</td></tr>
        <tr><td>\(-x\)</td><td>\(\tfrac12 - \tfrac{z}{2x}\)</td><td>\(\tfrac12 + \tfrac{y}{2x}\)</td></tr>
        <tr><td>\(+y\)</td><td>\(\tfrac12 + \tfrac{x}{2y}\)</td><td>\(\tfrac12 + \tfrac{z}{2y}\)</td></tr>
        <tr><td>\(-y\)</td><td>\(\tfrac12 - \tfrac{x}{2y}\)</td><td>\(\tfrac12 + \tfrac{z}{2y}\)</td></tr>
        <tr><td>\(+z\)</td><td>\(\tfrac12 + \tfrac{x}{2z}\)</td><td>\(\tfrac12 - \tfrac{y}{2z}\)</td></tr>
        <tr><td>\(-z\)</td><td>\(\tfrac12 + \tfrac{x}{2z}\)</td><td>\(\tfrac12 + \tfrac{y}{2z}\)</td></tr>
      </table>
      <p>The divisions are signed, so on the negative faces the sign of the denominator flips the axis. The direction
      doesn't need to be unit length, because dividing by the largest coordinate removes the scale.</p>
      <p>Cube maps are the standard way to store an <strong>environment</strong>. For reflections, the view direction is
      reflected about the normal and used as the lookup direction, a calculation the hardware does very cheaply. Older
      hardware also used <strong>normalization cube maps</strong>: each texel stores the unit vector that points to it,
      encoded as a color with (Equation 7.16)</p>
      <div class="formula">\[ \text{red} = \frac{x+1}{2}, \qquad \text{green} = \frac{y+1}{2}, \qquad \text{blue} = \frac{z+1}{2}, \]</div>
      <p>so a single lookup with any interpolated (shortened) vector returns its normalized version. That matters for
      per-pixel lighting, where interpolated normals always come out shorter than 1 (Section 7.7.3).</p>

      <h2 data-sub="7.5.4">Filtering and Mipmaps</h2>
      <p>The texture's resolution almost never matches the screen's. When a surface is close to the camera, one texel
      covers many pixels (<em>magnification</em>), and taking only the nearest texel makes it look blocky. Hardware
      therefore fetches the four nearest texels and blends them, which is <strong>bilinear filtering</strong>. For a
      \(w\times h\) texture sampled at \((s, t)\), define (Equation 7.17)</p>
      <div class="formula">
        \[ i = \big\lfloor ws - \tfrac12\big\rfloor,\quad j = \big\lfloor ht - \tfrac12\big\rfloor,\quad
           \alpha = \operatorname{frac}\big(ws - \tfrac12\big),\quad \beta = \operatorname{frac}\big(ht - \tfrac12\big). \]
        \[ \mathcal T = (1-\alpha)(1-\beta)\,\mathcal T_{i,j} + \alpha(1-\beta)\,\mathcal T_{i+1,j} + (1-\alpha)\beta\,\mathcal T_{i,j+1} + \alpha\beta\,\mathcal T_{i+1,j+1} \]
      </div>
      <p>The \(-\tfrac12\) appears because texel centers sit at half-integer positions. The weights are the areas of the
      rectangles on the opposite side of the sample point, so they add up to 1.</p>
      <p>Far from the camera the opposite happens (<em>minification</em>): one pixel covers many texels. Bilinear
      filtering still reads only four of them, so the result jumps around as the camera moves, giving shimmering and
      moiré patterns (<em>aliasing</em>). The cure is to prefilter: store a chain of images, each half the width and
      height of the previous one, down to \(1\times1\). This is a <strong>mipmap</strong> (from <em>multum in
      parvo</em>, "much in a small place"). Because \(1 + \tfrac14 + \tfrac1{16} + \cdots = \tfrac43\), the whole chain
      costs only one third more memory than the original image.</p>
      <p>The hardware picks a level at each pixel from how fast the texture coordinates change across the screen. Let the
      texture be \(2^n\times 2^m\) texels and \(u = 2^n s\), \(v = 2^m t\) be coordinates measured in texels. Then
      (Equation 7.20)</p>
      <div class="formula">
        \[ \rho_x = \sqrt{\Big(\frac{\partial u}{\partial x}\Big)^2 + \Big(\frac{\partial v}{\partial x}\Big)^2},\qquad
           \rho_y = \sqrt{\Big(\frac{\partial u}{\partial y}\Big)^2 + \Big(\frac{\partial v}{\partial y}\Big)^2},\qquad
           \lambda = \log_2\big[\max(\rho_x, \rho_y)\big]. \]
      </div>
      <p>\(\rho\) is roughly the number of texels one pixel step crosses, so \(\lambda\) is the level where that becomes
      about one texel. Level 0 is the full image. With bilinear filtering, \(\lambda\) is rounded to the nearest integer
      and clamped to \([0, \max(n, m)]\). The jump from one level to the next can be visible as a line on the floor, so
      <strong>trilinear filtering</strong> samples levels \(\lfloor\lambda\rfloor\) and \(\lfloor\lambda\rfloor + 1\)
      bilinearly and blends them (Equation 7.21):
      \[ \mathcal T = \big(1 - \operatorname{frac}(\lambda)\big)\,\mathcal T_1 + \operatorname{frac}(\lambda)\,\mathcal T_2. \]
      1D and 3D textures work the same way with one or three coordinates, and cube maps are mipmapped face by face.</p>
      <div class="note">On a floor seen at a grazing angle, \(\rho_y\) is much larger than \(\rho_x\). Taking the maximum
      makes the texture blurrier than necessary in the \(x\) direction. <em>Anisotropic filtering</em>, which every
      modern GPU offers, takes several samples along the long direction of the pixel's footprint instead.</div>
      <div class="game">GPUs compute the derivatives by shading pixels in \(2\times2\) blocks and subtracting
      neighbors. That is why texture lookups inside divergent branches of a shader can pick the wrong mip level. Texture
      streaming systems also use mip levels: a distant object only needs its small levels in memory.</div>

      <p><a class="btn goto-sim" href="#/7.5/sim">Try it: filtering, a texture projector, and cube map lookups →</a></p>
    `,

    keyFormulas: [
      ["Textured diffuse term (7.10)", String.raw`\mathcal K_{\text{diffuse}} = \mathcal D\mathcal T\mathcal A + \sum_i\mathcal C_i\mathcal D\mathcal T\max\{\mathbf N\cdot\mathbf L_i, 0\}`],
      ["Projector texture matrix", String.raw`\mathbf M = \mathbf M_2\mathbf M_1,\quad e = \dfrac{1}{\tan(\alpha/2)},\quad (s, t) = \Big(\dfrac{s'}{q}, \dfrac{t'}{q}\Big)`],
      ["Cube map face", String.raw`\text{face} = \text{sign and axis of } \max(|x|,|y|,|z|),\quad s, t = \tfrac12 \pm \tfrac{\text{minor}}{2\,\text{major}}`],
      ["Bilinear filter (7.18)", String.raw`\mathcal T = (1-\alpha)(1-\beta)\mathcal T_{i,j} + \alpha(1-\beta)\mathcal T_{i+1,j} + (1-\alpha)\beta\mathcal T_{i,j+1} + \alpha\beta\mathcal T_{i+1,j+1}`],
      ["Mip level (7.20)", String.raw`\lambda = \log_2\max(\rho_x, \rho_y),\quad \rho_x = \sqrt{(\partial u/\partial x)^2 + (\partial v/\partial x)^2}`],
      ["Trilinear blend (7.21)", String.raw`\mathcal T = (1 - \operatorname{frac}\lambda)\mathcal T_1 + \operatorname{frac}(\lambda)\mathcal T_2`],
    ],

    exercises: [
      { q: String.raw`A \(4\times4\) texture is sampled bilinearly at \((s, t) = (0.375, 0.5)\). Which texels are used, and with what weights?`,
        a: String.raw`\(ws - \tfrac12 = 1\), \(ht - \tfrac12 = 1.5\). So \(i = 1, j = 1\), \(\alpha = 0\), \(\beta = 0.5\): half of \(\mathcal T_{1,1}\) plus half of \(\mathcal T_{1,2}\). The sample lies exactly on a column of texel centers, so only two texels contribute.` },
      { q: String.raw`Which cube map face and which \((s, t)\) does the direction \((0.5, -2, 1)\) sample?`,
        a: String.raw`\(|y| = 2\) is largest and \(y \lt 0\), so the \(-y\) face. \(s = \tfrac12 - \tfrac{0.5}{2\cdot(-2)} = 0.625\), \(t = \tfrac12 + \tfrac{1}{2\cdot(-2)} = 0.25\).` },
      { q: String.raw`A \(256\times256\) texture is drawn so that one pixel step moves 6 texels in \(x\) and 1.5 texels in \(y\). Which mip level does bilinear filtering use, and what does trilinear blend?`,
        a: String.raw`\(\lambda = \log_2 6 \approx 2.585\). Bilinear rounds to level 3 (\(32\times32\)). Trilinear blends level 2 (\(64\times64\), weight 0.415) with level 3 (weight 0.585).` },
      { q: "How much memory does a full mipmap chain add to a 1024 × 1024 RGBA8 texture (4 MB)?",
        a: String.raw`About one third: \(4\cdot\tfrac13 \approx 1.33\) MB, for a total of about 5.33 MB.` },
      { q: String.raw`A projector has apex angle \(90^\circ\) and a square image. A point is at \((x, y, z) = (1, -0.5, 2)\) in the projector's frame. What are \(s\) and \(t\)?`,
        a: String.raw`\(e = 1/\tan45^\circ = 1\). \(s = \tfrac12(1\cdot\tfrac12 + 1) = 0.75\), \(t = \tfrac12(1\cdot(-0.25) + 1) = 0.375\), with \(q = 2 \gt 0\), so the point is lit by the image.` },
    ],

    sims: [
      {
        title: "Filtering and mipmaps on a receding floor",
        help: String.raw`<p>A checkerboard floor stretches to the horizon. With <b>Nearest</b> the distant checks break up
          into noisy moiré (aliasing), and close up you can see blocky texels. <b>Bilinear</b> smooths the close texels
          but not the distance. <b>Mipmapped</b> picks a prefiltered level per pixel from \(\lambda\); tick the tint box
          to see the bands of levels. <b>Trilinear</b> blends neighboring levels so the bands fade into each other.
          Hover to read the derivatives and \(\lambda\) at a pixel.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const out = sim.readout(readout);
          const inv = () => pc.invalidate();
          const mode = sim.segmented(controls, {
            label: "Filtering", value: "near", onChange: inv,
            options: [["near", "Nearest"], ["bil", "Bilinear"], ["mip", "Mipmapped"], ["tri", "Trilinear"]],
          });
          const tint = sim.checkbox(controls, { label: "Tint each mip level a different color", value: false, onChange: inv });
          const camH = sim.slider(controls, { label: "Camera height", min: 0.2, max: 3, step: 0.05, value: 1, onInput: inv });
          const pitch = sim.slider(controls, { label: "Camera pitch (looking down)", min: 2, max: 60, step: 1, value: 12, unit: "°", onInput: inv });
          const rep = sim.slider(controls, { label: "Texture repeats per unit", min: 0.1, max: 1, step: 0.05, value: 0.25, onInput: inv });

          const SIZE = 64;
          const base = makeTex(SIZE, SIZE, (i, j) => (((i >> 3) + (j >> 3)) & 1 ? [0.93, 0.92, 0.86] : [0.16, 0.22, 0.36]));
          const mips = buildMips(base);
          const maxLevel = mips.length - 1;
          const tints = [[1, 1, 1], [1, 0.45, 0.45], [0.45, 1, 0.45], [0.45, 0.6, 1], [1, 1, 0.35], [1, 0.45, 1], [0.4, 1, 1]];
          const tinted = mips.map((m, k) => ({ w: m.w, h: m.h, data: m.data.map((x, i) => x * tints[k][i % 3]) }));
          let probe = null;

          // texture coordinates of the floor point under buffer pixel (px, py), or null for sky
          const uvAt = (px, py, W, H) => {
            const ph = rad(pitch.value), k = Math.tan(rad(30));
            const x = ((2 * (px + 0.5)) / W - 1) * k * (W / H), y = (1 - (2 * (py + 0.5)) / H) * k;
            const dy = -Math.sin(ph) + Math.cos(ph) * y, dz = -Math.cos(ph) - Math.sin(ph) * y;
            if (dy >= -1e-6) return null;
            const t = camH.value / -dy;
            return [x * t * rep.value, -dz * t * rep.value];
          };
          const sample = (px, py, W, H, outc) => {
            const st = uvAt(px, py, W, H);
            if (!st) return null;
            const sx = uvAt(px + 1, py, W, H), sy = uvAt(px, py + 1, W, H);
            let rhoX = SIZE, rhoY = SIZE, d = [0, 0, 0, 0];
            if (sx && sy) {
              d = [(sx[0] - st[0]) * SIZE, (sx[1] - st[1]) * SIZE, (sy[0] - st[0]) * SIZE, (sy[1] - st[1]) * SIZE];
              rhoX = Math.hypot(d[0], d[1]);
              rhoY = Math.hypot(d[2], d[3]);
            }
            const lambda = Math.log2(Math.max(rhoX, rhoY, 1e-6));
            const levels = tint.value ? tinted : mips;
            let info;
            if (mode.value === "near") { sampleNearest(levels[0], st[0], st[1], outc); info = "level 0, nearest texel"; }
            else if (mode.value === "bil") { sampleBilinear(levels[0], st[0], st[1], outc); info = "level 0, bilinear"; }
            else if (mode.value === "mip") {
              const k = clamp(Math.round(lambda), 0, maxLevel);
              sampleBilinear(levels[k], st[0], st[1], outc);
              info = `level ${k} (${levels[k].w}×${levels[k].h}), bilinear`;
            } else {
              const l = clamp(lambda, 0, maxLevel), k = Math.min(Math.floor(l), maxLevel), f = l - k;
              sampleBilinear(levels[k], st[0], st[1], outc);
              if (k < maxLevel && f > 0) {
                const c2 = sampleBilinear(levels[k + 1], st[0], st[1], [0, 0, 0]);
                for (let c = 0; c < 3; c++) outc[c] = (1 - f) * outc[c] + f * c2[c];
              }
              info = k < maxLevel ? `levels ${k} and ${k + 1}, weights ${fmt(1 - f)} / ${fmt(f)}` : `level ${k}`;
            }
            return { st, d, rhoX, rhoY, lambda, info };
          };

          const pc = pixelCanvas(sim, stage, {
            height: 140, canvasHeight: 400, fill: true, maxWidth: 320,
            render(pc) {
              const W = pc.width, H = pc.height, bg = rgb(sim.color("bg")), c = [0, 0, 0];
              for (let y = 0; y < H; y++)
                for (let x = 0; x < W; x++) {
                  if (sample(x, y, W, H, c)) pc.set(x, y, c[0], c[1], c[2]);
                  else pc.set(x, y, bg[0], bg[1], bg[2]);
                }
            },
            overlay(c, pc) {
              if (probe) drawProbe(c, pc, probe[0], probe[1], "e");
              c.label(c.w - 10, c.h - 10, "hover to probe", { color: "muted", size: 11, align: "right" });
              update();
            },
          });
          pointer(sim, pc, {
            onHover(x, y) { probe = [x, y]; pc.redraw(); },
            onDrag(x, y) { probe = [x, y]; pc.redraw(); },
          });

          function update() {
            const W = pc.width, H = pc.height;
            const p = probe || [W / 2, H * 0.45];
            const r = sample(Math.floor(p[0]), Math.floor(p[1]), W, H, [0, 0, 0]);
            if (!r) { out.set("The probe is above the horizon. Move it onto the floor."); return; }
            out.set(sim.rows([
              ["(s, t)", fmtVec(r.st)],
              ["∂u/∂x, ∂v/∂x", fmt(r.d[0]) + ", " + fmt(r.d[1])],
              ["∂u/∂y, ∂v/∂y", fmt(r.d[2]) + ", " + fmt(r.d[3])],
              ["ρx", fmt(r.rhoX)],
              ["ρy", fmt(r.rhoY)],
              ["λ = log₂ max(ρx, ρy)", fmt(r.lambda)],
            ]) + `<hr>Sampling: ${r.info}.<br>${r.lambda < 0 ? "λ &lt; 0: magnification (a texel covers several pixels)." : `Each pixel step crosses about ${fmt(Math.pow(2, r.lambda), 1)} texels.`}`);
          }
        },
      },
      {
        title: "Projective texture: a slide projector",
        help: String.raw`<p>A spot light at \(\mathbf P\) projects an image with the texture matrix
          \(\mathbf M = \mathbf M_2\mathbf M_1\). Move and aim the projector and change its apex angle \(\alpha\). Hover to
          see the homogeneous coordinates \((s', t', 0, q)\) of a point and the division by \(q\). Untick the
          <b>reject</b> box to see the mirrored "reverse projection" appear on the floor behind the projector, and notice
          that the image also reaches the wall behind the sphere: the texture matrix knows nothing about occlusion.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const out = sim.readout(readout);
          const inv = () => pc.invalidate();
          const alpha = sim.slider(controls, { label: "Apex angle α", min: 10, max: 120, step: 1, value: 50, unit: "°", onInput: inv });
          const gp = sim.group(controls, "Projector");
          const ppx = sim.slider(gp, { label: "position x", min: -3, max: 3, step: 0.1, value: -1.8, onInput: inv });
          const ppy = sim.slider(gp, { label: "height", min: 0.5, max: 4, step: 0.1, value: 2.4, onInput: inv });
          const aimx = sim.slider(gp, { label: "aim x (on the wall)", min: -3.5, max: 3.5, step: 0.1, value: 0.3, onInput: inv });
          const aimy = sim.slider(gp, { label: "aim y (on the wall)", min: -1, max: 3.5, step: 0.1, value: 1.1, onInput: inv });
          const reject = sim.checkbox(controls, { label: "Reject points with q ≤ 0 (behind the projector)", value: true, onChange: inv });
          const PZ = 3.2, WALL = -3;
          const ball = { c: [1.4, 0.7, -1.3], r: 0.7 };
          const img = makeTex(32, 32, (i, j) => {
            const s = (i + 0.5) / 32, t = (j + 0.5) / 32;
            if (i === 0 || j === 0 || i === 31 || j === 31) return [1, 1, 1];
            if (Math.abs(Math.hypot(s - 0.5, t - 0.5) - 0.27) < 0.035) return [1, 1, 1];
            return s < 0.5 ? (t > 0.5 ? [1, 0.25, 0.2] : [0.25, 0.4, 1]) : (t > 0.5 ? [0.3, 1, 0.35] : [1, 0.9, 0.2]);
          });
          const cam = makeCamera([0, 2.6, 8], [0, 1.2, -1.5], 52);
          const FILL = n3(0.3, 0.8, 0.5);
          let probe = null;

          const frame = () => {
            const P = [ppx.value, ppy.value, PZ];
            const Z = V.norm(V.sub([aimx.value, aimy.value, WALL], P));
            const S = V.norm(V.cross(Z, [0, 1, 0]));
            const T = V.cross(S, Z);
            const M1 = [[...S, -V.dot(S, P)], [...T, -V.dot(T, P)], [...Z, -V.dot(Z, P)], [0, 0, 0, 1]];
            const e = 1 / Math.tan(rad(alpha.value) / 2), a = 1;
            const M2 = [[e / 2, 0, 0.5, 0], [0, e / (2 * a), 0.5, 0], [0, 0, 0, 0], [0, 0, 1, 0]];
            return { P, S, T, Z, e, M: M.mul(M2, M1) };
          };
          const trace = (o, d) => {
            let best = Infinity, hit = null;
            if (d[1] < 0) {
              const t = -o[1] / d[1], x = o[0] + t * d[0], z = o[2] + t * d[2];
              if (Math.abs(x) < 9 && z > WALL && z < 9) { best = t; hit = { P: [x, 0, z], N: [0, 1, 0], col: [0.78, 0.78, 0.76], name: "floor" }; }
            }
            if (d[2] < 0) {
              const t = (WALL - o[2]) / d[2], x = o[0] + t * d[0], y = o[1] + t * d[1];
              if (t < best && Math.abs(x) < 9 && y >= 0 && y < 4.5) { best = t; hit = { P: [x, y, WALL], N: [0, 0, 1], col: [0.72, 0.72, 0.75], name: "wall" }; }
            }
            const t = hitSphere(o, d, ball.c, ball.r);
            if (t < best) { const P = V.add(o, V.scale(d, t)); hit = { P, N: V.scale(V.sub(P, ball.c), 1 / ball.r), col: [0.85, 0.85, 0.85], name: "sphere" }; }
            return hit;
          };
          const shade = (hit, F) => {
            const h = M.mulVec(F.M, [...hit.P, 1]);
            const q = h[3];
            let s = NaN, t = NaN, tex = null;
            if (Math.abs(q) > 1e-6 && (q > 0 || !reject.value)) {
              s = h[0] / q; t = h[1] / q;
              if (s >= 0 && s <= 1 && t >= 0 && t <= 1) tex = sampleBilinear(img, s, t, [0, 0, 0]);
            }
            const L = V.norm(V.sub(F.P, hit.P));
            const nl = Math.max(V.dot(hit.N, L), 0);
            const fill = 0.1 + 0.25 * Math.max(V.dot(hit.N, FILL), 0); // dim room light so the scene is visible
            const K = hit.col.map((c, k) => c * (fill + (tex ? 1.4 * tex[k] * nl : 0)));
            return { h, q, s, t, tex, K };
          };

          const pc = pixelCanvas(sim, stage, {
            height: 140, canvasHeight: 400, fill: true, maxWidth: 320,
            render(pc) {
              const W = pc.width, H = pc.height, bg = rgb(sim.color("bg")), F = frame();
              for (let y = 0; y < H; y++)
                for (let x = 0; x < W; x++) {
                  const hit = trace(cam.eye, cam.ray(x, y, W, H));
                  if (!hit) { pc.set(x, y, bg[0], bg[1], bg[2]); continue; }
                  const K = shade(hit, F).K;
                  pc.set(x, y, K[0], K[1], K[2]);
                }
            },
            overlay(c, pc) {
              const W = pc.width, H = pc.height, F = frame();
              const toC = (P) => { const s = cam.project(P, W, H); return s && pc.toCanvas(s[0], s[1]); };
              const ctx = c.ctx;
              const p0 = toC(F.P);
              const k = Math.tan(rad(alpha.value) / 2);
              ctx.strokeStyle = c.sim.color("g");
              ctx.lineWidth = 1.2;
              ctx.setLineDash([4, 4]);
              for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                const dir = V.add(F.Z, V.add(V.scale(F.S, a * k), V.scale(F.T, b * k)));
                const q = toC(V.add(F.P, V.scale(dir, 1.6)));
                if (p0 && q) { ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
              }
              ctx.setLineDash([]);
              const aim = toC([aimx.value, aimy.value, WALL]);
              if (p0 && aim) {
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(aim[0], aim[1]); ctx.stroke();
              }
              if (p0) {
                ctx.fillStyle = "#ffd75e";
                ctx.strokeStyle = c.sim.color("fg");
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(p0[0], p0[1], 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                c.label(p0[0] + 10, p0[1] - 8, "P", { color: "fg", weight: 700 });
              }
              if (probe) drawProbe(c, pc, probe[0], probe[1]);
              update();
            },
          });
          pointer(sim, pc, {
            onHover(x, y) { probe = [x, y]; pc.redraw(); },
            onDrag(x, y) { probe = [x, y]; pc.redraw(); },
          });

          function update() {
            const W = pc.width, H = pc.height, F = frame();
            const p = probe || [W * 0.5, H * 0.32];
            const hit = trace(cam.eye, cam.ray(Math.floor(p[0]), Math.floor(p[1]), W, H));
            let html = "";
            if (!hit) html = "The probe is not on a surface.";
            else {
              const r = shade(hit, F);
              html = sim.rows([
                ["surface", hit.name],
                ["Q", fmtVec(hit.P)],
                ["M Q = (s′, t′, 0, q)", fmtVec([r.h[0], r.h[1], 0, r.h[3]])],
                ["(s, t) = (s′/q, t′/q)", Number.isFinite(r.s) ? fmtVec([r.s, r.t]) : "—"],
                ["texel", r.tex ? colSwatch(r.tex) + fmtCol(r.tex) : "outside the image"],
              ]) + `<hr>${r.q <= 0 ? "<b class='bad'>q ≤ 0:</b> this point is behind the projector." : "q > 0: the point is in front of the projector."}`;
            }
            out.set(html + `<hr>e = 1 / tan(α/2) = ${fmt(F.e, 3)}<br>Texture matrix M = M₂M₁:` + fmtMat(F.M));
          }
        },
      },
      {
        title: "Cube map face selection",
        help: String.raw`<p>Aim the direction vector with the sliders (drag the 3D view to orbit). The face is chosen by
          the largest absolute coordinate; the other two are divided by it and mapped to \([0,1]\) using Table 7.1. The
          unfolded cube below shows where the sample lands on that face, with \(s\) to the right and \(t\) down on every
          face, the layout used by OpenGL cube maps viewed from the inside.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const out = sim.readout(readout);
          const v3 = sim.view3d(stage, { height: 320, distance: 5.2, yaw: -0.55, pitch: 0.45 });
          const v2 = sim.view2d(stage, { range: 1.7, center: [2, -1.5], height: 250 });
          const redraw = () => { v3.redraw(); v2.redraw(); };
          const yaw = sim.slider(controls, { label: "Direction heading", min: -180, max: 180, step: 1, value: 30, unit: "°", onInput: redraw });
          const pit = sim.slider(controls, { label: "Direction elevation", min: -89, max: 89, step: 1, value: 20, unit: "°", onInput: redraw });
          sim.buttons(controls, [
            { label: "Random direction", onClick: () => { yaw.value = Math.round(Math.random() * 360 - 180); pit.value = Math.round(Math.random() * 170 - 85); redraw(); } },
            { label: "Toward a corner", onClick: () => { yaw.value = 45; pit.value = 35; redraw(); } },
          ]);
          const dir = () => {
            const a = rad(yaw.value), e = rad(pit.value);
            return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
          };
          const faceCorners = (f, k = 1) => {
            const b = (f.axis + 1) % 3, c = (f.axis + 2) % 3;
            return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, w]) => {
              const p = [0, 0, 0];
              p[f.axis] = f.sign * k; p[b] = u * k; p[c] = w * k;
              return p;
            });
          };

          v3.onDraw((v) => {
            const d = dir(), r = cubeLookup(d);
            CUBE_FACES.forEach((f, i) => {
              const on = i === r.face;
              v.poly(faceCorners(f), { fill: f.color, alpha: on ? 0.42 : 0.08, color: f.color, width: on ? 2 : 1 });
              const ctr = [0, 0, 0];
              ctr[f.axis] = f.sign * 1.18;
              v.text(ctr, f.name, { color: f.color, size: 12, weight: 700 });
            });
            const hitP = V.scale(d, 1 / r.ma);
            v.arrow([0, 0, 0], V.scale(d, 2.2), { color: "g", width: 3, label: "d", overlay: true });
            v.point(hitP, { color: "fg", r: 5, overlay: true });
          });

          v2.onDraw((v) => {
            const d = dir(), r = cubeLookup(d);
            CUBE_FACES.forEach((f, i) => {
              const [col, row] = f.cell, on = i === r.face;
              v.rect([col, -row - 1], [col + 1, -row], { fill: f.color, fillAlpha: on ? 0.35 : 0.08, color: f.color, width: on ? 2.5 : 1 });
              v.text([col + 0.5, -row - 0.5], f.name, { color: f.color, size: 14, align: "center", offset: [0, 5] });
              v.arrow([col + 0.07, -row - 0.07], [col + 0.32, -row - 0.07], { color: "muted", width: 1.2, head: 6 });
              v.arrow([col + 0.07, -row - 0.07], [col + 0.07, -row - 0.32], { color: "muted", width: 1.2, head: 6 });
              v.text([col + 0.35, -row - 0.07], "s", { color: "muted", size: 10, offset: [2, 4] });
              v.text([col + 0.07, -row - 0.35], "t", { color: "muted", size: 10, offset: [-3, 10] });
            });
            const f = CUBE_FACES[r.face];
            const P = [f.cell[0] + r.s, -(f.cell[1] + r.t)];
            v.point(P, { color: "fg", r: 6 });
            v.text(P, `(${fmt(r.s)}, ${fmt(r.t)})`, { color: "fg", size: 12, offset: [8, -8] });

            const names = ["x", "y", "z"];
            const axis = f.axis;
            const enc = V.norm(d).map((x) => (x + 1) / 2);
            out.set(sim.rows([
              [sim.swatch("g") + "direction d", fmtVec(d)],
              ["|x|, |y|, |z|", fmtVec(d.map(Math.abs))],
              ["major axis", `${f.sign > 0 ? "+" : "−"}${names[axis]} → face <b>${f.name}</b>`],
              ["s_c, t_c (minor coords)", fmt(r.sc, 3) + ", " + fmt(r.tc, 3)],
              ["m_a = |major|", fmt(r.ma, 3)],
              ["s = ½ + s_c / (2 m_a)", fmt(r.s, 3)],
              ["t = ½ + t_c / (2 m_a)", fmt(r.t, 3)],
              ["normalization-map texel", colSwatch(enc) + fmtCol(enc)],
            ]) + "<hr>Only the ratios matter: scaling d by any positive number selects the same texel.");
          });
        },
      },
    ],

    cpp: [
      {
        title: "Bilinear texture sample",
        formula: String.raw`i = \lfloor ws - \tfrac12\rfloor,\ \alpha = \operatorname{frac}(ws - \tfrac12),\quad \mathcal T = (1-\alpha)(1-\beta)\mathcal T_{i,j} + \alpha(1-\beta)\mathcal T_{i+1,j} + (1-\alpha)\beta\mathcal T_{i,j+1} + \alpha\beta\mathcal T_{i+1,j+1}`,
        code: String.raw`
          struct Texture2D
          {
              int             width, height;
              const ColorRGB* texels;                       // row j runs along t

              const ColorRGB& Texel(int i, int j) const     // repeat (wrap) addressing
              {
                  i %= width;  if (i < 0) i += width;
                  j %= height; if (j < 0) j += height;
                  return texels[j * width + i];
              }
          };

          ColorRGB SampleBilinear(const Texture2D& tex, float s, float t)
          {
              float x = tex.width * s - 0.5f, y = tex.height * t - 0.5f;
              float fx = std::floor(x), fy = std::floor(y);
              int i = static_cast<int>(fx), j = static_cast<int>(fy);      // (7.17)
              float alpha = x - fx, beta = y - fy;                         // fractional parts

              return tex.Texel(i, j)         * ((1.0f - alpha) * (1.0f - beta))     // (7.18)
                   + tex.Texel(i + 1, j)     * (alpha * (1.0f - beta))
                   + tex.Texel(i, j + 1)     * ((1.0f - alpha) * beta)
                   + tex.Texel(i + 1, j + 1) * (alpha * beta);
          }
        `,
      },
      {
        title: "Mip level and trilinear filtering",
        formula: String.raw`\lambda = \log_2\max(\rho_x, \rho_y) \qquad \mathcal T = (1-\operatorname{frac}\lambda)\,\mathcal T_1 + \operatorname{frac}(\lambda)\,\mathcal T_2`,
        note: "<p>The derivatives of <i>s</i> and <i>t</i> with respect to the screen coordinates are what the GPU estimates from neighboring pixels. <code>mip[0]</code> is the full-size image.</p>",
        code: String.raw`
          float MipLevel(float dsdx, float dtdx, float dsdy, float dtdy, int width, int height)
          {
              float dudx = dsdx * width, dvdx = dtdx * height;      // u = 2^n s, v = 2^m t
              float dudy = dsdy * width, dvdy = dtdy * height;
              float rhoX = std::sqrt(dudx * dudx + dvdx * dvdx);
              float rhoY = std::sqrt(dudy * dudy + dvdy * dvdy);
              return std::log2(std::fmax(rhoX, rhoY));               // lambda
          }

          ColorRGB SampleTrilinear(const Texture2D* mip, int levelCount, float s, float t, float lambda)
          {
              lambda = Clamp(lambda, 0.0f, static_cast<float>(levelCount - 1));
              int k = static_cast<int>(lambda);
              float f = lambda - static_cast<float>(k);              // frac(lambda)

              ColorRGB t1 = SampleBilinear(mip[k], s, t);
              if (k + 1 >= levelCount) return t1;                     // already the 1x1 level
              ColorRGB t2 = SampleBilinear(mip[k + 1], s, t);
              return t1 * (1.0f - f) + t2 * f;                        // (7.21)
          }
        `,
      },
      {
        title: "Cube map face selection",
        formula: String.raw`\text{face} = \arg\max(|x|, |y|, |z|),\qquad s = \tfrac12 + \tfrac{s_c}{2m_a},\quad t = \tfrac12 + \tfrac{t_c}{2m_a}`,
        note: "<p>The pairs (s<sub>c</sub>, t<sub>c</sub>) chosen for each face reproduce Table 7.1 exactly.</p>",
        code: String.raw`
          struct CubeLookup
          {
              int   face;        // 0..5 = +x, -x, +y, -y, +z, -z
              float s, t;
          };

          CubeLookup SelectCubeFace(const Vector3D& d)
          {
              float ax = std::fabs(d.x), ay = std::fabs(d.y), az = std::fabs(d.z);
              CubeLookup r;
              float sc, tc, ma;
              if (ax >= ay && ax >= az)          // x is the major axis
              {
                  ma = ax;  r.face = (d.x > 0.0f) ? 0 : 1;
                  sc = (d.x > 0.0f) ? -d.z : d.z;   tc = -d.y;
              }
              else if (ay >= az)                 // y is the major axis
              {
                  ma = ay;  r.face = (d.y > 0.0f) ? 2 : 3;
                  sc = d.x;   tc = (d.y > 0.0f) ? d.z : -d.z;
              }
              else                               // z is the major axis
              {
                  ma = az;  r.face = (d.z > 0.0f) ? 4 : 5;
                  sc = (d.z > 0.0f) ? d.x : -d.x;   tc = -d.y;
              }
              r.s = 0.5f + 0.5f * sc / ma;       // [-1, 1] -> [0, 1]
              r.t = 0.5f + 0.5f * tc / ma;
              return r;
          }
        `,
      },
      {
        title: "Texture matrix for a projector",
        formula: String.raw`\mathbf M = \mathbf M_2\mathbf M_1,\qquad e = \frac{1}{\tan(\alpha/2)},\qquad (s, t) = (s'/q,\; t'/q)`,
        code: String.raw`
          // S, T, Z: unit axes of the projector (image s axis, image t axis, aim direction).
          Matrix4D ProjectorTextureMatrix(const Point3D& P, const Vector3D& S, const Vector3D& T,
                                          const Vector3D& Z, float apexAngle, float aspect /* h / w */)
          {
              Matrix4D m1(S.x, S.y, S.z, -Dot(S, P),            // (7.13) world -> projector frame
                          T.x, T.y, T.z, -Dot(T, P),
                          Z.x, Z.y, Z.z, -Dot(Z, P),
                          0.0f, 0.0f, 0.0f, 1.0f);

              float e = 1.0f / std::tan(apexAngle * 0.5f);      // (7.14) focal length
              Matrix4D m2(e * 0.5f, 0.0f, 0.5f, 0.0f,          // (7.15)
                          0.0f, e / (2.0f * aspect), 0.5f, 0.0f,
                          0.0f, 0.0f, 0.0f, 0.0f,
                          0.0f, 0.0f, 1.0f, 0.0f);
              return m2 * m1;
          }

          bool ProjectedTexCoord(const Matrix4D& m, const Point3D& q, float& s, float& t)
          {
              Vector4D h = m * Vector4D(q, 1.0f);              // (s', t', 0, q)
              if (h.w <= 0.0f) return false;                    // behind the projector
              s = h.x / h.w;
              t = h.y / h.w;
              return s >= 0.0f && s <= 1.0f && t >= 0.0f && t <= 1.0f;
          }
        `,
      },
      {
        title: "Perspective-correct texture coordinate",
        formula: String.raw`s = \frac{(1-u)\,s_1/z_1 + u\,s_2/z_2}{(1-u)\,q_1/z_1 + u\,q_2/z_2}`,
        note: "<p>Equation 7.12: <i>s/z</i> and <i>q/z</i> vary linearly across the screen, while <i>s</i> itself does not. With <i>q</i> = 1 at both ends this is ordinary perspective-correct interpolation.</p>",
        code: String.raw`
          float InterpolateProjectedS(float s1, float q1, float z1,      // left end of the scanline
                                      float s2, float q2, float z2,      // right end
                                      float u)                           // 0..1 along the scanline
          {
              float num = (1.0f - u) * (s1 / z1) + u * (s2 / z2);        // interpolated s3 (over z)
              float den = (1.0f - u) * (q1 / z1) + u * (q2 / z2);        // interpolated q3 (over z)
              return num / den;                                          // s = s3 / q3
          }
        `,
      },
    ],
  });
})();
