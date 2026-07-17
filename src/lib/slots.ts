import type { Slot } from "@/types";

// ─── Legal calling grid (France, Métropole) ────────────────────────────────
// Bounds reflect the framework in force as of 2025.
// Post-11/08/2026 decree may revise these values; update SLOT_BOUNDS only —
// enum values must NOT be renamed (historical records must stay readable).

export const SLOT_BOUNDS: Record<Slot, { startH: number; endH: number }> = {
  MATIN: { startH: 10, endH: 13 },
  DEBUT_APREM: { startH: 14, endH: 17 },
  FIN_APREM: { startH: 17, endH: 20 },
};

const SLOT_ORDER: Slot[] = ["MATIN", "DEBUT_APREM", "FIN_APREM"];

// ─── Public holidays (France Métropole) ────────────────────────────────────

function easterSunday(year: number): Date {
  // Anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns the set of public holiday dates for a given year as "YYYY-MM-DD" keys. */
export function getPublicHolidays(year: number): Set<string> {
  const fixed = [
    `${year}-01-01`, // Jour de l'An
    `${year}-05-01`, // Fête du Travail
    `${year}-05-08`, // Victoire 1945
    `${year}-07-14`, // Fête Nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice
    `${year}-12-25`, // Noël
  ];
  const easter = easterSunday(year);
  const variable = [
    addDays(easter, 1), // Lundi de Pâques
    addDays(easter, 39), // Ascension
    addDays(easter, 50), // Lundi de Pentecôte
  ].map(toLocalDateKey);
  return new Set([...fixed, ...variable]);
}

function isWeekend(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

function isPublicHoliday(date: Date, cache?: Set<string>): boolean {
  const holidays = cache ?? getPublicHolidays(date.getFullYear());
  return holidays.has(toLocalDateKey(date));
}

function isLegalDay(date: Date, cache?: Set<string>): boolean {
  return !isWeekend(date) && !isPublicHoliday(date, cache);
}

// ─── Public API ────────────────────────────────────────────────────────────

/** Returns the active Slot at `date`, or null if outside legal calling hours. */
export function getCurrentSlot(date: Date): Slot | null {
  if (!isLegalDay(date)) return null;
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  for (const slot of SLOT_ORDER) {
    const { startH, endH } = SLOT_BOUNDS[slot];
    if (minuteOfDay >= startH * 60 && minuteOfDay < endH * 60) return slot;
  }
  return null;
}

/** Returns true when `date` falls within any legal calling window. */
export function isWithinLegalWindow(date: Date): boolean {
  return getCurrentSlot(date) !== null;
}

/**
 * Returns the start of the next legal calling window strictly after `date`.
 * Skips evenings, weekends, and FR public holidays (up to 14 days forward).
 */
export function nextLegalWindow(date: Date): Date {
  const candidate = new Date(date);
  // Pre-cache holidays for current and next year to avoid repeated computation
  const holidayCache = new Map<number, Set<string>>();
  const holidays = (year: number) => {
    if (!holidayCache.has(year)) holidayCache.set(year, getPublicHolidays(year));
    return holidayCache.get(year)!;
  };

  for (let iter = 0; iter < 14 * 3; iter++) {
    if (isLegalDay(candidate, holidays(candidate.getFullYear()))) {
      for (const slot of SLOT_ORDER) {
        const { startH } = SLOT_BOUNDS[slot];
        const slotStart = new Date(candidate);
        slotStart.setHours(startH, 0, 0, 0);
        if (slotStart > date) return slotStart;
      }
    }
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(0, 0, 0, 0);
  }

  throw new Error("nextLegalWindow: no legal window found within 14 days");
}
