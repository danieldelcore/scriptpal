---
"scriptpal": minor
---

Add bookmark-specific `--last` support to rerun the last executed bookmark command.

- Persist the last executed bookmark command separately from the base script `--last` command history
- Add `scriptpal bookmark -l` and `scriptpal bookmark --last`
- Update CLI help examples and README documentation for bookmark last-run behavior
