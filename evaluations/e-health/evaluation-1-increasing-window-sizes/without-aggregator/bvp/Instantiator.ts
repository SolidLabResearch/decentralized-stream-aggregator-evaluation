import { RSPEngine, RSPQLParser } from "rsp-js";
import { DecentralizedFileStreamer } from "./DecentralizedFileStreamer";
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter, on } from "events";
const WebSocketClient = require('websocket').client;
const websocketConnection = require('websocket').connection;
const parser = new RSPQLParser();

export class Instantiator {
    public query: string;
    public rsp_engine: RSPEngine;
    public rsp_emitter: EventEmitter;
    public from_date: Date;
    public client = new WebSocketClient();
    static connection: typeof websocketConnection;
    public stream_array: string[];
    public to_date: Date;
    public constructor(query: string, from_timestamp: Date, to_timestamp: Date) {
        this.query = query;
        this.rsp_engine = new RSPEngine(query);
        this.from_date = from_timestamp;
        this.to_date = to_timestamp;
        this.stream_array = [];
        parser.parse(this.query).s2r.forEach((stream: { stream_name: string; }) => {
            this.stream_array.push(stream.stream_name);
        });        
        this.rsp_emitter = this.rsp_engine.register();
        this.connect_with_server('ws://localhost:3001');
        this.intiateDecentralizedFileStreamer();
    }
    public async intiateDecentralizedFileStreamer() {
        console.log(`Initiating LDES Reader for ${this.stream_array}`);
        for (const stream of this.stream_array) {
            new DecentralizedFileStreamer(stream, this.from_date, this.to_date, this.rsp_engine, this.query);
        }
        await this.executeRSP(this.rsp_emitter);
    }

    public async executeRSP(emitter: EventEmitter) {
        console.log(`Waiting for events to be emitted from the RSP Engine for ${this.stream_array}`);
        emitter.on('RStream', async (object: any) => {
            Instantiator.sendToServer(object.aggregation_event);
            process.exit(0);
        });
    }

    // TODO : add extra projection variables to the aggregation event.
    generate_aggregation_event(value: string, event_timestamp: number, stream_array: string[] | undefined, timestamp_from: number, timestamp_to: number): string {
        if (stream_array === undefined) {
            throw new Error("The stream array is undefined. ");
        }
        else {
            const timestamp_date = new Date(event_timestamp).toISOString();
            const timestamp_from_date = new Date(timestamp_from).toISOString();
            const timestamp_to_date = new Date(timestamp_to).toISOString();
            let uuid_random = uuidv4();
            let aggregation_event = `
        <https://rsp.js/aggregation_event/${uuid_random}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://saref.etsi.org/core/Measurement> .
        <https://rsp.js/aggregation_event/${uuid_random}> <https://saref.etsi.org/core/hasTimestamp> "${timestamp_date}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
        <https://rsp.js/aggregation_event/${uuid_random}> <https://saref.etsi.org/core/hasValue> "${value}"^^<http://www.w3.org/2001/XMLSchema#float> .
        <https://rsp.js/aggregation_event/${uuid_random}> <http://www.w3.org/ns/prov#wasDerivedFrom> <https://argahsuknesib.github.io/asdo/AggregatorService> .
        <https://rsp.js/aggregation_event/${uuid_random}> <http://w3id.org/rsp/vocals-sd#startedAt> "${timestamp_from_date}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
        <https://rsp.js/aggregation_event/${uuid_random}> <http://w3id.org/rsp/vocals-sd#endedAt> "${timestamp_to_date}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
        `;
            for (let stream of stream_array) {
                aggregation_event += `<https://rsp.js/aggregation_event/${uuid_random}> <http://www.w3.org/ns/prov#generatedBy> <${stream}> .`
            }
            return aggregation_event;
        }
    }
    async connect_with_server(wssURL: string) {
        this.client.connect(wssURL, 'solid-stream-aggregator-protocol');
        this.client.on('connectFailed', (error: Error) => {
            console.log('Connect Error: ' + error.toString());
        });
        this.client.setMaxListeners(Infinity);
        this.client.on('connect', (connection: typeof websocketConnection) => {
            Instantiator.connection = connection;
        });
    }

    static sendToServer(message: string) {
        if (this.connection.connected) {
            this.connection.sendUTF(message);
        }
    }


}

export type aggregation_object = {
    query_hash: string,
    aggregation_event: string,
    aggregation_window_from: Date,
    aggregation_window_to: Date
}

export type Credentials = {
    [key: string]: {
        id: string;
        secret: string;
        idp: string;
    };
};


