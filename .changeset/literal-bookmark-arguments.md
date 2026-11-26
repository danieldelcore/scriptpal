---
"scriptpal": minor
---

Add opt-in `bookmark add/edit --exec` to preserve argument boundaries and substitute wildcard values without shell interpretation. Existing string bookmarks retain their behavior, with explicit `--shell` available for shell commands.

Add `--preview` to inspect resolved commands without execution or history updates. Preserve exec arguments when rerunning bookmarks, support separate arguments for whole-argument `:array:space` wildcards, and correct template quoting in documentation and help.
