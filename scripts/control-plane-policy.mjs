import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { buildPolicyVerdict, renderPolicySummary } from './lib/control-plane-policy.mjs';

const args = parseArgs(process.argv.slice(2));
const verdict = buildPolicyVerdict({
  files: loadListFile(args.filesFile),
  labels: loadListFile(args.labelsFile),
  actor: args.actor,
});

const json = `${JSON.stringify(verdict, null, 2)}\n`;
const summary = renderPolicySummary(verdict);

if (args.jsonOut) {
  writeFileSync(args.jsonOut, json, 'utf8');
}

if (args.summaryOut) {
  writeFileSync(args.summaryOut, summary, 'utf8');
}

process.stdout.write(json);

if (verdict.gate.status !== 'pass') {
  console.error(summary);
  process.exit(1);
}

function parseArgs(argv) {
  const result = {
    actor: 'unknown',
    filesFile: null,
    labelsFile: null,
    jsonOut: null,
    summaryOut: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    switch (value) {
      case '--actor':
        result.actor = argv[index + 1] ?? result.actor;
        index += 1;
        break;
      case '--files-file':
        result.filesFile = resolvePath(argv[index + 1]);
        index += 1;
        break;
      case '--labels-file':
        result.labelsFile = resolvePath(argv[index + 1]);
        index += 1;
        break;
      case '--json-out':
        result.jsonOut = resolvePath(argv[index + 1]);
        index += 1;
        break;
      case '--summary-out':
        result.summaryOut = resolvePath(argv[index + 1]);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${value}`);
    }
  }

  if (!result.filesFile) {
    throw new Error('Missing required --files-file argument.');
  }

  return result;
}

function resolvePath(value) {
  return value ? path.resolve(value) : null;
}

function loadListFile(filePath) {
  if (!filePath) {
    return [];
  }

  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}
