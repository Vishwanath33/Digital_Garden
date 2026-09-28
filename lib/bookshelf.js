/**
 * An engraving of a bookshelf, generated at build time as SVG line art.
 *
 * Deterministic (seeded), so the banner is identical on every build and only
 * changes when the seed does. Every stroke uses currentColor-driven classes,
 * so the stylesheet decides the ink colour for each theme; book bodies are
 * filled with the card colour so they occlude the hatched wall behind them,
 * which is what makes it read as an engraving rather than a wireframe.
 */

const W = 1000;
const H = 170;
const SHELF = 146; // y of the shelf's top surface

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n) => Math.round(n * 10) / 10;

/**
 * Collects one object's drawing. Filled shapes are kept in order (they
 * occlude what is behind them); strokes are batched into a single path per
 * class and drawn last, which keeps the markup small.
 */
function pen() {
  const shapes = [];
  const strokes = new Map();
  return {
    rect(x, y, w, h, cls = "e body") {
      shapes.push(`<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"/>`);
    },
    line(x1, y1, x2, y2, cls = "e") {
      strokes.set(cls, (strokes.get(cls) || "") + `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`);
    },
    raw(svg) {
      shapes.push(svg);
    },
    toString() {
      return shapes.join("") + [...strokes].map(([c, d]) => `<path class="${c}" d="${d}"/>`).join("");
    },
  };
}

/** One upright book, drawn with its bottom-left corner at (0, 0). */
function book(r, w, h) {
  const out = pen();
  out.rect(0, -h, w, h);
  const dark = r() < 0.3;

  // Shading: fine vertical strokes down the shadow side of the spine.
  const shade = dark ? w - 2 : w * (0.22 + r() * 0.12);
  for (let x = w - 1.2; x > w - shade; x -= dark ? 1.35 : 1.6) {
    out.line(x, -h + 1.5, x, -1.5, "e hatch");
  }

  // Head and tail bands.
  if (w > 11) {
    for (const y of [-h + 7, -h + 9.5, -9.5, -7]) out.line(0, y, w, y, "e fine");
  }
  // Raised bands on older-looking volumes.
  if (r() < 0.35 && h > 70) {
    const n = 3 + Math.floor(r() * 2);
    for (let i = 1; i <= n; i++) {
      const y = -h + 14 + ((h - 28) * i) / (n + 1);
      out.line(0, y - 1.2, w, y - 1.2, "e fine");
      out.line(0, y + 1.2, w, y + 1.2, "e fine");
    }
  } else if (w > 13 && r() < 0.7) {
    // A title label.
    const lh = 10 + r() * 10;
    const ly = -h + 16 + r() * (h * 0.25);
    out.rect(2.5, ly, w - 5, lh, "e fine body");
    for (let y = ly + 3; y < ly + lh - 2; y += 3) out.line(5, y, w - 5, y, "e hatch");
  }
  return String(out);
}

/** A book lying flat, bottom-left at (0, 0). */
function lyingBook(r, len, th) {
  const out = pen();
  out.rect(0, -th, len, th);
  // Page edges on the fore-edge end.
  for (let y = -th + 2; y < -1.5; y += 1.4) out.line(len - 9, y, len - 1.5, y, "e hatch");
  out.line(len - 10, -th, len - 10, 0, "e fine");
  for (const x of [6, 8.5]) out.line(x, -th, x, 0, "e fine");
  if (r() < 0.5) out.line(len * 0.35, -th + 2, len * 0.62, -th + 2, "e fine");
  return String(out);
}

/** The Lorenz attractor, x against z, as a framed plate. */
function plate(w, h) {
  const pts = [];
  let [x, y, z] = [1, 1, 1];
  const dt = 0.006;
  const d = (x, y, z) => [10 * (y - x), x * (28 - z) - y, x * y - (8 / 3) * z];
  for (let i = 0; i < 5200; i++) {
    const k1 = d(x, y, z);
    const k2 = d(x + (dt / 2) * k1[0], y + (dt / 2) * k1[1], z + (dt / 2) * k1[2]);
    const k3 = d(x + (dt / 2) * k2[0], y + (dt / 2) * k2[1], z + (dt / 2) * k2[2]);
    const k4 = d(x + dt * k3[0], y + dt * k3[1], z + dt * k3[2]);
    x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    y += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    z += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    if (i > 300 && i % 2 === 0) pts.push([(x + y) / Math.SQRT2, z]);
  }
  const inset = 11;
  const iw = w - inset * 2;
  const ih = h - inset * 2;
  const s = Math.min(iw / 58, ih / 50);
  const path = pts
    .map(([px, pz], i) => `${i ? "L" : "M"}${f(w / 2 + px * s)} ${f(-h + inset + ih / 2 - (pz - 25) * s)}`)
    .join("");

  const out = pen();
  out.rect(0, -h, w, h);
  out.rect(4, -h + 4, w - 8, h - 8, "e fine");
  out.rect(inset - 2, -h + inset - 2, iw + 4, ih + 4, "e fine");
  out.raw(`<path class="e trace" d="${path}"/>`);
  // Mitred corners of the frame.
  out.line(0, -h, 4, -h + 4, "e fine");
  out.line(w, -h, w - 4, -h + 4, "e fine");
  out.line(0, 0, 4, -4, "e fine");
  out.line(w, 0, w - 4, -4, "e fine");
  return String(out);
}

