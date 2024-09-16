import { RSPEngine, RSPQLParser, RDFStream } from "rsp-js";
import axios from "axios";
import * as fs from "fs";
import * as http from "http";
import * as N3 from "n3";
import * as SETUP from "../../../config/setup.json";
import { add_event_to_rsp_engine, subscribe_notifications, subscribe_to_results, setup_server } from "./generate-clients";

const parser = new N3.Parser();

const ldes_acc_x = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/";
const ldes_acc_y = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/";
const ldes_acc_z = "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/";
const query = `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX func: <http://extension.org/functions#> 
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/> 
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

// Define memory usage interface
interface MemoryUsage {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
}

async function without_aggregator_client(number_of_clients: number, current_client_index: number) {
    const logFile = `log-${current_client_index}.log`;
    const rsp_engine = new RSPEngine(query);
    const rspql_parser = new RSPQLParser();
    const rsp_emitter = rsp_engine.register();
    const stream_array: string[] = [];
    const parsed_query = rspql_parser.parse(query);

    // Initialize log file with headers
    fs.writeFileSync(logFile, `timestamp, cpu_user, cpu_system, rss, heapTotal, heapUsed, external\n`);

    // Function to log CPU and memory usage
    function logCpuMemoryUsage() {
        const cpuUsage = process.cpuUsage(); // in microseconds
        const memoryUsage: MemoryUsage = process.memoryUsage(); // in bytes
        const timestamp = Date.now();

        // Log data in CSV format
        const logData = `${timestamp}, ${cpuUsage.user}, ${cpuUsage.system}, ${memoryUsage.rss}, ${memoryUsage.heapTotal}, ${memoryUsage.heapUsed}, ${memoryUsage.external}\n`;
        fs.appendFileSync(logFile, logData);
    }

    // Log every 0.5 seconds
    setInterval(logCpuMemoryUsage, 500);

    for (const stream of parsed_query.s2r) {
        stream_array.push(stream.stream_name);
    }

    const http_server = http.createServer((request, response) => {
        if (request.method === "POST") {
            let body = "";
            request.on("data", (chunk) => {
                body += chunk.toString();
            });
            request.on("end", async () => {
                try {
                    const notification = JSON.parse(body);
                    const resource_location = notification.object;
                    const ldes_inbox = notification.target;
                    const lastIndexOf = ldes_inbox.lastIndexOf("/");
                    const ldes_location = ldes_inbox.substring(0, ldes_inbox.lastIndexOf("/", lastIndexOf - 1) + 1);
                    const time_before_fetching = Date.now();
                    const response_fetch = await axios.get(resource_location);
                    const time_after_fetching = Date.now();
                    fs.appendFileSync(`without-aggregator-${current_client_index}-client.csv`, `time_to_fetch_notification,${time_after_fetching - time_before_fetching}\n`);
                    const store = new N3.Store();
                    await parser.parse(response_fetch.data, (error, quad) => {
                        if (error) {
                            console.error(`Error parsing quads: ${error}`);
                        }
                        else if (quad) {
                            store.addQuad(quad);
                        }
                    });
                    const timestamp = store.getQuads(null, "https://saref.etsi.org/core/hasTimestamp", null, null)[0].object.value;
                    const timestamp_epoch = Date.parse(timestamp);
                    const stream = rsp_engine.getStream(ldes_location) as RDFStream;
                    console.log(timestamp_epoch, response_fetch.data, stream);
                    add_event_to_rsp_engine(store, [stream], timestamp_epoch);
                    response.writeHead(200, { "Content-Type": "text/plain" });
                    response.end("200 - OK");
                } catch (error) {
                    response.writeHead(400, "Bad Request", { "Content-Type": "text/plain" });
                    response.end("400 - Bad Request");
                }
            });
        }
    });

    const http_port = await setup_server(http_server);
    for (const stream of stream_array) {
        let stream_location = rsp_engine.getStream(stream) as RDFStream;
        const if_subscription = await subscribe_notifications(stream_location, http_port);
        if (if_subscription) {
            console.log(`Subscribed to ${stream}`);
        }
        else {
            console.log(`Failed to subscribe to ${stream}`);
        }

    }

    subscribe_to_results(rsp_emitter, Date.now(), current_client_index);
}

// Handle message from the parent process
process.on('message', async ({ number_of_clients, current_client_index }: { number_of_clients: number, current_client_index: number }) => {
    await without_aggregator_client(number_of_clients, current_client_index);
});
