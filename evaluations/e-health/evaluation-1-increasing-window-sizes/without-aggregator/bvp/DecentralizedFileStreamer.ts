import { QueryEngine } from "@comunica/query-sparql";
import { LDESinLDP, LDPCommunication, SolidCommunication } from "@treecg/versionawareldesinldp";
import { RDFStream, RSPEngine } from "rsp-js";
import { Bindings } from '@comunica/types';
const { Store } = require('n3');
const ld_fetch = require('ldfetch');
const ldfetch = new ld_fetch({});
import { Quad } from "n3";
import WebSocket from 'ws';
import { RateLimitedLDPCommunication } from "rate-limited-ldp-communication";
import { insertion_sort } from "./FileStreamer";

export class DecentralizedFileStreamer {
    public ldes_stream: string;
    public from_date: Date;
    public to_date: Date;
    public stream_name: RDFStream | undefined;
    public ldes!: LDESinLDP;
    public comunica_engine: QueryEngine;
    public communication: LDPCommunication;
    public session: any;
    public observation_array: any[];
    public query: string
    public file_streamer_start_time: number = 0;
    public logger: any
    public websocket_listening_time: number = 0;

    constructor(ldes_stream: string, from_date: Date, to_date: Date, rsp_engine: RSPEngine, query: string) {
        this.ldes_stream = ldes_stream;
        this.communication = new LDPCommunication();
        this.from_date = from_date;
        this.to_date = to_date;
        this.query = query;
        this.stream_name = rsp_engine.getStream(this.ldes_stream);
        this.comunica_engine = new QueryEngine();
        this.observation_array = [];
        this.initiateDecentralizedFileStreamer().then(() => {
        });
    }


    public async initiateDecentralizedFileStreamer(): Promise<void> {
        const communication = this.communication;
        this.ldes = new LDESinLDP(this.ldes_stream, communication);
        this.file_streamer_start_time = Date.now();
        const stream = await this.ldes.readMembersSorted({
            from: this.from_date,
            until: this.to_date,
            chronological: true
        });

        stream.on("data", async (data: any) => {
            let stream_store = new Store(data.quads);
            const binding_stream = await this.comunica_engine.queryBindings(`
            select ?s where {
                ?s ?p ?o .
            }`, {
                sources: [stream_store]
            });

            binding_stream.on('data', async (binding: any) => {
                for (let subject of binding.values()) {
                    this.observation_array.push(subject.id);
                    this.observation_array = insertion_sort(this.observation_array);
                }
            });

            binding_stream.on('end', async () => {
                let unique_observation_array = [...new Set(this.observation_array)];
                for (let observation of unique_observation_array) {
                    let observation_store = new Store(stream_store.getQuads(observation, null, null, null));
                    if (observation_store.size > 0) {
                        const timestamp_stream = await this.comunica_engine.queryBindings(`
                        PREFIX saref: <https://saref.etsi.org/core/>
                        SELECT ?time WHERE {
                            <${observation}> saref:hasTimestamp ?time .
                        }
                        `, {
                            sources: [observation_store]
                        });

                        timestamp_stream.on('data', async (bindings: Bindings) => {
                            let time = bindings.get('time');
                            if (time !== undefined) {
                                let timestamp = await this.epoch(time.value);
                                if (this.stream_name) {
                                    await this.add_event_to_rsp_engine(observation_store, [this.stream_name], timestamp);
                                }
                            }
                        });
                    }
                }

            });
        });

        stream.on("end", async () => {
            console.log(`The stream has ended.`);
        });

        stream.on("error", async (error: Error) => {
            console.log(`The reading from the solid pod ldes stream has an error: ${error}`);
        });
    }

