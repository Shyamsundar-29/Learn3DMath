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

  // A library can contain several books. Chapters and their reusable topic
  // simulations sit underneath each book in this tree.
  const books = L3D.library || [{ id: "default", shortTitle: L3D.book.title, chapters: L3D.toc }];
  const chapters = books.flatMap((book) => book.chapters.map((ch) => ({ ...ch, book })));
  const sections = chapters.flatMap((ch) => ch.sections.map((s) => ({ ...s, chapter: ch, book: ch.book })));
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
  const openBooks = new Set(store.get("openBooks", [books[0] && books[0].id]));
  const openChapters = new Set(store.get("open", ["ch01"]));

  function renderSidebar() {
    const q = search.value.trim().toLowerCase();
    const current = route.page === "topic" ? route.id : null;
    nav.innerHTML = books.map((book) => {
      const matchingChapters = book.chapters.map((ch) => ({ ...ch, list: ch.sections.filter((s) =>
        !q || `${s.id} ${s.title} ${ch.title} ${book.title} ${s.subs.map((x) => x[1]).join(" ")}`.toLowerCase().includes(q)) }))
        .filter((ch) => ch.list.length);
      if (!matchingChapters.length) return "";
      const bookOpen = q || openBooks.has(book.id) || matchingChapters.some((ch) => ch.sections.some((s) => s.id === current));
      const bookDone = book.chapters.flatMap((ch) => ch.sections).filter((s) => done.has(s.id)).length;
      const bookTotal = book.chapters.flatMap((ch) => ch.sections).length;
      return `<section class="nav-book${bookOpen ? " open" : ""}" data-book="${book.id}">
        <button class="nav-book-head" type="button" aria-expanded="${!!bookOpen}">
          <span class="nav-book-icon">▾</span><span class="nav-book-title">${book.shortTitle || book.title}</span>
          <span class="nav-book-count">${bookDone}/${bookTotal}</span>
        </button>
        <div class="nav-book-chapters">${matchingChapters.map((ch) => {
          const isOpen = q || openChapters.has(ch.id) || ch.sections.some((s) => s.id === current);
          const count = ch.sections.filter((s) => done.has(s.id)).length;
          return `<div class="nav-chapter${isOpen ? " open" : ""}" data-ch="${ch.id}">
            <button class="nav-ch-head" type="button" aria-expanded="${!!isOpen}"><span class="nav-ch-num">${ch.number}</span><span class="nav-ch-title">${ch.title}</span><span class="nav-ch-count${count === ch.sections.length ? " full" : ""}">${count}/${ch.sections.length}</span></button>
            <div class="nav-sections">${ch.list.map((s) => `<a class="nav-sec${s.id === current ? " active" : ""}${done.has(s.id) ? " done" : ""}" href="#/${s.id}"><span class="nav-sec-num">${s.id}</span><span>${s.title}</span></a>${s.id === current && s.subs.length ? `<div class="nav-subs">${s.subs.map(([sid, st]) => `<a href="#/${s.id}/learn/${sid}" class="nav-sub">${sid} ${st}</a>`).join("")}</div>` : ""}`).join("")}</div>
          </div>`;
        }).join("")}</div>
      </section>`;
    }).join("") || `<p class="nav-empty">No topics match “${search.value}”.</p>`;
  }

  nav.addEventListener("click", (e) => {
    const bookHead = e.target.closest(".nav-book-head");
    if (bookHead) {
      const id = bookHead.closest(".nav-book").dataset.book;
      openBooks.has(id) ? openBooks.delete(id) : openBooks.add(id);
      store.set("openBooks", [...openBooks]);
      renderSidebar();
      return;
    }
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
  function simplifiedLesson(sec, topic) {
    const plan = (L3D.simplified && L3D.simplified[sec.id]) || {
      idea: topic.summary || "This is a useful 3D math idea.", rule: "small steps make a clear rule",
      example: "Try changing one value and watch what happens.", tryIt: "Open the visual example below.",
    };
    return `<div class="lesson simplified-lesson">
      <div class="key"><h2>The big idea</h2><p>${plan.idea}</p></div>
      <h2>A little story</h2><div class="simple-story">${simpleStory(sec, plan)}</div>
      <h2>Say it in everyday words</h2><p>${plan.rule}. This is a short recipe, not a test you need to memorise.</p>
      <h2>Walk through it slowly</h2><ol class="simple-steps"><li><strong>Start:</strong> Find the thing the topic is talking about: an arrow, shape, light, or moving object.</li><li><strong>Change one thing:</strong> Use the easy rule to decide what changes.</li><li><strong>Check the picture:</strong> The drawing should match the result of the rule.</li></ol>
      <h2>A tiny example</h2><p>${plan.example}</p>
      <div class="note"><strong>Now you try:</strong> ${plan.tryIt} The small playground below is made for this simplified lesson, so you can focus on one idea at a time.</div>
    </div>`;
  }

  function simpleStory(sec, plan) {
    const kind = simpleDemoKind(sec.id);
    const stories = {
      dots: "<p><strong>Imagine:</strong> You are making a paper robot from dot stickers. The computer does the same job, but it joins millions of dots every second to make a game picture.</p>",
      pixels: "<p><strong>Imagine:</strong> Your screen is a giant sheet of square stickers. The game decides which stickers belong inside a shape, then colours only those squares.</p>",
      transform: "<p><strong>Imagine:</strong> You have a drawing on a clear sheet. You can slide the sheet, turn it, or stretch it. A transformation is the computer's set of instructions for doing that.</p>",
      arrows: "<p><strong>Imagine:</strong> You are giving a tiny robot directions: walk this way and this far. An arrow is a quick picture of those directions.</p>",
      window: "<p><strong>Imagine:</strong> You are looking through a window at a playground. You only need to draw the things you can see through the window, not everything behind you.</p>",
      rgb: "<p><strong>Imagine:</strong> You have three tiny flashlights: red, green, and blue. Shine them together in different amounts and they can make almost any screen colour.</p>",
      light: "<p><strong>Imagine:</strong> You are holding a torch near a ball. Moving the torch or turning the ball changes which parts look bright.</p>",
      wave: "<p><strong>Imagine:</strong> You flick one point on a skipping rope or pond. The wiggle travels to nearby places. Curves, cloth, and water all use that idea.</p>",
      collision: "<p><strong>Imagine:</strong> A game needs to stop a ball before it goes through a wall. First it asks a very simple question: are these two things touching?</p>",
      graph: "<p><strong>Imagine:</strong> You are following a moving toy and marking where it is every moment. A graph is the picture made by all of those marks.</p>",
      circle: "<p><strong>Imagine:</strong> Look at the hand of a clock. As it turns around a circle, its angle tells us exactly where its tip is.</p>",
    };
    return stories[kind] || `<p><strong>Imagine:</strong> You are exploring <strong>${sec.title}</strong> in a game. Start with the simple picture, change one thing, and notice what the computer must work out.</p>`;
  }

  function simpleDemoKind(id) {
    if (id === "1.1") return "dots";
    if (id === "1.3") return "pixels";
    if (/^1\.2|^3\.|^4\./.test(id)) return "transform";
    if (/^2\.|^5\.1|^5\.2|^5\.5|^5\.6|^6\.|^14\./.test(id)) return "arrows";
    if (/^5\.3|^5\.4|^8\.|^9\.|^10\./.test(id)) return "window";
    if (id === "7.1") return "rgb";
    if (/^7\./.test(id)) return "light";
    if (/^11\.|^15\./.test(id)) return "wave";
    if (/^12\./.test(id)) return "collision";
    if (/^13\.|^16\./.test(id) || id === "D") return "graph";
    if (id === "B") return "circle";
    return "arrows";
  }

  function mountSimplifiedSim(sec) {
    stopSim();
    const host = $(".simple-host", main);
    if (!host) return;
    const plan = L3D.simplified && L3D.simplified[sec.id];
    host.innerHTML = `<div class="sim-head"><h2>Play the story</h2><div class="sim-help"><p>Made for <strong>${sec.id} ${sec.title}</strong>. Change the controls, then compare the flat 2D picture with the 3D scene.</p></div></div><div class="sim-root"></div>`;
    activeSim = new L3D.Sim($(".sim-root", host));
    const { stage, controls, readout } = activeSim.layout({ side: "bottom" });
    const flatStage = document.createElement("div"), spaceStage = document.createElement("div");
    stage.append(flatStage, spaceStage);
    spaceStage.hidden = true;
    const view = activeSim.view2d(flatStage, { range: 4, height: 330 });
    const space = activeSim.view3d(spaceStage, { height: 330, distance: 8, yaw: .7, pitch: .38 });
    const out = activeSim.readout(readout);
    const kind = simpleDemoKind(sec.id);
    const mode = activeSim.segmented(controls, { label: "Look at it in", options: [["flat", "2D picture"], ["space", "3D scene"]], value: "flat", onChange: () => { flatStage.hidden = mode.value !== "flat"; spaceStage.hidden = mode.value !== "space"; view.redraw(); space.redraw(); } });
    const amount = activeSim.slider(controls, { label: kind === "rgb" ? "Red light" : "Move / turn", min: -3, max: 3, step: .1, value: 1.5, onInput: () => { view.redraw(); space.redraw(); } });
    const second = activeSim.slider(controls, { label: kind === "light" ? "Lamp height" : kind === "collision" ? "Object size" : "Second change", min: .4, max: 3, step: .1, value: 1.4, onInput: () => { view.redraw(); space.redraw(); } });
    activeSim.note(controls, `<p><strong>Your story goal:</strong> ${plan ? plan.tryIt : "Change a control and describe what changed."}</p>`);
    view.onDraw((v) => {
      const x = amount.value;
      v.grid({ step: 1 }); v.axes({ ticks: true });
      if (kind === "dots") {
        const pts = [[-2, -1], [x, 1.5], [2, -1]]; v.polygon(pts, { color: "a", fill: "a", fillAlpha: .22 }); pts.forEach((p, i) => v.point(p, { color: "a", r: 8, label: "dot " + (i + 1) }));
      } else if (kind === "pixels") {
        for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) if (j <= 1 - Math.abs(i - x * .4)) v.rect([i, j], [i + .88, j + .88], { color: "a", fill: "a", fillAlpha: .5 });
      } else if (kind === "transform") {
        const old = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; const changed = old.map(([a, b]) => [a * (1 + x * .15) + x * .35, b * (1 - x * .08)]); v.polygon(old, { color: "muted", dash: [5, 4] }); v.polygon(changed, { color: "a", fill: "a", fillAlpha: .2 });
      } else if (kind === "window") {
        v.rect([-1.8, -1.3], [1.8, 1.3], { color: "c", fill: "c", fillAlpha: .08 }); for (let i = -3; i <= 3; i++) v.circle([i, Math.sin(i * 2 + x) * 2], .18, { color: Math.abs(i) < 2 ? "a" : "muted", fill: "a", fillAlpha: .35 });
      } else if (kind === "rgb") {
        const r = Math.round(128 + x * 35), g = Math.round(128 - x * 20), b = 160; v.rect([-2.5, -1.5], [2.5, 1.5], { color: `rgb(${r},${g},${b})`, fill: `rgb(${r},${g},${b})`, fillAlpha: 1 }); v.text([0, 0], "mixed colour", { color: "#fff", align: "center", size: 17 });
      } else if (kind === "light") {
        v.circle([0, 0], 1.35, { color: "a", fill: "a", fillAlpha: .12 }); v.arrow([x, 2.6], [0, .6], { color: "g", label: "light" }); v.text([0, -2.2], x > 0 ? "light moved right" : "light moved left", { color: "fg", align: "center", size: 15 });
      } else if (kind === "wave") {
        const pts = Array.from({ length: 49 }, (_, i) => { const u = -3.6 + i * .15; return [u, Math.sin(u * 1.6) * x * .42]; }); v.polyline(pts, { color: "a", width: 3 }); v.point([0, 0], { color: "e", label: "middle" });
      } else if (kind === "collision") {
        v.rect([-1.1, -1], [1.1, 1], { color: "c", fill: "c", fillAlpha: .12 }); const hit = Math.abs(x) < 1.65; v.circle([x, 0], .48, { color: hit ? "e" : "a", fill: hit ? "e" : "a", fillAlpha: .32 }); v.text([0, -2], hit ? "touching!" : "not touching", { color: hit ? "e" : "c", align: "center", size: 16 });
      } else if (kind === "graph") {
        v.plot((u) => .25 * x * u * u - 1.4, { from: -3, to: 3, color: "a", width: 3 }); v.point([x * .5, .25 * x * (x * .5) ** 2 - 1.4], { color: "e", label: "look here" });
      } else if (kind === "circle") {
        v.circle([0, 0], 2, { color: "a" }); v.arrow([0, 0], [2 * Math.cos(x), 2 * Math.sin(x)], { color: "e", label: "angle" });
      } else {
        v.arrow([0, 0], [x, x * .55], { color: "a", label: "arrow" }); v.arrow([0, 0], [-x * .4, 1.4], { color: "c", label: "other arrow" });
      }
      out.set(activeSim.rows([["topic", sec.id], ["move / turn", L3D.math.fmt(x)], ["second change", L3D.math.fmt(second.value)], ["notice", "the picture changes for a reason"]]));
    });
    space.onDraw((v) => {
      const x = amount.value, s = second.value;
      v.grid({ size: 6, step: 1 }); v.axes({ length: 2 });
      if (kind === "collision") { v.box([-1.2, -1, -1], [1.2, 1, 1], { color: "c", fill: "c", alpha: .18 }); v.sphere([x, 0, 0], s * .28, { fill: Math.abs(x) < 1.5 ? "e" : "a", alpha: .75 }); }
      else if (kind === "light") { v.sphere([0, 0, 0], 1.2, { fill: "a", alpha: .35 }); v.arrow([x, s, 2.5], [0, 0, 0], { color: "g", label: "lamp light" }); }
      else if (kind === "window") { v.box([-1.8, -1.2, -1.2], [1.8, 1.2, 1.2], { color: "c", wire: true }); v.sphere([x, 0, 0], .3, { fill: "a" }); }
      else if (kind === "wave") { for (let i = -3; i <= 3; i++) v.sphere([i, Math.sin(i + x) * .35 * s, 0], .13, { fill: "a" }); }
      else if (kind === "rgb") { v.box([-1.6, -1, -1], [1.6, 1, 1], { color: `rgb(${Math.round(128 + x * 35)},${Math.round(128 - x * 20)},160)`, fill: `rgb(${Math.round(128 + x * 35)},${Math.round(128 - x * 20)},160)`, alpha: .8 }); }
      else { v.arrow([0, 0, 0], [x, s * .45, 1.4], { color: "a", label: "change" }); v.sphere([x, s * .45, 1.4], .22, { fill: "a" }); }
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
