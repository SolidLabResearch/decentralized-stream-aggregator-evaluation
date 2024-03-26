import { storeToString } from "@treecg/versionawareldesinldp";
let ldfetch = require('ldfetch');
let ld_fetch = new ldfetch({});
const N3 = require('n3');
import pidusage from 'pidusage';
import { RDFStream } from 'rsp-js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export async function find_stream_aggregator(solid_pod_url: string): Promise<string> {
    // The assumption is that the information related to the Solid Stream Aggregator
    // is stored in the profile document of the Solid Pod.
    let profie_document = solid_pod_url + "/profile/card";

    try {
        const response = await ld_fetch.get(profie_document);
        let store = new N3.Store(await response.triples);

        for (let quad of store) {
            if (quad.predicate.value == 'http://argahsuknesib.github.io/asdo/hasStreamAggregationService') {
                return quad.object.value;
            }
        }

        return '';
    } catch (error) {
        console.log(`Error: ${error}`);
        return '';
    }
}

export async function find_public_type_index(solid_pod_url: string): Promise<string> {
    let profie_document = solid_pod_url + "/profile/card";

    try {
        const response = await ld_fetch.get(profie_document);
        let store = new N3.Store(await response.triples);

        for (let quad of store) {
            if (quad.predicate.value == "http://www.w3.org/ns/solid/terms#publicTypeIndex") {
                return quad.object.value;
            };
        }

        console.log(`Could not find a public type index for ${solid_pod_url}`);
        return '';
    }
    catch (error) {
        console.log(`Error: ${error}`);
        return '';
    }
}


export async function find_relevant_streams(solid_pod_url: string, interest_metrics: string[]): Promise<string[]> {
    let relevant_streams: string[] = [];
    if (if_exists_relevant_streams(solid_pod_url, interest_metrics)) {
        try {
            let public_type_index = await find_public_type_index(solid_pod_url);
            const response = await ld_fetch.get(public_type_index);
            let store = new N3.Store(await response.triples);
            for (let quad of store) {
                if (quad.predicate.value == "https://w3id.org/tree#view") {
                    relevant_streams.push(quad.object.value);
                }
            }
            return relevant_streams;
        }
        catch (error) {
            console.log(`Error: ${error}`);
            return relevant_streams;
        }

    }
    return relevant_streams;
}

export async function if_exists_relevant_streams(solid_pod_url: string, interest_metrics: string[]): Promise<boolean> {
    try {
        let public_type_index = await find_public_type_index(solid_pod_url);
        const response = await ld_fetch.get(public_type_index);
        let store = new N3.Store(await response.triples);
        for (let quad of store) {
            if (quad.predicate.value == "https://saref.etsi.org/core/relatesToProperty") {
                if (interest_metrics.includes(quad.object.value)) {
                    return true;
                }
            }
        }
        return false;
    }
    catch (error) {
        console.log(`Error: ${error}`);
        return false;
    }
}

export async function patch_request(solid_pod_url: string, aggregator_location: string) {
    const store = new N3.Store();
    let profie_document = solid_pod_url + "/profile/card";
    store.addQuad(
        N3.DataFactory.namedNode(solid_pod_url + '/profile/card#me'),
        N3.DataFactory.namedNode('http://w3id.org/rsp/vocals-sd#hasFeature'),
        N3.DataFactory.namedNode('http://w3id.org/rsp/vocals-sd#ProcessingService')
    );
    store.addQuad(
        N3.DataFactory.namedNode('http://w3id.org/rsp/vocals-sd#ProcessingService'),
        N3.DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        N3.DataFactory.namedNode('http://argahsuknesib.github.io/asdo/StreamAggregationService')
    );
    store.addQuad(
        N3.DataFactory.namedNode('http://argahsuknesib.github.io/asdo/StreamAggregationService'),
        N3.DataFactory.namedNode('http://xmlns.com/foaf/0.1/webId'),
        N3.DataFactory.namedNode(aggregator_location + '/#this')
    );
    store.addQuad(
        N3.DataFactory.namedNode(solid_pod_url + '/profile/card#me'),
        N3.DataFactory.namedNode('http://argahsuknesib.github.io/asdo/hasStreamAggregationService'),
        N3.DataFactory.namedNode(aggregator_location),
    )
    fetch(profie_document, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/sparql-update'
        },
        body: "INSERT DATA {" + storeToString(store) + "}",
    }).then(async (response) => {
        console.log(await response.text());
    });
}


export async function record(evaluation_name: string, query_function_id: string) {
    const process_id = process.pid;
    const memory_usage = (process.memoryUsage());
    const memory_mb = memory_usage.rss / 1024 / 1024;
    pidusage(process_id, (err, stats) => {
        const timestamp = stats.timestamp;
        const cpu_usage = stats.cpu.toFixed(3);
        const timestamp_date = new Date(timestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '');
        const data = `${timestamp},${cpu_usage},${memory_mb.toFixed(3)}\n`;
        // const file = `${evaluation_name}/${query_function_id}.csv`;
        const file = `${query_function_id}.csv`
        fs.appendFile(file, data, () => {
        })
    });
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

export async function record_usage(evaluation_name: string, query_function_id: string, interval: number) {
    setInterval(() => {
        record(evaluation_name, query_function_id);
    }, interval);
}

export async function epoch(date: string) {
    return Date.parse(date);
}

export async function add_event_to_rsp_engine(store: any, stream_name: RDFStream[], timestamp: number) {
    stream_name.forEach((stream: RDFStream) => {
        let quads = store.getQuads(null, null, null, null);
        for (let quad of quads) {
            console.log(typeof stream);
            stream.add(quad, timestamp);
        }
    });
}

export async function find_aggregator_location(solid_pod_webid: string) {
    const pod_location = solid_pod_webid.split('/profile/card#me')[0] + '/';
    ld_fetch.get(solid_pod_webid).then((response: any) => {
        let profile_store = new N3.Store(response.triples);
        for (let quad of profile_store) {
            if (quad.predicate.value === 'http://argahsuknesib.github.io/asdo/hasAggregatorLocation') {
                let aggregator_ws = quad.object.value;
                let aggregator_ws_location = 'ws://' + aggregator_ws[1].split('//');
                return aggregator_ws_location;
            }
        }
    });

}