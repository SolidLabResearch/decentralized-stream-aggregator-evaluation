import WebSocket from "ws";

const ws = new WebSocket("ws://n061-14a.wall2.ilabt.iminds.be:8080/", "solid-stream-aggregator-protocol", {
    perMessageDeflate: false
});

ws.on("open", () => {
    let query = {
        query: `
        
        `,
        queryId: `maxBVP-minBVP-avgBVP-countBVP-sumBVP`
    }
});