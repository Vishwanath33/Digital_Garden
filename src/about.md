---
layout: layouts/page.njk
kicker: About
title: About
summary: Who keeps this library, and what it is for.
permalink: /about/index.html
---

I'm {{ site.author.name }}. This is where I keep entries worth coming back
to: things I want to be able to cite, argue with, and correct in public.

It is a library rather than a blog, for
[the reasons set out here](/notes/a-library-not-a-blog/). In practice that
means entries are shelved by subject, corrected in place rather than
superseded, and each is labelled with how far along it is and how much I
currently believe it. The labels are [documented](/notes/epistemic-status/),
and they move, downward as often as up.

## Corrections

{% if site.sourcePublic -%}
If something here is wrong, I want to know, and the fastest route is a
[GitHub issue]({{ site.repo }}/issues). Every entry links to its source and
revision history. Corrections that change an entry's conclusion are noted
in the entry.
{%- else -%}
If something here is wrong, I want to know: [email me](mailto:{{ site.author.email }})
with the entry's title. Corrections that change an entry's conclusion are
noted in the entry.
{%- endif %}

## Elsewhere

{% if site.sourcePublic %}- Source: [{{ site.repo | replace("https://github.com/", "github.com/") }}]({{ site.repo }})
{% endif %}- Feed: [Atom](/feed.xml), which announces revisions as well as new entries
- Email: <{{ site.author.email }}>
