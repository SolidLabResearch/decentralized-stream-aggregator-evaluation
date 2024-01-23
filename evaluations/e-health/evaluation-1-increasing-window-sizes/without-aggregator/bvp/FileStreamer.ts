import { RSPEngine, RDFStream } from "rsp-js";
import { QueryEngine } from "@comunica/query-sparql";
import { LDPCommunication, LDESinLDP, LDES } from "@treecg/versionawareldesinldp";
const N3 = require('n3');

export class FileStreamer {

    private ldes_stream: string;
    private from_date: Date;
    private to_date: Date;
    public stream_name: RDFStream | undefined;
    public comunica_engine: QueryEngine;
    public ldes!: LDESinLDP;
    public communication: LDPCommunication;
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
        const stream = await this.ldes.readMembersSorted({
            from: this.from_date,
            until: this.to_date,
            chronological: true
        });

        stream.on('data', async (data) => {
            let stream_store = new N3.Store(data.quads);                        
            const binding_stream = await this.comunica_engine.queryBindings(`
            select ?s where {
                ?s ?p ?o .
            }
            `, {
                sources: [stream_store]
            });

            binding_stream.on('data', async (binding: any) => {
                for (let subject of binding.values()) {
                    this.observation_array.push(subject.id);
                    this.observation_array = insertion_sort(this.observation_array);
                };
            });

            binding_stream.on('end', async () => {
                let unique_observation_array = [...new Set(this.observation_array)];
                for (let observation of unique_observation_array) {
                    let observation_store = new N3.Store(stream_store.getQuads(observation, null, null, null));
                    if (observation_store.size > 0) {
                        const timestamp_stream = await this.comunica_engine.queryBindings(`
                        PREFIX saref: <https://saref.etsi.org/core/>
                        SELECT ?time WHERE {
                            <${observation}> saref:hasTimestamp ?time .
                        }
                        `, {
                            sources: [observation_store]
                        });

                        timestamp_stream.on('data', async (bindings: any) => {
                            let time = bindings.get('time');

                            if (time !== undefined){
                                let timestamp = await epoch(time.value);
                                if (this.stream_name){
                                    await add_event_to_rsp_engine(observation_store, [this.stream_name], timestamp);
                                }
                            }
                        })
                    }
                }
            });
        });

        stream.on('end', async () => {
            console.log(`Decentralized File Streamer has ended.`);
        });
    }
}

export async function add_event_to_rsp_engine(store:any, stream_name: RDFStream[], timestamp: number) {
    stream_name.forEach((stream: RDFStream) => {
        let quads = store.getQuads(null, null, null, null);
        for (let quad of quads) {
            stream.add(quad, timestamp);
        }
    });
}

export function epoch(date: string){
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