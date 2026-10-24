// Basic Math for 3D & Graphics — friendly foundations used by the main book.
(function () {
  "use strict";
  const { fmt, rad, deg } = L3D.math;

  function roundMesh(radius, height, cone = false, hemisphere = false) {
    const n = 24, vertices = [], faces = [];
    if (hemisphere) {
      for (let row = 0; row <= 6; row++) { const phi = row / 6 * Math.PI / 2; for (let i = 0; i < n; i++) { const t = i / n * 2 * Math.PI; vertices.push([radius * Math.sin(phi) * Math.cos(t), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(t)]); } }
      for (let row = 0; row < 6; row++) for (let i = 0; i < n; i++) faces.push([row * n + i, (row + 1) * n + i, (row + 1) * n + (i + 1) % n, row * n + (i + 1) % n]);
      return { vertices, faces };
    }
    for (let y = 0; y < 2; y++) for (let i = 0; i < n; i++) { const t = i / n * 2 * Math.PI; vertices.push([radius * Math.cos(t), y ? height : 0, radius * Math.sin(t)]); }
    for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + (i + 1) % n, n + i]);
    if (cone) { vertices.push([0, height, 0]); const apex = vertices.length - 1; faces.length = 0; for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, apex]); }
    return { vertices, faces };
  }

  const info = {
    "BM1.1": ["Numbers and Number Lines", "A number line is a road for numbers: moving right makes a number bigger and moving left makes it smaller.", "Start at 2. Move 3 spaces right and you land on 5.", "number"],
    "BM1.2": ["Adding and Subtracting", "Adding means putting amounts together. Subtracting means taking an amount away.", "7 + 4 = 11. Then 11 − 3 = 8.", "number"],
    "BM1.3": ["Multiplying and Dividing", "Multiplying is equal groups. Dividing shares something into equal groups.", "3 × 4 means 3 groups of 4, so the answer is 12. 12 ÷ 3 is 4.", "number"],
    "BM1.4": ["Fractions, Decimals, and Percentages", "These are three names for parts of one whole thing.", "One half = 1/2 = 0.5 = 50%.", "fraction"],
    "BM1.5": ["Ratios and Proportions", "A ratio compares two amounts. It tells us how many of one thing go with another thing.", "A paint ratio of 2 blue to 3 yellow means every 2 blue drops need 3 yellow drops.", "ratio"],
    "BM1.6": ["Types of Numbers", "Numbers live in families. Some count things, some include negatives, some are fractions, and some cannot be written as a simple fraction.", "5 is natural, whole, integer, rational, prime. −3 is an integer. π is irrational.", "numbertypes"],
    "BM2.1": ["Points on a Grid", "Coordinates are an address for a point. Read across first, then up or down.", "The point (3, 2) is 3 steps right and 2 steps up from the middle.", "point"],
    "BM2.2": ["Distance and Length", "Distance tells how far apart two places are. In games it helps us measure movement and check whether objects touch.", "From 1 to 6 on a line is 5 steps.", "distance"],
    "BM2.3": ["Perimeter and Area", "Perimeter is the distance around a shape. Area is the amount of flat space inside it.", "A 4 by 3 rectangle has perimeter 14 and area 12.", "area"],
    "BM2.4": ["Right Triangles", "A right triangle has one square 90° corner. Its three side lengths are connected by a useful rule.", "If the short sides are 3 and 4, the longest side is 5 because 3² + 4² = 5².", "triangle"],
    "BM2.5": ["3D Coordinates", "3D uses three directions: x for sideways, y for up and down, and z for forward and back.", "(2, 1, −3) means 2 right, 1 up, and 3 back.", "space"],
    "BM2.6": ["2D Shape Formulas", "Flat shapes have area: the amount of space inside them. Their perimeter is the distance all the way around.", "A rectangle 5 wide and 3 high has area 5 × 3 = 15 square units.", "flatshape"],
    "BM2.7": ["3D Shape Formulas", "Solid shapes have volume: how much space they can hold. They also have surface area: the amount of wrapping paper needed to cover them.", "A cube with side 3 has volume 3 × 3 × 3 = 27 cubic units.", "solid"],
    "BM3.1": ["Angles and Turns", "An angle measures a turn. We often name the angle with the Greek letter theta: θ.", "A quarter turn is 90°. A half turn is 180°.", "angle"],
    "BM3.2": ["Types of Angles and Triangles", "Angles can be small, square, or wide. Triangles can be named by their sides and angles.", "A triangle with angles 90°, 60°, and 30° is a right triangle.", "angle"],
    "BM3.3": ["Sine, Cosine, and Tangent", "Sin, cos, and tan connect an angle in a right triangle to its side lengths. They help games aim, move, and rotate.", "At 0°, cos θ = 1 and sin θ = 0: the circle point is all the way right.", "trig"],
    "BM3.4": ["Degrees and Radians", "Degrees and radians are two ways to measure the same turn. Computers often use radians.", "A half turn is 180° or π radians. A full turn is 360° or 2π radians.", "radian"],
    "BM3.5": ["The Six Trigonometric Ratios", "The six trig ratios are pairs of helpful opposites. They describe a turn using the sides of a right triangle or a point on a circle.", "At 45°, sin θ and cos θ are both about 0.71, and tan θ is 1.", "trigtable"],
  };

  const trigReference = `<h2>Special-angle trigonometric table</h2><p>These five angles appear often in games, graphics, and school math. The table gives their exact values.</p><table class="trig-table"><thead><tr><th>Angle</th><th>0°</th><th>30°</th><th>45°</th><th>60°</th><th>90°</th></tr></thead><tbody><tr><th>Radians</th><td>0</td><td>π/6</td><td>π/4</td><td>π/3</td><td>π/2</td></tr><tr><th>sin θ</th><td>0</td><td>1/2</td><td>√2/2</td><td>√3/2</td><td>1</td></tr><tr><th>cos θ</th><td>1</td><td>√3/2</td><td>√2/2</td><td>1/2</td><td>0</td></tr><tr><th>tan θ</th><td>0</td><td>√3/3</td><td>1</td><td>√3</td><td>undefined</td></tr><tr><th>csc θ</th><td>undefined</td><td>2</td><td>√2</td><td>2√3/3</td><td>1</td></tr><tr><th>sec θ</th><td>1</td><td>2√3/3</td><td>√2</td><td>2</td><td>undefined</td></tr><tr><th>cot θ</th><td>undefined</td><td>√3</td><td>1</td><td>√3/3</td><td>0</td></tr></tbody></table>`;

  function lesson(title, idea, example, kind) {
    return `<p>${idea}</p><div class="key"><p><strong>Remember:</strong> Start with a picture. Then use the numbers to describe what the picture is doing.</p></div><h2>Worked example</h2><p>${example}</p>${kind === "trig" || kind === "trigtable" ? trigReference : ""}<div class="game"><p>Games and graphics use this idea to place objects, move characters, turn cameras, and draw shapes.</p></div><p><a class="btn goto-sim" href="#/${title}/sim">Try the playground →</a></p>`;
  }

  function mount(kind) {
    return (sim) => {
      const { stage, controls, readout } = sim.layout({ side: "bottom" });
      const out = sim.readout(readout);
      if (kind === "space") {
        const v = sim.view3d(stage, { height: 380, distance: 8, yaw: .7, pitch: .35 });
        const x = sim.slider(controls, { label: "x: sideways", min: -3, max: 3, step: 1, value: 2, onInput: () => v.redraw() });
        const y = sim.slider(controls, { label: "y: up / down", min: -3, max: 3, step: 1, value: 1, onInput: () => v.redraw() });
        const z = sim.slider(controls, { label: "z: forward / back", min: -3, max: 3, step: 1, value: -2, onInput: () => v.redraw() });
        v.onDraw((view) => { const p = [x.value, y.value, z.value]; view.grid({ size: 5, step: 1 }); view.axes({ length: 3 }); view.arrow([0, 0, 0], p, { color: "a", label: "place" }); view.sphere(p, .22, { fill: "a" }); out.set(sim.rows([["point", `(${x.value}, ${y.value}, ${z.value})`], ["x", "sideways"], ["y", "up / down"], ["z", "forward / back"]])); });
        return;
      }
      if (kind === "numbertypes") {
        const v = sim.view2d(stage, { range: 6, height: 330 });
        const pick = sim.select(controls, { label: "Choose a number", options: [["5", "5"], ["0", "0"], ["-3", "−3"], ["0.75", "0.75 = 3/4"], ["pi", "π (pi)"], ["sqrt2", "√2"]], value: "5", onChange: () => v.redraw() });
        const facts = { "5": [5, "Natural • Whole • Integer • Rational • Prime", "5 can be written as 5/1."], "0": [0, "Whole • Integer • Rational", "Zero is whole, but it is not a natural counting number in every convention."], "-3": [-3, "Integer • Rational", "Negative numbers are useful for temperatures, debts, and directions."], "0.75": [.75, "Rational", "0.75 is exactly 3/4."], pi: [Math.PI, "Irrational", "π keeps going forever without repeating, so it is not a simple fraction."], sqrt2: [Math.SQRT2, "Irrational", "√2 cannot be written as one exact fraction."] };
        v.onDraw((view) => { const [n, family, note] = facts[pick.value]; view.grid({ step: 1 }); view.axes({ ticks: true }); view.point([n, 0], { color: "a", r: 9, label: pick.value === "pi" ? "π" : pick.value === "sqrt2" ? "√2" : String(n) }); out.set(sim.rows([["number", pick.value], ["number family", family]]) + `<hr><p>${note}</p>`); });
        return;
      }
      if (kind === "solid") {
        const v = sim.view3d(stage, { height: 390, distance: 8, yaw: .7, pitch: .35 });
        const shape = sim.select(controls, { label: "Solid shape", options: [["cube", "Cube"], ["cuboid", "Cuboid / box"], ["cylinder", "Cylinder"], ["cone", "Cone"], ["sphere", "Sphere"], ["hemisphere", "Hemisphere"]], value: "cube", onChange: () => v.redraw() });
        const a = sim.slider(controls, { label: "Size a / radius r", min: 1, max: 4, step: .1, value: 2, onInput: () => v.redraw() });
        const h = sim.slider(controls, { label: "Height h / length l", min: 1, max: 5, step: .1, value: 3, onInput: () => v.redraw() });
        v.onDraw((view) => { const r = a.value, height = h.value, pi = Math.PI; view.grid({ size: 7, step: 1 }); view.axes({ length: 2 }); let volume, area, formula;
          if (shape.value === "cube") { view.box([-r / 2, -r / 2, -r / 2], [r / 2, r / 2, r / 2], { color: "a", fill: "a", alpha: .45 }); volume = r ** 3; area = 6 * r ** 2; formula = "V = a³"; }
          else if (shape.value === "cuboid") { view.box([-r, -height / 3, -r / 2], [r, height / 3, r / 2], { color: "a", fill: "a", alpha: .45 }); volume = 2 * r * height * r; area = 2 * (2 * r * height + 2 * r * r + height * r); formula = "V = l × w × h"; }
          else if (shape.value === "cylinder") { view.mesh(roundMesh(r, height), { fill: "a", alpha: .55, lit: true }); volume = pi * r ** 2 * height; area = 2 * pi * r * (r + height); formula = "V = πr²h"; }
          else if (shape.value === "cone") { view.mesh(roundMesh(r, height, true), { fill: "a", alpha: .55, lit: true }); volume = pi * r ** 2 * height / 3; area = pi * r * (r + Math.hypot(r, height)); formula = "V = ⅓πr²h"; }
          else if (shape.value === "sphere") { view.sphere([0, 0, 0], r, { fill: "a", alpha: .6 }); volume = 4 * pi * r ** 3 / 3; area = 4 * pi * r ** 2; formula = "V = ⁴⁄₃πr³"; }
          else { view.mesh(roundMesh(r, height, false, true), { fill: "a", alpha: .6, lit: true }); volume = 2 * pi * r ** 3 / 3; area = 3 * pi * r ** 2; formula = "V = ²⁄₃πr³"; }
          out.set(sim.rows([["formula", formula], ["volume", fmt(volume, 2) + " cubic units"], ["surface area", fmt(area, 2) + " square units"]])); });
        return;
      }
      const v = sim.view2d(stage, { range: 5, height: 360 });
      const isTurn = kind === "angle" || kind === "trig" || kind === "radian" || kind === "trigtable";
      const a = sim.slider(controls, { label: isTurn ? "θ (theta)" : kind === "ratio" ? "Blue parts" : "First number", min: isTurn ? 0 : kind === "ratio" ? 1 : -5, max: isTurn ? 360 : 8, step: 1, value: isTurn ? 45 : kind === "ratio" ? 2 : 3, unit: isTurn ? "°" : "", onInput: () => v.redraw() });
      if (kind === "trig" || kind === "trigtable") sim.select(controls, { label: "Special angle", options: [["0", "0°"], ["30", "30° = π/6"], ["45", "45° = π/4"], ["60", "60° = π/3"], ["90", "90° = π/2"]], value: "45", onChange: (value) => { a.value = +value; v.redraw(); } });
      const b = sim.slider(controls, { label: isTurn ? "Circle size" : kind === "ratio" ? "Yellow parts" : "Second number", min: 1, max: 8, step: 1, value: kind === "ratio" ? 3 : 4, onInput: () => v.redraw() });
      const flatShape = kind === "flatshape" ? sim.select(controls, { label: "Flat shape", options: [["square", "Square"], ["rectangle", "Rectangle"], ["triangle", "Triangle"], ["circle", "Circle"], ["parallelogram", "Parallelogram"], ["trapezoid", "Trapezoid"]], value: "rectangle", onChange: () => v.redraw() }) : null;
      v.onDraw((view) => {
        view.grid({ step: 1 }); view.axes({ ticks: true });
        if (kind === "fraction") { const n = Math.max(0, Math.min(8, a.value + 5)); for (let i = 0; i < 8; i++) view.rect([-4 + i, -1], [-3.1 + i, 1], { color: i < n ? "a" : "muted", fill: i < n ? "a" : "panel", fillAlpha: .45 }); out.set(sim.rows([["coloured parts", `${n} out of 8`], ["fraction", `${n}/8`], ["percentage", `${n * 12.5}%`]])); }
        else if (kind === "ratio") { const total = a.value + b.value; for (let i = 0; i < total; i++) view.circle([-4 + (i % 8) * 1.05, i < 8 ? .7 : -.9], .36, { color: i < a.value ? "a" : "g", fill: i < a.value ? "a" : "g", fillAlpha: .65 }); out.set(sim.rows([["blue : yellow", `${a.value} : ${b.value}`], ["total parts", total], ["recipe idea", `for every ${a.value} blue, use ${b.value} yellow`]])); }
        else if (kind === "flatshape") { const w = Math.max(1, a.value + 2), h = b.value; let area, perimeter, formula; const shape = flatShape.value;
          if (shape === "square") { view.rect([-w / 2, -w / 2], [w / 2, w / 2], { color: "a", fill: "a", fillAlpha: .22 }); area = w * w; perimeter = 4 * w; formula = "area = side × side"; }
          else if (shape === "rectangle") { view.rect([-w / 2, -h / 2], [w / 2, h / 2], { color: "a", fill: "a", fillAlpha: .22 }); area = w * h; perimeter = 2 * (w + h); formula = "area = width × height"; }
          else if (shape === "triangle") { view.polygon([[-w / 2, -h / 2], [w / 2, -h / 2], [-w / 2, h / 2]], { color: "a", fill: "a", fillAlpha: .22 }); area = w * h / 2; perimeter = w + h + Math.hypot(w, h); formula = "area = ½ × base × height"; }
          else if (shape === "circle") { view.circle([0, 0], w / 2, { color: "a", fill: "a", fillAlpha: .22 }); area = Math.PI * (w / 2) ** 2; perimeter = 2 * Math.PI * (w / 2); formula = "area = πr²"; }
          else if (shape === "parallelogram") { view.polygon([[-w / 2 - 1, -h / 2], [w / 2 - 1, -h / 2], [w / 2 + 1, h / 2], [-w / 2 + 1, h / 2]], { color: "a", fill: "a", fillAlpha: .22 }); area = w * h; perimeter = 2 * (w + Math.hypot(h, 2)); formula = "area = base × height"; }
          else { const top = w / 2; view.polygon([[-w / 2, -h / 2], [w / 2, -h / 2], [top / 2, h / 2], [-top / 2, h / 2]], { color: "a", fill: "a", fillAlpha: .22 }); area = (w + top) * h / 2; perimeter = w + top + 2 * Math.hypot((w - top) / 2, h); formula = "area = ½ × (top + bottom) × height"; }
          out.set(sim.rows([["formula", formula], ["area", fmt(area, 2) + " square units"], ["perimeter", fmt(perimeter, 2) + " units"]])); }
        else if (kind === "point") { view.point([a.value, b.value - 4], { color: "a", r: 9, label: `(${a.value}, ${b.value - 4})` }); out.set(sim.rows([["x", a.value], ["y", b.value - 4], ["address", `(${a.value}, ${b.value - 4})`]])); }
        else if (kind === "distance") { view.point([a.value, 0], { color: "a", label: "A" }); view.point([b.value - 4, 0], { color: "c", label: "B" }); view.line([a.value, 0], [b.value - 4, 0], { color: "g", width: 3 }); out.set(sim.rows([["distance", Math.abs(a.value - (b.value - 4))], ["meaning", "how far apart A and B are"]])); }
        else if (kind === "area") { const w = Math.max(1, a.value + 2), h = b.value; view.rect([-w / 2, -h / 2], [w / 2, h / 2], { color: "a", fill: "a", fillAlpha: .2 }); out.set(sim.rows([["width", w], ["height", h], ["area", `${w} × ${h} = ${w * h}`], ["perimeter", `2 × (${w} + ${h}) = ${2 * (w + h)}`]])); }
        else if (kind === "triangle") { const x = Math.max(1, a.value + 2), y = b.value; view.polygon([[0, 0], [x, 0], [0, y]], { color: "a", fill: "a", fillAlpha: .18 }); const hyp = Math.hypot(x, y); out.set(sim.rows([["short sides", `${x} and ${y}`], ["longest side", fmt(hyp)], ["check", `${x}² + ${y}² = ${x * x + y * y}`]])); }
        else if (kind === "angle" || kind === "trig" || kind === "radian" || kind === "trigtable") { const t = rad(a.value), r = b.value * .45, sin = Math.sin(t), cos = Math.cos(t), tan = sin / cos; view.circle([0, 0], r, { color: "a" }); view.arrow([0, 0], [r * cos, r * sin], { color: "e", label: "θ" }); view.line([r * cos, 0], [r * cos, r * sin], { color: "c", dash: [5, 4] }); const rows = [["degrees", `${a.value}°`], ["radians", fmt(t, 2)], ["sin θ", fmt(sin, 2)], ["cos θ", fmt(cos, 2)], ["tan θ", Math.abs(cos) < .0001 ? "undefined" : fmt(tan, 2)]]; if (kind === "trig" || kind === "trigtable") rows.push(["csc θ", Math.abs(sin) < .0001 ? "undefined" : fmt(1 / sin, 2)], ["sec θ", Math.abs(cos) < .0001 ? "undefined" : fmt(1 / cos, 2)], ["cot θ", Math.abs(sin) < .0001 ? "undefined" : fmt(cos / sin, 2)]); out.set(sim.rows(rows)); }
        else { view.arrow([0, 0], [a.value, 0], { color: "a", label: "start" }); view.arrow([a.value, 0], [a.value + b.value, 0], { color: "c", label: "change" }); out.set(sim.rows([["first number", a.value], ["second number", b.value], ["together", a.value + b.value]])); }
      });
    };
  }

  function cppFor(id) {
    const code = {
      "BM2.4": [{ title: "Pythagoras: longest side", formula: String.raw`c=\sqrt{a^2+b^2}`, note: "<p><strong>Give:</strong> the two short sides <code>a</code> and <code>b</code>. The returned <code>c</code> is the longest side.</p>", code: String.raw`
float RightTriangleHypotenuse(float a, float b)
{
    return std::sqrt(a * a + b * b);
}` }],
      "BM2.5": [{ title: "Make a 3D point from angles", formula: String.raw`x=r\cos\phi\cos\theta,\;y=r\sin\phi,\;z=r\cos\phi\sin\theta`, note: "<p><strong>Give:</strong> distance from the centre, theta (left/right) in degrees, and elevation (up/down) in degrees. C++ sine and cosine need radians, so the code converts first.</p>", code: String.raw`
Point3D PointFromAngles(float radius, float thetaDegrees, float elevationDegrees)
{
    constexpr float kPi = 3.14159265358979323846f;
    const float theta = thetaDegrees * kPi / 180.0f;
    const float elevation = elevationDegrees * kPi / 180.0f;
    return Point3D(radius * std::cos(elevation) * std::cos(theta),
                   radius * std::sin(elevation),
                   radius * std::cos(elevation) * std::sin(theta));
}` }],
      "BM2.6": [{ title: "Area of flat shapes", formula: String.raw`A_{rectangle}=wh,\quad A_{triangle}=\frac12bh,\quad A_{circle}=\pi r^2`, note: "<p><strong>Give:</strong> width and height, base and height, or radius depending on the shape.</p>", code: String.raw`
constexpr float kPi = 3.14159265358979323846f;
float RectangleArea(float width, float height) { return width * height; }
float TriangleArea(float base, float height) { return 0.5f * base * height; }
float CircleArea(float radius) { return kPi * radius * radius; }` }],
      "BM2.7": [{ title: "Volume of 3D shapes", formula: String.raw`V_{cube}=a^3,\quad V_{cylinder}=\pi r^2h,\quad V_{sphere}=\frac43\pi r^3`, note: "<p><strong>Give:</strong> a side for a cube, radius and height for a cylinder, or radius for a sphere.</p>", code: String.raw`
constexpr float kPi = 3.14159265358979323846f;
float CubeVolume(float side) { return side * side * side; }
float CylinderVolume(float radius, float height) { return kPi * radius * radius * height; }
float SphereVolume(float radius) { return 4.0f * kPi * radius * radius * radius / 3.0f; }` }],
      "BM3.1": [{ title: "Degrees to radians", formula: String.raw`radians=degrees\times\frac{\pi}{180}`, note: "<p><strong>Give:</strong> an angle in degrees, such as <code>90</code>. C++ <code>sin</code> and <code>cos</code> expect radians.</p>", code: String.raw`
float DegreesToRadians(float degrees)
{
    constexpr float kPi = 3.14159265358979323846f;
    return degrees * kPi / 180.0f;
}` }],
      "BM3.3": [{ title: "Theta to a 2D direction", formula: String.raw`x=\cos\theta,\quad y=\sin\theta`, note: "<p><strong>Give:</strong> theta in degrees. The result is a direction arrow of length 1.</p>", code: String.raw`
Vector2D DirectionFromTheta(float thetaDegrees)
{
    constexpr float kPi = 3.14159265358979323846f;
    const float theta = thetaDegrees * kPi / 180.0f;
    return Vector2D(std::cos(theta), std::sin(theta));
}` }],
      "BM3.4": [{ title: "Convert degrees and radians", formula: String.raw`radians=degrees\frac{\pi}{180},\quad degrees=radians\frac{180}{\pi}`, note: "<p><strong>Give:</strong> a value and make sure you know its unit. Name variables <code>degrees</code> or <code>radians</code> to avoid mistakes.</p>", code: String.raw`
constexpr float kPi = 3.14159265358979323846f;
float DegreesToRadians(float degrees) { return degrees * kPi / 180.0f; }
float RadiansToDegrees(float radians) { return radians * 180.0f / kPi; }` }],
      "BM3.5": [{ title: "All six trig ratios", formula: String.raw`\csc\theta=\frac1{\sin\theta},\quad\sec\theta=\frac1{\cos\theta},\quad\cot\theta=\frac{\cos\theta}{\sin\theta}`, note: "<p><strong>Give:</strong> theta in degrees. At a zero denominator, the matching reciprocal ratio is undefined; this beginner code returns 0.</p>", code: String.raw`
struct TrigRatios { float sin, cos, tan, csc, sec, cot; };
TrigRatios AllTrigRatios(float thetaDegrees)
{
    constexpr float kPi = 3.14159265358979323846f;
    const float theta = thetaDegrees * kPi / 180.0f;
    const float s = std::sin(theta), c = std::cos(theta);
    return { s, c, std::abs(c) < 0.00001f ? 0.0f : s / c,
             std::abs(s) < 0.00001f ? 0.0f : 1.0f / s,
             std::abs(c) < 0.00001f ? 0.0f : 1.0f / c,
             std::abs(s) < 0.00001f ? 0.0f : c / s };
}` }],
    };
    return code[id] || [];
  }

  Object.entries(info).forEach(([id, [title, idea, example, kind]]) => L3D.topic({
    id, summary: idea, lesson: lesson(id, idea, example, kind), keyFormulas: [["Easy rule", kind === "triangle" ? String.raw`a^2 + b^2 = c^2` : kind === "radian" ? String.raw`180^\circ = \pi\text{ radians}` : "picture + numbers = a useful answer"]], exercises: [{ q: `Explain ${title.toLowerCase()} in your own words.`, a: example }, { q: "What happens when you change one value in the playground?", a: "The picture and the answer change together." }], sims: [{ title: `${title} playground`, help: `<p>${example} Change the controls and watch the picture and numbers together.</p>`, mount: mount(kind) }], cpp: cppFor(id)
  }));
})();
