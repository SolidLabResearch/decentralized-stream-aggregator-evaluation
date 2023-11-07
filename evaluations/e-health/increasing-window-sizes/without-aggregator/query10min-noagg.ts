import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";
import { QueryEngine } from "@comunica/query-sparql";
import { epoch } from "../Util";
const communication = new LDPCommunication();
const query_engine = new QueryEngine();
const N3 = require('n3');
let ldes_location = 'http://http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/';
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
let last_minute_window = 10;
let end_time = new Date('2024-05-10T12:00:00.000Z');
let new_time = new Date(end_time);
new_time.setMinutes(end_time.getMinutes() - last_minute_window);

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

        binding_stream.on('data', (binding: any) => {
            let time = binding.get('time');
            if (time !== undefined) {
                let timestamp = await epoch(time.value);
                console.log(`Timestamp: ${timestamp}`);
                if (stream_name) {
                    console.log(`Adding Event to ${stream_name}`);
                    await this.add_event_to_rsp_engine(store, stream_name, timestamp);
                }
                else {
                    console.log(`The stream is undefined`);
          

        });

    });
}