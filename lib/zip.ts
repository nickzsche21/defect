/* A minimal ZIP reader, so people can drop the .zip the AI vendor gave them
   instead of digging conversations.json out of it. Inflate comes from the
   platform (DecompressionStream), so there is no dependency. */

type Entry = { name: string; method: number; size: number; offset: number };

const EOCD = 0x06054b50;
const CEN = 0x02014b50;

function findEocd(v: DataView): number {
  const min = Math.max(0, v.byteLength - 66_000);
  for (let i = v.byteLength - 22; i >= min; i--) {
    if (v.getUint32(i, true) === EOCD) return i;
  }
  return -1;
}

function listEntries(buf: ArrayBuffer): Entry[] {
  const v = new DataView(buf);
  const eocd = findEocd(v);
  if (eocd < 0) throw new Error("Not a ZIP file");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out: Entry[] = [];
  const dec = new TextDecoder();
  for (let i = 0; i < count && p + 46 <= v.byteLength; i++) {
    if (v.getUint32(p, true) !== CEN) break;
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 24, true);
    const nLen = v.getUint16(p + 28, true);
    const eLen = v.getUint16(p + 30, true);
    const cLen = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nLen));
    out.push({ name, method, size, offset });
    p += 46 + nLen + eLen + cLen;
  }
  return out;
}

async function readEntry(buf: ArrayBuffer, e: Entry): Promise<string> {
  const v = new DataView(buf);
  if (v.getUint32(e.offset, true) !== 0x04034b50) throw new Error("Bad local header");
  const nLen = v.getUint16(e.offset + 26, true);
  const eLen = v.getUint16(e.offset + 28, true);
  const start = e.offset + 30 + nLen + eLen;
  // compressed size in the central dir can be 0 when a data descriptor is used;
  // reading to the end of the buffer is safe because inflate stops at the stream end.
  const raw = new Uint8Array(buf, start);
  if (e.method === 0) return new TextDecoder().decode(raw.subarray(0, e.size));
  if (e.method !== 8) throw new Error(`Unsupported compression (${e.method})`);
  const stream = new Blob([raw as unknown as BlobPart]).stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

/** Pull the most conversation-shaped JSON out of an export zip. */
export async function extractConversationsJson(file: File): Promise<{ name: string; text: string }> {
  const buf = await file.arrayBuffer();
  const entries = listEntries(buf).filter(
    (e) => e.name.toLowerCase().endsWith(".json") && !e.name.startsWith("__MACOSX")
  );
  if (!entries.length) throw new Error("No JSON inside that zip");

  const score = (n: string) => {
    const base = n.toLowerCase().split("/").pop() || "";
    if (base === "conversations.json") return 100;
    if (base.includes("conversation")) return 80;
    if (base.includes("chat")) return 60;
    if (base.includes("message")) return 50;
    if (base === "users.json" || base.includes("user")) return 1;
    return 10;
  };
  entries.sort((a, b) => score(b.name) - score(a.name) || b.size - a.size);

  for (const e of entries.slice(0, 4)) {
    try {
      const text = await readEntry(buf, e);
      if (text.trim().length > 2) return { name: e.name, text };
    } catch { /* try the next candidate */ }
  }
  throw new Error("Could not read the JSON inside that zip");
}
