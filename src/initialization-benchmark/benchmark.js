#!/usr/bin/env node

/* Standalone one-time initialization benchmark. It deliberately does not load
 * the evaluation experiment configuration or any RSP-JS/Heimdall client. */
const fs = require("fs");
const path = require("path");
const { Parser, Store } = require("n3");
const authn = require("@inrupt/solid-client-authn-core");
const { Session } = require("@rubensworks/solid-client-authn-isomorphic");

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const SCHEMA_SERVICE = "https://schema.org/Service";
const SCHEMA_NAME = "https://schema.org/name";
const HEIMDALL_SERVICE = "https://w3id.org/heimdall#Service";
const HEIMDALL_ENDPOINT = "https://w3id.org/heimdall#webSocketEndpoint";
const SCHEMA_SERVICE_URL = "https://schema.org/serviceUrl";
const SOLID_PUBLIC_TYPE_INDEX = "http://www.w3.org/ns/solid/terms#publicTypeIndex";
const SAREF_RELATES_TO_PROPERTY = "https://saref.etsi.org/core/relatesToProperty";
const TREE_VIEW = "https://w3id.org/tree#view";
const SOLID_INSTANCE = "http://www.w3.org/ns/solid/terms#instance";
const DEFAULT_METRICS = {
    x: "https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.x",
    y: "https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.y",
    z: "https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.z"
};
const CSV_HEADER = [
    "run_id", "repetition", "operation", "start_epoch_ms", "end_epoch_ms",
    "start_monotonic_ns", "end_monotonic_ns", "duration_ms", "success", "authenticated_session",
    "service_description_url", "service_url", "profile_url",
    "public_type_index_url", "stream_x_url", "stream_y_url", "stream_z_url", "error"
];

function requiredEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable ${name}.`);
    return value;
}

function withTrailingSlash(value) {
    return value.endsWith("/") ? value : `${value}/`;
}

function envConfig() {
    const podUrl = withTrailingSlash(requiredEnv("SOLID_POD_URL"));
    return {
        podUrl,
        serviceDescriptionUrl: process.env.SERVICE_DESCRIPTION_URL || `${podUrl}service-description.ttl`,
        expectedHeimdall: requiredEnv("EXPECTED_HEIMDALL_WS_URL"),
        expectedStreams: {
            x: requiredEnv("EXPECTED_STREAM_X_URL"),
            y: requiredEnv("EXPECTED_STREAM_Y_URL"),
            z: requiredEnv("EXPECTED_STREAM_Z_URL")
        },
        metrics: {
            x: process.env.STREAM_METRIC_X || DEFAULT_METRICS.x,
            y: process.env.STREAM_METRIC_Y || DEFAULT_METRICS.y,
            z: process.env.STREAM_METRIC_Z || DEFAULT_METRICS.z
        },
        issuer: requiredEnv("SOLID_OIDC_ISSUER"),
        clientId: requiredEnv("SOLID_CLIENT_ID"),
        clientSecret: requiredEnv("SOLID_CLIENT_SECRET")
    };
}

function csv(value) {
    const text = value === undefined || value === null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function cacheBusted(url, key) {
    const parsed = new URL(url);
    parsed.searchParams.set("_initialization_benchmark", key);
    return parsed.toString();
}

function rdfStore(text, baseIRI) {
    const parser = new Parser({ baseIRI });
    return new Store(parser.parse(text));
}

async function getRdf(fetchFunction, url, cacheKey, label) {
    const response = await fetchFunction(cacheBusted(url, cacheKey), {
        headers: {
            Accept: "text/turtle, application/ld+json;q=0.9, application/n-quads;q=0.8",
            "Cache-Control": "no-cache, no-store",
            Pragma: "no-cache"
        }
    });
    if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`);
    const text = await response.text();
    return { store: rdfStore(text, url), requestUrl: response.url || url };
}

