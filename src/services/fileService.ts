import * as path from "path";
import * as vscode from "vscode";
import { defaultMarkdownTemplate } from "../utils/template";

export class FileService {
  async createFile(parentUri: vscode.Uri, fileName: string, useTemplate = true): Promise<vscode.Uri> {
    const fileUri = vscode.Uri.file(path.join(parentUri.fsPath, fileName));
    const encoder = new TextEncoder();
    const title = path.parse(fileName).name;
    const content = useTemplate ? defaultMarkdownTemplate(title) : "";
    await vscode.workspace.fs.writeFile(fileUri, encoder.encode(content));
    return fileUri;
  }

  async createFolder(parentUri: vscode.Uri, folderName: string): Promise<vscode.Uri> {
    const folderUri = vscode.Uri.file(path.join(parentUri.fsPath, folderName));
    await vscode.workspace.fs.createDirectory(folderUri);
    return folderUri;
  }

  async rename(uri: vscode.Uri, newName: string): Promise<vscode.Uri> {
    const nextUri = vscode.Uri.file(path.join(path.dirname(uri.fsPath), newName));
    await vscode.workspace.fs.rename(uri, nextUri, { overwrite: false });
    return nextUri;
  }

  async delete(uri: vscode.Uri): Promise<void> {
    await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: true });
  }

  async openFile(uri: vscode.Uri, lineNumber?: number): Promise<void> {
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    if (typeof lineNumber === "number" && Number.isFinite(lineNumber) && lineNumber > 0) {
      const position = new vscode.Position(lineNumber - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    }
  }
}
