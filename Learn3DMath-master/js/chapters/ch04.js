// Chapter 4 - Transforms
(function () {
  "use strict";
  const { V, M, Q, fmt, fmtVec, rad, deg, clamp } = L3D.math;

  // ===========================================================================
  // Shared helpers for this chapter
  // ===========================================================================

  // A matrix (array of rows) as an aligned monospace block for a readout.
  function matHTML(m, digits = 2) {
    const cells = m.map((r) => r.map((x) => fmt(x, digits)));
    const w = Math.max(...cells.map((r) => Math.max(...r.map((s) => s.length))));
    return `<div class="eq">${cells.map((r) => "[ " + r.map((s) => s.padStart(w)).join("  ") + " ]").join("\n")}</div>`;
  }

  // Unit vector from a heading (in the xz-plane, from +x toward -z) and an elevation, both in degrees.
  function dirFromAngles(heading, elevation) {
    const h = rad(heading), e = rad(elevation);
    return [Math.cos(e) * Math.cos(h), Math.sin(e), -Math.cos(e) * Math.sin(h)];
  }

  // 2x2 matrix times a 2D vector.
  const mul2 = (m, p) => [m[0][0] * p[0] + m[0][1] * p[1], m[1][0] * p[0] + m[1][1] * p[1]];

  // An asymmetric letter F: a mirrored F is easy to spot.
  const F_SHAPE = [[0, 0], [0, 2], [1.3, 2], [1.3, 1.6], [0.4, 1.6], [0.4, 1.15], [1, 1.15], [1, 0.75], [0.4, 0.75], [0.4, 0]];

  // Points on a circle of radius r.
  function circlePts(r = 1, n = 72) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push([r * Math.cos((i / n) * 2 * Math.PI), r * Math.sin((i / n) * 2 * Math.PI)]);
    return pts;
  }

  // Faint lines of the transformed integer grid: the images of the lines x = k and y = k under a 2x2 matrix.
  function mappedGrid(v, m, style, n = 8) {
    const u = [m[0][0], m[1][0]], w = [m[0][1], m[1][1]];
    for (let k = -n; k <= n; k++) {
      if (V.len(u) > 1e-6) v.infiniteLine(V.scale(w, k), u, style);
      if (V.len(w) > 1e-6) v.infiniteLine(V.scale(u, k), w, style);
    }
  }

  // A small airplane made of boxes: nose along +x, up is +y, right wing (green) on +z, left wing (red) on -z.
  const box = (a, b) => L3D.shapes.box(a, b);
  const PLANE = [
    [box([-1.2, -0.2, -0.22], [0.9, 0.2, 0.22]), "a"],
    [box([0.9, -0.13, -0.14], [1.4, 0.11, 0.14]), "g"],
    [box([-0.3, -0.05, 0.22], [0.3, 0.05, 1.5]), "c"],
    [box([-0.3, -0.05, -1.5], [0.3, 0.05, -0.22]), "e"],
    [box([-1.2, 0.2, -0.05], [-0.8, 0.75, 0.05]), "b"],
  ];
  const NOSE = [1.4, 0, 0];

  // Draw the airplane through a point transform xf(p) -> p.
  function drawPlane(v, xf, style = {}) {
    for (const [mesh, fill] of PLANE) {
      v.mesh(mesh, { transform: xf, fill, alpha: style.alpha ?? 1, lit: true, cull: true });
    }
  }

  // Point transform from a 3x3 matrix and an optional translation.
  const xform = (m, t = [0, 0, 0]) => (p) => V.add(M.mulVec(m, p), t);

  // Quaternion helpers ([x, y, z, w], like L3D.math.Q).
  const q4len = (q) => Math.hypot(q[0], q[1], q[2], q[3]);
  const lerp4 = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  function safeNorm4(q, fallback) {
    const l = q4len(q);
    return l > 1e-9 ? q.map((x) => x / l) : fallback;
  }
  // Slerp WITHOUT the shortest-path sign flip, so the sim can show the long way around.
  function slerpRaw(a, b, t) {
    const c = clamp(Q.dot(a, b), -1, 1);
    const th = Math.acos(c), s = Math.sin(th);
    if (s < 1e-5) return safeNorm4(lerp4(a, b, t), a);
    const ka = Math.sin((1 - t) * th) / s, kb = Math.sin(t * th) / s;
    return a.map((x, i) => x * ka + b[i] * kb);
  }
  // 4D angle between quaternion q and the unit quaternion u.
  const qAngle = (q, u) => Math.acos(clamp(Q.dot(q, u) / (q4len(q) || 1), -1, 1));
  const qText = (q, d = 3) => `w ${fmt(q[3], d)}, (${fmt(q[0], d)}, ${fmt(q[1], d)}, ${fmt(q[2], d)})`;

  // ===========================================================================
  // 4.1 Linear Transformations
  // ===========================================================================
  L3D.topic({
    id: "4.1",
    summary: "A 3×3 matrix converts coordinates from one frame to another, and its columns are where the axes go. Orthogonal matrices preserve lengths and angles, and the sign of the determinant tells you whether handedness flips.",

    lesson: String.raw`
      <p>A game engine moves vectors between coordinate systems all the time. A model's vertices are authored in
      <em>object space</em>, the level places the model in <em>world space</em>, and the renderer needs everything in
      <em>camera space</em>. This chapter covers the transforms that do these conversions: scales, rotations,
      translations, and combinations of them.</p>

      <p>Suppose a point \(\mathbf P\) has coordinates \((x, y, z)\) in a coordinate system \(C\), and a second system
      \(C'\) gives the same point coordinates \((x', y', z')\) that are linear functions of the old ones:
      \[ x' = U_1x + V_1y + W_1z + T_1,\quad y' = U_2x + V_2y + W_2z + T_2,\quad z' = U_3x + V_3y + W_3z + T_3. \]
      In matrix form this is</p>
      <div class="formula">
        \[ \begin{bmatrix} x' \\ y' \\ z' \end{bmatrix} =
           \begin{bmatrix} U_1 & V_1 & W_1 \\ U_2 & V_2 & W_2 \\ U_3 & V_3 & W_3 \end{bmatrix}
           \begin{bmatrix} x \\ y \\ z \end{bmatrix} +
           \begin{bmatrix} T_1 \\ T_2 \\ T_3 \end{bmatrix}
           \qquad\text{or}\qquad \mathbf P' = \mathbf M\mathbf P + \mathbf T . \]
      </div>
      <p>\(\mathbf T\) is the offset between the two origins. The matrix whose columns are \(\mathbf U, \mathbf V, \mathbf W\)
      describes how the axes are reoriented, and possibly stretched. If \(\mathbf M\) is invertible you can go back the
      other way: \(\mathbf P = \mathbf M^{-1}(\mathbf P' - \mathbf T)\).</p>

      <p>For now set \(\mathbf T = \mathbf 0\). Translation gets its own treatment in Section 4.4. Multiplying out
      \(\mathbf M\mathbf P\) shows what the columns mean:
      \[ \mathbf M\mathbf P = x\,\mathbf U + y\,\mathbf V + z\,\mathbf W . \]
      The old coordinates say how far to walk along each of the <em>new</em> axis directions.</p>

      <div class="key">The columns of a transformation matrix are the images of the basis vectors:
      \(\mathbf M\langle1,0,0\rangle = \mathbf U\), \(\mathbf M\langle0,1,0\rangle = \mathbf V\),
      \(\mathbf M\langle0,0,1\rangle = \mathbf W\). To build a transform, decide where each axis should go and write
      those three vectors into the columns.</div>

      <p>Transforms <strong>concatenate</strong>. If \(\mathbf M_1\) takes object space to world space and \(\mathbf M_2\)
      takes world space to camera space, then \(\mathbf M_2(\mathbf M_1\mathbf P) = (\mathbf M_2\mathbf M_1)\mathbf P\).
      Multiply the two matrices once per object, then apply the single product to every vertex. Watch the order: with
      column vectors the transform that is applied first sits on the <em>right</em>.</p>

      <div class="game">An object's orientation is usually stored as a 3×3 matrix whose columns are its local axes
      (right, up, forward) written in world coordinates. Reading a column tells you which way a character is facing,
      with no extra math.</div>

      <h2 data-sub="4.1.1">Orthogonal Matrices</h2>
      <p>Most 3×3 matrices in graphics are <strong>orthogonal</strong>. Definition 4.1: an invertible \(n\times n\) matrix
      \(\mathbf M\) is orthogonal if and only if
      \[ \mathbf M^{-1} = \mathbf M^{\mathsf T}. \]
      Theorem 4.2 gives an easy way to recognize one: <em>if the columns of \(\mathbf M\) form an orthonormal set, then
      \(\mathbf M\) is orthogonal</em>. The proof is one line. Entry \((i, j)\) of \(\mathbf M^{\mathsf T}\mathbf M\) is the
      dot product of column \(i\) with column \(j\). For orthonormal columns that is 1 on the diagonal and 0 everywhere
      else, so \(\mathbf M^{\mathsf T}\mathbf M = \mathbf I\).</p>

      <p>Theorem 4.3: an orthogonal matrix <strong>preserves lengths and angles</strong>. For any vectors
      \(\mathbf P_1, \mathbf P_2\),
      \[ (\mathbf M\mathbf P_1)\cdot(\mathbf M\mathbf P_2) = \mathbf P_1^{\mathsf T}\mathbf M^{\mathsf T}\mathbf M\mathbf P_2
         = \mathbf P_1^{\mathsf T}\mathbf P_2 = \mathbf P_1\cdot\mathbf P_2 . \]
      Dot products don't change, so neither do lengths (\(\lVert\mathbf P\rVert^2 = \mathbf P\cdot\mathbf P\)) or angles
      (which come from \(\cos\alpha\)). A transform that keeps every length and angle can only <em>turn</em> things or
      <em>mirror</em> them, so orthogonal matrices represent rotations and reflections. For example,
      \[ \begin{bmatrix} 1 & 0 & 0 \\ 0 & 1 & 0 \\ 0 & 0 & -1 \end{bmatrix} \]
      reflects the z coordinate through the x-y plane.</p>

      <div class="game">Inverting an orthogonal matrix costs nothing: transpose it. A camera or bone whose matrix holds
      only a rotation can be inverted by swapping rows and columns instead of running a general inverse.</div>

      <div class="warn">Orthogonality decays in floating point. Multiply rotations together frame after frame and the
      columns slowly drift away from unit length and from perpendicular. The transpose is then no longer the exact
      inverse, and objects start to shear. Re-orthonormalize every so often with Gram–Schmidt (Section 2.4), or store the
      orientation as a quaternion (Section 4.6) and renormalize that.</div>

      <h2 data-sub="4.1.2">Handedness</h2>
      <p>A basis \(\mathbf V_1, \mathbf V_2, \mathbf V_3\) of 3D space has a <strong>handedness</strong>. It is
      right-handed when
      \[ (\mathbf V_1\times\mathbf V_2)\cdot\mathbf V_3 \gt 0 \]
      and left-handed when this triple product is negative. In words: the cross product of the first two vectors (by the
      right-hand rule) makes an acute angle with the third. For an orthonormal right-handed basis,
      \(\mathbf V_1\times\mathbf V_2 = \mathbf V_3\) exactly, just like \(\mathbf i\times\mathbf j = \mathbf k\).</p>
      <p>A reflection reverses handedness. A second reflection restores it, and in fact an even number of reflections is
      always equivalent to a rotation. So any sequence of reflections boils down to a rotation followed by at most one
      reflection.</p>
      <p>The triple product of the columns of \(\mathbf M\) is its <strong>determinant</strong>, so you can read
      handedness straight off the matrix:</p>
      <table>
        <tr><th>\(\det\mathbf M\)</th><th>meaning</th></tr>
        <tr><td>\(\gt 0\)</td><td>preserves handedness (no reflection)</td></tr>
        <tr><td>\(\lt 0\)</td><td>contains a reflection, so right-handed bases become left-handed</td></tr>
        <tr><td>\(+1\), orthogonal</td><td>a pure rotation</td></tr>
        <tr><td>\(-1\), orthogonal</td><td>a rotation followed by a reflection</td></tr>
      </table>
      <p>An orthogonal matrix can only have determinant \(\pm1\), because
      \((\det\mathbf M)^2 = \det(\mathbf M^{\mathsf T}\mathbf M) = \det\mathbf I = 1\).</p>

      <div class="game">A reflection also reverses the <em>winding</em> of every triangle. A triangle that was
      counterclockwise on screen becomes clockwise, so back-face culling throws away the wrong side and the mesh renders
      inside-out. When an artist mirrors a level piece with a scale of −1, the engine notices \(\det\mathbf M \lt 0\) and
      switches the front-face winding for that object. The second simulation shows the bug and the fix.</div>

      <div class="note">Right-handed and left-handed engine conventions differ by exactly one reflection, usually
      \(z \mapsto -z\). Converting assets from one to the other means applying \(\operatorname{diag}(1, 1, -1)\)
      <em>and</em> reversing the triangle winding.</div>

      <p><a class="btn goto-sim" href="#/4.1/sim">Try it: drag the columns of a matrix →</a></p>
    `,

    keyFormulas: [
      ["Coordinate transform", String.raw`\mathbf P' = \mathbf M\mathbf P + \mathbf T`],
      ["Columns are the images of the axes", String.raw`\mathbf M = [\,\mathbf U\;\mathbf V\;\mathbf W\,],\quad \mathbf M\mathbf P = x\mathbf U + y\mathbf V + z\mathbf W`],
      ["Orthogonal matrix", String.raw`\mathbf M^{-1} = \mathbf M^{\mathsf T}`],
      ["Orthogonal matrices preserve dot products", String.raw`(\mathbf M\mathbf P_1)\cdot(\mathbf M\mathbf P_2) = \mathbf P_1\cdot\mathbf P_2`],
      ["Handedness", String.raw`(\mathbf V_1\times\mathbf V_2)\cdot\mathbf V_3 = \det[\,\mathbf V_1\;\mathbf V_2\;\mathbf V_3\,] \gt 0 \;\Rightarrow\; \text{right-handed}`],
    ],

    exercises: [
      { q: "Write the matrix that sends the x axis to the y axis, the y axis to −x, and leaves z alone. Is it orthogonal? What is its determinant?",
        a: String.raw`The columns are the images of the axes: \(\langle0,1,0\rangle\), \(\langle-1,0,0\rangle\), \(\langle0,0,1\rangle\), so
          \(\mathbf M = \begin{bmatrix}0&-1&0\\1&0&0\\0&0&1\end{bmatrix}\). The columns are orthonormal, so it is orthogonal, and
          \(\det\mathbf M = +1\). It is the 90° rotation about z.` },
      { q: String.raw`Is the basis \(\langle0,1,0\rangle, \langle1,0,0\rangle, \langle0,0,1\rangle\) right-handed?`,
        a: String.raw`\(\langle0,1,0\rangle\times\langle1,0,0\rangle = \langle0,0,-1\rangle\), and its dot product with \(\langle0,0,1\rangle\) is \(-1\).
          It is left-handed: swapping x and y is a reflection (through the plane \(x = y\)).` },
      { q: String.raw`Invert \(\mathbf M = \begin{bmatrix}0.6&-0.8&0\\0.8&0.6&0\\0&0&1\end{bmatrix}\) without Gaussian elimination.`,
        a: String.raw`The columns are orthonormal (\(0.6^2 + 0.8^2 = 1\) and \(0.6\cdot(-0.8) + 0.8\cdot0.6 = 0\)), so
          \(\mathbf M^{-1} = \mathbf M^{\mathsf T} = \begin{bmatrix}0.6&0.8&0\\-0.8&0.6&0\\0&0&1\end{bmatrix}\).` },
      { q: "Why can an orthogonal matrix only have determinant +1 or −1?",
        a: String.raw`\(\mathbf M^{\mathsf T}\mathbf M = \mathbf I\), and determinants multiply, so \(\det(\mathbf M^{\mathsf T})\det(\mathbf M) = (\det\mathbf M)^2 = 1\).` },
      { q: "A level designer places a mesh with scale (−1, 1, 1) and then rotates it 90° about y. Does the renderer need to flip the cull mode? What about scale (−1, −1, 1)?",
        a: String.raw`First case: \(\det = (-1)(1)(1)\cdot 1 = -1 \lt 0\), so yes, the winding is reversed. Second case: \(\det = (-1)(-1)(1) = +1\).
          Two reflections make a rotation (180° about z), so no fix is needed.` },
    ],

    sims: [
      {
        title: "Columns are where the axes go",
        help: String.raw`<p>Drag the tips of \(\mathbf U\) and \(\mathbf V\). They are the columns of the 2×2 matrix
          \(\mathbf M\), the images of the x and y axes, and the letter F, the grid, and the test vector \(\mathbf p\) are
          carried along with them. Try the orthonormal pair \(\mathbf U = (0.6, 0.8)\), \(\mathbf V = (-0.8, 0.6)\): lengths stop
          changing. Then drag \(\mathbf V\) to the clockwise side of \(\mathbf U\). The determinant turns negative and the F
          comes out mirrored.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 4, height: 460 });
          const out = sim.readout(readout);
          const U = view.handle([1.4, 0.5], { color: "a", label: "U", snap: 0.1 });
          const W = view.handle([-0.4, 1.1], { color: "b", label: "V", snap: 0.1 });
          const P = view.handle([-1.5, 1.2], { color: "muted", label: "p", snap: 0.1 });
          const set = (u, w) => { U.set(u); W.set(w); };
          const c30 = Math.cos(rad(30)), s30 = Math.sin(rad(30));
          sim.buttons(controls, [
            { label: "Identity", onClick: () => set([1, 0], [0, 1]) },
            { label: "Rotate 30°", onClick: () => set([c30, s30], [-s30, c30]) },
            { label: "Mirror x", onClick: () => set([-1, 0], [0, 1]) },
            { label: "Shear", onClick: () => set([1, 0], [0.8, 1]) },
            { label: "Scale", onClick: () => set([1.8, 0], [0, 0.6]) },
          ]);
          sim.buttons(controls, [{
            label: "Orthonormalize (Gram–Schmidt)",
            onClick: () => {
              const u = V.norm(U.pos);
              if (V.len(u) === 0) return;
              let w = V.sub(W.pos, V.scale(u, V.dot(W.pos, u)));
              if (V.len(w) < 1e-6) w = V.perp2(u);
              set(u, V.norm(w));
            },
          }]);
          const showOrig = sim.checkbox(controls, { label: "Show the original F and unit circle", value: true, onChange: () => view.redraw() });
          const showGrid = sim.checkbox(controls, { label: "Show the transformed grid", value: true, onChange: () => view.redraw() });
          const circle = circlePts(1);

          view.onDraw((v) => {
            const m = [[U.pos[0], W.pos[0]], [U.pos[1], W.pos[1]]];
            const det = M.det(m);
            v.grid({ step: 1 });
            if (showGrid.value) mappedGrid(v, m, { color: "d", alpha: 0.16, width: 1 });
            v.axes();
            if (showOrig.value) {
              v.polygon(F_SHAPE, { color: "muted", dash: [5, 4], width: 1.5 });
              v.polyline(circle, { color: "muted", dash: [4, 4], width: 1 });
            }
            v.polyline(circle.map((p) => mul2(m, p)), { color: "d", width: 1.5, alpha: 0.8 });
            const col = det >= 0 ? "c" : "e";
            v.polygon(F_SHAPE.map((p) => mul2(m, p)), { fill: col, fillAlpha: 0.3, color: col, width: 2 });
            const MP = mul2(m, P.pos);
            v.arrow([0, 0], P.pos, { color: "muted", width: 2 });
            v.arrow([0, 0], MP, { color: "g", width: 3, label: "Mp" });
            v.arrow([0, 0], U.pos, { color: "a", width: 3 });
            v.arrow([0, 0], W.pos, { color: "b", width: 3 });

            const uu = V.dot(U.pos, U.pos), ww = V.dot(W.pos, W.pos), uw = V.dot(U.pos, W.pos);
            const ortho = Math.abs(uu - 1) < 0.02 && Math.abs(ww - 1) < 0.02 && Math.abs(uw) < 0.02;
            const kind = Math.abs(det) < 1e-6
              ? "<b class='bad'>Singular:</b> the plane collapses onto a line, so there is no inverse."
              : ortho
                ? (det > 0
                  ? "<b class='ok'>Orthogonal, det = +1:</b> a pure rotation. Lengths and angles are preserved."
                  : "<b class='ok'>Orthogonal</b> but <b class='bad'>det = −1</b>: a rotation plus a reflection. Lengths are preserved, but the F is mirrored.")
                : det > 0
                  ? "Not orthogonal: lengths and angles change, but handedness is kept (det &gt; 0)."
                  : "Not orthogonal, and <b class='bad'>det &lt; 0</b>: the F is mirrored.";
            out.set(
              "<b>M = [U V]</b>" + matHTML(m) +
              "<b>MᵀM</b> (the identity exactly when M is orthogonal)" + matHTML([[uu, uw], [uw, ww]]) +
              sim.rows([
                ["det M", fmt(det), det < 0 ? "bad" : ""],
                ["‖p‖", fmt(V.len(P.pos))],
                [sim.swatch("g") + "‖Mp‖", fmt(V.len(MP))],
              ]) + `<hr>${kind}`
            );
          });
        },
      },
      {
        title: "Handedness, reflections, and culling",
        help: String.raw`<p>The arrows are the columns \(\mathbf V_1, \mathbf V_2, \mathbf V_3\) of \(\mathbf M = \mathbf R\,\mathbf S\):
          optional mirrors \(\mathbf S\) followed by a rotation \(\mathbf R\). The dashed purple arrow is \(\mathbf V_1\times\mathbf V_2\).
          Tick one mirror: \(\mathbf V_1\times\mathbf V_2\) now points <em>against</em> \(\mathbf V_3\), the determinant is −1, and the
          pyramid is drawn inside-out because the winding of its triangles flipped. Tick a second mirror and everything is
          back to normal, because two reflections make a rotation. Drag the view to orbit.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view3d(stage, { height: 480, distance: 8.5, yaw: 0.7, pitch: 0.42 });
          const out = sim.readout(readout);
          const redraw = () => view.redraw();
          const gr = sim.group(controls, "Rotation R");
          const heading = sim.slider(gr, { label: "Turn about y", min: -180, max: 180, step: 1, value: 25, unit: "°", onInput: redraw });
          const tilt = sim.slider(gr, { label: "Tilt about x", min: -90, max: 90, step: 1, value: 0, unit: "°", onInput: redraw });
          const gs = sim.group(controls, "Mirrors S");
          const mx = sim.checkbox(gs, { label: "Mirror x (negate column 1)", value: false, onChange: redraw });
          const my = sim.checkbox(gs, { label: "Mirror y (negate column 2)", value: false, onChange: redraw });
          const mz = sim.checkbox(gs, { label: "Mirror z (negate column 3)", value: false, onChange: redraw });
          const gc = sim.group(controls, "Rendering");
          const fix = sim.checkbox(gc, { label: "Reverse the winding when det M < 0", value: false, onChange: redraw });

          const pyr = L3D.shapes.pyramid(0.55, 1.1);
          const pyrMesh = { vertices: pyr.vertices.map((p) => V.add(p, [1.2, 0, 0.9])), faces: pyr.faces };
          const pyrFixed = { vertices: pyrMesh.vertices, faces: pyrMesh.faces.map((f) => [...f].reverse()) };
          const faceColors = ["g", "a", "b", "c", "d"];   // base is gold

          view.onDraw((v) => {
            const R = M.mul(M.rotY(rad(heading.value)), M.rotX(rad(tilt.value)));
            const S = M.scale3(mx.value ? -1 : 1, my.value ? -1 : 1, mz.value ? -1 : 1);
            const m = M.mul(R, S);
            const det = M.det(m);
            const V1 = M.col(m, 0), V2 = M.col(m, 1), V3 = M.col(m, 2);
            const c12 = V.cross(V1, V2);
            const triple = V.dot(c12, V3);
            const flips = (mx.value ? 1 : 0) + (my.value ? 1 : 0) + (mz.value ? 1 : 0);

            v.grid({ size: 3, step: 1 });
            v.mesh(fix.value && det < 0 ? pyrFixed : pyrMesh, { transform: xform(m), faceColors, lit: true, cull: true });
            v.arrow([0, 0, 0], V.scale(V1, 2), { color: "e", width: 3.5, label: "V₁" });
            v.arrow([0, 0, 0], V.scale(V2, 2), { color: "c", width: 3.5, label: "V₂" });
            v.arrow([0, 0, 0], V.scale(V3, 2), { color: "a", width: 3.5, label: "V₃" });
            v.arrow([0, 0, 0], V.scale(c12, 1.4), { color: "d", width: 2, dash: [6, 4], label: "V₁×V₂" });

            const right = triple > 0;
            out.set(sim.rows([
              ["det M", fmt(det), det < 0 ? "bad" : "ok"],
              ["(V₁ × V₂) · V₃", fmt(triple), right ? "ok" : "bad"],
              ["reflections", String(flips)],
              ["basis", right ? "right-handed" : "left-handed", right ? "ok" : "bad"],
            ]) + "<hr>" + (det > 0
              ? (flips === 2
                ? "Two reflections cancel out: together they are a 180° rotation. Handedness and triangle winding are preserved."
                : "No net reflection: handedness and triangle winding are preserved.")
              : fix.value
                ? "det M &lt; 0, so every face's vertex order was reversed before drawing. The pyramid renders correctly again."
                : "<b class='bad'>det M &lt; 0:</b> the winding flipped, so back-face culling keeps the wrong faces. You are looking at the inside of the pyramid, and its gold base shows through. Tick the fix."));
          });
        },
      },
    ],

    cpp: [
      {
        title: "Changing coordinates",
        formula: String.raw`\mathbf P' = \mathbf M\mathbf P + \mathbf T,\quad \mathbf M = [\,\mathbf U\;\mathbf V\;\mathbf W\,] \qquad \mathbf P = \mathbf M^{-1}(\mathbf P' - \mathbf T)`,
        code: String.raw`
          // Build the matrix whose columns are the images of the x, y, and z axes.
          Matrix3D MakeFromColumns(const Vector3D& u, const Vector3D& v, const Vector3D& w)
          {
              return Matrix3D(u.x, v.x, w.x,
                              u.y, v.y, w.y,
                              u.z, v.z, w.z);
          }

          // P' = M P + T            (Equation 4.2)
          Point3D TransformToParent(const Matrix3D& m, const Vector3D& t, const Point3D& p)
          {
              return m * p + t;     // = p.x * U + p.y * V + p.z * W + T
          }

          // P = M^-1 (P' - T)       (Equation 4.3)
          Point3D TransformToLocal(const Matrix3D& m, const Vector3D& t, const Point3D& pPrime)
          {
              return Inverse(m) * (pPrime - t);
          }
        `,
      },
      {
        title: "Inverting an orthogonal matrix",
        formula: String.raw`\mathbf M^{-1} = \mathbf M^{\mathsf T} \iff (\mathbf M^{\mathsf T}\mathbf M)_{ij} = \mathbf V_i\cdot\mathbf V_j = \delta_{ij}`,
        code: String.raw`
          // For a rotation (orthonormal columns) the inverse is just the transpose.
          Vector3D WorldToLocal(const Matrix3D& rotation, const Vector3D& worldDir)
          {
              return Transpose(rotation) * worldDir;
          }

          // Theorem 4.2: M is orthogonal when its columns are orthonormal.
          bool IsOrthogonal(const Matrix3D& m, float eps = 1.0e-4f)
          {
              for (int i = 0; i < 3; ++i)
              {
                  for (int j = 0; j < 3; ++j)
                  {
                      float target = (i == j) ? 1.0f : 0.0f;          // Kronecker delta
                      if (std::fabs(Dot(m[i], m[j]) - target) > eps) return false;
                  }
              }
              return true;
          }
        `,
      },
      {
        title: "Reflection through a plane",
        formula: String.raw`\mathbf P' = \mathbf P - 2(\mathbf N\cdot\mathbf P)\mathbf N \quad\Rightarrow\quad \mathbf M = \mathbf I - 2\,\mathbf N\mathbf N^{\mathsf T}`,
        note: "<p>This generalizes Equation (4.8). <code>MakeReflection(Vector3D(0, 0, 1))</code> gives diag(1, 1, −1). The result is orthogonal with determinant −1.</p>",
        code: String.raw`
          // Mirror across the plane through the origin with unit normal n.
          Matrix3D MakeReflection(const Vector3D& n)
          {
              float x = -2.0f * n.x, y = -2.0f * n.y, z = -2.0f * n.z;
              return Matrix3D(1.0f + x * n.x,        x * n.y,        x * n.z,
                                     y * n.x, 1.0f + y * n.y,        y * n.z,
                                     z * n.x,        z * n.y, 1.0f + z * n.z);
          }
        `,
      },
      {
        title: "Handedness test and the winding fix",
        formula: String.raw`(\mathbf V_1\times\mathbf V_2)\cdot\mathbf V_3 = \det\mathbf M \qquad \det\mathbf M \lt 0 \Rightarrow \text{reflection}`,
        code: String.raw`
          bool IsRightHanded(const Vector3D& v1, const Vector3D& v2, const Vector3D& v3)
          {
              return Dot(Cross(v1, v2), v3) > 0.0f;      // (V1 x V2) . V3 > 0
          }

          enum class FrontFace { CounterClockwise, Clockwise };

          // A mirrored object turns counterclockwise triangles clockwise on screen,
          // so the renderer must swap which winding counts as the front.
          FrontFace ChooseFrontFace(const Matrix3D& objectToWorld)
          {
              return (Determinant(objectToWorld) < 0.0f) ? FrontFace::Clockwise
                                                         : FrontFace::CounterClockwise;
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 4.2 Scaling Transforms
  // ===========================================================================
  L3D.topic({
    id: "4.2",
    summary: "Uniform and nonuniform scales, scaling along arbitrary axes by changing coordinates, and the one-direction scale I + (k − 1)AAᵀ.",

    lesson: String.raw`
      <p>The simplest transform multiplies every coordinate by the same factor \(a\):
      \[ \mathbf P' = a\mathbf P = \begin{bmatrix} a & 0 & 0 \\ 0 & a & 0 \\ 0 & 0 & a \end{bmatrix}\begin{bmatrix} P_x \\ P_y \\ P_z \end{bmatrix}. \]
      This is a <strong>uniform scale</strong>. It changes sizes but not shapes: angles survive, and every length is
      multiplied by \(|a|\).</p>

      <p>Putting different values on the diagonal scales each axis by its own amount. This is a
      <strong>nonuniform scale</strong>:</p>
      <div class="formula">\[ \mathbf P' = \begin{bmatrix} a & 0 & 0 \\ 0 & b & 0 \\ 0 & 0 & c \end{bmatrix}\mathbf P \]</div>
      <p>Its determinant is \(abc\), and that is exactly the factor by which volumes change: a unit cube becomes an
      \(a\times b\times c\) box. A negative factor mirrors that axis and flips the sign of the determinant
      (Section 4.1.2). A zero factor flattens space onto a plane, and then the matrix has no inverse.</p>

      <h2>Scaling along arbitrary axes</h2>
      <p>To scale by \(a\), \(b\), \(c\) along three other axes \(\mathbf U, \mathbf V, \mathbf W\), change coordinates.
      Convert into the \((\mathbf U, \mathbf V, \mathbf W)\) system, where the job is an ordinary diagonal scale, scale
      there, and convert back:</p>
      <div class="formula">
        \[ \mathbf P' = \begin{bmatrix} U_x & V_x & W_x \\ U_y & V_y & W_y \\ U_z & V_z & W_z \end{bmatrix}
           \begin{bmatrix} a & 0 & 0 \\ 0 & b & 0 \\ 0 & 0 & c \end{bmatrix}
           \begin{bmatrix} U_x & V_x & W_x \\ U_y & V_y & W_y \\ U_z & V_z & W_z \end{bmatrix}^{-1}\mathbf P \]
      </div>
      <p>Read it right to left. The inverse expresses \(\mathbf P\) in \((\mathbf U, \mathbf V, \mathbf W)\) coordinates,
      the diagonal matrix scales them, and the left matrix maps the result back. When the axes are orthonormal, the
      inverse is just the transpose (Section 4.1.1). This is the diagonalization \(\mathbf B\mathbf D\mathbf B^{-1}\) from
      Section 3.6 read in reverse: \(\mathbf U, \mathbf V, \mathbf W\) are the eigenvectors of the scale, and \(a, b, c\)
      are its eigenvalues.</p>

      <h3>Scaling along one direction</h3>
      <p>A very common special case scales by \(k\) along a single unit direction \(\mathbf A\) and leaves everything
      perpendicular to it alone. Split \(\mathbf P\) into its part along \(\mathbf A\) and the rest (Section 2.2):
      \(\mathbf P = (\mathbf A\cdot\mathbf P)\mathbf A + [\mathbf P - (\mathbf A\cdot\mathbf P)\mathbf A]\). Scale only
      the first part:
      \[ \mathbf P' = k(\mathbf A\cdot\mathbf P)\mathbf A + \mathbf P - (\mathbf A\cdot\mathbf P)\mathbf A
         = \mathbf P + (k - 1)(\mathbf A\cdot\mathbf P)\mathbf A . \]
      Since \((\mathbf A\cdot\mathbf P)\mathbf A = \mathbf A\mathbf A^{\mathsf T}\mathbf P\), the matrix is</p>
      <div class="formula">\[ \mathbf S_{\mathbf A}(k) = \mathbf I + (k - 1)\,\mathbf A\mathbf A^{\mathsf T}
         = \begin{bmatrix} 1 + (k-1)A_x^2 & (k-1)A_xA_y & (k-1)A_xA_z \\ (k-1)A_xA_y & 1 + (k-1)A_y^2 & (k-1)A_yA_z \\ (k-1)A_xA_z & (k-1)A_yA_z & 1 + (k-1)A_z^2 \end{bmatrix} \]</div>
      <p>Three values of \(k\) are worth remembering:</p>
      <ul>
        <li>\(k = 1\): the identity.</li>
        <li>\(k = 0\): \(\mathbf I - \mathbf A\mathbf A^{\mathsf T}\), the projection onto the plane perpendicular to
          \(\mathbf A\). Everything is flattened onto that plane, like a planar shadow.</li>
        <li>\(k = -1\): \(\mathbf I - 2\mathbf A\mathbf A^{\mathsf T}\), the reflection through that plane (Section 4.1).</li>
      </ul>

      <div class="game"><b>Squash and stretch.</b> A bouncing ball looks alive when it stretches along its velocity and
      thins out across it. Scale by \(k\) along the velocity and by \(1/\sqrt k\) in the two perpendicular directions.
      The determinant is \(k\cdot(1/\sqrt k)^2 = 1\), so the volume stays constant and the ball doesn't seem to grow or
      shrink.</div>

      <div class="warn">A nonuniform scale is <em>not</em> orthogonal, because it changes angles. Positions and tangent
      vectors still transform correctly, but surface normals don't; they need the inverse transpose (Section 4.5).
      Order matters too once rotation is involved. \(\mathbf R\mathbf S\) scales along the object's own axes and then
      rotates. \(\mathbf S\mathbf R\) scales along the world axes after rotating, and that shears the object. Many physics
      engines refuse nonuniform scale on colliders for these reasons.</div>

      <p><a class="btn goto-sim" href="#/4.2/sim">Try it: scale along a direction you choose →</a></p>
    `,

    keyFormulas: [
      ["Uniform scale", String.raw`\mathbf P' = a\mathbf P`],
      ["Nonuniform scale", String.raw`\mathbf P' = \operatorname{diag}(a, b, c)\,\mathbf P,\qquad \det = abc`],
      ["Scale along axes U, V, W", String.raw`\mathbf P' = [\,\mathbf U\;\mathbf V\;\mathbf W\,]\operatorname{diag}(a,b,c)[\,\mathbf U\;\mathbf V\;\mathbf W\,]^{-1}\mathbf P`],
      ["Scale by k along unit A", String.raw`\mathbf P' = \mathbf P + (k-1)(\mathbf A\cdot\mathbf P)\mathbf A = [\mathbf I + (k-1)\mathbf A\mathbf A^{\mathsf T}]\,\mathbf P`],
    ],

    exercises: [
      { q: String.raw`Find the matrix that scales by 3 along \(\mathbf A = \tfrac{1}{\sqrt2}\langle 1, 1, 0\rangle\).`,
        a: String.raw`\(\mathbf A\mathbf A^{\mathsf T} = \begin{bmatrix}\frac12&\frac12&0\\\frac12&\frac12&0\\0&0&0\end{bmatrix}\), so
          \(\mathbf I + 2\mathbf A\mathbf A^{\mathsf T} = \begin{bmatrix}2&1&0\\1&2&0\\0&0&1\end{bmatrix}\). Check:
          \(\langle1,1,0\rangle \mapsto \langle3,3,0\rangle\) is tripled, and \(\langle1,-1,0\rangle \mapsto \langle1,-1,0\rangle\) is unchanged.` },
      { q: "A unit cube is scaled by diag(2, 0.5, 3). What is its new volume?",
        a: String.raw`The determinant: \(2\cdot0.5\cdot3 = 3\).` },
      { q: String.raw`What does a scale of \(k = -1\) along a unit direction \(\mathbf A\) do?`,
        a: String.raw`\(\mathbf I - 2\mathbf A\mathbf A^{\mathsf T}\) mirrors space through the plane perpendicular to \(\mathbf A\). It is orthogonal with
          determinant −1, the reflection from Section 4.1.` },
      { q: "A squash-and-stretch effect stretches a ball by 1.44 along its velocity. How much must it shrink across, to keep its volume?",
        a: String.raw`Each perpendicular factor is \(1/\sqrt{1.44} = 1/1.2 \approx 0.833\). Check: \(1.44 \cdot 0.833^2 \approx 1\).` },
      { q: String.raw`Why can't the scale with \(k = 0\) be undone?`,
        a: String.raw`Its determinant is 0. All points that differ only along \(\mathbf A\) land on the same point of the plane, so the lost
          \(\mathbf A\)-component can't be recovered.` },
    ],

    sims: [
      {
        title: "Scale along any direction",
        help: String.raw`<p>Drag the purple handle to set the unit direction \(\mathbf A\) and use the slider for \(k\). Only the part of
          each point along \(\mathbf A\) is scaled: \(\mathbf p' = \mathbf p + (k-1)(\mathbf A\cdot\mathbf p)\mathbf A\). So points slide
          parallel to \(\mathbf A\), and the perpendicular line through the origin never moves. Try \(k = 0\) (a projection)
          and \(k = -1\) (a mirror). “Preserve area” also scales the perpendicular direction by \(1/k\), which is the 2D version of
          squash and stretch.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 4.5, height: 460 });
          const out = sim.readout(readout);
          const R = 3;
          const aH = view.handle([R * Math.cos(rad(30)), R * Math.sin(rad(30))], {
            color: "d", label: "A",
            constrain: (p) => (V.len(p) > 0.1 ? V.scale(V.norm(p), R) : [R, 0]),
          });
          const P = view.handle([-1, 2.2], { color: "a", label: "p", snap: 0.1 });
          const redraw = () => view.redraw();
          const k = sim.slider(controls, { label: "Scale factor k (along A)", min: -1.5, max: 3, step: 0.05, value: 2, onInput: redraw });
          sim.buttons(controls, [
            { label: "k = 0", onClick: () => { k.value = 0; redraw(); } },
            { label: "k = −1", onClick: () => { k.value = -1; redraw(); } },
            { label: "k = 2", onClick: () => { k.value = 2; redraw(); } },
          ]);
          const keep = sim.checkbox(controls, { label: "Preserve area (scale across A by 1/k)", value: false, onChange: redraw });
          const circle = circlePts(1.5);
          const F = F_SHAPE.map((p) => V.add(p, [1.2, -2.6]));

          view.onDraw((v) => {
            const A = V.norm(aH.pos), N = V.perp2(A);
            const kk = k.value;
            let s = 1;   // factor across A
            if (keep.value) s = Math.abs(kk) < 0.1 ? (kk < 0 ? -10 : 10) : 1 / kk;
            // M = k A A^T + s (I - A A^T) = s I + (k - s) A A^T
            const m = [
              [s + (kk - s) * A[0] * A[0], (kk - s) * A[0] * A[1]],
              [(kk - s) * A[0] * A[1], s + (kk - s) * A[1] * A[1]],
            ];
            v.grid({ step: 1 });
            mappedGrid(v, m, { color: "d", alpha: 0.12, width: 1 });
            v.axes();
            v.infiniteLine([0, 0], A, { color: "d", alpha: 0.6, dash: [6, 5], width: 1.5 });
            v.infiniteLine([0, 0], N, { color: "muted", alpha: 0.6, width: 1 });
            v.polyline(circle, { color: "muted", dash: [4, 4], width: 1 });
            v.polygon(circle.map((p) => mul2(m, p)), { fill: "c", fillAlpha: 0.12, color: "c", width: 2 });
            v.polygon(F, { color: "muted", dash: [4, 4], width: 1 });
            v.polygon(F.map((p) => mul2(m, p)), { fill: "b", fillAlpha: 0.25, color: "b", width: 1.5 });

            const p = P.pos, ap = V.dot(A, p);
            const par = V.scale(A, ap);
            const pp = mul2(m, p);
            v.line(p, par, { color: "muted", dash: [3, 4], width: 1 });
            v.arrow([0, 0], par, { color: "d", width: 2, label: "(A·p)A" });
            v.arrow(p, pp, { color: "muted", width: 1.5, dash: [5, 4] });
            v.arrow([0, 0], p, { color: "a", width: 2.5 });
            v.arrow([0, 0], pp, { color: "c", width: 3, label: "p′" });
            v.arrow([0, 0], A, { color: "d", width: 3.5 });

            const det = M.det(m);
            const msg = Math.abs(det) < 1e-9
              ? "<b class='bad'>det = 0:</b> everything is projected onto the perpendicular line, and the flattening can't be undone."
              : det < 0
                ? "<b class='bad'>det &lt; 0:</b> the scale mirrors the plane across the perpendicular line."
                : keep.value
                  ? "Area preserved: det = k · (1/k) = 1."
                  : "Areas are multiplied by det = k.";
            out.set(
              "<b>M = s I + (k − s) A Aᵀ</b>" + matHTML(m) +
              sim.rows([
                [sim.swatch("d") + "A", fmtVec(A)],
                ["k (along A)", fmt(kk)],
                ["s (across A)", fmt(s)],
                ["A · p", fmt(ap)],
                [sim.swatch("c") + "p′", fmtVec(pp)],
                ["det M (area factor)", fmt(det), det < 0 ? "bad" : ""],
              ]) + "<hr>" + msg
            );
          });
        },
      },
      {
        title: "Nonuniform scale along rotated axes",
        help: String.raw`<p>The sphere is scaled by \(a\), \(b\), \(c\) along the axes \(\mathbf U, \mathbf V, \mathbf W\) using
          \(\mathbf S = \mathbf B\,\operatorname{diag}(a, b, c)\,\mathbf B^{\mathsf T}\), where \(\mathbf B = [\,\mathbf U\;\mathbf V\;\mathbf W\,]\) is a rotation.
          Turn and tilt the axis frame: the ellipsoid follows the axes, not the world x, y, z. The determinant \(abc\) is the
          volume ratio. Drag the view to orbit.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view3d(stage, { height: 480, distance: 9, yaw: 0.6, pitch: 0.35 });
          const out = sim.readout(readout);
          const redraw = () => view.redraw();
          const gs = sim.group(controls, "Scale factors");
          const a = sim.slider(gs, { label: "a (along U)", min: 0.2, max: 2.5, step: 0.05, value: 2.2, onInput: redraw });
          const b = sim.slider(gs, { label: "b (along V)", min: 0.2, max: 2.5, step: 0.05, value: 0.7, onInput: redraw });
          const c = sim.slider(gs, { label: "c (along W)", min: 0.2, max: 2.5, step: 0.05, value: 1, onInput: redraw });
          const gb = sim.group(controls, "Axis frame B");
          const turn = sim.slider(gb, { label: "Turn about y", min: -180, max: 180, step: 1, value: 30, unit: "°", onInput: redraw });
          const tilt = sim.slider(gb, { label: "Tilt about z", min: -90, max: 90, step: 1, value: 35, unit: "°", onInput: redraw });
          const sphere = L3D.shapes.sphere(1, 20, 12);

          view.onDraw((v) => {
            const B = M.mul(M.rotY(rad(turn.value)), M.rotZ(rad(tilt.value)));
            const D = M.scale3(a.value, b.value, c.value);
            const S = M.mul(M.mul(B, D), M.transpose(B));
            v.grid({ size: 3, step: 1 });
            v.mesh(sphere, { transform: xform(S), fill: "f" });
            [["e", "U", a.value], ["c", "V", b.value], ["a", "W", c.value]].forEach(([col, name, f], j) => {
              const axis = M.col(B, j);
              v.line(V.scale(axis, -(f + 0.5)), [0, 0, 0], { color: col, width: 1.5, dash: [5, 4], overlay: true });
              v.arrow([0, 0, 0], V.scale(axis, f + 0.5), { color: col, width: 3, label: name, overlay: true });
            });
            const det = M.det(S);
            const sym = Math.abs(S[0][1] - S[1][0]) + Math.abs(S[0][2] - S[2][0]) + Math.abs(S[1][2] - S[2][1]) < 1e-9;
            out.set("<b>S = B diag(a, b, c) Bᵀ</b>" + matHTML(S) + sim.rows([
              ["det S", fmt(det)],
              ["a · b · c", fmt(a.value * b.value * c.value)],
              ["ellipsoid volume", fmt((4 / 3) * Math.PI * det)],
              ["symmetric (Sᵀ = S)", sym ? "yes" : "no"],
            ]) + "<hr>Each axis is an eigenvector of S: S U = a U, S V = b V, S W = c W. With orthonormal axes, S is symmetric.");
          });
        },
      },
    ],

    cpp: [
      {
        title: "Uniform and nonuniform scale",
        formula: String.raw`\mathbf S = \begin{bmatrix} a & 0 & 0 \\ 0 & b & 0 \\ 0 & 0 & c \end{bmatrix}`,
        code: String.raw`
          Matrix3D MakeScale(float a, float b, float c)
          {
              return Matrix3D(   a, 0.0f, 0.0f,
                              0.0f,    b, 0.0f,
                              0.0f, 0.0f,    c);
          }

          Matrix3D MakeScale(float s)      // uniform: P' = s P
          {
              return MakeScale(s, s, s);
          }
        `,
      },
      {
        title: "Scale along a unit direction",
        formula: String.raw`\mathbf P' = \mathbf P + (k-1)(\mathbf A\cdot\mathbf P)\mathbf A \qquad \mathbf S_{\mathbf A}(k) = \mathbf I + (k-1)\mathbf A\mathbf A^{\mathsf T}`,
        code: String.raw`
          Matrix3D MakeScale(float k, const Vector3D& a)      // a must be unit length
          {
              float t = k - 1.0f;
              float ax = a.x * t, ay = a.y * t, az = a.z * t;   // (k - 1) A
              return Matrix3D(1.0f + ax * a.x,        ax * a.y,        ax * a.z,
                                     ax * a.y, 1.0f + ay * a.y,        ay * a.z,
                                     ax * a.z,        ay * a.z, 1.0f + az * a.z);
          }

          // The same thing applied to one point, without building the matrix.
          Vector3D ScaleAlong(const Vector3D& p, float k, const Vector3D& a)
          {
              return p + a * ((k - 1.0f) * Dot(a, p));         // P + (k - 1)(A . P) A
          }
        `,
      },
      {
        title: "Scale along three orthonormal axes",
        formula: String.raw`\mathbf S = \mathbf B\,\operatorname{diag}(a, b, c)\,\mathbf B^{-1} = \mathbf B\,\operatorname{diag}(a, b, c)\,\mathbf B^{\mathsf T},\quad \mathbf B = [\,\mathbf U\;\mathbf V\;\mathbf W\,]`,
        note: "<p>Because the axes are orthonormal, B is orthogonal and its inverse is its transpose (Section 4.1.1).</p>",
        code: String.raw`
          Matrix3D MakeScale(const Vector3D& u, const Vector3D& v, const Vector3D& w,
                             float a, float b, float c)
          {
              Matrix3D basis(u.x, v.x, w.x,
                             u.y, v.y, w.y,
                             u.z, v.z, w.z);
              // into (U, V, W) coordinates, scale there, and back out
              return basis * MakeScale(a, b, c) * Transpose(basis);
          }
        `,
      },
      {
        title: "Volume-preserving squash and stretch",
        formula: String.raw`\mathbf M = k\,\mathbf A\mathbf A^{\mathsf T} + s(\mathbf I - \mathbf A\mathbf A^{\mathsf T}) = s\mathbf I + (k - s)\mathbf A\mathbf A^{\mathsf T},\quad s = \tfrac{1}{\sqrt k},\quad \det\mathbf M = ks^2 = 1`,
        code: String.raw`
          // Stretch by k along the (unit) velocity direction and shrink by 1/sqrt(k) across it.
          Matrix3D MakeSquashStretch(const Vector3D& dir, float k)
          {
              float s = 1.0f / std::sqrt(k);      // factor across the motion
              float t = k - s;
              return Matrix3D(s + t * dir.x * dir.x,     t * dir.x * dir.y,     t * dir.x * dir.z,
                                  t * dir.y * dir.x, s + t * dir.y * dir.y,     t * dir.y * dir.z,
                                  t * dir.z * dir.x,     t * dir.z * dir.y, s + t * dir.z * dir.z);
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 4.3 Rotation Transforms
  // ===========================================================================
  L3D.topic({
    id: "4.3",
    summary: "Rotation matrices about the x, y, and z axes, and the formula for rotating about any unit axis, built from projection and the cross product.",

    lesson: String.raw`
      <p>A rotation turns space about an axis through the origin. The book's sign convention: a rotation by a
      <em>positive</em> angle \(\theta\) about an axis \(\mathbf A\) is <strong>counterclockwise when \(\mathbf A\) points
      toward you</strong>. Equivalently, point your right thumb along \(\mathbf A\), and your fingers curl in the positive
      direction.</p>

      <h2>Rotation in 2D</h2>
      <p>Start in the plane. Rotating \(\mathbf P = \langle P_x, P_y\rangle\) by 90° counterclockwise just swaps the
      coordinates and negates the new x: \(\mathbf Q = \langle -P_y, P_x\rangle\). \(\mathbf P\) and \(\mathbf Q\) are
      perpendicular and have the same length, so together they form an orthogonal basis for the plane. The vector
      \(\mathbf P'\) obtained by rotating \(\mathbf P\) through \(\theta\) is, by basic trigonometry,
      \[ \mathbf P' = \mathbf P\cos\theta + \mathbf Q\sin\theta . \]
      Written out in components, \(P'_x = P_x\cos\theta - P_y\sin\theta\) and \(P'_y = P_y\cos\theta + P_x\sin\theta\), or</p>
      <div class="formula">\[ \mathbf P' = \begin{bmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{bmatrix}\mathbf P . \]</div>

      <h2>Rotations about the x, y, and z axes</h2>
      <p>A rotation about the z axis is this 2D rotation applied to x and y, with z left alone. Take the third row and
      column from the identity matrix:
      \[ \mathbf R_z(\theta) = \begin{bmatrix} \cos\theta & -\sin\theta & 0 \\ \sin\theta & \cos\theta & 0 \\ 0 & 0 & 1 \end{bmatrix}. \]
      Cycling the axes (\(x \to y \to z \to x\)) gives the other two:</p>
      <div class="formula">\[ \mathbf R_x(\theta) = \begin{bmatrix} 1 & 0 & 0 \\ 0 & \cos\theta & -\sin\theta \\ 0 & \sin\theta & \cos\theta \end{bmatrix}
         \qquad
         \mathbf R_y(\theta) = \begin{bmatrix} \cos\theta & 0 & \sin\theta \\ 0 & 1 & 0 \\ -\sin\theta & 0 & \cos\theta \end{bmatrix} \]</div>
      <p>The minus sign in \(\mathbf R_y\) sits <em>below</em> the diagonal. That isn't a typo. The cyclic order around y is
      \(z \to x\), so z plays the role of the "first" axis and x the "second": \(z' = z\cos\theta - x\sin\theta\) and
      \(x' = x\cos\theta + z\sin\theta\).</p>
      <p>All rotation matrices have orthonormal columns and determinant \(+1\), so they are orthogonal (Section 4.1.1), and
      undoing a rotation is the same as rotating by the opposite angle:
      \[ \mathbf R(\theta)^{-1} = \mathbf R(-\theta) = \mathbf R(\theta)^{\mathsf T}. \]</p>
      <div class="warn">In 2D, rotations commute. In 3D they don't: \(\mathbf R_x(\alpha)\mathbf R_y(\beta) \ne \mathbf R_y(\beta)\mathbf R_x(\alpha)\)
      in general, as the third simulation shows. That's why "Euler angles" (yaw, pitch, roll) always come with an order
      convention, and why mixing up the order is a classic bug.</div>

      <h2 data-sub="4.3.1">Rotation About an Arbitrary Axis</h2>
      <p>To rotate \(\mathbf P\) through \(\theta\) about a unit axis \(\mathbf A\), split \(\mathbf P\) into a part along
      the axis and a part perpendicular to it (Section 2.2):
      \[ \operatorname{proj}_{\mathbf A}\mathbf P = (\mathbf A\cdot\mathbf P)\mathbf A, \qquad
         \operatorname{perp}_{\mathbf A}\mathbf P = \mathbf P - (\mathbf A\cdot\mathbf P)\mathbf A. \]
      The part along the axis doesn't move. Only the perpendicular part turns, in the plane perpendicular to
      \(\mathbf A\), so the problem reduces to the 2D case. All we need is a second vector in that plane: the
      perpendicular part turned by 90°. The cross product \(\mathbf A\times\mathbf P\) is exactly that. It is
      perpendicular to \(\mathbf A\) and to \(\mathbf P\), and its length is \(\lVert\mathbf P\rVert\sin\alpha\) (where
      \(\alpha\) is the angle between \(\mathbf P\) and \(\mathbf A\)), the same as the length of
      \(\operatorname{perp}_{\mathbf A}\mathbf P\). The 2D formula in that plane gives
      \[ \operatorname{perp}_{\mathbf A}\mathbf P \;\mapsto\; [\mathbf P - (\mathbf A\cdot\mathbf P)\mathbf A]\cos\theta + (\mathbf A\times\mathbf P)\sin\theta . \]
      Add the unchanged part back and collect the terms:</p>
      <div class="formula">\[ \mathbf P' = \mathbf P\cos\theta + (\mathbf A\times\mathbf P)\sin\theta + \mathbf A(\mathbf A\cdot\mathbf P)(1 - \cos\theta) \]</div>
      <p>This is often called <strong>Rodrigues' rotation formula</strong>. To turn it into a matrix, replace the cross
      product with its skew-symmetric matrix (Section 2.3) and \(\mathbf A(\mathbf A\cdot\mathbf P)\) with the outer
      product \(\mathbf A\mathbf A^{\mathsf T}\mathbf P\) (Section 2.2):
      \[ \mathbf P' = \left( \mathbf I\cos\theta + \begin{bmatrix} 0 & -A_z & A_y \\ A_z & 0 & -A_x \\ -A_y & A_x & 0 \end{bmatrix}\sin\theta
         + \mathbf A\mathbf A^{\mathsf T}(1 - \cos\theta) \right)\mathbf P . \]
      With \(c = \cos\theta\) and \(s = \sin\theta\) the three terms combine into</p>
      <div class="formula">\[ \mathbf R_{\mathbf A}(\theta) = \begin{bmatrix}
         c + (1-c)A_x^2 & (1-c)A_xA_y - sA_z & (1-c)A_xA_z + sA_y \\
         (1-c)A_xA_y + sA_z & c + (1-c)A_y^2 & (1-c)A_yA_z - sA_x \\
         (1-c)A_xA_z - sA_y & (1-c)A_yA_z + sA_x & c + (1-c)A_z^2 \end{bmatrix} \]</div>
      <p>Two quick checks. With \(\mathbf A = \langle 0, 0, 1\rangle\) only \(A_z = 1\) survives and the matrix becomes
      \(\mathbf R_z(\theta)\). And \(\mathbf A\) itself never moves:
      \(\mathbf R_{\mathbf A}(\theta)\mathbf A = \mathbf A\cos\theta + \mathbf 0 + \mathbf A(1 - \cos\theta) = \mathbf A\).</p>

      <div class="game">Use it for anything that spins about a tilted axis: a door on a slanted hinge, a planet about its
      tilted pole, a turret mounted on a sloping hull, or an orbit camera turning about the player's up vector. For a
      single vector, the vector form above is cheaper than building the matrix. For a whole mesh, build the matrix once
      and reuse it.</div>
      <div class="warn">The formula assumes \(\mathbf A\) is a <em>unit</em> vector. Give it an unnormalized axis and the
      result is scaled and skewed, so it's no longer a rotation. Normalize first.</div>

      <p><a class="btn goto-sim" href="#/4.3/sim">Try it: rotate in 2D, about any axis, and in different orders →</a></p>
    `,

    keyFormulas: [
      ["2D rotation", String.raw`\mathbf P' = \mathbf P\cos\theta + \mathbf Q\sin\theta,\quad \mathbf Q = \langle -P_y, P_x\rangle`],
      ["Rotation about z", String.raw`\mathbf R_z(\theta) = \begin{bmatrix} \cos\theta & -\sin\theta & 0 \\ \sin\theta & \cos\theta & 0 \\ 0 & 0 & 1 \end{bmatrix}`],
      ["Rotation about x and y", String.raw`\mathbf R_x(\theta) = \begin{bmatrix} 1 & 0 & 0 \\ 0 & \cos\theta & -\sin\theta \\ 0 & \sin\theta & \cos\theta \end{bmatrix} \quad \mathbf R_y(\theta) = \begin{bmatrix} \cos\theta & 0 & \sin\theta \\ 0 & 1 & 0 \\ -\sin\theta & 0 & \cos\theta \end{bmatrix}`],
      ["Rotation about a unit axis A", String.raw`\mathbf P' = \mathbf P\cos\theta + (\mathbf A\times\mathbf P)\sin\theta + \mathbf A(\mathbf A\cdot\mathbf P)(1-\cos\theta)`],
      ["Inverse rotation", String.raw`\mathbf R(\theta)^{-1} = \mathbf R(-\theta) = \mathbf R(\theta)^{\mathsf T}`],
    ],

    exercises: [
      { q: "Write the matrices for a rotation of 30° about the x, y, and z axes (book exercise 4.1).",
        a: String.raw`With \(c = \cos30^\circ \approx 0.866\) and \(s = 0.5\):
          \(\mathbf R_x = \begin{bmatrix}1&0&0\\0&0.866&-0.5\\0&0.5&0.866\end{bmatrix}\),
          \(\mathbf R_y = \begin{bmatrix}0.866&0&0.5\\0&1&0\\-0.5&0&0.866\end{bmatrix}\),
          \(\mathbf R_z = \begin{bmatrix}0.866&-0.5&0\\0.5&0.866&0\\0&0&1\end{bmatrix}\).` },
      { q: String.raw`Rotate \(\mathbf P = \langle 1, 0, 0\rangle\) by 120° about \(\mathbf A = \tfrac{1}{\sqrt3}\langle 1, 1, 1\rangle\).`,
        a: String.raw`\(\mathbf P\cos120^\circ = \langle -\tfrac12, 0, 0\rangle\). \(\mathbf A\times\mathbf P = \tfrac{1}{\sqrt3}\langle 0, 1, -1\rangle\), times
          \(\sin120^\circ = \tfrac{\sqrt3}{2}\) gives \(\langle 0, \tfrac12, -\tfrac12\rangle\). \(\mathbf A(\mathbf A\cdot\mathbf P)(1 - \cos120^\circ) = \tfrac13\langle1,1,1\rangle\cdot\tfrac32 = \langle\tfrac12,\tfrac12,\tfrac12\rangle\).
          The sum is \(\langle 0, 1, 0\rangle\): this rotation cycles \(x \to y \to z\).` },
      { q: String.raw`Apply \(\mathbf R_z(90^\circ)\mathbf R_x(90^\circ)\) and \(\mathbf R_x(90^\circ)\mathbf R_z(90^\circ)\) to \(\langle 0, 1, 0\rangle\).`,
        a: String.raw`First: \(\mathbf R_x(90^\circ)\langle0,1,0\rangle = \langle0,0,1\rangle\), then \(\mathbf R_z\) leaves it at \(\langle0,0,1\rangle\).
          Second: \(\mathbf R_z(90^\circ)\langle0,1,0\rangle = \langle-1,0,0\rangle\), then \(\mathbf R_x\) leaves it at \(\langle-1,0,0\rangle\). Different answers, so the rotations don't commute.` },
      { q: String.raw`What is the inverse of \(\mathbf R_{\mathbf A}(\theta)\)? Give two descriptions.`,
        a: String.raw`\(\mathbf R_{\mathbf A}(-\theta)\), the rotation back by the same angle, which also equals the transpose \(\mathbf R_{\mathbf A}(\theta)^{\mathsf T}\).
          Check in the matrix: replacing \(s\) by \(-s\) swaps exactly the off-diagonal entries that differ.` },
    ],

    sims: [
      {
        title: "2D rotation from P and Q",
        help: String.raw`<p>Drag \(\mathbf P\) and change \(\theta\). The orange arrow \(\mathbf Q = \langle -P_y, P_x\rangle\) is
          \(\mathbf P\) turned by 90°. The rotated vector \(\mathbf P'\) is built from the two dashed pieces,
          \(\mathbf P\cos\theta\) and \(\mathbf Q\sin\theta\), exactly as in Equation (4.12). Its length never changes.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 4, height: 440 });
          const out = sim.readout(readout);
          const P = view.handle([2.6, 1], { color: "a", label: "P", snap: 0.1 });
          let theta = 50;
          const th = sim.slider(controls, { label: "Angle θ", min: -180, max: 180, step: 1, value: theta, unit: "°", onInput: (x) => { theta = x; view.redraw(); } });
          const spin = sim.checkbox(controls, { label: "Animate θ", value: false });
          sim.loop((dt) => {
            if (!spin.value) return;
            theta += 40 * dt;
            if (theta > 180) theta -= 360;
            th.value = theta;
            view.redraw();
          });

          view.onDraw((v) => {
            const t = rad(theta), c = Math.cos(t), s = Math.sin(t);
            const p = P.pos, q = [-p[1], p[0]];
            const pc = V.scale(p, c), qs = V.scale(q, s), pr = V.add(pc, qs);
            v.grid({ step: 1 });
            v.axes();
            const r = V.len(p);
            v.circle([0, 0], r, { color: "muted", dash: [4, 4], width: 1 });
            const a0 = Math.atan2(p[1], p[0]);
            if (r > 0.3) v.arc([0, 0], Math.min(0.9, r * 0.5), a0, a0 + t, { color: "d", width: 2 });
            v.arrow([0, 0], q, { color: "b", width: 2, alpha: 0.55, label: "Q" });
            v.arrow([0, 0], pc, { color: "a", width: 2, dash: [6, 4], alpha: 0.8 });
            v.arrow(pc, pr, { color: "b", width: 2, dash: [6, 4] });
            v.text(V.scale(pc, 0.5), "P cos θ", { color: "a", size: 12, offset: [6, 14] });
            v.text(V.lerp(pc, pr, 0.5), "Q sin θ", { color: "b", size: 12, offset: [8, 0] });
            v.arrow([0, 0], p, { color: "a", width: 3 });
            v.arrow([0, 0], pr, { color: "c", width: 3.5, label: "P′" });
            out.set("<b>R(θ)</b>" + matHTML([[c, -s], [s, c]], 3) + sim.rows([
              ["θ", fmt(theta, 0) + "°"],
              [sim.swatch("a") + "P", fmtVec(p)],
              [sim.swatch("b") + "Q = (−P_y, P_x)", fmtVec(q)],
              ["P · Q", fmt(V.dot(p, q))],
              [sim.swatch("c") + "P′ = P cos θ + Q sin θ", fmtVec(pr)],
              ["‖P‖", fmt(r)],
              ["‖P′‖", fmt(V.len(pr))],
            ]));
          });
        },
      },
      {
        title: "Rotation about an arbitrary axis",
        help: String.raw`<p>The purple line is the unit axis \(\mathbf A\). \(\mathbf P\) (blue) splits into the part along the axis,
          \((\mathbf A\cdot\mathbf P)\mathbf A\) (gold), and the perpendicular part (orange, dashed). Only the perpendicular part turns. It
          sweeps around the dotted circle, mixing with \(\mathbf A\times\mathbf P\) (green), which is the same vector turned 90° about the axis.
          The red arrow is the result \(\mathbf P'\). Animate \(\theta\), or change the axis and watch the circle tilt with it.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view3d(stage, { height: 480, distance: 8, yaw: 0.5, pitch: 0.35 });
          const out = sim.readout(readout);
          const redraw = () => view.redraw();
          let theta = 70;
          const ga = sim.group(controls, "Axis A");
          const ah = sim.slider(ga, { label: "Heading", min: -180, max: 180, step: 1, value: 20, unit: "°", onInput: redraw });
          const ae = sim.slider(ga, { label: "Elevation", min: -90, max: 90, step: 1, value: 55, unit: "°", onInput: redraw });
          const gp = sim.group(controls, "Rotation");
          const th = sim.slider(gp, { label: "Angle θ", min: -180, max: 180, step: 1, value: theta, unit: "°", onInput: (x) => { theta = x; redraw(); } });
          const play = sim.checkbox(gp, { label: "Animate θ", value: false });
          const gv = sim.group(controls, "Vector P");
          const px = sim.slider(gv, { label: "P x", min: -2, max: 2, step: 0.1, value: 1.8, onInput: redraw });
          const py = sim.slider(gv, { label: "P y", min: -2, max: 2, step: 0.1, value: 0.3, onInput: redraw });
          const pz = sim.slider(gv, { label: "P z", min: -2, max: 2, step: 0.1, value: 0.6, onInput: redraw });
          sim.loop((dt) => {
            if (!play.value) return;
            theta += 45 * dt;
            if (theta > 180) theta -= 360;
            th.value = theta;
            redraw();
          });

          view.onDraw((v) => {
            const A = dirFromAngles(ah.value, ae.value);
            const P = [px.value, py.value, pz.value];
            const t = rad(theta), c = Math.cos(t), s = Math.sin(t);
            const ap = V.dot(A, P);
            const par = V.scale(A, ap);
            const perp = V.sub(P, par);
            const axP = V.cross(A, P);
            // P' = P cos θ + (A × P) sin θ + A (A · P)(1 − cos θ)      (4.20)
            const Pr = V.add(V.add(V.scale(P, c), V.scale(axP, s)), V.scale(A, ap * (1 - c)));
            const R = M.rotAxis(A, t);                                   // (4.22)
            const PrM = M.mulVec(R, P);

            v.grid({ size: 3, step: 1 });
            v.axes({ length: 0.8, width: 1.5 });
            v.line(V.scale(A, -3), V.scale(A, 3), { color: "d", width: 1.5, dash: [6, 5] });
            v.arrow([0, 0, 0], A, { color: "d", width: 3, label: "A" });
            const r = V.len(perp);
            if (r > 1e-3) {
              v.circle(par, A, r, { color: "muted", width: 1.2, dash: [3, 4] });
              const arc = [];
              for (let i = 0; i <= 40; i++) arc.push(M.mulVec(M.rotAxis(A, (t * i) / 40), P));
              v.polyline(arc, { color: "e", width: 2, alpha: 0.6 });
            }
            v.arrow([0, 0, 0], par, { color: "g", width: 3, label: "(A·P)A" });
            v.line(par, P, { color: "b", width: 2, dash: [5, 4] });
            v.arrow(par, V.add(par, axP), { color: "c", width: 2, dash: [5, 4], label: "A×P" });
            v.line(par, Pr, { color: "b", width: 1.5, alpha: 0.6 });
            v.arrow([0, 0, 0], P, { color: "a", width: 3.5, label: "P" });
            v.arrow([0, 0, 0], Pr, { color: "e", width: 3.5, label: "P′" });

            out.set(sim.rows([
              [sim.swatch("d") + "A", fmtVec(A)],
              [sim.swatch("a") + "P", fmtVec(P)],
              ["A · P", fmt(ap)],
              [sim.swatch("g") + "(A·P) A", fmtVec(par)],
              [sim.swatch("b") + "perp = P − (A·P)A", fmtVec(perp)],
              [sim.swatch("c") + "A × P", fmtVec(axP)],
              ["‖perp‖ vs ‖A × P‖", fmt(r) + " vs " + fmt(V.len(axP))],
              [sim.swatch("e") + "P′ by (4.20)", fmtVec(Pr)],
              ["R_A(θ) P by (4.22)", fmtVec(PrM)],
              ["‖P‖ → ‖P′‖", fmt(V.len(P)) + " → " + fmt(V.len(Pr))],
            ]) + "<b>R_A(θ)</b>" + matHTML(R, 3));
          });
        },
      },
      {
        title: "Rotation order matters",
        help: String.raw`<p>Both airplanes get the same two rotations, in opposite orders. The left one applies \(\mathbf R_1\) first and
          then \(\mathbf R_2\), so its matrix is \(\mathbf R_2\mathbf R_1\) (the transform applied first sits on the right). The right one uses
          \(\mathbf R_1\mathbf R_2\). Set either angle to 0, or choose the same axis twice, and the two agree. Otherwise they almost never do.
          The thin lines show the world axes (x red, y green, z blue).</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view3d(stage, { height: 460, distance: 11, yaw: 0.3, pitch: 0.42 });
          const out = sim.readout(readout);
          const redraw = () => view.redraw();
          const axes = [["x", "x axis"], ["y", "y axis"], ["z", "z axis"]];
          const rot = { x: M.rotX, y: M.rotY, z: M.rotZ };
          const g1 = sim.group(controls, "First rotation R₁");
          const ax1 = sim.select(g1, { label: "About", options: axes, value: "x", onChange: redraw });
          const an1 = sim.slider(g1, { label: "Angle", min: -180, max: 180, step: 5, value: 90, unit: "°", onInput: redraw });
          const g2 = sim.group(controls, "Second rotation R₂");
          const ax2 = sim.select(g2, { label: "About", options: axes, value: "y", onChange: redraw });
          const an2 = sim.slider(g2, { label: "Angle", min: -180, max: 180, step: 5, value: 90, unit: "°", onInput: redraw });

          view.onDraw((v) => {
            const R1 = rot[ax1.value](rad(an1.value)), R2 = rot[ax2.value](rad(an2.value));
            const A = M.mul(R2, R1), B = M.mul(R1, R2);
            const L = [-2.4, 0, 0], Rt = [2.4, 0, 0];
            v.grid({ size: 5, step: 1 });
            for (const o of [L, Rt]) {
              v.line(o, V.add(o, [1.9, 0, 0]), { color: "e", width: 1, alpha: 0.6 });
              v.line(o, V.add(o, [0, 1.9, 0]), { color: "c", width: 1, alpha: 0.6 });
              v.line(o, V.add(o, [0, 0, 1.9]), { color: "a", width: 1, alpha: 0.6 });
            }
            drawPlane(v, xform(A, L));
            drawPlane(v, xform(B, Rt));
            v.text(V.add(L, [0, 2.2, 0]), "R₂R₁ (R₁ first)", { color: "fg", align: "center" });
            v.text(V.add(Rt, [0, 2.2, 0]), "R₁R₂ (R₂ first)", { color: "fg", align: "center" });
            const fa = A.flat(), fb = B.flat();
            const diff = fa.reduce((s, x, i) => s + Math.abs(x - fb[i]), 0);
            out.set("<b>R₂R₁</b> (left)" + matHTML(A) + "<b>R₁R₂</b> (right)" + matHTML(B) + "<hr>" +
              (diff < 1e-6 ? "<b class='ok'>Same result:</b> these two rotations commute." : "<b class='bad'>Different:</b> 3D rotations do not commute in general."));
          });
        },
      },
    ],

    cpp: [
      {
        title: "Rotations about the x, y, and z axes",
        formula: String.raw`\mathbf R_x(\theta),\;\mathbf R_y(\theta),\;\mathbf R_z(\theta)\quad\text{(Equations 4.15 and 4.16)}`,
        note: "<p>The <code>Matrix3D</code> constructor takes its entries row by row, so the code reads like the matrices in the lesson.</p>",
        code: String.raw`
          Matrix3D MakeRotationX(float t)
          {
              float c = std::cos(t), s = std::sin(t);
              return Matrix3D(1.0f, 0.0f, 0.0f,
                              0.0f,    c,   -s,
                              0.0f,    s,    c);
          }

          Matrix3D MakeRotationY(float t)
          {
              float c = std::cos(t), s = std::sin(t);
              return Matrix3D(   c, 0.0f,    s,
                              0.0f, 1.0f, 0.0f,
                                -s, 0.0f,    c);     // minus sign below the diagonal
          }

          Matrix3D MakeRotationZ(float t)
          {
              float c = std::cos(t), s = std::sin(t);
              return Matrix3D(   c,   -s, 0.0f,
                                 s,    c, 0.0f,
                              0.0f, 0.0f, 1.0f);
          }
        `,
      },
      {
        title: "Rotation in 2D",
        formula: String.raw`\mathbf P' = \mathbf P\cos\theta + \mathbf Q\sin\theta,\quad \mathbf Q = \langle -P_y, P_x\rangle`,
        code: String.raw`
          Vector2D Rotate2D(const Vector2D& p, float t)
          {
              float c = std::cos(t), s = std::sin(t);
              return Vector2D(p.x * c - p.y * s,      // P_x cos t + Q_x sin t,  Q_x = -P_y
                              p.y * c + p.x * s);     // P_y cos t + Q_y sin t,  Q_y =  P_x
          }
        `,
      },
      {
        title: "Rotating a vector about an axis (vector form)",
        formula: String.raw`\mathbf P' = \mathbf P\cos\theta + (\mathbf A\times\mathbf P)\sin\theta + \mathbf A(\mathbf A\cdot\mathbf P)(1-\cos\theta)`,
        note: "<p>Cheaper than building the matrix when you only rotate one or two vectors.</p>",
        code: String.raw`
          // Rotate p by angle t about the unit axis a.     (Equation 4.20)
          Vector3D RotateAboutAxis(const Vector3D& p, const Vector3D& a, float t)
          {
              float c = std::cos(t), s = std::sin(t);
              return p * c                               // P cos t
                   + Cross(a, p) * s                     // (A x P) sin t
                   + a * (Dot(a, p) * (1.0f - c));       // A (A . P)(1 - cos t)
          }
        `,
      },
      {
        title: "Rotation matrix for an arbitrary axis",
        formula: String.raw`\mathbf R_{\mathbf A}(\theta) = \mathbf I\cos\theta + [\mathbf A]_\times\sin\theta + \mathbf A\mathbf A^{\mathsf T}(1-\cos\theta)`,
        code: String.raw`
          // R_A(t) for a unit axis a.     (Equation 4.22)
          Matrix3D MakeRotation(float t, const Vector3D& a)
          {
              float c = std::cos(t), s = std::sin(t);
              float d = 1.0f - c;

              float x = a.x * d, y = a.y * d, z = a.z * d;           // (1 - c) A
              float axay = x * a.y, axaz = x * a.z, ayaz = y * a.z;   // (1 - c) Ax Ay, ...

              return Matrix3D(c + x * a.x,    axay - s * a.z, axaz + s * a.y,
                              axay + s * a.z, c + y * a.y,    ayaz - s * a.x,
                              axaz - s * a.y, ayaz + s * a.x, c + z * a.z);
          }
        `,
      },
    ],
  });
})();
