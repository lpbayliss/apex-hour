import { describe, expect, expectTypeOf, it } from "vitest";

import { raceSummarySchema, type RaceSummary } from "./index.js";

describe("raceSummarySchema", () => {
  it("parses a valid race summary and exposes its inferred type", () => {
    const summary = raceSummarySchema.parse({
      raceId: "race-01",
      status: "running",
      completedLaps: 7,
    });

    expect(summary).toEqual({
      raceId: "race-01",
      status: "running",
      completedLaps: 7,
    });
    expectTypeOf(summary).toEqualTypeOf<RaceSummary>();
  });

  it("rejects invalid race progress", () => {
    expect(() =>
      raceSummarySchema.parse({
        raceId: "race-01",
        status: "running",
        completedLaps: -1,
      }),
    ).toThrow();
  });
});
