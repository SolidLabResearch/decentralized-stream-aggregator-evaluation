import { RSPEngine, RSPQLParser, RDFStream } from "rsp-js";
import axios from 'axios';
import * as fs from 'fs';
import * as http from 'http';
const N3 = require('n3');
const parser = new N3.Parser();
const ldes_location = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/";
const query = `
PREFIX saref: <https://saref.etsi.org/core/>
PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>
PREFIX : <https://rsp.js/>
REGISTER RStream <output> AS
SELECT (MAX(?o) as ?maxSKT)
FROM NAMED WINDOW :w1 ON STREAM <${ldes_location}> [RANGE 120000 STEP 30000]
WHERE {
    WINDOW :w1 {
        ?s saref:hasValue ?o .
        ?s saref:relatesToProperty dahccsensors:wearable.skt .
    }   
}
`;
const port = 8084;
const rsp_engine = new RSPEngine(query);
const rsp_parser = new RSPQLParser();
const server = http.createServer(request_handler);
const rsp_emitter = rsp_engine.register();
const stream_array: string[] = []
const parsed_query = rsp_parser.parse(query);


async function without_aggregator() {
    parsed_query.s2r.forEach((stream: any) => {
        stream_array.push(stream.stream_name);
    });
    setupServer(port, server);
    for (const stream of stream_array) {
        const stream_location = rsp_engine.getStream(stream) as RDFStream;
        subscribe_notifications(stream_location);
    }
    subscribe_to_results(rsp_emitter);
}

async function setupServer(port: number, server: any) {
    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}/`);
    });
}

async function request_handler(request: http.IncomingMessage, response: http.ServerResponse) {
    console.log(`Request received for the path: ${request.url}`);
    if (request.method === "POST") {
        let body = '';
        request.on('data', (chunk) => {
            body += chunk.toString();
        });
        request.on('end', async () => {
            try {
                const notification = JSON.parse(body);
                const published_time = (new Date(notification.published).getTime()).toString();
                const resource_location = notification.object;
                const response_fetch = await axios.get(resource_location);
                const event_data = response_fetch.data;
                const store = new N3.Store();
                await parser.parse(event_data, (error: any, quad: any) => {
                    if (error) {
                        console.error(`Error parsing the event data`, error)
                    }
                    else {
                        store.addQuad(quad);
                    }
                    const timestamp = store.getQuads(null, "https://saref.etsi.org/core/hasTimestamp", null, null)[0].object.value;
                    const timestamp_epoch = Date.parse(timestamp);
                    const stream = rsp_engine.getStream(ldes_location) as RDFStream;
                    add_event_to_rsp_engine(store, [stream], timestamp_epoch);

                });
                response.writeHead(200, { "Content-Type": "text/plain" });
                response.end("200 - OK");
            } catch (error) {
                response.writeHead(400, "Bad Request", { "Content-Type": "text/plain" });
                response.end("400 - Bad Request");
            }
        });
    }
    else {
        response.writeHead(405, "Method Not Allowed", { "Content-Type": "text/plain" });
        response.end("405 - Method Not Allowed");
    }
}

async function subscribe_notifications(stream_location: RDFStream) {
    const inbox = await extract_inbox(stream_location.name) as string;
    const subscription_server = await extract_subscription_server(inbox);
    if (subscription_server) {
        const body = {
            "@context": ["https://www.w3.org/ns/solid/notification/v1"],
            "type": "http://www.w3.org/ns/solid/notifications#WebhookChannel2023",
            "topic": inbox,
            "sendTo": "http://localhost:8084",
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
            return ldes_location + inbox;
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

export function add_event_to_rsp_engine(store: any, stream_name: RDFStream[], timestamp: number) {
    stream_name.forEach(async (stream: RDFStream) => {
        let quads = store.getQuads(null, null, null, null);
        for (let quad of quads) {
            stream.add(quad, timestamp);
        }
    });
}

export function subscribe_to_results(rsp_emitter: any) {
    const listener = (event: any) => {
        let iterable = event.bindings.values();
        for (let item of iterable) {
            const timestamp = Date.now();
            console.log(`${timestamp},${item.value}`);
            fs.appendFileSync(`output-without-aggregator.txt`, `${timestamp},${item.value}\n`);
        }
    }
}

without_aggregator()