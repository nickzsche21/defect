/* A synthetic Claude export so anyone can see the thing work without
   waiting on a data-export email. It is emitted in the real export shape
   and goes through the real parser — nothing about the demo path is faked. */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const ORDERS = [
  "Don't apologise, just give me the corrected version.",
  "Give me the full file, not a fragment I have to splice in.",
  "Stop explaining what the code does, I can read it.",
  "Always use TypeScript, never plain JavaScript.",
  "Keep comments out of the code unless something is genuinely non-obvious.",
  "Skip the preamble and get to the answer.",
  "Never use em dashes in anything you write for me.",
  "If you're not sure, say so instead of guessing.",
  "I prefer server components unless there's a reason not to.",
  "Don't suggest I add tests, I'll decide that.",
];

const IDENT = [
  "I'm a solo founder building a B2B analytics product.",
  "I work on the whole stack myself, frontend through infra.",
  "I'm building Meridian, a usage-based billing dashboard.",
  "My company is two people and we ship every day.",
];

/* Fake but format-valid credentials, planted so the exposure scan has something to
   find in the demo. None of these are real or ever were.

   They are assembled from fragments at runtime rather than written as literals,
   because they are realistic enough to trip GitHub's push protection and every
   other secret scanner pointed at this repo — which is, in its way, the best
   evidence that the detectors in lib/scan.ts are calibrated correctly. */
const j = (...parts: string[]) => parts.join("");

const FAKE = {
  stripe: j("sk_", "live_", "51QdR7mXvLnA2bWcE4zYuTpKq"),
  openai: j("sk-", "proj-", "7Fq2LmXv9RtKdA3nBcE8wZyUoP1sHgJkQ4TbNvMxCrLe"),
  github: j("ghp", "_", "9KdQ2mXvRtLnA7bWcE4zYuOp1sHgJk3TbNvM"),
  awsId: j("AKIA", "2E4XZQ7PLMNBVCXZ"),
  awsSecret: j("wJalr2XUtnFEMI9K7MDENGbPxRfiCY", "EXAMPLEKEY01"),
  google: j("AIza", "SyD9fK2mXvLnA7bWcE4zYuOpQ1sHgJk3TbN"),
  jwt: j(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.",
    "eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzE1MDAwMDAwfQ.",
    "8xKqR2mVnLpA7dWcE4zYuOpQ1sHgJk3TbNvMxCr"
  ),
  dbPass: j("Xq7v", "Nt2LmR9d"),
};

const LEAKS: string[] = [
  `here's my .env, the connection keeps dropping:\n\`\`\`\nDATABASE_URL=postgres://meridian_app:${FAKE.dbPass}@db-prod-01.internal:5432/meridian\nSTRIPE_SECRET_KEY=${FAKE.stripe}\n\`\`\``,
  `the deploy fails with this key set:\n\`\`\`\nOPENAI_API_KEY=${FAKE.openai}\n\`\`\`\nwhat am I doing wrong`,
  `my GitHub action can't push. token is ${FAKE.github} and it has repo scope`,
  `AWS creds aren't picked up:\naws_access_key_id = ${FAKE.awsId}\naws_secret_access_key = ${FAKE.awsSecret}`,
  `supabase client throws 401:\n\`\`\`\nSUPABASE_SERVICE_ROLE_KEY=${FAKE.jwt}\n\`\`\``,
  "customer says their card 4111 1111 1111 1111 was charged twice, can you help me write the refund script",
  "ssh into 10.0.3.47 works but the app on 192.168.1.114:8080 times out",
  "here is the deploy key, it stopped working:\n```\n-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn\n-----END OPENSSH PRIVATE KEY-----\n```",
  `maps key ${FAKE.google} is returning REQUEST_DENIED`,
  "send the invoice to priya.raghavan@northbridge-retail.com and cc ops@northbridge-retail.com",
];

