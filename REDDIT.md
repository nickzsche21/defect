# Reddit launch kit — DEFECT

**Link:** https://defect-context.vercel.app
**Repo:** https://github.com/nickzsche21/defect

The hook changed. "I found 4 live API keys in my own ChatGPT history" beats "I repeated myself
136 times" by a mile — it is alarming, it is checkable in thirty seconds, and everyone reading it
immediately wonders about their own. Lead with exposure. The portable-context half is what keeps
them on the page once they have scanned.

---

## Primary post — r/ClaudeAI, r/ChatGPT or r/LocalLLaMA

**Title (pick one):**

1. `I scanned my own ChatGPT export for API keys. Found 4 I never rotated. Built the tool so you can check yours.`
2. `Your chat history is a credential store you forgot you were running`
3. `Made a browser tool that finds every API key and password you've pasted into Claude or ChatGPT`

**Body:**

> Last month I pasted a `.env` into a chat to debug a deploy. Got my answer, moved on. That file
> is still sitting in my history — synced, searchable, retained under someone else's policy, and
> readable by anyone who ever gets into my account.
>
> I wondered how many times I'd done that. So I built DEFECT to count.
>
> You drop in the export zip from Claude or ChatGPT and it scans it **in your browser**. There is
> no server. No upload, no account, no analytics — open the network tab while it runs, the only
> requests are static assets. Which matters more here than usual: nobody should upload a file
> full of their own credentials to a website, and the fact that a cloud tool *can't* credibly do
> this is the whole reason I built it as a static page.
>
> It looks for about 25 classes of leak in messages **you** typed — AWS, OpenAI, Anthropic,
> GitHub, GitLab, Slack, Stripe, Google, SendGrid, Twilio, npm and PyPI keys, private key blocks,
> database URLs with the password in them, JWTs, secrets in env assignments, card numbers, IBANs,
> internal hosts.
>
> It tries not to cry wolf: card numbers are Luhn-checked, generic secrets are entropy-checked,
> and documentation placeholders like `YOUR_API_KEY` or `sk-xxxx` are ignored. Findings are
> redacted to first and last four characters — it never renders a full credential even locally.
> Each one tells you the date you first pasted it, which conversation, how many times it recurs,
> and links straight to that provider's rotation page. There's a Markdown report you can download
> and work through, or hand to whoever owns security where you work.
>
> The second tab is the thing I originally built: it pulls out the instructions you keep
> **repeating across separate conversations** — if you told it "never use em dashes" in fourteen
> different chats, that's a standing order, not a preference — and compiles them into custom
> instructions for ChatGPT, Grok, Claude, Gemini, or a `CLAUDE.md` / `AGENTS.md` / `.cursorrules`
> for the coding agents.
>
> **Honest about what it isn't:** there's no LLM in it. No API key, no cost, no inference — just
> pattern matching with validators. It will miss formats it doesn't know and occasionally flag
> something harmless, so confirm before you rotate. A clean result means "none of the patterns I
> know about", not "you're safe". It only reads what you typed, not what the model echoed back.
>
> Sample data on the page if you don't want to wait for the export email. MIT, clone it and run
> it offline if you'd rather.
>
> https://defect-context.vercel.app · https://github.com/nickzsche21/defect

---

## Variants by subreddit

**r/ClaudeAI / r/ChatGPT** — as written. The "I pasted a .env to debug a deploy" opening is the
universal one; nearly everyone in those subs has done it.

**r/LocalLLaMA** — lead harder on *no server, no inference, no API key*, and say plainly it is
pattern matching rather than a model. That sub respects a tool that doesn't pretend to be smart.

**r/devops, r/netsec, r/cybersecurity** — drop the portable-context half entirely. Lead with the
detector list, the Luhn and entropy validation, the redaction policy, and the downloadable report.
Read their self-promo rules first; r/netsec in particular is strict and may want it as a
Show-and-tell or not at all.

**r/SideProject / r/InternetIsBeautiful** — lead with the screenshot of the findings list.

---

## Pinned first comment (post this yourself, immediately)

> Detail on the scanning, since "point this at your secrets" deserves specifics:
>
> - It reads **only your messages**. The assistant's replies are skipped, so a key the model
>   repeated back at you won't be flagged. That's a real gap, and a deliberate one — it keeps the
>   false-positive rate sane.
> - Card numbers are Luhn-validated, so random 16-digit strings don't trigger it.
> - Generic `SOMETHING_KEY=value` matches are entropy-checked, so `API_KEY=changeme` is ignored.
> - Placeholders (`YOUR_API_KEY`, `sk-xxxx`, `<token>`, `${VAR}`) are filtered out.
> - A value already identified precisely — "Stripe live secret key" — isn't also reported as a
>   generic env-var secret.
> - Nothing is rendered in full. Everything is masked to first and last four characters, so a
>   screenshot of your own results is safe to post. Search your export for those fragments to
>   confirm before rotating.
>
> One bug worth mentioning because it's a good lesson: my first version of the env-var regex had
> three overlapping character classes in a row, and it hung the tab outright on a base64 private
> key body — textbook catastrophic backtracking. If you write secret scanners, test them against
> long runs of the same character.

---

## Answers to the comments you will definitely get

**"You want me to upload my secrets to your website?"**
> No — and that's the point. There is no upload. It's a static page with no API routes; there is
> nothing server-side to receive anything. Open devtools → Network and run it: only static asset
> GETs, no POSTs. Source is MIT, and it works offline after first load. Pull the repo and run it
> air-gapped if you want.

**"Why not just use gitleaks / trufflehog?"**
> Those scan repos. Nobody points them at a chat export, which is exactly why chat exports are
> full of secrets nobody has ever looked at. Same idea, different blind spot.

**"How do I know your regexes are any good?"**
> You don't — read them, they're in `lib/scan.ts` and the whole file is about 300 lines.
> I'd genuinely rather have corrections than stars; the detector list is the part that benefits
> most from other people's eyes.

**"It found nothing."**
> Good. That means none of the patterns it knows about turned up. It is not proof of anything
> stronger, and I've tried to word the empty state so it doesn't imply otherwise.

**"Isn't this just what Skillsync/[X] does?"**
> Different thing. They're building a local-first desktop app for moving whole coding-agent
> sessions between Claude Code, Codex and Cursor, aimed at teams. This is a web page that audits
> consumer chat exports and hands back a rotation checklist. No install, no account.

---

## Practical notes before you post

- Post from an account with real history. New accounts posting a Vercel link get auto-filtered.
- Check each sub's self-promotion rule first; several want a flair or an "I built this" tag.
- One or two subs on day one. Fast cross-posting is the quickest way to get shadowbanned.
- Reply to every comment in the first two hours — that's what decides whether it climbs.
- Lead with a screenshot of the findings list. The masking means your real results are safe to
  post, which is itself worth saying in the caption.
