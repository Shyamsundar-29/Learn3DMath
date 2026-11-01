// Learn OpenGL — Chapter 2: Window, Context, and Frames
(function () {
  "use strict";

  L3D.topic({
    id: "GL2.1",
    summary: "GLFW creates a window and an OpenGL context. Making the context current, then loading GLAD, is what makes gl* functions real.",
    lesson: String.raw`
      <p>Before any <code>gl*</code> call works you need an <strong>OpenGL context</strong>: the driver's object that stores state and talks to the GPU. On desktop, a context is almost always created together with a window. <strong>GLFW</strong> does both.</p>
      <div class="key"><p>Order: init GLFW → set version hints → create window → make context current → load GLAD. Skip a step and later calls crash or no-op.</p></div>

      <h2 data-sub="GL2.1.1">GLFW</h2>
      <p>GLFW is a small C library. <code>glfwInit</code> starts it. <code>glfwWindowHint</code> asks for a specific OpenGL version and profile <em>before</em> the window exists. Then <code>glfwCreateWindow(width, height, title, …)</code> returns a <code>GLFWwindow*</code>.</p>
      <p>Hints this course uses:</p>
      <ul>
        <li><code>GLFW_CONTEXT_VERSION_MAJOR/MINOR = 3, 3</code></li>
        <li><code>GLFW_OPENGL_PROFILE = GLFW_OPENGL_CORE_PROFILE</code></li>
        <li>On macOS you also need <code>GLFW_OPENGL_FORWARD_COMPAT</code></li>
      </ul>

      <h2 data-sub="GL2.1.2">GLAD</h2>
      <p>OpenGL functions are not ordinary linked symbols on Windows. The driver exposes function addresses at runtime. <strong>GLAD</strong> (or GLEW, or a loader in OpenTK) asks <code>glfwGetProcAddress</code> for each <code>gl*</code> name and fills function pointers. Call <code>gladLoadGLLoader</code> <em>after</em> the context is current.</p>

      <h2 data-sub="GL2.1.3">Making a context current</h2>
      <p><code>glfwMakeContextCurrent(window)</code> attaches that window's context to the calling thread. OpenGL is thread-sticky: the thread that makes the context current is the thread that should call <code>gl*</code>. Two threads drawing into one context without extra locking is undefined.</p>
      <div class="warn">If <code>glfwCreateWindow</code> returns null, the machine likely cannot give you 3.3 core (old GPU, missing driver, or headless VM). Check <code>glfwGetError</code> / the debug callback.</div>
      <div class="game">Game engines still do this once at boot, then keep the same context for the process lifetime. Switching contexts is expensive.</div>
      <p><a class="btn goto-sim" href="#/GL2.1/sim">Try it: complete the setup checklist →</a></p>
    `,
    keyFormulas: [
      ["Setup order", String.raw`\text{GLFW init}\rightarrow\text{hints}\rightarrow\text{window}\rightarrow\text{current}\rightarrow\text{GLAD}`],
      ["Current context", String.raw`\text{glfwMakeContextCurrent}(w)`],
    ],
    exercises: [
      { q: "Why must GLAD load after glfwMakeContextCurrent?", a: "Function addresses come from the current context's driver. No current context means no valid pointers." },
      { q: "What does GLFW_OPENGL_CORE_PROFILE refuse?", a: "Deprecated fixed-function calls such as glBegin." },
      { q: "Can two threads call glDrawArrays on one context at once?", a: "Not safely. One current context per thread; sharing needs extra setup." },
    ],
    cpp: [{
      title: "Create an OpenGL 3.3 window",
      note: "<p>Check each result. A missing driver is a normal failure, not a mystery crash later.</p>",
      code: String.raw`
int MakeWindow(GLFWwindow** outWindow)
{
    if (!glfwInit()) return 0;
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    GLFWwindow* window = glfwCreateWindow(800, 600, "Learn OpenGL", nullptr, nullptr);
    if (!window) { glfwTerminate(); return 0; }
    glfwMakeContextCurrent(window);
    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) return 0;
    *outWindow = window;
    return 1;
}
`,
    }],
    csharp: [{
      title: "Create an OpenGL 3.3 window",
      note: "<p>OpenTK's GameWindow / NativeWindow does the same hints internally.</p>",
      code: String.raw`
public static NativeWindow MakeWindow()
{
    var settings = new NativeWindowSettings
    {
        Title = "Learn OpenGL",
        Size = new Vector2i(800, 600),
        APIVersion = new Version(3, 3),
        Profile = ContextProfile.Core,
    };
    return new NativeWindow(settings);
}
`,
    }],
    sims: [{ title: "Window setup checklist", help: "<p>Turn on each setup step. Drawing is allowed only when every required box is checked.</p>", mount: setupChecklist }],
  });

  L3D.topic({
    id: "GL2.2",
    summary: "The render loop repeats while the window is open: process input, draw a frame, swap buffers, then poll events.",
    lesson: String.raw`
      <p>A game is not a single screenshot. While the window exists, your program repeats a <strong>render loop</strong> many times per second. Each pass produces one frame.</p>
      <div class="key"><p>Every loop: input → clear → draw → swap → poll events. Leave the loop when the user closes the window.</p></div>

      <h2 data-sub="GL2.2.1">Input</h2>
      <p>GLFW stores key state. <code>glfwGetKey(window, GLFW_KEY_ESCAPE)</code> is a simple poll. For “close the window,” call <code>glfwSetWindowShouldClose(window, true)</code>. Mouse and gamepads have similar queries or callbacks.</p>

      <h2 data-sub="GL2.2.2">Draw</h2>
      <p>Start the frame with <code>glClear</code> so leftover pixels from last frame disappear. Then bind objects and issue draw calls. Nothing is visible yet: you are drawing into the <strong>back buffer</strong> (next topic).</p>

      <h2 data-sub="GL2.2.3">Events</h2>
      <p><code>glfwSwapBuffers</code> shows the finished back buffer. <code>glfwPollEvents</code> lets GLFW process OS messages (resize, key, close). If you forget to poll, the window freezes and the close button does nothing.</p>
      <p>The loop condition is <code>!glfwWindowShouldClose(window)</code>. After the loop, destroy the window and call <code>glfwTerminate</code>.</p>
      <div class="note">Measure time with <code>glfwGetTime()</code> if you need animation. Delta time is a CPU-side number you may pass to shaders as a uniform — the GPU does not know wall-clock time unless you tell it.</div>
      <p><a class="btn goto-sim" href="#/GL2.2/sim">Try it: watch the frame jobs repeat →</a></p>
    `,
    keyFormulas: [
      ["Loop", String.raw`\text{while } \neg\text{shouldClose}:\ \text{input}\rightarrow\text{draw}\rightarrow\text{swap}\rightarrow\text{poll}`],
    ],
    exercises: [
      { q: "What happens if you never call glfwPollEvents?", a: "The window stops responding. Close and resize events sit unprocessed." },
      { q: "Is glClear optional?", a: "If you cover every pixel every frame, maybe. If you don't, the previous frame ghosts through. Clearing is the safe default." },
      { q: "When should glfwTerminate run?", a: "After the loop, once you are done with every GLFW window." },
    ],
    cpp: [{
      title: "A minimal render loop",
      note: "<p>The body is the whole frame. Real games also tick physics and audio here.</p>",
      code: String.raw`
void RunLoop(GLFWwindow* window)
{
    while (!glfwWindowShouldClose(window))
    {
        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
            glfwSetWindowShouldClose(window, 1);
        glClearColor(0.10f, 0.15f, 0.24f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);
        // Draw objects here.
        glfwSwapBuffers(window);
        glfwPollEvents();
    }
}
`,
    }],
    csharp: [{
      title: "A minimal render loop",
      note: "<p>OpenTK raises a RenderFrame event; the jobs inside are the same.</p>",
      code: String.raw`
public static void RunLoop(GameWindow window)
{
    window.RenderFrame += (sender, e) =>
    {
        GL.ClearColor(0.10f, 0.15f, 0.24f, 1f);
        GL.Clear(ClearBufferMask.ColorBufferBit);
        window.SwapBuffers();
    };
    window.Run();
}
`,
    }],
    sims: [{ title: "Frame loop timeline", help: "<p>Change how many jobs a frame performs. A real loop always includes swap and event polling or the window misbehaves.</p>", mount: renderLoop }],
  });

  L3D.topic({
    id: "GL2.3",
    summary: "A triangle is the first programmable shape: upload three vertices, describe their layout with a VAO, use a shader program, and issue a draw call.",
    lesson: String.raw`
      <p>Modern OpenGL never “just draws a triangle.” You provide <strong>vertex data</strong>, tell the GPU how to read it, bind a <strong>shader program</strong>, then kick the pipeline. The smallest complete picture is three corners — one triangle.</p>
      <div class="key"><p>Vertex = one corner. Three vertices + <code>GL_TRIANGLES</code> = one filled triangle. The vertex shader places corners; the fragment shader colours the pixels inside.</p></div>

      <h2 data-sub="GL2.3.1">Vertex data</h2>
      <p>Put positions in a float array, for example NDC coordinates that already sit inside the cube \([-1,1]\). Upload that array into a <strong>VBO</strong>. A <strong>VAO</strong> stores the attribute pointer: “attribute 0 is 3 floats, tightly packed, starting at offset 0.”</p>

      <h2 data-sub="GL2.3.2">Shader program</h2>
      <p>A vertex shader at minimum writes <code>gl_Position</code>. A fragment shader writes <code>FragColor</code>. Compile both, link them into one program, then <code>glUseProgram</code> before drawing. Chapter 4 goes deeper; here you only need “a program is bound.”</p>

      <h2 data-sub="GL2.3.3">The draw call</h2>
      <p><code>glDrawArrays(GL_TRIANGLES, 0, 3)</code> means: start at vertex 0, use 3 vertices, assemble triangles. Bind the VAO first so OpenGL knows which VBO and attributes to pull.</p>
      <div class="game">Almost every mesh in a game is many triangles sharing this recipe. Later we add indices, textures, and uniforms. The kick stays a draw call.</div>
      <p><a class="btn goto-sim" href="#/GL2.3/sim">Try it: drag a corner of the triangle →</a></p>
    `,
    keyFormulas: [
      ["First draw", String.raw`\text{VAO}+ \text{program}+ \text{glDrawArrays}(\text{GL\_TRIANGLES},0,3)`],
    ],
    exercises: [
      { q: "Why is a VAO needed in core profile?", a: "Attribute layout is stored in the VAO. Drawing with VAO 0 is invalid in core 3.3." },
      { q: "What does the 3 in glDrawArrays(..., 3) mean?", a: "Use three vertices, which makes one triangle under GL_TRIANGLES." },
      { q: "Who colours the interior pixels?", a: "The fragment shader, after the rasterizer finds which pixels the triangle covers." },
    ],
    cpp: [{
      title: "Draw three uploaded vertices",
      note: "<p><strong>Give:</strong> a linked program and a configured VAO. The count is vertex count, not triangle count.</p>",
      code: String.raw`
void DrawHelloTriangle(GLuint program, GLuint vao)
{
    glUseProgram(program);
    glBindVertexArray(vao);
    glDrawArrays(GL_TRIANGLES, 0, 3);
}
`,
    }],
    csharp: [{
      title: "Draw three uploaded vertices",
      note: "<p>Same three objects: program, VAO, draw.</p>",
      code: String.raw`
public static void DrawHelloTriangle(int program, int vao)
{
    GL.UseProgram(program);
    GL.BindVertexArray(vao);
    GL.DrawArrays(PrimitiveType.Triangles, 0, 3);
}
`,
    }],
    sims: [{ title: "Triangle pipeline", help: "<p>Drag the top vertex. The GPU still sees three points, then fills the pixels inside.</p>", mount: trianglePipeline }],
  });

  L3D.topic({
    id: "GL2.4",
    summary: "The GPU draws into a hidden back buffer. Swap makes that image the visible front buffer so the user never sees a half-finished frame.",
    lesson: String.raw`
      <p>The default framebuffer has at least two colour images: the <strong>front buffer</strong> (what the monitor is scanning) and the <strong>back buffer</strong> (where OpenGL draws). <code>glfwSwapBuffers</code> exchanges them.</p>
      <div class="key"><p>Draw off-screen, then swap once per frame. That is double buffering.</p></div>

      <h2 data-sub="GL2.4.1">Front and back buffers</h2>
      <p>If the GPU drew straight into the visible image, you would watch triangles appear one by one. The back buffer hides that construction. After swap, last frame's front buffer becomes the new back buffer and will be cleared next loop.</p>

      <h2 data-sub="GL2.4.2">Swap</h2>
      <p>Swap can copy pixels or (more often) flip which buffer the display controller reads. Either way, OpenGL's draw target after swap is the other colour image. You still call <code>glClear</code> every frame.</p>

      <h2 data-sub="GL2.4.3">V-sync</h2>
      <p>The monitor refreshes from top to bottom. If swap happens mid-refresh, the top of the screen shows the old frame and the bottom shows the new one — <strong>tearing</strong>. <strong>V-sync</strong> waits for the vertical blank before swapping. GLFW: <code>glfwSwapInterval(1)</code> requests v-sync, <code>0</code> lets the GPU run unbounded (and tear).</p>
      <div class="warn">V-sync can make a 17 ms GPU frame wait for the next 16.7 ms refresh, dropping 60 fps to 30 fps. That is a display policy, not an OpenGL bug.</div>
      <p><a class="btn goto-sim" href="#/GL2.4/sim">Try it: swap front and back →</a></p>
    `,
    keyFormulas: [
      ["Swap", String.raw`\text{front}\leftrightarrow\text{back}`],
      ["V-sync", String.raw`\text{glfwSwapInterval}(1)`],
    ],
    exercises: [
      { q: "Which buffer does glClear affect during the render loop?", a: "The back buffer — the one currently bound for drawing." },
      { q: "What visual bug does v-sync prevent?", a: "Tearing: mixed old and new frames in one refresh." },
      { q: "Does glfwSwapBuffers draw triangles?", a: "No. It presents an already drawn image and may wait for the monitor." },
    ],
    cpp: [{
      title: "Request v-sync and swap",
      code: String.raw`
void Present(GLFWwindow* window, int vsync)
{
    glfwSwapInterval(vsync);          // 1 = wait for refresh, 0 = tear if the GPU is faster
    glfwSwapBuffers(window);
}
`,
    }],
    csharp: [{
      title: "Request v-sync and swap",
      code: String.raw`
public static void Present(GameWindow window, bool vsync)
{
    window.VSync = vsync ? VSyncMode.On : VSyncMode.Off;
    window.SwapBuffers();
}
`,
    }],
    sims: [{ title: "Front and back buffers", help: "<p>Draw into the back buffer, then swap. With tearing on, a mid-frame swap shows a split image.</p>", mount: doubleBuffer }],
  });

  L3D.topic({
    id: "GL2.5",
    summary: "glViewport maps clip space onto a pixel rectangle. glClear with a mask erases colour, depth, and/or stencil before you draw.",
    lesson: String.raw`
      <p>After the vertex shader writes clip-space positions, the GPU needs to know <em>which pixels</em> of the window those coordinates cover. <code>glViewport(x, y, width, height)</code> sets that rectangle in window pixels. Origin is the <strong>lower-left</strong> in OpenGL.</p>
      <div class="key"><p>Resize the window → update the viewport. Clear with the right mask so leftover depth values do not hide new triangles.</p></div>

      <h2 data-sub="GL2.5.1">glViewport</h2>
      <p>A common callback:</p>
      <p><code>glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);</code></p>
      <p>Inside, call <code>glViewport(0, 0, width, height)</code> using the <em>framebuffer</em> size (not always equal to window size on High-DPI displays).</p>

      <h2 data-sub="GL2.5.2">Clear colour</h2>
      <p><code>glClearColor</code> is state. It does not clear by itself. <code>glClear(GL_COLOR_BUFFER_BIT)</code> fills the current colour attachment with that colour. Depth has <code>glClearDepth</code> (default 1.0 — far plane). Stencil has <code>glClearStencil</code>.</p>

      <h2 data-sub="GL2.5.3">Clear masks</h2>
      <p>You can OR bits:</p>
      <p><code>glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);</code></p>
      <p>If you enable depth testing but forget to clear depth, objects from the last frame still occupy the depth buffer and new draws fail the test.</p>
      <div class="note">Scissor test, if enabled, limits which pixels <code>glClear</code> touches. Viewport does not clip clears in the same way on all drivers — clear the whole buffer unless you know you need a partial clear.</div>
      <p><a class="btn goto-sim" href="#/GL2.5/sim">Try it: move the viewport and pick a clear mask →</a></p>
    `,
    keyFormulas: [
      ["Viewport", String.raw`\text{glViewport}(x,y,w,h)`],
      ["Clear", String.raw`\text{glClear}(\text{COLOR}\mid\text{DEPTH}\mid\text{STENCIL})`],
    ],
    exercises: [
      { q: "The window is resized. Which OpenGL call should you make?", a: "glViewport with the new framebuffer width and height." },
      { q: "You see a black screen even though you draw. Depth testing is on. What did you forget?", a: "GL_DEPTH_BUFFER_BIT in glClear, or glDisable(GL_DEPTH_TEST) if you did not mean to test." },
      { q: "Does glClearColor draw anything?", a: "No. It only stores the colour used by the next colour-buffer clear." },
    ],
    cpp: [{
      title: "Viewport callback and a full clear",
      code: String.raw`
void OnResize(GLFWwindow* /*window*/, int width, int height)
{
    glViewport(0, 0, width, height);
}

void BeginFrame()
{
    glClearColor(0.08f, 0.09f, 0.12f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
}
`,
    }],
    csharp: [{
      title: "Viewport callback and a full clear",
      code: String.raw`
public static void OnResize(int width, int height)
{
    GL.Viewport(0, 0, width, height);
}

public static void BeginFrame()
{
    GL.ClearColor(0.08f, 0.09f, 0.12f, 1f);
    GL.Clear(ClearBufferMask.ColorBufferBit | ClearBufferMask.DepthBufferBit);
}
`,
    }],
    sims: [{ title: "Viewport and clear mask", help: "<p>Resize the viewport rectangle and toggle colour/depth clears. Uncleared depth keeps old occupancy.</p>", mount: viewportClear }],
  });

  function setupChecklist(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const steps = ["Start GLFW", "Ask for OpenGL 3.3 core", "Create window", "Make context current", "Load GLAD"];
    const checks = steps.map((label, i) => sim.checkbox(controls, { label, value: i === 0, onChange: () => v.redraw() }));
    const v = sim.view2d(stage, { range: 4, height: 300 });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      const ready = checks.every((c) => c.value);
      steps.forEach((s, i) => {
        const ok = checks[i].value;
        view.rect([-3.5, 2.4 - i], [3.5, 1.7 - i], { color: ok ? "c" : "muted", fill: ok ? "c" : "panel", fillAlpha: .28 });
        view.text([-3.1, 2.05 - i], (ok ? "✓ " : "○ ") + s, { color: "fg", size: 15 });
      });
      out.set(sim.rows([["setup ready", ready ? "yes — gl* is safe" : "not yet"], ["steps complete", checks.filter((c) => c.value).length + " / 5"]]));
    });
  }

  function renderLoop(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 300 });
    const work = sim.slider(controls, { label: "Jobs this frame", min: 1, max: 5, step: 1, value: 5, onInput: () => v.redraw() });
    const jobs = ["input", "clear", "draw", "swap", "poll"];
    const out = sim.readout(readout);
    v.onDraw((view) => {
      jobs.forEach((job, i) => {
        const x = -4.5 + i * 1.85;
        view.rect([x, -0.7], [x + 1.55, 0.7], { color: i < work.value ? "a" : "muted", fill: i < work.value ? "a" : "panel", fillAlpha: .4 });
        view.text([x + 0.78, 0], job, { align: "center", color: "fg", size: 13 });
      });
      out.set(sim.rows([["jobs", work.value + " / 5"], ["repeat", "this sequence is one frame"], ["stop when", "glfwWindowShouldClose"]]));
    });
  }

  function trianglePipeline(sim) {
    const { stage, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 3, height: 320 });
    const x = v.handle([0, 1.5], { color: "a", label: "v3" });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      const p = [[-2, -1.4], [2, -1.4], x.pos];
      view.polygon(p, { color: "a", fill: "a", fillAlpha: .35 });
      p.forEach((q, i) => view.point(q, { color: "a", label: "v" + (i + 1) }));
      out.set(sim.rows([["vertices", "3"], ["draw call", "glDrawArrays(GL_TRIANGLES, 0, 3)"], ["NDC note", "corners already in clip/NDC for this hello triangle"]]));
    });
  }

  function doubleBuffer(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 320 });
    const phase = sim.select(controls, { label: "Moment", options: [["draw", "1. Draw into back"], ["swap", "2. After swap"], ["tear", "3. Swap mid-refresh"]], value: "draw", onChange: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      view.rect([-4.5, 0.4], [-0.4, 2.6], { color: "a", fill: "a", fillAlpha: phase.value === "swap" ? 0.7 : 0.25 });
      view.text([-2.45, 2.85], "front (visible)", { align: "center", color: "fg" });
      view.rect([0.4, 0.4], [4.5, 2.6], { color: "g", fill: "g", fillAlpha: phase.value === "draw" ? 0.7 : 0.25 });
      view.text([2.45, 2.85], "back (hidden)", { align: "center", color: "fg" });
      if (phase.value === "tear") {
        view.rect([-4.5, -2.4], [4.5, -0.4], { color: "a", fill: "a", fillAlpha: .35 });
        view.rect([-4.5, -2.4], [4.5, -1.4], { color: "g", fill: "g", fillAlpha: .55 });
        view.text([0, -0.15], "tear line", { align: "center", color: "e" });
      } else {
        view.rect([-4.5, -2.4], [4.5, -0.4], { color: phase.value === "swap" ? "g" : "a", fill: phase.value === "swap" ? "g" : "a", fillAlpha: .4 });
        view.text([0, -1.4], phase.value === "swap" ? "monitor shows new frame" : "monitor still shows old frame", { align: "center", color: "fg" });
      }
      out.set(sim.rows([["drawing into", phase.value === "swap" ? "the other buffer now" : "back"], ["v-sync", phase.value === "tear" ? "off — split refresh" : "on would wait for blank"]]));
    });
  }

  function viewportClear(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 320 });
    const w = sim.slider(controls, { label: "Viewport width", min: 1, max: 8, step: 1, value: 6, onInput: () => v.redraw() });
    const color = sim.checkbox(controls, { label: "Clear colour", value: true, onChange: () => v.redraw() });
    const depth = sim.checkbox(controls, { label: "Clear depth", value: true, onChange: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      view.rect([-4.5, -2.5], [4.5, 2.5], { color: "muted", fill: "panel", fillAlpha: .9 });
      const hw = w.value * 0.5;
      view.rect([-hw, -2], [hw, 2], { color: "a", fill: color.value ? "a" : "e", fillAlpha: color.value ? 0.45 : 0.2 });
      view.text([0, 0], color.value ? "cleared colour" : "old colour remains", { align: "center", color: "fg" });
      out.set(sim.rows([["glViewport width", w.value], ["COLOR bit", color.value ? "yes" : "no"], ["DEPTH bit", depth.value ? "yes" : "no — old depth can block draws"], ["mask", "OR the bits you need"]]));
    });
  }
})();
