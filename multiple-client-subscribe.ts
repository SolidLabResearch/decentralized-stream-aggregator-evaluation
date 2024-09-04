let ldfetch = require('ldfetch');
let ld_fetch = new ldfetch({});
const N3 = require('n3');
const parser = new N3.Parser();
const solid_pod_location = "https://n079-11.wall1.ilabt.imec.be:3000/pod1/";
const start_find_ldes_stream = Date.now();

async function main() {
    const promises: Promise<any>[] = [];
    const start_find_ldes_stream = Date.now();
    for (let i = 0; i < 5; i++) {
        promises.push(find_relevant_streams(solid_pod_location, ["wearable.acceleration.x", "wearable.acceleration.y", "wearable.acceleration.z"]));
    }
    await Promise.all(promises).then((streams) => {
        if (streams) {
            const end_find_ldes_stream = Date.now();
            console.log(`time_to_find_ldes_stream,${end_find_ldes_stream - start_find_ldes_stream}\n`);
        }
    });
}

main();

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
