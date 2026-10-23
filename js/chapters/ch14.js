// Chapter 14 - Rotational Physics
(function () {
  "use strict";
  const { V, M, fmt, fmtVec, rad, deg, clamp } = L3D.math;

  // ===========================================================================
  // Shared helpers
  // ===========================================================================

  function fitView(v, x0, x1, y0, y1) {
    const w = Math.max(v.w, 1), h = Math.max(v.h, 1);
    v.range = Math.max((y1 - y0) / 2, ((x1 - x0) / 2) * (h / w));
    v.center = [(x0 + x1) / 2, (y0 + y1) / 2];
  }

  function plotFrame(v, xLabel, yLabel) {
    v.grid();
    v.axes({ ticks: true, labels: [xLabel, yLabel] });
  }

  // Direction from heading (in the xz-plane, from +x toward -z) and elevation, y up.
  const dirFrom = (headingDeg, elevDeg) => {
    const h = rad(headingDeg), e = rad(elevDeg);
    return [Math.cos(e) * Math.cos(h), Math.sin(e), -Math.cos(e) * Math.sin(h)];
  };

  // 3x3 matrix as monospace text for readouts.
  const matHTML = (A, d = 3) =>
    `<div class="eq">${A.map((r) => "[ " + r.map((x) => fmt(x, d).padStart(d + 4)).join(" ") + " ]").join("\n")}</div>`;

  // Eigen-decomposition of a symmetric 3x3 matrix by Jacobi rotations (Section 16.3).
  // Returns eigenvalues ascending and unit eigenvectors (as arrays).
  function jacobiEigen(A) {
    const a = A.map((r) => r.slice());
    const Vm = M.identity(3);
    for (let sweep = 0; sweep < 40; sweep++) {
      const off = a[0][1] ** 2 + a[0][2] ** 2 + a[1][2] ** 2;
      if (off < 1e-22) break;
      for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
        if (Math.abs(a[p][q]) < 1e-14) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < 3; k++) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 3; k++) {
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 3; k++) {
          const vkp = Vm[k][p], vkq = Vm[k][q];
          Vm[k][p] = c * vkp - s * vkq;
          Vm[k][q] = s * vkp + c * vkq;
        }
      }
    }
    const pairs = [0, 1, 2].map((j) => ({ value: a[j][j], vector: [Vm[0][j], Vm[1][j], Vm[2][j]] }));
    pairs.sort((x, y) => x.value - y.value);
    return pairs;
  }

  // Solve x'' + a x' + b x = 0 with x(0) = x0, x'(0) = v0 (same as Section 13.2).
  function solveHomogeneous(a, b, x0, v0) {
    const disc = a * a - 4 * b;
    if (Math.abs(disc) < 1e-6) {
      const r = -a / 2, A = x0, B = v0 - r * x0;
      return { kind: "repeated", x: (t) => (A + B * t) * Math.exp(r * t) };
    }
    if (disc > 0) {
      const s = Math.sqrt(disc), r1 = (-a + s) / 2, r2 = (-a - s) / 2;
      const A = (v0 - r2 * x0) / (r1 - r2), B = (r1 * x0 - v0) / (r1 - r2);
      return { kind: "real", x: (t) => A * Math.exp(r1 * t) + B * Math.exp(r2 * t) };
    }
    const al = -a / 2, be = Math.sqrt(-disc) / 2, C1 = x0, C2 = (v0 - al * x0) / be;
    return { kind: "complex", alpha: al, beta: be, amp: Math.hypot(C1, C2),
      x: (t) => Math.exp(al * t) * (C1 * Math.cos(be * t) + C2 * Math.sin(be * t)) };
  }

  // Arithmetic-geometric mean (for the exact pendulum period).
  function agm(a, b) {
    for (let i = 0; i < 30 && Math.abs(a - b) > 1e-15; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
    return a;
  }

  // Closed cylinder mesh along z (radius R, height h), faces counterclockwise from outside.
  function cylinderMesh(R, h, seg = 20) {
    const vertices = [], faces = [];
    for (let i = 0; i < seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      vertices.push([R * Math.cos(t), R * Math.sin(t), -h / 2]);
    }
    for (let i = 0; i < seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      vertices.push([R * Math.cos(t), R * Math.sin(t), h / 2]);
    }
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      faces.push([i, j, seg + j, seg + i]);
    }
    faces.push(Array.from({ length: seg }, (_, i) => seg + i));
    faces.push(Array.from({ length: seg }, (_, i) => seg - 1 - i));
    return { vertices, faces };
  }

  // ===========================================================================
  // 14.1 Rotating Environments
  // ===========================================================================
  L3D.topic({
    id: "14.1",
    summary: "Angular velocity as a vector, v = ω × r, and the centrifugal and Coriolis forces felt by objects in a rotating frame.",

    lesson: String.raw`
      <p>A <strong>rotating environment</strong> is any frame of reference that spins about an axis: a merry-go-round,
      a spinning space station, a rotating platform in a level, or the Earth itself. Objects in such a frame
      seem to feel strange extra forces. This section explains where they come from.</p>

      <h2 data-sub="14.1.1">Angular Velocity</h2>
      <p>Picture a particle tied by a string of length \(r\) to an axis with unit direction \(\mathbf A\). Pick unit
      vectors \(\mathbf X\) and \(\mathbf Y\) in the plane perpendicular to the axis so that
      \(\mathbf X\times\mathbf Y = \mathbf A\) (right-handed), and let \(\theta(t)\) be the counterclockwise angle of
      the string measured from \(\mathbf X\). The <strong>angular velocity</strong> is the rate at which that angle
      changes:
      \[ \omega(t) = \dot\theta(t) = \frac{d}{dt}\theta(t). \]
      It is measured in radians per second. To carry the axis as well, angular velocity is usually written as a
      <em>vector</em> along the axis, with length equal to the rate:</p>
      <div class="formula">\[ \boldsymbol\omega(t) = \omega(t)\,\mathbf A \]</div>
      <p>The right-hand rule fixes the direction: curl the fingers of your right hand the way the object turns, and
      your thumb points along \(\boldsymbol\omega\).</p>
      <p>A particle at distance \(r\) from the axis moves at speed \(v = \omega r\). The speed alone doesn't say which
      way the particle moves, but a cross product does. With \(\mathbf r(t)\) the particle's position measured from
      any origin on the axis,</p>
      <div class="formula">\[ \mathbf v(t) = \boldsymbol\omega(t)\times\mathbf r(t) \]</div>
      <p>The cross product is perpendicular to both the axis and \(\mathbf r\), which is the direction of motion
      around the circle. Its length is \(\omega\lVert\mathbf r\rVert\sin\phi\), and
      \(\lVert\mathbf r\rVert\sin\phi\) is exactly the distance from the particle to the axis.</p>

      <h2 data-sub="14.1.2">The Centrifugal Force</h2>
      <p>Differentiate \(\mathbf v = \boldsymbol\omega\times\mathbf r\) with the product rule, and replace
      \(\dot{\mathbf r}\) with \(\mathbf v = \boldsymbol\omega\times\mathbf r\):
      \[ \mathbf a(t) = \dot{\boldsymbol\omega}\times\mathbf r + \boldsymbol\omega\times(\boldsymbol\omega\times\mathbf r). \]
      If the spin rate is constant, the first term vanishes. The second term is always there. It points from the
      particle straight toward the axis: it is the <em>centripetal</em> acceleration supplied by the tension in the
      string. The particle itself feels an equal and opposite push away from the axis, the
      <strong>centrifugal force</strong>:</p>
      <div class="formula">\[ \mathbf F_{\text{centrifugal}} = -m\,\boldsymbol\omega\times(\boldsymbol\omega\times\mathbf r) \]</div>
      <p>When \(\mathbf r\) is perpendicular to \(\boldsymbol\omega\), its size is
      \(F = m\omega^2r = mv^2/r\), where \(r\) is the distance from the axis.</p>

      <h2 data-sub="14.1.3">The Coriolis Force</h2>
      <p>Now let the particle also move <em>relative to</em> the rotating frame with velocity \(\mathbf v_r\), like a
      ball rolled across a turntable. A stationary observer sees the total velocity
      \(\mathbf v = \boldsymbol\omega\times\mathbf r + \mathbf v_r\). Differentiating again, and remembering that
      \(\mathbf v_r\) itself is carried around by the rotation, gives
      \[ \mathbf a = \dot{\boldsymbol\omega}\times\mathbf r + \boldsymbol\omega\times(\boldsymbol\omega\times\mathbf r)
         + 2\boldsymbol\omega\times\mathbf v_r + \mathbf a_r, \]
      where \(\mathbf a_r\) is the acceleration measured inside the rotating frame. Multiply by \(m\) and solve for what
      an observer riding the frame measures:
      \[ m\mathbf a_r = \mathbf F - m\,\dot{\boldsymbol\omega}\times\mathbf r - m\,\boldsymbol\omega\times(\boldsymbol\omega\times\mathbf r)
         - 2m\,\boldsymbol\omega\times\mathbf v_r. \]
      The centrifugal term appears again, joined by a new one, the <strong>Coriolis force</strong>:</p>
      <div class="formula">\[ \mathbf F_{\text{Coriolis}} = -2m\,\boldsymbol\omega\times\mathbf v_r \]</div>
      <p>It exists only while the particle moves relative to the frame, and it is always perpendicular to that
      motion, so it bends the path without changing the speed. On a counterclockwise turntable it deflects moving
      objects to the <em>right</em>. On Earth this is why large storms turn counterclockwise in the northern
      hemisphere and clockwise in the southern: the relevant component of \(\boldsymbol\omega\) changes sign at the
      equator.</p>

      <div class="key">Centrifugal and Coriolis forces are <em>fictitious</em> (inertial) forces. Nothing pushes
      the object; they appear because the observer's frame is accelerating. Seen from outside, a puck sliding off a
      turntable moves in a perfectly straight line. Seen from the turntable, it curves.</div>

      <div class="game">
        <ul>
          <li><b>Moving platforms:</b> a carousel or rotating level section is usually simulated in world space,
            and then no fictitious forces are needed. Add them only if you simulate in the platform's local frame.</li>
          <li><b>Artificial gravity:</b> a station of radius \(r\) must spin at \(\omega = \sqrt{g/r}\) to give
            people on the rim 1 g of centrifugal "weight".</li>
          <li><b>Long-range ballistics</b> in sniper games sometimes add a Coriolis drift for realism.</li>
        </ul>
      </div>
      <div class="warn">\(\boldsymbol\omega\times(\boldsymbol\omega\times\mathbf r)\) is not
      \((\boldsymbol\omega\times\boldsymbol\omega)\times\mathbf r\), which would be zero. The cross product isn't
      associative (Section 2.3), so evaluate the inner product first.</div>

      <p><a class="btn goto-sim" href="#/14.1/sim">Try it: throw a ball across a spinning turntable →</a></p>
    `,

    keyFormulas: [
      ["Angular velocity", String.raw`\boldsymbol\omega(t) = \dot\theta(t)\,\mathbf A`],
      ["Linear velocity", String.raw`\mathbf v = \boldsymbol\omega\times\mathbf r,\quad v = \omega r`],
      ["Centrifugal force", String.raw`\mathbf F_{\text{centrifugal}} = -m\,\boldsymbol\omega\times(\boldsymbol\omega\times\mathbf r),\quad F = m\omega^2r = \frac{mv^2}{r}`],
      ["Coriolis force", String.raw`\mathbf F_{\text{Coriolis}} = -2m\,\boldsymbol\omega\times\mathbf v_r`],
    ],

    exercises: [
      { q: String.raw`A point is at \(\mathbf r = \langle 2, 0, 0\rangle\) on a body spinning with \(\boldsymbol\omega = \langle 0, 0, 3\rangle\) rad/s. What are its velocity and centripetal acceleration?`,
        a: String.raw`\(\mathbf v = \boldsymbol\omega\times\mathbf r = \langle 0, 6, 0\rangle\). \(\boldsymbol\omega\times\mathbf v = \langle -18, 0, 0\rangle\), pointing toward the axis with size \(\omega^2r = 18\).` },
      { q: String.raw`An ant walks straight outward at speed \(v\) on a disk spinning at \(\omega\). At distance \(r\) from the center, how big are the fictitious forces on it?`,
        a: String.raw`Centrifugal \(m\omega^2r\) outward and Coriolis \(2m\omega v\) sideways. They are perpendicular, so the total is \(m\omega\sqrt{\omega^2r^2 + 4v^2}\).` },
      { q: String.raw`A block sits at distance \(r\) from the center of a turntable with static friction \(\mu_S\). How fast can the table spin before the block slides?`,
        a: String.raw`It slides when the centrifugal force exceeds the friction limit: \(m\omega^2r = \mu_Smg\), so \(\omega = \sqrt{\mu_Sg/r}\). The mass cancels.` },
      { q: "How fast must a space station of radius 100 m spin to give 1 g on the rim?",
        a: String.raw`\(\omega = \sqrt{9.8/100} \approx 0.313\) rad/s, about one turn every 20 s (3 rpm).` },
    ],

    sims: [
      {
        title: "Turntable: inertial vs. rotating frame",
        help: String.raw`<p>Someone standing on a turntable throws a puck that slides without friction. <b>Left:</b>
          the fixed world view, where the puck goes in a straight line while the disk spins under it. <b>Right:</b>
          the same motion seen by a camera riding the disk. There the path curves, and the curve is exactly what the
          centrifugal force \(m\omega^2\mathbf r\) (orange) and the Coriolis force \(-2m\boldsymbol\omega\times\mathbf v_r\)
          (purple) produce. The green dots integrate those fictitious forces numerically and land on the transformed
          path.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout({ side: "bottom" });
          const [c1, c2] = sim.split(stage, 2);
          const vi = sim.view2d(c1, { height: 360, range: 1.2 });
          const vr = sim.view2d(c2, { height: 360, range: 1.2 });
          const out = sim.readout(readout);
          const g1 = sim.group(controls, "Turntable and throw");
          const restart = () => { t = 0; };
          const w = sim.slider(g1, { label: "Angular velocity ω", min: -3, max: 3, step: 0.1, value: 1.5, unit: " rad/s", onInput: restart });
          const r0 = sim.slider(g1, { label: "Thrower distance from center", min: 0, max: 0.9, step: 0.05, value: 0, unit: " m", onInput: restart });
          const sp = sim.slider(g1, { label: "Throw speed (relative to disk)", min: 0.2, max: 2, step: 0.05, value: 0.6, unit: " m/s", onInput: restart });
          const dir = sim.slider(g1, { label: "Throw direction (0° = outward)", min: -180, max: 180, step: 5, value: 0, unit: "°", onInput: restart });
          const g2 = sim.group(controls, "Display");
          const showNum = sim.checkbox(g2, { label: "Numerical integration with fictitious forces", value: true });
          const showF = sim.checkbox(g2, { label: "Centrifugal and Coriolis arrows", value: true });
          sim.buttons(g2, [{ label: "Throw again", primary: true, onClick: restart }]);
          sim.legend(g2, [["a", "puck path"], ["c", "numerical (rotating frame)"], ["b", "centrifugal"], ["d", "Coriolis"]]);
          let t = 0;

          // Throw setup. The thrower stands at R0 = (r0, 0) in disk coordinates; at t = 0 both frames agree.
          function setup() {
            const W = w.value, R0 = [r0.value, 0];
            const vrel = [sp.value * Math.cos(rad(dir.value)), sp.value * Math.sin(rad(dir.value))];
            const Vw = V.add(vrel, [-W * R0[1], W * R0[0]]);                 // v = v_r + ω × r
            const a = V.dot(Vw, Vw), b = 2 * V.dot(R0, Vw), c = V.dot(R0, R0) - 1;
            const tExit = a > 1e-9 ? (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a) : 10;
            return { W, R0, vrel, Vw, tExit: Math.min(tExit, 12) };
          }
          const inertial = (S, tt) => V.add(S.R0, V.scale(S.Vw, tt));
          const toRot = (S, p, tt) => V.rotate2(p, -S.W * tt);
          const rotVel = (S, q, tt) => V.sub(V.rotate2(S.Vw, -S.W * tt), [-S.W * q[1], S.W * q[0]]);

          // RK4 in the rotating frame with a_r = ω² q + 2ω (u_y, −u_x)   (centrifugal + Coriolis per unit mass)
          let cacheKey = "", numPts = [];
          function numerical(S) {
            const key = [S.W, S.R0[0], S.vrel[0], S.vrel[1]].join(",");
            if (key === cacheKey) return numPts;
            cacheKey = key;
            const acc = (q, u) => [S.W * S.W * q[0] + 2 * S.W * u[1], S.W * S.W * q[1] - 2 * S.W * u[0]];
            let q = S.R0.slice(), u = S.vrel.slice();
            const h = 1 / 240, pts = [q.slice()];
            const n = Math.ceil(S.tExit / h);
            for (let i = 1; i <= n; i++) {
              const k1q = u, k1u = acc(q, u);
              const k2q = V.add(u, V.scale(k1u, h / 2)), k2u = acc(V.add(q, V.scale(k1q, h / 2)), k2q);
              const k3q = V.add(u, V.scale(k2u, h / 2)), k3u = acc(V.add(q, V.scale(k2q, h / 2)), k3q);
              const k4q = V.add(u, V.scale(k3u, h)), k4u = acc(V.add(q, V.scale(k3q, h)), k4q);
              q = V.add(q, V.scale(V.add(V.add(k1q, V.scale(k2q, 2)), V.add(V.scale(k3q, 2), k4q)), h / 6));
              u = V.add(u, V.scale(V.add(V.add(k1u, V.scale(k2u, 2)), V.add(V.scale(k3u, 2), k4u)), h / 6));
              if (i % 12 === 0) pts.push([...q, i * h]);
            }
            numPts = pts;
            return pts;
          }

          sim.loop((dt) => {
            const S = setup();
            t += dt;
            if (t > S.tExit + 1.2) t = 0;
            vi.redraw();
            vr.redraw();
          });

          function drawDisk(v, angle, title) {
            v.circle([0, 0], 1, { fill: "muted", fillAlpha: 0.1, color: "muted", width: 1.5 });
            for (let k = 0; k < 6; k++) {
              const a = angle + (k * Math.PI) / 3;
              v.line([0, 0], [Math.cos(a), Math.sin(a)], { color: k === 0 ? "g" : "muted", width: k === 0 ? 2 : 1, alpha: 0.7 });
            }
            v.label(8, 18, title, { color: "fg", size: 12, weight: 700 });
          }

          vi.onDraw((v) => {
            const S = setup(), tt = Math.min(t, S.tExit);
            drawDisk(v, S.W * tt, "Inertial frame (fixed camera)");
            v.arc([0, 0], 1.08, 0.2, 0.9, { color: "muted", width: 1.5 });
            v.text([Math.cos(0.9) * 1.1, Math.sin(0.9) * 1.1], S.W >= 0 ? "↺ ω" : "↻ ω", { color: "muted", size: 12 });
            const full = [inertial(S, 0), inertial(S, S.tExit)];
            v.line(full[0], full[1], { color: "a", dash: [4, 5], width: 1, alpha: 0.5 });
            v.line(full[0], inertial(S, tt), { color: "a", width: 2.5 });
            v.point(V.rotate2(S.R0, S.W * tt), { color: "g", r: 6, label: "thrower" });
            v.point(inertial(S, tt), { color: "a", r: 7 });
          });

          vr.onDraw((v) => {
            const S = setup(), tt = Math.min(t, S.tExit);
            drawDisk(v, 0, "Rotating frame (camera on the disk)");
            const pts = [];
            for (let i = 0; i <= 160; i++) { const s = (S.tExit * i) / 160; pts.push(toRot(S, inertial(S, s), s)); }
            v.polyline(pts, { color: "a", dash: [4, 5], width: 1, alpha: 0.5 });
            v.polyline(pts.filter((_, i) => (S.tExit * i) / 160 <= tt), { color: "a", width: 2.5 });
            if (showNum.value) numerical(S).forEach((p) => v.point(p, { color: "c", r: 2.2 }));
            v.point(S.R0, { color: "g", r: 6, label: "thrower" });
            const q = toRot(S, inertial(S, tt), tt), u = rotVel(S, q, tt);
            const cf = V.scale(q, S.W * S.W), co = [2 * S.W * u[1], -2 * S.W * u[0]];
            if (showF.value) {
              const k = 0.18;
              v.arrow(q, V.add(q, V.scale(cf, k)), { color: "b", width: 2.5 });
              v.arrow(q, V.add(q, V.scale(co, k)), { color: "d", width: 2.5 });
            }
            v.arrow(q, V.add(q, V.scale(u, 0.3)), { color: "fg", width: 1.5, alpha: 0.6 });
            v.point(q, { color: "a", r: 7 });
            out.set(sim.rows([
              ["time t", fmt(tt) + " s"],
              ["distance from axis |r|", fmt(V.len(q)) + " m"],
              ["speed relative to disk |v_r|", fmt(V.len(u)) + " m/s"],
              [sim.swatch("b") + "centrifugal / m = ω²|r|", fmt(V.len(cf)) + " m/s²"],
              [sim.swatch("d") + "Coriolis / m = 2|ω||v_r|", fmt(V.len(co)) + " m/s²"],
              ["inertial speed (constant)", fmt(V.len(S.Vw)) + " m/s"],
            ]) + `<hr>${Math.abs(S.W) < 1e-9 ? "No rotation: both views agree." :
              `ω ${S.W > 0 ? "> 0 (counterclockwise): Coriolis deflects the puck to its <b>right</b>" : "< 0 (clockwise): Coriolis deflects the puck to its <b>left</b>"} as seen on the disk.`}`);
          });
        },
      },
      {
        title: "v = ω × r in 3D",
        help: String.raw`<p>A particle rotates about the axis \(\mathbf A\) (dashed) with angular velocity
          \(\boldsymbol\omega = \omega\mathbf A\) (purple). Its velocity \(\mathbf v = \boldsymbol\omega\times\mathbf r\)
          (green) is tangent to the circle, and its centripetal acceleration
          \(\boldsymbol\omega\times(\boldsymbol\omega\times\mathbf r)\) (red) points straight at the axis. Changing the
          height along the axis changes \(\mathbf r\) but not \(\mathbf v\): only the distance from the axis counts.
          Negative \(\omega\) flips \(\boldsymbol\omega\) and the direction of travel.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view3d(stage, { height: 460, distance: 6.5, yaw: 0.6, pitch: 0.35, target: [0, 0.5, 0] });
          const out = sim.readout(readout);
          const r = () => view.redraw();
          const w = sim.slider(controls, { label: "Angular speed ω", min: -3, max: 3, step: 0.1, value: 1.2, unit: " rad/s", onInput: r });
          const tilt = sim.slider(controls, { label: "Axis tilt from vertical", min: 0, max: 80, step: 1, value: 25, unit: "°", onInput: r });
          const head = sim.slider(controls, { label: "Axis heading", min: -180, max: 180, step: 1, value: 30, unit: "°", onInput: r });
          const rho = sim.slider(controls, { label: "Distance from axis", min: 0.3, max: 2.5, step: 0.05, value: 1.5, unit: " m", onInput: r });
          const hgt = sim.slider(controls, { label: "Height along axis", min: -1.5, max: 2, step: 0.05, value: 1, unit: " m", onInput: r });
          const anim = sim.checkbox(controls, { label: "Animate", value: true });
          const showA = sim.checkbox(controls, { label: "Show centripetal acceleration", value: true, onChange: r });
          let phase = 0;
          sim.loop((dt) => { if (anim.value) { phase += w.value * dt; view.redraw(); } });

          view.onDraw((v) => {
            const T = rad(tilt.value), H = rad(head.value);
            const A = [Math.sin(T) * Math.cos(H), Math.cos(T), -Math.sin(T) * Math.sin(H)];
            const u = V.anyPerp(A), wv = V.cross(A, u);
            const center = V.scale(A, hgt.value);
            const R = V.add(center, V.add(V.scale(u, rho.value * Math.cos(phase)), V.scale(wv, rho.value * Math.sin(phase))));
            const om = V.scale(A, w.value);
            const vel = V.cross(om, R);
            const acc = V.cross(om, vel);
            v.grid({ size: 3, step: 1 });
            v.axes({ length: 1 });
            v.line(V.scale(A, -2.5), V.scale(A, 3.2), { color: "muted", dash: [6, 5], width: 1.5 });
            v.circle(center, A, rho.value, { color: "f", width: 1.5, alpha: 0.8 });
            v.line(center, R, { color: "muted", dash: [3, 3], width: 1 });
            if (Math.abs(w.value) > 0.01) v.arrow([0, 0, 0], om, { color: "d", width: 3.5, label: "ω" });
            v.arrow([0, 0, 0], R, { color: "a", width: 2.5, label: "r" });
            if (V.len(vel) > 0.01) v.arrow(R, V.add(R, V.scale(vel, 0.4)), { color: "c", width: 3, label: "v = ω×r" });
            if (showA.value && V.len(acc) > 0.01) v.arrow(R, V.add(R, V.scale(acc, 0.15)), { color: "e", width: 2.5, label: "ω×(ω×r)" });
            v.sphere(R, 0.13, { fill: "b" });
            const sinPhi = Math.sin(V.angle(om, R));
            out.set(sim.rows([
              [sim.swatch("d") + "ω", fmtVec(om)],
              [sim.swatch("a") + "r", fmtVec(R)],
              [sim.swatch("c") + "v = ω × r", fmtVec(vel)],
              ["|v|", fmt(V.len(vel))],
              ["|ω| × distance to axis", fmt(Math.abs(w.value) * rho.value)],
              ["|ω| |r| sin φ", fmt(Math.abs(w.value) * V.len(R) * sinPhi)],
              ["v · r and v · ω", fmt(V.dot(vel, R), 3) + ", " + fmt(V.dot(vel, om), 3)],
              [sim.swatch("e") + "|ω×(ω×r)| = ω²ρ", fmt(V.len(acc)) + " = " + fmt(w.value * w.value * rho.value)],
            ]) + "<hr>The centrifugal force on a 1 kg particle is the red vector reversed: it points away from the axis.");
          });
        },
      },
    ],

    cpp: [
      {
        title: "Velocity of a rotating point",
        formula: String.raw`\mathbf v = \boldsymbol\omega\times\mathbf r, \qquad \boldsymbol\omega = \omega\mathbf A`,
        code: String.raw`
          // r is measured from any point on the rotation axis.
          Vector3D PointVelocity(const Vector3D& omega, const Vector3D& r)
          {
              return Cross(omega, r);
          }

          // Velocity of a point on a moving, spinning rigid body.
          Vector3D BodyPointVelocity(const Vector3D& comVelocity, const Vector3D& omega,
                                     const Point3D& com, const Point3D& point)
          {
              return comVelocity + Cross(omega, point - com);
          }
        `,
      },
      {
        title: "Centrifugal force",
        formula: String.raw`\mathbf F_{\text{centrifugal}} = -m\,\boldsymbol\omega\times(\boldsymbol\omega\times\mathbf r)`,
        code: String.raw`
          Vector3D CentrifugalForce(float m, const Vector3D& omega, const Vector3D& r)
          {
              return Cross(omega, Cross(omega, r)) * -m;     // inner cross product first
          }

          // Spin rate that gives artificial gravity g at radius r:  m w^2 r = m g
          float ArtificialGravitySpin(float g, float r)
          {
              return std::sqrt(g / r);
          }
        `,
      },
      {
        title: "Coriolis force",
        formula: String.raw`\mathbf F_{\text{Coriolis}} = -2m\,\boldsymbol\omega\times\mathbf v_r`,
        code: String.raw`
          // vRel: velocity measured in the rotating frame.
          Vector3D CoriolisForce(float m, const Vector3D& omega, const Vector3D& vRel)
          {
              return Cross(omega, vRel) * (-2.0f * m);
          }
        `,
      },
      {
        title: "Moving a particle in a rotating frame",
        formula: String.raw`\mathbf a_r = \frac{\mathbf F}{m} - \boldsymbol\omega\times(\boldsymbol\omega\times\mathbf r) - 2\,\boldsymbol\omega\times\mathbf v_r \quad(\dot{\boldsymbol\omega} = \mathbf 0)`,
        note: "<p>Only needed when you simulate in the platform's own coordinates (for example, local physics on a rotating ship). In world coordinates just integrate F/m.</p>",
        code: String.raw`
          struct LocalParticle
          {
              Point3D  r;        // position in the rotating frame (origin on the axis)
              Vector3D vRel;     // velocity in the rotating frame
              float    mass;
          };

          void StepInRotatingFrame(LocalParticle& p, const Vector3D& realForce, const Vector3D& omega, float dt)
          {
              Vector3D a = realForce / p.mass
                         - Cross(omega, Cross(omega, p.r))       // centrifugal / m
                         - Cross(omega, p.vRel) * 2.0f;          // Coriolis / m
              p.vRel += a * dt;                                 // semi-implicit Euler
              p.r += p.vRel * dt;
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 14.2 Rigid Body Motion
  // ===========================================================================
  L3D.topic({
    id: "14.2",
    summary: "Center of mass, angular momentum and torque, the inertia tensor that links them, its principal axes, and how to move and rotate it.",

    lesson: String.raw`
      <p>A <strong>rigid body</strong> is a system of particles that never move relative to one another, so all of
      them share one angular velocity. A solid object is the limit of infinitely many tiny particles. Because the
      particles don't move within the body, centrifugal and Coriolis effects don't deform it. Its motion splits into
      two parts: its <em>center of mass</em> travels through space (linear motion, Chapter 13), and the body turns
      about an axis through that point (angular motion, this section).</p>

      <h2 data-sub="14.2.1">Center of Mass</h2>
      <p>For particles of mass \(m_k\) at positions \(\mathbf r_k\), the total mass and the
      <strong>center of mass</strong> are</p>
      <div class="formula">\[ M = \sum_k m_k, \qquad \mathbf C = \frac1M\sum_k m_k\mathbf r_k. \]</div>
      <p>It is the mass-weighted average position. Relative to \(\mathbf C\) the weighted offsets cancel,
      \(\sum_k m_k(\mathbf r_k - \mathbf C) = \mathbf 0\), which is why a force applied through \(\mathbf C\)
      produces no rotation and a freely spinning body rotates about an axis through \(\mathbf C\). For a solid with
      density \(\rho(\mathbf r)\), the sums become integrals over the volume \(V\):
      \[ M = \int_V \rho(\mathbf r)\,dV, \qquad \mathbf C = \frac1M\int_V \mathbf r\,\rho(\mathbf r)\,dV. \]
      For example, slicing a solid cone of height \(h\) into disks of radius \(r(z) = (h - z)R/h\) and integrating in
      cylindrical coordinates (Appendix C) puts its center of mass on the axis at \(h/4\) above the base. The bulk of
      the material is near the wide end.</p>

      <h2 data-sub="14.2.2">Angular Momentum and Torque</h2>
      <p>A particle's linear momentum is \(\mathbf p = m\mathbf v\). Its rotational counterpart, the
      <strong>angular momentum</strong> about the origin, is</p>
      <div class="formula">\[ \mathbf L = \mathbf r\times\mathbf p. \]</div>
      <p>Differentiate it: \(\dot{\mathbf L} = \dot{\mathbf r}\times\mathbf p + \mathbf r\times\dot{\mathbf p}\). The
      first term is \(\mathbf v\times m\mathbf v = \mathbf 0\), and \(\dot{\mathbf p} = \mathbf F\), so the rate of change
      of angular momentum is the <strong>torque</strong>:</p>
      <div class="formula">\[ \boldsymbol\tau = \mathbf r\times\mathbf F = \dot{\mathbf L} \]</div>
      <p>Torque is to rotation what force is to linear motion. Its size is \(F\) times the <em>moment arm</em>, the
      perpendicular distance from the origin to the force's line of action. With no net torque, angular momentum is
      conserved. That is why a spinning skater speeds up when pulling in their arms.</p>
      <table>
        <tr><th>linear</th><th>rotational</th></tr>
        <tr><td>position \(\mathbf x\)</td><td>orientation (angle \(\theta\))</td></tr>
        <tr><td>velocity \(\mathbf v\)</td><td>angular velocity \(\boldsymbol\omega\)</td></tr>
        <tr><td>mass \(m\)</td><td>inertia tensor \(\mathcal I\)</td></tr>
        <tr><td>momentum \(\mathbf p = m\mathbf v\)</td><td>angular momentum \(\mathbf L = \mathcal I\boldsymbol\omega\)</td></tr>
        <tr><td>force \(\mathbf F = \dot{\mathbf p}\)</td><td>torque \(\boldsymbol\tau = \dot{\mathbf L}\)</td></tr>
      </table>

      <h2 data-sub="14.2.3">The Inertia Tensor</h2>
      <p>For a rigid body, sum \(\mathbf L\) over all particles and use \(\mathbf v_k = \boldsymbol\omega\times\mathbf r_k\):
      \[ \mathbf L = \sum_k m_k\,\mathbf r_k\times(\boldsymbol\omega\times\mathbf r_k)
                   = \sum_k m_k\big(r_k^2\,\boldsymbol\omega - (\mathbf r_k\cdot\boldsymbol\omega)\,\mathbf r_k\big), \]
      using the identity \(\mathbf P\times(\mathbf Q\times\mathbf P) = P^2\mathbf Q - (\mathbf P\cdot\mathbf Q)\mathbf P\).
      Every term is linear in \(\boldsymbol\omega\), so the whole thing is a matrix times \(\boldsymbol\omega\):</p>
      <div class="formula">
        \[ \mathbf L = \mathcal I\,\boldsymbol\omega, \qquad \mathcal I_{ij} = \sum_k m_k\big(\delta_{ij}\,r_k^2 - (\mathbf r_k)_i(\mathbf r_k)_j\big) \]
      </div>
      <p>The \(3\times3\) matrix \(\mathcal I\) is the <strong>inertia tensor</strong>. Written out,
      \[ \mathcal I = \sum_k m_k\begin{bmatrix} y_k^2 + z_k^2 & -x_ky_k & -x_kz_k \\ -x_ky_k & x_k^2 + z_k^2 & -y_kz_k \\ -x_kz_k & -y_kz_k & x_k^2 + y_k^2 \end{bmatrix}
         = \sum_k m_k\big(r_k^2\mathbf E_3 - \mathbf r_k\otimes\mathbf r_k\big). \]
      It is symmetric. Its diagonal entries are the <strong>moments of inertia</strong> about the x, y and z axes (mass
      times squared distance from that axis). The off-diagonal entries are the <strong>products of inertia</strong>.
      For a solid, \(\mathcal I_{ij} = \int_V(\delta_{ij}r^2 - r_ir_j)\rho\,dV\). Because it is a sum, the tensor of an
      object made of pieces is the sum of the pieces' tensors (taken about the same point).</p>
      <p>Differentiating \(\mathbf L = \mathcal I\boldsymbol\omega\) relates torque to the angular acceleration
      \(\boldsymbol\alpha = \dot{\boldsymbol\omega}\): \(\boldsymbol\tau = \mathcal I\boldsymbol\alpha\), the rotational
      \(\mathbf F = m\mathbf a\) (with a correction, below, when \(\boldsymbol\omega\) is off a principal axis).</p>
      <p>Integrating over standard solids of mass \(m\), centered at their centers of mass:</p>
      <table>
        <tr><th>solid</th><th>\(\mathcal I_{xx}\)</th><th>\(\mathcal I_{yy}\)</th><th>\(\mathcal I_{zz}\)</th></tr>
        <tr><td>sphere, radius \(R\)</td><td>\(\tfrac25mR^2\)</td><td>\(\tfrac25mR^2\)</td><td>\(\tfrac25mR^2\)</td></tr>
        <tr><td>cylinder along z, radius \(R\), height \(h\)</td><td>\(\tfrac14mR^2 + \tfrac1{12}mh^2\)</td><td>\(\tfrac14mR^2 + \tfrac1{12}mh^2\)</td><td>\(\tfrac12mR^2\)</td></tr>
        <tr><td>box with sides \(a, b, c\)</td><td>\(\tfrac1{12}m(b^2 + c^2)\)</td><td>\(\tfrac1{12}m(a^2 + c^2)\)</td><td>\(\tfrac1{12}m(a^2 + b^2)\)</td></tr>
      </table>
      <p>All products of inertia are zero for these. A box measured about one of its <em>corners</em> instead has
      diagonal entries \(\tfrac13m(b^2 + c^2)\) and so on, and nonzero products \(-\tfrac14mab\), \(-\tfrac14mac\),
      \(-\tfrac14mbc\).</p>

      <h2 data-sub="14.2.4">Principal Axes of Inertia</h2>
      <p>Since \(\mathbf L = \mathcal I\boldsymbol\omega\), the angular momentum is parallel to the angular velocity
      exactly when \(\boldsymbol\omega\) is an <strong>eigenvector</strong> of \(\mathcal I\) (Section 3.5). A symmetric
      matrix has three real eigenvalues and three mutually orthogonal eigenvectors. The eigenvalues are the
      <strong>principal moments of inertia</strong> and the eigenvectors are the <strong>principal axes</strong>.
      Spinning about a principal axis, \(\mathbf L = I\boldsymbol\omega\) with a plain scalar \(I\). When the tensor is
      already diagonal, as for the sphere, cylinder and centered box, the principal axes are the coordinate axes.</p>
      <p>A cube of side \(a\) measured about a corner is the book's example. Solving
      \(\det(\mathcal I - I\mathbf E_3) = 0\) gives the principal moments \(\tfrac{11}{12}ma^2\) (twice) and
      \(\tfrac16ma^2\). The axis for \(\tfrac16ma^2\) is the cube's main diagonal \(\langle1,1,1\rangle\), and any two
      perpendicular directions in the plane orthogonal to it serve as the other two axes.</p>
      <p>Off a principal axis, \(\mathbf L\) and \(\boldsymbol\omega\) point different ways and \(\mathbf L\) swings
      around \(\boldsymbol\omega\) at the rate \(\boldsymbol\omega\times\mathbf L\). Keeping the rotation axis fixed then
      requires a torque, and the complete rotational equation of motion is</p>
      <div class="formula">\[ \sum_i\boldsymbol\tau_i - \boldsymbol\omega\times\mathbf L = \mathcal I\boldsymbol\alpha \]</div>
      <p>the rotational version of \(\sum\mathbf F = m\mathbf a\). Without that torque the axis wanders, which is
      <strong>precession</strong>.</p>
      <div class="note">Spin a phone or a book in the air about each of its three axes. Rotation about the largest and
      the smallest principal moments is stable, but about the middle one it tumbles (the tennis racket theorem). A
      physics engine that integrates the equation above reproduces this.</div>

      <h2 data-sub="14.2.5">Transforming the Inertia Tensor</h2>
      <p>If an invertible matrix \(\mathbf M\) maps one coordinate system to another with the same origin, the tensor
      transforms as</p>
      <div class="formula">\[ \mathcal I' = \mathbf M\,\mathcal I\,\mathbf M^{-1} \quad\Big(= \mathbf R\,\mathcal I\,\mathbf R^{\mathsf T}\ \text{for a rotation}\Big) \]</div>
      <p>Read it right to left: convert the vector back to the old coordinates, apply \(\mathcal I\) there, and convert
      the result forward. Engines store a body's (usually diagonal) tensor once in <em>body space</em> and build the
      world-space version each frame from the orientation \(\mathbf R\). The inverse transforms the same way:
      \(\mathcal I_{\text{world}}^{-1} = \mathbf R\,\mathcal I_{\text{body}}^{-1}\mathbf R^{\mathsf T}\).</p>
      <p>Moving the origin is different. Replace every \(\mathbf r_k\) with \(\mathbf r_k + \mathbf s\) and expand.
      If the original origin is the <em>center of mass</em>, every cross term contains \(\sum m_k\mathbf r_k = \mathbf 0\)
      and drops out, leaving the <strong>parallel axis theorem</strong>:</p>
      <div class="formula">\[ \mathcal I' = \mathcal I + m\big(s^2\mathbf E_3 - \mathbf s\otimes\mathbf s\big) \]</div>
      <p>The sign of \(\mathbf s\) doesn't matter, since it appears squared. Running it backward recovers the
      centered tensor: subtracting \(m(s^2\mathbf E_3 - \mathbf s\otimes\mathbf s)\) with
      \(\mathbf s = \langle a/2, b/2, c/2\rangle\) from the corner tensor of a box gives the diagonal
      \(\tfrac1{12}m(\cdot)\) tensor in the table.</p>
      <div class="warn">The parallel axis theorem only works when starting <em>from the center of mass</em>. To move a
      tensor from one off-center point to another, go back to the center of mass first and then out again.</div>

      <div class="game">A compound collider (say a hammer: a cylinder handle plus a box head) gets its inertia by
      shifting each part's center-of-mass tensor to the combined center of mass with the parallel axis theorem and
      adding them. The engine then keeps \(\mathcal I_{\text{body}}^{-1}\), and each step computes
      \(\boldsymbol\omega = \mathbf R\,\mathcal I_{\text{body}}^{-1}\mathbf R^{\mathsf T}\mathbf L\) from the
      angular momentum, which is updated by \(\mathbf L \mathrel{+}= \boldsymbol\tau\,\Delta t\).</div>

      <p><a class="btn goto-sim" href="#/14.2/sim">Try it: center of mass, torque, and the inertia tensor →</a></p>
    `,

    keyFormulas: [
      ["Center of mass", String.raw`\mathbf C = \frac1M\sum_k m_k\mathbf r_k = \frac1M\int_V\mathbf r\,\rho(\mathbf r)\,dV`],
      ["Angular momentum and torque", String.raw`\mathbf L = \mathbf r\times\mathbf p,\qquad \boldsymbol\tau = \mathbf r\times\mathbf F = \dot{\mathbf L}`],
      ["Inertia tensor", String.raw`\mathcal I_{ij} = \int_V(\delta_{ij}r^2 - r_ir_j)\,\rho(\mathbf r)\,dV,\qquad \mathbf L = \mathcal I\boldsymbol\omega`],
      ["Rotational equation of motion", String.raw`\textstyle\sum_i\boldsymbol\tau_i - \boldsymbol\omega\times\mathbf L = \mathcal I\boldsymbol\alpha`],
      ["Rotating the tensor", String.raw`\mathcal I' = \mathbf R\,\mathcal I\,\mathbf R^{\mathsf T}`],
      ["Parallel axis theorem", String.raw`\mathcal I' = \mathcal I + m\big(s^2\mathbf E_3 - \mathbf s\otimes\mathbf s\big)`],
    ],

    exercises: [
      { q: "Masses of 1 kg at (0, 0) and 3 kg at (4, 0) are joined by a light rod. Where is the center of mass?",
        a: String.raw`\(\mathbf C = (1\cdot\langle0,0\rangle + 3\cdot\langle4,0\rangle)/4 = \langle3, 0\rangle\), three quarters of the way toward the heavier mass.` },
      { q: String.raw`A force \(\mathbf F = \langle 0, 10, 0\rangle\) N acts at \(\mathbf r = \langle 2, 0, 0\rangle\) m from the center of mass. What torque does it produce?`,
        a: String.raw`\(\boldsymbol\tau = \mathbf r\times\mathbf F = \langle 0, 0, 20\rangle\) N·m, a counterclockwise twist about the z axis.` },
      { q: "Find the inertia tensor of a 2 kg box measuring 1 × 2 × 3 m about its center.",
        a: String.raw`\(\tfrac{2}{12}\operatorname{diag}(2^2 + 3^2,\; 1^2 + 3^2,\; 1^2 + 2^2) = \operatorname{diag}(2.17, 1.67, 0.83)\) kg·m².` },
      { q: "A 5 kg solid ball of radius 0.2 m spins about an axis tangent to its surface. What is its moment of inertia about that axis?",
        a: String.raw`About the center \(I = \tfrac25mR^2 = 0.08\). The parallel axis theorem adds \(mR^2 = 0.2\), giving \(0.28 = \tfrac75mR^2\) kg·m².` },
      { q: String.raw`For a cube about its corner, why isn't \(\mathbf L\) parallel to \(\boldsymbol\omega\) when \(\boldsymbol\omega\) points along a face diagonal \(\langle1,1,0\rangle\)?`,
        a: String.raw`\(\mathcal I\langle1,1,0\rangle = ma^2\langle\tfrac{5}{12}, \tfrac{5}{12}, -\tfrac12\rangle\), which is not a multiple of \(\langle1,1,0\rangle\). The face diagonal is not an eigenvector. Only \(\langle1,1,1\rangle\) and directions perpendicular to it are principal axes.` },
    ],

    sims: [
      {
        title: "Center of mass",
        help: String.raw`<p>Drag the four point masses and change their masses with the sliders. The red marker is
          \(\mathbf C = \frac1M\sum m_k\mathbf r_k\). Heavy masses pull it toward themselves. Turn on the weighted
          offsets: the arrows \(m_k(\mathbf r_k - \mathbf C)\), placed tip to tail, always close into a loop, because
          they sum to zero.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 5, height: 450 });
          const out = sim.readout(readout);
          const r = () => view.redraw();
          const cols = ["a", "b", "c", "d"];
          const start = [[-3, -1.5], [2.5, -2], [1, 3], [-2, 2.5]];
          const hs = start.map((p, i) => view.handle(p, { color: cols[i], label: "m" + "₁₂₃₄"[i], snap: 0.25 }));
          const ms = [1, 2, 3, 1.5].map((m, i) => sim.slider(controls, { label: sim.swatch(cols[i]) + "mass m" + "₁₂₃₄"[i], min: 0.5, max: 5, step: 0.1, value: m, unit: " kg", onInput: r }));
          const showArms = sim.checkbox(controls, { label: "Lines from C to each mass", value: true, onChange: r });
          const showW = sim.checkbox(controls, { label: "Weighted offsets m(r − C), tip to tail", value: false, onChange: r });

          view.onDraw((v) => {
            v.grid({ step: 1 });
            v.axes();
            const mass = ms.map((s) => s.value);
            const Mtot = mass.reduce((a, b) => a + b, 0);
            const sum = hs.reduce((acc, h, i) => V.add(acc, V.scale(h.pos, mass[i])), [0, 0]);
            const C = V.scale(sum, 1 / Mtot);
            hs.forEach((h, i) => (h.r = 5 + 3.2 * Math.sqrt(mass[i])));
            if (showArms.value) hs.forEach((h, i) => v.line(C, h.pos, { color: cols[i], dash: [5, 5], width: 1.2, alpha: 0.6 }));
            if (showW.value) {
              let p = C;
              hs.forEach((h, i) => {
                const d = V.scale(V.sub(h.pos, C), mass[i] / Mtot * 2);
                v.arrow(p, V.add(p, d), { color: cols[i], width: 2.5 });
                p = V.add(p, d);
              });
            }
            v.circle(C, 0.3, { color: "e", width: 2 });
            v.line(V.add(C, [-0.45, 0]), V.add(C, [0.45, 0]), { color: "e", width: 2 });
            v.line(V.add(C, [0, -0.45]), V.add(C, [0, 0.45]), { color: "e", width: 2 });
            v.text(C, "C", { color: "e", offset: [10, -10], size: 14 });
            const bal = hs.reduce((acc, h, i) => V.add(acc, V.scale(V.sub(h.pos, C), mass[i])), [0, 0]);
            out.set(sim.rows([
              ["total mass M", fmt(Mtot) + " kg"],
              ["Σ m_k r_k", fmtVec(sum)],
              [sim.swatch("e") + "C = Σ m_k r_k / M", fmtVec(C)],
              ["Σ m_k (r_k − C)", fmtVec(bal, 3)],
            ]) + "<hr>The weighted offsets around C always cancel. A force through C pushes the body without turning it.");
          });
        },
      },
      {
        title: "Torque spins a rigid body",
        help: String.raw`<p>A 2D body floats in space with a thruster attached (orange point). Each frame the thrust
          \(\mathbf F\) creates a torque \(\tau = r_xF_y - r_yF_x\) about the center of mass, so the angular velocity
          changes by \(\alpha = \tau/I\) with \(I = \tfrac1{12}m(w^2 + h^2)\). Point the thrust through the center of mass
          (put the thruster on the center line and aim along it) and the body accelerates without spinning. The
          dashed line is the line of action; its distance from the center is the moment arm.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 4.5, height: 450 });
          const out = sim.readout(readout);
          const W = 3.2, H = 1.2;
          const m = sim.slider(controls, { label: "Mass m", min: 0.5, max: 5, step: 0.1, value: 2, unit: " kg" });
          const along = sim.slider(controls, { label: "Thruster position along body", min: -1.6, max: 1.6, step: 0.05, value: 1.3, unit: " m" });
          const side = sim.segmented(controls, { label: "Thruster on", options: [["top", "top edge"], ["mid", "center line"], ["bot", "bottom edge"]], value: "bot" });
          const ang = sim.slider(controls, { label: "Thrust direction (body frame)", min: -180, max: 180, step: 5, value: 90, unit: "°" });
          const F = sim.slider(controls, { label: "Thrust |F|", min: 0, max: 6, step: 0.1, value: 2, unit: " N" });
          const hold = sim.checkbox(controls, { label: "Thruster on (hold)", value: false });
          const pin = sim.checkbox(controls, { label: "Pin the center of mass (rotation only)", value: false });
          let pos = [0, 0], vel = [0, 0], phi = 0.3, omega = 0, pulse = 0.7;
          sim.buttons(controls, [
            { label: "Pulse 0.5 s", primary: true, onClick: () => (pulse = 0.5) },
            { label: "Stop spin", onClick: () => { omega = 0; vel = [0, 0]; } },
            { label: "Reset", onClick: () => { pos = [0, 0]; vel = [0, 0]; phi = 0.3; omega = 0; } },
          ]);

          const geom = () => {
            const I = (m.value * (W * W + H * H)) / 12;
            const pb = [along.value, side.value === "top" ? H / 2 : side.value === "bot" ? -H / 2 : 0];
            const fb = [F.value * Math.cos(rad(ang.value)), F.value * Math.sin(rad(ang.value))];
            const rW = V.rotate2(pb, phi), fW = V.rotate2(fb, phi);
            return { I, rW, fW, tau: V.cross2(rW, fW) };
          };

          sim.loop((dt) => {
            const firing = hold.value || pulse > 0;
            pulse = Math.max(0, pulse - dt);
            const g = geom();
            if (firing) {
              omega += (g.tau / g.I) * dt;                       // α = τ / I
              if (!pin.value) vel = V.add(vel, V.scale(g.fW, dt / m.value));   // a = F / m
            }
            if (pin.value) { vel = [0, 0]; pos = [0, 0]; }
            phi += omega * dt;
            pos = V.add(pos, V.scale(vel, dt));
            const b = view.bounds, wx = b.xmax + 2, wy = b.ymax + 2;
            if (pos[0] > wx) pos[0] = -wx; if (pos[0] < -wx) pos[0] = wx;
            if (pos[1] > wy) pos[1] = -wy; if (pos[1] < -wy) pos[1] = wy;
            view.redraw();
          });

          view.onDraw((v) => {
            const g = geom(), firing = hold.value || pulse > 0;
            v.grid({ step: 1 });
            const corners = [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]].map((c) => V.add(pos, V.rotate2(c, phi)));
            v.polygon(corners, { fill: "a", fillAlpha: 0.35, color: "a", width: 2 });
            v.line(pos, V.add(pos, V.rotate2([W / 2, 0], phi)), { color: "a", width: 1, alpha: 0.6 });
            const P = V.add(pos, g.rW);
            if (F.value > 0.01) {
              v.infiniteLine(P, g.fW, { color: "muted", dash: [5, 6], width: 1 });
              const fh = V.norm(g.fW);
              const foot = V.add(P, V.scale(fh, V.dot(V.sub(pos, P), fh)));
              v.line(pos, foot, { color: "g", width: 1.5, dash: [3, 3] });
              v.arrow(P, V.add(P, V.scale(g.fW, 0.45)), { color: "b", width: firing ? 4 : 2, alpha: firing ? 1 : 0.4, label: "F" });
            }
            v.line(pos, P, { color: "d", dash: [4, 3], width: 2 });
            v.point(P, { color: "b", r: 6 });
            v.point(pos, { color: "e", r: 5, label: "C" });
            if (Math.abs(omega) > 0.02) {
              const a0 = phi + 0.6, sweep = clamp(omega * 0.6, -2.5, 2.5);
              v.arc(pos, 0.75, Math.min(a0, a0 + sweep), Math.max(a0, a0 + sweep), { color: "c", width: 2.5 });
              const tip = V.add(pos, V.scale([Math.cos(a0 + sweep), Math.sin(a0 + sweep)], 0.75));
              v.point(tip, { color: "c", r: 4 });
            }
            const arm = F.value > 0.01 ? Math.abs(g.tau) / F.value : 0;
            out.set(sim.rows([
              [sim.swatch("d") + "r (C to thruster)", fmtVec(g.rW)],
              [sim.swatch("b") + "F (world)", fmtVec(g.fW)],
              ["τ = rₓF_y − r_yFₓ", fmt(g.tau, 3) + " N·m"],
              [sim.swatch("g") + "moment arm |τ| / |F|", fmt(arm, 3) + " m"],
              ["I = m(w² + h²)/12", fmt(g.I, 3) + " kg·m²"],
              ["α = τ / I (while firing)", fmt(g.tau / g.I, 3) + " rad/s²"],
              [sim.swatch("c") + "ω", fmt(omega, 3) + " rad/s"],
              ["L = Iω", fmt(g.I * omega, 3)],
              ["½ I ω²", fmt(0.5 * g.I * omega * omega, 3) + " J"],
            ]) + `<hr>${firing ? "<b>Firing.</b> " : ""}${Math.abs(g.tau) < 1e-6 ? "The thrust passes through C: pure translation, no spin." : g.tau > 0 ? "Positive torque spins the body counterclockwise." : "Negative torque spins the body clockwise."}`);
          });
        },
      },
      {
        title: "Inertia tensor: L = 𝓘ω and principal axes",
        help: String.raw`<p>Pick a shape and its size. The readout shows the tensor about the chosen pivot (center of
          mass, or a corner via the parallel axis theorem) and its world-space form
          \(\mathbf R\,\mathcal I\,\mathbf R^{\mathsf T}\). The colored lines are the principal axes (eigenvectors). Aim
          \(\boldsymbol\omega\) (orange) in some direction: \(\mathbf L = \mathcal I\boldsymbol\omega\) (purple) is
          generally not parallel to it. Use the buttons to snap \(\boldsymbol\omega\) onto a principal axis and watch
          \(\mathbf L\) line up. With "spin" on, the body turns about \(\boldsymbol\omega\). Off-axis, \(\mathbf L\) then
          sweeps around, and the torque \(\boldsymbol\omega\times\mathbf L\) is what holds the axis fixed.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view3d(stage, { height: 470, distance: 7, yaw: 0.7, pitch: 0.4 });
          const out = sim.readout(readout);
          const r = () => view.redraw();
          const shape = sim.select(controls, { label: "Shape", options: [["box", "Box a × b × c"], ["cyl", "Cylinder (axis z, R = a/2, h = c)"], ["sph", "Sphere (R = a/2)"]], value: "box", onChange: r });
          const gd = sim.group(controls, "Size and mass");
          const A = sim.slider(gd, { label: "a", min: 0.4, max: 3, step: 0.1, value: 2.4, onInput: r });
          const B = sim.slider(gd, { label: "b", min: 0.4, max: 3, step: 0.1, value: 1.2, onInput: r });
          const Cc = sim.slider(gd, { label: "c", min: 0.4, max: 3, step: 0.1, value: 0.8, onInput: r });
          const m = sim.slider(gd, { label: "mass m", min: 0.5, max: 5, step: 0.1, value: 1, onInput: r });
          const pivot = sim.segmented(controls, { label: "Measure about", options: [["com", "center of mass"], ["corner", "a corner"]], value: "com", onChange: r });
          const go = sim.group(controls, "Body orientation R");
          const yaw = sim.slider(go, { label: "yaw", min: -180, max: 180, step: 1, value: 20, unit: "°", onInput: r });
          const pitch = sim.slider(go, { label: "pitch", min: -90, max: 90, step: 1, value: 15, unit: "°", onInput: r });
          const gw = sim.group(controls, "Angular velocity ω (unit length)");
          let wSnap = null;
          const wh = sim.slider(gw, { label: "heading", min: -180, max: 180, step: 1, value: 60, unit: "°", onInput: () => { wSnap = null; r(); } });
          const we = sim.slider(gw, { label: "elevation", min: -90, max: 90, step: 1, value: 35, unit: "°", onInput: () => { wSnap = null; r(); } });
          const spin = sim.checkbox(controls, { label: "Spin the body about ω", value: false });
          let phase = 0;
          const snap = (k) => {
            const S = state();
            let d = S.axesW[k];
            if (d[1] < 0) d = V.neg(d);
            we.value = deg(Math.asin(clamp(d[1], -1, 1)));
            wh.value = deg(Math.atan2(-d[2], d[0]));
            wSnap = V.norm(d);
            r();
          };
          sim.buttons(controls, [
            { label: "ω → axis 1", onClick: () => snap(0) },
            { label: "ω → axis 2", onClick: () => snap(1) },
            { label: "ω → axis 3", onClick: () => snap(2) },
          ]);
          sim.loop((dt) => { if (spin.value) { phase += 0.9 * dt; view.redraw(); } });

          function state() {
            const a = A.value, b = B.value, c = Cc.value, mm = m.value, kind = shape.value;
            let Icm, s, R;
            if (kind === "box") {
              Icm = [[(mm * (b * b + c * c)) / 12, 0, 0], [0, (mm * (a * a + c * c)) / 12, 0], [0, 0, (mm * (a * a + b * b)) / 12]];
              s = [a / 2, b / 2, c / 2];
            } else if (kind === "cyl") {
              R = a / 2;
              const ix = (mm * R * R) / 4 + (mm * c * c) / 12;
              Icm = [[ix, 0, 0], [0, ix, 0], [0, 0, (mm * R * R) / 2]];
              s = [R, 0, c / 2];
            } else {
              R = a / 2;
              const i0 = 0.4 * mm * R * R;
              Icm = [[i0, 0, 0], [0, i0, 0], [0, 0, i0]];
              s = [R, 0, 0];
            }
            if (pivot.value === "com") s = [0, 0, 0];
            // parallel axis theorem: I' = I + m (s² E − s ⊗ s)
            const s2 = V.dot(s, s);
            const Ib = Icm.map((row, i) => row.map((x, j) => x + mm * ((i === j ? s2 : 0) - s[i] * s[j])));
            const eig = jacobiEigen(Ib);
            const R0 = M.mul(M.rotY(rad(yaw.value)), M.rotX(rad(pitch.value)));
            const w = wSnap || dirFrom(wh.value, we.value);
            const Rw = spin.value ? M.mul(M.rotAxis(w, phase), R0) : R0;
            const Iw = M.mul(M.mul(Rw, Ib), M.transpose(Rw));
            const L = M.mulVec(Iw, w);
            return { a, b, c, R, kind, s, Icm, Ib, eig, Rw, Iw, w, L, axesW: eig.map((e) => M.mulVec(Rw, e.vector)) };
          }

          view.onDraw((v) => {
            const S = state();
            v.grid({ size: 3, step: 1, y: -2.2 });
            v.axes({ length: 0.8 });
            const xf = (p) => M.mulVec(S.Rw, V.add(p, S.s));          // body point (relative to C) -> world, pivot at origin
            const mesh = S.kind === "box" ? L3D.shapes.box([-S.a / 2, -S.b / 2, -S.c / 2], [S.a / 2, S.b / 2, S.c / 2]) :
              S.kind === "cyl" ? cylinderMesh(S.R, S.c) : L3D.shapes.sphere(S.R, 16, 10);
            v.mesh(mesh, { fill: "a", alpha: 0.5, transform: xf, wire: S.kind === "box", wireColor: "a" });
            const colsAx = ["e", "c", "f"];
            S.axesW.forEach((d, k) => {
              v.line(V.scale(d, -2.3), V.scale(d, 2.3), { color: colsAx[k], width: 2, dash: [7, 4] });
              v.text(V.scale(d, 2.45), "I" + "₁₂₃"[k], { color: colsAx[k], size: 12 });
            });
            const Imax = Math.max(...S.eig.map((e) => e.value));
            v.arrow([0, 0, 0], V.scale(S.w, 2), { color: "b", width: 3.5, label: "ω", overlay: true });
            v.arrow([0, 0, 0], V.scale(S.L, 2 / Imax), { color: "d", width: 3.5, label: "L", overlay: true });
            v.point([0, 0, 0], { color: "fg", r: 4, overlay: true });
            const angle = deg(V.angle(S.L, S.w));
            const tq = V.cross(S.w, S.L);
            out.set(
              `<b>𝓘 about the pivot (body axes)</b>${matHTML(S.Ib)}` +
              `<b>World 𝓘 = R 𝓘 Rᵀ</b>${matHTML(S.Iw)}` +
              sim.rows([
                ...S.eig.map((e, k) => [sim.swatch(colsAx[k]) + "principal moment I" + "₁₂₃"[k], fmt(e.value, 3)]),
                [sim.swatch("b") + "ω", fmtVec(S.w)],
                [sim.swatch("d") + "L = 𝓘ω", fmtVec(S.L, 3)],
                ["angle between L and ω", `<span class="${angle < 0.5 ? "ok" : "bad"}">${fmt(angle, 1)}°</span>`],
                ["torque to hold axis ω × L", fmt(V.len(tq), 3)],
              ]) + `<hr>${angle < 0.5 ? "ω is along a principal axis, so L ∥ ω." : "ω is not an eigenvector of 𝓘, so L points elsewhere."}`
            );
          });
        },
      },
    ],

    cpp: [
      {
        title: "Center of mass of point masses",
        formula: String.raw`M = \sum_k m_k, \qquad \mathbf C = \frac1M\sum_k m_k\mathbf r_k`,
        code: String.raw`
          struct PointMass
          {
              float   mass;
              Point3D position;
          };

          Point3D CenterOfMass(const PointMass* particles, int count, float& totalMass)
          {
              Vector3D sum(0.0f, 0.0f, 0.0f);
              totalMass = 0.0f;
              for (int k = 0; k < count; k++)
              {
                  totalMass += particles[k].mass;                          // M = sum m_k
                  sum += particles[k].position * particles[k].mass;        // sum m_k r_k
              }
              return sum / totalMass;                                      // C = (1/M) sum m_k r_k
          }
        `,
      },
      {
        title: "Torque, angular momentum, and a force at a point",
        formula: String.raw`\boldsymbol\tau = \mathbf r\times\mathbf F = \dot{\mathbf L}, \qquad \mathbf L = \mathbf r\times\mathbf p`,
        code: String.raw`
          struct RigidBody
          {
              float    mass;
              Matrix3D invInertiaBody;     // inverse body-space inertia tensor (constant)
              Matrix3D orientation;        // R: body space -> world space
              Point3D  position;           // center of mass
              Vector3D linearMomentum;     // p = m v
              Vector3D angularMomentum;    // L = I w   (world space)
          };

          Vector3D Torque(const Point3D& point, const Point3D& centerOfMass, const Vector3D& force)
          {
              return Cross(point - centerOfMass, force);            // tau = r x F
          }

          // A force applied off-center for one step changes both kinds of momentum.
          void ApplyForceAtPoint(RigidBody& b, const Vector3D& force, const Point3D& point, float dt)
          {
              b.linearMomentum  += force * dt;                      // dp/dt = F
              b.angularMomentum += Torque(point, b.position, force) * dt;   // dL/dt = tau
          }
        `,
      },
      {
        title: "Inertia tensors of a box, sphere, and cylinder",
        formula: String.raw`\mathcal I_{\text{box}} = \tfrac{m}{12}\operatorname{diag}(b^2{+}c^2,\, a^2{+}c^2,\, a^2{+}b^2),\quad \mathcal I_{\text{sphere}} = \tfrac25mR^2\mathbf E_3,\quad \mathcal I_{\text{cyl}} = \operatorname{diag}\big(\tfrac14mR^2{+}\tfrac1{12}mh^2,\, \cdot,\, \tfrac12mR^2\big)`,
        note: "<p>All three are about the center of mass with the shape aligned to the axes, so the products of inertia are zero.</p>",
        code: String.raw`
          Matrix3D InertiaTensorBox(float m, float a, float b, float c)      // side lengths a, b, c
          {
              float k = m / 12.0f;
              return Matrix3D(k * (b * b + c * c), 0.0f, 0.0f,
                              0.0f, k * (a * a + c * c), 0.0f,
                              0.0f, 0.0f, k * (a * a + b * b));
          }

          Matrix3D InertiaTensorSphere(float m, float R)
          {
              float i = 0.4f * m * R * R;                                    // 2/5 m R^2
              return Matrix3D(i, 0.0f, 0.0f,  0.0f, i, 0.0f,  0.0f, 0.0f, i);
          }

          Matrix3D InertiaTensorCylinder(float m, float R, float h)        // axis along z
          {
              float ixy = m * (0.25f * R * R + h * h / 12.0f);              // 1/4 m R^2 + 1/12 m h^2
              float iz  = 0.5f * m * R * R;                                  // 1/2 m R^2
              return Matrix3D(ixy, 0.0f, 0.0f,  0.0f, ixy, 0.0f,  0.0f, 0.0f, iz);
          }
        `,
      },
      {
        title: "Parallel axis theorem",
        formula: String.raw`\mathcal I' = \mathcal I + m\big(s^2\mathbf E_3 - \mathbf s\otimes\mathbf s\big)`,
        note: "<p><code>Icm</code> must be about the center of mass. Use it to combine the parts of a compound body: shift each part to the shared center of mass and add the matrices.</p>",
        code: String.raw`
          Matrix3D ParallelAxis(const Matrix3D& Icm, float m, const Vector3D& s)
          {
              float s2 = Dot(s, s);
              const float sv[3] = {s.x, s.y, s.z};
              Matrix3D result = Icm;
              for (int i = 0; i < 3; i++)
              {
                  for (int j = 0; j < 3; j++)
                  {
                      float delta = (i == j) ? s2 : 0.0f;                   // s^2 E3
                      result(i, j) += m * (delta - sv[i] * sv[j]);          // minus the tensor product s (x) s
                  }
              }
              return result;
          }
        `,
      },
      {
        title: "World-space inertia and the angular update",
        formula: String.raw`\mathcal I_{\text{world}}^{-1} = \mathbf R\,\mathcal I_{\text{body}}^{-1}\mathbf R^{\mathsf T}, \qquad \mathbf L \mathrel{+}= \boldsymbol\tau\,\Delta t, \qquad \boldsymbol\omega = \mathcal I_{\text{world}}^{-1}\mathbf L`,
        note: "<p>Integrating angular momentum (rather than angular velocity) handles the ω × L term automatically. Re-orthonormalize the orientation now and then (Gram–Schmidt, Section 2.4) or store it as a quaternion.</p>",
        code: String.raw`
          Matrix3D MakeRotation(float angle, const Vector3D& axis);    // rotation about a unit axis (Section 4.3.1)

          void IntegrateRotation(RigidBody& b, const Vector3D& torque, float dt)
          {
              b.angularMomentum += torque * dt;                                    // dL/dt = tau

              // I_world^-1 = R I_body^-1 R^T   (Equation 14.95 with M = R and M^-1 = R^T)
              Matrix3D invInertiaWorld = b.orientation * b.invInertiaBody * Transpose(b.orientation);
              Vector3D omega = invInertiaWorld * b.angularMomentum;                // w = I^-1 L

              float speed = Magnitude(omega);
              if (speed > 1.0e-6f)
              {
                  b.orientation = MakeRotation(speed * dt, omega / speed) * b.orientation;
              }
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 14.3 Oscillatory Motion
  // ===========================================================================
  L3D.topic({
    id: "14.3",
    summary: "Masses on springs and swinging pendulums: angular frequency, period, amplitude and phase, damping, and the small-angle approximation.",

    lesson: String.raw`
      <p>Motion is <strong>oscillatory</strong> when it repeats, swinging back and forth through the same region.
      It usually comes from a <em>restoring force</em> that pulls an object back toward an equilibrium position. This
      section belongs to the rotation chapter because oscillations share its vocabulary: they have an angular
      frequency, and a pendulum literally rotates about a pivot.</p>

      <h2 data-sub="14.3.1">Spring Motion</h2>
      <p>Hang a mass \(m\) on a spring aligned with the z axis and put the origin at the spring's natural resting
      point. Stretch or compress it by \(z\) and the spring pulls back with a force proportional to the
      displacement, <strong>Hooke's law</strong>:
      \[ F = -kz. \]
      The <em>spring constant</em> \(k\) measures stiffness. Newton's second law gives \(m\ddot z = -kz\), which is
      the equation of Section 13.2 with \(a = 0\) and \(b = k/m\). Its roots are purely imaginary, so</p>
      <div class="formula">
        \[ z(t) = A\sin\omega t + B\cos\omega t, \qquad \omega = \sqrt{\frac km} \]
      </div>
      <p>\(\omega\) is the <strong>angular frequency</strong> in radians per second. The ordinary frequency (cycles per
      second, hertz) and the period (seconds per cycle) are
      \[ f = \frac{\omega}{2\pi}, \qquad P = \frac1f = 2\pi\sqrt{\frac mk}. \]
      A stiffer spring oscillates faster and a heavier mass slower. The amplitude does <em>not</em> affect the
      period.</p>
      <p>Initial conditions \(z(0) = z_0\) and \(\dot z(0) = v_0\) give \(B = z_0\) and \(A = v_0/\omega\). As in
      Section 13.2 the two terms merge into one sine:
      \[ z(t) = C\sin(\omega t + \delta), \qquad C = \sqrt{\frac{v_0^2}{\omega^2} + z_0^2}. \]
      The <strong>amplitude</strong> \(C\) is the largest displacement ever reached, and the <strong>phase</strong>
      \(\delta\) satisfies \(\sin\delta = z_0/C\) and \(\cos\delta = v_0/(\omega C)\). For example, a 2 kg mass on a
      spring with \(k = 3\) N/m has \(\omega = \sqrt{1.5} \approx 1.22\) rad/s and \(f \approx 0.195\) Hz. Released from
      \(z_0 = -4\) m with \(v_0 = -1\) m/s, it swings with amplitude \(\sqrt{1/1.5 + 16} \approx 4.08\) m.</p>
      <div class="warn">\(\delta = \sin^{-1}(z_0/C)\) only returns angles in \([-90^\circ, 90^\circ]\), so it loses
      the sign of \(v_0\). In code use <code>atan2(z0, v0 / omega)</code>, which finds the right quadrant.</div>
      <p><b>Adding gravity.</b> With the constant force \(-mg\), the equation becomes \(m\ddot z = -kz - mg\). The
      forces balance at \(z = -mg/k\), the new equilibrium, and that constant is a particular solution. So
      \[ z(t) = C\sin(\omega t + \delta) - \frac{mg}{k}, \]
      the same oscillation at the same frequency, now centered on the sagged position. The amplitude and phase come
      from the formulas above with \(z_0\) replaced by \(z_0 + mg/k\).</p>
      <p><b>Adding damping.</b> Real springs lose energy. A damping force \(-c\dot z\) gives
      \(\ddot z + \tfrac cm\dot z + \tfrac km z = 0\), so \(a = c/m\) and \(b = k/m\) in Section 13.2. The
      <strong>damping ratio</strong> \(\zeta = c/(2\sqrt{km})\) picks the case:</p>
      <table>
        <tr><th>\(\zeta\)</th><th>roots</th><th>motion</th></tr>
        <tr><td>\(\zeta \lt 1\) (underdamped)</td><td>complex</td><td>oscillates inside a shrinking envelope \(e^{-\zeta\omega t}\), at \(\omega\sqrt{1 - \zeta^2}\)</td></tr>
        <tr><td>\(\zeta = 1\) (critically damped)</td><td>repeated</td><td>returns fastest without overshooting</td></tr>
        <tr><td>\(\zeta \gt 1\) (overdamped)</td><td>two real</td><td>creeps back slowly, no overshoot</td></tr>
      </table>
      <div class="game">Springs are everywhere in games: camera follow, car suspension, ragdoll joints, UI that
      bounces into place. Designers think in terms of frequency (how fast) and damping ratio (how bouncy). Convert
      with \(k = m\omega^2\) and \(c = 2\zeta m\omega\). A stiff spring stepped with explicit Euler gains energy and
      explodes when \(\omega\,\Delta t\) gets large. Semi-implicit Euler, sub-stepping, or the exact solution keep it
      stable.</div>

      <h2 data-sub="14.3.2">Pendulum Motion</h2>
      <p>A mass \(m\) hangs from a pivot at the origin on a massless rod of length \(L\) and swings in the x–z plane.
      Gravity exerts the torque \(\boldsymbol\tau = \mathbf r\times m\mathbf g\) about the pivot, and torque divided by
      the moment of inertia \(I\) about the pivot is the angular acceleration (Section 14.2). With \(\theta\) the angle
      from straight down, only the component \(mg\sin\theta\) perpendicular to the rod has a lever arm \(L\):</p>
      <div class="formula">\[ \ddot\theta(t) = -\frac{mgL}{I}\sin\theta(t) \]</div>
      <p>For a point mass \(I = mL^2\), so \(\ddot\theta = -(g/L)\sin\theta\). The sine makes this equation
      nonlinear, and it has no solution in elementary functions. For <strong>small angles</strong>, replace
      \(\sin\theta\) by the first term of its power series, \(\theta\) (Appendix D). The equation becomes the spring
      equation, with solution
      \[ \theta(t) = A\sin(\omega t + \delta), \qquad \omega = \sqrt{\frac{mgL}{I}}, \qquad P = 2\pi\sqrt{\frac{I}{mgL}}, \]
      which for a point mass is</p>
      <div class="formula">\[ \omega = \sqrt{\frac gL}, \qquad P = 2\pi\sqrt{\frac Lg}. \]</div>
      <p>A 1 m pendulum on Earth has a period of about 2.0 s. Again the mass cancels and, in this approximation, the
      amplitude doesn't matter.</p>
      <p>The approximation is very good below about 20°, where \(\sin\theta\) and \(\theta\) differ by less than 2%. At
      larger amplitudes the true pendulum is <em>slower</em>, because the restoring torque \(\sin\theta\) is weaker than
      \(\theta\). The exact period is
      \(P = 2\pi\sqrt{L/g}\,/\,\operatorname{AGM}\!\big(1, \cos\tfrac{\theta_0}{2}\big)\), where AGM is the
      arithmetic–geometric mean, or approximately \(2\pi\sqrt{L/g}\,\big(1 + \theta_0^2/16\big)\). A 90° swing takes
      about 18% longer than a tiny one. Near 180° the pendulum balances upside down and the period becomes very
      long.</p>
      <div class="note">A <em>phase-space</em> plot of \(\theta\) against \(\dot\theta\) shows the whole story. The
      small-angle pendulum traces ellipses. The real one traces egg-shaped curves of constant energy
      \(\tfrac12\dot\theta^2 - \tfrac gL\cos\theta\). Above the energy of the upside-down position, the curves stop
      closing: the pendulum swings all the way over the top.</div>
      <div class="game">For swinging lamps, wrecking balls or grappling hooks, integrate the full equation with a small
      fixed step (semi-implicit Euler or RK4, Chapter 16) rather than using the small-angle formula, or constrain a
      particle to a fixed distance from the pivot (Verlet-style) and let gravity do the rest.</div>

      <p><a class="btn goto-sim" href="#/14.3/sim">Try it: springs with damping, and the true pendulum →</a></p>
    `,

    keyFormulas: [
      ["Hooke's law", String.raw`F = -kz, \qquad m\ddot z = -kz`],
      ["Spring solution", String.raw`z(t) = C\sin(\omega t + \delta),\quad \omega = \sqrt{k/m},\quad C = \sqrt{v_0^2/\omega^2 + z_0^2}`],
      ["Frequency and period", String.raw`f = \frac{\omega}{2\pi}, \qquad P = 2\pi\sqrt{\frac mk}`],
      ["Hanging spring equilibrium", String.raw`z_{\text{eq}} = -\frac{mg}{k}`],
      ["Pendulum equation", String.raw`\ddot\theta = -\frac{mgL}{I}\sin\theta`],
      ["Small-angle pendulum", String.raw`\omega = \sqrt{\frac{mgL}{I}} = \sqrt{\frac gL},\qquad P = 2\pi\sqrt{\frac Lg}`],
    ],

    exercises: [
      { q: "A 2 kg mass on a spring with k = 3 N/m is released at z₀ = −4 m moving at v₀ = −1 m/s. Find ω, f, and the amplitude.",
        a: String.raw`\(\omega = \sqrt{3/2} \approx 1.22\) rad/s, \(f = \omega/2\pi \approx 0.195\) Hz, and \(C = \sqrt{(-1)^2/1.5 + 16} = \sqrt{56/3} \approx 4.08\) m.` },
      { q: "A 0.5 kg mass hangs at rest from a spring with k = 20 N/m. How far does the spring sag, and how does gravity change the oscillation frequency?",
        a: String.raw`It sags \(mg/k = 4.9/20 \approx 0.245\) m. The frequency is unchanged, \(\omega = \sqrt{k/m} = \sqrt{40} \approx 6.32\) rad/s. Gravity only moves the center of the oscillation.` },
      { q: "What damping coefficient makes a 2 kg mass on an 8 N/m spring critically damped?",
        a: String.raw`\(\zeta = 1\) means \(c = 2\sqrt{km} = 2\sqrt{16} = 8\) N·s/m.` },
      { q: "What is the small-angle period of a 1 m pendulum on Earth (g = 9.8) and on the Moon (g = 1.62)?",
        a: String.raw`\(2\pi\sqrt{1/9.8} \approx 2.01\) s on Earth and \(2\pi\sqrt{1/1.62} \approx 4.94\) s on the Moon.` },
      { q: "How much longer than the small-angle prediction is the period of a pendulum released from 90°?",
        a: String.raw`\(1/\operatorname{AGM}(1, \cos45^\circ) \approx 1/0.8472 \approx 1.180\), so about 18% longer. The series \(1 + \theta_0^2/16\) gives 1.154, already too low at this amplitude.` },
    ],

    sims: [
      {
        title: "Mass on a spring (with damping)",
        help: String.raw`<p>The mass on the left moves with the exact solution, and the graph on the right traces
          \(z(t)\) on the same vertical scale. Change \(m\), \(k\) and the damping \(c\) and watch the period
          \(2\pi\sqrt{m/k}\) and the damping ratio \(\zeta = c/2\sqrt{km}\). The buttons jump to the undamped and
          critically damped cases. Turn on gravity and the oscillation simply recenters at \(-mg/k\). "Compare
          regimes" overlays an underdamped, a critical and an overdamped curve.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { height: 440, xRange: [-3.4, 10], yRange: [-3, 3] });
          const out = sim.readout(readout);
          let t = 0;
          const restart = () => { t = 0; view.redraw(); };
          const m = sim.slider(controls, { label: "Mass m", min: 0.5, max: 5, step: 0.1, value: 1, unit: " kg", onInput: restart });
          const k = sim.slider(controls, { label: "Spring constant k", min: 1, max: 20, step: 0.5, value: 6, unit: " N/m", onInput: restart });
          const c = sim.slider(controls, { label: "Damping c", min: 0, max: 12, step: 0.05, value: 0.4, unit: " N·s/m", onInput: restart });
          const z0 = sim.slider(controls, { label: "Initial displacement z₀", min: -2, max: 2, step: 0.1, value: 1.5, unit: " m", onInput: restart });
          const v0 = sim.slider(controls, { label: "Initial velocity v₀", min: -5, max: 5, step: 0.1, value: 0, unit: " m/s", onInput: restart });
          const grav = sim.checkbox(controls, { label: "Gravity (g = 9.8)", value: false, onChange: restart });
          const cmp = sim.checkbox(controls, { label: "Compare regimes (ζ = 0.2, 1, 2.5)", value: false, onChange: restart });
          sim.buttons(controls, [
            { label: "Undamped", onClick: () => { c.value = 0; restart(); } },
            { label: "Critical", onClick: () => { c.value = Math.min(12, 2 * Math.sqrt(k.value * m.value)); restart(); } },
            { label: "Restart", onClick: restart },
          ]);
          sim.loop((dt) => { t += dt; if (t > 10) t = 0; view.redraw(); });

          view.onDraw((v) => {
            const mm = m.value, kk = k.value, cc = c.value;
            const zeq = grav.value ? (-mm * 9.8) / kk : 0;
            const sol = solveHomogeneous(cc / mm, kk / mm, z0.value - zeq, v0.value);
            const z = (tt) => zeq + sol.x(tt);
            let lo = Math.min(zeq, z0.value), hi = Math.max(zeq, z0.value);
            for (let tt = 0; tt <= 10; tt += 0.05) { lo = Math.min(lo, z(tt)); hi = Math.max(hi, z(tt)); }
            const pad = Math.max(0.4, 0.15 * (hi - lo));
            v.opts.yRange = [lo - pad, hi + pad + 1.2];
            const top = hi + pad + 0.9;
            v.grid();
            v.axes({ ticks: true, labels: ["t (s)", "z (m)"] });
            const B = v.bounds;
            v.rect([B.xmin, B.ymin], [-0.15, B.ymax], { fill: "bg", fillAlpha: 1, stroke: false });
            v.line([-0.15, B.ymin], [-0.15, B.ymax], { color: "axis", width: 1 });
            v.line([B.xmin, zeq], [B.xmax, zeq], { color: "g", dash: [6, 5], width: 1.2 });
            v.text([10, zeq], grav.value ? "equilibrium −mg/k" : "equilibrium", { color: "g", size: 11, align: "right", offset: [-4, -5] });
            const w0 = Math.sqrt(kk / mm), zeta = cc / (2 * Math.sqrt(kk * mm));
            if (cmp.value) {
              [[0.2, "a"], [1, "c"], [2.5, "e"]].forEach(([zt, col]) => {
                const s2 = solveHomogeneous(2 * zt * w0, w0 * w0, z0.value - zeq, v0.value);
                v.plot((tt) => zeq + s2.x(tt), { color: col, width: 1.3, alpha: 0.55, from: 0, to: 10 });
              });
            }
            if (sol.kind === "complex" && cc > 0) {
              v.plot((tt) => zeq + sol.amp * Math.exp(sol.alpha * tt), { color: "muted", dash: [3, 4], width: 1, from: 0, to: 10 });
              v.plot((tt) => zeq - sol.amp * Math.exp(sol.alpha * tt), { color: "muted", dash: [3, 4], width: 1, from: 0, to: 10 });
            }
            v.plot(z, { color: "b", width: 1.2, alpha: 0.35, from: 0, to: 10 });
            v.plot(z, { color: "b", width: 3, from: 0, to: Math.max(t, 0.001) });
            // spring and mass on the left (x in [-3.2, -0.4])
            const zm = z(t), X = -1.8, hw = 0.55, hh = (hw * v.sx) / v.sy;
            v.line([-3.2, top], [-0.4, top], { color: "fg", width: 3 });
            const coils = 12, y0 = top, y1 = zm + hh, pts = [[X, y0], [X, y0 - (y0 - y1) * 0.08]];
            for (let i = 1; i <= coils; i++) pts.push([X + (i % 2 ? 0.35 : -0.35), y0 - (y0 - y1) * (0.08 + (0.84 * (i - 0.5)) / coils)]);
            pts.push([X, y1 + (y0 - y1) * 0.08], [X, y1]);
            v.polyline(pts, { color: "muted", width: 2 });
            v.rect([X - hw, zm - hh], [X + hw, zm + hh], { fill: "b", fillAlpha: 0.85, color: "b" });
            v.line([X + hw, zm], [t, zm], { color: "b", dash: [3, 4], width: 1, alpha: 0.7 });
            v.point([t, zm], { color: "b", r: 5 });
            const regime = cc === 0 ? "undamped" : Math.abs(zeta - 1) < 1e-3 ? "critically damped" : zeta < 1 ? "underdamped" : "overdamped";
            const y0r = z0.value - zeq;
            const C = Math.hypot(y0r, v0.value / w0), delta = Math.atan2(y0r, v0.value / w0);
            out.set(sim.rows([
              ["ω₀ = √(k/m)", fmt(w0, 3) + " rad/s"],
              ["f = ω₀ / 2π", fmt(w0 / (2 * Math.PI), 3) + " Hz"],
              ["period P = 2π√(m/k)", fmt((2 * Math.PI) / w0, 3) + " s"],
              ["damping ratio ζ", fmt(zeta, 3)],
              ["regime", regime],
              ["damped frequency ω₀√(1 − ζ²)", zeta < 1 ? fmt(w0 * Math.sqrt(1 - zeta * zeta), 3) + " rad/s" : "–"],
              ["amplitude C (undamped)", fmt(C, 3) + " m"],
              ["phase δ = atan2(z₀, v₀/ω)", fmt(deg(delta), 1) + "°"],
              ["critical c = 2√(km)", fmt(2 * Math.sqrt(kk * mm), 2)],
              ["z(t)", fmt(zm, 3) + " m"],
            ]));
          });
        },
      },
      {
        title: "Pendulum: small-angle vs. exact",
        help: String.raw`<p>The solid pendulum integrates \(\ddot\theta = -(g/L)\sin\theta\) with RK4. The faded one uses the
          small-angle solution \(\theta_0\cos\omega t\). At 10° they stay together; at 90° the real pendulum falls behind;
          near 180° it hangs almost motionless at the top for a long time. The lower panel is phase space
          (\(\theta\) across, \(\dot\theta\) up) with curves of constant energy. The dashed curve through
          \(\pm180^\circ\) is the separatrix between swinging and going over the top. Give it a push to cross it.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const scene = sim.view2d(stage, { height: 260, range: 1.3 });
          const phase = sim.view2d(stage, { height: 230, xRange: [-3.6, 3.6], yRange: [-7, 7] });
          const out = sim.readout(readout);
          let th, om, t, trailE, trailS, lastSign, turns;
          const restart = () => {
            th = rad(th0.value); om = w0.value; t = 0; trailE = []; trailS = []; lastSign = 0; turns = [];
          };
          const th0 = sim.slider(controls, { label: "Release angle θ₀", min: 1, max: 179, step: 1, value: 60, unit: "°", onInput: restart });
          const w0 = sim.slider(controls, { label: "Initial push θ̇₀", min: -8, max: 8, step: 0.1, value: 0, unit: " rad/s", onInput: restart });
          const L = sim.slider(controls, { label: "Length L", min: 0.5, max: 3, step: 0.1, value: 1, unit: " m", onInput: restart });
          const g = sim.slider(controls, { label: "Gravity g", min: 1.6, max: 20, step: 0.1, value: 9.8, unit: " m/s²", onInput: restart });
          const damp = sim.slider(controls, { label: "Damping b (θ̈ += −b θ̇)", min: 0, max: 1, step: 0.01, value: 0, onInput: restart });
          const ghost = sim.checkbox(controls, { label: "Show small-angle pendulum", value: true });
          sim.buttons(controls, [{ label: "Restart", onClick: restart }]);
          sim.legend(controls, [["a", "exact (RK4)"], ["b", "small-angle"]]);
          restart();

          const acc = (x, w) => -(g.value / L.value) * Math.sin(x) - damp.value * w;
          sim.loop((dt) => {
            const h = 1 / 480, n = Math.max(1, Math.round(dt / h));
            for (let i = 0; i < n; i++) {
              const k1x = om, k1v = acc(th, om);
              const k2x = om + 0.5 * h * k1v, k2v = acc(th + 0.5 * h * k1x, om + 0.5 * h * k1v);
              const k3x = om + 0.5 * h * k2v, k3v = acc(th + 0.5 * h * k2x, om + 0.5 * h * k2v);
              const k4x = om + h * k3v, k4v = acc(th + h * k3x, om + h * k3v);
              th += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
              om += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
              t += h;
              const sgn = Math.sign(om);
              if (lastSign > 0 && sgn < 0) turns.push(t);       // turning point at the right extreme
              if (sgn !== 0) lastSign = sgn;
            }
            const wrapped = Math.atan2(Math.sin(th), Math.cos(th));
            trailE.push([wrapped, om]);
            if (trailE.length > 900) trailE.shift();
            const S = smallAngle(t);
            trailS.push(S);
            if (trailS.length > 900) trailS.shift();
            scene.redraw();
            phase.redraw();
          });

          function smallAngle(tt) {
            const q = g.value / L.value;
            const sol = solveHomogeneous(damp.value, q, rad(th0.value), w0.value);
            const hh = 1e-4;
            return [sol.x(tt), (sol.x(tt + hh) - sol.x(tt - hh)) / (2 * hh)];
          }

          scene.onDraw((v) => {
            const LL = L.value;
            fitView(v, -1.25 * LL, 1.25 * LL, -1.3 * LL, 1.3 * LL);
            v.grid({ step: 0.5 });
            v.circle([0, 0], LL, { color: "grid", width: 1 });
            v.line([0, 0], [0, -LL * 1.15], { color: "muted", dash: [4, 4], width: 1 });
            const a0 = rad(th0.value);
            v.arc([0, 0], LL * 0.3, -Math.PI / 2, -Math.PI / 2 + a0, { color: "g", width: 1.5 });
            if (ghost.value) {
              const s = smallAngle(t)[0];
              const pg = [LL * Math.sin(s), -LL * Math.cos(s)];
              v.line([0, 0], pg, { color: "b", width: 2, alpha: 0.45 });
              v.circle(pg, 0.09 * LL, { fill: "b", fillAlpha: 0.45, stroke: false });
            }
            const p = [LL * Math.sin(th), -LL * Math.cos(th)];
            v.line([0, 0], p, { color: "fg", width: 2.5 });
            v.circle(p, 0.1 * LL, { fill: "a", fillAlpha: 1, color: "a" });
            v.point([0, 0], { color: "fg", r: 4 });
          });

          phase.onDraw((v) => {
            const q = g.value / L.value, wmax = 2.3 * Math.sqrt(q) + Math.abs(w0.value);
            v.opts.yRange = [-wmax, wmax];
            v.grid({ stepX: Math.PI / 2 });
            v.axes({ labels: ["θ", "θ̇"] });
            [-Math.PI, Math.PI].forEach((x) => v.line([x, -wmax], [x, wmax], { color: "muted", width: 1, dash: [2, 4] }));
            v.text([Math.PI, -wmax], "180°", { color: "muted", size: 10, align: "center", offset: [0, -4] });
            v.text([-Math.PI, -wmax], "−180°", { color: "muted", size: 10, align: "center", offset: [0, -4] });
            const contour = (E, style) => {
              v.plot((x) => Math.sqrt(2 * (E + q * Math.cos(x))), style);
              v.plot((x) => -Math.sqrt(2 * (E + q * Math.cos(x))), style);
            };
            [0.15, 0.45, 0.75, 1.05, 1.4, 1.75].forEach((f) => contour(-q + 2 * q * f, { color: "grid2", width: 1, from: -Math.PI, to: Math.PI, samples: 240 }));
            contour(q, { color: "e", width: 1.2, dash: [5, 4], from: -Math.PI, to: Math.PI, samples: 240 });
            const seg = (trail, col) => {
              for (let i = 1; i < trail.length; i++) {
                if (Math.abs(trail[i][0] - trail[i - 1][0]) > Math.PI) continue;
                v.line(trail[i - 1], trail[i], { color: col, width: 2, alpha: 0.8 });
              }
            };
            if (ghost.value) seg(trailS.map(([x, w]) => [clamp(x, -3.6, 3.6), w]), "b");
            seg(trailE, "a");
            const wrapped = Math.atan2(Math.sin(th), Math.cos(th));
            v.point([wrapped, om], { color: "a", r: 5 });
            if (ghost.value && trailS.length) v.point(trailS[trailS.length - 1], { color: "b", r: 4 });

            const T0 = 2 * Math.PI * Math.sqrt(L.value / g.value);
            const a0 = rad(th0.value);
            const exact = w0.value === 0 && damp.value === 0 ? T0 / agm(1, Math.cos(a0 / 2)) : NaN;
            const series = T0 * (1 + (a0 * a0) / 16 + (11 * a0 ** 4) / 3072);
            const measured = turns.length >= 2 ? turns[turns.length - 1] - turns[turns.length - 2] : NaN;
            out.set(sim.rows([
              ["small-angle period 2π√(L/g)", fmt(T0, 3) + " s"],
              ["exact period (AGM formula)", Number.isFinite(exact) ? fmt(exact, 3) + " s" : "(needs θ̇₀ = 0, b = 0)"],
              ["series T₀(1 + θ₀²/16 + …)", fmt(series, 3) + " s"],
              ["measured (RK4)", Number.isFinite(measured) ? fmt(measured, 3) + " s" : "measuring…"],
              ["exact / small-angle", Number.isFinite(exact) ? fmt(exact / T0, 4) : "–"],
              ["sin θ₀ vs θ₀ (rad)", fmt(Math.sin(a0), 3) + " vs " + fmt(a0, 3)],
              ["θ, θ̇ now", fmt(deg(wrapped), 1) + "°, " + fmt(om, 2)],
            ]));
          });
        },
      },
    ],

    cpp: [
      {
        title: "Spring position from initial conditions",
        formula: String.raw`z(t) = \frac{v_0}{\omega}\sin\omega t + z_0\cos\omega t = C\sin(\omega t + \delta),\quad \omega = \sqrt{k/m}`,
        code: String.raw`
          struct Oscillation
          {
              float omega;        // angular frequency, rad/s
              float amplitude;    // C
              float phase;        // delta
          };

          Oscillation SpringOscillation(float m, float k, float z0, float v0)
          {
              Oscillation o;
              o.omega = std::sqrt(k / m);
              float A = v0 / o.omega, B = z0;                  // z = A sin(wt) + B cos(wt)
              o.amplitude = std::sqrt(A * A + B * B);          // C = sqrt(v0^2 / w^2 + z0^2)
              o.phase = std::atan2(B, A);                      // sin(delta) = B/C, cos(delta) = A/C
              return o;
          }

          float SpringPosition(const Oscillation& o, float t)
          {
              return o.amplitude * std::sin(o.omega * t + o.phase);
          }
        `,
      },
      {
        title: "Damped spring force and a stable step",
        formula: String.raw`F = -k(x - x_{\text{rest}}) - c\,v, \qquad v \leftarrow v + \tfrac Fm\Delta t,\quad x \leftarrow x + v\,\Delta t`,
        note: "<p>Semi-implicit Euler (velocity first, then position with the new velocity) keeps an undamped spring's energy bounded. Explicit Euler would slowly pump energy in.</p>",
        code: String.raw`
          struct SpringState
          {
              float x, v;
          };

          void StepDampedSpring(SpringState& s, float m, float k, float c, float rest, float dt)
          {
              float force = -k * (s.x - rest) - c * s.v;      // Hooke's law plus damping
              s.v += (force / m) * dt;                         // velocity first...
              s.x += s.v * dt;                                 // ...then position with the new velocity
          }
        `,
      },
      {
        title: "Frequency, period, and damping ratio",
        formula: String.raw`f = \frac{\omega}{2\pi},\quad P = 2\pi\sqrt{\frac mk},\quad \zeta = \frac{c}{2\sqrt{km}};\qquad k = m\omega^2,\;\; c = 2\zeta m\omega`,
        code: String.raw`
          float SpringPeriod(float m, float k)        { return 2.0f * kPi * std::sqrt(m / k); }
          float DampingRatio(float m, float k, float c) { return c / (2.0f * std::sqrt(k * m)); }

          // Designer-friendly: pick a frequency (Hz) and a damping ratio, get k and c.
          void SpringFromFrequency(float m, float frequencyHz, float zeta, float& k, float& c)
          {
              float omega = 2.0f * kPi * frequencyHz;
              k = m * omega * omega;
              c = 2.0f * zeta * m * omega;            // zeta = 1 gives critical damping
          }
        `,
      },
      {
        title: "Pendulum step (full nonlinear equation)",
        formula: String.raw`\ddot\theta = -\frac{mgL}{I}\sin\theta \;\;\xrightarrow{\;I = mL^2\;}\;\; \ddot\theta = -\frac gL\sin\theta`,
        code: String.raw`
          struct Pendulum
          {
              float theta;       // angle from straight down, radians
              float omega;       // angular velocity
              float length;
          };

          void StepPendulum(Pendulum& p, float g, float dt)
          {
              float alpha = -(g / p.length) * std::sin(p.theta);   // keep the sine: no small-angle shortcut
              p.omega += alpha * dt;                                 // semi-implicit Euler
              p.theta += p.omega * dt;
          }

          Point3D PendulumBob(const Point3D& pivot, const Pendulum& p)   // swings in the x-z plane, z up
          {
              return pivot + Vector3D(p.length * std::sin(p.theta), 0.0f, -p.length * std::cos(p.theta));
          }
        `,
      },
      {
        title: "Small-angle period and the exact period",
        formula: String.raw`P_0 = 2\pi\sqrt{\frac Lg}, \qquad P = \frac{P_0}{\operatorname{AGM}\!\left(1, \cos\frac{\theta_0}{2}\right)}`,
        note: "<p>The arithmetic–geometric mean converges in a handful of iterations, so the exact large-amplitude period costs almost nothing.</p>",
        code: String.raw`
          float SmallAnglePeriod(float L, float g)
          {
              return 2.0f * kPi * std::sqrt(L / g);
          }

          float ExactPendulumPeriod(float L, float g, float theta0)
          {
              float a = 1.0f, b = std::cos(0.5f * theta0);
              for (int i = 0; i < 8; i++)                       // AGM: replace (a, b) with their means
              {
                  float an = 0.5f * (a + b);
                  b = std::sqrt(a * b);
                  a = an;
              }
              return SmallAnglePeriod(L, g) / a;
          }
        `,
      },
    ],
  });
})();
