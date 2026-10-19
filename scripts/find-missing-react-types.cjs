// Lists packages reachable from a workspace project that ship .d.ts files, use React, and cannot
// resolve @types/react from their own install folder. Each one needs an entry in
// pnpm-workspace.yaml packageExtensions. Usage: node scripts/find-missing-react-types.cjs nextjs_space
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2]);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const seen = new Set();
const need = new Map();

function visit(name, nodeModules, depth) {
  let dir;
  try {
    dir = fs.realpathSync(path.join(nodeModules, name));
  } catch {
    return;
  }
  if (seen.has(dir)) return;
  seen.add(dir);
  let p;
  try {
    p = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  } catch {
    return;
  }
  const usesReact = (p.peerDependencies && p.peerDependencies.react) || (p.dependencies && p.dependencies.react);
  const hasTypes = p.types || p.typings || fs.existsSync(path.join(dir, 'index.d.ts')) || JSON.stringify(p.exports || {}).includes('.d.');
  if (usesReact && hasTypes && name !== 'react' && !name.startsWith('@types/')) {
    try {
      require.resolve('@types/react/package.json', { paths: [dir] });
    } catch {
      need.set(name, p.version);
    }
  }
  // In pnpm's layout a package's own dependencies sit next to it: .pnpm/<id>/node_modules/<dep>.
  const siblings = dir.slice(0, dir.length - name.length);
  if (depth < 6) for (const d of Object.keys({ ...p.dependencies, ...p.peerDependencies })) visit(d, siblings, depth + 1);
}

for (const d of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) visit(d, path.join(root, 'node_modules'), 0);
console.log([...need].map(([n, v]) => `${n}@${v}`).sort().join('\n') || '(none)');
