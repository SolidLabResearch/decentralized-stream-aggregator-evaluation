import WebSocket from "ws";

const ws = new WebSocket("ws://n061-14a.wall2.ilabt.iminds.be:8080/", "solid-stream-aggregator-protocol", {
    perMessageDeflate: false
});

ws.on("open", () => {
    let query = {
        query: `
        PREFIX saref: <https://saref.etsi.org/core/>
        PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
        PREFIX : <https://rsp.js/>
        REGISTER RStream <output> AS
        SELECT (MAX(?o) as ?maxBVP) (MIN(?o) as ?minBVP)
        FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/participant6/bvp/> [RANGE 3600 STEP 20]
        WHERE {
            WINDOW :w1 {
                ?s saref:hasValue ?o .
                ?s saref:relatesToProperty dahccsensors:wearable.bvp .
            }
        }
        `,
        queryId: "maxBVP-minBVP"
    }
    ws.send(JSON.stringify(query));
});

ws.on("message", (message) => {
    // Handle query response
    let result = JSON.parse(message.toString());
    console.log(result.aggregation_event);
});