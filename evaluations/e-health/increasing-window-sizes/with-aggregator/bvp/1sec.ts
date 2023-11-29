import fs from "fs";
import WebSocket from 'ws';
import { record_usage } from '../../Util';
// let ldes_location = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/';
let ldes_location = 'http://localhost:3000/dataset_participant1/xyz/';
const websocket = new WebSocket('ws://localhost:8080', 'solid-stream-aggregator-protocol', {
    perMessageDeflate: false
});
let query_registered_time: number | null = null;
let first_message_arrival_time: number | null = null;
let file_streamer_done_time: number | null = null;
let range_to_read = 1;

websocket.on('open', () => {
    let message_object = {
        query: `
        PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/>
REGISTER RStream <output> AS
SELECT (MAX(?o) as ?maxBVP)
FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE ${range_to_read} STEP 1]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.bvp .
    }
}`,
        queryId: 'query1sec',
    }
    query_registered_time = Date.now();
    websocket.send(JSON.stringify(message_object));
    record_usage('increasing-window-sizes', 'query1sec', 1000);
});

websocket.on('message', (message: any) => {
    // console.log(message.toString());
    let parsed_message = JSON.parse(message);
    console.log(parsed_message.time_taken);

    
    // if (message.status === 'event_preprocessed'){
    //     console.log(message);
    // }
    // if (parsed_message.status === 'ended' && query_registered_time !== null) {
    //     file_streamer_done_time = Date.now();
    // }
    // else if (parsed_message.aggregation_event) {
    //     if (file_streamer_done_time !== null && first_message_arrival_time === null && query_registered_time !== null) {
    //         first_message_arrival_time = Date.now();
    //         fs.appendFileSync('query_latency.csv', `${range_to_read},${(file_streamer_done_time - query_registered_time)/1000},${(first_message_arrival_time - file_streamer_done_time)/1000}\n`);
    //     }
    // }
});
