// Chapter 1 - The Rendering Pipeline
(function () {
  "use strict";
  const { V, M, fmt, fmtVec, rad, clamp } = L3D.math;

  // Cycle of colors used to tell frames / primitives apart.
  const CYCLE = ["a", "b", "c", "d", "f", "g", "e"];

  // ===========================================================================
  // 1.1 Graphics Processors
  // ===========================================================================
  L3D.topic({
    id: "1.1",
    summary: "How a game hands its scene to the GPU: primitives, asynchronous command buffers, VRAM, and the image, depth, and stencil buffers.",

    lesson: String.raw`
      <p>A scene is made of many separate objects. Each object's shape is a list of <strong>vertices</strong>
      plus a <strong>primitive type</strong> that says how the vertices connect. OpenGL defines ten primitive types:
      points, lines, line strips, line loops, triangles, triangle strips, triangle fans, and (in older versions)
      quads, quad strips and polygons. In practice almost every 3D model is a <em>triangle list</em>: a vertex array
      plus an index array, where each group of three indices names one triangle.</p>

      <div class="note">Strips and fans exist to save memory and bandwidth. A strip of \(n\) vertices gives
      \(n-2\) triangles instead of needing \(3(n-2)\) vertices. In a strip every other triangle has reversed winding,
      and the hardware flips it back so all triangles face the same way.</div>

      <h2>CPU and GPU work asynchronously</h2>
      <p>A graphics card has its own processor, the <strong>GPU</strong>, which runs independently of the
      <strong>CPU</strong>. The CPU doesn't draw pixels. It records <em>commands</em> ("use this shader, bind
      this vertex buffer, draw 1,200 triangles"), and the GPU executes them later. A call like
      <code>glDrawElements</code> usually returns long before the triangles are drawn. This is called
      <strong>asynchronous operation</strong>, and it lets the CPU start on the next frame's game logic while
      the GPU is still rendering the current one.</p>
      <p>The application talks to a library such as OpenGL or Direct3D. That library forms a
      <strong>hardware abstraction layer</strong> (HAL), the same functions on every GPU, and a
      <strong>driver</strong> translates the calls into the GPU's native commands. They are queued in a
      <strong>command buffer</strong> that the GPU consumes.</p>

      <div class="warn">Waiting for the GPU to finish (reading back a texture, or querying when a draw is done)
      makes the CPU and GPU take turns instead of overlapping. Real-time engines avoid that kind of
      synchronization whenever they can.</div>

      <h2>What lives in video memory</h2>
      <p>The GPU has its own fast memory, <strong>VRAM</strong>. While a game is running it almost always holds:</p>
      <ul>
        <li><strong>Front image buffer</strong>: the pixels currently shown in the viewport.</li>
        <li><strong>Back image buffer</strong>: where the GPU actually renders the next frame, out of sight.
          When the frame is finished the two are exchanged in a <strong>buffer swap</strong>, either by changing
          which address the display reads or by copying back to front.</li>
        <li><strong>Depth buffer (z-buffer)</strong>: one depth value per pixel, used for hidden-surface removal. A
          new pixel is drawn only if it is nearer than what's already there (Section 1.3).</li>
        <li><strong>Stencil buffer</strong>: a small integer per pixel that can enable or disable drawing pixel
          by pixel. It's used for mirrors, portals and the stencil shadows of Chapter 10.</li>
        <li><strong>Texture maps</strong>: usually the largest use of VRAM. They hold images, but also data such
          as the bump maps of Chapter 7.</li>
        <li><strong>Vertex and index buffers</strong>: the mesh data itself.</li>
      </ul>

      <h2>Double buffering, vertical sync and tearing</h2>
      <p>The monitor reads the front buffer from top to bottom, one row at a time, about 60 times per second.
      If the GPU drew straight into the visible buffer, you would watch frames being painted. Double buffering
      avoids that. But if the swap happens <em>while</em> the display is part-way down the screen, the top
      of the screen shows the old frame and the bottom shows the new one. That visible seam is
      <strong>tearing</strong>. Syncing the swap to the display's vertical refresh (<strong>v-sync</strong>)
      removes it. The cost is that a frame that just misses a refresh waits for the next one.</p>

      <div class="game">Engines are tuned around this split. "CPU-bound" means the game logic and draw-call
      submission take longer than the GPU's rendering; "GPU-bound" is the opposite. The frame rate is set by
      whichever side is slower, and with v-sync it is rounded to a divisor of the refresh rate (60, 30, 20 …).
      The timeline simulation shows this.</div>

      <p><a class="btn goto-sim" href="#/1.1/sim">Try it: primitives, the CPU/GPU timeline, and tearing →</a></p>
    `,

    keyFormulas: [
      ["Triangles from n vertices", String.raw`\text{list: } n/3 \qquad \text{strip: } n-2 \qquad \text{fan: } n-2`],
      ["Frame time (no v-sync)", String.raw`t_{\text{frame}} \approx \max(t_{\text{CPU}},\, t_{\text{GPU}})`],
      ["Frame time with v-sync at refresh period T", String.raw`t_{\text{frame}} = T\left\lceil \max(t_{\text{CPU}}, t_{\text{GPU}}) / T \right\rceil`],
    ],

    exercises: [
      { q: "A triangle strip has 10 vertices. How many triangles does it draw, and how many vertices would the same triangles need as a plain triangle list?",
        a: "10 − 2 = 8 triangles. As a list that's 8 × 3 = 24 vertices." },
      { q: "The CPU needs 6 ms per frame and the GPU needs 22 ms. Is the game CPU-bound or GPU-bound, and what frame rate do you get with v-sync at 60 Hz?",
        a: "GPU-bound. 22 ms is more than one 16.7 ms refresh, so each frame waits for the second refresh. That's 33.3 ms per frame, or 30 fps." },
      { q: "Why does the GPU render into a back buffer instead of the visible one?",
        a: "So the viewer never sees a half-drawn frame. The finished image becomes visible all at once at the swap." },
      { q: "Which buffer would you use to draw only inside the shape of a mirror?",
        a: "The stencil buffer. Write 1 where the mirror is, then draw the reflected scene with a stencil test that passes only where the value is 1." },
    ],

    sims: [
      {
        title: "Graphics primitives",
        help: String.raw`<p>Drag the numbered vertices and switch the primitive type. The same vertex list
          gives very different shapes depending on how the GPU is told to connect it. Strip triangles are
          drawn with alternating winding, so the arrows show the order the hardware actually uses.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { range: 4.2, height: 440 });
          const out = sim.readout(readout);
          const start = [[-3.6, -1.6], [-2.8, 1.4], [-1.4, -1.8], [-0.6, 1.6], [0.8, -1.5], [1.6, 1.7], [3.0, -1.2], [3.6, 1.3]];
          const verts = start.map((p, i) => view.handle(p, { color: "fg", label: String(i), r: 6 }));
          const type = sim.select(controls, {
            label: "Primitive type",
            options: [["points", "Points"], ["lines", "Lines"], ["lineStrip", "Line strip"], ["lineLoop", "Line loop"],
              ["triangles", "Triangles"], ["triStrip", "Triangle strip"], ["triFan", "Triangle fan"],
              ["quads", "Quads (legacy)"], ["quadStrip", "Quad strip (legacy)"], ["polygon", "Polygon (legacy)"]],
            value: "triStrip",
            onChange: () => view.redraw(),
          });
          const count = sim.slider(controls, { label: "Vertices used", min: 3, max: 8, step: 1, value: 8, onInput: () => view.redraw() });
          sim.buttons(controls, [{ label: "Reset layout", onClick: () => verts.forEach((h, i) => h.set(start[i])) }]);

          // Index lists produced by each primitive type for n vertices.
          function assemble(kind, n) {
            const prims = [];
            if (kind === "points") for (let i = 0; i < n; i++) prims.push([i]);
            if (kind === "lines") for (let i = 0; i + 1 < n; i += 2) prims.push([i, i + 1]);
            if (kind === "lineStrip") for (let i = 0; i + 1 < n; i++) prims.push([i, i + 1]);
            if (kind === "lineLoop") { for (let i = 0; i + 1 < n; i++) prims.push([i, i + 1]); prims.push([n - 1, 0]); }
            if (kind === "triangles") for (let i = 0; i + 2 < n; i += 3) prims.push([i, i + 1, i + 2]);
            // odd triangles are flipped so every triangle keeps the same winding
            if (kind === "triStrip") for (let i = 0; i + 2 < n; i++) prims.push(i % 2 ? [i + 1, i, i + 2] : [i, i + 1, i + 2]);
            if (kind === "triFan") for (let i = 1; i + 1 < n; i++) prims.push([0, i, i + 1]);
            if (kind === "quads") for (let i = 0; i + 3 < n; i += 4) prims.push([i, i + 1, i + 2, i + 3]);
            if (kind === "quadStrip") for (let i = 0; i + 3 < n; i += 2) prims.push([i, i + 1, i + 3, i + 2]);
            if (kind === "polygon") prims.push([...Array(n).keys()]);
            return prims;
          }

          view.onDraw((v) => {
            v.grid({ step: 1 });
            const n = count.value;
            verts.forEach((h, i) => (h.visible = i < n));
            const P = verts.map((h) => h.pos);
            const prims = assemble(type.value, n);
            prims.forEach((idx, k) => {
              const col = CYCLE[k % CYCLE.length];
              const pts = idx.map((i) => P[i]);
              if (idx.length >= 3) {
                v.polygon(pts, { fill: col, fillAlpha: 0.22, color: col, width: 1.5 });
                // winding arrows around the centroid
                const c = V.scale(pts.reduce((s, p) => V.add(s, p), [0, 0]), 1 / pts.length);
                for (let j = 0; j < pts.length; j++) {
                  const a = V.lerp(c, pts[j], 0.55), b = V.lerp(c, pts[(j + 1) % pts.length], 0.55);
                  v.arrow(a, V.lerp(a, b, 0.85), { color: col, width: 1.5, head: 7 });
                }
              } else if (idx.length === 2) {
                v.arrow(pts[0], pts[1], { color: col, width: 3 });
              } else {
                v.point(pts[0], { color: col, r: 10 });
              }
            });
            out.set(sim.rows([
              ["vertices", String(n)],
              ["primitives", String(prims.length)],
            ]) + `<hr><div class="eq">${prims.map((p) => "(" + p.join(", ") + ")").join(" ") || "none"}</div>` +
              (type.value === "triStrip" ? "Strip triangles alternate (i, i+1, i+2) and (i+1, i, i+2), so all of them keep the same winding." : "") +
              (type.value === "lines" && n % 2 ? "An odd vertex at the end is ignored: lines need pairs." : "") +
              (type.value === "triangles" && n % 3 ? `${n % 3} leftover vertex(es) ignored: triangles need groups of 3.` : ""));
          });
        },
      },
      {
        title: "CPU and GPU timeline",
        help: String.raw`<p>Each colored block is one frame. The CPU records frame <i>k</i> while the GPU renders frame
          <i>k − 1</i>. Make one side slower to see it become the bottleneck, and turn v-sync on and off to see swaps
          snap to the 60 Hz refresh lines (dashed). Red ticks mark swaps that would tear.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const cv = sim.canvas(stage, { height: 290 });
          const out = sim.readout(readout);
          const T = 1000 / 60;
          let frames = [];
          const rebuild = () => {
            frames = [];
            let cpuFree = 0, gpuFree = 0, lastSwap = 0;
            for (let i = 0; i < 400; i++) {
              const cpuStart = Math.max(cpuFree, i >= 2 ? frames[i - 2].gpuEnd : 0); // at most 2 frames queued
              const cpuEnd = cpuStart + cpu.value;
              const gpuStart = Math.max(cpuEnd, gpuFree, vsync.value ? lastSwap : 0); // back buffer must be free
              const gpuEnd = gpuStart + gpu.value;
              const swap = vsync.value ? Math.ceil(gpuEnd / T - 1e-9) * T : gpuEnd;
              frames.push({ i, cpuStart, cpuEnd, gpuStart, gpuEnd, swap });
              cpuFree = cpuEnd; gpuFree = gpuEnd; lastSwap = swap;
              if (cpuStart > 4000) break;
            }
          };
          const cpu = sim.slider(controls, { label: "CPU time per frame", min: 2, max: 40, step: 1, value: 7, unit: " ms", onInput: rebuild });
          const gpu = sim.slider(controls, { label: "GPU time per frame", min: 2, max: 40, step: 1, value: 12, unit: " ms", onInput: rebuild });
          const vsync = sim.checkbox(controls, { label: "V-sync (60 Hz)", value: true, onChange: rebuild });
          const speed = sim.slider(controls, { label: "Playback speed", min: 0.02, max: 0.5, step: 0.01, value: 0.08, format: (x) => x.toFixed(2) + "×" });
          rebuild();
          let now = 120;
          const span = 110; // ms of history on screen

          sim.loop((dt) => {
            now += dt * 1000 * speed.value;
            if (now > 3500) now = 120;
            cv.redraw();
          });

          cv.onDraw((c) => {
            const ctx = c.ctx, left = 74, right = c.w - 12, t0 = now - span;
            const X = (t) => left + ((t - t0) / span) * (right - left);
            const lanes = [["CPU", 30], ["GPU", 100], ["Display", 170]];
            const laneH = 46;
            ctx.save();
            ctx.beginPath(); ctx.rect(left, 0, right - left, c.h); ctx.clip();
            // refresh (vblank) lines
            for (let t = Math.floor(t0 / T) * T; t <= now; t += T) {
              ctx.strokeStyle = sim.color("muted"); ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(X(t), 18); ctx.lineTo(X(t), 226); ctx.stroke();
            }
            ctx.setLineDash([]);
            const block = (a, b, y, col, text) => {
              if (b < t0 || a > now) return;
              const x0 = X(Math.max(a, t0)), x1 = X(Math.min(b, now));
              ctx.fillStyle = L3D.color.withAlpha(sim.color(col), 0.8);
              ctx.fillRect(x0, y, Math.max(1, x1 - x0 - 1), laneH);
              if (x1 - x0 > 22) c.label((x0 + x1) / 2, y + laneH / 2 + 4, text, { color: "#fff", align: "center", weight: 700, size: 12 });
            };
            for (const f of frames) {
              const col = CYCLE[f.i % CYCLE.length];
              block(f.cpuStart, f.cpuEnd, lanes[0][1], col, "F" + f.i);
              block(f.gpuStart, f.gpuEnd, lanes[1][1], col, "F" + f.i);
              const next = frames[f.i + 1];
              block(f.swap, next ? next.swap : Infinity, lanes[2][1], col, "F" + f.i);
              if (f.swap > t0 && f.swap <= now && Math.abs(f.swap / T - Math.round(f.swap / T)) > 1e-6) {
                ctx.fillStyle = sim.color("e");
                ctx.fillRect(X(f.swap) - 1.5, lanes[2][1] - 6, 3, laneH + 12);
              }
            }
            ctx.restore();
            for (const [name, y] of lanes) c.label(8, y + laneH / 2 + 4, name, { color: "fg", weight: 700, size: 13 });
            c.label(left, 250, "← older", { color: "muted", size: 11 });
            c.label(right, 250, "now", { color: "muted", size: 11, align: "right" });
            c.label(left, 272, "dashed lines = display refresh (every 16.7 ms)", { color: "muted", size: 11 });

            // statistics over the frames already shown
            const shown = frames.filter((f) => f.swap <= now && f.swap > now - 1000);
            let fps = 0;
            if (shown.length > 2) fps = (1000 * (shown.length - 1)) / (shown[shown.length - 1].swap - shown[0].swap);
            const bound = cpu.value > gpu.value ? "CPU-bound" : cpu.value < gpu.value ? "GPU-bound" : "balanced";
            const last = shown[shown.length - 1];
            out.set(sim.rows([
              ["frame rate", fps ? fmt(fps, 1) + " fps" : "…"],
              ["bottleneck", bound],
              ["max(CPU, GPU)", Math.max(cpu.value, gpu.value) + " ms"],
              ["latency (CPU start → visible)", last ? fmt(last.swap - last.cpuStart, 1) + " ms" : "…"],
            ]) + `<hr>${vsync.value ? "With v-sync, swaps wait for a refresh, so the frame time is rounded up to a multiple of 16.7 ms." : "Without v-sync, frames swap the moment they finish. That's faster, but most swaps land mid-scan (red) and tear."}`);
          });
        },
      },
      {
        title: "Double buffering and tearing",
        help: String.raw`<p>A bar moves across the screen, one step per rendered frame. The monitor scans rows top to bottom
          (the white line). Each row shows whatever was in the front buffer <em>when that row was scanned</em>. Compare single
          buffering, double buffering without v-sync (tearing) and with v-sync, in slow motion.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const cv = sim.canvas(stage, { height: 380 });
          const out = sim.readout(readout);
          const mode = sim.segmented(controls, {
            label: "Buffering",
            options: [["single", "Single"], ["double", "Double"], ["vsync", "Double + v-sync"]],
            value: "double",
          });
          const fps = sim.slider(controls, { label: "Render rate", min: 20, max: 140, step: 1, value: 47, unit: " fps" });
          const slow = sim.slider(controls, { label: "Slow motion", min: 0.005, max: 0.1, step: 0.005, value: 0.02, format: (x) => x.toFixed(3) + "×" });
          const T = 1 / 60, ROWS = 60;
          let t = 0.5;

          // Which frame does the front buffer hold at time tau? (fraction = how far single-buffer drawing got)
          function frontAt(tau) {
            const F = 1 / fps.value;
            const k = Math.floor(tau / F); // frame k finished at k*F
            if (mode.value === "single") {
              const p = (tau - k * F) / (0.85 * F); // frame k+1 is being drawn straight into the visible buffer
              return { frame: k, drawing: k + 1, progress: Math.min(1, p) };
            }
            if (mode.value === "double") return { frame: k };
            // v-sync: frame j becomes visible at the first refresh after it finishes
            let j = k;
            while (j > 0 && Math.ceil((j * F) / T - 1e-9) * T > tau) j--;
            return { frame: j };
          }

          const barX = (frame) => ((frame * 0.045) % 1.2) - 0.1; // fraction of screen width

          sim.loop((dt) => {
            t += dt * slow.value;
            cv.redraw();
          });

          cv.onDraw((c) => {
            const ctx = c.ctx;
            const W = Math.min(c.w - 40, 520), H = 300, x0 = 20, y0 = 30;
            const s = Math.floor(t / T) * T;          // start of the current refresh
            const scanRow = Math.floor(((t - s) / T) * ROWS);
            c.label(x0, 20, "What the monitor shows", { color: "fg", weight: 700, size: 13 });
            let tears = 0, prevFrame = null;
            for (let r = 0; r < ROWS; r++) {
              const tau = r <= scanRow ? s + (r / ROWS) * T : s - T + (r / ROWS) * T;
              const fb = frontAt(tau);
              let frame = fb.frame;
              if (mode.value === "single" && fb.progress > r / ROWS) frame = fb.drawing; // GPU already overwrote this row
              const y = y0 + (r / ROWS) * H, h = H / ROWS + 0.5;
              ctx.fillStyle = sim.color("panel");
              ctx.fillRect(x0, y, W, h);
              const bx = x0 + barX(frame) * W;
              ctx.fillStyle = sim.color(CYCLE[frame % CYCLE.length]);
              ctx.fillRect(bx, y, W * 0.09, h);
              if (prevFrame !== null && frame !== prevFrame) {
                tears++;
                ctx.fillStyle = sim.color("e");
                ctx.fillRect(x0 + W + 4, y - 2, 10, 4);
              }
              prevFrame = frame;
            }
            ctx.strokeStyle = sim.color("muted");
            ctx.strokeRect(x0, y0, W, H);
            const sy = y0 + ((scanRow + 1) / ROWS) * H;
            ctx.strokeStyle = sim.color("fg"); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x0 - 8, sy); ctx.lineTo(x0 + W + 8, sy); ctx.stroke();
            c.label(x0 + W + 18, sy + 4, "scan", { color: "muted", size: 11 });
            c.label(x0, y0 + H + 22, tears ? `${tears} tear line(s): different rows come from different frames` : "One consistent frame on screen", { color: tears ? "e" : "c", size: 12, weight: 600 });

            const fb = frontAt(t);
            out.set(sim.rows([
              ["front buffer holds", "frame " + fb.frame],
              ["rendering", mode.value === "single" ? `frame ${fb.drawing} (into the visible buffer!)` : "frame " + (Math.floor(t * fps.value) + 1) + " (back buffer)"],
              ["refresh rate", "60 Hz"],
            ]) + "<hr>" + (mode.value === "single" ? "With one buffer you can see frames being drawn: the bar is split where drawing has reached."
              : mode.value === "double" ? "Swapping as soon as a frame is done means the swap often happens mid-scan, so the picture tears."
              : "Swaps wait for the next refresh, so every scan shows one whole frame. A frame that misses a refresh waits for the next one."));
          });
        },
      },
    ],

    cpp: [
      {
        title: "Vertex and index buffers",
        note: "<p>A mesh is a vertex array plus an index array. Every three indices form one triangle (a triangle list).</p>",
        code: String.raw`
          struct Vertex
          {
              Point3D  position;
              Vector3D normal;
              Vector2D texcoord;
          };

          struct Mesh
          {
              std::vector<Vertex>   vertices;   // uploaded once into a GPU vertex buffer
              std::vector<uint32_t> indices;    // 3 per triangle

              size_t TriangleCount() const { return indices.size() / 3; }
          };
        `,
      },
      {
        title: "Triangle strip to triangle list",
        formula: String.raw`\triangle_i = \begin{cases}(i,\; i+1,\; i+2) & i \text{ even}\\ (i+1,\; i,\; i+2) & i \text{ odd}\end{cases} \qquad i = 0 \dots n-3`,
        code: String.raw`
          std::vector<uint32_t> StripToList(const std::vector<uint32_t>& strip)
          {
              std::vector<uint32_t> list;
              for (size_t i = 0; i + 2 < strip.size(); ++i)
              {
                  if (i % 2 == 0) list.insert(list.end(), {strip[i], strip[i + 1], strip[i + 2]});
                  else            list.insert(list.end(), {strip[i + 1], strip[i], strip[i + 2]});  // keep winding
              }
              return list;
          }

          std::vector<uint32_t> FanToList(const std::vector<uint32_t>& fan)
          {
              std::vector<uint32_t> list;
              for (size_t i = 1; i + 1 < fan.size(); ++i)
                  list.insert(list.end(), {fan[0], fan[i], fan[i + 1]});
              return list;
          }
        `,
      },
      {
        title: "A double-buffered frame loop",
        note: "<p>The shape of every game loop. <code>SwapBuffers</code> is the buffer swap. With v-sync on it waits for the display's next refresh.</p>",
        code: String.raw`
          // The engine pieces involved (declarations only)
          struct Window   { bool IsOpen(); float FrameTime(); void SwapBuffers(); };
          struct Renderer { void BeginFrame(); void EndFrame(); };
          struct Game     { void Update(float dt); void Render(Renderer& renderer); };

          void RunGame(Game& game, Renderer& renderer, Window& window)
          {
              while (window.IsOpen())
              {
                  float dt = window.FrameTime();

                  game.Update(dt);              // CPU: input, AI, physics
                  renderer.BeginFrame();        // record commands for the back buffer
                  game.Render(renderer);        // draw calls return immediately (asynchronous)
                  renderer.EndFrame();          // submit the command buffer to the GPU

                  window.SwapBuffers();         // back buffer becomes the front buffer
              }
          }
        `,
      },
      {
        title: "Frame time with v-sync",
        formula: String.raw`t_{\text{frame}} = T\left\lceil \frac{\max(t_{\text{CPU}}, t_{\text{GPU}})}{T} \right\rceil,\quad T = \frac{1}{\text{refresh rate}}`,
        code: String.raw`
          float FrameTimeWithVSync(float cpuMs, float gpuMs, float refreshHz = 60.0f)
          {
              float T = 1000.0f / refreshHz;                  // 16.67 ms at 60 Hz
              float work = std::max(cpuMs, gpuMs);            // the slower side sets the pace
              return T * std::ceil(work / T);                 // rounded up to whole refreshes
          }
          // FrameTimeWithVSync(7, 12)  -> 16.7 ms (60 fps)
          // FrameTimeWithVSync(7, 22)  -> 33.3 ms (30 fps)
        `,
      },
    ],
  });

  // ===========================================================================
  // 1.2 Vertex Transformation
  // ===========================================================================

  // A small colored pyramid used as "the model" in 1.2.
  const MODEL = (() => {
    const m = L3D.shapes.pyramid(0.8, 1.4);
    return { ...m, colors: ["muted", "a", "b", "c", "d"] };
  })();

  L3D.topic({
    id: "1.2",
    summary: "Follow one vertex from object space to world, camera, clip, normalized device and finally window coordinates.",

    lesson: String.raw`
      <p>The GPU receives geometry as 3D coordinates and has to turn it into positions in a 2D viewport. On the way,
      every vertex is <em>re-expressed</em> in a series of coordinate systems. The vertex doesn't move. What changes
      is the frame of reference its coordinates are measured in.</p>

      <h2>The coordinate spaces</h2>
      <table>
        <tr><th>Space</th><th>Meaning</th><th>Reached by</th></tr>
        <tr><td><b>Object space</b></td><td>Local to one model, relative to its own origin, as authored in the modeling tool.</td><td>(starting point)</td></tr>
        <tr><td><b>World space</b></td><td>One global system shared by every object in the scene.</td><td>model (object-to-world) transform</td></tr>
        <tr><td><b>Camera space</b> (eye space)</td><td>Camera at the origin, \(x\) right, \(y\) up, looking down \(-z\).</td><td>view (world-to-camera) transform</td></tr>
        <tr><td><b>Homogeneous clip space</b></td><td>4D coordinates \((x, y, z, w)\) where clipping happens.</td><td>projection transform</td></tr>
        <tr><td><b>Normalized device coordinates</b></td><td>The visible volume becomes the cube \([-1, 1]^3\).</td><td>divide by \(w\)</td></tr>
        <tr><td><b>Window space</b></td><td>Pixel coordinates in the viewport, plus a depth in \([0,1]\).</td><td>viewport transform</td></tr>
      </table>

      <p>The object-to-world and world-to-camera matrices are usually multiplied together into a single
      <strong>model-view</strong> matrix, so each vertex needs only one matrix multiplication to reach camera space:
      \[ \mathbf P_{\text{camera}} = \mathbf M_{\text{view}}\,\mathbf M_{\text{model}}\,\mathbf P_{\text{object}}. \]
      Because we use column vectors, the transform applied <em>first</em> is the one written on the
      <em>right</em>.</p>

      <h2>Projection and the perspective divide</h2>
      <p>The <strong>projection matrix</strong> makes distant geometry smaller. It works in 4D
      <strong>homogeneous coordinates</strong> (Section 4.4): a camera-space point becomes
      \((x, y, z, 1)\), and the projection produces clip coordinates \((x_c, y_c, z_c, w_c)\) with \(w_c = -z\),
      the distance in front of the camera. Primitives are <strong>clipped</strong> against the visible region in this
      space, so nothing outside the viewport is ever rasterized. Dividing by \(w\) then gives normalized
      device coordinates:
      \[ (x_{\text{ndc}}, y_{\text{ndc}}, z_{\text{ndc}}) = \left(\frac{x_c}{w_c}, \frac{y_c}{w_c}, \frac{z_c}{w_c}\right). \]
      Dividing by the depth is exactly what makes far things small. The full projection matrix is derived in
      Section 5.5.</p>

      <h2>The viewport transform</h2>
      <p>Finally the cube \([-1,1]^3\) is stretched to fit the viewport rectangle (left \(x_0\), bottom \(y_0\), width
      \(w\), height \(h\)) and the depth range \([0,1]\):</p>
      <div class="formula">
        \[ x_w = x_0 + \frac{x_{\text{ndc}} + 1}{2}\,w \qquad
           y_w = y_0 + \frac{y_{\text{ndc}} + 1}{2}\,h \qquad
           z_w = \frac{z_{\text{ndc}} + 1}{2} \]
      </div>
      <p>The depth \(z_w\) is then scaled to the integer range of the depth buffer (for example 24 bits).
      After this step the vertex is in <strong>window space</strong>, ready for rasterization.</p>

      <div class="warn">OpenGL's window space has \(y\) pointing <em>up</em> from the bottom-left corner. Most
      image formats and 2D canvas APIs put \(y = 0\) at the <em>top</em>. Forgetting that flip is a classic source
      of upside-down screenshots and mouse picking that's off.</div>

      <h2>Other per-vertex work</h2>
      <p>Besides position, the vertex stage can compute <strong>per-vertex lighting</strong>: a color for each
      vertex that is interpolated across the triangle (Gouraud shading, Section 7.7). It also passes on
      <strong>texture coordinates</strong>, which are interpolated and used to look up texture colors per pixel.
      Interpolating correctly under perspective needs special care (Section 5.4).</p>

      <div class="game">In a vertex shader all of this is one line:
      <code>gl_Position = projection * view * model * vec4(position, 1.0);</code>. The engine computes the matrices
      once per object on the CPU and sends them as shader constants. The GPU's fixed-function hardware then does the
      clipping, the divide by \(w\) and the viewport transform.</div>

      <p><a class="btn goto-sim" href="#/1.2/sim">Try it: trace a vertex through every space →</a></p>
    `,

    keyFormulas: [
      ["Model-view-projection", String.raw`\mathbf P_{\text{clip}} = \mathbf M_{\text{proj}}\,\mathbf M_{\text{view}}\,\mathbf M_{\text{model}}\,\mathbf P_{\text{object}}`],
      ["Perspective divide", String.raw`\mathbf P_{\text{ndc}} = \left(x_c/w_c,\; y_c/w_c,\; z_c/w_c\right)`],
      ["Viewport transform", String.raw`x_w = x_0 + \tfrac{x_{\text{ndc}}+1}{2}w,\quad y_w = y_0 + \tfrac{y_{\text{ndc}}+1}{2}h,\quad z_w = \tfrac{z_{\text{ndc}}+1}{2}`],
    ],

    exercises: [
      { q: "A model must be rotated (R) and then moved to its spot in the world (T). Which product is the model matrix, TR or RT?",
        a: String.raw`\(\mathbf T\mathbf R\). The vertex is multiplied on the right, so R acts on it first and T second.` },
      { q: "A vertex has clip coordinates (2, −1, 3, 4). What are its NDC coordinates? Is it visible?",
        a: "(0.5, −0.25, 0.75). All three are inside [−1, 1], so it is inside the view volume." },
      { q: "In a 1920×1080 viewport at (0, 0), where does NDC (0.5, −0.25) land in OpenGL window space?",
        a: String.raw`\(x_w = 1.5/2 \cdot 1920 = 1440\), \(y_w = 0.75/2 \cdot 1080 = 405\) (measured from the bottom).` },
    ],

    sims: [
      {
        title: "Trace a vertex through the pipeline",
        help: String.raw`<p>Left: the world, with the model, its local axes and the camera's view frustum (drag to orbit).
          Right: the image the camera produces in window space. Move the model and camera, pick a vertex, and follow its
          coordinates through every space in the readout. When it leaves the frustum, a clip coordinate goes outside
          \([-w, w]\).</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const [left, right] = sim.split(stage, 2);
          const world = sim.view3d(left, { height: 360, distance: 13, yaw: 0.9, pitch: 0.5, target: [0, 0.5, 0] });
          sim.note(left, "World view (outside observer)");
          const screen = sim.canvas(right, { height: 360 });
          sim.note(right, "Window space (what the camera sees)");
          const out = sim.readout(readout);

          const redraw = () => { world.redraw(); screen.redraw(); };
          const gm = sim.group(controls, "Model transform");
          const yaw = sim.slider(gm, { label: "Rotate (y)", min: -180, max: 180, value: 30, unit: "°", onInput: redraw });
          const px = sim.slider(gm, { label: "Position x", min: -3, max: 3, step: 0.1, value: 0.5, onInput: redraw });
          const pz = sim.slider(gm, { label: "Position z", min: -3, max: 2, step: 0.1, value: 0, onInput: redraw });
          const gc = sim.group(controls, "Camera");
          const orbit = sim.slider(gc, { label: "Orbit", min: -90, max: 90, value: 20, unit: "°", onInput: redraw });
          const dist = sim.slider(gc, { label: "Distance", min: 3, max: 9, step: 0.1, value: 5.5, onInput: redraw });
          const fov = sim.slider(gc, { label: "Field of view", min: 20, max: 110, value: 60, unit: "°", onInput: redraw });
          const pick = sim.select(controls, {
            label: "Trace vertex",
            options: [["4", "apex (0, 1.4, 0)"], ["0", "base (−0.8, 0, −0.8)"], ["1", "base (0.8, 0, −0.8)"], ["2", "base (0.8, 0, 0.8)"], ["3", "base (−0.8, 0, 0.8)"]],
            value: "4",
            onChange: redraw,
          });

          const NEAR = 0.5, FAR = 12;
          function matrices(aspect) {
            const model = M.mul(M.translate([px.value, 0, pz.value]), M.affine(M.rotY(rad(yaw.value))));
            const a = rad(orbit.value);
            const eye = [Math.sin(a) * dist.value, 1.6, Math.cos(a) * dist.value];
            const view = M.lookAt(eye, [0, 0.5, 0], [0, 1, 0]);
            const proj = M.perspective(rad(fov.value), aspect, NEAR, FAR);
            return { model, view, proj, eye };
          }
          const aspectOf = () => Math.max(0.5, screen.w / screen.h);

          world.onDraw((v) => {
            const { model, view, eye } = matrices(aspectOf());
            v.grid({ size: 4, step: 1 });
            v.axes({ length: 1, labels: true });
            v.mesh(MODEL, { transform: model, faceColors: MODEL.colors, alpha: 0.95 });
            // model's local axes
            const o = M.transformPoint(model, [0, 0, 0]);
            [[1, 0, 0, "e"], [0, 1, 0, "c"], [0, 0, 1, "a"]].forEach(([x, y, z, c]) =>
              v.line(o, M.transformPoint(model, [x * 0.9, y * 0.9, z * 0.9]), { color: c, width: 2, dash: [4, 3] }));
            // camera frustum (near plane and a cut at depth 4)
            const camToWorld = M.inverse(view);
            const t = Math.tan(rad(fov.value) / 2), asp = aspectOf();
            const ring = (d) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => M.transformPoint(camToWorld, [sx * d * t * asp, sy * d * t, -d]));
            const nearR = ring(NEAR), farR = ring(4);
            v.polyline(nearR, { color: "g", closed: true, width: 1.5 });
            v.polyline(farR, { color: "g", closed: true, width: 1.5, dash: [5, 4] });
            for (let i = 0; i < 4; i++) v.line(eye, farR[i], { color: "g", width: 1, alpha: 0.7 });
            v.point(eye, { color: "g", r: 6, label: "camera" });
            const p = M.transformPoint(model, MODEL.vertices[+pick.value]);
            v.point(p, { color: "e", r: 6, overlay: true });
          });

          screen.onDraw((c) => {
            const ctx = c.ctx, W = c.w, H = c.h;
            const { model, view, proj } = matrices(W / H);
            const mvp = M.mul(proj, M.mul(view, model));
            ctx.fillStyle = sim.color("bg"); ctx.fillRect(0, 0, W, H);
            // project each vertex through MVP, divide by w, apply the viewport transform
            const win = MODEL.vertices.map((p) => {
              const clip = M.mulVec(mvp, [...p, 1]);
              const ndc = [clip[0] / clip[3], clip[1] / clip[3], clip[2] / clip[3]];
              return { clip, ndc, x: ((ndc[0] + 1) / 2) * W, y: H - ((ndc[1] + 1) / 2) * H, z: (ndc[2] + 1) / 2 };
            });
            const faces = MODEL.faces.map((f, i) => ({ f, i, depth: f.reduce((s, k) => s + win[k].clip[3], 0) / f.length }))
              .filter(({ f }) => f.every((k) => win[k].clip[3] > NEAR * 0.5))
              .sort((a, b) => b.depth - a.depth);
            for (const { f, i } of faces) {
              ctx.beginPath();
              f.forEach((k, j) => (j ? ctx.lineTo(win[k].x, win[k].y) : ctx.moveTo(win[k].x, win[k].y)));
              ctx.closePath();
              ctx.fillStyle = L3D.color.withAlpha(sim.color(MODEL.colors[i]), 0.85);
              ctx.fill();
              ctx.strokeStyle = sim.color("fg"); ctx.lineWidth = 1; ctx.stroke();
            }
            const s = win[+pick.value];
            if (s.clip[3] > 0) {
              ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fillStyle = sim.color("e"); ctx.fill();
            }
            c.label(8, 16, `viewport ${Math.round(W)} × ${Math.round(H)} px`, { color: "muted", size: 11 });

            // readout: every stage for the traced vertex
            const P = MODEL.vertices[+pick.value];
            const pw = M.transformPoint(model, P);
            const pc = M.transformPoint(view, pw);
            const inside = s.clip.slice(0, 3).every((x) => Math.abs(x) <= s.clip[3]) && s.clip[3] > 0;
            out.set(
              `<b>Object</b><div class="eq">${fmtVec(P)}</div>` +
              `<b>World</b> = M<sub>model</sub> · p<div class="eq">${fmtVec(pw)}</div>` +
              `<b>Camera</b> = M<sub>view</sub> · p<div class="eq">${fmtVec(pc)}</div>` +
              `<b>Clip</b> = M<sub>proj</sub> · p (x, y, z, w)<div class="eq">${fmtVec(s.clip)}</div>` +
              `<b>NDC</b> = clip.xyz / w<div class="eq">${fmtVec(s.ndc, 3)}</div>` +
              `<b>Window</b> (x, y from bottom, depth)<div class="eq">(${fmt(s.x, 0)}, ${fmt(H - s.y, 0)}, ${fmt(s.z, 3)})</div>` +
              `<span class="${inside ? "ok" : "bad"}">${inside ? "Inside the view volume" : "Outside: would be clipped"}</span>`
            );
          });
        },
      },
      {
        title: "Perspective divide and viewport mapping",
        help: String.raw`<p>Left: a side view of camera space (camera at the origin looking down \(-z\)). Drag the point.
          Its clip-space \(w\) equals its distance \(-z\), and dividing by \(w\) gives the NDC height \(y_{\text{ndc}}\),
          which is the same for every point on a ray through the camera. Right: the viewport transform maps
          \([-1, 1]\) to pixels.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const [left, right] = sim.split(stage, 2);
          const side = sim.view2d(left, { center: [-4, 0], range: 3.6, height: 340 });
          const vp = sim.canvas(right, { height: 340 });
          const out = sim.readout(readout);
          const p = side.handle([-5, 1.2], { color: "e", label: "P", constrain: (q) => [Math.min(-0.6, q[0]), q[1]] });
          const fov = sim.slider(controls, { label: "Vertical field of view", min: 30, max: 120, value: 60, unit: "°", onInput: () => { side.redraw(); vp.redraw(); } });
          const H = sim.slider(controls, { label: "Viewport height h", min: 100, max: 1080, step: 10, value: 600, unit: " px", onInput: () => vp.redraw() });
          p.onDrag = () => vp.redraw();

          const ndcY = () => {
            const e = 1 / Math.tan(rad(fov.value) / 2);   // focal length
            const yc = e * p.pos[1], w = -p.pos[0];         // clip y and w for this point
            return { e, yc, w, y: yc / w };
          };

          side.onDraw((v) => {
            v.grid({ step: 1 });
            v.axes({ labels: ["z", "y"] });
            const half = rad(fov.value) / 2, L = 12;
            v.polygon([[0, 0], [-L, Math.tan(half) * L], [-L, -Math.tan(half) * L]], { fill: "g", fillAlpha: 0.08, color: "g", width: 1 });
            v.line([0, 0], V.scale(V.norm(p.pos), 14), { color: "e", dash: [5, 5], width: 1.5 });
            const { y, w } = ndcY();
            // the point projected onto the plane at distance e (where the image is formed)
            const e = 1 / Math.tan(half);
            v.line([-e, -Math.tan(half) * e], [-e, Math.tan(half) * e], { color: "a", width: 3 });
            v.point([-e, y], { color: "a", r: 5, label: "y_ndc" });
            v.text([-e, -Math.tan(half) * e - 0.35], "projection plane (z = −e)", { color: "a", size: 11, align: "center" });
            v.text(p.pos, `w = ${fmt(w)}`, { offset: [10, 18], color: "muted", size: 12 });
            v.point([0, 0], { color: "fg", r: 5, label: "camera" });
          });

          vp.onDraw((c) => {
            const ctx = c.ctx;
            const { y } = ndcY();
            const top = 24, bottom = c.h - 24, x = c.w / 2;
            const Y = (ndc) => bottom - ((ndc + 1) / 2) * (bottom - top);
            ctx.strokeStyle = sim.color("muted"); ctx.lineWidth = 1;
            ctx.strokeRect(x - 70, top, 140, bottom - top);
            for (const t of [-1, 0, 1]) c.label(x - 80, Y(t) + 4, String(t), { color: "muted", align: "right", size: 11 });
            for (const t of [0, 0.5, 1]) c.label(x + 80, Y(t * 2 - 1) + 4, Math.round(t * H.value) + " px", { color: "muted", size: 11 });
            c.label(x - 80, top - 8, "y_ndc", { color: "a", align: "right", size: 12, weight: 700 });
            c.label(x + 80, top - 8, "y_window", { color: "c", size: 12, weight: 700 });
            const yy = Y(clamp(y, -1.2, 1.2));
            ctx.fillStyle = Math.abs(y) <= 1 ? sim.color("a") : sim.color("e");
            ctx.beginPath(); ctx.arc(x, yy, 7, 0, Math.PI * 2); ctx.fill();
          });

          const update = () => {
            const { e, yc, w, y } = ndcY();
            out.set(sim.rows([
              ["camera-space P", fmtVec(p.pos)],
              ["focal length e = 1/tan(fov/2)", fmt(e, 3)],
              ["clip y_c = e · y", fmt(yc, 3)],
              ["clip w_c = −z", fmt(w, 3)],
              ["y_ndc = y_c / w_c", `<b>${fmt(y, 3)}</b>`],
              ["y_window = (y_ndc+1)/2 · h", fmt(((y + 1) / 2) * H.value, 1) + " px"],
            ]) + `<hr>${Math.abs(y) <= 1 ? "Inside the view: |y_ndc| ≤ 1." : "<span class='bad'>Outside the view: |y_ndc| > 1, so it gets clipped.</span>"}`);
          };
          sim.loop(update);
        },
      },
    ],

    cpp: [
      {
        title: "Model-view-projection",
        formula: String.raw`\mathbf P_{\text{clip}} = \mathbf M_{\text{proj}}\,\mathbf M_{\text{view}}\,\mathbf M_{\text{model}}\,\mathbf P_{\text{object}}`,
        note: "<p>Concatenate the matrices once per object, then reuse the product for every vertex.</p>",
        code: String.raw`
          Matrix4D MakeModelViewProjection(const Matrix4D& projection, const Matrix4D& view, const Matrix4D& model)
          {
              Matrix4D modelView = view * model;        // object -> camera
              return projection * modelView;            // object -> clip
          }

          Vector4D ToClipSpace(const Matrix4D& mvp, const Point3D& p)
          {
              return mvp * Vector4D(p.x, p.y, p.z, 1.0f);        // w = 1: it's a point
          }
        `,
      },
      {
        title: "Perspective divide",
        formula: String.raw`\mathbf P_{\text{ndc}} = \left(\frac{x_c}{w_c}, \frac{y_c}{w_c}, \frac{z_c}{w_c}\right)`,
        code: String.raw`
          Vector3D ToNDC(const Vector4D& clip)
          {
              float invW = 1.0f / clip.w;          // w_c is the distance in front of the camera
              return Vector3D(clip.x * invW, clip.y * invW, clip.z * invW);
          }

          // A point is inside the view volume when -w <= x, y, z <= w (checked before dividing).
          bool InsideClipVolume(const Vector4D& c)
          {
              return std::fabs(c.x) <= c.w && std::fabs(c.y) <= c.w && std::fabs(c.z) <= c.w;
          }
        `,
      },
      {
        title: "Viewport transform",
        formula: String.raw`x_w = x_0 + \frac{x_{\text{ndc}} + 1}{2}w \qquad y_w = y_0 + \frac{y_{\text{ndc}} + 1}{2}h \qquad z_w = \frac{z_{\text{ndc}} + 1}{2}`,
        code: String.raw`
          struct Viewport { float x0, y0, width, height; };

          Vector3D ToWindow(const Vector3D& ndc, const Viewport& vp)
          {
              return Vector3D(vp.x0 + (ndc.x + 1.0f) * 0.5f * vp.width,
                              vp.y0 + (ndc.y + 1.0f) * 0.5f * vp.height,   // y up (OpenGL)
                              (ndc.z + 1.0f) * 0.5f);                      // depth in [0, 1]
          }

          // Image/canvas rows grow downward, so flip y when writing pixels:
          int PixelRow(float yWindow, float height) { return int(height - yWindow); }
        `,
      },
      {
        title: "The whole vertex path",
        code: String.raw`
          Vector3D ObjectToWindow(const Point3D& p, const Matrix4D& model, const Matrix4D& view,
                                  const Matrix4D& projection, const Viewport& vp)
          {
              Vector4D clip = projection * (view * (model * Vector4D(p.x, p.y, p.z, 1.0f)));
              Vector3D ndc  = ToNDC(clip);
              return ToWindow(ndc, vp);
          }
        `,
      },
    ],
  });

  // ===========================================================================
  // 1.3 Rasterization and Fragment Operations
  // ===========================================================================

  // Edge function: twice the signed area of triangle (a, b, p). Positive when p is to the left of a->b.
  const edge = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

  // Pixel centers covered by triangle t (both windings accepted). Returns {coverage, area}.
  function coverage(t, cols, rows) {
    const area = edge(t[0], t[1], t[2]);
    const out = [];
    if (Math.abs(area) < 1e-9) return { coverage: out, area };
    const xs = t.map((p) => p[0]), ys = t.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(cols - 1, Math.ceil(Math.max(...xs)));
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(rows - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const p = [x + 0.5, y + 0.5];
        const w0 = edge(t[1], t[2], p) / area, w1 = edge(t[2], t[0], p) / area, w2 = edge(t[0], t[1], p) / area;
        if (w0 >= 0 && w1 >= 0 && w2 >= 0) out.push({ x, y, b: [w0, w1, w2] });
      }
    }
    return { coverage: out, area };
  }

  L3D.topic({
    id: "1.3",
    summary: "Rasterization turns each triangle into fragments. Face culling, fragment shading, and the scissor, alpha, stencil, and depth tests decide which ones reach the image.",

    lesson: String.raw`
      <p>Once vertices are clipped and in window space, the GPU works out which pixels each primitive covers.
      Filling in the covered pixels is called <strong>rasterization</strong>. For each covered pixel the GPU
      interpolates the vertex data (depth, colors, texture coordinates) to that location. The pixel position plus
      this interpolated data is called a <strong>fragment</strong>. A fragment is a <em>candidate</em> pixel, and
      it may still be thrown away.</p>

      <h2>Coverage: is the pixel inside the triangle?</h2>
      <p>A standard way to test coverage is with <strong>edge functions</strong>. For an edge from \(\mathbf a\)
      to \(\mathbf b\), the 2D cross product
      \[ E_{ab}(\mathbf p) = (b_x - a_x)(p_y - a_y) - (b_y - a_y)(p_x - a_x) \]
      is positive when \(\mathbf p\) is to the left of the edge (Section 2.3). A pixel center lies inside a
      counterclockwise triangle when all three edge functions are non-negative. Divided by the triangle's (doubled)
      area, the three values are the <strong>barycentric coordinates</strong> \((w_0, w_1, w_2)\) that weight each
      vertex's attributes during interpolation, for example \(z = w_0 z_0 + w_1 z_1 + w_2 z_2\).</p>

      <h2>Face culling</h2>
      <p>Before rasterizing, an application can enable <strong>face culling</strong>. The sign of the triangle's
      window-space area tells whether its vertices appear counterclockwise or clockwise, which means front-facing
      or back-facing. Back faces of a closed model are on its hidden far side, so skipping them roughly halves the
      work for free.</p>

      <h2>Fragment shading</h2>
      <p><strong>Fragment shading</strong> (pixel shading) computes each fragment's final color. It might be an
      interpolated vertex color times a texture sample, or a full per-pixel lighting calculation (Chapter 7).
      The final depth is normally the interpolated depth, although a shader may replace it.</p>

      <h2>Fragment operations</h2>
      <p>A shaded fragment must still pass a series of tests before it can change the image buffer. Logically they
      happen in this order:</p>
      <ol>
        <li><strong>Pixel ownership test</strong>: is this pixel actually visible on screen (not covered by
          another window)? This is the only test that can't be turned off.</li>
        <li><strong>Scissor test</strong>: is the fragment inside the application's scissor rectangle? Used to
          limit rendering to a region (Section 10.3.7).</li>
        <li><strong>Alpha test</strong>: compare the fragment's alpha with a reference value (e.g. discard if
          \(\alpha &lt; 0.5\)). Good for cut-out foliage and fences.</li>
        <li><strong>Stencil test</strong>: compare the stencil buffer value at this pixel with a reference. The
          application also chooses what happens to the stencil value when the stencil test fails, when it passes
          but the depth test fails, and when both pass. Stencil shadows (Chapter 10) depend on this.</li>
        <li><strong>Depth test</strong>: compare the fragment's depth with the depth buffer. Normally it passes
          if the fragment is <em>nearer</em> (less than or equal), and then the depth buffer is updated. This is
          hidden-surface removal.</li>
        <li><strong>Blending</strong>: combine the fragment's color with the color already in the image buffer,
          for example \(\mathbf C = \alpha\,\mathbf C_{\text{src}} + (1-\alpha)\,\mathbf C_{\text{dst}}\) for
          transparency, or simply replace it.</li>
      </ol>

      <div class="note">GPUs actually run as many of these tests as they can <em>before</em> the fragment shader
      ("early-z") so they don't spend time shading fragments that will be discarded anyway. A shader that
      modifies depth or discards pixels can disable that optimization.</div>

      <div class="game">Because the depth test lets the nearest fragment win no matter what order things are drawn
      in, opaque objects can be submitted in any order. Engines still sort opaque geometry front-to-back, so later
      fragments fail early-z, and sort transparent geometry back-to-front, because blending <em>does</em> depend
      on order.</div>

      <p><a class="btn goto-sim" href="#/1.3/sim">Try it: rasterize triangles and run the fragment tests →</a></p>
    `,

    keyFormulas: [
      ["Edge function", String.raw`E_{ab}(\mathbf p) = (b_x - a_x)(p_y - a_y) - (b_y - a_y)(p_x - a_x)`],
      ["Barycentric interpolation", String.raw`z = w_0 z_0 + w_1 z_1 + w_2 z_2,\qquad w_i = E_i / E_{\text{total}}`],
      ["Depth test (less-or-equal)", String.raw`\text{pass} \iff z_{\text{frag}} \le z_{\text{buffer}}`],
      ["Alpha blending", String.raw`\mathbf C = \alpha\,\mathbf C_{\text{src}} + (1-\alpha)\,\mathbf C_{\text{dst}}`],
    ],

    exercises: [
      { q: "A triangle's three edge functions at a pixel center are 4, 0 and 6 (total 10). Is the pixel covered, and what are its barycentric coordinates?",
        a: "It's on an edge (one value is 0) but still counts as covered by a ≥ 0 rule. The barycentrics are (0.4, 0, 0.6)." },
      { q: "Two opaque triangles overlap. Without a depth test, which one appears in the overlap?",
        a: "Whichever is drawn last. With a depth test, the nearer one appears regardless of order." },
      { q: "Why must transparent objects be drawn after opaque ones and sorted back-to-front?",
        a: "Blending mixes with what's already in the image buffer, so everything behind a transparent surface must already be drawn when it's blended." },
      { q: "Which test would you use to stop a reflection from drawing outside the mirror's frame?",
        a: "The stencil test, with the mirror's pixels marked in the stencil buffer. (The scissor test also works if the mirror is a screen-aligned rectangle.)" },
    ],

    sims: [
      {
        title: "Rasterizer: triangles to fragments",
        help: String.raw`<p>The grid is a tiny 24 × 16 pixel viewport. Drag the vertices of the two triangles. Each pixel
          whose <em>center</em> is inside a triangle becomes a fragment. Switch views to see the fragments, the final
          image, and the depth buffer. Drag a vertex across the opposite edge to flip the winding and watch culling remove
          the triangle.</p>`,
        mount(sim) {
          const COLS = 24, ROWS = 16;
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { center: [COLS / 2, ROWS / 2], range: ROWS / 2 + 0.6, height: 430 });
          const out = sim.readout(readout);
          const tris = [
            { name: "A", color: "a", depth: 0.35, h: [[3, 2], [15, 4], [6, 14]].map((p) => view.handle(p, { color: "a", r: 6 })) },
            { name: "B", color: "b", depth: 0.6, h: [[9, 3], [21, 6], [14, 14]].map((p) => view.handle(p, { color: "b", r: 6 })) },
          ];
          const show = sim.segmented(controls, { label: "View", options: [["frags", "Fragments"], ["color", "Image"], ["depth", "Depth buffer"]], value: "color", onChange: () => view.redraw() });
          sim.slider(controls, { label: "Depth of A", min: 0, max: 1, step: 0.05, value: 0.35, onInput: (x) => { tris[0].depth = x; view.redraw(); } });
          sim.slider(controls, { label: "Depth of B", min: 0, max: 1, step: 0.05, value: 0.6, onInput: (x) => { tris[1].depth = x; view.redraw(); } });
          const order = sim.select(controls, { label: "Draw order", options: [["AB", "A, then B"], ["BA", "B, then A"]], value: "AB", onChange: () => view.redraw() });
          const depthTest = sim.checkbox(controls, { label: "Depth test", value: true, onChange: () => view.redraw() });
          const cull = sim.checkbox(controls, { label: "Back-face culling", value: false, onChange: () => view.redraw() });

          view.onDraw((v) => {
            const color = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
            const depth = Array.from({ length: ROWS }, () => Array(COLS).fill(1));
            const stats = [];
            const seq = order.value === "AB" ? tris : [tris[1], tris[0]];
            const covers = {};
            for (const t of seq) {
              const pts = t.h.map((h) => h.pos);
              const { coverage: frags, area } = coverage(pts, COLS, ROWS);
              const back = area < 0; // clockwise in window space (y up)
              const culled = cull.value && back;
              let written = 0, rejected = 0;
              if (!culled) {
                for (const f of frags) {
                  if (depthTest.value && t.depth > depth[f.y][f.x]) { rejected++; continue; }
                  depth[f.y][f.x] = t.depth;
                  color[f.y][f.x] = t.color;
                  written++;
                }
              }
              covers[t.name] = culled ? [] : frags;
              stats.push([t, frags.length, written, rejected, back, culled]);
            }

            // pixels
            for (let y = 0; y < ROWS; y++) {
              for (let x = 0; x < COLS; x++) {
                let fill = null, alpha = 1;
                if (show.value === "color" && color[y][x]) fill = color[y][x];
                if (show.value === "depth") { const g = Math.round(255 * depth[y][x]); fill = `rgb(${g},${g},${g})`; }
                if (fill) v.rect([x + 0.04, y + 0.04], [x + 0.96, y + 0.96], { fill, fillAlpha: alpha, stroke: false });
              }
            }
            v.grid({ step: 1 });
            v.rect([0, 0], [COLS, ROWS], { color: "muted", width: 1.5 });
            if (show.value === "frags") {
              for (const t of tris) for (const f of covers[t.name]) v.point([f.x + 0.5 + (t.name === "A" ? -0.15 : 0.15), f.y + 0.5], { color: t.color, r: 3.5 });
            }
            for (const [t, , , , , culled] of stats) {
              const pts = t.h.map((h) => h.pos);
              v.polygon(pts, { color: t.color, width: 2, dash: culled ? [5, 5] : [], stroke: true });
              const c = V.scale(V.add(V.add(pts[0], pts[1]), pts[2]), 1 / 3);
              v.text(c, t.name + (culled ? " (culled)" : ""), { color: t.color, align: "center", size: 14, weight: 800, offset: [0, 5] });
            }
            out.set(stats.map(([t, n, w, r, back, culled]) =>
              `<b style="color:${sim.color(t.color)}">Triangle ${t.name}</b>` + sim.rows([
                ["winding", back ? "clockwise (back face)" : "counterclockwise (front)"],
                ["fragments generated", culled ? "0 (culled)" : String(n)],
                ["written to image", String(w)],
                ["failed depth test", String(r)],
              ])).join("<hr>") + `<hr>${depthTest.value ? "With the depth test, the nearer triangle (smaller depth) wins wherever they overlap, whatever the draw order." : "Without the depth test, the triangle drawn last wins the overlap."}`);
          });
        },
      },
      {
        title: "Fragment tests and blending",
        help: String.raw`<p>Triangle A (blue, opaque) is drawn first, then triangle B (orange) whose alpha fades from 0 on the
          left to 1 on the right. The stencil buffer holds 1 inside the dashed circle. Turn tests on and off, drag the scissor
          rectangle's corners, and <b>click any pixel</b> to see what happened to B's fragment there.</p>`,
        mount(sim) {
          const COLS = 32, ROWS = 20;
          const { stage, controls, readout } = sim.layout();
          const view = sim.view2d(stage, { center: [COLS / 2, ROWS / 2], range: ROWS / 2 + 0.6, height: 420 });
          const out = sim.readout(readout);
          const s0 = view.handle([5, 3], { color: "g", label: "scissor" });
          const s1 = view.handle([27, 17], { color: "g" });
          const triA = [[2, 3], [20, 2], [10, 18]];
          const triB = [[8, 4], [30, 8], [16, 18]];
          const stencilC = [17, 10], stencilR = 6;
          const scissor = sim.checkbox(controls, { label: "Scissor test", value: false, onChange: () => view.redraw() });
          const alphaT = sim.checkbox(controls, { label: "Alpha test (pass if α ≥ ref)", value: false, onChange: () => view.redraw() });
          const ref = sim.slider(controls, { label: "Alpha reference", min: 0, max: 1, step: 0.05, value: 0.5, onInput: () => view.redraw() });
          const stencil = sim.checkbox(controls, { label: "Stencil test (pass if stencil = 1)", value: false, onChange: () => view.redraw() });
          const depthT = sim.checkbox(controls, { label: "Depth test (pass if nearer)", value: true, onChange: () => view.redraw() });
          const depthB = sim.slider(controls, { label: "Depth of B (A is 0.5)", min: 0, max: 1, step: 0.05, value: 0.3, onInput: () => view.redraw() });
          const blend = sim.checkbox(controls, { label: "Alpha blending", value: true, onChange: () => view.redraw() });
          let picked = [18, 9];
          view.onClick((p) => { picked = [Math.floor(p[0]), Math.floor(p[1])]; view.redraw(); });

          const rgb = (k) => L3D.color.parse(sim.color(k));
          view.onDraw((v) => {
            const bg = rgb("panel"), cA = rgb("a"), cB = rgb("b");
            const image = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => bg.slice()));
            const depth = Array.from({ length: ROWS }, () => Array(COLS).fill(1));
            for (const f of coverage(triA, COLS, ROWS).coverage) { image[f.y][f.x] = cA.slice(); depth[f.y][f.x] = 0.5; }
            const lo = [Math.min(s0.pos[0], s1.pos[0]), Math.min(s0.pos[1], s1.pos[1])];
            const hi = [Math.max(s0.pos[0], s1.pos[0]), Math.max(s0.pos[1], s1.pos[1])];
            const trace = {};
            for (const f of coverage(triB, COLS, ROWS).coverage) {
              const px = f.x + 0.5, py = f.y + 0.5;
              const alpha = clamp((px - 8) / 22, 0, 1);
              const steps = [];
              const test = (name, enabled, pass, detail) => { steps.push([name, enabled ? (pass ? "pass" : "FAIL") : "off", detail]); return !enabled || pass; };
              let ok = test("Pixel ownership", true, true, "pixel is on screen");
              ok = ok && test("Scissor", scissor.value, px >= lo[0] && px <= hi[0] && py >= lo[1] && py <= hi[1], "inside rectangle?");
              ok = ok && test("Alpha", alphaT.value, alpha >= ref.value, `α = ${fmt(alpha)} vs ref ${fmt(ref.value)}`);
              ok = ok && test("Stencil", stencil.value, V.dist([px, py], stencilC) <= stencilR, "stencil value = 1?");
              ok = ok && test("Depth", depthT.value, depthB.value <= depth[f.y][f.x], `${fmt(depthB.value)} ≤ ${fmt(depth[f.y][f.x])}?`);
              if (ok) {
                const dst = image[f.y][f.x];
                image[f.y][f.x] = blend.value ? cB.map((c, i) => alpha * c + (1 - alpha) * dst[i]) : cB.slice();
                if (depthT.value) depth[f.y][f.x] = depthB.value;
                steps.push(["Blend", blend.value ? "on" : "replace", blend.value ? `${fmt(alpha)}·src + ${fmt(1 - alpha)}·dst` : "src overwrites dst"]);
              }
              trace[f.y * COLS + f.x] = { steps, ok, alpha };
            }
            for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
              const c = image[y][x];
              v.rect([x + 0.03, y + 0.03], [x + 0.97, y + 0.97], { fill: `rgb(${c.map(Math.round).join(",")})`, fillAlpha: 1, stroke: false });
            }
            v.circle(stencilC, stencilR, { color: "d", dash: [6, 4], width: 2 });
            v.text([stencilC[0], stencilC[1] + stencilR + 0.4], "stencil = 1", { color: "d", align: "center", size: 11 });
            if (scissor.value) v.rect(lo, hi, { color: "g", width: 2 });
            else v.rect(lo, hi, { color: "g", width: 1, dash: [3, 4], alpha: 0.5 });
            v.polygon(triB, { color: "b", width: 1, alpha: 0.6 });
            v.rect(picked, [picked[0] + 1, picked[1] + 1], { color: "fg", width: 2.5 });

            const tr = trace[picked[1] * COLS + picked[0]];
            out.set(`<b>Pixel (${picked[0]}, ${picked[1]})</b><br>` + (tr
              ? sim.rows(tr.steps.map(([n, r, d]) => [n, `${r} <span class="muted">${d}</span>`, r === "FAIL" ? "bad" : r === "pass" ? "ok" : ""])) +
                `<hr>${tr.ok ? "B's fragment reached the image buffer." : "B's fragment was <b>discarded</b>."}`
              : "Triangle B doesn't cover this pixel, so no fragment was generated."));
          });
        },
      },
      {
        title: "Face culling and depth on a cube",
        help: String.raw`<p>Faces are drawn in a fixed order (0–5). With <b>culling off and depth sorting off</b>, back faces
          painted later cover front faces. That's the mess the depth buffer prevents. Turn culling on and only the
          front faces (counterclockwise on screen) are rasterized at all.</p>`,
        mount(sim) {
          const { stage, controls, readout } = sim.layout();
          const cv = sim.canvas(stage, { height: 400 });
          const out = sim.readout(readout);
          const cullB = sim.checkbox(controls, { label: "Back-face culling", value: true });
          const depthB = sim.checkbox(controls, { label: "Depth (draw nearest last)", value: true });
          const wire = sim.checkbox(controls, { label: "Outline culled faces", value: true });
          const spin = sim.checkbox(controls, { label: "Spin", value: true });
          const yawS = sim.slider(controls, { label: "Yaw", min: 0, max: 360, value: 30, unit: "°" });
          const pitchS = sim.slider(controls, { label: "Pitch", min: -80, max: 80, value: 25, unit: "°" });
          const cube = L3D.shapes.box([-1, -1, -1], [1, 1, 1]);
          const faceCols = ["e", "c", "a", "g", "d", "f"];

          sim.loop((dt) => {
            if (spin.value) yawS.value = (yawS.value + dt * 25) % 360;
            cv.redraw();
          });

          cv.onDraw((c) => {
            const ctx = c.ctx;
            const R = M.mul(M.rotX(rad(pitchS.value)), M.rotY(rad(yawS.value)));
            const f = Math.min(c.w, c.h) * 1.15;
            const proj = cube.vertices.map((p) => {
              const q = M.mulVec(R, p);
              const z = q[2] - 4.5; // camera at the origin looking down -z
              return { x: c.w / 2 + (q[0] * f) / -z, y: c.h / 2 - (q[1] * f) / -z, depth: -z };
            });
            let faces = cube.faces.map((idx, i) => {
              const s = idx.map((k) => proj[k]);
              // signed area in window space (flip y back to "up") > 0 means counterclockwise = front facing
              let area = 0;
              for (let j = 0; j < s.length; j++) {
                const a = s[j], b = s[(j + 1) % s.length];
                area += a.x * -b.y - b.x * -a.y;
              }
              return { i, s, front: area > 0, depth: s.reduce((t, p) => t + p.depth, 0) / s.length };
            });
            const culled = faces.filter((x) => !x.front);
            if (cullB.value) faces = faces.filter((x) => x.front);
            if (depthB.value) faces = [...faces].sort((a, b) => b.depth - a.depth);
            for (const fc of faces) {
              ctx.beginPath();
              fc.s.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
              ctx.closePath();
              ctx.fillStyle = L3D.color.withAlpha(sim.color(faceCols[fc.i]), 0.92);
              ctx.fill();
              ctx.strokeStyle = sim.color("bg"); ctx.lineWidth = 2; ctx.stroke();
              const cx = fc.s.reduce((t, p) => t + p.x, 0) / 4, cy = fc.s.reduce((t, p) => t + p.y, 0) / 4;
              c.label(cx, cy + 5, String(fc.i), { color: "#fff", align: "center", weight: 800, size: 15 });
            }
            if (cullB.value && wire.value) {
              for (const fc of culled) {
                ctx.beginPath();
                fc.s.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
                ctx.closePath();
                ctx.setLineDash([4, 4]); ctx.strokeStyle = sim.color("muted"); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
              }
            }
            out.set(sim.rows([
              ["front-facing faces", String(6 - culled.length)],
              ["back-facing faces", String(culled.length)],
              ["faces rasterized", String(faces.length)],
            ]) + `<hr>${!cullB.value && !depthB.value ? "<span class='bad'>Back faces drawn after front faces cover them up.</span> The depth buffer exists to prevent this." : cullB.value ? "Culling removed the far side, so it was never rasterized." : "Sorting by depth fixes the picture, but all 6 faces still cost rasterization time."}`);
          });
        },
      },
    ],

    cpp: [
      {
        title: "Edge function and barycentric coordinates",
        formula: String.raw`E_{ab}(\mathbf p) = (b_x - a_x)(p_y - a_y) - (b_y - a_y)(p_x - a_x) \qquad w_0 = \frac{E_{12}(\mathbf p)}{E_{01}(\mathbf v_2)}`,
        code: String.raw`
          float EdgeFunction(const Vector2D& a, const Vector2D& b, const Vector2D& p)
          {
              return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);   // 2D cross product
          }

          // Returns false if p is outside the (counterclockwise) triangle v0 v1 v2.
          bool Barycentric(const Vector2D& v0, const Vector2D& v1, const Vector2D& v2,
                           const Vector2D& p, float& w0, float& w1, float& w2)
          {
              float area = EdgeFunction(v0, v1, v2);       // twice the signed area
              w0 = EdgeFunction(v1, v2, p) / area;
              w1 = EdgeFunction(v2, v0, p) / area;
              w2 = EdgeFunction(v0, v1, p) / area;
              return w0 >= 0.0f && w1 >= 0.0f && w2 >= 0.0f;
          }
        `,
      },
      {
        title: "Rasterizing a triangle with a depth test",
        formula: String.raw`z = w_0 z_0 + w_1 z_1 + w_2 z_2,\qquad \text{write if } z \le z_{\text{buffer}}`,
        code: String.raw`
          struct Framebuffer
          {
              int width, height;
              std::vector<uint32_t> color;
              std::vector<float>    depth;     // cleared to 1.0f (far) every frame
          };

          void RasterizeTriangle(Framebuffer& fb, const Vector3D v[3], uint32_t rgba)
          {
              // bounding box of the triangle, clamped to the screen
              int x0 = std::max(0, int(std::floor(std::min({v[0].x, v[1].x, v[2].x}))));
              int x1 = std::min(fb.width - 1, int(std::ceil(std::max({v[0].x, v[1].x, v[2].x}))));
              int y0 = std::max(0, int(std::floor(std::min({v[0].y, v[1].y, v[2].y}))));
              int y1 = std::min(fb.height - 1, int(std::ceil(std::max({v[0].y, v[1].y, v[2].y}))));

              Vector2D a(v[0].x, v[0].y), b(v[1].x, v[1].y), c(v[2].x, v[2].y);
              if (EdgeFunction(a, b, c) <= 0.0f) return;             // back face (or degenerate): culled

              for (int y = y0; y <= y1; ++y)
                  for (int x = x0; x <= x1; ++x)
                  {
                      float w0, w1, w2;
                      Vector2D p(x + 0.5f, y + 0.5f);                 // sample at the pixel center
                      if (!Barycentric(a, b, c, p, w0, w1, w2)) continue;

                      float z = w0 * v[0].z + w1 * v[1].z + w2 * v[2].z;
                      float& stored = fb.depth[y * fb.width + x];
                      if (z <= stored)                                // depth test
                      {
                          stored = z;                                 // depth write
                          fb.color[y * fb.width + x] = rgba;          // color write
                      }
                  }
          }
        `,
      },
      {
        title: "Back-face test",
        formula: String.raw`\text{front facing} \iff E_{01}(\mathbf v_2) = (v_1 - v_0)\times(v_2 - v_0) > 0`,
        code: String.raw`
          // Window-space vertices, y up, counterclockwise = front (OpenGL's default).
          bool IsFrontFacing(const Vector2D& v0, const Vector2D& v1, const Vector2D& v2)
          {
              return EdgeFunction(v0, v1, v2) > 0.0f;
          }
        `,
      },
      {
        title: "The fragment operations in order",
        formula: String.raw`\mathbf C = \alpha\,\mathbf C_{\text{src}} + (1-\alpha)\,\mathbf C_{\text{dst}}`,
        code: String.raw`
          struct ColorRGBA { float r, g, b, a; };

          struct FragmentState
          {
              bool  scissorEnable = false;  int sx0, sy0, sx1, sy1;
              bool  alphaTest     = false;  float alphaRef = 0.5f;
              bool  stencilTest   = false;  uint8_t stencilRef = 1;
              bool  depthTest     = true;
              bool  blend         = false;
          };

          // Returns true if the fragment was written.
          bool ProcessFragment(int x, int y, float z, const ColorRGBA& src, const FragmentState& s,
                               ColorRGBA& dst, float& depth, uint8_t stencil)
          {
              if (s.scissorEnable && (x < s.sx0 || x > s.sx1 || y < s.sy0 || y > s.sy1)) return false;
              if (s.alphaTest && src.a < s.alphaRef) return false;
              if (s.stencilTest && stencil != s.stencilRef) return false;
              if (s.depthTest)
              {
                  if (z > depth) return false;     // farther than what is already there
                  depth = z;
              }
              if (s.blend)
              {
                  float a = src.a;
                  dst = {a * src.r + (1 - a) * dst.r, a * src.g + (1 - a) * dst.g,
                         a * src.b + (1 - a) * dst.b, a + (1 - a) * dst.a};
              }
              else dst = src;
              return true;
          }
        `,
      },
    ],
  });
})();
