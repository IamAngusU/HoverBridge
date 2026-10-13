import { spawnSync } from 'node:child_process';

if (process.env.GITHUB_REPOSITORY !== 'angusu-de/HoverBridge-CI') {
  console.log('Primary checkout: no mirror comparison needed.');
  process.exit(0);
}

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `git ${args[0]} failed`);
  return result.stdout.trim();
}

const local = git(['rev-parse', 'HEAD']);
const remote = git(['ls-remote', 'https://github.com/IamAngusU/HoverBridge.git', 'refs/heads/main']).split(/\s+/)[0];
if (!remote || local !== remote) {
  throw new Error(`CI mirror differs from IamAngusU/HoverBridge main: mirror=${local}, source=${remote || 'missing'}`);
}
console.log(`Verified CI mirror matches IamAngusU/HoverBridge main: ${local}`);
