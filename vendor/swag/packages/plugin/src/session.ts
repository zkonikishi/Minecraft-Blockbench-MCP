export interface SessionState {
  scopedDirectory: string | null;
}

export function createSession(): SessionState {
  return { scopedDirectory: null };
}

export function revokeScope(session: SessionState): void {
  session.scopedDirectory = null;
}
