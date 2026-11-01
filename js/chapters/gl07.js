// Learn OpenGL — Chapter 7: The Framebuffer
(function () {
  "use strict";
  const { fmt } = L3D.math;

  L3D.topic({
    id: "GL7.1",
    summary: "The default framebuffer is the window. A framebuffer object (FBO) lets you draw into textures or renderbuffers you created — off-screen, then sample or blit.",
    lesson: String.raw`
      <p>A <strong>framebuffer</strong> is a set of attachments the GPU can draw into: colour images, a depth buffer, a stencil buffer. The <strong>default framebuffer</strong> is created with the window (GLFW). A <strong>framebuffer object (FBO)</strong> is one you create to render off-screen.</p>
      <div class="key"><p>Bind FBO → draw → bind default FBO (0) → sample the texture you attached, or blit it to the window.</p></div>

      <h2 data-sub="GL7.1.1">Colour, depth, stencil attachments</h2>
      <p>Each attachment is either a <strong>texture</strong> (you can sample it later) or a <strong>renderbuffer</strong> (faster, not sampleable as a general texture). Colour goes to <code>GL_COLOR_ATTACHMENT0</code> (+ 1, 2, … for MRT). Depth: <code>GL_DEPTH_ATTACHMENT</code>. Combined depth+stencil textures/renderbuffers use <code>GL_DEPTH_STENCIL_ATTACHMENT</code>.</p>

      <h2 data-sub="GL7.1.2">Renderbuffers</h2>
      <p><code>glGenRenderbuffers</code>, bind <code>GL_RENDERBUFFER</code>, <code>glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH24_STENCIL8, w, h)</code>. Use these when you need depth for the off-screen pass but will not sample depth. MSAA often uses renderbuffers, then a blit to a resolve texture.</p>

      <h2 data-sub="GL7.1.3">Off-screen rendering</h2>
      <ol>
        <li><code>glGenFramebuffers</code> / <code>glBindFramebuffer(GL_FRAMEBUFFER, fbo)</code></li>
        <li>Attach colour texture and depth renderbuffer</li>
        <li><code>glCheckFramebufferStatus</code> must be <code>GL_FRAMEBUFFER_COMPLETE</code></li>
        <li>Set <code>glViewport</code> to the FBO size, draw</li>
        <li><code>glBindFramebuffer(GL_FRAMEBUFFER, 0)</code> to return to the window</li>
      </ol>
      <div class="warn">Forgetting to resize the viewport to the FBO, or attaching mismatched sizes, yields an incomplete FBO or a tiny picture in the corner.</div>
      <div class="game">Shadow maps, post-process, reflections, and UI off-screen passes are all FBOs.</div>
      <p><a class="btn goto-sim" href="#/GL7.1/sim">Try it: draw off-screen then present →</a></p>
    `,
    keyFormulas: [
      ["Bind", String.raw`\text{glBindFramebuffer}(\text{GL\_FRAMEBUFFER},\,\text{fbo or }0)`],
      ["Complete", String.raw`\text{glCheckFramebufferStatus}=\text{GL\_FRAMEBUFFER\_COMPLETE}`],
    ],
    exercises: [
      { q: "What does binding framebuffer 0 mean?", a: "The default window framebuffer." },
      { q: "When do you choose a texture over a renderbuffer for colour?", a: "When a later pass needs to sample that colour (post-process, bloom)." },
      { q: "Why call glCheckFramebufferStatus?", a: "Missing attachments or size/format mismatches make the FBO illegal to draw into." },
    ],
    cpp: [{
      title: "Colour texture + depth renderbuffer FBO",
      code: String.raw`
GLuint MakeFBO(int w, int h, GLuint* colorTex)
{
    glGenTextures(1, colorTex);
    glBindTexture(GL_TEXTURE_2D, *colorTex);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB8, w, h, 0, GL_RGB, GL_UNSIGNED_BYTE, nullptr);
    GLuint rbo = 0, fbo = 0;
    glGenRenderbuffers(1, &rbo);
    glBindRenderbuffer(GL_RENDERBUFFER, rbo);
    glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH24_STENCIL8, w, h);
    glGenFramebuffers(1, &fbo);
    glBindFramebuffer(GL_FRAMEBUFFER, fbo);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, *colorTex, 0);
    glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT, GL_RENDERBUFFER, rbo);
    return fbo;
}
`,
    }],
    csharp: [{
      title: "Colour texture + depth renderbuffer FBO",
      code: String.raw`
public static int MakeFBO(int w, int h, out int colorTex)
{
    colorTex = GL.GenTexture();
    GL.BindTexture(TextureTarget.Texture2D, colorTex);
    GL.TexImage2D(TextureTarget.Texture2D, 0, PixelInternalFormat.Rgb8, w, h, 0, PixelFormat.Rgb, PixelType.UnsignedByte, IntPtr.Zero);
    int rbo = GL.GenRenderbuffer();
    GL.BindRenderbuffer(RenderbufferTarget.Renderbuffer, rbo);
    GL.RenderbufferStorage(RenderbufferTarget.Renderbuffer, RenderbufferStorage.Depth24Stencil8, w, h);
    int fbo = GL.GenFramebuffer();
    GL.BindFramebuffer(FramebufferTarget.Framebuffer, fbo);
    GL.FramebufferTexture2D(FramebufferTarget.Framebuffer, FramebufferAttachment.ColorAttachment0, TextureTarget.Texture2D, colorTex, 0);
    GL.FramebufferRenderbuffer(FramebufferTarget.Framebuffer, FramebufferAttachment.DepthStencilAttachment, RenderbufferTarget.Renderbuffer, rbo);
    return fbo;
}
`,
    }],
    sims: [{ title: "Off-screen FBO", help: "<p>Draw into an FBO first, then present to the window. The colour attachment is just a texture the second pass can sample.</p>", mount: fboStory }],
  });

  L3D.topic({
    id: "GL7.2",
    summary: "The depth buffer stores the nearest fragment so far. A depth test decides whether a new fragment wins. You must clear depth every frame if the test is on.",
    lesson: String.raw`
      <p>Each pixel keeps a <strong>depth</strong> value (typically after the perspective divide, in \([0,1]\) with a default mapping, or \([-1,1]\) clip before mapping). When two triangles overlap in screen space, the depth test keeps the closer one.</p>
      <div class="key"><p><code>glEnable(GL_DEPTH_TEST)</code>, choose a function (default <code>GL_LESS</code>), and clear depth to 1.0 at the start of the frame.</p></div>

      <h2 data-sub="GL7.2.1">Depth buffer</h2>
      <p>Created with the window (<code>GLFW_DEPTH_BITS</code>) or as an FBO attachment. Precision is limited; fighting coplanar surfaces is z-fighting (see the math book’s depth-offset chapter). A 24-bit depth + 8-bit stencil pack is common.</p>

      <h2 data-sub="GL7.2.2">Depth functions</h2>
      <p><code>glDepthFunc(GL_LESS)</code> is default: pass if incoming depth is smaller. <code>GL_LEQUAL</code> is useful when redrawing the same geometry (skybox tricks, some decals). <code>GL_ALWAYS</code> turns the test into a write-only update.</p>

      <h2 data-sub="GL7.2.3">Depth write</h2>
      <p><code>glDepthMask(GL_FALSE)</code> still <em>tests</em> against depth but does not update the buffer. Transparent objects usually draw after opaques, with depth write off, sorted back to front.</p>
      <div class="note">You can also write <code>gl_FragDepth</code> in a fragment shader. That often disables early-z optimizations — do it only when needed.</div>
      <p><a class="btn goto-sim" href="#/GL7.2/sim">Try it: two overlapping triangles →</a></p>
    `,
    keyFormulas: [
      ["Enable", String.raw`\text{glEnable}(\text{GL\_DEPTH\_TEST})`],
      ["Default test", String.raw`\text{pass if } z_{\text{new}} \lt z_{\text{stored}}`],
    ],
    exercises: [
      { q: "Depth test is on, you never clear depth, and new objects vanish. Why?", a: "Old far/near values remain. Clear GL_DEPTH_BUFFER_BIT." },
      { q: "Why disable depth writes for blended particles?", a: "So they still test against the opaque world but do not occlude each other incorrectly." },
      { q: "GL_LESS vs GL_LEQUAL for a skybox drawn at depth 1?", a: "LEQUAL lets fragments with z equal to the cleared far plane pass." },
    ],
    cpp: [{
      title: "Opaque pass depth state",
      code: String.raw`
void BeginOpaquePass()
{
    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_LESS);
    glDepthMask(GL_TRUE);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
}
`,
    }],
    csharp: [{
      title: "Opaque pass depth state",
      code: String.raw`
public static void BeginOpaquePass()
{
    GL.Enable(EnableCap.DepthTest);
    GL.DepthFunc(DepthFunction.Less);
    GL.DepthMask(true);
    GL.Clear(ClearBufferMask.ColorBufferBit | ClearBufferMask.DepthBufferBit);
}
`,
    }],
    sims: [{ title: "Depth test", help: "<p>Slide two triangles in depth. With the test on, the nearer colour wins even if it was drawn first.</p>", mount: depthTest }],
  });

  L3D.topic({
    id: "GL7.3",
    summary: "The stencil buffer is a small integer per pixel. You draw to write a mask, then draw again with a test that passes only where the mask matches.",
    lesson: String.raw`
      <p>Stencil is a per-pixel lock. Typical size: 8 bits (values \(0..255\)). You configure a <strong>test</strong> (compare incoming reference to the stored value) and <strong>ops</strong> (what to write on fail, depth-fail, and pass).</p>
      <div class="key"><p>Recipe: clear stencil → draw the mask shape with ops that write 1 → draw the real scene with a test that passes only where stencil is 1.</p></div>

      <h2 data-sub="GL7.3.1">Per-pixel mask</h2>
      <p><code>glEnable(GL_STENCIL_TEST)</code>. <code>glStencilFunc(func, ref, mask)</code> compares <code>(ref &amp; mask)</code> to <code>(stencil &amp; mask)</code>. <code>GL_ALWAYS</code> makes the test pass so ops can write freely while you paint the mask.</p>

      <h2 data-sub="GL7.3.2">Stencil ops</h2>
      <p><code>glStencilOp(stencilFail, depthFail, depthPass)</code>: each is <code>GL_KEEP</code>, <code>GL_REPLACE</code>, <code>GL_INCR</code>, <code>GL_DECR</code>, <code>GL_INVERT</code>, <code>GL_ZERO</code>. <code>GL_REPLACE</code> writes the <code>ref</code> from <code>glStencilFunc</code>.</p>

      <h2 data-sub="GL7.3.3">Typical recipes</h2>
      <ul>
        <li><strong>Mirror / portal:</strong> stamp 1 on the mirror quad, then draw the reflected scene with <code>GL_EQUAL, 1</code>.</li>
        <li><strong>Outline:</strong> draw the object, increment stencil, draw a slightly scaled version only where stencil is 0.</li>
        <li><strong>Shadow volumes:</strong> increment/decrement on depth-fail (math book Chapter 10).</li>
      </ul>
      <div class="warn">If the window has 0 stencil bits, none of this works. Ask GLFW for <code>GLFW_STENCIL_BITS, 8</code> before creating the window.</div>
      <p><a class="btn goto-sim" href="#/GL7.3/sim">Try it: stamp a stencil mask →</a></p>
    `,
    keyFormulas: [
      ["Func", String.raw`\text{glStencilFunc}(\text{GL\_EQUAL}, 1, 0xFF)`],
      ["Op replace", String.raw`\text{glStencilOp}(\text{KEEP}, \text{KEEP}, \text{REPLACE})`],
    ],
    exercises: [
      { q: "How do you write 1 into the stencil on a successful draw?", a: "glStencilFunc(GL_ALWAYS, 1, 0xFF) and glStencilOp(KEEP, KEEP, REPLACE)." },
      { q: "After the mask is written, how do you draw only inside it?", a: "glStencilFunc(GL_EQUAL, 1, 0xFF) and usually glStencilOp(KEEP, KEEP, KEEP)." },
      { q: "Why might stencil be all zeros forever?", a: "Window has no stencil buffer, or you never clear stencil, or the test never passes." },
    ],
    cpp: [{
      title: "Draw only inside a stamped mask",
      code: String.raw`
void DrawMasked(GLuint maskVao, GLuint sceneVao)
{
    glEnable(GL_STENCIL_TEST);
    glClear(GL_STENCIL_BUFFER_BIT);
    glStencilFunc(GL_ALWAYS, 1, 0xFF);
    glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE);
    glBindVertexArray(maskVao);
    glDrawArrays(GL_TRIANGLES, 0, 6);   // write 1 on the mirror
    glStencilFunc(GL_EQUAL, 1, 0xFF);
    glStencilOp(GL_KEEP, GL_KEEP, GL_KEEP);
    glBindVertexArray(sceneVao);
    glDrawArrays(GL_TRIANGLES, 0, 36);  // reflected scene
}
`,
    }],
    csharp: [{
      title: "Draw only inside a stamped mask",
      code: String.raw`
public static void DrawMasked(int maskVao, int sceneVao)
{
    GL.Enable(EnableCap.StencilTest);
    GL.Clear(ClearBufferMask.StencilBufferBit);
    GL.StencilFunc(StencilFunction.Always, 1, 0xFF);
    GL.StencilOp(StencilOp.Keep, StencilOp.Keep, StencilOp.Replace);
    GL.BindVertexArray(maskVao);
    GL.DrawArrays(PrimitiveType.Triangles, 0, 6);
    GL.StencilFunc(StencilFunction.Equal, 1, 0xFF);
    GL.StencilOp(StencilOp.Keep, StencilOp.Keep, StencilOp.Keep);
    GL.BindVertexArray(sceneVao);
    GL.DrawArrays(PrimitiveType.Triangles, 0, 36);
}
`,
    }],
    sims: [{ title: "Stencil mask", help: "<p>The first pass writes 1 inside the diamond. The second pass colours the scene only where stencil is 1.</p>", mount: stencilMask }],
  });

  L3D.topic({
    id: "GL7.4",
    summary: "Blending mixes the incoming fragment with the pixel already stored. Face culling skips triangles whose winding is back-facing, cutting fill rate roughly in half for closed meshes.",
    lesson: String.raw`
      <p>After tests, a fragment can <strong>blend</strong> instead of overwrite. Separately, the GPU can throw away whole triangles that face away from the camera — <strong>face culling</strong> — before they even generate fragments.</p>
      <div class="key"><p>Opaques: depth on, blend off, cull back faces. Transparents: draw later, blend on, often depth-write off, usually cull still on unless the mesh is two-sided.</p></div>

      <h2 data-sub="GL7.4.1">Blend equation</h2>
      <p><code>glEnable(GL_BLEND)</code>. Classic alpha:</p>
      <p><code>glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);</code></p>
      <p>Result: \(c = \alpha\,c_{\text{src}} + (1-\alpha)\,c_{\text{dst}}\). Additive glow uses <code>GL_ONE, GL_ONE</code>. Separate RGB/alpha factors exist (<code>glBlendFuncSeparate</code>).</p>

      <h2 data-sub="GL7.4.2">Alpha</h2>
      <p>The fragment shader's <code>.a</code> is the source alpha. Textures with an alpha channel need an RGBA internal format. Order matters: blend is not commutative. Sort transparent objects, or use order-independent techniques.</p>

      <h2 data-sub="GL7.4.3">Front and back faces</h2>
      <p><code>glEnable(GL_CULL_FACE)</code>, <code>glCullFace(GL_BACK)</code> (default). Front face is CCW by default (<code>glFrontFace</code>). Closed meshes benefit; 2D sprites and two-sided foliage often disable culling.</p>
      <div class="game">A typical frame: enable cull + depth, draw the world, then disable cull if needed, enable blend, draw particles and glass.</div>
      <p><a class="btn goto-sim" href="#/GL7.4/sim">Try it: blend alpha and cull winding →</a></p>
    `,
    keyFormulas: [
      ["Alpha blend", String.raw`c=\alpha c_{\mathrm{src}}+(1-\alpha)c_{\mathrm{dst}}`],
      ["Cull", String.raw`\text{glEnable}(\text{GL\_CULL\_FACE}),\ \text{GL\_BACK}`],
    ],
    exercises: [
      { q: "What blend func gives standard transparency?", a: "GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA." },
      { q: "A cube disappears after enabling cull. Likely cause?", a: "Wrong winding (CW vs CCW) or a inverted matrix." },
      { q: "Should you enable blending for a brick wall?", a: "No. Opaque + depth is cheaper and sorts correctly automatically." },
    ],
    cpp: [{
      title: "Transparent pass state",
      code: String.raw`
void BeginTransparentPass()
{
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glDepthMask(GL_FALSE);
    glEnable(GL_CULL_FACE);
}
`,
    }],
    csharp: [{
      title: "Transparent pass state",
      code: String.raw`
public static void BeginTransparentPass()
{
    GL.Enable(EnableCap.Blend);
    GL.BlendFunc(BlendingFactor.SrcAlpha, BlendingFactor.OneMinusSrcAlpha);
    GL.DepthMask(false);
    GL.Enable(EnableCap.CullFace);
}
`,
    }],
    sims: [{ title: "Blend and cull", help: "<p>Fade the top triangle with alpha blending. Flip winding to see back-face culling hide a triangle.</p>", mount: blendCull }],
  });

  function fboStory(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 300 });
    const pass = sim.select(controls, { label: "Pass", options: [["off", "1. Draw into FBO"], ["on", "2. Bind 0, sample texture"]], value: "off", onChange: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      view.rect([-4.5, -0.2], [-0.3, 2.4], { color: "a", fill: "a", fillAlpha: pass.value === "off" ? 0.55 : 0.2 });
      view.text([-2.4, 2.7], "FBO colour tex", { align: "center", color: "fg" });
      view.rect([0.3, -0.2], [4.5, 2.4], { color: "g", fill: "g", fillAlpha: pass.value === "on" ? 0.55 : 0.2 });
      view.text([2.4, 2.7], "window (FBO 0)", { align: "center", color: "fg" });
      view.polygon([[-3.6, 0.2], [-1.2, 0.2], [-2.4, 1.8]], { color: "e", fill: "e", fillAlpha: 0.8 });
      if (pass.value === "on") view.polygon([[1.2, 0.2], [3.6, 0.2], [2.4, 1.8]], { color: "e", fill: "e", fillAlpha: 0.8 });
      out.set(sim.rows([["glBindFramebuffer", pass.value === "off" ? "fbo" : "0"], ["drawing into", pass.value === "off" ? "off-screen texture" : "the window"], ["colour attachment", "sampled as a texture in pass 2"]]));
    });
  }

  function depthTest(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 4, height: 300 });
    const zA = sim.slider(controls, { label: "Red triangle z", min: 0, max: 1, step: 0.01, value: 0.7, onInput: () => v.redraw() });
    const zB = sim.slider(controls, { label: "Blue triangle z", min: 0, max: 1, step: 0.01, value: 0.3, onInput: () => v.redraw() });
    const on = sim.checkbox(controls, { label: "GL_DEPTH_TEST", value: true, onChange: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      const redFirst = !on.value || zA.value <= zB.value;
      const draw = (which) => {
        if (which === "r") view.polygon([[-2.4, -1.5], [1.2, -1.5], [-0.6, 1.6]], { color: "e", fill: "e", fillAlpha: 0.75 });
        else view.polygon([[-1.2, -1.5], [2.4, -1.5], [0.6, 1.6]], { color: "a", fill: "a", fillAlpha: 0.75 });
      };
      if (redFirst) { draw("r"); draw("b"); } else { draw("b"); draw("r"); }
      const winner = !on.value ? "draw order (last wins)" : (zA.value < zB.value ? "red (nearer)" : zB.value < zA.value ? "blue (nearer)" : "tie");
      out.set(sim.rows([["test", on.value ? "GL_LESS" : "off"], ["red z", fmt(zA.value, 2)], ["blue z", fmt(zB.value, 2)], ["visible on overlap", winner]]));
    });
  }

  function stencilMask(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 4, height: 300 });
    const use = sim.checkbox(controls, { label: "Stencil test equal 1", value: true, onChange: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      view.rect([-3.5, -2], [3.5, 2], { color: "muted", fill: "panel", fillAlpha: 0.35 });
      const diamond = [[0, 1.6], [1.4, 0], [0, -1.6], [-1.4, 0]];
      if (!use.value) view.rect([-3.2, -1.7], [3.2, 1.7], { color: "a", fill: "a", fillAlpha: 0.45 });
      else view.polygon(diamond, { color: "a", fill: "a", fillAlpha: 0.55 });
      view.polyline(diamond, { color: "g", closed: true, width: 2 });
      out.set(sim.rows([["pass 1", "REPLACE stencil with 1 on diamond"], ["pass 2", use.value ? "EQUAL 1 — colour only inside" : "no test — colour everywhere"], ["bits", "need a stencil buffer on the window / FBO"]]));
    });
  }

  function blendCull(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 3.5, height: 300 });
    const a = sim.slider(controls, { label: "src alpha", min: 0, max: 1, step: 0.01, value: 0.45, onInput: () => v.redraw() });
    const winding = sim.select(controls, { label: "Top triangle winding", options: [["ccw", "CCW (front)"], ["cw", "CW (back)"]], value: "ccw", onChange: () => v.redraw() });
    const cull = sim.checkbox(controls, { label: "GL_CULL_FACE back", value: false, onChange: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      view.polygon([[-2.5, -1.6], [1.5, -1.6], [-0.5, 1.4]], { color: "a", fill: "a", fillAlpha: 1 });
      const hide = cull.value && winding.value === "cw";
      if (!hide) {
        const top = winding.value === "ccw" ? [[-1.5, -1.2], [2.4, -1.2], [0.5, 1.7]] : [[2.4, -1.2], [-1.5, -1.2], [0.5, 1.7]];
        view.polygon(top, { color: "e", fill: "e", fillAlpha: a.value });
      }
      out.set(sim.rows([["blend", `src*${fmt(a.value, 2)} + dst*${fmt(1 - a.value, 2)}`], ["cull hides top", hide ? "yes — back face" : "no"], ["front face", "CCW by default"]]));
    });
  }
})();
