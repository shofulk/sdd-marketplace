# sdd-gate

A `PreToolUse` hook that blocks `gh pr create`, `gh pr merge` and `gh pr ready` until a passing
self-review verdict covers the exact tree being shipped: the worktree is clean and `HEAD^{tree}` equals
the tree the review saw.

Status: skeleton — no hook yet.
