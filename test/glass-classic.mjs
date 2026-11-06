/**
 * Classic: the phone as it was drawn before the frosted glass.
 *
 * "In addition to the frosted glass look have an option in settings where
 * they can change to the classic look" (4 November 2026). Settings → Colors
 * → Style chooses Frosted glass (the default) or Classic, kept on the device,
 * seen at once, and read at launch.
 *
 * WHAT "CLASSIC" PROMISES, and how it is held. Classic is the app exactly as
 * main drew it at the commit the glass was made from (REF, below): the same
 * fills, borders, corners, shadows and elevations, and no box-shadow and no
 * sheen anywhere. lib/theme lays the old colours over the glass's, lib/glass
 * gives back the shapes, and a few pieces ask `classic()` themselves.
 *
 * The proof does not trust any of that. test/glass-classic.json is a record,
 * made from git by `node test/glass-classic.mjs --write`, of every style
 * object the glass changed in every phone file it touched: main's own source
 * for it (with the constants it reads), and where it is now. Each one is
 * evaluated twice, main's under the theme and the branch's under Classic, in
 * Dark and Light, with Sunlight's solid glass on and off, and with every free
 * name it reads (pressed, on, lit, copied…) tried false, true and as a
 * stand-in, and the two must draw the same, key for key. GlassCard and
 * GlassDisc, which replaced plain Views and drew a disc where there was
 * none, are drawn on a bench by their real source. The one exception is
 * written down and held: the two Light ink fixes, which are contrast fixes
 * and stay in both looks. And the touch reaches the glass widened (Press's
 * thumb, the gear's, a tick box row's) are not drawn, and stay too.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { parse } from '@babel/parser'
import babelTraverse from '@babel/traverse'

/* CommonJS interop: @babel/traverse's default export is on `.default` under ESM. */
const traverse = babelTraverse.default || babelTraverse

/** The commit on main the frosted glass was made from: Classic is this. */
export const REF = '52678044'
const RECORD = new URL('./glass-classic.json', import.meta.url)
const ROOT = new URL('../', import.meta.url)
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8')

/* The mechanism itself (benched and held below), not a piece that wears it. */
const MECHANISM = ['mobile/src/lib/theme.js', 'mobile/src/lib/glass.js', 'mobile/src/components/Glass.js', 'mobile/src/lib/useSolidChrome.js']
/* New with the choice, and drawn the same in both looks: the choice itself. */
const NEW_HERE = { 'mobile/src/components/Colours.js': ['StyleSection', 'StyleChoice'] }
/*
 * New since the record's commit, so there is no main to hold them to: Which
 * unit's cards (6 November 2026). Each still asks classic() for its corner,
 * and draws its shadow and its sheen only outside Classic, which the
 * coverage test below holds by reading them.
 */
const NEW_FILES = ['mobile/src/components/UnitCard.js']

/* The keys that make an object a style. Over-collecting is harmless: an object drawn the same compares the same. */
const STYLE_KEYS = new Set(
  `backgroundColor borderColor borderTopColor borderBottomColor borderLeftColor borderRightColor borderRadius
   borderTopLeftRadius borderTopRightRadius borderBottomLeftRadius borderBottomRightRadius borderWidth borderTopWidth
   borderBottomWidth borderLeftWidth borderRightWidth boxShadow experimental_backgroundImage shadowColor shadowOpacity
   shadowRadius shadowOffset elevation overflow opacity padding paddingHorizontal paddingVertical paddingTop
   paddingBottom paddingLeft paddingRight margin marginHorizontal marginVertical marginTop marginBottom marginLeft
   marginRight gap rowGap columnGap flex flexDirection flexGrow flexShrink flexWrap alignItems alignSelf justifyContent
   position zIndex width height minHeight minWidth maxWidth maxHeight aspectRatio color fontSize fontWeight
   fontFamily letterSpacing lineHeight textAlign textTransform tintColor transform`.split(/\s+/)
)
/* Touch reaches, not drawing: the glass widened three, and they stay in both looks (held by name below). */
const REACH_ATTRS = /^(hitSlop|pressRetentionOffset|hitRect)$/
const REACH_CONST = /SLOP$/
const ELEMENTS = new Set(['GlassCard', 'GlassDisc'])

/* ------------------------------------------------------------------ */
/* Reading the style objects out of a file                             */
/* ------------------------------------------------------------------ */

const keyName = (p) => (p.type === 'ObjectProperty' && !p.computed ? (p.key.name ?? p.key.value) : null)
const styleish = (node) => node.properties.some((p) => STYLE_KEYS.has(keyName(p)))

/* An object that is a style attribute's value, through an arrow, an array or a condition. */
function styleAttrValue(path) {
  let p = path.parentPath
  while (p && ['ArrowFunctionExpression', 'ArrayExpression', 'ConditionalExpression', 'LogicalExpression', 'ParenthesizedExpression', 'JSXExpressionContainer'].includes(p.node.type)) {
    if (p.isJSXExpressionContainer()) {
      const attr = p.parentPath
      return attr.isJSXAttribute() && /style$/i.test(attr.node.name.name)
    }
    p = p.parentPath
  }
  return false
}

function excluded(path) {
  return Boolean(
    path.findParent(
      (p) =>
        (p.isJSXAttribute() && (REACH_ATTRS.test(p.node.name.name) || ELEMENTS.has(p.parentPath.node.name?.name))) ||
        (p.isVariableDeclarator() && p.node.id.type === 'Identifier' && REACH_CONST.test(p.node.id.name))
    )
  )
}

