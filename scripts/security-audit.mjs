import { spawnSync } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const workflowRoot = path.join(repoRoot, ".github", "workflows");
const checks = [];

runCheck("Workflow permissions", checkWorkflowPermissions);
runCheck("pnpm audit (prod)", () => {
  runCommand(getPnpmCommand(), ["audit", "--prod", "--audit-level=high"], {
    cwd: repoRoot,
  });
});
runCheck("pip-audit (engine)", () => {
  runCommand(
    process.execPath,
    [
      path.join("scripts", "engine-python.mjs"),
      "-m",
      "pip_audit",
      "--desc",
      "--ignore-vuln",
      "CVE-2026-4539",
    ],
    {
      cwd: repoRoot,
      failureHint:
        "Ensure apps/engine/.venv exists and pip-audit is installed in that environment before rerunning.",
    },
  );
});

writeSummary(checks);

if (checks.some((check) => check.status === "failed")) {
  process.exit(1);
}

function checkWorkflowPermissions() {
  const workflowFiles = readdirSync(workflowRoot)
    .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
    .sort();
  const missingPermissions = workflowFiles.filter(
    (file) => !hasRootPermissions(path.join(workflowRoot, file)),
  );

  if (missingPermissions.length > 0) {
    throw new Error(
      `Every workflow must declare top-level permissions. Missing in: ${missingPermissions.join(", ")}`,
    );
  }
}

function hasRootPermissions(filePath) {
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/u);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    if (/^permissions:\s*$/u.test(line) || /^permissions:\s+\S+/u.test(line)) {
      return true;
    }

    if (/^jobs:\s*$/u.test(line)) {
      return false;
    }
  }

  return false;
}

function runCheck(name, action) {
  console.log(`\n==> ${name}`);

  try {
    action();
    checks.push({ name, status: "passed" });
    console.log(`PASS: ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({ name, status: "failed", message });
    console.error(`FAIL: ${name}`);
    console.error(message);
  }
}

function runCommand(command, args, options) {
  const invocation =
    process.platform === "win32" && command.endsWith(".cmd")
      ? {
          command: "cmd.exe",
          args: ["/d", "/s", "/c", `${command} ${args.join(" ")}`],
        }
      : { command, args };
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    const hint = options.failureHint ? ` ${options.failureHint}` : "";
    throw new Error(`Command failed: ${command} ${args.join(" ")}.${hint}`);
  }
}

function writeSummary(results) {
  const lines = [
    "## Security audit summary",
    "",
    ...results.map((result) =>
      `- ${result.status === "passed" ? "PASS" : "FAIL"}: ${result.name}${result.message ? ` — ${result.message}` : ""}`,
    ),
    "",
  ];

  console.log(`\n${lines.join("\n")}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, "utf8");
  }
}

function getPnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}
