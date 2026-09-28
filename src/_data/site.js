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
  // Leave it null to serve from the default GitHub Pages URL.
  domain: null,

  // Where GitHub Pages serves this repository when there is no custom domain.
  // Project pages live under /<repo>/, which is why pathPrefix exists below.
  githubUser: "vishwanath33",
  githubRepoPath: "/Digital_Garden/",

  // Repository, for "edit this page" and colophon links.
  repo: "https://github.com/Vishwanath33/Digital_Garden",
  // HEAD resolves to whatever the default branch is called.
  repoBranch: "HEAD",

  get origin() {
    return this.domain ? `https://${this.domain}` : `https://${this.githubUser}.github.io`;
  },

  // A custom domain serves from the root; a project page serves from /<repo>/.
  // Eleventy rewrites every internal link with this, so nothing else has to
  // know which of the two is in play.
  get pathPrefix() {
    return this.domain ? "/" : this.githubRepoPath;
  },

  get url() {
    return (this.origin + this.pathPrefix).replace(/\/$/, "");
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
