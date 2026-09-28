# The Lorenz Library

A personal library of linked notes: entries shelved by subject,
cross-referenced, and corrected in place, each labelled with how finished it
is and how much its author currently believes it. The Lorenz attractor runs
live in the background, behind a sheet of paper that carries the text. Built
with [Eleventy](https://www.11ty.dev/) and deployed to GitHub Pages.

An earlier design, with the attractor as a captioned plate beside the text,
is kept on the `design/plate` branch.

```
npm install
npm run dev     # http://localhost:8080, live reload
npm run build   # → _site/
npm test        # browser smoke test (builds its own throwaway copies)
```

The design, and the books it draws on (Butterick, Bringhurst, Tschichold,
Tufte, Müller-Brockmann), are explained on the site's colophon page.

---

## Adding an entry

The library starts empty: the home page, catalogue, subjects and map each
say so until the first entry arrives. Five sample entries, showing every
feature (sidenotes, wiki links, asides, shelves, citations), are kept in
`test/fixtures/notes/`, where the smoke test uses them. They are not
published; copy one into `src/notes/` if you want a starting point.


Add a Markdown file to `src/notes/`. The filename becomes the address, so
`src/notes/why-maps-lie.md` is served at `/notes/why-maps-lie/`.

```markdown
---
title: Why maps lie
summary: One sentence, shown in listings, search results and link previews.
created: 2026-09-28
updated: 2026-09-28
stage: manuscript       # manuscript | proof | bound
shelf: Cartography      # its part in the contents, and its call number (CA 007)
certainty: possible     # certain | high | likely | possible | unlikely | speculative
importance: 5           # 1–10
tags: [cartography, epistemics]   # subjects: also nodes in the graph
---

The first paragraph gets a drop capital.
```

Only `title` and `created` are strictly required. An entry with no `shelf`
is filed under *General*. Accession numbers are assigned in order of
`created`. `draft: true` keeps an entry out of the build entirely.

The stage and certainty vocabulary is explained, and meant to be changed to
suit you, in `/notes/epistemic-status/`.

### Linking

Wiki-style links resolve to other entries:

```markdown
[[why-maps-lie]]                      → linked by its filename
[[why-maps-lie|maps are arguments]]   → with your own link text
```

Links feed several things automatically, all computed at build time from
the Markdown: the *Cites* and *Cited by* lines on each entry's catalogue
card, the neighbourhood figure under each entry, the map, and a
`brokenLinks` collection listing links to entries that don't exist yet.

### Sidenotes

Ordinary Markdown footnotes become notes in the outer margin when the page
is wide enough, and fold out inline when tapped on narrower screens:

```markdown
The claim in the main text.[^why]

[^why]: The qualification that would have interrupted it.
```

### Plate I

`{% plate %}` on a line of its own places the Lorenz attractor as a running
experiment: three trajectories begun 10⁻⁵ apart, with a caption, a live
readout of their separation and a log-scale sparkline, and Pause and Re-run
controls. It spans the full text block, is dark in both themes, and rests
when scrolled out of view. `src/notes/plate-i.md` is the entry that shows it;
its script (`src/assets/js/plate.js`) is loaded only on pages that use it.

### Asides and epigraphs

```markdown
{% aside "Where I am least sure" %}
A boxed caveat, set apart from the argument. *Markdown* works inside.
{% endaside %}

{% epigraph "Edward Lorenz, 1972" %}
Does the flap of a butterfly's wings in Brazil set off a tornado in Texas?
{% endepigraph %}
```

---

## Finding things

- **Contents** (the home page): every entry, grouped into parts by shelf.
- **Catalogue** (`/notes/`): every entry by date, with a filter.
- **Subjects** (`/tags/`): an alphabetical subject index.
- **Map** (`/map/`): the whole library as a graph; drag, scroll to zoom,
  select a node to open it.
- **Search**: press <kbd>/</kbd> or <kbd>Ctrl</kbd>/<kbd>⌘</kbd> <kbd>K</kbd>
  anywhere. It runs in the browser over `search.json`, built with the site.

---

## Making it yours

Almost everything you'd want to change lives in **`src/_data/site.js`**: the
title, tagline, your name, the host address, the custom domain, whether the
source is public, and the stage vocabulary.

Colours, type and the grid are CSS custom properties at the top of
`src/assets/css/library.css`: `--measure` (the text column), `--note` (the
margin notes), the paper, sheet and ink colours, and the background's
colours. The dark theme is immediately below.

---

## The background

`src/assets/js/lorenz.js` integrates the Lorenz system

```
dx/dt = σ(y − x)      σ = 10
dy/dt = x(ρ − z) − y  ρ = 28
dz/dt = xy − βz       β = 8/3
```

with fourth-order Runge–Kutta at a fixed step, behind every page. A faint
atlas (one long trajectory) draws the whole attractor, and three live
trajectories, begun 10⁻⁵ apart, trace over it. It is drawn in ink in the light
theme and in light in the dark one; the colours, the blending and where the
figure sits are CSS custom properties (`--traj-a/b/c`, `--atlas`,
`--atlas-alpha`, `--trail-alpha`, `--trail-blend`, `--bg-focus-y`,
`--bg-width`, `--bg-height`) at the top of `library.css`.

The text sits on a sheet (`--sheet`, 80% opaque) so the background can never
make it hard to read. *Still* in the header stops the motion and remembers
the choice; under `prefers-reduced-motion` it never moves; it rests in hidden
tabs; and if frames get slow (judged half a second at a time) it lowers its
resolution, then shortens its trails, then stops. The level a device settles
at is kept in `localStorage` (`library-motion-level`, for 14 days), so later
pages start there instead of stuttering while they find out again.

Knobs near the top of the script: `STEPS_PER_FRAME` (speed), `TRAIL` (how
much of each path stays lit), `ATLAS_N` (density of the faint atlas), `SWING`
and `RATE` (the slow rocking of the view).

---

## Deploying

A push triggers `.github/workflows/deploy.yml`, which builds the site and
publishes it to GitHub Pages at `https://vishwanath33.github.io/`. GitHub
Pages is free for public repositories.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub
Actions.** That setting can't be made from the workflow, because its token
isn't allowed to enable Pages. Until it's set, runs fail at `configure-pages`.
After setting it, re-run the latest workflow run or push again.

### The address follows the repository's name

The repository is named `vishwanath33.github.io`, which is what makes GitHub
serve it from the root of that address; any other name would put the site
under `/<name>/`. When GitHub Actions builds the site, `src/_data/site.js`
reads the repository's name and sets the address and path prefix to match,
so a rename needs no code change, only a rebuild (push anything, or run the
workflow by hand). Until that rebuild, a renamed site's links are broken.

A real domain of your own, free, is available from
[eu.org](https://nic.eu.org/) (e.g. `yourname.eu.org`): registration is
manual and approval can take weeks. Once it is yours, follow the steps
below. (The popular `is-a.dev` subdomains are not an option for this site:
their terms exclude blogs not primarily about software development.)

### A custom domain

Buy the name from any registrar. [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/)
sells at cost (a `.com` is about $10/year); Porkbun and Namecheap are also
good. Then:

1. Set it in `src/_data/site.js` and push:

   ```js
   domain: "your-domain.example",
   ```

   The build writes `_site/CNAME` from that value, which is how GitHub
   Pages learns about it. Canonical URLs, the sitemap and the feed all
   follow the same setting.

2. At your registrar, point the domain at GitHub Pages. For an **apex**
   domain (`your-domain.example`):

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

   For a **subdomain** (`library.your-domain.example`), one record instead:

   ```
   CNAME  library  vishwanath33.github.io.
   ```

   > These addresses have been stable for years, but GitHub can change them.
   > Check them against the values shown in **Settings → Pages** once you've
   > entered the domain there.

3. **Settings → Pages → Custom domain**: enter the domain, save, and tick
   **Enforce HTTPS** once the certificate is issued (minutes, occasionally up
   to a day).

### If the repository goes private again

GitHub Pages then needs a paid plan. Set `sourcePublic: false` in `site.js`
so the history and source links are left out rather than left broken.
Cloudflare Pages is a free host that builds from private repositories:
connect the repository, set the build command to `npm run build` and the
output directory to `_site`, and put its `*.pages.dev` address in `hostUrl`.

---

## Layout

```
src/
  _data/site.js            ← title, domain, author, stage vocabulary
  _data/redirects.js       ← old addresses that forward to new ones
  _includes/layouts/       ← base (sheet over background), note, page
  assets/css/library.css   ← the whole visual system
  assets/js/lorenz.js      ← the background
  assets/js/plate.js       ← Plate I, the attractor as an instrument
  assets/js/graph.js       ← the neighbourhood figures and the map
  assets/js/library.js     ← search, sidenotes, theme, catalogue filter
  notes/*.md               ← the library
  index.njk  notes.njk  tags.njk  map.njk  about.md  colophon.md
  graph.njk  search.njk    ← graph.json and search.json
eleventy.config.js         ← wiki links, citations, accession numbers, search, feed
test/smoke.mjs             ← browser checks for the interactive parts
```

## Licence

Prose CC BY 4.0, code MIT. See `LICENSE`.
