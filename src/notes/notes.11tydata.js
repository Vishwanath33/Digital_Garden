export default {
  layout: "layouts/note.njk",
  isNote: true,
  stage: "manuscript",
  permalink: "/notes/{{ page.fileSlug }}/",
  eleventyComputed: {
    // `created` in the front matter is the canonical date for an entry.
    date: (data) => data.created || data.page.date,
  },
};
