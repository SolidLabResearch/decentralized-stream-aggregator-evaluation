import WebSocket from "ws";
import { send_number_of_queries_to_the_aggregator } from "../Util";
const websocket = new WebSocket('ws://localhost:8080', 'solid-stream-aggregator-protocol', {
    perMessageDeflate: false
});

async function send_hundred_queries() {
    await send_number_of_queries_to_the_aggregator(100, websocket);
}

send_hundred_queries();