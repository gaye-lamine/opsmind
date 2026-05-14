/**
 * Structured logger for OpsMind.
 * All logs include context, level, and timestamp.
 * In production, this should be replaced with a proper logging service.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  timestamp: string;
  sessionId?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getCurrentLevel(): LogLevel {
  const env = process.env["NODE_ENV"];
  return env === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getCurrentLevel()];
}

function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}]${entry.context ? ` [${entry.context}]` : ""}${entry.sessionId ? ` [${entry.sessionId}]` : ""} ${entry.message}`;
  if (entry.data && Object.keys(entry.data).length > 0) {
    return `${base}\n${JSON.stringify(entry.data, null, 2)}`;
  }
  return base;
}

export class Logger {
  constructor(private readonly context: string) {}

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    sessionId?: string
  ): void {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      context: this.context,
      timestamp: new Date().toISOString(),
      ...(data !== undefined ? { data } : {}),
      ...(sessionId !== undefined ? { sessionId } : {}),
    };

    const formatted = formatEntry(entry);

    switch (level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }
  }

  debug(message: string, data?: Record<string, unknown>, sessionId?: string): void {
    this.log("debug", message, data, sessionId);
  }

  info(message: string, data?: Record<string, unknown>, sessionId?: string): void {
    this.log("info", message, data, sessionId);
  }

  warn(message: string, data?: Record<string, unknown>, sessionId?: string): void {
    this.log("warn", message, data, sessionId);
  }

  error(
    message: string,
    error?: unknown,
    data?: Record<string, unknown>,
    sessionId?: string
  ): void {
    const errorData: Record<string, unknown> = { ...data };
    if (error instanceof Error) {
      errorData["error"] = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error !== undefined) {
      errorData["error"] = error;
    }
    this.log("error", message, errorData, sessionId);
  }

  withSession(sessionId: string): SessionLogger {
    return new SessionLogger(this.context, sessionId);
  }
}

export class SessionLogger {
  private readonly logger: Logger;

  constructor(
    context: string,
    private readonly sessionId: string
  ) {
    this.logger = new Logger(context);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug(message, data, this.sessionId);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.info(message, data, this.sessionId);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn(message, data, this.sessionId);
  }

  error(message: string, error?: unknown, data?: Record<string, unknown>): void {
    this.logger.error(message, error, data, this.sessionId);
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}
