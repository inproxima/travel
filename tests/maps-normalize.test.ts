import { describe, expect, it } from "vitest";
import { normalizeMaps } from "@/lib/serpapi/engines/google-maps";

describe("normalizeMaps", () => {
  it("survives odd shapes instead of throwing", () => {
    const out = normalizeMaps({
      local_results: [
        { title: "Café", gps_coordinates: { latitude: 1, longitude: 2 }, rating: "4.5", type: ["Cafe", "Bakery"] },
        "garbage",
        { title: "No coords" },
      ],
    });
    expect(out.map((p) => p.title)).toEqual(["Café", "No coords"]);
    expect(out[0]).toMatchObject({ coords: { lat: 1, lng: 2 }, rating: null, type: "Cafe" });
    expect(out[1]?.coords).toBeNull();
  });
});
