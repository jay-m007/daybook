import test from "node:test";
import assert from "node:assert/strict";
import { onThisDay, recentLookbacks, span } from "../engine/memories.js";
import { streaks, totals, monthGrid } from "../engine/stats.js";
const J = (...ds) => Object.fromEntries(ds.map((d) => [d, { text: "wrote " + d }]));

test("on this day finds earlier years, newest first, never this year", () => {
  const r = onThisDay(J("2025-10-25", "2023-10-25", "2026-10-25", "2025-10-24", "2024-11-25"), "2026-10-25");
  assert.deepEqual(r.map((x) => [x.date, x.yearsAgo]), [["2025-10-25", 1], ["2023-10-25", 3]]);
});
test("a 29 February entry shows on 28 February in a year without one, and on 29 February in a leap year", () => {
  assert.equal(onThisDay(J("2024-02-29"), "2025-02-28").length, 1);
  assert.equal(onThisDay(J("2024-02-29"), "2028-02-29").length, 1);
  assert.equal(onThisDay(J("2024-02-29"), "2028-02-28").length, 0, "leap year: it waits for the 29th");
  assert.equal(onThisDay(J("2024-02-29"), "2025-03-01").length, 0);
});
test("look backs use fixed day offsets and only return entries that exist", () => {
  const r = recentLookbacks(J("2026-10-18", "2026-09-25", "2026-07-27", "2026-10-01"), "2026-10-25");
  assert.deepEqual(r.map((x) => [x.label, x.date]), [["A week ago", "2026-10-18"], ["30 days ago", "2026-09-25"], ["90 days ago", "2026-07-27"]]);
});
test("span counts days since the first entry", () => {
  assert.equal(span({}, "2026-10-25"), null);
  assert.deepEqual(span(J("2026-10-20", "2026-10-25"), "2026-10-25"), { first: "2026-10-20", days: 6 });
});
test("streak: counts back from today, or from yesterday while today is still blank", () => {
  assert.deepEqual(streaks(J("2026-10-23", "2026-10-24", "2026-10-25"), "2026-10-25"), { current: 3, longest: 3, wroteToday: true });
  assert.equal(streaks(J("2026-10-23", "2026-10-24"), "2026-10-25").current, 2);
  assert.equal(streaks(J("2026-10-22", "2026-10-23"), "2026-10-25").current, 0, "missed yesterday: streak is over");
  assert.equal(streaks({}, "2026-10-25").longest, 0);
});
test("longest streak is found anywhere in history, across month and year ends", () => {
  const s = streaks(J("2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02", "2026-03-01"), "2026-10-25");
  assert.equal(s.longest, 4); assert.equal(s.current, 0);
});
test("totals", () => { assert.deepEqual(totals({ "2026-01-01": { text: "one two" }, "2026-01-02": { text: "three" } }), { entries: 2, words: 3 }); });
test("month grid starts on Monday, pads to full weeks, and marks entry sizes", () => {
  const j = { "2026-10-01": { text: "short" }, "2026-10-02": { text: "w ".repeat(50) }, "2026-10-03": { text: "w ".repeat(200) } };
  const g = monthGrid(j, 2026, 10); // 1 Oct 2026 is a Thursday
  assert.equal(g[0].findIndex((c) => c && c.day === 1), 3);
  assert.ok(g.every((w) => w.length === 7));
  const cells = g.flat().filter(Boolean); assert.equal(cells.length, 31);
  assert.deepEqual([1, 2, 3, 4].map((d) => cells[d - 1].size), [1, 2, 3, 0]);
  assert.equal(monthGrid({}, 2026, 2).flat().filter(Boolean).length, 28);
});
