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

  // The free address GitHub Pages serves this repository from. A project
  // page lives under /<repo>/; the path prefix is derived from this.
  hostUrl: "https://vishwanath33.github.io/Digital_Garden",

  // Repository, for "history & source" links.
  repo: "https://github.com/Vishwanath33/Digital_Garden",
  // HEAD resolves to whatever the default branch is called.
  repoBranch: "HEAD",

  // The repository is public, so each note links to its history and source.
  // Set to false if it ever goes private: the links are then left out
  // rather than left broken.
  sourcePublic: true,

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
