import fs from "fs";
import WebSocket from "ws";
const websocket = new WebSocket("ws://localhost:8080", "solid-stream-aggregator-protocol", {
    perMessageDeflate: false
});
let first_message_arrival_time: number | null = null;
let time_start = Date.now();
websocket.on("open", () => {
    // Register query for 1 hour
    let query = {
        query: `
PREFIX saref: <https://saref.etsi.org/core/> 
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/>
REGISTER RStream <output> AS
SELECT (MAX(?o) as ?maxBVP)
FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/bvp/> [RANGE 3600 STEP 20]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.bvp .
    }
}
        `,
        queryId: "query1hour",
    }
    websocket.send(JSON.stringify(query));
});

websocket.on("message", (message) => {
    if (first_message_arrival_time === null) {
        first_message_arrival_time = Date.now();
        const query_latency = first_message_arrival_time - time_start;
        fs.appendFileSync('query-latency.txt', query_latency + "\n");
    }

    // Handle query response
    let result = JSON.parse(message.toString());
    console.log(result.aggregation_event);
});