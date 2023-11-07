import fs from "fs";
import WebSocket from 'ws';
import { record_usage } from '../Util';

const query =  `
PRERIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/>
REGISTER RStream <output> AS
SELECT (MAX(?o) as ?maxBVP)
FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/dataset_participant1/> [RANGE 600 STEP 20]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.bvp .
    }
}`;
const websocket = new WebSocket('ws://localhost:8080', 'solid-stream-aggregator-protocol', {
    perMessageDeflate: false
});
let first_message_arrival_time: number | null = null;
let time_start = Date.now();
console.log('query10min registered');
// websocket.on('open', () => {
//     let message_object = {
//         query: `PREFIX saref: <https://saref.etsi.org/core/> 
//         PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
//         PREFIX : <https://rsp.js/>
//         REGISTER RStream <output> AS
//         SELECT (MAX(?o) as ?maxBVP)
//         FROM NAMED WINDOW :w1 ON STREAM <http://http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/> [RANGE 600 STEP 20]
//         WHERE {
//             WINDOW :w1 {
//                 ?s saref:hasValue ?o .
//                 ?s saref:relatesToProperty dahccsensors:wearable.bvp .
//             }
//         }`,
//         queryId: 'query10min',
//     };
//     websocket.send(JSON.stringify(message_object));
//     record_usage('query10min', 1000);
// });

websocket.on('open', () => {
    let message_object = {
        query: `PREFIX saref: <https://saref.etsi.org/core/> 
        PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
        PREFIX : <https://rsp.js/>
        REGISTER RStream <output> AS
        SELECT (MAX(?o) as ?maxBVP)
        FROM NAMED WINDOW :w1 ON STREAM <http://localhost:3000/dataset_participant1/data/> [RANGE 600 STEP 20]
        WHERE {
            WINDOW :w1 {
                ?s saref:hasValue ?o .
                ?s saref:relatesToProperty dahccsensors:wearable.bvp .
            }
        }`,
        queryId: 'query10min',
    };
    websocket.send(JSON.stringify(message_object));
    console.log('query10min registered');
    record_usage('increasing-window-sizes','query10min', 1000);
});

websocket.on('message', (message) => {
    if (first_message_arrival_time === null) {
        first_message_arrival_time = Date.now();
        const query_latency = first_message_arrival_time - time_start;
        let data = {
            query_id: '10_minute_window_query',
            query_latency: query_latency / 1000 // convert to seconds
        }
        let json_data = JSON.stringify(data);
        let query_id = data.query_id;
        let query_latency_seconds = data.query_latency;

        fs.appendFileSync('results/e-health/increasing-window-sizes/with-aggregator/query_latency.csv', `${new Date().getTime()}, ${query_id}, ${query_latency_seconds}` + "\n");
    }
    // Handle query response
    let result = JSON.parse(message.toString());
    console.log(result.aggregation_event);
});