// The file is used to calculate the throughput of the notification system with the Community Solid Server's WebHook2023 
// notification system. The throughput is calculated by counting the number of notifications received by the server every second.
// After testing : Yes the throughput from the notifications of the server is working as expected.
import { EventEmitter } from 'events';
import axios from 'axios';
const N3 = require('n3');
import * as http from 'http';
const parser = new N3.Parser();
const ldes_location = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/";
const port = 8084;

const server = http.createServer(request_handler);

// Create an event emitter to simulate the notification system
const notificationEmitter = new EventEmitter();

// Counter to keep track of the number of notifications received
let notificationCount = 0;

// Function to handle each notification event
const handleNotification = () => {
    notificationCount++;
};

// Function to calculate the notification throughput per second
const calculateThroughput = () => {
    const throughput = notificationCount;
    notificationCount = 0;
    console.log(`Notification throughput: ${throughput} events per second`);
};

// Start calculating the throughput every second
setInterval(calculateThroughput, 1000);

notificationEmitter.on('notification', handleNotification);

async function main() {
    setupServer(port, server);
    const if_subscription_is_true = await subscribe_notifications(ldes_location);
    if (if_subscription_is_true) {
        console.log("Subscribed to notifications for stream");
    }
    else {
        console.error("Failed to subscribe to notifications for stream");
    }
}


async function request_handler(req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        req.on('end', () => {
            const notification = JSON.parse(body);
            notificationEmitter.emit('notification', notification);
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Notification received');
        });
    }
    else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }

}


async function subscribe_notifications(stream_location: string) {
    const inbox = await extract_inbox(stream_location) as string;
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

async function setupServer(port: number, server: any) {
    server.listen(port, () => {
        console.log(`Server running at http://localhost:${port}/`);
    });
}


main();