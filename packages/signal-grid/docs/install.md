# Install

Add the package and its peers, import the theme once, and you have everything the rest of this site
uses.

```sh
pnpm add @hafley66/signal-grid @hafley66/signals @hafley66/path @hafley66/xdom rxjs
```

| peer | why it is required |
| --- | --- |
| `@hafley66/signals` | the state signal, every derived stage, and the epic runtime |
| `@hafley66/path` | the path templates that name routes, attributes, and CSS custom properties |
| `@hafley66/xdom` | delegated DOM events resolved by walking the `data-route` chain |
| `rxjs` | gestures, keyboard, scroll, and the three-phase action bus |
| `@logtape/logtape` | optional; absent means no logging and no error |

## The theme

The renderer draws structure and reads custom properties for everything visible, so one import
turns a bare frame into a grid you can look at.

```ts
import "@hafley66/signal-grid/theme.css"
```

Every property name and its default is declared in `src/theme.css`. Overriding one is the whole
restyling story, covered in [Theming](/view-theme).

## Without a renderer

The kernel is a pure derivation over two forests and needs no document. Skipping the theme import
and never calling `render` leaves you a state signal, a derived view chain, and an action bus, which
is what every unit test in `src/8_grid.test.ts` exercises.

## Next

Mount something: [Your first grid](/first-grid).
