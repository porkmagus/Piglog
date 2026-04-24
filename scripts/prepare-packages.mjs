import { readFileSync, writeFileSync } from 'fs';

function rewrite(val) {
  if (typeof val !== 'string') return val;
  if (val.startsWith('./src/')) {
    return val
      .replace('./src/', './dist/')
      .replace(/\.ts$/, '.js')
      .replace(/\.d\.js$/, '.d.ts');
  }
  return val;
}

function prepare(path) {
  const pkg = JSON.parse(readFileSync(path, 'utf-8'));

  if (pkg.main) pkg.main = rewrite(pkg.main);
  if (pkg.types) pkg.types = rewrite(pkg.types);

  if (pkg.exports) {
    for (const [key, val] of Object.entries(pkg.exports)) {
      if (typeof val === 'string') {
        pkg.exports[key] = rewrite(val);
      } else if (val && typeof val === 'object') {
        if (val.types) val.types = rewrite(val.types);
        if (val.default) val.default = rewrite(val.default);
      }
    }
  }

  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Prepared ${path} for production`);
}

prepare('packages/db/package.json');
prepare('packages/contracts/package.json');
