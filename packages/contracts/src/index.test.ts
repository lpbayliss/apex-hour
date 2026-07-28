import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import {
  aggregateIdSchema,
  canonicalEventSchema,
  commandIdSchema,
  correlationIdSchema,
  formatEventId,
  formatRaceFeedCursor,
  raceFeedCursorSchema,
  raceIdSchema,
  raceSummarySchema,
  ratingSchema,
  riderRatingsSchema,
  validateRaceFeedCursor,
  type RaceSummary,
  type Rating,
} from "./index.js";

const payloadSchema = z
  .object({
    lap: z.number().int().positive(),
    note: z.string(),
  })
  .strict();
const eventSchema = canonicalEventSchema(payloadSchema);

function validEvent() {
  const aggregateId = aggregateIdSchema.parse("race-01");
  return {
    eventId: formatEventId("race", aggregateId, 4),
    aggregateKind: "race" as const,
    aggregateId,
    streamSequence: 4,
    context: {
      raceId: raceIdSchema.parse("race-01"),
      seasonId: "season-01",
    },
    eventType: "lap.completed",
    schemaVersion: "1.0.0",
    simulationRulesetVersion: "ruleset-1",
    catalogVersion: "catalog-1",
    logicalTime: 42,
    plannedInstant: "2026-07-28T02:00:00Z",
    commandId: commandIdSchema.parse("command-04"),
    idempotencyKey: "race-01/lap/4",
    correlationId: correlationIdSchema.parse("correlation-01"),
    payload: { lap: 4, note: "stable" },
  };
}

describe("branded contract primitives", () => {
  it("infers public types from strict Zod schemas", () => {
    const summary = raceSummarySchema.parse({
      raceId: "race-01",
      status: "running",
      completedLaps: 7,
    });
    const rating = ratingSchema.parse(83);

    expectTypeOf(summary).toEqualTypeOf<RaceSummary>();
    expectTypeOf(rating).toEqualTypeOf<Rating>();
    expect(summary.raceId).toBe("race-01");
  });

  it("validates all required rider ratings on the 0-100 integer scale", () => {
    const ratings = Object.fromEntries(
      [
        "pace",
        "qualifying",
        "racecraft",
        "consistency",
        "aggression",
        "wetSkill",
        "tyreManagement",
        "fitness",
        "adaptability",
        "feedback",
        "popularity",
      ].map((key) => [key, 50]),
    );
    expect(riderRatingsSchema.parse(ratings)).toEqual(ratings);
    expect(() => ratingSchema.parse(100.5)).toThrow();
    expect(() => ratingSchema.parse(101)).toThrow();
    expect(() => raceIdSchema.parse("unsafe/id")).toThrow();
  });
});

describe("canonical aggregate event envelope", () => {
  it("accepts a typed strict envelope with deterministic identity and version material", () => {
    const event = eventSchema.parse(validEvent());

    expect(event.eventId).toBe("race/race-01/4");
    expect(event.payload).toEqual({ lap: 4, note: "stable" });
    expectTypeOf(event.payload).toEqualTypeOf<z.infer<typeof payloadSchema>>();
  });

  it("rejects mismatched IDs, invalid order, unknown fields, and invalid payloads", () => {
    expect(() =>
      eventSchema.parse({ ...validEvent(), eventId: "race/race-01/5" }),
    ).toThrow("EVENT_ID_MISMATCH");
    expect(() =>
      eventSchema.parse({ ...validEvent(), streamSequence: 0 }),
    ).toThrow();
    expect(() =>
      eventSchema.parse({ ...validEvent(), unknown: true }),
    ).toThrow();
    expect(() =>
      eventSchema.parse({ ...validEvent(), payload: { lap: -1, note: "bad" } }),
    ).toThrow();
  });
});

describe("race-feed publication cursors", () => {
  const raceId = raceIdSchema.parse("race-01");

  it("keeps aggregate event IDs distinct from tracked publication cursors", () => {
    const cursor = formatRaceFeedCursor(raceId, 9);
    expect(cursor).toBe("race/race-01/publication/9");
    expect(raceFeedCursorSchema.safeParse("race/race-01/9").success).toBe(
      false,
    );
  });

  it.each([
    ["not-a-cursor", { ok: false, code: "EVENT_CURSOR_INVALID" }],
    ["race/race-02/publication/2", { ok: false, code: "EVENT_CURSOR_INVALID" }],
    ["race/race-01/publication/11", { ok: false, code: "EVENT_CURSOR_AHEAD" }],
    ["race/race-01/publication/2", { ok: false, code: "EVENT_CURSOR_EXPIRED" }],
    ["race/race-01/publication/4", { ok: true, publicationSequence: 4 }],
  ])("validates %s with stable scope/bound codes", (input, expected) => {
    expect(
      validateRaceFeedCursor(input, raceId, {
        highWater: 10,
        minimumRetained: 3,
      }),
    ).toEqual(expected);
  });
});
