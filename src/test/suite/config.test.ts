import * as assert from "assert";
import { ConfigManager } from "../../config";
import { createTempDir, removeDir, resetKnowledgeConfig, waitFor } from "./testUtils";

suite("ConfigManager", () => {
  let configManager: ConfigManager;
  const tempDirs: string[] = [];

  setup(async () => {
    await resetKnowledgeConfig();
    configManager = new ConfigManager();
  });

  teardown(async () => {
    configManager.dispose();
    for (const dir of tempDirs.splice(0)) {
      await removeDir(dir);
    }
    await resetKnowledgeConfig();
  });

  test("getRepositories() returns empty by default", () => {
    const repositories = configManager.getRepositories();
    assert.deepStrictEqual(repositories, []);
  });

  test("addRepository() adds one repository", async () => {
    const repoPath = await createTempDir("knowledge-config-repo");
    tempDirs.push(repoPath);

    await configManager.addRepository({ name: "repo1", path: repoPath });
    const repositories = configManager.getRepositories();

    assert.strictEqual(repositories.length, 1);
    assert.strictEqual(repositories[0].name, "repo1");
    assert.strictEqual(repositories[0].path, repoPath);
  });

  test("addRepository() throws on duplicate name/path", async () => {
    const repoPath = await createTempDir("knowledge-config-repo");
    tempDirs.push(repoPath);

    await configManager.addRepository({ name: "repo1", path: repoPath });
    await assert.rejects(
      async () => configManager.addRepository({ name: "repo1", path: repoPath }),
      /Repository already exists/
    );
  });

  test("removeRepository() removes target repository", async () => {
    const repoPath = await createTempDir("knowledge-config-repo");
    tempDirs.push(repoPath);

    await configManager.addRepository({ name: "repo1", path: repoPath });
    await configManager.removeRepository(repoPath);

    const repositories = configManager.getRepositories();
    assert.deepStrictEqual(repositories, []);
  });

  test("onDidChangeRepositories fires on add/remove", async () => {
    const repoPath = await createTempDir("knowledge-config-repo");
    tempDirs.push(repoPath);

    let eventsCount = 0;
    const disposable = configManager.onDidChangeRepositories(() => {
      eventsCount += 1;
    });

    await configManager.addRepository({ name: "repo1", path: repoPath });
    await configManager.removeRepository(repoPath);
    await waitFor(100);

    disposable.dispose();
    assert.ok(eventsCount >= 2);
  });

  test("getExcludePatternsForRepo() prefers repository-specific patterns", async () => {
    const repoPath = await createTempDir("knowledge-config-repo");
    tempDirs.push(repoPath);

    const repo = {
      name: "repo1",
      path: repoPath,
      excludePatterns: ["custom-ignore"]
    };
    await configManager.addRepository(repo);

    const patterns = configManager.getExcludePatternsForRepo(repo);
    assert.deepStrictEqual(patterns, ["custom-ignore"]);
  });

  test("getExcludePatternsForRepo() falls back to global patterns", async () => {
    const repoPath = await createTempDir("knowledge-config-repo");
    tempDirs.push(repoPath);

    const repo = {
      name: "repo1",
      path: repoPath
    };
    await configManager.addRepository(repo);

    const patterns = configManager.getExcludePatternsForRepo(repo);
    assert.ok(patterns.includes(".git"));
  });
});
