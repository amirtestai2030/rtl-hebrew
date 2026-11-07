import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// ---------------------------------------------------------------------------
// Hebrew paragraphs of the transcript, drawn right-to-left and flush right.
//
// What worked on the desktop surface (found by trial): a Text with dir="rtl",
// its text wrapped in Unicode right-to-left embedding marks, inside a Box laid
// out row-reverse. Code blocks, tables and Latin paragraphs are left to the
// engine's own Markdown.
// ---------------------------------------------------------------------------

const isOn = atom({ plugin: 'rtl-hebrew', key: 'isOn' } as const, true)
const STORE_KEY = 'isOn'
const COMMAND = 'rtl'

const RLE = '‫' // right-to-left embedding
const PDF = '‬' // pop directional formatting

type Mode = 'auto' | 'always' | 'off'

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

const HEBREW = /[֐-׿]/

const countOf = (s: string, re: RegExp): number => (s.match(re) ?? []).length

/** Whether a paragraph reads right-to-left under the configured mode. */
const readsRtl = (s: string, mode: Mode): boolean => {
  if (mode === 'off') return false
  const he = countOf(s, /[֐-׿]/g)
  if (he === 0) return false
  if (mode === 'always') return true
  return he >= countOf(s, /[A-Za-z]/g)
}

// ---------------------------------------------------------------------------
// Splitting markdown into blocks
// ---------------------------------------------------------------------------

type Block =
  | { kind: 'code'; text: string }
  | { kind: 'table'; text: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'list'; items: { marker: string; text: string }[] }
  | { kind: 'para'; text: string }

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
const HEADING = /^(#{1,6})\s+(.*)$/
const QUOTE = /^>\s?(.*)$/

/** Fenced code first, then the prose between fences by its own rules. */
export const blocksOf = (text: string): Block[] => {
  const out: Block[] = []
  const fence = /```[\s\S]*?(?:```|$)/g
  let last = 0
  for (const m of text.matchAll(fence)) {
    const at = m.index ?? 0
    if (at > last) out.push(...proseBlocks(text.slice(last, at)))
    out.push({ kind: 'code', text: m[0] })
    last = at + m[0].length
  }
  if (last < text.length) out.push(...proseBlocks(text.slice(last)))
  return out
}

const proseBlocks = (text: string): Block[] => {
  const out: Block[] = []
  for (const chunk of text.split(/\n[ \t]*\n+/)) {
    const lines = chunk.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim() !== '')
    if (lines.length === 0) continue
    // A table: lines of cells. Left to Markdown whole.
    if (lines.length >= 2 && lines.every(l => l.trim().startsWith('|'))) {
      out.push({ kind: 'table', text: lines.join('\n') })
      continue
    }
    // Headings and quotes are one line each; lists group their items; the rest is a paragraph.
    let para: string[] = []
    let items: { marker: string; text: string }[] = []
    const flushPara = () => {
      if (para.length) out.push({ kind: 'para', text: para.join(' ') })
      para = []
    }
    const flushList = () => {
      if (items.length) out.push({ kind: 'list', items })
      items = []
    }
    for (const line of lines) {
      const h = HEADING.exec(line)
      if (h) {
        flushPara()
        flushList()
        out.push({ kind: 'heading', level: h[1]!.length, text: h[2]! })
        continue
      }
      const q = QUOTE.exec(line)
      if (q) {
        flushPara()
        flushList()
        out.push({ kind: 'quote', text: q[1]! })
        continue
      }
      const li = LIST_ITEM.exec(line)
      if (li) {
        flushPara()
        const marker = /^\d/.test(li[2]!) ? li[2]! : '•'
        items.push({ marker: li[1]!.length >= 2 ? `  ${marker}` : marker, text: li[3]! })
        continue
      }
      if (items.length && /^\s{2,}/.test(line)) {
        // A continuation line of the last list item.
        items[items.length - 1]!.text += ` ${line.trim()}`
        continue
      }
      flushList()
      para.push(line.trim())
    }
    flushPara()
    flushList()
  }
  return out
}

// ---------------------------------------------------------------------------
// Inline markdown: bold, italic, code, links
// ---------------------------------------------------------------------------

type Span = { text: string; bold?: boolean; italic?: boolean; code?: boolean; dim?: boolean }

const INLINE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_|\[[^\]\n]+\]\([^)\n]+\))/g

