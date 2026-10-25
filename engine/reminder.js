// A daily "write today's entry" reminder as a calendar file: any phone calendar can then ring at your time every day, with the page closed.
const pad = (n) => String(n).padStart(2, "0");
export function buildReminderICS({ hour = 21, minute = 0, now = new Date(), start } = {}) {
  hour = Math.min(23, Math.max(0, Math.trunc(hour) || 0)); minute = Math.min(59, Math.max(0, Math.trunc(minute) || 0));
  const d = start || `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Daybook//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:daybook-daily-${hour}${pad(minute)}@daybook`, `DTSTAMP:${stamp}`,
    `DTSTART:${d}T${pad(hour)}${pad(minute)}00`, "DTEND:" + d + "T" + pad(hour) + pad(minute + 5 > 59 ? 59 : minute + 5) + "00",
    "RRULE:FREQ=DAILY", "SUMMARY:How was your day?", "DESCRIPTION:Open Daybook and write today's entry. Two lines is enough.",
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:How was your day?", "TRIGGER:PT0S", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
