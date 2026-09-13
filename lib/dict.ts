/* Vocabularies that drive extraction. Everything here is a heuristic —
   the UI lets the user delete anything we get wrong. */

/** "Canonical|alias|alias" — aliases are matched case-insensitively. */
const TECH_SPEC = [
  // languages
  "TypeScript|typescript|ts|tsx", "JavaScript|javascript|js|node.js|nodejs|node",
  "Python|python|py|python3", "Rust|rust|rustlang", "Go|golang|go lang",
  "Java|java", "Kotlin|kotlin", "Swift|swift|swiftui", "Objective-C|objective-c|objc",
  "C++|c\\+\\+|cpp", "C#|c#|csharp|dotnet|.net", "C|clang",
  "Ruby|ruby|rb", "PHP|php", "Elixir|elixir|phoenix", "Scala|scala",
  "Haskell|haskell", "Lua|lua", "Zig|zig", "R|rlang", "MATLAB|matlab",
  "Bash|bash|shell script|zsh|shell", "SQL|sql", "HTML|html", "CSS|css",
  "Solidity|solidity", "Dart|dart", "Perl|perl", "Julia|julia",
  // frontend
  "React|react|react.js|reactjs", "Next.js|next.js|nextjs|next 13|next 14|next 15",
  "Vue|vue|vue.js|vuejs|nuxt", "Svelte|svelte|sveltekit", "Angular|angular",
  "Solid.js|solid.js|solidjs", "Astro|astro", "Remix|remix",
  "Tailwind|tailwind|tailwindcss", "shadcn/ui|shadcn", "Material UI|material ui|mui",
  "Vite|vite", "Webpack|webpack", "esbuild|esbuild", "Redux|redux",
  "Zustand|zustand", "TanStack Query|react query|tanstack query",
  "Framer Motion|framer motion", "Three.js|three.js|threejs|webgl",
  "D3|d3.js|d3js", "Canvas API|canvas api", "WebAssembly|webassembly|wasm",
  // mobile / desktop
  "React Native|react native", "Flutter|flutter", "Expo|expo",
  "Electron|electron", "Tauri|tauri", "Xcode|xcode", "Android Studio|android studio",
  // backend / infra
  "Express|express|express.js", "FastAPI|fastapi", "Django|django", "Flask|flask",
  "Rails|rails|ruby on rails", "Spring|spring boot|springboot",
  "GraphQL|graphql|apollo", "tRPC|trpc", "REST|rest api", "gRPC|grpc",
  "WebSockets|websocket|websockets|socket.io", "Kafka|kafka", "RabbitMQ|rabbitmq",
  "Redis|redis", "Celery|celery", "Nginx|nginx", "Caddy|caddy",
  // data
  "PostgreSQL|postgres|postgresql|psql", "MySQL|mysql|mariadb",
  "SQLite|sqlite", "MongoDB|mongodb|mongo", "Supabase|supabase",
  "Firebase|firebase|firestore", "Prisma|prisma", "Drizzle|drizzle orm|drizzle",
  "DynamoDB|dynamodb", "ClickHouse|clickhouse", "DuckDB|duckdb",
  "Elasticsearch|elasticsearch|opensearch", "Snowflake|snowflake",
  "BigQuery|bigquery", "dbt|dbt core", "Airflow|airflow", "Pinecone|pinecone",
  "pgvector|pgvector", "Weaviate|weaviate", "Chroma|chromadb|chroma",
  // cloud / devops
  "AWS|aws|amazon web services|ec2|s3|lambda", "GCP|gcp|google cloud",
  "Azure|azure", "Vercel|vercel", "Netlify|netlify", "Cloudflare|cloudflare|workers|wrangler",
  "Fly.io|fly.io|flyio", "Railway|railway.app|railway", "Render|render.com",
  "Docker|docker|dockerfile", "Kubernetes|kubernetes|k8s|kubectl",
  "Terraform|terraform", "Ansible|ansible", "GitHub Actions|github actions",
  "CI/CD|ci/cd|cicd|continuous integration", "Sentry|sentry", "Datadog|datadog",
  "Grafana|grafana", "Prometheus|prometheus",
  // ai/ml
  "PyTorch|pytorch|torch", "TensorFlow|tensorflow|tf.js|tfjs",
  "Hugging Face|hugging face|huggingface|transformers",
  "LangChain|langchain", "LlamaIndex|llamaindex", "Ollama|ollama",
  "OpenAI API|openai api|gpt-4|gpt-5|gpt4", "Anthropic API|anthropic api|claude api",
  "scikit-learn|scikit-learn|sklearn", "pandas|pandas", "NumPy|numpy",
  "Jupyter|jupyter|notebook", "Stable Diffusion|stable diffusion|comfyui",
  "RAG|rag|retrieval augmented", "Fine-tuning|fine-tuning|finetune|lora",
  "MCP|mcp|model context protocol",
  // tooling
  "Git|git", "GitHub|github", "GitLab|gitlab", "VS Code|vs code|vscode",
  "Cursor|cursor", "Claude Code|claude code", "Neovim|neovim|nvim|vim",
  "JetBrains|jetbrains|intellij|pycharm", "Figma|figma", "Notion|notion",
  "Linear|linear.app", "Jira|jira", "Slack|slack", "Stripe|stripe",
  "Twilio|twilio", "Resend|resend", "Auth0|auth0", "Clerk|clerk.dev|clerk",
  "NextAuth|nextauth|auth.js", "Playwright|playwright", "Puppeteer|puppeteer",
  "Jest|jest", "Vitest|vitest", "pytest|pytest", "Cypress|cypress",
  "Storybook|storybook", "ESLint|eslint", "Prettier|prettier",
  "npm|npm", "pnpm|pnpm", "Bun|bun|bunjs", "Deno|deno", "Yarn|yarn",
  "Homebrew|homebrew|brew", "tmux|tmux", "Obsidian|obsidian",
  "Excel|excel|spreadsheet", "Airtable|airtable", "Zapier|zapier",
  "Shopify|shopify", "WordPress|wordpress", "Webflow|webflow",
];

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export type TechEntry = { label: string; re: RegExp };

