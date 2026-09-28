// ---------------------------------------------------------------------------
// The one file to edit when you rename the library or move it to a new domain.
// ---------------------------------------------------------------------------
// GitHub Actions says which repository it is building as OWNER/NAME.
const REPOSITORY = process.env.GITHUB_REPOSITORY || "";

function pagesUrl() {
  const [owner, name] = REPOSITORY.split("/");
  if (!owner || !name) return null;
  const user = `${owner.toLowerCase()}.github.io`;
  return name.toLowerCase() === user ? `https://${user}` : `https://${user}/${name}`;
}

function repoUrl() {
  return REPOSITORY ? `https://github.com/${REPOSITORY}` : null;
}

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

  // The free address GitHub Pages serves this repository from, and the
  // repository itself. When GitHub Actions builds the site these follow the
  // repository's real name, so renaming it needs no edit here: a repository
  // named <user>.github.io is served from the root of that address, any
  // other from /<repo>/ beneath it. The values below are for local builds.
  hostUrl: pagesUrl() || "https://vishwanath33.github.io",
  repo: repoUrl() || "https://github.com/Vishwanath33/vishwanath33.github.io",
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
