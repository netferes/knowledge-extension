import * as assert from "assert";
import * as fs from "fs/promises";
import * as path from "path";
import { ConfigManager } from "../../config";
import { SearchService } from "../../services/searchService";
import { createTempDir, removeDir, resetKnowledgeConfig, waitFor } from "./testUtils";

suite("SearchService", () => {
  let configManager: ConfigManager;
  let searchService: SearchService;
  let repoDir = "";

  setup(async () => {
    await resetKnowledgeConfig();
    repoDir = await createTempDir("knowledge-search-repo");

    configManager = new ConfigManager();
    await configManager.addRepository({ name: "repo", path: repoDir });
    searchService = new SearchService(configManager);
    await waitFor(50);
  });

  teardown(async () => {
    configManager.dispose();
    await removeDir(repoDir);
    await resetKnowledgeConfig();
  });

  test("returns empty results for empty term", async () => {
    const response = await searchService.search({ term: "   " });
    assert.strictEqual(response.results.length, 0);
  });

  test("fallback fs+regex searches content correctly", async () => {
    await fs.writeFile(path.join(repoDir, "a.md"), "hello unique-keyword");
    (searchService as any).resolveRipgrepPath = async () => null;

    const response = await searchService.search({ term: "unique-keyword" });
    assert.ok(response.results.some((item) => item.filePath.endsWith("a.md")));
  });

  test("file name search returns [File] result", async () => {
    await fs.writeFile(path.join(repoDir, "special-file.md"), "nothing");
    (searchService as any).resolveRipgrepPath = async () => null;

    const response = await searchService.search({ term: "special-file" });
    assert.ok(response.results.some((item) => item.lineContent.includes("[File] special-file.md")));
  });

  test("excludePatterns excludes node_modules path", async () => {
    await fs.mkdir(path.join(repoDir, "node_modules"), { recursive: true });
    await fs.writeFile(path.join(repoDir, "node_modules", "skip.md"), "keyword-in-node-modules");
    await fs.writeFile(path.join(repoDir, "root.md"), "keyword-in-root");
    (searchService as any).resolveRipgrepPath = async () => null;

    const response = await searchService.search({ term: "keyword-in" });
    const paths = response.results.map((item) => item.filePath);
    assert.ok(paths.some((p) => p.endsWith("root.md")));
    assert.ok(!paths.some((p) => p.includes("node_modules")));
  });

  test("pattern .git does not hide .gitignore", async () => {
    await fs.mkdir(path.join(repoDir, ".git"), { recursive: true });
    await fs.writeFile(path.join(repoDir, ".git", "config"), "internal");
    await fs.writeFile(path.join(repoDir, ".gitignore"), "target-keyword");
    (searchService as any).resolveRipgrepPath = async () => null;

    const response = await searchService.search({ term: "target-keyword" });
    const paths = response.results.map((item) => item.filePath);
    assert.ok(paths.some((p) => p.endsWith(".gitignore")));
    assert.ok(!paths.some((p) => p.includes(`${path.sep}.git${path.sep}`)));
  });

  test("binary extensions are excluded from content scan", async () => {
    await fs.writeFile(path.join(repoDir, "image.png"), "binary-keyword");
    (searchService as any).resolveRipgrepPath = async () => null;

    const response = await searchService.search({ term: "binary-keyword" });
    assert.ok(!response.results.some((item) => item.filePath.endsWith("image.png")));
  });

  test("parseRgLine parses path:line:content format", () => {
    const parsed = (searchService as any).parseRgLine("docs/a.md:12:hello", {
      name: "repo",
      path: repoDir
    });
    assert.ok(parsed);
    assert.strictEqual(parsed.lineNumber, 12);
    assert.ok(parsed.filePath.endsWith(path.join("docs", "a.md")));
    assert.strictEqual(parsed.lineContent, "hello");
  });
});