const collectable = (path) => (styleish(path.node) || styleAttrValue(path)) && !excluded(path)

/* The top-level declaration a piece sits in, by name. */
function declOf(path) {
  const top = path.findParent((p) => p.parentPath && p.parentPath.isProgram())
  if (!top) return '(program)'
  let n = top.node
  if (n.type === 'ExportDefaultDeclaration' || n.type === 'ExportNamedDeclaration') n = n.declaration || n
  if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') return n.id?.name || 'default'
  if (n.type === 'VariableDeclaration') return n.declarations.map((d) => d.id.name || '?').join(',')
  return n.type
}

/* A node's source with its comments taken out and its white space run together: what is compared as text. */
function plain(src, node, comments) {
  let out = ''
  let at = node.start
  for (const c of comments) {
    if (c.start >= node.start && c.end <= node.end) {
      out += src.slice(at, c.start) + ' '
      at = c.end
    }
  }
  return (out + src.slice(at, node.end)).replace(/\s+/g, ' ').trim()
}

const inside = (inner, outer) => inner.start >= outer.start && inner.end <= outer.end

/*
 * The names a piece reads from outside it, and the local constants among
 * them, in an order that declares each before it is read (their own reads
 * first). A constant built by a hook, a destructuring or anything but a
 * plain `const name = …` is a free name instead, the same at both ends.
 */
function reads(paths, holder) {
  const free = new Set()
  const consts = []
  const seen = new Set()
  const visit = (path, node) => {
    const names = []
    const look = (p) => {
      if (!p.isReferencedIdentifier() || p.isJSXIdentifier()) return
      const b = p.scope.getBinding(p.node.name)
      if (b && inside(b.path.node, node)) return
      names.push([p.node.name, b])
    }
    if (path.isIdentifier()) look(path)
    path.traverse({ Identifier: look })
    for (const [name, b] of names) {
      if (b && b.kind === 'const' && b.path.isVariableDeclarator() && b.path.node.id.type === 'Identifier' && b.path.node.init) {
        if (seen.has(b.path.node)) continue
        seen.add(b.path.node)
        visit(b.path.get('init'), b.path.node.init)
        consts.push(b.path.node)
      } else free.add(name)
    }
  }
  for (const p of paths) visit(p, holder)
  return { free, consts }
}

/* Every style object in a file, and every GlassCard and GlassDisc, with what each needs to be drawn. */
export function extract(src) {
  const ast = parse(src, { sourceType: 'module', plugins: ['jsx'] })
  const comments = ast.comments || []
  const items = []
  const literal = (consts) => consts.map((d) => `const ${d.id.name} = ${src.slice(d.init.start, d.init.end)};`).join('\n')
  const plainConsts = (consts) => consts.map((d) => `const ${d.id.name} = ${plain(src, d.init, comments)}`).join('; ')
  traverse(ast, {
    ObjectExpression(path) {
      if (!collectable(path) || path.findParent((p) => p.isObjectExpression() && collectable(p))) return
      const { free, consts } = reads([path], path.node)
      const expr = plain(src, path.node, comments)
      items.push({
        decl: declOf(path),
        at: path.node.start,
        expr,
        sig: `${expr}\n${plainConsts(consts)}`,
        keys: path.node.properties.map((p) => keyName(p) || (p.type === 'SpreadElement' ? `...${src.slice(p.argument.start, p.argument.end)}` : '?')),
        snippet: `${literal(consts)}\nreturn (${src.slice(path.node.start, path.node.end)})`,
        free: [...free]
      })
    },
    JSXOpeningElement(path) {
      const name = path.node.name.name
      if (!ELEMENTS.has(name)) return
      const attrs = path.get('attributes')
      const parts = attrs.map((a) => {
        if (a.isJSXSpreadAttribute()) return `...${src.slice(a.node.argument.start, a.node.argument.end)}`
        const v = a.node.value
        const value = v === null ? 'true' : v.type === 'StringLiteral' ? JSON.stringify(v.value) : src.slice(v.expression.start, v.expression.end)
        return `${a.node.name.name}: ${value}`
      })
      const plainParts = attrs.map((a) => (a.isJSXSpreadAttribute() ? `...${plain(src, a.node.argument, comments)}` : a.node.value === null ? `${a.node.name.name}: true` : `${a.node.name.name}: ${plain(src, a.node.value.type === 'StringLiteral' ? a.node.value : a.node.value.expression, comments)}`))
      const { free, consts } = reads(attrs, path.node)
      const expr = `__${name}({ ${plainParts.join(', ')} })`
      const style = path.node.attributes.find((a) => a.name?.name === 'style')?.value?.expression
      items.push({
        decl: declOf(path),
        at: path.node.start,
        expr,
        sig: `${expr}\n${plainConsts(consts)}`,
        keys: ['backgroundColor', 'borderRadius', ...(style?.type === 'ObjectExpression' ? style.properties.map((p) => keyName(p) || '?') : [])],
        snippet: `${literal(consts)}\nreturn __${name}({ ${parts.join(', ')} })`,
        free: [...free]
      })
    }
  })
  return items.sort((a, b) => a.at - b.at)
}

/* ------------------------------------------------------------------ */
/* Drawing them                                                         */
/* ------------------------------------------------------------------ */

/*
 * A stand-in for anything a style reads that is not the theme or the glass:
 * a prop, a hook's answer, a helper from elsewhere. The same name is the same
 * stand-in at both ends, so what is not glass compares the same, and a
 * difference is a difference in the glass.
 */
