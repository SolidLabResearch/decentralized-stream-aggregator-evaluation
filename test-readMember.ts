import { LDESinLDP, LDPCommunication} from "@treecg/versionawareldesinldp";

async function main() {
    let ldes_location = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/";
    let ldes = new LDESinLDP(ldes_location, new LDPCommunication());
    let counter = 0;
    let time_to_fetch = Date.now();
    let to_date_skt = new Date("2024-02-01T17:54:03.025Z");
    let from_date_skt = new Date("2024-02-01T17:49:03.012Z");
    let readable_stream = await ldes.readMembersSorted({
        from: from_date_skt,
        until: to_date_skt,
        chronological: true
    });
    console.log(`Time to fetch: ${(Date.now() - time_to_fetch) / 1000}s`);
    readable_stream.on('data', async (data) => {
        counter++;
    })
    readable_stream.on('end', () => {
        console.log(`Read ${counter} members`);
    });
}

main();
