// ---------------------------------------------------------------------------
// The one file to edit when you rename the garden or move it to a new domain.
// ---------------------------------------------------------------------------
export default {
  title: "The Lorenz Garden",
  tagline: "Notes that grow in public.",
  description:
    "A digital garden: unfinished notes, slowly tended. Sensitive to initial conditions.",
  author: {
    name: "Vishwanath",
    email: "vishwanath.221b@gmail.com",
  },

  // Set `domain` to your custom domain once you own one (e.g. "lorenz.garden").
  // Leave it null to serve from the free host address below.
  domain: null,

  // The free address the host gives you. Cloudflare Pages uses
  // https://<project-name>.pages.dev — paste the real one here after the
  // first deploy. Only absolute URLs (canonical, feed, sitemap) use it;
  // internal links work regardless.
  hostUrl: "https://lorenz-garden.pages.dev",

  // Repository, for "history & source" links.
  repo: "https://github.com/Vishwanath33/Digital_Garden",
  // HEAD resolves to whatever the default branch is called.
  repoBranch: "HEAD",

  // Readers cannot open a private repository, so while this is false the
  // source, history and issue links are left out rather than left broken.
  // Set it to true if you ever make the repository public.
  sourcePublic: false,

  get url() {
    return (this.domain ? `https://${this.domain}` : this.hostUrl).replace(/\/$/, "");
  },

  get origin() {
    return new URL(this.url).origin;
  },

  // "/" at a domain root; "/<repo>/" if ever served from a GitHub project
  // page. Eleventy rewrites every internal link with it, so nothing else
  // has to know which is in play.
  get pathPrefix() {
    const path = new URL(this.url).pathname.replace(/\/?$/, "/");
    return path;
  },

  // Growth stages, in the gardening idiom: a note's maturity, not its length.
  stages: {
    seedling: {
      label: "seedling",
      glyph: "◌",
      blurb: "Just planted. Rough, possibly wrong, thinking out loud.",
    },
    budding: {
      label: "budding",
      glyph: "◔",
      blurb: "Taking shape. The argument holds, the edges do not.",
    },
    evergreen: {
      label: "evergreen",
      glyph: "●",
      blurb: "Tended and stable. Still revised, but I stand behind it.",
    },
  },
};
