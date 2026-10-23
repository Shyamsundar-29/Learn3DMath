// Chapter 5 - Geometry for 3D Engines
(function () {
  "use strict";
  const { V, fmt, rad } = L3D.math;
  const cpp = (name, code) => [{ title: name, formula: String.raw`\mathbf p(t)=\mathbf p_0+t\mathbf d`, code }];
  function lesson(title, intro, subs, formula) {
    return String.raw`<p>${intro}</p><div class="key">Geometry queries reduce rendering decisions to signed distances, dot products, and parametric coordinates. Keep a direction normalized whenever a result is interpreted as a distance.</div>${subs.map(([id, name]) => `<h2 data-sub="${id}">${name}</h2><p>${name} is evaluated from the same geometric representation, so it remains stable as objects move. The simulation exposes the values used by the test and lets you change the configuration.</p>`).join("")}<div class="formula">\[${formula}\]</div><div class="game">A renderer uses this calculation for cameras, clipping, picking, decals, and visibility before it submits expensive draw work.</div><p><a class="btn goto-sim" href="#/${title}/sim">Try the interactive model →</a></p>`;
  }
  function geometrySim(kind, title) {
    return { title: title + " - 2D construction", help: "<p>Drag the point and adjust the direction. The diagram and the signed values update from the same calculation used by the lesson.</p>", mount(sim) {
      const { stage, controls, readout } = sim.layout(); const view = sim.view2d(stage, { range: 5 }); const out = sim.readout(readout);
      const p = view.handle([2, 2], { color: "a", label: "P" }); const a = view.handle([-3, -1], { color: "b", label: "A" });
      const angle = sim.slider(controls, { label: "Direction angle", min: -180, max: 180, step: 1, value: 25, unit: "°", onInput: () => view.redraw() });
      const fov = sim.slider(controls, { label: "Field of view", min: 20, max: 140, step: 1, value: 60, unit: "°", onInput: () => view.redraw() });
      view.onDraw((v) => { const d = [Math.cos(rad(angle.value)), Math.sin(rad(angle.value))]; const q = V.add(a.pos, V.scale(d, V.dot(V.sub(p.pos, a.pos), d))); const dist = V.len(V.sub(p.pos, q));
        v.grid(); v.axes({ ticks: true }); v.infiniteLine(a.pos, d, { color: "b" }); v.line(p.pos, q, { color: "e", dash: [5, 4] }); v.point(q, { color: "e", label: "closest" }); v.arrow(a.pos, V.add(a.pos, V.scale(d, 2.4)), { color: "b", label: "d" });
        if (kind === "frustum" || kind === "projection") { const h = rad(fov.value) / 2; v.line([0, 0], [4 * Math.cos(h), 4 * Math.sin(h)], { color: "c" }); v.line([0, 0], [4 * Math.cos(h), -4 * Math.sin(h)], { color: "c" }); v.text([2.5, 2.3], kind === "frustum" ? "camera frustum" : "projection angle", { color: "c" }); }
        if (kind === "reflection") { const n = [0, 1], incoming = V.norm(V.sub(a.pos, p.pos)), reflected = V.sub(incoming, V.scale(n, 2 * V.dot(incoming, n))); v.line([-4, 0], [4, 0], { color: "c", width: 3 }); v.arrow(p.pos, V.add(p.pos, V.scale(incoming, 2)), { color: "a", label: "incident" }); v.arrow(p.pos, V.add(p.pos, V.scale(reflected, 2)), { color: "e", label: "reflected" }); }
        out.set(sim.rows([["projection parameter t", fmt(V.dot(V.sub(p.pos, a.pos), d))], ["distance to line", fmt(dist)], ["direction", `(${fmt(d[0])}, ${fmt(d[1])})`]])); });
    }};
  }
  // A separate orbiting 3D scene for every Geometry topic. It deliberately uses
  // the shared View3D primitives rather than duplicating a renderer in each lesson.
  function geometry3d(kind, title) {
    return { title: title + " - 3D scene", help: "<p>Orbit the camera and adjust the control. This is the same query shown in its actual 3D setting.</p>", mount(sim) {
      const { stage, controls, readout } = sim.layout(); const view = sim.view3d(stage, { height: 440, distance: 9, yaw: .75, pitch: .38, target: [0, 0, 0] }); const out = sim.readout(readout);
      const a = sim.slider(controls, { label: kind === "frustum" ? "Field of view" : "Scene angle", min: 15, max: 130, step: 1, value: kind === "frustum" ? 60 : 42, unit: "°", onInput: () => view.redraw() });
      const d = sim.slider(controls, { label: kind === "projection" ? "Object depth" : "Distance", min: 1, max: 6, step: .1, value: 3, onInput: () => view.redraw() });
      view.onDraw(v => { const theta = rad(a.value), dir = [Math.cos(theta), .35, Math.sin(theta)], p = [2, 1.6, -1.5]; v.grid({ size: 5, step: 1 }); v.axes({ length: 2 });
        if (kind === "line") { const q = [-3, -.5, -2], u = V.norm([1, .3, .7]), near = V.add(q, V.scale(u, V.dot(V.sub(p, q), u))); v.line(V.add(q, V.scale(u, -4)), V.add(q, V.scale(u, 7)), { color: "b", width: 3 }); v.point(p, { color: "a", label: "P" }); v.point(near, { color: "e", label: "closest" }); v.line(p, near, { color: "e", dash: [5,4] }); out.set(sim.rows([["distance", fmt(V.len(V.sub(p, near)))], ["line parameter", fmt(V.dot(V.sub(p,q),u))]])); }
        else if (kind === "plane") { const n = V.norm(dir), rayO = [-3, 2, -2], rayD = V.norm([1, -.35, .7]), t = -V.dot(n, rayO) / V.dot(n, rayD); const hit = V.add(rayO, V.scale(rayD, t)); v.plane([0,0,0], n, 3, { color:"c", fill:"c", alpha:.18 }); v.arrow([0,0,0], V.scale(n, 2), { color:"c", label:"n" }); v.line(rayO, V.add(rayO, V.scale(rayD, 8)), { color:"a", width:3 }); v.point(hit, { color:"e", label:"intersection" }); out.set(sim.rows([["ray parameter t",fmt(t)],["n · ray direction",fmt(V.dot(n,rayD))]])); }
        else if (kind === "frustum") { const z = d.value, half = Math.tan(theta/2) * z, corners = [[-half,-half,z],[half,-half,z],[half,half,z],[-half,half,z]]; corners.forEach(c => v.line([0,0,0],c,{color:"c"})); v.polyline([...corners,corners[0]],{color:"c",width:2}); v.box([-.7,-.7,z-1],[.7,.7,z+.4],{fill:"a",alpha:.6,wire:true}); out.set(sim.rows([["near-plane half width",fmt(half)],["depth",fmt(z)]])); }
        else if (kind === "interpolation") { const tri=[[-2,-1,1],[2,-1,2],[0,2,4]]; v.poly(tri,{fill:"a",alpha:.35,color:"a",lit:true}); const bary=[.25,.35,.4], hit=tri.reduce((s,x,i)=>V.add(s,V.scale(x,bary[i])),[0,0,0]); v.point(hit,{color:"e",label:"barycentric sample"}); v.point(tri[0],{color:"b",label:"A"});v.point(tri[1],{color:"c",label:"B"});v.point(tri[2],{color:"d",label:"C"});out.set(sim.rows([["λA",bary[0]],["λB",bary[1]],["λC",bary[2]]])); }
        else if (kind === "projection") { v.box([-1,-1,d.value-1],[1,1,d.value+1],{fill:"a",alpha:.55,wire:true}); v.line([0,0,0],[0,0,d.value],{color:"e",width:3}); v.text([0,0,d.value],"camera ray",{color:"e"}); out.set(sim.rows([["camera-space z",fmt(d.value)],["perspective scale",fmt(1/d.value)]])); }
        else { const n=[0,1,0], start=[-2,2,-1], incident=V.norm([.7,-.8,.3]), hit=[-.25,0,-.25], refl=V.sub(incident,V.scale(n,2*V.dot(incident,n)));v.plane([0,0,0],n,3,{color:"c",fill:"c",alpha:.18});v.arrow(start,hit,{color:"a",label:"incident"});v.arrow(hit,V.add(hit,V.scale(refl,3)),{color:"e",label:"reflection"});v.arrow(hit,V.scale(n,2),{color:"c",label:"normal"});out.set(sim.rows([["incident · normal",fmt(V.dot(incident,n))],["reflection length",fmt(V.len(refl))]])); }
      });
    }};
  }
  const defs = [
    ["5.1", "Lines in 3D Space", "A line has an anchor point and a direction: moving its parameter traces every point on the infinite line.", [["5.1.1","Distance Between a Point and a Line"],["5.1.2","Distance Between Two Lines"]], String.raw`\mathbf L(t)=\mathbf P+t\mathbf v`],
    ["5.2", "Planes in 3D Space", "A plane is most useful in normal form: a normal converts a point query into one signed scalar.", [["5.2.1","Intersection of a Line and a Plane"],["5.2.2","Intersection of Three Planes"],["5.2.3","Transforming Planes"]], String.raw`\mathbf n\cdot\mathbf x+d=0`],
    ["5.3", "The View Frustum", "The view frustum is the camera's finite region of interest; its side planes make culling a small set of signed-distance tests.", [["5.3.1","Field of View"],["5.3.2","Frustum Planes"]], String.raw`w=2d\tan(\theta/2)`],
    ["5.4", "Perspective-Correct Interpolation", "Screen-space linear interpolation must account for reciprocal depth to preserve attributes on a projected triangle.", [["5.4.1","Depth Interpolation"],["5.4.2","Vertex Attribute Interpolation"]], String.raw`a=\frac{\sum_i\lambda_i a_i/w_i}{\sum_i\lambda_i/w_i}`],
    ["5.5", "Projections", "Projection matrices place camera-space points in clip space, where the homogeneous divide maps the view volume into a canonical cube.", [["5.5.1","Perspective Projections"],["5.5.2","Orthographic Projections"],["5.5.3","Extracting Frustum Planes"]], String.raw`\mathbf p_{ndc}=\mathbf p_{clip}/w_{clip}`],
    ["5.6", "Reflections and Oblique Clipping", "Reflection changes the component of a vector perpendicular to a plane; oblique clipping replaces a projection boundary with that plane.", [], String.raw`\mathbf r=\mathbf v-2(\mathbf v\cdot\mathbf n)\mathbf n`],
  ];
  defs.forEach(([id, name, intro, subs, formula]) => { const kind = id === "5.1" ? "line" : id === "5.2" ? "plane" : id === "5.3" ? "frustum" : id === "5.4" ? "interpolation" : id === "5.5" ? "projection" : "reflection"; L3D.topic({ id, summary: intro, lesson: lesson(id, intro, subs, formula), keyFormulas: [["Core relation", formula]], exercises: [{ q: "Which quantities must be normalized for a distance interpretation?", a: "<p>Normals and line directions used as distance axes.</p>" }], sims: [geometrySim(kind, name), geometry3d(kind, name)], cpp: cpp("Parametric line evaluation", String.raw`Point3D PointOnLine(const Point3D& p, const Vector3D& d, float t) { return p + d * t; }`) }); });
})();
