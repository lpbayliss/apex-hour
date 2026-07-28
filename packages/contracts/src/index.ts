import { z } from "zod";

const stableIdBaseSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u)
  .normalize("NFC");

export const universeIdSchema = stableIdBaseSchema.brand<"UniverseId">();
export const seasonIdSchema = stableIdBaseSchema.brand<"SeasonId">();
export const raceIdSchema = stableIdBaseSchema.brand<"RaceId">();
export const riderIdSchema = stableIdBaseSchema.brand<"RiderId">();
export const teamIdSchema = stableIdBaseSchema.brand<"TeamId">();
export const manufacturerIdSchema =
  stableIdBaseSchema.brand<"ManufacturerId">();
export const sponsorshipIdSchema = stableIdBaseSchema.brand<"SponsorshipId">();
export const componentIdSchema = stableIdBaseSchema.brand<"ComponentId">();
export const aggregateIdSchema = stableIdBaseSchema.brand<"AggregateId">();
export const commandIdSchema = stableIdBaseSchema.brand<"CommandId">();
export const correlationIdSchema = stableIdBaseSchema.brand<"CorrelationId">();

export type UniverseId = z.infer<typeof universeIdSchema>;
export type SeasonId = z.infer<typeof seasonIdSchema>;
export type RaceId = z.infer<typeof raceIdSchema>;
export type RiderId = z.infer<typeof riderIdSchema>;
export type TeamId = z.infer<typeof teamIdSchema>;
export type ManufacturerId = z.infer<typeof manufacturerIdSchema>;
export type SponsorshipId = z.infer<typeof sponsorshipIdSchema>;
export type ComponentId = z.infer<typeof componentIdSchema>;
export type AggregateId = z.infer<typeof aggregateIdSchema>;
export type CommandId = z.infer<typeof commandIdSchema>;
export type CorrelationId = z.infer<typeof correlationIdSchema>;

export const ratingSchema = z.number().int().min(0).max(100).brand<"Rating">();
export type Rating = z.infer<typeof ratingSchema>;

export const riderRatingsSchema = z
  .object({
    pace: ratingSchema,
    qualifying: ratingSchema,
    racecraft: ratingSchema,
    consistency: ratingSchema,
    aggression: ratingSchema,
    wetSkill: ratingSchema,
    tyreManagement: ratingSchema,
    fitness: ratingSchema,
    adaptability: ratingSchema,
    feedback: ratingSchema,
    popularity: ratingSchema,
  })
  .strict();
export type RiderRatings = z.infer<typeof riderRatingsSchema>;

export const aggregateKindSchema = z.enum([
  "universe",
  "season",
  "race",
  "rider",
  "team",
  "manufacturer",
  "sponsorship",
  "component",
]);
export type AggregateKind = z.infer<typeof aggregateKindSchema>;

export const versionIdentifierSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._+-]*$/u)
  .normalize("NFC");
export type VersionIdentifier = z.infer<typeof versionIdentifierSchema>;

const positiveSequenceSchema = z.number().int().safe().positive();
const eventTypeSchema = z
  .string()
  .min(3)
  .max(128)
  .regex(/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/u)
  .normalize("NFC");
const stableKeySchema = z.string().min(1).max(256).normalize("NFC");

export const eventIdSchema = z
  .string()
  .regex(
    /^(?:universe|season|race|rider|team|manufacturer|sponsorship|component)\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\/[1-9]\d*$/u,
  )
  .brand<"EventId">();
export type EventId = z.infer<typeof eventIdSchema>;

export const raceFeedCursorSchema = z
  .string()
  .regex(/^race\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\/publication\/[1-9]\d*$/u)
  .brand<"RaceFeedCursor">();
export type RaceFeedCursor = z.infer<typeof raceFeedCursorSchema>;

export const eventContextSchema = z
  .object({
    universeId: universeIdSchema.optional(),
    seasonId: seasonIdSchema.optional(),
    raceId: raceIdSchema.optional(),
    riderId: riderIdSchema.optional(),
    teamId: teamIdSchema.optional(),
    manufacturerId: manufacturerIdSchema.optional(),
  })
  .strict();
