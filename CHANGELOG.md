# scriptpal

## 1.7.1

### Patch Changes

- 0996c36: Sort bookmark names alphabetically when listing bookmarks and in the interactive bookmark picker.

## 1.7.0

### Minor Changes

- 3ea6f5d: Add support for enum and array bookmark wildcards, expanded array input formats, wildcard enum validation, and corresponding README/CLI help, tests, and PR test workflow updates.

## 1.6.1

### Patch Changes

- a94dbcd: Add bookmark help examples that show how to preserve wildcard placeholders using single quotes or escaped dollar signs in double quotes.

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
