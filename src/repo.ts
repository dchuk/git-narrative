import { execSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export interface RepoInfo {
  /** Absolute path to the repo on disk */
  path: string;
  /** Whether we cloned it (and should clean up) */
  isTemp: boolean;
  /** Remote URL if available, for linking commits */
  remoteUrl: string | null;
}

const GITHUB_URL_PATTERNS = [
  /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/,
  /^git@github\.com:[\w.-]+\/[\w.-]+/,
  /^https?:\/\/gitlab\.com\/[\w.-]+\/[\w.-]+/,
  /^git@gitlab\.com:[\w.-]+\/[\w.-]+/,
  /^https?:\/\/bitbucket\.org\/[\w.-]+\/[\w.-]+/,
];

function isRemoteUrl(input: string): boolean {
  return (
    GITHUB_URL_PATTERNS.some((p) => p.test(input)) ||
    input.endsWith(".git") ||
    input.startsWith("git@") ||
    input.startsWith("https://github.com") ||
    input.startsWith("https://gitlab.com") ||
    input.startsWith("https://bitbucket.org")
  );
}

function normalizeGitUrl(url: string): string {
  // Strip trailing slashes and .git suffix for display, but keep for clone
  let clean = url.replace(/\/+$/, "");
  if (!clean.endsWith(".git")) {
    clean += ".git";
  }
  return clean;
}

function getWebUrlFromRemote(remote: string): string | null {
  // Convert git@github.com:user/repo.git -> https://github.com/user/repo
  // or https://github.com/user/repo.git -> https://github.com/user/repo
  try {
    let url = remote
      .replace(/^git@github\.com:/, "https://github.com/")
      .replace(/^git@gitlab\.com:/, "https://gitlab.com/")
      .replace(/\.git$/, "")
      .replace(/\/+$/, "");
    return url;
  } catch {
    return null;
  }
}

export async function resolveRepo(input: string): Promise<RepoInfo> {
  if (isRemoteUrl(input)) {
    return cloneRepo(input);
  }
  return validateLocalRepo(input);
}

async function cloneRepo(url: string): Promise<RepoInfo> {
  const cloneUrl = normalizeGitUrl(url);
  const tempDir = mkdtempSync(join(tmpdir(), "git-narrative-"));

  console.log(`Cloning ${url} ...`);

  try {
    execSync(`git clone --no-checkout "${cloneUrl}" repo`, {
      cwd: tempDir,
      stdio: "pipe",
      timeout: 120_000,
    });

    // Checkout HEAD so we can see the file tree at latest state
    const repoPath = join(tempDir, "repo");
    execSync("git checkout HEAD", {
      cwd: repoPath,
      stdio: "pipe",
    });

    const webUrl = getWebUrlFromRemote(cloneUrl);

    console.log(`Cloned to ${repoPath}`);
    return { path: repoPath, isTemp: true, remoteUrl: webUrl };
  } catch (err: any) {
    throw new Error(
      `Failed to clone repository: ${err.message ?? err}\nURL: ${cloneUrl}`
    );
  }
}

async function validateLocalRepo(input: string): Promise<RepoInfo> {
  const repoPath = resolve(input);

  if (!existsSync(repoPath)) {
    throw new Error(`Path does not exist: ${repoPath}`);
  }

  if (!existsSync(join(repoPath, ".git"))) {
    throw new Error(`Not a git repository: ${repoPath}`);
  }

  // Try to get remote URL for commit linking
  let remoteUrl: string | null = null;
  try {
    const remote = execSync("git remote get-url origin", {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    remoteUrl = getWebUrlFromRemote(remote);
  } catch {
    // No remote, that's fine
  }

  return { path: repoPath, isTemp: false, remoteUrl };
}

export function cleanupRepo(info: RepoInfo): void {
  if (info.isTemp) {
    try {
      execSync(`rm -rf "${join(info.path, "..")}"`, { stdio: "pipe" });
    } catch {
      // Best effort cleanup
    }
  }
}