export type EventContext = z.infer<typeof eventContextSchema>;

export function formatEventId(
  aggregateKind: AggregateKind,
  aggregateId: AggregateId,
  streamSequence: number,
): EventId {
  return eventIdSchema.parse(
    `${aggregateKind}/${aggregateId}/${streamSequence}`,
  );
}

export function formatRaceFeedCursor(
  raceId: RaceId,
  publicationSequence: number,
): RaceFeedCursor {
  return raceFeedCursorSchema.parse(
    `race/${raceId}/publication/${publicationSequence}`,
  );
}

export function canonicalEventSchema<TPayload extends z.ZodType>(
  payloadSchema: TPayload,
) {
  return z
    .object({
      eventId: eventIdSchema,
      aggregateKind: aggregateKindSchema,
      aggregateId: aggregateIdSchema,
      streamSequence: positiveSequenceSchema,
      context: eventContextSchema.optional(),
      eventType: eventTypeSchema,
      schemaVersion: versionIdentifierSchema,
      simulationRulesetVersion: versionIdentifierSchema,
      catalogVersion: versionIdentifierSchema,
      logicalTime: z.number().int().safe().nonnegative(),
      plannedInstant: z.iso.datetime({ offset: true }).optional(),
      commandId: commandIdSchema,
      idempotencyKey: stableKeySchema,
      causationEventId: eventIdSchema.optional(),
      correlationId: correlationIdSchema,
      payload: payloadSchema,
    })
    .strict()
    .superRefine((event, context) => {
      const expected = `${event.aggregateKind}/${event.aggregateId}/${event.streamSequence}`;
      if (event.eventId !== expected) {
        context.addIssue({
          code: "custom",
          path: ["eventId"],
          message: "EVENT_ID_MISMATCH",
        });
      }
    });
}

export type CanonicalEvent<TPayload extends z.ZodType> = z.infer<
  ReturnType<typeof canonicalEventSchema<TPayload>>
>;

export const raceFeedCursorErrorCodeSchema = z.enum([
  "EVENT_CURSOR_INVALID",
  "EVENT_CURSOR_AHEAD",
  "EVENT_CURSOR_EXPIRED",
]);
export type RaceFeedCursorErrorCode = z.infer<
  typeof raceFeedCursorErrorCodeSchema
>;

export const raceFeedCursorResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    publicationSequence: positiveSequenceSchema,
  }),
  z.object({
    ok: z.literal(false),
    code: raceFeedCursorErrorCodeSchema,
  }),
]);
export type RaceFeedCursorResult = z.infer<typeof raceFeedCursorResultSchema>;

export function validateRaceFeedCursor(
  input: unknown,
  expectedRaceId: RaceId,
  bounds: { highWater: number; minimumRetained?: number },
): RaceFeedCursorResult {
  const parsed = raceFeedCursorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "EVENT_CURSOR_INVALID" };
  const match = /^race\/([^/]+)\/publication\/(\d+)$/u.exec(parsed.data);
  if (!match || match[1] !== expectedRaceId) {
    return { ok: false, code: "EVENT_CURSOR_INVALID" };
  }
  const publicationSequence = Number(match[2]);
  if (!Number.isSafeInteger(publicationSequence)) {
    return { ok: false, code: "EVENT_CURSOR_INVALID" };
  }
  if (publicationSequence > bounds.highWater) {
    return { ok: false, code: "EVENT_CURSOR_AHEAD" };
  }
  if (publicationSequence < (bounds.minimumRetained ?? 1)) {
    return { ok: false, code: "EVENT_CURSOR_EXPIRED" };
  }
  return { ok: true, publicationSequence };
}

export const raceSummarySchema = z
  .object({
    raceId: raceIdSchema,
    status: z.enum(["scheduled", "running", "complete"]),
    completedLaps: z.number().int().nonnegative(),
  })
  .strict();
export type RaceSummary = z.infer<typeof raceSummarySchema>;
