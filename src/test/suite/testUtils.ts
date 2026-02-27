import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}

export async function removeDir(targetPath: string): Promise<void> {
  await fs.rm(targetPath, { recursive: true, force: true });
}

export async function resetKnowledgeConfig(): Promise<void> {
  const config = vscode.workspace.getConfiguration("knowledge");
  await config.update("repositories", [], vscode.ConfigurationTarget.Global);
  await config.update(
    "excludePatterns",
    ["node_modules", ".git", ".DS_Store", "*.vsix", "__pycache__"],
    vscode.ConfigurationTarget.Global
  );
}

export async function waitFor(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
