import { Parser, Quad, Store } from "n3";

export const LDP_INBOX_PREDICATE = "http://www.w3.org/ns/ldp#inbox";
export const SOLID_SUBSCRIPTION_PREDICATE = "http://www.w3.org/ns/solid/notifications#subscription";

export function parseRdfStore(document: string): Store {
    return new Store(new Parser().parse(document));
}

export function findStreamInbox(document: string, streamName: string): string {
    const store = parseRdfStore(document);
    const inboxQuads = store.getQuads(null, LDP_INBOX_PREDICATE, null, null);
    if (inboxQuads.length === 0) throw new Error(`No ldp:inbox found in stream metadata for ${streamName}.`);
    return streamName + inboxQuads[0].object.value;
}

export function findSubscriptionEndpoint(document: string, storageDescriptionUrl: string): string {
    const store = parseRdfStore(document);
    const subscriptionQuads = store.getQuads(null, SOLID_SUBSCRIPTION_PREDICATE, null, null);
    if (subscriptionQuads.length === 0) throw new Error(`No Solid notifications subscription endpoint found in storage description ${storageDescriptionUrl}.`);
    return subscriptionQuads[0].object.value;
}

export interface ParsedEvent {
    quads: Quad[];
    timestamp: number;
}

export function parseEvent(document: string, eventId: string, ldesLocation: string, bucketStrategy: string): ParsedEvent {
    const quads = new Parser().parse(document);
    const store = new Store(quads);
    const timestampQuads = store.getQuads(null, bucketStrategy, null, null);
    if (timestampQuads.length === 0) {
        const predicates = [...new Set(quads.map((quad) => quad.predicate.value))].sort();
        throw new Error(`Event ${eventId} from ${ldesLocation} is missing expected event-time predicate ${bucketStrategy}; predicates present: ${predicates.join(", ") || "<none>"}`);
    }
    const timestampValue = timestampQuads[0].object.value;
    const timestamp = Date.parse(timestampValue);
    if (!Number.isFinite(timestamp)) throw new Error(`Invalid event timestamp "${timestampValue}" for ${eventId} from ${ldesLocation}.`);
    return { quads, timestamp };
}
