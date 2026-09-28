---
title: Sensitive dependence is not an excuse
summary: Chaos limits prediction, but the limit is specific and quantifiable. Invoking it to avoid making forecasts is usually a bluff.
created: 2026-05-19
updated: 2026-09-11
stage: proof
shelf: Chaos
certainty: likely
importance: 8
tags: [chaos, forecasting, epistemics]
---

"It's a chaotic system" has become a way of ending arguments. The move is:
the domain is complex, complex systems are chaotic, chaotic systems are
unpredictable, therefore your forecast is meaningless and mine cannot be
graded. It sounds like rigour. It is usually the opposite.

Chaos does impose a hard limit on prediction. But the limit has a *size*, and
the size is computable, and it is almost never where the person invoking it
wants it to be.

## The limit has a number

In a chaotic system, errors grow exponentially at a rate given by the leading
Lyapunov exponent λ. If your initial measurement is off by ε and you can
tolerate error E, your useful horizon is roughly

```
T ≈ (1/λ) · ln(E/ε)
```

Two features of that formula do most of the work.

The logarithm is brutal in one direction: **improving your measurements buys
you almost nothing.** Cut ε by a factor of a thousand and you gain about
7/λ more time. For the atmosphere, that is the difference between a
two-week horizon and a three-week one. Perfect instruments do not give you a
seasonal forecast.[^doubling]

[^doubling]: For the real atmosphere the error-doubling time is around 1.5–2
days at synoptic scales, which is where the famous two-week ceiling comes
from. It has barely moved in fifty years of improving observation, exactly as
the logarithm predicts, while forecast *skill* inside the horizon has improved
enormously.

The logarithm is also generous: **the horizon is finite, not zero.** A system
being chaotic tells you predictions fail *eventually*. It says nothing about
whether they fail before next Thursday. Weather is the canonical chaotic
system and the five-day forecast is now roughly as good as the one-day
forecast was in 1980.

## What chaos does not forbid

Three things stay available even past the horizon, and losing track of them
is where the bluff lives:

1. **Statistics of the attractor.** You cannot say where the trajectory is in
   six months. You can say, with precision, what fraction of its time it
   spends in each region. This is exactly why *climate* is forecastable while
   *weather* is not — a distinction that the "it's chaotic" move routinely
   flattens. See [[lorenz-attractor|the attractor itself]].
2. **Bounds.** Trajectories stay on the attractor. Ruling out the states it
   never visits is a real prediction, and often the one that matters.
3. **Short horizons.** Whatever λ is, there is an interval over which you are
   obliged to be accurate.

## The test

When someone invokes chaos to decline a forecast, ask for the number. What is
the doubling time of error in this system? What is the horizon it implies?
What statistics of the attractor do you claim instead?

An honest answer to those questions is a contribution. The absence of one
usually means "chaotic" was standing in for "I would rather not be graded" —
which is a fine thing to feel and a bad thing to dress up as mathematics.

{% aside "Where I am least sure" %}
I have written this as though λ is knowable in the social and economic
systems where the move is most common. Often it is not — estimating Lyapunov
exponents from short, noisy, non-stationary series is genuinely hard, and
sometimes unavailable in principle. The demand for a number may occasionally
be unfair. I still think making it is the right default, because the failure
mode it catches is far more common than the unfairness it risks.
{% endaside %}
