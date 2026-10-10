import { describe, expect, it } from "vitest";
import { Budget, BudgetExceededError } from "@/lib/serpapi/budget";

describe("Budget", () => {
  it("reserves before spending so parallel calls cannot overshoot", () => {
    const b = new Budget(3);
    b.reserve();
    b.reserve();
    b.reserve();
    expect(() => b.reserve()).toThrow(BudgetExceededError);
    b.commit();
    b.release(); // e.g. served from cache
    expect(b.used).toBe(2);
    expect(b.remaining).toBe(1);
    expect(b.snapshot()).toEqual({ cap: 3, spent: 1, reserved: 1 });
  });

  it("notifies listeners only when credits are actually spent", () => {
    const b = new Budget(5);
    const seen: number[] = [];
    b.onChange((s) => seen.push(s.spent));
    b.reserve(2);
    b.release(1);
    b.commit(1);
    expect(seen).toEqual([1]);
  });
});
