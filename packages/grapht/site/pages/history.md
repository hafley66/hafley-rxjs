# The offline history journal

- [grapht-history](#grapht-history)
- [The JSONL format](#the-jsonl-format)
- [HistoryRevision](#historyrevision)
- [Hash verification](#hash-verification)
- [Structural anomalies](#structural-anomalies)

## grapht-history

`grapht-history` walks git for one diagram file and writes a self-contained journal. Run it from
the repository that holds the file:

```
grapht-history <diagram-path> [journal-path]
```

With no journal path it writes to `<diagram-path>.history.jsonl`. It prints the revision count and
exits nonzero if it found structural anomalies. The entry point is `historyMain`
(`packages/grapht/src/5_history/2_cli.ts:7`); the walk is `gitHistoryJournal`
(`packages/grapht/src/5_history/1_gitWalk.ts:18`).

The walk uses `git log --follow --reverse` over the path and `git show <rev>:<path>` for each
commit, so the journal carries every revision of the file in oldest-first order.

## The JSONL format

The journal is JSON Lines: one header line, then one line per revision
(`packages/grapht/src/5_history/0_journal.ts:31`).

| line | content |
| --- | --- |
| header | `{ "format": "grapht-history/0", "artifactId", "path" }` |
| each revision | one `HistoryRevision` object |

The `format` field names the record and gates every reader; `jsonlToJournal` rejects anything else
(`src/5_history/0_journal.ts:44`).

## HistoryRevision

Each revision is self-contained: it carries its own content, so a consumer reconstructs any
revision without git or the repository present. Declared at
`packages/grapht/src/5_history/0_journal.ts:5`.

| field | meaning |
| --- | --- |
| `artifactId` | which artifact the journal is about |
| `revisionId` | the git commit hash |
| `parentRevisionIds` | the commit's parents |
| `contentHash` | sha256 of `content` |
| `capturedAt` | ISO 8601 commit timestamp, from ingest |
| `message` | the commit subject |
| `path` | the file path |
| `content` | the file at that revision |

## Hash verification

Every read verifies the content. `contentHashOf(content)` is sha256 hex
(`src/5_history/0_journal.ts:26`). `jsonlToJournal` recomputes it for each revision and throws on a mismatch
(`src/5_history/0_journal.ts:47`), so a journal that was edited, truncated, or corrupted on disk fails loudly
instead of replaying a wrong revision.

## Structural anomalies

`journalAnomalies(journal)` names structural defects without touching content
(`packages/grapht/src/5_history/0_journal.ts:55`): a duplicate revision id, or a revision captured
before its predecessor in the list. The CLI prints these to stderr and exits nonzero, while still
writing the journal, so a broken history is visible and not silently accepted.
