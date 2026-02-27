import * as assert from "assert";
import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { ConfigManager } from "../../config";
import { ExplorerProvider } from "../../providers/explorerProvider";
import { GitService } from "../../services/gitService";
import { createTempDir, removeDir, resetKnowledgeConfig, waitFor } from "./testUtils";

suite("ExplorerProvider", () => {
  let configManager: ConfigManager;
  let provider: ExplorerProvider;
  let repoDir = "";

  setup(async () => {
    await resetKnowledgeConfig();
    repoDir = await createTempDir("knowledge-explorer-repo");
    configManager = new ConfigManager();
    provider = new ExplorerProvider(configManager, new GitService());
  });

  teardown(async () => {
    provider.dispose();
    configManager.dispose();
    await removeDir(repoDir);
    await resetKnowledgeConfig();
  });

  test("getChildren() returns empty when no repositories configured", async () => {
    const rootChildren = await provider.getChildren();
    assert.strictEqual(rootChildren.length, 0);
  });

  test("root returns repository item after configuration", async () => {
    await configManager.addRepository({ name: "repo-a", path: repoDir });
    await waitFor(100);

    const rootChildren = await provider.getChildren();
    assert.strictEqual(rootChildren.length, 1);
    assert.strictEqual(rootChildren[0].itemType, "repositoryRoot");
    assert.strictEqual(rootChildren[0].label, "repo-a");
  });

  test("children place folders before files", async () => {
    await fs.mkdir(path.join(repoDir, "z-folder"), { recursive: true });
    await fs.writeFile(path.join(repoDir, "a-file.md"), "hello");
    await configManager.addRepository({ name: "repo-a", path: repoDir });
    await waitFor(100);

    const rootChildren = await provider.getChildren();
    const repoItem = rootChildren[0];
    const children = await provider.getChildren(repoItem);

    assert.ok(children.length >= 2);
    assert.strictEqual(children[0].itemType, "folder");
    assert.strictEqual(children[1].itemType, "file");
  });

  test("excludePatterns remove matching folders", async () => {
    await fs.mkdir(path.join(repoDir, "visible"), { recursive: true });
    await fs.mkdir(path.join(repoDir, "hidden"), { recursive: true });

    const config = vscode.workspace.getConfiguration("knowledge");
    await config.update("excludePatterns", ["hidden"], vscode.ConfigurationTarget.Global);
    await configManager.addRepository({ name: "repo-a", path: repoDir });
    await waitFor(100);

    const rootChildren = await provider.getChildren();
    const repoItem = rootChildren[0];
    const children = await provider.getChildren(repoItem);
    const labels = children.map((item) => item.label?.toString());

    assert.ok(labels.includes("visible"));
    assert.ok(!labels.includes("hidden"));
  });

  test("pattern .git does not hide .gitignore file", async () => {
    await fs.mkdir(path.join(repoDir, ".git"), { recursive: true });
    await fs.writeFile(path.join(repoDir, ".gitignore"), "node_modules");

    const config = vscode.workspace.getConfiguration("knowledge");
    await config.update("excludePatterns", [".git"], vscode.ConfigurationTarget.Global);
    await configManager.addRepository({ name: "repo-a", path: repoDir });
    await waitFor(100);

    const rootChildren = await provider.getChildren();
    const repoItem = rootChildren[0];
    const children = await provider.getChildren(repoItem);
    const labels = children.map((item) => item.label?.toString());

    assert.ok(labels.includes(".gitignore"));
    assert.ok(!labels.includes(".git"));
  });
});