export function bookshelf({ seed = 1963 } = {}) {
  const r = rng(seed);
  const parts = [];

  // The wall behind: sparse horizontal engraving strokes.
  const wall = pen();
  for (let y = 12; y < SHELF - 2; y += 3.2) {
    let x = 10;
    while (x < W - 10) {
      const len = 30 + r() * 140;
      const x2 = Math.min(W - 10, x + len);
      wall.line(x, y, x2, y, "e wall");
      x = x2 + 4 + r() * 30;
    }
  }
  parts.push(String(wall));

  let x = 26;
  const place = (svg, dx, dy = SHELF, rot = 0, pivot = [0, 0]) =>
    parts.push(
      `<g transform="translate(${f(dx)} ${f(dy)})${rot ? ` rotate(${f(rot)} ${f(pivot[0])} ${f(pivot[1])})` : ""}">${svg}</g>`,
    );

  const run = (count) => {
    let lastH = 0;
    for (let i = 0; i < count; i++) {
      const w = 11 + r() * 22;
      const h = 74 + r() * 50;
      place(book(r, w, h), x);
      x += w + 0.6;
      lastH = h;
    }
    return lastH;
  };

  // A leaning volume rests on its bottom-left corner, its top touching the
  // last upright book.
  const lean = (neighbourH) => {
    const w = 13 + r() * 12;
    const h = Math.min(neighbourH + 10, 86 + r() * 30);
    const deg = 11 + r() * 6;
    const gap = h * Math.sin((deg * Math.PI) / 180);
    place(book(r, w, h), x + gap, SHELF, -deg, [0, 0]);
    x += gap + w * Math.cos((deg * Math.PI) / 180) + 16;
  };

  const stack = (n) => {
    let y = SHELF;
    const base = 96 + r() * 26;
    for (let i = 0; i < n; i++) {
      const len = base - i * (4 + r() * 8);
      const th = 9 + r() * 6;
      place(lyingBook(r, len, th), x + (base - len) * (0.2 + r() * 0.5), y);
      y -= th;
    }
    x += base + 18;
    return SHELF - y;
  };

  lean(run(9));
  stack(4);
  // The plate leans back against the wall, which from the front reads as
  // upright. (Tilting a frame this wide in the picture plane would leave it
  // balanced on one corner.)
  {
    const pw = 128;
    const ph = 100;
    x += 4;
    place(plate(pw, ph), x);
    x += pw + 5;
  }
  lean(run(12));
  const stackStart = x;
  stack(3);
  x = Math.max(x, stackStart + 120);
  run(Math.max(4, Math.floor((W - 40 - x) / 24)));

  // The shelf: top edge, front face with diagonal engraving, and its shadow.
  const shelf = pen();
  shelf.rect(12, SHELF, W - 24, 9, "e body");
  shelf.line(12, SHELF + 2.5, W - 12, SHELF + 2.5, "e fine");
  for (let sx = 16; sx < W - 14; sx += 2.4) shelf.line(sx, SHELF + 8.5, sx + 3.2, SHELF + 3, "e hatch");
  for (let sx = 16; sx < W - 14; sx += 1.8) shelf.line(sx, SHELF + 10.5, sx + 1.2, SHELF + 12.5, "e hatch");
  parts.push(String(shelf));

  return `<svg class="bookshelf" viewBox="0 0 ${W} ${H}" role="img" aria-label="An engraving of a bookshelf, with a framed plate of the Lorenz attractor leaning among the books" preserveAspectRatio="xMidYMid meet">
<rect class="e frame" x="1" y="1" width="${W - 2}" height="${H - 2}"/>
<rect class="e fine" x="5" y="5" width="${W - 10}" height="${H - 10}"/>
${parts.join("\n")}
</svg>`;
}
