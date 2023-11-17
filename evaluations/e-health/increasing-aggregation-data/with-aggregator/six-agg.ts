import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:8080", "solid-stream-aggregator-protocol", {
    perMessageDeflate: false
});

ws.on("open", () => {
    let query = {
        query: `
        
        `,
        queryId: `maxBVP-minBVP-avgBVP-countBVP-sumBVP`
    }
});