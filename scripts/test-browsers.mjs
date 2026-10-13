import { spawnSync } from 'node:child_process';

for (const engine of ['chromium', 'firefox', 'webkit']) {
  console.log(`\nHoverBridge browser suite: ${engine}`);
  const env = { ...process.env, HOVERBRIDGE_BROWSER: engine };
  delete env.PLAYWRIGHT_EXECUTABLE_PATH;
  const run = spawnSync(process.execPath, ['--test', 'tests/browser.test.mjs'], {
    stdio: 'inherit', env,
  });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
