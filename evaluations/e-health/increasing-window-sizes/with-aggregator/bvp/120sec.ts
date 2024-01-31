import fs from "fs";
import WebSocket from 'ws';
import { record_usage } from '../../Util';
let ldes_location = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/';
const websocket = new WebSocket('ws://n061-20b.wall2.ilabt.iminds.be:8080/', 'solid-stream-aggregator-protocol', {
    perMessageDeflate: false
});

let query_sent_time: number | null = null;
let isomorphism_done_time: number | null = null;
let query_registered_time: number | null = null;
let file_streamer_done_time: number | null = null;
let rsp_processing_done_time: number | null = null;

websocket.on('open', () => {
    let message_object = {
        query: `
        PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/>
REGISTER RStream <output> AS
SELECT (MAX(?o) as ?maxBVP)
FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 120 STEP 20]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.bvp .
    }
}`, queryId: 'query120sec',
    }

    query_sent_time = Date.now();
    websocket.send(JSON.stringify(message_object));
    record_usage('increasing-window-sizes', 'query120sec-bvp-with-agg', 1000);
});

websocket.on('message', (message: any) => {
    let parsed_message = JSON.parse(message);
    let status = parsed_message.status;        
    if (status === 'isomorphic_check_done'){
        isomorphism_done_time = Date.now();
    }
    if (status === 'unique_query_registered'){
        query_registered_time = Date.now();
    }
    if (status === 'stream_reader_ended'){
        file_streamer_done_time = Date.now();
    }    
    else if (parsed_message.aggregation_event) {
        console.log(parsed_message.aggregation_event);
        if (file_streamer_done_time !== null && rsp_processing_done_time === null && query_registered_time !== null && isomorphism_done_time !== null && query_sent_time !== null) {
            rsp_processing_done_time = Date.now();
            fs.appendFileSync('query_latency.csv', `${120},${(isomorphism_done_time - query_sent_time)/1000},${(query_registered_time - isomorphism_done_time)/1000},${(file_streamer_done_time - query_registered_time)/1000},${(rsp_processing_done_time - file_streamer_done_time)/1000}\n`);
        }
    }
    
});
