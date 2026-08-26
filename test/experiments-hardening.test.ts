import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { RawInstrumentation } from "../src/experiments/clients/shared/instrumentation";
import { monitorCurrentProcess } from "../src/experiments/monitoring/process-monitor";
import { parseProcStat } from "../src/experiments/monitoring/host-monitor";
import { validateMultiClientRepetition } from "../src/experiments/validation/multi-client-repetition";
import { buildActivityIndexQuery } from "../src/experiments/config/query";
import { loadExperimentConfig } from "../src/experiments/config/config";
import { resolveClientIndices } from "../src/experiments/clients/shared/runtime";
import * as crypto from "crypto";

function writeHeimdallFixture(directory: string, creations: number, clientHashes?: string[], staged = false): void {
    const query = buildActivityIndexQuery(loadExperimentConfig(path.resolve(__dirname, "../src/experiments/config/experiment-config.n079.test.json")).streams);
    const key = crypto.createHash("md5").update(query.replace(/\s/g, "")).digest("hex");
    fs.writeFileSync(path.join(directory, "metadata.json"), JSON.stringify({ queryHash: crypto.createHash("sha256").update(query).digest("hex"), queryText: query, ...(staged ? { clientArrivalMode: "staged-reuse" } : {}) }));
    fs.writeFileSync(path.join(directory, "client-host-resource.csv"), "timestamp,cpu_user,cpu_nice,cpu_system,cpu_idle,cpu_iowait,cpu_irq,cpu_softirq,cpu_steal\n1,1,1,1,1,1,1,1,1\n");
    fs.writeFileSync(path.join(directory, "service-resource.csv"), "timestamp\n1\n"); fs.mkdirSync(path.join(directory, "service"));
    const initialization = ["run_id,approach,client_id,query_id,operation", ...Array.from({ length: creations }, (_, index) => `run,heimdall,${index},${key},shared_query_instance_created`), `run,heimdall,1,${key},shared_query_instance_reused`, ...(staged ? [`run,heimdall,0,${key},stream_subscription`, `run,heimdall,0,${key},stream_subscription`, `run,heimdall,0,${key},stream_subscription`] : [])].join("\n") + "\n";
    fs.writeFileSync(path.join(directory, "service", "initialization.csv"), initialization);
    fs.writeFileSync(path.join(directory, "service", "window-processing.csv"), "operation,window_id\nr2r_first_result,/w1: shared\n");
    for (let client = 0; client < 2; client += 1) { const prefix = path.join(directory, `client-${client}`); const hash = clientHashes?.[client] || crypto.createHash("sha256").update(query).digest("hex"); const operation = staged ? (client === 0 ? "cold_registration_to_first_result" : "reuse_registration_to_first_result") : "registration_to_first_result"; const role = staged ? `,${client === 0 ? "cold" : "reuse"}` : ""; fs.writeFileSync(`${prefix}-operations.csv`, `client_id,query_id,operation,duration_ms,start_monotonic_ns,end_monotonic_ns${staged ? ",client_role" : ""}\n${client},${hash},${operation},1,1,2${role}\n`); fs.writeFileSync(`${prefix}-resource.csv`, "timestamp\n1\n"); fs.writeFileSync(`${prefix}-results.csv`, staged ? "result_id,result_monotonic_ns\nr,2\n" : "result\nx\n"); fs.writeFileSync(`${prefix}-out-of-order.csv`, "event\n"); fs.writeFileSync(`${prefix}-ready.json`, "{}\n"); fs.writeFileSync(`${prefix}-first-result.ready`, "ok\n"); if (staged) { fs.writeFileSync(`${prefix}-registration.json`, JSON.stringify({ registration_monotonic_ns: 1 })); fs.writeFileSync(`${prefix}-first-result.json`, JSON.stringify({ client_role: client === 0 ? "cold" : "reuse", result_monotonic_ns: 2 })); } }
    if (staged) { for (const marker of ["staged-client-0-ready.json", "staged-late-clients-phase.json", "staged-late-clients-ready.json", "staged-all-late-clients-completed.json"]) fs.writeFileSync(path.join(directory, marker), "{}\n"); fs.writeFileSync(path.join(directory, "staged-client-0-first-genuine-result.json"), JSON.stringify({ epoch_ms: 1 }) + "\n"); fs.writeFileSync(path.join(directory, "staged-late-clients-launched.json"), JSON.stringify({ client_ids: [1], launched_epoch_ms: 2 }) + "\n"); }
}

