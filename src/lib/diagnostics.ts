export type DiagnosticLevel = "info" | "warning" | "error";

type DiagnosticEntry = {
  timestamp: string;
  level: DiagnosticLevel;
  event: string;
  details?: unknown;
};

const STORAGE_KEY = "frame-fusion-studio:diagnostics:v1";
const MAX_ENTRIES = 250;
const MAX_DETAIL_LENGTH = 5000;

function redact(value: string): string {
  return value
    .replace(/content:\/\/[^\s"'\x60]+/gi, "[content-uri]")
    .replace(/file:\/\/[^\s"'\x60]+/gi, "[file-uri]")
    .replace(/(authorization|access_token|refresh_token|api_key|password)(\s*[:=]\s*)[^\s,;]+/gi, "$1$2[redacted]")
    .slice(0, MAX_DETAIL_LENGTH);
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return redact(value);
  if (depth > 5) return "[max-depth]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 50);
    return Object.fromEntries(entries.map(([key, item]) => [key, sanitize(item, depth + 1)]));
  }
  return redact(String(value));
}

function readEntries(): DiagnosticEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as DiagnosticEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordDiagnostic(
  level: DiagnosticLevel,
  event: string,
  details?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  try {
    const entries = readEntries();
    entries.push({
      timestamp: new Date().toISOString(),
      level,
      event: redact(event),
      ...(details ? { details: sanitize(details) } : {}),
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Diagnostics must never interrupt the operation being diagnosed.
  }
}

export function recordDiagnosticInfo(event: string, details?: Record<string, unknown>): void {
  recordDiagnostic("info", event, details);
}

export function recordDiagnosticWarning(event: string, details?: Record<string, unknown>): void {
  recordDiagnostic("warning", event, details);
}

export function recordDiagnosticError(
  event: string,
  error: unknown,
  details?: Record<string, unknown>,
): void {
  const errorDetails =
    error instanceof Error
      ? {
          name: error.name,
          message: redact(error.message),
          stack: error.stack ? redact(error.stack) : undefined,
        }
      : { message: redact(String(error)) };
  recordDiagnostic("error", event, { ...details, error: errorDetails });
}

export function getDiagnosticReport(nativeDiagnostics?: string): string {
  const runtime =
    typeof navigator === "undefined"
      ? {}
      : {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
        };
  return JSON.stringify(
    {
      app: "Frame Fusion Studio",
      generatedAt: new Date().toISOString(),
      runtime,
      note: "App diagnostics only. Source video data and content:// URIs are not included.",
      events: readEntries(),
      nativeAndroidDiagnostics: nativeDiagnostics ? redact(nativeDiagnostics) : undefined,
    },
    null,
    2,
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    recordDiagnosticError("window.error", event.error ?? event.message, {
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    recordDiagnosticError("window.unhandledrejection", event.reason);
  });
}
