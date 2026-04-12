import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const required = [
  '.github/workflows/ci.yml',
  '.github/workflows/policy-verdict.yml',
  '.github/workflows/railway-deploy.yml',
  '.github/workflows/dependency-review.yml',
  '.github/workflows/supabase-typegen.yml',
  '.github/workflows/ci-notify.yml',
  '.github/workflows/control-plane-nightly.yml',
  '.github/workflows/workflow-lint.yml',
  '.github/workflows/vercel-preview-smoke.yml',
  '.github/workflows/gitleaks.yml',
];

const missing = required.filter((file) => !existsSync(path.join(root, file)));

if (missing.length > 0) {
  console.error(`Missing required workflow file(s): ${missing.join(', ')}`);
  process.exit(1);
}

console.log('All required workflow files are present.');
