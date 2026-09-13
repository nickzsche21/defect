"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { detectAndParse, parsePasted } from "@/lib/parse";
import { extractConversationsJson } from "@/lib/zip";
import { extract } from "@/lib/extract";
import { demoExport } from "@/lib/demo";
import type { Fact, Profile } from "@/lib/types";
import Output from "./Output";

type Stage = "idle" | "scan" | "done";
type Group = "identity" | "stack" | "projects" | "orders" | "topics" | "formats" | "styleOrders";

const nf = new Intl.NumberFormat("en-US");
const fmtDate = (t: number) => (t ? new Date(t).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—");

export default function Defect() {
  const [stage, setStage] = useState<Stage>("idle");
  const [hot, setHot] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [prog, setProg] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async (raw: string, isPaste = false) => {
    setErr("");
    setStage("scan");
    setProg(0);
    try {
      const corpus = isPaste ? parsePasted(raw) : detectAndParse(raw);
      setNote(`${nf.format(corpus.convs.length)} conversations from ${corpus.source}`);
      // let the scanning state paint before the main loop starts
      await new Promise((r) => setTimeout(r, 60));
      const p = await extract(corpus, (done, total) => setProg(Math.round((done / total) * 100)));
      setProfile(p);
      setStage("done");
      setTimeout(() => document.getElementById("reveal")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not read that file.");
      setStage("idle");
    }
  }, []);

  const onFile = useCallback(async (file: File) => {
    setErr("");
    try {
      const isZip = /\.zip$/i.test(file.name) || file.type === "application/zip";
      const text = isZip ? (await extractConversationsJson(file)).text : await file.text();
      await run(text);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not read that file.");
      setStage("idle");
    }
  }, [run]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setHot(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void onFile(f);
  }, [onFile]);

  const toggle = useCallback((group: Group, id: string) => {
    setProfile((p) => {
      if (!p) return p;
      const next = { ...p };
      (next[group] as Fact[]) = (p[group] as Fact[]).map((f) => (f.id === id ? { ...f, on: !f.on } : f));
      return next;
    });
  }, []);

  const paste = useCallback(() => {
    const t = window.prompt("Paste anything you'd want a model to know about you — old chats, a bio, a rant about how you like things done.");
    if (t && t.trim().length > 20) void run(t, true);
  }, [run]);

  return (
    <main className="wrap">
      <header className="masthead">
        <p className="kicker">Own your context</p>
        <h1 className="logo">DEFECT</h1>
        <p className="tagline">
          You have spent months teaching one model how you work. Switching to another means
          starting from nothing. <strong>Drop your chat export in and take it all with you.</strong>
        </p>
        <div className="privacy"><i className="dot" /> Runs entirely in this tab. There is no server to upload to.</div>
      </header>

      {stage !== "scan" && (
        <>
          <div
            className={`drop${hot ? " hot" : ""}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setHot(true); }}
            onDragLeave={() => setHot(false)}
            onDrop={onDrop}
          >
            <div className="big">↯</div>
            <h2>Drop your export here</h2>
            <p>the .zip from Claude or ChatGPT — or conversations.json</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.zip,application/json,application/zip"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }}
          />
          <div className="alt">
            <button className="btn primary" onClick={() => void run(JSON.stringify(demoExport()))}>
              Try it with sample data
            </button>
            <button className="btn" onClick={paste}>Paste text instead</button>
            {profile && <button className="btn" onClick={() => { setProfile(null); setStage("idle"); }}>Clear</button>}
          </div>
          {err && <div className="err">{err}</div>}
        </>
      )}

      {stage === "scan" && (
        <div className="scan">
          <div className="scanbar"><i style={{ width: `${Math.max(4, prog)}%` }} /></div>
          <p className="scanlog">Reading {note} · {prog}%</p>
        </div>
      )}

      {stage === "done" && profile && <Reveal p={profile} toggle={toggle} />}

      {stage === "idle" && !profile && <HowTo />}

      <footer className="foot">
        <p>
          <strong style={{ color: "var(--dim)" }}>DEFECT</strong> parses your export with JavaScript in this tab.
          No request ever leaves your browser carrying your chats — open the network panel and watch.
          There is no account, no analytics, and no backend.
        </p>
        <p>
          Extraction is heuristic. It finds the things you repeated across separate conversations, which is
          a decent proxy for the things you were tired of typing. Everything it finds is yours to delete before you copy it.
        </p>
        <p>
          Open source ·{" "}
          <a href="https://github.com/nickzsche21/defect" target="_blank" rel="noreferrer">github.com/nickzsche21/defect</a>
        </p>
      </footer>
    </main>
  );
}

/* -------------------------------- the reveal ------------------------------- */

function Reveal({ p, toggle }: { p: Profile; toggle: (g: Group, id: string) => void }) {
  const targets = useMemo(() => p, [p]);

  return (
    <div id="reveal">
      <section className="section">
        <h2 className="shead">What you have been carrying</h2>
        <div className="stats">
          <div className="stat"><b>{nf.format(p.convCount)}</b><span>conversations read</span></div>
          <div className="stat"><b>{nf.format(p.msgCount)}</b><span>messages</span></div>
          <div className="stat"><b>{nf.format(p.tokens)}</b><span>tokens of context, currently locked in one vendor</span></div>
          <div className="stat"><b>{p.spanDays > 0 ? `${nf.format(p.spanDays)}d` : "—"}</b><span>{fmtDate(p.firstAt)} → {fmtDate(p.lastAt)}</span></div>
        </div>

        {p.repeats > 0 && (
          <div className="tax">
            <b>{nf.format(p.repeats)}×</b>
            <p>
              That is how many times you <strong>re-explained something you had already explained</strong> in an
              earlier conversation — the same instruction, retyped into a fresh context window. Roughly{" "}
              <strong>{nf.format(p.repeatWords)} words</strong>, or {p.repeatMinutes} minutes of your life spent
              telling a model something it should have already known.
            </p>
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="shead">Your context · click anything to drop it</h2>
        <div className="cols">
          {p.orders.length > 0 && (
            <Panel title="Standing orders" sub="Rules you gave more than once, in your own words. Ranked by how many separate conversations you had to repeat them in.">
              <div className="rows">
                {p.orders.map((f) => (
                  <Row key={f.id} f={f} meta={`repeated across ${f.convs} conversations`} onClick={() => toggle("orders", f.id)} />
                ))}
              </div>
            </Panel>
          )}

          {p.identity.length > 0 && (
            <Panel title="Who you said you are" sub="Pulled from the moments you introduced yourself.">
              <div className="rows">
                {p.identity.map((f) => (
                  <Row key={f.id} f={f} meta={`said in ${f.convs} conversation${f.convs === 1 ? "" : "s"}`} onClick={() => toggle("identity", f.id)} />
                ))}
              </div>
            </Panel>
          )}

          {p.styleOrders.length > 0 && (
            <Panel title="How you talk" sub="Inferred from the shape of your messages, not their content.">
              <div className="rows">
                {p.styleOrders.map((f) => (
                  <Row key={f.id} f={f} meta="measured, not quoted" onClick={() => toggle("styleOrders", f.id)} />
                ))}
              </div>
              <div className="bars" style={{ marginTop: 16 }}>
                {p.style.map((s) => (
                  <div className="bar2" key={s.key}>
                    <span className="lab">{s.label}</span>
                    <span className="val">{s.display}</span>
                    <span className="track"><i style={{ width: `${Math.min(100, s.key === "len" ? Math.min(100, s.value) : s.value)}%` }} /></span>
                    <span className="note">{s.note}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {p.formats.length > 0 && (
            <Panel title="Shapes you ask for" sub="How you want answers laid out.">
              <div className="rows">
                {p.formats.map((f) => (
                  <Row key={f.id} f={f} meta={`asked in ${f.convs} conversations`} onClick={() => toggle("formats", f.id)} />
                ))}
              </div>
            </Panel>
          )}

          {p.stack.length > 0 && (
            <Panel title="Your stack" sub="Technologies you actually bring up, weighted by how many conversations they span.">
              <div className="chips">
                {p.stack.map((f) => (
                  <Chip key={f.id} f={f} onClick={() => toggle("stack", f.id)} />
                ))}
              </div>
            </Panel>
          )}

          {p.projects.length > 0 && (
            <Panel title="Names you keep returning to" sub="Recurring identifiers — usually projects, repos or people. Expect some noise.">
              <div className="chips">
                {p.projects.map((f) => (
                  <Chip key={f.id} f={f} onClick={() => toggle("projects", f.id)} />
                ))}
              </div>
            </Panel>
          )}

          {p.topics.length > 0 && (
            <Panel title="What you talk about" sub="Subjects spanning the most conversations.">
              <div className="chips">
                {p.topics.map((f) => (
                  <Chip key={f.id} f={f} onClick={() => toggle("topics", f.id)} />
                ))}
              </div>
            </Panel>
          )}
        </div>
      </section>

      <Output p={targets} />
    </div>
  );
}

function Panel({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      <p className="sub">{sub}</p>
      {children}
    </div>
  );
}

function Row({ f, meta, onClick }: { f: Fact; meta: string; onClick: () => void }) {
  return (
    <div className={`row ${f.on ? "on" : "off"}`} onClick={onClick} title={f.evidence || ""}>
      <span className="box">{f.on ? "✓" : ""}</span>
      <span>
        <span className="t">{f.text}</span>
        <span className="m">{meta}</span>
      </span>
    </div>
  );
}

function Chip({ f, onClick }: { f: Fact; onClick: () => void }) {
  return (
    <span className={`chip${f.on ? " on" : ""}`} onClick={onClick}>
      {f.text}<span className="n">{f.convs}</span>
    </span>
  );
}

/* --------------------------------- how-to --------------------------------- */

function HowTo() {
  return (
    <section className="section">
      <h2 className="shead">Getting your export takes two minutes</h2>
      <div className="how">
        <h4>Claude</h4>
        <ol>
          <li>Settings → Privacy → <code>Export data</code></li>
          <li>A link arrives by email, usually within a few minutes</li>
          <li>Drop the <code>.zip</code> straight in — no need to unzip it</li>
        </ol>
      </div>
      <div className="how">
        <h4>ChatGPT</h4>
        <ol>
          <li>Settings → Data controls → <code>Export data</code></li>
          <li>Confirm by email, then download the archive</li>
          <li>Drop the <code>.zip</code> in, or the <code>conversations.json</code> inside it</li>
        </ol>
      </div>
      <div className="how">
        <h4>Anything else</h4>
        <ol>
          <li>Drop any JSON export — DEFECT looks for message-shaped data and will usually find it</li>
          <li>Or hit <code>Paste text instead</code> and give it prose</li>
        </ol>
      </div>
    </section>
  );
}
