// ---------------------------------------------------------------------------
// The one file to edit when you rename the library or move it to a new domain.
// ---------------------------------------------------------------------------
export default {
  title: "The Lorenz Library",
  tagline: "A small library, sensitive to initial conditions.",
  description:
    "A personal library of linked notes: catalogued, revised, and shelved by subject.",
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

  // Stages, borrowed from bookmaking: how finished an entry is, not how long.
  stages: {
    manuscript: {
      label: "manuscript",
      glyph: "○",
      blurb: "A working draft. Thinking out loud; parts of it are probably wrong.",
    },
    proof: {
      label: "proof",
      glyph: "◐",
      blurb: "Set in type, still being corrected. The argument holds; the edges don't.",
    },
    bound: {
      label: "bound",
      glyph: "●",
      blurb: "Stable enough to stand behind. Still revised, but no longer provisional.",
    },
  },
};
