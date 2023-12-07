import {LDESinLDP, LDPCommunication, SolidCommunication, filterRelation, ILDESinLDPMetadata, MetadataParser, extractDateFromLiteral} from "@treecg/versionawareldesinldp";
import {RateLimitedLDPCommunication} from "rate-limited-ldp-communication";
const N3 = require('n3');

async function main() {

    let ldes_location = 'http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/';
    let counter = 0;
    let ldes = new LDESinLDP(ldes_location, new LDPCommunication());
    let until = new Date(1700038653238);
    let from = new Date(until.getTime() - 10000);
    const start = performance.now();
    let stream = await ldes.readMembersSorted({
        from: from,
        until: until,
        chronological: true
    });
    stream.on("data", (data: any) => {
        const stream_store = new N3.Store(data.quads);
        const store = stream_store.getQuads(null, null, null, null);
        for (let quad of store) {
            counter++;
        }
    });

    stream.on("end", () => {
        const end = performance.now();
        console.log(`The number of observations is `, counter / 6);
        console.log(`The query took ${end - start} milliseconds.`);
    });
}

main();
