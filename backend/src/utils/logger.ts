import fs from "node:fs";
import path from "node:path";

type LogLevel = "INFO" | "WARN" | "ERROR";

type LogDetails = Record<string, unknown>;

const logDirectory = process.env.LOG_DIRECTORY || path.resolve(process.cwd(), "logs");

function redact(value: string) {
  return value
    .replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1***@")
    .replace(/(bearer\s+)[^\s]+/gi, "$1***")
    .replace(/(password|token|authorization)\s*[:=]\s*[^,\s}]+/gi, "$1=***");
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redact(error.message),
      stack: error.stack ? redact(error.stack) : undefined,
    };
  }

  return { message: redact(String(error)) };
}

function write(level: LogLevel, event: string, details: LogDetails = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details,
  };
  const line = JSON.stringify(entry);

  // Console output is useful on hosted services; the file is useful while developing locally.
  console[level === "ERROR" ? "error" : "log"](line);

  try {
    fs.mkdirSync(logDirectory, { recursive: true });
    const date = entry.timestamp.slice(0, 10);
    fs.appendFileSync(path.join(logDirectory, `attendancepro-${date}.log`), `${line}\n`, "utf8");
  } catch (fileError) {
    // Logging must never bring down the API.
    console.error("AttendancePro could not write its log file.", fileError);
  }
}

export const logger = {
  info(event: string, details?: LogDetails) {
    write("INFO", event, details);
  },
  warn(event: string, details?: LogDetails) {
    write("WARN", event, details);
  },
  error(event: string, error: unknown, details?: LogDetails) {
    write("ERROR", event, { ...details, error: safeError(error) });
  },
};
