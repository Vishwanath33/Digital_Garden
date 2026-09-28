import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";
import { EleventyHtmlBasePlugin } from "@11ty/eleventy";
import markdownItFootnote from "markdown-it-footnote";
import markdownItAnchor from "markdown-it-anchor";
import markdownItAttrs from "markdown-it-attrs";
import siteData from "./src/_data/site.js";

const NOTES_GLOB = "src/notes/*.md";
const NOTE_URL = (slug) => `/notes/${slug}/`;

/** Prefix a site-relative URL for places the HTML base plugin cannot reach (JSON). */
const withBase = (url) => siteData.pathPrefix.replace(/\/$/, "") + url;

/** `[[slug]]` and `[[slug|shown text]]` become ordinary internal links. */
function expandWikiLinks(content) {
  return content.replace(/\[\[([^\]|#]+?)(?:#([^\]|]+?))?(?:\|([^\]]+?))?\]\]/g, (_m, slug, hash, label) => {
    const target = NOTE_URL(slug.trim()) + (hash ? `#${hash.trim()}` : "");
    const text = (label || slug).trim();
    return `[${text}](${target}){.wikilink}`;
  });
}

/**
 * Every note URL a note's Markdown source points at, via wiki links or
 * ordinary links. Read from the source so it works before rendering, and
 * shared by backlinks, the graph and the broken-link report.
 */
function outgoing(note) {
  const raw = fs.readFileSync(note.inputPath, "utf8");
  const targets = new Set();
  for (const [, slug] of raw.matchAll(/\[\[([^\]|#]+?)(?:[#|][^\]]*)?\]\]/g)) {
    targets.add(NOTE_URL(slug.trim()));
  }
  for (const [, href] of raw.matchAll(/\]\((\/notes\/[^)\s#]+\/?)[^)]*\)/g)) {
    targets.add(href.endsWith("/") ? href : `${href}/`);
  }
  targets.delete(note.url);
  return targets;
}

const published = (api) => api.getFilteredByGlob(NOTES_GLOB).filter((n) => !n.data.draft);
const byTitle = (a, b) => a.localeCompare(b, "en", { sensitivity: "base" });

export default function (eleventyConfig) {
  // Captured so paired shortcodes can render Markdown in their bodies; an
  // <aside> opens an HTML block, inside which markdown-it would not look.
  let md;
  eleventyConfig.setLiquidOptions({ jsTruthy: true });
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);

  // --- passthrough + watch ------------------------------------------------
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/static": "." });
  // Self-hosted type: no third-party font requests.
  eleventyConfig.addPassthroughCopy({
    "node_modules/@fontsource-variable/newsreader/files/newsreader-latin-standard-*.woff2": "assets/fonts",
    // Globs, both: a plain file path here would be copied *to* assets/fonts
    // as a file, not into it as a folder.
    "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-{400-normal,500-normal,400-italic}.woff2": "assets/fonts",
  });
  eleventyConfig.addWatchTarget("src/assets/");

  // --- markdown -----------------------------------------------------------
  eleventyConfig.amendLibrary("md", (lib) => {
    md = lib;
    // Curly quotes and real dashes: a library should be typeset.
    md.set({ typographer: true });
    md.use(markdownItFootnote)
      .use(markdownItAttrs)
      .use(markdownItAnchor, {
        permalink: markdownItAnchor.permalink.linkAfterHeader({
          style: "visually-hidden",
          assistiveText: (title) => `Permalink to “${title}”`,
          visuallyHiddenClass: "sr-only",
          wrapper: ['<div class="heading-wrap">', "</div>"],
        }),
        level: [2, 3, 4],
        slugify: (s) =>
          s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-"),
      });

    // Footnote markup that the sidenote script can relocate into the margin.
    md.renderer.rules.footnote_block_open = () =>
      '<section class="footnotes" role="doc-endnotes">\n<h2 class="footnotes-title">Notes</h2>\n<ol class="footnotes-list">\n';
    md.renderer.rules.footnote_block_close = () => "</ol>\n</section>\n";

    // Mark outbound links so CSS can badge them.
    const defaultLinkOpen =
      md.renderer.rules.link_open ||
      ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
    md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
      const href = tokens[idx].attrGet("href") || "";
      if (/^https?:\/\//.test(href)) {
        tokens[idx].attrJoin("class", "external");
        tokens[idx].attrSet("rel", "noopener");
      }
      return defaultLinkOpen(tokens, idx, options, env, self);
    };
  });

  eleventyConfig.addPreprocessor("wikilinks", "md", (_data, content) =>
    expandWikiLinks(content),
  );

  // --- collections --------------------------------------------------------
  eleventyConfig.addCollection("notes", (api) =>
    published(api).sort((a, b) => (b.data.updated || b.date) - (a.data.updated || a.date)),
  );

  // Subjects: the tag index.
  eleventyConfig.addCollection("tagIndex", (api) => {
    const index = new Map();
    for (const note of published(api)) {
      for (const tag of note.data.tags || []) {
        if (!index.has(tag)) index.set(tag, []);
        index.get(tag).push(note);
      }
    }
    return [...index.entries()]
      .map(([tag, notes]) => ({ tag, notes, count: notes.length }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  });

  /** Backlinks: who points here? Keyed by the note's (unprefixed) URL. */
  eleventyConfig.addCollection("backlinks", (api) => {
    const notes = published(api);
    const known = new Set(notes.map((n) => n.url));
    const links = {};
    for (const note of notes) {
      for (const target of outgoing(note)) {
        if (!known.has(target)) continue;
        (links[target] ||= []).push({
          url: note.url,
          title: note.data.title,
          summary: note.data.summary || "",
        });
      }
    }
    for (const list of Object.values(links)) list.sort((a, b) => byTitle(a.title, b.title));
    return links;
  });

  // Links to notes that do not exist yet.
  eleventyConfig.addCollection("brokenLinks", (api) => {
    const notes = published(api);
    const known = new Set(notes.map((n) => n.url));
    return notes.flatMap((note) =>
      [...outgoing(note)].filter((t) => !known.has(t)).map((t) => ({ from: note.data.title, to: t })),
    );
  });

  /**
   * The graph: notes, the subjects they carry, and the links between them.
   * `id` is the unprefixed URL (what `page.url` gives a template); `href` is
   * what a browser should open.
   */
  eleventyConfig.addCollection("graph", (api) => {
    const notes = published(api);
    const known = new Set(notes.map((n) => n.url));
    const nodes = [];
    const links = [];
    const tags = new Set();

    for (const note of notes) {
      nodes.push({ id: note.url, href: withBase(note.url), title: note.data.title, type: "note" });
      for (const target of outgoing(note)) {
        if (known.has(target)) links.push({ source: note.url, target });
      }
      for (const tag of note.data.tags || []) {
        tags.add(tag);
        links.push({ source: note.url, target: `tag:${tag}` });
      }
    }
    for (const tag of tags) {
      nodes.push({ id: `tag:${tag}`, href: withBase(`/tags/#${tag}`), title: `#${tag}`, type: "tag" });
    }
    return { nodes, links };
  });

  /**
   * Accession numbers: entries numbered in the order they were written, as a
   * library numbers what it acquires. The call number prefixes the shelf.
   */
  eleventyConfig.addCollection("accession", (api) => {
    const notes = published(api).sort(
      (a, b) => (a.data.created || a.date) - (b.data.created || b.date) || byTitle(a.data.title, b.data.title),
    );
    const out = {};
    notes.forEach((n, i) => {
      const number = String(i + 1).padStart(3, "0");
      const shelf = String(n.data.shelf || "").split("/")[0].trim();
      const prefix = shelf ? shelf.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() : "GN";
      out[n.url] = { number, call: `${prefix} ${number}` };
    });
    return out;
  });

  /** What each entry cites: the other half of backlinks. */
  eleventyConfig.addCollection("cites", (api) => {
    const notes = published(api);
    const byUrl = new Map(notes.map((n) => [n.url, n]));
    const out = {};
    for (const note of notes) {
      out[note.url] = [...outgoing(note)]
        .filter((u) => byUrl.has(u))
        .map((u) => ({ url: u, title: byUrl.get(u).data.title }))
        .sort((a, b) => byTitle(a.title, b.title));
    }
    return out;
  });

  /**
   * Parts of the book: entries grouped by top-level shelf, for the contents
   * on the title page. Unshelved entries come first, as general matter.
   */
  eleventyConfig.addCollection("parts", (api) => {
    const groups = new Map();
    for (const n of published(api)) {
      const shelf = String(n.data.shelf || "").split("/")[0].trim();
      if (!groups.has(shelf)) groups.set(shelf, []);
      groups.get(shelf).push(n);
    }
    const order = [...groups.keys()].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : byTitle(a, b)));
    const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    return order.map((shelf, i) => ({
      numeral: roman[i] || String(i + 1),
      name: shelf || "General",
      notes: groups.get(shelf).sort((a, b) => (a.data.created || a.date) - (b.data.created || b.date)),
    }));
  });

  // --- filters ------------------------------------------------------------
  const zone = "utc";
  eleventyConfig.addFilter("readableDate", (d) =>
    d ? DateTime.fromJSDate(new Date(d), { zone }).toFormat("d LLLL yyyy") : "",
  );
  eleventyConfig.addFilter("shortDate", (d) =>
    d ? DateTime.fromJSDate(new Date(d), { zone }).toFormat("yyyy-LL-dd") : "",
  );
  eleventyConfig.addFilter("isoDate", (d) =>
    d ? DateTime.fromJSDate(new Date(d), { zone }).toISO() : "",
  );

  eleventyConfig.addFilter("head", (arr, n) => {
    if (!Array.isArray(arr)) return [];
    return n < 0 ? arr.slice(n) : arr.slice(0, n);
  });
  eleventyConfig.addFilter("lookup", (obj, key) => (obj ? obj[key] : undefined));
  // page.url has no path prefix (Eleventy adds it at output time), so
  // absolute URLs for feeds, sitemaps and metadata must add it here.
  eleventyConfig.addFilter("fullUrl", (url) => new URL(withBase(url), siteData.origin).href);
  eleventyConfig.addFilter("withBase", withBase);
  eleventyConfig.addFilter("jsonify", (v) => JSON.stringify(v));
  eleventyConfig.addFilter("split", (s, sep) => String(s || "").split(sep).filter(Boolean));

  const plain = (html) =>
    String(html || "")
      .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  eleventyConfig.addFilter("stripTags", plain);

  eleventyConfig.addFilter("readingTime", (content) => {
    const words = plain(content).split(/\s+/).length;
    return Math.max(1, Math.round(words / 220));
  });

  // Group notes by year for the catalogue.
  eleventyConfig.addFilter("byYear", (notes) => {
    const groups = new Map();
    for (const note of notes) {
      const y = DateTime.fromJSDate(new Date(note.data.updated || note.date), { zone }).toFormat("yyyy");
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y).push(note);
    }
    return [...groups.entries()]
      .map(([y, items]) => ({ year: y, notes: items }))
      .sort((a, b) => Number(b.year) - Number(a.year));
  });

  /** The search index: one record per note, text capped to keep it small. */
  eleventyConfig.addFilter("searchIndex", (notes, accession = {}) =>
    JSON.stringify(
      notes.map((n) => ({
        href: withBase(n.url),
        number: accession[n.url]?.number || "",
        title: n.data.title,
        summary: n.data.summary || "",
        shelf: n.data.shelf || "",
        tags: n.data.tags || [],
        // Drop heading permalinks and footnote back-references: they are
        // screen-reader furniture, not text anyone would search for.
        text: plain(
          String(n.content || "")
            .replace(/<a[^>]*class="header-anchor"[^>]*>[\s\S]*?<\/a>/g, " ")
            .replace(/<a[^>]*class="footnote-backref"[^>]*>[\s\S]*?<\/a>/g, " ")
            .replace(/<h2 class="footnotes-title">[\s\S]*?<\/h2>/g, " "),
        ).slice(0, 6000),
      })),
    ),
  );

  // --- shortcodes ---------------------------------------------------------
  eleventyConfig.addPairedShortcode("aside", (content, label = "") =>
    `<aside class="inline-aside">${label ? `<span class="aside-label">${label}</span>` : ""}${md.render(content.trim())}</aside>`,
  );

  eleventyConfig.addPairedShortcode("epigraph", (content, source = "") =>
    `<blockquote class="epigraph">${md.render(content.trim())}${source ? `<cite>${source}</cite>` : ""}</blockquote>`,
  );

  /**
   * Plate I: the Lorenz attractor as a running experiment, with its caption
   * and live readout. `{% plate %}` in an entry places it; plate.js runs it.
   */
  eleventyConfig.addShortcode("plate", () => `<figure class="plate" data-plate aria-labelledby="plate-caption">
  <div class="plate__bar" data-plate-bar>
    <span class="plate__label">Plate I</span>
    <span class="plate__controls">
      <button type="button" data-plate-toggle aria-pressed="false">Pause</button>
      <button type="button" data-plate-rerun>Re-run</button>
    </span>
  </div>
  <canvas data-plate-canvas aria-hidden="true"></canvas>
  <figcaption class="plate__caption" data-plate-caption id="plate-caption">
    <p class="plate__title">
      <em>The Lorenz attractor.</em> σ&#8202;=&#8202;10, ρ&#8202;=&#8202;28, β&#8202;=&#8202;8/3.
      Three trajectories from one point: <span class="traj traj--b">b</span> and
      <span class="traj traj--c">c</span> begin 10⁻⁵ from <span class="traj traj--a">a</span>,
      and are strangers within a minute.
    </p>
    <dl class="readout">
      <div><dt>t</dt><dd data-readout="t">0.00</dd></div>
      <div><dt>a</dt><dd><span data-readout="x"></span> <span data-readout="y"></span> <span data-readout="z"></span></dd></div>
      <div><dt>|a−b|</dt><dd><span data-readout="delta"></span><canvas class="spark" data-spark aria-hidden="true"></canvas></dd></div>
    </dl>
  </figcaption>
</figure>`);

  // --- feed ---------------------------------------------------------------
  eleventyConfig.addPlugin(feedPlugin, {
    type: "atom",
    outputPath: "/feed.xml",
    collection: { name: "notes", limit: 30 },
    metadata: {
      language: "en",
      title: siteData.title,
      subtitle: siteData.description,
      // The feed plugin applies the path prefix itself.
      base: `${siteData.origin}/`,
      author: { name: siteData.author.name },
    },
  });

  // --- custom domain ------------------------------------------------------
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const cname = path.join(dir.output, "CNAME");
    if (siteData.domain) {
      fs.writeFileSync(cname, `${siteData.domain}\n`);
    } else if (fs.existsSync(cname)) {
      fs.rmSync(cname);
    }
    // GitHub Pages must not run Jekyll over the built output.
    fs.writeFileSync(path.join(dir.output, ".nojekyll"), "");
  });

  return {
    pathPrefix: siteData.pathPrefix,
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
