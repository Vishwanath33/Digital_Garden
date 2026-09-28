/**
 * Browser smoke test for the interactive parts of the library. Serves the
 * built site under the same path prefix GitHub Pages uses, then drives it
 * in Chromium. Run with `npm test` (which builds first).
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { cpSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright-core";
import site from "../src/_data/site.js";

const REPO = new URL("..", import.meta.url).pathname;
const FIXTURES = join(REPO, "test/fixtures/notes");
const ELEVENTY = join(REPO, "node_modules/@11ty/eleventy/cmd.cjs");
const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".xml": "application/xml", ".txt": "text/plain", ".svg": "image/svg+xml", ".woff2": "font/woff2",
};

/**
 * Build a throwaway copy of the site: exactly as published, or with the
 * sample entries in test/fixtures added, so every feature that needs
 * entries can be exercised without publishing any.
 */
const temps = [];
function build({ withFixtures }) {
  const dir = mkdtempSync(join(tmpdir(), "library-"));
  temps.push(dir);
  for (const f of ["eleventy.config.js", "package.json", "src"]) cpSync(join(REPO, f), join(dir, f), { recursive: true });
  symlinkSync(join(REPO, "node_modules"), join(dir, "node_modules"));
  if (withFixtures) for (const f of readdirSync(FIXTURES)) cpSync(join(FIXTURES, f), join(dir, "src/notes", f));
  execFileSync(process.execPath, [ELEVENTY, "--quiet"], { cwd: dir, stdio: "pipe" });
  return join(dir, "_site");
}

// Serve under the same path prefix GitHub Pages will use.
const PREFIX = site.pathPrefix;
function serve(root, port) {
  const server = createServer(async (req, res) => {
    let p = normalize(decodeURIComponent(req.url.split("?")[0]));
    if (PREFIX !== "/" && p.startsWith(PREFIX.slice(0, -1))) p = p.slice(PREFIX.length - 1) || "/";
    if (p.endsWith("/")) p += "index.html";
    try {
      const body = await readFile(join(root, p));
      res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((r) => server.listen(port, "127.0.0.1", () => r(server)));
}

const servers = [
  await serve(build({ withFixtures: true }), 8099),
  await serve(build({ withFixtures: false }), 8098),
];
const BASE = `http://127.0.0.1:8099${PREFIX}`;        // with sample entries
const EMPTY = `http://127.0.0.1:8098${PREFIX}`;       // as published

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const ok = [];
const bad = [];
const check = (cond, msg) => (cond ? ok : bad).push(msg);
const page = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ...opts });
  const p = await ctx.newPage();
  const problems = [];
  p.on("response", (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
  p.on("pageerror", (e) => problems.push(`error: ${e.message}`));
  return { ctx, p, problems };
};
const canvasPainted = (p, sel) =>
  p.evaluate((s) => {
    const c = document.querySelector(s);
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
    return false;
  }, sel);

// --- the background -------------------------------------------------------------
{
  const { ctx, p, problems } = await page();
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);

  check(problems.length === 0, `every request resolves and no script errors${problems.length ? " — " + problems.join(", ") : ""}`);
  check(await p.evaluate(() => document.fonts.check('20px "Newsreader"') && document.fonts.check('12px "IBM Plex Mono"')), "self-hosted fonts loaded (Newsreader, Plex Mono)");

  check(await p.evaluate(() => window.__lorenz.running), "background running");
  check(await canvasPainted(p, "[data-lorenz]"), "background drawn");
  check(await p.locator(".plate, [data-plate]").count() === 0, "no plate or caption: the attractor is background only");
  const bg = await p.evaluate(() => {
    const r = document.querySelector("[data-lorenz]").getBoundingClientRect();
    return { w: r.width, h: r.height, z: getComputedStyle(document.querySelector("[data-lorenz]")).zIndex, pos: getComputedStyle(document.querySelector("[data-lorenz]")).position };
  });
  check(bg.pos === "fixed" && bg.w === 1920 && bg.h === 1080, "background covers the whole screen, fixed");

  // The sheet keeps the text readable over it.
  const sheetAlpha = await p.evaluate(() => {
    const m = getComputedStyle(document.querySelector(".page")).backgroundColor.match(/rgba?\(([^)]+)\)/);
    const parts = m[1].split(",").map(Number);
    return parts.length === 4 ? parts[3] : 1;
  });
  check(sheetAlpha >= 0.8, `text sits on a sheet at least 80% opaque (${sheetAlpha})`);

  // Still / Motion, remembered.
  await p.click("[data-motion-toggle]");
  check(await p.evaluate(() => !window.__lorenz.running) && (await p.locator("[data-motion-toggle]").innerText()).toLowerCase() === "motion", "Still stops the background");
  check(await canvasPainted(p, "[data-lorenz]"), "…leaving it drawn, not blank");
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  check(await p.evaluate(() => !window.__lorenz.running), "the choice is remembered across pages");
  await p.click("[data-motion-toggle]");
  check(await p.evaluate(() => window.__lorenz.running), "Motion starts it again");

  // Theme: two states, named for the one it switches to, persisted.
  const label = await p.locator("[data-theme-toggle]").innerText();
  await p.click("[data-theme-toggle]");
  const after = await p.getAttribute("html", "data-theme");
  check(after === label.trim().toLowerCase(), `theme switch changes to ${after}`);
  check(await p.evaluate(() => localStorage.getItem("library-theme")) === after, "theme choice persisted");

  // Title page contents.
  check(await p.locator(".part").count() === 3, "contents grouped into three parts");
  check(await p.locator(".contents .toc__item").count() === 5, "contents lists every entry");
  await ctx.close();
}

