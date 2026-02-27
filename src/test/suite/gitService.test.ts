import * as assert from "assert";
import * as path from "path";
import * as fs from "fs/promises";
import * as childProcess from "child_process";
import { promisify } from "util";
import { GitService } from "../../services/gitService";
import { createTempDir, removeDir } from "./testUtils";

const execFile = promisify(childProcess.execFile);

suite("GitService", () => {
  const gitService = new GitService();
  let tempDir = "";

  setup(async () => {
    tempDir = await createTempDir("knowledge-git-service");
  });

  teardown(async () => {
    await removeDir(tempDir);
  });

  test("isGitRepo() returns false for normal folder", async () => {
    const result = await gitService.isGitRepo(tempDir);
    assert.strictEqual(result, false);
  });

  test("isGitRepo() returns true for initialized git repository", async function () {
    try {
      await execFile("git", ["--version"]);
    } catch {
      this.skip();
      return;
    }

    const repoPath = path.join(tempDir, "repo");
    await fs.mkdir(repoPath, { recursive: true });
    await execFile("git", ["init"], { cwd: repoPath });

    const result = await gitService.isGitRepo(repoPath);
    assert.strictEqual(result, true);
  });
});
