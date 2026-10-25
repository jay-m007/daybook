// The journal is a plain object: { "2026-10-25": { text, updated } }. One entry per day, like the diary it replaces.
import { isDate } from "./dates.js";

export const MAX_ENTRY = 50000; // characters; keeps one runaway paste from filling the browser's storage

export function emptyJournal() { return {}; }

export function setEntry(journal, date, text, now = new Date()) {
  if (!isDate(date)) throw new Error("That is not a valid date.");
  const t = String(text ?? "").replace(/\r\n?/g, "\n").slice(0, MAX_ENTRY);
  const next = { ...journal };
  if (!t.trim()) delete next[date]; // an empty box means "no entry", not an entry of spaces
  else next[date] = { text: t, updated: now.toISOString() };
  return next;
}

export function entries(journal) {
  return Object.keys(journal).filter(isDate).sort().map((date) => ({ date, text: journal[date].text, updated: journal[date].updated }));
}

export const wordCount = (text) => (String(text).trim().match(/[\p{L}\p{M}\p{N}'’-]+/gu) || []).length;

/** Remove anything that is not a valid {date: {text}} (used after loading from storage or an import). */
export function clean(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [d, e] of Object.entries(raw)) {
    if (!isDate(d) || !e || typeof e.text !== "string" || !e.text.trim()) continue;
    out[d] = { text: e.text.replace(/\r\n?/g, "\n").slice(0, MAX_ENTRY), updated: typeof e.updated === "string" ? e.updated : "" };
  }
  return out;
}
