#!/usr/bin/env node
// Audit: inventory raw <button> JSX usages and classify them.
//
// The frontend ESLint config bans raw <button> in favor of the shadcn <Button>
// primitive (`@/components/ui/button`). The CLAUDE.md exception is "bespoke
// surfaces that look nothing like a button (a participant tile, a channel
// row), where the click target is the surface itself" — those are allowed
// to stay raw.
//
// This script walks src/**/*.{tsx,jsx}, finds every JSX <button>, prints a
// table with file:line:col + a heuristic classification:
//
//   button-like   the markup looks like a styled button (small element,
//                 inline content, padding/height utility classes) — likely
//                 a real violation, migrate to <Button>
//   tile-like     the markup looks like a full surface acting as a button
//                 (flex column layout, image/avatar children, large size
//                 classes) — likely a legitimate exception, leave raw
//   ambiguous     can't tell from heuristics — human review needed
//
// Usage:
//   node scripts/audit-raw-button.mjs                # human report
//   node scripts/audit-raw-button.mjs --json         # machine-readable
//   node scripts/audit-raw-button.mjs --only <glob>  # scope to one path
//   node scripts/audit-raw-button.mjs --filter <kind> [--filter <kind>...]
//                                                    # show only kinds
//
// Exits non-zero when any button-like or ambiguous match is found, so the
// script can run in CI as a soft gate alongside ESLint.

import { Project, SyntaxKind } from 'ts-morph';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------- CLI ----------
function parseArgs(argv) {
  const args = { json: false, only: null, filters: new Set() };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--only') args.only = argv[++i];
    else if (a === '--filter') args.filters.add(argv[++i]);
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: audit-raw-button.mjs [--json] [--only <path>] [--filter <button-like|tile-like|ambiguous>]',
      );
      process.exit(0);
    }
  }
  return args;
}

// ---------- AST helpers ----------
function collectAttributeNames(opening) {
  // Returns a Set of attribute names on a JsxOpeningElement / JsxSelfClosingElement.
  // Spread attributes contribute the sentinel '__spread__'.
  const names = new Set();
  for (const attr of opening.getAttributes()) {
    if (attr.getKind() === SyntaxKind.JsxSpreadAttribute) {
      names.add('__spread__');
      continue;
    }
    const nameNode = attr.getNameNode?.();
    if (nameNode) names.add(nameNode.getText());
  }
  return names;
}

function extractClassNameLiteral(opening) {
  // Returns the concatenated string content of the className attribute when
  // it's a static string literal or string-literal expression. Returns '' for
  // dynamic className (template literals, function calls, conditionals) — we
  // can still classify on the other signals.
  for (const attr of opening.getAttributes()) {
    if (attr.getKind() !== SyntaxKind.JsxAttribute) continue;
    const name = attr.getNameNode?.()?.getText();
    if (name !== 'className') continue;
    const initializer = attr.getInitializer();
    if (!initializer) return '';
    const k = initializer.getKind();
    if (k === SyntaxKind.StringLiteral) {
      return initializer.getLiteralText();
    }
    if (k === SyntaxKind.JsxExpression) {
      const inner = initializer.getExpression();
      if (!inner) return '';
      const ik = inner.getKind();
      if (ik === SyntaxKind.StringLiteral || ik === SyntaxKind.NoSubstitutionTemplateLiteral) {
        return inner.getLiteralText();
      }
      // For cn('class-a', 'class-b') / clsx(...) we can pull string-literal
      // arguments as a best-effort signal.
      if (ik === SyntaxKind.CallExpression) {
        const parts = [];
        for (const arg of inner.getArguments()) {
          const ak = arg.getKind();
          if (ak === SyntaxKind.StringLiteral || ak === SyntaxKind.NoSubstitutionTemplateLiteral) {
            parts.push(arg.getLiteralText());
          }
        }
        return parts.join(' ');
      }
    }
    return '';
  }
  return '';
}

