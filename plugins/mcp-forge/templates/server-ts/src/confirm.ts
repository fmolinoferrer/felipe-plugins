// Propose-then-confirm store for write tools.
// propose_x validates input, returns a preview and a single-use token.
// confirm_x executes ONLY with a valid, unexpired token whose payload is
// exactly what was previewed. Tokens live in memory (lost on restart).
import { randomUUID } from "node:crypto";

interface Pending {
  action: string;
  payload: unknown;
  expiresAt: number;
}

export class ConfirmStore {
  private pending = new Map<string, Pending>();
  constructor(
    private ttlMs = 5 * 60 * 1000,
    private now: () => number = Date.now,
  ) {}

  propose(action: string, payload: unknown): { token: string; expiresAt: string } {
    this.sweep();
    const token = randomUUID();
    const expiresAt = this.now() + this.ttlMs;
    this.pending.set(token, { action, payload, expiresAt });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  /** Consumes the token. Throws if missing, expired, or for another action. */
  consume<T>(action: string, token: string): T {
    const p = this.pending.get(token);
    if (!p) throw new Error("Unknown or already-used confirm token. Call the propose tool again.");
    this.pending.delete(token);
    if (p.action !== action) throw new Error(`Token was issued for ${p.action}, not ${action}.`);
    if (p.expiresAt < this.now()) throw new Error("Confirm token expired. Call the propose tool again.");
    return p.payload as T;
  }

  private sweep() {
    const t = this.now();
    for (const [k, v] of this.pending) if (v.expiresAt < t) this.pending.delete(k);
  }
}
