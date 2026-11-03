/** An access token lives 10 minutes; anything older than that has expired on its own. */
const KEEP_MS = 10 * 60_000;

/**
 * Users whose access changed in the last 10 minutes, with the moment it changed. A token issued
 * before that moment carries the old permissions and is refused. In memory, one copy per gateway
 * process, filled from `user.access.changed`.
 */
export class RevocationList {
  private readonly changedAt = new Map<string, number>();

  record(userId: string, changedAt: Date, now = Date.now()): void {
    // JWT `iat` is whole seconds, so compare at that precision: a token issued in the same second
    // as the change is treated as issued after it, never refused by a rounding difference.
    const seconds = Math.floor(changedAt.getTime() / 1000);
    const previous = this.changedAt.get(userId) ?? 0;
    this.changedAt.set(userId, Math.max(previous, seconds));
    this.prune(now);
  }

  isRevoked(userId: string, issuedAtSeconds: number): boolean {
    const changed = this.changedAt.get(userId);
    return changed !== undefined && issuedAtSeconds < changed;
  }

  get size(): number {
    return this.changedAt.size;
  }

  private prune(now: number): void {
    const cutoff = Math.floor((now - KEEP_MS) / 1000);
    for (const [userId, seconds] of this.changedAt) {
      if (seconds < cutoff) this.changedAt.delete(userId);
    }
  }
}
