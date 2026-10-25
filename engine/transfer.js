// Getting your writing in and out. Your journal is yours: export is one click and the formats are plain.
import { isDate, pretty } from "./dates.js";
import { clean, entries } from "./journal.js";

export function toJSON(journal, now = new Date()) {
  return JSON.stringify({ app: "daybook", version: 1, exported: now.toISOString(), entries: Object.fromEntries(entries(journal).map((e) => [e.date, { text: e.text, updated: e.updated }])) }, null, 2);
}

export function fromJSON(text) {
  let o; try { o = JSON.parse(text); } catch { throw new Error("That file is not valid JSON."); }
  if (!o || o.app !== "daybook" || typeof o.entries !== "object") throw new Error("This does not look like a Daybook export.");
  return clean(o.entries);
}

/** Plain text, one dated heading per entry. Readable in any editor, and easy to paste into other journal apps. */
export function toText(journal) {
  return entries(journal).map((e) => `${e.date}\n${pretty(e.date)}\n\n${e.text.trim()}\n`).join("\n---\n\n");
}

/**
 * Read plain text exported from a journal. A new entry starts at any line that is just a date: 2024-03-05, or 5 March 2024,
 * or 05/03/2024 (day first). Lines before the first date are ignored. Dates that appear twice are joined.
 */
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export function parseDateLine(line) {
  const s = line.trim().replace(/^[#*\s]+|[*\s]+$/g, "");
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m && isDate(s)) return s;
  m = /^(?:[A-Za-z]+,?\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9}),?\s+(\d{4})$/.exec(s);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) { const d = `${m[3]}-${String(MONTHS[m[2].slice(0, 3).toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`; if (isDate(d)) return d; }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) { const d = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; if (isDate(d)) return d; }
  return null;
}
export function fromText(text) {
  const out = {}; let cur = null, buf = [];
  const flush = () => { if (cur) { const t = buf.join("\n").trim(); if (t) out[cur] = out[cur] ? { text: out[cur].text + "\n\n" + t, updated: "" } : { text: t, updated: "" }; } buf = []; };
  for (const line of String(text).replace(/\r\n?/g, "\n").split("\n")) {
    const d = parseDateLine(line);
    if (d) { flush(); cur = d; continue; }
    if (cur && /^---+$/.test(line.trim())) continue;
    if (cur && parseDateLine(line) === null) { buf.push(line); }
  }
  flush();
  // The weekday line our own export writes under each date is not part of the entry
  for (const [d, e] of Object.entries(out)) { const first = pretty(d); if (e.text.startsWith(first)) e.text = e.text.slice(first.length).trim(); if (!e.text) delete out[d]; }
  return clean(out);
}

/** mode "keep": entries already in your journal win. "append": both are kept, imported text goes below. */
export function merge(current, incoming, mode = "keep") {
  const out = { ...current }; let added = 0, joined = 0, skipped = 0;
  for (const [d, e] of Object.entries(incoming)) {
    if (!out[d]) { out[d] = e; added++; }
    else if (mode === "append" && out[d].text.trim() !== e.text.trim()) { out[d] = { text: out[d].text.trimEnd() + "\n\n" + e.text.trim(), updated: out[d].updated }; joined++; }
    else skipped++;
  }
  return { journal: out, added, joined, skipped };
}
