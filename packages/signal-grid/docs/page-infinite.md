# Infinite scroll

Admit the next page as the reader approaches the end, and keep everything already loaded.

<GridDemo id="infinite-scroll" />

## The state

```ts
g.state.page.$({ mode: "infinite", index: 0, size: 25, total: null })
```

Under this mode the window runs from the start to the accumulated size, so nothing already shown is
dropped. `pageWindow` in `src/8_grid.ts` asks `paginate` for index zero at the accumulated size,
which is why the mode needs no separate accumulation buffer.

## The epic raises the index

```ts
g.dispatch(scroll(80))
g.state.page.$().index
```

`pageOnScrollNearEnd` in `src/7_epics.ts` tests the scroll position against the end of the content
rather than counting scroll events, so one boundary crossing raises the index once whatever the
event rate.

A known `page.total` stops it, which is how the last page becomes the last page.

## Fetching

Nothing in the kernel waits on a fetch. `g.page$` emits once per page change, and appending to your
own rows signal is what makes the new rows appear.

```ts
runWhenInView(g.page$, ({ index, size }) => {
  fetchRows(index, size).then((it) => rows.$([...rows.$(), ...it]))
})
```

The grid stays correct while the request is in flight, because the derivation depends on the rows
signal and nothing else.

## Telling the reader it ended

Set the total once the source says there are no more rows.

```ts
g.state.page.total.$(loadedCount)
```

## The loading slot

`Slots.loading` is declared and unread, so a spinner is a node you place beside the grid rather than
inside it today.
