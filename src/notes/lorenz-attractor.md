---
title: The Lorenz attractor, and why it is the wallpaper
summary: A weather model too small to forecast anything, which accidentally explained why forecasting fails.
created: 2026-03-04
updated: 2026-09-21
stage: bound
shelf: Chaos
certainty: high
importance: 7
tags: [chaos, mathematics, models]
---

In the winter of 1961 Edward Lorenz was running a toy weather simulation on a
Royal McBee LGP-30 — a machine slower than the chip in a modern doorbell. He
wanted to re-examine a run, so he restarted it from the middle, typing in the
numbers from a printout. The new run tracked the old one for a while and then
diverged completely.

The printout had rounded to three decimal places. The machine held six.[^round]

[^round]: 0.506 instead of 0.506127. Lorenz first assumed a vacuum tube had
failed, which is the correct first assumption about a 1961 computer.

That difference — one part in a thousand, far smaller than any real
measurement error in atmospheric data — was enough to produce a different
month of weather. Lorenz had not found a bug. He had found the thing that
makes long-range weather forecasting impossible in principle rather than in
practice, and he spent the rest of his career on it.

## The system

By 1963 he had boiled the convection model down to three equations, which is
about as small as an interesting dynamical system gets:

```
dx/dt = σ(y − x)
dy/dt = x(ρ − z) − y
dz/dt = xy − βz
```

With σ = 10, ρ = 28, β = 8/3 — Lorenz's canonical values — the trajectory
never repeats and never escapes. It winds around one lobe some number of
times, crosses over, winds around the other, crosses back. The number of
circuits before each crossing is, for practical purposes, unpredictable.[^symbolic]

[^symbolic]: You can encode a trajectory as the sequence of lobes it visits —
LLRLRRRL… — and the resulting symbolic dynamics is essentially a shift map on
random binary sequences. The unpredictability is not sloppiness in the model;
it is the model's content.

Three things are true at once, and holding all three is the whole lesson:

1. **It is deterministic.** No noise term. Same initial condition, same
   trajectory, every time, forever.
2. **It is bounded.** Every trajectory is pulled onto the same set of states
   and stays there. Nothing runs off to infinity.
3. **It is unpredictable.** Nearby states separate exponentially, at a rate
   set by the leading Lyapunov exponent — about 0.9 per unit time here, so
   errors grow by roughly *e* every unit and by a factor of a thousand in
   under eight.

Determinism does not buy you predictability. That was the surprise, and it
took the rest of the field a decade to absorb it.

## The shape

Plot the trajectory and you get the figure turning behind this page: two
lobes, a surface that looks like it has area but has measured volume zero,
a fractal dimension around 2.06. Orbits on it never cross — they cannot,
since the system is deterministic and crossing would mean two futures from
one state — so the apparent surface is really infinitely many sheets, packed
arbitrarily close.

{% aside "On the picture" %}
The background here integrates the real system with fourth-order Runge–Kutta
at a fixed step, so the shape is correct rather than decorative. Three
trajectories run at once, seeded a hundred-thousandth apart in *z*. They
overlap for the first minute or so of viewing and are unrelated after that.
That is the entire argument of this entry, rendered continuously.
{% endaside %}

That it was a *strange attractor* — attracting, but not to a point or a
cycle — was named later, by Ruelle and Takens in 1971. That Lorenz's
particular set really is one was not proved until Warwick Tucker did it in
1999, with a computer-assisted argument. Thirty-six years between the picture
and the proof.

## Why it is behind the text

Because it is an honest picture of what this place is for.

Entries here get revised. A revision is a small perturbation — a sentence, a
number, a source I had not read. Most of them change nothing. Some of them
move the whole argument somewhere I could not have predicted from where it
started, and there is no way to tell in advance which kind a given edit is.
Writing in public, with the revision history exposed, is a way of admitting
that. See [[epistemic-status|epistemic status]] for how I try to label the state of an entry
without pretending I can forecast where it ends up, and
[[sensitive-dependence|sensitive dependence]] for where this stops being a metaphor and starts
being a limit on knowledge.

It is also bounded, which is the consoling half. The trajectory wanders
forever and never leaves the attractor. A library can be endlessly revised
and still be about something.
