// Learn OpenGL — Chapter 1: OpenGL Foundations
(function () {
  "use strict";
  const { fmt } = L3D.math;

  L3D.topic({
    id: "GL1.1",
    summary: "OpenGL is a graphics API specification: your program calls its functions, a driver turns those calls into GPU work, and the GPU draws.",
    lesson: String.raw`
      <p><strong>OpenGL is a graphics API</strong> — an Application Programming Interface. That means it is a list of functions, constants, and object types your C++ (or C#) program can call. Those calls describe a picture. They do not paint pixels by themselves. A <em>graphics driver</em> on the computer receives the calls and turns them into work for the <em>GPU</em> (the graphics processor on the video card).</p>
      <div class="key"><p>Think of OpenGL as a shared language. Your program speaks OpenGL. The driver translates. The GPU draws.</p></div>

      <h2 data-sub="GL1.1.1">Specification vs driver</h2>
      <p>The Khronos Group publishes the OpenGL <strong>specification</strong>: the official rules for what each function must do. NVIDIA, AMD, Intel, and others write <strong>drivers</strong> that implement those rules on their hardware. Your program should behave the same on every vendor <em>if</em> you stay inside the spec, but performance and extension support still differ.</p>
      <p>This course uses <strong>desktop OpenGL 3.3 core profile</strong>, the same baseline as LearnOpenGL. The function names you learn (<code>glClear</code>, <code>glBindBuffer</code>, <code>glDrawArrays</code>, …) are the API. Later APIs such as Vulkan give more control; OpenGL stays the most direct way to see how a GPU is told to draw.</p>

      <h2 data-sub="GL1.1.2">What OpenGL does not do</h2>
      <p>OpenGL does <em>not</em> create a window, read the keyboard, load image files from disk, or play audio. Helper libraries fill those gaps:</p>
      <table>
        <tr><th>Job</th><th>Typical tool</th></tr>
        <tr><td>Window, input, context</td><td>GLFW</td></tr>
        <tr><td>Load OpenGL function pointers</td><td>GLAD</td></tr>
        <tr><td>Image files (png, jpg)</td><td>stb_image</td></tr>
        <tr><td>3D model files</td><td>Assimp (later, optional)</td></tr>
      </table>
      <p>OpenGL <em>does</em> clear a framebuffer, store mesh data in GPU buffers, compile shader programs, sample textures, run depth and stencil tests, and issue draw calls.</p>

      <h2 data-sub="GL1.1.3">Core profile</h2>
      <p>Older OpenGL had a <strong>fixed-function pipeline</strong> (<code>glBegin</code>/<code>glEnd</code>, built-in lighting). Modern <strong>core profile</strong> removes that. You create objects yourself: buffers, vertex arrays, shader programs, textures, framebuffers. That is more typing, but every GPU step is visible — which is the point of this book.</p>
      <div class="game">A game engine's renderer is a careful sequence of OpenGL (or Direct3D, Metal, Vulkan) calls. The math books on this site explain <em>where</em> vertices go. This book explains <em>how you tell the GPU</em> to use that data.</div>
      <div class="note">Math for transforms, cameras, and lighting lives in the 3D math book. Here we treat matrices and colours as values you upload through the API.</div>
      <p><a class="btn goto-sim" href="#/GL1.1/sim">Try it: pick an API command →</a></p>
    `,
    keyFormulas: [
      ["API call", String.raw`\text{program} \xrightarrow{\text{gl*}} \text{driver} \xrightarrow{\text{commands}} \text{GPU}`],
      ["Clear the colour buffer", String.raw`\text{glClearColor}(r,g,b,a),\quad \text{glClear}(\text{GL\_COLOR\_BUFFER\_BIT})`],
    ],
    exercises: [
      { q: "Who actually draws pixels: your C++ function, the OpenGL spec, the driver, or the GPU?", a: "The GPU draws. Your function calls OpenGL. The driver records GPU commands. The spec only defines the rules." },
      { q: "Why do you still need GLFW if you have OpenGL?", a: "OpenGL has no window or input API. GLFW creates the window and the OpenGL context attached to it." },
      { q: "What is the core profile asking you to do that old OpenGL hid?", a: "Create and bind your own buffers, vertex arrays, and shader programs instead of using glBegin or fixed lighting." },
    ],
    cpp: [{
      title: "The first OpenGL calls",
      formula: String.raw`\text{clear colour}=(r,g,b,a)`,
      note: "<p><strong>Give:</strong> red, green, blue, and alpha in \(0..1\). <code>glClear</code> fills the current colour buffer with that colour.</p>",
      code: String.raw`
void ClearFrame(float r, float g, float b, float a)
{
    glClearColor(r, g, b, a);
    glClear(GL_COLOR_BUFFER_BIT);
}
`,
    }],
    csharp: [{
      title: "The first OpenGL calls",
      formula: String.raw`\text{clear colour}=(r,g,b,a)`,
      note: "<p>OpenTK names the same API. Colour channels are still \(0..1\).</p>",
      code: String.raw`
public static void ClearFrame(float r, float g, float b, float a)
{
    GL.ClearColor(r, g, b, a);
    GL.Clear(ClearBufferMask.ColorBufferBit);
}
`,
    }],
    sims: [{ title: "API command story", help: "<p>Pick an OpenGL command. The picture shows the small job it asks of the GPU. Real frames chain many of these jobs.</p>", mount: apiStory }],
  });

  L3D.topic({
    id: "GL1.2",
    summary: "OpenGL is a state machine: it remembers the active objects and settings, and later commands use whatever is currently bound.",
    lesson: String.raw`
      <p>OpenGL keeps a big bag of current settings inside the <strong>context</strong>: which buffer is bound, which shader is active, whether depth testing is on, the clear colour, the viewport rectangle, and so on. A typical function either <em>changes</em> that state or <em>uses</em> it (a draw call uses it).</p>
      <div class="key"><p>The usual object recipe is: generate an ID → bind it (make it active) → change it → later bind it again when you want to use it.</p></div>

      <h2 data-sub="GL1.2.1">Context state</h2>
      <p>State lives in the current context, not in your C++ variables. If you call <code>glClearColor(1, 0, 0, 1)</code>, OpenGL remembers red until you change it. If you bind texture 7, texture commands affect texture 7 until you bind something else (including <code>0</code>, which means “nothing”).</p>

      <h2 data-sub="GL1.2.2">Create, bind, modify</h2>
      <p>Most GPU resources are <strong>objects</strong> named by an integer handle:</p>
      <ol>
        <li><code>glGenBuffers(1, &amp;vbo)</code> asks OpenGL for a new buffer name.</li>
        <li><code>glBindBuffer(GL_ARRAY_BUFFER, vbo)</code> makes that buffer the active array buffer.</li>
        <li><code>glBufferData(...)</code> uploads bytes into <em>whatever is currently bound</em> to <code>GL_ARRAY_BUFFER</code>.</li>
      </ol>
      <p>The same pattern appears for textures (<code>glGenTextures</code> / <code>glBindTexture</code> / <code>glTexImage2D</code>), vertex arrays, framebuffers, and shader programs (<code>glUseProgram</code>).</p>

      <h2 data-sub="GL1.2.3">Why binding exists</h2>
      <p>The GPU can hold thousands of buffers. OpenGL does not want every function to take every object as an argument (early OpenGL was designed that way). Binding selects “the object on the desk.” That is convenient and also a common source of bugs: upload data while the wrong buffer is bound, and you silently overwrite the wrong memory.</p>
      <div class="warn">After setup, bind <code>0</code> only if you mean it. A later <code>glBufferData</code> with nothing bound is an error in core profile.</div>
      <div class="game">Engines cache the last bound VAO, program, and textures so they do not rebind the same object every draw. Rebinding is legal; it is just extra driver work.</div>
      <p><a class="btn goto-sim" href="#/GL1.2/sim">Try it: bind one buffer, then change it →</a></p>
    `,
    keyFormulas: [
      ["Bind then modify", String.raw`\text{glBind*}(\text{target},\,id)\ \Rightarrow\ \text{next gl* affects }id`],
      ["Unbind", String.raw`\text{glBind*}(\text{target},\,0)`],
    ],
    exercises: [
      { q: "You generate buffers A and B. You bind A, then call glBufferData. Which buffer grows?", a: "A. glBufferData writes to the buffer currently bound to that target." },
      { q: "Where is the clear colour stored: in your float variables, or in the context?", a: "In the context. Your floats are only inputs to glClearColor." },
      { q: "Why can binding the same object twice in a row be wasteful?", a: "The driver may still validate and update internal tables. Engines skip redundant binds." },
    ],
    cpp: [{
      title: "Create, bind, and fill a buffer",
      formula: String.raw`\text{active buffer}\leftarrow\text{id}`,
      note: "<p><strong>Give:</strong> a CPU array of floats. OpenGL copies them into GPU memory of the bound buffer.</p>",
      code: String.raw`
GLuint CreateVertexBuffer(const float* vertices, int floatCount)
{
    GLuint vbo = 0;
    glGenBuffers(1, &vbo);
    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glBufferData(GL_ARRAY_BUFFER, floatCount * (int)sizeof(float), vertices, GL_STATIC_DRAW);
    return vbo;
}
`,
    }],
    csharp: [{
      title: "Create, bind, and fill a buffer",
      formula: String.raw`\text{active buffer}\leftarrow\text{id}`,
      note: "<p>OpenTK's <code>GenBuffer</code> returns the id directly.</p>",
      code: String.raw`
public static int CreateVertexBuffer(float[] vertices)
{
    int vbo = GL.GenBuffer();
    GL.BindBuffer(BufferTarget.ArrayBuffer, vbo);
    GL.BufferData(BufferTarget.ArrayBuffer, vertices.Length * sizeof(float), vertices, BufferUsageHint.StaticDraw);
    return vbo;
}
`,
    }],
    sims: [{ title: "Binding desk", help: "<p>Choose Buffer A or Buffer B, then change data size. Only the bound buffer changes — that is the state machine.</p>", mount: bindingDesk }],
  });

  L3D.topic({
    id: "GL1.3",
    summary: "The CPU records OpenGL calls; the driver queues GPU commands; the GPU reads mesh data from VRAM and writes pixels. The two processors overlap in time.",
    lesson: String.raw`
      <p>Your game code runs on the <strong>CPU</strong>. Drawing runs on the <strong>GPU</strong>. They are different chips with different memory. OpenGL is the conversation between them.</p>
      <div class="key"><p>A draw call usually returns before the GPU has finished that draw. The CPU can prepare the next frame while the GPU is still shading the current one.</p></div>

      <h2 data-sub="GL1.3.1">Who does what</h2>
      <table>
        <tr><th>CPU</th><th>GPU</th></tr>
        <tr><td>Game logic, animation, culling</td><td>Vertex shaders, rasterization, fragment shaders</td></tr>
        <tr><td>Builds command stream via gl* calls</td><td>Consumes commands from a queue</td></tr>
        <tr><td>System RAM</td><td>VRAM (video memory)</td></tr>
      </table>
      <p>The <strong>driver</strong> sits in the middle. It validates arguments, translates OpenGL into the card's native command language, and may re-order or batch work.</p>

      <h2 data-sub="GL1.3.2">Command buffers</h2>
      <p>When you call <code>glDrawElements</code>, the driver typically appends a packet to a <strong>command buffer</strong>. The GPU reads that buffer later. That is why “the CPU submitted 2,000 draws” and “the GPU finished them” can be milliseconds apart.</p>
      <div class="warn">Reading GPU memory back to the CPU (<code>glReadPixels</code>, mapping a buffer the GPU is still using) can force a <strong>pipeline stall</strong>: the CPU waits until the GPU catches up. Real-time engines avoid readbacks on the hot path.</div>

      <h2 data-sub="GL1.3.3">VRAM vs RAM</h2>
      <p>Meshes, textures, and framebuffers live in <strong>VRAM</strong> after you upload them. The CPU should not touch that memory every frame. Upload static meshes once (<code>GL_STATIC_DRAW</code>). Stream only data that truly changes (<code>GL_DYNAMIC_DRAW</code> / <code>GL_STREAM_DRAW</code>).</p>
      <div class="game">If the CPU is slow, the GPU sits idle (CPU-bound). If the GPU is slow, the command queue fills and the CPU eventually blocks on swap (GPU-bound). Profiling tells you which side to optimize.</div>
      <p><a class="btn goto-sim" href="#/GL1.3/sim">Try it: overlap CPU and GPU work →</a></p>
    `,
    keyFormulas: [
      ["Async draw", String.raw`\text{glDraw* returns} \ll \text{GPU finish time}`],
      ["Frame time", String.raw`t_{\text{frame}}\approx\max(t_{\text{CPU}}, t_{\text{GPU}})`],
    ],
    exercises: [
      { q: "Does glDrawArrays wait until every triangle is shaded?", a: "Usually no. It records work and returns. The GPU may still be busy." },
      { q: "Name one OpenGL action that often stalls the CPU.", a: "glReadPixels, glFinish, or mapping a buffer still in use." },
      { q: "Where should a static character mesh live after load?", a: "In a VBO in VRAM, uploaded once with GL_STATIC_DRAW." },
    ],
    cpp: [{
      title: "Submit work, do not wait",
      formula: String.raw`\text{draw} \rightarrow \text{queue}`,
      note: "<p><code>glFinish</code> is shown only as a contrast. Games almost never call it every frame.</p>",
      code: String.raw`
void DrawMesh(GLuint vao, GLuint program, int indexCount)
{
    glUseProgram(program);
    glBindVertexArray(vao);
    glDrawElements(GL_TRIANGLES, indexCount, GL_UNSIGNED_INT, nullptr);
    // Do not call glFinish() here — it would stall the CPU until the GPU is idle.
}
`,
    }],
    csharp: [{
      title: "Submit work, do not wait",
      formula: String.raw`\text{draw} \rightarrow \text{queue}`,
      note: "<p>The draw returns after recording. SwapBuffers later may wait for v-sync, not for this single draw.</p>",
      code: String.raw`
public static void DrawMesh(int vao, int program, int indexCount)
{
    GL.UseProgram(program);
    GL.BindVertexArray(vao);
    GL.DrawElements(PrimitiveType.Triangles, indexCount, DrawElementsType.UnsignedInt, 0);
}
`,
    }],
    sims: [{ title: "CPU / GPU timeline", help: "<p>Change CPU work and GPU work. The frame time is roughly the slower of the two, until a readback forces them to take turns.</p>", mount: cpuGpuTimeline }],
  });

  L3D.topic({
    id: "GL1.4",
    summary: "A draw call kicks a fixed sequence of pipeline stages: vertex shader, optional extra shaders, rasterizer, fragment shader, then per-sample tests and blending into a framebuffer.",
    lesson: String.raw`
      <p>The <strong>graphics pipeline</strong> is the ordered list of stages the GPU runs for each draw. You configure the stages (shaders, vertex layout, textures, tests), then a <strong>draw call</strong> pushes vertices in at the front. Pixels come out into a framebuffer at the back.</p>
      <div class="key"><p>You do not call “run the fragment shader.” You call <code>glDraw*</code>. The pipeline runs because that is what a draw means.</p></div>

      <h2 data-sub="GL1.4.1">Programmable stages</h2>
      <p>You write these in GLSL and attach them to a program object:</p>
      <ul>
        <li><strong>Vertex shader</strong> — once per vertex. Outputs a clip-space position (<code>gl_Position</code>) and any varyings (colour, uv, normal).</li>
        <li><strong>Tessellation</strong> (optional) — subdivides patches.</li>
        <li><strong>Geometry shader</strong> (optional) — can emit extra primitives.</li>
        <li><strong>Fragment shader</strong> — once per candidate pixel (fragment). Outputs a colour (and optionally depth).</li>
      </ul>
      <p>Compute shaders exist too, but they are launched with <code>glDispatchCompute</code>, not with a triangle draw.</p>

      <h2 data-sub="GL1.4.2">Fixed stages</h2>
      <p>You do not write GLSL for these; you only turn knobs:</p>
      <ul>
        <li><strong>Primitive assembly</strong> — groups vertices into points, lines, or triangles.</li>
        <li><strong>Clipping / perspective divide / viewport</strong> — turns clip space into window pixels. (The math is in the 3D math book.)</li>
        <li><strong>Rasterization</strong> — finds the pixels covered by each triangle.</li>
        <li><strong>Depth, stencil, scissor tests</strong> — may discard a fragment.</li>
        <li><strong>Blending</strong> — mixes the new colour with the colour already in the framebuffer.</li>
      </ul>

      <h2 data-sub="GL1.4.3">Draw call as a kick</h2>
      <p>Before kicking the pipeline you typically: bind a VAO (where vertices live and how to read them), <code>glUseProgram</code>, bind textures, set uniforms, enable tests, then <code>glDrawArrays</code> or <code>glDrawElements</code>. Everything the fragment shader can see must already be bound.</p>
      <div class="note">Chapter 1 of the math book shows the same pipeline from the geometry side. This chapter is the API view: which objects feed which stage.</div>
      <p><a class="btn goto-sim" href="#/GL1.4/sim">Try it: walk the pipeline stages →</a></p>
    `,
    keyFormulas: [
      ["Core path", String.raw`\text{VBO} \rightarrow \text{VS} \rightarrow \text{rasterize} \rightarrow \text{FS} \rightarrow \text{tests} \rightarrow \text{FBO}`],
      ["Kick", String.raw`\text{glDrawArrays}(\text{mode},\,\text{first},\,\text{count})`],
    ],
    exercises: [
      { q: "Which shader runs once per vertex, and which once per pixel candidate?", a: "Vertex shader per vertex; fragment shader per fragment." },
      { q: "Is blending a shader you write?", a: "No. It is a fixed stage configured with glEnable(GL_BLEND) and glBlendFunc." },
      { q: "What must be bound before glDrawArrays can produce a picture?", a: "A VAO with attribute pointers, a shader program, and usually a framebuffer (the default one counts)." },
    ],
    cpp: [{
      title: "Kick the pipeline",
      formula: String.raw`\text{draw}(\text{triangles}, 3)`,
      note: "<p>Three vertices starting at index 0, assembled as one triangle.</p>",
      code: String.raw`
void DrawBoundTriangle()
{
    glDrawArrays(GL_TRIANGLES, 0, 3);
}
`,
    }],
    csharp: [{
      title: "Kick the pipeline",
      formula: String.raw`\text{draw}(\text{triangles}, 3)`,
      note: "<p>Same kick. The bound VAO and program are context state, not arguments.</p>",
      code: String.raw`
public static void DrawBoundTriangle()
{
    GL.DrawArrays(PrimitiveType.Triangles, 0, 3);
}
`,
    }],
    sims: [{ title: "Pipeline stages", help: "<p>Step through the stages of one triangle. Watch data change from vertices, to a filled shape, to tested pixels in a framebuffer.</p>", mount: pipelineStages }],
  });

  function apiStory(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 4, height: 300 });
    const command = sim.select(controls, {
      label: "OpenGL command",
      options: [
        ["clear", "glClear — erase old frame"],
        ["buffer", "glBufferData — send data"],
        ["shader", "glUseProgram — choose GPU program"],
        ["draw", "glDrawArrays — draw vertices"],
      ],
      value: "clear",
      onChange: () => v.redraw(),
    });
    const out = sim.readout(readout);
    const jobs = {
      clear: ["glClear", "GPU: fill the colour buffer", "CPU recorded a clear; GPU paints later"],
      buffer: ["glBufferData", "driver: copy bytes toward VRAM", "CPU memory is the source; VBO is the dest"],
      shader: ["glUseProgram", "context: active program = this id", "later draws use this vertex + fragment shader"],
      draw: ["glDrawArrays", "GPU: run the pipeline", "vertices in, pixels out"],
    };
    v.onDraw((view) => {
      const j = jobs[command.value];
      view.rect([-3.4, -2], [3.4, 2], { color: command.value === "clear" ? "a" : "panel", fill: command.value === "clear" ? "a" : "panel", fillAlpha: .35 });
      if (command.value === "draw") view.polygon([[-1.4, -1.2], [1.4, -1.2], [0, 1.3]], { color: "g", fill: "g", fillAlpha: .5 });
      view.text([0, 0.2], j[1], { align: "center", color: "fg", size: 16 });
      out.set(sim.rows([["API call", j[0]], ["what happens", j[1]], ["CPU vs GPU", j[2]]]));
    });
  }

  function bindingDesk(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 4, height: 300 });
    const object = sim.select(controls, { label: "Object to bind", options: [["a", "Buffer A"], ["b", "Buffer B"]], value: "a", onChange: () => v.redraw() });
    const setting = sim.slider(controls, { label: "Data size", min: 1, max: 6, step: 1, value: 3, onInput: () => v.redraw() });
    const sizes = { a: 3, b: 2 };
    const out = sim.readout(readout);
    v.onDraw((view) => {
      sizes[object.value] = setting.value;
      [["a", 1], ["b", -1]].forEach(([id, y]) => {
        const on = object.value === id;
        view.rect([-3.2, y - 0.7], [3.2, y + 0.7], { color: on ? (id === "a" ? "a" : "g") : "muted", fill: on ? (id === "a" ? "a" : "g") : "panel", fillAlpha: .3 });
        view.text([-3, y], "Buffer " + id.toUpperCase() + (on ? "  (bound)" : ""), { color: "fg" });
        view.rect([-1, y - 0.35], [-1 + sizes[id] * 0.55, y + 0.35], { color: id === "a" ? "a" : "g", fill: id === "a" ? "a" : "g", fillAlpha: .75 });
      });
      out.set(sim.rows([["bound object", "Buffer " + object.value.toUpperCase()], ["Buffer A size", sizes.a], ["Buffer B size", sizes.b], ["rule", "only the bound object receives glBufferData"]]));
    });
  }

  function cpuGpuTimeline(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 320 });
    const cpu = sim.slider(controls, { label: "CPU work", min: 1, max: 8, step: 1, value: 3, onInput: () => v.redraw() });
    const gpu = sim.slider(controls, { label: "GPU work", min: 1, max: 8, step: 1, value: 5, onInput: () => v.redraw() });
    const stall = sim.checkbox(controls, { label: "Force readback (glReadPixels)", value: false, onChange: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      const c = cpu.value, g = gpu.value;
      function bar(y, len, color, label) {
        view.rect([-4, y], [-4 + len, y + 0.7], { color, fill: color, fillAlpha: .55 });
        view.text([-3.9, y + 0.35], label, { color: "fg", size: 13 });
      }
      if (stall.value) {
        bar(1.2, c, "a", "CPU");
        bar(0.2, g, "g", "GPU waits, then works");
        bar(-1.2, c + g, "e", "serial frame");
      } else {
        bar(1.2, c, "a", "CPU submit");
        bar(0.3, g, "g", "GPU (overlaps)");
        bar(-1.2, Math.max(c, g), "c", "frame ≈ slower side");
      }
      const t = stall.value ? c + g : Math.max(c, g);
      out.set(sim.rows([["CPU units", c], ["GPU units", g], ["frame length", t], ["bound by", stall.value ? "sync stall" : (c > g ? "CPU" : g > c ? "GPU" : "both")]]));
    });
  }

  function pipelineStages(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 340 });
    const step = sim.slider(controls, { label: "Pipeline step", min: 0, max: 5, step: 1, value: 0, onInput: () => v.redraw() });
    const names = ["VBO vertices", "Vertex shader", "Rasterize", "Fragment shader", "Depth test", "Framebuffer"];
    const out = sim.readout(readout);
    v.onDraw((view) => {
      const s = step.value;
      names.forEach((n, i) => {
        const x = -4.6 + (i % 3) * 3.1;
        const y = i < 3 ? 1.3 : -1.6;
        view.rect([x, y], [x + 2.8, y + 1.2], { color: i <= s ? "a" : "muted", fill: i <= s ? "a" : "panel", fillAlpha: .35 });
        view.text([x + 1.4, y + 0.6], n, { align: "center", color: "fg", size: 13 });
      });
      if (s >= 2) view.polygon([[-1.2, -0.3], [1.2, -0.3], [0, 1.0]], { color: "g", fill: "g", fillAlpha: s >= 3 ? 0.55 : 0.15 });
      out.set(sim.rows([["current stage", names[s]], ["already finished", names.slice(0, s).join(", ") || "none"], ["kick", "glDraw* starts stage 0 from bound state"]]));
    });
  }
})();
