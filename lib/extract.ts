import { TECH, TECH_ALIASES, STOP, TOPIC_STOP, ORDER_PATTERNS, IDENTITY_PATTERNS, FORMAT_SPEC, PROFANITY, CASUAL, POLITE, EMOJI } from "./dict";
import type { Corpus, Fact, Profile, StyleMetric } from "./types";

/* ------------------------------- text utils ------------------------------- */

const FENCE = /```[\s\S]*?(?:```|$)/g;
const INLINE = /`[^`\n]{1,80}`/g;
const URL = /https?:\/\/\S+/g;

/** Prose only: code blocks and URLs are noise for everything except stack detection. */
function prose(text: string): string {
  let t = text.replace(FENCE, " ").replace(URL, " ");
  // very long messages are almost always pasted logs — keep the human top and tail
  if (t.length > 2400) t = t.slice(0, 1400) + "\n" + t.slice(-600);
  return t.replace(/[ \t]+/g, " ");
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 10 && s.length <= 240);
}

const words = (t: string): string[] =>
  (t.toLowerCase().match(/[a-z][a-z'+#.-]{1,24}/g) || [])
    .map((w) => w.replace(/[.'\-]+$/, ""))
    .filter((w) => w.length > 1);

/** Strip conversational scaffolding so two phrasings of one rule collapse together. */
function normalizeOrder(s: string): string {
  let t = s.toLowerCase().trim()
    .replace(/^(?:ok(?:ay)?|so|and|but|also|now|hey|hi|yeah|yes|no|well|right|actually|please|just)\b[,\s]*/g, "")
    .replace(/^(?:can|could|would|will) you (?:please )?/, "")
    .replace(/^(?:i (?:want|need) you to|you should|you need to|let'?s|try to|make sure (?:you|to)|i'?d like you to)\s*/, "")
    .replace(/[^a-z0-9'\s+#.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}

const contentTokens = (s: string) => new Set(words(s).filter((w) => !STOP.has(w) && w.length > 2));

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const sentenceCase = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const LEADS = [
  /^(?:ok(?:ay)?|so|and|but|also|now|hey|hi|yeah|yes|nope|well|right|actually|please|just|fine)\b[,\s]*/i,
  /^(?:can|could|would|will) you (?:please )?/i,
  /^(?:i (?:want|need) you to|you should|you need to|let'?s|try to|i'?d like you to)\s*/i,
];

/** The rule as the user wrote it, minus conversational scaffolding. Casing preserved. */
function stripLead(s: string): string {
  let t = s.trim();
  for (const re of LEADS) t = t.replace(re, "");
  t = t.trim().replace(/^[,;:\-\u2013\u2014]\s*/, "").replace(/\s+/g, " ");
  if (!t) return t;
  t = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(t) ? t : t + ".";
}

/* --------------------------- aggregation helper --------------------------- */

/** Tracks how many *distinct conversations* a signal appeared in — the honest
    measure of "this is a real pattern" rather than "they said it twice in a row". */
class Tally {
  private m = new Map<string, { hits: number; convs: Set<number>; label: string; evidence: string }>();
  add(key: string, convIdx: number, label?: string, evidence?: string) {
    let e = this.m.get(key);
    if (!e) { e = { hits: 0, convs: new Set(), label: label ?? key, evidence: evidence ?? "" }; this.m.set(key, e); }
    e.hits++;
    e.convs.add(convIdx);
    if (!e.evidence && evidence) e.evidence = evidence;
  }
  facts(prefix: string, opts: { minConvs?: number; minHits?: number; limit: number }): Fact[] {
    const { minConvs = 1, minHits = 1, limit } = opts;
    return [...this.m.entries()]
      .filter(([, e]) => e.convs.size >= minConvs && e.hits >= minHits)
      .sort((a, b) => b[1].convs.size - a[1].convs.size || b[1].hits - a[1].hits)
      .slice(0, limit)
      .map(([k, e], i) => ({
        id: `${prefix}-${i}-${k.slice(0, 24)}`,
        text: e.label,
        convs: e.convs.size,
        hits: e.hits,
        on: true,
        evidence: e.evidence || undefined,
      }));
  }
}

/** Collapse near-duplicate phrasings, keeping the most-repeated version. */
function dedupe(facts: Fact[], threshold = 0.55): Fact[] {
  const out: Fact[] = [];
  const sets: Set<string>[] = [];
  for (const f of facts) {
    const s = contentTokens(f.text);
    let merged = false;
    for (let i = 0; i < out.length; i++) {
      if (jaccard(s, sets[i]) >= threshold) {
        out[i].convs = Math.max(out[i].convs, f.convs);
        out[i].hits += f.hits;
        merged = true;
        break;
      }
    }
    if (!merged) { out.push({ ...f }); sets.push(s); }
  }
  return out.sort((a, b) => b.convs - a.convs || b.hits - a.hits);
}

/* -------------------------------- extractor ------------------------------- */

export async function extract(
  corpus: Corpus,
  onProgress?: (done: number, total: number) => void
): Promise<Profile> {
  const tech = new Tally(), orders = new Tally(), ident = new Tally();
  const proj = new Tally(), topic = new Tally(), fmt = new Tally();

  let msgCount = 0, userWords = 0, allWords = 0;
  let firstAt = Infinity, lastAt = 0;
  let mCode = 0, mQuestion = 0, mPolite = 0, mCasual = 0, mEmoji = 0, mShort = 0, userMsgs = 0;

  const total = corpus.convs.length;

  for (let ci = 0; ci < total; ci++) {
    const conv = corpus.convs[ci];
    const userRaw: string[] = [];

    for (const m of conv.msgs) {
      msgCount++;
      if (m.ts) { if (m.ts < firstAt) firstAt = m.ts; if (m.ts > lastAt) lastAt = m.ts; }
      allWords += words(m.text).length;
      if (m.role !== "user") continue;

      userMsgs++;
      userRaw.push(m.text);
      const p = prose(m.text);
      const w = words(p);
      userWords += w.length;

      if (/```/.test(m.text)) mCode++;
      if (/\?\s*$/.test(m.text.trim())) mQuestion++;
      if (POLITE.test(p)) mPolite++;
      if (CASUAL.test(p) || PROFANITY.test(p)) mCasual++;
      if (EMOJI.test(m.text)) mEmoji++;
      if (w.length > 0 && w.length < 10) mShort++;

      for (const s of sentences(p)) {
        // standing instructions
        if (!/\?\s*$/.test(s) && ORDER_PATTERNS.some((re) => re.test(s))) {
          const n = normalizeOrder(s);
          const nw = n.split(" ").filter(Boolean);
          if (nw.length >= 3 && nw.length <= 30 && contentTokens(n).size >= 2) {
            orders.add(n, ci, stripLead(s), s.trim());
          }
        }
        // identity
        for (const re of IDENTITY_PATTERNS) {
          const hit = s.match(re);
          if (hit) {
            const claim = hit[0].replace(/\s+/g, " ").trim().replace(/[,;:]$/, "");
            if (claim.split(" ").length >= 3) ident.add(normalizeOrder(claim), ci, sentenceCase(claim), s.trim());
            break;
          }
        }
      }

      // requested output shapes
      for (const [label, re] of FORMAT_SPEC) if (re.test(p)) fmt.add(label, ci, label);
    }

    if (!userRaw.length) { if (onProgress) onProgress(ci + 1, total); continue; }

    const joined = userRaw.join("\n");
    const joinedProse = prose(joined);

    // stack — matched against the raw text so fenced code counts
    for (const t of TECH) {
      const hits = joined.match(t.re);
      if (hits) for (let i = 0; i < Math.min(hits.length, 20); i++) tech.add(t.label, ci, t.label);
    }

    // project names — identifier-shaped tokens the user keeps returning to
    const cands = new Set<string>();
    for (const m of joined.match(INLINE) || []) {
      const c = m.replace(/`/g, "").trim();
      if (/^[A-Za-z][\w.-]{2,28}$/.test(c)) cands.add(c);
    }
    for (const m of joinedProse.match(/\b[a-z0-9]+[-_][a-z0-9-_]{2,24}\b/gi) || []) cands.add(m);
    for (const m of joinedProse.match(/\b[A-Z][a-z]+[A-Z][A-Za-z]{1,20}\b/g) || []) cands.add(m);
    for (const m of joinedProse.match(/(?<=[a-z,] )[A-Z][A-Za-z0-9]{2,20}\b/g) || []) cands.add(m);
    for (const c of cands) {
      const low = c.toLowerCase();
      if (TOPIC_STOP.has(low) || TECH_ALIASES.has(low) || /^\d+$/.test(c)) continue;
      // "non-obvious", "re-render", "self-hosted" are English, not project names
      if (/^(?:non|re|un|pre|post|anti|self|multi|semi|sub|super|over|under|co)-/.test(low)) continue;
      if (low.length < 3 || low.length > 28) continue;
      proj.add(low, ci, c);
    }
    if (conv.title) {
      for (const w of words(conv.title)) if (!TOPIC_STOP.has(w) && w.length > 3 && !TECH_ALIASES.has(w)) topic.add(w, ci, w);
    }

    // topics — unigrams + bigrams, scored by how many conversations they span
    const seq = words(joinedProse);
    const keep = (w: string) =>
      !TOPIC_STOP.has(w) && w.length >= 4 && /^[a-z][a-z-]+$/.test(w) &&
      !/^(?:non|re|un|pre|post|anti|self|multi|semi|sub|super|over|under|co)-/.test(w);
    const seenUni = new Set<string>(), seenBi = new Set<string>();
    for (let i = 0; i < seq.length; i++) {
      const a = seq[i], b = seq[i + 1];
      if (!keep(a)) continue;
      if (!seenUni.has(a)) { seenUni.add(a); topic.add(a, ci, a); }
      if (b && keep(b)) {
        const bi = `${a} ${b}`;
        if (!seenBi.has(bi)) { seenBi.add(bi); topic.add(bi, ci, bi); }
      }
    }

    if (onProgress) onProgress(ci + 1, total);
    if (ci % 20 === 19) await new Promise((r) => setTimeout(r, 0)); // keep the tab responsive
  }

  /* ------------------------------ shape output ----------------------------- */

  const techFacts = tech.facts("tech", { minConvs: 1, minHits: 2, limit: 26 });
  const identFacts = dedupe(ident.facts("id", { minConvs: 1, limit: 40 })).slice(0, 6);
  const orderFacts = dedupe(orders.facts("ord", { minConvs: 1, limit: 220 }))
    .filter((f) => f.convs >= 2 || f.hits >= 2)
    .slice(0, 14);
  const fmtFacts = fmt.facts("fmt", { minConvs: 2, limit: 8 });

  // anything already stated as a rule or an identity claim shouldn't resurface as a "topic"
  const claimed = new Set<string>();
  for (const f of [...orderFacts, ...identFacts]) for (const w of words(f.text)) claimed.add(w);

  const techNames = new Set(techFacts.map((t) => t.text.toLowerCase()));
  const projFacts = proj.facts("prj", { minConvs: 3, minHits: 4, limit: 40 })
    .filter((f) => !techNames.has(f.text.toLowerCase()) && !claimed.has(f.text.toLowerCase()))
    .slice(0, 8);

  const projNames = new Set(projFacts.map((p) => p.text.toLowerCase()));
  const topicFacts = topic.facts("top", { minConvs: 3, minHits: 5, limit: 60 })
    .filter(
      (f) =>
        !techNames.has(f.text.toLowerCase()) &&
        !projNames.has(f.text.toLowerCase()) &&
        !f.text.split(" ").every((w) => claimed.has(w))
    )
    .slice(0, 14);

  /* --------------------------------- style --------------------------------- */

  const pct = (n: number) => (userMsgs ? Math.round((n / userMsgs) * 100) : 0);
  const avgWords = userMsgs ? Math.round(userWords / userMsgs) : 0;
  const style: StyleMetric[] = [
    { key: "len", label: "Average message", value: avgWords, display: `${avgWords} words`,
      note: avgWords < 22 ? "You write short." : avgWords > 70 ? "You write long and detailed." : "You write in medium bursts." },
    { key: "code", label: "Messages with code", value: pct(mCode), display: `${pct(mCode)}%`,
      note: pct(mCode) > 20 ? "You paste code constantly." : "Mostly prose." },
    { key: "q", label: "Framed as a question", value: pct(mQuestion), display: `${pct(mQuestion)}%`,
      note: pct(mQuestion) < 35 ? "You give orders more than you ask." : "You ask more than you instruct." },
    { key: "polite", label: "Says please / thanks", value: pct(mPolite), display: `${pct(mPolite)}%`,
      note: pct(mPolite) > 25 ? "Polite." : "Blunt." },
    { key: "casual", label: "Casual or sweary", value: pct(mCasual), display: `${pct(mCasual)}%`,
      note: pct(mCasual) > 15 ? "You talk to it like a colleague." : "You keep it formal." },
    { key: "short", label: "One-liners", value: pct(mShort), display: `${pct(mShort)}%`,
      note: pct(mShort) > 35 ? "Lots of terse follow-ups." : "You give full context up front." },
  ];

  const styleOrders: Fact[] = [];
  const so = (id: string, text: string) => styleOrders.push({ id, text, convs: 0, hits: 0, on: true });
  if (avgWords < 22) so("s-terse", "Match my brevity. I write short; answer short. No preamble, no recap of my question.");
  else if (avgWords > 70) so("s-detail", "I give long, detailed context. Engage with all of it — don't answer only the first paragraph.");
  if (pct(mCode) > 20) so("s-code", "Assume code in the reply. Show working code first, explanation second — and only if it isn't obvious.");
  if (pct(mQuestion) < 35) so("s-direct", "I give instructions, not questions. Execute them; don't ask me to confirm what I already said.");
  if (pct(mPolite) < 12) so("s-nopleasantry", "Skip pleasantries. No 'great question', no 'happy to help', no closing offer to help further.");
  if (pct(mCasual) > 15) so("s-casual", "Talk to me like a competent colleague, not a customer. Casual register is fine.");
  if (pct(mShort) > 35) so("s-followup", "My follow-ups are terse. Carry the context forward instead of asking me to restate it.");

  /* ----------------------------- repetition tax ---------------------------- */

  const taxed = [...orderFacts, ...identFacts, ...fmtFacts];
  const repeats = taxed.reduce((n, f) => n + Math.max(0, f.convs - 1), 0);
  const repeatWords = taxed.reduce((n, f) => n + Math.max(0, f.convs - 1) * f.text.split(" ").length, 0);

  const span = firstAt === Infinity ? 0 : Math.max(0, lastAt - firstAt);

  return {
    source: corpus.source,
    convCount: corpus.convs.length,
    msgCount,
    userWords,
    tokens: Math.round(allWords * 1.33),
    firstAt: firstAt === Infinity ? 0 : firstAt,
    lastAt,
    spanDays: Math.round(span / 86_400_000),
    repeats,
    repeatWords,
    repeatMinutes: Math.max(1, Math.round(repeatWords / 40)),
    identity: identFacts,
    stack: techFacts,
    projects: projFacts,
    orders: orderFacts,
    topics: topicFacts,
    formats: fmtFacts,
    style,
    styleOrders,
  };
}
