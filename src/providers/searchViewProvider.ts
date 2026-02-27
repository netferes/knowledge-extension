import * as vscode from "vscode";
import { SearchService } from "../services/searchService";
import { FileService } from "../services/fileService";
import { SearchQuery, SearchResult } from "../types";

function nonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 24; i += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

export class SearchViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = "knowledge.search";
  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly searchService: SearchService,
    private readonly fileService: FileService
  ) {}

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.view = webviewView;
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")]
    };
    webview.html = this.renderHtml(webview);

    webview.onDidReceiveMessage(async (message) => {
      if (message.type === "search") {
        await this.handleSearchMessage(message.payload as SearchQuery);
      }
      if (message.type === "openResult") {
        const payload = message.payload as SearchResult;
        await this.fileService.openFile(vscode.Uri.file(payload.filePath), payload.lineNumber);
      }
    });
  }

  private async handleSearchMessage(payload: SearchQuery): Promise<void> {
    if (!this.view) {
      return;
    }
    const response = await this.searchService.search(payload);
    this.view.webview.postMessage({ type: "searchResults", payload: response });
  }

  private renderHtml(webview: vscode.Webview): string {
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "search.js"));
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "search.css"));
    const cspNonce = nonce();
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${cspNonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${cssUri}" />
    <title>Knowledge Search</title>
  </head>
  <body>
    <section class="container">
      <div class="search-bar">
        <input id="query" type="text" placeholder="Search knowledge..." />
      </div>
      <div id="results" class="results"></div>
    </section>
    <script nonce="${cspNonce}" src="${jsUri}"></script>
  </body>
</html>`;
  }
}
