# git-narrative

Generate documentary-style narratives from any git repository's history using Claude.

Inspired by [The Making of Fizzy, Told by Git](https://www.zolkos.com/2025/12/02/the-making-of-fizzy-told-by-git) — this tool automates the process of turning a repo's commit history into a compelling, well-structured story about how a project was built.

## How It Works

git-narrative uses the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) to dispatch parallel subagents that each perform a different analysis pass over the repo:

1. **Discovery** — Baseline stats: commit count, date range, contributors, branches, tags
2. **Chronological Sweep** — Walks the history to find inflection points, renames, large refactors, feature additions/removals
3. **Thematic Analysis** — Identifies narrative threads: naming evolution, architectural pivots, contributor roles, philosophical patterns in commit messages

The orchestrator then synthesizes all findings into a single `STORY.md` documentary.

## Prerequisites

- [Claude Code CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code) installed and authenticated (`claude login`)
- Node.js >= 18 (or Bun)
- Git

## Install

**With bun (recommended):**
```bash
bun install -g git-narrative
```

**With npm:**
```bash
npm install -g git-narrative
```

## Usage

```bash
# Analyze the current directory
git-narrative

# Analyze a local repo
git-narrative ./path/to/repo

# Clone and analyze a GitHub repo
git-narrative https://github.com/basecamp/fizzy

# Custom output filename
git-narrative -o HISTORY.md .

# Use a specific model
git-narrative -m opus ./my-project

# Set a budget cap
git-narrative -b 5.00 .

# Verbose mode (see agent reasoning)
git-narrative -v .
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <file>` | Output filename | `STORY.md` |
| `-m, --model <model>` | Claude model (`sonnet`, `opus`, `haiku`) | `sonnet` |
| `-b, --budget <usd>` | Max spend in USD | unlimited |
| `-v, --verbose` | Show agent reasoning in stderr | off |
| `-h, --help` | Show help | |
| `--version` | Show version | |

## Output

The generated `STORY.md` follows this structure:

- **Prologue** — Key stats at a glance
- **Acts** — Chronological chapters with descriptive titles
- **Features That Didn't Make It** — The graveyard of good ideas
- **The Cast** — Contributors by commit count and focus area
- **Technical Appendix** — Architecture evolution
- **Conclusion** — What the history reveals about the team
- **Commit Reference Index** — Notable SHAs linked to their significance

## Development

```bash
git clone https://github.com/yourusername/git-narrative
cd git-narrative
bun install    # or: npm install
bun run dev -- ./some-repo   # run without building
bun run build  # compile TypeScript
```

## Cost

Typical runs cost between $0.50 and $5.00 depending on repo size and model choice. Use `--budget` to set a cap. Sonnet is the default and provides the best cost/quality tradeoff for this task.

## License

MIT
