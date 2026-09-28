/**
 * The library as a network of entries and subjects, drawn wherever a
 * canvas asks for it: `data-graph="local"` for an entry's neighbourhood
 * (the figure in its end matter), `data-graph="global"` for the whole
 * collection (the Map). A small force simulation lays it out — mutual
 * repulsion, springs along links, a weak pull to the centre — then
 * settles and stops, so an idle graph costs nothing.
 *
 * No dependencies. Colours come from the stylesheet so it follows the theme.
 */
(() => {
  "use strict";

  const source = document.getElementById("graph-src");
  const canvases = [...document.querySelectorAll("[data-graph]")];
  if (!source || !canvases.length) return;

  const current = document.body.dataset.page || "";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const LINK_LENGTH = 46;
  const REPULSION = 2600;
  const SPRING = 0.045;
  const CENTER = 0.012;
  const DAMPING = 0.82;

  let palette = {};
  const readPalette = () => {
    const s = getComputedStyle(document.documentElement);
    const v = (name) => s.getPropertyValue(name).trim();
    palette = {
      node: v("--ink-2"),
      tag: v("--ink-3"),
      link: v("--ink-3"),
      label: v("--ink-2"),
      accent: v("--accent"),
      ink: v("--ink"),
      bg: v("--paper-2"),
    };
  };
  readPalette();

  class GraphView {
    constructor(canvas, data, { mode }) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.mode = mode;
      // The map shows every label, so it spreads out to keep them apart.
      this.linkLength = mode === "global" ? LINK_LENGTH * 1.6 : LINK_LENGTH;
      this.repulsion = mode === "global" ? REPULSION * 3 : REPULSION;

      // Choose the nodes to show.
      const all = new Map(data.nodes.map((n) => [n.id, n]));
      let ids;
      if (mode === "local" && all.has(current)) {
        ids = new Set([current]);
        for (const l of data.links) {
          if (l.source === current) ids.add(l.target);
          if (l.target === current) ids.add(l.source);
        }
      } else {
        ids = new Set(all.keys());
      }

      this.nodes = [...ids].map((id, i) => {
        const n = all.get(id);
        // Deterministic start on a spiral, so layouts are stable per page.
        const a = i * 2.39996;
        const r = 12 * Math.sqrt(i + 1);
        return { ...n, x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0, degree: 0 };
      });
      this.byId = new Map(this.nodes.map((n) => [n.id, n]));
      this.links = data.links
        .filter((l) => this.byId.has(l.source) && this.byId.has(l.target))
        .map((l) => ({ source: this.byId.get(l.source), target: this.byId.get(l.target) }));
      for (const l of this.links) {
        l.source.degree++;
        l.target.degree++;
      }
      this.neighbours = new Map(this.nodes.map((n) => [n, new Set([n])]));
      for (const l of this.links) {
        this.neighbours.get(l.source).add(l.target);
        this.neighbours.get(l.target).add(l.source);
      }

      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this.alpha = 1;
      this.hover = null;
      this.drag = null;
      this.running = false;

      this.resize();
      // Mostly settle before the first frame, then let it finish on screen.
      this.settle(reduceMotion.matches ? 400 : 160);
      this.fit();
      this.bind();
      if (reduceMotion.matches) this.alpha = 0;
      this.kick(this.alpha);
    }

    radius(n) {
      if (n.type === "tag") return 2.6;
      return 3.2 + Math.sqrt(n.degree) * 1.25 + (n.id === current ? 1.8 : 0);
    }

    tick() {
      const nodes = this.nodes;
      const k = this.alpha;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = (i - j) * 0.1 || 0.1; dy = 0.1; d2 = 1; }
          const f = (this.repulsion * k) / d2;
          const d = Math.sqrt(d2);
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }
      for (const { source: a, target: b } of this.links) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const len = a.type === "tag" || b.type === "tag" ? this.linkLength * 0.75 : this.linkLength;
        const f = (d - len) * SPRING * k;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      for (const n of nodes) {
        n.vx -= n.x * CENTER * k;
        n.vy -= n.y * CENTER * k;
        if (n === this.drag?.node) {
          n.vx = n.vy = 0;
          continue;
        }
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
      }
      this.alpha *= 0.985;
    }

    settle(ticks) {
      for (let i = 0; i < ticks; i++) this.tick();
    }

    /** Zoom and centre so every node is on screen. */
    fit() {
      if (!this.nodes.length) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of this.nodes) {
        minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
        minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
      }
      const pad = this.mode === "local" ? 34 : 70;
      const w = Math.max(maxX - minX, 1);
      const h = Math.max(maxY - minY, 1);
      this.zoom = Math.max(0.35, Math.min(2.4, Math.min((this.w - pad * 2) / w, (this.h - pad * 2) / h)));
      this.panX = -((minX + maxX) / 2) * this.zoom;
      this.panY = -((minY + maxY) / 2) * this.zoom;
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(1, rect.width);
      this.h = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
    }

    toScreen(n) {
      return [this.w / 2 + this.panX + n.x * this.zoom, this.h / 2 + this.panY + n.y * this.zoom];
    }

    toWorld(sx, sy) {
      return [(sx - this.w / 2 - this.panX) / this.zoom, (sy - this.h / 2 - this.panY) / this.zoom];
    }

    nodeAt(sx, sy) {
      let best = null;
      let bestD = Infinity;
      for (const n of this.nodes) {
        const [x, y] = this.toScreen(n);
        const d = Math.hypot(x - sx, y - sy);
        const hit = this.radius(n) * Math.max(1, this.zoom) + 6;
        if (d < hit && d < bestD) { best = n; bestD = d; }
      }
      return best;
    }

    draw() {
      const { ctx, dpr } = this;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);

      const focus = this.hover || this.drag?.node || null;
      const lit = focus ? this.neighbours.get(focus) : null;

      // Links.
      ctx.lineWidth = 1;
      for (const l of this.links) {
        const on = lit && lit.has(l.source) && lit.has(l.target) && (l.source === focus || l.target === focus);
        ctx.globalAlpha = lit ? (on ? 0.95 : 0.12) : 0.45;
        ctx.strokeStyle = on ? palette.accent : palette.link;
        const [x1, y1] = this.toScreen(l.source);
        const [x2, y2] = this.toScreen(l.target);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Nodes.
      for (const n of this.nodes) {
        const [x, y] = this.toScreen(n);
        const r = this.radius(n) * Math.max(0.8, Math.min(this.zoom, 1.6));
        const isCurrent = n.id === current;
        const dim = lit && !lit.has(n);
        ctx.globalAlpha = dim ? 0.25 : 1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        if (n.type === "tag") {
          ctx.fillStyle = palette.bg;
          ctx.fill();
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = n === focus ? palette.accent : palette.node;
          ctx.stroke();
        } else {
          ctx.fillStyle = isCurrent || n === focus ? palette.accent : palette.node;
          ctx.fill();
        }
        if (isCurrent) {
          ctx.globalAlpha = dim ? 0.2 : 0.35;
          ctx.beginPath();
          ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
          ctx.strokeStyle = palette.accent;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Labels: on hover in an entry's figure; on the map, as many as fit.
      // Placed in order of importance (the current entry, then entries by
      // how many links they carry, then subjects); a label that would
      // collide with one already placed is left for hover to reveal.
      ctx.font = `italic ${this.mode === "global" ? 15 : 13.5}px Newsreader, Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const rank = (n) =>
        (n === focus ? 3000 : 0) + (n.id === current ? 2000 : 0) + (n.type === "note" ? 1000 : 0) + n.degree;
      const placed = [];
      for (const n of [...this.nodes].sort((a, b) => rank(b) - rank(a))) {
        const wanted =
          (lit && lit.has(n)) ||
          (!lit && this.mode === "global") ||
          (!lit && n.id === current && this.mode === "global");
        if (!wanted) continue;
        const [x, y] = this.toScreen(n);
        const r = this.radius(n) * Math.max(0.8, Math.min(this.zoom, 1.6));
        const text = n.title.length > 34 ? `${n.title.slice(0, 32)}…` : n.title;
        const w = ctx.measureText(text).width;
        const box = { x0: x - w / 2 - 3, x1: x + w / 2 + 3, y0: y + r + 3, y1: y + r + 22 };
        const clash = placed.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0);
        if (clash && n !== focus) continue;
        placed.push(box);
        ctx.globalAlpha = lit ? (n === focus ? 1 : 0.85) : 0.72;
        // A knockout behind the label keeps it readable over links.
        ctx.lineWidth = 3;
        ctx.strokeStyle = palette.bg;
        ctx.lineJoin = "round";
        ctx.strokeText(text, x, y + r + 4);
        ctx.fillStyle = n === focus ? palette.ink : palette.label;
        ctx.fillText(text, x, y + r + 4);
      }
      ctx.globalAlpha = 1;
    }

    loop = () => {
      if (!this.running) return;
      if (this.alpha > 0.01 || this.drag) this.tick();
      this.draw();
      if (this.alpha <= 0.01 && !this.drag) {
        this.running = false;
        return;
      }
      this.frame = requestAnimationFrame(this.loop);
    };

    /** Reheat the simulation (or just redraw, when motion is reduced). */
    kick(alpha = 0.3) {
      if (reduceMotion.matches && !this.drag) {
        this.draw();
        return;
      }
      this.alpha = Math.max(this.alpha, alpha);
      if (!this.running) {
        this.running = true;
        this.frame = requestAnimationFrame(this.loop);
      }
    }

    redraw() {
      if (!this.running) this.draw();
    }

    bind() {
      const c = this.canvas;
      const pos = (e) => {
        const r = c.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
      };

      c.addEventListener("pointermove", (e) => {
        const [sx, sy] = pos(e);
        if (this.drag) {
          const d = this.drag;
          d.moved ||= Math.hypot(sx - d.sx, sy - d.sy) > 4;
          if (d.node) {
            const [wx, wy] = this.toWorld(sx, sy);
            d.node.x = wx;
            d.node.y = wy;
            this.kick(0.25);
          } else {
            this.panX = d.panX + (sx - d.sx);
            this.panY = d.panY + (sy - d.sy);
            this.redraw();
          }
          return;
        }
        const hit = this.nodeAt(sx, sy);
        if (hit !== this.hover) {
          this.hover = hit;
          c.style.cursor = hit ? "pointer" : "";
          c.title = hit ? hit.title : "";
          this.redraw();
        }
      });

      c.addEventListener("pointerdown", (e) => {
        const [sx, sy] = pos(e);
        c.setPointerCapture(e.pointerId);
        this.drag = { node: this.nodeAt(sx, sy), sx, sy, panX: this.panX, panY: this.panY, moved: false };
      });

      const release = (e) => {
        const d = this.drag;
        if (!d) return;
        this.drag = null;
        if (c.hasPointerCapture?.(e.pointerId)) c.releasePointerCapture(e.pointerId);
        if (d.node && !d.moved && d.node.href) {
          window.location.href = d.node.href;
          return;
        }
        this.kick(0.1);
      };
      c.addEventListener("pointerup", release);
      c.addEventListener("pointercancel", release);

      c.addEventListener("pointerleave", () => {
        if (this.hover && !this.drag) {
          this.hover = null;
          this.redraw();
        }
      });

      // Wheel zoom only on the map: in an entry's figure it would steal the
      // page's scroll.
      if (this.mode === "global") {
        c.addEventListener(
          "wheel",
          (e) => {
            e.preventDefault();
            const [sx, sy] = pos(e);
            const [wx, wy] = this.toWorld(sx, sy);
            const next = Math.max(0.2, Math.min(5, this.zoom * Math.exp(-e.deltaY * 0.0015)));
            this.zoom = next;
            this.panX = sx - this.w / 2 - wx * next;
            this.panY = sy - this.h / 2 - wy * next;
            this.redraw();
          },
          { passive: false },
        );
      }

      new ResizeObserver(() => {
        const before = this.w;
        this.resize();
        if (Math.abs(before - this.w) > 1) this.fit();
        this.redraw();
      }).observe(c);
    }
  }

  // --- wiring -------------------------------------------------------------
  const views = [];

  fetch(source.href)
    .then((r) => r.json())
    .then((data) => {
      for (const canvas of canvases) {
        views.push(new GraphView(canvas, data, { mode: canvas.dataset.graph === "global" ? "global" : "local" }));
      }
    })
    .catch(() => canvases.forEach((c) => c.closest("figure")?.setAttribute("hidden", "")));

  document.addEventListener("themechange", () => {
    // Custom properties settle after the attribute flips; read next frame.
    requestAnimationFrame(() => {
      readPalette();
      views.forEach((v) => v.redraw());
    });
  });

  window.__graph = {
    get views() { return views; },
    get local() { return views.find((v) => v.mode === "local"); },
    get global() { return views.find((v) => v.mode === "global"); },
  };
})();
