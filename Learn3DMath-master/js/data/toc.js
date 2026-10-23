// Table of contents for "Mathematics for 3D Game Programming and Computer Graphics" (3rd ed.)
// Each section is one topic page. Its lesson, simulations, and C++ examples live in the
// chapter file named by `file`; C++ sources live in cpp/examples/<chapter>/.
window.L3D = window.L3D || {};

L3D.book = {
  title: "Mathematics for 3D Game Programming and Computer Graphics",
  author: "Eric Lengyel",
  edition: "Third Edition",
};

L3D.toc = [
  {
    id: "ch01", number: "1", title: "The Rendering Pipeline", file: "js/chapters/ch01.js",
    blurb: "How a GPU turns vertices into pixels: coordinate spaces, rasterization, and the fragment tests.",
    sections: [
      { id: "1.1", title: "Graphics Processors", subs: [] },
      { id: "1.2", title: "Vertex Transformation", subs: [] },
      { id: "1.3", title: "Rasterization and Fragment Operations", subs: [] },
    ],
  },
  {
    id: "ch02", number: "2", title: "Vectors", file: "js/chapters/ch02.js",
    blurb: "Magnitude, dot and cross products, projections, bases, and Gram-Schmidt.",
    sections: [
      { id: "2.1", title: "Vector Properties", subs: [] },
      { id: "2.2", title: "The Dot Product", subs: [] },
      { id: "2.3", title: "The Cross Product", subs: [] },
      { id: "2.4", title: "Vector Spaces", subs: [] },
    ],
  },
  {
    id: "ch03", number: "3", title: "Matrices", file: "js/chapters/ch03.js",
    blurb: "Matrix algebra, solving linear systems, inverses, determinants, and eigenvectors.",
    sections: [
      { id: "3.1", title: "Matrix Properties", subs: [] },
      { id: "3.2", title: "Linear Systems", subs: [] },
      { id: "3.3", title: "Matrix Inverses", subs: [] },
      { id: "3.4", title: "Determinants", subs: [] },
      { id: "3.5", title: "Eigenvalues and Eigenvectors", subs: [] },
      { id: "3.6", title: "Diagonalization", subs: [] },
    ],
  },
  {
    id: "ch04", number: "4", title: "Transforms", file: "js/chapters/ch04.js",
    blurb: "Scaling, rotation, homogeneous coordinates, normal transformation, and quaternions.",
    sections: [
      { id: "4.1", title: "Linear Transformations", subs: [["4.1.1", "Orthogonal Matrices"], ["4.1.2", "Handedness"]] },
      { id: "4.2", title: "Scaling Transforms", subs: [] },
      { id: "4.3", title: "Rotation Transforms", subs: [["4.3.1", "Rotation About an Arbitrary Axis"]] },
      { id: "4.4", title: "Homogeneous Coordinates", subs: [["4.4.1", "Four-Dimensional Transforms"], ["4.4.2", "Points and Directions"], ["4.4.3", "Geometrical Interpretation of the w Coordinate"]] },
      { id: "4.5", title: "Transforming Normal Vectors", subs: [] },
      { id: "4.6", title: "Quaternions", subs: [["4.6.1", "Quaternion Mathematics"], ["4.6.2", "Rotations with Quaternions"], ["4.6.3", "Spherical Linear Interpolation"]] },
    ],
  },
  {
    id: "ch05", number: "5", title: "Geometry for 3D Engines", file: "js/chapters/ch05.js",
    blurb: "Lines, planes, the view frustum, perspective-correct interpolation, and projection matrices.",
    sections: [
      { id: "5.1", title: "Lines in 3D Space", subs: [["5.1.1", "Distance Between a Point and a Line"], ["5.1.2", "Distance Between Two Lines"]] },
      { id: "5.2", title: "Planes in 3D Space", subs: [["5.2.1", "Intersection of a Line and a Plane"], ["5.2.2", "Intersection of Three Planes"], ["5.2.3", "Transforming Planes"]] },
      { id: "5.3", title: "The View Frustum", subs: [["5.3.1", "Field of View"], ["5.3.2", "Frustum Planes"]] },
      { id: "5.4", title: "Perspective-Correct Interpolation", subs: [["5.4.1", "Depth Interpolation"], ["5.4.2", "Vertex Attribute Interpolation"]] },
      { id: "5.5", title: "Projections", subs: [["5.5.1", "Perspective Projections"], ["5.5.2", "Orthographic Projections"], ["5.5.3", "Extracting Frustum Planes"]] },
      { id: "5.6", title: "Reflections and Oblique Clipping", subs: [] },
    ],
  },
  {
    id: "ch06", number: "6", title: "Ray Tracing", file: "js/chapters/ch06.js",
    blurb: "Root finding, ray-surface intersections, normals, and reflection/refraction vectors.",
    sections: [
      { id: "6.1", title: "Root Finding", subs: [["6.1.1", "Quadratic Polynomials"], ["6.1.2", "Cubic Polynomials"], ["6.1.3", "Quartic Polynomials"], ["6.1.4", "Newton's Method"], ["6.1.5", "Refinement of Reciprocals and Square Roots"]] },
      { id: "6.2", title: "Surface Intersections", subs: [["6.2.1", "Intersection of a Ray and a Triangle"], ["6.2.2", "Intersection of a Ray and a Box"], ["6.2.3", "Intersection of a Ray and a Sphere"], ["6.2.4", "Intersection of a Ray and a Cylinder"], ["6.2.5", "Intersection of a Ray and a Torus"]] },
      { id: "6.3", title: "Normal Vector Calculation", subs: [] },
      { id: "6.4", title: "Reflection and Refraction Vectors", subs: [["6.4.1", "Reflection Vector Calculation"], ["6.4.2", "Refraction Vector Calculation"]] },
    ],
  },
  {
    id: "ch07", number: "7", title: "Lighting and Shading", file: "js/chapters/ch07.js",
    blurb: "Light sources, diffuse and specular reflection, texturing, bump mapping, and Cook-Torrance.",
    sections: [
      { id: "7.1", title: "RGB Color", subs: [] },
      { id: "7.2", title: "Light Sources", subs: [["7.2.1", "Ambient Light"], ["7.2.2", "Directional Light Sources"], ["7.2.3", "Point Light Sources"], ["7.2.4", "Spot Light Sources"]] },
      { id: "7.3", title: "Diffuse Reflection", subs: [] },
      { id: "7.4", title: "Specular Reflection", subs: [] },
      { id: "7.5", title: "Texture Mapping", subs: [["7.5.1", "Standard Texture Maps"], ["7.5.2", "Projective Texture Maps"], ["7.5.3", "Cube Texture Maps"], ["7.5.4", "Filtering and Mipmaps"]] },
      { id: "7.6", title: "Emission", subs: [] },
      { id: "7.7", title: "Shading Models", subs: [["7.7.1", "Calculating Normal Vectors"], ["7.7.2", "Gouraud Shading"], ["7.7.3", "Blinn-Phong Shading"]] },
      { id: "7.8", title: "Bump Mapping", subs: [["7.8.1", "Bump Map Construction"], ["7.8.2", "Tangent Space"], ["7.8.3", "Calculating Tangent Vectors"], ["7.8.4", "Implementation"]] },
      { id: "7.9", title: "A Physical Reflection Model", subs: [["7.9.1", "Bidirectional Reflectance Distribution Functions"], ["7.9.2", "Cook-Torrance Illumination"], ["7.9.3", "The Fresnel Factor"], ["7.9.4", "The Microfacet Distribution Function"], ["7.9.5", "The Geometrical Attenuation Factor"], ["7.9.6", "Implementation"]] },
    ],
  },
  {
    id: "ch08", number: "8", title: "Visibility Determination", file: "js/chapters/ch08.js",
    blurb: "Bounding volumes, frustum culling tests, octrees, BSP trees, and portal systems.",
    sections: [
      { id: "8.1", title: "Bounding Volume Construction", subs: [["8.1.1", "Principal Component Analysis"], ["8.1.2", "Bounding Box Construction"], ["8.1.3", "Bounding Sphere Construction"], ["8.1.4", "Bounding Ellipsoid Construction"], ["8.1.5", "Bounding Cylinder Construction"]] },
      { id: "8.2", title: "Bounding Volume Tests", subs: [["8.2.1", "Bounding Sphere Test"], ["8.2.2", "Bounding Ellipsoid Test"], ["8.2.3", "Bounding Cylinder Test"], ["8.2.4", "Bounding Box Test"]] },
      { id: "8.3", title: "Spatial Partitioning", subs: [["8.3.1", "Octrees"], ["8.3.2", "Binary Space Partitioning Trees"]] },
      { id: "8.4", title: "Portal Systems", subs: [["8.4.1", "Portal Clipping"], ["8.4.2", "Reduced View Frustums"]] },
    ],
  },
  {
    id: "ch09", number: "9", title: "Polygonal Techniques", file: "js/chapters/ch09.js",
    blurb: "Depth offset, decals, polygon clipping, billboards, mesh simplification, and triangulation.",
    sections: [
      { id: "9.1", title: "Depth Value Offset", subs: [["9.1.1", "Projection Matrix Modification"], ["9.1.2", "Offset Value Selection"], ["9.1.3", "Implementation"]] },
      { id: "9.2", title: "Decal Application", subs: [["9.2.1", "Decal Mesh Construction"], ["9.2.2", "Polygon Clipping"]] },
      { id: "9.3", title: "Billboarding", subs: [["9.3.1", "Unconstrained Quads"], ["9.3.2", "Constrained Quads"], ["9.3.3", "Polyboards"]] },
      { id: "9.4", title: "Polygon Reduction", subs: [] },
      { id: "9.5", title: "T-Junction Elimination", subs: [] },
      { id: "9.6", title: "Triangulation", subs: [] },
    ],
  },
  {
    id: "ch10", number: "10", title: "Shadows", file: "js/chapters/ch10.js",
    blurb: "Shadow casting sets, shadow mapping, and stencil shadow volumes.",
    sections: [
      { id: "10.1", title: "Shadow Casting Set", subs: [] },
      { id: "10.2", title: "Shadow Mapping", subs: [["10.2.1", "Rendering the Shadow Map"], ["10.2.2", "Rendering the Main Scene"], ["10.2.3", "Self-Shadowing"]] },
      { id: "10.3", title: "Stencil Shadows", subs: [["10.3.1", "Algorithm Overview"], ["10.3.2", "Infinite View Frustums"], ["10.3.3", "Silhouette Determination"], ["10.3.4", "Shadow Volume Construction"], ["10.3.5", "Determining Cap Necessity"], ["10.3.6", "Rendering Shadow Volumes"], ["10.3.7", "Scissor Optimization"]] },
    ],
  },
  {
    id: "ch11", number: "11", title: "Curves and Surfaces", file: "js/chapters/ch11.js",
    blurb: "Hermite, Bezier, Catmull-Rom, cubic splines, B-splines, NURBS, and bicubic surfaces.",
    sections: [
      { id: "11.1", title: "Cubic Curves", subs: [] },
      { id: "11.2", title: "Hermite Curves", subs: [] },
      { id: "11.3", title: "Bézier Curves", subs: [["11.3.1", "Cubic Bézier Curves"], ["11.3.2", "Bézier Curve Truncation"], ["11.3.3", "The de Casteljau Algorithm"]] },
      { id: "11.4", title: "Catmull-Rom Splines", subs: [] },
      { id: "11.5", title: "Cubic Splines", subs: [] },
      { id: "11.6", title: "B-Splines", subs: [["11.6.1", "Uniform B-Splines"], ["11.6.2", "B-Spline Globalization"], ["11.6.3", "Nonuniform B-Splines"], ["11.6.4", "NURBS"]] },
      { id: "11.7", title: "Bicubic Surfaces", subs: [] },
      { id: "11.8", title: "Curvature and Torsion", subs: [] },
    ],
  },
  {
    id: "ch12", number: "12", title: "Collision Detection", file: "js/chapters/ch12.js",
    blurb: "Swept spheres and boxes against planes, sliding, and sphere-sphere collisions.",
    sections: [
      { id: "12.1", title: "Plane Collisions", subs: [["12.1.1", "Collision of a Sphere and a Plane"], ["12.1.2", "Collision of a Box and a Plane"], ["12.1.3", "Spatial Partitioning"]] },
      { id: "12.2", title: "General Sphere Collisions", subs: [] },
      { id: "12.3", title: "Sliding", subs: [] },
      { id: "12.4", title: "Collision of Two Spheres", subs: [] },
    ],
  },
  {
    id: "ch13", number: "13", title: "Linear Physics", file: "js/chapters/ch13.js",
    blurb: "Position functions, differential equations, projectiles, drag, and friction.",
    sections: [
      { id: "13.1", title: "Position Functions", subs: [] },
      { id: "13.2", title: "Second-Order Differential Equations", subs: [["13.2.1", "Homogeneous Equations"], ["13.2.2", "Nonhomogeneous Equations"], ["13.2.3", "Initial Conditions"]] },
      { id: "13.3", title: "Projectile Motion", subs: [] },
      { id: "13.4", title: "Resisted Motion", subs: [] },
      { id: "13.5", title: "Friction", subs: [] },
    ],
  },
  {
    id: "ch14", number: "14", title: "Rotational Physics", file: "js/chapters/ch14.js",
    blurb: "Rotating frames, rigid bodies, the inertia tensor, springs, and pendulums.",
    sections: [
      { id: "14.1", title: "Rotating Environments", subs: [["14.1.1", "Angular Velocity"], ["14.1.2", "The Centrifugal Force"], ["14.1.3", "The Coriolis Force"]] },
      { id: "14.2", title: "Rigid Body Motion", subs: [["14.2.1", "Center of Mass"], ["14.2.2", "Angular Momentum and Torque"], ["14.2.3", "The Inertia Tensor"], ["14.2.4", "Principal Axes of Inertia"], ["14.2.5", "Transforming the Inertia Tensor"]] },
      { id: "14.3", title: "Oscillatory Motion", subs: [["14.3.1", "Spring Motion"], ["14.3.2", "Pendulum Motion"]] },
    ],
  },
  {
    id: "ch15", number: "15", title: "Fluid and Cloth Simulation", file: "js/chapters/ch15.js",
    blurb: "The wave equation on a height grid, and mass-spring cloth.",
    sections: [
      { id: "15.1", title: "Fluid Simulation", subs: [["15.1.1", "The Wave Equation"], ["15.1.2", "Approximating Derivatives"], ["15.1.3", "Evaluating Surface Displacement"], ["15.1.4", "Implementation"]] },
      { id: "15.2", title: "Cloth Simulation", subs: [["15.2.1", "The Spring System"], ["15.2.2", "External Forces"], ["15.2.3", "Implementation"]] },
    ],
  },
  {
    id: "ch16", number: "16", title: "Numerical Methods", file: "js/chapters/ch16.js",
    blurb: "Fast trig, solving linear systems, the Jacobi eigen-solver, and ODE integrators.",
    sections: [
      { id: "16.1", title: "Trigonometric Functions", subs: [] },
      { id: "16.2", title: "Linear Systems", subs: [["16.2.1", "Triangular Systems"], ["16.2.2", "Gaussian Elimination"], ["16.2.3", "LU Decomposition"], ["16.2.4", "Error Reduction"], ["16.2.5", "Tridiagonal Systems"]] },
      { id: "16.3", title: "Eigenvalues and Eigenvectors", subs: [] },
      { id: "16.4", title: "Ordinary Differential Equations", subs: [["16.4.1", "Euler's Method"], ["16.4.2", "Taylor Series Method"], ["16.4.3", "Runge-Kutta Method"], ["16.4.4", "Higher-Order Differential Equations"]] },
    ],
  },
  {
    id: "app", number: "A–D", title: "Appendices", file: "js/chapters/appendix.js",
    blurb: "Complex numbers, trigonometry, coordinate systems, and Taylor series.",
    sections: [
      { id: "A", title: "Complex Numbers", subs: [["A.1", "Definition"], ["A.2", "Addition and Multiplication"], ["A.3", "Conjugates and Inverses"], ["A.4", "The Euler Formula"]] },
      { id: "B", title: "Trigonometry Reference", subs: [["B.1", "Function Definitions"], ["B.2", "Symmetry and Phase Shifts"], ["B.3", "Pythagorean Identities"], ["B.4", "Exponential Identities"], ["B.5", "Inverse Functions"], ["B.6", "Laws of Sines and Cosines"]] },
      { id: "C", title: "Coordinate Systems", subs: [["C.1", "Cartesian Coordinates"], ["C.2", "Cylindrical Coordinates"], ["C.3", "Spherical Coordinates"], ["C.4", "Generalized Coordinates"]] },
      { id: "D", title: "Taylor Series", subs: [["D.1", "Derivation"], ["D.2", "Power Series"], ["D.3", "The Euler Formula"]] },
    ],
  },
];
