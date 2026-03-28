import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const engineRoot = path.join(repoRoot, "apps", "engine");

const candidates = [
  path.join(engineRoot, ".venv", "Scripts", "python.exe"),
  path.join(engineRoot, ".venv", "Scripts", "python"),
  path.join(engineRoot, ".venv", "bin", "python"),
];

const python = candidates.find((candidate) => existsSync(candidate));

if (!python) {
  console.error(
    "Could not find the engine virtualenv Python executable. Expected one of:\n" +
      candidates.map((candidate) => `- ${candidate}`).join("\n"),
  );
  process.exit(1);
}

const args = process.argv.slice(2).map((arg) => normalizeArg(arg));
const result = spawnSync(python, args, {
  cwd: engineRoot,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

function normalizeArg(arg) {
  if (!arg) {
    return arg;
  }

  const normalized = arg.replace(/\\/g, "/");
  if (normalized.startsWith("apps/engine/")) {
    return normalized.slice("apps/engine/".length);
  }

  return arg;
}
