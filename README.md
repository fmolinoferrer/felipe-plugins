# felipe-plugins

An open-source (MIT) Claude Code plugin marketplace by Felipe Molino: plugins for running a small team with AI agents, shipping AI features, and writing in public. Version 0.1.0 (first-pass demos).

## Install
```
/plugin marketplace add fmolinoferrer/felipe-plugins
/plugin install control-tower@felipe-plugins
```
Install any other plugin the same way: `/plugin install <name>@felipe-plugins`. Commands run as `/<plugin>:<command>`. Scripts use only the standard library: Node 18+ for most plugins, Python 3.9+ for `eval-kit` (with a Node fallback). `mcp-forge`'s TypeScript template uses npm.

## Operations
| Plugin | What it does | Commands |
|---|---|---|
| [control-tower](plugins/control-tower) | Run a small AI agent team through files: 3-role starter, inboxes, decisions queue with defaults and undo lines, 3 KB handoffs, spend caps, status view. | `init`, `status`, `handoff` |
| [agent-ops](plugins/agent-ops) | Free agent-readiness check (6-area rubric) and a reference operating model skill. | `readiness` |

## Development
| Plugin | What it does | Commands |
|---|---|---|
| [eval-kit](plugins/eval-kit) | Eval setup for teams shipping AI features: golden + sealed holdout sets, graders, a runner and a release gate. | `init`, `run`, `gate` |
| [mcp-forge](plugins/mcp-forge) | Plan, scaffold and review TypeScript MCP servers so a product works inside Claude and ChatGPT. | `new`, `review` |

## Personal Dev
Plugins for your public voice.

| Plugin | What it does | Commands |
|---|---|---|
| [agent-newsletter](plugins/agent-newsletter) | Turn your agents' own handoffs, decisions and failure notes into a newsletter issue (with a no-financials filter), and a 3-hour workshop outline. | `draft`, `workshop` |

## Layout
```
.claude-plugin/marketplace.json
plugins/<name>/
  .claude-plugin/plugin.json
  commands/*.md   skills/   templates/   examples/   scripts/
  README.md
```

## Privacy
All examples are fictional (for example "Northwind Analytics", a 12-person SaaS company). No real company data is included.

## Open source and services
Everything here is MIT-licensed: use it, fork it, send pull requests. Paid offerings built on these plugins (Control Tower Pro, the Agent Operating Model Sprint, custom MCP server builds, live workshops) are available separately from Felipe Molino.

## Contributing
Issues and pull requests are welcome. Keep examples fictional, keep scripts dependency-free where possible, and run `claude plugin validate plugins/<name>` before opening a PR.

## License
MIT, see [LICENSE](LICENSE).
