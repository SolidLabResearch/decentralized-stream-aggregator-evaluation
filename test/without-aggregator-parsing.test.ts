import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import {
    findStreamInbox,
    findSubscriptionEndpoint,
    parseEvent,
    parseRdfStore,
} from "../src/experiments/clients/without-aggregator/parsing";

const streamName = "https://pod.example/stream/";
const storageDescription = "https://pod.example/.notifications/description";
const eventId = "https://pod.example/events/1";
const timestampPredicate = "https://saref.etsi.org/core/hasTimestamp";

const streamMetadata = `
    <${streamName}> <http://www.w3.org/ns/ldp#inbox> <inbox/> .
`;
const descriptionMetadata = `
    <${storageDescription}> <http://www.w3.org/ns/solid/notifications#subscription> <https://pod.example/.notifications/subscribe> .
`;
const validEvent = `
    <${eventId}> <${timestampPredicate}> "2026-08-26T03:41:10.000Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;
        <https://example.com/value> "42" .
`;

function test(name: string, callback: () => void): void {
    callback();
    console.log(`passed: ${name}`);
}

test("parses stream metadata synchronously and finds the inbox", () => {
        assert.strictEqual(findStreamInbox(streamMetadata, streamName), `${streamName}inbox/`);
    });

test("rejects stream metadata without ldp:inbox", () => {
        assert.throws(() => findStreamInbox(`<${streamName}> <https://example.com/other> <https://example.com/value> .`, streamName), /No ldp:inbox found in stream metadata/);
    });

test("parses storage descriptions synchronously and finds the subscription endpoint", () => {
        assert.strictEqual(findSubscriptionEndpoint(descriptionMetadata, storageDescription), "https://pod.example/.notifications/subscribe");
    });

test("rejects storage descriptions without a subscription endpoint", () => {
        assert.throws(() => findSubscriptionEndpoint(`<${storageDescription}> <https://example.com/other> <https://example.com/value> .`, storageDescription), new RegExp(`No Solid notifications subscription endpoint found.*${storageDescription}`));
    });

test("extracts event time synchronously and retains every parsed quad", () => {
        const parsed = parseEvent(validEvent, eventId, streamName, timestampPredicate);
        assert.strictEqual(parsed.quads.length, 2);
        assert.strictEqual(parsed.timestamp, Date.parse("2026-08-26T03:41:10.000Z"));
    });

test("rejects invalid event timestamps", () => {
        assert.throws(() => parseEvent(`<${eventId}> <${timestampPredicate}> "not-a-date" .`, eventId, streamName, timestampPredicate), /Invalid event timestamp/);
    });

test("rejects events missing the event-time predicate and reports predicates", () => {
        assert.throws(() => parseEvent(`<${eventId}> <https://example.com/value> "42" .`, eventId, streamName, timestampPredicate), new RegExp(`missing expected event-time predicate.*${timestampPredicate}.*https://example.com/value`));
    });

test("does not leak parser state between successive documents", () => {
        const first = parseRdfStore(`<https://example.com/one> <https://example.com/p> "one" .`);
        const second = parseRdfStore(`<https://example.com/two> <https://example.com/p> "two" .`);
        assert.strictEqual(first.size, 1);
        assert.strictEqual(second.size, 1);
        assert.strictEqual(first.getQuads(null, null, null, null)[0].subject.value, "https://example.com/one");
        assert.strictEqual(second.getQuads(null, null, null, null)[0].subject.value, "https://example.com/two");
    });

test("keeps the direct-subscription query and callback architecture intact", () => {
        const source = fs.readFileSync(path.resolve(__dirname, "../src/experiments/clients/without-aggregator/client.ts"), "utf8");
        assert.match(source, /buildActivityIndexQuery\(config\.streams\)/);
        assert.match(source, /axios\.get\(streamName\)/);
        assert.match(source, /axios\.post\(subscriptionServer/);
        assert.match(source, /clientCallbackHost/);
    });

test("uses no module-level or callback-based shared parser", () => {
        const source = fs.readFileSync(path.resolve(__dirname, "../src/experiments/clients/without-aggregator/client.ts"), "utf8");
        assert.doesNotMatch(source, /const\s+parser\s*=\s*new/);
        assert.doesNotMatch(source, /parser\.parse\([^\n]*=>/);
        assert.match(source, /void shutdown\(1\)/);
        assert.match(source, /if \(shuttingDown\) return/);
});
