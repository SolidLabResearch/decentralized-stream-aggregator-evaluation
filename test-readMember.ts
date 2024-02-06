import { LDESinLDP, LDPCommunication, storeToString, extractLdesMetadata, MetadataParser, TREE } from "@treecg/versionawareldesinldp";
import { QueryEngine } from "@comunica/query-sparql";
import { Store } from "n3";
const { eventLoopUtilization } = require('node:perf_hooks').performance;

async function main() {
    let query_engine = new QueryEngine();
    let ldes_location = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/";
    let ldes = new LDESinLDP(ldes_location, new LDPCommunication());

    let metadata = await ldes.readMetadata();
    let quad = metadata.getQuads(ldes_location + "#BucketizeStrategy", TREE.path, null, null);

    let counter = 0;
    let time_to_fetch = Date.now();
    let to_date_skt = new Date("2023-11-24T10:24:05.000Z");
    let from_date_skt = new Date(to_date_skt.getTime() - 120000);
    let readable_stream = await ldes.readMembersSorted({
        from: from_date_skt,
        until: to_date_skt,
        chronological: true
    });
    console.log(`Time to fetch: ${(Date.now() - time_to_fetch) / 1000}s`);
    readable_stream.on('data', async (data) => {
        // let time_start: number;
        counter++;
        let store = new Store(data.quads);
        
        // console.log(storeToString(store));

        // const binding_stream = await query_engine.queryBindings(`
        // PREFIX saref: <https://saref.etsi.org/core/>
        // select ?time where {
        //     ?s saref:hasTimestamp ?time .
        // }
        // `, {
        //     sources: [store]
        // });

        // binding_stream.on('data', async (binding) => {
        //     let time = binding.get('time');
        //     if (time !== undefined) {
        //         time_start = Date.parse(time.value);
        //         console.log(time_start);
        //     }
        // })
    })
    readable_stream.on('end', () => {
        console.log(`Read ${counter} members`);
    });
}

main();
