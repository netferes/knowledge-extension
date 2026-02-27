import * as path from "path";
import * as vscode from "vscode";
import { ConfigManager } from "./config";
import { ExplorerProvider, KBItem } from "./providers/explorerProvider";
import { HelpViewProvider } from "./providers/helpViewProvider";
import { SearchViewProvider } from "./providers/searchViewProvider";
import { FileService } from "./services/fileService";
import { GitService } from "./services/gitService";
import { SearchService } from "./services/searchService";

async function promptForRepositoryPath(): Promise<string | undefined> {
  const selected = await vscode.window.showOpenDialog({
    canSelectMany: false,
    canSelectFiles: false,
    canSelectFolders: true,
    openLabel: "Select Repository Folder"
  });
  return selected?.[0]?.fsPath;
}

async function promptForParentFolder(): Promise<string | undefined> {
  const selected = await vscode.window.showOpenDialog({
    canSelectMany: false,
    canSelectFiles: false,
    canSelectFolders: true,
    openLabel: "Select Parent Folder"
  });
  return selected?.[0]?.fsPath;
}

async function getTargetDirectory(item?: KBItem): Promise<vscode.Uri | undefined> {
  if (!item) {
    const selected = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: false,
      canSelectFolders: true,
      openLabel: "Select Parent Folder"
    });
    return selected?.[0];
  }

  if (item.itemType === "file") {
    return vscode.Uri.file(path.dirname(item.uri.fsPath));
  }
  return item.uri;
}

function getSelectedTargetDirectory(
  rootItem: KBItem,
  treeView: vscode.TreeView<KBItem>
): vscode.Uri {
  const selected = treeView.selection[0];
  if (!selected || selected.repository.path !== rootItem.repository.path) {
    return rootItem.uri;
  }
  if (selected.itemType === "folder") {
    return selected.uri;
  }
  if (selected.itemType === "file") {
    return vscode.Uri.file(path.dirname(selected.uri.fsPath));
  }
  return rootItem.uri;
}

