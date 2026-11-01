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

// The library is the top level of the navigation tree. Add another object here
// to publish another book with the same lesson/simulation application.
// Topic ids must stay unique across the library for legacy #/topic links.
L3D.library = [
  {
    id: "basic-math",
    shortTitle: "Basic Math for 3D",
    title: "Basic Math for 3D & Graphics",
    author: "Learn 3D Math",
    edition: "Foundation course",
    chapters: [
      { id: "bm01", number: "1", title: "Number Sense", file: "js/chapters/basic-math.js", blurb: "Numbers, operations, fractions, decimals, and percentages.", sections: [
        { id: "BM1.1", title: "Numbers and Number Lines", subs: [] },
        { id: "BM1.2", title: "Adding and Subtracting", subs: [] },
        { id: "BM1.3", title: "Multiplying and Dividing", subs: [] },
        { id: "BM1.4", title: "Fractions, Decimals, and Percentages", subs: [] },
        { id: "BM1.5", title: "Ratios and Proportions", subs: [] },
        { id: "BM1.6", title: "Types of Numbers", subs: [] },
      ] },
      { id: "bm02", number: "2", title: "Shapes and Coordinates", file: "js/chapters/basic-math.js", blurb: "Points, grids, distance, shapes, and right triangles.", sections: [
        { id: "BM2.1", title: "Points on a Grid", subs: [] },
        { id: "BM2.2", title: "Distance and Length", subs: [] },
        { id: "BM2.3", title: "Perimeter and Area", subs: [] },
        { id: "BM2.4", title: "Right Triangles", subs: [] },
        { id: "BM2.5", title: "3D Coordinates", subs: [] },
        { id: "BM2.6", title: "2D Shape Formulas", subs: [] },
        { id: "BM2.7", title: "3D Shape Formulas", subs: [] },
      ] },
      { id: "bm03", number: "3", title: "Angles and Trigonometry", file: "js/chapters/basic-math.js", blurb: "Turns, theta, triangles, sine, cosine, tangent, and radians.", sections: [
        { id: "BM3.1", title: "Angles and Turns", subs: [] },
        { id: "BM3.2", title: "Types of Angles and Triangles", subs: [] },
        { id: "BM3.3", title: "Sine, Cosine, and Tangent", subs: [] },
        { id: "BM3.4", title: "Degrees and Radians", subs: [] },
        { id: "BM3.5", title: "The Six Trigonometric Ratios", subs: [] },
      ] },
    ],
  },
  {
    id: "learn-3d-math",
    shortTitle: "Learn 3D Math",
    title: L3D.book.title,
    author: L3D.book.author,
    edition: L3D.book.edition,
    chapters: L3D.toc,
  },
  {
    id: "learn-opengl",
    shortTitle: "Learn OpenGL",
    title: "Learn OpenGL: Graphics API Foundations",
    author: "Learn 3D Math",
    edition: "API course",
    chapters: [
      { id: "gl01", number: "1", title: "OpenGL Foundations", file: "js/chapters/gl01.js", blurb: "What OpenGL is, how CPU, driver, and GPU cooperate, and how the pipeline is staged.", sections: [
        { id: "GL1.1", title: "What Is OpenGL?", subs: [["GL1.1.1", "Specification vs driver"], ["GL1.1.2", "What OpenGL does not do"], ["GL1.1.3", "Core profile"]] },
        { id: "GL1.2", title: "The OpenGL State Machine", subs: [["GL1.2.1", "Context state"], ["GL1.2.2", "Create, bind, modify"], ["GL1.2.3", "Why binding exists"]] },
        { id: "GL1.3", title: "CPU, GPU, and the Driver", subs: [["GL1.3.1", "Who does what"], ["GL1.3.2", "Command buffers"], ["GL1.3.3", "VRAM vs RAM"]] },
        { id: "GL1.4", title: "The Graphics Pipeline", subs: [["GL1.4.1", "Programmable stages"], ["GL1.4.2", "Fixed stages"], ["GL1.4.3", "Draw call as a kick"]] },
      ] },
      { id: "gl02", number: "2", title: "Window, Context, and Frames", file: "js/chapters/gl02.js", blurb: "Create a context, run a render loop, and understand swapping and clearing.", sections: [
        { id: "GL2.1", title: "Window and OpenGL Context", subs: [["GL2.1.1", "GLFW"], ["GL2.1.2", "GLAD"], ["GL2.1.3", "Making a context current"]] },
        { id: "GL2.2", title: "The Render Loop", subs: [["GL2.2.1", "Input"], ["GL2.2.2", "Draw"], ["GL2.2.3", "Events"]] },
        { id: "GL2.3", title: "Hello Triangle", subs: [["GL2.3.1", "Vertex data"], ["GL2.3.2", "Shader program"], ["GL2.3.3", "The draw call"]] },
        { id: "GL2.4", title: "Double Buffering and Swap", subs: [["GL2.4.1", "Front and back buffers"], ["GL2.4.2", "Swap"], ["GL2.4.3", "V-sync"]] },
        { id: "GL2.5", title: "Viewport and Clearing", subs: [["GL2.5.1", "glViewport"], ["GL2.5.2", "Clear colour"], ["GL2.5.3", "Clear masks"]] },
      ] },
      { id: "gl03", number: "3", title: "Vertex Data and Drawing", file: "js/chapters/gl03.js", blurb: "VAOs, VBOs, element buffers, attributes, and draw calls.", sections: [
        { id: "GL3.1", title: "Vertices and Attributes", subs: [["GL3.1.1", "What a vertex stores"], ["GL3.1.2", "Attribute layout"], ["GL3.1.3", "Interleaved vs separate"]] },
        { id: "GL3.2", title: "VAO and VBO", subs: [["GL3.2.1", "Vertex buffer objects"], ["GL3.2.2", "Vertex array objects"], ["GL3.2.3", "The setup recipe"]] },
        { id: "GL3.3", title: "Element Buffer Objects", subs: [["GL3.3.1", "Why indices"], ["GL3.3.2", "EBO binding"], ["GL3.3.3", "glDrawElements"]] },
        { id: "GL3.4", title: "Draw Calls and Primitives", subs: [["GL3.4.1", "Primitive types"], ["GL3.4.2", "glDrawArrays"], ["GL3.4.3", "Winding order"]] },
      ] },
      { id: "gl04", number: "4", title: "Shaders", file: "js/chapters/gl04.js", blurb: "GLSL programs, compile and link, uniforms, and stage communication.", sections: [
        { id: "GL4.1", title: "GPU Shader Programs", subs: [["GL4.1.1", "Vertex shader"], ["GL4.1.2", "Fragment shader"], ["GL4.1.3", "GLSL types"]] },
        { id: "GL4.2", title: "Compile and Link", subs: [["GL4.2.1", "Compile shaders"], ["GL4.2.2", "Link a program"], ["GL4.2.3", "Error logs"]] },
        { id: "GL4.3", title: "Uniforms", subs: [["GL4.3.1", "CPU to GPU constants"], ["GL4.3.2", "Locations"], ["GL4.3.3", "glUniform"]] },
        { id: "GL4.4", title: "Shader Inputs and Outputs", subs: [["GL4.4.1", "in and out"], ["GL4.4.2", "Interpolation"], ["GL4.4.3", "Locations"]] },
      ] },
      { id: "gl05", number: "5", title: "Buffer Objects", file: "js/chapters/gl05.js", blurb: "Buffer targets, uploads, mapping, uniform buffers, and CPU–GPU sync.", sections: [
        { id: "GL5.1", title: "Buffer Types and Targets", subs: [["GL5.1.1", "Named buffer objects"], ["GL5.1.2", "Binding targets"], ["GL5.1.3", "Usage hints"]] },
        { id: "GL5.2", title: "Uploading and Mapping", subs: [["GL5.2.1", "glBufferData"], ["GL5.2.2", "glBufferSubData"], ["GL5.2.3", "glMapBuffer"]] },
        { id: "GL5.3", title: "Uniform Buffer Objects", subs: [["GL5.3.1", "Shared uniforms"], ["GL5.3.2", "Binding points"], ["GL5.3.3", "std140 layout"]] },
        { id: "GL5.4", title: "CPU–GPU Synchronization", subs: [["GL5.4.1", "Asynchronous commands"], ["GL5.4.2", "Readbacks and stalls"], ["GL5.4.3", "Fences"]] },
      ] },
      { id: "gl06", number: "6", title: "Textures", file: "js/chapters/gl06.js", blurb: "Texture objects, units, sampling, filtering, wrapping, and pixel formats.", sections: [
        { id: "GL6.1", title: "Texture Objects", subs: [["GL6.1.1", "Image in VRAM"], ["GL6.1.2", "glTexImage2D"], ["GL6.1.3", "Texture coordinates"]] },
        { id: "GL6.2", title: "Texture Units and Sampling", subs: [["GL6.2.1", "Texture units"], ["GL6.2.2", "Samplers in GLSL"], ["GL6.2.3", "Binding a unit"]] },
        { id: "GL6.3", title: "Filtering and Wrapping", subs: [["GL6.3.1", "Min and mag filters"], ["GL6.3.2", "Wrap modes"], ["GL6.3.3", "Border colour"]] },
        { id: "GL6.4", title: "Mipmaps and Pixel Formats", subs: [["GL6.4.1", "Mipmap chain"], ["GL6.4.2", "Internal formats"], ["GL6.4.3", "Pixel unpack"]] },
      ] },
      { id: "gl07", number: "7", title: "The Framebuffer", file: "js/chapters/gl07.js", blurb: "Default and custom framebuffers, depth, stencil, blending, and face culling.", sections: [
        { id: "GL7.1", title: "Default Framebuffer and FBOs", subs: [["GL7.1.1", "Colour, depth, stencil attachments"], ["GL7.1.2", "Renderbuffers"], ["GL7.1.3", "Off-screen rendering"]] },
        { id: "GL7.2", title: "Depth Testing", subs: [["GL7.2.1", "Depth buffer"], ["GL7.2.2", "Depth functions"], ["GL7.2.3", "Depth write"]] },
        { id: "GL7.3", title: "Stencil Testing", subs: [["GL7.3.1", "Per-pixel mask"], ["GL7.3.2", "Stencil ops"], ["GL7.3.3", "Typical recipes"]] },
        { id: "GL7.4", title: "Blending and Face Culling", subs: [["GL7.4.1", "Blend equation"], ["GL7.4.2", "Alpha"], ["GL7.4.3", "Front and back faces"]] },
      ] },
      { id: "gl08", number: "8", title: "Drawing Efficiently", file: "js/chapters/gl08.js", blurb: "Instancing, cubemaps, extra shader stages, and keeping the GPU fed.", sections: [
        { id: "GL8.1", title: "Instancing", subs: [["GL8.1.1", "One mesh, many copies"], ["GL8.1.2", "Instance attributes"], ["GL8.1.3", "glDrawArraysInstanced"]] },
        { id: "GL8.2", title: "Cubemaps", subs: [["GL8.2.1", "Six faces"], ["GL8.2.2", "Sampling with a direction"], ["GL8.2.3", "Skyboxes"]] },
        { id: "GL8.3", title: "Extra Shader Stages", subs: [["GL8.3.1", "Geometry shader"], ["GL8.3.2", "Tessellation"], ["GL8.3.3", "Compute shaders"]] },
        { id: "GL8.4", title: "Keeping the GPU Busy", subs: [["GL8.4.1", "State-change cost"], ["GL8.4.2", "Batching"], ["GL8.4.3", "CPU vs GPU bound"]] },
      ] },
    ],
  },
  {
    id: "learn-vulkan",
    shortTitle: "Learn Vulkan",
    title: "Learn Vulkan: Modern Low-Overhead Graphics & Compute",
    author: "Learn 3D Math",
    edition: "Vulkan 1.3 Course",
    chapters: [
      { id: "vk01", number: "1", title: "Vulkan Foundations & Architecture", file: "js/chapters/vk01.js", blurb: "What Vulkan is, how it communicates with the GPU, instances, validation layers, physical devices, and queue families.", sections: [
        { id: "VK1.1", title: "Origin of Vulkan & Modern GPU Architecture", subs: [["VK1.1.1", "Driver overhead and explicit control"], ["VK1.1.2", "CPU vs GPU split"], ["VK1.1.3", "Vulkan vs OpenGL"]] },
        { id: "VK1.2", title: "Instance & Validation Layers", subs: [["VK1.2.1", "VkInstance creation"], ["VK1.2.2", "Validation layers"], ["VK1.2.3", "Debug callback setup"]] },
        { id: "VK1.3", title: "Physical Devices & Queue Families", subs: [["VK1.3.1", "Selecting a GPU"], ["VK1.3.2", "Device properties & features"], ["VK1.3.3", "Queue families"]] },
        { id: "VK1.4", title: "Logical Device & Queues", subs: [["VK1.4.1", "VkDevice creation"], ["VK1.4.2", "Queue priorities"], ["VK1.4.3", "Retrieving queue handles"]] },
      ] },
      { id: "vk02", number: "2", title: "Window Surface & Swapchain", file: "js/chapters/vk02.js", blurb: "Connecting Vulkan to the OS window manager, presentation modes, swapchain images, and handling resize/minimization.", sections: [
        { id: "VK2.1", title: "Window Surface & WSI", subs: [["VK2.1.1", "Window system integration"], ["VK2.1.2", "VkSurfaceKHR"], ["VK2.1.3", "Presentation queue support"]] },
        { id: "VK2.2", title: "Swapchain Configuration & Present Modes", subs: [["VK2.2.1", "Surface capabilities & formats"], ["VK2.2.2", "Present modes (FIFO vs Mailbox)"], ["VK2.2.3", "Creating the swapchain"]] },
        { id: "VK2.3", title: "Swapchain Images & Image Views", subs: [["VK2.3.1", "Retrieving swapchain images"], ["VK2.3.2", "VkImageView role"], ["VK2.3.3", "Subresource ranges"]] },
        { id: "VK2.4", title: "Swapchain Recreation & Window Events", subs: [["VK2.4.1", "Window resizing and minimization"], ["VK2.4.2", "Out of date and suboptimal swapchain"], ["VK2.4.3", "Deadlock avoidance with fences"]] },
      ] },
      { id: "vk03", number: "3", title: "Pipeline & Render Passes", file: "js/chapters/vk03.js", blurb: "Immutable pipeline state objects, SPIR-V bytecode, fixed-function stages, render passes, subpasses, and framebuffers.", sections: [
        { id: "VK3.1", title: "Graphics Pipeline Basics & SPIR-V", subs: [["VK3.1.1", "Pipeline state immutability"], ["VK3.1.2", "SPIR-V bytecode"], ["VK3.1.3", "VkShaderModule & stage creation"]] },
        { id: "VK3.2", title: "Fixed-Function Pipeline Stages", subs: [["VK3.2.1", "Vertex input & input assembly"], ["VK3.2.2", "Dynamic viewport & scissor"], ["VK3.2.3", "Rasterizer & color blending"]] },
        { id: "VK3.3", title: "Render Passes & Subpasses", subs: [["VK3.3.1", "Attachments & load/store ops"], ["VK3.3.2", "Subpasses"], ["VK3.3.3", "Subpass dependencies"]] },
        { id: "VK3.4", title: "Framebuffers & Pipeline Layout", subs: [["VK3.4.1", "VkPipelineLayout"], ["VK3.4.2", "VkFramebuffer creation"], ["VK3.4.3", "Baking the graphics pipeline"]] },
      ] },
      { id: "vk04", number: "4", title: "Command Recording & Synchronization", file: "js/chapters/vk04.js", blurb: "Command pools, recording draw commands, semaphores, fences, and pipelining frames in flight.", sections: [
        { id: "VK4.1", title: "Command Pools & Command Buffers", subs: [["VK4.1.1", "VkCommandPool & queue families"], ["VK4.1.2", "Primary vs secondary command buffers"], ["VK4.1.3", "Buffer allocation & reset modes"]] },
        { id: "VK4.2", title: "Recording Drawing Commands", subs: [["VK4.2.1", "vkBeginCommandBuffer"], ["VK4.2.2", "Render pass & draw commands"], ["VK4.2.3", "Ending command recording"]] },
        { id: "VK4.3", title: "Synchronization: Semaphores & Fences", subs: [["VK4.3.1", "GPU-GPU sync with semaphores"], ["VK4.3.2", "CPU-GPU sync with fences"], ["VK4.3.3", "Acquire, submit, and present flow"]] },
        { id: "VK4.4", title: "Frames in Flight & CPU–GPU Overlap", subs: [["VK4.4.1", "Why frames in flight"], ["VK4.4.2", "Resource duplication per frame"], ["VK4.4.3", "The complete render loop"]] },
      ] },
      { id: "vk05", number: "5", title: "Memory Management & Buffers", file: "js/chapters/vk05.js", blurb: "Vulkan memory heaps, staging buffers, memory allocation, vertex buffers, and index buffers.", sections: [
        { id: "VK5.1", title: "Vulkan Memory Architecture", subs: [["VK5.1.1", "Memory heaps & types"], ["VK5.1.2", "Device local vs host visible"], ["VK5.1.3", "Memory requirements & allocation"]] },
        { id: "VK5.2", title: "Staging Buffers & Memory Transfers", subs: [["VK5.2.1", "Why staging buffers"], ["VK5.2.2", "Single-time command buffers"], ["VK5.2.3", "vkCmdCopyBuffer"]] },
        { id: "VK5.3", title: "Vertex Buffers & Attributes", subs: [["VK5.3.1", "Vertex input bindings & attributes"], ["VK5.3.2", "Allocating vertex buffers"], ["VK5.3.3", "vkCmdBindVertexBuffers"]] },
        { id: "VK5.4", title: "Index Buffers & Geometry Reuse", subs: [["VK5.4.1", "Why index buffers"], ["VK5.4.2", "Creating device local index buffer"], ["VK5.4.3", "vkCmdDrawIndexed"]] },
      ] },
      { id: "vk06", number: "6", title: "Resource Descriptors & Uniforms", file: "js/chapters/vk06.js", blurb: "Uniform buffer objects, descriptor set layouts, pools, sets, persistent mapping, alignment, and push constants.", sections: [
        { id: "VK6.1", title: "Descriptors & Set Layouts", subs: [["VK6.1.1", "What are descriptors"], ["VK6.1.2", "VkDescriptorSetLayout"], ["VK6.1.3", "Pipeline layout integration"]] },
        { id: "VK6.2", title: "Uniform Buffer Objects (UBO)", subs: [["VK6.2.1", "UBO creation per frame in flight"], ["VK6.2.2", "Persistent mapping with vkMapMemory"], ["VK6.2.3", "Updating uniforms every frame"]] },
        { id: "VK6.3", title: "Descriptor Pools & Sets", subs: [["VK6.3.1", "VkDescriptorPool"], ["VK6.3.2", "Allocating & updating descriptor sets"], ["VK6.3.3", "vkCmdBindDescriptorSets"]] },
        { id: "VK6.4", title: "Memory Alignment & Push Constants", subs: [["VK6.4.1", "std140 alignment requirements"], ["VK6.4.2", "alignas and padding gotchas"], ["VK6.4.3", "Push constants for small uniforms"]] },
      ] },
      { id: "vk07", number: "7", title: "Images, Textures & Samplers", file: "js/chapters/vk07.js", blurb: "VkImage, optimal tiling, pipeline barriers, layout transitions, staging copies, samplers, and combined image samplers.", sections: [
        { id: "VK7.1", title: "Images & Optimal Tiling", subs: [["VK7.1.1", "VkImage vs VkBuffer"], ["VK7.1.2", "Linear vs optimal tiling"], ["VK7.1.3", "Image creation & memory allocation"]] },
        { id: "VK7.2", title: "Image Layout Transitions & Barriers", subs: [["VK7.2.1", "Image layouts in Vulkan"], ["VK7.2.2", "VkImageMemoryBarrier"], ["VK7.2.3", "Pipeline stages & access masks"]] },
        { id: "VK7.3", title: "Buffer-to-Image Copy & Staging", subs: [["VK7.3.1", "Staging image data in host buffer"], ["VK7.3.2", "vkCmdCopyBufferToImage"], ["VK7.3.3", "Shader read-only transition"]] },
        { id: "VK7.4", title: "Image Views & Texture Samplers", subs: [["VK7.4.1", "VkImageView for textures"], ["VK7.4.2", "VkSampler & filtering modes"], ["VK7.4.3", "Combined image samplers in shaders"]] },
      ] },
      { id: "vk08", number: "8", title: "Depth, Geometry & Quality", file: "js/chapters/vk08.js", blurb: "Depth buffers, depth-stencil states, loading 3D OBJ models, vertex deduplication, mipmaps, and MSAA.", sections: [
        { id: "VK8.1", title: "Depth Buffering Fundamentals", subs: [["VK8.1.1", "Depth testing necessity"], ["VK8.1.2", "Finding supported depth formats"], ["VK8.1.3", "Depth image & view setup"]] },
        { id: "VK8.2", title: "Depth Render Pass & Pipeline State", subs: [["VK8.2.1", "Depth attachment in render pass"], ["VK8.2.2", "Depth stencil pipeline state"], ["VK8.2.3", "Clear values & depth tests"]] },
        { id: "VK8.3", title: "Model Loading & Vertex Deduplication", subs: [["VK8.3.1", "Loading OBJ models"], ["VK8.3.2", "Vertex deduplication with hash maps"], ["VK8.3.3", "Cache locality & large meshes"]] },
        { id: "VK8.4", title: "Mipmapping & Multisampling (MSAA)", subs: [["VK8.4.1", "Mip level generation via vkCmdBlitImage"], ["VK8.4.2", "MSAA sample counts"], ["VK8.4.3", "Multisample resolve attachment"]] },
      ] },
      { id: "vk09", number: "9", title: "Compute Shaders & GPU Workloads", file: "js/chapters/vk09.js", blurb: "Compute pipelines, workgroups, invocations, vkCmdDispatch, shader storage buffers (SSBOs), and graphics-compute sync.", sections: [
        { id: "VK9.1", title: "Compute Shaders & GPGPU Architecture", subs: [["VK9.1.1", "General purpose computing on GPU"], ["VK9.1.2", "Graphics vs Compute pipeline separation"], ["VK9.1.3", "Compute queue families"]] },
        { id: "VK9.2", title: "Workgroups, Invocations & Dispatch", subs: [["VK9.2.1", "Workgroup grid & local sizes"], ["VK9.2.2", "gl_GlobalInvocationID"], ["VK9.2.3", "vkCmdDispatch"]] },
        { id: "VK9.3", title: "Shader Storage Buffer Objects (SSBO)", subs: [["VK9.3.1", "Arbitrary read/write GPU buffers"], ["VK9.3.2", "Dual buffer usage flags"], ["VK9.3.3", "GPU particle simulation"]] },
        { id: "VK9.4", title: "Graphics & Compute Synchronization", subs: [["VK9.4.1", "Read-after-write hazards"], ["VK9.4.2", "Compute-graphics semaphore synchronization"], ["VK9.4.3", "Pipelined particle drawing"]] },
      ] },
    ],
  },
];
