import { RDFStream, RSPEngine } from "rsp-js";
import { LDESinLDP, LDPCommunication, storeToString } from "@treecg/versionawareldesinldp";
import { QueryEngine } from "@comunica/query-sparql";
const query_engine = new QueryEngine();
const N3 = require('n3');
const Store = new N3.Store()
import fs from 'fs';
// let ldes_location = "http://localhost:3000/dataset_participant1/xyz/";
let ldes_location = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/";

export async function main() {
    let query = `
    PREFIX saref: <https://saref.etsi.org/core/>
    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
    PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (MAX(?o) as ?maxSpO2)
    FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 60 STEP 10]
    WHERE {
        WINDOW :w1 {
            ?s saref:hasValue ?o .
            ?s saref:relatesToProperty dahccsensors:wearable.bvp .
        }   
    } 
    `;

    let counter = 0;
    let rsp_engine = new RSPEngine(query);
    let stream_name: RDFStream = rsp_engine.getStream(ldes_location) as RDFStream;
    let emitter = rsp_engine.register();
    let ldes = new LDESinLDP(ldes_location, new LDPCommunication());
    let stream = await ldes.readMembersSorted({
        from: new Date('2023-11-15T08:57:12.2870Z'),
        until: new Date('2023-11-15T08:58:12.2870Z'),
        chronological: true
    });
    let observation_array: any[] = [];
    stream.on('data', async (data: any) => {
        const store = new N3.Store(data.quads);
        const binding_stream = await query_engine.queryBindings(`
        select ?s where {
            ?s ?p ?o .
        }
        `, {
            sources: [store]
        })

        binding_stream.on('data', async (binding: any) => {
            for (let subject of binding.values()) {
                observation_array.push(subject.id);
            }
        })
        binding_stream.on('end', async () => {
            observation_array = observation_array.sort();
            let unique_observation_array = [...new Set(observation_array)];
            for (let observation of unique_observation_array) {
                let observation_store = new N3.Store(store.getQuads(observation, null, null, null));
                if (observation_store.size > 0) {
                    const timestamp_stream = await query_engine.queryBindings(`
                    PREFIX saref: <https://saref.etsi.org/core/>
                    SELECT ?time WHERE {
                        <${observation}> saref:hasTimestamp ?time .
                    }
                        `, {
                        sources: [observation_store]
                    });

                    timestamp_stream.on('data', async (binding: any) => {
                        let time = binding.get('time');
                        if (time !== undefined) {
                            let timestamp = await epoch(time.value);
                            if (stream_name) {
                                await add_event_to_rsp_engine(observation_store, [stream_name], timestamp);
                            }
                        }
                    });
                }
            }
        });
    });

    stream.on('end', () => {
        console.log("stream ended");
    });

    emitter.on('RStream', (data: any) => {
        for (let value of data.bindings.values()) {
            counter++;
            console.log(value.value);
        };
    });
}

main();

export async function add_event_to_rsp_engine(store: any, stream_name: RDFStream[], timestamp: number) {
    stream_name.forEach((stream: RDFStream) => {
        let quads = store.getQuads(null, null, null, null);
        for (let quad of quads) {
            console.log(typeof stream);
            stream.add(quad, timestamp);
        }
    });
}

export async function epoch(date: string) {
    return Date.parse(date);
}