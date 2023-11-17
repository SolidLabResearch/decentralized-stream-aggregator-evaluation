import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";
import { QueryEngine } from "@comunica/query-sparql";
import { add_event_to_rsp_engine, epoch } from "../Util";
import * as fs from 'fs';
import { RDFStream, RSPEngine, RSPQLParser } from "rsp-js";
const communication = new LDPCommunication();
const query_engine = new QueryEngine();
const N3 = require('n3');
// let ldes_location = 'http://http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/';
let first_message_arrival_time: number | null = null;
let ldes_location = 'http://localhost:3000/dataset_participant1/data/';
let query = `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/>
REGISTER RStream <output> AS
SELECT (MAX(?o) as ?maxBVP)
FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 86400 STEP 20]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.bvp .
    }
}
`;
let stream_array: RDFStream[] = [];
let rsp_engine = new RSPEngine(query);
let stream_name: RDFStream = rsp_engine.getStream(ldes_location) as RDFStream;
stream_array.push(stream_name);
let emitter = rsp_engine.register();
let end_time = new Date('2024-05-10T12:00:00.000Z');
let new_time = new Date('2021-05-10T12:00:00.000Z');
async function query10min() {
    let time_start = Date.now();
    let ldes = new LDESinLDP(ldes_location, communication);
    let stream = await ldes.readMembersSorted({
        from: new_time,
        until: end_time,
        chronological: true
    });
    stream.on('data', async (data: any) => {
        const store = new N3.Store(data.quads);
        const binding_stream = await query_engine.queryBindings(`
        PREFIX saref: <https://saref.etsi.org/core/>
        SELECT ?time WHERE {
            ?s saref:hasTimestamp ?time .
        }
        `, {
            sources: [store]
        });

        binding_stream.on('data', async (binding: any) => {
            let time = binding.get('time');
            if (time !== undefined) {
                let timestamp = await epoch(time.value);
                if (stream_array) {
                    await add_event_to_rsp_engine(store, stream_array, timestamp);
                }
                else {
                    console.log(`The stream is undefined`);
                }
            }
        });
    })

    stream.on('end', async () => {
        console.log('Stream has ended');
    });

    emitter.on('RStream', async (data: any) => {
        if (first_message_arrival_time === null) {
            first_message_arrival_time = Date.now();
            const query_latency = first_message_arrival_time - time_start;
            let data = {
                query_id: '1_day_window_query_noagg',
                query_latency: query_latency / 1000 // convert to seconds
            }
            let json_data = JSON.stringify(data);
            let query_id = data.query_id;
            let query_latency_seconds = data.query_latency;
            fs.appendFileSync('results/e-health/increasing-window-sizes/without-aggregator/query_latency.csv', `${new Date().getTime()}, ${query_id}, ${query_latency_seconds}` + "\n");
        }
        let iterable = data.bindings.values();
        for (let item of iterable) {
            console.log(item.value);
        }
    });
};

query10min();