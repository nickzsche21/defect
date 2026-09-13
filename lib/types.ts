export type Role = "user" | "assistant";

export type Msg = { role: Role; text: string; ts: number };

export type Conv = {
  id: string;
  title: string;
  created: number;
  msgs: Msg[];
};

export type Corpus = {
  source: string;   // "Claude", "ChatGPT", ...
  convs: Conv[];
  skipped: number;  // conversations dropped as empty
};

/** A single extracted claim about the user. Every one is user-togglable. */
export type Fact = {
  id: string;
  text: string;          // the rendered line
  convs: number;         // distinct conversations it appeared in
  hits: number;          // raw occurrences
  on: boolean;           // included in the compiled output
  evidence?: string;     // a verbatim snippet, for "show me why"
};

export type StyleMetric = {
  key: string;
  label: string;
  value: number;
  display: string;
  note: string;
};

export type Profile = {
  source: string;
  // headline numbers
  convCount: number;
  msgCount: number;
  userWords: number;
  tokens: number;
  firstAt: number;
  lastAt: number;
  spanDays: number;
  // the tax
  repeats: number;        // times you re-explained something you'd already said
  repeatWords: number;
  repeatMinutes: number;
  // facts
  identity: Fact[];
  stack: Fact[];
  projects: Fact[];
  orders: Fact[];         // standing instructions
  topics: Fact[];
  formats: Fact[];
  style: StyleMetric[];
  styleOrders: Fact[];
};
