import { RDFStream, RSPEngine } from "rsp-js";
import { LDPCommunication, LDESinLDP } from "@treecg/versionawareldesinldp";
import { QueryEngine } from "@comunica/query-sparql";
import { add_event_to_rsp_engine, epoch, record_usage, insertion_sort } from "../../Util";
const comunica_engine = new QueryEngine();
const N3 = require('n3');
import fs from 'fs';
let ldes_location = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/';
export async function query180sec() {
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
    FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 180 STEP 10]
    WHERE {
        WINDOW :w1 {
            ?s saref:hasValue ?o .
            ?s saref:relatesToProperty dahccsensors:wearable.bvp .
        }   
    } 
    `;
    let stream_array: RDFStream[] = [];
    let observation_array: any[] = [];
    let rsp_engine = new RSPEngine(query);
    query_registered_time = Date.now();
    let stream_name: RDFStream = rsp_engine.getStream(ldes_location) as RDFStream;
    stream_array.push(stream_name);
    let has_been_written = false;
    let emitter = rsp_engine.register();
    let to_date = new Date(1700038652238);
    let from_date = new Date(to_date.getTime() - 180);
    let ldes = new LDESinLDP(ldes_location, communication);
    const stream = await ldes.readMembersSorted({
        from: from_date,
        until: to_date,
        chronological: true
    })
    stream.on("data", async (data: any) => {
        let time_start = Date.now();
        let stream_store = new N3.Store(data.quads);
        const binding_stream = await comunica_engine.queryBindings(`
        select ?s where {
            ?s ?p ?o .
        }`, {
            sources: [stream_store]
        });

        binding_stream.on('data', async (binding: any) => {
            for (let subject of binding.values()) {
                observation_array.push(subject.id);
                observation_array = insertion_sort(observation_array);
            }
        });

        binding_stream.on('end', async () => {
            let unique_observation_array = [...new Set(observation_array)];
            for (let observation of unique_observation_array) {
                let observation_store = new N3.Store(stream_store.getQuads(observation, null, null, null));
                if (observation_store.size > 0) {
                    const timestamp_stream = await comunica_engine.queryBindings(`
                    PREFIX saref: <https://saref.etsi.org/core/>
                    SELECT ?time WHERE {
                        <${observation}> saref:hasTimestamp ?time .
                    }
                    `, {
                        sources: [observation_store]
                    });

                    timestamp_stream.on('data', async (bindings: any) => {
                        let time = bindings.get('time');
                        if (time !== undefined) {
                            let timestamp = await epoch(time.value);
                            let time_end = Date.now();
                            let time_taken = (time_end - time_start) / 1000;
                            fs.appendFileSync('time.txt', `${time_taken}s\n`);
                            time_start = time_end;
                            if (stream_name) {
                                await add_event_to_rsp_engine(observation_store, [stream_name], timestamp);
                            }
                        }
                    });
                }
            }
            console.log(`Preprocessing of the events has ended.`);

        });
    });

    stream.on("end", async () => {
        console.log(`The stream has ended.`);
        file_streamer_done_time = Date.now();
    });

    emitter.on('RStream', async (data: any) => {
        first_message_arrival_time = Date.now();
        if(query_registered_time !== null && file_streamer_done_time !== null && first_message_arrival_time !== null && !has_been_written) {
            fs.appendFileSync('query_latency_noagg.csv', `180,${(file_streamer_done_time - query_registered_time)/1000},${(first_message_arrival_time - file_streamer_done_time)/1000}\n`);
            has_been_written = true;
        }
    })

    stream.on("error", async (error: Error) => {
        console.log(`The reading from the solid pod ldes stream has an error: ${error}`);
    });
}



query180sec();