import { RSPEngine, RDFStream } from "rsp-js";
import { QueryEngine } from "@comunica/query-sparql";
import { LDPCommunication, LDESinLDP, LDES, storeToString } from "@treecg/versionawareldesinldp";
const N3 = require('n3');
import fs from 'fs';

export class FileStreamer {

    private ldes_stream: string;
    private from_date: Date;
    private to_date: Date;
    public stream_name: RDFStream | undefined;
    public comunica_engine: QueryEngine;
    public ldes!: LDESinLDP;
    public communication: LDPCommunication;
    private time_to_add_events = 0;
    private observation_array: any[];

    constructor(ldes_stream: string, from_date: Date, to_date: Date, rspEngine: RSPEngine) {
        this.ldes_stream = ldes_stream;
        this.from_date = from_date;
        this.to_date = to_date;
        this.stream_name = rspEngine.getStream(ldes_stream) as RDFStream;
        this.communication = new LDPCommunication();
        this.comunica_engine = new QueryEngine();
        this.observation_array = [];
        this.initialize_file_streamer().then(() => {
            console.log(`Reading from the solid pod is initialized.`);
        });
    }

    public async initialize_file_streamer(): Promise<void> {
        this.ldes = new LDESinLDP(this.ldes_stream, this.communication);
        let metadata = await this.ldes.readMetadata();
        let bucket_strategy = metadata.getQuads(this.ldes_stream + "#BucketizeStrategy", "https://w3id.org/tree#path", null, null)[0].object.value;        
        let streamer_start = Date.now();
        const stream = await this.ldes.readMembersSorted({
            from: this.from_date,
            until: this.to_date,
            chronological: true
        });

        stream.on('data', async (data) => {
            let store = new N3.Store(data.quads)
            let timestamp = store.getQuads(null, bucket_strategy, null, null)[0].object.value;
            let timestamp_epoch = Date.parse(timestamp);
            let time_start = performance.now();
            await add_event_to_rsp_engine(store, [this.stream_name as RDFStream], timestamp_epoch);
            let time_end = performance.now();
            let time_taken = time_end - time_start;
            this.time_to_add_events = this.time_to_add_events + time_taken;
            fs.appendFileSync('events.txt', `${time_taken/1000}\n`);            
        });
        stream.on('end', async () => {
            let streamer_end = Date.now();
            console.log(`Time to add events to the RSP-Engine: ${this.time_to_add_events / 1000}s`);
            fs.appendFileSync('streamer.txt', `${(streamer_end - streamer_start) / 1000}s\n`);
            console.log(`Decentralized File Streamer has ended.`);
        });
    }
}

export async function add_event_to_rsp_engine(store: any, stream_name: RDFStream[], timestamp: number) {
    stream_name.forEach(async(stream: RDFStream) => {
        let quads = store.getQuads(null, null, null, null);
        for (let quad of quads) {            
            stream.add(quad, timestamp);
        }
    });
}

export function epoch(date: string) {
    return Date.parse(date);
}

export function insertion_sort(arr: string[]): string[] {
    const len = arr.length;

    for (let i = 1; i < len; i++) {
        const current = arr[i];
        let j = i - 1;

        while (j >= 0 && arr[j] > current) {
            arr[j + 1] = arr[j];
            j--;
        }

        arr[j + 1] = current;
    }

    return arr;
}