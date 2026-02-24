import { resolve } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { SYSTEM_PROMPT, SUBAGENTS } from "./prompts.js";
import type { RepoInfo } from "./repo.js";

export interface RunOptions {
  repo: RepoInfo;
  model?: string;
  output?: string;
  verbose?: boolean;
  maxBudget?: number;
}


export async function runNarrative(options: RunOptions): Promise<string> {
  const { repo, model = "sonnet", output = "STORY.md", verbose = false, maxBudget } = options;

  const remoteContext = repo.remoteUrl
    ? `\n\nThis repository has a remote at: ${repo.remoteUrl}\nWhen citing commits, format SHAs as markdown links: [\`<short-sha>\`](${repo.remoteUrl}/commit/<full-sha>)`
    : "\n\nThis repository has no known remote URL. Use plain short SHAs when citing commits.";

  const outputPath = resolve(output!);
  const outputInstruction = `\n\nWrite the final documentary to: ${outputPath}`;

  const prompt = `Analyze this git repository and write a documentary-style narrative about its development history. Save the result to ${outputPath}.${remoteContext}${outputInstruction}

Begin by dispatching the discovery, chronological_sweep, and thematic_analysis subagents to gather information in parallel. Then synthesize their findings into the final narrative.`;

  console.log(`\nAnalyzing repository at: ${repo.path}`);
  console.log(`Output: ${output}`);
  console.log(`Model: ${model}`);
  if (maxBudget) console.log(`Budget cap: $${maxBudget.toFixed(2)}`);
  console.log("---\n");

  const queryOptions: Parameters<typeof query>[0]["options"] = {
    cwd: repo.path,
    model,
    systemPrompt: {
      type: "preset" as const,
      preset: "claude_code" as const,
      append: SYSTEM_PROMPT,
    },
    allowedTools: [
      "Read",
      "Write",
      "Edit",
      "Bash",
      "Grep",
      "Glob",
      "Task",
    ],
    agents: SUBAGENTS,
    permissionMode: "bypassPermissions" as const,
    allowDangerouslySkipPermissions: true,
    ...(maxBudget ? { maxBudgetUsd: maxBudget } : {}),
  };

  let resultText = "";
  let totalCost = 0;

  for await (const message of query({ prompt, options: queryOptions })) {
    switch (message.type) {
      case "assistant": {
        if (verbose) {
          // Print assistant text content
          for (const block of message.message.content) {
            if ("text" in block && block.text) {
              process.stderr.write(block.text);
            }
          }
        }
        break;
      }

      case "system": {
        if (verbose && message.subtype === "init") {
          console.log(`Session: ${message.session_id}`);
          console.log(`Tools: ${message.tools.join(", ")}`);
        }
        break;
      }

      case "result": {
        if (message.subtype === "success") {
          resultText = message.result;
          totalCost = message.total_cost_usd;
          console.log(`\nCompleted in ${message.num_turns} turns`);
          console.log(`Total cost: $${totalCost.toFixed(4)}`);
        } else {
          const errorMsg = "errors" in message ? message.errors.join(", ") : "Unknown error";
          throw new Error(`Agent failed (${message.subtype}): ${errorMsg}`);
        }
        break;
      }
    }
  }

  return resultText;
}
