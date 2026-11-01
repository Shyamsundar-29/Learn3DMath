// Learn OpenGL — Chapter 3: Vertex Data and Drawing
(function () {
  "use strict";
  const { fmt } = L3D.math;

  L3D.topic({
    id: "GL3.1",
    summary: "A vertex is a record of attributes (position, colour, uv, …). glVertexAttribPointer tells OpenGL the stride, offset, type, and shader location of each attribute.",
    lesson: String.raw`
      <p>A <strong>vertex</strong> is not only a position. It is a bundle of numbers the vertex shader will read as <code>in</code> variables: position, colour, texture coordinate, normal, tangent, bone weights — whatever you packed.</p>
      <div class="key"><p>CPU packs bytes. <code>glVertexAttribPointer</code> is the map from those bytes to a shader input location.</p></div>

      <h2 data-sub="GL3.1.1">What a vertex stores</h2>
      <p>A packed layout might be 8 floats per vertex: \(x,y,z,r,g,b,u,v\). That is 32 bytes. The GPU does not guess the meaning; you declare it.</p>

      <h2 data-sub="GL3.1.2">Attribute layout</h2>
      <p><code>glVertexAttribPointer(index, size, type, normalized, stride, offset)</code>:</p>
      <ul>
        <li><strong>index</strong> — shader location (<code>layout(location = 0)</code>)</li>
        <li><strong>size</strong> — components (3 for a vec3)</li>
        <li><strong>type</strong> — <code>GL_FLOAT</code>, <code>GL_UNSIGNED_BYTE</code>, …</li>
        <li><strong>normalized</strong> — convert integers to \(0..1\) or \(-1..1\)</li>
        <li><strong>stride</strong> — bytes from one vertex to the next (0 means tightly packed <em>for that attribute alone</em>; with interleaved data pass the full vertex size)</li>
        <li><strong>offset</strong> — byte offset of this attribute inside the vertex</li>
      </ul>
      <p>Enable each used location with <code>glEnableVertexAttribArray(index)</code>.</p>

      <h2 data-sub="GL3.1.3">Interleaved vs separate</h2>
      <p><strong>Interleaved:</strong> one VBO, <code>[pos col uv pos col uv …]</code>. Good cache behaviour, one bind. <strong>Separate:</strong> one VBO per attribute. Easier to update only positions. Most tutorials interleave.</p>
      <div class="warn">Stride and offset are in <em>bytes</em>, not floats. Forcing <code>3 * sizeof(float)</code> when the vertex is actually 8 floats is a classic garbage-triangle bug.</div>
      <p><a class="btn goto-sim" href="#/GL3.1/sim">Try it: inspect an interleaved vertex →</a></p>
    `,
    keyFormulas: [
      ["Stride", String.raw`\text{stride}=\text{bytes per vertex}`],
      ["Offset of uv", String.raw`\text{offset}(uv)=(\text{pos comps}+\text{colour comps})\times 4`],
    ],
    exercises: [
      { q: "A vertex is 3 floats of position and 2 floats of uv. What stride do you pass?", a: "5 * sizeof(float) = 20 bytes." },
      { q: "What is the offset of uv in that vertex?", a: "3 * sizeof(float) = 12 bytes." },
      { q: "What happens if you forget glEnableVertexAttribArray?", a: "The shader reads a constant (often 0) instead of VBO data." },
    ],
    cpp: [{
      title: "Interleaved position + uv",
      formula: String.raw`\text{stride}=5\times 4`,
      code: String.raw`
void BindPosUvAttributes()
{
    const int stride = 5 * (int)sizeof(float);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, stride, (void*)0);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, stride, (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);
}
`,
    }],
    csharp: [{
      title: "Interleaved position + uv",
      formula: String.raw`\text{stride}=5\times 4`,
      code: String.raw`
public static void BindPosUvAttributes()
{
    int stride = 5 * sizeof(float);
    GL.VertexAttribPointer(0, 3, VertexAttribPointerType.Float, false, stride, 0);
    GL.EnableVertexAttribArray(0);
    GL.VertexAttribPointer(1, 2, VertexAttribPointerType.Float, false, stride, 3 * sizeof(float));
    GL.EnableVertexAttribArray(1);
}
`,
    }],
    sims: [{ title: "Interleaved vertex record", help: "<p>Choose which attribute to highlight. Stride is the full record; offset is where that field starts.</p>", mount: attribLayout }],
  });

  L3D.topic({
    id: "GL3.2",
    summary: "A VBO holds vertex bytes in VRAM. A VAO remembers which VBOs are bound and how attributes are fetched, so a later draw is one bind plus a draw call.",
    lesson: String.raw`
      <p>Two objects work together. The <strong>vertex buffer object (VBO)</strong> is a block of GPU memory. The <strong>vertex array object (VAO)</strong> is a small record of fetch state: attribute enables, strides, offsets, and the element buffer.</p>
      <div class="key"><p>Fill VBOs once. Record the layout in a VAO. Each frame: bind VAO, draw.</p></div>

      <h2 data-sub="GL3.2.1">Vertex buffer objects</h2>
      <p>Target <code>GL_ARRAY_BUFFER</code>. <code>glBufferData</code> allocates and fills. Usage hint <code>GL_STATIC_DRAW</code> means “upload once, draw many times.” The hint does not forbid updates; it guides the driver.</p>

      <h2 data-sub="GL3.2.2">Vertex array objects</h2>
      <p>Generate a VAO, bind it, then set attribute pointers. Those pointers are stored <em>in the VAO</em>, and they remember which VBO was bound as <code>GL_ARRAY_BUFFER</code> at pointer-set time. Rebind a different VBO later without changing the VAO and the old pointer still refers to the old VBO.</p>

      <h2 data-sub="GL3.2.3">The setup recipe</h2>
      <ol>
        <li><code>glGenVertexArrays</code> / <code>glBindVertexArray</code></li>
        <li><code>glGenBuffers</code> / <code>glBindBuffer(GL_ARRAY_BUFFER, vbo)</code></li>
        <li><code>glBufferData</code></li>
        <li><code>glVertexAttribPointer</code> + <code>glEnableVertexAttribArray</code> for each attribute</li>
        <li>Optionally bind an EBO (next section) while the VAO is still bound</li>
        <li>Unbind VAO (<code>0</code>) so later setup cannot accidentally edit it</li>
      </ol>
      <div class="game">An engine stores one VAO per mesh (or per vertex format). Switching mesh = bind a different VAO.</div>
      <p><a class="btn goto-sim" href="#/GL3.2/sim">Try it: see VAO remember a VBO →</a></p>
    `,
    keyFormulas: [
      ["VAO contents", String.raw`\text{VAO}=\{\text{attribs},\ \text{VBO ids},\ \text{EBO id}\}`],
    ],
    exercises: [
      { q: "You set an attribute pointer, then bind a different VBO. Which buffer does the next draw read?", a: "The VBO that was bound when glVertexAttribPointer ran, because the VAO stored that id." },
      { q: "Why unbind the VAO after setup?", a: "So a later glVertexAttribPointer cannot overwrite this mesh's layout by accident." },
      { q: "Is a VBO enough to draw in core 3.3?", a: "No. You need a VAO bound as well." },
    ],
    cpp: [{
      title: "VAO + VBO setup",
      code: String.raw`
void CreateMesh(GLuint* vao, GLuint* vbo, const float* verts, int bytes)
{
    glGenVertexArrays(1, vao);
    glGenBuffers(1, vbo);
    glBindVertexArray(*vao);
    glBindBuffer(GL_ARRAY_BUFFER, *vbo);
    glBufferData(GL_ARRAY_BUFFER, bytes, verts, GL_STATIC_DRAW);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * (int)sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
    glBindVertexArray(0);
}
`,
    }],
    csharp: [{
      title: "VAO + VBO setup",
      code: String.raw`
public static (int vao, int vbo) CreateMesh(float[] verts)
{
    int vao = GL.GenVertexArray();
    int vbo = GL.GenBuffer();
    GL.BindVertexArray(vao);
    GL.BindBuffer(BufferTarget.ArrayBuffer, vbo);
    GL.BufferData(BufferTarget.ArrayBuffer, verts.Length * sizeof(float), verts, BufferUsageHint.StaticDraw);
    GL.VertexAttribPointer(0, 3, VertexAttribPointerType.Float, false, 3 * sizeof(float), 0);
    GL.EnableVertexAttribArray(0);
    GL.BindVertexArray(0);
    return (vao, vbo);
}
`,
    }],
    sims: [{ title: "VAO remembers fetch state", help: "<p>Bind a VAO, attach a VBO, then switch VAOs. Each VAO keeps its own buffer and vertex count.</p>", mount: vaoDesk }],
  });

  L3D.topic({
    id: "GL3.3",
    summary: "An element buffer (EBO / IBO) stores vertex indices so shared corners are uploaded once. glDrawElements reads those indices from the EBO stored in the VAO.",
    lesson: String.raw`
      <p>A square is two triangles and four corners. Without indices you repeat two corners (6 vertices). With an <strong>element buffer object</strong> you store 4 vertices and 6 indices: \(0,1,2, 0,2,3\).</p>
      <div class="key"><p>Indices name vertices. The EBO is bound to <code>GL_ELEMENT_ARRAY_BUFFER</code> while a VAO is bound; the VAO remembers that EBO.</p></div>

      <h2 data-sub="GL3.3.1">Why indices</h2>
      <p>Meshes share vertices along edges. Indices save memory and let the GPU's post-transform vertex cache reuse a transformed vertex. Almost every game mesh is indexed.</p>

      <h2 data-sub="GL3.3.2">EBO binding</h2>
      <p>While the VAO is bound:</p>
      <p><code>glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo);</code></p>
      <p><code>glBufferData(GL_ELEMENT_ARRAY_BUFFER, …, indices, GL_STATIC_DRAW);</code></p>
      <p>Unbinding the VAO also unbinds this element target from your next edits. A common bug is binding an EBO with VAO 0 in core profile.</p>

      <h2 data-sub="GL3.3.3">glDrawElements</h2>
      <p><code>glDrawElements(mode, count, type, offset)</code></p>
      <p><code>count</code> is the number of <em>indices</em>, not vertices. <code>type</code> is <code>GL_UNSIGNED_INT</code> (or SHORT/BYTE). <code>offset</code> is a byte offset into the EBO; for a full draw it is <code>0</code> / <code>nullptr</code>.</p>
      <div class="warn">Mixing <code>glDrawArrays</code> with an EBO still ignores the EBO. Indexed meshes need <code>glDrawElements</code>.</div>
      <p><a class="btn goto-sim" href="#/GL3.3/sim">Try it: indexed square vs duplicated vertices →</a></p>
    `,
    keyFormulas: [
      ["Square", String.raw`4\ \text{vertices},\ 6\ \text{indices}`],
      ["Draw", String.raw`\text{glDrawElements}(\text{GL\_TRIANGLES}, n_{\text{idx}}, \text{GL\_UNSIGNED\_INT}, 0)`],
    ],
    exercises: [
      { q: "A cube with unique corners needs 8 vertices. How many indices for 12 triangles?", a: "12 * 3 = 36 indices." },
      { q: "Where is the EBO binding stored?", a: "In the currently bound VAO." },
      { q: "What is the last argument of glDrawElements for a whole mesh?", a: "Offset 0 (nullptr in C)." },
    ],
    cpp: [{
      title: "Indexed draw",
      code: String.raw`
void DrawIndexed(GLuint vao, int indexCount)
{
    glBindVertexArray(vao);
    glDrawElements(GL_TRIANGLES, indexCount, GL_UNSIGNED_INT, nullptr);
}
`,
    }],
    csharp: [{
      title: "Indexed draw",
      code: String.raw`
public static void DrawIndexed(int vao, int indexCount)
{
    GL.BindVertexArray(vao);
    GL.DrawElements(PrimitiveType.Triangles, indexCount, DrawElementsType.UnsignedInt, 0);
}
`,
    }],
    sims: [{ title: "Indices share vertices", help: "<p>Toggle indexed drawing. The same square uses 4 unique corners plus 6 indices, or 6 duplicated corners.</p>", mount: indexedSquare }],
  });

  L3D.topic({
    id: "GL3.4",
    summary: "The primitive mode tells OpenGL how to connect the vertex stream. Winding order decides which triangle is front-facing for culling.",
    lesson: String.raw`
      <p>A draw call always has a <strong>primitive type</strong>. The same VBO can be points, lines, or triangles depending on that enum.</p>
      <div class="key"><p><code>GL_TRIANGLES</code> consumes vertices in groups of 3. Strips and fans reuse vertices to save bandwidth. Games almost always use indexed triangle lists.</p></div>

      <h2 data-sub="GL3.4.1">Primitive types</h2>
      <table>
        <tr><th>Mode</th><th>How vertices connect</th></tr>
        <tr><td>GL_POINTS</td><td>each vertex is a point</td></tr>
        <tr><td>GL_LINES</td><td>pairs (0-1, 2-3, …)</td></tr>
        <tr><td>GL_LINE_STRIP</td><td>0-1-2-3-…</td></tr>
        <tr><td>GL_LINE_LOOP</td><td>strip plus last-to-first</td></tr>
        <tr><td>GL_TRIANGLES</td><td>triples (0-1-2, 3-4-5, …)</td></tr>
        <tr><td>GL_TRIANGLE_STRIP</td><td>n vertices → n−2 triangles</td></tr>
        <tr><td>GL_TRIANGLE_FAN</td><td>vertex 0 shared by every triangle</td></tr>
      </table>

      <h2 data-sub="GL3.4.2">glDrawArrays</h2>
      <p><code>glDrawArrays(mode, first, count)</code> pulls <code>count</code> vertices starting at index <code>first</code> from the enabled attributes. No EBO. Use it for simple tutorials or non-indexed debug lines.</p>
      <p>Related: <code>glDrawArraysInstanced</code> (Chapter 8), <code>glMultiDraw*</code> for many ranges in one call.</p>

      <h2 data-sub="GL3.4.3">Winding order</h2>
      <p>By default, a triangle whose window-space vertices go <strong>counter-clockwise</strong> is front-facing. <code>glFrontFace(GL_CCW)</code> is the default; <code>GL_CW</code> flips it. Face culling (Chapter 7) uses this bit to drop back faces.</p>
      <div class="note">A mirrored model matrix (negative scale) flips winding. Either disable culling, emit the other winding, or use <code>glFrontFace</code> for that draw.</div>
      <p><a class="btn goto-sim" href="#/GL3.4/sim">Try it: change primitive mode →</a></p>
    `,
    keyFormulas: [
      ["Strip triangles", String.raw`n_{\text{tri}}=n_{\text{vtx}}-2`],
      ["Front face", String.raw`\text{default}=\text{GL\_CCW}`],
    ],
    exercises: [
      { q: "8 vertices as a triangle strip make how many triangles?", a: "8 − 2 = 6." },
      { q: "glDrawArrays(GL_TRIANGLES, 2, 6) uses which vertex range?", a: "Vertices 2 through 7 (six vertices, two triangles)." },
      { q: "A character is mirrored with scale.x = −1 and disappears. Why?", a: "Winding flipped, so back-face culling discarded every triangle." },
    ],
    cpp: [{
      title: "Choose a primitive",
      code: String.raw`
void DrawRange(GLenum mode, int first, int count)
{
    glDrawArrays(mode, first, count);
}
`,
    }],
    csharp: [{
      title: "Choose a primitive",
      code: String.raw`
public static void DrawRange(PrimitiveType mode, int first, int count)
{
    GL.DrawArrays(mode, first, count);
}
`,
    }],
    sims: [{ title: "Primitive assembler", help: "<p>Drag vertices and switch the OpenGL primitive mode. Count how many primitives the same list produces.</p>", mount: primitives }],
  });

  function attribLayout(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 300 });
    const field = sim.select(controls, { label: "Highlight", options: [["pos", "position xyz"], ["col", "colour rgb"], ["uv", "uv"]], value: "pos", onChange: () => v.redraw() });
    const out = sim.readout(readout);
    const parts = [["pos", 0, 3, "a"], ["col", 3, 3, "g"], ["uv", 6, 2, "e"]];
    v.onDraw((view) => {
      view.text([0, 2.2], "one vertex = 8 floats = 32 bytes", { align: "center", color: "fg" });
      parts.forEach(([id, start, n, color]) => {
        for (let i = 0; i < n; i++) {
          const x = -4 + (start + i) * 1.05;
          const on = field.value === id;
          view.rect([x, -0.6], [x + 0.95, 0.8], { color: on ? color : "muted", fill: on ? color : "panel", fillAlpha: on ? 0.7 : 0.3 });
        }
      });
      view.text([-2.4, -1.3], "xyz", { color: "a" });
      view.text([0.2, -1.3], "rgb", { color: "g" });
      view.text([2.8, -1.3], "uv", { color: "e" });
      const info = { pos: ["location 0", "offset 0", "size 3"], col: ["location 1", "offset 12 bytes", "size 3"], uv: ["location 2", "offset 24 bytes", "size 2"] }[field.value];
      out.set(sim.rows([["attribute", field.value], ["pointer", info[0]], ["offset", info[1]], ["components", info[2]], ["stride", "32 bytes for every attribute"]]));
    });
  }

  function vaoDesk(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 4, height: 300 });
    const vao = sim.select(controls, { label: "Bind VAO", options: [["1", "VAO 1"], ["2", "VAO 2"]], value: "1", onChange: () => v.redraw() });
    const out = sim.readout(readout);
    const data = { "1": { vbo: "VBO A", n: 3 }, "2": { vbo: "VBO B", n: 6 } };
    v.onDraw((view) => {
      const d = data[vao.value];
      view.rect([-3, 0.6], [3, 2], { color: "a", fill: "a", fillAlpha: .3 });
      view.text([0, 1.3], "bound VAO " + vao.value + " → " + d.vbo, { align: "center", color: "fg" });
      for (let i = 0; i < d.n; i++) view.circle([-2.2 + i * 0.9, -0.8], 0.28, { color: "g", fill: "g", fillAlpha: .6 });
      out.set(sim.rows([["glBindVertexArray", vao.value], ["fetches from", d.vbo], ["vertex count stored in app", d.n], ["draw", "glDrawArrays uses this VAO's pointers"]]));
    });
  }

  function indexedSquare(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 4, height: 320 });
    const indexed = sim.checkbox(controls, { label: "Use EBO (glDrawElements)", value: true, onChange: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      const pts = [[-1.6, -1.4], [1.6, -1.4], [1.6, 1.4], [-1.6, 1.4]];
      view.polygon(pts, { color: "a", fill: "a", fillAlpha: .25 });
      pts.forEach((p, i) => view.point(p, { color: "a", label: String(i) }));
      view.line(pts[0], pts[2], { color: "g", dash: [6, 4] });
      out.set(sim.rows([
        ["vertices in VBO", indexed.value ? "4" : "6 (corners 0 and 2 duplicated)"],
        ["indices in EBO", indexed.value ? "6  (0,1,2, 0,2,3)" : "none"],
        ["draw", indexed.value ? "glDrawElements(..., 6, ...)" : "glDrawArrays(..., 6)"],
      ]));
    });
  }

  function primitives(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 4.2, height: 360 });
    const start = [[-3.2, -1.2], [-2.2, 1.3], [-0.8, -1.4], [0.2, 1.4], [1.6, -1.2], [2.6, 1.2], [3.4, -0.6]];
    const verts = start.map((p, i) => v.handle(p, { color: "fg", label: String(i), r: 6 }));
    const type = sim.select(controls, {
      label: "glDrawArrays mode",
      options: [["points", "GL_POINTS"], ["lines", "GL_LINES"], ["strip", "GL_LINE_STRIP"], ["loop", "GL_LINE_LOOP"], ["tris", "GL_TRIANGLES"], ["tristrip", "GL_TRIANGLE_STRIP"], ["fan", "GL_TRIANGLE_FAN"]],
      value: "tris",
      onChange: () => v.redraw(),
    });
    const n = sim.slider(controls, { label: "count", min: 2, max: 7, step: 1, value: 6, onInput: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      const pts = verts.slice(0, n.value).map((h) => h.pos);
      let prims = 0;
      const t = type.value;
      if (t === "points") { pts.forEach((p) => view.point(p, { color: "a", r: 7 })); prims = pts.length; }
      if (t === "lines") { for (let i = 0; i + 1 < pts.length; i += 2) { view.line(pts[i], pts[i + 1], { color: "a", width: 3 }); prims++; } }
      if (t === "strip") { for (let i = 0; i + 1 < pts.length; i++) { view.line(pts[i], pts[i + 1], { color: "a", width: 3 }); prims++; } }
      if (t === "loop") { for (let i = 0; i < pts.length; i++) { view.line(pts[i], pts[(i + 1) % pts.length], { color: "a", width: 3 }); prims++; } }
      if (t === "tris") { for (let i = 0; i + 2 < pts.length; i += 3) { view.polygon([pts[i], pts[i + 1], pts[i + 2]], { color: "a", fill: "a", fillAlpha: .35 }); prims++; } }
      if (t === "tristrip") { for (let i = 0; i + 2 < pts.length; i++) { view.polygon([pts[i], pts[i + 1], pts[i + 2]], { color: "a", fill: "a", fillAlpha: .25 }); prims++; } }
      if (t === "fan") { for (let i = 1; i + 1 < pts.length; i++) { view.polygon([pts[0], pts[i], pts[i + 1]], { color: "a", fill: "a", fillAlpha: .25 }); prims++; } }
      out.set(sim.rows([["count", n.value], ["primitives assembled", prims], ["call", `glDrawArrays(${t}, 0, ${n.value})`]]));
    });
  }
})();
