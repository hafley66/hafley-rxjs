# Pagination

Show one page of rows at a time and read the page count off the derived plan.

<GridDemo id="pagination" />

## The state

`state.page` is one object carrying the mode, the index, the size, and a server-only total.

```ts
g.state.page.$({ mode: "pages", index: 1, size: 12, total: null })
g.state.page.index.$(2)
g.view.plan.$().pageCount
```

## The three modes

| mode | window over the center run |
| --- | --- |
| `all` | every loaded row; paging is disabled |
| `pages` | the slice starting at index times size |
| `infinite` | everything up to the accumulated size, covered on [Infinite scroll](/page-infinite) |

`pageWindow` in `src/8_grid.ts` turns whichever mode is set into one `paginate` call inside
`renderPlan`. An index past the end slices to empty rather than throwing, so a page control that
runs off the end shows nothing and recovers on the next write.

## Where paging sits in the plan

```
flat list
  -> partition by pinning     start, center, end
       -> paginate            the center run only
            -> window         the paginated center only
```

Paging the center run only is what makes a pinned row stay visible on a page it does not belong to.
See [Pin](/rows-pin).

## Building the control

Everything a pager needs is on the plan and the state.

```ts
const { pageCount } = g.view.plan.$()
const { index, size } = g.state.page.$()

next.onclick = () => g.state.page.index.$(Math.min(index + 1, pageCount - 1))
prev.onclick = () => g.state.page.index.$(Math.max(index - 1, 0))
```

No epic writes the index in this mode, so the control is yours and the state key is the whole
contract.

## Paging on the server

Under `mode: "server"` the page descriptor is published on `g.query` and `rows` is expected to be
the page itself. See [Server mode](/page-server).
