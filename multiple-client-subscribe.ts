import { RDFStream, CSPARQLWindow } from "rsp-js";
import axios from 'axios';
const N3 = require('n3');
const parser = new N3.Parser();
import * as http from 'http';
const ldes_location = "http://localhost:3000/aggregation_pod/skt/";

async function subscribe_notifications(stream_location: RDFStream) {
    console.log(`Subscribing to notifications for stream ${stream_location.name}`);
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


const clients = 500;

const stream_to_subscribe = new RDFStream("http://localhost:3000/aggregation_pod/skt/", new CSPARQLWindow("1000", 1000, 1000, 1000, 1000, 1000));
(async function () {
    http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            console.log(body);
            res.end('ok');
        });
    }).listen(8084);
    console.log('starting runs');
    const time_start = Date.now();
    const promises: Promise<any>[] = [];
    for (let i = 0; i < clients; ++i) {
        promises.push(subscribe_notifications(stream_to_subscribe));
    }
    console.log(await Promise.all(promises));
    console.log(`Time taken: ${Date.now() - time_start}ms`);
})();
