import { RSPEngine, RSPQLParser } from "rsp-js";
import { FileStreamer } from "./FileStreamer";
import * as fs from 'fs';
import { sleep } from "@treecg/versionawareldesinldp";
import { EventEmitter } from "ws";
let ldes_location = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/";
let query = `
    PREFIX saref: <https://saref.etsi.org/core/>
    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
    PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (AVG(?o) as ?maxSKT)
    FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 300000 STEP 60000]
    WHERE {
        WINDOW :w1 {
            ?s saref:hasValue ?o .
            ?s saref:relatesToProperty dahccsensors:wearable.skt .
        }   
    }
`;
const number_of_iterations = 33;
const to_date = new Date("2024-02-01T17:54:03.025Z");
const from_date = new Date("2024-02-01T17:49:03.012Z");
let streamer_start_time: number;
async function rsp_engine() {
    const rsp_engine = new RSPEngine(query);
    const parser = new RSPQLParser();
    const rsp_emitter = rsp_engine.register();
    const stream_array: string[] = []
    const parsed_query = parser.parse(query);
    parsed_query.s2r.forEach((stream) => {
        stream_array.push(stream.stream_name);
    });

    for (const stream of stream_array) {
        const file_streamer = new FileStreamer(stream, from_date, to_date, rsp_engine, parsed_query.s2r[0].width);
        for (let i = 0; i < number_of_iterations; i++) {
            file_streamer.initialize_file_streamer();
            streamer_start_time = Date.now();
            await subscribe_to_results(rsp_emitter, i, streamer_start_time);
            await sleep(10000);
            reset_state(rsp_emitter, rsp_engine);
        }
    }
}

function reset_state(emitter: EventEmitter, rsp_engine: RSPEngine) {
    emitter.removeAllListeners('RStream');
    emitter.removeAllListeners('end');
    rsp_engine.windows[0].active_windows = new Map();
    rsp_engine.windows[0].t0 = 0;
    rsp_engine.windows[0].time = 0;

}


async function subscribe_to_results(rsp_emitter: any, i: number, streamer_start_time: number) {
    const listener = (event: any) => {
        let iterable = event.bindings.values();
        for (let item of iterable) {
            console.log(item);
            fs.appendFileSync(`noagg-300000.csv`, `Total,${Date.now() - streamer_start_time}\n`);
            if (item.value !== 0) {
                fs.appendFileSync(`output.txt`, `${item.value}\n`);
            }
        }
    }
    rsp_emitter.on('RStream', listener);
    rsp_emitter.on('end', () => {
        rsp_emitter.removeListener('RStream', listener);
    });
}

rsp_engine();
