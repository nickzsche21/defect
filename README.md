# DEFECT

**Your chat history is an asset and a liability. DEFECT shows you both.**

Drop in your Claude or ChatGPT export. It is read **in your browser** — there is no server,
no upload and no account — and you get two answers:

1. **Exposure.** Every API key, database URL, private key, card number and piece of personal
   data you pasted into a chat and forgot about, with a redacted preview, the date you pasted
   it, and a link to the page where you revoke it.
2. **Portable context.** The things you keep re-explaining, compiled into custom instructions
   for ChatGPT, Grok, Claude, Gemini, or a repo file (`CLAUDE.md` / `AGENTS.md` / `.cursorrules`).

The second half is the useful trick. The first half is the one that makes people sit up.

**Live: https://defect-context.vercel.app**

---

## Exposure scan

Chat histories are where secrets go to be forgotten. You paste a `.env` to debug a deploy, get
your answer, and that file now lives in a synced, searchable history retained under someone
else's policy — readable by anyone who gets into your account.

DEFECT looks for ~25 classes of leak in **messages you typed**: AWS / OpenAI / Anthropic /
GitHub / GitLab / Slack / Stripe / Google / SendGrid / Twilio / npm / PyPI credentials, private
key blocks, database URLs with passwords, JWTs, credentials embedded in URLs, secrets in
environment-variable assignments, Luhn-validated card numbers, IBANs, PAN numbers, emails and
internal hosts.

It tries hard not to cry wolf: card numbers are **Luhn-checked**, generic secrets are
**entropy-checked**, documentation placeholders (`YOUR_API_KEY`, `sk-xxxx`, `<token>`) are
ignored, and a value already identified precisely is not re-reported as a generic one.

Findings are **redacted to first and last four characters** — DEFECT never renders a full
credential, even locally. Each one carries the date you first pasted it, which conversation it
was in, how many times it recurs, and a direct link to that provider's key-rotation page.
`Download the report` produces a Markdown checklist you can work through or hand to whoever
owns security where you work.

## Portable context

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

- Everything here is **heuristic**, not an LLM. No API key, no cost, no inference — just pattern
  matching with validators. That is why it is instant and free, and also why it is not perfect.
- The scanner will miss credential formats it does not know, and will occasionally flag something
  harmless. **Confirm before you rotate anything.** It reads only what you typed, not what the
  model echoed back — a key the assistant repeated in its reply will not be flagged.
- A clean result means "none of the patterns DEFECT knows about", not "you are safe".
- Context extraction needs repetition to find anything, because repetition *is* the signal.
  Project-name detection is the noisiest part.
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
lib/scan.ts     secret + PII detectors, validators, incident report
lib/dict.ts     technology, stopword and pattern vocabularies
lib/extract.ts  the profile extractor
lib/compile.ts  profile → per-target instruction blocks
```

MIT.
