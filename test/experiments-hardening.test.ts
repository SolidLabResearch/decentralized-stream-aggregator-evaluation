import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { RawInstrumentation } from "../src/experiments/clients/shared/instrumentation";
import { monitorCurrentProcess } from "../src/experiments/monitoring/process-monitor";
import { parseProcStat } from "../src/experiments/monitoring/host-monitor";
import { validateMultiClientRepetition } from "../src/experiments/validation/multi-client-repetition";

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
}
main().then(() => console.log("experiment hardening tests passed"));
