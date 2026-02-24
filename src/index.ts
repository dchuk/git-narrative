#!/usr/bin/env node

import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { resolveRepo, cleanupRepo, type RepoInfo } from "./repo.js";
import { runNarrative } from "./agent.js";

const HELP = `
git-narrative - Generate documentary-style narratives from git history

USAGE
  git-narrative [options] <repo>

ARGUMENTS
  <repo>    Path to a local git repo, or a GitHub/GitLab URL.
            If omitted, uses the current directory.

OPTIONS
  -o, --output <file>     Output filename (default: STORY.md)
  -m, --model <model>     Claude model to use (default: sonnet)
  -b, --budget <usd>      Maximum budget in USD
  -v, --verbose           Show agent reasoning in stderr
  -h, --help              Show this help message
  --version               Show version

EXAMPLES
  git-narrative                              # analyze current directory
  git-narrative ./my-project                 # analyze local repo
  git-narrative https://github.com/user/repo # clone and analyze
  git-narrative -o HISTORY.md -v .           # verbose, custom output name
`;

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      output: { type: "string", short: "o", default: "STORY.md" },
      model: { type: "string", short: "m", default: "sonnet" },
      budget: { type: "string", short: "b" },
      verbose: { type: "boolean", short: "v", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (values.version) {
    // Read version from package.json at runtime
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    try {
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const pkg = JSON.parse(
        readFileSync(join(__dirname, "..", "package.json"), "utf-8")
      );
      console.log(`git-narrative v${pkg.version}`);
    } catch {
      console.log("git-narrative (version unknown)");
    }
    process.exit(0);
  }

  const repoInput = positionals[0] ?? ".";
  const maxBudget = values.budget ? parseFloat(values.budget) : undefined;

  if (maxBudget !== undefined && (isNaN(maxBudget) || maxBudget <= 0)) {
    console.error("Error: --budget must be a positive number");
    process.exit(1);
  }

  let repo: RepoInfo | null = null;

  try {
    repo = await resolveRepo(repoInput);

    await runNarrative({
      repo,
      model: values.model,
      output: values.output,
      verbose: values.verbose,
      maxBudget,
    });

    console.log(`\nOutput written to: ${resolve(values.output!)}`);
  } catch (err: any) {
    console.error(`\nError: ${err.message ?? err}`);
    process.exit(1);
  } finally {
    if (repo) cleanupRepo(repo);
  }
}

main();
