export type NetworkRole = "solid" | "service" | "client" | "replayer";
export type Approach = "heimdall" | "notification-aggregator" | "without-aggregator";

export const NETWORK_CSV_HEADER = [
    "run_id", "approach", "client_count", "iteration", "role", "host", "interface",
    "start_epoch_ms", "end_epoch_ms", "start_monotonic_ns", "end_monotonic_ns", "duration_ms",
    "start_rx_bytes", "end_rx_bytes", "rx_bytes", "start_tx_bytes", "end_tx_bytes", "tx_bytes",
    "total_bytes", "rx_mbps", "tx_mbps", "total_mbps",
] as const;

export interface InterfaceCounters { rxBytes: number; txBytes: number; }
export interface NetworkSnapshot extends InterfaceCounters {
    role: NetworkRole; host: string; interfaceName: string; epochMs: number; monotonicNs: number;
}
export interface NetworkMeasurement {
    runId: string; approach: Approach; clientCount: number; iteration: number; role: NetworkRole; host: string; interfaceName: string;
    startEpochMs: number; endEpochMs: number; startMonotonicNs: number; endMonotonicNs: number; durationMs: number;
    startRxBytes: number; endRxBytes: number; rxBytes: number; startTxBytes: number; endTxBytes: number; txBytes: number; totalBytes: number;
    rxMbps: number; txMbps: number; totalMbps: number;
}

function integer(value: string, name: string): number {
    if (!/^\d+$/.test(value)) throw new Error(`Malformed ${name}: expected a non-negative integer.`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) throw new Error(`Malformed ${name}: value is outside the exact integer range.`);
    return parsed;
}

/** Parse one Linux /proc/net/dev snapshot without ever summing virtual interfaces. */
export function parseProcNetDev(input: string): Map<string, InterfaceCounters> {
    const lines = input.trimEnd().split(/\r?\n/);
    if (lines.length < 3) throw new Error("Malformed /proc/net/dev: missing header or interface rows.");
    const counters = new Map<string, InterfaceCounters>();
    for (const line of lines.slice(2)) {
        const match = line.match(/^\s*([^:\s]+):\s*(.*?)\s*$/);
        if (!match) throw new Error(`Malformed /proc/net/dev interface row: ${line}`);
        const fields = match[2].trim().split(/\s+/);
        if (fields.length !== 16) throw new Error(`Malformed /proc/net/dev counters for ${match[1]}.`);
        if (counters.has(match[1])) throw new Error(`Duplicate interface in /proc/net/dev: ${match[1]}.`);
        counters.set(match[1], { rxBytes: integer(fields[0], `${match[1]} RX bytes`), txBytes: integer(fields[8], `${match[1]} TX bytes`) });
    }
    return counters;
}

export function selectExperimentInterface(available: Iterable<string>, routeInterface: string | undefined, explicitInterface?: string): string {
    const names = new Set(available);
    const selected = explicitInterface || routeInterface;
    if (!selected) throw new Error("Could not resolve an experiment interface from the route; set an explicit interface override.");
    if (selected === "lo") throw new Error("Loopback is not a valid experiment network interface.");
    if (!names.has(selected)) throw new Error(`Selected experiment interface ${selected} is unavailable.`);
    return selected;
}

export function expectedRoles(approach: Approach): NetworkRole[] {
    return approach === "without-aggregator" ? ["solid", "client", "replayer"] : ["solid", "service", "client", "replayer"];
}

export function createMeasurement(runId: string, approach: Approach, clientCount: number, iteration: number, start: NetworkSnapshot, end: NetworkSnapshot): NetworkMeasurement {
    if (start.role !== end.role || start.host !== end.host) throw new Error("Start and end snapshots belong to different host roles.");
    if (start.interfaceName !== end.interfaceName) throw new Error(`Experiment interface changed during repetition for ${start.role}: ${start.interfaceName} -> ${end.interfaceName}.`);
    if (end.monotonicNs <= start.monotonicNs) throw new Error(`Non-positive network measurement duration for ${start.role}.`);
    if (end.rxBytes < start.rxBytes) throw new Error(`RX counter regressed for ${start.role}; interface reset or invalid snapshot.`);
    if (end.txBytes < start.txBytes) throw new Error(`TX counter regressed for ${start.role}; interface reset or invalid snapshot.`);
    const rxBytes = end.rxBytes - start.rxBytes; const txBytes = end.txBytes - start.txBytes; const totalBytes = rxBytes + txBytes;
    const durationMs = Number(end.monotonicNs - start.monotonicNs) / 1_000_000;
    const mbps = (bytes: number): number => bytes * 8_000 / (end.monotonicNs - start.monotonicNs);
    return { runId, approach, clientCount, iteration, role: start.role, host: start.host, interfaceName: start.interfaceName,
        startEpochMs: start.epochMs, endEpochMs: end.epochMs, startMonotonicNs: start.monotonicNs, endMonotonicNs: end.monotonicNs, durationMs,
        startRxBytes: start.rxBytes, endRxBytes: end.rxBytes, rxBytes, startTxBytes: start.txBytes, endTxBytes: end.txBytes, txBytes, totalBytes,
        rxMbps: mbps(rxBytes), txMbps: mbps(txBytes), totalMbps: mbps(totalBytes) };
}

export function validateMeasurements(approach: Approach, measurements: NetworkMeasurement[]): void {
    const required = expectedRoles(approach); const found = new Map<NetworkRole, number>();
    for (const measurement of measurements) found.set(measurement.role, (found.get(measurement.role) || 0) + 1);
    for (const role of required) if (found.get(role) !== 1) throw new Error(`Expected exactly one network measurement for role ${role}; found ${found.get(role) || 0}.`);
    for (const role of found.keys()) if (!required.includes(role)) throw new Error(`Unexpected network measurement role ${role} for ${approach}.`);
}

export function measurementCsvRow(value: NetworkMeasurement): string {
    const fields = [value.runId, value.approach, value.clientCount, value.iteration, value.role, value.host, value.interfaceName,
        value.startEpochMs, value.endEpochMs, value.startMonotonicNs, value.endMonotonicNs, value.durationMs,
        value.startRxBytes, value.endRxBytes, value.rxBytes, value.startTxBytes, value.endTxBytes, value.txBytes, value.totalBytes,
        value.rxMbps, value.txMbps, value.totalMbps];
    return fields.join(",");
}
