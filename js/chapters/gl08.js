// Learn OpenGL — Chapter 8: Drawing Efficiently
(function () {
  "use strict";
  const { fmt } = L3D.math;

  L3D.topic({
    id: "GL8.1",
    summary: "Instancing draws the same mesh many times in one call. Per-instance attributes or gl_InstanceID provide the unique data for each copy.",
    lesson: String.raw`
      <p>Drawing 2,000 trees as 2,000 <code>glDrawElements</code> calls wastes CPU time in the driver. <strong>Instancing</strong> issues one draw: “this VAO, this index range, \(N\) copies.”</p>
      <div class="key"><p><code>glDrawElementsInstanced(..., N)</code>. Each copy can read a per-instance attribute (a matrix, a colour) or <code>gl_InstanceID</code> in the vertex shader.</p></div>

      <h2 data-sub="GL8.1.1">One mesh, many copies</h2>
      <p>The VBO of the tree stays the same. What changes per copy is usually a model matrix or a world offset. Pack those into a second VBO.</p>

      <h2 data-sub="GL8.1.2">Instance attributes</h2>
      <p>After <code>glVertexAttribPointer</code> for the instance data, call <code>glVertexAttribDivisor(index, 1)</code>: advance this attribute once per instance instead of once per vertex. A mat4 uses four vec4 attributes with consecutive locations, each with divisor 1.</p>

      <h2 data-sub="GL8.1.3">glDrawArraysInstanced</h2>
      <p>Arrays and elements both have instanced variants. <code>baseInstance</code> (GL 4.2) lets you pick a starting instance in the instance buffer. Keep instance counts high enough to pay for the call; tiny N can be slower than a simple loop on some drivers.</p>
      <div class="game">Grass, debris, bullets, and crowd impostors are classic instanced draws. Unique skeletal characters usually cannot share one instance buffer as easily.</div>
      <p><a class="btn goto-sim" href="#/GL8.1/sim">Try it: instance count →</a></p>
    `,
    keyFormulas: [
      ["Instanced draw", String.raw`\text{glDrawElementsInstanced}(\text{mode}, n_{\text{idx}}, \text{type}, 0, N)`],
      ["Divisor", String.raw`\text{glVertexAttribDivisor}(i, 1)`],
    ],
    exercises: [
      { q: "What does a divisor of 1 mean?", a: "The attribute advances once per instance, not per vertex." },
      { q: "Where does gl_InstanceID come from?", a: "The pipeline, automatically, during an instanced draw." },
      { q: "Why not instance every unique hero mesh?", a: "They do not share vertex data or even shaders; instancing pays off when the mesh is the same." },
    ],
    cpp: [{
      title: "Instanced indexed draw",
      code: String.raw`
void DrawTrees(GLuint vao, int indexCount, int treeCount)
{
    glBindVertexArray(vao);
    glDrawElementsInstanced(GL_TRIANGLES, indexCount, GL_UNSIGNED_INT, nullptr, treeCount);
}
`,
    }],
    csharp: [{
      title: "Instanced indexed draw",
      code: String.raw`
public static void DrawTrees(int vao, int indexCount, int treeCount)
{
    GL.BindVertexArray(vao);
    GL.DrawElementsInstanced(PrimitiveType.Triangles, indexCount, DrawElementsType.UnsignedInt, IntPtr.Zero, treeCount);
}
`,
    }],
    sims: [{ title: "Instances of one mesh", help: "<p>Raise N. One draw call stamps the same triangle many times with a per-instance offset.</p>", mount: instancing }],
  });

  L3D.topic({
    id: "GL8.2",
    summary: "A cubemap is six square textures treated as the faces of a cube. You sample it with a 3D direction, not a 2D uv — perfect for skyboxes and environment reflections.",
    lesson: String.raw`
      <p>Bind target <code>GL_TEXTURE_CUBE_MAP</code>. Upload six faces: <code>GL_TEXTURE_CUBE_MAP_POSITIVE_X</code> through <code>NEGATIVE_Z</code>. All faces must be the same size and format. Sample in GLSL with <code>samplerCube</code> and a direction vector.</p>
      <div class="key"><p>The lookup vector is a direction from the centre of the cube. Face selection is done by the GPU from the largest component of that vector.</p></div>

      <h2 data-sub="GL8.2.1">Six faces</h2>
      <p>Conventions for which way +X looks matter for seams. LearnOpenGL and this site follow the usual OpenGL cubemap orientation (the math book’s cube-map table matches). Generate mipmaps after all six faces exist.</p>

      <h2 data-sub="GL8.2.2">Sampling with a direction</h2>
      <p><code>vec3 dir = normalize(vWorldPos - uCameraPos);</code> then <code>texture(uEnv, dir)</code>. For a skybox, the direction is the vertex position of a cube around the camera (translation removed).</p>

      <h2 data-sub="GL8.2.3">Skyboxes</h2>
      <p>Draw a cube, sample the cubemap with the local position, depth function <code>GL_LEQUAL</code>, and a vertex shader that strips translation from the view matrix so the box follows the camera. Cull the front faces or invert winding so you see the interior.</p>
      <div class="note">Seams show if wrap is wrong; cubemaps should use <code>GL_CLAMP_TO_EDGE</code> on R, S, T.</div>
      <p><a class="btn goto-sim" href="#/GL8.2/sim">Try it: pick a cubemap direction →</a></p>
    `,
    keyFormulas: [
      ["Sample", String.raw`c=\text{texture}(\text{samplerCube},\,\mathbf d)`],
      ["Face", String.raw`\text{face}=\arg\max |d_x|,|d_y|,|d_z|`],
    ],
    exercises: [
      { q: "What coordinate do you pass a samplerCube?", a: "A 3D direction, not a 2D uv." },
      { q: "Why clamp cubemap edges?", a: "To avoid filtering across the opposite edge of a face, which makes a visible seam." },
      { q: "How does a skybox stay around the camera?", a: "Use a view matrix without translation (and usually without scale) on the skybox vertices." },
    ],
    cpp: [{
      title: "Upload one cubemap face",
      code: String.raw`
void SetCubeFace(GLenum face, int w, int h, const unsigned char* rgb)
{
    glTexImage2D(face, 0, GL_RGB8, w, h, 0, GL_RGB, GL_UNSIGNED_BYTE, rgb);
}
`,
    }],
    csharp: [{
      title: "Upload one cubemap face",
      code: String.raw`
public static void SetCubeFace(TextureTarget face, int w, int h, byte[] rgb)
{
    GL.TexImage2D(face, 0, PixelInternalFormat.Rgb8, w, h, 0, PixelFormat.Rgb, PixelType.UnsignedByte, rgb);
}
`,
    }],
    sims: [{ title: "Cubemap faces", help: "<p>Aim a direction vector. The GPU picks the face with the largest component and samples that image.</p>", mount: cubemap }],
  });

  L3D.topic({
    id: "GL8.3",
    summary: "Optional stages sit between vertex and fragment: tessellation subdivides patches, a geometry shader can emit extra primitives, and compute shaders run grids of work with no triangles at all.",
    lesson: String.raw`
      <p>Core 3.3 programs need only vertex + fragment. Later GL versions add stages you enable by attaching extra shaders to the same program (or a different pipeline).</p>
      <div class="key"><p>If you do not attach a geometry or tessellation shader, those stages are skipped. Compute is a separate dispatch, not a draw.</p></div>

      <h2 data-sub="GL8.3.1">Geometry shader</h2>
      <p>Runs once per assembled primitive. It can emit zero or more primitives of a (possibly different) type. Examples: expand a point into a camera-facing quad, draw normals as lines, explode triangles. Expensive if overused; instancing or vertex expansion on the CPU/compute can be faster.</p>
      <p>GLSL: <code>layout(triangles) in;</code> <code>layout(line_strip, max_vertices = 6) out;</code> then <code>EmitVertex</code> / <code>EndPrimitive</code>.</p>

      <h2 data-sub="GL8.3.2">Tessellation</h2>
      <p>A control shader sets tessellation factors; the primitive generator subdivides a patch; an evaluation shader places the new vertices (often sampling a heightmap). Great for terrain and subdivision surfaces. Requires <code>GL_PATCHES</code> draws and <code>glPatchParameteri</code>.</p>

      <h2 data-sub="GL8.3.3">Compute shaders</h2>
      <p><code>glDispatchCompute(gx, gy, gz)</code> launches a 3D grid of work groups. No VAO, no rasterizer. Read and write SSBOs, images, and counters. Use for culling, particles, blur, and anything that is not “turn triangles into pixels.”</p>
      <div class="game">Modern engines mix all of these. This course’s baseline renderer can stay at VS+FS; know the extra stages so APIs in docs are not a surprise.</div>
      <p><a class="btn goto-sim" href="#/GL8.3/sim">Try it: geometry shader expansion →</a></p>
    `,
    keyFormulas: [
      ["GS emit", String.raw`\text{in primitive}\ \rightarrow\ \text{EmitVertex}^*`],
      ["Compute", String.raw`\text{glDispatchCompute}(g_x,g_y,g_z)`],
    ],
    exercises: [
      { q: "Does a program without a geometry shader still draw triangles?", a: "Yes. The geometry stage is skipped." },
      { q: "How do you start a compute shader?", a: "glDispatchCompute (or glDispatchComputeIndirect), not glDraw*." },
      { q: "Name one good geometry-shader demo and one reason not to use GS for everything.", a: "Normal visualisation is a good demo. GS can be slower than CPU/compute expansion for huge meshes." },
    ],
    cpp: [{
      title: "Dispatch a compute grid",
      code: String.raw`
void RunBlur(GLuint computeProgram, int width, int height)
{
    glUseProgram(computeProgram);
    glDispatchCompute((width + 7) / 8, (height + 7) / 8, 1);
    glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT);
}
`,
    }],
    csharp: [{
      title: "Dispatch a compute grid",
      code: String.raw`
public static void RunBlur(int computeProgram, int width, int height)
{
    GL.UseProgram(computeProgram);
    GL.DispatchCompute((width + 7) / 8, (height + 7) / 8, 1);
    GL.MemoryBarrier(MemoryBarrierFlags.ShaderImageAccessBarrierBit);
}
`,
    }],
    sims: [{ title: "Geometry shader expand", help: "<p>A geometry shader can turn one triangle into three line segments (the edges) by emitting extra vertices.</p>", mount: geomExpand }],
  });

  L3D.topic({
    id: "GL8.4",
    summary: "The GPU wants long stretches of similar work. Sorting by shader and texture, merging meshes, and avoiding CPU/GPU stalls keep both processors busy.",
    lesson: String.raw`
      <p>A correct renderer can still be slow. Two hidden costs dominate OpenGL apps: <strong>too many draws / state changes</strong> on the CPU–driver side, and <strong>starving or overloading</strong> the GPU.</p>
      <div class="key"><p>Bind a shader, then draw everything that uses it. Bind a texture atlas, then draw everything that uses it. Measure whether you are CPU-bound or GPU-bound before optimizing the other side.</p></div>

      <h2 data-sub="GL8.4.1">State-change cost</h2>
      <p>Changing programs, FBOs, and vertex formats is dearer than changing one uniform. Validation happens in the driver. Group objects by pipeline state (the engine’s “render queue”).</p>

      <h2 data-sub="GL8.4.2">Batching</h2>
      <p>Merge static meshes that share a material into one VBO/EBO. Use instancing for repeated meshes. Texture atlases and array textures avoid unit binds. Indirect draws (GL 4.0+) let compute shaders write draw commands the GPU consumes without a CPU round-trip.</p>

      <h2 data-sub="GL8.4.3">CPU vs GPU bound</h2>
      <p>If <code>glFinish</code> (debug only!) barely changes frame time, you were GPU-bound. If it increases frame time a lot, you had overlap and should not call it. Timers: <code>GL_TIME_ELAPSED</code> queries for GPU, CPU clocks around submit. Upload textures and meshes on load, not in the hottest loop. Watch stalls from Chapter 5.</p>
      <div class="note">Vulkan and DX12 expose command buffers you record yourself. OpenGL hides them; you still win by behaving as if they were expensive to start.</div>
      <p><a class="btn goto-sim" href="#/GL8.4/sim">Try it: state changes vs batches →</a></p>
    `,
    keyFormulas: [
      ["Submit cost", String.raw`t_{\text{CPU}}\approx n_{\text{draws}}\times t_{\text{state}}`],
      ["Frame", String.raw`t_{\text{frame}}\approx\max(t_{\text{CPU}}, t_{\text{GPU}})`],
    ],
    exercises: [
      { q: "You have 5,000 identical crates. What API helps?", a: "Instancing (or merge into one mesh)." },
      { q: "You switch shader for every object. Why is that painful?", a: "Each program bind is a heavy state change. Sort by shader." },
      { q: "How do you tell CPU-bound from GPU-bound?", a: "Profile both sides. If the GPU timer is full and CPU is waiting on swap, GPU-bound; if the CPU is busy submitting and the GPU is idle, CPU-bound." },
    ],
    cpp: [{
      title: "Sort-friendly draw: bind once",
      code: String.raw`
void DrawMaterialBatch(GLuint program, GLuint texture, const GLuint* vaos, const int* counts, int n)
{
    glUseProgram(program);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, texture);
    for (int i = 0; i < n; ++i)
    {
        glBindVertexArray(vaos[i]);
        glDrawElements(GL_TRIANGLES, counts[i], GL_UNSIGNED_INT, nullptr);
    }
}
`,
    }],
    csharp: [{
      title: "Sort-friendly draw: bind once",
      code: String.raw`
public static void DrawMaterialBatch(int program, int texture, int[] vaos, int[] counts)
{
    GL.UseProgram(program);
    GL.ActiveTexture(TextureUnit.Texture0);
    GL.BindTexture(TextureTarget.Texture2D, texture);
    for (int i = 0; i < vaos.Length; ++i)
    {
        GL.BindVertexArray(vaos[i]);
        GL.DrawElements(PrimitiveType.Triangles, counts[i], DrawElementsType.UnsignedInt, 0);
    }
}
`,
    }],
    sims: [{ title: "Batches vs chatter", help: "<p>Each extra state change adds CPU bars. Grouping objects that share a shader into one batch shortens the CPU timeline.</p>", mount: batching }],
  });

  function instancing(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 300 });
    const n = sim.slider(controls, { label: "instance count N", min: 1, max: 12, step: 1, value: 6, onInput: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      for (let i = 0; i < n.value; i++) {
        const x = -4 + (i % 6) * 1.4;
        const y = i < 6 ? -0.2 : 1.4;
        view.polygon([[x, y], [x + 1, y], [x + 0.5, y + 1]], { color: "a", fill: "a", fillAlpha: 0.5 });
      }
      out.set(sim.rows([["glDrawArraysInstanced count", n.value], ["CPU draw calls", "1"], ["unique mesh", "same three vertices every instance"]]));
    });
  }

  function cubemap(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 320 });
    const face = sim.select(controls, {
      label: "Largest |component|",
      options: [["px", "+X"], ["nx", "−X"], ["py", "+Y"], ["ny", "−Y"], ["pz", "+Z"], ["nz", "−Z"]],
      value: "pz",
      onChange: () => v.redraw(),
    });
    const colors = { px: "#e66", nx: "#6c6", py: "#66d", ny: "#cc6", pz: "#6cc", nz: "#c6e" };
    const out = sim.readout(readout);
    v.onDraw((view) => {
      const names = [["nx", -3.2, 0], ["pz", -1.1, 0], ["px", 1.0, 0], ["nz", 3.1, 0], ["py", -1.1, 2.1], ["ny", -1.1, -2.1]];
      names.forEach(([id, x, y]) => {
        const on = face.value === id;
        view.rect([x - 0.9, y - 0.9], [x + 0.9, y + 0.9], { color: colors[id], fill: colors[id], fillAlpha: on ? 1 : 0.35 });
        view.text([x, y], id, { align: "center", color: "fg", size: 14 });
      });
      out.set(sim.rows([["sampled face", face.value], ["GLSL", "texture(uEnv, dir)"], ["wrap", "CLAMP_TO_EDGE on S/T/R"]]));
    });
  }

  function geomExpand(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 3.5, height: 300 });
    const mode = sim.select(controls, { label: "Geometry shader out", options: [["tri", "passthrough triangle"], ["edges", "emit 3 lines"]], value: "edges", onChange: () => v.redraw() });
    const out = sim.readout(readout);
    const p = [[-2, -1.3], [2, -1.3], [0, 1.6]];
    v.onDraw((view) => {
      if (mode.value === "tri") view.polygon(p, { color: "a", fill: "a", fillAlpha: 0.4 });
      else {
        view.line(p[0], p[1], { color: "g", width: 3 });
        view.line(p[1], p[2], { color: "g", width: 3 });
        view.line(p[2], p[0], { color: "g", width: 3 });
      }
      p.forEach((q, i) => view.point(q, { color: "a", label: "v" + i }));
      out.set(sim.rows([["in", "one triangle"], ["out", mode.value === "tri" ? "one triangle (Emit 3 vertices)" : "line_strip × 3 edges"], ["API", "layout(triangles) in; EmitVertex();"]]));
    });
  }

  function batching(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 300 });
    const changes = sim.slider(controls, { label: "Shader binds / frame", min: 1, max: 12, step: 1, value: 8, onInput: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      const n = changes.value;
      for (let i = 0; i < n; i++) {
        const x = -4.5 + (i % 6) * 1.5;
        const y = i < 6 ? 0.6 : -1.6;
        view.rect([x, y], [x + 1.3, y + 1.1], { color: "e", fill: "e", fillAlpha: 0.45 });
        view.text([x + 0.65, y + 0.55], "bind", { align: "center", color: "fg", size: 12 });
      }
      const cpu = n * 2;
      const gpu = 8;
      out.set(sim.rows([["state changes", n], ["CPU cost (toy units)", cpu], ["GPU fill (toy units)", gpu], ["bound by", cpu > gpu ? "CPU / driver" : "GPU"], ["fix", "sort by program, atlas textures, instance"]]));
    });
  }
})();