    async add_event_store_to_rsp_engine(store: typeof Store, stream_name: RDFStream[]) {
        const binding_stream = await this.comunica_engine.queryBindings(`
        PREFIX saref: <https://saref.etsi.org/core/>
        SELECT ?time WHERE {
            ?s saref:hasTimestamp ?time .
        }
        `, {
            sources: [store]
        });

        binding_stream.on('data', async (bindings: Bindings) => {
            let time = bindings.get('time');
            if (time !== undefined) {
                let timestamp = await this.epoch(time.value);
                console.log(`Timestamp: ${timestamp}`);
                if (stream_name) {
                    console.log(`Adding Event to ${stream_name}`);
                    await this.add_event_to_rsp_engine(store, stream_name, timestamp);
                }
                else {
                    console.log(`The stream is undefined`);
                }
            }
            else {
                console.log(`The time is undefined`);
            }
        });
    }

    async add_event_to_rsp_engine(store: typeof Store, stream_name: RDFStream[], timestamp: number) {
        stream_name.forEach((stream: RDFStream) => {
            let quads = store.getQuads(null, null, null, null);
            for (let quad of quads) {
                stream.add(quad, timestamp);
            }
        });
    }

    async epoch(date: string) {
        return Date.parse(date);
    }


    async get_inbox_container(stream: string) {
        console.log(`Getting the inbox container from`, stream);
        let ldes_in_ldp: LDESinLDP = new LDESinLDP(stream, new LDPCommunication());
        let metadata = await ldes_in_ldp.readMetadata();
        for (const quad of metadata) {
            if (quad.predicate.value === 'http://www.w3.org/ns/ldp#inbox') {
                console.log(quad.object.value);
                if (quad.object.value != undefined) {
                    return quad.object.value;
                }
            }
        }
    }

    async subscribe_webhook_notification(ldes_stream: string): Promise<void> {
        let solid_server = ldes_stream.split("/").slice(0, 3).join("/");
        let webhook_notification_server = solid_server + "/.notifications/WebhookChannel2023/";
        let post_body = {
            "@context": [],
            "type": "http://www.w3.org/ns/solid/notifications#WebhookChannel2023",
            "topic": `${ldes_stream}`,
            "sendTo": "http://localhost:8080/"
        };

        const response = await fetch(webhook_notification_server, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                'Accept': 'application/ld+json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(post_body)
        });
        const response_json = await response.json();
        console.log(response_json.sendTo);
    }

    async get_stream_subscription_websocket_url(ldes_stream: string): Promise<string> {
        let solid_server = ldes_stream.split("/").slice(0, 3).join("/");
        let notification_server = solid_server + "/.notifications/WebSocketChannel2023/";
        let post_body = {
            "@context": ["https://www.w3.org/ns/solid/notification/v1"],
            "type": "http://www.w3.org/ns/solid/notifications#WebSocketChannel2023",
            "topic": `${ldes_stream}`
        }
        const repsonse = await fetch(notification_server, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                'Accept': 'application/ld+json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(post_body)
        });
        const response_json = await repsonse.json();
        return response_json.receiveFrom;
    }

    async add_sorted_queue_to_rsp_engine(sorted_queue: any) {
        for (let i = 0; i < sorted_queue.size(); i++) {
            let element = sorted_queue.dequeue();
            console.log(element);
        }
    }

    async get_inbox_subscription_websocket_url(ldes_stream: string, inbox_container: string): Promise<string> {
        let solid_server = ldes_stream.split("/").slice(0, 3).join("/");
        let notification_server = solid_server + "/.notifications/WebSocketChannel2023/";
        let post_body = {
            "@context": ["https://www.w3.org/ns/solid/notification/v1"],
            "type": "http://www.w3.org/ns/solid/notifications#WebSocketChannel2023",
            "topic": `${inbox_container}`
        }
        const repsonse = await fetch(notification_server, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/ld+json',
                'Accept': 'application/ld+json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(post_body)
        })

        const response_json = await repsonse.json();
        return response_json.receiveFrom;
    }

    get_websocket_listening_time() {
        return this.websocket_listening_time;
    }

    get_file_streamer_start_time() {
        return this.file_streamer_start_time;
    }
}

type session_credentials = {
    id: string;
    secret: string;
    idp: string;
}