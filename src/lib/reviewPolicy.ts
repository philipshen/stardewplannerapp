/** Local engagement history; never records whether someone rated the app. */
export type ReviewHistory = { firstSessionAt: number; sessions: number; lastRequestedAt: number; lastRequestedVersion: string };
const DAY = 86_400_000;
export function reviewHistory(value: unknown): ReviewHistory {
  const v = value && typeof value === 'object' ? value as Partial<ReviewHistory> : {};
  const number = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0;
  return { firstSessionAt: number(v.firstSessionAt), sessions: Math.floor(number(v.sessions)), lastRequestedAt: number(v.lastRequestedAt), lastRequestedVersion: typeof v.lastRequestedVersion === 'string' ? v.lastRequestedVersion : '' };
}
export function completedPlanningSession(history: ReviewHistory, edits: number, durationMs: number, now: number): ReviewHistory {
  if (edits < 5 || durationMs < 120_000) return history;
  return { ...history, firstSessionAt: history.firstSessionAt || now, sessions: history.sessions + 1 };
}
export function shouldRequestReview(history: ReviewHistory, version: string, now: number): boolean {
  return history.sessions >= 3 && history.firstSessionAt > 0 && now - history.firstSessionAt >= 3 * DAY
    && history.lastRequestedVersion !== version
    && (!history.lastRequestedAt || now - history.lastRequestedAt >= 120 * DAY);
}