// --- an entry ---------------------------------------------------------------------
{
  const { ctx, p, problems } = await page();
  await p.goto(`${BASE}notes/lorenz-attractor/`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1000);
  check(problems.length === 0, "entry: every request resolves");
  check((await p.locator(".kicker").innerText()).includes("CH 001"), "entry carries its call number");

  // Sidenotes in the outer margin at 1920.
  check(await p.locator(".sidenote").first().isVisible(), "sidenote shown in the outer margin");
  const sn = await p.locator(".sidenote").first().boundingBox();
  const prose = await p.locator(".prose").boundingBox();
  check(sn && prose && sn.x > prose.x + prose.width, "sidenote sits right of the text column");
  check(!(await p.locator(".footnotes").isVisible()), "redundant endnote list hidden");

  // The catalogue card.
  const card = await p.locator(".card").innerText();
  check(/1\. Chaos\. 2\. Mathematics\. 3\. Models\./.test(card), "card lists subject tracings");
  check(card.includes("Cited by") && card.includes("Sensitive dependence"), "card lists what cites the entry");
  check(card.includes("Cites") && card.includes("Epistemic status"), "card lists what the entry cites");

  // Its neighbourhood figure.
  const local = await p.evaluate(() => {
    const g = window.__graph.local;
    return { n: g.nodes.length, hasCurrent: g.nodes.some((x) => x.id === document.body.dataset.page) };
  });
  check(local.n >= 3 && local.hasCurrent, `neighbourhood figure shows the entry and its neighbours (${local.n} nodes)`);
  await p.locator("[data-graph]").scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  const target = await p.evaluate(() => {
    const g = window.__graph.local;
    const n = g.nodes.find((x) => x.type === "note" && x.id !== document.body.dataset.page);
    const [x, y] = g.toScreen(n);
    const r = g.canvas.getBoundingClientRect();
    return { x: r.left + x, y: r.top + y, href: n.href };
  });
  await Promise.all([p.waitForURL((u) => u.pathname === target.href), p.mouse.click(target.x, target.y)]);
  check(new URL(p.url()).pathname === target.href, "selecting a node opens that entry");

  check(await p.evaluate(() => getComputedStyle(document.querySelector(".header-anchor")).opacity === "0"), "heading permalink hidden until hover");
  await ctx.close();
}

