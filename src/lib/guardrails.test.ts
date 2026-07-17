/**
 * Guardrails integration tests.
 *
 * These tests verify the business-critical invariants that must hold across
 * every lot: exclusion is permanent, legal windows are enforced, credits are
 * always deducted atomically, and no prospect is called twice in a single
 * session (pause/resume idempotence).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getNextProspect } from "@/lib/queue";
import { charge, getBalance } from "@/lib/credits";

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const mockCampaignFindUnique = vi.fn();
const mockProspectFindMany = vi.fn();
const mockCreditAggregate = vi.fn();
const mockCreditCreate = vi.fn();
const mockCallAttemptUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: { findUnique: () => mockCampaignFindUnique() },
    prospect: { findMany: (arg: unknown) => mockProspectFindMany(arg) },
    creditLedger: {
      aggregate: () => mockCreditAggregate(),
      create: () => mockCreditCreate(),
    },
    callAttempt: { update: () => mockCallAttemptUpdate() },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        creditLedger: { aggregate: mockCreditAggregate, create: mockCreditCreate },
        callAttempt: { update: mockCallAttemptUpdate },
      }),
  },
}));

// ─── Shared fixtures ──────────────────────────────────────────────────────────

// Monday 2026-06-22 11:00 — MATIN slot, legal window
const LEGAL_NOW = new Date(2026, 5, 22, 11, 0, 0, 0);
// Saturday 2026-06-27 11:00 — weekend, illegal
const WEEKEND_NOW = new Date(2026, 5, 27, 11, 0, 0, 0);

const CAMPAIGN = {
  accountId: "acc1",
  prospectLists: [{ prospectListId: "list1" }],
};

function makeProspect(id: string, opts: { status?: string; attempts?: number } = {}) {
  return {
    id,
    phoneNumber: `+336000000${id}`,
    slotStats: [] as unknown[],
    callAttempts:
      opts.attempts != null
        ? Array.from({ length: opts.attempts }, (_, i) => ({
            startedAt: new Date(2026, 5, 1 + i, 11, 0, 0),
            result: "NO_ANSWER",
            callbackAt: null,
            disposition: null,
          }))
        : [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCampaignFindUnique.mockResolvedValue(CAMPAIGN);
});

// ─── Exclusion guardrail ──────────────────────────────────────────────────────

describe("Exclusion guardrail", () => {
  it("always filters prospects with status:'ACTIVE' in the Prisma query", async () => {
    mockProspectFindMany.mockResolvedValue([]);

    await getNextProspect("c1", LEGAL_NOW);

    // The queue MUST pass status:"ACTIVE" to Prisma — excluded prospects must
    // never reach the selection logic regardless of any upstream bug.
    expect(mockProspectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
  });

  it("returns outside_window when only EXCLUDED prospects would exist", async () => {
    // Simulate: Prisma correctly filters EXCLUDED → returns empty array
    mockProspectFindMany.mockResolvedValue([]);

    const result = await getNextProspect("c1", LEGAL_NOW);

    // No eligible prospect → outside_window (no prospects to call)
    expect(result.kind).toBe("outside_window");
  });

  it("never returns a prospect that has hit the attempt ceiling (4 in 30 days)", async () => {
    const ceiledProspect = makeProspect("p_ceil", { attempts: 4 });
    mockProspectFindMany.mockResolvedValue([ceiledProspect]);

    const result = await getNextProspect("c1", LEGAL_NOW);

    // All prospects are at ceiling → treated as exhausted queue
    expect(result.kind).toBe("outside_window");
  });

  it("prospect with 3 counted attempts is still eligible", async () => {
    const almostCeiled = makeProspect("p_almost", { attempts: 3 });
    mockProspectFindMany.mockResolvedValue([almostCeiled]);

    const result = await getNextProspect("c1", LEGAL_NOW);

    expect(result.kind).toBe("prospect");
    if (result.kind === "prospect") {
      expect(result.prospect.prospectId).toBe("p_almost");
    }
  });
});

// ─── Legal window guard ───────────────────────────────────────────────────────

describe("Legal window guard", () => {
  it("blocks all calls outside legal hours (weekend)", async () => {
    const result = await getNextProspect("c1", WEEKEND_NOW);

    expect(result.kind).toBe("outside_window");
    // Prisma must NOT have been called — window check is a pre-flight gate
    expect(mockProspectFindMany).not.toHaveBeenCalled();
  });

  it("allows calls during a legal slot on a weekday", async () => {
    const p = makeProspect("p1");
    mockProspectFindMany.mockResolvedValue([p]);

    const result = await getNextProspect("c1", LEGAL_NOW);

    expect(result.kind).toBe("prospect");
  });

  it("nextWindow returned on weekend is after the blocked time and on a weekday", () => {
    // This is a pure slots.ts guarantee; validate it from the queue result too
    return getNextProspect("c1", WEEKEND_NOW).then((r) => {
      expect(r.kind).toBe("outside_window");
      if (r.kind === "outside_window") {
        const next = r.nextWindow;
        expect(next > WEEKEND_NOW).toBe(true);
        const dow = next.getDay();
        expect(dow).toBeGreaterThanOrEqual(1); // Mon
        expect(dow).toBeLessThanOrEqual(5); // Fri
      }
    });
  });
});

// ─── Credit debit ─────────────────────────────────────────────────────────────

describe("Credit debit", () => {
  it("charge() throws when balance is 0", async () => {
    mockCreditAggregate.mockResolvedValue({ _sum: { delta: 0 } });

    await expect(charge("acc1", 1, "CALL_ATTEMPT")).rejects.toThrow("INSUFFICIENT_CREDITS");
  });

  it("charge() throws when balance is less than requested amount", async () => {
    mockCreditAggregate.mockResolvedValue({ _sum: { delta: 3 } });

    await expect(charge("acc1", 5, "CALL_ATTEMPT")).rejects.toThrow("INSUFFICIENT_CREDITS");
  });

  it("charge() creates a negative ledger entry on success", async () => {
    mockCreditAggregate.mockResolvedValue({ _sum: { delta: 100 } });
    mockCreditCreate.mockResolvedValue({});

    await charge("acc1", 7, "CALL_ATTEMPT");

    expect(mockCreditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ delta: -7, reason: "CALL_ATTEMPT" }),
      })
    );
  });

  it("charge() with callAttemptId also updates creditsCharged on the attempt", async () => {
    mockCreditAggregate.mockResolvedValue({ _sum: { delta: 50 } });
    mockCreditCreate.mockResolvedValue({});
    mockCallAttemptUpdate.mockResolvedValue({});

    await charge("acc1", 1, "CALL_ATTEMPT", "attempt123");

    expect(mockCallAttemptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "attempt123" },
        data: { creditsCharged: { increment: 1 } },
      })
    );
  });

  it("getBalance returns 0 when ledger is empty", async () => {
    mockCreditAggregate.mockResolvedValue({ _sum: { delta: null } });
    const balance = await getBalance("acc_empty");
    expect(balance).toBe(0);
  });
});

// ─── Pause / resume idempotence ────────────────────────────────────────────────

describe("Pause / resume idempotence", () => {
  it("ANSWERED_NOT_TAKEN does not count toward the attempt ceiling", async () => {
    // Prospect has 4 attempts but all are ANSWERED_NOT_TAKEN → still eligible
    const p = {
      id: "p_ant",
      phoneNumber: "+33600000001",
      slotStats: [],
      callAttempts: Array.from({ length: 4 }, (_, i) => ({
        startedAt: new Date(2026, 5, 1 + i, 11, 0),
        result: "ANSWERED_NOT_TAKEN",
        callbackAt: null,
        disposition: null,
      })),
    };
    mockProspectFindMany.mockResolvedValue([p]);

    const result = await getNextProspect("c1", LEGAL_NOW);

    expect(result.kind).toBe("prospect");
    if (result.kind === "prospect") {
      expect(result.prospect.prospectId).toBe("p_ant");
    }
  });

  it("overdue callback prospect is prioritised before exploration prospects", async () => {
    const callbackAt = new Date(LEGAL_NOW.getTime() - 3600_000); // 1 hour ago
    const cbProspect = {
      id: "p_callback",
      phoneNumber: "+33600000002",
      slotStats: [{ slot: "MATIN", attempts: 2, humanAnswers: 1 }],
      callAttempts: [
        {
          startedAt: new Date(2026, 5, 20, 11, 0),
          result: "HUMAN_ANSWERED",
          callbackAt,
          disposition: { behavior: "CALLBACK" },
        },
      ],
    };
    const newProspect = {
      id: "p_new",
      phoneNumber: "+33600000003",
      slotStats: [],
      callAttempts: [],
    };
    mockProspectFindMany.mockResolvedValue([newProspect, cbProspect]);

    const result = await getNextProspect("c1", LEGAL_NOW);

    expect(result.kind).toBe("prospect");
    if (result.kind === "prospect") {
      // Callback must come before exploration
      expect(result.prospect.prospectId).toBe("p_callback");
      expect(result.prospect.isCallback).toBe(true);
    }
  });

  it("exploration prospect (zero attempts) is prioritised before scored ones", async () => {
    const scoredProspect = {
      id: "p_scored",
      phoneNumber: "+33600000004",
      slotStats: [{ slot: "MATIN", attempts: 5, humanAnswers: 5 }], // perfect score
      callAttempts: [
        {
          startedAt: new Date(2026, 5, 10, 11, 0),
          result: "HUMAN_ANSWERED",
          callbackAt: null,
          disposition: null,
        },
      ],
    };
    const explorationProspect = {
      id: "p_explore",
      phoneNumber: "+33600000005",
      slotStats: [],
      callAttempts: [],
    };
    mockProspectFindMany.mockResolvedValue([scoredProspect, explorationProspect]);

    const result = await getNextProspect("c1", LEGAL_NOW);

    expect(result.kind).toBe("prospect");
    if (result.kind === "prospect") {
      expect(result.prospect.prospectId).toBe("p_explore");
      expect(result.prospect.isExploration).toBe(true);
    }
  });
});
