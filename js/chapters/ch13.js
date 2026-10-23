// Chapter 13 - Linear Physics
(function () {
  "use strict";
  const { V, fmt, fmtVec, rad, deg, clamp } = L3D.math;

  // ===========================================================================
  // Shared helpers
  // ===========================================================================

  // Make a uniform-scale view2d show the world box [x0, x1] x [y0, y1] (centered, aspect kept).
  function fitView(v, x0, x1, y0, y1) {
    const w = Math.max(v.w, 1), h = Math.max(v.h, 1);
    v.range = Math.max((y1 - y0) / 2, ((x1 - x0) / 2) * (h / w));
    v.center = [(x0 + x1) / 2, (y0 + y1) / 2];
  }

  // Grid + labeled axes for a time plot.
  function plotFrame(v, xLabel, yLabel) {
    v.grid();
    v.axes({ ticks: true, labels: [xLabel, yLabel] });
  }

  // "+ 1.23" / "− 1.23" for building formula strings.
  const signed = (x, d = 2) => (x < 0 ? " − " : " + ") + fmt(Math.abs(x), d);

  // Solve x'' + a x' + b x = 0 with x(0) = x0, x'(0) = v0 (Section 13.2).
  function solveHomogeneous(a, b, x0, v0) {
    const disc = a * a - 4 * b;
    if (Math.abs(disc) < 1e-6) {
      const r = -a / 2, A = x0, B = v0 - r * x0;
      return {
        kind: "repeated", disc, roots: [[r, 0], [r, 0]], growth: r,
        x: (t) => (A + B * t) * Math.exp(r * t),
        consts: `A = ${fmt(A)}, B = ${fmt(B)}`,
        text: `x(t) = (${fmt(A)}${signed(B)} t) e^(${fmt(r)} t)`,
      };
    }
    if (disc > 0) {
      const s = Math.sqrt(disc), r1 = (-a + s) / 2, r2 = (-a - s) / 2;
      const A = (v0 - r2 * x0) / (r1 - r2), B = (r1 * x0 - v0) / (r1 - r2);
      return {
        kind: "real", disc, roots: [[r1, 0], [r2, 0]], growth: Math.abs(A) > 1e-9 ? r1 : r2,
        x: (t) => A * Math.exp(r1 * t) + B * Math.exp(r2 * t),
        consts: `A = ${fmt(A)}, B = ${fmt(B)}`,
        text: `x(t) = ${fmt(A)} e^(${fmt(r1)} t)${signed(B)} e^(${fmt(r2)} t)`,
      };
    }
    const al = -a / 2, be = Math.sqrt(-disc) / 2, C1 = x0, C2 = (v0 - al * x0) / be;
    return {
      kind: "complex", disc, roots: [[al, be], [al, -be]], growth: al, alpha: al, beta: be,
      x: (t) => Math.exp(al * t) * (C1 * Math.cos(be * t) + C2 * Math.sin(be * t)),
      consts: `C₁ = ${fmt(C1)}, C₂ = ${fmt(C2)}`,
      text: `x(t) = e^(${fmt(al)} t) (${fmt(C1)} cos ${fmt(be)}t${signed(C2)} sin ${fmt(be)}t)`,
    };
  }

  // RK4 samples of x'' = f(t) - a x' - b x (used as an independent numerical check).
  function rk4Samples(a, b, f, x0, v0, T, n) {
    const acc = (t, x, v) => f(t) - a * v - b * x;
    const h = T / n, pts = [[0, x0]];
    let x = x0, v = v0, t = 0;
    for (let i = 0; i < n; i++) {
      const k1x = v, k1v = acc(t, x, v);
      const k2x = v + 0.5 * h * k1v, k2v = acc(t + h / 2, x + 0.5 * h * k1x, v + 0.5 * h * k1v);
      const k3x = v + 0.5 * h * k2v, k3v = acc(t + h / 2, x + 0.5 * h * k2x, v + 0.5 * h * k2v);
      const k4x = v + h * k3v, k4v = acc(t + h, x + h * k3x, v + h * k3v);
      x += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
      v += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
      t += h;
      pts.push([t, x]);
    }
    return pts;
  }

  // Ideal projectile (2D: horizontal, vertical) and the linear-drag version (Section 13.4).
  function projectile(p0, v0, g, t) {
    return [p0[0] + v0[0] * t, p0[1] + v0[1] * t - 0.5 * g * t * t];
  }
  function dragProjectile(p0, v0, g, k, t) {
    if (k < 1e-5) return projectile(p0, v0, g, t);
    const e = 1 - Math.exp(-k * t);
    const gv = [0, -g];
    // x(t) = x0 + (g/k) t + ((k v0 - g) / k^2)(1 - e^{-kt})
    return [0, 1].map((i) => p0[i] + (gv[i] / k) * t + ((k * v0[i] - gv[i]) / (k * k)) * e);
  }
  function dragVelocity(v0, g, k, t) {
    if (k < 1e-5) return [v0[0], v0[1] - g * t];
    const vT = [0, -g / k], e = Math.exp(-k * t);
    return [vT[0] + (v0[0] - vT[0]) * e, vT[1] + (v0[1] - vT[1]) * e];
  }
  // Sample a trajectory until it drops below z = 0 (after leaving), interpolating the landing point.
  function sampleUntilGround(fn, tMax, dt) {
    const pts = [fn(0)];
    let prev = pts[0], tLand = tMax;
    for (let t = dt; t <= tMax + 1e-9; t += dt) {
      const p = fn(t);
      if (p[1] < 0 && t > dt) {
        const s = prev[1] / (prev[1] - p[1]);
        tLand = t - dt + s * dt;
        pts.push([prev[0] + (p[0] - prev[0]) * s, 0]);
        return { pts, tLand };
      }
      pts.push(p);
      prev = p;
    }
    return { pts, tLand };
  }

  // ===========================================================================
  // 13.1 Position Functions
  // ===========================================================================
  L3D.topic({
    id: "13.1",
    summary: "Position, velocity and acceleration as functions of time, linked by derivatives and integrals, and Newton's second law that turns forces into motion.",

    lesson: String.raw`
      <p>A <strong>position function</strong> \(\mathbf x(t)\) gives the 3D location of an object at time \(t\).
      Time is measured from some moment where we know where the object is, usually \(t = 0\). The simplest case is
      an object moving in a straight line at a constant velocity \(\mathbf v_0\), starting at \(\mathbf x_0\):
      \[ \mathbf x(t) = \mathbf x_0 + \mathbf v_0 t. \]</p>

      <h2>Velocity and acceleration are derivatives</h2>
      <p>The <strong>velocity function</strong> is the rate at which the position changes, its derivative with respect
      to time. Physics writes a time derivative as a dot over the symbol:
      \[ \mathbf v(t) = \dot{\mathbf x}(t) = \frac{d}{dt}\mathbf x(t). \]
      Differentiate once more and you get the <strong>acceleration function</strong>:
      \[ \mathbf a(t) = \dot{\mathbf v}(t) = \ddot{\mathbf x}(t) = \frac{d^2}{dt^2}\mathbf x(t). \]
      For the straight-line motion above, \(\mathbf v(t) = \mathbf v_0\) and \(\mathbf a(t) = \mathbf 0\).
      Each of the three components is differentiated on its own, so everything here works one axis at a time.</p>

      <table>
        <tr><th>quantity</th><th>symbol</th><th>is the derivative of</th><th>integrate it to get</th></tr>
        <tr><td>position</td><td>\(\mathbf x(t)\)</td><td>(nothing)</td><td>(nothing)</td></tr>
        <tr><td>velocity</td><td>\(\mathbf v(t) = \dot{\mathbf x}\)</td><td>position</td><td>change in position</td></tr>
        <tr><td>acceleration</td><td>\(\mathbf a(t) = \ddot{\mathbf x}\)</td><td>velocity</td><td>change in velocity</td></tr>
      </table>

      <h2>Going backward: integration</h2>
      <p>If you know the velocity, integrating it over a time interval gives how far the object moved:
      \[ \mathbf d = \int_{t_1}^{t_2} \mathbf v(t)\,dt. \]
      On a graph of one velocity component, this is the signed <em>area under the curve</em>. Area below the axis
      counts as negative, because the object is moving backward then.</p>
      <p>Now take a <strong>constant acceleration</strong> \(\mathbf a_0\). The velocity grows linearly,
      \(\mathbf v(t) = \mathbf v_0 + \mathbf a_0 t\). Integrating that from \(0\) to \(t\) gives the distance
      \(\mathbf v_0 t + \tfrac12\mathbf a_0 t^2\), and adding the starting point gives the most-used formula in game
      physics:</p>
      <div class="formula">
        \[ \mathbf x(t) = \mathbf x_0 + \mathbf v_0 t + \tfrac12 \mathbf a_0 t^2 \]
      </div>
      <p>The \(\tfrac12\) comes from the area of a triangle. During the interval the velocity rises in a straight line
      from \(\mathbf v_0\) to \(\mathbf v_0 + \mathbf a_0 t\), so the extra area above the \(\mathbf v_0\) rectangle
      is a triangle with base \(t\) and height \(\mathbf a_0 t\).</p>

      <h2>From forces to motion</h2>
      <p>Usually we don't know the acceleration directly. We know the <em>forces</em>. Newton's second law says the
      sum of all forces on an object equals its mass times its acceleration:
      \[ \sum_{i=1}^{N} \mathbf F_i(t) = m\,\mathbf a(t) = m\,\ddot{\mathbf x}(t). \]
      A force can be constant (gravity near the ground), depend on position (a spring pulling toward its rest
      length), or depend on velocity (air resistance). Whatever their form, this equation relates \(\mathbf x\) to its
      own second derivative. That makes it a <strong>second-order differential equation</strong>, and solving it gives
      the position function. Section 13.2 shows how to solve the kinds of equations that come up in this chapter and
      in Chapter 14.</p>

      <div class="game">A physics engine does the same thing in small steps. Each frame it sums the forces, divides by
      the mass to get an acceleration, then moves the velocity and position forward by \(\Delta t\). When the
      acceleration is constant during the step, the update
      <code>x += v*dt + 0.5f*a*dt*dt; v += a*dt;</code> is <em>exact</em>, because it is the formula above with
      \(t = \Delta t\).</div>

      <div class="warn">The popular shortcut <code>x += v*dt; v += a*dt;</code> (explicit Euler) drops the
      \(\tfrac12\mathbf a\,\Delta t^2\) term. Even under constant gravity its error grows by
      \(\tfrac12 a\,\Delta t\,t\) over time, so a jump reaches a different height at 30 fps than at 144 fps. If
      gameplay depends on exact arcs, use the exact formula or a fixed time step.</div>

      <p><a class="btn goto-sim" href="#/13.1/sim">Try it: shape the acceleration and watch velocity and position follow →</a></p>
    `,

    keyFormulas: [
      ["Velocity", String.raw`\mathbf v(t) = \dot{\mathbf x}(t) = \tfrac{d}{dt}\mathbf x(t)`],
      ["Acceleration", String.raw`\mathbf a(t) = \dot{\mathbf v}(t) = \ddot{\mathbf x}(t)`],
      ["Distance from velocity", String.raw`\mathbf d = \int_{t_1}^{t_2}\mathbf v(t)\,dt`],
      ["Constant acceleration", String.raw`\mathbf x(t) = \mathbf x_0 + \mathbf v_0 t + \tfrac12\mathbf a_0 t^2`],
      ["Newton's second law", String.raw`\textstyle\sum_i \mathbf F_i(t) = m\,\ddot{\mathbf x}(t)`],
    ],

    exercises: [
      { q: "A car at x₀ = 5 m moves at 3 m/s and accelerates at a constant 2 m/s². Where is it after 4 s, and how fast is it going?",
        a: String.raw`\(x = 5 + 3\cdot4 + \tfrac12\cdot2\cdot16 = 33\) m and \(v = 3 + 2\cdot4 = 11\) m/s.` },
      { q: String.raw`An object moves along \(x(t) = 2t^3 - 3t^2 + 1\). When is it momentarily at rest, and what is its acceleration then?`,
        a: String.raw`\(v = 6t^2 - 6t = 6t(t - 1)\), which is zero at \(t = 0\) and \(t = 1\). Since \(a = 12t - 6\), the acceleration is \(-6\) at \(t = 0\) and \(+6\) at \(t = 1\).` },
      { q: "A ball is dropped from rest. How far does it fall in the first 2 seconds (g = 9.8 m/s²)? How far in the next 2 seconds?",
        a: String.raw`\(\tfrac12 g t^2 = 19.6\) m after 2 s, and \(\tfrac12 g\cdot 16 = 78.4\) m after 4 s, so it falls \(58.8\) m during the second interval. Distance grows with \(t^2\), not \(t\).` },
      { q: String.raw`Why is <code>x += v*dt; v += a*dt;</code> wrong even when \(a\) is constant, and what fixes it?`,
        a: String.raw`It moves the whole step at the starting velocity \(v\), but the true average velocity over the step is \(v + \tfrac12 a\Delta t\). Adding \(\tfrac12 a\Delta t^2\) to the position update makes it exact.` },
    ],

    sims: [
      {
        title: "Acceleration → velocity → position",
        help: String.raw`<p>The acceleration is constant on each of four 2-second intervals. Drag the red handles to
          change each level. The velocity graph is the running integral of acceleration, and the position graph is the
          running integral of velocity. The shaded area under \(v(t)\) always equals \(x(t) - x_0\). The car at the top
          moves along with the time cursor.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const T = 8, SEG = 4, dT = T / SEG;
          const track = sim.view2d(stage, { height: 80, xRange: [-2, 20], yRange: [-1, 1] });
          const va = sim.view2d(stage, { height: 150, xRange: [-0.35, T + 0.2], yRange: [-3.6, 3.6] });
          const vv = sim.view2d(stage, { height: 150, xRange: [-0.35, T + 0.2], yRange: [-8, 8] });
          const vx = sim.view2d(stage, { height: 150, xRange: [-0.35, T + 0.2], yRange: [-5, 25] });
          const out = sim.readout(readout);
          const init = [2, 0, -1.5, -0.5];
          const hs = init.map((a, i) => va.handle([dT * (i + 0.5), a], {
            color: "e", snap: 0.25,
            constrain: (p) => [dT * (i + 0.5), clamp(p[1], -3, 3)],
            onDrag: redrawAll,
          }));
          const x0 = sim.slider(controls, { label: "Initial position x₀", min: -5, max: 5, step: 0.5, value: 0, unit: " m", onInput: redrawAll });
          const v0 = sim.slider(controls, { label: "Initial velocity v₀", min: -4, max: 4, step: 0.5, value: 0, unit: " m/s", onInput: redrawAll });
          const time = sim.slider(controls, { label: "Time t", min: 0, max: T, step: 0.01, value: 0, unit: " s", onInput: (x) => { play.value = false; t = x; redrawAll(); } });
          const play = sim.checkbox(controls, { label: "Play", value: true });
          sim.buttons(controls, [{ label: "Reset accelerations", onClick: () => { hs.forEach((h, i) => h.set([dT * (i + 0.5), init[i]])); redrawAll(); } }]);
          sim.legend(controls, [["a", "car on the track (x in m)"], ["c", "velocity arrow"], ["e", "acceleration arrow"]]);
          let t = 0;

          function redrawAll() { track.redraw(); va.redraw(); vv.redraw(); vx.redraw(); }

          // Integrate the piecewise-constant acceleration exactly, one interval at a time.
          function stateAt(tt) {
            let x = x0.value, v = v0.value;
            for (let i = 0; i < SEG; i++) {
              const a = hs[i].pos[1], t0 = i * dT;
              if (tt <= t0 + dT || i === SEG - 1) {
                const tau = clamp(tt - t0, 0, dT);
                return { a, v: v + a * tau, x: x + v * tau + 0.5 * a * tau * tau, seg: i, tau, xs: x, vs: v };
              }
              x += v * dT + 0.5 * a * dT * dT;
              v += a * dT;
            }
            return null;
          }
          const samples = () => {
            const pts = [];
            for (let i = 0; i <= 160; i++) { const tt = (T * i) / 160; pts.push([tt, stateAt(tt)]); }
            return pts;
          };

          sim.loop((dt) => {
            if (!play.value) return;
            t += dt;
            if (t > T + 0.8) t = 0;
            time.value = Math.min(t, T);
            redrawAll();
          });

          track.onDraw((v) => {
            const S = samples();
            const xs = S.map((s) => s[1].x);
            const lo = Math.min(...xs, 0) - 1.5, hi = Math.max(...xs, 1) + 1.5;
            v.opts.xRange = [lo, hi];
            const st = stateAt(Math.min(t, T));
            v.line([lo, -0.35], [hi, -0.35], { color: "axis", width: 1.5 });
            for (let k = Math.ceil(lo); k <= hi; k++) {
              if (k % 5 === 0) v.text([k, -0.35], String(k), { color: "muted", size: 10, align: "center", offset: [0, 14] });
              v.line([k, -0.35], [k, k % 5 === 0 ? -0.15 : -0.25], { color: "axis", width: 1 });
            }
            v.rect([st.x - 0.45, -0.3], [st.x + 0.45, 0.2], { fill: "a", fillAlpha: 0.85, color: "a" });
            if (Math.abs(st.v) > 0.05) v.arrow([st.x, 0.55], [st.x + st.v * 0.35, 0.55], { color: "c", width: 2.5 });
            if (Math.abs(st.a) > 0.05) v.arrow([st.x, 0.8], [st.x + st.a * 0.35, 0.8], { color: "e", width: 2 });
          });

          va.onDraw((v) => {
            plotFrame(v, "t (s)", "a(t)");
            const pts = [];
            hs.forEach((h, i) => { pts.push([i * dT, h.pos[1]], [(i + 1) * dT, h.pos[1]]); });
            v.polyline(pts, { color: "e", width: 3 });
            v.line([Math.min(t, T), -3.6], [Math.min(t, T), 3.6], { color: "muted", dash: [4, 4], width: 1 });
          });

          vv.onDraw((v) => {
            const S = samples(), tt = Math.min(t, T);
            const vs = S.map((s) => s[1].v);
            const m = Math.max(2, ...vs.map(Math.abs)) * 1.15;
            v.opts.yRange = [-m, m];
            plotFrame(v, "t (s)", "v(t)");
            const area = [[0, 0], ...S.filter((s) => s[0] <= tt).map((s) => [s[0], s[1].v]), [tt, stateAt(tt).v], [tt, 0]];
            v.polygon(area, { fill: "c", fillAlpha: 0.18, stroke: false });
            v.polyline(S.map((s) => [s[0], s[1].v]), { color: "c", width: 3 });
            v.point([tt, stateAt(tt).v], { color: "c", r: 5 });
            v.line([tt, -m], [tt, m], { color: "muted", dash: [4, 4], width: 1 });
          });

          vx.onDraw((v) => {
            const S = samples(), tt = Math.min(t, T);
            const xs = S.map((s) => s[1].x);
            const lo = Math.min(...xs, x0.value) - 1.5, hi = Math.max(...xs, x0.value) + 1.5;
            v.opts.yRange = [lo, hi];
            plotFrame(v, "t (s)", "x(t)");
            v.line([0, x0.value], [T, x0.value], { color: "muted", dash: [5, 5], width: 1 });
            v.polyline(S.map((s) => [s[0], s[1].x]), { color: "a", width: 3 });
            const st = stateAt(tt);
            v.point([tt, st.x], { color: "a", r: 5 });
            v.line([tt, lo], [tt, hi], { color: "muted", dash: [4, 4], width: 1 });

            out.set(sim.rows([
              ["t", fmt(tt) + " s"],
              [sim.swatch("e") + "a(t)", fmt(st.a) + " m/s²"],
              [sim.swatch("c") + "v(t)", fmt(st.v) + " m/s"],
              [sim.swatch("a") + "x(t)", fmt(st.x) + " m"],
              ["area under v = x − x₀", fmt(st.x - x0.value) + " m"],
            ]) + `<hr>Interval ${st.seg + 1} started at x = ${fmt(st.xs)}, v = ${fmt(st.vs)}:` +
              `<div class="eq">x = ${fmt(st.xs)}${signed(st.vs)}·τ${signed(0.5 * st.a)}·τ²\nτ = t − ${fmt(st.seg * dT)} = ${fmt(st.tau)} s</div>` +
              `Where a(t) is constant, v(t) is a straight line and x(t) is a parabola.`);
          });
        },
      },
      {
        title: "Exact formula vs. Euler steps",
        help: String.raw`<p>A ball is thrown straight up. The solid curve is the exact \(z(t) = v_0t - \tfrac12gt^2\).
          The dots are three per-frame integrators using the time step \(\Delta t\). Increase \(\Delta t\): explicit
          Euler drifts above the true path and semi-implicit Euler drifts below it, both by about
          \(\tfrac12 g\,\Delta t\,t\). The step that includes \(\tfrac12 a\Delta t^2\) lands exactly on the curve.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { height: 440, xRange: [-0.2, 3], yRange: [-1, 9] });
          const out = sim.readout(readout);
          const r = () => view.redraw();
          const v0 = sim.slider(controls, { label: "Launch speed v₀", min: 4, max: 20, step: 0.5, value: 12, unit: " m/s", onInput: r });
          const g = sim.slider(controls, { label: "Gravity g", min: 1.6, max: 20, step: 0.1, value: 9.8, unit: " m/s²", onInput: r });
          const dt = sim.slider(controls, { label: "Time step Δt", min: 0.02, max: 0.5, step: 0.01, value: 0.2, unit: " s", onInput: r });
          const showE = sim.checkbox(controls, { label: "Explicit Euler: x += v Δt; v += a Δt", value: true, onChange: r });
          const showS = sim.checkbox(controls, { label: "Semi-implicit Euler: v first, then x", value: true, onChange: r });
          const showX = sim.checkbox(controls, { label: "Exact step: x += v Δt + ½ a Δt²", value: true, onChange: r });
          sim.legend(controls, [["fg", "exact z(t)"], ["e", "explicit"], ["b", "semi-implicit"], ["c", "exact step"]]);

          view.onDraw((v) => {
            const G = g.value, V0 = v0.value, h = dt.value;
            const Tl = (2 * V0) / G, H = (V0 * V0) / (2 * G);
            v.opts.xRange = [-0.06 * Tl, Tl * 1.12];
            v.opts.yRange = [-0.3 * H, H * 1.3];
            plotFrame(v, "t (s)", "z (m)");
            const exact = (t) => V0 * t - 0.5 * G * t * t;
            v.plot(exact, { color: "fg", width: 2.5, from: 0, to: Tl * 1.1 });
            const N = Math.max(1, Math.ceil((Tl * 1.1) / h));
            const run = (kind) => {
              let z = 0, vz = V0;
              const pts = [[0, 0]];
              for (let i = 1; i <= N; i++) {
                if (kind === "explicit") { z += vz * h; vz -= G * h; }
                else if (kind === "semi") { vz -= G * h; z += vz * h; }
                else { z += vz * h - 0.5 * G * h * h; vz -= G * h; }
                pts.push([i * h, z]);
              }
              return pts;
            };
            const methods = [["explicit", "e", showE, "explicit Euler"], ["semi", "b", showS, "semi-implicit"], ["exact", "c", showX, "exact step"]];
            const nEnd = Math.max(1, Math.floor(Tl / h)), tEnd = nEnd * h;
            const rows = [["exact apex height", fmt(H) + " m"], ["compare at t = " + fmt(tEnd) + " s", "z = " + fmt(exact(tEnd))]];
            for (const [kind, col, cb, name] of methods) {
              const pts = run(kind);
              if (cb.value) {
                v.polyline(pts, { color: col, width: 1.5, alpha: 0.7 });
                pts.forEach((p) => v.point(p, { color: col, r: 3.5 }));
              }
              const err = pts[nEnd][1] - exact(tEnd);
              rows.push([sim.swatch(col) + name + " error", `<span class="${Math.abs(err) < 1e-6 ? "ok" : "bad"}">${err >= 0 ? "+" : ""}${fmt(err, 3)} m</span>`]);
            }
            out.set(sim.rows(rows) + `<hr>Predicted Euler drift: ½ g Δt t = <b>${fmt(0.5 * G * h * tEnd, 3)} m</b>. It shrinks only linearly with Δt, so halving the step halves the error.`);
          });
        },
      },
    ],

    cpp: [
      {
        title: "Position and velocity under constant acceleration",
        formula: String.raw`\mathbf x(t) = \mathbf x_0 + \mathbf v_0 t + \tfrac12\mathbf a_0 t^2 \qquad \mathbf v(t) = \mathbf v_0 + \mathbf a_0 t`,
        code: String.raw`
          Point3D PositionAtTime(const Point3D& x0, const Vector3D& v0, const Vector3D& a0, float t)
          {
              return x0 + v0 * t + a0 * (0.5f * t * t);       // x0 + v0 t + 1/2 a0 t^2
          }

          Vector3D VelocityAtTime(const Vector3D& v0, const Vector3D& a0, float t)
          {
              return v0 + a0 * t;                              // derivative of the line above
          }
        `,
      },
      {
        title: "A per-frame step that is exact for constant acceleration",
        formula: String.raw`\mathbf x \leftarrow \mathbf x + \mathbf v\,\Delta t + \tfrac12\mathbf a\,\Delta t^2, \qquad \mathbf v \leftarrow \mathbf v + \mathbf a\,\Delta t`,
        note: "<p>Update the position <em>before</em> the velocity, because the position formula needs the velocity from the start of the step.</p>",
        code: String.raw`
          struct Particle
          {
              Point3D  position;
              Vector3D velocity;
          };

          void Step(Particle& p, const Vector3D& acceleration, float dt)
          {
              // The average velocity over the step is v + a dt / 2, so this is exact for constant a.
              p.position += p.velocity * dt + acceleration * (0.5f * dt * dt);
              p.velocity += acceleration * dt;
          }
        `,
      },
      {
        title: "Newton's second law: accumulate forces, then integrate",
        formula: String.raw`\textstyle\sum_i \mathbf F_i = m\,\mathbf a \;\;\Rightarrow\;\; \mathbf a = \frac{1}{m}\sum_i\mathbf F_i`,
        code: String.raw`
          struct Body
          {
              float    mass;
              Point3D  position;
              Vector3D velocity;
              Vector3D forceAccum;      // cleared after every step
          };

          void AddForce(Body& b, const Vector3D& f)
          {
              b.forceAccum += f;
          }

          void Integrate(Body& b, float dt)
          {
              Vector3D a = b.forceAccum / b.mass;                    // a = (sum of F_i) / m
              b.position += b.velocity * dt + a * (0.5f * dt * dt);
              b.velocity += a * dt;
              b.forceAccum = Vector3D(0.0f, 0.0f, 0.0f);
          }
        `,
      },
      {
        title: "Displacement as the integral of velocity",
        formula: String.raw`\mathbf d = \int_{t_1}^{t_2}\mathbf v(t)\,dt \approx h\left[\tfrac12\mathbf v(t_1) + \sum_{i=1}^{n-1}\mathbf v(t_1 + ih) + \tfrac12\mathbf v(t_2)\right]`,
        note: "<p>The trapezoid rule adds up thin strips of area under the velocity curve. For a velocity that is linear in time (constant acceleration) it is exact.</p>",
        code: String.raw`
          // v is any callable float -> Vector3D, e.g. a lambda that samples a recorded path.
          template <typename VelocityFunc>
          Vector3D Displacement(VelocityFunc v, float t1, float t2, int steps)
          {
              float h = (t2 - t1) / static_cast<float>(steps);
              Vector3D d = (v(t1) + v(t2)) * (0.5f * h);              // the two half-weighted ends
              for (int i = 1; i < steps; i++)
              {
                  d += v(t1 + h * static_cast<float>(i)) * h;           // full-weighted interior samples
              }
              return d;
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 13.2 Second-Order Differential Equations
  // ===========================================================================
  L3D.topic({
    id: "13.2",
    summary: "Solving x″ + a x′ + b x = f(t): the auxiliary equation, its three kinds of roots, particular solutions, and fitting initial conditions.",

    lesson: String.raw`
      <p>Almost every force law in this chapter and the next leads to an equation of the form
      \[ \ddot x(t) + a\,\dot x(t) + b\,x(t) = f(t), \]
      often written with primes as \(x'' + a x' + b x = f(t)\). It is <strong>second-order</strong> (the highest
      derivative is the second), <strong>linear</strong> (\(x\) and its derivatives appear only to the first power)
      and, in this book, has <strong>constant coefficients</strong> \(a\) and \(b\). A damped spring
      (\(a\) from friction, \(b\) from stiffness) and a falling object with air resistance (Section 13.4) are both
      of this type.</p>

      <h2 data-sub="13.2.1">Homogeneous Equations</h2>
      <p>When \(f(t) = 0\) the equation is called <strong>homogeneous</strong>:
      \( x'' + a x' + b x = 0 \). Two facts make it easy to solve.</p>
      <ul>
        <li><b>Superposition.</b> If \(x_1\) and \(x_2\) are solutions, so is \(Ax_1 + Bx_2\) for any constants.
          Plug it in and the left side splits into \(A\cdot 0 + B\cdot 0\).</li>
        <li><b>Exponentials keep their shape.</b> Try \(x = e^{rt}\). Then \(x' = re^{rt}\) and \(x'' = r^2e^{rt}\),
          so every term carries the same factor \(e^{rt}\), which is never zero. Divide it out and what's left is an
          ordinary quadratic, the <strong>auxiliary</strong> (or characteristic) <strong>equation</strong>:</li>
      </ul>
      <div class="formula">
        \[ r^2 + a r + b = 0 \qquad\Rightarrow\qquad r_{1,2} = -\frac a2 \pm \frac12\sqrt{a^2 - 4b} \]
      </div>
      <p>The sign of the discriminant \(a^2 - 4b\) decides which of three forms the general solution takes:</p>
      <table>
        <tr><th>case</th><th>roots</th><th>general solution</th></tr>
        <tr><td>\(a^2 - 4b \gt 0\)</td><td>two real roots \(r_1 \ne r_2\)</td><td>\(x = Ae^{r_1t} + Be^{r_2t}\)</td></tr>
        <tr><td>\(a^2 - 4b = 0\)</td><td>one repeated root \(r = -a/2\)</td><td>\(x = Ae^{rt} + Bte^{rt}\)</td></tr>
        <tr><td>\(a^2 - 4b \lt 0\)</td><td>complex pair \(\alpha \pm i\beta\)</td><td>\(x = e^{\alpha t}(C_1\cos\beta t + C_2\sin\beta t)\)</td></tr>
      </table>
      <p><b>Distinct real roots.</b> For \(x'' - 5x' + 6x = 0\) the auxiliary equation is
      \(r^2 - 5r + 6 = (r-2)(r-3) = 0\), so \(x = Ae^{2t} + Be^{3t}\).</p>
      <p><b>Repeated root.</b> When \(a^2 = 4b\) the exponential trick gives only one function, \(e^{rt}\). A second,
      independent solution is \(te^{rt}\). You can check it by substituting: the terms cancel exactly because
      \(r = -a/2\).</p>
      <p><b>Complex roots.</b> When \(a^2 \lt 4b\), write the roots as \(\alpha \pm i\beta\) with
      \[ \alpha = -\frac a2, \qquad \beta = \frac12\sqrt{4b - a^2}. \]
      The solution \(Ae^{(\alpha+i\beta)t} + Be^{(\alpha-i\beta)t}\) is correct but complex. Euler's formula
      \(e^{\alpha + i\beta} = e^\alpha(\cos\beta + i\sin\beta)\) (Appendix D) turns it into real functions, and
      choosing \(A\) and \(B\) as a conjugate pair leaves
      \[ x(t) = e^{\alpha t}(C_1\cos\beta t + C_2\sin\beta t). \]
      For \(x'' + 4x = 0\), \(\alpha = 0\) and \(\beta = 2\), so \(x = C_1\cos2t + C_2\sin2t\): a pure oscillation.</p>
      <p>The two trig terms can be merged into one shifted sine. Let \(D = \sqrt{C_1^2 + C_2^2}\) and pick the angle
      \(\delta\) with \(\sin\delta = C_1/D\) and \(\cos\delta = C_2/D\) (the legs and hypotenuse of a right triangle).
      The angle-sum identity then gives
      \[ x(t) = De^{\alpha t}\sin(\beta t + \delta), \]
      an oscillation with amplitude \(D\), phase \(\delta\), angular frequency \(\beta\) and an envelope
      \(e^{\alpha t}\) that shrinks when \(\alpha \lt 0\).</p>
      <div class="key">The roots tell you the behavior before you solve anything. A negative real part means decay, a
      positive real part means growth, and an imaginary part means oscillation with angular frequency \(\beta\).
      Plotted in the complex plane, roots in the left half mean a stable system.</div>

      <h2 data-sub="13.2.2">Nonhomogeneous Equations</h2>
      <p>When \(f(t) \ne 0\), the solution is the sum of two pieces:
      \[ x(t) = g(t) + p(t). \]
      Here \(g\) is the general solution of the homogeneous equation and \(p\) is any one <strong>particular
      solution</strong> of the full equation. Substituting shows why this works: \(g\) contributes \(0\) and \(p\)
      contributes \(f(t)\), so together they produce exactly \(f(t)\).</p>
      <p>To find \(p\), the <strong>method of undetermined coefficients</strong> guesses a function that looks like
      \(f\) and its derivatives, with unknown coefficients, then substitutes and matches like terms:</p>
      <table>
        <tr><th>forcing \(f(t)\)</th><th>guess for \(p(t)\)</th></tr>
        <tr><td>constant \(c\)</td><td>constant \(D\) (or \(Dt\) when \(b = 0\))</td></tr>
        <tr><td>polynomial of degree \(n\)</td><td>polynomial of degree \(n\) with unknown coefficients</td></tr>
        <tr><td>\(c\sin\omega t\) or \(c\cos\omega t\)</td><td>\(D\sin\omega t + E\cos\omega t\)</td></tr>
        <tr><td>\(ce^{kt}\)</td><td>\(De^{kt}\)</td></tr>
      </table>
      <p><b>Example.</b> For \(x'' - 5x' + 6x = 12t - 4\), guess \(p = Dt^2 + Et + F\). Substituting gives
      \(6Dt^2 + (6E - 10D)t + (2D - 5E + 6F) = 12t - 4\). Matching coefficients: \(D = 0\), \(E = 2\), \(F = 1\), so
      \(p = 2t + 1\) and \(x = Ae^{2t} + Be^{3t} + 2t + 1\).</p>
      <p><b>Example.</b> For \(x'' + 4x = 12\sin t\), guess \(p = D\sin t + E\cos t\). Then
      \(p'' + 4p = 3D\sin t + 3E\cos t = 12\sin t\), so \(D = 4\), \(E = 0\) and
      \(x = A\cos2t + B\sin2t + 4\sin t\).</p>
      <div class="warn">If the guess already solves the homogeneous equation, substituting it gives \(0\) and no
      coefficient can match \(f\). Forcing \(x'' + 4x\) with \(\sin 2t\) is the classic case. Multiply the guess by
      \(t\): the particular solution becomes \(t\cos2t\)-like and its amplitude grows without bound. That is
      <strong>resonance</strong>, the reason soldiers break step on bridges and why a spring driven at its natural
      frequency in a game can explode.</div>

      <h2 data-sub="13.2.3">Initial Conditions</h2>
      <p>Every general solution above has two free constants. They are fixed by two <strong>initial
      conditions</strong>, the starting position and the starting velocity:
      \[ x(0) = x_0, \qquad \dot x(0) = v_0. \]
      Differentiate the general solution, set \(t = 0\) in both, and solve the resulting \(2\times2\) linear
      system.</p>
      <p><b>Example.</b> \(x'' - 5x' + 6x = 0\) with \(x(0) = 3\), \(\dot x(0) = 0\). From \(x = Ae^{2t} + Be^{3t}\)
      we get \(A + B = 3\) and \(2A + 3B = 0\), so \(A = 9\), \(B = -6\) and \(x(t) = 9e^{2t} - 6e^{3t}\).</p>
      <p><b>Example.</b> \(x'' + 4x = 12\sin t\) with \(x(0) = 0\), \(\dot x(0) = 6\). From
      \(x = A\cos2t + B\sin2t + 4\sin t\): \(x(0) = A = 0\) and \(\dot x(0) = 2B + 4 = 6\), so \(B = 1\) and
      \(x(t) = \sin2t + 4\sin t\).</p>
      <p>For the homogeneous cases the constants have simple closed forms that you can code once
      (see the C++ tab):</p>
      <ul>
        <li>distinct: \(A = \dfrac{v_0 - r_2x_0}{r_1 - r_2}\), \(B = \dfrac{r_1x_0 - v_0}{r_1 - r_2}\)</li>
        <li>repeated: \(A = x_0\), \(B = v_0 - rx_0\)</li>
        <li>complex: \(C_1 = x_0\), \(C_2 = \dfrac{v_0 - \alpha x_0}{\beta}\)</li>
      </ul>
      <div class="warn">With a forcing term, apply the initial conditions to the <em>complete</em> solution
      \(g + p\), not to \(g\) alone. Equivalently, give \(g\) the starting values \(x_0 - p(0)\) and
      \(v_0 - \dot p(0)\).</div>

      <div class="game">Closed-form solutions are the reason "critically damped" smoothing works so well for cameras
      and UI. The equation \(x'' + 2\omega x' + \omega^2(x - \text{target}) = 0\) has the repeated root
      \(r = -\omega\), so the camera reaches its target as fast as possible <em>without overshooting</em>. Because the
      solution is evaluated exactly, it is stable at any frame rate, unlike a stiff spring stepped with Euler's
      method.</div>

      <p><a class="btn goto-sim" href="#/13.2/sim">Try it: move the roots and watch the solution change →</a></p>
    `,

    keyFormulas: [
      ["Linear second-order equation", String.raw`x'' + a x' + b x = f(t)`],
      ["Auxiliary equation", String.raw`r^2 + ar + b = 0,\quad r_{1,2} = -\tfrac a2 \pm \tfrac12\sqrt{a^2 - 4b}`],
      ["Distinct / repeated roots", String.raw`x = Ae^{r_1t} + Be^{r_2t} \quad\text{or}\quad x = (A + Bt)e^{rt}`],
      ["Complex roots", String.raw`x = e^{\alpha t}(C_1\cos\beta t + C_2\sin\beta t) = De^{\alpha t}\sin(\beta t + \delta)`],
      ["Nonhomogeneous solution", String.raw`x(t) = g(t) + p(t)`],
      ["Initial conditions", String.raw`x(0) = x_0,\quad \dot x(0) = v_0`],
    ],

    exercises: [
      { q: String.raw`Solve \(x'' - 6x' + 9x = 9t + 3\).`,
        a: String.raw`The auxiliary equation \(r^2 - 6r + 9 = (r - 3)^2\) has the repeated root 3, so \(g = (A + Bt)e^{3t}\). Guess \(p = Et + F\): \(-6E + 9Et + 9F = 9t + 3\) gives \(E = 1\), \(F = 1\). So \(x = (A + Bt)e^{3t} + t + 1\).` },
      { q: String.raw`Solve \(x'' + 16x = 0\) with \(x(0) = 3\) and \(\dot x(0) = 1\).`,
        a: String.raw`Roots \(\pm4i\), so \(x = C_1\cos4t + C_2\sin4t\). \(C_1 = 3\) and \(4C_2 = 1\), giving \(x = 3\cos4t + \tfrac14\sin4t\).` },
      { q: String.raw`Describe the motion of \(x'' + 2x' + 5x = 0\) without solving for constants.`,
        a: String.raw`\(r = -1 \pm 2i\). The real part \(-1\) means the motion decays like \(e^{-t}\), and the imaginary part 2 means it oscillates with angular frequency 2 rad/s (period \(\pi\) s).` },
      { q: String.raw`For \(x'' + ax' + 9x = 0\), which value of \(a \ge 0\) returns \(x\) to zero fastest without oscillating?`,
        a: String.raw`Critical damping, where \(a^2 = 4b = 36\), so \(a = 6\). The repeated root is \(r = -3\). Smaller \(a\) oscillates; larger \(a\) gives one root closer to 0, which decays more slowly.` },
    ],

    sims: [
      {
        title: "Roots of the auxiliary equation and the solution",
        help: String.raw`<p>Set \(a\) and \(b\) with the sliders (or a preset). The lower panel shows the roots of
          \(r^2 + ar + b = 0\) in the complex plane, with the left (green) half-plane meaning decay. The upper panel
          shows the solution that matches the initial conditions. Drag the blue handle to set \(x_0\) and the orange
          handle to set the starting slope \(v_0\). Turn on the RK4 check to see a numerical integrator agree with
          the formula.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const plot = sim.view2d(stage, { height: 290, xRange: [-0.4, 10], yRange: [-3.2, 3.2] });
          const cplx = sim.view2d(stage, { height: 200, range: 3.2 });
          const out = sim.readout(readout);
          const redrawAll = () => { plot.redraw(); cplx.redraw(); };
          const a = sim.slider(controls, { label: "a (multiplies x′)", min: -2, max: 6, step: 0.1, value: 0.6, onInput: redrawAll });
          const b = sim.slider(controls, { label: "b (multiplies x)", min: -4, max: 12, step: 0.1, value: 4, onInput: redrawAll });
          const TV = 0.8;
          let v0 = 0;
          const h0 = plot.handle([0, 2], {
            color: "a", label: "x₀", constrain: (p) => [0, clamp(p[1], -3, 3)],
            onDrag: (p) => { hv.pos[0] = TV; hv.pos[1] = p[1] + v0 * TV; redrawAll(); },
          });
          const hv = plot.handle([TV, 2], {
            color: "b", label: "slope v₀", constrain: (p) => [TV, clamp(p[1], -3.1, 3.1)],
            onDrag: (p) => { v0 = (p[1] - h0.pos[1]) / TV; redrawAll(); },
          });
          const preset = (A, B) => { a.value = A; b.value = B; redrawAll(); };
          const g1 = sim.group(controls, "Presets");
          sim.buttons(g1, [
            { label: "Real (3, 2)", onClick: () => preset(3, 2) },
            { label: "Repeated (2, 1)", onClick: () => preset(2, 1) },
          ]);
          sim.buttons(g1, [
            { label: "Complex (0.6, 4)", onClick: () => preset(0.6, 4) },
            { label: "Undamped (0, 4)", onClick: () => preset(0, 4) },
          ]);
          const check = sim.checkbox(controls, { label: "RK4 numerical check (dots)", value: false, onChange: redrawAll });

          plot.onDraw((v) => {
            plotFrame(v, "t", "x(t)");
            const sol = solveHomogeneous(a.value, b.value, h0.pos[1], v0);
            v.infiniteLine([0, h0.pos[1]], [1, v0], { color: "b", dash: [5, 5], width: 1.2, alpha: 0.6 });
            if (sol.kind === "complex") {
              const D = Math.hypot(h0.pos[1], (v0 - sol.alpha * h0.pos[1]) / sol.beta);
              v.plot((t) => D * Math.exp(sol.alpha * t), { color: "muted", dash: [3, 4], width: 1, from: 0 });
              v.plot((t) => -D * Math.exp(sol.alpha * t), { color: "muted", dash: [3, 4], width: 1, from: 0 });
            }
            v.plot(sol.x, { color: "c", width: 3, from: 0 });
            if (check.value) {
              rk4Samples(a.value, b.value, () => 0, h0.pos[1], v0, 10, 40).forEach((p) => {
                if (Math.abs(p[1]) < 3.2) v.point(p, { color: "d", r: 3.5 });
              });
            }
            const kindName = { real: "two distinct real roots", repeated: "one repeated real root", complex: "complex conjugate roots" }[sol.kind];
            const beh = sol.growth < -1e-6 ? "<span class='ok'>decays to 0</span>" :
              sol.growth > 1e-6 ? "<span class='bad'>grows without bound</span>" :
                sol.kind === "complex" ? "oscillates forever (no damping)" : "levels off / drifts";
            const r1 = sol.roots[0], r2 = sol.roots[1];
            const rs = (r) => (Math.abs(r[1]) < 1e-9 ? fmt(r[0]) : `${fmt(r[0])} ${r[1] < 0 ? "−" : "+"} ${fmt(Math.abs(r[1]))}i`);
            out.set(sim.rows([
              ["equation", `x″ ${a.value < 0 ? "−" : "+"} ${fmt(Math.abs(a.value), 1)}x′ ${b.value < 0 ? "−" : "+"} ${fmt(Math.abs(b.value), 1)}x = 0`],
              ["a² − 4b", fmt(sol.disc)],
              ["roots", kindName],
              ["r₁", rs(r1)],
              ["r₂", rs(r2)],
              ["x₀, v₀", fmt(h0.pos[1]) + ", " + fmt(v0)],
              ["constants", sol.consts],
              ["behavior", beh],
            ]) + `<div class="eq">${sol.text}</div>`);
          });

          cplx.onDraw((v) => {
            const sol = solveHomogeneous(a.value, b.value, h0.pos[1], v0);
            const B = v.bounds;
            v.rect([B.xmin, B.ymin], [0, B.ymax], { fill: "c", fillAlpha: 0.08, stroke: false });
            v.rect([0, B.ymin], [B.xmax, B.ymax], { fill: "e", fillAlpha: 0.06, stroke: false });
            v.grid({ step: 1 });
            v.axes({ labels: ["Re", "Im"] });
            v.text([B.xmin + 0.15, B.ymax - 0.45], "decay (Re < 0)", { color: "c", size: 11 });
            v.text([B.xmax - 0.15, B.ymax - 0.45], "growth (Re > 0)", { color: "e", size: 11, align: "right" });
            const [r1, r2] = sol.roots;
            if (sol.kind === "complex") v.line(r1, r2, { color: "d", dash: [4, 4], width: 1.2 });
            const vis = (r) => [clamp(r[0], B.xmin + 0.1, B.xmax - 0.1), clamp(r[1], B.ymin + 0.1, B.ymax - 0.1)];
            v.point(vis(r1), { color: "d", r: 7, label: sol.kind === "repeated" ? "r (double)" : "r₁" });
            if (sol.kind !== "repeated") v.point(vis(r2), { color: "d", r: 7, label: "r₂", labelOffset: [8, 16] });
          });
        },
      },
      {
        title: "Forced motion: x = g(t) + p(t)",
        help: String.raw`<p>The equation is \(x'' + ax' + bx = f(t)\). The dashed blue curve is the homogeneous part
          \(g(t)\), the dashed orange curve is the particular solution \(p(t)\) found by undetermined coefficients, and
          the green curve is their sum, which matches \(x_0\) and \(v_0\). With damping, \(g\) dies out and only
          \(p\) remains. For sinusoidal forcing, the lower panel plots the steady amplitude against \(\omega\). Set
          \(a = 0\) and \(\omega = \sqrt b\) to hit resonance.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const plot = sim.view2d(stage, { height: 320, xRange: [-0.4, 20], yRange: [-5, 5] });
          const resp = sim.view2d(stage, { height: 150, xRange: [-0.1, 4], yRange: [-0.3, 4] });
          const out = sim.readout(readout);
          const redrawAll = () => { plot.redraw(); resp.redraw(); };
          const kind = sim.segmented(controls, { label: "Forcing f(t)", options: [["const", "F"], ["lin", "F·t"], ["sin", "F sin ωt"]], value: "sin", onChange: redrawAll });
          const a = sim.slider(controls, { label: "a (damping)", min: 0, max: 4, step: 0.05, value: 0.3, onInput: redrawAll });
          const b = sim.slider(controls, { label: "b (stiffness)", min: 0, max: 10, step: 0.1, value: 4, onInput: redrawAll });
          const F = sim.slider(controls, { label: "F", min: 0, max: 6, step: 0.1, value: 3, onInput: redrawAll });
          const w = sim.slider(controls, { label: "ω (forcing frequency)", min: 0.1, max: 4, step: 0.05, value: 1, onInput: redrawAll });
          const x0 = sim.slider(controls, { label: "x₀", min: -3, max: 3, step: 0.1, value: 0, onInput: redrawAll });
          const v0 = sim.slider(controls, { label: "v₀", min: -3, max: 3, step: 0.1, value: 0, onInput: redrawAll });
          const showG = sim.checkbox(controls, { label: "Show g(t) and p(t)", value: true, onChange: redrawAll });
          const showF = sim.checkbox(controls, { label: "Show the forcing f(t)", value: false, onChange: redrawAll });
          sim.legend(controls, [["a", "g(t) homogeneous"], ["b", "p(t) particular"], ["c", "x = g + p"], ["muted", "f(t)"]]);

          // Particular solution by undetermined coefficients.
          function particular() {
            const A = a.value, B = b.value, f0 = F.value, om = w.value;
            if (kind.value === "const") {
              if (B > 1e-9) return { p: () => f0 / B, f: () => f0, text: `p = F / b = ${fmt(f0 / B)}` };
              if (A > 1e-9) return { p: (t) => (f0 / A) * t, f: () => f0, text: `b = 0, so p = (F / a) t = ${fmt(f0 / A)} t` };
              return { p: (t) => 0.5 * f0 * t * t, f: () => f0, text: "a = b = 0, so p = ½ F t²" };
            }
            if (kind.value === "lin") {
              if (B > 1e-9) {
                const E = f0 / B, G = (-A * f0) / (B * B);
                return { p: (t) => E * t + G, f: (t) => f0 * t, text: `p = E t + G with E = F/b = ${fmt(E)}, G = −aF/b² = ${fmt(G)}` };
              }
              if (A > 1e-9) return { p: (t) => (f0 / (2 * A)) * t * t - (f0 / (A * A)) * t, f: (t) => f0 * t, text: "b = 0, so p = (F/2a) t² − (F/a²) t" };
              return { p: (t) => (f0 * t * t * t) / 6, f: (t) => f0 * t, text: "a = b = 0, so p = F t³ / 6" };
            }
            const k = B - om * om, det = k * k + (A * om) * (A * om);
            if (det < 1e-6) {
              return { p: (t) => (-f0 / (2 * om)) * t * Math.cos(om * t), f: (t) => f0 * Math.sin(om * t), resonance: true,
                text: "RESONANCE (a = 0, ω² = b): the guess solves the homogeneous equation, so p = −(F / 2ω) t cos ωt" };
            }
            const D = (f0 * k) / det, E = (-f0 * A * om) / det;
            return { p: (t) => D * Math.sin(om * t) + E * Math.cos(om * t), f: (t) => f0 * Math.sin(om * t), D, E, amp: Math.hypot(D, E),
              text: `p = D sin ωt + E cos ωt with D = ${fmt(D, 3)}, E = ${fmt(E, 3)}` };
          }

          plot.onDraw((v) => {
            const P = particular();
            const h = 1e-4, p0 = P.p(0), dp0 = (P.p(h) - P.p(-h)) / (2 * h);
            const G = solveHomogeneous(a.value, b.value, x0.value - p0, v0.value - dp0);
            const x = (t) => G.x(t) + P.p(t);
            let m = 1;
            for (let t = 0; t <= 20; t += 0.1) m = Math.max(m, Math.abs(x(t)), showG.value ? Math.abs(P.p(t)) : 0);
            m = Math.min(m * 1.15, 60);
            v.opts.yRange = [-m, m];
            plotFrame(v, "t", "x");
            if (showF.value) v.plot(P.f, { color: "muted", width: 1.2, alpha: 0.7, from: 0 });
            if (showG.value) {
              v.plot(G.x, { color: "a", width: 1.8, dash: [6, 5], from: 0 });
              v.plot(P.p, { color: "b", width: 1.8, dash: [6, 5], from: 0 });
            }
            v.plot(x, { color: "c", width: 3, from: 0 });
            v.point([0, x0.value], { color: "c", r: 5 });
            out.set(sim.rows([
              ["homogeneous roots", G.kind],
              ["g(t) starts at", `x₀ − p(0) = ${fmt(x0.value - p0)}`],
              ["g′(0)", `v₀ − p′(0) = ${fmt(v0.value - dp0)}`],
              ["g(t) after t = 20", fmt(G.x(20), 3)],
            ]) + `<div class="eq">${P.text}</div>` +
              (P.resonance ? `<b class="bad">The amplitude grows linearly forever.</b>` :
                a.value > 0 ? "With a > 0 the homogeneous part decays, so the motion settles onto p(t)." :
                  "With a = 0 the homogeneous part never dies out.") );
          });

          resp.onDraw((v) => {
            if (kind.value !== "sin") {
              v.label(v.w / 2, v.h / 2, "Choose F sin ωt to see the response curve", { color: "muted", align: "center", size: 13 });
              return;
            }
            const A = a.value, B = b.value, f0 = F.value;
            const amp = (om) => f0 / Math.sqrt((B - om * om) ** 2 + (A * om) ** 2);
            let m = 0.5;
            for (let om = 0.02; om <= 4; om += 0.02) m = Math.max(m, Math.min(amp(om), 40));
            v.opts.yRange = [-0.08 * m, m * 1.15];
            plotFrame(v, "ω", "amplitude");
            v.plot(amp, { color: "d", width: 2.5, from: 0.01, to: 4 });
            if (B > 0) v.line([Math.sqrt(B), 0], [Math.sqrt(B), m * 1.15], { color: "e", dash: [4, 4], width: 1 });
            const cur = Math.min(amp(w.value), m * 1.1);
            v.point([w.value, cur], { color: "b", r: 6 });
            v.label(v.w - 8, 16, "steady amplitude √(D² + E²) vs ω  ·  red line: ω = √b", { color: "muted", size: 11, align: "right" });
          });
        },
      },
    ],

    cpp: [
      {
        title: "Roots of the auxiliary equation",
        formula: String.raw`r^2 + ar + b = 0 \;\Rightarrow\; r = -\tfrac a2 \pm \tfrac12\sqrt{a^2 - 4b}, \qquad \alpha = -\tfrac a2,\;\; \beta = \tfrac12\sqrt{4b - a^2}`,
        code: String.raw`
          struct AuxRoots
          {
              enum Kind { kDistinctReal, kRepeated, kComplex } kind;
              float r1, r2;          // real roots (equal when repeated)
              float alpha, beta;     // complex roots are alpha +/- i beta
          };

          AuxRoots SolveAuxiliary(float a, float b)
          {
              AuxRoots roots{};
              float disc = a * a - 4.0f * b;                    // a^2 - 4b
              if (std::fabs(disc) < 1.0e-6f)
              {
                  roots.kind = AuxRoots::kRepeated;
                  roots.r1 = roots.r2 = -0.5f * a;              // r = -a/2
              }
              else if (disc > 0.0f)
              {
                  float s = std::sqrt(disc);
                  roots.kind = AuxRoots::kDistinctReal;
                  roots.r1 = 0.5f * (-a + s);
                  roots.r2 = 0.5f * (-a - s);
              }
              else
              {
                  roots.kind = AuxRoots::kComplex;
                  roots.alpha = -0.5f * a;
                  roots.beta = 0.5f * std::sqrt(-disc);         // sqrt(4b - a^2) / 2
              }
              return roots;
          }
        `,
      },
      {
        title: "The solution that matches x(0) and x′(0)",
        formula: String.raw`A = \frac{v_0 - r_2x_0}{r_1 - r_2},\; B = \frac{r_1x_0 - v_0}{r_1 - r_2} \qquad A = x_0,\; B = v_0 - rx_0 \qquad C_1 = x_0,\; C_2 = \frac{v_0 - \alpha x_0}{\beta}`,
        code: String.raw`
          // Evaluates the solution of x'' + a x' + b x = 0 with x(0) = x0, x'(0) = v0 at time t.
          float SolveHomogeneous(float a, float b, float x0, float v0, float t)
          {
              AuxRoots r = SolveAuxiliary(a, b);
              switch (r.kind)
              {
                  case AuxRoots::kDistinctReal:
                  {
                      float A = (v0 - r.r2 * x0) / (r.r1 - r.r2);     // A + B = x0,  r1 A + r2 B = v0
                      float B = (r.r1 * x0 - v0) / (r.r1 - r.r2);
                      return A * std::exp(r.r1 * t) + B * std::exp(r.r2 * t);
                  }
                  case AuxRoots::kRepeated:
                  {
                      float A = x0, B = v0 - r.r1 * x0;              // x = (A + B t) e^(r t)
                      return (A + B * t) * std::exp(r.r1 * t);
                  }
                  default:
                  {
                      float C1 = x0, C2 = (v0 - r.alpha * x0) / r.beta;
                      return std::exp(r.alpha * t) * (C1 * std::cos(r.beta * t) + C2 * std::sin(r.beta * t));
                  }
              }
          }
        `,
      },
      {
        title: "Particular solution for sinusoidal forcing",
        formula: String.raw`p = D\sin\omega t + E\cos\omega t,\quad D = \frac{F(b - \omega^2)}{(b - \omega^2)^2 + a^2\omega^2},\quad E = \frac{-Fa\omega}{(b - \omega^2)^2 + a^2\omega^2}`,
        note: "<p>Substituting the guess and matching the sine and cosine coefficients gives a 2×2 linear system. Its determinant vanishes exactly at resonance.</p>",
        code: String.raw`
          // x'' + a x' + b x = F sin(w t).  Matching coefficients of sin and cos:
          //   (b - w^2) D - a w E = F
          //    a w D + (b - w^2) E = 0
          bool SinusoidalParticular(float a, float b, float F, float w, float& D, float& E)
          {
              float k = b - w * w;
              float det = k * k + (a * w) * (a * w);
              if (det < 1.0e-8f) return false;      // resonance: guess must be multiplied by t
              D = F * k / det;
              E = -F * a * w / det;
              return true;
          }
        `,
      },
      {
        title: "Critically damped follow (exact at any frame rate)",
        formula: String.raw`x'' + 2\omega x' + \omega^2(x - x_T) = 0 \;\Rightarrow\; x(t) = x_T + (C_1 + C_2t)e^{-\omega t},\;\; C_1 = x_0 - x_T,\;\; C_2 = v_0 + \omega C_1`,
        note: "<p>A smooth-follow camera or UI value. The repeated root −ω gives the fastest approach with no overshoot, and evaluating the exact solution over <code>dt</code> keeps it stable however large the frame time is.</p>",
        code: String.raw`
          void CriticallyDampedStep(float& x, float& v, float target, float omega, float dt)
          {
              float c1 = x - target;                  // initial conditions of this step
              float c2 = v + omega * c1;
              float e  = std::exp(-omega * dt);
              x = target + (c1 + c2 * dt) * e;
              v = (c2 - omega * (c1 + c2 * dt)) * e;   // derivative of the line above
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 13.3 Projectile Motion
  // ===========================================================================
  L3D.topic({
    id: "13.3",
    summary: "Motion under gravity alone: the parabolic path, the apex height, the range, and how to pick the launch angle that hits a target.",

    lesson: String.raw`
      <p>A <strong>projectile</strong> is an object acted on by gravity and nothing else. Like the book, this chapter
      uses a world where the <strong>z axis points up</strong>, so the gravitational acceleration is
      \[ \mathbf g = \langle 0, 0, -g\rangle, \qquad g \approx 9.8\ \text{m/s}^2 \]
      near the Earth's surface, and the force is \(m\mathbf g\). The acceleration is constant, so Section 13.1 gives
      the position function directly:</p>
      <div class="formula">
        \[ \mathbf x(t) = \mathbf x_0 + \mathbf v_0 t + \tfrac12\mathbf g t^2 \]
      </div>
      <p>Only the vertical component of \(\mathbf g\) is nonzero, so the components separate:
      \[ x(t) = x_0 + v_xt, \qquad y(t) = y_0 + v_yt, \qquad z(t) = z_0 + v_zt - \tfrac12gt^2. \]
      Horizontally the projectile coasts at a constant speed. Vertically it decelerates, stops and falls. Combined,
      the path is a <strong>parabola</strong> in the vertical plane that contains \(\mathbf v_0\).</p>

      <h2>Maximum height</h2>
      <p>At the top of the arc the vertical velocity is zero: \(\dot z(t) = v_z - gt = 0\), so the apex is reached at
      \(t = v_z/g\). Substituting that time into \(z(t)\):</p>
      <div class="formula">\[ h = z_0 + \frac{v_z^2}{2g} \]</div>
      <p>For example, a shell fired at 50 m/s at 70° from a 10 m platform has \(v_z = 50\sin70^\circ \approx 47.0\)
      m/s and rises to \(h \approx 10 + 47.0^2/19.6 \approx 123\) m. The horizontal speed has no effect on the
      height.</p>

      <h2>Range</h2>
      <p>Launched from flat ground (\(z_0 = 0\)), the projectile lands when \(v_zt - \tfrac12gt^2 = 0\). One root is
      \(t = 0\), the launch. The other is \(t = 2v_z/g\), exactly twice the time to the apex. In that time it travels
      horizontally (taking the path in the x–z plane)</p>
      <div class="formula">\[ r = \frac{2v_xv_z}{g} = \frac{s^2\sin2\theta}{g} \]</div>
      <p>where \(s\) is the launch speed and \(\theta\) the angle above the horizontal, so \(v_x = s\cos\theta\) and
      \(v_z = s\sin\theta\). A launch at 30 m/s and 40° travels about 90.4 m. Because \(\sin 2\theta\) peaks at
      \(2\theta = 90^\circ\), the greatest range on flat ground, \(s^2/g\), comes from a <strong>45°</strong> launch.
      When launching from a height \(z_0 \gt 0\), the landing time is the positive root of the quadratic,
      \(t = \big(v_z + \sqrt{v_z^2 + 2gz_0}\big)/g\).</p>

      <h2>Choosing the launch angle</h2>
      <p>Given a fixed launch speed \(s\), we can solve these formulas backward for \(\theta\):</p>
      <ul>
        <li>to reach height \(h\): \(\theta = \sin^{-1}\!\left(\dfrac{\sqrt{2g(h - z_0)}}{s}\right)\)</li>
        <li>to land at range \(r\): \(\theta = \tfrac12\sin^{-1}\!\left(\dfrac{rg}{s^2}\right)\), or its complement
          \(90^\circ - \theta\)</li>
      </ul>
      <p>Since \(\sin(180^\circ - 2\theta) = \sin2\theta\), every reachable range has <strong>two</strong> angles, a
      low flat shot and a high lob. At 65 m/s, a target 400 m away is hit at either 34° or 56°. If the value inside
      the inverse sine is greater than 1, the speed is too low and no angle works.</p>
      <p>Games usually need the general case: a target at horizontal distance \(d\) and height difference
      \(\Delta z\). Eliminate time using \(t = d/(s\cos\theta)\), replace \(1/\cos^2\theta\) with
      \(1 + \tan^2\theta\), and you get a quadratic in \(\tan\theta\):</p>
      <div class="formula">
        \[ \tan\theta = \frac{s^2 \pm \sqrt{s^4 - g\,(g d^2 + 2\,\Delta z\, s^2)}}{g\,d} \]
      </div>
      <p>The minus sign gives the low (faster) arc, the plus sign the high arc. A negative discriminant means the
      target is out of reach. The boundary of all reachable points is itself a parabola,
      \(z = \frac{s^2}{2g} - \frac{g x^2}{2s^2}\), sometimes called the safety parabola.</p>

      <div class="game">
        <ul>
          <li><b>Grenades and artillery AI:</b> solve the quadratic above. Pick the low arc for speed, or the high
            arc to clear a wall.</li>
          <li><b>Trajectory preview:</b> sample \(\mathbf x(t)\) at a few dozen times and draw the polyline.</li>
          <li><b>Designer-friendly jumps:</b> specify the jump height \(h\) and the time to the apex \(t_h\) instead of
            gravity and speed. From \(h = v^2/2g\) and \(t_h = v/g\) you get \(g = 2h/t_h^2\) and launch speed
            \(v = 2h/t_h\).</li>
        </ul>
      </div>
      <div class="warn">These formulas describe ideal motion. If the game integrates with explicit Euler (Section
      13.1) or adds drag (Section 13.4), the real path will miss the predicted one, so predict with the same
      integrator the game uses, or use the exact update. Also remember that most engines are <b>y-up</b>, while the
      book is <b>z-up</b>.</div>

      <p><a class="btn goto-sim" href="#/13.3/sim">Try it: launch projectiles and aim at a target →</a></p>
    `,

    keyFormulas: [
      ["Projectile position", String.raw`\mathbf x(t) = \mathbf x_0 + \mathbf v_0t + \tfrac12\mathbf gt^2,\quad \mathbf g = \langle 0, 0, -g\rangle`],
      ["Maximum height", String.raw`h = z_0 + \frac{v_z^2}{2g}\quad\text{at}\quad t = \frac{v_z}{g}`],
      ["Range on level ground", String.raw`r = \frac{2v_xv_z}{g} = \frac{s^2\sin2\theta}{g}`],
      ["Angle for a range", String.raw`\theta = \tfrac12\sin^{-1}\frac{rg}{s^2}\quad\text{or}\quad 90^\circ - \theta`],
      ["Angle to hit (d, Δz)", String.raw`\tan\theta = \frac{s^2 \pm \sqrt{s^4 - g(gd^2 + 2\Delta z\,s^2)}}{gd}`],
    ],

    exercises: [
      { q: "A projectile is launched from a platform 20 m high at 20 m/s and 45°. How high above the ground does it get (g = 9.8 m/s²)?",
        a: String.raw`\(v_z = 20\sin45^\circ \approx 14.14\) m/s, so \(h = 20 + 14.14^2/19.6 = 20 + 200/19.6 \approx 30.2\) m.` },
      { q: "How long is the projectile in the previous exercise in the air?",
        a: String.raw`It lands when \(20 + 14.14t - 4.9t^2 = 0\). The positive root is \(t = (14.14 + \sqrt{200 + 392})/9.8 \approx (14.14 + 24.33)/9.8 \approx 3.93\) s.` },
      { q: "With a launch speed of 30 m/s on flat ground, at what angles does a projectile land 60 m away?",
        a: String.raw`\(\sin2\theta = 60\cdot9.8/900 \approx 0.653\), so \(2\theta \approx 40.8^\circ\) and \(\theta \approx 20.4^\circ\), or the complement \(69.6^\circ\).` },
      { q: "A designer wants a jump that peaks 3 m up after 0.4 s. What gravity and jump speed does the game need?",
        a: String.raw`\(g = 2h/t_h^2 = 6/0.16 = 37.5\) m/s² and \(v = 2h/t_h = 15\) m/s. Games often use gravity much stronger than 9.8 m/s² so jumps feel snappy.` },
    ],

    sims: [
      {
        title: "Projectile launcher",
        help: String.raw`<p>Set the launch speed, angle, platform height and gravity. The path is the parabola
          \(\mathbf x(t) = \mathbf x_0 + \mathbf v_0t + \tfrac12\mathbf gt^2\). The dashed line marks the apex height
          \(h = z_0 + v_z^2/2g\). The ball's velocity arrow (green) splits into a constant horizontal part and a
          shrinking, then growing, vertical part. Try 45° against 30° and 60° on flat ground.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { height: 430 });
          const out = sim.readout(readout);
          const r = () => view.redraw();
          const s = sim.slider(controls, { label: "Launch speed s", min: 5, max: 25, step: 0.5, value: 18, unit: " m/s", onInput: r });
          const th = sim.slider(controls, { label: "Launch angle θ", min: 5, max: 85, step: 1, value: 50, unit: "°", onInput: r });
          const z0 = sim.slider(controls, { label: "Platform height z₀", min: 0, max: 15, step: 0.5, value: 0, unit: " m", onInput: r });
          const g = sim.slider(controls, { label: "Gravity g", min: 1.6, max: 20, step: 0.1, value: 9.8, unit: " m/s²", onInput: r });
          const repeat = sim.checkbox(controls, { label: "Repeat the launch", value: true });
          let t = 0;
          sim.buttons(controls, [{ label: "Launch", primary: true, onClick: () => (t = 0) }]);

          const params = () => {
            const S = s.value, T = rad(th.value), G = g.value, Z = z0.value;
            const vx = S * Math.cos(T), vz = S * Math.sin(T);
            const tf = (vz + Math.sqrt(vz * vz + 2 * G * Z)) / G;
            return { S, T, G, Z, vx, vz, tf, tApex: vz / G, h: Z + (vz * vz) / (2 * G), R: vx * tf };
          };

          sim.loop((dt) => {
            t += dt;
            const P = params();
            if (repeat.value && t > P.tf + 1.2) t = 0;
            view.redraw();
          });

          view.onDraw((v) => {
            const P = params();
            fitView(v, -3, Math.max(P.R, 12) + 3, -2, Math.max(P.h, 5) + 3);
            v.grid();
            v.axes({ ticks: true, labels: ["x (m)", "z (m)"] });
            const B = v.bounds;
            v.rect([B.xmin, B.ymin], [B.xmax, 0], { fill: "muted", fillAlpha: 0.12, stroke: false });
            if (P.Z > 0) v.rect([-1.2, 0], [0, P.Z], { fill: "muted", fillAlpha: 0.35, color: "muted" });
            const p0 = [0, P.Z], v0 = [P.vx, P.vz];
            const pts = [];
            for (let i = 0; i <= 120; i++) pts.push(projectile(p0, v0, P.G, (P.tf * i) / 120));
            v.polyline(pts, { color: "a", width: 2.5 });
            const apex = projectile(p0, v0, P.G, P.tApex);
            v.line([apex[0], 0], apex, { color: "d", dash: [5, 5], width: 1.5 });
            v.point(apex, { color: "d", r: 5, label: "apex h = " + fmt(P.h, 1) + " m" });
            v.point([P.R, 0], { color: "e", r: 5 });
            v.text([P.R, 0], "lands at " + fmt(P.R, 1) + " m", { color: "e", size: 12, align: "right", offset: [-4, 18] });
            v.arc(p0, Math.max(1.5, v.range * 0.12), 0, P.T, { color: "b", width: 1.5 });
            const tt = Math.min(t, P.tf);
            const pos = projectile(p0, v0, P.G, tt), vel = [P.vx, P.vz - P.G * tt];
            const k = v.range * 0.04;
            v.arrow(pos, V.add(pos, V.scale(vel, k)), { color: "c", width: 2.5 });
            v.line(pos, [pos[0] + vel[0] * k, pos[1]], { color: "c", dash: [3, 3], width: 1, alpha: 0.7 });
            v.line(pos, [pos[0], pos[1] + vel[1] * k], { color: "c", dash: [3, 3], width: 1, alpha: 0.7 });
            v.point(pos, { color: "b", r: 7 });

            const flat = P.Z === 0;
            const best = deg(Math.atan(P.S / Math.sqrt(P.S * P.S + 2 * P.G * P.Z)));
            out.set(sim.rows([
              ["vₓ = s cos θ", fmt(P.vx) + " m/s"],
              ["v_z = s sin θ", fmt(P.vz) + " m/s"],
              ["time to apex v_z / g", fmt(P.tApex) + " s"],
              [sim.swatch("d") + "h = z₀ + v_z² / 2g", fmt(P.h) + " m"],
              ["flight time", fmt(P.tf) + " s"],
              [sim.swatch("e") + "landing distance", fmt(P.R) + " m"],
              ["2vₓv_z / g", flat ? fmt((2 * P.vx * P.vz) / P.G) + " m" : "(only for z₀ = 0)"],
              ["angle for max range", fmt(best, 1) + "°"],
              ["t", fmt(tt) + " s"],
            ]) + `<hr>${flat ? "On flat ground the best angle is 45°, and θ and 90° − θ land at the same spot." : "From a raised platform the best angle is below 45°."}`);
          });
        },
      },
      {
        title: "Aim at a target",
        help: String.raw`<p>Drag the red target. With launch speed \(s\) fixed, the launcher solves the quadratic in
          \(\tan\theta\) and shows both solutions: the low arc (blue) and the high arc (purple). The shaded region
          under the dashed safety parabola is everything the launcher can reach. Drag the target outside it and no
          angle works. Press Fire to send a shot along either arc.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { height: 430 });
          const out = sim.readout(readout);
          const r = () => view.redraw();
          const target = view.handle([38, 8], { color: "e", label: "target" });
          const s = sim.slider(controls, { label: "Launch speed s", min: 5, max: 25, step: 0.5, value: 22, unit: " m/s", onInput: r });
          const g = sim.slider(controls, { label: "Gravity g", min: 1.6, max: 20, step: 0.1, value: 9.8, unit: " m/s²", onInput: r });
          const env = sim.checkbox(controls, { label: "Show the reachable region", value: true, onChange: r });
          let shot = null;
          sim.buttons(controls, [
            { label: "Fire low arc", onClick: () => (shot = { which: 0, t: 0 }) },
            { label: "Fire high arc", onClick: () => (shot = { which: 1, t: 0 }) },
          ]);

          function solve() {
            const S = s.value, G = g.value, d = target.pos[0], dz = target.pos[1];
            const dir = d < 0 ? -1 : 1, D = Math.abs(d);
            const disc = S ** 4 - G * (G * D * D + 2 * dz * S * S);
            const sMin = Math.sqrt(G * (dz + Math.hypot(D, dz)));
            if (disc < 0 || D < 1e-3) return { ok: false, sMin, disc };
            const sq = Math.sqrt(disc);
            const angles = [Math.atan((S * S - sq) / (G * D)), Math.atan((S * S + sq) / (G * D))];
            return {
              ok: true, sMin, disc,
              arcs: angles.map((a) => ({ a, v0: [dir * S * Math.cos(a), S * Math.sin(a)], T: D / (S * Math.cos(a)) })),
            };
          }

          sim.loop((dt) => {
            if (!shot) return;
            shot.t += dt;
            const sol = solve();
            if (!sol.ok || shot.t > sol.arcs[shot.which].T + 0.8) shot = null;
            view.redraw();
          });

          view.onDraw((v) => {
            fitView(v, -6, 64, -4, 34);
            v.grid();
            v.axes({ ticks: true, labels: ["x (m)", "z (m)"] });
            const B = v.bounds, S = s.value, G = g.value;
            v.rect([B.xmin, B.ymin], [B.xmax, Math.min(0, B.ymax)], { fill: "muted", fillAlpha: 0.1, stroke: false });
            if (env.value) {
              const envZ = (x) => (S * S) / (2 * G) - (G * x * x) / (2 * S * S);
              const pts = [];
              for (let i = 0; i <= 120; i++) { const x = B.xmin + ((B.xmax - B.xmin) * i) / 120; pts.push([x, Math.max(envZ(x), B.ymin)]); }
              v.polygon([...pts, [B.xmax, B.ymin], [B.xmin, B.ymin]], { fill: "c", fillAlpha: 0.07, stroke: false });
              v.polyline(pts, { color: "c", dash: [6, 5], width: 1.5 });
            }
            const sol = solve();
            if (sol.ok) {
              sol.arcs.forEach((arc, i) => {
                const pts = [];
                for (let k = 0; k <= 80; k++) pts.push(projectile([0, 0], arc.v0, G, (arc.T * k) / 80));
                v.polyline(pts, { color: i ? "d" : "a", width: 2.5, alpha: 0.9 });
                v.arrow([0, 0], V.scale(arc.v0, 0.25), { color: i ? "d" : "a", width: 2 });
              });
            }
            if (shot && sol.ok) {
              const arc = sol.arcs[shot.which];
              v.point(projectile([0, 0], arc.v0, G, Math.min(shot.t, arc.T)), { color: "b", r: 7 });
            }
            v.point([0, 0], { color: "fg", r: 6, label: "launcher", labelOffset: [8, 18] });
            out.set(sim.rows([
              ["d (horizontal)", fmt(target.pos[0]) + " m"],
              ["Δz (height)", fmt(target.pos[1]) + " m"],
              ["discriminant", fmt(sol.disc, 0)],
              [sim.swatch("a") + "low arc θ", sol.ok ? fmt(deg(sol.arcs[0].a), 1) + "°" : "–"],
              [sim.swatch("a") + "low arc flight time", sol.ok ? fmt(sol.arcs[0].T) + " s" : "–"],
              [sim.swatch("d") + "high arc θ", sol.ok ? fmt(deg(sol.arcs[1].a), 1) + "°" : "–"],
              [sim.swatch("d") + "high arc flight time", sol.ok ? fmt(sol.arcs[1].T) + " s" : "–"],
              ["minimum speed needed", fmt(sol.sMin) + " m/s"],
            ]) + (sol.ok ? "<hr>Two solutions: the low arc arrives sooner, the high arc drops in from above."
              : `<hr><b class="bad">Out of reach.</b> The discriminant is negative; you need s ≥ ${fmt(sol.sMin)} m/s.`));
          });
        },
      },
    ],

    cpp: [
      {
        title: "Projectile position at time t",
        formula: String.raw`\mathbf x(t) = \mathbf x_0 + \mathbf v_0t + \tfrac12\mathbf gt^2,\qquad \mathbf g = \langle 0, 0, -g\rangle`,
        code: String.raw`
          const Vector3D kGravity(0.0f, 0.0f, -9.8f);      // z is up, as in the book

          Point3D ProjectilePosition(const Point3D& x0, const Vector3D& v0, float t)
          {
              return x0 + v0 * t + kGravity * (0.5f * t * t);
          }

          // Points for drawing a trajectory preview (e.g. a grenade arc).
          void TrajectoryPreview(const Point3D& x0, const Vector3D& v0, float duration, int count, Point3D* out)
          {
              for (int i = 0; i < count; i++)
              {
                  float t = duration * static_cast<float>(i) / static_cast<float>(count - 1);
                  out[i] = ProjectilePosition(x0, v0, t);
              }
          }
        `,
      },
      {
        title: "Apex time and maximum height",
        formula: String.raw`t_{\text{apex}} = \frac{v_z}{g}, \qquad h = z_0 + \frac{v_z^2}{2g}`,
        code: String.raw`
          float ApexTime(const Vector3D& v0, float g)
          {
              return (v0.z > 0.0f) ? v0.z / g : 0.0f;          // vertical velocity v_z - g t = 0
          }

          float MaxHeight(const Point3D& x0, const Vector3D& v0, float g)
          {
              float vz = (v0.z > 0.0f) ? v0.z : 0.0f;
              return x0.z + vz * vz / (2.0f * g);              // h = z0 + v_z^2 / 2g
          }
        `,
      },
      {
        title: "Flight time and range",
        formula: String.raw`r = \frac{2v_xv_z}{g}\;(z_0 = 0), \qquad t_{\text{land}} = \frac{v_z + \sqrt{v_z^2 + 2gz_0}}{g}`,
        code: String.raw`
          // Range on level ground for a launch from z = 0 (path in the x-z plane).
          float LevelRange(float speed, float angle, float g)
          {
              float vx = speed * std::cos(angle), vz = speed * std::sin(angle);
              return 2.0f * vx * vz / g;                        // = s^2 sin(2 angle) / g
          }

          // Time until z returns to 0 when launched from height z0 >= 0: positive root of
          // z0 + v_z t - g t^2 / 2 = 0.
          float LandingTime(float z0, float vz, float g)
          {
              return (vz + std::sqrt(vz * vz + 2.0f * g * z0)) / g;
          }
        `,
      },
      {
        title: "Launch angle to hit a target",
        formula: String.raw`\tan\theta = \frac{s^2 \pm \sqrt{s^4 - g(gd^2 + 2\Delta z\,s^2)}}{gd}`,
        note: "<p>Returns false when the target is out of reach. <code>lowAngle</code> is the faster, flatter shot. Use <code>highAngle</code> to lob over cover.</p>",
        code: String.raw`
          bool LaunchAngles(float speed, float g, float d, float dz, float& lowAngle, float& highAngle)
          {
              float s2 = speed * speed;
              float disc = s2 * s2 - g * (g * d * d + 2.0f * dz * s2);
              if (disc < 0.0f || d <= 0.0f) return false;           // out of range
              float root = std::sqrt(disc);
              lowAngle  = std::atan((s2 - root) / (g * d));
              highAngle = std::atan((s2 + root) / (g * d));
              return true;
          }

          // Turn an angle into a 3D launch velocity toward a target (z up).
          Vector3D LaunchVelocity(const Point3D& from, const Point3D& to, float speed, float angle)
          {
              Vector3D flat(to.x - from.x, to.y - from.y, 0.0f);
              Vector3D dir = Normalize(flat);                        // horizontal direction
              return dir * (speed * std::cos(angle)) + Vector3D(0.0f, 0.0f, speed * std::sin(angle));
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 13.4 Resisted Motion
  // ===========================================================================
  L3D.topic({
    id: "13.4",
    summary: "Gravity plus a drag force proportional to velocity: an exponential approach to terminal velocity and a closed-form position function.",

    lesson: String.raw`
      <p>Real objects move through air or water, and the medium slows them down. An exact model of fluid resistance
      is complicated, but a simple one works surprisingly well: the resisting force points opposite the velocity and
      its size is <strong>proportional to the speed</strong>. Writing the strength as \(mk\), the force on an object of
      mass \(m\) is \(-mk\,\dot{\mathbf x}(t)\), and Newton's second law becomes
      \[ m\mathbf g - mk\,\dot{\mathbf x}(t) = m\,\ddot{\mathbf x}(t). \]
      Dividing by \(m\) gives a nonhomogeneous equation of exactly the type in Section 13.2 (with \(b = 0\)), one copy
      for each component:</p>
      <div class="formula">\[ \ddot{\mathbf x}(t) + k\,\dot{\mathbf x}(t) = \mathbf g \]</div>
      <p>The constant \(k\) has units of 1/second. Its reciprocal \(1/k\) is a <em>time constant</em>, the time the
      medium needs to change the motion noticeably.</p>

      <h2>Solving it</h2>
      <ul>
        <li>The auxiliary equation \(r^2 + kr = 0\) has roots \(0\) and \(-k\), so the homogeneous solution is
          \(\mathbf A + \mathbf Be^{-kt}\). The constants are vectors because there is one equation per axis.</li>
        <li>The forcing \(\mathbf g\) is constant, but a constant guess fails because \(r = 0\) is a root. Following the
          rule from Section 13.2, multiply by \(t\): \(\mathbf p(t) = (\mathbf g/k)\,t\). Checking: \(\ddot{\mathbf p} = \mathbf 0\)
          and \(k\dot{\mathbf p} = \mathbf g\).</li>
        <li>Initial conditions \(\mathbf x(0) = \mathbf x_0\), \(\dot{\mathbf x}(0) = \mathbf v_0\) give
          \(\mathbf A + \mathbf B = \mathbf x_0\) and \(-k\mathbf B + \mathbf g/k = \mathbf v_0\), so
          \(\mathbf B = (\mathbf g - k\mathbf v_0)/k^2\) and \(\mathbf A = \mathbf x_0 - \mathbf B\).</li>
      </ul>
      <p>Putting it together:</p>
      <div class="formula">
        \[ \mathbf x(t) = \mathbf x_0 + \frac{\mathbf g}{k}\,t + \frac{k\mathbf v_0 - \mathbf g}{k^2}\left(1 - e^{-kt}\right)
           \qquad
           \mathbf v(t) = \frac{\mathbf g}{k} + \left(\mathbf v_0 - \frac{\mathbf g}{k}\right)e^{-kt} \]
      </div>

      <h2>Terminal velocity</h2>
      <p>The exponential term fades, so the velocity approaches a constant called the <strong>terminal
      velocity</strong>:
      \[ \mathbf v_T = \lim_{t\to\infty}\mathbf v(t) = \frac{\mathbf g}{k}. \]
      At that speed the drag force exactly cancels gravity. The velocity function says the gap to \(\mathbf v_T\)
      shrinks by the factor \(e^{-kt}\): after one time constant \(1/k\), 63% of the gap is closed, and after
      \(3/k\) about 95%. This holds whether the object starts slower than \(\mathbf v_T\) (a dropped rock speeds up) or
      faster (a bullet fired downward slows down).</p>
      <p>Horizontally there is no gravity, so \(v_x(t) = v_{x0}e^{-kt}\) and the horizontal distance approaches
      \(v_{x0}/k\). With drag, <em>no</em> launch can travel farther than that, and the path is no longer a symmetric
      parabola: it falls more steeply than it rises.</p>

      <h2>The no-drag limit</h2>
      <p>The formula has \(k\) in denominators, so it isn't obvious that it reduces to the projectile formula when
      \(k \to 0\). Expanding \(e^{-kt}\) with its power series (Appendix D),
      \(1 - e^{-kt} = kt - \tfrac{k^2t^2}{2} + \tfrac{k^3t^3}{6} - \cdots\), the \(\mathbf g t/k\) terms cancel and
      what remains as \(k\to0\) is
      \(\mathbf x_0 + \mathbf v_0t + \tfrac12\mathbf gt^2\), the result from Section 13.3.</p>
      <div class="warn">In code, the closed form loses precision when \(k\) is tiny, because it subtracts large nearly
      equal numbers. Switch to the no-drag formula below a small threshold (the C++ tab does this).</div>

      <div class="game">The most common damping line in games is <code>velocity *= 0.98f;</code> once per frame. Its
      strength depends on the frame rate. The exact solution says what to do instead: with no other forces,
      \(\mathbf v \leftarrow \mathbf v\,e^{-k\Delta t}\), and with gravity,
      \(\mathbf v \leftarrow \mathbf v_T + (\mathbf v - \mathbf v_T)e^{-k\Delta t}\). That gives the same motion at 30
      fps and at 240 fps. To pick \(k\) from a feel, choose the half-life: \(k = \ln 2 / t_{1/2}\).</div>
      <div class="note">Real aerodynamic drag at high speed is closer to proportional to \(\lVert\mathbf v\rVert^2\)
      (quadratic drag). That version has no simple closed form in 3D and must be integrated numerically, but linear
      drag is cheap, stable and predictable, which is often what gameplay wants.</div>

      <p><a class="btn goto-sim" href="#/13.4/sim">Try it: compare paths with and without drag →</a></p>
    `,

    keyFormulas: [
      ["Equation of motion", String.raw`\ddot{\mathbf x}(t) + k\,\dot{\mathbf x}(t) = \mathbf g`],
      ["Position", String.raw`\mathbf x(t) = \mathbf x_0 + \frac{\mathbf g}{k}t + \frac{k\mathbf v_0 - \mathbf g}{k^2}\left(1 - e^{-kt}\right)`],
      ["Velocity", String.raw`\mathbf v(t) = \frac{\mathbf g}{k} + \left(\mathbf v_0 - \frac{\mathbf g}{k}\right)e^{-kt}`],
      ["Terminal velocity", String.raw`\mathbf v_T = \frac{\mathbf g}{k}`],
      ["Frame-rate independent damping", String.raw`\mathbf v \leftarrow \mathbf v_T + (\mathbf v - \mathbf v_T)\,e^{-k\Delta t}`],
    ],

    exercises: [
      { q: String.raw`With \(k = 0.5\ \text{s}^{-1}\) and \(g = 9.8\ \text{m/s}^2\), what is the terminal speed? How long does a dropped object take to reach half of it?`,
        a: String.raw`\(v_T = g/k = 19.6\) m/s. From rest \(v = v_T(1 - e^{-kt})\), so half speed needs \(e^{-kt} = \tfrac12\), \(t = \ln2/k \approx 1.39\) s.` },
      { q: String.raw`A rock is dropped from 50 m with \(k = 1\ \text{s}^{-1}\). Write \(z(t)\) and estimate when it lands.`,
        a: String.raw`\(z(t) = 50 - 9.8t + 9.8(1 - e^{-t})\). Setting it to zero gives \(t = 6.102 - e^{-t}\). Newton's method (or simple iteration) converges quickly to \(t \approx 6.10\) s.` },
      { q: "You want a coasting spaceship's speed to halve every 0.25 s. What k do you need, and what per-frame factor is that at 60 fps?",
        a: String.raw`\(k = \ln2/0.25 \approx 2.77\ \text{s}^{-1}\). Per frame, \(e^{-k/60} \approx 0.955\). At 120 fps the factor is \(e^{-k/120} \approx 0.977\). It differs per frame rate, but the motion per second is identical.` },
      { q: "A ball is thrown with horizontal speed 20 m/s through a medium with k = 0.5 s⁻¹. What is the farthest it can travel horizontally?",
        a: String.raw`\(v_x(t) = 20e^{-0.5t}\), so the horizontal distance tends to \(v_{x0}/k = 40\) m, no matter how long it stays in the air.` },
    ],

    sims: [
      {
        title: "Drag vs. no drag",
        help: String.raw`<p>Both balls launch with the same velocity. The dashed blue path ignores resistance; the solid
          orange path uses the closed-form solution with drag strength \(k\). Notice the steeper descent and the
          vertical asymptote at \(x = v_{x0}/k\), which the dragged ball can never pass. Its velocity (green) turns
          toward the terminal velocity \(\mathbf v_T = \mathbf g/k\) (red).</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { height: 430 });
          const out = sim.readout(readout);
          const r = () => view.redraw();
          const s = sim.slider(controls, { label: "Launch speed s", min: 5, max: 30, step: 0.5, value: 22, unit: " m/s", onInput: r });
          const th = sim.slider(controls, { label: "Launch angle θ", min: 5, max: 85, step: 1, value: 45, unit: "°", onInput: r });
          const k = sim.slider(controls, { label: "Drag k", min: 0, max: 2, step: 0.05, value: 0.4, unit: " /s", onInput: r });
          const g = sim.slider(controls, { label: "Gravity g", min: 1.6, max: 20, step: 0.1, value: 9.8, unit: " m/s²", onInput: r });
          const repeat = sim.checkbox(controls, { label: "Repeat", value: true });
          let t = 0;
          sim.buttons(controls, [{ label: "Launch", primary: true, onClick: () => (t = 0) }]);

          const compute = () => {
            const v0 = [s.value * Math.cos(rad(th.value)), s.value * Math.sin(rad(th.value))];
            const G = g.value, K = k.value;
            const ideal = sampleUntilGround((tt) => projectile([0, 0], v0, G, tt), 60, 0.02);
            const drag = sampleUntilGround((tt) => dragProjectile([0, 0], v0, G, K, tt), 60, 0.02);
            return { v0, G, K, ideal, drag };
          };

          sim.loop((dt) => {
            t += dt;
            const C = compute();
            if (repeat.value && t > Math.max(C.ideal.tLand, C.drag.tLand) + 1) t = 0;
            view.redraw();
          });

          view.onDraw((v) => {
            const C = compute();
            const xs = C.ideal.pts.map((p) => p[0]), zs = C.ideal.pts.map((p) => p[1]);
            fitView(v, -3, Math.max(...xs, 10) + 3, -2, Math.max(...zs, 4) + 3);
            v.grid();
            v.axes({ ticks: true, labels: ["x (m)", "z (m)"] });
            const B = v.bounds;
            v.rect([B.xmin, B.ymin], [B.xmax, 0], { fill: "muted", fillAlpha: 0.12, stroke: false });
            v.polyline(C.ideal.pts, { color: "a", width: 2, dash: [7, 5] });
            v.polyline(C.drag.pts, { color: "b", width: 3 });
            if (C.K > 1e-5) {
              const xLim = C.v0[0] / C.K;
              if (xLim < B.xmax) {
                v.line([xLim, 0], [xLim, B.ymax], { color: "e", dash: [3, 5], width: 1.2 });
                v.text([xLim, B.ymax], "x = vₓ₀ / k", { color: "e", size: 11, offset: [4, 14] });
              }
            }
            const ti = Math.min(t, C.ideal.tLand), td = Math.min(t, C.drag.tLand);
            const pi = projectile([0, 0], C.v0, C.G, ti), pd = dragProjectile([0, 0], C.v0, C.G, C.K, td);
            const vd = dragVelocity(C.v0, C.G, C.K, td);
            const kk = v.range * 0.04;
            v.point(pi, { color: "a", r: 6 });
            v.arrow(pd, V.add(pd, V.scale(vd, kk)), { color: "c", width: 2.5 });
            if (C.K > 1e-5) v.arrow(pd, V.add(pd, [0, (-C.G / C.K) * kk]), { color: "e", width: 1.5, dash: [4, 3] });
            v.point(pd, { color: "b", r: 7 });
            const apex = (pts) => Math.max(...pts.map((p) => p[1]));
            out.set(sim.rows([
              ["terminal speed g / k", C.K > 1e-5 ? fmt(C.G / C.K) + " m/s" : "∞ (no drag)"],
              ["time constant 1 / k", C.K > 1e-5 ? fmt(1 / C.K) + " s" : "∞"],
              [sim.swatch("a") + "range without drag", fmt(C.ideal.pts[C.ideal.pts.length - 1][0]) + " m"],
              [sim.swatch("b") + "range with drag", fmt(C.drag.pts[C.drag.pts.length - 1][0]) + " m"],
              ["horizontal limit vₓ₀ / k", C.K > 1e-5 ? fmt(C.v0[0] / C.K) + " m" : "∞"],
              [sim.swatch("a") + "apex without drag", fmt(apex(C.ideal.pts)) + " m"],
              [sim.swatch("b") + "apex with drag", fmt(apex(C.drag.pts)) + " m"],
              [sim.swatch("c") + "current velocity", fmtVec(vd, 1)],
            ]) + "<hr>With drag the best launch angle drops below 45°. Try it.");
          });
        },
      },
      {
        title: "Approaching terminal velocity",
        help: String.raw`<p>The top graph is the vertical velocity \(v(t) = v_T + (v_0 - v_T)e^{-kt}\) with
          \(v_T = -g/k\). Whatever the starting speed, the curve bends toward the red line. The marked point at
          \(t = 1/k\) has closed 63% of the gap. Drag the time cursor to read values. Turn on the Euler check to compare
          a naive per-frame update (dots) with the exact curve.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const vp = sim.view2d(stage, { height: 290, xRange: [-0.3, 8], yRange: [-52, 32] });
          const zp = sim.view2d(stage, { height: 170, xRange: [-0.3, 8], yRange: [-60, 20] });
          const out = sim.readout(readout);
          const redrawAll = () => { vp.redraw(); zp.redraw(); };
          const k = sim.slider(controls, { label: "Drag k", min: 0.2, max: 3, step: 0.05, value: 0.6, unit: " /s", onInput: redrawAll });
          const v0 = sim.slider(controls, { label: "Initial vertical velocity v₀", min: -45, max: 30, step: 1, value: 20, unit: " m/s", onInput: redrawAll });
          const g = sim.slider(controls, { label: "Gravity g", min: 1.6, max: 20, step: 0.1, value: 9.8, unit: " m/s²", onInput: redrawAll });
          const euler = sim.checkbox(controls, { label: "Compare explicit Euler: v += (−g − k v) Δt", value: false, onChange: redrawAll });
          const dt = sim.slider(controls, { label: "Euler step Δt", min: 0.05, max: 1, step: 0.05, value: 0.4, unit: " s", onInput: redrawAll });
          const cursor = vp.handle([4, 0], { color: "d", label: "t", constrain: (p) => [clamp(p[0], 0, 8), 0], onDrag: redrawAll });
          sim.legend(controls, [["b", "v(t) exact"], ["e", "terminal velocity"], ["d", "Euler steps"]]);

          const vel = (t) => { const vT = -g.value / k.value; return vT + (v0.value - vT) * Math.exp(-k.value * t); };
          const pos = (t) => { const vT = -g.value / k.value; return vT * t + ((v0.value - vT) / k.value) * (1 - Math.exp(-k.value * t)); };

          vp.onDraw((v) => {
            plotFrame(v, "t (s)", "v_z (m/s)");
            const K = k.value, vT = -g.value / K, tau = 1 / K;
            v.line([0, vT], [8, vT], { color: "e", dash: [6, 5], width: 1.5 });
            v.text([8, vT], "v_T = −g/k", { color: "e", size: 11, align: "right", offset: [-4, 15] });
            v.plot(vel, { color: "b", width: 3, from: 0, to: 8 });
            if (tau <= 8) {
              v.point([tau, vel(tau)], { color: "b", r: 5, label: "t = 1/k (63%)" });
            }
            if (euler.value) {
              let vz = v0.value;
              const h = dt.value, pts = [[0, vz]];
              for (let t = h; t <= 8 + 1e-9; t += h) { vz += (-g.value - K * vz) * h; pts.push([t, clamp(vz, -200, 200)]); }
              v.polyline(pts, { color: "d", width: 1.2, alpha: 0.6 });
              pts.forEach((p) => v.point(p, { color: "d", r: 3.5 }));
            }
            v.line([cursor.pos[0], -52], [cursor.pos[0], 32], { color: "d", dash: [3, 4], width: 1 });
            const tt = cursor.pos[0];
            out.set(sim.rows([
              ["terminal velocity −g/k", fmt(vT) + " m/s"],
              ["time constant 1/k", fmt(tau) + " s"],
              ["time to 95% ≈ 3/k", fmt(3 * tau) + " s"],
              ["cursor t", fmt(tt) + " s"],
              ["v(t)", fmt(vel(tt)) + " m/s"],
              ["z(t) − z₀", fmt(pos(tt)) + " m"],
              ["gap closed 1 − e^(−kt)", fmt(100 * (1 - Math.exp(-K * tt)), 1) + " %"],
            ]) + (euler.value && dt.value * K > 1 ? "<hr><b class='bad'>k Δt > 1:</b> Euler overshoots past v_T and oscillates (for k Δt > 2 it blows up). The exact update v_T + (v − v_T)e^(−kΔt) never does." :
              "<hr>Exact per-frame update: v ← v_T + (v − v_T) e^(−k Δt)."));
          });

          zp.onDraw((v) => {
            let lo = 0, hi = 0;
            for (let t = 0; t <= 8; t += 0.1) { lo = Math.min(lo, pos(t), v0.value * t - 0.5 * g.value * t * t); hi = Math.max(hi, pos(t)); }
            lo = Math.max(lo, -400);
            v.opts.yRange = [lo - 0.08 * (hi - lo + 1), hi + 0.15 * (hi - lo + 1)];
            plotFrame(v, "t (s)", "z − z₀ (m)");
            v.plot((t) => v0.value * t - 0.5 * g.value * t * t, { color: "a", dash: [6, 5], width: 1.5, from: 0, to: 8 });
            v.plot(pos, { color: "b", width: 3, from: 0, to: 8 });
            v.point([cursor.pos[0], pos(cursor.pos[0])], { color: "d", r: 5 });
            v.label(v.w - 8, v.h - 8, "orange: with drag  ·  dashed blue: without drag", { color: "muted", size: 11, align: "right" });
          });
        },
      },
    ],

    cpp: [
      {
        title: "Velocity with linear drag",
        formula: String.raw`\mathbf v(t) = \frac{\mathbf g}{k} + \left(\mathbf v_0 - \frac{\mathbf g}{k}\right)e^{-kt}`,
        code: String.raw`
          Vector3D DragVelocity(const Vector3D& v0, const Vector3D& g, float k, float t)
          {
              Vector3D vT = g / k;                               // terminal velocity
              return vT + (v0 - vT) * std::exp(-k * t);          // the gap to vT decays like e^(-kt)
          }
        `,
      },
      {
        title: "Position with linear drag",
        formula: String.raw`\mathbf x(t) = \mathbf x_0 + \frac{\mathbf g}{k}t + \frac{k\mathbf v_0 - \mathbf g}{k^2}\left(1 - e^{-kt}\right)`,
        note: "<p>For very small <code>k</code> the closed form subtracts nearly equal large numbers, so fall back to the no-drag projectile formula.</p>",
        code: String.raw`
          Point3D DragPosition(const Point3D& x0, const Vector3D& v0, const Vector3D& g, float k, float t)
          {
              if (k < 1.0e-4f)
              {
                  return x0 + v0 * t + g * (0.5f * t * t);        // the k -> 0 limit (Section 13.3)
              }
              float e = 1.0f - std::exp(-k * t);
              return x0 + g * (t / k) + (v0 * k - g) * (e / (k * k));
          }
        `,
      },
      {
        title: "Terminal velocity and time constant",
        formula: String.raw`\mathbf v_T = \frac{\mathbf g}{k}, \qquad t_{1/2} = \frac{\ln 2}{k}`,
        code: String.raw`
          Vector3D TerminalVelocity(const Vector3D& g, float k)
          {
              return g / k;
          }

          // Choose k from a design value: "the remaining speed difference halves every halfLife seconds".
          float DragFromHalfLife(float halfLife)
          {
              return 0.69314718f / halfLife;                       // ln 2 / t_half
          }
        `,
      },
      {
        title: "Frame-rate independent damping step",
        formula: String.raw`\mathbf v' = \mathbf v_T + (\mathbf v - \mathbf v_T)e^{-k\Delta t}, \qquad \mathbf x' = \mathbf x + \mathbf v_T\Delta t + \frac{\mathbf v - \mathbf v_T}{k}\left(1 - e^{-k\Delta t}\right)`,
        note: "<p>This is the exact solution applied over one frame, so the result is the same whatever the frame rate. Compare it with <code>v *= 0.98f</code>.</p>",
        code: String.raw`
          void DragStep(Point3D& x, Vector3D& v, const Vector3D& g, float k, float dt)
          {
              Vector3D vT = g / k;
              float e = std::exp(-k * dt);
              x += vT * dt + (v - vT) * ((1.0f - e) / k);      // integral of v(t) over the step
              v = vT + (v - vT) * e;
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 13.5 Friction
  // ===========================================================================
  L3D.topic({
    id: "13.5",
    summary: "Kinetic friction resists sliding, static friction holds objects in place up to a limit, and the inclined plane shows both.",

    lesson: String.raw`
      <p><strong>Friction</strong> is the force that appears when two surfaces touch. The book separates two
      kinds:</p>
      <ul>
        <li><strong>Kinetic friction</strong> acts between surfaces that are sliding over each other and resists the
          sliding.</li>
        <li><strong>Static friction</strong> acts between surfaces that are <em>not</em> sliding and holds them
          together, up to a limit.</li>
      </ul>

      <h2>Kinetic friction</h2>
      <p>The microscopic causes are messy, but the net effect is modeled well by a simple law:
      \[ F_K = -\mu_K N. \]
      Here \(N\) is the size of the <strong>normal force</strong>, the component of force pressing the two surfaces
      together (usually gravity), and \(\mu_K\) is the <strong>coefficient of kinetic friction</strong>, a positive
      constant for each pair of materials. The minus sign says the force points opposite the direction of sliding.
      To a good approximation it does not depend on the speed or on how much area is in contact.</p>

      <h2>The inclined plane</h2>
      <p>Put a block of mass \(m\) on a plane tilted by an angle \(\theta\). Split gravity \(m\mathbf g\) into a part
      along the plane and a part into it:</p>
      <ul>
        <li>along the plane, pulling the block downhill: \(F_G = mg\sin\theta\)</li>
        <li>perpendicular to the plane, pressing the surfaces together: \(N = mg\cos\theta\)</li>
      </ul>
      <p>While the block slides downhill, kinetic friction \(\mu_K mg\cos\theta\) acts uphill, and dividing the net
      force by \(m\) gives the acceleration:</p>
      <div class="formula">\[ a = g\sin\theta - \mu_K g\cos\theta \]</div>
      <p>The mass cancels: a heavy block and a light block of the same material slide identically. On a 30° slope
      with \(\mu_K = 0.5\), \(a = 9.8(0.5) - 0.5(9.8)(0.866) \approx 0.656\ \text{m/s}^2\).</p>

      <h2>Static friction</h2>
      <p>Static friction opposes whatever tangential force tries to move a resting object, but it can only push back
      so hard. Its maximum size is
      \[ F_S = \mu_S N, \]
      with the <strong>coefficient of static friction</strong> \(\mu_S\). Below that limit, static friction is exactly
      as large as needed to cancel the tangential force and no larger, so it is really an inequality:
      \(\lVert\mathbf F_{\text{tangential}}\rVert \le \mu_S N\). Once the push exceeds \(\mu_S N\), the object
      breaks free and kinetic friction takes over. Usually \(\mu_K \lt \mu_S\), which is why a heavy crate is hard
      to get moving but easier to keep moving.</p>
      <p>On the incline, the block starts to slide when the downhill pull reaches the static limit:
      \(mg\sin\theta = \mu_S mg\cos\theta\), so</p>
      <div class="formula">\[ \theta_{\text{slide}} = \tan^{-1}\mu_S \]</div>
      <p>For \(\mu_S = 0.5\) that's about 26.6°. Comparing \(\tan\theta\) with both coefficients gives three
      regimes:</p>
      <table>
        <tr><th>slope</th><th>at rest</th><th>if given a push downhill</th></tr>
        <tr><td>\(\tan\theta \lt \mu_K\)</td><td>stays put</td><td>slows down and stops</td></tr>
        <tr><td>\(\mu_K \lt \tan\theta \lt \mu_S\)</td><td>stays put</td><td>keeps accelerating</td></tr>
        <tr><td>\(\tan\theta \gt \mu_S\)</td><td>starts sliding by itself</td><td>keeps accelerating</td></tr>
      </table>
      <p>Some typical (approximate) coefficients:</p>
      <table>
        <tr><th>surfaces</th><th>\(\mu_K\)</th><th>\(\mu_S\)</th></tr>
        <tr><td>rubber on dry concrete</td><td>≈ 0.7</td><td>≈ 1.0</td></tr>
        <tr><td>rubber on wet concrete</td><td>≈ 0.5</td><td>≈ 0.6</td></tr>
        <tr><td>steel on steel (dry)</td><td>≈ 0.5</td><td>≈ 0.7</td></tr>
        <tr><td>wood on wood</td><td>≈ 0.3</td><td>≈ 0.5</td></tr>
        <tr><td>steel on ice</td><td>≈ 0.02</td><td>≈ 0.03</td></tr>
      </table>

      <div class="game">
        <ul>
          <li><b>Contact solvers</b> treat friction as a cone (or pyramid) constraint: the tangential contact force may
            be anything up to \(\mu N\). Inside the cone the contact sticks; on its surface it slides.</li>
          <li><b>Vehicles</b> use \(\mu\) per tire and per surface. A car skids on ice because \(\mu N\) is smaller than
            the force needed to turn.</li>
          <li><b>Character controllers</b> compare the slope angle with \(\tan^{-1}\mu_S\) (or a designer "max slope")
            to decide whether the player slides down.</li>
        </ul>
      </div>
      <div class="warn">Applying kinetic friction naively for a whole frame can <em>reverse</em> a slow object's
      velocity, making it jitter back and forth around zero. Clamp: if friction would carry the velocity past zero
      this step, set it to zero and switch to the static case. Also, engines combine the friction of two materials with
      a rule such as the geometric mean \(\sqrt{\mu_1\mu_2}\). That is a design convention, not physics.</div>

      <p><a class="btn goto-sim" href="#/13.5/sim">Try it: tilt the plane until the block slides →</a></p>
    `,

    keyFormulas: [
      ["Kinetic friction", String.raw`F_K = -\mu_K N`],
      ["Maximum static friction", String.raw`F_S = \mu_S N`],
      ["Incline forces", String.raw`F_G = mg\sin\theta, \qquad N = mg\cos\theta`],
      ["Sliding acceleration", String.raw`a = g\sin\theta - \mu_K g\cos\theta`],
      ["Angle where sliding starts", String.raw`\theta = \tan^{-1}\mu_S`],
    ],

    exercises: [
      { q: String.raw`A 10 kg block slides down a 30° incline with \(\mu_K = 0.5\). What is its acceleration? What if it were 50 kg?`,
        a: String.raw`\(a = g(\sin30^\circ - 0.5\cos30^\circ) \approx 9.8(0.5 - 0.433) \approx 0.656\) m/s². The mass cancels, so it's the same for 50 kg.` },
      { q: String.raw`A block rests on a board with \(\mu_S = 0.5\). How far can you tilt the board before the block slides?`,
        a: String.raw`\(\theta = \tan^{-1}0.5 \approx 26.6^\circ\).` },
      { q: String.raw`A puck slides at 8 m/s on ice with \(\mu_K = 0.1\). How far does it go, and for how long?`,
        a: String.raw`The deceleration is \(\mu_K g = 0.98\) m/s². It stops after \(v/a \approx 8.2\) s, having traveled \(v^2/(2a) = 64/1.96 \approx 32.7\) m.` },
      { q: String.raw`A mass \(M\) hangs from a rope over a pulley and pulls a mass \(m\) up an incline of angle \(\theta\) with kinetic friction \(\mu_K\). What is the acceleration?`,
        a: String.raw`Both masses accelerate together, so \((M + m)a = Mg - mg\sin\theta - \mu_K mg\cos\theta\), giving \(a = g\,\dfrac{M - m\sin\theta - \mu_K m\cos\theta}{M + m}\).` },
    ],

    sims: [
      {
        title: "Block on an incline",
        help: String.raw`<p>Raise the angle until the block breaks free at \(\theta = \tan^{-1}\mu_S\) (the dashed line
          from the bottom corner shows that critical slope). While it rests, static friction (green) exactly cancels
          the downhill pull \(mg\sin\theta\). Once it slides, friction drops to \(\mu_K N\). Use <b>Nudge</b> with
          \(\tan\theta\) between \(\mu_K\) and \(\mu_S\) to see a block that stays put until pushed, then keeps going.
          Changing the mass changes every force but not the acceleration. Arrows show force divided by \(mg\).</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { height: 420 });
          const out = sim.readout(readout);
          const r = () => view.redraw();
          const th = sim.slider(controls, { label: "Incline angle θ", min: 0, max: 60, step: 0.5, value: 20, unit: "°", onInput: r });
          const muS = sim.slider(controls, { label: "Static μₛ", min: 0, max: 1.2, step: 0.01, value: 0.5, onInput: r });
          const muK = sim.slider(controls, { label: "Kinetic μₖ", min: 0, max: 1, step: 0.01, value: 0.3, onInput: r });
          const m = sim.slider(controls, { label: "Mass m", min: 1, max: 20, step: 0.5, value: 5, unit: " kg", onInput: r });
          const L = 10, G = 9.8, START = 1;
          let s = START, v = 0, moving = false, bottomTimer = 0;
          sim.buttons(controls, [
            { label: "Reset to top", onClick: () => { s = START; v = 0; moving = false; bottomTimer = 0; } },
            { label: "Nudge downhill", onClick: () => { v = Math.max(v, 2); moving = true; } },
          ]);

          sim.loop((dt) => {
            const T = rad(th.value), sn = Math.sin(T), cs = Math.cos(T);
            if (s >= L - 0.9) {
              bottomTimer += dt;
              if (bottomTimer > 1.2) { s = START; v = 0; moving = false; bottomTimer = 0; }
            } else {
              if (!moving && Math.tan(T) > muS.value + 1e-9) moving = true;
              if (moving) {
                const a = G * (sn - muK.value * cs);
                v += a * dt;
                if (v <= 0) { v = 0; moving = false; }
                s = Math.min(s + v * dt, L - 0.9);
                if (s >= L - 0.9) { v = 0; moving = false; }
              }
            }
            view.redraw();
          });

          view.onDraw((vw) => {
            const T = rad(th.value), sn = Math.sin(T), cs = Math.cos(T);
            fitView(vw, -1.2, 11, -1, Math.max(L * sn, 2.5) + 3);
            const top = [0, L * sn], bot = [L * cs, 0];
            const u = [cs, -sn], n = [sn, cs];
            vw.line([-1, 0], [12, 0], { color: "axis", width: 1.5 });
            vw.polygon([[0, 0], top, bot], { fill: "muted", fillAlpha: 0.18, color: "muted", width: 1.5 });
            const crit = Math.atan(muS.value);
            vw.line(bot, V.add(bot, [-Math.cos(crit) * 11, Math.sin(crit) * 11]), { color: "g", dash: [6, 5], width: 1.5 });
            vw.text(V.add(bot, [-Math.cos(crit) * 6, Math.sin(crit) * 6]), "tan⁻¹ μₛ", { color: "g", size: 11, offset: [4, -6] });
            if (th.value > 0.5) vw.arc(bot, 1.3, Math.PI - T, Math.PI, { color: "b", width: 1.5 });
            const side = 0.75 + 0.03 * m.value;
            const c = V.add(V.add(top, V.scale(u, s)), V.scale(n, side / 2));
            const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => V.add(c, V.add(V.scale(u, (a * side) / 2), V.scale(n, (b * side) / 2))));
            vw.polygon(corners, { fill: "a", fillAlpha: 0.8, color: "a" });
            const A = 2.4;
            const mg = m.value * G, N = mg * cs, pull = mg * sn;
            const fric = moving ? muK.value * N : Math.min(pull, muS.value * N);
            vw.arrow(c, V.add(c, [0, -A]), { color: "e", label: "mg" });
            vw.arrow(c, V.add(c, V.scale(n, A * cs)), { color: "a", label: "N" });
            if (pull > 1e-6) vw.arrow(c, V.add(c, V.scale(u, A * sn)), { color: "b", dash: [5, 4], width: 2, label: "mg sin θ" });
            if (fric > 1e-6) vw.arrow(c, V.add(c, V.scale(u, -A * (fric / mg))), { color: "c", width: 3, label: moving ? "μₖN" : "static" });

            const a = moving ? G * (sn - muK.value * cs) : 0;
            const tn = Math.tan(T);
            const regime = tn < muK.value ? "tan θ < μₖ: sticks, and a pushed block stops" :
              tn <= muS.value ? "μₖ < tan θ ≤ μₛ: sticks until nudged, then keeps sliding" : "tan θ > μₛ: slides by itself";
            out.set(sim.rows([
              ["tan θ", fmt(tn, 3)],
              ["state", moving ? "<span class='bad'>sliding</span>" : "<span class='ok'>at rest</span>"],
              [sim.swatch("b") + "mg sin θ (downhill)", fmt(pull, 1) + " N"],
              [sim.swatch("a") + "N = mg cos θ", fmt(N, 1) + " N"],
              ["max static μₛN", fmt(muS.value * N, 1) + " N"],
              [sim.swatch("c") + "friction now", fmt(fric, 1) + " N"],
              ["acceleration a", fmt(a, 3) + " m/s²"],
              ["speed", fmt(v) + " m/s"],
              ["slides at θ = tan⁻¹ μₛ", fmt(deg(crit), 1) + "°"],
            ]) + `<hr>${regime}. ${muK.value > muS.value ? "<b class='bad'>Unusual: μₖ > μₛ.</b>" : ""}`);
          });
        },
      },
      {
        title: "Pushing a crate: static then kinetic",
        help: String.raw`<p>Push a crate with force \(P\). While \(P \le \mu_S mg\), static friction matches it
          exactly and the crate doesn't move: the operating point (lower graph) climbs the green diagonal. Past the
          limit the crate breaks free and friction drops to \(\mu_K mg\) (orange line). The leftover force
          \(P - \mu_K mg\) accelerates the crate. Turn on the ramp to see the jump happen automatically.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const scene = sim.view2d(stage, { height: 190, range: 1.3, center: [0, 0.9] });
          const graph = sim.view2d(stage, { height: 260, xRange: [-8, 155], yRange: [-8, 155] });
          const out = sim.readout(readout);
          const redrawAll = () => { scene.redraw(); graph.redraw(); };
          const P = sim.slider(controls, { label: "Applied force P", min: 0, max: 150, step: 1, value: 30, unit: " N", onInput: redrawAll });
          const m = sim.slider(controls, { label: "Mass m", min: 2, max: 15, step: 0.5, value: 10, unit: " kg", onInput: redrawAll });
          const muS = sim.slider(controls, { label: "Static μₛ", min: 0.05, max: 1, step: 0.01, value: 0.6, onInput: redrawAll });
          const muK = sim.slider(controls, { label: "Kinetic μₖ", min: 0.02, max: 1, step: 0.01, value: 0.4, onInput: redrawAll });
          const ramp = sim.checkbox(controls, { label: "Ramp P up automatically", value: false });
          const G = 9.8;
          let x = -1.5, v = 0, fr = 0;
          sim.buttons(controls, [{ label: "Stop the crate", onClick: () => { v = 0; } }]);

          sim.loop((dt) => {
            if (ramp.value) {
              let p = P.value + 14 * dt;
              if (p > 150) { p = 0; v = 0; }
              P.value = p;
            }
            const N = m.value * G, p = P.value;
            if (v <= 0) {
              v = 0;
              if (p > muS.value * N) { v = 1e-6; }
              else { fr = p; }
            }
            if (v > 0) {
              fr = muK.value * N;
              v += ((p - fr) / m.value) * dt;
              if (v <= 0) { v = 0; fr = Math.min(p, muS.value * N); }
            }
            x += v * dt;
            const b = scene.bounds;
            if (x - 0.5 > b.xmax) x = b.xmin - 0.5;
            redrawAll();
          });

          scene.onDraw((s) => {
            const b = s.bounds;
            s.rect([b.xmin, b.ymin], [b.xmax, 0], { fill: "muted", fillAlpha: 0.18, stroke: false });
            s.line([b.xmin, 0], [b.xmax, 0], { color: "axis", width: 1.5 });
            s.rect([x - 0.5, 0], [x + 0.5, 0.8], { fill: "b", fillAlpha: 0.75, color: "b" });
            const sc = 2.2 / 150;
            if (P.value > 0.5) s.arrow([x - 0.5 - P.value * sc, 0.45], [x - 0.5, 0.45], { color: "a", width: 3, label: "P" });
            if (fr > 0.5) s.arrow([x - 0.5, 0.07], [x - 0.5 - fr * sc, 0.07], { color: v > 0 ? "b" : "c", width: 3, label: "friction", labelOffset: [0, 14] });
            if (v > 0.01) s.arrow([x, 1.05], [x + Math.min(v, 6) * 0.25, 1.05], { color: "fg", width: 2 });
            s.label(8, 16, v > 0 ? `sliding at ${fmt(v)} m/s` : "at rest", { color: v > 0 ? "e" : "c", size: 12, weight: 700 });
          });

          graph.onDraw((g) => {
            plotFrame(g, "applied force P (N)", "friction (N)");
            const N = m.value * G, sMax = muS.value * N, kin = muK.value * N;
            g.line([0, 0], [Math.min(sMax, 150), Math.min(sMax, 150)], { color: "c", width: 3 });
            if (sMax < 150) {
              g.line([sMax, sMax], [sMax, kin], { color: "muted", dash: [4, 4], width: 1.5 });
              g.line([sMax, kin], [150, kin], { color: "b", width: 3 });
              g.text([sMax, sMax], "μₛ mg", { color: "c", size: 11, offset: [6, -4] });
            }
            g.line([0, kin], [150, kin], { color: "b", width: 1, dash: [3, 5], alpha: 0.6 });
            g.text([150, kin], "μₖ mg", { color: "b", size: 11, align: "right", offset: [0, -6] });
            g.point([P.value, fr], { color: "e", r: 7 });
            out.set(sim.rows([
              ["normal force N = mg", fmt(N, 1) + " N"],
              [sim.swatch("c") + "static limit μₛN", fmt(sMax, 1) + " N"],
              [sim.swatch("b") + "kinetic friction μₖN", fmt(kin, 1) + " N"],
              [sim.swatch("a") + "applied P", fmt(P.value, 1) + " N"],
              ["friction now", fmt(fr, 1) + " N"],
              ["net force", fmt(v > 0 ? P.value - fr : 0, 1) + " N"],
              ["speed", fmt(v) + " m/s"],
            ]) + (v > 0 ? (P.value < kin ? "<hr>P < μₖN: the crate is slowing down and will stick again." : "<hr>Sliding: friction is constant at μₖN.")
              : "<hr>At rest: static friction equals P exactly, up to μₛN."));
          });
        },
      },
    ],

    cpp: [
      {
        title: "Kinetic friction force",
        formula: String.raw`\mathbf F_K = -\mu_K N\,\hat{\mathbf v}_{\text{rel}}`,
        code: String.raw`
          // relVelocity: velocity of the object relative to the surface, projected into the surface plane.
          Vector3D KineticFriction(const Vector3D& relVelocity, float normalForce, float muK)
          {
              float speed = Magnitude(relVelocity);
              if (speed < 1.0e-6f) return Vector3D(0.0f, 0.0f, 0.0f);    // not sliding
              return relVelocity * (-muK * normalForce / speed);           // opposite the sliding direction
          }
        `,
      },
      {
        title: "Static friction: does it stay put?",
        formula: String.raw`\lVert\mathbf F_{\text{tangential}}\rVert \le \mu_S N`,
        code: String.raw`
          // Split the applied force into normal and tangential parts with respect to the surface normal.
          bool StaticFrictionHolds(const Vector3D& appliedForce, const Vector3D& surfaceNormal /* unit */, float muS)
          {
              float pressing = -Dot(appliedForce, surfaceNormal);        // force pushing into the surface
              if (pressing <= 0.0f) return false;                         // being pulled away: no friction
              Vector3D tangential = appliedForce + surfaceNormal * pressing;
              return SquaredMag(tangential) <= (muS * pressing) * (muS * pressing);
          }
        `,
      },
      {
        title: "Sliding down an incline",
        formula: String.raw`a = g\sin\theta - \mu_K g\cos\theta, \qquad \theta_{\text{slide}} = \tan^{-1}\mu_S`,
        code: String.raw`
          // Acceleration along an incline (downhill positive) for a block that is already sliding.
          float InclineAcceleration(float theta, float muK, float g)
          {
              return g * (std::sin(theta) - muK * std::cos(theta));    // mass cancels out
          }

          bool StartsSliding(float theta, float muS)
          {
              return std::tan(theta) > muS;                            // theta > atan(muS)
          }
        `,
      },
      {
        title: "A friction step that never reverses the velocity",
        formula: String.raw`\Delta v = \mu_K g\,\Delta t, \qquad v' = \max(0,\; \lVert\mathbf v\rVert - \Delta v)\,\hat{\mathbf v}`,
        note: "<p>Friction can stop an object but never push it backward. Clamping removes the jitter you get from applying a full step of friction to an almost-stopped object.</p>",
        code: String.raw`
          // Horizontal ground, no other tangential forces.
          Vector3D ApplyGroundFriction(const Vector3D& v, float muK, float g, float dt)
          {
              float speed = Magnitude(v);
              float drop = muK * g * dt;                    // speed that friction removes this step
              if (speed <= drop) return Vector3D(0.0f, 0.0f, 0.0f);
              return v * ((speed - drop) / speed);
          }
        `,
      },
    ],
  });
})();