function endpointForService(store) {
    const serviceSubjects = new Set([
        ...store.getQuads(null, RDF_TYPE, SCHEMA_SERVICE, null).map(q => q.subject.value),
        ...store.getQuads(null, RDF_TYPE, HEIMDALL_SERVICE, null).map(q => q.subject.value)
    ]);
    for (const quad of store.getQuads(null, SCHEMA_NAME, null, null)) {
        if (quad.object.value.toLowerCase() === "heimdall") serviceSubjects.add(quad.subject.value);
    }
    const endpointPredicates = [HEIMDALL_ENDPOINT, SCHEMA_SERVICE_URL];
    for (const subject of serviceSubjects) {
        for (const predicate of endpointPredicates) {
            const endpoint = store.getObjects(subject, predicate, null)[0];
            if (endpoint && /^wss?:\/\//.test(endpoint.value)) return endpoint.value;
        }
    }
    throw new Error("No Heimdall WebSocket endpoint found in the service description RDF.");
}

async function discoverService(serviceDescriptionUrl, cacheKey, fetchFunction = fetch, expectedEndpoint) {
    const rdf = await getRdf(fetchFunction, serviceDescriptionUrl, cacheKey, "Service description");
    const serviceUrl = endpointForService(rdf.store);
    if (expectedEndpoint && serviceUrl !== expectedEndpoint) {
        throw new Error(`Discovered Heimdall endpoint ${serviceUrl} did not equal EXPECTED_HEIMDALL_WS_URL.`);
    }
    return { serviceUrl, serviceDescriptionUrl };
}

function normalizeIssuer(issuer) {
    return issuer.endsWith("/") ? issuer : `${issuer}/`;
}

async function createAuthenticatedSession(config, cacheKey, fetchFunction = fetch) {
    const session = new Session();
    const dpopKey = await authn.generateDpopKeyPair();
    const tokenUrl = `${normalizeIssuer(config.issuer)}.oidc/token`;
    const authString = `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`;
    const tokenResponse = await fetchFunction(tokenUrl, {
        method: "POST",
        headers: {
            authorization: `Basic ${Buffer.from(authString).toString("base64")}`,
            "content-type": "application/x-www-form-urlencoded",
            dpop: await authn.createDpopHeader(tokenUrl, "POST", dpopKey)
        },
        body: "grant_type=client_credentials&scope=webid"
    });
    if (!tokenResponse.ok) throw new Error(`CSS client-credentials token endpoint returned HTTP ${tokenResponse.status}.`);
    let tokenBody;
    try { tokenBody = await tokenResponse.json(); }
    catch (_) { throw new Error("CSS client-credentials token endpoint returned invalid JSON."); }
    if (!tokenBody || typeof tokenBody.access_token !== "string" || tokenBody.access_token.length === 0) {
        throw new Error("CSS client-credentials token response did not contain an access token.");
    }
    session.fetch = await authn.buildAuthenticatedFetch(fetchFunction, tokenBody.access_token, { dpopKey });
    const confirmation = await session.fetch(cacheBusted(config.profileUrl, `${cacheKey}-auth`), {
        headers: { Accept: "text/turtle", "Cache-Control": "no-cache, no-store", Pragma: "no-cache" }
    });
    if (!confirmation.ok) throw new Error(`Authenticated CSS profile confirmation returned HTTP ${confirmation.status}.`);
    session.info.isLoggedIn = true;
    if (!session.info.isLoggedIn || typeof session.fetch !== "function") {
        throw new Error("CSS authenticated session was not ready after login.");
    }
    return session;
}

function metricMatches(value, metric) {
    return value === metric || value.endsWith(metric) || metric.endsWith(value);
}

function streamCandidates(store, metric) {
    const subjects = store.getQuads(null, SAREF_RELATES_TO_PROPERTY, null, null)
        .filter(q => metricMatches(q.object.value, metric))
        .map(q => q.subject.value);
    const candidates = [];
    for (const subject of subjects) {
        if (/^https?:\/\//.test(subject)) candidates.push(subject);
        for (const predicate of [SOLID_INSTANCE, TREE_VIEW]) {
            for (const object of store.getObjects(subject, predicate, null)) {
                if (/^https?:\/\//.test(object.value)) candidates.push(object.value);
            }
        }
    }
    return [...new Set(candidates)];
}

async function discoverStreams(config, session, cacheKey, expectedStreams) {
    const profile = await getRdf(session.fetch, config.profileUrl, `${cacheKey}-profile`, "Solid profile/card");
    const publicTypeIndex = profile.store.getObjects(null, SOLID_PUBLIC_TYPE_INDEX, null)[0];
    if (!publicTypeIndex) throw new Error("Solid profile/card did not contain publicTypeIndex.");
    const typeIndexUrl = publicTypeIndex.value;
    const typeIndex = await getRdf(session.fetch, typeIndexUrl, `${cacheKey}-type-index`, "Solid public type index");
    const resolved = {};
    for (const axis of ["x", "y", "z"]) {
        const candidates = streamCandidates(typeIndex.store, config.metrics[axis]);
        if (candidates.length !== 1) {
            throw new Error(`Expected exactly one stream candidate for ${axis}; found ${candidates.length}.`);
        }
        resolved[axis] = candidates[0];
    }
    if (new Set(Object.values(resolved)).size !== 3) throw new Error("x/y/z discovery resolved duplicate stream URLs.");
    await Promise.all(["x", "y", "z"].map(async axis => {
        const metadata = await getRdf(session.fetch, resolved[axis], `${cacheKey}-stream-${axis}`, `${axis} stream metadata`);
        if ([...metadata.store].length === 0) throw new Error(`${axis} stream metadata RDF was empty.`);
    }));
    const result = {
        profileUrl: config.profileUrl,
        publicTypeIndexUrl: typeIndexUrl,
        streamXUrl: resolved.x,
        streamYUrl: resolved.y,
        streamZUrl: resolved.z
    };
    if (expectedStreams && (result.streamXUrl !== expectedStreams.x || result.streamYUrl !== expectedStreams.y || result.streamZUrl !== expectedStreams.z)) {
        throw new Error("Discovered stream URLs did not equal the expected x/y/z URLs.");
    }
    return result;
}

function now() {
    return { epochMs: Date.now(), monotonicNs: process.hrtime.bigint() };
}

async function measure(operation, repetition, runId, fn, rows) {
    const start = now();
    try {
        const details = await fn();
        const end = now();
        rows.push({ run_id: runId, repetition, operation, ...start, endEpochMs: end.epochMs,
            endMonotonicNs: end.monotonicNs, durationMs: Number(end.monotonicNs - start.monotonicNs) / 1e6,
            success: true, ...details });
        return details;
    } catch (error) {
        const end = now();
        rows.push({ run_id: runId, repetition, operation, ...start, endEpochMs: end.epochMs,
            endMonotonicNs: end.monotonicNs, durationMs: Number(end.monotonicNs - start.monotonicNs) / 1e6,
            success: false, error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
}

function outputRow(row) {
    return [row.run_id, row.repetition, row.operation, row.start.epochMs, row.endEpochMs,
        row.start.monotonicNs, row.endMonotonicNs, row.durationMs, row.success, row.authenticated,
        row.serviceDescriptionUrl, row.serviceUrl, row.profileUrl, row.publicTypeIndexUrl,
        row.streamXUrl, row.streamYUrl, row.streamZUrl, row.error].map(csv).join(",");
}

function writeRows(outputPath, rows) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${CSV_HEADER.join(",")}\n${rows.map(outputRow).join("\n")}\n`);
}

function parseArgs() {
    const args = process.argv.slice(2);
    if (args.includes("--help")) {
        console.log("Usage: npm run benchmark:init[:smoke] [-- --output PATH]");
        process.exit(0);
    }
    const outputIndex = args.indexOf("--output");
    return {
        smoke: args.includes("--smoke"),
        outputPath: outputIndex >= 0 ? args[outputIndex + 1] : (process.env.INITIALIZATION_BENCHMARK_OUTPUT || "initialization-benchmark.csv")
    };
}

async function main() {
    const args = parseArgs();
    const config = envConfig();
    config.profileUrl = `${config.podUrl}profile/card`;
    const repetitions = args.smoke ? 1 : 35;
    const runId = process.env.INITIALIZATION_RUN_ID || `initialization-${Date.now()}-${process.pid}`;
    const rows = [];
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
        const cacheKey = `${runId}-${repetition}`;
        await measure("service_discovery", repetition, runId,
            () => discoverService(config.serviceDescriptionUrl, cacheKey, fetch, config.expectedHeimdall), rows);
        let session;
        await measure("service_authentication", repetition, runId,
            async () => { session = await createAuthenticatedSession(config, cacheKey); return { authenticated: true }; }, rows);
        await measure("stream_discovery", repetition, runId,
            () => discoverStreams(config, session, cacheKey, config.expectedStreams), rows);
        console.log(`initialization repetition ${repetition}/${repetitions} succeeded`);
    }
    writeRows(args.outputPath, rows);
    console.log(`Wrote ${rows.length} raw observations to ${path.resolve(args.outputPath)}`);
}

module.exports = { discoverService, discoverStreams, createAuthenticatedSession, endpointForService, rdfStore, metricMatches };

if (require.main === module) {
    main().catch(error => {
        console.error(`Initialization benchmark failed: ${error.message}`);
        process.exitCode = 1;
    });
}
