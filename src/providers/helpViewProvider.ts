import * as vscode from "vscode";

function nonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 24; i += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

export class HelpViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = "knowledge.help";

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: false,
      localResourceRoots: [this.extensionUri]
    };
    webview.html = this.renderHtml(webview);
  }

  private renderHtml(webview: vscode.Webview): string {
    const cspNonce = nonce();
    const isZh = vscode.env.language.toLowerCase().startsWith("zh");

    const text = isZh
      ? {
          lang: "zh-CN",
          quickStart: "快速入门",
          quickStartItems: [
            "通过 <code>Knowledge: 添加知识库</code> 或标题栏按钮添加知识库。",
            "在“浏览器”中浏览文件，在“搜索”视图中检索内容。",
            "通过右键菜单进行新建、重命名、删除。"
          ],
          gitSync: "Git 同步说明",
          gitSyncItems: [
            "在知识库根节点执行 <code>Knowledge: 在新窗口打开</code>。",
            "在新窗口使用 VS Code/Cursor 内置 Source Control 面板。",
            "commit / push / pull 等 Git 操作在内置 Git 面板完成。"
          ],
          commands: "Commands",
          commandHint:
            "命令入口：macOS 使用 <code>Cmd+Shift+P</code>，Windows/Linux 使用 <code>Ctrl+Shift+P</code>，输入 <code>Knowledge:</code>。",
          config: "Configuration",
          configItems: [
            "入口 1：设置界面搜索 <code>knowledge.*</code>。",
            "入口 2：用户设置 JSON（Cursor/VS Code）中配置。",
            "<code>knowledge.repositories</code>：知识库列表。",
            "<code>knowledge.excludePatterns</code>：全局排除规则。",
            "仓库级 <code>excludePatterns</code>（若配置）优先于全局规则。"
          ],
          version: "版本",
          versionValue: "当前扩展版本：0.0.1",
          links: "链接",
          issue: "问题反馈：GitHub Issues"
        }
      : {
          lang: "en",
          quickStart: "Quick Start",
          quickStartItems: [
            "Add repositories from <code>Knowledge: Add Knowledge Repository</code> or title-bar actions.",
            "Browse files in Explorer and search from the Search view.",
            "Use context menus to create, rename, and delete entries."
          ],
          gitSync: "Git Sync to GitHub",
          gitSyncItems: [
            "Run <code>Knowledge: Open in New Window</code> on a repository root.",
            "Use built-in Source Control in that new window.",
            "Commit/push/pull are completed in the built-in Git panel."
          ],
          commands: "Commands",
          commandHint:
            "Command entry: macOS <code>Cmd+Shift+P</code>, Windows/Linux <code>Ctrl+Shift+P</code>, then type <code>Knowledge:</code>.",
          config: "Configuration",
          configItems: [
            "Entry 1: open Settings UI and search <code>knowledge.*</code>.",
            "Entry 2: edit user settings JSON in Cursor/VS Code.",
            "<code>knowledge.repositories</code>: repository list.",
            "<code>knowledge.excludePatterns</code>: global exclude patterns.",
            "Repository-level <code>excludePatterns</code> (if set) overrides global patterns."
          ],
          version: "Version",
          versionValue: "Current extension version: 0.0.1",
          links: "Links",
          issue: "Issue feedback: GitHub Issues"
        };

    const quickStartItems = text.quickStartItems.map((item) => `<li>${item}</li>`).join("");
    const gitSyncItems = text.gitSyncItems.map((item) => `<li>${item}</li>`).join("");
    const configItems = text.configItems.map((item) => `<li>${item}</li>`).join("");

    return `<!DOCTYPE html>
<html lang="${text.lang}">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${cspNonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style nonce="${cspNonce}">
      body { font-family: var(--vscode-font-family); padding: 8px; line-height: 1.45; }
      h3 { margin: 12px 0 6px; }
      ul { margin: 4px 0 8px 18px; padding: 0; }
      li { margin: 3px 0; }
      code { font-family: var(--vscode-editor-font-family); }
      .muted { color: var(--vscode-descriptionForeground); }
    </style>
  </head>
  <body>
    <h3>${text.quickStart}</h3>
    <ul>${quickStartItems}</ul>

    <h3>${text.gitSync}</h3>
    <ul>${gitSyncItems}</ul>

    <h3>${text.commands}</h3>
    <p class="muted">${text.commandHint}</p>
    <ul>
      <li><code>knowledge.addRepository</code></li>
      <li><code>knowledge.cloneRepository</code></li>
      <li><code>knowledge.refreshExplorer</code></li>
      <li><code>knowledge.newFile</code> / <code>knowledge.newFolder</code></li>
      <li><code>knowledge.rename</code> / <code>knowledge.delete</code></li>
      <li><code>knowledge.openInNewWindow</code></li>
    </ul>

    <h3>${text.config}</h3>
    <ul>${configItems}</ul>

    <h3>${text.version}</h3>
    <p class="muted">${text.versionValue}</p>

    <h3>${text.links}</h3>
    <ul>
      <li>GitHub: <span class="muted">https://github.com/netferes/knowledge-vscode-extension</span></li>
      <li>${text.issue}</li>
    </ul>
  </body>
</html>`;
  }
}
