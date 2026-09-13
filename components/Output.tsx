"use client";

import { useMemo, useRef, useState } from "react";
import { compile, packText } from "@/lib/compile";
import type { Profile } from "@/lib/types";

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Output({ p }: { p: Profile }) {
  const targets = useMemo(() => compile(p), [p]);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState("");
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [lens, setLens] = useState<number[]>([]);

  const t = targets[active];
  // reset the editable buffers whenever the compiled content changes
  const stamp = useMemo(() => t.fields.map((f) => f.text.length).join("-") + "|" + t.id, [t]);

  const copy = async (i: number, fallback: string) => {
    const text = refs.current[i]?.value ?? fallback;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      refs.current[i]?.select();
      document.execCommand("copy");
    }
    setCopied(`${t.id}-${i}`);
    setTimeout(() => setCopied(""), 1600);
  };

  const currentText = () =>
    t.fields.length === 1
      ? refs.current[0]?.value ?? t.fields[0].text
      : t.fields.map((f, i) => `### ${f.name}\n\n${refs.current[i]?.value ?? f.text}`).join("\n\n");

  return (
    <section className="section">
      <h2 className="shead">Take it with you</h2>

      <div className="tabs">
        {targets.map((x, i) => (
          <button key={x.id} className={`tab${i === active ? " on" : ""}`} onClick={() => { setActive(i); setLens([]); }}>
            {x.label}
          </button>
        ))}
      </div>

      <p className="where">{t.where}</p>

      {t.fields.map((f, i) => {
        const len = lens[i] ?? f.text.length;
        const over = f.limit ? len > f.limit : false;
        return (
          <div className="field" key={`${stamp}-${i}`}>
            <div className="fhead">
              <span className="fname">{f.name}</span>
              <span className={`count${over ? " over" : ""}`}>
                {len.toLocaleString()}{f.limit ? ` / ${f.limit.toLocaleString()}` : ""}
              </span>
            </div>
            <textarea
              ref={(el) => { refs.current[i] = el; }}
              defaultValue={f.text}
              spellCheck={false}
              rows={f.text.split("\n").length > 18 ? 22 : 10}
              onChange={(e) => setLens((prev) => { const n = [...prev]; n[i] = e.target.value.length; return n; })}
            />
            <div className="actions" style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={() => void copy(i, f.text)}>
                {copied === `${t.id}-${i}` ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        );
      })}

      <div className="actions" style={{ marginTop: 18 }}>
        <button
          className="btn"
          onClick={() => download(t.ext ? `${t.id === "claudemd" ? "CLAUDE" : t.id === "agents" ? "AGENTS" : "context"}.${t.ext}` : ".cursorrules", currentText())}
        >
          Download this file
        </button>
        <button
          className="btn"
          onClick={() =>
            download(
              "defect-context-pack.md",
              [
                "# Context pack",
                `Compiled by DEFECT from ${p.convCount} conversations (${p.source}) on ${new Date().toLocaleDateString()}.`,
                "",
                ...targets.map((x) => `\n---\n\n## ${x.label}\n_${x.where}_\n\n${packText(x)}`),
              ].join("\n")
            )
          }
        >
          Download every format
        </button>
      </div>
    </section>
  );
}
