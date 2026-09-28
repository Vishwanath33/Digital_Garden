---
layout: layouts/page.njk
title: About
summary: Who is tending this, and what it is for.
permalink: /about/index.html
---

I'm {{ site.author.name }}. This is where I keep notes that are worth
revisiting — things I want to be able to link to, argue with, and correct in
public.

It is a garden rather than a blog, for [the reasons set out here](/notes/digital-gardens/).
In practice that means: notes are organised by subject, they get edited in
place rather than superseded, and each one is labelled with how mature it is
and how much I currently believe it. The labelling scheme is
[documented](/notes/epistemic-status/), and the labels move — downward as
often as up.

The figure turning behind every page is the Lorenz attractor, integrated live
rather than drawn from a picture. Three trajectories start a hundred-thousandth
of a unit apart and end up unrelated. [Why that is the wallpaper](/notes/lorenz-attractor/)
is itself a note.

## Corrections

{% if site.sourcePublic -%}
If something here is wrong, I want to know, and the fastest route is a
[GitHub issue]({{ site.repo }}/issues) — every note has a *History & source*
link that points at the file that produced it. Corrections that change a
note's conclusion get noted in the note.
{%- else -%}
If something here is wrong, I want to know — [email me](mailto:{{ site.author.email }})
with the note's title. Corrections that change a note's conclusion get noted
in the note.
{%- endif %}

## Elsewhere

{% if site.sourcePublic %}- Source: [{{ site.repo | replace("https://github.com/", "github.com/") }}]({{ site.repo }})
{% endif %}- Feed: [Atom](/feed.xml) — publishes on planting *and* on tending
- Email: <{{ site.author.email }}>
