# rtl-hebrew

A Claude Code mod that draws the Hebrew parts of the conversation right-to-left and flush right, so a Hebrew reader can read the transcript without the text hugging the left edge.

Works in the desktop app (Code tab) and in the terminal. Requires Claude Code 2.1.287 or later.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install rtl-hebrew --marketplace amirtestai2030/rtl-hebrew
```

Answer `y` to add the marketplace, then pick a scope (user is the usual one). From a shell instead:

```bash
claude plugin install rtl-hebrew --marketplace amirtestai2030/rtl-hebrew
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `amirtestai2030/rtl-hebrew`, then **Add plugin**. Open a new session afterwards.

To uninstall: `/plugin uninstall rtl-hebrew@rtl-hebrew`.

## What it does

For every reply from Claude, and for every prompt you typed, the mod looks at each paragraph:

- A paragraph with more Hebrew than Latin letters is drawn right-to-left and flush right. Headings stay bold, bullet and numbered lists keep their markers, **bold**, *italic*, `inline code` and links keep their look.
- A paragraph that is mostly English is drawn as before.
- Fenced code blocks and tables are always drawn as before, left-to-right.

A reply with no Hebrew at all is not touched.

## The /rtl command

- `/rtl`: shows whether the drawing is on and which mode is set.
- `/rtl off`: back to the engine's own drawing, for every message.
- `/rtl on`: turn it on again. The choice is remembered across sessions.

## Settings

Open `/config` and look for the rtl-hebrew rows:

- **Which paragraphs read right-to-left**: `auto` (more Hebrew than Latin, the default), `always` (any paragraph with Hebrew in it), or `off`.
- **Also your own prompts**: whether the prompts you typed are drawn right-to-left too.

## What it cannot do

The composer where you type, the app's menus and the tool rows (command output, file diffs) belong to the app itself, and a mod does not touch them.

## How it works

Found by trial on the desktop surface: a `Text` with `dir="rtl"`, its text wrapped in Unicode right-to-left embedding marks, inside a `Box` laid out `row-reverse`. The `dir` prop alone, and the embedding marks alone, were not enough.

## License

MIT
