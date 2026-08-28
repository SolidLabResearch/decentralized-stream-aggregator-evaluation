import * as fs from "fs";
import * as path from "path";

type Entry = { name: string; type: string; sizeBytes: number; mtimeMs: number };
type Snapshot = { phase: "before" | "after"; notificationDirectory: string; directoryExists: boolean; count: number; entries: Entry[]; observedAtUtc: string };

function readSnapshot(file: string): Snapshot { return JSON.parse(fs.readFileSync(file, "utf8")) as Snapshot; }

export function compareE4NotificationState(beforeFile: string, afterFile: string) {
    const before = readSnapshot(beforeFile); const after = readSnapshot(afterFile);
    const beforeNames = new Set(before.entries.map(entry => entry.name)); const afterNames = new Set(after.entries.map(entry => entry.name));
    return { before, after, countChanged: before.count !== after.count, added: after.entries.filter(entry => !beforeNames.has(entry.name)), removed: before.entries.filter(entry => !afterNames.has(entry.name)) };
}

if (require.main === module) {
    const [beforeFile, afterFile, outputFile] = process.argv.slice(2);
    if (!beforeFile || !afterFile || !outputFile) throw new Error("Usage: e4-notification-state.ts BEFORE_JSON AFTER_JSON OUTPUT_JSON");
    fs.mkdirSync(path.dirname(outputFile), { recursive: true }); fs.writeFileSync(outputFile, `${JSON.stringify(compareE4NotificationState(beforeFile, afterFile), null, 2)}\n`);
}
