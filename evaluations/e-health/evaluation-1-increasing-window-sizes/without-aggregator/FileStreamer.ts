import { RSPEngine, RDFStream } from "rsp-js";
import { LDPCommunication, LDESinLDP, LDES, storeToString } from "@treecg/versionawareldesinldp";
const N3 = require('n3');
import fs from 'fs';

export class FileStreamer {

    private ldes_stream: string;
    private from_date: Date;
    private to_date: Date;
    public stream_name: RDFStream | undefined;
    public ldes!: LDESinLDP;
    public communication: LDPCommunication;
    private time_to_add_events = 0;
    public window_width: number;
    private observation_array: any[];

    constructor(ldes_stream: string, from_date: Date, to_date: Date, rspEngine: RSPEngine, window_width: number) {
        this.ldes_stream = ldes_stream;
        this.from_date = from_date;
        this.to_date = to_date;
        this.stream_name = rspEngine.getStream(ldes_stream) as RDFStream;
        this.communication = new LDPCommunication();
        this.observation_array = [];
        this.window_width = window_width;
        this.initialize_file_streamer().then(() => {
            console.log(`Reading from the solid pod is initialized.`);
        });
    }

    public async initialize_file_streamer(): Promise<void> {
        this.ldes = new LDESinLDP(this.ldes_stream, this.communication);
        let metadata = await this.ldes.readMetadata();
        let bucket_strategy = metadata.getQuads(this.ldes_stream + "#BucketizeStrategy", "https://w3id.org/tree#path", null, null)[0].object.value;
        let reader_start = Date.now();
        const stream = await this.ldes.readMembersSorted({
            from: this.from_date,
            until: this.to_date,
            chronological: true
        });
        const reader_end = Date.now();
        fs.appendFileSync(`noagg-${this.window_width}.csv`, `Reader,${(reader_end - reader_start) / 1000}s\n`);
        stream.on('data', async (data) => {
            let pre_process_event_start = Date.now();
            let store = new N3.Store(data.quads)
            let timestamp = store.getQuads(null, bucket_strategy, null, null)[0].object.value;
            let timestamp_epoch = Date.parse(timestamp);
            let pre_process_event_end = Date.now();
            fs.appendFileSync(`noagg-${this.window_width}.csv`, `pre_process,${(pre_process_event_end - pre_process_event_start)}ms\n`);
            let time_start = Date.now();
            await add_event_to_rsp_engine(store, [this.stream_name as RDFStream], timestamp_epoch).then(() => {
                let time_end = Date.now();
                fs.appendFileSync(`noagg-${this.window_width}.csv`, `add_event,${(time_end - time_start)}ms\n`);
            });
        });
        stream.on('end', async () => {
            console.log(`Decentralized File Streamer has ended.`);
        });
    }
}

export async function add_event_to_rsp_engine(store: any, stream_name: RDFStream[], timestamp: number) {
    stream_name.forEach(async (stream: RDFStream) => {
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