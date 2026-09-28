---
title: A library, not a blog
summary: Blogs are ordered by time, which is almost never the interesting ordering. A library is ordered by subject, cross-referenced, and corrected in place.
created: 2026-03-08
updated: 2026-09-28
stage: proof
certainty: likely
importance: 5
tags: [method, writing, web]
---

A blog is a stack of newspapers. The newest is on top, everything else
yellows underneath, and a piece from two years ago is understood to be a
historical document. You do not correct it; you publish another saying you
changed your mind, and the two sit in the archive contradicting each other
with no indication of which won.

That is a strange way to keep what you think. Almost nothing worth keeping
is best understood in the order it happened to be thought of.

A library inverts the defaults:

- **Subject over chronology.** Entries are shelved by what they are about
  and found by what cites them, not by when they were written. The
  [catalogue](/notes/) is sorted by date only because it has to be sorted by
  something; the shelves in the [contents](/) are the real order.
- **Revision over accretion.** When I learn something, I correct the entry.
  The entry is the current state of my thinking; its revision history is the
  record of how it got there.
- **Visible drafts.** A blog post implies finishedness. An entry marked
  *manuscript* does not, so it can go on the shelf at a stage where a post
  could not. See [[epistemic-status|epistemic status]].
- **Cross-references.** The value is in the connections. Entries cite each
  other, every entry's catalogue card lists what cites it back, and the
  [map](/map/) shows the whole web at once, so the structure is legible from
  anywhere in it.

## The obvious objection

If everything is corrected in place, the reader cannot tell what changed,
and a library becomes a way to quietly be right in retrospect.

{% if site.sourcePublic -%}
This is a real problem and the answer is mechanical rather than moral: the
whole library is a git repository, every entry links to its revision
history, and every correction is a public commit. I cannot silently revise.
I can only revise.
{%- else -%}
This is a real problem, and for now my answer is only partial. Every entry
shows when it was last revised, and the feed announces every revision, so a
change cannot happen unannounced. What a reader cannot yet see is the
difference itself: the history lives in a repository that is not public.
Opening it is the complete answer.
{%- endif %}

{% aside "Cost" %}
The honest downside: libraries are much worse than blogs at telling you
*what is new*. A regular reader of a blog knows where to look. A regular
reader of a library has to be told. The feed here announces revisions as
well as new entries, which helps a little and is not a full answer.
{% endaside %}

## Why a library

Because notes written only for yourself tend to die. A private folder of
fragments grows quietly and is almost never read again, since nothing in it
had to make sense to anyone.

A library is built to be consulted: every entry has to hold up when someone
pulls it off the shelf cold. Writing for that reader, even a hypothetical
one, forces a fragment to become a sentence and a sentence to have a
subject. The public part is not vanity. It is the constraint that makes an
entry worth keeping.
