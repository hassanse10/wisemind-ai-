#!/usr/bin/env node
// Build guard: the MV3 service worker (background.js) runs in a DOM-less
// context. If any chunk it imports references `document` or `window` at module
// scope, the worker throws "document is not defined" and registration fails
// (status 15). This has regressed twice via rollup chunk grouping — once when
// React leaked into a worker chunk, once when Vite's module-preload polyfill
// did. This script traces background.js's recursive import closure and fails
// the build if any loaded file references a DOM global.
//
// It intentionally ignores `typeof document` / `typeof window` feature checks
// and `globalThis.` accesses, which are safe in a worker.

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const entry = resolve(distDir, 'background.js')

if (!existsSync(entry)) {
  console.error(`[check-worker-dom] ${entry} not found — run the build first.`)
  process.exit(1)
}

// Match a bare DOM global (document/window) that is NOT part of `typeof x`
// and NOT `globalThis.x`. Uses lookbehind for the safe prefixes.
const DOM_GLOBAL = /(?<!typeof\s)(?<!globalThis\.)(?<![.\w])(document|window)(?![\w])/g
// Relative imports/re-exports and bare side-effect imports.
const IMPORT_RE = /(?:from|import)\s*["'](\.[^"']*)["']/g

const seen = new Set()
const offenders = []

function walk(file) {
  if (seen.has(file) || !existsSync(file)) return
  seen.add(file)
  const src = readFileSync(file, 'utf8')

  const hits = src.match(DOM_GLOBAL)
  if (hits) offenders.push({ file: basename(file), globals: [...new Set(hits)], count: hits.length })

  for (const m of src.matchAll(IMPORT_RE)) {
    walk(resolve(dirname(file), m[1]))
  }
}

walk(entry)

const loaded = [...seen].map(f => basename(f))
console.log(`[check-worker-dom] service worker loads ${loaded.length} file(s): ${loaded.join(', ')}`)

if (offenders.length > 0) {
  console.error('\n[check-worker-dom] FAIL — DOM globals reachable from the service worker:')
  for (const o of offenders) {
    console.error(`  ${o.file}: ${o.count}× ${o.globals.join(', ')}`)
  }
  console.error(
    '\nA chunk imported by background.js references a DOM global. This will crash the\n' +
    'MV3 service worker ("document is not defined"). Likely a rollup chunk-grouping\n' +
    'change pulled DOM code into a worker-reachable chunk. Fix by isolating that code\n' +
    '(manualChunks) or removing the dependency so the worker closure stays DOM-free.'
  )
  process.exit(1)
}

console.log('[check-worker-dom] OK — no DOM globals reachable from the service worker.')
