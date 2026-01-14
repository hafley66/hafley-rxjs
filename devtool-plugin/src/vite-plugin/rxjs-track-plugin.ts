/**
 * Vite Plugin: Auto-inject track$ annotations for RxJS
 *
 * Uses oxc-parser for fast AST parsing, magic-string for code injection.
 * Transforms RxJS code to include file/line/variable tracking metadata.
 *
 * Before:
 *   const data$ = of(1, 2, 3);
 *   const result$ = source$.pipe(map(x => x * 2));
 *
 * After:
 *   import { __track$ } from 'rxjs-debugger/track';
 *   const data$ = __track$(of(1, 2, 3), { n: 'data$', f: 'src/app.ts', l: 5 });
 *   const result$ = __track$(source$.pipe(map(x => x * 2)), { n: 'result$', f: 'src/app.ts', l: 6 });
 */

import MagicString from 'magic-string';

// Vite Plugin type (inline to avoid vite dependency)
interface Plugin {
  name: string;
  enforce?: 'pre' | 'post';
  buildStart?: () => void | Promise<void>;
  transform?: (code: string, id: string) => { code: string; map: any } | null | Promise<{ code: string; map: any } | null>;
}

// oxc-parser types
interface OxcParseResult {
  program: any;
  errors: any[];
}

interface RxjsTrackPluginOptions {
  /** File patterns to include (default: /\.[tj]sx?$/) */
  include?: RegExp;
  /** File patterns to exclude (default: /node_modules/) */
  exclude?: RegExp;
  /** Track import source (default: 'rxjs-debugger/track') */
  trackImport?: string;
  /** Require autotrackRxjs() opt-in marker in file (default: true) */
  requireOptIn?: boolean;
}

// RxJS creation functions to track
const RXJS_CREATORS = new Set([
  'of', 'from', 'interval', 'timer', 'defer', 'range',
  'fromEvent', 'fromEventPattern', 'ajax', 'fromFetch',
  'combineLatest', 'merge', 'forkJoin', 'zip', 'race', 'concat',
  'Subject', 'BehaviorSubject', 'ReplaySubject', 'AsyncSubject',
]);

// RxJS imports to detect
const RXJS_IMPORTS = ['rxjs', 'rxjs/operators'];

