// L3D app - routing, sidebar, and the Learn / Simulate / C++ tabs of each topic page.
//
// Routes (hash based, so the site works when index.html is opened straight from disk):
//   #/                  home
//   #/2.2               topic 2.2, Learn tab
//   #/2.2/sim           topic 2.2, Simulate tab   (#/2.2/sim/1 = second simulation)
//   #/2.2/cpp           topic 2.2, C++ Code tab
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
    const tab = ["learn", "sim", "cpp"].includes(parts[1]) ? parts[1] : "learn";
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
    const sims = (t && t.sims) || [];
    const cpp = (t && t.cpp) || [];
    document.title = `${id} ${sec.title} · Learn 3D Math`;

    main.innerHTML = `
      <article class="topic">
        <header class="topic-head">
          <p class="eyebrow">${ch.id === "app" ? "Appendix " + id : `Chapter ${ch.number} · ${ch.title}`}</p>
          <h1><span class="topic-num">${id}</span>${sec.title}</h1>
          ${t && t.summary ? `<p class="lede">${t.summary}</p>` : ""}
          <nav class="tabs" role="tablist">
            <a role="tab" data-tab="learn" href="#/${id}">📖 Learn</a>
            <a role="tab" data-tab="sim" href="#/${id}/sim">🎮 Simulate${sims.length > 1 ? ` <span class="badge">${sims.length}</span>` : ""}</a>
            <a role="tab" data-tab="cpp" href="#/${id}/cpp">💻 C++ Code${cpp.length ? ` <span class="badge">${cpp.length}</span>` : ""}</a>
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

  const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function enhanceCode(root) {
    root.querySelectorAll("code.language-cpp, pre.cpp code").forEach((el) => {
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
