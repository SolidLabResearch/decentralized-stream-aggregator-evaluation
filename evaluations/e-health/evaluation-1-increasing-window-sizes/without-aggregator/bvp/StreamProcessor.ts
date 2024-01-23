import { RDFStream, RSPQLParser, RSPEngine } from 'rsp-js';
import { FileStreamer } from './FileStreamer';
import { EventEmitter } from 'events';

export class StreamProcessor {
    public query: string;
    public from_date: Date;
    public to_date: Date;
    public stream_array: string[];
    public parser: RSPQLParser;
    public rsp_engine: RSPEngine;
    public rsp_emitter: EventEmitter;

    constructor(query: string, from_date: Date, to_date: Date) {
        this.query = query;
        this.from_date = from_date;
        this.to_date = to_date;
        this.stream_array = [];
        this.parser = new RSPQLParser();
        this.rsp_engine = new RSPEngine(query);
        this.rsp_emitter = this.rsp_engine.register();
        this.parser.parse(this.query).s2r.forEach((stream) => {
            this.stream_array.push(stream.stream_name);
        });
        this.start_streamer();
    }

    public start_streamer() {
        for (const stream of this.stream_array) {
            new FileStreamer(stream, this.from_date, this.to_date, this.rsp_engine);
        }
        this.execute_stream_processor();
    }

    public execute_stream_processor() {
        console.log(`The stream processor has started.`);
        this.rsp_emitter.on('RStream', async (object: any) => {
            let iterable = object.bindings.values();
            for (let item of iterable) {
                console.log(`Value received: `, item.value);
            }
        })
    }
}