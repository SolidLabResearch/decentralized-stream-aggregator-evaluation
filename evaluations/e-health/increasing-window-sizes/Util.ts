import pidusage from 'pidusage';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
const ldfetch = require('ldfetch');
const N3 = require('n3');
const fetch = new ldfetch({});

export async function record(evaluation_name: string, query_function_id: string) {
    const process_id = process.pid;
    const memory_usage = process.memoryUsage();
    const memory_mb = memory_usage.rss / 1024 / 1024;
    pidusage(process_id, (err, stats) => {
        const timestamp = stats.timestamp;
        const cpu_percentage = (100 * stats.cpu) / (os.cpus().length * 100);
        const cpu_usage = stats.cpu;
        const timestamp_date = new Date(timestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '');
        const data = `${timestamp},${cpu_percentage},${cpu_usage},${memory_mb}\n`;
        // const file = `${evaluation_name}/${query_function_id}.csv`;
        const file = `${query_function_id}.csv`
        fs.appendFile(file, data, () => {
        })
    });
}

export async function record_usage(evaluation_name: string, query_function_id: string, interval: number) {
    setInterval(() => {
        record(evaluation_name, query_function_id);
    }, interval);
}

export async function epoch(date: string) {
    return Date.parse(date);
}

export async function find_aggregator_location(solid_pod_webid: string) {
    const pod_location = solid_pod_webid.split('/profile/card#me')[0] + '/';
    fetch.get(solid_pod_webid).then((response: any) => {
        let profile_store = new N3.Store(response.triples);
        for (let quad of profile_store){
            if (quad.predicate.value === 'http://argahsuknesib.github.io/asdo/hasAggregatorLocation'){
                let aggregator_ws = quad.object.value;
                let aggregator_ws_location = 'ws://' + aggregator_ws[1].split('//');
                return aggregator_ws_location;
            }
        }
    });

}

async function main() {
    let web_id = 'http://localhost:3000/dataset_participant1/profile/card#me';
    find_aggregator_location(web_id);
}
main();