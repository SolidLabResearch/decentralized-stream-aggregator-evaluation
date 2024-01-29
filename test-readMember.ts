import { LDESinLDP, LDPCommunication, filterRelation, MetadataParser } from "@treecg/versionawareldesinldp";

async function main() {
    let ldes_location = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/bvp/";
    let ldes = new LDESinLDP(ldes_location, new LDPCommunication());
    let metadata_store = await ldes.readMetadata();
    let metadata = MetadataParser.extractLDESinLDPMetadata(metadata_store);
    // let from_date = new Date("2023-11-15T08:58:11.302Z");
    // let to_date = new Date("2023-11-15T08:59:11.302Z");

    let to_date = new Date("2023-11-15T08:59:11.302Z");
    let from_date = new Date("2023-11-15T06:59:11.302Z")
    // let from_date = new Date(to_date.getTime() - 60000 * 60);
    let counter = 0;
    let relations = filterRelation(metadata, from_date, to_date)
    
    let readable_stream = await ldes.readMembersSorted({
        from: from_date,
        until: to_date,
        chronological: true
    });

    readable_stream.on('data', () => {
        counter++;
    })

    readable_stream.on('end', () => {
        console.log(`Number of resources queried: ${(counter) / 3840}`);
    })
}

main();
