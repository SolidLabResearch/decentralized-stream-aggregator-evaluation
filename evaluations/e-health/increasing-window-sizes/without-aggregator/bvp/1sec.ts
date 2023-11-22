import { RDFStream, RSPEngine } from "rsp-js";
import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";
import { add_event_to_rsp_engine, epoch, record_usage } from "../../Util";
import { QueryEngine } from "@comunica/query-sparql";
const query_engine = new QueryEngine();
const N3 = require('n3');
import fs from 'fs';
let ldes_location_1sec = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp-1s/';
let range_to_read = 1;
export async function query1sec() {
    let query_registered_time: number | null = null;
    let first_message_arrival_time: number | null = null;
    let file_streamer_done_time: number | null = null;
    const communication = new LDPCommunication();
    let query = `
    PREFIX saref: <https://saref.etsi.org/core/>
    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
    PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (MAX(?o) as ?maxBVP)
    FROM NAMED WINDOW :w1 ON STREAM <${ldes_location_1sec}> [RANGE ${range_to_read} STEP 1]
    WHERE {
        WINDOW :w1 {
            ?s saref:hasValue ?o .
            ?s saref:relatesToProperty dahccsensors:wearable.bvp .
        }   
    } 
    `;
    let stream_array: RDFStream[] = [];
    let rsp_engine = new RSPEngine(query);
    // record_usage('increasing-window-sizes', 'query1sec-noagg', 1000)
    query_registered_time = Date.now();
    let stream_name: RDFStream = rsp_engine.getStream(ldes_location_1sec) as RDFStream;
    stream_array.push(stream_name);
    let has_been_written = false;
    let emitter = rsp_engine.register();
    let end_time = new Date('2024-05-10T12:00:00.000Z');
    let new_time = new Date('2021-05-10T12:00:00.000Z');
    let ldes = new LDESinLDP(ldes_location_1sec, communication);
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
    });

    stream.on('end', () => {
        file_streamer_done_time = Date.now();
        console.log(`The stream has ended`);
    });

    emitter.on('RStream', async (data: any) => {
        first_message_arrival_time = Date.now();
        if(query_registered_time !== null && file_streamer_done_time !== null && first_message_arrival_time !== null && !has_been_written) {
            fs.appendFileSync('query_latency_noagg.csv', `${range_to_read},${(file_streamer_done_time - query_registered_time)/1000},${(first_message_arrival_time - file_streamer_done_time)/1000}\n`);
            has_been_written = true;
        }
    });
}

query1sec();