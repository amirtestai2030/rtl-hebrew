import { expect, mock, test } from 'claude-code/testing'

const MSG = {
  plugin: 'rtl-hebrew',
  component: 'AssistantMessage',
  requestId: 'm1',
} as const

const PROMPT = {
  plugin: 'rtl-hebrew',
  component: 'UserMessage',
  requestId: 'u1',
} as const

const RLE = '‫'
const PDF = '‬'

function world(on: any, store: Record<string, unknown> = {}) {
  mock.store(on, store)
  on('command.register', () => ({ value: { command: 'rtl' } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
}

const HEBREW_REPLY = [
  '# כותרת ראשית',
  '',
  'זו פסקה **מודגשת** עם `קוד` בתוך שורה, ועם Claude Code באמצע.',
  '',
  '- פריט ראשון',
  '- פריט שני',
  '',
  'This paragraph is English and stays as it is.',
  '',
  '```js',
  'const x = 1',
  '```',
].join('\n')

test('Hebrew blocks are drawn right-to-left, English and code stay Markdown', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...MSG, surface, props: { text: HEBREW_REPLY, isFirstOfReply: true } })

    const heading = await ui.find({ type: 'Text', text: /כותרת ראשית/ })
    expect(heading?.text).toBe(`${RLE}כותרת ראשית${PDF}`)
    // The wrapper Text carries the direction; its inner span carries the weight.
    expect(heading?.props.dir).toBe('rtl')
    expect((heading?.children[0] as any)?.props.weight).toBe('semibold')

    const bold = await ui.find({ type: 'Text', text: /^.?מודגשת$/ })
    expect(bold?.props.weight).toBe('semibold')
    const code = await ui.find({ type: 'Text', text: /^קוד$/ })
    expect(code?.props.mono).toBe(true)

    const item = await ui.find({ type: 'Text', text: /פריט ראשון/ })
    expect(item?.text).toContain('פריט ראשון')

    const english = await ui.find({ type: 'Markdown', text: /This paragraph is English/ })
    expect(english?.props.text).toBe('This paragraph is English and stays as it is.')
    const fence = await ui.find({ type: 'Markdown', text: /const x = 1/ })
    expect(fence?.props.text).toContain('```js')

    await ui.unmount()
  }
})

test('a reply with no Hebrew is left to the engine', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...MSG, surface: 'desktop', props: { text: 'Plain English reply.', isFirstOfReply: true } })
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()
})

test('the prompt the person typed is drawn right-to-left too; a notification is not', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  let ui = await $.ui.mount({
    ...PROMPT,
    surface: 'desktop',
    props: { text: 'מה דעתך על זה?', origin: { kind: 'composer' }, isExpanded: true },
  })
  expect((await ui.find({ type: 'Text', text: /מה דעתך/ }))?.text).toBe(`${RLE}מה דעתך על זה?${PDF}`)
  await ui.unmount()

  ui = await $.ui.mount({
    ...PROMPT,
    surface: 'desktop',
    requestId: 'u2',
    props: { text: 'משימה הסתיימה', origin: { kind: 'task-notification' }, isExpanded: false },
  })
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()
})

test('/rtl off leaves every message to the engine and is remembered', async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const off = await $.command.run({ command: 'rtl', args: 'off', origin: { kind: 'composer' } })
  expect(off.text).toContain('off')

  let ui = await $.ui.mount({ ...MSG, surface: 'desktop', props: { text: 'שלום עולם', isFirstOfReply: true } })
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()

  await $.command.run({ command: 'rtl', args: 'on', origin: { kind: 'composer' } })
  ui = await $.ui.mount({ ...MSG, surface: 'desktop', props: { text: 'שלום עולם', isFirstOfReply: true } })
  expect((await ui.find({ type: 'Text', text: /שלום עולם/ }))?.text).toBe(`${RLE}שלום עולם${PDF}`)
  await ui.unmount()
})

test('a stored off state survives a new session', async ($, on) => {
  world(on, { isOn: false })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const { text } = await $.command.run({ command: 'rtl', args: '', origin: { kind: 'composer' } })
  expect(text).toContain('is off')
})

test('mode "always" turns a mostly-Latin paragraph with some Hebrew too', { options: { mode: 'always' } }, async ($, on) => {
  world(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const mixed = 'Install it with the command below, ואז פתח סשן חדש.'
  const ui = await $.ui.mount({ ...MSG, surface: 'desktop', props: { text: mixed, isFirstOfReply: true } })
  expect((await ui.find({ type: 'Text', text: /Install it/ }))?.text).toBe(`${RLE}${mixed}${PDF}`)
  await ui.unmount()
})
