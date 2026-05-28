/**
 * Minimal structured logger. Emits one JSON object per line so logs are
 * grep-able locally and ingestible by any log pipeline (CloudWatch, Loki,
 * Datadog) in production without code changes. Kept dependency-free on
 * purpose; swap for pino/OpenTelemetry when shipping to a real environment.
 */
type Level = "debug" | "info" | "warn" | "error";

type Fields = Record<string, unknown>;

function emit(level: Level, msg: string, fields?: Fields) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  });
  (level === "error" ? console.error : console.log)(line);
}

export const logger = {
  debug: (msg: string, fields?: Fields) => emit("debug", msg, fields),
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
};
