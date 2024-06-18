import { find_relevant_streams } from "./Util";
import { RSPEngine, RSPQLParser, RDFStream } from "rsp-js";
import { WebSocket, EventEmitter } from "ws";
const N3 = require('n3');
const parser = new N3.Parser();
import * as fs from 'fs';
import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";
const solid_pod_location = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/";
const notifications_aggregator_location = "ws://n078-22.wall1.ilabt.imec.be:8085/";
const ldes_location = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/";
const ldes_location2 = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/";
const ldes_location3 = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/";
const query = `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/>
REGISTER RStream <output> AS
SELECT (MAX(?o) as ?max)
FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 300000 STEP 60000]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.skt .
    }   
}
`;

const query2 = `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/>
REGISTER RStream <output> AS
SELECT (MAX(?o) as ?max)
FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 300000 STEP 60000]
FROM NAMED WINDOW :w2 ON STREAM <${ldes_location2}> [RANGE 300000 STEP 60000]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.skt .
    }
    WINDOW :w2 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.skt .
    }
}
`;

export async function initializeNotificationClients(number_of_clients: number, number_of_subscribed_streams: number) {
    const clients: Promise<any>[] = [];
    for (let i = 0; i < number_of_clients; i++) {
        clients.push(with_notifications_aggregator_client(number_of_subscribed_streams));
    }
    await Promise.all(clients);
}

async function with_notifications_aggregator_client(number_of_subscribed_streams: number) {
    let start_find_ldes_stream = Date.now();
    await find_relevant_streams(solid_pod_location, ["wearable.skt"]).then((streams) => {
        if (streams) {
            let end_find_ldes_stream = Date.now();
            console.log(`time_to_find_ldes_stream,${end_find_ldes_stream - start_find_ldes_stream}\n`);
        }
    });
    let rsp_engine;
    switch (number_of_subscribed_streams) {
        case 1:
            rsp_engine = new RSPEngine(query);
            break;
        case 2:
            rsp_engine = new RSPEngine(query2);
            break;
        default:
            rsp_engine = new RSPEngine(query);
            break;
    }
    const rsp_parser = new RSPQLParser();
    const rsp_emitter = rsp_engine.register();
    const stream_array: string[] = [];
    const parsed_query = rsp_parser.parse(query);
    parsed_query.s2r.forEach((stream) => {
        stream_array.push(stream.stream_name);
    });

    for (const stream of stream_array) {
        const ldes = new LDESinLDP(stream, new LDPCommunication());
        const metadata = await ldes.readMetadata();
        const bucket_strategy = metadata.getQuads(stream + "#BucketizeStrategy", "https://w3id.org/tree#path", null, null)[0].object.value;
        const stream_location = rsp_engine.getStream(stream) as RDFStream;
        const start_subscribe_notifications = Date.now();
        await subscribe_notifications(stream_location, bucket_strategy);
        const end_subscribe_notifications = Date.now();
        fs.appendFileSync(`with-notification-aggregator-log.csv`, `time_to_subscribe_notifications,${end_subscribe_notifications - start_subscribe_notifications}\n`);
        const time_start_subscribing_results = Date.now();
        subscribe_to_results(rsp_emitter, 33, time_start_subscribing_results);
    }
}

async function subscribe_notifications(ldes_stream: RDFStream, bucket_strategy: string) {
    const websocket = new WebSocket(notifications_aggregator_location, 'solid-stream-notifications-aggregator', {
        perMessageDeflate: false
    });

    websocket.once('open', () => {
        console.log('Connection to the WebSocket server was successful.');
        let message_object = {
            subscribe: [`${ldes_stream.name}`],
        };
        websocket.send(JSON.stringify(message_object));
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
        fs.appendFileSync(`with-notification-aggregator-log.csv`, `time_to_preprocess_event,${time_after_preprocessing - time_before_preprocessing}\n`);
        add_event_to_rsp_engine(stream_store, [ldes_stream], timestamp_epoch);
        const time_after_adding_event = Date.now();
        fs.appendFileSync(`with-notification-aggregator-log.csv`, `time_to_add_event_to_rsp_engine,${time_after_adding_event - time_after_preprocessing}\n`);
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

async function subscribe_to_results(rsp_emitter: any, i: number, time_start_subscribing_results: number) {
    const listener = (event: any) => {
        let iterable = event.bindings.values();
        for (let item of iterable) {
            const time_received_aggregation_event = Date.now();
            const timestamp = Date.now();
            fs.appendFileSync(`with-notification-aggregator-log.csv`, `time_received_aggregation_event,${time_received_aggregation_event - time_start_subscribing_results}\n`);
            time_start_subscribing_results = time_received_aggregation_event;
            fs.appendFileSync(`output.txt`, `${timestamp},${item.value}\n`);
        }
    }
    rsp_emitter.on('RStream', listener);
    rsp_emitter.on('end', () => {
        rsp_emitter.removeListener('RStream', listener);
        console.log(`Iteration ${i} has ended`);
    });
}
