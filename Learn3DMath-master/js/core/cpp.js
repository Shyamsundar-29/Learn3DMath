// L3D.cpp - a small C++ syntax highlighter for the "C++ Code" tab.
(function () {
  "use strict";

  const KEYWORDS = new Set(("alignas alignof auto bool break case catch char class const constexpr continue default delete do " +
    "double else enum explicit extern false float for friend if inline int long namespace new noexcept nullptr operator " +
    "private protected public return short signed sizeof static static_cast struct switch template this throw true try " +
    "typedef typename uint8_t uint16_t uint32_t int32_t size_t union unsigned using virtual void volatile while").split(" "));

  const TOKEN = new RegExp([
    "(?<comment>\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)",
    "(?<pre>^[ \\t]*#[^\\n]*)",
    "(?<str>\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*')",
    "(?<num>\\b(?:0x[0-9a-fA-F]+|\\d+\\.?\\d*(?:[eE][+-]?\\d+)?[fFuUlL]*|\\.\\d+(?:[eE][+-]?\\d+)?[fF]?)\\b)",
    "(?<word>[A-Za-z_]\\w*)(?<call>(?=\\s*\\())?",
  ].join("|"), "gm");

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function highlight(code) {
    let out = "", last = 0;
    for (const m of code.matchAll(TOKEN)) {
      out += esc(code.slice(last, m.index));
      last = m.index + m[0].length;
      const g = m.groups;
      let cls = null;
      if (g.comment) cls = "c";
      else if (g.pre) cls = "p";
      else if (g.str) cls = "s";
      else if (g.num) cls = "n";
      else if (g.word) {
        if (KEYWORDS.has(g.word)) cls = "k";
        else if (g.call !== undefined) cls = "f"; // empty lookahead capture: a function call
        else if (/^[A-Z]/.test(g.word)) cls = "t";
      }
      out += cls ? `<span class="tok-${cls}">${esc(m[0])}</span>` : esc(m[0]);
    }
    return out + esc(code.slice(last));
  }

  // Strip the common leading indentation so code written inside an indented
  // template literal still displays flush left.
  function dedent(code) {
    const lines = code.replace(/^\n+|\s+$/g, "").split("\n");
    const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length);
    const min = indents.length ? Math.min(...indents) : 0;
    return lines.map((l) => l.slice(min)).join("\n");
  }

  window.L3D = window.L3D || {};
  L3D.cpp = { highlight, dedent };
})();
