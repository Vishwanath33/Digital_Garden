# The Lorenz Garden

A digital garden — notes organised by subject, revised in place, each labelled
with how mature it is and how much its author currently believes it. Built
with [Eleventy](https://www.11ty.dev/), hosted free on Cloudflare Pages, with a live
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
title, tagline, your name, the host address, the custom domain, whether the
source is public, and the growth-stage vocabulary.

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

## Deploying — free, from a private repository

GitHub Pages is free only for public repositories, so this site is hosted on
**Cloudflare Pages**, which builds from private repositories at no cost,
includes HTTPS, and handles custom domains. Cloudflare runs the build itself,
so there is no deploy workflow in this repository.

One-time setup (about five minutes):

1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. **Workers & Pages → Create → Pages → Connect to Git.** Authorise GitHub and
   grant access to just this repository — private repositories are fine.
3. Configure the build:

   | Setting | Value |
   | --- | --- |
   | Project name | `lorenz-garden` (becomes `lorenz-garden.pages.dev`) |
   | Production branch | `claude/gifted-knuth-6inz5y` — or `main` once renamed |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `_site` |

   Node 22 is pinned by `.node-version`. If a build ever picks an older Node,
   add an environment variable `NODE_VERSION` = `22`.

4. **Save and Deploy.** From then on every push rebuilds and publishes, and
   Cloudflare shows the build status on each commit in GitHub.

5. If Cloudflare gave you a different address (e.g. `lorenz-garden-4xk.pages.dev`
   because the name was taken), paste it into `hostUrl` in
   `src/_data/site.js`. Internal links work either way; this only fixes the
   absolute URLs in the feed, sitemap and link previews.

> Cloudflare's dashboard labels move around. If a menu name above doesn't
> match, the thing you are looking for is "create a Pages project from a Git
> repository".

### A custom domain

Buying through **Cloudflare Registrar** (dashboard → Domain Registration) is
simplest because the DNS is then set up for you, and it sells at cost: a
`.com` is about $10/year. Then:

1. In the Pages project: **Custom domains → Set up a custom domain**, and enter
   it. On a Cloudflare-registered domain the records are created
   automatically; HTTPS follows within minutes.
2. Set it in `src/_data/site.js` and push:

   ```js
   domain: "your-domain.example",
   ```

   Canonical URLs, the sitemap and the feed all follow that one value.

A domain bought elsewhere (Porkbun, Namecheap…) works too: Cloudflare shows
the CNAME record to add at your registrar when you enter the domain.

### The source links

While the repository is private, readers can't open it, so the
*History & source* links, the footer's *source* link and the GitHub-issue
route on the about page are left out rather than left broken
(`sourcePublic: false` in `site.js`). If you make the repository public, set
it to `true` and they come back.

Making it public also makes free **GitHub Pages** an option again. In that
case set `hostUrl` to `https://vishwanath33.github.io/Digital_Garden` (the
path prefix follows automatically) and restore the Pages workflow from this
repository's history (`git show 4d0d007:.github/workflows/deploy.yml`).

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
