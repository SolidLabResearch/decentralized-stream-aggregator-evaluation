import { storeToString } from "@treecg/versionawareldesinldp";
let ldfetch = require('ldfetch');
let ld_fetch = new ldfetch({});
const N3 = require('n3');
import pidusage from 'pidusage';
import { RDFStream } from 'rsp-js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';


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

