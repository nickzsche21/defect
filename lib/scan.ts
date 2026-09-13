/* Secret and PII detection over the user's own chat history.
   Defensive only: this finds credentials YOU pasted into a chat so you can
   rotate them. Everything runs locally; nothing is transmitted, and no full
   secret is ever rendered — findings are redacted to first/last four. */

import type { Corpus } from "./types";

export type Sev = "critical" | "high" | "medium" | "low";

export type Finding = {
  id: string;
  detector: string;
  label: string;
  sev: Sev;
  redacted: string;
  context: string;      // surrounding words, with the secret masked
  convTitle: string;
  firstAt: number;
  lastAt: number;
  count: number;        // how many times this exact value appears
  convs: number;        // across how many conversations
  rotate?: string;      // where to revoke it
  advice: string;
};

export type ScanResult = {
  findings: Finding[];
  bySev: Record<Sev, number>;
  scannedChars: number;
  secretCount: number;
  piiCount: number;
};

/* ------------------------------- validators ------------------------------- */

function luhn(raw: string): boolean {
  const d = raw.replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(d)) return false;
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = +d[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function entropy(s: string): number {
  const f = new Map<string, number>();
  for (const c of s) f.set(c, (f.get(c) || 0) + 1);
  let e = 0;
  for (const n of f.values()) { const p = n / s.length; e -= p * Math.log2(p); }
  return e;
}

/** Docs, tutorials and templates are full of fake keys. Don't cry wolf. */
const PLACEHOLDER =
  /^(?:x{3,}|y{3,}|z{3,}|0{3,}|1{3,}|a{3,}|\.{3,}|-{3,}|_{3,}|test\w*|demo\w*|example\w*|sample\w*|your[_-]?\w*|my[_-]?\w*|placeholder|changeme|change[_-]?me|redacted|hidden|removed|none|null|undefined|true|false|abc\w*|foo\w*|bar\w*|baz\w*|dummy\w*|fake\w*|insert\w*|replace\w*)$/i;

function isPlaceholder(v: string): boolean {
  const t = v.trim().replace(/^["'`]|["'`]$/g, "");
  if (!t) return true;
  if (PLACEHOLDER.test(t)) return true;
  if (/<[^>]*>|\$\{|\{\{|%s|%\(|\[your|\[insert/i.test(t)) return true;
  if (/(?:example|placeholder|yourkey|your_key|xxxx|1234567890(?!\d)|abcdef)/i.test(t)) return true;
  if (/^(.)\1+$/.test(t)) return true;            // aaaaaaa
  return false;
}

type MaskMode = "full" | "partial" | "none" | "label";

function mask(s: string, mode: MaskMode = "full"): string {
  const t = s.trim();
  if (mode === "none") return t;
  if (mode === "label") return t.replace(/-+/g, "").replace(/BEGIN |END /g, "").trim() || t;
  if (mode === "partial") {
    // emails: keep the domain, hide who it is
    const at = t.indexOf("@");
    if (at > 0) return `${t.slice(0, Math.min(2, at))}${"•".repeat(Math.max(2, at - 2))}${t.slice(at)}`;
    return `${t.slice(0, 2)}${"•".repeat(Math.max(2, t.length - 4))}${t.slice(-2)}`;
  }
  if (t.length <= 10) return t.slice(0, 2) + "•".repeat(Math.max(2, t.length - 2));
  return `${t.slice(0, 4)}${"•".repeat(Math.min(18, t.length - 8))}${t.slice(-4)}`;
}

/** Hostnames that are never a real email domain. */
const FAKE_TLD = /\.(?:internal|local|localhost|lan|home|corp|intranet|test|invalid|example|localdomain)$/i;

/* -------------------------------- detectors ------------------------------- */

type Detector = {
  id: string;
  label: string;
  sev: Sev;
  kind: "secret" | "pii" | "surface";
  re: RegExp;
  rotate?: string;
  advice: string;
  /** group(1) when the pattern needs context around the value */
  pick?: number;
  mask?: MaskMode;
  ok?: (value: string, whole: string, text: string, at: number) => boolean;
};

const D: Detector[] = [
  {
    id: "pem", label: "Private key block", sev: "critical", kind: "secret",
    re: /-----BEGIN ((?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY)-----/g,
    pick: 1, mask: "label",
    advice: "Treat this key as compromised. Generate a new pair and replace it everywhere it is trusted.",
  },
  {
    id: "aws_secret", label: "AWS secret access key", sev: "critical", kind: "secret",
    re: /(?:aws_secret_access_key|aws_secret|secret_access_key)["'\s:=]+([A-Za-z0-9/+=]{40})/gi,
    pick: 1, rotate: "https://console.aws.amazon.com/iam/home#/security_credentials",
    advice: "Deactivate this key in IAM immediately, then check CloudTrail for use you don't recognise.",
  },
  {
    id: "aws_key", label: "AWS access key ID", sev: "high", kind: "secret",
    re: /\b((?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16})\b/g,
    pick: 1, rotate: "https://console.aws.amazon.com/iam/home#/security_credentials",
    advice: "Rotate in IAM. An access key ID alone is not enough to authenticate, but it names the account.",
  },
  {
    id: "openai", label: "OpenAI API key", sev: "critical", kind: "secret",
    re: /\b(sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,})\b/g,
    pick: 1, rotate: "https://platform.openai.com/api-keys",
    advice: "Revoke this key. Billing runs on it, so leaked keys get drained fast.",
    ok: (v) => !/^sk-ant-/.test(v),
  },
  {
    id: "anthropic", label: "Anthropic API key", sev: "critical", kind: "secret",
    re: /\b(sk-ant-[A-Za-z0-9_-]{20,})\b/g,
    pick: 1, rotate: "https://console.anthropic.com/settings/keys",
    advice: "Revoke this key in the console and issue a replacement.",
  },
  {
    id: "github", label: "GitHub token", sev: "critical", kind: "secret",
    re: /\b(gh[pousr]_[A-Za-z0-9]{36,})\b/g,
    pick: 1, rotate: "https://github.com/settings/tokens",
    advice: "Revoke it now. A leaked PAT can read and push to every repo it was scoped to.",
  },
  {
    id: "gitlab", label: "GitLab token", sev: "critical", kind: "secret",
    re: /\b(glpat-[A-Za-z0-9_-]{20,})\b/g,
    pick: 1, rotate: "https://gitlab.com/-/user_settings/personal_access_tokens",
    advice: "Revoke it in personal access tokens.",
  },
  {
    id: "slack", label: "Slack token", sev: "high", kind: "secret",
    re: /\b(xox[baprs]-[A-Za-z0-9-]{10,})\b/g,
    pick: 1, rotate: "https://api.slack.com/apps",
    advice: "Rotate the app or bot token. These can read channel history.",
  },
  {
    id: "slack_hook", label: "Slack webhook URL", sev: "medium", kind: "secret",
    re: /(https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/+_-]{20,})/g,
    pick: 1, advice: "Anyone with this URL can post into that channel. Regenerate it.",
  },
  {
    id: "stripe_live", label: "Stripe live secret key", sev: "critical", kind: "secret",
    re: /\b((?:sk|rk)_live_[A-Za-z0-9]{20,})\b/g,
    pick: 1, rotate: "https://dashboard.stripe.com/apikeys",
    advice: "Roll this key immediately — it can move real money. Check the events log afterwards.",
  },
  {
    id: "stripe_test", label: "Stripe test key", sev: "low", kind: "secret",
    re: /\b((?:sk|rk)_test_[A-Za-z0-9]{20,})\b/g,
    pick: 1, advice: "Test-mode key. Low risk, but roll it if you reuse key names across environments.",
  },
  {
    id: "google", label: "Google API key", sev: "high", kind: "secret",
    re: /\b(AIza[0-9A-Za-z_-]{35})\b/g,
    pick: 1, rotate: "https://console.cloud.google.com/apis/credentials",
    advice: "Regenerate it, and add an HTTP referrer or IP restriction to the replacement.",
  },
  {
    id: "sendgrid", label: "SendGrid API key", sev: "high", kind: "secret",
    re: /\b(SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,})\b/g,
    pick: 1, rotate: "https://app.sendgrid.com/settings/api_keys",
    advice: "Delete the key — a leaked mail key means someone can send as your domain.",
  },
  {
    id: "twilio", label: "Twilio auth token", sev: "high", kind: "secret",
    re: /(?:twilio[_-]?(?:auth[_-]?)?token|auth_token)["'\s:=]+([a-f0-9]{32})\b/gi,
    pick: 1, rotate: "https://console.twilio.com/",
    advice: "Rotate the auth token. Leaked Twilio credentials get used for toll fraud.",
  },
  {
    id: "npm", label: "npm access token", sev: "high", kind: "secret",
    re: /\b(npm_[A-Za-z0-9]{36})\b/g,
    pick: 1, rotate: "https://www.npmjs.com/settings/~/tokens",
    advice: "Revoke it. A publish-scoped token can ship code to everyone who installs your package.",
  },
  {
    id: "pypi", label: "PyPI token", sev: "high", kind: "secret",
    re: /\b(pypi-[A-Za-z0-9_-]{32,})\b/g,
    pick: 1, rotate: "https://pypi.org/manage/account/token/",
    advice: "Revoke the token in your PyPI account settings.",
  },
  {
    id: "dburl", label: "Database URL with password", sev: "critical", kind: "secret",
    re: /\b((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|mssql):\/\/[^\s:@/]+:[^\s:@/]{3,}@[^\s/]+)/gi,
    pick: 1,
    advice: "Rotate the database password and confirm the host is not reachable from the public internet.",
  },
  {
    id: "basicauth", label: "Credentials in a URL", sev: "high", kind: "secret",
    re: /\b(https?:\/\/[^\s:@/]+:[^\s:@/]{3,}@[^\s]+)/gi,
    pick: 1, advice: "Rotate that password — URLs end up in logs, history and proxies.",
  },
  {
    id: "jwt", label: "JSON Web Token", sev: "medium", kind: "secret",
    re: /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g,
    pick: 1,
    advice: "If it is a service-role or long-lived token, rotate the signing secret. Decode it to check the expiry.",
  },
  {
    id: "envassign", label: "Secret in an environment variable", sev: "high", kind: "secret",
    // one greedy class then a required delimiter — three adjacent overlapping
    // classes here caused exponential backtracking on long base64 runs
    re: /\b([A-Z][A-Z0-9_]{2,60})\s*[=:]\s*["']?([^\s"'\n,;]{8,120})/g,
    pick: 2,
    advice: "Rotate whatever this belongs to, and move it into a secret manager.",
    ok: (v, whole) =>
      /(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PWD|CREDENTIAL|PRIVATE)[A-Z0-9_]{0,20}\s*[=:]/.test(whole) &&
      entropy(v) > 3.0 &&
      !/^(?:https?:\/\/|\/|\.\/)/.test(v),
  },
  {
    id: "card", label: "Payment card number", sev: "high", kind: "pii",
    re: /\b((?:\d[ -]?){13,19})\b/g,
    pick: 1,
    advice: "Card data does not belong in a chat log. If it is someone else's, this is a reportable disclosure.",
    ok: (v) => luhn(v),
  },
  {
    id: "privip", label: "Internal host or private IP", sev: "low", kind: "surface",
    re: /\b((?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d{2,5})?)\b/g,
    pick: 1, mask: "none",
    advice: "Maps your internal network. Harmless alone, useful to an attacker alongside anything else here.",
  },
  {
    id: "pan", label: "Indian PAN number", sev: "medium", kind: "pii",
    re: /\b([A-Z]{5}[0-9]{4}[A-Z])\b/g,
    pick: 1, advice: "A PAN is identity data. Remove it from anywhere it is still stored.",
  },
  {
    id: "iban", label: "IBAN", sev: "medium", kind: "pii",
    re: /\b([A-Z]{2}\d{2}[A-Z0-9]{11,30})\b/g,
    pick: 1, advice: "Bank account identifier. Treat as sensitive personal data.",
    ok: (v) => /\d/.test(v.slice(4)) && v.length >= 15,
  },
  {
    id: "email", label: "Email addresses", sev: "low", kind: "pii",
    re: /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g,
    pick: 1, mask: "partial",
    advice: "Fine if it is yours. If these are customers, your chat history is now an uncontrolled copy of their data.",
    // "user:pass@host" inside a connection string is not an email address
    ok: (v, _w, text, at) =>
      !/@(?:example|test|localhost|domain|email|company|yourdomain)\./i.test(v) &&
      !FAKE_TLD.test(v.split("@")[1] || "") &&
      text[at - 1] !== ":" &&
      !/:\/\/[^\s]*$/.test(text.slice(Math.max(0, at - 60), at)),
  },
];

/* --------------------------------- scanner -------------------------------- */

const ctxWindow = (text: string, at: number, len: number) => {
  const a = Math.max(0, at - 48);
  const b = Math.min(text.length, at + len + 48);
  return (a > 0 ? "…" : "") + text.slice(a, at) + "⟨REDACTED⟩" + text.slice(at + len, b) + (b < text.length ? "…" : "");
};

export function scan(corpus: Corpus): ScanResult {
  type Acc = Omit<Finding, "id"> & { key: string; raw: string; convSet: Set<string> };
  const acc = new Map<string, Acc>();
  let scannedChars = 0;

  for (const conv of corpus.convs) {
    for (const m of conv.msgs) {
      if (m.role !== "user") continue; // only what YOU pasted
      const text = m.text;
      scannedChars += text.length;

      for (const d of D) {
        d.re.lastIndex = 0;
        let hit: RegExpExecArray | null;
        while ((hit = d.re.exec(text)) !== null) {
          const value = (d.pick ? hit[d.pick] : hit[0]) ?? "";
          if (!value || isPlaceholder(value)) continue;
          const at0 = d.pick ? text.indexOf(value, hit.index) : hit.index;
          if (d.ok && !d.ok(value, hit[0], text, at0 < 0 ? hit.index : at0)) continue;

          const at = at0;
          const key = `${d.id}::${value}`;
          const prev = acc.get(key);
          if (prev) {
            prev.count++;
            prev.convSet.add(conv.id);
            prev.convs = prev.convSet.size;
            if (m.ts && m.ts < prev.firstAt) { prev.firstAt = m.ts; prev.convTitle = conv.title || "Untitled"; }
            if (m.ts && m.ts > prev.lastAt) prev.lastAt = m.ts;
          } else {
            acc.set(key, {
              key,
              detector: d.id,
              label: d.label,
              sev: d.sev,
              raw: value,
              redacted: mask(value, d.mask),
              context: ctxWindow(text, at < 0 ? hit.index : at, value.length),
              convTitle: conv.title || "Untitled",
              firstAt: m.ts || conv.created,
              lastAt: m.ts || conv.created,
              count: 1,
              convs: 1,
              convSet: new Set([conv.id]),
              rotate: d.rotate,
              advice: d.advice,
            });
          }
          if (hit.index === d.re.lastIndex) d.re.lastIndex++; // zero-width guard
        }
      }
    }
  }

  // a value already identified precisely ("Stripe live secret key") must not also
  // appear as the generic "secret in an environment variable"
  const named: string[] = [];
  for (const a of acc.values()) if (a.detector !== "envassign") named.push(a.raw);
  for (const [k, a] of acc) {
    if (a.detector !== "envassign") continue;
    // the generic capture is length-capped, so it can be a prefix of the real value
    if (named.some((n) => n === a.raw || n.startsWith(a.raw) || a.raw.startsWith(n))) acc.delete(k);
  }

  const order: Record<Sev, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const findings: Finding[] = [...acc.values()]
    .sort((a, b) => order[a.sev] - order[b.sev] || b.count - a.count)
    .map(({ convSet: _convSet, raw: _raw, key, ...f }, i) => ({ ...f, id: `f${i}-${key.slice(0, 12)}` }));

  const bySev: Record<Sev, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) bySev[f.sev]++;

  const kindOf = (id: string) => D.find((d) => d.id === id)?.kind;
  return {
    findings,
    bySev,
    scannedChars,
    secretCount: findings.filter((f) => kindOf(f.detector) === "secret").length,
    piiCount: findings.filter((f) => kindOf(f.detector) === "pii").length,
  };
}

/** A checklist someone can actually work through, or hand to their security lead. */
export function incidentReport(r: ScanResult, corpus: Corpus): string {
  const d = (t: number) => (t ? new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "unknown date");
  const lines: string[] = [
    "# Chat history exposure report",
    "",
    `Source: ${corpus.source} export, ${corpus.convs.length} conversations.`,
    `Generated: ${new Date().toISOString()}`,
    `Scanned locally; no data was transmitted.`,
    "",
    `**${r.findings.length} findings** — ${r.bySev.critical} critical, ${r.bySev.high} high, ${r.bySev.medium} medium, ${r.bySev.low} low.`,
    "",
    "Secrets are shown redacted. Look them up in your own export to confirm before rotating.",
    "",
  ];
  for (const sev of ["critical", "high", "medium", "low"] as Sev[]) {
    const group = r.findings.filter((f) => f.sev === sev);
    if (!group.length) continue;
    lines.push(`## ${sev.toUpperCase()} (${group.length})`, "");
    for (const f of group) {
      lines.push(
        `### ${f.label} — \`${f.redacted}\``,
        `- First pasted: ${d(f.firstAt)} in "${f.convTitle}"`,
        `- Appears ${f.count}× across ${f.convs} conversation${f.convs === 1 ? "" : "s"}`,
        `- Action: ${f.advice}`,
        ...(f.rotate ? [`- Rotate at: ${f.rotate}`] : []),
        "",
      );
    }
  }
  lines.push("---", "", "Generated by DEFECT (https://defect-context.vercel.app). Runs entirely in the browser.");
  return lines.join("\n");
}