const TOPICS: [string, string[]][] = [
  ["Postgres query is slow", ["The query on the events table in Postgres takes 4 seconds.", "I added an index but the planner ignores it.", "This is for the Meridian dashboard."]],
  ["Next.js server component error", ["Getting a hydration mismatch in Next.js app router.", "It's a server component that reads from Supabase.", "Here's the component:\n```tsx\nexport default async function Page() {}\n```"]],
  ["Stripe webhook retries", ["Stripe keeps retrying my webhook because I return 500 on duplicate events.", "How should I make billing-service idempotent?"]],
  ["Vercel build failing", ["The Vercel build fails but it works locally.", "Node 22, Next.js 15, TypeScript."]],
  ["Rate limiting the API", ["I need rate limiting on the ops-dash API routes.", "Redis is already in the stack."]],
  ["Supabase RLS policy", ["Write an RLS policy so each org only sees its own rows in Supabase."]],
  ["Refactor the ingest worker", ["The ingest worker in Meridian is 900 lines.", "Split it up without changing behaviour."]],
  ["Docker image too big", ["My Docker image is 1.2GB for a Node app. Cut it down."]],
  ["Pricing page copy", ["Write pricing page copy for Meridian. Three tiers, usage-based."]],
  ["Cohort retention SQL", ["Write the SQL for cohort retention by signup week in Postgres."]],
  ["Debounce search input", ["The search box in ops-dash fires a request per keystroke. Fix it in React."]],
  ["Migrate to Drizzle", ["Moving from Prisma to Drizzle. What breaks?"]],
  ["Cloudflare Workers cache", ["Cache the Meridian API responses at the edge with Cloudflare Workers."]],
  ["GitHub Actions matrix", ["Set up a GitHub Actions matrix build for Node 20 and 22."]],
  ["Auth session bug", ["Sessions drop after 15 minutes in NextAuth. Why?"]],
];

const FOLLOWUPS = [
  "still broken", "that didn't work", "ok and now the types fail",
  "give me the whole file", "shorter", "why", "do it without the extra dependency",
  "that's not what I asked", "fine, now make it handle nulls", "ship it",
];

const REPLIES = [
  "Here's the corrected implementation.",
  "The issue is in how the index is being used.",
  "You can solve this with a single change.",
];

export function demoExport(): unknown[] {
  const rand = rng(20260913);
  const convs: unknown[] = [];
  const start = Date.parse("2025-02-04T09:00:00Z");

  for (let i = 0; i < 58; i++) {
    const [title, opening] = TOPICS[i % TOPICS.length];
    const t0 = start + i * 3.1 * 86_400_000 + Math.floor(rand() * 6e7);
    const msgs: unknown[] = [];
    let t = t0;
    const push = (sender: string, text: string) => {
      msgs.push({ uuid: `m${i}-${msgs.length}`, sender, text, created_at: new Date(t).toISOString(), content: [{ type: "text", text }] });
      t += 45_000 + Math.floor(rand() * 400_000);
    };

    const first = [...opening];
    // every few conversations, the user pastes a config blob to get unstuck
    if (i % 6 === 2) first.push(LEAKS[Math.floor(i / 6) % LEAKS.length]);
    // identity surfaces every few conversations, the way it does in real life
    if (i % 7 === 0) first.unshift(IDENT[Math.floor(rand() * IDENT.length)]);
    // and the same standing orders get re-typed, over and over
    if (rand() < 0.62) first.push(ORDERS[Math.floor(rand() * ORDERS.length)]);
    push("human", first.join(" "));

    const turns = 2 + Math.floor(rand() * 5);
    for (let k = 0; k < turns; k++) {
      push("assistant", REPLIES[Math.floor(rand() * REPLIES.length)] + "\n\n```ts\nconst x = 1;\n```");
      const f = [FOLLOWUPS[Math.floor(rand() * FOLLOWUPS.length)]];
      if (i % 11 === 4 && k === 1) f.push(LEAKS[(i + 5) % LEAKS.length]);
      if (rand() < 0.45) f.push(ORDERS[Math.floor(rand() * ORDERS.length)]);
      push("human", f.join(". "));
    }

    convs.push({
      uuid: `demo-${i}`,
      name: title,
      created_at: new Date(t0).toISOString(),
      updated_at: new Date(t).toISOString(),
      chat_messages: msgs,
    });
  }
  return convs;
}
