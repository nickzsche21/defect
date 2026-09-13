# DEFECT

**Take your context to any model.**

You have spent months teaching one model how you work — your stack, your projects, the
fourteen things you are tired of repeating. That context is stuck in one vendor's chat history.
Switching to another model means starting from nothing.

DEFECT reads your chat export **in your browser** and compiles it into custom instructions
you can paste into ChatGPT, Grok, Claude, Gemini, or drop into a repo as `CLAUDE.md` /
`AGENTS.md` / `.cursorrules`.

**Live: https://defect.vercel.app**

---

## What it actually does

It reads only your own messages — the assistant's replies are the model's voice, not yours — and pulls out:

| | |
|---|---|
| **Standing orders** | Rules you gave more than once, quoted in your own words, ranked by how many *separate conversations* you had to repeat them in. This is the good stuff. |
| **Identity** | The moments you introduced yourself ("I'm a solo founder building…"). |
| **Stack** | Technologies you actually bring up, weighted by conversation spread rather than raw mentions. |
| **Projects** | Identifier-shaped names you keep returning to. |
| **Tone** | Measured, not guessed: message length, code density, question-vs-instruction ratio, how often you say please. |
| **The repetition tax** | How many times you re-explained something you had already explained. |

Every extracted fact is a checkbox. Delete anything it got wrong before you copy.

## Privacy

There is no server. No API routes, no database, no analytics, no account.
The export is parsed by JavaScript in your tab and never leaves it — open the network
panel and watch. The site is a static build; you can also clone it and run it offline.

## Getting your export

- **Claude** — Settings → Privacy → Export data. Drop the `.zip` in directly.
- **ChatGPT** — Settings → Data controls → Export data. Drop the `.zip` in directly.
- **Anything else** — any JSON export works; DEFECT looks for message-shaped data and usually finds it.

`.zip` files are read in-browser with `DecompressionStream`, so there is no zip dependency.

## Honest limitations

- Extraction is **heuristic**, not an LLM. No API key, no cost, no inference — just pattern
  matching over your own words. It finds what you repeated, which is a decent proxy for what
  you were tired of typing, and it will occasionally surface noise. That is why everything is deletable.
- Project-name detection is the noisiest part.
- Gemini's Takeout format is HTML, not JSON, and is not parsed. Use the paste box.

## Run it yourself

```bash
git clone https://github.com/nickzsche21/defect
cd defect && npm install && npm run dev
```

## Layout

```
lib/zip.ts      minimal ZIP reader (DecompressionStream, no dependency)
lib/parse.ts    Claude / ChatGPT / generic-JSON parsers → one shape
lib/dict.ts     technology, stopword and pattern vocabularies
lib/extract.ts  the profile extractor
lib/compile.ts  profile → per-target instruction blocks
```

MIT.
