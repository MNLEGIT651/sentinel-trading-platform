import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const contractPath = path.join(repoRoot, 'contracts', 'platform-contract.json');
const checksPolicyPath = path.join(repoRoot, 'policy', 'required-checks.json');
const envExamplePath = path.join(repoRoot, '.env.example');
const ciWorkflowPath = path.join(repoRoot, '.github', 'workflows', 'ci.yml');

const failures = [];
const warnings = [];

const contract = parseJson(contractPath, 'platform contract');
const checksPolicy = parseJson(checksPolicyPath, 'required checks policy');
const envExample = readText(envExamplePath, '.env.example');
const ciWorkflow = readText(ciWorkflowPath, 'CI workflow');

validateEnvContract(contract, envExample);
validateRequiredChecks(contract, checksPolicy, ciWorkflow);
validateHealthEndpoints(contract);

if (warnings.length > 0) {
  console.log('\nWarnings:');
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

if (failures.length > 0) {
  console.error('\nContract validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('✅ Platform contract validation passed.');

function parseJson(filePath, label) {
  try {
    return JSON.parse(readText(filePath, label));
  } catch (error) {
    fail(`Failed to parse ${label} at ${relative(filePath)}: ${formatError(error)}`);
    return {};
  }
}

function readText(filePath, label) {
  if (!existsSync(filePath)) {
    fail(`Missing ${label} file: ${relative(filePath)}`);
    return '';
  }

  return readFileSync(filePath, 'utf8');
}

function validateEnvContract(platformContract, envContent) {
  const vars = new Set();

  for (const key of Object.keys(platformContract.environments ?? {})) {
    const section = platformContract.environments[key];
    for (const bucket of ['public', 'publicFallback', 'server', 'required', 'optional']) {
      for (const envVar of section?.[bucket] ?? []) {
        vars.add(envVar);
      }
    }
  }

  for (const envVar of vars) {
    const regex = new RegExp(`^${escapeRegExp(envVar)}=`, 'm');
    if (!regex.test(envContent)) {
      fail(`.env.example is missing variable declared in platform contract: ${envVar}`);
    }
  }

  const modernSupabase = /^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=/m.test(envContent);
  const legacySupabase = /^NEXT_PUBLIC_SUPABASE_ANON_KEY=/m.test(envContent);
  if (!modernSupabase && !legacySupabase) {
    fail('Supabase browser key contract violated: define NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.example');
  }
}

function validateRequiredChecks(platformContract, policy, workflowContent) {
  if (platformContract.requiredChecksPolicy !== 'policy/required-checks.json') {
    warn(`Platform contract points to unexpected required checks file: ${platformContract.requiredChecksPolicy}`);
  }

  const checkNames = policy.requiredChecks ?? [];
  if (checkNames.length === 0) {
    fail('policy/required-checks.json must define at least one required check');
    return;
  }

  const seen = new Set();
  for (const match of workflowContent.matchAll(/^\s*name:\s*(.+)$/gm)) {
    seen.add(match[1].trim());
  }

  for (const check of checkNames) {
    if (!seen.has(check)) {
      fail(`Required check \"${check}\" is not declared as a workflow or job name in .github/workflows/ci.yml`);
    }
  }
}

function validateHealthEndpoints(platformContract) {
  const healthEndpoints = platformContract.healthEndpoints ?? [];

  for (const endpoint of healthEndpoints) {
    const filePath = path.join(repoRoot, endpoint.file ?? '');
    const fileText = readText(filePath, `health endpoint source (${endpoint.service})`);
    if (!fileText) {
      continue;
    }

    if (!fileText.includes(endpoint.path)) {
      const hasGetHandler = /export\s+async\s+function\s+GET/u.test(fileText);
      if (!hasGetHandler) {
        fail(
          `Health endpoint contract mismatch for ${endpoint.service}: expected path \"${endpoint.path}\" not found in ${endpoint.file}`,
        );
      }
    }
  }
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function relative(filePath) {
  return path.relative(repoRoot, filePath) || filePath;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
