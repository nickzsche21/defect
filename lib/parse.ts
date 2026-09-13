import type { Conv, Corpus, Msg, Role } from "./types";

const asTime = (x: unknown): number => {
  if (typeof x === "number") return x > 2e10 ? x : x * 1000; // seconds vs ms
  if (typeof x === "string") {
    const t = Date.parse(x);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
};

const roleOf = (x: unknown): Role | null => {
  const s = String(x || "").toLowerCase();
  if (s === "human" || s === "user") return "user";
  if (s === "assistant" || s === "model" || s === "ai" || s === "bot") return "assistant";
  return null; // system / tool messages are not the user's voice
};

/** Flatten the many shapes a "message body" comes in. */
function textOf(node: any): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textOf).filter(Boolean).join("\n");
  if (node && typeof node === "object") {
    if (typeof node.text === "string") return node.text;
    if (Array.isArray(node.parts)) return node.parts.map(textOf).filter(Boolean).join("\n");
    if (Array.isArray(node.content)) return node.content.map(textOf).filter(Boolean).join("\n");
    if (typeof node.content === "string") return node.content;
    if (node.content && typeof node.content === "object") return textOf(node.content);
  }
  return "";
}

/* ---------- Claude: [{ uuid, name, created_at, chat_messages:[...] }] ---------- */
function parseClaude(data: any[]): Conv[] {
  return data.map((c, i) => {
    const created = asTime(c.created_at ?? c.createdAt);
    const msgs: Msg[] = (c.chat_messages || c.messages || [])
      .map((m: any): Msg | null => {
        const role = roleOf(m.sender ?? m.role);
        if (!role) return null;
        const text = (typeof m.text === "string" && m.text) || textOf(m.content) || textOf(m);
        return text.trim() ? { role, text, ts: asTime(m.created_at ?? m.createdAt) || created } : null;
      })
      .filter(Boolean) as Msg[];
    return { id: String(c.uuid ?? i), title: String(c.name ?? c.title ?? ""), created, msgs };
  });
}

/* ---------- ChatGPT: [{ title, create_time, mapping: { id: { message } } }] ---------- */
function parseChatGPT(data: any[]): Conv[] {
  return data.map((c, i) => {
    const created = asTime(c.create_time ?? c.created_at);
    const nodes = Object.values(c.mapping || {}) as any[];
    const msgs: Msg[] = nodes
      .map((n): Msg | null => {
        const m = n?.message;
        if (!m) return null;
        const role = roleOf(m.author?.role);
        if (!role) return null;
        if (m.content?.content_type && m.content.content_type !== "text" &&
            m.content.content_type !== "multimodal_text") return null;
        const text = textOf(m.content);
        return text.trim() ? { role, text, ts: asTime(m.create_time) || created } : null;
      })
      .filter(Boolean) as Msg[];
    msgs.sort((a, b) => a.ts - b.ts);
    return { id: String(c.id ?? c.conversation_id ?? i), title: String(c.title ?? ""), created, msgs };
  });
}

/* ---------- Anything else: walk the JSON looking for message-shaped arrays ---------- */
function looksLikeMsg(o: any): boolean {
  return !!o && typeof o === "object" && !Array.isArray(o) &&
    roleOf(o.role ?? o.sender ?? o.author?.role ?? o.author) !== null &&
    textOf(o).trim().length > 0;
}

function parseGeneric(data: any): Conv[] {
  const convs: Conv[] = [];
  const seen = new Set<any>();
  const walk = (node: any, title: string, depth: number) => {
    if (!node || typeof node !== "object" || depth > 8 || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      const hits = node.filter(looksLikeMsg);
      if (hits.length >= 2) {
        const msgs = hits.map((m: any): Msg => ({
          role: roleOf(m.role ?? m.sender ?? m.author?.role ?? m.author)!,
          text: textOf(m),
          ts: asTime(m.create_time ?? m.created_at ?? m.timestamp ?? m.time),
        }));
        convs.push({ id: `g${convs.length}`, title, created: msgs[0]?.ts || 0, msgs });
        return;
      }
      node.forEach((n) => walk(n, title, depth + 1));
      return;
    }
    const t = String(node.title ?? node.name ?? title ?? "");
    for (const v of Object.values(node)) walk(v, t, depth + 1);
  };
  walk(data, "", 0);
  return convs;
}

export function detectAndParse(raw: string): Corpus {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("That file isn't valid JSON. Drop the export .zip, or conversations.json from inside it.");
  }

  let source = "your export";
  let convs: Conv[] = [];
  const arr = Array.isArray(data) ? data : null;

  if (arr?.length && arr.some((c) => c && typeof c === "object" && "chat_messages" in c)) {
    source = "Claude"; convs = parseClaude(arr);
  } else if (arr?.length && arr.some((c) => c && typeof c === "object" && "mapping" in c)) {
    source = "ChatGPT"; convs = parseChatGPT(arr);
  } else {
    convs = parseGeneric(data);
    if (convs.length) source = "your export";
  }

  const kept = convs.filter((c) => c.msgs.some((m) => m.role === "user"));
  if (!kept.length) {
    throw new Error(
      "No conversations found in that file. Claude and ChatGPT both call theirs conversations.json — check you grabbed that one."
    );
  }
  // backfill missing timestamps so the timeline still works
  for (const c of kept) {
    if (!c.created) c.created = c.msgs.find((m) => m.ts)?.ts || 0;
    for (const m of c.msgs) if (!m.ts) m.ts = c.created;
  }
  return { source, convs: kept, skipped: convs.length - kept.length };
}

/** Treat pasted prose as one conversation of user turns. */
export function parsePasted(text: string): Corpus {
  const chunks = text.split(/\n{2,}/).map((s) => s.trim()).filter((s) => s.length > 1);
  const now = Date.now();
  const msgs: Msg[] = (chunks.length ? chunks : [text]).map((t) => ({ role: "user" as Role, text: t, ts: now }));
  return { source: "pasted text", convs: [{ id: "p0", title: "Pasted", created: now, msgs }], skipped: 0 };
}
