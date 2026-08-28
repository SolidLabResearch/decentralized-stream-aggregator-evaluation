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
function csvRows(file: string): Record<string, string>[] {
    if (!fs.existsSync(file)) return [];
    const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/); if (lines.length < 2) return [];
    const header = lines[0].split(","); return lines.slice(1).filter(Boolean).map(line => Object.fromEntries(header.map((key, i) => [key, line.split(",")[i] || ""])));
}
export function validateE4Attempt(attemptRoot: string, n: number): Validation {
    const errors: string[] = []; const iteration = path.join(attemptRoot, "iteration-01");
    const initialization = path.join(iteration, "service", "initialization.csv");
    const invariant = validateE4SemanticInvariants(initialization, "no-reuse", n); errors.push(...invariant.errors);
    if (!fs.existsSync(iteration)) errors.push(`missing ${iteration}`);
    let ready = 0; let firstResults = 0;
    for (let client = 0; client < n; client += 1) {
        if (fs.existsSync(path.join(iteration, `client-${client}-ready.json`))) ready += 1; else errors.push(`client ${client} missing readiness marker`);
        if (fs.existsSync(path.join(iteration, `client-${client}-first-result.ready`)) && csvRows(path.join(iteration, `client-${client}-results.csv`)).length > 0) firstResults += 1; else errors.push(`client ${client} missing first-result marker/result`);
    }
    if (ready !== n) errors.push(`ready clients: expected ${n}, observed ${ready}`);
    if (firstResults !== n) errors.push(`first-result clients: expected ${n}, observed ${firstResults}`);
    return { valid: errors.length === 0, errors };
}
if (require.main === module) {
    const [file, mode, count] = process.argv.slice(2); const result = mode === "attempt" ? validateE4Attempt(path.resolve(file), Number(count)) : validateE4SemanticInvariants(path.resolve(file), mode as E4WorkloadMode, Number(count));
    process.stdout.write(JSON.stringify(result) + "\n"); process.exitCode = result.valid ? 0 : 1;
}
