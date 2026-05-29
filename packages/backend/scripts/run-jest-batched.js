#!/usr/bin/env node
/**
 * Run Jest in batches of at most MAX_TESTS cases to avoid WSL OOM.
 * Usage: node scripts/run-jest-batched.js [unit|integration] [--dry-run]
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_TESTS = 20;
const ROOT = path.join(__dirname, '..');
const kind = process.argv[2] || 'unit';
const dryRun = process.argv.includes('--dry-run');

function listTestFiles(dir) {
  const abs = path.join(ROOT, dir);
  const out = [];
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.test.js')) out.push(p);
    }
  }
  walk(abs);
  return out.sort();
}

function countTestsInText(text) {
  const matches = text.match(/^\s*(?:it|test)\s*\(/gm);
  return matches ? matches.length : 0;
}

function splitByTopLevelDescribe(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  const chunks = [];
  let current = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = line.match(/^describe\(\s*['"`]([^'"`]+)['"`]/);
    if (m) {
      if (current) chunks.push(current);
      current = { name: m[1], lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) chunks.push(current);

  if (chunks.length <= 1) {
    return [{ file: filePath, count: countTestsInText(text) }];
  }

  return chunks.map((c) => ({
    file: filePath,
    pattern: c.name,
    count: countTestsInText(c.lines.join('\n')),
  }));
}

function expandFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const count = countTestsInText(text);
  if (count <= MAX_TESTS) return [{ file: filePath, count }];
  const parts = splitByTopLevelDescribe(filePath);
  const total = parts.reduce((s, p) => s + p.count, 0);
  if (total === 0 || parts.length <= 1) return [{ file: filePath, count }];
  return parts.filter((p) => p.count > 0);
}

function runBatch(label, items) {
  const files = [...new Set(items.map((i) => i.file))];
  const relFiles = files.map((f) => path.relative(ROOT, f)).join(' ');
  const patterns = items.filter((i) => i.pattern).map((i) => i.pattern);
  const patternArg =
    patterns.length === 1
      ? ` --testNamePattern="${patterns[0].replace(/"/g, '\\"')}"`
      : patterns.length > 1
        ? ` --testNamePattern="${patterns.map((p) => `(${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`).join('|')}"`
        : '';

  const cmd =
    `cd "${ROOT}" && NODE_NO_IOURING=1 yarn jest -i --colors --verbose --detectOpenHandles ` +
    `--config jest.config.js --forceExit${patternArg} ${relFiles}`;
  console.log(`\n========== ${label} ==========`);
  if (dryRun) {
    console.log(cmd);
    return;
  }
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=2048' } });
}

const dir = kind === 'integration' ? 'tests/integration' : 'tests/unit';
const files = listTestFiles(dir);
const workItems = files.flatMap(expandFile);

let batchNum = 0;
let current = [];
let currentCount = 0;

function flush() {
  if (!current.length) return;
  batchNum += 1;
  const n = current.reduce((s, i) => s + i.count, 0);
  runBatch(`${kind} batch ${batchNum} (${n} tests)`, current);
  current = [];
  currentCount = 0;
}

for (const item of workItems) {
  if (item.count === 0) continue;
  if (item.count > MAX_TESTS) {
    flush();
    batchNum += 1;
    runBatch(`${kind} batch ${batchNum} (oversized chunk: ${item.count} tests)`, [item]);
    continue;
  }
  if (currentCount + item.count > MAX_TESTS) flush();
  current.push(item);
  currentCount += item.count;
}
flush();

console.log(`\n✓ All ${kind} batches completed (${batchNum} batch(es))`);
