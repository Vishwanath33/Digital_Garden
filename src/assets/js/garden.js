/**
 * Progressive enhancement only. Every feature here degrades to something
 * readable with JavaScript switched off: footnotes stay footnotes, the theme
 * follows the system, the note list stays a list.
 */
(() => {
  "use strict";

  // --- theme --------------------------------------------------------------
  const THEME_KEY = "garden-theme";
  const root = document.documentElement;

  const applyTheme = (value) => {
    if (value === "light" || value === "dark") root.setAttribute("data-theme", value);
    else root.removeAttribute("data-theme");
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: value } }));
  };

  const currentTheme = () => {
    try {
      return localStorage.getItem(THEME_KEY) || "auto";
    } catch {
      return "auto";
    }
  };

  const themeButton = document.querySelector("[data-theme-toggle]");
  if (themeButton) {
    const order = ["auto", "light", "dark"];
    const labels = { auto: "Theme: auto", light: "Theme: light", dark: "Theme: dark" };
    const glyphs = { auto: "◐", light: "☀", dark: "☾" };

    const paint = (value) => {
      themeButton.setAttribute("aria-label", labels[value]);
      themeButton.setAttribute("title", `${labels[value]} — click to change`);
      themeButton.textContent = glyphs[value];
    };

    paint(currentTheme());
    themeButton.addEventListener("click", () => {
      const next = order[(order.indexOf(currentTheme()) + 1) % order.length];
      try {
        if (next === "auto") localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, next);
      } catch { /* private mode: the choice just will not persist */ }
      applyTheme(next);
      paint(next);
    });
  }

  // --- the attractor's off switch ----------------------------------------
  const motionButton = document.querySelector("[data-motion-toggle]");
  if (motionButton) {
    const paint = (running) => {
      motionButton.textContent = running ? "❉" : "✽";
      const label = running ? "Pause the attractor" : "Resume the attractor";
      motionButton.setAttribute("aria-label", label);
      motionButton.setAttribute("title", label);
      motionButton.setAttribute("aria-pressed", String(!running));
    };
    paint(Boolean(window.__lorenz && window.__lorenz.running));
    motionButton.addEventListener("click", () => {
      if (!window.__lorenz) return;
      paint(window.__lorenz.toggle());
    });
  }

  // --- footnotes become margin notes -------------------------------------
  const article = document.querySelector("[data-sidenotes]");
  if (article) {
    const notes = new Map();
    article.querySelectorAll(".footnotes-list > li").forEach((li) => {
      const clone = li.cloneNode(true);
      clone.querySelectorAll(".footnote-backref").forEach((el) => el.remove());
      notes.set(li.id, clone.innerHTML.trim());
    });

    article.querySelectorAll("sup.footnote-ref").forEach((sup, i) => {
      const anchor = sup.querySelector("a");
      if (!anchor) return;
      const id = decodeURIComponent(anchor.getAttribute("href") || "").slice(1);
      const body = notes.get(id);
      if (!body) return;

      const number = String(i + 1);
      const toggleId = `sidenote-${number}`;

      // A checkbox so the same markup can expand inline on narrow screens
      // without any script of its own.
      const label = document.createElement("label");
      label.className = "sidenote-number";
      label.setAttribute("for", toggleId);
      label.setAttribute("title", "Note");
      label.textContent = number;

      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.id = toggleId;
      toggle.className = "sidenote-toggle";

      const note = document.createElement("span");
      note.className = "sidenote";
      note.innerHTML = `<span class="sidenote-index">${number}</span> ${body}`;

      sup.replaceWith(label, toggle, note);
    });

    if (notes.size) article.classList.add("has-sidenotes");
  }

  // --- table of contents --------------------------------------------------
  const tocHost = document.querySelector("[data-toc]");
  const prose = document.querySelector(".prose");
  if (tocHost && prose) {
    const headings = [...prose.querySelectorAll("h2[id], h3[id]")];
    if (headings.length >= 3) {
      const list = document.createElement("ol");
      list.className = "toc-list";
      for (const h of headings) {
        const li = document.createElement("li");
        li.className = h.tagName === "H3" ? "toc-sub" : "toc-top";
        const a = document.createElement("a");
        a.href = `#${h.id}`;
        a.textContent = (h.textContent || "").replace(/¶\s*$/, "").trim();
        li.append(a);
        list.append(li);
      }
      tocHost.append(list);
      tocHost.hidden = false;

      // Highlight the section currently in view.
      const links = new Map(
        [...list.querySelectorAll("a")].map((a) => [a.getAttribute("href").slice(1), a]),
      );
      const seen = new Set();
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) seen.add(entry.target.id);
            else seen.delete(entry.target.id);
          }
          links.forEach((a, id) => a.classList.toggle("is-current", seen.has(id)));
        },
        { rootMargin: "-10% 0px -70% 0px" },
      );
      headings.forEach((h) => observer.observe(h));
    }
  }

  // --- live filter on the index ------------------------------------------
  const filter = document.querySelector("[data-filter]");
  if (filter) {
    const scope = document.querySelector(filter.dataset.filter) || document;
    const rows = [...scope.querySelectorAll("[data-searchable]")];
    const empty = document.querySelector("[data-filter-empty]");

    const run = () => {
      const q = filter.value.trim().toLowerCase();
      let shown = 0;
      for (const row of rows) {
        const hit = !q || (row.dataset.searchable || "").includes(q);
        row.hidden = !hit;
        if (hit) shown++;
      }
      // Year headings with nothing left under them step aside too.
      scope.querySelectorAll("[data-group]").forEach((group) => {
        const any = [...group.querySelectorAll("[data-searchable]")].some((r) => !r.hidden);
        group.hidden = !any;
      });
      if (empty) empty.hidden = shown !== 0;
    };

    filter.addEventListener("input", run);
    filter.form?.addEventListener("submit", (e) => e.preventDefault());

    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== filter) {
        e.preventDefault();
        filter.focus();
        filter.select();
      }
      if (e.key === "Escape" && document.activeElement === filter) {
        filter.value = "";
        run();
        filter.blur();
      }
    });
    run();
  }
})();
