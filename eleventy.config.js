import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";
import { EleventyHtmlBasePlugin } from "@11ty/eleventy";
import markdownItFootnote from "markdown-it-footnote";
import markdownItAnchor from "markdown-it-anchor";
import markdownItAttrs from "markdown-it-attrs";
import siteData from "./src/_data/site.js";
import { bookshelf } from "./lib/bookshelf.js";

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
    "node_modules/@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-*.woff2": "assets/fonts",
    "node_modules/@fontsource-variable/lora/files/lora-latin-wght-*.woff2": "assets/fonts",
  });
  eleventyConfig.addWatchTarget("src/assets/");
  eleventyConfig.addWatchTarget("lib/");

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
   * The stacks: notes arranged by their `shelf` front matter ("Chaos", or
   * nested as "Method/Craft"). Notes without a shelf sit at the top level.
   * Shelves and notes are interleaved alphabetically, as on a real shelf.
   */
  eleventyConfig.addCollection("stacks", (api) => {
    const root = { name: "", shelves: new Map(), notes: [] };
    for (const note of published(api)) {
      let node = root;
      for (const part of String(note.data.shelf || "").split("/").map((s) => s.trim()).filter(Boolean)) {
        if (!node.shelves.has(part)) node.shelves.set(part, { name: part, shelves: new Map(), notes: [] });
        node = node.shelves.get(part);
      }
      node.notes.push({ title: note.data.title, url: note.url });
    }
    const flatten = (node, trail) =>
      [
        ...[...node.shelves.values()].map((s) => {
          const p = [...trail, s.name];
          return { type: "shelf", name: s.name, path: p.join("/"), children: flatten(s, p) };
        }),
        ...node.notes.map((n) => ({ type: "note", ...n })),
      ].sort((a, b) => byTitle(a.name || a.title, b.name || b.title));
    return flatten(root, []);
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
  eleventyConfig.addFilter("searchIndex", (notes) =>
    JSON.stringify(
      notes.map((n) => ({
        href: withBase(n.url),
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

  let shelfSvg;
  eleventyConfig.addShortcode("bookshelf", () => (shelfSvg ||= bookshelf()));

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
