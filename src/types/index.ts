// ─── Enums (mirror schema.prisma) ─────────────────────────────────────────────

export type Plan = "ESSENTIEL" | "PRO" | "EXPERT";
export type BillingCycle = "MONTHLY" | "ANNUAL";
export type UserRole = "ADMIN" | "AGENT";
export type TwilioStatus =
  | "CONNECTED"
  | "INVALID_KEY"
  | "QUOTA_EXCEEDED"
  | "SUSPENDED"
  | "DISCONNECTED";
export type ProspectStatus = "ACTIVE" | "EXCLUDED";
export type DispositionKind = "SYSTEM" | "CUSTOM";
export type DispositionBehavior = "NONE" | "DO_NOT_CALL" | "CALLBACK" | "VOICEMAIL";
export type CampaignStatus = "ACTIVE" | "PAUSED" | "COMPLETED";

// Legal calling slots — FR grid (Mon–Fri): 10h-13h / 14h-17h / 17h-20h
export type Slot = "MATIN" | "DEBUT_APREM" | "FIN_APREM";

export type CallResult =
  | "HUMAN_ANSWERED"
  | "ANSWERED_NOT_TAKEN" // Human picked up, agent didn't take it — not a failure
  | "VOICEMAIL"
  | "NO_ANSWER"
  | "INVALID_NUMBER" // SIP 404/410 or Twilio 21211/21214 — number doesn't exist or disconnected
  | "FAILED";

// ─── Domain types ──────────────────────────────────────────────────────────────

export type Account = {
  id: string;
  name: string;
  plan: Plan;
  createdAt: string;
};

export type User = {
  id: string;
  email: string;
  accountId: string;
  role: UserRole;
  createdAt: string;
};

export type TwilioConnection = {
  id: string;
  accountId: string;
  phoneNumber: string;
  status: TwilioStatus;
  verifiedAt: string | null;
};

export type ProspectList = {
  id: string;
  accountId: string;
  name: string;
  sourceFileName: string | null;
  legalBasis: string;
  legalBasisDeclaredAt: string;
  importedAt: string;
};

export type Prospect = {
  id: string;
  accountId: string;
  listId: string;
  phoneNumber: string;
  company: string | null;
  contactName: string | null;
  status: ProspectStatus;
  excludedAt: string | null;
  createdAt: string;
};

export type Tag = {
  id: string;
  accountId: string;
  name: string;
  color: string;
};

export type Note = {
  id: string;
  accountId: string;
  prospectId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type Disposition = {
  id: string;
  accountId: string;
  label: string;
  kind: DispositionKind;
  behavior: DispositionBehavior;
};

export type Campaign = {
  id: string;
  accountId: string;
  name: string;
  status: CampaignStatus;
  createdAt: string;
};

export type CallAttempt = {
  id: string;
  accountId: string;
  prospectId: string;
  campaignId: string;
  slot: Slot;
  twilioCallSid: string | null;
  startedAt: string;
  durationSec: number | null;
  result: CallResult | null;
  dispositionId: string | null;
  callbackAt: string | null;
  creditsCharged: number;
};

export type ProspectSlotStat = {
  prospectId: string;
  slot: Slot;
  attempts: number;
  humanAnswers: number;
  /** score = humanAnswers / attempts, 0 when attempts === 0 */
  score: number;
};

export type CreditLedger = {
  id: string;
  accountId: string;
  delta: number;
  reason: string;
  relatedCallAttemptId: string | null;
  createdAt: string;
};

// ─── Session augmentation ──────────────────────────────────────────────────────

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      accountId: string;
      role: UserRole;
    };
  }
}
