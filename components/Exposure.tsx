"use client";

import { useMemo, useState } from "react";
import { incidentReport, type Finding, type ScanResult, type Sev } from "@/lib/scan";
import type { Corpus } from "@/lib/types";

const nf = new Intl.NumberFormat("en-US");
const day = (t: number) =>
  t ? new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "unknown date";

const SEVS: Sev[] = ["critical", "high", "medium", "low"];
const SEV_LABEL: Record<Sev, string> = {
  critical: "Rotate today",
  high: "Rotate this week",
  medium: "Worth reviewing",
  low: "Context only",
};

function save(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Exposure({ r, corpus }: { r: ScanResult; corpus: Corpus }) {
  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const grouped = useMemo(
    () => SEVS.map((s) => [s, r.findings.filter((f) => f.sev === s)] as const).filter(([, g]) => g.length),
    [r]
  );

  const worst = r.bySev.critical + r.bySev.high;

  if (!r.findings.length) {
    return (
      <section className="section">
        <h2 className="shead">Exposure</h2>
        <div className="clean">
          <b>Nothing found.</b>
          <p>
            No credentials, card numbers or private keys turned up in your own messages. That is the
            result you want — though it only covers the patterns DEFECT knows about, and only what
            you typed, not what the model echoed back.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <h2 className="shead">What you pasted and forgot</h2>

      <div className={`alarm${worst ? " hot" : ""}`}>
        <b>{nf.format(r.findings.length)}</b>
        <p>
          {worst > 0 ? (
            <>
              <strong>{nf.format(worst)} of them are still worth acting on today.</strong> These are
              secrets and personal data found in messages <strong>you</strong> typed — sitting in a
              chat history that is synced, searchable, retained under someone else&apos;s policy, and
              readable by anyone who gets into your account.
            </>
          ) : (
            <>Nothing critical, but these are worth knowing about. All of it came from messages you typed.</>
          )}
        </p>
        <div className="sevrow">
          {SEVS.map((s) => (
            <span key={s} className={`pill ${s}`}>
              <i /> {r.bySev[s]} {s}
            </span>
          ))}
        </div>
      </div>

      {grouped.map(([sev, group]) => (
        <div key={sev} className="sevblock">
          <h3 className={`sevhead ${sev}`}>
            {SEV_LABEL[sev]} <span>{group.length}</span>
          </h3>
          <div className="rows">
            {group.map((f) => (
              <Card
                key={f.id}
                f={f}
                open={open === f.id}
                done={done.has(f.id)}
                onToggle={() => setOpen(open === f.id ? null : f.id)}
                onDone={() =>
                  setDone((prev) => {
                    const n = new Set(prev);
                    if (n.has(f.id)) n.delete(f.id); else n.add(f.id);
                    return n;
                  })
                }
              />
            ))}
          </div>
        </div>
      ))}

      <div className="actions" style={{ marginTop: 20 }}>
        <button className="btn primary" onClick={() => save("exposure-report.md", incidentReport(r, corpus))}>
          Download the report
        </button>
        <span className="progresslabel">
          {done.size} of {r.findings.length} marked handled
        </span>
      </div>

      <p className="where" style={{ marginTop: 18 }}>
        Secrets are shown redacted to the first and last four characters — DEFECT never renders a full
        credential, even locally. Search your own export for those fragments to confirm before you rotate anything.
      </p>
    </section>
  );
}

function Card({
  f, open, done, onToggle, onDone,
}: { f: Finding; open: boolean; done: boolean; onToggle: () => void; onDone: () => void }) {
  return (
    <div className={`finding ${f.sev}${done ? " done" : ""}`}>
      <div className="fbar" onClick={onToggle}>
        <span className="flabel">{f.label}</span>
        <code className="fval">{f.redacted}</code>
        <span className="fmeta">
          {f.count}× · first {day(f.firstAt)}
        </span>
        <span className="fchev">{open ? "−" : "+"}</span>
      </div>
      {open && (
        <div className="fbody">
          <p className="fadvice">{f.advice}</p>
          <div className="fctx">{f.context}</div>
          <p className="fwhere">
            First appeared in <strong>{f.convTitle}</strong> on {day(f.firstAt)}
            {f.convs > 1 ? `, and in ${f.convs} conversations in total` : ""}.
          </p>
          <div className="actions">
            {f.rotate && (
              <a className="btn primary" href={f.rotate} target="_blank" rel="noreferrer">
                Rotate it →
              </a>
            )}
            <button className="btn" onClick={onDone}>
              {done ? "Marked handled" : "Mark handled"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
