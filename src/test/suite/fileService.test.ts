import * as assert from "assert";
import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { FileService } from "../../services/fileService";
import { createTempDir, removeDir } from "./testUtils";

suite("FileService", () => {
  const fileService = new FileService();
  let tempDir = "";

  setup(async () => {
    tempDir = await createTempDir("knowledge-file-service");
  });

  teardown(async () => {
    await removeDir(tempDir);
  });

  test("createFile() creates file with default template", async () => {
    const parentUri = vscode.Uri.file(tempDir);
    const fileUri = await fileService.createFile(parentUri, "note.md");
    const content = await fs.readFile(fileUri.fsPath, "utf8");

    assert.ok(content.includes("# note"));
    assert.ok(content.includes("## Summary"));
  });

  test("createFile() creates empty file when template disabled", async () => {
    const parentUri = vscode.Uri.file(tempDir);
    const fileUri = await fileService.createFile(parentUri, "empty.txt", false);
    const content = await fs.readFile(fileUri.fsPath, "utf8");

    assert.strictEqual(content, "");
  });

  test("createFolder() creates folder", async () => {
    const parentUri = vscode.Uri.file(tempDir);
    const folderUri = await fileService.createFolder(parentUri, "folder-a");

    const stat = await fs.stat(folderUri.fsPath);
    assert.ok(stat.isDirectory());
  });

  test("rename() renames file", async () => {
    const oldPath = path.join(tempDir, "old.md");
    await fs.writeFile(oldPath, "content");

    const renamedUri = await fileService.rename(vscode.Uri.file(oldPath), "new.md");
    const oldExists = await fs.access(oldPath).then(() => true).catch(() => false);
    const newExists = await fs.access(renamedUri.fsPath).then(() => true).catch(() => false);

    assert.strictEqual(oldExists, false);
    assert.strictEqual(newExists, true);
  });

  test("rename() throws when target exists", async () => {
    const oldPath = path.join(tempDir, "one.md");
    const targetPath = path.join(tempDir, "two.md");
    await fs.writeFile(oldPath, "one");
    await fs.writeFile(targetPath, "two");

    await assert.rejects(
      async () => fileService.rename(vscode.Uri.file(oldPath), "two.md")
    );
  });

  test("delete() removes file from original path", async () => {
    const filePath = path.join(tempDir, "to-delete.md");
    await fs.writeFile(filePath, "will be deleted");

    await fileService.delete(vscode.Uri.file(filePath));
    const exists = await fs.access(filePath).then(() => true).catch(() => false);

    assert.strictEqual(exists, false);
  });
});
