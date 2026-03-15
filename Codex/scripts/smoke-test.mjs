import { spawn } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const port = 3200;
const baseUrl = `http://127.0.0.1:${port}`;

const checks = [
  {
    path: '/',
    text: 'A serious trading app starts as a research operating system.',
  },
  {
    path: '/lab',
    text: 'Filter the sleeve catalog by readiness, family, and signal quality.',
  },
  {
    path: '/controls',
    text: 'Launch gates, execution rules, and deployment doctrine.',
  },
  {
    path: '/sources',
    text: 'A source ledger is part of the product, not an appendix.',
  },
];

function getStartCommand() {
  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/c', 'pnpm', 'start'],
    };
  }

  return {
    command: 'pnpm',
    args: ['start'],
  };
}

async function waitForServer(url, attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}

    await delay(1000);
  }

  throw new Error(`Server did not become ready at ${url}`);
}

async function run() {
  const { command, args } = getStartCommand();
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port),
    },
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const stopServer = async () => {
    if (child.exitCode !== null) {
      return;
    }

    if (process.platform === 'win32') {
      await new Promise((resolve) => {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
          stdio: 'ignore',
        });
        killer.on('exit', resolve);
        killer.on('error', resolve);
      });
      return;
    }

    child.kill('SIGTERM');
  };

  process.on('exit', stopServer);
  process.on('SIGINT', () => {
    void stopServer();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    void stopServer();
    process.exit(143);
  });

  try {
    await waitForServer(baseUrl);

    for (const check of checks) {
      const response = await fetch(`${baseUrl}${check.path}`);
      if (!response.ok) {
        throw new Error(`Route ${check.path} returned ${response.status}`);
      }

      const html = await response.text();
      if (!html.includes(check.text)) {
        throw new Error(`Route ${check.path} did not include expected text: ${check.text}`);
      }
    }

    console.log(`Smoke test passed for ${checks.length} routes.`);
  } catch (error) {
    console.error('Smoke test failed.');
    if (stdout.trim()) {
      console.error('Server stdout:');
      console.error(stdout.trim());
    }
    if (stderr.trim()) {
      console.error('Server stderr:');
    console.error(stderr.trim());
    }
    throw error;
  } finally {
    await stopServer();
    await new Promise((resolve) => {
      if (child.exitCode !== null) {
        resolve();
        return;
      }
      child.on('exit', resolve);
    });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
