import { RSPEngine, RSPQLParser } from 'rsp-js';
import { createServer, Server, ServerResponse, IncomingMessage } from 'http';
import { FileStreamer } from './FileStreamer';
import axios from 'axios';
const N3 = require('n3');
const parser = new N3.Parser();
const store = new N3.Store();
import { EventEmitter } from 'events';
import { sleep } from '@treecg/versionawareldesinldp';
const number_of_iterations = 33;
// const ldes_location = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/';
const ldes_location = 'http://localhost:3000/aggregation_pod/replay/';
const http_server_port = 3002;
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

async function main() {
    const rsp_engine = new RSPEngine(query);
    const parser = new RSPQLParser();
    const rsp_emitter = rsp_engine.register();
    const stream_array: string[] = [];
    const parsed_query = parser.parse(query);
    parsed_query.s2r.forEach((stream) => {
        stream_array.push(stream.stream_name);
    });
    start_http_server();
    // The HTTP Server is started on port 3001
    for (const stream of stream_array) {
        await subscribe_inbox(stream);
    }
}

async function start_http_server() {
    const http_server = createServer(request_handler).listen(http_server_port);
    http_server.keepAliveTimeout = 6000;
    console.log(`HTTP server running on port ${http_server_port}`);
}

async function request_handler(request: IncomingMessage, response: ServerResponse) {
    if (request.method === 'POST') {
        let body = '';
        request.on('data', (chunk) => {
            body += chunk.toString();
        });

        request.on('end', async () => {
            try {
                const notification = JSON.parse(body);
                console.log(notification);
            } catch (error) {
                response.writeHead(500, 'Internal Server Error', { 'Content-Type': 'text/plain' });
                response.end('Internal Server Error.');
            }
        })
    }
    else {
        response.writeHead(405, 'Method Not Allowed', { 'Content-Type': 'text/plain' });
        response.end('Method not allowed.');
    }
}

async function subscribe_inbox(ldes_location: string) {
    const inbox_location = await extract_ldp_inbox(ldes_location) as string;
    const subscription_server = await extract_subscription_server(inbox_location);
    if (subscription_server === undefined) {
        throw new Error("Subscription server is not defined.");
    }
    else {
        const response_stream = await fetch(subscription_server.location, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
            },
            body: JSON.stringify({
                "@context": ["https://www.w3.org/ns/solid/notification/v1"],
                "type": "http://www.w3.org/ns/solid/notifications#WebhookChannel2023",
                "topic": inbox_location,
                "sendTo": "http://localhost:3002/"
            })
        });
        if (response_stream.status === 200) {
            return true;
        }
        else {
            throw new Error("Error while subscribing to the inbox.");
        }
    }
}

async function subscribe_stream(stream_location: string) {
    const subscription_server = await extract_subscription_server(stream_location);
    if (subscription_server === undefined) {
        throw new Error("The Subscription Server is not defined.");
    }
    else {
        try {
            const response_stream = await fetch(subscription_server.location, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/ld+json',
                },
                body: JSON.stringify({
                    "@context": ["https://www.w3.org/ns/solid/notification/v1"],
                    "type": "http://www.w3.org/ns/solid/notifications#WebhookChannel2023",
                    "topic": stream_location,
                    "sendTo": "http://localhost:3002/"
                })
            });

            if (response_stream.status === 200) {
                return true;
            }
            else {
            }
        } catch (error) {
            console.log(error);
        }
    }
}

function reset_state() {

}

export async function extract_subscription_server(resource: string): Promise<any | undefined> {
    try {
        const response = await axios.head(resource);
        const link_header = response.headers['link'];
        if (link_header) {
            const link_header_parts = link_header.split(',');
            for (const part of link_header_parts) {
                const [link, rel] = part.split(';').map((item: string) => item.trim());
                if (rel === 'rel="http://www.w3.org/ns/solid/terms#storageDescription"') {
                    const storage_description_link = link.slice(1, -1); // remove the < and >\
                    const storage_description_response = await axios.get(storage_description_link);
                    const storage_description = storage_description_response.data;
                    await parser.parse(storage_description, (error: any, quad: any) => {
                        if (quad) {
                            store.addQuad(quad);
                        }
                    });
                    const subscription_server = store.getQuads(null, 'http://www.w3.org/ns/solid/notifications#subscription', null)[0].object.value;
                    const subscription_type = store.getQuads(null, 'http://www.w3.org/ns/solid/notifications#channelType', null)[0].object.value;
                    const channelLocation = store.getQuads(null, 'http://www.w3.org/ns/solid/notifications#channelType', null)[0].subject.value;
                    const subscription_response: any = {
                        location: subscription_server,
                        channelType: subscription_type,
                        channelLocation: channelLocation
                    }
                    return subscription_response;
                }
                else {
                    continue;
                }
            }
        }
    } catch (error) {
        console.error(error);
        throw new Error("Error while extracting subscription server.");
    }
}


export async function extract_ldp_inbox(ldes_stream_location: string) {
    try {
        const response = await fetch(ldes_stream_location);
        if (response) {
            await parser.parse(await response.text(), (error: any, quad: any) => {
                if (error) {
                    console.error(error);
                    throw new Error("Error while parsing LDES stream.");
                }
                if (quad) {
                    store.addQuad(quad);
                }
            });
            const inbox = store.getQuads(null, 'http://www.w3.org/ns/ldp#inbox', null)[0].object.value;
            return ldes_stream_location + inbox;
        }
        else {
            throw new Error("The response object is empty.");
        }
    } catch (error) {
        console.error(error);
    }
}

main();