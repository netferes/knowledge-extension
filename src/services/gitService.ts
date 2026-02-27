import * as childProcess from "child_process";
import * as path from "path";
import * as util from "util";

const execFile = util.promisify(childProcess.execFile);

export class GitService {
  async isGitRepo(targetPath: string): Promise<boolean> {
    try {
      await execFile("git", ["-C", targetPath, "rev-parse", "--is-inside-work-tree"]);
      return true;
    } catch {
      return false;
    }
  }

  async cloneRepository(remoteUrl: string, targetPath: string): Promise<void> {
    const baseDir = path.dirname(targetPath);
    const folderName = path.basename(targetPath);
    await execFile("git", ["clone", remoteUrl, folderName], {
      cwd: baseDir
    });
  }
}
