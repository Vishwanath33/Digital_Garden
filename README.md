# The Lorenz Garden

A digital garden — notes organised by subject, revised in place, each labelled
with how mature it is and how much its author currently believes it. Built
with [Eleventy](https://www.11ty.dev/), deployed to GitHub Pages, with a live
Lorenz attractor integrated behind every page.

```
npm install
npm run dev     # http://localhost:8080, live reload
npm run build   # → _site/
npm test        # builds, then runs a browser smoke test
```

---

## Planting a note

Add a Markdown file to `src/notes/`. The filename becomes the URL, so
`src/notes/why-maps-lie.md` is served at `/notes/why-maps-lie/`.

```markdown
---
title: Why maps lie
summary: One sentence, shown in listings and in search results.
planted: 2026-09-28
updated: 2026-09-28
growth: seedling        # seedling | budding | evergreen
certainty: possible     # certain | high | likely | possible | unlikely | speculative
importance: 5           # 1–10
tags: [cartography, epistemics]
---

Your first paragraph gets a dropcap.
```

Only `title` and `planted` are strictly required. `draft: true` keeps a note
out of the build entirely.

The vocabulary for `growth` and `certainty` is explained — and is meant to be
changed to suit you — in `/notes/epistemic-status/`.

### Linking

Wiki-style links resolve to other notes:

```markdown
[[why-maps-lie]]                      → linked by its slug
[[why-maps-lie|maps are arguments]]   → with your own link text
```

Every note automatically grows a **Linked from** section listing the notes
that point at it. Backlinks are computed at build time by parsing the
Markdown, so they are never out of date and never hand-maintained.

### Sidenotes

Ordinary Markdown footnotes are promoted into the right margin on wide
screens, and fold out inline when tapped on narrow ones:

```markdown
The claim in the main text.[^why]

[^why]: The qualification that would have interrupted it.
```

### Asides and epigraphs

```markdown
{% aside "Where I am least sure" %}
A boxed caveat, set apart from the argument.
{% endaside %}

{% epigraph "Edward Lorenz, 1972" %}
Does the flap of a butterfly's wings in Brazil set off a tornado in Texas?
{% endepigraph %}
```

---

## Making it yours

Almost everything you'd want to change lives in **`src/_data/site.js`**: the
title, tagline, your name, the repository link, the custom domain, and the
growth-stage vocabulary.

Colours, type and spacing are CSS custom properties at the top of
`src/assets/css/garden.css` — `--paper`, `--ink`, `--accent`, `--measure` and
friends, with a dark-mode block immediately below. The attractor reads
`--lorenz-ink` and `--lorenz-accent` from the same place, so it follows the
theme rather than carrying its own palette.

---

## The attractor

`src/assets/js/lorenz.js` integrates the real Lorenz system

```
dx/dt = σ(y − x)      σ = 10
dy/dt = x(ρ − z) − y  ρ = 28
dz/dt = xy − βz       β = 8/3
```

with fourth-order Runge–Kutta at a fixed step, so the figure is the actual
attractor rather than a drawing of one. Three trajectories start 10⁻⁵ apart
and separate on screen. No dependencies, ~230 lines.

It is built to stay out of the way:

- **Face-on view.** On the attractor `x ≈ y`, so the figure is nearly planar.
  The view rocks ±24° either side of face-on rather than making full
  revolutions, which would swing through an edge-on angle showing a sliver.
- **1× backing store.** Faint wallpaper gains nothing from a retina canvas and
  a 2× one quadruples rasterisation cost.
- **Adaptive.** Frame times are sampled; if they slip past ~26 ms the trails
  shorten, and past ~45 ms it stops and leaves a still frame. A decoration
  should never make the page feel slow.
- **`prefers-reduced-motion`.** Renders one still frame and never animates.
- **Pauses** when the tab is hidden, and can be switched off with the ❉
  control in the header.

Knobs worth turning, all near the top of the file: `STEPS_PER_FRAME` (how fast
the pen travels), `TRAIL` (how much history stays on screen), `SWING` and
`RATE` (the rocking), and the `0.30` alpha coefficient in `drawTrajectory`
(how present the whole thing is). The mask that fades it through the reading
column is the `mask-image` on `#lorenz` in the stylesheet.

---

## Deploying

A push triggers `.github/workflows/deploy.yml`, which builds and publishes to
GitHub Pages. One-time setup:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
   This one is required and cannot be automated — the workflow's token is not
   allowed to enable Pages, and the run fails at `configure-pages` until the
   setting is made.
2. Re-run the workflow (**Actions → Build and deploy → Run workflow**, or just
   push again). It publishes to `https://vishwanath33.github.io/Digital_Garden`.

> The repository was created empty, so the first push became the default
> branch rather than `main`. The workflow currently watches both that branch
> and `main`; rename the branch to `main` in **Settings → Branches** (or push
> a `main`) and then drop the extra entry from the workflow's `branches:` list.

### A custom domain

Buy the name from any registrar — [Porkbun](https://porkbun.com),
[Namecheap](https://www.namecheap.com) and
[Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) are the
usual recommendations, and Cloudflare sells at cost. A `.com` runs about
$10–15/year; `.garden`, `.ink` and `.page` are in a similar range and suit
this better.

Then:

1. Set it in `src/_data/site.js`:

   ```js
   domain: "your-domain.example",
   ```

   The build writes `_site/CNAME` from that value, which is how GitHub Pages
   learns about it. Canonical URLs, the sitemap and the feed all follow the
   same setting.

2. At your registrar, point the domain at GitHub Pages. For an **apex** domain
   (`your-domain.example`), four `A` records and four `AAAA` records:

   ```
   A     @   185.199.108.153
   A     @   185.199.109.153
   A     @   185.199.110.153
   A     @   185.199.111.153
   AAAA  @   2606:50c0:8000::153
   AAAA  @   2606:50c0:8001::153
   AAAA  @   2606:50c0:8002::153
   AAAA  @   2606:50c0:8003::153
   ```

   For a **subdomain** (`garden.your-domain.example`), one record instead:

   ```
   CNAME  garden   vishwanath33.github.io.
   ```

   > These addresses are stable but are GitHub's to change. Confirm them
   > against the values shown in **Settings → Pages** after you enter the
   > domain there, which are authoritative for your repository.

3. **Settings → Pages → Custom domain**, enter the domain, save, and tick
   **Enforce HTTPS** once the certificate is issued (usually minutes, up to
   24 hours).

---

## Layout

```
src/
  _data/site.js          ← title, domain, author, growth vocabulary
  _includes/layouts/     ← base, note, page
  assets/css/garden.css  ← the whole visual system
  assets/js/lorenz.js    ← the attractor
  assets/js/garden.js    ← sidenotes, theme, TOC, filtering
  notes/*.md             ← the garden
  index.njk  notes.njk  tags.njk  about.md  colophon.md
eleventy.config.js       ← wiki links, backlinks, filters, feed, CNAME
test/smoke.mjs           ← browser checks for the interactive pieces
```

## Licence

Prose CC BY 4.0, code MIT. See `LICENSE`.