export function rxjsTrackPlugin(options: RxjsTrackPluginOptions = {}): Plugin {
  const {
    include = /\.[tj]sx?$/,
    exclude = /node_modules/,
    trackImport = 'rxjs-debugger/track',
    requireOptIn = true,
  } = options;

  let parseSync: ((filename: string, code: string, options?: any) => OxcParseResult) | null = null;

  return {
    name: 'rxjs-track',
    enforce: 'pre',

    async buildStart() {
      // Dynamically import oxc-parser
      try {
        const oxc = await import('oxc-parser');
        parseSync = oxc.parseSync;
      } catch {
        console.warn('[rxjs-track] oxc-parser not installed, falling back to regex-based detection');
      }
    },

    async transform(code: string, id: string) {
      // Skip excluded files
      if (!include.test(id) || exclude.test(id)) {
        return null;
      }

      // Only transform files that have opted in via autotrackRxjs()
      if (requireOptIn && !code.includes('autotrackRxjs')) {
        return null;
      }

      // Quick check: does this file even import rxjs?
      if (!RXJS_IMPORTS.some(imp => code.includes(imp))) {
        return null;
      }

      const s = new MagicString(code);
      const relativePath = id.replace(process.cwd(), '').replace(/^\//, '');
      let hasTransforms = false;
      let needsTrackImport = false;

      if (parseSync) {
        // Use oxc-parser for accurate AST-based detection
        try {
          const result = parseSync(id, code, {
            sourceType: 'module',
          });

          if (result.errors.length === 0) {
            // Walk AST to find variable declarations with RxJS calls
            walkAst(result.program, (node, _ancestors) => {
              // Look for: const foo$ = <rxjs call>
              if (node.type === 'VariableDeclarator' && node.id?.name && node.init) {
                const varName = node.id.name;
                const init = node.init;

                // Check if it's a call to an RxJS creator or new Subject
                if (isRxjsCreatorCall(init) || isSubjectConstruction(init)) {
                  // Get line number from span
                  const line = getLineNumber(code, init.start);

                  // Wrap the initializer
                  const meta = `{n:'${varName}',f:'${relativePath}',l:${line}}`;
                  s.prependLeft(init.start, '__track$(');
                  s.appendRight(init.end, `,${meta})`);
                  hasTransforms = true;
                  needsTrackImport = true;
                }

                // Check if it's a .pipe() call
                if (init.type === 'CallExpression' && isPipeCall(init)) {
                  const line = getLineNumber(code, init.start);
                  const meta = `{n:'${varName}',f:'${relativePath}',l:${line}}`;
                  s.prependLeft(init.start, '__track$(');
                  s.appendRight(init.end, `,${meta})`);
                  hasTransforms = true;
                  needsTrackImport = true;
                }
              }
            });
          }
        } catch (e) {
          // Fall through to regex-based detection
        }
      }

      // Fallback: regex-based detection (less accurate but works without oxc)
      if (!hasTransforms) {
        const patterns = [
          // const foo$ = of(...) | from(...) | interval(...) etc.
          // Also handles generics like of<T>(...)
          /const\s+(\w+\$?)\s*=\s*(of|from|interval|timer|defer|range|combineLatest|merge|forkJoin|zip|race|concat)\s*(?:<[^>]*>)?\s*\(/g,
          // const foo$ = new Subject() | new BehaviorSubject<T>() etc.
          // Handles TypeScript generics like new BehaviorSubject<User | null>(...)
          /const\s+(\w+\$?)\s*=\s*new\s+(Subject|BehaviorSubject|ReplaySubject|AsyncSubject)\s*(?:<[^>]*>)?\s*\(/g,
          // const foo$ = source$.pipe(...)
          /const\s+(\w+\$?)\s*=\s*(\w+)\$?\.pipe\s*\(/g,
        ];

        for (const pattern of patterns) {
          let match;
          while ((match = pattern.exec(code)) !== null) {
            const varName = match[1];
            const line = getLineNumber(code, match.index);

            // Find the end of this statement (look for ; or newline with no continuation)
            const stmtStart = match.index;
            const stmtEnd = findStatementEnd(code, match.index + match[0].length);

            if (stmtEnd > stmtStart) {
              // Find the = position
              const eqPos = code.indexOf('=', stmtStart);
              if (eqPos > 0) {
                const exprStart = eqPos + 1;
                const meta = `{n:'${varName}',f:'${relativePath}',l:${line}}`;

                // Skip whitespace after =
                let actualStart = exprStart;
                while (actualStart < code.length && /\s/.test(code[actualStart]!)) {
                  actualStart++;
                }

                s.prependLeft(actualStart, '__track$(');
                s.appendRight(stmtEnd, `,${meta})`);
                hasTransforms = true;
                needsTrackImport = true;
              }
            }
          }
        }
      }

      if (!hasTransforms) {
        return null;
      }

      // Add import for __track$ at the top (only if not already present)
      if (needsTrackImport && !code.includes('__track$')) {
        s.prepend(`import { __track$ } from '${trackImport}';\n`);
      }

      return {
        code: s.toString(),
        map: s.generateMap({ hires: 'boundary', source: id }),
      };
    },
  };
}

// Helper: get line number from character position
function getLineNumber(code: string, pos: number): number {
  let line = 1;
  for (let i = 0; i < pos && i < code.length; i++) {
    if (code[i] === '\n') line++;
  }
  return line;
}

// Helper: find end of statement (simplified)
function findStatementEnd(code: string, start: number): number {
  let depth = 0;
  let i = start;

  while (i < code.length) {
    const ch = code[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (depth === 0 && (ch === ';' || ch === '\n')) {
      return i;
    }
    i++;
  }
  return i;
}

// Helper: check if AST node is RxJS creator call
function isRxjsCreatorCall(node: any): boolean {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee.type === 'Identifier') {
    return RXJS_CREATORS.has(callee.name);
  }
  return false;
}

// Helper: check if AST node is new Subject/BehaviorSubject etc.
function isSubjectConstruction(node: any): boolean {
  if (node.type !== 'NewExpression') return false;
  const callee = node.callee;
  if (callee.type === 'Identifier') {
    return ['Subject', 'BehaviorSubject', 'ReplaySubject', 'AsyncSubject'].includes(callee.name);
  }
  return false;
}

// Helper: check if AST node is a .pipe() call
function isPipeCall(node: any): boolean {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee.type === 'MemberExpression' && callee.property?.name === 'pipe') {
    return true;
  }
  return false;
}

// Helper: walk AST (simplified)
function walkAst(node: any, visitor: (node: any, ancestors: any[]) => void, ancestors: any[] = []) {
  if (!node || typeof node !== 'object') return;

  visitor(node, ancestors);

  const newAncestors = [...ancestors, node];

  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        walkAst(item, visitor, newAncestors);
      }
    } else if (child && typeof child === 'object' && child.type) {
      walkAst(child, visitor, newAncestors);
    }
  }
}

export default rxjsTrackPlugin;
