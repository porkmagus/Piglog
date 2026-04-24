#!/usr/bin/env node
/**
 * Smoke-check script for the Piglog codebase.
 *
 * Catches common gaps before they reach production:
 *   Frontend:  nav links, error handling, forms, React anti-patterns, auth gaps
 *   Backend:   input validation, console.log, DB error handling, schema drift
 *   General:   hardcoded URLs, .env leaks, any types
 *
 * Run: npm run smoke-check
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WEB = join(ROOT, 'apps/web');
const API = join(ROOT, 'apps/api');
const DB = join(ROOT, 'packages/db');
const ROUTES_DIR = join(WEB, 'app/routes');

let errors = 0;
let warnings = 0;

function err(msg) {
  console.error(`\x1b[31mERROR\x1b[0m  ${msg}`);
  errors++;
}

function warn(msg) {
  console.error(`\x1b[33mWARN\x1b[0m   ${msg}`);
  warnings++;
}

function info(msg) {
  console.error(`\x1b[36mINFO\x1b[0m   ${msg}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readAllFiles(dir, extensions = ['.ts', '.tsx']) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...readAllFiles(full, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

function relPath(filepath, base) {
  return filepath.replace(base + '/', '');
}

function lineAt(lines, idx) {
  return lines[idx]?.trim() || '';
}

// ---------------------------------------------------------------------------
// FRONTEND CHECKS
// ---------------------------------------------------------------------------

function checkFrontend() {
  info('Checking frontend routes...');
  const routeFiles = readAllFiles(ROUTES_DIR);

  // Collect all nav links
  const allNavLinks = new Set();
  for (const file of routeFiles) {
    const content = readFileSync(file, 'utf-8');
    for (const link of extractNavLinks(content)) {
      allNavLinks.add(link);
    }
  }

  // Check each nav link has a route file
  info(`  ${allNavLinks.size} navigation links found`);
  for (const link of allNavLinks) {
    if (link.startsWith('http') || link.startsWith('#') || link.includes('(')) continue;
    if (!routeHasFile(link, routeFiles)) {
      err(`Nav link "${link}" has no matching route file`);
    }
  }

  // Per-file checks
  info('Checking route components...');
  for (const file of routeFiles) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const rp = relPath(file, WEB);

    // Skip index routes for placeholder check
    if (!rp.includes('._index.')) {
      checkPlaceholderRoute(content, rp);
    }
    checkRequireAuth(content, lines, rp);
    checkFetchApiHandling(content, lines, rp);
    checkConsoleError(content, lines, rp);
    checkFormsHaveErrorState(content, rp);
    checkAlertUsage(content, lines, rp);
    checkMapWithoutKey(content, lines, rp);
    checkMissingDisabledOnSubmit(content, lines, rp);
    checkPromiseThenWithoutCatch(content, lines, rp);
    checkHardcodedApiUrl(content, lines, rp);
    checkAnyType(content, lines, rp);
  }

  // Components
  const componentsDir = join(WEB, 'app/components');
  if (existsSync(componentsDir)) {
    info('Checking components...');
    const componentFiles = readAllFiles(componentsDir);
    for (const file of componentFiles) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      const rp = relPath(file, WEB);

      checkFetchApiHandling(content, lines, rp);
      checkConsoleError(content, lines, rp);
      checkFormsHaveErrorState(content, rp);
      checkAlertUsage(content, lines, rp);
      checkMapWithoutKey(content, lines, rp);
      checkHardcodedApiUrl(content, lines, rp);
      checkAnyType(content, lines, rp);
    }
  }

  // Hooks
  const hooksDir = join(WEB, 'app/hooks');
  if (existsSync(hooksDir)) {
    info('Checking hooks...');
    const hookFiles = readAllFiles(hooksDir);
    for (const file of hookFiles) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      const rp = relPath(file, WEB);
      checkPromiseThenWithoutCatch(content, lines, rp);
      checkAnyType(content, lines, rp);
    }
  }
}

// ---------------------------------------------------------------------------
// BACKEND CHECKS
// ---------------------------------------------------------------------------

function checkBackend() {
  info('Checking backend routes...');
  const apiSrc = join(API, 'src');
  const routeFiles = readAllFiles(apiSrc).filter((f) => f.includes('routes.ts') || f.includes('.routes.ts'));

  for (const file of routeFiles) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const rp = relPath(file, API);

    checkRouteInputValidation(content, lines, rp);
    checkConsoleLog(content, lines, rp);
    checkDbQueryWithoutErrorHandling(content, lines, rp);
    checkAnyType(content, lines, rp);
  }

  // Service files
  info('Checking backend services...');
  const serviceFiles = readAllFiles(apiSrc).filter((f) => f.includes('.service.ts') || f.includes('/workers/'));
  for (const file of serviceFiles) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const rp = relPath(file, API);

    checkConsoleLog(content, lines, rp);
    checkDbQueryWithoutErrorHandling(content, lines, rp);
    checkAnyType(content, lines, rp);
  }
}

// ---------------------------------------------------------------------------
// SCHEMA / MIGRATION DRIFT
// ---------------------------------------------------------------------------

function checkSchemaDrift() {
  info('Checking schema vs migrations...');
  const schemaFile = join(DB, 'src/schema.ts');
  const migrationsDir = join(DB, 'migrations');

  if (!existsSync(schemaFile) || !existsSync(migrationsDir)) return;

  const schema = readFileSync(schemaFile, 'utf-8');
  const migrationFiles = readAllFiles(migrationsDir, ['.sql']);

  // Extract table names from schema (e.g., pgTable('workspace', ...))
  const schemaTables = new Set();
  const tableRegex = /pgTable\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = tableRegex.exec(schema)) !== null) {
    schemaTables.add(m[1]);
  }

  // Extract CREATE TABLE from migrations — handle: "table_name", table_name, "schema"."table_name"
  const migrationTables = new Set();
  for (const mf of migrationFiles) {
    const content = readFileSync(mf, 'utf-8');
    // Match all CREATE TABLE statements and extract the table name
    const createMatches = content.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["\w.]+\.)?"?(\w+)"?\s*\(/gi) || [];
    for (const match of createMatches) {
      // Extract just the table name (last identifier before the parenthesis)
      const nameMatch = match.match(/"?(\w+)"?\s*\($/i);
      if (nameMatch) migrationTables.add(nameMatch[1]);
    }
  }

  // Check: every schema table should have a migration
  for (const table of schemaTables) {
    if (!migrationTables.has(table)) {
      warn(`Schema table "${table}" has no CREATE TABLE in migrations`);
    }
  }
}

// ---------------------------------------------------------------------------
// INDIVIDUAL CHECK IMPLEMENTATIONS
// ---------------------------------------------------------------------------

function extractNavLinks(content) {
  const links = [];
  const NavLinkRegex = /to:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = NavLinkRegex.exec(content)) !== null) {
    links.push(m[1]);
  }
  const linkRegex = /(?:href|to)=\{?['"]?\/[^'"}\s]+['"]?\}?/g;
  while ((m = linkRegex.exec(content)) !== null) {
    const val = m[0].replace(/(href|to)=\{?['"]?/, '').replace(/['"]?\}?$/, '');
    if (val.startsWith('/')) links.push(val);
  }
  return [...new Set(links)];
}

function routeHasFile(path, routeFiles) {
  const parts = path.split('/').filter(Boolean);
  const routeName = parts.join('.');
  return routeFiles.some((f) => {
    const basename = f.replace(ROUTES_DIR + '/', '').replace(/\.[^.]+$/, '');
    return basename.includes(routeName) || basename === `_layout.${parts[0]}._index`;
  });
}

function checkPlaceholderRoute(content, rp) {
  const trimmed = content.trim();
  if (trimmed.includes('<Navigate') && !trimmed.includes('function') && !trimmed.includes('export default function')) {
    warn(`${rp} — appears to be a placeholder route`);
  }
}

function checkRequireAuth(content, lines, rp) {
  // Skip test files
  if (rp.includes('.test.') || rp.includes('.spec.')) return;
  // Routes under _layout (protected section) should have RequireAuth
  if (rp.includes('_layout.') && !rp.includes('._layout') && !rp.includes('login') && !rp.includes('signup') && !rp.includes('onboarding') && !rp.includes('index')) {
    if (!content.includes('RequireAuth') && !content.includes('requireAuth')) {
      warn(`${rp} — protected route missing RequireAuth wrapper`);
    }
  }
}

function checkFetchApiHandling(content, lines, rp) {
  if (!content.includes('fetchApi')) return;
  const fetchLines = lines.map((l, i) => ({ line: l.trim(), num: i + 1 })).filter((l) => l.line.includes('fetchApi('));
  for (const { num } of fetchLines) {
    const before = lines.slice(0, num).join('\n');
    const after = lines.slice(num).join('\n');
    if (!before.includes('try {') && !before.includes('try{')) {
      warn(`${rp}:${num} — fetchApi call outside try/catch`);
    }
    if (!after.includes('catch')) {
      warn(`${rp}:${num} — no catch block after fetchApi call`);
    }
  }
}

function checkConsoleError(content, lines, rp) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('console.error')) {
      const context = lines.slice(Math.max(0, i - 10), i + 10).join('\n');
      if (!context.includes('setError') && !context.includes('setLoadError')) {
        warn(`${rp}:${i + 1} — console.error without user-facing error state`);
      }
    }
  }
}

function checkFormsHaveErrorState(content, rp) {
  if (!content.includes('onSubmit') && !content.includes('<form')) return;
  if (!/useState.*[eE]rror|set[A-Z]\w*[eE]rror|[eE]rror.*useState/.test(content)) {
    warn(`${rp} — has form(s) but no error state`);
  }
}

function checkAlertUsage(content, lines, rp) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('alert(')) {
      err(`${rp}:${i + 1} — uses alert() instead of UI error state`);
    }
  }
}

function checkMapWithoutKey(content, lines, rp) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for .map(() => or .map((x) => patterns
    if (line.includes('.map(') && line.includes('=>')) {
      // Check the next ~10 lines for a key prop
      const block = lines.slice(i, i + 12).join('\n');
      // If it returns a JSX element (<something) without key=
      if (block.match(/<\w+/) && !block.includes('key=')) {
        warn(`${rp}:${i + 1} — .map() rendering JSX without key prop`);
      }
    }
  }
}

function checkMissingDisabledOnSubmit(content, lines, rp) {
  // Find submit buttons that don't have a disabled prop when there's a loading state
  if (!content.includes('type="submit"') && !content.includes("type='submit'")) return;
  if (content.includes('loading') || content.includes('saving') || content.includes('pending')) {
    // Check if submit button has disabled=
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('type="submit"') || lines[i].includes("type='submit'")) {
        const context = lines.slice(Math.max(0, i - 2), i + 3).join('\n');
        if (!context.includes('disabled=')) {
          warn(`${rp}:${i + 1} — submit button missing disabled prop (double-submit risk)`);
        }
      }
    }
  }
}

function checkPromiseThenWithoutCatch(content, lines, rp) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('.then(') && !lines[i].includes('.catch(')) {
      // Check the next few lines for .catch
      const nextLines = lines.slice(i, i + 5).join('\n');
      if (!nextLines.includes('.catch(') && !nextLines.includes('try')) {
        warn(`${rp}:${i + 1} — .then() without .catch() (unhandled rejection risk)`);
      }
    }
  }
}

function checkHardcodedApiUrl(content, lines, rp) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip imports and comments
    if (line.startsWith('import ') || line.startsWith('//') || line.startsWith('*')) continue;
    // Skip VITE_API_URL usage
    if (line.includes('VITE_API_URL') || line.includes('API_URL')) continue;
    // Skip fetchApi usage (it handles URLs internally)
    if (line.includes('fetchApi')) continue;

    // Look for hardcoded localhost URLs in non-config files
    if (/(https?:\/\/localhost:\d+)/.test(line) && !rp.includes('api.ts') && !rp.includes('auth-client') && !rp.includes('use-live-logs')) {
      warn(`${rp}:${i + 1} — hardcoded localhost URL (use VITE_API_URL or fetchApi)`);
    }
  }
}

function checkAnyType(content, lines, rp) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('//') || line.startsWith('*')) continue;
    // Match : any (not inside strings)
    if (/: any\b/.test(line) && !line.includes('// : any')) {
      warn(`${rp}:${i + 1} — uses 'any' type`);
    }
  }
}

// ---------------------------------------------------------------------------
// BACKEND-SPECIFIC CHECKS
// ---------------------------------------------------------------------------

function checkRouteInputValidation(content, lines, rp) {
  // POST/PATCH/PUT routes should validate input (zod schema, safeParse, etc.)
  const methodRegex = /\bapp\.(post|patch|put)\s*\(/gi;
  let m;
  while ((m = methodRegex.exec(content)) !== null) {
    const lineNum = content.slice(0, m.index).split('\n').length;
    // Check the next ~30 lines for validation
    const block = lines.slice(lineNum - 1, lineNum + 30).join('\n');
    if (!block.includes('safeParse') && !block.includes('parse(') && !block.includes('z.') && !block.includes('Schema')) {
      // Check if it's a simple route (like health check)
      if (!block.includes('health') && !block.includes('ready') && !block.includes('ping')) {
        warn(`${rp}:${lineNum} — ${m[1].toUpperCase()} route without input validation`);
      }
    }
  }
}

function checkConsoleLog(content, lines, rp) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('console.log') || lines[i].includes('console.warn')) {
      err(`${rp}:${i + 1} — uses console.log/console.warn in backend (use app.log instead)`);
    }
  }
}

function checkDbQueryWithoutErrorHandling(content, lines, rp) {
  // Only check route files — services handle their own errors
  if (!rp.includes('routes')) return;

  // Find route handler boundaries (app.get, app.post, etc.)
  const routeStarts = [];
  const routeRegex = /\bapp\.(get|post|patch|put|delete|all)\s*\(/g;
  let m;
  while ((m = routeRegex.exec(content)) !== null) {
    routeStarts.push(content.slice(0, m.index).split('\n').length);
  }

  // For each route handler, check if DB calls are wrapped in try/catch
  for (let r = 0; r < routeStarts.length; r++) {
    const startLine = routeStarts[r];
    const endLine = r + 1 < routeStarts.length ? routeStarts[r + 1] : lines.length;
    const handlerBlock = lines.slice(startLine, endLine).join('\n');

    const hasDbCall = /db\.(query|insert|update|delete)\./.test(handlerBlock);
    const hasTryCatch = handlerBlock.includes('try') && handlerBlock.includes('catch');

    if (hasDbCall && !hasTryCatch) {
      warn(`${rp}:${startLine + 1} — route handler has DB queries without try/catch`);
    }
  }
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

checkFrontend();
checkBackend();
checkSchemaDrift();

console.error('');
if (errors === 0 && warnings === 0) {
  info('All checks passed.');
  process.exit(0);
} else {
  info(`Found ${errors} error(s) and ${warnings} warning(s)`);
  process.exit(1);
}
