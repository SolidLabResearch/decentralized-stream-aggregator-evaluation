import { WebSocket } from "ws";
import * as fs from 'fs';
let ldfetch = require('ldfetch');
let ld_fetch = new ldfetch({});
import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";
import { RDFStream, RSPEngine, RSPQLParser } from 'rsp-js';
const ldes_acc_x = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/";
const ldes_acc_y = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/";
const ldes_acc_z = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/";
const location_of_aggregator = "http://n078-22.wall1.ilabt.imec.be:8085/";
const solid_pod_location = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/";
const N3 = require('n3');
const parser = new N3.Parser();
const query = `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX func: <http://extension.org/functions#>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js>
REGISTER RStream <output> AS
SELECT (func:sqrt(?o * ?o + ?o2 * ?o2 + ?o3 * ?o3) AS ?activityIndex)
FROM NAMED WINDOW :w1 ON STREAM <${ldes_acc_x}> [RANGE 60000 STEP 20000]
FROM NAMED WINDOW :w2 ON STREAM <${ldes_acc_y}> [RANGE 60000 STEP 20000]
FROM NAMED WINDOW :w3 ON STREAM <${ldes_acc_z}> [RANGE 60000 STEP 20000]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
    }
    WINDOW :w2 {
        ?s saref:hasValue ?o2 .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
    }
    WINDOW :w3 {
        ?s saref:hasValue ?o3 .
        ?s saref:relatesToProperty dahccsensors:wearable.acceleration.x .
    }
}
`;

interface MemoryUsage {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
}

async function generateNotificationAggregatorClient(current_client_index: number): Promise<void> {
    const start_find_ldes_stream = Date.now();
    const logFile = `notification-aggregator-log-${current_client_index}.log`;
    fs.writeFileSync(logFile, `timestamp,cpu_user,cpu_system,rss,heapTotal,heapUsed,external\n`);
    function logCpuMemoryUsage() {
        const cpuUsage = process.cpuUsage();
        const memoryUsage: MemoryUsage = process.memoryUsage();
        const timestamp = Date.now();

        const logData = `${timestamp},${cpuUsage.user},${cpuUsage.system},${memoryUsage.rss},${memoryUsage.heapTotal},${memoryUsage.heapUsed},${memoryUsage.external}\n`;
        fs.appendFileSync(logFile, logData);
    }

    setInterval(() => {
        logCpuMemoryUsage
    }, 500);

    await find_relevant_streams(solid_pod_location, ["wearable.acceleration.x", "wearable.acceleration.y", "wearable.acceleration.z"]).then((streams) => {
        if (streams) {
            let end_find_ldes_stream = Date.now();
            console.log(`time_to_find_ldes_stream,${end_find_ldes_stream - start_find_ldes_stream}\n`);
        }
    });


    const rsp_engine = new RSPEngine(query);
    const rspql_parser = new RSPQLParser();
    const rsp_emitter = rsp_engine.register();
    const stream_array: string[] = [];
    const parsed_query = rspql_parser.parse(query);
    parsed_query.s2r.forEach((stream) => {
        stream_array.push(stream.stream_name);
    });

    for (const stream of stream_array) {
        const ldes = new LDESinLDP(stream, new LDPCommunication());
        const metadata = await ldes.readMetadata();
        const bucket_strategy = metadata.getQuads(stream + "#BucketizeStrategy", "https://w3id.org/tree#path", null, null)[0].object.value;
        const stream_location = rsp_engine.getStream(stream) as RDFStream;
        const start_subscribe_notifications = Date.now();
        await subscribe_notifications(stream_location, bucket_strategy, current_client_index);
        const end_subscribe_notifications = Date.now();
        fs.appendFileSync(`notification-aggregator-${current_client_index}-client.csv`, `time_to_subscribe_notifications,${end_subscribe_notifications - start_subscribe_notifications}\n`);
        const time_start_subscribing_results = Date.now();
        subscribe_to_results(rsp_emitter, 33, time_start_subscribing_results, current_client_index);
    }
}

