import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright-core";
import site from "../src/_data/site.js";

const ROOT = new URL("../_site/", import.meta.url).pathname;
const TYPES = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".xml": "application/xml", ".txt": "text/plain", ".svg": "image/svg+xml",
};

// Serve under the same path prefix GitHub Pages will use, so the test
// exercises the real URLs rather than a root-mounted approximation.
const PREFIX = site.pathPrefix;
const BASE = `http://127.0.0.1:8099${PREFIX}`;

const server = createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(req.url.split("?")[0]));
  if (PREFIX !== "/" && p.startsWith(PREFIX.slice(0, -1))) {
    p = p.slice(PREFIX.length - 1) || "/";
  }
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

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ok = [], bad = [];
const check = (c, m) => (c ? ok : bad).push(m);

// --- desktop ---
let ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
let p = await ctx.newPage();
const missing = [];
p.on("response", (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });
await p.goto(`${BASE}notes/lorenz-attractor/`, { waitUntil: "networkidle" });
await p.waitForTimeout(1200);

check(missing.length === 0, `every asset the page requests resolves${missing.length ? " — " + missing.join(", ") : ""}`);
check(await p.evaluate(() => getComputedStyle(document.body).fontFamily.includes("Iowan")),
  "stylesheet actually applied (serif stack in effect)");
check(await p.locator(".sidenote").first().isVisible(), "sidenote visible in margin on desktop");
check(!(await p.locator(".footnotes").first().isVisible().catch(() => false)), "redundant endnote list hidden when sidenotes active");
const sn = await p.locator(".sidenote").first().boundingBox();
check(sn && sn.x > 700, `sidenote sits in the right margin (x=${Math.round(sn?.x)})`);
check(await p.locator(".toc-list li").count() === 3, "TOC generated with 3 headings");

// theme toggle cycles auto -> light -> dark
await p.click("[data-theme-toggle]");
check((await p.getAttribute("html", "data-theme")) === "light", "theme toggle -> light");
await p.click("[data-theme-toggle]");
check((await p.getAttribute("html", "data-theme")) === "dark", "theme toggle -> dark");
check(await p.evaluate(() => localStorage.getItem("garden-theme")) === "dark", "theme persisted to localStorage");
await p.click("[data-theme-toggle]");
check((await p.getAttribute("html", "data-theme")) === null, "theme toggle -> auto");

// attractor pause
check(await p.evaluate(() => window.__lorenz.running), "attractor running");
await p.click("[data-motion-toggle]");
check(await p.evaluate(() => !window.__lorenz.running), "attractor pauses on click");
await p.click("[data-motion-toggle]");
check(await p.evaluate(() => window.__lorenz.running), "attractor resumes on click");

// heading permalink hidden until hover
check(await p.evaluate(() => getComputedStyle(document.querySelector(".header-anchor")).opacity === "0"), "heading permalink hidden until hover");

// --- index filter ---
await p.goto(`${BASE}notes/`, { waitUntil: "networkidle" });
const total = await p.locator(".entry:visible").count();
await p.fill("#filter", "chaos");
await p.waitForTimeout(150);
const filtered = await p.locator(".entry:visible").count();
check(filtered === 2 && filtered < total, `filter narrows ${total} entries to ${filtered} for "chaos"`);
await p.fill("#filter", "zzzznothing");
await p.waitForTimeout(150);
check(await p.locator("[data-filter-empty]").isVisible(), "empty state shown when nothing matches");
await p.keyboard.press("Escape");
await p.waitForTimeout(150);
check(await p.locator(".entry:visible").count() === total, "Escape clears the filter");
await ctx.close();

// --- mobile: sidenotes fold out inline ---
ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
p = await ctx.newPage();
await p.goto(`${BASE}notes/lorenz-attractor/`, { waitUntil: "networkidle" });
await p.waitForTimeout(800);
check(!(await p.locator(".sidenote").first().isVisible()), "sidenote collapsed on mobile");
await p.locator(".sidenote-number").first().click();
await p.waitForTimeout(200);
check(await p.locator(".sidenote").first().isVisible(), "sidenote expands inline when tapped");
await ctx.close();

// --- reduced motion ---
ctx = await b.newContext({ viewport: { width: 1200, height: 800 }, reducedMotion: "reduce" });
p = await ctx.newPage();
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
check(await p.evaluate(() => !window.__lorenz.running), "attractor does not animate under prefers-reduced-motion");
check(await p.evaluate(() => {
  const c = document.getElementById("lorenz");
  const x = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < x.length; i += 4) if (x[i] > 0) return true;
  return false;
}), "…but still renders one still frame");
await ctx.close();

await b.close();
console.log("PASS:\n  " + ok.join("\n  "));
console.log(bad.length ? "\nFAIL:\n  " + bad.join("\n  ") : "\nall checks passed");
server.close();
process.exit(bad.length ? 1 : 0);
