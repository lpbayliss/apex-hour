import "hono";
import "drizzle-orm";
import "@opentelemetry/api";
import "@apex-hour/config";
import "node:fs";
import "../../../contracts/src/index.ts";

export function exerciseForbiddenBoundaries(): void {
  void import.meta.env;
  void process.cwd();
  void Math.random();
  void Date.now();
  setTimeout(() => undefined, 0);
}
