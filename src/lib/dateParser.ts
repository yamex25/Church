/**
 * Parses natural language date/time expressions from user questions.
 * Covers specific dates, month+year, year-only, day-of-week, and relative terms.
 */

export interface ParsedPeriod {
  label: string;                        // Human-readable: "22 July 2026"
  filter: (dateStr: string) => boolean; // Matches YYYY-MM-DD strings
  isAllTime: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const MONTH_MAP: Record<string, number> = {
  january: 1,  jan: 1,
  february: 2, feb: 2,
  march: 3,    mar: 3,
  april: 4,    apr: 4,
  may: 5,
  june: 6,     jun: 6,
  july: 7,     jul: 7,
  august: 8,   aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function monthYearLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function dateLabel(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function allTime(): ParsedPeriod {
  return { label: 'all time', filter: () => true, isAllTime: true };
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parsePeriod(raw: string): ParsedPeriod {
  const q = raw.toLowerCase().trim();
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1; // 1-indexed

  // ── Slash date: DD/MM/YYYY ─────────────────────────────────────────────────
  const slashMatch = q.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashMatch) {
    const d = parseInt(slashMatch[1]);
    const m = parseInt(slashMatch[2]);
    const y = parseInt(slashMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const ds = `${y}-${pad(m)}-${pad(d)}`;
      return { label: dateLabel(y, m, d), filter: s => s.startsWith(ds), isAllTime: false };
    }
  }

  // ── ISO date: YYYY-MM-DD ───────────────────────────────────────────────────
  const isoMatch = q.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const ds = isoMatch[0];
    const [y, m, d] = ds.split('-').map(Number);
    return { label: dateLabel(y, m, d), filter: s => s.startsWith(ds), isAllTime: false };
  }

  // ── Month name (with optional day and/or year) ─────────────────────────────
  // Try longest month names first to avoid "mar" matching inside "march"
  const monthEntries = Object.entries(MONTH_MAP).sort((a, b) => b[0].length - a[0].length);

  for (const [name, monthNum] of monthEntries) {
    // Avoid "may" matching as a modal verb: "we may have", "may not", "may be"
    if (name === 'may' && /\bmay\s+(be|have|not|need|want|also|still|get|already|consider|ask)\b/.test(q)) {
      continue;
    }
    if (!new RegExp(`\\b${name}\\b`).test(q)) continue;

    const yearMatch = q.match(/\b(20\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1]) : thisYear;

    // Try to find a day number adjacent to the month name
    const beforeRe = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:the\\s+)?\\b${name}\\b`);
    const afterRe  = new RegExp(`\\b${name}\\b\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?`);

    const beforeM = beforeRe.exec(q);
    const afterM  = afterRe.exec(q);
    const dayStr  = beforeM?.[1] ?? afterM?.[1];

    if (dayStr) {
      const day = parseInt(dayStr);
      if (day >= 1 && day <= 31) {
        const ds = `${year}-${pad(monthNum)}-${pad(day)}`;
        return { label: dateLabel(year, monthNum, day), filter: s => s.startsWith(ds), isAllTime: false };
      }
    }

    // Month + year (no specific day)
    const ym = `${year}-${pad(monthNum)}`;
    return {
      label: monthYearLabel(year, monthNum),
      filter: s => s.startsWith(ym),
      isAllTime: false,
    };
  }

  // ── Day of week ────────────────────────────────────────────────────────────
  for (let i = 0; i < DAYS_OF_WEEK.length; i++) {
    const day = DAYS_OF_WEEK[i];
    if (!new RegExp(`\\b${day}\\b`).test(q)) continue;

    const isLast = /\blast\b/.test(q);
    const isThis = /\bthis\b/.test(q);
    const target = new Date(now);
    const todayDow = now.getDay(); // 0 = Sunday

    let diff = todayDow - i;
    if (diff < 0) diff += 7;
    // If today IS that day and neither "this" nor "last" is specified, use today
    // If "last" is specified, always go back one week
    if (isLast && diff === 0) diff = 7;
    // "this sunday" when today is Sunday → today
    // "sunday" with no qualifier and today is sunday → today (diff=0)

    target.setDate(target.getDate() - diff);
    const ds = target.toISOString().slice(0, 10);
    const label = `${day.charAt(0).toUpperCase() + day.slice(1)}, ${target.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    return { label, filter: s => s.startsWith(ds), isAllTime: false };
  }

  // ── Specific 4-digit year ─────────────────────────────────────────────────
  const yearOnlyMatch = q.match(/\b(20\d{2})\b/);
  if (yearOnlyMatch) {
    const yr = yearOnlyMatch[1];
    return { label: `year ${yr}`, filter: s => s.startsWith(yr), isAllTime: false };
  }

  // ── last year / previous year ─────────────────────────────────────────────
  if (/last year|previous year/.test(q)) {
    const yr = String(thisYear - 1);
    return { label: yr, filter: s => s.startsWith(yr), isAllTime: false };
  }

  // ── this year / current year ──────────────────────────────────────────────
  if (/this year|current year/.test(q)) {
    const yr = String(thisYear);
    return { label: yr, filter: s => s.startsWith(yr), isAllTime: false };
  }

  // ── last month / previous month ───────────────────────────────────────────
  if (/last month|previous month/.test(q)) {
    const d = new Date(thisYear, thisMonth - 2, 1);
    const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    return {
      label: monthYearLabel(d.getFullYear(), d.getMonth() + 1),
      filter: s => s.startsWith(ym),
      isAllTime: false,
    };
  }

  // ── this month / current month ────────────────────────────────────────────
  if (/this month|current month/.test(q)) {
    const ym = `${thisYear}-${pad(thisMonth)}`;
    return { label: monthYearLabel(thisYear, thisMonth), filter: s => s.startsWith(ym), isAllTime: false };
  }

  // ── this week ─────────────────────────────────────────────────────────────
  if (/this week/.test(q)) {
    const sun = new Date(now);
    sun.setDate(now.getDate() - now.getDay());
    const sat = new Date(sun);
    sat.setDate(sun.getDate() + 6);
    const start = sun.toISOString().slice(0, 10);
    const end   = sat.toISOString().slice(0, 10);
    return { label: 'this week', filter: s => s >= start && s <= end, isAllTime: false };
  }

  // ── today ─────────────────────────────────────────────────────────────────
  if (/\btoday\b/.test(q)) {
    const td = now.toISOString().slice(0, 10);
    return { label: 'today', filter: s => s.startsWith(td), isAllTime: false };
  }

  // ── yesterday ─────────────────────────────────────────────────────────────
  if (/\byesterday\b/.test(q)) {
    const yd = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
    return { label: 'yesterday', filter: s => s.startsWith(yd), isAllTime: false };
  }

  return allTime();
}

/**
 * Returns a short human-readable description of what date/period was
 * detected in a text. Returns null if nothing was detected.
 */
export function describePeriod(text: string): string | null {
  const p = parsePeriod(text);
  return p.isAllTime ? null : p.label;
}
