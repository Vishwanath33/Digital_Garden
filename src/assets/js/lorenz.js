/**
 * The background: the Lorenz attractor, running behind the library.
 *
 *   dx/dt = σ(y − x)      σ = 10
 *   dy/dt = x(ρ − z) − y  ρ = 28
 *   dz/dt = xy − βz       β = 8/3
 *
 * A faint atlas — one long trajectory — draws the whole attractor, and
 * three live trajectories trace over it. They start a hundred-thousandth
 * apart and separate within seconds, which is the attractor's point, but
 * here it is simply scenery: no caption, no controls beyond a way to stop.
 *
 * Integrated with RK4 at a fixed step, so the shape is the real one. Colours
 * and blending come from the stylesheet, so each theme draws it its own way.
 * No dependencies.
 */
(() => {
  "use strict";

  const canvas = document.querySelector("[data-lorenz]");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const SIGMA = 10;
  const RHO = 28;
  const BETA = 8 / 3;
  const DT = 0.005;
  const STEPS_PER_FRAME = 3;         // unhurried: it is a background
  const SMALL = window.matchMedia("(max-width: 48rem)").matches;
  const TRAIL = SMALL ? 2200 : 4200;
  const ATLAS_N = SMALL ? 9000 : 16000;
  const CHUNKS = 40;
  const Z_CENTER = 25.5;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const MOTION_KEY = "library-motion";

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

  // A point that has settled onto the attractor.
  const base = [1, 1, 1.05];
  for (let i = 0; i < 3000; i++) step(base);

  // The atlas: the whole attractor, drawn once to its own canvas and redrawn
  // only when the slowly rocking view has turned enough to notice.
  const atlas = { xs: new Float32Array(ATLAS_N), ys: new Float32Array(ATLAS_N), zs: new Float32Array(ATLAS_N) };
  {
    const s = base.slice();
    for (let i = 0; i < ATLAS_N; i++) {
      step(s); step(s);
      atlas.xs[i] = s[0]; atlas.ys[i] = s[1]; atlas.zs[i] = s[2];
    }
  }
  // Two buffers: the one on screen, and the next view, drawn a slice per
  // frame so no single frame pays for the whole figure.
  let atlasCanvas = document.createElement("canvas");
  let atlasNext = document.createElement("canvas");
  const ATLAS_SLICES = 4;
  let atlasTheta = NaN;
  let atlasJob = null;               // the view being drawn into atlasNext

  const makeTrajectory = (key, dz) => {
    const tr = {
      key,
      state: [base[0], base[1], base[2] + dz],
      xs: new Float32Array(TRAIL),
      ys: new Float32Array(TRAIL),
      zs: new Float32Array(TRAIL),
      head: 0,
      filled: 0,
    };
    return tr;
  };
  const trajectories = [makeTrajectory("a", 0), makeTrajectory("b", 1e-5), makeTrajectory("c", -1e-5)];

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
    }
  };

  // --- viewport -------------------------------------------------------------
  let W = 0, H = 0, dpr = 1, scale = 1, cx = 0, cy = 0;

  // How finely to draw, from finest to plainest: resolution goes first,
  // then trail length. The level a device settles at is remembered, so the
  // next page starts there rather than stuttering while it finds out again.
  const LEVELS = [
    { dpr: 1.5, quality: 1 },
    { dpr: 1, quality: 1 },
    { dpr: 1, quality: 0.65 },
    { dpr: 1, quality: 0.42 },
    { dpr: 1, quality: 0.3 },
  ];
  const LEVEL_KEY = "library-motion-level";
  const LEVEL_DAYS = 14;             // then find out afresh
  const device = `${window.devicePixelRatio || 1}@${screen.width}x${screen.height}`;
  let level = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(LEVEL_KEY) || "null");
    if (saved && saved.device === device && Date.now() - saved.at < LEVEL_DAYS * 864e5) {
      level = Math.min(LEVELS.length - 1, Math.max(0, saved.level | 0));
    }
  } catch { /* storage unavailable: start at the finest */ }
  let dprCap = LEVELS[level].dpr;
  let quality = LEVELS[level].quality;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    for (const c of [atlasCanvas, atlasNext]) {
      c.width = canvas.width;
      c.height = canvas.height;
    }
    // Large enough that the two lobes open out either side of the reading
    // column; the view rocks ±0.4 rad, so allow for its widest angle.
    // Where the figure sits and how wide it is drawn come from the
    // stylesheet: centred and a little taller than the screen on wide
    // displays (the lobes then clear the sheet), high and wide on phones,
    // where it fills the cover band above the page.
    const css = getComputedStyle(document.documentElement);
    const focusY = parseFloat(css.getPropertyValue("--bg-focus-y")) || 0.5;
    const widthK = parseFloat(css.getPropertyValue("--bg-width")) || 0.98;
    const heightK = parseFloat(css.getPropertyValue("--bg-height")) || 1.15;
    scale = Math.min((W * widthK) / 60, (H * heightK) / 47);
    cx = W / 2;
    cy = H * focusY;
    atlasTheta = NaN;
    atlasJob = null;
  };

  // --- colour and blending, from the stylesheet -----------------------------
  let look = {};
  const readLook = () => {
    const s = getComputedStyle(document.documentElement);
    const v = (n, d) => (s.getPropertyValue(n) || "").trim() || d;
    look = {
      a: v("--traj-a", "60, 52, 46"),
      b: v("--traj-b", "179, 54, 27"),
      c: v("--traj-c", "36, 128, 120"),
      atlas: v("--atlas", "60, 52, 46"),
      atlasAlpha: parseFloat(v("--atlas-alpha", "0.1")),
      trailAlpha: parseFloat(v("--trail-alpha", "0.55")),
      blend: v("--trail-blend", "source-over"),
    };
    halos.a = halos.b = halos.c = null;
  };

  // --- projection -----------------------------------------------------------
  // On the attractor x ≈ y, so the figure is nearly planar with its face
  // along x = y; θ = −π/4 looks straight at it. The view rocks either side
  // of face-on rather than revolving, which would pass through a sliver.
  const FACE_ON = -Math.PI / 4;
  const SWING = 0.4;
  const RATE = 0.0009;
  let phase = 0;
  let theta = FACE_ON;
  let cos = Math.cos(theta), sin = Math.sin(theta);

  // --- drawing --------------------------------------------------------------
  // The moving points' glow, pre-rendered (shadowBlur costs half the frame rate).
  const HALO = 12;
  const halos = {};
  const halo = (key) => {
    if (halos[key]) return halos[key];
    const size = HALO * 4;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${look[key]}, 1)`);
    grad.addColorStop(0.15, `rgba(${look[key]}, 0.95)`);
    grad.addColorStop(0.25, `rgba(${look[key]}, 0.35)`);
    grad.addColorStop(1, `rgba(${look[key]}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return (halos[key] = c);
  };

  // Drawn in hairlines, exactly one device pixel wide: a wider translucent
  // stroke over a path that crosses itself thousands of times is some
  // twenty times slower, and was what made the first seconds stutter. The
  // thinner line is given proportionally more ink, so it reads the same.
  const drawAtlasSlice = (job) => {
    const a = atlasNext.getContext("2d");
    if (job.slice === 0) {
      a.setTransform(1, 0, 0, 1, 0, 0);
      a.clearRect(0, 0, atlasNext.width, atlasNext.height);
    }
    const per = Math.ceil(ATLAS_N / ATLAS_SLICES);
    const from = job.slice * per;
    const to = Math.min(ATLAS_N - 1, from + per);
    a.setTransform(dpr, 0, 0, dpr, 0, 0);
    a.strokeStyle = `rgba(${look.atlas}, ${Math.min(1, look.atlasAlpha * dpr)})`;
    a.lineWidth = 1 / dpr;
    a.beginPath();
    for (let i = from; i <= to; i++) {
      const x = atlas.xs[i], y = atlas.ys[i];
      const sx = cx + (x * job.cos - y * job.sin) * scale;
      const sy = cy - (atlas.zs[i] - Z_CENTER) * scale;
      if (i === from) a.moveTo(sx, sy);
      else a.lineTo(sx, sy);
    }
    a.stroke();
    job.slice++;
  };

  const drawAtlas = () => {
    const now = Number.isNaN(atlasTheta);   // nothing on screen yet: draw it whole
    if (!atlasJob && (now || Math.abs(theta - atlasTheta) >= 0.004)) {
      atlasJob = { theta, cos, sin, slice: 0 };
    }
    if (!atlasJob) return;
    do drawAtlasSlice(atlasJob); while (now && atlasJob.slice < ATLAS_SLICES);
    if (atlasJob.slice < ATLAS_SLICES) return;
    [atlasCanvas, atlasNext] = [atlasNext, atlasCanvas];
    atlasTheta = atlasJob.theta;
    atlasJob = null;
  };

  const drawTrajectory = (tr) => {
    const n = Math.floor(tr.filled * quality);
    if (n < 2) return;
    const oldest = (tr.head - tr.filled + TRAIL) % TRAIL;
    const offset = tr.filled - n;
    const per = Math.ceil(n / CHUNKS);
    const rgb = look[tr.key];

    for (let c = 0; c < CHUNKS; c++) {
      const start = offset + c * per;
      const end = Math.min(tr.filled - 1, start + per);
      if (start >= end) continue;
      const age = (c + 1) / CHUNKS;
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
      const alpha = (0.1 + 0.9 * Math.pow(age, 1.5)) * (0.5 + 0.5 * near) * look.trailAlpha;
      ctx.strokeStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
      ctx.lineWidth = (1.05 + 1.1 * near) * (0.75 + 0.5 * age);
      ctx.stroke();
    }

    const k = (tr.head - 1 + TRAIL) % TRAIL;
    const hx = cx + (tr.xs[k] * cos - tr.ys[k] * sin) * scale;
    const hy = cy - (tr.zs[k] - Z_CENTER) * scale;
    ctx.globalAlpha = Math.min(1, look.trailAlpha * 1.6);
    ctx.drawImage(halo(tr.key), hx - HALO, hy - HALO, HALO * 2, HALO * 2);
    ctx.globalAlpha = 1;
  };

  const render = () => {
    drawAtlas();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(atlasCanvas, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // Dark theme: additive light. Light theme: ink.
    ctx.globalCompositeOperation = look.blend;
    for (const tr of trajectories) drawTrajectory(tr);
    ctx.globalCompositeOperation = "source-over";
  };

  // --- loop -----------------------------------------------------------------
  let running = false;
  let stopped = false;               // the reader asked for stillness
  let frame = 0;

  try {
    stopped = localStorage.getItem(MOTION_KEY) === "still";
  } catch { /* storage unavailable: default to motion */ }

  // If frames get expensive, give up what nobody will notice first, a level
  // at a time; and if even the plainest is too slow, stop, leaving a still
  // figure. A background must never make reading slow. Frames are judged
  // half a second at a time, so a slow device is found out at once, not
  // after a long stretch of stutter; the first moments after starting are
  // the page loading, not the drawing, and are not held against it.
  const WINDOW = 500;
  const SETTLE = 600;
  let windowStart = 0;               // 0: not started; before it: settling
  let frames = -1;                   // frames judged so far; -1: settling

  const effective = (l) => `${Math.min(window.devicePixelRatio || 1, LEVELS[l].dpr)}/${LEVELS[l].quality}`;
  const lower = () => {
    const was = effective(level);
    let next = level;
    while (next < LEVELS.length - 1 && effective(next) === was) next++;
    if (effective(next) === was) return false;
    level = next;
    quality = LEVELS[level].quality;
    if (LEVELS[level].dpr !== dprCap) { dprCap = LEVELS[level].dpr; resize(); }
    try { localStorage.setItem(LEVEL_KEY, JSON.stringify({ level, device, at: Date.now() })); } catch { /* fine */ }
    return true;
  };

  const budget = (now) => {
    if (!windowStart) { windowStart = now + SETTLE; return; }
    if (frames < 0) {
      if (now >= windowStart) { windowStart = now; frames = 0; }
      return;
    }
    frames++;
    const span = now - windowStart;
    if (span < WINDOW || frames < 10) return;
    const avg = span / frames;
    windowStart = now;
    frames = 0;
    if (avg <= 21) return;
    if (lower()) { windowStart = now + 250; frames = -1; }
    else if (avg > 45) { stop(); render(); }
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
    frame = requestAnimationFrame(tick);
  };

  const button = document.querySelector("[data-motion-toggle]");
  const paint = () => {
    if (!button) return;
    const still = stopped || reduceMotion.matches;
    button.textContent = still ? "Motion" : "Still";
    button.setAttribute("aria-pressed", String(still));
    button.setAttribute("aria-label", still ? "Set the background moving" : "Stop the background moving");
    button.hidden = reduceMotion.matches;
  };

  const start = () => {
    if (running || stopped || reduceMotion.matches || document.hidden) return;
    running = true;
    windowStart = 0; frames = -1;
    frame = requestAnimationFrame(tick);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
  };

  // Under reduced motion, or when stilled: a finished picture, not a blank.
  const still = () => {
    if (trajectories[0].filled < TRAIL) advance(TRAIL);
    render();
  };

  button?.addEventListener("click", () => {
    stopped = !stopped;
    try { localStorage.setItem(MOTION_KEY, stopped ? "still" : "moving"); } catch { /* fine */ }
    if (stopped) { stop(); still(); } else start();
    paint();
  });

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (!running) render();
    }, 120);
  });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  document.addEventListener("themechange", () =>
    requestAnimationFrame(() => {
      readLook();
      atlasTheta = NaN;
      atlasJob = null;
      if (!running) render();
    }),
  );
  reduceMotion.addEventListener?.("change", () => {
    stop();
    if (reduceMotion.matches) still();
    else start();
    paint();
  });

  readLook();
  resize();
  if (stopped || reduceMotion.matches) still();
  else { render(); start(); }
  paint();

  window.__lorenz = {
    get running() { return running; },
    get level() { return level; },
    toggle() { button?.click(); return running; },
  };
})();
