export interface SyncCheckpoint {
  windowStart: string;
  completedAccountIds: string[];
  currentAccountId: string | null;
  nextPageCursor: string | null;
}

export function initialCheckpoint(windowStart: Date): SyncCheckpoint {
  return {
    windowStart: windowStart.toISOString(),
    completedAccountIds: [],
    currentAccountId: null,
    nextPageCursor: null,
  };
}

export function advanceCheckpoint(
  checkpoint: SyncCheckpoint,
  externalAccountId: string,
  nextPageCursor: string | null,
): SyncCheckpoint {
  if (nextPageCursor) {
    return { ...checkpoint, currentAccountId: externalAccountId, nextPageCursor };
  }

  return {
    ...checkpoint,
    completedAccountIds: [...checkpoint.completedAccountIds, externalAccountId],
    currentAccountId: null,
    nextPageCursor: null,
  };
}

export function resumeCursorFor(
  checkpoint: SyncCheckpoint,
  externalAccountId: string,
): string | null {
  return checkpoint.currentAccountId === externalAccountId ? checkpoint.nextPageCursor : null;
}
