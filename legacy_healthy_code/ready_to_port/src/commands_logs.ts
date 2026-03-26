import fs from "node:fs";
import type { CommandsInteraction } from "./commands.js";

export type CommandsLogEntry = CommandsInteraction;

export function appendCommandsLog(path: string, entry: CommandsLogEntry) {
  const line = `${JSON.stringify(entry)}\n`;
  fs.appendFileSync(path, line, "utf8");
}

export function readCommandsLogs(path: string, limit = 200): CommandsLogEntry[] {
  try {
    const raw = fs.readFileSync(path, "utf8");
    const lines = raw
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    const out: CommandsLogEntry[] = [];
    for (const ln of lines.slice(-Math.max(1, limit))) {
      try {
        out.push(JSON.parse(ln) as CommandsLogEntry);
      } catch {
        // ignore malformed lines
      }
    }
    return out.reverse();
  } catch {
    return [];
  }
}
