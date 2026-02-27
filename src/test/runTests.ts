import * as path from "path";
import * as fs from "fs";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    const localVSCodeExecutable =
      "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code";

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      vscodeExecutablePath: fs.existsSync(localVSCodeExecutable)
        ? localVSCodeExecutable
        : undefined
    });
  } catch (error) {
    console.error("Failed to run extension tests.");
    console.error(error);
    process.exit(1);
  }
}

void main();
