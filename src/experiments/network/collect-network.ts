import * as fs from "fs";
import * as path from "path";
import { Approach, createMeasurement, measurementCsvRow, NETWORK_CSV_HEADER, NetworkRole, NetworkSnapshot, validateMeasurements } from "./network-traffic";

function option(name: string): string { const index = process.argv.indexOf(name); if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}.`); return process.argv[index + 1]; }
function snapshot(file: string): NetworkSnapshot {
    const values = fs.readFileSync(file, "utf8").trim().split(",");
    if (values.length !== 7) throw new Error(`Malformed network snapshot ${file}.`);
    const [role, host, interfaceName, epochMs, monotonicNs, rxBytes, txBytes] = values;
    if (!/^(solid|service|client|replayer)$/.test(role)) throw new Error(`Malformed network snapshot role in ${file}.`);
    if (!host || !interfaceName) throw new Error(`Malformed network snapshot identity in ${file}.`);
    const number = (value: string, field: string): number => { if (!/^\d+$/.test(value)) throw new Error(`Malformed ${field} in ${file}.`); const parsed = Number(value); if (!Number.isSafeInteger(parsed)) throw new Error(`Malformed ${field} in ${file}: value is outside the exact integer range.`); return parsed; };
    return { role: role as NetworkRole, host, interfaceName, epochMs: number(epochMs, "epoch"), monotonicNs: number(monotonicNs, "monotonic time"), rxBytes: number(rxBytes, "RX"), txBytes: number(txBytes, "TX") };
}

const output = option("--output"); const approach = option("--approach") as Approach; const runId = option("--run-id"); const clientCount = Number(option("--client-count")); const iteration = Number(option("--iteration")); const input = option("--input-dir");
if (!Number.isInteger(clientCount) || !Number.isInteger(iteration)) throw new Error("client count and iteration must be integers.");
const measurements = fs.readdirSync(input).filter(name => name.endsWith(".start.csv")).map(name => {
    const role = name.replace(/\.start\.csv$/, ""); const end = path.join(input, `${role}.end.csv`);
    if (!fs.existsSync(end)) throw new Error(`Missing end network snapshot for ${role}.`);
    return createMeasurement(runId, approach, clientCount, iteration, snapshot(path.join(input, name)), snapshot(end));
});
validateMeasurements(approach, measurements);
fs.writeFileSync(output, `${NETWORK_CSV_HEADER.join(",")}\n${measurements.map(measurementCsvRow).join("\n")}\n`);
