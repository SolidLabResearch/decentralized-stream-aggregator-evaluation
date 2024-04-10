import { WebSocket, EventEmitter } from "ws";
import { RSPEngine, RSPQLParser, RDFStream } from "rsp-js";
import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";
import * as fs from 'fs';
import { find_relevant_streams } from "./Util";
const N3 = require('n3');
const parser = new N3.Parser();
const number_of_iterations = 33;
const solid_pod_location = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/';
const ldes_location = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/';
const query = `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/>
REGISTER RStream <output> AS
SELECT (MAX(?o) as ?maxSKT)
FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 300000 STEP 60000]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.skt .
    }   
}
`;

notification_stream_processor()

async function notification_stream_processor() {
    let start_find_ldes_stream = Date.now();
    await find_relevant_streams(solid_pod_location, ["wearable.skt"]).then((streams) => {
        if (streams) {
            let end_find_ldes_stream = Date.now();
            fs.appendFileSync(`with-notification-aggregator-log.csv`, `time_to_find_ldes_stream,${end_find_ldes_stream - start_find_ldes_stream}\n`);
        }
    });
    const rsp_engine = new RSPEngine(query);
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
        subscribe_to_results(rsp_emitter, number_of_iterations, time_start_subscribing_results);
    }

}

async function subscribe_notifications(ldes_stream: RDFStream, bucket_strategy: string) {
    const websocket = new WebSocket('ws://n061-14a.wall2.ilabt.iminds.be:8085//', 'solid-stream-notifications-aggregator', {
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

function reset_state(event_emitter: EventEmitter, rsp_engine: RSPEngine) {
    event_emitter.removeAllListeners('RStream');
    event_emitter.removeAllListeners('end');
    rsp_engine.windows[0].active_windows = new Map();
    rsp_engine.windows[0].t0 = 0;
    rsp_engine.windows[0].time = 0;
}