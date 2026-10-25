// Calendar dates as "YYYY-MM-DD" strings. All arithmetic is done in UTC so daylight saving never shifts a day.
const RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export function isDate(s) {
  const m = RE.exec(String(s)); if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}
export const toDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const fmt = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
export const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-12
/** Today on the device's own clock (not UTC, which is still "yesterday" for part of the night in India). */
export function today(now = new Date()) { const p = (n) => String(n).padStart(2, "0"); return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`; }
const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const monthName = (m) => MON[m - 1];
export const pretty = (s) => { const d = toDate(s); return `${DAY[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const prettyShort = (s) => { const d = toDate(s); return `${d.getUTCDate()} ${MON[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`; };
