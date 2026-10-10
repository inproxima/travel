export class BudgetExceededError extends Error {
  constructor(
    public readonly cap: number,
    public readonly used: number,
  ) {
    super(`Credit limit reached: ${used} of ${cap} SerpApi credits already used for this action.`);
    this.name = "BudgetExceededError";
  }
}

export type BudgetSnapshot = { cap: number; spent: number; reserved: number };

/**
 * Counts SerpApi credits for one user action (a search, an AI question).
 * Credits are reserved synchronously before a request goes out, so calls
 * started in parallel can never overshoot the cap together.
 */
export class Budget {
  private spent = 0;
  private reserved = 0;
  private listeners = new Set<(s: BudgetSnapshot) => void>();

  constructor(public readonly cap: number) {}

  get used() {
    return this.spent + this.reserved;
  }

  get remaining() {
    return this.cap - this.used;
  }

  canAfford(n = 1) {
    return this.used + n <= this.cap;
  }

  reserve(n = 1) {
    if (!this.canAfford(n)) throw new BudgetExceededError(this.cap, this.used);
    this.reserved += n;
  }

  /** The reserved call went out and cost credits. */
  commit(n = 1) {
    this.reserved -= n;
    this.spent += n;
    this.emit();
  }

  /** The reserved call was served from cache or failed, so it cost nothing. */
  release(n = 1) {
    this.reserved -= n;
  }

  snapshot(): BudgetSnapshot {
    return { cap: this.cap, spent: this.spent, reserved: this.reserved };
  }

  onChange(fn: (s: BudgetSnapshot) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    const s = this.snapshot();
    for (const fn of this.listeners) fn(s);
  }
}
