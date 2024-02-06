import { StreamProcessor } from "../../evaluation-1-increasing-window-sizes/without-aggregator/StreamProcessor";
import pidusage from "pidusage";
import fs from 'fs';
const { eventLoopUtilization } = require('node:perf_hooks').performance;

let ldes_location = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/";

export async function create_non_aggregator_client(number_of_clients: number) {
    const client_promises = [];
    for (let client = 0; client < number_of_clients; client++) {
        const promise = create_client();
        client_promises.push(promise)
    }
    await Promise.all(client_promises);
}

async function create_client() {
    const query = `
    PREFIX saref: <https://saref.etsi.org/core/>
    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
    PREFIX : <https://rsp.js/>
    REGISTER RStream <output> AS
    SELECT (MAX(?o) as ?maxSKT)
    FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 60000 STEP 10000]
    WHERE {
        WINDOW :w1 {
            ?s saref:hasValue ?o .
            ?s saref:relatesToProperty dahccsensors:wearable.skt .
        }   
    }
    `;
    let to_date = new Date("2024-02-01T18:19:02.8460Z");
    let from_date = new Date(to_date.getTime() - 60000);
    new StreamProcessor(query, from_date, to_date);
}

export async function record(evaluation_name: string, query_function_id: string) {
    const process_id = process.pid;
    const memory_usage = (process.memoryUsage());
    const memory_mb = memory_usage.rss / 1024 / 1024;
    const event_loop = eventLoopUtilization();
    const event_loop_usage = eventLoopUtilization(event_loop).utilization
    pidusage(process_id, (err, stats) => {
        const timestamp = stats.timestamp;
        const cpu_usage = stats.cpu.toFixed(3);
        const timestamp_date = new Date(timestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '');
        // const data = `${timestamp},${cpu_usage},${event_loop_usage*100},${memory_mb.toFixed(3)}\n`;
        const data = `${timestamp},${cpu_usage},${memory_mb.toFixed(3)}\n`;
        const file = `${query_function_id}.csv`
        fs.appendFile(file, data, () => {
        })
    });
}
export async function record_usage(evaluation_name: string, query_function_id: string, interval: number) {
    setInterval(() => {
        record(evaluation_name, query_function_id);
    }, interval);
}

export async function epoch(date: string) {
    return Date.parse(date);
}
