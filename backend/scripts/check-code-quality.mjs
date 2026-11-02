import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const backendDirectory = resolve(scriptDirectory, '..');
const repositoryDirectory = resolve(backendDirectory, '..');
const baselinePath = join(scriptDirectory, 'code-quality-baseline.json');
const require = createRequire(join(backendDirectory, 'package.json'));
const ts = require('typescript');
const lineLimit = 500;
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const ignoredDirectories = new Set([
  'node_modules',
  'dist',
  'coverage',
  'generated',
  '.git',
]);

function physicalLineCount(text) {
  if (text.length === 0) return 0;
  return text.split(/\r\n|\n|\r/).length - (/(\r\n|\n|\r)$/.test(text) ? 1 : 0);
}

function actualCommentCount(text, fileName) {
  const scriptKind =
    fileName.endsWith('.tsx') || fileName.endsWith('.jsx')
      ? ts.ScriptKind.TSX
      : fileName.endsWith('.ts')
        ? ts.ScriptKind.TS
        : ts.ScriptKind.JS;
  const sourceFile = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const ranges = new Set();
  const collect = (items) => {
    for (const item of items ?? []) ranges.add(`${item.pos}:${item.end}`);
  };
  const visit = (node) => {
    collect(ts.getLeadingCommentRanges(text, node.pos));
    collect(ts.getTrailingCommentRanges(text, node.end));
    if (node.kind === ts.SyntaxKind.JSDocComment) return;
    for (const child of node.getChildren(sourceFile)) visit(child);
  };
  visit(sourceFile);
  return ranges.size;
}

function walk(directory) {
  const results = [];
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;
    const fullPath = join(directory, entry);
    const info = statSync(fullPath);
    if (info.isDirectory()) results.push(...walk(fullPath));
    else if (extensions.has(extname(entry))) results.push(fullPath);
  }
  return results;
}

function isMaintained(relativePath) {
  return !relativePath
    .split(/[\\/]/)
    .some((part) => ignoredDirectories.has(part));
}

function scopeFor(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/');
  const sourceOnly = normalized.startsWith('backend/src/');
  const scriptOrConfig =
    normalized.startsWith('backend/scripts/') ||
    /(^|\/)(config|configs)\//.test(normalized) ||
    (normalized.startsWith('backend/') &&
      /(^|\.)config\./.test(normalized.split('/').at(-1)));
  return {
    countLines: sourceOnly && normalized.endsWith('.ts'),
    countComments:
      (sourceOnly && /\.(ts|tsx|js|jsx|mjs)$/.test(normalized)) ||
      (scriptOrConfig && /\.(ts|tsx|js|jsx|mjs)$/.test(normalized)),
  };
}

function inspect(fileName, text) {
  const relativePath = relative(repositoryDirectory, fileName).replaceAll(
    '\\',
    '/',
  );
  const scope = scopeFor(relativePath);
  return {
    lines: scope.countLines ? physicalLineCount(text) : 0,
    comments: scope.countComments ? actualCommentCount(text, fileName) : 0,
  };
}

function trackedHeadFiles() {
  return execFileSync(
    'git',
    [
      'ls-files',
      '-z',
      'backend/src',
      'backend/tests',
      'backend/scripts',
      'backend',
    ],
    { cwd: repositoryDirectory },
  )
    .toString()
    .split('\0')
    .filter(Boolean)
    .filter(isMaintained);
}

function readHeadFile(path) {
  try {
    return execFileSync('git', ['show', `HEAD:${path}`], {
      cwd: repositoryDirectory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return undefined;
  }
}

function loadBaseline() {
  return JSON.parse(readFileSync(baselinePath, 'utf8'));
}

function buildBaseline() {
  const entries = {};
  for (const path of trackedHeadFiles()) {
    const text = readHeadFile(path);
    if (text === undefined) continue;
    const counts = inspect(join(repositoryDirectory, path), text);
    if (counts.lines >= lineLimit || counts.comments > 0)
      entries[path] = counts;
  }
  return { version: 1, lineLimit, entries };
}

function evaluate(files, baseline, strict) {
  const failures = [];
  for (const fileName of files) {
    const relativePath = relative(repositoryDirectory, fileName).replaceAll(
      '\\',
      '/',
    );
    const counts = inspect(fileName, readFileSync(fileName, 'utf8'));
    const allowed = baseline.entries[relativePath];
    if (strict) {
      if (counts.lines >= lineLimit)
        failures.push(
          `${relativePath}: ${counts.lines} physical lines; strict mode requires fewer than ${lineLimit}`,
        );
      if (counts.comments > 0)
        failures.push(
          `${relativePath}: ${counts.comments} comments; strict mode requires zero`,
        );
      continue;
    }
    if (!allowed) {
      if (counts.lines >= lineLimit)
        failures.push(
          `${relativePath}: ${counts.lines} physical lines; new files must stay below ${lineLimit}`,
        );
      if (counts.comments > 0)
        failures.push(
          `${relativePath}: ${counts.comments} comments; new files must contain zero comments`,
        );
      continue;
    }
    if (counts.lines > allowed.lines)
      failures.push(
        `${relativePath}: ${counts.lines} lines exceeds baseline ${allowed.lines}`,
      );
    if (counts.comments > allowed.comments)
      failures.push(
        `${relativePath}: ${counts.comments} comments exceeds baseline ${allowed.comments}`,
      );
  }
  for (const path of strict ? [] : Object.keys(baseline.entries)) {
    if (
      !files.some(
        (fileName) =>
          relative(repositoryDirectory, fileName).replaceAll('\\', '/') ===
          path,
      )
    )
      failures.push(
        `${path}: baseline entry no longer exists; remove it from the baseline`,
      );
  }
  return failures;
}

function selfCheck() {
  const fixture = `const url = "https://example.test/a/*b*/";\nconst text = \`// template data /* data */ \${1 + 1}\`;\nconst pattern = /https?:\\/\\/example\\.test\\/\\/\\*literal\\*/;\n// actual line\n/* actual block */\n/** actual documentation */\nconst record = { /* nested object */ };\nconst list = [/* nested array */];\nconst invoke = fn(/* argument */);\n`;
  const expected = { lines: 9, comments: 6 };
  const actual = {
    lines: physicalLineCount(fixture),
    comments: actualCommentCount(fixture, 'fixture.ts'),
  };
  if (
    actual.lines !== expected.lines ||
    actual.comments !== expected.comments
  ) {
    throw new Error(
      `Scanner self-check failed: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

const args = process.argv.slice(2);
if (args.includes('--self-check')) selfCheck();
if (args.includes('--write-baseline')) {
  process.stdout.write(`${JSON.stringify(buildBaseline(), null, 2)}\n`);
} else {
  const baseline = loadBaseline();
  const failures = evaluate(
    walk(backendDirectory),
    baseline,
    args.includes('--strict'),
  );
  if (failures.length) {
    process.stderr.write(`${failures.join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('Backend code quality baseline is satisfied.\n');
  }
}
