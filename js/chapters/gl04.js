// Learn OpenGL — Chapter 4: Shaders
(function () {
  "use strict";
  const { fmt } = L3D.math;

  L3D.topic({
    id: "GL4.1",
    summary: "Shaders are GLSL programs that run on the GPU. A vertex shader places each vertex; a fragment shader chooses each pixel colour.",
    lesson: String.raw`
      <p>A <strong>shader</strong> is a small program written in <strong>GLSL</strong> (OpenGL Shading Language). You compile it on the GPU driver, attach it to a <strong>program</strong> object, and bind that program with <code>glUseProgram</code>. From then on, every draw uses those GPU functions.</p>
      <div class="key"><p>Vertex shader: where does this corner go? Fragment shader: what colour is this pixel?</p></div>

      <h2 data-sub="GL4.1.1">Vertex shader</h2>
      <p>Runs once per vertex. Inputs are attributes from the VAO. The required output is <code>gl_Position</code>, a <code>vec4</code> in clip space. Extra <code>out</code> variables (colour, uv) are interpolated across the primitive for the fragment shader.</p>
      <p>A pass-through vertex shader can forward an already-transformed NDC position. A real game multiplies by model, view, and projection matrices — those matrices are <em>uniforms</em> you upload. The matrix math is in the other book; the API is <code>glUniformMatrix4fv</code>.</p>

      <h2 data-sub="GL4.1.2">Fragment shader</h2>
      <p>Runs once per fragment (candidate pixel). It writes at least one colour to an <code>out vec4</code>. It can also discard, write depth, or output to several colour attachments (MRT).</p>

      <h2 data-sub="GL4.1.3">GLSL types</h2>
      <p>Common types: <code>float</code>, <code>vec2/3/4</code>, <code>mat3/4</code>, <code>sampler2D</code>, <code>int</code>, <code>bool</code>. Vectors have swizzles (<code>uv.xy</code>). Functions look like C. Version line first: <code>#version 330 core</code>.</p>
      <div class="game">Lighting models, texturing, and post-process are all fragment-shader code plus the textures and uniforms you bind.</div>
      <p><a class="btn goto-sim" href="#/GL4.1/sim">Try it: change the fragment colour →</a></p>
    `,
    keyFormulas: [
      ["Stages", String.raw`\text{VS}(\text{vertex})\ \rightarrow\ \text{rasterize}\ \rightarrow\ \text{FS}(\text{fragment})`],
    ],
    exercises: [
      { q: "What must a vertex shader write?", a: "gl_Position, a vec4 clip-space position." },
      { q: "Does the fragment shader run once per triangle?", a: "No. Once per covered fragment (roughly per pixel, more with MSAA)." },
      { q: "Where do sampler2D uniforms get their image?", a: "From the texture bound to the texture unit the uniform names." },
    ],
    cpp: [{
      title: "A tiny fragment shader",
      note: "<p>Every fragment becomes the same orange. Real shaders sample textures and lights.</p>",
      code: String.raw`
const char* kFragmentSrc = R"(
#version 330 core
out vec4 FragColor;
void main()
{
    FragColor = vec4(1.0, 0.5, 0.2, 1.0);
}
)";
`,
    }],
    csharp: [{
      title: "A tiny fragment shader",
      code: String.raw`
public const string FragmentSrc = @"
#version 330 core
out vec4 FragColor;
void main()
{
    FragColor = vec4(1.0, 0.5, 0.2, 1.0);
}
";
`,
    }],
    sims: [{ title: "Shader stage story", help: "<p>The vertex shader places three corners. The fragment shader paints the interior. Change its colour.</p>", mount: shaderStory }],
  });

  L3D.topic({
    id: "GL4.2",
    summary: "Compile each shader object, attach them to a program, link, then use. Always check compile and link logs; GLSL errors do not throw C++ exceptions.",
    lesson: String.raw`
      <p>GLSL source is a string in your program (or a file you load). OpenGL does not read <code>.vert</code> files by itself. You create shader objects, upload source, compile, then link.</p>
      <div class="key"><p>Compile shaders → attach → link program → <code>glUseProgram</code>. Delete shader objects after a successful link if you like; the program keeps the machine code.</p></div>

      <h2 data-sub="GL4.2.1">Compile shaders</h2>
      <ol>
        <li><code>GLuint vs = glCreateShader(GL_VERTEX_SHADER);</code></li>
        <li><code>glShaderSource(vs, 1, &amp;src, nullptr);</code></li>
        <li><code>glCompileShader(vs);</code></li>
        <li><code>glGetShaderiv(vs, GL_COMPILE_STATUS, &amp;ok);</code> and on failure <code>glGetShaderInfoLog</code></li>
      </ol>
      <p>Repeat with <code>GL_FRAGMENT_SHADER</code>. Geometry and compute shaders use other type enums.</p>

      <h2 data-sub="GL4.2.2">Link a program</h2>
      <p><code>glCreateProgram</code>, <code>glAttachShader</code> for each stage, <code>glLinkProgram</code>, then check <code>GL_LINK_STATUS</code>. Linking matches <code>in</code>/<code>out</code> names (or locations) between stages and assigns uniform locations.</p>

      <h2 data-sub="GL4.2.3">Error logs</h2>
      <p>A missing semicolon in GLSL leaves you with a black screen unless you print the log. Treat compile/link failure like a C++ compiler error: stop and read the message. After link, <code>glDetachShader</code> / <code>glDeleteShader</code> keeps the program.</p>
      <div class="warn">Using a program that failed to link is undefined. Check the status bit every time you load shaders.</div>
      <p><a class="btn goto-sim" href="#/GL4.2/sim">Try it: walk compile and link →</a></p>
    `,
    keyFormulas: [
      ["Build", String.raw`\text{create}\rightarrow\text{source}\rightarrow\text{compile}\rightarrow\text{attach}\rightarrow\text{link}\rightarrow\text{use}`],
    ],
    exercises: [
      { q: "Who compiles GLSL: your C++ compiler, or the driver?", a: "The driver, at glCompileShader time." },
      { q: "Can you delete shader objects after linking?", a: "Yes. The program has the linked executable. Detach/delete is optional cleanup." },
      { q: "Why can in/out names cause a link error?", a: "If the vertex shader outs a name the fragment shader does not declare (or types differ), link fails." },
    ],
    cpp: [{
      title: "Compile one shader and check the log",
      code: String.raw`
GLuint CompileShader(GLenum type, const char* src)
{
    GLuint id = glCreateShader(type);
    glShaderSource(id, 1, &src, nullptr);
    glCompileShader(id);
    GLint ok = 0;
    glGetShaderiv(id, GL_COMPILE_STATUS, &ok);
    if (!ok)
    {
        char log[1024];
        glGetShaderInfoLog(id, 1024, nullptr, log);
        // Print log, then glDeleteShader(id) and return 0.
    }
    return id;
}
`,
    }],
    csharp: [{
      title: "Compile one shader and check the log",
      code: String.raw`
public static int CompileShader(ShaderType type, string src)
{
    int id = GL.CreateShader(type);
    GL.ShaderSource(id, src);
    GL.CompileShader(id);
    GL.GetShader(id, ShaderParameter.CompileStatus, out int ok);
    if (ok == 0)
    {
        string log = GL.GetShaderInfoLog(id);
        // Print log, then GL.DeleteShader(id) and return 0.
    }
    return id;
}
`,
    }],
    sims: [{ title: "Compile and link checklist", help: "<p>Tick each GPU-program step. The program is drawable only after a successful link.</p>", mount: compileLink }],
  });

  L3D.topic({
    id: "GL4.3",
    summary: "Uniforms are values the CPU sets per draw (or per frame) that every shader invocation can read: colours, matrices, time, light counts.",
    lesson: String.raw`
      <p>Attributes change per vertex. <strong>Uniforms</strong> stay constant for the whole draw call (or whole program, until you change them). They are how the CPU talks to a running shader without rebuilding the GLSL.</p>
      <div class="key"><p>Look up a location once. Each frame (or each object) call <code>glUniform*</code> while the program is in use.</p></div>

      <h2 data-sub="GL4.3.1">CPU to GPU constants</h2>
      <p>Examples: a tint colour, a model matrix, <code>uTime</code>, a texture-unit index. Declared in GLSL as <code>uniform vec3 uColor;</code> — no <code>in</code>/<code>out</code>.</p>

      <h2 data-sub="GL4.3.2">Locations</h2>
      <p><code>int loc = glGetUniformLocation(program, "uColor");</code> returns \(-1\) if the compiler optimized the uniform away (you never used it). You can also assign <code>layout(location = 2) uniform vec3 uColor;</code> in GLSL 4.3+ / extensions; 3.3 often uses the query.</p>
      <p>Cache locations after link. Do not query by name every draw in a hot loop.</p>

      <h2 data-sub="GL4.3.3">glUniform</h2>
      <p>Families: <code>glUniform1f/2f/3f/4f</code>, <code>glUniform1i</code> (samplers and ints), <code>glUniformMatrix4fv(loc, 1, GL_FALSE, ptr)</code>. The <code>GL_FALSE</code> means “the pointer is already column-major,” which matches both OpenGL and this site's C++ matrices.</p>
      <p>The uniform call writes into the <em>currently used program</em> (or you can use <code>glProgramUniform*</code> in DSA-style GL 4.1). Bind the program first.</p>
      <div class="note">Many uniforms that all shaders share (camera matrices) belong in a <strong>uniform buffer object</strong> — Chapter 5 — so you upload once.</div>
      <p><a class="btn goto-sim" href="#/GL4.3/sim">Try it: a uniform tint →</a></p>
    `,
    keyFormulas: [
      ["Set vec3", String.raw`\text{glUniform3f}(\text{loc}, r, g, b)`],
      ["Set mat4", String.raw`\text{glUniformMatrix4fv}(\text{loc}, 1, \text{GL\_FALSE}, m)`],
    ],
    exercises: [
      { q: "glGetUniformLocation returns −1. What does that mean?", a: "No active uniform with that name — typo, or the compiler removed an unused uniform." },
      { q: "Must the program be bound for glUniform3f?", a: "Yes for the classic glUniform* entry points." },
      { q: "Why is GL_FALSE passed to glUniformMatrix4fv here?", a: "Our CPU matrices are already column-major, OpenGL's native layout. True would transpose on upload." },
    ],
    cpp: [{
      title: "Set a colour uniform",
      code: String.raw`
void SetTint(GLuint program, float r, float g, float b)
{
    glUseProgram(program);
    GLint loc = glGetUniformLocation(program, "uColor");
    if (loc >= 0) glUniform3f(loc, r, g, b);
}
`,
    }],
    csharp: [{
      title: "Set a colour uniform",
      code: String.raw`
public static void SetTint(int program, float r, float g, float b)
{
    GL.UseProgram(program);
    int loc = GL.GetUniformLocation(program, "uColor");
    if (loc >= 0) GL.Uniform3(loc, r, g, b);
}
`,
    }],
    sims: [{ title: "Uniform tint", help: "<p>Sliders are CPU values. The fragment shader reads uColor as a uniform, so the whole triangle changes at once.</p>", mount: uniformTint }],
  });

  L3D.topic({
    id: "GL4.4",
    summary: "Shader stages pass data with in/out variables. The rasterizer interpolates vertex outs across the triangle before the fragment shader sees them.",
    lesson: String.raw`
      <p>A vertex shader <code>out vec3 vColor</code> and a fragment shader <code>in vec3 vColor</code> (same name, or matching locations) form a pipe. The GPU interpolates <code>vColor</code> for every pixel inside the triangle.</p>
      <div class="key"><p>Per-vertex data is declared <code>out</code> in the VS and <code>in</code> in the FS. The rasterizer fills the in-between.</p></div>

      <h2 data-sub="GL4.4.1">in and out</h2>
      <p>Vertex inputs: <code>layout(location = 0) in vec3 aPos;</code> matches <code>glVertexAttribPointer(0, …)</code>. Outputs to the next stage use <code>out</code>. Fragment outputs: <code>layout(location = 0) out vec4 FragColor;</code> writes colour attachment 0.</p>

      <h2 data-sub="GL4.4.2">Interpolation</h2>
      <p>Default qualifier is <code>smooth</code> (perspective-correct mix). <code>flat</code> uses one vertex's value for the whole primitive (the provoking vertex). Texture coordinates must be interpolated perspectively or textures swim — that math is in Section 5.4 of the math book; here you just know GLSL does it when you pass <code>vUv</code> as a smooth out.</p>

      <h2 data-sub="GL4.4.3">Locations</h2>
      <p>If names differ, bind with <code>layout(location = N)</code> on both sides, or <code>glBindAttribLocation</code> before linking (attributes only). Mixing name matching and locations is allowed; be consistent in a project.</p>
      <div class="game">Vertex colours in a debug mesh, UVs on a character, and world-space normals for lighting are all VS outs interpolated for the FS.</div>
      <p><a class="btn goto-sim" href="#/GL4.4/sim">Try it: interpolate vertex colours →</a></p>
    `,
    keyFormulas: [
      ["Smooth mix", String.raw`c=(1-\lambda-\mu)c_0+\lambda c_1+\mu c_2`],
      ["Attribute hook", String.raw`\text{location }n \leftrightarrow \text{glVertexAttribPointer}(n,\ldots)`],
    ],
    exercises: [
      { q: "Three vertices are red, green, and blue. What colour is the centroid fragment with smooth interpolation?", a: "The average: a grey-ish mix of all three." },
      { q: "What does flat do?", a: "Every fragment uses one vertex's value; no blend across the triangle." },
      { q: "How does aPos reach the vertex shader?", a: "VAO attribute pointer whose index matches layout(location) of aPos." },
    ],
    cpp: [{
      title: "Vertex colour attribute at location 1",
      code: String.raw`
void BindColorAttribute(int stride, int offsetBytes)
{
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, stride, (void*)(intptr_t)offsetBytes);
    glEnableVertexAttribArray(1);
}
`,
    }],
    csharp: [{
      title: "Vertex colour attribute at location 1",
      code: String.raw`
public static void BindColorAttribute(int stride, int offsetBytes)
{
    GL.VertexAttribPointer(1, 3, VertexAttribPointerType.Float, false, stride, offsetBytes);
    GL.EnableVertexAttribArray(1);
}
`,
    }],
    sims: [{ title: "Varying interpolation", help: "<p>Drag the sample point inside the triangle. Smooth mode mixes the three vertex colours; flat uses one corner.</p>", mount: varyings }],
  });

  function shaderStory(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 3, height: 320 });
    const hue = sim.slider(controls, { label: "Fragment shader colour", min: 0, max: 360, step: 1, value: 25, unit: "°", onInput: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      const color = `hsl(${hue.value}, 75%, 55%)`;
      view.polygon([[-2, -1.5], [2, -1.5], [0, 1.7]], { color, fill: color, fillAlpha: .8 });
      out.set(sim.rows([["vertex shader", "writes gl_Position for 3 corners"], ["fragment shader", "writes FragColor"], ["output colour", color]]));
    });
  }

  function compileLink(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const steps = ["Create VS object", "Compile vertex GLSL", "Create FS object", "Compile fragment GLSL", "Link program", "glUseProgram"];
    const checks = steps.map((label, i) => sim.checkbox(controls, { label, value: i < 2, onChange: () => v.redraw() }));
    const v = sim.view2d(stage, { range: 4, height: 320 });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      steps.forEach((s, i) => {
        const ok = checks[i].value;
        view.rect([-3.6, 2.5 - i * 0.85], [3.6, 1.85 - i * 0.85], { color: ok ? "c" : "muted", fill: ok ? "c" : "panel", fillAlpha: .28 });
        view.text([-3.3, 2.15 - i * 0.85], (ok ? "✓ " : "○ ") + s, { color: "fg", size: 14 });
      });
      const linked = checks[4].value && checks[0].value && checks[1].value && checks[2].value && checks[3].value;
      out.set(sim.rows([["link legal", linked ? "yes" : "need both compiled shaders attached"], ["can draw", linked && checks[5].value ? "yes" : "not yet"]]));
    });
  }

  function uniformTint(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 3, height: 300 });
    const r = sim.slider(controls, { label: "uColor.r", min: 0, max: 1, step: 0.01, value: 1, onInput: () => v.redraw() });
    const g = sim.slider(controls, { label: "uColor.g", min: 0, max: 1, step: 0.01, value: 0.5, onInput: () => v.redraw() });
    const b = sim.slider(controls, { label: "uColor.b", min: 0, max: 1, step: 0.01, value: 0.2, onInput: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      const color = `rgb(${Math.round(r.value * 255)}, ${Math.round(g.value * 255)}, ${Math.round(b.value * 255)})`;
      view.polygon([[-2, -1.4], [2, -1.4], [0, 1.6]], { color, fill: color, fillAlpha: 1 });
      out.set(sim.rows([["glUniform3f", `${fmt(r.value, 2)}, ${fmt(g.value, 2)}, ${fmt(b.value, 2)}`], ["who reads it", "every fragment of this draw"], ["who writes it", "CPU, once per draw"]]));
    });
  }

  function varyings(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 3, height: 320 });
    const mode = sim.select(controls, { label: "Qualifier", options: [["smooth", "smooth (default)"], ["flat", "flat"]], value: "smooth", onChange: () => v.redraw() });
    const p = v.handle([0.2, 0.1], { color: "fg", label: "sample" });
    const out = sim.readout(readout);
    const A = [-2, -1.4], B = [2, -1.4], C = [0, 1.7];
    v.onDraw((view) => {
      view.polygon([A, B, C], { color: "muted", fill: "panel", fillAlpha: .15 });
      view.point(A, { color: "e", label: "red" });
      view.point(B, { color: "c", label: "green" });
      view.point(C, { color: "a", label: "blue" });
      const x = p.pos[0], y = p.pos[1];
      const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
      const l1 = ((B[1] - C[1]) * (x - C[0]) + (C[0] - B[0]) * (y - C[1])) / den;
      const l2 = ((C[1] - A[1]) * (x - C[0]) + (A[0] - C[0]) * (y - C[1])) / den;
      const l3 = 1 - l1 - l2;
      const inside = l1 >= 0 && l2 >= 0 && l3 >= 0;
      const col = mode.value === "flat"
        ? [0.2, 0.45, 0.9]
        : [Math.max(0, l1), Math.max(0, l2), Math.max(0, l3)];
      const css = `rgb(${Math.round(col[0] * 255)}, ${Math.round(col[1] * 255)}, ${Math.round(col[2] * 255)})`;
      view.point(p.pos, { color: css, r: 10 });
      out.set(sim.rows([["barycentric", inside ? `${fmt(l1, 2)}, ${fmt(l2, 2)}, ${fmt(l3, 2)}` : "outside"], ["FS vColor", css], ["mode", mode.value]]));
    });
  }
})();
