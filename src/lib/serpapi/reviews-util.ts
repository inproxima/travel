import crypto from "node:crypto";
import type { Review } from "@/lib/models";

export function reviewId(source: string, ...parts: (string | number | null | undefined)[]): string {
  return `${source}_${crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 12)}`;
}

/** Keeps reviews that actually say something, with tidy whitespace. */
export function cleanReviews(reviews: Review[]): Review[] {
  return reviews
    .map((r) => ({ ...r, text: r.text.replace(/\s+/g, " ").trim() }))
    .filter((r) => r.text.length > 0);
}
