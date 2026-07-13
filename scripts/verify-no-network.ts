import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { findNetworkViolations } from '../src/build/verify-no-network';

const roots = ['src/main', 'src/renderer', 'src/shared'];
const violations: string[] = [];

function scan(directory: string) {
  for (const name of readdirSync(directory)) {
    const target = path.join(directory, name);
    if (statSync(target).isDirectory()) scan(target);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      const found = findNetworkViolations(readFileSync(target, 'utf8'));
      if (found.length) violations.push(`${target}: ${found.join(', ')}`);
    }
  }
}

roots.forEach(scan);
if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('离线检查通过：未发现业务网络调用');
