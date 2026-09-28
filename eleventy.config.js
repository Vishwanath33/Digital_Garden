import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";
import { EleventyHtmlBasePlugin } from "@11ty/eleventy";
import markdownItFootnote from "markdown-it-footnote";
import markdownItAnchor from "markdown-it-anchor";
import markdownItAttrs from "markdown-it-attrs";
import siteData from "./src/_data/site.js";

const NOTE_URL = (slug) => `/notes/${slug}/`;

/** `[[slug]]` and `[[slug|shown text]]` become ordinary internal links. */
function expandWikiLinks(content) {
  return content.replace(/\[\[([^\]|#]+?)(?:#([^\]|]+?))?(?:\|([^\]]+?))?\]\]/g, (_m, slug, hash, label) => {
    const target = NOTE_URL(slug.trim()) + (hash ? `#${hash.trim()}` : "");
    const text = (label || slug).trim();
    return `[${text}](${target}){.wikilink}`;
  });
}

export default function (eleventyConfig) {
  // Captured so paired shortcodes can render Markdown in their bodies; an
  // <aside> opens an HTML block, inside which markdown-it would not look.
  let md;
  eleventyConfig.setLiquidOptions({ jsTruthy: true });
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);

  // --- passthrough + watch ------------------------------------------------
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/static": "." });
  eleventyConfig.addWatchTarget("src/assets/");

  // --- markdown -----------------------------------------------------------
  eleventyConfig.amendLibrary("md", (lib) => {
    md = lib;
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
    api
      .getFilteredByGlob("src/notes/*.md")
      .filter((n) => !n.data.draft)
      .sort((a, b) => (b.data.updated || b.date) - (a.data.updated || a.date)),
  );

  eleventyConfig.addCollection("tagIndex", (api) => {
    const index = new Map();
    for (const note of api.getFilteredByGlob("src/notes/*.md")) {
      if (note.data.draft) continue;
      for (const tag of note.data.tags || []) {
        if (!index.has(tag)) index.set(tag, []);
        index.get(tag).push(note);
      }
    }
    return [...index.entries()]
      .map(([tag, notes]) => ({ tag, notes, count: notes.length }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  });

  /**
   * Backlinks: who points here? Parsed from the markdown source so it works
   * before anything is rendered. Keyed by the note's output URL.
   */
  eleventyConfig.addCollection("backlinks", (api) => {
    const notes = api.getFilteredByGlob("src/notes/*.md").filter((n) => !n.data.draft);
    const byUrl = new Map(notes.map((n) => [n.url, n]));
    const links = {};

    for (const note of notes) {
      const raw = fs.readFileSync(note.inputPath, "utf8");
      const targets = new Set();

      for (const [, slug] of raw.matchAll(/\[\[([^\]|#]+?)(?:[#|][^\]]*)?\]\]/g)) {
        targets.add(NOTE_URL(slug.trim()));
      }
      for (const [, href] of raw.matchAll(/\]\((\/notes\/[^)\s#]+\/?)[^)]*\)/g)) {
        targets.add(href.endsWith("/") ? href : `${href}/`);
      }

      for (const target of targets) {
        if (target === note.url || !byUrl.has(target)) continue;
        (links[target] ||= []).push({
          url: note.url,
          title: note.data.title,
          summary: note.data.summary || "",
        });
      }
    }

    for (const list of Object.values(links)) {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return links;
  });

  // Notes that link *out* to a target that does not exist yet.
  eleventyConfig.addCollection("brokenLinks", (api) => {
    const notes = api.getFilteredByGlob("src/notes/*.md").filter((n) => !n.data.draft);
    const known = new Set(notes.map((n) => n.url));
    const broken = [];
    for (const note of notes) {
      const raw = fs.readFileSync(note.inputPath, "utf8");
      for (const [, slug] of raw.matchAll(/\[\[([^\]|#]+?)(?:[#|][^\]]*)?\]\]/g)) {
        const target = NOTE_URL(slug.trim());
        if (!known.has(target)) broken.push({ from: note.data.title, slug: slug.trim() });
      }
    }
    return broken;
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
  eleventyConfig.addFilter("year", (d) =>
    DateTime.fromJSDate(new Date(d || Date.now()), { zone }).toFormat("yyyy"),
  );

  eleventyConfig.addFilter("head", (arr, n) => {
    if (!Array.isArray(arr)) return [];
    return n < 0 ? arr.slice(n) : arr.slice(0, n);
  });

  eleventyConfig.addFilter("lookup", (obj, key) => (obj ? obj[key] : undefined));
  // page.url has no path prefix (Eleventy adds it at output time), so
  // absolute URLs for feeds, sitemaps and metadata must add it here.
  eleventyConfig.addFilter(
    "fullUrl",
    (url) => new URL(siteData.pathPrefix.replace(/\/$/, "") + url, siteData.origin).href,
  );
  eleventyConfig.addFilter("jsonify", (v) => JSON.stringify(v));

  eleventyConfig.addFilter("stripTags", (html) =>
    String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  );

  eleventyConfig.addFilter("excerpt", function (content, words = 34) {
    const text = String(content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const parts = text.split(" ");
    return parts.length <= words ? text : `${parts.slice(0, words).join(" ")}…`;
  });

  eleventyConfig.addFilter("readingTime", (content) => {
    const words = String(content || "").replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
    return Math.max(1, Math.round(words / 220));
  });

  // Group notes by year for the archive-style index.
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

  // --- shortcodes ---------------------------------------------------------
  eleventyConfig.addPairedShortcode("aside", (content, label = "") =>
    `<aside class="inline-aside">${label ? `<span class="aside-label">${label}</span>` : ""}${md.render(content.trim())}</aside>`,
  );

  eleventyConfig.addPairedShortcode("epigraph", (content, source = "") =>
    `<blockquote class="epigraph">${md.render(content.trim())}${source ? `<cite>${source}</cite>` : ""}</blockquote>`,
  );

  // --- feed ---------------------------------------------------------------
  eleventyConfig.addPlugin(feedPlugin, {
    type: "atom",
    outputPath: "/feed.xml",
    collection: { name: "notes", limit: 30 },
    metadata: {
      language: "en",
      title: siteData.title,
      subtitle: siteData.description,
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
