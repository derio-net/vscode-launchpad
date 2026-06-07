/**
 * Docs-reference integrity: every file the docs point at must exist.
 *
 * Guards against:
 *  - markdown links to files that were renamed or never existed
 *  - workflow files referencing docs with the wrong case (macOS hides
 *    this: APFS is case-insensitive, so fs.existsSync() would lie —
 *    we compare path segments against real directory listings)
 *  - backticked top-level *.md mentions of files that don't exist
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const MARKDOWN_FILES = [
  'README.md',
  'BUILD.md',
  'RELEASE_CHECKLIST.md',
  'CONTRIBUTING.md'
];

// Backticked .md mentions that are intentionally NOT repo-root files.
// If you backtick a filename in the docs that isn't a repo-root path
// (an artifact name, an aspirational file, a subdir file written without
// its path), add it here with a comment — otherwise this suite fails.
const BACKTICK_REF_EXCEPTIONS = new Set([
  'tasks.md' // OpenSpec change artifact: openspec/changes/<change>/tasks.md
]);

function existsCaseSensitive(relPath) {
  const segments = relPath.split('/').filter((s) => s && s !== '.');
  let dir = ROOT;
  for (const segment of segments) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return false;
    }
    if (!fs.readdirSync(dir).includes(segment)) {
      return false;
    }
    dir = path.join(dir, segment);
  }
  return true;
}

function extractRelativeLinks(markdown) {
  const re = /!?\[[^\]]*\]\(([^)\s]+)\)/g;
  const targets = [];
  let match;
  while ((match = re.exec(markdown)) !== null) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/i.test(target)) continue;
    const withoutAnchor = target.split('#')[0];
    if (withoutAnchor) targets.push(withoutAnchor);
  }
  return targets;
}

function extractBacktickedMdRefs(markdown) {
  const re = /`([A-Za-z0-9._/-]+\.md)`/g;
  const refs = [];
  let match;
  while ((match = re.exec(markdown)) !== null) {
    if (!BACKTICK_REF_EXCEPTIONS.has(match[1])) refs.push(match[1]);
  }
  return refs;
}

describe('docs-reference integrity', () => {
  describe.each(MARKDOWN_FILES)('%s', (file) => {
    const markdown = fs.readFileSync(path.join(ROOT, file), 'utf8');

    test('relative markdown links resolve (case-sensitive)', () => {
      const missing = extractRelativeLinks(markdown).filter(
        (target) => !existsCaseSensitive(target)
      );
      expect(missing).toEqual([]);
    });

    test('backticked *.md mentions exist at repo root (case-sensitive)', () => {
      const missing = extractBacktickedMdRefs(markdown).filter(
        (ref) => !existsCaseSensitive(ref)
      );
      expect(missing).toEqual([]);
    });
  });

  test('workflow files reference existing docs/*.md (case-sensitive)', () => {
    const workflowsDir = path.join(ROOT, '.github', 'workflows');
    const missing = [];
    for (const file of fs.readdirSync(workflowsDir)) {
      const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
      const re = /docs\/[A-Za-z0-9._-]+\.md/g;
      let match;
      while ((match = re.exec(content)) !== null) {
        if (!existsCaseSensitive(match[0])) {
          missing.push(`${file}: ${match[0]}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
