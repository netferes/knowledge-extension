import * as vscode from "vscode";

export interface RepositoryConfig {
  name: string;
  path: string;
  excludePatterns?: string[];
}

export type KBItemType = "repositoryRoot" | "folder" | "file";

export interface SearchResult {
  repositoryName: string;
  repositoryPath: string;
  filePath: string;
  lineNumber: number;
  lineContent: string;
  matchContext: string;
}

export interface SearchQuery {
  term: string;
  repositoryPath?: string;
}

export interface SearchResponse {
  term: string;
  results: SearchResult[];
}

export interface KBNodeMeta {
  type: KBItemType;
  repository: RepositoryConfig;
  uri: vscode.Uri;
}
