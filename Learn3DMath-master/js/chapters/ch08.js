// Chapter 8 - Visibility Determination
(function () {
  "use strict";
  const { V, M, fmt, fmtVec, rad, deg, clamp } = L3D.math;

  // ===========================================================================
  // Shared helpers
  // ===========================================================================

  // Small seeded random generator (mulberry32) so "random" clouds are reproducible.
  function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Standard normal sample (Box-Muller).
  function gauss(rnd) {
    const u = Math.max(1e-9, rnd()), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // m = (1/N) sum P_i
  function mean(pts) {
    const m = pts[0].map(() => 0);
    for (const p of pts) for (let i = 0; i < m.length; i++) m[i] += p[i];
    return m.map((x) => x / pts.length);
  }

  // C = (1/N) sum (P_i - m)(P_i - m)^T, any dimension
  function covariance(pts, m) {
    const n = m.length;
    const C = Array.from({ length: n }, () => new Array(n).fill(0));
    for (const p of pts) {
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) C[i][j] += (p[i] - m[i]) * (p[j] - m[j]);
    }
    return C.map((r) => r.map((x) => x / pts.length));
  }

  // Symmetric 2x2 eigensystem: l1 >= l2, unit eigenvectors R (for l1) and S (for l2).
  function eigenSym2(C) {
    const a = C[0][0], b = C[0][1], c = C[1][1];
    const h = (a + c) / 2, d = Math.sqrt(Math.max(0, ((a - c) / 2) ** 2 + b * b));
    const l1 = h + d, l2 = h - d;
    // (C - l1 I) v = 0  ->  v = (b, l1 - a)
    const R = Math.abs(b) > 1e-12 ? V.norm([b, l1 - a]) : a >= c ? [1, 0] : [0, 1];
    return { l1, l2, R, S: V.perp2(R) };
  }

  // Jacobi eigen-solver for a symmetric 3x3 matrix (the numerical method of Section 16.3).
  // Returns [{ l, e }] sorted by eigenvalue, largest first; e are orthonormal eigenvectors.
  function eigenSym3(C) {
    const a = C.map((r) => r.slice());
    const v = M.identity(3);
    for (let sweep = 0; sweep < 50; sweep++) {
      if (Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]) < 1e-13) break;
      for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
        for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
        for (let k = 0; k < 3; k++) { const x = v[k][p], y = v[k][q]; v[k][p] = c * x - s * y; v[k][q] = s * x + c * y; }
      }
    }
    return [0, 1, 2].map((i) => ({ l: a[i][i], e: [v[0][i], v[1][i], v[2][i]] })).sort((x, y) => y.l - x.l);
  }

  // min / max of P.A over the points, with the indices of the extreme points
  function extent(pts, A) {
    let lo = Infinity, hi = -Infinity, kLo = 0, kHi = 0;
    pts.forEach((p, i) => {
      const d = V.dot(p, A);
      if (d < lo) { lo = d; kLo = i; }
      if (d > hi) { hi = d; kHi = i; }
    });
    return { lo, hi, kLo, kHi };
  }

  // Section 8.1.3: start with the two extreme points along `axis`, then grow the sphere for every point outside.
  // Works in any dimension (circle in 2D). trace[i] is the state after checking point i.
  function growSphere(pts, axis) {
    const e = extent(pts, axis);
    const Q0 = V.scale(V.add(pts[e.kLo], pts[e.kHi]), 0.5);
    const r0 = V.dist(pts[e.kLo], Q0);
    let Q = Q0, r = r0;
    const trace = [];
    pts.forEach((P, i) => {
      const d = V.sub(P, Q), d2 = V.len2(d);
      const before = { Q, r };
      if (d2 > r * r * (1 + 1e-9)) {
        const dist = Math.sqrt(d2);
        const G = V.sub(Q, V.scale(d, r / dist));   // G = Q - r (P - Q) / |P - Q|
        Q = V.scale(V.add(G, P), 0.5);                // Q' = (G + P) / 2
        r = V.dist(P, Q);                             // r' = |P - Q'|
        trace.push({ i, grew: true, before, G, Q, r });
      } else {
        trace.push({ i, grew: false, before, Q, r });
      }
    });
    return { k: e.kLo, l: e.kHi, Q0, r0, Q, r, trace };
  }

  // Points around an ellipse (or circle) with center c and orthonormal directions u, v. Works in 2D and 3D.
  function ellipsePts(c, u, v, A, B, n = 72) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      out.push(V.add(c, V.add(V.scale(u, A * Math.cos(t)), V.scale(v, B * Math.sin(t)))));
    }
    return out;
  }

  const matHtml = (A, digits = 2) =>
    `<div class="eq">${A.map((r) => "[ " + r.map((x) => fmt(x, digits).padStart(6)).join(" ") + " ]").join("\n")}</div>`;
  const yesNo = (ok, yes = "yes", no = "no") => (ok ? `<span class="ok">${yes}</span>` : `<span class="bad">${no}</span>`);

  // ---- 2D planes: L = [nx, ny, d]; L . P = nx px + ny py + d (positive = inside)
  const pdot = (L, p) => L[0] * p[0] + L[1] * p[1] + L[2];
  // Inward planes of a counterclockwise convex polygon; plane i belongs to edge corners[i] -> corners[i+1].
  function polyPlanes(corners) {
    return corners.map((p, i) => {
      const q = corners[(i + 1) % corners.length];
      const n = V.norm(V.perp2(V.sub(q, p)));
      return [n[0], n[1], -V.dot(n, p)];
    });
  }
  // Intersection of the lines L1 . P = 0 and L2 . P = 0.
  function lineIntersect(L1, L2) {
    const det = L1[0] * L2[1] - L1[1] * L2[0];
    if (Math.abs(det) < 1e-12) return null;
    const b1 = -L1[2], b2 = -L2[2];
    return [(b1 * L2[1] - L1[1] * b2) / det, (L1[0] * b2 - b1 * L2[0]) / det];
  }
  // Separating-axis overlap test for two convex polygons (the exact answer the sims compare against).
  function convexOverlap(P, Q) {
    for (const poly of [P, Q]) {
      for (let i = 0; i < poly.length; i++) {
        const e = V.sub(poly[(i + 1) % poly.length], poly[i]);
        const n = [-e[1], e[0]];
        let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
        for (const p of P) { const d = V.dot(n, p); a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
        for (const p of Q) { const d = V.dot(n, p); b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
        if (a1 < b0 - 1e-9 || b1 < a0 - 1e-9) return false;
      }
    }
    return true;
  }
  // Book-style polygon clip (Section 8.4.1). dot(p) returns L . p. Vertices with -eps < L.p <= 0 count as
  // "in the plane". Works for 2D and 3D points. Returns the clipped polygon and the bookkeeping for display.
  function clipPoly(poly, dot, eps = 1e-3) {
    const d = poly.map(dot);
    const cls = d.map((x) => (x > 0 ? 1 : x > -eps ? 0 : -1));
    if (!cls.some((c) => c === 1)) return { poly: [], d, cls, added: [] };
    if (!cls.some((c) => c === -1)) return { poly: poly.slice(), d, cls, added: [] };
    const res = [], added = [];
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      if (cls[i] !== -1) res.push(poly[i]);
      if ((cls[i] === 1 && cls[j] === -1) || (cls[i] === -1 && cls[j] === 1)) {
        const t = d[i] / (d[i] - d[j]);           // t = L.Vi / L.(Vi - Vi+1)
        const W = V.lerp(poly[i], poly[j], t);     // W = Vi + t (Vi+1 - Vi)
        res.push(W);
        added.push({ i, j, t, W });
      }
    }
    return { poly: res, d, cls, added };
  }
  // A 2D top-down view frustum: camera C, forward direction f, horizontal FOV in degrees, near/far distances.
  // corners are counterclockwise [near-right, far-right, far-left, near-left]; planes[i] is the edge after corner i
  // (right, far, left, near), all with inward unit normals.
  function frustum2(C, f, fovDeg, near, far) {
    const fn = V.norm(f), side = V.perp2(fn), t = Math.tan(rad(fovDeg / 2));
    const pt = (dist, s) => V.add(C, V.add(V.scale(fn, dist), V.scale(side, s * dist * t)));
    const corners = [pt(near, -1), pt(far, -1), pt(far, 1), pt(near, 1)];
    const planes = polyPlanes(corners);
    return { corners, planes, names: ["right", "far", "left", "near"], fn };
  }
  // Polygon offset outward: plane i moved by r[i]; vertex i is where planes i-1 and i meet.
  function expandedPolygon(planes, r) {
    const moved = planes.map((L, i) => [L[0], L[1], L[2] + r[i]]);
    return moved.map((L, i) => lineIntersect(moved[(i + moved.length - 1) % moved.length], L)).filter(Boolean);
  }
  // Camera handle + aim handle pair (a top-down camera rig). The aim handle follows the camera when it is dragged;
  // forward() returns the unit view direction and snaps the aim handle back to a fixed distance.
  function cameraRig(view, pos, dir, aimDist = 2, label = "camera") {
    const C = view.handle(pos, { color: "fg", label });
    const A = view.handle(V.add(pos, V.scale(V.norm(dir), aimDist)), { color: "accent", label: "aim", r: 6 });
    let last = [...C.pos];
    C.onDrag = (p) => {
      A.pos[0] += p[0] - last[0];
      A.pos[1] += p[1] - last[1];
      last = [...p];
    };
    const forward = () => {
      let f = V.sub(A.pos, C.pos);
      if (V.len(f) < 1e-6) f = [1, 0];
      f = V.norm(f);
      A.pos[0] = C.pos[0] + f[0] * aimDist;
      A.pos[1] = C.pos[1] + f[1] * aimDist;
      last = [...C.pos];
      return f;
    };
    return { C, A, forward };
  }

  // ===========================================================================
  // 8.1 Bounding Volume Construction
  // ===========================================================================
  L3D.topic({
    id: "8.1",
    summary: "Find a mesh's natural axes with principal component analysis, then wrap it in a tight box, sphere, ellipsoid or cylinder.",

    lesson: String.raw`
      <p>A renderer never wants to spend time on something the camera can't see. Engines answer "is it visible?" at
      several scales at once. The GPU throws away individual back-facing triangles. <strong>Bounding volumes</strong>
      let the engine reject a whole object with a handful of dot products (Section 8.2). <strong>Spatial
      trees</strong> such as octrees and BSP trees reject whole groups of objects (Section 8.3), and <strong>portal
      systems</strong> reject whole rooms (Section 8.4). Every level is <em>conservative</em>: it may keep something
      that turns out to be invisible, but it must never throw away something that is visible.</p>

      <p>A bounding volume is a simple shape (box, sphere, ellipsoid, cylinder) that encloses every vertex of a mesh.
      A convex shape that holds all the vertices also holds every triangle, so if the volume lies completely outside the
      view frustum, so does the mesh. The tighter the volume, the more often that happens. A box aligned to the world
      axes is easy to compute, but it wraps a diagonal, elongated object in lots of empty space. The fix is to align
      the volume with the object's own <em>natural axes</em>.</p>

      <h2 data-sub="8.1.1">Principal Component Analysis</h2>
      <p>Treat the \(N\) vertex positions \(\mathbf P_1, \dots, \mathbf P_N\) as a statistical sample. First find
      their average position, the <strong>mean</strong>
      \[ \mathbf m = \frac{1}{N}\sum_{i=1}^{N} \mathbf P_i , \]
      then measure how the coordinates vary together with the \(3\times3\) <strong>covariance matrix</strong>:</p>
      <div class="formula">\[ \mathbf C = \frac{1}{N}\sum_{i=1}^{N} (\mathbf P_i - \mathbf m)(\mathbf P_i - \mathbf m)^{\mathsf T} \]</div>
      <p>Each term is an outer product (a column times a row). For example
      \(C_{11} = \frac1N\sum (x_i - m_x)^2\) is the variance of the x coordinates, and
      \(C_{12} = C_{21} = \frac1N\sum (x_i - m_x)(y_i - m_y)\) measures how x and y vary together. The matrix is
      symmetric, so it has only six distinct entries. A zero off-diagonal entry means those two coordinates are
      <em>uncorrelated</em>. If all three off-diagonal entries are zero, the points are already spread out along the
      coordinate axes, and the axis-aligned box is the natural one.</p>

      <p>So we look for a rotation that makes \(\mathbf C\) diagonal. Transform every point by a matrix \(\mathbf A\).
      The mean becomes \(\mathbf A\mathbf m\), and the covariance of the new points is
      \[ \mathbf C' = \frac1N\sum_{i=1}^{N} \mathbf A(\mathbf P_i-\mathbf m)(\mathbf P_i-\mathbf m)^{\mathsf T}\mathbf A^{\mathsf T}
         = \mathbf A\mathbf C\mathbf A^{\mathsf T}. \]
      Because \(\mathbf C\) is real and symmetric, its eigenvalues are real and its eigenvectors can be chosen
      orthonormal (Theorems 3.25 and 3.26). Put the unit eigenvectors in the rows of \(\mathbf A\), and
      \(\mathbf A\mathbf C\mathbf A^{\mathsf T}\) becomes the diagonal matrix of eigenvalues. In that frame the
      coordinates are uncorrelated, so the eigenvectors <em>are</em> the natural axes.</p>

      <div class="key">The natural axes of a point set are the eigenvectors of its covariance matrix. Call them
      \(\mathbf R, \mathbf S, \mathbf T\) in order of decreasing eigenvalue, \(\lambda_1 \ge \lambda_2 \ge \lambda_3\).
      \(\mathbf R\), the <strong>principal axis</strong>, is the direction in which the vertices spread out the most,
      and \(\mathbf T\) is the direction in which the object is thinnest. Each eigenvalue is the variance of the points
      measured along its axis.</div>

      <p>To get the eigenvalues you can solve the cubic characteristic polynomial \(\det(\mathbf C - \lambda\mathbf I) = 0\).
      It always has three real roots here, so the closed-form method of Section 6.1.2 works. Then solve
      \((\mathbf C - \lambda_i\mathbf I)\mathbf V_i = \mathbf 0\) for each eigenvector. In practice engines usually run
      the iterative Jacobi method of Section 16.3, which returns the eigenvalues and orthonormal eigenvectors together.
      The book's Example 8.1 runs four points through this. The mean is \(\langle 1, -1, 2\rangle\) and the eigenvalues
      come out near 2.097, 0.306 and 0.098, so one direction clearly dominates.</p>

      <div class="warn">PCA weights every <em>vertex</em> equally, so a densely tessellated region pulls the axes toward
      itself. If one side of a mesh is much more detailed than the rest, run PCA on the vertices of its convex hull or
      weight the vertices by triangle area. When two eigenvalues are equal (a sphere, a cube) the matching eigenvectors
      are not unique, and any orthonormal pair in that plane works equally well.</div>

      <h2 data-sub="8.1.2">Bounding Box Construction</h2>
      <p>With unit axes \(\mathbf R, \mathbf S, \mathbf T\) in hand, the extent of the mesh along \(\mathbf R\) is the
      range of the dot products \(\mathbf P_i\cdot\mathbf R\). The smallest and the largest value give two planes
      perpendicular to \(\mathbf R\), and the same goes for the other two axes. As 4D planes with inward-pointing
      normals:</p>
      <div class="formula">\[ \Big\langle \mathbf R,\; -\min_i \{\mathbf P_i\cdot\mathbf R\}\Big\rangle \qquad
         \Big\langle -\mathbf R,\; \max_i \{\mathbf P_i\cdot\mathbf R\}\Big\rangle \]
         and likewise for \(\mathbf S\) and \(\mathbf T\).</div>
      <p>The box dimensions are the differences max − min along each axis. The center lies on the three planes halfway
      between each opposite pair. Define the average extents
      \[ a = \frac{\min_i \mathbf P_i\cdot\mathbf R + \max_i \mathbf P_i\cdot\mathbf R}{2},\quad
         b = \frac{\min_i \mathbf P_i\cdot\mathbf S + \max_i \mathbf P_i\cdot\mathbf S}{2},\quad
         c = \frac{\min_i \mathbf P_i\cdot\mathbf T + \max_i \mathbf P_i\cdot\mathbf T}{2}. \]
      Because the axes are orthonormal, the center is simply</p>
      <div class="formula">\[ \mathbf Q = a\mathbf R + b\mathbf S + c\mathbf T. \]</div>
      <p>In the book's Example 8.2 the values \(\mathbf P_i\cdot\mathbf R\) range over \([-2.67,\ 1.05]\), so that box is
      3.72 units long in the \(\mathbf R\) direction and its center sits at \(a = -0.81\) along \(\mathbf R\).</p>

      <h2 data-sub="8.1.3">Bounding Sphere Construction</h2>
      <p>Spheres give the cheapest visibility test (Section 8.2.1), but finding the truly smallest enclosing sphere is a
      hard problem. A simple method that works well uses the principal axis for a first guess and then grows the
      sphere as needed:</p>
      <ol>
        <li>Find the points \(\mathbf P_k\) and \(\mathbf P_l\) with the smallest and largest dot product with
          \(\mathbf R\). They are far apart in the direction of greatest spread, so they make a good diameter:
          \[ \mathbf Q = \frac{\mathbf P_k + \mathbf P_l}{2}, \qquad r = \lVert \mathbf P_k - \mathbf Q \rVert. \]</li>
        <li>Visit every point. If \(\lVert\mathbf P_i - \mathbf Q\rVert^2 \gt r^2\), the point is outside, so grow the
          sphere just enough to hold both the old sphere and \(\mathbf P_i\). The new sphere touches the old one at the
          point \(\mathbf G\) on the far side from \(\mathbf P_i\),
          \[ \mathbf G = \mathbf Q - r\,\frac{\mathbf P_i - \mathbf Q}{\lVert\mathbf P_i - \mathbf Q\rVert}, \]
          and its diameter runs from \(\mathbf G\) to \(\mathbf P_i\):
          \[ \mathbf Q' = \frac{\mathbf G + \mathbf P_i}{2}, \qquad r' = \lVert \mathbf P_i - \mathbf Q' \rVert. \]</li>
      </ol>
      <p>The new sphere contains the old one (they are tangent at \(\mathbf G\)), so every point accepted earlier is still
      inside, and one pass over the points is enough. The result isn't optimal, but it is usually within a few percent
      of the best possible radius.</p>

      <h2 data-sub="8.1.4">Bounding Ellipsoid Construction</h2>
      <p>A long, thin object wastes most of a sphere, and an ellipsoid aligned to \(\mathbf R, \mathbf S, \mathbf T\) fits
      much better. The trick is to turn the problem into a sphere problem. Let \(a, b, c\) now be the box
      <em>dimensions</em> (max − min of the dot products along each axis). Scaling the points by \(1/a\), \(1/b\) and
      \(1/c\) along the three axes squashes their bounding box into a unit cube. The matrix for a scale along three
      orthogonal axes (Chapter 4) is</p>
      <div class="formula">\[ \mathbf M = [\,\mathbf R\;\mathbf S\;\mathbf T\,]
        \begin{bmatrix} 1/a & 0 & 0 \\ 0 & 1/b & 0 \\ 0 & 0 & 1/c \end{bmatrix}
        [\,\mathbf R\;\mathbf S\;\mathbf T\,]^{\mathsf T} \]</div>
      <p>(The right-hand factor would be an inverse, but an orthonormal matrix's inverse is its transpose.) Build a bounding
      sphere with center \(\mathbf Q\) and radius \(r\) for the scaled points \(\mathbf M\mathbf P_i\), then undo the scale.
      The ellipsoid's center is \(\mathbf M^{-1}\mathbf Q\), where \(\mathbf M^{-1}\) has \(a, b, c\) on the diagonal
      instead, and its semiaxis lengths along \(\mathbf R, \mathbf S, \mathbf T\) are \(ar\), \(br\) and \(cr\).</p>

      <h2 data-sub="8.1.5">Bounding Cylinder Construction</h2>
      <p>A cylinder is stored as a radius plus the centers \(\mathbf Q_1, \mathbf Q_2\) of its two end caps. Its axis runs
      along \(\mathbf R\), and its end caps lie in the two box planes perpendicular to \(\mathbf R\). What remains is the
      radius, which is a 2D problem. Remove each point's component along \(\mathbf R\),
      \[ \mathbf H_i = \mathbf P_i - (\mathbf P_i\cdot\mathbf R)\,\mathbf R , \]
      which flattens every point into the plane through the origin spanned by \(\mathbf S\) and \(\mathbf T\). Now find a
      bounding <em>circle</em> for the \(\mathbf H_i\) exactly as in Section 8.1.3. Start from the two points with the
      smallest and largest dot product with \(\mathbf S\) (the direction of greatest spread within that plane) and grow
      the circle for any point outside it. With circle center \(\mathbf Q\) and radius \(r\), the cylinder is</p>
      <div class="formula">\[ \mathbf Q_1 = \mathbf Q + \Big(\min_i \mathbf P_i\cdot\mathbf R\Big)\mathbf R, \qquad
         \mathbf Q_2 = \mathbf Q + \Big(\max_i \mathbf P_i\cdot\mathbf R\Big)\mathbf R, \qquad \text{radius } r. \]</div>

      <table>
        <tr><th>Volume</th><th>What you store</th><th>Good for</th></tr>
        <tr><td>Box</td><td>center \(\mathbf Q\), axes, three dimensions</td><td>blocky objects: crates, buildings, vehicles</td></tr>
        <tr><td>Sphere</td><td>center, radius</td><td>compact objects; the cheapest test</td></tr>
        <tr><td>Ellipsoid</td><td>center, three semiaxis vectors</td><td>elongated, rounded objects</td></tr>
        <tr><td>Cylinder</td><td>two end points, radius</td><td>characters, columns, pipes, tree trunks</td></tr>
      </table>

      <div class="game">Bounding volumes are built offline by the model exporter or once at load time, in object space,
      and stored with the mesh. Each frame the engine transforms only the center and the axes by the object's world
      matrix, which is far cheaper than touching the vertices. Many engines keep two volumes per object: a sphere for a
      very quick first rejection, and an oriented box for a tighter second test.</div>

      <p><a class="btn goto-sim" href="#/8.1/sim">Try it: build bounding volumes from a point cloud →</a></p>
    `,

    keyFormulas: [
      ["Mean and covariance", String.raw`\mathbf m = \frac1N\sum_{i=1}^N\mathbf P_i \qquad \mathbf C = \frac1N\sum_{i=1}^N(\mathbf P_i-\mathbf m)(\mathbf P_i-\mathbf m)^{\mathsf T}`],
      ["Natural axes", String.raw`\mathbf R,\mathbf S,\mathbf T = \text{eigenvectors of } \mathbf C,\quad \lambda_1 \ge \lambda_2 \ge \lambda_3`],
      ["Box planes and center", String.raw`\langle \mathbf R, -\min_i \mathbf P_i\cdot\mathbf R\rangle,\ \langle -\mathbf R, \max_i \mathbf P_i\cdot\mathbf R\rangle \qquad \mathbf Q = a\mathbf R + b\mathbf S + c\mathbf T`],
      ["Growing a sphere", String.raw`\mathbf G = \mathbf Q - r\frac{\mathbf P_i-\mathbf Q}{\lVert\mathbf P_i-\mathbf Q\rVert},\quad \mathbf Q' = \frac{\mathbf G+\mathbf P_i}{2},\quad r' = \lVert\mathbf P_i-\mathbf Q'\rVert`],
      ["Ellipsoid by scaling", String.raw`\mathbf M = [\mathbf R\,\mathbf S\,\mathbf T]\operatorname{diag}(1/a, 1/b, 1/c)[\mathbf R\,\mathbf S\,\mathbf T]^{\mathsf T},\quad \text{semiaxes } ar, br, cr`],
      ["Cylinder", String.raw`\mathbf H_i = \mathbf P_i - (\mathbf P_i\cdot\mathbf R)\mathbf R,\quad \mathbf Q_{1,2} = \mathbf Q + \big(\min / \max\ \mathbf P_i\cdot\mathbf R\big)\mathbf R`],
    ],

    exercises: [
      { q: String.raw`Find the mean, the covariance matrix and the principal axis of the 2D points \((-1,-1), (1,1), (2,2), (-2,-2)\).`,
        a: String.raw`The mean is \((0,0)\). Every point has \(x = y\), so \(C_{11} = C_{22} = C_{12} = (1+1+4+4)/4 = 2.5\) and
          \(\mathbf C = \begin{bmatrix}2.5 & 2.5\\ 2.5 & 2.5\end{bmatrix}\). Its eigenvalues are 5 and 0, and the eigenvector
          for 5 is \(\mathbf R = \langle 1, 1\rangle/\sqrt2\). The points lie on a line, so there is no spread at all along \(\mathbf S\).` },
      { q: String.raw`The dot products \(\mathbf P_i\cdot\mathbf R\) of a mesh range from \(-2.67\) to \(1.05\). What are the two bounding planes perpendicular to \(\mathbf R\), the box size along \(\mathbf R\), and the center coordinate \(a\)?`,
        a: String.raw`The planes are \(\langle\mathbf R, 2.67\rangle\) and \(\langle-\mathbf R, 1.05\rangle\). The size is \(1.05 - (-2.67) = 3.72\), and
          \(a = (-2.67 + 1.05)/2 = -0.81\).` },
      { q: String.raw`A bounding sphere so far has \(\mathbf Q = (0,0,0)\) and \(r = 1\). The next point is \(\mathbf P = (3,0,0)\). What is the new sphere?`,
        a: String.raw`\(\lVert\mathbf P-\mathbf Q\rVert^2 = 9 \gt 1\), so it grows. \(\mathbf G = \mathbf Q - 1\cdot\langle1,0,0\rangle = (-1,0,0)\),
          \(\mathbf Q' = (\mathbf G+\mathbf P)/2 = (1,0,0)\) and \(r' = 2\). The new sphere spans from \(-1\) to \(3\) on the x axis,
          so it still contains the old one.` },
      { q: String.raw`A mesh's box dimensions are \(a = 4\), \(b = 2\), \(c = 1\), and the bounding sphere of the scaled points has radius 0.9. What are the ellipsoid's semiaxes? Compare its volume with the box's.`,
        a: String.raw`The semiaxes are \(4(0.9) = 3.6\), \(1.8\) and \(0.9\). The ellipsoid's volume is \(\tfrac43\pi(3.6)(1.8)(0.9) \approx 24.4\),
          which is larger than the box's \(4\cdot2\cdot1 = 8\). An ellipsoid that holds a box's corners is always bigger than the box; it wins
          only when the points themselves are rounded, so that the corners of the box are empty.` },
      { q: String.raw`(Book exercise 1) Two spheres have centers \(\mathbf Q_1, \mathbf Q_2\) and radii \(r_1, r_2\). Find the smallest sphere that encloses both.`,
        a: String.raw`Let \(d = \lVert\mathbf Q_2-\mathbf Q_1\rVert\). If \(d + r_2 \le r_1\) the answer is sphere 1, and if \(d + r_1 \le r_2\) it is sphere 2.
          Otherwise the enclosing sphere's diameter runs across both spheres along the line of centers:
          \(r = (d + r_1 + r_2)/2\) and \(\mathbf Q = \mathbf Q_1 + \frac{r - r_1}{d}(\mathbf Q_2-\mathbf Q_1)\). This is exactly the "grow" step of Section 8.1.3,
          applied to a sphere instead of a point.` },
    ],

    sims: [
      {
        title: "Covariance matrix and natural axes",
        help: String.raw`<p>Drag any point, or use the sliders to generate a new cloud. The green box is aligned with the
          eigenvectors \(\mathbf R\) and \(\mathbf S\) of the covariance matrix, and the dashed box is aligned with the world
          axes. The arrows have length \(2\sqrt{\lambda}\), two standard deviations. Change the tilt and watch the
          off-diagonal entry \(C_{12}\) change while the PCA box keeps the same size. At a tilt of 0° or ±90° the matrix
          becomes diagonal and the two boxes match.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 6, height: 460 });
          const out = sim.readout(readout);
          const MAX = 30;
          const hs = [];
          for (let i = 0; i < MAX; i++) hs.push(view.handle([0, 0], { color: "a", r: 5 }));
          let seed = 11;
          const count = sim.slider(controls, { label: "Points", min: 4, max: MAX, step: 1, value: 16, onInput: () => regen() });
          const stretch = sim.slider(controls, { label: "Elongation", min: 1, max: 4, step: 0.1, value: 2.8, onInput: () => regen() });
          const tilt = sim.slider(controls, { label: "Tilt", min: -90, max: 90, step: 1, value: 28, unit: "°", onInput: () => regen() });
          sim.buttons(controls, [{ label: "New random cloud", onClick: () => { seed++; regen(); } }]);
          const showAabb = sim.checkbox(controls, { label: "Show the axis-aligned box", value: true, onChange: () => view.redraw() });
          sim.legend(controls, [["c", "PCA box"], ["muted", "axis-aligned box"], ["e", "R (principal)"], ["b", "S"], ["d", "mean m"]]);

          function regen() {
            const rnd = makeRng(seed * 7919);
            const t = rad(tilt.value);
            hs.forEach((h, i) => {
              const local = [gauss(rnd) * 0.75 * stretch.value, gauss(rnd) * 0.75];
              const p = V.add(V.rotate2(local, t), [0.6, -0.2]);
              h.set([clamp(p[0], -9, 9), clamp(p[1], -5.5, 5.5)]);
              h.visible = i < count.value;
            });
            view.redraw();
          }
          regen();

          view.onDraw((v) => {
            v.grid({ step: 1 });
            v.axes();
            const pts = hs.filter((h) => h.visible).map((h) => h.pos);
            const m = mean(pts), C = covariance(pts, m);
            const { l1, l2, R, S } = eigenSym2(C);
            const eR = extent(pts, R), eS = extent(pts, S);
            const corner = (a, b) => V.add(V.scale(R, a), V.scale(S, b));
            const box = [corner(eR.lo, eS.lo), corner(eR.hi, eS.lo), corner(eR.hi, eS.hi), corner(eR.lo, eS.hi)];
            const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
            const amin = [Math.min(...xs), Math.min(...ys)], amax = [Math.max(...xs), Math.max(...ys)];
            if (showAabb.value) v.rect(amin, amax, { color: "muted", dash: [6, 5], width: 1.5 });
            v.polygon(box, { fill: "c", fillAlpha: 0.1, color: "c", width: 2 });
            const Q = corner((eR.lo + eR.hi) / 2, (eS.lo + eS.hi) / 2);
            v.point(Q, { color: "c", r: 3.5 });
            v.text(Q, "Q", { color: "c", offset: [6, 14], size: 12 });
            v.arrow(m, V.add(m, V.scale(R, 2 * Math.sqrt(Math.max(l1, 0)))), { color: "e", label: "R", width: 3 });
            v.arrow(m, V.add(m, V.scale(S, 2 * Math.sqrt(Math.max(l2, 0)))), { color: "b", label: "S", width: 3 });
            v.point(m, { color: "d", r: 5, label: "m" });

            const aabbArea = (amax[0] - amin[0]) * (amax[1] - amin[1]);
            const pcaArea = (eR.hi - eR.lo) * (eS.hi - eS.lo);
            out.set(
              sim.rows([["points N", String(pts.length)], [sim.swatch("d") + "mean m", fmtVec(m)]]) +
              "<div>covariance matrix C</div>" + matHtml(C) +
              sim.rows([
                ["λ₁ (variance along R)", fmt(l1, 3)],
                ["λ₂ (variance along S)", fmt(l2, 3)],
                [sim.swatch("e") + "R", fmtVec(R, 3)],
                [sim.swatch("b") + "S", fmtVec(S, 3)],
                ["box extents along R", `[${fmt(eR.lo)}, ${fmt(eR.hi)}]`],
                ["box extents along S", `[${fmt(eS.lo)}, ${fmt(eS.hi)}]`],
              ]) + "<hr>" +
              sim.rows([
                ["axis-aligned box area", fmt(aabbArea)],
                [sim.swatch("c") + "PCA box area", fmt(pcaArea)],
                ["PCA / axis-aligned", fmt((100 * pcaArea) / Math.max(aabbArea, 1e-9), 0) + "%", pcaArea <= aabbArea + 1e-9 ? "ok" : "bad"],
              ])
            );
          });
        },
      },
      {
        title: "Growing a bounding sphere (and ellipsoid)",
        help: String.raw`<p>Step through the algorithm of Section 8.1.3. The red dashed diameter joins \(\mathbf P_k\) and
          \(\mathbf P_l\), the extreme points along the principal axis, and gives the first sphere. Each step checks one
          point. When a point lies outside, the old sphere (dashed) is replaced by one whose diameter runs from \(\mathbf G\)
          to the point. Switch to <b>Ellipsoid</b> to run the same algorithm on the points after scaling their PCA box
          into a unit square (inset), and then stretch the circle back into an ellipse (Section 8.1.4). Drag points to
          try other shapes.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 6, height: 460 });
          const out = sim.readout(readout);
          const N = 14;
          const hs = [];
          for (let i = 0; i < N; i++) hs.push(view.handle([0, 0], { color: "a", r: 5 }));
          let seed = 5;
          const mode = sim.segmented(controls, {
            label: "Volume", options: [["sphere", "Sphere (8.1.3)"], ["ellipse", "Ellipsoid (8.1.4)"]], value: "sphere",
            onChange: () => view.redraw(),
          });
          const step = sim.slider(controls, { label: "Points checked", min: 0, max: N, step: 1, value: 0, onInput: () => view.redraw() });
          sim.buttons(controls, [
            { label: "◀ Back", onClick: () => { step.value = Math.max(0, step.value - 1); view.redraw(); } },
            { label: "Step ▶", onClick: () => { step.value = Math.min(N, step.value + 1); view.redraw(); } },
            { label: "New cloud", onClick: () => { seed++; regen(); } },
          ]);
          sim.legend(controls, [["e", "Pk–Pl start diameter"], ["c", "current volume"], ["g", "G"], ["muted", "previous volume"]]);

          function regen() {
            const rnd = makeRng(seed * 31337);
            const t = rad(20 + 40 * rnd());
            hs.forEach((h) => {
              const local = [gauss(rnd) * 2.4, gauss(rnd) * 0.9];
              const p = V.add(V.rotate2(local, t), [0.5, -0.3]);
              h.set([clamp(p[0], -9, 9), clamp(p[1], -5.5, 5.5)]);
            });
            step.value = 0;
            view.redraw();
          }
          regen();

          view.onDraw((v) => {
            v.grid({ step: 1 });
            v.axes();
            const pts = hs.map((h) => h.pos);
            const { R, S } = eigenSym2(covariance(pts, mean(pts)));
            const ell = mode.value === "ellipse";
            const eR = extent(pts, R), eS = extent(pts, S);
            const dimA = Math.max(eR.hi - eR.lo, 1e-6), dimB = Math.max(eS.hi - eS.lo, 1e-6);
            const a = ell ? dimA : 1, b = ell ? dimB : 1;
            const fwd = (p) => V.add(V.scale(R, V.dot(p, R) / a), V.scale(S, V.dot(p, S) / b)); // M P
            const inv = (q) => V.add(V.scale(R, V.dot(q, R) * a), V.scale(S, V.dot(q, S) * b)); // M^-1 Q
            const sp = pts.map(fwd);
            const axis = ell ? eigenSym2(covariance(sp, mean(sp))).R : R;
            const g = growSphere(sp, axis);
            const k = Math.min(step.value, N);
            const cur = k > 0 ? g.trace[k - 1] : null;
            const state = cur ? { Q: cur.Q, r: cur.r } : { Q: g.Q0, r: g.r0 };
            const shape = (Q, r) => ellipsePts(inv(Q), R, S, a * r, b * r);

            // PCA box for reference
            const corner = (s, t) => V.add(V.scale(R, s), V.scale(S, t));
            v.polygon([corner(eR.lo, eS.lo), corner(eR.hi, eS.lo), corner(eR.hi, eS.hi), corner(eR.lo, eS.hi)], { color: "muted", width: 1, dash: [2, 4] });
            v.polygon(shape(g.Q, g.r), { color: "c", dash: [2, 6], width: 1, alpha: 0.6 });
            if (cur && cur.grew) v.polygon(shape(cur.before.Q, cur.before.r), { color: "muted", dash: [7, 5], width: 1.75 });
            v.polygon(shape(state.Q, state.r), { fill: "c", fillAlpha: 0.1, color: "c", width: 2.5 });
            v.line(pts[g.k], pts[g.l], { color: "e", dash: [5, 4], width: 1.5 });
            v.text(pts[g.k], "Pk", { color: "e", offset: [-22, 18], size: 12 });
            v.text(pts[g.l], "Pl", { color: "e", offset: [8, 18], size: 12 });
            if (cur) {
              const P = pts[cur.i];
              v.circle(P, 0.32, { color: cur.grew ? "e" : "c", width: 2.5 });
              if (cur.grew) {
                const G = inv(cur.G);
                v.line(G, P, { color: "g", width: 2 });
                v.point(G, { color: "g", r: 6, label: "G" });
              }
            }
            v.point(inv(state.Q), { color: "c", r: 4.5, label: ell ? "M⁻¹Q" : "Q" });

            if (ell) {
              // inset: the scaled points (PCA box squashed into a unit square) and their bounding circle
              const ctx = v.ctx, W = 170, x0 = v.w - W - 10, y0 = 10;
              const uv = (q) => [V.dot(q, R), V.dot(q, S)];
              const us = sp.map(uv);
              const c0 = [(Math.min(...us.map((p) => p[0])) + Math.max(...us.map((p) => p[0]))) / 2,
                (Math.min(...us.map((p) => p[1])) + Math.max(...us.map((p) => p[1]))) / 2];
              const sc = W / 1.9;
              const toS = (p) => [x0 + W / 2 + (p[0] - c0[0]) * sc, y0 + W / 2 - (p[1] - c0[1]) * sc];
              ctx.save();
              ctx.fillStyle = sim.color("panel");
              ctx.strokeStyle = sim.color("grid2");
              ctx.lineWidth = 1;
              ctx.setLineDash([]);
              ctx.fillRect(x0, y0, W, W);
              ctx.strokeRect(x0, y0, W, W);
              const sq = toS([c0[0] - 0.5, c0[1] + 0.5]);
              ctx.strokeStyle = sim.color("muted");
              ctx.setLineDash([3, 3]);
              ctx.strokeRect(sq[0], sq[1], sc, sc);
              ctx.setLineDash([]);
              const qc = toS(uv(state.Q));
              ctx.beginPath();
              ctx.arc(qc[0], qc[1], state.r * sc, 0, Math.PI * 2);
              ctx.strokeStyle = sim.color("c");
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.fillStyle = sim.color("a");
              us.forEach((p) => { const s = toS(p); ctx.beginPath(); ctx.arc(s[0], s[1], 3, 0, Math.PI * 2); ctx.fill(); });
              ctx.restore();
              v.label(x0 + 6, y0 + W - 6, "scaled space: box → unit square", { color: "muted", size: 10.5 });
            }

            const grows = g.trace.slice(0, k).filter((s) => s.grew).length;
            let msg;
            if (!cur) msg = "Start: the diameter joins the extreme points along the principal axis.";
            else if (cur.grew) msg = `Point ${cur.i + 1} was <b>outside</b>: r grew from ${fmt(cur.before.r, 3)} to ${fmt(cur.r, 3)}.`;
            else msg = `Point ${cur.i + 1} was already inside.`;
            const area = Math.PI * (a * state.r) * (b * state.r);
            out.set(sim.rows([
              ["points checked", `${k} / ${N}`],
              ["expansions so far", String(grows)],
              [ell ? "radius in scaled space r" : "radius r", fmt(state.r, 3)],
              ...(ell ? [["box dimensions a, b", `${fmt(dimA)}, ${fmt(dimB)}`], ["semiaxes a r, b r", `${fmt(a * state.r)}, ${fmt(b * state.r)}`]] : []),
              [sim.swatch("c") + (ell ? "ellipse area" : "circle area"), fmt(area)],
              ["PCA box area", fmt(dimA * dimB)],
            ]) + `<hr>${msg}${k === N ? " <b>Done</b>: every point is inside." : ""}`);
          });
        },
      },
      {
        title: "All four bounding volumes in 3D",
        help: String.raw`<p>A 3D point cloud and its covariance eigenvectors \(\mathbf R, \mathbf S, \mathbf T\). Pick a volume
          type and compare the enclosed volumes in the readout (the smallest is marked). Make the cloud long and thin
          and the cylinder or ellipsoid wins; make it boxy and uniform and the box wins. Drag to orbit.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view3d(stage, { height: 470, distance: 13, yaw: 0.55, pitch: 0.4, target: [0, -0.3, 0] });
          const out = sim.readout(readout);
          let seed = 3, data = null;
          const kind = sim.segmented(controls, {
            label: "Bounding volume",
            options: [["box", "Box"], ["sphere", "Sphere"], ["ellipsoid", "Ellipsoid"], ["cylinder", "Cylinder"]],
            value: "box", onChange: () => view.redraw(),
          });
          const g = sim.group(controls, "Point cloud");
          const len = sim.slider(g, { label: "Length", min: 0.5, max: 3, step: 0.1, value: 2.4, onInput: () => rebuild() });
          const wid = sim.slider(g, { label: "Width", min: 0.2, max: 2, step: 0.1, value: 1.0, onInput: () => rebuild() });
          const hgt = sim.slider(g, { label: "Height", min: 0.2, max: 2, step: 0.1, value: 0.5, onInput: () => rebuild() });
          const turn = sim.slider(g, { label: "Turn", min: -90, max: 90, step: 1, value: 35, unit: "°", onInput: () => rebuild() });
          const tilt = sim.slider(g, { label: "Tilt", min: -60, max: 60, step: 1, value: 25, unit: "°", onInput: () => rebuild() });
          const dist = sim.select(g, { label: "Distribution", options: [["gauss", "Gaussian blob"], ["box", "Uniform in a box"]], value: "gauss", onChange: () => rebuild() });
          sim.buttons(g, [{ label: "New points", onClick: () => { seed++; rebuild(); } }]);
          const showAxes = sim.checkbox(controls, { label: "Show the natural axes R, S, T", value: true, onChange: () => view.redraw() });

          function rebuild() {
            const rnd = makeRng(seed * 104729);
            const Rm = M.mul(M.rotY(rad(turn.value)), M.rotZ(rad(tilt.value)));
            const pts = [];
            for (let i = 0; i < 48; i++) {
              const p = dist.value === "gauss"
                ? [gauss(rnd) * len.value * 0.5, gauss(rnd) * wid.value * 0.5, gauss(rnd) * hgt.value * 0.5]
                : [(rnd() * 2 - 1) * len.value, (rnd() * 2 - 1) * wid.value, (rnd() * 2 - 1) * hgt.value];
              pts.push(V.add(M.mulVec(Rm, p), [0, 0.2, 0]));
            }
            const m = mean(pts), C = covariance(pts, m);
            const eig = eigenSym3(C);
            const R = eig[0].e, S = eig[1].e, T = V.cross(R, S);
            const ex = [R, S, T].map((A) => extent(pts, A));
            const dims = ex.map((e) => e.hi - e.lo);
            const mid = ex.map((e) => (e.lo + e.hi) / 2);
            const center = V.add(V.add(V.scale(R, mid[0]), V.scale(S, mid[1])), V.scale(T, mid[2]));
            const sph = growSphere(pts, R);
            const [a, b, c] = dims.map((d) => Math.max(d, 1e-6));
            const fwd = (p) => V.add(V.add(V.scale(R, V.dot(p, R) / a), V.scale(S, V.dot(p, S) / b)), V.scale(T, V.dot(p, T) / c));
            const inv = (q) => V.add(V.add(V.scale(R, V.dot(q, R) * a), V.scale(S, V.dot(q, S) * b)), V.scale(T, V.dot(q, T) * c));
            const sp = pts.map(fwd);
            const se = growSphere(sp, eigenSym3(covariance(sp, mean(sp)))[0].e);
            const ell = { center: inv(se.Q), semi: [a * se.r, b * se.r, c * se.r] };
            const H = pts.map((p) => V.sub(p, V.scale(R, V.dot(p, R))));      // H_i = P_i - (P_i . R) R
            const circ = growSphere(H, S);
            const cyl = { q1: V.add(circ.Q, V.scale(R, ex[0].lo)), q2: V.add(circ.Q, V.scale(R, ex[0].hi)), r: circ.r };
            const vols = {
              box: dims[0] * dims[1] * dims[2],
              sphere: (4 / 3) * Math.PI * sph.r ** 3,
              ellipsoid: (4 / 3) * Math.PI * ell.semi[0] * ell.semi[1] * ell.semi[2],
              cylinder: Math.PI * cyl.r * cyl.r * dims[0],
            };
            data = { pts, eig, R, S, T, dims, center, sph, ell, cyl, vols };
            view.redraw();
          }
          rebuild();

          view.onDraw((v) => {
            if (!data) return;
            v.grid({ size: 5, step: 1, y: -2.5 });
            const { pts, R, S, T, dims, center, sph, ell, cyl, vols } = data;
            for (const p of pts) v.point(p, { color: "a", r: 3 });
            const K = kind.value;
            if (K === "box") {
              const half = dims.map((d) => d / 2);
              const cs = [];
              for (let i = 0; i < 8; i++) {
                cs.push(V.add(center, V.add(V.add(V.scale(R, (i & 1 ? 1 : -1) * half[0]), V.scale(S, (i & 2 ? 1 : -1) * half[1])), V.scale(T, (i & 4 ? 1 : -1) * half[2]))));
              }
              for (const f of [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]]) {
                v.poly(f.map((i) => cs[i]), { fill: "c", alpha: 0.07 });
              }
              for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) v.line(cs[i], cs[i | bit], { color: "c", width: 2 });
              v.point(center, { color: "c", r: 4, label: "Q" });
            } else if (K === "sphere") {
              v.sphere(sph.Q, sph.r, { fill: "c", alpha: 0.12 });
              for (const n of [R, S, T]) v.circle(sph.Q, n, sph.r, { color: "c", width: 1.5 });
              v.point(sph.Q, { color: "c", r: 4, label: "Q" });
            } else if (K === "ellipsoid") {
              const [A, B, Cc] = ell.semi;
              v.polyline(ellipsePts(ell.center, R, S, A, B), { color: "c", width: 2, closed: true });
              v.polyline(ellipsePts(ell.center, R, T, A, Cc), { color: "c", width: 2, closed: true });
              v.polyline(ellipsePts(ell.center, S, T, B, Cc), { color: "c", width: 1.5, closed: true });
              for (const s of [-0.6, 0.6]) {
                const k = Math.sqrt(1 - s * s);
                v.polyline(ellipsePts(V.add(ell.center, V.scale(T, s * Cc)), R, S, A * k, B * k), { color: "c", width: 1, alpha: 0.5, closed: true });
              }
              v.point(ell.center, { color: "c", r: 4, label: "center" });
            } else {
              v.circle(cyl.q1, R, cyl.r, { color: "c", width: 2 });
              v.circle(cyl.q2, R, cyl.r, { color: "c", width: 2 });
              for (let i = 0; i < 8; i++) {
                const t = (i / 8) * Math.PI * 2;
                const o = V.add(V.scale(S, cyl.r * Math.cos(t)), V.scale(T, cyl.r * Math.sin(t)));
                v.line(V.add(cyl.q1, o), V.add(cyl.q2, o), { color: "c", width: 1, alpha: 0.6 });
              }
              v.line(cyl.q1, cyl.q2, { color: "c", dash: [5, 4], width: 1.5 });
              v.point(cyl.q1, { color: "c", r: 4, label: "Q₁" });
              v.point(cyl.q2, { color: "c", r: 4, label: "Q₂" });
            }
            if (showAxes.value) {
              const o = K === "box" ? center : K === "sphere" ? sph.Q : K === "ellipsoid" ? ell.center : V.lerp(cyl.q1, cyl.q2, 0.5);
              v.arrow(o, V.add(o, V.scale(R, dims[0] / 2 + 0.6)), { color: "e", label: "R", width: 2.5 });
              v.arrow(o, V.add(o, V.scale(S, dims[1] / 2 + 0.6)), { color: "b", label: "S", width: 2.5 });
              v.arrow(o, V.add(o, V.scale(T, dims[2] / 2 + 0.6)), { color: "f", label: "T", width: 2.5 });
            }
            const best = Object.keys(vols).reduce((x, y) => (vols[x] <= vols[y] ? x : y));
            const label = { box: "box", sphere: "sphere", ellipsoid: "ellipsoid", cylinder: "cylinder" };
            out.set(sim.rows([
              ["λ₁, λ₂, λ₃", data.eig.map((e) => fmt(e.l, 3)).join(", ")],
              [sim.swatch("e") + "R", fmtVec(R)],
              [sim.swatch("b") + "S", fmtVec(S)],
              [sim.swatch("f") + "T", fmtVec(T)],
              ["box dimensions", dims.map((d) => fmt(d)).join(" × ")],
            ]) + "<hr><div>enclosed volume</div>" + sim.rows(Object.keys(vols).map((k) => [
              (k === K ? "<b>" + label[k] + "</b>" : label[k]),
              fmt(vols[k]) + (k === best ? " ✓ smallest" : ""),
              k === best ? "ok" : "",
            ])) + `<hr>${K === "sphere" ? `r = ${fmt(sph.r, 3)}` : K === "ellipsoid" ? `semiaxes ${ell.semi.map((x) => fmt(x)).join(", ")}` : K === "cylinder" ? `radius ${fmt(cyl.r)}, length ${fmt(dims[0])}` : `center Q = ${fmtVec(center)}`}`);
          });
        },
      },
    ],

    cpp: [
      {
        title: "Mean and covariance matrix",
        formula: String.raw`\mathbf m = \frac1N\sum_{i=1}^N\mathbf P_i \qquad \mathbf C = \frac1N\sum_{i=1}^N(\mathbf P_i-\mathbf m)(\mathbf P_i-\mathbf m)^{\mathsf T}`,
        code: String.raw`
          void ComputeCovariance(const Point3D* p, int count, Point3D& m, Matrix3D& C)
          {
              m = Point3D(0.0f, 0.0f, 0.0f);
              for (int i = 0; i < count; i++) m += p[i];
              m *= 1.0f / float(count);                          // m = (1/N) sum P_i

              float c11 = 0.0f, c22 = 0.0f, c33 = 0.0f, c12 = 0.0f, c13 = 0.0f, c23 = 0.0f;
              for (int i = 0; i < count; i++)
              {
                  Vector3D d = p[i] - m;                           // P_i - m
                  c11 += d.x * d.x;  c22 += d.y * d.y;  c33 += d.z * d.z;
                  c12 += d.x * d.y;  c13 += d.x * d.z;  c23 += d.y * d.z;
              }

              float s = 1.0f / float(count);
              C = Matrix3D(c11 * s, c12 * s, c13 * s,              // symmetric, so only
                           c12 * s, c22 * s, c23 * s,              // six unique entries
                           c13 * s, c23 * s, c33 * s);
          }
        `,
      },
      {
        title: "Natural axes and the oriented bounding box",
        formula: String.raw`\mathbf Q = a\mathbf R + b\mathbf S + c\mathbf T,\quad a = \tfrac12\big(\min_i \mathbf P_i\cdot\mathbf R + \max_i \mathbf P_i\cdot\mathbf R\big)`,
        note: "<p><code>SymmetricEigensystem</code> is the Jacobi solver of Section 16.3. It returns the eigenvalues and the unit eigenvectors (as matrix columns) in no particular order, so sort them first.</p>",
        code: String.raw`
          void SymmetricEigensystem(const Matrix3D& C, float lambda[3], Matrix3D& E);   // Section 16.3

          struct OrientedBox
          {
              Point3D  center;      // Q
              Vector3D axis[3];     // R, S, T (unit length)
              float    size[3];     // box dimensions along each axis
          };

          OrientedBox BuildBoundingBox(const Point3D* p, int count)
          {
              Point3D m; Matrix3D C, E; float lambda[3];
              ComputeCovariance(p, count, m, C);
              SymmetricEigensystem(C, lambda, E);

              int k[3] = {0, 1, 2};                                // sort: lambda1 >= lambda2 >= lambda3
              for (int i = 0; i < 2; i++)
                  for (int j = i + 1; j < 3; j++)
                      if (lambda[k[j]] > lambda[k[i]]) { int t = k[i]; k[i] = k[j]; k[j] = t; }

              OrientedBox box;
              for (int a = 0; a < 3; a++)
              {
                  const Vector3D& A = E[k[a]];                     // eigenvector = column of E
                  float lo = Dot(p[0], A), hi = lo;
                  for (int i = 1; i < count; i++)
                  {
                      float d = Dot(p[i], A);                      // P_i . A
                      lo = (d < lo) ? d : lo;
                      hi = (d > hi) ? d : hi;
                  }
                  box.axis[a] = A;
                  box.size[a] = hi - lo;                           // distance between the two planes
                  box.center += A * (0.5f * (lo + hi));            // Q = aR + bS + cT
              }
              return box;
          }
        `,
      },
      {
        title: "Bounding sphere: start on the principal axis, then grow",
        formula: String.raw`\mathbf Q = \frac{\mathbf P_k+\mathbf P_l}{2},\ r = \lVert\mathbf P_k-\mathbf Q\rVert;\quad \mathbf G = \mathbf Q - r\frac{\mathbf P_i-\mathbf Q}{\lVert\mathbf P_i-\mathbf Q\rVert},\ \mathbf Q' = \frac{\mathbf G+\mathbf P_i}{2}`,
        code: String.raw`
          struct Sphere { Point3D center; float radius; };

          Sphere BuildBoundingSphere(const Point3D* p, int count, const Vector3D& R)
          {
              int k = 0, l = 0;                                    // least and greatest P.R
              float lo = Dot(p[0], R), hi = lo;
              for (int i = 1; i < count; i++)
              {
                  float d = Dot(p[i], R);
                  if (d < lo) { lo = d; k = i; }
                  if (d > hi) { hi = d; l = i; }
              }

              Point3D Q = (p[k] + p[l]) * 0.5f;                    // Q = (Pk + Pl) / 2
              float r = Magnitude(p[k] - Q);                       // r = ||Pk - Q||

              for (int i = 0; i < count; i++)
              {
                  Vector3D d = p[i] - Q;
                  float d2 = SquaredMag(d);
                  if (d2 > r * r)                                  // P_i lies outside
                  {
                      float dist = std::sqrt(d2);
                      Point3D G = Q - d * (r / dist);              // far side of the old sphere
                      Q = (G + p[i]) * 0.5f;                       // new center halfway from G to P_i
                      r = Magnitude(p[i] - Q);
                  }
              }
              return Sphere{Q, r};
          }
        `,
      },
      {
        title: "Bounding ellipsoid by scaling to a cube",
        formula: String.raw`\mathbf M\mathbf P = \frac{\mathbf P\cdot\mathbf R}{a}\mathbf R + \frac{\mathbf P\cdot\mathbf S}{b}\mathbf S + \frac{\mathbf P\cdot\mathbf T}{c}\mathbf T, \qquad \text{semiaxes } ar,\ br,\ cr`,
        note: "<p>Multiplying by <b>M</b> is the same as rewriting the point in the R, S, T basis, dividing each coordinate by the box dimension, and converting back. Flat meshes have a zero dimension, so clamp a, b, c to a small minimum first.</p>",
        code: String.raw`
          #include <vector>

          Vector3D PrincipalAxis(const Point3D* p, int count);     // eigenvector with the largest eigenvalue

          struct Ellipsoid { Point3D center; Vector3D axis[3]; float semi[3]; };

          Ellipsoid BuildBoundingEllipsoid(const Point3D* p, int count, const OrientedBox& box)
          {
              const Vector3D& R = box.axis[0];
              const Vector3D& S = box.axis[1];
              const Vector3D& T = box.axis[2];
              float a = box.size[0], b = box.size[1], c = box.size[2];

              std::vector<Point3D> q(count);                        // q_i = M P_i fits in a unit cube
              for (int i = 0; i < count; i++)
                  q[i] = R * (Dot(p[i], R) / a) + S * (Dot(p[i], S) / b) + T * (Dot(p[i], T) / c);

              Sphere s = BuildBoundingSphere(q.data(), count, PrincipalAxis(q.data(), count));

              Ellipsoid e;
              const Point3D& Q = s.center;                          // M^-1 Q scales the center back
              e.center = R * (Dot(Q, R) * a) + S * (Dot(Q, S) * b) + T * (Dot(Q, T) * c);
              e.axis[0] = R;  e.axis[1] = S;  e.axis[2] = T;
              e.semi[0] = a * s.radius;  e.semi[1] = b * s.radius;  e.semi[2] = c * s.radius;
              return e;
          }
        `,
      },
      {
        title: "Bounding cylinder",
        formula: String.raw`\mathbf H_i = \mathbf P_i - (\mathbf P_i\cdot\mathbf R)\mathbf R,\qquad \mathbf Q_1 = \mathbf Q + \big(\min_i\mathbf P_i\cdot\mathbf R\big)\mathbf R,\quad \mathbf Q_2 = \mathbf Q + \big(\max_i\mathbf P_i\cdot\mathbf R\big)\mathbf R`,
        note: "<p>All the <b>H</b><sub>i</sub> lie in the plane through the origin perpendicular to <b>R</b>, so the sphere routine returns a circle in that plane.</p>",
        code: String.raw`
          struct Cylinder { Point3D q1, q2; float radius; };

          Cylinder BuildBoundingCylinder(const Point3D* p, int count, const Vector3D& R, const Vector3D& S)
          {
              std::vector<Point3D> h(count);
              float lo = Dot(p[0], R), hi = lo;
              for (int i = 0; i < count; i++)
              {
                  float d = Dot(p[i], R);
                  h[i] = p[i] - R * d;                             // H_i = P_i - (P_i . R) R
                  lo = (d < lo) ? d : lo;
                  hi = (d > hi) ? d : hi;
              }

              // bounding circle of the H_i: the same grow algorithm, starting on S
              Sphere circle = BuildBoundingSphere(h.data(), count, S);

              Cylinder cyl;
              cyl.q1 = circle.center + R * lo;                     // Q1 = Q + min(P.R) R
              cyl.q2 = circle.center + R * hi;                     // Q2 = Q + max(P.R) R
              cyl.radius = circle.radius;
              return cyl;
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 8.2 Bounding Volume Tests
  // ===========================================================================

  // Shape of a 2D bounding volume for the 8.2 sims: polygon outline, per-plane effective radii,
  // and (for cylinders and long boxes) the axis segment that is tested instead of the center.
  function volume2(kind, Q, angle, A, B, planes, segBox) {
    const Ru = [Math.cos(angle), Math.sin(angle)], Su = V.perp2(Ru);
    const N = (L) => [L[0], L[1]];
    const rect = (ha, hb) => [
      V.add(Q, V.add(V.scale(Ru, -ha), V.scale(Su, -hb))), V.add(Q, V.add(V.scale(Ru, ha), V.scale(Su, -hb))),
      V.add(Q, V.add(V.scale(Ru, ha), V.scale(Su, hb))), V.add(Q, V.add(V.scale(Ru, -ha), V.scale(Su, hb))),
    ];
    if (kind === "sphere") {
      return { poly: ellipsePts(Q, Ru, Su, B, B, 64), reff: planes.map(() => B), Ru, Su };
    }
    if (kind === "ellipsoid") {
      const Rv = V.scale(Ru, A), Sv = V.scale(Su, B);
      return { poly: ellipsePts(Q, Ru, Su, A, B, 96), reff: planes.map((L) => Math.hypot(V.dot(Rv, N(L)), V.dot(Sv, N(L)))), Ru, Su };
    }
    if (kind === "cylinder") {
      return {
        poly: rect(A, B), Ru, Su,
        reff: planes.map((L) => B * Math.sqrt(Math.max(0, 1 - V.dot(Ru, N(L)) ** 2))),
        seg: [V.sub(Q, V.scale(Ru, A)), V.add(Q, V.scale(Ru, A))],
      };
    }
    // box: R and S span the whole box (lengths = box dimensions)
    const Rv = V.scale(Ru, 2 * A), Sv = V.scale(Su, 2 * B);
    if (segBox) {
      return {
        poly: rect(A, B), Ru, Su,
        reff: planes.map((L) => 0.5 * Math.abs(V.dot(Sv, N(L)))),
        seg: [V.add(Q, V.scale(Rv, 0.5)), V.sub(Q, V.scale(Rv, 0.5))],
      };
    }
    return { poly: rect(A, B), Ru, Su, reff: planes.map((L) => 0.5 * (Math.abs(V.dot(Rv, N(L))) + Math.abs(V.dot(Sv, N(L))))) };
  }

  // Segment test of Sections 8.2.3 / 8.2.4: clip Q1Q2 against planes moved out by reff.
  function segmentTest(planes, reff, seg) {
    let q1 = seg[0], q2 = seg[1];
    const steps = [];
    for (let i = 0; i < planes.length; i++) {
      const L = planes[i], r = reff[i];
      const d1 = pdot(L, q1), d2 = pdot(L, q2);
      if (d1 <= -r && d2 <= -r) {
        steps.push({ i, d1, d2, r, what: "cull" });
        return { culled: true, steps, q1, q2 };
      }
      if (d1 < -r) {
        const t = (r + d1) / (d1 - d2);          // t = (reff + L.Q1) / L.(Q1 - Q2)
        q1 = V.lerp(q1, q2, t);
        steps.push({ i, d1, d2, r, what: "clip Q₁", t });
      } else if (d2 < -r) {
        const t = (r + d2) / (d2 - d1);
        q2 = V.lerp(q2, q1, t);
        steps.push({ i, d1, d2, r, what: "clip Q₂", t });
      } else {
        steps.push({ i, d1, d2, r, what: "pass" });
      }
    }
    return { culled: false, steps, q1, q2 };
  }

  L3D.topic({
    id: "8.2",
    summary: "Test spheres, ellipsoids, cylinders and boxes against the view frustum by moving its planes outward by each volume's effective radius.",

    lesson: String.raw`
      <p>Section 8.1 built the volumes. Now we test them against the view frustum. Every test in this section uses the
      same trick: instead of intersecting a shape with the frustum, <strong>move the frustum planes outward</strong>
      by the right amount and test a single point (or a line segment) against the moved planes.</p>

      <p>In camera space the six frustum planes (Table 5.1) are 4D vectors \(\mathbf L = \langle \mathbf N, D\rangle\)
      whose unit normals point <em>into</em> the frustum. With focal length \(e\), aspect ratio \(a\) (height / width)
      and near and far distances \(n\) and \(f\):</p>
      <table>
        <tr><th>plane</th><th>\(\mathbf L\)</th><th>plane</th><th>\(\mathbf L\)</th></tr>
        <tr><td>near</td><td>\(\langle 0, 0, -1, -n\rangle\)</td><td>far</td><td>\(\langle 0, 0, 1, f\rangle\)</td></tr>
        <tr><td>left</td><td>\(\frac{1}{\sqrt{e^2+1}}\langle e, 0, -1, 0\rangle\)</td><td>right</td><td>\(\frac{1}{\sqrt{e^2+1}}\langle -e, 0, -1, 0\rangle\)</td></tr>
        <tr><td>bottom</td><td>\(\frac{1}{\sqrt{e^2+a^2}}\langle 0, e, -a, 0\rangle\)</td><td>top</td><td>\(\frac{1}{\sqrt{e^2+a^2}}\langle 0, -e, -a, 0\rangle\)</td></tr>
      </table>
      <p>For a point \(\mathbf Q\) with \(w = 1\), the 4D dot product \(\mathbf L\cdot\mathbf Q = \mathbf N\cdot\mathbf Q + D\)
      is its signed distance to the plane: positive on the inside, negative on the outside.</p>

      <div class="key">An object can be culled when its bounding volume lies entirely outside <em>one single</em> plane.
      If the volume is centered at \(\mathbf Q\) and reaches a distance \(r_{\text{eff}}\) toward the plane (its
      <strong>effective radius</strong> for that plane), that happens exactly when
      \[ \mathbf L\cdot\mathbf Q \le -r_{\text{eff}}. \]
      Each kind of volume differs only in how \(r_{\text{eff}}\) is computed.</div>

      <h2 data-sub="8.2.1">Bounding Sphere Test</h2>
      <p>A sphere of radius \(r\) reaches the same distance \(r\) toward every plane, whatever the plane's orientation, so
      \(r_{\text{eff}} = r\). Compute \(\mathbf L\cdot\mathbf Q\) for the six planes. If any value is \(\le -r\), the center
      is more than \(r\) outside that plane, the whole sphere is outside, and the object is culled. Otherwise it is drawn.</p>
      <p>Geometrically, the region where the center can lie while the sphere still touches the frustum is the frustum
      "inflated" by \(r\): faces pushed out by \(r\), with rounded edges and corners. Moving the six planes outward gives a
      bigger frustum with <em>sharp</em> corners, which slightly overestimates that region. Near the frustum's edges and
      corners, a sphere can be outside the frustum and yet less than \(r\) outside every individual plane, so it is not
      culled (the book's Figure 8.4). That is a false positive: it costs a wasted draw call but never makes a visible object
      disappear, so engines accept it. Section 8.4.2 shows how extra planes reduce it.</p>

      <h2 data-sub="8.2.2">Bounding Ellipsoid Test</h2>
      <p>An ellipsoid is described by its center and three mutually perpendicular semiaxis <em>vectors</em>
      \(\mathbf R, \mathbf S, \mathbf T\) whose lengths are the semiaxis lengths. It is not the same in every direction,
      so its effective radius depends on the plane's normal \(\mathbf N\). Every point on its surface (relative to the
      center) can be written with spherical angles as
      \[ \mathbf P = \mathbf R\cos\theta\sin\phi + \mathbf S\sin\theta\sin\phi + \mathbf T\cos\phi , \]
      and its reach toward the plane is the largest value of \(\mathbf P\cdot\mathbf N\). Group the terms:
      \[ \mathbf P\cdot\mathbf N = \underbrace{\langle \mathbf R\cdot\mathbf N,\ \mathbf S\cdot\mathbf N,\ \mathbf T\cdot\mathbf N\rangle}_{\mathbf k}
         \cdot \underbrace{\langle \cos\theta\sin\phi,\ \sin\theta\sin\phi,\ \cos\phi\rangle}_{\mathbf u}. \]
      The vector \(\mathbf u\) is a unit vector, and as the angles vary it points in every direction. By the
      Cauchy–Schwarz inequality the largest value of \(\mathbf k\cdot\mathbf u\) is \(\lVert\mathbf k\rVert\), reached when
      \(\mathbf u\) points along \(\mathbf k\). (The book reaches the same result by setting the partial derivatives with
      respect to \(\theta\) and \(\phi\) to zero.)</p>
      <div class="formula">\[ r_{\text{eff}} = \sqrt{(\mathbf R\cdot\mathbf N)^2 + (\mathbf S\cdot\mathbf N)^2 + (\mathbf T\cdot\mathbf N)^2} \]</div>
      <p>For a sphere, \(\mathbf R, \mathbf S, \mathbf T\) are \(r\) times an orthonormal basis, and the formula gives
      \(r\), as it should. The near and far planes are parallel, so they share one effective radius, and an ellipsoid
      needs at most five square roots per frustum. Cull when \(\mathbf L\cdot\mathbf Q \le -r_{\text{eff}}\) for any plane.</p>

      <h2 data-sub="8.2.3">Bounding Cylinder Test</h2>
      <p>A cylinder has end points \(\mathbf Q_1, \mathbf Q_2\), radius \(r\) and unit axis
      \(\mathbf A = (\mathbf Q_2 - \mathbf Q_1)/\lVert\mathbf Q_2 - \mathbf Q_1\rVert\). Its end disks are perpendicular
      to \(\mathbf A\), and a disk reaches toward the plane by \(r\) times the part of \(\mathbf N\) that lies in the
      disk's plane. If \(\alpha\) is the angle between \(\mathbf A\) and \(\mathbf N\),</p>
      <div class="formula">\[ r_{\text{eff}} = r\sin\alpha = r\sqrt{1 - (\mathbf A\cdot\mathbf N)^2}. \]</div>
      <p>That is zero when the axis points straight at the plane and the full \(r\) when the axis is parallel to it. The
      length of the cylinder is handled by testing the axis <em>segment</em> \(\mathbf Q_1\mathbf Q_2\) instead of a point.
      For each plane \(\mathbf L\), with its own \(r_{\text{eff}}\):</p>
      <ul>
        <li>If both \(\mathbf L\cdot\mathbf Q_1 \le -r_{\text{eff}}\) and \(\mathbf L\cdot\mathbf Q_2 \le -r_{\text{eff}}\),
          the whole cylinder is outside. Cull it and stop.</li>
        <li>If both are \(\ge -r_{\text{eff}}\), this plane tells us nothing. Go on to the next plane.</li>
        <li>If one endpoint is in and the other is out, chop off the outside part. The point \(\mathbf Q_3\) on the segment
          with \(\mathbf L\cdot\mathbf Q_3 = -r_{\text{eff}}\) comes from \(\mathbf Q_3(t) = \mathbf Q_1 + t(\mathbf Q_2 - \mathbf Q_1)\):</li>
      </ul>
      <div class="formula">\[ t = \frac{r_{\text{eff}} + \mathbf L\cdot\mathbf Q_1}{\mathbf L\cdot(\mathbf Q_1 - \mathbf Q_2)} \]</div>
      <p>(The difference \(\mathbf Q_1 - \mathbf Q_2\) has \(w = 0\), so the plane's \(D\) cancels and the denominator is just
      \(\mathbf N\cdot(\mathbf Q_1-\mathbf Q_2)\).) Replace the outside endpoint with \(\mathbf Q_3\) and continue with the
      shorter segment. Clipping matters: a long cylinder can poke out past two different planes, and only after the first
      plane trims it does the second plane see that what remains is entirely outside. If all six planes are visited
      without a cull, the cylinder is probably at least partly visible. The book starts with the near and far planes,
      which share one effective radius.</p>

      <h2 data-sub="8.2.4">Bounding Box Test</h2>
      <p>For a box, let \(\mathbf R, \mathbf S, \mathbf T\) be the edge vectors with lengths equal to the full box
      dimensions, and \(\mathbf Q\) the center. A corner is \(\mathbf Q \pm \tfrac12\mathbf R \pm \tfrac12\mathbf S \pm \tfrac12\mathbf T\).
      The corner that reaches farthest toward the plane picks each sign to make its term positive, so each half-edge
      contributes \(\tfrac12|\mathbf R\cdot\mathbf N|\) and so on:</p>
      <div class="formula">\[ r_{\text{eff}} = \tfrac12\big(|\mathbf R\cdot\mathbf N| + |\mathbf S\cdot\mathbf N| + |\mathbf T\cdot\mathbf N|\big) \]</div>
      <p>Then proceed exactly as for an ellipsoid: cull if \(\mathbf L\cdot\mathbf Q \le -r_{\text{eff}}\) for any plane.
      This is the most common culling test in practice, because an axis-aligned box in world space (or a box in object
      space) is so cheap to store.</p>
      <p>For a <strong>long, thin box</strong> (\(\mathbf R\) much longer than \(\mathbf S\) and \(\mathbf T\)) the point test
      is weak. The \(|\mathbf R\cdot\mathbf N|\) term makes the effective radius large for every plane that isn't
      parallel to \(\mathbf R\), so a box lying far outside the frustum near a corner may never be rejected (Figure 8.8).
      Switch to the cylinder's segment test instead. Use the box's long axis as the segment and drop its term from the radius:</p>
      <div class="formula">\[ \mathbf Q_1 = \mathbf Q + \tfrac12\mathbf R, \quad \mathbf Q_2 = \mathbf Q - \tfrac12\mathbf R, \qquad
         r_{\text{eff}} = \tfrac12\big(|\mathbf S\cdot\mathbf N| + |\mathbf T\cdot\mathbf N|\big) \]</div>

      <table>
        <tr><th>Volume</th><th>Tested element</th><th>\(r_{\text{eff}}\) for plane normal \(\mathbf N\)</th></tr>
        <tr><td>Sphere</td><td>center</td><td>\(r\)</td></tr>
        <tr><td>Ellipsoid</td><td>center</td><td>\(\sqrt{(\mathbf R\cdot\mathbf N)^2+(\mathbf S\cdot\mathbf N)^2+(\mathbf T\cdot\mathbf N)^2}\)</td></tr>
        <tr><td>Cylinder</td><td>axis segment</td><td>\(r\sqrt{1-(\mathbf A\cdot\mathbf N)^2}\)</td></tr>
        <tr><td>Box</td><td>center</td><td>\(\tfrac12(|\mathbf R\cdot\mathbf N|+|\mathbf S\cdot\mathbf N|+|\mathbf T\cdot\mathbf N|)\)</td></tr>
        <tr><td>Long box</td><td>long-axis segment</td><td>\(\tfrac12(|\mathbf S\cdot\mathbf N|+|\mathbf T\cdot\mathbf N|)\)</td></tr>
      </table>

      <div class="game">Culling runs for every object in every frame, so it pays to keep it lean. Common tricks: test a
      bounding sphere first and the tighter box only if the sphere survives; remember which plane rejected an object last
      frame and test that plane first next frame (objects rarely jump across the screen); and process four or eight objects
      at once with SIMD, since the test is the same multiply-add for every object.</div>

      <div class="warn">All of these tests are <strong>conservative</strong>: they can report "visible" for an object that is
      actually outside, but never the reverse. If an object ever pops out of view while it should be visible, look for a
      sign error or a plane normal that isn't unit length. \(\mathbf L\cdot\mathbf Q\) is a true distance only when
      \(\lVert\mathbf N\rVert = 1\).</div>

      <p><a class="btn goto-sim" href="#/8.2/sim">Try it: cull volumes against a frustum →</a></p>
    `,

    keyFormulas: [
      ["Cull condition", String.raw`\mathbf L\cdot\mathbf Q \le -r_{\text{eff}} \text{ for any frustum plane } \mathbf L`],
      ["Ellipsoid effective radius", String.raw`r_{\text{eff}} = \sqrt{(\mathbf R\cdot\mathbf N)^2+(\mathbf S\cdot\mathbf N)^2+(\mathbf T\cdot\mathbf N)^2}`],
      ["Cylinder effective radius", String.raw`r_{\text{eff}} = r\sqrt{1-(\mathbf A\cdot\mathbf N)^2}`],
      ["Segment clipping", String.raw`\mathbf Q_3 = \mathbf Q_1 + t(\mathbf Q_2-\mathbf Q_1),\quad t = \frac{r_{\text{eff}} + \mathbf L\cdot\mathbf Q_1}{\mathbf L\cdot(\mathbf Q_1-\mathbf Q_2)}`],
      ["Box effective radius", String.raw`r_{\text{eff}} = \tfrac12\big(|\mathbf R\cdot\mathbf N|+|\mathbf S\cdot\mathbf N|+|\mathbf T\cdot\mathbf N|\big)`],
    ],

    exercises: [
      { q: String.raw`(Book exercise 3) A box has edge vectors \(\mathbf R = \langle 2,0,1\rangle\), \(\mathbf S = \langle 1,0,-2\rangle\), \(\mathbf T = \langle 0,1,0\rangle\). Find its effective radius for the plane normal \(\mathbf N = \tfrac{\sqrt3}{3}\langle 1,-1,1\rangle\).`,
        a: String.raw`\(\mathbf R\cdot\mathbf N = 3/\sqrt3 = \sqrt3\), \(\mathbf S\cdot\mathbf N = -1/\sqrt3\), \(\mathbf T\cdot\mathbf N = -1/\sqrt3\). So
          \(r_{\text{eff}} = \tfrac12\big(\sqrt3 + \tfrac{2}{\sqrt3}\big) = \tfrac{5}{2\sqrt3} \approx 1.443\).` },
      { q: String.raw`The near plane is \(\langle 0,0,-1,-1\rangle\). A sphere of radius 0.4 is centered at \(\mathbf Q = (0, 0, -0.5)\). Is it culled?`,
        a: String.raw`\(\mathbf L\cdot\mathbf Q = 0.5 - 1 = -0.5 \le -0.4\). Yes: the whole sphere lies between the camera and the near plane.` },
      { q: String.raw`An ellipsoid has semiaxes \(\mathbf R = \langle 3,0,0\rangle\), \(\mathbf S = \langle 0,1,0\rangle\), \(\mathbf T = \langle 0,0,1\rangle\). Find \(r_{\text{eff}}\) for \(\mathbf N = \langle 1,0,0\rangle\) and for \(\mathbf N = \langle 0.6, 0.8, 0\rangle\).`,
        a: String.raw`For \(\langle1,0,0\rangle\): \(\sqrt{9} = 3\). For \(\langle0.6,0.8,0\rangle\): \(\sqrt{1.8^2 + 0.8^2} = \sqrt{3.88} \approx 1.97\).` },
      { q: String.raw`A cylinder of radius 2 has axis \(\mathbf A = \langle 0,1,0\rangle\). What is its effective radius for a plane with normal \(\langle0,1,0\rangle\)? With \(\langle 1,0,0\rangle\)? With a normal at 45° to the axis?`,
        a: String.raw`0 (the axis points straight at the plane, and the segment test covers its length), 2 (the axis is parallel to the plane), and
          \(2\sqrt{1 - 1/2} = \sqrt2 \approx 1.41\).` },
      { q: String.raw`A segment has \(\mathbf L\cdot\mathbf Q_1 = -3\) and \(\mathbf L\cdot\mathbf Q_2 = 1\), and \(r_{\text{eff}} = 1\). What happens?`,
        a: String.raw`\(\mathbf Q_1\) is outside (\(-3 \lt -1\)) and \(\mathbf Q_2\) is inside, so clip. \(t = (1 + (-3))/(-3 - 1) = 0.5\), and \(\mathbf Q_3\) is the
          midpoint. Check: \(\mathbf L\cdot\mathbf Q_3 = -3 + 0.5\cdot4 = -1 = -r_{\text{eff}}\). Replace \(\mathbf Q_1\) with \(\mathbf Q_3\) and continue.` },
    ],

    sims: [
      {
        title: "Frustum culling, seen from above",
        help: String.raw`<p>A top-down view of a camera frustum (blue). Drag the object's center <b>Q</b>, the camera, and its
          aim handle. The dashed outline is the frustum with every plane moved out by the object's effective radius for that
          plane: the point test passes when <b>Q</b> is inside it. The object turns <b>red</b> when it is culled,
          <b>green</b> when it is drawn and really is visible, and <b>gold</b> for a false positive (drawn, although it is
          completely outside). For the sphere, the dotted rounded outline is the exact region for its center. Push a sphere
          toward a frustum corner to find a false positive, then try a long box with and without the segment test.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 6, height: 470 });
          const out = sim.readout(readout);
          const rig = cameraRig(view, [-6.5, -2.6], [1, 0.32], 2);
          const obj = view.handle([3.2, 3.9], { color: "b", label: "Q" });
          const redraw = () => view.redraw();
          const kind = sim.segmented(controls, {
            label: "Bounding volume",
            options: [["sphere", "Sphere"], ["ellipsoid", "Ellipsoid"], ["cylinder", "Cylinder"], ["box", "Box"]],
            value: "sphere", onChange: redraw,
          });
          const sa = sim.slider(controls, { label: "Half-length along R", min: 0.2, max: 4, step: 0.05, value: 2.6, onInput: redraw });
          const sb = sim.slider(controls, { label: "Radius / half-width along S", min: 0.2, max: 2.5, step: 0.05, value: 0.9, onInput: redraw });
          const rot = sim.slider(controls, { label: "Rotation", min: 0, max: 180, step: 1, value: 30, unit: "°", onInput: redraw });
          const fov = sim.slider(controls, { label: "Field of view", min: 30, max: 120, step: 1, value: 60, unit: "°", onInput: redraw });
          const far = sim.slider(controls, { label: "Far distance", min: 4, max: 14, step: 0.1, value: 10, onInput: redraw });
          const showMoved = sim.checkbox(controls, { label: "Show the moved planes", value: true, onChange: redraw });
          const segBox = sim.checkbox(controls, { label: "Box: use the segment test (long boxes)", value: false, onChange: redraw });
          sim.legend(controls, [["c", "drawn, visible"], ["g", "drawn, false positive"], ["e", "culled"]]);

          view.onDraw((v) => {
            v.grid({ step: 1 });
            const f = rig.forward();
            const fr = frustum2(rig.C.pos, f, fov.value, 0.6, far.value);
            const Q = obj.pos, K = kind.value;
            const vol = volume2(K, Q, rad(rot.value), sa.value, sb.value, fr.planes, segBox.value);
            const exact = convexOverlap(vol.poly, fr.corners);
            let culled, seg = null;
            const rows = [];
            if (vol.seg) {
              seg = segmentTest(fr.planes, vol.reff, vol.seg);
              culled = seg.culled;
              seg.steps.forEach((s) => rows.push([fr.names[s.i], `${fmt(s.d1)}, ${fmt(s.d2)} vs ${fmt(-s.r)}`, s.what === "cull" ? "bad" : ""]));
              seg.steps.forEach((s, k) => { rows[k][1] += ` → ${s.what}${s.t !== undefined ? ` (t=${fmt(s.t)})` : ""}`; });
            } else {
              culled = false;
              fr.planes.forEach((L, i) => {
                const d = pdot(L, Q), outside = d <= -vol.reff[i];
                culled = culled || outside;
                rows.push([fr.names[i], `${fmt(d)} vs ${fmt(-vol.reff[i])}${outside ? " → outside" : ""}`, outside ? "bad" : ""]);
              });
            }

            v.polygon(fr.corners, { fill: "a", fillAlpha: 0.08, color: "a", width: 2 });
            if (showMoved.value) {
              const ex = expandedPolygon(fr.planes, vol.reff);
              if (ex.length === 4) v.polygon(ex, { color: "fg", dash: [7, 5], width: 1.25, alpha: 0.7 });
              if (K === "sphere") {
                // exact region for the sphere's center: the frustum inflated by r with rounded corners
                const r = sb.value, pts = [];
                const nOut = fr.planes.map((L) => [-L[0], -L[1]]);
                for (let i = 0; i < 4; i++) {
                  const a0 = Math.atan2(nOut[(i + 3) % 4][1], nOut[(i + 3) % 4][0]);
                  let a1 = Math.atan2(nOut[i][1], nOut[i][0]);
                  while (a1 < a0) a1 += 2 * Math.PI;
                  for (let k = 0; k <= 12; k++) {
                    const t = a0 + ((a1 - a0) * k) / 12;
                    pts.push(V.add(fr.corners[i], [r * Math.cos(t), r * Math.sin(t)]));
                  }
                }
                v.polygon(pts, { color: "c", dash: [2, 4], width: 1.5 });
              }
            }
            const col = culled ? "e" : exact ? "c" : "g";
            v.polygon(vol.poly, { fill: col, fillAlpha: 0.22, color: col, width: 2 });
            if (seg) {
              v.line(vol.seg[0], vol.seg[1], { color: col, dash: [4, 4], width: 1.5 });
              if (!seg.culled) v.line(seg.q1, seg.q2, { color: col, width: 4 });
              v.text(vol.seg[0], "Q₁", { color: col, offset: [6, -6], size: 12 });
              v.text(vol.seg[1], "Q₂", { color: col, offset: [6, -6], size: 12 });
            }
            fr.corners.forEach((p, i) => {
              const q = fr.corners[(i + 1) % 4], mid = V.lerp(p, q, 0.5);
              v.text(V.add(mid, V.scale([fr.planes[i][0], fr.planes[i][1]], -0.45)), fr.names[i], { color: "a", size: 11, align: "center" });
            });

            const verdict = culled ? `<b class="bad">Culled</b>: outside at least one moved plane.`
              : exact ? `<b class="ok">Drawn</b>, and it really does overlap the frustum.`
                : `<b style="color:${sim.color("g")}">Drawn, but outside the frustum</b>: a false positive. No single plane rejects it.`;
            out.set(`<div>${vol.seg ? "L·Q₁, L·Q₂ vs −r_eff" : "L·Q vs −r_eff"} for each plane</div>` +
              sim.rows(rows) + "<hr>" +
              sim.rows(fr.planes.map((L, i) => ["r_eff (" + fr.names[i] + ")", fmt(vol.reff[i], 3)])) +
              `<hr>${verdict}`);
          });
        },
      },
      {
        title: "Effective radius of a volume",
        help: String.raw`<p>The effective radius is how far a volume reaches from its center in the direction of the plane
          normal \(\mathbf N\). Rotate the volume and the normal. The dashed lines perpendicular to \(\mathbf N\) are placed by
          the <em>formula</em>, and they should just touch the shape. The readout compares the formula with the largest
          \(\mathbf P\cdot\mathbf N\) measured over the outline. In this 2D slice the ellipsoid and box formulas lose
          their \(\mathbf T\) term. For the cylinder, the formula covers only the end disks; the segment from
          \(\mathbf Q_1\) to \(\mathbf Q_2\) supplies the rest of the reach.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 4.2, height: 440 });
          const out = sim.readout(readout);
          const redraw = () => view.redraw();
          const kind = sim.segmented(controls, {
            label: "Volume", options: [["ellipsoid", "Ellipsoid"], ["cylinder", "Cylinder"], ["box", "Box"]], value: "ellipsoid", onChange: redraw,
          });
          const rot = sim.slider(controls, { label: "Volume rotation", min: 0, max: 180, step: 1, value: 25, unit: "°", onInput: redraw });
          const nAng = sim.slider(controls, { label: "Plane normal angle", min: 0, max: 360, step: 1, value: 70, unit: "°", onInput: redraw });
          const sa = sim.slider(controls, { label: "Half-length along R", min: 0.3, max: 3, step: 0.05, value: 2.2, onInput: redraw });
          const sb = sim.slider(controls, { label: "Radius / half-width along S", min: 0.2, max: 2, step: 0.05, value: 0.8, onInput: redraw });

          view.onDraw((v) => {
            v.grid({ step: 1 });
            v.axes();
            const K = kind.value, O = [0, 0];
            const N = [Math.cos(rad(nAng.value)), Math.sin(rad(nAng.value))];
            const plane = [N[0], N[1], 0];
            const vol = volume2(K, O, rad(rot.value), sa.value, sb.value, [plane], false);
            const reff = vol.reff[0];
            // measured reach: densely sample the outline
            const dense = K === "ellipsoid" ? ellipsePts(O, vol.Ru, vol.Su, sa.value, sb.value, 720) : vol.poly;
            let best = dense[0], bestD = -Infinity;
            for (const p of dense) { const d = V.dot(p, N); if (d > bestD) { bestD = d; best = p; } }
            const axisReach = K === "cylinder" ? Math.abs(sa.value * V.dot(vol.Ru, N)) : 0;
            const reach = axisReach + reff;
            const T = V.perp2(N);
            for (const s of [1, -1]) v.infiniteLine(V.scale(N, s * reach), T, { color: "e", dash: [7, 5], width: 1.5 });
            v.polygon(vol.poly, { fill: "c", fillAlpha: 0.18, color: "c", width: 2 });
            if (K === "cylinder") {
              const q1 = V.scale(vol.Ru, -sa.value), q2 = V.scale(vol.Ru, sa.value);
              v.line(q1, q2, { color: "c", dash: [4, 4], width: 1.5 });
              v.point(q1, { color: "c", label: "Q₁" });
              v.point(q2, { color: "c", label: "Q₂" });
              const qe = V.dot(q1, N) > V.dot(q2, N) ? q1 : q2;
              v.line(qe, V.add(qe, V.scale(N, reff)), { color: "d", width: 3 });
              v.text(V.add(qe, V.scale(N, reff / 2)), "r_eff", { color: "d", offset: [8, 0], size: 12 });
            } else {
              v.line(O, V.scale(N, reff), { color: "d", width: 3 });
              v.text(V.scale(N, reff / 2), "r_eff", { color: "d", offset: [8, 0], size: 12 });
            }
            const Rv = V.scale(vol.Ru, K === "box" ? 2 * sa.value : sa.value);
            const Sv = V.scale(vol.Su, K === "box" ? 2 * sb.value : sb.value);
            v.arrow(O, Rv, { color: "a", label: "R", width: 2 });
            if (K !== "cylinder") v.arrow(O, Sv, { color: "b", label: "S", width: 2 });
            v.arrow(O, V.scale(N, 1.2), { color: "e", label: "N", width: 3 });
            v.point(best, { color: "g", r: 6, label: "farthest point" });

            const rn = V.dot(Rv, N), sn = V.dot(Sv, N);
            let terms;
            if (K === "ellipsoid") terms = [["R·N", fmt(rn, 3)], ["S·N", fmt(sn, 3)], ["√((R·N)² + (S·N)²)", fmt(reff, 3)]];
            else if (K === "box") terms = [["R·N", fmt(rn, 3)], ["S·N", fmt(sn, 3)], ["½(|R·N| + |S·N|)", fmt(reff, 3)]];
            else terms = [["A·N", fmt(V.dot(vol.Ru, N), 3)], ["r √(1 − (A·N)²)", fmt(reff, 3)], ["axis reach |h A·N|", fmt(axisReach, 3)]];
            const ok = Math.abs(bestD - reach) < 0.01;
            out.set(sim.rows(terms) + "<hr>" + sim.rows([
              ["formula reach", fmt(reach, 3)],
              ["measured max P·N", fmt(bestD, 3)],
              ["match", ok ? "✓" : "≈", ok ? "ok" : ""],
            ]));
          });
        },
      },
    ],

    cpp: [
      {
        title: "Frustum planes in camera space (Table 5.1)",
        formula: String.raw`\text{left} = \tfrac{1}{\sqrt{e^2+1}}\langle e, 0, -1, 0\rangle,\quad \text{bottom} = \tfrac{1}{\sqrt{e^2+a^2}}\langle 0, e, -a, 0\rangle,\ \dots`,
        note: "<p>Normals point into the frustum and have unit length, so <code>DotPoint(plane, Q)</code> is a signed distance. e is the focal length 1 / tan(fov<sub>x</sub> / 2) and a is height / width.</p>",
        code: String.raw`
          void BuildFrustumPlanes(float e, float a, float n, float f, Plane planes[6])
          {
              float s = 1.0f / std::sqrt(e * e + 1.0f);
              float t = 1.0f / std::sqrt(e * e + a * a);
              planes[0] = Plane(Vector3D(0.0f, 0.0f, -1.0f), -n);       // near
              planes[1] = Plane(Vector3D(0.0f, 0.0f,  1.0f),  f);       // far
              planes[2] = Plane(Vector3D( e * s, 0.0f, -s), 0.0f);      // left
              planes[3] = Plane(Vector3D(-e * s, 0.0f, -s), 0.0f);      // right
              planes[4] = Plane(Vector3D(0.0f,  e * t, -a * t), 0.0f);  // bottom
              planes[5] = Plane(Vector3D(0.0f, -e * t, -a * t), 0.0f);  // top
          }
        `,
      },
      {
        title: "Sphere and ellipsoid tests",
        formula: String.raw`\mathbf L\cdot\mathbf Q \le -r_{\text{eff}},\qquad r_{\text{eff}}^{\text{ellipsoid}} = \sqrt{(\mathbf R\cdot\mathbf N)^2+(\mathbf S\cdot\mathbf N)^2+(\mathbf T\cdot\mathbf N)^2}`,
        code: String.raw`
          bool SphereVisible(const Plane planes[6], const Point3D& Q, float r)
          {
              for (int i = 0; i < 6; i++)
              {
                  if (DotPoint(planes[i], Q) <= -r) return false;     // entirely outside plane i
              }
              return true;                                            // probably visible
          }

          float EllipsoidRadius(const Vector3D& R, const Vector3D& S, const Vector3D& T, const Vector3D& N)
          {
              float rn = Dot(R, N), sn = Dot(S, N), tn = Dot(T, N);
              return std::sqrt(rn * rn + sn * sn + tn * tn);
          }

          bool EllipsoidVisible(const Plane planes[6], const Point3D& Q,
                                const Vector3D& R, const Vector3D& S, const Vector3D& T)
          {
              float rNearFar = EllipsoidRadius(R, S, T, planes[0].GetNormal());   // near and far are parallel
              for (int i = 0; i < 6; i++)
              {
                  float reff = (i < 2) ? rNearFar : EllipsoidRadius(R, S, T, planes[i].GetNormal());
                  if (DotPoint(planes[i], Q) <= -reff) return false;
              }
              return true;
          }
        `,
      },
      {
        title: "Cylinder test: clip the axis segment",
        formula: String.raw`r_{\text{eff}} = r\sqrt{1-(\mathbf A\cdot\mathbf N)^2},\qquad t = \frac{r_{\text{eff}} + \mathbf L\cdot\mathbf Q_1}{\mathbf L\cdot(\mathbf Q_1-\mathbf Q_2)}`,
        code: String.raw`
          bool CylinderVisible(const Plane planes[6], Point3D q1, Point3D q2, float r)
          {
              Vector3D A = Normalize(q2 - q1);                         // unit axis
              for (int i = 0; i < 6; i++)
              {
                  const Plane& L = planes[i];
                  float an = Dot(A, L.GetNormal());
                  float s2 = 1.0f - an * an;
                  float reff = r * std::sqrt(s2 > 0.0f ? s2 : 0.0f);   // r sin(alpha)

                  float d1 = DotPoint(L, q1), d2 = DotPoint(L, q2);
                  if (d1 <= -reff && d2 <= -reff) return false;       // whole segment outside
                  if (d1 < -reff)                                     // chop off the outside part
                  {
                      float t = (reff + d1) / (d1 - d2);               // L.(Q1 - Q2) = d1 - d2
                      q1 = q1 + (q2 - q1) * t;
                  }
                  else if (d2 < -reff)
                  {
                      float t = (reff + d2) / (d2 - d1);
                      q2 = q2 + (q1 - q2) * t;
                  }
              }
              return true;                                            // probably visible
          }
        `,
      },
      {
        title: "Box test (and the long-box variant)",
        formula: String.raw`r_{\text{eff}} = \tfrac12\big(|\mathbf R\cdot\mathbf N|+|\mathbf S\cdot\mathbf N|+|\mathbf T\cdot\mathbf N|\big)`,
        note: "<p>Here <b>R</b>, <b>S</b>, <b>T</b> span the full box, so their lengths are the box dimensions. For a long box, run the cylinder routine on the segment <b>Q</b> ± ½<b>R</b> with r<sub>eff</sub> = ½(|S·N| + |T·N|).</p>",
        code: String.raw`
          float BoxRadius(const Vector3D& R, const Vector3D& S, const Vector3D& T, const Vector3D& N)
          {
              return 0.5f * (std::fabs(Dot(R, N)) + std::fabs(Dot(S, N)) + std::fabs(Dot(T, N)));
          }

          bool BoxVisible(const Plane planes[6], const Point3D& Q,
                          const Vector3D& R, const Vector3D& S, const Vector3D& T)
          {
              for (int i = 0; i < 6; i++)
              {
                  float reff = BoxRadius(R, S, T, planes[i].GetNormal());
                  if (DotPoint(planes[i], Q) <= -reff) return false;   // all 8 corners outside
              }
              return true;
          }
        `,
      },
    ],
  });

  // @@NEXT@@
})();
