// Chapter 11 - Curves and Surfaces
(function () {
  "use strict";
  const { V, fmt, fmtVec, clamp, rad } = L3D.math;

  // ===========================================================================
  // Shared helpers
  //
  // Every cubic in this chapter is written Q(t) = G M T(t) (Section 11.1):
  //   G      the four geometric constraints g_1..g_4 (stored here as an array of points),
  //   M      the 4x4 basis matrix; row i holds the coefficients of blending function i,
  //   T(t)   the powers (1, t, t^2, t^3).
  // So the weight of constraint i is (M T(t))_i and Q(t) = sum_i w_i g_i.
  // ===========================================================================
  const scaleM = (m, s) => m.map((r) => r.map((x) => x * s));
  const BASIS = {
    hermite: [[1, 0, -3, 2], [0, 0, 3, -2], [0, 1, -2, 1], [0, 0, -1, 1]],
    bezier: [[1, -3, 3, -1], [0, 3, -6, 3], [0, 0, 3, -3], [0, 0, 0, 1]],
    catmull: scaleM([[0, -1, 2, -1], [2, 0, -5, 3], [0, 1, 4, -3], [0, 0, -1, 1]], 0.5),
    bspline: scaleM([[1, -3, 3, -1], [4, 0, -6, 3], [1, 3, 3, -3], [0, 0, 0, 1]], 1 / 6),
  };

  // T(t) and its derivatives
  function powT(t, d = 0) {
    if (d === 0) return [1, t, t * t, t * t * t];
    if (d === 1) return [0, 1, 2 * t, 3 * t * t];
    if (d === 2) return [0, 0, 2, 6 * t];
    return [0, 0, 0, 6];
  }
  // the four weights M T(t) (or their d-th derivatives)
  function blend(Mx, t, d = 0) {
    const T = powT(t, d);
    return Mx.map((r) => r[0] * T[0] + r[1] * T[1] + r[2] * T[2] + r[3] * T[3]);
  }
  // sum_i w_i g_i  (works for 2D and 3D points)
  function combo(G, w) {
    const out = G[0].map(() => 0);
    for (let i = 0; i < G.length; i++) for (let c = 0; c < out.length; c++) out[c] += w[i] * G[i][c];
    return out;
  }
  const cubicAt = (G, Mx, t, d = 0) => combo(G, blend(Mx, t, d));
  const sampleCurve = (f, n = 64, a = 0, b = 1) => Array.from({ length: n + 1 }, (_, i) => f(a + ((b - a) * i) / n));

  // Unicode subscripts for labels: sub(12) -> "₁₂"
  const sub = (i) => String(i).split("").map((ch) => (ch === "-" ? "₋" : "₀₁₂₃₄₅₆₇₈₉"[+ch])).join("");
  const PALETTE = ["a", "b", "c", "d", "e", "f", "g"];

  // Draw the four blending functions of a basis matrix on a plot view and mark parameter t.
  function drawBlends(v, Mx, t, colors, names) {
    v.grid({ stepX: 0.25, stepY: 0.25 });
    v.axes({ labels: ["t", ""] });
    for (let i = 0; i < 4; i++) {
      v.plot((x) => blend(Mx, x)[i], { from: 0, to: 1, color: colors[i], width: 2.5 });
      if (names) {
        let best = 0, bx = 0;
        for (let k = 0; k <= 40; k++) {
          const y = blend(Mx, k / 40)[i];
          if (Math.abs(y) > Math.abs(best)) { best = y; bx = k / 40; }
        }
        v.text([bx, best], names[i], { color: colors[i], size: 12, align: "center", offset: [0, best >= 0 ? -8 : 16] });
      }
    }
    const b = v.bounds;
    v.line([t, b.ymin], [t, b.ymax], { color: "muted", dash: [4, 4], width: 1.25 });
    const w = blend(Mx, t);
    w.forEach((wi, i) => v.point([t, wi], { color: colors[i], r: 5 }));
    return w;
  }

  // Small diamond marker (knots), r in pixels.
  function diamond(v, p, r, style) {
    const sx = r / v.sx, sy = r / v.sy;
    v.polygon([[p[0] + sx, p[1]], [p[0], p[1] + sy], [p[0] - sx, p[1]], [p[0], p[1] - sy]], style);
  }

  // Convex hull (monotone chain) of 2D points, counterclockwise.
  function hull2(pts) {
    const p = pts.map((q) => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const q of p) {
      while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
      lower.push(q);
    }
    for (const q of p.slice().reverse()) {
      while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
      upper.push(q);
    }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }

  // de Casteljau levels: [[P0..P3], [P0^(1)..P2^(1)], [P0^(2), P1^(2)], [P0^(3)]]
  function casteljau(P, s) {
    const levels = [P];
    while (levels[levels.length - 1].length > 1) {
      const prev = levels[levels.length - 1];
      levels.push(prev.slice(1).map((q, i) => V.lerp(prev[i], q, s)));
    }
    return levels;
  }
  // Q_i = P_0^(i) covers [0, s];  R_i = P_i^(3-i) covers [s, 1]
  function splitBezier(P, s) {
    const L = casteljau(P, s);
    return { Q: L.map((l) => l[0]), R: L.map((l) => l[l.length - 1]).reverse(), levels: L };
  }

  // Control point j of a piecewise curve: wraps for closed curves, and past the ends of an
  // open curve returns a "phantom" point mirrored through the end point (2 P_0 - P_1).
  function ptAt(pts, j, closed) {
    const n = pts.length;
    if (closed) return pts[((j % n) + n) % n];
    if (j < 0) return V.sub(V.scale(pts[0], 2), pts[1]);
    if (j >= n) return V.sub(V.scale(pts[n - 1], 2), pts[n - 2]);
    return pts[j];
  }

  // Closed loop made of cubic pieces with geometry [P_{i-1} P_i P_{i+1} P_{i+2}] (Catmull-Rom or
  // uniform B-spline). u runs over [0, n); d = derivative order.
  function loopAt(pts, Mx, u, d = 0) {
    const n = pts.length;
    u = ((u % n) + n) % n;
    const i = Math.min(Math.floor(u), n - 1);
    const G = [ptAt(pts, i - 1, true), ptAt(pts, i, true), ptAt(pts, i + 1, true), ptAt(pts, i + 2, true)];
    return cubicAt(G, Mx, u - i, d);
  }

  // Natural / clamped-second-derivative cubic spline (Section 11.5).
  // Returns y''_0..y''_n given y''_0 = d0 and y''_n = dn; solves the tridiagonal system (11.61).
  function splineSecondDerivs(xs, ys, d0 = 0, dn = 0) {
    const n = xs.length - 1;
    const y2 = new Array(n + 1).fill(0);
    y2[0] = d0;
    y2[n] = dn;
    if (n < 2) return y2;
    const h = [], k = [];
    for (let i = 0; i < n; i++) { h.push(xs[i + 1] - xs[i]); k.push(ys[i + 1] - ys[i]); }
    const m = n - 1;
    const a = [], b = [], c = [], r = [];
    for (let i = 0; i < m; i++) {
      a.push(h[i]);
      b.push(2 * (h[i] + h[i + 1]));
      c.push(h[i + 1]);
      r.push(6 * (k[i + 1] / h[i + 1] - k[i] / h[i]));
    }
    r[0] -= h[0] * d0;
    r[m - 1] -= h[n - 1] * dn;
    for (let i = 1; i < m; i++) {         // forward elimination (Thomas algorithm)
      const f = a[i] / b[i - 1];
      b[i] -= f * c[i - 1];
      r[i] -= f * r[i - 1];
    }
    const sol = new Array(m);
    sol[m - 1] = r[m - 1] / b[m - 1];
    for (let i = m - 2; i >= 0; i--) sol[i] = (r[i] - c[i] * sol[i + 1]) / b[i];
    for (let i = 0; i < m; i++) y2[i + 1] = sol[i];
    return y2;
  }
  // Equation (11.58) and its derivatives
  function splineEval(xs, ys, y2, x, deriv = 0) {
    const n = xs.length - 1;
    let i = 0;
    while (i < n - 1 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], A = xs[i + 1] - x, B = x - xs[i];
    if (deriv === 0) {
      return (y2[i] * A * A * A) / (6 * h) + (y2[i + 1] * B * B * B) / (6 * h) +
        (ys[i] / h - (y2[i] * h) / 6) * A + (ys[i + 1] / h - (y2[i + 1] * h) / 6) * B;
    }
    if (deriv === 1) {
      return (-y2[i] * A * A) / (2 * h) + (y2[i + 1] * B * B) / (2 * h) + (ys[i + 1] - ys[i]) / h + (h * (y2[i] - y2[i + 1])) / 6;
    }
    return (y2[i] * A) / h + (y2[i + 1] * B) / h;
  }

  // All Cox-de Boor basis functions of degree p at u (Section 11.6.3).
  // kn[j] holds the knot t_{j-2} (the book starts the knot vector at index -2), so with p = 3 the
  // returned N[i] is N_{i,3}(u), the weight of control point P_i. Division by zero counts as zero.
  function basisAll(kn, p, u) {
    const m = kn.length - 1;
    let N = [];
    for (let j = 0; j < m; j++) N.push(kn[j] <= u && u < kn[j + 1] ? 1 : 0);
    for (let k = 1; k <= p; k++) {
      const next = [];
      for (let j = 0; j < m - k; j++) {
        const d1 = kn[j + k] - kn[j], d2 = kn[j + k + 1] - kn[j + 1];
        const a = d1 > 0 ? ((u - kn[j]) / d1) * N[j] : 0;
        const b = d2 > 0 ? ((kn[j + k + 1] - u) / d2) * N[j + 1] : 0;
        next.push(a + b);
      }
      N = next;
    }
    return N;
  }
  // Rational (NURBS) or plain B-spline point; w may be null for all weights = 1.
  function nurbsAt(pts, w, kn, p, u) {
    const N = basisAll(kn, p, u);
    const out = pts[0].map(() => 0);
    let den = 0;
    for (let i = 0; i < pts.length; i++) {
      const nw = (N[i] || 0) * (w ? w[i] : 1);
      if (!nw) continue;
      den += nw;
      for (let c = 0; c < out.length; c++) out[c] += nw * pts[i][c];
    }
    return den > 0 ? out.map((x) => x / den) : null;
  }

  // Curvature tools (Section 11.8)
  const curvature2 = (d1, d2) => V.cross2(d1, d2) / Math.pow(V.len(d1), 3);   // signed, 2D

  // ===========================================================================
  // 11.1 Cubic Curves
  // ===========================================================================
  L3D.topic({
    id: "11.1",
    summary: "A cubic curve is Q(t) = G M T(t): a geometry matrix of constraints, a basis matrix that turns powers of t into blending weights, and the continuity rules for chaining pieces.",

    lesson: String.raw`
      <p>Smooth paths are everywhere in a game: the rail a cinematic camera rides, the racing line an AI driver
      follows, a road or river mesh, the outline of a font glyph, an animation curve that eases a door open. Almost
      all of them are built from <strong>cubic polynomial</strong> pieces. A cubic is the lowest degree that lets you
      choose both the position <em>and</em> the direction at each end of a piece. It can bend one way and then the
      other (an S-shape), it can twist out of a plane in 3D (a quadratic always stays in one plane), and evaluating it
      costs only a few multiply-adds.</p>

      <h2>The algebraic form</h2>
      <p>A cubic curve is a vector-valued polynomial in a parameter \(t\):
      \[ \mathbf Q(t) = \mathbf a + \mathbf b\,t + \mathbf c\,t^2 + \mathbf d\,t^3, \]
      where \(\mathbf a, \mathbf b, \mathbf c, \mathbf d\) are constant vectors. Each coordinate is an ordinary cubic,
      for example \(Q_x(t) = a_x + b_x t + c_x t^2 + d_x t^3\). Put the four coefficient vectors into the columns of a
      \(3\times4\) matrix \(\mathbf C\) and the powers of \(t\) into the column \(\mathbf T(t) = \langle 1, t, t^2, t^3\rangle\):
      \[ \mathbf Q(t) = \mathbf C\,\mathbf T(t) =
         \begin{bmatrix} a_x & b_x & c_x & d_x \\ a_y & b_y & c_y & d_y \\ a_z & b_z & c_z & d_z \end{bmatrix}
         \begin{bmatrix} 1 \\ t \\ t^2 \\ t^3 \end{bmatrix}. \]
      Since \(\mathbf C\) doesn't depend on \(t\), differentiating only touches \(\mathbf T\):
      \[ \mathbf Q'(t) = \mathbf C \begin{bmatrix} 0 \\ 1 \\ 2t \\ 3t^2 \end{bmatrix}, \qquad
         \mathbf Q''(t) = \mathbf C \begin{bmatrix} 0 \\ 0 \\ 2 \\ 6t \end{bmatrix}. \]
      \(\mathbf Q'(t)\) is the tangent direction. If \(t\) is time, it's the velocity and \(\mathbf Q''(t)\) is the
      acceleration.</p>

      <h2>Joining pieces: parametric and geometric continuity</h2>
      <p>A single cubic can't follow a long, winding path, so paths are chains of short pieces joined end to end. How
      smooth a joint is gets described with two families of labels:</p>
      <table>
        <tr><th>label</th><th>condition at the joint</th><th>what you see / feel</th></tr>
        <tr><td>\(C^0 = G^0\)</td><td>the pieces share the endpoint</td><td>connected, but there may be a sharp corner</td></tr>
        <tr><td>\(G^1\)</td><td>first derivatives point the same way, lengths differ</td><td>no visible kink, but the speed jumps if \(t\) advances at a constant rate</td></tr>
        <tr><td>\(C^1\)</td><td>first derivatives are equal vectors</td><td>no kink and no speed jump</td></tr>
        <tr><td>\(C^2\)</td><td>second derivatives equal as well</td><td>acceleration (and curvature) is continuous too</td></tr>
      </table>
      <p>In general two pieces meet with \(C^n\) continuity when their \(n\)-th derivatives are equal, and with
      \(G^n\) continuity when those derivatives are nonzero and parallel but have different lengths. \(C^n\) implies
      \(G^n\) unless the derivative happens to be zero.</p>

      <div class="game">A camera dolly that advances \(t\) at a fixed rate along a \(G^1\) path visibly lurches at every
      joint, because its speed changes instantly. On a \(C^1\) path the speed is continuous, but the acceleration can
      still jump: a car following a \(C^1\) racing line gets a sudden change in sideways force at each joint. \(C^2\)
      curves (natural splines and B-splines, Sections 11.5–11.6) remove that too.</div>

      <h2>Geometric constraints and the basis matrix</h2>
      <p>Picking \(\mathbf a, \mathbf b, \mathbf c, \mathbf d\) directly is hopeless for a designer. People think
      geometrically: <em>start here, end there, leave in this direction</em>. A cubic has four vector coefficients, so
      four vector constraints \(\mathbf g_1, \dots, \mathbf g_4\) (positions or tangents) pin it down exactly. Write
      the curve as a weighted sum of the constraints:
      \[ \mathbf Q(t) = \sum_{i=1}^{4} \left(a_i + b_i t + c_i t^2 + d_i t^3\right) \mathbf g_i . \]
      The scalar polynomials in parentheses are the <strong>blending functions</strong>. They say how much each
      constraint contributes at each value of \(t\). In matrix form this becomes</p>
      <div class="formula">
        \[ \mathbf Q(t) = \mathbf G\,\mathbf M\,\mathbf T(t), \qquad
           \mathbf G = \begin{bmatrix} \mathbf g_1 & \mathbf g_2 & \mathbf g_3 & \mathbf g_4 \end{bmatrix}, \qquad
           \mathbf M = \begin{bmatrix} a_1 & b_1 & c_1 & d_1 \\ a_2 & b_2 & c_2 & d_2 \\ a_3 & b_3 & c_3 & d_3 \\ a_4 & b_4 & c_4 & d_4 \end{bmatrix}. \]
      </div>
      <p>\(\mathbf G\) is the \(3\times4\) <strong>geometry matrix</strong> (one constraint per column) and \(\mathbf M\)
      is the \(4\times4\) <strong>basis matrix</strong>. Row \(i\) of \(\mathbf M\) holds the coefficients of blending
      function \(i\). Each class of cubic curve (Hermite, Bézier, Catmull-Rom, B-spline) has one fixed basis matrix,
      and individual curves differ only in \(\mathbf G\). Comparing with \(\mathbf Q = \mathbf C\mathbf T\) shows that
      \(\mathbf C = \mathbf G\mathbf M\). An engine can compute that product once per piece and then evaluate the
      cheap polynomial form many times.</p>

      <div class="key">Read \(\mathbf Q(t) = \mathbf G\mathbf M\mathbf T(t)\) from right to left. \(\mathbf T(t)\) lists
      the powers of \(t\), \(\mathbf M\mathbf T(t)\) turns them into four weights, and \(\mathbf G\) mixes the four
      constraints with those weights. One evaluation routine handles every class of cubic. Only the \(4\times4\)
      matrix changes.</div>

      <h3>Where does a basis matrix come from?</h3>
      <p>Each constraint is a <em>linear measurement</em> of the curve. The position at \(t = 0\) is
      \(\mathbf C\,\mathbf T(0)\), the tangent at \(t = 1\) is \(\mathbf C\,\mathbf T'(1)\), and so on. Put the four
      measurement columns side by side in a \(4\times4\) matrix \(\mathbf A\); the constraints then say
      \(\mathbf G = \mathbf C\mathbf A\). Because \(\mathbf C = \mathbf G\mathbf M\) as well, \(\mathbf G = \mathbf G\mathbf M\mathbf A\)
      for every possible \(\mathbf G\), which forces \(\mathbf M = \mathbf A^{-1}\). Section 11.2 uses exactly this
      recipe to build the Hermite basis matrix.</p>

      <p>The classes in this chapter, side by side:</p>
      <table>
        <tr><th>class</th><th>geometry matrix \(\mathbf G\)</th><th>passes through</th><th>chained continuity</th></tr>
        <tr><td>Hermite (11.2)</td><td>\([\mathbf P_1\;\mathbf P_2\;\mathbf T_1\;\mathbf T_2]\)</td><td>both endpoints</td><td>\(C^1\) if tangents are shared</td></tr>
        <tr><td>Bézier (11.3)</td><td>\([\mathbf P_0\;\mathbf P_1\;\mathbf P_2\;\mathbf P_3]\)</td><td>\(\mathbf P_0\) and \(\mathbf P_3\)</td><td>\(C^1\) if the handles are mirrored</td></tr>
        <tr><td>Catmull-Rom (11.4)</td><td>\([\mathbf P_{i-1}\;\mathbf P_i\;\mathbf P_{i+1}\;\mathbf P_{i+2}]\)</td><td>\(\mathbf P_i\) and \(\mathbf P_{i+1}\)</td><td>\(C^1\) automatically</td></tr>
        <tr><td>uniform B-spline (11.6)</td><td>\([\mathbf P_{i-1}\;\mathbf P_i\;\mathbf P_{i+1}\;\mathbf P_{i+2}]\)</td><td>none of them, in general</td><td>\(C^2\) automatically</td></tr>
      </table>

      <div class="note"><b>Transform the control points, not the curve.</b> For the classes whose constraints are all
      points (Bézier, Catmull-Rom, B-spline), the four blending functions add up to 1 for every \(t\). Translating
      every \(\mathbf g_i\) by \(\mathbf D\) then gives \(\sum w_i(\mathbf g_i + \mathbf D) = \mathbf Q(t) + \mathbf D\),
      and the same argument works for any affine transform. So to move, rotate or scale a curve you transform its 4
      control points instead of hundreds of tessellated vertices.</div>

      <div class="warn">The parameter \(t\) is <em>not</em> distance. Equal steps in \(t\) usually give unequal steps
      along the curve, and the spacing depends on how the constraints are placed. Anything that must move at a
      steady speed needs an arc-length table (Section 11.4).</div>

      <p><a class="btn goto-sim" href="#/11.1/sim">Try it: one formula, three basis matrices →</a></p>
    `,

    keyFormulas: [
      ["Cubic curve", String.raw`\mathbf Q(t) = \mathbf a + \mathbf b t + \mathbf c t^2 + \mathbf d t^3 = \mathbf C\,\mathbf T(t),\quad \mathbf T(t) = \langle 1, t, t^2, t^3\rangle`],
      ["Tangent", String.raw`\mathbf Q'(t) = \mathbf C\,\langle 0, 1, 2t, 3t^2\rangle`],
      ["Geometry and basis matrices", String.raw`\mathbf Q(t) = \mathbf G\,\mathbf M\,\mathbf T(t), \qquad \mathbf C = \mathbf G\mathbf M`],
      ["Basis from constraints", String.raw`\mathbf G = \mathbf C\mathbf A \;\Rightarrow\; \mathbf M = \mathbf A^{-1}`],
      ["C¹ vs G¹ joint", String.raw`\mathbf Q_2'(0) = \mathbf Q_1'(1) \;\;(C^1) \qquad \mathbf Q_2'(0) = u\,\mathbf Q_1'(1),\; u \gt 0 \;\;(G^1)`],
    ],

    exercises: [
      { q: String.raw`A curve has \(\mathbf a = \langle 0,0\rangle\), \(\mathbf b = \langle 3,0\rangle\), \(\mathbf c = \langle 0,3\rangle\), \(\mathbf d = \langle -1,-1\rangle\). Find \(\mathbf Q(1)\) and \(\mathbf Q'(1)\).`,
        a: String.raw`\(\mathbf Q(1) = \mathbf a+\mathbf b+\mathbf c+\mathbf d = \langle 2, 2\rangle\). \(\mathbf Q'(1) = \mathbf b + 2\mathbf c + 3\mathbf d = \langle 3,0\rangle + \langle 0,6\rangle + \langle -3,-3\rangle = \langle 0, 3\rangle\).` },
      { q: "Why does every class of cubic curve need exactly four geometric constraints?",
        a: String.raw`A cubic has four unknown coefficient vectors \(\mathbf a, \mathbf b, \mathbf c, \mathbf d\). Each vector constraint gives one vector equation, so four independent constraints determine the curve uniquely (the matrix \(\mathbf A\) is \(4\times4\) and invertible).` },
      { q: String.raw`Piece A ends with tangent \(\langle 2, 1, 0\rangle\) and piece B starts at the same point with tangent \(\langle 6, 3, 0\rangle\). What continuity is this? What happens to an object that advances \(t\) at a constant rate?`,
        a: String.raw`The tangents are parallel with ratio \(u = 3\), so the joint is \(G^1\) but not \(C^1\). The object keeps its heading but its speed triples instantly at the joint.` },
      { q: String.raw`Show that if the blending weights satisfy \(\sum_i w_i(t) = 1\), translating all control points by \(\mathbf D\) translates the curve by \(\mathbf D\).`,
        a: String.raw`\(\sum_i w_i(\mathbf g_i + \mathbf D) = \sum_i w_i\mathbf g_i + \left(\sum_i w_i\right)\mathbf D = \mathbf Q(t) + \mathbf D\).` },
    ],

    sims: [
      {
        title: "One formula, three basis matrices",
        help: String.raw`<p>The same four points \(\mathbf g_1..\mathbf g_4\) go into \(\mathbf Q(t) = \mathbf G\mathbf M\mathbf T(t)\).
          Switch the basis matrix \(\mathbf M\) and see how differently the points are used. The Bézier curve starts at
          \(\mathbf g_1\) and ends at \(\mathbf g_4\). The Catmull-Rom curve runs from \(\mathbf g_2\) to \(\mathbf g_3\).
          The B-spline touches none of them. The lower plot shows the four weights \(\mathbf M\mathbf T(t)\), and the
          readout shows the coefficients \(\mathbf C = \mathbf G\mathbf M\).</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 4.2, height: 360 });
          const plot = sim.view2d(stage, { xRange: [-0.04, 1.04], yRange: [-0.3, 1.12], height: 170 });
          const out = sim.readout(readout);
          const cols = ["a", "b", "c", "d"];
          const redraw = () => { view.redraw(); plot.redraw(); };
          const g = [[-5, -2.2], [-2.5, 2.6], [2.5, 2.6], [5, -2.2]].map((p, i) =>
            view.handle(p, { color: cols[i], label: "g" + sub(i + 1), onDrag: () => plot.redraw() }));
          const names = { bezier: "Bézier", catmull: "Catmull-Rom", bspline: "B-spline" };
          const mode = sim.segmented(controls, {
            label: "Basis matrix M",
            options: Object.entries(names),
            value: "bezier",
            onChange: redraw,
          });
          const overlay = sim.checkbox(controls, { label: "Overlay the other two curves", value: true, onChange: redraw });
          const tS = sim.slider(controls, { label: "Parameter t", min: 0, max: 1, step: 0.01, value: 0.35, onInput: redraw });
          const anim = sim.loop((dt, time) => {
            tS.value = 0.5 - 0.5 * Math.cos(time * 1.2);
            redraw();
          }, { autostart: false });
          sim.checkbox(controls, { label: "Animate t", value: false, onChange: (on) => (on ? anim.start() : anim.stop()) });
          sim.legend(controls, [["a", "g₁"], ["b", "g₂"], ["c", "g₃"], ["d", "g₄"], ["e", "Q(t)"]]);

          view.onDraw((v) => {
            v.grid({ step: 1 });
            v.axes();
            const G = g.map((h) => h.pos);
            v.polyline(G, { color: "muted", dash: [5, 5], width: 1.2 });
            if (overlay.value) {
              for (const k of Object.keys(names)) {
                if (k === mode.value) continue;
                const pts = sampleCurve((t) => cubicAt(G, BASIS[k], t));
                v.polyline(pts, { color: "muted", width: 2, alpha: 0.55, dash: [2, 4] });
                v.text(pts[32], names[k], { color: "muted", size: 11, offset: [6, 14] });
              }
            }
            const Mx = BASIS[mode.value];
            v.polyline(sampleCurve((t) => cubicAt(G, Mx, t)), { color: "f", width: 3.5 });
            const t = tS.value;
            const Q = cubicAt(G, Mx, t), D = cubicAt(G, Mx, t, 1);
            const w = blend(Mx, t);
            for (let i = 0; i < 4; i++) v.line(Q, G[i], { color: cols[i], alpha: 0.15 + 0.6 * Math.min(1, Math.abs(w[i])), width: 1 + 3 * Math.abs(w[i]) });
            v.arrow(Q, V.add(Q, V.scale(D, 0.25)), { color: "e", width: 2, label: "Q′/4" });
            v.point(Q, { color: "e", r: 6, label: "Q(t)" });

            // coefficient columns C = G M: column j = sum_i g_i M[i][j]
            const C = [0, 1, 2, 3].map((j) => combo(G, Mx.map((r) => r[j])));
            out.set(sim.rows([
              ["t", fmt(t, 2)],
              ...w.map((wi, i) => [sim.swatch(cols[i]) + `w${sub(i + 1)} = (M T)${sub(i + 1)}`, fmt(wi, 3)]),
              ["Σ wᵢ", fmt(w.reduce((s, x) => s + x, 0), 3)],
              [sim.swatch("e") + "Q(t) = Σ wᵢ gᵢ", fmtVec(Q)],
              ["Q(0)", fmtVec(cubicAt(G, Mx, 0))],
              ["Q(1)", fmtVec(cubicAt(G, Mx, 1))],
            ]) + `<hr>Coefficients C = G M:<div class="eq">a = ${fmtVec(C[0])}\nb = ${fmtVec(C[1])}\nc = ${fmtVec(C[2])}\nd = ${fmtVec(C[3])}</div>`);
          });

          plot.onDraw((v) => {
            drawBlends(v, BASIS[mode.value], tS.value, cols, ["w₁", "w₂", "w₃", "w₄"]);
          });
        },
      },
      {
        title: "Joining two pieces: C⁰, G¹ and C¹",
        help: String.raw`<p>Two cubic pieces meet at the white joint. Each piece is set by its endpoints and end tangents;
          the small handles sit at one third of each tangent (so \(\mathbf T = 3\times\) handle offset). Pick a joint
          rule and drag the two handles next to the joint. The lower plot shows the speed \(\lVert\mathbf Q'(u)\rVert\)
          of a dot that advances \(u\) at a constant rate. With \(G^1\) the path looks smooth but the speed jumps at
          \(u = 1\); with \(C^1\) it doesn't. Free handles give a visible kink.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 4, height: 360 });
          const plot = sim.view2d(stage, { xRange: [0, 2], yRange: [0, 14], height: 150 });
          const out = sim.readout(readout);
          const redraw = () => { view.redraw(); plot.redraw(); };
          // tangent handles first so they stay grabbable when they sit on top of a point
          const A0 = view.handle([-4.5, 2], { color: "a", r: 5 });
          const Ain = view.handle([-1.6, 1], { color: "a", r: 5 });
          const Aout = view.handle([0.8, 1], { color: "b", r: 5 });
          const A2 = view.handle([4.5, 2], { color: "b", r: 5 });
          const P0 = view.handle([-6, -1.5], { color: "a", label: "P₀" });
          const P1 = view.handle([0, 1], { color: "fg", label: "joint" });
          const P2 = view.handle([6, -1.5], { color: "b", label: "P₂" });

          const follow = (h, kids) => {
            let last = [...h.pos];
            h.onDrag = (p) => {
              const d = V.sub(p, last);
              kids.forEach((k) => { k.pos[0] += d[0]; k.pos[1] += d[1]; });
              last = [...p];
              plot.redraw();
            };
          };
          follow(P0, [A0]);
          follow(P1, [Ain, Aout]);
          follow(P2, [A2]);

          const mode = sim.segmented(controls, {
            label: "Joint rule",
            options: [["c0", "C⁰ (free)"], ["g1", "G¹"], ["c1", "C¹"]],
            value: "g1",
            onChange: () => { enforce(Aout); redraw(); },
          });
          // keep the two joint tangents parallel (G1) or equal (C1); `master` is the handle being dragged
          function enforce(master) {
            if (mode.value === "c0") return;
            const other = master === Aout ? Ain : Aout;
            const dir = master === Aout ? V.sub(Aout.pos, P1.pos) : V.sub(P1.pos, Ain.pos);   // direction of travel
            if (V.len(dir) < 1e-6) return;
            const len = mode.value === "c1" ? V.len(dir) : V.len(V.sub(other.pos, P1.pos));
            const u = V.norm(dir);
            const p = other === Aout ? V.add(P1.pos, V.scale(u, len)) : V.sub(P1.pos, V.scale(u, len));
            other.pos[0] = p[0];
            other.pos[1] = p[1];
          }
          Ain.onDrag = () => { enforce(Ain); plot.redraw(); };
          Aout.onDrag = () => { enforce(Aout); plot.redraw(); };
          A0.onDrag = A2.onDrag = () => plot.redraw();

          const rate = sim.slider(controls, { label: "Rate of u", min: 0.1, max: 1, step: 0.05, value: 0.35, unit: " /s" });
          let u = 0;
          const play = sim.loop((dt) => { u = (u + rate.value * dt) % 2; redraw(); });
          sim.checkbox(controls, { label: "Move the dot", value: true, onChange: (on) => (on ? play.start() : play.stop()) });

          const pieces = () => {
            const T0 = V.scale(V.sub(A0.pos, P0.pos), 3), Tin = V.scale(V.sub(P1.pos, Ain.pos), 3);
            const Tout = V.scale(V.sub(Aout.pos, P1.pos), 3), T2 = V.scale(V.sub(P2.pos, A2.pos), 3);
            return { G1: [P0.pos, P1.pos, T0, Tin], G2: [P1.pos, P2.pos, Tout, T2], Tin, Tout };
          };
          const at = (pc, uu, d = 0) => (uu < 1 ? cubicAt(pc.G1, BASIS.hermite, uu, d) : cubicAt(pc.G2, BASIS.hermite, Math.min(uu - 1, 1), d));

          view.onDraw((v) => {
            v.grid({ step: 1 });
            const pc = pieces();
            [[P0, A0], [P1, Ain], [P1, Aout], [P2, A2]].forEach(([p, a]) => v.line(p.pos, a.pos, { color: "muted", width: 1.2 }));
            v.polyline(sampleCurve((t) => cubicAt(pc.G1, BASIS.hermite, t)), { color: "a", width: 3.5 });
            v.polyline(sampleCurve((t) => cubicAt(pc.G2, BASIS.hermite, t)), { color: "b", width: 3.5 });
            // dots at equal steps of u: their spacing shows the speed
            for (let k = 0; k <= 24; k++) v.point(at(pc, k / 12), { color: "fg", r: 2.5 });
            const Q = at(pc, u), D = at(pc, u, 1);
            v.arrow(Q, V.add(Q, V.scale(D, 1 / 3)), { color: "e", width: 2.5, label: "Q′/3" });
            v.point(Q, { color: "e", r: 7 });

            const lin = V.len(pc.Tin), lout = V.len(pc.Tout);
            const ang = V.angle(pc.Tin, pc.Tout) * 180 / Math.PI;
            let verdict;
            if (V.len(V.sub(pc.Tin, pc.Tout)) < 0.02 * Math.max(lin, 1e-6)) verdict = "<b class='ok'>C¹</b>: equal tangent vectors, the speed is continuous.";
            else if (ang < 0.5) verdict = `<b>G¹</b>: same direction, length ratio u = ${fmt(lout / lin, 2)}. The speed jumps at the joint.`;
            else verdict = `<b class='bad'>C⁰ only</b>: the path has a ${fmt(ang, 1)}° kink.`;
            out.set(sim.rows([
              [sim.swatch("a") + "Q₁′(1) = T_in", fmtVec(pc.Tin)],
              [sim.swatch("b") + "Q₂′(0) = T_out", fmtVec(pc.Tout)],
              ["‖T_in‖, ‖T_out‖", fmt(lin) + ", " + fmt(lout)],
              ["angle between", fmt(ang, 1) + "°"],
              ["u (dot)", fmt(u, 2)],
              ["speed ‖Q′(u)‖", fmt(V.len(D))],
            ]) + "<hr>" + verdict);
          });

          plot.onDraw((v) => {
            const pc = pieces();
            const sp = sampleCurve((uu) => [uu, V.len(at(pc, Math.min(uu, 1.9999), 1))], 200, 0, 2);
            const top = Math.max(2, ...sp.map((p) => p[1])) * 1.15;
            v.opts.yRange = [0, top];
            v.grid({ stepX: 0.25 });
            v.axes({ labels: ["u", "speed ‖Q′‖"] });
            v.line([1, 0], [1, top], { color: "muted", dash: [4, 4], width: 1 });
            v.polyline(sp.filter((p) => p[0] < 1), { color: "a", width: 2.5 });
            v.polyline(sp.filter((p) => p[0] >= 1), { color: "b", width: 2.5 });
            v.point([u, V.len(at(pc, u, 1))], { color: "e", r: 5 });
          });
        },
      },
    ],

    cpp: [
      {
        title: "Coefficient form with Horner's rule",
        formula: String.raw`\mathbf Q(t) = \mathbf a + t\big(\mathbf b + t(\mathbf c + t\,\mathbf d)\big) \qquad \mathbf Q'(t) = \mathbf b + 2t\,\mathbf c + 3t^2\mathbf d`,
        code: String.raw`
          struct CubicCurve
          {
              Vector3D a, b, c, d;     // Q(t) = a + b t + c t^2 + d t^3

              Point3D Evaluate(float t) const
              {
                  return a + (b + (c + d * t) * t) * t;     // Horner's rule: 3 multiply-adds per axis
              }

              Vector3D Tangent(float t) const               // Q'(t) = C (0, 1, 2t, 3t^2)
              {
                  return b + (c * 2.0f + d * (3.0f * t)) * t;
              }
          };
        `,
      },
      {
        title: "Q(t) = G M T(t) for any basis matrix",
        formula: String.raw`w_i(t) = \sum_{j=0}^{3} M_{ij}\,t^j, \qquad \mathbf Q(t) = \sum_{i=1}^{4} w_i(t)\,\mathbf g_i`,
        note: "<p>One routine evaluates Hermite, Bézier, Catmull-Rom and B-spline pieces; only the matrix changes.</p>",
        code: String.raw`
          struct BasisMatrix
          {
              float m[4][4];     // m[i][j] = coefficient of t^j in blending function i
          };

          Point3D EvaluateCubic(const Point3D g[4], const BasisMatrix& M, float t)
          {
              float T[4] = {1.0f, t, t * t, t * t * t};                     // T(t)

              Point3D q(0.0f, 0.0f, 0.0f);
              for (int i = 0; i < 4; i++)
              {
                  // blending weight of constraint i: row i of M dotted with T(t)
                  float w = M.m[i][0] * T[0] + M.m[i][1] * T[1] + M.m[i][2] * T[2] + M.m[i][3] * T[3];
                  q += g[i] * w;                                              // sum of w_i g_i
              }
              return q;
          }
        `,
      },
      {
        title: "Precompute C = G M once per piece",
        formula: String.raw`\mathbf C = \mathbf G\mathbf M \quad\Rightarrow\quad \text{column } j \text{ of } \mathbf C = \sum_{i} \mathbf g_i\,M_{ij}`,
        note: "<p>Tessellating a piece into 64 vertices? Multiply G by M once, then use the cheap Horner form for every vertex.</p>",
        code: String.raw`
          CubicCurve ToCoefficients(const Point3D g[4], const BasisMatrix& M)
          {
              Vector3D col[4];
              for (int j = 0; j < 4; j++)
                  col[j] = g[0] * M.m[0][j] + g[1] * M.m[1][j] + g[2] * M.m[2][j] + g[3] * M.m[3][j];
              return {col[0], col[1], col[2], col[3]};     // a, b, c, d
          }
        `,
      },
      {
        title: "Classifying the joint between two pieces",
        formula: String.raw`C^1:\ \mathbf Q_B'(0) = \mathbf Q_A'(1) \qquad G^1:\ \mathbf Q_B'(0) = u\,\mathbf Q_A'(1),\ u \gt 0`,
        code: String.raw`
          enum class Continuity { None, C0, G1, C1 };

          Continuity ClassifyJoint(const Point3D& endA, const Vector3D& tanA,       // Q_A(1), Q_A'(1)
                                   const Point3D& startB, const Vector3D& tanB,     // Q_B(0), Q_B'(0)
                                   float eps = 1.0e-4f)
          {
              if (SquaredMag(startB - endA) > eps * eps) return Continuity::None;   // pieces don't touch
              if (SquaredMag(tanB - tanA) <= eps * eps) return Continuity::C1;        // equal vectors

              float la = Magnitude(tanA), lb = Magnitude(tanB);
              if (la > eps && lb > eps && Dot(tanA, tanB) >= la * lb * (1.0f - eps))
                  return Continuity::G1;                                            // parallel, other length
              return Continuity::C0;                                                // shared point, kink
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 11.2 Hermite Curves
  // ===========================================================================
  L3D.topic({
    id: "11.2",
    summary: "A Hermite curve is set by two endpoints and the tangent vectors there. Its basis matrix comes from inverting the four constraint equations.",

    lesson: String.raw`
      <p>A <strong>cubic Hermite curve</strong> is defined by its two endpoints \(\mathbf P_1, \mathbf P_2\) and the
      tangent vectors \(\mathbf T_1, \mathbf T_2\) at those endpoints. It's the most direct way to say <em>leave
      \(\mathbf P_1\) heading this way at this speed, and arrive at \(\mathbf P_2\) heading that way</em>. The geometry
      matrix is \(\mathbf G_H = [\mathbf P_1\;\mathbf P_2\;\mathbf T_1\;\mathbf T_2]\) and the curve is
      \(\mathbf H(t) = \mathbf G_H\mathbf M_H\mathbf T(t)\) for a basis matrix \(\mathbf M_H\) we now derive.</p>

      <h2>Deriving the basis matrix</h2>
      <p>The four constraints are \(\mathbf H(0) = \mathbf P_1\), \(\mathbf H(1) = \mathbf P_2\), \(\mathbf H'(0) = \mathbf T_1\)
      and \(\mathbf H'(1) = \mathbf T_2\). Each is \(\mathbf G_H\mathbf M_H\) applied to a known column:
      \(\mathbf T(0) = \langle 1,0,0,0\rangle\), \(\mathbf T(1) = \langle 1,1,1,1\rangle\),
      \(\mathbf T'(0) = \langle 0,1,0,0\rangle\) and \(\mathbf T'(1) = \langle 0,1,2,3\rangle\). Stacking the four columns
      gives one matrix equation:
      \[ \mathbf G_H\,\mathbf M_H \begin{bmatrix} 1 & 1 & 0 & 0 \\ 0 & 1 & 1 & 1 \\ 0 & 1 & 0 & 2 \\ 0 & 1 & 0 & 3 \end{bmatrix}
         = \mathbf G_H . \]
      This has to hold for every choice of points and tangents, so \(\mathbf M_H\) is the inverse of the constraint
      matrix:</p>
      <div class="formula">
        \[ \mathbf M_H = \begin{bmatrix} 1 & 1 & 0 & 0 \\ 0 & 1 & 1 & 1 \\ 0 & 1 & 0 & 2 \\ 0 & 1 & 0 & 3 \end{bmatrix}^{-1}
           = \begin{bmatrix} 1 & 0 & -3 & 2 \\ 0 & 0 & 3 & -2 \\ 0 & 1 & -2 & 1 \\ 0 & 0 & -1 & 1 \end{bmatrix}. \]
      </div>

      <h2>The blending functions</h2>
      <p>Reading the rows of \(\mathbf M_H\) as polynomials gives the Hermite curve as a weighted sum of its
      constraints:</p>
      <div class="formula">
        \[ \mathbf H(t) = (1 - 3t^2 + 2t^3)\,\mathbf P_1 + t^2(3 - 2t)\,\mathbf P_2 + t(t-1)^2\,\mathbf T_1 + t^2(t-1)\,\mathbf T_2 . \]
      </div>
      <ul>
        <li>At \(t = 0\) only the weight of \(\mathbf P_1\) is nonzero, and at \(t = 1\) only the weight of
          \(\mathbf P_2\) is, so the curve interpolates both endpoints.</li>
        <li>The two point weights always add up to 1, so the position part is an affine combination of the endpoints.</li>
        <li>The tangent weights are zero at both ends but have slope 1 at their own end. They bend the middle of the
          curve without moving its endpoints. Their size is small (at most \(4/27 \approx 0.15\)), which is why Hermite
          tangents usually have to be about three times longer than you'd guess.</li>
      </ul>
      <p>Differentiating each blending function gives the tangent along the whole curve:
      \[ \mathbf H'(t) = (6t^2 - 6t)\,\mathbf P_1 + (6t - 6t^2)\,\mathbf P_2 + (3t^2 - 4t + 1)\,\mathbf T_1 + (3t^2 - 2t)\,\mathbf T_2 . \]</p>

      <div class="game">Set \(\mathbf P_1 = 0\), \(\mathbf P_2 = 1\) and both tangents to zero, and the curve is
      \(3t^2 - 2t^3\): the familiar <code>smoothstep</code> from shader code. "Ease in, ease out" is just a Hermite
      curve whose tangents are zero.</div>

      <h2>Tangent length and time scaling</h2>
      <p>The direction of \(\mathbf T_1\) sets the heading out of \(\mathbf P_1\). Its length sets how long the
      curve keeps that heading before turning toward \(\mathbf P_2\). Short tangents give a nearly straight path with
      tight turns at the ends; long tangents make the curve bulge, overshoot or even loop.</p>
      <p>Animation curves add one more detail. If a segment covers the time interval \([t_0, t_1]\) of length
      \(\Delta t = t_1 - t_0\), the curve parameter is \(u = (\text{time} - t_0)/\Delta t\), so
      \(\frac{d}{d\,\text{time}} = \frac{1}{\Delta t}\frac{d}{du}\). To reproduce a velocity (or slope) \(\mathbf v\)
      at a key, the Hermite tangent must be</p>
      <div class="formula">\[ \mathbf T = \mathbf v\,\Delta t . \]</div>
      <div class="warn">Forgetting the \(\Delta t\) factor is a classic keyframe bug: long segments come out too flat
      and short ones overshoot, because the same slope means a different tangent length on each segment. The same
      applies when you smooth networked objects between two snapshots that carry position and velocity.</div>

      <h2>Chaining Hermite pieces</h2>
      <p>If one piece has geometry matrix \([\mathbf P_1\;\mathbf P_2\;\mathbf T_1\;\mathbf T_2]\), a second piece
      that starts at \(\mathbf P_2\) with geometry matrix \([\mathbf P_2\;\mathbf P_3\;u\mathbf T_2\;\mathbf T_3]\)
      joins it with \(G^1\) continuity for any \(u \gt 0\), and with \(C^1\) continuity when \(u = 1\). Each piece
      carries its own tangents, which is exactly how animation editors store curves: every key has an
      <em>in</em> tangent and an <em>out</em> tangent. Making them equal gives a smooth key; letting them differ
      gives a deliberate corner ("broken tangents").</p>

      <div class="note">\(\mathbf T_1\) and \(\mathbf T_2\) are <em>directions</em>. When you transform a Hermite curve
      by a matrix, transform the points with translation and the tangents without it (\(w = 0\), Section 4.4.2).</div>

      <p><a class="btn goto-sim" href="#/11.2/sim">Try it: edit a Hermite curve and an animation curve →</a></p>
    `,

    keyFormulas: [
      ["Geometry matrix", String.raw`\mathbf G_H = [\mathbf P_1\;\mathbf P_2\;\mathbf T_1\;\mathbf T_2]`],
      ["Hermite basis matrix", String.raw`\mathbf M_H = \begin{bmatrix} 1 & 0 & -3 & 2 \\ 0 & 0 & 3 & -2 \\ 0 & 1 & -2 & 1 \\ 0 & 0 & -1 & 1 \end{bmatrix}`],
      ["Hermite curve", String.raw`\mathbf H(t) = (1 - 3t^2 + 2t^3)\mathbf P_1 + t^2(3 - 2t)\mathbf P_2 + t(t-1)^2\mathbf T_1 + t^2(t-1)\mathbf T_2`],
      ["Smooth joint", String.raw`[\mathbf P_2\;\mathbf P_3\;u\mathbf T_2\;\mathbf T_3]: \; G^1 \text{ for } u \gt 0,\; C^1 \text{ for } u = 1`],
      ["Time-scaled tangent", String.raw`\mathbf T = \mathbf v\,\Delta t`],
    ],

    exercises: [
      { q: String.raw`Use the blending functions to check that \(\mathbf H(0) = \mathbf P_1\) and \(\mathbf H'(1) = \mathbf T_2\).`,
        a: String.raw`At \(t=0\) the weights are \((1, 0, 0, 0)\), so \(\mathbf H(0) = \mathbf P_1\). The derivative weights at \(t = 1\) are \((6-6,\; 6-6,\; 3-4+1,\; 3-2) = (0, 0, 0, 1)\), so \(\mathbf H'(1) = \mathbf T_2\).` },
      { q: String.raw`Show that the midpoint of a Hermite curve is \(\mathbf H(\tfrac12) = \tfrac12(\mathbf P_1 + \mathbf P_2) + \tfrac18(\mathbf T_1 - \mathbf T_2)\).`,
        a: String.raw`At \(t = \tfrac12\): \(1 - \tfrac34 + \tfrac14 = \tfrac12\), \(\tfrac14\cdot 2 = \tfrac12\), \(\tfrac12\cdot\tfrac14 = \tfrac18\), and \(\tfrac14\cdot(-\tfrac12) = -\tfrac18\).` },
      { q: String.raw`A key at time 2.0 s has value 0 and a key at 2.5 s has value 10. Both have slope 20 units/s. What are the Hermite tangents, and what shape is the segment?`,
        a: String.raw`\(\Delta t = 0.5\), so both tangents are \(20 \cdot 0.5 = 10\). With \(P_1 = 0, P_2 = 10, T_1 = T_2 = 10\): \(H(t) = 10(3t^2 - 2t^3) + 10(t - 2t^2 + t^3) + 10(t^3 - t^2) = 10t\). It's a straight line at constant speed, because the tangents match the chord.` },
      { q: String.raw`Why is \(\mathbf H(t)\) with \(\mathbf T_1 = \mathbf T_2 = \mathbf 0\) a straight segment, and how does an object move along it at a constant rate of \(t\)?`,
        a: String.raw`It becomes \(\mathbf P_1 + (3t^2 - 2t^3)(\mathbf P_2 - \mathbf P_1)\), a point on the segment. The factor is smoothstep, so the object starts and stops with zero speed (ease in, ease out) and is fastest at \(t = \tfrac12\), where the speed is \(1.5\lVert\mathbf P_2 - \mathbf P_1\rVert\).` },
    ],

    sims: [
      {
        title: "Hermite curve editor",
        help: String.raw`<p>Drag the endpoints \(\mathbf P_1, \mathbf P_2\) and the tangent handles. Each small handle sits at
          \(\mathbf P + \mathbf T/3\), so the real tangent is three times the arrow. The dots are at equal steps of \(t\),
          and their spacing shows the speed. Try the presets: zero tangents give smoothstep easing along a straight line,
          and long tangents make the curve overshoot or loop. The lower plot shows the four blending functions.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 5, height: 380 });
          const plot = sim.view2d(stage, { xRange: [-0.04, 1.04], yRange: [-0.25, 1.1], height: 160 });
          const out = sim.readout(readout);
          const cols = ["a", "b", "c", "d"];
          const redraw = () => { view.redraw(); plot.redraw(); };
          const H1 = view.handle([0, 0], { color: "c", r: 6, label: "T₁/3", onDrag: () => plot.redraw() });
          const H2 = view.handle([0, 0], { color: "d", r: 6, label: "T₂/3", onDrag: () => plot.redraw() });
          const P1 = view.handle([0, 0], { color: "a", label: "P₁" });
          const P2 = view.handle([0, 0], { color: "b", label: "P₂" });
          const follow = (p, kid) => {
            let last = [...p.pos];
            p.onDrag = (q) => { kid.pos[0] += q[0] - last[0]; kid.pos[1] += q[1] - last[1]; last = [...q]; plot.redraw(); };
            p.sync = () => (last = [...p.pos]);
          };
          follow(P1, H1);
          follow(P2, H2);
          const presets = {
            s: [[-4.5, -1.5], [4.5, 1.5], [6, 10.5], [6, 10.5]],
            arch: [[-4.5, -1.5], [4.5, -1.5], [6, 12], [6, -12]],
            over: [[-4, -1], [4, 1], [21, 0], [21, 0]],
            loop: [[-1.5, -1.5], [1.5, -1.5], [12, 9], [12, -9]],
            zero: [[-4.5, -2], [4.5, 2], [0, 0], [0, 0]],
          };
          const apply = (k) => {
            const [p1, p2, t1, t2] = presets[k];
            P1.set(p1); P2.set(p2);
            H1.set(V.add(p1, V.scale(t1, 1 / 3)));
            H2.set(V.add(p2, V.scale(t2, 1 / 3)));
            P1.sync(); P2.sync();
            redraw();
          };
          sim.select(controls, {
            label: "Preset",
            options: [["s", "S-curve"], ["arch", "Arch"], ["over", "Overshoot (long tangents)"], ["loop", "Loop"], ["zero", "Zero tangents (smoothstep)"]],
            value: "s",
            onChange: apply,
          });
          const tS = sim.slider(controls, { label: "Parameter t", min: 0, max: 1, step: 0.01, value: 0.3, onInput: redraw });
          const anim = sim.loop((dt, time) => { tS.value = (time * 0.35) % 1; redraw(); }, { autostart: false });
          sim.checkbox(controls, { label: "Animate t", value: false, onChange: (on) => (on ? anim.start() : anim.stop()) });
          const dots = sim.checkbox(controls, { label: "Dots at equal steps of t", value: true, onChange: redraw });
          apply("s");

          const geom = () => [P1.pos, P2.pos, V.scale(V.sub(H1.pos, P1.pos), 3), V.scale(V.sub(H2.pos, P2.pos), 3)];

          view.onDraw((v) => {
            v.grid({ step: 1 });
            v.axes();
            const G = geom();
            v.arrow(P1.pos, H1.pos, { color: "c", width: 2 });
            v.arrow(P2.pos, H2.pos, { color: "d", width: 2 });
            v.polyline(sampleCurve((t) => cubicAt(G, BASIS.hermite, t), 120), { color: "f", width: 3.5 });
            if (dots.value) for (let k = 0; k <= 20; k++) v.point(cubicAt(G, BASIS.hermite, k / 20), { color: "fg", r: 2.5 });
            const t = tS.value;
            const Q = cubicAt(G, BASIS.hermite, t), D = cubicAt(G, BASIS.hermite, t, 1);
            v.arrow(Q, V.add(Q, V.scale(D, 1 / 3)), { color: "e", width: 2, label: "H′/3" });
            v.point(Q, { color: "e", r: 6 });
            const w = blend(BASIS.hermite, t);
            out.set(sim.rows([
              ["T₁ = 3 × handle", fmtVec(G[2])],
              ["T₂ = 3 × handle", fmtVec(G[3])],
              ["t", fmt(t, 2)],
              [sim.swatch("a") + "1 − 3t² + 2t³", fmt(w[0], 3)],
              [sim.swatch("b") + "t²(3 − 2t)", fmt(w[1], 3)],
              [sim.swatch("c") + "t(t − 1)²", fmt(w[2], 3)],
              [sim.swatch("d") + "t²(t − 1)", fmt(w[3], 3)],
              [sim.swatch("e") + "H(t)", fmtVec(Q)],
              ["H′(t)", fmtVec(D)],
              ["speed ‖H′(t)‖", fmt(V.len(D))],
            ]));
          });
          plot.onDraw((v) => drawBlends(v, BASIS.hermite, tS.value, cols, ["P₁", "P₂", "T₁", "T₂"]));
        },
      },
      {
        title: "Animation curve with Hermite keys",
        help: String.raw`<p>An animation curve as stored in an engine: keys (blue) with a slope handle each (purple). Every
          segment is a Hermite curve whose tangents are slope \(\times\,\Delta t\). Drag keys and slopes, or let the slopes
          be computed automatically. The ball on the right is driven by the curve. Tick the "bug" box to see what
          happens when the \(\Delta t\) factor is forgotten: segments of different lengths get badly shaped.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { xRange: [-0.3, 4.9], yRange: [-1.6, 3.6], height: 400 });
          const out = sim.readout(readout);
          const L = 0.35;   // slope handles sit L seconds from their key
          const init = [[0, 0, 0], [1.2, 2.5, 0.8], [2.6, 0.4, -0.6], [4, 2, 0]];
          const keys = [], slopes = [];
          const N = init.length;
          const side = (i) => (i === N - 1 ? -1 : 1);
          const mFree = init.map((k) => k[2]);   // slopes used in "Free" mode
          init.forEach(([t, val, m], i) => {
            const k = view.handle([t, val], {
              color: "a", label: "k" + sub(i),
              constrain: (p) => {
                const lo = i === 0 ? 0 : i === N - 1 ? 4 : keys[i - 1].pos[0] + 0.2;
                const hi = i === 0 ? 0 : i === N - 1 ? 4 : keys[i + 1].pos[0] - 0.2;
                return [clamp(p[0], lo, hi), clamp(p[1], -1.5, 3.5)];
              },
            });
            keys.push(k);
          });
          init.forEach(([t, val, m], i) => {
            const s = view.handle([t + side(i) * L, val + side(i) * L * m], {
              color: "d", r: 5,
              constrain: (p) => [keys[i].pos[0] + side(i) * L, clamp(p[1], -3, 6)],
              onDrag: (p) => { mode.value = "free"; mFree[i] = (p[1] - keys[i].pos[1]) / (side(i) * L); },
            });
            slopes.push(s);
          });
          const mode = sim.segmented(controls, {
            label: "Slopes",
            options: [["free", "Free"], ["auto", "Auto (Catmull-Rom)"], ["flat", "Flat"]],
            value: "free",
            onChange: () => view.redraw(),
          });
          const bug = sim.checkbox(controls, { label: "Bug: forget to multiply slopes by Δt", value: false, onChange: () => view.redraw() });
          const speed = sim.slider(controls, { label: "Playback speed", min: 0, max: 2, step: 0.05, value: 1, unit: "×" });
          let time = 0;
          sim.loop((dt) => { time = (time + dt * speed.value) % 4; view.redraw(); });

          const slopeOf = (i) => {
            const K = keys.map((k) => k.pos);
            if (mode.value === "flat") return 0;
            if (mode.value === "auto") {
              const a = K[Math.max(0, i - 1)], b = K[Math.min(N - 1, i + 1)];
              return (b[1] - a[1]) / (b[0] - a[0]);
            }
            return mFree[i];
          };
          const evalAt = (tm, m) => {
            const K = keys.map((k) => k.pos);
            let j = 0;
            while (j < N - 2 && tm > K[j + 1][0]) j++;
            const dT = K[j + 1][0] - K[j][0];
            const u = clamp((tm - K[j][0]) / dT, 0, 1);
            const scale = bug.value ? 1 : dT;
            const G = [[K[j][1]], [K[j + 1][1]], [m[j] * scale], [m[j + 1] * scale]];
            return { j, u, dT, value: cubicAt(G, BASIS.hermite, u)[0], slope: cubicAt(G, BASIS.hermite, u, 1)[0] / dT };
          };

          view.onDraw((v) => {
            v.grid({ stepX: 0.5, stepY: 0.5 });
            v.axes({ ticks: true, labels: ["time (s)", "value"] });
            const m = keys.map((_, i) => slopeOf(i));
            m.forEach((x, i) => (mFree[i] = x));   // switching to "Free" keeps the current shape
            // put the slope handles where the slopes are
            slopes.forEach((s, i) => { s.pos[0] = keys[i].pos[0] + side(i) * L; s.pos[1] = keys[i].pos[1] + side(i) * L * m[i]; });
            slopes.forEach((s, i) => v.line(V.sub(keys[i].pos, V.sub(s.pos, keys[i].pos)), s.pos, { color: "d", width: 1.5, alpha: 0.7 }));
            const pts = sampleCurve((tm) => [tm, evalAt(tm, m).value], 300, 0, 4);
            v.polyline(pts, { color: "f", width: 3 });
            const r = evalAt(time, m);
            v.line([time, -1.6], [time, 3.6], { color: "muted", dash: [4, 4], width: 1 });
            v.line([time, r.value], [4.55, r.value], { color: "e", dash: [3, 4], width: 1 });
            v.point([time, r.value], { color: "e", r: 5 });
            v.line([4.55, -1.5], [4.55, 3.5], { color: "grid2", width: 6 });
            v.point([4.55, r.value], { color: "e", r: 11 });
            out.set(sim.rows([
              ["time", fmt(time, 2) + " s"],
              ["segment", `k${sub(r.j)} → k${sub(r.j + 1)}`],
              ["Δt", fmt(r.dT, 2) + " s"],
              ["u = (time − t₀)/Δt", fmt(r.u, 3)],
              ["value", fmt(r.value, 3)],
              ["slope d(value)/d(time)", fmt(r.slope, 3)],
              ["tangents used", bug.value ? "<span class='bad'>slope (wrong)</span>" : "slope × Δt"],
            ]) + `<hr>Key slopes: ${m.map((x) => fmt(x, 2)).join(", ")}`);
          });
        },
      },
    ],

    cpp: [
      {
        title: "Hermite curve",
        formula: String.raw`\mathbf H(t) = (1 - 3t^2 + 2t^3)\mathbf P_1 + t^2(3 - 2t)\mathbf P_2 + t(t-1)^2\mathbf T_1 + t^2(t-1)\mathbf T_2`,
        code: String.raw`
          Point3D EvaluateHermite(const Point3D& p1, const Point3D& p2,
                                  const Vector3D& tan1, const Vector3D& tan2, float t)
          {
              float tt = t * t, ttt = tt * t;
              float h1 = 1.0f - 3.0f * tt + 2.0f * ttt;    // weight of P1
              float h2 = 3.0f * tt - 2.0f * ttt;           // weight of P2:  t^2 (3 - 2t)
              float h3 = t - 2.0f * tt + ttt;              // weight of T1:  t (t - 1)^2
              float h4 = ttt - tt;                         // weight of T2:  t^2 (t - 1)
              return p1 * h1 + p2 * h2 + tan1 * h3 + tan2 * h4;
          }
        `,
      },
      {
        title: "Hermite tangent",
        formula: String.raw`\mathbf H'(t) = (6t^2 - 6t)\mathbf P_1 + (6t - 6t^2)\mathbf P_2 + (3t^2 - 4t + 1)\mathbf T_1 + (3t^2 - 2t)\mathbf T_2`,
        code: String.raw`
          Vector3D HermiteTangent(const Point3D& p1, const Point3D& p2,
                                  const Vector3D& tan1, const Vector3D& tan2, float t)
          {
              float tt = t * t;
              return (p2 - p1) * (6.0f * t - 6.0f * tt)          // P1 and P2 weights are opposite
                   + tan1 * (3.0f * tt - 4.0f * t + 1.0f)
                   + tan2 * (3.0f * tt - 2.0f * t);
          }
        `,
      },
      {
        title: "Keyframed animation curve",
        formula: String.raw`u = \frac{\text{time} - t_0}{\Delta t}, \qquad \mathbf T_i = (\text{slope}_i)\,\Delta t`,
        code: String.raw`
          struct Keyframe
          {
              float time;      // seconds
              float value;
              float slope;     // d(value) / d(time) at this key
          };

          float EvaluateSegment(const Keyframe& k0, const Keyframe& k1, float time)
          {
              float dt = k1.time - k0.time;
              float t  = (time - k0.time) / dt;            // local Hermite parameter in [0, 1]
              float tt = t * t, ttt = tt * t;

              // Hermite tangents are per unit of t, so slopes (per second) are scaled by dt
              return k0.value * (1.0f - 3.0f * tt + 2.0f * ttt)
                   + k1.value * (3.0f * tt - 2.0f * ttt)
                   + k0.slope * dt * (t - 2.0f * tt + ttt)
                   + k1.slope * dt * (ttt - tt);
          }
        `,
      },
      {
        title: "Smoothing a networked object between snapshots",
        formula: String.raw`\mathbf p(\text{time}) = \mathbf H\!\left(u;\ \mathbf p_a,\ \mathbf p_b,\ \mathbf v_a\Delta t,\ \mathbf v_b\Delta t\right)`,
        note: "<p>Linear interpolation between snapshots gives a correct position but a velocity that jumps at every snapshot. A Hermite curve matches both position and velocity at each end.</p>",
        code: String.raw`
          struct Snapshot
          {
              float    time;
              Point3D  position;
              Vector3D velocity;
          };

          Point3D InterpolateSnapshots(const Snapshot& a, const Snapshot& b, float time)
          {
              float dt = b.time - a.time;
              float t  = Clamp((time - a.time) / dt, 0.0f, 1.0f);
              return EvaluateHermite(a.position, b.position, a.velocity * dt, b.velocity * dt, t);
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 11.3 Bézier Curves
  // ===========================================================================
  L3D.topic({
    id: "11.3",
    summary: "Bézier curves blend control points with Bernstein polynomials. They stay inside the convex hull, convert easily to Hermite form, and can be truncated or split exactly with the de Casteljau algorithm.",

    lesson: String.raw`
      <p>A <strong>Bézier curve</strong> of degree \(n\) is shaped by \(n + 1\) <em>control points</em>
      \(\mathbf P_0, \dots, \mathbf P_n\). It starts at \(\mathbf P_0\) and ends at \(\mathbf P_n\). The interior
      points are not on the curve; they pull it toward themselves like magnets. This makes Bézier curves the
      standard way to <em>draw</em> curves: vector graphics, font outlines (TrueType uses quadratic, OpenType/CFF
      cubic Béziers), CSS easing functions and most curve tools in level editors.</p>

      <p>The curve is a weighted sum of the control points,
      \[ \mathbf B(t) = \sum_{k=0}^{n} B_{n,k}(t)\,\mathbf P_k, \qquad
         B_{n,k}(t) = \binom{n}{k} t^k (1 - t)^{n-k}, \qquad \binom{n}{k} = \frac{n!}{k!\,(n-k)!}, \]
      and the weights \(B_{n,k}\) are the <strong>Bernstein polynomials</strong>. They obey a recurrence that looks
      like Pascal's triangle, except that each entry is a <em>weighted average</em> of the two entries above it
      instead of their sum:
      \[ B_{n,k}(t) = (1 - t)\,B_{n-1,k-1}(t) + t\,B_{n-1,k}(t), \qquad B_{0,0} = 1, \]
      with \(B_{n,k} = 0\) whenever \(k \lt 0\) or \(k \gt n\). Expanding \(\big((1-t) + t\big)^n = 1\) with the
      binomial theorem shows that the Bernstein polynomials of each degree add up to 1.</p>

      <h2 data-sub="11.3.1">Cubic Bézier Curves</h2>
      <p>For \(n = 3\) there are four control points and the curve is</p>
      <div class="formula">
        \[ \mathbf B(t) = (1-t)^3\,\mathbf P_0 + 3t(1-t)^2\,\mathbf P_1 + 3t^2(1-t)\,\mathbf P_2 + t^3\,\mathbf P_3 . \]
      </div>
      <p>Expanding the polynomials gives the geometry matrix \(\mathbf G_B = [\mathbf P_0\;\mathbf P_1\;\mathbf P_2\;\mathbf P_3]\)
      and the basis matrix
      \[ \mathbf B(t) = \mathbf G_B\,\mathbf M_B\,\mathbf T(t), \qquad
         \mathbf M_B = \begin{bmatrix} 1 & -3 & 3 & -1 \\ 0 & 3 & -6 & 3 \\ 0 & 0 & 3 & -3 \\ 0 & 0 & 0 & 1 \end{bmatrix}. \]
      At \(t = 0\) the weights are \((1, 0, 0, 0)\) and at \(t = 1\) they are \((0, 0, 0, 1)\), so the curve
      interpolates \(\mathbf P_0\) and \(\mathbf P_3\).</p>

      <p>Two properties make Bézier curves pleasant to work with:</p>
      <ul>
        <li><b>Convex hull.</b> On \([0, 1]\) the Bernstein weights are never negative and they add up to 1, so every
          point of the curve is a convex combination of the control points. The curve never leaves the convex hull of
          \(\mathbf P_0..\mathbf P_3\). A bounding box of the four control points is therefore a valid (if loose)
          bounding box of the curve, which is handy for culling and for coarse collision tests.</li>
        <li><b>End tangents.</b> Differentiating gives
          \[ \mathbf B'(t) = 3\left[(1-t)^2(\mathbf P_1 - \mathbf P_0) + 2t(1-t)(\mathbf P_2 - \mathbf P_1) + t^2(\mathbf P_3 - \mathbf P_2)\right], \]
          so \(\mathbf B'(0) = 3(\mathbf P_1 - \mathbf P_0)\) and \(\mathbf B'(1) = 3(\mathbf P_3 - \mathbf P_2)\). The curve
          leaves \(\mathbf P_0\) heading straight at \(\mathbf P_1\) and arrives at \(\mathbf P_3\) coming from the
          direction of \(\mathbf P_2\).</li>
      </ul>

      <p>The end-tangent formulas convert between Bézier and Hermite form. A Bézier curve is the Hermite curve with
      endpoints \(\mathbf P_0, \mathbf P_3\) and tangents \(3(\mathbf P_1 - \mathbf P_0)\), \(3(\mathbf P_3 - \mathbf P_2)\).
      Going the other way, a Hermite curve with endpoints \(\mathbf P_0, \mathbf P_3\) and tangents
      \(\mathbf T_1, \mathbf T_2\) has the Bézier interior points</p>
      <div class="formula">\[ \mathbf P_1 = \mathbf P_0 + \tfrac13\mathbf T_1, \qquad \mathbf P_2 = \mathbf P_3 - \tfrac13\mathbf T_2 . \]</div>
      <p>That's why curve editors draw "tangent handles": the handles <em>are</em> the interior Bézier points.</p>

      <h2 data-sub="11.3.2">Bézier Curve Truncation</h2>
      <p>Sometimes you need a new Bézier curve that exactly matches only the part of an existing curve
      \(\mathbf B_P(t)\) between \(t_0\) and \(t_1\). For example, a rope that is cut, a path that is revealed
      gradually, or a curve whose tail is trimmed against a wall. Call the new curve \(\mathbf B_Q(u)\), with
      \(u \in [0,1]\) mapped onto the old parameter by</p>
      <p>\[ t(u) = t_0 + (t_1 - t_0)\,u . \]</p>
      <p>The endpoints are just points on the old curve: \(\mathbf Q_0 = \mathbf B_P(t_0)\) and
      \(\mathbf Q_3 = \mathbf B_P(t_1)\). For the interior points we use the Hermite-to-Bézier formulas, but the
      tangents must be measured with respect to the <em>new</em> parameter. By the chain rule
      \(\frac{d}{du}\mathbf B_P(t(u)) = (t_1 - t_0)\,\mathbf B_P'(t)\), because a unit step in \(u\) covers
      \(t_1 - t_0\) units of \(t\). So</p>
      <div class="formula">
        \[ \mathbf Q_1 = \mathbf Q_0 + \frac{t_1 - t_0}{3}\,\mathbf B_P'(t_0), \qquad
           \mathbf Q_2 = \mathbf Q_3 - \frac{t_1 - t_0}{3}\,\mathbf B_P'(t_1). \]
      </div>
      <p>The new curve isn't an approximation. Both are cubics that agree in position and tangent at two points,
      and a cubic is fully determined by those four constraints, so they are the same curve.</p>

      <h2 data-sub="11.3.3">The de Casteljau Algorithm</h2>
      <p>Truncating to \([0, s]\) and \([s, 1]\) splits a curve in two. Working the truncation formulas out for
      those intervals produces a beautifully simple construction, the <strong>de Casteljau algorithm</strong>. Start
      with the control polygon and repeatedly replace each pair of neighbors by the point a fraction \(s\) of the way
      between them:</p>
      <div class="formula">
        \[ \mathbf P_i^{(k)} = (1 - s)\,\mathbf P_i^{(k-1)} + s\,\mathbf P_{i+1}^{(k-1)}, \qquad \mathbf P_i^{(0)} = \mathbf P_i . \]
      </div>
      <p>Four points become three, then two, then one. The final point \(\mathbf P_0^{(3)}\) is exactly
      \(\mathbf B(s)\), and the segment between the two points of level 2 is tangent to the curve there. Along the
      way the construction produces the control points of both halves:</p>
      <p>\[ \mathbf Q_i = \mathbf P_0^{(i)} \;\;(\text{curve on } [0,s]), \qquad
           \mathbf R_i = \mathbf P_i^{(3-i)} \;\;(\text{curve on } [s,1]). \]</p>
      <p>So \(\mathbf Q\) runs down the left edge of the triangle of points (\(\mathbf P_0\), the first point of each
      level, then \(\mathbf B(s)\)) and \(\mathbf R\) runs up the right edge.</p>

      <div class="key">de Casteljau uses only linear interpolation, so it is numerically very stable, works in any
      dimension, and works for any degree. Six lerps evaluate a cubic and split it at the same time.</div>

      <div class="game"><b>Adaptive tessellation.</b> Each half's control polygon hugs the curve more tightly than the
      original one. Split at \(s = \tfrac12\) recursively until each control polygon is nearly a straight line, then
      emit its endpoints as vertices. Flat stretches get few segments and tight bends get many. Renderers flatten
      font glyphs and vector paths this way, and the same test can drive level of detail for a road or cable mesh.</div>

      <div class="warn">The convex hull bound is guaranteed only for \(t \in [0,1]\). Evaluating at \(t \lt 0\) or
      \(t \gt 1\) extrapolates the cubic, and it shoots off quickly.</div>

      <p><a class="btn goto-sim" href="#/11.3/sim">Try it: Bernstein weights, de Casteljau and truncation →</a></p>
    `,

    keyFormulas: [
      ["Bernstein polynomials", String.raw`B_{n,k}(t) = \binom{n}{k} t^k (1-t)^{n-k} = (1-t)B_{n-1,k-1}(t) + t\,B_{n-1,k}(t)`],
      ["Cubic Bézier", String.raw`\mathbf B(t) = (1-t)^3\mathbf P_0 + 3t(1-t)^2\mathbf P_1 + 3t^2(1-t)\mathbf P_2 + t^3\mathbf P_3`],
      ["End tangents", String.raw`\mathbf B'(0) = 3(\mathbf P_1 - \mathbf P_0), \qquad \mathbf B'(1) = 3(\mathbf P_3 - \mathbf P_2)`],
      ["Truncation to [t₀, t₁]", String.raw`\mathbf Q_1 = \mathbf Q_0 + \tfrac{t_1 - t_0}{3}\mathbf B_P'(t_0), \quad \mathbf Q_2 = \mathbf Q_3 - \tfrac{t_1 - t_0}{3}\mathbf B_P'(t_1)`],
      ["de Casteljau", String.raw`\mathbf P_i^{(k)} = (1-s)\mathbf P_i^{(k-1)} + s\,\mathbf P_{i+1}^{(k-1)}, \quad \mathbf Q_i = \mathbf P_0^{(i)}, \quad \mathbf R_i = \mathbf P_i^{(3-i)}`],
    ],

    exercises: [
      { q: String.raw`Find \(\mathbf B(\tfrac12)\) for a cubic Bézier curve in terms of its control points.`,
        a: String.raw`The weights at \(t = \tfrac12\) are \(\tfrac18, \tfrac38, \tfrac38, \tfrac18\), so \(\mathbf B(\tfrac12) = \tfrac18(\mathbf P_0 + 3\mathbf P_1 + 3\mathbf P_2 + \mathbf P_3)\).` },
      { q: String.raw`A Hermite curve has \(\mathbf P_1 = (0,0)\), \(\mathbf P_2 = (4,0)\), \(\mathbf T_1 = (3,6)\), \(\mathbf T_2 = (3,-6)\). What are its Bézier control points?`,
        a: String.raw`\((0,0)\), \((0,0) + \tfrac13(3,6) = (1,2)\), \((4,0) - \tfrac13(3,-6) = (3,2)\), \((4,0)\).` },
      { q: String.raw`<b>Degree elevation.</b> Find the cubic control points that reproduce the quadratic Bézier \((1-t)^2\mathbf A + 2t(1-t)\mathbf B + t^2\mathbf C\).`,
        a: String.raw`Multiply the quadratic by \((1-t) + t = 1\) and collect terms: \((1-t)^3\mathbf A + t(1-t)^2(\mathbf A + 2\mathbf B) + t^2(1-t)(2\mathbf B + \mathbf C) + t^3\mathbf C\). Matching \(3t(1-t)^2\mathbf P_1\) and \(3t^2(1-t)\mathbf P_2\) gives \(\mathbf P_0 = \mathbf A\), \(\mathbf P_1 = \tfrac13(\mathbf A + 2\mathbf B)\), \(\mathbf P_2 = \tfrac13(2\mathbf B + \mathbf C)\), \(\mathbf P_3 = \mathbf C\).` },
      { q: String.raw`Split a cubic Bézier at \(s = \tfrac12\). Write each control point of the two halves in terms of \(\mathbf P_0..\mathbf P_3\).`,
        a: String.raw`\(\mathbf Q_0 = \mathbf P_0\), \(\mathbf Q_1 = \tfrac12(\mathbf P_0 + \mathbf P_1)\), \(\mathbf Q_2 = \tfrac14(\mathbf P_0 + 2\mathbf P_1 + \mathbf P_2)\), \(\mathbf Q_3 = \mathbf R_0 = \tfrac18(\mathbf P_0 + 3\mathbf P_1 + 3\mathbf P_2 + \mathbf P_3)\), \(\mathbf R_1 = \tfrac14(\mathbf P_1 + 2\mathbf P_2 + \mathbf P_3)\), \(\mathbf R_2 = \tfrac12(\mathbf P_2 + \mathbf P_3)\), \(\mathbf R_3 = \mathbf P_3\).` },
      { q: "Why can a game use the bounding box of the four control points to cull a Bézier road segment?",
        a: "The Bernstein weights are nonnegative and sum to 1 on [0, 1], so every point of the curve lies in the convex hull of the control points, and the hull lies inside their bounding box. If that box is outside the view frustum, the whole segment is." },
    ],

    sims: [
      {
        title: "Cubic Bézier and its Bernstein weights",
        help: String.raw`<p>Drag the control points. The shaded region is their convex hull, and the curve never leaves it.
          The lower plot shows the Bernstein polynomials \(B_{3,k}(t)\), the weights given to each point. The red arrow
          is \(\mathbf B'(t)/3\): at \(t = 0\) it lands exactly on \(\mathbf P_1\), and at \(t = 1\) it starts from
          \(\mathbf P_2\) (as \(\mathbf B'(0) = 3(\mathbf P_1 - \mathbf P_0)\) says). The readout builds the weights with the
          Pascal-like recurrence.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 4, height: 360 });
          const plot = sim.view2d(stage, { xRange: [-0.04, 1.04], yRange: [-0.08, 1.1], height: 160 });
          const out = sim.readout(readout);
          const cols = ["a", "b", "c", "d"];
          const redraw = () => { view.redraw(); plot.redraw(); };
          const P = [[-5, -2], [-3.5, 3], [3, 3.2], [5, -1.5]].map((p, i) =>
            view.handle(p, { color: cols[i], label: "P" + sub(i), onDrag: () => plot.redraw() }));
          const tS = sim.slider(controls, { label: "Parameter t", min: 0, max: 1, step: 0.01, value: 0.3, onInput: redraw });
          const anim = sim.loop((dt, time) => { tS.value = 0.5 - 0.5 * Math.cos(time); redraw(); }, { autostart: false });
          sim.checkbox(controls, { label: "Animate t", value: false, onChange: (on) => (on ? anim.start() : anim.stop()) });
          const showHull = sim.checkbox(controls, { label: "Shade the convex hull", value: true, onChange: redraw });
          const showEnds = sim.checkbox(controls, { label: "Show end tangents 3(P₁ − P₀), 3(P₃ − P₂)", value: false, onChange: redraw });

          view.onDraw((v) => {
            v.grid({ step: 1 });
            v.axes();
            const G = P.map((h) => h.pos);
            if (showHull.value) v.polygon(hull2(G), { fill: "g", fillAlpha: 0.12, color: "g", alpha: 0.5, width: 1 });
            v.polyline(G, { color: "muted", dash: [5, 5], width: 1.3 });
            v.polyline(sampleCurve((t) => cubicAt(G, BASIS.bezier, t), 100), { color: "f", width: 3.5 });
            if (showEnds.value) {
              v.arrow(G[0], V.add(G[0], V.scale(V.sub(G[1], G[0]), 3)), { color: "a", width: 1.5, alpha: 0.6, label: "B′(0)" });
              v.arrow(G[3], V.add(G[3], V.scale(V.sub(G[3], G[2]), 3)), { color: "d", width: 1.5, alpha: 0.6, label: "B′(1)" });
            }
            const t = tS.value;
            const Q = cubicAt(G, BASIS.bezier, t), D = cubicAt(G, BASIS.bezier, t, 1);
            v.arrow(Q, V.add(Q, V.scale(D, 1 / 3)), { color: "e", width: 2.5, label: "B′/3" });
            v.point(Q, { color: "e", r: 6, label: "B(t)" });

            // Bernstein triangle by recurrence
            const tri = [[1]];
            for (let n = 1; n <= 3; n++) {
              const row = [];
              for (let k = 0; k <= n; k++) row.push((1 - t) * (tri[n - 1][k - 1] || 0) + t * (tri[n - 1][k] || 0));
              tri.push(row);
            }
            const w = tri[3];
            const pad = (s, n) => " ".repeat(Math.max(0, n)) + s;
            const triText = tri.map((row, n) => pad(row.map((x) => fmt(x, 3)).join("   "), (3 - n) * 4)).join("\n");
            out.set(sim.rows([
              ["t", fmt(t, 2)],
              ...w.map((x, k) => [sim.swatch(cols[k]) + `B${sub(3)},${sub(k)}(t)`, fmt(x, 3)]),
              ["Σ weights", fmt(w.reduce((s, x) => s + x, 0), 3)],
              [sim.swatch("e") + "B(t)", fmtVec(Q)],
              ["B′(t)", fmtVec(D)],
              ["B′(0) = 3(P₁ − P₀)", fmtVec(V.scale(V.sub(G[1], G[0]), 3))],
              ["B′(1) = 3(P₃ − P₂)", fmtVec(V.scale(V.sub(G[3], G[2]), 3))],
            ]) + `<hr>Bernstein triangle (each entry = (1 − t)·upper-left + t·upper-right):<div class="eq">${triText}</div>`);
          });
          plot.onDraw((v) => drawBlends(v, BASIS.bezier, tS.value, cols, ["B₃,₀", "B₃,₁", "B₃,₂", "B₃,₃"]));
        },
      },
      {
        title: "de Casteljau construction and subdivision",
        help: String.raw`<p>Move \(s\) and watch the construction: green points interpolate the control polygon, purple
          points interpolate the green ones, and the red point is \(\mathbf B(s)\). The purple segment is tangent to the curve.
          The blue polygon \(\mathbf Q_i = \mathbf P_0^{(i)}\) and the orange polygon \(\mathbf R_i = \mathbf P_i^{(3-i)}\) control
          the two halves. Pull them apart to see that they are two separate Bézier curves. Turn on recursive flattening to
          tessellate the curve by repeated halving, and lower the tolerance to get more segments where the curve bends.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 4, height: 440 });
          const out = sim.readout(readout);
          const P = [[-5, -2.5], [-3.2, 3], [2.5, 3.4], [5.5, -2]].map((p, i) => view.handle(p, { color: "fg", label: "P" + sub(i) }));
          const sS = sim.slider(controls, { label: "Split parameter s", min: 0, max: 1, step: 0.01, value: 0.5, onInput: () => view.redraw() });
          const anim = sim.loop((dt, time) => { sS.value = 0.5 - 0.45 * Math.cos(time * 0.9); view.redraw(); }, { autostart: false });
          sim.checkbox(controls, { label: "Animate s", value: false, onChange: (on) => (on ? anim.start() : anim.stop()) });
          const halves = sim.checkbox(controls, { label: "Show the two halves Q and R", value: true, onChange: () => view.redraw() });
          const apart = sim.checkbox(controls, { label: "Pull the halves apart", value: false, onChange: () => view.redraw() });
          const gf = sim.group(controls, "Recursive flattening");
          const flat = sim.checkbox(gf, { label: "Flatten by halving at s = ½", value: false, onChange: () => view.redraw() });
          const tol = sim.slider(gf, { label: "Tolerance", min: 0.01, max: 1, step: 0.01, value: 0.15, onInput: () => view.redraw() });

          // recursive flattening: split until both interior points are within tol of the chord
          function flatten(Pp, tolerance, outPts, depth) {
            const chord = V.sub(Pp[3], Pp[0]);
            const d1 = V.len(V.reject(V.sub(Pp[1], Pp[0]), chord)), d2 = V.len(V.reject(V.sub(Pp[2], Pp[0]), chord));
            if (depth >= 10 || Math.max(d1, d2) <= tolerance) { outPts.push(Pp[3]); return; }
            const { Q, R } = splitBezier(Pp, 0.5);
            flatten(Q, tolerance, outPts, depth + 1);
            flatten(R, tolerance, outPts, depth + 1);
          }

          view.onDraw((v) => {
            v.grid({ step: 1 });
            const G = P.map((h) => h.pos);
            const s = sS.value;
            const { Q, R, levels } = splitBezier(G, s);
            v.polyline(G, { color: "muted", width: 1.5 });
            const curve = (pts, style) => v.polyline(sampleCurve((t) => cubicAt(pts, BASIS.bezier, t), 80), style);
            if (halves.value && apart.value) {
              const off = V.scale(V.perp2(V.norm(V.sub(G[3], G[0]))), 0.6);
              const Qo = Q.map((p) => V.add(p, off)), Ro = R.map((p) => V.sub(p, off));
              curve(G, { color: "muted", width: 2, dash: [3, 4] });
              curve(Qo, { color: "a", width: 3.5 });
              curve(Ro, { color: "b", width: 3.5 });
              v.polyline(Qo, { color: "a", width: 1.5, dash: [5, 4] });
              v.polyline(Ro, { color: "b", width: 1.5, dash: [5, 4] });
              Qo.forEach((p) => v.point(p, { color: "a", r: 4 }));
              Ro.forEach((p) => v.point(p, { color: "b", r: 4 }));
            } else {
              curve(G, { color: "f", width: 3.5 });
              if (halves.value) {
                v.polyline(Q, { color: "a", width: 3, alpha: 0.55 });
                v.polyline(R, { color: "b", width: 3, alpha: 0.55 });
              }
              // construction
              v.polyline(levels[1], { color: "c", width: 1.5 });
              levels[1].forEach((p, i) => v.point(p, { color: "c", r: 5, label: "P" + sub(i) + "⁽¹⁾" }));
              v.line(levels[2][0], levels[2][1], { color: "d", width: 2 });
              levels[2].forEach((p, i) => v.point(p, { color: "d", r: 5, label: "P" + sub(i) + "⁽²⁾" }));
              v.point(levels[3][0], { color: "e", r: 7, label: "B(s)" });
            }
            let nseg = 0;
            if (flat.value) {
              const pts = [G[0]];
              flatten(G, tol.value, pts, 0);
              nseg = pts.length - 1;
              v.polyline(pts, { color: "g", width: 2 });
              pts.forEach((p) => v.point(p, { color: "g", r: 3.5 }));
            }
            out.set(sim.rows([
              ["s", fmt(s, 2)],
              ["B(s) = P₀⁽³⁾", fmtVec(levels[3][0])],
              ...Q.map((p, i) => [sim.swatch("a") + `Q${sub(i)} = P₀${"⁽" + "⁰¹²³"[i] + "⁾"}`, fmtVec(p)]),
              ...R.map((p, i) => [sim.swatch("b") + `R${sub(i)} = P${sub(i)}${"⁽" + "³²¹⁰"[i] + "⁾"}`, fmtVec(p)]),
            ]) + (flat.value ? `<hr>Flattened into <b>${nseg}</b> line segments (tolerance ${fmt(tol.value, 2)}).` : ""));
          });
        },
      },
      {
        title: "Truncating a curve to [t₀, t₁]",
        help: String.raw`<p>Pick an interval \([t_0, t_1]\). The bright curve is a brand-new Bézier curve built from
          \(\mathbf Q_0 = \mathbf B_P(t_0)\), \(\mathbf Q_3 = \mathbf B_P(t_1)\) and the tangents scaled by
          \((t_1 - t_0)/3\). It lies exactly on top of the original. The readout samples both curves and reports the
          largest gap (it's at rounding level). Swap \(t_0 \gt t_1\) and the new curve simply runs backward.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 4, height: 440 });
          const out = sim.readout(readout);
          const P = [[-5.5, -2], [-2.5, 3.5], [1.5, -3.5], [5.5, 2]].map((p, i) => view.handle(p, { color: "fg", label: "P" + sub(i) }));
          const t0S = sim.slider(controls, { label: "t₀", min: 0, max: 1, step: 0.01, value: 0.2, onInput: () => view.redraw() });
          const t1S = sim.slider(controls, { label: "t₁", min: 0, max: 1, step: 0.01, value: 0.7, onInput: () => view.redraw() });
          const showTan = sim.checkbox(controls, { label: "Show the scaled tangents", value: true, onChange: () => view.redraw() });

          view.onDraw((v) => {
            v.grid({ step: 1 });
            v.axes();
            const G = P.map((h) => h.pos);
            const t0 = t0S.value, t1 = t1S.value, dt = t1 - t0;
            const Q0 = cubicAt(G, BASIS.bezier, t0), Q3 = cubicAt(G, BASIS.bezier, t1);
            const D0 = cubicAt(G, BASIS.bezier, t0, 1), D1 = cubicAt(G, BASIS.bezier, t1, 1);
            const Q1 = V.add(Q0, V.scale(D0, dt / 3)), Q2 = V.sub(Q3, V.scale(D1, dt / 3));
            const Qc = [Q0, Q1, Q2, Q3];
            v.polyline(G, { color: "muted", dash: [5, 5], width: 1.2 });
            v.polyline(sampleCurve((t) => cubicAt(G, BASIS.bezier, t), 100), { color: "muted", width: 2.5 });
            v.polyline(sampleCurve((u) => cubicAt(Qc, BASIS.bezier, u), 80), { color: "f", width: 5, alpha: 0.85 });
            v.polyline(Qc, { color: "c", width: 2 });
            if (showTan.value) {
              v.arrow(Q0, Q1, { color: "e", width: 2.5, label: "(t₁−t₀)B′(t₀)/3" });
              v.arrow(Q3, Q2, { color: "e", width: 2.5 });
            }
            Qc.forEach((p, i) => v.point(p, { color: "c", r: 5, label: "Q" + sub(i) }));
            let err = 0;
            for (let k = 0; k <= 50; k++) {
              const u = k / 50;
              err = Math.max(err, V.dist(cubicAt(Qc, BASIS.bezier, u), cubicAt(G, BASIS.bezier, t0 + dt * u)));
            }
            out.set(sim.rows([
              ["t(u) = t₀ + (t₁ − t₀)u", `${fmt(t0, 2)} + ${fmt(dt, 2)}u`],
              [sim.swatch("c") + "Q₀ = B_P(t₀)", fmtVec(Q0)],
              [sim.swatch("c") + "Q₁", fmtVec(Q1)],
              [sim.swatch("c") + "Q₂", fmtVec(Q2)],
              [sim.swatch("c") + "Q₃ = B_P(t₁)", fmtVec(Q3)],
              ["max ‖B_Q(u) − B_P(t(u))‖", `<span class="ok">${err.toExponential(1)}</span>`],
            ]) + "<hr>The two curves coincide: same cubic, different parameter.");
          });
        },
      },
    ],

    cpp: [
      {
        title: "Cubic Bézier curve",
        formula: String.raw`\mathbf B(t) = (1-t)^3\mathbf P_0 + 3t(1-t)^2\mathbf P_1 + 3t^2(1-t)\mathbf P_2 + t^3\mathbf P_3`,
        code: String.raw`
          Point3D EvaluateBezier(const Point3D p[4], float t)
          {
              float s  = 1.0f - t;
              float b0 = s * s * s;            // B_{3,0} = (1 - t)^3
              float b1 = 3.0f * t * s * s;     // B_{3,1} = 3t (1 - t)^2
              float b2 = 3.0f * t * t * s;     // B_{3,2} = 3t^2 (1 - t)
              float b3 = t * t * t;            // B_{3,3} = t^3
              return p[0] * b0 + p[1] * b1 + p[2] * b2 + p[3] * b3;
          }
        `,
      },
      {
        title: "Tangent and Hermite-to-Bézier conversion",
        formula: String.raw`\mathbf B'(t) = 3\big[(1-t)^2(\mathbf P_1-\mathbf P_0) + 2t(1-t)(\mathbf P_2-\mathbf P_1) + t^2(\mathbf P_3-\mathbf P_2)\big] \qquad \mathbf P_1 = \mathbf P_0 + \tfrac13\mathbf T_1,\; \mathbf P_2 = \mathbf P_3 - \tfrac13\mathbf T_2`,
        code: String.raw`
          Vector3D BezierTangent(const Point3D p[4], float t)
          {
              float s = 1.0f - t;
              return ((p[1] - p[0]) * (s * s)
                    + (p[2] - p[1]) * (2.0f * s * t)
                    + (p[3] - p[2]) * (t * t)) * 3.0f;
          }

          void HermiteToBezier(const Point3D& p1, const Point3D& p2,
                               const Vector3D& tan1, const Vector3D& tan2, Point3D bez[4])
          {
              bez[0] = p1;
              bez[1] = p1 + tan1 / 3.0f;       // B'(0) = 3 (P1 - P0)
              bez[2] = p2 - tan2 / 3.0f;       // B'(1) = 3 (P3 - P2)
              bez[3] = p2;
          }
        `,
      },
      {
        title: "Truncation to [t0, t1]",
        formula: String.raw`\mathbf Q_0 = \mathbf B_P(t_0),\; \mathbf Q_3 = \mathbf B_P(t_1),\; \mathbf Q_1 = \mathbf Q_0 + \tfrac{t_1-t_0}{3}\mathbf B_P'(t_0),\; \mathbf Q_2 = \mathbf Q_3 - \tfrac{t_1-t_0}{3}\mathbf B_P'(t_1)`,
        code: String.raw`
          void TruncateBezier(const Point3D p[4], float t0, float t1, Point3D q[4])
          {
              float scale = (t1 - t0) / 3.0f;      // chain rule: dB/du = (t1 - t0) dB/dt
              q[0] = EvaluateBezier(p, t0);
              q[3] = EvaluateBezier(p, t1);
              q[1] = q[0] + BezierTangent(p, t0) * scale;
              q[2] = q[3] - BezierTangent(p, t1) * scale;
          }
        `,
      },
      {
        title: "de Casteljau subdivision",
        formula: String.raw`\mathbf P_i^{(k)} = (1-s)\mathbf P_i^{(k-1)} + s\,\mathbf P_{i+1}^{(k-1)}, \qquad \mathbf Q_i = \mathbf P_0^{(i)},\; \mathbf R_i = \mathbf P_i^{(3-i)}`,
        code: String.raw`
          // Splits the curve at s: q[] covers [0, s] and r[] covers [s, 1].
          void SubdivideBezier(const Point3D p[4], float s, Point3D q[4], Point3D r[4])
          {
              Point3D p01  = p[0] + (p[1] - p[0]) * s;       // level 1
              Point3D p12  = p[1] + (p[2] - p[1]) * s;
              Point3D p23  = p[2] + (p[3] - p[2]) * s;
              Point3D p012 = p01 + (p12 - p01) * s;          // level 2 (tangent segment)
              Point3D p123 = p12 + (p23 - p12) * s;
              Point3D mid  = p012 + (p123 - p012) * s;       // level 3 = B(s)

              q[0] = p[0];  q[1] = p01;   q[2] = p012;  q[3] = mid;     // left edge of the triangle
              r[0] = mid;   r[1] = p123;  r[2] = p23;   r[3] = p[3];    // right edge
          }
        `,
      },
      {
        title: "Adaptive flattening for rendering",
        formula: String.raw`\text{flat} \iff \max_{i=1,2} \operatorname{dist}(\mathbf P_i, \overline{\mathbf P_0\mathbf P_3}) \le \varepsilon`,
        note: "<p>By the convex hull property the curve is no farther from the chord than its interior control points, so the test is safe.</p>",
        code: String.raw`
          #include <vector>

          bool IsFlatEnough(const Point3D p[4], float tolerance)
          {
              Vector3D chord = p[3] - p[0];
              float tol2 = tolerance * tolerance;
              if (SquaredMag(chord) < 1.0e-12f)
                  return SquaredMag(p[1] - p[0]) <= tol2 && SquaredMag(p[2] - p[0]) <= tol2;
              return SquaredMag(Reject(p[1] - p[0], chord)) <= tol2      // distance of P1 from the chord
                  && SquaredMag(Reject(p[2] - p[0], chord)) <= tol2;     // distance of P2 from the chord
          }

          // Appends the end point of every segment; push p[0] once before the first call.
          void FlattenBezier(const Point3D p[4], float tolerance, std::vector<Point3D>& out, int depth = 0)
          {
              if (depth >= 16 || IsFlatEnough(p, tolerance))
              {
                  out.push_back(p[3]);
                  return;
              }
              Point3D q[4], r[4];
              SubdivideBezier(p, 0.5f, q, r);
              FlattenBezier(q, tolerance, out, depth + 1);
              FlattenBezier(r, tolerance, out, depth + 1);
          }
        `,
      },
    ],
  });

  function finishCurve(id, summary, subs, formula) { L3D.topic({id,summary,lesson:`<p>${summary}</p>${subs.map(([s,n])=>`<h2 data-sub="${s}">${n}</h2><p>${n} gives artists local control while preserving a smooth path or surface.</p>`).join("")}<div class="formula">\\[${formula}\\]</div><div class="game">Curves drive cameras, animation paths, particle trails, procedural geometry, and terrain patches.</div><p><a class="btn goto-sim" href="#/${id}/sim">Shape the curve →</a></p>`,keyFormulas:[["Curve relation",formula]],exercises:[{q:"What controls smoothness at a join?",a:"<p>The continuity of position and derivatives between adjacent pieces.</p>"}],sims:[{title:"Cubic curve sampler",help:"<p>Move the control point and sweep t to see a cubic blend traced from start to end.</p>",mount(sim){const {stage,controls,readout}=sim.layout();const v=sim.view2d(stage,{range:4});const out=sim.readout(readout);const p=v.handle([0,3],{color:"a",label:"control"});const t=sim.slider(controls,{label:"Parameter t",min:0,max:1,step:.01,value:.4,onInput:()=>v.redraw()});const a=[-3,-2],b=[3,-1];const point=u=>{const s=1-u;return[s*s*s*a[0]+3*s*s*u*p.pos[0]+u*u*u*b[0],s*s*s*a[1]+3*s*s*u*p.pos[1]+u*u*u*b[1]]};v.onDraw(x=>{x.grid();x.axes();x.polyline([a,p.pos,b],{color:"muted",dash:[5,4]});const pts=Array.from({length:81},(_,i)=>point(i/80));x.polyline(pts,{color:"c",width:3});x.point(a,{color:"b",label:"P0"});x.point(b,{color:"b",label:"P3"});x.point(point(t.value),{color:"e",label:"C(t)"});out.set(sim.rows([["t",L3D.math.fmt(t.value)],["x",L3D.math.fmt(point(t.value)[0])],["y",L3D.math.fmt(point(t.value)[1])]]));});}}],cpp:[{title:"Cubic blend",formula,code:String.raw`float CubicBlend(float t) { float s = 1.0f - t; return s*s*s + 3.0f*s*s*t + t*t*t; }`}]});}
  finishCurve("11.4","Catmull-Rom splines interpolate their control points, making them convenient for editable paths.",[],String.raw`C(t)=\frac12\left(2P_1+(-P_0+P_2)t+(2P_0-5P_1+4P_2-P_3)t^2+(-P_0+3P_1-3P_2+P_3)t^3\right)`);
  finishCurve("11.5","Cubic splines join polynomial segments while enforcing chosen derivative continuity at knots.",[],String.raw`C_i(1)=C_{i+1}(0)`);
  finishCurve("11.6","B-splines combine control points with compact basis functions; NURBS add weights for exact conics.",[["11.6.1","Uniform B-Splines"],["11.6.2","B-Spline Globalization"],["11.6.3","Nonuniform B-Splines"],["11.6.4","NURBS"]],String.raw`C(u)=\frac{\sum_iN_{i,p}(u)w_iP_i}{\sum_iN_{i,p}(u)w_i}`);
  finishCurve("11.7","Bicubic surfaces apply cubic blending in two parameters across a control grid.",[],String.raw`P(u,v)=\mathbf u^T M G M^T\mathbf v`);
  finishCurve("11.8","Curvature measures turning and torsion measures twisting along a space curve.",[],String.raw`\kappa=\frac{\|\mathbf r'\times\mathbf r''\|}{\|\mathbf r'\|^3}`);

  // ---- end of chapter ----
})();