export const spansOf = (text: string): Span[] => {
  const out: Span[] = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0
    if (at > last) out.push({ text: text.slice(last, at) })
    const tok = m[0]
    if (tok.startsWith('**') || tok.startsWith('__')) out.push({ text: tok.slice(2, -2), bold: true })
    else if (tok.startsWith('`')) out.push({ text: tok.slice(1, -1), code: true })
    else if (tok.startsWith('[')) {
      const close = tok.indexOf('](')
      out.push({ text: tok.slice(1, close) })
      out.push({ text: ` (${tok.slice(close + 2, -1)})`, dim: true })
    } else out.push({ text: tok.slice(1, -1), italic: true })
    last = at + tok.length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** One message: Hebrew blocks as row-reverse Box + dir=rtl Text with embedding marks; the rest as Markdown. */
function draw($: any, e: any, text: string, mode: Mode) {
  const { Box, Text, Markdown } = $.ui.resolve(e)

  const inline = (spans: Span[], base: { bold?: boolean; dim?: boolean } = {}) =>
    spans.map((s, i) => (
      <Text
        weight={s.bold || base.bold ? 'semibold' : undefined}
        italic={s.italic || undefined}
        mono={s.code || undefined}
        dimColor={s.dim || base.dim || undefined}
      >
        {(i === 0 ? RLE : '') + s.text + (i === spans.length - 1 ? PDF : '')}
      </Text>
    ))

  const rtlRow = (children: any[]) => (
    <Box flexDirection="row-reverse">
      <Text dir="rtl" wrap="wrap">{children}</Text>
    </Box>
  )

  const rows: any[] = []
  for (const b of blocksOf(text)) {
    if (b.kind === 'code' || b.kind === 'table') {
      rows.push(<Markdown text={b.text} />)
      continue
    }
    if (b.kind === 'list') {
      const rtl = readsRtl(b.items.map(i => i.text).join(' '), mode)
      if (!rtl) {
        rows.push(<Markdown text={b.items.map(i => `${/^\d/.test(i.marker.trim()) ? i.marker.trim() : '-'} ${i.text}`).join('\n')} />)
        continue
      }
      for (const item of b.items) {
        rows.push(rtlRow([<Text>{RLE + item.marker + ' '}</Text>, ...inline(spansOf(item.text))]))
      }
      continue
    }
    const rtl = readsRtl(b.text, mode)
    if (!rtl) {
      const md = b.kind === 'heading' ? `${'#'.repeat(b.level)} ${b.text}` : b.kind === 'quote' ? `> ${b.text}` : b.text
      rows.push(<Markdown text={md} />)
      continue
    }
    if (b.kind === 'heading') rows.push(rtlRow(inline(spansOf(b.text), { bold: true })))
    else if (b.kind === 'quote') rows.push(rtlRow([<Text dimColor>{RLE + '│ '}</Text>, ...inline(spansOf(b.text), { dim: true })]))
    else rows.push(rtlRow(inline(spansOf(b.text))))
  }
  return <Box flexDirection="column" gap={1}>{rows}</Box>
}

export const register: Register = (on, options) => {
  const mode: Mode = options.mode === 'always' || options.mode === 'off' ? options.mode : 'auto'
  const userMessages = options.userMessages !== false

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    await $.command.register({
      name: COMMAND,
      description: 'Hebrew right-to-left drawing: /rtl on, /rtl off, or /rtl for the state',
      argumentHint: '[on|off]',
    })
    const stored = await $.store.get(STORE_KEY)
    await update($, isOn, () => stored !== false)
    return r
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'on' || arg === 'off') {
      const turnOn = arg === 'on'
      await update($, isOn, () => turnOn)
      await $.store.set(STORE_KEY, turnOn)
      return { text: turnOn ? 'Hebrew right-to-left drawing is on.' : 'Hebrew right-to-left drawing is off.' }
    }
    const state = (await read($, isOn)) ? 'on' : 'off'
    return { text: `Hebrew right-to-left drawing is ${state} (mode: ${mode}). Use /rtl on or /rtl off.` }
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const text = e.props.text
    if (mode === 'off' || !HEBREW.test(text) || !(await read($, isOn))) return next(e)
    return draw($, e, text, mode)
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const text = e.props.text
    if (!userMessages || mode === 'off' || e.props.origin.kind !== 'composer' || !HEBREW.test(text) || !(await read($, isOn))) return next(e)
    return draw($, e, text, mode)
  })
}
