import * as assert from "assert";
import { createMeasurement, expectedRoles, parseProcNetDev, selectExperimentInterface, validateMeasurements } from "../src/experiments/network/network-traffic";

const fixture = `Inter-|   Receive                                                |  Transmit\n face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n    lo: 10 0 0 0 0 0 0 0 20 0 0 0 0 0 0 0\n  enp1s0: 100 0 0 0 0 0 0 0 200 0 0 0 0 0 0 0\n`;
const counters = parseProcNetDev(fixture); assert.deepStrictEqual(counters.get("enp1s0"), { rxBytes: 100, txBytes: 200 });
assert.strictEqual(selectExperimentInterface(counters.keys(), "enp1s0"), "enp1s0"); assert.strictEqual(selectExperimentInterface(counters.keys(), "enp1s0", "enp1s0"), "enp1s0");
assert.throws(() => selectExperimentInterface(counters.keys(), "lo"), /Loopback/); assert.throws(() => selectExperimentInterface(counters.keys(), "missing"), /unavailable/);
assert.throws(() => parseProcNetDev(fixture + "  enp1s0: 1 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0\n"), /Duplicate/); assert.throws(() => parseProcNetDev("bad\n"), /Malformed/);
const start = { role: "solid" as const, host: "n079-11", interfaceName: "enp1s0", epochMs: 10, monotonicNs: 1_000_000_000, rxBytes: 100, txBytes: 200 };
const end = { ...start, epochMs: 3010, monotonicNs: 4_000_000_000, rxBytes: 700, txBytes: 1100 };
const measurement = createMeasurement("run", "heimdall", 2, 4, start, end); assert.strictEqual(measurement.rxBytes, 600); assert.strictEqual(measurement.txBytes, 900); assert.strictEqual(measurement.totalBytes, 1500); assert.strictEqual(measurement.durationMs, 3000); assert.strictEqual(measurement.totalMbps, .004);
assert.throws(() => createMeasurement("run", "heimdall", 2, 4, start, { ...end, rxBytes: 1 }), /regressed/); assert.throws(() => createMeasurement("run", "heimdall", 2, 4, start, { ...end, interfaceName: "eth0" }), /changed/);
const roles = (approach: "heimdall" | "notification-aggregator" | "without-aggregator") => expectedRoles(approach).map(role => ({ ...measurement, approach, role }));
validateMeasurements("without-aggregator", roles("without-aggregator")); validateMeasurements("heimdall", roles("heimdall")); validateMeasurements("notification-aggregator", roles("notification-aggregator"));
assert.throws(() => validateMeasurements("heimdall", roles("heimdall").slice(1)), /solid/); assert.throws(() => validateMeasurements("without-aggregator", [...roles("without-aggregator"), { ...measurement, approach: "without-aggregator" as const, role: "client" as const }]), /exactly one/);
assert.throws(() => validateMeasurements("without-aggregator", [...roles("without-aggregator"), { ...measurement, approach: "without-aggregator" as const, role: "service" as const }]), /Unexpected/);
console.log("network traffic tests passed");
