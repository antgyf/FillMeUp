import fs from "node:fs";
import path from "node:path";

const logDir = path.join(process.cwd(), "data", "logs");
const resumeParserLogFile = path.join(logDir, "resume-parser.log");

type ResumeParserLogLevel = "info" | "warn" | "error";

export function getResumeParserLogFile() {
  return resumeParserLogFile;
}

export function logResumeParserEvent(level: ResumeParserLogLevel, event: string, details?: Record<string, unknown>) {
  ensureLogFile();

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(details ?? {})
  };

  const line = `${JSON.stringify(entry)}\n`;
  fs.appendFileSync(resumeParserLogFile, line, "utf8");

  if (level === "error") {
    console.error("[resume-parser]", entry);
    return;
  }

  if (level === "warn") {
    console.warn("[resume-parser]", entry);
    return;
  }

  console.info("[resume-parser]", entry);
}

function ensureLogFile() {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  if (!fs.existsSync(resumeParserLogFile)) {
    fs.writeFileSync(resumeParserLogFile, "", "utf8");
  }
}
