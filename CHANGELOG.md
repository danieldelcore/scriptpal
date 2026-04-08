# scriptpal

## 1.6.0

### Minor Changes

- 52490bc: Add bookmark-specific `--last` support to rerun the last executed bookmark command.

  - Persist the last executed bookmark command separately from the base script `--last` command history
  - Add `scriptpal bookmark -l` and `scriptpal bookmark --last`
  - Update CLI help examples and README documentation for bookmark last-run behavior

- 0dcf7f5: Prompt to rerun the previous bookmark command when running `scriptpal bookmark`.

  - Add a bookmark-specific rerun confirmation prompt that mirrors the top-level `scriptpal` flow
  - Keep `scriptpal bookmark --last` behavior unchanged for explicit reruns

## 1.5.0

### Minor Changes

- a640dfe: Adds bookmark functionality to save and retrieve commands globally

## 1.4.5

### Patch Changes

- 3c795ff: Fixes various bugs, makes several minor improvements
