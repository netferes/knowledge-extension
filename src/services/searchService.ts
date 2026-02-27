import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { spawn } from "child_process";
import { ConfigManager } from "../config";
import { RepositoryConfig, SearchQuery, SearchResponse, SearchResult } from "../types";

function isLikelyTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const binaryExt = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".pdf",
    ".zip",
    ".gz",
    ".tar",
    ".mp4",
    ".mov",
    ".exe",
    ".dll",
    ".so"
  ]);
  return !binaryExt.has(ext);
}

function matchesPattern(filePath: string, pattern: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const normalizedPattern = pattern.replace(/\\/g, "/").trim();
  if (!normalizedPattern) {
    return false;
  }

  if (normalizedPattern.includes("*")) {
    const escaped = normalizedPattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`(^|/)${escaped}($|/)`).test(normalizedPath);
  }

  if (normalizedPattern.includes("/")) {
    return normalizedPath === normalizedPattern
      || normalizedPath.startsWith(`${normalizedPattern}/`)
      || normalizedPath.endsWith(`/${normalizedPattern}`);
  }

  const segments = normalizedPath.split("/").filter(Boolean);
  return segments.includes(normalizedPattern);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class SearchService {
  private repositories: RepositoryConfig[] = [];

  constructor(private readonly config: ConfigManager) {
    this.repositories = config.getRepositories();
    this.config.onDidChangeRepositories((repos) => {
      this.repositories = repos;
    });
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const term = query.term.trim();
    if (!term) {
      return { term, results: [] };
    }

    const targetRepositories = this.repositories.filter((repo) => {
      return query.repositoryPath ? repo.path === query.repositoryPath : true;
    });
    const fileNameMatches = await this.searchByFileName(term, targetRepositories);
    const rgResults = await this.searchWithRipgrep(term, targetRepositories);
    if (rgResults) {
      return { term, results: this.mergeResults(rgResults, fileNameMatches) };
    }

    const fallbackResults = await this.searchWithFsRegex(term, targetRepositories);
    return { term, results: this.mergeResults(fallbackResults, fileNameMatches) };
  }

  private async searchWithRipgrep(
    term: string,
    repositories: RepositoryConfig[]
  ): Promise<SearchResult[] | null> {
    const rgPath = await this.resolveRipgrepPath();
    if (!rgPath) {
      return null;
    }

    const allResults: SearchResult[] = [];
    for (const repository of repositories) {
      const excludePatterns = this.config.getExcludePatternsForRepo(repository);
      const lines = await this.runRg(term, repository.path, rgPath, excludePatterns);
      for (const line of lines) {
        const parsed = this.parseRgLine(line, repository);
        if (parsed) {
          allResults.push(parsed);
        }
      }
    }
    return allResults;
  }

  private async resolveRipgrepPath(): Promise<string | null> {
    const appRoot = vscode.env.appRoot;
    const candidates = process.platform === "win32"
      ? [
          path.join(appRoot, "node_modules.asar.unpacked", "@vscode", "ripgrep", "bin", "rg.exe"),
          path.join(appRoot, "node_modules", "@vscode", "ripgrep", "bin", "rg.exe")
        ]
      : [
          path.join(appRoot, "node_modules.asar.unpacked", "@vscode", "ripgrep", "bin", "rg"),
          path.join(appRoot, "node_modules", "@vscode", "ripgrep", "bin", "rg")
        ];

    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // keep trying
      }
    }
    return null;
  }

  private runRg(
    term: string,
    cwd: string,
    rgPath: string,
    excludePatterns: string[]
  ): Promise<string[]> {
    return new Promise((resolve) => {
      const args = ["-n", "-S", "--color", "never", "--trim", escapeRegExp(term), "."];
      for (const pattern of excludePatterns) {
        args.push("--glob", `!${pattern}`);
      }

      const proc = spawn(rgPath, args, { cwd });
      const stdout: string[] = [];
      proc.stdout.on("data", (chunk: Buffer) => stdout.push(chunk.toString("utf8")));
      proc.on("close", (code) => {
        if (code === 0 || code === 1) {
          resolve(stdout.join("").split(/\r?\n/).filter(Boolean));
          return;
        }
        resolve([]);
      });
      proc.on("error", () => resolve([]));
    });
  }

  private parseRgLine(line: string, repository: RepositoryConfig): SearchResult | null {
    const match = /^(.+?):(\d+):(.*)$/.exec(line);
    if (!match) {
      return null;
    }

    const relativePath = match[1];
    const lineNumber = Number(match[2]);
    const lineContent = match[3] ?? "";
    const filePath = path.join(repository.path, relativePath);
    return {
      repositoryName: repository.name,
      repositoryPath: repository.path,
      filePath,
      lineNumber,
      lineContent,
      matchContext: lineContent
    };
  }

  private async searchWithFsRegex(
    term: string,
    repositories: RepositoryConfig[]
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const regex = new RegExp(escapeRegExp(term), "i");
    for (const repository of repositories) {
      const excludePatterns = this.config.getExcludePatternsForRepo(repository);
      await this.walkAndSearch(repository, repository.path, regex, excludePatterns, results);
    }
    return results;
  }

  private mergeResults(contentMatches: SearchResult[], fileNameMatches: SearchResult[]): SearchResult[] {
    const merged = [...contentMatches];
    const seen = new Set(
      contentMatches.map((item) => `${item.filePath}:${item.lineNumber}:${item.lineContent}`)
    );
    for (const item of fileNameMatches) {
      const key = `${item.filePath}:${item.lineNumber}:${item.lineContent}`;
      if (seen.has(key)) {
        continue;
      }
      merged.push(item);
      seen.add(key);
    }
    return merged;
  }

  private async searchByFileName(
    term: string,
    repositories: RepositoryConfig[]
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    for (const repository of repositories) {
      const excludePatterns = this.config.getExcludePatternsForRepo(repository);
      await this.walkFileName(repository, repository.path, term.toLowerCase(), excludePatterns, results);
    }
    return results;
  }

  private async walkFileName(
    repository: RepositoryConfig,
    rootPath: string,
    term: string,
    excludePatterns: string[],
    results: SearchResult[]
  ): Promise<void> {
    let entries: Array<{ name: string; isDirectory(): boolean }>;
    try {
      entries = await fs.readdir(rootPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(rootPath, entry.name);
      const relativePath = path.relative(repository.path, absolutePath);
      if (excludePatterns.some((pattern) => matchesPattern(relativePath, pattern))) {
        continue;
      }
      if (entry.isDirectory()) {
        await this.walkFileName(repository, absolutePath, term, excludePatterns, results);
        continue;
      }
      if (!entry.name.toLowerCase().includes(term)) {
        continue;
      }
      results.push({
        repositoryName: repository.name,
        repositoryPath: repository.path,
        filePath: absolutePath,
        lineNumber: 1,
        lineContent: `[File] ${entry.name}`,
        matchContext: relativePath
      });
    }
  }

  private async walkAndSearch(
    repository: RepositoryConfig,
    rootPath: string,
    regex: RegExp,
    excludePatterns: string[],
    results: SearchResult[]
  ): Promise<void> {
    let entries: Array<{ name: string; isDirectory(): boolean }>;
    try {
      entries = await fs.readdir(rootPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolutePath = path.join(rootPath, entry.name);
      const relativePath = path.relative(repository.path, absolutePath);
      if (excludePatterns.some((pattern) => matchesPattern(relativePath, pattern))) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.walkAndSearch(repository, absolutePath, regex, excludePatterns, results);
        continue;
      }

      if (!isLikelyTextFile(absolutePath)) {
        continue;
      }

      let content: string;
      try {
        content = await fs.readFile(absolutePath, "utf8");
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (!regex.test(line)) {
          return;
        }
        results.push({
          repositoryName: repository.name,
          repositoryPath: repository.path,
          filePath: absolutePath,
          lineNumber: index + 1,
          lineContent: line.trim(),
          matchContext: line.trim()
        });
      });
    }
  }
}
