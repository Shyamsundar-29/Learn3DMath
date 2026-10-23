// L3D.math - small vector / matrix / quaternion helpers for the simulations.
//
// Same conventions as cpp/include/Math3D.h (and the book):
//   * vectors are plain arrays: [x, y] or [x, y, z] or [x, y, z, w]
//   * matrices are arrays of ROWS: m[row][col]; they multiply COLUMN vectors (v' = M v)
//   * quaternions are [x, y, z, w]
//   * right-handed, y-up world; angles in radians
(function () {
  "use strict";

  // ---------------------------------------------------------------- scalars
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rad = (deg) => (deg * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // Number -> string with fixed digits, without "-0.00".
  function fmt(x, digits = 2) {
    if (!Number.isFinite(x)) return x > 0 ? "∞" : x < 0 ? "-∞" : "NaN";
    const s = x.toFixed(digits);
    return /^-0\.?0*$/.test(s) ? s.slice(1) : s;
  }
  const fmtVec = (v, digits = 2) => "(" + v.map((x) => fmt(x, digits)).join(", ") + ")";

  // ---------------------------------------------------------------- vectors
  const V = {
    add: (a, b) => a.map((x, i) => x + b[i]),
    sub: (a, b) => a.map((x, i) => x - b[i]),
    scale: (a, s) => a.map((x) => x * s),
    neg: (a) => a.map((x) => -x),
    mul: (a, b) => a.map((x, i) => x * b[i]), // component-wise
    dot: (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    cross2: (a, b) => a[0] * b[1] - a[1] * b[0], // z of the 2D cross product
    perp2: (a) => [-a[1], a[0]], // rotate 90 degrees counterclockwise
    len2: (a) => V.dot(a, a),
    len: (a) => Math.sqrt(V.dot(a, a)),
    dist: (a, b) => V.len(V.sub(a, b)),
    norm(a) {
      const l = V.len(a);
      return l > 1e-12 ? V.scale(a, 1 / l) : a.map(() => 0);
    },
    lerp: (a, b, t) => a.map((x, i) => x + (b[i] - x) * t),
    // proj_b a = (a.b / b.b) b
    proj(a, b) {
      const bb = V.dot(b, b);
      return bb > 1e-12 ? V.scale(b, V.dot(a, b) / bb) : b.map(() => 0);
    },
    reject: (a, b) => V.sub(a, V.proj(a, b)),
    angle(a, b) {
      const d = V.len(a) * V.len(b);
      return d > 1e-12 ? Math.acos(clamp(V.dot(a, b) / d, -1, 1)) : 0;
    },
    rotate2(a, t) {
      const c = Math.cos(t), s = Math.sin(t);
      return [a[0] * c - a[1] * s, a[0] * s + a[1] * c];
    },
    // reflect direction d about unit normal n:  d - 2 (d.n) n
    reflect: (d, n) => V.sub(d, V.scale(n, 2 * V.dot(d, n))),
    // any unit vector perpendicular to a 3D vector
    anyPerp(a) {
      const t = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      return V.norm(V.cross(a, t));
    },
  };

  // --------------------------------------------------------------- matrices
  const M = {
    identity: (n = 3) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))),
    clone: (A) => A.map((r) => r.slice()),
    fromCols: (...cols) => cols[0].map((_, i) => cols.map((c) => c[i])),
    col: (A, j) => A.map((r) => r[j]),
    transpose: (A) => A[0].map((_, j) => A.map((r) => r[j])),
    mul: (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0))),
    mulVec: (A, v) => A.map((r) => r.reduce((s, x, k) => s + x * v[k], 0)),
    add: (A, B) => A.map((r, i) => r.map((x, j) => x + B[i][j])),
    scale: (A, s) => A.map((r) => r.map((x) => x * s)),

    // Determinant by cofactor expansion (fine for the small matrices used here).
    det(A) {
      const n = A.length;
      if (n === 1) return A[0][0];
      if (n === 2) return A[0][0] * A[1][1] - A[0][1] * A[1][0];
      let d = 0;
      for (let j = 0; j < n; j++) {
        const minor = A.slice(1).map((r) => r.filter((_, k) => k !== j));
        d += (j % 2 ? -1 : 1) * A[0][j] * M.det(minor);
      }
      return d;
    },

    // Inverse by Gauss-Jordan elimination with partial pivoting. Returns null if singular.
    inverse(A) {
      const n = A.length;
      const m = A.map((r, i) => [...r, ...M.identity(n)[i]]);
      for (let c = 0; c < n; c++) {
        let p = c;
        for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
        if (Math.abs(m[p][c]) < 1e-12) return null;
        [m[c], m[p]] = [m[p], m[c]];
        const inv = 1 / m[c][c];
        for (let k = 0; k < 2 * n; k++) m[c][k] *= inv;
        for (let r = 0; r < n; r++) {
          if (r === c) continue;
          const f = m[r][c];
          for (let k = 0; k < 2 * n; k++) m[r][k] -= f * m[c][k];
        }
      }
      return m.map((r) => r.slice(n));
    },

    // ---- 3x3 transforms (Chapter 4)
    scale3: (sx, sy = sx, sz = sx) => [[sx, 0, 0], [0, sy, 0], [0, 0, sz]],
    rotX(t) {
      const c = Math.cos(t), s = Math.sin(t);
      return [[1, 0, 0], [0, c, -s], [0, s, c]];
    },
    rotY(t) {
      const c = Math.cos(t), s = Math.sin(t);
      return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
    },
    rotZ(t) {
      const c = Math.cos(t), s = Math.sin(t);
      return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
    },
    // rotation by t about unit axis a (Rodrigues)
    rotAxis(a, t) {
      const c = Math.cos(t), s = Math.sin(t), d = 1 - c;
      const [x, y, z] = a;
      return [
        [c + d * x * x, d * x * y - s * z, d * x * z + s * y],
        [d * x * y + s * z, c + d * y * y, d * y * z - s * x],
        [d * x * z - s * y, d * y * z + s * x, c + d * z * z],
      ];
    },
    rot2: (t) => [[Math.cos(t), -Math.sin(t)], [Math.sin(t), Math.cos(t)]],

    // ---- 4x4 transforms
    // 4x4 affine matrix from a 3x3 matrix and a translation
    affine: (m3 = M.identity(3), t = [0, 0, 0]) => [[...m3[0], t[0]], [...m3[1], t[1]], [...m3[2], t[2]], [0, 0, 0, 1]],
    translate: (t) => M.affine(M.identity(3), t),
    // OpenGL perspective: camera looks down -z, maps z in [-n, -f] to NDC [-1, 1]
    perspective(fovy, aspect, n, f) {
      const e = 1 / Math.tan(fovy / 2);
      return [
        [e / aspect, 0, 0, 0],
        [0, e, 0, 0],
        [0, 0, -(f + n) / (f - n), (-2 * f * n) / (f - n)],
        [0, 0, -1, 0],
      ];
    },
    ortho(l, r, b, t, n, f) {
      return [
        [2 / (r - l), 0, 0, -(r + l) / (r - l)],
        [0, 2 / (t - b), 0, -(t + b) / (t - b)],
        [0, 0, -2 / (f - n), -(f + n) / (f - n)],
        [0, 0, 0, 1],
      ];
    },
    // world -> camera, camera looks down its -z axis with +y up
    lookAt(eye, target, up = [0, 1, 0]) {
      const z = V.norm(V.sub(eye, target));
      const x = V.norm(V.cross(up, z));
      const y = V.cross(z, x);
      return [
        [...x, -V.dot(x, eye)],
        [...y, -V.dot(y, eye)],
        [...z, -V.dot(z, eye)],
        [0, 0, 0, 1],
      ];
    },
    // points get translated (w = 1); directions do not (w = 0)
    transformPoint: (A, p) => M.mulVec(A, [...p, 1]).slice(0, 3),
    transformVec: (A, v) => M.mulVec(A, [...v, 0]).slice(0, 3),
    // full homogeneous transform followed by the divide by w
    project(A, p) {
      const h = M.mulVec(A, [...p, 1]);
      return [h[0] / h[3], h[1] / h[3], h[2] / h[3]];
    },
  };

  // ------------------------------------------------------------ quaternions
  const Q = {
    identity: () => [0, 0, 0, 1],
    fromAxisAngle(axis, t) {
      const s = Math.sin(t / 2);
      return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(t / 2)];
    },
    mul(a, b) {
      const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
      return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
      ];
    },
    conj: (q) => [-q[0], -q[1], -q[2], q[3]],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3],
    norm(q) {
      const l = Math.hypot(...q);
      return q.map((x) => x / l);
    },
    // v' = q v q*
    rotate(q, v) {
      const b = [q[0], q[1], q[2]], w = q[3];
      return V.add(V.add(V.scale(v, w * w - V.dot(b, b)), V.scale(b, 2 * V.dot(v, b))), V.scale(V.cross(b, v), 2 * w));
    },
    toMat3(q) {
      const [x, y, z, w] = q;
      return [
        [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
        [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
        [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
      ];
    },
    slerp(a, b, t) {
      let c = Q.dot(a, b);
      if (c < 0) { b = b.map((x) => -x); c = -c; }
      if (c > 0.9995) return Q.norm(a.map((x, i) => x + (b[i] - x) * t));
      const th = Math.acos(c), s = Math.sin(th);
      const ka = Math.sin((1 - t) * th) / s, kb = Math.sin(t * th) / s;
      return a.map((x, i) => x * ka + b[i] * kb);
    },
  };

  // Real roots of a t^2 + b t + c = 0, ascending.
  function solveQuadratic(a, b, c) {
    if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-c / b];
    const disc = b * b - 4 * a * c;
    if (disc < 0) return [];
    const r = Math.sqrt(disc);
    return [(-b - r) / (2 * a), (-b + r) / (2 * a)].sort((x, y) => x - y);
  }

  window.L3D = window.L3D || {};
  L3D.math = { V, M, Q, clamp, lerp, rad, deg, smoothstep, fmt, fmtVec, solveQuadratic };
})();
