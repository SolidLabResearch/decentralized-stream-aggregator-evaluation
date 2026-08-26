import * as crypto from "crypto";
import * as fs from "fs";
import { SaturationMode, StreamTriplet } from "./config";
import { buildActivityIndexQuery } from "./query";

export type SaturationQuery = {
    clientIndex: number; queryText: string; queryHash: string; heimdallReuseIdentity: string; windowName: string;
    reuseClassification: "maximum-reuse" | "controlled-non-reusable-identity";
    computationalEquivalence: "same-streams-data-windows-bgp-projection-and-expected-cardinality";
};

// This is the exact identity derivation in solid-stream-aggregator/src/utils/Util.ts.
export function heimdallReuseIdentity(query: string): string { return crypto.createHash("md5").update(query.replace(/\s/g, "")).digest("hex"); }
export function saturationWindowName(clientIndex: number): string { return `:satw${String(clientIndex).padStart(4, "0")}`; }

export function buildSaturationQuery(streams: StreamTriplet, mode: SaturationMode, clientIndex: number): SaturationQuery {
    if (!Number.isInteger(clientIndex) || clientIndex < 0) throw new Error("Saturation client index must be a non-negative integer.");
    const canonical = buildActivityIndexQuery(streams);
    const identityIndex = mode === "same-query" ? 0 : clientIndex;
    const windowName = saturationWindowName(identityIndex);
    // FILTER literals are deliberately not used: the installed Heimdall equivalence checker ignores FILTER nodes.
    // It does, however, compare the first window name before BGP isomorphism. Renaming the registered first
    // window and its matching GRAPH reference leaves all input streams, ranges, steps, BGP triples and SELECT unchanged.
    // This makes a controlled non-reusable identity, not a different semantic analytical task or a more complex query.
    const queryText = canonical.replace(/:w1/g, windowName);
    return { clientIndex, queryText, queryHash: crypto.createHash("sha256").update(queryText).digest("hex"), heimdallReuseIdentity: heimdallReuseIdentity(queryText), windowName,
        reuseClassification: mode === "same-query" ? "maximum-reuse" : "controlled-non-reusable-identity",
        computationalEquivalence: "same-streams-data-windows-bgp-projection-and-expected-cardinality" };
}

export function buildSaturationQueries(streams: StreamTriplet, mode: SaturationMode, clientCount: number): SaturationQuery[] {
    if (!Number.isInteger(clientCount) || clientCount < 1) throw new Error("Saturation client count must be positive.");
    return Array.from({ length: clientCount }, (_, clientIndex) => buildSaturationQuery(streams, mode, clientIndex));
}

export function auditSaturationDataset(file: string): { file: string; observations: number; minValue: number; maxValue: number; canonicalObservationShape: boolean } {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
    const values = lines.map(line => Number(/<https:\/\/saref\.etsi\.org\/core\/hasValue>\s+"([^"]+)"/.exec(line)?.[1])).filter(Number.isFinite);
    const required = ["hasValue", "relatesToProperty", "measurementMadeBy", "isVersionOf"];
    if (!lines.length || values.length !== lines.length || lines.some(line => required.some(predicate => !line.includes(predicate)))) throw new Error(`Dataset audit failed for ${file}: expected one numeric value and canonical descriptor predicates per observation.`);
    return { file, observations: lines.length, minValue: Math.min(...values), maxValue: Math.max(...values), canonicalObservationShape: true };
}
