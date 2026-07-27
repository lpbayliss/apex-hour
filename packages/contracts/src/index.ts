import { z } from "zod";

export const raceSummarySchema = z.object({
  raceId: z.string().min(1),
  status: z.enum(["scheduled", "running", "complete"]),
  completedLaps: z.number().int().nonnegative(),
});

export type RaceSummary = z.infer<typeof raceSummarySchema>;
