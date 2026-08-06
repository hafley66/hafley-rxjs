# GitHub legibility: what already ships

Research date: 2026-08-06. All star counts are GitHub API stargazers_count, all
dates are pushed_at, both fetched live on 2026-08-06. Manifest versions are read
from each repo's manifest.json on its default branch.

## TOC

1. Extension and userscript landscape
2. Prior art on per-file diff size in the PR tree
3. How the data is obtained
4. Visualization prior art
5. Build vs buy recommendation
6. Sources

---

## 1. Extension and userscript landscape

Column meaning for the three feature columns: "per-file diff size" = a file row
carries its +N/-M or a size glyph; "rolls up per folder" = a directory row shows
the sum of its children; "bar/treemap" = a proportional size drawing, not just
text.

| name | kind | repo | stars | last commit | license | manifest | per-file diff size | roll up per folder | bar/treemap |
|---|---|---|---|---|---|---|---|---|---|
| Refined GitHub | extension | [refined-github/refined-github](https://github.com/refined-github/refined-github) | 31,876 | 2026-08-06 | MIT | MV3 | no | no | no |
| Gitako | extension | [EnixCoda/Gitako](https://github.com/EnixCoda/Gitako) | 2,596 | 2026-08-05 | MIT | MV3 | **yes** (+N/-M and stacked bar) | no (folders drawn without sums) | yes (5-block bar) |
| Octotree | extension | [ovity/octotree](https://github.com/ovity/octotree) | 23,228 | 2024-06-06 | AGPL-3.0 | MV2 | no (tree filtered to changed files; status octicon only) | sums kept in data, not rendered | no |
| GitHub Hovercard | userscript + extension | [Justineo/github-hovercard](https://github.com/Justineo/github-hovercard) | 1,897 | 2026-08-01 | MIT (SPDX unresolved) | MV2 | no | no | no |
| OctoLinker | extension | [OctoLinker/OctoLinker](https://github.com/OctoLinker/OctoLinker) | 5,386 | 2023-10-02 | MIT | MV2 | no | no | no |
| File Icons for GitHub | extension | [homerchen19/github-file-icons](https://github.com/homerchen19/github-file-icons) | 1,640 | 2025-01-05 | MIT | MV3 | no | no | no |
| Material Icons for GitHub | extension | [material-extensions/material-icons-browser-extension](https://github.com/material-extensions/material-icons-browser-extension) | 775 | 2026-07-20 | MIT | MV3 | no | no | no |
| GitHub Code Folding | extension | [noam3127/github-code-folding](https://github.com/noam3127/github-code-folding) | 290 | 2022-07-14 | MIT | MV3 | no | no | no |
| Sourcegraph browser extension | extension (defunct) | n/a (repo no longer resolves 2026-08-06) | n/a | archived 2019 | n/a | n/a | no | no | no |
| CodeStream | IDE extension, commercial | [TeamCodeStream/codestream-server](https://github.com/TeamCodeStream/codestream-server) | 65 | 2024-08-01 | NOASSERTION | n/a | no | no | no |

Notes on the rows above.

- Refined GitHub has no per-file PR tree diff size feature. Its closest piece is
  `pr-commit-lines-changed`, which adds a `+N/-N` to each commit in the
  conversation tab. It does not touch the "Files changed" file tree.
- Gitako is the only scoped tool that renders a real per-file size in a PR file
  tree. Details in section 2.
- Octotree went commercial (premium tier) after Buu Nguyen's takeover by ovity.
  The free repo is AGPL-3.0 and last pushed mid-2024.
- Sourcegraph's browser extension was retired. Neither `sourcegraph/sourcegraph`
  nor `sourcegraph/browser-extensions` resolves today; the old browser-extensions
  repo is archived (2019). It did hover tooltips and code navigation, never
  per-file diff size in the tree.
- CodeStream (now a New Relic product) does PR review inside the editor, not in
  GitHub's web file tree. Its own open-source server repo is quiet since 2024.
- A maintained project matching the name "Better GitHub Diff" could not be
  located in the GitHub API; no verified repo or store listing. Treated as
  unverified, excluded from the feature question.
- Greasy Fork search for `github diff` returned no script under that query that
  adds per-tree-row sizes. Greasy Fork blocks anonymous scraping (Cloudflare
  "Just a moment" challenge), so the negative is from a partial result set, not
  an exhaustive crawl.
- No treemap/sunburst extension surfaces in GitHub repo search for `github
  treemap extension`. That lane appears empty in maintained form.

## 2. Prior art on the exact feature

Question: does anything already draw add/remove counts and a size bar under each
entry in GitHub's PR file tree?

**Yes, one tool: Gitako.** `EnixCoda/Gitako` renders, in its own PR file-tree
sidebar, per-file `+N/-N` text **or** a 5-block stacked size bar. It is a file
tree replacement, so the rows are Gitako's own React tree, not an injection into
GitHub's native sticky `file-tree` list.

What Gitako draws, from source:

- Text mode: `<span class=diff-stat-text>{additions}/{deletions}</span>`, green
  for additions, red for deletions.
  `src/components/FileExplorer/DiffStatText.tsx`
- Graph mode: `DiffStatGraph` builds 5 spans, `g` green, `r` red, `w` gray, via
  `resolveDiffGraphMeta(additions, deletions, changes)`, the same 5-block
  diffstat formula GitHub uses.
  `src/components/FileExplorer/DiffStatGraph.tsx`,
  `src/utils/general.ts:209`
- Toggle: `showDiffInText` config selects text vs graph.
  `src/components/FileExplorer/hooks/useNodeRenderers.tsx:49`

Two gaps in Gitako relative to the request:

- Folders are synthesized with no `diff` field (`src/platforms/GitHub/index.ts`
  `processTree`), so directory rows do not show summed sizes. Per-file only.
- The bars live in Gitako's own sidebar. GitHub's native "Files changed" tree is
  left untouched.

What the native GitHub tree shows, measured from a live PR DOM on 2026-08-06
(refined-github/refined-github PR #9906):

- File tree container: `file-tree` > `nav[aria-label="File Tree Navigation"]` >
  `ul.ActionList--tree[role="tree"]` > `li[role="treeitem"]`.
- A directory item carries `data-tree-entry-type="directory"`, a chevron, and a
  base-name label.
- A file leaf carries `id="file-tree-item-diff-<sha>"`,
  `data-tree-entry-type="file"`, `data-file-type`, and renders a file-type
  octicon, the file name, and a trailing status octicon
  (added/modified/deleted).
- No tree row contains numeric additions/deletions and no tree row contains a
  `diffstat-block`. The live DOM grep shows 0 `diffstat-block` inside tree items.

`+N/-N`-shaped values exist elsewhere on the page, but in the file header
(`#diffstat .color-fg-success` / `.color-fg-danger`), not in the tree rows. So
the user's premise holds: GitHub's own tree is names plus a status icon, no
weight.

Octotree's PR mode (`showOnlyChangedInPR`) fetches changed files and filters the
tree to them, and its data model carries per-file and per-folder
`additions`/`deletions` sums (`src/adapters/github.js` `_getPatch`), but it
renders none of the counts and no bar. It is a partial match on the data side,
zero on the visual side.

### Closest partial matches

| tool | has per-file counts | has bar | has folder rollup | renders in native tree |
|---|---|---|---|---|
| Gitako | yes | yes | no | no (own sidebar) |
| Octotree | no (kept in data) | no | in data only | no |
| native GitHub | no | no | no | n/a (it is the tree) |

## 3. How the data is obtained

Gitako is the only candidate worth a full breakdown because it is the only one
showing sizes. It uses three approaches together.

| approach | endpoints / selectors | brittleness | citation |
|---|---|---|---|
| REST API | `GET /repos/{owner}/{repo}/pulls/{id}/files?page=&per_page=` (paginates, 100/page, caps near 3000) | needs token for high rate; 60/hr unauthenticated per IP | `src/platforms/GitHub/API.ts:122` (`requestPullTreeData`), `:109` (`getPullRequest`) |
| DOM scrape | `#diffstat .color-fg-success` and `#diffstat .color-fg-danger` for whole-PR totals; `#files_tab_counter` for count; `[data-path]` + `parentElement.id` for per-file anchor hashes | color-class names are Cosmetic/Primer choices, subject to theme drift | `src/platforms/GitHub/DOMHelper.ts:451` (`getPRDiffTotalStat`), `getPullRequestTreeData.ts:142` (`resolveFileHashMap`) |
| embedded JSON payload | `script[type="application/json"][data-target="react-app.embeddedData"]`, reads `pullRequestsFilesRoute.diffSummaries` / `pullRequestsChangesRoute.diffSummaries` (path + markedAsViewed) | payload shape is GitHub React internals, versioned | `DOMHelper.ts:52`, `getPullRequestTreeData.ts:121` (`resolveDiffSummaryMap`) |

Gitako picks a fast path when the PR is small: it uses the scraped totals
(`getPRDiffTotalStat`, `getPullRequestFilesCount`) to decide whether to fetch
only page 1 and then the rest, versus paging everything
(`getPullRequestTreeData.ts` `checkShouldSafeGet`).

Octotree's PR path is REST-only: `GET /pulls/{n}/files?per_page=300`
(`src/adapters/github.js:236`), then it aggregates `additions`/`deletions` per
ancestor folder in `_getPatch` (`src/adapters/github.js:228-260`).

Refined GitHub's commit line counts come from GraphQL: `repository.object(...
...) { additions deletions }`
(`source/features/pr-commit-lines-changed.gql`). That query targets a single
commit in the conversation, not the PR files endpoint.

### Current file-row selectors and stability (2026)

Measured on a live `.../pull/9906/files` page on 2026-08-06:

- File row: `div.file.js-file` with `id="diff-<sha>"`, attributes
  `data-file-type`, `data-file-deleted`, `data-tagsearch-path`.
- File header (sticky): `.file-header.js-file-header` with `data-path`,
  `data-short-path`, `data-anchor`.
- Container: `#files_bucket` (class `files-bucket`) and the progressive diff
  wrapper `js-diff-progressive-container`.

Stability: the `.js-file` / `.js-file-header` / `data-path` pairing has been
present for years and is still present unchanged in 2026. The sticky tree markup
(`file-tree`, `ActionList--tree`, `role="treeitem"`, `data-tree-entry-type`) is
newer, the React-era rewrite; that is the selector set a new extension would
mount on.

Virtualization: the file rows are server-rendered and all present in the DOM; the
page does not window or virtualize the file list. `js-diff-progressive-container`
lazily loads diff *bodies*, but the tree rows exist up front. A
`MutationObserver` on `#files_bucket` (for re-renders on filter / route change)
plus a one-pass read of the rows is sufficient. Virtualized `react-window`-style
tree handling is required only if you target GitHub's own lazy list components,
which the Files tab does not use for its rows.

## 4. Visualization prior art

Ranked by how well each reads at list-row scale.

| visual | reads well at row height when | real usages |
|---|---|---|
| stacked +/− bar (5-block diffstat) | always; the de facto size-at-a-glance; compact at ~16px, green/red ratio | native GitHub diffstat, Gitako `DiffStatGraph`, GitHub's own sticky diff header |
| text +N/−N | exact counts matter and the bar is a supplement | Gitako `DiffStatText` (toggle) |
| two-tone sparkline | a per-file *trend over commits* is the point; overkill for one PR snapshot | GitHub Insights contribution graph, commit-history sparklines |
| donut / radial | whole-PR summary glance, best in a header not a row | GitHub mobile PR header |
| treemap / sunburst / icicle | whole-repo or whole-PR *shape* in a spacious pane; collapses at row height | Gource (repo viz), scc and WakaTime-style size views |

Takeaway for the target feature: the stacked +/− bar is the only shape that earns
its place inside a dense file-tree row. Treemap and sunburst belong in a side
"PR shape" pane if a visualization beyond the rows is wanted; they would not read
as per-row indicators.

## 5. Build vs buy recommendation

Nothing ships the full ask: per-file counts **and** a size bar **and** a
per-folder rollup **inside GitHub's native PR file tree**.

What exists, and the measured reason it does not close the loop:

- **Gitako** is per-file counts + bar already. It fails the folder rollup and it
  replaces the tree rather than augmenting GitHub's native one. It is the
  strongest starting point and worth re-evaluating first: if you accept a
  sidebar, Gitako today is a thin config from the ask.
- **Octotree** already computes the per-folder `additions`/`deletions` sums in
  `_getPatch`. It renders nothing. Taking its data model and adding a renderer is
  a small step, but the project is quiet since 2024 and MV2.
- **Native GitHub** tree rows are stable, unvirtualized DOM with a
  `data-tree-entry-type` per item. A MutationObserver on the tree plus the REST
  files endpoint (or the embedded `diffSummaries` payload) gives every number
  needed; the pan only missing is the drawing.

Two closest starting points and the one-line delta each:

1. **Gitako** (`EnixCoda/Gitako`, MIT, active 2026-08-05). Add: sum each
   directory's children diff into the folder node (its `processTree` currently
   leaves folders diff-less) and optionally mount the same `DiffStatGraph` into
   GitHub's native `file-tree` rows via `data-tree-entry-type` instead of the
   separate sidebar.
2. **Octotree** (`ovity/octotree`, AGPL-3.0). Add: a renderer for the folder and
   file `additions`/`deletions` it already computes in `_getPatch`, then port the
   tree markup and the build to MV3.

Build decision on the data side: use the REST `/pulls/{n}/files` endpoint as the
authoritative source (Gitako proves the pattern), fall back to the embedded
`react-app.embeddedData` `diffSummaries` payload to avoid a token for the fast
case, and keep a DOM `diffstat` scrape only for the unauthenticated boot. Folder
rollup is a pure client-side sum over that list.

## 6. Sources

- Refined GitHub: https://github.com/refined-github/refined-github
  - GraphQL commit counts: `source/features/pr-commit-lines-changed.gql`
- Gitako: https://github.com/EnixCoda/Gitako
  - `src/platforms/GitHub/API.ts`, `src/platforms/GitHub/DOMHelper.ts`,
    `src/platforms/GitHub/getPullRequestTreeData.ts`,
    `src/components/FileExplorer/DiffStatGraph.tsx`,
    `src/components/FileExplorer/DiffStatText.tsx`,
    `src/utils/general.ts`, `src/utils/VisibleNodesGenerator/prepare.ts`
- Octotree: https://github.com/ovity/octotree
  - `src/adapters/github.js` (`_getPatch`), `src/config/wex/manifest.json`
- GitHub Hovercard: https://github.com/Justineo/github-hovercard
- OctoLinker: https://github.com/OctoLinker/OctoLinker
- File Icons for GitHub: https://github.com/homerchen19/github-file-icons
- Material Icons for GitHub:
  https://github.com/material-extensions/material-icons-browser-extension
- GitHub Code Folding: https://github.com/noam3127/github-code-folding
- CodeStream (commercial IDE): https://github.com/TeamCodeStream/codestream-server
- Live DOM measurements: `https://github.com/refined-github/refined-github/pull/9906/files` fetched 2026-08-06
