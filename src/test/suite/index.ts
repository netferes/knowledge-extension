import * as fs from "fs";
import * as path from "path";
import Mocha from "mocha";

interface TestCaseResult {
  title: string;
  fullTitle: string;
  durationMs: number;
  state: "passed" | "failed" | "pending";
  error?: string;
}

interface TestReport {
  generatedAt: string;
  durationMs: number;
  stats: {
    suites: number;
    tests: number;
    passes: number;
    failures: number;
    pending: number;
  };
  files: string[];
  cases: TestCaseResult[];
}

function writeReports(report: TestReport): void {
  const projectRoot = path.resolve(__dirname, "../../../");
  const outputDir = path.join(projectRoot, "test-results");
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, "test-report.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const failedCases = report.cases.filter((item) => item.state === "failed");
  const lines: string[] = [
    "# Test Report",
    "",
    `- Generated At: ${report.generatedAt}`,
    `- Duration: ${report.durationMs} ms`,
    `- Suites: ${report.stats.suites}`,
    `- Tests: ${report.stats.tests}`,
    `- Passed: ${report.stats.passes}`,
    `- Failed: ${report.stats.failures}`,
    `- Pending: ${report.stats.pending}`,
    "",
    "## Test Files",
    ...report.files.map((file) => `- ${file}`),
    "",
    "## Failed Cases"
  ];

  if (failedCases.length === 0) {
    lines.push("- None");
  } else {
    for (const item of failedCases) {
      lines.push(`- ${item.fullTitle}`);
      if (item.error) {
        lines.push(`  - ${item.error.replace(/\n/g, " ")}`);
      }
    }
  }

  const mdPath = path.join(outputDir, "test-report.md");
  fs.writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");
}

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "bdd",
    color: true,
    timeout: 20000
  });

  const testsRoot = __dirname;
  const testFiles = fs
    .readdirSync(testsRoot)
    .filter((file) => file.endsWith(".test.js"))
    .sort();

  for (const file of testFiles) {
    mocha.addFile(path.resolve(testsRoot, file));
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const cases: TestCaseResult[] = [];
    const runner = mocha.run((failures) => {
      const finishedAt = Date.now();
      const stats = runner.stats ?? {
        suites: 0,
        tests: 0,
        passes: 0,
        failures: failures ?? 0,
        pending: 0
      };

      writeReports({
        generatedAt: new Date(finishedAt).toISOString(),
        durationMs: finishedAt - startedAt,
        stats: {
          suites: stats.suites ?? 0,
          tests: stats.tests ?? 0,
          passes: stats.passes ?? 0,
          failures: stats.failures ?? 0,
          pending: stats.pending ?? 0
        },
        files: testFiles,
        cases
      });

      if (failures > 0) {
        reject(new Error(`${failures} tests failed.`));
        return;
      }
      resolve();
    });

    runner.on("pass", (test) => {
      cases.push({
        title: test.title,
        fullTitle: test.fullTitle(),
        durationMs: test.duration ?? 0,
        state: "passed"
      });
    });

    runner.on("fail", (test, error) => {
      cases.push({
        title: test.title,
        fullTitle: test.fullTitle(),
        durationMs: test.duration ?? 0,
        state: "failed",
        error: error?.stack ?? error?.message ?? String(error)
      });
    });

    runner.on("pending", (test) => {
      cases.push({
        title: test.title,
        fullTitle: test.fullTitle(),
        durationMs: 0,
        state: "pending"
      });
    });
  });
}
