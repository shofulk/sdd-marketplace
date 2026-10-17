# sdd-marketplace

A Claude Code plugin marketplace (`sdd`) with two plugins:

| Plugin | What it does |
|---|---|
| `sdd-gate` | blocks `gh pr create / merge / ready` until a passing self-review verdict covers the exact tree being shipped |
| `sdd-engineering` | the `pr-self-review` workflow that writes that verdict; depends on `sdd-gate` |

## Install

```bash
claude plugin marketplace add shofulk/sdd-marketplace
claude plugin install sdd-engineering@sdd
```

Status: skeleton — manifests only, nothing released yet.