function countChildren(jsxElement) {
  // jsxElement may be a JsxElement (with opening/closing) or self-closing.
  if (jsxElement.getKind() === SyntaxKind.JsxSelfClosingElement) {
    return { elements: 0, text: 0 };
  }
  let elements = 0;
  let text = 0;
  for (const child of jsxElement.getJsxChildren()) {
    const k = child.getKind();
    if (k === SyntaxKind.JsxElement || k === SyntaxKind.JsxSelfClosingElement) {
      elements += 1;
    } else if (k === SyntaxKind.JsxText) {
      const t = child.getText().trim();
      if (t.length > 0) text += 1;
    } else if (k === SyntaxKind.JsxExpression) {
      // Treat dynamic expressions as element-shaped — could be a nested
      // component reference. Counts toward "tile-like" if there are many.
      elements += 1;
    }
  }
  return { elements, text };
}

// ---------- Classification ----------
// Heuristics over the className token list + child shape. None of these are
// authoritative — they bias the report so a human can skim faster.

const BUTTON_LIKE_TOKENS = [
  // Pill / link styling typical of small action buttons.
  'rounded-md',
  'rounded-lg',
  'rounded-full',
  'hover:underline',
  'underline',
  'text-blurple',
  'text-primary',
  'btn',
  'inline-flex',
  // Small explicit heights (shadcn Button uses h-10 / h-9 / h-11).
  'h-7',
  'h-8',
  'h-9',
  'h-10',
];

const TILE_LIKE_TOKENS = [
  // Multi-line content / card-like shapes.
  'flex-col',
  'flex-1',
  'aspect-square',
  'aspect-video',
  'grid',
  // Big surfaces.
  'min-h-',
  'h-full',
  'w-full',
  'p-4',
  'p-5',
  'p-6',
  'gap-4',
  'rounded-2xl',
  'rounded-3xl',
  // Row-shape primitives.
  'group/row',
  'border-b',
];

function classify({ className, children, attrs, openingText }) {
  const tokens = className.split(/\s+/).filter(Boolean);
  const tokenSet = new Set(tokens);

  let buttonScore = 0;
  let tileScore = 0;

  for (const t of BUTTON_LIKE_TOKENS) {
    if (tokenSet.has(t)) buttonScore += 1;
    else if (t.endsWith('-') && tokens.some((x) => x.startsWith(t))) buttonScore += 1;
  }
  for (const t of TILE_LIKE_TOKENS) {
    if (tokenSet.has(t)) tileScore += 1;
    else if (t.endsWith('-') && tokens.some((x) => x.startsWith(t))) tileScore += 1;
  }

  // Children shape: many element children → tile; only text → button.
  if (children.elements >= 2 && children.text === 0) tileScore += 1;
  if (children.text >= 1 && children.elements === 0) buttonScore += 1;

  // aria-label only icon button → button-like.
  if (attrs.has('aria-label') && children.elements <= 1 && children.text === 0) {
    buttonScore += 1;
  }

  // Self-closing → almost certainly icon button.
  if (/\/>\s*$/.test(openingText)) buttonScore += 1;

  // Spread attributes — we can't see what they bring; mark ambiguous.
  if (attrs.has('__spread__')) {
    return { kind: 'ambiguous', reason: 'spread-attrs', buttonScore, tileScore };
  }

  if (buttonScore >= 2 && buttonScore > tileScore) {
    return { kind: 'button-like', reason: `button-score ${buttonScore} > tile-score ${tileScore}`, buttonScore, tileScore };
  }
  if (tileScore >= 2 && tileScore > buttonScore) {
    return { kind: 'tile-like', reason: `tile-score ${tileScore} > button-score ${buttonScore}`, buttonScore, tileScore };
  }
  return { kind: 'ambiguous', reason: `button-score ${buttonScore} vs tile-score ${tileScore}`, buttonScore, tileScore };
}

