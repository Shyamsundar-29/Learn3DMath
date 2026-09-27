const slug = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const chapterPaths = { "Transforms": "chapter-04", "Geometry for 3D Engines": "chapter-05", "Ray Tracing": "chapter-06", "Lighting and Shading": "chapter-07", "Visibility Determination": "chapter-08", "Polygonal Techniques": "chapter-09", "Shadows": "chapter-10", "Curves and Surfaces": "chapter-11", "Collision Detection": "chapter-12", "Linear Physics": "chapter-13", "Rotational Physics": "chapter-14", "Fluid and Cloth Simulation": "chapter-15", "Numerical Methods": "chapter-16" };
const plannedTopics = (chapterTitle, titles) => titles.map((title) => ({
  id: `${slug(chapterTitle)}-${slug(title)}`, title, type: "Interactive math lab", duration: "10 min",
  simulation: `simulations/${chapterPaths[chapterTitle]}/${slug(title)}.html`,
  summary: `Experiment with the values behind ${title} and follow the calculation as it changes.`,
  keyIdea: `The visual and the live calculation panel describe the same changing mathematical result.`,
  prompts: ["Which control changes the result most?", "Can you predict the next calculation before moving a control?"],
}));

window.library = [{
  id: "math-3d", title: "Mathematics for 3D Game Programming", author: "Eric Lengyel", color: "#7dd3fc",
  chapters: [
    { id: "rendering-pipeline", number: "01", title: "The Rendering Pipeline", status: "in-progress", topics: [
      { id: "graphics-processors", title: "Graphics Processors", simulation: "simulations/chapter-01/graphics-processors.html", type: "Flow explorer", duration: "8 min", summary: "Follow the work from your CPU command to millions of parallel GPU calculations and finally to the display.", keyIdea: "A GPU is designed to repeat small, similar calculations across a huge number of pixels and vertices at the same time.", prompts: ["Why does a game send draw calls instead of drawing pixels itself?", "Which parts of this path are massively parallel?"] },
      { id: "vertex-transformation", title: "Vertex Transformation", simulation: "simulations/chapter-01/vertex-transformation.html", type: "Coordinate-space lab", duration: "14 min", summary: "Move one triangle through object, world, view, and clip space. Change the model transform and watch every coordinate change.", keyIdea: "A vertex is not moved through the world; its coordinates are re-expressed in a sequence of coordinate systems.", prompts: ["What stays the same when the triangle changes coordinate spaces?", "Why must the camera transform be applied before perspective division?"] },
      { id: "rasterization", title: "Rasterization and Fragment Operations", simulation: "simulations/chapter-01/rasterization.html", type: "Pixel pipeline lab", duration: "16 min", summary: "Rotate a cube, cull hidden faces, and see how depth testing chooses the fragments that become visible pixels.", keyIdea: "Rasterization converts triangle coverage into fragments; fragment operations decide which fragments may update the framebuffer.", prompts: ["What changes when backface culling is disabled?", "Why does the depth test prevent far faces from painting over near ones?"] },
      { id: "Buffer", title: "Buffer", simulation: "simulations/chapter-01/Buffers.html", type: "Pixel pipeline lab", duration: "16 min", summary: "Rotate a cube, cull hidden faces, and see how depth testing chooses the fragments that become visible pixels.", keyIdea: "Rasterization converts triangle coverage into fragments; fragment operations decide which fragments may update the framebuffer.", prompts: ["What changes when backface culling is disabled?", "Why does the depth test prevent far faces from painting over near ones?"] },
    ]},
    { id: "vectors", number: "02", title: "Vectors", status: "planned", topics: /*plannedTopics("Vectors", ["Vector Properties", "The Dot Product", "The Cross Product", "Vector Spaces"])*/
    [
        { 
        id: "vector-properties", 
        title: "Vector Properties", 
        simulation: "simulations/chapter-02/Vector-Visualizer.html", 
        type: "Vector lab", 
        duration: "10 min", 
        summary: "Visualize vectors in 3D space, manipulating components directly to observe magnitude, scaling, and geometric addition.", 
        keyIdea: "A vector represents a directional displacement in space independent of any absolute origin position.", 
        prompts: ["What remains invariant when you translate a vector without changing its components?", "How does changing a single coordinate scalar affect the vector's Euclidean norm?"] 
      },
       { 
        id: "orientation", 
        title: "Orientation", 
        simulation: "simulations/chapter-02/Orientation-Lab.html", 
        type: "3D handedness lab", 
        duration: "10 min", 
        summary: "Rotate base axes in 3D space to test how the right-hand rule defines positive coordinate systems and vertex wrapping orders.", 
        keyIdea: "Orientation determines the 'handedness' of a coordinate system, dictating whether standard rotations twist clockwise or counterclockwise.", 
        prompts: ["How does flipping the direction of a single axis change a system from right-handed to left-handed?", "Why does polygon vertex order (clockwise vs. counterclockwise) determine which way a surface faces?"] 
      },
      { 
        id: "orientation-3D", 
        title: "Orientation-3D", 
        simulation: "simulations/chapter-02/Orientation-Lab-3D.html", 
        type: "3D handedness lab", 
        duration: "10 min", 
        summary: "Rotate base axes in 3D space to test how the right-hand rule defines positive coordinate systems and vertex wrapping orders.", 
        keyIdea: "Orientation determines the 'handedness' of a coordinate system, dictating whether standard rotations twist clockwise or counterclockwise.", 
        prompts: ["How does flipping the direction of a single axis change a system from right-handed to left-handed?", "Why does polygon vertex order (clockwise vs. counterclockwise) determine which way a surface faces?"] 
      },
      { 
        id: "the-dot-product", 
        title: "The Dot Product", 
        simulation: "simulations/chapter-02/dot_product_sim.html", 
        type: "Projection explorer", 
        duration: "12 min", 
        summary: "Interact with two directional vectors to analyze scalar projection, cosine relationships, and orthogonality criteria.", 
        keyIdea: "The dot product measures directional alignment, returning a positive scalar when vectors point together and zero when perfectly perpendicular.", 
        prompts: ["Why is the dot product of two normalized vectors bounded between -1 and 1?", "How can you use the sign of a dot product to check if a polygon face is pointing away from a camera?"] 
      },
      { 
        id: "the-cross-product", 
        title: "The Cross Product", 
        simulation: "simulations/chapter-02/cross_product_sim.html", 
        type: "3D orienter lab", 
        duration: "14 min", 
        summary: "Generate and rotate perpendicular normal vectors in 3D space using the right-hand rule and torque magnitude interactions.", 
        keyIdea: "The cross product generates a third vector perpendicular to both inputs, with a length equal to the area of their spanned parallelogram.", 
        prompts: ["What happens to the direction of the resulting vector if you swap the operand execution order?", "How is the cross product useful for determining surface normals on a 3D mesh triangle?"] 
      },
      { 
        id: "vector-spaces", 
        title: "Vector Spaces", 
        simulation: "simulations/chapter-02/gram_schmidt_sim.html", 
        type: "Orthogonalizer workbench", 
        duration: "15 min", 
        summary: "Step through the sequential processes of Gram-Schmidt orthogonalization to transform an arbitrary linear basis into an orthonormal set.", 
        keyIdea: "An orthonormal basis stabilizes floating-point transformations because its component axes are mutually perpendicular and unit-length.", 
        prompts: ["Why does the Gram-Schmidt process require subtracting vector projections sequentially?", "What are the computational advantages of working within an orthonormal frame?"] 
      }

    ]},
    { id: "matrices", number: "03", title: "Matrices", status: "planned", topics: /*plannedTopics("Matrices", ["Matrix Properties", "Linear Systems", "Matrix Inverses", "Determinants", "Eigenvalues and Eigenvectors", "Diagonalization"])*/
    [
     { 
        id: "matrix-properties", 
        title: "Matrix Properties", 
        simulation: "simulations/chapter-03/matrix_properties.html", 
        type: "Planned visual lesson", 
        duration: "Coming soon",
        summary: "A place for your notes, examples, and future interactive visual for Matrix Properties.",
        keyIdea: "Add your own explanation of Matrix Properties as you study this section.",
        prompts: ["What is the central idea of this section?", "Which equation or picture would make it easier to remember?"]
      },
      { 
        id: "linear-systems", 
        title: "Linear Systems", 
        simulation: "simulations/chapter-03/linear_systems.html", 
        type: "Planned visual lesson", 
        duration: "Coming soon",
        summary: "A place for your notes, examples, and future interactive visual for Linear Systems.",
        keyIdea: "Add your own explanation of Linear Systems as you study this section.",
        prompts: ["What is the central idea of this section?", "Which equation or picture would make it easier to remember?"]
      },
      { 
        id: "matrix-inverses", 
        title: "Matrix Inverses", 
        simulation: "simulations/chapter-03/matrix_inverses.html", 
        type: "Planned visual lesson", 
        duration: "Coming soon",
        summary: "A place for your notes, examples, and future interactive visual for Matrix Inverses.",
        keyIdea: "Add your own explanation of Matrix Inverses as you study this section.",
        prompts: ["What is the central idea of this section?", "Which equation or picture would make it easier to remember?"]
      },
      { 
        id: "determinants", 
        title: "Determinants", 
        simulation: "simulations/chapter-03/determinants.html", 
        type: "Planned visual lesson", 
        duration: "Coming soon",
        summary: "A place for your notes, examples, and future interactive visual for Determinants.",
        keyIdea: "Add your own explanation of Determinants as you study this section.",
        prompts: ["What is the central idea of this section?", "Which equation or picture would make it easier to remember?"]
      },
      {
        id: "determinant-3d",
        title: "3D Determinants",
        simulation: "simulations/chapter-03/determinant-3d.html",
        type: "3D volume explorer",
        duration: "12 min",
        summary: "Change three 3D vectors and see the determinant become the signed volume they enclose.",
        keyIdea: "A 3D determinant measures signed volume; a value of zero means the three vectors are flat (coplanar).",
        prompts: ["What happens to the volume when two vectors point in the same direction?", "Why does the determinant’s sign matter?"]
      },
      { 
        id: "eigenvalues-and-eigenvectors", 
        title: "Eigenvalues and Eigenvectors", 
        simulation: "simulations/chapter-03/eigen.html", 
        type: "Planned visual lesson", 
        duration: "Coming soon",
        summary: "A place for your notes, examples, and future interactive visual for Eigenvalues and Eigenvectors.",
        keyIdea: "Add your own explanation of Eigenvalues and Eigenvectors as you study this section.",
        prompts: ["What is the central idea of this section?", "Which equation or picture would make it easier to remember?"]
      },
      { 
        id: "diagonalization", 
        title: "Diagonalization", 
        simulation: "simulations/chapter-03/diagonalization.html", 
        type: "Planned visual lesson", 
        duration: "Coming soon",
        summary: "A place for your notes, examples, and future interactive visual for Diagonalization.",
        keyIdea: "Add your own explanation of Diagonalization as you study this section.",
        prompts: ["What is the central idea of this section?", "Which equation or picture would make it easier to remember?"]
      }
    ]},
    { id: "transforms", number: "04", title: "Transforms", status: "planned", topics: plannedTopics("Transforms", ["Linear Transformations", "Orthogonal Matrices", "Handedness", "Scaling Transforms", "Rotation Transforms", "Rotation About an Arbitrary Axis", "Homogeneous Coordinates", "Four-Dimensional Transforms", "Points and Directions", "Geometrical Interpretation of the w Coordinate", "Transforming Normal Vectors", "Quaternions", "Quaternion Mathematics", "Rotations with Quaternions", "Spherical Linear Interpolation"]) },
    { id: "geometry", number: "05", title: "Geometry for 3D Engines", status: "planned", topics: plannedTopics("Geometry for 3D Engines", ["Lines in 3D Space", "Distance Between a Point and a Line", "Distance Between Two Lines", "Planes in 3D Space", "Intersection of a Line and a Plane", "Intersection of Three Planes", "Transforming Planes", "The View Frustum", "Field of View", "Frustum Planes", "Perspective-Correct Interpolation", "Depth Interpolation", "Vertex Attribute Interpolation", "Projections", "Perspective Projections", "Orthographic Projections", "Extracting Frustum Planes", "Reflections and Oblique Clipping"]) },
    { id: "ray-tracing", number: "06", title: "Ray Tracing", status: "planned", topics: plannedTopics("Ray Tracing", ["Root Finding", "Quadratic Polynomials", "Cubic Polynomials", "Quartic Polynomials", "Newton's Method", "Refinement of Reciprocals and Square Roots", "Surface Intersections", "Intersection of a Ray and a Triangle", "Intersection of a Ray and a Box", "Intersection of a Ray and a Sphere", "Intersection of a Ray and a Cylinder", "Intersection of a Ray and a Torus", "Normal Vector Calculation", "Reflection and Refraction Vectors", "Reflection Vector Calculation", "Refraction Vector Calculation"]) },
    { id: "lighting", number: "07", title: "Lighting and Shading", status: "planned", topics: plannedTopics("Lighting and Shading", ["RGB Color", "Light Sources", "Ambient Light", "Directional Light Sources", "Point Light Sources", "Spot Light Sources", "Diffuse Reflection", "Specular Reflection", "Texture Mapping", "Standard Texture Maps", "Projective Texture Maps", "Cube Texture Maps", "Filtering and Mipmaps", "Emission", "Shading Models", "Calculating Normal Vectors", "Gouraud Shading", "Blinn-Phong Shading", "Bump Mapping", "Bump Map Construction", "Tangent Space", "Calculating Tangent Vectors", "Implementation", "A Physical Reflection Model", "Bidirectional Reflectance Distribution Functions", "Cook-Torrance Illumination", "The Fresnel Factor", "The Microfacet Distribution Function", "The Geometrical Attenuation Factor"]) },
    { id: "visibility", number: "08", title: "Visibility Determination", status: "planned", topics: plannedTopics("Visibility Determination", ["Bounding Volume Construction", "Principal Component Analysis", "Bounding Box Construction", "Bounding Sphere Construction", "Bounding Ellipsoid Construction", "Bounding Cylinder Construction", "Bounding Volume Tests", "Bounding Sphere Test", "Bounding Ellipsoid Test", "Bounding Cylinder Test", "Bounding Box Test", "Spatial Partitioning", "Octrees", "Binary Space Partitioning Trees", "Portal Systems", "Portal Clipping", "Reduced View Frustums"]) },
    { id: "polygonal", number: "09", title: "Polygonal Techniques", status: "planned", topics: plannedTopics("Polygonal Techniques", ["Depth Value Offset", "Projection Matrix Modification", "Offset Value Selection", "Implementation", "Decal Application", "Decal Mesh Construction", "Polygon Clipping", "Billboarding", "Unconstrained Quads", "Constrained Quads", "Polyboards", "Polygon Reduction", "T-Junction Elimination", "Triangulation"]) },
    { id: "shadows", number: "10", title: "Shadows", status: "planned", topics: plannedTopics("Shadows", ["Shadow Casting Set", "Shadow Mapping", "Rendering the Shadow Map", "Rendering the Main Scene", "Self-Shadowing", "Stencil Shadows", "Algorithm Overview", "Infinite View Frustums", "Silhouette Determination", "Shadow Volume Construction", "Determining Cap Necessity", "Rendering Shadow Volumes", "Scissor Optimization"]) },
    { id: "curves", number: "11", title: "Curves and Surfaces", status: "planned", topics: plannedTopics("Curves and Surfaces", ["Cubic Curves", "Hermite Curves", "Bezier Curves", "Cubic Bezier Curves", "Bezier Curve Truncation", "The de Casteljau Algorithm", "Catmull-Rom Splines", "Cubic Splines", "B-Splines", "Uniform B-Splines", "B-Spline Globalization", "Nonuniform B-Splines", "NURBS", "Bicubic Surfaces", "Curvature and Torsion"]) },
    { id: "collision", number: "12", title: "Collision Detection", status: "planned", topics: plannedTopics("Collision Detection", ["Plane Collisions", "Collision of a Sphere and a Plane", "Collision of a Box and a Plane", "Spatial Partitioning", "General Sphere Collisions", "Sliding", "Collision of Two Spheres"]) },
    { id: "linear-physics", number: "13", title: "Linear Physics", status: "planned", topics: plannedTopics("Linear Physics", ["Position Functions", "Second-Order Differential Equations", "Homogeneous Equations", "Nonhomogeneous Equations", "Initial Conditions", "Projectile Motion", "Resisted Motion", "Friction"]) },
    { id: "rotational-physics", number: "14", title: "Rotational Physics", status: "planned", topics: plannedTopics("Rotational Physics", ["Rotating Environments", "Angular Velocity", "The Centrifugal Force", "The Coriolis Force", "Rigid Body Motion", "Center of Mass", "Angular Momentum and Torque", "The Inertia Tensor", "Principal Axes of Inertia", "Transforming the Inertia Tensor", "Oscillatory Motion", "Spring Motion", "Pendulum Motion"]) },
    { id: "fluid-cloth", number: "15", title: "Fluid and Cloth Simulation", status: "planned", topics: plannedTopics("Fluid and Cloth Simulation", ["Fluid Simulation", "The Wave Equation", "Approximating Derivatives", "Evaluating Surface Displacement", "Implementation", "Cloth Simulation", "The Spring System", "External Forces"]) },
    { id: "numerical-methods", number: "16", title: "Numerical Methods", status: "planned", topics: plannedTopics("Numerical Methods", ["Trigonometric Functions", "Linear Systems", "Triangular Systems", "Gaussian Elimination", "LU Decomposition", "Error Reduction", "Tridiagonal Systems", "Eigenvalues and Eigenvectors", "Ordinary Differential Equations", "Euler's Method", "Taylor Series Method", "Runge-Kutta Method", "Higher-Order Differential Equations"]) },
  ],
}];
