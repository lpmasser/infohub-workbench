import { error_message } from "./error_message";

type LogLevel = "error" | "warn" | "info" | "debug";

type LogContext = Record<string, unknown>;

export interface Logger {
  error: (msg: string, ctx?: LogContext) => void;
  warn: (msg: string, ctx?: LogContext) => void;
  info: (msg: string, ctx?: LogContext) => void;
  debug: (msg: string, ctx?: LogContext) => void;
  from_error: (msg: string, err: unknown) => void;
}

function format_context(ctx: LogContext): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(ctx)) {
    if (key === "error") {
      parts.push(error_message(value));
    } else {
      parts.push(`${key}=${String(value)}`);
    }
  }
  return parts.join(" ");
}

function format_message(module: string, msg: string, ctx?: LogContext): string {
  const prefix = module ? `[${module}] ` : "";
  const suffix = ctx ? ` ${format_context(ctx)}` : "";
  return `${prefix}${msg}${suffix}`;
}

function log_at(level: LogLevel, msg: string) {
  console[level](msg);
}

function create_scoped_log_fn(
  module: string,
  level: LogLevel,
): (msg: string, ctx?: LogContext) => void {
  return (msg: string, ctx?: LogContext) => {
    log_at(level, format_message(module, msg, ctx));
  };
}

export function create_logger(module: string): Logger {
  const scoped_error = create_scoped_log_fn(module, "error");
  return {
    error: scoped_error,
    warn: create_scoped_log_fn(module, "warn"),
    info: create_scoped_log_fn(module, "info"),
    debug: create_scoped_log_fn(module, "debug"),
    from_error(msg: string, err: unknown) {
      scoped_error(msg, { error: err });
    },
  };
}

export const logger: Logger = {
  error(msg: string, ctx?: LogContext) {
    log_at("error", format_message("", msg, ctx));
  },
  warn(msg: string, ctx?: LogContext) {
    log_at("warn", format_message("", msg, ctx));
  },
  info(msg: string, ctx?: LogContext) {
    log_at("info", format_message("", msg, ctx));
  },
  debug(msg: string, ctx?: LogContext) {
    log_at("debug", format_message("", msg, ctx));
  },
  from_error(msg: string, err: unknown) {
    log_at("error", format_message("", msg, { error: err }));
  },
};
