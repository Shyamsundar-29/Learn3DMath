// Learn OpenGL — Chapter 5: Buffer Objects
(function () {
  "use strict";

  L3D.topic({
    id: "GL5.1",
    summary: "A buffer object is a GPU memory allocation. The binding target says how that memory will be used: vertices, indices, uniforms, pixels, copies, transform feedback.",
    lesson: String.raw`
      <p>OpenGL's general GPU allocation is the <strong>buffer object</strong>. You generate an id, bind it to a <strong>target</strong>, then allocate bytes. The same blob of memory can be rebound to another target later (with rules), but most objects stay on one target.</p>
      <div class="key"><p>The id names the memory. The target names the socket you plug it into: ARRAY, ELEMENT, UNIFORM, and friends.</p></div>

      <h2 data-sub="GL5.1.1">Named buffer objects</h2>
      <p><code>glGenBuffers</code> / <code>glDeleteBuffers</code>. Until you bind and call <code>glBufferData</code>, the name is unused storage. Core 4.5 also has <code>glCreateBuffers</code> (direct state access) so you can skip bind-to-edit.</p>

      <h2 data-sub="GL5.1.2">Binding targets</h2>
      <table>
        <tr><th>Target</th><th>Role</th></tr>
        <tr><td>GL_ARRAY_BUFFER</td><td>Vertex attributes (VBO)</td></tr>
        <tr><td>GL_ELEMENT_ARRAY_BUFFER</td><td>Indices (EBO), stored in the VAO</td></tr>
        <tr><td>GL_UNIFORM_BUFFER</td><td>Blocks of uniforms shared by programs</td></tr>
        <tr><td>GL_COPY_READ_BUFFER / GL_COPY_WRITE_BUFFER</td><td>glCopyBufferSubData endpoints</td></tr>
        <tr><td>GL_PIXEL_PACK_BUFFER</td><td>Async readback of pixels into a buffer</td></tr>
        <tr><td>GL_PIXEL_UNPACK_BUFFER</td><td>Texture uploads sourced from a buffer</td></tr>
        <tr><td>GL_TRANSFORM_FEEDBACK_BUFFER</td><td>Capture vertex-shader output</td></tr>
        <tr><td>GL_SHADER_STORAGE_BUFFER</td><td>Large read/write arrays (GL 4.3+)</td></tr>
        <tr><td>GL_TEXTURE_BUFFER</td><td>Buffer sampled as a 1D texture</td></tr>
      </table>

      <h2 data-sub="GL5.1.3">Usage hints</h2>
      <p>The last argument of <code>glBufferData</code> is a hint, not a lock:</p>
      <ul>
        <li><code>GL_STATIC_DRAW</code> — upload once, GPU reads many times (meshes, lookup tables)</li>
        <li><code>GL_DYNAMIC_DRAW</code> — CPU updates often, GPU draws often (UI, particles)</li>
        <li><code>GL_STREAM_DRAW</code> — CPU writes, GPU uses roughly once (per-frame scratch)</li>
      </ul>
      <p>The first word is CPU access (STATIC/DYNAMIC/STREAM). The second is who cares (DRAW = GPU draw, READ = CPU readback, COPY = GPU copy). Wrong hints rarely crash; they can slow you down.</p>
      <div class="game">A character mesh is STATIC_DRAW. A debug line batch rebuilt every frame is STREAM_DRAW.</div>
      <p><a class="btn goto-sim" href="#/GL5.1/sim">Try it: plug a buffer into a target →</a></p>
    `,
    keyFormulas: [
      ["Bind", String.raw`\text{glBindBuffer}(\text{target},\,id)`],
      ["Hint", String.raw`\text{GL\_STATIC\_DRAW},\ \text{GL\_DYNAMIC\_DRAW},\ \text{GL\_STREAM\_DRAW}`],
    ],
    exercises: [
      { q: "Which target holds triangle indices?", a: "GL_ELEMENT_ARRAY_BUFFER." },
      { q: "Which target would you use to share a camera matrix with every shader?", a: "GL_UNIFORM_BUFFER." },
      { q: "Does GL_STATIC_DRAW forbid later glBufferSubData?", a: "No. It is a performance hint. Updates still work, they may be slower." },
    ],
    cpp: [{
      title: "Allocate a static vertex buffer",
      code: String.raw`
GLuint AllocVBO(const void* data, int bytes)
{
    GLuint id = 0;
    glGenBuffers(1, &id);
    glBindBuffer(GL_ARRAY_BUFFER, id);
    glBufferData(GL_ARRAY_BUFFER, bytes, data, GL_STATIC_DRAW);
    return id;
}
`,
    }],
    csharp: [{
      title: "Allocate a static vertex buffer",
      code: String.raw`
public static int AllocVBO(float[] data)
{
    int id = GL.GenBuffer();
    GL.BindBuffer(BufferTarget.ArrayBuffer, id);
    GL.BufferData(BufferTarget.ArrayBuffer, data.Length * sizeof(float), data, BufferUsageHint.StaticDraw);
    return id;
}
`,
    }],
    sims: [{ title: "Buffer targets", help: "<p>The same buffer id can be bound to different sockets. The socket decides which OpenGL commands see it.</p>", mount: bufferTargets }],
  });

  L3D.topic({
    id: "GL5.2",
    summary: "glBufferData allocates (and optionally fills). glBufferSubData patches a range. Mapping gives the CPU a pointer — and a chance to stall if the GPU is still using the buffer.",
    lesson: String.raw`
      <p>There are three common ways to put bytes in a buffer. All of them copy from CPU-visible memory into GPU-visible memory, possibly later, possibly immediately.</p>
      <div class="key"><p>Allocate with <code>glBufferData</code>. Patch with <code>glBufferSubData</code>. Stream with <code>glMapBufferRange</code> and explicit flags.</p></div>

      <h2 data-sub="GL5.2.1">glBufferData</h2>
      <p><code>glBufferData(target, size, data, usage)</code> (re)allocates the whole buffer. <code>data</code> may be <code>nullptr</code> to allocate uninitialized storage you fill later. Calling it again on the same id orphans the old storage — a trick to avoid waiting on a buffer still in flight.</p>

      <h2 data-sub="GL5.2.2">glBufferSubData</h2>
      <p><code>glBufferSubData(target, offset, size, data)</code> writes a byte range. Size must stay inside the allocation. Good for updating a subset (one bone palette, one UI mesh).</p>

      <h2 data-sub="GL5.2.3">glMapBuffer</h2>
      <p><code>glMapBufferRange</code> returns a CPU pointer. You write, then <code>glUnmapBuffer</code>. Flags matter:</p>
      <ul>
        <li><code>GL_MAP_WRITE_BIT</code> — CPU will write</li>
        <li><code>GL_MAP_INVALIDATE_RANGE_BIT</code> — driver may give fresh memory instead of waiting</li>
        <li><code>GL_MAP_UNSYNCHRONIZED_BIT</code> — you promise not to overlap GPU use (dangerous if wrong)</li>
        <li><code>GL_MAP_FLUSH_EXPLICIT_BIT</code> + <code>glFlushMappedBufferRange</code> — you say which bytes changed</li>
      </ul>
      <div class="warn">Mapping a buffer the GPU is still reading can stall like a readback. Prefer orphan + write, or triple-buffer streaming, over mapping last frame's in-flight VBO.</div>
      <p><a class="btn goto-sim" href="#/GL5.2/sim">Try it: upload vs map vs stall →</a></p>
    `,
    keyFormulas: [
      ["Allocate", String.raw`\text{glBufferData}(\text{target},\,n,\,\text{ptr},\,\text{hint})`],
      ["Patch", String.raw`\text{glBufferSubData}(\text{target},\,\text{off},\,n,\,\text{ptr})`],
    ],
    exercises: [
      { q: "How do you allocate 1 KB without uploading yet?", a: "glBufferData(target, 1024, nullptr, hint)." },
      { q: "Why orphan a buffer (glBufferData with a new size/null) while streaming?", a: "The GPU can keep using the old storage; the CPU writes into new storage and avoids a stall." },
      { q: "Name one map flag that can hide a stall if you lie about overlapping use.", a: "GL_MAP_UNSYNCHRONIZED_BIT — you must guarantee the GPU is done." },
    ],
    cpp: [{
      title: "Patch a range, or orphan and refill",
      code: String.raw`
void UpdateRange(GLuint vbo, int offset, int bytes, const void* src)
{
    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glBufferSubData(GL_ARRAY_BUFFER, offset, bytes, src);
}

void OrphanAndFill(GLuint vbo, int bytes, const void* src)
{
    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glBufferData(GL_ARRAY_BUFFER, bytes, nullptr, GL_STREAM_DRAW); // orphan
    glBufferSubData(GL_ARRAY_BUFFER, 0, bytes, src);
}
`,
    }],
    csharp: [{
      title: "Patch a range, or orphan and refill",
      code: String.raw`
public static void UpdateRange(int vbo, int offset, int bytes, IntPtr src)
{
    GL.BindBuffer(BufferTarget.ArrayBuffer, vbo);
    GL.BufferSubData(BufferTarget.ArrayBuffer, (IntPtr)offset, bytes, src);
}

public static void OrphanAndFill(int vbo, int bytes, IntPtr src)
{
    GL.BindBuffer(BufferTarget.ArrayBuffer, vbo);
    GL.BufferData(BufferTarget.ArrayBuffer, bytes, IntPtr.Zero, BufferUsageHint.StreamDraw);
    GL.BufferSubData(BufferTarget.ArrayBuffer, IntPtr.Zero, bytes, src);
}
`,
    }],
    sims: [{ title: "Upload paths", help: "<p>Choose how the CPU writes. Mapping an in-flight buffer serializes CPU and GPU; orphaning does not.</p>", mount: uploadPaths }],
  });

  L3D.topic({
    id: "GL5.3",
    summary: "A uniform buffer object packs many uniforms into one GPU buffer. Shaders declare a uniform block; you bind the buffer to a binding point both sides agree on.",
    lesson: String.raw`
      <p>Setting 12 matrix uniforms on 50 shader programs every frame is a lot of <code>glUniform</code> calls. A <strong>uniform buffer object (UBO)</strong> holds those bytes once. Every program that declares the same <strong>uniform block</strong> can read them.</p>
      <div class="key"><p>Upload camera matrices into a UBO once per frame. Bind that UBO to a slot. All programs read the slot.</p></div>

      <h2 data-sub="GL5.3.1">Shared uniforms</h2>
      <p>In GLSL:</p>
      <pre><code>layout(std140) uniform Camera {
    mat4 uView;
    mat4 uProj;
};</code></pre>
      <p>On the CPU, fill a matching struct (with std140 padding!) and <code>glBufferSubData</code> into a buffer created with target <code>GL_UNIFORM_BUFFER</code>.</p>

      <h2 data-sub="GL5.3.2">Binding points</h2>
      <p>There are numbered sockets, independent of texture units:</p>
      <ol>
        <li><code>glBindBufferBase(GL_UNIFORM_BUFFER, 0, ubo)</code> — buffer on slot 0</li>
        <li><code>glUniformBlockBinding(program, blockIndex, 0)</code> — this program's block reads slot 0</li>
      </ol>
      <p><code>blockIndex</code> comes from <code>glGetUniformBlockIndex(program, "Camera")</code>. You can also write <code>layout(std140, binding = 0)</code> in GLSL 4.2+.</p>

      <h2 data-sub="GL5.3.3">std140 layout</h2>
      <p>std140 aligns vec3 as if it were vec4, and matrices as columns of vec4. A naive C++ struct with a <code>vec3</code> then a <code>float</code> will not match. Pad explicitly, or query offsets with <code>glGetActiveUniformsiv</code>. This is the #1 UBO bug.</p>
      <div class="note">Shader storage buffers (SSBO) are larger and writable from shaders. UBOs are smaller, faster, read-only in classic shaders, and perfect for camera + lights.</div>
      <p><a class="btn goto-sim" href="#/GL5.3/sim">Try it: one UBO, many programs →</a></p>
    `,
    keyFormulas: [
      ["Slot", String.raw`\text{glBindBufferBase}(\text{GL\_UNIFORM\_BUFFER},\,n,\,\text{ubo})`],
      ["std140 vec3", String.raw`\text{vec3 occupies }16\text{ bytes}`],
    ],
    exercises: [
      { q: "Why bind a UBO to a numbered slot instead of to a program?", a: "Many programs can read the same slot. You upload camera data once." },
      { q: "A C struct is vec3 plus float. Why might GLSL read the float wrong?", a: "std140 pads vec3 to 16 bytes, so the float sits at offset 16, not 12." },
      { q: "Which call attaches a block name inside one program to slot 0?", a: "glUniformBlockBinding(program, blockIndex, 0)." },
    ],
    cpp: [{
      title: "Bind a UBO to slot 0",
      code: String.raw`
void BindCameraUBO(GLuint program, GLuint ubo)
{
    GLuint block = glGetUniformBlockIndex(program, "Camera");
    glUniformBlockBinding(program, block, 0);
    glBindBufferBase(GL_UNIFORM_BUFFER, 0, ubo);
}
`,
    }],
    csharp: [{
      title: "Bind a UBO to slot 0",
      code: String.raw`
public static void BindCameraUBO(int program, int ubo)
{
    int block = GL.GetUniformBlockIndex(program, "Camera");
    GL.UniformBlockBinding(program, block, 0);
    GL.BindBufferBase(BufferRangeTarget.UniformBuffer, 0, ubo);
}
`,
    }],
    sims: [{ title: "Shared uniform block", help: "<p>Change the shared camera slot. Every bound program reads the same UBO bytes.</p>", mount: uboShare }],
  });

  L3D.topic({
    id: "GL5.4",
    summary: "OpenGL calls are asynchronous. Waiting for the GPU — readbacks, glFinish, mapping busy memory — turns two processors into one slow line.",
    lesson: String.raw`
      <p>After <code>glDraw*</code> returns, the GPU may still be working. The driver queues commands. You only wait when you <em>need</em> a result on the CPU, or when the queue is full (often at swap).</p>
      <div class="key"><p>Never wait unless you must. If you must, wait as late as possible, and wait on a fence for a specific GPU job, not the whole pipeline.</p></div>

      <h2 data-sub="GL5.4.1">Asynchronous commands</h2>
      <p>Uploads, draws, and even some texture copies are fire-and-forget. The CPU should spend that time on game logic. Overlap is the whole point of a separate GPU.</p>

      <h2 data-sub="GL5.4.2">Readbacks and stalls</h2>
      <p><code>glReadPixels</code> into client memory, <code>glGetTexImage</code>, <code>glFinish</code>, and a blocking map of a busy buffer all say: “CPU cannot continue until the GPU reaches this point.” Screenshots and GPU-to-CPU physics need readback; do them via a <strong>pixel pack buffer</strong> one or two frames later so the wait hits old work, not this frame.</p>

      <h2 data-sub="GL5.4.3">Fences</h2>
      <p><code>GLsync s = glFenceSync(GL_SYNC_GPU_COMMANDS_COMPLETE, 0);</code> plants a flag in the command stream. Later, <code>glClientWaitSync</code> asks if the GPU has passed it. Use a timeout of 0 to poll. This is how streaming vertex systems know a ring-buffer slot is free.</p>
      <div class="game">CPU-bound games wait at swap because the GPU is already idle. GPU-bound games fill the queue; the CPU blocks on the next swap or the next buffer map. Fences let you wait on <em>just enough</em>.</div>
      <p><a class="btn goto-sim" href="#/GL5.4/sim">Try it: stall vs fence overlap →</a></p>
    `,
    keyFormulas: [
      ["Fence", String.raw`\text{glFenceSync}\ \rightarrow\ \text{glClientWaitSync}`],
      ["Hard wait", String.raw`\text{glFinish},\ \text{glReadPixels into RAM}`],
    ],
    exercises: [
      { q: "Why is glFinish in the render loop a bad default?", a: "It drains the GPU pipeline every frame and kills CPU/GPU overlap." },
      { q: "How can a screenshot avoid stalling this frame?", a: "Write pixels into a PBO, wait a frame or two, then map the PBO." },
      { q: "What does a fence tell you that glFinish does not?", a: "That GPU work up to a chosen point is done, without waiting for later queued work you may still want in flight." },
    ],
    cpp: [{
      title: "Poll a fence without spinning the GPU idle",
      code: String.raw`
int SlotReady(GLsync fence)
{
    if (!fence) return 1;
    GLenum r = glClientWaitSync(fence, 0, 0); // timeout 0 = poll
    return r == GL_ALREADY_SIGNALED || r == GL_CONDITION_SATISFIED;
}
`,
    }],
    csharp: [{
      title: "Poll a fence without spinning the GPU idle",
      code: String.raw`
public static bool SlotReady(IntPtr fence)
{
    if (fence == IntPtr.Zero) return true;
    WaitSyncStatus r = GL.ClientWaitSync(fence, ClientWaitSyncFlags.None, 0);
    return r == WaitSyncStatus.AlreadySignaled || r == WaitSyncStatus.ConditionSatisfied;
}
`,
    }],
    sims: [{ title: "Stall vs overlap", help: "<p>Turn on a CPU readback. The two timelines stop overlapping. A fence waits only until a marked command finishes.</p>", mount: syncSim }],
  });

  function bufferTargets(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 320 });
    const t = sim.select(controls, {
      label: "Bind buffer 7 to",
      options: [["array", "GL_ARRAY_BUFFER"], ["element", "GL_ELEMENT_ARRAY_BUFFER"], ["uniform", "GL_UNIFORM_BUFFER"], ["pack", "GL_PIXEL_PACK_BUFFER"]],
      value: "array",
      onChange: () => v.redraw(),
    });
    const meaning = {
      array: "vertex fetches / glVertexAttribPointer",
      element: "glDrawElements index source (via VAO)",
      uniform: "shader uniform block bytes",
      pack: "async glReadPixels destination",
    };
    const out = sim.readout(readout);
    v.onDraw((view) => {
      const labels = [["array", "ARRAY"], ["element", "ELEMENT"], ["uniform", "UNIFORM"], ["pack", "PBO PACK"]];
      labels.forEach((pair, i) => {
        const x = -4.4 + i * 2.25;
        const on = t.value === pair[0];
        view.rect([x, -0.4], [x + 2.05, 1.6], { color: on ? "a" : "muted", fill: on ? "a" : "panel", fillAlpha: .4 });
        view.text([x + 1.02, 0.6], pair[1], { align: "center", color: "fg", size: 13 });
      });
      view.rect([-1.2, -2.2], [1.2, -1.1], { color: "g", fill: "g", fillAlpha: .5 });
      view.text([0, -1.65], "buffer id 7", { align: "center", color: "fg", size: 14 });
      out.set(sim.rows([["glBindBuffer", t.value], ["GPU sees it as", meaning[t.value]]]));
    });
  }

  function uploadPaths(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 300 });
    const mode = sim.select(controls, {
      label: "CPU write method",
      options: [["data", "glBufferData (full realloc)"], ["sub", "glBufferSubData"], ["mapStall", "map busy buffer"], ["orphan", "orphan then fill"]],
      value: "sub",
      onChange: () => v.redraw(),
    });
    const out = sim.readout(readout);
    const story = {
      data: ["new allocation", "old bytes may be freed", "simple, can hitch if large"],
      sub: ["patch range", "GPU may wait if using that range", "good for small updates"],
      mapStall: ["CPU pointer", "waits until GPU is done", "easy to hitch"],
      orphan: ["new storage, old still in flight", "no wait", "preferred stream pattern"],
    };
    v.onDraw((view) => {
      const s = story[mode.value];
      view.rect([-4, 0.4], [4, 2], { color: mode.value === "mapStall" ? "e" : "c", fill: mode.value === "mapStall" ? "e" : "c", fillAlpha: .35 });
      view.text([0, 1.2], s[0], { align: "center", color: "fg", size: 18 });
      out.set(sim.rows([["method", mode.value], ["what you get", s[0]], ["in-flight draws", s[1]], ["note", s[2]]]));
    });
  }

  function uboShare(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 4, height: 300 });
    const slot = sim.slider(controls, { label: "Camera UBO value (fake yaw)", min: 0, max: 360, step: 1, value: 40, unit: "°", onInput: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      view.rect([-3.4, 1.0], [3.4, 2.3], { color: "g", fill: "g", fillAlpha: .35 });
      view.text([0, 1.65], "UBO slot 0  yaw=" + slot.value + "°", { align: "center", color: "fg" });
      ["program A", "program B", "program C"].forEach((n, i) => {
        const x = -3.3 + i * 2.3;
        view.rect([x, -1.6], [x + 2.1, 0.4], { color: "a", fill: "a", fillAlpha: .3 });
        view.text([x + 1.05, -0.6], n, { align: "center", color: "fg", size: 13 });
      });
      out.set(sim.rows([["glBindBufferBase slot", "0"], ["programs reading it", "A, B, C"], ["CPU uploads", "once per frame, not per program"]]));
    });
  }

  function syncSim(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 320 });
    const mode = sim.select(controls, { label: "Sync style", options: [["async", "No wait"], ["finish", "glFinish / readback"], ["fence", "Fence after last draw"]], value: "async", onChange: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      function bar(y, x0, x1, color, label) {
        view.rect([x0, y], [x1, y + 0.7], { color, fill: color, fillAlpha: .55 });
        view.text([x0 + 0.1, y + 0.35], label, { color: "fg", size: 13 });
      }
      if (mode.value === "async") {
        bar(1.2, -4, -1, "a", "CPU");
        bar(0.2, -3.2, 2.5, "g", "GPU still working");
      } else if (mode.value === "finish") {
        bar(1.2, -4, 2.5, "e", "CPU blocked");
        bar(0.2, -4, 2.5, "g", "GPU then CPU resume");
      } else {
        bar(1.2, -4, -0.5, "a", "CPU other work");
        bar(0.2, -3.2, 0.8, "g", "GPU to fence");
        view.text([1.2, 0.55], "wait here only", { color: "e", size: 13 });
      }
      out.set(sim.rows([["mode", mode.value], ["overlap", mode.value === "finish" ? "none" : "yes"], ["use when", mode.value === "async" ? "always, by default" : mode.value === "fence" ? "reusing a ring-buffer slot" : "debugging only"]]));
    });
  }
})();
