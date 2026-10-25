import test from "node:test";
import assert from "node:assert/strict";
import { isDate, addDays, daysBetween, today, isLeap, daysInMonth, pretty } from "../engine/dates.js";
import { setEntry, entries, wordCount, clean, MAX_ENTRY } from "../engine/journal.js";

test("dates: validity, arithmetic across month and year ends", () => {
  assert.ok(isDate("2024-02-29")); assert.ok(!isDate("2025-02-29")); assert.ok(!isDate("2025-13-01")); assert.ok(!isDate("2025-1-1")); assert.ok(!isDate(null));
  assert.equal(addDays("2025-12-31", 1), "2026-01-01");
  assert.equal(addDays("2024-03-01", -1), "2024-02-29");
  assert.equal(daysBetween("2025-10-25", "2026-10-25"), 365);
  assert.equal(daysBetween("2024-10-25", "2025-10-25"), 365);
  assert.equal(daysBetween("2023-10-25", "2024-10-25"), 366);
  assert.ok(isLeap(2000)); assert.ok(!isLeap(1900)); assert.equal(daysInMonth(2024, 2), 29); assert.equal(daysInMonth(2025, 2), 28);
});
test("today uses the device's own calendar day", () => {
  assert.equal(today(new Date(2026, 9, 25, 23, 59)), "2026-10-25");
  assert.equal(today(new Date(2026, 0, 1, 0, 0)), "2026-01-01");
});
test("pretty names the weekday", () => { assert.equal(pretty("2026-10-25"), "Sunday, 25 October 2026"); });

test("setEntry stores, replaces and removes", () => {
  const now = new Date("2026-10-25T10:00:00Z");
  let j = setEntry({}, "2026-10-25", "Hello", now);
  assert.equal(j["2026-10-25"].text, "Hello"); assert.equal(j["2026-10-25"].updated, now.toISOString());
  j = setEntry(j, "2026-10-25", "Hello again", now); assert.equal(Object.keys(j).length, 1); assert.equal(j["2026-10-25"].text, "Hello again");
  j = setEntry(j, "2026-10-25", "   \n ", now); assert.deepEqual(j, {}, "a blank box removes the entry");
});
test("setEntry does not change the object it was given", () => {
  const a = Object.freeze({ "2026-01-01": { text: "x", updated: "" } });
  const b = setEntry(a, "2026-01-02", "y"); assert.equal(Object.keys(a).length, 1); assert.equal(Object.keys(b).length, 2);
});
test("setEntry rejects bad dates and caps huge entries and normalises line endings", () => {
  assert.throws(() => setEntry({}, "2026-02-30", "x"));
  assert.equal(setEntry({}, "2026-01-01", "a".repeat(MAX_ENTRY + 500))["2026-01-01"].text.length, MAX_ENTRY);
  assert.equal(setEntry({}, "2026-01-01", "a\r\nb\rc")["2026-01-01"].text, "a\nb\nc");
});
test("entries are sorted oldest first and ignore junk keys", () => {
  const j = { "2026-03-01": { text: "b" }, "2025-01-01": { text: "a" }, junk: { text: "z" } };
  assert.deepEqual(entries(j).map((e) => e.date), ["2025-01-01", "2026-03-01"]);
});
test("word count handles apostrophes, hyphens, digits and other scripts", () => {
  assert.equal(wordCount("I didn't go to the well-known café"), 7);
  assert.equal(wordCount("  "), 0); assert.equal(wordCount("आज का दिन अच्छा था"), 5); assert.equal(wordCount("5 km run"), 3);
});
test("clean drops anything that is not a dated, non-empty text entry", () => {
  const c = clean({ "2026-01-01": { text: "ok", updated: "u" }, "2026-02-31": { text: "bad date" }, "2026-01-02": { text: "  " }, "2026-01-03": "str", "2026-01-04": { text: 5 }, "2026-01-05": null });
  assert.deepEqual(Object.keys(c), ["2026-01-01"]);
  assert.deepEqual(clean(null), {}); assert.deepEqual(clean([1, 2]), {}); assert.deepEqual(clean("x"), {});
});
