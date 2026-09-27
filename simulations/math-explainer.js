(() => {
  const topic = document.body.dataset.mathTopic;
  const lessons = {
    "graphics-processors": ["The GPU repeats the same small calculation for many vertices or pixels.", "number of parallel jobs = vertices or fragments waiting in the command buffer"],
    "vertex-transformation": ["Each point is multiplied by a matrix to describe it in a new coordinate space.", "p′ = Projection × View × Model × p"],
    "rasterization": ["A triangle becomes pixels by testing which pixel centres lie inside its three edges.", "visible pixel = nearest fragment after the depth test"],
    "buffers": ["A buffer is a numbered memory list. The GPU reads position, colour, and depth values from it.", "depth test: keep new fragment when newDepth < storedDepth"],
    "vector-properties": ["A vector is a direction and length written as components.", "length of (x, y, z) = √(x² + y² + z²)"],
    "orientation": ["The order of the axes decides whether a coordinate system is right- or left-handed.", "right-handed: x × y = z"],
    "orientation-3d": ["A coordinate system has an orientation: the order of its three axes matters.", "right-handed: x × y = z"],
    "dot-product": ["The dot product tells how much two vectors point in the same direction.", "a · b = axbx + ayby + azbz = |a||b| cos(θ)"],
    "cross-product": ["The cross product creates a vector perpendicular to both input vectors.", "a × b = (aybz − azby, azbx − axbz, axby − aybx)"],
    "gram-schmidt": ["Gram–Schmidt removes the part of a vector that points along an earlier basis vector.", "u₂ = v₂ − projᵤ₁(v₂), where projᵤ₁(v₂) = (v₂ · u₁ / u₁ · u₁)u₁"],
    "matrix-properties": ["Matrix multiplication combines transformations; each output cell is one row dotted with one column.", "Cᵢⱼ = Σ AᵢₖBₖⱼ"],
    "linear-systems": ["Row operations keep the same solution while making equations easier to read.", "[A | b] → [I | x]"],
    "matrix-inverses": ["The inverse reverses a transformation, when it exists.", "M × M⁻¹ = I; find it with [M | I] → [I | M⁻¹]"],
    "determinants": ["A determinant measures signed area (2D) or signed volume (3D). Zero means the shape has been flattened.", "det([[a,b],[c,d]]) = ad − bc"],
    "eigen": ["An eigenvector keeps its direction after a matrix transformation. Only its length changes.", "Mv = λv"],
    "diagonalization": ["Diagonalization changes into special axes, scales each axis, then changes back.", "M = SDS⁻¹  →  v → S⁻¹v → D(S⁻¹v) → S(D(S⁻¹v))"],
    "determinant-3d": ["Three vectors form a box-like shape. Its signed volume is the determinant; zero means the vectors lie on one flat plane.", "det(A) = a · (b × c)"],
  };
  const lesson = lessons[topic];
  if (!lesson) return;
  const number = (id) => Number(document.getElementById(id)?.value || 0);
  const fixed = (value) => Number(value).toFixed(2);
  const liveMath = () => {
    if (topic === "vector-properties") {
      const px=number("px"), py=number("py"), pz=number("pz"), qx=number("qx"), qy=number("qy"), qz=number("qz"), sx=px+qx, sy=py+qy, sz=pz+qz;
      return `P + Q = (${px}, ${py}, ${pz}) + (${qx}, ${qy}, ${qz}) = (${sx}, ${sy}, ${sz})<br>|P + Q| = √(${sx}² + ${sy}² + ${sz}²) = <b>${fixed(Math.hypot(sx, sy, sz))}</b>`;
    }
    if (topic === "dot-product") {
      const degrees=number("angleSlider"), cosine=Math.cos(degrees*Math.PI/180);
      return `θ = ${degrees}°<br>unit P · unit Q = cos(${degrees}°) = <b>${fixed(cosine)}</b>`;
    }
    if (topic === "determinants") {
      const a=number("m00"), b=number("m01"), c=number("m10"), d=number("m11");
      return `det(M) = (${a} × ${d}) − (${b} × ${c})<br>= ${a*d} − ${b*c} = <b>${fixed(a*d-b*c)}</b>`;
    }
    if (topic === "matrix-inverses") {
      const a=number("m00"),b=number("m01"),c=number("m02"),d=number("m10"),e=number("m11"),f=number("m12"),g=number("m20"),h=number("m21"),i=number("m22");
      const det=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
      return `det(M) = ${a}(${e}×${i} − ${f}×${h}) − ${b}(${d}×${i} − ${f}×${g}) + ${c}(${d}×${h} − ${e}×${g})<br>= <b>${fixed(det)}</b>${Math.abs(det)<1e-9 ? " — no inverse exists because the determinant is zero." : " — non-zero, so M has an inverse."}`;
    }
    if (topic === "linear-systems") {
      const eq=(row) => `${number(`a${row}0`)}x + ${number(`a${row}1`)}y + ${number(`a${row}2`)}z = ${number(`b${row}`)}`;
      return `Current system:<br>${eq(0)}<br>${eq(1)}<br>${eq(2)}<br>Press “Solve System” to watch these numbers become [I | x].`;
    }
    if (topic === "matrix-properties") {
      const a=number("matrixA_0_0"), b=number("matrixB_0_0"), s=number("scalar");
      return `First-cell examples with your current values:<br>Addition: C₀₀ = A₀₀ + B₀₀ = ${a} + ${b} = <b>${a+b}</b><br>Scaling: C₀₀ = sA₀₀ = ${s} × ${a} = <b>${s*a}</b>`;
    }
    if (topic === "determinant-3d") {
      const values=[...document.querySelectorAll("input")].map((input) => Number(input.value)||0);
      if (values.length < 9) return "Move a vector control to see the calculation.";
      const [ax,ay,az,bx,by,bz,cx,cy,cz]=values;
      const cross=[by*cz-bz*cy,bz*cx-bx*cz,bx*cy-by*cx]; const det=ax*cross[0]+ay*cross[1]+az*cross[2];
      return `b × c = (${fixed(cross[0])}, ${fixed(cross[1])}, ${fixed(cross[2])})<br>a · (b × c) = ${ax}×${fixed(cross[0])} + ${ay}×${fixed(cross[1])} + ${az}×${fixed(cross[2])} = <b>${fixed(det)}</b><br>Volume = |${fixed(det)}| = <b>${fixed(Math.abs(det))}</b>`;
    }
    if (topic === "eigen") {
      const degrees=number("angle"), r=degrees*Math.PI/180, x=Math.cos(r), y=Math.sin(r), mx=2*x+y, my=x+2*y;
      return `v = (cos ${degrees}°, sin ${degrees}°) = (${fixed(x)}, ${fixed(y)})<br>Mv = (2vₓ + vᵧ, vₓ + 2vᵧ) = (${fixed(mx)}, ${fixed(my)})`;
    }
    if (topic === "vertex-transformation") {
      const degrees=number("rotation"), distance=number("distance"), scale=5/distance;
      return `rotation = ${degrees}°, camera distance = ${fixed(distance)}<br>projection scale = 5 ÷ ${fixed(distance)} = <b>${fixed(scale)}</b>`;
    }
    if (topic === "rasterization") return `rotation = ${number("rotation")}°; face culling = ${document.getElementById("cull")?.checked ? "on" : "off"}; depth test = ${document.getElementById("depth")?.checked ? "on" : "off"}.`;
    const inputs=[...document.querySelectorAll("input, select")];
    if (inputs.length) return `Current controls: ${inputs.map((input) => `${input.id || input.name || "value"} = ${input.type === "checkbox" ? (input.checked ? "on" : "off") : input.value}`).join(", ")}`;
    const status=document.querySelector("#status, #result, #info, #alignmentInfo")?.textContent?.trim();
    return status ? `Current simulation result: ${status}` : "Use the simulation controls to see its current calculation state.";
  };
  const panel = document.createElement("details");
  panel.className = "math-explainer";
  panel.open = true;
  panel.innerHTML = `<summary>Live math working — changes with the simulation</summary><p>${lesson[0]}</p><code>${lesson[1]}</code><div class="math-live" aria-live="polite"></div>`;
  const style = document.createElement("style");
  style.textContent = `.math-explainer{max-width:960px;margin:22px auto 0;padding:14px 18px;text-align:left;background:rgba(14,165,233,.12);border:1px solid rgba(56,189,248,.5);border-radius:9px;line-height:1.55}.math-explainer summary{cursor:pointer;font-size:1.05rem;font-weight:700;color:inherit}.math-explainer p{margin:10px 0 7px}.math-explainer code,.math-live{display:block;overflow:auto;padding:9px 11px;border-radius:5px;background:rgba(2,6,23,.55);color:#7dd3fc;font-size:1rem}.math-live{margin-top:10px;background:rgba(2,6,23,.8);color:#f8fafc}`;
  document.head.append(style);
  document.body.append(panel);
  const output = panel.querySelector(".math-live");
  const update = () => { output.innerHTML = `<b>Calculation using the current values</b><br>${liveMath()}`; };
  document.addEventListener("input", update); document.addEventListener("change", update); document.addEventListener("click", () => setTimeout(update, 0));
  update();
})();
