/**
 * Progressive enhancement. Without JavaScript the library still reads:
 * footnotes stay footnotes, the theme follows the system, the catalogue is a
 * list, and the Explore tree is plain <details>.
 */
(() => {
  "use strict";

  const root = document.documentElement;
  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // --- theme --------------------------------------------------------------
  const THEME_KEY = "library-theme";
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
  const effectiveTheme = () => root.getAttribute("data-theme") || (systemDark.matches ? "dark" : "light");

  const themeButton = document.querySelector("[data-theme-toggle]");
  const paintTheme = () => {
    if (!themeButton) return;
    const other = effectiveTheme() === "dark" ? "Light" : "Dark";
    themeButton.textContent = other;
    themeButton.setAttribute("aria-label", `Switch to the ${other.toLowerCase()} theme`);
  };
  paintTheme();
  themeButton?.addEventListener("click", () => {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch { /* private mode: the choice just will not persist */ }
    paintTheme();
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: next } }));
  });
  systemDark.addEventListener?.("change", () => {
    if (!root.getAttribute("data-theme")) {
      paintTheme();
      document.dispatchEvent(new CustomEvent("themechange"));
    }
  });

  // --- footnotes become margin notes --------------------------------------
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

      // A checkbox, so the same markup can fold out inline on narrow cards
      // with no script of its own.
      const label = document.createElement("label");
      label.className = "sidenote-number";
      label.setAttribute("for", toggleId);
      label.title = "Note";
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

  // --- catalogue filter ---------------------------------------------------
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
        group.hidden = ![...group.querySelectorAll("[data-searchable]")].some((r) => !r.hidden);
      });
      if (empty) empty.hidden = shown !== 0;
    };

    filter.addEventListener("input", run);
    filter.form?.addEventListener("submit", (e) => e.preventDefault());
    filter.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        filter.value = "";
        run();
        filter.blur();
      }
    });
    run();
  }

  // --- search -------------------------------------------------------------
  const overlay = document.querySelector("[data-search]");
  const input = document.querySelector("[data-search-input]");
  const results = document.querySelector("[data-search-results]");
  const emptyMsg = document.querySelector("[data-search-empty]");
  const source = document.getElementById("search-src");

  if (overlay && input && results && source) {
    let index = null;
    let loading = null;
    let hits = [];
    let selected = 0;
    let opener = null;

    const load = () =>
      (loading ||= fetch(source.href)
        .then((r) => r.json())
        .then((data) => {
          index = data.map((d) => ({
            ...d,
            _title: d.title.toLowerCase(),
            _summary: d.summary.toLowerCase(),
            _tags: d.tags.join(" ").toLowerCase(),
            _shelf: d.shelf.toLowerCase(),
            _text: d.text.toLowerCase(),
          }));
        })
        .catch(() => {
          index = [];
        }));

    // Every term must appear somewhere; where it appears decides the rank.
    const score = (d, terms) => {
      let total = 0;
      for (const t of terms) {
        let s = 0;
        if (d._title.includes(t)) s += new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(d._title) ? 14 : 9;
        if (d._tags.includes(t)) s += 6;
        if (d._summary.includes(t)) s += 4;
        if (d._shelf.includes(t)) s += 3;
        if (d._text.includes(t)) s += 1 + Math.min(3, d._text.split(t).length - 2);
        if (!s) return 0;
        total += s;
      }
      return total;
    };

    const highlight = (text, terms) => {
      let html = escapeHtml(text);
      for (const t of [...terms].sort((a, b) => b.length - a.length)) {
        const safe = escapeHtml(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        html = html.replace(new RegExp(`(${safe})(?![^<]*>)`, "gi"), "<mark>$1</mark>");
      }
      return html;
    };

    const snippet = (d, terms) => {
      const at = terms.map((t) => d._text.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
      if (at === undefined) return d.summary || d.text.slice(0, 160);
      const start = Math.max(0, d.text.lastIndexOf(" ", Math.max(0, at - 60)) + 1);
      const end = Math.min(d.text.length, at + 150);
      return `${start > 0 ? "…" : ""}${d.text.slice(start, end).trim()}${end < d.text.length ? "…" : ""}`;
    };

    const render = () => {
      const q = input.value.trim().toLowerCase();
      const terms = q.split(/\s+/).filter(Boolean);
      results.innerHTML = "";
      input.removeAttribute("aria-activedescendant");

      if (!terms.length || !index) {
        hits = [];
        emptyMsg.hidden = true;
        return;
      }

      hits = index
        .map((d) => ({ d, s: score(d, terms) }))
        .filter((h) => h.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 20)
        .map((h) => h.d);
      selected = 0;
      emptyMsg.hidden = hits.length > 0;

      results.innerHTML = hits
        .map((d, i) => {
          const where = [d.shelf || "General", ...d.tags.map((t) => `#${t}`)].join("  ·  ");
          return `<li class="search__result" role="option" id="search-hit-${i}" aria-selected="${i === 0}">
            <a href="${escapeHtml(d.href)}">
              <span class="search__call">${escapeHtml(d.number || "")}</span>
              <span>
                <span class="search__title">${highlight(d.title, terms)}</span>
                ${where ? `<span class="search__where">${escapeHtml(where)}</span>` : ""}
                <span class="search__snippet">${highlight(snippet(d, terms), terms)}</span>
              </span>
            </a>
          </li>`;
        })
        .join("");
      if (hits.length) input.setAttribute("aria-activedescendant", "search-hit-0");
    };

    const select = (i) => {
      if (!hits.length) return;
      selected = (i + hits.length) % hits.length;
      results.querySelectorAll(".search__result").forEach((li, j) => {
        li.setAttribute("aria-selected", String(j === selected));
        if (j === selected) li.scrollIntoView({ block: "nearest" });
      });
      input.setAttribute("aria-activedescendant", `search-hit-${selected}`);
    };

    const open = () => {
      if (!overlay.hidden) return;
      opener = document.activeElement;
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      input.focus();
      input.select();
      load().then(render);
    };

    const close = () => {
      if (overlay.hidden) return;
      overlay.hidden = true;
      document.body.style.overflow = "";
      opener?.focus?.();
    };

    input.addEventListener("input", () => (index ? render() : load().then(render)));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); select(selected + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); select(selected - 1); }
      else if (e.key === "Enter" && hits[selected]) { e.preventDefault(); window.location.href = hits[selected].href; }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close();
    });
    document.querySelectorAll("[data-search-open]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.preventDefault(); // some openers are links, for no-JS fallback
        open();
      }),
    );

    document.addEventListener("keydown", (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        overlay.hidden ? open() : close();
      } else if (e.key === "/" && !typing && overlay.hidden) {
        e.preventDefault();
        open();
      }
    });

    // Expose for the smoke test and for anything else that wants it.
    window.__search = { open, close };
  }
})();