async function subscribe_notifications(ldes_stream: RDFStream, bucket_strategy: string, current_client_index: number) {
    const websocket = new WebSocket(location_of_aggregator, 'solid-stream-notifications-aggregator', {
        perMessageDeflate: false
    });

    websocket.once('open', () => {
        let message_object = {
            subscribe: [`${ldes_stream.name}`],
        };
        websocket.send(JSON.stringify(message_object));
        console.log(`The client is subscribed to the stream ${ldes_stream.name} via the Solid Stream Notifications Aggregator`);
    });

    websocket.on('message', async (data: any) => {
        const time_before_preprocessing = Date.now();
        const received_data = JSON.parse(data);
        const stream_store = new N3.Store();

        const stream_event = received_data.event;
        await parser.parse(stream_event, (error: any, triple: any, prefixes: any) => {
            if (triple) {
                stream_store.addQuad(triple);
            }
        });

        const timestamp = stream_store.getQuads(null, bucket_strategy, null, null)[0].object.value;
        const timestamp_epoch = Date.parse(timestamp);
        const time_after_preprocessing = Date.now();
        fs.appendFileSync(`notification-aggregator-${current_client_index}-client.csv`, `time_to_preprocess_event,${time_after_preprocessing - time_before_preprocessing}\n`);
        add_event_to_rsp_engine(stream_store, [ldes_stream], timestamp_epoch);
        const time_after_adding_event = Date.now();
        fs.appendFileSync(`notification-aggregator-${current_client_index}-client.csv`, `time_to_add_event_to_rsp_engine,${time_after_adding_event - time_after_preprocessing}\n`);
    });
}

export function add_event_to_rsp_engine(store: any, stream_name: RDFStream[], timestamp: number) {
    stream_name.forEach(async (stream: RDFStream) => {
        let quads = store.getQuads(null, null, null, null);
        for (let quad of quads) {
            stream.add(quad, timestamp);
        }
    });
}

export async function find_relevant_streams(solid_pod_url: string, interest_metrics: string[]): Promise<string[]> {
    let relevant_streams: string[] = [];
    if (if_exists_relevant_streams(solid_pod_url, interest_metrics)) {
        try {
            let public_type_index = await find_public_type_index(solid_pod_url);
            const response = await ld_fetch.get(public_type_index);
            let store = new N3.Store(await response.triples);
            for (let quad of store) {
                if (quad.predicate.value == "https://w3id.org/tree#view") {
                    relevant_streams.push(quad.object.value);
                }
            }
            return relevant_streams;
        }
        catch (error) {
            console.log(`Error: ${error}`);
            return relevant_streams;
        }

    }
    return relevant_streams;
}

export async function if_exists_relevant_streams(solid_pod_url: string, interest_metrics: string[]): Promise<boolean> {
    try {
        let public_type_index = await find_public_type_index(solid_pod_url);
        const response = await ld_fetch.get(public_type_index);
        let store = new N3.Store(await response.triples);
        for (let quad of store) {
            if (quad.predicate.value == "https://saref.etsi.org/core/relatesToProperty") {
                if (interest_metrics.includes(quad.object.value)) {
                    return true;
                }
            }
        }
        return false;
    }
    catch (error) {
        console.log(`Error: ${error}`);
        return false;
    }
}


export async function find_public_type_index(solid_pod_url: string): Promise<string> {
    let profie_document = solid_pod_url + "/profile/card";

    try {
        const response = await ld_fetch.get(profie_document);
        let store = new N3.Store(await response.triples);

        for (let quad of store) {
            if (quad.predicate.value == "http://www.w3.org/ns/solid/terms#publicTypeIndex") {
                return quad.object.value;
            };
        }

        console.log(`Could not find a public type index for ${solid_pod_url}`);
        return '';
    }
    catch (error) {
        console.log(`Error: ${error}`);
        return '';
    }
}

async function subscribe_to_results(rsp_emitter: any, i: number, time_start_subscribing_results: number, current_client_index: number) {
    const listener = (event: any) => {
        let iterable = event.bindings.values();
        for (let item of iterable) {
            const time_received_aggregation_event = Date.now();
            const timestamp = Date.now();
            fs.appendFileSync(`with-notification-aggregator-${current_client_index}-client.csv`, `time_received_aggregation_event,${time_received_aggregation_event - time_start_subscribing_results}\n`);
            time_start_subscribing_results = time_received_aggregation_event;
            fs.appendFileSync(`without-notification-aggregator-${current_client_index}-client-results.csv`, `${timestamp},${item.value}\n`);
        }
    }
    rsp_emitter.on('RStream', listener);
    rsp_emitter.on('end', () => {
        rsp_emitter.removeListener('RStream', listener);
        console.log(`Iteration ${i} has ended`);
    });
}

process.on('message', async (message: { current_client_index: number }) => {
    if (message && message.current_client_index !== undefined) {
        await generateNotificationAggregatorClient(message.current_client_index);
    }
    else {
        console.error(`Error: no current_client_index provided`);
    }
});