export const TECH: TechEntry[] = TECH_SPEC.map((spec) => {
  const [label, ...aliases] = spec.split("|");
  const alts = (aliases.length ? aliases : [label])
    .map((a) => esc(a.replace(/\\\\/g, "\\")))
    .sort((a, b) => b.length - a.length)
    .join("|");
  // custom boundaries so "C++", "C#", ".net" and "node.js" match correctly
  return { label, re: new RegExp(`(?<![A-Za-z0-9_#+.])(?:${alts})(?![A-Za-z0-9_+#])`, "gi") };
});

/** Function words only. Used to decide whether two phrasings are the same rule,
    so it must NOT swallow the verbs that carry a rule's meaning ("explain", "give"). */
export const STOP = new Set<string>(
  `a about above across after again against all almost alone along already also although always am among an and another any anyone anything are around as at away back be because been before being below best better between both but by came can cannot cant come could couldnt did didnt do does doesnt doing done down during each either else enough even ever every everyone everything except far few for from further get gets getting go goes going got had hadnt has hasnt have havent having he her here hers herself him himself his how however i id if ill im in into is isnt it its itself ive just keep kept let lets like likely little long made many may maybe me might mine more most much must my myself never new next no none nor not nothing now of off often on once one only onto or other others otherwise ought our ours ourselves out over own per perhaps quite rather really right said same saw say says see seem seen several shall she should shouldnt since so some someone something soon still such sure than that thats the their theirs them themselves then there these they this those though through thus to together too took toward two under until up upon us very was wasnt way we well went were what whatever when where whether which while who whole whom whose why will with within without wont would wouldnt yes yet you your yours yourself`
    .split(/\s+/).filter(Boolean)
);

/** The aggressive list. Used only for topic and project-name mining, where generic
    verbs and chat-scaffolding words are pure noise. */
export const TOPIC_STOP = new Set<string>([
  ...STOP,
  ...`actually add added adding also another anyway basically bit call called calls case cases
   change changed changes check code create created creating current currently data day days
   different end error errors example fact file files fine first fix fixed follow following full
   function functions help idea instead issue issues line lines list look looks lot main make making
   mean means move name need needs number ok okay open option options order page part place point
   possible probably problem process put question read reason return run running set setting show
   simple small sort start started state step steps stuff take test testing tests text thank thanks
   thing things think tried try trying update updated use used user users using value values version
   want work worked working works write writing wrong
   ship shipping shipped handle handles handling suggest suggests suggested decide decides decided
   extra apologise apologize apologies corrected correcting fragment fragments splice spliced
   unless entire complete completely genuinely obvious plain reasons versions correct actual real
   explain explains explaining explanation writes written give gives giving given shows showing shown
   tell tells telling told ask asks asking asked answer answers builds building built breaks breaking
   broken adds removes removing removed split splits splitting fail fails failed failing
   api apis routes route null nulls type types typed untyped comment comments dashes guessing
   prefer prefers preferred stop stops stopped skip skips skipped preamble shorter
   kind ways today yesterday tomorrow good bad better worse best worst nice clean easy hard difficult
   claude chatgpt gpt gemini grok assistant model llm chat prompt answer response output input
   context window token tokens`
    .split(/\s+/).filter(Boolean),
]);

