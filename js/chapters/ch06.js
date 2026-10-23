// Chapter 6 - Ray Tracing
(function () {
  "use strict";
  const { V, fmt, fmtVec, rad, deg, clamp } = L3D.math;

  // ===========================================================================
  // Shared helpers
  // ===========================================================================
  const SUB = "₀₁₂₃₄₅₆₇₈₉";
  const sub = (n) => String(n).split("").map((d) => SUB[+d] || d).join("");
  const TWO_PI_3 = (2 * Math.PI) / 3;

  // Short number: up to d decimals with trailing zeros removed.
  function num(x, d = 2) {
    const s = fmt(x, d);
    return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
  }
  // Tiny numbers in exponent form (for residuals and errors).
  function sci(x) {
    if (x === 0) return "0";
    const a = Math.abs(x);
    return a < 1e-3 || a >= 1e5 ? x.toExponential(1) : fmt(x, 4);
  }

  // "t³ − 3t + 1" from coefficients in descending powers.
  function polyStr(coeffs, v = "t") {
    const sup = ["", "", "²", "³", "⁴"];
    const n = coeffs.length - 1;
    let s = "";
    coeffs.forEach((c, i) => {
      const p = n - i;
      if (Math.abs(c) < 1e-12) return;
      const mag = Math.abs(c);
      const coef = mag === 1 && p > 0 ? "" : num(mag, 3);
      const term = coef + (p > 0 ? v + sup[p] : "");
      s += s ? (c < 0 ? " − " : " + ") + term : (c < 0 ? "−" : "") + term;
    });
    return (s || "0") + " = 0";
  }

  // ---------------------------------------------------------------- 6.1 solvers
  // Real roots of a t^2 + b t + c = 0, ascending. Uses the cancellation-free form.
  function quadRoots(a, b, c) {
    if (Math.abs(a) < 1e-14) return Math.abs(b) < 1e-14 ? [] : [-c / b];
    const D = b * b - 4 * a * c;
    if (D < 0) return [];
    if (D === 0) return [-b / (2 * a)];
    const q = -0.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(D));
    const r1 = q / a, r2 = c / q;
    return r1 < r2 ? [r1, r2] : [r2, r1];
  }

  // t^3 + a t^2 + b t + c = 0 using the book's p' = p/3, q' = q/2, D' = -(p'^3 + q'^2).
  function cubicInfo(a, b, c) {
    const p = b / 3 - (a * a) / 9;
    const q = (a * a * a) / 27 - (a * b) / 6 + c / 2;
    const D = -(p * p * p + q * q);
    const shift = -a / 3;
    let xs, kind;
    if (Math.abs(D) < 1e-10) {
      const r = Math.cbrt(-q);
      xs = Math.abs(r) < 1e-12 ? [0] : [2 * r, -r];
      kind = "zero";
    } else if (D < 0) {
      const s = Math.sqrt(-D);
      xs = [Math.cbrt(-q + s) + Math.cbrt(-q - s)];
      kind = "neg";
    } else {
      const m = Math.sqrt(-p);
      const th = Math.acos(clamp(-q / (m * m * m), -1, 1)) / 3;
      xs = [2 * m * Math.cos(th), 2 * m * Math.cos(th + TWO_PI_3), 2 * m * Math.cos(th - TWO_PI_3)];
      kind = "pos";
    }
    return { p, q, D, kind, roots: xs.map((x) => x + shift).sort((u, v) => u - v) };
  }
  const cubicRoots = (a, b, c) => cubicInfo(a, b, c).roots;

  // t^4 + a t^3 + b t^2 + c t + d = 0 by Ferrari's method (resolvent cubic).
  function quarticInfo(a, b, c, d) {
    const a2 = a * a;
    const p = (-3 * a2) / 8 + b;
    const q = (a2 * a) / 8 - (a * b) / 2 + c;
    const r = (-3 * a2 * a2) / 256 + (a2 * b) / 16 - (a * c) / 4 + d;
    const shift = -a / 4;
    let xs = [], y = null;
    if (Math.abs(q) < 1e-12) {
      // biquadratic: z^2 + p z + r = 0 with z = x^2
      for (const z of quadRoots(1, p, r)) {
        if (z > 1e-14) { const s = Math.sqrt(z); xs.push(-s, s); }
        else if (z > -1e-12) xs.push(0);
      }
    } else {
      const ys = cubicRoots(-p / 2, -r, (4 * r * p - q * q) / 8);
      y = ys[ys.length - 1]; // the largest real root makes 2y - p >= 0
      const A = Math.sqrt(Math.max(0, 2 * y - p));
      let B = Math.sqrt(Math.max(0, y * y - r));
      if (q < 0) B = -B;
      xs = [...quadRoots(1, A, y - B), ...quadRoots(1, -A, y + B)];
    }
    return { p, q, r, y, roots: xs.map((x) => x + shift).sort((u, v) => u - v) };
  }
  const quarticRoots = (a, b, c, d) => quarticInfo(a, b, c, d).roots;

  // ---------------------------------------------------------------- ray tracing
  const EPS_T = 1e-6;
  // Object space of the cylinder and torus has its axis along z; the world is y-up.
  // toObj maps world -> object (world y becomes object z), fromObj maps back.
  const toObj = (p) => [p[0], -p[2], p[1]];
  const fromObj = (p) => [p[0], p[2], -p[1]];

  // Sphere of radius r at the origin.  a = V^2, b = 2 S.V, c = S^2 - r^2
  function hitSphereObj(S, Vd, r) {
    const a = V.dot(Vd, Vd), b = 2 * V.dot(S, Vd), c = V.dot(S, S) - r * r;
    const D = b * b - 4 * a * c;
    const info = { a, b, c, D };
    if (D < 0) return { info };
    const sq = Math.sqrt(D);
    let t = (-b - sq) / (2 * a);
    if (t < EPS_T) t = (-b + sq) / (2 * a);
    if (t < EPS_T) return { info };
    const P = V.add(S, V.scale(Vd, t));
    return { t, n: V.scale(P, 1 / r), info };
  }

  // Box [0, size] in object space, the book's method: only front-facing planes are tested.
  function hitBoxObj(S, Vd, size) {
    const tried = [];
    for (let i = 0; i < 3; i++) {
      if (Vd[i] === 0) continue;
      const plane = Vd[i] > 0 ? 0 : size[i];
      const t = (plane - S[i]) / Vd[i];
      const j = (i + 1) % 3, k = (i + 2) % 3;
      const pj = S[j] + t * Vd[j], pk = S[k] + t * Vd[k];
      const inside = t >= 0 && pj >= 0 && pj <= size[j] && pk >= 0 && pk <= size[k];
      tried.push({ axis: i, plane, t, inside });
      if (inside) {
        const n = [0, 0, 0];
        n[i] = Vd[i] > 0 ? -1 : 1;
        return { t, n, info: { tried } };
      }
    }
    return { info: { tried } };
  }

  // Circular cylinder x^2 + y^2 = r^2, 0 <= z <= h (object space), optional end caps.
  function hitCylObj(S, Vd, r, h, caps) {
    const a = Vd[0] * Vd[0] + Vd[1] * Vd[1];
    const b = 2 * (S[0] * Vd[0] + S[1] * Vd[1]);
    const c = S[0] * S[0] + S[1] * S[1] - r * r;
    const D = b * b - 4 * a * c;
    const info = { a, b, c, D, zs: [], cap: null };
    let best = null;
    if (a > 1e-12 && D >= 0) {
      const sq = Math.sqrt(D);
      for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
        const z = S[2] + t * Vd[2];
        info.zs.push([t, z]);
        if (!best && t > EPS_T && z >= 0 && z <= h) {
          best = { t, n: [(S[0] + t * Vd[0]) / r, (S[1] + t * Vd[1]) / r, 0], part: "side" };
        }
      }
    }
    if (caps && Vd[2] !== 0) {
      for (const [zc, nz] of [[0, -1], [h, 1]]) {
        const t = (zc - S[2]) / Vd[2];
        if (t > EPS_T && (!best || t < best.t)) {
          const x = S[0] + t * Vd[0], y = S[1] + t * Vd[1];
          if (x * x + y * y <= r * r) { best = { t, n: [0, 0, nz], part: nz < 0 ? "bottom cap" : "top cap" }; info.cap = best.part; }
        }
      }
    }
    return best ? { ...best, info } : { info };
  }

  // Quartic coefficients [a, b, c, d, e] of a ray against the torus around the z axis.
  function torusCoeffs(S, Vd, r1, r2) {
    const V2 = V.dot(Vd, Vd), SV = V.dot(S, Vd), S2 = V.dot(S, S);
    const k = S2 + r1 * r1 - r2 * r2, f = 4 * r1 * r1;
    return [
      V2 * V2,
      4 * V2 * SV,
      2 * V2 * k + 4 * SV * SV - f * (Vd[0] * Vd[0] + Vd[1] * Vd[1]),
      4 * SV * k - 2 * f * (S[0] * Vd[0] + S[1] * Vd[1]),
      k * k - f * (S[0] * S[0] + S[1] * S[1]),
    ];
  }

  // Normal of the torus = gradient of (x^2+y^2+z^2+r1^2-r2^2)^2 - 4 r1^2 (x^2+y^2), divided by 4.
  function torusNormal(P, r1, r2) {
    const s = V.dot(P, P) + r1 * r1 - r2 * r2;
    const k = s - 2 * r1 * r1;
    return V.norm([P[0] * k, P[1] * k, P[2] * s]);
  }

  // Two Newton steps on a quartic, discarded if they move the root a lot (near a double root).
  function polishQuartic(co, x) {
    let y = x;
    for (let i = 0; i < 2; i++) {
      const f = (((co[0] * y + co[1]) * y + co[2]) * y + co[3]) * y + co[4];
      const df = ((4 * co[0] * y + 3 * co[1]) * y + 2 * co[2]) * y + co[3];
      if (Math.abs(df) < 1e-14) break;
      y -= f / df;
    }
    return Math.abs(y - x) < 0.05 ? y : x;
  }

  // Torus (object space, unit Vd). The ray origin is first moved to the bounding sphere.
  function hitTorusObj(S, Vd, r1, r2) {
    const R = r1 + r2;
    const bs = quadRoots(1, 2 * V.dot(S, Vd), V.dot(S, S) - R * R);
    if (bs.length < 2 || bs[1] < EPS_T) return { info: { bounding: false } };
    const t0 = Math.max(0, bs[0]);
    const S0 = V.add(S, V.scale(Vd, t0));
    const co = torusCoeffs(S0, Vd, r1, r2);
    const raw = quarticRoots(co[1] / co[0], co[2] / co[0], co[3] / co[0], co[4] / co[0]);
    const roots = raw.map((x) => polishQuartic(co, x));
    let best = Infinity;
    for (const x of roots) if (x > -1e-6 && x + t0 > EPS_T && x < best) best = x;
    const info = { bounding: true, t0, co, roots };
    if (!Number.isFinite(best)) return { info };
    const t = t0 + best;
    return { t, n: torusNormal(V.add(S, V.scale(Vd, t)), r1, r2), info };
  }

  // Perspective camera orbiting a target (yaw/pitch in degrees). ray(i, j) gives a unit direction.
  function makeCamera(target, dist, yawDeg, pitchDeg, fovDeg, W, H) {
    const yw = rad(yawDeg), pt = rad(pitchDeg);
    const eye = V.add(target, V.scale([Math.cos(pt) * Math.sin(yw), Math.sin(pt), Math.cos(pt) * Math.cos(yw)], dist));
    const f = V.norm(V.sub(target, eye));
    const r = V.norm(V.cross(f, [0, 1, 0]));
    const u = V.cross(r, f);
    const th = Math.tan(rad(fovDeg) / 2), asp = W / H;
    return {
      eye,
      ray(i, j) {
        const px = ((2 * (i + 0.5)) / W - 1) * th * asp, py = (1 - (2 * (j + 0.5)) / H) * th;
        return V.norm([f[0] + r[0] * px + u[0] * py, f[1] + r[1] * px + u[1] * py, f[2] + r[2] * px + u[2] * py]);
      },
    };
  }

  // Pixel under a pointer event on a raster.
  function pixelAt(ras, e) {
    const b = ras.el.getBoundingClientRect();
    return [
      clamp(Math.floor(((e.clientX - b.left) / b.width) * ras.width), 0, ras.width - 1),
      clamp(Math.floor(((e.clientY - b.top) / b.height) * ras.height), 0, ras.height - 1),
    ];
  }

  // Hollow crosshair around a pixel (so the pixel itself stays visible).
  function markPixel(ras, [x, y], rgb) {
    for (const [dx, dy] of [[2, 0], [3, 0], [4, 0], [-2, 0], [-3, 0], [-4, 0], [0, 2], [0, 3], [0, 4], [0, -2], [0, -3], [0, -4]]) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && X < ras.width && Y >= 0 && Y < ras.height) ras.set(X, Y, rgb[0], rgb[1], rgb[2]);
    }
  }

  const rgbOf = (sim, key) => L3D.color.parse(sim.color(key));
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // ===========================================================================
  // 6.1 Root Finding
  // ===========================================================================
  L3D.topic({
    id: "6.1",
    summary: "Ray intersections turn into polynomial equations in t. Closed-form solutions for degrees 2 to 4, and Newton's method for everything else.",

    lesson: String.raw`
      <p>Every ray-tracing question has the same shape. Write the ray as
      \[ \mathbf P(t) = \mathbf S + t\mathbf V, \]
      where \(\mathbf S\) is where the ray starts and \(\mathbf V\) is the direction it travels. Plug \(\mathbf P(t)\)
      into the equation of a surface and you get an equation in the single unknown \(t\). Its smallest positive
      solution is the first thing the ray hits. The kind of surface decides the degree of that equation:</p>
      <table>
        <tr><th>Surface</th><th>Equation in \(t\)</th><th>Solved with</th></tr>
        <tr><td>plane, triangle, box face</td><td>linear</td><td>one division</td></tr>
        <tr><td>sphere, ellipsoid, cylinder, cone</td><td>quadratic</td><td>the quadratic formula</td></tr>
        <tr><td>cubic spline curves and patches</td><td>cubic</td><td>Cardano or the trigonometric method</td></tr>
        <tr><td>torus</td><td>quartic</td><td>a resolvent cubic, or Newton's method</td></tr>
      </table>
      <p>So root finding is the engine underneath ray casting, line-of-sight checks, mouse picking, light-map
      baking and the swept-sphere collision tests in Chapter 12.</p>

      <h2 data-sub="6.1.1">Quadratic Polynomials</h2>
      <p>To solve \(at^2 + bt + c = 0\), divide by \(a\), move \(c/a\) to the right side and complete the square by
      adding \(b^2/4a^2\) to both sides:
      \[ \left(t + \frac{b}{2a}\right)^2 = \frac{b^2 - 4ac}{4a^2}. \]
      Take the square root of both sides and you have the quadratic formula:</p>
      <div class="formula">\[ t = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}, \qquad D = b^2 - 4ac. \]</div>
      <p>The <strong>discriminant</strong> \(D\) counts the real roots before you take any square root: \(D \gt 0\)
      gives two, \(D = 0\) gives one double root at \(t = -b/2a\), and \(D \lt 0\) gives none. For a ray this is the
      difference between passing through an object, grazing it, and missing it, so a "does the ray hit at all?"
      test only needs the sign of \(D\).</p>
      <div class="warn"><b>Cancellation.</b> When \(b^2\) is much larger than \(4ac\), \(\sqrt D\) is almost
      \(|b|\), and one of the two roots subtracts two nearly equal numbers. In <code>float</code> most of its digits
      vanish. The fix is to compute the safe root first and get the other one from the product of the roots,
      \(t_1t_2 = c/a\):
      \[ q = -\tfrac12\left(b + \operatorname{sgn}(b)\sqrt D\right), \qquad t_1 = \frac{q}{a}, \quad t_2 = \frac{c}{q}. \]</div>

      <h2 data-sub="6.1.2">Cubic Polynomials</h2>
      <p>Divide by the leading coefficient to get \(t^3 + at^2 + bt + c = 0\). Shifting the variable by
      \(t = x - a/3\) removes the \(t^2\) term and leaves a <em>depressed cubic</em>
      \[ x^3 + px + q = 0, \qquad p = -\tfrac13a^2 + b, \qquad q = \tfrac{2}{27}a^3 - \tfrac13ab + c. \]
      The arithmetic is tidier with \(p' = p/3\) and \(q' = q/2\). The sign of
      \[ D' = -\left(p'^3 + q'^2\right), \]
      which is the cubic's discriminant divided by 108, decides how to continue:</p>
      <ul>
        <li>\(D' \lt 0\): one real root. Cardano's formula gives it as \(x = r + s\), with
          \(r = \sqrt[3]{-q' + \sqrt{-D'}}\) and \(s = \sqrt[3]{-q' - \sqrt{-D'}}\).</li>
        <li>\(D' = 0\): now \(r = s\), and the roots are \(x_1 = 2r\) and the double root \(x_{2,3} = -r\).</li>
        <li>\(D' \gt 0\): three different real roots. Cardano's formula still works, but only by going through
          complex cube roots. Instead substitute \(x = 2m\cos\theta\) with \(m = \sqrt{-p'}\). The identity
          \(4\cos^3\theta - 3\cos\theta = \cos3\theta\) turns the cubic into \(\cos3\theta = -q'/\sqrt{-p'^3}\), and
          \(D' \gt 0\) guarantees that this ratio lies in \([-1, 1]\). So
          \[ x_k = 2\sqrt{-p'}\,\cos\!\left(\theta - \tfrac{2\pi k}{3}\right), \qquad
             \theta = \tfrac13\cos^{-1}\frac{-q'}{\sqrt{-p'^3}}, \qquad k = 0, \pm1. \]</li>
      </ul>
      <p>Finally undo the shift: \(t = x - a/3\).</p>

      <h2 data-sub="6.1.3">Quartic Polynomials</h2>
      <p>The quartic \(t^4 + at^3 + bt^2 + ct + d = 0\) starts the same way. The shift \(t = x - a/4\) removes the
      cubic term:
      \[ x^4 + px^2 + qx + r = 0, \]
      \[ p = -\tfrac38a^2 + b, \qquad q = \tfrac18a^3 - \tfrac12ab + c, \qquad r = -\tfrac{3}{256}a^4 + \tfrac1{16}a^2b - \tfrac14ac + d. \]
      The idea behind the solution (Ferrari's method) is this. For <em>any</em> number \(y\),
      \[ x^4 + px^2 + qx + r = (x^2 + y)^2 - \left[(2y - p)x^2 - qx + (y^2 - r)\right]. \]
      If \(y\) makes the bracket a perfect square, the right side is a difference of two squares, and that factors
      into two quadratics. A quadratic in \(x\) is a perfect square when its discriminant is zero,
      \(q^2 = 4(2y - p)(y^2 - r)\). Rearranged, that is the <strong>resolvent cubic</strong>:</p>
      <div class="formula">\[ y^3 - \frac p2y^2 - ry + \frac{4rp - q^2}{8} = 0 \]</div>
      <p>Solve it with 6.1.2 and take a real root \(y\) (the largest one always has \(2y - p \ge 0\)). If \(q \ge 0\),
      the four roots of the quartic are the roots of the two quadratics
      \[ x^2 + x\sqrt{2y - p} + y - \sqrt{y^2 - r} = 0, \qquad x^2 - x\sqrt{2y - p} + y + \sqrt{y^2 - r} = 0. \]
      If \(q \lt 0\), the sign in front of \(\sqrt{y^2 - r}\) flips in both. Then shift back with \(t = x - a/4\).</p>
      <div class="note">If \(q = 0\) the equation is <em>biquadratic</em>: it is the quadratic \(z^2 + pz + r = 0\) in
      \(z = x^2\), so you can skip the resolvent cubic and take \(x = \pm\sqrt z\) for each \(z \ge 0\).</div>

      <h2 data-sub="6.1.4">Newton's Method</h2>
      <p>The closed-form formulas stop at degree four, and they become expensive and touchy before that.
      <strong>Newton's method</strong> (Newton–Raphson) works for any differentiable function. Start from a guess
      \(x_0\), follow the tangent line at \((x_i, f(x_i))\) to the point where it crosses the x axis, and use that
      crossing as the next guess. The tangent is \(y - f(x_i) = f'(x_i)(x - x_i)\), and setting \(y = 0\) gives</p>
      <div class="formula">\[ x_{i+1} = x_i - \frac{f(x_i)}{f'(x_i)} \]</div>
      <p>Near a simple root \(r\), the error \(\epsilon_i = x_i - r\) behaves like
      \[ \epsilon_{i+1} \approx \frac{f''(r)}{2f'(r)}\,\epsilon_i^2. \]
      (The book derives this from a Taylor expansion of \(g(x) = f(x)/f'(x)\) around \(r\), using \(g(r) = 0\),
      \(g'(r) = 1\) and \(g''(r) = -f''(r)/f'(r)\).) The error gets <em>squared</em> every step, so the number of
      correct digits roughly <strong>doubles</strong> with each iteration. This is called quadratic convergence.</p>
      <div class="warn">Newton's method comes with no guarantee. If \(f'(x_i) = 0\) the tangent is flat and never
      reaches the axis. A bad start can jump to a different root, run off to infinity, or cycle forever (try
      \(x^3 - 2x + 2\) starting at \(x_0 = 0\) in the simulation). It needs a starting guess near the root.</div>
      <div class="game">When a ray hits a complicated surface, a cheap bounding volume usually provides that starting
      guess. Intersect the ray with a box or sphere around the torus first, then start Newton from that \(t\). One or
      two Newton steps are also a cheap way to <em>polish</em> the roots of the closed-form quartic solver, which can
      lose precision in <code>float</code>.</div>

      <h2 data-sub="6.1.5">Refinement of Reciprocals and Square Roots</h2>
      <p>CPUs and GPUs have fast instructions that estimate \(1/r\) and \(1/\sqrt r\) to about 12 bits (for example
      SSE's <code>rcpss</code> and <code>rsqrtss</code>). Newton's method sharpens such estimates, and every step
      roughly doubles the number of correct bits. The reciprocal \(1/r\) is the root of \(f(x) = x^{-1} - r\), and
      Newton's formula for it contains no division at all:</p>
      <div class="formula">\[ x_{n+1} = x_n(2 - rx_n), \qquad 0 \lt x_0 \lt \frac2r \]</div>
      <p>The interval comes from requiring \(x_1 \gt 0\). The function has a singularity at \(x = 0\), and an iterate
      that lands on the wrong side of it runs away. So the first estimate may be too large by anything up to a factor
      of 2. For the reciprocal square root, use \(f(x) = x^{-2} - r\):</p>
      <div class="formula">\[ x_{n+1} = \tfrac12x_n\left(3 - rx_n^2\right), \qquad 0 \lt x_0 \lt \sqrt{3/r} \]</div>
      <p>Once \(1/\sqrt r\) is accurate, \(\sqrt r = r\cdot(1/\sqrt r)\) costs one multiply. Normalizing a vector needs
      exactly \(1/\lVert\mathbf v\rVert\), which is why engines care so much about the reciprocal square root.</p>
      <div class="note">The famous <em>fast inverse square root</em> from Quake III makes its first guess by treating the
      float's bits as an integer, \(i \leftarrow \texttt{0x5f3759df} - (i \gg 1)\). That roughly halves and negates
      the exponent. One step of the update above then brings the result to within about 0.2%.</div>

      <p><a class="btn goto-sim" href="#/6.1/sim">Try it: roots, Newton's method and reciprocal refinement →</a></p>
    `,

    keyFormulas: [
      ["Quadratic formula", String.raw`t = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`],
      ["Cubic discriminant (shifted, reduced form)", String.raw`D' = -\left(p'^3 + q'^2\right),\quad p' = \tfrac{b}{3} - \tfrac{a^2}{9},\quad q' = \tfrac{a^3}{27} - \tfrac{ab}{6} + \tfrac c2`],
      ["Resolvent cubic of the quartic", String.raw`y^3 - \tfrac p2 y^2 - ry + \tfrac{4rp - q^2}{8} = 0`],
      ["Newton's method", String.raw`x_{i+1} = x_i - \frac{f(x_i)}{f'(x_i)}`],
      ["Reciprocal refinement", String.raw`x_{n+1} = x_n(2 - rx_n)`],
      ["Reciprocal square root refinement", String.raw`x_{n+1} = \tfrac12x_n\left(3 - rx_n^2\right)`],
    ],

    exercises: [
      { q: String.raw`Find the discriminant and the roots of \(2t^2 + 3t - 2 = 0\).`,
        a: String.raw`\(D = 9 + 16 = 25\), so \(t = (-3 \pm 5)/4\), which gives \(t = 0.5\) and \(t = -2\).` },
      { q: String.raw`Solve \(t^3 - 3t^2 + 3t - 1 = 0\) with the method of 6.1.2.`,
        a: String.raw`With \(a = -3\), \(b = 3\), \(c = -1\): \(p' = 1 - 1 = 0\) and \(q' = -1 + 1.5 - 0.5 = 0\), so \(D' = 0\) and \(r = 0\). Every root is \(x = 0\), and \(t = x - a/3 = 1\). It is a triple root, as expected from \((t - 1)^3\).` },
      { q: String.raw`Run Newton's method on \(f(x) = x^2 - 2\) from \(x_0 = 1\). How many correct digits do you have after three steps?`,
        a: String.raw`The update is \(x_{i+1} = x_i - (x_i^2 - 2)/(2x_i)\). It gives \(x_1 = 1.5\), \(x_2 = 1.41667\), and \(x_3 = 1.4142157\). Since \(\sqrt2 = 1.4142136\), that is about 6 correct digits, after 1 and then 3. The digits roughly double each step.` },
      { q: String.raw`Refine the reciprocal of \(r = 3\) from \(x_0 = 0.3\). For which starting values does the iteration work?`,
        a: String.raw`\(x_1 = 0.3(2 - 0.9) = 0.33\) and \(x_2 = 0.33(2 - 0.99) = 0.3333\). It converges for \(0 \lt x_0 \lt 2/3\).` },
      { q: String.raw`(Book Exercise 3) Find a Newton refinement formula for the \(p\)-th root of \(r\).`,
        a: String.raw`Use \(f(x) = x^p - r\), so \(f'(x) = px^{p-1}\) and \(x_{n+1} = x_n - \frac{x_n^p - r}{px_n^{p-1}} = \frac1p\left[(p - 1)x_n + \frac{r}{x_n^{p-1}}\right]\). For \(p = 2\) this is the classic "average \(x\) and \(r/x\)" rule.` },
    ],

    sims: [
      {
        title: "Roots of quadratic, cubic and quartic polynomials",
        help: String.raw`<p>Pick a degree and drag the coefficient sliders. The red dots are the real roots computed with
          the closed-form methods of 6.1.1 to 6.1.3, with no iteration. Watch the discriminant change sign at the moment two
          roots merge and disappear. The dashed line marks the shift \(t = -a/3\) (cubic) or \(t = -a/4\) (quartic) that
          removes the second-highest power, or the vertex \(t = -b/2a\) of the parabola.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { xRange: [-4.5, 4.5], yRange: [-10, 10], height: 420 });
          const out = sim.readout(readout);
          const presets = { 2: [1, -1, -2, 0], 3: [0, -3, 1, 0], 4: [-0.5, -4.5, 2, 2] };
          const names = {
            2: ["a (coefficient of t²)", "b (coefficient of t)", "c (constant)"],
            3: ["a (coefficient of t²)", "b (coefficient of t)", "c (constant)"],
            4: ["a (coefficient of t³)", "b (coefficient of t²)", "c (coefficient of t)", "d (constant)"],
          };
          const deg_ = sim.segmented(controls, {
            label: "Degree",
            options: [["2", "Quadratic"], ["3", "Cubic"], ["4", "Quartic"]],
            value: "3",
            onChange: () => load(),
          });
          const mk = (label) => sim.slider(controls, { label, min: -6, max: 6, step: 0.1, value: 0, onInput: () => view.redraw() });
          const S = [mk("a"), mk("b"), mk("c"), mk("d")];

          function load() {
            const n = +deg_.value;
            presets[n].forEach((x, i) => (S[i].value = x));
            S.forEach((s, i) => {
              s.el.style.display = i < names[n].length ? "" : "none";
              s.el.querySelector(".ctl-label").textContent = names[n][i] || "";
            });
            view.redraw();
          }

          view.onDraw((v) => {
            const n = +deg_.value;
            const k = S.map((s) => s.value);
            const coeffs = n === 2 ? [k[0], k[1], k[2]] : n === 3 ? [1, k[0], k[1], k[2]] : [1, k[0], k[1], k[2], k[3]];
            const f = (t) => coeffs.reduce((acc, c) => acc * t + c, 0);
            v.grid({ stepX: 1, stepY: 2 });
            v.axes({ ticks: true, labels: ["t", "f(t)"] });

            let roots, rows = [], note = "", mark = null;
            if (n === 2) {
              const [a, b, c] = coeffs;
              const D = b * b - 4 * a * c;
              roots = quadRoots(a, b, c);
              if (Math.abs(a) > 1e-9) mark = [-b / (2 * a), "−b/2a"];
              rows.push(["D = b² − 4ac", fmt(D, 3), D > 1e-12 ? "ok" : D < -1e-12 ? "bad" : ""]);
              note = Math.abs(a) < 1e-9 ? "a = 0, so the equation is only linear: t = −c/b."
                : D > 1e-12 ? "D &gt; 0: two real roots. A ray would pass through the object."
                : D < -1e-12 ? "D &lt; 0: no real roots. A ray would miss."
                : "D = 0: one double root. A ray would just graze the object.";
            } else if (n === 3) {
              const info = cubicInfo(k[0], k[1], k[2]);
              roots = info.roots;
              mark = [-k[0] / 3, "−a/3"];
              rows.push(["p′ = b/3 − a²/9", fmt(info.p, 3)], ["q′ = a³/27 − ab/6 + c/2", fmt(info.q, 3)],
                ["D′ = −(p′³ + q′²)", fmt(info.D, 3), info.kind === "pos" ? "ok" : info.kind === "neg" ? "bad" : ""]);
              note = info.kind === "neg" ? "D′ &lt; 0: one real root, from Cardano's formula x = r + s."
                : info.kind === "pos" ? "D′ &gt; 0: three real roots, from the trigonometric method x = 2√(−p′) cos(θ − 2πk/3)."
                : "D′ = 0: a double root (x₁ = 2r, x₂ = x₃ = −r).";
            } else {
              const info = quarticInfo(k[0], k[1], k[2], k[3]);
              roots = info.roots;
              mark = [-k[0] / 4, "−a/4"];
              rows.push(["p", fmt(info.p, 3)], ["q", fmt(info.q, 3)], ["r", fmt(info.r, 3)],
                ["resolvent root y", info.y === null ? "(q = 0: biquadratic)" : fmt(info.y, 4)]);
              note = `${roots.length} real root${roots.length === 1 ? "" : "s"}. Ferrari's method factors the shifted quartic into two quadratics using y.`;
            }
            if (mark) {
              v.infiniteLine([mark[0], 0], [0, 1], { color: "muted", dash: [4, 5], width: 1 });
              v.text([mark[0], 9.2], mark[1], { color: "muted", size: 12, offset: [4, 0] });
            }
            v.plot(f, { color: "a", width: 2.5 });
            roots.forEach((r, i) => {
              v.point([r, 0], { color: "e", r: 5.5 });
              v.text([r, 0], "t" + sub(i + 1), { color: "e", size: 12, offset: [-6, i % 2 ? 22 : -10] });
            });
            const rootRows = roots.map((r, i) => ["t" + sub(i + 1), `${fmt(r, 4)} <span class="muted">(f = ${sci(f(r))})</span>`]);
            out.set(`<div class="eq">${polyStr(coeffs)}</div>` + sim.rows(rows) + "<hr>" +
              (rootRows.length ? sim.rows(rootRows) : "<b class='bad'>No real roots.</b>") + `<hr>${note}`);
          });
          load();
        },
      },
      {
        title: "Newton's method, one tangent at a time",
        help: String.raw`<p>Drag the starting guess \(x_0\) along the axis and press <b>Step</b>. Each step follows the tangent
          line at \((x_i, f(x_i))\) down to the axis: \(x_{i+1} = x_i - f(x_i)/f'(x_i)\). Watch the error column: once
          you are close, the number of correct digits roughly doubles per step. The last two functions show how Newton's
          method can fail.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const FUNCS = {
            cubic: { label: "x³ − 2x − 5", f: (x) => x * x * x - 2 * x - 5, df: (x) => 3 * x * x - 2, x0: 3.4, xr: [-3, 4], yr: [-14, 26], start: 2 },
            log: { label: "ln x + x − 7 (book Exercise 2)", f: (x) => Math.log(x) + x - 7, df: (x) => 1 / x + 1, x0: 0.6, xr: [-0.5, 8.5], yr: [-8, 5], start: 5, domain: (x) => x > 0 },
            cos: { label: "cos x − x", f: (x) => Math.cos(x) - x, df: (x) => -Math.sin(x) - 1, x0: 2.2, xr: [-3, 3.5], yr: [-4, 3], start: 0.7 },
            cycle: { label: "x³ − 2x + 2 (from 0 it cycles)", f: (x) => x * x * x - 2 * x + 2, df: (x) => 3 * x * x - 2, x0: 0, xr: [-3, 3], yr: [-6, 8], start: -1.8 },
            atan: { label: "arctan x (diverges if |x₀| > 1.39)", f: Math.atan, df: (x) => 1 / (1 + x * x), x0: 1.5, xr: [-7, 7], yr: [-2, 2], start: 0.1 },
          };
          // the true root of each function, found once by iterating from a safe start
          for (const F of Object.values(FUNCS)) {
            let x = F.start;
            for (let i = 0; i < 80; i++) x -= F.f(x) / F.df(x);
            F.root = x;
          }
          let F = FUNCS.cubic;
          let shown = 3;
          const view = sim.view2d(stage, { xRange: [...F.xr], yRange: [...F.yr], height: 420 });
          const out = sim.readout(readout);
          const h = view.handle([F.x0, 0], {
            color: "b", label: "x₀",
            constrain: (p) => [clamp(p[0], F.domain ? 0.05 : F.xr[0] + 0.05, F.xr[1] - 0.05), 0],
          });
          sim.select(controls, {
            label: "Function f(x)",
            options: Object.entries(FUNCS).map(([k, G]) => [k, G.label]),
            value: "cubic",
            onChange: (key) => {
              F = FUNCS[key];
              view.opts.xRange = [...F.xr];
              view.opts.yRange = [...F.yr];
              h.set([F.x0, 0]);
              shown = 3;
              view.redraw();
            },
          });
          sim.buttons(controls, [
            { label: "Step ▶", primary: true, onClick: () => { shown = Math.min(shown + 1, 8); view.redraw(); } },
            { label: "Reset", onClick: () => { shown = 0; view.redraw(); } },
            { label: "Show 8 steps", onClick: () => { shown = 8; view.redraw(); } },
          ]);

          function iterate(x0) {
            const xs = [x0];
            let x = x0, status = "";
            for (let i = 0; i < 8; i++) {
              if (F.domain && !F.domain(x)) { status = "domain"; break; }
              const d = F.df(x);
              if (Math.abs(d) < 1e-12) { status = "flat"; break; }
              x = x - F.f(x) / d;
              xs.push(x);
              if (!Number.isFinite(x) || Math.abs(x) > 1e6) { status = "diverge"; break; }
            }
            if (!status && F.domain && !F.domain(x)) status = "domain";
            return { xs, status };
          }

          view.onDraw((v) => {
            v.grid();
            v.axes({ ticks: true });
            v.plot((x) => (F.domain && !F.domain(x) ? NaN : F.f(x)), { color: "a", width: 2.5 });
            v.point([F.root, 0], { color: "c", r: 4 });
            const { xs, status } = iterate(h.pos[0]);
            const n = Math.min(shown, xs.length - 1);
            for (let i = 0; i < n; i++) {
              const xi = xs[i], fi = F.f(xi), xn = xs[i + 1];
              v.line([xi, 0], [xi, fi], { color: "muted", dash: [4, 4], width: 1.2 });
              v.line([xi, fi], [xn, 0], { color: "b", width: 1.8, alpha: 0.9 });
              v.point([xi, fi], { color: "b", r: 3 });
              v.point([xn, 0], { color: "b", r: 4 });
              v.text([xn, 0], "x" + sub(i + 1), { color: "b", size: 12, offset: [-4, i % 2 ? 18 : -9] });
            }
            const rows = [];
            for (let i = 0; i <= n; i++) {
              const x = xs[i], err = Math.abs(x - F.root);
              const digits = err === 0 ? "all" : Math.max(0, Math.floor(-Math.log10(err / Math.max(1, Math.abs(F.root)))));
              rows.push(["x" + sub(i), `${Number.isFinite(x) ? x.toFixed(9) : "∞"} <span class="muted">err ${sci(err)}, ${digits} digits</span>`]);
            }
            let msg = `Root r = ${F.root.toFixed(9)}. `;
            if (n < shown && status === "flat") msg += "<b class='bad'>f′(x) = 0: the tangent is horizontal and never meets the axis.</b>";
            else if (n < shown && status === "domain") msg += "<b class='bad'>The iterate left the domain (ln x needs x &gt; 0).</b>";
            else if (status === "diverge" && n === xs.length - 1) msg += "<b class='bad'>The iterates are running away: diverging.</b>";
            else if (n === 0) msg += "Press Step to draw the first tangent.";
            else msg += "Each tangent meets the axis closer to the root.";
            out.set(`<div class="eq">f(x) = ${F.label.replace(/ \(.*\)$/, "")}</div>` + sim.rows(rows) + `<hr>${msg}`);
          });
        },
      },
      {
        title: "Refining 1/r and 1/√r",
        help: String.raw`<p>The curve is \(f(x) = 1/x - r\) (or \(1/x^2 - r\)), whose root is the answer. Choose \(r\) and how far
          off the starting guess is. Each Newton step uses only multiplies. The readout counts correct <b>bits</b>, which
          roughly double per step until 32-bit float precision (24 bits) is reached. Push the guess past the green zone
          (\(x_0 \ge 2/r\), or \(x_0 \ge \sqrt{3/r}\)) and the iteration breaks down.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { xRange: [0, 1], yRange: [-1, 1], height: 400 });
          const out = sim.readout(readout);
          const mode = sim.segmented(controls, { label: "Refine", options: [["recip", "1 / r"], ["rsqrt", "1 / √r"]], value: "rsqrt", onChange: () => view.redraw() });
          const rS = sim.slider(controls, { label: "r", min: 0.2, max: 10, step: 0.1, value: 3, onInput: () => view.redraw() });
          const kS = sim.slider(controls, { label: "Starting guess x₀ (× exact answer)", min: 0.05, max: 2.5, step: 0.01, value: 0.55, format: (x) => x.toFixed(2) + "×", onInput: () => view.redraw() });
          const trick = sim.checkbox(controls, { label: "Use the bit-trick starting guess instead", value: false, onChange: () => view.redraw() });
          const f32 = sim.checkbox(controls, { label: "Round every operation to 32-bit float", value: true, onChange: () => view.redraw() });

          const buf = new ArrayBuffer(4), F32 = new Float32Array(buf), U32 = new Uint32Array(buf);
          function bitGuess(r, rsqrt) {
            F32[0] = r;
            U32[0] = rsqrt ? (0x5f3759df - (U32[0] >>> 1)) >>> 0 : (0x7ef311c3 - U32[0]) >>> 0;
            return F32[0];
          }

          view.onDraw((v) => {
            const rsqrt = mode.value === "rsqrt";
            const r = rS.value;
            const exact = rsqrt ? 1 / Math.sqrt(r) : 1 / r;
            const limit = rsqrt ? Math.sqrt(3 / r) : 2 / r;
            const xmax = 2.7 * exact;
            v.opts.xRange = [-0.06 * xmax, xmax];
            v.opts.yRange = [-1.3 * r, 2.6 * r];
            const f = (x) => (rsqrt ? 1 / (x * x) - r : 1 / x - r);
            const R = Math.fround;
            const q = f32.value ? R : (x) => x;
            const step = rsqrt ? (x) => q(q(0.5 * x) * q(3 - q(q(r * x) * x))) : (x) => q(x * q(2 - q(r * x)));

            v.rect([0, -100 * r], [limit, 100 * r], { fill: "c", fillAlpha: 0.07, stroke: false });
            v.grid();
            v.axes({ ticks: true });
            v.line([limit, -100 * r], [limit, 100 * r], { color: "c", dash: [5, 5], width: 1.2 });
            v.text([limit, 2.4 * r], rsqrt ? "√(3/r)" : "2/r", { color: "c", size: 12, offset: [5, 0] });
            v.plot((x) => (x > 1e-6 ? f(x) : NaN), { color: "a", width: 2.5, from: 1e-3 * exact });
            v.point([exact, 0], { color: "c", r: 4 });

            let x = q(trick.value ? bitGuess(r, rsqrt) : kS.value * exact);
            const xs = [x];
            let bad = false;
            for (let i = 0; i < 5; i++) {
              const xn = step(x);
              if (!(xn > 0) || !Number.isFinite(xn)) { xs.push(xn); bad = true; break; }
              x = xn;
              xs.push(x);
            }
            for (let i = 0; i + 1 < xs.length; i++) {
              const xi = xs[i], xn = xs[i + 1];
              if (!(xi > 0)) break;
              const fi = f(xi);
              v.line([xi, 0], [xi, fi], { color: "muted", dash: [4, 4], width: 1.1 });
              v.line([xi, fi], [xn, 0], { color: "b", width: 1.8 });
              v.point([xn, 0], { color: xn > 0 ? "b" : "e", r: 4 });
            }
            v.point([xs[0], 0], { color: "d", r: 5.5, label: "x₀" });

            const rows = xs.map((xi, i) => {
              const rel = Math.abs(xi - exact) / exact;
              const bits = rel === 0 ? "exact" : Math.max(0, -Math.log2(rel)).toFixed(1) + " bits";
              return ["x" + sub(i), `${Number.isFinite(xi) ? xi.toPrecision(9) : "∞"} <span class="muted">${xi > 0 ? bits : "≤ 0!"}</span>`];
            });
            out.set(`<div class="eq">${rsqrt ? "xₙ₊₁ = ½ xₙ (3 − r xₙ²)" : "xₙ₊₁ = xₙ (2 − r xₙ)"}</div>` +
              sim.rows([["exact answer", exact.toPrecision(9)], ["convergence limit", "0 &lt; x₀ &lt; " + limit.toPrecision(4)]]) + "<hr>" +
              sim.rows(rows) + "<hr>" +
              (bad ? "<b class='bad'>An iterate became ≤ 0: x₀ was outside the safe interval, so the iteration runs away.</b>"
                : trick.value ? `Bit-trick guess: ${(Math.abs(xs[0] - exact) / exact * 100).toFixed(2)}% off before any refinement.`
                  : "Each step roughly doubles the correct bits" + (f32.value ? ", until float's 24-bit limit." : "."))
            );
          });
        },
      },
    ],

    cpp: [
      {
        title: "Quadratic equation (numerically stable)",
        formula: String.raw`t = \frac{-b \pm \sqrt D}{2a} \;\equiv\; t_1 = \frac qa,\; t_2 = \frac cq,\quad q = -\tfrac12\left(b + \operatorname{sgn}(b)\sqrt D\right)`,
        note: "<p>Both forms give the same roots, but this one never subtracts two nearly equal numbers. Assumes <code>a != 0</code>.</p>",
        code: String.raw`
          // Real roots of a t^2 + b t + c = 0, written to t[] in ascending order.
          // Returns how many there are: 0, 1, or 2.
          int SolveQuadratic(float a, float b, float c, float t[2])
          {
              float D = b * b - 4.0f * a * c;                    // discriminant
              if (D < 0.0f) return 0;                            // no real roots: the ray misses
              if (D == 0.0f) { t[0] = -b / (2.0f * a); return 1; }

              float q = -0.5f * (b + std::copysign(std::sqrt(D), b));
              float t1 = q / a;                                  // the root that is safe to compute
              float t2 = c / q;                                  // from t1 * t2 = c / a
              t[0] = std::fmin(t1, t2);
              t[1] = std::fmax(t1, t2);
              return 2;
          }
        `,
      },
      {
        title: "Cubic equation",
        formula: String.raw`D' = -(p'^3 + q'^2):\quad x = \sqrt[3]{-q' + \sqrt{-D'}} + \sqrt[3]{-q' - \sqrt{-D'}} \;\text{ or }\; x_k = 2\sqrt{-p'}\cos\!\left(\theta - \tfrac{2\pi k}{3}\right)`,
        code: String.raw`
          // Real roots of t^3 + a t^2 + b t + c = 0 (not sorted). Returns the count.
          int SolveCubic(float a, float b, float c, float t[3])
          {
              // t = x - a/3 gives x^3 + 3p'x + 2q' = 0
              float p = b / 3.0f - a * a / 9.0f;                         // p'
              float q = a * a * a / 27.0f - a * b / 6.0f + c * 0.5f;     // q'
              float D = -(p * p * p + q * q);                            // D' = D / 108
              float shift = -a / 3.0f;

              if (std::fabs(D) < 1.0e-9f)              // D' = 0: a double (or triple) root
              {
                  float r = std::cbrt(-q);
                  t[0] = 2.0f * r + shift;
                  t[1] = -r + shift;
                  return 2;
              }
              if (D < 0.0f)                            // D' < 0: one real root (Cardano)
              {
                  float s = std::sqrt(-D);
                  t[0] = std::cbrt(-q + s) + std::cbrt(-q - s) + shift;
                  return 1;
              }
              // D' > 0: three real roots from 4cos^3(theta) - 3cos(theta) = cos(3 theta)
              float m = std::sqrt(-p);
              float theta = std::acos(Clamp(-q / (m * m * m), -1.0f, 1.0f)) / 3.0f;
              const float k = 2.0943951f;              // 2 pi / 3
              t[0] = 2.0f * m * std::cos(theta) + shift;
              t[1] = 2.0f * m * std::cos(theta - k) + shift;
              t[2] = 2.0f * m * std::cos(theta + k) + shift;
              return 3;
          }
        `,
      },
      {
        title: "Quartic equation (resolvent cubic)",
        formula: String.raw`y^3 - \tfrac p2y^2 - ry + \tfrac{4rp - q^2}{8} = 0,\qquad x^2 \pm x\sqrt{2y - p} + y \mp \operatorname{sgn}(q)\sqrt{y^2 - r} = 0`,
        code: String.raw`
          // Real roots of t^4 + a t^3 + b t^2 + c t + d = 0. Returns the count (0 to 4).
          int SolveQuartic(float a, float b, float c, float d, float t[4])
          {
              // t = x - a/4 gives x^4 + p x^2 + q x + r = 0
              float a2 = a * a;
              float p = -0.375f * a2 + b;                                           // -3/8 a^2 + b
              float q = 0.125f * a2 * a - 0.5f * a * b + c;
              float r = -0.01171875f * a2 * a2 + 0.0625f * a2 * b - 0.25f * a * c + d;   // -3/256, 1/16
              float shift = -0.25f * a;
              float x[3];
              int n = 0;

              if (std::fabs(q) < 1.0e-6f)              // biquadratic: z^2 + p z + r = 0, z = x^2
              {
                  int nz = SolveQuadratic(1.0f, p, r, x);
                  for (int i = 0; i < nz; i++)
                  {
                      if (x[i] < 0.0f) continue;
                      float s = std::sqrt(x[i]);
                      t[n++] = s + shift;
                      t[n++] = -s + shift;
                  }
                  return n;
              }

              int ny = SolveCubic(-0.5f * p, -r, (4.0f * r * p - q * q) * 0.125f, x);   // resolvent
              float y = x[0];
              for (int i = 1; i < ny; i++) y = std::fmax(y, x[i]);   // the largest root: 2y - p >= 0

              float A = std::sqrt(std::fmax(2.0f * y - p, 0.0f));
              float B = std::sqrt(std::fmax(y * y - r, 0.0f));
              if (q < 0.0f) B = -B;                                   // the sign follows q

              int k = SolveQuadratic(1.0f, A, y - B, x);              // x^2 + A x + y - B = 0
              for (int i = 0; i < k; i++) t[n++] = x[i] + shift;
              k = SolveQuadratic(1.0f, -A, y + B, x);                 // x^2 - A x + y + B = 0
              for (int i = 0; i < k; i++) t[n++] = x[i] + shift;
              return n;
          }
        `,
      },
      {
        title: "Newton's method",
        formula: String.raw`x_{i+1} = x_i - \frac{f(x_i)}{f'(x_i)}`,
        note: "<p>Pass any callables for f and f′. A common use is polishing the roots from <code>SolveQuartic</code>.</p>",
        code: String.raw`
          template <typename F, typename DF>
          bool NewtonRoot(F f, DF df, float& x, int maxIterations = 20, float tolerance = 1.0e-6f)
          {
              for (int i = 0; i < maxIterations; i++)
              {
                  float slope = df(x);
                  if (std::fabs(slope) < 1.0e-12f) return false;      // flat tangent: no crossing
                  float step = f(x) / slope;
                  x -= step;                                          // x_{i+1} = x_i - f / f'
                  if (std::fabs(step) <= tolerance * std::fmax(1.0f, std::fabs(x))) return true;
              }
              return false;                                           // did not converge
          }

          // Example: polish a root of the monic quartic t^4 + a t^3 + b t^2 + c t + d.
          float PolishQuarticRoot(float a, float b, float c, float d, float t)
          {
              NewtonRoot([&](float x) { return (((x + a) * x + b) * x + c) * x + d; },
                         [&](float x) { return ((4.0f * x + 3.0f * a) * x + 2.0f * b) * x + c; }, t, 2);
              return t;
          }
        `,
      },
      {
        title: "Refining reciprocals and reciprocal square roots",
        formula: String.raw`x_{n+1} = x_n(2 - rx_n) \qquad x_{n+1} = \tfrac12x_n\left(3 - rx_n^2\right) \qquad \sqrt r = r\cdot\frac{1}{\sqrt r}`,
        note: "<p>A hardware estimate such as <code>_mm_rsqrt_ss</code> (about 12 bits) plus one step gives about 22 bits.</p>",
        code: String.raw`
          #include <cstdint>
          #include <cstring>

          inline float RefineReciprocal(float r, float x)     // needs 0 < x < 2/r
          {
              return x * (2.0f - r * x);
          }

          inline float RefineInverseSqrt(float r, float x)    // needs 0 < x < sqrt(3/r)
          {
              return 0.5f * x * (3.0f - r * x * x);
          }

          // Bit-trick first guess, then one Newton step (about 0.2% error).
          float FastInverseSqrt(float r)
          {
              uint32_t i;
              std::memcpy(&i, &r, sizeof(i));           // the float's bits as an integer
              i = 0x5F3759DFu - (i >> 1);                // roughly halves and negates the exponent
              float x;
              std::memcpy(&x, &i, sizeof(x));
              return RefineInverseSqrt(r, x);
          }

          inline float FastSqrt(float r) { return r * FastInverseSqrt(r); }   // sqrt(r) = r / sqrt(r)
        `,
      },
    ],
  });
  function finishRay(id, summary, subs, formula) { L3D.topic({id,summary,lesson:`<p>${summary}</p>${subs.map(([s,n])=>`<h2 data-sub="${s}">${n}</h2><p>${n} substitutes a ray into the surface equation and keeps the nearest nonnegative solution.</p>`).join("")}<div class="formula">\\[${formula}\\]</div><div class="game">Ray queries power picking, visibility, reflections, and offline rendering.</div><p><a class="btn goto-sim" href="#/${id}/sim">Cast a ray →</a></p>`,keyFormulas:[["Intersection",formula]],exercises:[{q:"Which hit should a primary ray use?",a:"<p>The smallest nonnegative parameter.</p>"}],sims:[{title:"Ray-circle intersection",help:"<p>Drag the ray origin and aim it at the sphere proxy. The discriminant tells whether it hits.</p>",mount(sim){const {stage,controls,readout}=sim.layout();const v=sim.view2d(stage,{range:5});const out=sim.readout(readout);const o=v.handle([-4,1],{color:"a",label:"ray"});const dy=sim.slider(controls,{label:"Ray slope",min:-1,max:1,step:.01,value:-.15,onInput:()=>v.redraw()});v.onDraw(x=>{const c=[1,0],d=[1,dy.value],oc=[o.pos[0]-c[0],o.pos[1]-c[1]],A=d[0]*d[0]+d[1]*d[1],B=2*(oc[0]*d[0]+oc[1]*d[1]),C=oc[0]*oc[0]+oc[1]*oc[1]-1,disc=B*B-4*A*C,hit=disc>=0;x.grid();x.axes();x.circle(c,1,{color:"e",fill:"e",fillAlpha:.18});x.infiniteLine(o.pos,d,{color:hit?"c":"a"});out.set(sim.rows([["discriminant",L3D.math.fmt(disc)],["intersection",hit?"hit":"miss",hit?"ok":"bad"]]));});}}],cpp:[{title:"Ray-sphere discriminant",formula,code:String.raw`float Discriminant(float a, float b, float c) { return b*b - 4.0f*a*c; }`}]});}
  finishRay("6.2","Surface intersections solve for where a parametric ray meets analytic primitives.",[["6.2.1","Intersection of a Ray and a Triangle"],["6.2.2","Intersection of a Ray and a Box"],["6.2.3","Intersection of a Ray and a Sphere"],["6.2.4","Intersection of a Ray and a Cylinder"],["6.2.5","Intersection of a Ray and a Torus"]],String.raw`a t^2+b t+c=0`);
  finishRay("6.3","Surface normals give the orientation needed for lighting and for reflected or refracted rays.",[],String.raw`\mathbf n=\frac{\partial_u\mathbf p\times\partial_v\mathbf p}{\|\partial_u\mathbf p\times\partial_v\mathbf p\|}`);
  finishRay("6.4","Reflection and refraction split an incident ray by the surface normal and indices of refraction.",[["6.4.1","Reflection Vector Calculation"],["6.4.2","Refraction Vector Calculation"]],String.raw`\mathbf r=\mathbf i-2(\mathbf i\cdot\mathbf n)\mathbf n`);
})();
