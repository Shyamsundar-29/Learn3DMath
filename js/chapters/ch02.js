// Chapter 2 - Vectors
(function () {
  "use strict";
  const { V, M, fmt, fmtVec, rad, deg, clamp } = L3D.math;

  // ===========================================================================
  // 2.1 Vector Properties
  // ===========================================================================
  L3D.topic({
    id: "2.1",
    summary: "What a vector is, how to add and scale vectors, and how to measure length and normalize to unit length.",

    lesson: String.raw`
      <p>An <strong>n-dimensional vector</strong> is an ordered list of \(n\) numbers called its <em>components</em>.
      In 3D we write
      \[ \mathbf V = \langle V_1, V_2, V_3 \rangle = \langle V_x, V_y, V_z \rangle \]
      and when matrices enter the picture we treat it as a single <em>column</em>. The column form matters later
      because matrices multiply vectors from the left, \(\mathbf M\mathbf V\).</p>

      <p>In a game a vector can mean a <strong>point</strong> (the location of an enemy, the vertex of a triangle) or a
      <strong>direction</strong> (velocity, a surface normal, where the camera looks). In this chapter we don't
      separate the two. Chapter 4 shows why the difference matters once translation is involved.</p>

      <h2>Scaling and adding</h2>
      <p>Multiplying by a scalar \(a\) multiplies every component:
      \( a\mathbf V = \langle aV_1, aV_2, \dots, aV_n \rangle \). Geometrically this stretches the arrow by \(|a|\),
      and a negative \(a\) also flips its direction.</p>
      <p>Adding two vectors adds components:
      \( \mathbf P + \mathbf Q = \langle P_1 + Q_1, \dots, P_n + Q_n \rangle \). Picture it <em>tip to tail</em>:
      put the tail of \(\mathbf Q\) on the tip of \(\mathbf P\), and the sum runs from the start to the end.
      Subtraction is adding the negative: \(\mathbf P - \mathbf Q\) is the arrow that goes <em>from the tip of
      \(\mathbf Q\) to the tip of \(\mathbf P\)</em>.</p>

      <div class="game">Every frame a moving object does <code>position += velocity * dt</code>. That's a scalar
      multiplication followed by a vector addition. And <code>target - position</code> gives the direction
      from an object to its target.</div>

      <p>These operations follow the ordinary rules of algebra (the book's Theorem 2.1):</p>
      <ul>
        <li>\( (\mathbf P + \mathbf Q) + \mathbf R = \mathbf P + (\mathbf Q + \mathbf R) \) (associative)</li>
        <li>\( \mathbf P + \mathbf Q = \mathbf Q + \mathbf P \) (commutative)</li>
        <li>\( (ab)\mathbf P = a(b\mathbf P) \), and \( a(\mathbf P + \mathbf Q) = a\mathbf P + a\mathbf Q \),
            \( (a + b)\mathbf P = a\mathbf P + b\mathbf P \) (distributive)</li>
      </ul>
      <p>So you can rearrange vector expressions the same way you rearrange expressions with ordinary numbers.</p>

      <h2>Magnitude</h2>
      <p>The <strong>magnitude</strong> (length, or norm) of a vector comes from the Pythagorean theorem:
      \[ \lVert \mathbf V \rVert = \sqrt{\sum_{i=1}^{n} V_i^2} = \sqrt{V_x^2 + V_y^2 + V_z^2}. \]</p>
      <p>Two useful facts (Theorem 2.2):</p>
      <ul>
        <li>\( \lVert a\mathbf P \rVert = |a|\,\lVert \mathbf P \rVert \). Scaling a vector scales its length.</li>
        <li>\( \lVert \mathbf P + \mathbf Q \rVert \le \lVert \mathbf P \rVert + \lVert \mathbf Q \rVert \),
            the <strong>triangle inequality</strong>. A detour is never shorter than the straight path. The two sides
            are equal only when \(\mathbf P\) and \(\mathbf Q\) point the same way.</li>
      </ul>

      <h2>Unit vectors and normalization</h2>
      <p>A vector with magnitude 1 is a <strong>unit vector</strong>. To <strong>normalize</strong> a nonzero vector,
      divide it by its length:
      \[ \hat{\mathbf V} = \frac{\mathbf V}{\lVert \mathbf V \rVert}. \]
      The result points the same way but has length exactly 1. Directions such as surface normals, light directions
      and camera axes are almost always stored as unit vectors, because the formulas in later chapters assume
      length 1.</p>

      <div class="warn">You can't normalize the zero vector, because it would mean dividing by zero. In engine code,
      check the length first (or compare the squared length with a small epsilon) before normalizing something
      like a velocity that might be zero.</div>

      <div class="note">Comparing squared lengths \(\lVert\mathbf V\rVert^2 = V_x^2+V_y^2+V_z^2\) skips the square
      root. To test "is the enemy within 10 meters?", check <code>SquaredMag(d) &lt; 100</code>.</div>

      <p><a class="btn goto-sim" href="#/2.1/sim">Try it: drag vectors in the simulation →</a></p>
    `,

    keyFormulas: [
      ["Scalar multiplication", String.raw`a\mathbf V = \langle aV_x, aV_y, aV_z \rangle`],
      ["Vector addition", String.raw`\mathbf P + \mathbf Q = \langle P_x + Q_x,\; P_y + Q_y,\; P_z + Q_z \rangle`],
      ["Magnitude", String.raw`\lVert \mathbf V \rVert = \sqrt{V_x^2 + V_y^2 + V_z^2}`],
      ["Triangle inequality", String.raw`\lVert \mathbf P + \mathbf Q \rVert \le \lVert \mathbf P \rVert + \lVert \mathbf Q \rVert`],
      ["Normalization", String.raw`\hat{\mathbf V} = \mathbf V / \lVert \mathbf V \rVert`],
    ],

    exercises: [
      { q: String.raw`What is the magnitude of \(\langle 2, -3, 6 \rangle\)?`,
        a: String.raw`\(\sqrt{4 + 9 + 36} = \sqrt{49} = 7\).` },
      { q: String.raw`Normalize \(\langle 3, 0, 4 \rangle\).`,
        a: String.raw`Its length is 5, so the unit vector is \(\langle 0.6, 0, 0.8 \rangle\).` },
      { q: "A player is at (1, 0, 2) and an item is at (4, 0, 6). What vector points from the player to the item, and how far away is it?",
        a: String.raw`Item − player = \(\langle 3, 0, 4 \rangle\), with length 5.` },
      { q: String.raw`When does \(\lVert \mathbf P + \mathbf Q \rVert = \lVert \mathbf P \rVert + \lVert \mathbf Q \rVert\)?`,
        a: "When P and Q point in the same direction, or when one of them is zero. Then the tip-to-tail path is already a straight line." },
    ],

    sims: [
      {
        title: "Vector playground",
        help: String.raw`<p>Drag the tips of <b>a</b> and <b>b</b>. Switch between operations to see the
          tip-to-tail picture of each one, and check the numbers on the right against the formulas.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 5.5, height: 460 });
          const out = sim.readout(readout);
          const a = view.handle([3, 1], { color: "a", label: "a", snap: 0.5 });
          const b = view.handle([1, 2.5], { color: "b", label: "b", snap: 0.5 });

          const mode = sim.segmented(controls, {
            label: "Operation",
            options: [["add", "a + b"], ["sub", "a − b"], ["scale", "k a"], ["norm", "â"]],
            value: "add",
            onChange: () => {
              b.visible = mode.value === "add" || mode.value === "sub";
              view.redraw();
            },
          });
          const k = sim.slider(controls, { label: "Scalar k", min: -3, max: 3, step: 0.1, value: 1.5, onInput: () => view.redraw() });
          sim.checkbox(controls, {
            label: "Snap to grid", value: true,
            onChange: (on) => { a.snap = b.snap = on ? 0.5 : null; },
          });

          view.onDraw((v) => {
            v.grid({ step: 1 });
            v.axes();
            const A = a.pos, B = b.pos, O = [0, 0];
            const rows = [[sim.swatch("a") + "a", fmtVec(A)], ["‖a‖", fmt(V.len(A))]];

            if (mode.value === "add") {
              const S = V.add(A, B);
              v.polygon([O, A, S, B], { fill: "c", fillAlpha: 0.08, stroke: false });
              v.arrow(A, S, { color: "b", dash: [6, 5], width: 2 });
              v.arrow(B, S, { color: "a", dash: [6, 5], width: 2, alpha: 0.5 });
              v.arrow(O, S, { color: "c", label: "a + b", width: 3 });
              v.arrow(O, A, { color: "a" });
              v.arrow(O, B, { color: "b" });
              const ok = V.len(S) <= V.len(A) + V.len(B) + 1e-9;
              rows.push([sim.swatch("b") + "b", fmtVec(B)], ["‖b‖", fmt(V.len(B))], [sim.swatch("c") + "a + b", fmtVec(S)],
                ["‖a + b‖", fmt(V.len(S))], ["‖a‖ + ‖b‖", fmt(V.len(A) + V.len(B))]);
              out.set(sim.rows(rows) + `<hr>Triangle inequality: <span class="${ok ? "ok" : "bad"}">${fmt(V.len(S))} ≤ ${fmt(V.len(A) + V.len(B))}</span>`);
            } else if (mode.value === "sub") {
              const D = V.sub(A, B);
              v.arrow(O, D, { color: "c", dash: [6, 5], alpha: 0.5 });
              v.arrow(B, A, { color: "c", label: "a − b", width: 3 });
              v.arrow(O, A, { color: "a" });
              v.arrow(O, B, { color: "b" });
              rows.push([sim.swatch("b") + "b", fmtVec(B)], [sim.swatch("c") + "a − b", fmtVec(D)], ["‖a − b‖ (distance)", fmt(V.len(D))]);
              out.set(sim.rows(rows) + `<hr>a − b points <b>from the tip of b to the tip of a</b>. Its length is the distance between the two points.`);
            } else if (mode.value === "scale") {
              const S = V.scale(A, k.value);
              v.arrow(O, S, { color: "c", label: "k a", width: 4, alpha: 0.85 });
              v.arrow(O, A, { color: "a", width: 2 });
              rows.push(["k", fmt(k.value, 1)], [sim.swatch("c") + "k a", fmtVec(S)], ["‖k a‖", fmt(V.len(S))], ["|k| ‖a‖", fmt(Math.abs(k.value) * V.len(A))]);
              out.set(sim.rows(rows) + `<hr>${k.value < 0 ? "Negative k <b>flips</b> the direction." : "Positive k keeps the direction."} The length is scaled by |k|.`);
            } else {
              const N = V.norm(A);
              v.circle(O, 1, { color: "muted", dash: [4, 4], width: 1.5 });
              v.arrow(O, A, { color: "a", alpha: 0.6 });
              v.arrow(O, N, { color: "c", label: "â", width: 3.5 });
              rows.push([sim.swatch("c") + "â = a / ‖a‖", fmtVec(N, 3)], ["‖â‖", fmt(V.len(N), 3)]);
              out.set(sim.rows(rows) + `<hr>Normalizing keeps the direction and puts the tip on the <b>unit circle</b>.`);
            }
          });
          b.visible = true;
        },
      },
      {
        title: "Moving toward a target",
        help: String.raw`<p>The enemy moves toward the player with \(\mathbf p \leftarrow \mathbf p + s\,\hat{\mathbf d}\,\Delta t\),
          where \(\mathbf d = \text{target} - \mathbf p\). Turn normalization off and it moves fast when far away and
          slow when close, because the speed then depends on the distance.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 6, height: 440 });
          const out = sim.readout(readout);
          const target = view.handle([3.5, 2], { color: "c", label: "player" });
          let p = [-4, -3];
          const speed = sim.slider(controls, { label: "Speed s", min: 0.5, max: 6, step: 0.1, value: 2.5, unit: " /s" });
          const normalize = sim.checkbox(controls, { label: "Normalize the direction", value: true });
          sim.buttons(controls, [{ label: "Reset enemy", onClick: () => (p = [-4, -3]) }]);
          const trail = [];

          sim.loop((dt) => {
            const d = V.sub(target.pos, p);
            const dist = V.len(d);
            if (dist > 0.05) {
              const dir = normalize.value ? V.norm(d) : d;
              p = V.add(p, V.scale(dir, speed.value * dt));
            }
            trail.push([...p]);
            if (trail.length > 160) trail.shift();
            view.redraw();
            const step = normalize.value ? speed.value : speed.value * dist;
            out.set(sim.rows([
              ["d = target − p", fmtVec(d)],
              ["‖d‖ (distance)", fmt(dist)],
              ["actual speed", fmt(dist > 0.05 ? step : 0) + " /s"],
            ]));
          });

          view.onDraw((v) => {
            v.grid({ step: 1 });
            v.axes();
            v.polyline(trail, { color: "b", alpha: 0.35, width: 2 });
            v.arrow(p, target.pos, { color: "muted", dash: [5, 5], width: 1.5 });
            const dir = V.norm(V.sub(target.pos, p));
            v.arrow(p, V.add(p, dir), { color: "a", label: "d̂", width: 3 });
            v.point(p, { color: "b", r: 8, label: "enemy" });
          });
        },
      },
    ],

    cpp: [
      {
        title: "Adding and scaling vectors",
        formula: String.raw`\mathbf P + \mathbf Q = \langle P_x + Q_x, P_y + Q_y, P_z + Q_z \rangle \qquad a\mathbf V = \langle aV_x, aV_y, aV_z\rangle`,
        code: String.raw`
          Vector3D operator+(const Vector3D& p, const Vector3D& q)
          {
              return Vector3D(p.x + q.x, p.y + q.y, p.z + q.z);
          }

          Vector3D operator*(const Vector3D& v, float a)
          {
              return Vector3D(v.x * a, v.y * a, v.z * a);
          }

          // Typical use: integrate motion once per frame.
          void UpdatePosition(Point3D& position, const Vector3D& velocity, float dt)
          {
              position = position + velocity * dt;      // P + tV
          }
        `,
      },
      {
        title: "Magnitude",
        formula: String.raw`\lVert \mathbf V \rVert = \sqrt{V_x^2 + V_y^2 + V_z^2}`,
        code: String.raw`
          float Magnitude(const Vector3D& v)
          {
              return std::sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
          }

          // Same thing without the square root. Use it for comparisons.
          float SquaredMag(const Vector3D& v)
          {
              return v.x * v.x + v.y * v.y + v.z * v.z;
          }

          bool IsWithinRange(const Point3D& a, const Point3D& b, float range)
          {
              return SquaredMag(b - a) < range * range;   // ||b - a||^2 < r^2  <=>  ||b - a|| < r
          }
        `,
      },
      {
        title: "Normalization",
        formula: String.raw`\hat{\mathbf V} = \frac{\mathbf V}{\lVert \mathbf V \rVert}`,
        code: String.raw`
          Vector3D Normalize(const Vector3D& v)
          {
              return v * (1.0f / Magnitude(v));     // one divide, three multiplies
          }

          // Safe version for vectors that might be zero (e.g. a stopped velocity).
          Vector3D SafeNormalize(const Vector3D& v, const Vector3D& fallback)
          {
              float m2 = SquaredMag(v);
              if (m2 < 1.0e-12f) return fallback;
              return v * (1.0f / std::sqrt(m2));
          }
        `,
      },
      {
        title: "Move toward a target at constant speed",
        formula: String.raw`\mathbf p \leftarrow \mathbf p + s\,\Delta t\,\frac{\mathbf t - \mathbf p}{\lVert \mathbf t - \mathbf p \rVert}`,
        code: String.raw`
          Point3D MoveTowards(const Point3D& p, const Point3D& target, float speed, float dt)
          {
              Vector3D d = target - p;
              float dist = Magnitude(d);
              float step = speed * dt;
              if (dist <= step) return target;          // arrive without overshooting
              return p + d * (step / dist);            // d / dist is the unit direction
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 2.2 The Dot Product
  // ===========================================================================
  L3D.topic({
    id: "2.2",
    summary: "The dot product measures how much two vectors point the same way. It gives angles, projections, and front/behind tests.",

    lesson: String.raw`
      <p>The <strong>dot product</strong> (or scalar product) of two n-dimensional vectors multiplies matching
      components and adds the results. The answer is a single number, a <em>scalar</em>:
      \[ \mathbf P \cdot \mathbf Q = \sum_{i=1}^{n} P_i Q_i = P_x Q_x + P_y Q_y + P_z Q_z. \]
      The same value can also be written using lengths and angles:</p>

      <div class="formula">
        \[ \mathbf P \cdot \mathbf Q = \lVert \mathbf P \rVert \, \lVert \mathbf Q \rVert \cos\alpha \]
        where \(\alpha\) is the angle between the two vectors (Theorem 2.4).
      </div>

      <p>The proof uses the law of cosines on the triangle formed by \(\mathbf P\), \(\mathbf Q\) and
      \(\mathbf P - \mathbf Q\). Expand \(\lVert \mathbf P - \mathbf Q \rVert^2\) component by component and the
      cosine term turns out to equal \(\sum P_iQ_i\).</p>

      <h2>What the sign tells you</h2>
      <p>Lengths are never negative, so the sign of \(\mathbf P\cdot\mathbf Q\) is the sign of \(\cos\alpha\):</p>
      <table>
        <tr><th>\(\mathbf P \cdot \mathbf Q\)</th><th>angle</th><th>meaning</th></tr>
        <tr><td>&gt; 0</td><td>\(\alpha &lt; 90^\circ\)</td><td>roughly the same direction</td></tr>
        <tr><td>= 0</td><td>\(\alpha = 90^\circ\)</td><td><strong>orthogonal</strong> (perpendicular)</td></tr>
        <tr><td>&lt; 0</td><td>\(\alpha &gt; 90^\circ\)</td><td>roughly opposite directions</td></tr>
      </table>
      <p>The zero vector counts as orthogonal to every vector. For <em>unit</em> vectors the dot product <em>is</em>
      the cosine of the angle, so it runs from \(-1\) (opposite) to \(+1\) (identical).</p>

      <div class="game">
        <ul>
          <li><b>Is the player in front of the guard?</b> Check \(\text{forward}\cdot(\text{player}-\text{guard}) &gt; 0\).</li>
          <li><b>Inside a vision cone?</b> Compare \(\hat{\mathbf f}\cdot\hat{\mathbf d}\) with \(\cos(\tfrac{\text{fov}}{2})\). No <code>acos</code> needed.</li>
          <li><b>Lighting:</b> diffuse brightness is \(\max(0, \mathbf N\cdot\mathbf L)\) (Chapter 7).</li>
          <li><b>Back-face culling:</b> a triangle faces away when \(\mathbf N\cdot(\text{camera}-\text{vertex}) &lt; 0\).</li>
        </ul>
      </div>

      <h2>Properties</h2>
      <p>For scalars \(a\) and vectors \(\mathbf P, \mathbf Q, \mathbf R\) (Theorem 2.5):</p>
      <ul>
        <li>\( \mathbf P \cdot \mathbf Q = \mathbf Q \cdot \mathbf P \)</li>
        <li>\( (a\mathbf P) \cdot \mathbf Q = a(\mathbf P \cdot \mathbf Q) \)</li>
        <li>\( \mathbf P \cdot (\mathbf Q + \mathbf R) = \mathbf P \cdot \mathbf Q + \mathbf P \cdot \mathbf R \)</li>
        <li>\( \mathbf P \cdot \mathbf P = \lVert \mathbf P \rVert^2 \). This is why squared lengths are cheap.</li>
        <li>\( |\mathbf P \cdot \mathbf Q| \le \lVert \mathbf P \rVert \lVert \mathbf Q \rVert \), the
            <strong>Cauchy–Schwarz inequality</strong>. It follows from \(|\cos\alpha| \le 1\), and it is the
            key step in proving the triangle inequality from Section 2.1.</li>
      </ul>

      <h2>Projection</h2>
      <p>Often you need to split a vector \(\mathbf P\) into a part <em>along</em> \(\mathbf Q\) and a part
      <em>perpendicular</em> to it. The side of the right triangle that lies along \(\mathbf Q\) has length
      \(\lVert\mathbf P\rVert\cos\alpha = \mathbf P\cdot\mathbf Q / \lVert\mathbf Q\rVert\). Multiply that length
      by the unit direction \(\mathbf Q/\lVert\mathbf Q\rVert\) to get the <strong>projection</strong>:</p>
      <div class="formula">
        \[ \operatorname{proj}_{\mathbf Q}\mathbf P = \frac{\mathbf P \cdot \mathbf Q}{\lVert \mathbf Q \rVert^2}\,\mathbf Q
           \qquad
           \operatorname{perp}_{\mathbf Q}\mathbf P = \mathbf P - \operatorname{proj}_{\mathbf Q}\mathbf P \]
      </div>
      <p>The perpendicular part is orthogonal to \(\mathbf Q\). You can check this:
      \(\operatorname{perp}_{\mathbf Q}\mathbf P \cdot \mathbf Q = \mathbf P\cdot\mathbf Q - \mathbf P\cdot\mathbf Q = 0\).
      When \(\mathbf Q\) is a unit vector the formula simplifies to \((\mathbf P\cdot\mathbf Q)\mathbf Q\).</p>
      <p>Projection is a <em>linear</em> transformation, so it can be written as a matrix. The outer product
      \(\mathbf Q\mathbf Q^{\mathsf T}/\lVert\mathbf Q\rVert^2\) maps \(\mathbf P\) to its projection. You will see
      this matrix again in Chapter 4.</p>

      <div class="game">Projection is how you make a character slide along a wall. Remove the part of the velocity
      that points into the wall and keep the perpendicular part:
      \(\mathbf v' = \mathbf v - (\mathbf v\cdot\hat{\mathbf n})\hat{\mathbf n}\). Chapter 12 builds a full sliding
      algorithm on this.</div>

      <p><a class="btn goto-sim" href="#/2.2/sim">Try it: projection and vision-cone simulations →</a></p>
    `,

    keyFormulas: [
      ["Dot product", String.raw`\mathbf P \cdot \mathbf Q = P_xQ_x + P_yQ_y + P_zQ_z = \lVert\mathbf P\rVert\lVert\mathbf Q\rVert\cos\alpha`],
      ["Angle between vectors", String.raw`\alpha = \cos^{-1}\!\left(\frac{\mathbf P\cdot\mathbf Q}{\lVert\mathbf P\rVert\lVert\mathbf Q\rVert}\right)`],
      ["Projection", String.raw`\operatorname{proj}_{\mathbf Q}\mathbf P = \frac{\mathbf P\cdot\mathbf Q}{\lVert\mathbf Q\rVert^2}\mathbf Q`],
      ["Perpendicular component", String.raw`\operatorname{perp}_{\mathbf Q}\mathbf P = \mathbf P - \operatorname{proj}_{\mathbf Q}\mathbf P`],
      ["Cauchy–Schwarz", String.raw`|\mathbf P\cdot\mathbf Q| \le \lVert\mathbf P\rVert\lVert\mathbf Q\rVert`],
    ],

    exercises: [
      { q: String.raw`Compute \(\langle 1, 2, 3\rangle \cdot \langle 4, -5, 6\rangle\).`,
        a: String.raw`\(4 - 10 + 18 = 12\).` },
      { q: String.raw`Find the angle between \(\langle 1, 0, 0\rangle\) and \(\langle 1, 1, 0\rangle\).`,
        a: String.raw`\(\cos\alpha = 1/(1\cdot\sqrt2)\), so \(\alpha = 45^\circ\).` },
      { q: String.raw`Project \(\mathbf P = \langle 3, 4, 0 \rangle\) onto \(\mathbf Q = \langle 1, 0, 0\rangle\). What is the perpendicular part?`,
        a: String.raw`proj = \(\langle 3, 0, 0\rangle\), perp = \(\langle 0, 4, 0\rangle\).` },
      { q: "A guard faces f = (0, 0, −1) and has a 90° field of view. Is a player at relative position d = (1, 0, −2) visible?",
        a: String.raw`\(\hat{\mathbf d} = \langle 1,0,-2\rangle/\sqrt5\), so \(\mathbf f\cdot\hat{\mathbf d} = 2/\sqrt5 \approx 0.894\). That's greater than \(\cos 45^\circ \approx 0.707\), so yes, the player is visible.` },
    ],

    sims: [
      {
        title: "Dot product, angle, and projection",
        help: String.raw`<p>Drag <b>a</b> and <b>b</b>. The shaded half-plane is where \(\mathbf a\cdot\mathbf b &gt; 0\).
          The green arrow is \(\operatorname{proj}_{\mathbf b}\mathbf a\) and the dashed line is the perpendicular part.
          Try to make the dot product exactly zero.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 5, height: 460 });
          const out = sim.readout(readout);
          const a = view.handle([2.5, 3], { color: "a", label: "a", snap: 0.25 });
          const b = view.handle([4, 1], { color: "b", label: "b", snap: 0.25 });
          const showHalf = sim.checkbox(controls, { label: "Shade where a · b > 0", value: true, onChange: () => view.redraw() });
          const showProj = sim.checkbox(controls, { label: "Show projection of a onto b", value: true, onChange: () => view.redraw() });
          const unitB = sim.checkbox(controls, { label: "Keep b unit length (then a · b is the projected length)", value: false, onChange: () => view.redraw() });

          view.onDraw((v) => {
            if (unitB.value && V.len(b.pos) > 0) b.pos.splice(0, 2, ...V.norm(b.pos));
            const A = a.pos, B = b.pos, O = [0, 0];
            v.grid({ step: 1 });
            if (showHalf.value && V.len(B) > 0) {
              // half-plane {x : x . b > 0}
              const n = V.norm(B), t = V.perp2(n);
              const R = 40;
              v.polygon([V.scale(t, R), V.add(V.scale(t, R), V.scale(n, R)), V.add(V.scale(t, -R), V.scale(n, R)), V.scale(t, -R)],
                { fill: "c", fillAlpha: 0.07, stroke: false });
              v.infiniteLine(O, t, { color: "c", alpha: 0.4, dash: [6, 6], width: 1 });
            }
            v.axes();
            const dot = V.dot(A, B);
            const ang = V.angle(A, B);
            const proj = V.proj(A, B);
            if (showProj.value) {
              v.infiniteLine(O, B, { color: "b", alpha: 0.2, width: 1 });
              v.line(A, proj, { color: "muted", dash: [5, 5], width: 1.5 });
              v.arrow(O, proj, { color: "c", width: 4, label: "proj" });
              // right-angle marker
              if (V.len(V.sub(A, proj)) > 0.2 && V.len(proj) > 0.2) {
                const u = V.scale(V.norm(B), 0.25 * Math.sign(dot || 1)), w = V.scale(V.norm(V.sub(A, proj)), 0.25);
                v.polyline([V.sub(proj, u), V.add(V.sub(proj, u), w), V.add(proj, w)], { color: "muted", width: 1 });
              }
            }
            const a0 = Math.atan2(A[1], A[0]), b0 = Math.atan2(B[1], B[0]);
            let d0 = b0 - a0;
            while (d0 > Math.PI) d0 -= 2 * Math.PI;
            while (d0 < -Math.PI) d0 += 2 * Math.PI;
            v.arc(O, 0.8, a0, a0 + d0, { color: "d", width: 2 });
            v.text(V.scale([Math.cos(a0 + d0 / 2), Math.sin(a0 + d0 / 2)], 1.15), fmt(deg(ang), 0) + "°", { color: "d", align: "center", offset: [0, 4] });
            v.arrow(O, A, { color: "a" });
            v.arrow(O, B, { color: "b" });

            const cls = Math.abs(dot) < 1e-9 ? "ok" : dot > 0 ? "" : "bad";
            out.set(
              sim.rows([
                [sim.swatch("a") + "a", fmtVec(A)],
                [sim.swatch("b") + "b", fmtVec(B)],
                ["a · b = aₓbₓ + a_yb_y", `<b class="${cls}">${fmt(dot)}</b>`],
                ["‖a‖ ‖b‖ cos α", fmt(V.len(A) * V.len(B) * Math.cos(ang))],
                ["angle α", fmt(deg(ang), 1) + "°"],
                [sim.swatch("c") + "proj_b a", fmtVec(proj)],
                ["perp_b a", fmtVec(V.sub(A, proj))],
              ]) + `<hr>${Math.abs(dot) < 1e-9 ? "<b class='ok'>Orthogonal!</b> a · b = 0" :
                dot > 0 ? "a · b > 0: the angle is less than 90°." : "a · b < 0: the angle is more than 90°."}`
            );
          });
        },
      },
      {
        title: "Guard vision cone",
        help: String.raw`<p>A guard sees the player when the player is in front of it and inside its field of view:
          \(\hat{\mathbf f}\cdot\hat{\mathbf d} \ge \cos(\text{fov}/2)\) and \(\lVert\mathbf d\rVert \le \text{range}\).
          Drag the player and the guard's facing handle.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 6, height: 460 });
          const out = sim.readout(readout);
          const guard = [-2, -1];
          const face = view.handle([0.5, 0.5], { color: "b", label: "facing" });
          const player = view.handle([3, 2.5], { color: "c", label: "player" });
          const fov = sim.slider(controls, { label: "Field of view", min: 10, max: 300, step: 1, value: 90, unit: "°", onInput: () => view.redraw() });
          const range = sim.slider(controls, { label: "Sight range", min: 1, max: 10, step: 0.1, value: 6.5, onInput: () => view.redraw() });

          view.onDraw((v) => {
            v.grid({ step: 1 });
            const f = V.norm(V.sub(face.pos, guard));
            const d = V.sub(player.pos, guard);
            const dn = V.norm(d);
            const cosHalf = Math.cos(rad(fov.value / 2));
            const dot = V.dot(f, dn);
            const inCone = dot >= cosHalf;
            const inRange = V.len(d) <= range.value;
            const seen = inCone && inRange;

            const base = Math.atan2(f[1], f[0]), half = rad(fov.value / 2);
            const pts = [guard];
            for (let i = 0; i <= 48; i++) {
              const t = base - half + (2 * half * i) / 48;
              pts.push(V.add(guard, [Math.cos(t) * range.value, Math.sin(t) * range.value]));
            }
            v.polygon(pts, { fill: seen ? "e" : "g", fillAlpha: 0.14, color: seen ? "e" : "g", width: 1.5 });
            v.arrow(guard, V.add(guard, V.scale(f, 1.6)), { color: "b", width: 3, label: "f̂" });
            v.line(guard, player.pos, { color: seen ? "e" : "muted", dash: [5, 5], width: 1.5 });
            v.point(guard, { color: "b", r: 9, label: "guard" });
            face.pos.splice(0, 2, ...V.add(guard, V.scale(f, 2.4)));

            out.set(sim.rows([
              ["f̂ · d̂", fmt(dot, 3)],
              ["cos(fov / 2)", fmt(cosHalf, 3)],
              ["inside cone", inCone ? "<span class='ok'>yes</span>" : "<span class='bad'>no</span>"],
              ["distance ‖d‖", fmt(V.len(d))],
              ["in range", inRange ? "<span class='ok'>yes</span>" : "<span class='bad'>no</span>"],
            ]) + `<hr>${seen ? "<b class='bad'>Spotted!</b>" : "Not seen."} The test needs only a dot product and a precomputed cosine, with no <code>acos</code>.`);
          });
        },
      },
    ],

    cpp: [
      {
        title: "Dot product",
        formula: String.raw`\mathbf P \cdot \mathbf Q = P_xQ_x + P_yQ_y + P_zQ_z`,
        code: String.raw`
          float Dot(const Vector3D& p, const Vector3D& q)
          {
              return p.x * q.x + p.y * q.y + p.z * q.z;
          }
        `,
      },
      {
        title: "Angle between two vectors",
        formula: String.raw`\alpha = \cos^{-1}\!\frac{\mathbf P\cdot\mathbf Q}{\lVert\mathbf P\rVert\lVert\mathbf Q\rVert}`,
        note: "<p>Clamp before calling <code>acos</code>. Rounding can push the ratio to 1.0000001, and then <code>acos</code> returns NaN.</p>",
        code: String.raw`
          float AngleBetween(const Vector3D& p, const Vector3D& q)
          {
              float c = Dot(p, q) / (Magnitude(p) * Magnitude(q));
              return std::acos(Clamp(c, -1.0f, 1.0f));     // radians
          }
        `,
      },
      {
        title: "Projection and perpendicular component",
        formula: String.raw`\operatorname{proj}_{\mathbf Q}\mathbf P = \frac{\mathbf P\cdot\mathbf Q}{\mathbf Q\cdot\mathbf Q}\mathbf Q \qquad \operatorname{perp}_{\mathbf Q}\mathbf P = \mathbf P - \operatorname{proj}_{\mathbf Q}\mathbf P`,
        code: String.raw`
          Vector3D Project(const Vector3D& p, const Vector3D& q)
          {
              return q * (Dot(p, q) / Dot(q, q));      // Q.Q = ||Q||^2, no sqrt needed
          }

          Vector3D Reject(const Vector3D& p, const Vector3D& q)
          {
              return p - Project(p, q);
          }

          // Slide along a wall: drop the part of the velocity that goes into the wall.
          Vector3D SlideAlongWall(const Vector3D& velocity, const Vector3D& wallNormal /* unit */)
          {
              return velocity - wallNormal * Dot(velocity, wallNormal);
          }
        `,
      },
      {
        title: "Vision cone test",
        formula: String.raw`\hat{\mathbf f}\cdot\frac{\mathbf d}{\lVert\mathbf d\rVert} \ge \cos\frac{\text{fov}}{2} \quad\Longleftrightarrow\quad \hat{\mathbf f}\cdot\mathbf d \ge \lVert\mathbf d\rVert\cos\frac{\text{fov}}{2}`,
        note: "<p>Multiplying both sides by ‖d‖ removes the normalization. Precompute <code>cosHalfFov</code> once.</p>",
        code: String.raw`
          bool CanSee(const Point3D& guardPos, const Vector3D& guardForward /* unit */,
                      float cosHalfFov, float range, const Point3D& target)
          {
              Vector3D d = target - guardPos;
              float dist2 = Dot(d, d);
              if (dist2 > range * range) return false;              // too far away

              // want  f >= ||d|| * c,  compared with squares so no sqrt is needed
              float f = Dot(guardForward, d);
              float c = cosHalfFov;
              if (c >= 0.0f) return f >= 0.0f && f * f >= dist2 * c * c;   // FOV up to 180 degrees
              return f >= 0.0f || f * f <= dist2 * c * c;                   // FOV wider than 180 degrees
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 2.3 The Cross Product
  // ===========================================================================
  L3D.topic({
    id: "2.3",
    summary: "The cross product of two 3D vectors is perpendicular to both. Its length is the area of the parallelogram they span.",

    lesson: String.raw`
      <p>The <strong>cross product</strong> (or vector product) takes two 3D vectors and returns a new
      <em>vector</em>:
      \[ \mathbf P \times \mathbf Q = \langle P_yQ_z - P_zQ_y,\; P_zQ_x - P_xQ_z,\; P_xQ_y - P_yQ_x \rangle. \]
      A common way to remember it is as a "determinant" whose top row holds the unit vectors
      \(\mathbf i, \mathbf j, \mathbf k\):
      \[ \mathbf P \times \mathbf Q = \begin{vmatrix} \mathbf i & \mathbf j & \mathbf k \\ P_x & P_y & P_z \\ Q_x & Q_y & Q_z \end{vmatrix}. \]
      Each component skips its own axis and uses the other two in cyclic order: \(x\) uses \(y,z\);
      \(y\) uses \(z,x\); \(z\) uses \(x,y\).</p>

      <h2>Direction: perpendicular to both</h2>
      <p>Theorem 2.7 shows \((\mathbf P\times\mathbf Q)\cdot\mathbf P = 0\) and \((\mathbf P\times\mathbf Q)\cdot\mathbf Q = 0\).
      Expand the dot products and every term cancels. So the cross product is orthogonal to <em>both</em> inputs,
      which makes it normal to the plane they span.</p>
      <p>Which of the two possible normals do you get? In a <strong>right-handed</strong> coordinate system, point
      the fingers of your right hand along \(\mathbf P\) and curl them toward \(\mathbf Q\). Your thumb points along
      \(\mathbf P\times\mathbf Q\). As a check, \(\mathbf i \times \mathbf j = \mathbf k\).</p>

      <h2>Length: the area of a parallelogram</h2>
      <div class="formula">
        \[ \lVert \mathbf P \times \mathbf Q \rVert = \lVert \mathbf P \rVert\,\lVert \mathbf Q \rVert \sin\alpha \]
      </div>
      <p>Theorem 2.8 proves this by expanding \(\lVert\mathbf P\times\mathbf Q\rVert^2\) and using
      \(\cos^2\alpha + \sin^2\alpha = 1\). The parallelogram with sides \(\mathbf P\) and \(\mathbf Q\) has base
      \(\lVert\mathbf Q\rVert\) and height \(\lVert\mathbf P\rVert\sin\alpha\), so the cross product's length is
      that parallelogram's area. The triangle with the same two sides has half that area. Parallel vectors have
      a zero cross product.</p>

      <div class="game">
        <ul>
          <li><b>Triangle normal:</b> \(\mathbf N = (\mathbf V_1 - \mathbf V_0) \times (\mathbf V_2 - \mathbf V_0)\).
            The vertex winding order (counterclockwise vs clockwise) decides which way it faces.</li>
          <li><b>Triangle area:</b> \(\tfrac12\lVert\mathbf N\rVert\). Use it to weight normals or scatter points
            evenly over a mesh.</li>
          <li><b>Left or right?</b> The sign of \((\mathbf f \times \mathbf d)_y\) tells an AI whether a target is to
            its left or right, so it knows which way to turn.</li>
          <li><b>Build a camera basis:</b> \(\text{right} = \text{forward}\times\text{up}\).</li>
        </ul>
      </div>

      <h2>Algebraic properties</h2>
      <p>For scalars \(a\) and 3D vectors \(\mathbf P, \mathbf Q, \mathbf R\) (Theorem 2.9):</p>
      <ul>
        <li>\( \mathbf Q \times \mathbf P = -(\mathbf P \times \mathbf Q) \). The cross product is
            <strong>anticommutative</strong>, so swapping the inputs flips the normal.</li>
        <li>\( (a\mathbf P)\times\mathbf Q = a(\mathbf P\times\mathbf Q) \)</li>
        <li>\( \mathbf P \times (\mathbf Q + \mathbf R) = \mathbf P\times\mathbf Q + \mathbf P\times\mathbf R \)</li>
        <li>\( \mathbf P \times \mathbf P = \mathbf 0 \), and more generally \(\mathbf P\times(a\mathbf P) = \mathbf 0\).</li>
        <li>\( (\mathbf P\times\mathbf Q)\cdot\mathbf R = (\mathbf R\times\mathbf P)\cdot\mathbf Q = (\mathbf Q\times\mathbf R)\cdot\mathbf P \),
            the <strong>scalar triple product</strong>. It equals the signed volume of the box (parallelepiped)
            spanned by the three vectors.</li>
      </ul>
      <div class="warn">The cross product is <strong>not associative</strong>:
      \((\mathbf P\times\mathbf Q)\times\mathbf R \ne \mathbf P\times(\mathbf Q\times\mathbf R)\) in general.
      For example \((\mathbf i\times\mathbf i)\times\mathbf j = \mathbf 0\), but
      \(\mathbf i\times(\mathbf i\times\mathbf j) = \mathbf i\times\mathbf k = -\mathbf j\).
      Always parenthesize.</div>

      <h2>As a matrix</h2>
      <p>Crossing with a fixed vector \(\mathbf P\) is a linear operation, so it can be written as a matrix
      times \(\mathbf Q\):
      \[ \mathbf P\times\mathbf Q = \begin{bmatrix} 0 & -P_z & P_y \\ P_z & 0 & -P_x \\ -P_y & P_x & 0 \end{bmatrix}
         \begin{bmatrix} Q_x \\ Q_y \\ Q_z \end{bmatrix}. \]
      This skew-symmetric matrix appears in the formula for rotating about an arbitrary axis (Section 4.3.1) and in
      rigid-body physics (Chapter 14).</p>

      <p><a class="btn goto-sim" href="#/2.3/sim">Try it: orbit the 3D cross product →</a></p>
    `,

    keyFormulas: [
      ["Cross product", String.raw`\mathbf P\times\mathbf Q = \langle P_yQ_z - P_zQ_y,\; P_zQ_x - P_xQ_z,\; P_xQ_y - P_yQ_x\rangle`],
      ["Magnitude = parallelogram area", String.raw`\lVert\mathbf P\times\mathbf Q\rVert = \lVert\mathbf P\rVert\lVert\mathbf Q\rVert\sin\alpha`],
      ["Anticommutativity", String.raw`\mathbf Q\times\mathbf P = -(\mathbf P\times\mathbf Q)`],
      ["Triangle normal", String.raw`\mathbf N = (\mathbf V_1-\mathbf V_0)\times(\mathbf V_2-\mathbf V_0)`],
      ["Scalar triple product", String.raw`(\mathbf P\times\mathbf Q)\cdot\mathbf R = \text{signed volume}`],
    ],

    exercises: [
      { q: String.raw`Compute \(\langle 1, 2, 3\rangle \times \langle 4, 5, 6\rangle\).`,
        a: String.raw`\(\langle 2\cdot6 - 3\cdot5,\; 3\cdot4 - 1\cdot6,\; 1\cdot5 - 2\cdot4\rangle = \langle -3, 6, -3\rangle\).` },
      { q: "Find the area of the triangle with vertices (0,0,0), (2,0,0), (0,3,0).",
        a: String.raw`\(\tfrac12\lVert\langle2,0,0\rangle\times\langle0,3,0\rangle\rVert = \tfrac12\lVert\langle0,0,6\rangle\rVert = 3\).` },
      { q: String.raw`Why is \(\mathbf j\times\mathbf i = -\mathbf k\) and not \(\mathbf k\)?`,
        a: String.raw`Anticommutativity: \(\mathbf j\times\mathbf i = -(\mathbf i\times\mathbf j) = -\mathbf k\). The right-hand rule gives the same answer, since curling from j to i points the thumb along −z.` },
      { q: "An AI faces f = (0, 0, −1) and a target is at relative position d = (2, 0, −1), with y up. Should it turn left or right?",
        a: String.raw`\((\mathbf f\times\mathbf d)_y = f_zd_x - f_xd_z = (-1)(2) - 0 = -2 &lt; 0\). A negative y-component means the target is clockwise seen from above, so it is to the <b>right</b>. (Facing −z with y up, +x is the right-hand side.)` },
    ],

    sims: [
      {
        title: "Cross product in 3D",
        help: String.raw`<p>Set the directions of \(\mathbf a\) and \(\mathbf b\) with the sliders and drag the view to
          orbit. The purple arrow \(\mathbf a\times\mathbf b\) is always perpendicular to the shaded parallelogram,
          and its length equals the parallelogram's area. Tick “show b × a” to see anticommutativity.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view3d(stage, { height: 480, distance: 9, yaw: 0.7, pitch: 0.35 });
          const out = sim.readout(readout);
          const ga = sim.group(controls, "Vector a");
          const aYaw = sim.slider(ga, { label: "Heading", min: -180, max: 180, value: 0, unit: "°", onInput: () => view.redraw() });
          const aLen = sim.slider(ga, { label: "Length", min: 0.5, max: 3, step: 0.1, value: 2.5, onInput: () => view.redraw() });
          const gb = sim.group(controls, "Vector b");
          const bYaw = sim.slider(gb, { label: "Heading", min: -180, max: 180, value: 70, unit: "°", onInput: () => view.redraw() });
          const bPitch = sim.slider(gb, { label: "Elevation", min: -80, max: 80, value: 20, unit: "°", onInput: () => view.redraw() });
          const bLen = sim.slider(gb, { label: "Length", min: 0.5, max: 3, step: 0.1, value: 2, onInput: () => view.redraw() });
          const swap = sim.checkbox(controls, { label: "Show b × a instead", value: false, onChange: () => view.redraw() });

          view.onDraw((v) => {
            // heading measured in the xz-plane from +x toward -z
            const dir = (yaw, pitch) => [Math.cos(rad(pitch)) * Math.cos(rad(yaw)), Math.sin(rad(pitch)), -Math.cos(rad(pitch)) * Math.sin(rad(yaw))];
            const A = V.scale(dir(aYaw.value, 0), aLen.value);
            const B = V.scale(dir(bYaw.value, bPitch.value), bLen.value);
            const C = swap.value ? V.cross(B, A) : V.cross(A, B);
            v.grid({ size: 4, step: 1 });
            v.axes({ length: 1.2 });
            v.poly([[0, 0, 0], A, V.add(A, B), B], { fill: "d", alpha: 0.18, color: "d", width: 1 });
            v.arrow([0, 0, 0], A, { color: "a", label: "a", width: 3 });
            v.arrow([0, 0, 0], B, { color: "b", label: "b", width: 3 });
            v.arrow([0, 0, 0], C, { color: "d", label: swap.value ? "b × a" : "a × b", width: 3.5 });
            // right angle hints
            const n = V.norm(C);
            if (V.len(C) > 0.05) {
              v.line(V.scale(n, 0.35), V.add(V.scale(n, 0.35), V.scale(V.norm(A), 0.35)), { color: "muted", width: 1 });
              v.line(V.add(V.scale(n, 0.35), V.scale(V.norm(A), 0.35)), V.scale(V.norm(A), 0.35), { color: "muted", width: 1 });
            }
            const area = V.len(V.cross(A, B));
            out.set(sim.rows([
              [sim.swatch("a") + "a", fmtVec(A)],
              [sim.swatch("b") + "b", fmtVec(B)],
              [sim.swatch("d") + (swap.value ? "b × a" : "a × b"), fmtVec(C)],
              ["(a × b) · a", fmt(V.dot(V.cross(A, B), A), 3)],
              ["(a × b) · b", fmt(V.dot(V.cross(A, B), B), 3)],
              ["‖a × b‖", fmt(area)],
              ["‖a‖‖b‖ sin α", fmt(V.len(A) * V.len(B) * Math.sin(V.angle(A, B)))],
            ]) + `<hr>Parallelogram area = ${fmt(area)}, triangle area = ${fmt(area / 2)}.`);
          });
        },
      },
      {
        title: "Turn left or right? (2D cross product)",
        help: String.raw`<p>On a 2D map the \(z\)-component of the cross product,
          \(f_x d_y - f_y d_x\), is positive when the target is counterclockwise (to the left) of the facing direction
          and negative when it is clockwise (to the right). The AI turns toward the target by that sign each frame.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 6, height: 440 });
          const out = sim.readout(readout);
          const target = view.handle([3, 3], { color: "c", label: "target" });
          let pos = [-3, -2], heading = 0;
          const turnRate = sim.slider(controls, { label: "Turn rate", min: 20, max: 360, step: 5, value: 120, unit: "°/s" });
          const speed = sim.slider(controls, { label: "Speed", min: 0, max: 4, step: 0.1, value: 1.5, unit: " /s" });

          sim.loop((dt) => {
            const f = [Math.cos(heading), Math.sin(heading)];
            const d = V.sub(target.pos, pos);
            const z = V.cross2(f, d);
            const facing = V.dot(f, V.norm(d));
            if (V.len(d) > 0.3) {
              const maxTurn = rad(turnRate.value) * dt;
              const want = Math.atan2(Math.abs(z), V.dot(f, d));
              heading += Math.sign(z) * Math.min(maxTurn, want);
              pos = V.add(pos, V.scale(f, speed.value * dt));
            }
            view.redraw();
            out.set(sim.rows([
              ["f (facing)", fmtVec(f)],
              ["d = target − pos", fmtVec(d)],
              ["z = fₓd_y − f_ydₓ", `<b class="${z > 0 ? "ok" : "bad"}">${fmt(z)}</b>`],
              ["f̂ · d̂", fmt(facing, 3)],
            ]) + `<hr>${Math.abs(z) < 0.02 && facing > 0 ? "Facing the target." : z > 0 ? "Target is to the <b>left</b>, turning counterclockwise." : "Target is to the <b>right</b>, turning clockwise."}`);
          });

          view.onDraw((v) => {
            v.grid({ step: 1 });
            v.axes();
            const f = [Math.cos(heading), Math.sin(heading)];
            const z = V.cross2(f, V.sub(target.pos, pos));
            const left = V.perp2(f);
            v.polygon([pos, V.add(pos, V.scale(f, 30)), V.add(V.add(pos, V.scale(f, 30)), V.scale(left, 30)), V.add(pos, V.scale(left, 30)), V.add(V.add(pos, V.scale(f, -30)), V.scale(left, 30)), V.add(pos, V.scale(f, -30))],
              { fill: "c", fillAlpha: 0.06, stroke: false });
            v.infiniteLine(pos, f, { color: "muted", dash: [5, 6], width: 1 });
            v.text(V.add(pos, V.scale(left, 1.6)), "left: z > 0", { color: "c", size: 12 });
            v.text(V.add(pos, V.scale(left, -1.6)), "right: z < 0", { color: "e", size: 12 });
            v.line(pos, target.pos, { color: z > 0 ? "c" : "e", dash: [4, 4], width: 1.5 });
            v.arrow(pos, V.add(pos, V.scale(f, 1.5)), { color: "b", width: 3, label: "f" });
            v.point(pos, { color: "b", r: 8 });
          });
        },
      },
    ],

    cpp: [
      {
        title: "Cross product",
        formula: String.raw`\mathbf P\times\mathbf Q = \langle P_yQ_z - P_zQ_y,\; P_zQ_x - P_xQ_z,\; P_xQ_y - P_yQ_x\rangle`,
        code: String.raw`
          Vector3D Cross(const Vector3D& p, const Vector3D& q)
          {
              return Vector3D(p.y * q.z - p.z * q.y,     // x: uses y, z
                              p.z * q.x - p.x * q.z,     // y: uses z, x
                              p.x * q.y - p.y * q.x);    // z: uses x, y
          }
        `,
      },
      {
        title: "Triangle normal and area",
        formula: String.raw`\mathbf N = (\mathbf V_1-\mathbf V_0)\times(\mathbf V_2-\mathbf V_0) \qquad A = \tfrac12\lVert\mathbf N\rVert`,
        note: "<p>With counterclockwise winding (seen from the front) the normal points toward the viewer.</p>",
        code: String.raw`
          Vector3D TriangleNormal(const Point3D& v0, const Point3D& v1, const Point3D& v2)
          {
              return Normalize(Cross(v1 - v0, v2 - v0));
          }

          float TriangleArea(const Point3D& v0, const Point3D& v1, const Point3D& v2)
          {
              return 0.5f * Magnitude(Cross(v1 - v0, v2 - v0));
          }
        `,
      },
      {
        title: "Turn left or right (2D)",
        formula: String.raw`z = f_x d_y - f_y d_x \quad \begin{cases} z>0 & \text{left (counterclockwise)} \\ z<0 & \text{right (clockwise)} \end{cases}`,
        code: String.raw`
          float Cross2D(const Vector2D& f, const Vector2D& d)
          {
              return f.x * d.y - f.y * d.x;    // z of (f.x, f.y, 0) x (d.x, d.y, 0)
          }

          // Returns +1 to turn left, -1 to turn right, 0 if already aligned.
          int TurnDirection(const Vector2D& facing, const Vector2D& toTarget)
          {
              float z = Cross2D(facing, toTarget);
              return (z > 0.0f) - (z < 0.0f);
          }
        `,
      },
      {
        title: "Scalar triple product (signed volume)",
        formula: String.raw`V = (\mathbf P\times\mathbf Q)\cdot\mathbf R`,
        code: String.raw`
          float TripleProduct(const Vector3D& p, const Vector3D& q, const Vector3D& r)
          {
              return Dot(Cross(p, q), r);    // = determinant of the matrix with columns p, q, r
          }

          // Which side of triangle (a, b, c) is point p on?  > 0 means the front (normal) side.
          float SideOfTriangle(const Point3D& a, const Point3D& b, const Point3D& c, const Point3D& p)
          {
              return TripleProduct(b - a, c - a, p - a);
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 2.4 Vector Spaces
  // ===========================================================================
  L3D.topic({
    id: "2.4",
    summary: "Bases, linear independence, and orthonormal sets, plus Gram-Schmidt, the algorithm that turns any basis into an orthonormal one.",

    lesson: String.raw`
      <p>A <strong>vector space</strong> is a set \(\mathcal V\) of objects that can be added and scaled, together
      with a few rules (Definition 2.10). It must be <em>closed</em>: adding two members or scaling one gives another
      member. It must contain a zero vector \(\mathbf 0\), and every vector must have a negative. The usual addition
      and scaling rules from Section 2.1 must hold. \(\mathbb R^n\), the set of n-component real vectors, is the
      space we use all the time.</p>

      <h2>Linear independence</h2>
      <p>A set of vectors \(\{\mathbf e_1, \dots, \mathbf e_n\}\) is <strong>linearly independent</strong> if the only
      way to combine them into zero is with all-zero coefficients (Definition 2.11):
      \[ a_1\mathbf e_1 + a_2\mathbf e_2 + \cdots + a_n\mathbf e_n = \mathbf 0 \;\Rightarrow\; a_1 = a_2 = \cdots = a_n = 0. \]
      Put another way, no vector in the set can be built from the others. Two vectors are dependent exactly when
      they are parallel. Three 3D vectors are dependent exactly when they lie in a common plane, which happens when
      their triple product \((\mathbf e_1\times\mathbf e_2)\cdot\mathbf e_3\) is zero.</p>

      <h2>Bases and coordinates</h2>
      <p>A <strong>basis</strong> for an n-dimensional space is a set of \(n\) linearly independent vectors that
      <em>span</em> the space (Definition 2.12). Every vector \(\mathbf V\) can then be written in exactly one way as
      \[ \mathbf V = a_1\mathbf e_1 + a_2\mathbf e_2 + \cdots + a_n\mathbf e_n, \]
      and the numbers \(a_i\) are the coordinates of \(\mathbf V\) <em>in that basis</em>. Every basis of
      \(\mathbb R^3\) has exactly three vectors. Four vectors in 3D can't be independent, and two can't reach every
      direction.</p>

      <div class="key">Coordinates only mean something relative to a basis. The vertex \((1, 0, 0)\) of a model means
      "one unit along the model's own x axis". Once the model is rotated, that same point has different coordinates
      in world space. Converting between bases is what the transforms in Chapter 4 do.</div>

      <h2>Orthogonal and orthonormal bases</h2>
      <p>A basis is <strong>orthogonal</strong> when every pair of its vectors is perpendicular,
      \(\mathbf e_i\cdot\mathbf e_j = 0\) for \(i\ne j\) (Definition 2.13). Theorem 2.14 shows that nonzero
      orthogonal vectors are automatically independent. If every vector also has length 1, the basis is
      <strong>orthonormal</strong> (Definition 2.15):
      \[ \mathbf e_i\cdot\mathbf e_j = \begin{cases}1 & i = j\\ 0 & i \ne j\end{cases} \]
      The standard basis \(\mathbf i, \mathbf j, \mathbf k\) is orthonormal, but so are infinitely many rotated
      versions of it.</p>
      <p>Orthonormal bases make coordinates easy: <strong>the coordinate along \(\mathbf e_i\) is just
      \(\mathbf V\cdot\mathbf e_i\)</strong>. A general basis would need a linear system solved instead
      (Chapter 3).</p>

      <h2>Gram–Schmidt orthogonalization</h2>
      <p>Algorithm 2.16 turns any linearly independent set into an orthogonal one. Take the vectors one at a time
      and subtract their projection onto every vector already processed. Whatever remains is perpendicular to all
      of them:</p>
      <div class="formula">
        \[ \mathbf e_1' = \mathbf e_1, \qquad
           \mathbf e_i' = \mathbf e_i - \sum_{k=1}^{i-1} \frac{\mathbf e_i\cdot\mathbf e_k'}{\mathbf e_k'\cdot\mathbf e_k'}\,\mathbf e_k' \]
      </div>
      <p>Normalize each \(\mathbf e_i'\) at the end (or as you go) to get an orthonormal basis.</p>

      <div class="game">Repeated floating-point multiplication makes rotation matrices and camera axes drift slowly
      away from perpendicular. Engines run Gram–Schmidt to fix them: normalize forward, remove forward's component
      from up and renormalize it, then rebuild right with a cross product. The same steps build a camera frame from a
      look direction and a world-up vector (see the C++ tab).</div>

      <div class="warn">Gram–Schmidt fails when the input vectors are dependent. A step then leaves (nearly) the zero
      vector, and normalizing it divides by zero. If the camera looks straight up and your "up" hint is also straight
      up, you've hit exactly this case. Pick a different hint vector.</div>

      <p><a class="btn goto-sim" href="#/2.4/sim">Try it: bases and Gram–Schmidt →</a></p>
    `,

    keyFormulas: [
      ["Linear independence", String.raw`\textstyle\sum a_i\mathbf e_i = \mathbf 0 \;\Rightarrow\; \text{all } a_i = 0`],
      ["Orthonormal basis", String.raw`\mathbf e_i\cdot\mathbf e_j = \delta_{ij}`],
      ["Coordinates in an orthonormal basis", String.raw`\mathbf V = \textstyle\sum_i (\mathbf V\cdot\mathbf e_i)\,\mathbf e_i`],
      ["Gram–Schmidt step", String.raw`\mathbf e_i' = \mathbf e_i - \sum_{k \lt i}\frac{\mathbf e_i\cdot\mathbf e_k'}{\mathbf e_k'\cdot\mathbf e_k'}\mathbf e_k'`],
    ],

    exercises: [
      { q: String.raw`Are \(\langle 1, 2, 3\rangle, \langle 2, 4, 6\rangle, \langle 0, 1, 0\rangle\) linearly independent?`,
        a: "No. The second vector is twice the first, so 2·e₁ − e₂ + 0·e₃ = 0." },
      { q: String.raw`Apply Gram–Schmidt to \(\mathbf e_1 = \langle 1, 1, 0\rangle\), \(\mathbf e_2 = \langle 1, 0, 0\rangle\).`,
        a: String.raw`\(\mathbf e_2' = \langle1,0,0\rangle - \tfrac{1}{2}\langle1,1,0\rangle = \langle \tfrac12, -\tfrac12, 0\rangle\). Normalized: \(\tfrac{1}{\sqrt2}\langle1,1,0\rangle\) and \(\tfrac{1}{\sqrt2}\langle1,-1,0\rangle\).` },
      { q: String.raw`In the orthonormal basis \(\mathbf e_1 = \tfrac{1}{\sqrt2}\langle1,1\rangle, \mathbf e_2 = \tfrac{1}{\sqrt2}\langle-1,1\rangle\), what are the coordinates of \(\langle 3, 1\rangle\)?`,
        a: String.raw`\(\langle3,1\rangle\cdot\mathbf e_1 = 4/\sqrt2 = 2\sqrt2\) and \(\langle3,1\rangle\cdot\mathbf e_2 = -2/\sqrt2 = -\sqrt2\).` },
    ],

    sims: [
      {
        title: "Coordinates in any basis",
        help: String.raw`<p>Drag the basis vectors \(\mathbf e_1, \mathbf e_2\) and the point \(\mathbf v\). The
          skewed grid shows lines of constant coordinates. The readout gives \(\mathbf v = a_1\mathbf e_1 + a_2\mathbf e_2\).
          Make \(\mathbf e_1\) and \(\mathbf e_2\) parallel to see the basis break.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 5.5, height: 460 });
          const out = sim.readout(readout);
          const e1 = view.handle([2, 0.5], { color: "a", label: "e₁", snap: 0.25 });
          const e2 = view.handle([0.5, 1.5], { color: "b", label: "e₂", snap: 0.25 });
          const p = view.handle([2.5, 3], { color: "c", label: "v", snap: 0.25 });
          sim.buttons(controls, [
            { label: "Standard basis", onClick: () => { e1.set([1, 0]); e2.set([0, 1]); } },
            { label: "Rotated orthonormal", onClick: () => { e1.set([Math.SQRT1_2, Math.SQRT1_2]); e2.set([-Math.SQRT1_2, Math.SQRT1_2]); } },
          ]);
          const showGrid = sim.checkbox(controls, { label: "Show basis grid", value: true, onChange: () => view.redraw() });

          view.onDraw((v) => {
            v.grid({ step: 1 });
            v.axes({ labels: false });
            const E1 = e1.pos, E2 = e2.pos, P = p.pos;
            const det = V.cross2(E1, E2);
            const independent = Math.abs(det) > 1e-6;
            if (showGrid.value && independent) {
              for (let k = -8; k <= 8; k++) {
                v.infiniteLine(V.scale(E2, k), E1, { color: "a", alpha: 0.18, width: 1 });
                v.infiniteLine(V.scale(E1, k), E2, { color: "b", alpha: 0.18, width: 1 });
              }
            }
            let rows;
            if (independent) {
              // solve [E1 E2] [a1 a2]^T = P with Cramer's rule
              const a1 = V.cross2(P, E2) / det, a2 = V.cross2(E1, P) / det;
              const A1 = V.scale(E1, a1);
              v.arrow([0, 0], A1, { color: "a", dash: [6, 4], width: 2, alpha: 0.8 });
              v.arrow(A1, P, { color: "b", dash: [6, 4], width: 2, alpha: 0.8 });
              rows = [["a₁ (along e₁)", fmt(a1)], ["a₂ (along e₂)", fmt(a2)], ["check a₁e₁ + a₂e₂", fmtVec(V.add(A1, V.scale(E2, a2)))]];
            } else {
              rows = [["status", "<span class='bad'>e₁ ∥ e₂: not a basis</span>"]];
            }
            v.arrow([0, 0], E1, { color: "a", width: 3 });
            v.arrow([0, 0], E2, { color: "b", width: 3 });
            v.point(P, { color: "c", r: 3 });
            const ortho = Math.abs(V.dot(E1, E2)) < 1e-6;
            const normal = Math.abs(V.len(E1) - 1) < 1e-3 && Math.abs(V.len(E2) - 1) < 1e-3;
            out.set(sim.rows([
              [sim.swatch("a") + "e₁", fmtVec(E1)],
              [sim.swatch("b") + "e₂", fmtVec(E2)],
              [sim.swatch("c") + "v", fmtVec(P)],
              ...rows,
              ["e₁ · e₂", fmt(V.dot(E1, E2))],
            ]) + `<hr>${!independent ? "Dependent vectors span only a line." : ortho && normal ? "<b class='ok'>Orthonormal:</b> a₁ = v·e₁ and a₂ = v·e₂." : ortho ? "<b>Orthogonal</b> but not unit length." : "A general (skewed) basis: the coordinates come from solving a 2×2 system."}`);
          });
        },
      },
      {
        title: "Gram–Schmidt step by step (3D)",
        help: String.raw`<p>Press <b>Step</b> to run the algorithm on three random vectors. Each step subtracts the
          projections onto the vectors already finished, then normalizes. At the end every dot product between
          different vectors is 0 and every length is 1.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view3d(stage, { height: 480, distance: 8, yaw: 0.8, pitch: 0.4 });
          const out = sim.readout(readout);
          let input, result, step;
          const steps = [
            "Start: three independent input vectors.",
            "e₁′ = e₁ / ‖e₁‖. The first vector only needs normalizing.",
            "e₂′ = e₂ − (e₂·e₁′)e₁′, then normalize. Now e₂′ ⟂ e₁′.",
            "e₃′ = e₃ − (e₃·e₁′)e₁′ − (e₃·e₂′)e₂′, then normalize. All three are orthonormal.",
          ];
          const randomize = () => {
            const r = () => (Math.random() * 2 - 1) * 2;
            do {
              input = [[r(), r() * 0.5 + 1, r()], [r(), r(), r()], [r(), r(), r()]];
            } while (Math.abs(V.dot(V.cross(input[0], input[1]), input[2])) < 1.5);
            result = input.map((x) => [...x]);
            step = 0;
            view.redraw();
          };
          const doStep = () => {
            if (step >= 3) return;
            let e = [...input[step]];
            for (let k = 0; k < step; k++) e = V.sub(e, V.scale(result[k], V.dot(e, result[k])));
            result[step] = V.norm(e);
            step++;
            view.redraw();
          };
          sim.buttons(controls, [
            { label: "Step ▶", onClick: doStep, primary: true },
            { label: "New vectors", onClick: randomize },
          ]);
          randomize();

          view.onDraw((v) => {
            v.grid({ size: 3, step: 1 });
            const cols = ["a", "b", "c"];
            for (let i = 0; i < 3; i++) {
              if (i < step) {
                v.arrow([0, 0, 0], input[i], { color: cols[i], alpha: 0.25, width: 2 });
                // the subtracted projection, drawn as a dashed path
                v.line(input[i], V.scale(result[i], V.dot(input[i], result[i])), { color: cols[i], dash: [4, 4], alpha: 0.5, width: 1 });
                v.arrow([0, 0, 0], V.scale(result[i], 1.8), { color: cols[i], width: 3.5, label: `e${"₁₂₃"[i]}′` });
              } else {
                v.arrow([0, 0, 0], input[i], { color: cols[i], width: 2.5, label: `e${"₁₂₃"[i]}` });
              }
            }
            const R = result;
            out.set(`<b>Step ${step} / 3</b><br>${steps[step]}<hr>` + sim.rows([
              ["e₁′ · e₂′", fmt(V.dot(R[0], R[1]), 3)],
              ["e₁′ · e₃′", fmt(V.dot(R[0], R[2]), 3)],
              ["e₂′ · e₃′", fmt(V.dot(R[1], R[2]), 3)],
              ["lengths", R.map((x) => fmt(V.len(x), 2)).join(", ")],
            ]));
          });
        },
      },
    ],

    cpp: [
      {
        title: "Linear independence test (3D)",
        formula: String.raw`(\mathbf e_1\times\mathbf e_2)\cdot\mathbf e_3 \ne 0 \iff \text{independent}`,
        code: String.raw`
          bool AreIndependent(const Vector3D& e1, const Vector3D& e2, const Vector3D& e3)
          {
              // The triple product is the volume of the box they span. It is zero when they are coplanar.
              return std::fabs(Dot(Cross(e1, e2), e3)) > 1.0e-6f;
          }
        `,
      },
      {
        title: "Coordinates in an orthonormal basis",
        formula: String.raw`a_i = \mathbf V\cdot\mathbf e_i \qquad \mathbf V = a_1\mathbf e_1 + a_2\mathbf e_2 + a_3\mathbf e_3`,
        code: String.raw`
          // e.g. express a world-space offset in a character's local (right, up, forward) axes
          Vector3D ToBasis(const Vector3D& v, const Vector3D& e1, const Vector3D& e2, const Vector3D& e3)
          {
              return Vector3D(Dot(v, e1), Dot(v, e2), Dot(v, e3));
          }

          Vector3D FromBasis(const Vector3D& a, const Vector3D& e1, const Vector3D& e2, const Vector3D& e3)
          {
              return e1 * a.x + e2 * a.y + e3 * a.z;
          }
        `,
      },
      {
        title: "Gram–Schmidt orthonormalization",
        formula: String.raw`\mathbf e_i' = \mathbf e_i - \sum_{k \lt i}(\mathbf e_i\cdot\mathbf e_k')\,\mathbf e_k' \quad\text{(with each } \mathbf e_k' \text{ already unit length)}`,
        code: String.raw`
          void GramSchmidt(Vector3D& e1, Vector3D& e2, Vector3D& e3)
          {
              e1 = Normalize(e1);

              e2 = e2 - e1 * Dot(e2, e1);                       // remove the e1 part
              e2 = Normalize(e2);

              e3 = e3 - e1 * Dot(e3, e1) - e2 * Dot(e3, e2);    // remove the e1 and e2 parts
              e3 = Normalize(e3);
          }
        `,
      },
      {
        title: "Camera basis from a look direction",
        formula: String.raw`\mathbf f = \widehat{\text{target}-\text{eye}},\quad \mathbf r = \widehat{\mathbf f\times\mathbf u_{\text{world}}},\quad \mathbf u = \mathbf r\times\mathbf f`,
        note: "<p>This is Gram–Schmidt plus a cross product. It is exactly what a <code>LookAt</code> function does before building the view matrix (Section 5.3).</p>",
        code: String.raw`
          struct CameraBasis { Vector3D right, up, forward; };

          CameraBasis MakeCameraBasis(const Point3D& eye, const Point3D& target,
                                      const Vector3D& worldUp = Vector3D(0.0f, 1.0f, 0.0f))
          {
              CameraBasis b;
              b.forward = Normalize(target - eye);
              b.right   = Normalize(Cross(b.forward, worldUp));   // fails if forward is parallel to worldUp
              b.up      = Cross(b.right, b.forward);              // already unit length and orthogonal
              return b;
          }
        `,
      },
    ],
  });
})();