export function activate(context: vscode.ExtensionContext): void {
  try {
    doActivate(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[Knowledge] Activation failed:", message, stack);
    vscode.window.showErrorMessage(
      `Knowledge: 扩展激活失败。请查看输出面板中「扩展宿主」的详细错误。${message ? ` (${message})` : ""}`
    );
  }
}

function doActivate(context: vscode.ExtensionContext): void {
  const configManager = new ConfigManager();
  const fileService = new FileService();
  const gitService = new GitService();
  const searchService = new SearchService(configManager);
  const explorerProvider = new ExplorerProvider(configManager, gitService);
  const searchViewProvider = new SearchViewProvider(context.extensionUri, searchService, fileService);
  const helpViewProvider = new HelpViewProvider(context.extensionUri);
  const explorerTreeView = vscode.window.createTreeView("knowledge.explorer", {
    treeDataProvider: explorerProvider
  });

  context.subscriptions.push(
    configManager,
    explorerProvider,
    explorerTreeView,
    vscode.window.registerWebviewViewProvider(SearchViewProvider.viewId, searchViewProvider),
    vscode.window.registerWebviewViewProvider(HelpViewProvider.viewId, helpViewProvider),
    vscode.commands.registerCommand("knowledge.refreshExplorer", () => explorerProvider.refresh()),
    vscode.commands.registerCommand("knowledge.addRepository", async () => {
      try {
        const pathInput = await promptForRepositoryPath();
        if (!pathInput) {
          return;
        }
        const suggestedName = path.basename(pathInput);
        const name = await vscode.window.showInputBox({
          prompt: "Repository name",
          value: suggestedName,
          validateInput: (value) => (value.trim() ? null : "Repository name is required")
        });
        if (!name) {
          return;
        }
        await configManager.addRepository({ name: name.trim(), path: pathInput });
        explorerProvider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to add repository: ${String(error)}`);
      }
    }),
    vscode.commands.registerCommand("knowledge.removeRepository", async (item?: KBItem) => {
      if (!item || item.itemType !== "repositoryRoot") {
        vscode.window.showWarningMessage("Please select a repository root to remove.");
        return;
      }
      const answer = await vscode.window.showWarningMessage(
        `Remove repository "${item.repository.name}" from Knowledge list?`,
        { modal: true },
        "Remove"
      );
      if (answer !== "Remove") {
        return;
      }
      await configManager.removeRepository(item.repository.path);
      explorerProvider.refresh();
    }),
    vscode.commands.registerCommand("knowledge.cloneRepository", async () => {
      const remoteUrl = await vscode.window.showInputBox({
        prompt: "Git repository URL",
        placeHolder: "https://github.com/org/repo.git"
      });
      if (!remoteUrl) {
        return;
      }
      const parentPath = await promptForParentFolder();
      if (!parentPath) {
        return;
      }
      const folderName = await vscode.window.showInputBox({
        prompt: "Local folder name",
        value: path.basename(remoteUrl).replace(/\.git$/, "") || "knowledge-repo",
        validateInput: (value) => (value.trim() ? null : "Folder name is required")
      });
      if (!folderName) {
        return;
      }
      const targetPath = path.join(parentPath, folderName.trim());
      const repositoryName = await vscode.window.showInputBox({
        prompt: "Knowledge repository display name",
        value: folderName.trim(),
        validateInput: (value) => (value.trim() ? null : "Repository name is required")
      });
      if (!repositoryName) {
        return;
      }
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Cloning repository...",
          cancellable: false
        },
        async () => {
          await gitService.cloneRepository(remoteUrl, targetPath);
          await configManager.addRepository({ name: repositoryName.trim(), path: targetPath });
        }
      );
      explorerProvider.refresh();
    }),
    vscode.commands.registerCommand("knowledge.openInNewWindow", async (item?: KBItem) => {
      if (!item || item.itemType !== "repositoryRoot") {
        vscode.window.showWarningMessage("Please select a repository root to open.");
        return;
      }
      await vscode.commands.executeCommand("vscode.openFolder", item.uri, { forceNewWindow: true });
    }),
    vscode.commands.registerCommand("knowledge.newFile", async (item?: KBItem) => {
      let targetUri = await getTargetDirectory(item);
      if (item?.itemType === "repositoryRoot") {
        targetUri = getSelectedTargetDirectory(item, explorerTreeView);
      }
      if (!targetUri) {
        return;
      }
      const fileName = await vscode.window.showInputBox({
        prompt: "New file name",
        value: "note.md",
        validateInput: (value) => (value.trim() ? null : "File name is required")
      });
      if (!fileName) {
        return;
      }
      const created = await fileService.createFile(targetUri, fileName.trim(), true);
      explorerProvider.refresh();
      await fileService.openFile(created);
    }),
    vscode.commands.registerCommand("knowledge.newFolder", async (item?: KBItem) => {
      let targetUri = await getTargetDirectory(item);
      if (item?.itemType === "repositoryRoot") {
        targetUri = getSelectedTargetDirectory(item, explorerTreeView);
      }
      if (!targetUri) {
        return;
      }
      const folderName = await vscode.window.showInputBox({
        prompt: "New folder name",
        validateInput: (value) => (value.trim() ? null : "Folder name is required")
      });
      if (!folderName) {
        return;
      }
      await fileService.createFolder(targetUri, folderName.trim());
      explorerProvider.refresh();
    }),
    vscode.commands.registerCommand("knowledge.rename", async (item?: KBItem) => {
      if (!item) {
        vscode.window.showWarningMessage("Please select a file or folder to rename.");
        return;
      }
      const nextName = await vscode.window.showInputBox({
        prompt: "Rename item",
        value: path.basename(item.uri.fsPath),
        validateInput: (value) => (value.trim() ? null : "Name is required")
      });
      if (!nextName) {
        return;
      }
      const nextUri = await fileService.rename(item.uri, nextName.trim());
      if (item.itemType === "repositoryRoot") {
        const repositories = configManager.getRepositories().map((repo) => {
          if (repo.path !== item.repository.path) {
            return repo;
          }
          return {
            ...repo,
            name: nextName.trim(),
            path: nextUri.fsPath
          };
        });
        await configManager.writeRepositories(repositories);
      }
      explorerProvider.refresh();
    }),
    vscode.commands.registerCommand("knowledge.delete", async (item?: KBItem) => {
      if (!item) {
        vscode.window.showWarningMessage("Please select a file or folder to delete.");
        return;
      }
      const answer = await vscode.window.showWarningMessage(
        `Move "${path.basename(item.uri.fsPath)}" to trash?`,
        { modal: true },
        "Delete"
      );
      if (answer !== "Delete") {
        return;
      }
      await fileService.delete(item.uri);
      if (item.itemType === "repositoryRoot") {
        await configManager.removeRepository(item.repository.path);
      }
      explorerProvider.refresh();
    }),
    vscode.commands.registerCommand("knowledge.openFile", async (item?: KBItem) => {
      if (!item || item.itemType !== "file") {
        return;
      }
      await fileService.openFile(item.uri);
    }),
    vscode.commands.registerCommand("knowledge.showHelp", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.knowledge");
      await vscode.commands.executeCommand("knowledge.help.focus");
    })
  );
}

export function deactivate(): void {
  // noop
}
