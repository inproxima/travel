import { z } from "zod";

// Output schemas for the model. Structured outputs run in strict mode, so every
// field is required and "missing" is expressed with null. Ranges are enforced
// in code after parsing rather than in the schema.

export const TRAVELER_TYPES = ["Business", "Couples", "Family", "Friends", "Solo"] as const;

export const tripSpecSchema = z.object({
  destination: z.string().describe("City and country, e.g. 'Lisbon, Portugal'."),
  searchQuery: z.string().describe("What to type into Google Hotels, e.g. 'Lisbon' or 'Shibuya, Tokyo'."),
  dateWindows: z
    .array(z.object({ checkIn: z.string().describe("YYYY-MM-DD"), checkOut: z.string().describe("YYYY-MM-DD") }))
    .describe("1 window for fixed dates; up to 3 spread-out windows when the dates are flexible (e.g. 'sometime in March')."),
  flexibleDates: z.boolean(),
  adults: z.number(),
  childrenAges: z.array(z.number()),
  budgetPerNight: z.number().nullable().describe("In the user's currency, or null."),
  budgetTotal: z.number().nullable(),
  minHotelClass: z.number().nullable(),
  priorities: z.array(z.string()).describe("Short keywords in order of importance, e.g. ['quiet', 'fast wifi', 'walkable']."),
  reviewKeyword: z.string().nullable().describe("One word to search reviews for, matching the top priority, e.g. 'noise'."),
  travelerType: z.enum(TRAVELER_TYPES).nullable(),
  preferVacationRentals: z.boolean(),
  placesOfInterest: z
    .array(
      z.object({
        label: z.string(),
        address: z.string().describe("Address or well-known place name with the city."),
        savedPlaceId: z.string().nullable().describe("Id of the user's saved place this refers to, or null."),
      }),
    )
    .describe("Places the stay should be close to, most important first."),
  assumptions: z.array(z.string()).describe("Anything you had to assume, in plain words."),
});
export type TripSpec = z.infer<typeof tripSpecSchema>;

export const pickSchema = z.object({
  picks: z.array(z.object({ id: z.string(), reason: z.string().describe("One sentence.") })),
});
export type Picks = z.infer<typeof pickSchema>;

const pointSchema = z.object({
  text: z.string().describe("The point in your own words, one sentence."),
  quote: z.string().nullable().describe("A short exact quote from the evidence that supports it, or null."),
  source: z.enum(["google", "google_maps", "tripadvisor", "forum"]).nullable(),
});

export const rankingSchema = z.object({
  summary: z.string().describe("2-3 sentences: the recommendation and the main trade-off."),
  ranking: z.array(
    z.object({
      id: z.string(),
      headline: z.string().describe("Short verdict, e.g. 'Best overall: quiet rooms, 12 min to the office'."),
      scores: z.object({
        value: z.number().describe("0-10: price for what you get, against the budget."),
        location: z.number().describe("0-10: commute and neighbourhood fit."),
        reviews: z.number().describe("0-10: what guests say, weighted to the user's priorities."),
        fit: z.number().describe("0-10: match to the specific request."),
      }),
      pros: z.array(pointSchema),
      cons: z.array(pointSchema),
      bestFor: z.array(z.string()),
      caveats: z.array(z.string()),
    }),
  ),
});
export type Ranking = z.infer<typeof rankingSchema>;
export type RankPoint = z.infer<typeof pointSchema>;
