// Learn OpenGL — Chapter 6: Textures
(function () {
  "use strict";
  const { fmt } = L3D.math;

  L3D.topic({
    id: "GL6.1",
    summary: "A texture is an image (or data table) stored in VRAM. You upload pixels once, bind the texture, and the fragment shader samples it with coordinates.",
    lesson: String.raw`
      <p>A <strong>texture object</strong> holds one or more images on the GPU: colour photos, normal maps, shadow maps, even 3D noise. The usual first texture is a 2D colour image sampled by a mesh.</p>
      <div class="key"><p>Create texture → bind <code>GL_TEXTURE_2D</code> → set parameters → <code>glTexImage2D</code> → generate mipmaps → sample in the fragment shader.</p></div>

      <h2 data-sub="GL6.1.1">Image in VRAM</h2>
      <p><code>glGenTextures</code> / <code>glBindTexture(GL_TEXTURE_2D, id)</code>. The bind target is the texture type: 1D, 2D, 3D, cube, 2D array, rectangle. A texture is not a buffer object; it has formats, mipmap chains, and filtering state.</p>

      <h2 data-sub="GL6.1.2">glTexImage2D</h2>
      <p><code>glTexImage2D(target, level, internalFormat, width, height, border, format, type, pixels)</code></p>
      <ul>
        <li><strong>level</strong> — mipmap level (0 = full size)</li>
        <li><strong>internalFormat</strong> — how VRAM stores it (<code>GL_RGB8</code>, <code>GL_RGBA8</code>, <code>GL_R16F</code>, …)</li>
        <li><strong>format</strong> / <strong>type</strong> — how the CPU pointer is packed (<code>GL_RGB</code> + <code>GL_UNSIGNED_BYTE</code>)</li>
        <li><strong>pixels</strong> — CPU pointer, or offset into a pixel unpack buffer</li>
      </ul>
      <p>Load files with a library such as stb_image; OpenGL does not decode PNG.</p>

      <h2 data-sub="GL6.1.3">Texture coordinates</h2>
      <p>Normalized coordinates \((u,v)\) usually run from \(0\) to \(1\). Origin in OpenGL is the <strong>bottom-left</strong> of the image. Many image loaders give top-left origin; either flip on load (<code>stbi_set_flip_vertically_on_load</code>) or flip \(v\) in the shader.</p>
      <div class="game">UV maps on a character are authored in a DCC tool, stored as a vertex attribute, interpolated, then used as <code>texture(uAlbedo, vUv)</code>.</div>
      <p><a class="btn goto-sim" href="#/GL6.1/sim">Try it: move (u, v) on an image →</a></p>
    `,
    keyFormulas: [
      ["Upload", String.raw`\text{glTexImage2D}(\text{GL\_TEXTURE\_2D}, 0, \text{GL\_RGB}, w, h, 0, \text{GL\_RGB}, \text{GL\_UNSIGNED\_BYTE}, p)`],
      ["Sample", String.raw`c=\text{texture}(\text{sampler},\,uv)`],
    ],
    exercises: [
      { q: "Does glTexImage2D open a PNG path?", a: "No. You decode the file yourself and pass a pixel pointer." },
      { q: "Why might a loaded photo look upside down?", a: "Image origin is top-left; OpenGL uv origin is bottom-left unless you flip." },
      { q: "What does mipmap level 0 mean?", a: "The full-resolution image." },
    ],
    cpp: [{
      title: "Create and fill a 2D texture",
      code: String.raw`
GLuint CreateTexture2D(int w, int h, const unsigned char* rgb)
{
    GLuint id = 0;
    glGenTextures(1, &id);
    glBindTexture(GL_TEXTURE_2D, id);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, w, h, 0, GL_RGB, GL_UNSIGNED_BYTE, rgb);
    glGenerateMipmap(GL_TEXTURE_2D);
    return id;
}
`,
    }],
    csharp: [{
      title: "Create and fill a 2D texture",
      code: String.raw`
public static int CreateTexture2D(int w, int h, byte[] rgb)
{
    int id = GL.GenTexture();
    GL.BindTexture(TextureTarget.Texture2D, id);
    GL.TexImage2D(TextureTarget.Texture2D, 0, PixelInternalFormat.Rgb, w, h, 0, PixelFormat.Rgb, PixelType.UnsignedByte, rgb);
    GL.GenerateMipmap(GenerateMipmapTarget.Texture2D);
    return id;
}
`,
    }],
    sims: [{ title: "Texture coordinate mapper", help: "<p>Move u and v. The sample colour comes from that spot in the image. OpenGL v=0 is the bottom.</p>", mount: textureMapper }],
  });

  L3D.topic({
    id: "GL6.2",
    summary: "The GPU has numbered texture units. You activate a unit, bind a texture to it, and set a sampler uniform to that unit index.",
    lesson: String.raw`
      <p>Shaders can sample several images at once (albedo, normal, roughness). Each image sits on a <strong>texture unit</strong>: <code>GL_TEXTURE0</code>, <code>GL_TEXTURE1</code>, … The sampler uniform is an <em>int</em> naming the unit, not the texture id.</p>
      <div class="key"><p><code>glActiveTexture(GL_TEXTUREn)</code> → <code>glBindTexture</code> → <code>glUniform1i(samplerLoc, n)</code>.</p></div>

      <h2 data-sub="GL6.2.1">Texture units</h2>
      <p><code>glActiveTexture</code> selects which unit later <code>glBindTexture</code> affects. Unit 0 is the default. The maximum count is an implementation limit (<code>GL_MAX_TEXTURE_IMAGE_UNITS</code>), typically 16+ on fragment shaders.</p>

      <h2 data-sub="GL6.2.2">Samplers in GLSL</h2>
      <p><code>uniform sampler2D uAlbedo;</code> <code>uniform sampler2D uNormal;</code> Sampling: <code>vec4 c = texture(uAlbedo, vUv);</code> Cube maps use <code>samplerCube</code> and a direction vector. Shadow maps often use <code>sampler2DShadow</code>.</p>

      <h2 data-sub="GL6.2.3">Binding a unit</h2>
      <p>Texture ids and units are different. Binding texture 42 to unit 1 does not change unit 0. Leaving the sampler uniform at 0 while you bound the image on unit 1 samples the wrong texture (or black).</p>
      <div class="note">GL 3.3 also has <strong>sampler objects</strong> that store filter/wrap state separately from the texture image. Binding a sampler object to a unit overrides the texture's own parameters.</div>
      <p><a class="btn goto-sim" href="#/GL6.2/sim">Try it: two units, two textures →</a></p>
    `,
    keyFormulas: [
      ["Bind unit n", String.raw`\text{glActiveTexture}(\text{GL\_TEXTURE0}+n),\ \text{glBindTexture}(\ldots)`],
      ["Sampler uniform", String.raw`\text{glUniform1i}(\text{loc},\,n)`],
    ],
    exercises: [
      { q: "The shader samples unit 1 but you only bound on unit 0. What happens?", a: "It samples whatever texture (maybe none) is on unit 1, not the one you meant." },
      { q: "Is the sampler uniform a texture id?", a: "No. It is a texture-unit index." },
      { q: "How do you bind a second image?", a: "glActiveTexture(GL_TEXTURE1); glBindTexture(...); glUniform1i(loc, 1);" },
    ],
    cpp: [{
      title: "Bind two textures to units 0 and 1",
      code: String.raw`
void BindAlbedoNormal(GLuint program, GLuint albedo, GLuint normal)
{
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, albedo);
    glUniform1i(glGetUniformLocation(program, "uAlbedo"), 0);
    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, normal);
    glUniform1i(glGetUniformLocation(program, "uNormal"), 1);
}
`,
    }],
    csharp: [{
      title: "Bind two textures to units 0 and 1",
      code: String.raw`
public static void BindAlbedoNormal(int program, int albedo, int normal)
{
    GL.ActiveTexture(TextureUnit.Texture0);
    GL.BindTexture(TextureTarget.Texture2D, albedo);
    GL.Uniform1(GL.GetUniformLocation(program, "uAlbedo"), 0);
    GL.ActiveTexture(TextureUnit.Texture1);
    GL.BindTexture(TextureTarget.Texture2D, normal);
    GL.Uniform1(GL.GetUniformLocation(program, "uNormal"), 1);
}
`,
    }],
    sims: [{ title: "Texture units", help: "<p>Each unit holds one bound texture. The sampler uniform picks a unit. Mix two images by choosing units.</p>", mount: textureUnits }],
  });

  L3D.topic({
    id: "GL6.3",
    summary: "Minification, magnification, and wrap modes are texture parameters. They decide how texels blend when a UV is between pixels or outside 0..1.",
    lesson: String.raw`
      <p>A UV of \((0.33, 0.10)\) rarely lands on the exact centre of a texel. <strong>Filtering</strong> chooses a colour. A UV of \(1.4\) is outside the image; <strong>wrapping</strong> decides what that means.</p>
      <div class="key"><p>Set parameters on the bound texture with <code>glTexParameteri</code> before drawing. Defaults are often a mipmap-using min filter — which looks black if you never generated mipmaps.</p></div>

      <h2 data-sub="GL6.3.1">Min and mag filters</h2>
      <ul>
        <li><code>GL_NEAREST</code> — one texel, blocky</li>
        <li><code>GL_LINEAR</code> — blend neighbours, blurry/smooth</li>
        <li>Minification also has mipmap variants: <code>GL_LINEAR_MIPMAP_LINEAR</code> (trilinear), <code>GL_NEAREST_MIPMAP_NEAREST</code>, …</li>
      </ul>
      <p><code>GL_TEXTURE_MAG_FILTER</code> is for zoomed-in (few texels covering many pixels). <code>GL_TEXTURE_MIN_FILTER</code> is for zoomed-out.</p>

      <h2 data-sub="GL6.3.2">Wrap modes</h2>
      <p><code>GL_TEXTURE_WRAP_S</code> / <code>WRAP_T</code>:</p>
      <ul>
        <li><code>GL_REPEAT</code> — tile (frac of the coordinate)</li>
        <li><code>GL_MIRRORED_REPEAT</code> — tile but flip every other copy</li>
        <li><code>GL_CLAMP_TO_EDGE</code> — stick to the rim texel</li>
        <li><code>GL_CLAMP_TO_BORDER</code> — use a border colour</li>
      </ul>

      <h2 data-sub="GL6.3.3">Border colour</h2>
      <p><code>glTexParameterfv(..., GL_TEXTURE_BORDER_COLOR, rgba)</code> with clamp-to-border. Shadow maps use this so samples outside the map become “not in shadow” or “in shadow” on purpose.</p>
      <div class="warn">Default min filter is <code>GL_NEAREST_MIPMAP_LINEAR</code>. If you skip <code>glGenerateMipmap</code> and skip changing the min filter, sampling can be incomplete (black texture).</div>
      <p><a class="btn goto-sim" href="#/GL6.3/sim">Try it: filter and wrap →</a></p>
    `,
    keyFormulas: [
      ["Repeat", String.raw`u' = u - \lfloor u\rfloor`],
      ["Clamp", String.raw`u' = \mathrm{clamp}(u,0,1)`],
    ],
    exercises: [
      { q: "Your texture is black, upload looks correct. What parameter is a likely culprit?", a: "Min filter still wants mipmaps. Generate them or set MIN_FILTER to LINEAR/NEAREST." },
      { q: "You want a sky colour outside a decal quad. Which wrap?", a: "CLAMP_TO_BORDER with that colour, or clamp to edge if the rim texel is already that colour." },
      { q: "NEAREST vs LINEAR when magnifying a pixel-art sprite?", a: "NEAREST keeps hard pixels; LINEAR blurs them." },
    ],
    cpp: [{
      title: "Sensible 2D defaults",
      code: String.raw`
void SetDefaultSampling()
{
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
}
`,
    }],
    csharp: [{
      title: "Sensible 2D defaults",
      code: String.raw`
public static void SetDefaultSampling()
{
    GL.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureMinFilter, (int)TextureMinFilter.LinearMipmapLinear);
    GL.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureMagFilter, (int)TextureMagFilter.Linear);
    GL.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureWrapS, (int)TextureWrapMode.Repeat);
    GL.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureWrapT, (int)TextureWrapMode.Repeat);
}
`,
    }],
    sims: [{ title: "Filter and wrap", help: "<p>Zoom (min vs mag) and move UV outside 0..1. Nearest stays blocky; repeat tiles; clamp sticks to the edge.</p>", mount: filterWrap }],
  });

  L3D.topic({
    id: "GL6.4",
    summary: "Mipmaps are pre-shrunk copies of a texture. Internal formats choose GPU storage. Pixel unpack state describes how CPU rows are aligned.",
    lesson: String.raw`
      <p>When a mesh is far away, many texels fall in one pixel. Sampling only level 0 aliases (sparkle). A <strong>mipmap chain</strong> stores \(1/2\), \(1/4\), … sizes. The GPU picks a level (and can blend two levels).</p>
      <div class="key"><p><code>glGenerateMipmap</code> builds the chain from level 0. Compressed textures often ship pre-built mipmaps in the file.</p></div>

      <h2 data-sub="GL6.4.1">Mipmap chain</h2>
      <p>Level \(\ell\) is about \(1/2^\ell\) in each dimension, down to 1×1. Memory cost is about 33% extra for 2D. You can upload each level yourself with <code>glTexImage2D(..., level, ...)</code>.</p>

      <h2 data-sub="GL6.4.2">Internal formats</h2>
      <p>VRAM layout is independent of the CPU pointer format. <code>GL_SRGB8_ALPHA8</code> stores sRGB for colour textures (gamma-aware sampling). <code>GL_R8</code> is one channel. <code>GL_DEPTH_COMPONENT24</code> is a depth texture for shadow maps. Floating-point formats (<code>GL_RGBA16F</code>) hold HDR.</p>

      <h2 data-sub="GL6.4.3">Pixel unpack</h2>
      <p><code>glPixelStorei(GL_UNPACK_ALIGNMENT, 1)</code> is the usual fix when RGB images with odd widths look skewed. Default alignment is 4 bytes per row. Pack alignment matters for <code>glReadPixels</code>.</p>
      <p>A <strong>pixel unpack buffer</strong> bound to <code>GL_PIXEL_UNPACK_BUFFER</code> makes the last argument of <code>glTexImage2D</code> an offset into that buffer, so the CPU can fill the PBO while the GPU uses the previous texture.</p>
      <div class="game">Colour albedo: sRGB internal format + mipmaps. Data maps (roughness): linear format, often single channel. Shadow map: depth texture attached to an FBO.</div>
      <p><a class="btn goto-sim" href="#/GL6.4/sim">Try it: pick a mip level →</a></p>
    `,
    keyFormulas: [
      ["Level size", String.raw`w_\ell \approx \max(1,\lfloor w/2^\ell\rfloor)`],
      ["Unpack", String.raw`\text{glPixelStorei}(\text{GL\_UNPACK\_ALIGNMENT}, 1)`],
    ],
    exercises: [
      { q: "Why do mipmaps cost extra VRAM?", a: "They store extra smaller images, about one third more for 2D." },
      { q: "A 3-byte RGB image with width 5 looks sheared. Why?", a: "Default unpack alignment 4 pads rows; set alignment to 1." },
      { q: "When is a PBO useful for texture upload?", a: "When you want the CPU to fill next frame's pixels without stalling on this frame's glTexImage2D." },
    ],
    cpp: [{
      title: "Safe unpack and mipmaps",
      code: String.raw`
void UploadRgb(int w, int h, const unsigned char* rgb)
{
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB8, w, h, 0, GL_RGB, GL_UNSIGNED_BYTE, rgb);
    glGenerateMipmap(GL_TEXTURE_2D);
}
`,
    }],
    csharp: [{
      title: "Safe unpack and mipmaps",
      code: String.raw`
public static void UploadRgb(int w, int h, byte[] rgb)
{
    GL.PixelStore(PixelStoreParameter.UnpackAlignment, 1);
    GL.TexImage2D(TextureTarget.Texture2D, 0, PixelInternalFormat.Rgb8, w, h, 0, PixelFormat.Rgb, PixelType.UnsignedByte, rgb);
    GL.GenerateMipmap(GenerateMipmapTarget.Texture2D);
}
`,
    }],
    sims: [{ title: "Mipmap chain", help: "<p>Raise the mip level. Each step halves resolution. Far objects should use higher levels to avoid sparkle.</p>", mount: mipChain }],
  });

  function textureMapper(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 4, height: 320 });
    const u = sim.slider(controls, { label: "u (left to right)", min: 0, max: 1, step: 0.01, value: 0.3, onInput: () => v.redraw() });
    const vv = sim.slider(controls, { label: "v (bottom to top)", min: 0, max: 1, step: 0.01, value: 0.7, onInput: () => v.redraw() });
    const out = sim.readout(readout);
    const colors = ["#e66", "#e6c", "#66d", "#6cc", "#6c6", "#cc6", "#f95", "#c6e", "#999"];
    v.onDraw((view) => {
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++)
        view.rect([-3 + x * 1.2, -1.5 + y * 1.2], [-1.8 + x * 1.2, -0.3 + y * 1.2], { color: colors[y * 3 + x], fill: colors[y * 3 + x], fillAlpha: 1 });
      const p = [-3 + u.value * 3.6, -1.5 + vv.value * 3.6];
      view.point(p, { color: "fg", r: 8, label: "(u, v)" });
      out.set(sim.rows([["uv", `(${fmt(u.value, 2)}, ${fmt(vv.value, 2)})`], ["origin", "OpenGL: v = 0 at the bottom"], ["shader", "texture(uAlbedo, vUv)"]]));
    });
  }

  function textureUnits(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 4, height: 300 });
    const unit = sim.select(controls, { label: "sampler uniform", options: [["0", "uAlbedo → unit 0"], ["1", "uNormal → unit 1"]], value: "0", onChange: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      [["0", "albedo", "a"], ["1", "normal", "g"]].forEach((row, i) => {
        const on = unit.value === row[0];
        view.rect([-3.4, 1.2 - i * 2.1], [3.4, 2.4 - i * 2.1], { color: on ? row[2] : "muted", fill: on ? row[2] : "panel", fillAlpha: .35 });
        view.text([0, 1.8 - i * 2.1], "GL_TEXTURE" + row[0] + "  " + row[1], { align: "center", color: "fg" });
      });
      out.set(sim.rows([["glUniform1i", unit.value], ["bound texture", unit.value === "0" ? "albedo id" : "normal id"], ["active unit before bind", "GL_TEXTURE" + unit.value]]));
    });
  }

  function filterWrap(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 4, height: 320 });
    const filt = sim.select(controls, { label: "Filter", options: [["nearest", "GL_NEAREST"], ["linear", "GL_LINEAR"]], value: "nearest", onChange: () => v.redraw() });
    const wrap = sim.select(controls, { label: "Wrap", options: [["repeat", "GL_REPEAT"], ["clamp", "GL_CLAMP_TO_EDGE"]], value: "repeat", onChange: () => v.redraw() });
    const u = sim.slider(controls, { label: "u sample", min: -0.4, max: 1.4, step: 0.01, value: 0.2, onInput: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      for (let i = 0; i < 8; i++) {
        const col = i % 2 ? "#f4f4f4" : "#334";
        view.rect([-3.2 + i * 0.8, -0.6], [-2.4 + i * 0.8, 0.8], { color: col, fill: col, fillAlpha: 1 });
      }
      let uu = u.value;
      if (wrap.value === "repeat") uu = uu - Math.floor(uu);
      else uu = Math.max(0, Math.min(1, uu));
      const x = -3.2 + uu * 6.4;
      view.point([x, 0.1], { color: "e", r: 8, label: "sample" });
      out.set(sim.rows([["filter", filt.value], ["wrap", wrap.value], ["u in", fmt(u.value, 2)], ["u used", fmt(uu, 2)], ["look", filt.value === "nearest" ? "whole texel" : "blend neighbours"]]));
    });
  }

  function mipChain(sim) {
    const { stage, controls, readout } = sim.layout({ side: "bottom" });
    const v = sim.view2d(stage, { range: 5, height: 300 });
    const level = sim.slider(controls, { label: "mip level", min: 0, max: 4, step: 1, value: 0, onInput: () => v.redraw() });
    const out = sim.readout(readout);
    v.onDraw((view) => {
      const n = 16 >> level.value;
      const size = Math.max(1, n);
      const cell = 6 / 16;
      const origin = -3;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const col = (x + y) % 2 ? "a" : "g";
        const s = cell * (16 / size);
        view.rect([origin + x * s, origin + y * s], [origin + (x + 1) * s, origin + (y + 1) * s], { color: col, fill: col, fillAlpha: .55 });
      }
      out.set(sim.rows([["level", level.value], ["texels on a side", size], ["call", "glTexImage2D(..., level, ...) or glGenerateMipmap"]]));
    });
  }
})();
