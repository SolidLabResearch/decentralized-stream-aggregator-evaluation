import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:8080", "solid-stream-aggregator-protocol", {
    perMessageDeflate: false
});

ws.on("open", () => {
    // Register query for 1 day
    let query = {
        query: `
PREFIX saref: <https://saref.etsi.org/core/> 
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/>
REGISTER RStream <output> AS
SELECT (MAX(?o) as ?maxBVP)
FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/bvp/> [RANGE 86400 STEP 20]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.bvp .
    }
}`,
        queryId: "query1day",
    }
    ws.send(JSON.stringify(query));
});

ws.on("message", (message) => {
    // Handle query response
    let result = JSON.parse(message.toString());
    console.log(result.aggregation_event);
});

