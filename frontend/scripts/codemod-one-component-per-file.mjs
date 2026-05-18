#!/usr/bin/env node
// Codemod: enforce one React component per .tsx file.
//
// Finds every src/**/*.{ts,tsx} (excluding components/ui/**, tests, stories)
// that defines more than one top-level component. For each violator, picks
// a "primary" component (the exported one matching the filename) and extracts
// the rest into sibling files. Non-component helpers used by exactly one
// extracted component move with it; helpers shared with the primary or
// multiple extracts stay in the original (exported as needed).
//
// Usage:
//   node scripts/codemod-one-component-per-file.mjs              # dry-run
//   node scripts/codemod-one-component-per-file.mjs --apply      # write files
//   node scripts/codemod-one-component-per-file.mjs --only <glob> [--apply]

import { Project, SyntaxKind } from 'ts-morph';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------- CLI ----------
function parseArgs(argv) {
  const args = { apply: false, only: null, verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--dry-run') args.apply = false;
    else if (a === '--only') args.only = argv[++i];
    else if (a === '--verbose' || a === '-v') args.verbose = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: codemod-one-component-per-file.mjs [--apply] [--only <glob>] [--verbose]`);
      process.exit(0);
    }
  }
  return args;
}

// ---------- AST helpers ----------
function isPascalCase(name) {
  return /^[A-Z][A-Za-z0-9_]*$/.test(name);
}

function looksLikeComponentBody(node) {
  // A PascalCase top-level function/arrow is a React component if it either
  // returns JSX or calls a hook (use*). The hook-call case catches effect-only
  // components that return `null` (e.g. <GlobalVoiceSideEffects/>).
  let found = false;
  node.forEachDescendant((d) => {
    if (found) return;
    const k = d.getKind();
    if (
      k === SyntaxKind.JsxElement ||
      k === SyntaxKind.JsxFragment ||
      k === SyntaxKind.JsxSelfClosingElement
    ) {
      found = true;
      return;
    }
    if (k === SyntaxKind.CallExpression) {
      const callee = d.getExpression();
      const ck = callee.getKind();
      if (ck === SyntaxKind.Identifier) {
        if (/^use[A-Z]/.test(callee.getText())) found = true;
      } else if (ck === SyntaxKind.PropertyAccessExpression) {
        const prop = callee.getNameNode().getText();
        if (/^use[A-Z]/.test(prop)) found = true;
      }
    }
  });
  return found;
}

function unwrapComponentBody(initializer) {
  // Returns the function/arrow node that holds the JSX body, given the
  // initializer of `const X = <something>`. Handles bare arrow/function
  // expressions and one-level wrappers like memo/forwardRef/React.memo.
  if (!initializer) return null;
  const k = initializer.getKind();
  if (k === SyntaxKind.ArrowFunction || k === SyntaxKind.FunctionExpression) return initializer;
  if (k === SyntaxKind.CallExpression) {
    const args = initializer.getArguments();
    if (args.length > 0) {
      const first = args[0];
      const fk = first.getKind();
      if (fk === SyntaxKind.ArrowFunction || fk === SyntaxKind.FunctionExpression) return first;
    }
  }
  return null;
}

function findTopLevelComponents(sourceFile) {
  // Walk statements in source order so component lists, helper lists, and
  // moved-helper render order all match the original file's ordering.
  const out = [];
  for (const stmt of sourceFile.getStatements()) {
    const k = stmt.getKind();
    if (k === SyntaxKind.FunctionDeclaration) {
      const name = stmt.getName();
      if (!name || !isPascalCase(name)) continue;
      if (!looksLikeComponentBody(stmt)) continue;
      out.push({ name, kind: 'function', stmt, body: stmt });
    } else if (k === SyntaxKind.VariableStatement) {
      const decls = stmt.getDeclarations();
      if (decls.length !== 1) continue;
      const decl = decls[0];
      const name = decl.getName();
      if (!isPascalCase(name)) continue;
      const body = unwrapComponentBody(decl.getInitializer());
      if (!body || !looksLikeComponentBody(body)) continue;
      out.push({ name, kind: 'variable', stmt, body, decl });
    }
  }
  return out;
}

function findTopLevelHelpers(sourceFile, componentNames) {
  // Anything top-level that isn't a component — useful for moving with extracts.
  const out = [];
  for (const stmt of sourceFile.getStatements()) {
    const k = stmt.getKind();
    if (k === SyntaxKind.FunctionDeclaration) {
      const name = stmt.getName();
      if (!name || componentNames.has(name)) continue;
      out.push({ name, kind: 'function', stmt, body: stmt });
    } else if (k === SyntaxKind.VariableStatement) {
      const decls = stmt.getDeclarations();
      if (decls.length !== 1) continue;
      const decl = decls[0];
      const name = decl.getName();
      if (componentNames.has(name)) continue;
      out.push({ name, kind: 'variable', stmt, body: stmt, decl });
    } else if (k === SyntaxKind.InterfaceDeclaration) {
      out.push({ name: stmt.getName(), kind: 'interface', stmt, body: stmt });
    } else if (k === SyntaxKind.TypeAliasDeclaration) {
      out.push({ name: stmt.getName(), kind: 'typeAlias', stmt, body: stmt });
    } else if (k === SyntaxKind.EnumDeclaration) {
      out.push({ name: stmt.getName(), kind: 'enum', stmt, body: stmt });
    }
  }
  return out;
}

function collectModuleScopeNames(sourceFile) {
  const names = new Map(); // name -> { kind: 'import' | 'local', node? }
  for (const imp of sourceFile.getImportDeclarations()) {
    const d = imp.getDefaultImport();
    if (d) names.set(d.getText(), { kind: 'import', importDecl: imp, importKind: 'default' });
    const ns = imp.getNamespaceImport();
    if (ns) names.set(ns.getText(), { kind: 'import', importDecl: imp, importKind: 'namespace' });
    for (const named of imp.getNamedImports()) {
      const alias = named.getAliasNode()?.getText();
      const orig = named.getNameNode().getText();
      names.set(alias ?? orig, {
        kind: 'import',
        importDecl: imp,
        importKind: 'named',
        originalName: orig,
        alias,
      });
    }
  }
  for (const fn of sourceFile.getFunctions()) {
    const n = fn.getName();
    if (n) names.set(n, { kind: 'local' });
  }
  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) names.set(decl.getName(), { kind: 'local' });
  }
  for (const cls of sourceFile.getClasses()) {
    const n = cls.getName();
    if (n) names.set(n, { kind: 'local' });
  }
  for (const iface of sourceFile.getInterfaces()) names.set(iface.getName(), { kind: 'local' });
  for (const ta of sourceFile.getTypeAliases()) names.set(ta.getName(), { kind: 'local' });
  for (const en of sourceFile.getEnums()) names.set(en.getName(), { kind: 'local' });
  return names;
}

function collectReferencedNames(node, moduleScopeNames) {
  const refs = new Set();
  node.forEachDescendant((d) => {
    if (d.getKind() !== SyntaxKind.Identifier) return;
    const parent = d.getParent();
    if (!parent) return;
    const pk = parent.getKind();
    // Property access: only the leftmost expression identifier matters.
    if (pk === SyntaxKind.PropertyAccessExpression) {
      if (parent.getNameNode() === d) return;
    }
    // Qualified name (e.g. ns.Foo in types): skip the right side.
    if (pk === SyntaxKind.QualifiedName) {
      if (parent.getRight() === d) return;
    }
    // Object property keys (shorthand keeps both sides as same identifier).
    if (pk === SyntaxKind.PropertyAssignment) {
      if (parent.getNameNode() === d) return;
    }
    // JSX attribute names are not value references.
    if (pk === SyntaxKind.JsxAttribute) return;
    // Import / export specifiers are declarations, not references.
    if (
      pk === SyntaxKind.ImportSpecifier ||
      pk === SyntaxKind.ExportSpecifier ||
      pk === SyntaxKind.ImportClause ||
      pk === SyntaxKind.NamespaceImport
    )
      return;
    // The declaration name itself (e.g. `function Foo`).
    if (
      pk === SyntaxKind.FunctionDeclaration ||
      pk === SyntaxKind.VariableDeclaration ||
      pk === SyntaxKind.Parameter ||
      pk === SyntaxKind.BindingElement ||
      pk === SyntaxKind.InterfaceDeclaration ||
      pk === SyntaxKind.TypeAliasDeclaration ||
      pk === SyntaxKind.ClassDeclaration ||
      pk === SyntaxKind.EnumDeclaration
    ) {
      const named = parent.getNameNode?.();
      if (named === d) return;
    }
    const name = d.getText();
    if (moduleScopeNames.has(name)) refs.add(name);
  });
  return refs;
}

function isExported(stmt, kind) {
  if (kind === 'function' || kind === 'interface' || kind === 'typeAlias' || kind === 'enum') {
    return stmt.hasExportKeyword?.() ?? false;
  }
  if (kind === 'variable') {
    return stmt.hasExportKeyword?.() ?? false;
  }
  return false;
}

function hasDefaultExport(stmt) {
  return stmt.hasDefaultKeyword?.() ?? false;
}

function fileStem(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

function selectPrimary(sourceFile, components) {
  if (components.length === 0) return { primary: null, error: null };
  const exported = components.filter((c) => isExported(c.stmt, c.kind));
  if (exported.length === 0) {
    // Pick first — usually a single internal component, but if we got here
    // there are 2+ and none exported. Caller treats this as ambiguous.
    return { primary: null, error: 'no exported component' };
  }
  if (exported.length === 1) return { primary: exported[0], error: null };
  const stem = fileStem(sourceFile.getFilePath());
  const match = exported.find((c) => c.name === stem);
  if (match) return { primary: match, error: null };
  return { primary: null, error: `ambiguous primary (exported: ${exported.map((c) => c.name).join(', ')})` };
}

// ---------- Planning ----------
function buildPlanForFile(sourceFile) {
  const components = findTopLevelComponents(sourceFile);
  if (components.length <= 1) return null;

  const { primary, error } = selectPrimary(sourceFile, components);
  if (!primary) return { error, file: sourceFile.getFilePath(), components: components.map((c) => c.name) };

  const moduleNames = collectModuleScopeNames(sourceFile);
  const componentNames = new Set(components.map((c) => c.name));
  const helpers = findTopLevelHelpers(sourceFile, componentNames);
  const helperNames = new Set(helpers.map((h) => h.name));

  // Bail on top-level name collisions. TS allows the same name to live in
  // both the type and the value namespace (e.g. `interface Foo` next to
  // `function Foo`), but this codemod indexes references by name — two decls
  // collapse into one slot and the second silently overwrites the first.
  // Skipping these is safer than producing broken extracts.
  const seenNames = new Set();
  const collisions = new Set();
  for (const c of components) {
    if (seenNames.has(c.name)) collisions.add(c.name);
    seenNames.add(c.name);
  }
  for (const h of helpers) {
    if (seenNames.has(h.name)) collisions.add(h.name);
    seenNames.add(h.name);
  }
  if (collisions.size > 0) {
    return {
      error: `top-level name collision: ${[...collisions].join(', ')} (rename the duplicates first)`,
      file: sourceFile.getFilePath(),
      components: components.map((c) => c.name),
    };
  }

  const extras = components.filter((c) => c !== primary);

  // Reference set per top-level decl (component or helper) — names from module scope.
  const refsOf = new Map();
  for (const c of components) refsOf.set(c.name, collectReferencedNames(c.body, moduleNames));
  for (const h of helpers) refsOf.set(h.name, collectReferencedNames(h.body, moduleNames));

  // Decide which helpers move with which extract.
  //
  // For each helper, compute the set of *components* that transitively depend
  // on it (walking through other helpers). If that set is exactly one extract,
  // the helper can move with that extract. Otherwise it stays in origin.
  //
  // This handles the chain case: `Suggestion` (interface) → `SUGGESTIONS`
  // (const) → `SuggestionRail` (component). Both helpers move with the rail
  // because their only transitive component consumer is the rail.
  function transitiveComponentConsumers(seed) {
    const seen = new Set();
    const stack = [seed];
    const result = new Set();
    while (stack.length > 0) {
      const cur = stack.pop();
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const c of components) {
        if (refsOf.get(c.name).has(cur)) result.add(c.name);
      }
      for (const other of helpers) {
        if (other.name === cur) continue;
        if (refsOf.get(other.name).has(cur)) stack.push(other.name);
      }
    }
    return result;
  }

  const helperHome = new Map(); // helperName -> extract.name | 'origin'
  for (const h of helpers) {
    const consumers = transitiveComponentConsumers(h.name);
    if (consumers.size === 1) {
      const sole = [...consumers][0];
      if (extras.some((e) => e.name === sole)) {
        helperHome.set(h.name, sole);
        continue;
      }
    }
    helperHome.set(h.name, 'origin');
  }

  // Build per-extract plan.
  const extractPlans = extras.map((ex) => {
    const movedHelpers = helpers.filter((h) => helperHome.get(h.name) === ex.name);
    return {
      name: ex.name,
      component: ex,
      movedHelpers,
      isExported: isExported(ex.stmt, ex.kind),
      hasDefault: hasDefaultExport(ex.stmt),
    };
  });

  // Helpers staying in origin that need export keyword (consumed by any extract or moved helper).
  const consumersOfOriginHelpers = new Map();
  for (const h of helpers) {
    if (helperHome.get(h.name) !== 'origin') continue;
    const consumers = new Set();
    for (const ex of extras) {
      if (refsOf.get(ex.name).has(h.name)) consumers.add(ex.name);
    }
    for (const other of helpers) {
      if (other.name === h.name) continue;
      if (helperHome.get(other.name) === 'origin') continue;
      if (refsOf.get(other.name).has(h.name)) consumers.add(other.name);
    }
    consumersOfOriginHelpers.set(h.name, consumers);
  }
  const helpersToExport = [...consumersOfOriginHelpers.entries()]
    .filter(([, consumers]) => consumers.size > 0)
    .map(([name]) => name);

  return {
    file: sourceFile.getFilePath(),
    primary: primary.name,
    extras: extractPlans,
    helpers,
    helperHome,
    helpersToExport,
    moduleNames,
    refsOf,
    componentNames,
    helperNames,
  };
}

// ---------- Code generation ----------
function getDeclWithJsDocRange(stmt) {
  const jsDocs = stmt.getJsDocs?.() ?? [];
  const start = jsDocs.length > 0 ? jsDocs[0].getStart() : stmt.getStart();
  return { start, end: stmt.getEnd() };
}

function getDeclWithJsDocText(stmt, sourceFile) {
  const { start, end } = getDeclWithJsDocRange(stmt);
  return sourceFile.getFullText().substring(start, end);
}

function ensureExportPrefix(declText) {
  // Add `export` if not already present (idempotent for `export function`,
  // `export const`, `export interface`, etc.).
  const m = declText.match(/^(\s*\/\*\*[\s\S]*?\*\/\s*)?/);
  const lead = m ? m[0] : '';
  const rest = declText.slice(lead.length);
  if (/^export(\s+default)?\s/.test(rest)) return declText;
  if (/^(function|const|let|var|interface|type|enum|class)\s/.test(rest)) {
    return lead + 'export ' + rest;
  }
  return declText;
}

function buildImportLine(importDecl, neededLocalNames) {
  // Re-emit a subset of an existing import using only the names we need.
  const moduleSpec = importDecl.getModuleSpecifierValue();
  const isTypeOnly = importDecl.isTypeOnly();
  const parts = [];
  // Default
  const def = importDecl.getDefaultImport();
  if (def && neededLocalNames.has(def.getText())) {
    parts.push({ kind: 'default', text: def.getText() });
  }
  // Namespace
  const ns = importDecl.getNamespaceImport();
  if (ns && neededLocalNames.has(ns.getText())) {
    parts.push({ kind: 'namespace', text: ns.getText() });
  }
  // Named
  const namedNeeded = [];
  for (const named of importDecl.getNamedImports()) {
    const alias = named.getAliasNode()?.getText();
    const orig = named.getNameNode().getText();
    const local = alias ?? orig;
    if (!neededLocalNames.has(local)) continue;
    const namedTypeOnly = named.isTypeOnly();
    namedNeeded.push({ orig, alias, typeOnly: namedTypeOnly });
  }
  if (parts.length === 0 && namedNeeded.length === 0) return null;

  const defaultBit = parts.find((p) => p.kind === 'default')?.text;
  const namespaceBit = parts.find((p) => p.kind === 'namespace');
  const namedBit =
    namedNeeded.length > 0
      ? `{ ${namedNeeded
          .map((n) => `${n.typeOnly ? 'type ' : ''}${n.orig}${n.alias ? ' as ' + n.alias : ''}`)
          .join(', ')} }`
      : null;

  const pieces = [];
  if (defaultBit) pieces.push(defaultBit);
  if (namespaceBit) pieces.push(`* as ${namespaceBit.text}`);
  if (namedBit) pieces.push(namedBit);
  const prefix = `import ${isTypeOnly ? 'type ' : ''}`;
  return `${prefix}${pieces.join(', ')} from '${moduleSpec}';`;
}

function extractFileStem(originStem, componentName) {
  // Always prefix extracts with parent stem. Avoids collisions across the
  // whole codebase (many extracts share generic names: MainPane, Slot,
  // SectionHeader…) and makes ownership obvious from the filename.
  if (componentName.startsWith(originStem)) return componentName;
  return `${originStem}${componentName}`;
}

function renderExtractFile({ plan, extract, sourceFile, originStem }) {
  const { moduleNames, refsOf, componentNames, helperNames, helperHome } = plan;

  // Names needed inside this new file:
  //   - refs from the extracted component body
  //   - refs from each moved helper's body
  //   - minus names defined locally inside this new file (the extract + moved helpers)
  const localNames = new Set([extract.name, ...extract.movedHelpers.map((h) => h.name)]);
  const needed = new Set();
  for (const r of refsOf.get(extract.name)) needed.add(r);
  for (const h of extract.movedHelpers) {
    for (const r of refsOf.get(h.name)) needed.add(r);
  }
  for (const n of localNames) needed.delete(n);

  // Bucket needed names by source.
  const fromImports = new Map(); // importDecl -> Set<localName>
  const fromSiblings = new Set(); // names of other extracts to import
  const fromOrigin = new Set(); // names of helpers staying in origin

  for (const name of needed) {
    if (!moduleNames.has(name)) continue;
    const info = moduleNames.get(name);
    if (info.kind === 'import') {
      const set = fromImports.get(info.importDecl) ?? new Set();
      set.add(name);
      fromImports.set(info.importDecl, set);
    } else {
      // local — either a sibling extract, the primary, or a helper
      if (componentNames.has(name)) {
        // Component reference — either primary (import from origin) or another extract
        if (name === plan.primary) {
          fromOrigin.add(name);
        } else {
          fromSiblings.add(name);
        }
      } else if (helperNames.has(name)) {
        const dest = helperHome.get(name);
        if (dest === 'origin') {
          fromOrigin.add(name);
        } else if (dest === extract.name) {
          // moved into this same file — skip (localNames already covered above)
        } else {
          // Moved to a DIFFERENT extract — that's a cross-file dep. The planner
          // already downgraded such helpers to origin, so we shouldn't reach here.
          throw new Error(`Helper ${name} moved to ${dest} but referenced from ${extract.name}`);
        }
      }
    }
  }

  // Build import block.
  const importLines = [];
  for (const [decl, names] of fromImports) {
    const line = buildImportLine(decl, names);
    if (line) importLines.push(line);
  }
  if (fromSiblings.size > 0) {
    for (const sib of [...fromSiblings].sort()) {
      importLines.push(`import { ${sib} } from './${extractFileStem(originStem, sib)}';`);
    }
  }
  if (fromOrigin.size > 0) {
    const names = [...fromOrigin].sort();
    importLines.push(`import { ${names.join(', ')} } from './${originStem}';`);
  }

  // Body: moved helpers (in original order), then the component itself.
  const bodyParts = [];
  for (const h of extract.movedHelpers) {
    bodyParts.push(getDeclWithJsDocText(h.stmt, sourceFile));
  }
  let componentText = getDeclWithJsDocText(extract.component.stmt, sourceFile);
  componentText = ensureExportPrefix(componentText);
  bodyParts.push(componentText);

  return importLines.join('\n') + '\n\n' + bodyParts.join('\n\n') + '\n';
}

function rewriteOrigin(sourceFile, plan) {
  // 1. Remove extracted components + moved helpers (largest start offset first
  //    so earlier offsets stay valid).
  const removals = [];
  for (const ex of plan.extras) {
    removals.push(getDeclWithJsDocRange(ex.component.stmt));
  }
  for (const h of plan.helpers) {
    if (plan.helperHome.get(h.name) !== 'origin') {
      removals.push(getDeclWithJsDocRange(h.stmt));
    }
  }
  removals.sort((a, b) => b.start - a.start);
  for (const r of removals) {
    sourceFile.replaceText([r.start, r.end], '');
  }

  // 2. Ensure remaining helpers that need to be consumed by extracts are exported.
  for (const name of plan.helpersToExport) {
    const helper = plan.helpers.find((h) => h.name === name);
    if (!helper) continue;
    // After removal, the AST is dirty — re-resolve by name.
    addExportKeyword(sourceFile, name);
  }

  // 3. Add `import { Extract } from './Extract'` or re-export for each extract.
  const originStem = fileStem(sourceFile.getFilePath());
  const importsToAdd = [];
  for (const ex of plan.extras) {
    const stem = extractFileStem(originStem, ex.name);
    if (ex.isExported) {
      importsToAdd.push(`export { ${ex.name} } from './${stem}';`);
    } else {
      importsToAdd.push(`import { ${ex.name} } from './${stem}';`);
    }
  }
  if (importsToAdd.length > 0) {
    // Insert after the last existing import.
    const lastImport = [...sourceFile.getImportDeclarations()].pop();
    if (lastImport) {
      lastImport.replaceWithText(lastImport.getText() + '\n' + importsToAdd.join('\n'));
    } else {
      sourceFile.insertText(0, importsToAdd.join('\n') + '\n\n');
    }
  }
}

function collectUsedNamesOutsideImports(sourceFile) {
  // Walk every Identifier in the file, ignoring identifiers that live inside
  // an ImportDeclaration (those are declarations, not usages). Skip property
  // names on the right of `.`, qualified names, and PropertyAssignment keys.
  const used = new Set();
  sourceFile.forEachDescendant((d) => {
    if (d.getKind() !== SyntaxKind.Identifier) return;
    let p = d.getParent();
    while (p) {
      if (p.getKind() === SyntaxKind.ImportDeclaration) return;
      p = p.getParent();
    }
    const parent = d.getParent();
    const pk = parent?.getKind();
    if (pk === SyntaxKind.PropertyAccessExpression && parent.getNameNode() === d) return;
    if (pk === SyntaxKind.QualifiedName && parent.getRight() === d) return;
    if (pk === SyntaxKind.PropertyAssignment && parent.getNameNode() === d) return;
    used.add(d.getText());
  });
  return used;
}

function pruneUnusedImports(sourceFile) {
  // After extraction, the origin file usually drops many imports that only
  // its extracted components used. Walk the imports and drop specifiers
  // that are no longer referenced anywhere in the file body.
  const used = collectUsedNamesOutsideImports(sourceFile);
  for (const imp of [...sourceFile.getImportDeclarations()]) {
    for (const named of [...imp.getNamedImports()]) {
      const localName = named.getAliasNode()?.getText() ?? named.getNameNode().getText();
      if (!used.has(localName)) named.remove();
    }
    const def = imp.getDefaultImport();
    const ns = imp.getNamespaceImport();
    const remainingNamed = imp.getNamedImports();
    const defUsed = def ? used.has(def.getText()) : false;
    const nsUsed = ns ? used.has(ns.getText()) : false;
    const hasAnyRemaining = defUsed || nsUsed || remainingNamed.length > 0;
    if (!hasAnyRemaining) imp.remove();
  }
}

function addExportKeyword(sourceFile, name) {
  // Look up by name across the supported declaration types.
  const fn = sourceFile.getFunction(name);
  if (fn) {
    if (!fn.hasExportKeyword()) fn.setIsExported(true);
    return;
  }
  const vs = sourceFile.getVariableStatement(name);
  if (vs) {
    if (!vs.hasExportKeyword()) vs.setIsExported(true);
    return;
  }
  const iface = sourceFile.getInterface(name);
  if (iface) {
    if (!iface.hasExportKeyword()) iface.setIsExported(true);
    return;
  }
  const ta = sourceFile.getTypeAlias(name);
  if (ta) {
    if (!ta.hasExportKeyword()) ta.setIsExported(true);
    return;
  }
  const en = sourceFile.getEnum(name);
  if (en) {
    if (!en.hasExportKeyword()) en.setIsExported(true);
    return;
  }
}

// ---------- Main ----------
function main() {
  const args = parseArgs(process.argv);
  const project = new Project({
    tsConfigFilePath: path.join(ROOT, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: false,
  });

  const allFiles = project.getSourceFiles().filter((sf) => {
    const fp = sf.getFilePath();
    if (!fp.startsWith(path.join(ROOT, 'src') + path.sep)) return false;
    if (!/\.(ts|tsx)$/.test(fp)) return false;
    if (fp.includes(path.join('components', 'ui') + path.sep)) return false;
    if (/\.(test|spec|stories)\.tsx?$/.test(fp)) return false;
    if (args.only) {
      const pattern = path.isAbsolute(args.only) ? args.only : path.join(ROOT, args.only);
      if (!fp.includes(pattern.replace(/[*?]/g, ''))) return false;
    }
    return true;
  });

  const plans = [];
  const ambiguous = [];
  for (const sf of allFiles) {
    try {
      const plan = buildPlanForFile(sf);
      if (!plan) continue;
      if (plan.error) {
        ambiguous.push({ file: sf.getFilePath(), error: plan.error, components: plan.components });
        continue;
      }
      plans.push(plan);
    } catch (e) {
      console.error(`Error planning ${sf.getFilePath()}:`, e.message);
      throw e;
    }
  }

  // Report.
  console.log('');
  console.log('=== one-component-per-file codemod ===');
  console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Scanned ${allFiles.length} files`);
  console.log(`Violators: ${plans.length}`);
  console.log(`Ambiguous (manual fix needed): ${ambiguous.length}`);
  console.log('');

  if (ambiguous.length > 0) {
    console.log('AMBIGUOUS — needs manual fix (skipping):');
    for (const a of ambiguous) {
      console.log(`  ${path.relative(ROOT, a.file)} — ${a.error}`);
      console.log(`    components: ${a.components.join(', ')}`);
    }
    console.log('');
  }

  if (plans.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  for (const plan of plans) {
    const rel = path.relative(ROOT, plan.file);
    console.log(`${rel}`);
    console.log(`  primary: ${plan.primary}`);
    for (const ex of plan.extras) {
      const moved = ex.movedHelpers.length > 0 ? ` (+ helpers: ${ex.movedHelpers.map((h) => h.name).join(', ')})` : '';
      console.log(`    extract -> ${ex.name}.tsx${moved}`);
    }
    if (plan.helpersToExport.length > 0) {
      console.log(`    export from origin: ${plan.helpersToExport.join(', ')}`);
    }
  }
  console.log('');

  if (!args.apply) {
    console.log('Dry-run complete. Re-run with --apply to write changes.');
    return;
  }

  // Apply.
  const touched = new Set();
  for (const plan of plans) {
    const sf = project.getSourceFileOrThrow(plan.file);
    const dir = path.dirname(plan.file);
    const ext = path.extname(plan.file);
    const originStem = fileStem(plan.file);

    for (const ex of plan.extras) {
      const newPath = path.join(dir, `${extractFileStem(originStem, ex.name)}${ext}`);
      if (fs.existsSync(newPath)) {
        console.error(`Refusing to overwrite existing file: ${path.relative(ROOT, newPath)}`);
        process.exit(1);
      }
      const text = renderExtractFile({
        plan,
        extract: ex,
        sourceFile: sf,
        originStem,
      });
      fs.writeFileSync(newPath, text, 'utf8');
      touched.add(newPath);
      const extractSf = project.addSourceFileAtPath(newPath);
      // Defensive prune: my reference collection might over-import in edge
      // cases (e.g. a name appearing as both type and value); strip unused.
      pruneUnusedImports(extractSf);
      extractSf.saveSync();
    }

    rewriteOrigin(sf, plan);
    pruneUnusedImports(sf);
    sf.saveSync();
    touched.add(plan.file);
  }

  console.log(`Wrote ${touched.size} files. Running formatter + lint…`);
  const touchedPaths = [...touched].map((p) => path.relative(ROOT, p));

  // Prettier
  try {
    execSync(`npx prettier --write ${touchedPaths.map((p) => JSON.stringify(p)).join(' ')}`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
  } catch (e) {
    console.error('Prettier failed.', e.message);
  }
  // ESLint --fix
  try {
    execSync(`npx eslint --fix ${touchedPaths.map((p) => JSON.stringify(p)).join(' ')}`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
  } catch (e) {
    console.warn('ESLint exited non-zero (may still have warnings/errors — see output above).');
  }

  console.log('Done.');
}

main();
