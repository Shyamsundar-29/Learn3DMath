// Chapter 9 - Polygonal Techniques
(function () {
  "use strict";
  const { V, fmt, fmtVec, rad, deg, clamp, lerp, smoothstep } = L3D.math;

  // ===========================================================================
  // Shared helpers
  // ===========================================================================

  // Small deterministic random number generator (mulberry32), so layouts are repeatable.
  function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Tiny numbers are easier to read in scientific notation.
  function fmtSci(x, digits = 2) {
    if (!Number.isFinite(x)) return fmt(x);
    const a = Math.abs(x);
    if (a === 0) return "0";
    if (a >= 0.01 && a < 1e4) return fmt(x, a >= 100 ? 1 : 4);
    return x.toExponential(digits).replace("e", "×10^").replace("^+", "^");
  }

  // K . (P, 1) for a plane K = [n..., D] in 2D ([nx, ny, D]) or 3D ([nx, ny, nz, D]).
  function planeDot(k, p) {
    let s = k[k.length - 1];
    for (let i = 0; i < p.length; i++) s += k[i] * p[i];
    return s;
  }

  // Interpolate every array-valued attribute (position p, normal n, ...) of a vertex object.
  function lerpVertex(a, b, t) {
    const out = {};
    for (const key in a) out[key] = Array.isArray(a[key]) ? V.lerp(a[key], b[key], t) : a[key];
    return out;
  }

  // Clip a convex polygon (array of vertex objects with a position .p) to the positive side of plane K.
  // New vertices W = V1 + t (V2 - V1) with t = K.V1 / K.(V1 - V2)   (Equations 9.16, 9.17).
  function clipPolygon(poly, k) {
    if (!poly.length) return [];
    const dist = poly.map((v) => planeDot(k, v.p));
    if (dist.every((d) => d < 0)) return [];
    if (dist.every((d) => d >= 0)) return poly.slice();
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      const da = dist[i], db = dist[j];
      if (da >= 0) out.push(poly[i]);
      if ((da >= 0) !== (db >= 0)) {
        const w = lerpVertex(poly[i], poly[j], da / (da - db));
        w.created = true;
        out.push(w);
      }
    }
    return out;
  }

  // 2D triangle tests with N0 = +z, so N0 x e = perp2(e) and N_i . (Q - P_i) = cross2(e_i, Q - P_i).
  function edgeTests(q, a, b, c) {
    return [V.cross2(V.sub(b, a), V.sub(q, a)), V.cross2(V.sub(c, b), V.sub(q, b)), V.cross2(V.sub(a, c), V.sub(q, c))];
  }
  const pointInTri = (q, a, b, c, eps = 0) => edgeTests(q, a, b, c).every((x) => x > -eps);

  function pointInPolygon(q, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  // Simple ear clipping of a counterclockwise 2D polygon. Returns index triples.
  function earClip(pts, eps = 1e-9) {
    const idx = pts.map((_, i) => i);
    const tris = [];
    let guard = 0;
    while (idx.length > 3 && guard++ < 2000) {
      let clipped = false;
      for (let k = 0; k < idx.length; k++) {
        const a = idx[(k + idx.length - 1) % idx.length], b = idx[k], c = idx[(k + 1) % idx.length];
        if (V.cross2(V.sub(pts[b], pts[a]), V.sub(pts[c], pts[a])) <= eps) continue;   // reflex or degenerate
        let blocked = false;
        for (const j of idx) {
          if (j === a || j === b || j === c) continue;
          if (pointInTri(pts[j], pts[a], pts[b], pts[c], eps)) { blocked = true; break; }
        }
        if (blocked) continue;
        tris.push([a, b, c]);
        idx.splice(k, 1);
        clipped = true;
        break;
      }
      if (!clipped) break;
    }
    if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
    return tris;
  }

  const centroid = (pts) => V.scale(pts.reduce((s, p) => V.add(s, p), pts[0].map(() => 0)), 1 / pts.length);

  // ===========================================================================
  // 9.1 Depth Value Offset
  // ===========================================================================
  L3D.topic({
    id: "9.1",
    summary: "Pull a decal slightly toward the camera by scaling one entry of the projection matrix, and choose the offset from the depth buffer's precision.",

    lesson: String.raw`
      <p>Games constantly add surface details at run time: scorch marks where a rocket hit, bullet holes, blood
      splats, footprints, tire tracks. Each of these is a <strong>decal</strong>, a small mesh lying exactly on an
      existing surface (Section 9.2 shows how to build one). Because the decal is coplanar with the surface under it,
      both polygons produce almost the same depth at every pixel. "Almost" is the problem. The two polygons have
      different vertices, so round-off makes their interpolated depths differ by tiny amounts that change sign across
      the surface. The depth test then picks a winner pixel by pixel, and the surface shows through the decal in
      stripes and speckles. This is called <strong>z-fighting</strong>.</p>

      <p>The cure is to nudge the decal's depth toward the camera by a small amount <em>without</em> moving it on
      screen and without disturbing its perspective-correct texture mapping. Graphics APIs have a polygon offset state
      for this, but its units depend on the hardware and it is hard to control precisely. The book's alternative
      changes a single entry of the projection matrix.</p>

      <h2 data-sub="9.1.1">Projection Matrix Modification</h2>
      <p>Take the OpenGL perspective projection for a frustum centered on the \(z\) axis, with focal length \(e\),
      aspect ratio \(a\), near distance \(n\) and far distance \(f\) (Section 5.5). Applied to a camera-space point
      \(\mathbf P = (P_x, P_y, P_z, 1)\) it gives
      \[ \begin{bmatrix} e & 0 & 0 & 0 \\ 0 & e/a & 0 & 0 \\ 0 & 0 & -\frac{f+n}{f-n} & -\frac{2fn}{f-n} \\ 0 & 0 & -1 & 0 \end{bmatrix}
         \begin{bmatrix} P_x \\ P_y \\ P_z \\ 1 \end{bmatrix} =
         \begin{bmatrix} eP_x \\ (e/a)P_y \\ -\frac{f+n}{f-n}P_z - \frac{2fn}{f-n} \\ -P_z \end{bmatrix}, \]
      and after the divide by \(w = -P_z\) the projected depth is
      \[ z_{\text{ndc}} = \frac{f+n}{f-n} + \frac{2fn}{(f-n)P_z}. \]</p>
      <p>The screen position comes from the first two rows divided by \(w\). As long as the fourth row, which produces
      \(w = -P_z\), is left alone, the polygon lands on exactly the same pixels, and perspective-correct interpolation
      (which also uses \(w\)) is unchanged. Only the lower-right \(2\times2\) block affects depth.</p>
      <p>Now multiply the (3,3) entry by \(1+\varepsilon\) for some small \(\varepsilon\):</p>
      <div class="formula">\[ z'_{\text{ndc}} = (1+\varepsilon)\frac{f+n}{f-n} + \frac{2fn}{(f-n)P_z} = z_{\text{ndc}} + \varepsilon\,\frac{f+n}{f-n} \]</div>
      <p>Every depth shifts by the <em>same</em> constant \(\varepsilon(f+n)/(f-n)\) in normalized device coordinates,
      whatever its distance. A negative \(\varepsilon\) pulls geometry toward the camera, which is what a decal needs.</p>

      <h2 data-sub="9.1.2">Offset Value Selection</h2>
      <p>A constant shift in NDC is <em>not</em> a constant shift in camera space. Because \(z_{\text{ndc}}\) depends on
      \(1/P_z\), depth values are packed densely near the camera and sparsely far away, so the same \(\varepsilon\) moves a
      distant object much farther (in meters) than a nearby one. No single value is right everywhere. Instead we pick
      \(\varepsilon\) for the case at hand: a camera-space offset \(\delta\) (how far toward the camera to move) at a
      representative depth \(P_z\), such as the depth of the decal's center.</p>
      <p>Moving a point to \(P_z + \delta\) with the <em>unmodified</em> matrix gives
      \[ z_{\text{ndc}} = \frac{f+n}{f-n} + \frac{2fn}{(f-n)(P_z+\delta)}. \]
      Setting this equal to the shifted depth produced by the modified matrix and solving for \(\varepsilon\):</p>
      <div class="formula">\[ \varepsilon = -\frac{2fn}{f+n}\left(\frac{\delta}{P_z(P_z+\delta)}\right) \]</div>
      <p>\(P_z\) is negative for anything in front of the camera and \(\delta \gt 0\) means "toward the camera", so
      \(\varepsilon\) comes out negative.</p>

      <p>There is also a lower limit. An \(m\)-bit integer depth buffer divides the NDC range \([-1, 1]\) into
      \(2^m - 1\) steps, so an offset smaller than one step changes nothing:
      \[ |\varepsilon|\,\frac{f+n}{f-n} \ge \frac{2}{2^m-1}. \]
      Substituting the formula for \(\varepsilon\) and solving for \(\delta\) gives the smallest offset toward the camera
      that has any effect, and the largest (most negative) useful offset away from it:</p>
      <div class="formula">\[ \delta \ge \frac{kP_z^2}{1-kP_z} \qquad\text{or}\qquad \delta \le \frac{-kP_z^2}{1+kP_z}, \qquad\text{where } k = \frac{f-n}{fn\,(2^m-1)} \]</div>
      <p>Both grow roughly like \(P_z^2\). With \(n = 1\), \(f = 100\) and a 16-bit buffer, one depth step is about
      0.0015 cm at a distance of 1 m, about 6 mm at 20 m, and about 15 cm at 100 m. The near plane matters most: pushing
      \(n\) out improves precision everywhere.</p>
      <div class="warn">Don't overdo it. The offset applies to the whole decal, so if \(\delta\) is larger than the
      thickness of something lying on the surface (a plank, a thin wall, a character's foot), the decal shows
      <em>through</em> it. Use the smallest offset that reliably beats z-fighting at the depths where decals appear.</div>

      <h2 data-sub="9.1.3">Implementation</h2>
      <p>The engine builds its ordinary projection matrix, then a second copy for decals in which entry (3,3), the
      \(z\) row and \(z\) column, is multiplied by \(1+\varepsilon\). It draws the scene with the first matrix and
      switches to the second for the decal pass.</p>
      <ul>
        <li>Inputs: the six frustum values (left, right, bottom, top, near, far), plus \(\delta\) and \(P_z\).</li>
        <li>Compute \(\varepsilon\) with the formula above and scale one matrix entry. With a column-major array of 16
          floats that entry is element 10; in this site's <code>Matrix4D</code> it is <code>m(2,2)</code>.</li>
        <li>Since \(x\), \(y\) and \(w\) are untouched, the decal covers exactly the same pixels with exactly the same
          texture coordinates as without the offset.</li>
      </ul>
      <div class="game">Because only one matrix entry changes, the offset costs nothing per vertex, works with any shader,
      and is easy to tune per object: a far-away decal can be given its own \(\delta\) and \(P_z\). Engines use the same
      trick for other coplanar overlays, such as selection outlines and wireframe drawn over shaded geometry.</div>
      <div class="note">This derivation assumes OpenGL's NDC depth range \([-1, 1]\). With a \([0, 1]\) range
      (Direct3D, Vulkan) or a reversed-Z buffer the matrix entries differ, but the idea is the same: scale the entry that
      multiplies \(P_z\) in the depth row, leave the \(w\) row alone, and re-derive \(\varepsilon\) for that convention.</div>

      <p><a class="btn goto-sim" href="#/9.1/sim">Try it: z-fighting and the depth offset →</a></p>
    `,

    keyFormulas: [
      ["Projected depth", String.raw`z_{\text{ndc}} = \frac{f+n}{f-n} + \frac{2fn}{(f-n)P_z}`],
      ["Offset by scaling entry (3,3)", String.raw`(1+\varepsilon)\frac{f+n}{f-n} + \frac{2fn}{(f-n)P_z} = z_{\text{ndc}} + \varepsilon\frac{f+n}{f-n}`],
      ["Epsilon for a camera-space offset", String.raw`\varepsilon = -\frac{2fn}{f+n}\left(\frac{\delta}{P_z(P_z+\delta)}\right)`],
      ["Smallest useful offset (m-bit buffer)", String.raw`\delta \ge \frac{kP_z^2}{1-kP_z},\quad k = \frac{f-n}{fn(2^m-1)}`],
    ],

    exercises: [
      { q: String.raw`The near plane is at \(n = 1\) and the far plane at \(f = 100\). By what value should entry (3,3) of the projection matrix be multiplied to move a model centered at depth \(z = -20\) toward the camera by 0.2?`,
        a: String.raw`\(\varepsilon = -\dfrac{2\cdot100\cdot1\cdot0.2}{101\cdot(-20)(-19.8)} = -\dfrac{40}{39996} \approx -0.0010001\), so multiply by \(1+\varepsilon \approx 0.9990\).` },
      { q: "With the same frustum and a 16-bit depth buffer, what is the smallest offset toward the camera that has any effect on the model at z = −20?",
        a: String.raw`\(k = \dfrac{99}{100\cdot65535} \approx 1.511\times10^{-5}\), so \(\delta \ge \dfrac{kP_z^2}{1-kP_z} = \dfrac{0.006042}{1.0003} \approx 0.0060\), about 6 mm.` },
      { q: "Why does scaling entry (3,3) not move the decal on the screen?",
        a: String.raw`The screen position is \((x/w, y/w)\). Rows 1, 2 and 4 of the matrix are unchanged, so \(x\), \(y\) and \(w = -P_z\) are unchanged. Only the third row, which produces depth, is different.` },
      { q: String.raw`The \(\varepsilon \approx -0.0010001\) from the first exercise is reused for an object at \(z = -80\). How far toward the camera does it move that object?`,
        a: String.raw`Solving the \(\varepsilon\) formula for \(\delta\): \(\delta = \dfrac{-\varepsilon(f+n)P_z^2}{\varepsilon(f+n)P_z + 2fn} = \dfrac{0.0010001\cdot101\cdot6400}{8.08 + 200} \approx 3.1\). Four times the distance gives about sixteen times the camera-space offset, because the NDC shift is constant.` },
      { q: "What visible problem does a too-large offset cause?",
        a: "The decal is drawn in front of things that are really in front of it but closer to the surface than δ, for example a thin plank lying on top of the decal or a foot standing on it. The decal pokes through them." },
    ],

    sims: [
      {
        title: "Z-fighting and the depth offset",
        help: String.raw`<p>A camera looks at a scorch-mark decal lying on a checkered floor. Both are written into an
          \(m\)-bit depth buffer, and the decal is drawn second with a "less than" depth test. Without an offset, tiny
          round-off differences in the interpolated depth let the floor win in stripes. Tick <b>Apply the depth offset</b>
          to scale entry (3,3) by \(1+\varepsilon\), with \(\varepsilon\) computed from \(\delta\) at the decal's depth.
          Then turn on the plank and push \(\delta\) far too high: the decal starts drawing through the plank. Fewer bits,
          a closer near plane or a more distant decal all need a larger \(\delta\).</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const W = 192, H = 120;
          const ras = sim.raster(stage, { width: W, height: H, displayHeight: 380 });
          const out = sim.readout(readout);
          const draw = () => render();
          const dist = sim.slider(controls, { label: "Decal distance", min: 3, max: 80, step: 1, value: 25, unit: " m", onInput: draw });
          const bits = sim.slider(controls, { label: "Depth buffer bits m", min: 8, max: 24, step: 1, value: 16, onInput: draw });
          const nearS = sim.slider(controls, { label: "Near plane n", min: 0.05, max: 4, step: 0.05, value: 0.5, unit: " m", onInput: draw });
          const farS = sim.slider(controls, { label: "Far plane f", min: 100, max: 2000, step: 50, value: 500, unit: " m", onInput: draw });
          const g = sim.group(controls, "Depth offset");
          const useOffset = sim.checkbox(g, { label: "Apply the depth offset", value: false, onChange: draw });
          const logDelta = sim.slider(g, { label: "Camera-space offset δ", min: -4, max: 0, step: 0.05, value: -1.5, format: (x) => fmtSci(Math.pow(10, x)) + " m", onInput: draw });
          const plank = sim.checkbox(controls, { label: "Thin plank (8 cm) lying across the decal", value: false, onChange: draw });

          const Hc = 5;            // camera height above the floor
          const DEC = 3;           // decal is 3 m x 3 m
          function render() {
            const n = nearS.value, f = farS.value, m = bits.value, steps = Math.pow(2, m) - 1;
            const zc = dist.value;
            const pitch = Math.atan2(Hc, zc);                     // aim the camera at the decal center
            const fovy = clamp(2 * Math.atan(3.4 / Math.hypot(zc, Hc)), rad(4), rad(70));
            const ty = Math.tan(fovy / 2), tx = (ty * W) / H;
            const F = [0, -Math.sin(pitch), -Math.cos(pitch)], U = [0, Math.cos(pitch), -Math.sin(pitch)];
            const Pz = -Math.hypot(zc, Hc);                      // camera-space z of the decal center
            const delta = Math.pow(10, logDelta.value);
            const eps = useOffset.value ? (-2 * f * n * delta) / ((f + n) * Pz * (Pz + delta)) : 0;
            const shiftUnits = ((eps * (f + n)) / (f - n)) * steps / 2;      // NDC shift in depth-buffer steps
            const depth = (pz) => (((f + n) / (f - n) + (2 * f * n) / ((f - n) * pz) + 1) / 2) * steps;
            let decalPx = 0, decalWin = 0, pokes = 0;

            for (let py = 0; py < H; py++) {
              const v = (1 - ((py + 0.5) / H) * 2) * ty;
              for (let px = 0; px < W; px++) {
                const u = (((px + 0.5) / W) * 2 - 1) * tx;
                const dir = [u, F[1] + v * U[1], F[2] + v * U[2]];   // camera-space (u, v, -1) in world space
                let col = [170 + 40 * v / ty, 200 + 20 * v / ty, 235];  // sky
                if (dir[1] < -1e-6) {
                  const t = -Hc / dir[1];                          // eye-space depth of the floor point is -t
                  if (t > n && t < f) {
                    const x = t * dir[0], z = t * dir[2];
                    const chk = (Math.floor(x) + Math.floor(z)) & 1 ? 158 : 118;
                    const fog = clamp(t / f, 0, 1);
                    col = [lerp(chk, 190, fog), lerp(chk, 205, fog), lerp(chk + 10, 228, fog)];
                    let surface = "floor";
                    let buffer = Math.round(depth(-t));
                    if (plank.value) {
                      const tp = (0.08 - Hc) / dir[1];
                      const xp = tp * dir[0], zp = tp * dir[2];
                      if (tp > n && Math.abs(xp) < 2.4 && zp > -zc - 0.3 && zp < -zc + 0.3) {
                        surface = "plank";
                        buffer = Math.round(depth(-tp));
                        const grain = 0.85 + 0.15 * Math.sin(xp * 9);
                        col = [150 * grain, 102 * grain, 58 * grain];
                      }
                    }
                    const s = x / DEC + 0.5, tt = (z + zc) / DEC + 0.5;
                    if (s >= 0 && s <= 1 && tt >= 0 && tt <= 1) {
                      const rr = 2 * Math.hypot(s - 0.5, tt - 0.5);
                      const alpha = 1 - smoothstep(0.72, 1.0, rr);
                      if (alpha > 0.02) {
                        // round-off model: the decal's interpolated depth differs from the floor's by under a step
                        const err = 0.75 * Math.sin(px * 0.21 + 2 * Math.sin(py * 0.13)) * Math.cos(py * 0.17 + 0.5);
                        const dDecal = Math.round(depth(-t) + err + shiftUnits);
                        const pass = dDecal < buffer;
                        if (surface === "floor") { decalPx++; if (pass) decalWin++; }
                        else if (pass) pokes++;
                        if (pass) {
                          const tone = smoothstep(0.25, 0.7, rr);
                          const dec = [lerp(32, 205, tone), lerp(26, 92, tone), lerp(22, 30, tone)];
                          col = col.map((c0, i) => lerp(c0, dec[i], alpha));
                        }
                      }
                    }
                  }
                }
                ras.set(px, py, col[0], col[1], col[2]);
              }
            }
            ras.put();

            const kq = (f - n) / (f * n * steps);
            const minDelta = (kq * Pz * Pz) / (1 - kq * Pz);
            const minEps = (2 / steps) * ((f - n) / (f + n));
            const cover = decalPx ? decalWin / decalPx : 1;
            const msg = pokes > 0
              ? `<b class="bad">Too much offset:</b> the decal draws through the plank (${pokes} pixels).`
              : cover > 0.995
                ? `<b class="ok">No z-fighting.</b> Every decal pixel beats the floor.`
                : `<b class="bad">Z-fighting.</b> The floor wins wherever round-off makes it a hair closer.${useOffset.value ? " δ is too small for this depth and precision." : " Apply an offset."}`;
            out.set(sim.rows([
              ["decal depth P_z", fmt(Pz, 2) + " m"],
              ["ε (Eq. 9.7)", useOffset.value ? fmtSci(eps) : "off"],
              ["entry (3,3) × (1 + ε)", fmt(1 + eps, 6)],
              ["NDC shift ε(f+n)/(f−n)", useOffset.value ? fmtSci((eps * (f + n)) / (f - n)) : "0"],
              ["shift in depth steps", fmt(shiftUnits, 2)],
              ["smallest useful |ε| (9.8)", fmtSci(minEps)],
              ["smallest useful δ here (9.9)", fmtSci(minDelta) + " m"],
              ["decal pixels that win", (100 * cover).toFixed(1) + "%", cover > 0.995 ? "ok" : "bad"],
            ]) + "<hr>" + msg);
          }
          render();
        },
      },
      {
        title: "Depth precision vs distance",
        help: String.raw`<p><b>NDC depth</b> plots \(z_{\text{ndc}}\) against distance: half of all depth values are used up
          before the marked distance \(2fn/(f+n)\), which is barely more than \(2n\). The dashed curve is the same curve shifted by
          the offset matrix (visible once \(|\varepsilon|\) is large). <b>Camera-space offset</b> plots, in meters, the size of
          one depth-buffer step (Eq. 9.9, red) and the distance that your fixed \(\varepsilon\) moves geometry (blue). Both grow like
          \(z^2\), so their ratio barely changes: an \(\varepsilon\) that works at one depth works at all depths. Drag the probe.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { xRange: [0, 100], yRange: [-1.15, 1.15], height: 440 });
          const out = sim.readout(readout);
          const r = () => view.redraw();
          const mode = sim.segmented(controls, { label: "Plot", options: [["eye", "Camera-space offset"], ["ndc", "NDC depth"]], value: "eye", onChange: r });
          const nearS = sim.slider(controls, { label: "Near plane n", min: 0.1, max: 5, step: 0.1, value: 1, onInput: r });
          const farS = sim.slider(controls, { label: "Far plane f", min: 20, max: 1000, step: 10, value: 100, onInput: r });
          const bits = sim.slider(controls, { label: "Depth bits m", min: 8, max: 24, step: 1, value: 16, onInput: r });
          const logEps = sim.slider(controls, { label: "|ε|", min: -6, max: -1, step: 0.05, value: -3, format: (x) => fmtSci(Math.pow(10, x)), onInput: r });
          const probe = view.handle([20, 0], { color: "d", label: "probe", constrain: (p) => [clamp(p[0], nearS.value, farS.value), 0] });

          view.onDraw((v) => {
            const n = nearS.value, f = Math.max(farS.value, n + 1), steps = Math.pow(2, bits.value) - 1;
            const e = Math.pow(10, logEps.value);
            const kq = (f - n) / (f * n * steps);
            v.opts.xRange = [0, f * 1.04];
            probe.pos[0] = clamp(probe.pos[0], n, f);
            probe.pos[1] = 0;
            const zNdc = (z) => (f + n) / (f - n) - (2 * f * n) / ((f - n) * z);
            const dMin = (z) => (kq * z * z) / (1 + kq * z);                              // Eq. 9.9 with P_z = -z
            const dEps = (z) => (e * (f + n) * z * z) / (e * (f + n) * z + 2 * f * n);     // Eq. 9.7 solved for delta
            const z0 = probe.pos[0];

            if (mode.value === "ndc") {
              v.opts.yRange = [-1.15, 1.15];
              v.grid();
              v.axes({ ticks: true, labels: ["distance −P_z", "z_ndc"] });
              v.plot(zNdc, { from: n, to: f, color: "a", width: 2.5 });
              v.plot((z) => zNdc(z) - (e * (f + n)) / (f - n), { from: n, to: f, color: "b", width: 2, dash: [6, 4] });
              const half = (2 * f * n) / (f + n);
              v.line([half, -1.15], [half, 0], { color: "muted", dash: [4, 4], width: 1 });
              v.point([half, 0], { color: "muted", r: 4 });
              v.text([half, 0], "half the depth values used", { color: "muted", size: 11, offset: [6, -8] });
              v.point([z0, zNdc(z0)], { color: "a", r: 5 });
            } else {
              const ymax = Math.max(dMin(f), dEps(f)) * 1.15 || 1;
              v.opts.yRange = [-ymax * 0.06, ymax];
              v.grid();
              v.axes({ ticks: true, labels: ["distance −P_z", "meters"] });
              v.plot(dMin, { from: n, to: f, color: "e", width: 2.5 });
              v.plot(dEps, { from: n, to: f, color: "b", width: 2.5 });
              v.text([f, dMin(f)], "one depth step", { color: "e", size: 11, align: "right", offset: [-4, -8] });
              v.text([f, dEps(f)], "offset from ε", { color: "b", size: 11, align: "right", offset: [-4, -8] });
              v.point([z0, dMin(z0)], { color: "e", r: 5 });
              v.point([z0, dEps(z0)], { color: "b", r: 5 });
            }
            v.line([z0, v.opts.yRange[0]], [z0, v.opts.yRange[1]], { color: "d", dash: [3, 4], width: 1, alpha: 0.6 });

            const ratio = dEps(z0) / dMin(z0);
            out.set(sim.rows([
              ["probe distance −P_z", fmt(z0, 1)],
              ["z_ndc", fmt(zNdc(z0), 5)],
              [sim.swatch("e") + "one depth step (9.9)", fmtSci(dMin(z0)) + " m"],
              [sim.swatch("b") + "offset produced by ε", fmtSci(dEps(z0)) + " m"],
              ["ratio offset / step", fmt(ratio, 2), ratio >= 1 ? "ok" : "bad"],
              ["NDC shift ε(f+n)/(f−n)", fmtSci((e * (f + n)) / (f - n))],
              ["needed |ε| (Eq. 9.8)", fmtSci((2 / steps) * ((f - n) / (f + n)))],
            ]) + `<hr>${ratio >= 1 ? "<b class='ok'>Effective:</b> the offset is larger than one depth step." : "<b class='bad'>Too small:</b> the offset is lost in a single depth step."} Move the probe: the ratio hardly changes.`);
          });
        },
      },
    ],

    cpp: [
      {
        title: "Epsilon for a camera-space offset",
        formula: String.raw`\varepsilon = -\frac{2fn}{f+n}\left(\frac{\delta}{P_z(P_z+\delta)}\right)`,
        code: String.raw`
          // delta: camera-space offset, positive = toward the camera
          // pz:    camera-space z of the object (negative, in front of the camera)
          float DepthOffsetEpsilon(float n, float f, float delta, float pz)
          {
              return -2.0f * f * n * delta / ((f + n) * pz * (pz + delta));
          }
        `,
      },
      {
        title: "Offset projection matrix",
        formula: String.raw`\begin{bmatrix} \cdot & \cdot \\ -(1+\varepsilon)\frac{f+n}{f-n} & -\frac{2fn}{f-n} \\ -1 & 0 \end{bmatrix} \text{ (lower-right block)}`,
        note: "<p>Only the entry that multiplies P<sub>z</sub> in the depth row changes. The x, y and w rows are untouched.</p>",
        code: String.raw`
          Matrix4D MakeFrustum(float l, float r, float b, float t, float n, float f)
          {
              return Matrix4D(2.0f * n / (r - l), 0.0f, (r + l) / (r - l), 0.0f,
                              0.0f, 2.0f * n / (t - b), (t + b) / (t - b), 0.0f,
                              0.0f, 0.0f, -(f + n) / (f - n), -2.0f * f * n / (f - n),
                              0.0f, 0.0f, -1.0f, 0.0f);
          }

          Matrix4D MakeOffsetFrustum(float l, float r, float b, float t, float n, float f,
                                     float delta, float pz)
          {
              Matrix4D m = MakeFrustum(l, r, b, t, n, f);
              float epsilon = DepthOffsetEpsilon(n, f, delta, pz);
              m(2, 2) *= 1.0f + epsilon;      // the book's entry (3,3): z row, z column
              return m;
          }
        `,
      },
      {
        title: "Smallest offset an m-bit depth buffer can resolve",
        formula: String.raw`\delta_{\min} = \frac{kP_z^2}{1-kP_z} \qquad \delta_{\max} = \frac{-kP_z^2}{1+kP_z} \qquad k = \frac{f-n}{fn(2^m-1)}`,
        code: String.raw`
          float DepthPrecisionK(float n, float f, int bits)
          {
              float steps = std::ldexp(1.0f, bits) - 1.0f;      // 2^m - 1
              return (f - n) / (f * n * steps);                  // Equation (9.11)
          }

          // Least offset toward the camera that changes the stored depth (pz < 0).
          float MinTowardCameraOffset(float n, float f, int bits, float pz)
          {
              float k = DepthPrecisionK(n, f, bits);
              return k * pz * pz / (1.0f - k * pz);              // Equation (9.9)
          }

          // Largest (most negative) useful offset away from the camera.
          float MaxAwayFromCameraOffset(float n, float f, int bits, float pz)
          {
              float k = DepthPrecisionK(n, f, bits);
              return -k * pz * pz / (1.0f + k * pz);             // Equation (9.10)
          }
        `,
      },
      {
        title: "Projected depth with and without the offset",
        formula: String.raw`z'_{\text{ndc}} - z_{\text{ndc}} = \varepsilon\,\frac{f+n}{f-n} \quad\text{for every } P_z`,
        code: String.raw`
          // z after the perspective divide (OpenGL NDC: -1 at the near plane, +1 at the far plane)
          float ProjectedDepth(float n, float f, float pz, float epsilon = 0.0f)
          {
              return (1.0f + epsilon) * (f + n) / (f - n) + 2.0f * f * n / ((f - n) * pz);
          }

          // Depth-buffer value for an m-bit buffer
          unsigned int StoredDepth(float zNdc, int bits)
          {
              float steps = std::ldexp(1.0f, bits) - 1.0f;
              return static_cast<unsigned int>((zNdc * 0.5f + 0.5f) * steps + 0.5f);
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 9.2 Decal Application
  // ===========================================================================
  L3D.topic({
    id: "9.2",
    summary: "Build a decal mesh by clipping the nearby surface triangles to six planes around the impact point, then assign texture coordinates and a fade.",

    lesson: String.raw`
      <p>A <strong>decal</strong> sticks a texture onto existing geometry: a blast mark on a curved wall, a footprint in
      uneven terrain, a splash of paint across the corner of a crate. Putting a decal in the middle of one flat polygon is
      easy. The general case is harder, because the decal must follow a curved or creased surface and must be trimmed where
      it runs off the edge of that surface. The book's method builds a new triangle mesh for the decal by cutting the nearby
      surface triangles with a box.</p>

      <h2 data-sub="9.2.1">Decal Mesh Construction</h2>
      <p>Start from a point \(\mathbf P\) on the surface (where the projectile hit), the unit surface normal \(\mathbf N\) at
      that point, and a unit tangent \(\mathbf T\) that sets the decal's rotation. The third axis is
      \(\mathbf B = \mathbf N\times\mathbf T\). For a decal of width \(w\) and height \(h\), four planes parallel to
      \(\mathbf N\) cut a rectangle out of the tangent plane. Written as 4D vectors \(\langle\text{normal}, D\rangle\) whose
      positive side is the inside of the decal:</p>
      <div class="formula">\[ \begin{aligned}
        \mathbf{left} &= \left\langle \mathbf T,\; \tfrac w2 - \mathbf T\cdot\mathbf P \right\rangle &
        \mathbf{right} &= \left\langle -\mathbf T,\; \tfrac w2 + \mathbf T\cdot\mathbf P \right\rangle \\
        \mathbf{bottom} &= \left\langle \mathbf B,\; \tfrac h2 - \mathbf B\cdot\mathbf P \right\rangle &
        \mathbf{top} &= \left\langle -\mathbf B,\; \tfrac h2 + \mathbf B\cdot\mathbf P \right\rangle
      \end{aligned} \]</div>
      <p>Check one: a point \(\mathbf Q\) is on the positive side of <b>left</b> when
      \(\mathbf T\cdot\mathbf Q + \tfrac w2 - \mathbf T\cdot\mathbf P \ge 0\), that is \(\mathbf T\cdot(\mathbf Q-\mathbf P) \ge -\tfrac w2\):
      no more than half a width to the left of the center.</p>
      <p>Two more planes stop the decal from bleeding onto parts of the surface that are inside the rectangle but far in
      front of or behind \(\mathbf P\), such as the far side of a thin wall or a ledge lower down:</p>
      <div class="formula">\[ \mathbf{front} = \langle -\mathbf N,\; d + \mathbf N\cdot\mathbf P\rangle \qquad \mathbf{back} = \langle \mathbf N,\; d - \mathbf N\cdot\mathbf P\rangle \]</div>
      <p>where \(d\) is the largest distance any decal vertex may be from the tangent plane at \(\mathbf P\). Together the
      six planes form an oriented box around the impact point.</p>

      <p>Building the mesh:</p>
      <ol>
        <li>Find the surfaces that could be affected, for example every surface whose bounding volume comes within some
          distance of \(\mathbf P\) (Chapter 8).</li>
        <li>For every triangle of those surfaces, compute its unit normal \(\mathbf M\). Discard the triangle if
          \(\mathbf N\cdot\mathbf M \lt \varepsilon\) for a fixed positive \(\varepsilon\): it faces away from the decal or is
          nearly edge-on.</li>
        <li>Clip the remaining triangles against the six planes (Section 9.2.2) and add whatever survives to the decal's
          triangle mesh.</li>
      </ol>
      <p>When clipping creates new vertices, interpolate the surface normals along with the positions. Each decal vertex
      then has a normal \(\mathbf R\), no longer unit length after interpolation, which is used to fade the decal where the
      surface turns away from \(\mathbf N\):</p>
      <div class="formula">\[ \text{alpha} = \frac{\dfrac{\mathbf N\cdot\mathbf R}{\lVert\mathbf R\rVert} - \varepsilon}{1-\varepsilon} \]</div>
      <p>This maps the cosine range \([\varepsilon, 1]\) onto alpha \([0, 1]\). The decal is fully opaque where the surface
      faces it squarely and fades smoothly to nothing at the rejection angle.</p>
      <p>Texture coordinates come from the signed distances of each vertex \(\mathbf Q\) to the planes through \(\mathbf P\)
      with normals \(\mathbf T\) and \(\mathbf B\), scaled so the rectangle maps onto \([0,1]^2\):</p>
      <div class="formula">\[ s = \frac{\mathbf T\cdot(\mathbf Q-\mathbf P)}{w} + \frac12 \qquad t = \frac{\mathbf B\cdot(\mathbf Q-\mathbf P)}{h} + \frac12 \]</div>
      <p>This is a planar projection along \(\mathbf N\). On a strongly curved surface the texture stretches where the surface
      is steep, and the alpha fade helps to hide that.</p>
      <div class="game">Render the finished decal with the depth offset of <a href="#/9.1">Section 9.1</a>, or it will z-fight
      with the surface it was cut from. Engines usually keep a fixed pool of decal meshes and recycle the oldest one when a
      new bullet hole appears.</div>

      <h2 data-sub="9.2.2">Polygon Clipping</h2>
      <p>Each candidate triangle is treated as a convex polygon and clipped against the six planes one at a time. For a
      plane \(\mathbf K\), sort the vertices into two groups: the negative side (\(\mathbf K\cdot\mathbf V \lt 0\)) and
      everything else (positive, or exactly in the plane). If every vertex is negative, the polygon disappears. Otherwise walk
      around the polygon edge by edge:</p>
      <ul>
        <li>keep each vertex that is not on the negative side, and</li>
        <li>wherever an edge goes from one group to the other, insert a new vertex where it crosses the plane.</li>
      </ul>
      <p>If \(\mathbf V_1\) is on the positive side and \(\mathbf V_2\) on the negative side, the points of the edge are
      \(\mathbf W(t) = \mathbf V_1 + t(\mathbf V_2 - \mathbf V_1)\) for \(0 \le t \le 1\). Setting \(\mathbf K\cdot\mathbf W(t) = 0\) gives</p>
      <div class="formula">\[ t = \frac{\mathbf K\cdot\mathbf V_1}{\mathbf K\cdot(\mathbf V_1-\mathbf V_2)} \]</div>
      <p>The difference \(\mathbf V_1-\mathbf V_2\) has \(w = 0\), so the denominator is an ordinary 3D dot product. The same
      \(t\) interpolates normals, colors, or any other vertex attribute.</p>
      <p>A plane cuts a convex polygon along a single line, so each clip adds at most one vertex: an \(n\)-gon becomes at
      most an \((n+1)\)-gon, and a triangle clipped by all six planes has at most 9 vertices. The result is still convex, so
      it can be emitted as a triangle fan.</p>
      <div class="note">This is the portal clipping of Section 8.4.1, except that vertices lying exactly in the plane don't
      need a category of their own: they are simply kept. Clipping against a convex region one plane at a time like this is
      the Sutherland–Hodgman algorithm.</div>

      <p><a class="btn goto-sim" href="#/9.2/sim">Try it: clip a decal plane by plane →</a></p>
    `,

    keyFormulas: [
      ["Side planes", String.raw`\mathbf{left} = \langle\mathbf T, \tfrac w2 - \mathbf T\cdot\mathbf P\rangle,\ \mathbf{right} = \langle-\mathbf T, \tfrac w2 + \mathbf T\cdot\mathbf P\rangle,\ \mathbf{bottom} = \langle\mathbf B, \tfrac h2 - \mathbf B\cdot\mathbf P\rangle,\ \mathbf{top} = \langle-\mathbf B, \tfrac h2 + \mathbf B\cdot\mathbf P\rangle`],
      ["Front and back planes", String.raw`\mathbf{front} = \langle-\mathbf N, d + \mathbf N\cdot\mathbf P\rangle,\quad \mathbf{back} = \langle\mathbf N, d - \mathbf N\cdot\mathbf P\rangle`],
      ["Texture coordinates", String.raw`s = \frac{\mathbf T\cdot(\mathbf Q-\mathbf P)}{w} + \frac12,\quad t = \frac{\mathbf B\cdot(\mathbf Q-\mathbf P)}{h} + \frac12`],
      ["Alpha fade", String.raw`\alpha = \left(\frac{\mathbf N\cdot\mathbf R}{\lVert\mathbf R\rVert} - \varepsilon\right)\Big/(1-\varepsilon)`],
      ["Edge–plane intersection", String.raw`t = \frac{\mathbf K\cdot\mathbf V_1}{\mathbf K\cdot(\mathbf V_1-\mathbf V_2)}`],
    ],

    exercises: [
      { q: String.raw`A decal has \(\mathbf P = (2, 0, 3)\), \(\mathbf N = (0, 1, 0)\), \(\mathbf T = (1, 0, 0)\), \(w = 2\), \(h = 1\). What are \(\mathbf B\) and the left plane?`,
        a: String.raw`\(\mathbf B = \mathbf N\times\mathbf T = (0, 0, -1)\). Left \(= \langle 1, 0, 0,\ 1 - 2\rangle = (1, 0, 0, -1)\), so the inside is \(x \ge 1\), which is \(P_x - w/2\).` },
      { q: String.raw`For the same decal, what are the texture coordinates of the vertex \(\mathbf Q = (2.5, 0, 2.8)\)?`,
        a: String.raw`\(\mathbf Q-\mathbf P = (0.5, 0, -0.2)\). \(s = 0.5/2 + 0.5 = 0.75\) and \(t = (0,0,-1)\cdot(0.5,0,-0.2)/1 + 0.5 = 0.2 + 0.5 = 0.7\).` },
      { q: String.raw`An edge has \(\mathbf K\cdot\mathbf V_1 = 3\) and \(\mathbf K\cdot\mathbf V_2 = -1\). Where is the new vertex?`,
        a: String.raw`\(t = 3/(3-(-1)) = 0.75\), so \(\mathbf W = \mathbf V_1 + 0.75(\mathbf V_2-\mathbf V_1)\), three quarters of the way to \(\mathbf V_2\).` },
      { q: "Why can a triangle clipped against the six decal planes have at most nine vertices?",
        a: "Each plane cuts a convex polygon along one straight line, which crosses the boundary at most twice. At most two new vertices appear and at least one old vertex is removed when any are added, so each clip adds at most one vertex: 3 + 6 = 9." },
      { q: String.raw`With \(\varepsilon = 0.3\), what alpha does a vertex get if its interpolated normal makes a \(45^\circ\) angle with \(\mathbf N\)?`,
        a: String.raw`\(\cos 45^\circ \approx 0.707\), so \(\alpha = (0.707 - 0.3)/0.7 \approx 0.58\).` },
    ],

    sims: [
      {
        title: "Decal clipping, plane by plane (top view)",
        help: String.raw`<p>We look straight down the decal normal \(\mathbf N\) at a surface mesh. Drag the decal center
          \(\mathbf P\) and set its rotation and size. Press <b>Clip next plane</b> to apply left, right, bottom and top in turn:
          the red half-plane is discarded, kept vertices stay, and red dots are new vertices from
          \(t = \mathbf K\cdot\mathbf V_1 / \mathbf K\cdot(\mathbf V_1-\mathbf V_2)\). Click any triangle to follow its vertex count.
          After the fourth plane the polygons are fanned into triangles and the \(s, t\) grid is shown. (The front and back
          planes act along \(\mathbf N\), which is perpendicular to the screen here.)</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 5.2, height: 470 });
          const out = sim.readout(readout);
          const r = () => view.redraw();

          // surface mesh: a jittered grid of counterclockwise triangles
          const rng = makeRng(11);
          const nx = 9, ny = 6, x0 = -8, x1 = 8, y0 = -5.6, y1 = 5.6;
          const verts = [];
          for (let j = 0; j <= ny; j++)
            for (let i = 0; i <= nx; i++) {
              let x = lerp(x0, x1, i / nx), y = lerp(y0, y1, j / ny);
              if (i > 0 && i < nx && j > 0 && j < ny) { x += (rng() - 0.5) * 0.9; y += (rng() - 0.5) * 0.9; }
              verts.push([x, y]);
            }
          const tris = [];
          for (let j = 0; j < ny; j++)
            for (let i = 0; i < nx; i++) {
              const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
              if ((i + j) % 2) tris.push([a, b, d], [a, d, c]);
              else tris.push([a, b, c], [b, d, c]);
            }

          const center = view.handle([0.4, 0.3], { color: "d", label: "P" });
          const theta = sim.slider(controls, { label: "Rotation (direction of T)", min: -90, max: 90, step: 1, value: 20, unit: "°", onInput: r });
          const wS = sim.slider(controls, { label: "Width w", min: 1, max: 8, step: 0.1, value: 4.8, onInput: r });
          const hS = sim.slider(controls, { label: "Height h", min: 1, max: 6, step: 0.1, value: 3.2, onInput: r });
          let applied = 0, selected = -1;
          sim.buttons(controls, [
            { label: "Clip next plane ▶", primary: true, onClick: () => { applied = Math.min(4, applied + 1); r(); } },
            { label: "Back", onClick: () => { applied = Math.max(0, applied - 1); r(); } },
          ]);
          sim.buttons(controls, [
            { label: "All four", onClick: () => { applied = 4; r(); } },
            { label: "Reset", onClick: () => { applied = 0; r(); } },
          ]);
          const names = ["left", "right", "bottom", "top"];
          view.onClick((p) => {
            const k = tris.findIndex((t) => pointInTri(p, verts[t[0]], verts[t[1]], verts[t[2]]));
            selected = k;
            r();
          });

          view.onDraw((v) => {
            const T = [Math.cos(rad(theta.value)), Math.sin(rad(theta.value))], B = V.perp2(T), P = center.pos;
            const w = wS.value, h = hS.value;
            const planes = [
              [T[0], T[1], w / 2 - V.dot(T, P)],
              [-T[0], -T[1], w / 2 + V.dot(T, P)],
              [B[0], B[1], h / 2 - V.dot(B, P)],
              [-B[0], -B[1], h / 2 + V.dot(B, P)],
            ];
            const corner = (a, b) => V.add(P, V.add(V.scale(T, (a * w) / 2), V.scale(B, (b * h) / 2)));
            if (selected < 0) selected = Math.max(0, tris.findIndex((t) => pointInTri(corner(1, 1), verts[t[0]], verts[t[1]], verts[t[2]])));

            const results = tris.map((t) => {
              let poly = t.map((i) => ({ p: verts[i] }));
              const counts = [3];
              for (let k = 0; k < applied && poly.length; k++) {
                poly = clipPolygon(poly, planes[k]);
                counts.push(poly.length);
              }
              return { poly, counts };
            });

            v.grid({ step: 1 });
            for (const t of tris) v.polygon(t.map((i) => verts[i]), { color: "muted", width: 1, alpha: 0.45 });

            if (applied < 4) {
              const K = planes[applied], nrm = [K[0], K[1]];
              const p0 = V.scale(nrm, -K[2]);                       // point on the line (n is unit length)
              const along = V.perp2(nrm), R = 60;
              v.polygon([V.add(p0, V.scale(along, R)), V.add(V.add(p0, V.scale(along, R)), V.scale(nrm, -R)),
                V.add(V.sub(p0, V.scale(along, R)), V.scale(nrm, -R)), V.sub(p0, V.scale(along, R))], { fill: "e", fillAlpha: 0.09, stroke: false });
              v.infiniteLine(p0, along, { color: "e", width: 2, dash: [7, 5] });
              const foot = V.sub(P, V.scale(nrm, planeDot(K, P)));
              v.arrow(foot, V.add(foot, V.scale(nrm, 1)), { color: "e", width: 2.5, label: names[applied] });
            }

            let kept = 0, maxV = 0, triOut = 0;
            results.forEach((res, i) => {
              if (res.poly.length < 3) return;
              kept++;
              maxV = Math.max(maxV, res.poly.length);
              triOut += res.poly.length - 2;
              const pts = res.poly.map((q) => q.p);
              v.polygon(pts, { fill: "b", fillAlpha: applied ? 0.28 : 0.06, color: "b", width: 1.5, alpha: applied ? 1 : 0.4 });
              if (applied === 4) for (let k = 2; k < pts.length - 1; k++) v.line(pts[0], pts[k], { color: "b", width: 1, dash: [3, 3] });
              if (applied) res.poly.forEach((q) => { if (q.created) v.point(q.p, { color: "e", r: 3.5 }); });
            });

            if (applied === 4) {
              for (const s of [0.25, 0.5, 0.75]) {
                const a = 2 * s - 1;
                v.line(corner(a, -1), corner(a, 1), { color: "c", width: 1, alpha: 0.6 });
                v.line(corner(-1, a), corner(1, a), { color: "c", width: 1, alpha: 0.6 });
              }
              v.text(corner(-1, -1), "(0,0)", { color: "c", size: 11, offset: [-30, 14] });
              v.text(corner(1, 1), "(1,1)", { color: "c", size: 11, offset: [4, -6] });
            }
            v.polygon([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], { color: "d", width: 1.5, dash: [6, 4] });
            v.arrow(P, V.add(P, V.scale(T, 1.3)), { color: "d", width: 2.5, label: "T" });
            v.arrow(P, V.add(P, V.scale(B, 1.3)), { color: "a", width: 2.5, label: "B" });

            const sel = results[selected];
            if (sel) {
              v.polygon(tris[selected].map((i) => verts[i]), { color: "g", width: 3 });
              if (sel.poly.length) v.polygon(sel.poly.map((q) => q.p), { color: "g", width: 2, dash: [5, 3] });
            }

            const K = applied < 4 ? planes[applied] : null;
            out.set(sim.rows([
              ["planes applied", `${applied} / 4`],
              ["next plane", K ? `${names[applied]} = (${fmt(K[0])}, ${fmt(K[1])}, ${fmt(K[2])})` : "done"],
              ["polygons kept", `${kept} of ${tris.length}`],
              ["most vertices in one polygon", String(maxV)],
              ["triangles after fanning", String(triOut)],
              [sim.swatch("g") + "selected triangle", sel ? sel.counts.join(" → ") + (sel.poly.length ? "" : " (gone)") : "click one"],
            ]) + `<hr>Each plane adds at most one vertex per polygon. Planes in the order left, right, bottom, top as 4D vectors
              ⟨normal, D⟩ with the inside on the positive side.`);
          });
        },
      },
      {
        title: "Decal on a curved surface (3D)",
        help: String.raw`<p>The decal box (dashed) is built from \(\mathbf P\), the surface normal \(\mathbf N\) and the tangent
          \(\mathbf T\). Every nearby triangle facing the decal (\(\mathbf N\cdot\mathbf M \ge \varepsilon\)) is clipped by all six planes and
          fanned into the orange decal mesh. The checker shows the texture coordinates \(s, t\), and the opacity shows the alpha fade
          from the interpolated normals. Move the decal over the ridge, shrink the depth \(d\), or raise \(\varepsilon\) and watch
          triangles drop out.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view3d(stage, { height: 480, distance: 9.5, yaw: 0.55, pitch: 0.8 });
          const out = sim.readout(readout);
          const r = () => view.redraw();
          const surfaces = {
            hills: (x, z) => 0.45 * Math.sin(1.2 * x + 0.3) * Math.cos(0.9 * z) + 0.2 * Math.cos(0.6 * x - 1.1 * z),
            ridge: (x, z) => 0.1 * Math.sin(0.8 * z) + 1.1 * Math.max(0, 1 - Math.abs(x - 0.4) / 0.7),
          };
          const kind = sim.select(controls, { label: "Surface", options: [["hills", "Rolling hills"], ["ridge", "Sharp ridge"]], value: "hills", onChange: () => { build(); r(); } });
          const px = sim.slider(controls, { label: "Center x", min: -2.2, max: 2.2, step: 0.05, value: 0.2, onInput: r });
          const pz = sim.slider(controls, { label: "Center z", min: -2.2, max: 2.2, step: 0.05, value: 0.3, onInput: r });
          const rot = sim.slider(controls, { label: "Rotation", min: -180, max: 180, step: 1, value: 30, unit: "°", onInput: r });
          const wS = sim.slider(controls, { label: "Width w", min: 0.5, max: 3.5, step: 0.05, value: 2.2, onInput: r });
          const hS = sim.slider(controls, { label: "Height h", min: 0.5, max: 3.5, step: 0.05, value: 1.6, onInput: r });
          const dS = sim.slider(controls, { label: "Depth d", min: 0.05, max: 1.5, step: 0.05, value: 0.6, onInput: r });
          const epsS = sim.slider(controls, { label: "Facing threshold ε", min: 0, max: 0.95, step: 0.05, value: 0.3, onInput: r });
          const showBox = sim.checkbox(controls, { label: "Show the decal box and axes", value: true, onChange: r });

          const G = 19, S = 3;
          let surf;
          function build() {
            const hf = surfaces[kind.value];
            const e = 0.01;
            const nrm = (x, z) => V.norm([-(hf(x + e, z) - hf(x - e, z)) / (2 * e), 1, -(hf(x, z + e) - hf(x, z - e)) / (2 * e)]);
            const vtx = [], vn = [];
            for (let j = 0; j < G; j++)
              for (let i = 0; i < G; i++) {
                const x = -S + (2 * S * i) / (G - 1), z = -S + (2 * S * j) / (G - 1);
                vtx.push([x, hf(x, z), z]);
                vn.push(nrm(x, z));
              }
            const tri = [];
            for (let j = 0; j < G - 1; j++)
              for (let i = 0; i < G - 1; i++) {
                const a = j * G + i, b = a + 1, c = a + G, d = c + 1;   // b = +x, c = +z
                tri.push([a, c, b], [b, c, d]);                         // counterclockwise seen from +y
              }
            const tn = tri.map((t) => V.norm(V.cross(V.sub(vtx[t[1]], vtx[t[0]]), V.sub(vtx[t[2]], vtx[t[0]]))));
            surf = { hf, nrm, vtx, vn, tri, tn };
          }
          build();

          view.onDraw((v) => {
            const { hf, nrm, vtx, vn, tri, tn } = surf;
            const w = wS.value, h = hS.value, d = dS.value, eps = epsS.value;
            const P = [px.value, hf(px.value, pz.value), pz.value], N = nrm(px.value, pz.value);
            const t0 = [Math.cos(rad(rot.value)), 0, -Math.sin(rad(rot.value))];
            const T = V.norm(V.sub(t0, V.scale(N, V.dot(t0, N))));
            const B = V.cross(N, T);
            const planes = [
              [...T, w / 2 - V.dot(T, P)], [...V.neg(T), w / 2 + V.dot(T, P)],
              [...B, h / 2 - V.dot(B, P)], [...V.neg(B), h / 2 + V.dot(B, P)],
              [...V.neg(N), d + V.dot(N, P)], [...N, d - V.dot(N, P)],
            ];
            const reach = Math.hypot(w / 2, h / 2, d);

            for (const t of tri) v.poly(t.map((k) => vtx[k]), { fill: "f", lit: true, color: "grid2", width: 0.5 });

            let tested = 0, facing = 0, clipped = 0, kept = 0, maxV = 0;
            const decalTris = [];
            tri.forEach((t, i) => {
              const ps = t.map((k) => vtx[k]);
              for (let c = 0; c < 3; c++) {
                const lo = Math.min(ps[0][c], ps[1][c], ps[2][c]), hi = Math.max(ps[0][c], ps[1][c], ps[2][c]);
                if (lo > P[c] + reach || hi < P[c] - reach) return;      // bounding-box rejection
              }
              tested++;
              if (V.dot(N, tn[i]) < eps) { facing++; return; }          // faces away from the decal
              let poly = t.map((k) => ({ p: vtx[k], n: vn[k] }));
              for (const K of planes) { poly = clipPolygon(poly, K); if (!poly.length) break; }
              if (poly.length < 3) { clipped++; return; }
              kept++;
              maxV = Math.max(maxV, poly.length);
              const attr = poly.map((q) => {
                const rel = V.sub(q.p, P);
                const cosR = V.dot(N, q.n) / V.len(q.n);
                return { p: q.p, s: V.dot(T, rel) / w + 0.5, t: V.dot(B, rel) / h + 0.5, a: clamp((cosR - eps) / (1 - eps || 1), 0, 1) };
              });
              for (let k = 1; k + 1 < attr.length; k++) decalTris.push([attr[0], attr[k], attr[k + 1]]);
            });

            const mid = (a, b) => ({ p: V.lerp(a.p, b.p, 0.5), s: (a.s + b.s) / 2, t: (a.t + b.t) / 2, a: (a.a + b.a) / 2 });
            for (const [a, b, c] of decalTris) {
              const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
              for (const sub of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]) {
                const s = (sub[0].s + sub[1].s + sub[2].s) / 3, tt = (sub[0].t + sub[1].t + sub[2].t) / 3;
                const al = (sub[0].a + sub[1].a + sub[2].a) / 3;
                const checker = (Math.floor(s * 4) + Math.floor(tt * 4)) & 1;
                v.poly(sub.map((q) => q.p), { fill: checker ? "b" : "g", alpha: 0.15 + 0.8 * al, bias: -0.35 });
              }
              v.polyline([a.p, b.p, c.p], { closed: true, color: "e", width: 1, bias: 0.4 });
            }

            if (showBox.value) {
              const cnr = (a, b, c) => V.add(P, V.add(V.add(V.scale(T, (a * w) / 2), V.scale(B, (b * h) / 2)), V.scale(N, c * d)));
              for (const a of [-1, 1]) for (const b of [-1, 1]) v.line(cnr(a, b, -1), cnr(a, b, 1), { color: "d", width: 1, dash: [4, 3], alpha: 0.7 });
              for (const c of [-1, 1]) {
                v.polyline([cnr(-1, -1, c), cnr(1, -1, c), cnr(1, 1, c), cnr(-1, 1, c)], { closed: true, color: "d", width: 1, dash: [4, 3], alpha: 0.7 });
              }
              v.arrow(P, V.add(P, V.scale(N, 0.9)), { color: "c", width: 2.5, label: "N", overlay: true });
              v.arrow(P, V.add(P, V.scale(T, 0.9)), { color: "e", width: 2.5, label: "T", overlay: true });
              v.arrow(P, V.add(P, V.scale(B, 0.9)), { color: "a", width: 2.5, label: "B", overlay: true });
            }
            v.point(P, { color: "d", r: 4, overlay: true });

            out.set(sim.rows([
              ["P", fmtVec(P)],
              ["N", fmtVec(N)],
              ["triangles near the decal", String(tested)],
              ["rejected: N·M < ε", String(facing)],
              ["clipped away completely", String(clipped)],
              ["clipped polygons kept", String(kept)],
              ["most vertices in one polygon", `${maxV} (max 9)`],
              ["decal triangles", String(decalTris.length)],
            ]) + `<hr>Texture coordinates: s = T·(Q−P)/w + ½, t = B·(Q−P)/h + ½. Alpha = (N·R/‖R‖ − ε)/(1 − ε) from the interpolated normals.`);
          });
        },
      },
    ],

    cpp: [
      {
        title: "Decal boundary planes",
        formula: String.raw`\mathbf{left} = \langle\mathbf T, \tfrac w2 - \mathbf T\cdot\mathbf P\rangle \;\cdots\; \mathbf{front} = \langle-\mathbf N, d + \mathbf N\cdot\mathbf P\rangle,\ \mathbf{back} = \langle\mathbf N, d - \mathbf N\cdot\mathbf P\rangle`,
        code: String.raw`
          struct Decal
          {
              Point3D  center;      // P
              Vector3D normal;      // N (unit)
              Vector3D tangent;     // T (unit, perpendicular to N)
              float    width, height, depth;   // w, h, d
          };

          void GetDecalPlanes(const Decal& decal, Plane plane[6])
          {
              const Point3D&  p = decal.center;
              const Vector3D& n = decal.normal;
              const Vector3D& t = decal.tangent;
              Vector3D b = Cross(n, t);                                    // B = N x T

              plane[0] = Plane( t, decal.width * 0.5f - Dot(t, p));       // left
              plane[1] = Plane(-t, decal.width * 0.5f + Dot(t, p));       // right
              plane[2] = Plane( b, decal.height * 0.5f - Dot(b, p));      // bottom
              plane[3] = Plane(-b, decal.height * 0.5f + Dot(b, p));      // top
              plane[4] = Plane(-n, decal.depth + Dot(n, p));              // front
              plane[5] = Plane( n, decal.depth - Dot(n, p));              // back
          }
        `,
      },
      {
        title: "Clipping a convex polygon to a plane",
        formula: String.raw`\mathbf W = \mathbf V_1 + t(\mathbf V_2-\mathbf V_1),\qquad t = \frac{\mathbf K\cdot\mathbf V_1}{\mathbf K\cdot(\mathbf V_1-\mathbf V_2)}`,
        note: "<p>The result keeps the part on the positive side of the plane. <code>result</code> needs room for one more vertex than the input.</p>",
        code: String.raw`
          struct DecalVertex
          {
              Point3D  position;
              Vector3D normal;      // interpolated as well, for the alpha fade
          };

          int ClipPolygon(int vertexCount, const DecalVertex *vertex, const Plane& plane, DecalVertex *result)
          {
              int count = 0;
              for (int a = 0; a < vertexCount; a++)
              {
                  const DecalVertex& v1 = vertex[a];
                  const DecalVertex& v2 = vertex[(a + 1) % vertexCount];
                  float d1 = DotPoint(plane, v1.position);      // K . V1
                  float d2 = DotPoint(plane, v2.position);      // K . V2

                  if (d1 >= 0.0f) result[count++] = v1;         // keep vertices not on the negative side
                  if ((d1 >= 0.0f) != (d2 >= 0.0f))             // this edge crosses the plane
                  {
                      float t = d1 / (d1 - d2);                 // K.V1 / K.(V1 - V2)
                      result[count].position = v1.position + (v2.position - v1.position) * t;
                      result[count].normal = v1.normal + (v2.normal - v1.normal) * t;
                      count++;
                  }
              }
              return count;     // 0 if every vertex was on the negative side
          }
        `,
      },
      {
        title: "Texture coordinates and alpha",
        formula: String.raw`s = \frac{\mathbf T\cdot(\mathbf Q-\mathbf P)}{w} + \frac12,\quad t = \frac{\mathbf B\cdot(\mathbf Q-\mathbf P)}{h} + \frac12,\quad \alpha = \frac{\mathbf N\cdot\mathbf R/\lVert\mathbf R\rVert - \varepsilon}{1-\varepsilon}`,
        code: String.raw`
          struct DecalAttributes { float s, t, alpha; };

          DecalAttributes GetDecalAttributes(const Decal& decal, const DecalVertex& v, float epsilon)
          {
              Vector3D b = Cross(decal.normal, decal.tangent);
              Vector3D q = v.position - decal.center;                     // Q - P

              DecalAttributes out;
              out.s = Dot(decal.tangent, q) / decal.width + 0.5f;
              out.t = Dot(b, q) / decal.height + 0.5f;

              // R was interpolated during clipping, so it may not be unit length
              float cosine = Dot(decal.normal, v.normal) / Magnitude(v.normal);
              out.alpha = Clamp((cosine - epsilon) / (1.0f - epsilon), 0.0f, 1.0f);
              return out;
          }
        `,
      },
      {
        title: "Adding one surface triangle to the decal mesh",
        formula: String.raw`\mathbf N\cdot\mathbf M \ge \varepsilon \;\Rightarrow\; \text{clip to 6 planes} \;\Rightarrow\; \text{fan}`,
        code: String.raw`
          void AddTriangleToDecal(const Decal& decal, const Plane plane[6], const DecalVertex tri[3],
                                  float epsilon, std::vector<DecalVertex>& mesh)
          {
              Vector3D m = Normalize(Cross(tri[1].position - tri[0].position,
                                           tri[2].position - tri[0].position));
              if (Dot(decal.normal, m) < epsilon) return;       // faces away from the decal

              DecalVertex buffer[2][9];                         // 3 + 6 planes = at most 9 vertices
              for (int i = 0; i < 3; i++) buffer[0][i] = tri[i];
              int count = 3, src = 0;

              for (int k = 0; k < 6; k++)
              {
                  count = ClipPolygon(count, buffer[src], plane[k], buffer[1 - src]);
                  src = 1 - src;
                  if (count == 0) return;                       // completely outside the decal box
              }

              for (int i = 1; i + 1 < count; i++)               // emit a triangle fan
              {
                  mesh.push_back(buffer[src][0]);
                  mesh.push_back(buffer[src][i]);
                  mesh.push_back(buffer[src][i + 1]);
              }
          }
        `,
      },
    ],
  });
  function finishPoly(id, summary, subs, formula) { L3D.topic({id,summary,lesson:`<p>${summary}</p>${subs.map(([s,n])=>`<h2 data-sub="${s}">${n}</h2><p>${n} keeps polygonal data stable as the camera and object configuration changes.</p>`).join("")}<div class="formula">\\[${formula}\\]</div><div class="game">These techniques prevent artifacts and reduce geometry where it is visually safe.</div><p><a class="btn goto-sim" href="#/${id}/sim">Inspect the polygon →</a></p>`,keyFormulas:[["Geometric rule",formula]],exercises:[{q:"Why triangulate?",a:"<p>GPU rasterizers consume triangles with unambiguous interpolation.</p>"}],sims:[{title:"Polygon clipping view",help:"<p>Move the clipping boundary to see which vertices and edges survive.</p>",mount(sim){const {stage,controls,readout}=sim.layout();const v=sim.view2d(stage,{range:4});const out=sim.readout(readout);const cut=sim.slider(controls,{label:"Clip x",min:-3,max:3,step:.1,value:.5,onInput:()=>v.redraw()});const pts=[[-2,-1],[1,-2],[2,1],[-1,2]];v.onDraw(x=>{x.grid();x.axes();x.polygon(pts,{color:"a",fill:"a",fillAlpha:.18});x.line([cut.value,-4],[cut.value,4],{color:"e",width:3});pts.forEach(p=>x.point(p,{color:p[0]<=cut.value?"c":"muted"}));out.set(sim.rows([["inside vertices",pts.filter(p=>p[0]<=cut.value).length],["boundary",L3D.math.fmt(cut.value)]]));});}}],cpp:[{title:"Half-space test",formula,code:String.raw`bool Inside(float signedDistance) { return signedDistance >= 0.0f; }`}]});}
  finishPoly("9.3","Billboarding orients a simple primitive toward the viewer while optionally preserving an up axis.",[["9.3.1","Unconstrained Quads"],["9.3.2","Constrained Quads"],["9.3.3","Polyboards"]],String.raw`\mathbf r=\frac{\mathbf u\times\mathbf v}{\|\mathbf u\times\mathbf v\|}`);
  finishPoly("9.4","Polygon reduction removes detail while preserving the shape and appearance that matter at the current scale.",[],String.raw`E=\sum_i w_i e_i`);
  finishPoly("9.5","T-junction elimination splits edges at shared vertices so rasterization cannot expose cracks.",[],String.raw`\mathbf p(t)=\mathbf a+t(\mathbf b-\mathbf a)`);
  finishPoly("9.6","Triangulation decomposes a simple polygon into triangles for rendering and robust geometric processing.",[],String.raw`n\text{-gon}\rightarrow n-2\text{ triangles}`);
})();
