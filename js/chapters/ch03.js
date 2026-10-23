// Chapter 3 - Matrices
(function () {
  "use strict";
  const { V, M, fmt, fmtVec, rad, deg, clamp, lerp } = L3D.math;

  // ===========================================================================
  // Helpers shared by the simulations in this chapter
  // ===========================================================================
  const minus = (s) => String(s).replace(/-/g, "−");
  const dec = (x, d = 2) => minus(fmt(x, d));
  const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const SUBS = "₀₁₂₃₄₅₆₇₈₉";
  const sub = (n) => String(n).split("").map((ch) => SUBS[+ch] || ch).join("");
  const ease = (t) => t * t * (3 - 2 * t);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // x as a short fraction (7/4) when it is one, otherwise as a decimal.
  function frac(x, digits = 2) {
    if (!Number.isFinite(x)) return "∞";
    if (Math.abs(x) < 1e-9) return "0";
    for (let d = 1; d <= 99; d++) {
      const n = Math.round(x * d);
      if (Math.abs(x * d - n) < 1e-6 * d && Math.abs(n) < 100000) return minus(d === 1 ? String(n) : n + "/" + d);
    }
    return minus(fmt(x, digits));
  }

  // Monospace text block for a matrix, used in readouts.
  function matText(m, f = dec) {
    const s = m.map((r) => r.map((x) => minus(f(x))));
    const w = Math.max(...s.flat().map((t) => t.length));
    return s.map((r) => "[ " + r.map((t) => t.padStart(w)).join("  ") + " ]").join("\n");
  }
  const matBox = (m, f) => `<div class="eq">${matText(m, f)}</div>`;

  // Draw a bracketed matrix on a raw canvas (sim.canvas). Options:
  //   cw, ch      cell size in px            fmt(v)     number -> string
  //   hl(i, j)    background color key, or [key, alpha], for a cell
  //   color(i,j)  text color key             sep        column index of the bar in an augmented matrix
  //   title       caption (above, or below with titleBelow)
  function drawMatrix(c, x, y, m, o = {}) {
    const ctx = c.ctx, sim = c.sim;
    const cw = o.cw || 54, ch = o.ch || 30;
    const R = m.length, C = m[0].length, w = C * cw, h = R * ch;
    const f = o.fmt || dec;
    for (let i = 0; i < R; i++) {
      for (let j = 0; j < C; j++) {
        const k = o.hl && o.hl(i, j);
        if (!k) continue;
        const [key, alpha] = Array.isArray(k) ? k : [k, 0.24];
        ctx.fillStyle = L3D.color.withAlpha(sim.color(key), alpha);
        ctx.fillRect(x + j * cw + 2, y + i * ch + 2, cw - 4, ch - 4);
      }
    }
    ctx.strokeStyle = sim.color("fg");
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x + 6, y); ctx.lineTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + 6, y + h);
    ctx.moveTo(x + w - 6, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - 6, y + h);
    ctx.stroke();
    if (o.sep != null) {
      ctx.strokeStyle = sim.color("muted");
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x + o.sep * cw, y + 4);
      ctx.lineTo(x + o.sep * cw, y + h - 4);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const size = o.size || 13;
    for (let i = 0; i < R; i++) {
      for (let j = 0; j < C; j++) {
        c.label(x + (j + 0.5) * cw, y + (i + 0.5) * ch + size * 0.36, minus(f(m[i][j])), {
          align: "center", size, weight: 600, color: (o.color && o.color(i, j)) || "fg",
        });
      }
    }
    if (o.title) {
      c.label(x + w / 2, o.titleBelow ? y + h + 18 : y - 9, o.title, { align: "center", size: 12.5, weight: 700, color: o.titleColor || "muted" });
    }
    return { w, h };
  }

  // ---- 2x2 helpers (m[row][col], column vectors)
  const mul2 = (m, p) => [m[0][0] * p[0] + m[0][1] * p[1], m[1][0] * p[0] + m[1][1] * p[1]];
  const cols2 = (a, b) => [[a[0], b[0]], [a[1], b[1]]];
  const det2 = (m) => m[0][0] * m[1][1] - m[0][1] * m[1][0];
  const rot2 = (t) => [[Math.cos(t), -Math.sin(t)], [Math.sin(t), Math.cos(t)]];
  const inv2 = (m) => {
    const d = det2(m);
    return Math.abs(d) < 1e-9 ? null : [[m[1][1] / d, -m[0][1] / d], [-m[1][0] / d, m[0][0] / d]];
  };
  const SQUARE = [[0, 0], [1, 0], [1, 1], [0, 1]];
  // The letter F has no symmetry, so rotations and mirror images are easy to spot.
  const F_SHAPE = [[0, 0], [0.25, 0], [0.25, 0.45], [0.6, 0.45], [0.6, 0.65], [0.25, 0.65], [0.25, 0.8], [0.75, 0.8], [0.75, 1], [0, 1]];

  // The image of the integer grid under the 2x2 matrix m.
  function drawGrid2(v, m, { n = 6, color = "d", alpha = 0.22 } = {}) {
    const a = [m[0][0], m[1][0]], b = [m[0][1], m[1][1]];
    for (let k = -n; k <= n; k++) {
      const width = k === 0 ? 1.6 : 1;
      v.line(V.add(V.scale(a, -n), V.scale(b, k)), V.add(V.scale(a, n), V.scale(b, k)), { color, alpha, width });
      v.line(V.add(V.scale(b, -n), V.scale(a, k)), V.add(V.scale(b, n), V.scale(a, k)), { color, alpha, width });
    }
  }

  // The unit square and the letter F after the transform m.
  function drawShape2(v, m, { color = "d", fill = 0.35, ghost = false } = {}) {
    const T = (p) => mul2(m, p);
    const dash = ghost ? [5, 4] : null;
    v.polygon(SQUARE.map(T), { color, width: 1.2, dash, fill: ghost ? null : color, fillAlpha: 0.06 });
    v.polygon(F_SHAPE.map(T), { fill: ghost ? null : color, fillAlpha: fill, color, width: 1.5, dash });
  }

  // Eigen-analysis of a 2x2 matrix through its characteristic polynomial.
  function eigvec2(m, lam) {
    const r1 = [m[0][0] - lam, m[0][1]], r2 = [m[1][0], m[1][1] - lam];
    const n1 = V.len(r1), n2 = V.len(r2);
    if (Math.max(n1, n2) < 1e-9) return null;            // M = lambda I: every vector works
    const r = n1 >= n2 ? r1 : r2;
    return V.norm([-r[1], r[0]]);                         // perpendicular to the row
  }
  function eig2(m) {
    const tr = m[0][0] + m[1][1], det = det2(m), disc = tr * tr - 4 * det;
    if (disc < -1e-12) return { real: false, tr, det, disc, re: tr / 2, im: Math.sqrt(-disc) / 2 };
    const s = Math.sqrt(Math.max(0, disc));
    const l = [(tr + s) / 2, (tr - s) / 2];
    return { real: true, tr, det, disc, l, vecs: l.map((lam) => eigvec2(m, lam)) };
  }

  // Algorithm 3.6 / 3.12: bring the first n columns of an augmented matrix to reduced form,
  // recording every elementary row operation as a step { m, text, op }.
  function gaussJordanSteps(aug, n) {
    const rows = aug.length, cols = aug[0].length;
    const m = aug.map((r) => r.slice());
    const steps = [];
    const clean = () => m.forEach((r) => r.forEach((x, c) => { if (Math.abs(x) < 1e-11) r[c] = 0; }));
    const snap = (text, op) => steps.push({ m: m.map((r) => r.slice()), text, op });
    snap("Start with the augmented matrix.", { type: "start" });
    let i = 0;
    for (let j = 0; j < n && i < rows; j++) {
      let k = -1, best = 1e-10;
      for (let r = i; r < rows; r++) if (Math.abs(m[r][j]) > best) { best = Math.abs(m[r][j]); k = r; }
      if (k < 0) {
        snap(`Column ${j + 1} has no nonzero entry in row ${i + 1} or below, so it gets no leading 1. Its variable will be free.`, { type: "skip", col: j, row: i });
        continue;
      }
      if (k !== i) {
        [m[i], m[k]] = [m[k], m[i]];
        snap(`Pivot: exchange rows ${i + 1} and ${k + 1}, because row ${k + 1} holds the largest |entry| in column ${j + 1}.`, { type: "swap", rows: [i, k], col: j, row: i });
      }
      const p = m[i][j];
      if (Math.abs(p - 1) > 1e-12) {
        for (let c = 0; c < cols; c++) m[i][c] /= p;
        clean();
        snap(`Multiply row ${i + 1} by ${frac(1 / p)} so its leading entry becomes 1.`, { type: "scale", rows: [i], col: j, row: i, s: 1 / p });
      }
      const parts = [], adds = [];
      for (let r = 0; r < rows; r++) {
        if (r === i || Math.abs(m[r][j]) < 1e-12) continue;
        const f = -m[r][j];
        for (let c = 0; c < cols; c++) m[r][c] += f * m[i][c];
        parts.push(`add ${frac(f)} × row ${i + 1} to row ${r + 1}`);
        adds.push([r, f]);
      }
      clean();
      if (parts.length) snap(cap(parts.join(", ")) + `. Column ${j + 1} is now zero apart from the leading 1.`, { type: "add", col: j, row: i, adds });
      i++;
    }
    return steps;
  }

  // Read a reduced augmented matrix [R | c] with n unknowns.
  function classify(red, n) {
    const lead = [];
    for (const r of red) {
      let j = -1;
      for (let c = 0; c < n; c++) if (Math.abs(r[c]) > 1e-9) { j = c; break; }
      if (j < 0) {
        if (Math.abs(r[n]) > 1e-9) return { type: "none" };
        continue;
      }
      lead.push([j, r]);
    }
    if (lead.length === n) {
      const x = Array(n).fill(0);
      for (const [j, r] of lead) x[j] = r[n];
      return { type: "unique", x };
    }
    const free = [];
    for (let j = 0; j < n; j++) if (!lead.some(([l]) => l === j)) free.push(j);
    const p = Array(n).fill(0);
    for (const [j, r] of lead) p[j] = r[n];
    const dirs = free.map((f) => {
      const d = Array(n).fill(0);
      d[f] = 1;
      for (const [j, r] of lead) d[j] = -r[f];
      return d;
    });
    return { type: "many", p, dirs, free };
  }

  // The elementary matrix E that performs one recorded step (Theorem 3.14).
  function elementaryMatrix(op, n) {
    const E = M.identity(n);
    if (op.type === "swap") { const [i, k] = op.rows; [E[i], E[k]] = [E[k], E[i]]; }
    else if (op.type === "scale") E[op.row][op.row] = op.s;
    else if (op.type === "add") for (const [r, f] of op.adds) E[r][op.row] = f;
    return E;
  }

  const VARS = ["x", "y", "z", "w"];
  function eqText(r, n) {
    let s = "";
    for (let j = 0; j < n; j++) {
      const c = r[j];
      if (Math.abs(c) < 1e-9) continue;
      const mag = Math.abs(Math.abs(c) - 1) < 1e-9 ? "" : frac(Math.abs(c));
      s += (s ? (c < 0 ? " − " : " + ") : c < 0 ? "−" : "") + mag + VARS[j];
    }
    return (s || "0") + " = " + frac(r[n]);
  }

  // Cyclic Jacobi method (Section 16.3) for a small symmetric matrix.
  // Returns eigenvalues sorted from largest to smallest and unit eigenvectors as columns.
  function jacobiEigen(m0) {
    const n = m0.length, a = m0.map((r) => r.slice()), v = M.identity(n);
    for (let sweep = 0; sweep < 40; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
      if (off < 1e-24) break;
      for (let p = 0; p < n - 1; p++) {
        for (let q = p + 1; q < n; q++) {
          const apq = a[p][q];
          if (Math.abs(apq) < 1e-300) continue;
          const u = (a[q][q] - a[p][p]) / (2 * apq);
          const t = (u >= 0 ? 1 : -1) / (Math.abs(u) + Math.sqrt(u * u + 1));
          const c = 1 / Math.sqrt(t * t + 1), s = t * c;
          for (let k = 0; k < n; k++) {
            const akp = a[k][p], akq = a[k][q];
            a[k][p] = c * akp - s * akq;
            a[k][q] = s * akp + c * akq;
          }
          for (let k = 0; k < n; k++) {
            const apk = a[p][k], aqk = a[q][k];
            a[p][k] = c * apk - s * aqk;
            a[q][k] = s * apk + c * aqk;
          }
          for (let k = 0; k < n; k++) {
            const vkp = v[k][p], vkq = v[k][q];
            v[k][p] = c * vkp - s * vkq;
            v[k][q] = s * vkp + c * vkq;
          }
        }
      }
    }
    const order = [...Array(n).keys()].sort((i, j) => a[j][j] - a[i][i]);
    return { values: order.map((i) => a[i][i]), vectors: v.map((r) => order.map((i) => r[i])) };
  }

  // A random integer matrix with a nonzero determinant of modest size.
  function randomInvertible(n, lo = -4, hi = 4, maxDet = 60) {
    let A, d;
    do {
      A = Array.from({ length: n }, () => Array.from({ length: n }, () => randInt(lo, hi)));
      d = Math.abs(M.det(A));
    } while (d < 1 || d > maxDet);
    return A;
  }

  // A plane patch drawn as a few tiles so the painter's sort interleaves crossing planes better.
  function planePatch(v, center, n, size, color, tiles = 3) {
    const nn = V.norm(n), u = V.anyPerp(nn), w = V.cross(nn, u);
    const P = (s, t) => V.add(center, V.add(V.scale(u, s), V.scale(w, t)));
    const st = (2 * size) / tiles;
    for (let a = 0; a < tiles; a++) {
      for (let b = 0; b < tiles; b++) {
        const s0 = -size + a * st, t0 = -size + b * st;
        v.poly([P(s0, t0), P(s0 + st, t0), P(s0 + st, t0 + st), P(s0, t0 + st)], { fill: color, alpha: 0.2 });
      }
    }
    v.polyline([P(-size, -size), P(size, -size), P(size, size), P(-size, size)], { color, width: 1.3, closed: true, alpha: 0.85 });
  }

  // ===========================================================================
  // 3.1 Matrix Properties
  // ===========================================================================
  L3D.topic({
    id: "3.1",
    summary: "What a matrix is, how matrices are added, scaled, transposed and multiplied, and why the order of a product matters.",

    lesson: String.raw`
      <p>An <strong>n × m matrix</strong> is a rectangular array of numbers with \(n\) rows and \(m\) columns. The
      entry in row \(i\) and column \(j\) is written \(M_{ij}\), always row first. A 3 × 4 matrix looks like
      \[ \mathbf F = \begin{bmatrix} F_{11} & F_{12} & F_{13} & F_{14} \\ F_{21} & F_{22} & F_{23} & F_{24} \\ F_{31} & F_{32} & F_{33} & F_{34} \end{bmatrix}. \]
      When \(n = m\) the matrix is <strong>square</strong>. The entries \(M_{11}, M_{22}, \dots\) form the
      <strong>main diagonal</strong>, and a square matrix whose only nonzero entries sit on that diagonal is a
      <strong>diagonal matrix</strong>. Engines mostly use 3 × 3 and 4 × 4 matrices, but every rule below works for any
      size. A column vector is simply an n × 1 matrix.</p>

      <h2>Transpose</h2>
      <p>The <strong>transpose</strong> \(\mathbf M^{\mathsf T}\) mirrors a matrix across its main diagonal, so rows become
      columns: \((\mathbf M^{\mathsf T})_{ij} = M_{ji}\). An n × m matrix turns into an m × n one. Transposing a column
      vector gives a row vector, which lets us write the dot product from Chapter 2 as a matrix product:
      \(\mathbf P\cdot\mathbf Q = \mathbf P^{\mathsf T}\mathbf Q\).</p>

      <h2>Scaling and adding</h2>
      <p>Matrices are scaled and added entry by entry, exactly like vectors:
      \[ (a\mathbf M)_{ij} = aM_{ij}, \qquad (\mathbf F + \mathbf G)_{ij} = F_{ij} + G_{ij}. \]
      Addition only makes sense for two matrices of the same size. Theorem 3.1 records the familiar rules:
      \(\mathbf F + \mathbf G = \mathbf G + \mathbf F\), \((\mathbf F + \mathbf G) + \mathbf H = \mathbf F + (\mathbf G + \mathbf H)\),
      \(a(b\mathbf F) = (ab)\mathbf F\), \(a(\mathbf F + \mathbf G) = a\mathbf F + a\mathbf G\) and
      \((a + b)\mathbf F = a\mathbf F + b\mathbf F\). They follow directly from the same rules for real numbers.</p>

      <h2>Matrix multiplication</h2>
      <p>The product \(\mathbf F\mathbf G\) exists only when \(\mathbf F\) has as many columns as \(\mathbf G\) has rows.
      If \(\mathbf F\) is n × m and \(\mathbf G\) is m × p, the product is n × p, and its entries are</p>
      <div class="formula">\[ (\mathbf F\mathbf G)_{ij} = \sum_{k=1}^{m} F_{ik}\,G_{kj}. \]</div>
      <p>In words: <em>entry (i, j) of the product is the dot product of row i of \(\mathbf F\) with column j of
      \(\mathbf G\)</em>. The inner sizes have to agree (that shared size is what \(k\) runs over) and the outer sizes give
      the size of the result. Multiplying two 3 × 3 matrices takes 27 multiplications, one dot product of length 3 for
      each of the 9 entries.</p>

      <h3>Matrix times vector: the column picture</h3>
      <p>A vector \(\mathbf v\) is an m × 1 matrix, so \(\mathbf M\mathbf v\) follows the same rule. Group the terms by
      column instead of by row and you get the most useful fact in this chapter:
      \[ \mathbf M\mathbf v = v_1\mathbf M_1 + v_2\mathbf M_2 + \cdots + v_m\mathbf M_m, \]
      where \(\mathbf M_j\) is the j-th column of \(\mathbf M\). The axis vector \(\mathbf e_j\) (a 1 in slot j and zeros
      elsewhere) is therefore sent to column j itself.</p>
      <div class="key">The columns of a transformation matrix are the images of the coordinate axes. To build a matrix
      that rotates, scales or skews, decide where the x, y and z axes should end up and write those three vectors in as
      the columns.</div>

      <h2>The identity matrix</h2>
      <p>The n × n <strong>identity matrix</strong> \(\mathbf I_n\) has 1s on the main diagonal and 0s everywhere else.
      It plays the role of the number 1: \(\mathbf M\mathbf I = \mathbf I\mathbf M = \mathbf M\) for every n × n matrix
      \(\mathbf M\). Its columns are the axes themselves, so it is the transform that moves nothing. The subscript is
      usually dropped because the size is clear from context.</p>

      <h2>Properties of the product</h2>
      <p>Theorem 3.2 lists what carries over from ordinary multiplication:</p>
      <ul>
        <li>\((a\mathbf F)\mathbf G = a(\mathbf F\mathbf G)\): a scalar can be moved anywhere in a product.</li>
        <li>\((\mathbf F\mathbf G)\mathbf H = \mathbf F(\mathbf G\mathbf H)\): the product is <strong>associative</strong>.
          The proof writes out both sides as double sums and swaps the order of summation.</li>
        <li>\((\mathbf F\mathbf G)^{\mathsf T} = \mathbf G^{\mathsf T}\mathbf F^{\mathsf T}\): transposing a product
          <strong>reverses</strong> the order of the factors.</li>
      </ul>
      <div class="warn">Matrix multiplication is <strong>not commutative</strong>: in general
      \(\mathbf F\mathbf G \ne \mathbf G\mathbf F\). Often only one of the two products is even defined, and when both
      are, they rarely agree. Stretching a model and then rotating it is a different transform from rotating it first
      and stretching afterwards.</div>

      <div class="game">With column vectors, \(\mathbf A\mathbf B\mathbf v = \mathbf A(\mathbf B\mathbf v)\) applies
      \(\mathbf B\) first. That's why a vertex shader computes <code>Projection * View * Model * v</code>: the model
      matrix acts first even though it is written last. Associativity is what lets the engine multiply the three
      matrices <em>once</em> per object and reuse the single product for thousands of vertices.</div>

      <div class="note">Some APIs and shader conventions use <em>row</em> vectors and write \(\mathbf v^{\mathsf T}\mathbf M^{\mathsf T}\).
      Because \((\mathbf M\mathbf v)^{\mathsf T} = \mathbf v^{\mathsf T}\mathbf M^{\mathsf T}\), that's the same math with
      every matrix transposed and every product reversed. When you port code between conventions, transpose the
      matrices and flip the multiplication order. The <code>Matrix3D</code> type used on these pages stores its entries
      column by column, so <code>m[j]</code> hands you column j (the image of axis j) as a <code>Vector3D</code>.</div>

      <p><a class="btn goto-sim" href="#/3.1/sim">Try it: multiply matrices and drag the columns of a transform →</a></p>
    `,

    keyFormulas: [
      ["Matrix product", String.raw`(\mathbf F\mathbf G)_{ij} = \sum_{k=1}^{m} F_{ik}G_{kj}`],
      ["Column picture", String.raw`\mathbf M\mathbf v = v_1\mathbf M_1 + v_2\mathbf M_2 + \cdots + v_m\mathbf M_m`],
      ["Transpose", String.raw`(\mathbf M^{\mathsf T})_{ij} = M_{ji}`],
      ["Transpose of a product", String.raw`(\mathbf F\mathbf G)^{\mathsf T} = \mathbf G^{\mathsf T}\mathbf F^{\mathsf T}`],
      ["Identity", String.raw`\mathbf M\mathbf I = \mathbf I\mathbf M = \mathbf M`],
      ["Associativity", String.raw`(\mathbf F\mathbf G)\mathbf H = \mathbf F(\mathbf G\mathbf H)`],
    ],

    exercises: [
      { q: String.raw`Compute \(\begin{bmatrix}1&2\\3&4\end{bmatrix}\begin{bmatrix}0&1\\1&0\end{bmatrix}\) and the product in the other order.`,
        a: String.raw`\(\begin{bmatrix}2&1\\4&3\end{bmatrix}\) and \(\begin{bmatrix}3&4\\1&2\end{bmatrix}\). Multiplying by the swap matrix on the right swaps the columns; on the left it swaps the rows. The two products differ.` },
      { q: String.raw`\(\mathbf F\) is 3 × 4 and \(\mathbf G\) is 4 × 2. Which of \(\mathbf F\mathbf G\), \(\mathbf G\mathbf F\), \(\mathbf F^{\mathsf T}\mathbf F\) exist, and what sizes are they?`,
        a: String.raw`\(\mathbf F\mathbf G\) is 3 × 2. \(\mathbf G\mathbf F\) doesn't exist (2 columns vs 3 rows). \(\mathbf F^{\mathsf T}\mathbf F\) is 4 × 4.` },
      { q: "A 2D transform sends the x-axis to (0, 1) and the y-axis to (−1, 0). Write its matrix and apply it to (2, 1).",
        a: String.raw`The columns are the images of the axes: \(\begin{bmatrix}0&-1\\1&0\end{bmatrix}\), a 90° rotation. It maps \((2, 1)\) to \(2\langle0,1\rangle + 1\langle-1,0\rangle = (-1, 2)\).` },
      { q: String.raw`Show that \((\mathbf A\mathbf B\mathbf C)^{\mathsf T} = \mathbf C^{\mathsf T}\mathbf B^{\mathsf T}\mathbf A^{\mathsf T}\).`,
        a: String.raw`Apply Theorem 3.2(c) twice: \(((\mathbf A\mathbf B)\mathbf C)^{\mathsf T} = \mathbf C^{\mathsf T}(\mathbf A\mathbf B)^{\mathsf T} = \mathbf C^{\mathsf T}\mathbf B^{\mathsf T}\mathbf A^{\mathsf T}\).` },
      { q: "Why may an engine precompute P·V·M once per object instead of applying the three matrices to every vertex?",
        a: String.raw`Associativity: \(\mathbf P(\mathbf V(\mathbf M\mathbf v)) = (\mathbf P\mathbf V\mathbf M)\mathbf v\). One 4 × 4 product per object replaces three matrix-vector products per vertex.` },
    ],

    sims: [
      {
        title: "Row times column",
        help: String.raw`<p>Every entry of a product is a dot product: \((\mathbf F\mathbf G)_{ij}\) uses row \(i\) of the
          left matrix and column \(j\) of the right one. The layout puts the right factor above the product and the left
          factor beside it, so the row and column meet at the entry they build. <b>Click an entry of the product</b> to
          pick it. Then switch to \(\mathbf G\mathbf F\): both products exist here, but they don't even have the same size.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const cv = sim.canvas(stage, { height: 330 });
          const out = sim.readout(readout);
          const rndMat = (r, c) => Array.from({ length: r }, () => Array.from({ length: c }, () => randInt(-3, 4)));
          let F = [[1, 2, 0], [-1, 3, 2]];
          let G = [[2, 1], [0, -1], [4, 1]];
          let sel = [0, 1];
          let hits = [];
          const order = sim.segmented(controls, {
            label: "Product", options: [["FG", "F G"], ["GF", "G F"]], value: "FG",
            onChange: () => cv.redraw(),
          });
          sim.buttons(controls, [
            { label: "Random entries", onClick: () => { F = rndMat(2, 3); G = rndMat(3, 2); cv.redraw(); } },
            { label: "Next entry", onClick: () => { sel = [sel[0] + (sel[1] >= 2 ? 1 : 0), (sel[1] + 1) % 3]; if (sel[0] > 2) sel = [0, 0]; cv.redraw(); } },
          ]);
          sim.note(controls, "Click a cell of the product (bottom right) to choose the entry.");
          cv.el.style.cursor = "pointer";
          sim.on(cv.el, "pointerdown", (e) => {
            const r = cv.el.getBoundingClientRect();
            const x = e.clientX - r.left, y = e.clientY - r.top;
            for (const h of hits) {
              if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) { sel = [h.i, h.j]; cv.redraw(); return; }
            }
          });

          cv.onDraw(() => {
            const fg = order.value === "FG";
            const X = fg ? F : G, Y = fg ? G : F;
            const nX = fg ? "F" : "G", nY = fg ? "G" : "F";
            const P = M.mul(X, Y);
            const n = X.length, m = X[0].length, p = Y[0].length;
            const i = Math.min(sel[0], n - 1), j = Math.min(sel[1], p - 1);
            const cw = Math.max(36, Math.min(60, (cv.w - 60) / (m + p + 0.5))), ch = 32, gap = 22;
            const totalW = (m + p) * cw + gap, totalH = (m + n) * ch + gap;
            const x0 = Math.max(14, (cv.w - totalW) / 2), y0 = Math.max(30, (cv.h - totalH) / 2);
            const xP = x0 + m * cw + gap, yP = y0 + m * ch + gap;
            drawMatrix(cv, xP, y0, Y, { cw, ch, fmt: frac, hl: (r, c) => (c === j ? "b" : null), title: `${nY}  (${m}×${p})` });
            drawMatrix(cv, x0, yP, X, { cw, ch, fmt: frac, hl: (r, c) => (r === i ? "a" : null), title: `${nX}  (${n}×${m})` });
            drawMatrix(cv, xP, yP, P, {
              cw, ch, fmt: frac, hl: (r, c) => (r === i && c === j ? ["c", 0.4] : null),
              title: `${nX}${nY}  (${n}×${p})`, titleBelow: true, titleColor: "c",
            });
            hits = [];
            for (let r = 0; r < n; r++) for (let c = 0; c < p; c++) hits.push({ x: xP + c * cw, y: yP + r * ch, w: cw, h: ch, i: r, j: c });
            // guide lines: along the row of X and down the column of Y into the chosen entry
            const ctx = cv.ctx;
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = L3D.color.withAlpha(sim.color("a"), 0.7);
            ctx.beginPath();
            ctx.moveTo(x0 + m * cw + 3, yP + (i + 0.5) * ch);
            ctx.lineTo(xP + j * cw + 3, yP + (i + 0.5) * ch);
            ctx.stroke();
            ctx.strokeStyle = L3D.color.withAlpha(sim.color("b"), 0.7);
            ctx.beginPath();
            ctx.moveTo(xP + (j + 0.5) * cw, y0 + m * ch + 3);
            ctx.lineTo(xP + (j + 0.5) * cw, yP + i * ch + 3);
            ctx.stroke();
            ctx.setLineDash([]);

            const terms = X[i].map((x, k) => `(${frac(x)})(${frac(Y[k][j])})`).join(" + ");
            const FGt = M.transpose(M.mul(F, G)), GtFt = M.mul(M.transpose(G), M.transpose(F));
            const same = FGt.every((r, a) => r.every((x, b) => Math.abs(x - GtFt[a][b]) < 1e-9));
            out.set(
              `<b>(${nX}${nY})${sub(i + 1)}${sub(j + 1)}</b> = ${sim.swatch("a")}row ${i + 1} of ${nX} · ${sim.swatch("b")}column ${j + 1} of ${nY}` +
              `<div class="eq">= ${minus(terms)}\n= ${frac(P[i][j])}</div>` +
              sim.rows([
                ["sizes", `(${n}×${m})(${m}×${p}) → ${n}×${p}`],
                ["F G is", `${F.length}×${G[0].length}`],
                ["G F is", `${G.length}×${F[0].length}`],
                ["(FG)ᵀ = GᵀFᵀ", same ? "✓ equal" : "✗", same ? "ok" : "bad"],
              ]) +
              `<hr>F G and G F both exist here, but one is 2×2 and the other 3×3, so they can't be equal. Matrix multiplication is not commutative.`
            );
          });
        },
      },
      {
        title: "Columns are where the axes land",
        help: String.raw`<p>Drag the tips of the two columns \(\mathbf M_1\) and \(\mathbf M_2\) of a 2 × 2 matrix. The grey
          F and square are the originals; the purple ones are their images, and the purple grid is the image of the whole
          grid. Drag the green point \(\mathbf v\): its image is \(\mathbf M\mathbf v = v_x\mathbf M_1 + v_y\mathbf M_2\),
          drawn as a dashed path along the columns. Try to make the F come out mirrored.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 4, height: 460 });
          const out = sim.readout(readout);
          const ca = view.handle([2, 0.5], { color: "a", label: "M₁", snap: 0.25 });
          const cb = view.handle([-0.5, 1.5], { color: "b", label: "M₂", snap: 0.25 });
          const pv = view.handle([1, 1], { color: "c", label: "v", snap: 0.25 });
          const presets = [
            ["Identity", [[1, 0], [0, 1]]],
            ["Rotate 30°", rot2(rad(30))],
            ["Scale (2, ½)", [[2, 0], [0, 0.5]]],
            ["Shear", [[1, 1], [0, 1]]],
            ["Mirror", [[-1, 0], [0, 1]]],
          ];
          sim.buttons(controls, presets.map(([label, m]) => ({
            label, onClick: () => { ca.set([m[0][0], m[1][0]]); cb.set([m[0][1], m[1][1]]); },
          })));
          const showGrid = sim.checkbox(controls, { label: "Show the transformed grid", value: true, onChange: () => view.redraw() });
          const showCols = sim.checkbox(controls, { label: "Show Mv = vₓM₁ + v_yM₂", value: true, onChange: () => view.redraw() });

          view.onDraw((v) => {
            const m = cols2(ca.pos, cb.pos);
            v.grid({ step: 1 });
            if (showGrid.value) drawGrid2(v, m, { n: 10, color: "d", alpha: 0.2 });
            v.axes();
            v.polygon(SQUARE, { color: "muted", dash: [4, 4], width: 1 });
            v.polygon(F_SHAPE, { fill: "muted", fillAlpha: 0.15, color: "muted", width: 1 });
            drawShape2(v, m);
            v.arrow([0, 0], ca.pos, { color: "a", width: 3 });
            v.arrow([0, 0], cb.pos, { color: "b", width: 3 });
            const P = pv.pos, MP = mul2(m, P);
            if (showCols.value) {
              const A = V.scale(ca.pos, P[0]);
              v.arrow([0, 0], A, { color: "a", dash: [5, 4], width: 2, alpha: 0.65 });
              v.arrow(A, MP, { color: "b", dash: [5, 4], width: 2, alpha: 0.65 });
            }
            v.arrow([0, 0], P, { color: "c", width: 2, alpha: 0.7 });
            v.arrow([0, 0], MP, { color: "e", width: 3.5, label: "Mv" });
            const d = det2(m);
            out.set(
              `M = [M₁ M₂]` + matBox(m) +
              sim.rows([
                [sim.swatch("c") + "v", fmtVec(P)],
                ["row 1 · v", `${dec(m[0][0])}·${dec(P[0])} + ${dec(m[0][1])}·${dec(P[1])}`],
                ["row 2 · v", `${dec(m[1][0])}·${dec(P[0])} + ${dec(m[1][1])}·${dec(P[1])}`],
                [sim.swatch("e") + "Mv", fmtVec(MP)],
                ["vₓM₁ + v_yM₂", fmtVec(V.add(V.scale(ca.pos, P[0]), V.scale(cb.pos, P[1])))],
              ]) +
              `<hr>${Math.abs(d) < 1e-9 ? "The columns are parallel: the whole plane is squashed onto a line." :
                d < 0 ? "The F is <b>mirrored</b>: the columns are in clockwise order." :
                "Row-times-column and the column picture give the same Mv."}`
            );
          });
        },
      },
      {
        title: "Order matters: AB vs BA",
        help: String.raw`<p>Pick two transforms. The left panel applies \(\mathbf A\mathbf B\) (so \(\mathbf B\) acts first),
          the right panel applies \(\mathbf B\mathbf A\). The dashed gold shape is the halfway point after the first
          transform. Most pairs give different results. Find a pair that commutes (two rotations, or two scales).</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const [c1, c2] = sim.split(stage, 2);
          const v1 = sim.view2d(c1, { range: 2.4, height: 320 });
          const v2 = sim.view2d(c2, { range: 2.4, height: 320 });
          const out = sim.readout(readout);
          const T = {
            rot90: ["Rotate 90°", [[0, -1], [1, 0]]],
            rot30: ["Rotate 30°", rot2(rad(30))],
            sx2: ["Stretch x by 2", [[2, 0], [0, 1]]],
            sy: ["Squash y by ½", [[1, 0], [0, 0.5]]],
            shear: ["Shear x += y", [[1, 1], [0, 1]]],
            mirror: ["Mirror in the x-axis", [[1, 0], [0, -1]]],
          };
          const options = Object.keys(T).map((k) => [k, T[k][0]]);
          const redraw = () => { v1.redraw(); v2.redraw(); };
          const selA = sim.select(controls, { label: "A", options, value: "rot90", onChange: redraw });
          const selB = sim.select(controls, { label: "B", options, value: "sx2", onChange: redraw });
          const showMid = sim.checkbox(controls, { label: "Show the intermediate step", value: true, onChange: redraw });
          sim.buttons(controls, [{ label: "Swap A and B", onClick: () => { const t = selA.value; selA.value = selB.value; selB.value = t; redraw(); } }]);

          const panel = (v, first, second, title) => {
            v.grid({ step: 1 });
            v.axes({ labels: false });
            v.polygon(SQUARE, { color: "muted", dash: [4, 4], width: 1 });
            v.polygon(F_SHAPE, { fill: "muted", fillAlpha: 0.15, color: "muted", width: 1 });
            if (showMid.value) drawShape2(v, first, { color: "g", ghost: true });
            drawShape2(v, M.mul(second, first), { color: "d", fill: 0.4 });
            v.label(10, 20, title, { color: "fg", weight: 700, size: 13 });
          };
          v1.onDraw((v) => panel(v, T[selB.value][1], T[selA.value][1], "A B : first B, then A"));
          v2.onDraw((v) => { panel(v, T[selA.value][1], T[selB.value][1], "B A : first A, then B"); report(); });

          function report() {
            const A = T[selA.value][1], B = T[selB.value][1];
            const AB = M.mul(A, B), BA = M.mul(B, A);
            const same = AB.every((r, i) => r.every((x, j) => Math.abs(x - BA[i][j]) < 1e-9));
            out.set(
              `<b>A</b> (${T[selA.value][0]})` + matBox(A) + `<b>B</b> (${T[selB.value][0]})` + matBox(B) +
              `<b>A B</b>` + matBox(AB) + `<b>B A</b>` + matBox(BA) +
              `<hr>${same ? "<b class='ok'>These two commute:</b> A B = B A." : "<b class='bad'>A B ≠ B A.</b> The order of the factors changes the transform."}`
            );
          }
        },
      },
    ],

    cpp: [
      {
        title: "Matrix times vector",
        formula: String.raw`(\mathbf M\mathbf v)_i = \sum_j M_{ij}v_j \qquad \mathbf M\mathbf v = v_x\mathbf M_1 + v_y\mathbf M_2 + v_z\mathbf M_3`,
        code: String.raw`
          Vector3D operator*(const Matrix3D& m, const Vector3D& v)
          {
              // row i of M dotted with v
              return Vector3D(m(0,0) * v.x + m(0,1) * v.y + m(0,2) * v.z,
                              m(1,0) * v.x + m(1,1) * v.y + m(1,2) * v.z,
                              m(2,0) * v.x + m(2,1) * v.y + m(2,2) * v.z);
          }

          // The same product read by columns. m[j] is column j, the image of axis j.
          Vector3D MultiplyByColumns(const Matrix3D& m, const Vector3D& v)
          {
              return m[0] * v.x + m[1] * v.y + m[2] * v.z;
          }
        `,
      },
      {
        title: "Matrix product",
        formula: String.raw`(\mathbf A\mathbf B)_{ij} = \sum_{k=1}^{3} A_{ik}B_{kj}`,
        note: "<p>Nine dot products of length 3: 27 multiplies. Engines usually unroll these loops or use SIMD.</p>",
        code: String.raw`
          Matrix3D operator*(const Matrix3D& a, const Matrix3D& b)
          {
              Matrix3D c;
              for (int i = 0; i < 3; i++)              // row of A
              {
                  for (int j = 0; j < 3; j++)          // column of B
                  {
                      float sum = 0.0f;
                      for (int k = 0; k < 3; k++) sum += a(i,k) * b(k,j);   // row i . column j
                      c(i,j) = sum;
                  }
              }
              return c;
          }
        `,
      },
      {
        title: "Transpose",
        formula: String.raw`(\mathbf M^{\mathsf T})_{ij} = M_{ji}`,
        code: String.raw`
          Matrix3D Transpose(const Matrix3D& m)
          {
              // The constructor takes entries row by row, so row i of the result is column i of m.
              return Matrix3D(m(0,0), m(1,0), m(2,0),
                              m(0,1), m(1,1), m(2,1),
                              m(0,2), m(1,2), m(2,2));
          }
        `,
      },
      {
        title: "Building a matrix from where the axes go",
        formula: String.raw`\mathbf M = \begin{bmatrix} \mathbf M_1 & \mathbf M_2 & \mathbf M_3 \end{bmatrix}, \quad \mathbf M\mathbf e_j = \mathbf M_j`,
        code: String.raw`
          // Columns are the images of the x, y and z axes.
          Matrix3D MakeFromAxes(const Vector3D& xAxis, const Vector3D& yAxis, const Vector3D& zAxis)
          {
              return Matrix3D(xAxis.x, yAxis.x, zAxis.x,
                              xAxis.y, yAxis.y, zAxis.y,
                              xAxis.z, yAxis.z, zAxis.z);
          }
        `,
      },
      {
        title: "Composing transforms (the right factor acts first)",
        formula: String.raw`(\mathbf R\mathbf S)\mathbf v = \mathbf R(\mathbf S\mathbf v) \ne (\mathbf S\mathbf R)\mathbf v`,
        code: String.raw`
          // Scale the model first, then rotate it.
          void TransformVertices(const Matrix3D& rotate, const Matrix3D& scale,
                                 const Vector3D* in, Vector3D* out, int count)
          {
              Matrix3D combined = rotate * scale;     // one product, thanks to associativity
              for (int i = 0; i < count; i++)
                  out[i] = combined * in[i];          // = rotate * (scale * in[i])
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 3.2 Linear Systems
  // ===========================================================================
  L3D.topic({
    id: "3.2",
    summary: "Writing linear equations as Mx = r and solving them with elementary row operations and the reduced form.",

    lesson: String.raw`
      <p>A <strong>system of linear equations</strong> such as
      \[ \begin{aligned} 3x + 2y - 3z &= -13 \\ 4x - 3y + 6z &= 7 \\ x - z &= -5 \end{aligned} \]
      fits into a single matrix equation \(\mathbf M\mathbf x = \mathbf r\):
      \[ \begin{bmatrix} 3 & 2 & -3 \\ 4 & -3 & 6 \\ 1 & 0 & -1 \end{bmatrix}\begin{bmatrix} x \\ y \\ z \end{bmatrix} = \begin{bmatrix} -13 \\ 7 \\ -5 \end{bmatrix}. \]
      \(\mathbf M\) is the <strong>coefficient matrix</strong> and \(\mathbf r\) is the <strong>constant vector</strong>.
      A system with \(\mathbf r \ne \mathbf 0\) is <strong>nonhomogeneous</strong>; one with \(\mathbf r = \mathbf 0\) is
      <strong>homogeneous</strong>.</p>
      <p>Geometrically, each equation \(ax + by + cz = d\) is a plane with normal \(\langle a, b, c\rangle\) (Chapter 5).
      Solving the system means finding the points that lie on all of the planes at once.</p>

      <div class="game">Linear systems show up all over an engine: the corner where three planes meet (frustum corners,
      brush-based level geometry), the barycentric coordinates of a point in a triangle, fitting a curve through
      control points, and the constraint solvers inside physics engines all come down to \(\mathbf M\mathbf x = \mathbf r\).</div>

      <h2>Elementary row operations</h2>
      <p>Definition 3.3 lists three operations that change the equations without changing their solutions:</p>
      <ol>
        <li>Exchange two rows. (Reorder the list of equations.)</li>
        <li>Multiply a row by a nonzero scalar. (Scale both sides of one equation.)</li>
        <li>Add a multiple of one row to another row. (Add one true equation to another.)</li>
      </ol>
      <p>Each one can be undone by another operation of the same kind, so no solution is ever gained or lost. We apply
      them to the <strong>augmented matrix</strong>, the coefficient matrix with the constant vector glued on as an extra
      column:
      \[ \left[\begin{array}{ccc|c} 3 & 2 & -3 & -13 \\ 4 & -3 & 6 & 7 \\ 1 & 0 & -1 & -5 \end{array}\right]. \]</p>

      <h2>Reduced form</h2>
      <p>The goal is to bring the coefficient part into <strong>reduced form</strong> (Definition 3.4, also called reduced
      row echelon form):</p>
      <ul>
        <li>the leftmost nonzero entry of each nonzero row, its <em>leading entry</em>, is 1;</li>
        <li>rows of zeros sit at the bottom;</li>
        <li>a column holding a leading entry has zeros everywhere else;</li>
        <li>leading entries move strictly to the right as you go down the rows.</li>
      </ul>
      <p>For example \(\begin{bmatrix} 1 & 0 & -3 & 0 \\ 0 & 1 & 2 & 0 \\ 0 & 0 & 0 & 1 \\ 0 & 0 & 0 & 0 \end{bmatrix}\)
      is in reduced form. A matrix whose third row's leading entry sits left of the second row's is not.</p>

      <h2>The elimination algorithm</h2>
      <p>Algorithm 3.6 reaches the reduced form one column at a time:</p>
      <ol>
        <li>Start with row \(i = 1\) and column \(j = 1\).</li>
        <li><b>Pivot:</b> among rows \(i, i+1, \dots, n\) find the one whose entry in column \(j\) has the largest absolute
          value. If they are all zero, move on to the next column.</li>
        <li>Exchange that row with row \(i\).</li>
        <li>Multiply row \(i\) by \(1/M_{ij}\) so the leading entry becomes 1.</li>
        <li>For every other row \(r\), add \(-M_{rj}\) times row \(i\) to row \(r\). This clears column \(j\) above
          and below the leading 1.</li>
        <li>Move to row \(i + 1\), column \(j + 1\), and repeat.</li>
      </ol>
      <p>For the system above, the first pivot is the 4 in row 2, so rows 1 and 2 are exchanged and the new row 1 is
      divided by 4. Clearing column 1 leaves fractions with denominator 4, the second column produces 17ths, and after
      the third column the augmented matrix has become
      \[ \left[\begin{array}{ccc|c} 1 & 0 & 0 & -2 \\ 0 & 1 & 0 & 1 \\ 0 & 0 & 1 & 3 \end{array}\right], \]
      which says \(x = -2\), \(y = 1\), \(z = 3\) (Example 3.7). The first simulation runs exactly these steps.</p>

      <div class="warn">Pivoting is not only for avoiding a zero on the diagonal. Dividing by a tiny pivot multiplies
      every rounding error by a huge factor, so always choosing the largest available entry is essential for numerical
      stability. Section 16.2 shows a 2 × 2 system that a computer gets completely wrong without it.</div>

      <h2>How many solutions?</h2>
      <p>The reduced form tells you everything:</p>
      <table>
        <tr><th>Reduced coefficient part</th><th>Solutions</th><th>Three planes look like</th></tr>
        <tr><td>the identity matrix</td><td>exactly one, read from the last column</td><td>meeting in a single point</td></tr>
        <tr><td>a row of zeros with a nonzero constant, \([\,0\;0\;0 \mid c\,]\)</td><td>none: that row says \(0 = c\)</td><td>no common point (e.g. a triangular prism)</td></tr>
        <tr><td>rows of zeros, all with constant 0</td><td>infinitely many</td><td>sharing a line (or a whole plane)</td></tr>
      </table>
      <p>In the last case each column without a leading entry belongs to a <strong>free variable</strong>. Give each one
      an arbitrary value and solve the remaining rows for the other variables. The number of free variables equals the
      number of zero rows.</p>

      <h2>Homogeneous systems</h2>
      <p>A homogeneous system \(\mathbf M\mathbf x = \mathbf 0\) always has the <em>trivial</em> solution
      \(\mathbf x = \mathbf 0\). It has others only when the reduced form has a row of zeros. In Example 3.8,
      \[ 2x + y + 3z = 0, \qquad y - z = 0, \qquad x + 3y - z = 0 \]
      reduces to \(\begin{bmatrix} 1 & 0 & 2 \\ 0 & 1 & -1 \\ 0 & 0 & 0 \end{bmatrix}\). Column 3 has no leading entry,
      so set \(z = a\). Then \(x = -2a\) and \(y = a\), and every solution is
      \(\mathbf x = a\langle -2, 1, 1\rangle\): a whole line through the origin. Eigenvectors (Section 3.5) are found by
      solving exactly this kind of system.</p>

      <p><a class="btn goto-sim" href="#/3.2/sim">Try it: watch elimination move the planes →</a></p>
    `,

    keyFormulas: [
      ["Matrix form", String.raw`\mathbf M\mathbf x = \mathbf r`],
      ["Augmented matrix", String.raw`\left[\,\mathbf M \mid \mathbf r\,\right]`],
      ["Row operations", String.raw`R_i \leftrightarrow R_k, \quad R_i \leftarrow aR_i\;(a \ne 0), \quad R_r \leftarrow R_r + aR_i`],
      ["Unique solution", String.raw`\left[\,\mathbf M \mid \mathbf r\,\right] \;\to\; \left[\,\mathbf I \mid \mathbf x\,\right]`],
      ["Homogeneous system", String.raw`\mathbf M\mathbf x = \mathbf 0 \text{ has } \mathbf x \ne \mathbf 0 \iff \text{reduced } \mathbf M \text{ has a zero row}`],
    ],

    exercises: [
      { q: String.raw`Solve \(x + 2y = 5\), \(3x - y = 1\) with row operations.`,
        a: String.raw`Pivot on the 3: swap rows, divide by 3, clear column 1, then column 2. The reduced form is \(\left[\begin{array}{cc|c}1&0&1\\0&1&2\end{array}\right]\), so \(x = 1\), \(y = 2\).` },
      { q: String.raw`A reduced augmented matrix has the row \([\,0\;\;0\;\;0 \mid 4\,]\). What does it mean?`,
        a: String.raw`That row is the equation \(0x + 0y + 0z = 4\), which is impossible. The system has no solution.` },
      { q: String.raw`Solve the homogeneous system \(x + y + z = 0\), \(x - y = 0\).`,
        a: String.raw`Reduced form \(\begin{bmatrix}1&0&\tfrac12\\0&1&\tfrac12\end{bmatrix}\); \(z\) is free. With \(z = -2a\): \(\mathbf x = a\langle 1, 1, -2\rangle\).` },
      { q: "Exchanging two rows is an allowed operation. Why isn't exchanging two columns?",
        a: "Rows are just equations in a list, so their order doesn't matter. Columns belong to particular unknowns: swapping two columns silently renames the variables, so the answer would come out with x and y swapped." },
      { q: "Three planes meet in a line. What does the reduced form look like?",
        a: "Two leading 1s and one row of zeros whose constant is also 0. The column without a leading entry gives one free variable, which parameterizes the line." },
    ],

    sims: [
      {
        title: "Elimination, one row operation at a time",
        help: String.raw`<p>Each equation is a plane drawn in the color of its row. Press <b>Step</b> to apply Algorithm 3.6
          one row operation at a time. The planes swing around, but they all keep passing through the same solution,
          because row operations never change the solution set. At the end the reduced form reads off the answer: three
          axis-aligned planes through one point, a line of solutions, or a contradiction. Drag to orbit.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view3d(stage, { height: 340, distance: 15, yaw: 0.7, pitch: 0.4 });
          const cv = sim.canvas(stage, { height: 140 });
          const out = sim.readout(readout);
          const COLORS = ["a", "b", "c"];
          const PRESETS = {
            unique: [[3, 2, -3, -13], [4, -3, 6, 7], [1, 0, -1, -5]],
            line: [[2, 1, 3, 0], [0, 1, -1, 0], [1, 3, -1, 0]],
            none: [[1, 1, 1, 1], [1, -1, 0, 0], [2, 0, 1, 3]],
          };
          const randomSystem = () => {
            const A = randomInvertible(3, -4, 4, 40);
            const s = [randInt(-3, 3), randInt(-3, 3), randInt(-3, 3)];
            return A.map((r) => [...r, V.dot(r, s)]);
          };
          let steps = [], k = 0, info = null, ref = [0, 0, 0], anim = null;
          const preset = sim.select(controls, {
            label: "System",
            options: [["unique", "Example 3.7: one solution"], ["line", "Example 3.8: homogeneous"], ["none", "No solution"], ["random", "Random 3×3"]],
            value: "unique", onChange: () => load(),
          });
          sim.buttons(controls, [
            { label: "◀ Back", onClick: () => go(k - 1) },
            { label: "Step ▶", primary: true, onClick: () => go(k + 1) },
            { label: "Reset", onClick: () => go(0) },
          ]);

          function load() {
            const aug = preset.value === "random" ? randomSystem() : PRESETS[preset.value];
            steps = gaussJordanSteps(aug, 3);
            info = classify(steps[steps.length - 1].m, 3);
            ref = info.type === "unique" ? info.x : info.type === "many" ? info.p : [0, 0, 0];
            view.target = ref.slice();
            k = 0;
            anim = null;
            view.redraw();
            cv.redraw();
          }
          function go(nk) {
            nk = clamp(nk, 0, steps.length - 1);
            if (nk === k) return;
            anim = { from: steps[k].m, t: 0 };
            k = nk;
            view.redraw();
            cv.redraw();
          }
          sim.loop((dt) => {
            if (!anim) return;
            anim.t += dt / 0.6;
            if (anim.t >= 1) anim = null;
            view.redraw();
          });

          view.onDraw((v) => {
            v.grid({ size: 5, step: 1 });
            v.axes({ length: 1.5 });
            const cur = steps[k].m;
            const e = anim ? ease(Math.min(1, anim.t)) : 1;
            const rows = cur.map((r, i) => (anim ? r.map((x, j) => lerp(anim.from[i][j], x, e)) : r));
            rows.forEach((r, i) => {
              const nrm = [r[0], r[1], r[2]], nn = V.dot(nrm, nrm);
              if (nn < 1e-6) return;          // a zero row is no plane at all
              const center = V.sub(ref, V.scale(nrm, (V.dot(nrm, ref) - r[3]) / nn));
              planePatch(v, center, nrm, 2.4, COLORS[i]);
            });
            if (info.type === "unique") v.point(info.x, { color: "fg", r: 6, label: "solution", overlay: true });
            else if (info.type === "many" && info.dirs.length === 1) {
              const d = V.norm(info.dirs[0]);
              v.line(V.add(info.p, V.scale(d, -5)), V.add(info.p, V.scale(d, 5)), { color: "fg", width: 3, overlay: true });
            }

            const st = steps[k], last = k === steps.length - 1;
            let result = "";
            if (info.type === "unique") result = `Exactly one solution: (x, y, z) = (${info.x.map(frac).join(", ")}).`;
            else if (info.type === "none") result = "A row reads 0 = nonzero: <b class='bad'>no solution</b>. The planes have no common point.";
            else result = `Infinitely many solutions: (${info.p.map(frac).join(", ")}) + a·(${info.dirs[0].map(frac).join(", ")})` +
              (info.dirs.length > 1 ? " + …" : "") + ".";
            out.set(
              `<b>Step ${k} / ${steps.length - 1}</b><br>${st.text}<hr>` +
              (last ? `<b>Reduced form reached.</b> ${result}` : `Solution set (never changed by a row operation): ${result}`)
            );
          });

          cv.onDraw(() => {
            const st = steps[k];
            if (!st) return;
            const op = st.op;
            const cw = Math.max(44, Math.min(62, (cv.w - 300) / 4)), ch = 30;
            const x0 = 34, y0 = (cv.h - 3 * ch) / 2;
            const rowHl = (i) => {
              if (op.type === "swap" && op.rows.includes(i)) return "b";
              if (op.type === "scale" && op.row === i) return "g";
              if (op.type === "add" && op.adds.some(([r]) => r === i)) return "c";
              return null;
            };
            drawMatrix(cv, x0, y0, st.m, {
              cw, ch, sep: 3, fmt: frac,
              hl: (i, j) => (op.type === "skip" && j === op.col ? "e" : (op.col === j && op.row === i && op.type !== "start") ? ["d", 0.35] : rowHl(i)),
            });
            for (let i = 0; i < 3; i++) {
              cv.ctx.fillStyle = sim.color(COLORS[i]);
              cv.ctx.fillRect(x0 - 22, y0 + i * ch + 9, 12, 12);
              cv.label(x0 + 4 * cw + 24, y0 + (i + 0.5) * ch + 5, eqText(st.m[i], 3), { size: 13.5, color: COLORS[i], weight: 600 });
            }
          });

          load();
        },
      },
      {
        title: "Two equations, two lines: how many solutions?",
        help: String.raw`<p>Each line is one equation \(ax + by = c\). Drag the two points that define each line. The
          readout shows the augmented matrix and its reduced form. Make the lines parallel (no solution) or put them on
          top of each other (infinitely many) and watch what the reduced form does.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 5, height: 440 });
          const out = sim.readout(readout);
          const p1 = view.handle([-4, -2], { color: "a", label: "line 1", snap: 0.5 });
          const q1 = view.handle([3, 1.5], { color: "a", snap: 0.5 });
          const p2 = view.handle([-3, 3], { color: "b", label: "line 2", snap: 0.5 });
          const q2 = view.handle([3, -1], { color: "b", snap: 0.5 });
          sim.buttons(controls, [
            { label: "Crossing", onClick: () => { p1.set([-4, -2]); q1.set([3, 1.5]); p2.set([-3, 3]); q2.set([3, -1]); } },
            { label: "Parallel", onClick: () => { p1.set([-4, -2]); q1.set([2, 1]); p2.set([-4, 0]); q2.set([2, 3]); } },
            { label: "Same line", onClick: () => { p1.set([-4, -2]); q1.set([2, 1]); p2.set([-2, -1]); q2.set([4, 2]); } },
          ]);

          view.onDraw((v) => {
            v.grid({ step: 1 });
            v.axes();
            // line through P with direction d: normal (-d_y, d_x), equation n . X = n . P
            const row = (P, Q) => { const d = V.sub(Q, P); return [-d[1], d[0], -d[1] * P[0] + d[0] * P[1]]; };
            const r1 = row(p1.pos, q1.pos), r2 = row(p2.pos, q2.pos);
            const degenerate = [r1, r2].some((r) => Math.abs(r[0]) + Math.abs(r[1]) < 1e-9);
            const steps = gaussJordanSteps([r1, r2], 2);
            const red = steps[steps.length - 1].m;
            const info = classify(red, 2);
            if (info.type === "many" && !degenerate) v.infiniteLine(p1.pos, V.sub(q1.pos, p1.pos), { color: "c", width: 9, alpha: 0.3 });
            v.infiniteLine(p1.pos, V.sub(q1.pos, p1.pos), { color: "a", width: 2.5 });
            v.infiniteLine(p2.pos, V.sub(q2.pos, p2.pos), { color: "b", width: 2.5, dash: info.type === "many" ? [9, 7] : null });
            if (info.type === "unique") {
              v.point(info.x, { color: "c", r: 7 });
              v.text(info.x, `(${info.x.map(frac).join(", ")})`, { color: "c", offset: [10, 18], size: 13 });
            }
            const verdict = degenerate ? "A line needs two different points." :
              info.type === "unique" ? `<b class="ok">One solution</b>: the reduced form is [I | x], so (x, y) = (${info.x.map(frac).join(", ")}).` :
              info.type === "none" ? `<b class="bad">No solution.</b> The last row reads 0 = ${frac(red[1][2])}: the lines are parallel.` :
              `<b>Infinitely many solutions.</b> The second row became 0 = 0: both equations describe the same line, and ${VARS[info.free[0]]} is free.`;
            out.set(
              sim.rows([[sim.swatch("a") + "equation 1", eqText(r1, 2)], [sim.swatch("b") + "equation 2", eqText(r2, 2)]]) +
              `<hr>Augmented matrix` + matBox([r1, r2], frac) + `Reduced form` + matBox(red, frac) + `<hr>${verdict}`
            );
          });
        },
      },
    ],

    cpp: [
      {
        title: "Elementary row operations",
        formula: String.raw`R_i \leftrightarrow R_k, \qquad R_i \leftarrow aR_i, \qquad R_t \leftarrow R_t + aR_s`,
        note: "<p>The augmented matrix [M | r] of a 3 × 3 system is stored row by row in <code>m[3][4]</code>; column 3 holds r.</p>",
        code: String.raw`
          void SwapRows(float m[3][4], int i, int k)
          {
              for (int c = 0; c < 4; c++) { float t = m[i][c]; m[i][c] = m[k][c]; m[k][c] = t; }
          }

          void ScaleRow(float m[3][4], int i, float a)                           // a != 0
          {
              for (int c = 0; c < 4; c++) m[i][c] *= a;
          }

          void AddRowMultiple(float m[3][4], int target, int source, float a)   // R_target += a R_source
          {
              for (int c = 0; c < 4; c++) m[target][c] += a * m[source][c];
          }
        `,
      },
      {
        title: "Reduce to reduced form (Algorithm 3.6)",
        formula: String.raw`\left[\,\mathbf M \mid \mathbf r\,\right] \to \text{reduced form}`,
        note: "<p>Returns the number of leading 1s, the <em>rank</em> of M. A rank of 3 means exactly one solution.</p>",
        code: String.raw`
          int ReduceAugmented(float m[3][4])
          {
              int i = 0;                                       // current row
              for (int j = 0; j < 3 && i < 3; j++)             // current column
              {
                  int k = i;                                   // pivot: largest |m[k][j]| with k >= i
                  for (int r = i + 1; r < 3; r++)
                      if (std::fabs(m[r][j]) > std::fabs(m[k][j])) k = r;
                  if (std::fabs(m[k][j]) < 1.0e-6f) continue; // no leading entry in this column

                  if (k != i) SwapRows(m, i, k);
                  ScaleRow(m, i, 1.0f / m[i][j]);              // leading entry becomes 1
                  for (int r = 0; r < 3; r++)                  // clear the column above and below
                      if (r != i) AddRowMultiple(m, r, i, -m[r][j]);
                  i++;
              }
              return i;
          }
        `,
      },
      {
        title: "Solve a 3 × 3 system, or say why not",
        formula: String.raw`\text{rank } 3 \Rightarrow \text{one solution}; \quad [\,0\;0\;0 \mid c \ne 0\,] \Rightarrow \text{none}`,
        code: String.raw`
          enum class SolutionType { Unique, None, Infinite };

          SolutionType Solve3x3(const Matrix3D& M, const Vector3D& r, Vector3D& x)
          {
              const float rhs[3] = {r.x, r.y, r.z};
              float m[3][4];
              for (int i = 0; i < 3; i++)
              {
                  for (int j = 0; j < 3; j++) m[i][j] = M(i,j);
                  m[i][3] = rhs[i];
              }

              int rank = ReduceAugmented(m);
              if (rank == 3)
              {
                  x = Vector3D(m[0][3], m[1][3], m[2][3]);    // [I | x]
                  return SolutionType::Unique;
              }
              for (int i = rank; i < 3; i++)                   // the zero rows of the coefficient part
                  if (std::fabs(m[i][3]) > 1.0e-6f) return SolutionType::None;   // 0 = nonzero
              return SolutionType::Infinite;
          }
        `,
      },
      {
        title: "Where three planes meet",
        formula: String.raw`\mathbf N_i\cdot\mathbf P + D_i = 0 \;\;(i = 1,2,3) \quad\Longrightarrow\quad \begin{bmatrix}\mathbf N_1^{\mathsf T}\\ \mathbf N_2^{\mathsf T}\\ \mathbf N_3^{\mathsf T}\end{bmatrix}\mathbf P = -\begin{bmatrix}D_1\\D_2\\D_3\end{bmatrix}`,
        note: "<p>Used to find frustum corners and the vertices of convex brushes.</p>",
        code: String.raw`
          bool IntersectThreePlanes(const Plane& f1, const Plane& f2, const Plane& f3, Point3D& p)
          {
              // Each plane N.P + D = 0 is one row of the system:  Nx x + Ny y + Nz z = -D
              Matrix3D M(f1.x, f1.y, f1.z,
                         f2.x, f2.y, f2.z,
                         f3.x, f3.y, f3.z);
              Vector3D r(-f1.w, -f2.w, -f3.w);
              return Solve3x3(M, r, p) == SolutionType::Unique;
          }
        `,
      },
    ],
  });

  // @@APPEND@@
})();
