import * as path from "path";
import * as vscode from "vscode";
import { ConfigManager } from "../config";
import { GitService } from "../services/gitService";
import { RepositoryConfig } from "../types";

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

export class KBItem extends vscode.TreeItem {
  constructor(
    public readonly itemType: "repositoryRoot" | "folder" | "file",
    public readonly uri: vscode.Uri,
    public readonly repository: RepositoryConfig,
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.resourceUri = uri;
    this.contextValue = itemType;
  }
}

export class ExplorerProvider implements vscode.TreeDataProvider<KBItem>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<KBItem | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  private readonly disposables: vscode.Disposable[] = [];
  private readonly watchers: vscode.FileSystemWatcher[] = [];
  private readonly gitRepoCache = new Map<string, boolean>();

  constructor(
    private readonly config: ConfigManager,
    private readonly gitService: GitService
  ) {
    this.disposables.push(
      this.config.onDidChangeRepositories(async () => {
        await this.setupWatchers();
        this.refresh();
      })
    );
    void this.setupWatchers();
  }

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(element: KBItem): vscode.TreeItem {
    if (element.itemType === "repositoryRoot") {
      const isGit = this.gitRepoCache.get(element.repository.path);
      if (isGit) {
        element.description = "git";
      }
      element.iconPath = new vscode.ThemeIcon("repo");
      return element;
    }

    if (element.itemType === "folder") {
      element.iconPath = vscode.ThemeIcon.Folder;
      return element;
    }

    element.iconPath = vscode.ThemeIcon.File;
    element.command = {
      command: "knowledge.openFile",
      title: "Open File",
      arguments: [element]
    };
    return element;
  }

  async getChildren(element?: KBItem): Promise<KBItem[]> {
    if (!element) {
      return this.getRepositoryRootItems();
    }
    if (element.itemType === "file") {
      return [];
    }
    return this.getPathChildren(element.uri, element.repository);
  }

  private async getRepositoryRootItems(): Promise<KBItem[]> {
    const repositories = this.config.getRepositories();
    const items = await Promise.all(
      repositories.map(async (repository) => {
        const uri = vscode.Uri.file(repository.path);
        const isGit = await this.gitService.isGitRepo(repository.path);
        this.gitRepoCache.set(repository.path, isGit);
        return new KBItem(
          "repositoryRoot",
          uri,
          repository,
          repository.name,
          vscode.TreeItemCollapsibleState.Collapsed
        );
      })
    );
    return items.sort((a, b) => a.label!.toString().localeCompare(b.label!.toString()));
  }

  private async getPathChildren(parentUri: vscode.Uri, repository: RepositoryConfig): Promise<KBItem[]> {
    const excludePatterns = this.config.getExcludePatternsForRepo(repository);
    const entries = await vscode.workspace.fs.readDirectory(parentUri);
    const visibleEntries = entries.filter(([name]) => {
      const absolutePath = path.join(parentUri.fsPath, name);
      const relativePath = path.relative(repository.path, absolutePath);
      return !excludePatterns.some((pattern) => matchesPattern(relativePath, pattern));
    });

    const folders = visibleEntries
      .filter(([, type]) => type === vscode.FileType.Directory)
      .sort((a, b) => a[0].localeCompare(b[0]));
    const files = visibleEntries
      .filter(([, type]) => type === vscode.FileType.File)
      .sort((a, b) => a[0].localeCompare(b[0]));

    const mapEntries = (entryList: [string, vscode.FileType][]): KBItem[] =>
      entryList.map(([name, type]) => {
        const uri = vscode.Uri.file(path.join(parentUri.fsPath, name));
        return new KBItem(
          type === vscode.FileType.Directory ? "folder" : "file",
          uri,
          repository,
          name,
          type === vscode.FileType.Directory
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None
        );
      });

    return [...mapEntries(folders), ...mapEntries(files)];
  }

  private async setupWatchers(): Promise<void> {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers.length = 0;

    const repositories = this.config.getRepositories();
    for (const repository of repositories) {
      const pattern = new vscode.RelativePattern(repository.path, "**/*");
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      watcher.onDidCreate(() => this.refresh());
      watcher.onDidDelete(() => this.refresh());
      watcher.onDidChange(() => this.refresh());
      this.watchers.push(watcher);
    }
  }

  dispose(): void {
    this.emitter.dispose();
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}
