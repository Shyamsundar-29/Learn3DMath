// Learn OpenGL: original API-focused foundation lessons.
(function () {
  "use strict";
  const { fmt } = L3D.math;

  const topics = {
    "GL1.1": {
      summary: "OpenGL is a graphics API specification: you call its functions to ask the GPU to draw.",
      lesson: String.raw`<p><strong>OpenGL is a graphics API.</strong> API means a set of functions your C++ program can call. Those functions tell the graphics driver and GPU what to draw.</p><div class="key"><p>Think of OpenGL as a shared language: your program gives drawing instructions, and a graphics driver carries them out on the GPU.</p></div><h2>What OpenGL does</h2><p>OpenGL can clear a screen, upload shape data, run shader programs, use images as textures, and draw pixels. It does <em>not</em> create a window or handle keyboard input by itself. A helper library such as GLFW does those jobs.</p><h2>Core profile</h2><p>This course uses modern core-profile OpenGL. You explicitly create data objects and shaders, which makes the GPU work visible and predictable.</p>`,
      cpp: [{ title: "The first OpenGL call", formula: String.raw`\text{clear colour}=(r,g,b,a)`, note: "<p><strong>Give:</strong> red, green, blue, and alpha values from 0.0 to 1.0. This sets the colour used by the next screen clear.</p>", code: String.raw`
// OpenGL functions use normalized colour values: 0.0 = none, 1.0 = full.
glClearColor(0.10f, 0.15f, 0.24f, 1.0f);
glClear(GL_COLOR_BUFFER_BIT);` }],
      sims: [{ title: "API command story", help: "<p>Pick an OpenGL command. See the small job it asks the GPU to perform.</p>", mount: apiStory }],
    },
    "GL1.2": {
      summary: "OpenGL remembers settings in its context. Binding an object makes it the object the next commands affect.",
      lesson: String.raw`<p>OpenGL works like a <strong>state machine</strong>: it remembers its current settings. A command usually changes the current state, and a draw command uses that state.</p><div class="key"><p>First create an object. Then bind it (make it active). Change its settings. Finally draw using the active objects.</p></div><h2>Why binding matters</h2><p>You might have many textures or vertex buffers. The bind command chooses which one the next OpenGL command will use. Binding is like placing one labelled folder on top of a desk before editing it.</p>`,
      cpp: [{ title: "Create, bind, and fill a buffer", formula: String.raw`\text{active buffer} \leftarrow \text{buffer id}`, note: "<p><strong>Give:</strong> an array of vertex values. OpenGL returns an ID, then that ID is bound before the values are copied to GPU memory.</p>", code: String.raw`
unsigned int vbo = 0;
glGenBuffers(1, &vbo);                 // Create one buffer ID.
glBindBuffer(GL_ARRAY_BUFFER, vbo);    // Make this buffer active.
glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);` }],
      sims: [{ title: "Binding desk", help: "<p>Select an object, bind it, then change its setting. Notice that only the bound object changes.</p>", mount: bindingDesk }],
    },
    "GL2.1": {
      summary: "A GLFW window gives your program an OpenGL context: the place where OpenGL keeps its state and draws.",
      lesson: String.raw`<p>Before OpenGL can draw, your program needs a window and an <strong>OpenGL context</strong>. The context stores OpenGL's state and connects your program to the graphics driver.</p><div class="key"><p>GLFW creates the window, asks for a modern OpenGL version, and handles events. GLAD loads the OpenGL function addresses that the driver provides.</p></div><h2>The setup order</h2><ol><li>Start GLFW.</li><li>Ask for an OpenGL 3.3 core-profile context.</li><li>Create the window.</li><li>Make its context current.</li><li>Load OpenGL functions with GLAD.</li></ol>`,
      cpp: [{ title: "Create an OpenGL 3.3 window", note: "<p><strong>Give:</strong> window width, height, and title. Check each result because a missing driver or unsupported OpenGL version can make setup fail.</p>", code: String.raw`
glfwInit();
glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

GLFWwindow* window = glfwCreateWindow(800, 600, "Learn OpenGL", nullptr, nullptr);
if (window == nullptr) return -1;
glfwMakeContextCurrent(window);
if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) return -1;` }],
      sims: [{ title: "Window setup checklist", help: "<p>Turn on each setup step in order. The final drawing step only works after all required steps are ready.</p>", mount: setupChecklist }],
    },
    "GL2.2": {
      summary: "The render loop repeats while the window is open: handle input, draw a frame, then show it.",
      lesson: String.raw`<p>A game does not draw only once. It repeats a <strong>render loop</strong> many times each second.</p><div class="key"><p>Every loop: read input → clear the old frame → draw the new frame → swap it onto the screen → check events.</p></div><p>Swapping buffers shows the fully drawn back buffer, so the player does not see a half-finished image.</p>`,
      cpp: [{ title: "A minimal render loop", note: "<p><strong>Give:</strong> a valid GLFW window. The loop continues until the user asks to close it.</p>", code: String.raw`
while (!glfwWindowShouldClose(window))
{
    glClearColor(0.10f, 0.15f, 0.24f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT);      // Start a fresh frame.
    // Draw your objects here.
    glfwSwapBuffers(window);           // Show the finished frame.
    glfwPollEvents();                  // Read keyboard, mouse, and window events.
}` }],
      sims: [{ title: "Frame loop timeline", help: "<p>Change the work each frame. The timeline shows the repeating jobs that make animation possible.</p>", mount: renderLoop }],
    },
    "GL2.3": {
      summary: "A triangle is the first programmable OpenGL shape: upload three vertices, configure their layout, use a shader, and draw.",
      lesson: String.raw`<p>Modern OpenGL draws from data you provide. For a triangle, put three vertex positions in a vertex buffer, describe how to read them with a vertex array object, choose a shader program, and issue a draw call.</p><div class="key"><p>A vertex is one corner. Three vertices make one triangle. The vertex shader decides where each corner appears; the fragment shader colours the pixels inside.</p></div>`,
      cpp: [{ title: "Draw three uploaded vertices", note: "<p><strong>Give:</strong> a linked shader program and a configured vertex array object (VAO). The number <code>3</code> is the number of triangle vertices.</p>", code: String.raw`
glUseProgram(shaderProgram);
glBindVertexArray(vao);
glDrawArrays(GL_TRIANGLES, 0, 3);` }],
      sims: [{ title: "Triangle pipeline", help: "<p>Drag a vertex. The triangle is built from three points, then the GPU fills the pixels inside.</p>", mount: trianglePipeline }],
    },
    "GL3.1": {
      summary: "Shaders are small programs that run on the GPU: vertex shaders place vertices and fragment shaders choose pixel colours.",
      lesson: String.raw`<p>A <strong>shader</strong> is a small GPU program written in GLSL. A vertex shader runs once for each vertex. A fragment shader runs for the pixel-sized pieces inside a shape.</p><div class="key"><p>Vertex shader: where does this corner go? Fragment shader: what colour should this pixel be?</p></div><p>Before drawing, compile the shader source, link the shaders into one program, then call <code>glUseProgram</code>.</p>`,
      cpp: [{ title: "A tiny fragment shader", note: "<p><strong>Give:</strong> a GLSL source string. This shader gives every fragment the same orange colour.</p>", code: String.raw`
const char* fragmentSource = R"glsl(
#version 330 core
out vec4 FragColor;
void main()
{
    FragColor = vec4(1.0, 0.5, 0.2, 1.0);
}
)glsl";` }],
      sims: [{ title: "Shader stage story", help: "<p>Change the shader colour and see the fragment stage repaint the triangle.</p>", mount: shaderStory }],
    },
    "GL3.2": {
      summary: "A texture is image data stored on the GPU. Texture coordinates tell OpenGL which part of the image belongs on each vertex.",
      lesson: String.raw`<p>A <strong>texture</strong> is usually an image copied into GPU memory. Texture coordinates, often named <code>u</code> and <code>v</code>, run from 0 to 1 and say which part of that image belongs at a vertex.</p><div class="key"><p>Upload image → bind texture → give each vertex a texture coordinate → let the fragment shader sample the matching image colour.</p></div>`,
      cpp: [{ title: "Bind a texture for drawing", note: "<p><strong>Give:</strong> a texture ID that was created and filled with image pixels. Texture unit 0 is a common first choice.</p>", code: String.raw`
glActiveTexture(GL_TEXTURE0);
glBindTexture(GL_TEXTURE_2D, textureId);
glUseProgram(shaderProgram);
glUniform1i(glGetUniformLocation(shaderProgram, "ourTexture"), 0);` }],
      sims: [{ title: "Texture coordinate mapper", help: "<p>Move the texture coordinate point. See where the matching colour comes from in the small image.</p>", mount: textureMapper }],
    },
  };

  function apiStory(sim) { const { stage, controls, readout } = sim.layout({ side: "bottom" }); const v = sim.view2d(stage, { range: 4, height: 300 }); const command = sim.select(controls, { label: "OpenGL command", options: [["clear", "glClear - erase old frame"], ["buffer", "glBufferData - send data"], ["shader", "glUseProgram - choose GPU program"], ["draw", "glDrawArrays - draw vertices"]], value: "clear", onChange: () => v.redraw() }); const out = sim.readout(readout); v.onDraw((view) => { view.rect([-3, -2], [3, 2], { color: "a", fill: command.value === "clear" ? "a" : "panel", fillAlpha: .35 }); view.text([0, 0], { clear: "clear the frame", buffer: "send shape data", shader: "choose shader", draw: "draw triangle" }[command.value], { align: "center", color: "fg", size: 18 }); if (command.value === "draw") view.polygon([[-1, -1], [1, -1], [0, 1]], { color: "g", fill: "g", fillAlpha: .5 }); out.set(sim.rows([["API call", command.value], ["GPU job", "one small drawing instruction"]])); }); }
  function bindingDesk(sim) { const { stage, controls, readout } = sim.layout({ side: "bottom" }); const v = sim.view2d(stage, { range: 4, height: 300 }); const object = sim.select(controls, { label: "Object to bind", options: [["a", "Buffer A"], ["b", "Buffer B"]], value: "a", onChange: () => v.redraw() }); const setting = sim.slider(controls, { label: "Data size", min: 1, max: 6, step: 1, value: 3, onInput: () => v.redraw() }); const out = sim.readout(readout); v.onDraw((view) => { view.rect([-3, .4], [3, 1.6], { color: object.value === "a" ? "a" : "muted", fill: object.value === "a" ? "a" : "panel", fillAlpha: .35 }); view.rect([-3, -1.6], [3, -.4], { color: object.value === "b" ? "g" : "muted", fill: object.value === "b" ? "g" : "panel", fillAlpha: .35 }); view.text([-2.7, 1], "Buffer A", { color: "fg" }); view.text([-2.7, -1], "Buffer B", { color: "fg" }); view.rect([-1, object.value === "a" ? .55 : -1.45], [-1 + setting.value * .55, object.value === "a" ? 1.45 : -.55], { color: object.value === "a" ? "a" : "g", fill: object.value === "a" ? "a" : "g", fillAlpha: .7 }); out.set(sim.rows([["bound object", "Buffer " + object.value.toUpperCase()], ["changed setting", setting.value + " data units"]])); }); }
  function setupChecklist(sim) { const { stage, controls, readout } = sim.layout({ side: "bottom" }); const steps = ["Start GLFW", "Ask for OpenGL 3.3", "Create window", "Make context current", "Load GLAD"]; const checks = steps.map((label, i) => sim.checkbox(controls, { label, value: i === 0, onChange: () => draw() })); const v = sim.view2d(stage, { range: 4, height: 300 }); const out = sim.readout(readout); function draw() { v.redraw(); } v.onDraw((view) => { const ready = checks.every(c => c.value); steps.forEach((s, i) => { const ok = checks[i].value; view.rect([-3.5, 2.4 - i], [3.5, 1.7 - i], { color: ok ? "c" : "muted", fill: ok ? "c" : "panel", fillAlpha: .28 }); view.text([-3.1, 2.05 - i], (ok ? "✓ " : "○ ") + s, { color: "fg", size: 15 }); }); out.set(sim.rows([["setup ready", ready ? "yes - you can draw" : "not yet"], ["steps complete", checks.filter(c => c.value).length + " / 5"]])); }); }
  function renderLoop(sim) { const { stage, controls, readout } = sim.layout({ side: "bottom" }); const v = sim.view2d(stage, { range: 5, height: 300 }); const work = sim.slider(controls, { label: "Work per frame", min: 1, max: 5, step: 1, value: 3, onInput: () => v.redraw() }); const out = sim.readout(readout); v.onDraw((view) => { const jobs = ["input", "clear", "draw", "show", "events"]; jobs.forEach((job, i) => { const x = -4 + i * 2; view.rect([x, -.7], [x + 1.4, .7], { color: i < work.value ? "a" : "muted", fill: i < work.value ? "a" : "panel", fillAlpha: .4 }); view.text([x + .7, 0], job, { align: "center", color: "fg", size: 13 }); }); out.set(sim.rows([["frame jobs", work.value + " / 5"], ["story", "repeat this sequence every frame"]])); }); }
  function trianglePipeline(sim) { const { stage, controls, readout } = sim.layout({ side: "bottom" }); const v = sim.view2d(stage, { range: 3, height: 320 }); const x = v.handle([0, 1.5], { color: "a", label: "vertex" }); const out = sim.readout(readout); v.onDraw((view) => { const p = [[-2, -1.4], [2, -1.4], x.pos]; view.polygon(p, { color: "a", fill: "a", fillAlpha: .35 }); p.forEach((q, i) => view.point(q, { color: "a", label: "v" + (i + 1) })); out.set(sim.rows([["vertices", "3"], ["draw call", "glDrawArrays(GL_TRIANGLES, 0, 3)"]])); }); }
  function shaderStory(sim) { const { stage, controls, readout } = sim.layout({ side: "bottom" }); const v = sim.view2d(stage, { range: 3, height: 320 }); const hue = sim.slider(controls, { label: "Fragment shader colour", min: 0, max: 360, step: 1, value: 25, unit: "°", onInput: () => v.redraw() }); const out = sim.readout(readout); v.onDraw((view) => { const color = `hsl(${hue.value}, 75%, 55%)`; view.polygon([[-2, -1.5], [2, -1.5], [0, 1.7]], { color, fill: color, fillAlpha: .8 }); out.set(sim.rows([["vertex shader", "places 3 corners"], ["fragment shader", "colours pixels"], ["output colour", color]])); }); }
  function textureMapper(sim) { const { stage, controls, readout } = sim.layout({ side: "bottom" }); const v = sim.view2d(stage, { range: 4, height: 320 }); const u = sim.slider(controls, { label: "u (left to right)", min: 0, max: 1, step: .01, value: .3, onInput: () => v.redraw() }); const w = sim.slider(controls, { label: "v (bottom to top)", min: 0, max: 1, step: .01, value: .7, onInput: () => v.redraw() }); const out = sim.readout(readout); v.onDraw((view) => { const colors = ["#e66", "#e6c", "#66d", "#6cc", "#6c6", "#cc6", "#f95", "#c6e", "#999"]; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) view.rect([-3 + x * 1.2, -1.5 + y * 1.2], [-1.8 + x * 1.2, -.3 + y * 1.2], { color: colors[y * 3 + x], fill: colors[y * 3 + x], fillAlpha: 1 }); const p = [-3 + u.value * 3.6, -1.5 + w.value * 3.6]; view.point(p, { color: "fg", r: 8, label: "(u, v)" }); out.set(sim.rows([["texture coordinate", `(${fmt(u.value, 2)}, ${fmt(w.value, 2)})`], ["meaning", "which image colour to use"]])); }); }

  Object.entries(topics).forEach(([id, topic]) => L3D.topic({ id, ...topic, keyFormulas: [], exercises: [] }));
})();