function writeNotificationStagedFixture(directory: string): void {
    fs.writeFileSync(path.join(directory, "metadata.json"), JSON.stringify({ clientArrivalMode: "staged-reuse", architectureBehavior: "shared_upstream_reuse" }));
    fs.writeFileSync(path.join(directory, "client-host-resource.csv"), "timestamp,cpu_user,cpu_nice,cpu_system,cpu_idle,cpu_iowait,cpu_irq,cpu_softirq,cpu_steal\n1,1,1,1,1,1,1,1,1\n");
    fs.writeFileSync(path.join(directory, "service-resource.csv"), "timestamp\n1\n");
    fs.mkdirSync(path.join(directory, "service"));
    fs.writeFileSync(path.join(directory, "service", "service.log"), "Server listening on port 8085\nSubscribed to the inbox container location: inbox-x\nSubscribed to the inbox container location: inbox-y\nSubscribed to the inbox container location: inbox-z\n");
    for (let client = 0; client < 2; client += 1) {
        const prefix = path.join(directory, `client-${client}`);
        const role = client === 0 ? "cold" : "join";
        const latency = client === 0 ? "cold_registration_to_first_result" : "join_registration_to_first_result";
        fs.writeFileSync(`${prefix}-operations.csv`, `client_id,query_id,operation,window_id,duration_ms,start_monotonic_ns,end_monotonic_ns,client_role\n${client},q,stream_discovery,,,1,2,${role}\n${client},q,stream_subscription,,,2,3,${role}\n${client},q,parsing_timestamp_extraction,,,3,4,${role}\n${client},q,rsp_insertion,/w1: local,,4,5,${role}\n${client},q,r2r_first_result,/w1: local,,5,6,${role}\n${client},q,${latency},,1,1,2,${role}\n`);
        fs.writeFileSync(`${prefix}-results.csv`, "result_id,result_monotonic_ns\n0,2\n");
        fs.writeFileSync(`${prefix}-resource.csv`, "timestamp\n1\n");
        fs.writeFileSync(`${prefix}-out-of-order.csv`, "event\n");
        fs.writeFileSync(`${prefix}-ready.json`, "{}\n");
        fs.writeFileSync(`${prefix}-first-result.ready`, "ok\n");
        fs.writeFileSync(`${prefix}-registration.json`, JSON.stringify({ registration_monotonic_ns: 1 }));
        fs.writeFileSync(`${prefix}-first-result.json`, JSON.stringify({ client_role: role, result_monotonic_ns: 2 }));
    }
    for (const marker of ["staged-client-0-ready.json", "staged-client-0-first-genuine-result.json", "staged-late-clients-launched.json", "staged-late-clients-phase.json", "staged-late-clients-ready.json", "staged-all-late-clients-completed.json"]) fs.writeFileSync(path.join(directory, marker), JSON.stringify(marker === "staged-client-0-first-genuine-result.json" ? { epoch_ms: 1 } : marker === "staged-late-clients-launched.json" ? { client_ids: [1], launched_epoch_ms: 2 } : {}) + "\n");
}

