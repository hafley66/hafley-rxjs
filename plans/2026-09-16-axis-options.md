# The axis, decided

Decision sheet for the axis question of `plans/2026-09-16-signal-marbles-causal-axis.md`. Every mark
below comes from a prototype of the D4 drain loop, not from my imagination: `TestScheduler.run` with
its queue drained, one action per tick. The prototype has been deleted; its output is reproduced here.

**Decided 2026-09-16: both, with a threshold.** "we want ticks shown but time correct up to a
threshold (if big gap the threshold for a time break line)". One geometry:

```
unitMs      = the smallest positive gap between consecutive columns in the document
pitch(gap)  = clamp(PITCH, (gap / unitMs) * PITCH, MAX_PITCH)
x(0)        = PAD ;  x(t+1) = x(t) + pitch(frame(t+1) - frame(t))
break(t)    = the gap exceeded MAX_PITCH, so draw a break mark carrying the real milliseconds
```

`PITCH` is one column (26px), `MAX_PITCH` six of them.

## What that draws

**A burst against a sequence.** `of(1,2,3)` and `observeOn(asapScheduler)` have identical frames —
measured, both at frame 0 — and different turns. A floor of one column per turn is what keeps them
apart:

```
tick axis (now with the floor)                 time axis (what it drew before)
col    0      1      2      3                  ms  0
of     1 2 3 |                                       ●
asap          1      2      3 |                      ●
      ─────  ─────  ─────  ─────
       0ms    0ms    0ms    0ms                     identical. one pixel.
```

**A duration.** Three keys 1ms apart and a request 300ms after the last one. `unitMs` is 1, so the
300 becomes 300 columns and the cap turns it into a break that says how much it skipped:

```
col    0        1        2        3        ╱         4
keys   ^        k        k        k        ╱
request                                    ╱        r
       ───────  ───────  ───────  ───────  ╱  ───────
        0ms      1ms      2ms      3ms    ╱   303ms
                                          +300ms
```

**A steady interval.** `interval(1000).take(3)`: `unitMs` is 1000, so every gap is exactly one column
and nothing breaks. The milliseconds are under the columns.

```
col    0        1        2        3
       ^        0        1        2 |
      ───────  ───────  ───────  ───────
       0ms      1000ms   2000ms   3000ms
```

## Why the earlier question looked like a choice

The two extremes, both drawn from the same captures:

| | tick columns | time |
| --- | --- | --- |
| `of` vs `asap` | distinguishable | identical |
| `debounceTime(300)` | a label, the wait is invisible | the wait is the width |
| a long quiet stretch | compressed to one column | most of the picture |
| 60 turns of `interval(1)` | 60 readable columns | a smear at the left edge |

Each column's millisecond value is printed underneath, so the compressed reading never pretends the
columns are evenly spaced in time. The floor guarantees the causal reading; the cap guarantees a long
silence cannot eat the picture; the break mark is what makes the compression honest rather than
hidden.
