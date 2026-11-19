import type { InterestWorkflow } from "../entities";

/**
 * Frontend wizard steps mapped to the stage keys returned by the backend.
 * Steps 7 (Notification) and 8 (History) have no backend key — they are
 * UI-only stages reached after `disburse`.
 */
export const INTEREST_STAGE_STEPS = [
  { key: "configure", steps: [1, 2] }, // Period setup + Rule configuration
  { key: "calculate", steps: [3] }, // Calculation
  { key: "submit", steps: [4] }, // Review and submit
  { key: "approve", steps: [5] }, // Approval
  { key: "disburse", steps: [6] }, // Payout batch
] as const;

export type InterestStageKey = (typeof INTEREST_STAGE_STEPS)[number]["key"];

/** Returns the last wizard step unlocked by completing a backend stage. */
export function interestWizardStageFor(
  key: string | null | undefined,
): number | null {
  if (!key) return null;
  const match = INTEREST_STAGE_STEPS.find(
    (stage) => stage.key === key.trim().toLowerCase(),
  );
  return match ? match.steps[match.steps.length - 1] : null;
}

/**
 * Resolves the server progress into the wizard's 1-based `done`/`stage`.
 * `done` is the last completed step; `stage` is where the admin continues.
 */
export function interestWizardProgress(w: InterestWorkflow): {
  done: number;
  stage: number;
} {
  const completed = new Set(w.completedStages);
  for (const stage of w.stages) {
    if (stage.status === "completed") completed.add(stage.key);
  }

  const current =
    w.currentStage ??
    w.stages.find((stage) => stage.status === "current")?.key ??
    INTEREST_STAGE_STEPS.find((stage) => !completed.has(stage.key))?.key ??
    null;

  const completedSteps = [...completed]
    .map((key) => interestWizardStageFor(key))
    .filter((step): step is number => step != null);
  let done = completedSteps.length
    ? Math.max(...completedSteps)
    : Math.max(0, w.done);

  // Some responses expose only the workflow status. Infer the milestone it
  // implies so a configuration that has begun never renders as "Not started".
  const statusDone: Partial<Record<InterestWorkflow["status"], number>> = {
    Submitted: 4,
    "Pending approval": 4,
    Approved: 5,
  };
  done = Math.max(done, statusDone[w.status] ?? 0);

  // Notification and History have no backend stage key.
  if (w.notified || w.status === "Paid out") done = 8;

  const fallback = Math.min(8, done + 1);
  const stage = Math.max(
    1,
    Math.min(8, Math.min(fallback, interestWizardStageFor(current) ?? fallback)),
  );
  return { done: Math.min(8, done), stage };
}
