export default {
  layout: "layouts/note.njk",
  growth: "seedling",
  permalink: "/notes/{{ page.fileSlug }}/",
  eleventyComputed: {
    // `planted` in the front matter is the canonical date for a note.
    date: (data) => data.planted || data.page.date,
  },
};
