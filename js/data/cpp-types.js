// The small C++ structs that every "C++ Code" tab builds on.
// Shown on the #/cpp-types page. Each block: { title, note, code }.
window.L3D = window.L3D || {};

L3D.cppTypes = [
  {
    title: "Conventions",
    note: `<p>These match the book. Snippets on topic pages assume these types exist (they are deliberately tiny, like the
      math layer of a real engine). Use <code>float</code>, as games do.</p>`,
    code: String.raw`
      // * Column vectors: a matrix transforms a vector as  v' = M * v
      //   so transforms combine right-to-left:  M = Projection * View * Model
      // * Matrices are stored column-major (n[column][row]) - the layout OpenGL expects.
      // * Right-handed coordinates; the camera looks down its -z axis.
      // * Angles are in radians.
      #include <cmath>

      constexpr float kPi = 3.14159265f;
      inline float Radians(float deg) { return deg * (kPi / 180.0f); }
      inline float Clamp(float x, float lo, float hi) { return x < lo ? lo : (x > hi ? hi : x); }
      inline float Lerp(float a, float b, float t) { return a + (b - a) * t; }
    `,
  },
  {
    title: "Vector3D (and Point3D)",
    note: `<p><code>Point3D</code> is just another name for <code>Vector3D</code>. The name tells the reader the value
      is a position (affected by translation) rather than a direction.</p>`,
    code: String.raw`
      struct Vector3D
      {
          float x, y, z;

          Vector3D() : x(0), y(0), z(0) {}
          Vector3D(float a, float b, float c) : x(a), y(b), z(c) {}

          float& operator[](int i) { return (&x)[i]; }      // v[0] == v.x
          Vector3D& operator+=(const Vector3D& v) { x += v.x; y += v.y; z += v.z; return *this; }
          Vector3D& operator*=(float s) { x *= s; y *= s; z *= s; return *this; }
      };

      using Point3D = Vector3D;

      inline Vector3D operator+(const Vector3D& a, const Vector3D& b) { return {a.x + b.x, a.y + b.y, a.z + b.z}; }
      inline Vector3D operator-(const Vector3D& a, const Vector3D& b) { return {a.x - b.x, a.y - b.y, a.z - b.z}; }
      inline Vector3D operator-(const Vector3D& v)                    { return {-v.x, -v.y, -v.z}; }
      inline Vector3D operator*(const Vector3D& v, float s)           { return {v.x * s, v.y * s, v.z * s}; }
      inline Vector3D operator*(float s, const Vector3D& v)           { return {v.x * s, v.y * s, v.z * s}; }
      inline Vector3D operator/(const Vector3D& v, float s)           { s = 1.0f / s; return {v.x * s, v.y * s, v.z * s}; }
    `,
  },
  {
    title: "Vector functions",
    code: String.raw`
      inline float Dot(const Vector3D& a, const Vector3D& b) { return a.x * b.x + a.y * b.y + a.z * b.z; }

      inline Vector3D Cross(const Vector3D& a, const Vector3D& b)
      {
          return {a.y * b.z - a.z * b.y,
                  a.z * b.x - a.x * b.z,
                  a.x * b.y - a.y * b.x};
      }

      inline float    Magnitude(const Vector3D& v)  { return std::sqrt(Dot(v, v)); }
      inline float    SquaredMag(const Vector3D& v) { return Dot(v, v); }
      inline Vector3D Normalize(const Vector3D& v)  { return v / Magnitude(v); }

      // part of p parallel to q, and the part perpendicular to q
      inline Vector3D Project(const Vector3D& p, const Vector3D& q) { return q * (Dot(p, q) / Dot(q, q)); }
      inline Vector3D Reject(const Vector3D& p, const Vector3D& q)  { return p - Project(p, q); }
    `,
  },
  {
    title: "Vector2D and Vector4D",
    code: String.raw`
      struct Vector2D
      {
          float x, y;
          Vector2D() : x(0), y(0) {}
          Vector2D(float a, float b) : x(a), y(b) {}
      };   // + - * / Dot and Magnitude work just like Vector3D

      struct Vector4D          // homogeneous coordinates (Section 4.4)
      {
          float x, y, z, w;
          Vector4D() : x(0), y(0), z(0), w(0) {}
          Vector4D(float a, float b, float c, float d) : x(a), y(b), z(c), w(d) {}
          Vector4D(const Vector3D& v, float d) : x(v.x), y(v.y), z(v.z), w(d) {}
      };
    `,
  },
  {
    title: "Matrix3D",
    note: `<p>Entries are passed to the constructor in reading order (row by row), but stored by column, so
      <code>m[j]</code> is column <i>j</i> as a <code>Vector3D</code>. Column <i>j</i> is where the transform sends
      axis <i>j</i>.</p>`,
    code: String.raw`
      struct Matrix3D
      {
          float n[3][3];     // n[column][row]

          Matrix3D() = default;
          Matrix3D(float n00, float n01, float n02,
                   float n10, float n11, float n12,
                   float n20, float n21, float n22)
          {
              n[0][0] = n00; n[0][1] = n10; n[0][2] = n20;
              n[1][0] = n01; n[1][1] = n11; n[1][2] = n21;
              n[2][0] = n02; n[2][1] = n12; n[2][2] = n22;
          }

          float& operator()(int row, int col)             { return n[col][row]; }
          const float& operator()(int row, int col) const { return n[col][row]; }

          Vector3D& operator[](int j)             { return *reinterpret_cast<Vector3D*>(n[j]); }
          const Vector3D& operator[](int j) const { return *reinterpret_cast<const Vector3D*>(n[j]); }
      };

      inline Matrix3D operator*(const Matrix3D& a, const Matrix3D& b);   // (AB)ij = sum_k Aik Bkj
      inline Vector3D operator*(const Matrix3D& m, const Vector3D& v);   // M v
      inline Matrix3D Transpose(const Matrix3D& m);
      inline float    Determinant(const Matrix3D& m);                    // Section 3.4
      inline Matrix3D Inverse(const Matrix3D& m);                        // Section 3.3
    `,
  },
  {
    title: "Matrix4D",
    code: String.raw`
      struct Matrix4D
      {
          float n[4][4];     // n[column][row]

          Matrix4D() = default;
          Matrix4D(float n00, float n01, float n02, float n03,
                   float n10, float n11, float n12, float n13,
                   float n20, float n21, float n22, float n23,
                   float n30, float n31, float n32, float n33);   // reading order, stored by column

          float& operator()(int row, int col)             { return n[col][row]; }
          const float& operator()(int row, int col) const { return n[col][row]; }
      };

      inline Matrix4D operator*(const Matrix4D& a, const Matrix4D& b);
      inline Vector4D operator*(const Matrix4D& m, const Vector4D& v);
      inline Matrix4D Inverse(const Matrix4D& m);

      // Points (w = 1) are translated, directions (w = 0) are not.  Section 4.4.2
      inline Point3D  TransformPoint(const Matrix4D& m, const Point3D& p);
      inline Vector3D TransformVector(const Matrix4D& m, const Vector3D& v);
    `,
  },
  {
    title: "Quaternion",
    code: String.raw`
      struct Quaternion      // q = w + xi + yj + zk      (Section 4.6)
      {
          float x, y, z, w;

          Quaternion() : x(0), y(0), z(0), w(1) {}                 // identity rotation
          Quaternion(float a, float b, float c, float s) : x(a), y(b), z(c), w(s) {}
          Quaternion(const Vector3D& v, float s) : x(v.x), y(v.y), z(v.z), w(s) {}

          Vector3D GetVectorPart() const { return {x, y, z}; }
      };

      inline Quaternion operator*(const Quaternion& a, const Quaternion& b);   // Hamilton product
      inline Quaternion Conjugate(const Quaternion& q) { return {-q.x, -q.y, -q.z, q.w}; }
    `,
  },
  {
    title: "Plane and Ray",
    code: String.raw`
      struct Plane           // L = <N, D>; points on the plane satisfy N.P + D = 0   (Section 5.2)
      {
          float x, y, z, w;  // (x, y, z) = normal N, w = D

          Plane() : x(0), y(0), z(1), w(0) {}
          Plane(const Vector3D& n, float d) : x(n.x), y(n.y), z(n.z), w(d) {}

          Vector3D GetNormal() const { return {x, y, z}; }
      };

      // L . P for a point: the signed distance to the plane when N is unit length
      inline float DotPoint(const Plane& f, const Point3D& p) { return f.x * p.x + f.y * p.y + f.z * p.z + f.w; }

      struct Ray             // P(t) = S + t V                                         (Chapter 6)
      {
          Point3D  origin;     // S
          Vector3D direction;  // V

          Point3D At(float t) const { return origin + direction * t; }
      };
    `,
  },
];
