import fs from "fs";
import WebSocket from 'ws';
import { record_usage } from '../Util';
let ldes_location = 'http://localhost:3000/dataset_participant1/data/';
const query =  `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/>
REGISTER RStream <output> AS
SELECT (MAX(?o) as ?maxBVP)
FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 600 STEP 20]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.bvp .
    }
}`;
const startTime = Date.now();
let received_messages = 0;

const websocket = new WebSocket('ws://localhost:8080', 'solid-stream-aggregator-protocol', {
    perMessageDeflate: false
});
let first_message_arrival_time: number | null = null;
let time_start = Date.now();
websocket.on('open', () => {
    let message_object = {
        query: `
        PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/>
REGISTER RStream <output> AS
SELECT (MAX(?o) as ?maxBVP)
FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 600 STEP 20]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.bvp .
    }
}
        `,
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
    received_messages++;
    console.log(result.aggregation_event);
});


async function measureThroughput() {
    const currentTime = Date.now();
    const elapsedTimeInSeconds = (currentTime - startTime) / 1000;
    const quadThroughput = received_messages / elapsedTimeInSeconds;
    console.log(`Quad Throughput: ${quadThroughput} quads per second`);
  }
  
  // Start the measurement at specific intervals
  const measurementInterval = setInterval(measureThroughput, 1000); 
  measureThroughput();
  clearInterval(measurementInterval);