function standIns() {
  const cache = new Map()
  const make = (path) => {
    if (cache.has(path)) return cache.get(path)
    const proxy = new Proxy(() => {}, {
      get(_, k) {
        if (k === Symbol.toPrimitive) return (hint) => (hint === 'number' ? 1 : `‹${path}›`)
        if (typeof k === 'symbol' || k === 'then') return undefined
        return make(`${path}.${k}`)
      },
      apply: (_, __, args) => make(`${path}(${args.map((a) => (typeof a === 'function' ? '…' : JSON.stringify(a) ?? String(a))).join(',')})`),
      has: () => false,
      ownKeys: () => [],
      getOwnPropertyDescriptor: () => undefined
    })
    cache.set(path, proxy)
    return proxy
  }
  return make
}

/* Drawn: undefined is what React Native draws as nothing, so it is left out, as a key never written is. */
function drawn(v) {
  if (Array.isArray(v)) return v.map(drawn)
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const out = {}
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = drawn(x)
    return out
  }
  return v
}
const flatten = (style) => (Array.isArray(style) ? Object.assign({}, ...style.flat(Infinity).filter(Boolean)) : style || {})

/* Glass.js on a bench: its real source, its JSX made calls, against the real theme and glass. */
async function glassComponents() {
  const { transformSync } = await import('esbuild')
  const theme = await import('../mobile/src/lib/theme.js')
  const glass = await import('../mobile/src/lib/glass.js')
  const src = read('mobile/src/components/Glass.js')
  const imports = [...src.matchAll(/^import .*$/gm)].map((m) => m[0])
  assert.deepEqual(
    imports,
    ["import { View } from 'react-native'", "import { classic, glassCard } from '../lib/glass'", "import { color } from '../lib/theme'"],
    'components/Glass.js imports something the bench below has no stand-in for'
  )
  const body = src.replace(/^import .*$/gm, '').replace(/^export function /gm, 'function ')
  const code = transformSync(body, { loader: 'jsx', jsx: 'transform', jsxFactory: 'h', jsxFragment: 'Fragment' }).code
  const h = (type, props, ...children) => ({ type, props: props || {}, children })
  return new Function('h', 'Fragment', 'View', 'classic', 'glassCard', 'color', `${code}\nreturn { GlassCard, GlassDisc }`)(h, 'Fragment', 'View', glass.classic, glass.glassCard, theme.color)
}

/* Everything a style may read by name: the real theme, the real glass, the real vivid, and the two components. */
async function kit() {
  const theme = await import('../mobile/src/lib/theme.js')
  const glass = await import('../mobile/src/lib/glass.js')
  const vivid = await import('../mobile/src/lib/vivid.js')
  const { GlassCard, GlassDisc } = await glassComponents()
  const el = (made) => (made ? flatten(made.props.style) : {})
  return {
    color: theme.color,
    radius: theme.radius,
    space: theme.space,
    font: theme.font,
    TAP: theme.TAP,
    mono: theme.mono,
    isDark: theme.isDark,
    ...glass,
    at: vivid.at,
    tint: vivid.at,
    __GlassCard: (props) => el(GlassCard({ ...props, children: [] })),
    __GlassDisc: (props) => el(GlassDisc(props)),
    __h: (type, props) => ({ type, props }),
    __Frag: 'Fragment'
  }
}

/* A snippet made a function of its scope, once. */
async function compile(snippet) {
  const { transformSync } = await import('esbuild')
  const code = transformSync(`(function () {\n${snippet}\n})`, { loader: 'jsx', jsx: 'transform', jsxFactory: '__h', jsxFragment: '__Frag' }).code.trim().replace(/;$/, '')
  return new Function('__scope', `with (__scope) { return ${code} }`)
}

/* The names a snippet reads that it does not declare. */
function freeOf(snippet) {
  const ast = parse(snippet, { sourceType: 'module', allowReturnOutsideFunction: true, plugins: ['jsx'] })
  const out = new Set()
  traverse(ast, {
    Identifier(p) {
      if (p.isReferencedIdentifier() && !p.scope.getBinding(p.node.name)) out.add(p.node.name)
    }
  })
  return out
}

/*
 * The free names' trials: each false, true, left out (undefined, which is
 * what a prop nobody passed is) and a stand-in, and every literal it is
 * compared with, alone and over a base of all false and of all left out.
 * Left out matters: Press's corner is a capsule only when `under` was never
 * passed, and without it no trial reaches that branch.
 */
