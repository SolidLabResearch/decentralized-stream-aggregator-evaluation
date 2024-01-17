import {LDESinLDP, LDPCommunication, SolidCommunication, filterRelation, ILDESinLDPMetadata, MetadataParser, extractDateFromLiteral} from "@treecg/versionawareldesinldp";
import {RateLimitedLDPCommunication} from "rate-limited-ldp-communication";
const N3 = require('n3');

async function main() {

    let ldes_location = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/spo2/';
    let counter = 0;
    let ldes = new LDESinLDP(ldes_location, new LDPCommunication());
    const start = performance.now();

    let stream = await ldes.readMembersSorted({
        from: new Date("2023-11-24T09:29:57.000Z"),
        until: new Date("2023-11-24T09:39:57.000Z"),    
        chronological: true,
    })

    // let stream = await ldes.readMembersSorted({
    //     from: new Date("2023-11-15T08:58:10.302Z"),
    //     until: new Date("2023-11-15T08:58:11.302Z"),
    //     chronological: true,
    // });
    stream.on("data", (data: any) => {
        const stream_store = new N3.Store(data.quads);
        const store = stream_store.getQuads(null, null, null, null);
        for (let quad of store) {             
            counter++
        }
    });

    stream.on("end", () => {
        const end = performance.now();
        console.log(`The number of observations are `, counter / 6);
        console.log(`The query took ${(end - start) / 1000} seconds.`);
    });
}

main();
