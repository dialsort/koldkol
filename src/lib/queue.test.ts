import { describe, it, expect, vi, beforeEach } from "vitest";
import { getNextProspect } from "@/lib/queue";

// ─── Mock Prisma ────────────────────────────────────────────────────────────

const mockCampaignFindUnique = vi.fn();
const mockProspectFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findUnique: () => mockCampaignFindUnique() },
    prospect: { findMany: () => mockProspectFindMany() },
  },
}));

// Monday 2026-06-22 11:00 — legal window (MATIN)
const LEGAL_NOW = new Date(2026, 5, 22, 11, 0, 0, 0);
// Saturday 2026-06-27 11:00 — outside legal window
const WEEKEND_NOW = new Date(2026, 5, 27, 11, 0, 0, 0);

const CAMPAIGN = {
  accountId: "acc1",
  prospectLists: [{ prospectListId: "list1" }],
};

function makeProspect(
  id: string,
  overrides: {
    slotStats?: { slot: string; attempts: number; humanAnswers: number }[];
    callAttempts?: {
      startedAt: Date;
      result: string | null;
      slot?: string;
      callbackAt: Date | null;
      disposition: { behavior: string } | null;
    }[];
  } = {}
) {
  return {
    id,
    phoneNumber: `+3360000000${id}`,
    slotStats: overrides.slotStats ?? [],
    callAttempts: overrides.callAttempts ?? [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCampaignFindUnique.mockResolvedValue(CAMPAIGN);
});

// ─── Outside legal window ───────────────────────────────────────────────────

describe("outside legal window", () => {
  it("returns outside_window on weekend", async () => {
    const result = await getNextProspect("c1", WEEKEND_NOW);
    expect(result.kind).toBe("outside_window");
    if (result.kind === "outside_window") {
      expect(result.nextWindow).toBeInstanceOf(Date);
      expect(result.nextWindow > WEEKEND_NOW).toBe(true);
      expect(result.reason).toBe("legal_hours");
    }
  });

  it("returns outside_window at 13:30 (gap between slots)", async () => {
    const gap = new Date(2026, 5, 22, 13, 30, 0, 0);
    const result = await getNextProspect("c1", gap);
    expect(result.kind).toBe("outside_window");
  });
});

// ─── No eligible prospects ──────────────────────────────────────────────────

describe("no eligible prospects", () => {
  it("returns outside_window when prospect list is empty", async () => {
    mockProspectFindMany.mockResolvedValue([]);
    const result = await getNextProspect("c1", LEGAL_NOW);
    expect(result.kind).toBe("outside_window");
  });
});

// ─── Wave ceiling (3 per campaign) ─────────────────────────────────────────

describe("wave ceiling", () => {
  it("excludes a prospect with 3 completed attempts (all waves done)", async () => {
    const atCeiling = makeProspect("p1", {
      callAttempts: [
        { startedAt: new Date(), result: "NO_ANSWER", slot: "MATIN", callbackAt: null, disposition: null },
        { startedAt: new Date(), result: "VOICEMAIL", slot: "DEBUT_APREM", callbackAt: null, disposition: null },
        { startedAt: new Date(), result: "NO_ANSWER", slot: "FIN_APREM", callbackAt: null, disposition: null },
      ],
    });

    mockProspectFindMany.mockResolvedValue([atCeiling]);
    const result = await getNextProspect("c1", LEGAL_NOW);
    expect(result.kind).toBe("outside_window");
  });

  it("allows a prospect with 2 completed attempts (eligible for wave 3)", async () => {
    const belowCeiling = makeProspect("p1", {
      callAttempts: [
        { startedAt: new Date(), result: "NO_ANSWER", slot: "DEBUT_APREM", callbackAt: null, disposition: null },
        { startedAt: new Date(), result: "VOICEMAIL", slot: "FIN_APREM", callbackAt: null, disposition: null },
      ],
    });

    mockProspectFindMany.mockResolvedValue([belowCeiling]);
    const result = await getNextProspect("c1", LEGAL_NOW); // MATIN slot — not yet used
    expect(result.kind).toBe("prospect");
    if (result.kind === "prospect") {
      expect(result.prospect.waveNumber).toBe(3);
    }
  });
});

// ─── Wave slot constraint ────────────────────────────────────────────────────

describe("wave slot constraint", () => {
  it("skips a prospect already called in the current slot", async () => {
    const calledThisSlot = makeProspect("p1", {
      callAttempts: [
        { startedAt: new Date(), result: "NO_ANSWER", slot: "MATIN", callbackAt: null, disposition: null },
      ],
    });

    mockProspectFindMany.mockResolvedValue([calledThisSlot]);
    // LEGAL_NOW is MATIN — prospect was already called in MATIN
    const result = await getNextProspect("c1", LEGAL_NOW);
    expect(result.kind).toBe("outside_window");
    if (result.kind === "outside_window") {
      expect(result.reason).toBe("wave_done");
    }
  });

  it("allows a prospect called in a different slot", async () => {
    const calledOtherSlot = makeProspect("p1", {
      callAttempts: [
        { startedAt: new Date(), result: "NO_ANSWER", slot: "DEBUT_APREM", callbackAt: null, disposition: null },
      ],
    });

    mockProspectFindMany.mockResolvedValue([calledOtherSlot]);
    // LEGAL_NOW is MATIN — different from DEBUT_APREM → eligible
    const result = await getNextProspect("c1", LEGAL_NOW);
    expect(result.kind).toBe("prospect");
    if (result.kind === "prospect") {
      expect(result.prospect.waveNumber).toBe(2);
    }
  });
});

// ─── Terminal results ────────────────────────────────────────────────────────

describe("terminal results", () => {
  it("excludes a prospect who answered (HUMAN_ANSWERED)", async () => {
    const answered = makeProspect("p1", {
      callAttempts: [
        { startedAt: new Date(), result: "HUMAN_ANSWERED", slot: "DEBUT_APREM", callbackAt: null, disposition: null },
      ],
    });

    mockProspectFindMany.mockResolvedValue([answered]);
    const result = await getNextProspect("c1", LEGAL_NOW);
    expect(result.kind).toBe("outside_window");
  });

  it("excludes a prospect with ANSWERED_NOT_TAKEN (counted as answered for wave purposes)", async () => {
    const notTaken = makeProspect("p1", {
      callAttempts: [
        { startedAt: new Date(), result: "ANSWERED_NOT_TAKEN", slot: "MATIN", callbackAt: null, disposition: null },
      ],
    });

    mockProspectFindMany.mockResolvedValue([notTaken]);
    const result = await getNextProspect("c1", LEGAL_NOW);
    expect(result.kind).toBe("outside_window");
  });

  it("excludes a prospect with INVALID_NUMBER (blacklisted)", async () => {
    const invalid = makeProspect("p1", {
      callAttempts: [
        { startedAt: new Date(), result: "INVALID_NUMBER", slot: "MATIN", callbackAt: null, disposition: null },
      ],
    });

    mockProspectFindMany.mockResolvedValue([invalid]);
    const result = await getNextProspect("c1", LEGAL_NOW);
    expect(result.kind).toBe("outside_window");
  });
});

// ─── EXCLUDED status ────────────────────────────────────────────────────────

describe("exclusion", () => {
  it("returns no prospect when all are excluded (Prisma filters them out)", async () => {
    mockProspectFindMany.mockResolvedValue([]);
    const result = await getNextProspect("c1", LEGAL_NOW);
    expect(result.kind).toBe("outside_window");
  });
});

// ─── Callback priority ──────────────────────────────────────────────────────

describe("callback priority", () => {
  it("picks overdue callback over wave-1 prospect", async () => {
    const overdueCallback = makeProspect("p_callback", {
      slotStats: [{ slot: "MATIN", attempts: 2, humanAnswers: 1 }],
      callAttempts: [
        {
          startedAt: new Date(LEGAL_NOW.getTime() - 2 * 86400_000),
          result: "HUMAN_ANSWERED",
          slot: "DEBUT_APREM",
          callbackAt: new Date(LEGAL_NOW.getTime() - 3600_000), // 1h ago — overdue
          disposition: { behavior: "CALLBACK" },
        },
      ],
    });
    const exploration = makeProspect("p_new", {
      slotStats: [],
      callAttempts: [],
    });

    mockProspectFindMany.mockResolvedValue([exploration, overdueCallback]);
    const result = await getNextProspect("c1", LEGAL_NOW);
    expect(result.kind).toBe("prospect");
    if (result.kind === "prospect") {
      expect(result.prospect.prospectId).toBe("p_callback");
      expect(result.prospect.isCallback).toBe(true);
    }
  });

  it("does not pick a callback whose callbackAt is in the future", async () => {
    const futureCallback = makeProspect("p_callback", {
      slotStats: [{ slot: "MATIN", attempts: 1, humanAnswers: 1 }],
      callAttempts: [
        {
          startedAt: new Date(LEGAL_NOW.getTime() - 86400_000),
          result: "HUMAN_ANSWERED",
          slot: "MATIN",
          callbackAt: new Date(LEGAL_NOW.getTime() + 3_600_000), // 1h from now
          disposition: { behavior: "CALLBACK" },
        },
      ],
    });
    const exploration = makeProspect("p_new", {});

    mockProspectFindMany.mockResolvedValue([futureCallback, exploration]);
    const result = await getNextProspect("c1", LEGAL_NOW);
    expect(result.kind).toBe("prospect");
    if (result.kind === "prospect") {
      expect(result.prospect.prospectId).toBe("p_new");
    }
  });

  it("picks the most overdue callback first among multiple", async () => {
    const olderCallback = makeProspect("p_older", {
      callAttempts: [
        {
          startedAt: new Date(LEGAL_NOW.getTime() - 5 * 86400_000),
          result: "HUMAN_ANSWERED",
          slot: "MATIN",
          callbackAt: new Date(LEGAL_NOW.getTime() - 2 * 3600_000),
          disposition: { behavior: "CALLBACK" },
        },
      ],
    });
    const newerCallback = makeProspect("p_newer", {
      callAttempts: [
        {
          startedAt: new Date(LEGAL_NOW.getTime() - 2 * 86400_000),
          result: "HUMAN_ANSWERED",
          slot: "MATIN",
          callbackAt: new Date(LEGAL_NOW.getTime() - 1 * 3600_000),
          disposition: { behavior: "CALLBACK" },
        },
      ],
    });

    mockProspectFindMany.mockResolvedValue([newerCallback, olderCallback]);
    const result = await getNextProspect("c1", LEGAL_NOW);
    expect(result.kind).toBe("prospect");
    if (result.kind === "prospect") {
      expect(result.prospect.prospectId).toBe("p_older");
    }
  });
});

// ─── Exploration priority ───────────────────────────────────────────────────

describe("exploration priority", () => {
  it("picks wave-1 exploration prospect before a wave-1 scored one", async () => {
    const scored = makeProspect("p_scored", {
      slotStats: [{ slot: "MATIN", attempts: 3, humanAnswers: 3 }], // score 1.0
      callAttempts: [], // wave 1
    });
    const newProspect = makeProspect("p_new", {
      callAttempts: [], // wave 1, exploration
    });

    mockProspectFindMany.mockResolvedValue([scored, newProspect]);
    const result = await getNextProspect("c1", LEGAL_NOW);
    expect(result.kind).toBe("prospect");
    if (result.kind === "prospect") {
      expect(result.prospect.prospectId).toBe("p_new");
      expect(result.prospect.isExploration).toBe(true);
    }
  });
});

// ─── Wave ordering ──────────────────────────────────────────────────────────

describe("wave ordering", () => {
  it("picks wave-1 prospect before wave-2 prospect", async () => {
    const wave2 = makeProspect("p_wave2", {
      callAttempts: [
        { startedAt: new Date(), result: "NO_ANSWER", slot: "DEBUT_APREM", callbackAt: null, disposition: null },
      ],
    });
    const wave1 = makeProspect("p_wave1", {
      callAttempts: [],
    });

    mockProspectFindMany.mockResolvedValue([wave2, wave1]);
    const result = await getNextProspect("c1", LEGAL_NOW);
    expect(result.kind).toBe("prospect");
    if (result.kind === "prospect") {
      expect(result.prospect.prospectId).toBe("p_wave1");
      expect(result.prospect.waveNumber).toBe(1);
    }
  });
});

// ─── Score ordering ─────────────────────────────────────────────────────────

describe("score ordering", () => {
  it("picks higher-scored prospect within the same wave", async () => {
    const low = makeProspect("p_low", {
      slotStats: [{ slot: "MATIN", attempts: 4, humanAnswers: 1 }], // 0.25
      callAttempts: [],
    });
    const high = makeProspect("p_high", {
      slotStats: [{ slot: "MATIN", attempts: 4, humanAnswers: 3 }], // 0.75
      callAttempts: [],
    });

    mockProspectFindMany.mockResolvedValue([low, high]);
    const result = await getNextProspect("c1", LEGAL_NOW);
    expect(result.kind).toBe("prospect");
    if (result.kind === "prospect") {
      expect(result.prospect.prospectId).toBe("p_high");
    }
  });
});
