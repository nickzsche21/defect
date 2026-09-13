import type { Fact, Profile } from "./types";

export type Field = { name: string; limit?: number; text: string };
export type Target = {
  id: string;
  label: string;
  where: string;      // where the user pastes it
  ext: string;        // download extension
  fields: Field[];
};

const on = (f: Fact[]) => f.filter((x) => x.on);
const texts = (f: Fact[]) => on(f).map((x) => x.text);

/** Join lines, dropping from the end until it fits the target's box. */
function budget(lines: string[], limit?: number): string {
  const out = lines.filter(Boolean);
  if (!limit) return out.join("\n").trim();
  while (out.length) {
    const s = out.join("\n").trim();
    if (s.length <= limit) return s;
    // drop the last bullet, never a heading
    let i = out.length - 1;
    while (i > 0 && !out[i].startsWith("- ")) i--;
    out.splice(i, 1);
  }
  return "";
}

const bullets = (xs: string[]) => xs.map((x) => `- ${x.replace(/\s+/g, " ").trim().replace(/\.?$/, ".")}`);

/* ------------------------------ content blocks ----------------------------- */

function whoBlock(p: Profile): string[] {
  const out: string[] = [];
  const id = texts(p.identity);
  if (id.length) out.push(...bullets(id.slice(0, 4)));
  const stack = texts(p.stack);
  if (stack.length) out.push(`- I work in: ${stack.slice(0, 14).join(", ")}.`);
  const proj = texts(p.projects);
  if (proj.length) out.push(`- Projects I return to: ${proj.slice(0, 6).join(", ")}.`);
  const top = texts(p.topics);
  if (top.length) out.push(`- Recurring subjects: ${top.slice(0, 10).join(", ")}.`);
  return out;
}

function howBlock(p: Profile): string[] {
  return bullets([...texts(p.styleOrders), ...texts(p.orders), ...texts(p.formats)]);
}

function ordersOnly(p: Profile): string[] {
  return bullets([...texts(p.orders), ...texts(p.formats)]);
}

/* --------------------------------- targets -------------------------------- */

export function compile(p: Profile): Target[] {
  const who = whoBlock(p);
  const how = howBlock(p);
  const stack = texts(p.stack);
  const proj = texts(p.projects);

  const prose = [
    who.length ? "## Who I am\n" + who.join("\n") : "",
    how.length ? "\n## How to work with me\n" + how.join("\n") : "",
  ].filter(Boolean).join("\n");

  const targets: Target[] = [
    {
      id: "chatgpt",
      label: "ChatGPT",
      where: "Settings → Personalization → Custom instructions. Two boxes, 1,500 characters each.",
      ext: "txt",
      fields: [
        { name: "What should ChatGPT know about you?", limit: 1500, text: budget(who, 1500) },
        { name: "How would you like ChatGPT to respond?", limit: 1500, text: budget(how, 1500) },
      ],
    },
    {
      id: "grok",
      label: "Grok",
      where: "Settings → Customize → Custom instructions.",
      ext: "txt",
      fields: [{
        name: "Custom instructions",
        limit: 3000,
        text: budget([...who, "", ...how], 3000),
      }],
    },
    {
      id: "claude",
      label: "Claude",
      where: "Settings → Profile, or a Project's custom instructions.",
      ext: "md",
      fields: [{ name: "Personal preferences", limit: 4000, text: budget([...who, "", ...how], 4000) }],
    },
    {
      id: "gemini",
      label: "Gemini",
      where: "Saved info, or the Instructions box of a Gem.",
      ext: "txt",
      fields: [{ name: "Instructions", limit: 4000, text: budget([...who, "", ...how], 4000) }],
    },
    {
      id: "claudemd",
      label: "CLAUDE.md",
      where: "Drop at the root of a repo for Claude Code, or in ~/.claude/CLAUDE.md for every project.",
      ext: "md",
      fields: [{
        name: "CLAUDE.md",
        text: [
          "# Working with me",
          "",
          who.length ? "## Context\n" + who.join("\n") : "",
          stack.length ? `\n## Stack\n${stack.slice(0, 18).join(", ")}` : "",
          proj.length ? `\n## Projects\n${proj.join(", ")}` : "",
          how.length ? "\n## Standing orders\n" + how.join("\n") : "",
          "\n<!-- Compiled by DEFECT from " + p.convCount + " conversations. Edit freely. -->",
        ].filter(Boolean).join("\n"),
      }],
    },
    {
      id: "agents",
      label: "AGENTS.md",
      where: "Repo root. Read by Codex, Cursor, Jules and most agent runners.",
      ext: "md",
      fields: [{
        name: "AGENTS.md",
        text: [
          "# AGENTS.md",
          "",
          "## About the human",
          who.join("\n") || "- (nothing extracted)",
          "",
          "## Conventions to follow",
          (ordersOnly(p).join("\n") || "- (nothing extracted)"),
          "",
          "## Tone",
          texts(p.styleOrders).map((s) => `- ${s}`).join("\n") || "- Default.",
        ].join("\n"),
      }],
    },
    {
      id: "cursor",
      label: ".cursorrules",
      where: "Repo root, for Cursor.",
      ext: "",
      fields: [{
        name: ".cursorrules",
        text: [
          "You are working with a specific person. Their context:",
          "",
          ...who,
          "",
          "Rules:",
          ...how,
        ].join("\n"),
      }],
    },
    {
      id: "system",
      label: "System prompt",
      where: "The system parameter of any API call.",
      ext: "txt",
      fields: [{
        name: "system",
        text: [
          "You are assisting a specific user. What is known about them, compiled from their own chat history:",
          "",
          ...who,
          "",
          "Follow these standing preferences unless the current request overrides them:",
          "",
          ...how,
        ].join("\n"),
      }],
    },
    {
      id: "markdown",
      label: "context.md",
      where: "The human-readable pack. Paste into anything.",
      ext: "md",
      fields: [{ name: "context.md", text: prose || "Nothing extracted." }],
    },
    {
      id: "json",
      label: "context.json",
      where: "Structured and portable. Feed it to your own tooling.",
      ext: "json",
      fields: [{
        name: "context.json",
        text: JSON.stringify(
          {
            $schema: "https://defect-context.vercel.app/context.schema.json",
            generatedBy: "DEFECT",
            generatedAt: new Date().toISOString(),
            derivedFrom: { source: p.source, conversations: p.convCount, messages: p.msgCount },
            identity: texts(p.identity),
            stack: texts(p.stack),
            projects: texts(p.projects),
            topics: texts(p.topics),
            standingOrders: texts(p.orders),
            outputPreferences: texts(p.formats),
            tone: texts(p.styleOrders),
          },
          null,
          2
        ),
      }],
    },
  ];

  return targets;
}

export function packText(t: Target): string {
  return t.fields.length === 1
    ? t.fields[0].text
    : t.fields.map((f) => `### ${f.name}\n\n${f.text}`).join("\n\n");
}
