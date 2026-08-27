import * as fs from "fs";
import * as path from "path";
import { E4WorkloadMode, e4ExpectedInvariants } from "../config/saturation";

export type Validation = { valid: boolean; errors: string[] };
function rows(file: string): Record<string, string>[] {
    const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/); if (lines.length < 2) return [];
    const header = lines[0].split(","); return lines.slice(1).filter(Boolean).map(line => Object.fromEntries(header.map((key, i) => [key, line.split(",")[i] || ""])));
}
/** Counts are read only from Heimdall's emitted initialization artifact; no inferred counts. */
export function validateE4SemanticInvariants(initializationCsv: string, mode: E4WorkloadMode, n: number): Validation {
    const errors: string[] = []; if (!fs.existsSync(initializationCsv)) return { valid: false, errors: [`missing ${initializationCsv}`] };
    const expected = e4ExpectedInvariants(mode, n); const data = rows(initializationCsv);
    const count = (names: string[]) => data.filter(row => names.includes(row.operation)).length;
    const actual = { registrations: count(["query_registration", "registration"]), queryCreated: count(["shared_query_instance_created", "query_created"]), queryReused: count(["shared_query_instance_reused", "query_reused"]), streamSubscriptions: count(["stream_subscription", "subscription_ready"]) };
    for (const key of Object.keys(expected) as (keyof typeof expected)[]) if (actual[key] !== expected[key]) errors.push(`${key}: expected ${expected[key]}, observed ${actual[key]} in Heimdall initialization artifact`);
    return { valid: !errors.length, errors };
}
if (require.main === module) {
    const [file, mode, count] = process.argv.slice(2); const result = validateE4SemanticInvariants(path.resolve(file), mode as E4WorkloadMode, Number(count));
    process.stdout.write(JSON.stringify(result) + "\n"); process.exitCode = result.valid ? 0 : 1;
}
