/**
 * The Lorenz attractor, drawn slowly behind everything else.
 *
 *   dx/dt = σ(y − x)
 *   dy/dt = x(ρ − z) − y
 *   dz/dt = xy − βz
 *
 * With the canonical σ=10, ρ=28, β=8/3 the system is chaotic: the three
 * trajectories below start a hair apart and are strangers within a minute.
 * That is the whole reason it is the wallpaper of a garden of unfinished
 * notes — small revisions, wildly different destinations, bounded all the
 * same.
 *
 * Integrated with RK4 at a fixed step so the shape stays clean regardless of
 * frame rate. No dependencies.
 */
(() => {
  "use strict";

  const canvas = document.getElementById("lorenz");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const SIGMA = 10;
  const RHO = 28;
  const BETA = 8 / 3;

  const DT = 0.0045;          // integration step
  const STEPS_PER_FRAME = 5;  // how fast the pen travels
  const CHUNKS = 30;          // trail segments that share an alpha value
  // Long trails on a desktop viewport, shorter where the GPU is likely smaller.
  const SMALL = window.matchMedia("(max-width: 48rem)").matches;
  const TRAIL = SMALL ? 1600 : 4200;
  const Z_CENTER = 27;        // the attractor floats around z ≈ 27

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // --- the vector field ---------------------------------------------------
  const derivative = (s, out) => {
    out[0] = SIGMA * (s[1] - s[0]);
    out[1] = s[0] * (RHO - s[2]) - s[1];
    out[2] = s[0] * s[1] - BETA * s[2];
    return out;
  };

  const k1 = [0, 0, 0], k2 = [0, 0, 0], k3 = [0, 0, 0], k4 = [0, 0, 0], tmp = [0, 0, 0];

  const step = (s, dt) => {
    derivative(s, k1);
    for (let i = 0; i < 3; i++) tmp[i] = s[i] + (dt / 2) * k1[i];
    derivative(tmp, k2);
    for (let i = 0; i < 3; i++) tmp[i] = s[i] + (dt / 2) * k2[i];
    derivative(tmp, k3);
    for (let i = 0; i < 3; i++) tmp[i] = s[i] + dt * k3[i];
    derivative(tmp, k4);
    for (let i = 0; i < 3; i++) {
      s[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }
    return s;
  };

  // --- trajectories -------------------------------------------------------
  // Deliberately near-identical seeds. Watch them separate.
  const makeTrajectory = (seed, weight) => ({
    state: seed.slice(),
    weight,
    xs: new Float32Array(TRAIL),
    ys: new Float32Array(TRAIL),
    zs: new Float32Array(TRAIL),
    head: 0,
    filled: 0,
  });

  const trajectories = [
    makeTrajectory([1.0, 1.0, 1.05], 1.0),
    makeTrajectory([1.0, 1.0, 1.05 + 1e-5], 0.6),
    ...(SMALL ? [] : [makeTrajectory([1.0, 1.0, 1.05 - 1e-5], 0.4)]),
  ];

  // Let the transient settle before anyone sees it, and pre-fill the trails.
  for (const t of trajectories) {
    for (let i = 0; i < 900; i++) step(t.state, DT);
    for (let i = 0; i < TRAIL; i++) {
      step(t.state, DT);
      t.xs[i] = t.state[0];
      t.ys[i] = t.state[1];
      t.zs[i] = t.state[2];
    }
    t.head = 0;
    t.filled = TRAIL;
  }

  // --- viewport -----------------------------------------------------------
  let width = 0, height = 0, scale = 1, dpr = 1;

  const resize = () => {
    // Deliberately 1x: this is faint wallpaper, and a 2x backing store
    // quadruples rasterisation cost for no visible gain.
    dpr = 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Face-on the figure is ~60 units across and ~54 tall about Z_CENTER.
    scale = Math.min(width / 64, height / 56);
  };

  // --- colour, read from the stylesheet so themes stay in one place -------
  let ink = "120, 134, 150";
  let accent = "150, 122, 96";

  const readTheme = () => {
    const styles = getComputedStyle(document.documentElement);
    ink = (styles.getPropertyValue("--lorenz-ink") || "").trim() || ink;
    accent = (styles.getPropertyValue("--lorenz-accent") || "").trim() || accent;
  };

  // --- projection ---------------------------------------------------------
  // On the attractor x and y stay tightly coupled (dx/dt = σ(y−x) sees to
  // that), so the figure is nearly planar and its face lies along x = y.
  // Viewing at θ = −π/4 looks straight at that face — the familiar butterfly.
  // A full revolution would swing through θ = +π/4, which is exactly edge-on
  // and shows a sliver, so the view rocks either side of face-on instead.
  const FACE_ON = -Math.PI / 4;
  const SWING = 0.42;   // ±24°
  const RATE = 0.0016;  // a full rock takes about a minute

  let phase = 0;
  let theta = FACE_ON;

  const project = (x, y, z, cos, sin) => {
    const rx = x * cos - y * sin;   // rotate about the attractor's own axis
    const depth = x * sin + y * cos;
    return {
      sx: width / 2 + rx * scale,
      sy: height / 2 - (z - Z_CENTER) * scale,
      depth,
    };
  };

  // --- drawing ------------------------------------------------------------
  const drawTrajectory = (t, cos, sin) => {
    const n = Math.floor(t.filled * quality);
    if (n < 2) return;
    const offset = t.filled - n; // keep the freshest part of the trail
    const per = Math.ceil(n / CHUNKS);

    for (let c = 0; c < CHUNKS; c++) {
      const start = offset + c * per;
      const end = Math.min(t.filled - 1, start + per);
      if (start >= end) continue;

      // Age runs 0 (oldest tail) → 1 (the moving head).
      const age = (c + 1) / CHUNKS;
      const fade = Math.pow(age, 2.1);

      let depthSum = 0;
      ctx.beginPath();
      for (let i = start; i <= end; i++) {
        const idx = (t.head + i) % TRAIL;
        const p = project(t.xs[idx], t.ys[idx], t.zs[idx], cos, sin);
        depthSum += p.depth;
        if (i === start) ctx.moveTo(p.sx, p.sy);
        else ctx.lineTo(p.sx, p.sy);
      }

      // Points behind the centre of rotation recede.
      const depth = depthSum / (end - start + 1);
      const near = 0.5 + 0.5 * Math.tanh(depth / 18);
      const alpha = 0.30 * fade * t.weight * (0.35 + 0.65 * near);

      ctx.strokeStyle = `rgba(${ink}, ${alpha.toFixed(4)})`;
      ctx.lineWidth = (0.55 + 0.75 * near) * (0.6 + 0.4 * age);
      ctx.stroke();
    }

    // A faint bright head, so the eye can find the moving point.
    const hIdx = (t.head + t.filled - 1) % TRAIL;
    const h = project(t.xs[hIdx], t.ys[hIdx], t.zs[hIdx], cos, sin);
    ctx.beginPath();
    ctx.arc(h.sx, h.sy, 1.5 * t.weight + 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${accent}, ${(0.5 * t.weight).toFixed(3)})`;
    ctx.fill();
  };

  const render = () => {
    ctx.clearRect(0, 0, width, height);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    for (const t of trajectories) drawTrajectory(t, cos, sin);
  };

  const advance = () => {
    for (const t of trajectories) {
      for (let s = 0; s < STEPS_PER_FRAME; s++) {
        step(t.state, DT);
        t.xs[t.head] = t.state[0];
        t.ys[t.head] = t.state[1];
        t.zs[t.head] = t.state[2];
        t.head = (t.head + 1) % TRAIL;
      }
    }
    phase += RATE;
    theta = FACE_ON + SWING * Math.sin(phase);
  };

  // --- loop ---------------------------------------------------------------
  let running = false;
  let frame = 0;
  let quality = 1;

  // If frames get expensive — a weak device, a huge display, software
  // rasterisation — shorten the trails, and give up entirely rather than
  // let a decoration make the page feel slow.
  let samples = 0;
  let elapsed = 0;
  let lastFrame = 0;

  const budget = (now) => {
    if (lastFrame) {
      elapsed += now - lastFrame;
      samples++;
    }
    lastFrame = now;
    if (samples < 90) return;
    const avg = elapsed / samples;
    samples = 0;
    elapsed = 0;
    if (avg > 26 && quality > 0.3) quality = Math.max(0.3, quality * 0.6);
    else if (avg > 45) {
      stop();
      render(); // leave the figure on screen, just still
    }
  };

  const tick = (now) => {
    if (!running) return;
    budget(now);
    advance();
    render();
    frame = requestAnimationFrame(tick);
  };

  const start = () => {
    if (running || reduceMotion.matches) return;
    running = true;
    lastFrame = 0;
    samples = 0;
    elapsed = 0;
    frame = requestAnimationFrame(tick);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
  };

  const boot = () => {
    readTheme();
    resize();
    if (reduceMotion.matches) {
      render(); // one still frame; the shape without the motion
      stop();
    } else {
      start();
    }
  };

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (!running) render();
    }, 150);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  reduceMotion.addEventListener?.("change", boot);
  document.addEventListener("themechange", () => {
    readTheme();
    if (!running) render();
  });

  boot();

  // Let the rest of the page pause the attractor (used by the toggle).
  window.__lorenz = {
    start,
    stop,
    toggle() {
      if (running) stop();
      else start();
      return running;
    },
    get running() {
      return running;
    },
  };
})();
