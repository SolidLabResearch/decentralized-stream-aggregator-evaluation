import * as fs from 'fs';
import * as http from 'http';
import axios from "axios";
const N3 = require("n3");
const parser = new N3.Parser();
import * as SETUP from "../../../config/setup.json"

interface MemoryUsage {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
}

const ldes_locations = ["http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-x/", "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-y/", "http://n078-03.wall1.ilabt.imec.be:3000/pod1/acc-z/"];

async function without_aggregator_without_rsp_client(number_of_clients: number, current_client_index: number) {


    fs.writeFileSync(`log-${current_client_index}.log`, `timestamp, cpu_user, cpu_system, rss, heapTotal, heapUsed, external\n`);
    function logCpuMemoryUsage() {
        const cpuUsage = process.cpuUsage(); // in microseconds
        const memoryUsage: MemoryUsage = process.memoryUsage(); // in bytes
        const timestamp = Date.now();

        const logData = `${timestamp}, ${cpuUsage.user}, ${cpuUsage.system}, ${memoryUsage.rss}, ${memoryUsage.heapTotal}, ${memoryUsage.heapUsed}, ${memoryUsage.external}\n`;
        fs.appendFileSync(`log-${current_client_index}.log`, logData);
    }

    setInterval(logCpuMemoryUsage, 500);

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
                    const response_fetch = await axios.get(resource_location);
                }
                catch (error) {
                    response.writeHead(400, "Bad Request", { "Content-Type": "text/plain" });
                    response.end("400 - Bad Request");
                }
            });
        }
    });

    const http_port = await setup_server(http_server);

    for (const location of ldes_locations) {
        const if_subscription_is_true = await subscribe_notifications(location, http_port);
        if (if_subscription_is_true) {
            console.log(`Subscription to ${location} was successful`);
        }
    }
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


export async function subscribe_notifications(stream_location: string, http_port: number) {
    const inbox = await extract_inbox(stream_location) as string;
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

// Handle message from the parent process
process.on('message', async ({ number_of_clients, current_client_index }: { number_of_clients: number, current_client_index: number }) => {
    await without_aggregator_without_rsp_client(number_of_clients, current_client_index);
});