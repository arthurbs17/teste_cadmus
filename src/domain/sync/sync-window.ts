const DAY_MS = 24 * 60 * 60 * 1000;

export function syncWindowStart(
  lastSyncedAt: Date | null,
  now: Date,
  overlapDays: number,
  initialLookbackDays: number,
): Date {
  if (!lastSyncedAt) {
    return new Date(now.getTime() - initialLookbackDays * DAY_MS);
  }

  return new Date(lastSyncedAt.getTime() - overlapDays * DAY_MS);
}
