# Reddit launch kit — DEFECT

**Link:** https://defect-context.vercel.app
**Repo:** https://github.com/nickzsche21/defect

---

## Primary post — r/LocalLLaMA or r/ClaudeAI

**Title (pick one):**

1. `Your chat export contains every instruction you've ever repeated. I built a browser tool that pulls them out.`
2. `I re-explained myself to Claude 136 times. So I wrote something that reads your export and extracts the rules you keep retyping.`
3. `Made a local-only tool that turns your Claude/ChatGPT export into portable custom instructions for any other model`

**Body:**

> I switch models a lot. Every time I do, I lose everything — my stack, what I'm building,
> and the twenty small rules I've spent months teaching: don't apologise, give me the whole
> file, stop explaining what the code does. All of that lives in a chat history I can't move.
>
> So I built DEFECT. You drop in the export zip from Claude or ChatGPT and it reads it **in
> your browser** — there is no server, no upload, no account. Open the network tab and watch;
> the only requests are static assets.
>
> The part I actually care about: it reads only *your* messages, splits them into sentences,
> and finds the instructions you gave in **separate conversations**. If you told it "never use
> em dashes" in fourteen different chats, that's not a preference, that's a standing order you
> were tired of typing. It ranks by how many distinct conversations a rule spans, quotes it back
> in your own words, and shows you the count.
>
> Then it compiles that into whatever you need: ChatGPT custom instructions (both boxes, with the
> 1,500-char budget enforced), Grok, Claude, Gemini, or `CLAUDE.md` / `AGENTS.md` / `.cursorrules`
> for the coding agents. Every extracted fact is a checkbox, so you delete the wrong ones before
> you copy.
>
> It also tells you how many times you re-explained something you'd already explained. Mine was
> in the hundreds. That number is the whole reason the thing exists.
>
> **What it is not:** there's no LLM in it. No API key, no inference, no cost — it's pattern
> matching over your own words, which means it's fast and free and also occasionally wrong.
> Project-name detection is the noisiest part. Gemini's Takeout is HTML rather than JSON so it
> isn't parsed; there's a paste box for that.
>
> There's sample data on the page if you don't want to wait for an export email.
>
> MIT, no analytics, clone it and run it offline if you'd rather.
>
> https://defect-context.vercel.app · https://github.com/nickzsche21/defect

---

## Variants by subreddit

**r/ClaudeAI** — lead with the Claude export path, mention `CLAUDE.md` output early; that
audience runs Claude Code and will care most about the repo-file targets.

**r/ChatGPT / r/OpenAI** — lead with the Custom Instructions box. The strongest hook is
"it fills both boxes for you, and enforces the 1,500-character limit so you're not trimming by hand."

**r/LocalLLaMA** — lead with *no server, no inference, no API key*. Say plainly that it's
heuristics, not a model. That sub respects a tool that doesn't pretend. The system-prompt
and `context.json` outputs matter most there.

**r/SideProject / r/InternetIsBeautiful** — lead with the repetition-tax number and the
Wrapped-style reveal, not the utility.

---

## Pinned first comment (post this yourself, immediately)

> How the extraction works, since "it reads your chats" deserves more detail:
>
> - Only your messages are analysed. The assistant's replies are the model's voice, not yours.
> - Code fences and URLs are stripped before prose analysis, and very long pastes are trimmed
>   to their head and tail so a pasted stack trace doesn't dominate your "topics".
> - A rule is scored by how many **distinct conversations** it appears in, not raw frequency —
>   saying something twice in one thread is a conversation, saying it in nine threads is a preference.
> - Near-identical phrasings are collapsed with token-overlap similarity so you don't get the
>   same rule five times.
> - Tone is measured rather than guessed: average message length, how often you paste code,
>   whether you phrase things as questions or instructions, how often you say please.
>
> The zip is read with `DecompressionStream`, which is why there's no zip dependency and no upload step.

---

## Answers to the comments you will definitely get

**"How do I know it isn't uploading my chats?"**
> Open devtools → Network, then run it. Only static asset GETs, no POSTs. It's a static build with
> no API routes at all — there's nothing server-side to receive anything. Source is MIT if you'd
> rather read it, and it runs offline after first load.

**"Why not just use an LLM to summarise my history?"**
> Because that means uploading your entire chat history to a third party to find out that you like
> short answers. The whole point is that this specific job — finding what you repeated — is a
> counting problem, not a reasoning problem. Free, instant, and nothing leaves your machine.

**"The output is generic / it got things wrong."**
> Both happen, especially if your history is short or you mostly ask one-off questions. It needs
> repetition to find anything, because repetition *is* the signal. Everything is a checkbox for
> exactly this reason — delete the noise, keep the rest.

**"Isn't this just what Skillsync/[X] does?"**
> Related thesis, different shape. They're building a local-first desktop app for moving whole
> coding-agent sessions between Claude Code, Codex and Cursor, aimed at teams. This is a web page
> that reads consumer chat exports and gives you back paste-able instructions. No install, no account.

---

## Practical notes before you post

- Post from an account with real history. New accounts posting a Vercel link get filtered by automod.
- Check each sub's self-promotion rule first; several want a flair or a "I built this" tag.
- Don't post to more than one or two subs on the same day — cross-posting fast is the fastest way to get shadowbanned.
- Reply to every comment in the first two hours. That's what actually decides whether it climbs.
- The screenshot to lead with is the repetition-tax number plus the standing-orders column — that's the part people screenshot for each other.
