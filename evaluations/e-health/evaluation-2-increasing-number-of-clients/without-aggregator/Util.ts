import { RDFStream, RSPEngine } from "rsp-js";
import { LDPCommunication, LDESinLDP } from "@treecg/versionawareldesinldp";
import { QueryEngine } from "@comunica/query-sparql";
const pod_location = process.env.POD_LOCATION;
// let ldes_location = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/';
let ldes_location = 'http://localhost:3000/dataset_participant1/xyz/';
const comunica_engine = new QueryEngine();
const N3 = require('n3');
import fs from 'fs';
import pidusage from 'pidusage';
const ldfetch = require('ldfetch');
const fetch = new ldfetch({});
export async function create_non_aggregator_client(number_of_clients: number) {
    const client_promises = [];
    for (let client = 0; client < number_of_clients; client++) {
        const promise = create_client();
        client_promises.push(promise)
    }
    await Promise.all(client_promises);
}

async function create_client() {
    let query = `
    PREFIX saref: <https://saref.etsi.org/core/>
    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
    PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (MAX(?o) as ?maxBVP)
    FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 6000 STEP 30]
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
    let stream_name: RDFStream = rsp_engine.getStream(ldes_location) as RDFStream;
    stream_array.push(stream_name);
    let emitter = rsp_engine.register();
    let to_date = new Date(1700038652238);
    let from_date = new Date(to_date.getTime() - 6000);
    let ldes = new LDESinLDP(ldes_location, new LDPCommunication());
    const stream = await ldes.readMembersSorted({
        from: from_date,
        until: to_date,
        chronological: true
    });

    stream.on("data", async (data: any) => {
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

    stream.on('end', async () => {
        console.log(`The stream has ended.`);
    });

    emitter.on('RStream', async (data: any) => {
        console.log(data);
    });
}

export async function record(evaluation_name: string, query_function_id: string) {
    const process_id = process.pid;
    const memory_usage = (process.memoryUsage());
    const memory_mb = memory_usage.rss / 1024 / 1024;
    pidusage(process_id, (err, stats) => {
        const timestamp = stats.timestamp;
        const cpu_usage = stats.cpu.toFixed(3);
        const timestamp_date = new Date(timestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '');
        const data = `${timestamp},${cpu_usage},${memory_mb.toFixed(3)}\n`;
        // const file = `${evaluation_name}/${query_function_id}.csv`;
        const file = `${query_function_id}.csv`
        fs.appendFile(file, data, () => {
        })
    });
}

export function insertion_sort(arr: string[]): string[] {
    const len = arr.length;

    for (let i = 1; i < len; i++) {
        const current = arr[i];
        let j = i - 1;

        while (j >= 0 && arr[j] > current) {
            arr[j + 1] = arr[j];
            j--;
        }

        arr[j + 1] = current;
    }

    return arr;
}

export async function record_usage(evaluation_name: string, query_function_id: string, interval: number) {
    setInterval(() => {
        record(evaluation_name, query_function_id);
    }, interval);
}

export async function epoch(date: string) {
    return Date.parse(date);
}

export async function add_event_to_rsp_engine(store: any, stream_name: RDFStream[], timestamp: number) {
    stream_name.forEach((stream: RDFStream) => {
        let quads = store.getQuads(null, null, null, null);
        for (let quad of quads) {
            console.log(typeof stream);
            stream.add(quad, timestamp);
        }
    });
}

export async function find_aggregator_location(solid_pod_webid: string) {
    const pod_location = solid_pod_webid.split('/profile/card#me')[0] + '/';
    fetch.get(solid_pod_webid).then((response: any) => {
        let profile_store = new N3.Store(response.triples);
        for (let quad of profile_store) {
            if (quad.predicate.value === 'http://argahsuknesib.github.io/asdo/hasAggregatorLocation') {
                let aggregator_ws = quad.object.value;
                let aggregator_ws_location = 'ws://' + aggregator_ws[1].split('//');
                return aggregator_ws_location;
            }
        }
    });

}

async function main() {
    let web_id = 'http://localhost:3000/dataset_participant1/profile/card#me';
    find_aggregator_location(web_id);
}
main();