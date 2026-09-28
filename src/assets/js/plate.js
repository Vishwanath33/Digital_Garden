/**
 * Plate I: the Lorenz attractor, as a running experiment, set as a figure
 * inside an entry. (The site's background is a separate, quieter drawing
 * in lorenz.js; this one is the instrument.)
 *
 *   dx/dt = σ(y − x)      σ = 10
 *   dy/dt = x(ρ − z) − y  ρ = 28
 *   dz/dt = xy − βz       β = 8/3
 *
 * Three trajectories — a, b and c — start from the same point on the
 * attractor, b and c displaced by ±10⁻⁵ in z. Drawn in three colours with
 * additive light, they read as one bright line while they agree, then
 * split into three. The caption reports the separation between a and b and
 * plots its logarithm as a sparkline: exponential growth is a straight line
 * on a log scale, so its slope is the Lyapunov exponent made visible.
 *
 * Integrated with RK4 at a fixed step, so the figure is the real attractor.
 * No dependencies.
 */
(() => {
  "use strict";

  const plate = document.querySelector("[data-plate]");
  const canvas = plate?.querySelector("[data-plate-canvas]");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const SIGMA = 10;
  const RHO = 28;
  const BETA = 8 / 3;
  const DT = 0.005;
  const STEPS_PER_FRAME = 4;       // ≈ 1.2 time units per second at 60 fps
  const D0 = 1e-5;                 // the initial disagreement
  const SMALL = window.matchMedia("(max-width: 48rem)").matches;
  const TRAIL = SMALL ? 2200 : 4800;
  const CHUNKS = 40;
  const Z_CENTER = 25.5;
  const SPARK_EVERY = 0.2;         // time units between sparkline samples
  const SPARK_UNTIL = 36;          // Δ has long saturated by then

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // --- dynamics -------------------------------------------------------------
  const deriv = (s, o) => {
    o[0] = SIGMA * (s[1] - s[0]);
    o[1] = s[0] * (RHO - s[2]) - s[1];
    o[2] = s[0] * s[1] - BETA * s[2];
  };
  const k1 = [0, 0, 0], k2 = [0, 0, 0], k3 = [0, 0, 0], k4 = [0, 0, 0], tmp = [0, 0, 0];
  const step = (s) => {
    deriv(s, k1);
    for (let i = 0; i < 3; i++) tmp[i] = s[i] + (DT / 2) * k1[i];
    deriv(tmp, k2);
    for (let i = 0; i < 3; i++) tmp[i] = s[i] + (DT / 2) * k2[i];
    deriv(tmp, k3);
    for (let i = 0; i < 3; i++) tmp[i] = s[i] + DT * k3[i];
    deriv(tmp, k4);
    for (let i = 0; i < 3; i++) s[i] += (DT / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  };

  // A point that has settled onto the attractor; each run starts further on.
  const base = [1, 1, 1.05];
  for (let i = 0; i < 3000; i++) step(base);

  // The atlas: one long trajectory that traces out the whole attractor,
  // drawn faintly behind the live run so the figure is complete from the
  // first frame. Rendered to its own canvas, and redrawn only when the view
  // has turned enough to notice.
  const ATLAS_N = SMALL ? 9000 : 16000;
  const atlas = { xs: new Float32Array(ATLAS_N), ys: new Float32Array(ATLAS_N), zs: new Float32Array(ATLAS_N) };
  {
    const s = base.slice();
    for (let i = 0; i < ATLAS_N; i++) {
      step(s); step(s);
      atlas.xs[i] = s[0]; atlas.ys[i] = s[1]; atlas.zs[i] = s[2];
    }
  }
  const atlasCanvas = document.createElement("canvas");
  const atlasCtx = atlasCanvas.getContext("2d");
  let atlasTheta = NaN;

  const makeTrajectory = (key) => ({
    key,
    state: [0, 0, 0],
    xs: new Float32Array(TRAIL),
    ys: new Float32Array(TRAIL),
    zs: new Float32Array(TRAIL),
    head: 0,
    filled: 0,
  });
  const trajectories = ["a", "b", "c"].map(makeTrajectory);
  const [A, B] = trajectories;

  let t = 0;
  let spark = [];
  let nextSpark = 0;

  const separation = () =>
    Math.hypot(A.state[0] - B.state[0], A.state[1] - B.state[1], A.state[2] - B.state[2]);

  /** Begin a new run from a fresh point on the attractor. */
  const seed = () => {
    for (let i = 0; i < 700; i++) step(base);
    const offsets = [0, D0, -D0];
    trajectories.forEach((tr, i) => {
      tr.state[0] = base[0];
      tr.state[1] = base[1];
      tr.state[2] = base[2] + offsets[i];
      tr.head = 0;
      tr.filled = 0;
    });
    t = 0;
    spark = [];
    nextSpark = 0;
  };

  const advance = (steps) => {
    for (let s = 0; s < steps; s++) {
      for (const tr of trajectories) {
        step(tr.state);
        tr.xs[tr.head] = tr.state[0];
        tr.ys[tr.head] = tr.state[1];
        tr.zs[tr.head] = tr.state[2];
        tr.head = (tr.head + 1) % TRAIL;
        if (tr.filled < TRAIL) tr.filled++;
      }
      t += DT;
      if (t >= nextSpark && t <= SPARK_UNTIL) {
        spark.push(Math.log10(Math.max(separation(), 1e-12)));
        nextSpark += SPARK_EVERY;
      }
    }
  };

  // --- viewport -------------------------------------------------------------
  const caption = plate.querySelector("[data-plate-caption]");
  const bar = plate.querySelector("[data-plate-bar]");
  let W = 0, H = 0, dpr = 1, scale = 1, cx = 0, cy = 0;
  // Start sharp; the frame budget lowers this first if drawing is slow.
  let dprCap = 1.5;

  const resize = () => {
    const r = plate.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // Draw in the space the caption and the top bar leave free.
    const top = bar ? bar.offsetHeight : 0;
    const bottom = caption ? caption.offsetHeight : 0;
    const areaH = Math.max(80, H - top - bottom);
    // Rocking ±0.4 rad about face-on, the figure is up to ~60 units wide and
    // ~46 tall; fit the widest angle so the lobes never leave the plate.
    scale = Math.min((W * 0.95) / 60, (areaH * 0.96) / 47);
    atlasCanvas.width = canvas.width;
    atlasCanvas.height = canvas.height;
    atlasTheta = NaN;
    cx = W / 2;
    cy = top + areaH / 2;
  };

  // --- colour, from the stylesheet ------------------------------------------
  let colors = {};
  const readColors = () => {
    const s = getComputedStyle(document.documentElement);
    const v = (n, d) => (s.getPropertyValue(n) || "").trim() || d;
    colors = {
      a: v("--plate-traj-a", "243, 234, 216"),
      b: v("--plate-traj-b", "255, 107, 61"),
      c: v("--plate-traj-c", "63, 193, 181"),
      glow: v("--plate-glow", "1"),
    };
  };

  // --- projection -----------------------------------------------------------
  // On the attractor x ≈ y, so the figure is nearly planar with its face
  // along x = y; θ = −π/4 looks straight at it. The view rocks either side
  // rather than revolving, which would pass through an edge-on sliver.
  const FACE_ON = -Math.PI / 4;
  const SWING = 0.4;
  const RATE = 0.0014;
  let phase = 0;
  let theta = FACE_ON;
  let cos = Math.cos(FACE_ON), sin = Math.sin(FACE_ON);

  // --- drawing --------------------------------------------------------------
  let quality = 1;

  const HALO = 14;
  const halos = {};
  const halo = (key) => {
    if (halos[key]) return halos[key];
    const size = HALO * 2 * 2; // drawn at 2x for sharpness, stamped at 1x
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${colors[key]}, 1)`);
    grad.addColorStop(0.16, `rgba(${colors[key]}, 1)`);
    grad.addColorStop(0.24, `rgba(${colors[key]}, 0.45)`);
    grad.addColorStop(1, `rgba(${colors[key]}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return (halos[key] = c);
  };

  const drawTrajectory = (tr) => {
    const n = Math.floor(tr.filled * quality);
    if (n < 2) return;
    const oldest = (tr.head - tr.filled + TRAIL) % TRAIL;
    const offset = tr.filled - n;
    const per = Math.ceil(n / CHUNKS);
    const rgb = colors[tr.key];

    for (let c = 0; c < CHUNKS; c++) {
      const start = offset + c * per;
      const end = Math.min(tr.filled - 1, start + per);
      if (start >= end) continue;
      const age = (c + 1) / CHUNKS;           // 0 oldest … 1 the moving head
      let depth = 0;
      ctx.beginPath();
      for (let i = start; i <= end; i++) {
        const k = (oldest + i) % TRAIL;
        const x = tr.xs[k], y = tr.ys[k];
        const sx = cx + (x * cos - y * sin) * scale;
        const sy = cy - (tr.zs[k] - Z_CENTER) * scale;
        depth += x * sin + y * cos;
        if (i === start) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      const near = 0.5 + 0.5 * Math.tanh(depth / (end - start + 1) / 14);
      const alpha = (0.12 + 0.88 * Math.pow(age, 1.5)) * (0.5 + 0.5 * near) * 0.85;
      ctx.strokeStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
      ctx.lineWidth = (0.8 + 1.0 * near) * (0.75 + 0.55 * age);
      ctx.stroke();
    }

    // The moving point, with a halo stamped from a pre-rendered sprite
    // (shadowBlur looks the same and costs half the frame rate).
    const k = (tr.head - 1 + TRAIL) % TRAIL;
    const hx = cx + (tr.xs[k] * cos - tr.ys[k] * sin) * scale;
    const hy = cy - (tr.zs[k] - Z_CENTER) * scale;
    const sprite = halo(tr.key);
    ctx.drawImage(sprite, hx - HALO, hy - HALO, HALO * 2, HALO * 2);
  };

  const drawAtlas = () => {
    if (Math.abs(theta - atlasTheta) < 0.004) return;
    atlasTheta = theta;
    const a = atlasCtx;
    a.setTransform(dpr, 0, 0, dpr, 0, 0);
    a.clearRect(0, 0, W, H);
    a.lineJoin = "round";
    a.strokeStyle = `rgba(${colors.a}, 0.13)`;
    a.lineWidth = 0.75;
    a.beginPath();
    for (let i = 0; i < ATLAS_N; i++) {
      const x = atlas.xs[i], y = atlas.ys[i];
      const sx = cx + (x * cos - y * sin) * scale;
      const sy = cy - (atlas.zs[i] - Z_CENTER) * scale;
      if (i) a.lineTo(sx, sy);
      else a.moveTo(sx, sy);
    }
    a.stroke();
  };

  const render = () => {
    drawAtlas();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(atlasCanvas, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // Additive light: where the three agree they sum to white.
    ctx.globalCompositeOperation = "lighter";
    for (const tr of trajectories) drawTrajectory(tr);
    ctx.globalCompositeOperation = "source-over";
  };

  // --- the caption's readout ------------------------------------------------
  const out = {};
  plate.querySelectorAll("[data-readout]").forEach((el) => (out[el.dataset.readout] = el));
  const sparkCanvas = plate.querySelector("[data-spark]");
  const sparkCtx = sparkCanvas?.getContext("2d");

  const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const sci = (v) => {
    if (v >= 0.1) return v.toFixed(v >= 10 ? 1 : 2);
    let e = Math.floor(Math.log10(v));
    let m = (v / 10 ** e).toFixed(1);
    if (m === "10.0") { m = "1.0"; e += 1; }   // 9.96 rounds up a decade
    return `${m} × 10${String(e).replace(/./g, (ch) => SUP[ch] || ch)}`;
  };
  // Figure spaces keep the columns still as the signs and digits change.
  const num = (v) => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`.padStart(6, " ");

  const drawSpark = () => {
    if (!sparkCtx) return;
    const r = sparkCanvas.getBoundingClientRect();
    const sd = Math.min(window.devicePixelRatio || 1, 2);
    if (sparkCanvas.width !== Math.round(r.width * sd)) {
      sparkCanvas.width = Math.round(r.width * sd);
      sparkCanvas.height = Math.round(r.height * sd);
    }
    const w = r.width, h = r.height;
    sparkCtx.setTransform(sd, 0, 0, sd, 0, 0);
    sparkCtx.clearRect(0, 0, w, h);
    const total = SPARK_UNTIL / SPARK_EVERY;
    const lo = -5.5, hi = 1.8;             // log10 Δ: from 10⁻⁵ to the attractor's width
    const X = (i) => 1 + (i / total) * (w - 4);
    const Y = (v) => h - 1.5 - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (h - 3);
    // Baseline: the initial disagreement.
    sparkCtx.strokeStyle = `rgba(${colors.a}, 0.22)`;
    sparkCtx.lineWidth = 1;
    sparkCtx.beginPath();
    sparkCtx.moveTo(0, Y(-5));
    sparkCtx.lineTo(w, Y(-5));
    sparkCtx.stroke();
    if (spark.length < 2) return;
    sparkCtx.strokeStyle = `rgb(${colors.b})`;
    sparkCtx.lineWidth = 1.2;
    sparkCtx.beginPath();
    spark.forEach((v, i) => (i ? sparkCtx.lineTo(X(i), Y(v)) : sparkCtx.moveTo(X(i), Y(v))));
    sparkCtx.stroke();
    const last = spark.length - 1;
    sparkCtx.fillStyle = `rgb(${colors.b})`;
    sparkCtx.beginPath();
    sparkCtx.arc(X(last), Y(spark[last]), 1.8, 0, Math.PI * 2);
    sparkCtx.fill();
  };

  const readout = () => {
    if (out.t) out.t.textContent = t.toFixed(2).padStart(6, " ");
    if (out.x) out.x.textContent = num(A.state[0]);
    if (out.y) out.y.textContent = num(A.state[1]);
    if (out.z) out.z.textContent = num(A.state[2]);
    if (out.delta) out.delta.textContent = sci(separation());
    drawSpark();
  };

  // --- loop -----------------------------------------------------------------
  let running = false;
  let userPaused = false;
  let visible = true;
  let frame = 0;
  let frames = 0;
  let samples = 0, elapsed = 0, lastFrame = 0;

  // If frames get expensive, give up what the reader will least notice
  // first: resolution, then trail length; and if even that is not enough,
  // stop, leaving a still figure. A figure should never make reading slow.
  const budget = (now) => {
    if (lastFrame) { elapsed += now - lastFrame; samples++; }
    lastFrame = now;
    if (samples < 90) return;
    const avg = elapsed / samples;
    samples = 0; elapsed = 0;
    if (avg > 21 && dprCap > 1 && (window.devicePixelRatio || 1) > 1) { dprCap = 1; resize(); }
    else if (avg > 26 && quality > 0.3) quality = Math.max(0.3, quality * 0.65);
    else if (avg > 45) { userPaused = true; stop(); render(); }
  };

  const tick = (now) => {
    if (!running) return;
    budget(now);
    advance(STEPS_PER_FRAME);
    phase += RATE;
    theta = FACE_ON + SWING * Math.sin(phase);
    cos = Math.cos(theta);
    sin = Math.sin(theta);
    render();
    if (++frames % 4 === 0) readout();
    frame = requestAnimationFrame(tick);
  };

  const announce = () => {
    const btn = plate.querySelector("[data-plate-toggle]");
    if (btn) {
      btn.textContent = running || (!userPaused && !reduceMotion.matches) ? "Pause" : "Play";
      btn.setAttribute("aria-pressed", String(userPaused));
    }
    document.dispatchEvent(new CustomEvent("platechange", { detail: { running } }));
  };

  const shouldRun = () => !userPaused && visible && !document.hidden && !reduceMotion.matches;

  const start = () => {
    if (running || !shouldRun()) return;
    running = true;
    lastFrame = 0; samples = 0; elapsed = 0;
    frame = requestAnimationFrame(tick);
    announce();
  };

  const stop = () => {
    const was = running;
    running = false;
    cancelAnimationFrame(frame);
    if (was) announce();
  };

  /** Under reduced motion: run the experiment out of sight, show the result. */
  const still = () => {
    advance(Math.round(30 / DT));
    render();
    readout();
  };

  const rerun = () => {
    seed();
    if (reduceMotion.matches) still();
    else { render(); readout(); start(); }
  };

  // --- wiring ---------------------------------------------------------------
  plate.querySelector("[data-plate-toggle]")?.addEventListener("click", () => {
    userPaused = !userPaused;
    if (userPaused) stop();
    else start();
    announce();
  });
  plate.querySelector("[data-plate-rerun]")?.addEventListener("click", () => {
    if (userPaused) { userPaused = false; }
    rerun();
    announce();
  });

  new ResizeObserver(() => {
    resize();
    if (!running) render();
    drawSpark();
  }).observe(plate);

  // Off screen (a phone scrolled past the plate) or in a hidden tab: rest.
  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    visible ? start() : stop();
  }).observe(plate);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

  document.addEventListener("themechange", () =>
    requestAnimationFrame(() => {
      readColors();
      for (const k of Object.keys(halos)) delete halos[k];
      atlasTheta = NaN;
      if (!running) render();
      drawSpark();
    }),
  );
  reduceMotion.addEventListener?.("change", () => {
    stop();
    rerun();
    announce();
  });

  readColors();
  resize();
  seed();
  if (reduceMotion.matches) still();
  else { render(); readout(); start(); }
  announce();

  window.__plate = {
    start() { userPaused = false; start(); announce(); },
    stop() { userPaused = true; stop(); announce(); },
    toggle() { plate.querySelector("[data-plate-toggle]")?.click(); return running; },
    rerun,
    get running() { return running; },
    get t() { return t; },
    get separation() { return separation(); },
    get sparkSamples() { return spark.length; },
  };
})();
