import { describe, it, expect } from "vitest";
import {
  getCurrentSlot,
  isWithinLegalWindow,
  nextLegalWindow,
  getPublicHolidays,
  SLOT_BOUNDS,
} from "@/lib/slots";

// Helpers: build a local Date for a given weekday/time
// Monday 2026-06-22 is a confirmed weekday (not a holiday)
function mon(h: number, m = 0): Date {
  return new Date(2026, 5, 22, h, m, 0, 0); // June 22 2026 (Mon)
}
function sat(h: number, m = 0): Date {
  return new Date(2026, 5, 27, h, m, 0, 0); // June 27 2026 (Sat)
}

// ─── SLOT_BOUNDS ────────────────────────────────────────────────────────────

describe("SLOT_BOUNDS", () => {
  it("MATIN spans 10h-13h", () => {
    expect(SLOT_BOUNDS.MATIN).toEqual({ startH: 10, endH: 13 });
  });
  it("DEBUT_APREM spans 14h-17h", () => {
    expect(SLOT_BOUNDS.DEBUT_APREM).toEqual({ startH: 14, endH: 17 });
  });
  it("FIN_APREM spans 17h-20h", () => {
    expect(SLOT_BOUNDS.FIN_APREM).toEqual({ startH: 17, endH: 20 });
  });
});

// ─── getCurrentSlot ─────────────────────────────────────────────────────────

describe("getCurrentSlot", () => {
  it("returns MATIN at 10:00", () => expect(getCurrentSlot(mon(10))).toBe("MATIN"));
  it("returns MATIN at 12:59", () => expect(getCurrentSlot(mon(12, 59))).toBe("MATIN"));
  it("returns null at 13:00 (gap start)", () => expect(getCurrentSlot(mon(13))).toBeNull());
  it("returns null at 13:30", () => expect(getCurrentSlot(mon(13, 30))).toBeNull());
  it("returns DEBUT_APREM at 14:00", () => expect(getCurrentSlot(mon(14))).toBe("DEBUT_APREM"));
  it("returns DEBUT_APREM at 16:59", () => expect(getCurrentSlot(mon(16, 59))).toBe("DEBUT_APREM"));
  it("returns FIN_APREM at 17:00", () => expect(getCurrentSlot(mon(17))).toBe("FIN_APREM"));
  it("returns FIN_APREM at 19:59", () => expect(getCurrentSlot(mon(19, 59))).toBe("FIN_APREM"));
  it("returns null at 20:00 (after last slot)", () => expect(getCurrentSlot(mon(20))).toBeNull());
  it("returns null at 09:59 (before first slot)", () =>
    expect(getCurrentSlot(mon(9, 59))).toBeNull());
  it("returns null on Saturday", () => expect(getCurrentSlot(sat(11))).toBeNull());
  it("returns null on Sunday", () => {
    const sun = new Date(2026, 5, 28, 11, 0, 0, 0); // June 28 2026 (Sun)
    expect(getCurrentSlot(sun)).toBeNull();
  });
});

// ─── Public holidays ────────────────────────────────────────────────────────

describe("getPublicHolidays", () => {
  it("includes fixed holidays for 2026", () => {
    const h = getPublicHolidays(2026);
    expect(h.has("2026-01-01")).toBe(true);
    expect(h.has("2026-05-01")).toBe(true);
    expect(h.has("2026-05-08")).toBe(true);
    expect(h.has("2026-07-14")).toBe(true);
    expect(h.has("2026-08-15")).toBe(true);
    expect(h.has("2026-11-01")).toBe(true);
    expect(h.has("2026-11-11")).toBe(true);
    expect(h.has("2026-12-25")).toBe(true);
  });

  it("includes Easter-based holidays for 2026 (Easter = April 5)", () => {
    // 2026 Easter Sunday = April 5
    const h = getPublicHolidays(2026);
    expect(h.has("2026-04-06")).toBe(true); // Lundi de Pâques
    expect(h.has("2026-05-14")).toBe(true); // Ascension (+39)
    expect(h.has("2026-05-25")).toBe(true); // Lundi de Pentecôte (+50)
  });

  it("getCurrentSlot returns null on a public holiday (2026-05-01 at 11h)", () => {
    const labourDay = new Date(2026, 4, 1, 11, 0, 0, 0); // May 1 2026
    expect(getCurrentSlot(labourDay)).toBeNull();
  });

  it("getCurrentSlot returns null on 2026-07-14 at 15h (Fête Nationale)", () => {
    const bastille = new Date(2026, 6, 14, 15, 0, 0, 0);
    expect(getCurrentSlot(bastille)).toBeNull();
  });
});

// ─── isWithinLegalWindow ────────────────────────────────────────────────────

describe("isWithinLegalWindow", () => {
  it("true during MATIN on weekday", () => expect(isWithinLegalWindow(mon(11))).toBe(true));
  it("false during lunch gap", () => expect(isWithinLegalWindow(mon(13, 30))).toBe(false));
  it("false on Saturday", () => expect(isWithinLegalWindow(sat(11))).toBe(false));
  it("false at 20:00", () => expect(isWithinLegalWindow(mon(20))).toBe(false));
});

// ─── nextLegalWindow ────────────────────────────────────────────────────────

describe("nextLegalWindow", () => {
  it("returns next slot boundary within same day when before MATIN", () => {
    const result = nextLegalWindow(mon(8)); // 08:00 Monday
    expect(result.getHours()).toBe(10);
    expect(result.getDate()).toBe(22); // same day
  });

  it("returns DEBUT_APREM when in gap after MATIN", () => {
    const result = nextLegalWindow(mon(13, 30)); // 13:30 Monday
    expect(result.getHours()).toBe(14);
    expect(result.getDate()).toBe(22);
  });

  it("jumps to next day MATIN when called after FIN_APREM", () => {
    const result = nextLegalWindow(mon(20, 30)); // 20:30 Monday
    // Next legal window is Tuesday 10:00
    expect(result.getHours()).toBe(10);
    expect(result.getDate()).toBe(23); // Tuesday June 23
  });

  it("skips weekend: Friday evening → Monday MATIN", () => {
    const fri = new Date(2026, 5, 26, 21, 0, 0, 0); // Friday June 26 21:00
    const result = nextLegalWindow(fri);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getHours()).toBe(10);
  });

  it("skips public holiday: Dec 24 evening → Dec 26 MATIN (Dec 25 is Noël)", () => {
    const xmasEve = new Date(2026, 11, 24, 21, 0, 0, 0); // Thu Dec 24 21:00
    const result = nextLegalWindow(xmasEve);
    // Dec 25 is holiday → next legal day is Mon Dec 28 (Dec 26 Sat, Dec 27 Sun)
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(11); // December
    expect(result.getDate()).toBe(28);
    expect(result.getHours()).toBe(10);
  });
});
