/**
 * Browser smoke test for the interactive parts of the library. Serves the
 * built site under the same path prefix GitHub Pages uses, then drives it
 * in Chromium. Run with `npm test` (which builds first).
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright-core";
import site from "../src/_data/site.js";

const ROOT = new URL("../_site/", import.meta.url).pathname;
const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".xml": "application/xml", ".txt": "text/plain", ".svg": "image/svg+xml", ".woff2": "font/woff2",
};

const PREFIX = site.pathPrefix;
const BASE = `http://127.0.0.1:8099${PREFIX}`;

const server = createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(req.url.split("?")[0]));
  if (PREFIX !== "/" && p.startsWith(PREFIX.slice(0, -1))) p = p.slice(PREFIX.length - 1) || "/";
  if (p.endsWith("/")) p += "index.html";
  try {
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(8099, "127.0.0.1", r));

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

// --- an entry, desktop -----------------------------------------------------
{
  const { ctx, p, problems } = await page();
  await p.goto(`${BASE}notes/lorenz-attractor/`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);

  check(problems.length === 0, `every request resolves and no script errors${problems.length ? " — " + problems.join(", ") : ""}`);
  check(await p.evaluate(() => getComputedStyle(document.body).fontFamily.includes("Source Sans 3")), "stylesheet applied (Source Sans 3 in effect)");
  check(await p.evaluate(() => document.fonts.check('16px "Source Sans 3"') && document.fonts.check('16px "Lora"')), "self-hosted fonts loaded");

  // Layout furniture.
  check((await p.locator(".crumbs").innerText()).includes("Chaos"), "breadcrumbs show the shelf");
  check(await p.locator(".stacks details[open] > summary", { hasText: "Chaos" }).count() === 1, "Explore opens the current shelf");
  check(await p.locator('.stacks a[aria-current="page"]').count() === 1, "Explore marks the current entry");
  check((await p.locator(".backlinks").innerText()).includes("Sensitive dependence"), "Backlinks lists the citing entry");
  check(await p.locator(".toc-list li").count() === 3, "Contents built from the entry's headings");

  // Sidenotes: the card is wide enough at 1920 for the margin.
  check(await p.locator(".sidenote").first().isVisible(), "sidenote shown in the card's margin");
  const sn = await p.locator(".sidenote").first().boundingBox();
  const prose = await p.locator(".prose").boundingBox();
  check(sn && prose && sn.x > prose.x + prose.width - 240, "sidenote sits right of the text column");
  check(!(await p.locator(".footnotes").isVisible()), "redundant endnote list hidden");

  // Graph View.
  const local = await p.evaluate(() => {
    const g = window.__graph.local;
    return { n: g.nodes.length, hasCurrent: g.nodes.some((x) => x.id === document.body.dataset.page) };
  });
  check(local.n >= 3 && local.hasCurrent, `local graph shows the entry and its neighbours (${local.n} nodes)`);
  check(await canvasPainted(p, '[data-graph="local"]'), "local graph is drawn");

  await p.click("[data-graph-expand]");
  await p.waitForTimeout(600);
  const all = await p.evaluate(() => fetch(document.getElementById("graph-src").href).then((r) => r.json()));
  check(await p.locator("[data-graph-overlay]").isVisible(), "expand opens the whole-library graph");
  check(await p.evaluate(() => window.__graph.global.nodes.length) === all.nodes.length, `overlay graph shows every node (${all.nodes.length})`);
  await p.keyboard.press("Escape");
  check(!(await p.locator("[data-graph-overlay]").isVisible()), "Escape closes the graph");

  // Clicking a node opens that entry.
  const target = await p.evaluate(() => {
    const g = window.__graph.local;
    const n = g.nodes.find((x) => x.type === "note" && x.id !== document.body.dataset.page);
    const [x, y] = g.toScreen(n);
    const r = g.canvas.getBoundingClientRect();
    return { x: r.left + x, y: r.top + y, href: n.href };
  });
  await Promise.all([p.waitForURL((u) => u.pathname === target.href), p.mouse.click(target.x, target.y)]);
  check(new URL(p.url()).pathname === target.href, "clicking a graph node opens it");

  // Theme: two states, persisted.
  await p.goto(`${BASE}notes/lorenz-attractor/`, { waitUntil: "networkidle" });
  const before = await p.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  await p.click("[data-theme-toggle]");
  const after = await p.getAttribute("html", "data-theme");
  check(after && after !== before, `theme toggle switches ${before} → ${after}`);
  check(await p.evaluate(() => localStorage.getItem("library-theme")) === after, "theme choice persisted");

  // The attractor switch.
  check(await p.evaluate(() => window.__lorenz.running), "attractor running");
  await p.click("[data-motion-toggle]");
  check(await p.evaluate(() => !window.__lorenz.running) && (await p.getAttribute("[data-motion-toggle]", "aria-pressed")) === "true", "badge pauses the attractor");
  await p.click("[data-motion-toggle]");
  check(await p.evaluate(() => window.__lorenz.running), "badge resumes the attractor");

  check(await p.evaluate(() => getComputedStyle(document.querySelector(".header-anchor")).opacity === "0"), "heading permalink hidden until hover");
  await ctx.close();
}

// --- search ------------------------------------------------------------------
{
  const { ctx, p } = await page();
  await p.goto(BASE, { waitUntil: "networkidle" });
  check(await p.locator("svg.bookshelf").count() === 1, "home page carries the engraved banner");

  await p.keyboard.press("/");
  await p.waitForTimeout(150);
  check(await p.locator("[data-search]").isVisible(), "'/' opens search");
  await p.keyboard.type("forecast");
  await p.waitForTimeout(400);
  const titles = await p.locator(".search__title").allInnerTexts();
  check(titles.length >= 1 && titles[0].startsWith("Sensitive dependence"), `search ranks the best match first (${titles.length} results)`);
  check(await p.locator(".search__result mark").count() > 0, "search highlights matched terms");

  await p.keyboard.press("ArrowDown");
  check((await p.locator('.search__result[aria-selected="true"]').count()) === 1 &&
        (await p.locator(".search__result").nth(1).getAttribute("aria-selected")) === "true", "arrow keys move the selection");
  await p.keyboard.press("ArrowUp");
  const href = await p.locator(".search__result a").first().getAttribute("href");
  await Promise.all([p.waitForURL((u) => u.pathname === href), p.keyboard.press("Enter")]);
  check(new URL(p.url()).pathname === href, "Enter opens the selected result");

  await p.keyboard.press("Control+k");
  check(await p.locator("[data-search]").isVisible(), "Ctrl+K opens search");
  await p.keyboard.type("zzzqqq");
  await p.waitForTimeout(250);
  check(await p.locator("[data-search-empty]").isVisible(), "search says when nothing matches");
  await p.keyboard.press("Escape");
  check(!(await p.locator("[data-search]").isVisible()), "Escape closes search");
  await ctx.close();
}

// --- reshelved entries still land ---------------------------------------------
{
  const { ctx, p } = await page();
  for (const [from, to] of [["notes/digital-gardens/", "notes/a-library-not-a-blog/"], ["notes/tending/", "notes/keeping-the-stacks/"]]) {
    await p.goto(`${BASE}${from}`);
    await p.waitForURL((u) => u.pathname.endsWith(to), { timeout: 5000 }).catch(() => {});
    check(new URL(p.url()).pathname === `${PREFIX}${to}`, `old address /${from} forwards to /${to}`);
  }
  await ctx.close();
}

// --- catalogue filter --------------------------------------------------------
{
  const { ctx, p } = await page();
  await p.goto(`${BASE}notes/`, { waitUntil: "networkidle" });
  const total = await p.locator(".entry:visible").count();
  await p.fill("#filter", "chaos");
  await p.waitForTimeout(100);
  const filtered = await p.locator(".entry:visible").count();
  check(filtered === 2 && filtered < total, `catalogue filter narrows ${total} entries to ${filtered}`);
  await p.fill("#filter", "zzzznothing");
  await p.waitForTimeout(100);
  check(await p.locator("[data-filter-empty]").isVisible(), "catalogue shows its empty state");
  await p.locator("#filter").press("Escape");
  check(await p.locator(".entry:visible").count() === total, "Escape clears the filter");
  await ctx.close();
}

// --- a narrower desktop: sidenotes fold inline ------------------------------
{
  const { ctx, p } = await page({ viewport: { width: 1366, height: 900 } });
  await p.goto(`${BASE}notes/lorenz-attractor/`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  check(!(await p.locator(".sidenote").first().isVisible()), "narrow card: sidenote folded away");
  await p.locator(".sidenote-number").first().click();
  check(await p.locator(".sidenote").first().isVisible(), "narrow card: sidenote folds out when its number is clicked");
  await ctx.close();
}

// --- mobile --------------------------------------------------------------------
{
  const { ctx, p } = await page({ viewport: { width: 390, height: 844 } });
  await p.goto(`${BASE}notes/lorenz-attractor/`, { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scroll on a phone");
  const order = await p.evaluate(() =>
    [".brand", ".card", ".explore", ".graph-panel"].map((s) => document.querySelector(s).getBoundingClientRect().top),
  );
  check(order.every((v, i) => i === 0 || v > order[i - 1]), "phone order: title, page, shelves, graph");
  check(!(await p.locator(".sidenote").first().isVisible()), "phone: sidenote folded away");
  await p.locator(".sidenote-number").first().click();
  check(await p.locator(".sidenote").first().isVisible(), "phone: sidenote folds out when tapped");
  await ctx.close();
}

// --- reduced motion ------------------------------------------------------------
{
  const { ctx, p } = await page({ reducedMotion: "reduce" });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  check(await p.evaluate(() => !window.__lorenz.running), "attractor still under prefers-reduced-motion");
  check(await canvasPainted(p, "#lorenz"), "…but it renders one frame");
  check(await canvasPainted(p, '[data-graph="local"]'), "…and the graph still draws");
  await ctx.close();
}

await browser.close();
server.close();

console.log(`PASS (${ok.length}):\n  ${ok.join("\n  ")}`);
if (bad.length) console.log(`\nFAIL (${bad.length}):\n  ${bad.join("\n  ")}`);
else console.log("\nall checks passed");
process.exit(bad.length ? 1 : 0);
