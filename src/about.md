---
layout: layouts/page.njk
kicker: About
title: About
permalink: /about/index.html
---

## Elsewhere

{% if site.sourcePublic %}- Source: [{{ site.repo | replace("https://github.com/", "github.com/") }}]({{ site.repo }})
{% endif %}- Email: <{{ site.author.email }}>