function trials(src, free) {
  const names = [...free]
  const literals = new Map(names.map((n) => [n, new Set()]))
  for (const s of src) {
    for (const m of s.matchAll(/\b([A-Za-z_$][\w$]*) [!=]== ('[^']*'|\d+)/g)) literals.get(m[1])?.add(m[2].startsWith("'") ? m[2].slice(1, -1) : Number(m[2]))
  }
  const STAND = Symbol('stand-in')
  const all = (v) => Object.fromEntries(names.map((n) => [n, v]))
  const out = [{}, all(false), all(true), all(undefined)]
  for (const n of names) {
    for (const v of [false, true, undefined, STAND, ...literals.get(n)]) {
      out.push({ [n]: v })
      out.push({ ...all(false), [n]: v })
      out.push({ ...all(undefined), [n]: v })
    }
  }
  return out.map((t) => Object.fromEntries(Object.entries(t).filter(([, v]) => v !== STAND)))
}

/* One drawing of a compiled snippet, under one trial. */
function draw(fn, env, trial, make) {
  const scope = new Proxy(
    {},
    {
      has: (_, k) => typeof k === 'string' && (k in env || k in trial || !(k in globalThis)),
      get: (_, k) => (typeof k !== 'string' ? undefined : k in env ? env[k] : k in trial ? trial[k] : make(k))
    }
  )
  try {
    return { ok: drawn(fn(scope)()) }
  } catch (e) {
    return { threw: String(e?.message || e) }
  }
}

/* Each mode, Sunlight's solid glass on and off, with Classic chosen; everything put back after. */
async function eachClassic(fn) {
  const t = await import('../mobile/src/lib/theme.js')
  const was = { mode: t.getMode(), solid: t.isSolidChrome(), style: t.getGlassStyle() }
  try {
    for (const mode of ['dark', 'light']) {
      for (const solid of [false, true]) {
        t.setMode(mode)
        t.setSolidChrome(solid)
        t.setGlassStyle('classic')
        await fn(`${mode}${solid ? ', Sunlight' : ''}`)
      }
    }
  } finally {
    t.setGlassStyle(was.style)
    t.setSolidChrome(was.solid)
    t.setMode(was.mode)
  }
}

/* ------------------------------------------------------------------ */
/* The record                                                            */
/* ------------------------------------------------------------------ */

/* Pair main's pieces with the branch's in one declaration: the same ones by text, the rest by what they set. */
function align(main, branch) {
  const n = main.length
  const m = branch.length
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = main[i].sig === branch[j].sig ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const anchors = []
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (main[i].sig === branch[j].sig) anchors.push([i++, j++])
    else if (L[i + 1][j] >= L[i][j + 1]) i++
    else j++
  }
  const pairs = []
  const jac = (a, b) => {
    const A = new Set(a.keys)
    const B = new Set(b.keys)
    const both = [...A].filter((k) => B.has(k)).length
    return both / (A.size + B.size - both || 1)
  }
  let pi = 0
  let pj = 0
  for (const [ai, aj] of [...anchors, [n, m]]) {
    const M = main.slice(pi, ai)
    const B = branch.slice(pj, aj)
    /* Every one of main's must be matched; the branch's may be new. Best total likeness, in order. */
    const best = new Map()
    const go = (i, j) => {
      if (i === M.length) return { score: 0, picks: [] }
      if (B.length - j < M.length - i) return { score: -Infinity, picks: [] }
      const key = `${i},${j}`
      if (best.has(key)) return best.get(key)
      const take = go(i + 1, j + 1)
      const skip = go(i, j + 1)
      const r = take.score + jac(M[i], B[j]) >= skip.score ? { score: take.score + jac(M[i], B[j]), picks: [[i, j], ...take.picks] } : skip
      best.set(key, r)
      return r
    }
    const { score, picks } = go(0, 0)
    if (M.length && score === -Infinity) for (const x of M) pairs.push({ main: x, branch: null })
    const used = new Set(picks.map(([, j]) => j))
    for (const [i, j] of picks) pairs.push({ main: M[i], branch: B[j] })
    B.forEach((b, j) => used.has(j) || pairs.push({ main: null, branch: b }))
    pi = ai + 1
    pj = aj + 1
  }
  return pairs
}

const byDecl = (items) => {
  const out = new Map()
  for (const it of items) (out.get(it.decl) || out.set(it.decl, []).get(it.decl)).push(it)
  return out
}

/* `node test/glass-classic.mjs --write`: the record, made from git at REF and the files as they are. */
function write() {
  const git = (...args) => execFileSync('git', args, { cwd: fileURLToPath(ROOT), encoding: 'utf8', maxBuffer: 64 << 20 })
  const changed = git('diff', '--name-only', REF, '--', 'mobile/src', 'mobile/App.js')
    .split('\n')
    .filter((f) => /\.js$/.test(f) && !MECHANISM.includes(f) && existsSync(new URL(f, ROOT)))
  const files = {}
  const problems = []
  for (const f of changed) {
    let before
    try {
      before = git('show', `${REF}:${f}`)
    } catch {
      problems.push(`${f} is new since ${REF}: there is no Classic to hold it to`)
      continue
    }
    const skip = new Set(NEW_HERE[f] || [])
    const main = byDecl(extract(before).filter((x) => !skip.has(x.decl)))
    const now = byDecl(extract(read(f)).filter((x) => !skip.has(x.decl)))
    const entries = []
    for (const decl of new Set([...main.keys(), ...now.keys()])) {
      for (const { main: a, branch: b } of align(main.get(decl) || [], now.get(decl) || [])) {
        if (a && !b) problems.push(`${f} ${decl}: main drew ${a.expr} and the branch has nothing for it`)
        else if (!a) entries.push({ decl, main: null, now: b.expr })
        else if (a.sig !== b.sig) entries.push({ decl, main: a.snippet, now: b.expr })
      }
    }
    if (entries.length) files[f] = entries
  }
  if (problems.length) throw new Error(problems.join('\n'))
  const record = {
    about: `Every style the frosted glass changed in the phone app, as main drew it at ${REF}, and where it is now. Made by node test/glass-classic.mjs --write; test/glass-classic.mjs draws each pair under Classic and holds them equal.`,
    ref: REF,
    newHere: NEW_HERE,
    files
  }
  writeFileSync(RECORD, JSON.stringify(record, null, 1) + '\n')
  const count = Object.values(files).reduce((n, e) => n + e.length, 0)
  console.log(`${count} pieces in ${Object.keys(files).length} files written to test/glass-classic.json`)
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--write')) write()

/* ------------------------------------------------------------------ */
/* The checks                                                            */
/* ------------------------------------------------------------------ */

const code = (text) => text.replace(/\{\s*\/\*(?:(?!\*\/)[\s\S])*\*\/\s*\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/\s+/g, ' ')

export function run(test) {
  test('classic: the theme lays the old colours over every glass key, no shadow, sheen, dim or bar fill, and the card corner back to md', async () => {
    const t = await import('../mobile/src/lib/theme.js')
    const src = read('mobile/src/lib/theme.js')
    const block = (name) => Object.fromEntries([...src.match(new RegExp(`\\nconst ${name} = \\{([\\s\\S]*?)\\n\\}`))[1].matchAll(/^ {2}([a-zA-Z]+): '([^']*)'/gm)].map((x) => [x[1], x[2]]))
    const GLASS = ['glassFill', 'glassFillHi', 'glassBar', 'glassRim', 'glassLift', 'glassLiftRing', 'glassFlat', 'glassTop', 'glassLit', 'glassLitTop', 'glassSheen', 'sheetFill', 'sheetLift', 'scrim', 'grabber', 'glassWell']
    const NONE = ['glassBar', 'glassLift', 'glassLiftRing', 'glassFlat', 'glassTop', 'glassLit', 'glassLitTop', 'glassSheen', 'sheetLift', 'scrim']
    const was = { mode: t.getMode(), solid: t.isSolidChrome(), style: t.getGlassStyle() }
    try {
      for (const mode of ['dark', 'light']) {
        const base = block(mode === 'dark' ? 'DARK' : 'LIGHT')
        for (const solid of [false, true]) {
          t.setGlassStyle('glass')
          t.setMode(mode)
          t.setSolidChrome(solid)
          const glass = { ...t.color }
          assert.equal(t.radius.card, 18, `${mode}: the glass card is not at 18`)
          t.setGlassStyle('classic')
          const name = `${mode}${solid ? ', Sunlight' : ''}`
          for (const k of NONE) assert.equal(t.color[k], undefined, `${name}: Classic draws ${k}`)
          assert.equal(t.color.glassFill, base.panel, `${name}: Classic's frost is not the panel`)
          assert.equal(t.color.glassFillHi, base.panelHi, `${name}: Classic's pressed frost is not the pressed panel`)
          assert.equal(t.color.glassRim, base.rule, `${name}: Classic's rim is not the rule`)
          assert.equal(t.color.grabber, base.rule, `${name}: Classic's grabber is not the rule`)
          assert.equal(t.color.sheetFill, base.chassis, `${name}: a Classic sheet is not the chassis`)
          assert.equal(t.color.glassWell, base.chassis, `${name}: a Classic well is not the chassis`)
          assert.equal(t.radius.card, t.radius.md, `${name}: the card corner is not md in Classic`)
          /* Nothing but the sixteen moved, and every other colour is the palette's own. */
          for (const [k, v] of Object.entries(base)) if (!GLASS.includes(k)) assert.equal(t.color[k], v, `${name}: Classic moved ${k}`)
          for (const k of Object.keys(glass)) if (!GLASS.includes(k)) assert.equal(t.color[k], glass[k], `${name}: Classic moved ${k} from the glass's`)
          for (const v of Object.values(t.color)) assert.ok(v === undefined || !/inset|px|gradient/.test(v), `${name}: a shadow or a sheen is left in Classic: ${v}`)
          /* And the other radii are the tiles', untouched. */
          assert.deepEqual([t.radius.sm, t.radius.md, t.radius.lg, t.radius.pill], [6, 10, 14, 999])
        }
      }
    } finally {
      t.setGlassStyle(was.style)
      t.setSolidChrome(was.solid)
      t.setMode(was.mode)
    }
    assert.equal(t.radius.card, 18, 'the glass card corner was not put back')
  })

  test('classic: the two Light ink fixes stay in both looks, as contrast fixes, and nothing else of the old palette moved', async () => {
    /* Main's Light faint grey read 3.72:1 on the plain page and its amber ink 4.46:1: under 4.5 in Classic too, so the fixes are kept there. */
    const { contrast } = await import('../mobile/src/lib/ink.js')
    const t = await import('../mobile/src/lib/theme.js')
    const was = { mode: t.getMode(), style: t.getGlassStyle() }
    try {
      t.setMode('light')
      for (const style of ['glass', 'classic']) {
        t.setGlassStyle(style)
        assert.equal(t.color.silkFaint, '#636a74', `${style}: Light’s faint grey is the old one`)
        assert.equal(t.color.onSignal, '#ffffff', `${style}: Light’s ink on the amber is the old one`)
      }
      assert.ok(contrast('#767d87', t.color.chassis) < 4.5, 'the old faint grey reads 4.5:1 after all, and the fix is not one')
      assert.ok(contrast('#fffaf2', t.color.signal) < 4.5, 'the old ink on the amber reads 4.5:1 after all, and the fix is not one')
      assert.ok(contrast(t.color.silkFaint, t.color.chassis) >= 4.5 && contrast(t.color.onSignal, t.color.signal) >= 4.5)
    } finally {
      t.setGlassStyle(was.style)
      t.setMode(was.mode)
    }
  })

  test('classic: chosen in place, kept on the device under fractal.glass, read at launch, and Sunlight still solid inside the glass', async () => {
    const t = await import('../mobile/src/lib/theme.js')
    const was = { mode: t.getMode(), solid: t.isSolidChrome(), style: t.getGlassStyle() }
    const kept = new Map()
    const storage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) }
    try {
      assert.deepEqual(t.GLASS_STYLES, ['glass', 'classic'], 'the two are not Frosted glass then Classic')
      t.setGlassStyle('glass')
      t.setMode('dark')
      t.setSolidChrome(false)
      const same = t.color
      const v = t.themeVersion()
      /* Live: the same palette object, painted once, so the root's one re-render repaints everything. */
      t.setGlassStyle('classic', storage)
      assert.equal(t.color, same, 'the palette object was replaced, and every screen still holds the old one')
      assert.equal(t.themeVersion(), v + 1, 'choosing Classic does not repaint, or repaints twice')
      assert.equal(t.isClassic(), true)
      assert.equal(t.getGlassStyle(), 'classic')
      assert.equal(kept.get('fractal.glass'), 'classic', 'Classic is not kept on the device')
      t.setGlassStyle('classic', storage)
      assert.equal(t.themeVersion(), v + 1, 'choosing Classic again repaints again')
      /* Over Sunlight too: Classic was opaque, and goes on being Classic. */
      t.setSolidChrome(true)
      assert.equal(t.color.glassFill, t.color.panel, 'Sunlight lays its solid glass over Classic')
      t.setGlassStyle('glass', storage)
      assert.equal(kept.get('fractal.glass'), 'glass')
      assert.equal(t.color.glassFill, '#13161b', 'back in the glass, Sunlight is not solid')
      t.setSolidChrome(false)
      assert.equal(t.color.glassFill, 'rgba(21, 24, 29, 0.78)', 'back in the glass, it is not see-through')
      /* At launch: what was kept, and the glass for anything else, a storage that throws included. */
      const at = (value) => ({ getItem: () => value, setItem: () => {} })
      assert.equal(t.loadGlassStyle(at('classic')), 'classic', 'Classic is forgotten between launches')
      assert.equal(t.isClassic(), true)
      assert.equal(t.loadGlassStyle(at(null)), 'glass', 'a device that never chose does not start on the glass')
      assert.equal(t.loadGlassStyle(at('liquid')), 'glass', 'a value the app never writes is taken as a choice')
      t.setGlassStyle('classic')
      assert.equal(t.loadGlassStyle({ getItem: () => { throw new Error('no storage') } }), 'glass', 'storage that throws does not fall back to the glass')
      t.setGlassStyle('nonsense')
      assert.equal(t.getGlassStyle(), 'glass', 'something other than the two is chosen')
      assert.doesNotThrow(() => t.setGlassStyle('classic', { setItem: () => { throw new Error('full') } }), 'a storage that will not take it throws at the press')
      assert.equal(t.isClassic(), true, 'a storage that will not take it loses the press')
    } finally {
      t.setGlassStyle(was.style)
      t.setSolidChrome(was.solid)
      t.setMode(was.mode)
    }
    /* Read at launch, from the same store as Light and Dark, after it has landed; repainted by the root's theme watcher. */
    const app = read('mobile/App.js')
    assert.match(app, /hydrate\(\)\.then\(\(\) => loadGlassStyle\(sync\)\)/, 'the style is not read at launch')
    assert.match(app, /useSyncExternalStore\(watchTheme, themeVersion, themeVersion\)/, 'nothing repaints when the style changes')
    assert.match(read('mobile/src/lib/theme.js'), /const STYLE_KEY = 'fractal\.glass'\n/, 'the key is not under fractal., which lib/store carries')
    /*
     * And painted before the first real screen, so a Classic player never sees
     * a frame of glass. That holds by order alone, so the order is held: the
     * spinner (no glass on it) stays up until the session effect's
     * restoreDemo() has answered; restoreDemo first waits on lib/store's one
     * landing promise; and the theme's reads wait on that same promise from an
     * effect declared above it, so they run first. Light and Dark the same.
     */
    const appCode = code(app)
    const top = appCode.indexOf('export default function App() {')
    const session = appCode.indexOf('restoreDemo() .then((on) => (on ? true : haveSession()))')
    assert.ok(top >= 0 && session > top, 'the session effect is not where this check looks for it')
    for (const load of ['loadMode', 'loadGlassStyle', 'loadLooks']) {
      const at = appCode.indexOf(`hydrate().then(() => ${load}(sync))`)
      assert.ok(at > top && at < session, `${load} is not read from the store ahead of the session effect: the first screen can be drawn before it lands`)
    }
    assert.match(appCode, /\{auth === 'checking' \|\| seenWalk === null \? \(/, 'the spinner does not hold the first screen until the session effect has answered')
    assert.match(code(read('mobile/src/lib/demo.js')), /export async function restoreDemo\(\) \{ try \{ await hydrate\(\) /, 'restoreDemo does not wait on the store first, so the session can answer before the style has landed')
    assert.match(code(read('mobile/src/lib/store.js')), /export function hydrate\(\) \{ if \(loaded\) return Promise\.resolve\(\) if \(loading\) return loading /, 'hydrate is not one shared landing, so what waits on it is not run in order')
  })

  test('classic: Settings → Colors offers Frosted glass and Classic under the looks, said in one plain line, and switches it live', async () => {
    const src = read('mobile/src/components/Colours.js')
    const page = code(src)
    /* Under the looks and before the effects: a whole-app choice beside the whole-app looks. */
    const looks = page.indexOf('<Heading>Looks</Heading>')
    const style = page.indexOf('<StyleSection />')
    const effects = page.indexOf('<Heading>Effects</Heading>')
    assert.ok(looks > 0 && looks < style && style < effects, 'the style is not between the looks and the effects')
    assert.match(src, /const STYLE_NOTE = 'Frosted glass: see-through bars and rounded buttons\. Classic: the look the app had before\.'\n/)
    assert.match(page, /function StyleSection\(\) \{ return \( <View style=\{\{ gap: space\.md \}\}> <Heading>Style<\/Heading> <Note>\{STYLE_NOTE\}<\/Note> <StyleChoice \/> <\/View> \) \}/, 'the section is not a heading, its one line and the choice, as the page’s other sections are')
    /* The choice itself is drawn the same in both looks: the app's own buttons, nothing of the glass's. */
    for (const name of ['StyleSection', 'StyleChoice']) {
      const fn = page.slice(page.indexOf(`function ${name}(`), page.indexOf('}', page.indexOf(`function ${name}(`) + 200))
      assert.doesNotMatch(fn, /glass|boxShadow|radius\.card|classic\(\)/, `${name} draws something of the glass’s, which Classic would not hold`)
    }

    /* On a bench: its real source, the real theme, and a store that writes down what it is given. */
    const { transformSync } = await import('esbuild')
    const t = await import('../mobile/src/lib/theme.js')
    const from = src.indexOf('const STYLE_CHOICES = [')
    const text = src.slice(from, src.indexOf('\nfunction Heading(', from))
    const out = transformSync(text, { loader: 'jsx', jsx: 'transform', jsxFactory: 'h' }).code
    const h = (type, props, ...children) => ({ type: typeof type === 'function' ? type.name : type, props: props || {}, children: children.flat() })
    const kept = new Map()
    const sync = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) }
    const useSyncExternalStore = (watch, now) => {
      assert.equal(watch, t.watchTheme, 'the choice does not follow the theme')
      return now()
    }
    const bench = new Function('h', 'View', 'Note', 'Press', 'Heading', 'space', 'TAP', 'useSyncExternalStore', 'watchTheme', 'getGlassStyle', 'setGlassStyle', 'sync', `${out}\nreturn { StyleChoice, STYLE_CHOICES }`)(
      h, 'View', 'Note', 'Press', 'Heading', t.space, t.TAP, useSyncExternalStore, t.watchTheme, t.getGlassStyle, t.setGlassStyle, sync
    )
    const was = t.getGlassStyle()
    try {
      t.setGlassStyle('glass')
      const row = bench.StyleChoice()
      /* Two of the app's buttons, read as Light and Dark are ("Classic, button, selected"): no radio group around buttons that are not radios. */
      assert.equal(row.props.accessibilityRole, undefined, 'the two buttons sit in a radio group, which a screen reader announces as radios they are not')
      assert.deepEqual(row.props.style, { flexDirection: 'row', gap: t.space.sm }, 'the two are not side by side, as Light and Dark are')
      const buttons = row.children
      assert.deepEqual(buttons.map((b) => [b.type, b.props.label, b.props.on, b.props.tone, b.props.grow, b.props.height]), [
        ['Press', 'Frosted glass', true, 'signal', true, t.TAP],
        ['Press', 'Classic', false, 'signal', true, t.TAP]
      ], 'the choice is not the app’s own two lit buttons, Frosted glass first and chosen')
      const v = t.themeVersion()
      buttons[1].props.onPress()
      assert.equal(t.isClassic(), true, 'Classic does not take')
      assert.equal(t.themeVersion(), v + 1, 'Classic is not seen at once')
      assert.equal(kept.get('fractal.glass'), 'classic', 'Classic is not kept on the device')
      const again = bench.StyleChoice().children
      assert.deepEqual(again.map((b) => b.props.on), [false, true], 'the chosen one is not lit once chosen')
      again[0].props.onPress()
      assert.equal(t.isClassic(), false)
      assert.equal(kept.get('fractal.glass'), 'glass')
    } finally {
      t.setGlassStyle(was)
    }
  })

  test('classic: every style the glass changed draws exactly what main drew, in Dark and Light, with and without Sunlight', async () => {
    const record = JSON.parse(readFileSync(RECORD, 'utf8'))
    assert.equal(record.ref, REF, 'the record was made from another commit')
    assert.deepEqual(record.newHere, NEW_HERE, 'the record skipped something other than the choice itself')
    const env = await kit()
    const misses = []
    let pieces = 0
    let differInGlass = 0
    const t = await import('../mobile/src/lib/theme.js')
    const prepared = []
    for (const [file, entries] of Object.entries(record.files)) {
      const live = byDecl(extract(read(file)))
      for (const e of entries) {
        const now = (live.get(e.decl) || []).find((x) => x.expr === e.now)
        if (!now) {
          misses.push(`${file} ${e.decl}: ${e.now.slice(0, 120)}… is not there any more. Check what it draws in Classic against main, then run node test/glass-classic.mjs --write`)
          continue
        }
        const mainFn = e.main === null ? null : await compile(e.main)
        const nowFn = await compile(now.snippet)
        const free = new Set([...freeOf(now.snippet), ...(e.main === null ? [] : freeOf(e.main))])
        for (const k of Object.keys(env)) free.delete(k)
        for (const k of [...free]) if (k in globalThis) free.delete(k)
        prepared.push({ file, e, mainFn, nowFn, tries: trials([e.main || '', now.snippet], free) })
        pieces++
      }
    }
    assert.ok(pieces >= 100, `only ${pieces} pieces were checked; the record or the reader has lost most of them`)
    await eachClassic(async (palette) => {
      for (const { file, e, mainFn, nowFn, tries } of prepared) {
        for (const trial of tries) {
          const make = standIns()
          const was = mainFn ? draw(mainFn, env, trial, make) : { ok: {} }
          const is = draw(nowFn, env, trial, make)
          if (!isDeepStrictEqual(was, is)) {
            misses.push(`${palette}: ${file} ${e.decl} with ${JSON.stringify(trial)}:\n      main  ${JSON.stringify(was)}\n      now   ${JSON.stringify(is)}`)
            break
          }
          if (is.ok && ('boxShadow' in is.ok || 'experimental_backgroundImage' in is.ok)) misses.push(`${palette}: ${file} ${e.decl} draws a shadow or a sheen in Classic`)
        }
      }
    })
    /* And the check has teeth: in the glass, nearly every one of them draws something else. */
    const before = t.getGlassStyle()
    try {
      t.setGlassStyle('glass')
      for (const { mainFn, nowFn } of prepared) {
        const make = standIns()
        if (!isDeepStrictEqual(mainFn ? draw(mainFn, env, {}, make) : { ok: {} }, draw(nowFn, env, {}, make))) differInGlass++
      }
    } finally {
      t.setGlassStyle(before)
    }
    assert.deepEqual([...new Set(misses)], [], `Classic is not main:\n  ${[...new Set(misses)].slice(0, 30).join('\n  ')}`)
    assert.ok(differInGlass >= pieces * 0.9, `only ${differInGlass} of ${pieces} pieces look different in the glass: the comparison cannot tell the two looks apart`)
  })

  test('classic: the record covers every phone file the glass reaches into, and the touch reaches it widened stay', () => {
    const record = JSON.parse(readFileSync(RECORD, 'utf8'))
    const covered = new Set(Object.keys(record.files))
    /* Every file that reads a glass colour, the card corner, a builder or the components is in the record, or is the mechanism. */
    const READS = /\bcolor\.(glass[A-Z]\w*|sheetFill|sheetLift|scrim|grabber)\b|\bradius\.card\b|\bglass(Card|Field|Control|Float|Sheet|Pane|Lit)\(|\bpane(Rim|Fill|Well|Rule)\(|<Glass(Card|Disc)\b|\bcapsule\(|\bclassic\(\)|\bcardCorner\(/
    const all = phoneFiles()
    const outside = all.filter((f) => READS.test(code(read(f))) && !covered.has(f) && !MECHANISM.includes(f) && !NEW_FILES.includes(f))
    assert.deepEqual(outside, [], `these read the glass and are not held to main in Classic: ${outside.join(', ')}`)
    /* A file new since the record draws no shadow and no sheen in Classic, and takes the card's corner from cardCorner. */
    for (const f of NEW_FILES) {
      const body = code(read(f))
      const shadows = [...body.matchAll(/\b(boxShadow|experimental_backgroundImage): ([^,\n]+)/g)].map((m) => m[2])
      assert.ok(shadows.length > 0 && shadows.every((v) => /^glow \?/.test(v)), `${f} draws a shadow or a sheen that Classic does not take away: ${shadows.join(' | ')}`)
      assert.match(body, /const glow = lit && !classic\(\)/, `${f}: the glow is not off in Classic`)
      assert.ok(!/\bradius\.card\b/.test(body) && /borderRadius: cardCorner\(\)/.test(body), `${f} sets the glass's corner itself rather than through cardCorner`)
    }
    /* Not drawing, so not Classic's: three reaches the glass made a thumb's 44, kept in both. */
    assert.match(read('mobile/src/components/Press.js'), /hitSlop=\{height < THUMB \? \(THUMB - height\) \/ 2 : undefined\}/)
    assert.match(read('mobile/src/components/TopBar.js'), /hitSlop=\{\{ top: 11, bottom: 11, left: 8, right: 14 \}\}/)
    assert.match(read('mobile/src/screens/Settings.js'), /const CHOICE_SLOP = \{ top: 2, bottom: 2 \}/)
  })

  test('classic: GlassCard and GlassDisc, drawn by their real source, are the plain View and nothing in Classic', async () => {
    const { GlassCard, GlassDisc } = await glassComponents()
    const t = await import('../mobile/src/lib/theme.js')
    const was = { mode: t.getMode(), style: t.getGlassStyle() }
    try {
      t.setGlassStyle('classic')
      for (const mode of ['dark', 'light']) {
        t.setMode(mode)
        assert.equal(GlassDisc({ size: 30 }), null, `${mode}: the disc behind the speaker and the gear is drawn in Classic`)
        const bare = GlassCard({ clip: true, bare: true, children: ['ROW'] })
        assert.deepEqual([bare.type, bare.props.style, bare.children], ['View', undefined, [['ROW']]], `${mode}: a Settings group is not the plain stack it was`)
        const card = GlassCard({ flat: true, style: { paddingHorizontal: 12 }, children: [] })
        assert.deepEqual(drawn(flatten(card.props.style)), { backgroundColor: t.color.panel, borderRadius: 10, paddingHorizontal: 12 }, `${mode}: the facts card is not the panel at md it was`)
      }
      t.setGlassStyle('glass')
      assert.ok(GlassDisc({ size: 30 }), 'the disc is gone from the glass')
      assert.equal(GlassCard({ bare: true, children: [] }).props.style[0].borderRadius, 18, 'a bare card is not glass in the glass')
    } finally {
      t.setGlassStyle(was.style)
      t.setMode(was.mode)
    }
  })
}

/* The phone's files, from the repository as it is. */
function phoneFiles() {
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(new URL(`${dir}/`, ROOT), { withFileTypes: true })) {
      const p = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(p)
      else if (/\.js$/.test(entry.name)) out.push(p)
    }
  }
  walk('mobile/src')
  return [...out, 'mobile/App.js']
}