// --- the map --------------------------------------------------------------------
{
  const { ctx, p } = await page();
  await p.goto(`${BASE}map/`, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  const all = await p.evaluate(() => fetch(document.getElementById("graph-src").href).then((r) => r.json()));
  check(await p.evaluate(() => window.__graph.global.nodes.length) === all.nodes.length, `map shows every node (${all.nodes.length})`);
  check(await canvasPainted(p, '[data-graph="global"]'), "map drawn");
  await ctx.close();
}

// --- search ------------------------------------------------------------------------
{
  const { ctx, p } = await page();
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.keyboard.press("/");
  await p.waitForTimeout(150);
  check(await p.locator("[data-search]").isVisible(), "'/' opens search");
  await p.keyboard.type("forecast");
  await p.waitForTimeout(400);
  const titles = await p.locator(".search__title").allInnerTexts();
  check(titles.length >= 1 && titles[0].startsWith("Sensitive dependence"), `search ranks the best match first (${titles.length} results)`);
  check((await p.locator(".search__call").first().innerText()).trim() === "004", "results carry accession numbers");
  check(await p.locator(".search__result mark").count() > 0, "search marks matched terms");
  await p.keyboard.press("ArrowDown");
  check((await p.locator(".search__result").nth(1).getAttribute("aria-selected")) === "true", "arrow keys move the selection");
  await p.keyboard.press("ArrowUp");
  const href = await p.locator(".search__result a").first().getAttribute("href");
  await Promise.all([p.waitForURL((u) => u.pathname === href), p.keyboard.press("Enter")]);
  check(new URL(p.url()).pathname === href, "return opens the selected result");
  await p.keyboard.press("Control+k");
  check(await p.locator("[data-search]").isVisible(), "Ctrl+K opens search");
  await p.keyboard.type("zzzqqq");
  await p.waitForTimeout(250);
  check(await p.locator("[data-search-empty]").isVisible(), "search says when nothing matches");
  await p.keyboard.press("Escape");
  check(!(await p.locator("[data-search]").isVisible()), "Escape closes search");
  await ctx.close();
}

// --- catalogue and subjects -------------------------------------------------------
{
  const { ctx, p } = await page();
  await p.goto(`${BASE}notes/`, { waitUntil: "networkidle" });
  const total = await p.locator(".toc__item:visible").count();
  await p.fill("#filter", "chaos");
  await p.waitForTimeout(100);
  const filtered = await p.locator(".toc__item:visible").count();
  check(filtered === 2 && filtered < total, `catalogue filter narrows ${total} entries to ${filtered}`);
  await p.fill("#filter", "zzzznothing");
  await p.waitForTimeout(100);
  check(await p.locator("[data-filter-empty]").isVisible(), "catalogue shows its empty state");
  await p.locator("#filter").press("Escape");
  check(await p.locator(".toc__item:visible").count() === total, "Escape clears the filter");

  await p.goto(`${BASE}tags/`, { waitUntil: "networkidle" });
  const heads = await p.locator(".subject__head").allInnerTexts();
  check(heads.length > 3 && heads.every((h, i) => i === 0 || heads[i - 1].localeCompare(h) <= 0), "subject index is alphabetical");
  await ctx.close();
}

// --- sidenotes by width: in the margin on a laptop, folded on a narrow sheet --------
{
  let { ctx, p } = await page({ viewport: { width: 1366, height: 900 } });
  await p.goto(`${BASE}notes/lorenz-attractor/`, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  check(await p.locator(".sidenote").first().isVisible(), "1366px: sidenote in the margin");
  await ctx.close();

  ({ ctx, p } = await page({ viewport: { width: 820, height: 900 } }));
  await p.goto(`${BASE}notes/lorenz-attractor/`, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  check(!(await p.locator(".sidenote").first().isVisible()), "820px: sidenote folded away");
  await p.locator(".sidenote-number").first().click();
  check(await p.locator(".sidenote").first().isVisible(), "820px: sidenote folds out when its number is clicked");
  await ctx.close();
}

// --- phone ----------------------------------------------------------------------------
{
  const { ctx, p } = await page({ viewport: { width: 390, height: 844 } });
  await p.goto(`${BASE}notes/lorenz-attractor/`, { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scroll on a phone");
  const order = await p.evaluate(() =>
    [".running-head", ".entry__title", ".foot"].map((s) => document.querySelector(s).getBoundingClientRect().top),
  );
  check(order.every((v, i) => i === 0 || v > order[i - 1]), "phone order: running head, text, foot");
  check(await p.evaluate(() => document.querySelector(".page").getBoundingClientRect().top < 40), "phone: an entry starts at the top of the screen");
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  check(await p.evaluate(() => document.querySelector(".page").getBoundingClientRect().top > innerHeight * 0.3), "phone: the home page opens on the background, like a cover");
  check(await p.evaluate(() => window.__lorenz.running), "phone: background running");
  await ctx.close();
}

// --- reduced motion ------------------------------------------------------------------
{
  const { ctx, p } = await page({ reducedMotion: "reduce" });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  check(await p.evaluate(() => !window.__lorenz.running), "background does not move under prefers-reduced-motion");
  check(await canvasPainted(p, "[data-lorenz]"), "…but is drawn, as a still figure");
  check(await p.locator("[data-motion-toggle]").isHidden(), "…and the Still switch, which would do nothing, is hidden");
  await ctx.close();
}

// --- the site as published: no entries yet -------------------------------------
{
  const { ctx, p, problems } = await page();
  for (const path of ["", "notes/", "tags/", "map/", "about/", "colophon/", "404.html"]) {
    await p.goto(`${EMPTY}${path}`, { waitUntil: "networkidle" });
  }
  check(problems.length === 0, `empty site: every page loads cleanly${problems.length ? " — " + problems.join(", ") : ""}`);

  await p.goto(EMPTY, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  check((await p.locator(".contents .empty-note").innerText()).includes("empty"), "empty site: contents say the shelves are empty");
  check(await p.locator(".foreword").count() === 0, "empty site: no introduction on the home page");
  check(await p.evaluate(() => window.__lorenz.running) && (await canvasPainted(p, "[data-lorenz]")), "empty site: background running");

  await p.keyboard.press("/");
  await p.keyboard.type("library");
  await p.waitForTimeout(400);
  check(await p.locator("[data-search-empty]").isVisible(), "empty site: search opens and finds nothing, cleanly");
  await p.keyboard.press("Escape");

  await p.goto(`${EMPTY}notes/`, { waitUntil: "networkidle" });
  check(await p.locator(".toc__item").count() === 0 && (await p.locator(".empty-note").innerText()).includes("catalogued"), "empty site: catalogue is empty and says so");
  await p.goto(`${EMPTY}map/`, { waitUntil: "networkidle" });
  check(await p.locator("canvas[data-graph]").count() === 0 && (await p.locator(".empty-note").count()) === 1, "empty site: map says there is nothing to map");
  const feed = await (await p.request.get(`${EMPTY}feed.xml`)).text();
  check(feed.includes("<feed") && !feed.includes("<entry>"), "empty site: feed is valid and has no entries");
  await ctx.close();
}

await browser.close();
servers.forEach((srv) => srv.close());
temps.forEach((dir) => rmSync(dir, { recursive: true, force: true }));

console.log(`PASS (${ok.length}):\n  ${ok.join("\n  ")}`);
if (bad.length) console.log(`\nFAIL (${bad.length}):\n  ${bad.join("\n  ")}`);
else console.log("\nall checks passed");
process.exit(bad.length ? 1 : 0);