async function main(): Promise<void> {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "experiment-hardening-"));
    const raw = new RawInstrumentation(directory, { runId: "test", approach: "without-aggregator", clientId: "0", queryId: "q" });
    raw.markReady("test boundary");
    raw.observeFirstResult();
    await raw.close();
    assert.ok(fs.existsSync(path.join(directory, "client-0-ready.json")), "one atomic marker is emitted per client");
    assert.strictEqual(fs.readdirSync(directory).filter(name => /-ready\.json$/.test(name)).length, 1);
    assert.strictEqual((fs.readFileSync(path.join(directory, "client-0-operations.csv"), "utf8").match(/registration_to_first_result/g) || []).length, 1);
    const stagedRaw = new RawInstrumentation(directory, { runId: "test-staged", approach: "heimdall", clientId: "1", queryId: "q" });
    stagedRaw.markRegistrationIssued("reuse"); stagedRaw.markReady("query_ready"); const stagedFirst = stagedRaw.observeFirstResult({ resultId: "result-1", windowId: "w1" }); await stagedRaw.close();
    assert.strictEqual(stagedFirst.latencyOperation, "reuse_registration_to_first_result");
    assert.match(fs.readFileSync(path.join(directory, "client-1-operations.csv"), "utf8"), /reuse_registration_to_first_result/);
    const cpu = parseProcStat("cpu  1 2 3 4 5 6 7 8 0 0\n");
    assert.deepStrictEqual(cpu, { user: 1, nice: 2, system: 3, idle: 4, iowait: 5, irq: 6, softirq: 7, steal: 8, total: 36 });
    const resource = path.join(directory, "monitor.csv"); const monitor = monitorCurrentProcess(resource, 5); await monitor.stop();
    assert.ok(fs.readFileSync(resource, "utf8").split("\n").length >= 2, "monitor stop flushes its stream");
    fs.writeFileSync(path.join(directory, "quoted.csv"), 'window_id,operation\n"/w1: a,b",r2r_first_result\n');
    assert.ok(fs.readFileSync(path.join(directory, "quoted.csv"), "utf8").includes('"/w1: a,b"'));
    fs.rmSync(directory, { recursive: true, force: true });
    assert.deepStrictEqual(resolveClientIndices(5, ["node", "launcher"]), [0, 1, 2, 3, 4]);
    assert.deepStrictEqual(resolveClientIndices(5, ["node", "launcher", "--client-ids", "0,2,4"]), [0, 2, 4]);
    assert.throws(() => resolveClientIndices(5, ["node", "launcher", "--client-ids", "1,1"]), /unique/);
    const validationDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "heimdall-reuse-")); writeHeimdallFixture(validationDirectory, 1); assert.deepStrictEqual(validateMultiClientRepetition(validationDirectory, "heimdall", 2), { valid: true, errors: [] }, "one creation and one reuse passes"); fs.rmSync(validationDirectory, { recursive: true, force: true });
    const duplicateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "heimdall-duplicate-")); writeHeimdallFixture(duplicateDirectory, 2); assert.ok(!validateMultiClientRepetition(duplicateDirectory, "heimdall", 2).valid, "two shared creations fail"); fs.rmSync(duplicateDirectory, { recursive: true, force: true });
    const mismatchDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "heimdall-mismatch-")); writeHeimdallFixture(mismatchDirectory, 1, [undefined as unknown as string, "wrong"]); assert.ok(!validateMultiClientRepetition(mismatchDirectory, "heimdall", 2).valid, "a mismatching client hash fails"); fs.rmSync(mismatchDirectory, { recursive: true, force: true });
    const stagedDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "heimdall-staged-")); writeHeimdallFixture(stagedDirectory, 1, undefined, true); assert.deepStrictEqual(validateMultiClientRepetition(stagedDirectory, "heimdall", 2), { valid: true, errors: [] }, "staged cold/reuse evidence passes"); fs.rmSync(stagedDirectory, { recursive: true, force: true });
    const notificationDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "notification-staged-")); writeNotificationStagedFixture(notificationDirectory); assert.deepStrictEqual(validateMultiClientRepetition(notificationDirectory, "notification-aggregator", 2), { valid: true, errors: [] }, "staged notification join evidence passes"); fs.rmSync(notificationDirectory, { recursive: true, force: true });
}
main().then(() => console.log("experiment hardening tests passed"));
