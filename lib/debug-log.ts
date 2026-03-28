import fs from "node:fs";
import path from "node:path";

const logsDir = path.join(process.cwd(), "logs");

function ensureLogsDir() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

export function appendDebugLog(fileName: string, event: string, details?: Record<string, unknown>) {
  ensureLogsDir();

  const logPath = path.join(logsDir, fileName);
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    details: details ?? {}
  };

  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

export function getDebugLogPath(fileName: string) {
  ensureLogsDir();
  return path.join(logsDir, fileName);
}
