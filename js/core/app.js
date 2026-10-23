// L3D app - routing, sidebar, and the Learn / Simulate / C++ / C# tabs of each topic page.
//
// Routes (hash based, so the site works when index.html is opened straight from disk):
//   #/                  home
//   #/2.2               topic 2.2, Learn tab
//   #/2.2/sim           topic 2.2, Simulate tab   (#/2.2/sim/1 = second simulation)
//   #/2.2/cpp           topic 2.2, C++ Code tab
//   #/2.2/csharp        topic 2.2, C# Code tab
//   #/4.6/learn/4.6.2   topic 4.6, scrolled to subsection 4.6.2
//   #/cpp-types         the C++ types used by the code examples
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem("l3d." + key);
        return v === null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem("l3d." + key, JSON.stringify(value)); } catch { /* private mode */ }
    },
  };

  // ------------------------------------------------------------ topic registry
  L3D.topics = {};
  // Chapter files call L3D.topic({ id: "2.2", summary, lesson, sims: [...], cpp: [...] }).
  L3D.topic = (def) => {
    L3D.topics[def.id] = def;
  };

  const chapters = L3D.toc;
  const sections = chapters.flatMap((ch) => ch.sections.map((s) => ({ ...s, chapter: ch })));
  const sectionById = Object.fromEntries(sections.map((s) => [s.id, s]));

  const loaded = {};
  function loadChapter(ch) {
    if (!loaded[ch.id]) {
      loaded[ch.id] = new Promise((resolve) => {
        const s = document.createElement("script");
        s.src = ch.file;
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.head.append(s);
      });
    }
    return loaded[ch.id];
  }

  // ------------------------------------------------------------ math rendering
  const katexReady = new Promise((resolve) => {
    const check = () => (window.renderMathInElement ? resolve(true) : null);
    if (!check()) {
      window.addEventListener("load", () => resolve(!!window.renderMathInElement));
    }
  });

  function renderMath(el) {
    katexReady.then((ok) => {
      if (!ok || !el.isConnected) {
        el.classList.add("no-katex");
        return;
      }
      window.renderMathInElement(el, {
        delimiters: [
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
        ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"],
      });
    });
  }

  // ------------------------------------------------------------ progress
  const done = new Set(store.get("done", []));
  function setDone(id, value) {
    value ? done.add(id) : done.delete(id);
    store.set("done", [...done]);
    renderSidebar();
  }

  // ------------------------------------------------------------ theme
  const themeBtn = $("#theme-toggle");
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    themeBtn.textContent = t === "dark" ? "☀" : "☾";
    themeBtn.title = t === "dark" ? "Switch to light theme" : "Switch to dark theme";
    document.dispatchEvent(new Event("l3d:theme"));
  }
  applyTheme(store.get("theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  themeBtn.addEventListener("click", () => {
    const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    store.set("theme", t);
    applyTheme(t);
  });

  // ------------------------------------------------------------ sidebar
  const nav = $("#nav");
  const search = $("#search");
  let route = { page: "home" };
  const openChapters = new Set(store.get("open", ["ch01"]));

  function renderSidebar() {
    const q = search.value.trim().toLowerCase();
    const current = route.page === "topic" ? route.id : null;
    nav.innerHTML = chapters.map((ch) => {
      const list = ch.sections.filter((s) =>
        !q || `${s.id} ${s.title} ${ch.title} ${s.subs.map((x) => x[1]).join(" ")}`.toLowerCase().includes(q));
      if (!list.length) return "";
      const isOpen = q || openChapters.has(ch.id) || ch.sections.some((s) => s.id === current);
      const count = ch.sections.filter((s) => done.has(s.id)).length;
      return `
        <div class="nav-chapter${isOpen ? " open" : ""}" data-ch="${ch.id}">
          <button class="nav-ch-head" type="button" aria-expanded="${!!isOpen}">
            <span class="nav-ch-num">${ch.number}</span>
            <span class="nav-ch-title">${ch.title}</span>
            <span class="nav-ch-count${count === ch.sections.length ? " full" : ""}">${count}/${ch.sections.length}</span>
          </button>
          <div class="nav-sections">
            ${list.map((s) => `
              <a class="nav-sec${s.id === current ? " active" : ""}${done.has(s.id) ? " done" : ""}" href="#/${s.id}">
                <span class="nav-sec-num">${s.id}</span><span>${s.title}</span>
              </a>
              ${s.id === current && s.subs.length ? `<div class="nav-subs">${s.subs.map(([sid, st]) =>
                `<a href="#/${s.id}/learn/${sid}" class="nav-sub">${sid} ${st}</a>`).join("")}</div>` : ""}
            `).join("")}
          </div>
        </div>`;
    }).join("") || `<p class="nav-empty">No topics match “${search.value}”.</p>`;
  }

  nav.addEventListener("click", (e) => {
    const head = e.target.closest(".nav-ch-head");
    if (head) {
      const id = head.parentElement.dataset.ch;
      openChapters.has(id) ? openChapters.delete(id) : openChapters.add(id);
      store.set("open", [...openChapters]);
      renderSidebar();
      return;
    }
    if (e.target.closest("a")) document.body.classList.remove("nav-open");
  });
  search.addEventListener("input", renderSidebar);
  $("#nav-toggle").addEventListener("click", () => document.body.classList.toggle("nav-open"));
  $("#scrim").addEventListener("click", () => document.body.classList.remove("nav-open"));

  // ------------------------------------------------------------ routing
  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (!parts.length) return { page: "home" };
    if (parts[0] === "cpp-types") return { page: "cpp-types" };
    if (!sectionById[parts[0]]) return { page: "home" };
    const tab = ["learn", "simple", "sim", "cpp", "csharp"].includes(parts[1]) ? parts[1] : "learn";
    return { page: "topic", id: parts[0], tab, sub: parts[2] };
  }

  const main = $("#main");
  let activeSim = null;

  function stopSim() {
    if (activeSim) {
      activeSim.destroy();
      activeSim = null;
    }
  }

  async function render() {
    const prev = route;
    route = parseRoute();
    renderSidebar();
    if (route.page === "topic") {
      store.set("last", location.hash);
      const sameTopic = prev.page === "topic" && prev.id === route.id && main.dataset.topic === route.id;
      if (sameTopic) {
        showTab(route.tab, route.sub);
        return;
      }
      stopSim();
      await renderTopic(route.id);
      showTab(route.tab, route.sub);
    } else {
      stopSim();
      main.dataset.topic = "";
      route.page === "cpp-types" ? renderCppTypes() : renderHome();
      document.title = "Learn 3D Math";
      window.scrollTo(0, 0);
    }
  }

  window.addEventListener("hashchange", render);

  // ------------------------------------------------------------ home page
  function renderHome() {
    const total = sections.length;
    const last = store.get("last", null);
    main.innerHTML = `
      <section class="home">
        <div class="home-hero">
          <p class="eyebrow">Visual study notes</p>
          <h1>${L3D.book.title}</h1>
          <p class="lede">Every section of ${L3D.book.author}'s book as a lesson you can read, a simulation you can play with,
            and the C++ that turns each formula into game code.</p>
          <div class="home-actions">
            <a class="btn btn-primary" href="${last || "#/1.1"}">${last ? "Continue where you left off" : "Start with Chapter 1"}</a>
            <a class="btn" href="#/cpp-types">C++ types used in the examples</a>
          </div>
          <div class="progress-line"><div style="width:${(100 * done.size) / total}%"></div></div>
          <p class="muted small">${done.size} of ${total} topics marked as learned</p>
        </div>
        <div class="how">
          <div><b>📖 Learn</b><span>The idea, the derivation, and the formulas, with practice questions.</span></div>
          <div><b>🎮 Simulate</b><span>Drag, orbit, and tweak sliders to see the math react.</span></div>
          <div><b>💻 C++ Code</b><span>Each formula next to the C++ that computes it.</span></div>
        </div>
        <div class="chapter-grid">
          ${chapters.map((ch) => {
            const count = ch.sections.filter((s) => done.has(s.id)).length;
            return `
            <a class="chapter-card" href="#/${ch.sections[0].id}">
              <span class="chapter-num">${ch.id === "app" ? "Appendix" : "Chapter " + ch.number}</span>
              <h3>${ch.title}</h3>
              <p>${ch.blurb}</p>
              <span class="chapter-meta">${ch.sections.length} topics · ${count} learned</span>
              <div class="progress-line"><div style="width:${(100 * count) / ch.sections.length}%"></div></div>
            </a>`;
          }).join("")}
        </div>
      </section>`;
  }

  // ------------------------------------------------------------ C++ types page
  function renderCppTypes() {
    main.innerHTML = `
      <section class="topic">
        <header class="topic-head">
          <p class="eyebrow">Reference</p>
          <h1>C++ types used in the code examples</h1>
          <p class="lede">The C++ tab of every topic uses these small structs. They follow the book's conventions:
            column vectors, matrices that multiply as <code>M * v</code>, right-handed coordinates, and angles in radians.</p>
        </header>
        <div class="code-list">${(L3D.cppTypes || []).map(codeBlock).join("")}</div>
      </section>`;
    enhanceCode(main);
    renderMath(main);
  }

  // ------------------------------------------------------------ topic page
  async function renderTopic(id) {
    const sec = sectionById[id];
    const ch = sec.chapter;
    main.dataset.topic = id;
    main.innerHTML = `<div class="loading">Loading ${id} ${sec.title}…</div>`;
    await loadChapter(ch);
    if (parseRoute().id !== id) return; // the reader navigated away while loading
    const t = L3D.topics[id];
    const idx = sections.indexOf(sec);
    const prev = sections[idx - 1], next = sections[idx + 1];
    const sims = t ? ensureSimulationPair(t, sec) : [];
    const cpp = (t && t.cpp) || [];
    const csharp = (t && t.csharp) || cpp.map(csharpBlock);
    document.title = `${id} ${sec.title} · Learn 3D Math`;

    main.innerHTML = `
      <article class="topic">
        <header class="topic-head">
          <p class="eyebrow">${ch.id === "app" ? "Appendix " + id : `Chapter ${ch.number} · ${ch.title}`}</p>
          <h1><span class="topic-num">${id}</span>${sec.title}</h1>
          ${t && t.summary ? `<p class="lede">${t.summary}</p>` : ""}
          <nav class="tabs" role="tablist">
            <a role="tab" data-tab="learn" href="#/${id}">📖 Learn</a>
            <a role="tab" data-tab="simple" href="#/${id}/simple">✨ Simplified</a>
            <a role="tab" data-tab="sim" href="#/${id}/sim">🎮 Simulate${sims.length > 1 ? ` <span class="badge">${sims.length}</span>` : ""}</a>
            <a role="tab" data-tab="cpp" href="#/${id}/cpp">💻 C++ Code${cpp.length ? ` <span class="badge">${cpp.length}</span>` : ""}</a>
            <a role="tab" data-tab="csharp" href="#/${id}/csharp"># C# Code${csharp.length ? ` <span class="badge">${csharp.length}</span>` : ""}</a>
          </nav>
        </header>

        <section class="tab-panel" data-panel="learn">
          ${t && sec.subs.length ? `<nav class="subnav"><span>On this page</span>${sec.subs.map(([sid, st]) =>
            `<a href="#/${id}/learn/${sid}">${sid} ${st}</a>`).join("")}</nav>` : ""}
          ${t ? `<div class="lesson">${t.lesson || ""}</div>` + keyFormulas(t) + exercises(t) : missing(sec)}
          ${t ? studyBox(id) : ""}
        </section>

        <section class="tab-panel" data-panel="sim">
          ${sims.length > 1 ? `<div class="sim-picker">${sims.map((s, i) =>
            `<a href="#/${id}/sim/${i}" data-sim="${i}">${s.title}</a>`).join("")}</div>` : ""}
          <div class="sim-host"></div>
        </section>

        <section class="tab-panel" data-panel="cpp">
          ${cpp.length ? `
            <p class="cpp-intro">Each block shows a formula from this section and the C++ that computes it.
              The structs (<code>Vector3D</code>, <code>Matrix3D</code>, …) are listed on the
              <a href="#/cpp-types">C++ types</a> page.</p>
            <div class="code-list">${cpp.map(codeBlock).join("")}</div>` : `<p class="empty">No C++ examples for this topic yet.</p>`}
        </section>

        <section class="tab-panel" data-panel="simple">
          ${t ? simplifiedLesson(sec, t) : ""}
          <div class="sim-host simple-host"></div>
        </section>

        <section class="tab-panel" data-panel="csharp">
          ${csharp.length ? `
            <p class="cpp-intro">Each block is a C# translation of the topic's C++ example. It assumes matching
              engine math types such as <code>Vector3D</code> and <code>Matrix3D</code>, with operator overloads
              equivalent to the C++ examples.</p>
            <div class="code-list">${csharp.map(csharpCodeBlock).join("")}</div>` : `<p class="empty">No C# examples for this topic yet.</p>`}
        </section>

        <footer class="topic-foot">
          ${prev ? `<a class="pager prev" href="#/${prev.id}"><small>Previous</small>${prev.id} ${prev.title}</a>` : "<span></span>"}
          ${next ? `<a class="pager next" href="#/${next.id}"><small>Next</small>${next.id} ${next.title}</a>` : "<span></span>"}
        </footer>
      </article>`;

    // number the subsection headings: <h2 data-sub="4.6.1">Title</h2>
    main.querySelectorAll(".lesson [data-sub]").forEach((h) => {
      h.id = "sub-" + h.dataset.sub;
      h.insertAdjacentHTML("afterbegin", `<span class="sub-num">${h.dataset.sub}</span>`);
    });
    enhanceCode(main);
    renderMath(main);
    wireStudyBox(id);
  }

  function missing(sec) {
    return `<div class="empty"><h3>Not written yet</h3><p>The lesson for ${sec.id} ${sec.title} hasn't been added.
      Topics live in <code>${sec.chapter.file}</code>.</p></div>`;
  }

  function keyFormulas(t) {
    if (!t.keyFormulas || !t.keyFormulas.length) return "";
    return `<div class="key-formulas"><h2>Key formulas</h2><dl>${t.keyFormulas.map(([label, tex]) =>
      `<dt>${label}</dt><dd>\\[${tex}\\]</dd>`).join("")}</dl></div>`;
  }

  function exercises(t) {
    if (!t.exercises || !t.exercises.length) return "";
    return `<div class="exercises"><h2>Check your understanding</h2>${t.exercises.map((ex, i) => `
      <details class="exercise"><summary><span>Q${i + 1}</span> ${ex.q}</summary><div class="answer">${ex.a}</div></details>`).join("")}</div>`;
  }

  function studyBox(id) {
    return `
      <div class="study-box">
        <label class="done-toggle"><input type="checkbox" id="done-check" ${done.has(id) ? "checked" : ""}> I've learned this topic</label>
        <label class="notes-label" for="notes">My notes</label>
        <textarea id="notes" rows="4" placeholder="Write what clicked, what confused you, or a formula to remember…"></textarea>
        <span class="muted small">Notes and progress are saved in this browser.</span>
      </div>`;
  }

  function wireStudyBox(id) {
    const check = $("#done-check");
    const notes = $("#notes");
    if (!check) return;
    check.addEventListener("change", () => setDone(id, check.checked));
    notes.value = store.get("notes." + id, "");
    let timer;
    notes.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => store.set("notes." + id, notes.value), 300);
    });
  }

  // ------------------------------------------------------------ C++ blocks
  // A block is { title, formula?: TeX, note?: html, code }.
  function codeBlock(b) {
    return `
      <div class="code-card">
        <div class="code-card-head">
          <h3>${b.title}</h3>
          <button class="copy-btn" type="button">Copy</button>
        </div>
        ${b.formula ? `<div class="code-formula">\\[${b.formula}\\]</div>` : ""}
        ${b.note ? `<div class="code-note">${b.note}</div>` : ""}
        <pre class="code"><code class="language-cpp">${escapeHtml(L3D.cpp.dedent(b.code))}</code></pre>
      </div>`;
  }

  // ------------------------------------------------------------ simplified learning
  // Short, concrete language for a first encounter with every topic. The chapter
  // family selects the analogy and the tiny sandbox; each page still keeps its own
  // title and main lesson for readers who want the full treatment afterwards.
  function simplePlan(sec) {
    const plans = {
      ch01: ["A game turns dots into a picture, like connecting-the-dots very quickly.", "A point travels through a few picture-making steps before it becomes a pixel.", "Move the dot and watch its screen position change."],
      ch02: ["A vector is an arrow: it tells us which way to go and how far.", "arrow = direction + length", "Drag the arrow tip and notice its length."],
      ch03: ["A matrix is a rule machine. Put in an arrow and it gives back a changed arrow.", "new arrow = rule × old arrow", "Turn the rule knob and compare before and after."],
      ch04: ["A transform is a move, turn, or stretch for a shape.", "new place = move + turn + stretch", "Move the slider and watch the shape change."],
      ch05: ["Geometry is the game world's measuring tape: it asks where things are and whether they meet.", "distance = how far two things are apart", "Move the point and see the shortest path."],
      ch06: ["A ray is a pretend laser beam. We ask which object it touches first.", "hit = laser path meets shape", "Aim the laser and see whether it hits."],
      ch07: ["Lighting is how bright something looks when a lamp shines on it.", "brightness = how much the light faces the surface", "Turn the light and watch brightness change."],
      ch08: ["Visibility means drawing only what the camera can see, like looking through a window.", "draw it if it is inside the window", "Move the window over the objects."],
      ch09: ["Polygons are flat paper shapes used to build game objects.", "big shape = small triangles joined together", "Move the line and see which part of a shape remains."],
      ch10: ["A shadow appears when something blocks light, like your hand blocking a torch.", "shadow = light path is blocked", "Move the light and compare the shadow."],
      ch11: ["A curve is a smooth path made by gently pulling control points.", "path = a smooth blend between guide points", "Drag a guide point and shape the path."],
      ch12: ["Collision means two game things try to use the same space.", "collision = distance is small enough", "Move the ball toward the obstacle."],
      ch13: ["Physics tracks where something is, how fast it moves, and how it speeds up or slows down.", "new place = old place + movement", "Change the push and watch the object travel."],
      ch14: ["Rotational physics is about things that spin, like a playground merry-go-round.", "spin changes direction around a center", "Turn the angle and watch the spinning arrow."],
      ch15: ["Fluid and cloth are lots of tiny points tugging on their neighbours.", "each point shares its wobble with nearby points", "Make one point move and watch the ripple."],
      ch16: ["Numerical methods are careful guessing steps that let a computer solve hard math.", "smaller steps usually make a better answer", "Change the step size and compare the path."],
      app: ["This is a handy math tool box for ideas used throughout 3D games.", "a formula is a short recipe", "Move the point and connect numbers to a picture."],
    };
    return plans[sec.chapter.id] || plans.app;
  }

  function simplifiedLesson(sec, topic) {
    const [idea, recipe, tryIt] = simplePlan(sec);
    const formula = topic.keyFormulas && topic.keyFormulas[0];
    return `<div class="lesson simplified-lesson">
      <div class="key"><h2>In one simple idea</h2><p>${idea}</p><p><strong>This topic:</strong> ${sec.title}.</p></div>
      <h2>Think of it like this</h2><p>${recipe}. You do not need to memorize the hard version first; start by changing one thing and watching what happens.</p>
      <h2>Easy formula words</h2><p><strong>${formula ? formula[0] : "The rule"}:</strong> ${recipe}.</p>
      <div class="note"><strong>Try it:</strong> ${tryIt} Then return to the Learn tab when you want the full math explanation.</div>
    </div>`;
  }

  function mountSimplifiedSim(sec) {
    stopSim();
    const host = $(".simple-host", main);
    if (!host) return;
    host.innerHTML = `<div class="sim-head"><h2>Try it yourself</h2><div class="sim-help"><p>Use one slider. Watch the picture change. That is the core idea before the detailed mathematics.</p></div></div><div class="sim-root"></div>`;
    activeSim = new L3D.Sim($(".sim-root", host));
    const { stage, controls, readout } = activeSim.layout({ side: "bottom" });
    const view = activeSim.view2d(stage, { range: 4, height: 330 }); const out = activeSim.readout(readout);
    const amount = activeSim.slider(controls, { label: "Move it", min: -3, max: 3, step: .1, value: 1.5, onInput: () => view.redraw() });
    const chapter = sec.chapter.id;
    view.onDraw((v) => {
      const x = amount.value; v.grid(); v.axes({ ticks: true });
      if (["ch11", "ch15"].includes(chapter)) { const pts = Array.from({ length: 41 }, (_, i) => { const u = -3 + i * .15; return [u, Math.sin(u * 1.5) * x * .35]; }); v.polyline(pts, { color: "a", width: 3 }); v.point([0, 0], { color: "e", label: "start here" }); }
      else if (["ch07", "ch10"].includes(chapter)) { v.circle([0, 0], 1.25, { color: "a", fill: "a", fillAlpha: .18 }); v.arrow([0, 0], [x, 2.5], { color: "g", label: "light" }); v.text([-2.8, -2.7], x > 0 ? "more light" : "light moved away", { color: x > 0 ? "c" : "e", size: 16 }); }
      else if (["ch12", "ch08", "ch09"].includes(chapter)) { v.rect([-1.2, -1], [1.2, 1], { color: "c", fill: "c", fillAlpha: .1 }); v.circle([x, 0], .45, { color: Math.abs(x) < 1.65 ? "e" : "a", fill: "a", fillAlpha: .25 }); }
      else { v.arrow([0, 0], [x, x * .55], { color: "a", label: "change" }); v.circle([x, x * .55], .16, { color: "c", fill: "c" }); }
      out.set(activeSim.rows([["topic", sec.id], ["your number", L3D.math.fmt(x)], ["what changed", "the picture"]]));
    });
  }

  // Older chapters often have one strong 2D/raster simulation but no spatial
  // counterpart. Add a lightweight 3D companion on demand, rather than copying
  // another renderer into dozens of chapter files. It is appended only once per
  // topic and is disposed through the normal L3D.Sim lifecycle.
  function ensureSimulationPair(topic, sec) {
    const sims = topic.sims || (topic.sims = []);
    // Geometry already supplies bespoke "- 3D scene" simulations. Other
    // chapters receive exactly one companion unless one was added previously.
    if (sims.some((s) => /3D scene|3D spatial companion/.test(s.title || ""))) return sims;
    sims.push({
      title: `${sec.title} - 3D spatial companion`,
      help: `<p>Orbit the scene and change the orientation. This companion puts the topic's vectors, axes, and spatial scale into a 3D coordinate frame.</p>`,
      mount(sim) {
        const { stage, controls, readout } = sim.layout();
        const view = sim.view3d(stage, { height: 440, distance: 8, yaw: 0.72, pitch: 0.4 });
        const out = sim.readout(readout);
        const heading = sim.slider(controls, { label: "Heading", min: -180, max: 180, step: 1, value: 35, unit: "°", onInput: () => view.redraw() });
        const elevation = sim.slider(controls, { label: "Elevation", min: -75, max: 75, step: 1, value: 25, unit: "°", onInput: () => view.redraw() });
        const scale = sim.slider(controls, { label: "Spatial scale", min: 0.5, max: 4, step: 0.1, value: 2, onInput: () => view.redraw() });
        view.onDraw((v) => {
          const h = L3D.math.rad(heading.value), e = L3D.math.rad(elevation.value), r = scale.value;
          const q = [r * Math.cos(e) * Math.cos(h), r * Math.sin(e), r * Math.cos(e) * Math.sin(h)];
          v.grid({ size: 5, step: 1 }); v.axes({ length: 2 });
          v.arrow([0, 0, 0], q, { color: "a", label: "state" });
          v.sphere(q, 0.18, { fill: "a" });
          v.line([0, 0, 0], [q[0], 0, q[2]], { color: "muted", dash: [5, 4] });
          v.line([q[0], 0, q[2]], q, { color: "c", dash: [5, 4] });
          out.set(sim.rows([["topic", sec.id], ["x", L3D.math.fmt(q[0])], ["y", L3D.math.fmt(q[1])], ["z", L3D.math.fmt(q[2])], ["length", L3D.math.fmt(r)]]));
        });
      },
    });
    return sims;
  }

  // Chapters may optionally provide an explicit `csharp` array. Otherwise convert the
  // focused C++ example at render time, keeping every topic's two code views in sync.
  function csharpBlock(b) {
    return { ...b, code: cppToCSharp(b.code) };
  }

  function cppToCSharp(code) {
    let translated = L3D.cpp.dedent(code)
      .replace(/#include[^\n]*\n/g, "")
      .replace(/\binline\s+/g, "")
      .replace(/\bconst\s+([A-Za-z_]\w*)\s*&/g, "$1")
      .replace(/\b([A-Za-z_]\w*)\s*&\s*(\w+)/g, "out $1 $2")
      .replace(/\bconst\s+/g, "")
      .replace(/\bauto\b/g, "var")
      .replace(/\bstd::vector\s*<\s*([^>]+)\s*>/g, "List<$1>")
      .replace(/\.push_back\s*\(/g, ".Add(")
      .replace(/\buint(?:8|16|32|64)_t\b/g, "uint")
      .replace(/\bint(?:8|16|32|64)_t\b/g, "int")
      .replace(/\bsize_t\b/g, "int")
      .replace(/\bstatic_cast\s*<\s*([^>]+)\s*>\s*\(/g, "($1)(")
      .replace(/\b(Vector2D|Vector3D|Vector4D|Point3D|Matrix3D|Matrix4D|Quaternion|Plane|Ray)\s*\(/g, "new $1(")
      .replace(/\bstd::sqrt\b/g, "MathF.Sqrt")
      .replace(/\bstd::sin\b/g, "MathF.Sin")
      .replace(/\bstd::cos\b/g, "MathF.Cos")
      .replace(/\bstd::tan\b/g, "MathF.Tan")
      .replace(/\bstd::abs\b/g, "MathF.Abs")
      .replace(/\bstd::min\b/g, "MathF.Min")
      .replace(/\bstd::max\b/g, "MathF.Max")
      .replace(/\bnullptr\b/g, "null")
      .replace(/\btrue\b/g, "true")
      .replace(/\bfalse\b/g, "false");
    // The source blocks are free C++ functions. Put them in a C# static class so
    // copied code has the natural C# compilation context rather than looking like C++.
    translated = translated.replace(/^(\s*)(?!if\b|for\b|while\b|switch\b)([A-Za-z_]\w*(?:\s*<[^>]+>)?)\s+([A-Za-z_]\w*)\s*\(([^\n]*)\)\s*\{/m,
      "$1public static $2 $3($4) {");
    return `using System;\nusing System.Collections.Generic;\n\npublic static class TopicMath\n{\n${translated.split("\n").map((line) => line ? "    " + line : "").join("\n")}\n}`;
  }

  function csharpCodeBlock(b) {
    return `
      <div class="code-card">
        <div class="code-card-head">
          <h3>${b.title}</h3>
          <button class="copy-btn" type="button">Copy</button>
        </div>
        ${b.formula ? `<div class="code-formula">\\[${b.formula}\\]</div>` : ""}
        ${b.note ? `<div class="code-note">${b.note}</div>` : ""}
        <pre class="code"><code class="language-csharp">${escapeHtml(L3D.cpp.dedent(b.code))}</code></pre>
      </div>`;
  }

  const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function enhanceCode(root) {
    root.querySelectorAll("code.language-cpp, code.language-csharp, pre.cpp code").forEach((el) => {
      if (el.dataset.hl) return;
      el.dataset.hl = "1";
      el.innerHTML = L3D.cpp.highlight(el.textContent);
    });
  }

  main.addEventListener("click", (e) => {
    const copy = e.target.closest(".copy-btn");
    if (copy) {
      const code = copy.closest(".code-card").querySelector("code").textContent;
      navigator.clipboard.writeText(code).then(() => {
        copy.textContent = "Copied ✓";
        setTimeout(() => (copy.textContent = "Copy"), 1200);
      });
    }
  });

  // ------------------------------------------------------------ tabs
  function showTab(tab, sub) {
    const id = route.id;
    main.querySelectorAll(".tabs [data-tab]").forEach((a) => a.classList.toggle("on", a.dataset.tab === tab));
    main.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));

    if (tab === "sim") {
      const t = L3D.topics[id];
      const sims = (t && t.sims) || [];
      const index = Math.min(+sub || 0, Math.max(0, sims.length - 1));
      mountSim(sims[index], index);
    } else if (tab === "simple") {
      mountSimplifiedSim(sectionById[id]);
    } else {
      stopSim();
    }

    if (tab === "learn" && sub) {
      const h = document.getElementById("sub-" + sub);
      if (h) {
        h.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    const head = $(".topic-head", main);
    if (head && head.getBoundingClientRect().top < 0) head.scrollIntoView({ block: "start" });
  }

  function mountSim(def, index) {
    stopSim();
    const host = $(".sim-host", main);
    main.querySelectorAll(".sim-picker a").forEach((a) => a.classList.toggle("on", +a.dataset.sim === index));
    if (!def) {
      host.innerHTML = `<p class="empty">No simulation for this topic yet.</p>`;
      return;
    }
    host.innerHTML = `
      <div class="sim-head">
        <h2>${def.title}</h2>
        ${def.help ? `<div class="sim-help">${def.help}</div>` : ""}
      </div>
      <div class="sim-root"></div>`;
    renderMath($(".sim-head", host));
    activeSim = new L3D.Sim($(".sim-root", host));
    try {
      const cleanup = def.mount(activeSim);
      if (typeof cleanup === "function") activeSim.cleanup(cleanup);
    } catch (err) {
      console.error(err);
      $(".sim-root", host).innerHTML = `<p class="empty">This simulation hit an error: ${escapeHtml(String(err))}</p>`;
    }
  }

  render();
})();
