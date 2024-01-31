import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";
import { QueryEngine } from "@comunica/query-sparql";
import { Store } from "n3";

async function main() {
    let query_engine = new QueryEngine();
    let ldes_location = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/";
    let ldes = new LDESinLDP(ldes_location, new LDPCommunication());
    let counter = 0;
    let readable_stream = await ldes.readMembersSorted({
        from: new Date("2023-11-15T09:45:09.8120Z"),
        until: new Date("2023-11-15T09:49:09.8120Z"),
        chronological: true
    });


    readable_stream.on('data', async (data) => {
        let time_start: number;
        counter++;
        let store = new Store(data.quads);
        const binding_stream = await query_engine.queryBindings(`
        PREFIX saref: <https://saref.etsi.org/core/>
        select ?time where {
            ?s saref:hasTimestamp ?time .
        }
        `, {
            sources: [store]
        });

        binding_stream.on('data', async (binding) => {
            let time = binding.get('time');
            if (time !== undefined) {
                time_start = Date.parse(time.value);
                console.log(time_start);
            }
        })
    });
}

main();
