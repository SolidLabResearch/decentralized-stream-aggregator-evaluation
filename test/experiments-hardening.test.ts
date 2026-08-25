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
import * as crypto from "crypto";

function writeHeimdallFixture(directory: string, creations: number, clientHashes?: string[]): void {
    const query = buildActivityIndexQuery(loadExperimentConfig(path.resolve(__dirname, "../src/experiments/config/experiment-config.n079.test.json")).streams);
    const key = crypto.createHash("md5").update(query.replace(/\s/g, "")).digest("hex");
    fs.writeFileSync(path.join(directory, "metadata.json"), JSON.stringify({ queryHash: crypto.createHash("sha256").update(query).digest("hex"), queryText: query }));
    fs.writeFileSync(path.join(directory, "client-host-resource.csv"), "timestamp,cpu_user,cpu_nice,cpu_system,cpu_idle,cpu_iowait,cpu_irq,cpu_softirq,cpu_steal\n1,1,1,1,1,1,1,1,1\n");
    fs.writeFileSync(path.join(directory, "service-resource.csv"), "timestamp\n1\n"); fs.mkdirSync(path.join(directory, "service"));
    const initialization = ["run_id,approach,client_id,query_id,operation", ...Array.from({ length: creations }, (_, index) => `run,heimdall,${index},${key},shared_query_instance_created`), `run,heimdall,1,${key},shared_query_instance_reused`].join("\n") + "\n";
    fs.writeFileSync(path.join(directory, "service", "initialization.csv"), initialization);
    fs.writeFileSync(path.join(directory, "service", "window-processing.csv"), "operation,window_id\nr2r_first_result,/w1: shared\n");
    for (let client = 0; client < 2; client += 1) { const prefix = path.join(directory, `client-${client}`); const hash = clientHashes?.[client] || crypto.createHash("sha256").update(query).digest("hex"); fs.writeFileSync(`${prefix}-operations.csv`, `client_id,query_id,operation,duration_ms,start_monotonic_ns,end_monotonic_ns\n${client},${hash},registration_to_first_result,1,1,2\n`); fs.writeFileSync(`${prefix}-resource.csv`, "timestamp\n1\n"); fs.writeFileSync(`${prefix}-results.csv`, "result\nx\n"); fs.writeFileSync(`${prefix}-out-of-order.csv`, "event\n"); fs.writeFileSync(`${prefix}-ready.json`, "{}\n"); fs.writeFileSync(`${prefix}-first-result.ready`, "ok\n"); }
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
    const cpu = parseProcStat("cpu  1 2 3 4 5 6 7 8 0 0\n");
    assert.deepStrictEqual(cpu, { user: 1, nice: 2, system: 3, idle: 4, iowait: 5, irq: 6, softirq: 7, steal: 8, total: 36 });
    const resource = path.join(directory, "monitor.csv"); const monitor = monitorCurrentProcess(resource, 5); await monitor.stop();
    assert.ok(fs.readFileSync(resource, "utf8").split("\n").length >= 2, "monitor stop flushes its stream");
    fs.writeFileSync(path.join(directory, "quoted.csv"), 'window_id,operation\n"/w1: a,b",r2r_first_result\n');
    assert.ok(fs.readFileSync(path.join(directory, "quoted.csv"), "utf8").includes('"/w1: a,b"'));
    fs.rmSync(directory, { recursive: true, force: true });
    const validationDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "heimdall-reuse-")); writeHeimdallFixture(validationDirectory, 1); assert.deepStrictEqual(validateMultiClientRepetition(validationDirectory, "heimdall", 2), { valid: true, errors: [] }, "one creation and one reuse passes"); fs.rmSync(validationDirectory, { recursive: true, force: true });
    const duplicateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "heimdall-duplicate-")); writeHeimdallFixture(duplicateDirectory, 2); assert.ok(!validateMultiClientRepetition(duplicateDirectory, "heimdall", 2).valid, "two shared creations fail"); fs.rmSync(duplicateDirectory, { recursive: true, force: true });
    const mismatchDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "heimdall-mismatch-")); writeHeimdallFixture(mismatchDirectory, 1, [undefined as unknown as string, "wrong"]); assert.ok(!validateMultiClientRepetition(mismatchDirectory, "heimdall", 2).valid, "a mismatching client hash fails"); fs.rmSync(mismatchDirectory, { recursive: true, force: true });
}
main().then(() => console.log("experiment hardening tests passed"));