// ---------- Walk ----------
function findRawButtons(sourceFile) {
  const matches = [];
  sourceFile.forEachDescendant((node) => {
    const k = node.getKind();
    let opening = null;
    let owner = null;
    if (k === SyntaxKind.JsxOpeningElement) {
      opening = node;
      owner = node.getParent();
    } else if (k === SyntaxKind.JsxSelfClosingElement) {
      opening = node;
      owner = node;
    } else {
      return;
    }
    const tagName = opening.getTagNameNode().getText();
    if (tagName !== 'button') return;

    const className = extractClassNameLiteral(opening);
    const attrs = collectAttributeNames(opening);
    const children = countChildren(owner);
    const { line, column } = sourceFile.getLineAndColumnAtPos(opening.getStart());
    const verdict = classify({
      className,
      children,
      attrs,
      openingText: opening.getText(),
    });

    matches.push({
      file: sourceFile.getFilePath(),
      line,
      column,
      kind: verdict.kind,
      reason: verdict.reason,
      buttonScore: verdict.buttonScore,
      tileScore: verdict.tileScore,
      snippet: opening.getText().split('\n').slice(0, 3).join(' \\n '),
      className,
    });
  });
  return matches;
}

// ---------- Main ----------
function main() {
  const args = parseArgs(process.argv);
  const project = new Project({
    tsConfigFilePath: path.join(ROOT, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: false,
  });

  const files = project.getSourceFiles().filter((sf) => {
    const fp = sf.getFilePath();
    if (!fp.startsWith(path.join(ROOT, 'src') + path.sep)) return false;
    if (!/\.(tsx|jsx)$/.test(fp)) return false;
    if (fp.includes(path.join('components', 'ui') + path.sep)) return false;
    if (args.only) {
      const pattern = path.isAbsolute(args.only) ? args.only : path.join(ROOT, args.only);
      if (!fp.includes(pattern.replace(/[*?]/g, ''))) return false;
    }
    return true;
  });

  const all = [];
  for (const sf of files) {
    for (const m of findRawButtons(sf)) all.push(m);
  }

  const filtered = args.filters.size > 0 ? all.filter((m) => args.filters.has(m.kind)) : all;

  if (args.json) {
    console.log(
      JSON.stringify(
        filtered.map((m) => ({ ...m, file: path.relative(ROOT, m.file) })),
        null,
        2,
      ),
    );
  } else {
    const byKind = { 'button-like': 0, 'tile-like': 0, ambiguous: 0 };
    for (const m of all) byKind[m.kind] = (byKind[m.kind] ?? 0) + 1;

    console.log('');
    console.log('=== raw <button> audit ===');
    console.log(`Scanned ${files.length} files in src/ (excluding components/ui)`);
    console.log(`Total raw <button>: ${all.length}`);
    console.log(`  button-like (likely migrate to shadcn Button): ${byKind['button-like']}`);
    console.log(`  tile-like   (likely keep raw, document why):   ${byKind['tile-like']}`);
    console.log(`  ambiguous   (human review needed):             ${byKind.ambiguous}`);
    console.log('');

    const groups = new Map();
    for (const m of filtered) {
      const key = path.relative(ROOT, m.file);
      const arr = groups.get(key) ?? [];
      arr.push(m);
      groups.set(key, arr);
    }

    const sortedFiles = [...groups.keys()].sort();
    for (const file of sortedFiles) {
      const arr = groups.get(file);
      console.log(file);
      for (const m of arr.sort((a, b) => a.line - b.line)) {
        console.log(
          `  ${String(m.line).padStart(4)}:${String(m.column).padEnd(3)} [${m.kind}] ${m.snippet}`,
        );
      }
      console.log('');
    }

    if (filtered.length === 0) {
      console.log('No matches for the requested filter. Nothing to report.');
    } else {
      console.log(
        'Next: migrate `button-like` to <Button> from @/components/ui/button.',
      );
      console.log(
        '      Document `tile-like` raw <button>s in a JSDoc comment per CLAUDE.md.',
      );
      console.log(
        '      Resolve `ambiguous` by eye (open the file, check the rendered surface).',
      );
    }
  }

  // Exit non-zero when there's anything actionable so this can run in CI as
  // a soft gate. Tile-likes alone are not actionable.
  const actionable = all.filter((m) => m.kind !== 'tile-like').length;
  process.exit(actionable > 0 ? 1 : 0);
}

main();
