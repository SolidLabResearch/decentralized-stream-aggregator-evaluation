import { RSPEngine, RSPQLParser, RDFStream } from "rsp-js";
import * as http from "http";
import axios from "axios";
import * as SETUP from "../../../config/setup.json";
const N3 = require('n3');
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

export async function initializeUnmonitoredClients(number_of_clients: number) {
    const clients: Promise<any>[] = [];

    for (let current_client_index = 0; current_client_index < number_of_clients; current_client_index++) {
        clients.push(withoutAggregatorClient(number_of_clients, current_client_index));
    }

    await Promise.all(clients);
}

async function withoutAggregatorClient(number_of_clients: number, current_client_index: number) {
    const rsp_engine = new RSPEngine(query, {
        max_delay: 60000,
    });

    const rspql_parser: RSPQLParser = new RSPQLParser();
    const rsp_emitter = rsp_engine.register();
    const stream_array: string[] = [];
    const parsed_query = rspql_parser.parse(query);

    for (const stream of parsed_query.s2r) {
        stream_array.push(stream.stream_name);
    }

    const http_server = http.createServer((request, response) => {
        if (request.method === "POST") {
            let body = "";
            request.on("data", (chunk) => {
                body += chunk.toString();
            })

            request.on("end", async () => {
                try {
                    const notification = JSON.parse(body);
                    const resource_location = notification.object;
                    const ldes_inbox = notification.target;

                    const lastIndexOf = ldes_inbox.lastIndexOf("/");
                    const ldes_location = ldes_inbox.substring(0, ldes_inbox.lastIndexOf("/", lastIndexOf - 1) + 1);
                    const response_fetch = await axios.get(resource_location);
                    const event_data = response_fetch.data;

                    const store = new N3.Store();
                    await parser.parse(event_data, (error: any, quad: any, prefixes: any) => {
                        if (error) {
                            console.log(error);
                        }
                        else if (quad) {
                            store.addQuad(quad);
                        }
                    });

                    const timestamp = store.getQuads(null, "https://saref.etsi.org/core/hasTimestamp", null, null)[0].object.value;
                    const timestamp_epoch = Date.parse(timestamp);
                    const stream = rsp_engine.getStream(ldes_location) as RDFStream;
                    add_event_to_rsp_engine(store, [stream], timestamp_epoch);
                    response.writeHead(200, { "Content-Type": "text/plain" });
                    response.end("200 - OK");
                }
                catch (error) {
                    response.writeHead(400, "Bad Request", { "Content-Type": "text/plain" });
                    response.end("400 - Bad Request");
                    console.log(error);
                }
            });
        }
        else {
            response.writeHead(405, { "Content-Type": "text/plain" });
            response.end("405 - Method Not Allowed");
        }
    });


    const http_port: any = await setup_server(http_server);
    for (const stream of stream_array) {
        let stream_location = rsp_engine.getStream(stream) as RDFStream;
        await subscribe_notifications(stream_location, http_port);
    }
    subscribe_to_results(rsp_emitter, current_client_index);
}

export function add_event_to_rsp_engine(store: any, streams: RDFStream[], timestamp: number) {
    streams.forEach(async (stream: RDFStream) => {
        let quads = store.getQuads(null, null, null, null);
        for (let quad of quads) {
            stream.add(quad, timestamp);
        }
    });
}

export function setup_server(http_server: any): Promise<number> {
    return new Promise((resolve, reject) => {
        http_server.listen(0, () => {
            const http_port = http_server.address().port;
            resolve(http_port);
        });
        http_server.on('error', reject);
    });
}

async function subscribe_notifications(stream_location: RDFStream, http_port: number) {
    const inbox = await extract_inbox(stream_location.name) as string;
    const subscription_server = await extract_subscription_server(inbox);
    if (subscription_server) {
        const body = {
            "@context": ["https://www.w3.org/ns/solid/notification/v1"],
            "type": "http://www.w3.org/ns/solid/notifications#WebhookChannel2023",
            "topic": inbox,
            "sendTo": `${SETUP.without_aggregagtor_location}:${http_port}/`,
        }

        const response = await axios.post(subscription_server.location, body, {
            headers: {
                'Content-Type': 'application/ld+json'
            }
        });

        if (response.status === 200) {
            return true;
        }
        else {
            console.error(`The subscription to the notification server failed with status code ${response.status}`)
        }
    }
    else {
        console.error("No subscription server found. It is not defined in the metadata of the Solid Server.");
    }
}

async function extract_inbox(stream_location: string) {
    const store = new N3.Store();
    try {
        const response = await axios.get(stream_location);
        if (response) {
            await parser.parse(response.data, (error: any, quad: any) => {
                if (error) {
                    console.error(`Error parsing the LDES Stream's Metadata`, error)
                }
                if (quad) {
                    store.addQuad(quad);
                }
            });
            const inbox = store.getQuads(null, "http://www.w3.org/ns/ldp#inbox", null)[0].object.value;
            return stream_location + inbox;
        } else {
            console.error("No response received from the server");
        }
    } catch (error) {
        console.error(error);
    }
}

async function extract_subscription_server(resource: string) {
    const store = new N3.Store();
    try {
        const response = await axios.head(resource);
        const link_header = response.headers['link'];
        if (link_header) {
            const link_header_parts = link_header.split(',');
            for (const part of link_header_parts) {
                const [link, rel] = part.split(';').map((item: string) => item.trim());
                if (rel === 'rel="http://www.w3.org/ns/solid/terms#storageDescription"') {
                    const storage_description_link = link.slice(1, -1);
                    const storage_description_response = await axios.get(storage_description_link);
                    const storage_description = storage_description_response.data;
                    await parser.parse(storage_description, (error: any, quad: any) => {
                        if (quad) {
                            store.addQuad(quad);
                        }
                    });
                    const subscription_server = store.getQuads(null, "http://www.w3.org/ns/solid/notifications#subscription", null)[0].object.value;
                    const subscription_type = store.getQuads(null, "http://www.w3.org/ns/solid/notifications#channelType", null)[0].object.value;
                    const channel_location = store.getQuads(null, "http://www.w3.org/ns/solid/notifications#channelType", null)[0].subject.value;

                    const subscription_response = {
                        location: subscription_server,
                        channelType: subscription_type,
                        channelLocation: channel_location
                    }
                    return subscription_response;
                }
                else {
                    continue;
                }
            }
        }
    } catch (error) {
        console.error(`Error extracting subscription server from ${resource}`, error)
    }
}

export function subscribe_to_results(rsp_emitter: any, current_client_index: number) {
    const listener = (event: any) => {
        let iterable = event.bindings.values();
        for (let item of iterable) {
            console.log(`Client ${current_client_index} - Activity Index: ${item.get('?activityIndex')}`);
        }
    }
    rsp_emitter.on('RStream', listener);
    rsp_emitter.on('end', () => {
        rsp_emitter.removeListener('RStream', listener);
    });
}