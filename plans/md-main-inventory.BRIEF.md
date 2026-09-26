# md-main-inventory (read-only inventory, sol6)

Goal: write ONE file, `plans/md-main-inventory.REPORT.md`, and commit it. Edit nothing else.

## Question
Is every piece of `packages/md` work (and every md plugin) on hafley-rxjs `main`?
List what is NOT on main, and where it lives.

## Sources to inspect (read only; do not checkout, merge, rebase, or commit anywhere but this lane)
1. hafley-rxjs branches not merged to main that touch `packages/md` or md plugins:
   `git branch -a --no-merged main`, then `git log main..<b> -- packages/md packages/mmd packages/d2 packages/marbler packages/signal-grid`.
   Known candidates: `fix/md-reading`, `wip/md-table-fit`, `fix/md-focus-reentry`, `codex/integrate-md-tables`.
2. hafley-rxjs worktrees (`git worktree list`): uncommitted changes under md paths
   (`git -C <wt> status --porcelain -- packages/md`). Include the main checkout at ~/projects/hafley-rxjs.
3. ~/projects/instant: code that is an md plugin or md renderer living in instant instead of packages/md
   (grep instant/src and instant/packages for remark/rehype/unified/markdown plugin/`@hafley66/md` imports).
   Also ~/projects/instant-worktrees/md-preview (branch fix/md-preview-performance): commits and dirty files.
4. "Plugin" = any export of packages/md registered as a fence command, remark/rehype plugin, or subpath export
   (read packages/md/package.json `exports`). List every one with its file path.

## Report shape (tables only, no prose paragraphs)
Table A: md plugin | file:line | on main? (y/n)
Table B: branch or worktree | commit sha | subject | files touched | patch already on main? (use `git cherry main <b>`)
Table C: instant file | what it is | imports @hafley66/md? | candidate to move into packages/md? (y/n + one-line reason from code, not opinion)
Table D: dirty uncommitted md files per worktree | path | `git diff --stat` line

## Stop on
Anything requiring a write outside the report. Do not fix, merge, or move code.

## Validation
`test -s plans/md-main-inventory.REPORT.md && git log -1 --format=%s`

## Commit
Subject exactly: `docs(tasks): md main inventory report`
Receipt to parent: status / sha / files / validation / next.
