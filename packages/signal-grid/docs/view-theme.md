# Theming

Restyle the grid by writing custom properties, with no stylesheet edit and no class-name contract to
learn.

<GridDemo id="theming" />

## One rule is a theme

```css
.my-grid {
  --sg-row-h: 28px;
  --sg-indent: 24px;
  --sg-accent: oklch(0.7 0.15 250);
  --sg-line: light-dark(#e3e6ea, #2a2f36);
}
```

Every name and its default is declared in `src/theme.css`, scoped to the grid root's own attribute.
Two grids on a page are therefore two independent property scopes, and no id appears in a selector.

## Yours against the renderer's

| property | who writes it |
| --- | --- |
| `--sg-row-h` | you, or the property writer from density |
| `--sg-total-h`, `--sg-offset-y`, `--sg-inline-tracks` | the property writer, per frame |
| `--sg-indent`, `--sg-glyph`, `--sg-col-w`, `--sg-pad` | you |
| `--sg-line`, `--sg-bg`, `--sg-fg`, `--sg-head-bg` | you |
| `--sg-hover-bg`, `--sg-selected-bg`, `--sg-focus` | you |
| `--sg-range-bg`, `--sg-range-edge`, `--sg-accent` | you |

The palette entries default through `light-dark()`, so a theme that only sets the scheme gets both
appearances without writing a media query.

## Registered properties

A handful are declared with `@property` in `src/theme.css`, which is what lets the tree indent feed
a continuous calculation and what makes an invalid value fall back to the initial rather than
poisoning the whole declaration.

## Per-entry sizes

A column width and a row height are properties named after the entry, encoded to a valid identifier
by `encodeVarId` in `src/3_paths.ts`. No stylesheet selector can spell those names, which is why the
element carrying the value also carries a short alias the generic rules read.

## Writing a rule instead

`.sg-cell`, `.sg-head-cell`, `.sg-row`, `.sg-run`, `.sg-expander`, and `.sg-detail-panel` are the
class surface. State reads as attributes rather than classes, so a rule and a test assertion match
the same thing.

| attribute | on | meaning |
| --- | --- | --- |
| `data-selected` | row, cell | row selection, range membership |
| `data-edge` | cell | which sides of the range block it sits on |
| `data-editing` | cell | the editor is mounted in it |
| `data-open`, `aria-expanded` | row | tree expansion |
| `data-detail` | row | it is a panel rather than a data row |
| `data-span` | cell | it spans, with the two count properties beside it |
| `data-side` | run | which pinning run it is |
| `data-sort`, `aria-sort` | header cell | the direction |
| `data-leaf` | expander | the node has no children |

## Beating the shipped rules

`src/theme.css` declares a layer order at the top and places no rule inside either layer, so every
rule in the file is unlayered today. A consumer rule wins by ordinary source order and specificity:
import the theme before your own stylesheet, and match a selector of one attribute plus one class.
