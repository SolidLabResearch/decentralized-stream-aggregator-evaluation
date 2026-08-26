import { Parser, Quad, Store } from "n3";
import { sha256 } from "../shared/instrumentation";

export interface NotificationEventMessage {
    stream?: unknown;
    published_time?: unknown;
    event: string;
    object?: unknown;
    id?: unknown;
    eventUrl?: unknown;
}

export interface ParsedNotificationEvent {
    eventId: string;
    timestamp: number;
    quads: Quad[];
}

export interface NotificationEventStream {
    add(event: Set<Quad>, timestamp: number, eventId?: string): void;
}

export function parseNotificationEvent(message: NotificationEventMessage, streamName: string, timestampPredicate: string): ParsedNotificationEvent {
    const eventId = eventIdentifier(message, streamName);
    const quads = new Parser().parse(message.event);
    const timestampQuads = new Store(quads).getQuads(null, timestampPredicate, null, null);
    if (timestampQuads.length === 0) {
        const predicates = [...new Set(quads.map((quad) => quad.predicate.value))].sort();
        throw new Error(`Notification event ${eventId} from ${streamName} is missing LDES event-time predicate ${timestampPredicate}; predicates present: ${predicates.join(", ") || "<none>"}`);
    }
    const value = timestampQuads[0].object.value;
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) throw new Error(`Invalid event timestamp "${value}" for ${eventId} from ${streamName}`);
    return { eventId, timestamp, quads };
}

export function insertParsedNotificationEvent(stream: NotificationEventStream, parsed: ParsedNotificationEvent): void {
    stream.add(new Set(parsed.quads), parsed.timestamp, parsed.eventId);
}

function eventIdentifier(message: NotificationEventMessage, streamName: string): string {
    for (const value of [message.object, message.id, message.eventUrl]) if (typeof value === "string" && value) return value;
    return sha256(JSON.stringify({ stream: typeof message.stream === "string" ? message.stream : streamName, publishedTime: message.published_time, event: message.event }));
}