/** Phrases that signal the user is stating a standing instruction. */
export const ORDER_PATTERNS: RegExp[] = [
  /\b(?:from now on|going forward|in future|next time)\b/i,
  /\b(?:always|never)\b/i,
  /\b(?:don'?t|do not|stop|avoid|no need to|quit)\b/i,
  /\bi (?:prefer|like|hate|expect|always|never|usually)\b/i,
  /\b(?:make sure|ensure|be sure to|remember to|remember that|keep in mind)\b/i,
  /\b(?:keep|make) (?:it|them|things)\s+(?:short|shorter|brief|concise|simple|simpler|terse|clean|minimal|readable|tight|clear|small|flat|obvious)\b/i,
  /\b(?:instead of|rather than|not)\b.{0,40}\buse\b/i,
  /\buse\b.{0,40}\b(?:instead of|rather than|not)\b/i,
  /\b(?:i told you|i already said|as i said|like i said|again,)\b/i,
  /\b(?:just|only)\s+(?:give|show|write|do|return|output)\b/i,
];

/** Phrases signalling identity / role / what they're building. */
export const IDENTITY_PATTERNS: RegExp[] = [
  /\bi'?m an? [a-z][\w\s-]{2,60}/i,
  /\bi am an? [a-z][\w\s-]{2,60}/i,
  /\bi work (?:as|at|on|in) [a-z][\w\s-]{2,60}/i,
  /\bi'?m (?:building|working on|studying|learning) [a-z][\w\s-]{2,60}/i,
  /\bi'?ve been (?:building|working|using|doing) [a-z][\w\s-]{2,60}/i,
  /\bwe'?re (?:building|a|an) [a-z][\w\s-]{2,60}/i,
  /\bmy (?:company|startup|team|job|role|background) (?:is|are)? ?[a-z][\w\s-]{2,60}/i,
  /\bi (?:run|own|founded|started) (?:a|an|my) [a-z][\w\s-]{2,60}/i,
];

/** Output-shape requests: "give me a table", "bullet points", ... */
export const FORMAT_SPEC: [string, RegExp][] = [
  ["Answer in a table when comparing things", /\b(?:in|as|a|the) tables?\b|\btabular\b/i],
  ["Use bullet points, not paragraphs", /\bbullet(?: points?)?\b|\bbulleted\b/i],
  ["Give numbered, sequential steps", /\bstep[- ]by[- ]step\b|\bnumbered (?:steps|list)\b/i],
  ["Lead with the answer, explain after", /\b(?:tl;?dr|bottom line|just the answer|straight to the point|get to the point)\b/i],
  ["Show complete files, not fragments", /\b(?:full|complete|entire|whole) (?:file|code|script|thing)\b|\bin one file\b/i],
  ["Skip the preamble and the recap", /\b(?:no|skip|without) (?:preamble|intro|fluff|yapping|the recap|explanation)\b|\bstop explaining\b/i],
  ["Keep code comments minimal", /\b(?:no|without|minimal|fewer) comments?\b/i],
  ["Show the diff, not the whole file", /\b(?:just|only|show) the diff\b|\bdiff only\b/i],
  ["Cite sources with links", /\b(?:cite|sources?|links?|references?)\b.{0,20}\b(?:please|with|include)\b|\bwith sources\b/i],
  ["Give one recommendation, not a list of options", /\b(?:just (?:pick|choose)|one option|your recommendation|what would you do|pick one)\b/i],
  ["Ask before assuming; flag unknowns", /\b(?:ask me|don'?t assume|if you'?re not sure|flag)\b/i],
  ["Write production-ready code, not toy examples", /\bproduction[- ]ready\b|\bnot a toy\b|\breal (?:code|implementation)\b/i],
  ["Explain like I already know the basics", /\b(?:i know the basics|skip the basics|assume i know|i'?m not a beginner)\b/i],
  ["Explain from first principles", /\b(?:explain like i'?m|eli5|first principles|from scratch|simple terms)\b/i],
];

export const PROFANITY = /\b(?:fuck\w*|shit\w*|damn|hell|crap|wtf|bullshit|ass|bloody)\b/i;
export const CASUAL = /\b(?:lol|lmao|haha|yeah|yep|nah|ok|okay|kinda|sorta|gonna|wanna|dude|bro|tbh|imo|ngl|fr|idk|btw)\b/i;
export const POLITE = /\b(?:please|thanks|thank you|appreciate it|kindly|sorry)\b/i;
export const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

/** Every technology alias, lowercased — used to keep tech out of "project names". */
export const TECH_ALIASES: Set<string> = new Set(
  TECH_SPEC.flatMap((spec) => spec.split("|")).map((a) => a.replace(/\\/g, "").toLowerCase())
);
