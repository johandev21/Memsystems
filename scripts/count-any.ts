import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

interface Match {
  file: string;
  line: number;
  content: string;
  category: 'as_any' | 'type_annotation' | 'expect_any' | 'comment_or_string';
  isTest: boolean;
  isGenerated: boolean;
}

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.turbo',
  '.next',
  '.output',
  'coverage',
]);

function walkDir(dir: string, fileList: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return fileList;
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry) || entry.startsWith('.')) continue;
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath, fileList);
      } else if (
        (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
        !entry.endsWith('.d.ts')
      ) {
        fileList.push(fullPath);
      }
    } catch {}
  }
  return fileList;
}

function analyzeFile(filePath: string, rootDir: string): Match[] {
  const relPath = relative(rootDir, filePath);
  const isTest =
    relPath.includes('/tests/') ||
    relPath.includes('.test.') ||
    relPath.includes('/test/') ||
    relPath.endsWith('test.ts');
  const isGenerated = relPath.includes('.gen.');

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const matches: Match[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for word boundary \bany\b
    if (!/\bany\b/.test(line)) continue;

    let category: Match['category'];
    const trimmed = line.trim();

    if (line.includes('expect.any(')) {
      category = 'expect_any';
    } else if (/\bas\s+any\b/.test(line)) {
      category = 'as_any';
    } else if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*')
    ) {
      category = 'comment_or_string';
    } else {
      const commentIdx = line.indexOf('//');
      const anyIdx = line.search(/\bany\b/);
      if (commentIdx !== -1 && anyIdx > commentIdx) {
        category = 'comment_or_string';
      } else if (
        /:\s*any\b/.test(line) ||
        /<.*any.*>/.test(line) ||
        /\bany\[\]/.test(line) ||
        /Promise<any>/.test(line) ||
        /TreeController<any>/.test(line)
      ) {
        category = 'type_annotation';
      } else {
        category = 'comment_or_string';
      }
    }

    matches.push({
      file: relPath,
      line: i + 1,
      content: trimmed,
      category,
      isTest,
      isGenerated,
    });
  }

  return matches;
}

const rootDir = process.cwd();
const files = [
  ...walkDir(join(rootDir, 'frontend')),
  ...walkDir(join(rootDir, 'backend')),
];

const allMatches: Match[] = [];
for (const file of files) {
  allMatches.push(...analyzeFile(file, rootDir));
}

const total = allMatches.length;
const testMatches = allMatches.filter((m) => m.isTest);
const prodMatches = allMatches.filter((m) => !m.isTest && !m.isGenerated);
const genMatches = allMatches.filter((m) => m.isGenerated);

const byCat = {
  as_any: allMatches.filter((m) => m.category === 'as_any').length,
  type_annotation: allMatches.filter((m) => m.category === 'type_annotation').length,
  expect_any: allMatches.filter((m) => m.category === 'expect_any').length,
  comment_or_string: allMatches.filter((m) => m.category === 'comment_or_string').length,
};

console.log('='.repeat(50));
console.log(' TypeScript `any` Analysis Summary');
console.log('='.repeat(50));
console.log(`Total occurrences found: ${total}`);
console.log(`- In Tests:           ${testMatches.length}`);
console.log(`- In Production:      ${prodMatches.length}`);
console.log(`- In Generated Files: ${genMatches.length}`);
console.log('\nBreakdown by Usage:');
console.log(`- Type assertions (\`as any\`):         ${byCat.as_any}`);
console.log(`- Type annotations (\`: any\`, etc.):     ${byCat.type_annotation}`);
console.log(`- Test matchers (\`expect.any(...)\`):    ${byCat.expect_any}`);
console.log(`- Natural comments / strings:          ${byCat.comment_or_string}`);

if (prodMatches.length > 0) {
  console.log('\n' + '-'.repeat(50));
  console.log(' Production occurrences (excluding comments):');
  console.log('-'.repeat(50));
  const prodCode = prodMatches.filter((m) => m.category !== 'comment_or_string');
  for (const m of prodCode) {
    console.log(`${m.file}:${m.line}  [${m.category}]`);
    console.log(`   ${m.content}`);
  }
}
