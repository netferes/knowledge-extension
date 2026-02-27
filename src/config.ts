import * as vscode from "vscode";
import { RepositoryConfig } from "./types";

const CONFIG_SECTION = "knowledge";
const REPOSITORIES_KEY = "repositories";
const EXCLUDE_PATTERNS_KEY = "excludePatterns";

export class ConfigManager implements vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<RepositoryConfig[]>();
  readonly onDidChangeRepositories = this.emitter.event;

  private readonly configChangeDisposable: vscode.Disposable;

  constructor() {
    this.configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(`${CONFIG_SECTION}.${REPOSITORIES_KEY}`)) {
        this.emitter.fire(this.getRepositories());
      }
    });
  }

  getRepositories(): RepositoryConfig[] {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const repositories = config.get<RepositoryConfig[]>(REPOSITORIES_KEY, []);

    return repositories.filter((repo) => Boolean(repo?.name) && Boolean(repo?.path));
  }

  getExcludePatterns(): string[] {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return config.get<string[]>(EXCLUDE_PATTERNS_KEY, []).filter((item) => Boolean(item));
  }

  getExcludePatternsForRepo(repository: RepositoryConfig): string[] {
    if (repository.excludePatterns && repository.excludePatterns.length > 0) {
      return repository.excludePatterns.filter((item) => Boolean(item));
    }
    return this.getExcludePatterns();
  }

  async addRepository(repository: RepositoryConfig): Promise<void> {
    const repositories = this.getRepositories();
    const exists = repositories.some(
      (repo) => repo.path === repository.path || repo.name === repository.name
    );
    if (exists) {
      throw new Error(`Repository already exists: ${repository.name}`);
    }
    repositories.push(repository);
    await this.writeRepositories(repositories);
  }

  async removeRepository(repositoryPath: string): Promise<void> {
    const repositories = this.getRepositories().filter((repo) => repo.path !== repositoryPath);
    await this.writeRepositories(repositories);
  }

  async writeRepositories(repositories: RepositoryConfig[]): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update(REPOSITORIES_KEY, repositories, vscode.ConfigurationTarget.Global);
    this.emitter.fire(this.getRepositories());
  }

  dispose(): void {
    this.configChangeDisposable.dispose();
    this.emitter.dispose();
  }
}
