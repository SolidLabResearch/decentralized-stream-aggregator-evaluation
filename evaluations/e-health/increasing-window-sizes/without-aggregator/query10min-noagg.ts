import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";
import { QueryEngine } from "@comunica/query-sparql";
import { add_event_to_rsp_engine, epoch } from "../Util";
import { RDFStream, RSPEngine, RSPQLParser } from "rsp-js";
const communication = new LDPCommunication();
const query_engine = new QueryEngine();
const N3 = require('n3');
// let ldes_location = 'http://http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/';
let ldes_location = 'http://localhost:3000/dataset_participant1/data/';
let query = `
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
`;
const parser = new RSPQLParser();
let stream_array: any[] = [];
let rsp_engine = new RSPEngine(query);
parser.parse(query).s2r.forEach((stream: any) => {
    stream_array.push(stream.stream_name);
});
let emitter = rsp_engine.register();
let stream_name = stream_array[0];
let last_minute_window = 10;
let end_time = new Date('2024-05-10T12:00:00.000Z');
let new_time = new Date('2021-05-10T12:00:00.000Z');
// let new_time = new Date(end_time);
// new_time.setMinutes(end_time.getMinutes() - last_minute_window);

async function query10min() {
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
                if (stream_name) {
                    await add_event_to_rsp_engine(store, stream_name, timestamp);
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

    emitter.on('data', async (data: any) => {
        console.log(data);
    });
};

query10min();