---
title: Route signals
---

# Route signals

A template, matched against the address bar, read back as named values. The URL is external state,
so it arrives the same way every other producer does.

<SignalDemo id="route-signal" />

## The shape

```ts
const route = Route("/users/:id/posts/:postId")

route.$()                  // { id: "7", postId: "3", path: "/users/7/posts/3", matched: true }
route.$().matched          // false when the current path does not fit the template
route.href({ id: "8", postId: "1" })
route.navigate({ id: "8", postId: "1" })
```

The parameter names come from the template through `@hafley66/path`, and they are typed: `route.$().id`
exists because the template said `:id`, and a typo in the read is a compile error rather than an
`undefined` at runtime.

## Query parameters ride along

Anything in `location.search` lands on the same value, and anything in a `navigate` call that is not
a path parameter is written back as one:

```
step 0  location is /users/7?tab=posts
step 1  route.$()   -> { id: "7", tab: "posts", path: "/users/7", matched: true }
step 2  route.navigate({ id: "8", tab: "likes" })
step 3  location is /users/8?tab=likes
step 4  route.$()   -> { id: "8", tab: "likes", path: "/users/8", matched: true }
```

## What it listens to

`popstate`, plus an `instant:navigate` event for a router that pushes without a browser navigation.
The underlying stream is shared with `refCount`, so several route signals on one template hold one
listener between them, and no listener at all while nobody is reading.

## The four moves

| call | what it does |
| --- | --- |
| `route.href(values)` | prints the URL, changing nothing |
| `route.navigate(values, { replace })` | pushes, or replaces |
| `route.back()` | one entry back |
| `route.forward()` | one entry forward |

`route.template` reads the string the signal was built from, which is what the demo above prints.
