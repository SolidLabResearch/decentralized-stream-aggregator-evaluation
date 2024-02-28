import { RSPQLParser, RSPEngine } from 'rsp-js';
import { FileStreamer } from './FileStreamer';
import { EventEmitter } from 'events';
import fs from 'fs';

export class StreamProcessor {
    public query: string;
    public from_date: Date;
    public to_date: Date;
    public stream_array: string[];
    public parser: RSPQLParser;
    public streamer_start_time: number = 0;
    public streamer_end_time: number|null = null;
    public window_width: number;
    public rsp_engine: RSPEngine;
    public rsp_emitter: EventEmitter;

    constructor(query: string, from_date: Date, to_date: Date) {
        this.query = query;
        this.from_date = from_date;
        this.to_date = to_date;
        this.stream_array = [];
        this.parser = new RSPQLParser();
        this.rsp_engine = new RSPEngine(query);
        this.parser.parse(this.query).s2r.forEach((stream) => {
            this.stream_array.push(stream.stream_name);
        });
        this.window_width = this.parser.parse(this.query).s2r[0].width;
        this.rsp_emitter = this.rsp_engine.register();
        this.start_streamer();
    }

    public async start_streamer() {
        for (const stream of this.stream_array) {
            this.streamer_start_time = Date.now();
            console.log(`Starting the FileStreamer for ${stream}`);
            new FileStreamer(stream, this.from_date, this.to_date, this.rsp_engine, this.window_width);
        }
        this.execute_stream_processor();
    }

    public async execute_stream_processor() {
        console.log(`Waiting for events from the RStream.`);
        this.rsp_emitter.on('RStream', async (object: any) => {
            if (this.streamer_end_time === null) {
                this.streamer_end_time = Date.now();
                fs.appendFileSync(`noagg-${this.window_width}.csv`, `${this.window_width},${(this.streamer_end_time - this.streamer_start_time)}\n\n`);
            }
            let iterable = object.bindings.values();
            for (let item of iterable) {
                if (item.value) {
                    console.log(`Value is ${item.value}`);
                }
            }
        });
    }
}